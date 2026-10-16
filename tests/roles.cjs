const assert=require('node:assert/strict'),boot=require('./boot.cjs');
// Control room (faculty), simulation room (student) and two debrief laptops (observers) sharing one chart.
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
 const faculty=start(),sim=start(),obs1=start(),obs2=start();
 for(const w of windows)await w.atuCloudInit();
 sim.setTabMode('student');sim.render();
 const login=sim.document.querySelector('#studentCheckIn form');login.elements.firstName.value='Test';login.elements.lastName.value='Student';login.elements.area.value='Medical Surgical';login.dispatchEvent(new sim.Event('submit',{bubbles:true,cancelable:true}));
 for(const o of [obs1,obs2]){o.testApp.setView('faculty');o.render();o.document.getElementById('makeObserver').click();assert.equal(o.getTabMode(),'observer');}
 assert.equal(obs1.document.getElementById('modeBadge').textContent,'Observer Mode • view only');
 for(const w of windows){w.testApp.setPatient(ruth);w.testApp.setView('summary');w.render();}

 // One release: the simulation student acknowledges it once, even when a shared refresh replaces the chart first.
 faculty.releaseItem(faculty.testApp.state.releaseQueue.find(q=>q.chartRecordId===icu&&q.status==='pending').id);
 await syncAll();
 sim.showNextNotification();sim.showNextNotification();
 assert.equal(popups(sim).length,1,'one release popup at a time');
 faculty.testApp.state.orders.push({id:'unrelated-change',patientId:'charles-jones',text:'Unrelated',status:'Active'});
 await faculty.atuCloudPush();await sim.atuCloudPush();
 for(const o of [obs1,obs2]){o.showNextNotification();assert(o.document.querySelector('.observerToast'));assert(!o.document.querySelector('.toastClose'),'observers cannot dismiss');o.testApp.setView('inbox');o.render();assert(o.testApp.state.notifications.some(n=>!n.read),'observer inbox cannot acknowledge');}
 sim.document.getElementById('ackLivePopup').click();
 await syncAll();
 for(let i=0;i<5;i++){await sim.atuCloudPush();sim.showNextNotification();}
 assert.equal(popups(sim).length,0,'acknowledged once, the release does not come back');
 assert(row.payload.notifications.every(n=>n.read),'acknowledgement reached the shared chart');

 // Student acknowledgement removes the notice from every observer.
 for(const o of [obs1,obs2]){o.showNextNotification();assert.equal(popups(o).length,0);assert(!o.document.querySelector('.observerToast'));}

 // Observers browse independently and cannot chart.
 obs1.testApp.setView('flowsheets');obs1.render();obs2.testApp.setView('mar');obs2.render();
 assert.equal(obs1.document.getElementById('observerBar').style.display,'','observer banner shown');assert.equal(faculty.document.getElementById('observerBar').style.display,'none');
 assert([...obs1.document.querySelectorAll('#view input,#view textarea,#view select')].every(el=>el.disabled),'observer fields are read-only');
 const vitals=obs1.testApp.state.vitals.length;obs1.document.querySelector('#view button.primary')?.click();assert.equal(obs1.testApp.state.vitals.length,vitals);
 assert.equal(sim.testApp.state.vitals.length,vitals);
 for(const w of windows){assert(!w.document.querySelector('aside [data-view="sbar"]'));assert.equal(w.renderSBAR,undefined);}
 // Shared refresh must still preserve an active dropdown outside the removed form.
 sim.testApp.setView('orders');sim.render();const dropdown=sim.document.getElementById('oType');dropdown.focus();faculty.testApp.state.orders.push({id:'dropdown-refresh-test',patientId:ruth,text:'Shared update while choosing order type',status:'Active'});await syncAll();assert(dropdown.isConnected);assert.equal(sim.document.activeElement,dropdown);dropdown.blur();
 faculty.resetToBase(ruth);await syncAll();assert(!row.payload.notifications.some(n=>n.patientId===ruth));
 console.log('PASS roles: shared release acknowledgement, observer read-only views, no SBAR screen, dropdown preservation and reset.');
}finally{windows.forEach(w=>w.close());}})().catch(e=>{console.error(e);process.exitCode=1});
