const assert=require('node:assert/strict'),boot=require('./boot.cjs');
const windows=[],open=s=>{const w=boot(s,undefined,{name:'Test Student',group:'',area:'Medical Surgical'});windows.push(w);return w;};
try{
 const w=open(),a=w.testApp,pid='jane-fowler',id='chart-2d6195d201d58077a080faf182983607';a.setPatient(pid);a.setView('mar');w.setTabMode('student');
 const q=a.state.releaseQueue.find(r=>r.chartRecordId===id);q.status='released';
 const text=()=>w.document.getElementById('view').textContent;
 w.render();assert(!/Narcan|Naloxone|Ketorolac|Toradol/i.test(text()),'unreleased rescue drugs absent from student MAR including imported table');
 w.renderImportedChart();assert(!/Narcan|Naloxone|Ketorolac|Toradol/i.test(text()),'complete chart also respects release');
 for(const [rid,name,other] of [['admin-jane-respiratory-naloxone','Narcan','Ketorolac'],['admin-jane-respiratory-ketorolac','Ketorolac',null]]){
  w.setTabMode('faculty');const item=a.state.releaseQueue.find(r=>r.chartRecordId===rid);assert(item&&item.status==='pending');w.releaseItem(item.id);w.setTabMode('student');w.renderMAR();assert(text().includes(name),'released drug becomes visible');if(other)assert(!text().includes(other),'other drug remains hidden');
 }
 assert.equal(a.state.mar.filter(r=>r.patientId===pid).length,0,'releasing a drug creates no administration');
 a.setView('preop');w.render();assert(w.document.querySelector('aside [data-view="preop"]:not(.hiddenByPatient)'));assert(w.document.getElementById('saveJaneChecklist'));assert(!w.document.getElementById('saveJaneAssessment'));
 w.document.getElementById('janeChecklistStudent').value='TS';w.document.getElementById('jpc-identifiers').checked=true;w.document.getElementById('saveJaneChecklist').click();assert(a.state.surgicalChecklist.find(r=>r.patientId===pid).checks.identifiers);assert(!w.document.getElementById('saveJaneAssessment'),'save stays on checklist');
 const saved=JSON.parse(JSON.stringify(a.state)),order=a.records.find(r=>r.patientId===pid&&/Titrate oxygen/.test(r.content));assert(order&&order.content.includes('94% or greater'));
 saved.chartContentEdits[order.id]={...order,content:order.content.replace('94%','98%')};
 const reload=open(saved);reload.testApp.setPatient(pid);reload.testApp.setView('preop');reload.setTabMode('student');reload.render();assert(reload.document.getElementById('jpc-identifiers').checked,'saved checklist survives reload');assert(!reload.testApp.records.some(r=>r.patientId===pid&&/Titrate oxygen[^\n]*98%/.test(r.content)),'saved oxygen order migrated');
 w.setTabMode('faculty');w.resetToBase(pid);w.setTabMode('student');a.setView('mar');w.render();assert(!/Narcan|Naloxone|Ketorolac|Toradol/i.test(text()),'reset holds drugs again');
 a.setPatient('amelia-sung');a.setView('summary');w.render();assert(w.document.querySelector('aside [data-view="preop"]').classList.contains('hiddenByPatient'));
 console.log('PASS Jane individual rescue releases, imported MAR visibility, complete chart, reset, checklist navigation/save/reload, oxygen saved-order migration, other-patient menu.');
}finally{setImmediate(()=>windows.forEach(w=>w.close()));}
