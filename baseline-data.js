/* Store canonical document references in baselines, retaining faculty overrides. */
(function(){
 const copy=x=>JSON.parse(JSON.stringify(x));
 const canonical=new Map((window.CHART_RECORDS||[]).map(r=>[r.id,copy(r)]));
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 window.compactSimulationBase=function(base){
  if(!base||base.baselineFormat===1)return base;
  const out={...base,baselineFormat:1};
  out.chartRecords=(base.chartRecords||[]).map(row=>{
   const source=canonical.get(row.id);if(!source)return row;
   return Object.fromEntries(Object.entries(row).filter(([key,value])=>key==='id'||key==='status'||!same(value,source[key])));
  });
  out.releaseQueue=(base.releaseQueue||[]).map(row=>{
   const source=canonical.get(row.chartRecordId);if(!source)return row;
   return Object.fromEntries(Object.entries(row).filter(([key,value])=>!['title','content','patientId'].includes(key)||!same(value,source[key])));
  });return out;
 };
 window.hydrateSimulationBase=function(base){
  if(!base||base.baselineFormat!==1)return base;
  const {baselineFormat,...out}=base;
  out.chartRecords=(base.chartRecords||[]).map(row=>({...copy(canonical.get(row.id)||{}),...row}));
  out.releaseQueue=(base.releaseQueue||[]).map(row=>{
   const source=canonical.get(row.chartRecordId)||{},out={...row};
   for(const key of ['title','content','patientId'])if(!(key in out)&&key in source)out[key]=source[key];return out;
  });return out;
 };
 window.hydrateSimulationDefaults=defaults=>Object.fromEntries(Object.entries(defaults).map(([id,base])=>[id,window.hydrateSimulationBase(base)]));
 window.compactStateBaselines=state=>state?.simulationBases?{...state,simulationBases:Object.fromEntries(Object.entries(state.simulationBases).map(([id,b])=>[id,window.compactSimulationBase(b)]))}:state;
 window.hydrateStateBaselines=state=>state?.simulationBases&&Object.values(state.simulationBases).some(b=>b?.baselineFormat===1)?{...state,simulationBases:window.hydrateSimulationDefaults(state.simulationBases)}:state;
})();
