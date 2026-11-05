/* Small helpers shared by every screen. */
(function () {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  const U = {
    pad,
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]),
    nl2br: s => U.esc(s).replace(/\n/g, '<br>'),
    // Small, safe Markdown renderer for imported chart text: headings, bold, lists,
    // checkboxes, block quotes, pipe tables, and images/PDFs under assets/.
    // Body of an imported note/report: Markdown when flagged, images when present.
    attachment(x) { const a=x.attachment; if(!a || !/^data:(image\/(png|jpeg|webp)|application\/(pdf|vnd.openxmlformats-officedocument.wordprocessingml.document));base64,/.test(a.data||''))return ''; return (a.type.startsWith('image/') ? '<img class="faculty-attachment" src="'+U.esc(a.data)+'" alt="'+U.esc(a.name)+'">' : '') + '<p><a class="btn btn-sm" download="'+U.esc(a.name)+'" href="'+U.esc(a.data)+'">Download '+U.esc(a.name)+'</a></p>'; },
    body(x) { return U.attachment(x) + (x.images || []).map(src => `<a href="${U.esc(src)}" target="_blank" rel="noopener"><img class="md-img" src="${U.esc(src)}" alt="${U.esc(x.study || x.title || 'Chart image')}"></a>`).join('') + (x.md || x.images ? U.md(x.text || '') : U.nl2br(x.text || '')); },
    md(src) {
      const inline = t => U.esc(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
      const lines = String(src || '').split('\n');
      const out = [];
      let list = null, table = null;
      const flush = () => { if (list) { out.push(`<${list.t}>${list.items.join('')}</${list.t}>`); list = null; } if (table) { out.push(`<table class="grid md-table"><tbody>${table.map((r, i) => `<tr>${r.map(c => i === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); table = null; } };
      lines.forEach(raw => {
        const l = raw.replace(/\s+$/, '');
        let m;
        if (/^\|.*\|$/.test(l)) { if (/^\|[\s|:-]+\|$/.test(l)) return; if (list) flush(); (table = table || []).push(l.replace(/^\||\|$/g, '').split('|').map(c => c.trim())); return; }
        if (table) flush();
        if ((m = /^\s*!\[[^\]]*\]\((assets\/[^)\s]+)\)\s*$/.exec(l))) { flush(); out.push(/\.pdf$/i.test(m[1]) ? `<p><a class="btn btn-sm" href="${U.esc(m[1])}" target="_blank" rel="noopener">Open PDF</a></p>` : `<a href="${U.esc(m[1])}" target="_blank" rel="noopener"><img class="md-img" src="${U.esc(m[1])}" alt="Chart image"></a>`); return; }
        if ((m = /^(#{1,4})\s*(.*)$/.exec(l))) { flush(); const txt = m[2].replace(/\*\*/g, '').trim(); if (txt) out.push(`<h${Math.min(6, m[1].length + 2)} class="md-h">${inline(txt)}</h${Math.min(6, m[1].length + 2)}>`); return; }
        if ((m = /^\s*[-*•]\s+\[( |x)\]\s*(.*)$/i.exec(l))) { if (!list || list.t !== 'ul') { flush(); list = { t: 'ul', items: [] }; } list.items.push(`<li class="md-check">${m[1].trim() ? '☑' : '☐'} ${inline(m[2])}</li>`); return; }
        if ((m = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(l))) { const t = /^\s*\d/.test(l) ? 'ol' : 'ul'; if (!list || list.t !== t) { flush(); list = { t, items: [] }; } list.items.push(`<li>${inline(m[1])}</li>`); return; }
        if ((m = /^>\s*(.*)$/.exec(l))) { flush(); out.push(`<div class="md-callout">${inline(m[1])}</div>`); return; }
        if (/^-{3,}$/.test(l)) { flush(); out.push('<hr>'); return; }
        flush();
        if (l.trim()) out.push(`<p>${inline(l)}</p>`);
      });
      flush();
      return out.join('');
    },
    uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7),

    fmtDate(t) { const d = new Date(t); return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`; },
    fmtTime(t) { const d = new Date(t); return pad(d.getHours()) + pad(d.getMinutes()); },
    fmtDT(t) { return U.fmtDate(t) + ' ' + U.fmtTime(t); },
    fmtDOB(iso) { if (!/^\d{4}-\d\d-\d\d$/.test(iso || '')) return iso || ''; const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; },

    // Value for <input type="datetime-local">
    toInput(t) {
      const d = new Date(t);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },
    fromInput(s) { const t = new Date(s).getTime(); return isNaN(t) ? null : t; },

    num(v) { if (v === '' || v == null) return null; const n = Number(v); return isNaN(n) ? null : n; },
    isEmpty: v => v == null || v === '' || (Array.isArray(v) && v.length === 0),

    // Collects named inputs of a form into an object. Checkbox groups become arrays.
    formValues(root) {
      const out = {};
      root.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => {
        if (el.disabled) return;
        if (el.type === 'checkbox') {
          if (el.dataset.single) { out[el.name] = el.checked; return; }
          if (!Array.isArray(out[el.name])) out[el.name] = [];
          if (el.checked) out[el.name].push(el.value);
        } else if (el.type === 'radio') {
          if (el.checked) out[el.name] = el.value;
          else if (!(el.name in out)) out[el.name] = '';
        } else {
          out[el.name] = el.value.trim();
        }
      });
      return out;
    },

    download(filename, text, type) {
      const blob = new Blob([text], { type: type || 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    },

    initials(name) {
      return String(name || '').split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join('');
    }
  };

  window.U = U;
})();
