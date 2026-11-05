/* Care Plan — nursing diagnoses, goals, interventions, and evaluations. */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};

  const DX = ['Impaired gas exchange', 'Ineffective airway clearance', 'Ineffective breathing pattern', 'Decreased cardiac output', 'Acute pain', 'Chronic pain',
    'Risk for bleeding', 'Risk for shock', 'Risk for infection', 'Risk for falls', 'Risk for impaired skin integrity', 'Impaired physical mobility',
    'Activity intolerance', 'Excess fluid volume', 'Deficient fluid volume', 'Risk for decreased cardiac tissue perfusion', 'Ineffective peripheral tissue perfusion',
    'Acute confusion', 'Anxiety', 'Fear', 'Deficient knowledge', 'Disturbed sensory perception', 'Risk for other-directed violence', 'Risk for self-directed violence',
    'Disturbed thought processes', 'Ineffective coping', 'Noncompliance', 'Impaired urinary elimination', 'Constipation', 'Ineffective health management'];

  Views.careplan = {
    label: 'Care Plan',
    render(p, doc) {
      const plans = doc.careplan.filter(e => e.data.kind === 'plan').sort((a, b) => a.time - b.time);
      const evals = id => doc.careplan.filter(e => e.data.kind === 'eval' && e.data.planId === id).sort((a, b) => a.time - b.time);
      const list = plans.length ? plans.map(e => `<article class="note note-student ${e.status === 'error' ? 'struck-note' : ''}">
          <header><strong>${esc(e.data.dx)}</strong> ${e.data.priority ? UI.badge('Priority ' + e.data.priority, 'info') : ''}</header>
          <div class="note-body">
            ${e.data.rt ? `<div class="detail-row"><strong>Related to:</strong> ${esc(e.data.rt)}</div>` : ''}
            ${e.data.aeb ? `<div class="detail-row"><strong>As evidenced by:</strong> ${esc(e.data.aeb)}</div>` : ''}
            <div class="detail-row"><strong>Goal / expected outcome:</strong> ${U.nl2br(e.data.goal)}</div>
            <div class="detail-row"><strong>Interventions (with rationale):</strong><br>${U.nl2br(e.data.interventions)}</div>
          </div>
          ${UI.entryMeta(e)}
          ${evals(e.id).map(v => `<div class="addendum ${v.status === 'error' ? 'struck' : ''}"><strong>Evaluation: ${esc(v.data.status)}</strong> — ${U.nl2br(v.data.text)}${UI.entryMeta(v)}</div>`).join('')}
          ${e.status === 'active' ? `<div class="note-actions"><button class="btn btn-sm" data-eval="${e.id}">Evaluate</button> <button class="btn btn-sm btn-link" data-err="${e.id}">Mark in error</button></div>` : ''}
        </article>`).join('') : UI.empty('No care plan problems added yet.');
      return `<div class="view-actions"><button class="btn btn-primary" data-action="new">+ Add Nursing Diagnosis</button></div>${list}`;
    },
    bind(root, p) {
      root.querySelector('[data-action="new"]').addEventListener('click', () => UI.modal({
        title: 'Add Nursing Diagnosis',
        wide: true,
        body: `<datalist id="dx-list">${DX.map(d => `<option value="${esc(d)}">`).join('')}</datalist>
          <div class="form-grid">
            <label class="field"><span>Nursing diagnosis</span><input name="dx" list="dx-list" required></label>
            <label class="field"><span>Priority</span><select name="priority">${UI.options(['1', '2', '3', '4', '5'])}</select></label>
            <label class="field"><span>Related to</span><input name="rt"></label>
            <label class="field"><span>As evidenced by</span><input name="aeb"></label>
          </div>
          <label class="field"><span>Goal / expected outcome (specific, measurable, time-bound)</span><textarea name="goal" rows="2"></textarea></label>
          <label class="field"><span>Nursing interventions with rationale</span><textarea name="interventions" rows="5"></textarea></label>`,
        buttons: [{ label: 'Cancel' }, { label: 'Save', cls: 'btn-primary', onClick: api => {
          const v = U.formValues(api.el);
          if (!v.dx || !v.goal || !v.interventions) { UI.formError(api.el.querySelector('.modal-body'), 'Diagnosis, goal, and interventions are required.'); return false; }
          Store.add(p.id, 'careplan', Object.assign({ kind: 'plan' }, v), p.clock.now(), p.clock.now());
          App.render();
        } }]
      }));
      root.querySelectorAll('[data-eval]').forEach(b => b.addEventListener('click', () => UI.modal({
        title: 'Evaluate Outcome',
        body: `<label class="field"><span>Status</span><select name="status">${UI.options(['Goal met', 'Progressing', 'Not met — revise plan'], null, false)}</select></label>
          <label class="field"><span>Evaluation (patient data supporting the status)</span><textarea name="text" rows="4"></textarea></label>`,
        buttons: [{ label: 'Cancel' }, { label: 'Save', cls: 'btn-primary', onClick: api => {
          const v = U.formValues(api.el);
          if (!v.text) { UI.formError(api.el.querySelector('.modal-body'), 'Describe the evaluation.'); return false; }
          Store.add(p.id, 'careplan', { kind: 'eval', planId: b.dataset.eval, status: v.status, text: v.text }, p.clock.now(), p.clock.now());
          App.render();
        } }]
      })));
      root.querySelectorAll('[data-err]').forEach(b => b.addEventListener('click', () => UI.errorEntry(p, 'careplan', b.dataset.err)));
    }
  };
})();
