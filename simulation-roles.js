/* Device roles (student, observer, faculty), release alerts.
   Observer: debrief-room laptops. View-only, independent navigation, non-blocking alerts that remain until Student Mode acknowledges them. Open with ?mode=observer or choose Observer Mode in Faculty Mode. */
(function(){
const OBSERVER='observer';
const roleKey=()=>STORAGE_KEY+'_device_role';
const isObserver=()=>getTabMode()===OBSERVER;
window.isObserver=isObserver;

// Device role: the tab's mode wins; an observer laptop stays an observer after its browser is reopened.
function installModes(){
 const baseGet=getTabMode,baseSet=setTabMode;
 getTabMode=function(){if(sessionStorage.getItem(TAB_MODE_KEY))return baseGet();try{if(localStorage.getItem(roleKey())===OBSERVER)return OBSERVER}catch{}return baseGet();};
 setTabMode=function(mode){baseSet(mode);try{if(mode===OBSERVER)localStorage.setItem(roleKey(),OBSERVER);else if(mode==='student')localStorage.removeItem(roleKey());}catch{}};
 if(new URLSearchParams(location.search).get('mode')===OBSERVER)setTabMode(OBSERVER);
 // Faculty turn a debrief-room computer into an observer from Faculty Live Control.
 const baseFaculty=renderFaculty;
 renderFaculty=function(...args){
  baseFaculty(...args);
  const view=document.getElementById('view');if(!isFaculty()||!view||view.querySelector('#makeObserver'))return;
  const link=location.origin+location.pathname+'?mode=observer';
  view.insertAdjacentHTML('beforeend',panel('This Computer’s Role',`<p class="note">Debrief-room computers can be set to <b>Observer Mode</b>: students there can open any part of the chart on their own, cannot chart, see every student alert until a student acknowledges it. The faculty PIN is needed to leave Observer Mode.</p><div class="actions"><button id="makeObserver" class="secondary">Make this computer an Observer (debrief room)</button></div><p class="note">Or open this link on the debrief computer: <code>${esc(link)}</code></p>`));
  view.querySelector('#makeObserver').onclick=()=>{if(!confirm('Switch this computer to Observer Mode? Observers can view the chart but cannot chart. The faculty PIN is needed to leave.'))return;saveCurrentViewDraft();setTabMode(OBSERVER);startObserving();currentView='patients';applyMode();render();};
 };
 const main=document.getElementById('view');
 if(main&&!document.getElementById('observerBar'))main.insertAdjacentHTML('beforebegin','<div id="observerBar" class="note observerBanner" style="display:none">Observer view — read only. You can open any part of the chart; charting is done in the simulation room.</div>');
 const baseApply=applyMode;
 applyMode=function(){
  baseApply();
  const observer=isObserver(),badge=document.getElementById('modeBadge'),toggle=document.getElementById('toggleMode'),bar=document.getElementById('observerBar');
  if(observer){if(badge)badge.textContent='Observer Mode • view only';if(toggle)toggle.textContent='Faculty Mode';}
  if(bar)bar.style.display=observer?'':'none';
  document.body.classList.toggle('observerMode',observer);
  if(observer)lockView();
 };
}

// Observers can read everything they could as a student but cannot change the chart.
const allowedButton=el=>el.matches('.openPatient,.levelTab,[data-observer-ok]');
function lockView(){
 const view=document.getElementById('view');if(!view||!isObserver())return;
 view.querySelectorAll('input,textarea,select').forEach(el=>{el.disabled=true;});
 view.querySelectorAll('button').forEach(el=>{if(!allowedButton(el))el.disabled=true;});
}
function installObserverLock(){
 const view=document.getElementById('view');
 if(view)new MutationObserver(()=>{try{if(isObserver())lockView();}catch{/* page already closed */}}).observe(view,{childList:true,subtree:true});
 const block=e=>{if(!isObserver())return;const t=e.target;if(e.type==='submit'||(t.closest?.('#view button')&&!allowedButton(t.closest('#view button')))){e.preventDefault();e.stopImmediatePropagation();}};
 document.addEventListener('submit',block,true);document.addEventListener('click',block,true);
}

// Joining observers see outstanding alerts, including those sent before joining.
function startObserving(){}

function overlay(kind,id,html){
 const host=document.createElement('div');host.className='popupOverlay';host.dataset.alertKind=kind;host.dataset.alertId=id;host.innerHTML=`<div class="popupCard">${html}</div>`;
 document.body.appendChild(host);return host;
}
const patientName=id=>state.patients.find(p=>p.id===id)?.name||'';
// One student popup at a time; acknowledgement is shared by every connected computer.
function showStudentAlert(){
 const n=(state.notifications||[]).find(x=>!x.read&&(!x.patientId||x.patientId===activePatientId));
 if(!n)return;
 const patient=state.patients.find(p=>p.id===n.patientId);
 const host=overlay('release',n.id,`<div class="popupHead"><b>${esc(n.title)}</b></div>
  <div class="popupBody"><div class="note">${patient?`Patient: <b>${esc(patient.name)}</b><br>`:''}Released: ${esc(n.createdAt)}</div><div style="font-size:16px;margin-top:12px">${esc(n.body)}</div></div>
  <div class="popupActions"><button id="ackLivePopup" class="primary">Acknowledge</button></div>`);
 host.querySelector('#ackLivePopup').onclick=()=>{
  if(getTabMode()!=='student')return;
  // Update the current chart, not the copy this popup was built from; a shared refresh may have replaced it.
  const current=(state.notifications||[]).find(x=>x.id===n.id);if(current){current.read=true;current.acknowledgedAt=nowLocal();current.acknowledgedBy=window.studentSession?.()?.name||'Student';}
  if(n.type==='message'){const m=(state.messages||[]).find(x=>x.releaseItemId===n.releaseItemId)||(state.messages||[]).find(x=>x.patientId===n.patientId&&(x.message===n.body||x.subject===n.body));if(m)m.read=true;}
  host.remove();save();updateNotificationCount();setTimeout(showNextNotification,120);
 };
}

// Read-only notices mirror shared student acknowledgements; never expire locally.
function showObserverToasts(){
 let stack=document.getElementById('observerToasts');
 if(!isObserver()){stack?.remove();return;}
 const pending=(state.notifications||[]).filter(n=>!n.read);
 if(!pending.length){stack?.remove();return;}
 if(!stack){stack=document.createElement('div');stack.id='observerToasts';stack.setAttribute('aria-label','Student alerts awaiting acknowledgement');document.body.appendChild(stack);}
 stack.innerHTML=pending.map(n=>`<div class="observerToast" role="status" data-notification-id="${esc(n.id)}"><b>${esc(n.title)}</b><div class="note">${esc(patientName(n.patientId))}</div><div>${esc(n.body)}</div><small>Waiting for student acknowledgement</small></div>`).join('');
}
// Close popups that another computer already handled.
function closeStalePopups(){
 for(const host of document.querySelectorAll('.popupOverlay[data-alert-kind]')){
  const id=host.dataset.alertId,kind=host.dataset.alertKind;
  const stale=kind==='release'?(isFaculty()||isObserver()||!(state.notifications||[]).some(x=>x.id===id&&!x.read))
   :kind==='medication-override'?(!isFaculty()||(state.medicationOverrides||[]).find(r=>r.id===id)?.status!=='Pending')
   :false;
  // Keep a faculty popup open while its response is being typed.
  if(stale)host.remove();
 }
}
function showAlerts(){
 closeStalePopups();showObserverToasts();
 if(document.querySelector('.popupOverlay'))return;
 if(isFaculty()){window.showMedicationOverrideApproval?.();}else if(!isObserver())showStudentAlert();
}

window.initializeSimulationRoles=function(){
 document.head.insertAdjacentHTML('beforeend',`<style>
  #observerToasts{position:fixed;top:78px;right:16px;z-index:4000;display:flex;flex-direction:column;gap:8px;max-width:min(360px,calc(100vw - 32px));max-height:70vh;overflow:auto}
  .observerToast{background:#fff;border-left:5px solid var(--gold,#c9a227);box-shadow:0 6px 20px #0004;border-radius:6px;padding:10px 30px 10px 12px;position:relative}
  .observerToast .toastClose{position:absolute;top:4px;right:6px;border:0;background:none;font-size:18px;cursor:pointer;padding:0 4px}
  .observerBanner{background:#fff7dc;border:1px solid #e6cf7a;padding:8px 10px;border-radius:6px;margin-bottom:10px}
  body.observerMode #view input:disabled,body.observerMode #view textarea:disabled,body.observerMode #view select:disabled{background:#f1f3f4;color:#555;cursor:not-allowed}
  body.observerMode #view button:disabled{opacity:.45;cursor:not-allowed}
 </style>`);
 installModes();installObserverLock();
 if(isObserver())startObserving();
 const baseRender=render;render=function(){baseRender();if(isObserver())lockView();};
 showNextNotification=showAlerts;
 // Alert updates follow local saves and shared receives instead of polling every device.
 const saved=save;let queued=false,lastAlerts='';
 const changed=()=>{const signature=JSON.stringify([state.notifications||[],(state.medicationOverrides||[]).map(r=>[r.id,r.status])]);if(signature===lastAlerts)return;lastAlerts=signature;if(queued)return;queued=true;queueMicrotask(()=>{queued=false;try{if(window.document?.defaultView)showAlerts();}catch{/* window closed */}});};
 save=function(...args){const result=saved(...args);changed();return result;};
 changed();

};
})();

