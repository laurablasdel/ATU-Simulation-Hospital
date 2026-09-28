/* Vernon source recovery, 2026-09-28. Original references are in SOURCE-AUDIT.md. */
(function(){
 const pid='vernon-watkins',copy=x=>JSON.parse(JSON.stringify(x));
 const fillPatient=p=>{if(!p)return;if(!p.mrn||p.mrn==='SIM-L3-005')p.mrn='PCS40900';if(!p.provider||p.provider==='Simulation Faculty')p.provider='Dr. Jack Nelson';if(!p.weightKg)p.weightKg=80;if(!p.heightCm)p.heightCm=182;if(!p.sex)p.sex='Male';};
 const table=(headers,rows)=>'<table><tr>'+headers.map(x=>`<td>${x}</td>`).join('')+'</tr>'+rows.map(row=>'<tr>'+row.map(x=>`<td>${x}</td>`).join('')+'</tr>').join('')+'</table>';
 const record=(id,title,category,status,content)=>({id:'chart-'+id,patientId:pid,title,category,status,content});
 const routine=table(['Test / reference range','Preop','Postop day 3','Postop day 4'],[
 ['Hgb (13.5–17.5 g/dL)','13*','11*','11.5*'],['HCT (40–45%)','39*','32*','33*'],['WBC (5–11 × 10^9/L)','17.2*','10','11'],['Platelets (150–400 × 10^9/L)','350','320','320'],
 ['Na+ (135–145 mEq/L)','142','140','141'],['K+ (3.5–5.1 mEq/L)','3.7','4.0','4.0'],['Cl− (98–106 mEq/L)','95','100','100'],['HCO3− (22–26 mEq/L)','30','25','25'],['BUN (8–23 mg/dL)','17','15','15'],['Creatinine (0.6–1.1 mg/dL)','1.0','0.9','0.9'],['Glucose (70–110 mg/dL)','110','100','108'],['PT (10–14 seconds)','12','12','12'],['INR (0.8–1.1)','1.0','1.0','1.0'],['aPTT (25–40 seconds)','30','32','32']]);
 const flowHeaders=['Date / Time','Time of aPTT draw','aPTT result','Hold Infusion (mins)','Heparin Bolus (Amount in units)','Heparin infusion rate change amount (units/kg/hr)','New Heparin Infusion rate (units/kg/hr)','Time of next aPTT','RN 1 initials','RN 2 initials'];
 window.VERNON_PROFILE_RECORDS=[
  record('25d195d201d581278b56ca1765119f16','Lab Results','labs','released','## Vernon Watkins — Routine Lab Results\n\n'+routine+'\n\n* Asterisks and reference ranges retained from the source. Collection times are not specified.'),
  record('303195d201d58008afd5fe58a12dc63e','Heparin Flowsheet','flowsheets','pending',table(flowHeaders,[flowHeaders.map(()=> '___')])),
  record('25d195d201d580409b1cc83312b4cff6','Stat Orders','orders','pending','## Stat Orders\n\n- Activity: Bed rest\n- Continuous SpO2 and ECG Monitoring\n- 12 lead ECG\n- Oxygen via mask: titrate to maintain SpO2 greater than 92%\n- Spiral CT-Scan with contrast\n\nMeds:\n- Using weight of 80 kg: initiation of Nurse Driven Heparin Protocol\n- Please give bolus from the Heparin 10000 units/10 mLs vial, and use the bag for the drip.\n- Maintain Heparin flowsheet\n\nEntered by Dr. Nelson'),
  record('25d195d201d580739aecc611389a3ff0','Stat Lab Results','labs','pending','## Vernon Watkins — Stat Lab Results\n\nTime: Today\n\n'+table(['Test / reference range','Result'],[['pH (7.35–7.45)','7.49*'],['PCO2 (35–45 mmHg)','31*'],['PO2 (80–100 mmHg)','58*'],['HCO3− (22–26 mEq/L)','24'],['D-dimer (<0.5 mcg/mL)','0.9*'],['CK-MB (0–4.9 ng/mL)','3.9'],['Troponin T (0–0.1 ng/mL)','0.09']])+'\n\n* Asterisks retained from source.'),
  record('25d195d201d58178bfb9ff0fb4ddd729','Nurse Driven Heparin Protocol','orders','pending','## Nurse Driven Heparin Protocol\n\n[Open / print the original heparin protocol](assets/vernon-heparin-protocol.pdf)\n\nOriginal physician order, including marked selections, starting-dose grids, and dosing nomogram.\n\n![Nurse Driven Heparin Protocol](assets/vernon-heparin-protocol.png)')
 ];
 // Only remove rows explicitly dated August 21; retain admission orders and later edits.
 const clean=content=>String(content||'').replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi,row=>/<td[^>]*>\s*0?8\/21/.test(row)?'':row);
 function cleanRecords(rows){for(const r of rows||[])if(r.patientId===pid&&r.category==='orders')r.content=clean(r.content);}
 function readOnlyVitals(rows){for(const r of rows||[])if(r.patientId===pid&&r.title==='Vital Signs')r.content=r.content.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi,row=>row.replace(/<[^>]+>/g,'').trim()?row:'').replace(/<td>\s*<\/td>/g,'<td>—</td>').replace(/>\s+</g,'><');}
 cleanRecords(window.CHART_RECORDS);readOnlyVitals(window.CHART_RECORDS);
 for(const r of VERNON_PROFILE_RECORDS){const found=window.CHART_RECORDS.find(x=>x.id===r.id);if(found)Object.assign(found,r);else window.CHART_RECORDS.push(copy(r));}
 const defaults=window.SIMULATION_DEFAULTS?.[pid];
 if(defaults){
  fillPatient(defaults.patient);
  const ids=new Set(VERNON_PROFILE_RECORDS.map(r=>r.id));cleanRecords(defaults.chartRecords);readOnlyVitals(defaults.chartRecords);
  defaults.chartRecords=defaults.chartRecords.filter(r=>!ids.has(r.id)).concat(copy(VERNON_PROFILE_RECORDS));
  defaults.releaseQueue=(defaults.releaseQueue||[]).filter(q=>!ids.has(q.chartRecordId));
 }
 window.migrateVernonProfile=function(){
  if(state.vernonProfileV1)return;
  fillPatient(state.patients.find(p=>p.id===pid));fillPatient(state.simulationBases?.[pid]?.patient);
  const targetIds=new Set(VERNON_PROFILE_RECORDS.map(r=>r.id));
  state.chartContentEdits||={};
  for(const r of VERNON_PROFILE_RECORDS){const edit=state.chartContentEdits[r.id];if(edit&&/Original document has not been recovered/.test(edit.content||'')){edit.content=r.content;Object.assign(CHART_RECORDS.find(x=>x.id===r.id),edit);}}
  const orderIds=new Set(CHART_RECORDS.filter(r=>r.patientId===pid&&r.category==='orders').map(r=>r.id));
  for(const [id,edit] of Object.entries(state.chartContentEdits))if(orderIds.has(id))edit.content=clean(edit.content);
  cleanRecords(CHART_RECORDS);cleanRecords(state.customChartRecords);readOnlyVitals(CHART_RECORDS);
  const stale=row=>row.patientId===pid&&/^(?:\d{4}-08-21|0?8\/21(?:\D|\d{4}))/i.test(String(row.time||row.date||''));
  state.vernonLegacyEntriesV1={orders:copy((state.orders||[]).filter(stale)),notes:copy((state.notes||[]).filter(stale))};
  for(const key of ['orders','notes'])state[key]=(state[key]||[]).filter(row=>!stale(row));
  seedChartPending();
  for(const base of [window.SIMULATION_DEFAULTS?.[pid],state.simulationBases?.[pid]])if(base){
   cleanRecords(base.chartRecords);readOnlyVitals(base.chartRecords);
   base.chartRecords=(base.chartRecords||[]).filter(r=>!targetIds.has(r.id)).concat(copy(VERNON_PROFILE_RECORDS));
   base.releaseQueue=(base.releaseQueue||[]).filter(q=>!targetIds.has(q.chartRecordId)).concat(copy(state.releaseQueue.filter(q=>targetIds.has(q.chartRecordId))).map(q=>({...q,status:'pending',releasedAt:''})));
   for(const key of ['orders','notes'])base.collections[key]=(base.collections[key]||[]).filter(row=>!stale(row));
  }
  state.vernonProfileV1=true;
 };
})();
