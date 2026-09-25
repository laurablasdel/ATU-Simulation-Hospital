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
   if(Array.isArray(out[key]))out[key]=out[key].filter(row=>row?.patientId!==pid&&!(key==='patients'&&row?.id===pid)).concat(clone((newer[key]||[]).filter(row=>row?.patientId===pid||(key==='patients'&&row?.id===pid))));
   else if(out[key]&&typeof out[key]==='object'&&pid in out[key])out[key][pid]=clone(newer[key]?.[pid]);
  }
  const ids=new Set([...(local.customChartRecords||[]),...(remote.customChartRecords||[]),...(window.CHART_RECORDS||[])].filter(r=>r.patientId===pid).map(r=>r.id));
  for(const key of ['chartContentEdits','marHiddenRecords'])for(const id of ids){if(newer[key]?.[id]!==undefined){out[key]||={};out[key][id]=clone(newer[key][id]);}else if(out[key])delete out[key][id];}
 }return out;
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
  document.body.append(host);host.querySelector('#sharedInfo').textContent=ATU_SUPABASE_URL?'Use your approved simulation account on both computers. Simulation: '+scope:'The hospital’s shared project has not been configured yet. Chart entries are saved in this browser.';
  host.querySelector('#sharedClose').onclick=()=>host.remove();
  host.querySelector('#sharedRetry').onclick=()=>atuCloudInit();
  host.querySelector('#sharedSignIn').onclick=async()=>{try{if(!atuSupabase)throw Error('Configure the hospital project first.');const {error}=await atuSupabase.auth.signInWithPassword({email:host.querySelector('#sharedEmail').value.trim(),password:host.querySelector('#sharedPassword').value});host.querySelector('#sharedPassword').value='';if(error)throw error;await atuCloudInit();host.querySelector('#sharedFeedback').textContent=atuCloudReady?'Connected.':'Signed in; check your simulation membership or connection.';}catch(e){host.querySelector('#sharedFeedback').textContent=e.message;}};
 };
 const refresh=()=>{window.refreshSimulationRecords?.();applyMode();window.simRefreshFromShared?.();updateNotificationCount();if(!isFaculty())showNextNotification();};
 async function read(){const {data,error}=await atuSupabase.from('ehr_sync').select('payload,revision,updated_by').eq('collection','app').eq('item_id',scope).maybeSingle();if(error)throw error;return data;}
 async function exchange(){
  if(!atuCloudReady||busy){pending=true;return;}busy=true;
  try{
   for(let attempt=0;attempt<5;attempt++){
    const row=await read();if(!row)throw Error('No simulation session is assigned to this account.');
    if(!base&&row.revision>0){
     // Keep pre-connection documentation. Joining must not behave like a patient reset.
     localStorage.setItem(STORAGE_KEY+'_before_first_join',JSON.stringify(state));
     saveCurrentViewDraft();
     const incoming=clone(row.payload),localEntries={...incoming};
     for(const key of ['orders','assessments','vitals','io','notes','labs','mar','glucoseChecks','laborProgress','postpartumRecovery','pphPads','pphMedications','bloodAdministration','surgicalChecklist','surgicalAssessments','chartEntries','pewsAssessments','messages','notifications','audit'])localEntries[key]=clone(state[key]||[]);
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
  finally{busy=false;if(pending){pending=false;atuCloudSchedule();}}
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
   if(!atuCloudChannel)atuCloudChannel=atuSupabase.channel('hospital-'+scope).on('postgres_changes',{event:'UPDATE',schema:'public',table:'ehr_sync',filter:'item_id=eq.'+scope},()=>exchange()).subscribe(status=>{if(status==='SUBSCRIBED')exchange();});
   clearInterval(pollTimer);pollTimer=setInterval(exchange,5000);await exchange();
  }catch(e){atuCloudReady=false;atuCloudBadge('Saved locally • connection setup needed');console.error(e);}
 };
 window.addEventListener('online',()=>atuCloudInit());
};
})();
