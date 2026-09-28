/* Shared persistence uses the existing chart state and save functions. */
(function(){
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function mergeValue(base,local,remote){
 if(equal(local,base))return clone(remote);
 if(equal(remote,base)||equal(local,remote))return clone(local);
 if(Array.isArray(local)&&Array.isArray(remote)&&[...local,...remote,...(base||[])].every(r=>r&&typeof r==='object'&&r.id)){
  const index=rows=>new Map((rows||[]).map(r=>[r.id,r])),b=index(base),l=index(local),r=index(remote),out=[];
  for(const id of new Set([...r.keys(),...l.keys()])){
   if(b.has(id)&&(!l.has(id)||!r.has(id)))continue;
   const row=mergeValue(b.get(id),l.get(id),r.get(id));if(row!==undefined)out.push(row);
  }return out;
 }
 if(local&&remote&&!Array.isArray(local)&&!Array.isArray(remote)&&typeof local==='object'&&typeof remote==='object'){
  const out={};for(const key of new Set([...Object.keys(remote),...Object.keys(local)])){
   const value=mergeValue(base?.[key],local[key],remote[key]);if(value!==undefined)out[key]=value;
  }return out;
 }
 // Unrelated rows/fields merge; the pending local edit wins a same-field conflict.
 return clone(local===undefined?remote:local);
}
function mergeState(base,local,remote){
 const out=mergeValue(base||{},local||{},remote||{}),epochs={...local.patientResetEpochs,...remote.patientResetEpochs};
 for(const pid of Object.keys(epochs)){
  const le=local.patientResetEpochs?.[pid]||0,re=remote.patientResetEpochs?.[pid]||0;if(le===re)continue;
  const newer=le>re?local:remote;out.patientResetEpochs||={};out.patientResetEpochs[pid]=Math.max(le,re);
  for(const key of new Set([...Object.keys(local),...Object.keys(remote)])){
   if(['simulationReports','simulationActivity'].includes(key))continue;
   if(Array.isArray(out[key]))out[key]=out[key].filter(row=>row?.patientId!==pid&&!(key==='patients'&&row?.id===pid)).concat(clone((newer[key]||[]).filter(row=>row?.patientId===pid||(key==='patients'&&row?.id===pid))));
   else if(out[key]&&typeof out[key]==='object'&&pid in out[key])out[key][pid]=clone(newer[key]?.[pid]);
  }
  const ids=new Set([...(local.customChartRecords||[]),...(remote.customChartRecords||[]),...(window.CHART_RECORDS||[])].filter(r=>r.patientId===pid).map(r=>r.id));
  for(const key of ['chartContentEdits','marHiddenRecords'])for(const id of ids){if(newer[key]?.[id]!==undefined){out[key]||={};out[key][id]=clone(newer[key][id]);}else if(out[key])delete out[key][id];}
 }
 // Audit records and completed reports are append-only across resets and older clients.
 for(const key of ['simulationReports','simulationActivity']){const rows=new Map();for(const row of [...(base?.[key]||[]),...(remote?.[key]||[]),...(local?.[key]||[])])if(row?.id&&!rows.has(row.id))rows.set(row.id,clone(row));out[key]=[...rows.values()];}
 return out;
}
window.ATUSharedMerge=mergeState;
window.prioritizeSavedHistory=function(){
 const root=document.getElementById('view');if(!root)return;
 const title={orders:'Order List',assessments:'Assessment History',flowsheets:'Vitals History'}[currentView];if(!title)return;
 const panel=[...root.children].find(p=>p.querySelector(':scope > h2')?.textContent===title);if(panel)root.prepend(panel);
 if(panel&&currentView==='assessments'){
  panel.querySelector('[data-saved-assessments]')?.remove();
  const forms=new Set([...root.querySelectorAll('form[data-record]')].map(f=>f.dataset.record));
  const rows=(state.chartEntries||[]).filter(r=>r.patientId===activePatientId&&forms.has(r.recordId)).slice().reverse();
  if(rows.length){const entries=document.createElement('div');entries.dataset.savedAssessments='true';entries.innerHTML=rows.map(r=>`<details><summary>${esc(r.time)} — ${esc(r.student)} — ${esc(r.shift)}</summary>${r.snapshot||renderEntryValues(r.values||{})}</details>`).join('');panel.querySelector('.body').prepend(entries);}
 }
};
window.initializeSharedSession=function(){
 const checkpointKey=STORAGE_KEY+'_shared_checkpoint';
 let base=null,revision=0,busy=false,pending=false,retryTimer=null,pollTimer=null,localBase=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||clone(state);
 try{const checkpoint=JSON.parse(localStorage.getItem(checkpointKey)||'null');base=checkpoint?.state;revision=checkpoint?.revision||0;}catch{}
 const scope=window.ATU_CONFIG?.sessionId||'simulation-state';
 // User decisions take the next available turn after an in-flight background sync.
 // Reserve the lock before resolving a waiter so polling cannot jump the queue.
 let realtimeConnected=false,lastBackupCheck=0;
 const decisionWaiters=[];
 function acquireDecision(){
  if(!busy){busy=true;return Promise.resolve(true);}
  return new Promise(resolve=>{const waiter={resolve,timer:null};waiter.timer=setTimeout(()=>{const i=decisionWaiters.indexOf(waiter);if(i>=0)decisionWaiters.splice(i,1);resolve(false);},15000);decisionWaiters.push(waiter);});
 }
 function releaseWork(){
  const waiter=decisionWaiters.shift();
  if(waiter){clearTimeout(waiter.timer);busy=true;waiter.resolve(true);return;}
  busy=false;if(pending){pending=false;atuCloudSchedule();}
 }

 const persist=()=>{try{const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(stored&&!equal(stored,localBase))state=mergeState(localBase,state,stored);localStorage.setItem(STORAGE_KEY,JSON.stringify(state));localBase=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||clone(state);}catch(e){atuCloudBadge('NOT SAVED — browser storage is full or unavailable');throw e;}};
 reloadSharedState=function(){const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(stored){state=mergeState(localBase,state,stored);localBase=clone(stored);}};
 const checkpoint=()=>localStorage.setItem(checkpointKey,JSON.stringify({state:base,revision}));
 const oldClear=clearCurrentViewDraft;clearCurrentViewDraft=function(){save();oldClear();};
 const oldRender=render;render=function(){oldRender();prioritizeSavedHistory();};
 const oldOrders=renderOrders;renderOrders=function(){oldOrders();prioritizeSavedHistory();};
 const oldPopup=showNextNotification;showNextNotification=function(){if(!document.querySelector('.popupOverlay'))oldPopup();};
 // Never clear typed data or claim success when a local save fails.
 save=function(){persist();atuCloudBadge(atuCloudReady?'Saved locally • sharing…':'Saved locally • not connected to other computers');atuCloudSchedule();};
 const badge=document.getElementById('saveBadge');
 const connect=document.createElement('button');connect.id='sharedConnection';connect.textContent='Shared connection';connect.className='secondary';badge?.after(connect);
 connect.onclick=()=>{
  if(document.getElementById('sharedLogin'))return;
  const host=document.createElement('div');host.id='sharedLogin';host.className='popupOverlay';
  host.innerHTML='<div class="popupCard"><div class="popupHead"><b>Shared simulation connection</b></div><div class="popupBody"><p id="sharedInfo"></p><label>Email<input id="sharedEmail" type="email" autocomplete="username"></label><label>Password<input id="sharedPassword" type="password" autocomplete="current-password"></label><p id="sharedFeedback" role="status"></p></div><div class="popupActions"><button id="sharedSignIn">Connect</button><button id="sharedRetry">Retry connection</button><button id="sharedClose">Close</button></div></div>';
  document.body.append(host);host.querySelector('#sharedEmail').value='Atusim1@atu.edu';host.querySelector('#sharedInfo').textContent=ATU_SUPABASE_URL?'Use your approved simulation account on both computers. Simulation: '+scope:'The hospital’s shared project has not been configured yet. Chart entries are saved in this browser.';
  host.querySelector('#sharedClose').onclick=()=>host.remove();
  host.querySelector('#sharedRetry').onclick=()=>atuCloudInit();
  host.querySelector('#sharedSignIn').onclick=async()=>{try{if(!atuSupabase)throw Error('Configure the hospital project first.');const {error}=await atuSupabase.auth.signInWithPassword({email:host.querySelector('#sharedEmail').value.trim(),password:host.querySelector('#sharedPassword').value});host.querySelector('#sharedPassword').value='';if(error)throw error;await atuCloudInit();host.querySelector('#sharedFeedback').textContent=atuCloudReady?'Connected.':'Signed in; check your simulation membership or connection.';}catch(e){host.querySelector('#sharedFeedback').textContent=e.message;}};
 };
 let renderedState='',renderedEpoch=state.patientResetEpochs?.[activePatientId]||0;
 const refresh=()=>{
  window.auditSharedStateReceived?.();
  const snapshot=JSON.stringify(state),epoch=state.patientResetEpochs?.[activePatientId]||0;
  const editingControl=document.activeElement?.matches('#view input,#view textarea,#view select');
  if(snapshot!==renderedState&&(!editingControl||epoch!==renderedEpoch)){window.refreshSimulationRecords?.();applyMode();window.simRefreshFromShared?.();renderedState=JSON.stringify(state);renderedEpoch=epoch;}
  updateNotificationCount();showNextNotification();
 };
 async function read(){const {data,error}=await atuSupabase.from('ehr_sync').select('payload,revision,updated_by').eq('collection','app').eq('item_id',scope).maybeSingle();if(error)throw error;return data;}
 // Approving and consuming a one-dose authorization must win the shared revision
 // before reporting success. Offline or stale clients cannot spend an approval twice.
 window.commitMedicationOverrideAction=async function(action,id,values,expected){
  const fail=error=>({ok:false,error});
  if(!atuCloudReady||!atuSupabase)return fail('Connect to the shared simulation before approving or using a provider override.');
  if(action==='decision'?!isFaculty():getTabMode()!=='student')return fail('This action is not available in this mode.');
  if(action==='decision'&&(!['Approved','Denied'].includes(values.status)||!String(values.provider||'').trim()||values.status==='Approved'&&(!String(values.medication||'').trim()||!String(values.dose||'').trim()||!String(values.route||'').trim())))return fail('Enter the provider, medication, dose and route before approving.');
  if(!await acquireDecision())return fail('The shared connection is taking too long to respond. Your decision has not been submitted. Check the connection and try again.');
  try{
   if(!atuCloudReady||!atuSupabase)throw Error('The shared connection was lost. Reconnect before submitting the decision.');
   for(let attempt=0;attempt<5;attempt++){
    const remote=await read();
    if(action==='decision'?!isFaculty():getTabMode()!=='student')throw Error('The device mode changed. Return to the correct mode and try again.');if(!remote)throw Error('The shared simulation could not be found.');
    const request=(remote.payload.medicationOverrides||[]).find(r=>r.id===id);
    if(!request)throw Error('This request is not yet shared or was reset. Wait for synchronization and scan again.');
    if(request.resetEpoch!==(remote.payload.patientResetEpochs?.[request.patientId]||0)||request.resetEpoch!==(state.patientResetEpochs?.[request.patientId]||0))throw Error('This simulation was reset. The authorization is no longer valid.');
    if(action==='decision'&&request.status!=='Pending')throw Error('Another faculty member has already handled this request.');
    if(action==='consume'&&(request.status!=='Approved'||(remote.payload.mar||[]).some(m=>m.overrideId===id)))throw Error('This approval is no longer available; it may already have been used.');
    if(action==='consume'&&['barcode','medication','dose','route','highAlert','decidedAt','provider'].some(k=>request[k]!==expected[k]))throw Error('The approval changed. Scan again and review the current authorization.');
    if(action==='consume'&&(activePatientId!==request.patientId||!patientWristbandMatches(request.patientId,values.patientBarcode)))throw Error('Wrong patient. Scan the current patient wristband again.');
    const sent=clone(state),merged=mergeState(base||{},sent,remote.payload),target=(merged.medicationOverrides||[]).find(r=>r.id===id);
    if((merged.patientResetEpochs?.[request.patientId]||0)!==request.resetEpoch)throw Error('The patient was reset. Request a new authorization.');
    const at=nowLocal(),actor=action==='decision'?values.provider:(window.studentSession?.()?.name||values.student),type=action==='decision'?'Medication override '+values.status.toLowerCase():'Medication administration';
    if(action==='decision'){
     Object.assign(target,values,{decidedAt:at});
     merged.notifications||=[];merged.notifications.push({id:'override-decision:'+id,patientId:request.patientId,createdAt:at,type:'medication-override',title:'Provider override '+values.status.toLowerCase(),body:values.status==='Approved'?`${values.medication}: ${values.dose} ${values.route}. One administration authorized by ${values.provider}. Scan the patient and medication again to continue.${values.decisionNotes?' '+values.decisionNotes:''}`:`Request for ${request.barcode} denied by ${values.provider}.${values.decisionNotes?' '+values.decisionNotes:''}`,read:false});
    }else{
     if((merged.mar||[]).some(m=>m.overrideId===id))throw Error('This approval has already been used.');
     merged.mar||=[];merged.mar.push(clone(values));Object.assign(target,{status:'Used',usedAt:at,administrationId:values.id});
    }
    const detail=action==='decision'?`${request.barcode}: ${values.status} by ${actor}. ${values.decisionNotes||''}`:`${values.medication} ${values.dose} ${values.route} given by ${values.student}; one-dose approval ${id}`;
    merged.audit||=[];merged.audit.push({id:uid('audit'),patientId:request.patientId,at,type,details:detail,actor,role:getTabMode()});
    merged.simulationActivity||=[];merged.simulationActivity.push({id:uid('activity'),patientId:request.patientId,simulationId:request.patientId+':'+(request.resetEpoch||'initial'),at:new Date().toISOString(),actor,role:getTabMode(),group:window.studentSession?.()?.group||'',type,details:detail,collection:action==='consume'?'mar':'medicationOverrides',recordId:action==='consume'?values.id:id,record:clone(action==='consume'?values:target)});
    const {data,error}=await atuSupabase.rpc('save_simulation_state',{p_session:scope,p_revision:remote.revision,p_payload:merged,p_client:ATU_CLOUD_CLIENT});if(error)throw error;if(!data)continue;
    state=mergeState(sent,state,merged);base=clone(merged);revision=remote.revision+1;
    // The cloud commit is durable even if the browser cannot cache its result.
    try{persist();checkpoint();}catch(e){atuCloudBadge('Saved to shared chart; browser storage unavailable');}
    window.auditSharedStateReceived?.();updateNotificationCount();
    return {ok:true,row:action==='consume'?values:target};
   }
   return fail('The shared chart is busy. Nothing was changed; try again.');
  }catch(e){return fail(e.message||'Unable to reach the provider. Try again.');}
  finally{releaseWork();}
 };
 async function exchange(){
  if(!atuCloudReady||busy){pending=true;return;}busy=true;
  try{
   for(let attempt=0;attempt<5;attempt++){
    // Idle devices check only the revision, avoiding repeated downloads of the whole chart.
    if(base&&equal(state,base)){
     const {data:head,error}=await atuSupabase.from('ehr_sync').select('revision,updated_by').eq('collection','app').eq('item_id',scope).maybeSingle();if(error)throw error;
     if(head&&head.revision===revision){refresh();break;}
    }
    const row=await read();if(!row)throw Error('No simulation session is assigned to this account.');
    if(!base&&row.revision>0){
     // Keep pre-connection documentation. Joining must not behave like a patient reset.
     localStorage.setItem(STORAGE_KEY+'_before_first_join',JSON.stringify(state));
     saveCurrentViewDraft();
     const incoming=clone(row.payload),localEntries={...incoming};
     for(const key of ['medicationPackages','orders','assessments','vitals','io','notes','labs','mar','glucoseChecks','laborProgress','postpartumRecovery','pphPads','pphMedications','bloodAdministration','surgicalChecklist','surgicalAssessments','chartEntries','pewsAssessments','messages','notifications','providerNotifications','medicationOverrides','audit','simulationActivity','simulationReports'])localEntries[key]=clone(state[key]||[]);
     localEntries.patientResetEpochs=clone(state.patientResetEpochs||{});
     state=mergeState({},localEntries,incoming);base=clone(row.payload);revision=row.revision;persist();checkpoint();refresh();
    }
    const sent=clone(state),merged=mergeState(base||{},sent,row.payload||{});
    if(equal(merged,row.payload)){base=clone(row.payload);revision=row.revision;state=mergeState(sent,state,merged);persist();checkpoint();refresh();break;}
    const {data,error}=await atuSupabase.rpc('save_simulation_state',{p_session:scope,p_revision:row.revision,p_payload:merged,p_client:ATU_CLOUD_CLIENT});if(error)throw error;
    if(!data){if(attempt===4)throw Error('The shared chart is busy. Changes remain saved locally and will retry.');continue;}
    saveCurrentViewDraft();state=mergeState(sent,state,merged);base=clone(merged);revision=row.revision+1;persist();checkpoint();refresh();
    if(!equal(state,base))pending=true;break;
   }
   atuCloudBadge('Shared: connected • saved');
  }catch(e){console.error('Shared simulation sync',e);atuCloudBadge('Saved locally • shared connection unavailable');document.getElementById('sharedFeedback')&&(document.getElementById('sharedFeedback').textContent=e.message);clearTimeout(retryTimer);retryTimer=setTimeout(()=>exchange(),10000);}
  finally{releaseWork();}
 }
 atuCloudPush=exchange;atuCloudPull=exchange;
 atuCloudReceive=()=>exchange();
 atuCloudSchedule=function(){if(!atuCloudReady)return;clearTimeout(atuCloudTimer);atuCloudTimer=setTimeout(exchange,150);};
 atuCloudInit=async function(){
  if(!ATU_SUPABASE_URL||!ATU_SUPABASE_KEY){atuCloudBadge('Saved locally • shared project not configured');return;}
  try{
   if(!window.supabase?.createClient)throw Error('Connection library unavailable.');
   atuSupabase||=window.supabase.createClient(ATU_SUPABASE_URL,ATU_SUPABASE_KEY);
   const {data,error}=await atuSupabase.auth.getSession();if(error)throw error;
   if(!data.session){atuCloudReady=false;atuCloudBadge('Saved locally • sign in to share across computers');return;}
   atuCloudReady=true;
   if(!atuCloudChannel)atuCloudChannel=atuSupabase.channel('hospital-'+scope).on('postgres_changes',{event:'UPDATE',schema:'public',table:'ehr_sync',filter:'item_id=eq.'+scope},event=>{if(event?.new?.revision===revision&&equal(state,base))return;exchange();}).subscribe(status=>{realtimeConnected=status==='SUBSCRIBED';if(realtimeConnected)exchange();});
   clearInterval(pollTimer);pollTimer=setInterval(()=>{
    // Realtime carries releases and messages immediately. Poll only as a recovery check.
    const interval=document.visibilityState==='hidden'?120000:(realtimeConnected?30000:15000);
    if(Date.now()-lastBackupCheck<interval)return;
    lastBackupCheck=Date.now();exchange();
   },5000);lastBackupCheck=Date.now();await exchange();
  }catch(e){atuCloudReady=false;atuCloudBadge('Saved locally • connection setup needed');console.error(e);}
 };
 const resume=()=>{if(atuCloudReady)exchange();else atuCloudInit();};
 window.addEventListener('online',resume);window.addEventListener('focus',resume);window.addEventListener('pageshow',e=>{if(e.persisted)resume();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resume();});
 const previousMode=setTabMode;setTabMode=function(mode){previousMode(mode);if(atuCloudReady)atuCloudSchedule();};

};
})();

