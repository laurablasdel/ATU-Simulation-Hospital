/*
 * EMR Orientation — practice patients (orientation.html and orientation-level0.html only).
 * Neither page shares charting with the simulation site: each saves on the student's device only.
 *
 *  practice     Sunny Goldman — general documentation orientation (orientation.html).
 *               Upper GI bleed with symptomatic anemia; type 2 diabetes. Not one of the simulation
 *               patients, so this orientation never previews a scenario.
 *  practice-l0  Jane Fowler — Level 0 orientation (orientation-level0.html), a practice copy of the
 *               Level 0 pneumonia / fall admission chart (admission information only).
 *
 * The tutorial (js/views/tutorial.js) checks tasks against these ids:
 *   prac-o-new / prac-l0-o-new   the new order to acknowledge
 *   prac-cbc                     the lab panel holding Sunny's latest Hgb (7.2)
 *   prac-pantoprazole, prac-sucralfate   scheduled medications; prac-apap   the PRN medication
 *   prac-l0-ns                   Jane's normal saline infusion
 * Times work as in the simulation data (scenarioStart = the time the chart opens at).
 * Scheduled meds use fixedTimes with a dose at "at: 0", so they are due whenever a student opens the chart.
 */
window.SIM_PATIENTS = [
  {
    id: 'practice',
    level: 3,
    experiences: ['orient'],
    name: { first: 'Sunny', last: 'Goldman' },
    mrn: 'ORIENT-001',
    dob: '1966-09-14',
    age: '60 years',
    sex: 'F',
    unit: 'Medical-Surgical Unit',
    room: '101-1',
    service: 'Medicine',
    attending: 'Dr. Avery Lee',
    admitted: { time: '18:00', day: -1 },
    scenarioStart: '09:00',
    admitDx: 'Upper GI bleed (suspected NSAID-related gastric ulcer) with symptomatic anemia',
    codeStatus: 'Full Code',
    advanceDirective: 'None on file',
    isolation: 'Standard',
    nkda: false,
    allergies: [{ agent: 'Codeine', reaction: 'Nausea and vomiting', severity: 'Moderate', tags: ['codeine', 'opioid'] }],
    heightCm: 168,
    weightKg: 78,
    bloodType: 'O+',
    flags: ['Practice patient', 'Fall Risk', 'Bleeding precautions'],
    assessmentForms: ['wdl-adult', 'pain', 'morse', 'braden'],
    emergencyContact: 'Sister — phone on file',
    demographics: {
      'Marital status': 'Single',
      'Primary language': 'English',
      Occupation: 'Retired high school band director',
      Insurance: 'Medicare',
      'Cultural considerations': 'Accepts blood products'
    },
    hpi: '60-year-old female with 2 days of black, tarry stools, fatigue, and lightheadedness when standing. For 3 months she has taken ibuprofen 800 mg three times daily for knee osteoarthritis. In the emergency department her hemoglobin was 8.4 g/dL and her blood pressure dropped from 118/72 lying to 96/60 standing. Admitted for IV fluids, IV pantoprazole, serial hemoglobin checks, and GI consult (upper endoscopy planned).',
    pmh: ['Type 2 diabetes mellitus', 'Osteoarthritis — both knees', 'Hypertension'],
    psh: ['Cholecystectomy (age 45)'],
    familyHx: ['Type 2 diabetes — father'],
    socialHx: ['Lives alone; sister nearby', 'Never smoker', 'Alcohol: 1–2 glasses of wine per week', 'Drugs: denies'],
    homeMeds: [
      { name: 'Metformin', dose: '500 mg', route: 'PO', freq: 'Twice daily (on hold)' },
      { name: 'Lisinopril', dose: '10 mg', route: 'PO', freq: 'Daily (on hold)' },
      { name: 'Ibuprofen', dose: '800 mg', route: 'PO', freq: 'Three times daily (stopped)' }
    ],
    ros: [
      ['General', 'Alert and oriented x4; tired; lightheaded when standing'],
      ['Cardiac', 'Heart rate regular, mildly tachycardic'],
      ['GI', 'Black, tarry stools x2 days; mild epigastric discomfort; no vomiting'],
      ['Skin', 'Pale; capillary refill 3 seconds']
    ],
    orders: [
      { id: 'prac-o1', cat: 'Admission', text: 'Admit to Medical-Surgical Unit', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o2', cat: 'Code Status', text: 'Full Code', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o3', cat: 'Nursing', text: 'Vital signs every 4 hours, with orthostatic vital signs once each shift', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o4', cat: 'Nursing', text: 'I & O every shift; notify provider of any further black or bloody stools', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o5', cat: 'Activity', text: 'Up with assistance only; fall precautions', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o6', cat: 'Diet', text: 'Clear liquid diet; NPO after midnight for upper endoscopy', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o7', cat: 'Lab', text: 'CBC every 6 hours; BMP daily in AM; type and crossmatch 2 units PRBC', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o8', cat: 'Lab', protocol: 'hypo', text: 'Blood glucose before meals and at bedtime (every 6 hours while NPO). Follow the Adult Hypoglycemia Management Protocol for blood glucose less than 70 mg/dL.', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o9', cat: 'Consult', text: 'GI consult — upper endoscopy (EGD)', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o10', cat: 'Medication', text: 'Hold home metformin, lisinopril, and ibuprofen. No NSAIDs.', time: '18:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'prac-o-new', cat: 'Blood Products', text: 'Transfuse 1 unit packed red blood cells (PRBC) over 2 hours. Vital signs before, 15 minutes after the start, and at completion per transfusion policy. Recheck CBC 1 hour after the transfusion.', at: -15, by: 'Dr. Avery Lee', isNew: true }
    ],
    meds: [
      { id: 'prac-ns', name: '0.9% Sodium chloride', dose: '75 mL/hr', route: 'IV', freq: 'Continuous', type: 'continuous', rate: '75 mL/hr', ordered: { time: '18:00', day: -1 } },
      { id: 'prac-pantoprazole', name: 'Pantoprazole', dose: '40 mg', route: 'IV push', freq: 'Every 12 hours', type: 'scheduled', indication: 'Upper GI bleed', ordered: { time: '18:00', day: -1 },
        instructions: 'Give IV push over 2 minutes.', fixedTimes: true, doses: [{ at: 0 }, { at: 720 }] },
      { id: 'prac-sucralfate', name: 'Sucralfate', dose: '1 g', route: 'PO', freq: 'Before meals and at bedtime', type: 'scheduled', indication: 'Gastric ulcer', ordered: { time: '18:00', day: -1 },
        instructions: 'Give 1 hour before meals and at bedtime. Separate from other oral medications by 2 hours.', fixedTimes: true, doses: [{ at: 0 }, { at: 300 }, { at: 600 }] },
      { id: 'prac-apap', name: 'Acetaminophen', dose: '650 mg', route: 'PO', freq: 'Every 6 hours PRN', type: 'prn', indication: 'Pain or temperature > 100.4 °F (no NSAIDs)', preAssess: ['Pain'], minIntervalHr: 6, ordered: { time: '18:00', day: -1 } },
      { id: 'prac-d50', protocol: 'hypo', name: 'Dextrose 50% (D50)', dose: '25 g (50 mL)', route: 'IV push', freq: 'PRN per Adult Hypoglycemia Management Protocol', type: 'prn', indication: 'Blood glucose < 70 mg/dL and unable to take anything by mouth', highAlert: true, ordered: { time: '18:00', day: -1 } }
    ],
    vitals: [
      { time: '20:00', day: -1, temp: 98.4, tempRoute: 'Oral', hr: 108, rr: 18, sbp: 104, dbp: 64, spo2: 97, o2: 'Room air', pain: 2, by: 'Night shift RN' },
      { time: '04:00', temp: 98.6, tempRoute: 'Oral', hr: 102, rr: 18, sbp: 106, dbp: 66, spo2: 97, o2: 'Room air', pain: 2, by: 'Night shift RN' },
      { time: '06:00', glucose: 142, note: 'Fingerstick blood glucose', by: 'Night shift RN' }
    ],
    labs: [
      { id: 'prac-cbc0', panel: 'Complete Blood Count', time: '17:00', day: -1, results: [
        { t: 'WBC', v: 9.1, u: 'x10³/µL', lo: 4.5, hi: 11 },
        { t: 'Hgb', v: '8.4', u: 'g/dL', lo: 12, hi: 16 },
        { t: 'HCT', v: 25, u: '%', lo: 36, hi: 46 },
        { t: 'Platelets', v: 288, u: 'x10³/µL', lo: 150, hi: 400 }] },
      { id: 'prac-cbc1', panel: 'Complete Blood Count', time: '23:00', day: -1, results: [
        { t: 'WBC', v: 8.8, u: 'x10³/µL', lo: 4.5, hi: 11 },
        { t: 'Hgb', v: '7.9', u: 'g/dL', lo: 12, hi: 16 },
        { t: 'HCT', v: 24, u: '%', lo: 36, hi: 46 },
        { t: 'Platelets', v: 279, u: 'x10³/µL', lo: 150, hi: 400 }] },
      { id: 'prac-cbc', panel: 'Complete Blood Count', time: '05:00', results: [
        { t: 'WBC', v: 8.6, u: 'x10³/µL', lo: 4.5, hi: 11 },
        { t: 'Hgb', v: '7.2', u: 'g/dL', lo: 12, hi: 16 },
        { t: 'HCT', v: 22, u: '%', lo: 36, hi: 46 },
        { t: 'Platelets', v: 270, u: 'x10³/µL', lo: 150, hi: 400 }] },
      { id: 'prac-bmp', panel: 'Basic Metabolic Panel', time: '05:00', results: [
        { t: 'Sodium', v: 138, u: 'mEq/L', lo: 135, hi: 145 },
        { t: 'Potassium', v: '4.1', u: 'mEq/L', lo: 3.5, hi: 5.1 },
        { t: 'Chloride', v: 103, u: 'mEq/L', lo: 98, hi: 107 },
        { t: 'CO2', v: 23, u: 'mEq/L', lo: 22, hi: 29 },
        { t: 'BUN', v: 34, u: 'mg/dL', lo: 7, hi: 20 },
        { t: 'Creatinine', v: '0.9', u: 'mg/dL', lo: 0.6, hi: 1.1 },
        { t: 'Glucose', v: 146, u: 'mg/dL', lo: 70, hi: 110 }] },
      { id: 'prac-ts', panel: 'Blood Bank', time: '18:30', day: -1, results: [
        { t: 'ABO/Rh (blood type)', v: 'O+' },
        { t: 'Antibody screen', v: 'Negative' },
        { t: 'Crossmatch', v: '2 units PRBC crossmatched and available' }] }
    ],
    imaging: [],
    notes: [
      { id: 'prac-hp', type: 'History & Physical', author: 'Dr. Avery Lee', time: '18:30', day: -1, md: true, text: '**Chief complaint:** Black stools and lightheadedness for 2 days.\n\n**HPI:** 60-year-old female taking ibuprofen 800 mg three times daily for 3 months for knee osteoarthritis. Two days of melena, fatigue, and lightheadedness when standing. Hgb 8.4 g/dL in the ED (baseline 13 per clinic records). Orthostatic: 118/72 lying → 96/60 standing.\n\n**PMH:** Type 2 diabetes, osteoarthritis, hypertension. **Allergies:** Codeine (nausea and vomiting).\n\n**Assessment:** Upper GI bleed, suspected NSAID-related gastric ulcer; symptomatic anemia.\n\n**Plan:**\n1. IV fluids; IV pantoprazole every 12 hours; sucralfate.\n2. CBC every 6 hours; transfuse for Hgb < 7.5 or symptoms. Type and crossmatch 2 units.\n3. GI consult for upper endoscopy; NPO after midnight.\n4. Hold metformin, lisinopril, and ibuprofen. No NSAIDs.\n5. Blood glucose AC & HS / every 6 hours while NPO; hypoglycemia protocol.' },
      { id: 'prac-gi', type: 'GI Consult', author: 'Dr. Jordan Price (GI)', time: '21:00', day: -1, md: true, text: 'Agree with IV PPI and transfusion support. Upper endoscopy planned for later today once the hemoglobin is above 7.5 and she is hemodynamically stable. Signed blood transfusion consent obtained and on the chart.' },
      { id: 'prac-n1', type: 'Nursing Note', author: 'Night shift RN', time: '04:15', text: 'Resting between care. One black, tarry stool at 0130 (about 200 mL). Lightheaded with standing; assisted to the bathroom with a gait belt. Fall precautions in place. Fingerstick 142 at 0600. Sister updated by phone.' }
    ],
    documents: [
      { id: 'prac-consent', title: 'Blood Transfusion Consent', category: 'documents', md: '**Consent for Transfusion of Blood or Blood Products**\n\nPatient: Sunny Goldman · MRN ORIENT-001\n\nI have been told why I need a transfusion, the risks (including fever, allergic reaction, and rare infection), the benefits, and the alternatives. I agree to receive blood or blood products during this admission.\n\nPatient signature: *Sunny Goldman* · Witness: *Night shift RN* · Provider: *Dr. Avery Lee*' }
    ],
    protocols: {
      hypo: {
        title: 'Adult Hypoglycemia Management Protocol',
        items: [
          ['Use when', 'Blood glucose (BG) less than 70 mg/dL, with or without symptoms (shaky, sweaty, confused, irritable, headache).'],
          ['Alert and able to swallow', 'Give 15 g of fast-acting carbohydrate by mouth: 4 oz (120 mL) fruit juice or regular soda, or 15 g glucose gel or tablets.'],
          ['NPO or unable to swallow, IV access', 'Give dextrose 50% (D50) 25 g (50 mL) IV push.'],
          ['Unable to swallow, no IV access', 'Give glucagon 1 mg IM.'],
          ['Recheck', 'Recheck BG 15 minutes after each treatment. Repeat the treatment if BG is still less than 70 mg/dL.'],
          ['Notify the provider', 'BG less than 54 mg/dL, no response after 2 treatments, or any change in level of consciousness.'],
          ['After BG is 70 mg/dL or more', 'Give a snack or meal if not NPO. Recheck BG in 1 hour.'],
          ['Document', 'BG results, treatment given, recheck results, and provider notification.']
        ],
        tableTitle: 'Quick reference',
        table: { head: ['Blood glucose', 'Patient able to swallow', 'NPO / unable to swallow'], rows: [
          ['70 mg/dL or more', 'No treatment; continue monitoring', 'No treatment; continue monitoring'],
          ['54–69 mg/dL', '15 g fast-acting carbohydrate; recheck in 15 minutes', 'D50 25 g IV push; recheck in 15 minutes'],
          ['Less than 54 mg/dL', '15 g fast-acting carbohydrate; recheck in 15 minutes; notify provider', 'D50 25 g IV push; recheck in 15 minutes; notify provider']] },
        signedBy: 'Dr. Avery Lee'
      }
    },
    io: [
      { time: '22:00', day: -1, kind: 'in', cat: 'IV', amt: 300 },
      { time: '02:00', kind: 'in', cat: 'IV', amt: 300 },
      { time: '01:30', kind: 'out', cat: 'Stool', amt: 200 },
      { time: '06:00', kind: 'out', cat: 'Urine — voided', amt: 400 }
    ],
    events: []
  },
  // Other patients on the orientation status board, so students practice selecting the correct patient.
  {
    id: 'orient-wonder',
    level: 3,
    experiences: ['orient'],
    name: { first: 'Boyd', last: 'Wonderly' },
    mrn: 'ORIENT-002',
    dob: '2005-08-30',
    age: '21 years',
    sex: 'M',
    unit: 'Medical-Surgical Unit',
    room: '101-2',
    service: 'General Surgery',
    attending: 'Dr. Sam Ortiz',
    admitted: { time: '22:00', day: -1 },
    scenarioStart: '09:00',
    admitDx: 'Post-op day 1 laparoscopic appendectomy',
    codeStatus: 'Full Code',
    isolation: 'Standard',
    nkda: true,
    allergies: [],
    heightCm: 183,
    weightKg: 82,
    flags: ['Practice patient — not your assigned patient'],
    assessmentForms: ['wdl-adult', 'pain'],
    hpi: '21-year-old college student with right lower quadrant pain for 1 day. Laparoscopic appendectomy last evening without complications. Tolerating clear liquids; ambulating in the hallway.',
    pmh: ['None'], psh: ['Laparoscopic appendectomy (yesterday)'], familyHx: [], socialHx: ['College student; lives in a dorm'], homeMeds: [], ros: [],
    orders: [
      { id: 'won-o1', cat: 'Admission', text: 'Admit to Medical-Surgical Unit after surgery', time: '22:00', day: -1, by: 'Dr. Sam Ortiz' },
      { id: 'won-o2', cat: 'Diet', text: 'Advance diet as tolerated', time: '22:00', day: -1, by: 'Dr. Sam Ortiz' },
      { id: 'won-o3', cat: 'Activity', text: 'Ambulate in hallway 4 times daily', time: '22:00', day: -1, by: 'Dr. Sam Ortiz' }
    ],
    meds: [
      { id: 'won-apap', name: 'Acetaminophen', dose: '1,000 mg', route: 'PO', freq: 'Every 6 hours PRN', type: 'prn', indication: 'Pain', ordered: { time: '22:00', day: -1 } }
    ],
    vitals: [{ time: '06:00', temp: 98.8, tempRoute: 'Oral', hr: 78, rr: 16, sbp: 122, dbp: 74, spo2: 99, o2: 'Room air', pain: 3, by: 'Night shift RN' }],
    labs: [], imaging: [], notes: [], documents: [], io: [], events: []
  },
  {
    id: 'orient-bulldog',
    level: 3,
    experiences: ['orient'],
    name: { first: 'Jerry', last: 'Barkley' },
    mrn: 'ORIENT-003',
    dob: '1954-04-02',
    age: '72 years',
    sex: 'M',
    unit: 'Medical-Surgical Unit',
    room: '101-3',
    service: 'Medicine',
    attending: 'Dr. Avery Lee',
    admitted: { time: '14:00', day: -1 },
    scenarioStart: '09:00',
    admitDx: 'COPD exacerbation',
    codeStatus: 'DNR',
    isolation: 'Standard',
    nkda: false,
    allergies: [{ agent: 'Penicillin', reaction: 'Hives', severity: 'Moderate', tags: ['penicillin'] }],
    heightCm: 175,
    weightKg: 70,
    flags: ['Practice patient — not your assigned patient', 'DNR'],
    assessmentForms: ['wdl-adult', 'pain'],
    hpi: '72-year-old with COPD admitted yesterday with increased shortness of breath and cough. Improving on nebulizer treatments and oral prednisone; SpO₂ 91% on 2 L nasal cannula.',
    pmh: ['COPD', 'Hypertension'], psh: [], familyHx: [], socialHx: ['Former smoker, 40 pack-years; quit 5 years ago'], homeMeds: [], ros: [],
    orders: [
      { id: 'bul-o1', cat: 'Admission', text: 'Admit to Medical-Surgical Unit', time: '14:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'bul-o2', cat: 'Code Status', text: 'DNR', time: '14:00', day: -1, by: 'Dr. Avery Lee' },
      { id: 'bul-o3', cat: 'Respiratory', text: 'Oxygen per nasal cannula; titrate to keep SpO₂ 88–92%', time: '14:00', day: -1, by: 'Dr. Avery Lee' }
    ],
    meds: [
      { id: 'bul-pred', name: 'Prednisone', dose: '40 mg', route: 'PO', freq: 'Daily', type: 'scheduled', ordered: { time: '14:00', day: -1 }, fixedTimes: true, doses: [{ at: 0 }, { at: 1440 }] }
    ],
    vitals: [{ time: '06:00', temp: 98.2, tempRoute: 'Oral', hr: 92, rr: 22, sbp: 138, dbp: 82, spo2: 91, o2: 'Nasal cannula', o2Flow: 2, by: 'Night shift RN' }],
    labs: [], imaging: [], notes: [], documents: [], io: [], events: []
  },
  {
    id: 'practice-l0',
    level: 0,
    experiences: ['orient-l0'],
    name: { first: 'Jane', last: 'Fowler' },
    mrn: 'ORIENT-L0',
    dob: '1948-01-28',
    age: '78 years',
    sex: 'F',
    unit: 'Medical-Surgical Unit',
    room: '102-1',
    service: 'Medicine',
    attending: 'Dr. Avery Lee',
    admitted: { time: '07:00' },
    scenarioStart: '08:00',
    admitDx: 'Pneumonia',
    codeStatus: 'Full Code',
    isolation: 'Standard',
    nkda: true,
    allergies: [],
    heightCm: null,
    weightKg: null,
    flags: ['Practice patient', 'Fall Risk'],
    assessmentForms: ['wdl-adult', 'pain', 'morse', 'braden', 'incident-report'],
    // Level 0 orientation: the three items students document come first on the Worklist.
    worklistFirst: ['vitals', 'form:wdl-adult', 'form:incident-report'],
    emergencyContact: 'Daughter — phone on file',
    demographics: { 'Lives': 'Alone', 'Primary language': 'English' },
    hpi: '78-year-old admitted from home this morning with pneumonia. Normally alert and oriented; functions well and lives alone. Her daughter reports new confusion and restlessness. Initial findings: temperature 101.6 °F, respiratory rate 30/min, SpO₂ 88% on 3 L oxygen, coarse breath sounds bilaterally, and blood pressure 145/92.',
    pmh: [],
    psh: [],
    familyHx: [],
    socialHx: ['Lives alone; daughter nearby'],
    homeMeds: [],
    ros: [
      ['General', 'Confused and restless (new for her, per daughter)'],
      ['Respiratory', 'Coarse breath sounds bilaterally; SpO₂ 88% on 3 L']
    ],
    orders: [
      { id: 'prac-l0-o1', cat: 'Admission', text: 'Admit to Medical-Surgical Unit — pneumonia', time: '07:00', by: 'Dr. Avery Lee' },
      { id: 'prac-l0-o2', cat: 'Code Status', text: 'Full Code', time: '07:00', by: 'Dr. Avery Lee' },
      { id: 'prac-l0-o3', cat: 'Nursing', text: 'Vital signs every 4 hours and as needed', time: '07:00', by: 'Dr. Avery Lee' },
      { id: 'prac-l0-o4', cat: 'Respiratory', text: 'Oxygen per nasal cannula; titrate to keep SpO₂ 92% or greater', time: '07:00', by: 'Dr. Avery Lee' },
      { id: 'prac-l0-o5', cat: 'Activity', text: 'Up with assistance; fall precautions', time: '07:00', by: 'Dr. Avery Lee' },
      { id: 'prac-l0-o-new', cat: 'IV Fluids', text: 'Normal saline (0.9% sodium chloride) 1,000 mL IV at 100 mL/hr, continuous', at: -10, by: 'Dr. Avery Lee', isNew: true }
    ],
    meds: [
      { id: 'prac-l0-ns', name: 'Normal saline', dose: '100 mL/hr', route: 'IV infusion', freq: 'Continuous — 1,000 mL at 100 mL/hr', type: 'continuous', rate: '100 mL/hr', ordered: { at: -10 } }
    ],
    vitals: [
      { time: '07:15', temp: 101.6, tempRoute: 'Oral', rr: 30, sbp: 145, dbp: 92, spo2: 88, o2: 'Nasal cannula', o2Flow: 3, note: 'Admission', by: 'Admitting RN' }
    ],
    labs: [],
    imaging: [],
    notes: [],
    documents: [],
    io: [],
    events: []
  }
];
