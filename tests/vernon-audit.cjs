const assert=require('node:assert/strict'),boot=require('./boot.cjs'),fs=require('fs'),path=require('path');
const windows=[],start=s=>{const w=boot(s);windows.push(w);return w;},clone=x=>JSON.parse(JSON.stringify(x));
const pid='vernon-watkins',tick=()=>new Promise(r=>setImmediate(r));
function view(w,id,name,mode='student'){w.setTabMode(mode);w.testApp.setPatient(id);w.testApp.setView(name);w.render();return w.document.getElementById('view');}
function checkIn(w,id,first,last){w.signOutStudent();w.checkInForChart(id,()=>{w.testApp.setPatient(id);w.testApp.setView('summary');w.render();});const f=w.document.querySelector('#studentCheckIn form');f.elements.area.value='Medical Surgical';f.elements.firstName.value=first;f.elements.lastName.value=last;f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}
(async()=>{try{
 const w=start(),s=w.testApp.state;
 assert.equal(w.formatChartTimestamp('2026-09-28T14:35'),'14:35_09/28/2026');
 assert.equal(w.formatChartTimestamp('2026-09-28T19:35:00Z'),'14:35_09/28/2026');
 assert.equal(w.formatChartTimestamp('2026-01-28T20:35:00Z'),'14:35_01/28/2026');
 assert.equal(w.formatChartTimestamp('Today'),'Today');

 assert(view(w,pid,'labs').textContent.includes('Postop day 4'));
 const releases=w.VERNON_PROFILE_RECORDS.filter(r=>r.status==='pending');assert.equal(releases.length,4);
 for(const r of releases){assert(![...view(w,pid,r.category).querySelectorAll('details.chartRecord > summary')].some(el=>el.textContent===r.title));const q=s.releaseQueue.find(q=>q.chartRecordId===r.id);assert(q);w.setTabMode('faculty');w.releaseItem(q.id);assert(view(w,pid,r.category).textContent.includes(r.title));}
 const flow=view(w,pid,'flowsheets').querySelector('form.recordEntry');assert(flow,'released heparin form is editable');assert(!flow.textContent.includes('08/21'));
 flow.elements.student.value='HN';flow.elements.shift.value='Day';flow.elements['field-3'].value='75';flow.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert(s.chartEntries.some(r=>r.recordId==='chart-303195d201d58008afd5fe58a12dc63e'&&r.values['field-3']==='75'),'heparin uses the existing saved chart form structure');
 assert(!view(w,pid,'orders').textContent.includes('8/21'));
 const reload=start(clone(s));assert(view(reload,pid,'orders').textContent.includes('Stat Orders'));reload.resetToBase(pid);assert(!view(reload,pid,'orders').textContent.includes('Stat Orders'));
 for(const p of s.patients){
  checkIn(w,p.id,'Student',p.id);assert(!w.document.getElementById('studentCheckIn'));
  const root=view(w,p.id,'flowsheets');assert.equal(root.querySelector('#vStudent').value,'','check-in never prefills documentation');
  root.querySelector('#vStudent').value='ST';root.querySelector('#vTime').value='2026-09-28T14:35';root.querySelector('#vBP').value='120/80';root.querySelector('#saveVitals').click();await tick();
  assert(root.textContent.includes('14:35_09/28/2026'),p.id+' formatted history');
  assert.equal(s.vitals.filter(r=>r.patientId===p.id).at(-1).time,'2026-09-28T14:35');
  assert.equal(root.querySelector('h2').textContent,'Vitals History');
 }
 w.setTabMode('student');w.signOutStudent();w.checkInForChart(pid,()=>assert.fail('blank name accepted'));let f=w.document.querySelector('#studentCheckIn form');f.elements.firstName.value=' ';f.elements.lastName.value='Test';f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert(w.document.getElementById('studentCheckIn'));w.setTabMode('faculty');w.render();
 const old=clone(s);w.setTabMode('faculty');w.resetToBase(pid);assert(!s.vitals.some(r=>r.patientId===pid));
 const before=clone(s.vitals);const set=w.Storage.prototype.setItem;w.Storage.prototype.setItem=()=>{throw Error('quota')};assert.throws(()=>w.resetToBase('karl-sharp'));assert.deepEqual(clone(s.vitals),before,'failed local save must abort reset');w.Storage.prototype.setItem=set;
 const legacy=clone(old);legacy.schemaVersion=0;delete legacy.vernonProfileV1;legacy.orders.push({id:'old-aug21',patientId:pid,time:'2026-08-21T14:15',text:'old simulation'},{id:'keep-current',patientId:pid,time:'2026-09-28T14:15',text:'current simulation'});
 const migrated=start(legacy);assert(!migrated.testApp.state.orders.some(r=>r.id==='old-aug21'));assert(migrated.testApp.state.orders.some(r=>r.id==='keep-current'));
 for(const id of ['ruth-livingston','carl-shapiro','vernon-watkins','karl-sharp'])for(const [name,heading] of [['orders','Order List'],['assessments','Assessment History'],['flowsheets','Vitals History']])assert.equal(view(w,id,name).querySelector('h2').textContent,heading);
 console.log('PASS Vernon releases, editable heparin form, all-patient formatted history, reset/reload, storage failure and legacy cleanup.');
}finally{await tick();windows.forEach(w=>w.close());}})().catch(e=>{console.error(e);process.exitCode=1});
