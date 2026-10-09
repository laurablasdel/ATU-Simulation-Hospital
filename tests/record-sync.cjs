const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite'),boot=require('./boot.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 const db=new PGlite(),windows=[],calls=[],callbacks=[],tick=()=>new Promise(r=>setImmediate(r));let reportReads=0;
 try{
  const seed=boot();windows.push(seed);const payload=clone(seed.testApp.state);payload.simulationReports=[clone(seed.buildSimulationReport('charles-jones','2026-09-29T12:00:00Z'))];
  await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
   create table public.simulation_members(user_id uuid,session_id text);grant select on public.simulation_members to authenticated;
   insert into public.simulation_members values('00000000-0000-0000-0000-000000000001','simulation-state');
   create table public.ehr_sync(collection text,item_id text,payload jsonb,revision bigint,updated_by text);grant select,update on public.ehr_sync to authenticated;`);
  await db.query('insert into public.ehr_sync values($1,$2,$3,7,$4)',['app','simulation-state',JSON.stringify(payload),'seed']);
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase-record-sync.sql'),'utf8'));
  assert.deepEqual((await db.query('select payload from public.ehr_sync')).rows[0].payload,payload,'original recovery copy untouched');
  await db.exec(`set role authenticated;set app.user_id='00000000-0000-0000-0000-000000000001';`);
  await assert.rejects(db.query('select payload from public.ehr_sync'),/permission denied/,'old downloads blocked');
  const raw=()=>({
   auth:{getSession:async()=>({data:{session:{user:{id:'approved'}}}})},
   from:table=>({select(){return this;},eq(){return this;},async maybeSingle(){assert.equal(table,'ehr_sync_heads');return {data:(await db.query('select revision,updated_by from public.ehr_sync_heads where item_id=$1',['simulation-state'])).rows[0]};}}),
   async rpc(name,args){
    const signatures={read_simulation_changes:['p_session','p_since'],save_simulation_changes:['p_session','p_revision','p_changes','p_reports','p_client'],get_simulation_report:['p_session','p_id']};
    assert(signatures[name]);if(name==='get_simulation_report')reportReads++;
    const values=signatures[name].map(k=>typeof args[k]==='object'?JSON.stringify(args[k]):args[k]);
    try{const data=(await db.query(`select public.${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) as data`,values)).rows[0].data;calls.push({name,args:clone(args),bytes:JSON.stringify(data).length});return {data};}catch(error){return {error};}
   },
   channel:()=>({on(type,filter,callback){assert.equal(filter.table,'ehr_sync_heads');callbacks.push(callback);return this;},subscribe(){return this;}})
  });
  for(let i=0;i<4;i++){const w=boot(undefined,{recordSync:true,supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'test'});windows.push(w);w.supabase={createClient:raw};await w.atuCloudInit();await w.atuCloudPush();assert(w.testApp.state.simulationReports[0].archived);assert(!w.testApp.state.simulationReports[0].collections);}
  assert.equal(reportReads,0,'archives are not loaded on connection');
  const four=windows.slice(1);for(let i=0;i<4;i++)four[i].testApp.state.vitals.push({id:'concurrent-'+i,patientId:['charles-jones','ruth-livingston','vernon-watkins','carl-shapiro'][i],hr:String(80+i)});
  const begin=calls.length;await Promise.all(four.map(w=>w.atuCloudPush()));for(let pass=0;pass<2;pass++)for(const w of four)await w.atuCloudPush();
  for(const w of four)for(let i=0;i<4;i++)assert(w.testApp.state.vitals.some(r=>r.id==='concurrent-'+i));
  const writes=calls.slice(begin).filter(c=>c.name==='save_simulation_changes');assert(writes.length>=4);assert(writes.every(c=>c.args.p_changes.every(r=>!['patients','simulationBases','simulationReports'].includes(r.collection))),'routine vitals do not retransmit patient profiles, baseline charts, or archived reports');
  const deltas=calls.slice(begin).filter(c=>c.name==='read_simulation_changes');assert(deltas.every(c=>c.args.p_since>=0),'updates use deltas');
  const idle=calls.length;for(const w of four)await w.atuCloudPush();assert.equal(calls.length,idle,'idle clients do not request payloads or write');
  const head=(await db.query('select revision from public.ehr_sync_heads')).rows[0];for(const notify of callbacks){notify({new:head});notify({new:head});}await tick();assert.equal(calls.length,idle,'duplicate realtime notices do not download charts');
  const noOp=(await db.query("select public.save_simulation_changes('simulation-state',$1,'[]','[]','noop') as data",[head.revision])).rows[0].data;assert.equal(noOp.revision,head.revision,'empty save does not generate another realtime revision');
  const archived=await four[0].loadSimulationReport(four[0].testApp.state.simulationReports[0]);assert.deepEqual(archived,payload.simulationReports[0]);assert.equal(reportReads,1);await four[0].loadSimulationReport(four[0].testApp.state.simulationReports[0]);assert.equal(reportReads,1,'report cached only after requested');
  four[0].resetToBase('vernon-watkins');await four[0].atuCloudPush();await four[1].atuCloudPush();assert(four[1].testApp.state.simulationReports.some(r=>r.patientId==='vernon-watkins'&&r.archived&&!r.collections));assert(!four[1].testApp.state.vitals.some(r=>r.id==='concurrent-2'));
  const pid='charles-jones',faculty=four[0];faculty.setTabMode('faculty');faculty.testApp.state.medicationOverrides.push({id:'sql-override',patientId:pid,status:'Pending',barcode:'MED-HEP10K',resetEpoch:0});await faculty.atuCloudPush();
  const decision=await faculty.commitMedicationOverrideAction('decision','sql-override',{status:'Denied',provider:'Test Provider',decisionNotes:'SQL regression'});assert(decision.ok,decision.error);assert(!(await faculty.commitMedicationOverrideAction('decision','sql-override',{status:'Approved',provider:'Test Provider',medication:'Heparin',dose:'1 unit',route:'IV'})).ok,'handled request cannot be approved later');await four[1].atuCloudPush();assert(four[1].testApp.state.notifications.some(r=>r.id==='override-decision:sql-override'));
  const students=four.slice(1,3);for(const w of students){w.setTabMode('student');w.testApp.setPatient(pid);await w.atuCloudPush();}
  const med=students[0].medicationsForPatient(pid,false).find(m=>m.dose&&m.route&&!m.highAlert&&!students[0].medicationAdministrationBlock(m));
  const patient=students[0].testApp.state.patients.find(p=>p.id===pid),barcode=students[0].packagesForMedication(med)[0].id;
  const confirmations=await Promise.all(students.map((w,i)=>w.saveMedicationAdministration({patientId:pid,medicationId:med.id,method:'barcode',patientBarcode:patient.barcode,medicationBarcode:barcode,confirmed:true,dose:med.dose,route:med.route,time:w.nowLocal(),student:'SQL '+i,submissionId:'sql-mar-'+i,resetEpoch:w.testApp.state.patientResetEpochs?.[pid]||0})));
  assert.equal(confirmations.filter(r=>r.ok).length,1,JSON.stringify(confirmations));
  const saved=(await db.query("select value from public.ehr_sync_records where collection='mar' and record_id<>'$' and not deleted")).rows.filter(r=>r.value.submissionId?.startsWith('sql-mar-'));
  assert.equal(saved.length,1,'one durable MAR record after concurrent confirmations');
  await new Promise(r=>setTimeout(r,500));windows.forEach(w=>w.close());windows.length=0;
  await db.exec("set app.user_id='00000000-0000-0000-0000-000000000002'");assert.equal((await db.query("select public.read_simulation_changes('simulation-state',-1) as data")).rows[0].data,null);await assert.rejects(db.query("select public.save_simulation_changes('simulation-state',0,'[]','[]','unauthorized')"),/not approved/);
  console.log('PASS PostgreSQL record sync: lossless migration, restricted access, original recovery copy, four concurrent clients, delta-only updates, idle no-op, lazy report hydration/cache, reset archive retention and atomic provider denial.');
  console.log(JSON.stringify({wholeStateBytes:JSON.stringify(payload).length,largestRoutineDeltaBytes:Math.max(...deltas.map(c=>c.bytes)),routineChanges:writes.map(c=>c.args.p_changes.length)}));
 }finally{await tick();windows.forEach(w=>w.close());await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
