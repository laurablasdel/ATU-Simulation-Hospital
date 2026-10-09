const assert=require('node:assert/strict'),boot=require('./boot.cjs'),clone=x=>JSON.parse(JSON.stringify(x));
const windows=[];let shared={payload:{},revision:0,updated_by:''};
function client(){return {auth:{getSession:async()=>({data:{session:{user:{id:'test-user'}}}})},from:()=>({select(){return this},eq(){return this},async maybeSingle(){return {data:clone(shared)}}}),rpc:async(n,a)=>{if(a.p_revision!==shared.revision)return {data:false};shared={payload:clone(a.p_payload),revision:shared.revision+1,updated_by:a.p_client};return {data:true}},channel:()=>({on(){return this},subscribe(){return this}})};}
function start(saved){const w=boot(saved,{supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'test'}, {name:'Barcode Student',group:'Group A',area:'Medical Surgical'});w.supabase={createClient:client};windows.push(w);return w;}
(async()=>{try{
 const faculty=start(),student=start();await faculty.atuCloudInit();await student.atuCloudInit();student.setTabMode('student');
 for(const pid of ['charles-jones','jane-fowler','vernon-watkins']){
  student.testApp.setPatient(pid);student.testApp.setView('mar');student.render();const s=student.testApp.state,p=s.patients.find(p=>p.id===pid),m=student.medicationsForPatient(pid,false).find(m=>!m.highAlert&&!student.medicationAdministrationBlock(m)),pkg=student.packagesForMedication(m)[0];
  const input={patientId:pid,medicationId:m.id,method:'barcode',patientBarcode:p.barcode,medicationBarcode:pkg.id,confirmed:true,dose:m.dose||'1 test unit',route:m.route||'Test route',time:'2026-09-28T14:00',student:'BS',submissionId:'test-'+pid};
  assert(!student.saveMedicationAdministration({...input,patientBarcode:''}).ok);assert(!student.saveMedicationAdministration({...input,method:'manual',patientBarcode:''}).ok);
  const result=await student.saveMedicationAdministration(input);assert(result.ok,pid+": "+result.error);await student.atuCloudPush();await faculty.atuCloudPush();assert(faculty.testApp.state.mar.some(r=>r.submissionId===input.submissionId));
  const event=faculty.testApp.state.simulationActivity.find(r=>r.collection==='mar'&&r.record.submissionId===input.submissionId);assert(event&&event.actor==='Barcode Student'&&event.group==='Group A');
  assert(!student.saveMedicationAdministration(input).ok,'duplicate refused');
  const refreshed=start(clone(shared.payload));assert(refreshed.testApp.state.mar.some(r=>r.submissionId===input.submissionId));
 }
 faculty.resetToBase('charles-jones');await faculty.atuCloudPush();await student.atuCloudPush();assert(!student.testApp.state.mar.some(r=>r.submissionId==='test-charles-jones'));assert(student.testApp.state.simulationReports.some(r=>r.patientId==='charles-jones'&&r.collections.mar.some(m=>m.submissionId==='test-charles-jones')));
 console.log('PASS shared MAR: three levels, required patient verification, same records on faculty/student, named group audit, duplicate prevention, reload persistence, reset audit retention.');
}finally{await new Promise(r=>setImmediate(r));windows.forEach(w=>w.close());}})().catch(e=>{console.error(e);process.exitCode=1});
