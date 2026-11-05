/*
 * Search Patient's Chart (right-hand column of the chart). Cross-references every part of the
 * chart: problems and history, allergies, orders, medications, results, imaging, provider and
 * nursing notes, documents, vital signs, administrative data, and everything the student has
 * documented. A search opens the chart tab with the most matches (no pop-up), highlights them, and
 * shows a strip linking to every other tab that matches.
 */
(function () {
  'use strict';
  const esc = U.esc;
  const SKIP = { id: 1, images: 1, image: 1, files: 1, at: 1, day: 1, md: 0 };

  // All text inside a value (strings and numbers, nested arrays and objects).
  function flat(v) {
    if (v == null || v === false) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (Array.isArray(v)) return v.map(flat).filter(Boolean).join(' · ');
    if (typeof v === 'object') return Object.keys(v).filter(k => !SKIP[k]).map(k => flat(v[k])).filter(Boolean).join(' · ');
    return '';
  }

  function index(p, doc) {
    const out = [];
    // Markdown marks (**bold**, # headings, > callouts) are dropped so snippets read as plain text.
    const plain = x => flat(x).replace(/\*\*|__|^#+\s*|^>\s*/gm, '').replace(/\s+/g, ' ').trim();
    const add = (section, tab, title, time, text) => { const t = plain(text); if (t || title) out.push({ section, tab, title: plain(title), time, text: t }); };

    add('Problems', 'history', 'Reason for visit', p.admitTime, [p.admitDx, p.chiefComplaint]);
    (p.pmh || []).forEach(x => add('Problems', 'history', 'Medical history', null, x));
    (p.psh || []).forEach(x => add('History', 'history', 'Surgical history', null, x));
    (p.familyHx || []).forEach(x => add('History', 'history', 'Family history', null, x));
    (p.socialHx || []).forEach(x => add('History', 'history', 'Social history', null, x));
    if (p.hpi) add('History', 'history', 'History of present illness', null, p.hpi);
    if (p.nkda || !(p.allergies || []).length) add('Allergies', 'summary', 'No Known Drug Allergies', null, 'NKDA no known allergies');
    (p.allergies || []).forEach(a => add('Allergies', 'summary', a.agent, null, a));
    (p.flags || []).forEach(f => add('Special Indicators', 'summary', f, null, ''));
    add('Special Indicators', 'summary', 'Code status: ' + p.codeStatus, null, [p.advanceDirective, p.isolation ? 'Isolation: ' + p.isolation : '']);
    (p.homeMeds || []).forEach(m => add('Home Medications', 'meds', m.name, null, m));
    p.orders.forEach(o => add('Orders', 'orders', o.text, o.time, [o.cat, o.priority, o.by, o.detail, o.instructions]));
    p.meds.forEach(m => add('Medications', 'meds', Model.medLabel(m), m.orderTime, [m.status, m.indication, m.instructions, m.holdReason, m.orderedBy]));
    // Diagnostics results carry the sub-tab they show on (Laboratory, Microbiology, Blood Bank Tests, Imaging, Cardiovascular).
    const labSub = r => /culture|gram stain|sensitivit/i.test(r.t) ? 'Microbiology' : /ABO|blood type|antibod|crossmatch/i.test(r.t) ? 'Blood Bank Tests' : 'Laboratory';
    p.labs.forEach(l => (l.results || []).forEach(r => { add('Lab Results', 'results', l.panel, l.time, `${r.t} ${r.v}${r.u ? ' ' + r.u : ''}${Model.labFlag(r) ? ' ' + Model.labFlag(r) : ''}`); out[out.length - 1].sub = labSub(r); }));
    if (p.labsPending) add('Lab Results', 'results', 'Pending', null, p.labsPending);
    p.imaging.forEach(r => { add('Imaging', 'results', r.study, r.time, [r.text, r.findings, r.impression, r.report]); out[out.length - 1].sub = /ECG|EKG|echo|telemetry|cardiac/i.test(r.study) ? 'Cardiovascular' : 'Imaging'; });
    p.notes.forEach(n => add(Views.isProviderNote(n) ? 'Provider Notes' : 'Nursing Notes', Views.isProviderNote(n) ? 'provnotes' : 'notes', `${n.type || 'Note'} — ${n.author || ''}`, n.time, n.text));
    (p.documents || []).forEach(d => add('Documents', 'documents', d.title, d.time, [d.category, d.md, d.text]));
    (p.vitalsPrior || []).forEach(v => add('Vital Signs', 'vitals', 'Vital signs', v.time, vitalText(v)));
    add('Administrative', 'admin', 'Patient information', null, [p.mrn, p.unit, p.room, p.attending, p.service, p.emergencyContact, p.demographics, p.insurance]);

    // The student's own documentation.
    const active = sec => (doc[sec] || []).filter(e => e.status === 'active');
    active('notes').forEach(e => add('Nursing Notes', 'notes', `${e.data.type || 'Note'} — ${e.user.name}`, e.time, e.data));
    active('assess').forEach(e => add('Assessments', 'assess', `${e.data.form || e.data.title || 'Assessment'} — ${e.user.name}`, e.time, e.data));
    active('vitals').forEach(e => add('Vital Signs', 'vitals', `Vital signs — ${e.user.name}`, e.time, vitalText(e.data)));
    active('mar').forEach(e => add('Medication Administration', 'meds', `${e.data.medName} — ${e.data.action}`, e.time, [e.data.dose, e.data.rate, e.data.route, e.data.site, e.data.reason, e.data.comment, e.user.name]));
    active('io').forEach(e => add('Intake & Output', 'io', 'Intake & output', e.time, e.data));
    active('careplan').forEach(e => add('Plan of Care', 'careplan', 'Plan of care', e.time, e.data));
    active('tar').forEach(e => add('Transfusion', 'tar', 'Transfusion record', e.time, e.data));
    active('orders').filter(e => !e.data.kind || e.data.kind === 'faculty').forEach(e => add('Orders', 'orders', e.data.text, e.time, [e.data.cat, e.data.provider]));
    return out;
  }

  function vitalText(v) {
    return [v.temp != null && `Temp ${v.temp}`, v.hr != null && `Pulse ${v.hr}`, v.rr != null && `Resp ${v.rr}`,
      v.sbp != null && `BP ${v.sbp}/${v.dbp}`, v.spo2 != null && `O2 Sat ${v.spo2}%`, v.o2 && `${v.o2}${v.o2Flow ? ' ' + v.o2Flow + ' L' : ''}`,
      v.pain != null && `Pain ${v.pain}`, v.by].filter(Boolean).join(' · ');
  }

  // Common clinical abbreviations, so "hemoglobin" also finds "Hgb" and "bp" finds "blood pressure".
  const SYN = [['hemoglobin', 'hgb'], ['hematocrit', 'hct'], ['potassium', 'k'], ['sodium', 'na'], ['chloride', 'cl'], ['magnesium', 'mg'],
    ['white blood', 'wbc'], ['platelet', 'plt'], ['blood urea', 'bun'], ['creatinine', 'creat'], ['glucose', 'bg'], ['troponin', 'trop'],
    ['blood pressure', 'bp'], ['pulse', 'hr'], ['heart rate', 'hr'], ['respirat', 'rr'], ['temperature', 'temp'], ['oxygen', 'o2'], ['saturation', 'spo2'],
    ['norepinephrine', 'levophed'], ['acetaminophen', 'tylenol'], ['piperacillin', 'zosyn'], ['enoxaparin', 'lovenox'], ['heparin', 'hep'],
    ['nothing by mouth', 'npo'], ['do not resuscitate', 'dnr'], ['history', 'hx'], ['diagnosis', 'dx']];
  const alts = w => { const out = [w]; SYN.forEach(([a, b]) => { if (w === a || a.startsWith(w) && w.length > 3) out.push(b); if (w === b) out.push(a); }); return out; };
  // Whole-word test for very short terms (k, na, hr) so they don't match inside other words.
  const has = (hay, t) => t.length <= 3 ? new RegExp('(^|[^a-z0-9])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(hay) : hay.includes(t);

  // Chart tabs in the order to prefer when several have the same number of matches.
  const PRIORITY = ['results', 'meds', 'orders', 'provnotes', 'notes', 'history', 'summary', 'vitals', 'assess', 'io', 'careplan', 'admin', 'documents', 'tar'];
  const NOTE_TABS = ['provnotes', 'notes', 'documents'];
  const tabLabel = t => (Views[t] && Views[t].label) || t;
  let active = null;   // { pid, q, hl, tabs: [{ tab, n }], scroll }

  // Chart sections by name: searching for a section ("vital signs", "labs", "demographics") opens that section
  // itself, not the first note that mentions it. Matched against the whole search, ignoring case and spacing.
  const PLACES = [
    { tab: 'vitals', name: 'Vital Signs flowsheet', words: ['vital signs', 'vital sign', 'vitals', 'vs', 'v/s', 'flowsheet', 'flowsheets', 'flow sheet', 'vital signs flowsheet', 'blood pressure', 'bp', 'pulse', 'heart rate', 'temperature', 'temp', 'respirations', 'respiratory rate', 'resp rate', 'spo2', 'o2 sat', 'oxygen saturation', 'pulse ox', 'pain score'] },
    { tab: 'results', sub: 'Laboratory', name: 'Diagnostics → Laboratory', words: ['lab', 'labs', 'laboratory', 'lab results', 'labs results', 'lab values', 'results', 'diagnostics', 'bloodwork', 'blood work'] },
    { tab: 'results', sub: 'Imaging', name: 'Diagnostics → Imaging', words: ['imaging', 'radiology', 'x-ray', 'xray', 'x ray', 'chest x-ray', 'cxr', 'ct', 'ct scan', 'mri', 'ultrasound', 'scans'] },
    { tab: 'results', sub: 'Microbiology', name: 'Diagnostics → Microbiology', words: ['micro', 'microbiology', 'culture', 'cultures', 'blood culture', 'blood cultures', 'urine culture'] },
    { tab: 'results', sub: 'Blood Bank Tests', name: 'Diagnostics → Blood Bank Tests', words: ['blood bank', 'blood type', 'type and cross', 'type and screen', 'crossmatch'] },
    { tab: 'results', sub: 'Cardiovascular', name: 'Diagnostics → Cardiovascular', words: ['cardiovascular', 'ecg', 'ekg', '12 lead', '12-lead', 'echo', 'echocardiogram', 'telemetry'] },
    { tab: 'admin', name: 'Administrative', words: ['demographics', 'demographic', 'contact', 'contacts', 'emergency contact', 'next of kin', 'nok', 'family contact', 'insurance', 'address', 'phone', 'administrative', 'admin', 'registration', 'encounter', 'language', 'religion'] },
    { tab: 'history', name: 'History & Problems', words: ['history', 'problems', 'problem list', 'pmh', 'past medical history', 'medical history', 'psh', 'surgical history', 'family history', 'social history', 'home meds', 'home medications', 'hpi', 'history of present illness', 'ros', 'review of systems', 'immunizations'] },
    { tab: 'summary', name: 'Summary (allergies are in the right-hand column)', words: ['allergies', 'allergy', 'nkda'] },
    { tab: 'summary', name: 'Summary', words: ['summary', 'patient summary', 'overview'] },
    { tab: 'orders', name: 'Orders', words: ['orders', 'order', 'provider orders', 'current orders'] },
    { tab: 'mar', name: 'MAR', words: ['mar', 'emar', 'medication administration', 'medication administration record'] },
    { tab: 'meds', name: 'Medications', words: ['medications', 'medication', 'meds', 'med list', 'medication list', 'drugs'] },
    { tab: 'tar', name: 'Transfusion Administration Record', words: ['tar', 'transfusion', 'transfusions', 'blood transfusion', 'transfusion record', 'blood administration'] },
    { tab: 'worklist', name: 'Worklist', words: ['worklist', 'work list', 'tasks', 'interventions', 'due'] },
    { tab: 'notes', name: 'Nursing Notes', words: ['notes', 'nursing notes', 'nurse notes', 'nursing note', 'handoff', 'sbar', 'i-pass', 'ipass'] },
    { tab: 'provnotes', name: 'Provider Notes', words: ['provider notes', 'provider note', 'progress notes', 'progress note', 'physician notes', 'doctor notes', 'md notes', 'h&p', 'h and p', 'history and physical', 'consult', 'consults', 'op note', 'operative note'] },
    { tab: 'assess', name: 'Assessments', words: ['assessment', 'assessments', 'head to toe', 'head-to-toe', 'shift assessment', 'pain assessment', 'braden', 'morse', 'fall risk', 'gcs', 'glasgow'] },
    { tab: 'io', name: 'Intake & Output', words: ['i&o', 'i & o', 'i and o', 'i/o', 'io', 'intake', 'output', 'intake and output', 'intake & output', 'urine output'] },
    { tab: 'careplan', name: 'Care Plan', words: ['care plan', 'careplan', 'plan of care', 'poc', 'nursing care plan', 'goals'] },
    { tab: 'documents', name: 'Documents', words: ['documents', 'document', 'consent', 'consents', 'forms', 'prenatal record'] },
    { tab: 'activity', name: 'Activity', words: ['activity', 'activity log'] },
    { tab: 'report', name: 'Chart Report', words: ['report', 'chart report', 'print chart'] },
    { tab: 'heparin', name: 'Heparin Flowsheet', words: ['heparin flowsheet', 'heparin protocol', 'aptt', 'ptt'], when: p => p.heparinFlowsheet },
    { tab: 'newborn', name: 'Newborn', words: ['newborn', 'newborn documentation', 'transitional record', 'baby'], when: p => p.nbPair }
  ];
  const norm = s => s.toLowerCase().replace(/\s+/g, ' ').replace(/^(the|open|go to|show)\s+/, '').replace(/\s+(tab|section|screen|page)$/, '').trim();
  const placeFor = (p, q) => { const n = norm(q); return PLACES.find(x => (!x.when || x.when(p)) && x.words.includes(n)) || null; };

  // Search, then open the chart tab with the most matches (no pop-up). The matches are highlighted
  // there, and a strip at the top of the screen links to every other tab that matches.
  function run(p, query) {
    const q = String(query || '').trim();
    if (!q) { active = null; App.render(); return; }
    // A section name opens that section; other places that mention the words are offered in the strip.
    const place = placeFor(p, q);
    if (place) {
      if (place.sub && Views.results.show) Views.results.show(place.sub);
      active = { pid: p.id, q, hl: [], tabs: [], scroll: false, tried: [place.tab], place };
      const target = `#/patient/${p.id}/${place.tab}`;
      if (location.hash === target) App.render(); else location.hash = target;
      return;
    }
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = index(p, Store.doc(p.id)).filter(e => { const hay = (e.title + ' ' + e.text).toLowerCase(); return words.every(w => alts(w).some(t => has(hay, t))); });
    if (!hits.length) { active = null; UI.toast(`Nothing in this chart matches “${q}”. Try a drug name, lab test, or diagnosis.`, 'info'); App.render(); return; }
    const count = {};
    hits.forEach(h => { count[h.tab] = (count[h.tab] || 0) + 1; });
    const tabs = Object.keys(count).map(tab => ({ tab, n: count[tab] }))
      // Chart data (results, medications, orders, flowsheets) before notes and documents that mention it.
      .sort((a, b) => NOTE_TABS.includes(a.tab) - NOTE_TABS.includes(b.tab) || b.n - a.n || PRIORITY.indexOf(a.tab) - PRIORITY.indexOf(b.tab));
    const hl = Array.from(new Set(words.flatMap(alts))).filter(t => t.length > 2 || words.includes(t));
    active = { pid: p.id, q, hl, tabs, scroll: true, tried: [tabs[0].tab] };
    const dx = hits.find(h => h.tab === 'results' && h.sub);
    if (dx && Views.results.show) Views.results.show(dx.sub);
    const target = `#/patient/${p.id}/${tabs[0].tab}`;
    if (location.hash === target) App.render(); else location.hash = target;
  }

  // Wrap each match on the current screen in <mark>.
  function highlight(root, terms) {
    if (!terms.length) return [];
    const re = new RegExp(terms.map(t => { const e = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return t.length <= 3 ? `\\b${e}\\b` : e; }).join('|'), 'gi');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n =>
      !n.nodeValue.trim() || n.parentNode.closest('script, style, textarea, input, select, option, .cs-strip, mark') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    const marks = [];
    nodes.forEach(n => {
      const text = n.nodeValue;
      re.lastIndex = 0;
      if (!re.test(text)) return;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      text.replace(re, (m, off) => {
        frag.appendChild(document.createTextNode(text.slice(last, off)));
        const mk = document.createElement('mark'); mk.className = 'cs-mark'; mk.textContent = m; frag.appendChild(mk); marks.push(mk);
        last = off + m.length;
        return m;
      });
      frag.appendChild(document.createTextNode(text.slice(last)));
      n.parentNode.replaceChild(frag, n);
    });
    return marks;
  }

  // After each chart render: the results strip, highlights, and the search box keeps the term.
  function decorate(app, p) {
    if (!active) return;
    if (active.pid !== p.id) { active = null; return; }   // another patient: the search ends
    const content = app.querySelector('#content');
    if (!content) return;
    const cur = (location.hash.split('/')[3] || 'summary');
    const input = app.querySelector('.side-search input');
    if (input) input.value = active.q;
    if (active.place) {
      if (cur !== active.place.tab) { active = null; return; }   // moved on: the search ends
      content.insertAdjacentHTML('afterbegin', `<div class="cs-strip" role="status"><span>🔍 <strong>“${esc(active.q)}”</strong> — opened <strong>${esc(active.place.name)}</strong></span>
        <button type="button" class="cs-clear" aria-label="Clear search">✕</button></div>`);
      content.querySelector('.cs-clear').addEventListener('click', () => { active = null; App.render(); });
      return;
    }
    const marks = highlight(content, active.hl);
    // Just searched and nothing visible here (e.g., a match in a field this screen doesn't show):
    // move on to the next matching tab until one shows the match.
    if (active.scroll && !marks.length) {
      const next = active.tabs.find(t => !active.tried.includes(t.tab));
      if (next) { active.tried.push(next.tab); location.hash = `#/patient/${p.id}/${next.tab}`; return; }
      active.scroll = false;
    }
    content.insertAdjacentHTML('afterbegin', `<div class="cs-strip" role="status"><span>🔍 <strong>“${esc(active.q)}”</strong> found in:</span>
      ${active.tabs.map(t => `<a class="cs-chip ${t.tab === cur ? 'on' : ''}" href="#/patient/${esc(p.id)}/${esc(t.tab)}">${esc(tabLabel(t.tab))} (${t.n})</a>`).join('')}
      ${marks.length ? `<span class="muted small">${marks.length} highlighted on this screen</span>` : '<span class="muted small">Not shown on this screen — try another tab.</span>'}
      <button type="button" class="cs-clear" aria-label="Clear search">✕</button></div>`);
    content.querySelector('.cs-clear').addEventListener('click', () => { active = null; App.render(); });
    if (active.scroll && marks.length) {
      active.scroll = false;
      const r = marks[0].getBoundingClientRect();
      if (r.top < 120 || r.bottom > window.innerHeight - 20) marks[0].scrollIntoView({ block: 'center' });   // only when off-screen
    }
  }

  Views.chartSearch = { index, run, decorate, clear: () => { active = null; } };
})();
