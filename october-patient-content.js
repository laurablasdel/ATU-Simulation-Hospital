/* October 16 faculty content decisions. No changes to completed student documentation. */
(function(){
 const ids=['amelia-sung','baby-boy-sung','fatima-sanogo','molly-thomas','stephanie-smith'];
 const copy=x=>JSON.parse(JSON.stringify(x));
 const gbs='Mother received one dose of clindamycin before delivery. Clindamycin does not count as adequate GBS prophylaxis, so the infant is observed for signs of early-onset GBS infection per unit protocol.';
 function text(pid,s){
  if(typeof s!=='string')return s;
  if(pid==='amelia-sung')s=s.replace(/Epidural requested, not yet placed\./g,'Epidural in place — anesthesia-managed; infusion running at the start of Shift 1.').replace(/Epidural requested \(anesthesia\)/g,'Epidural in place — anesthesia-managed').replace(/Requested — not yet placed/g,'In place — anesthesia-managed').replace(/epidural requested/g,'epidural in place').replace(/clindamycin 900 mg IV given by night nurse at 0530\./g,'clindamycin 900 mg IVPB every 6 hours until delivery; first dose due now, students start in Shift 1.').replace(/ Prior dose given at 0530 by night nurse\./g,' First dose due now; start clindamycin.').replace(/prepare for epidural per anesthesia/g,'start clindamycin; epidural in place, managed by anesthesia').replace(/bed rest with bathroom privileges/g,'bed rest (epidural in place)').replace(/Epidural is placed by anesthesia\./g,'Epidural is already in place and running at the start of Shift 1, managed by anesthesia.').replace(/Complete after 3 hours of pushing; vacuum-assisted delivery\./g,'Dr. Darnell wants a call when the baby is crowning; vacuum assist at delivery. The baby delivers after 4 pushes.');
  if(pid==='baby-boy-sung')s=s.replace(/(?:Dr\.\s*)?Craig/g,'MD').replace(/0\.5 m[lL] ribbon(?: x 1 both conjunctivae)?/g,'0.5%, 1 cm ribbon in each eye, once').replace(/IM(?: —)? anterior thigh/g,'IM — vastus lateralis (anterolateral thigh)');
  if(pid==='fatima-sanogo')s=s.replace(/\b71\s*kg\b/gi,'70 kg').replace(/\b1235\b|\b1242\b/g,'1245').replace(/12:35|12:42/g,'12:45').replace(/O[-−]negative|O negative|O-negative/g,'O+ crossmatched PRBCs').replace(/AB plasma(?:\s*\(FFP\))?/g,'O+ crossmatched PRBCs');
  if(pid==='stephanie-smith')s=s.replace(/\b(?:2|two) units?\b/gi,'1 unit');
  return s;
 }
 function row(r,pid=r.patientId){const out={...r};for(const k of ['content','text','title','provider','situation','background','assessment','recommendation','painPlan','epidural','birthPlan','dose','route'])if(k in out)out[k]=text(pid,out[k]);return out;}
 window.OCTOBER_PATIENT_CONTENT={ids,text,row,gbs};
 window.applyOctoberPatientContent=function(){
  const patches={'amelia-sung':{room:'211E',painPlan:'Epidural in place — anesthesia-managed'},'baby-boy-sung':{provider:'MD'},'fatima-sanogo':{weightKg:70},'stephanie-smith':{bloodType:'A-'}};
  for(const p of state.patients)if(patches[p.id])Object.assign(p,patches[p.id]);
  for(const key of ['orders','customChartRecords','releaseQueue'])for(const r of state[key]||[])if(ids.includes(r.patientId)){Object.assign(r,row(r));if(r.rowData)r.rowData=row(r.rowData,r.patientId);const source=CHART_RECORDS.find(x=>x.id===(r.chartRecordId||r.id));if(source&&r.content!==undefined)r.content=source.content;}
  for(const [id,edit] of Object.entries(state.chartContentEdits||{})){const source=CHART_RECORDS.find(r=>r.id===id&&ids.includes(r.patientId));if(source)state.chartContentEdits[id]={...edit,content:source.content};}
  for(const n of state.notes||[])if(n.id==='amelia-admission-note')Object.assign(n,copy(SEED_AMELIA_NOTES[0]));
  // Remove only the obsolete simulated prior-nurse dose, never actual student administrations.
  state.mar=(state.mar||[]).filter(r=>r.id!=='sung-prior-nurse-clindamycin');
  for(const m of state.medicationCatalog||[]){
   if(m.patientId==='baby-boy-sung'){Object.assign(m,row(m));m.provider='MD';if(/Erythromycin/i.test(m.name))m.dose='0.5%, 1 cm ribbon in each eye';if(/Vitamin K|Hepatitis B/i.test(m.name))m.route='IM — vastus lateralis (anterolateral thigh)';if(/Hepatitis B/i.test(m.name))m.frequency='Once, over 2,000 g, with consent';}
   if(m.patientId==='amelia-sung'&&/clindamycin/i.test(m.name))Object.assign(m,{dose:'900 mg',route:'IVPB',frequency:'Every 6 hours until delivery',scheduledTime:'Now',status:'Due',releaseStatus:'released',previouslyGiven:''});
  }
  const order={id:'oct16-fatima-fentanyl',patientId:'fatima-sanogo',type:'Medication',text:'Fentanyl 50 mcg IV push every 1 hour as needed for pain',provider:'Dr. Nelson',status:'Active'};
  for(const seed of [order]){const old=state.orders.find(r=>r.id===seed.id);if(old)Object.assign(old,seed);else state.orders.push(seed);}
  let fentanyl=state.medicationCatalog.find(m=>m.patientId==='fatima-sanogo'&&m.name==='Fentanyl');
  if(!fentanyl){fentanyl={id:'oct16-fatima-fentanyl-mar',patientId:'fatima-sanogo',name:'Fentanyl'};state.medicationCatalog.push(fentanyl);}
  Object.assign(fentanyl,{dose:'50 mcg',route:'IV push',frequency:'Every 1 hour PRN pain',scheduledTime:'PRN',provider:'Dr. Nelson',status:'Due',releaseStatus:'released',sourceOrderId:order.id,packageIds:['MED-0065']});
  ensureMedicationData();ensureMedicationPackages();
  for(const pid of ids)if(state.simulationBases?.[pid]){
   const b=state.simulationBases[pid];if(patches[pid])Object.assign(b.patient,patches[pid]);
   b.chartRecords=(b.chartRecords||[]).map(r=>{const canonical=CHART_RECORDS.find(c=>c.id===r.id);return canonical?copy(canonical):row(r,pid);});
   for(const key of ['orders','notes','medicationCatalog','mar'])if(b.collections?.[key]){
    b.collections[key]=b.collections[key].filter(r=>r.id!=='sung-prior-nurse-clindamycin').map(r=>{
     if(key==='mar')return r;
     if(r.id==='amelia-admission-note')return copy(SEED_AMELIA_NOTES[0]);
     const revised=row(r,pid),updated=(state[key]||[]).find(x=>x.id===r.id);
     if(key==='medicationCatalog'&&updated&&((pid==='amelia-sung'&&/clindamycin/i.test(r.name))||pid==='baby-boy-sung')){
      for(const field of ['dose','route','frequency','scheduledTime','provider','previouslyGiven'])if(field in updated)revised[field]=updated[field];
      if(pid==='amelia-sung')Object.assign(revised,{status:'Due',releaseStatus:'released'});
     }
     return revised;
    });
   }
   for(const seed of [order])if(seed.patientId===pid&&!b.collections.orders.some(r=>r.id===seed.id))b.collections.orders.push(copy(seed));
   if(pid==='fatima-sanogo'&&!b.collections.medicationCatalog.some(m=>m.id===fentanyl.id))b.collections.medicationCatalog.push(copy(fentanyl));
   b.releaseQueue=(b.releaseQueue||[]).map(r=>{const revised=row(r,pid),source=CHART_RECORDS.find(c=>c.id===r.chartRecordId);if(source)revised.content=source.content;if(r.rowData)revised.rowData=row(r.rowData,pid);return revised;});
  }
 };
})();
