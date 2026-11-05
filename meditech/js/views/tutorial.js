/*
 * EMR Orientation — guided task panel (orientation.html only).
 * A floating checklist of practice tasks on the practice patient. Each task checks itself off
 * from what the student actually charts (or from a short question). "Show me" highlights the
 * next thing to tap on the current screen (it never opens a screen for the student).
 * On the MAR, practice labels stand in for a scanner.
 * When every task is done, the student can print a completion summary for faculty.
 */
(function () {
  'use strict';
  const esc = U.esc;
  const C = window.EHR_CONFIG;
  const PID = 'practice';
  const SCHEDULED = ['prac-ceftriaxone', 'prac-lisinopril'];
  const PRN = 'prac-apap';
  const chart = tab => `#/patient/${PID}/${tab}`;

  /* ---------- Per-student progress (kept on this device) ---------- */
  const key = () => `${C.storagePrefix}.tutorial.${((Store.session() || {}).name || 'guest').toLowerCase()}`;
  // Inside an LMS (SCORM package, js/scorm.js) progress is also saved in the LMS, so it survives a new
  // device or cleared browser data; it is merged in once per page load.
  let lmsSaved = window.LMS && LMS.available ? LMS.restore() : null;
  let lmsSent = '';
  function load() {
    let st;
    try { st = Object.assign({ quiz: {}, doneAt: {}, collapsed: false }, JSON.parse(localStorage.getItem(key()) || '{}')); }
    catch (e) { st = { quiz: {}, doneAt: {}, collapsed: false }; }
    if (lmsSaved) {
      Object.keys(lmsSaved.doneAt || {}).forEach(k => { if (!st.doneAt[k]) st.doneAt[k] = lmsSaved.doneAt[k]; });
      Object.keys(lmsSaved.quiz || {}).forEach(k => { if (lmsSaved.quiz[k]) st.quiz[k] = true; });
      if (lmsSaved.opened && !st.opened) st.opened = lmsSaved.opened;
    }
    return st;
  }
  function save(st) { try { localStorage.setItem(key(), JSON.stringify(st)); } catch (e) { /* storage blocked */ } }
  function report(st, done) {
    if (!(window.LMS && LMS.available)) return;
    const state = { quiz: st.quiz, doneAt: st.doneAt, opened: st.opened || null };
    const sig = done + JSON.stringify(state);
    if (sig === lmsSent) return;
    lmsSent = sig;
    LMS.progress(done, TASKS.length, state);
  }

  const active = (doc, sec) => (doc[sec] || []).filter(e => e.status === 'active');
  const inLMS = () => !!(window.LMS && LMS.available);   // running as the SCORM package in Blackboard

  // "Show me" never changes the screen: it highlights the next thing to tap on the screen the student
  // is on. Each task lists its targets from the deepest step to the first; the first one on screen glows.
  const ROW = `.census-row[data-open="${PID}"]`;                       // status board: open the patient
  const HOME = 'a.tb-btn[href="#/census"]';                            // back to the status board
  const DOC_BTN = '.tb-split a.tb-btn[href$="/worklist"]';             // Document (the Worklist)
  const DOC_CARET = '.tb-split .tb-caret';                             // Document ▾ menu
  const onMar = () => /\/mar$/.test(location.hash);
  const hgbRow = () => Array.from(document.querySelectorAll('th.dx-test')).filter(th => /^Hgb\b/.test(th.textContent.trim())).map(th => th.closest('tr'));
  const worklistSteps = key => [
    { sel: '[data-wl="document"]:not([disabled])', when: () => !!document.querySelector(`.wl-row[data-key="${key}"].wl-checked`) },
    { sel: `.wl-row[data-key="${key}"]` },
    { sel: DOC_BTN }, { sel: ROW }];
  const marSteps = medLabels => [
    { sel: '[data-qsave]', when: onMar },
    { sel: medLabels, when: () => onMar() && !!document.querySelector('.pt-verified') },
    { sel: '.tut-label.tut-wrist', when: onMar },
    { sel: '.tb-menu:not([hidden]) a[href$="/mar"]' },
    { sel: DOC_CARET }, { sel: ROW }];

  const TASKS = [
    { id: 'open', title: 'Open your patient',
      how: 'On the <strong>PCS Status Board</strong>, double-click <strong>Morgan, Taylor</strong> (or select the row, then <strong>Open Chart</strong>).',
      show: [{ sel: ROW }, { sel: HOME }],
      done: st => !!st.opened },
    { id: 'safety', title: 'Check allergies and code status',
      how: 'In the chart, find the patient panel with <strong>Special Indicators</strong> and <strong>Allergies</strong> (beside the chart tabs). Then answer:',
      show: [{ sel: '.side .side-sec' }, { sel: '.side' }, { sel: ROW }],
      quiz: [{ name: 'allergy', label: 'Allergy', options: ['No known drug allergies', 'Penicillin', 'Sulfa drugs', 'Latex'], answer: 'Sulfa drugs' },
             { name: 'code', label: 'Code status', options: ['Full Code', 'DNR', 'DNR/DNI'], answer: 'Full Code' }],
      done: st => !!st.quiz.safety },
    { id: 'hgb', title: 'Find the latest hemoglobin (Hgb)',
      how: 'Open the <strong>Diagnostics</strong> tab. Results run from oldest to newest, left to right — use the newest column.',
      show: [{ find: hgbRow }, { sel: `.ftab[href="${chart('results')}"]` }, { sel: ROW }],
      quiz: [{ name: 'hgb', label: 'Latest Hgb (g/dL)', input: true, answer: '11.8' }],
      done: st => !!st.quiz.hgb },
    { id: 'ack', title: 'Acknowledge the new order',
      how: 'Select <strong>Orders</strong> in the toolbar. Find the order marked <strong>NEW</strong> (ambulate in the hallway) and acknowledge it.',
      show: [{ sel: '[data-ack="prac-o-new"]' }, { sel: 'a.tb-btn[href$="/orders"]' }, { sel: ROW }],
      done: (st, p, doc) => Model.isAcked(doc, 'prac-o-new') },
    { id: 'vitals', title: 'Chart a set of vital signs',
      how: 'Select <strong>Document</strong> (the Worklist). Check the <strong>Vital Signs</strong> row, select <strong>Document</strong>, and enter the vital signs you obtained.',
      show: worklistSteps('vitals'),
      done: (st, p, doc) => active(doc, 'vitals').length > 0 },
    { id: 'assess', title: 'Complete a focused assessment',
      how: 'On the Worklist, check <strong>Pain Assessment</strong> (or another assessment), select <strong>Document</strong>, and complete the form.',
      show: worklistSteps('form:pain'),
      done: (st, p, doc) => active(doc, 'assess').length > 0 },
    { id: 'sched', title: 'Give a scheduled medication',
      how: 'Open the <strong>MAR</strong> (Document ▾ → Mar). Tap the <strong>wristband</strong> practice label, then the label for a scheduled medication (ceftriaxone or lisinopril). Select <strong>Save</strong>, review, then <strong>Document</strong>.',
      show: marSteps('.tut-label[data-code="RX-PRAC-LISINOPRIL"], .tut-label[data-code="RX-PRAC-CEFTRIAXONE"]'),
      done: (st, p, doc) => active(doc, 'mar').some(e => SCHEDULED.includes(e.data.medId) && e.data.action === 'Given' && e.data.scan && e.data.scan.patient === 'verified' && e.data.scan.med === 'verified') },
    { id: 'prn', title: 'Give a PRN and document its effectiveness',
      how: 'On the MAR, scan the wristband, then <strong>two acetaminophen 325 mg</strong> labels (they add up to the 650 mg dose). Save and Document. Then select <strong>Reassess</strong> on the acetaminophen row to document how well it worked.',
      show: [{ sel: '[data-effect][data-med="' + PRN + '"]' }].concat(marSteps('.tut-label[data-code="NDC-ACETAMINOPHEN-325MG"]')),
      done: (st, p, doc) => { const m = active(doc, 'mar'); return m.some(e => e.data.medId === PRN && e.data.action === 'Given') && m.some(e => e.data.medId === PRN && e.data.action === 'Effectiveness'); } },
    { id: 'note', title: 'Write a nursing note',
      how: 'Select <strong>Document ▾ → Write Note</strong>. Describe the care you gave, then sign the note.',
      show: [{ sel: '.tb-menu:not([hidden]) [data-docmenu="note"]' }, { sel: DOC_CARET }, { sel: ROW }],
      done: (st, p, doc) => active(doc, 'notes').length > 0 }
  ];

  function status(st) {
    const p = Model.get(PID);
    const doc = Store.doc(PID);
    let changed = false;
    const list = TASKS.map(t => {
      // A task stays done once done (also when progress was restored from the LMS on another device).
      const ok = !!st.doneAt[t.id] || !!t.done(st, p, doc);
      if (ok && !st.doneAt[t.id]) { st.doneAt[t.id] = Date.now(); changed = true; }
      return { t, ok };
    });
    if (changed) save(st);
    return list;
  }

  /* ---------- Panel ---------- */
  function root() {
    let el = document.getElementById('tut-root');
    if (!el) { el = document.createElement('div'); el.id = 'tut-root'; document.body.appendChild(el); }
    return el;
  }

  function quizHtml(t) {
    return `<form class="tut-quiz" data-quiz="${t.id}">${t.quiz.map(q => q.input
      ? `<label class="field"><span>${esc(q.label)}</span><input name="${q.name}" inputmode="decimal" autocomplete="off"></label>`
      : `<label class="field"><span>${esc(q.label)}</span><select name="${q.name}"><option value="">— choose —</option>${q.options.map(o => `<option>${esc(o)}</option>`).join('')}</select></label>`).join('')}
      <button type="submit" class="btn btn-sm btn-primary">Check answer</button><div class="tut-msg" aria-live="polite"></div></form>`;
  }

  function render() {
    const el = root();
    const s = Store.session();
    if (!s) { el.innerHTML = ''; document.body.classList.remove('tut-open'); return; }
    const st = load();
    if (App.current && App.current.id === PID && !st.opened) { st.opened = Date.now(); save(st); }
    const list = status(st);
    const n = list.filter(x => x.ok).length;
    report(st, n);
    const current = list.find(x => !x.ok);
    // The open panel takes its own space beside (or below) the EHR so it never covers a button.
    document.body.classList.toggle('tut-open', !st.collapsed);
    if (st.collapsed) {
      el.innerHTML = `<button type="button" class="tut-pill" data-tut="expand" aria-label="Show orientation tasks">🎓 Orientation ${n}/${TASKS.length}</button>`;
    } else {
      el.innerHTML = `<aside class="tut" aria-label="EMR orientation tasks">
        <div class="tut-h"><strong>🎓 EMR Orientation</strong><span class="tut-count">${n} of ${TASKS.length} done</span>
          <button type="button" class="tut-min" data-tut="collapse" aria-label="Hide orientation tasks">–</button></div>
        <div class="tut-bar"><span style="width:${Math.round(100 * n / TASKS.length)}%"></span></div>
        <ol class="tut-list">${list.map(({ t, ok }) => {
          const cur = current && current.t === t;
          return `<li class="${ok ? 'tut-done' : cur ? 'tut-cur' : ''}"><div class="tut-t"><span class="tut-mark" aria-hidden="true">${ok ? '✔' : ''}</span>${esc(t.title)}</div>
            ${cur ? `<div class="tut-how">${t.how}</div>${t.quiz ? quizHtml(t) : ''}<button type="button" class="btn btn-sm tut-show" data-show="${t.id}">👀 Show me</button>` : ''}</li>`;
        }).join('')}</ol>
        ${current ? '' : `<div class="tut-complete"><strong>Orientation complete!</strong> You are ready to chart in simulation.${inLMS() ? ' Your completion has been recorded in Blackboard.' : '<button type="button" class="btn btn-primary btn-block" data-tut="summary">Print completion summary</button>'}</div>`}
        <div class="tut-foot"><button type="button" class="tut-link" data-tut="summary">Progress summary</button><button type="button" class="tut-link" data-tut="reset">Start over</button></div>
      </aside>`;
    }
    bind(el, st);
  }

  function bind(el, st) {
    const on = (sel, fn) => el.querySelectorAll(sel).forEach(b => b.addEventListener('click', fn));
    on('[data-tut="collapse"]', () => { st.collapsed = true; save(st); render(); });
    on('[data-tut="expand"]', () => { st.collapsed = false; save(st); render(); });
    on('[data-tut="summary"]', () => summary());
    on('[data-tut="reset"]', () => UI.confirm('Start Over', 'Erase your practice charting on Morgan, Taylor and start the orientation tasks again?', () => {
      Store.saveDoc(PID, {});
      Store.restartScenario(PID);
      try { localStorage.removeItem(key()); } catch (e) { /* ignore */ }
      // Clear the saved progress in the LMS too (a completion already recorded there is kept).
      lmsSaved = null; lmsSent = '';
      if (window.LMS && LMS.available) LMS.progress(0, TASKS.length, { quiz: {}, doneAt: {}, opened: null });
      location.hash = '#/census';
      App.render();
    }, 'Start Over'));
    // stopPropagation keeps an open toolbar menu (Document ▾) open so its item can be highlighted.
    on('[data-show]', e => { e.stopPropagation(); showMe(TASKS.find(t => t.id === e.currentTarget.dataset.show)); });
    el.querySelectorAll('[data-quiz]').forEach(f => f.addEventListener('submit', e => {
      e.preventDefault();
      const t = TASKS.find(x => x.id === f.dataset.quiz);
      const v = U.formValues(f);
      const wrong = t.quiz.filter(q => String(v[q.name] || '').trim().replace(/\s+/g, ' ').toLowerCase() !== q.answer.toLowerCase());
      const msg = f.querySelector('.tut-msg');
      if (wrong.length) { msg.className = 'tut-msg bad'; msg.textContent = `Not quite — check ${wrong.map(q => q.label.toLowerCase()).join(' and ')} in the chart and try again.`; return; }
      st.quiz[t.id] = true; save(st);
      UI.toast('Correct!');
      render();
    }));
  }

  function showMe(t) {
    const visible = el => el.offsetParent !== null || el.getClientRects().length > 0;
    let els = [];
    for (const step of t.show) {
      if (step.when && !step.when()) continue;
      els = (step.find ? step.find() : Array.from(document.querySelectorAll(step.sel))).filter(Boolean).filter(visible);
      if (els.length) break;
    }
    if (!els.length) { UI.toast('Read the step above for where to start. Return To takes you back to the status board.', 'info'); return; }
    els.forEach(x => x.classList.add('tut-glow'));
    els[0].scrollIntoView({ block: 'center' });
    setTimeout(() => els.forEach(x => x.classList.remove('tut-glow')), 4500);
  }

  /* ---------- Practice labels on the MAR (tap = scan) ---------- */
  function practiceLabels(app) {
    const bar = app.querySelector('.mg-scanbar');
    if (!bar || !App.current) return;
    const p = App.current;
    const labels = [{ code: String(p.mrn), text: `Wristband — ${p.name.last.toUpperCase()}, ${p.name.first}`, cls: 'tut-wrist' }];
    p.meds.filter(m => m.status === 'Active').forEach(m => {
      labels.push({ code: Model.barcodeFor(m), text: `${m.name} ${m.dose} — pharmacy label` });
      // Oral and other unit-dose meds also get single-unit labels (e.g., 2 × 325 mg); IV meds only the pharmacy label.
      if (m.type !== 'continuous' && !/\bIV/i.test(m.route)) Scan.products(m).forEach(d => labels.push({ code: Scan.productCode(m, d), text: `${m.name.split(/\s+\(|\s+—/)[0]} ${Scan.fmt(d)} — 1 unit` }));
    });
    bar.insertAdjacentHTML('afterend', `<div class="tut-labels" role="group" aria-label="Practice labels">
      <div class="tut-labels-h">🏷 Practice labels — tap a label to scan it (wristband first)</div>
      ${labels.map(l => `<button type="button" class="tut-label ${l.cls || ''}" data-code="${esc(l.code)}"><span class="tut-bars" aria-hidden="true"></span>${esc(l.text)}</button>`).join('')}</div>`);
    app.querySelectorAll('.tut-label').forEach(b => b.addEventListener('click', () => {
      if (Screens.mode() === 'observer') { UI.toast('Observer mode is view only. You cannot document.', 'warn'); return; }
      Views.mar.scan(Model.get(p.id), b.dataset.code);
    }));
  }

  /* ---------- Completion summary (printable) ---------- */
  function summary() {
    const s = Store.session() || {};
    const st = load();
    const list = status(st);
    const n = list.filter(x => x.ok).length;
    const rows = list.map(({ t, ok }) => `<tr><td>${ok ? '✔' : '—'}</td><td>${esc(t.title)}</td><td>${ok && st.doneAt[t.id] ? esc(new Date(st.doneAt[t.id]).toLocaleString('en-US')) : 'Not done'}</td></tr>`).join('');
    const html = `<h2 style="margin:0 0 4px">EMR Orientation — ${n === TASKS.length ? 'Completed' : 'Progress'}</h2>
      <p style="margin:0 0 10px">${esc(C.hospitalName)} · Practice patient: Morgan, Taylor (MRN ORIENT-001)</p>
      <p><strong>Student:</strong> ${esc(s.name || '')}${s.cred ? ', ' + esc(s.cred) : ''}${s.group ? ` · <strong>Group:</strong> ${esc(s.group)}` : ''}<br><strong>Printed:</strong> ${esc(new Date().toLocaleString('en-US'))}<br><strong>Tasks completed:</strong> ${n} of ${TASKS.length}</p>
      <table class="grid"><thead><tr><th></th><th>Task</th><th>Completed</th></tr></thead><tbody>${rows}</tbody></table>`;
    UI.modal({
      title: 'Orientation Summary', wide: true, body: `<div class="tut-summary">${html}</div>`,
      // In Blackboard (SCORM) completion is graded automatically, so there is nothing to print.
      buttons: inLMS() ? [{ label: 'Close' }] : [{ label: 'Close' }, { label: 'Print', cls: 'btn-primary', onClick: () => {
        const w = window.open('', '_blank');
        if (!w) { window.print(); return false; }
        w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>EMR Orientation Summary</title><style>body{font:14px Arial,sans-serif;margin:32px;color:#111}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:6px 8px;text-align:left}th{background:#eee}</style></head><body>${html}<p style="margin-top:28px">Faculty initials: ____________ &nbsp; Date: ____________</p></body></html>`);
        w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
        return false;
      } }]
    });
  }

  window.Tutorial = {
    afterRender(app) {
      // In an LMS, fill in the student's name on the sign-in screen.
      const nameIn = !Store.session() && app.querySelector('.login-card input[name="name"]');
      if (nameIn && !nameIn.value && window.LMS && LMS.available) nameIn.value = LMS.studentName();
      if (location.hash.indexOf(`#/patient/${PID}/mar`) === 0) practiceLabels(app);
      render();
    },
    tasks: TASKS
  };
})();
