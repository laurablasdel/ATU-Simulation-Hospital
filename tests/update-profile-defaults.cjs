// Refresh only Ruth/Carl record, patient-header and pending-queue defaults.
// Other baseline collections (medications, orders, etc.) remain unchanged.
const fs=require('fs'),path=require('path'),vm=require('vm'),boot=require('./boot.cjs');
const file=path.join(__dirname,'../simulation-defaults.js'),context={window:{}};
vm.runInNewContext(fs.readFileSync(file,'utf8'),context);
const defaults=context.window.SIMULATION_DEFAULTS,ids=['carl-shapiro','ruth-livingston'];
const others=JSON.stringify(Object.entries(defaults).filter(([id])=>!ids.includes(id)));
const w=boot();try{for(const id of ids){
 const b=defaults[id],s=w.testApp.state;
 b.patient=JSON.parse(JSON.stringify(s.patients.find(p=>p.id===id)));
 b.chartRecords=JSON.parse(JSON.stringify(w.testApp.records.filter(r=>r.patientId===id)));
 b.releaseQueue=JSON.parse(JSON.stringify(s.releaseQueue.filter(r=>r.patientId===id&&r.status==='pending')));
}
if(others!==JSON.stringify(Object.entries(defaults).filter(([id])=>!ids.includes(id))))throw Error('Unrelated patient changed');
fs.writeFileSync(file,'window.SIMULATION_DEFAULTS='+JSON.stringify(defaults)+';\n');
console.log('Updated Carl and Ruth reset headers, records and pending queues. Other collections and patients unchanged.');
}finally{w.close();}
