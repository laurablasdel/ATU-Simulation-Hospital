const assert=require('node:assert/strict'),boot=require('./boot.cjs');
const w=boot();try{
 const s=w.testApp.state;w.setTabMode('faculty');let combined='';w.open=()=>({document:{write(html){combined=html},close(){}},addEventListener(){}});
 for(const p of s.patients){
  w.testApp.setPatient(p.id);w.testApp.setView('barcodes');w.render();w.document.getElementById('printPatientMedSheet').click();
  const doc=new w.DOMParser().parseFromString(combined,'text/html'),printed=new Set([...doc.querySelectorAll('[data-package]')].map(e=>e.dataset.package));
  const medications=s.medicationCatalog.filter(m=>m.patientId===p.id),expected=new Set(medications.flatMap(m=>w.packagesForMedication(m).map(p=>p.id)));
  assert.deepEqual(printed,expected,p.name+' all active and future-release medication packages');assert.equal(doc.querySelectorAll('.wristbandLabel').length,1);
  assert.deepEqual(new Set([...w.document.querySelectorAll('[data-package-row]')].map(e=>e.dataset.packageRow)),expected,p.name+' label selection matches patient');
  for(const m of medications)assert(w.packagesForMedication(m).length&&w.packagesForMedication(m).every(p=>p.name),p.name+': '+m.name);
 }
 const pid='vernon-watkins';w.testApp.setPatient(pid);w.testApp.setView('barcodes');w.render();w.document.getElementById('printPatientMedSheet').click();assert(combined.includes('MED-HEP10K')&&combined.includes('10,000 units/10 mL'));assert(combined.includes('MED-HEPINF'));
 assert(!w.medicationsForPatient(pid,false).some(m=>m.id==='vernon-heparin-bolus'),'printing does not release heparin');
 const q=s.releaseQueue.find(q=>q.chartRecordId==='chart-25d195d201d580409b1cc83312b4cff6');w.releaseItem(q.id);w.ensureMedicationData();assert(w.medicationsForPatient(pid,false).some(m=>m.id==='vernon-heparin-bolus'));w.resetToBase(pid);assert(!w.medicationsForPatient(pid,false).some(m=>m.id==='vernon-heparin-bolus'));
 // Any future structured pending medication is printable before release, even if not seeded in the MAR yet.
 s.releaseQueue.push({id:'future-med-queue',patientId:pid,targetCollection:'medicationCatalog',status:'pending',rowData:{id:'future-med',name:'Future simulation medication',dose:'5 test units',route:'PO'}});w.render();w.document.getElementById('printPatientMedSheet').click();assert(combined.includes('Future simulation medication'));assert(!w.medicationsForPatient(pid,false).some(m=>m.id==='future-med'));
 console.log('PASS package coverage: all 13 patients active and pending medications, matching patient-only selections, Vernon heparin vial/infusion, release/reset and future pending medication.');
}finally{setImmediate(()=>w.close());}
