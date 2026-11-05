/*
 * EMR Orientation settings (orientation.html only). Loaded right after js/config.js.
 * Orientation uses the same EHR as the simulation site, with its own practice patient
 * (js/data/orientation-patients.js), its own saved charting, and the guided task panel.
 */
Object.assign(window.EHR_CONFIG, {
  orientation: true,
  systemName: 'SimEHR Orientation',
  // Separate storage: practice charting never mixes with simulation documentation.
  storagePrefix: 'atuSimEHR.orient',
  // Practice charting stays on the device: never part of the shared classroom chart.
  shared: null,
  experiences: [{ id: 'orient', label: 'EMR Orientation' }]
});
