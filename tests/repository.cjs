const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function syntax(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,f.name);if(f.isDirectory()&&f.name==='vendor')syntax(file);else if(f.isFile()&&f.name.endsWith('.js'))new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});}}syntax(root);
for(const [,script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script);
const written=[];vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1],{document:{write:s=>written.push(s)}});
for(const tag of written){const url=tag.match(/src="([^"]+)"/)[1];assert(fs.existsSync(path.join(root,url.split('?')[0])),'Missing '+url);}
assert(written.length>=20);assert.equal(new Set(written.map(tag=>tag.match(/\?v=([^"<]+)/)[1])).size,1);

for(const f of fs.readdirSync(root).filter(f=>/\.(js|html)$/.test(f)))assert(!/dfbctsvvkqendktkzejr|sb_publishable_xhff/.test(fs.readFileSync(path.join(root,f),'utf8')),'Original cloud connection in '+f);
function config(p){const c={window:{},location:{pathname:p}};vm.runInNewContext(fs.readFileSync(path.join(root,'app-config.js'),'utf8'),c);return c.window.ATU_CONFIG;}
assert.equal(config('/one/').supabaseUrl,'https://ixjcltjdxwpewwopxbtl.supabase.co');assert(config('/one/').supabasePublishableKey.startsWith('sb_publishable_'));assert.equal(config('/one/').reportRuntimeErrors,false);
assert.notEqual(config('/one/').storageKey,config('/two/').storageKey);assert.equal(config('/one/').storageKey,config('/one/index.html').storageKey);
const ctx={window:{}};for(const f of ['chart-data.js','baseline-data.js','simulation-defaults.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
for(const pid of ['carl-shapiro','ruth-livingston']){
 const b=ctx.window.SIMULATION_DEFAULTS[pid];assert(b.patient.mrn.startsWith('PCS'));
 for(const r of b.chartRecords.filter(r=>r.status==='pending'))assert(b.releaseQueue.some(q=>q.chartRecordId===r.id&&q.status==='pending'),'Missing baseline release '+r.id);
}
const w=require('./boot.cjs')();try{
 w.renderPatients();w.document.querySelector('[data-level="3"]').click();
 for(const name of ['Carl Shapiro','Ruth Livingston','Karl Sharp','Vernon Watkins','Vincent Brody','David Carter'])assert(w.document.querySelector('#view').textContent.includes(name),'Missing Level 3 patient '+name);
 const externalDraft=JSON.stringify({'carl-shapiro::notes':{text:'Another repository draft'}});
 w.localStorage.setItem('another-site_student_drafts_v1',externalDraft);
 w.testApp.setPatient('carl-shapiro');w.resetToBase('carl-shapiro');
 assert.equal(w.localStorage.getItem('another-site_student_drafts_v1'),externalDraft,'Reset must not clear another repository drafts');
}finally{w.close();}
console.log('PASS repository: JavaScript syntax, script paths, independent configuration, storage separation, patient list and profile defaults.');

