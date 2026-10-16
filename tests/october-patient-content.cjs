const assert=require('node:assert/strict'),boot=require('./boot.cjs');
const windows=[],open=s=>{const w=boot(s);windows.push(w);return w;},copy=x=>JSON.parse(JSON.stringify(x));
function check(w){
 const s=w.testApp.state,patient=id=>s.patients.find(p=>p.id===id),med=(id,re)=>s.medicationCatalog.find(m=>m.patientId===id&&re.test(m.name)),content=id=>w.testApp.records.find(r=>r.id===id).content;
 assert.equal(patient('amelia-sung').room,'211E');assert.match(patient('amelia-sung').painPlan,/in place/);
 assert.equal(med('amelia-sung',/Clindamycin/i).scheduledTime,'Now');assert.equal(med('amelia-sung',/Clindamycin/i).releaseStatus,'released');assert(!s.mar.some(r=>r.id==='sung-prior-nurse-clindamycin'));
 assert.match(s.orders.find(o=>o.id==='oct16-amelia-juice').text,/30 minutes/);assert(!s.medicationCatalog.some(m=>/juice|sprite/i.test(m.name)));
 assert.equal(patient('baby-boy-sung').provider,'MD');assert.match(med('baby-boy-sung',/Erythromycin/).dose,/0.5%, 1 cm ribbon/);assert.match(med('baby-boy-sung',/Vitamin K/).route,/vastus lateralis/);
 assert.equal(w.packagesForMedication(med('baby-boy-sung',/Vitamin K/))[0].id,'MED-0033');assert.equal(w.packagesForMedication(med('baby-boy-sung',/Erythromycin/))[0].id,'MED-0034');
 assert.equal(patient('fatima-sanogo').weightKg,70);for(const r of w.testApp.records.filter(r=>r.patientId==='fatima-sanogo'))assert(!/1235|1242|71 kg/.test(r.content));
 assert.match(content('packet-fatima-faculty'),/1245/);assert.match(content('packet-fatima-shift2'),/SpO₂ 96%/);assert.equal(med('fatima-sanogo',/^Fentanyl$/).dose,'50 mcg');assert.deepEqual(Array.from(med('fatima-sanogo',/^Fentanyl$/).packageIds),['MED-0065']);
 assert.equal(med('fatima-sanogo',/Percocet/).dose,'1 tablet');assert.equal(patient('molly-thomas').weightKg,7);assert.match(content('packet-molly-faculty'),/capillary refill 4 seconds/);
 assert.equal(patient('stephanie-smith').bloodType,'A-');assert.match(content('admin-stephanie-prbc-2units'),/1 unit/i);assert(!/2 units|two units/i.test(content('admin-stephanie-prbc-2units')));
 for(const m of s.medicationCatalog){const old=w.LEGACY_MEDICATION_CODES[m.patientId+'|'+m.name];if(old)assert.equal(m.barcode,old,'printed medication barcode preserved');}
}
try{
 const fresh=open();check(fresh);const saved=copy(fresh.testApp.state);saved.schemaVersion=13;
 saved.patients.find(p=>p.id==='amelia-sung').room='201';saved.patients.find(p=>p.id==='fatima-sanogo').weightKg=71;saved.patients.find(p=>p.id==='baby-boy-sung').provider='Craig';saved.patients.find(p=>p.id==='stephanie-smith').bloodType='';
 saved.mar.push({id:'sung-prior-nurse-clindamycin',patientId:'amelia-sung',status:'Given'},{id:'student-dose',patientId:'amelia-sung',status:'Given'});saved.notes.push({id:'student-note',patientId:'fatima-sanogo',narrative:'Do not change my documentation'});
 for(const pid of fresh.OCTOBER_PATIENT_CONTENT.ids)saved.simulationBases[pid]=copy(fresh.SIMULATION_DEFAULTS[pid]);
 saved.simulationBases['fatima-sanogo'].patient.weightKg=71;
 saved.simulationBases['amelia-sung'].collections.mar.push({id:'sung-prior-nurse-clindamycin',patientId:'amelia-sung',status:'Given'});
 const w=open(saved);check(w);assert(w.testApp.state.mar.some(r=>r.id==='student-dose'));assert(w.testApp.state.notes.some(r=>r.id==='student-note'));
 const again=open(copy(w.testApp.state));check(again);for(const id of ['oct16-fatima-fentanyl','oct16-amelia-juice'])assert.equal(again.testApp.state.orders.filter(o=>o.id===id).length,1);
 for(const id of w.OCTOBER_PATIENT_CONTENT.ids)again.resetToBase(id);check(again);
 // Characterize existing guards; do not add compatibility rules as part of this content update.
 for(const [pid,type] of [['fatima-sanogo','A-'],['stephanie-smith','A+']]){
  const trial=open(),s=trial.testApp.state;trial.setTabMode('faculty');trial.testApp.setPatient(pid);
  s.orders.push({id:'test-blood-order',patientId:pid,type:'Other',text:'Transfuse 1 unit packed red blood cells',status:'Active'});
  s.bloodUnits.push({id:'test-wrong-type',patientId:pid,unitNumber:'TEST-ONLY',unitType:type,product:'Packed red blood cells',status:'Available'});trial.ensureMedicationData();
  const m=s.medicationCatalog.find(m=>m.sourceOrderId==='test-blood-order'),unit=s.bloodUnits.find(b=>b.id==='test-wrong-type');
  const result=trial.saveMedicationAdministration({patientId:pid,medicationId:m.id,method:'barcode',patientBarcode:s.patients.find(p=>p.id===pid).barcode,medicationBarcode:trial.bloodUnitLabelPackage(unit).id,dose:'1 unit',route:'IV',student:'ST',verifiedBy:'RN',time:'2026-10-16T12:00',confirmed:true});
  assert.equal(result.ok,true,'existing workflow has no ABO/Rh rejection when unit is assigned to this patient');
  unit.status='Available';trial.testApp.setView('blood');trial.renderBloodAdministration();
  const el=id=>trial.document.getElementById(id);el('sbProduct').value=unit.id;el('sbProduct').dispatchEvent(new trial.Event('change'));
  el('sbStudent').value='ST';el('sbVerifier').value='RN';el('sbBaseline').value='Test baseline';for(let i=0;i<7;i++)el('sbCheck'+i).checked=true;
  el('sbSave').click();assert(s.bloodAdministration.some(r=>r.bloodUnitId===unit.id),'existing blood documentation relies on checklist, not a type comparison');
  console.log('KNOWN LIMITATION: '+type+' assigned unit for '+pid+' accepted by existing MAR; no ABO/Rh guard.');
 }
 console.log('PASS October 16 content: fresh/saved/reloaded/reset, stable labels, no duplicate orders and preserved student documentation.');
}finally{setImmediate(()=>windows.forEach(w=>w.close()));}
