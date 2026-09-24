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
  record('25d195d201d581aa9910c83836fe6b07','Consents — source attachment needed','documents','released','The blood transfusion consent is available in the original Notion record. The scanned PDF could not be downloaded into this repository.\n\n[Open original consent in Notion]('+source('25d195d201d581aa9910c83836fe6b07')+')\n\nFaculty: add the original PDF before using this chart as a complete standalone record. This link does not attest that consent is signed.')
 ];
})();
for(const record of window.RUTH_PROFILE_RECORDS){
 const existing=window.CHART_RECORDS.find(r=>r.id===record.id);
 if(existing)Object.assign(existing,record);else window.CHART_RECORDS.push({...record});
}
window.migrateRuthProfile=function(){
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
