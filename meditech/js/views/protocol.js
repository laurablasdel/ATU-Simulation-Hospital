/*
 * Protocols attached to orders (the "P" link on an order or MAR line), plus
 * titration of a vasoactive drip per its protocol. Heparin titration lives in
 * heparin.js; it uses the same protocol display.
 *
 * Patient data: p.protocols = { key: { title, items: [[label, text], ...],
 *   table: { head: [...], rows: [[...], ...] }, tableTitle, tables: [{ title, head, rows }], signedBy } }
 * and an order or med carries protocol: 'key'.
 */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};

  const get = (p, key) => (p.protocols || {})[key] || null;

  function html(pr) {
    if (!pr) return UI.empty('Protocol not on file.');
    return `<dl class="kv">${(pr.items || []).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}${pr.signedBy ? `<dt>Signed</dt><dd>${esc(pr.signedBy)}</dd>` : ''}</dl>
      ${pr.table ? `<h4>${esc(pr.tableTitle || '')}</h4><div class="scroll-x"><table class="grid"><thead><tr>${pr.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${pr.table.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
      ${(pr.tables || []).map(t => `<h4>${esc(t.title || '')}</h4><div class="scroll-x"><table class="grid"><thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${t.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('')}`;
  }

  // The "P" button shown at the end of an order or medication line.
  const link = (p, key) => get(p, key) ? `<button type="button" class="p-link" data-protocol="${esc(key)}" title="View protocol" aria-label="View protocol">P</button>` : '';

  function open(p, key) {
    const pr = get(p, key);
    UI.modal({ title: pr ? pr.title : 'Protocol', wide: true, body: html(pr), buttons: [{ label: 'Close' }] });
  }

  // Wire every P link inside root.
  function bind(root, p) {
    root.querySelectorAll('[data-protocol]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); open(p, b.dataset.protocol); }));
  }

  // Titrate a vasoactive infusion (e.g., norepinephrine) per its protocol.
  function titrateDrip(p, med, after) {
    const pr = get(p, med.protocol);
    const last = Model.latestVital(p, Store.doc(p.id), 'sbp');
    UI.modal({
      title: 'Titrate — ' + med.name, wide: true,
      body: `<form autocomplete="off">
        <div class="mar-order"><strong>${esc(Model.medLabel(med))}</strong>${med.instructions ? `<div class="med-instr">${esc(med.instructions)}</div>` : ''}
          <div class="muted">Last charted SBP: ${last ? esc(last.value) + ' at ' + U.fmtTime(last.time) : 'none'}</div></div>
        <details class="prior" open><summary>Titration protocol</summary>${html(pr)}</details>
        <div class="form-grid g4">
          ${UI.timeField(p, 'Date/time')}
          <label class="field"><span>MAP</span><input type="number" name="map" required></label>
          <label class="field"><span>SBP</span><input type="number" name="sbp" required></label>
          <label class="field"><span>DBP</span><input type="number" name="dbp"></label>
          <label class="field"><span>Heart rate</span><input type="number" name="hr" required></label>
          <label class="field"><span>Action</span><select name="action" required>${UI.options(['Started', 'Increased', 'Decreased', 'No change — at goal', 'Paused', 'Stopped'], '', false)}</select></label>
          <label class="field"><span>Previous dose (mcg/min)</span><input type="number" step="any" name="prevDose"></label>
          <label class="field"><span>New dose (mcg/min)</span><input type="number" step="any" name="newDose" required></label>
          <label class="field"><span>Rate (mL/hr)</span><input type="number" step="any" name="mlhr" required></label>
        </div>
        <label class="field"><span>Comment</span><textarea name="comment" rows="2"></textarea></label>
      </form>`,
      onOpen(api) { api.el.querySelector('form').addEventListener('submit', e => e.preventDefault()); },
      buttons: [{ label: 'Cancel' }, { label: 'Sign & Save', cls: 'btn-primary', onClick: api => {
        const f = api.el.querySelector('form');
        if (!f.reportValidity()) return false;
        const v = U.formValues(f);
        if (pr && pr.maxDose && Number(v.newDose) > pr.maxDose) { UI.formError(f, `New dose exceeds the ordered maximum of ${pr.maxDose} ${pr.doseUnit || ''}. Notify the provider.`); return false; }
        const t = UI.readTime(p, f);
        Store.add(p.id, 'mar', { medId: med.id, medName: med.name, infusion: true, titration: true,
          action: v.action === 'Started' ? 'Started / hung' : /^(Increased|Decreased)/.test(v.action) ? 'Rate change' : v.action === 'Paused' ? 'Paused' : v.action === 'Stopped' ? 'Stopped / discontinued' : 'Rate verified',
          rate: `${v.newDose} mcg/min = ${v.mlhr} mL/hr`, comment: [`MAP ${v.map}, BP ${v.sbp}${v.dbp ? '/' + v.dbp : ''}, HR ${v.hr}`, v.action, v.prevDose && `from ${v.prevDose} mcg/min`, v.comment].filter(Boolean).join('; '),
          scan: { patient: 'n/a', med: 'n/a' } }, t, p.clock.now());
        Store.add(p.id, 'vitals', { sbp: v.sbp, dbp: v.dbp || undefined, hr: v.hr, note: `Titration — ${med.name} ${v.newDose} mcg/min` }, t, p.clock.now());
        UI.toast('Titration documented on the MAR.');
        App.render();
        if (after) setTimeout(after, 0);
      } }]
    });
  }

  // Weight-based dose math using the protocol weight (p.weightKg).
  const n1 = x => Number(x.toFixed(1)).toLocaleString('en-US');
  function bolusCalc(p, med, units) {
    const w = p.weightKg, wd = med.weightDose || {};
    if (!units || !w) return '';
    return `${n1(units / w)} units/kg (weight ${w} kg)${wd.perMl ? ` · draw up ${n1(units / wd.perMl)} mL from the ${wd.source || wd.perMl + ' units/mL'}` : ''}`;
  }
  function rateCalc(p, med, perKgHr) {
    const w = p.weightKg, wr = med.weightRate || {};
    if (!perKgHr || !w) return null;
    const perHr = perKgHr * w;
    return { perHr, mlHr: wr.perMl ? perHr / wr.perMl : null,
      text: `${n1(perKgHr)} units/kg/hr × ${w} kg = ${n1(perHr)} units/hr${wr.perMl ? ` = ${n1(perHr / wr.perMl)} mL/hr (${wr.source || wr.perMl + ' units/mL'})` : ''}` };
  }

  Views.protocol = { get, html, link, open, bind, titrateDrip, bolusCalc, rateCalc, n1 };
})();
