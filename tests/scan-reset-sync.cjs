const assert=require('node:assert/strict'),boot=require('./boot.cjs'),clone=x=>JSON.parse(JSON.stringify(x));
const windows=[],tick=()=>new Promise(r=>setImmediate(r));
(async()=>{try{
 const w=boot(undefined,undefined,{name:'Test Student',area:'Medical Surgical'});windows.push(w);w.setTabMode('student');const a=w.testApp,s=a.state,p=s.patients.find(p=>p.id==='charles-jones');a.setPatient(p.id);a.setView('mar');w.render();
 const el=id=>w.document.getElementById(id),med=w.medicationsForPatient(p.id,false)[0],prefix='manual-'+med.id;
 el(prefix+'-student').value='KEEP';el(prefix+'-student').dispatchEvent(new w.Event('input',{bubbles:true}));
 el('marScanPatient').value=p.barcode;el('marScanMedication').value=w.packagesForMedication(med)[0].id;el('marRecognize').click();el('marConfirmStudent').value='DISCARD';el('marConfirmNotes').value='Wrong attempt';el('marConfirmNotes').dispatchEvent(new w.Event('input',{bubbles:true}));
 const count=s.mar.length;el('marClearScan').click();assert.equal(el('marScanPatient').value,'');assert.equal(el('marScanMedication').value,'');assert(el('marConfirmation').hidden);assert(!el('marConfirmSave'));assert.equal(el(prefix+'-student').value,'KEEP');assert.equal(s.mar.length,count);
 w.render();el('marScanPatient').value=p.barcode;el('marScanMedication').value=w.packagesForMedication(med)[0].id;el('marRecognize').click();assert.equal(el('marConfirmStudent').value,'');assert.equal(el('marConfirmNotes').value,'');assert.equal(el(prefix+'-student').value,'KEEP','manual draft remains');
 // All modes resume automatically; idle checks fetch only lightweight revision metadata.
 let remote={payload:{},revision:0,updated_by:''},full=0,heads=0;
 const c=boot(undefined,{supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'test'});windows.push(c);
 c.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'test'}}}})},from:()=>({select(fields){this.fields=fields;return this},eq(){return this},async maybeSingle(){if(this.fields==='revision,updated_by'){heads++;return {data:{revision:remote.revision,updated_by:remote.updated_by}};}full++;return {data:clone(remote)}}}),rpc:async(n,args)=>{if(args.p_revision!==remote.revision)return {data:false};remote={payload:clone(args.p_payload),revision:remote.revision+1,updated_by:args.p_client};return {data:true}},channel:()=>({on(){return this},subscribe(){return this}})})};
 await c.atuCloudInit();await c.atuCloudPush();const reads=full;await c.atuCloudPush();assert.equal(full,reads);assert(heads>0);
 for(const mode of ['faculty','student','observer']){c.setTabMode(mode);await c.atuCloudPush();remote.payload.notes.push({id:'resume-'+mode,patientId:p.id,narrative:'Remote '+mode});remote.revision++;c.dispatchEvent(new c.Event('focus'));for(let i=0;i<20&&!c.testApp.state.notes.some(n=>n.id==='resume-'+mode);i++)await tick();assert(c.testApp.state.notes.some(n=>n.id==='resume-'+mode),mode+' resumes shared data');}
 console.log('PASS scan reset and sync: unsaved scan/confirmation cleared, manual drafts and saved MAR retained, all modes resume on focus, unchanged charts use revision-only reads.');
}finally{await tick();windows.forEach(w=>w.close());}})().catch(e=>{console.error(e);process.exitCode=1});
