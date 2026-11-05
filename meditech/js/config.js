/*
 * ATU Simulation Hospital EHR — site configuration
 * Edit these values to customize the system for your simulation lab.
 */
window.EHR_CONFIG = {
  hospitalName: 'ATU Simulation Hospital',
  systemName: 'SimEHR',
  // Shown on the sign-in screen. Also bump ?v= in index.html, orientation.html, and labels.html when files change,
  // so browsers (older iPads especially) load the new files instead of a saved copy.
  version: '2026.11.05-secure.03',
  // Pending scenario payloads are server stored and returned only after faculty unlock.
  secureScenarioStore: true,

  // Toolbar Help button: HTML shown in the Help window (e.g., '<p>…</p><ul><li>…</li></ul>'). Empty = "will be added".
  helpHtml: '',
  // Reference links listed in the Help window (plain text links that open in a new tab).
  // PDR.net terms of use (revised June 24, 2015) allow "a simple link" to their site; no logo, no framing.
  helpLinks: [
    { label: 'PDR.net — Prescribers\' Digital Reference (drug information)', url: 'https://www.pdr.net/' },
    // Stabilis builds a Y-site compatibility chart for the drugs a student picks. Linked only; no Stabilis data is copied here.
    { label: 'Stabilis — IV Y-site compatibility table (pick your patient\'s drugs)', url: 'https://www.stabilis.org/TableIncompatibilites.php?codeLangue=EN-en' }
  ],

  // Simulation experiences students choose from at sign-in. Each patient in
  // js/data/patients.js lists the experience ids it belongs to.
  experiences: [
    { id: 'ms0', label: 'Level 0 — Medical-Surgical' },
    { id: 'ms', label: 'Medical-Surgical' },
    { id: 'advms', label: 'Advanced Medical-Surgical' },
    { id: 'icu', label: 'ICU / Critical Care' },
    { id: 'psych', label: 'Psychiatric / Mental Health' },
    { id: 'ob', label: 'OB / Maternal-Newborn' },
    { id: 'peds', label: 'Pediatrics' }
  ],

  // When true, students must scan (or type) the patient wristband MRN and the
  // medication barcode before documenting an administration. They may still
  // choose "Unable to scan" and give a reason, which is recorded.
  requireBarcodeScan: true,

  // A scheduled dose is "Due" from this many minutes before to this many
  // minutes after its scheduled time. After that it becomes "Overdue".
  medWindowMinutes: 60,

  // Entries charted more than this many minutes after the event time are
  // labeled "Late entry".
  lateEntryMinutes: 30,

  // Shared charting across devices (Supabase; see supabase/setup.sql and README).
  // Only the public project URL and the publishable key belong here — never the database
  // password or a secret / service_role key. Change "session" to start a separate class chart.
  shared: {
    url: 'https://ixjcltjdxwpewwopxbtl.supabase.co',
    key: 'sb_publishable_ForzPEUYNrqGmdSVPZdTEg_Xf32Ko63',
    app: 'atu-meditech-sim',
    session: 'classroom',
    // Filled in on the Shared connection screen: the one hospital login used on every sim computer.
    defaultEmail: 'Atusim1@atu.edu'
  },

  // Prefix for all browser storage keys. Change it to start fresh everywhere.
  storagePrefix: 'myAtuMeditech.v1',

  // Default adult reference ranges used to flag vital signs (H/L).
  // A patient can override any of these with its own "vitalRanges".
  vitalRanges: {
    temp: [96.8, 100.3], // °F
    hr: [60, 100],
    rr: [12, 20],
    sbp: [90, 140],
    dbp: [60, 90],
    map: [65, 110],
    spo2: [94, 100],
    glucose: [70, 180],
    pain: [0, 3]
  }
};
