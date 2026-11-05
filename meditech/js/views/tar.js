/*
 * TAR — Transfusion Administration Record. Its own screen (Document ▾ → TAR).
 * A transfusion is started against a blood product order (provider order or a
 * nursing-entered verbal/telephone order in "Blood Products"), with the bedside
 * two-RN check and pre-transfusion vitals, then monitored (15-minute vitals,
 * hourly after), and ended as completed or stopped for a suspected reaction.
 */
(function () {
  'use strict';
  const esc = U.esc;
  const MIN = 60000;
  window.Views = window.Views || {};

  const PRODUCTS = ['Packed red blood cells (PRBC)', 'Fresh frozen plasma (FFP)', 'Platelets', 'Cryoprecipitate', 'Albumin', 'Other'];
  const ABO = ['O+', 'O−', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−'];
  const BLOOD = /PRBC|packed red|red blood cell|blood product|transfus|plasma|FFP|platelet|cryo|albumin/i;
  const CHECKS = [
    ['consent', 'Signed transfusion consent on the chart'],
    ['order', 'Provider order verified (product, amount, rate, premedication)'],
    ['ident', 'Two patient identifiers match the wristband, blood bank band, and unit tag'],
    ['unitMatch', 'Unit number and ABO/Rh on the bag match the blood bank tag'],
    ['expire', 'Unit is not expired'],
    ['inspect', 'Bag inspected: no clots, bubbles, discoloration, or leaks'],
    ['access', 'Patent IV (18–20 gauge preferred); blood tubing with filter primed with 0.9% NaCl only']
  ];
  const SYMPTOMS = ['Fever / temp rise ≥ 1.8 °F (1 °C)', 'Chills / rigors', 'Urticaria / itching / rash', 'Flushing', 'Dyspnea / wheezing', 'Chest pain / tightness', 'Back or flank pain', 'Hypotension', 'Tachycardia', 'Hypertension / fluid overload signs', 'Nausea / vomiting', 'Dark urine / hematuria', 'Anxiety / sense of impending doom'];
  const ACTIONS = ['Stopped the transfusion immediately', 'Kept IV open with 0.9% NaCl using new tubing', 'Stayed with the patient; monitored vital signs', 'Notified the provider', 'Notified the blood bank', 'Returned the bag and tubing to the blood bank', 'Sent blood / urine samples per protocol', 'Rechecked patient ID and unit labels'];

  // RBC compatibility: recipient ABO/Rh -> can receive donor unit?
  function rbcCompatible(patient, unit) {
    const pa = patient.replace(/[+−-]/g, ''), ua = unit.replace(/[+−-]/g, '');
    const pNeg = /[−-]/.test(patient), uPos = /\+/.test(unit);
    const aboOk = ua === 'O' || ua === pa || pa === 'AB';
    return { aboOk, rhOk: !(pNeg && uPos) };
  }
  // Plasma is the reverse: AB plasma is universal.
  function plasmaCompatible(patient, unit) {
    const pa = patient.replace(/[+−-]/g, ''), ua = unit.replace(/[+−-]/g, '');
    return { aboOk: ua === 'AB' || ua === pa || pa === 'O', rhOk: true };
  }

  // Blood product orders: provider orders plus nursing-entered verbal/telephone orders.
  function bloodOrders(p, doc) {
    const prov = p.orders.filter(o => o.status === 'Active' && (o.cat === 'Blood Products' || (!/^(Lab|Diagnostics|Imaging)$/.test(o.cat) && BLOOD.test(o.text))))
      .map(o => ({ id: o.id, text: o.text, by: o.by, time: o.time }));
    const med = Model.medOrders(p).filter(o => o.status === 'Active' && BLOOD.test(o.text)).map(o => ({ id: o.id, text: o.text, by: o.by, time: o.time }));
    const verbal = doc.orders.filter(e => e.status === 'active' && (e.data.cat === 'Blood Products' || (!/^(Lab|Diagnostics|Imaging)$/.test(e.data.cat) && BLOOD.test(e.data.text))))
      .map(e => ({ id: e.id, text: e.data.text, by: `${e.data.provider} (${e.data.type} order)`, time: e.time }));
    return [...prov, ...med, ...verbal];
  }

  // Group TAR entries into transfusions.
  function transfusions(doc) {
    const act = doc.tar.filter(e => e.status === 'active');
    return doc.tar.filter(e => e.data.kind === 'start').map(s => {
      const rows = act.filter(e => e.data.tx === s.id).sort((a, b) => a.time - b.time);
      const end = rows.find(e => e.data.kind === 'end' || e.data.kind === 'reaction');
      const checks = rows.filter(e => e.data.kind === 'vitals');
      const status = s.status === 'error' ? 'Entered in error' : !end ? 'In progress' : end.data.kind === 'reaction' ? 'Stopped — suspected reaction' : 'Completed';
      return { start: s, rows, end, checks, status };
    }).sort((a, b) => b.start.time - a.start.time);
  }

  // When the next monitoring vital signs are due for a running transfusion.
  function nextCheck(tx) {
    const last = tx.checks.length ? tx.checks[tx.checks.length - 1].time : tx.start.time;
    return last + (tx.checks.length ? 60 : 15) * MIN;
  }
  const running = (p, doc) => transfusions(doc).filter(t => t.status === 'In progress');

  const vitalsFields = prefix => `
    <label class="field"><span>Temp (°F)</span><input type="number" step="0.1" name="${prefix}temp" required></label>
    <label class="field"><span>Heart rate</span><input type="number" name="${prefix}hr" required></label>
    <label class="field"><span>Resp rate</span><input type="number" name="${prefix}rr" required></label>
    <label class="field"><span>Systolic BP</span><input type="number" name="${prefix}sbp" required></label>
    <label class="field"><span>Diastolic BP</span><input type="number" name="${prefix}dbp" required></label>
    <label class="field"><span>SpO₂ (%)</span><input type="number" name="${prefix}spo2" required></label>`;
  const vitalsText = d => `T ${esc(d.temp)} · HR ${esc(d.hr)} · RR ${esc(d.rr)} · BP ${esc(d.sbp)}/${esc(d.dbp)} · SpO₂ ${esc(d.spo2)}%`;

  // Monitoring vitals also go on the Vital Signs flowsheet.
  function toFlowsheet(p, v, time, note) {
    Store.add(p.id, 'vitals', { temp: v.temp, hr: v.hr, rr: v.rr, sbp: v.sbp, dbp: v.dbp, spo2: v.spo2, note }, time, p.clock.now());
  }
  const pick = (v, prefix) => ({ temp: v[prefix + 'temp'], hr: v[prefix + 'hr'], rr: v[prefix + 'rr'], sbp: v[prefix + 'sbp'], dbp: v[prefix + 'dbp'], spo2: v[prefix + 'spo2'] });

  function startDialog(p, doc) {
    const orders = bloodOrders(p, doc);
    if (!orders.length) {
      UI.modal({ title: 'No Blood Product Order', body: '<p>A transfusion needs a provider order. If the provider gives one verbally or by phone, enter it in <strong>Orders</strong> under the <strong>Blood Products</strong> category (with read-back), then return to the TAR.</p>', buttons: [{ label: 'OK' }] });
      return;
    }
    UI.modal({
      title: 'Start Transfusion', wide: true,
      body: `<form class="tar-form" autocomplete="off">
        <div class="form-grid g2">
          <label class="field"><span>Blood product order</span><select name="orderRef" required>${orders.map(o => `<option value="${esc(o.id)}">${esc(o.text)} — ${esc(o.by || '')}</option>`).join('')}</select></label>
          <label class="field"><span>Product</span><select name="product" required>${UI.options(PRODUCTS)}</select></label>
        </div>
        <div class="form-grid g4">
          <label class="field"><span>Unit / donor number (scan or type)</span><span class="cam-row"><input name="unitNo" required><button type="button" class="btn btn-sm cam-btn" data-cam="unit" aria-label="Scan unit with camera">📷</button></span></label>
          <label class="field"><span>Unit ABO/Rh</span><select name="unitABO" required>${UI.options(ABO)}</select></label>
          <label class="field"><span>Patient ABO/Rh (type &amp; crossmatch)</span><select name="patientABO" required>${UI.options(ABO)}</select></label>
          <label class="field"><span>Unit expiration</span><input type="datetime-local" name="expires" required></label>
          <label class="field"><span>Unit volume (mL)</span><input type="number" name="volume" required></label>
          <label class="field"><span>Starting rate (mL/hr)</span><input type="number" name="rate" required></label>
          <label class="field"><span>IV site / gauge</span><input name="site" placeholder="e.g., R forearm 18 g"></label>
          <label class="field"><span>Premedication (if ordered)</span><input name="premed" placeholder="none"></label>
        </div>
        <fieldset class="field"><legend>Bedside verification (both RNs)</legend>
          ${CHECKS.map(([k, label]) => `<label class="check"><input type="checkbox" name="checks" value="${k}"> ${esc(label)}</label>`).join('')}
        </fieldset>
        <div class="form-grid g2">
          <label class="field"><span>Verifying RN 2 (name, credentials)</span><input name="rn2" required></label>
          ${UI.timeField(p, 'Transfusion start time')}
        </div>
        <h4>Pre-transfusion vital signs (within 30 minutes before starting)</h4>
        <div class="form-grid g6">${vitalsFields('pre_')}</div>
      </form>`,
      onOpen(api) {
        api.el.querySelector('form').addEventListener('submit', e => e.preventDefault());
        api.el.querySelector('[data-cam="unit"]').addEventListener('click', () => CameraScan.open(code => { api.el.querySelector('[name="unitNo"]').value = code; }, { title: 'Scan Blood Unit Number' }));
      },
      buttons: [{ label: 'Cancel' }, { label: 'Verify & Start', cls: 'btn-primary', onClick: api => {
        const f = api.el.querySelector('form');
        if (!f.reportValidity()) return false;
        const v = U.formValues(f);
        const missing = CHECKS.filter(([k]) => !v.checks.includes(k));
        if (missing.length) { UI.formError(f, 'Complete every bedside verification item before starting: ' + missing.map(m => m[1]).join('; ') + '.'); return false; }
        const me = (Store.session() || {}).name || '';
        if (v.rn2.trim().toLowerCase() === me.trim().toLowerCase()) { UI.formError(f, 'The second verifier must be a different RN.'); return false; }
        const start = UI.readTime(p, f);
        if (U.fromInput(v.expires) <= start) { UI.formError(f, 'This unit is expired. Do not hang it — return it to the blood bank.'); return false; }
        if (p.bloodType && v.patientABO !== p.bloodType) { UI.formError(f, `Patient ABO/Rh does not match the type & crossmatch on file (${p.bloodType}). Stop and recheck.`); return false; }
        if (/red blood|PRBC|plasma|FFP/i.test(v.product)) {
          const c = /plasma|FFP/i.test(v.product) ? plasmaCompatible(v.patientABO, v.unitABO) : rbcCompatible(v.patientABO, v.unitABO);
          if (!c.aboOk) { UI.formError(f, `ABO INCOMPATIBLE: a ${v.patientABO} patient cannot receive ${v.unitABO} ${/plasma|FFP/i.test(v.product) ? 'plasma' : 'red cells'}. Do not hang this unit.`); return false; }
          if (!c.rhOk) { UI.formError(f, `Rh mismatch: an Rh-negative patient should not receive Rh-positive red cells without provider/blood bank approval. Do not hang this unit.`); return false; }
        }
        const order = orders.find(o => o.id === v.orderRef);
        const pre = pick(v, 'pre_');
        ['pre_temp', 'pre_hr', 'pre_rr', 'pre_sbp', 'pre_dbp', 'pre_spo2'].forEach(k => delete v[k]);
        delete v._time;
        Store.add(p.id, 'tar', Object.assign(v, { kind: 'start', orderText: order ? order.text : '', pre }), start, p.clock.now());
        toFlowsheet(p, pre, start, `Pre-transfusion — unit ${v.unitNo}`);
        UI.toast('Transfusion started. First vital signs are due in 15 minutes; stay with the patient.');
        App.render();
      } }]
    });
  }

  function monitorDialog(p, tx) {
    const n = tx.checks.length;
    UI.modal({
      title: `Transfusion Vital Signs — unit ${tx.start.data.unitNo}`, wide: true,
      body: `<form autocomplete="off">
        <div class="form-grid g3">
          ${UI.timeField(p)}
          <label class="field"><span>Check</span><select name="label">${UI.options(['15 minutes after start', '1 hour', '2 hours', '3 hours', 'Other'], n === 0 ? '15 minutes after start' : ['1 hour', '2 hours', '3 hours'][n - 1] || 'Other', false)}</select></label>
          <label class="field"><span>Current rate (mL/hr)</span><input type="number" name="rate" value="${esc(tx.start.data.rate)}" required></label>
        </div>
        <div class="form-grid g6">${vitalsFields('')}</div>
        <label class="field"><span>Signs of a reaction?</span><select name="symptoms">${UI.options(['None — patient tolerating', 'Yes — document a reaction instead'], '', false)}</select></label>
      </form>`,
      onOpen(api) { api.el.querySelector('form').addEventListener('submit', e => e.preventDefault()); },
      buttons: [{ label: 'Cancel' }, { label: 'Sign & Save', cls: 'btn-primary', onClick: api => {
        const f = api.el.querySelector('form');
        if (!f.reportValidity()) return false;
        const v = U.formValues(f);
        if (/^Yes/.test(v.symptoms)) { api.close(); reactionDialog(p, tx); return false; }
        const t = UI.readTime(p, f);
        delete v._time;
        Store.add(p.id, 'tar', Object.assign(v, { kind: 'vitals', tx: tx.start.id }), t, p.clock.now());
        toFlowsheet(p, v, t, `Transfusion ${v.label} — unit ${tx.start.data.unitNo}`);
        UI.toast('Transfusion vital signs saved.');
        App.render();
      } }]
    });
  }

  function reactionDialog(p, tx) {
    UI.modal({
      title: 'Suspected Transfusion Reaction', wide: true,
      body: `<form autocomplete="off">
        <div class="alerts"><div class="alert alert-danger">Stop the transfusion first. Do not flush the blood tubing.</div></div>
        ${UI.timeField(p, 'Time transfusion stopped')}
        <fieldset class="field"><legend>Signs and symptoms</legend>${SYMPTOMS.map(s => `<label class="check"><input type="checkbox" name="symptoms" value="${esc(s)}"> ${esc(s)}</label>`).join('')}</fieldset>
        <fieldset class="field"><legend>Nursing actions</legend>${ACTIONS.map(s => `<label class="check"><input type="checkbox" name="actions" value="${esc(s)}"> ${esc(s)}</label>`).join('')}</fieldset>
        <div class="form-grid g6">${vitalsFields('')}</div>
        <div class="form-grid g2">
          <label class="field"><span>Volume infused before stopping (mL)</span><input type="number" name="infused" required></label>
          <label class="field"><span>Provider notified (name)</span><input name="provider"></label>
        </div>
        <label class="field"><span>Comment</span><textarea name="comment" rows="2"></textarea></label>
      </form>`,
      onOpen(api) { api.el.querySelector('form').addEventListener('submit', e => e.preventDefault()); },
      buttons: [{ label: 'Cancel' }, { label: 'Sign & Save', cls: 'btn-danger', onClick: api => {
        const f = api.el.querySelector('form');
        if (!f.reportValidity()) return false;
        const v = U.formValues(f);
        if (!v.symptoms.length) { UI.formError(f, 'Check at least one sign or symptom.'); return false; }
        if (!v.actions.includes(ACTIONS[0])) { UI.formError(f, 'The first action for a suspected reaction is to stop the transfusion.'); return false; }
        const t = UI.readTime(p, f);
        delete v._time;
        Store.add(p.id, 'tar', Object.assign(v, { kind: 'reaction', tx: tx.start.id }), t, p.clock.now());
        toFlowsheet(p, v, t, `Suspected transfusion reaction — unit ${tx.start.data.unitNo}`);
        UI.toast('Reaction documented. Write an SBAR note for the provider notification.', 'warn');
        App.render();
      } }]
    });
  }

  function endDialog(p, tx) {
    UI.modal({
      title: `Complete Transfusion — unit ${tx.start.data.unitNo}`, wide: true,
      body: `<form autocomplete="off">
        <div class="form-grid g3">
          ${UI.timeField(p, 'Time completed')}
          <label class="field"><span>Volume infused (mL)</span><input type="number" name="infused" value="${esc(tx.start.data.volume)}" required></label>
          <label class="field"><span>Line flushed with 0.9% NaCl</span><select name="flushed">${UI.options(['Yes', 'No'], 'Yes', false)}</select></label>
        </div>
        <h4>Post-transfusion vital signs</h4>
        <div class="form-grid g6">${vitalsFields('')}</div>
        <label class="field"><span>Patient response</span><select name="response">${UI.options(['Tolerated well — no signs of reaction', 'Mild symptoms — provider notified', 'Other (see comment)'], '', false)}</select></label>
        <label class="field"><span>Comment</span><textarea name="comment" rows="2"></textarea></label>
      </form>`,
      onOpen(api) { api.el.querySelector('form').addEventListener('submit', e => e.preventDefault()); },
      buttons: [{ label: 'Cancel' }, { label: 'Sign & Save', cls: 'btn-primary', onClick: api => {
        const f = api.el.querySelector('form');
        if (!f.reportValidity()) return false;
        const v = U.formValues(f);
        const t = UI.readTime(p, f);
        delete v._time;
        Store.add(p.id, 'tar', Object.assign(v, { kind: 'end', tx: tx.start.id }), t, p.clock.now());
        toFlowsheet(p, v, t, `Post-transfusion — unit ${tx.start.data.unitNo}`);
        if (Number(v.infused) > 0) Store.add(p.id, 'io', { kind: 'in', cat: 'Blood products', amt: Number(v.infused), desc: `${tx.start.data.product}, unit ${tx.start.data.unitNo}` }, t, p.clock.now());
        UI.toast('Transfusion completed. Volume added to intake.');
        App.render();
      } }]
    });
  }

  function txCard(p, tx) {
    const s = tx.start, d = s.data, now = p.clock.now();
    const due = tx.status === 'In progress' ? nextCheck(tx) : null;
    const over4 = tx.status === 'In progress' && now - s.time > 4 * 60 * MIN;
    const line = (e, what, body) => `<tr class="${e.status === 'error' ? 'error-row' : ''}"><td class="nowrap">${esc(U.fmtDT(e.time))}</td><td>${what}</td><td>${body}${e.status === 'error' ? `<div class="err-label">Entered in error — ${esc(e.error.reason)}</div>` : ''}</td>
      <td>${esc(Model.signature(e))}${Model.lateLabel(e) ? `<div class="late">${esc(Model.lateLabel(e))}</div>` : ''}</td>
      <td>${e.status === 'active' ? `<button class="btn btn-sm btn-link" data-err="${e.id}">Error</button>` : ''}</td></tr>`;
    const rows = [line(s, 'Started', `${esc(d.product)} · unit ${esc(d.unitNo)} · unit ${esc(d.unitABO)} / patient ${esc(d.patientABO)} · ${esc(d.volume)} mL at ${esc(d.rate)} mL/hr${d.site ? ' · ' + esc(d.site) : ''}${d.premed ? ' · premed: ' + esc(d.premed) : ''}<div class="muted">Pre-vitals: ${vitalsText(d.pre)} · verified with ${esc(d.rn2)}</div>`)]
      .concat(tx.rows.map(e => e.data.kind === 'vitals' ? line(e, esc(e.data.label), `${vitalsText(e.data)} · rate ${esc(e.data.rate)} mL/hr · ${esc(e.data.symptoms)}`)
        : e.data.kind === 'end' ? line(e, 'Completed', `${esc(e.data.infused)} mL infused · ${vitalsText(e.data)} · ${esc(e.data.response)}${e.data.comment ? ' · ' + esc(e.data.comment) : ''}`)
        : line(e, '<strong class="abn">Stopped — reaction</strong>', `${esc(e.data.symptoms.join(', '))}<div>Actions: ${esc(e.data.actions.join('; '))}</div><div>${vitalsText(e.data)} · ${esc(e.data.infused)} mL infused${e.data.provider ? ' · provider: ' + esc(e.data.provider) : ''}</div>`)));
    const badge = tx.status === 'In progress' ? UI.badge('In progress', 'new') : tx.status === 'Completed' ? UI.badge('Completed', 'ok') : UI.badge(tx.status, tx.status.startsWith('Stopped') ? 'danger' : 'muted');
    return UI.panel(`${d.product} — unit ${d.unitNo}`, `
      <p>${badge} Order: ${esc(d.orderText)}</p>
      ${due ? `<div class="alerts"><div class="alert ${due <= now ? 'alert-danger' : 'alert-warn'}">Next transfusion vital signs ${due <= now ? 'OVERDUE since' : 'due at'} ${esc(U.fmtTime(due))}.</div></div>` : ''}
      ${over4 ? '<div class="alerts"><div class="alert alert-danger">Running more than 4 hours from start. Units must finish within 4 hours; notify the provider/blood bank.</div></div>' : ''}
      <table class="grid"><thead><tr><th>Date/time</th><th>Event</th><th>Detail</th><th>Documented by</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>
      ${tx.status === 'In progress' ? `<div class="view-actions"><button class="btn btn-primary" data-tar="vitals" data-tx="${esc(s.id)}">Transfusion Vital Signs</button>
        <button class="btn" data-tar="end" data-tx="${esc(s.id)}">Complete Transfusion</button>
        <button class="btn btn-danger" data-tar="reaction" data-tx="${esc(s.id)}">Stop — Suspected Reaction</button></div>` : ''}`);
  }

  Views.tar = {
    label: 'Transfusion Administration Record',
    running,
    nextCheck,
    render(p, doc) {
      const orders = bloodOrders(p, doc);
      const list = transfusions(doc);
      const ordersHtml = orders.length ? `<table class="grid"><thead><tr><th>Ordered</th><th>Order</th><th>Provider</th></tr></thead><tbody>
          ${orders.map(o => `<tr><td class="nowrap">${esc(U.fmtDT(o.time))}</td><td><strong>${esc(o.text)}</strong></td><td>${esc(o.by || '')}</td></tr>`).join('')}</tbody></table>`
        : UI.empty('No blood product orders. A verbal or telephone order can be entered in Orders under Blood Products.');
      return `${Views.worklist.band(p)}
        <div class="wl-bar"><div>
          <button class="wl-btn" data-tar="start">Start<br>Transfusion</button></div>
          <div class="wl-bar-right"><a class="wl-btn" href="#/patient/${esc(p.id)}/worklist">Close</a></div></div>
        <h2 class="solo-title">Transfusion Administration Record (TAR)</h2>
        ${UI.panel('Blood Product Orders', ordersHtml)}
        ${list.length ? list.map(tx => txCard(p, tx)).join('') : UI.panel('Transfusions', UI.empty('No transfusions documented.'))}`;
    },
    bind(root, p, doc) {
      const find = id => transfusions(Store.doc(p.id)).find(t => t.start.id === id);
      root.querySelectorAll('[data-tar]').forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.tar;
        if (a === 'start') return startDialog(p, Store.doc(p.id));
        const tx = find(b.dataset.tx);
        if (!tx) return;
        if (a === 'vitals') monitorDialog(p, tx);
        else if (a === 'end') endDialog(p, tx);
        else reactionDialog(p, tx);
      }));
      root.querySelectorAll('[data-err]').forEach(b => b.addEventListener('click', () => UI.errorEntry(p, 'tar', b.dataset.err)));
    }
  };
})();
