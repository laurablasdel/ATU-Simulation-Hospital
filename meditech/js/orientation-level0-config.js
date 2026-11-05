/*
 * Level 0 Orientation settings (orientation-level0.html only). Loaded right after js/config.js.
 * Same EHR as the simulation site, with a practice copy of the Level 0 Jane Fowler admission chart
 * (js/data/orientation-patients.js, id practice-l0), its own saved charting, and the Level 0 task list.
 */
Object.assign(window.EHR_CONFIG, {
  orientation: true,
  orientationTrack: 'level0',
  orientationPid: 'practice-l0',
  orientationTitle: 'Level 0 Orientation',
  systemName: 'SimEHR Level 0 Orientation',
  // Separate storage: practice charting never mixes with simulation documentation or the general orientation.
  storagePrefix: 'atuSimEHR.orientL0',
  shared: null,
  experiences: [{ id: 'orient-l0', label: 'Level 0 Orientation' }]
});
