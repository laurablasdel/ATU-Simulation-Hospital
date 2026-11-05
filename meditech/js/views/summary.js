/* Patient Summary — the first screen when a chart opens. */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};

  const VITAL_KEYS = [
    ['temp', 'Temp', '°F'], ['hr', 'HR', ''], ['rr', 'RR', ''], ['bp', 'BP', ''],
    ['spo2', 'SpO₂', '%'], ['pain', 'Pain', '/10']
  ];

  Views.summary = {
    label: 'Summary',
    render(p, doc) {
      const newOrders = Model.unackedOrders(p, doc);
      const newResults = Model.unreviewedResults(p, doc);
      const counts = Model.dueCounts(p, doc);

      const alerts = [];
      if (newOrders.length) alerts.push(`<a href="#/patient/${p.id}/orders" class="alert alert-new">${newOrders.length} new order(s) to acknowledge</a>`);
      if (newResults.length) alerts.push(`<a href="#/patient/${p.id}/results" class="alert alert-new">${newResults.length} new result(s) to review</a>`);
      if (counts.overdue) alerts.push(`<a href="#/patient/${p.id}/mar" class="alert alert-danger">${counts.overdue} medication dose(s) overdue</a>`);
      if (counts.due) alerts.push(`<a href="#/patient/${p.id}/mar" class="alert alert-warn">${counts.due} medication dose(s) due now</a>`);
      if (p.labsPending) alerts.push(`<div class="alert alert-info">${esc(p.labsPending)}</div>`);

      const find = cat => p.orders.filter(o => o.cat === cat && o.status === 'Active').map(o => o.text).join('; ') || '—';

      const info = `<dl class="kv">
        <dt>Admitting diagnosis</dt><dd>${esc(p.admitDx)}</dd>
        <dt>Admitted</dt><dd>${esc(U.fmtDT(p.admitTime))}</dd>
        <dt>Attending</dt><dd>${esc(p.attending)}${p.service ? ' — ' + esc(p.service) : ''}</dd>
        <dt>Code status</dt><dd class="${p.codeStatus === 'DNR' ? 'text-danger strong' : ''}">${esc(p.codeStatus)}</dd>
        <dt>Isolation</dt><dd>${esc(p.isolation || 'None')}</dd>
        <dt>Diet</dt><dd>${esc(find('Diet'))}</dd>
        <dt>Activity</dt><dd>${esc(find('Activity'))}</dd>
        <dt>Height / Weight</dt><dd>${p.heightCm ? esc(p.heightCm + ' cm') : '—'} / ${p.weightKg ? esc(p.weightKg + ' kg') : '—'}${Model.bmi(p) ? ' (BMI ' + Model.bmi(p) + ')' : ''}</dd>
        <dt>Emergency contact</dt><dd>${esc(p.emergencyContact || '—')}</dd>
      </dl>`;

      const latest = Model.vitals(p, doc).filter(r => !r.entry || r.entry.status === 'active');
      const vitalCell = key => {
        if (key === 'bp') {
          const r = latest.find(x => x.sbp != null && x.sbp !== '');
          if (!r) return '—';
          const f = Model.flag(p, 'sbp', r.sbp) || Model.flag(p, 'dbp', r.dbp);
          return `<span class="${f ? 'abn' : ''}">${esc(r.sbp)}/${esc(r.dbp)}</span> ${UI.flag(f)}<small>${U.fmtTime(r.time)}</small>`;
        }
        const r = latest.find(x => x[key] != null && x[key] !== '');
        if (!r) return '—';
        const f = Model.flag(p, key, r[key]);
        return `<span class="${f ? 'abn' : ''}">${esc(r[key])}</span> ${UI.flag(f)}<small>${U.fmtTime(r.time)}</small>`;
      };
      const vitals = `<div class="vital-tiles">${VITAL_KEYS.map(([k, label]) =>
        `<div class="vital-tile"><div class="vt-label">${label}</div><div class="vt-val">${vitalCell(k)}</div></div>`).join('')}</div>
        ${(() => { const r = latest.find(x => x.o2); return r ? `<p class="muted">O₂: ${esc(r.o2)}${r.o2Flow ? ' @ ' + esc(r.o2Flow) + ' L/min' : ''} (${U.fmtTime(r.time)})</p>` : ''; })()}`;

      const dueList = [];
      p.meds.forEach(m => (m.doseTimes || []).forEach(dt => {
        if (!Model.doseInCurrentShift(p, dt)) return;
        const s = Model.doseStatus(p, doc, m, dt).code;
        if (s === 'due' || s === 'overdue') dueList.push({ m, dt, s });
      }));
      dueList.sort((a, b) => a.dt.time - b.dt.time);
      const meds = dueList.length
        ? `<table class="grid"><tbody>${dueList.map(({ m, dt, s }) => `<tr>
            <td class="nowrap">${U.fmtTime(dt.time)}</td>
            <td>${esc(Model.medLabel(m))}</td>
            <td>${s === 'overdue' ? UI.badge('Overdue', 'danger') : UI.badge('Due', 'warn')}</td></tr>`).join('')}</tbody></table>`
        : UI.empty('No scheduled doses due right now.');

      const abn = [];
      [...p.labs].sort((a, b) => b.time - a.time).forEach(panel => panel.results.forEach(r => {
        const f = Model.labFlag(r);
        if (f && abn.length < 12) abn.push(`<tr><td>${esc(r.t)}</td><td class="abn">${esc(r.v)} ${esc(r.u || '')}</td><td>${UI.flag(f)}</td><td class="muted nowrap">${U.fmtDT(panel.time)}</td></tr>`);
      }));
      const labs = abn.length ? `<table class="grid"><tbody>${abn.join('')}</tbody></table>` : UI.empty('No abnormal results on file.');

      const recent = [];
      Store.SECTIONS.forEach(sec => doc[sec].forEach(e => recent.push({ sec, e })));
      recent.sort((a, b) => b.e.recorded - a.e.recorded);
      const secName = { vitals: 'Vital signs', assess: 'Assessment', mar: 'Medication', io: 'Intake & output', notes: 'Note', orders: 'Verbal/phone order', ack: 'Acknowledged', careplan: 'Care plan', heparin: 'Heparin flowsheet', tar: 'Transfusion' };
      const docs = recent.length
        ? `<ul class="plain">${recent.slice(0, 8).map(({ sec, e }) => `<li><strong>${esc(secName[sec])}</strong> — ${esc(U.fmtDT(e.time))} · ${esc(Model.signature(e))}${e.status === 'error' ? ' <em>(error)</em>' : ''}</li>`).join('')}</ul>`
        : UI.empty('Nothing documented yet in this scenario.');

      return `
        ${alerts.length ? `<div class="alerts">${alerts.join('')}</div>` : ''}
        <div class="grid-2">
          ${UI.panel('Patient Information', info)}
          ${UI.panel('Latest Vital Signs', vitals, { actions: `<a class="btn btn-sm" href="#/patient/${p.id}/worklist">Document in Worklist</a>` })}
          ${UI.panel('Medications Due', meds, { actions: `<a class="btn btn-sm" href="#/patient/${p.id}/mar">Open eMAR</a>` })}
          ${UI.panel('Abnormal Results', labs, { actions: `<a class="btn btn-sm" href="#/patient/${p.id}/results">All Results</a>` })}
          ${UI.panel('History of Present Illness', `<p>${U.nl2br(p.hpi)}</p>`)}
          ${UI.panel('My Recent Documentation', docs)}
        </div>`;
    }
  };
})();
