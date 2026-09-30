/* Shared chart corrections and blood-product links use the existing MAR and labels. */
(function(){
 const copy=x=>JSON.parse(JSON.stringify(x));
 const products=[
  {id:'MED-PRBC',name:'Packed red blood cells',form:'blood bag',pattern:/\b(?:PRBCs?|packed red blood cells)\b/i},
  {id:'MED-FFP',name:'Fresh frozen plasma',form:'blood bag',pattern:/\b(?:FFP|fresh frozen plasma)\b/i},
  {id:'MED-PLT',name:'Platelets',form:'blood bag',pattern:/\bplatelets?\b/i},
  {id:'MED-CRYO',name:'Cryoprecipitate',form:'blood bag',pattern:/\bcryoprecipitate\b/i},
  {id:'MED-WB',name:'Whole blood',form:'blood bag',pattern:/\bwhole blood\b/i}
 ];
 for(const p of products)MEDICATION_PACKAGE_DEFAULTS.push({id:p.id,name:p.name,strength:'',form:p.form,orderKeys:[]});
 const plain=value=>String(value||'').replace(/<\/(?:td|tr|p|li)>|<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'').replace(/\*\*/g,'');
 window.bloodPackageForProduct=value=>products.find(p=>p.pattern.test(value));
 window.isBloodTransfusionOrder=value=>plain(value).split(/[\n;.]+/).some(line=>{const m=line.match(/\b(?:infuse|transfuse|administer|give)\s+(.+)/i);return m&&!/\b(?:no|not|hold|stop|discontinue)\b/i.test(line.slice(0,m.index))&&products.some(p=>p.pattern.test(m[1]));});
 window.bloodUnitLabelPackage=unit=>({id:'MED-B'+unit.barcode,name:unit.product,strength:unit.unitType||'',form:'Unit '+unit.unitNumber});
 function sources(patientId){
  return [...CHART_RECORDS.filter(r=>r.patientId===patientId).map(r=>({...r,text:(state.chartContentEdits?.[r.id]?.content??r.content),chart:true})),
   ...(state.orders||[]).filter(r=>r.patientId===patientId&&!r.sourceReleaseId&&!(state.releaseQueue||[]).some(q=>q.patientId===patientId&&q.kind==='order'&&q.status==='released'&&q.content===r.text)).map(r=>({...r,text:r.text||r.medication||'',category:'orders'})),
   ...(state.releaseQueue||[]).filter(r=>r.patientId===patientId&&!r.chartRecordId&&(r.kind==='order'||r.targetCollection==='orders')).map(r=>({...r,text:r.content||r.rowData?.text||'',category:'orders',queue:true}))];
 }
 window.bloodLabelMedications=function(patientId){
  const text=sources(patientId).map(r=>r.text).join('\n')+'\n'+(state.bloodUnits||[]).filter(r=>r.patientId===patientId).map(r=>r.product).join('\n');
  // A mention permits preparing a label, never an administration. Only actionable orders seed the MAR.
  return products.filter(p=>p.pattern.test(text)&&(p.id!=='MED-PLT'||/\b(?:infuse|transfuse|administer|give)[^.\n]*platelet|platelet[^.\n]*(?:unit|bag)/i.test(plain(text))||(state.bloodUnits||[]).some(u=>u.patientId===patientId&&p.pattern.test(u.product)))).map(p=>({id:'label-'+p.id,patientId,name:p.name,packageIds:[p.id]}));
 };
 window.seedBloodMedicationOrders=function(){
  state.medicationCatalog||=[];
  for(const patient of state.patients)for(const source of sources(patient.id).filter(r=>r.category==='orders')){
   for(const line of plain(source.text).split(/[\n;.]+/)){
    const action=line.match(/\b(?:infuse|transfuse|administer|give)\s+(.+)/i);if(!action||/\b(?:no|not|hold|stop|discontinue)\b/i.test(line.slice(0,action.index)))continue;
    const p=products.find(p=>p.pattern.test(action[1]));if(!p)continue;
    const id='blood-mar-'+source.id+'-'+p.id;
    const n=action[1].match(/\b(\d+)\s*units?\b/i),units=n?Number(n[1]):null;
    const released=source.chart?chartRecordReleased(source):!(/pending/i.test(source.status||'')||source.releaseStatus==='pending');
    let med=state.medicationCatalog.find(m=>m.id===id);
    if(!med){med={id,patientId:patient.id,name:p.name,dose:'1 unit',route:'IV',frequency:'Per released transfusion order',highAlert:true,bloodProduct:true,orderedUnits:units,packageIds:[p.id],notes:`${units?'Total ordered: '+units+' unit'+(units===1?'':'s')+'. ':''}Complete blood-product verification and transfusion monitoring per protocol. Record each bag separately.`,status:released?'Due':'Pending',releaseStatus:released?'released':'pending',provider:source.provider||patient.provider||'',...(source.chart?{sourceChartRecordId:source.id}:source.queue?{sourceReleaseId:source.id}:{sourceOrderId:source.id})};state.medicationCatalog.push(med);}
    if(released&&med.releaseStatus==='pending')Object.assign(med,{status:'Due',releaseStatus:'released'});
   }
  }
 };
 window.migrateStephanieOrders=function(){
  state.settings||={};if(state.settings.stephanieOrders20260930)return;
  const pid='stephanie-smith',prbc='admin-stephanie-prbc-2units',cef='admin-stephanie-ceftriaxone';
  const correctText=value=>String(value).replace(/\b(?:infuse\s+)?2\s+units?\s+(?:of\s+)?(?:packed red blood cells\s*\(PRBCs?\)|PRBCs?)/gi,'Infuse 1 unit of packed red blood cells (PRBCs)').replace(/Ceftriaxone\s+500\s*mg\/100\s*mL(?:\s+IV)?\s*(?:q12h|every 12 hours|every 6 hours)/gi,'Ceftriaxone 500 mg/100 mL IV every 6 hours');
  const update=row=>{if(!row)return;for(const key of ['text','title','content'])if(typeof row[key]==='string')row[key]=correctText(row[key]);if(/ceftriaxone/i.test(row.name||row.medication||'')){row.name='Ceftriaxone';row.dose='500 mg/100 mL';row.route='IV';row.frequency='Every 6 hours';if(row.scheduledTime&&/12|q6|every 6/i.test(row.scheduledTime))row.scheduledTime='Every 6 hours';row.packageIds=['MED-0061'];}};
  const fluid={id:'stephanie-d5-half-ns',patientId:pid,name:'Dextrose 5% in 0.45% sodium chloride (D5 1/2 NS)',dose:'150 mL/hr',route:'IV infusion',frequency:'Continuous',scheduledTime:'Now',status:'Due',releaseStatus:'released',provider:'Henderson',highAlert:false,packageIds:['MED-0024'],notes:''};
  const fluidInto=rows=>{if(!rows.some(m=>m.id===fluid.id||/d5\s*(?:1\/2|½)\s*ns|dextrose 5%.*0\.45%/i.test(m.name||'')))rows.push(copy(fluid));};
  for(const row of CHART_RECORDS.filter(r=>r.patientId===pid))update(row);
  for(const row of (state.customChartRecords||[]).filter(r=>r.patientId===pid))update(row);
  for(const [id,row] of Object.entries(state.chartContentEdits||{}))if(CHART_RECORDS.some(r=>r.id===id&&r.patientId===pid))update(row);
  for(const key of ['orders','medicationCatalog'])for(const row of state[key]||[])if(row.patientId===pid)update(row);
  for(const q of state.releaseQueue||[])if(q.patientId===pid){update(q);update(q.rowData);}
  fluidInto(state.medicationCatalog);
  const base=state.simulationBases?.[pid];if(base){for(const row of base.chartRecords||[])update(row);for(const key of ['orders','medicationCatalog'])for(const row of base.collections?.[key]||[])update(row);for(const q of base.releaseQueue||[]){update(q);update(q.rowData);}base.collections.medicationCatalog||=[];fluidInto(base.collections.medicationCatalog);}
  // Preserve legacy package identifiers, including already printed ceftriaxone labels.
  for(const p of state.medicationPackages||[])if(p.id==='MED-0061'){p.strength||='500 mg/100 mL';p.form||='infusion bag';p.orderKeys=[...new Set([...(p.orderKeys||[]),'ceftriaxone|iv'])];}
  state.settings.stephanieOrders20260930=true;
 };
})();
