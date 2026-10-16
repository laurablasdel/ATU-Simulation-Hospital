/* Retired-data cleanup applies to local saves, imports and every shared receive. */
(function(){
 const retired=new Set(['simulationActivity','audit','simulationReports','simulationResetArchives','providerNotifications','vernonLegacyEntriesV1']);
 window.isRetiredCollection=key=>retired.has(key);
 window.cleanRetiredState=function(value){
  if(!value||typeof value!=='object')return value;
  let changed=false;
  // Old provider responses use message IDs in releaseItemId; keep actual faculty releases.
  if(!Array.isArray(value)){
   const removedIds=new Set((value.messages||[]).filter(row=>row.sbarId||row.type==='sbar').map(row=>row.id));
   for(const key of ['messages','notifications'])if(Array.isArray(value[key])){
    const rows=value[key].filter(row=>!row.sbarId&&row.type!=='sbar'&&!String(row.id||'').startsWith('sbar-notice:')&&!removedIds.has(row.releaseItemId));
    if(rows.length!==value[key].length){value={...value,[key]:rows};changed=true;}
   }
  }
  if(Array.isArray(value)){const out=value.map(row=>{const clean=cleanRetiredState(row);if(clean!==row)changed=true;return clean;});return changed?out:value;}
  const out={};for(const [key,row] of Object.entries(value)){if(retired.has(key)){changed=true;continue;}const clean=cleanRetiredState(row);if(clean!==row)changed=true;Object.defineProperty(out,key,{value:clean,enumerable:true,writable:true,configurable:true});}
  return changed?out:value;
 };
})();

/* Ordered schema upgrades. Legacy flags are read only to recover partial upgrades. */
(function(){
 const steps=[["smithTylenol650V1","updateSmithTylenolDose"],["packetCharts20260917","migratePacketCharts"],["carlProfileImportV1","migrateCarlProfile"],["ruthOrthoStartV1","migrateRuthOrthoStart"],["ruthNorepinephrineV1","migrateRuthNorepinephrine"],["ruthProfileImportV1","migrateRuthProfile"],["level3ChartCleanupV1","migrateLevel3Charts"],["medicationOrdersRebuiltV6","seedOriginalMAR"],["janeMarNormalizedV7","normalizeJaneMAR"],["mollyAdmissionReleasedV1","migrateMollyAdmission"],["sungScenario20261015","applySungScenario"],["vernonProfileV1","migrateVernonProfile"]];
 const progress=new WeakMap();
 function done(){
  let result=progress.get(state);if(!result){result=new Set();for(let i=0;i<steps.length;i++)if((Number(state.schemaVersion)||0)>i||state[steps[i][0]]===true)result.add(i);progress.set(state,result);}return result;
 }
 window.stateMigrationApplied=key=>done().has(steps.findIndex(s=>s[0]===key));
 window.markStateMigration=function(key){
  const index=steps.findIndex(s=>s[0]===key);if(index<0)throw Error('Unknown state migration '+key);
  const completed=done();completed.add(index);let version=0;while(completed.has(version))version++;
  state.schemaVersion=Math.max(Number(state.schemaVersion)||0,version);
 };
 window.runStateMigrations=function(){
  for(const [key,fn] of steps)if(!window.stateMigrationApplied(key)){if(typeof window[fn]!=='function')throw Error('Missing migration '+fn);window[fn]();window.markStateMigration(key);}
  if((Number(state.schemaVersion)||0)<14)window.applyOctoberPatientContent();
  if((Number(state.schemaVersion)||0)<15)window.applyLevel3October();
  if((Number(state.schemaVersion)||0)<16)window.applyPriorNurseHistory();
  // Always clean receives too, including stale tabs claiming a current schema.
  state=window.hydrateStateBaselines(window.cleanRetiredState(state));
  for(const [key] of steps)delete state[key];
  state.schemaVersion=Math.max(Number(state.schemaVersion)||0,steps.length+4);
 };
 window.STATE_SCHEMA_VERSION=steps.length+4;
})();
