const assert=require('node:assert/strict'),boot=require('./boot.cjs'),copy=x=>JSON.parse(JSON.stringify(x));
const first=boot();let second,third;
try{
 const old=copy(first.testApp.state),id='chart-25d195d201d58169a4a1ef26c15346fb';old.schemaVersion=16;
 const record=copy(first.testApp.records.find(r=>r.id===id));record.content=record.content.replace(/every 12 hours/g,'q 8 hours').replace(/0800 2000/g,'0000 0800 1600');
 old.chartContentEdits||={};old.chartContentEdits[id]={content:record.content};old.customChartRecords.push(record);
 old.notes.push({id:'preserve-note',patientId:'vernon-watkins',narrative:'Student entry preserved'});
 second=boot(old);second.testApp.setPatient('vernon-watkins');second.testApp.setView('mar');second.setTabMode('faculty');second.render();
 assert(!second.document.getElementById('view').textContent.includes('Acetaminophen 1 gm po q 8 hours'));
 assert(second.document.getElementById('view').textContent.includes('Acetaminophen 1 gm po every 12 hours'));
 assert(second.testApp.state.notes.some(r=>r.id==='preserve-note'));
 third=boot(copy(second.testApp.state));assert(!third.testApp.state.chartContentEdits[id].content.includes('Acetaminophen 1 gm po q 8 hours'));
 console.log('PASS schema 17: saved imported Vernon MAR schedule corrected, reload stable, student note preserved.');
}finally{first.close();second?.close();third?.close();}
