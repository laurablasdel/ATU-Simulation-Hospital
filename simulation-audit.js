/* Shared chart access, documentation audit, and retained per-simulation reports. */
(function(){
 const clone=x=>JSON.parse(JSON.stringify(x));
 const collections=['orders','assessments','vitals','io','notes','labs','labPanels','mar','medicationCatalog','glucoseChecks','laborProgress','postpartumRecovery','pphPads','pphMedications','bloodAdministration','surgicalChecklist','surgicalAssessments','chartEntries','pewsAssessments','messages','providerNotifications','diagnosticFiles','releaseQueue'];
 const labels={chartDocuments:'Chart documents',medicationCatalog:'Medication orders',orders:'Orders',assessments:'Assessments',vitals:'Vital signs',io:'Intake and output',notes:'Notes and education',labs:'Lab results',labPanels:'Lab panels',mar:'Medication administrations',chartEntries:'Chart forms',messages:'Messages',providerNotifications:'SBAR / provider communication',diagnosticFiles:'Diagnostic attachments',releaseQueue:'Faculty releases',simulationActivity:'Access and documentation timeline',audit:'Existing chart audit'};
 const sessionFor=pid=>pid+':'+(state.patientResetEpochs?.[pid]||'initial');
 let known=new Map();
 window.formatChartTimestamp=function(value){
  const text=String(value??''),match=text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/);
  if(!match)return text;
  if(!match[6])return `${match[4]}:${match[5]}_${match[2]}/${match[3]}/${match[1]}`;
  const date=new Date(text);if(!Number.isFinite(date.getTime()))return text;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  return `${parts.hour}:${parts.minute}_${parts.month}/${parts.day}/${parts.year}`;
 };
 function actor(pid){return getTabMode()==='student'?(window.studentSession?.()?.name||'Student (name not recorded)'):getTabMode()==='observer'?'Observer':'Faculty';}
 function addActivity(pid,type,details,extra={}){
  if(!pid)return;
  state.simulationActivity||=[];
  state.simulationActivity.push({id:uid('activity'),patientId:pid,simulationId:sessionFor(pid),at:new Date().toISOString(),actor:actor(pid),role:getTabMode(),group:getTabMode()==='student'?(window.studentSession?.()?.group||''):'',area:getTabMode()==='student'?(window.studentSession?.()?.area||''):'',type,details,...extra});
 }
 window.recordChartAccess=function(pid,section,type='Section opened'){addActivity(pid,type,section);save();};
 function rowsSnapshot(){const map=new Map();for(const key of collections)for(const row of state[key]||[])if(row?.id&&row.patientId)map.set(key+':'+row.id,{key,row:clone(row)});for(const row of CHART_RECORDS)map.set('chartDocuments:'+row.id,{key:'chartDocuments',row:clone({...row,...state.chartContentEdits?.[row.id]})});return map;}
 function captureChanges(){
  const next=rowsSnapshot();
  for(const [id,{key,row}] of next){const previous=known.get(id)?.row;if(JSON.stringify(previous)===JSON.stringify(row))continue;
   addActivity(row.patientId,previous?'Documentation updated':'Documentation saved',labels[key]||key,{collection:key,recordId:row.id,record:row});
  }
  for(const [id,{key,row}] of known)if(!next.has(id))addActivity(row.patientId,'Documentation removed',labels[key]||key,{collection:key,recordId:row.id,record:row});
  known=next;
 }
 window.buildSimulationReport=function(pid,endedAt=''){
  const simulationId=sessionFor(pid),patient=state.patients.find(p=>p.id===pid);
  const data={};for(const key of [...collections,'audit'])data[key]=clone((state[key]||[]).filter(r=>r.patientId===pid));
  data.simulationActivity=clone((state.simulationActivity||[]).filter(r=>r.patientId===pid&&r.simulationId===simulationId));
  return {id:'report:'+simulationId,patientId:pid,simulationId,patient:clone(patient),generatedAt:new Date().toISOString(),endedAt,collections:data,chartRecords:clone(CHART_RECORDS.filter(r=>r.patientId===pid&&chartRecordReleased(r)))};
 };
 window.archiveSimulationReport=function(pid){
  captureChanges();state.simulationReports||=[];const report=window.buildSimulationReport(pid,new Date().toISOString());
  if(!state.simulationReports.some(r=>r.id===report.id))state.simulationReports.push(report);
  save(); // A storage failure aborts reset before any chart entries are cleared.
 };
 function reportContent(value){
  const node=document.createElement('template');node.innerHTML=String(value);
  const allowed=new Set(['TABLE','THEAD','TBODY','TR','TH','TD','P','BR','DIV','SPAN','STRONG','B','EM','I','UL','OL','LI','H2','H3','H4','DL','DT','DD']);
  const walk=n=>{if(n.nodeType===3)return esc(n.nodeValue);if(n.nodeType!==1)return '';if(['SCRIPT','STYLE','IFRAME','OBJECT'].includes(n.tagName))return '';const children=[...n.childNodes].map(walk).join('');return allowed.has(n.tagName)?`<${n.tagName.toLowerCase()}>${children}</${n.tagName.toLowerCase()}>`:children;};
  return [...node.content.childNodes].map(walk).join('');
 }
 function valueHTML(value,key=''){
  if(value==null)return '—';
  if(typeof value==='object')return '<dl>'+Object.entries(value).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${valueHTML(v,k)}</dd>`).join('')+'</dl>';
  if(/^data:/.test(String(value)))return '[Attachment stored in hospital chart]';
  if(/snapshot|content/.test(key)&&/<[a-z]/i.test(String(value)))return reportContent(value);
  return esc(formatChartTimestamp(String(value)));
 }
 window.simulationReportHTML=function(report){
  const data=report.collections,events=data.simulationActivity||[],people=[...new Set(events.map(e=>e.actor).filter(Boolean))];
  const timeline=events.slice().sort((a,b)=>a.at.localeCompare(b.at)).map(e=>`<tr><td>${esc(formatChartTimestamp(e.at))}</td><td>${esc(e.actor)}${e.group?'<br>Group: '+esc(e.group):''}${e.area?'<br>Area: '+esc(e.area):''}</td><td>${esc(e.type)}</td><td>${esc(e.details)}</td></tr>`).join('');
  const sections=Object.entries(data).filter(([key,rows])=>key!=='simulationActivity'&&rows.length).map(([key,rows])=>`<section><h2>${esc(labels[key]||key)} (${rows.length})</h2>${rows.map((row,i)=>`<article><h3>Record ${i+1}</h3>${valueHTML(row)}</article>`).join('')}</section>`).join('');
  const versions=events.filter(e=>e.record).map(e=>`<article><h3>${esc(formatChartTimestamp(e.at))} — ${esc(e.actor)} — ${esc(e.type)} — ${esc(e.details)}</h3>${valueHTML(e.record)}</article>`).join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simulation chart audit — '+esc(report.patient.name)+'</title><style>body{font:15px/1.5 system-ui,sans-serif;color:#172a38;max-width:1100px;margin:30px auto;padding:0 20px}h1,h2{color:#154c42}table{width:100%;border-collapse:collapse}td,th{border:1px solid #bdc9cb;padding:8px;text-align:left;vertical-align:top}article{border:1px solid #c9d6d6;padding:12px;margin:14px 0;overflow-wrap:anywhere}dl{display:grid;grid-template-columns:minmax(140px,25%) 1fr;gap:4px 12px}dt{font-weight:600}dd{margin:0;white-space:pre-wrap;min-width:0}dd dl{display:block}button{padding:10px}@media print{button{display:none}body{margin:0;font-size:10pt}h2,h3{break-after:avoid}tr{break-inside:avoid}}@page{size:letter;margin:.5in}</style></head><body>'+`<button onclick="window.print()">Print / Save as PDF</button><h1>Simulation chart audit</h1><p><b>${esc(report.patient.name)}</b> — MRN ${esc(report.patient.mrn)}</p><p>Simulation: ${esc(report.simulationId)}<br>Generated: ${esc(formatChartTimestamp(report.generatedAt))}<br>${report.endedAt?'Ended: '+esc(formatChartTimestamp(report.endedAt)):'Current simulation'}<br>Times: Central (24-hour clock)</p><p>Chart users recorded: ${esc(people.join(', ')||'No named accesses recorded')}</p><p>Access tracking begins with this update. Earlier section visits cannot be reconstructed. Current chart records include starting clinical information as well as saved simulation documentation; the timeline identifies actions recorded during this simulation. Unsaved drafts are not completed chart entries.</p><h2>Access and documentation timeline</h2><table><thead><tr><th>Time_Date</th><th>Who</th><th>Action</th><th>Section / details</th></tr></thead><tbody>${timeline||'<tr><td colspan="4">No tracked activity.</td></tr>'}</tbody></table>${sections}<h2>Documentation versions recorded during simulation</h2>${versions||'<p>No recorded changes.</p>'}<h2>Released chart documents</h2>${report.chartRecords.map(r=>`<article><h3>${esc(r.title)}</h3>${valueHTML(r.content,'content')}</article>`).join('')}</body></html>`;
 };
 let reportURL='';
 window.downloadSimulationReport=function(report){const blob=new Blob([simulationReportHTML(report)],{type:'text/html;charset=utf-8'});if(reportURL)URL.revokeObjectURL(reportURL);reportURL=URL.createObjectURL(blob);const a=document.createElement('a');a.href=reportURL;a.download=`${report.patientId}-simulation-${report.simulationId.split(':').at(-1)}-audit.html`;a.textContent='Download report file';const ready=document.getElementById('auditDownloadReady');if(ready){ready.replaceChildren(document.createTextNode('Report ready. If your download did not start, use this link: '),a);}else document.body.append(a);a.click();if(!ready)a.remove();};
 function debriefControls(){
  const root=document.getElementById('view');if(currentView!=='debrief'||!isFaculty()||root.querySelector('#auditDownloads'))return;
  root.insertAdjacentHTML('beforeend',panel('Download Simulation Audit','<div id="auditDownloads"><p>Download the current patient’s report, or a completed report retained when the patient was reset. Open the downloaded file to print or save as PDF.</p><div class="actions"><button id="previewCurrentAudit">Preview Current Report</button><button id="downloadCurrentAudit">Download Current Simulation</button></div><p id="auditDownloadReady" role="status"></p><div id="previousAudits"></div><div id="auditPreview" role="region" aria-label="Report preview"><p>Choose Preview Current Report to review the full audit.</p></div></div>'));
  const selected=()=>document.getElementById('dPatient')?.value||activePatientId;
  document.getElementById('downloadCurrentAudit').onclick=()=>downloadSimulationReport(buildSimulationReport(selected()));
  document.getElementById('previewCurrentAudit').onclick=()=>{const frame=document.createElement('iframe');frame.title='Simulation audit report';frame.setAttribute('sandbox','allow-scripts allow-modals');frame.style='width:100%;height:700px;border:1px solid #bdc9cb';frame.srcdoc=simulationReportHTML(buildSimulationReport(selected()));const host=document.getElementById('auditPreview');if(host)host.replaceChildren(frame);else document.getElementById('auditDownloads').append(frame);};
  const list=()=>{const reports=(state.simulationReports||[]).filter(r=>r.patientId===selected()).slice().sort((a,b)=>b.endedAt.localeCompare(a.endedAt));const host=document.getElementById('previousAudits');host.innerHTML='<h3>Previous simulations</h3>'+reports.map(r=>`<p><button data-report="${esc(r.id)}">Download — ${esc(formatChartTimestamp(r.endedAt))}</button></p>`).join('')+(reports.length?'':'<p>No archived simulations yet.</p>');host.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>downloadSimulationReport(reports.find(r=>r.id===b.dataset.report)));};
  document.getElementById('dPatient')?.addEventListener('change',list);list();
 }
 window.initializeSimulationAudit=function(){
  known=rowsSnapshot();
  const oldSave=save;save=function(){captureChanges();const result=oldSave();known=rowsSnapshot();return result;};
  const oldReload=reloadSharedState;reloadSharedState=function(){const result=oldReload();known=rowsSnapshot();return result;};
  // Shared incoming rows are not new actions by the person at this computer.
  window.auditSharedStateReceived=()=>{known=rowsSnapshot();};
  const oldDebrief=renderDebrief;renderDebrief=function(){oldDebrief();debriefControls();};
  document.querySelectorAll('aside button[data-view]').forEach(button=>{const original=button.onclick;button.onclick=function(e){const before=currentView;original.call(this,e);if(activePatientId&&currentView===button.dataset.view&&currentView!=='patients'&&before!==currentView)recordChartAccess(activePatientId,button.textContent.trim());};});
  document.addEventListener('click',e=>{const summary=e.target.closest('#view details.chartRecord > summary');if(summary&&!summary.parentElement.open&&activePatientId)recordChartAccess(activePatientId,summary.textContent||'Chart document','Document opened');},true);
  document.addEventListener('click',e=>{const link=e.target.closest('#view a[href]');if(link&&activePatientId)recordChartAccess(activePatientId,link.textContent||link.querySelector('img')?.alt||'Attachment','Attachment opened');},true);
  // Format rendered timestamps only. Inputs and the stored ISO values remain editable.
  const formatHistory=()=>{
   const root=window.document?.getElementById('view');if(!root)return;
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
   while(node=walker.nextNode()){
    if(node.parentElement?.closest('input,textarea,select,script,style,[contenteditable=true]'))continue;
    const formatted=node.nodeValue.replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?\b/g,formatChartTimestamp);
    if(formatted!==node.nodeValue)node.nodeValue=formatted;
   }
   for(const history of root.querySelectorAll('.nativeHistory')){const form=history.parentElement.querySelector(':scope > form');if(form&&history.previousElementSibling!==null)form.before(history);}
  };
  new MutationObserver(formatHistory).observe(document.getElementById('view'),{childList:true,subtree:true});formatHistory();
 };
})();
