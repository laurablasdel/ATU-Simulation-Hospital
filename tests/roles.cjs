const assert=require('node:assert/strict'),boot=require('./boot.cjs');
// Faculty and two student computers sharing one chart.
const clone=x=>JSON.parse(JSON.stringify(x)),windows=[];
let row={payload:{},revision:0,updated_by:''};
function client(){return {
 auth:{getSession:async()=>({data:{session:{user:{id:'approved-test-user'}}}})},
 from:()=>({select(){return this},eq(){return this},async maybeSingle(){return {data:clone(row)}}}),
 rpc:async(name,args)=>{await new Promise(r=>setImmediate(r));if(args.p_revision!==row.revision)return {data:false};row={payload:clone(args.p_payload),revision:row.revision+1,updated_by:args.p_client};return {data:true}},
 channel:()=>({on(){return this},subscribe(){return this}})
};}
function start(){const w=boot(undefined,{supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'test-public-key'});w.supabase={createClient:client};windows.push(w);return w;}
const ruth='ruth-livingston',icu='chart-25d195d201d581a0a439ec5e6a8a85a4';
const popups=w=>[...w.document.querySelectorAll('.popupOverlay')];
async function syncAll(){for(let i=0;i<2;i++)for(const w of windows)await w.atuCloudPush();}
(async()=>{try{
 const faculty=start(),sim=start(),second=start();
 for(const w of windows)await w.atuCloudInit();
 for(const student of [sim,second]){student.setTabMode('student');student.render();const login=student.document.querySelector('#studentCheckIn form');login.elements.firstName.value='Test';login.elements.lastName.value='Student';login.elements.area.value='Medical Surgical';login.dispatchEvent(new student.Event('submit',{bubbles:true,cancelable:true}));}
 faculty.testApp.setView('faculty');faculty.render();assert(!faculty.document.getElementById('makeObserver'));
 for(const w of windows){w.testApp.setPatient(ruth);w.testApp.setView('summary');w.render();}

 // One release: the simulation student acknowledges it once, even when a shared refresh replaces the chart first.
 faculty.releaseItem(faculty.testApp.state.releaseQueue.find(q=>q.chartRecordId===icu&&q.status==='pending').id);
 await syncAll();
 sim.showNextNotification();sim.showNextNotification();
 assert.equal(popups(sim).length,1,'one release popup at a time');
 faculty.testApp.state.orders.push({id:'unrelated-change',patientId:'charles-jones',text:'Unrelated',status:'Active'});
 await faculty.atuCloudPush();await sim.atuCloudPush();
 second.showNextNotification();assert.equal(popups(second).length,1);
 sim.document.getElementById('ackLivePopup').click();
 await syncAll();
 for(let i=0;i<5;i++){await sim.atuCloudPush();sim.showNextNotification();}
 assert.equal(popups(sim).length,0,'acknowledged once, the release does not come back');
 assert(row.payload.notifications.every(n=>n.read),'acknowledgement reached the shared chart');

 // Acknowledgement clears the matching notice on another student computer.
 second.showNextNotification();assert.equal(popups(second).length,0);
 for(const w of windows){assert(!w.document.querySelector('aside [data-view="sbar"]'));assert.equal(w.renderSBAR,undefined);}
 // Shared refresh must still preserve an active dropdown outside the removed form.
 sim.testApp.setView('orders');sim.render();const dropdown=sim.document.getElementById('oType');dropdown.focus();faculty.testApp.state.orders.push({id:'dropdown-refresh-test',patientId:ruth,text:'Shared update while choosing order type',status:'Active'});await syncAll();assert(dropdown.isConnected);assert.equal(sim.document.activeElement,dropdown);dropdown.blur();
 faculty.resetToBase(ruth);await syncAll();assert(!row.payload.notifications.some(n=>n.patientId===ruth));
 console.log('PASS roles: shared release acknowledgement, two student clients, no observer controls, no SBAR screen, dropdown preservation and reset.');
}finally{windows.forEach(w=>w.close());}})().catch(e=>{console.error(e);process.exitCode=1});
