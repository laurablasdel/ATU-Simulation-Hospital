/* Shared interface pieces: dialogs, toasts, panels, entry footers. */
(function () {
  'use strict';
  const esc = U.esc;

  const UI = {};

  UI.panel = (title, body, opts) => {
    opts = opts || {};
    return `<section class="panel ${opts.cls || ''}">
      <header class="panel-head"><h2>${esc(title)}</h2>${opts.actions ? `<div class="panel-actions">${opts.actions}</div>` : ''}</header>
      <div class="panel-body">${body}</div>
    </section>`;
  };

  UI.empty = msg => `<p class="empty">${esc(msg)}</p>`;

  UI.flag = f => f ? `<span class="flag flag-${f.replace('*', 'c')}">${esc(f)}</span>` : '';

  UI.badge = (text, kind) => `<span class="badge badge-${kind || 'info'}">${esc(text)}</span>`;

  // Footer line on every documented entry: who, when, late entry, error.
  UI.entryMeta = e => {
    const late = Model.lateLabel(e);
    return `<div class="entry-meta">
      ${esc(U.fmtDT(e.time))} · ${esc(Model.signature(e))}
      ${late ? `<span class="late">${esc(late)}</span>` : ''}
      ${e.status === 'error' ? `<span class="err-label">Entered in error — ${esc(e.error.reason)} (${esc(e.error.by)})</span>` : ''}
    </div>`;
  };

  UI.modal = function ({ title, body, wide, buttons, onOpen, onClose }) {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `<div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
        <div class="modal-body">${body}</div>
        <div class="modal-foot"></div>
      </div>`;
    const foot = wrap.querySelector('.modal-foot');
    // Escape closes only the top dialog (e.g., the camera over an administration).
    const onKey = e => { if (e.key === 'Escape' && root.lastElementChild === wrap) api.close(); };
    const api = {
      el: wrap,
      close() { if (!wrap.isConnected) return; wrap.remove(); document.removeEventListener('keydown', onKey); if (onClose) onClose(); }
    };
    (buttons || [{ label: 'Close' }]).forEach(b => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ' + (b.cls || '');
      btn.textContent = b.label;
      btn.addEventListener('click', () => {
        if (b.onClick && b.onClick(api) === false) return;
        api.close();
      });
      foot.appendChild(btn);
    });
    wrap.querySelector('[data-close]').addEventListener('click', api.close);
    document.addEventListener('keydown', onKey);
    root.appendChild(wrap);
    if (onOpen) onOpen(api);
    const f = wrap.querySelector('[autofocus]') || wrap.querySelector('input, select, textarea');
    if (f) f.focus();
    return api;
  };

  UI.confirm = (title, message, onYes, yesLabel) => UI.modal({
    title,
    body: `<p>${esc(message)}</p>`,
    buttons: [{ label: 'Cancel' }, { label: yesLabel || 'Continue', cls: 'btn-danger', onClick: () => { onYes(); } }]
  });

  UI.toast = function (msg, kind) {
    let stack = document.getElementById('toasts');
    if (!stack) { stack = document.createElement('div'); stack.id = 'toasts'; stack.setAttribute('role', 'status'); document.body.appendChild(stack); }
    const t = document.createElement('div');
    t.className = 'toast toast-' + (kind || 'ok');
    t.textContent = msg;
    stack.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2800);
  };

  // Show an inline error inside a modal/form.
  UI.formError = (root, msg) => {
    let box = root.querySelector('.form-error');
    if (!box) { box = document.createElement('div'); box.className = 'form-error'; root.prepend(box); }
    box.textContent = msg;
    box.scrollIntoView({ block: 'nearest' });
  };

  // "Mark as entered in error" with a required reason.
  UI.errorEntry = function (p, section, id) {
    UI.modal({
      title: 'Mark Entry in Error',
      body: `<p class="muted">Entries are never deleted from the medical record. The original stays visible with a line through it.</p>
        <label class="field"><span>Reason</span>
          <select name="reason">
            <option>Wrong patient</option><option>Wrong time</option><option>Incorrect value</option>
            <option>Duplicate entry</option><option>Documented on wrong form</option><option>Other</option>
          </select></label>
        <label class="field"><span>Comment (optional)</span><input name="comment" type="text"></label>`,
      buttons: [
        { label: 'Cancel' },
        { label: 'Mark in Error', cls: 'btn-danger', onClick: api => {
          const v = U.formValues(api.el);
          Store.markError(p.id, section, id, v.reason + (v.comment ? ': ' + v.comment : ''), p.clock.now());
          UI.toast('Entry marked as entered in error.', 'warn');
          App.render();
        } }
      ]
    });
  };

  // Standard "Date/time performed" field for documentation forms.
  UI.timeField = (p, label) => `<label class="field"><span>${esc(label || 'Date/time performed')}</span>
      <input type="datetime-local" name="_time" value="${U.toInput(p.clock.now())}" required></label>`;

  UI.readTime = (p, root) => U.fromInput(root.querySelector('[name="_time"]').value) || p.clock.now();

  // Build <option>s
  UI.options = (list, selected, blank) =>
    (blank !== false ? '<option value=""></option>' : '') +
    list.map(o => `<option${o === selected ? ' selected' : ''}>${esc(o)}</option>`).join('');

  window.UI = UI;
})();
