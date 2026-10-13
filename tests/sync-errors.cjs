const assert=require('node:assert/strict'),boot=require('./boot.cjs'),clone=x=>JSON.parse(JSON.stringify(x));
const windows=[],tick=()=>new Promise(r=>setImmediate(r));
(async()=>{try{
 const seed=boot();windows.push(seed);let row={payload:clone(seed.testApp.state),revision:1},failure=null,authCallback,writes=0;
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'test'}}}}),onAuthStateChange:callback=>{authCallback=callback;}},
  from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>failure?{error:failure}:{data:clone(row)}}),
  rpc:async(name,args)=>{if(failure)return {error:failure};writes++;row={payload:clone(args.p_payload),revision:row.revision+1};return {data:{revision:row.revision}};},channel:()=>({on(){return this;},subscribe(){return this;}})};
 const w=boot(undefined,{supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'test'});windows.push(w);w.supabase={createClient:()=>client};await w.atuCloudInit();
 const text=id=>w.document.getElementById(id).textContent;
 failure={code:'42501',message:'permission denied for table ehr_sync'};w.testApp.state.notes.push({id:'denied-note',patientId:'charles-jones',narrative:'Keep through denied writes'});w.save();await w.atuCloudPush();
 assert.match(text('chartSaveNotice'),/Access denied/);assert.match(text('chartSaveNotice'),/do not clear browser data/);assert.match(text('saveBadge'),/NOT shared/);assert(!row.payload.notes.some(r=>r.id==='denied-note'));assert(JSON.parse(w.localStorage.getItem('atuSimulationHospitalEHRv1')).notes.some(r=>r.id==='denied-note'));
 failure={code:'PGRST303',message:'JWT expired'};await w.atuCloudPush();assert.match(text('chartSaveNotice'),/sign-in expired/);
 failure=null;await w.atuCloudPush();assert(row.payload.notes.some(r=>r.id==='denied-note'));assert.match(text('saveBadge'),/connected.*saved/);
 w.showChartSaveNotice('MAR not confirmed. Retry the same submission.');await w.atuCloudPush();assert.match(text('chartSaveNotice'),/MAR not confirmed/,'background sync cannot hide a failed MAR confirmation');
 authCallback('SIGNED_OUT',null);const before=writes;w.testApp.state.notes.push({id:'signed-out-note',patientId:'charles-jones'});w.save();await w.atuCloudPush();assert.equal(writes,before);assert.match(text('saveBadge'),/not connected/);
 await w.atuCloudInit();assert(row.payload.notes.some(r=>r.id==='signed-out-note'));
 const original=w.Storage.prototype.setItem;w.testApp.state.notes.push({id:'quota-note',patientId:'charles-jones'});w.Storage.prototype.setItem=()=>{throw Error('QuotaExceededError');};await w.atuCloudPush();assert.match(text('saveBadge'),/NOT SAVED/);w.Storage.prototype.setItem=original;
 // A cached config without the new flag must still use record RPCs, not ehr_sync.
 const record=boot(undefined,{supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'test'});windows.push(record);delete record.ATU_CONFIG.recordSync;
 const payload=clone(record.testApp.state),records=[...record.ATURecordCodec.encode(payload).values()].map(x=>({...x,deleted:false}));const calls=[];
 record.supabase={createClient:()=>({auth:client.auth,channel:client.channel,from(table){assert.equal(table,'ehr_sync_heads');return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{revision:5}})};},rpc:async(name,args)=>{calls.push(name);if(name==='read_simulation_changes')return {data:{records,revision:5,updated_by:'seed'}};assert.equal(name,'save_simulation_changes');return {data:{ok:true,revision:6}};}})};
 await record.atuCloudInit();assert(calls.includes('read_simulation_changes'));assert(!calls.includes('save_simulation_state'));
 console.log('PASS denied writes and expired JWT feedback, retained local entries, recovery, sign-out suspension, storage failure, MAR error visibility and cached-config record transport.');
}finally{await tick();windows.forEach(w=>w.close());}})().catch(e=>{console.error(e);process.exitCode=1;});
