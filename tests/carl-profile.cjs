const assert=require('node:assert/strict'),boot=require('./boot.cjs');
const pid='carl-shapiro',lab='chart-262195d201d580e18688dc6f4d7711db',baseline='chart-262195d201d581579e8ccb9409ec5a4f',note='chart-262195d201d581ad96b0e8bb01be03b9';
const windows=[];const start=s=>{const w=boot(s);windows.push(w);w.testApp.setPatient(pid);return w;};
try{
 const w=start(),app=w.testApp,s=app.state;
 const queued=()=>s.releaseQueue.filter(q=>q.chartRecordId===lab);
 assert.equal(queued().length,1);assert.equal(queued()[0].status,'pending');
 assert.equal(w.chartRecordReleased(app.records.find(r=>r.id===lab)),false);
 assert.equal(w.chartRecordReleased(app.records.find(r=>r.id===baseline)),true);
 w.renderFaculty();assert(w.document.querySelector('.chartUpdateCard').textContent.includes('Lab Results (Shapiro new)'));
 w.sessionStorage.setItem('atuEhrTabMode','student');app.setView('labs');w.render();assert(!w.document.querySelector('#view').innerHTML.includes('455237add31d929e25.png'));assert(w.document.querySelector('#view').innerHTML.includes('2129d47d701ee637e0.png'));
 w.renderNotes();assert(w.document.querySelector('#view').textContent.includes('normal saline bolus required after the second dose'));assert(w.document.querySelector('#view').textContent.includes('LJ'));
 w.sessionStorage.setItem('atuEhrTabMode','faculty');w.releaseItem(queued()[0].id);w.sessionStorage.setItem('atuEhrTabMode','student');app.setView('labs');w.render();assert(w.document.querySelector('#view').innerHTML.includes('455237add31d929e25.png'));
 w.refreshSimulationRecords();assert.equal(queued()[0].status,'released');
 const reopened=start(JSON.parse(JSON.stringify(s)));assert.equal(reopened.testApp.state.releaseQueue.find(q=>q.chartRecordId===lab).status,'released');
 w.resetToBase(pid);assert.equal(s.releaseQueue.filter(q=>q.chartRecordId===lab).length,1);assert.equal(s.releaseQueue.find(q=>q.chartRecordId===lab).status,'pending');assert(!w.chartRecordReleased(app.records.find(r=>r.id===lab)));assert(w.chartRecordReleased(app.records.find(r=>r.id===baseline)));assert(app.records.some(r=>r.id===note));
 const old=JSON.parse(JSON.stringify(s));delete old.carlProfileImportV1;old.chartContentEdits[lab].status='released';old.releaseQueue=old.releaseQueue.filter(q=>q.chartRecordId!==lab);old.notes.push({id:'student-preserved',patientId:pid,narrative:'Keep this note',origin:'student'});
 old.simulationBases[pid]=JSON.parse(JSON.stringify(w.SIMULATION_DEFAULTS[pid]));old.simulationBases[pid].chartRecords.find(r=>r.id===lab).status='released';old.simulationBases[pid].chartRecords=old.simulationBases[pid].chartRecords.filter(r=>r.id!==note);old.simulationBases[pid].releaseQueue=[];
 const prior=start(old),p=prior.testApp.state;assert.equal(p.chartContentEdits[lab].status,'pending');assert.equal(p.releaseQueue.filter(q=>q.chartRecordId===lab).length,1);assert(p.notes.some(n=>n.id==='student-preserved'));assert.equal(p.simulationBases[pid].chartRecords.find(r=>r.id===lab).status,'pending');assert(p.simulationBases[pid].chartRecords.some(r=>r.id===note));
 prior.resetToBase(pid);assert(!prior.chartRecordReleased(prior.testApp.records.find(r=>r.id===lab)));assert(prior.chartRecordReleased(prior.testApp.records.find(r=>r.id===baseline)));
 console.log('PASS Carl: baseline visible, new labs gated, release/reload/reset, nursing note, legacy state/base migration, and student data preservation.');
}finally{for(const w of windows)w.close();}
