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
 assert(!/norepinephrine/i.test(mar));
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
 view(w,ruth,'mar','faculty');
 const facultyTable=w.document.querySelector('#view table.simpleMAR').textContent;
 assert(!facultyTable.includes('Vancomycin')&&facultyTable.includes('Docusate'),'faculty MAR table matches the student MAR');
 assert(text(w).includes('Not Yet Released')&&text(w).includes('Vancomycin'),'faculty sees unreleased medications listed separately');
 w.sessionStorage.setItem('atuEhrTabMode','faculty');
 w.releaseItem(s.releaseQueue.find(q=>q.chartRecordId===icu&&q.status==='pending').id);
 assert(view(w,ruth,'orders').includes('Transfer to ICU'));
 const mar=view(w,ruth,'mar');
 for(const name of icuMeds)assert(mar.includes(name),name+' released at transfer');
 const norepi=[...w.document.querySelectorAll('#view table.simpleMAR tr')].find(r=>/Norepinephrine/.test(r.textContent));
 assert(norepi,'norepinephrine on MAR after transfer');
 assert.equal(norepi.cells[0].querySelector('b').textContent,'Norepinephrine');
 assert.equal(norepi.cells[1].textContent,'2 mcg/min');
 assert(norepi.cells[0].textContent.includes('Titrate by 2 mcg every 5 minutes'),'titration shown as a note');
 assert(!mar.includes('After fluid bolus, if MAP'),'long order text no longer used as the MAR name');
 assert(!mar.includes("Lactated Ringer's at 75 mL/hr")&&!mar.includes('Piperacillin-tazobactam'),'ICU orders discontinue LR and piperacillin-tazobactam');
 w.resetToBase(ruth);checkRuthStart(w);
 // Update Base Patient after the ICU release, then reset: the MAR must still follow the (now pending) ICU Orders.
 w.releaseItem(s.releaseQueue.find(q=>q.chartRecordId===icu&&q.status==='pending').id);
 w.updateBasePatient(ruth);w.resetToBase(ruth);
 assert(!view(w,ruth,'orders').includes('Transfer to ICU'),'reset returns to ortho orders');
 checkRuthStart(w);
 w.sessionStorage.setItem('atuEhrTabMode','faculty');
 w.releaseItem(s.releaseQueue.find(q=>q.chartRecordId===icu&&q.status==='pending').id);
 assert(view(w,ruth,'mar').includes('Vancomycin'),'ICU medications release again after that reset');
 w.resetToBase(ruth);checkRuthStart(w);
 // A chart saved before this change: ICU orders released through faculty edits and ICU medications active.
 const old=JSON.parse(JSON.stringify(s));
 for(const flag of ['ruthOrthoStartV1','level3ChartCleanupV1'])delete old[flag];
 old.releaseQueue=old.releaseQueue.filter(q=>q.chartRecordId!==icu);
 old.chartContentEdits[icu]={title:'ICU Orders',category:'orders',status:'released',content:w.testApp.records.find(r=>r.id===icu).content};
 old.chartContentEdits['chart-262195d201d581c7adc3f86cdc38c563']={content:'<table><tr><td>ER VS</td><td></td></tr></table>'};
 for(const m of old.medicationCatalog.filter(m=>m.patientId===ruth&&icuMeds.includes(m.name)))Object.assign(m,{status:'Active',releaseStatus:'released'});
 delete old.ruthNorepinephrineV1;
 for(const m of old.medicationCatalog.filter(m=>m.patientId===ruth&&m.name==='Norepinephrine'))Object.assign(m,{name:'After fluid bolus, if MAP <65 or SBP <100: norepinephrine 2 mcg/min; titrate by 2 mcg every 5 minutes to MAP >65 or SBP >100; max 30 mcg/min',dose:'',notes:''});
 old.simulationBases={[ruth]:JSON.parse(JSON.stringify(w.SIMULATION_DEFAULTS[ruth]))};
 const migrated=start(old);checkRuthStart(migrated);
 const norepiRows=migrated.testApp.state.medicationCatalog.filter(m=>m.patientId===ruth&&/norepinephrine/i.test(m.name));
 assert.equal(norepiRows.length,1,'one norepinephrine row after migration');
 assert.equal(norepiRows[0].name,'Norepinephrine');assert.equal(norepiRows[0].dose,'2 mcg/min');
 assert(!view(migrated,'carl-shapiro','flowsheets').includes('ER VS'));
 migrated.resetToBase(ruth);checkRuthStart(migrated);
 assert(view(start(JSON.parse(JSON.stringify(migrated.testApp.state))),ruth,'orders').includes('Orthopedic Unit'));
 // Faculty Live Control edits are saved by their own buttons and must not trigger the student unsaved-draft warning.
 view(w,ruth,'faculty','faculty');
 const title=w.document.querySelector('#view [data-admin-record] .adminTitle');title.value+=' edited';title.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(w.simHasDraft(),false,'faculty edits are not student drafts');
 view(w,'carl-shapiro','flowsheets');
 const vital=[...w.document.querySelectorAll('#view input')].find(i=>i.type!=='datetime-local');vital.value='98.6';vital.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(w.simHasDraft(),true,'student charting still warns before leaving');
 console.log('PASS Level 3: WDL assessments removed, Carl/Karl ER vitals read-only, Ruth starts on ortho orders, ICU transfer release, reset, saved-chart migration and faculty save warning.');
}finally{for(const w of windows)w.close();}
