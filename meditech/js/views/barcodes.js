/*
 * Barcode Check (Instructor Tools → Barcode Check): faculty scan printed wristbands and
 * medication labels with a hand scanner or the tablet camera and see what each one is —
 * patient, medication, dose, whether it is on the MAR — without opening a chart or charting.
 * A per-patient checklist ticks off every label as it is scanned (kept for this browser tab).
 */
(function () {
  'use strict';
  const esc = U.esc;
  const C = window.EHR_CONFIG;
  const KEY = C.storagePrefix + '.barcodeCheck';
  let pick = '';          // patient id for the checklist
  let last = null;        // result of the most recent scan
  let keepCamera = false;

  const checked = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const mark = code => { const c = checked(); c[code] = Date.now(); try { sessionStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* ignore */ } };
  const clearMarks = () => { try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } };

  const name = p => `${p.name.last}, ${p.name.first}`;
  const sig = m => [m.dose, m.route, m.freq].filter(x => x && x !== '—').join(' · ');

  // Where a medication stands right now on that patient's MAR.
  function medStatus(p, m) {
    const live = Model.get(p.id).meds.find(x => x.id === m.id);
    if (live) return live.status === 'Active' ? { ok: true, text: 'Active order on the MAR' }
      : { ok: true, warn: true, text: `Label works — the order is ${live.status} on the MAR, so students are stopped if they scan it` };
    if (m.eventTitle) return { ok: true, warn: true, text: `Scenario event "${m.eventTitle}" — appears on the MAR when released` };
    return { ok: false, text: 'Not on the MAR' };
  }

  // What a scanned code is. Returns { ok, title, lines[], code (8-digit or MRN) }.
  function identify(raw) {
    const c = Scan.clean(raw);
    const pts = Model.allPatients();
    if (!c) return null;
    const ptHit = Scan.patientOf(c);
    if (ptHit) {
      const al = ptHit.nkda || !(ptHit.allergies || []).length ? 'NKDA' : 'Allergies: ' + ptHit.allergies.map(a => a.agent).join(', ');
      const wrist = Scan.wristbandFor(ptHit);
      return { ok: true, code: c, marks: [c, String(ptHit.mrn).toUpperCase(), wrist].filter(Boolean), kind: c === wrist ? `Wristband — ATU code ${wrist}` : 'Wristband (MRN)',
        title: `${name(ptHit)} — MRN ${ptHit.mrn}`, lines: [`DOB ${U.fmtDOB(ptHit.dob)} · ${ptHit.age} ${ptHit.sex} · ${ptHit.unit || ''}`, al], pid: ptHit.id };
    }
    const parsed = Scan.parseCode(c);
    if (parsed && parsed.kind === 'pkg' && parsed.pkg.blood) {
      // Blood bag: matched to blood-product orders (documented on the TAR), including ones waiting for release.
      const BLOOD = /PRBC|packed red|red blood cell|transfus/i, uses = [];
      pts.forEach(p => {
        (p.orders || []).filter(o => BLOOD.test(o.text || '')).forEach(o => uses.push(`${name(p)}: ${o.text} — active order (TAR)`));
        (p.events || []).forEach(e => (e.orders || []).filter(o => BLOOD.test(o.text || '')).forEach(o => uses.push(`${name(p)}: ${o.text} — scenario event "${e.title}" (TAR when released)`)));
      });
      return { ok: uses.length > 0, warn: true, code: parsed.code, kind: `ATU package label ${parsed.code} — blood product`, title: parsed.pkg.name,
        lines: uses.concat(['Blood products are documented on the TAR, not the MAR.']) };
    }
    if (parsed && parsed.kind === 'pkg') {
      // ATU package: the drug, and the matching orders on every patient.
      const uses = [];
      pts.forEach(p => Model.labelSet(p).meds.forEach(x => { if (Scan.pkgMatches(parsed.code, x.m)) uses.push({ p, m: x.m, st: medStatus(p, x.m) }); }));
      const listedNoOrder = (parsed.pkg.patients || []).filter(id => !uses.some(u => u.p.id === id)).map(id => pts.find(p => p.id === id)).filter(Boolean);
      return { ok: uses.length > 0, warn: listedNoOrder.length > 0, code: parsed.code, kind: `ATU package label ${parsed.code}`, title: parsed.pkg.name,
        lines: uses.map(u => `${name(u.p)}: ${u.m.name} ${sig(u.m)} — ${u.st.text}`)
          .concat(listedNoOrder.map(p => `${name(p)}: listed by ATU, but this chart has no order for it yet`))
          .concat(uses.length ? [] : ['No patient has an order this package matches.']), pid: uses.length === 1 ? uses[0].p.id : null };
    }
    if (parsed && parsed.kind === 'rx') {
      for (const p of pts) {
        const hit = Model.labelSet(p).meds.find(x => x.m.id === parsed.medId);
        if (hit) {
          const st = medStatus(p, hit.m);
          return { ok: st.ok, warn: st.warn, code: hit.code, kind: 'Medication label', title: `${hit.m.name} — ${sig(hit.m)}`,
            lines: [`Patient: ${name(p)} (MRN ${p.mrn})`, st.text, hit.m.highAlert ? 'High-alert medication' : ''].filter(Boolean), pid: p.id };
        }
      }
      return { ok: false, code: c, kind: 'Medication label', title: 'No medication matches this label', lines: ['The medication may have been removed from the patient. Reprint labels from Print Wristbands & Med Labels.'] };
    }
    if (parsed && parsed.kind === 'product') {
      const uses = [];
      pts.forEach(p => Model.labelSet(p).meds.forEach(x => { if (x.m.type !== 'continuous' && Scan.drugKey(x.m) === parsed.key) uses.push({ p, m: x.m }); }));
      const label = `${parsed.key.charAt(0) + parsed.key.slice(1).toLowerCase()} ${Scan.fmt(parsed.dose)}`;
      return { ok: uses.length > 0, code: Scan.shortCode(parsed.code), kind: 'Unit-dose product label', title: `${label} — 1 unit`,
        lines: uses.length ? uses.map(u => `Ordered for ${name(u.p)}: ${u.m.name} ${sig(u.m)}`) : ['No patient has an order for this drug.'] };
    }
    return { ok: false, code: c, kind: 'Not recognized', title: 'This barcode is not a current EHR label',
      lines: [/^\d{8}$/.test(c) ? 'It looks like an old label. Reprint from Print Wristbands & Med Labels.' : 'Check that it is a label printed from Print Wristbands & Med Labels.'] };
  }

  function handle(raw) {
    const r = identify(raw);
    if (!r) return;
    r.raw = String(raw);
    r.at = Date.now();
    if (r.ok) (r.marks || [r.code]).forEach(mark);
    last = r;
    if (r.pid && !pick) pick = r.pid;
    App.render();
    if (keepCamera && window.CameraScan) setTimeout(() => CameraScan.open(handle, { title: 'Barcode Check — scan next label' }), 900);
  }

  function checklist(p) {
    const done = checked();
    const set = Model.labelSet(p);
    // The accepted (installed) ATU labels: wristband code, one label per MED package, plus orders with no ATU package.
    const A = set.atu;
    const rows = [{ kind: 'Wristband (ATU)', code: A.wrist || String(p.mrn).toUpperCase(), what: `${name(p)} — MRN ${p.mrn}` }]
      .concat(A.packages.map(x => ({ kind: 'ATU package', code: x.code, what: `${x.pkg.name} — for ${x.meds.length ? x.meds.map(m => `${m.name} ${sig(m)}`).join('; ') : x.pkg.blood ? 'the transfusion order (TAR)' : '(no order in this chart yet)'}`,
        note: x.meds.length ? null : x.pkg.blood ? { ok: true, warn: true, text: 'Blood product — documented on the TAR' } : { ok: false, text: 'Listed by ATU; this chart has no order for it' } })))
      .concat(A.unpackaged.map(x => ({ kind: x.product ? 'Hospital product label (no ATU package)' : 'Hospital label (no ATU package)', code: x.code,
        what: x.product ? `${x.m.name} ${Scan.fmt(x.d)} — unit dose` : `${x.m.name} — ${sig(x.m)}`, note: medStatus(p, x.m) })));
    const n = rows.filter(r => done[r.code]).length;
    return `<div class="bc-progress"><strong>${n} of ${rows.length}</strong> labels for ${esc(name(p))} scanned
        <span class="bc-bar"><span style="width:${Math.round(100 * n / rows.length)}%"></span></span></div>
      <table class="grid bc-table"><thead><tr><th></th><th>Label</th><th>Number</th><th>Status</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="${done[r.code] ? 'bc-done' : ''}">
        <td>${done[r.code] ? '✔' : ''}</td>
        <td><span class="muted small">${esc(r.kind)}</span><br>${esc(r.what)}</td>
        <td class="nowrap"><code>${esc(r.code)}</code></td>
        <td>${done[r.code] ? `Scanned ${esc(U.fmtTime(done[r.code]))}` : '<span class="muted">Not scanned yet</span>'}${r.note && (r.note.warn || !r.note.ok) ? `<div class="muted small">${esc(r.note.text)}</div>` : ''}</td>
      </tr>`).join('')}</tbody></table>`;
  }

  Screens.barcodes = {
    render() {
      const pts = Model.allPatients();
      const p = pick && pts.find(x => x.id === pick);
      const res = last ? `<div class="bc-result ${last.ok ? (last.warn ? 'bc-warn' : 'bc-ok') : 'bc-bad'}" role="status">
          <div class="bc-kind">${last.ok ? '✔' : '✖'} ${esc(last.kind)}</div>
          <div class="bc-title">${esc(last.title)}</div>
          ${last.lines.map(l => `<div>${esc(l)}</div>`).join('')}
          <div class="muted small">Scanner sent: <code>${esc(last.raw)}</code> · ${esc(U.fmtTime(last.at))}</div>
        </div>` : '<div class="bc-result bc-idle">Scan a wristband or medication label to see what it is.</div>';
      return `<div class="page">
        <div class="page-head"><h1>Barcode Check</h1><div>
          <a class="btn" href="labels.html">Print Wristbands & Med Labels</a>
          <a class="btn" href="#/instructor">Back to Instructor Tools</a>
        </div></div>
        <p class="muted">Check printed labels before a simulation. Scan with a hand scanner (click in the box first) or the tablet camera. Nothing is charted.</p>
        <div class="bc-scan">
          <input id="bc-in" class="bc-in" autocomplete="off" autocapitalize="off" placeholder="Click here, then scan a label (or type the number and press Enter)">
          <button type="button" class="btn btn-primary" data-action="bc-cam">📷 Camera</button>
          <label class="check"><input type="checkbox" data-action="bc-keep" ${keepCamera ? 'checked' : ''}> Keep the camera open for the next label</label>
        </div>
        ${res}
        <div class="bc-list-head">
          <label class="field"><span>Checklist for patient</span><select data-action="bc-pick"><option value="">— Choose a patient —</option>
            ${pts.map(x => `<option value="${esc(x.id)}" ${x.id === pick ? 'selected' : ''}>${esc(name(x))} (MRN ${esc(x.mrn)})</option>`).join('')}</select></label>
          <button type="button" class="btn" data-action="bc-clear">Clear checkmarks</button>
        </div>
        ${p ? checklist(p) : '<p class="muted">Choose a patient (or scan their wristband) to see every label to check.</p>'}
      </div>`;
    },
    bind(root) {
      const input = root.querySelector('#bc-in');
      setTimeout(() => { if (!document.querySelector('.modal-backdrop')) input.focus(); }, 0);
      input.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== 'Tab') return;
        e.preventDefault();
        const v = input.value; input.value = '';
        handle(v);
      });
      root.querySelector('[data-action="bc-cam"]').addEventListener('click', () => CameraScan.open(handle, { title: 'Barcode Check — scan a label' }));
      root.querySelector('[data-action="bc-keep"]').addEventListener('change', e => { keepCamera = e.target.checked; });
      root.querySelector('[data-action="bc-pick"]').addEventListener('change', e => { pick = e.target.value; App.render(); });
      root.querySelector('[data-action="bc-clear"]').addEventListener('click', () => { clearMarks(); last = null; App.render(); });
    },
    identify
  };
})();
