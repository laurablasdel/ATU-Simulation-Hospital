/*
 * Diagnostics — Expanse-style cumulative results. Subtabs (Laboratory, Imaging,
 * Microbiology, Pathology, Blood Bank Tests, Cardiovascular, Other Specialty);
 * the Laboratory view is one table with section rows (Hematology, Coagulation,
 * Chemistry, …), the reference range under each test name, and one column per
 * collection time, oldest to newest left to right. A released result becomes a
 * new column (flagged NEW) on the same rows.
 */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};

  const SUBTABS = ['Laboratory', 'Imaging', 'Microbiology', 'Pathology', 'Blood Bank Tests', 'Cardiovascular', 'Other Specialty'];
  const SECTION_ORDER = ['Hematology', 'Coagulation', 'Chemistry', 'Blood Gases', 'Cardiac', 'Other'];
  const SECTION = [
    [/^(Hgb|Hb|HCT|WBC|RBC|Platelets|MCV|MCH|RDW)/i, 'Hematology'],
    [/^(PT|INR|aPTT|D-dimer|Fibrinogen)$/i, 'Coagulation'],
    [/^(Sodium|Potassium|Chloride|HCO3$|BUN|Creatinine|Glucose|Calcium|Magnesium|Phosphorus|Lactate|Albumin)/i, 'Chemistry'],
    [/^(pH|PaCO2|PaO2|HCO3 \(arterial\)|SaO2|Base)/i, 'Blood Gases'],
    [/^(Troponin|CK-MB|BNP|CK\b)/i, 'Cardiac']
  ];
  const sectionOf = t => (SECTION.find(([re]) => re.test(t)) || [null, 'Other'])[1];
  const isMicro = r => /culture|gram stain|sensitivit/i.test(r.t);
  const isBank = r => /ABO|blood type|antibody screen|antibody identification|crossmatch/i.test(r.t);

  let sub = 'Laboratory';
  let section = 'All';
  const collapsed = {};

  const colHead = t => `${U.fmtDate(t).slice(0, 5)}<br>${U.fmtTime(t)}`;

  function cell(r) {
    if (!r) return '<td class="dx-cell"></td>';
    const f = Model.labFlag(r);
    const crit = /\*/.test(f);
    return `<td class="dx-cell ${f ? (crit ? 'dx-crit' : 'dx-abn') : ''}">${esc(r.v)}${f ? ` <strong>${esc(f)}</strong>` : ''}${r.comment ? `<div class="muted small">${esc(r.comment)}</div>` : ''}</td>`;
  }

  // Lab results as rows by test, columns by collection time.
  function labTable(p, doc, pick) {
    const labs = p.labs.map(l => Object.assign({}, l, { results: l.results.filter(pick) })).filter(l => l.results.length);
    if (!labs.length) return UI.empty('No results on file.');
    const times = [...new Set(labs.map(l => l.time))].sort((a, b) => a - b);
    const newTimes = new Set(labs.filter(l => l.isNew && !Model.isAcked(doc, l.id)).map(l => l.time));
    const tests = [];
    labs.sort((a, b) => a.time - b.time).forEach(l => l.results.forEach(r => { if (!tests.find(x => x.t === r.t)) tests.push({ t: r.t, ref: Model.labRef(r), u: r.u, sec: sectionOf(r.t) }); }));
    const value = (t, time) => { let out = null; labs.forEach(l => { if (l.time === time) { const r = l.results.find(x => x.t === t); if (r) out = r; } }); return out; };
    const secs = SECTION_ORDER.filter(s => tests.some(x => x.sec === s) && (section === 'All' || section === s));
    const body = secs.map(s => `<tr class="dx-sec"><th colspan="${times.length + 1}"><button type="button" class="dx-toggle" data-sec="${esc(s)}">${collapsed[s] ? '▸' : '▾'} ${esc(s)}</button></th></tr>
      ${collapsed[s] ? '' : tests.filter(x => x.sec === s).map(x => `<tr><th class="dx-test">${esc(x.t)}${x.ref ? `<div class="dx-ref">(${esc(x.ref)}${x.u ? ' ' + esc(x.u) : ''})</div>` : ''}</th>
        ${times.map(tm => cell(value(x.t, tm))).join('')}</tr>`).join('')}`).join('');
    return `<div class="scroll-x"><table class="dx-grid"><thead><tr><th class="dx-test"></th>${times.map((tm, i) => `<th class="${newTimes.has(tm) ? 'dx-new' : ''} ${i === times.length - 1 ? 'dx-last' : ''}">${colHead(tm)}${Store.instructorUnlocked() ? labs.filter(l=>l.time===tm).map(l=>FacultySession.editButton('labs',l)).join(' ') : ''}${newTimes.has(tm) ? '<br>' + UI.badge('NEW', 'new') : ''}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody></table></div>`;
  }

  function reports(p, doc, list) {
    return list.length ? [...list].sort((a, b) => b.time - a.time).map(i => `<article class="note ${i.isNew ? 'note-new' : ''}">
        <header><strong>${esc(i.study)}</strong> ${FacultySession.editButton('imaging',i)}${i.isNew ? ' ' + UI.badge('NEW', 'new') : ''}<span class="muted"> — ${esc(U.fmtDT(i.time))}</span></header>
        <div class="note-body">${U.body(i)}</div>
        ${i.isNew && !Model.isAcked(doc, i.id) ? `<button class="btn btn-sm btn-primary" data-review="${esc(i.id)}">Mark Reviewed</button>` : ''}
      </article>`).join('') : UI.empty('No reports on file.');
  }

  Views.results = {
    label: 'Diagnostics',
    // Chart search opens a sub-tab directly (e.g., "labs" → Laboratory).
    show(s) { if (SUBTABS.includes(s)) { sub = s; section = 'All'; } },
    render(p, doc) {
      const pending = Model.unreviewedResults(p, doc);
      const labPick = r => !isMicro(r) && !isBank(r);
      const cardio = p.imaging.filter(i => /ECG|EKG|echo|telemetry|cardiac/i.test(i.study));
      const imaging = p.imaging.filter(i => !cardio.includes(i));
      const has = {
        Laboratory: p.labs.some(l => l.results.some(labPick)), Imaging: imaging.length > 0,
        Microbiology: p.labs.some(l => l.results.some(isMicro)), 'Blood Bank Tests': p.labs.some(l => l.results.some(isBank)) || !!p.bloodType,
        Cardiovascular: cardio.length > 0, Pathology: false, 'Other Specialty': false
      };
      let content = '';
      if (sub === 'Laboratory') {
        const present = SECTION_ORDER.filter(s => p.labs.some(l => l.results.some(r => labPick(r) && sectionOf(r.t) === s)));
        if (section !== 'All' && !present.includes(section)) section = 'All';
        content = `<div class="dx-lab"><nav class="dx-side">${['All', ...present].map(s => `<button type="button" class="dx-side-btn ${section === s ? 'dx-side-on' : ''}" data-side="${esc(s)}">${esc(s)}</button>`).join('')}</nav>
          <div class="dx-main">${labTable(p, doc, labPick)}</div></div>`;
      } else if (sub === 'Microbiology') content = labTable(p, doc, isMicro);
      else if (sub === 'Blood Bank Tests') content = (p.bloodType ? `<p><strong>Blood Type:</strong> ${esc(p.bloodType)}</p>` : '') + labTable(p, doc, isBank);
      else if (sub === 'Imaging') content = reports(p, doc, imaging);
      else if (sub === 'Cardiovascular') content = reports(p, doc, cardio);
      else content = UI.empty('No results on file.');

      const newLabs = p.labs.filter(l => l.isNew && !Model.isAcked(doc, l.id));
      return `${pending.length ? `<div class="alerts"><div class="alert alert-new">${pending.length} new result(s) — review and notify the provider of critical or significantly abnormal values.
          ${newLabs.map(l => `<button class="btn btn-sm btn-primary" data-review="${esc(l.id)}">Mark Reviewed: ${esc(l.panel)}</button>`).join(' ')}</div></div>` : ''}
        ${p.labsPending ? `<div class="alerts"><div class="alert alert-info">${esc(p.labsPending)}</div></div>` : ''}
        <div class="dx-subtabs" role="tablist">${SUBTABS.map(t => `<button type="button" role="tab" class="dx-subtab ${sub === t ? 'dx-subtab-on' : ''} ${has[t] ? '' : 'dx-empty'}" data-sub="${esc(t)}" aria-selected="${sub === t}">${esc(t)}</button>`).join('')}</div>
        ${content}
        <p class="muted small">Flags: H high · L low · H* / L* critical · A abnormal. Reference ranges are under each test name.</p>`;
    },
    bind(root, p) {
      FacultySession.bindCorrections(root,p);
      root.querySelectorAll('[data-sub]').forEach(b => b.addEventListener('click', () => { sub = b.dataset.sub; App.render(); }));
      root.querySelectorAll('[data-side]').forEach(b => b.addEventListener('click', () => { section = b.dataset.side; App.render(); }));
      root.querySelectorAll('[data-sec]').forEach(b => b.addEventListener('click', () => { collapsed[b.dataset.sec] = !collapsed[b.dataset.sec]; App.render(); }));
      root.querySelectorAll('[data-review]').forEach(b => b.addEventListener('click', () => {
        Store.add(p.id, 'ack', { ref: b.dataset.review, kind: 'result' }, p.clock.now(), p.clock.now());
        UI.toast('Result marked as reviewed.');
        App.render();
      }));
    }
  };
})();
