const assert=require('node:assert/strict'),boot=require('./boot.cjs'),copy=x=>JSON.parse(JSON.stringify(x));const windows=[],open=s=>{const w=boot(s);windows.push(w);return w;};
function check(w){const s=w.testApp.state,p=id=>s.patients.find(p=>p.id===id);
 assert.equal(p('carl-shapiro').age,'64');assert.equal(p('karl-sharp').mrn,'PCS71901');assert.equal(p('karl-sharp').barcode,'1010');assert.equal(p('karl-sharp').provider,'Dr. Chin A. Revis');assert.equal(p('karl-sharp').weightKg,110);assert.equal(p('karl-sharp').heightCm,175);assert.equal(p('karl-sharp').codeStatus,'DNR');
 for(const id of w.LEVEL3_OCTOBER.retired){assert(!w.testApp.records.some(r=>r.id===id));assert(!s.releaseQueue.some(r=>r.chartRecordId===id));}
 const ty=s.medicationCatalog.filter(m=>m.patientId==='vernon-watkins'&&/^Acetaminophen 1 g/.test(m.name));assert.equal(ty.length,1);assert.equal(ty[0].scheduledTime,'0800, 2000');assert.equal(ty[0].barcode,'1092');assert.equal(ty[0].packageIds[0],'MED-ACET325');
 assert(s.medicationCatalog.some(m=>m.id==='oct16-l3-vernon-fluid-mar'&&m.dose==='100 mL/hr'));
 assert.match(w.testApp.records.find(r=>r.id==='chart-25d195d201d580409b1cc83312b4cff6').content,/Hold enoxaparin while on heparin/);
 for(const r of w.testApp.records.filter(r=>r.patientId==='carl-shapiro'))assert(!/54[- ](?:year|yr)/.test(r.content));
 const note=w.testApp.records.find(r=>r.id==='chart-25d195d201d5813ab85ed747109e3799');assert(!note.content.includes('Left lower leg'));assert(note.content.includes('Major depression'));
 assert(s.medicationCatalog.some(m=>m.patientId==='david-carter'&&/Lorazepam/.test(m.name)),'PRN order retained');
}
try{const w=open();check(w);const old=copy(w.testApp.state);old.schemaVersion=14;old.patients.find(p=>p.id==='karl-sharp').mrn='SIM-L3-004';old.patients.find(p=>p.id==='carl-shapiro').age='54';
 for(const id of w.LEVEL3_OCTOBER.retired){old.customChartRecords.push({id,patientId:'ruth-livingston',category:'orders',content:'retired'});old.releaseQueue.push({id:'old-'+id,patientId:'ruth-livingston',chartRecordId:id,status:'pending'});}
 old.notes.push({id:'student-keep',patientId:'ruth-livingston',narrative:'Keep'});const migrated=open(old);check(migrated);assert(migrated.testApp.state.notes.some(r=>r.id==='student-keep'));const reload=open(copy(migrated.testApp.state));check(reload);for(const id of w.LEVEL3_OCTOBER.targets)reload.resetToBase(id);check(reload);
 console.log('PASS Level 3 October: profiles, retired releases, unchanged ICU orders, stable wristband/Tylenol labels, fluid order, saved upgrade/reload/reset.');
}finally{setImmediate(()=>windows.forEach(w=>w.close()));}
