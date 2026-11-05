/*
 * Newborn Transitional Record — ONE shared record for a mother/baby pair (Amelia Sung and Baby Boy Sung).
 * It shows at the top of the Assessments view on both charts; saving from either chart updates both.
 *
 * Storage: each save adds exactly one assessment entry on the BABY's chart (p.nbPair.chart), so the existing
 * shared-chart sync, export, and backups carry it:
 *   { formId: 'newborn-transition', v: 2, values: { <field label>: value, ... only the fields that changed },
 *     epochs: { <mother id>: n, <baby id>: n }, from: <chart it was entered from>, shift }
 * A row counts only while its epochs match both patients' current reset epochs (Store.epoch), so resetting
 * EITHER patient clears the record on both charts, and a late save from a device still on the previous group
 * never appears. The record = the prefilled baseline (code, below) + every counted row in save order; the
 * latest save of a field wins, including a cleared field ('').
 * Medications section: documents what was done. It does not give medications and does not read from or write
 * to the MAR.
 */
(function () {
  'use strict';
  const esc = U.esc;
  const FORM_ID = 'newborn-transition';
  window.Views = window.Views || {};

  /* ---------- the pairing (one place; another mother/baby pair only needs p.nbPair in the data) ---------- */
  const pairOf = p => (p && p.nbPair) || null;
  const transitionalPatients = p => { const c = pairOf(p); return c ? [c.deliveryPid, c.chart] : []; };
  const babyId = p => pairOf(p).chart;
  const currentEpochs = p => { const out = {}; transitionalPatients(p).forEach(id => { out[id] = Store.epoch(id); }); return out; };
  const sameEpochs = (a, b) => !!a && Object.keys(b).every(k => Number(a[k]) === Number(b[k]));
  const isOpen = p => !!(Views.newborn && Views.newborn.isOpen && Views.newborn.isOpen(p));

  /* ---------- fields: each label is the key saved in values ---------- */
  const S = (k, options) => ({ k, options });            // dropdown (one choice)
  const T = k => ({ k });                                  // text
  const A = k => ({ k, area: true });                      // textarea
  const YN = ['Y', 'N'], PM = ['+', '−'];
  const VS_ROWS = ['Time', 'Axillary temp', 'Heart rate', 'Resp rate', 'O₂ sats', 'BP R arm', 'BP R leg', 'S/S distress', 'Other', 'Initials'];
  const VS_COLS = 6;
  const SECTIONS = [
    { title: 'Maternal History', fields: [
      S('GBS', ['Pos', 'Neg']), T('Antibiotic'), T('Antibiotic times'),
      S('Rubella', ['Immune', 'Nonimmune', 'Equivocal']), S('Hep B', PM), S('VDRL', PM), S('HIV', PM),
      S('Chlamydia history', YN), S('Chlamydia treated', YN), S('Herpes history', YN), S('Herpes treated', YN),
      S('Gonorrhea history', YN), S('Gonorrhea treated', YN),
      S('Diabetes history', YN), S('Diabetes controlled', ['Diet', 'Insulin']),
      S('PIH history', YN), S('Magnesium', YN),
      S('Smoker', YN), T('Cigs/day'),
      S('Illegal drug use', YN), T('Substance'), T('Urine collected'), T('Cord collected'),
      T('Gravida'), T('Para'), T('EDC'), T('Blood type'),
      T('Rupture of membranes date'), T('Rupture of membranes time'),
      S('Anesthesia', ['Epidural', 'Spinal', 'General']), S('Feeding preference', ['Breast', 'Bottle', 'Both']), A('Other')] },
    { title: 'Infant', fields: [
      T('Band #'), T('Physician OB'), T('Physician Ped'), T('Date of birth'), T('Time of birth'),
      S('Sex', ['Male', 'Female']), S('Delivery', ['Vaginal', 'C-section']), T('C/S reason'),
      S('Presentation', ['Ceph', 'Breech']), S('Use of', ['Forceps', 'Vacuum', 'N/A']), S('Meconium delivery', YN),
      T('Apgar 1 min'), T('Apgar 5 min'), T('Apgar 10 min'),
      S('Output void', YN), S('Output stool', YN), T('Output DeLee mL'), S('Output N/A', ['N/A']),
      T('Cord blood sent'), T('Cord blood time'), T('Cord blood ordered'), S('Cord blood N/A', ['N/A']),
      T('Lab time'), T('Lab Hct'), T('Lab Hgb'), T('Lab Gluc'), S('Lab N/A', ['N/A']),
      T('Gestational age by dates'), T('Gestational age by exam'), S('Gestational age size', ['AGA', 'LGA', 'SGA']),
      T('Weight g'), T('Weight lb'), T('Weight oz'),
      T('Length cm'), T('Length in'), T('Head circ cm'), T('Head circ in'),
      T('Chest circ cm'), T('Chest circ in'), T('Abd circ cm'), T('Abd circ in'),
      T('Bath'), T('Security tag'),
      T('Feeding breast R min'), T('Feeding breast L min'), T('Feeding bottle mL'),
      A('Abnormal findings')] },
    { title: 'Medications', note: 'Documents what was done. Medications are given and charted on the MAR; this section does not change the MAR.', fields: [
      T('Erythromycin 0.5 mL both eyes time'), S('Erythromycin declined', YN),
      S('AquaMephyton IM dose', ['1 mg (>1500 g)', '0.5 mg (<1500 g)']), T('AquaMephyton time'), T('AquaMephyton site'), S('AquaMephyton declined', YN),
      S('Hep B vaccine consent signed', YN), T('Hep B vaccine lot #'), T('Hep B vaccine time'), T('Hep B vaccine site'), S('Hep B vaccine declined', YN),
      T('HBIG 0.5 mL IM time'), T('HBIG site'), S('HBIG N/A', ['N/A'])] },
    { title: 'Vital Signs', grid: true,
      fields: Array.from({ length: VS_COLS }, (_, i) => VS_ROWS.map(r => T(`VS${i + 1} ${r}`))).flat().concat([T('Nurse signature')]) }
  ];
  const FIELDS = SECTIONS.flatMap(s => s.fields);
  const KEYS = FIELDS.map(f => f.k);

  // Prefilled baseline (code, not saved rows): students may change these; reset restores them.
  const SUNG_TRANSITIONAL_BASELINE = {
    'GBS': 'Pos', 'Antibiotic': 'Clindamycin 900 mg IVPB', 'Rubella': 'Immune', 'Hep B': '−', 'VDRL': '−', 'HIV': '−',
    'Chlamydia history': 'N', 'Herpes history': 'N', 'Gonorrhea history': 'N', 'Diabetes history': 'Y', 'Diabetes controlled': 'Diet',
    'Smoker': 'N', 'Illegal drug use': 'N', 'Gravida': '2', 'Para': '1', 'Blood type': 'O+', 'Rupture of membranes time': '0300',
    'Anesthesia': 'Epidural', 'Feeding preference': 'Breast', 'Band #': '31539', 'Physician OB': 'Dr. Darnell', 'Physician Ped': 'Dr. Craig'
  };
  // Dates come from the scenario day: EDC = 7 days from now; rupture of membranes = scenario day.
  function baseline(p) {
    const day = new Date(Model.get(babyId(p)).clock.simStart);
    const fmt = d => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
    const edc = new Date(day); edc.setDate(edc.getDate() + 7);
    return Object.assign({}, SUNG_TRANSITIONAL_BASELINE, { 'EDC': fmt(edc), 'Rupture of membranes date': fmt(day) });
  }

  /* ---------- reading ---------- */
  function transitionalEntries(p) {
    const ep = currentEpochs(p);
    return Store.doc(babyId(p)).assess
      .filter(e => e.status === 'active' && e.data.formId === FORM_ID && e.data.v === 2 && sameEpochs(e.data.epochs, ep))
      .sort((a, b) => (a.recorded || 0) - (b.recorded || 0) || String(a.id).localeCompare(String(b.id)));
  }
  function transitionalValues(p) {
    const out = baseline(p);
    transitionalEntries(p).forEach(e => Object.keys(e.data.values || {}).forEach(k => { out[k] = e.data.values[k]; }));
    return out;
  }
  // A row on the baby's chart from an earlier group (old epochs): hidden everywhere.
  const visible = (p, e) => e.data.formId !== FORM_ID || e.data.v !== 2 || !pairOf(p) || sameEpochs(e.data.epochs, currentEpochs(p));

  /* ---------- unsaved typing: one draft for both charts, tied to the current epochs ---------- */
  const draftKey = p => `${window.EHR_CONFIG.storagePrefix}.trdraft.${transitionalPatients(p).join('+')}`;
  function readDraft(p) {
    try { const d = JSON.parse(localStorage.getItem(draftKey(p)) || 'null'); return d && sameEpochs(d.epochs, currentEpochs(p)) ? d.edits || {} : {}; }
    catch (e) { return {}; }
  }
  function writeDraft(p, edits) {
    try { Object.keys(edits).length ? localStorage.setItem(draftKey(p), JSON.stringify({ epochs: currentEpochs(p), edits })) : localStorage.removeItem(draftKey(p)); }
    catch (e) { /* ignore */ }
  }

  /* ---------- the form ---------- */
  const chartName = pid => { const b = Model.base(pid); return b ? `${b.name.first} ${b.name.last}` : pid; };
  function input(f, val) {
    const name = esc(f.k);
    if (f.options) return `<label class="field tr2-f"><span>${esc(f.k)}</span><select name="${name}" data-open="${esc(val)}">${UI.options(f.options, val)}</select></label>`;
    if (f.area) return `<label class="field wide tr2-f"><span>${esc(f.k)}</span><textarea name="${name}" rows="2" data-open="${esc(val)}">${esc(val)}</textarea></label>`;
    return `<label class="field tr2-f"><span>${esc(f.k)}</span><input name="${name}" value="${esc(val)}" data-open="${esc(val)}"></label>`;
  }
  function vsGrid(vals) {
    const v = k => vals[k] || '';
    return `<div class="scroll-x"><table class="grid tr2-vs"><thead><tr><th></th>${Array.from({ length: VS_COLS }, (_, i) => `<th>VS${i + 1}</th>`).join('')}</tr></thead><tbody>
      ${VS_ROWS.map(r => `<tr><th scope="row">${esc(r)}</th>${Array.from({ length: VS_COLS }, (_, i) => { const k = `VS${i + 1} ${r}`;
        return `<td><input name="${esc(k)}" aria-label="${esc(k)}" value="${esc(v(k))}" data-open="${esc(vals[k] || '')}"></td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div>`;
  }

  function history(p) {
    const rows = transitionalEntries(p).slice().reverse();
    if (!rows.length) return UI.empty('No saves yet — the record shows the prefilled information.');
    return `<table class="grid"><thead><tr><th>Date/time</th><th>Student</th><th>Shift</th><th>Entered from</th><th>Fields changed</th></tr></thead><tbody>
      ${rows.map(e => `<tr><td class="nowrap">${esc(U.fmtDT(e.time))}</td><td>${esc(Model.signature(e))}</td><td>${esc(e.data.shift || '')}</td><td>${esc(chartName(e.data.from))}</td>
        <td>${Object.keys(e.data.values).map(k => `<div><strong>${esc(k)}:</strong> ${e.data.values[k] === '' ? '<em class="muted">cleared</em>' : esc(e.data.values[k])}</div>`).join('')}</td></tr>`).join('')}</tbody></table>`;
  }

  function panel(p) {
    if (!pairOf(p)) return '';
    const head = `<p class="tr2-shared"><strong>Shared record — saving here updates both Amelia Sung’s and Baby Boy Sung’s charts.</strong></p>`;
    if (!isOpen(p)) return UI.panel('Newborn Transitional Record', `${head}<div class="alert alert-info">Opens after delivery. Faculty: Instructor Tools → Amelia Sung (or Baby Boy Sung) → release <strong>Delivery completed</strong>.</div>`, { cls: 'tr2' });
    // The form always opens with the record's values (data-open); bind() lays any unsaved draft on top.
    const vals = transitionalValues(p);
    const b = Model.get(babyId(p));
    const h = new Date(b.clock.now()).getHours();
    const shift = h >= 7 && h < 19 ? 'Day (0700–1900)' : 'Night (1900–0700)';
    const s = Store.session() || {};
    const body = `${head}
      <form class="assess-form tr2-form" data-tr2 autocomplete="off">
        <div class="form-grid">
          <label class="field"><span>Student / Initials</span><input value="${esc(s.name || '')}" disabled></label>
          <label class="field"><span>Shift</span><select name="_shift">${UI.options(['Day (0700–1900)', 'Night (1900–0700)'], shift, false)}</select></label>
          ${UI.timeField(b, 'Date/time')}
        </div>
        ${SECTIONS.map(sec => `<fieldset class="form-sec"><legend>${esc(sec.title)}</legend>${sec.note ? `<p class="muted small">${esc(sec.note)}</p>` : ''}
          ${sec.grid ? vsGrid(vals) + `<div class="form-grid">${input(FIELDS.find(f => f.k === 'Nurse signature'), vals['Nurse signature'] || '')}</div>`
            : `<div class="form-grid">${sec.fields.map(f => input(f, vals[f.k] || '')).join('')}</div>`}</fieldset>`).join('')}
        <p class="muted small">Apgar scores: score them with the APGAR Score assessment on the Worklist, then enter the totals here.</p>
        <div class="tr2-actions"><button type="submit" class="btn btn-primary">Sign &amp; Save</button> <span class="muted small" data-tr2msg></span></div>
      </form>
      <h3>History (both charts)</h3>${history(p)}`;
    return UI.panel('Newborn Transitional Record', body, { cls: 'tr2' });
  }

  function bind(root, p) {
    const form = root.querySelector('[data-tr2]');
    if (!form) return;
    // Draft: the fields that differ from what the record showed when the form opened.
    const edits = () => {
      const out = {};
      form.querySelectorAll('[data-open]').forEach(el => { if (el.value !== el.dataset.open) out[el.name] = el.value; });
      return out;
    };
    // A draft from before a shared update is kept on top of the newer values (fields the student did not touch update).
    const draft = readDraft(p);
    form.querySelectorAll('[data-open]').forEach(el => { if (el.name in draft) el.value = draft[el.name]; });
    form.addEventListener('input', () => writeDraft(p, edits()));
    form.addEventListener('change', () => writeDraft(p, edits()));
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      const msg = form.querySelector('[data-tr2msg]');
      if (Screens.mode() === 'observer') { UI.toast('Observer mode is view only. You cannot document.', 'warn'); return; }
      const values = edits();
      if (!Object.keys(values).length) { msg.textContent = 'No changes to save'; UI.toast('No changes to save', 'info'); return; }
      const b = Model.get(babyId(p));
      const time = UI.readTime(b, form);
      const shift = form.querySelector('[name="_shift"]').value;
      if (!Store.add(b.id, 'assess', { formId: FORM_ID, v: 2, values, epochs: currentEpochs(p), from: p.id, shift }, time, b.clock.now())) return;
      writeDraft(p, {});
      UI.toast('Transitional Record saved — both Sung charts are updated.');
      App.render();
    });
  }

  // Read-only view (Newborn tab): the current record grouped like the form.
  function readOnly(p) {
    const vals = transitionalValues(p);
    return SECTIONS.map(sec => {
      const filled = sec.fields.filter(f => vals[f.k]);
      return `<h4>${esc(sec.title)}</h4>${filled.length ? `<div class="tr2-ro">${filled.map(f => `<span><strong>${esc(f.k)}:</strong> ${esc(vals[f.k])}</span>`).join('')}</div>` : '<p class="muted small">Nothing documented yet.</p>'}`;
    }).join('');
  }

  // Local reset cleanup: drop rows that no longer count (another patient's reset made their epochs old).
  function cleanup() {
    (window.SIM_PATIENTS || []).filter(b => b.nbPair && b.nbPair.chart === b.id).forEach(b => {
      const p = Model.get(b.id), ep = currentEpochs(p), d = Store.doc(b.id);
      const keep = d.assess.filter(e => !(e.data.formId === FORM_ID && e.data.v === 2 && !sameEpochs(e.data.epochs, ep)));
      if (keep.length !== d.assess.length) { d.assess = keep; Store.saveDoc(b.id, d); }
    });
  }

  // Assessment History line and detail for a saved row.
  const summary = d => d.v === 2 ? `Shared record — ${Object.keys(d.values || {}).length} field(s) updated${d.from ? ' from ' + chartName(d.from) : ''}` : null;
  const detail = d => d.v === 2 ? `<p class="muted small">${esc(d.shift || '')}${d.from ? ' · entered from ' + esc(chartName(d.from)) : ''}</p>` +
    Object.keys(d.values || {}).map(k => `<div class="detail-row"><strong>${esc(k)}:</strong> ${d.values[k] === '' ? '<em class="muted">cleared</em>' : esc(d.values[k])}</div>`).join('') : null;

  Views.transitional = { FORM_ID, KEYS, SECTIONS, SUNG_TRANSITIONAL_BASELINE, transitionalPatients, transitionalEntries, transitionalValues,
    baseline, visible, panel, bind, readOnly, cleanup, summary, detail, draftKey, currentEpochs };
})();
