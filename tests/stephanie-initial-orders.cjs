const assert=require('node:assert/strict'),boot=require('./boot.cjs');
const copy=x=>JSON.parse(JSON.stringify(x)),pid='stephanie-smith',initial='chart-28b195d201d580f18277f6d7049c1104';
const old='<tr><td>Today</td><td>2 U Blood infused over 2 hours</td><td>Dr. Henderson</td></tr><tr><td>Today</td><td>Ceftriaxon 500mg IV Q6H</td><td>Dr. Henderson</td></tr>';
const windows=[];
try{
 const w=boot();windows.push(w);const s=w.testApp.state;
 const baseline=w.SIMULATION_DEFAULTS[pid].chartRecords.find(r=>r.id===initial);
 assert(!/2 U Blood|Ceftriaxon/i.test(baseline.content));
 const saved=copy(s);saved.simulationBases[pid]=copy(w.SIMULATION_DEFAULTS[pid]);
 saved.simulationBases[pid].chartRecords.find(r=>r.id===initial).content+=old;
 saved.chartContentEdits[initial]={content:baseline.content+old};
 saved.mar.push({id:'keep-history',patientId:pid,status:'Given'});
 const u=boot(saved);windows.push(u);u.setTabMode('faculty');
 assert(u.testApp.state.mar.some(r=>r.id==='keep-history'));
 const clean=()=>assert(!/2 U Blood|Ceftriaxon/i.test(u.testApp.records.find(r=>r.id===initial).content));clean();
 u.resetToBase(pid);clean();
 const meds=()=>u.medicationsForPatient(pid,false);
 assert(!meds().some(m=>m.bloodProduct||m.name==='Ceftriaxone'));
 const q=id=>u.testApp.state.releaseQueue.find(r=>r.chartRecordId===id);
 assert.equal(q('admin-stephanie-prbc-2units').status,'pending');
 assert.equal(q('admin-stephanie-ceftriaxone').status,'pending');
 u.releaseItem(q('admin-stephanie-ceftriaxone').id);u.ensureMedicationData();
 assert(meds().some(m=>m.name==='Ceftriaxone'));assert(!meds().some(m=>m.bloodProduct));
 u.releaseItem(q('admin-stephanie-prbc-2units').id);u.ensureMedicationData();
 assert.equal(meds().find(m=>m.bloodProduct).orderedUnits,1);
 u.resetToBase(pid);clean();assert(!meds().some(m=>m.bloodProduct||m.name==='Ceftriaxone'));
 u.testApp.state.chartContentEdits[initial].content+=old;u.refreshSimulationRecords();clean();
 console.log('PASS stale saved chart/base cleanup, preserved history, independent releases, 1-unit PRBC, repeat reset and shared refresh.');
}finally{setImmediate(()=>windows.forEach(w=>w.close()));}
