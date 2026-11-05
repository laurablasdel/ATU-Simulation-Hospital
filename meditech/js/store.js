/*
 * Browser storage for student documentation.
 * Everything lives in this browser's localStorage. When the device is connected to the
 * shared chart (js/shared.js), each change is also sent to the server and the shared
 * chart from other devices is written back here. Use Instructor Tools > Export to save a copy.
 */
(function () {
  'use strict';
  const C = window.EHR_CONFIG;
  const P = C.storagePrefix + '.';
  const SECTIONS = ['vitals', 'assess', 'mar', 'io', 'notes', 'orders', 'ack', 'careplan', 'heparin', 'tar'];
  const protectedKeys = new Set(['events','facultyguide','instructorguide','instructornotes','facultynotes','scenarioitems','pendingevents']);

  function stripProtected(value) {
    if (Array.isArray(value)) return value.map(stripProtected);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !protectedKeys.has(key.toLowerCase())).map(([key, child]) => [key, stripProtected(child)]));
  }
  function hasProtected(value) {
    if (Array.isArray(value)) return value.some(hasProtected);
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, child]) => protectedKeys.has(key.toLowerCase()) || hasProtected(child));
  }

  function read(key, fallback) {
    try {
      const v = localStorage.getItem(P + key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(P + key, JSON.stringify(val)); return true; }
    catch (e) { alert('This browser could not save your documentation (storage is full or blocked).'); return false; }
  }
  function remove(key) { try { localStorage.removeItem(P + key); } catch (e) { /* ignore */ } }
  const shared = () => !!(window.Shared && Shared.on());

  const Store = {
    SECTIONS,

    // Signed-in user
    // Each tab has its own signed-in identity; patient charts remain shared in localStorage.
    session() { try { return JSON.parse(sessionStorage.getItem(P + 'session') || 'null'); } catch(e) { return null; } },
    setSession(s) { try { sessionStorage.setItem(P + 'session', JSON.stringify(s)); return true; } catch(e) { UI.toast('This browser could not save the sign-in.', 'danger'); return false; } },
    clearSession() { try { sessionStorage.removeItem(P + 'session'); } catch(e) { /* ignore */ } if (window.Shared) Shared.facultyLock(); },

    instructorUnlocked() { return !!(window.Shared && Shared.facultyUnlocked()); },
    setInstructor(on) { if (!on && window.Shared) Shared.facultyLock(); },

    // Real time (ms) at which a patient's scenario started. Set on first open.
    scenarioStart(pid) {
      let s = read('sim.' + pid, null);
      if (!s) { s = { realStart: Date.now() }; write('sim.' + pid, s); if (shared()) Shared.startClock(pid, s.realStart); }
      return s.realStart;
    },
    restartScenario(pid) { const t = Date.now(); write('sim.' + pid, { realStart: t }); if (shared()) Shared.restartClock(pid, t); },
    advanceScenario(pid, shiftId) {
      if (!Store.instructorUnlocked()) return false;
      const p = Model.get(pid), shifts = p && p.scenarioShifts;
      if (!shifts || !shifts.some(s => s.id === shiftId)) return false;
      const index = shifts.findIndex(s => s.id === shiftId), current = shifts.findIndex(s => s.id === p.clock.stage.id);
      if (index <= current) return false;
      const patch = JSON.parse(JSON.stringify(Store.patientEdits(pid))), referenceStart = Store.scenarioStart(pid);
      const steps = patch.scenarioTimeline && patch.scenarioTimeline.referenceStart === referenceStart ? patch.scenarioTimeline.steps.slice() : [];
      // Keep a boundary after prior releases even when two clicks share a millisecond.
      const realStart = Math.max(Date.now(), referenceStart + 1, ...steps.map(s => s.realStart + 1), ...Object.values(Store.released(pid)).map(t => t + 1));
      steps.push({ shift: shiftId, realStart });
      patch.scenarioTimeline = { referenceStart, steps };
      return Store.savePatientEdits(pid, patch);
    },

    // Student documentation for one patient
    doc(pid) {
      const d = read('doc.' + pid, {});
      SECTIONS.forEach(s => { if (!Array.isArray(d[s])) d[s] = []; });
      return d;
    },
    saveDoc(pid, d) { return write('doc.' + pid, d); },

    // time = when the event happened (chart time); recorded = when it was charted
    add(pid, section, data, time, recorded) {
      const s = Store.session() || { name: 'Unknown', cred: '' };
      if (s.observer && !Store.instructorUnlocked()) { if (window.UI) UI.toast('Observer mode is view only — nothing was saved.', 'warn'); return null; }
      if (shared() && Shared.role() === 'observer') { if (window.UI) UI.toast('This device is connected to the shared chart with an observer login (view only) — nothing was saved.', 'warn'); return null; }
      const d = Store.doc(pid);
      if (section === 'ack' && data.ref && window.Model) { const correction = Model.revision(d, data.ref); data = Object.assign({}, data, { revision: correction ? correction.id : null }); }
      if (section === 'orders' && data.kind === 'correction' && !Store.instructorUnlocked()) return null;
      const entry = {
        id: U.uid(), time, recorded, data, status: 'active',
        user: { name: s.name, cred: s.cred, group: s.group || '' }
      };
      d[section].push(entry);
      if (!Store.saveDoc(pid, d)) return null;
      if (shared()) Shared.add(pid, section, entry);
      return entry;
    },

    // Legal-record style correction: never delete, mark "entered in error".
    markError(pid, section, id, reason, when) {
      const d = Store.doc(pid);
      const e = d[section].find(x => x.id === id);
      if (!e) return;
      const s = Store.session() || { name: 'Unknown', cred: '' };
      e.status = 'error';
      e.error = { reason, by: s.name + (s.cred ? ', ' + s.cred : ''), at: when };
      Store.saveDoc(pid, d);
      if (shared()) Shared.markError(pid, id, e.error);
    },

    // Instructor-released scenario events: { eventId: realTimeReleased }
    released: pid => read('released.' + pid, {}),
    async release(pid, eventId, at) {
      if (!Store.instructorUnlocked() || !shared()) return false;
      const timeline = Store.patientEdits(pid).scenarioTimeline;
      const boundary = timeline && timeline.referenceStart === Store.scenarioStart(pid) ? Math.max(0, ...timeline.steps.map(s => s.realStart)) : 0;
      return !!(await Shared.release(pid, eventId, true, Math.max(at || Date.now(), boundary)));
    },
    async unrelease(pid, eventId) {
      if (!Store.instructorUnlocked() || !shared()) return false;
      return !!(await Shared.release(pid, eventId, false, 0));
    },

    // Patients added through Instructor Tools (JSON import)
    // Custom JSON patients can contain unreleased scenario data. The secure shared build
    // adds those through Faculty controls so they can be stored on the server.
    customPatients: () => C.secureScenarioStore ? [] : read('customPatients', []),
    patientEdits(pid) {
      const current = read('patientEdits.' + pid, {});
      if (!hasProtected(current)) return current;
      const safe = stripProtected(current); write('patientEdits.' + pid, safe); return safe;
    },
    savePatientEdits(pid, patch) {
      if (!Store.instructorUnlocked()) return false;
      if (hasProtected(patch)) { UI.toast('Unreleased scenario items must be saved through Faculty controls.', 'error'); return false; }
      if (!write('patientEdits.' + pid, patch)) return false;
      if (shared()) Shared.editPatient(pid, patch);
      return true;
    },
    saveCustomPatient(p) {
      const list = Store.customPatients().filter(x => x.id !== p.id);
      list.push(p);
      write('customPatients', list);
    },
    deleteCustomPatient(id) { write('customPatients', Store.customPatients().filter(x => x.id !== id)); },

    // Connected devices reset the shared chart (all devices) and return a promise of true/false.
    // Each reset moves the patient to a new epoch (on connected devices, the shared chart's epoch).
    resetPatient(pid) {
      const after = ok => { if (ok && window.Views && Views.transitional) Views.transitional.cleanup(); return ok; };
      if (shared()) return Promise.resolve(Shared.reset(pid)).then(after);
      remove('doc.' + pid); remove('released.' + pid); remove('sim.' + pid); remove('patientEdits.' + pid);
      write('epoch.' + pid, Store.epoch(pid) + 1);
      return after(true);
    },
    // Reset counter for a patient. Records shared by two charts (Sung Transitional Record) keep the epochs of both.
    epoch: pid => shared() ? Shared.epoch(pid) : Number(read('epoch.' + pid, 1)),

    exportAll(pids) {
      const out = { app: 'ATU SimEHR', version: 1, exported: new Date().toISOString(), patients: {} };
      pids.forEach(pid => {
        out.patients[pid] = { doc: Store.doc(pid), released: Store.released(pid), sim: read('sim.' + pid, null), patientEdits: Store.patientEdits(pid) };
      });
      out.customPatients = Store.customPatients();
      return out;
    },
    importAll(obj) {
      if (!obj || obj.app !== 'ATU SimEHR' || !obj.patients) throw new Error('This file is not a SimEHR export.');
      Object.entries(obj.patients).forEach(([pid, v]) => {
        if (hasProtected(v.patientEdits || {})) throw new Error('This export contains pending scenario items. Add them through Faculty controls after connecting to the shared chart.');
        if (v.doc) write('doc.' + pid, v.doc);
        if (v.released) write('released.' + pid, v.released);
        if (v.sim) write('sim.' + pid, v.sim);
        if (v.patientEdits) write('patientEdits.' + pid, stripProtected(v.patientEdits));
      });
      if (Array.isArray(obj.customPatients) && !C.secureScenarioStore) write('customPatients', obj.customPatients);
    }
  };

  window.Store = Store;
})();
