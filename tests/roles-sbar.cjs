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
 sim.setTabMode('student');
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
 sim.document.getElementById('ackLivePopup').click();
 await syncAll();
 for(let i=0;i<5;i++){await sim.atuCloudPush();sim.showNextNotification();}
 assert.equal(popups(sim).length,0,'acknowledged once, the release does not come back');
 assert(row.payload.notifications.every(n=>n.read),'acknowledgement reached the shared chart');

 // Observers get a notice that closes itself, and nothing to acknowledge.
 for(const o of [obs1,obs2]){o.showNextNotification();assert.equal(popups(o).length,0,'observer is not blocked by releases');assert(o.document.querySelector('.observerToast'),'observer sees the release notice');}

 // Observers browse independently and cannot chart.
 obs1.testApp.setView('flowsheets');obs1.render();obs2.testApp.setView('mar');obs2.render();
 assert.equal(obs1.document.getElementById('observerBar').style.display,'','observer banner shown');assert.equal(faculty.document.getElementById('observerBar').style.display,'none');
 assert([...obs1.document.querySelectorAll('#view input,#view textarea,#view select')].every(el=>el.disabled),'observer fields are read-only');
 const vitals=obs1.testApp.state.vitals.length;obs1.document.querySelector('#view button.primary')?.click();assert.equal(obs1.testApp.state.vitals.length,vitals);
 assert.equal(sim.testApp.state.vitals.length,vitals);
 obs1.testApp.setView('sbar');obs1.render();assert(!obs1.document.getElementById('sbarForm'),'observers cannot send SBAR');

 // SBAR from the simulation room.
 sim.testApp.setView('sbar');sim.render();
 const f=sim.document.getElementById('sbarForm');
 const fill={student:'JS',urgency:'Urgent',situation:'BP 88/50, HR 118',background:'80F POD 5 R hip ORIF',assessment:'Possible sepsis',recommendation:'Request fluid bolus and lactate'};
 for(const [k,v] of Object.entries(fill))f.elements.namedItem(k).value=v;
 f.dispatchEvent(new sim.Event('submit',{bubbles:true,cancelable:true}));
 assert(sim.document.querySelector('#view').textContent.includes('Waiting for provider'));
 await syncAll();
 sim.showNextNotification();assert(!popups(sim).some(p=>p.dataset.alertKind?.startsWith('sbar')),'students are not interrupted by their own SBAR');
 faculty.testApp.setView('faculty');faculty.render();faculty.showNextNotification();
 const fp=popups(faculty).find(p=>p.dataset.alertKind==='sbar-faculty');assert(fp,'faculty get the SBAR popup');
 assert(fp.textContent.includes('Request fluid bolus and lactate'));
 obs2.testApp.setPatient(null);obs2.testApp.setView('patients');obs2.render();
 for(const o of [obs1,obs2]){o.showNextNotification();assert(popups(o).some(p=>p.dataset.alertKind==='sbar-observer'),'observer gets the SBAR popup anywhere in the chart');}
 fp.querySelector('[data-sbar-response]').value='Give 500 mL NS bolus now, recheck BP in 15 minutes.';
 fp.querySelector('[data-accept-sbar]').click();
 await syncAll();
 assert.equal(row.payload.providerNotifications[0].status,'Accepted');
 faculty.showNextNotification();assert.equal(popups(faculty).length,0,'accepted SBAR does not return');
 sim.testApp.setView('summary');sim.render();sim.showNextNotification();
 const resp=popups(sim)[0];assert(resp&&resp.textContent.includes('Give 500 mL NS bolus now'),'student receives the provider response');
 resp.querySelector('#ackLivePopup').click();
 for(const o of [obs1,obs2]){const p=popups(o).find(x=>x.dataset.alertKind==='sbar-observer');p.querySelector('[data-close-sbar]').click();o.showNextNotification();assert.equal(popups(o).length,0,'the SBAR popup is the only thing observers close');}
 await syncAll();
 sim.testApp.setView('sbar');sim.render();assert(sim.document.querySelector('#view').textContent.includes('Accepted by provider'));

 // Reset for a new simulation clears that patient's SBARs.
 faculty.resetToBase(ruth);await syncAll();
 assert(!row.payload.providerNotifications.some(s=>s.patientId===ruth),'reset clears SBARs');
 console.log('PASS roles and SBAR: single acknowledgement across shared refreshes, observer read-only with self-closing notices, SBAR to faculty and observers, provider response, reset.');
}finally{windows.forEach(w=>w.close());}})().catch(e=>{console.error(e);process.exitCode=1});
