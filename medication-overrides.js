/* Single-dose faculty authorizations use the existing shared state and MAR record format. */
(function(){
 const code=value=>normalizeMedicationBarcode(value);
 const closedKey=()=>STORAGE_KEY+'_closed_medication_requests';
 const closed=new Set();let loaded=false;
 function closedRequests(){if(!loaded){loaded=true;try{for(const id of JSON.parse(sessionStorage.getItem(closedKey())||'[]'))closed.add(id);}catch{}}return closed;}
 function rememberClosed(){try{sessionStorage.setItem(closedKey(),JSON.stringify([...closed]));}catch{}}
 window.reopenMedicationRequests=function(){closedRequests().clear();rememberClosed();document.getElementById('reopenMedicationRequests')?.remove();showNextNotification();};
 function closedRequestControl(){
  let button=document.getElementById('reopenMedicationRequests');const count=(state.medicationOverrides||[]).filter(r=>r.status==='Pending'&&closedRequests().has(r.id)&&r.resetEpoch===epoch(r.patientId)).length;
  if(!isFaculty()||!count){button?.remove();return;}
  if(!button){button=document.createElement('button');button.id='reopenMedicationRequests';button.className='secondary facultyOnly';document.getElementById('sharedConnection')?.after(button);button.onclick=reopenMedicationRequests;}button.textContent='Review closed medication requests ('+count+')';
 }
 const epoch=pid=>state.patientResetEpochs?.[pid]||0;
 window.patientWristbandMatches=function(pid,value){const p=state.patients.find(p=>p.id===pid);return !!p&&!!code(value)&&[p.barcode,p.mrn,state.shortBarcodeRegistry?.['patient:'+pid],'PT-'+String(p.mrn).toUpperCase()].filter(Boolean).some(v=>code(v)===code(value));};
 window.medicationOverrideOrder=function(request){return {id:'override:'+request.id,patientId:request.patientId,name:request.medication,dose:request.dose,route:request.route,frequency:'Once — provider override',scheduledTime:'Once',status:'Due',releaseStatus:'released',highAlert:request.highAlert!==false,overrideId:request.id};};
 window.findMedicationOverride=function(pid,barcode){return (state.medicationOverrides||[]).find(r=>r.patientId===pid&&r.barcode===code(barcode)&&r.resetEpoch===epoch(pid)&&r.status==='Approved'&&!(state.mar||[]).some(m=>m.overrideId===r.id));};
 window.requestMedicationOverride=function(input){
  const fail=error=>({ok:false,error});
  if(getTabMode()!=='student')return fail('Only Student Mode can request a provider override.');
  if(input.patientId!==activePatientId||!patientWristbandMatches(input.patientId,input.patientBarcode))return fail('Wrong patient. Scan the current patient wristband; this cannot be overridden.');
  if(!code(input.barcode)||!String(input.reason||'').trim())return fail('Enter a medication barcode and the reason for the request.');
  state.medicationOverrides||=[];
  const existing=state.medicationOverrides.find(r=>r.patientId===input.patientId&&r.barcode===code(input.barcode)&&r.resetEpoch===epoch(input.patientId)&&['Pending','Approved'].includes(r.status));
  if(existing)return {ok:true,request:existing};
  const resolved=resolveMedicationBarcode(input.barcode),name=resolved.package?.name||resolved.legacyOrder?.name||'';
  const request={id:uid('override'),patientId:input.patientId,barcode:code(input.barcode),packageId:resolved.package?.id||'',medication:name,reason:String(input.reason).trim(),requestedBy:window.studentSession?.()?.name||'Student',group:window.studentSession?.()?.group||'',createdAt:nowLocal(),resetEpoch:epoch(input.patientId),status:'Pending'};
  state.medicationOverrides.push(request);
  try{save();}catch(e){state.medicationOverrides=state.medicationOverrides.filter(r=>r.id!==request.id);return fail('The request could not be saved. Try again.');}
  audit('Medication override requested',input.patientId,`${request.requestedBy}: ${request.barcode} — ${request.reason}`);
  liveSave('medication_override_requested',{patientId:input.patientId,requestId:request.id});
  return {ok:true,request};
 };
 window.showMedicationOverrideRequest=function(pid,patientBarcode,barcode){
  const host=document.getElementById('marOrderChoices');
  const previous=(state.medicationOverrides||[]).filter(r=>r.patientId===pid&&r.barcode===code(barcode)&&r.resetEpoch===epoch(pid)).at(-1);
  if(previous?.status==='Pending'){host.innerHTML='<p>Provider override requested. Waiting for faculty approval. No medication has been documented.</p>';return;}
  host.innerHTML=`${previous?`<p>Previous request: ${esc(previous.status)}${previous.decisionNotes?' — '+esc(previous.decisionNotes):''}</p>`:''}<label>Reason for provider override<textarea id="marOverrideReason" placeholder="Explain why you are requesting this medication for this patient."></textarea></label><button id="marOverrideSend" class="primary">Send request to provider</button><p id="marOverrideResult" role="status"></p>`;
  document.getElementById('marOverrideSend').onclick=()=>{const result=requestMedicationOverride({patientId:pid,patientBarcode,barcode,reason:document.getElementById('marOverrideReason').value});document.getElementById('marOverrideResult').textContent=result.ok?'Request saved and queued for faculty. Wait for approval, then scan the patient and medication again.':result.error;if(result.ok)document.getElementById('marOverrideSend').disabled=true;};
 };
 window.showMedicationOverrideApproval=function(){
  closedRequestControl();if(!isFaculty())return false;
  const r=(state.medicationOverrides||[]).find(r=>r.status==='Pending'&&!closedRequests().has(r.id)&&r.resetEpoch===epoch(r.patientId));if(!r)return false;
  const host=document.createElement('div');host.className='popupOverlay';host.dataset.alertKind='medication-override';host.dataset.alertId=r.id;
  host.innerHTML=`<div class="popupCard"><div class="popupHead" style="display:flex;justify-content:space-between;align-items:center;gap:12px"><b>Provider override request — one administration</b><button data-override-close type="button" aria-label="Close medication request" title="Close on this computer without approving or denying" style="font-size:24px;background:transparent;border:0;color:inherit;cursor:pointer">×</button></div><div class="popupBody"><p><b>${esc(state.patients.find(p=>p.id===r.patientId)?.name)}</b><br>From: ${esc(r.requestedBy)}${r.group?' • Group '+esc(r.group):''}<br>Scanned code: <b>${esc(r.barcode)}</b></p><p>Reason: ${esc(r.reason)}</p><p>Approval permits one administration only. It does not release pending orders or document a dose.</p><label>Medication name<input data-override-name value="${esc(r.medication)}"></label><div class="grid"><label>Authorized dose (include units)<input data-override-dose></label><label>Authorized route<input data-override-route></label></div><label>Approving provider / initials<input data-override-provider></label><label><input type="checkbox" data-override-high checked style="width:auto"> Require independent verifier (high-alert medication)</label><label style="display:block;margin-top:10px">Response / instructions<textarea data-override-notes></textarea></label><p data-override-feedback role="status"></p></div><div class="popupActions"><button class="danger" data-override-deny>Deny</button><button class="primary" data-override-approve>Approve one administration</button></div></div>`;
  document.body.append(host);
  host.querySelector('[data-override-close]').onclick=()=>{closedRequests().add(r.id);rememberClosed();host.remove();closedRequestControl();};
  const decide=async status=>{
   if(!isFaculty())return;
   const get=selector=>host.querySelector(selector),provider=get('[data-override-provider]').value.trim(),medication=get('[data-override-name]').value.trim(),dose=get('[data-override-dose]').value.trim(),route=get('[data-override-route]').value.trim();
   if(!provider||status==='Approved'&&(!medication||!dose||!route)){get('[data-override-feedback]').textContent='Enter provider initials; approval also requires medication, dose with units, and route.';return;}
   const buttons=host.querySelectorAll('[data-override-approve],[data-override-deny]');buttons.forEach(b=>b.disabled=true);get('[data-override-feedback]').textContent=status==='Denied'?'Saving denial…':'Saving approval…';
   const result=await commitMedicationOverrideAction('decision',r.id,{status,provider,medication,dose,route,highAlert:get('[data-override-high]').checked,decisionNotes:get('[data-override-notes]').value.trim()},r);
   if(!result.ok){get('[data-override-feedback]').textContent=result.error;buttons.forEach(b=>b.disabled=false);return;}
   host.remove();showNextNotification();
  };
  host.querySelector('[data-override-approve]').onclick=()=>decide('Approved');host.querySelector('[data-override-deny]').onclick=()=>decide('Denied');return true;
 };
})();
