/* October 16 Level 3 faculty decisions. Vincent is intentionally excluded. */
(function(){
 const copy=x=>JSON.parse(JSON.stringify(x));
 const retired=['chart-25d195d201d5813d8944d02d7166f91c','chart-25d195d201d58164b326d9be8612eae5','chart-25d195d201d581aa9910c83836fe6b07'];
 const targets=['ruth-livingston','carl-shapiro','karl-sharp','vernon-watkins','david-carter'];
 const patches={'carl-shapiro':{age:'64'},'karl-sharp':{mrn:'PCS71901',provider:'Dr. Chin A. Revis',weightKg:110,heightCm:175,codeStatus:'DNR'},'ruth-livingston':{maritalStatus:'Widowed',partner:''}};
 function content(pid,s){
  if(typeof s!=='string')return s;
  if(pid==='carl-shapiro')s=s.replace(/\b54(?=[ -]*(?:year|yr))/gi,'64').replace(/year old mail/g,'year old male');
  if(pid==='karl-sharp')s=s.replace(/SIM-L3-004/g,'PCS71901').replace(/Simulation Faculty/g,'Dr. Chin A. Revis');
  if(pid==='david-carter')s=s.replace(/27 yr old/g,'28 yr old').replace(/Left lower leg pain and fever/g,'Violent outburst and active hallucinations/delusions');
  if(pid==='vernon-watkins')s=s.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi,tr=>/Acetaminophen/i.test(tr)?tr.replace(/q\s*8\s*(?:hours|hrs)|every 8 hours/gi,'every 12 hours').replace(/0000\s*0800\s*1600/g,'0800 2000'):tr);
  return s;
 }
 window.LEVEL3_OCTOBER={retired,targets,patches,content};
 function cleanRows(rows){return (rows||[]).filter(r=>!retired.includes(r.id)&&!retired.includes(r.chartRecordId)&&!retired.includes(r.sourceChartRecordId)&&!retired.some(id=>String(r.id||'').startsWith('blood-mar-'+id)));}
 window.applyLevel3October=function(){
  for(let i=CHART_RECORDS.length-1;i>=0;i--)if(retired.includes(CHART_RECORDS[i].id))CHART_RECORDS.splice(i,1);
  for(const p of state.patients)if(patches[p.id]){if(p.id==='karl-sharp')p.legacyMrns=[...new Set([...(p.legacyMrns||[]),'SIM-L3-004'])];Object.assign(p,patches[p.id]);}
  const tylenol=state.medicationCatalog.filter(m=>m.patientId==='vernon-watkins'&&/^Acetaminophen 1 g/.test(m.name));
  const keeper=tylenol.find(m=>m.barcode==='1092')||tylenol[0];
  if(keeper){const duplicates=tylenol.filter(m=>m!==keeper);for(const r of state.mar||[])if(duplicates.some(m=>m.id===r.medicationId))r.medicationId=keeper.id;state.medicationCatalog=state.medicationCatalog.filter(m=>!duplicates.includes(m));Object.assign(keeper,{name:'Acetaminophen 1 g every 12 hours',dose:'1 g',route:'PO',frequency:'Every 12 hours',scheduledTime:'0800, 2000',status:'Active',packageIds:['MED-ACET325']});}
  for(const key of ['customChartRecords','orders','medicationCatalog','releaseQueue']){
   state[key]=cleanRows(state[key]);
   for(const r of state[key])if(targets.includes(r.patientId)){
    for(const field of ['text','content','title','provider'])if(typeof r[field]==='string')r[field]=content(r.patientId,r[field]);
    const canonical=CHART_RECORDS.find(x=>x.id===(r.chartRecordId||r.id));if(canonical&&r.content!==undefined)r.content=canonical.content;
    if(r.patientId==='karl-sharp'&&r.provider==='Simulation Faculty')r.provider='Dr. Chin A. Revis';
   }
  }
  for(const id of retired)delete state.chartContentEdits?.[id];
  for(const r of CHART_RECORDS.filter(r=>targets.includes(r.patientId)))if(state.chartContentEdits?.[r.id])state.chartContentEdits[r.id]={...state.chartContentEdits[r.id],content:r.content};
  for(const m of state.medicationCatalog){
   if(m.patientId==='david-carter'&&/Olanzapine|Venlafaxine/.test(m.name))Object.assign(m,{scheduledTime:'1900',frequency:'1900',previouslyGiven:''});
   if(m.patientId==='david-carter'&&/Lorazepam/.test(m.name))m.previouslyGiven='';
   if(m.id==='vernon-heparin-infusion')m.notes='Bag: 25,000 units/500 mL. Enter the rate from the released protocol. Hold enoxaparin while on heparin.';
  }
  state.mar=(state.mar||[]).filter(r=>!(r.patientId==='david-carter'&&/lorazepam/i.test(r.medication||'')&&!r.time&&!r.submissionId));
  ensureMedicationData();ensureMedicationPackages();
  const bag=state.medicationPackages.find(p=>p.id==='MED-HEPINF');if(bag)bag.strength='25,000 units/500 mL';
  for(const pid of targets){const b=state.simulationBases?.[pid];if(!b)continue;
   if(patches[pid])Object.assign(b.patient,patches[pid]);
   b.chartRecords=cleanRows(b.chartRecords).map(r=>copy(CHART_RECORDS.find(c=>c.id===r.id)||r));
   for(const r of CHART_RECORDS.filter(r=>r.patientId===pid&&r.id.startsWith('oct16-l3-')))if(!b.chartRecords.some(c=>c.id===r.id))b.chartRecords.push(copy(r));
   b.releaseQueue=cleanRows(b.releaseQueue);for(const q of b.releaseQueue){const c=CHART_RECORDS.find(r=>r.id===q.chartRecordId);if(c)q.content=c.content;}
   b.collections.medicationCatalog=cleanRows(b.collections.medicationCatalog).map(m=>{const current=state.medicationCatalog.find(x=>x.id===m.id);return current?{...m,name:current.name,dose:current.dose,scheduledTime:current.scheduledTime,frequency:current.frequency,provider:current.provider,notes:current.notes,...(/^Acetaminophen 1 g/.test(current.name)?{status:'Active',packageIds:['MED-ACET325']}:{})}:m;});
   for(const m of state.medicationCatalog.filter(m=>m.patientId===pid&&m.id.startsWith('oct16-l3-')))if(!b.collections.medicationCatalog.some(x=>x.id===m.id))b.collections.medicationCatalog.push(copy(m));
   b.collections.mar=(b.collections.mar||[]).filter(r=>!(pid==='david-carter'&&/lorazepam/i.test(r.medication||'')&&!r.time));
  }
 };
})();

window.CHART_MEDICATION_DEFAULTS=(window.CHART_MEDICATION_DEFAULTS||[]).concat([
 {id:'oct16-l3-vernon-fluid-mar',patientId:'vernon-watkins',name:'Normal saline 1000 mL at 100 mL/hr',dose:'100 mL/hr',route:'IV infusion',frequency:'Continuous',sourceChartRecordId:'oct16-l3-vernon-fluid',packageIds:['MED-0020']},
 {id:'oct16-l3-carl-aspirin',patientId:'carl-shapiro',name:'Aspirin 325 mg, chewed',dose:'325 mg',route:'PO',frequency:'Once in ED',sourceChartRecordId:'oct16-l3-carl-ed',packageIds:['MED-0049']},
 {id:'oct16-l3-carl-bolus',patientId:'carl-shapiro',name:'Normal saline 500 mL bolus',dose:'500 mL',route:'IV bolus',frequency:'Once in ED',sourceChartRecordId:'oct16-l3-carl-ed',packageIds:['MED-0020']}
]);
