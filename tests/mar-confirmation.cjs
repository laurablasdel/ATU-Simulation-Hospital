const assert=require('node:assert/strict'),boot=require('./boot.cjs'),clone=x=>JSON.parse(JSON.stringify(x));
const windows=[],tick=()=>new Promise(r=>setImmediate(r));let shared={payload:{},revision:0},offline=false,loseReply=false;
function client(){return {auth:{getSession:async()=>({data:{session:{user:{id:'test'}}}})},from:()=>({select(){return this},eq(){return this},async maybeSingle(){if(offline)throw Error('offline');return {data:clone(shared)};}}),rpc:async(n,a)=>{await tick();if(offline)throw Error('offline');if(a.p_revision!==shared.revision)return {data:false};shared={payload:clone(a.p_payload),revision:shared.revision+1};if(loseReply){loseReply=false;throw Error('reply lost');}return {data:{revision:shared.revision}};},channel:()=>({on(){return this},subscribe(){return this}})};}
function start(config){const w=boot(undefined,config);windows.push(w);w.supabase={createClient:client};return w;}
(async()=>{try{
 const ui=start(),a=ui.testApp;ui.setTabMode('student');a.setPatient('charles-jones');a.setView('mar');ui.renderMAR();
 const p=a.state.patients.find(p=>p.id==='charles-jones'),m=ui.medicationsForPatient(p.id,false).find(m=>m.dose&&m.route&&!m.highAlert&&!ui.medicationAdministrationBlock(m)),pkg=ui.packagesForMedication(m)[0];
 const el=id=>ui.document.getElementById(id);el('marScanPatient').value=p.barcode;el('marScanPatient').dispatchEvent(new ui.KeyboardEvent('keydown',{key:'Enter'}));el('marScanMedication').value=pkg.id;el('marScanMedication').dispatchEvent(new ui.Event('input'));await new Promise(r=>setTimeout(r,300));
 assert(el('marConfirmSave'),'suffixless scanner opens the matching order');assert(el('marConfirmDose').readOnly);assert(el('marConfirmRoute').readOnly);assert.equal(a.state.mar.length,0,'scan is not administration');
 const scheduled={scheduledTime:'09:00'};
 assert.equal(ui.medicationTiming(scheduled,'2026-10-09T08:00').timingStatus,'On time');
 assert.equal(ui.medicationTiming(scheduled,'2026-10-09T10:00').timingStatus,'On time');
 assert.equal(ui.medicationTiming(scheduled,'2026-10-09T07:59').timingStatus,'Early');
 assert.equal(ui.medicationTiming(scheduled,'2026-10-09T10:01').timingStatus,'Late');
 assert.equal(ui.medicationTiming({scheduledTime:'00:15'},'2026-10-08T23:30').timingStatus,'On time');
 for(const due of ['Now','PRN','Continuous','Every 4 hours','On call to OR'])assert.equal(ui.medicationTiming({scheduledTime:due},ui.nowLocal()).timingStatus,'Not scheduled');
 const input={patientId:p.id,medicationId:m.id,method:'barcode',patientBarcode:p.barcode,medicationBarcode:pkg.id,confirmed:true,dose:m.dose,route:m.route,student:'TEST',time:ui.nowLocal(),resetEpoch:0};
 assert(!ui.saveMedicationAdministration({...input,dose:'WRONG'}).ok);assert(!ui.saveMedicationAdministration({...input,route:'WRONG'}).ok);
 el('marScanPatient').value='WRONG';el('marScanPatient').dispatchEvent(new ui.Event('input'));assert(!el('marConfirmSave'));
 shared={payload:clone(a.state),revision:1};
 const config={supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'test'},one=start(config),two=start(config);
 await one.atuCloudInit();await two.atuCloudInit();for(const w of [one,two]){w.setTabMode('student');w.testApp.setPatient(p.id);}
 const results=await Promise.all([one.saveMedicationAdministration({...input,submissionId:'student-one'}),two.saveMedicationAdministration({...input,submissionId:'student-two'})]);
 assert.equal(results.filter(r=>r.ok).length,1,'simultaneous confirmations create exactly one dose: '+JSON.stringify(results));assert.equal(shared.payload.mar.length,1);
 await one.atuCloudPush();await two.atuCloudPush();
 const next={...input,time:'2026-10-10T10:00',repeatConfirmed:true,submissionId:'lost-response'};
 // Use a repeatable test order to isolate persistence from one-time order rules.
 for(const w of [one,two])w.testApp.state.medicationCatalog.find(x=>x.id===m.id).frequency='PRN';
 await one.atuCloudPush();await two.atuCloudPush();
 offline=true;const before=one.testApp.state.mar.length;assert(!(await one.saveMedicationAdministration(next)).ok);assert.equal(one.testApp.state.mar.length,before,'offline failure creates no local record');offline=false;
 loseReply=true;assert(!(await one.saveMedicationAdministration(next)).ok);assert.equal(shared.payload.mar.filter(r=>r.submissionId===next.submissionId).length,1);
 assert((await one.saveMedicationAdministration(next)).ok,'retry recovers acknowledged record');assert.equal(shared.payload.mar.filter(r=>r.submissionId===next.submissionId).length,1,'retry does not duplicate');
 const changed=shared.payload.medicationCatalog.find(x=>x.id===m.id);changed.dose='CHANGED';shared.revision++;
 assert(!(await two.saveMedicationAdministration({...next,submissionId:'stale-dose',time:'2026-10-11T10:00'})).ok,'stale order rejected');
 // Timing flags are saved, and a different timestamp cannot duplicate a scheduled slot.
 await one.atuCloudPush();
 const current=one.testApp.state.medicationCatalog.find(x=>x.id===m.id);current.dose=m.dose;current.scheduledTime='09:00';await one.atuCloudPush();
 const late={...input,time:'2026-10-12T10:01',submissionId:'late-dose',repeatConfirmed:true};
 const lateResult=await one.saveMedicationAdministration(late);assert(lateResult.ok,lateResult.error);assert.equal(lateResult.row.timingStatus,'Late');
 assert(!(await one.saveMedicationAdministration({...late,time:'2026-10-12T10:02',submissionId:'duplicate-slot'})).ok);
 console.log('PASS automatic matching, locked dose/route, scan invalidation, concurrent confirmation, offline failure, lost-response retry and stale-order rejection.');
}finally{await tick();windows.forEach(w=>w.close());}})().catch(e=>{console.error(e);process.exitCode=1;});
