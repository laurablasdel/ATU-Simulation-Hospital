/* Faculty-approved three-shift Sung scenario, October 15, 2026. */
(function(){
 const copy=x=>JSON.parse(JSON.stringify(x)),mother='amelia-sung',baby='baby-boy-sung';
 const intervention='sung-maternal-interventions',ephedrine='sung-ephedrine-order';
 const records=window.CHART_RECORDS.filter(r=>['packet-amelia-shift1',intervention,ephedrine,'packet-baby-shift3'].includes(r.id));
 for(const record of records)if(!window.CHART_RECORDS.some(r=>r.id===record.id))window.CHART_RECORDS.push(copy(record));
 const meds=[
  {id:'sung-lr-bolus',patientId:mother,name:'Lactated Ringer’s solution (LR) bolus',dose:'500 mL',route:'IV bolus',frequency:'Once',scheduledTime:'When released',sourceChartRecordId:intervention,releaseStatus:'pending',status:'Pending',packageIds:['MED-0002']},
  {id:'sung-ephedrine',patientId:mother,name:'Ephedrine',dose:'5 mg',route:'IV',frequency:'PRN hypotension not responding to initial measures',scheduledTime:'PRN',sourceChartRecordId:ephedrine,releaseStatus:'pending',status:'Pending',highAlert:true,packageIds:['MED-0062']},
  {id:'sung-epidural',patientId:mother,name:'Bupivacaine / fentanyl epidural infusion',dose:'Bupivacaine 0.1% with fentanyl 2 mcg/mL at 10 mL/hr',route:'Epidural',frequency:'Managed by anesthesia; post-epidural monitoring per protocol',scheduledTime:'Per anesthesia',sourceOrderId:'amelia-order-epidural',releaseStatus:'released',status:'Due',administrationManagedBy:'anesthesia',packageIds:['MED-0063']},
  {id:'sung-hepatitis-b',patientId:baby,name:'Hepatitis B vaccine',dose:'0.5 mL',route:'IM — vastus lateralis (anterolateral thigh)',frequency:'Once, over 2,000 g, with consent',scheduledTime:'Now',releaseStatus:'released',status:'Due',packageIds:['MED-0064']}
 ];
 function applyScenario(){
  if(window.stateMigrationApplied('sungScenario20261015'))return;
  // Completed MAR entries, notes, vitals and forms are not deleted by this scenario migration.
  const retired=new Set(['amelia-order-morphine','chart-284195d201d5803eb4d1ca4446055402']);
  const removedMeds=new Set((state.medicationCatalog||[]).filter(m=>m.patientId===mother&&(/morphine/i.test(m.name)||m.sourceOrderId==='amelia-order-epidural')).map(m=>m.id));
  state.medicationCatalog=(state.medicationCatalog||[]).filter(m=>!removedMeds.has(m.id));
  state.orders=state.orders.filter(r=>!retired.has(r.id));
  state.releaseQueue=(state.releaseQueue||[]).filter(q=>!retired.has(q.chartRecordId)&&!removedMeds.has(q.rowData?.id));
  state.customChartRecords=(state.customChartRecords||[]).filter(r=>!retired.has(r.id));
  for(const id of retired)delete state.chartContentEdits?.[id];
  const motherPatient=state.patients.find(p=>p.id===mother);if(motherPatient)Object.assign(motherPatient,{primaryDiagnosis:'Induction of labor / gestational diabetes (diet-controlled)',painPlan:'Epidural in place — anesthesia-managed'});
  const infant=state.patients.find(p=>p.id===baby);if(infant)infant.weightKg=4.08;
  for(const seed of SEED_AMELIA_ORDERS){const row=state.orders.find(r=>r.id===seed.id);if(row)Object.assign(row,copy(seed));else state.orders.push(copy(seed));}
  const admission=state.notes.find(r=>r.id==='amelia-admission-note');if(admission)Object.assign(admission,copy(SEED_AMELIA_NOTES[0]));
  const pit=state.medicationCatalog.find(m=>m.patientId===mother&&/oxytocin/i.test(m.name));if(pit)Object.assign(pit,{dose:'30 units in 500 mL sodium chloride 0.9%; infusing at 6 milliunits/min',frequency:'Continuous; discontinue when faculty releases intervention orders',scheduledTime:'Now'});
  for(const m of state.medicationCatalog.filter(m=>m.patientId===baby)){if(m.name==='Vitamin K')Object.assign(m,{route:'IM — vastus lateralis (anterolateral thigh)',scheduledTime:'Now'});if(/erythromycin/i.test(m.name))m.scheduledTime='Now';}
  for(const med of meds)if(!state.medicationCatalog.some(m=>m.id===med.id))state.medicationCatalog.push({...copy(med),provider:med.patientId===mother?'Dr. Darnell':'MD'});
  // Update supplied chart text, but retain student entries held separately in chartEntries.
  state.chartContentEdits||={};for(const r of CHART_RECORDS.filter(r=>[mother,baby].includes(r.patientId)))if(state.chartContentEdits[r.id])state.chartContentEdits[r.id]={...state.chartContentEdits[r.id],...copy(r)};
  seedChartPending();ensureMedicationData();ensureMedicationPackages();
  window.markStateMigration('sungScenario20261015');
  for(const pid of [mother,baby]){const canonical=window.SIMULATION_DEFAULTS?.[pid];if(canonical?.collections?.medicationCatalog?.some(m=>m.id.startsWith('sung-'))){if(state.simulationBases?.[pid])state.simulationBases[pid]=copy(canonical);}else updateBasePatient(pid);}
 }
 const initialize=window.initializeMedicationSystem;window.initializeMedicationSystem=function(){initialize();applyScenario();};
 const refresh=window.refreshSimulationRecords;if(refresh)window.refreshSimulationRecords=function(...args){const result=refresh(...args);applyScenario();return result;};
 window.applySungScenario=applyScenario;
})();
