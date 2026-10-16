const assert=require('node:assert/strict'),boot=require('./boot.cjs');
for(const device of [{mode:'observer'},{role:'observer'},{url:'https://simulation.test/?mode=observer'},{mode:'faculty',role:'observer'},{mode:'student',role:'observer'}]){
 const w=boot(undefined,undefined,undefined,device);try{
  assert.equal(w.getTabMode(),device.mode==='faculty'?'faculty':'student');
  assert.equal(w.localStorage.getItem('atuSimulationHospitalEHRv1_device_role'),null);
  assert(!w.document.querySelector('#observerBar,#observerToasts,#makeObserver'));
  if(device.mode!=='faculty')assert(w.document.querySelector('#studentCheckIn form'),'retired device requires normal student sign-in');
  const count=w.testApp.state.mar.length;w.setTabMode('observer');assert.equal(w.getTabMode(),'student');assert.equal(w.testApp.state.mar.length,count);
  w.setTabMode('faculty');w.testApp.setPatient('amelia-sung');w.testApp.setView('faculty');w.render();assert(!w.document.getElementById('view').textContent.includes('Observer'));assert(w.document.getElementById('simResetBase'));
 }finally{w.close();}
}
console.log('PASS two modes: old session/device/bookmark enters student sign-in, explicit faculty retained, no observer controls, chart history preserved.');
