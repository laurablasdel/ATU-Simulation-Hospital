/*
 * Assessment forms. WDL definitions come from the ATU Simulation Hospital
 * "Physical Assessment" pages in Notion.
 *
 * Field types:
 *   wdl       WDL / WDL Except, with an exceptions box (uses section definition)
 *   select    dropdown           checks   checkbox group
 *   radio     one choice         text     single-line text
 *   number    number             textarea free text
 *   score     scored choice ([label, points]); the form shows a running total
 */
window.ASSESSMENT_FORMS = {

  'wdl-adult': {
    title: 'Physical Assessment (WDL)',
    intro: 'Document your physical assessment for your shift. If you have exceptions, document what was NOT WDL.',
    sections: [
      { id: 'cog', title: 'Cognitive', wdl: 'Alert; opens eyes spontaneously; arouses to voice/touch; oriented x 4, follows commands; speech spontaneous; logical, purposeful, motor response; behavior appropriate to situation' },
      { id: 'cv', title: 'Cardiovascular', wdl: 'Regular rhythm, S1S2, no murmurs/gallops, no reported chest pain' },
      { id: 'resp', title: 'Respiratory', wdl: 'Regular depth and pattern; unlabored; expansion symmetrical; breath sounds clear and equal bilaterally; no cough' },
      { id: 'gi', title: 'Gastrointestinal', wdl: 'Abdomen soft non distended; bowel sounds audible, normoactive in 4 quadrants; no reported/observed nausea, vomiting, diarrhea or constipation' },
      { id: 'gu', title: 'Genitourinary', wdl: 'No reported or observed difficulties with voiding; urine reported or observed as clear, yellow and without foul odor' },
      { id: 'skin', title: 'Skin', wdl: 'Warm; dry; intact, elastic; without discoloration; pressure points without redness' },
      { id: 'msk', title: 'Musculoskeletal', wdl: 'No observed or reported muscle weakness, joint swelling or tenderness; all extremities with symmetrical movement bilaterally' },
      { id: 'pnv', title: 'Peripheral Neurovascular', wdl: 'Capillary refill less than/equal to 3 seconds; extremities warm with 2+ pulses; no discoloration or edema; no reported numbness, tingling, or tenderness' },
      { id: 'safety', title: 'Safety', wdl: 'Bed in low position, wheels locked; call light in reach; upper side rails up x 2; ID band on' }
    ]
  },

  mse: {
    title: 'Mental Status Exam',
    sections: [
      { id: 'appear', title: 'General Appearance', fields: [
        { id: 'items', type: 'checks', options: ['Appropriately dressed for age and weather', 'Well groomed', 'Poorly groomed', 'Unkempt', 'Odiferous', 'Hostile', 'Evidence of self neglect'] }
      ] },
      { id: 'behavior', title: 'Behaviors', fields: [
        { id: 'items', type: 'checks', options: ['Appropriate for age', 'Restless', 'Poor eye contact', 'Tics', 'Fidgety', 'Psychomotor agitation', 'Psychomotor retardation', 'Inappropriate mannerisms', 'Inappropriate gestures', 'Tremor', 'Hypermotoric'] }
      ] },
      { id: 'mood', title: 'Mood and Affect', fields: [
        { id: 'mood', label: 'Mood', type: 'checks', options: ['Normal', 'Happy', 'Sad', 'Anxious', 'Angry', 'Irritable', 'Elation'] },
        { id: 'affect', label: 'Affect', type: 'checks', options: ['Euthymic (stable, balanced mood)', 'Sad', 'Anxious', 'Depressed', 'Irritable/angry', 'Blunted/flat', 'Euphoric'] },
        { id: 'congruent', label: 'Is affect congruent with thoughts?', type: 'radio', options: ['Yes', 'No'] }
      ] },
      { id: 'speech', title: 'Speech and Language', fields: [
        { id: 'speech', label: 'Speech', type: 'checks', options: ['Increased rate', 'Decreased rate', 'Soft', 'Mute', 'Stuttering', 'Poor articulation', 'Newly coined phrases', 'Repeats same words / mimics others'] },
        { id: 'language', label: 'Language', type: 'checks', options: ['Difficulty naming objects', 'Difficulty repeating phrases', 'Non-verbal'] }
      ] },
      { id: 'thought', title: 'Thought Content and Process; Cognition', fields: [
        { id: 'process', label: 'Thought process abnormalities', type: 'checks', options: ['Disorganized', 'Blocking', 'Derailed', 'Incoherent', 'Racing', 'Illogical'] },
        { id: 'content', label: 'Thought content abnormalities', type: 'checks', options: ['Delusional', 'Paranoid', 'Persecution', 'Broadcasting', 'Thought insertion', 'Obsessive thoughts', 'Phobias', 'Hopelessness', 'Helplessness', 'Religiosity'] },
        { id: 'cognitive', label: 'Cognitive abnormalities', type: 'checks', options: ['Concrete', 'Unable to follow instructions'] }
      ] },
      { id: 'halluc', title: 'Hallucinations', fields: [
        { id: 'items', type: 'checks', options: ['None reported', 'Auditory', 'Visual', 'Tactile', 'Olfactory'] },
        { id: 'describe', label: 'Describe (content, command hallucinations)', type: 'textarea' }
      ] },
      { id: 'risk', title: 'Self Harm, Suicide, or Homicidal Urges', fields: [
        { id: 'suicide', label: 'Suicidality', type: 'checks', options: ['Denies', 'Ideation (passive, without plan/intent)', 'Plan', 'Intent', 'Means'] },
        { id: 'selfharm', label: 'Self harm', type: 'radio', options: ['Denies', 'Acts'] },
        { id: 'homicide', label: 'Homicidal ideation', type: 'checks', options: ['Denies', 'Ideation (passive, without plan/intent)', 'Plan', 'Intent', 'Means'] }
      ] },
      { id: 'orient', title: 'Orientation, Memory, Insight, Judgment', fields: [
        { id: 'orientation', label: 'Oriented to', type: 'checks', options: ['Person', 'Place', 'Time'] },
        { id: 'memory', label: 'Memory', type: 'checks', options: ['Intact', 'Long-term deficits', 'Short-term deficits'] },
        { id: 'attention', label: 'Attention span', type: 'radio', options: ['Focused', 'Easily distracted'] },
        { id: 'insight', label: 'Insight', type: 'radio', options: ['Good', 'Partial', 'Poor', 'Impaired'] },
        { id: 'judgment', label: 'Judgment', type: 'radio', options: ['Good', 'Partial', 'Poor', 'Impaired'] }
      ] },
      { id: 'comments', title: 'Comments', fields: [
        { id: 'note', type: 'textarea' }
      ] }
    ]
  },

  pain: {
    title: 'Pain Assessment',
    sections: [
      { id: 'pain', title: 'Pain', fields: [
        { id: 'scale', label: 'Scale used', type: 'select', options: ['Numeric 0–10', 'Wong-Baker FACES', 'PAINAD', 'CPOT', 'Patient denies pain'] },
        { id: 'score', label: 'Score (0–10)', type: 'number', min: 0, max: 10 },
        { id: 'goal', label: 'Patient\'s pain goal', type: 'number', min: 0, max: 10 },
        { id: 'location', label: 'Location', type: 'text' },
        { id: 'quality', label: 'Quality', type: 'checks', options: ['Aching', 'Sharp', 'Dull', 'Burning', 'Stabbing', 'Throbbing', 'Cramping', 'Pressure', 'Crushing', 'Pleuritic'] },
        { id: 'onset', label: 'Onset / duration', type: 'text' },
        { id: 'radiation', label: 'Radiation', type: 'text' },
        { id: 'aggravating', label: 'Aggravating factors', type: 'text' },
        { id: 'alleviating', label: 'Alleviating factors', type: 'text' },
        { id: 'intervention', label: 'Interventions / plan', type: 'textarea' }
      ] }
    ]
  },

  braden: {
    title: 'Braden Scale (Pressure Injury Risk)',
    scored: 'braden',
    sections: [
      { id: 'b', title: 'Braden Subscales', fields: [
        { id: 'sensory', label: 'Sensory perception', type: 'score', options: [['Completely limited', 1], ['Very limited', 2], ['Slightly limited', 3], ['No impairment', 4]] },
        { id: 'moisture', label: 'Moisture', type: 'score', options: [['Constantly moist', 1], ['Very moist', 2], ['Occasionally moist', 3], ['Rarely moist', 4]] },
        { id: 'activity', label: 'Activity', type: 'score', options: [['Bedfast', 1], ['Chairfast', 2], ['Walks occasionally', 3], ['Walks frequently', 4]] },
        { id: 'mobility', label: 'Mobility', type: 'score', options: [['Completely immobile', 1], ['Very limited', 2], ['Slightly limited', 3], ['No limitation', 4]] },
        { id: 'nutrition', label: 'Nutrition', type: 'score', options: [['Very poor', 1], ['Probably inadequate', 2], ['Adequate', 3], ['Excellent', 4]] },
        { id: 'friction', label: 'Friction & shear', type: 'score', options: [['Problem', 1], ['Potential problem', 2], ['No apparent problem', 3]] }
      ] }
    ]
  },

  morse: {
    title: 'Morse Fall Scale',
    scored: 'morse',
    sections: [
      { id: 'm', title: 'Morse Fall Scale', fields: [
        { id: 'history', label: 'History of falling (immediate or within 3 months)', type: 'score', options: [['No', 0], ['Yes', 25]] },
        { id: 'secondary', label: 'Secondary diagnosis', type: 'score', options: [['No', 0], ['Yes', 15]] },
        { id: 'aid', label: 'Ambulatory aid', type: 'score', options: [['None / bed rest / nurse assist', 0], ['Crutches / cane / walker', 15], ['Furniture', 30]] },
        { id: 'iv', label: 'IV therapy / heparin lock', type: 'score', options: [['No', 0], ['Yes', 20]] },
        { id: 'gait', label: 'Gait', type: 'score', options: [['Normal / bed rest / wheelchair', 0], ['Weak', 10], ['Impaired', 20]] },
        { id: 'mental', label: 'Mental status', type: 'score', options: [['Oriented to own ability', 0], ['Overestimates or forgets limitations', 15]] }
      ] }
    ]
  },

  gcs: {
    title: 'Glasgow Coma Scale',
    scored: 'gcs',
    sections: [
      { id: 'g', title: 'Glasgow Coma Scale', fields: [
        { id: 'eye', label: 'Eye opening', type: 'score', options: [['Spontaneous', 4], ['To sound', 3], ['To pressure', 2], ['None', 1]] },
        { id: 'verbal', label: 'Verbal response', type: 'score', options: [['Oriented', 5], ['Confused', 4], ['Words', 3], ['Sounds', 2], ['None', 1]] },
        { id: 'motor', label: 'Motor response', type: 'score', options: [['Obeys commands', 6], ['Localizing', 5], ['Normal flexion', 4], ['Abnormal flexion', 3], ['Extension', 2], ['None', 1]] }
      ] }
    ]
  }
};

// Interpretation of scored tools (total -> text).
window.SCORE_INTERP = {
  braden: t => t <= 9 ? 'Very high risk' : t <= 12 ? 'High risk' : t <= 14 ? 'Moderate risk' : t <= 18 ? 'Mild risk' : 'No risk',
  morse: t => t >= 45 ? 'High fall risk' : t >= 25 ? 'Moderate fall risk' : 'Low fall risk',
  gcs: t => t <= 8 ? 'Severe (≤ 8)' : t <= 12 ? 'Moderate (9–12)' : 'Mild (13–15)'
};
