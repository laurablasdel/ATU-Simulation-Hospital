/*
 * EMR Orientation — practice patient (orientation.html only).
 * A simple, stable med-surg chart for students to practice on before simulation day.
 * It is NOT one of the simulation patients, so orientation never previews a scenario.
 * The tutorial (js/views/tutorial.js) checks tasks against these ids:
 *   prac-o-new   the new order to acknowledge
 *   prac-cbc     the lab panel holding the latest Hgb (11.8)
 *   prac-apap    the PRN medication
 * Times work as in js/data/patients.js (scenarioStart = the time the chart opens at).
 * The scheduled meds use fixedTimes with a dose at "at: 0", so they are due whenever a student
 * opens the chart (instead of at 0900 real time, which would be overdue in an afternoon class).
 */
window.SIM_PATIENTS = [
  {
    id: 'practice',
    level: 3,
    experiences: ['orient'],
    name: { first: 'Taylor', last: 'Morgan' },
    mrn: 'ORIENT-001',
    dob: '1968-03-14',
    age: '58 years',
    sex: 'F',
    unit: 'Medical-Surgical Unit',
    room: '101-1',
    service: 'Medicine',
    attending: 'Dr. Avery Lee',
    admitted: { time: '18:00', day: -1 },
    scenarioStart: '09:00',
    admitDx: 'Community-acquired pneumonia',
    codeStatus: 'Full Code',
    advanceDirective: 'None on file',
    isolation: 'Standard',
    nkda: false,
    allergies: [{ agent: 'Sulfa drugs', reaction: 'Rash', severity: 'Moderate', tags: ['sulfa'] }],
    heightCm: 165,
    weightKg: 72,
    flags: ['Practice patient', 'Fall Risk'],
    assessmentForms: ['wdl-adult', 'pain', 'morse', 'braden'],
    emergencyContact: 'Spouse — phone on file',
    demographics: {
      'Marital status': 'Married',
      'Primary language': 'English',
      Occupation: 'Office manager',
      Insurance: 'Commercial',
      'Cultural considerations': 'None'
    },
    hpi: '58-year-old female with 4 days of productive cough, fever to 101.5 °F, and shortness of breath on exertion. Chest X-ray in the emergency department showed right lower lobe pneumonia. Admitted last evening for IV antibiotics and oxygen.',
    pmh: ['Hypertension'],
    psh: ['Appendectomy (age 20)'],
    familyHx: ['Hypertension — mother'],
    socialHx: ['Lives with spouse', 'Never smoker', 'Alcohol: occasional', 'Drugs: denies'],
    homeMeds: [{ name: 'Lisinopril', dose: '10 mg', route: 'PO', freq: 'Daily' }],
    ros: [
      ['General', 'Alert and oriented x4; tired'],
      ['Respiratory', 'Productive cough with yellow sputum; crackles right base'],
      ['Cardiac', 'Regular rate and rhythm'],
      ['GI', 'Eating about half of meals; no nausea']
    ],
    orders: [
      { id: 'prac-o1', cat: 'Admission', text: 'Admit to Medical-Surgical Unit', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o2', cat: 'Code Status', text: 'Full Code', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o3', cat: 'Nursing', text: 'Vital signs every 4 hours', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o4', cat: 'Nursing', text: 'I & O every shift', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o5', cat: 'Respiratory', text: 'Oxygen per nasal cannula at 2 L/min; titrate to keep SpO2 ≥ 92%', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o6', cat: 'Diet', text: 'Regular diet', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o7', cat: 'Lab', text: 'CBC and BMP daily in AM', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o8', cat: 'Imaging', text: 'Chest X-ray PA and lateral', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o-new', cat: 'Activity', text: 'Ambulate in hallway 3 times daily with assistance', at: -15, by: 'Dr. Avery Lee', isNew: true }
    ],
    meds: [
      { id: 'prac-ns', name: '0.9% Sodium chloride', dose: '75 mL/hr', route: 'IV', freq: 'Continuous', type: 'continuous', rate: '75 mL/hr', ordered: { time: '18:00', day: -1 } },
      { id: 'prac-ceftriaxone', name: 'Ceftriaxone', dose: '1 g', route: 'IVPB', freq: 'Daily', type: 'scheduled', tags: ['cephalosporin'], indication: 'Pneumonia', ordered: { time: '18:00', day: -1 },
        fixedTimes: true, doses: [{ at: 0 }, { at: 1440 }] },
      { id: 'prac-lisinopril', name: 'Lisinopril', dose: '10 mg', route: 'PO', freq: 'Daily', type: 'scheduled', preAssess: ['SBP', 'HR'], holdIf: [{ p: 'SBP', op: '<', v: 100 }], ordered: { time: '18:00', day: -1 },
        fixedTimes: true, doses: [{ at: 0 }, { at: 1440 }] },
      { id: 'prac-apap', name: 'Acetaminophen', dose: '650 mg', route: 'PO', freq: 'Every 6 hours PRN', type: 'prn', indication: 'Pain or temperature > 100.4 °F', preAssess: ['Pain'], minIntervalHr: 6, ordered: { time: '18:00', day: -1 } }
    ],
    vitals: [
      { time: '20:00', day: -1, temp: 101.2, tempRoute: 'Oral', hr: 104, rr: 22, sbp: 132, dbp: 80, spo2: 91, o2: 'Nasal cannula', o2Flow: 2, pain: 4, by: 'Night shift RN' },
      { time: '04:00', temp: 100.4, tempRoute: 'Oral', hr: 96, rr: 20, sbp: 128, dbp: 76, spo2: 93, o2: 'Nasal cannula', o2Flow: 2, pain: 3, by: 'Night shift RN' }
    ],
    labs: [
      { id: 'prac-cbc0', panel: 'Complete Blood Count', time: '19:00', day: -1, results: [
        { t: 'WBC', v: 15.6, u: 'x10³/µL', lo: 4.5, hi: 11 },
        { t: 'Hgb', v: '12.1', u: 'g/dL', lo: 12, hi: 16 },
        { t: 'HCT', v: 36, u: '%', lo: 36, hi: 46 },
        { t: 'Platelets', v: 248, u: 'x10³/µL', lo: 150, hi: 400 }] },
      { id: 'prac-cbc', panel: 'Complete Blood Count', time: '05:00', results: [
        { t: 'WBC', v: 14.2, u: 'x10³/µL', lo: 4.5, hi: 11 },
        { t: 'Hgb', v: '11.8', u: 'g/dL', lo: 12, hi: 16 },
        { t: 'HCT', v: 35, u: '%', lo: 36, hi: 46 },
        { t: 'Platelets', v: 255, u: 'x10³/µL', lo: 150, hi: 400 }] },
      { id: 'prac-bmp', panel: 'Basic Metabolic Panel', time: '05:00', results: [
        { t: 'Sodium', v: 137, u: 'mEq/L', lo: 135, hi: 145 },
        { t: 'Potassium', v: '3.9', u: 'mEq/L', lo: 3.5, hi: 5.1 },
        { t: 'Chloride', v: 101, u: 'mEq/L', lo: 98, hi: 107 },
        { t: 'CO2', v: 24, u: 'mEq/L', lo: 22, hi: 29 },
        { t: 'BUN', v: 16, u: 'mg/dL', lo: 7, hi: 20 },
        { t: 'Creatinine', v: '0.9', u: 'mg/dL', lo: 0.6, hi: 1.1 },
        { t: 'Glucose', v: 128, u: 'mg/dL', lo: 70, hi: 110 }] }
    ],
    imaging: [
      { id: 'prac-cxr', study: 'Chest X-ray PA and lateral', time: '19:30', day: -1, text: 'FINDINGS: Patchy consolidation in the right lower lobe. No pleural effusion. Heart size normal.\n\nIMPRESSION: Right lower lobe pneumonia.' }
    ],
    notes: [
      { id: 'prac-hp', type: 'History & Physical', author: 'Dr. Avery Lee', time: '18:30', day: -1, md: true, text: '**Chief complaint:** Cough and fever for 4 days.\n\n**HPI:** 58-year-old female with productive cough, fever to 101.5 °F, and shortness of breath on exertion. Chest X-ray shows right lower lobe pneumonia.\n\n**PMH:** Hypertension. **Allergies:** Sulfa drugs (rash).\n\n**Assessment:** Community-acquired pneumonia.\n\n**Plan:**\n1. Ceftriaxone 1 g IV daily.\n2. Oxygen to keep SpO2 ≥ 92%.\n3. Acetaminophen PRN for pain or fever.\n4. Continue home lisinopril; hold for SBP < 100.\n5. Ambulate as tolerated.' },
      { id: 'prac-n1', type: 'Nursing Note', author: 'Night shift RN', time: '04:15', text: 'Resting with eyes closed between care. Temp 100.4 °F; acetaminophen not needed overnight. Lung sounds with crackles right base. On 2 L nasal cannula, SpO2 93%. Ambulated to the bathroom with standby assist.' }
    ],
    io: [
      { time: '22:00', day: -1, kind: 'in', cat: 'IV', amt: 300 },
      { time: '02:00', kind: 'in', cat: 'IV', amt: 300 },
      { time: '06:00', kind: 'out', cat: 'Urine — voided', amt: 450 }
    ],
    events: []
  }
];
