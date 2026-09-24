const assert=require('node:assert/strict'),boot=require('./boot.cjs');
const level3=['vincent-brody','ruth-livingston','carl-shapiro','karl-sharp','vernon-watkins'];
const ruth='ruth-livingston',icu='chart-25d195d201d581a0a439ec5e6a8a85a4',ortho='chart-1c94d1ee708c80f9ac86f6d6e6c9f38d';
const icuMeds=['Normal saline 500 mL over 30 minutes STAT','Normal saline at 125 mL/hr after bolus','Vancomycin 500 mg/250 mL every 8 hours over 2 hours'];
const windows=[];function start(saved){const w=boot(saved);windows.push(w);return w;}
const text=w=>w.document.querySelector('#view').textContent;
function view(w,pid,v,mode='student'){w.sessionStorage.setItem('atuEhrTabMode',mode);w.testApp.setPatient(pid);w.testApp.setView(v);w.render();return text(w);}
function checkRuthStart(w){
 const t=view(w,ruth,'orders');
 assert(t.includes('Admit to Medical-Surgical Orthopedic Unit'),'Ortho orders visible');
 assert(!t.includes('Transfer to ICU'),'ICU orders hidden before transfer');
 const mar=view(w,ruth,'mar');
 assert(mar.includes('Docusate sodium')&&mar.includes("Lactated Ringer's at 75 mL/hr")&&mar.includes('Piperacillin-tazobactam'));
 for(const name of icuMeds)assert(!mar.includes(name),name+' hidden before transfer');
 assert(!mar.includes('norepinephrine'));
}
try{
 const w=start(),s=w.testApp.state;
 for(const pid of level3){
  const t=view(w,pid,'assessments');
  assert(!t.includes('WDL Definition'),pid+' WDL form removed');
  assert(t.includes('Detailed Head-to-Toe Assessment'),pid+' head-to-toe kept');
 }
 for(const pid of ['carl-shapiro','karl-sharp']){
  const t=view(w,pid,'flowsheets');
  assert(!t.includes('ER VS'),pid+' ER VS row removed');
  assert(t.includes('125/75'),pid+' ER vitals kept');
  assert(!w.document.querySelector('#view form.recordEntry'),pid+' ER vitals table is read-only');
  assert(t.includes('Vitals / Flowsheet'),pid+' flowsheet form available');
 }
 checkRuthStart(w);
 w.sessionStorage.setItem('atuEhrTabMode','faculty');
 w.releaseItem(s.releaseQueue.find(q=>q.chartRecordId===icu&&q.status==='pending').id);
 assert(view(w,ruth,'orders').includes('Transfer to ICU'));
 const mar=view(w,ruth,'mar');
 for(const name of icuMeds)assert(mar.includes(name),name+' released at transfer');
 assert(mar.includes('norepinephrine'));
 assert(!mar.includes("Lactated Ringer's at 75 mL/hr")&&!mar.includes('Piperacillin-tazobactam'),'ICU orders discontinue LR and piperacillin-tazobactam');
 w.resetToBase(ruth);checkRuthStart(w);
 // A chart saved before this change: ICU orders released through faculty edits and ICU medications active.
 const old=JSON.parse(JSON.stringify(s));
 for(const flag of ['ruthOrthoStartV1','level3ChartCleanupV1'])delete old[flag];
 old.releaseQueue=old.releaseQueue.filter(q=>q.chartRecordId!==icu);
 old.chartContentEdits[icu]={title:'ICU Orders',category:'orders',status:'released',content:w.testApp.records.find(r=>r.id===icu).content};
 old.chartContentEdits['chart-262195d201d581c7adc3f86cdc38c563']={content:'<table><tr><td>ER VS</td><td></td></tr></table>'};
 for(const m of old.medicationCatalog.filter(m=>m.patientId===ruth&&icuMeds.includes(m.name)))Object.assign(m,{status:'Active',releaseStatus:'released'});
 old.simulationBases={[ruth]:JSON.parse(JSON.stringify(w.SIMULATION_DEFAULTS[ruth]))};
 const migrated=start(old);checkRuthStart(migrated);
 assert(!view(migrated,'carl-shapiro','flowsheets').includes('ER VS'));
 migrated.resetToBase(ruth);checkRuthStart(migrated);
 assert(view(start(JSON.parse(JSON.stringify(migrated.testApp.state))),ruth,'orders').includes('Orthopedic Unit'));
 console.log('PASS Level 3: WDL assessments removed, Carl/Karl ER vitals read-only, Ruth starts on ortho orders, ICU transfer release, reset and saved-chart migration.');
}finally{for(const w of windows)w.close();}
