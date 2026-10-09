const assert=require('node:assert/strict'),boot=require('./boot.cjs');
const w=boot(),a=w.testApp,id='chart-2d6195d201d58077a080faf182983607';
try{
 w.setTabMode('student');a.setPatient('jane-fowler');a.setView('mar');
 const q=a.state.releaseQueue.find(x=>x.chartRecordId===id);
 assert(q);q.status='pending';
 const visible=()=>[...w.document.querySelectorAll('.chartRecord summary')].filter(x=>x.textContent==='Postoperative MAR').length;
 w.render();assert.equal(visible(),0,'pending document stays hidden');
 q.status='released';w.render();assert.equal(visible(),1,'released document appears once after full redraw');
 w.renderMAR();assert.equal(visible(),1,'direct redraw retains documentation');
 assert.equal(a.state.mar.length,0,'showing documentation records no administration');
 a.state.marHiddenRecords[id]=true;w.render();assert.equal(visible(),0,'faculty document visibility remains respected');
 delete a.state.marHiddenRecords[id];a.state.marVisibility['jane-fowler']=false;w.render();assert.equal(visible(),0,'hidden MAR cannot leak documents');
 a.state.marVisibility['jane-fowler']=true;q.status='pending';w.render();assert.equal(visible(),0,'return to pending hides documentation');
 console.log('Jane postoperative MAR release visibility passed');
}finally{w.close();}
