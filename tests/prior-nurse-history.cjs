const assert=require('node:assert/strict'),boot=require('./boot.cjs'),copy=x=>JSON.parse(JSON.stringify(x)),windows=[];
const open=s=>{const w=boot(s);windows.push(w);return w;};
try{
 const w=open(),s=w.testApp.state,specs=w.PRIOR_NURSE_SPECS,baseline=specs.filter(e=>e.shift===1);
 assert.equal(baseline.length,34);
 for(const e of baseline){const row=s.mar.find(r=>r.id===`prior-nurse:${e.patientId}:1:${e.key}`);assert(row,e.patientId+':'+e.key);assert.equal(row.status,e.status);assert.equal(row.student,e.student||'LB');assert.equal(row.initials,e.student||'LB');assert.equal(row.time,e.time?s.simulationShifts[e.patientId].date+'T'+e.time:'');assert.equal(row.dose,e.dose);assert(row.seeded&&row.readOnly);assert(s.medicationCatalog.some(m=>m.id===row.medicationId));}
 for(const pid of ['vincent-brody','jane-fowler','baby-boy-sung'])assert(!s.mar.some(r=>r.patientId===pid&&r.seeded));
 assert(!s.mar.some(r=>r.patientId==='amelia-sung'&&/clindamycin/i.test(r.medication)));
 const again=open(copy(s));assert.equal(again.testApp.state.mar.filter(r=>r.seeded).length,34);
 w.setTabMode('faculty');
 w.testApp.setPatient('amelia-sung');w.testApp.setView('faculty');w.render();assert.equal(w.document.getElementById('startSimulationShift').textContent,'Start Shift 2');
 for(const pid of new Set(baseline.map(e=>e.patientId))){w.resetToBase(pid);assert.equal(w.testApp.state.mar.filter(r=>r.patientId===pid&&r.seeded).length,baseline.filter(e=>e.patientId===pid).length);w.testApp.setPatient(pid);w.testApp.setView('mar');w.render();assert(w.document.querySelectorAll('[data-prior-nurse="true"]').length);assert(!w.document.querySelector('[data-prior-nurse="true"] button'));}
 for(const pid of ['amelia-sung','fatima-sanogo','molly-thomas','stephanie-smith','charles-jones']){const result=w.startSimulationShift(pid,2);assert(result.ok,JSON.stringify(result));assert.equal(result.missing.length,0);const count=w.testApp.state.mar.length;assert(!w.startSimulationShift(pid,2).ok);assert.equal(w.testApp.state.mar.length,count);}
 assert(w.startSimulationShift('stephanie-smith',3).ok);assert(w.testApp.state.bloodAdministration.some(r=>r.seeded&&r.bloodType==='A-'&&r.status==='Started'));
 assert.equal(w.testApp.state.medicationCatalog.find(m=>m.patientId==='amelia-sung'&&/^Oxytocin/.test(m.name)).status,'Discontinued');
 w.resetToBase('amelia-sung');assert.equal(w.testApp.state.simulationShifts['amelia-sung'].shift,1);assert(!w.testApp.state.mar.some(r=>r.patientId==='amelia-sung'&&r.appearShift===2));
 const med=w.testApp.state.medicationCatalog.find(m=>m.patientId==='amelia-sung'&&/^Clindamycin/.test(m.name));
 const student={id:'real-student-clinda',patientId:'amelia-sung',medicationId:med.id,medication:med.name,dose:'900 mg',route:'IVPB',student:'ST',status:'Given',shiftNumber:1,time:'2026-10-16T09:30'};
 w.testApp.state.mar.push(student);w.liveSave();assert(w.startSimulationShift('amelia-sung',2).ok);assert(!w.testApp.state.mar.some(r=>r.id==='prior-nurse:amelia-sung:2:clindamycin'));assert(w.testApp.state.mar.some(r=>r.id===student.id));
 const base=copy(again.testApp.state),local=copy(base),remote=copy(base);local.mar.push({...student,medicationId:base.medicationCatalog.find(m=>m.patientId==='amelia-sung'&&/^Clindamycin/.test(m.name)).id});remote.mar.push({...student,id:'prior-nurse:amelia-sung:2:clindamycin',seeded:true,source:'prior-nurse',origin:'prior-nurse'});const merged=w.ATUSharedMerge(base,local,remote);assert(merged.mar.some(r=>r.id===student.id));assert(!merged.mar.some(r=>r.id==='prior-nurse:amelia-sung:2:clindamycin'));
 w.setTabMode('student');assert(!w.startSimulationShift('molly-thomas',2).ok);
 w.setTabMode('faculty');w.resetToBase('molly-thomas');const beforeFailure=copy(w.testApp.state),save=w.liveSave;w.liveSave=()=>{throw Error('test storage unavailable');};assert(!w.startSimulationShift('molly-thomas',2).ok);w.liveSave=save;assert.deepEqual(copy(w.testApp.state),beforeFailure,'failed save rolls back shift and seeded doses');
 const shiftBase=copy(w.testApp.state),shiftLocal=copy(shiftBase),shiftRemote=copy(shiftBase);shiftLocal.simulationShifts['stephanie-smith'].shift=2;shiftRemote.simulationShifts['stephanie-smith'].shift=3;assert.equal(w.ATUSharedMerge(shiftBase,shiftLocal,shiftRemote).simulationShifts['stephanie-smith'].shift,3);
 const saved=open(copy(w.testApp.state));assert.equal(saved.testApp.state.simulationShifts['stephanie-smith'].shift,3);
 for(const r of w.testApp.records.filter(r=>['ruth-livingston','carl-shapiro','karl-sharp','vernon-watkins','david-carter'].includes(r.patientId)))assert(!/<td>\s*(LJ|CR)\s*<\/td>/i.test(r.content),r.id);
 console.log('PASS prior-nurse: all 34 baseline entries, unchanged excluded patients, reset/reload, read-only display, every later shift, repeat rejection, student-dose/concurrent deduplication, saved shared shift, imported initials.');
}finally{windows.forEach(w=>w.close());}
