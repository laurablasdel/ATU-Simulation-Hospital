/*
 * Newborn documentation for the Sung scenario (Nurse/Allied Health → Newborn), on BOTH Amelia Sung's and
 * Baby Boy Sung's charts. Everything saves to Baby Boy Sung's record (p.newborn.chart), so both charts
 * show the same documentation; Amelia's own maternal assessments stay on her Assessments tab.
 * The forms open only after faculty release "Delivery completed" (p.newborn.deliveryEvent on Amelia).
 *
 *   Newborn Head-to-Toe Assessment — structure follows Stanford Medicine Newborn Nursery, "The Newborn
 *     Exam" (med.stanford.edu/newborns). Nothing is pre-marked normal: every choice starts blank.
 *   Newborn Transitional Record — hospital-record layout: maternal history, delivery, infant,
 *     measurements, feeding, abnormal findings, medication references (from the MAR), and a vital-signs
 *     table with one saved row per entry.
 * Saved entries are ordinary assessment entries (author, date/time, entered-in-error), so they appear in
 * Assessment History and sync like other charting.
 */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};

  /* ---------- form definitions ---------- */
  const S = (id, label, options) => ({ id, label, type: 'select', options });
  const C = (id, label, options) => ({ id, label, type: 'checks', options });
  const T = (id, label) => ({ id, label, type: 'text' });
  const A = (id, label) => ({ id, label, type: 'textarea' });
  const N = (id, label) => ({ id, label, type: 'number' });
  const ARM = ['Moves spontaneously, full range', 'Decreased movement', 'No spontaneous movement', 'Not assessed'];
  const CLAV = ['Intact — no crepitus or swelling', 'Crepitus', 'Swelling / deformity', 'Tenderness (cries with palpation)', 'Not assessed'];

  // Version 1 (before November 2, 2026): kept so entries saved with it display exactly as saved.
  const H2T_V1 = {
    title: 'Newborn Head-to-Toe Assessment',
    newborn: true,
    intro: 'Structure follows Stanford Medicine Newborn Nursery, "The Newborn Exam." Document what you assess; nothing is pre-marked normal.',
    sections: [
      { id: 'gen', title: 'General Appearance', fields: [
        S('appear', 'General appearance', ['Well-appearing', 'Ill-appearing', 'Dysmorphic features noted']),
        S('alert', 'Alertness / state', ['Quiet alert', 'Active alert', 'Drowsy', 'Lethargic', 'Difficult to arouse']),
        S('activity', 'Activity', ['Active, spontaneous movement', 'Decreased activity', 'Jittery / tremulous', 'Irritable']),
        S('cry', 'Cry', ['Strong, vigorous', 'Weak', 'High-pitched', 'Absent']),
        S('tone', 'Tone', ['Flexed, normal tone', 'Hypotonic / floppy', 'Hypertonic', 'Asymmetric tone']),
        T('genNote', 'Comments')] },
      { id: 'head', title: 'Head, Molding, Sutures, and Fontanelles', fields: [
        S('shape', 'Head shape / molding', ['No molding', 'Mild molding', 'Moderate molding', 'Severe molding']),
        C('scalp', 'Scalp findings', ['Caput succedaneum', 'Cephalohematoma', 'Vacuum (chignon) mark', 'Abrasion / laceration', 'Bruising', 'None']),
        S('sutures', 'Sutures', ['Approximated', 'Overriding', 'Widely separated']),
        S('af', 'Anterior fontanelle', ['Soft and flat', 'Bulging', 'Sunken', 'Full']),
        S('pf', 'Posterior fontanelle', ['Open, soft', 'Closed', 'Bulging']),
        N('hc', 'Head circumference (cm)'), T('headNote', 'Comments')] },
      { id: 'face', title: 'Eyes, Ears, Nose, Mouth, and Palate', fields: [
        S('eyes', 'Eyes', ['Symmetric, clear', 'Edematous lids', 'Discharge', 'Subconjunctival hemorrhage']),
        S('redReflex', 'Red reflex', ['Present bilaterally', 'Absent / abnormal right', 'Absent / abnormal left', 'Not assessed']),
        S('ears', 'Ears', ['Well-formed, normally set', 'Low-set / posteriorly rotated', 'Preauricular pit or tag']),
        S('nose', 'Nose', ['Patent bilaterally', 'Nasal flaring', 'Discharge / congestion']),
        S('mouth', 'Mouth', ['Moist, pink', 'Epstein pearls', 'Natal tooth', 'Excessive secretions']),
        S('palate', 'Palate', ['Hard and soft palate intact', 'Cleft palate', 'Cleft lip', 'Not assessed']),
        S('suck', 'Suck', ['Strong', 'Weak', 'Absent']), T('faceNote', 'Comments')] },
      { id: 'neck', title: 'Neck and Clavicles', fields: [
        S('neck', 'Neck', ['Supple, full range of motion', 'Webbing', 'Mass', 'Torticollis']),
        S('clavR', 'Right clavicle', CLAV), S('clavL', 'Left clavicle', CLAV), T('neckNote', 'Comments')] },
      { id: 'resp', title: 'Respiratory Effort and Breath Sounds', fields: [
        S('effort', 'Respiratory effort', ['Unlabored', 'Tachypnea', 'Retractions', 'Grunting', 'Nasal flaring', 'Apnea / gasping']),
        S('bsR', 'Breath sounds — right', ['Clear', 'Crackles', 'Diminished', 'Wheezes']),
        S('bsL', 'Breath sounds — left', ['Clear', 'Crackles', 'Diminished', 'Wheezes']),
        S('chest', 'Chest', ['Symmetric expansion', 'Asymmetric expansion']), T('respNote', 'Comments')] },
      { id: 'cv', title: 'Heart Sounds, Pulses, Perfusion, and Skin Color', fields: [
        S('heart', 'Heart sounds', ['Regular rate and rhythm, no murmur', 'Murmur', 'Irregular rhythm', 'Muffled / displaced']),
        S('femoral', 'Femoral pulses', ['Equal and strong bilaterally', 'Weak / diminished', 'Unequal', 'Absent']),
        S('brachial', 'Brachial pulses', ['Equal and strong bilaterally', 'Weak / diminished', 'Unequal']),
        S('crt', 'Capillary refill', ['Less than 3 seconds', '3 seconds or more']),
        S('color', 'Skin color', ['Pink', 'Acrocyanosis (hands/feet)', 'Central cyanosis', 'Pale', 'Plethoric', 'Jaundiced']),
        T('cvNote', 'Comments')] },
      { id: 'abd', title: 'Abdomen and Umbilical Cord', fields: [
        S('abd', 'Abdomen', ['Soft, round, nondistended', 'Distended', 'Scaphoid', 'Mass palpated']),
        S('bowel', 'Bowel sounds', ['Present', 'Hypoactive', 'Absent']),
        S('cord', 'Umbilical cord', ['3 vessels, clamp secure', '2 vessels', 'Bleeding / oozing', 'Drainage / redness']),
        T('abdNote', 'Comments')] },
      { id: 'gu', title: 'Genitalia, Urinary Output, and Stool', fields: [
        S('genit', 'Genitalia', ['Male: testes descended bilaterally', 'Male: undescended testis', 'Hypospadias / epispadias', 'Hydrocele', 'Female: normal', 'Ambiguous']),
        S('anus', 'Anus', ['Patent', 'Not patent / not visualized']),
        S('void', 'Urinary output', ['Voided', 'Not yet voided']), T('voidTime', 'Void time / amount'),
        S('stool', 'Stool', ['Meconium passed', 'No stool yet']), T('stoolTime', 'Stool time / description')] },
      { id: 'skin', title: 'Skin Findings', fields: [
        C('skin', 'Findings', ['Vernix', 'Lanugo', 'Milia', 'Erythema toxicum', 'Congenital dermal melanocytosis', 'Peeling / cracking', 'Bruising', 'Petechiae', 'Jaundice', 'Birthmark', 'None noted']),
        T('skinLoc', 'Location / description')] },
      { id: 'msk', title: 'Spine, Extremities, and Movement Symmetry', fields: [
        S('spine', 'Spine', ['Straight and intact', 'Sacral dimple', 'Hair tuft / mass', 'Opening / defect']),
        S('hips', 'Hips (Ortolani / Barlow)', ['Stable, negative', 'Clunk / positive', 'Not assessed']),
        S('armR', 'Right arm movement', ARM), S('armL', 'Left arm movement', ARM),
        S('legs', 'Leg movement', ['Symmetric, full range', 'Decreased right', 'Decreased left']),
        S('symm', 'Movement symmetry', ['Symmetric', 'Asymmetric — upper extremities', 'Asymmetric — lower extremities']),
        S('digits', 'Digits', ['10 fingers, 10 toes', 'Polydactyly', 'Syndactyly']), T('mskNote', 'Comments')] },
      { id: 'reflex', title: 'Newborn Reflexes', fields: [
        S('moro', 'Moro', ['Present, symmetric', 'Asymmetric — decreased right', 'Asymmetric — decreased left', 'Absent']),
        S('root', 'Rooting', ['Present', 'Weak', 'Absent']),
        S('suckRef', 'Sucking', ['Present', 'Weak', 'Absent']),
        S('graspR', 'Palmar grasp — right', ['Present', 'Weak', 'Absent']),
        S('graspL', 'Palmar grasp — left', ['Present', 'Weak', 'Absent']),
        S('plantar', 'Plantar grasp', ['Present', 'Absent']),
        S('babinski', 'Babinski', ['Present (fanning)', 'Absent']),
        S('step', 'Stepping', ['Present', 'Absent', 'Not assessed'])] },
      { id: 'feed', title: 'Feeding Assessment and Tolerance', fields: [
        S('method', 'Feeding method', ['Breastfeeding', 'Bottle — formula', 'Bottle — expressed breast milk', 'Not yet fed']),
        S('latch', 'Latch / suck', ['Good latch, sustained suck', 'Fair', 'Poor latch', 'Not observed']),
        S('coord', 'Suck–swallow–breathe coordination', ['Coordinated', 'Uncoordinated']),
        S('tol', 'Tolerance', ['Tolerating well', 'Spitting up', 'Vomiting', 'Not yet fed']),
        N('feedMin', 'Duration (minutes) or volume (mL)'), T('glucose', 'Blood glucose (mg/dL) and time')] },
      { id: 'abn', title: 'Abnormal Findings, Interventions, and Provider Notification', fields: [
        A('abnFind', 'Abnormal findings'), A('abnInt', 'Interventions'),
        S('notified', 'Provider notified', ['Yes', 'No']), T('notifyWho', 'Provider name / time'), T('notifyResp', 'Provider response / orders')] }
    ]
  };

  // Newborn Transitional Record — follows the hospital paper form (sections, field order, circle choices, and the
  // vital-signs grid). Field: [id, label, choices?] — choices are circled on paper (one per field).
  // "confirmed" values come from p.newborn.confirmed (scenario facts; shown, not editable). Handwritten examples on
  // the paper form are NOT used; blanks stay blank for the student.
  const YN = ['Yes', 'No'], PM = ['+', '−'], TX = ['Y', 'N'];
  const TR = [
    { id: 'maternal', title: 'Maternal History', cols: [
      [[['gbs', 'GBS', ['Pos', 'Neg']], ['abx', 'Antibiotic'], ['abxTimes', 'Times']],
        [['rubella', 'Rubella', ['Immune', 'NonImmune', 'Equivocal']]],
        [['chlam', 'Chlamydia history', YN], ['chlamTx', 'Treated', TX]],
        [['herpes', 'Herpes history', YN], ['herpesTx', 'Treated', TX]],
        [['gon', 'Gonorrhea history', YN], ['gonTx', 'Treated', TX]],
        [['diab', 'Diabetes history', YN], ['diabCtl', 'Controlled', ['Diet', 'Insulin']]],
        [['pih', 'PIH history', YN], ['mag', 'Magnesium', TX]],
        [['smoker', 'Smoker', YN], ['cigs', 'Cigs / day']],
        [['drugs', 'Illegal drug use', YN], ['substance', 'Substance']],
        [['urine', 'If yes, urine collected'], ['cordCol', 'Cord collected']]],
      [[['hepb', 'Hep B', PM]], [['vdrl', 'VDRL', PM]], [['hiv', 'HIV', PM]],
        [['gravida', 'Gravida'], ['para', 'Para']], [['edc', 'EDC']], [['bloodType', 'Blood type']],
        [['romDate', 'Rupture of membranes: date'], ['romTime', 'Time']],
        [['anes', 'Anesthesia', ['Epidural', 'Spinal', 'General']]],
        [['feedPref', 'Feeding preference', ['Breast', 'Bottle', 'Both']]],
        [['mOther', 'Other', null, true]]]] },
    { id: 'infant', title: 'Infant', rows: [
      [['band', 'Band #'], ['obMd', 'Physician: OB'], ['ped', 'Ped']],
      [['dob', 'Date of birth'], ['tob', 'Time'], ['sex', 'Sex', ['Male', 'Female']], ['present', 'Presentation', ['Ceph', 'Breech']], ['apgar1', 'Apgar 1 min'], ['apgar5', '5 min'], ['apgar10', '10 min']],
      [['delivery', 'Delivery', ['Vaginal', 'C-Section']], ['csReason', 'C/S reason'], ['mec', 'Meconium del', YN], ['useOf', 'Use of', ['Forceps', 'Vac', 'N/A']], ['output', 'Output', ['Void', 'Stool', 'Both', 'None']], ['delee', 'DeLee (mL)']],
      [['cordSent', 'Cord blood: sent'], ['cordTime', 'Time'], ['cordOrd', 'Ordered'], ['labTime', 'Lab: time'], ['hct', 'Hct'], ['hgb', 'Hgb'], ['gluc', 'Gluc']],
      [['gestDates', 'Gest age by: dates'], ['gestExam', 'Exam'], ['size', 'Size', ['AGA', 'LGA', 'SGA']], ['bath', 'Bath']],
      [['wtG', 'Weight (gms)'], ['wtLb', 'lb'], ['wtOz', 'oz'], ['lenCm', 'Length (cm)'], ['lenIn', 'in'], ['hcCm', 'Head circ (cm)'], ['hcIn', 'in'],
        ['ccCm', 'Chest circ (cm)'], ['ccIn', 'in'], ['acCm', 'Abd circ (cm)'], ['acIn', 'in'], ['secTag', 'Security tag']]] },
    { id: 'meds', title: 'Medications (from the approved orders; time and site come from the MAR)', rows: [
      [['eryDecl', 'Erythromycin declined', YN], ['vitkDecl', 'Vitamin K declined', YN], ['hepbConsent', 'Hep B consent signed', YN], ['hepbLot', 'Hep B lot #'], ['hepbDecl', 'Hep B declined', YN]]] },
    { id: 'findings', title: 'Abnormal Findings and Feeding', rows: [
      [['abn', 'Abnormal findings', null, true]],
      [['breastR', 'Feeding: breast R (min)'], ['breastL', 'L (min)'], ['bottle', 'Bottle (mL)']]] }
  ];
  const SEC_OF = {};   // field id -> section id (saved values are "section.field", like other forms)
  TR.forEach(s => (s.cols ? s.cols.flat() : s.rows).forEach(r => r.forEach(f => { SEC_OF[f[0]] = s.id; })));
  const TR_FORM = { title: 'Newborn Transitional Record', newborn: true, sections: TR.map(s => ({ id: s.id, title: s.title,
    fields: (s.cols ? s.cols.flat() : s.rows).flat().map(([id, label, , area]) => ({ id, label, type: area ? 'textarea' : 'text' })) })) };
  // Vital signs grid: one column per saved entry, rows as on the paper form.
  const VS_COLS = [['temp', 'Axillary Temp'], ['hr', 'Heart Rate'], ['rr', 'Resp Rate'], ['spo2', 'O2 Sats'], ['bpArm', 'BP R Arm'], ['bpLeg', 'BP R Leg'], ['distress', 'S/S Distress'], ['other', 'Other'], ['initials', 'Initials']];
  const VS_FORM = { title: 'Transitional Record — Vital Signs', newborn: true, sections: [{ id: 'vs', title: 'Vital signs', fields: VS_COLS.map(([id, label]) => ({ id, label, type: 'text' })) }],
    summary: d => VS_COLS.slice(0, 6).map(([k, l]) => d.values['vs.' + k] ? `${l.replace(/ \(.*\)/, '')} ${d.values['vs.' + k]}` : '').filter(Boolean).join(' · ') || 'Vital signs row' };
  // Score field: options [[label, points], ...].
  const SC = (id, label, options) => ({ id, label, type: 'score', options });

  // APGAR — one entry per scoring time (1 and 5 minutes; every 5 minutes up to 20 if the 5-minute score is below 7).
  const APGAR_MIN = ['1 minute', '5 minutes', '10 minutes', '15 minutes', '20 minutes'];
  const APGAR = {
    title: 'APGAR Score', newborn: true, scored: 'apgar',
    intro: 'Document one APGAR score for each scoring time. Score 1 and 5 minutes; if the 5-minute score is below 7, continue every 5 minutes up to 20 minutes.',
    sections: [
      { id: 'ap', title: 'Scoring time', fields: [{ id: 'minute', label: 'Minutes after birth', type: 'select', options: APGAR_MIN, required: true }] },
      { id: 'sc', title: 'APGAR', fields: [
        SC('hr', 'Heart rate', [['Absent', 0], ['Below 100 bpm', 1], ['100 bpm or above', 2]]),
        SC('resp', 'Respiratory effort', [['Absent', 0], ['Slow, weak, irregular, or gasping', 1], ['Good, crying', 2]]),
        SC('tone', 'Muscle tone', [['Limp', 0], ['Some flexion of extremities', 1], ['Active motion, well flexed', 2]]),
        SC('reflex', 'Reflex irritability (response to stimulation)', [['No response', 0], ['Grimace', 1], ['Cry, cough, sneeze, or active withdrawal', 2]]),
        SC('color', 'Color', [['Blue or pale all over', 0], ['Body pink, extremities blue', 1], ['Completely pink', 2]])] },
      { id: 'rs', title: 'Resuscitation at the time of scoring', fields: [
        C('resus', 'Interventions in progress', ['None', 'Oxygen', 'PPV', 'CPAP', 'Intubation', 'Chest compressions', 'Medications']),
        T('apNote', 'Comments')] }
    ],
    summary: d => `${d.values['ap.minute'] || ''} — APGAR ${d.total} (${d.interp})`
  };

  // ATU Newborn Delivery Assessment (source: ATU_Newborn_Ballard_Detailed_AUTOCALC.pdf, page 1). APGAR, measurements, and
  // vital signs from that page are documented once, in the APGAR assessment and the Transitional Record.
  const DELIVERY = {
    title: 'Newborn Delivery Assessment', newborn: true,
    intro: 'ATU Newborn Delivery Assessment. APGAR scores → APGAR Score; measurements and vital signs → Newborn Transitional Record; gestational age exam → New Ballard Score.',
    sections: [
      { id: 'del', title: 'Delivery Details', fields: [
        S('type', 'Delivery type', ['Vaginal — spontaneous', 'Vaginal — vacuum assisted', 'Vaginal — forceps assisted', 'Cesarean']),
        T('tob', 'Time of birth'), T('ga', 'Gestational age'), T('rom', 'ROM time'),
        S('gbs', 'GBS', ['Positive', 'Negative', 'Unknown']),
        S('fluid', 'Amniotic fluid', ['Clear', 'Meconium-stained', 'Bloody', 'Foul-smelling', 'Not observed']),
        A('comp', 'Complications')] },
      { id: 'res', title: 'Resuscitation / Immediate Interventions', fields: [
        C('int', 'Interventions', ['Dry', 'Stimulate', 'Suction', 'Oxygen', 'PPV', 'CPAP', 'Intubation', 'Compressions', 'Narcan', 'Other', 'None']),
        T('time', 'Time initiated'), T('resp', 'Response'), T('ind', 'Indication'), A('outcome', 'Response / outcome')] },
      { id: 'suc', title: 'Suction Details', fields: [
        S('type', 'Type', ['Bulb syringe', 'DeLee / mechanical suction', 'Not performed']),
        T('amt', 'Amount suctioned'), T('color', 'Color / consistency'), N('passes', 'Number of passes'), T('time', 'Time suctioned'), T('notes', 'Additional notes')] },
      { id: 'inj', title: 'Birth Injury / Clavicle Assessment', fields: [
        C('find', 'Findings present', ['Clavicle', 'Brachial plexus', 'Asymmetrical Moro', 'Facial nerve', 'Cephalohematoma', 'Caput succedaneum', 'Crepitus', 'Decreased arm movement', 'Fracture suspected', 'None identified']),
        A('desc', 'Findings')] },
      { id: 'notes', title: 'Notes', fields: [A('notes', 'Notes')] }
    ]
  };

  // New Ballard Score (source PDF page 2: items and score anchors). Estimated gestational age uses the New Ballard
  // maturity rating: weeks = (2 × total + 120) ÷ 5  (−10 = 20 weeks, 0 = 24, 20 = 32, 40 = 40, 50 = 44).
  const pts = list => list.map(([s, t]) => [`${t}`, s]);
  const BALLARD = {
    title: 'New Ballard Score', newborn: true, scored: 'ballard',
    intro: 'Score each item from your exam. The total and estimated gestational age calculate automatically.',
    sections: [
      { id: 'nm', title: 'Neuromuscular Maturity', fields: [
        SC('posture', 'Posture', pts([[0, 'Extended / limp'], [1, 'Slight flexion'], [2, 'Moderate flexion'], [3, 'Well flexed']])),
        SC('square', 'Square window (wrist)', pts([[0, '90°'], [1, '60°'], [2, '45°'], [3, '30°'], [4, '0°']])),
        SC('recoil', 'Arm recoil', pts([[0, 'None'], [1, 'Slight flexion'], [2, 'Slow return'], [3, 'Brisk flexion'], [4, 'Full recoil']])),
        SC('popliteal', 'Popliteal angle', pts([[0, '180°'], [1, '160°'], [2, '140°'], [3, '120°'], [4, '90°']])),
        SC('scarf', 'Scarf sign', pts([[0, 'Elbow crosses midline easily'], [1, 'At midline'], [2, 'Slightly past midline'], [3, 'Before midline'], [4, 'Cannot reach midline']])),
        SC('heel', 'Heel to ear', pts([[0, 'Heel to ear easily'], [1, 'Near ear'], [2, 'Moderate resistance'], [3, 'Marked resistance'], [4, 'Rigid']]))] },
      { id: 'pm', title: 'Physical Maturity', fields: [
        SC('skin', 'Skin', pts([[-1, 'Sticky / friable / transparent'], [0, 'Gelatinous / red'], [1, 'Smooth pink / visible veins'], [2, 'Superficial peeling / rash'], [3, 'Cracking / pale areas'], [4, 'Parchment / deep cracking']])),
        SC('lanugo', 'Lanugo', pts([[-1, 'None'], [0, 'Sparse'], [1, 'Abundant'], [2, 'Thinning'], [3, 'Mostly bald']])),
        SC('plantar', 'Plantar surface', pts([[-2, 'Heel-toe less than 40 mm'], [-1, 'Faint red marks'], [0, 'Anterior transverse crease only'], [1, 'Creases anterior 2/3'], [2, 'Creases over entire sole']])),
        SC('breast', 'Breast', pts([[-1, 'Imperceptible'], [0, 'Barely perceptible areola'], [1, 'Flat areola, no bud'], [2, 'Stippled areola, 1–2 mm bud'], [3, 'Full areola, 5–10 mm bud']])),
        SC('eye', 'Eye / ear', pts([[-1, 'Lids fused'], [0, 'Lids open, pinna flat'], [1, 'Slightly curved pinna'], [2, 'Well-curved pinna, soft but ready recoil'], [3, 'Formed and firm, instant recoil']])),
        SC('genitals', 'Genitals', pts([[-1, 'Male: scrotum flat, smooth · Female: clitoris prominent, labia flat'], [0, 'Male: scrotum empty, faint rugae · Female: clitoris prominent, small labia minora'],
          [1, 'Male: testes in upper canal, rare rugae · Female: clitoris prominent, enlarging minora'], [2, 'Male: testes descending, few rugae · Female: majora and minora equally prominent'],
          [3, 'Male: testes down, good rugae · Female: majora large, minora small'], [4, 'Male: testes pendulous, deep rugae · Female: majora cover clitoris and minora']]))] },
      { id: 'note', title: 'Clinical note', fields: [T('note', 'Clinical note')] }
    ],
    summary: d => `Ballard total ${d.total} — ${d.interp}`
  };

  // Newborn Glucose Monitoring — the source glucose monitoring sheet as a charted assessment (one entry per check).
  // Example values written on the source sheet are not used. Glucose gel doses are documented on the MAR.
  const GLUCOSE = {
    title: 'Newborn Glucose Monitoring', newborn: true,
    intro: 'Follow the Newborn Glucose Management order set (Orders → P for the full policy). Document each check; document glucose gel on the MAR.',
    sections: [
      { id: 'chk', title: 'Glucose Check', fields: [
        S('type', 'Check', ['Initial screen (within 30 minutes after feeding)', 'Before feed', 'Recheck 1 hour after glucose gel', 'Symptomatic check', 'Recheck after IV dextrose']),
        { id: 'bg', label: 'Blood glucose (mg/dL)', type: 'number', required: true },
        S('method', 'Collection method', ['Heel stick — point of care', 'Serum glucose — venipuncture (lab)']),
        S('feed', 'Feeding', ['Breastfed', 'Bottle-fed', 'Not yet fed']), T('feedTime', 'Time of last feed')] },
      { id: 'risk', title: 'Reason for Screening', fields: [
        C('risk', 'Check all that apply', ['SGA', 'LGA', 'IUGR / FGR', 'Late preterm (34–36 weeks)', 'Mother with GDM / diabetes', 'Signs or symptoms of hypoglycemia', 'None'])] },
      { id: 'sym', title: 'Symptoms', fields: [
        C('sym', 'Check all that apply', ['None', 'Tremors / jitteriness', 'Irritability / high-pitched cry', 'Poor suck / poor feeding', 'Lethargy / hypotonia', 'Apnea / cyanosis / irregular respirations', 'Temperature instability', 'Seizure', 'Other']),
        T('symTime', 'Date/time symptoms noted'), T('symOther', 'Other')] },
      { id: 'tx', title: 'Treatment and Follow-up', fields: [
        S('gel', 'Glucose gel given (document dose on the MAR)', ['No', 'Yes — dose #1', 'Yes — dose #2', 'Yes — dose #3']),
        S('refed', 'Refed', ['Yes', 'No']), T('recheck', 'Recheck due (time)'),
        S('notified', 'Pediatrician notified', ['Yes', 'No']), T('orders', 'Provider orders received'),
        S('iv', 'IV glucose started', ['Yes', 'No']), T('ivTime', 'Date/time IV started'),
        A('response', 'Newborn response'), T('initials', 'Nurse initials')] }
    ],
    summary: d => [d.values['chk.bg'] != null && d.values['chk.bg'] !== '' ? `BG ${d.values['chk.bg']} mg/dL` : '', d.values['chk.type'] || ''].filter(Boolean).join(' · ') || 'Glucose check'
  };


  /* ---------- Newborn Head-to-Toe Assessment (MEDITECH style), for any newborn (p.newborn: true) ---------- */
  // Every system: defined-limits text and "Within defined limits? Y / N"; N opens the exception fields. Nothing is pre-marked.
  const H = (o, hint) => Object.assign(o, { hint });
  const W = o => Object.assign(o, { wide: true });
  const NOTE = label => ({ id: 'n' + label.length, label, type: 'note' });
  const PAW = ['Present', 'Weak', 'Absent'], PA = ['Present', 'Absent'];
  const vm = (id, label, hint, methods, type) => [T(id + 'Time', label + ' — time'), H(type === 'text' ? T(id, label) : N(id, label), hint), S(id + 'Method', label + ' — method', methods)];
  const COMMENTS = A('comments', 'Exceptions / comments');
  const TERM = { posture: 'Full flexion', square: 'Angle near 0°', recoil: 'Quick, strong recoil', popliteal: '< 90°', scarf: 'Elbow does not reach midline', heel: 'Foot stays far from ear',
    skin: 'Smooth, pink, visible veins', lanugo: 'Sparse or mostly absent', plantar: 'Creases cover entire sole', breast: 'Raised areola, 5–10 mm bud',
    eye: 'Eyes open; well-curved pinna, firm, quick recoil', genitals: 'M: testes down, rugae · F: labia majora cover minora' };
  const EDU = [['feed', 'Feeding (breast / bottle)'], ['cord', 'Cord care'], ['sleep', 'Safe sleep'], ['car', 'Car seat safety'], ['bath', 'Bathing / thermoregulation'], ['circ', 'Circumcision care']];
  const num = v => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
  const H2T = {
    title: 'Newborn Head-to-Toe Assessment', newborn: true, ver: 2, legacy: H2T_V1, scored: 'ballard', scoreOptional: true,
    intro: 'Document what you assess. Nothing is pre-marked. For each system, answer "Within defined limits?" — N opens the exception fields.',
    sections: [
      { id: 'vm', title: 'Vital Signs / Measurements', fields: [
        ...vm('temp', 'Temperature (°F)', '97.7–99.5 °F (36.5–37.5 °C)', ['Axillary', 'Skin probe']),
        ...vm('hr', 'Heart rate (bpm)', '110–160 bpm (to 180 crying)', ['Apical, full 1 min']),
        ...vm('rr', 'Respiratory rate (/min)', '30–60/min at rest', ['Counted full 1 min']),
        ...vm('bp', 'Blood pressure (mm Hg)', '50–75 / 30–45 mm Hg', ['RUE', 'RLE'], 'text'),
        ...vm('wt', 'Weight (g)', '2500–4000 g (5 lb 8 oz – 8 lb 13 oz)', ['Scale']), T('wtLbOz', 'Weight (lb / oz)'),
        ...vm('len', 'Length (cm)', '46–56 cm (18–22 in)', ['Tape']),
        ...vm('hc', 'Head circumference (cm)', '32–37 cm (12.5–14.5 in)', ['Tape']),
        ...vm('cc', 'Chest circumference (cm)', '30–35 cm (12–14 in)', ['Tape']),
        S('bwClass', 'Birth weight classification', ['Normal (≥2500 g)', 'LBW (<2500 g)', 'VLBW (<1500 g)', 'ELBW (<1000 g)']),
        W(C('warmth', 'Warmth measures (choose all that apply)', ['Skin-to-skin', 'Radiant warmer with temp probe', 'Hat', 'Swaddled', 'Pre-warmed scale/surfaces']))] },
      { id: 'neuro', title: 'Neurological / Behavioral', dl: 'Flexed posture, good tone, strong cry. Behavior fits the period of reactivity (birth–2 hr alert; 30–120 min sleepy; 2–8 hr awake, interested in stimuli). Anterior fontanelle soft and flat.', fields: [
        S('state', 'Behavioral state', ['Quiet alert', 'Active alert', 'Crying', 'Drowsy', 'Sleeping']),
        S('period', 'Period of reactivity', ['1st (birth–2 hr)', 'Decreased responsiveness (30–120 min)', '2nd (2–8 hr)']),
        S('tone', 'Tone / posture', ['Flexed', 'Hypotonic', 'Flaccid', 'Hypertonic']), S('cry', 'Cry', ['Strong', 'Weak', 'High-pitched']), COMMENTS] },
      { id: 'integ', title: 'Integumentary', dl: 'Body pink; acrocyanosis of hands and feet only in first 2–6 hr (up to 24 hr) without respiratory distress. Benign variations may be present: vernix, lanugo, milia, erythema toxicum, stork bite, Mongolian spots, harlequin sign.', fields: [
        S('color', 'Color', ['Pink', 'Acrocyanosis', 'Central cyanosis', 'Pale', 'Mottled', 'Jaundiced']),
        S('texture', 'Texture', ['Smooth, visible veins', 'Peeling or cracking', 'Transparent or friable']),
        W(C('variations', 'Variations present (choose all that apply)', ['Vernix caseosa', 'Lanugo', 'Milia', 'Erythema toxicum', 'Stork bite', 'Mongolian spots', 'Harlequin sign', 'Port-wine stain'])),
        T('marks', 'Location / size of marks'), COMMENTS] },
      { id: 'heent', title: 'HEENT', dl: 'Head ~2 cm larger than chest. Fontanelles soft and flat: anterior diamond-shaped, posterior triangular and smaller. Sutures open or slightly overriding; molding may be present. Face, eyes and ears symmetrical; no eye discharge; ears well-curved with firm cartilage. Nares patent. Lip and palate intact.', fields: [
        S('head', 'Head shape', ['Symmetrical', 'Molding', 'Caput succedaneum', 'Cephalohematoma L', 'Cephalohematoma R']),
        S('af', 'Anterior fontanelle', ['Soft/flat', 'Sunken', 'Bulging']), S('pf', 'Posterior fontanelle', ['Soft/flat', 'Sunken', 'Bulging']),
        S('sutures', 'Sutures', ['Open', 'Overriding', 'Fused']), S('face', 'Face', ['Symmetrical', 'Asymmetrical']),
        S('eyes', 'Eyes', ['Clear', 'Not clear']), C('eyesWith', 'Eyes — with (choose all)', ['Discharge', 'Redness', 'Swelling']),
        S('ears', 'Ears', ['Normal placement, firm cartilage', 'Low-set', 'Malformed']), S('nares', 'Nares', ['Patent bilaterally', 'Obstructed']),
        S('mouth', 'Mouth / palate', ['Intact', 'Not intact']), C('mouthWith', 'Mouth / palate — with (choose all)', ['Cleft lip', 'Cleft palate', 'Epstein pearls']), COMMENTS] },
      { id: 'resp', title: 'Respiratory', dl: 'RR 30–60/min at rest; unlabored; lungs clear bilaterally. No nasal flaring, retractions or grunting. Chest round and symmetrical.', fields: [
        S('bs', 'Breath sounds', ['Clear bilat', 'Crackles', 'Diminished', 'Other']), T('bsOther', 'Breath sounds — other'),
        S('effort', 'Respiratory effort', ['Unlabored', 'Labored']),
        W(C('distress', 'Signs of distress (choose all that apply)', ['None', 'Nasal flaring', 'Retractions', 'Grunting', 'Tachypnea', 'Central cyanosis'])),
        S('chest', 'Chest', ['Round, symmetrical', 'Not round / asymmetrical']), C('chestWith', 'Chest — with (choose all)', ['Engorged nipples / white discharge', 'Extra nipples']), COMMENTS] },
      { id: 'cv', title: 'Cardiovascular', dl: 'Apical HR 110–160 bpm, regular rhythm. Body pink; acrocyanosis only as defined under Integumentary.', fields: [
        S('rhythm', 'Rhythm', ['Regular', 'Irregular']), S('murmur', 'Murmur', ['None heard', 'Present']), COMMENTS] },
      { id: 'gi', title: 'Gastrointestinal', dl: 'Abdomen soft, not distended or hard; bowel sounds present in all 4 quadrants. Cord has 3 vessels (2 arteries, 1 vein), with no bleeding, drainage or erythema. Anus in normal position and patent.', fields: [
        S('abd', 'Abdomen', ['Soft', 'Distended', 'Firm']), S('bowel', 'Bowel sounds', ['Present x4 quadrants', 'Hypoactive', 'Absent']),
        S('vessels', 'Umbilical cord vessels', ['3 (AVA)', '2 vessels']),
        S('cord', 'Cord site', ['Clamp intact, dry', 'Not intact / not dry']), C('cordWith', 'Cord site — with (choose all)', ['Bleeding', 'Drainage', 'Erythema']),
        S('anus', 'Anus', ['Patent', 'Not patent']), S('stool', 'Stool', ['Meconium passed', 'None yet']), T('stoolTime', 'Meconium passed — time'),
        S('feed', 'Feeding method', ['Breast', 'Bottle', 'Both']), T('formula', 'Bottle — formula'), COMMENTS] },
      { id: 'gu', title: 'Genitourinary', dl: 'Male: meatus centered at tip of penis; scrotum has rugae; testes descended, firm and smooth; no edema or discoloration. Female: labia majora cover minora and clitoris; meatus midline; engorgement and pink discharge from maternal hormones are normal.', fields: [
        S('meatus', 'Male — meatus', ['Centered', 'Hypospadias (ventral)', 'Epispadias (dorsal)']), S('testes', 'Male — testes', ['Descended bilat', 'Undescended L', 'Undescended R']),
        S('labia', 'Female — labia / discharge', ['Normal', 'Not normal']), C('labiaWith', 'Female — with (choose all)', ['Engorged', 'Pink / white discharge']),
        S('void', 'Void', ['Voided', 'None yet']), T('voidTime', 'Voided — time'), COMMENTS] },
      { id: 'msk', title: 'Musculoskeletal', dl: 'All extremities move freely and equally; 10 fingers, 10 toes; 3 palmar creases; sole creases cover the entire sole at term. Spine symmetrical; no sacral dimple or tuft of hair.', fields: [
        S('upper', 'Upper extremities', ['Full ROM, equal', 'Not full / unequal']), C('upperWith', 'Upper extremities — with (choose all)', ['Limp arm L', 'Limp arm R']),
        NOTE('Limp arm — check Moro for brachial plexus injury.'),
        S('digits', 'Digits', ['10 fingers / 10 toes', 'Not 10 / 10']), C('digitsWith', 'Digits — with (choose all)', ['Extra digits', 'Webbing']),
        S('palmar', 'Palmar creases', ['3 creases', 'Single crease L', 'Single crease R']), S('lower', 'Lower extremities', ['Full ROM, equal', 'Limited']),
        S('spine', 'Back / spine', ['Symmetrical, intact', 'Not symmetrical / not intact']), C('spineWith', 'Back / spine — with (choose all)', ['Sacral dimple', 'Tuft of hair']),
        A('injury', 'Birth injury: clavicle / brachial plexus / Moro / arm movement findings'), COMMENTS] },
      { id: 'reflex', title: 'Newborn Reflexes', dl: 'All 8 reflexes are present, symmetrical and of normal strength.', dlQ: 'Reflexes within defined limits?', dlOpen: true, fields: [
        H(S('rooting', 'Rooting', PAW), 'Turns toward cheek stroke, opens mouth'), H(S('sucking', 'Sucking', PAW), 'Rhythmic suck on gloved finger'),
        H(S('moro', 'Moro', ['Symmetrical', 'Asymmetrical', 'Absent']), 'Arms extend, hands open, then arms come back in; may cry'),
        H(S('palmarGrasp', 'Palmar grasp', PAW), 'Grasps finger tightly'), H(S('plantarGrasp', 'Plantar grasp', PAW), 'Toes curl down'),
        H(S('babinski', 'Babinski', PA), 'Toes fan, big toe dorsiflexes'), H(S('tonicNeck', 'Tonic neck', PA), 'Arm on the side the face turns to extends; opposite arm flexes'),
        H(S('stepping', 'Stepping', PA), 'Stepping motions when feet touch a surface')] },
      { id: 'ga', title: 'Gestational Age Assessment (Ballard)', note: 'Complete within 2 hours of delivery.', fields: [
        ...BALLARD.sections[0].fields.concat(BALLARD.sections[1].fields).map(f => Object.assign({}, f, { hint: TERM[f.id] })),
        T('gaWeeks', 'Estimated gestational age (weeks)'),
        S('maturity', 'Maturity classification', ['Preterm (<37 wk)', 'Term', 'Post-term (>42 wk)', 'Postmature']),
        S('wfga', 'Weight for gestational age', ['SGA (<10th %ile)', 'AGA (10th–90th)', 'LGA (>90th)'])] },
      { id: 'scr', title: 'Newborn Screenings / Procedures', fields: [
        S('idBands', 'ID bands applied (infant, mother, support person)', ['Yes', 'No']), T('idBandsAt', 'ID bands — date/time'),
        S('footprints', 'Footprints obtained', ['Yes', 'No']), T('footprintsAt', 'Footprints — date/time'),
        S('golden', 'Skin-to-skin / golden hour', ['Done', 'Delayed']), T('goldenWhy', 'Delayed — reason'), T('goldenAt', 'Skin-to-skin — date/time'),
        S('pku', 'Newborn metabolic screen (PKU)', ['Collected', 'Pending', 'Refused']), T('pkuAt', 'Metabolic screen — date/time'),
        S('hearing', 'Hearing screen', ['Pass', 'Refer', 'Pending', 'Refused']), T('hearingAt', 'Hearing screen — date/time'),
        S('tcbili', 'TcBili', ['Result', 'Pending', 'Refused']), T('tcbiliResult', 'TcBili result'), T('tcbiliAt', 'TcBili — date/time'),
        T('cchdHand', 'CCHD pulse ox — R hand %'), T('cchdFoot', 'CCHD pulse ox — foot %'), S('cchd', 'CCHD result', ['Pass', 'Fail', 'Repeat']), T('cchdAt', 'CCHD — date/time'),
        S('circ', 'Circumcision', ['Plastibell', 'Gomco', 'Not done']), T('circAt', 'Circumcision — date/time')] },
      { id: 'edu', title: 'Patient / Family Education', fields: EDU.flatMap(([k, label]) => [
        C(k, '', [label]), S(k + 'Learner', label + ' — learner', ['Mother', 'Father', 'Other']),
        S(k + 'Method', label + ' — method', ['Verbal', 'Demo', 'Handout']), S(k + 'Response', label + ' — response', ['Verbalized', 'Return demo', 'Needs reinforcement'])]) },
      { id: 'notes', title: 'Nursing Notes', fields: [
        A('exceptions', 'Exceptions summary / provider notified'), A('interventions', 'Interventions performed'), A('plan', 'Plan of care'),
        T('recordedBy', 'Recorded by (student)'), T('recordedAt', 'Recorded — date/time'), T('cosign', 'Co-signed by (RN / instructor)'), T('cosignAt', 'Co-signed — date/time')] }
    ],
    // Visible flags while charting and on the saved entry; they never block saving.
    flags(v) {
      const out = [], rr = num(v['vm.rr']), hr = num(v['vm.hr']), t = num(v['vm.temp']), hc = num(v['vm.hc']), cc = num(v['vm.cc']);
      if (rr != null && (rr > 60 || rr < 25)) out.push(`Respiratory rate ${rr}/min — outside 25–60`);
      if (hr != null && (hr > 160 || hr < 100)) out.push(`Heart rate ${hr} bpm — outside 100–160`);
      if (t != null && (t < 97.7 || t > 99.5)) out.push(`Temperature ${t} °F — outside 97.7–99.5 °F`);
      if (hc != null && cc != null && Math.abs(hc - cc - 2) > 1) out.push(`Head ${hc} cm vs chest ${cc} cm — head should be about 2 cm larger than chest`);
      return out;
    },
    summary(d) {
      const v = d.values, sys = this.sections.filter(s => s.dl);
      const n = sys.filter(s => v[s.id + '.dl'] === 'N').map(s => s.title), y = sys.filter(s => v[s.id + '.dl'] === 'Y').length;
      return [`${y} within defined limits`, n.length ? 'Exceptions: ' + n.join(', ') : '', d.total != null ? `Ballard ${d.total} (${d.interp})` : '', (d.flags || []).length ? `⚠ ${d.flags.length} flag(s)` : ''].filter(Boolean).join(' · ');
    }
  };
  H2T.summary = H2T.summary.bind(H2T);
  window.ASSESSMENT_FORMS = Object.assign(window.ASSESSMENT_FORMS || {}, { 'newborn-h2t': H2T, 'newborn-transition': TR_FORM, 'newborn-tr-vs': VS_FORM,
    apgar: APGAR, 'newborn-delivery': DELIVERY, ballard: BALLARD, 'newborn-glucose': GLUCOSE });
  const gaWeeks = t => Math.round((2 * t + 120) / 5 * 10) / 10;
  window.SCORE_INTERP = Object.assign(window.SCORE_INTERP || {}, {
    apgar: t => t >= 7 ? 'Reassuring (7–10)' : t >= 4 ? 'Moderately abnormal (4–6)' : 'Low (0–3)',
    ballard: t => `Estimated gestational age ${gaWeeks(t)} weeks`
  });

  /* ---------- helpers ---------- */
  const cfg = p => p && p.nbPair;
  // Released on either Sung chart (Instructor Tools shows "Delivery completed" on both cards).
  const isOpen = p => !!(cfg(p) && (Store.released(cfg(p).deliveryPid)[cfg(p).deliveryEvent] || Store.released(cfg(p).chart)[cfg(p).deliveryEvent]));
  const babyOf = p => Model.get(cfg(p).chart);
  const live = (doc, formId) => doc.assess.filter(e => e.status === 'active' && e.data.formId === formId).sort((a, b) => a.time - b.time);
  // Saved rows of the shared Transitional Record (js/views/sung-transitional-record.js) describe themselves.
  TR_FORM.summary = d => Views.transitional ? Views.transitional.summary(d) : null;
  TR_FORM.detail = d => Views.transitional ? Views.transitional.detail(d) : null;

  /* ---------- documenting ---------- */
  function openH2T(p, after) { Views.assess.open(babyOf(p), 'newborn-h2t', after); }
  // The shared Transitional Record is documented in the Assessments view (both charts).
  function openRecord(p) { location.hash = `#/patient/${p.id}/assess`; }

  /* ---------- Worklist items ---------- */
  // Any newborn (p.newborn: true) gets the Newborn Head-to-Toe Assessment. Baby Boy Sung (the baby of a mother/baby pair)
  // also gets the delivery documentation; it opens when faculty release "Delivery completed".
  const WL_MIN = 60000, WL_H = 3600000;
  function worklistItems(p) {
    const c = cfg(p);
    const paired = !!(c && c.chart === p.id);
    if (!p.newborn && !paired) return [];
    const locked = paired && !isOpen(p);
    const lockedMsg = 'Newborn documentation opens after delivery. Faculty: Instructor Tools → Amelia Sung (or Baby Boy Sung) → release "Delivery completed".';
    const base = { kind: 'form', tab: 'assess', newborn: true, locked, lockedMsg };
    const h2t = Object.assign({ key: 'nb:h2t', formId: 'newborn-h2t', name: 'Newborn Head-to-Toe Assessment', freq: 'ADMIT, THEN Q12HOURS', ms: 12 * WL_H }, base);
    if (!paired) return [h2t];
    const n = (doc, id) => live(doc, id).length;
    // APGAR is complete once 1- and 5-minute scores are in, and the last score is 7 or more (or 20 minutes was reached).
    const apgarDone = doc => {
      const by = {}; live(doc, 'apgar').forEach(e => { by[e.data.values['ap.minute']] = e.data.total; });
      const last = APGAR_MIN.filter(m => by[m] != null).pop();
      return by['1 minute'] != null && by['5 minutes'] != null && (by[last] >= 7 || last === '20 minutes');
    };
    return [
      Object.assign({ key: 'nb:apgar', formId: 'apgar', name: 'APGAR Score (1, 5, and 10 minutes)', freq: 'AT 1 & 5 MIN', ms: 4 * WL_MIN, once: true, complete: apgarDone }, base),
      Object.assign({ key: 'nb:delivery', formId: 'newborn-delivery', name: 'Newborn Delivery Assessment', freq: 'ONCE AFTER DELIVERY', ms: 12 * WL_H, once: true, complete: d => n(d, 'newborn-delivery') > 0 }, base),
      h2t,
      // The shared record is documented in the Assessments view, which both Sung charts show.
      Object.assign({ key: 'nb:record', formId: 'newborn-transition', name: 'Newborn Transitional Record (shared with Amelia Sung)', freq: 'ONCE (TRANSITION)', ms: 12 * WL_H, once: true,
        complete: () => !!Views.transitional && Views.transitional.transitionalEntries(p).length > 0, open: openRecord }, base),
      Object.assign({ key: 'nb:glucose', formId: 'newborn-glucose', name: 'Newborn Glucose Monitoring', freq: 'PER ORDER SET', ms: 3 * WL_H }, base)
    ];
  }

  /* ---------- the Newborn tab (both Sung charts) ---------- */
  Views.newborn = {
    label: 'Newborn',
    render(p) {
      const b = babyOf(p), doc = Store.doc(b.id), self = p.id === b.id;
      if (!isOpen(p)) return UI.panel('Newborn Documentation — Baby Boy Sung', `<div class="alert alert-info">Newborn documentation opens after delivery. Faculty: Instructor Tools → Amelia Sung (or Baby Boy Sung) → <strong>Delivery completed</strong>.</div>`);
      const h2t = live(doc, 'newborn-h2t').reverse();
      return `<div class="nb-head"><div><strong>Newborn Documentation — Baby Boy Sung</strong>
            <div class="muted small">${self ? 'Newborn assessments are documented from the Worklist. ' : 'Newborn assessments save to Baby Boy Sung\'s chart. '}The Newborn Transitional Record is one shared record, documented in the Assessments view of either Sung chart.</div></div>
          <div class="nb-actions">${self ? `<a class="btn" href="#/patient/${esc(b.id)}/worklist">Open Worklist</a>` : ''}<button class="btn btn-primary" data-nb="h2t">Document Newborn Head-to-Toe</button>
            <a class="btn btn-primary" href="#/patient/${esc(p.id)}/assess">Document Transitional Record</a></div></div>
        ${UI.panel('Newborn Head-to-Toe Assessments', h2t.length ? `<table class="grid"><thead><tr><th>Date/time</th><th>Summary</th><th>Documented by</th><th></th></tr></thead><tbody>
          ${h2t.map(e => `<tr><td class="nowrap">${esc(U.fmtDT(e.time))}</td><td>${esc(Views.assess.summary(H2T, e.data))}</td><td>${esc(Model.signature(e))}</td><td><button class="btn btn-sm" data-nbview="${esc(e.id)}">View</button></td></tr>`).join('')}</tbody></table>` : UI.empty('No newborn head-to-toe assessment documented yet.'))}
        ${Views.transitional ? UI.panel('Newborn Transitional Record (shared — current values)', Views.transitional.readOnly(p)) : ''}`;
    },
    bind(root, p) {
      root.querySelectorAll('[data-nb]').forEach(btn => btn.addEventListener('click', () => {
        if (Screens.mode() === 'observer') { UI.toast('Observer mode is view only. You cannot document.', 'warn'); return; }
        openH2T(p);
      }));
      root.querySelectorAll('[data-nbview]').forEach(btn => btn.addEventListener('click', () => {
        const b = babyOf(p), e = Store.doc(b.id).assess.find(x => x.id === btn.dataset.nbview);
        UI.modal({ title: H2T.title, wide: true, body: `${UI.entryMeta(e)}${Views.assess.detail(b, H2T, e.data)}` });
      }));
    }
  };
  Views.newborn.isOpen = isOpen;
  Views.newborn.worklistItems = worklistItems;
})();
