/*
 * Shared charting across devices (Supabase). Set up with supabase/setup.sql; configured by
 * EHR_CONFIG.shared in js/config.js (public project URL + publishable key only).
 *
 * Each device signs in once (Shared connection), normally with the one hospital login used on
 * every simulation computer (EHR_CONFIG.shared.defaultEmail). The login's role
 * (student / observer / faculty) is checked by the server for every change.
 *
 *   - The chart on screen = the shared chart (mirror) + this device's changes still waiting
 *     to be shared (outbox). Waiting changes survive reloads and are retried until they
 *     are accepted; the header says "Not shared yet" until the server confirms them.
 *   - Every change has an id, so a retried or double-clicked save is stored only once.
 *   - Faculty Reset moves the patient to a new "epoch". Entries started before the reset
 *     (for example from a previous group's laptop that was offline) are refused.
 *   - Other devices' charting is picked up every few seconds (and right after each save).
 *
 * Plain fetch calls (no library), so it also runs on older iPad Safari.
 */
(function () {
  'use strict';
  const C = window.EHR_CONFIG;
  const cfg = C.shared && C.shared.url && C.shared.key && !C.orientation ? C.shared : null;
  const P = C.storagePrefix + '.shared.';
  const POLL_MS = 5000;

  const read = (k, d) => { try { const v = localStorage.getItem(P + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const local = (k, v) => { try { localStorage.setItem(C.storagePrefix + '.' + k, JSON.stringify(v)); } catch (e) { /* reported by Store */ } };
  const clone = o => JSON.parse(JSON.stringify(o));
  const protectedKeys = new Set(['events','facultyguide','instructorguide','instructornotes','facultynotes','scenarioitems','pendingevents']);
  function scrubProtected(value) {
    if (Array.isArray(value)) return value.map(scrubProtected);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !protectedKeys.has(key.toLowerCase())).map(([key, child]) => [key, scrubProtected(child)]));
  }
  const SECTIONS = () => window.Store.SECTIONS;

  let status = cfg ? (read('auth', null) ? 'syncing' : 'signedout') : 'off';
  let lastError = '';
  let timer = null, retryMs = 2000, needsRender = false, firstPullDone = false;
  const FACULTY_KEY = P + 'faculty-session';
  let facultyEvents = {}, releasedEvents = {}, facultyEventsReady = false, facultyLoadedAt = 0;
  let facultyCatalog = null, facultyCatalogReady = false;
  // Sending and receiving run one at a time, in order, so a reply never overwrites a newer change.
  let chain = Promise.resolve(), flushQueued = false, pullQueued = false;
  const serial = fn => (chain = chain.then(fn).catch(() => {}));

  /* ---------- server calls ---------- */

  const auth = () => read('auth', null);
  function facultySession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(FACULTY_KEY) || 'null');
      if (!s || !s.token || Number(s.expiresAt) <= Date.now()) { sessionStorage.removeItem(FACULTY_KEY); return null; }
      return s;
    } catch (e) { return null; }
  }
  const facultyToken = () => { const s = facultySession(); return s && s.token || null; };
  function clearFacultySession() {
    try { sessionStorage.removeItem(FACULTY_KEY); } catch (e) { /* ignore */ }
    facultyEvents = {}; facultyEventsReady = false; facultyLoadedAt = 0;
    facultyCatalog = null; facultyCatalogReady = false;
  }
  function headers(token) {
    const h = { apikey: cfg.key, 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return h;
  }
  class NetError extends Error {}
  class ServerError extends Error { constructor(msg, httpStatus, code) { super(msg); this.httpStatus = httpStatus; this.code = code; } }

  async function http(path, opts) {
    let res;
    try { res = await fetch(cfg.url.replace(/\/+$/, '') + path, opts); } catch (e) { throw new NetError('No connection'); }
    const text = await res.text();
    let body = null; try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
    if (!res.ok) {
      const msg = body && (body.message || body.msg || body.error_description || body.error) || ('HTTP ' + res.status);
      if (res.status >= 500 || res.status === 408 || res.status === 429) throw new NetError(msg);
      throw new ServerError(msg, res.status, body && body.code);
    }
    return { body, res };
  }

  async function token() {
    const a = auth();
    if (!a) throw new ServerError('Not signed in', 401);
    if (a.exp - Date.now() > 60000) return a.access;
    const { body } = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: headers(), body: JSON.stringify({ refresh_token: a.refresh }) });
    saveAuth(body, a);
    return body.access_token;
  }
  function saveAuth(b, prev) {
    write('auth', { access: b.access_token, refresh: b.refresh_token, exp: Date.now() + (b.expires_in || 3600) * 1000,
      uid: b.user ? b.user.id : prev && prev.uid, email: b.user ? b.user.email : prev && prev.email, role: prev && prev.role || null });
  }

  async function api(path, opts) {
    opts = opts || {};
    const go = async () => http(path, Object.assign({}, opts, { headers: Object.assign(headers(await token()), opts.headers || {}) }));
    try { return await go(); } catch (e) {
      if (e instanceof ServerError && e.httpStatus === 401 && auth()) {
        const a = auth(); a.exp = 0; write('auth', a);   // force a refresh, then try once more
        try { return await go(); } catch (e2) {
          if (e2 instanceof ServerError && e2.httpStatus === 401) signedOut('Your shared connection expired. Connect again.');
          throw e2;
        }
      }
      throw e;
    }
  }
  const rpc = (fn, args) => api('/rest/v1/rpc/' + fn, { method: 'POST', body: JSON.stringify(args) }).then(r => r.body);
  const base = () => ({ p_app: cfg.app, p_session: cfg.session });
  const q = s => encodeURIComponent(s);

  async function loadFacultyEvents() {
    const token = facultyToken();
    if (!token || !auth()) return false;
    const rows = await rpc('ehr_faculty_get_events', Object.assign(base(), { p_token: token }));
    const next = {};
    (Array.isArray(rows) ? rows : []).forEach(row => {
      if (!row || !row.patient_id || !row.event) return;
      (next[row.patient_id] || (next[row.patient_id] = [])).push(row.event);
    });
    facultyEvents = next; facultyEventsReady = true; facultyLoadedAt = Date.now();
    needsRender = true; maybeRender();
    return true;
  }

  async function loadFacultyCatalog() {
    const token = facultyToken();
    if (!token || !auth()) return false;
    const result = await rpc('ehr_faculty_get_catalog', Object.assign(base(), { p_token: token }));
    if (!result || typeof result !== 'object' || !result.packages) throw new Error('The private barcode catalog could not be loaded.');
    facultyCatalog = result; facultyCatalogReady = true;
    return true;
  }

  async function facultyUnlock(passphrase) {
    if (!cfg || !auth()) throw new ServerError('Connect to the shared hospital chart before unlocking Faculty.', 401);
    const result = await rpc('ehr_faculty_unlock', Object.assign(base(), { p_passphrase: passphrase }));
    if (!result || !result.token) return false;
    const expiresAt = Date.parse(result.expires_at) || Date.now() + 4 * 60 * 60 * 1000;
    try { sessionStorage.setItem(FACULTY_KEY, JSON.stringify({ token: result.token, expiresAt })); }
    catch (e) { throw new Error('This browser could not keep the short-lived Faculty session.'); }
    facultyEvents = {}; facultyEventsReady = false;
    try { await loadFacultyEvents(); await loadFacultyCatalog(); }
    catch (e) { await facultyLock(); throw e; }
    return true;
  }

  async function facultyLock() {
    const s = facultySession();
    clearFacultySession();
    if (s && auth()) {
      try { await rpc('ehr_faculty_lock', Object.assign(base(), { p_token: s.token })); } catch (e) { /* token expires automatically */ }
    }
    needsRender = true; maybeRender();
  }

  async function facultySaveEvent(pid, event) {
    const token = facultyToken();
    if (!token) throw new ServerError('Unlock Faculty again before editing scenario releases.', 401);
    const result = await rpc('ehr_faculty_save_event', Object.assign(base(), { p_patient: pid, p_token: token, p_event: event }));
    if (result !== 'ok') throw new Error('The scenario release could not be saved.');
    const list = facultyEvents[pid] || (facultyEvents[pid] = []), i = list.findIndex(x => x.id === event.id);
    if (i < 0) list.push(clone(event)); else list[i] = clone(event);
    facultyEventsReady = true; facultyLoadedAt = Date.now(); needsRender = true; maybeRender();
    return true;
  }

  async function facultyCorrectEvent(pid, event) {
    const token = facultyToken();
    if (!token) throw new ServerError('Unlock Faculty again before correcting chart items.', 401);
    const result = await rpc('ehr_faculty_correct_event', Object.assign(base(), {
      p_patient: pid, p_epoch: mirrorOf(pid).epoch, p_token: token, p_event: event
    }));
    if (result !== 'ok') throw new Error('This item is no longer released in the current chart.');
    const list = facultyEvents[pid] || (facultyEvents[pid] = []), i = list.findIndex(x => x.id === event.id);
    if (i >= 0) list[i] = clone(event);
    facultyEventsReady = true; facultyLoadedAt = Date.now();
    await pull(true); return true;
  }

  async function facultyRelease(pid, eventId, on, at) {
    const token = facultyToken();
    if (!token) throw new ServerError('Unlock Faculty again before releasing scenario items.', 401);
    const result = await rpc('ehr_faculty_release', Object.assign(base(), {
      p_patient: pid, p_epoch: mirrorOf(pid).epoch, p_event: eventId, p_on: !!on, p_at: Number(at || 0), p_token: token
    }));
    if (result !== 'ok') return false;
    await pull(true);
    return true;
  }

  async function selectAll(table, filter, columns) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { body } = await api(`/rest/v1/${table}?select=${columns}&app=eq.${q(cfg.app)}&session_id=eq.${q(cfg.session)}${filter}`,
        { headers: { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } });
      out.push(...body);
      if (body.length < 1000) return out;
    }
  }

  /* ---------- mirror (shared chart) + outbox (waiting changes) ---------- */

  const mirrors = () => read('mirror', {});
  const emptyMirror = () => ({ epoch: 1, realStart: null, released: {}, edits: {}, editRevision: 0, doc: {} });
  const mirrorOf = pid => mirrors()[pid] || emptyMirror();
  const setMirror = (pid, m) => { const all = mirrors(); all[pid] = m; write('mirror', all); };
  const outbox = () => read('outbox', []);
  const setOutbox = list => { write('outbox', list); paint(); };

  function placeEntry(doc, section, entry) {
    const list = doc[section] || (doc[section] = []);
    const i = list.findIndex(x => x.id === entry.id);
    if (i >= 0) list[i] = entry; else list.push(entry);
  }
  function applyOp(m, o) {
    if (o.epoch !== m.epoch) return;
    if (o.op === 'add' && o.epoch === m.epoch) placeEntry(m.doc, o.section, o.entry);
    if (o.op === 'err' && o.epoch === m.epoch) SECTIONS().forEach(s => (m.doc[s] || []).forEach(e => { if (e.id === o.id) { e.status = 'error'; e.error = o.error; } }));
    if (o.op === 'rel') { if (o.on) m.released[o.ev] = o.at; else delete m.released[o.ev]; }
    if (o.op === 'clock') m.realStart = o.start;
    if (o.op === 'start' && m.realStart == null) m.realStart = o.start;
    if (o.op === 'edit' && o.revision === (m.editRevision || 0)) { m.edits = clone(o.edits); m.editRevision = o.revision + 1; }
  }
  // Rebuild what this device shows for a patient: shared chart + waiting changes.
  function compose(pid) {
    const m = clone(mirrorOf(pid));
    outbox().filter(o => o.pid === pid).forEach(o => applyOp(m, o));
    SECTIONS().forEach(s => { if (!m.doc[s]) m.doc[s] = []; });
    local('doc.' + pid, m.doc);
    local('released.' + pid, m.released);
    local('patientEdits.' + pid, m.edits || {});
    if (m.realStart != null) local('sim.' + pid, { realStart: m.realStart });
    else { try { localStorage.removeItem(C.storagePrefix + '.sim.' + pid); } catch (e) { /* ignore */ } }
  }

  /* ---------- sending ---------- */

  function queue(o) {
    o.key = U.uid();
    o.epoch = mirrorOf(o.pid).epoch;
    if (o.op === 'edit') o.revision = (mirrorOf(o.pid).editRevision || 0) + outbox().filter(x => x.pid === o.pid && x.op === 'edit' && x.epoch === o.epoch).length;
    const list = outbox(); list.push(o); setOutbox(list);
    flush();
  }

  async function send(o) {
    const a = base(); a.p_patient = o.pid; a.p_epoch = o.epoch;
    if (o.op === 'add') {
      const kind = o.section === 'orders' && o.entry.data && o.entry.data.kind;
      if (['approval','faculty','dc','correction','chart-correction'].includes(kind)) {
        const token = facultyToken();
        if (!token) throw new ServerError('Unlock Faculty before sharing this action.', 401);
        return rpc('ehr_faculty_add_entry', Object.assign(a, { p_section: o.section, p_id: o.entry.id, p_entry: o.entry, p_token: token }));
      }
      return rpc('ehr_add_entry', Object.assign(a, { p_section: o.section, p_id: o.entry.id, p_entry: o.entry }));
    }
    if (o.op === 'err') return rpc('ehr_mark_error', Object.assign(a, { p_epoch: o.epoch, p_id: o.id, p_error: o.error }));
    if (o.op === 'rel') return rpc('ehr_faculty_release', Object.assign(a, { p_event: o.ev, p_on: o.on, p_at: o.at, p_token: facultyToken() }));
    if (o.op === 'clock') return rpc('ehr_faculty_set_clock', Object.assign(a, { p_start: o.start, p_token: facultyToken() }));
    if (o.op === 'start') return rpc('ehr_start_clock', Object.assign(a, { p_start: o.start }));
    if (o.op === 'edit') return rpc('ehr_faculty_edit_patient', Object.assign(a, { p_revision: o.revision, p_edits: o.edits, p_token: facultyToken() }));
  }

  function flush() {
    if (!cfg || !auth() || flushQueued) return chain;
    flushQueued = true;
    return serial(() => { flushQueued = false; return doFlush(); });
  }
  async function doFlush() {
    if (!auth()) return;
    try {
      for (;;) {
        const list = outbox();
        const facultyOnly = o => ['rel','clock','edit'].includes(o.op) ||
          (o.op === 'add' && o.section === 'orders' && o.entry.data && ['approval','faculty','dc','correction','chart-correction'].includes(o.entry.data.kind));
        const index = list.findIndex(o => !facultyOnly(o) || facultyToken());
        const o = index < 0 ? null : list[index];
        if (!o) break;
        let result, refused = '';
        try { result = await send(o); } catch (e) {
          if (e instanceof NetError) { offline(e.message); return; }
          if (!auth()) return;
          refused = e.message || 'The server refused this change.';
        }
        const m = mirrorOf(o.pid);
        const outcome = result && typeof result === 'object' ? result.status : result;
        if (outcome === 'conflict') refused = 'Another faculty device changed this chart. Reopen the item and apply your correction again.';
        if (outcome === 'missing') refused = 'This chart entry is no longer available to correct.';
        if (refused) UI.toast('Not shared: ' + refused, 'error');
        else if (outcome === 'stale') UI.toast('A change was not added because this patient was reset for a new group.', 'warn');
        else if (o.op === 'start' && result && result.start != null) { m.realStart = Number(result.start); }
        else applyOp(m, o);
        setMirror(o.pid, m);
        setOutbox(outbox().filter(x => x.key !== o.key));
        compose(o.pid);
        if (refused || outcome === 'stale') needsRender = true;
      }
      retryMs = 2000;
      // Only a successful read confirms a healthy shared connection.
    } finally { paint(); }
    pull();
  }

  function offline(msg) {
    status = 'offline'; lastError = msg; paint();
    clearTimeout(flush.t);
    flush.t = setTimeout(flush, retryMs);
    retryMs = Math.min(retryMs * 2, 30000);
  }

  /* ---------- receiving ---------- */

  function pull(full) {
    if (!cfg || !auth() || (pullQueued && !full)) return chain;
    pullQueued = true;
    return serial(() => { pullQueued = false; return doPull(full); });
  }
  async function doPull(full) {
    if (!auth()) return;
    try {
      if (facultyToken() && (!facultyEventsReady || Date.now() - facultyLoadedAt > 30000 || !facultyCatalogReady)) {
        try { await loadFacultyEvents(); await loadFacultyCatalog(); } catch (e) { clearFacultySession(); needsRender = true; }
      }
      const patientColumns = 'patient_id,epoch,real_start,released,edit_revision,updated_at';
      let pts = await selectAll('ehr_patients', '', patientColumns);
      // Check small metadata on every poll; download edited content/attachments only when its revision changes.
      const editPids = pts.filter(r => r.edit_revision > 0 && (!firstPullDone || mirrorOf(r.patient_id).epoch !== r.epoch || (mirrorOf(r.patient_id).editRevision || 0) !== r.edit_revision)).map(r => r.patient_id);
      if (editPids.length) {
        const changed = await selectAll('ehr_patients', '&patient_id=in.' + q('(' + editPids.map(id => JSON.stringify(id)).join(',') + ')'), patientColumns + ',edits');
        pts = pts.map(r => changed.find(c => c.patient_id === r.patient_id) || r);
      }
      const all = mirrors(), prevAll = mirrors();
      const since = full || !firstPullDone ? null : read('since', null);
      const resetPids = [];
      const alerts = [];
      pts.forEach(r => {
        const m = all[r.patient_id] || emptyMirror();
        if (m.epoch !== r.epoch) { m.epoch = r.epoch; m.doc = {}; resetPids.push(r.patient_id); }
        if (firstPullDone) Object.keys(r.released || {}).forEach(ev => { if (!m.released[ev]) alerts.push({ pid: r.patient_id, ev }); });
        m.realStart = r.real_start == null ? null : Number(r.real_start);
        m.released = r.released || {};
        m.edits = scrubProtected(r.edits || (r.edit_revision > 0 ? m.edits || {} : {}));
        m.editRevision = Number(r.edit_revision || 0);
        all[r.patient_id] = m;
      });
      const eventRows = await selectAll('ehr_scenario_releases', '', 'patient_id,epoch,event_id,event_payload,released_at');
      const nextReleasedEvents = {};
      eventRows.forEach(row => {
        if (!all[row.patient_id] || Number(row.epoch) !== Number(all[row.patient_id].epoch) || !row.event_payload) return;
        (nextReleasedEvents[row.patient_id] || (nextReleasedEvents[row.patient_id] = [])).push(row.event_payload);
      });
      releasedEvents = nextReleasedEvents;
      // Changed entries since the last check (with a little overlap; merging by id makes repeats harmless).
      const filter = since && !resetPids.length ? `&updated_at=gt.${q(new Date(new Date(since).getTime() - 10000).toISOString())}` : '';
      const rows = await selectAll('ehr_entries', filter + '&order=created_at.asc,id.asc', 'id,patient_id,epoch,section,entry,updated_at');
      if (!filter) Object.keys(all).forEach(pid => { all[pid].doc = {}; });
      let newest = since;
      rows.forEach(r => {
        const m = all[r.patient_id] || (all[r.patient_id] = emptyMirror());
        if (r.epoch !== m.epoch) return;
        // New faculty orders and approvals from another device: tell students once.
        const k = r.section === 'orders' && r.entry.data && r.entry.data.kind;
        if (firstPullDone && (k === 'faculty' || (k === 'approval' && r.entry.data.decision === 'approved')) && !((prevAll[r.patient_id] || emptyMirror()).doc.orders || []).some(x => x.id === r.entry.id) &&
          !outbox().some(o => o.op === 'add' && o.entry.id === r.entry.id)) alerts.push({ pid: r.patient_id, order: true });
        placeEntry(m.doc, r.section, r.entry);
        if (!newest || r.updated_at > newest) newest = r.updated_at;
      });
      if (newest) write('since', newest);
      // Waiting changes from before a reset never enter the new group's chart.
      if (resetPids.length) {
        const keep = outbox().filter(o => !(resetPids.includes(o.pid) && o.epoch !== all[o.pid].epoch));
        if (keep.length !== outbox().length) { setOutbox(keep); UI.toast('A patient was reset for a new group; unsent entries for that patient were discarded.', 'warn'); }
      }
      const before = JSON.stringify(mirrors());
      write('mirror', all);
      const ids = Object.keys(all);
      Model.allPatients().forEach(p => { if (!ids.includes(p.id)) ids.push(p.id); });
      ids.forEach(compose);
      if (!firstPullDone || before !== JSON.stringify(all)) needsRender = true;
      firstPullDone = true;
      if (!outbox().length) { status = 'shared'; lastError = ''; }
      alerts.forEach(a => a.order ? orderAlert(a.pid) : releaseAlert(a.pid, a.ev));
      return true;
    } catch (e) {
      if (e instanceof NetError) { status = 'offline'; lastError = e.message; }
      else if (auth()) { status = 'error'; lastError = e.message; }
      return false;
    } finally { paint(); maybeRender(); }
  }

  // Student devices: tell the student once when faculty release something for an open patient.
  function releaseAlert(pid, ev) {
    if (!window.Screens || Screens.mode() !== 'student') return;
    const p = Model.base(pid);
    if (!p || !Screens.canSee(p)) return;
    const e = (p.events || []).find(x => x.id === ev);
    if (!e) return;
    UI.toast(`${p.name.first} ${p.name.last}: ${e.title || 'New orders'} released — now available in the Orders tab.`, 'info');
  }

  function orderAlert(pid) {
    if (!window.Screens || Screens.mode() !== 'student') return;
    const p = Model.base(pid);
    if (!p || !Screens.canSee(p)) return;
    UI.toast(`${p.name.first} ${p.name.last}: new order — acknowledge it in the Orders tab.`, 'info');
  }

  // Redraw with other devices' charting, but never while someone is typing or in a dialog.
  function maybeRender() {
    if (!needsRender || !window.App || !Store.session()) return;
    if (document.querySelector('.modal-backdrop')) return;
    const a = document.activeElement;
    if (a && a.closest && a.closest('form, input, textarea, select')) return;
    needsRender = false;
    App.render();
  }

  function loop() {
    clearTimeout(timer);
    timer = setTimeout(() => { if (!document.hidden) { flush(); pull(); } maybeRender(); loop(); }, POLL_MS);
  }

  /* ---------- sign in / out ---------- */

  async function signIn(email, password) {
    await facultyLock();
    const { body } = await http('/auth/v1/token?grant_type=password', { method: 'POST', headers: headers(), body: JSON.stringify({ email, password }) });
    saveAuth(body, null);
    const { body: rows } = await api(`/rest/v1/ehr_members?select=role,label&user_id=eq.${q(body.user.id)}&app=eq.${q(cfg.app)}&session_id=eq.${q(cfg.session)}`);
    if (!rows.length) { write('auth', null); throw new ServerError('This login has not been approved for the shared chart. Faculty: add it to the "Approve the logins" part of supabase/setup.sql and run it.', 403); }
    const a = auth(); a.role = rows[0].role; a.label = rows[0].label || ''; write('auth', a);
    // The shared chart replaces this device's own charting (a copy is kept on the device).
    if (!read('backup', null)) {
      const copy = {};
      Model.allPatients().forEach(p => { copy[p.id] = { doc: Store.doc(p.id), released: Store.released(p.id), patientEdits: Store.patientEdits(p.id) }; });
      write('backup', { at: new Date().toISOString(), patients: copy });
    }
    write('mirror', {}); write('since', null); firstPullDone = false;
    status = 'syncing'; paint();
    const ready = await pull(true);
    if (!ready) { const message = lastError || 'The shared chart could not be loaded.'; signedOut(); throw new Error(message); }
    flush();
    loop();
    return a.role;
  }

  function signedOut(msg) {
    facultyLock();
    write('auth', null);
    status = 'signedout'; lastError = msg || ''; paint();
    if (msg) UI.toast(msg, 'error');
  }

  /* ---------- header status + connection dialog ---------- */

  function label() {
    const n = outbox().length;
    if (status === 'off') return null;
    if (status === 'signedout') return { cls: 'sh-off', text: 'Not connected — this device only' };
    if (status === 'offline') return { cls: 'sh-bad', text: n ? `Not shared yet — offline (${n} waiting)` : 'Offline — retrying' };
    if (status === 'error') return { cls: 'sh-bad', text: 'Sharing problem — tap for details' };
    if (n || status === 'syncing') return { cls: 'sh-wait', text: n ? `Saving to shared chart… (${n})` : 'Connecting…' };
    return { cls: 'sh-ok', text: '✓ Shared' };
  }
  function pill() {
    const l = label();
    return l ? `<button type="button" class="sh-pill ${l.cls}" data-action="shared" title="Shared connection">${U.esc(l.text)}</button>` : '';
  }
  function paint() {
    const l = label();
    document.querySelectorAll('.sh-pill').forEach(b => { if (!l) return; b.className = 'sh-pill ' + l.cls; b.textContent = l.text; });
  }

  function dialog() {
    const a = auth();
    const esc = U.esc;
    if (a) {
      const n = outbox().length;
      UI.modal({
        title: 'Shared Connection',
        body: `<p>Hospital login: <strong>${esc(a.email || '')}</strong> (${esc(a.label || a.role || '')}).</p>
          <p>${n ? `<strong>${n} change${n === 1 ? '' : 's'} not shared yet.</strong> They stay on this device and are sent as soon as the connection works.` : status === 'shared' ? 'The shared chart is up to date.' : 'The shared connection has not been verified. Use Sync now to retry.'}</p>
          ${lastError ? `<p class="muted small">Last problem: ${esc(lastError)}</p>` : ''}
          <p class="muted small">Session: ${esc(cfg.session)}. Faculty releases and resets require the Faculty passphrase. Observer logins are view only.</p>`,
        buttons: [{ label: 'Disconnect this device', cls: 'btn-danger', onClick: () => {
          if (n && !confirm(`${n} change(s) have not been shared yet and will stay only on this device. Disconnect anyway?`)) return false;
          signedOut(); App.render();
        } }, { label: 'Sync now', onClick: () => { flush(); pull(true); } }, { label: 'Close', cls: 'btn-primary' }]
      });
      return;
    }
    UI.modal({
      title: 'Shared Connection',
      body: `<p>Connect this computer once so faculty, students, and observers see the same chart on every computer.
        Use the hospital login from your faculty (not your Blackboard login). The computer stays connected until it is disconnected here.</p>
        <form class="sh-form" onsubmit="return false">
          <label class="field"><span>Hospital login (email)</span><input name="email" type="email" autocomplete="username" autocapitalize="off" required value="${esc(cfg.defaultEmail || '')}"></label>
          <label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
        </form>`,
      buttons: [{ label: 'Cancel' }, { label: 'Connect', cls: 'btn-primary', onClick: api => {
        const v = U.formValues(api.el);
        const body = api.el.querySelector('.modal-body');
        if (!v.email || !v.password) { UI.formError(body, 'Enter the hospital login and password.'); return false; }
        const btns = api.el.querySelectorAll('.modal-foot .btn'); btns.forEach(b => { b.disabled = true; });
        signIn(v.email.trim(), v.password).then(role => {
          api.close(); UI.toast('Connected to the shared chart.'); App.render();
        }).catch(e => {
          btns.forEach(b => { b.disabled = false; });
          UI.formError(body, e instanceof NetError ? 'Could not reach the shared chart. Check the internet connection and try again.'
            : /invalid login|invalid_grant|credentials/i.test(e.message) ? 'That login or password is not correct.' : e.message);
        });
        return false;
      } }]
    });
  }

  /* ---------- hooks used by js/store.js ---------- */

  window.Shared = {
    configured: !!cfg,
    on: () => !!(cfg && auth()),
    role: () => { const a = auth(); return a ? a.role : null; },
    facultyUnlocked: () => !!facultyToken(),
    facultyUnlock, facultyLock, facultyEventsReady: () => facultyEventsReady,
    eventData: pid => facultyToken() && facultyEventsReady ? (facultyEvents[pid] || []) : (releasedEvents[pid] || []),
    loadFacultyEvents, loadFacultyCatalog,
    facultyCatalog: () => facultyToken() && facultyCatalogReady ? clone(facultyCatalog) : null,
    saveScenarioEvent: facultySaveEvent,
    correctScenarioEvent: facultyCorrectEvent,
    pill, dialog,
    add: (pid, section, entry) => queue({ op: 'add', pid, section, entry }),
    markError: (pid, id, error) => queue({ op: 'err', pid, id, error }),
    release: facultyRelease,
    editPatient: (pid, edits) => queue({ op: 'edit', pid, edits: clone(edits) }),
    restartClock: (pid, start) => queue({ op: 'clock', pid, start }),
    startClock: (pid, start) => queue({ op: 'start', pid, start }),
    // Faculty reset happens on the server first; the chart changes only when it succeeds.
    reset(pid) { return serial(() => doReset(pid)); },
    epoch: pid => Number(mirrorOf(pid).epoch || 1),
    // For tests.
    _state: () => ({ status, outbox: outbox(), mirror: mirrors() }),
    _pull: full => pull(full),
    _flush: () => flush()
  };

  async function doReset(pid) {
      try {
        const token = facultyToken();
        if (!token) throw new ServerError('Unlock Faculty again before resetting a patient.', 401);
        const result = await rpc('ehr_faculty_reset_patient', Object.assign(base(), { p_patient: pid, p_epoch: mirrorOf(pid).epoch, p_token: token }));
        if (!result || result.status !== 'ok') { UI.toast('This patient was already reset on another device. Sync and review the chart.', 'warn'); pull(true); return false; }
        setMirror(pid, Object.assign(emptyMirror(), { epoch: Number(result.epoch) }));
        setOutbox(outbox().filter(o => o.pid !== pid));
        await loadFacultyEvents();
        compose(pid);
        return true;
      } catch (e) {
        UI.toast(e instanceof NetError ? 'Reset failed: no connection to the shared chart. Nothing was changed.' : 'Reset failed: ' + e.message, 'error');
        return false;
      }
  }

  if (cfg) {
    document.addEventListener('DOMContentLoaded', () => { if (auth()) { flush(); pull(); loop(); } });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { flush(); pull(); } });
    window.addEventListener('online', () => { flush(); pull(); });
  }
})();
