const assert=require('node:assert/strict'),boot=require('./boot.cjs');
const windows=[],open=s=>{const w=boot(s);windows.push(w);return w;},copy=x=>JSON.parse(JSON.stringify(x));
try{
 const w=open(),keys=['simulationActivity','audit','simulationReports','simulationResetArchives','providerNotifications'];
 const legacy=copy(w.testApp.state);for(const key of keys)legacy[key]=[{id:'old-'+key,patientId:'amelia-sung'}];
 legacy.messages=[{id:'sbar-response',sbarId:'old-sbar',message:'Removed response'},{id:'release-msg',releaseItemId:'faculty-release',message:'Order released'}];
 legacy.notifications=[{id:'old-sbar-alert',type:'sbar'},{id:'old-response-alert',type:'message',releaseItemId:'sbar-response'},{id:'keep-release',type:'message',releaseItemId:'faculty-release'}];
 legacy.notes.push({id:'keep-student-note',patientId:'amelia-sung',student:'AS',narrative:'Keep completed charting'});
 const r=open(legacy);assert(r.testApp.state.notes.some(n=>n.id==='keep-student-note'));
 assert.deepEqual(Array.from(r.testApp.state.messages,m=>m.id),['release-msg']);assert.deepEqual(Array.from(r.testApp.state.notifications,n=>n.id),['keep-release']);
 assert(!r.document.querySelector('[data-view="debrief"]'));
 for(const state of [r.testApp.state,r.ATUSharedMerge(legacy,legacy,r.testApp.state),r.ATURecordCodec.decode(r.ATURecordCodec.encode(legacy))])for(const key of keys)assert(!(key in state),key+' must not return');
 for(const row of r.ATURecordCodec.encode(legacy).values())assert(!keys.includes(row.collection),'no retired outbound collection');
 for(const p of r.testApp.state.patients){r.resetToBase(p.id);for(const key of keys)assert(!(key in r.testApp.state));}
 assert(!r.testApp.state.notes.some(n=>n.id==='keep-student-note'),'reset clears selected patient documentation');
 console.log('PASS removed audit data: saved-chart migration, old-client merge, transport filtering, no debrief screen, all-patient reset without archives.');
}finally{windows.forEach(w=>w.close());}
