const assert=require('node:assert/strict'),boot=require('./boot.cjs'),fs=require('fs'),path=require('path');
const windows=[],start=s=>{const w=boot(s);windows.push(w);return w;},clone=x=>JSON.parse(JSON.stringify(x));
const pid='vernon-watkins',tick=()=>new Promise(r=>setImmediate(r));
function view(w,id,name,mode='student'){w.setTabMode(mode);w.testApp.setPatient(id);w.testApp.setView(name);w.render();return w.document.getElementById('view');}
function checkIn(w,id,first,last){w.signOutStudent();w.checkInForChart(id,()=>{w.testApp.setPatient(id);w.testApp.setView('summary');w.render();});const f=w.document.querySelector('#studentCheckIn form');f.elements.area.value='Medical Surgical and ICU';f.elements.firstName.value=first;f.elements.lastName.value=last;f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}
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
  assert(s.simulationActivity.some(e=>e.patientId===p.id&&e.actor==='Student '+p.id&&e.collection==='vitals'));
  assert.equal(root.querySelector('h2').textContent,'Vitals History');
 }
 w.setTabMode('student');w.signOutStudent();w.checkInForChart(pid,()=>assert.fail('blank name accepted'));let f=w.document.querySelector('#studentCheckIn form');f.elements.firstName.value=' ';f.elements.lastName.value='Test';f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert(w.document.getElementById('studentCheckIn'));w.setTabMode('faculty');w.render();
 checkIn(w,pid,'Alex','Nurse');view(w,pid,'flowsheets');w.document.querySelector('aside [data-view="orders"]').click();assert(s.simulationActivity.some(e=>e.patientId===pid&&e.type==='Section opened'&&e.actor==='Alex Nurse'));
 s.providerNotifications.push({id:'sbar-audit',patientId:pid,student:'AN',situation:'Breathing changed',recommendation:'Assess now',createdAt:'2026-09-28T14:35'});w.save();
 const first=w.buildSimulationReport(pid),html=w.simulationReportHTML(first);assert(html.includes('Alex Nurse')&&html.includes('Breathing changed')&&html.includes('Assess now'));
 const evil=clone(first);evil.patient.name='<script>alert(1)</script>';assert(!w.simulationReportHTML(evil).includes('<script>alert'));
 const old=clone(s);w.setTabMode('faculty');w.resetToBase(pid);assert.equal(s.simulationReports.filter(r=>r.patientId===pid).length,1);assert(!s.providerNotifications.some(r=>r.id==='sbar-audit'));
 checkIn(w,pid,'Second','Student');w.resetToBase(pid);assert.equal(s.simulationReports.filter(r=>r.patientId===pid).length,2);
 const reopened=start(clone(s));assert.equal(reopened.testApp.state.simulationReports.filter(r=>r.patientId===pid).length,2);
 reopened.resetToBase(pid);assert.equal(reopened.testApp.state.simulationReports.filter(r=>r.patientId===pid).length,3);
 const merged=w.ATUSharedMerge(old,old,clone(s));assert.equal(merged.simulationReports.filter(r=>r.patientId===pid).length,2,'stale client cannot remove reports');
 assert(!merged.providerNotifications.some(r=>r.id==='sbar-audit'),'stale client cannot resurrect simulation entries');
 assert(merged.simulationActivity.some(e=>e.actor==='Alex Nurse'),'old simulation access is retained');
 view(reopened,pid,'debrief','faculty');assert.equal(reopened.document.querySelectorAll('[data-report]').length,3);
 reopened.document.getElementById('buildDebrief').click();assert(reopened.document.getElementById('dResult').textContent.includes('Vernon Watkins'));
 reopened.document.getElementById('previewCurrentAudit').click();assert(reopened.document.querySelector('#auditPreview iframe').srcdoc.includes('Simulation chart audit'));
 reopened.URL.createObjectURL=()=> 'blob:test-report';reopened.URL.revokeObjectURL=()=>{};let downloaded='';reopened.HTMLAnchorElement.prototype.click=function(){downloaded=this.download;};reopened.document.getElementById('downloadCurrentAudit').click();assert(downloaded.startsWith('vernon-watkins-simulation-'));assert(reopened.document.querySelector('#auditDownloadReady a[download]'),'direct download fallback available');
 const before=clone(s.vitals);const set=w.Storage.prototype.setItem;w.Storage.prototype.setItem=()=>{throw Error('quota')};assert.throws(()=>w.resetToBase('karl-sharp'));assert.deepEqual(clone(s.vitals),before,'failed archive save must abort reset');w.Storage.prototype.setItem=set;
 const legacy=clone(old);delete legacy.vernonProfileV1;legacy.orders.push({id:'old-aug21',patientId:pid,time:'2026-08-21T14:15',text:'old simulation'},{id:'keep-current',patientId:pid,time:'2026-09-28T14:15',text:'current simulation'});
 const migrated=start(legacy);assert(!migrated.testApp.state.orders.some(r=>r.id==='old-aug21'));assert(migrated.testApp.state.orders.some(r=>r.id==='keep-current'));
 for(const id of ['ruth-livingston','carl-shapiro','vernon-watkins','karl-sharp'])for(const [name,heading] of [['orders','Order List'],['assessments','Assessment History'],['flowsheets','Vitals History']])assert.equal(view(w,id,name).querySelector('h2').textContent,heading);
 fs.writeFileSync(path.join(__dirname,'..','..','vernon-audit-preview.html'),html);
 console.log('PASS Vernon and audit: routine labs, four independent releases, clean heparin form, reset/reload, all 13 patients timestamp/identity/history, SBAR report, three retained simulations, stale-client merge, storage-failure protection, legacy cleanup.');
}finally{await tick();windows.forEach(w=>w.close());}})().catch(e=>{console.error(e);process.exitCode=1});
