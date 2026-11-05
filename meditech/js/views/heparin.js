/* Heparin — protocol titration (from the MAR or Worklist) and the read-only heparin flowsheet. */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};

  const COLS = [
    ['drawTime', 'Time of aPTT draw', 'time'], ['aptt', 'aPTT result (sec)', 'number'], ['hold', 'Hold infusion (min)', 'number'],
    ['bolus', 'Heparin bolus (units)', 'number'], ['change', 'Rate change (units/kg/hr)', 'text'], ['newRate', 'New infusion rate (units/kg/hr)', 'number'],
    ['mlhr', 'New rate (mL/hr) — calculated', 'number'], ['nextAptt', 'Time of next aPTT', 'time'], ['rn2', 'RN 2 (verifier)', 'text']
  ];

  const protocolHtml = p => Views.protocol.html(Views.protocol.get(p, 'heparin'));
  const drip = p => p.meds.find(m => /heparin/i.test(m.name) && m.type === 'continuous' && m.status === 'Active');

  // Titrate the heparin infusion per the nomogram (from the MAR or the Worklist).
  function titrate(p, after) {
    const med = drip(p);
    if (!med) { UI.toast('No active heparin infusion order.', 'warn'); return; }
    const apt = Model.latestLab(p, 'aPTT');
    UI.modal({
      title: 'Titrate — ' + med.name, wide: true,
      body: `<form autocomplete="off">
        <div class="mar-order"><strong>${esc(Model.medLabel(med))}</strong>${med.instructions ? `<div class="med-instr">${esc(med.instructions)}</div>` : ''}
          <div>Latest aPTT on file: <strong>${apt ? esc(apt.value) + ' s' + ' ' + UI.flag(apt.flag) + ` <small>${U.fmtDT(apt.time)}</small>` : 'none'}</strong></div></div>
        <details class="prior" open><summary>Protocol order &amp; nomogram</summary>${protocolHtml(p)}</details>
        <div class="form-grid g4">
          ${UI.timeField(p, 'Date/time')}
          ${COLS.filter(c => c[0] !== 'rn2').map(([k, label, type]) => `<label class="field"><span>${esc(label)}</span><input name="${k}" type="${type === 'number' ? 'number' : type === 'time' ? 'time' : 'text'}" step="any"></label>`).join('')}
        </div>
        <div class="wcalc" data-wcalc>Enter the new rate in units/kg/hr; the MAR calculates units/hr and mL/hr from the ${p.weightKg ? esc(p.weightKg + ' kg') : 'protocol'} weight.</div>
        <label class="check"><input type="checkbox" name="doubleCheck" data-single="1"> Independent double check completed (high-alert infusion)</label>
        <label class="field"><span>RN 2 (verifier)</span><input name="rn2"></label>
        <p class="muted">Weight used for protocol: ${p.weightKg ? esc(p.weightKg + ' kg') : 'see order'}. Both RNs verify the bolus, initial rate, and every rate change.</p>
      </form>`,
      onOpen(api) {
        const f = api.el.querySelector('form');
        f.addEventListener('submit', e => e.preventDefault());
        const ml = f.querySelector('[name="mlhr"]'), wc = f.querySelector('[data-wcalc]');
        ml.readOnly = true; ml.placeholder = 'calculated';
        const bolusMed = p.meds.find(m => m.weightDose && /heparin/i.test(m.name));
        f.addEventListener('input', () => {
          const c = Views.protocol.rateCalc(p, med, Number(f.querySelector('[name="newRate"]').value));
          ml.value = c && c.mlHr != null ? Views.protocol.n1(c.mlHr).replace(/,/g, '') : '';
          const b = Number(f.querySelector('[name="bolus"]').value);
          wc.textContent = [c ? 'New rate = ' + c.text : '', b && bolusMed ? 'Bolus = ' + Views.protocol.bolusCalc(p, bolusMed, b) : ''].filter(Boolean).join(' · ') || 'Enter the new rate in units/kg/hr.';
        });
      },
      buttons: [{ label: 'Cancel' }, { label: 'Sign & Save', cls: 'btn-primary', onClick: api => {
        const f = api.el.querySelector('form');
        const v = U.formValues(f);
        delete v._time;
        if (v.newRate && !Number(v.newRate)) { UI.formError(f, 'Enter the new rate as a number in units/kg/hr.'); return false; }
        if (!v.aptt && !v.bolus && !v.newRate) { UI.formError(f, 'Enter the aPTT result, bolus, or new rate.'); return false; }
        if ((v.bolus || v.newRate || v.change || v.hold) && (!v.rn2 || !v.doubleCheck)) { UI.formError(f, 'A second RN must independently double check bolus, hold, and rate changes.'); return false; }
        const me = ((Store.session() || {}).name || '').trim().toLowerCase();
        if (v.rn2 && v.rn2.trim().toLowerCase() === me) { UI.formError(f, 'The verifier must be a different RN.'); return false; }
        const t = UI.readTime(p, f);
        const doubleCheck = v.doubleCheck ? v.rn2 : '';
        delete v.doubleCheck;
        Store.add(p.id, 'heparin', v, t, p.clock.now());
        const rc = v.newRate ? Views.protocol.rateCalc(p, med, Number(v.newRate)) : null;
        const rate = rc ? rc.text : '';
        Store.add(p.id, 'mar', { medId: med.id, medName: med.name, infusion: true, action: v.newRate || v.change ? 'Rate change' : v.hold ? 'Paused' : 'Rate verified',
          rate, comment: [v.aptt && 'aPTT ' + v.aptt + ' s', v.bolus && 'bolus ' + v.bolus + ' units', v.hold && 'hold ' + v.hold + ' min', v.nextAptt && 'next aPTT ' + v.nextAptt].filter(Boolean).join('; '),
          doubleCheck, scan: { patient: 'n/a', med: 'n/a' }, titration: true }, t, p.clock.now());
        UI.toast('Heparin titration documented on the MAR and heparin flowsheet.');
        App.render();
        if (after) setTimeout(after, 0);
      } }]
    });
  }

  Views.heparin = {
    label: 'Heparin Flowsheet',
    titrate,
    drip,
    render(p, doc) {
      const rows = [...doc.heparin].sort((a, b) => a.time - b.time);
      const table = `<div class="scroll-x"><table class="grid"><thead><tr><th>Date/time</th>${COLS.map(c => `<th>${esc(c[1])}</th>`).join('')}<th>RN 1</th><th></th></tr></thead><tbody>
        ${p.labs.flatMap(l => l.results.filter(r => r.t === 'aPTT').map(r => `<tr class="prior-row"><td>${esc(U.fmtDT(l.time))}</td><td></td><td>${esc(r.v)}</td><td colspan="${COLS.length - 1}" class="muted">Lab result — ${esc(l.panel)}</td><td></td></tr>`)).join('')}
        ${rows.map(e => `<tr class="${e.status === 'error' ? 'error-row' : ''}"><td class="nowrap">${esc(U.fmtDT(e.time))}</td>${COLS.map(c => `<td>${esc(e.data[c[0]] || '')}</td>`).join('')}<td>${esc(Model.signature(e))}</td>
          <td>${e.status === 'active' ? `<button class="btn btn-sm btn-link" data-err="${e.id}">Error</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>`;
      const released = !!drip(p);
      const how = `<div class="alerts"><div class="alert alert-info">Heparin is titrated on the <a href="#/patient/${esc(p.id)}/mar"><strong>MAR</strong></a> (heparin infusion → <strong>Titrate</strong>) or from the <a href="#/patient/${esc(p.id)}/worklist"><strong>Worklist</strong></a> (Heparin Protocol / aPTT → Document). This flowsheet shows the history.</div></div>`;
      const hp = Views.protocol.get(p, 'heparin');
      const protocol = hp ? UI.panel(hp.title, released ? protocolHtml(p) : UI.empty('No heparin protocol ordered yet.')) : '';
      return how + protocol + UI.panel('Heparin Flowsheet', table);
    },
    bind(root, p) {
      root.querySelectorAll('[data-err]').forEach(b => b.addEventListener('click', () => UI.errorEntry(p, 'heparin', b.dataset.err)));
    }
  };
})();
