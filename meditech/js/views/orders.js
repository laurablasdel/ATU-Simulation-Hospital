/* Orders — Expanse-style current orders by category, acknowledgment, order detail (ⓘ),
   protocol links (P), verbal/telephone order entry (students; faculty approve), and
   faculty order entry. Approved and faculty orders show as NEW for students to acknowledge,
   and medication orders go on the MAR (Model.enteredOrders). */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};

  const CATS = ['Admission', 'Code Status', 'Alert', 'Nursing', 'Activity', 'Diet', 'Respiratory', 'IV Fluids', 'IV Access', 'Medication', 'Blood Products', 'Lab', 'Imaging', 'Diagnostics', 'Consult'];
  // Category bands on the screen, like Expanse.
  const BAND = { Medication: 'Medications', Lab: 'Laboratory', Imaging: 'Imaging', Diagnostics: 'Diagnostics', 'Blood Products': 'Blood Products',
    Nursing: 'Nursing Care', Activity: 'Nursing Care', Diet: 'Diet', Respiratory: 'Respiratory Care', 'IV Fluids': 'IV Fluids', 'IV Access': 'Nursing Care',
    Admission: 'Other', 'Code Status': 'Other', Alert: 'Other', Consult: 'Consults' };
  const BAND_ORDER = ['Medications', 'IV Fluids', 'Blood Products', 'Laboratory', 'Imaging', 'Diagnostics', 'Nursing Care', 'Respiratory Care', 'Diet', 'Consults', 'Other'];
  const COLS = '<colgroup><col><col class="oc-by"><col class="oc-time"><col class="oc-status"><col class="oc-act"><col class="oc-i"></colgroup>';

  const faculty = () => Screens.mode() === 'faculty';
  const MED_CATS = ['Medication', 'IV Fluids'];
  const ROUTES = ['PO', 'IV push', 'IVPB', 'IV', 'IM', 'SubQ', 'SL', 'PR', 'Topical', 'Inhaled', 'Nebulized', 'Transdermal', 'NG tube', 'Other'];
  const TYPES = [['scheduled', 'Scheduled'], ['prn', 'PRN'], ['once', 'One time / STAT'], ['continuous', 'Continuous / IV infusion']];

  // All orders as one list: provider orders, medication orders (including approved and faculty orders),
  // plus student verbal/telephone orders that are waiting for faculty or were not approved.
  function allOrders(p, doc) {
    const student = doc.orders.filter(e => !e.data.kind).map(e => {
      const eo = Model.enteredOrders(p.id, doc).find(x => x.entry.id === e.id);
      if (eo && eo.state === 'active') return null;      // shown as a real order (and on the MAR)
      return { id: 'ord-' + String(e.id).toLowerCase(), verbal: e, eo, cat: e.data.cat, text: e.data.text, by: e.data.provider, time: e.time,
        status: e.status === 'error' ? 'Entered in error' : eo && eo.state === 'declined' ? 'Not approved' : 'Pending faculty approval', type: e.data.type };
    }).filter(Boolean);
    return [...p.orders, ...Model.medOrders(p), ...student];
  }

  // "Telephone order · read back ✔ · received by … · approved by …" or "Entered by faculty …"
  function enteredLine(eo) {
    if (!eo) return '';
    if (eo.faculty) return `Entered by ${Model.signature(eo.entry)} (faculty)`;
    const parts = [`${eo.entry.data.type} order`, 'read back ✔', `received by ${Model.signature(eo.entry)}`];
    if (eo.decision) parts.push(`${eo.state === 'declined' ? 'not approved' : 'approved'} by ${Model.signature(eo.decision)}`);
    return parts.join(' · ');
  }

  function orderText(o) {
    if (!o.med) return `<span class="ord-text">${esc(o.text)}</span>`;
    const m = o.med;
    const sig = [m.dose, m.route, m.freq].filter(x => x && x !== '—').join(' ');
    return `<span class="ord-text">${esc(m.name)}</span> <span class="ord-sig">${esc(sig)}</span>`;
  }

  function row(p, doc, o) {
    const acked = Model.isAcked(doc, o.id);
    const conflict = o.med && Model.allergyConflicts(p, o.med).length;
    const status = o.status === 'Active' ? (o.med ? 'Active' : 'Ordered') : o.status;
    const pending = o.verbal && o.status === 'Pending faculty approval';
    return `<tr class="ord-row ${o.status === 'Discontinued' || o.status === 'Entered in error' || o.status === 'Not approved' ? 'dc' : ''} ${o.isNew && !acked ? 'row-new' : ''} ${pending ? 'row-pending' : ''}">
      <td>
        ${o.isNew && !acked ? UI.badge('NEW', 'new') + ' ' : ''}${o.priority ? UI.badge(o.priority, 'danger') + ' ' : ''}${conflict ? UI.badge('ALLERGY', 'danger') + ' ' : ''}
        ${orderText(o)} ${o.protocol ? Views.protocol.link(p, o.protocol) : ''}
        ${o.verbal ? `<div class="muted small">${esc(enteredLine(o.eo) || `${o.type} order · read back ✔ · received by ${Model.signature(o.verbal)}`)}</div>` : ''}
        ${o.entered ? `<div class="muted small">${esc(enteredLine(o.entered))}</div>` : ''}
        ${o.eo && o.eo.state === 'declined' && o.eo.decision.data.reason ? `<div class="small declined-reason">Not approved: ${esc(o.eo.decision.data.reason)}</div>` : ''}
        ${o.med && o.med.indication ? `<div class="muted small">Reason: ${esc(o.med.indication)}</div>` : ''}
      </td>
      <td>${esc(o.by || '')}</td>
      <td class="nowrap">${esc(U.fmtDT(o.time))}${o.dcTime ? `<br>${esc(U.fmtDT(o.dcTime))}` : ''}</td>
      <td>${esc(status)}</td>
      <td class="nowrap">${faculty() && changeable(o) ? `<button class="btn btn-sm" data-modify="${esc(o.id)}" title="Correct this chart entry">Edit</button> <button class="btn btn-sm btn-danger" data-dc="${esc(o.id)}" title="Discontinue">DC</button> ` : ''}${pending && faculty() ? `<button class="btn btn-sm btn-primary" data-approve="${esc(o.verbal.id)}">Review</button>` : ''}${o.isNew ? (acked ? '<span class="muted small">Ack’d</span>' : `<button class="btn btn-sm btn-primary" data-ack="${esc(o.id)}">Acknowledge</button>`) : ''}</td>
      <td><button type="button" class="i-link" data-info="${esc(o.id)}" title="Order detail" aria-label="Order detail">i</button></td>
    </tr>`;
  }

  // ⓘ — everything about one order.
  function detail(p, doc, o) {
    const m = o.med;
    const ack = doc.ack.find(e => e.status === 'active' && e.data.ref === o.id);
    const rows = [
      ['Order', m ? Model.medLabel(m) : o.text], ['Category', o.cat], ['Priority', o.priority || 'Routine'],
      ['Ordering provider', o.by], ['Ordered', U.fmtDT(o.time)], ['Stop / discontinued', o.dcTime ? U.fmtDT(o.dcTime) : ''], ['Status', o.status],
      m && ['Type', { scheduled: 'Scheduled', prn: 'PRN', continuous: 'Continuous / IV', once: 'One time' }[m.type] || m.type],
      m && m.indication && ['Indication / PRN reason', m.indication], m && m.instructions && ['Instructions', m.instructions],
      m && m.highAlert && ['Alert', 'High-alert medication — independent double check'],
      m && (m.holdIf || []).length && ['Hold parameters', m.holdIf.map(h => `${h.p} ${h.op} ${h.v}`).join(' or ')],
      m && (m.preAssess || []).length && ['Assess before giving', m.preAssess.map(k => k.replace('lab:', 'lab: ')).join(', ')],
      o.detail && !m && ['Detail', o.detail],
      o.verbal && ['Order type', `${o.type} order — read back and verified; received by ${Model.signature(o.verbal)}`],
      (o.eo || o.entered) && ['Entered', enteredLine(o.eo || o.entered)],
      o.eo && o.eo.state === 'declined' && ['Not approved', o.eo.decision.data.reason || '(no reason given)'],
      o.verbal && o.verbal.status === 'error' && ['Entered in error', o.verbal.error.reason],
      dcEntryOf(o) && ['Discontinued by', `${Model.signature(dcEntryOf(o))}${dcEntryOf(o).data.reason ? ' — ' + dcEntryOf(o).data.reason : ''}`],
      o.isNew && ['Acknowledged', ack ? `${U.fmtDT(ack.time)} by ${Model.signature(ack)}` : 'Not yet acknowledged']
    ].filter(r => r && r[1]);
    UI.modal({
      title: 'Order Detail', wide: true,
      body: `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        ${o.protocol && Views.protocol.get(p, o.protocol) ? `<h4>Protocol</h4>${Views.protocol.html(Views.protocol.get(p, o.protocol))}` : ''}`,
      buttons: [
        o.verbal && o.verbal.status === 'active' && o.status === 'Pending faculty approval' && faculty() ? { label: 'Review / Approve', cls: 'btn-primary', onClick: () => { setTimeout(() => review(p, o.verbal), 0); } } : null,
        o.verbal && o.verbal.status === 'active' ? { label: 'Mark in Error', cls: 'btn-danger', onClick: () => { setTimeout(() => UI.errorEntry(p, 'orders', o.verbal.id), 0); } } : null,
        faculty() && changeable(o) ? { label: 'Edit…', onClick: () => { setTimeout(() => modify(p, o), 0); } } : null,
        faculty() && changeable(o) ? { label: 'Discontinue…', cls: 'btn-danger', onClick: () => { setTimeout(() => discontinue(p, o), 0); } } : null,
        faculty() && dcEntryOf(o) ? { label: 'Undo Discontinue', onClick: () => { setTimeout(() => undoDc(p, o), 0); } } : null,
        { label: 'Close' }
      ].filter(Boolean)
    });
  }

  Views.orders = {
    label: 'Orders',
    render(p, doc) {
      const all = allOrders(p, doc);
      const groups = {};
      // Orders from an order set (o.set) are grouped under the set's name, ahead of the category bands.
      all.forEach(o => { const band = o.set ? 'Order Set: ' + o.set : BAND[o.cat] || o.cat || 'Other'; (groups[band] = groups[band] || []).push(o); });
      const sets = Object.keys(groups).filter(c => /^Order Set: /.test(c));
      const order = [...sets, ...BAND_ORDER, ...Object.keys(groups).filter(c => !BAND_ORDER.includes(c) && !sets.includes(c))];
      const pending = Model.unackedOrders(p, doc);
      const waiting = Model.enteredOrders(p.id, doc).filter(o => o.state === 'pending');
      const body = order.filter(c => groups[c]).map(band => `<tr class="ord-band"><th colspan="6">${esc(band)}</th></tr>
        ${groups[band].sort((a, b) => (a.status === 'Discontinued') - (b.status === 'Discontinued') || a.time - b.time).map(o => row(p, doc, o)).join('')}`).join('');

      return `<div class="ord-head">
          <h2>Orders</h2>
          <div class="ord-head-right">
            <button class="ord-submit" data-action="ackall" ${pending.length ? '' : 'disabled'}>ACKNOWLEDGE <span>${pending.length}</span></button>
            <a class="wl-btn" href="#/patient/${esc(p.id)}/${App.lastChartTab && App.lastChartTab[p.id] || 'summary'}">Close</a>
          </div>
        </div>
        <div class="ord-tabs" role="tablist">
          <button class="ord-tab ord-tab-on" role="tab" aria-selected="true">CURRENT</button>
          ${faculty() ? '<button class="ord-tab" data-action="facorder">ENTER <small>(faculty order)</small></button>' : '<button class="ord-tab" data-action="verbal">ENTER <small>(verbal / telephone)</small></button>'}
          <button class="ord-tab" disabled>RECONCILE</button>
          <button class="ord-tab" disabled>TRANSFER/ADMIT</button>
        </div>
        ${waiting.length ? `<div class="alert ${faculty() ? 'alert-warn' : 'alert-info'} ord-waiting">${faculty()
          ? `<strong>${waiting.length} student order${waiting.length === 1 ? '' : 's'} waiting for your approval.</strong> Click <strong>Review</strong> on the order.`
          : `${waiting.length} verbal/telephone order${waiting.length === 1 ? ' is' : 's are'} waiting for faculty approval. Once approved, ${waiting.length === 1 ? 'it shows' : 'they show'} as NEW to acknowledge${waiting.some(o => MED_CATS.includes(o.cat)) ? ', and medications appear on the MAR' : ''}.`}</div>` : ''}
        <table class="grid orders-grid">${COLS}
          <thead><tr><th>Orders by Category</th><th>Provider</th><th>Date</th><th>Status</th><th></th><th></th></tr></thead>
          <tbody>${body}</tbody></table>
        <p class="muted small">Click <strong>i</strong> for order detail. <strong>P</strong> opens the protocol for that order.</p>`;
    },
    bind(root, p, doc) {
      const all = allOrders(p, doc);
      root.querySelectorAll('[data-ack]').forEach(b => b.addEventListener('click', () => {
        Store.add(p.id, 'ack', { ref: b.dataset.ack, kind: 'order' }, p.clock.now(), p.clock.now());
        UI.toast('Order acknowledged.');
        App.render();
      }));
      const ackAll = root.querySelector('[data-action="ackall"]');
      if (ackAll) ackAll.addEventListener('click', () => {
        Model.unackedOrders(p, doc).forEach(o => Store.add(p.id, 'ack', { ref: o.id, kind: 'order' }, p.clock.now(), p.clock.now()));
        UI.toast('All new orders acknowledged.');
        App.render();
      });
      root.querySelectorAll('[data-info]').forEach(b => b.addEventListener('click', () => { const o = all.find(x => x.id === b.dataset.info); if (o) detail(p, doc, o); }));
      Views.protocol.bind(root, p);
      const verbal = root.querySelector('[data-action="verbal"]');
      if (verbal) verbal.addEventListener('click', () => openVerbal(p));
      const fac = root.querySelector('[data-action="facorder"]');
      if (fac) fac.addEventListener('click', () => facultyOrder(p));
      root.querySelectorAll('[data-dc]').forEach(b => b.addEventListener('click', () => { const o = all.find(x => x.id === b.dataset.dc); if (o) discontinue(p, o); }));
      root.querySelectorAll('[data-modify]').forEach(b => b.addEventListener('click', () => { const o = all.find(x => x.id === b.dataset.modify); if (o) modify(p, o); }));
      root.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => {
        const e = doc.orders.find(x => x.id === b.dataset.approve); if (e) review(p, e);
      }));
    }
  };
  Views.orders.detail = detail;
  Views.orders.review = (p, e) => review(p, e);

  /* ---------- Faculty: order form, approval, order entry, discontinue ---------- */

  // One form for approving a student order and for entering a faculty order.
  function orderForm(p, o) {
    const m = o.med || {};
    const isMed = MED_CATS.includes(o.cat);
    return `<div class="form-grid">
        <label class="field"><span>Category</span><select name="cat" data-ofcat>${UI.options(CATS, o.cat || 'Medication', false)}</select></label>
        <label class="field"><span>Ordering provider</span><input name="provider" value="${esc(o.provider || p.attending)}" required></label>
        <label class="field"><span>Priority</span><select name="priority">${UI.options(['Routine', 'STAT', 'ASAP'], o.priority || 'Routine', false)}</select></label>
      </div>
      <fieldset class="of-med" ${isMed ? '' : 'hidden'}><legend>Medication (goes on the MAR)</legend>
        <div class="form-grid">
          <label class="field"><span>Medication</span><input name="mname" value="${esc(m.name || '')}" placeholder="e.g., Ondansetron"></label>
          <label class="field"><span>Dose</span><input name="mdose" value="${esc(m.dose || '')}" placeholder="e.g., 4 mg  or  100 mL/hr"></label>
          <label class="field"><span>Route</span><select name="mroute">${UI.options(ROUTES, m.route || 'PO', false)}</select></label>
          <label class="field"><span>Type</span><select name="mtype">${TYPES.map(([v, l]) => `<option value="${v}" ${(m.type || 'scheduled') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field"><span>Frequency</span><input name="mfreq" value="${esc(m.freq || '')}" placeholder="e.g., Every 6 hours, Daily, BID, Every 4 hours PRN"></label>
          <label class="field"><span>Reason / PRN indication</span><input name="mind" value="${esc(m.indication || '')}" placeholder="e.g., Nausea"></label>
        </div>
        <label class="field"><span>Instructions (optional)</span><input name="minstr" value="${esc(m.instructions || '')}"></label>
        <label class="check"><input type="checkbox" name="firstNow" ${o.firstNow !== false ? 'checked' : ''}> Scheduled: first dose due now, then the standard times for the frequency</label>
        <label class="check"><input type="checkbox" name="highAlert" ${m.highAlert ? 'checked' : ''}> High-alert medication (independent double check)</label>
        <p class="muted small">Daily, BID, TID, QID, every 4/6/8/12 hours, and HS use the hospital's standard times. Other "every N hours" frequencies give a dose every N hours. PRN orders need no times.</p>
      </fieldset>
      <label class="field"><span>Order text <span class="muted small" data-oftexthint>${isMed ? '(optional — built from the medication fields if blank)' : ''}</span></span><textarea name="text" rows="3">${esc(o.text || '')}</textarea></label>`;
  }
  function bindOrderForm(el) {
    const cat = el.querySelector('[data-ofcat]');
    cat.addEventListener('change', () => {
      const med = MED_CATS.includes(cat.value);
      el.querySelector('.of-med').hidden = !med;
      el.querySelector('[data-oftexthint]').textContent = med ? '(optional — built from the medication fields if blank)' : '';
    });
  }
  // Read the form; returns { order } or { error }.
  // textOnly: a medication-category order with no medication fields stays a text order (not on the MAR).
  function readOrderForm(el, textOnly) {
    const v = U.formValues(el);
    const order = { cat: v.cat, provider: v.provider || '', priority: v.priority, text: (v.text || '').trim() };
    if (textOnly && MED_CATS.includes(v.cat) && !v.mname && !v.mdose && order.text) return { order };
    if (MED_CATS.includes(v.cat)) {
      const type = v.mtype;
      if (!v.mname || !v.mdose) return { error: 'Enter the medication name and dose (it goes on the MAR).' };
      if ((type === 'scheduled' || type === 'prn') && !v.mfreq) return { error: 'Enter the frequency.' };
      const freq = v.mfreq || (type === 'once' ? 'Once' : type === 'continuous' ? 'Continuous' : '');
      order.med = { name: v.mname.trim(), dose: v.mdose.trim(), route: v.mroute, freq: type === 'prn' && !/prn/i.test(freq) ? freq + ' PRN' : freq, type };
      order.med.indication = (v.mind || '').trim();
      order.med.instructions = (v.minstr || '').trim();
      order.med.highAlert = !!v.highAlert;
      order.firstNow = !!v.firstNow;
      if (!order.text) order.text = Model.medLabel(order.med);
    } else if (!order.text) return { error: 'Enter the order text.' };
    return { order };
  }

  // Packet orders that faculty release in Instructor Tools (ev.aka words). A student telephone order for the same thing
  // should not be approved as well — approve one or release the other, not both.
  function packetMatches(p, text) {
    const t = String(text || '').toLowerCase(), rel = Store.released(p.id);
    return (Model.base(p.id).events || []).filter(ev => (ev.aka || []).some(w => t.includes(w.toLowerCase()))).map(ev => ({ ev, released: !!rel[ev.id] }));
  }

  function review(p, e) {
    const d = e.data;
    const dup = packetMatches(p, d.text);
    UI.modal({
      title: 'Review Student Order', wide: true,
      body: `<div class="review-src">
          <div><strong>${esc(d.type)} order</strong> received ${esc(U.fmtDT(e.time))} by ${esc(Model.signature(e))} · read back ✔</div>
          <div>Provider: ${esc(d.provider || '')} · Category: ${esc(d.cat || '')}</div>
          <blockquote>${esc(d.text)}</blockquote>
        </div>
        ${dup.length ? `<div class="alert alert-warn">⚠ This looks like a packet order you can release in Instructor Tools: ${dup.map(x => `<strong>${esc(x.ev.title)}</strong> (${x.released ? 'already released' : 'not released yet'})`).join('; ')}. Approve this order <em>or</em> release the packet order — not both.</div>` : ''}
        <p class="muted small">Approve to make it an active order: students see it as <strong>NEW</strong> to acknowledge, and medications go on the MAR. Correct or complete any field first.</p>
        ${orderForm(p, { cat: d.cat, provider: d.provider, text: d.text })}`,
      onOpen: api => bindOrderForm(api.el),
      buttons: [
        { label: 'Cancel' },
        { label: 'Not Approved…', cls: 'btn-danger', onClick: () => { setTimeout(() => decline(p, e), 0); } },
        { label: 'Approve Order', cls: 'btn-primary', onClick: api => {
          const r = readOrderForm(api.el);
          if (r.error) { UI.formError(api.el.querySelector('.modal-body'), r.error); return false; }
          Store.add(p.id, 'orders', { kind: 'approval', ref: e.id, decision: 'approved', order: r.order }, p.clock.now(), p.clock.now());
          UI.toast('Order approved — students will see it as NEW to acknowledge' + (r.order.med ? ' and on the MAR.' : '.'));
          App.render();
        } }
      ]
    });
  }

  function decline(p, e) {
    UI.modal({
      title: 'Order Not Approved',
      body: `<p>${esc(e.data.text)}</p><label class="field"><span>Reason (shown to the student)</span><textarea name="reason" rows="2" placeholder="e.g., Clarify the dose with the provider"></textarea></label>`,
      buttons: [{ label: 'Cancel' }, { label: 'Not Approved', cls: 'btn-danger', onClick: api => {
        Store.add(p.id, 'orders', { kind: 'approval', ref: e.id, decision: 'declined', reason: (U.formValues(api.el).reason || '').trim() }, p.clock.now(), p.clock.now());
        UI.toast('Order marked not approved.', 'warn');
        App.render();
      } }]
    });
  }

  function facultyOrder(p) {
    UI.modal({
      title: 'Enter Order (Faculty)', wide: true,
      body: `<p class="muted small">The order is active right away: students see it as <strong>NEW</strong> to acknowledge, and medications go on the MAR. To print a barcode label for a new medication, use Instructor Tools → Print Wristbands & Med Labels.</p>
        ${orderForm(p, { cat: 'Medication' })}`,
      onOpen: api => bindOrderForm(api.el),
      buttons: [{ label: 'Cancel' }, { label: 'Save Order', cls: 'btn-primary', onClick: api => {
        const r = readOrderForm(api.el);
        if (r.error) { UI.formError(api.el.querySelector('.modal-body'), r.error); return false; }
        Store.add(p.id, 'orders', Object.assign({ kind: 'faculty' }, r.order), p.clock.now(), p.clock.now());
        UI.toast('Order entered' + (r.order.med ? ' and added to the MAR.' : '.'));
        App.render();
      } }]
    });
  }

  // Faculty may discontinue or modify any active order: chart orders, released scenario orders, medications,
  // and orders entered during the sim (e.g., a duplicate of an order entered before its release).
  const changeable = o => !o.verbal && o.status !== 'Discontinued' && o.status !== 'Entered in error';
  // The faculty "dc" entry: by entry id for orders entered during the sim, by order/medication id otherwise.
  const dcRef = o => o.entered ? o.entered.entry.id : o.id;
  const dcEntryOf = o => o.status === 'Discontinued' ? (o.entered ? o.entered.dcEntry : o.dcEntry) || null : null;
  const DC_REASONS = ['Duplicate order', 'Order changed by provider', 'Completed', 'No longer indicated', 'Entered on wrong patient', 'Other'];

  function discontinue(p, o, then) {
    UI.modal({
      title: 'Discontinue Order (Faculty)',
      body: `<p><strong>${esc(o.med ? Model.medLabel(o.med) : o.text)}</strong></p>
        <p class="muted small">It stays on the order list as Discontinued${o.med ? ', and no more doses are due on the MAR' : ''}. Undo from the order's <strong>i</strong> if needed.</p>
        <label class="field"><span>Reason</span><select name="reason">${UI.options(DC_REASONS, 'Duplicate order', false)}</select></label>
        <label class="field"><span>Comment (optional)</span><input name="comment"></label>`,
      buttons: [{ label: 'Cancel' }, { label: 'Discontinue', cls: 'btn-danger', onClick: api => {
        const v = U.formValues(api.el);
        Store.add(p.id, 'orders', { kind: 'dc', ref: dcRef(o), reason: v.reason + (v.comment ? ': ' + v.comment : '') }, p.clock.now(), p.clock.now());
        UI.toast('Order discontinued.', 'warn');
        App.render();
      } }]
    });
  }

  function undoDc(p, o) {
    const e = dcEntryOf(o);
    UI.confirm('Undo discontinue', `Make "${o.med ? Model.medLabel(o.med) : o.text}" active again?`, () => {
      Store.markError(p.id, 'orders', e.id, 'Discontinue undone by faculty', p.clock.now());
      UI.toast('Order is active again.');
      App.render();
    }, 'Undo Discontinue');
  }

  // Direct session correction: same record and MAR history; renewed student acknowledgment.
  function modify(p, o) {
    const m = o.med || null;
    const pre = { cat: o.cat === 'Medication' || !o.cat ? (m ? 'Medication' : 'Nursing') : o.cat, provider: (o.entered && o.entered.provider) || o.by || p.attending,
      priority: o.priority || 'Routine', text: m ? '' : o.text, firstNow: false,
      med: m ? { name: m.name, dose: m.dose, route: m.route, type: m.type, freq: m.freq, indication: m.indication, instructions: m.instructions, highAlert: m.highAlert } : null };
    if (m && !MED_CATS.includes(pre.cat)) pre.cat = 'Medication';
    UI.modal({
      title: 'Edit Order (Faculty)', wide: true,
      body: `<div class="review-src"><div>Current order</div><blockquote>${esc(m ? Model.medLabel(m) : o.text)}</blockquote></div>
        <p class="muted small">Saving corrects this entry in place for this session. Students must <strong>acknowledge the change</strong>${m ? ', and the MAR updates' : ''}.</p>
        ${orderForm(p, pre)}`,
      onOpen: api => bindOrderForm(api.el),
      buttons: [{ label: 'Cancel' }, { label: 'Save Correction', cls: 'btn-primary', onClick: api => {
        const r = readOrderForm(api.el, !m);
        if (!r.error && !!r.order.med !== !!m) { UI.formError(api.el.querySelector('.modal-body'), 'Keep the same order type when correcting an entry. Use Add Chart Item for a different order type.'); return false; }
        if (r.error) { UI.formError(api.el.querySelector('.modal-body'), r.error); return false; }
        const now = p.clock.now();
        if (!Store.add(p.id, 'orders', { kind: 'correction', ref: o.id, order: r.order }, now, now)) return false;
        UI.toast('Order modified' + (r.order.med ? ' — the MAR is updated.' : '.'));
        App.render();
      } }]
    });
  }

  function openVerbal(p) {
    UI.modal({
      title: 'Verbal / Telephone Order',
      wide: true,
      body: `<div class="form-grid">
          <label class="field"><span>Order type</span><select name="type"><option>Telephone</option><option>Verbal</option></select></label>
          <label class="field"><span>Category</span><select name="cat">${UI.options(CATS, 'Medication', false)}</select></label>
          <label class="field"><span>Ordering provider</span><input name="provider" value="${esc(p.attending)}" required></label>
          ${UI.timeField(p, 'Date/time received')}
        </div>
        <label class="field"><span>Order (drug, dose, route, frequency, or complete order text)</span><textarea name="text" rows="3" required></textarea></label>
        <label class="check"><input type="checkbox" name="readBack" data-single="1"> I read the complete order back to the provider and the provider confirmed it (RBTO / RBVO).</label>
        <p class="muted">The order goes to <strong>faculty for approval</strong>. Once approved it appears as a NEW order to acknowledge, and medications appear on the MAR.</p>`,
      buttons: [
        { label: 'Cancel' },
        { label: 'Save Order', cls: 'btn-primary', onClick: api => {
          const v = U.formValues(api.el);
          if (!v.text) { UI.formError(api.el.querySelector('.modal-body'), 'Enter the order text.'); return false; }
          if (!v.readBack) { UI.formError(api.el.querySelector('.modal-body'), 'Read-back verification is required before saving a verbal or telephone order.'); return false; }
          Store.add(p.id, 'orders', { type: v.type, cat: v.cat, provider: v.provider, text: v.text, readBack: true }, UI.readTime(p, api.el), p.clock.now());
          UI.toast('Order saved — waiting for faculty approval.');
          App.render();
        } }
      ]
    });
  }
  Views.orders.editor = { render: orderForm, bind: bindOrderForm, read: readOrderForm };
})();
