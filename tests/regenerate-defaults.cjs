const fs=require('fs');
const path=require('path');
const boot=require('./boot.cjs');
const window=boot();
const state=window.testApp.state;
const records=window.testApp.records;
const root=path.resolve(__dirname,'..');
const requested=process.argv.slice(2);
const previous=window.SIMULATION_DEFAULTS;
const collectionNames=['orders','labs','notes','vitals','io','assessments','mar','medicationCatalog','bloodUnits','glucoseChecks','laborProgress','postpartumRecovery','pphPads','pphMedications','bloodAdministration','surgicalChecklist','surgicalAssessments','diagnosticFiles','labPanels','chartEntries','pewsAssessments','messages','notifications'];
const defaults={};
for(const patient of state.patients){
 const id=patient.id;
 if(requested.length&&!requested.includes(id)){defaults[id]=previous[id];continue;}
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
fs.writeFileSync(path.join(root,'simulation-defaults.js'),'window.SIMULATION_DEFAULTS=window.hydrateSimulationDefaults('+JSON.stringify(Object.fromEntries(Object.entries(defaults).map(([id,b])=>[id,window.compactSimulationBase(b)])))+');\n');
setTimeout(()=>window.close(),100);

