/* Notes — provider notes (read-only) and nursing notes with templates. */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};

  const TEMPLATES = {
    'Nursing Narrative': [['text', 'Note', 'textarea', 8]],
    'SBAR — Provider Notification': [
      ['provider', 'Provider notified', 'text'], ['method', 'Method', 'select', ['Telephone', 'In person', 'Page', 'Secure message']],
      ['s', 'S — Situation', 'textarea', 2], ['b', 'B — Background', 'textarea', 2], ['a', 'A — Assessment', 'textarea', 2], ['r', 'R — Recommendation / request', 'textarea', 2],
      ['outcome', 'Provider response / orders received', 'textarea', 2]
    ],
    'Focus Note (DAR)': [['focus', 'Focus', 'text'], ['d', 'D — Data', 'textarea', 3], ['a', 'A — Action', 'textarea', 3], ['r', 'R — Response', 'textarea', 3]],
    'Patient Education': [
      ['topic', 'Topic(s)', 'text'], ['learner', 'Learner', 'select', ['Patient', 'Family/caregiver', 'Patient and family']],
      ['method', 'Method', 'select', ['Verbal', 'Written material', 'Demonstration', 'Teach-back', 'Video']],
      ['barriers', 'Barriers to learning', 'text'],
      ['response', 'Response', 'select', ['Verbalized understanding', 'Return demonstration', 'Needs reinforcement', 'Unable to learn at this time']],
      ['text', 'Comment', 'textarea', 3]
    ],
    'Handoff Report (I-PASS)': [
      ['i', 'I — Illness severity', 'select', ['Stable', 'Watcher', 'Unstable']], ['p', 'P — Patient summary', 'textarea', 3],
      ['a', 'A — Action list', 'textarea', 3], ['s', 'S — Situation awareness & contingency', 'textarea', 2], ['s2', 'S — Synthesis by receiver', 'textarea', 2]
    ]
  };

  function fieldHtml([key, label, type, extra]) {
    if (type === 'textarea') return `<label class="field wide"><span>${esc(label)}</span><textarea name="${key}" rows="${extra || 3}"></textarea></label>`;
    if (type === 'select') return `<label class="field"><span>${esc(label)}</span><select name="${key}">${UI.options(extra)}</select></label>`;
    return `<label class="field"><span>${esc(label)}</span><input name="${key}"></label>`;
  }

  function noteBody(type, data) {
    const tpl = TEMPLATES[type];
    if (!tpl) return `<p>${U.nl2br(data.text)}</p>`;
    return tpl.filter(([k]) => !U.isEmpty(data[k])).map(([k, label]) =>
      tpl.length === 1 ? `<p>${U.nl2br(data[k])}</p>` : `<div class="detail-row"><strong>${esc(label)}:</strong> ${U.nl2br(data[k])}</div>`).join('');
  }

  Views.notes = {
    label: 'Nursing Notes',
    render(p, doc) {
      const items = [
        // Provider notes live on the Provider Notes tab; this tab is nursing documentation only.
        ...p.notes.filter(n => !(Views.isProviderNote && Views.isProviderNote(n))).map(n => ({ kind: 'prior', time: n.time, n })),
        ...doc.notes.filter(e => !e.data.addendumTo).map(e => ({ kind: 'student', time: e.time, e }))
      ].sort((a, b) => b.time - a.time);
      const addenda = id => doc.notes.filter(e => e.data.addendumTo === id);

      const list = items.length ? items.map(it => {
        if (it.kind === 'prior') {
          const n = it.n;
          return `<article class="note ${n.isNew ? 'note-new' : ''}"><header><strong>${esc(n.type)}</strong>${n.isNew ? ' ' + UI.badge('NEW', 'new') : ''}<span class="muted"> — ${esc(U.fmtDT(n.time))} · ${esc(n.author)}</span></header><div class="note-body">${U.body(n)}</div></article>`;
        }
        const e = it.e;
        return `<article class="note note-student ${e.status === 'error' ? 'struck-note' : ''}">
          <header><strong>${esc(e.data.type)}</strong></header>
          <div class="note-body">${noteBody(e.data.type, e.data)}</div>
          <div class="note-sig">Electronically signed: ${esc(Model.signature(e))}</div>
          ${UI.entryMeta(e)}
          ${addenda(e.id).map(a => `<div class="addendum ${a.status === 'error' ? 'struck' : ''}"><strong>Addendum</strong> — ${U.nl2br(a.data.text)}${UI.entryMeta(a)}</div>`).join('')}
          ${e.status === 'active' ? `<div class="note-actions"><button class="btn btn-sm" data-add="${e.id}">Add Addendum</button> <button class="btn btn-sm btn-link" data-err="${e.id}">Mark in error</button></div>` : ''}
        </article>`;
      }).join('') : UI.empty('No notes yet.');

      return `<div class="view-actions">
          <label class="inline">New note: <select class="note-type">${Object.keys(TEMPLATES).map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
          <button class="btn btn-primary" data-action="new">+ Write Note</button>
        </div>${list}`;
    },
    bind(root, p, doc) {
      root.querySelector('[data-action="new"]').addEventListener('click', () => write(p, root.querySelector('.note-type').value));
      root.querySelectorAll('[data-err]').forEach(b => b.addEventListener('click', () => UI.errorEntry(p, 'notes', b.dataset.err)));
      root.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => UI.modal({
        title: 'Addendum',
        body: `${UI.timeField(p)}<label class="field"><span>Addendum text</span><textarea name="text" rows="4"></textarea></label>`,
        buttons: [{ label: 'Cancel' }, { label: 'Sign & Save', cls: 'btn-primary', onClick: api => {
          const v = U.formValues(api.el);
          if (!v.text) { UI.formError(api.el.querySelector('.modal-body'), 'Enter the addendum text.'); return false; }
          Store.add(p.id, 'notes', { type: 'Addendum', addendumTo: b.dataset.add, text: v.text }, UI.readTime(p, api.el), p.clock.now());
          App.render();
        } }]
      })));
    }
  };

  function write(p, type, after) {
    UI.modal({
      title: type,
      wide: true,
      body: `<div class="form-grid">${UI.timeField(p, 'Date/time of note')}</div><div class="form-grid">${TEMPLATES[type].map(fieldHtml).join('')}</div>`,
      buttons: [{ label: 'Cancel' }, { label: 'Sign & Save', cls: 'btn-primary', onClick: api => {
        const v = U.formValues(api.el);
        const time = UI.readTime(p, api.el);
        delete v._time;
        if (!Object.values(v).some(x => !U.isEmpty(x))) { UI.formError(api.el.querySelector('.modal-body'), 'The note is empty.'); return false; }
        Store.add(p.id, 'notes', Object.assign({ type }, v), time, p.clock.now());
        UI.toast('Note signed.');
        App.render();
        if (after) setTimeout(after, 0);
      } }]
    });
  }

  Views.notes.noteBody = noteBody;
  Views.notes.write = write;
})();
