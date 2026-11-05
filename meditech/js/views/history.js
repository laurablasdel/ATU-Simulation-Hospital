/* History — HPI, medical/surgical/family/social history, home medications. */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};

  const list = arr => arr && arr.length ? `<ul class="plain bullets">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : UI.empty('None documented.');

  Views.history = {
    label: 'History & Problems',
    render(p) {
      const meds = p.homeMeds && p.homeMeds.length ? `<table class="grid"><thead><tr><th>Medication</th><th>Dose</th><th>Route</th><th>Frequency</th></tr></thead><tbody>
        ${p.homeMeds.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.dose)}</td><td>${esc(m.route)}</td><td>${esc(m.freq)}</td></tr>`).join('')}</tbody></table>` : UI.empty('No home medications.');
      const ros = p.ros ? `<dl class="kv">${p.ros.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '';
      return `<div class="grid-2">
        ${UI.panel('History of Present Illness', `<p>${U.nl2br(p.hpi)}</p>`)}
        ${UI.panel('Past Medical History', list(p.pmh))}
        ${UI.panel('Past Surgical History', list(p.psh))}
        ${UI.panel('Family History', list(p.familyHx))}
        ${UI.panel('Social History', list(p.socialHx))}
        ${UI.panel('Home Medications', meds)}
        ${ros ? UI.panel('Review of Systems', ros) : ''}
        ${p.immunizations ? UI.panel('Immunizations', list(p.immunizations)) : ''}
      </div>`;
    }
  };
})();
