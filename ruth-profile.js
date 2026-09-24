/* Editable Ruth additions, transcribed from the Notion sources listed in SOURCE-AUDIT.md.
   Keep record IDs stable. 'pending' means faculty must release the record. */
window.RUTH_PROFILE_RECORDS = (() => {
 const patientId='ruth-livingston';
 const source=id=>`https://app.notion.com/p/nursing-chart/${id}`;
 const table=(headers,rows)=>'<table><tr>'+headers.map(x=>`<td>${x}</td>`).join('')+'</tr>'+rows.map(row=>'<tr>'+row.map(x=>`<td>${x}</td>`).join('')+'</tr>').join('')+'</table>';
 const cbc=[['Hb (14–18 g/dL)','9.0*','10.0*','10.2*'],['HCT (42–50%)','27*','29*','29.5*'],['Platelets (150–400 × 10^9/L)','180','175','170'],['WBC (4–11 × 10^9/L)','11.4*','15.7*','16.0*']];
 const chemistry=[['Na+ (136–145 mEq/L)','138','136'],['K+ (3.5–5.0 mEq/L)','3.7','3.6'],['Cl− (98–106 mEq/L)','105','1.5 [source value; faculty verification required]'],['Calcium total (8.6–10.2 mg/dL)','8.6','8.5*'],['HCO3− (23–28 mEq/L)','29*','19*'],['BUN (8–20 mg/dL)','24*','25*'],['Creatinine (0.7–1.3 mg/dL)','1.5*','1.5*'],['Glucose (70–99 mg/dL fasting)','98','100'],['Lactate, venous (0.5–2.2 mmol/L)','5.0*','5.1*']];
 const baseline='## Ruth Livingston — Laboratory report\n\n'+table(['Test','Yesterday 0600','Today 0600'],cbc.map(r=>r.slice(0,3)))+'\n\n'+table(['Test','Today 0600'],chemistry.map(r=>r.slice(0,2)))+'\n\nBlood culture: pending. Blood type: A+. * Asterisks and reference ranges retained from the source.';
 const record=(id,title,category,status,content)=>({id:'chart-'+id,patientId,title,category,status,content});
 return [
  record('25d195d201d581f58678f1d549846bc0','Lab Results','labs','released',baseline),
  record('25d195d201d5819ba68ad680b4eab2b3','Nursing Notes','notes','released','## Nursing Notes\n\n**Date:** Today\n\n**Time:** 0600\n\n**Nurse initials:** VR\n\nPatient started yelling and was found confused in bed with the indwelling catheter lying on the floor. The patient has been incontinent. Scant urethral bleeding and minimal external trauma were noted. Received a complete bath and linen change. A repeat urinalysis was sent to lab and is pending.'),
  record('25d195d201d58103a862e1423b28b42b','Culture Results — Ruth','labs','pending',baseline.replace('Blood culture: pending','Blood culture: Positive E. Cloacae')),
  record('25d195d201d5813d8944d02d7166f91c','ICU Lab Results — Ruth (verify chloride before release)','labs','pending','## Ruth Livingston — ICU Laboratory report\n\n'+table(['Test','Yesterday 0600','Today 0600','Current repeat'],cbc)+'\n\n'+table(['Test','Today 0600','Current repeat'],chemistry)+'\n\nBlood culture: Positive E. Cloacae. Blood type: A+. * Asterisks and reference ranges retained from the source. Current repeat collection time is not specified. Chloride is printed as 1.5 in the source and has not been corrected.'),
  record('25d195d201d58164b326d9be8612eae5','Transfusion Orders — Ruth','orders','pending','## Orders\n\n1. Transfuse 2 units PRBC\n2. Type and cross 2 units PRBC\n\nDr. Marcus\n\nDate and time: not entered in source.'),
  record('25d195d201d581aa9910c83836fe6b07','Consents — source attachment needed','documents','released','The blood transfusion consent is available in the original Notion record. The scanned PDF could not be downloaded into this repository.\n\n[Open original consent in Notion]('+source('25d195d201d581aa9910c83836fe6b07')+')\n\nFaculty: add the original PDF before using this chart as a complete standalone record. This link does not attest that consent is signed.'),
  // Ruth starts on the orthopedic unit. The ICU Orders record stays pending until faculty releases it at transfer.
  record('1c94d1ee708c80f9ac86f6d6e6c9f38d','Ortho Orders','orders','released','Livingston, Ruth (10/8/xxxx)\n'+table(['Date and time','Order','Type of order and who received the order (Verbal/ Telephone)'],[
   'Admit to Medical-Surgical Orthopedic Unit','Diagnosis: Post-op Open Reduction Internal Fixation (ORIF)','Full Code','Diet: Regular','Activity: Up with assistance; Place SCD when in bed','PT: Full weight bearing; Gait training with walker','Administer supplemental O2 to keep SpO2 >93%','Vital Signs q 4 hours and PRN','I & O q 4 hours','Bladder scan q shift & PRN signs/symptoms of urinary retention','Sterile Dressing change to right hip q day','LABS: BMP, CBC, lactate level','Docusate Sodium 100 mg PO BID','Enoxaparin Sodium 40 mg SQ daily','Piperacillin Tazobactam 450 mg IV q 8 hrs','Calcium Carbonate 650 mg po daily','Alendronate 70 mg po weekly on Wednesdays','Oxycodone 15 mg po q 4 hours prn pain','Acetaminophen 650 mg po q 6 hrs prn temp > 101F','Ketorolac 30 mg IVP q 6 hrs prn pain; not to exceed 120 mg/daily','Lactated Ringers IV @ 75 mls/hr'
  ].map(order=>['',order,'']).concat([['','','Entered by Dr. Marcus']])))
 ];
})();
// ICU transfer: releasing ICU Orders releases these MAR rows and discontinues the ortho rows it DCs.
window.RUTH_ICU_TRANSFER={
 ordersId:'chart-25d195d201d581a0a439ec5e6a8a85a4',
 release:['Normal saline 500 mL over 30 minutes STAT','Normal saline at 125 mL/hr after bolus','Norepinephrine','Vancomycin 500 mg/250 mL every 8 hours over 2 hours'],
 discontinue:["Lactated Ringer's at 75 mL/hr",'Piperacillin-tazobactam 450 mg every 8 hours']
};
for(const record of window.RUTH_PROFILE_RECORDS){
 const existing=window.CHART_RECORDS.find(r=>r.id===record.id);
 if(existing)Object.assign(existing,record);else window.CHART_RECORDS.push({...record});
}
window.RUTH_ORTHO_START_RECORDS=JSON.parse(JSON.stringify(window.CHART_RECORDS.filter(r=>['chart-1c94d1ee708c80f9ac86f6d6e6c9f38d',window.RUTH_ICU_TRANSFER.ordersId,'chart-25d195d201d5816fb8a9eb0e7e5bb4fd'].includes(r.id))));
// Saved charts from before 2026-09-24 started Ruth with ICU orders and ICU medications active.
window.migrateRuthOrthoStart=function(){
 if(state.ruthOrthoStartV1)return;
 const pid='ruth-livingston',t=window.RUTH_ICU_TRANSFER,cloneData=value=>JSON.parse(JSON.stringify(value));
 const fixMeds=rows=>{for(const med of rows||[]){if(med.patientId!==pid)continue;
  if(t.release.includes(med.name))Object.assign(med,{status:'Pending',releaseStatus:'pending'});
  else if(t.discontinue.includes(med.name))Object.assign(med,{status:'Active',releaseStatus:'released'});}};
 state.chartContentEdits ||= {};
 for(const start of window.RUTH_ORTHO_START_RECORDS){
  delete state.chartContentEdits[start.id];
  const live=CHART_RECORDS.find(r=>r.id===start.id);if(live)Object.assign(live,cloneData(start));else CHART_RECORDS.push(cloneData(start));
 }
 state.releaseQueue=(state.releaseQueue||[]).filter(q=>q.chartRecordId!==t.ordersId);
 seedChartPending();fixMeds(state.medicationCatalog);
 const base=state.simulationBases?.[pid];
 if(base){
  base.chartRecords=(base.chartRecords||[]).filter(r=>!window.RUTH_ORTHO_START_RECORDS.some(s=>s.id===r.id)&&r.id!=='chart-25d195d201d581788086cb6c706ac318').concat(cloneData(window.RUTH_ORTHO_START_RECORDS));
  base.releaseQueue=(base.releaseQueue||[]).filter(q=>q.chartRecordId!==t.ordersId).concat(cloneData(state.releaseQueue.filter(q=>q.chartRecordId===t.ordersId)));
  fixMeds(base.collections?.medicationCatalog);
 }
 state.ruthOrthoStartV1=true;
};
// Ruth's MAR always follows her ICU Orders, even when a saved base or reset restored medications
// in a different state: before release the ICU medications are hidden and the ortho ones active.
window.syncRuthIcuTransfer=function(){
 const t=window.RUTH_ICU_TRANSFER,pid='ruth-livingston',record=CHART_RECORDS.find(r=>r.id===t.ordersId);if(!record)return;
 const transferred=chartRecordReleased(record);
 // Match by drug so renamed or faculty-added copies follow the ICU Orders too.
 const icuDrug=name=>t.release.includes(name)||/norepinephrine|levophed|vancomycin|normal saline|sodium chloride 0\.9/i.test(name||'');
 const orthoDrug=name=>t.discontinue.includes(name)||/lactated ringer|piperacillin/i.test(name||'');
 // Keep one norepinephrine row: the standard entry, which the MAR list re-creates if it is renamed.
 const norepi=(state.medicationCatalog||[]).filter(m=>m.patientId===pid&&/norepinephrine|levophed/i.test(m.name||''));
 const keep=norepi.find(m=>m.name===window.RUTH_NOREPINEPHRINE.name)||norepi[0];
 if(keep){Object.assign(keep,window.RUTH_NOREPINEPHRINE);if(norepi.length>1)state.medicationCatalog=state.medicationCatalog.filter(m=>!norepi.includes(m)||m===keep);}
 for(const med of state.medicationCatalog||[]){
  if(med.patientId!==pid)continue;
  if(icuDrug(med.name)){
   if(transferred){med.releaseStatus='released';if(med.status==='Pending')med.status='Due';}
   else Object.assign(med,{status:'Pending',releaseStatus:'pending'});
  }else if(orthoDrug(med.name)){
   if(transferred)med.status='Discontinued';
   else if(med.status==='Discontinued'){med.status='Active';med.releaseStatus='released';}
  }
 }
 // A reset returns pending queue items only; drop any released copies of ICU medications so they cannot re-release themselves.
 if(!transferred)state.releaseQueue=(state.releaseQueue||[]).filter(q=>!(q.patientId===pid&&q.status==='released'&&q.targetCollection==='medicationCatalog'&&icuDrug(q.rowData?.name)));
};
// Saved charts may hold the ICU norepinephrine order as one long MAR name; show the drug and rate, with titration in notes.
window.RUTH_NOREPINEPHRINE={name:'Norepinephrine',dose:'2 mcg/min',frequency:'Continuous',scheduledTime:'Continuous',notes:'Start after fluid bolus if MAP <65 or SBP <100. Titrate by 2 mcg every 5 minutes to MAP >65 or SBP >100. Maximum 30 mcg/min.'};
window.migrateRuthNorepinephrine=function(){
 if(state.ruthNorepinephrineV1)return;
 const pid='ruth-livingston',old=/^After fluid bolus, if MAP <65 or SBP <100: norepinephrine/i;
 const fix=rows=>{if(!Array.isArray(rows))return rows;let kept=false;return rows.filter(med=>{
  if(med?.patientId!==pid||!(old.test(med.name||'')||med.name===window.RUTH_NOREPINEPHRINE.name))return true;
  if(kept)return false;kept=true;Object.assign(med,window.RUTH_NOREPINEPHRINE);return true;});};
 state.medicationCatalog=fix(state.medicationCatalog);
 for(const item of state.releaseQueue||[])if(item.patientId===pid&&old.test(item.rowData?.name||'')){Object.assign(item.rowData,window.RUTH_NOREPINEPHRINE);item.title=item.content='Norepinephrine 2 mcg/min';}
 const base=state.simulationBases?.[pid];if(base?.collections)base.collections.medicationCatalog=fix(base.collections.medicationCatalog);
 state.ruthNorepinephrineV1=true;
};
window.migrateRuthProfile=function(){
 window.migrateRuthOrthoStart();
 window.migrateRuthNorepinephrine();
 if(state.ruthProfileImportV1)return;
 const cloneData=value=>JSON.parse(JSON.stringify(value));
 const pid='ruth-livingston';
 const fill=p=>{if(!p)return;if(!p.mrn||p.mrn==='SIM-L3-002')p.mrn='PCS10800';if(!p.provider||p.provider==='Simulation Faculty')p.provider='Hans Olsson, MD';if(!p.unit||p.unit==='Medical Surgical and ICU')p.unit='Orthopedic surgical unit';if(!p.weightKg)p.weightKg=54;if(!p.heightCm)p.heightCm=160;if(!p.sex)p.sex='Female';if(!p.bloodType)p.bloodType='A+';};
 fill(state.patients.find(p=>p.id===pid));
 // Replace only unrecovered placeholders; preserve subsequent faculty edits.
 for(const incoming of window.RUTH_PROFILE_RECORDS){
  const edit=state.chartContentEdits?.[incoming.id];
  if(edit&&/Original document has not been recovered/.test(edit.content||'')){
   edit.content=incoming.content;
   const record=CHART_RECORDS.find(r=>r.id===incoming.id);if(record)record.content=incoming.content;
  }
 }
 seedChartPending();
 const base=state.simulationBases?.[pid];
 if(base){fill(base.patient);base.chartRecords ||= [];base.releaseQueue ||= [];
  for(const incoming of window.RUTH_PROFILE_RECORDS){
   const saved=base.chartRecords.find(r=>r.id===incoming.id);
   if(!saved)base.chartRecords.push(cloneData(incoming));
   else if(/Original document has not been recovered/.test(saved.content||''))saved.content=incoming.content;
   if(incoming.status==='pending'&&!base.releaseQueue.some(q=>q.chartRecordId===incoming.id)){
    const queued=state.releaseQueue.find(q=>q.chartRecordId===incoming.id);
    if(queued)base.releaseQueue.push({...cloneData(queued),status:'pending',releasedAt:''});
   }
  }
 }
 state.ruthProfileImportV1=true;
};
