const assert=require('node:assert/strict'),boot=require('./boot.cjs');
const windows=[],tick=()=>new Promise(r=>setImmediate(r));
const open=()=>{const w=boot(undefined,{supabaseUrl:'https://example.supabase.co'},{name:'Test Student',area:'Medical Surgical'});windows.push(w);w.setTabMode('student');w.testApp.setPatient('charles-jones');w.testApp.setView('mar');w.render();return w;};
function controls(w){const el=id=>w.document.getElementById(id);return {el,input(id,value){el(id).value=value;el(id).dispatchEvent(new w.Event('input',{bubbles:true}));},navigate(view){w.document.querySelector('aside button[data-view="'+view+'"]').click();}};}
function order(w){const p=w.testApp.state.patients.find(x=>x.id==='charles-jones'),m=w.medicationsForPatient(p.id,false).find(x=>x.dose&&x.route&&!x.highAlert&&!w.medicationAdministrationBlock(x));return {p,m};}
function scan(w,m){const c=controls(w),p=w.testApp.state.patients.find(x=>x.id===m.patientId);c.input('marScanPatient',p.barcode);c.input('marScanMedication',w.packagesForMedication(m)[0].id);c.el('marRecognize').click();c.input('marConfirmStudent','TEST');c.el('marConfirmGiven').checked=true;return c;}
(async()=>{try{
 // A delayed MAR completion must not clear any other chart's draft, including another patient.
 for(const manual of [false,true])for(const [view,field] of [['notes','nNarrative'],['assessments','aNarrative'],['flowsheets','vComments'],['io','ioDesc']]){
  const w=open(),{p,m}=order(w),c=controls(w);let resolve;w.commitMedicationAdministration=()=>new Promise(r=>resolve=r);
  if(manual){c.input('marScanPatient',p.barcode);c.input('manual-'+m.id+'-time',w.nowLocal());c.input('manual-'+m.id+'-student','TEST');c.el('manual-'+m.id+'-given').checked=true;w.document.querySelector('[data-medication-id="'+m.id+'"]').click();}
  else{scan(w,m);c.el('marConfirmSave').click();}
  assert(resolve,'save is pending');c.navigate(view);c.input(field,'Keep '+view+' while saving MAR');resolve({ok:true});await tick();
  assert(w.simHasDraft(),'unrelated draft stays dirty');c.navigate('summary');c.navigate(view);assert.equal(c.el(field).value,'Keep '+view+' while saving MAR');
 }
 // Completing one manual row preserves another row's unfinished charting.
 {
  const w=open(),{p,m}=order(w),c=controls(w),other=w.medicationsForPatient(p.id,false).find(x=>x.id!==m.id&&!w.medicationAdministrationBlock(x));let resolve;
  w.commitMedicationAdministration=()=>new Promise(r=>resolve=r);c.input('manual-'+other.id+'-student','OTHER DRAFT');
  c.input('marScanPatient',p.barcode);c.input('manual-'+m.id+'-time',w.nowLocal());c.input('manual-'+m.id+'-student','TEST');c.el('manual-'+m.id+'-given').checked=true;w.document.querySelector('[data-medication-id="'+m.id+'"]').click();resolve({ok:true});await tick();
  assert.equal(c.el('manual-'+other.id+'-student').value,'OTHER DRAFT');assert.equal(c.el('manual-'+m.id+'-student').value,'');
 }
 // Re-scanning while an earlier request finishes must not destroy the newer review.
 {
  const w=open(),{p,m}=order(w),c=scan(w,m);let resolve,calls=0;w.commitMedicationAdministration=()=>{calls++;return new Promise(r=>resolve=r);};assert(c.el('marConfirmation').textContent.includes(p.mrn));assert(c.el('marConfirmation').textContent.includes(p.dob));c.el('marConfirmSave').click();c.el('marConfirmSave').onclick();assert.equal(calls,1,'a pending confirmation cannot be submitted twice');resolve({ok:true});await tick();assert.equal(w.simHasDraft(),false,'blank unused MAR rows do not keep the completed form dirty');
 }
 {
  const w=open(),{m}=order(w),c=scan(w,m);let resolve;w.commitMedicationAdministration=()=>new Promise(r=>resolve=r);c.el('marConfirmSave').click();
  scan(w,m);c.input('marConfirmNotes','New review must survive');const button=c.el('marConfirmSave');resolve({ok:true});await tick();
  assert.equal(c.el('marConfirmSave'),button);assert.equal(c.el('marConfirmNotes').value,'New review must survive');
 }
 // A failed save stays actionable after navigation, and confirmation is never restored from drafts.
 {
  const w=open(),{m}=order(w),c=scan(w,m);let resolve;w.commitMedicationAdministration=()=>new Promise(r=>resolve=r);c.input('marConfirmNotes','Retain failed attempt');c.el('marConfirmSave').click();c.navigate('notes');c.input('nNarrative','Independent note');resolve({ok:false,error:'Save not confirmed: offline'});await tick();
  assert.match(c.el('chartSaveNotice').textContent,/Save not confirmed/);c.navigate('mar');scan(w,m);assert.equal(c.el('marConfirmNotes').value,'Retain failed attempt');
  c.el('marConfirmGiven').checked=false;c.navigate('summary');c.navigate('mar');c.input('marScanPatient',order(w).p.barcode);c.input('marScanMedication',w.packagesForMedication(m)[0].id);c.el('marRecognize').click();assert.equal(c.el('marConfirmGiven').checked,false);
 }
 // Completed note/assessment/vitals/I&O persist through navigation and a fresh browser instance.
 {
  const w=open(),c=controls(w);c.navigate('notes');c.input('nNarrative','Erase this draft');c.input('nNarrative','');c.navigate('summary');c.navigate('notes');assert.equal(c.el('nNarrative').value,'','cleared text must not resurrect from an older draft');
 }
 {
  const w=open(),c=controls(w);
  for(const [view,student,field,button,collection] of [['notes','nStudent','nNarrative','saveNote','notes'],['assessments','aStudent','aNarrative','saveAssessment','assessments'],['flowsheets','vStudent','vComments','saveVitals','vitals'],['io','ioStudent','ioDesc','saveIO','io']]){
   c.navigate(view);c.input(student,'TEST');c.input(field,'Completed '+view);c.el(button).click();await tick();c.navigate('summary');
   const saved=JSON.parse(w.localStorage.getItem('atuSimulationHospitalEHRv1'));assert(saved[collection].some(r=>r.student==='TEST'));
   const reopened=boot(saved);windows.push(reopened);assert(reopened.testApp.state[collection].some(r=>r.student==='TEST'));
  }
 }
 console.log('PASS MAR completion across four charting screens, manual/scanned paths, other MAR drafts, new review protection, failure recovery, explicit reconfirmation, and completed chart reload.');
}finally{await tick();windows.forEach(w=>w.close());}})().catch(e=>{console.error(e);process.exitCode=1;});
