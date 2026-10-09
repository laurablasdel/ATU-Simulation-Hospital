const assert=require('node:assert/strict'),boot=require('./boot.cjs');
const windows=[];const start=s=>{const w=boot(s);windows.push(w);w.sessionStorage.setItem('atuEhrTabMode','student');return w;};
try{
 const w=start(),a=w.testApp,s=a.state,el=id=>w.document.getElementById(id);let sequence=0,scans=0,manuals=0;
 const save=w.saveMedicationAdministration;w.saveMedicationAdministration=input=>{input.method==='barcode'?scans++:manuals++;return save(input);};
 function render(pid){a.setPatient(pid);a.setView('mar');w.render();}
 function scan(pid,m,code){render(pid);el('marScanPatient').value=s.patients.find(p=>p.id===pid).barcode;el('marScanMedication').value=code||w.packagesForMedication(m)[0].id;el('marRecognize').click();if(el('marMatchedOrder')){assert.equal(el('marMatchedOrder').value,'');assert(!el('marConfirmSave'));el('marMatchedOrder').value=m.id;el('marMatchedOrder').dispatchEvent(new w.Event('change'));}}
 function fillAndSave(m){assert(el('marConfirmSave'),'Expected confirmation for '+m.name);el('marConfirmDose').value=m.dose||'1 test unit';el('marConfirmRoute').value=m.route||'Test route';el('marConfirmStudent').value='TEST';el('marConfirmVerifier').value='SECOND';el('marConfirmTime').value='2026-09-25T'+String(10+Math.floor(sequence/60)).padStart(2,'0')+':'+String(sequence++%60).padStart(2,'0');el('marConfirmNotes').value='Automated simulation test';if(el('marRepeatConfirmed'))el('marRepeatConfirmed').checked=true;el('marConfirmGiven').checked=true;const before=s.mar.length;el('marConfirmSave').click();assert.equal(s.mar.length,before+1,el('marSaveFeedback')?.textContent);assert.equal(el('marScanPatient').value,'','patient must scan again');assert.equal(el('marScanMedication').value,'');assert(w.document.querySelector('#view').textContent.includes('Given'));}
 const coverage=[];
 for(const p of s.patients){
  render(p.id);assert(el('marRecognize'),'Scanner unavailable for '+p.name);
  const meds=w.medicationsForPatient(p.id,false).filter(m=>!w.medicationAdministrationBlock(m));assert(meds.length,p.name+' has no eligible test medication');
  const before=s.mar.length,first=meds[0];el('marScanPatient').value=p.barcode;const prefix="manual-"+first.id;el(prefix+"-time").value="2026-09-24T09:00";el(prefix+"-student").value="TEST";if(el(prefix+"-verifier"))el(prefix+"-verifier").value="SECOND";if(el(prefix+"-dose"))el(prefix+"-dose").value="1 test unit";if(el(prefix+"-route"))el(prefix+"-route").value="Test route";w.document.querySelector(`[data-medication-id="${first.id}"]`).click();assert.equal(s.mar.length,before,"unchecked Given does not save");el(prefix+"-given").checked=true;w.document.querySelector(`[data-medication-id="${first.id}"]`).click();assert.equal(s.mar.length,before+1,el("marScanFeedback").textContent);assert.equal(el("marScanPatient").value,"");
  let count=0;for(const m of meds){if(w.medicationAdministrationBlock(m))continue;const before=s.mar.length;scan(p.id,m);assert.equal(s.mar.length,before,'Scan alone saved a dose');fillAndSave(m);count++;}
  coverage.push({patient:p.name,scannedOrders:count});
 }
 assert.equal(coverage.length,13);assert(manuals>=13);assert(scans>=13);
 // Ambiguous package, no selection and no implicit administration.
 const pid='vernon-watkins',tic=w.medicationsForPatient(pid,false).find(m=>m.name.includes('Oxycodone 5'));
 render(pid);el('marScanPatient').value=s.patients.find(p=>p.id===pid).barcode;el('marScanMedication').value=w.packagesForMedication(tic)[0].id;const before=s.mar.length;el('marRecognize').click();assert(el('marMatchedOrder'));assert(!el('marConfirmSave'));assert.equal(s.mar.length,before);
 // Unknown code, wrong patient, legacy code from another patient's order, held and completed orders.
 function noSave(code,wristband){render(pid);el('marScanPatient').value=wristband||s.patients.find(p=>p.id===pid).barcode;el('marScanMedication').value=code;const n=s.mar.length;el('marRecognize').click();assert(!el('marConfirmSave'));assert.equal(s.mar.length,n);}
 noSave('MED-UNKNOWN');noSave(w.packagesForMedication(tic)[0].id,s.patients.find(p=>p.id==='ruth-livingston').barcode);
 noSave(s.medicationCatalog.find(m=>m.patientId==='ruth-livingston').barcode);
 const unknownForCarl=s.medicationPackages.find(p=>p.name==='Lisinopril');noSave(unknownForCarl.id);
 const testMed={id:'test-future-order',patientId:'future-patient',name:'Future Medicine',dose:'5 mg',route:'PO',frequency:'PRN',status:'Active',releaseStatus:'released',barcode:'9901'};
 s.patients.push({id:'future-patient',name:'Future Patient',mrn:'FUTURE',barcode:'9900',level:1});s.medicationCatalog.push(testMed);s.medicationPackages.push({id:'MED-FUTURE',name:'Future Medicine',strength:'1 mg',form:'tablet',orderKeys:['future medicine|po']});
 scan('future-patient',testMed);fillAndSave(testMed);assert.equal(s.mar.at(-1).patientId,'future-patient');
 const input={patientId:'future-patient',medicationId:testMed.id,method:'barcode',patientBarcode:s.patients.find(p=>p.id==='future-patient').barcode,medicationBarcode:'*MED-FUTURE*\r\n',confirmed:true,dose:'5 mg',route:'PO',student:'TEST',time:'2026-09-25T09:00',repeatConfirmed:true};
 testMed.status='Held';assert(!save(input).ok);testMed.status='Completed in ER';assert(!save(input).ok);testMed.status='Active';testMed.releaseStatus='pending';assert(!save(input).ok);testMed.releaseStatus='released';
 assert(!save({...input,confirmed:false}).ok);assert(!save({...input,student:''}).ok);assert(!save({...input,route:'IV'}).ok);assert(!save({...input,repeatConfirmed:false}).ok);
 testMed.highAlert=true;assert(!save(input).ok);assert(!save({...input,verifiedBy:'TEST'}).ok);testMed.highAlert=false;
 const result=save({...input,submissionId:'unique-submit'});assert(result.ok);assert(!save({...input,submissionId:'unique-submit'}).ok);assert(!save({...input,time:'2026-09-25T09:01',submissionId:'unique-submit'}).ok);
 testMed.frequency='Once';assert(!save({...input,time:'2026-09-25T10:00'}).ok);testMed.frequency='PRN';
 a.setPatient('carl-shapiro');assert(!save({...input,time:'2026-09-25T10:00'}).ok);
 // Barcode scanner Enter suffix, legacy code, and invalidation after verification.
 render('future-patient');el('marScanPatient').value=s.patients.find(p=>p.id==='future-patient').barcode;el('marScanMedication').value='*'+testMed.barcode+'*\r\n';el('marScanMedication').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert(el('marConfirmSave'));el('marScanMedication').value='wrong';el('marScanMedication').dispatchEvent(new w.Event('input'));assert(!el('marConfirmSave'));
 const persisted=JSON.parse(w.localStorage.getItem('atuSimulationHospitalEHRv1'));assert(persisted.mar.some(r=>r.submissionId==='unique-submit'));
 const reopened=start(persisted);reopened.testApp.setPatient('future-patient');reopened.renderMAR();assert(reopened.document.querySelector('#view').textContent.includes('Automated simulation test'));assert(reopened.testApp.state.mar.some(r=>r.submissionId==='unique-submit'));
 // A browser storage failure cannot leave a false successful administration in memory.
 render('future-patient');const original=w.Storage.prototype.setItem;w.Storage.prototype.setItem=()=>{throw Error('quota');};const n=s.mar.length;assert(!save({...input,time:'2026-09-26T09:00'}).ok);assert.equal(s.mar.length,n);w.Storage.prototype.setItem=original;
 console.log('PASS all-patient MAR:',JSON.stringify(coverage),'manual saves:',manuals,'scanned saves:',scans,'plus ambiguity, lifecycle, mismatches, duplicates, future patient, high-alert, persistence and failed-storage checks.');
}finally{setImmediate(()=>{for(const w of windows)w.close();});}
