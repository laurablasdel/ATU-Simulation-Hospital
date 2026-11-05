/* Chart Report — printable record of everything documented this scenario. */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};

  function section(title, body) { return `<section class="rpt-sec"><h2>${esc(title)}</h2>${body}</section>`; }
  const cls = e => e.status === 'error' ? 'struck' : '';
  const meta = e => `<div class="rpt-meta">${esc(U.fmtDT(e.time))} · ${esc(Model.signature(e))}${Model.lateLabel(e) ? ' · ' + esc(Model.lateLabel(e)) : ''}${e.status === 'error' ? ` · ENTERED IN ERROR: ${esc(e.error.reason)} (${esc(e.error.by)})` : ''}</div>`;

  Views.report = {
    label: 'Chart Report',
    render(p, doc) {
      const users = [...new Set(Store.SECTIONS.flatMap(s => doc[s].map(e => Model.signature(e))))];

      const mar = doc.mar.length ? `<table class="grid"><thead><tr><th>Time</th><th>Medication</th><th>Action</th><th>Details</th><th>By</th></tr></thead><tbody>
        ${[...doc.mar].sort((a, b) => a.time - b.time).map(e => `<tr class="${cls(e)}"><td class="nowrap">${esc(U.fmtDT(e.time))}</td><td>${esc(e.data.medName)}</td><td>${esc(e.data.action)}</td>
          <td>${[e.data.dose, e.data.route, e.data.site, e.data.rate, e.data.reason, e.data.prnReason && 'PRN: ' + e.data.prnReason, e.data.response,
            e.data.scan && `Scan: pt ${e.data.scan.patient}, med ${e.data.scan.med}${e.data.scan.unableReason ? ' (' + e.data.scan.unableReason + ')' : ''}`,
            e.data.preAssess && Object.keys(e.data.preAssess).length && 'Pre: ' + Object.entries(e.data.preAssess).map(([k, v]) => k + ' ' + v).join(', '),
            e.data.holdParamsMet && e.data.holdParamsMet.length && 'HOLD PARAMETER MET: ' + e.data.holdParamsMet.join(', '),
            e.data.allergyOverride && 'ALLERGY OVERRIDE: ' + e.data.allergyOverride, e.data.doubleCheck && 'Double check: ' + e.data.doubleCheck, e.data.comment].filter(Boolean).map(esc).join('<br>')}
            ${e.status === 'error' ? `<div class="err-label">Entered in error — ${esc(e.error.reason)}</div>` : ''}</td>
          <td>${esc(Model.signature(e))}</td></tr>`).join('')}</tbody></table>` : '<p>None.</p>';

      const vit = doc.vitals.length ? `<table class="grid"><thead><tr><th>Time</th><th>T</th><th>HR</th><th>RR</th><th>BP</th><th>SpO₂</th><th>O₂</th><th>Pain</th><th>Other</th><th>By</th></tr></thead><tbody>
        ${[...doc.vitals].sort((a, b) => a.time - b.time).map(e => { const d = e.data; return `<tr class="${cls(e)}"><td class="nowrap">${esc(U.fmtDT(e.time))}</td><td>${esc(d.temp || '')}</td><td>${esc(d.hr || '')}</td><td>${esc(d.rr || '')}</td>
          <td>${d.sbp ? esc(d.sbp + '/' + d.dbp) : ''}</td><td>${esc(d.spo2 || '')}</td><td>${esc([d.o2, d.o2Flow && d.o2Flow + ' L'].filter(Boolean).join(' '))}</td><td>${esc(d.pain || '')}</td>
          <td>${esc([d.glucose && 'Glucose ' + d.glucose, d.weight && 'Wt ' + d.weight + ' kg', d.note].filter(Boolean).join('; '))}</td><td>${esc(Model.signature(e))}</td></tr>`; }).join('')}</tbody></table>` : '<p>None.</p>';

      const assess = doc.assess.length ? [...doc.assess].sort((a, b) => a.time - b.time).map(e => {
        const f = window.ASSESSMENT_FORMS[e.data.formId];
        return `<div class="rpt-item ${cls(e)}"><h3>${esc(f ? f.title : e.data.formId)}</h3>${f ? Views.assess.detail(p, f, e.data) : ''}${meta(e)}</div>`;
      }).join('') : '<p>None.</p>';

      const io = doc.io.length ? `<table class="grid"><thead><tr><th>Time</th><th>Type</th><th>Category</th><th>mL</th><th>Description</th><th>By</th></tr></thead><tbody>
        ${[...doc.io].sort((a, b) => a.time - b.time).map(e => `<tr class="${cls(e)}"><td class="nowrap">${esc(U.fmtDT(e.time))}</td><td>${e.data.kind === 'in' ? 'Intake' : 'Output'}</td><td>${esc(e.data.cat)}</td><td>${esc(e.data.amt)}</td><td>${esc(e.data.desc || '')}</td><td>${esc(Model.signature(e))}</td></tr>`).join('')}</tbody></table>` : '<p>None.</p>';

      const notes = doc.notes.length ? [...doc.notes].sort((a, b) => a.time - b.time).map(e =>
        `<div class="rpt-item ${cls(e)}"><h3>${esc(e.data.type)}</h3>${e.data.type === 'Addendum' ? `<p>${U.nl2br(e.data.text)}</p>` : Views.notes.noteBody(e.data.type, e.data)}${meta(e)}</div>`).join('') : '<p>None.</p>';

      const orders = (doc.orders.length || doc.ack.length) ? `
        ${doc.orders.map(e => `<div class="rpt-item ${cls(e)}"><strong>${esc(e.data.type)} order (${esc(e.data.cat)}):</strong> ${esc(e.data.text)} — ${esc(e.data.provider)}; read back: ${e.data.readBack ? 'yes' : 'no'}${meta(e)}</div>`).join('')}
        ${doc.ack.map(e => { const o = [...p.orders, ...Model.medOrders(p)].find(x => x.id === e.data.ref) || [...p.labs, ...p.imaging].find(x => x.id === e.data.ref);
          return `<div class="rpt-item">${e.data.kind === 'result' ? 'Reviewed result' : 'Acknowledged order'}: ${esc(o ? (o.text || o.panel || o.study) : e.data.ref)}${meta(e)}</div>`; }).join('')}` : '<p>None.</p>';

      const care = doc.careplan.length ? doc.careplan.map(e => `<div class="rpt-item ${cls(e)}">${e.data.kind === 'plan'
        ? `<h3>${esc(e.data.dx)}</h3><div>Related to: ${esc(e.data.rt || '')}</div><div>AEB: ${esc(e.data.aeb || '')}</div><div>Goal: ${U.nl2br(e.data.goal)}</div><div>Interventions: ${U.nl2br(e.data.interventions)}</div>`
        : `<strong>Evaluation — ${esc(e.data.status)}:</strong> ${U.nl2br(e.data.text)}`}${meta(e)}</div>`).join('') : '<p>None.</p>';

      const hep = doc.heparin.length ? doc.heparin.map(e => `<div class="rpt-item ${cls(e)}">${Object.entries(e.data).filter(([, v]) => v).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(' · ')}${meta(e)}</div>`).join('') : '';

      const tar = doc.tar.length ? [...doc.tar].sort((a, b) => a.time - b.time).map(e => `<div class="rpt-item ${cls(e)}">${Object.entries(e.data).filter(([k, v]) => v && k !== 'tx' && k !== 'orderRef').map(([k, v]) => `${esc(k)}: ${esc(Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? Object.entries(v).map(x => x.join(' ')).join(', ') : v)}`).join(' · ')}${meta(e)}</div>`).join('') : '';

      return `<div class="report">
        <div class="toolbar no-print"><button class="btn btn-primary" data-action="print">Print / Save as PDF</button> <button class="btn" data-action="json">Download Data (JSON)</button></div>
        <header class="rpt-head">
          <h1>${esc(window.EHR_CONFIG.hospitalName)} — Simulation Chart Report</h1>
          <p><strong>${esc(p.name.last)}, ${esc(p.name.first)}</strong> · MRN ${esc(p.mrn)} · DOB ${esc(U.fmtDOB(p.dob))} · ${esc(p.age)} ${esc(p.sex)} · ${esc(p.unit)}</p>
          <p>Diagnosis: ${esc(p.admitDx)} · Allergies: ${p.nkda ? 'NKDA' : esc(p.allergies.map(a => a.agent + ' (' + a.reaction + ')').join(', '))} · Code: ${esc(p.codeStatus)}</p>
          <p>Scenario started ${esc(U.fmtDT(p.clock.simStart))} · Report printed ${esc(U.fmtDT(p.clock.now()))} · Documented by: ${esc(users.join('; ') || '—')}</p>
          <p class="muted">SIMULATION — FOR EDUCATIONAL USE ONLY. Not a real medical record.</p>
        </header>
        ${section('Medication Administration', mar)}
        ${section('Vital Signs', vit)}
        ${section('Assessments', assess)}
        ${section('Intake & Output', io)}
        ${section('Nursing Notes', notes)}
        ${section('Orders — Verbal/Telephone & Acknowledgments', orders)}
        ${section('Care Plan', care)}
        ${hep ? section('Heparin Flowsheet', hep) : ''}
        ${tar ? section('Transfusion Administration Record', tar) : ''}
        <footer class="rpt-foot">Student signature: ______________________ Date: __________ &nbsp;&nbsp; Instructor: ______________________</footer>
      </div>`;
    },
    bind(root, p, doc) {
      root.querySelector('[data-action="print"]').addEventListener('click', () => window.print());
      root.querySelector('[data-action="json"]').addEventListener('click', () =>
        U.download(`${p.name.last}_${p.name.first}_SimEHR_${U.fmtDate(p.clock.now()).replace(/\//g, '-')}.json`,
          JSON.stringify({ app: 'ATU SimEHR', version: 1, exported: new Date().toISOString(), patients: { [p.id]: { doc, released: Store.released(p.id) } } }, null, 2)));
    }
  };
})();
