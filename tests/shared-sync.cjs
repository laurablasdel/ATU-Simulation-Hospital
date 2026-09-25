const assert=require('node:assert/strict'),boot=require('./boot.cjs');
const clone=x=>JSON.parse(JSON.stringify(x)),windows=[];
let row={payload:{},revision:0,updated_by:''},writes=0,conflicts=0;
function client(){return {
 auth:{getSession:async()=>({data:{session:{user:{id:'approved-test-user'}}}})},
 from:()=>({select(){return this},eq(){return this},async maybeSingle(){return {data:clone(row)}}}),
 rpc:async(name,args)=>{assert.equal(name,'save_simulation_state');await new Promise(r=>setImmediate(r));if(args.p_revision!==row.revision){conflicts++;return {data:false}}row={payload:clone(args.p_payload),revision:row.revision+1,updated_by:args.p_client};writes++;return {data:true}},
 channel:()=>({on(){return this},subscribe(){return this}})
};}
function start(){const w=boot(undefined,{supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'test-public-key'});w.supabase={createClient:client};windows.push(w);return w;}
(async()=>{try{
 const faculty=start(),student=start();await faculty.atuCloudInit();student.testApp.state.vitals.push({id:'before-connection',patientId:'ruth-livingston',hr:'88'});await student.atuCloudInit();assert(student.testApp.state.vitals.some(x=>x.id==='before-connection'),'Joining preserves earlier local charting');
 student.sessionStorage.setItem('atuEhrTabMode','student');student.testApp.setPatient('charles-jones');student.testApp.setView('flowsheets');student.render();
 const field=student.document.getElementById('vComments');field.value='Unfinished bedside entry';field.dispatchEvent(new student.Event('input',{bubbles:true}));
 faculty.testApp.state.orders.push({id:'faculty-new',patientId:'charles-jones',text:'Assess patient',status:'Active'});
 faculty.testApp.state.messages.push({id:'faculty-message',patientId:'charles-jones',message:'Please reassess',read:false});
 faculty.testApp.state.notifications.push({id:'faculty-notification',patientId:'charles-jones',title:'Faculty Message',body:'Please reassess',read:false});
 student.testApp.state.vitals.push({id:'student-new',patientId:'charles-jones',hr:'90',student:'QA'});
 await Promise.all([faculty.atuCloudPush(),student.atuCloudPush()]);await faculty.atuCloudPush();await student.atuCloudPush();
 for(const w of windows){assert(w.testApp.state.orders.some(x=>x.id==='faculty-new'));assert(w.testApp.state.vitals.some(x=>x.id==='student-new'));assert(w.testApp.state.messages.some(x=>x.id==='faculty-message'));}
 assert(student.document.querySelector('.popupOverlay'),'Student receives faculty alert while charting');assert.equal(student.document.getElementById('vComments').value,'Unfinished bedside entry');assert(conflicts>0,'Concurrent write retried');
 faculty.resetToBase('charles-jones');await faculty.atuCloudPush();student.testApp.state.vitals.push({id:'stale-offline',patientId:'charles-jones',hr:'100'});await student.atuCloudPush();assert(!row.payload.vitals.some(x=>['student-new','stale-offline'].includes(x.id)),'Reset prevents stale work resurrection');
 assert(writes>0);console.log('PASS separate-client shared sync: concurrent order/vitals saves, conflict retry, message and alert delivery during a draft, draft preservation, reset propagation.');
}finally{windows.forEach(w=>w.close());}})().catch(e=>{console.error(e);process.exitCode=1});
