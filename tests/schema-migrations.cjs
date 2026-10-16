const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const names=['updateSmithTylenolDose','migratePacketCharts','migrateCarlProfile','migrateRuthOrthoStart','migrateRuthNorepinephrine','migrateRuthProfile','migrateLevel3Charts','seedOriginalMAR','normalizeJaneMAR','migrateMollyAdmission','applySungScenario','migrateVernonProfile','applyOctoberPatientContent','applyLevel3October','applyPriorNurseHistory','repairLevel3ImportedContent','simplifyAmeliaOrders'];
for(const legacy of [{},{carlProfileImportV1:true,ruthNorepinephrineV1:true,vernonProfileV1:true},{medicationOrdersRebuiltV6:true,janeMarNormalizedV7:true}]){
 const calls=[],ctx={state:{...legacy,notes:[{id:'keep'}],simulationReports:[{id:'remove'}]},hydrateStateBaselines:x=>x};ctx.window=ctx;
 for(const name of names)ctx[name]=()=>calls.push(name);
 vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../state-migrations.js'),'utf8'),ctx);
 ctx.runStateMigrations();assert.equal(ctx.state.schemaVersion,ctx.STATE_SCHEMA_VERSION);assert(!('simulationReports' in ctx.state));assert.equal(ctx.state.notes[0].id,'keep');
 assert(calls.includes('migratePacketCharts'),'a later legacy flag must not skip an earlier missing migration');
 if(legacy.carlProfileImportV1)assert(!calls.includes('migrateCarlProfile'));
 if(legacy.medicationOrdersRebuiltV6)assert(!calls.includes('seedOriginalMAR'));
 for(const key of Object.keys(legacy))assert(!(key in ctx.state));
 const count=calls.length;ctx.runStateMigrations();assert.equal(calls.length,count,'upgrades run once');
 ctx.state.audit=[{id:'stale-tab'}];ctx.runStateMigrations();assert(!('audit' in ctx.state),'cleanup applies even at current schema');
}
console.log('PASS ordered schema migrations: partial legacy flags, missing earlier upgrades, no reruns and stale-tab cleanup.');
