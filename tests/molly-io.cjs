const assert=require('node:assert/strict'),boot=require('./boot.cjs');
const w=boot();let reloaded;
try{
 w.setTabMode('faculty');w.testApp.setPatient('molly-thomas');
 const r=w.testApp.records.find(r=>r.patientId==='molly-thomas'&&r.category==='io');
 const host=w.document.getElementById('view');host.innerHTML=w.chartRecordCards([r]);
 const form=host.querySelector('.recordEntry'),table=form.querySelector('table');
 assert.equal(table.tHead.rows.length,1);assert.equal(table.tHead.querySelectorAll('th').length,10);assert.equal(table.tHead.querySelectorAll('input').length,0);
 assert.equal(table.querySelectorAll('.ioEntryRow input').length,10);assert(table.textContent.includes('1138'));assert(table.textContent.includes('D5 infusion mL/hr'));
 form.elements.student.value='TEST';form.elements.shift.value='Day';form.elements['io-1'].value='2026-09-30';form.elements['io-2'].value='14:30';form.elements['io-3'].value='60 mL';form.elements['io-6'].value='35 mL';
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const saved=w.testApp.state.chartEntries.find(e=>e.recordId===r.id&&e.student==='TEST');assert(saved);assert.equal(saved.patientId,'molly-thomas');assert.equal(saved.values['io-3'],'60 mL');assert(saved.snapshot.includes('35 mL'));assert.equal(form.elements['io-3'].value,'');
 reloaded=boot(JSON.parse(JSON.stringify(w.testApp.state)));reloaded.testApp.setPatient('molly-thomas');const html=reloaded.chartRecordCards([r]);assert(html.includes('60 mL'));assert(html.includes('35 mL'));assert(reloaded.testApp.state.chartEntries.some(e=>e.id===saved.id));
 const unchanged='<table><tbody><tr><td>Other form</td><td></td></tr></tbody></table>';assert.equal(w.inputOutputEntryTable(unchanged),unchanged);
 console.log('PASS Molly I/O: one header row, 10 blank fields, source observations retained, save/reset/navigation/reload, other tables unchanged.');
}finally{setImmediate(()=>{w.close();reloaded?.close();});}
