/* Screens outside a chart: sign-in, census, instructor tools. */
(function () {
  'use strict';
  const esc = U.esc;
  const C = window.EHR_CONFIG;
  window.Screens = {};

  const allergyText = p => p.nkda || !(p.allergies || []).length ? 'NKDA' : p.allergies.map(a => a.agent).join(', ');

  // Students are locked to the experience chosen at sign-in; only an unlocked
  // instructor may switch experiences or view "all".
  Screens.experience = () => {
    const s = Store.session() || {};
    if (Store.instructorUnlocked()) return s.viewExperience || s.experience || 'all';
    return s.experience && s.experience !== 'all' ? s.experience : '';
  };
  Screens.canSee = p => {
    const exp = Screens.experience();
    return exp === 'all' || (p.experiences || []).includes(exp);
  };
  // Chart mode: faculty (server-unlocked), observer (view only), or student (documenting).
  Screens.mode = () => Store.instructorUnlocked() ? 'faculty' : ((Store.session() || {}).observer ? 'observer' : 'student');
  Screens.MODE_LABEL = { student: 'Student', observer: 'Observer', faculty: 'Faculty' };

  function requestFacultyUnlock(passphrase, errorRoot, onSuccess) {
    if (!window.Shared || !Shared.on()) { UI.formError(errorRoot, 'Connect to the shared hospital chart before unlocking Faculty.'); return; }
    if (!String(passphrase || '').trim()) { UI.formError(errorRoot, 'Enter the Faculty PIN.'); return; }
    Shared.facultyUnlock(passphrase).then(ok => {
      if (!ok) { UI.formError(errorRoot, 'That Faculty PIN is not correct.'); return; }
      onSuccess();
    }).catch(error => UI.formError(errorRoot, error.message || 'Faculty could not be unlocked.'));
  }

  // Faculty mode requires a server-checked passphrase. Leaving Observer mode also checks it.
  Screens.setMode = function (to) {
    const from = Screens.mode();
    if (to === from) return;
    if (C.orientation && to !== 'student') return;   // EMR Orientation stays in Student mode
    const apply = () => {
      const s = Store.session();
      if (to === 'faculty') { Store.setInstructor(true); }
      else { Store.setInstructor(false); if (s) { s.observer = to === 'observer'; delete s.viewExperience; Store.setSession(s); } }
      UI.toast(`Switched to ${Screens.MODE_LABEL[to]} mode${to === 'observer' ? ' — view only' : ''}.`);
      // Instructor Tools is faculty-only: leaving Faculty there goes to the status board
      // (otherwise the page would ask for a faculty passphrase again to stay on Instructor Tools).
      if (to !== 'faculty' && /^#\/(instructor|barcodes)/.test(location.hash)) { location.hash = '#/census'; return; }
      App.render();
    };
    // Faculty who signed in without a sim experience choose one before charting as a student.
    const withExperience = then => {
      const s = Store.session();
      if (to === 'faculty' || (s.experience && s.experience !== 'all')) return then();
      UI.modal({
        title: 'Choose a Sim Experience',
        body: `<p>Student and Observer modes show one sim experience. Which one?</p>
          <label class="field"><span>Simulation experience</span><select name="experience">${C.experiences.map(x => `<option value="${esc(x.id)}" ${x.id === s.viewExperience ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>`,
        buttons: [{ label: 'Cancel' }, { label: 'Continue', cls: 'btn-primary', onClick: api => {
          const sess = Store.session(); sess.experience = U.formValues(api.el).experience; Store.setSession(sess);
          setTimeout(then, 0);
        } }]
      });
    };
    if (to === 'faculty' || from === 'observer') {
      UI.modal({
        title: to === 'faculty' ? 'Switch to Faculty' : 'Leave Observer Mode',
        body: `<p>${to === 'faculty' ? 'Faculty mode opens instructor tools for your selected simulation experience.' : 'An instructor must unlock Faculty to change an observer to a documenting student.'}</p>
          <label class="field"><span>Faculty PIN</span><input type="password" name="pin" autofocus autocomplete="current-password"></label>`,
        buttons: [{ label: 'Cancel' }, { label: 'Switch', cls: 'btn-primary', onClick: api => {
          requestFacultyUnlock(U.formValues(api.el).pin, api.el.querySelector('.modal-body'), () => {
            api.close(); setTimeout(() => withExperience(apply), 0);
          });
          return false;
        } }]
      });
      return;
    }
    withExperience(apply);
  };

  Screens.experienceLabel = id => id === 'all' ? 'All Experiences' : ((C.experiences.find(x => x.id === id) || {}).label || id);

  /* ---------------- Sign in ---------------- */
  Screens.login = {
    render() {
      return `<div class="login-wrap">
        <form class="login-card" autocomplete="off">
          <div class="login-brand"><div class="logo-mark" aria-hidden="true">✚</div><div><div class="brand-1">${esc(C.hospitalName)}</div><div class="brand-2">${esc(C.systemName)} · Simulation Electronic Health Record</div></div></div>
          <div class="sim-warning">SIMULATION ONLY — Do not enter real patient information.</div>
          <label class="field"><span>Full name</span><input name="name" required autofocus placeholder="First Last"></label>
          ${C.orientation
            // EMR Orientation: every user is a documenting student nurse.
            ? '<div class="field"><span>Role</span><div class="login-fixed">Student Nurse (SN)</div><input type="hidden" name="cred" value="SN"></div>'
            : `<label class="field"><span>Role</span><select name="cred">
            <option value="SN">Student Nurse (SN)</option><option value="Faculty">Faculty</option></select></label>
          <label class="field login-pin" hidden><span>Faculty PIN</span><input type="password" name="pin" autocomplete="current-password"></label>`}
          <label class="field"><span>Simulation experience</span><select name="experience" required>
            <option value="">— Select your sim experience —</option>
            ${C.experiences.map(x => `<option value="${esc(x.id)}" ${C.experiences.length === 1 ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}
</select></label>
          ${C.orientation ? '' : `<fieldset class="field login-mode"><legend>Sign in as</legend>
            <label class="check"><input type="radio" name="mode" value="student" checked> <span><strong>Documenting nurse</strong> — I am charting in this simulation</span></label>
            <label class="check"><input type="radio" name="mode" value="observer"> <span><strong>Observer (view only)</strong> — I am watching; I can read the chart but not document or acknowledge</span></label>
          </fieldset>`}
          <button class="btn btn-primary btn-block" type="submit">Sign In</button>
          ${window.Shared && Shared.configured ? `<div class="login-shared">${Shared.pill()}<span class="muted small">${Shared.on() ? '' : 'Connect once per device to share charting across devices.'}</span></div>` : ''}
          <p class="muted small">Your name is attached to every entry as your electronic signature.</p>
          <p class="muted small">Version ${U.esc(C.version || '')}</p>
        </form></div>`;
    },
    bind(root) {
      // Faculty: show the passphrase, hide the student-only choices, and make the experience optional.
      const role = root.querySelector('select[name="cred"]');
      if (role) role.addEventListener('change', () => {
        const fac = role.value === 'Faculty';
        root.querySelector('.login-pin').hidden = !fac;
        const modeSet = root.querySelector('.login-mode'); if (modeSet) modeSet.hidden = fac;
        const exp = root.querySelector('select[name="experience"]');
        exp.required = !fac;
        exp.options[0].textContent = fac ? '— All experiences —' : '— Select your sim experience —';
        if (fac) root.querySelector('[name="pin"]').focus();
      });
      root.querySelector('select[name="experience"]').addEventListener('change', () => {
        const form = root.querySelector('form');
        if (form.checkValidity()) form.requestSubmit();
      });
      const sh = root.querySelector('[data-action="shared"]');
      if (sh) sh.addEventListener('click', () => Shared.dialog());
      root.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const v = U.formValues(e.target);
        if (!v.name) return;
        if (v.cred === 'Faculty') {
          // Faculty controls follow the selected experience; leaving it blank shows all experiences.
          requestFacultyUnlock(v.pin, e.target, () => {
            Store.setSession({ name: v.name, cred: 'Faculty', group: '', experience: v.experience || 'all', observer: false, signedIn: Date.now() });
            Store.setInstructor(true);
            levelTab = null; selected = null; pickPatient('');
            location.hash = '#/instructor'; App.render();
          });
          return;
        }
        if (!v.experience) { UI.formError(e.target, 'Choose your simulation experience.'); return; }
        Store.setSession({ name: v.name, cred: v.cred, group: '', experience: v.experience, observer: v.mode === 'observer', signedIn: Date.now() });
        levelTab = null; selected = null;
        location.hash = '#/census';
        App.render();
      });
    }
  };

  /* ---------------- Status board (census) ---------------- */
  let levelTab = null;
  let selected = null;

  function nextMeds(p, doc) {
    const out = [];
    p.meds.forEach(m => (m.doseTimes || []).forEach(dt => {
      if (!Model.doseInCurrentShift(p, dt)) return;
      const st = Model.doseStatus(p, doc, m, dt).code;
      if (st === 'due' || st === 'overdue' || st === 'future') out.push({ time: dt.time, text: `${m.name} ${m.dose}`, overdue: st === 'overdue' });
    }));
    return out.sort((x, y) => x.time - y.time).slice(0, 3);
  }
  const lines = (list, empty) => list.length ? list.map(x => `<div class="sb-line"><span class="${x.overdue ? 'sb-late' : ''}">${U.fmtTime(x.time)}</span> ${esc(x.text || x.name)}</div>`).join('') : (empty || '');

  Screens.census = {
    render() {
      const exp = Screens.experience();
      const s = Store.session();
      const pts = Model.allPatients().filter(Screens.canSee);
      const instructor = Store.instructorUnlocked();
      const levels = [0, 1, 2, 3];
      if (levelTab == null) levelTab = pts.length ? Math.min(...pts.map(p => p.level ?? 3)) : 1;
      const shown = pts.filter(p => (p.level ?? 3) === levelTab);
      const now = Date.now();
      const rows = shown.map(base => {
        const p = Model.get(base.id);
        const doc = Store.doc(p.id);
        const unacked = Model.unackedOrders(p, doc);
        const stat = unacked.some(o => /stat/i.test(o.priority || ''));
        const results = Model.unreviewedResults(p, doc);
        const allergy = !(p.nkda || !(p.allergies || []).length);
        const initials = (p.name.first[0] + p.name.last[0]).toUpperCase();
        return `<tr class="census-row ${selected === p.id ? 'sb-selected' : ''}" data-open="${esc(p.id)}" tabindex="0">
          <td class="sb-rm">${esc(p.room && p.room !== '—' ? p.room : p.unit)}</td>
          <td class="sb-pix"><div class="avatar sb-avatar" aria-hidden="true">${esc(initials)}</div></td>
          <td class="sb-name"><a href="#/patient/${esc(p.id)}/summary" class="sb-link"><strong>${esc(p.name.last)},${esc(p.name.first)}</strong></a>
            <div>${esc(p.admitDx)}</div><div class="muted">ADM IN · ${esc(p.age.replace(' years', ''))} ${esc(p.sex)} · DOB ${esc(U.fmtDOB(p.dob))}</div></td>
          <td class="sb-alerts">${allergy ? `<span class="sb-chip sb-red" title="Allergies: ${esc(allergyText(p))}">ALLERGY</span>` : '<span class="sb-chip sb-plain">NKDA</span>'}
            ${p.codeStatus === 'DNR' ? '<span class="sb-chip sb-purple">DNR</span>' : ''}
            ${p.isolation && !/^(none|standard)$/i.test(p.isolation) ? `<span class="sb-chip sb-plain">${esc(p.isolation)}</span>` : ''}</td>
          <td class="${(p.homeMeds || []).length ? 'sb-green' : 'sb-gray'}">${(p.homeMeds || []).length ? 'Confirmed' : 'None'}</td>
          <td class="sb-list">${lines(Views.worklist.due(p, doc).slice(0, 3))}</td>
          <td class="sb-list">${lines(nextMeds(p, doc))}</td>
          <td class="${stat ? 'sb-redcell' : unacked.length ? 'sb-newcell' : ''}" title="${unacked.length ? unacked.length + ' order(s) to acknowledge' : 'No new orders to acknowledge'}">${unacked.length ? `${stat ? 'Stat' : 'New'} (${unacked.length})` : ''}</td>
          <td class="sb-results">${results.map(r => { const crit = (r.results || []).some(x => /\*/.test(Model.labFlag(x))); return `<div class="sb-res ${crit ? 'sb-res-crit' : ''}">${esc(r.panel || r.study)}</div>`; }).join('')}</td>
        </tr>`;
      }).join('');
      const title = `${Screens.experienceLabel(exp)} - ${s.cred}*`;
      return `<div class="sb">
        <div class="sb-titlebar"><span class="sb-e" aria-hidden="true">E</span><h1>PCS Status Board</h1></div>
        <div class="sb-band"><span>Dept: <b>Patient Care</b></span><span>Site: <b>${esc(C.hospitalName)}</b></span><span>Level: <b>${levelTab}</b></span></div>
        <div class="sb-body">
          <div class="sb-main">
            <div class="sb-head"><strong>${esc(title)}</strong><div>${shown.length} patient${shown.length === 1 ? '' : 's'} as of ${U.fmtDT(now)}</div></div>
            <div class="scroll-x">${shown.length ? `<table class="grid census sb-table">
              <thead><tr><th>Rm/ Bed</th><th>Pix</th><th>Name ▾<br>Diagnosis<br>Reg Status</th><th>Alerts</th><th>Home Meds</th><th>Interventions</th><th>Next Meds</th><th>Orders</th><th>New Results</th></tr></thead>
              <tbody>${rows}</tbody></table>` : `<p class="empty sb-empty">No Level ${levelTab} patients have been added for ${esc(Screens.experienceLabel(exp))} yet.</p>`}</div>
            <div class="sb-foot">
              <button class="btn btn-sm" data-action="refresh">Refresh</button>
              <button class="btn btn-sm" data-action="open" ${selected && shown.some(p => p.id === selected) ? '' : 'disabled'}>Open Chart</button>
              <span class="muted small">Click a patient to select, double-click (or Open Chart) to open. Always verify two identifiers.${instructor ? '' : ' To change your sim experience, Suspend and sign in again.'}</span>
            </div>
          </div>
          <nav class="sb-side" aria-label="Status board menu">
            <div class="sb-side-h">Lists</div>
            ${levels.map(l => `<a href="#" class="${l === levelTab ? 'on' : ''}" data-level="${l}">Level ${l} Patients</a>`).join('')}
            <div class="sb-sep"></div>
            <a href="#" class="on">Status Board</a>
            <a href="#" data-action="open">Open Chart</a>
            ${instructor ? `<div class="sb-sep"></div><label class="sb-side-h">Instructor view
              <select data-action="experience">${C.experiences.map(x => `<option value="${esc(x.id)}" ${x.id === exp ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}
              <option value="all" ${exp === 'all' ? 'selected' : ''}>All experiences</option></select></label>
              <a href="#/instructor">Instructor Tools</a>` : ''}
          </nav>
        </div>
      </div>`;
    },
    bind(root) {
      const sel = root.querySelector('[data-action="experience"]');
      if (sel) sel.addEventListener('change', e => {
        const sess = Store.session(); sess.viewExperience = e.target.value; Store.setSession(sess); levelTab = null; selected = null; App.render();
      });
      root.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); levelTab = Number(b.dataset.level); selected = null; App.render(); }));
      root.querySelector('[data-action="refresh"]').addEventListener('click', () => App.render());
      const open = id => { if (id) location.hash = `#/patient/${id}/summary`; };
      root.querySelectorAll('[data-action="open"]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); open(selected); }));
      root.querySelectorAll('[data-open]').forEach(r => {
        r.addEventListener('click', e => {
          if (e.target.closest('a')) return;
          selected = r.dataset.open;
          root.querySelectorAll('.census-row').forEach(x => x.classList.toggle('sb-selected', x === r));
          root.querySelectorAll('button[data-action="open"]').forEach(b => { b.disabled = false; });
        });
        r.addEventListener('dblclick', () => open(r.dataset.open));
        r.addEventListener('keydown', e => { if (e.key === 'Enter') open(r.dataset.open); });
      });
    }
  };

  /* ---------------- Instructor tools ---------------- */
  Screens.unlock = function (then) {
    if (Store.instructorUnlocked()) { then(); return; }
    UI.modal({
      title: 'Instructor Tools',
      body: '<label class="field"><span>Faculty PIN</span><input type="password" name="pin" autofocus autocomplete="current-password"></label>',
      buttons: [{ label: 'Cancel' }, { label: 'Unlock', cls: 'btn-primary', onClick: api => {
        requestFacultyUnlock(U.formValues(api.el).pin, api.el.querySelector('.modal-body'), () => {
          api.close(); Store.setInstructor(true); then();
        });
        return false;
      } }]
    });
  };

  // Instructor Tools shows one patient at a time, chosen from the experience's dashboard.
  const PICK_KEY = C.storagePrefix + '.instructorPatient';
  const pickedPatient = () => { try { return sessionStorage.getItem(PICK_KEY) || ''; } catch (e) { return ''; } };
  const pickPatient = id => { try { sessionStorage.setItem(PICK_KEY, id); } catch (e) { /* ignore */ } };

  // Exactly what one Release button reveals to students.
  function releaseItems(ev, base) {
    const out = [];
    (ev.meds || []).forEach(m => out.push(['Medication order + MAR', Model.medLabel(m)]));
    (ev.orders || []).forEach(o => out.push([o.cat === 'Blood Products' ? 'Transfusion order (TAR)' : 'Order', o.text]));
    (ev.labs || []).forEach(l => out.push(['Result', l.panel]));
    (ev.imaging || []).forEach(i => out.push(['Result', `${i.study}${(i.images || []).length ? ' (with image)' : ''}`]));
    (ev.documents || []).forEach(d => out.push(['Document', d.title]));
    (ev.notes || []).forEach(n => out.push(['Note', n.title || n.type || 'Note']));
    (ev.vitals || []).forEach(() => out.push(['Vital signs', 'Vital-sign row']));
    (ev.discontinue || []).forEach(id => { const m = ((base && base.meds) || []).find(x => x.id === id); out.push(['Discontinues', m ? Model.medLabel(m) : id]); });
    (ev.hold || []).forEach(h => { const m = ((base && base.meds) || []).find(x => x.id === h.id); out.push(['Puts on hold', m ? Model.medLabel(m) : h.id]); });
    if (ev.delivery) out.push(['Delivery', 'Opens the newborn documentation on both Sung charts']);
    if ((ev.io || []).length) out.push(['Intake & output', 'Shift totals']);
    return out;
  }

  // One scenario event: its contents and one Release Now (or Undo).
  function eventHtml(p, base, rel, ev) {
    return `<div class="event ${rel[ev.id] ? 'event-on' : ''}">
                <div><strong>${esc(ev.title)}</strong>
                  <ul class="ev-items">${releaseItems(ev, base).map(([k, t]) => `<li><span class="ev-kind">${esc(k)}</span> ${esc(t)}</li>`).join('')}</ul>
                  </div>
                <div>${rel[ev.id] ? `<span class="badge badge-ok">Released ${U.fmtTime(p.clock.toSim(rel[ev.id]))}</span> <button class="btn btn-sm" data-unrelease="${esc(p.id)}|${esc(ev.id)}">Undo</button>`
                  : `<button class="btn btn-sm" data-edit-event="${esc(p.id)}|${esc(ev.id)}">Edit</button> <button class="btn btn-sm btn-primary" data-release="${esc(p.id)}|${esc(ev.id)}">Release Now</button>`}</div>
              </div>`;
  }
  // Events with ev.group (Charles Jones: Shift 1–4) sit under collapsible headings with progress. Headings start
  // collapsed, have no release button of their own, and stay open across re-renders (Release Now / Undo).
  const GROUP_KEY = C.storagePrefix + '.instructorOpenGroups';
  const openGroups = () => { try { return JSON.parse(sessionStorage.getItem(GROUP_KEY) || '[]'); } catch (e) { return []; } };
  const setGroupOpen = (key, on) => { try { const g = openGroups().filter(x => x !== key); if (on) g.push(key); sessionStorage.setItem(GROUP_KEY, JSON.stringify(g)); } catch (e) { /* ignore */ } };
  function eventList(p, base, rel) {
    const evs = base.events || [];
    if (!evs.some(e => e.group)) return evs.map(ev => eventHtml(p, base, rel, ev)).join('');
    const order = [], by = {};
    evs.forEach(ev => { const g = ev.group || 'Other'; if (!by[g]) { by[g] = []; order.push(g); } by[g].push(ev); });
    order.sort((a,b)=>(Number(/^Shift\s+(\d+)/i.exec(a)?.[1])||Infinity)-(Number(/^Shift\s+(\d+)/i.exec(b)?.[1])||0));
    const open = openGroups();
    return order.map(g => {
      const key = `${p.id}|${g}`, list = by[g], n = list.filter(e => rel[e.id]).length;
      return `<details class="ev-group" data-shift="${esc(/^Shift\s+(\d+)/i.exec(g)?.[1]||'')}" data-evgroup="${esc(key)}" ${open.includes(key) ? 'open' : ''}>
          <summary><strong>${esc(g)}</strong> <span class="ev-progress ${n === list.length ? 'ev-all' : ''}">${n} of ${list.length} released</span></summary>
          ${list.map(ev => eventHtml(p, base, rel, ev)).join('')}</details>`;
    }).join('');
  }

  Screens.instructor = {
    select: pickPatient,
    render() {
      const all = Model.allPatients().filter(Screens.canSee).sort((a,b)=>(a.level ?? 3)-(b.level ?? 3) || a.name.last.localeCompare(b.name.last));
      const picked = pickedPatient();
      const sel = (all.find(p => p.id === picked) || {}).id || '';
      if (picked && !sel) pickPatient('');
      const pts = all.filter(p => p.id === sel);
      const released = p => { const r = Store.released(p.id); return (p.events || []).filter(e => r[e.id]).length; };
      const picker = sel ? '<button class="btn faculty-back" data-select-patient="">← Patient dashboard</button>' : `<p class="muted">Select a patient to manage that chart’s releases, corrections, and labels.</p><div class="faculty-patients">${all.map(p => `<button class="faculty-patient" data-select-patient="${esc(p.id)}"><span class="faculty-level">Level ${esc(p.level ?? 3)} · ${esc((p.experiences || []).map(Screens.experienceLabel).join(', '))}</span><strong>${esc(p.name.first)} ${esc(p.name.last)}</strong><span>${esc(p.admitDx)}</span><span class="faculty-progress">${released(p)} / ${(p.events || []).length} items released →</span></button>`).join('')}</div>`;
      const cards = pts.map(base => {
        const p = Model.get(base.id);
        const doc = Store.doc(p.id);
        const rel = Store.released(p.id);
        const count = Store.SECTIONS.reduce((n, s) => n + doc[s].length, 0);
        const custom = Store.customPatients().some(c => c.id === p.id);
        return `<section class="panel">
          <header class="panel-head"><h2>Level ${esc(p.level ?? 3)} · ${esc(p.name.last)}, ${esc(p.name.first)} <span class="muted">— ${esc(p.admitDx)} · ${esc((p.experiences || []).map(Screens.experienceLabel).join(', ') || 'No experience assigned')}</span></h2>
            <div class="panel-actions">
              <a class="btn btn-sm" href="#/patient/${esc(p.id)}/summary">Open Chart</a>
              <a class="btn btn-sm" href="#/patient/${esc(p.id)}/orders">Edit Orders / Medications</a>
              <button class="btn btn-sm" data-add-item="${esc(p.id)}">Add Chart Item</button>
              <a class="btn btn-sm" href="labels.html?patient=${esc(p.id)}">Print Labels</a>
              <a class="btn btn-sm" href="#/patient/${esc(p.id)}/report">Chart Report</a>
              <button class="btn btn-sm" data-restart="${esc(p.id)}">Restart Clock</button>
              <button class="btn btn-sm btn-danger" data-reset="${esc(p.id)}">Reset Patient</button>
              ${custom ? `<button class="btn btn-sm btn-danger" data-delcustom="${esc(p.id)}">Remove Patient</button>` : ''}
            </div></header>
          <div class="panel-body">
            ${p.clock.staged ? `<div class="scenario-shift-control"><label class="field"><span>Current simulation shift</span><select data-scenario-shift="${esc(p.id)}">${p.clock.stageTimes.map((s,i) => `<option value="${esc(s.id)}" ${s.id === p.clock.stage.id ? 'selected' : ''} ${i < p.scenarioShifts.findIndex(x => x.id === p.clock.stage.id) ? 'disabled' : ''}>${esc(s.label)} · ${esc(U.fmtDT(s.from))}</option>`).join('')}</select></label><p>Changing shifts advances the shared chart clock. Release each order, medication, and result individually when ready. Previous documentation stays in history.</p></div>` : ''}
            <p>Chart clock: <strong>${U.fmtDT(p.clock.now())}</strong> ${p.clock.staged ? `· ${esc(p.clock.stage.label)}` : `(real time; scenario written for ${esc(p.scenarioStart || "—")}, shifted ${p.clock.shift / 3600000 >= 0 ? "+" : ""}${Math.round(p.clock.shift / 3600000)} h)`} · ${count} student entr${count === 1 ? 'y' : 'ies'} · MRN barcode <code>${esc(p.mrn)}</code></p>
            ${p.labsPending ? `<p class="warn-box">${esc(p.labsPending)}</p>` : ''}
            ${(base.events || []).length ? `<h3>Scenario events</h3>${eventList(p, base, rel)}` : '<p class="muted">No scripted events for this patient.</p>'}
          </div></section>`;
      }).join('');

      return `<div class="page">
        <div class="page-head"><h1>${sel ? "Patient Faculty Controls" : "Faculty Dashboard"}</h1><div>
          ${!sel ? '<a class="btn" href="labels.html">Print All Original Labels</a>' : ''}
          <a class="btn btn-primary" href="#/barcodes">Barcode Check</a>
          <button class="btn" data-action="export">Export All Documentation</button>
          <label class="btn">Import Documentation<input type="file" accept=".json,application/json" data-action="import" hidden></label>
          <button class="btn" data-action="lock">Lock</button>
        </div></div>
        ${!sel ? `<p class="muted faculty-experience">${esc(Screens.experienceLabel(Screens.experience()))} · ${all.length} patient${all.length === 1 ? '' : 's'}</p>` : ''}
        <div class="alert alert-info">${window.Shared && Shared.on()
          ? 'This computer is connected to the shared chart: releases and resets reach every connected device. "Reset Patient" erases that patient\'s documentation and restarts the scenario.'
          : 'Documentation is saved in <strong>this browser only</strong>. Release events and export charting on the same workstation the student used. "Reset Patient" erases that patient\'s documentation and restarts the scenario.'}</div>
        ${picker}
        ${cards}
      </div>`;
    },
    bind(root) {
      root.querySelectorAll('[data-evgroup]').forEach(d => d.addEventListener('toggle', () => setGroupOpen(d.dataset.evgroup, d.open)));
      root.querySelectorAll('[data-scenario-shift]').forEach(el => el.addEventListener('change', () => { if (Store.advanceScenario(el.dataset.scenarioShift, el.value)) UI.toast('Simulation shift advanced. Release items individually when ready.'); App.render(); }));
      root.querySelectorAll('[data-add-item]').forEach(b => b.addEventListener('click', () => FacultySession.add(b.dataset.addItem)));
      root.querySelectorAll('[data-edit-event]').forEach(b => b.addEventListener('click', () => FacultySession.edit(...b.dataset.editEvent.split('|'))));
      root.querySelectorAll('[data-select-patient]').forEach(b => b.addEventListener('click', () => { pickPatient(b.dataset.selectPatient); if(location.hash !== '#/instructor') location.hash='#/instructor'; App.render(); }));
      const pts = () => Model.allPatients().map(p => p.id);
      // Only the selected release changes the chart.
      root.querySelectorAll('[data-release]').forEach(b => b.addEventListener('click', async () => {
        const [pid, ev] = b.dataset.release.split('|'), at = Date.now();
        b.disabled = true;
        try {
          if (await Store.release(pid, ev, at)) UI.toast('Event released to the chart.');
          else UI.toast('The release was not accepted by the shared chart.', 'error');
        } catch (error) { UI.toast(error.message || 'The release could not be shared.', 'error'); }
        App.render();
      }));
      root.querySelectorAll('[data-unrelease]').forEach(b => b.addEventListener('click', async () => {
        const [pid, ev] = b.dataset.unrelease.split('|'); b.disabled = true;
        try {
          if (!(await Store.unrelease(pid, ev))) UI.toast('The release could not be removed from the shared chart.', 'error');
        } catch (error) { UI.toast(error.message || 'The release could not be removed.', 'error'); }
        App.render();
      }));
      root.querySelectorAll('[data-restart]').forEach(b => b.addEventListener('click', () => UI.confirm('Restart clock', 'Set this chart\'s clock back to the scenario start time? Existing documentation keeps its times.', () => { Store.restartScenario(b.dataset.restart); App.render(); }, 'Restart')));
      root.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', () => UI.confirm('Reset patient', window.Shared && Shared.on()
        ? 'Reset this patient for the next group? This erases ALL student documentation and released events on EVERY connected device and restarts the clock. No copy is kept. Other patients are not changed.'
        : 'Restore this patient’s original admission chart? Student documentation, session corrections, and later releases will be cleared. Later items return to pending. No archive is kept. Other patients are unchanged.',
        () => { Promise.resolve(Store.resetPatient(b.dataset.reset)).then(ok => { if (ok) UI.toast('Patient reset.', 'warn'); App.render(); }); }, 'Erase & Reset')));
      root.querySelectorAll('[data-delcustom]').forEach(b => b.addEventListener('click', () => UI.confirm('Remove patient', 'Remove this imported patient from this browser?', () => { Store.deleteCustomPatient(b.dataset.delcustom); Store.resetPatient(b.dataset.delcustom); App.render(); }, 'Remove')));
      root.querySelector('[data-action="export"]').addEventListener('click', () =>
        U.download(`SimEHR_export_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`, JSON.stringify(Store.exportAll(pts()), null, 2)));
      root.querySelector('[data-action="lock"]').addEventListener('click', () => { Store.clearSession(); Store.setInstructor(false); location.hash = '#/'; App.render(); });
      const readFile = (input, fn) => input.addEventListener('change', () => {
        const f = input.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => { try { fn(JSON.parse(r.result)); App.render(); } catch (err) { UI.toast(err.message, 'danger'); } input.value = ''; };
        r.readAsText(f);
      });
      readFile(root.querySelector('[data-action="import"]'), obj => { Store.importAll(obj); UI.toast('Documentation imported.'); });
    }
  };
})();
