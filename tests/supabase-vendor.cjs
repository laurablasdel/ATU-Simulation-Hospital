const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),boot=require('./boot.cjs');
(async()=>{const w=boot();try{
 w.Headers=Headers;w.Request=Request;w.Response=Response;
 w.eval(fs.readFileSync(path.join(__dirname,'../vendor/supabase.min.js'),'utf8'));
 const calls=[],raw=w.supabase.createClient('https://example.supabase.co','test-publishable-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,options)=>{calls.push({url:String(url),body:JSON.parse(options.body)});return new Response(JSON.stringify({revision:0,updated_by:'test',records:[]}),{status:200,headers:{'Content-Type':'application/json'}});}}});
 const session=await raw.auth.getSession();assert.equal(session.data.session,null);assert.equal(calls.length,0);
 const adapter=w.createRecordSyncClient(raw,'simulation-state'),result=await adapter.from('ehr_sync').select('payload,revision').maybeSingle();
 assert.equal(result.error,null);assert.equal(result.data.revision,0);assert(calls[0].url.endsWith('/rest/v1/rpc/read_simulation_changes'));assert.equal(calls[0].body.p_session,'simulation-state');
 assert.equal(typeof raw.channel('test').on,'function');await raw.removeAllChannels();
 console.log('PASS pinned Supabase bundle: session API, existing record adapter, mocked RPC transport and realtime API shape.');
}finally{w.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
