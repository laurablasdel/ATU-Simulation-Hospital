const assert=require('node:assert/strict'),boot=require('./boot.cjs');
const windows=[],open=s=>{const w=boot(s);windows.push(w);return w;},copy=x=>JSON.parse(JSON.stringify(x));
try{
 const w=open(),a=w.testApp,s=a.state;
 assert.equal(s.patients.find(p=>p.id==='baby-boy-sung').weightKg,4.08);
 assert.equal(s.patients.find(p=>p.id==='amelia-sung').primaryDiagnosis,'Induction of labor / gestational diabetes (diet-controlled)');
 assert.equal(s.orders.find(o=>o.id==='amelia-order-fingerstick').text,'Check Blood Sugar');
 assert(!s.orders.some(o=>o.id==='amelia-order-morphine'));assert(!s.medicationCatalog.some(m=>m.patientId==='amelia-sung'&&/morphine/i.test(m.name)));
 assert(s.medicationCatalog.some(m=>m.patientId==='jane-fowler'&&/morphine/i.test(m.name)));
 assert(!s.medicationCatalog.some(m=>m.barcode==='1016'),'retired morphine barcode stays reserved');
 for(const m of s.medicationCatalog){const old=w.LEGACY_MEDICATION_CODES[m.patientId+'|'+m.name];if(old)assert.equal(m.barcode,old,'existing label '+m.patientId+' '+m.name);}
 assert.equal(s.mar.filter(r=>r.patientId==='amelia-sung'&&r.origin==='prior-nurse'&&r.status==='Infusing').length,3);
 assert(s.medicationCatalog.some(m=>m.patientId==='baby-boy-sung'&&m.packageIds?.includes('MED-0064')));
 assert.equal(s.medicationCatalog.find(m=>m.patientId==='baby-boy-sung'&&m.name==='Glucose gel').dose,'Per protocol');
 const ep=s.medicationCatalog.find(m=>m.id==='sung-epidural');assert(w.medicationAdministrationBlock(ep).includes('Anesthesia'));
 for(const id of ['sung-maternal-interventions','sung-ephedrine-order','admin-baby-cxr-order','chart-256195d201d581aebb87f3902a0c5bc0'])assert(s.releaseQueue.some(q=>q.chartRecordId===id&&q.status==='pending'),id);
 assert(!a.records.some(r=>r.id==='chart-284195d201d5803eb4d1ca4446055402'));
 const prenatal=a.records.find(r=>r.id==='chart-284195d201d580aa92e4d1d5563f8355').content;for(const text of ['Family History','Alpha-Fetoprotein: normal','Multiple Marker Screen: low risk','Patient plans epidural','69 kg','1/28/2022'])assert(prenatal.includes(text),'preserve original prenatal detail '+text);assert(!prenatal.includes('<td>12</td>'));
 a.setPatient('amelia-sung');a.setView('summary');w.setTabMode('student');w.render();assert(!/Simulation complication|Shoulder dystocia/.test(w.document.getElementById('view').textContent));
 a.setView('mar');w.render();assert(!w.document.getElementById('view').textContent.includes('Ephedrine'));
 w.document.getElementById('marScanPatient').value=s.patients.find(p=>p.id==='amelia-sung').barcode;w.document.getElementById('marScanMedication').value='MED-0063';w.document.getElementById('marRecognize').click();assert(!w.document.getElementById('marConfirmSave'));assert(!w.document.getElementById('marProviderOverride'));
 w.setTabMode('faculty');w.releaseItem(s.releaseQueue.find(q=>q.chartRecordId==='sung-maternal-interventions').id);
 assert.equal(s.medicationCatalog.find(m=>m.patientId==='amelia-sung'&&/oxytocin/i.test(m.name)).status,'Discontinued');assert.equal(s.orders.find(o=>o.id==='amelia-order-oxytocin').status,'Discontinued');
 assert(w.medicationReleased(s.medicationCatalog.find(m=>m.id==='sung-lr-bolus')));assert(!w.medicationReleased(s.medicationCatalog.find(m=>m.id==='sung-ephedrine')));
 const continued=open(copy(s));assert.equal(continued.testApp.state.medicationCatalog.find(m=>m.patientId==='amelia-sung'&&/oxytocin/i.test(m.name)).status,'Discontinued','Pitocin remains stopped on reload');
 const saved=copy(s);saved.notes.push({id:'student-sung-note',patientId:'amelia-sung',student:'ST',narrative:'Keep this completed note'});saved.mar.push({id:'historical-morphine',patientId:'amelia-sung',medication:'Morphine',status:'Given'});
 saved.schemaVersion=0;delete saved.sungScenario20261015;saved.orders.push({id:'amelia-order-morphine',patientId:'amelia-sung',text:'Old morphine order',type:'Medication'});
 const upgraded=open(saved);assert(upgraded.testApp.state.notes.some(r=>r.id==='student-sung-note'));assert(upgraded.testApp.state.mar.some(r=>r.id==='historical-morphine'));assert(!upgraded.testApp.state.orders.some(r=>r.id==='amelia-order-morphine'));
 const reloaded=open(copy(upgraded.testApp.state));assert.equal(reloaded.testApp.state.medicationCatalog.filter(m=>m.id==='sung-hepatitis-b').length,1);assert.equal(reloaded.testApp.state.mar.filter(r=>r.patientId==='amelia-sung'&&r.origin==='prior-nurse'&&r.status==='Infusing').length,3);
 reloaded.resetToBase('amelia-sung');assert.equal(reloaded.testApp.state.medicationCatalog.find(m=>m.id==='sung-lr-bolus').releaseStatus,'pending');assert.equal(reloaded.testApp.state.mar.filter(r=>r.patientId==='amelia-sung'&&r.origin==='prior-nurse'&&r.status==='Infusing').length,3);assert(!reloaded.testApp.state.mar.some(r=>r.id==='historical-morphine'));
 reloaded.resetToBase('baby-boy-sung');assert.equal(reloaded.testApp.state.patients.find(p=>p.id==='baby-boy-sung').weightKg,4.08);
 console.log('PASS Sung scenario: migration preserves completed charting, retired barcode reserved, all old labels stable, faculty stop/bolus releases, anesthesia block, infant MAR, reload and reset.');
}finally{windows.forEach(w=>w.close());}
