/* eMAR — medication administration with barcode verification and safety checks. */
(function () {
  'use strict';
  const esc = U.esc;
  const C = window.EHR_CONFIG;
  window.Views = window.Views || {};

  const STATUS_TEXT = { given: 'Given', notgiven: 'Not given', due: 'Due', overdue: 'Overdue', future: 'Scheduled', notdue: 'Not due today', notyet: 'Starts tomorrow — not available yet', dc: 'DC\'d', hold: 'Held' };
  const INFUSION_ACTIONS = ['Started / hung', 'Rate verified', 'Rate change', 'Paused', 'Resumed', 'Bolus completed', 'Stopped / discontinued'];
  const NOT_GIVEN = ['Held — hold parameters met', 'Held — provider notified', 'Patient refused', 'Patient NPO', 'Patient off unit', 'Medication unavailable', 'Clarification needed with provider', 'Allergy — not given', 'Other (see comment)'];
  const SITES = ['', 'Right arm', 'Left arm', 'Right hand', 'Left hand', 'Abdomen — RUQ', 'Abdomen — LUQ', 'Abdomen — RLQ', 'Abdomen — LLQ', 'Right thigh', 'Left thigh', 'Right deltoid', 'Left deltoid', 'Right ventrogluteal', 'Left ventrogluteal', 'PIV — right', 'PIV — left', 'Central line', 'Other'];
  const PRE = {
    HR: ['hr', 'Heart rate (bpm)'], SBP: ['sbp', 'Systolic BP'], DBP: ['dbp', 'Diastolic BP'], RR: ['rr', 'Respiratory rate'],
    SpO2: ['spo2', 'SpO₂ (%)'], Temp: ['temp', 'Temp (°F)'], Glucose: ['glucose', 'Blood glucose (mg/dL)'], Pain: ['pain', 'Pain score (0–10)']
  };


  function typeOf(m) { return m.type === 'once' ? 'scheduled' : m.type; }

  function statusBadge(m) {
    if (m.status === 'Active') return '';
    const kind = m.status === 'Do Not Administer' ? 'danger' : m.status === 'Discontinued' ? 'muted' : 'warn';
    return UI.badge(m.status, kind);
  }

  function infusionState(doc, m) {
    const e = doc.mar.filter(x => x.status === 'active' && x.data.medId === m.id && x.data.infusion).sort((a, b) => b.time - a.time)[0];
    if (e) return `${e.data.action}${e.data.rate ? ' — ' + e.data.rate : ''} at ${U.fmtTime(e.time)} (${Model.signature(e)})`;
    if (m.startedPrior) return `Infusing — started ${U.fmtTime(m.startedPrior.time)} (${m.startedPrior.by})`;
    return 'Not started';
  }

  /* ---------------- MAR grid (Expanse style, its own screen) ---------------- */

  const include = { active: true, stat: true, iv: true, prn: true, dc: false };
  const shiftViews = {}, shiftKeys = {};
  const shiftView = p => shiftViews[p.id] || 'current';
  const documentedDose = (p, doc, m, dt) => ['given', 'notgiven'].includes(Model.doseStatus(p, doc, m, dt).code);
  function shiftShown(p, doc, m, view) {
    if (view === 'history') return true;
    if (view === 'inactive') return m.status !== 'Active';
    if (view === 'completed') return (m.doseTimes || []).some(dt => documentedDose(p, doc, m, dt)) || doc.mar.some(e => e.status === 'active' && e.data.medId === m.id);
    if (m.status !== 'Active') return false;
    if (m.type === 'prn') return true;
    if (m.type === 'continuous') {
      const latest = doc.mar.filter(e => e.status === 'active' && e.data.medId === m.id && e.data.infusion).sort((a,b) => b.time-a.time)[0];
      return !latest || !/^(Bolus completed|Stopped \/ discontinued)$/.test(latest.data.action);
    }
    return (m.doseTimes || []).some(dt => Model.doseInCurrentShift(p, dt) && ['due','overdue','future'].includes(Model.doseStatus(p, doc, m, dt).code));
  }
  const verified = {};       // pid -> time the wristband was scanned on the MAR screen
  // pid -> medications scanned on the MAR and waiting to be documented: [{ med, dt, mode, scans: [unit] }].
  // Like Expanse BMV: scan the wristband and every medication, then Save to review and Document them together.
  const queue = {};
  const queued = pid => queue[pid] || (queue[pid] = []);
  // Leaving the MAR ends the verification and drops anything scanned but not documented.
  window.addEventListener('hashchange', () => {
    Object.keys(verified).concat(Object.keys(queue)).forEach(pid => { if (location.hash !== `#/patient/${pid}/mar`) { delete verified[pid]; delete queue[pid]; } });
  });

  // One scanned unit for an order, or null when the barcode is not this medication.
  function unitFor(med, parsed) {
    if (!parsed) return null;
    if (parsed.code === med.barcode.toUpperCase()) return { code: parsed.code, dose: Scan.parseDose(med.dose), label: `${med.name} ${med.dose}` };
    if (parsed.kind === 'product' && parsed.key === Scan.drugKey(med)) return { code: parsed.code, dose: parsed.dose, label: `${med.name} ${Scan.fmt(parsed.dose)}` };
    // ATU package (MED-####): verifies the drug; the package carries no strength, so the dose is confirmed on the review screen.
    if (parsed.kind === 'pkg' && Scan.pkgMatches(parsed.code, med)) return { code: parsed.code, dose: null, label: `${med.name} (package ${parsed.code})` };
    return null;
  }
  // Scanned units added up, compared with the ordered dose.
  function tallyOf(med, mode, scans) {
    if (!scans.length) return { total: null, code: '', html: '' };
    const unit = (scans.find(x => x.dose) || {}).dose;
    const total = unit ? { value: scans.reduce((n, x) => n + (x.dose ? x.dose.value : 0), 0), unit: unit.unit } : null;
    const ordered = mode === 'infusion' ? null : Scan.parseDose(med.dose);
    let code = '', status = '';
    if (ordered && total && total.unit === ordered.unit) {
      if (Math.abs(total.value - ordered.value) < 1e-6) { code = 'ok'; status = `<div class="tally-ok">✔ Scanned dose matches the ordered dose (${Scan.fmt(ordered)}).</div>`; }
      else if (total.value < ordered.value) { code = 'low'; status = `<div class="tally-low">⚠ Scanned ${Scan.fmt(total)} is LESS than the ordered ${Scan.fmt(ordered)}. Scan the remaining ${Scan.fmt({ value: ordered.value - total.value, unit: ordered.unit })}.</div>`; }
      else { code = 'high'; status = `<div class="tally-high">⛔ Scanned ${Scan.fmt(total)} EXCEEDS the ordered ${Scan.fmt(ordered)}. Remove the extra unit or edit the dose given before documenting.</div>`; }
    }
    return { total, code, html: `<div class="tally-list">Scanned: ${scans.map(x => `<span class="tally-unit">${esc(x.label)}</span>`).join(' + ')}${total && scans.length > 1 ? ` = <strong>${esc(Scan.fmt(total))}</strong>` : ''}</div>${status}` };
  }
  function addToQueue(p, med, dt, mode, unit) {
    queued(p.id).push({ med, dt, mode, scans: [unit] });
    App.render();
  }

  // A medication scanned on the MAR screen: find its order, pick the dose, and open the administration.
  function scanOnMar(p, doc, code) {
    const c = Scan.clean(code);
    if (!c) return;
    const scannedPt = Scan.patientOf(c);
    if (scannedPt && scannedPt.id === p.id) { verified[p.id] = p.clock.now(); UI.toast(`Patient verified: ${p.name.last}, ${p.name.first}.`); App.render(); return; }
    const otherPt = scannedPt;
    if (otherPt) {
      delete verified[p.id]; delete queue[p.id];
      UI.modal({ title: 'WRONG PATIENT', body: `<div class="hard-stop"><strong>⛔ This wristband does not belong to ${esc(p.name.last)}, ${esc(p.name.first)}.</strong> Stop. Verify two patient identifiers before giving any medication.</div>`, buttons: [{ label: 'OK' }] });
      App.render();
      return;
    }
    const parsed = Scan.parseCode(c);
    if (!parsed) { UI.toast('Barcode not recognized.', 'warn'); return; }
    if (!verified[p.id]) {
      UI.modal({ title: 'Scan the Wristband First', body: '<p>Scan the patient\'s wristband before scanning medications.</p>', buttons: [{ label: 'OK' }] });
      return;
    }
    // Another unit of a medication already scanned adds to it (2 × 325 mg = 650 mg).
    const already = queued(p.id).find(x => unitFor(x.med, parsed));
    if (already) {
      const unit = unitFor(already.med, parsed);
      already.scans.push(unit);
      App.render();
      return;
    }
    if (parsed.kind === 'pkg' && parsed.pkg.blood) {
      UI.modal({ title: 'Blood Product', body: `<div class="hard-stop"><strong>${esc(parsed.pkg.name)} (${esc(parsed.code)}).</strong> Blood products are documented on the <strong>TAR</strong> (Document ▾ → Transfusion Administration Record), with the two-RN bedside check — not on the MAR.</div>`, buttons: [{ label: 'OK' }] });
      return;
    }
    const matches = parsed.kind === 'rx' ? p.meds.filter(m => m.id === parsed.medId)
      : parsed.kind === 'pkg' ? p.meds.filter(m => Scan.pkgMatches(parsed.code, m))
      : p.meds.filter(m => Scan.drugKey(m) === parsed.key);
    const active = matches.filter(m => m.status === 'Active');
    if (!active.length) {
      const dc = matches.find(m => m.status !== 'Active');
      const name = parsed.kind === 'product' ? `${parsed.key.toLowerCase()} ${Scan.fmt(parsed.dose)}` : parsed.kind === 'pkg' ? `${parsed.pkg.name} (${parsed.code})` : 'this medication';
      UI.modal({ title: 'No Active Order', body: `<div class="hard-stop"><strong>⛔ ${dc ? `The order for ${esc(dc.name)} is ${esc(dc.status)}.` : `There is no order for ${esc(name)} on this patient's MAR.`}</strong> Do not administer. Check the order and the medication label.</div>`, buttons: [{ label: 'OK' }] });
      return;
    }
    // Orders with a dose due now, then the exact scanned strength, are listed first.
    const strength = parsed.kind === 'product' ? parsed.dose : null;
    const exact = m => { const d = Scan.parseDose(m.dose); return strength && d && d.unit === strength.unit && Math.abs(d.value - strength.value) < 1e-6; };
    const pending = m => (m.doseTimes || []).filter(dt => Model.doseInCurrentShift(p, dt) && ['due', 'overdue', 'future'].includes(Model.doseStatus(p, doc, m, dt).code)).sort((a, b) => a.time - b.time);
    const dueNow = m => pending(m).some(dt => ['due', 'overdue'].includes(Model.doseStatus(p, doc, m, dt).code));
    const opts = { unit: parsed };
    // Same drug on more than one active order (loading + maintenance, 5 mg + 10 mg PRN): the nurse picks the order.
    if (active.length > 1) {
      const sorted = active.slice().sort((a, b) => (dueNow(b) - dueNow(a)) || (exact(b) - exact(a)));
      UI.modal({
        title: 'Which Order?',
        body: `<p>This medication matches <strong>${active.length} active orders</strong>. Choose the order you are giving it for.</p>
          <div class="pick-order">${sorted.map(m => `<button type="button" class="btn btn-primary" data-pick="${esc(m.id)}">${esc(Model.medLabel(m))}${dueNow(m) ? ' — <strong>due now</strong>' : ''}</button>`).join('')}</div>`,
        buttons: [{ label: 'Cancel', onClick: () => UI.toast('Scan cancelled. Nothing was charted.') }],
        onOpen(api) {
          api.el.querySelectorAll('[data-pick]').forEach(btn => btn.addEventListener('click', () => {
            const m = active.find(x => x.id === btn.dataset.pick);
            api.close();
            setTimeout(() => scanOrder(p, doc, m, opts, pending), 0);
          }));
        }
      });
      return;
    }
    scanOrder(p, doc, active[0], opts, pending);
  }
  function scanOrder(p, doc, med, opts, pending) {
    const unit = unitFor(med, opts.unit);
    const t = typeOf(med);
    if (t === 'continuous') return addToQueue(p, med, null, 'infusion', unit);
    if (t === 'prn') return addToQueue(p, med, null, 'prn', unit);
    const list = pending(med);
    if (!list.length && med.startsOn && p.clock.now() < med.startsOn) { UI.modal({ title: 'Not Available Yet', body: `<div class="hard-stop"><strong>⛔ ${esc(Model.medLabel(med))} starts ${esc(U.fmtDT(med.startsOn))}.</strong> No dose is available today. Do not administer.</div>`, buttons: [{ label: 'OK' }] }); return; }
    if (!list.length) { UI.modal({ title: 'No Dose Due', body: `<p>${p.clock.staged ? `No undocumented dose of ${esc(med.name)} is scheduled in the current simulation shift.` : `All scheduled doses of ${esc(med.name)} in view are documented.`} Do not give an extra dose without an order.</p>`, buttons: [{ label: 'OK' }] }); return; }
    const dt = list[0];
    const s = Model.doseStatus(p, doc, med, dt).code;
    if (s === 'due' || s === 'overdue') return addToQueue(p, med, dt, 'dose', unit);
    UI.modal({
      title: 'Dose Not Due Now',
      body: `<p><strong>${esc(Model.medLabel(med))}</strong></p><p>The next scheduled dose is <strong>${esc(U.fmtDT(dt.time))}</strong>. Are you charting this for the <strong>${esc(U.fmtTime(dt.time))}</strong> scheduled dose?</p>`,
      buttons: [{ label: 'No — Cancel', onClick: () => UI.toast('Scan cancelled. Nothing was charted.') }, { label: `Yes — ${U.fmtTime(dt.time)} Dose`, cls: 'btn-primary', onClick: () => { setTimeout(() => addToQueue(p, med, dt, 'dose', unit), 0); } }]
    });
  }

  // The scanned medications waiting to be documented, shown under the scan bar.
  function queuePanel(p) {
    const list = queued(p.id);
    if (!list.length) return '';
    return `<div class="mg-queue"><div class="mg-queue-h">Scanned — ready to document (${list.length})</div>
      <table class="grid"><thead><tr><th>Medication</th><th>Scheduled</th><th>Scanned</th><th></th></tr></thead><tbody>
      ${list.map((x, i) => `<tr><td><strong>${esc(x.med.name)}</strong> ${esc([x.med.dose, x.med.route].filter(y => y && y !== '—').join(' '))}<div class="muted small">${esc(x.med.freq)}</div></td>
        <td class="nowrap">${x.dt ? esc(U.fmtDT(x.dt.time)) : x.mode === 'prn' ? 'PRN' : 'Infusion'}</td>
        <td>${tallyOf(x.med, x.mode, x.scans).html}</td>
        <td><button type="button" class="btn btn-sm" data-unqueue="${i}" aria-label="Remove ${esc(x.med.name)}">✕ Remove</button></td></tr>`).join('')}
      </tbody></table>
      <div class="form-actions"><button type="button" class="btn" data-qclear>Clear All</button><button type="button" class="btn btn-primary" data-qsave>Save</button></div></div>`;
  }

  const days = 3;            // yesterday, today, tomorrow
  const DAY = 86400000;
  const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const hhmm = t => U.fmtTime(t);
  const rel = ms => { const a = Math.abs(ms); const txt = a < 3600000 ? Math.round(a / 60000) + 'm' : a < 48 * 3600000 ? Math.round(a / 3600000) + 'h' : Math.round(a / DAY) + 'd'; return (ms < 0 ? '+' : '-') + txt; };

  function shown(m) {
    const inactive = m.status === 'Discontinued';
    if (inactive && !include.dc) return false;
    if (!inactive && !include.active) return false;
    if (m.type === 'once') return include.stat;
    if (m.type === 'continuous') return include.iv;
    if (m.type === 'prn') return include.prn;
    return true;
  }

  function doseCell(p, doc, m, dt) {
    const s = Model.doseStatus(p, doc, m, dt);
    const now = p.clock.now();
    const who = s.entry ? U.initials(s.entry.user.name) : (dt.priorBy || dt.priorNGBy || '');
    let txt = '';
    if (s.code === 'given') txt = `✔ ${s.entry ? hhmm(s.entry.time) : hhmm(dt.time)}${who ? ' ' + esc(who) : ''}`;
    else if (s.code === 'notgiven') txt = `Not given${who ? ' ' + esc(who) : ''}`;
    else if (s.code === 'due') txt = Math.abs(now - dt.time) < 60000 ? 'Due' : `Due ${rel(now - dt.time)}`;
    else if (s.code === 'overdue') txt = rel(now - dt.time);
    else if (s.code === 'notdue') txt = 'Not today';
    else if (s.code === 'notyet') txt = 'Starts tmrw';
    else if (s.code === 'dc') txt = 'DC';
    else if (s.code === 'hold') txt = 'Held';
    const readOnly = p.clock.staged && (shiftView(p) !== 'current' || !Model.doseInCurrentShift(p, dt));
    return `<td class="mg-cell mg-${s.code}">${readOnly ? `<span class="mg-note" title="${esc(STATUS_TEXT[s.code])} — scheduled ${U.fmtDT(dt.time)}">${txt || (s.code === 'future' ? 'Scheduled' : '&nbsp;')}</span>` : `<button class="mg-btn" data-dose="${esc(dt.key)}" ${s.code === 'notyet' ? 'disabled aria-disabled="true"' : ''} title="${esc(STATUS_TEXT[s.code])} — scheduled ${U.fmtDT(dt.time)}">${txt || '&nbsp;'}</button>`}</td>`;
  }

  // Current dose of an infusion: the latest documented rate, else the ordered rate.
  function currentDose(doc, m) {
    // Latest by event time; ties go to the entry charted last.
    const e = doc.mar.filter(x => x.status === 'active' && x.data.medId === m.id && x.data.infusion && x.data.rate).reduce((best, x) => !best || x.time >= best.time ? x : best, null);
    return e ? e.data.rate : (m.rate || '');
  }
  const titratable = m => m.type === 'continuous' && m.protocol && m.status === 'Active';

  // Small boxed icons under the medication, like Expanse: P = protocol, titrate symbol = titrate.
  function icons(p, m) {
    const out = [];
    if (m.protocol && Views.protocol.get(p, m.protocol)) out.push(`<button type="button" class="mg-ico" data-protocol="${esc(m.protocol)}" title="Protocol" aria-label="View protocol">P</button>`);
    if (titratable(m)) out.push(`<button type="button" class="mg-ico mg-ico-titr" data-titrate="${esc(m.id)}" title="Titrate" aria-label="Titrate">⇅</button>`);
    if (m.highAlert) out.push('<span class="mg-ico mg-ico-ha" title="High-alert medication">HA</span>');
    return out.length ? `<div class="mg-icons">${out.join('')}</div>` : '';
  }

  function medCell(p, doc, m, rows) {
    const conflicts = Model.allergyConflicts(p, m);
    const t = m.type === 'once' ? 'ONE' : m.type === 'prn' ? 'PRN' : m.type === 'continuous' ? (m.protocol ? '@ Titrate IV' : 'IV') : 'SCH';
    const cur = m.type === 'continuous' ? currentDose(doc, m) : '';
    const completed = p.clock.staged && m.type === 'once' && m.doseTimes.length && m.doseTimes.every(dt => documentedDose(p, doc, m, dt));
    return `<td class="mg-start" rowspan="${rows}">${esc(U.fmtDT(m.orderTime))}${m.dcTime ? `<br>${esc(U.fmtDT(m.dcTime))}` : ''}<br><span class="${m.status === 'Active' ? '' : 'mg-status-off'}">${completed ? 'Documented / completed' : esc(m.status)}</span>
        ${m.isNew ? '<br>' + UI.badge('NEW', 'new') : ''}</td>
      <td class="mg-med" rowspan="${rows}" data-select="${esc(m.id)}" tabindex="0" title="Click for Medication Detail">
        ${conflicts.length ? UI.badge('ALLERGY: ' + conflicts.map(a => a.agent).join(', '), 'danger') + ' ' : ''}
        <strong>${esc(m.name)}</strong> ${esc([m.dose, m.route].filter(x => x && x !== '—').join(' '))}
        <div><strong>${esc(m.freq)} ${t}</strong></div>
        ${cur ? `<div><strong>Current Dose: ${esc(cur)}</strong></div>` : ''}
        <div class="mg-give">Give: ${esc(m.dose)}</div>
        ${m.indication ? `<div class="mg-give">PRN Reason: ${esc(m.indication)}</div>` : ''}
        <div class="mg-rx">Rx#: ${esc(m.barcode)}</div>
        ${icons(p, m)}
        ${m.instructions ? `<div class="mg-label"><strong>Label Comments:</strong> ${esc(m.instructions)}</div>` : ''}
        ${m.holdReason ? `<div class="med-hold">${esc(m.holdReason)}</div>` : ''}
        ${m.holdIf ? `<div class="med-hold">Hold if ${m.holdIf.map(h => `${esc(h.p)} ${esc(h.op)} ${esc(h.v)}`).join(' or ')}</div>` : ''}
      </td>`;
  }

  const inDay = (t, c) => t >= c && t < c + DAY;

  function medRows(p, doc, m, cols, today) {
    const t = typeOf(m);
    const active = m.status === 'Active' && (!p.clock.staged || shiftView(p) === 'current');
    if (t === 'prn') {
      const given = doc.mar.filter(e => e.status === 'active' && e.data.medId === m.id && e.data.action === 'Given');
      const priorTimes = [m.lastGivenPrior, ...(m.doseTimes || []).filter(d => d.priorBy).map(d => ({ time: d.time, by: d.priorBy }))].filter(Boolean);
      const pending = given.filter(e => e.data.prn && !doc.mar.some(x => x.status === 'active' && x.data.action === 'Effectiveness' && x.data.refId === e.id));
      const prnCell = c => `<td class="mg-cell ${c === today && active ? 'mg-prn' : 'mg-none'}">${c === today && active ? `<button class="mg-btn" data-prn="${esc(m.id)}" title="Give PRN dose">PRN +</button>` : ''}</td>`;
      const lastCell = c => {
        const items = given.filter(e => inDay(e.time, c)).map(e => `✔ ${hhmm(e.time)} ${esc(U.initials(e.user.name))}`)
          .concat(priorTimes.filter(g => inDay(g.time, c)).map(g => `✔ ${hhmm(g.time)} ${esc(g.by)}`));
        const re = c === today ? pending.map(e => `<button class="mg-btn mg-reassess" data-effect="${e.id}" data-med="${esc(m.id)}" title="Document PRN effectiveness">Reassess ${hhmm(e.time)} dose</button>`).join('') : '';
        return `<td class="mg-cell ${items.length ? 'mg-given' : 'mg-none'}">${items.map(x => `<div class="mg-note">${x}</div>`).join('')}${re}</td>`;
      };
      return `<tr>${medCell(p, doc, m, 2)}<td class="mg-time">${active ? `<button class="mg-timebtn" data-prn="${esc(m.id)}" title="Give PRN dose">PRN ⊕</button>` : 'PRN'}</td>${cols.map(prnCell).join('')}</tr>
        <tr><td class="mg-time muted">Last<br>Admin</td>${cols.map(lastCell).join('')}</tr>`;
    }
    if (t === 'continuous') {
      const entries = doc.mar.filter(e => e.status === 'active' && e.data.medId === m.id && e.data.infusion);
      const cell = c => {
        const items = entries.filter(e => inDay(e.time, c)).sort((a, b) => a.time - b.time).map(e => `${hhmm(e.time)} ${esc(e.data.action)}${e.data.rate ? ' ' + esc(e.data.rate) : ''}`);
        if (m.startedPrior && inDay(m.startedPrior.time, c)) items.unshift(`${hhmm(m.startedPrior.time)} Started ${esc(m.startedPrior.by)}`);
        const clickable = c === today && active;
        return `<td class="mg-cell ${items.length ? 'mg-given' : clickable ? 'mg-iv' : 'mg-none'}">${clickable
          ? `<button class="mg-btn" data-infusion="${esc(m.id)}" title="Document infusion">${items.length ? items.map(x => `<div class="mg-note">${x}</div>`).join('') : 'Document'}</button>`
          : items.map(x => `<div class="mg-note">${x}</div>`).join('')}</td>`;
      };
      return `<tr>${medCell(p, doc, m, 1)}<td class="mg-time">IV</td>${cols.map(cell).join('')}</tr>`;
    }
    // Scheduled / one-time: one row per time of day, one column per day.
    const inView = m.doseTimes.filter(dt => cols.some(c => inDay(dt.time, c)) && (!p.clock.staged || shiftView(p) === 'history' || shiftView(p) === 'inactive' || (shiftView(p) === 'completed' ? documentedDose(p, doc, m, dt) : Model.doseInCurrentShift(p, dt) && !documentedDose(p, doc, m, dt))));
    const times = [...new Set(inView.map(dt => hhmm(dt.time)))].sort();
    if (!times.length) return `<tr>${medCell(p, doc, m, 1)}<td class="mg-time">—</td>${cols.map(() => '<td class="mg-cell mg-none"></td>').join('')}</tr>`;
    return times.map((tm, i) => `<tr>${i === 0 ? medCell(p, doc, m, times.length) : ''}<td class="mg-time">${tm.replace(/(\d\d)(\d\d)/, '$1:$2')}</td>
      ${cols.map(c => { const dt = inView.find(d => inDay(d.time, c) && hhmm(d.time) === tm); return dt ? doseCell(p, doc, m, dt) : '<td class="mg-cell mg-none"></td>'; }).join('')}</tr>`).join('');
  }

  // Medication Detail, with Expanse-style tabs: Detail | History | Prot/Taper | Order.
  function medDetail(p, doc, m, startTab) {
    const hist = Model.marEntries(doc, m.id).sort((a, b) => b.time - a.time);
    const prior = (m.doseTimes || []).filter(d => d.priorBy || d.priorNotGiven).map(d => `<li>${esc(U.fmtDT(d.time))} — ${d.priorBy ? 'Given' : 'Not given: ' + esc(d.priorNotGiven)} (${esc(d.priorBy || d.priorNGBy || 'prior RN')})</li>`)
      .concat(m.lastGivenPrior ? [`<li>${esc(U.fmtDT(m.lastGivenPrior.time))} — Given (${esc(m.lastGivenPrior.by)})</li>`] : [])
      .concat(m.startedPrior ? [`<li>${esc(U.fmtDT(m.startedPrior.time))} — Infusion started (${esc(m.startedPrior.by)})</li>`] : []);
    const pr = m.protocol && Views.protocol.get(p, m.protocol);
    const o = Model.medOrders(p).find(x => x.id === m.id);
    const cur = m.type === 'continuous' ? currentDose(doc, m) : '';
    const tabs = {
      detail: `<table class="grid"><thead><tr><th>Medication</th><th>Start</th><th>Stop</th><th>Status</th></tr></thead><tbody><tr>
          <td><strong>${esc(Model.medLabel(m))}</strong>${cur ? `<div><strong>Current Dose: ${esc(cur)}</strong></div>` : ''}<div class="mg-rx">Rx#: ${esc(m.barcode)}</div>
            ${m.instructions ? `<div class="mg-label"><strong>Label Comments:</strong> ${esc(m.instructions)}</div>` : ''}</td>
          <td class="nowrap">${esc(U.fmtDT(m.orderTime))}</td><td class="nowrap">${m.dcTime ? esc(U.fmtDT(m.dcTime)) : ''}</td><td>${esc(m.status)}</td></tr></tbody></table>
        ${pr ? `<div class="mg-protline"><span>${m.type === 'continuous' ? 'Titration Protocol' : 'Protocol'}</span><strong>${esc(pr.title)}</strong></div>` : ''}`,
      history: `<h4>Prior documentation</h4>${prior.length ? `<ul class="plain">${prior.join('')}</ul>` : UI.empty('None.')}
        <h4>Documented this shift</h4>${hist.length ? `<ul class="plain">${hist.map(e => `<li class="${e.status === 'error' ? 'struck' : ''}">
          <strong>${esc(e.data.action)}</strong>${e.data.dose ? ' — ' + esc(e.data.dose) : ''}${e.data.rate ? ' — ' + esc(e.data.rate) : ''}${e.data.reason ? ' — ' + esc(e.data.reason) : ''}${e.data.response ? ' — ' + esc(e.data.response) : ''}${e.data.comment ? ' — ' + esc(e.data.comment) : ''}
          ${e.data.override ? ' ' + UI.badge('Override', 'danger') : ''} ${UI.entryMeta(e)}
          ${e.status === 'active' ? `<button class="btn btn-sm btn-link" data-err="${e.id}">Mark in error</button>` : ''}</li>`).join('')}</ul>` : UI.empty('Nothing documented yet.')}`,
      prot: pr ? Views.protocol.html(pr) : UI.empty('No protocol for this medication.'),
      order: o ? `<dl class="kv"><dt>Order</dt><dd>${esc(o.text)}</dd><dt>Ordering provider</dt><dd>${esc(o.by)}</dd><dt>Ordered</dt><dd>${esc(U.fmtDT(o.time))}</dd>
          ${m.indication ? `<dt>Indication</dt><dd>${esc(m.indication)}</dd>` : ''}${m.highAlert ? '<dt>Alert</dt><dd>High-alert medication — independent double check</dd>' : ''}
          ${(m.preAssess || []).length ? `<dt>Assess before giving</dt><dd>${esc(m.preAssess.join(', '))}</dd>` : ''}</dl>` : ''
    };
    const names = [['detail', 'Detail'], ['history', 'History'], ['prot', 'Prot/Taper'], ['order', 'Order']];
    UI.modal({
      title: 'Medication Detail', wide: true,
      body: `<div class="md-tabs">${names.map(([k, l]) => `<button type="button" class="md-tab" data-mdtab="${k}" ${k === 'prot' && !pr ? 'disabled' : ''}>${l}</button>`).join('')}</div>
        ${names.map(([k]) => `<div class="md-pane" data-mdpane="${k}" hidden>${tabs[k]}</div>`).join('')}`,
      onOpen(api) {
        const show = k => {
          api.el.querySelectorAll('[data-mdpane]').forEach(x => { x.hidden = x.dataset.mdpane !== k; });
          api.el.querySelectorAll('[data-mdtab]').forEach(x => x.classList.toggle('md-tab-on', x.dataset.mdtab === k));
        };
        api.el.querySelectorAll('[data-mdtab]').forEach(b => b.addEventListener('click', () => show(b.dataset.mdtab)));
        show(startTab || 'detail');
        api.el.querySelectorAll('[data-err]').forEach(b => b.addEventListener('click', () => { api.close(); UI.errorEntry(p, 'mar', b.dataset.err); }));
      },
      buttons: [{ label: 'Close' }]
    });
  }

  Views.mar = {
    label: 'MAR',
    render(p, doc) {
      const today = dayStart(p.clock.now());
      if (p.clock.staged) {
        const key = Store.epoch(p.id) + '|' + Store.scenarioStart(p.id) + '|' + p.clock.stage.id;
        if (shiftKeys[p.id] && shiftKeys[p.id] !== key) { delete verified[p.id]; delete queue[p.id]; shiftViews[p.id] = 'current'; }
        shiftKeys[p.id] = key;
      }
      let cols = [today - DAY, today].concat(days === 3 ? [today + DAY] : []);
      const view = shiftView(p), writable = !p.clock.staged || view === 'current';
      if (p.clock.staged) {
        const first = writable ? dayStart(p.clock.stageStart) : p.clock.dayOne;
        const last = writable ? dayStart(p.clock.stageEnd - 1) : dayStart(p.clock.stageTimes[p.clock.stageTimes.length-1].to - 1);
        cols = []; for (let date = new Date(first); date.getTime() <= last; date.setDate(date.getDate()+1)) cols.push(date.getTime());
      }
      const meds = p.meds.filter(m => p.clock.staged ? shiftShown(p, doc, m, view) : shown(m));
      const order = { continuous: 2, scheduled: 0, prn: 1 };
      meds.sort((a, b) => (a.status === 'Discontinued') - (b.status === 'Discontinued') || order[typeOf(a)] - order[typeOf(b)] || a.orderTime - b.orderTime);
      const chk = (k, label) => `<label class="mg-inc"><input type="checkbox" data-inc="${k}" ${include[k] ? 'checked' : ''}> ${label}</label>`;
      const fmtDay = c => new Date(c).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const v = verified[p.id];
      const vLine = v ? `<div class="pt-verified">✔ Patient verified — wristband scanned ${esc(U.fmtTime(v))}</div>` : '<div class="pt-unverified">Wristband not scanned</div>';
      return `${Views.worklist.band(p, vLine)}
        ${p.clock.staged ? `<div class="scenario-shift-bar"><strong>${esc(p.clock.stage.label)}</strong><span>${esc(U.fmtDT(p.clock.stageStart))}–${esc(U.fmtDT(p.clock.stageEnd))}</span><span>Simulation time: ${esc(U.fmtDT(p.clock.now()))}</span></div><nav class="scenario-mar-views" aria-label="Medication views">${[['current','Current shift'],['completed','Documented / completed'],['inactive','Held / discontinued'],['history','All dates / history']].map(([key,label]) => `<button type="button" class="btn btn-sm ${key === view ? 'btn-primary' : ''}" data-shift-mar="${key}" aria-pressed="${key === view}">${label} (${p.meds.filter(m => shiftShown(p, doc, m, key)).length})</button>`).join('')}</nav>` : ''}
        ${writable ? `<div class="mg-scanbar"><label>Scan <input id="mar-scan" autocomplete="off" placeholder="${v ? 'Scan medication barcode' : 'Scan patient wristband'}"></label>
          <button type="button" class="btn btn-sm cam-btn" data-cam="mar" title="Use the tablet camera as a scanner">📷 Camera</button>
          <span class="muted small">${v ? 'Scan every medication you are giving, then Save to review and document them.' : 'Scan the wristband first, then each medication.'}</span></div>
        ${queuePanel(p)}` : '<p class="muted small">History and medication status are shown here. Select Current shift to document an administration.</p>'}
        ${p.clock.staged ? '' : `<div class="mg-include">Include: ${chk('active', 'Active')}${chk('stat', 'STAT/ONE')}${chk('iv', 'IVs')}${chk('prn', 'PRNs')}${chk('dc', 'Discontinued')}</div>`}
        <p class="muted small">${writable ? `Click a time cell to administer (red = overdue, yellow = due within ${C.medWindowMinutes} minutes, green = given). PRN: click <strong>PRN ⊕</strong>. Infusions: click today's cell to document. ` : ''}Click a medication for Medication Detail (history, protocol, corrections).</p>
        <div class="scroll-x"><table class="grid mar-grid">
          <thead><tr><th class="mg-start">Start<br>Stop<br>Status</th><th>Medication<br>(Route)</th><th>Time</th>${cols.map(c => `<th class="${c === today ? 'mg-today' : ''}">${p.clock.staged ? `Day ${Math.round((c-p.clock.dayOne)/DAY)+1}<br>` : c === today ? 'TODAY<br>' : ''}${fmtDay(c)}</th>`).join('')}</tr></thead>
          <tbody>${meds.length ? meds.map(m => medRows(p, doc, m, cols, today)).join('<tr class="mg-sep"><td colspan="' + (3 + cols.length) + '"></td></tr>') : `<tr><td colspan="${3 + cols.length}">${UI.empty(p.clock.staged ? (view === 'current' ? 'No medication tasks remain for this shift. Ongoing daily orders return with their next scheduled dose.' : 'No medications in this view.') : 'No medications match the Include filters.')}</td></tr>`}</tbody>
        </table></div>
        <div class="wl-bar mg-foot"><div class="wl-bar-right"><a class="wl-btn" href="#/patient/${esc(p.id)}/${App.lastChartTab && App.lastChartTab[p.id] || 'summary'}">Close</a></div></div>`;
    },
    bind(root, p, doc) {
      root.querySelectorAll('[data-shift-mar]').forEach(b => b.addEventListener('click', () => { shiftViews[p.id] = b.dataset.shiftMar; App.render(); }));
      Object.keys(verified).forEach(k => { if (k !== p.id) delete verified[k]; });
      const scanIn = root.querySelector('#mar-scan');
      if (scanIn) {
        if (!document.querySelector('.modal-backdrop')) setTimeout(() => scanIn.focus(), 0);
        scanIn.addEventListener('keydown', e => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const code = scanIn.value; scanIn.value = '';
          if (Screens.mode() === 'observer') { UI.toast('Observer mode is view only. You cannot document.', 'warn'); return; }
          scanOnMar(p, Store.doc(p.id), code);
        });
      }
      const cam = root.querySelector('[data-cam="mar"]');
      if (cam) cam.addEventListener('click', () => {
        if (Screens.mode() === 'observer') { UI.toast('Observer mode is view only. You cannot document.', 'warn'); return; }
        CameraScan.open(code => scanOnMar(p, Store.doc(p.id), code), { title: verified[p.id] ? 'Scan Medication' : 'Scan Patient Wristband' });
      });
      root.querySelectorAll('[data-unqueue]').forEach(b => b.addEventListener('click', () => { queued(p.id).splice(Number(b.dataset.unqueue), 1); App.render(); }));
      const qc = root.querySelector('[data-qclear]');
      if (qc) qc.addEventListener('click', () => { delete queue[p.id]; UI.toast('Scanned medications cleared. Nothing was charted.'); App.render(); });
      const qs = root.querySelector('[data-qsave]');
      if (qs) qs.addEventListener('click', () => review(p, Store.doc(p.id)));
      root.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('change', () => { include[b.dataset.inc] = b.checked; App.render(); }));
      root.querySelectorAll('[data-select]').forEach(c => {
        const open = () => medDetail(p, doc, p.meds.find(m => m.id === c.dataset.select));
        c.addEventListener('click', e => { if (!e.target.closest('button')) open(); });
        c.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === c) open(); });
      });
      root.querySelectorAll('[data-dose]').forEach(b => b.addEventListener('click', () => {
        const key = b.dataset.dose;
        const med = p.meds.find(m => m.doseTimes.some(d => d.key === key));
        const dt = med.doseTimes.find(d => d.key === key);
        const s = Model.doseStatus(p, doc, med, dt);
        if (s.code === 'given' && s.prior) { UI.toast(`Documented by ${dt.priorBy} at ${U.fmtTime(dt.time)} (prior shift).`, 'info'); return; }
        if (s.code === 'notyet') { UI.toast(`${med.name} starts ${U.fmtDT(med.startsOn)} — not available yet.`, 'warn'); return; }
        if (s.code === 'given' || s.code === 'notgiven') { UI.toast('Already documented. Click the medication for Medication Detail → History to correct an entry.', 'info'); return; }
        administer(p, doc, med, dt, 'dose', { ptVerified: !!verified[p.id] });
      }));
      root.querySelectorAll('[data-prn]').forEach(b => b.addEventListener('click', () => administer(p, doc, p.meds.find(m => m.id === b.dataset.prn), null, 'prn', { ptVerified: !!verified[p.id] })));
      root.querySelectorAll('[data-infusion]').forEach(b => b.addEventListener('click', () => administer(p, doc, p.meds.find(m => m.id === b.dataset.infusion), null, 'infusion', { ptVerified: !!verified[p.id] })));
      root.querySelectorAll('[data-titrate]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const m = p.meds.find(x => x.id === b.dataset.titrate);
        if (m.protocol === 'heparin') Views.heparin.titrate(p); else Views.protocol.titrateDrip(p, m);
      }));
      root.querySelectorAll('[data-effect]').forEach(b => b.addEventListener('click', () => effectiveness(p, p.meds.find(m => m.id === b.dataset.med), b.dataset.effect)));
      Views.protocol.bind(root, p);
    }
  };
  Views.mar.detail = medDetail;
  // Feed a barcode to the MAR scan box (used by the orientation page's practice labels).
  Views.mar.scan = (p, code) => scanOnMar(p, Store.doc(p.id), code);

  /* ---------------- Medications folder tab (Current Visit list) ---------------- */

  const MED_VIEWS = [['inf', 'Current Inf/Titr'], ['current', 'Current Visit'], ['home', 'Home Medications'], ['mar', 'Mar'], ['history', 'Medication History']];
  let medView = 'current';

  function medTable(p, groups) {
    return `<table class="grid meds-list"><colgroup><col><col class="oc-by"><col class="oc-time"><col class="oc-status"><col class="oc-i"></colgroup>
      <thead><tr><th>Generic Name [Trade Name]</th><th>Provider</th><th>Start/Stop</th><th>Status</th><th></th></tr></thead>
      <tbody>${groups.filter(g => g[1].length).map(([name, list]) => `<tr class="ord-band"><th colspan="5">${esc(name)}</th></tr>
        ${list.map(m => `<tr class="${m.status === 'Discontinued' ? 'dc' : ''}"><td><span class="ord-text">${esc(m.name)}</span> <span class="ml-sig">${esc([m.dose, m.route, m.freq].filter(x => x && x !== '—').join(' '))}</span>${m.protocol ? ' ' + Views.protocol.link(p, m.protocol) : ''}${m.isNew ? ' ' + UI.badge('NEW', 'new') : ''}</td>
          <td>${esc(m.orderedBy || p.attending)}</td><td class="nowrap">${esc(U.fmtDT(m.orderTime))}${m.dcTime ? '<br>' + esc(U.fmtDT(m.dcTime)) : ''}</td><td>${esc(m.status)}</td>
          <td><button type="button" class="i-link" data-medinfo="${esc(m.id)}" title="Medication detail" aria-label="Medication detail">i</button></td></tr>`).join('')}`).join('')}</tbody></table>`;
  }

  Views.meds = {
    label: 'Medications',
    render(p, doc) {
      const active = p.meds.filter(m => m.status !== 'Discontinued');
      let body = '';
      if (medView === 'current') {
        body = medTable(p, [['Medications', active.filter(m => m.type === 'scheduled' || m.type === 'once')], ['PRN Medications', active.filter(m => m.type === 'prn')],
          ['IV / Continuous Infusions', active.filter(m => m.type === 'continuous')], ['Discontinued', p.meds.filter(m => m.status === 'Discontinued')]]);
      } else if (medView === 'inf') {
        const inf = p.meds.filter(m => m.type === 'continuous');
        body = inf.length ? `<table class="grid"><thead><tr><th>Infusion</th><th>Ordered rate / dose</th><th>Current status</th><th>Status</th></tr></thead><tbody>
          ${inf.map(m => `<tr class="${m.status === 'Discontinued' ? 'dc' : ''}"><td><strong>${esc(m.name)}</strong>${m.protocol ? ' ' + Views.protocol.link(p, m.protocol) : ''}${m.highAlert ? ' ' + UI.badge('HIGH ALERT', 'danger') : ''}</td>
            <td>${esc(m.rate || m.dose)}</td><td>${esc(infusionState(doc, m))}</td><td>${esc(m.status)}</td></tr>`).join('')}</tbody></table>
          <p class="muted small">Infusions are documented and titrated on the <a href="#/patient/${esc(p.id)}/mar">MAR</a>.</p>` : UI.empty('No infusions ordered.');
      } else if (medView === 'home') {
        body = (p.homeMeds || []).length ? `<table class="grid"><thead><tr><th>Medication</th><th>Dose</th><th>Route</th><th>Frequency</th></tr></thead><tbody>
          ${p.homeMeds.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.dose)}</td><td>${esc(m.route)}</td><td>${esc(m.freq)}</td></tr>`).join('')}</tbody></table>` : UI.empty('No home medications recorded.');
      } else {
        const rows = [];
        p.meds.forEach(m => {
          (m.doseTimes || []).forEach(d => { if (d.priorBy) rows.push([d.time, m.name, 'Given', m.dose, d.priorBy]); else if (d.priorNotGiven) rows.push([d.time, m.name, 'Not given — ' + d.priorNotGiven, m.dose, d.priorNGBy || '']); });
          if (m.lastGivenPrior) rows.push([m.lastGivenPrior.time, m.name, 'Given', m.dose, m.lastGivenPrior.by]);
          if (m.startedPrior) rows.push([m.startedPrior.time, m.name, 'Infusion started', m.rate || m.dose, m.startedPrior.by]);
        });
        doc.mar.forEach(e => rows.push([e.time, e.data.medName, e.data.action + (e.status === 'error' ? ' (entered in error)' : ''), e.data.dose || e.data.rate || '', Model.signature(e)]));
        rows.sort((a, b) => b[0] - a[0]);
        body = rows.length ? `<table class="grid"><thead><tr><th>Date/time</th><th>Medication</th><th>Action</th><th>Dose / rate</th><th>By</th></tr></thead><tbody>
          ${rows.map(r => `<tr><td class="nowrap">${esc(U.fmtDT(r[0]))}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td></tr>`).join('')}</tbody></table>` : UI.empty('No administrations on record.');
      }
      const label = (MED_VIEWS.find(v => v[0] === medView) || [])[1];
      return `<div class="ml-bar"><span class="muted">${esc(label)}${medView === 'current' ? ' by Category' : ''}</span>
          <div class="ml-menu-wrap"><button class="btn btn-sm ml-menu-btn" aria-haspopup="true" aria-expanded="false">${esc(label)} ▾</button>
            <div class="tb-menu ml-menu" hidden role="menu"><div class="ml-menu-h">Administrations</div>
              ${MED_VIEWS.map(([k, l]) => `<a role="menuitem" href="${k === 'mar' ? `#/patient/${esc(p.id)}/mar` : '#'}" data-medview="${k}" class="${k === medView ? 'ml-on' : ''}">${esc(l)}</a>`).join('')}</div></div></div>
        ${body}`;
    },
    bind(root, p, doc) {
      const btn = root.querySelector('.ml-menu-btn'), menu = root.querySelector('.ml-menu');
      const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
      btn.addEventListener('click', e => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); if (!menu.hidden) setTimeout(() => document.addEventListener('click', close, { once: true }), 0); });
      root.querySelectorAll('[data-medview]').forEach(a => a.addEventListener('click', e => {
        if (a.dataset.medview === 'mar') return;
        e.preventDefault(); medView = a.dataset.medview; App.render();
      }));
      root.querySelectorAll('[data-medinfo]').forEach(b => b.addEventListener('click', () => {
        const o = Model.medOrders(p).find(x => x.id === b.dataset.medinfo);
        if (o) Views.orders.detail(p, doc, o);
      }));
      Views.protocol.bind(root, p);
    }
  };

  /* ---------------- Administration dialog ---------------- */

  function evalHold(med, values) {
    return (med.holdIf || []).filter(h => {
      const key = (PRE[h.p] || [h.p.toLowerCase()])[0];
      const v = U.num(values['pre_' + key]);
      if (v == null) return false;
      return h.op === '<' ? v < h.v : h.op === '>' ? v > h.v : h.op === '<=' ? v <= h.v : h.op === '>=' ? v >= h.v : false;
    });
  }

  // Warnings, allergy box, pre-administration assessment, and documentation fields for one medication.
  function itemParts(p, doc, med, dt, mode) {
    const conflicts = Model.allergyConflicts(p, med);
    const now = p.clock.now();
    const warnings = [];
    if (med.status !== 'Active') warnings.push(`This order is <strong>${esc(med.status)}</strong>${med.holdReason ? ': ' + esc(med.holdReason) : ''}. Do not administer without a current, active order.`);
    if (mode === 'dose' && dt) {
      const diff = Math.round((now - dt.time) / 60000);
      if (Math.abs(diff) > C.medWindowMinutes) warnings.push(`Dose is <strong>${Math.abs(diff)} minutes ${diff < 0 ? 'early' : 'late'}</strong> (scheduled ${U.fmtTime(dt.time)}). Document the reason.`);
      if (dt.notToday) warnings.push('This medication is not due today.');
    }
    if (mode === 'prn' && med.minIntervalHr) {
      const last = Model.lastGiven(doc, med);
      if (last && now - last.time < med.minIntervalHr * 3600000) {
        warnings.push(`<strong>Too soon:</strong> last given ${U.fmtDT(last.time)} (${esc(last.by)}). Minimum interval is ${med.minIntervalHr} hours.`);
      }
    }

    const pre = (med.preAssess || []).map(k => {
      if (k.startsWith('lab:')) {
        const name = k.slice(4);
        const l = Model.latestLab(p, name);
        return `<div class="pre-lab"><span>${esc(name)} (latest)</span><strong>${l ? esc(l.value + ' ' + (l.unit || '')) + ' ' + UI.flag(l.flag) + ` <small>${U.fmtDT(l.time)}</small>` : 'No result on file'}</strong></div>`;
      }
      const [key, label] = PRE[k] || [k.toLowerCase(), k];
      const last = Model.latestVital(p, doc, key);
      return `<label class="field"><span>${esc(label)}</span><input type="number" step="any" name="pre_${key}" required>
        <small class="muted">${last ? 'Last charted: ' + esc(last.value) + ' at ' + U.fmtTime(last.time) : 'No prior value'}</small></label>`;
    }).join('');

    const allergyBox = conflicts.length ? `<div class="hard-stop">
        <strong>⚠ ALLERGY ALERT</strong> — Patient is allergic to ${conflicts.map(a => `<strong>${esc(a.agent)}</strong> (${esc(a.reaction)})`).join(', ')}.
        This medication is in a related drug class.
        <label class="check"><input type="checkbox" name="allergyOverride" data-single="1"> Override — I verified with the provider/pharmacist that this medication may be given.</label>
        <label class="field"><span>Override reason</span><input name="allergyReason"></label>
      </div>` : '';

    let body = '';
    if (mode === 'infusion') {
      body = `<div class="form-grid">
          <label class="field"><span>Action</span><select name="action">${UI.options(INFUSION_ACTIONS, null, false)}</select></label>
          ${med.weightRate ? `<label class="field"><span>Rate (units/kg/hr)</span><input name="rate" type="number" step="any" placeholder="Enter units/kg/hr"></label>`
            : `<label class="field"><span>Rate / dose</span><input name="rate" value="${esc(med.rate || med.dose || '')}"></label>`}
          <label class="field"><span>Site</span><select name="site">${UI.options(SITES, '', false)}</select></label>
          ${UI.timeField(p, 'Date/time')}
        </div>
        ${med.weightRate ? '<div class="wcalc" data-wcalc>Enter the rate in units/kg/hr; the MAR calculates units/hr and mL/hr from the protocol weight.</div>' : ''}
        <label class="check"><input type="checkbox" name="doubleCheck" data-single="1"> Independent double check completed${med.highAlert ? ' (required for high-alert infusions)' : ''}</label>
        <label class="field"><span>Second RN / verifier</span><input name="verifier"></label>`;
    } else {
      body = `<div class="form-grid">
          ${mode === 'dose' ? `<label class="field"><span>Administration</span><select name="action"><option>Given</option><option>Not Given</option></select></label>` : '<input type="hidden" name="action" value="Given">'}
          ${med.weightDose ? `<label class="field"><span>Dose given (${esc(med.weightDose.unit)})</span><input name="dose" type="number" step="any" value="${esc((Scan.parseDose(med.dose) || {}).value || '')}"></label>`
            : `<label class="field"><span>Dose given</span><input name="dose" value="${esc(med.dose)}"></label>`}
          <label class="field"><span>Route</span><input name="route" value="${esc(med.route)}"></label>
          <label class="field"><span>Site</span><select name="site">${UI.options(SITES, '', false)}</select></label>
          ${UI.timeField(p, 'Date/time administered')}
          ${mode === 'prn' ? `<label class="field"><span>PRN reason</span><input name="prnReason" value="${esc(med.indication || '')}"></label>` : ''}
        </div>
        ${med.weightDose ? `<div class="wcalc" data-wcalc>= ${esc(Views.protocol.bolusCalc(p, med, (Scan.parseDose(med.dose) || {}).value))}</div>` : ''}
        <label class="field not-given" hidden><span>Reason not given</span><select name="reason">${UI.options(NOT_GIVEN)}</select></label>
        ${med.highAlert ? `<label class="check"><input type="checkbox" name="doubleCheck" data-single="1"> Independent double check completed (high-alert medication)</label>
          <label class="field"><span>Second RN / verifier</span><input name="verifier"></label>` : ''}`;
    }
    const html = `${warnings.map(w => `<div class="warn-box">${w}</div>`).join('')}
          ${allergyBox}
          %SCAN%
          ${pre ? `<fieldset><legend>Pre-administration assessment</legend><div class="form-grid">${pre}</div><div class="hold-live"></div></fieldset>` : ''}
          <fieldset><legend>Documentation</legend>${body}
            <label class="field"><span>Comment</span><textarea name="comment" rows="2"></textarea></label>
          </fieldset>`;
    return { conflicts, html };
  }

  // Live behavior inside one medication's fields: Not Given reason, weight-based math, hold parameters.
  function wireItem(el, p, med, mode) {
    const q = sel => el.querySelector(sel);
    const act = q('select[name="action"]');
    if (act && mode === 'dose') act.addEventListener('change', () => { q('.not-given').hidden = act.value !== 'Not Given'; });
    const wc = q('[data-wcalc]');
    if (wc) el.addEventListener('input', () => {
      if (med.weightDose) { const n = Number(q('[name="dose"]').value); wc.textContent = n ? '= ' + Views.protocol.bolusCalc(p, med, n) : 'Enter the dose you calculated from the protocol weight.'; }
      if (med.weightRate) { const c = Views.protocol.rateCalc(p, med, Number(q('[name="rate"]').value)); wc.textContent = c ? '= ' + c.text : 'Enter the rate in units/kg/hr.'; }
    });
    const live = q('.hold-live');
    if (live) el.addEventListener('input', () => {
      const hits = evalHold(med, U.formValues(el));
      live.innerHTML = hits.length ? `<div class="warn-box"><strong>Hold parameter met:</strong> ${hits.map(h => `${esc(h.p)} ${esc(h.op)} ${esc(h.v)}`).join(', ')}. Consider holding the dose and notifying the provider.</div>` : '';
    });
  }

  // Check one medication's documentation. Returns { error } or { data, time } ready to chart.
  // sc = { ptOK, scanPt, scans, scannedTotal, noScan, noScanReason }
  function buildEntry(el, p, med, dt, mode, conflicts, sc) {
    const v = U.formValues(el);
    const scans = sc.scans || [];
    const medOK = scans.length > 0;
    const given = mode === 'infusion' || v.action === 'Given';
    const fail = error => ({ error });
    if (p.clock.staged && Model.get(p.id).clock.stage.id !== p.clock.stage.id) return fail('Faculty advanced the simulation shift. Close this window and review the current eMAR before documenting.');

    if (sc.scanPt && !sc.ptOK) return fail('The wristband scanned does not match this patient. Stop and verify patient identity.');
    if (C.requireBarcodeScan && given && !(sc.ptOK && medOK) && !sc.noScan) return fail('Scan the patient wristband and the medication, or check "Unable to scan" and give a reason.');
    if (sc.noScan && !sc.noScanReason) return fail('Select a reason you were unable to scan.');
    if (given && conflicts.length && !v.allergyOverride) return fail('Allergy alert: review the alert. Either choose "Not Given" or document an override.');
    if (given && conflicts.length && !v.allergyReason) return fail('Enter the allergy override reason.');
    if (mode === 'dose' && v.action === 'Not Given' && !v.reason) return fail('Select the reason the dose was not given.');
    if (given && med.highAlert && !v.doubleCheck) return fail('High-alert medication: document the independent double check.');
    // Weight-based protocol doses must be entered and are checked against the protocol limits.
    let weightNote = '';
    if (given && mode !== 'infusion' && med.weightDose) {
      const n = Number(v.dose);
      if (!n) return fail(`Enter the dose given in ${med.weightDose.unit}.`);
      const ord = Scan.parseDose(med.dose);
      if (ord && n > ord.value) return fail(`${n.toLocaleString('en-US')} ${med.weightDose.unit} exceeds the ordered bolus of ${Scan.fmt(ord)}.`);
      if (ord && n < ord.value && !v.comment) return fail(`${n.toLocaleString('en-US')} ${med.weightDose.unit} is less than the ordered bolus of ${Scan.fmt(ord)}. Explain in the Comment.`);
      if (med.weightDose.max && n > med.weightDose.max) return fail(`${n.toLocaleString('en-US')} ${med.weightDose.unit} exceeds the protocol maximum of ${med.weightDose.max.toLocaleString('en-US')} ${med.weightDose.unit}.`);
      weightNote = Views.protocol.bolusCalc(p, med, n);
      v.dose = `${n.toLocaleString('en-US')} ${med.weightDose.unit}`;
    }
    if (mode === 'infusion' && med.weightRate && /Started|Rate change|Resumed|Rate verified/.test(v.action || '')) {
      const c = Views.protocol.rateCalc(p, med, Number(v.rate));
      if (!c) return fail('Enter the rate in units/kg/hr. The MAR calculates units/hr and mL/hr from the protocol weight.');
      if (/Started/.test(v.action) && med.weightRate.startMax && c.perHr > med.weightRate.startMax) return fail(`Starting rate ${Views.protocol.n1(c.perHr)} units/hr exceeds the protocol maximum of ${med.weightRate.startMax.toLocaleString('en-US')} units/hr.`);
      v.rate = c.text;
    }
    // Dose checks against the order and against what was scanned.
    const ordered = mode === 'infusion' ? null : Scan.parseDose(med.dose);
    const doseGiven = Scan.parseDose(v.dose);
    if (given && ordered && doseGiven && doseGiven.unit === ordered.unit) {
      if (doseGiven.value > ordered.value) return fail(`The dose given (${Scan.fmt(doseGiven)}) exceeds the ordered dose (${Scan.fmt(ordered)}). Edit the dose given; return extra medication to the pharmacy or waste it with a witness.`);
      const scanned = sc.scannedTotal;
      if (scanned && scanned.unit === doseGiven.unit && doseGiven.value > scanned.value + 1e-6) return fail(`The dose given (${Scan.fmt(doseGiven)}) is more than you scanned (${Scan.fmt(scanned)}). Scan the remaining medication.`);
      if (doseGiven.value < ordered.value && !v.comment) return fail(`The dose given (${Scan.fmt(doseGiven)}) is less than the ordered ${Scan.fmt(ordered)}. Scan the remaining dose, or explain the partial dose in the Comment.`);
    }
    const missingPre = (med.preAssess || []).filter(k => !k.startsWith('lab:')).some(k => U.isEmpty(v['pre_' + (PRE[k] || [k.toLowerCase()])[0]]));
    if (given && missingPre) return fail('Complete the pre-administration assessment before giving this medication.');

    const preAssess = {};
    Object.keys(v).filter(k => k.startsWith('pre_')).forEach(k => { preAssess[k.slice(4)] = v[k]; });
    const holds = evalHold(med, v).map(h => `${h.p} ${h.op} ${h.v}`);
    return {
      time: UI.readTime(p, el),
      given,
      data: {
        medId: med.id, medName: med.name, doseKey: dt ? dt.key : null, prn: mode === 'prn', infusion: mode === 'infusion',
        action: v.action,
        dose: v.dose, route: v.route, site: v.site, rate: v.rate, prnReason: v.prnReason, reason: v.action === 'Not Given' ? v.reason : '',
        scan: { patient: sc.ptOK ? 'verified' : 'not scanned', med: medOK ? 'verified' : 'not scanned', units: scans.map(x => x.code), unableReason: sc.noScan ? sc.noScanReason : '' },
        override: (sc.noScan || (conflicts.length && v.allergyOverride)) ? true : false,
        allergyOverride: conflicts.length && v.allergyOverride ? v.allergyReason : '',
        doubleCheck: v.doubleCheck ? (v.verifier || 'Yes') : '',
        preAssess, holdParamsMet: holds, comment: [weightNote, v.comment].filter(Boolean).join(' — ')
      }
    };
  }

  // Review screen after Save: every scanned medication, confirmed and documented together.
  function review(p, doc) {
    const list = queued(p.id).slice();
    if (!list.length) return;
    const items = list.map(x => Object.assign({}, x, itemParts(p, doc, x.med, x.dt, x.mode), { tally: tallyOf(x.med, x.mode, x.scans) }));
    UI.modal({
      title: 'Document Administration',
      wide: true,
      body: `<div class="mar-review">
          <div class="pt-verified">✔ Patient verified: ${esc(p.name.last)}, ${esc(p.name.first)} · MRN ${esc(p.mrn)}</div>
          <p class="muted small">Confirm each medication you are giving, then select <strong>Document</strong>. Nothing is charted until you do.</p>
          <div class="review-msg"></div>
          ${items.map((x, i) => `<section class="adm-item" data-item="${i}">
            <h3 class="adm-h">${i + 1}. ${esc(Model.medLabel(x.med))}</h3>
            <div class="mar-order">${x.dt ? `Scheduled: ${U.fmtDT(x.dt.time)}` : x.mode === 'prn' ? 'PRN' : 'Infusion'}${x.med.instructions ? `<div class="med-instr">${esc(x.med.instructions)}</div>` : ''}</div>
            ${x.html.replace('%SCAN%', () => `<div class="scan-tally">${x.tally.html}</div>`)}
          </section>`).join('')}
        </div>`,
      onOpen(api) {
        items.forEach((x, i) => {
          const el = api.el.querySelector(`[data-item="${i}"]`);
          wireItem(el, p, x.med, x.mode);
          // Fill the dose given from the scanned total.
          const df = el.querySelector('[name="dose"]');
          if (df && x.tally.total) df.value = df.type === 'number' ? x.tally.total.value : Scan.fmt(x.tally.total);
          if (df) df.classList.toggle('field-alert', x.tally.code === 'high');
        });
      },
      buttons: [
        { label: 'Back to MAR' },
        { label: 'Document', cls: 'btn-primary', onClick: api => {
          api.el.querySelectorAll('.mar-review .form-error').forEach(e => e.remove());
          const results = items.map((x, i) => {
            const el = api.el.querySelector(`[data-item="${i}"]`);
            return { el, r: buildEntry(el, p, x.med, x.dt, x.mode, x.conflicts, { ptOK: true, scans: x.scans, scannedTotal: x.tally.total }) };
          });
          const bad = results.filter(x => x.r.error);
          if (bad.length) {
            bad.forEach(x => UI.formError(x.el, x.r.error));
            UI.formError(api.el.querySelector('.review-msg'), `${bad.length} of ${items.length} medication${items.length > 1 ? 's need' : ' needs'} attention. Nothing was charted.`);
            bad[0].el.scrollIntoView({ block: 'start' });
            return false;
          }
          results.forEach(x => Store.add(p.id, 'mar', x.r.data, x.r.time, p.clock.now()));
          delete queue[p.id];
          UI.toast(`${results.length} medication${results.length > 1 ? 's' : ''} documented.`);
          App.render();
          return true;
        } }
      ]
    });
  }

  // Single-medication window (clicking a time cell, PRN ⊕, or an infusion cell without scanning first).
  function administer(p, doc, med, dt, mode, opts) {
    opts = opts || {};
    const parts = itemParts(p, doc, med, dt, mode);
    const conflicts = parts.conflicts;
    const scan = `<fieldset class="scan">
        <legend>Barcode verification</legend>
        <div class="form-grid">
          <label class="field"><span>1. Scan patient wristband</span><span class="cam-row"><input name="scanPt" autocomplete="off" ${opts.ptVerified ? `value="${esc(p.mrn)}"` : 'autofocus'} placeholder="Scan or type MRN"><button type="button" class="btn btn-sm cam-btn" data-cam="pt" aria-label="Scan wristband with camera">📷</button></span><small class="scan-msg" data-msg="pt"></small></label>
          <label class="field"><span>2. Scan medication barcode${mode === 'infusion' ? '' : ' (scan each unit)'}</span><span class="cam-row"><input name="scanMed" autocomplete="off" ${opts.ptVerified ? 'autofocus' : ''} placeholder="Scan medication label, then Enter"><button type="button" class="btn btn-sm cam-btn" data-cam="med" aria-label="Scan medication with camera">📷</button></span><small class="scan-msg" data-msg="med"></small></label>
        </div>
        <div class="scan-tally" aria-live="polite"></div>
        <label class="check"><input type="checkbox" name="noScan" data-single="1"> Unable to scan</label>
        <label class="field scan-reason" hidden><span>Reason unable to scan</span><select name="noScanReason">${UI.options(['Wristband unreadable', 'Medication barcode damaged/missing', 'Scanner unavailable', 'Emergency situation', 'Other'])}</select></label>
      </fieldset>`;

    UI.modal({
      title: (mode === 'infusion' ? 'Document Infusion — ' : 'Administer — ') + med.name,
      wide: true,
      body: `<div class="mar-dialog">
          <div class="mar-order"><strong>${esc(Model.medLabel(med))}</strong>
            ${dt ? `<div>Scheduled: ${U.fmtDT(dt.time)}</div>` : ''}
            ${med.instructions ? `<div class="med-instr">${esc(med.instructions)}</div>` : ''}</div>
          ${parts.html.replace('%SCAN%', () => scan)}
        </div>`,
      onOpen(api) {
        const el = api.el;
        const q = s => el.querySelector(s);
        const setMsg = (which, ok, text) => { const m = q(`[data-msg="${which}"]`); m.textContent = text; m.className = 'scan-msg ' + (ok ? 'ok' : 'bad'); };
        const checkPt = () => {
          const v = Scan.clean(q('[name="scanPt"]').value);
          if (!v) { setMsg('pt', false, ''); return; }
          const hit = Scan.patientOf(v);
          if (hit && hit.id === p.id) { setMsg('pt', true, `✔ Patient verified: ${p.name.last}, ${p.name.first}`); return; }
          const other = hit && Screens.canSee(hit) ? hit : null;
          setMsg('pt', false, other ? `✖ WRONG PATIENT — this wristband belongs to ${other.name.last}, ${other.name.first}` : '✖ Wristband does not match this patient');
        };
        // Each medication scan is one unit; units add up toward the ordered dose.
        const scans = api.scans = [];
        const ordered = mode === 'infusion' ? null : Scan.parseDose(med.dose);
        const tally = q('.scan-tally');
        const doseField = q('[name="dose"]');
        const showTally = () => {
          const t = tallyOf(med, mode, scans);
          api.scannedTotal = t.total;
          tally.innerHTML = t.html;
          if (doseField && t.total) { doseField.value = doseField.type === 'number' ? t.total.value : Scan.fmt(t.total); doseField.classList.toggle('field-alert', !!(ordered && t.total.unit === ordered.unit && t.total.value > ordered.value)); }
        };
        const addScan = code => {
          if (!String(code || '').trim()) return;
          const parsed = Scan.parseCode(code);
          const unit = unitFor(med, parsed);
          if (!unit) {
            const other = parsed && parsed.kind === 'rx' ? p.meds.find(m => m.id === parsed.medId) : parsed && parsed.kind === 'product' ? { name: parsed.key.toLowerCase(), dose: Scan.fmt(parsed.dose) } : parsed && parsed.kind === 'pkg' ? { name: parsed.pkg.name, dose: `(package ${parsed.code})` } : null;
            setMsg('med', false, other ? `✖ WRONG MEDICATION — scanned ${other.name} ${other.dose}. Not added.` : '✖ Barcode does not match this order. Not added.');
            return;
          }
          scans.push(unit);
          setMsg('med', true, `✔ Medication verified: ${unit.label}`);
          showTally();
        };
        (opts.scans || []).forEach(addScan);
        const medIn = q('[name="scanMed"]');
        medIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addScan(medIn.value); medIn.value = ''; } });
        medIn.addEventListener('change', () => { if (medIn.value.trim()) { addScan(medIn.value); medIn.value = ''; } });
        ['input', 'change'].forEach(ev => q('[name="scanPt"]').addEventListener(ev, checkPt));
        q('[name="scanPt"]').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); medIn.focus(); } });
        if (opts.ptVerified) checkPt();
        q('[data-cam="pt"]').addEventListener('click', () => CameraScan.open(code => { q('[name="scanPt"]').value = code; checkPt(); medIn.focus(); }, { title: 'Scan Patient Wristband' }));
        q('[data-cam="med"]').addEventListener('click', () => CameraScan.open(code => addScan(code), { title: 'Scan Medication' }));
        q('[name="noScan"]').addEventListener('change', e => { q('.scan-reason').hidden = !e.target.checked; });
        wireItem(el, p, med, mode);
      },
      buttons: [
        { label: 'Cancel' },
        { label: 'Sign & Save', cls: 'btn-primary', onClick: api => {
          const el = api.el;
          const v = U.formValues(el);
          const r = buildEntry(el, p, med, dt, mode, conflicts, {
            scanPt: v.scanPt, ptOK: !!v.scanPt && !!Scan.patientOf(v.scanPt) && Scan.patientOf(v.scanPt).id === p.id,
            scans: api.scans || [], scannedTotal: api.scannedTotal, noScan: v.noScan, noScanReason: v.noScanReason
          });
          if (r.error) { UI.formError(el.querySelector('.modal-body'), r.error); return false; }
          Store.add(p.id, 'mar', r.data, r.time, p.clock.now());
          UI.toast(mode === 'infusion' ? 'Infusion documented.' : r.given ? `${med.name} documented as given.` : `${med.name} documented as not given.`);
          App.render();
          return true;
        } }
      ]
    });
  }

  function effectiveness(p, med, refId) {
    UI.modal({
      title: 'PRN Effectiveness — ' + med.name,
      body: `<div class="form-grid">
          ${UI.timeField(p, 'Date/time reassessed')}
          <label class="field"><span>Response</span><select name="response">${UI.options(['Effective', 'Partially effective', 'Not effective'], null, false)}</select></label>
          <label class="field"><span>Pain score after (if applicable)</span><input type="number" name="painAfter" min="0" max="10"></label>
        </div>
        <label class="field"><span>Comment</span><textarea name="comment" rows="2"></textarea></label>`,
      buttons: [{ label: 'Cancel' }, { label: 'Save', cls: 'btn-primary', onClick: api => {
        const v = U.formValues(api.el);
        Store.add(p.id, 'mar', { medId: med.id, medName: med.name, action: 'Effectiveness', refId, response: v.response, painAfter: v.painAfter, comment: v.comment }, UI.readTime(p, api.el), p.clock.now());
        UI.toast('Reassessment documented.');
        App.render();
      } }]
    });
  }
})();
