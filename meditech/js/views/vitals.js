/* Vital Signs — entry form plus flowsheet (newest column first). */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};

  const ROWS = [
    ['temp', 'Temp (°F)'], ['tempRoute', 'Temp route'], ['hr', 'Heart rate'], ['rr', 'Resp rate'],
    ['bp', 'Blood pressure'], ['map', 'MAP'], ['bpPos', 'BP position'], ['spo2', 'SpO₂ (%)'], ['o2', 'O₂ device'], ['o2Flow', 'O₂ flow (L/min)'],
    ['pain', 'Pain (0–10)'], ['glucose', 'POC glucose'], ['weight', 'Weight (kg)'], ['note', 'Comment'], ['by', 'Charted by']
  ];
  const O2 = ['Room air', 'Nasal cannula', 'Simple face mask', 'Venturi mask', 'Non-rebreather mask', 'High-flow nasal cannula', 'BiPAP', 'CPAP', 'Ventilator'];

  function cell(p, r, key) {
    if (key === 'bp') {
      if (U.isEmpty(r.sbp)) return '';
      const f = Model.flag(p, 'sbp', r.sbp) || Model.flag(p, 'dbp', r.dbp);
      return `<span class="${f ? 'abn' : ''}">${esc(r.sbp)}/${esc(r.dbp)}</span>${UI.flag(f)}`;
    }
    if (key === 'map') {
      const m = Model.map(r); if (m == null) return '';
      const f = Model.flag(p, 'map', m);
      return `<span class="${f ? 'abn' : ''}">${m}</span>${UI.flag(f)}`;
    }
    const v = r[key];
    if (U.isEmpty(v)) return '';
    const f = Model.flag(p, key, v);
    return `<span class="${f ? 'abn' : ''}">${esc(v)}</span>${UI.flag(f)}`;
  }

  const formHtml = p => `<form class="vitals-form" autocomplete="off">
        <div class="form-grid g4">
          ${UI.timeField(p)}
          <label class="field"><span>Temp (°F)</span><input type="number" step="0.1" name="temp"></label>
          <label class="field"><span>Temp route</span><select name="tempRoute">${UI.options(['Oral', 'Tympanic', 'Temporal', 'Axillary', 'Rectal'])}</select></label>
          <label class="field"><span>Heart rate</span><input type="number" name="hr"></label>
          <label class="field"><span>Resp rate</span><input type="number" name="rr"></label>
          <label class="field"><span>Systolic BP</span><input type="number" name="sbp"></label>
          <label class="field"><span>Diastolic BP</span><input type="number" name="dbp"></label>
          <label class="field"><span>BP position</span><select name="bpPos">${UI.options(['Lying', 'Sitting', 'Standing'])}</select></label>
          <label class="field"><span>SpO₂ (%)</span><input type="number" name="spo2"></label>
          <label class="field"><span>O₂ device</span><select name="o2">${UI.options(O2)}</select></label>
          <label class="field"><span>O₂ flow (L/min)</span><input type="number" step="0.5" name="o2Flow"></label>
          <label class="field"><span>Pain (0–10)</span><input type="number" min="0" max="10" name="pain"></label>
          <label class="field"><span>POC glucose</span><input type="number" name="glucose"></label>
          <label class="field"><span>Weight (kg)</span><input type="number" step="0.1" name="weight"></label>
        </div>
        <label class="field"><span>Comment</span><input name="note"></label>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Save Vital Signs</button></div>
      </form>`;

  function save(p, f) {
    const v = U.formValues(f);
    delete v._time;
    const any = ['temp', 'hr', 'rr', 'sbp', 'dbp', 'spo2', 'pain', 'glucose', 'weight'].some(k => !U.isEmpty(v[k]));
    if (!any) { UI.formError(f, 'Enter at least one measurement.'); return false; }
    if (U.isEmpty(v.sbp) !== U.isEmpty(v.dbp)) { UI.formError(f, 'Enter both systolic and diastolic blood pressure.'); return false; }
    Object.keys(v).forEach(k => { if (v[k] === '') delete v[k]; });
    Store.add(p.id, 'vitals', v, UI.readTime(p, f), p.clock.now());
    UI.toast('Vital signs saved.');
    return true;
  }

  Views.vitals = {
    label: 'Vital Signs',
    render(p, doc) {
      const rows = Model.vitals(p, doc);
      const cols = rows.slice(0, 24);
      const r = Model.ranges(p);

      const table = cols.length ? `<div class="scroll-x"><table class="grid flowsheet">
        <thead><tr><th>Parameter</th>${cols.map(c => `<th class="${c.source === 'student' ? 'col-student' : ''} ${c.entry && c.entry.status === 'error' ? 'struck' : ''}">${U.fmtDate(c.time).slice(0, 5)}<br>${U.fmtTime(c.time)}</th>`).join('')}</tr></thead>
        <tbody>${ROWS.map(([k, label]) => `<tr><th>${label}</th>${cols.map(c => `<td class="${c.entry && c.entry.status === 'error' ? 'struck' : ''}">${k === 'by' ? esc(c.by || '') : cell(p, c, k)}</td>`).join('')}</tr>`).join('')}
          <tr><th></th>${cols.map(c => `<td>${c.entry && c.entry.status === 'active' ? `<button class="btn btn-sm btn-link" data-err="${c.entry.id}">Error</button>` : ''}</td>`).join('')}</tr>
        </tbody></table></div>` : UI.empty('No vital signs recorded yet.');

      const ranges = `Flags: HR ${r.hr[0]}–${r.hr[1]} · RR ${r.rr[0]}–${r.rr[1]} · SBP ${r.sbp[0]}–${r.sbp[1]} · SpO₂ ${r.spo2[0]}–${r.spo2[1]}% · Temp ${r.temp[0]}–${r.temp[1]} °F`;
      // Vital signs are charted only from the Worklist (Document); this tab is the flowsheet.
      const how = `<div class="alerts"><div class="alert alert-info">Vital signs are documented from the <a href="#/patient/${esc(p.id)}/worklist"><strong>Worklist</strong></a>: check the Vital Signs box for the time, then click <strong>Document</strong>.</div></div>`;
      return how + UI.panel('Vital Signs Flowsheet', `<p class="muted">${ranges}. Student entries are shaded.</p>${table}`);
    },
    bind(root, p) {
      root.querySelectorAll('[data-err]').forEach(b => b.addEventListener('click', () => UI.errorEntry(p, 'vitals', b.dataset.err)));
    }
  };

  // Vital signs as a dialog (used by the Worklist's Document button).
  Views.vitals.modal = function (p, after) {
    UI.modal({
      title: 'Vital Signs', wide: true,
      body: formHtml(p).replace('<div class="form-actions"><button class="btn btn-primary" type="submit">Save Vital Signs</button></div>', ''),
      onOpen(api) { api.el.querySelector('form').addEventListener('submit', e => e.preventDefault()); },
      buttons: [{ label: 'Cancel' }, { label: 'Sign & Save', cls: 'btn-primary', onClick: api => {
        if (!save(p, api.el.querySelector('form'))) return false;
        App.render();
        if (after) setTimeout(after, 0);
      } }]
    });
  };
})();
