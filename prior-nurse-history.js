/* Faculty-approved prior-nurse history shares the ordinary MAR and chart transport. */
(function(){
 const copy=x=>JSON.parse(JSON.stringify(x));
 const specs=[],add=(patientId,shift,key,match,dose,route,status,time='',context='',extra={})=>specs.push({patientId,shift,key,match,dose,route,status,time,context,...extra});
 const a='amelia-sung',f='fatima-sanogo',m='molly-thomas',s='stephanie-smith',c='charles-jones',r='ruth-livingston',v='vernon-watkins',d='david-carter';
 add(a,1,'lr',/^Lactated Ringer.*\(LR\)$/,'125 mL/hr','IV infusion','Infusing','','Admission, 2 hours before report');
 add(a,1,'pitocin',/^Oxytocin/,'6 milliunits/min','IV infusion','Infusing','','Admission, 2 hours before report');
 add(a,1,'epidural',/^Bupivacaine/,'Bupivacaine 0.1% with fentanyl 2 mcg/mL at 10 mL/hr','Epidural','Infusing','','Just before report',{student:'Anesthesia'});
 add(a,2,'clindamycin',/^Clindamycin/,'900 mg','IVPB','Given','','Shift 1, morning');
 add(a,2,'lr-bolus',/^Lactated Ringer.*bolus/,'500 mL','IV bolus','Given','','Shift 1, after decelerations');
 add(a,2,'pitocin-stop',/^Oxytocin/,'','IV infusion','Stopped','','Shift 1');
 add(f,1,'lr',/^Lactated Ringer/,'125 mL/hr','IV infusion','Infusing','','Running at report');
 add(f,1,'pitocin',/^Oxytocin/,'30 units/500 mL at 334 mL/hr','IV infusion','Infusing','12:45','After placenta delivery');
 add(f,2,'methergine',/^Methylergonovine/,'0.2 mg','IM','Given','','Shift 1; Shift 2 report states medication given, followed by seizure');
 add(m,2,'saline',/^Sodium chloride 0.9/,'140 mL (20 mL/kg × 7 kg)','IV bolus','Given','','Shift 1');
 add(m,2,'dexamethasone',/^Dexamethasone/,'4.2 mg (0.6 mg/kg × 7 kg)','IV','Given','','Shift 1');
 add(m,2,'epinephrine',/^Racepinephrine/,'2.25%','Nebulizer','Given','','Shift 1');
 add(s,2,'fluid',/^Dextrose 5%/,'150 mL/hr','IV infusion','Infusing','','Shift 1');
 add(s,2,'morphine',/^Morphine/,'5 mg','IV','Given','','Shift 1, chest pain 9/10');
 add(s,3,'prbc',/^Packed red blood cells/,'1 unit','IV','Started','','Shift 2',{blood:true});
 add(c,2,'lisinopril',/^Lisinopril/,'20 mg','PO','Held','','Shift 1 morning');
 add(c,2,'metoprolol',/^Metoprolol/,'50 mg','PO','Held','','Shift 1 morning; existing metoprolol order retained');
 add(c,2,'spironolactone',/^Spironolactone/,'12.5 mg','PO','Held','','Shift 1 morning');
 // Charles has no matching bolus, Lasix or D50 order. Do not fabricate them.
 add(r,1,'oxycodone',/^Oxycodone 15/,'15 mg','PO','Given','02:00');
 add(r,1,'acetaminophen',/^Acetaminophen 650/,'650 mg','PO','Given','06:00','For fever');
 add(r,1,'pip-tazo',/^Piperacillin/,'450 mg','IVPB','Given','06:00');
 add(r,1,'lr',/^Lactated Ringer/,'75 mL/hr','IV infusion','Infusing','07:00','Running at report; start time unspecified');
 add(r,1,'docusate',/^Docusate/,'100 mg','PO','Given','09:00','Faculty-specified prior dose');
 add(r,1,'calcium',/^Calcium carbonate/,'650 mg','PO','Given','09:00','Faculty-specified prior dose');
 for(const pid of ['carl-shapiro','karl-sharp']){
  add(pid,1,'aspirin',/^Aspirin 325/,'325 mg, chewed','PO','Given','13:00','ED, approximately 1300');
  add(pid,1,'nitroglycerin',/^Nitroglycerin/,'0.4 mg × 2 doses','SL','Given','13:00','ED, approximately 1300; individual dose times unspecified');
  add(pid,1,'saline-bolus',/^Normal saline 500 mL bolus/,'500 mL','IV bolus','Given','13:00','ED, after second nitroglycerin dose, approximately 1300');
  add(pid,1,'ticagrelor',/^Ticagrelor 180/,'180 mg','PO','Given','13:00','ED, approximately 1300');
  add(pid,1,'enoxaparin',/^Enoxaparin 110/,'110 mg','SQ','Given','13:00','ED, approximately 1300');
  add(pid,1,'saline',/^Normal saline at 25/,'25 mL/hr','IV infusion','Infusing','15:00','Running at report; start time unspecified');
 }
 add(v,1,'metronidazole',/^Metronidazole/,'500 mg','IVPB','Given','06:00');
 add(v,1,'oxycodone',/^Oxycodone 5 mg/,'5 mg','PO','Given','07:15','About 2 hours before 0915 report; pain 5');
 add(v,1,'acetaminophen',/^Acetaminophen 1 g/,'1 g','PO','Given','08:00');
 add(v,1,'gabapentin-midnight',/^Gabapentin/,'300 mg','PO','Given','00:00');
 add(v,1,'gabapentin-morning',/^Gabapentin/,'300 mg','PO','Given','08:00');
 add(v,1,'hctz',/^Hydrochlorothiazide/,'25 mg','PO','Given','09:00');
 add(v,1,'ciprofloxacin',/^Ciprofloxacin/,'400 mg','IVPB','Given','09:00');
 add(v,1,'enoxaparin',/^Enoxaparin 40/,'40 mg','SQ','Given','09:00');
 add(v,1,'saline',/^Normal saline 1000/,'100 mL/hr','IV infusion','Infusing','09:15','Running at report; start time unspecified');
 add(d,1,'olanzapine',/^Olanzapine/,'10 mg','PO','Given','19:00','Taken with coaxing');
 add(d,1,'venlafaxine',/^Venlafaxine/,'75 mg','PO','Given','19:00','Taken with coaxing');
 const initial=pid=>pid==='baby-boy-sung'?3:1;
 const maxShift=pid=>({[a]:2,[f]:2,[m]:2,[s]:3,[c]:4,'baby-boy-sung':3}[pid]||1);
 const date=()=>nowLocal().slice(0,10);
 const seedId=e=>'prior-nurse:'+e.patientId+':'+e.shift+':'+e.key;
 const importedIds=new Set(['chart-25d195d201d58159b626d7195817727a','chart-25d195d201d58169a4a1ef26c15346fb','chart-25d195d201d5816fb8a9eb0e7e5bb4fd','chart-262195d201d581edb5f5f60cca674b30','chart-277195d201d5810dabe3e85e091850fa']);
 function importedContent(r){
  if(!importedIds.has(r.id)||typeof r.content!=='string')return;
  r.content=r.content.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi,tr=>{
   const cells=[...tr.matchAll(/<td>([\s\S]*?)<\/td>/gi)].map(m=>m[1]);if(cells.length<4)return tr;
   const name=cells[0];for(let i=1;i<cells.length;i++)if(/^\s*(LJ|CR)\s*$/i.test(cells[i]))cells[i]='LB';
   if(r.patientId==='david-carter'){if(/Olanzapine|Venlafaxine/i.test(name)){cells[2]='1900';cells[3]='LB';}if(/Lorazepam/i.test(name)){cells[2]='';cells[3]='';}}
   if(r.patientId==='vernon-watkins'){if(/Acetaminophen/i.test(name)){cells[2]='0800';cells[3]='LB';cells[4]='';cells[5]='';}if(/Gabapentin/i.test(name))cells[2]='0000';if(/Oxycodone 5 /i.test(name)){cells[2]='0715';cells[3]='LB';}}
   if(r.patientId==='ruth-livingston'&&/^LR /i.test(name))cells[2]='0700 (running at report)';
   if(['carl-shapiro','karl-sharp'].includes(r.patientId)){
    if(/Enoxaparin|given in ER/i.test(name+' '+cells[1])){cells[2]='1300 (approximately)';cells[3]='LB';}
    if(/Normal Saline @ 25/i.test(name)){cells[2]='1500 (running at report)';cells[3]='LB';}
   }
   let i=0;return tr.replace(/<td>[\s\S]*?<\/td>/gi,()=>'<td>'+cells[i++]+'</td>');
  });
 }
 window.normalizePriorNurseDocument=importedContent;
 function studentMatches(row,e,med){
  if(row.seeded||row.origin==='prior-nurse'||row.source==='prior-nurse'||row.patientId!==e.patientId)return false;
  if(row.medicationId!==med.id&&row.medication!==med.name)return false;
  if(row.shiftNumber&&Number(row.shiftNumber)!==e.shift-1)return false;
  if(e.status==='Stopped')return row.status==='Stopped';
  if(e.status==='Held')return row.status==='Held';
  return ['Given','Infusing','Started'].includes(row.status);
 }
 function hasStudentDose(st,e,med){return (st.mar||[]).some(row=>studentMatches(row,e,med))||(e.blood&&(st.bloodAdministration||[]).some(row=>row.patientId===e.patientId&&!row.seeded&&(!row.shiftNumber||Number(row.shiftNumber)===e.shift-1)));}
 function removeReplacedSeeds(st){
  const removed=new Set();for(const e of specs.filter(e=>e.shift>1)){const med=(st.medicationCatalog||[]).find(m=>m.patientId===e.patientId&&e.match.test(m.name));if(med&&hasStudentDose(st,e,med))removed.add(seedId(e));}
  if(removed.size){st.mar=(st.mar||[]).filter(row=>!removed.has(row.id));st.bloodAdministration=(st.bloodAdministration||[]).filter(row=>!removed.has(row.id));}
  return st;
 }
 window.reconcilePriorNurseState=removeReplacedSeeds;
 function seed(pid,shift){
  const clock=state.simulationShifts[pid];state.mar||=[];
  const missing=[];
  for(const e of specs.filter(e=>e.patientId===pid&&e.shift===shift)){
   const med=state.medicationCatalog.find(m=>m.patientId===pid&&e.match.test(m.name));
   if(!med){missing.push(e.key);continue;}
   const existing=state.mar.find(r=>r.id===seedId(e));
   if(existing){if(shift===1&&existing.seeded)existing.time=e.time?clock.date+'T'+e.time:'';continue;}
   if(e.shift>1&&hasStudentDose(state,e,med))continue;
   const row={id:seedId(e),patientId:pid,medicationId:med.id,medication:med.name,dose:e.dose,route:e.route,due:med.scheduledTime||med.frequency||'',time:e.time?clock.date+'T'+e.time:'',timeLabel:e.time?'':'Time unspecified',student:e.student||'LB',initials:e.student||'LB',status:e.status,seeded:true,source:'prior-nurse',origin:'prior-nurse',readOnly:true,appearShift:shift,shiftNumber:shift===1?1:shift-1,priorDoseKey:e.key,response:[e.student?'Started by anesthesia.':'Prior-nurse history.',e.context].filter(Boolean).join(' ')};
   state.mar.push(row);
   if(e.blood){state.bloodAdministration||=[];state.bloodAdministration.push({...row,product:'Packed red blood cells',bloodType:'A-',unit:'Unit number unspecified',startTime:'',endTime:'',volume:'',verifiedBy:'',response:'Prior-shift history: 1 unit A− PRBC started in Shift 2. Time and unit number unspecified; not a new student verification.'});}
  }
  removeReplacedSeeds(state);return missing;
 }
 window.PRIOR_NURSE_SPECS=specs;
 window.resetPriorNurseForPatient=function(pid){
  if(pid==='vincent-brody'||pid==='jane-fowler')return;
  state.simulationShifts||={};state.simulationShifts[pid]={shift:initial(pid),date:date(),startedAt:nowLocal()};
  state.mar=state.mar.filter(r=>!(r.patientId===pid&&r.seeded&&r.source==='prior-nurse'));
  state.bloodAdministration=(state.bloodAdministration||[]).filter(r=>!(r.patientId===pid&&r.seeded));seed(pid,initial(pid));
 };
 window.applyPriorNurseHistory=function(){
  for(const r of CHART_RECORDS)importedContent(r);
  for(const r of state.customChartRecords||[])importedContent(r);
  for(const [id,edit] of Object.entries(state.chartContentEdits||{})){const r=CHART_RECORDS.find(r=>r.id===id);if(r){const copyRow={...r,...edit};importedContent(copyRow);if(edit.content!==undefined)edit.content=copyRow.content;}}
  state.simulationShifts||={};
  for(const pid of new Set(specs.map(e=>e.patientId))){state.simulationShifts[pid]||={shift:initial(pid),date:date(),startedAt:nowLocal()};seed(pid,1);}
  state.simulationShifts['baby-boy-sung']||={shift:3,date:date(),startedAt:nowLocal()};
  for(const m of state.medicationCatalog)if(specs.some(e=>e.patientId===m.patientId&&e.match.test(m.name)))m.previouslyGiven='';
  for(const [pid,b] of Object.entries(state.simulationBases||{}))if(pid!=='vincent-brody'&&pid!=='jane-fowler'){
   for(const r of b.chartRecords||[])importedContent(r);
   b.collections.mar=(b.collections.mar||[]).filter(r=>!r.seeded).concat(copy(state.mar.filter(r=>r.patientId===pid&&r.seeded&&r.appearShift===1)));
  }
 };
 window.startSimulationShift=function(pid,next){
  if(!isFaculty())return {ok:false,error:'Only faculty can start a shift.'};
  const current=state.simulationShifts?.[pid]?.shift||initial(pid);next=Number(next);
  if(next!==current+1||next>maxShift(pid))return {ok:false,error:'Start the next shift in sequence. Reset the patient to begin again.'};
  // Pull saved changes before checking for a student-documented dose.
  reloadSharedState();
  const latest=state.simulationShifts?.[pid]?.shift||initial(pid);if(next!==latest+1)return {ok:false,error:'This shift was already started on another computer.'};
  const before=copy(state);
  state.simulationShifts||={};state.simulationShifts[pid]={...(state.simulationShifts[pid]||{}),shift:next,date:state.simulationShifts[pid]?.date||date(),startedAt:nowLocal()};
  const missing=seed(pid,next);
  if(pid===a&&next===2){for(const med of state.medicationCatalog.filter(m=>m.patientId===pid&&/^Oxytocin/.test(m.name))){med.status='Discontinued';const order=state.orders.find(o=>o.id===med.sourceOrderId||o.medicationId===med.id);if(order)order.status='Discontinued';}}
  const id='shift-start:'+pid+':'+(state.patientResetEpochs?.[pid]||0)+':'+next;
  state.notifications||=[];if(!state.notifications.some(n=>n.id===id))state.notifications.push({id,patientId:pid,type:'shift-start',title:'Shift '+next+' started',body:'Faculty started Shift '+next+'. Review the updated prior-shift medication history.',read:false,createdAt:nowLocal()});
  try{liveSave('simulation_shift_started',{patientId:pid,shift:next});return {ok:true,missing};}catch(error){state=before;return {ok:false,error:'Shift was not saved: '+error.message};}
 };
 window.medicationDisplayHistory=m=>(state.mar||[]).filter(r=>r.patientId===m.patientId&&(r.medicationId===m.id||!r.medicationId&&r.medication===m.name));
 window.priorHistoryTime=r=>r.time||r.timeLabel||'Time unspecified';
 window.renderShiftControls=function(){
  if(!isFaculty()||!activePatient()||activePatientId==='vincent-brody'||activePatientId==='jane-fowler')return;
  const pid=activePatientId,current=state.simulationShifts?.[pid]?.shift||initial(pid),next=current+1;
  const root=document.querySelector('#view .panel .actions');if(!root)return;
  root.insertAdjacentHTML('beforeend',`<span id="simulationShiftStatus">Current shift: ${current}</span>${next<=maxShift(pid)?`<button id="startSimulationShift" class="secondary">Start Shift ${next}</button>`:''}<span id="simulationShiftResult" role="status"></span>`);
  const button=document.getElementById('startSimulationShift');if(button)button.onclick=()=>{const result=startSimulationShift(pid,next);if(result.ok)renderFaculty();else document.getElementById('simulationShiftResult').textContent=result.error;};
 };
})();
