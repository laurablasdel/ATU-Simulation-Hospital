/* Provider Notes (read-only physician documentation) and Activity (chart timeline). */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};

  const isProvider = Views.isProviderNote = n => /\bDr\.|\bMD\b|\bDO\b|\bNP\b|\bPA\b|Physician|Provider/i.test(n.author || '');

  Views.provnotes = {
    label: 'Provider Notes',
    render(p) {
      const notes = p.notes.filter(isProvider).sort((a, b) => b.time - a.time);
      const reports = [...p.imaging].sort((a, b) => b.time - a.time);
      const list = notes.length ? notes.map(n => `<article class="note ${n.isNew ? 'note-new' : ''}">
          <header><strong>${esc(n.type)}</strong> ${FacultySession.editButton('notes',n)}${n.isNew ? ' ' + UI.badge('NEW', 'new') : ''}<span class="muted"> — ${esc(U.fmtDT(n.time))} · ${esc(n.author)}</span></header>
          <div class="note-body">${U.body(n)}</div></article>`).join('') : UI.empty('No provider notes on file.');
      const rep = reports.length ? reports.map(i => `<article class="note"><header><strong>${esc(i.study)}</strong><span class="muted"> — ${esc(U.fmtDT(i.time))}</span></header><div class="note-body">${U.body(i)}</div></article>`).join('') : '';
      return `${UI.panel('Provider Documentation', list)}${rep ? UI.panel('Reports (Imaging / ECG)', rep) : ''}
        <p class="muted">Provider notes are read-only. Nursing documentation is under Nurse/Allied Health → Nursing Notes.</p>`;
    },
    bind(root,p){ FacultySession.bindCorrections(root,p); }
  };

  const SEC = {
    vitals: ['Vital Signs', 'vitals', e => [e.data.hr && 'HR ' + e.data.hr, e.data.sbp && 'BP ' + e.data.sbp + '/' + e.data.dbp, e.data.spo2 && 'SpO₂ ' + e.data.spo2 + '%', e.data.temp && 'T ' + e.data.temp].filter(Boolean).join(', ')],
    assess: ['Assessment', 'assess', e => (window.ASSESSMENT_FORMS[e.data.formId] || {}).title || e.data.formId],
    mar: ['Medication', 'mar', e => `${e.data.medName} — ${e.data.action}`],
    io: ['Intake & Output', 'io', e => `${e.data.kind === 'in' ? 'Intake' : 'Output'} ${e.data.cat} ${e.data.amt} mL`],
    notes: ['Nursing Note', 'notes', e => e.data.type],
    orders: ['Order / chart change', 'orders', e => e.data.kind === 'correction' ? 'Corrected: ' + (e.data.order.text || Model.medLabel(e.data.order.med || {})) : e.data.text],
    ack: ['Acknowledged', 'orders', e => e.data.kind === 'result' ? 'Result reviewed' : 'Order acknowledged'],
    careplan: ['Care Plan', 'careplan', e => e.data.kind === 'plan' ? e.data.dx : 'Evaluation: ' + e.data.status],
    heparin: ['Heparin Flowsheet', 'heparin', e => [e.data.aptt && 'aPTT ' + e.data.aptt, e.data.newRate && 'Rate ' + e.data.newRate].filter(Boolean).join(', ')],
    tar: ['Transfusion (TAR)', 'tar', e => e.data.kind === 'start' ? `Started ${e.data.product}, unit ${e.data.unitNo}` : e.data.kind === 'vitals' ? `Vital signs — ${e.data.label}` : e.data.kind === 'end' ? `Completed — ${e.data.infused} mL` : 'Stopped — suspected reaction']
  };

  // Documents — consents, prenatal records, APGAR, policies, printable forms (read-only reference).
  const DOC_GROUP = { documents: 'Consents & Forms', prenatal: 'Prenatal Record', labor: 'Labor & Delivery', io: 'Intake & Output (source record)', assessments: 'Assessment Tools', orders: 'Policies & Protocols', mar: 'MAR Schedules' };
  let openDoc = null;
  Views.documents = {
    label: 'Documents',
    render(p) {
      const docs = [...(p.documents || [])].sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.time - b.time);
      if (!docs.length) return UI.empty('No documents on file for this patient.');
      if (openDoc && !docs.some(d => d.id === openDoc)) openDoc = null;
      const cur = docs.find(d => d.id === openDoc) || docs[0];
      const groups = {};
      docs.forEach(d => { const g = DOC_GROUP[d.category] || 'Other'; (groups[g] = groups[g] || []).push(d); });
      return `<div class="doc-layout"><nav class="dx-side">${Object.entries(groups).map(([g, list]) => `<div class="doc-group">${esc(g)}</div>${list.map(d => `<button type="button" class="dx-side-btn ${d === cur ? 'dx-side-on' : ''}" data-doc="${esc(d.id)}">${esc(d.title)}${d.isNew ? ' ' + UI.badge('NEW', 'new') : ''}</button>`).join('')}`).join('')}</nav>
        <article class="note doc-body"><header><strong>${esc(cur.title)}</strong> ${FacultySession.editButton('documents',cur)}</header><div class="note-body">${U.attachment(cur)}${U.md(cur.md || '')}</div></article></div>`;
    },
    bind(root,p) { FacultySession.bindCorrections(root,p); root.querySelectorAll('[data-doc]').forEach(b => b.addEventListener('click', () => { openDoc = b.dataset.doc; App.render(); })); }
  };

  Views.activity = {
    label: 'Activity',
    render(p, doc) {
      const rows = [];
      Object.keys(SEC).forEach(k => doc[k].forEach(e => rows.push({ time: e.time, what: SEC[k][0], detail: SEC[k][2](e), tab: SEC[k][1], by: Model.signature(e), error: e.status === 'error', late: Model.lateLabel(e) })));
      p.releasedEvents.forEach(ev => rows.push({ time: ev.time, what: 'New orders/results', detail: ev.title, tab: 'orders', by: 'Provider', event: true }));
      rows.sort((a, b) => b.time - a.time);
      const table = rows.length ? `<table class="grid"><thead><tr><th>Date/time</th><th>Activity</th><th>Detail</th><th>By</th></tr></thead><tbody>
        ${rows.map(r => `<tr class="${r.error ? 'error-row' : ''} ${r.event ? 'row-new' : ''}"><td class="nowrap">${esc(U.fmtDT(r.time))}</td>
          <td><a href="#/patient/${esc(p.id)}/${r.tab}">${esc(r.what)}</a></td><td>${esc(r.detail || '')}${r.late ? ` <span class="late">${esc(r.late)}</span>` : ''}</td><td>${esc(r.by)}</td></tr>`).join('')}
        </tbody></table>` : UI.empty('No activity yet in this scenario.');
      return UI.panel('Chart Activity', table);
    }
  };
})();
