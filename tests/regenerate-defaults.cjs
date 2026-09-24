const fs=require('fs');
const path=require('path');
const boot=require('./boot.cjs');
const window=boot();
const state=window.testApp.state;
const records=window.testApp.records;
const root=path.resolve(__dirname,'..');
const collectionNames=['orders','labs','notes','vitals','io','assessments','mar','medicationCatalog','bloodUnits','glucoseChecks','laborProgress','postpartumRecovery','pphPads','pphMedications','bloodAdministration','surgicalChecklist','surgicalAssessments','diagnosticFiles','labPanels','chartEntries','pewsAssessments','messages','notifications'];
const defaults={};
for(const patient of state.patients){
 const id=patient.id;
 defaults[id]={
  patient,
  chartRecords:records.filter(row=>row.patientId===id),
  collections:Object.fromEntries(collectionNames.map(name=>[name,(state[name]||[]).filter(row=>row.patientId===id)])),
  releaseQueue:(state.releaseQueue||[]).filter(row=>row.patientId===id&&row.status==='pending'),
  marVisibility:state.marVisibility?.[id]!==false,
  marHiddenRecords:Object.fromEntries(Object.entries(state.marHiddenRecords||{}).filter(([recordId])=>records.some(row=>row.id===recordId&&row.patientId===id))),
  scenarioStage:state.scenarioStage?.[id]??null
 };
}
fs.writeFileSync(path.join(root,'simulation-defaults.js'),`window.SIMULATION_DEFAULTS=${JSON.stringify(defaults)};\n`);
setTimeout(()=>window.close(),100);

