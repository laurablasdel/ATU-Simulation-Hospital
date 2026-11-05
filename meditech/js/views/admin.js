/* Administrative — registration: demographics, next of kin, insurance, encounter. */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};

  const kv = rows => `<dl class="kv">${rows.filter(r => r[1] != null && r[1] !== '').map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  const NOT = 'Not documented';

  Views.admin = {
    label: 'Administrative',
    render(p) {
      const d = Object.assign({}, p.demographics || {});
      const take = k => { const v = d[k]; delete d[k]; return v; };
      const insurance = take('Insurance');
      const demo = kv([
        ['Name', `${p.name.last}, ${p.name.first}`], ['MRN', p.mrn], ['Date of birth', U.fmtDOB(p.dob)], ['Age', p.age], ['Sex', p.sex],
        ['Marital status', take('Marital status')], ['Primary language', take('Primary language')], ['Race', take('Race')],
        ['Ethnicity', take('Ethnicity')], ['Religion', take('Religion')], ['Occupation', take('Occupation')], ['Education', take('Education')]
      ].concat(Object.entries(d)));
      const nok = kv([['Emergency contact / next of kin', p.emergencyContact || NOT]]);
      const ins = kv([['Primary insurance', insurance || NOT], ['Financial class', /self/i.test(insurance || '') ? 'Self pay' : insurance ? 'Insured' : NOT]]);
      const enc = kv([
        ['Registration status', 'Inpatient — Admitted'], ['Admitted', U.fmtDT(p.admitTime)], ['Unit', p.unit],
        ['Room/Bed', p.room && p.room !== '—' ? p.room : 'Unassigned'], ['Service', p.service], ['Attending provider', p.attending],
        ['Admitting diagnosis', p.admitDx], ['Code status', p.codeStatus], ['Isolation', p.isolation]
      ]);
      return `<div class="grid-2">
        ${UI.panel('Patient Demographics', demo)}
        ${UI.panel('Encounter / Registration', enc)}
        ${UI.panel('Next of Kin / Emergency Contact', nok)}
        ${UI.panel('Insurance', ins)}
      </div>`;
    }
  };
})();
