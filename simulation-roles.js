/* Device roles (student, observer, faculty), release alerts, and SBAR provider notifications.
   Observer: debrief-room laptops. View-only, independent navigation, non-blocking release alerts,
   and a popup for each SBAR a student sends. Open with ?mode=observer or choose Observer Mode in Faculty Mode. */
(function(){
const OBSERVER='observer';
const roleKey=()=>STORAGE_KEY+'_device_role';
const ackKey=()=>STORAGE_KEY+'_acknowledged_alerts';
const seenKey=()=>STORAGE_KEY+'_observer_seen';
const readSet=key=>{try{return new Set(JSON.parse(localStorage.getItem(key)||'[]'))}catch{return new Set()}};
const writeSet=(key,set)=>{try{localStorage.setItem(key,JSON.stringify([...set].slice(-2000)))}catch{}};
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
  view.insertAdjacentHTML('beforeend',panel('This Computer’s Role',`<p class="note">Debrief-room computers can be set to <b>Observer Mode</b>: students there can open any part of the chart on their own, cannot chart, see release notices that close by themselves, and get a popup only when a student sends an SBAR. The faculty PIN is needed to leave Observer Mode.</p><div class="actions"><button id="makeObserver" class="secondary">Make this computer an Observer (debrief room)</button></div><p class="note">Or open this link on the debrief computer: <code>${esc(link)}</code></p>`));
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

// Observers only see alerts created after this computer became an observer.
function startObserving(){
 const seen=readSet(seenKey());
 if(!localStorage.getItem(seenKey())){for(const n of state.notifications||[])seen.add(n.id);for(const s of state.providerNotifications||[])seen.add(s.id);writeSet(seenKey(),seen);}
}

function overlay(kind,id,html){
 const host=document.createElement('div');host.className='popupOverlay';host.dataset.alertKind=kind;host.dataset.alertId=id;host.innerHTML=`<div class="popupCard">${html}</div>`;
 document.body.appendChild(host);return host;
}
const patientName=id=>state.patients.find(p=>p.id===id)?.name||'';
const when=t=>String(t||'').replace('T',' ');
function sbarBody(s){
 const row=(label,text)=>`<div style="margin-top:8px"><b>${label}</b><div style="white-space:pre-wrap">${esc(text||'—')}</div></div>`;
 return `<div class="note">Patient: <b>${esc(patientName(s.patientId))}</b> • From: <b>${esc(s.student)}</b> • To: ${esc(s.provider||'Provider')} • ${esc(when(s.createdAt))}</div>
  <div style="margin-top:6px"><span class="sbarUrgency sbar${esc(s.urgency)}">${esc(s.urgency)}</span></div>
  ${row('S — Situation',s.situation)}${row('B — Background',s.background)}${row('A — Assessment',s.assessment)}${row('R — Recommendation',s.recommendation)}`;
}

// Release alerts for simulation students: one popup at a time, acknowledged once per computer.
function showStudentAlert(){
 const acked=readSet(ackKey());
 const n=(state.notifications||[]).find(x=>!x.read&&!acked.has(x.id)&&(!x.patientId||x.patientId===activePatientId));
 if(!n)return;
 const patient=state.patients.find(p=>p.id===n.patientId);
 const host=overlay('release',n.id,`<div class="popupHead"><b>${esc(n.title)}</b></div>
  <div class="popupBody"><div class="note">${patient?`Patient: <b>${esc(patient.name)}</b><br>`:''}Released: ${esc(n.createdAt)}</div><div style="font-size:16px;margin-top:12px">${esc(n.body)}</div></div>
  <div class="popupActions"><button id="ackLivePopup" class="primary">Acknowledge</button></div>`);
 host.querySelector('#ackLivePopup').onclick=()=>{
  const set=readSet(ackKey());set.add(n.id);writeSet(ackKey(),set);
  // Update the current chart, not the copy this popup was built from; a shared refresh may have replaced it.
  const current=(state.notifications||[]).find(x=>x.id===n.id);if(current)current.read=true;
  if(n.type==='message'){const m=(state.messages||[]).find(x=>x.releaseItemId===n.releaseItemId)||(state.messages||[]).find(x=>x.patientId===n.patientId&&(x.message===n.body||x.subject===n.body));if(m)m.read=true;}
  host.remove();save();updateNotificationCount();setTimeout(showNextNotification,120);
 };
}

// Observers: release alerts are brief notices that close on their own.
function showObserverToasts(){
 const seen=readSet(seenKey());let changed=false;
 let stack=document.getElementById('observerToasts');
 for(const n of state.notifications||[]){
  if(seen.has(n.id))continue;seen.add(n.id);changed=true;
  if(!stack){stack=document.createElement('div');stack.id='observerToasts';document.body.appendChild(stack);}
  const toast=document.createElement('div');toast.className='observerToast';toast.setAttribute('role','status');
  toast.innerHTML=`<button class="toastClose" aria-label="Close">×</button><b>${esc(n.title)}</b><div class="note">${esc(patientName(n.patientId))}</div><div>${esc(n.body)}</div>`;
  toast.querySelector('.toastClose').onclick=()=>toast.remove();stack.appendChild(toast);setTimeout(()=>toast.remove(),9000);
 }
 if(changed)writeSet(seenKey(),seen);
}
function showObserverSbar(){
 const seen=readSet(seenKey());
 const s=(state.providerNotifications||[]).find(x=>!seen.has(x.id));if(!s)return;
 const host=overlay('sbar-observer',s.id,`<div class="popupHead"><b>SBAR sent to provider</b></div><div class="popupBody">${sbarBody(s)}</div><div class="popupActions"><button class="primary" data-close-sbar>Close</button></div>`);
 host.querySelector('[data-close-sbar]').onclick=()=>{const set=readSet(seenKey());set.add(s.id);writeSet(seenKey(),set);host.remove();setTimeout(showNextNotification,120);};
}

// Faculty accept each SBAR; an optional response goes to the student as a provider message.
function showFacultySbar(){
 const s=(state.providerNotifications||[]).find(x=>x.status==='Submitted');if(!s)return;
 const host=overlay('sbar-faculty',s.id,`<div class="popupHead"><b>Provider notification (SBAR)</b></div><div class="popupBody">${sbarBody(s)}
  <label style="margin-top:12px;display:block">Provider response to student (optional)<textarea data-sbar-response rows="3" placeholder="e.g., Acknowledged. Give 500 mL NS bolus and recheck BP in 15 minutes."></textarea></label></div>
  <div class="popupActions"><button class="primary" data-accept-sbar>Accept</button></div>`);
 host.querySelector('[data-accept-sbar]').onclick=()=>{
  const current=(state.providerNotifications||[]).find(x=>x.id===s.id);
  const response=host.querySelector('[data-sbar-response]').value.trim();
  if(current&&current.status==='Submitted'){
   Object.assign(current,{status:'Accepted',acceptedAt:nowLocal(),response});
   if(response){
    const title=`Provider response: ${current.provider||'Provider'}`;
    state.messages ||= [];state.notifications ||= [];
    const messageId=uid('msg');
    state.messages.push({id:messageId,patientId:current.patientId,at:nowLocal(),from:current.provider||'Provider',to:'Student',subject:title,message:response,read:false,sbarId:current.id});
    state.notifications.push({id:uid('notif'),patientId:current.patientId,createdAt:nowLocal(),type:'message',title,body:response,releaseItemId:messageId,read:false});
   }
   audit('SBAR accepted by faculty',current.patientId,`${current.urgency}: ${current.situation}${response?` • Response: ${response}`:''}`);
   liveSave('sbar_accepted',{patientId:current.patientId,sbarId:current.id});
  }
  host.remove();if(currentView==='sbar')render();setTimeout(showNextNotification,120);
 };
}

// Close popups that another computer already handled.
function closeStalePopups(){
 for(const host of document.querySelectorAll('.popupOverlay[data-alert-kind]')){
  const id=host.dataset.alertId,kind=host.dataset.alertKind;
  const stale=kind==='release'?(isFaculty()||isObserver()||(state.notifications||[]).find(x=>x.id===id)?.read===true)
   :kind==='sbar-faculty'?(!isFaculty()||(state.providerNotifications||[]).find(x=>x.id===id)?.status!=='Submitted')
   :kind==='sbar-observer'?!isObserver():false;
  // Keep a faculty popup open while its response is being typed.
  if(stale&&!(kind==='sbar-faculty'&&host.contains(document.activeElement)))host.remove();
 }
}
function showAlerts(){
 closeStalePopups();
 if(isObserver())showObserverToasts();
 if(document.querySelector('.popupOverlay'))return;
 if(isFaculty())showFacultySbar();else if(isObserver())showObserverSbar();else showStudentAlert();
}

// SBAR screen: students write and send; everyone sees this patient's SBAR history.
function renderSBAR(){
 if(!requirePatient())return;
 const p=activePatient(),rows=(state.providerNotifications||[]).filter(x=>x.patientId===p.id).slice().reverse();
 const history=rows.map(s=>`<details class="sbarHistory"><summary><b>${esc(when(s.createdAt))}</b> • ${esc(s.urgency)} • ${esc(s.student)} → ${esc(s.provider||'Provider')} • <span class="sbarStatus sbar${esc(s.status)}">${s.status==='Accepted'?'Accepted by provider':'Waiting for provider'}</span></summary>${sbarBody(s)}${s.response?`<div class="success" style="margin-top:8px"><b>Provider response:</b> ${esc(s.response)}</div>`:''}</details>`).join('')||'<div class="note">No provider notifications have been sent for this patient.</div>';
 const form=isFaculty()?'<div class="note">Students send SBAR notifications from this screen. Each one appears on Faculty screens to accept.</div>':isObserver()?'<div class="note">SBAR notifications sent from the simulation room appear here and as a popup.</div>':`<form id="sbarForm" class="nativeEntry" data-record="sbar">
  <div class="grid3"><label>Student / Initials<input name="student" required></label><label>Provider<input name="provider" value="${esc(p.provider||'')}" required></label>
  <label>Urgency<select name="urgency" required><option>Routine</option><option>Urgent</option><option>STAT</option></select></label></div>
  <label>S — Situation<textarea name="situation" rows="3" required placeholder="What is happening with the patient right now?"></textarea></label>
  <label>B — Background<textarea name="background" rows="3" required placeholder="Relevant history, diagnosis, recent treatments, current medications."></textarea></label>
  <label>A — Assessment<textarea name="assessment" rows="3" required placeholder="Your assessment findings, vital signs, labs, and what you think the problem is."></textarea></label>
  <label>R — Recommendation<textarea name="recommendation" rows="3" required placeholder="What do you need from the provider?"></textarea></label>
  <div class="actions"><button type="submit" class="primary">Submit to Provider</button><span id="sbarFeedback" role="status"></span></div></form>`;
 document.getElementById('view').innerHTML=panel('Provider Notification (SBAR)',form)+panel('SBAR History',history);
 const f=document.getElementById('sbarForm');
 if(f)f.onsubmit=e=>{
  e.preventDefault();if(isObserver()||!f.reportValidity())return;
  const v=Object.fromEntries(new FormData(f).entries());for(const k of Object.keys(v))v[k]=String(v[k]).trim();
  if(Object.values(v).some(x=>!x)){f.reportValidity();return;}
  state.providerNotifications ||= [];
  const sbar={id:uid('sbar'),patientId:p.id,createdAt:nowLocal(),status:'Submitted',...v};
  state.providerNotifications.push(sbar);
  audit('SBAR sent to provider',p.id,`${v.student} (${v.urgency}): ${v.situation}`);
  clearCurrentViewDraft?.();liveSave('sbar_submitted',{patientId:p.id,sbarId:sbar.id});
  render();const fb=document.getElementById('sbarFeedback');if(fb)fb.textContent=' Sent to provider. You will be notified when the provider responds.';
 };
}

window.initializeSimulationRoles=function(){
 state.providerNotifications ||= [];
 document.head.insertAdjacentHTML('beforeend',`<style>
  #observerToasts{position:fixed;top:78px;right:16px;z-index:4000;display:flex;flex-direction:column;gap:8px;max-width:min(360px,calc(100vw - 32px))}
  .observerToast{background:#fff;border-left:5px solid var(--gold,#c9a227);box-shadow:0 6px 20px #0004;border-radius:6px;padding:10px 30px 10px 12px;position:relative}
  .observerToast .toastClose{position:absolute;top:4px;right:6px;border:0;background:none;font-size:18px;cursor:pointer;padding:0 4px}
  .observerBanner{background:#fff7dc;border:1px solid #e6cf7a;padding:8px 10px;border-radius:6px;margin-bottom:10px}
  body.observerMode #view input:disabled,body.observerMode #view textarea:disabled,body.observerMode #view select:disabled{background:#f1f3f4;color:#555;cursor:not-allowed}
  body.observerMode #view button:disabled{opacity:.45;cursor:not-allowed}
  .sbarUrgency{display:inline-block;padding:2px 8px;border-radius:10px;font-weight:bold;font-size:12px;background:#e7f1ec}
  .sbarUrgent{background:#fff1c7}.sbarSTAT{background:#c72c43;color:#fff}
  .sbarStatus.sbarSubmitted{color:#9a5b00}.sbarStatus.sbarAccepted{color:#1f6b45}
  details.sbarHistory{border:1px solid #d5dfe4;border-radius:6px;padding:8px;margin-bottom:8px}
 </style>`);
 const inbox=document.querySelector('aside button[data-view="inbox"]');
 if(inbox&&!document.querySelector('aside button[data-view="sbar"]')){
  const b=document.createElement('button');b.dataset.view='sbar';b.textContent='Provider Notification (SBAR)';inbox.before(b);
  b.onclick=()=>{saveCurrentViewDraft();currentView='sbar';render();};
 }
 installModes();installObserverLock();
 if(isObserver())startObserving();
 const baseRender=render;render=function(){baseRender();if(currentView==='sbar')renderSBAR();if(isObserver())lockView();};
 showNextNotification=showAlerts;
 window.renderSBAR=renderSBAR;
 const timer=setInterval(()=>{let open=false;try{open=!!document.defaultView}catch{}if(!open){clearInterval(timer);return;}try{showAlerts();}catch(e){console.error('Alerts',e);}},1500);
};
})();
