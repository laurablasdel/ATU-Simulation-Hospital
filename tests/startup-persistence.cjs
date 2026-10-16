const assert=require('node:assert/strict'),boot=require('./boot.cjs'),copy=x=>JSON.parse(JSON.stringify(x));
const first=boot();let second;try{
 const saved=JSON.parse(first.localStorage.getItem('atuSimulationHospitalEHRv1'));
 assert.equal(saved.schemaVersion,first.STATE_SCHEMA_VERSION,'startup writes the completed migration');
 assert(saved.medicationCatalog.length>0);assert(saved.mar.some(r=>r.origin==='prior-nurse'));assert(!saved.mar.some(r=>r.id==='sung-prior-nurse-clindamycin'));
 second=boot(saved);
 assert.deepEqual(copy(second.testApp.state.medicationCatalog.map(m=>m.id).sort()),copy(first.testApp.state.medicationCatalog.map(m=>m.id).sort()),'opening a second tab must reuse medication identities');
 const merged=first.ATUSharedMerge(saved,first.testApp.state,second.testApp.state);
 assert.equal(merged.medicationCatalog.length,first.testApp.state.medicationCatalog.length,'tab merge adds no duplicate orders');
 assert(!merged.mar.some(r=>r.id==='sung-prior-nurse-clindamycin'),'tab merge must not restore the retired seeded dose');
 for(const q of second.testApp.state.releaseQueue.filter(q=>q.status==='pending')){const r=second.testApp.records.find(r=>r.id===q.chartRecordId);if(r?.category==='orders')assert.equal(q.kind,'order');}
 console.log('PASS initial persisted chart: migration complete, stable medication IDs in a second tab, no duplicate merge and order-release labels.');
}finally{first.close();second?.close();}
