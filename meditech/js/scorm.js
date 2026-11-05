/*
 * SCORM 1.2 bridge for the EMR Orientation (orientation.html and the SCORM package built by
 * tools/build-scorm.cjs). When the page runs inside an LMS such as Blackboard, it reports
 * progress and completion; outside an LMS (the GitHub Pages link) it does nothing.
 *
 *   cmi.core.lesson_status   incomplete → completed when every orientation task is done
 *   cmi.core.score.raw       percent of tasks done (0–100); never lowered once earned
 *   cmi.suspend_data         task progress, so a student can leave and resume on any device
 *   cmi.core.student_name    fills in the sign-in name
 */
(function () {
  'use strict';

  function findAPI(win) {
    for (let i = 0; win && i < 12; i++) {
      try { if (win.API) return win.API; } catch (e) { /* another site's window */ }
      try { if (!win.parent || win.parent === win) break; win = win.parent; } catch (e) { break; }
    }
    return null;
  }
  let api = findAPI(window);
  try { if (!api && window.opener) api = findAPI(window.opener); } catch (e) { /* ignore */ }
  try { if (!api && window.top && window.top.opener) api = findAPI(window.top.opener); } catch (e) { /* ignore */ }

  let started = false, finished = false, lastStatus = '';
  const call = (fn, ...args) => { try { return api[fn](...args); } catch (e) { return ''; } };
  const get = k => String(call('LMSGetValue', k) || '');
  const set = (k, v) => call('LMSSetValue', k, String(v));

  function start() {
    if (!api || started) return;
    call('LMSInitialize', '');
    started = true;
    const status = get('cmi.core.lesson_status');
    lastStatus = status;
    if (!status || status === 'not attempted') { set('cmi.core.lesson_status', 'incomplete'); call('LMSCommit', ''); lastStatus = 'incomplete'; }
  }

  function finish() {
    if (!api || !started || finished) return;
    finished = true;
    // Keep the attempt open (resume later) until the orientation is complete.
    set('cmi.core.exit', lastStatus === 'completed' ? '' : 'suspend');
    call('LMSCommit', '');
    call('LMSFinish', '');
  }

  window.LMS = {
    available: !!api,
    // "Last, First" from the LMS → "First Last" for the sign-in field.
    studentName() {
      if (!api) return '';
      start();
      const n = get('cmi.core.student_name').trim();
      if (!n) return '';
      const parts = n.split(',').map(x => x.trim()).filter(Boolean);
      return parts.length === 2 ? `${parts[1]} ${parts[0]}` : n;
    },
    // Saved progress from an earlier session (or null).
    restore() {
      if (!api) return null;
      start();
      try { return JSON.parse(get('cmi.suspend_data') || 'null'); } catch (e) { return null; }
    },
    // Report progress: done of total tasks, plus a small state object to resume from.
    progress(done, total, state) {
      if (!api) return;
      start();
      const pct = total ? Math.round(100 * done / total) : 0;
      set('cmi.core.score.min', 0);
      set('cmi.core.score.max', 100);
      // The grade never goes down: Start over (or a new device) cannot lower an earned score.
      const prev = Number(get('cmi.core.score.raw')) || 0;
      set('cmi.core.score.raw', Math.max(prev, lastStatus === 'completed' ? 100 : pct));
      let data = JSON.stringify(state || {});
      if (data.length > 4000) data = JSON.stringify({ doneAt: (state || {}).doneAt || {} });   // SCORM 1.2 limit is 4096
      set('cmi.suspend_data', data);
      const status = done >= total ? 'completed' : 'incomplete';
      if (status !== lastStatus && lastStatus !== 'completed') { set('cmi.core.lesson_status', status); lastStatus = status; }
      call('LMSCommit', '');
    },
    finish
  };

  if (api) {
    start();
    window.addEventListener('pagehide', finish);
    window.addEventListener('beforeunload', finish);
  }
})();
