const assert=require('node:assert/strict'),boot=require('./boot.cjs');
const windows=[],start=s=>{const w=boot(s);windows.push(w);return w;};
const key='atuSimulationHospitalEHRv1';
function view(w,pid,name){w.testApp.setPatient(pid);w.testApp.setView(name);w.render();}
try{
 const w=start(),a=w.testApp;
 for(const p of a.state.patients){
  for(const [name,heading] of [['orders','Order List'],['assessments','Assessment History'],['flowsheets','Vitals History']]){
   view(w,p.id,name);assert.equal(w.document.querySelector('#view > .panel > h2').textContent,heading,p.id+' '+name);
  }
  for(const collection of ['assessments','vitals','orders','notes'])a.state[collection].push({id:'retain-'+p.id+'-'+collection,patientId:p.id,student:'QA',text:'Preserve this entry',time:'2026-09-25T09:00'});
 }
 delete a.state.settings.stephanieVitalsCleared20260916;w.save();
 const saved=JSON.parse(w.localStorage.getItem(key)),reopened=start(saved);
 for(const p of saved.patients)for(const c of ['assessments','vitals','orders','notes'])assert(reopened.testApp.state[c].some(r=>r.id==='retain-'+p.id+'-'+c),'Retained '+p.id+' '+c);
 // Drafts restore in a fresh tab (different session/client ID).
 view(w,'charles-jones','orders');const input=w.document.getElementById('oText');input.value='Unfinished order retained';input.dispatchEvent(new w.Event('input',{bubbles:true}));
 const draftKey=key+'_drafts_durable_faculty';assert(w.localStorage.getItem(draftKey));
 reopened.localStorage.setItem(draftKey,w.localStorage.getItem(draftKey));view(reopened,'charles-jones','orders');assert.equal(reopened.document.getElementById('oText').value,'Unfinished order retained');
 // Only a reset clears the selected patient's new entries; other charts remain intact.
 reopened.resetToBase('charles-jones');assert(!reopened.testApp.state.vitals.some(r=>r.id==='retain-charles-jones-vitals'));assert(reopened.testApp.state.vitals.some(r=>r.id==='retain-ruth-livingston-vitals'));
 view(reopened,'charles-jones','orders');assert.notEqual(reopened.document.getElementById('oText').value,'Unfinished order retained');
 const merge=w.ATUSharedMerge,b={vitals:[{id:'old',patientId:'p',hr:'80'}],orders:[],messages:[],patientResetEpochs:{}},l=JSON.parse(JSON.stringify(b)),r=JSON.parse(JSON.stringify(b));
 l.vitals.push({id:'student',patientId:'p',hr:'92'});r.orders.push({id:'faculty',patientId:'p',text:'New order'});r.messages.push({id:'message',patientId:'p',message:'Assess now'});
 const merged=merge(b,l,r);assert(merged.vitals.some(x=>x.id==='student'));assert(merged.orders.some(x=>x.id==='faculty'));assert(merged.messages.some(x=>x.id==='message'));
 r.patientResetEpochs.p=100;r.vitals=[];assert.equal(merge(b,l,r).vitals.length,0,'stale disconnected records must not return after reset');
 const before=w.document.getElementById('oText').value,original=w.Storage.prototype.setItem;w.Storage.prototype.setItem=()=>{throw Error('quota');};assert.throws(()=>w.clearCurrentViewDraft());assert.equal(w.document.getElementById('oText').value,before);w.Storage.prototype.setItem=original;
 console.log('PASS shared saving: all 13 patients retain entries; histories first; fresh-tab drafts; isolated patient reset; concurrent faculty/student merge; stale reset protection; failed-storage draft retention.');
}finally{setImmediate(()=>windows.forEach(w=>w.close()));}
