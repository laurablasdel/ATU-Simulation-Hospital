const assert=require('node:assert/strict'),boot=require('./boot.cjs');
(async()=>{const w=boot(),key='atuSimulationHospitalEHRv1';try{
 let writes=0;const original=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(k,v){if(k===key)writes++;return original.call(this,k,v);};
 w.testApp.state.notes.push({id:'debounce-note',patientId:'charles-jones',narrative:'Retain this entry'});
 for(let i=0;i<12;i++)w.save();assert.equal(writes,0);assert.match(w.document.getElementById('saveBadge').textContent,/Saving/);
 await new Promise(r=>setTimeout(r,350));assert.equal(writes,1,'a burst writes one chart');assert(JSON.parse(w.localStorage.getItem(key)).notes.some(r=>r.id==='debounce-note'));
 w.testApp.state.notes.push({id:'pagehide-note',patientId:'charles-jones'});w.save();w.dispatchEvent(new w.Event('pagehide'));assert.equal(writes,2);assert(JSON.parse(w.localStorage.getItem(key)).notes.some(r=>r.id==='pagehide-note'));
 w.testApp.state.notes.push({id:'hidden-note',patientId:'charles-jones'});w.save();Object.defineProperty(w.document,'visibilityState',{configurable:true,value:'hidden'});w.document.dispatchEvent(new w.Event('visibilitychange'));assert.equal(writes,3);
 w.testApp.state.notes.push({id:'before-reset',patientId:'ruth-livingston'});w.save();w.resetToBase('charles-jones');assert(JSON.parse(w.localStorage.getItem(key)).notes.some(r=>r.id==='before-reset'),'reset flushes other patient work');
 w.Storage.prototype.setItem=()=>{throw Error('quota');};w.save();await new Promise(r=>setTimeout(r,350));assert.match(w.document.getElementById('saveBadge').textContent,/NOT SAVED/);w.Storage.prototype.setItem=original;
 console.log('PASS save coalescing: one write per burst, pagehide/hidden flush, reset flush and honest storage-error status.');
}finally{w.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
