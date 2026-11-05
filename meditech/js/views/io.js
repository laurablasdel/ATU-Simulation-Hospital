/* Intake & Output — entries plus shift and 24-hour balance. */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};

  const INTAKE = ['PO (oral)', 'IV fluids', 'IV piggyback / meds', 'Blood products', 'Tube feeding', 'Irrigation', 'Other intake'];
  const OUTPUT = ['Urine — voided', 'Urine — Foley', 'Urine — straight cath', 'Emesis', 'Stool', 'NG / gastric', 'Wound drain', 'Chest tube', 'Blood loss', 'Other output'];

  // Shift boundaries 0700–1859 and 1900–0659.
  function shiftStart(t) {
    const d = new Date(t);
    const h = d.getHours();
    const s = new Date(d);
    if (h >= 7 && h < 19) s.setHours(7, 0, 0, 0);
    else { if (h < 7) s.setDate(s.getDate() - 1); s.setHours(19, 0, 0, 0); }
    return s.getTime();
  }

  function totals(rows, from, to) {
    let i = 0, o = 0;
    rows.forEach(r => { if (r.time >= from && r.time < to) { const a = Number(r.amt) || 0; if (r.kind === 'in') i += a; else o += a; } });
    return { i, o, bal: i - o };
  }

  Views.io = {
    label: 'Intake & Output',
    render(p, doc) {
      const now = p.clock.now();
      const rows = Model.io(p, doc);
      const cur = shiftStart(now);
      const prev = cur - 12 * 3600000;
      const t = [
        ['Current shift (since ' + U.fmtTime(cur) + ')', totals(rows, cur, now + 1)],
        ['Previous shift', totals(rows, prev, cur)],
        ['Last 24 hours', totals(rows, now - 24 * 3600000, now + 1)]
      ];
      const summary = `<table class="grid"><thead><tr><th>Period</th><th>Intake (mL)</th><th>Output (mL)</th><th>Balance</th></tr></thead><tbody>
        ${t.map(([l, x]) => `<tr><td>${esc(l)}</td><td>${x.i}</td><td>${x.o}</td><td class="${x.bal < 0 ? 'text-danger' : ''}">${x.bal > 0 ? '+' : ''}${x.bal}</td></tr>`).join('')}
        </tbody></table>`;

      const form = `<form class="io-form" autocomplete="off"><div class="form-grid g4">
          ${UI.timeField(p)}
          <label class="field"><span>Type</span><select name="kind"><option value="in">Intake</option><option value="out">Output</option></select></label>
          <label class="field"><span>Category</span><select name="cat">${UI.options(INTAKE, null, false)}</select></label>
          <label class="field"><span>Amount (mL)</span><input type="number" name="amt" min="0" required></label>
        </div>
        <label class="field"><span>Description (color, character, source)</span><input name="desc"></label>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Save Entry</button></div></form>`;

      const all = [...p.ioPrior.map(r => Object.assign({ source: 'prior' }, r)), ...doc.io.map(e => Object.assign({ source: 'student', entry: e, time: e.time }, e.data))]
        .sort((a, b) => b.time - a.time);
      const list = all.length ? `<table class="grid"><thead><tr><th>Date/time</th><th>Type</th><th>Category</th><th>mL</th><th>Description</th><th>By</th><th></th></tr></thead><tbody>
        ${all.map(r => `<tr class="${r.entry && r.entry.status === 'error' ? 'error-row' : ''}"><td class="nowrap">${esc(U.fmtDT(r.time))}</td><td>${r.kind === 'in' ? 'Intake' : 'Output'}</td><td>${esc(r.cat)}</td><td>${esc(r.amt)}</td><td>${esc(r.desc || '')}</td>
          <td>${r.entry ? esc(Model.signature(r.entry)) : esc(r.by || 'Prior shift')}</td>
          <td>${r.entry && r.entry.status === 'active' ? `<button class="btn btn-sm btn-link" data-err="${r.entry.id}">Error</button>` : ''}</td></tr>`).join('')}
        </tbody></table>` : UI.empty('No intake or output recorded.');

      return `<div class="grid-2">${UI.panel('Enter Intake / Output', form)}${UI.panel('Totals', summary)}</div>${UI.panel('Intake & Output Detail', list)}`;
    },
    bind(root, p) {
      const f = root.querySelector('.io-form');
      const kind = f.querySelector('[name=kind]');
      const cat = f.querySelector('[name=cat]');
      kind.addEventListener('change', () => { cat.innerHTML = UI.options(kind.value === 'in' ? INTAKE : OUTPUT, null, false); });
      f.addEventListener('submit', e => {
        e.preventDefault();
        const v = U.formValues(f);
        if (U.num(v.amt) == null) { UI.formError(f, 'Enter an amount in mL.'); return; }
        Store.add(p.id, 'io', { kind: v.kind, cat: v.cat, amt: Number(v.amt), desc: v.desc }, UI.readTime(p, f), p.clock.now());
        UI.toast('Intake/output saved.');
        App.render();
      });
      root.querySelectorAll('[data-err]').forEach(b => b.addEventListener('click', () => UI.errorEntry(p, 'io', b.dataset.err)));
    }
  };
})();
