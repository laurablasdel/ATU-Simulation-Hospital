/* Faculty and student release alerts. */
(function(){
// Retired observer devices enter Student Mode, never Faculty Mode.
function migrateRetiredDeviceRole(){
 const key=STORAGE_KEY+'_device_role',tab=sessionStorage.getItem(TAB_MODE_KEY);
 let retired=false;try{retired=localStorage.getItem(key)==='observer';if(retired)localStorage.removeItem(key);}catch{}
 if(tab==='observer'||(!tab&&(retired||new URLSearchParams(location.search).get('mode')==='observer')))setTabMode('student');
}

function overlay(kind,id,html){
 const host=document.createElement('div');host.className='popupOverlay';host.dataset.alertKind=kind;host.dataset.alertId=id;host.innerHTML=`<div class="popupCard">${html}</div>`;
 document.body.appendChild(host);return host;
}
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

// Close popups that another computer already handled.
function closeStalePopups(){
 for(const host of document.querySelectorAll('.popupOverlay[data-alert-kind]')){
  const id=host.dataset.alertId,kind=host.dataset.alertKind;
  const stale=kind==='release'?(isFaculty()||!(state.notifications||[]).some(x=>x.id===id&&!x.read))
   :kind==='medication-override'?(!isFaculty()||(state.medicationOverrides||[]).find(r=>r.id===id)?.status!=='Pending')
   :false;
  // Keep a faculty popup open while its response is being typed.
  if(stale)host.remove();
 }
}
function showAlerts(){
 closeStalePopups();
 if(document.querySelector('.popupOverlay'))return;
 if(isFaculty()){window.showMedicationOverrideApproval?.();}else if(getTabMode()==='student')showStudentAlert();
}

window.initializeSimulationRoles=function(){
 migrateRetiredDeviceRole();
 showNextNotification=showAlerts;
 // Alert updates follow local saves and shared receives instead of polling every device.
 const saved=save;let queued=false,lastAlerts='';
 const changed=()=>{const signature=JSON.stringify([state.notifications||[],(state.medicationOverrides||[]).map(r=>[r.id,r.status])]);if(signature===lastAlerts)return;lastAlerts=signature;if(queued)return;queued=true;queueMicrotask(()=>{queued=false;try{if(window.document?.defaultView)showAlerts();}catch{/* window closed */}});};
 save=function(...args){const result=saved(...args);changed();return result;};
 changed();

};
})();

