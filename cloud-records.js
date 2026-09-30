/* Thin cloud transport; the existing shared merge, reset and MAR save logic stays in charge. */
(function(){
 const copy=x=>JSON.parse(JSON.stringify(x));
 const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 const reportHeader=r=>{const {collections,chartRecords,...header}=r;return {...header,archived:true};};
 function encode(state){
  const rows=new Map(),put=(collection,record_id,value)=>rows.set(JSON.stringify([collection,record_id]),{collection,record_id,value});
  for(const [key,value] of Object.entries(state)){
   if(Array.isArray(value)&&value.every(r=>r&&typeof r.id==='string')&&new Set(value.map(r=>r.id)).size===value.length){
    put(key,'$',{kind:'array',ids:value.map(r=>r.id)});
    for(const row of value)put(key,'r:'+row.id,key==='simulationReports'?reportHeader(row):row);
   }else if(value&&typeof value==='object'&&!Array.isArray(value)){
    put(key,'$',{kind:'object',keys:Object.keys(value)});for(const [id,row] of Object.entries(value))put(key,'r:'+id,row);
   }else put(key,'$',{kind:'value',value});
  }return rows;
 }
 function decode(rows){
  const out={};for(const entry of rows.values())if(entry.record_id==='$'){
   const key=entry.collection,shape=entry.value,get=id=>rows.get(JSON.stringify([key,'r:'+id]))?.value;
   const value=shape.kind==='array'?shape.ids.map(get).filter(r=>r!==undefined):shape.kind==='object'?Object.fromEntries(shape.keys.map(k=>[k,get(k)])):shape.value;
   Object.defineProperty(out,key,{value:copy(value),enumerable:true,writable:true,configurable:true});
  }return out;
 }
 window.ATURecordCodec={encode,decode,reportHeader};
 window.createRecordSyncClient=function(raw,scope){
  let rows=new Map(),revision=-1,writer='';const archived=new Set(),reports=new Map();
  const refreshArchives=()=>{archived.clear();for(const entry of rows.values())if(entry.collection==='simulationReports'&&entry.record_id!=='$')archived.add(entry.value.id);};
  window.normalizeCloudReports=function(state){if(!state?.simulationReports)return state;return {...state,simulationReports:state.simulationReports.map(r=>archived.has(r.id)?reportHeader(r):r)};};
  window.loadSimulationReport=async function(report){
   if(report.collections)return report;if(reports.has(report.id))return reports.get(report.id);
   const {data,error}=await raw.rpc('get_simulation_report',{p_session:scope,p_id:report.id});if(error)throw error;if(!data)throw Error('This archived report could not be found.');reports.set(report.id,data);return data;
  };
  async function read(){
   const {data,error}=await raw.rpc('read_simulation_changes',{p_session:scope,p_since:revision});
   if(error)return {data:null,error};if(!data)return {data:null,error:Error('This account is not assigned to the shared hospital.')};
   for(const entry of data.records){const key=JSON.stringify([entry.collection,entry.record_id]);if(entry.deleted)rows.delete(key);else rows.set(key,entry);}
   revision=data.revision;writer=data.updated_by;refreshArchives();return {data:{payload:decode(rows),revision,updated_by:writer},error:null};
  }
  return {
   auth:raw.auth,storage:raw.storage,
   from:()=>({fields:'',select(fields){this.fields=fields;return this;},eq(){return this;},maybeSingle(){return this.fields==='revision,updated_by'?(revision<0?Promise.resolve({data:{revision:-1}}):raw.from('ehr_sync_heads').select('revision,updated_by').eq('item_id',scope).maybeSingle()):read();}}),
   async rpc(name,args){
    if(name!=='save_simulation_state')return {error:Error('Unsupported chart operation.')};
    if(args.p_revision!==revision)return {data:false,error:null};
    const next=encode(args.p_payload),changes=[];
    for(const [key,entry] of next)if(stable(rows.get(key)?.value)!==stable(entry.value))changes.push({...entry,deleted:false});
    for(const [key,entry] of rows)if(!next.has(key))changes.push({collection:entry.collection,record_id:entry.record_id,deleted:true,value:null});
    const newReports=(args.p_payload.simulationReports||[]).filter(r=>r.collections&&!archived.has(r.id));
    const {data,error}=await raw.rpc('save_simulation_changes',{p_session:scope,p_revision:revision,p_changes:changes,p_reports:newReports,p_client:args.p_client});
    if(error)return {data:null,error};if(!data?.ok)return {data:false,error:null};
    rows=next;revision=data.revision;writer=args.p_client;refreshArchives();return {data:{revision},error:null};
   },
   channel:name=>({on(type,filter,callback){this.callback=callback;return this;},subscribe(status){return raw.channel(name+'-records').on('postgres_changes',{event:'UPDATE',schema:'public',table:'ehr_sync_heads',filter:'item_id=eq.'+scope},event=>this.callback(event)).subscribe(status);}})
  };
 };
})();
