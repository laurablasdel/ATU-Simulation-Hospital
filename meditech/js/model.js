/*
 * Builds the live chart for a patient: patient data + scenario clock +
 * instructor-released events + helpers used by the screens.
 */
(function () {
  'use strict';
  const C = window.EHR_CONFIG;
  const MIN = 60000;
  const HOUR = 3600000;

  const M = {};

  M.barcodeFor = m => m.barcode || ('RX-' + m.id.toUpperCase());

  M.allPatients = () => [...(window.SIM_PATIENTS || []), ...Store.customPatients()].map(p => {
    const patient=Object.assign({},p,Store.patientEdits(p.id));
    patient.events = window.Shared ? Shared.eventData(p.id) : (p.events || []);
    const clean=window.ScenarioContent ? ScenarioContent.cleanPatient(patient) : patient;
    return window.PacketUpdates && typeof PacketUpdates.cleanPatient === 'function' ? PacketUpdates.cleanPatient(clean) : clean;
  });
  M.base = pid => M.allPatients().find(p => p.id === pid);

  function parseHM(s) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
    return m ? [Number(m[1]), Number(m[2])] : [0, 0];
  }

  // Scenario clock for a patient. The chart clock is the real current time.
  // The scenario (written for p.scenarioStart, e.g. 14:00) is moved to start
  // when the chart is first opened, rounded to the nearest hour so scheduled
  // med times stay on the hour; every order, dose, and result keeps the same
  // spacing it has in the scenario.
  M.clock = function (p) {
    const realStart = Store.scenarioStart(p.id);
    if (p.scenarioShifts && p.scenarioShifts.length) {
      const shifts = p.scenarioShifts;
      const atShift = shift => {
        const date = new Date(realStart), hm = parseHM(shift.start);
        date.setDate(date.getDate() + shift.day); date.setHours(hm[0], hm[1], 0, 0);
        return date.getTime();
      };
      const endShift = shift => { const date = new Date(atShift(shift)); date.setHours(date.getHours() + 12); return date.getTime(); };
      const timeline = p.scenarioTimeline && p.scenarioTimeline.referenceStart === realStart ? p.scenarioTimeline.steps : [];
      const steps = [{ shift: shifts[0].id, realStart }].concat((timeline || []).filter(step => shifts.some(s => s.id === step.shift)));
      const current = steps[steps.length - 1], stage = shifts.find(s => s.id === current.shift);
      const mapTime = (real, step) => {
        const shift = shifts.find(s => s.id === step.shift), begin = atShift(shift);
        return Math.min(endShift(shift) - 1, begin + Math.max(0, real - step.realStart));
      };
      const day = new Date(atShift(shifts[0])); day.setHours(0, 0, 0, 0);
      return {
        simStart: atShift(shifts[0]), offset: 0, shift: 0, staged: true,
        stage, stageStart: atShift(stage), stageEnd: endShift(stage), dayOne: day.getTime(),
        stageTimes: shifts.map(s => ({ ...s, from: atShift(s), to: endShift(s) })),
        now: () => mapTime(Date.now(), current),
        toSim: real => mapTime(real, steps.filter(s => s.realStart <= real).slice(-1)[0] || steps[0]),
        at(item, ref) {
          if (item && item.time) { const date = new Date(day), hm = parseHM(item.time); date.setDate(date.getDate() + (Number(item.day) || 0)); date.setHours(hm[0], hm[1], 0, 0); return date.getTime(); }
          return (ref == null ? atShift(shifts[0]) : ref) + (Number(item && item.at) || 0) * MIN;
        }
      };
    }
    const d = new Date(realStart);
    const [h, mi] = p.scenarioStart ? parseHM(p.scenarioStart) : [d.getHours(), d.getMinutes()];
    d.setHours(h, mi, 0, 0);
    const written = d.getTime();                       // scenario start as written, today
    const shift = Math.round((realStart - written) / HOUR) * HOUR;
    const simStart = written + shift;
    const dayStart = new Date(written); dayStart.setHours(0, 0, 0, 0);
    return {
      simStart,
      offset: 0,
      shift,
      now: () => Date.now(),
      toSim: real => real,
      // Resolve {time, day} or {at} to a chart timestamp. ref = base for "at".
      // {time, static: true} is NOT moved with the scenario: it shows at that clock time today.
      at(item, ref) {
        if (item && item.time) {
          const [hh, mm] = parseHM(item.time);
          const t = new Date(dayStart.getTime());
          t.setDate(t.getDate() + (Number(item.day) || 0));
          t.setHours(hh, mm, 0, 0);
          return t.getTime() + (item.static ? 0 : shift);   // static: stays at its written clock time
        }
        return (ref == null ? simStart : ref) + (Number(item && item.at) || 0) * MIN;
      }
    };
  };

  // Standard administration times by frequency (hospital schedule).
  const STD = [
    [/\b(ac\s*(&|and|\/)\s*hs)\b/i, ['07:30', '11:30', '16:30', '21:00']],
    [/every\s*4\s*h|\bq\s*4\s*h/i, ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00']],
    [/every\s*6\s*h|\bq\s*6\s*h/i, ['00:00', '06:00', '12:00', '18:00']],
    [/every\s*8\s*h|\bq\s*8\s*h/i, ['06:00', '14:00', '22:00']],
    [/every\s*12\s*h|\bq\s*12\s*h|\bbid\b|twice (a )?daily/i, ['09:00', '21:00']],
    [/\btid\b|three times/i, ['09:00', '13:00', '17:00']],
    [/\bqid\b|four times/i, ['09:00', '13:00', '17:00', '21:00']],
    [/\bhs\b|bedtime/i, ['21:00']],
    [/daily|every day|once a day|every 24|\bqd\b|weekly/i, ['09:00']]
  ];
  M.standardTimes = freq => { const hit = STD.find(([re]) => re.test(String(freq || ''))); return hit ? hit[1] : null; };

  // ctx: { start, today (midnight of the scenario day), auto (doses before start documented as given), initials }
  function prepMed(clock, m, ref, extra, ctx) {
    ctx = ctx || {};
    const med = Object.assign({ status: 'Active', type: 'scheduled' }, JSON.parse(JSON.stringify(m)), extra || {});
    med.barcode = M.barcodeFor(med);
    med.orderTime = med.ordered ? clock.at(med.ordered, ref) : ref;
    const explicit = (med.doses || []).map(d => Object.assign({}, d, { t: clock.at(d, ref) }));
    const std = med.type === 'scheduled' && !med.fixedTimes && ctx.today != null ? M.standardTimes(med.freq) : null;
    let list = explicit;
    if (std) {
      // Scheduled meds follow the standard times for their frequency, from the order time on
      // (tomorrow on if the order says so), plus documented off-schedule doses (e.g., given in the ER).
      const H = 3600000, day0 = ctx.today;
      const startAfter = /start (tomorrow|in (the )?am|in the morning)/i.test(med.freq) ? day0 + 24 * H : med.orderTime;
      // "Start tomorrow": the doses show on the MAR but are not available (grayed) until that day.
      if (startAfter > med.orderTime && startAfter === day0 + 24 * H) med.startsOn = startAfter;
      // A med released during the scenario may carry an explicit first dose ("at"); later doses align to the schedule.
      const firstAt = extra && explicit.length && explicit[0].at != null ? explicit[0].t : null;
      const from = Math.max(startAfter, ctx.auto ? ctx.start - 24 * H : day0) - 60000;
      const grid = [];
      for (let d = -1; d <= (ctx.daysAhead || 1); d++) std.forEach(hm => {
        const [hh, mm] = hm.split(':').map(Number);
        const t = new Date(day0 + d * 24 * H); t.setHours(hh, mm, 0, 0);
        grid.push(t.getTime());
      });
      const minGap = firstAt ? Math.min(4, 24 / std.length / 2) * H : 0;
      // A written dose (from Notion) lines up with a slot by its written clock time and day; the chart clock is real time.
      const slotOf = (t, d) => { const x = new Date(t); return `${d}|${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };
      const written = e => e.time ? `${e.day || 0}|${e.time}` : null;
      const slots = [];
      grid.forEach((t, gi) => slots.push({ t, key: slotOf(t, Math.floor(gi / std.length) - 1) }));
      const documented = s => explicit.some(e => written(e) === s.key && (e.given || e.notGiven));
      list = slots.filter(s => (s.t >= from && (!firstAt || s.t >= firstAt + minGap)) || documented(s))
        .filter(s => med.weekday == null || new Date(s.t).getDay() === med.weekday)
        .map(s => { const ex = explicit.find(e => written(e) === s.key); return Object.assign({}, ex || {}, { t: s.t }); });
      if (firstAt) list.unshift(Object.assign({}, explicit[0]));
      // Doses marked extra (e.g., given in the ER, or a first dose on admission) stay at their written time.
      explicit.forEach(e => { if (e.extra && !list.includes(e)) list.push(e); });
      list.sort((x, y) => x.t - y.t);
    }
    med.doseTimes = list.map((d, i) => {
      const time = d.t;
      const dt = { key: med.id + (med.scheduleRevision ? '@' + med.scheduleRevision : '') + '#' + i, time, priorBy: d.given || null, priorNotGiven: d.notGiven || null, priorNGBy: d.by || null };
      if (!std && med.weekday != null && new Date(time).getDay() !== med.weekday) dt.notToday = true;
      // Advanced Med-Surg / ICU: scheduled doses due before the scenario start were given by the prior shift.
      if (ctx.auto && med.type === 'scheduled' && med.status === 'Active' && !extra && !dt.priorBy && !dt.priorNotGiven && !dt.notToday && time < ctx.start) dt.priorBy = ctx.initials;
      return dt;
    });
    if (med.lastGiven) med.lastGivenPrior = { time: clock.at(med.lastGiven, ref), by: med.lastGiven.by };
    if (med.started) med.startedPrior = { time: clock.at(med.started, ref), by: med.started.by || 'Prior RN' };
    return med;
  }

  // Corrections keep the chart record ID, so administration history stays attached.
  M.correction = (doc, ref) => (doc.orders || []).filter(e => e.status === 'active' && e.data.kind === 'correction' && e.data.ref === ref).slice(-1)[0];
  M.revision = (doc, ref) => (doc.orders || []).filter(e => e.status === 'active' && ['correction','chart-correction'].includes(e.data.kind) && e.data.ref === ref).slice(-1)[0] || window.PacketUpdates?.revisions[ref];
  M.corrected = function (pid, item, medication) {
    const change = M.correction(Store.doc(pid), item.id);
    if (!change) return item;
    const order = change.data.order;
    if (medication && order.med) {
      const next = Object.assign({}, item, order.med);
      delete next.minIntervalHr;
      const every = /(?:every|q)\s*(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\b/i.exec(next.freq || '');
      if (next.type === 'prn' && every) next.minIntervalHr = Number(every[1]);
      if (next.type === 'continuous') next.rate = next.dose;
      if (next.freq !== item.freq || next.type !== item.type) {
        const generated = M.enteredMed(Object.assign({}, order, {id:item.id,firstNow:false}));
        next.doses = generated.doses || []; next.fixedTimes = !!generated.fixedTimes;
        next.scheduleRevision = change.id;
      }
      return Object.assign(next, {id:item.id,orderedBy:order.provider,isNew:true,revision:change.id});
    }
    return medication ? Object.assign({}, item, order.med, { id: item.id, orderedBy: order.provider, isNew: true, revision: change.id })
      : Object.assign({}, item, { cat: order.cat, text: order.text, by: order.provider, priority: order.priority, isNew: true, revision: change.id });
  };
  M.get = function (pid) {
    const base = M.base(pid);
    if (!base) return null;
    const p = JSON.parse(JSON.stringify(base));
    if (p.dob === 'today') { const d = new Date(); p.dob = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
    const clock = M.clock(p);
    p.clock = clock;
    p.admitTime = p.admitted ? clock.at(p.admitted) : clock.simStart;
    const start = clock.simStart;
    const stamp = (arr, ref, extra) => (arr || []).map(x => Object.assign({}, x, { time: clock.at(x, ref) }, extra || {}));

    p.orders = stamp(p.orders, p.admitTime).map(o => M.corrected(pid, o)).map(o => Object.assign({ status: 'Active' }, o));
    p.labs = stamp(p.labs, start);
    p.imaging = stamp(p.imaging, start);
    p.notes = stamp(p.notes, start);
    p.vitalsPrior = stamp(p.vitals, start);
    p.ioPrior = stamp(p.io, start);
    p.priorAssessments = stamp(p.priorAssessments, start);
    p.documents = stamp(p.documents, start);
    const today = new Date(start); today.setHours(0, 0, 0, 0);
    const auto = p.priorDosesGiven != null ? p.priorDosesGiven : (p.experiences || []).some(e => e === 'advms' || e === 'icu');
    const ctx = { start, today: today.getTime(), auto, initials: p.priorRN || 'LJ', daysAhead: clock.staged ? Math.max(...p.scenarioShifts.map(s => s.day)) + 1 : 1 };
    p.meds = (p.meds || []).map(m => prepMed(clock, M.corrected(pid, m, true), p.admitTime, null, ctx));

    const rel = Store.released(pid);
    p.releasedEvents = [];
    (p.events || []).forEach(ev => {
      if (!rel[ev.id]) return;
      const rt = clock.toSim(rel[ev.id]);
      p.releasedEvents.push({ id: ev.id, title: ev.title, time: rt });
      const extra = { isNew: true, eventId: ev.id };
      if (ev.patch) Object.assign(p, ev.patch);
      (ev.discontinue || []).forEach(id => {
        const m = p.meds.find(x => x.id === id);
        if (m && m.status !== 'Discontinued') { m.status = 'Discontinued'; m.dcTime = rt; }
        const o = p.orders.find(x => x.id === id);
        if (o) { o.status = 'Discontinued'; o.dcTime = rt; }
      });
      // hold: [{ id, reason }] — a released order puts a medication on hold (Undo restores it).
      (ev.hold || []).forEach(h => {
        const m = p.meds.find(x => x.id === h.id);
        if (m && m.status === 'Active') { m.status = 'Held'; m.holdReason = h.reason || 'On hold per provider order'; m.heldTime = rt; }
      });
      (ev.activate || []).forEach(id => {
        const m = p.meds.find(x => x.id === id);
        if (m) { m.status = 'Active'; m.isNew = true; m.eventId = ev.id; delete m.holdReason; }
      });
      p.orders.push(...stamp(ev.orders, rt, extra).map(o => M.corrected(pid, o)).map(o => Object.assign({ status: 'Active' }, o)));
      p.labs.push(...stamp(ev.labs, rt, extra));
      p.imaging.push(...stamp(ev.imaging, rt, extra));
      p.notes.push(...stamp(ev.notes, rt, extra));
      p.documents.push(...stamp(ev.documents, rt, extra));
      p.vitalsPrior.push(...stamp(ev.vitals, rt, extra));
      p.ioPrior.push(...stamp(ev.io, rt, extra));
      (ev.meds || []).forEach(m => p.meds.push(prepMed(clock, M.corrected(pid, m, true), rt, extra, ctx)));
    });

    // Older session edits may contain entire lab panels from before a source flag was added.
    // Inherit only missing flags for the same record/test/value/unit; keep changed results
    // and explicit faculty flags (including a deliberately blank flag) untouched.
    const original = (window.SIM_PATIENTS || []).find(x => x.id === pid);
    const sourceLabs = original ? [...(original.labs || []), ...(original.events || []).flatMap(e => e.labs || [])] : [];
    p.labs.forEach(panel => {
      const source = sourceLabs.find(x => x.id === panel.id);
      if (!source) return;
      panel.results = (panel.results || []).map(row => {
        if (Object.prototype.hasOwnProperty.call(row, 'flag')) return row;
        const match = (source.results || []).find(x => x.t === row.t && x.v === row.v && x.u === row.u);
        return match && match.flag ? Object.assign({}, row, { flag: match.flag }) : row;
      });
    });

    // Orders entered during the sim: faculty orders, and student verbal/telephone orders once
    // faculty approve them. Each is NEW until a student acknowledges it; medications go on the MAR.
    M.enteredOrders(pid).filter(o => o.state === 'active').forEach(o => {
      const extra = { isNew: true, entered: o };
      if (o.med) {
        const med = prepMed(clock, M.enteredMed(o), o.activeTime, extra, ctx);
        if (o.dcTime) { med.status = 'Discontinued'; med.dcTime = o.dcTime; }
        p.meds.push(med);
      } else {
        p.orders.push({ id: o.id, cat: o.cat || 'Nursing', text: o.text, by: o.provider, time: o.activeTime, priority: o.priority,
          status: o.dcTime ? 'Discontinued' : 'Active', dcTime: o.dcTime, isNew: true, entered: o });
      }
    });

    // Faculty discontinued a chart or released order / medication (doc.orders kind 'dc' with ref = its id).
    (Store.doc(pid).orders || []).filter(e => e.status === 'active' && e.data.kind === 'dc').forEach(e => {
      [...p.meds.filter(m => !m.entered), ...p.orders.filter(o => !o.entered)].filter(x => x.id === e.data.ref && x.status !== 'Discontinued')
        .forEach(x => { x.status = 'Discontinued'; x.dcTime = e.time; x.dcEntry = e; });
    });
    return p;
  };

  /* ---------- Orders entered during the sim ---------- */

  // doc.orders holds three kinds of entries:
  //   (no kind)        student verbal/telephone order — pending until faculty decide
  //   kind 'faculty'   order entered by faculty — active right away
  //   kind 'approval'  faculty decision on a student order: { ref, decision: 'approved'|'declined', order, reason }
  //   kind 'dc'        faculty discontinued an entered order: { ref }
  // An approval or discontinue marked "entered in error" no longer counts.
  M.enteredOrders = function (pid, doc) {
    doc = doc || Store.doc(pid);
    const live = (doc.orders || []).filter(e => e.status === 'active');
    const decision = {}, dc = {};
    live.forEach(e => { if (e.data.kind === 'approval') decision[e.data.ref] = e; if (e.data.kind === 'dc') dc[e.data.ref] = e; });
    return live.filter(e => !e.data.kind || e.data.kind === 'faculty').map(e => {
      const faculty = e.data.kind === 'faculty';
      const d = faculty ? null : decision[e.id];
      const state = faculty ? 'active' : !d ? 'pending' : d.data.decision === 'approved' ? 'active' : 'declined';
      const correction = M.correction(doc, 'ord-' + String(e.id).toLowerCase());
      const o = Object.assign({}, e.data, state === 'active' && d ? d.data.order : {}, correction ? correction.data.order : {});
      return {
        id: 'ord-' + String(e.id).toLowerCase(), entry: e, decision: d || null, faculty, state,
        cat: o.cat, text: o.text, provider: o.provider, priority: o.priority === 'Routine' ? '' : o.priority, med: o.med || null, firstNow: !!o.firstNow,
        orderTime: e.time, activeTime: faculty ? e.time : d ? d.time : null,
        dcTime: dc[e.id] && state === 'active' ? dc[e.id].time : null, dcEntry: dc[e.id] || null
      };
    });
  };

  // Medication definition for an entered order, in the same form as the patient data.
  M.enteredMed = function (o) {
    const m = Object.assign({}, o.med, { id: o.id, orderedBy: o.provider });
    const every = /(?:every|q)\s*(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\b/i.exec(m.freq || '');
    if (m.type === 'prn' && every && !m.minIntervalHr) m.minIntervalHr = Number(every[1]);
    if (m.type === 'continuous' && !m.rate) m.rate = m.dose;
    if (m.type === 'once') m.doses = [{ at: 0 }];
    if (m.type === 'scheduled') {
      if (!M.standardTimes(m.freq) && every) {
        // No standard schedule for this frequency (e.g., every 2 hours): doses every N hours for 24 hours.
        const n = Number(every[1]) * 60;
        m.fixedTimes = true;
        m.doses = []; for (let t = 0; t < 1440; t += n) m.doses.push({ at: t });
      } else if (!M.standardTimes(m.freq)) { m.fixedTimes = true; m.doses = [{ at: 0 }]; }
      else if (o.firstNow) m.doses = [{ at: 0 }];   // first dose now, then the standard times
    }
    return m;
  };
  // Every printed label for a patient, as on labels.html: medications (base, scenario events, and
  // orders entered during the sim) and unit-dose products. code = the 8-digit number in the barcode.
  M.labelSet = function (p) {
    const meds = [...(p.meds || []), ...(p.events || []).flatMap(e => (e.meds || []).map(m => Object.assign({ eventTitle: e.title, eventId: e.id }, m))), ...M.enteredMeds(p.id)]
      .filter(m => m.status !== 'Do Not Administer');
    const units = meds.filter(m => m.type !== 'continuous').flatMap(m => Scan.products(m).map(d => ({ m, d })))
      .filter((x, i, arr) => arr.findIndex(y => Scan.productCode(y.m, y.d) === Scan.productCode(x.m, x.d)) === i);
    // Student package labels come only from visible orders or released events. The complete catalog
    // is fetched from the private server only while Faculty is unlocked.
    const facultyCatalog = Store.instructorUnlocked() && window.Shared ? Shared.facultyCatalog() : null;
    const packageRows = new Map();
    const addPackage = (info, source) => {
      if (!info || !info.code) return;
      const existing = packageRows.get(info.code);
      packageRows.set(info.code, { code: info.code, pkg: Object.assign({}, source || {}, info), meds: existing ? existing.meds : [] });
    };
    meds.forEach(item => (item.barcodePackages || []).forEach(info => addPackage(info)));
    if (facultyCatalog) {
      const defaults = new Map((facultyCatalog.defaults || []).map(item => [item.id, item]));
      Object.entries(facultyCatalog.packages || {}).forEach(([code, source]) => {
        if (!(source.patients || []).includes(p.id)) return;
        const d = defaults.get(code) || {};
        addPackage({ code, name: d.name || source.name || code, strength: d.strength || '', form: d.form || '', blood: !!source.blood }, source);
      });
    }
    for (const row of packageRows.values()) row.meds = meds.filter(item => Scan.pkgMatches(row.code, item));
    return {
      meds: meds.map(m => ({ kind: 'med', m, text: M.barcodeFor(m), code: Scan.shortCode(M.barcodeFor(m)) })),
      units: units.map(x => ({ kind: 'unit', m: x.m, d: x.d, text: Scan.productCode(x.m, x.d), code: Scan.shortCode(Scan.productCode(x.m, x.d)) })),
      atu: {
        wrist: Scan.wristbandFor(p),
        packages: [...packageRows.values()],
        // No ATU package (e.g., a new drug a faculty member orders): a drug-level unit-dose label when the dose
        // has a strength — the same label for every patient — otherwise the order's own label.
        unpackaged: meds.filter(m => !pkgOf.get(m)).map(m => {
          const d = m.type !== 'continuous' ? Scan.parseDose(m.dose) : null;
          return d ? { m, d, product: true, text: Scan.productCode(m, d), code: Scan.shortCode(Scan.productCode(m, d)) } : { m, code: Scan.shortCode(M.barcodeFor(m)) };
        })
      }
    };
  };

  // Medications from entered orders (for labels and barcode lookups).
  M.enteredMeds = pid => M.enteredOrders(pid).filter(o => o.state === 'active' && o.med).map(M.enteredMed);

  /* ---------- Medications ---------- */

  M.medLabel = m => [m.name, m.dose, m.route, m.freq].filter(x => x && x !== '—').join(' — ');

  M.allergyConflicts = (p, med) =>
    (p.allergies || []).filter(a => (a.tags || []).some(t => (med.tags || []).includes(t)) ||
      // Orders entered during the sim have no drug-class tags: match the allergy name in the drug name.
      (med.entered && (String(a.agent).match(/[A-Za-z]{4,}/g) || []).some(w => new RegExp(w, 'i').test(med.name))));

  M.marEntries = (doc, medId) => doc.mar.filter(e => e.data.medId === medId);
  M.doseInCurrentShift = (p, dt) => !p.clock.staged || (dt.time >= p.clock.stageStart && dt.time < p.clock.stageEnd);

  M.doseStatus = function (p, doc, med, dt) {
    const entries = doc.mar.filter(e => e.status === 'active' && e.data.doseKey === dt.key);
    if (entries.length) {
      const e = entries[entries.length - 1];
      return { code: e.data.action === 'Given' ? 'given' : 'notgiven', entry: e };
    }
    if (dt.priorBy) return { code: 'given', prior: true };
    if (dt.priorNotGiven) return { code: 'notgiven', prior: true };
    if (dt.notToday) return { code: 'notdue' };
    if (med.startsOn && p.clock.now() < med.startsOn) return { code: 'notyet' };
    if (med.status === 'Discontinued' && dt.time >= (med.dcTime || 0)) return { code: 'dc' };
    if (med.status !== 'Active') return { code: 'hold' };
    const w = C.medWindowMinutes * MIN;
    const diff = p.clock.now() - dt.time;
    if (diff < -w) return { code: 'future' };
    if (diff <= w) return { code: 'due' };
    return { code: 'overdue' };
  };

  // Most recent administration (student or prior) for PRN interval checks.
  M.lastGiven = function (doc, med) {
    const given = doc.mar.filter(e => e.status === 'active' && e.data.medId === med.id && e.data.action === 'Given')
      .map(e => ({ time: e.time, by: e.user.name }));
    if (med.lastGivenPrior) given.push(med.lastGivenPrior);
    (med.doseTimes || []).forEach(d => { if (d.priorBy) given.push({ time: d.time, by: d.priorBy }); });
    given.sort((a, b) => b.time - a.time);
    return given[0] || null;
  };

  M.dueCounts = function (p, doc) {
    let due = 0, overdue = 0;
    p.meds.forEach(m => (m.doseTimes || []).forEach(dt => {
      if (!M.doseInCurrentShift(p, dt)) return;
      const s = M.doseStatus(p, doc, m, dt).code;
      if (s === 'due') due++;
      if (s === 'overdue') overdue++;
    }));
    return { due, overdue };
  };

  /* ---------- Orders & acknowledgment ---------- */

  M.medOrders = p => p.meds.map(m => ({
    id: m.id, cat: 'Medication', text: M.medLabel(m), detail: [m.indication ? 'Indication: ' + m.indication : '', m.instructions, m.holdReason].filter(Boolean).join(' '),
    by: m.orderedBy || p.attending, time: m.entered ? m.entered.orderTime : m.orderTime, dcTime: m.dcTime, status: m.status, isNew: m.isNew, priority: m.priority, protocol: m.protocol, set: m.orderSet, med: m, entered: m.entered, dcEntry: m.dcEntry
  }));

  M.isAcked = (doc, ref) => { const correction = M.revision(doc, ref); return doc.ack.some(e => e.status === 'active' && e.data.ref === ref && (!correction || e.data.revision === correction.id)); };

  M.unackedOrders = (p, doc) =>
    [...p.orders.filter(o => o.isNew), ...M.medOrders(p).filter(o => o.isNew)].filter(o => !M.isAcked(doc, o.id));

  M.unreviewedResults = (p, doc) =>
    [...p.labs.filter(l => l.isNew), ...p.imaging.filter(l => l.isNew)].filter(l => !M.isAcked(doc, l.id));

  /* ---------- Vitals & labs ---------- */

  M.ranges = p => Object.assign({}, C.vitalRanges, p.vitalRanges || {});

  M.flag = function (p, key, v) {
    const n = U.num(v);
    const r = M.ranges(p)[key];
    if (n == null || !r) return '';
    if (n < r[0]) return 'L';
    if (n > r[1]) return 'H';
    return '';
  };

  M.map = v => (U.num(v.sbp) != null && U.num(v.dbp) != null) ? Math.round((Number(v.sbp) + 2 * Number(v.dbp)) / 3) : null;

  // All vital-sign rows, newest first: prior chart + student entries.
  M.vitals = function (p, doc) {
    const rows = p.vitalsPrior.map(v => Object.assign({ source: 'prior' }, v));
    doc.vitals.forEach(e => rows.push(Object.assign({ source: 'student', entry: e, time: e.time, by: e.user.name + (e.user.cred ? ', ' + e.user.cred : '') }, e.data)));
    return rows.sort((a, b) => b.time - a.time);
  };

  M.latestVital = function (p, doc, key) {
    const row = M.vitals(p, doc).find(r => (!r.entry || r.entry.status === 'active') && !U.isEmpty(r[key]));
    return row ? { value: row[key], time: row.time } : null;
  };

  // Lab values may be numbers or numeric strings (to keep the printed precision, e.g. '9.0').
  M.labNum = v => typeof v === 'number' ? v : (/^-?\d+(\.\d+)?$/.test(String(v).trim()) ? Number(v) : null);
  M.labFlag = function (r) {
    if (r.flag) return r.flag;
    const n = M.labNum(r.v);
    if (n == null) return '';
    if (r.lo != null && n < r.lo) return 'L';
    if (r.hi != null && n > r.hi) return 'H';
    return '';
  };
  M.labRef = r => r.ref || (r.lo != null && r.hi != null ? `${r.lo}–${r.hi}` : '');

  M.latestLab = function (p, name) {
    const want = name.toLowerCase();
    const panels = [...p.labs].sort((a, b) => b.time - a.time);
    for (const panel of panels) {
      const r = panel.results.find(x => x.t.toLowerCase() === want && M.labNum(x.v) != null);
      if (r) return { value: r.v, unit: r.u, time: panel.time, flag: M.labFlag(r) };
    }
    return null;
  };

  /* ---------- Intake & output ---------- */

  M.io = function (p, doc) {
    const rows = p.ioPrior.map(r => Object.assign({ source: 'prior' }, r));
    doc.io.filter(e => e.status === 'active').forEach(e => rows.push(Object.assign({ source: 'student', entry: e, time: e.time }, e.data)));
    return rows.sort((a, b) => b.time - a.time);
  };

  /* ---------- Misc ---------- */

  M.lateLabel = e => {
    const late = e.recorded - e.time > C.lateEntryMinutes * MIN;
    return late ? `Late entry — charted ${U.fmtDT(e.recorded)}` : '';
  };

  M.signature = e => `${e.user.name}${e.user.cred ? ', ' + e.user.cred : ''}`;

  M.bmi = p => (p.heightCm && p.weightKg) ? (p.weightKg / Math.pow(p.heightCm / 100, 2)).toFixed(1) : null;

  window.Model = M;
})();
