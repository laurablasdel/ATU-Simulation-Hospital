const assert=require('node:assert/strict'),boot=require('./boot.cjs');
const pid='ruth-livingston',baseline='chart-25d195d201d581f58678f1d549846bc0',note='chart-25d195d201d5819ba68ad680b4eab2b3';
const ids=['chart-25d195d201d58103a862e1423b28b42b','chart-25d195d201d5813d8944d02d7166f91c','chart-25d195d201d58164b326d9be8612eae5'];
const windows=[];function start(saved){const w=boot(saved);windows.push(w);w.testApp.setPatient(pid);return w;}
try{
 const w=start(),a=w.testApp,s=a.state;
 assert.equal(s.patients.find(p=>p.id===pid).mrn,'PCS10800');
 for(const id of ids){assert.equal(s.releaseQueue.filter(q=>q.chartRecordId===id).length,1);assert(!w.chartRecordReleased(a.records.find(r=>r.id===id)));}
 w.sessionStorage.setItem('atuEhrTabMode','student');a.setView('labs');w.render();
 assert(w.document.querySelector('#view').textContent.includes('Blood culture: pending'));
 assert([...w.document.querySelectorAll('#view table tr')].some(r=>r.cells.length===3&&r.cells[1].textContent==='Yesterday 0600'&&r.cells[2].textContent==='Today 0600'),'Lab dates must remain aligned table cells');
 assert(!w.document.querySelector('#view').textContent.includes('Positive E. Cloacae'));
 assert(!w.document.querySelector('#view').textContent.includes('Current repeat'));
 w.renderNotes();assert(w.document.querySelector('#view').textContent.includes('A repeat urinalysis was sent to lab'));
 w.sessionStorage.setItem('atuEhrTabMode','faculty');w.renderFaculty();
 assert(w.document.querySelector('#view').textContent.includes('verify chloride before release'));
 for(const id of ids)w.releaseItem(s.releaseQueue.find(q=>q.chartRecordId===id).id);
 w.sessionStorage.setItem('atuEhrTabMode','student');a.setView('labs');w.render();
 assert(w.document.querySelector('#view').textContent.includes('Positive E. Cloacae'));
 assert(w.document.querySelector('#view').textContent.includes('Current repeat'));
 a.setView('orders');w.render();assert(w.document.querySelector('#view').textContent.includes('Transfuse 2 units PRBC'));
 w.refreshSimulationRecords();for(const id of ids)assert(w.chartRecordReleased(a.records.find(r=>r.id===id)));
 const reopened=start(JSON.parse(JSON.stringify(s)));for(const id of ids)assert(reopened.chartRecordReleased(reopened.testApp.records.find(r=>r.id===id)));
 w.resetToBase(pid);for(const id of ids){assert(!w.chartRecordReleased(a.records.find(r=>r.id===id)));assert.equal(s.releaseQueue.filter(q=>q.chartRecordId===id).length,1);}
 assert(w.chartRecordReleased(a.records.find(r=>r.id===baseline)));assert(a.records.some(r=>r.id===note));
 const old=JSON.parse(JSON.stringify(s));delete old.ruthProfileImportV1;old.releaseQueue=old.releaseQueue.filter(q=>!ids.includes(q.chartRecordId));
 old.chartContentEdits[baseline]={content:'Original document has not been recovered. Faculty must supply this document before this chart is complete.'};
 old.notes.push({id:'preserved-ruth-student-note',patientId:pid,narrative:'Keep me',origin:'student'});
 old.simulationBases[pid]=JSON.parse(JSON.stringify(w.SIMULATION_DEFAULTS[pid]));old.simulationBases[pid].chartRecords=old.simulationBases[pid].chartRecords.filter(r=>!ids.includes(r.id)&&r.id!==note);old.simulationBases[pid].chartRecords.find(r=>r.id===baseline).content=old.chartContentEdits[baseline].content;old.simulationBases[pid].releaseQueue=[];
 const migrated=start(old),m=migrated.testApp;
 assert(m.records.find(r=>r.id===baseline).content.includes('Blood culture: pending'));
 assert(m.state.notes.some(r=>r.id==='preserved-ruth-student-note'));
 migrated.resetToBase(pid);for(const id of ids)assert(!migrated.chartRecordReleased(m.records.find(r=>r.id===id)));
 assert(m.records.find(r=>r.id===baseline).content.includes('Blood culture: pending'));
 console.log('PASS Ruth: baseline labs/note, three faculty releases, student visibility, reload/reset, and legacy placeholder migration.');
}finally{for(const w of windows)w.close();}
