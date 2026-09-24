/* Simulation starting charts, durable drafts, and guided administration. */
(function(){
const copy=x=>JSON.parse(JSON.stringify(x));
const studentCollections=['vitals','io','assessments','mar','glucoseChecks','laborProgress','postpartumRecovery','pphPads','pphMedications','bloodAdministration','surgicalChecklist','surgicalAssessments','chartEntries','pewsAssessments','audit'];
const today=()=>nowLocal().slice(0,10);
const shortDate=()=>{const [y,m,d]=today().split('-');return `${m}/${d}/${y}`;};
function currentChartDates(text){return String(text||'').replace(/<tr/gi,'\n<tr').split(/\n/).map(line=>/\bDOB\b|date of birth|born|history of|past medical/i.test(line)?line:line.replace(/\b\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2})\b/g,shortDate()).replace(/\b\d{4}-\d{2}-\d{2}\b/g,today())).join('\n');}
function cleanBase(base){const result=copy(base);for(const k of studentCollections)result.collections[k]=[];result.collections.notes=(result.collections.notes||[]).filter(x=>x.origin!=='student'&&!/^(?:note|education)-/.test(String(x.id||'')));result.collections.orders=(result.collections.orders||[]).filter(x=>x.origin!=='student'&&!x.student&&(!x.enteredBy||x.enteredBy===x.provider||/faculty|provider|doctor|physician/i.test(x.enteredBy)));result.collections.messages=[];result.collections.notifications=[];result.cleanBaseVersion=2;return result;}
function baseFor(id){return cleanBase(state.simulationBases?.[id]||SIMULATION_DEFAULTS[id]);}
function resetToBase(id){
 const base=baseFor(id);if(!base)return false;
 state.simulationResetArchives||={};state.simulationResetArchives[id]={at:new Date().toISOString(),collections:Object.fromEntries(Object.keys(base.collections).map(k=>[k,copy((state[k]||[]).filter(x=>x.patientId===id))]))};
 const previousPatient=state.patients.find(x=>x.id===id),previousMeds=(state.medicationCatalog||[]).filter(x=>x.patientId===id);
 state.patients=state.patients.map(p=>p.id===id?{...copy(base.patient),barcode:previousPatient?.barcode||base.patient.barcode}:p);
 for(const [key,rows] of Object.entries(base.collections)){state[key]=(state[key]||[]).filter(x=>x.patientId!==id).concat(copy(rows).map(row=>{for(const field of ['time','date','createdAt'])if(typeof row[field]==='string'&&/^\d{4}-\d{2}-\d{2}/.test(row[field]))row[field]=today()+row[field].slice(10);return row;}));}
 for(const k of studentCollections)state[k]=(state[k]||[]).filter(x=>x.patientId!==id);
 for(const med of state.medicationCatalog.filter(x=>x.patientId===id)){const old=previousMeds.find(x=>x.name===med.name&&x.dose===med.dose);state.shortBarcodeRegistry||={};if(old?.barcode){med.barcode=old.barcode;state.shortBarcodeRegistry['med:'+med.id]=old.barcode;}else{delete med.barcode;delete state.shortBarcodeRegistry['med:'+med.id];}}
 const ids=new Set(CHART_RECORDS.filter(r=>r.patientId===id).map(r=>r.id));
 for(let i=CHART_RECORDS.length-1;i>=0;i--)if(CHART_RECORDS[i].patientId===id)CHART_RECORDS.splice(i,1);
 const records=copy(base.chartRecords).filter(r=>r.id!=='chart-284195d201d58119b8effd1fb54adbde');records.forEach(r=>r.content=currentChartDates(r.content));CHART_RECORDS.push(...records);
 state.chartContentEdits||={};for(const key of ids)delete state.chartContentEdits[key];for(const r of records)state.chartContentEdits[r.id]={...r};
 state.customChartRecords=(state.customChartRecords||[]).filter(r=>r.patientId!==id).concat(records.filter(r=>!SIMULATION_DEFAULTS[id].chartRecords.some(x=>x.id===r.id)));
 state.releaseQueue=(state.releaseQueue||[]).filter(x=>x.patientId!==id).concat(copy(base.releaseQueue).map(q=>({...q,createdAt:nowLocal(),releasedAt:'',status:'pending',content:currentChartDates(q.content)})));
 state.marHiddenRecords||={};for(const rid of ids)delete state.marHiddenRecords[rid];Object.assign(state.marHiddenRecords,base.marHiddenRecords||{});state.marVisibility||={};state.marVisibility[id]=base.marVisibility!==false;state.scenarioStage||={};state.scenarioStage[id]=base.scenarioStage;
 ensureMedicationData();state.patientResetEpochs||={};state.patientResetEpochs[id]=Date.now();clearPatientDrafts(id);liveSave('simulation_reset',{patientId:id});return true;
}
function updateBase(id){const patient=state.patients.find(p=>p.id===id),keys=Object.keys(SIMULATION_DEFAULTS[id].collections);const base={patient:copy(patient),collections:Object.fromEntries(keys.map(k=>[k,copy((state[k]||[]).filter(x=>x.patientId===id))])),chartRecords:copy(CHART_RECORDS.filter(r=>r.patientId===id)),releaseQueue:copy((state.releaseQueue||[]).filter(x=>x.patientId===id&&x.status==='pending')),scenarioStage:state.scenarioStage?.[id]||null,marVisibility:state.marVisibility?.[id]!==false,savedAt:new Date().toISOString()};state.simulationBases||={};state.simulationBases[id]=cleanBase(base);liveSave('base_patient_updated',{patientId:id});}
window.simBaseFor=baseFor;window.resetToBase=resetToBase;window.updateBasePatient=updateBase;
// Drafts stay local to the browser tab; incomplete entries never enter the shared chart.
let dirty=false,baseline='',rendering=false;
const draftKey=()=>STORAGE_KEY+'_drafts_'+ATU_CLOUD_CLIENT;
function fields(){return [...document.querySelectorAll('#view input,#view textarea,#view select')].filter(e=>!['file','button','submit'].includes(e.type)).map((e,i)=>({el:e,key:e.id||`${e.closest('form')?.dataset.record||'form'}:${e.name||i}`}));}
function values(){return Object.fromEntries(fields().map(({el,key})=>[key,/checkbox|radio/.test(el.type)?el.checked:el.value]));}
function drafts(){try{return JSON.parse(localStorage.getItem(draftKey())||'{}')}catch{return {}}}
function key(){return activePatientId+'::'+currentView;}
function clearPatientDrafts(id){for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(!k.startsWith(STORAGE_KEY+'_draft'))continue;try{const all=JSON.parse(localStorage.getItem(k)||'{}');for(const item of Object.keys(all))if(item.startsWith(id+'::'))delete all[item];localStorage.setItem(k,JSON.stringify(all));}catch{}}if(activePatientId===id){dirty=false;baseline=JSON.stringify(values());}}
window.simHasDraft=()=>dirty;
window.simRefreshFromShared=()=>{const d=drafts()[key()];if(d&&d.resetEpoch!==(state.patientResetEpochs?.[activePatientId]||0)){clearPatientDrafts(activePatientId);render();return;}if(dirty){updateNotificationCount();return;}render();};
// Faculty Live Control saves each edit with its own button; student drafts do not apply there.
const facultyScreen=()=>currentView==='faculty';
function setupDraft(){if(rendering)return;if(facultyScreen()){const all=drafts();if(key() in all){delete all[key()];localStorage.setItem(draftKey(),JSON.stringify(all));}dirty=false;baseline='';return;}restoreCurrentViewDraft();baseline=JSON.stringify(values());for(const button of document.querySelectorAll('#view button')){if(/^(Save|Record Administration|Sign Note|Add I&O|Document Medication Administration)/i.test(button.textContent)&&!isFaculty())button.textContent='Complete and Save';} }
function navigateGuard(event){const button=event.target.closest('aside button,.openPatient,#toggleMode');if(!button||!dirty)return;if(!confirm('This chart has unfinished entries. Click OK to save this work as a draft and leave the screen, or Cancel to stay and complete it.')){event.preventDefault();event.stopImmediatePropagation();return;}saveCurrentViewDraft();dirty=false;baseline=JSON.stringify(values());}
function entryCount(){return studentCollections.reduce((n,k)=>n+(state[k]||[]).length,0)+(state.orders||[]).length;}
function initDrafts(){
 saveCurrentViewDraft=function(){if(!dirty)return;const all=drafts();all[key()]={values:values(),resetEpoch:state.patientResetEpochs?.[activePatientId]||0};localStorage.setItem(draftKey(),JSON.stringify(all));};
 restoreCurrentViewDraft=function(){const d=drafts()[key()];if(!d||d.resetEpoch!==(state.patientResetEpochs?.[activePatientId]||0))return;for(const {el,key:k} of fields())if(k in d.values){if(/checkbox|radio/.test(el.type))el.checked=!!d.values[k];else el.value=d.values[k];}dirty=true;};
 clearCurrentViewDraft=function(){const all=drafts();delete all[key()];localStorage.setItem(draftKey(),JSON.stringify(all));dirty=false;baseline=JSON.stringify(values());};
 for(const type of ['input','change'])document.addEventListener(type,e=>{if(e.target.closest('#view')&&!rendering&&!facultyScreen()){dirty=JSON.stringify(values())!==baseline;if(dirty)saveCurrentViewDraft();}});
 document.addEventListener('click',navigateGuard,true);
 const finished=e=>{if(!e.target.closest('#view'))return;const n=entryCount();queueMicrotask(()=>{if(entryCount()>n){clearCurrentViewDraft();setupDraft();}});};document.addEventListener('click',finished,true);document.addEventListener('submit',finished,true);
 window.addEventListener('beforeunload',e=>{if(dirty){saveCurrentViewDraft();e.preventDefault();e.returnValue='';}});
}
function heading(body,title){return panel(title,body);}
function scanFields(prefix,label){return `<label>${label}<input id="${prefix}" inputmode="numeric" maxlength="24" autocomplete="off" placeholder="Scan or enter four-digit code"></label>`;}
// Some scanners send Code 39 start/stop characters (for example, *1000*).
// Match the printed four-digit identifier whether it was typed or scanned.
const scanCode=value=>String(value||'').trim().replace(/\s+/g,'').replace(/^\*|\*$/g,'');
const scanMatches=(value,...expected)=>expected.flat().filter(Boolean).some(code=>scanCode(value)===scanCode(code));
const chartMedicationLinks={
 'chart-286195d201d580489c7bc8e0770135bf':['Racepinephrine 2.25%','Dexamethasone'],
 'chart-2d6195d201d58030b0ded95695bbcb1e':['Morphine sulfate (Duramorph)','Ondansetron (Zofran)'],
 'admin-jane-respiratory-naloxone':['Naloxone (Narcan)'],
 'admin-jane-respiratory-ketorolac':['Ketorolac (Toradol)'],
 'admin-sanogo-pph-meds':['Methylergonovine (Methergine)','Carboprost (Hemabate)','Misoprostol','Tranexamic acid (TXA)'],
 'admin-stephanie-acetaminophen':['Acetaminophen'],
 'admin-stephanie-ceftriaxone':['Ceftriaxone']
};
if(window.RUTH_ICU_TRANSFER)chartMedicationLinks[RUTH_ICU_TRANSFER.ordersId]=RUTH_ICU_TRANSFER.release;
// Orders that discontinue earlier MAR rows when faculty releases them.
const chartMedicationDiscontinues=window.RUTH_ICU_TRANSFER?{[RUTH_ICU_TRANSFER.ordersId]:RUTH_ICU_TRANSFER.discontinue}:{};
function seedLinkedMedications(){
 for(const [recordId,name,dose,frequency] of [['admin-stephanie-acetaminophen','Acetaminophen','650 mg',''],['admin-stephanie-ceftriaxone','Ceftriaxone','500 mg/100 mL','Every 12 hours']]){
  const r=CHART_RECORDS.find(x=>x.id===recordId);if(!r)continue;
  let med=state.medicationCatalog.find(m=>m.patientId===r.patientId&&new RegExp(name+'|'+(name==='Acetaminophen'?'Tylenol':name),'i').test(m.name));
  if(!med){const released=chartRecordReleased(r);med={id:'med-'+recordId,patientId:r.patientId,name,dose,route:'',frequency,status:released?'Due':'Pending',releaseStatus:released?'released':'pending',provider:'Henderson',sourceChartRecordId:recordId};state.medicationCatalog.push(med);}
  med.sourceChartRecordId=recordId;
 }
}
function renderGuidedMAR(){
 seedLinkedMedications();ensureMedicationData();if(!requirePatient())return;const p=activePatient();if(p.id==='jane-fowler')window.normalizeJaneMAR?.();if(!isFaculty()&&state.marVisibility?.[p.id]===false){document.getElementById('view').innerHTML=panel('MAR','Hidden by faculty.');return;}
 const meds=medicationsForPatient(p.id,false),rows=(state.mar||[]).filter(x=>x.patientId===p.id).slice().reverse();
 document.getElementById('view').innerHTML=panel('Active Medications',`<table><thead><tr><th>Medication</th><th>Dose</th><th>Route / Due</th><th>Last administration</th><th></th></tr></thead><tbody>${meds.map(m=>{const last=rows.find(r=>r.medicationId===m.id||r.medication===m.name);return `<tr><td>${esc(m.name)}</td><td>${esc(m.dose)}</td><td>${esc(m.route)} / ${esc(m.scheduledTime||m.frequency)}</td><td>${last?`${esc(last.status)} — ${esc(last.time)}`:'Not administered'}</td><td><button data-select-med="${esc(m.id)}">Select</button></td></tr>`;}).join('')||'<tr><td colspan="5">No released medications.</td></tr>'}</tbody></table>`)+panel('Administer Medication',`
 <input type="hidden" id="gmSelected"><p id="gmSelectedLabel">1. Select a medication above.</p>
 <div class="grid3">${scanFields('gmPatient','2. Patient wristband / four-digit patient code')}<label>Patient verification method<select id="gmPatientMethod"><option>Scanner</option><option>Manual code override</option></select></label><button id="gmVerifyPatient">Verify Patient</button></div>
 <p id="gmPatientResult" role="status"></p>
 <div class="grid3">${scanFields('gmMedication','3. Medication barcode / four-digit medication code')}<label>Medication verification method<select id="gmMedicationMethod"><option>Scanner</option><option>Manual code override</option></select></label><button id="gmVerifyMedication">Verify Medication</button></div>
 <p id="gmMedicationResult" role="status"></p>
 <div class="grid3"><label>Student / Initials<input id="gmStudent"></label><label>Administration time<input id="gmTime" type="datetime-local" value="${nowLocal()}"></label><label>Dose<input id="gmDose" readonly></label><label>Independent verifier (high-alert medications)<input id="gmVerifier"></label><label>Manual override reason<input id="gmReason"></label><label>Response / Notes<input id="gmNotes"></label></div>
 <div class="actions"><button id="gmComplete" data-complete class="primary">Complete and Save Administration</button><button id="gmCancel" class="secondary">Save Draft and Leave MAR</button></div><p id="gmResult" role="status"></p>`)+panel('MAR Administration History',`<table><thead><tr><th>Time</th><th>Medication / Dose</th><th>Status</th><th>Student</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.time)}</td><td>${esc(r.medication)} ${esc(r.dose)}</td><td>${esc(r.status)}</td><td>${esc(r.student)}</td></tr>`).join('')||'<tr><td colspan="4">No administrations documented.</td></tr>'}</tbody></table>`);
 const el=id=>document.getElementById(id),med=()=>medicationsForPatient(p.id,false).find(x=>x.id===el('gmSelected').value);
 const patientCodes=[p.barcode,state.shortBarcodeRegistry?.['patient:'+p.id],p.mrn];
 const medicationCodes=m=>[m?.barcode,state.shortBarcodeRegistry?.['med:'+m?.id]];
 let patientVerified='',medVerified='';
 const invalidate=()=>{patientVerified='';medVerified='';el('gmPatientResult').textContent='';el('gmMedicationResult').textContent='';};
 document.querySelectorAll('[data-select-med]').forEach(b=>b.onclick=()=>{const m=meds.find(x=>x.id===b.dataset.selectMed);el('gmSelected').value=m.id;el('gmSelectedLabel').textContent=`Selected: ${m.name} ${m.dose} ${m.route}`;el('gmDose').value=m.dose;el('gmMedication').value='';invalidate();el('gmPatient').focus();dirty=true;saveCurrentViewDraft();});
 el('gmPatient').addEventListener('input',invalidate);el('gmMedication').addEventListener('input',()=>{medVerified='';el('gmMedicationResult').textContent='Verify medication again.';});
 el('gmVerifyPatient').onclick=()=>{invalidate();if(!med()){el('gmPatientResult').textContent='Select an active medication first.';return;}if(!scanMatches(el('gmPatient').value,patientCodes)){el('gmPatientResult').textContent='Patient mismatch. Enter the four-digit wristband number or scan the wristband again.';return;}patientVerified=p.barcode;el('gmPatientResult').textContent='Patient verified. Scan the selected medication next.';el('gmMedication').focus();};
 el('gmVerifyMedication').onclick=()=>{medVerified='';let m=med();if(!patientVerified||!scanMatches(el('gmPatient').value,patientCodes)){el('gmMedicationResult').textContent='Verify the patient first.';return;}if(!m||!scanMatches(el('gmMedication').value,medicationCodes(m))){const scanned=meds.find(candidate=>scanMatches(el('gmMedication').value,medicationCodes(candidate)));if(scanned){el('gmSelected').value=scanned.id;el('gmSelectedLabel').textContent=`Selected from scan: ${scanned.name} ${scanned.dose} ${scanned.route}`;el('gmDose').value=scanned.dose;m=scanned;}}if(!m||!scanMatches(el('gmMedication').value,medicationCodes(m))){el('gmMedicationResult').textContent='Medication mismatch. Enter the four-digit medication number or scan the selected label again.';return;}medVerified=m.id;el('gmDose').value=m.dose;el('gmMedicationResult').textContent='Medication verified. Complete and save to record administration.';};
 for(const [input,button] of [['gmPatient','gmVerifyPatient'],['gmMedication','gmVerifyMedication']])el(input).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();el(button).click();}};
 el('gmComplete').onclick=()=>{const m=med(),student=el('gmStudent').value.trim(),manual=el('gmPatientMethod').value.startsWith('Manual')||el('gmMedicationMethod').value.startsWith('Manual');const fail=t=>el('gmResult').textContent=t;
 if(!m||medVerified!==m.id||patientVerified!==p.barcode||!scanMatches(el('gmPatient').value,patientCodes)||!scanMatches(el('gmMedication').value,medicationCodes(m)))return fail('Verify the patient and selected medication before completing.');
 if(!student||!el('gmTime').value)return fail('Enter student initials and administration time.');
 if(m.highAlert&&(!el('gmVerifier').value.trim()||el('gmVerifier').value.trim().toLowerCase()===student.toLowerCase()))return fail('A different independent verifier is required for this high-alert medication.');
 state.mar.push({id:uid('mar'),patientId:p.id,medicationId:m.id,medication:m.name,dose:m.dose,route:m.route,due:m.scheduledTime||m.frequency,time:el('gmTime').value,student,status:'Given',verifiedBy:el('gmVerifier').value.trim(),response:el('gmNotes').value.trim(),patientBarcode:patientVerified,medicationBarcode:m.barcode,patientScanMethod:el('gmPatientMethod').value,medicationScanMethod:el('gmMedicationMethod').value,overrideReason:el('gmReason').value.trim()||(manual?'Manual code override':'')});clearCurrentViewDraft();audit('Medication administration',p.id,`${m.name} ${m.dose} given by ${student}`);liveSave('medication_administration_documented',{patientId:p.id,medicationId:m.id});renderMAR();};
 el('gmCancel').onclick=()=>{saveCurrentViewDraft();currentView='summary';render();};
 setupDraft();
}
// The student MAR intentionally uses direct medication charting.  Barcode
// scanning remains available in the faculty barcode center for printing and
// inventory, but it is not required to document a dose in simulation.
function renderSimpleMAR(){
 seedLinkedMedications();ensureMedicationData();if(!requirePatient())return;
 const p=activePatient();
 if(p.id==='jane-fowler')window.normalizeJaneMAR?.();
 if(!isFaculty()&&state.marVisibility?.[p.id]===false){document.getElementById('view').innerHTML=panel('MAR','Hidden by faculty.');return;}
 const showPending=isFaculty(),meds=medicationsForPatient(p.id,showPending),administrations=(state.mar||[]).filter(row=>row.patientId===p.id).slice().reverse();
 // Faculty see the same MAR as students; unreleased medications are listed separately below it.
 const heldBack=meds.filter(m=>!medicationReleased(m));
 const cells=meds.filter(m=>medicationReleased(m)).map(m=>{
  const released=medicationReleased(m),pending=!released;
  const entryId=`marEntry-${m.id}`;
  return `<tr data-mar-medication="${esc(m.id)}"><td><b>${esc(m.name)}</b>${pending?' <span class="pendingBadge">Pending</span>':''}${m.notes?`<div class="note" style="margin-top:4px">${esc(m.notes)}</div>`:''}</td><td>${esc(m.dose)}</td><td>${esc(m.route)}</td><td>${esc(m.scheduledTime||m.frequency)}</td><td><input id="${entryId}-time" type="datetime-local" ${pending?'disabled':''}></td><td><input id="${entryId}-student" aria-label="Initials for ${esc(m.name)}" maxlength="12" placeholder="Initials" ${pending?'disabled':''}></td><td><label style="display:flex;align-items:center;gap:6px"><input id="${entryId}-given" type="checkbox" style="width:auto" ${pending?'disabled':''}> Given</label></td><td><button class="primary saveSimpleMar" data-medication-id="${esc(m.id)}" ${pending?'disabled':''}>Save</button></td></tr>`;
 }).join('');
 document.getElementById('view').innerHTML=panel('Medication Administration Record',`
  <div class="note">Enter the date and time, your initials, and check <b>Given</b> for each medication administered. Only released medications are visible to students.</div>
  <div style="overflow-x:auto"><table class="simpleMAR"><thead><tr><th>Medication</th><th>Dose</th><th>Route</th><th>Due</th><th>Date / Time Given</th><th>Initials</th><th>Given</th><th></th></tr></thead><tbody>${cells||'<tr><td colspan="8">No released medications are available.</td></tr>'}</tbody></table></div>
 `)+(heldBack.length?panel('Not Yet Released — Students Cannot See These',`<div class="note">These medications appear on the student MAR only after faculty releases them in Faculty Live Control.</div><ul>${heldBack.map(m=>`<li><b>${esc(m.name)}</b> ${esc(m.dose)} ${esc(m.route)} ${esc(m.scheduledTime||m.frequency)}${m.notes?` — ${esc(m.notes)}`:''}</li>`).join('')}</ul>`):'')+panel('MAR Administration History',`<table><thead><tr><th>Date / Time</th><th>Medication</th><th>Dose / Route</th><th>Due</th><th>Given</th><th>Initials</th></tr></thead><tbody>${administrations.map(row=>`<tr><td>${esc(row.time)}</td><td><b>${esc(row.medication)}</b></td><td>${esc(row.dose)} ${esc(row.route)}</td><td>${esc(row.due)}</td><td>${esc(row.status)}</td><td>${esc(row.student)}</td></tr>`).join('')||'<tr><td colspan="6">No medications have been charted.</td></tr>'}</tbody></table>`);
 document.querySelectorAll('.saveSimpleMar').forEach(button=>button.onclick=()=>{
  const med=meds.find(item=>item.id===button.dataset.medicationId),prefix=`marEntry-${med?.id}`;
  if(!med||!medicationReleased(med)){alert('This medication has not been released by faculty.');return;}
  const time=document.getElementById(`${prefix}-time`).value,student=document.getElementById(`${prefix}-student`).value.trim(),given=document.getElementById(`${prefix}-given`).checked;
  if(!time||!student||!given){alert('Enter the date and time, initials, and check Given before saving.');return;}
  state.mar.push({id:uid('mar'),patientId:p.id,medicationId:med.id,medication:med.name,dose:med.dose,route:med.route,due:med.scheduledTime||med.frequency,time,student,status:'Given',response:''});
  clearCurrentViewDraft();audit('Medication administration',p.id,`${med.name} ${med.dose} given by ${student}`);liveSave('medication_administration_documented',{patientId:p.id,medicationId:med.id});renderMAR();
 });
 setupDraft();
}
const bloodChecks=['Provider order verified','Consent verified','Patient identity and unit number checked','ABO/Rh compatibility confirmed','Expiration and product appearance checked','Baseline assessment and vital signs recorded','Independent double check completed'];
function renderGuidedBlood(){
 seedLinkedMedications();ensureMedicationData();if(!requirePatient())return;const p=activePatient(),units=(state.bloodUnits||[]).filter(u=>u.patientId===p.id&&u.status!=='Transfused');
 document.getElementById('view').innerHTML=panel('Blood Administration — Select Product',`<label>Available blood product<select id="gbUnit"><option value="">Select unit</option>${units.map(u=>`<option value="${esc(u.id)}">${esc(u.product)} · ${esc(u.unitType)} · Unit ${esc(u.unitNumber)}</option>`).join('')}</select></label>`)+panel('Blood Verification & Administration',`
 <div class="grid3">${scanFields('gbPatient','1. Scan wristband / enter patient code')}<label>Patient method<select id="gbPatientMethod"><option>Scanner</option><option>Manual code override</option></select></label><button id="gbVerifyPatient">Verify Patient</button></div><p id="gbPatientResult" role="status"></p>
 <div class="grid3">${scanFields('gbCode','2. Scan blood label / enter unit code')}<label>Blood method<select id="gbUnitMethod"><option>Scanner</option><option>Manual code override</option></select></label><button id="gbVerifyUnit">Verify Blood Unit</button></div><p id="gbUnitResult" role="status"></p>
 <fieldset><legend>Blood Administration Checklist</legend>${bloodChecks.map((text,i)=>`<label style="display:block"><input id="gbCheck${i}" type="checkbox" style="width:auto"> ${text}</label>`).join('')}</fieldset>
 <div class="grid3"><label>Administering student<input id="gbStudent"></label><label>Independent verifier<input id="gbVerifier"></label><label>Manual override reason<input id="gbReason"></label><label>Start time<input type="datetime-local" id="gbStart" value="${nowLocal()}"></label><label>Completion time<input type="datetime-local" id="gbEnd"></label><label>Volume (mL)<input id="gbVolume" type="number" min="0"></label><label>Baseline vital signs<input id="gbBaseline"></label><label>15-minute vital signs<input id="gb15"></label><label>Completion vital signs<input id="gbFinal"></label><label>Reaction<select id="gbReaction"><option>None</option><option>Suspected reaction — stopped</option><option>Confirmed reaction — stopped</option></select></label><label class="wide">Notes<textarea id="gbNotes"></textarea></label></div>
 <button id="gbComplete" data-complete class="primary">Complete and Save Blood Record</button><p id="gbResult" role="status"></p>`)+panel('Blood Administration Record',`<table><thead><tr><th>Start / End</th><th>Product / Unit</th><th>Volume</th><th>Reaction</th><th>Student / Verifier</th></tr></thead><tbody>${(state.bloodAdministration||[]).filter(r=>r.patientId===p.id).map(r=>`<tr><td>${esc(r.startTime)} / ${esc(r.endTime||'In progress')}</td><td>${esc(r.product)} / ${esc(r.unit)}</td><td>${esc(r.volume)}</td><td>${esc(r.reaction)}</td><td>${esc(r.student)} / ${esc(r.verifiedBy)}</td></tr>`).join('')||'<tr><td colspan="5">No blood administered.</td></tr>'}</tbody></table>`);
 const el=id=>document.getElementById(id),unit=()=>(state.bloodUnits||[]).find(u=>u.id===el('gbUnit').value&&u.patientId===p.id&&u.status!=='Transfused');let pv='',uv='';
 const invalid=()=>{pv='';uv='';el('gbPatientResult').textContent='';el('gbUnitResult').textContent='';};el('gbUnit').onchange=()=>{invalid();const previous=(state.bloodAdministration||[]).find(r=>r.bloodUnitId===el('gbUnit').value&&!r.endTime);const map={gbStudent:'student',gbVerifier:'verifiedBy',gbStart:'startTime',gbVolume:'volume',gbBaseline:'baselineVitals',gb15:'fifteenMinuteVitals',gbFinal:'completionVitals',gbNotes:'response'};if(previous){for(const [id,key] of Object.entries(map))el(id).value=previous[key]||'';}else{for(const id of ['gbVolume','gbBaseline','gb15','gbFinal','gbNotes'])el(id).value='';}for(let i=0;i<bloodChecks.length;i++)el('gbCheck'+i).checked=false;};el('gbPatient').oninput=invalid;el('gbCode').oninput=()=>{uv='';el('gbUnitResult').textContent='Verify the unit again.';};
 el('gbVerifyPatient').onclick=()=>{invalid();if(!unit()){el('gbPatientResult').textContent='Select an available blood product first.';return;}if(el('gbPatient').value.trim()!==state.patients.find(x=>x.id===p.id).barcode){el('gbPatientResult').textContent='Patient mismatch.';return;}pv=el('gbPatient').value.trim();el('gbPatientResult').textContent='Patient verified. Verify the blood unit next.';el('gbCode').focus();};
 el('gbVerifyUnit').onclick=()=>{uv='';const u=unit();if(!pv||pv!==el('gbPatient').value.trim()){el('gbUnitResult').textContent='Verify patient first.';return;}if(!u||u.barcode!==el('gbCode').value.trim()){el('gbUnitResult').textContent='Blood unit mismatch.';return;}if(!u.expiration||!Number.isFinite(Date.parse(u.expiration))||Date.parse(u.expiration)<=Date.now()){el('gbUnitResult').textContent='Blood unit expired or expiration missing. Contact faculty.';return;}uv=u.id;el('gbUnitResult').textContent=`Verified: ${u.product}, ${u.unitType}, unit ${u.unitNumber}. Complete the checklist and independent check.`;};
 for(const [input,button] of [['gbPatient','gbVerifyPatient'],['gbCode','gbVerifyUnit']])el(input).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();el(button).click();}};
 el('gbComplete').onclick=()=>{const u=unit(),student=el('gbStudent').value.trim(),verifier=el('gbVerifier').value.trim(),fail=t=>el('gbResult').textContent=t;
 if(!u||uv!==u.id||pv!==state.patients.find(x=>x.id===p.id).barcode||pv!==el('gbPatient').value.trim()||u.barcode!==el('gbCode').value.trim())return fail('Verify patient and blood unit before saving.');
 if(Date.parse(u.expiration)<=Date.now())return fail('Blood product has expired.');
 if(!student||!verifier||student.toLowerCase()===verifier.toLowerCase())return fail('Enter student and a different independent verifier.');
 if(!el('gbStart').value||!el('gbBaseline').value.trim()||!bloodChecks.every((_,i)=>el('gbCheck'+i).checked))return fail('Complete the checklist, start time, and baseline vital signs.');
 if(el('gbEnd').value&&el('gbEnd').value<el('gbStart').value)return fail('Completion time cannot be before start time.');
 if([el('gbPatientMethod').value,el('gbUnitMethod').value].some(v=>v.startsWith('Manual'))&&!el('gbReason').value.trim())return fail('Enter the manual override reason.');
 state.bloodAdministration||=[];const existing=state.bloodAdministration.find(r=>r.bloodUnitId===u.id&&!r.endTime),record={id:existing?.id||uid('blood'),patientId:p.id,product:u.product,unit:u.unitNumber,bloodUnitId:u.id,barcode:u.barcode,patientVerification:pv,bloodType:u.unitType,expiry:u.expiration,startTime:el('gbStart').value,endTime:el('gbEnd').value,volume:el('gbVolume').value,student,verifiedBy:verifier,reaction:el('gbReaction').value,baselineVitals:el('gbBaseline').value,fifteenMinuteVitals:el('gb15').value,completionVitals:el('gbFinal').value,response:el('gbNotes').value,checklist:bloodChecks.slice(),patientScanMethod:el('gbPatientMethod').value,bloodScanMethod:el('gbUnitMethod').value,overrideReason:el('gbReason').value};if(existing)Object.assign(existing,record);else state.bloodAdministration.push(record);u.status=el('gbEnd').value?'Transfused':'Started';clearCurrentViewDraft();audit('Blood administered',p.id,`Unit ${u.unitNumber}, verified by ${verifier}`);renderBloodAdministration();};setupDraft();
}
// Blood documentation follows the same direct-entry approach as the MAR.
// Students enter the verified unit number and verification time; no scanning
// is required to complete a simulated blood-administration record.
function renderSimpleBlood(){
 ensureMedicationData();if(!requirePatient())return;
 const p=activePatient();
 if(!['fatima-sanogo','stephanie-smith'].includes(p.id)){document.getElementById('view').innerHTML=panel('Blood Administration','No blood administration record is assigned to this patient.');return;}
 const units=(state.bloodUnits||[]).filter(unit=>unit.patientId===p.id&&unit.status!=='Transfused');
 const rows=(state.bloodAdministration||[]).filter(row=>row.patientId===p.id).slice().reverse();
 document.getElementById('view').innerHTML=panel('Blood Verification and Administration',`
  <div class="note">Enter the blood-product unit number and the date and time verification was completed. Electronic verification is not required.</div>
  <div class="grid3"><label>Blood Product<select id="sbProduct"><option value="">Select product</option>${units.map(unit=>`<option value="${esc(unit.id)}">${esc(unit.product)}${unit.unitType?` (${esc(unit.unitType)})`:''}</option>`).join('')}<option value="manual">Other / manually entered product</option></select></label><label>Unit Number<input id="sbUnit" placeholder="Enter blood-product unit number"></label><label>Verification Date / Time<input id="sbVerifiedAt" type="datetime-local" value="${nowLocal()}"></label><label>Administering Student / Initials<input id="sbStudent"></label><label>Independent Verifier<input id="sbVerifier"></label><label>Start Time<input id="sbStart" type="datetime-local" value="${nowLocal()}"></label><label>Completion Time<input id="sbEnd" type="datetime-local"></label><label>Volume (mL)<input id="sbVolume" type="number" min="0"></label><label>Reaction<select id="sbReaction"><option>None</option><option>Suspected reaction — stopped</option><option>Confirmed reaction — stopped</option></select></label><label>Baseline Vital Signs<input id="sbBaseline" placeholder="T / HR / RR / BP / SpO₂"></label><label>15-minute Vital Signs<input id="sb15" placeholder="T / HR / RR / BP / SpO₂"></label><label>Completion Vital Signs<input id="sbFinal" placeholder="T / HR / RR / BP / SpO₂"></label><label class="wide">Notes<textarea id="sbNotes"></textarea></label></div>
  <fieldset><legend>Blood Administration Checklist</legend>${bloodChecks.map((text,index)=>`<label style="display:block"><input id="sbCheck${index}" type="checkbox" style="width:auto"> ${text}</label>`).join('')}</fieldset>
  <div class="actions"><button id="sbSave" data-complete class="primary">Complete and Save Blood Record</button></div><p id="sbResult" role="status"></p>
 `)+panel('Blood Administration Record',`<table><thead><tr><th>Verification Date / Time</th><th>Product / Unit Number</th><th>Start / End</th><th>Volume</th><th>Student / Verifier</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.verifiedAt||'')}</td><td>${esc(row.product)}<br>${esc(row.unit)}</td><td>${esc(row.startTime)} / ${esc(row.endTime||'In progress')}</td><td>${esc(row.volume||'')}</td><td>${esc(row.student)} / ${esc(row.verifiedBy)}</td></tr>`).join('')||'<tr><td colspan="5">No blood products documented.</td></tr>'}</tbody></table>`);
 const el=id=>document.getElementById(id);
 el('sbProduct').onchange=()=>{const selected=units.find(unit=>unit.id===el('sbProduct').value);if(selected){el('sbUnit').value=selected.unitNumber||'';}};
 el('sbSave').onclick=()=>{
  const selected=units.find(unit=>unit.id===el('sbProduct').value),unit=el('sbUnit').value.trim(),verifiedAt=el('sbVerifiedAt').value,student=el('sbStudent').value.trim(),verifier=el('sbVerifier').value.trim();
  const fail=text=>{el('sbResult').textContent=text;};
  if(!unit||!verifiedAt||!student||!verifier)return fail('Enter the unit number, verification date and time, administering student, and independent verifier.');
  if(student.toLowerCase()===verifier.toLowerCase())return fail('A different independent verifier is required.');
  if(!el('sbStart').value||!el('sbBaseline').value.trim()||!bloodChecks.every((_,index)=>el(`sbCheck${index}`).checked))return fail('Complete the checklist, start time, and baseline vital signs.');
  if(el('sbEnd').value&&el('sbEnd').value<el('sbStart').value)return fail('Completion time cannot be before start time.');
  const product=selected?.product||(el('sbProduct').value==='manual'?'Blood product':el('sbProduct').value||'Blood product');
  const record={id:uid('blood'),patientId:p.id,product,unit,bloodUnitId:selected?.id||'',barcode:selected?.barcode||'',bloodType:selected?.unitType||'',expiry:selected?.expiration||'',verifiedAt,startTime:el('sbStart').value,endTime:el('sbEnd').value,volume:el('sbVolume').value,student,verifiedBy:verifier,reaction:el('sbReaction').value,baselineVitals:el('sbBaseline').value.trim(),fifteenMinuteVitals:el('sb15').value.trim(),completionVitals:el('sbFinal').value.trim(),response:el('sbNotes').value.trim(),checklist:bloodChecks.slice()};
  state.bloodAdministration||=[];state.bloodAdministration.push(record);if(selected)selected.status=el('sbEnd').value?'Transfused':'Started';clearCurrentViewDraft();audit('Blood administration',p.id,`${product}, unit ${unit}, verified ${verifiedAt}`);liveSave('blood_administration_documented',{patientId:p.id,bloodUnitId:selected?.id||''});renderBloodAdministration();
 };
 setupDraft();
}
function facultyLayout(){
 const root=document.getElementById('view');if(!isFaculty()||!activePatient())return;
 document.getElementById('saveSimulationBase')?.remove();document.getElementById('resetPatient')?.remove();
 root.insertAdjacentHTML('afterbegin',panel('Simulation Controls',`<div class="actions"><button id="simResetBase" class="danger">Reset Patient for New Simulation</button><button id="simUpdateBase" class="primary">Update Base Patient</button></div><p class="note">Reset restores the saved starting chart, or the built-in starting chart if no base has been saved. Updating the base keeps faculty content and excludes student documentation.</p>`));
 document.getElementById('simResetBase').onclick=()=>{if(confirm('Return this patient to the simulation starting chart and clear student documentation?')){resetToBase(activePatientId);dirty=false;renderFaculty();}};
 document.getElementById('simUpdateBase').onclick=()=>{if(confirm('Update this patient’s starting chart with the current faculty content? Student documentation will not be included.')){updateBase(activePatientId);dirty=false;renderFaculty();}};
 const panels=[...root.querySelectorAll(':scope > .panel')],messaging=panels.find(p=>p.querySelector('h2')?.textContent.includes('Message'));
 if(messaging)root.children[0].after(messaging);
 const pendingPanels=panels.filter(p=>/^(Chart Updates|Other Pending Releases|Edit Pending Releases)/.test(p.querySelector('h2')?.textContent||''));
 let pendingAnchor=messaging||root.children[0];
 for(const pending of pendingPanels){pendingAnchor.after(pending);pendingAnchor=pending;}
 // Pending structured data use the same labeled fields as completed chart data.
 for(const card of root.querySelectorAll('[data-edit-pending]')){
  const item=state.releaseQueue.find(x=>x.id===card.dataset.editPending);
  if(item?.rowData){
   const editable=Object.entries(item.rowData).filter(([k,v])=>!['id','patientId','barcode','releaseStatus','status','sourceOrderId'].includes(k)&&['string','number','boolean'].includes(typeof v));
   card.querySelector('.actions').insertAdjacentHTML('beforebegin',`<div class="grid3">${editable.map(([k,v])=>`<label>${esc(k.replace(/([A-Z])/g,' $1'))}<input data-pending-field="${esc(k)}" value="${esc(v)}"></label>`).join('')}</div>`);
   const sync=()=>{for(const input of card.querySelectorAll('[data-pending-field]')){const k=input.dataset.pendingField,original=item.rowData[k];item.rowData[k]=typeof original==='number'?Number(input.value):typeof original==='boolean'?input.value==='true':input.value;}const existing=(state[item.targetCollection]||[]).find(x=>x.id===item.rowData.id);if(existing)Object.assign(existing,item.rowData);};
   for(const cls of ['pendingSave','pendingRelease']){const button=card.querySelector('.'+cls),original=button.onclick;button.onclick=()=>{sync();original();};}
  }
 }
 // Readable chart content is shown first, with editing controls alongside each area.
 for(const card of root.querySelectorAll('[data-admin-record],[data-live-collection]')){
  const record=card.dataset.adminRecord?CHART_RECORDS.find(r=>r.id===card.dataset.adminRecord):null;
  const title=record?.title||card.querySelector('b')?.textContent||'Chart entry';
  const preview=document.createElement('div');preview.className='chartRecordBody';
  if(record)preview.innerHTML=renderChartDoc(currentChartDates(record.content));
  else{const row=(state[card.dataset.liveCollection]||[]).find(r=>r.id===card.dataset.liveId);preview.innerHTML=`<dl>${Object.entries(row||{}).filter(([k,v])=>!['id','patientId'].includes(k)&&v!==null&&typeof v!=='object').map(([k,v])=>`<dt><b>${esc(k.replace(/([A-Z])/g,' $1'))}</b></dt><dd>${esc(v)}</dd>`).join('')}</dl>`;}
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Edit '+title;details.append(summary);while(card.firstChild)details.append(card.firstChild);card.append(preview,details);
 }
 const profile=root.querySelector('#savePatientProfile')?.closest('.panel');if(profile){const body=profile.querySelector('.body');const details=document.createElement('details');details.innerHTML='<summary>Edit Patient Profile</summary>';const preview=document.createElement('p');preview.textContent=`${activePatient().name} · MRN ${activePatient().mrn} · ${activePatient().primaryDiagnosis||''}`;while(body.firstChild)details.append(body.firstChild);body.append(preview,details);}
 setupDraft();
}
window.initializeSimulationWorkflows=function(){
 initDrafts();seedLinkedMedications();ensureMedicationData();
 const originalRelease=releaseItem;releaseItem=function(id){const item=state.releaseQueue.find(x=>x.id===id);originalRelease(id);if(item?.status!=='released')return;const names=chartMedicationLinks[item.chartRecordId]||[],stopped=chartMedicationDiscontinues[item.chartRecordId]||[];for(const med of state.medicationCatalog.filter(m=>m.patientId===item.patientId&&stopped.includes(m.name)))med.status='Discontinued';for(const med of state.medicationCatalog.filter(m=>m.patientId===item.patientId&&names.includes(m.name))){med.releaseStatus='released';if(med.status==='Pending')med.status='Due';for(const q of state.releaseQueue)if(q.rowData?.id===med.id&&q.targetCollection==='medicationCatalog'){q.status='released';q.releasedAt=nowLocal();}}if(names.length||stopped.length)liveSave('medication_orders_released',{patientId:item.patientId});};
 const originalChartDoc=renderChartDoc;renderChartDoc=function(content){return originalChartDoc(currentChartDates(content));};
 const cards=chartRecordCards;chartRecordCards=function(records){return cards(records.map(r=>({...r,content:currentChartDates(r.content)})));};
 const faculty=renderFaculty;renderFaculty=function(){faculty();facultyLayout();};
 renderMAR=renderSimpleMAR;renderBloodAdministration=renderSimpleBlood;
 // Completion labels and draft restoration apply to direct form redraws as well as navigation.
 for(const name of ['renderFlowsheets','renderIO','renderNotes','renderEducation','renderAssessments','renderPEWS','renderLabor','renderPostpartum','renderSurgery']){
  if(typeof window[name]!=='function')continue;const fn=window[name];window[name]=function(...args){fn(...args);setupDraft();};
 }
 const previousRender=render;render=function(){rendering=true;try{previousRender();}finally{rendering=false;}setupDraft();};
 window.refreshSimulationRecords=function(){for(const [pid,defaults] of Object.entries(SIMULATION_DEFAULTS)){const base=state.simulationBases?.[pid]||defaults;for(const collection of ['orders','labs','labPanels']){const baselineIds=new Set((base.collections[collection]||[]).map(r=>r.id));for(const row of state[collection]||[])if(baselineIds.has(row.id))for(const field of ['time','date'])if(typeof row[field]==='string'&&/^\d{4}-\d{2}-\d{2}/.test(row[field]))row[field]=today()+row[field].slice(10);}}for(const r of CHART_RECORDS){const edit=state.chartContentEdits?.[r.id];if(edit)Object.assign(r,edit);}for(const r of state.customChartRecords||[])if(!CHART_RECORDS.some(x=>x.id===r.id))CHART_RECORDS.push(copy(r));window.migrateCarlProfile?.();window.migrateRuthProfile?.();};window.refreshSimulationRecords();
};
})();
