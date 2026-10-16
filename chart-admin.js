/* Faculty-controlled chart editing, staged releases, shift MARs, and blood scanning. */
(function(){
const level3RetiredAssessments=['chart-25d195d201d581188309ec0841b19586','chart-25d195d201d581788086cb6c706ac318','chart-25d195d201d581f594ffc056cb9a7d05','chart-262195d201d581a7aef3c901aeb3e21b','chart-277195d201d581008e81e9b208421d75'];
// Carl/Karl ER vital signs are read-only; students chart new vitals in the Vitals / Flowsheet form.
const level3VitalsRecords=['chart-262195d201d581c7adc3f86cdc38c563','chart-277195d201d5815286c2df3a01649aea'];
const level3VitalsStart=JSON.parse(JSON.stringify((window.CHART_RECORDS||[]).filter(r=>level3VitalsRecords.includes(r.id))));
const retiredChartIds=new Set(window.RETIRED_CHART_IDS);
function compactContent(value){
 return String(value||'').replace(/!?\[[^\]]*\]\(file:\/{2,3}[^)]+\)/gi,'').replace(/^\s*(?:Day\s*[12]|#|---|[-|]\s*)\s*$/gmi,'').replace(/<columns>[\s\S]*?<\/columns>/gi,m=>/<table|[A-Za-z0-9]{3,}/i.test(m.replace(/<\/?(?:columns?|column)[^>]*>/gi,''))?m:'')
  .replace(/<tr>(?:\s*<td[^>]*>\s*(?:<br>)?\s*<\/td>\s*)+<\/tr>/gi,'').replace(/<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>/gi,'').replace(/(?:<br\s*\/?>\s*){2,}/gi,'<br>')
  .replace(/[ \t]+$/gm,'').replace(/\n[ \t]+\n/g,'\n\n').replace(/\n{3,}/g,'\n\n').trim();
}

function facultyPlainText(value){
 const source=String(value??'');
 if(/^\s*[\[{]/.test(source)){try{const parsed=JSON.parse(source),readable=(v,label='')=>v&&typeof v==='object'?Object.entries(v).map(([k,x])=>readable(x,label?label+' / '+k:k)).join('\n'):(label?label.replace(/([A-Z])/g,' $1')+': ':'')+String(v??'');return readable(parsed);}catch{}}
 const host=document.createElement('div');host.innerHTML=renderChartDoc(source);
 host.querySelectorAll('script,style').forEach(el=>el.remove());
 host.querySelectorAll('br').forEach(el=>el.replaceWith('\n'));
 host.querySelectorAll('td,th').forEach(el=>el.append('    '));
 host.querySelectorAll('p,div,tr,li,h1,h2,h3,h4,summary').forEach(el=>el.append('\n'));
 host.querySelectorAll('img').forEach(el=>el.replaceWith(''));
 return host.textContent.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function prepareFacultyTextEditors(){
 document.querySelectorAll('#view textarea').forEach(input=>{
  const original=input.value;
  if(!/^\s*[\[{]|<[a-z][^>]*>|\*\*|!?\[[^\]]+\]\([^)]+\)|^#{1,3} /im.test(original))return;
  input._originalContent=original;input.value=facultyPlainText(original);input._plainContent=input.value;
  const links=[...original.matchAll(/!?\[[^\]]*\]\([^)]+\)/g)].map(m=>m[0]);
  input._attachmentLinks=links;
  if(links.length)input.insertAdjacentHTML('afterend','<span class="note">Attached images and links are retained when you save text changes.</span>');
 });
}
function facultyEditorValue(input){
 if(input._originalContent===undefined)return input.value;
 if(input.value===input._plainContent)return input._originalContent;
 return input.value+(input._attachmentLinks?.length?'\n\n'+input._attachmentLinks.join('\n'):'');
}
function profileDetailFields(value,path=[]){
 if(value&&typeof value==='object')return Object.entries(value).map(([key,child])=>profileDetailFields(child,[...path,key])).join('');
 const label=path.map(key=>key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())).join(' / ');
 return `<label>${esc(label)}<input data-extra-path="${esc(JSON.stringify(path))}" value="${esc(value??'')}" ${typeof value==='number'?'type="number" step="any"':''}></label>`;
}
const liveFieldLabels={time:'Date / Time',student:'Student / Initials',provider:'Provider',type:'Type',text:'Content',test:'Test',result:'Result',reference:'Reference Range',flag:'Flag',comments:'Comments',medication:'Medication',dose:'Dose',route:'Route',due:'Due Time',status:'Status',response:'Response / Notes',narrative:'Narrative',message:'Message',subject:'Subject',title:'Title',notes:'Notes'};
function editableLiveFields(row){return Object.entries(row).filter(([key,value])=>!['id','patientId','releaseItemId','chartRecordId'].includes(key)&&(['string','number','boolean'].includes(typeof value)||value==null));}
function liveFieldEditor(row){return editableLiveFields(row).map(([key,value])=>{const label=liveFieldLabels[key]||key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase()),long=/text|result|comment|response|narrative|message|note|content/i.test(key)||String(value??'').length>80;return `<label class="${long?'wide':''}">${esc(label)}${long?`<textarea data-live-field="${esc(key)}">${esc(value??'')}</textarea>`:`<input data-live-field="${esc(key)}" value="${esc(value??'')}">`}</label>`;}).join('');}

function compactRenderedView(){
 const root=document.getElementById('view');if(!root)return;
 root.querySelectorAll('tr').forEach(row=>{if(!row.textContent.trim()&&!row.querySelector('input,select,textarea,img,button'))row.remove();});
 root.querySelectorAll('p,div,section').forEach(el=>{if(el!==root&&!el.textContent.trim()&&!el.querySelector('input,select,textarea,img,button,table,details')&&!el.classList.contains('actions')&&!el.matches('[role="status"],.feedback')&&!/Feedback$|ScanResult$/.test(el.id))el.remove();});
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes){const cleaned=node.nodeValue.replace(/(^|\n)\s*(?:#|---|\|\s*)\s*(?=\n|$)/g,'$1').replace(/[ \t]{2,}/g,' ');if(cleaned!==node.nodeValue)node.nodeValue=cleaned;}
 root.querySelectorAll('details.chartRecord').forEach(d=>{if(['flowsheets','io'].includes(currentView))d.open=true;});
 root.querySelectorAll('.panel').forEach(section=>{const heading=section.querySelector(':scope > h2')?.textContent.trim()||'',text=section.textContent;if((currentView==='labs'&&(text.includes('No released laboratory results.')||text.includes('No released diagnostic attachments.')))||(currentView==='mar'&&heading==='Chart Record')||(currentView==='io'&&/Output day 1|Output day 2|\bDay 1\b[\s\S]*\bDay 2\b/i.test(text)))section.remove();});
}
function janeMedicationText(value){
 return String(value??'')
  .replace(/Acetaminophen\s*\((?:Acetaminophen\s*\()+Tylenol\)+/gi,'Acetaminophen (Tylenol)')
  .replace(/Polyethylene glycol 3350\s*\((?:Polyethylene glycol 3350\s*\()+MiraLAX\)+/gi,'Polyethylene glycol 3350 (MiraLAX)')
  .replace(/Docusate sodium\s*\((?:Docusate sodium\s*\()+Colace\)+/gi,'Docusate sodium (Colace)')
  .replace(/Ancef\s*\(Cefazolin\)/gi,'Cefazolin (Ancef)')
  .replace(/Reglan\s*\(Metoclopramide\)/gi,'Metoclopramide (Reglan)')
  .replace(/Versed\s*\(Midazolam\)/gi,'Midazolam (Versed)')
  .replace(/Zofran\s*\(Ondansetron\)/gi,'Ondansetron (Zofran)')
  .replace(/\bCefazolin\b(?!\s*\(Ancef\))/gi,'Cefazolin (Ancef)')
  .replace(/\bMetoclopramide\b(?!\s*\(Reglan\))/gi,'Metoclopramide (Reglan)')
  .replace(/\bMidazolam\b(?!\s*\(Versed\))/gi,'Midazolam (Versed)')
  .replace(/\bOndansetron\b(?!\s*\(Zofran\))/gi,'Ondansetron (Zofran)')
  .replace(/\bNaloxone\b(?!\s*\(Narcan\))/gi,'Naloxone (Narcan)')
  .replace(/\bKetorolac\b(?!\s*\(Toradol\))/gi,'Ketorolac (Toradol)')
  .replace(/\bMorphine sulfate\b(?!\s*\(Duramorph\))/gi,'Morphine sulfate (Duramorph)')
  .replace(/\bMorphine\b(?!\s+sulfate|\s*\(Duramorph\))/gi,'Morphine sulfate (Duramorph)')
  .replace(/(^|[^\w(])Tylenol\b/gi,'$1Acetaminophen (Tylenol)')
  .replace(/(^|[^\w(])MiraLAX\b/gi,'$1Polyethylene glycol 3350 (MiraLAX)')
  .replace(/(^|[^\w(])Colace\b/gi,'$1Docusate sodium (Colace)')
  .replace(/\bMelatonin\b(?!\s*\(Natrol\))/gi,'Melatonin (Natrol)')
  .replace(/\bEscitalopram\b(?!\s*\(Lexapro\))/gi,'Escitalopram (Lexapro)');
}
function normalizeJaneMedicationContent(){
 const retired='admin-jane-respiratory';
 const postopOrderId='chart-2d6195d201d58030b0ded95695bbcb1e';
 const postopProgressNoteId='chart-1d0195d201d581cf8a0adf7495447769';
 const isRetiredRespiratoryCard=row=>row?.patientId==='jane-fowler'&&String(row.title||'').trim()==='Respiratory Depression — MD Orders';
 for(let i=CHART_RECORDS.length-1;i>=0;i--)if(CHART_RECORDS[i].id===retired)CHART_RECORDS.splice(i,1);
 for(let i=CHART_RECORDS.length-1;i>=0;i--)if(isRetiredRespiratoryCard(CHART_RECORDS[i]))CHART_RECORDS.splice(i,1);
 state.customChartRecords=(state.customChartRecords||[]).filter(x=>x.id!==retired&&!isRetiredRespiratoryCard(x));
 delete state.chartContentEdits?.[retired];
 state.releaseQueue=(state.releaseQueue||[]).filter(x=>x.chartRecordId!==retired&&x.id!==`pending-${retired}`&&!isRetiredRespiratoryCard(x)&&!isRetiredRespiratoryCard(x.rowData));
 // Move the complete postoperative set back to pending once. This preserves
 // each medication as its own release item while holding the post-op order
 // document out of the student chart until faculty chooses to release it.
 const postopIds=new Set([postopOrderId,postopProgressNoteId,'admin-jane-respiratory-naloxone','admin-jane-respiratory-ketorolac']);
 if(!state.settings?.janePostopOrdersPending20260918){
  for(const row of CHART_RECORDS)if(postopIds.has(row.id))row.status='pending';
  for(const item of state.releaseQueue||[])if(postopIds.has(item.chartRecordId)){item.status='pending';item.releasedAt='';}
  state.settings||={};state.settings.janePostopOrdersPending20260918=true;
 }
 const update=row=>{
  if(!row||row.patientId&&row.patientId!=='jane-fowler')return;
  for(const key of ['name','medication','text','title','content'])if(typeof row[key]==='string')row[key]=janeMedicationText(row[key]);
  for(const key of ['content','text'])if(typeof row[key]==='string')row[key]=row[key].replace(/\bConsult Oncology\.(?!\s*in AM)/g,'Consult oncology in AM.').replace(/\bConsult Oncology in AM\./g,'Consult oncology in AM.');
  const morphine=/morphine sulfate\s*\(duramorph\)/i.test([row.name,row.medication,row.text,row.title,row.content].filter(Boolean).join(' '));
  if(!morphine)return;
  if(/^2 mg\s*\(10 mg\/mL\)$/i.test(String(row.dose||'')))row.dose='2 mg/1 mL';
  for(const key of ['content','text'])if(typeof row[key]==='string')row[key]=row[key].replace(/Available concentration:\s*10 mg\/mL\.?/gi,'Available concentration: 2 mg/1 mL.');
 };
 for(const row of CHART_RECORDS.filter(x=>x.patientId==='jane-fowler'))update(row);
 const postopProgress=CHART_RECORDS.find(x=>x.id===postopProgressNoteId);
 if(postopProgress){
  if(!/Titrate oxygen to maintain pulse oximetry of 94% or greater/i.test(postopProgress.content))postopProgress.content=postopProgress.content.replace(/- Post-op vital signs per protocol\.?/i,'- Post-op vital signs per protocol\n\t- Titrate oxygen to maintain pulse oximetry of 94% or greater.');
  postopProgress.content=postopProgress.content
   .replace(/(?:\n\t- Titrate oxygen to maintain pulse oximetry of 94% or greater\.){2,}/gi,'\n\t- Titrate oxygen to maintain pulse oximetry of 94% or greater.')
   .replace(/\*\*Oncology consultation\*\* requested/i,'Consult oncology in AM.');
 }
 const shiftTwoOrders=CHART_RECORDS.find(x=>x.id==='chart-2d6195d201d58030b0ded95695bbcb1e');
 if(shiftTwoOrders)shiftTwoOrders.content=compactContent(shiftTwoOrders.content.replace(/<tr\b[^>]*>(?:(?!<\/tr>)[\s\S])*(?:Morphine|Ondansetron|Zofran)(?:(?!<\/tr>)[\s\S])*<\/tr>/gi,''));
 // Keep persistent edits and already-created Faculty Live Control cards in sync
 // with the current post-op order and the progress note it releases with it.
 for(const record of [shiftTwoOrders,postopProgress])if(record){
  const edit=state.chartContentEdits?.[record.id];if(edit)Object.assign(edit,{title:record.title,content:record.content,status:'pending'});
  for(const item of state.releaseQueue||[])if(item.chartRecordId===record.id)Object.assign(item,{title:record.title,content:record.content});
 }
 for(const row of (state.customChartRecords||[]).filter(x=>x.patientId==='jane-fowler'))update(row);
 for(const [id,row] of Object.entries(state.chartContentEdits||{})){const record=CHART_RECORDS.find(x=>x.id===id);if(record?.patientId==='jane-fowler')update(row);}
 for(const key of ['orders','medicationCatalog'])for(const row of (state[key]||[]).filter(x=>x.patientId==='jane-fowler'))update(row);
 for(const item of (state.releaseQueue||[]).filter(x=>x.patientId==='jane-fowler')){update(item);update(item.rowData);}
 const base=state.simulationBases?.['jane-fowler'];
 if(base){
  base.chartRecords=(base.chartRecords||[]).filter(x=>x.id!==retired&&!isRetiredRespiratoryCard(x));for(const row of base.chartRecords)update(row);
  for(const row of base.chartRecords)if(postopIds.has(row.id))row.status='pending';
  for(const key of ['orders','medicationCatalog'])for(const row of base.collections?.[key]||[])update(row);
  base.releaseQueue=(base.releaseQueue||[]).filter(x=>x.chartRecordId!==retired&&x.id!==`pending-${retired}`&&x.chartRecordId!==postopProgressNoteId&&!isRetiredRespiratoryCard(x)&&!isRetiredRespiratoryCard(x.rowData));for(const item of base.releaseQueue){if(postopIds.has(item.chartRecordId)){item.status='pending';item.releasedAt='';}update(item);update(item.rowData);}
  const postOpRelease=base.releaseQueue.find(x=>x.chartRecordId===postopOrderId);
  if(postOpRelease)postOpRelease.linkedChartRecordIds=[...new Set([...(postOpRelease.linkedChartRecordIds||[]),postopProgressNoteId])];
  for(const record of [shiftTwoOrders,postopProgress])if(record){
   const saved=base.chartRecords.find(x=>x.id===record.id);if(saved)Object.assign(saved,{title:record.title,content:record.content,status:'pending'});
   for(const item of base.releaseQueue||[])if(item.chartRecordId===record.id)Object.assign(item,{title:record.title,content:record.content});
  }
 }
}
function migratePacketCharts(){
 const withoutGlucose=new Set(['jane-fowler','fatima-sanogo','molly-thomas','stephanie-smith']);
 state.glucoseChecks=(state.glucoseChecks||[]).filter(x=>!withoutGlucose.has(x.patientId));
 for(const row of state.vitals||[])if(withoutGlucose.has(row.patientId))delete row.bg;
 state.medicationCatalog=(state.medicationCatalog||[]).filter(x=>!withoutGlucose.has(x.patientId)||!/insulin/i.test(x.name||x.medication||''));
 state.orders=(state.orders||[]).filter(x=>!withoutGlucose.has(x.patientId)||!/glucose checks?|blood sugar|sliding[- ]scale|insulin/i.test(x.text||x.order||''));
 state.releaseQueue=(state.releaseQueue||[]).filter(x=>!withoutGlucose.has(x.patientId)||!/glucose checks?|blood sugar|sliding[- ]scale|insulin/i.test([x.title,x.content,x.rowData?.name,x.rowData?.text].filter(Boolean).join(' ')));
 for(const id of withoutGlucose){const base=state.simulationBases?.[id];if(!base)continue;base.collections.glucoseChecks=[];for(const row of base.collections.vitals||[])delete row.bg;base.collections.medicationCatalog=(base.collections.medicationCatalog||[]).filter(x=>!/insulin/i.test(x.name||x.medication||''));base.collections.orders=(base.collections.orders||[]).filter(x=>!/glucose checks?|blood sugar|sliding[- ]scale|insulin/i.test(x.text||x.order||''));base.releaseQueue=(base.releaseQueue||[]).filter(x=>!/glucose checks?|blood sugar|sliding[- ]scale|insulin/i.test([x.title,x.content,x.rowData?.name,x.rowData?.text].filter(Boolean).join(' ')));}
 const profiles={
  'amelia-sung':{weightKg:83,allergies:['Shellfish','Penicillin'],bloodType:'O+',primaryDiagnosis:"Induction of labor / gestational diabetes (diet-controlled)",gbs:'Positive',fetus:'Male',painPlan:"Epidural in place — anesthesia-managed"},
  'jane-fowler':{primaryDiagnosis:'Ovarian cancer — preoperative total abdominal hysterectomy with bilateral salpingo-oophorectomy'},
  'fatima-sanogo':{weightKg:70,bloodType:'O+',primaryDiagnosis:'Postpartum hemorrhage after vaginal delivery',fetus:'Male'},
  'molly-thomas':{weightKg:7,primaryDiagnosis:'Upper airway obstruction / croup'}
 };
 for(const [id,patch] of Object.entries(profiles)){const p=state.patients?.find(x=>x.id===id);if(p)Object.assign(p,patch);const b=state.simulationBases?.[id]?.patient;if(b)Object.assign(b,patch);}
 const janeAdmission=(typeof SEED_JANE_ORDERS==='undefined'?[]:SEED_JANE_ORDERS).filter(x=>x.id.startsWith('jane-preop-'));
 state.orders=(state.orders||[]).filter(x=>!(x.patientId==='jane-fowler'&&String(x.id||'').startsWith('jane-postop-')));
 for(const seed of janeAdmission){const current=(state.orders||[]).find(x=>x.id===seed.id);if(current)Object.assign(current,cloneData(seed));else state.orders.push(cloneData(seed));}
 const janeNotes=typeof SEED_JANE_NOTES==='undefined'?[]:SEED_JANE_NOTES;
 state.notes||=[];for(const seed of janeNotes){const current=state.notes.find(x=>x.id===seed.id);if(current)Object.assign(current,cloneData(seed));else state.notes.push(cloneData(seed));}
 const janeBase=state.simulationBases?.['jane-fowler'];
 if(janeBase){
  janeBase.collections.orders=(janeBase.collections.orders||[]).filter(x=>!String(x.id||'').startsWith('jane-postop-'));
  for(const seed of janeAdmission){const current=janeBase.collections.orders.find(x=>x.id===seed.id);if(current)Object.assign(current,cloneData(seed));else janeBase.collections.orders.push(cloneData(seed));}
  janeBase.collections.notes||=[];for(const seed of janeNotes){const current=janeBase.collections.notes.find(x=>x.id===seed.id);if(current)Object.assign(current,cloneData(seed));else janeBase.collections.notes.push(cloneData(seed));}
  janeBase.chartRecords=(janeBase.chartRecords||[]).filter(x=>!retiredChartIds.has(x.id));
  for(const id of ['chart-1d0195d201d581d49553e7787bbe1924','chart-2fd195d201d58013ab8bffdf475123e4','admin-jane-ct-results','chart-2d6195d201d58030b0ded95695bbcb1e','admin-jane-respiratory-naloxone','admin-jane-respiratory-ketorolac']){const source=CHART_RECORDS.find(x=>x.id===id);if(!source)continue;const current=janeBase.chartRecords.find(x=>x.id===id);if(current)Object.assign(current,cloneData(source));else janeBase.chartRecords.push(cloneData(source));}
 }
 const retiredAmelia=new Set(['amelia-order-morphine','amelia-order-admit','amelia-order-gbs','amelia-order-cervical','amelia-order-birthplan','amelia-order-breastfeed','amelia-order-glucose','amelia-order-tylenol']);
 state.orders=(state.orders||[]).filter(x=>!retiredAmelia.has(x.id));
 state.releaseQueue=(state.releaseQueue||[]).filter(x=>!retiredAmelia.has(x.rowData?.id)&&!retiredAmelia.has(x.chartRecordId));
 const gbs=(state.labs||[]).find(x=>x.id==='amelia-lab-gbs');if(gbs)Object.assign(gbs,{result:'Positive',flag:'Abnormal',comments:'Group B Strep positive'});
 const ameliaNote=(state.notes||[]).find(x=>x.id==='amelia-admission-note');if(ameliaNote)Object.assign(ameliaNote,{"situation":"36-year-old Filipino G2P1 at 39 weeks admitted for induction for diet-controlled gestational diabetes; arrived 2 hours ago. SROM at home at 0300, clear fluid; cervix 4 cm. Epidural in place — anesthesia-managed; infusion running at the start of Shift 1. GBS positive with penicillin allergy; clindamycin 900 mg IVPB every 6 hours until delivery; first dose due now, students start in Shift 1. On-call physician requests report to day-shift physician.","background":"G2P1L1; previous vaginal delivery of a 9 lb male, no complications. Diet-controlled gestational diabetes; O positive, hepatitis B negative, GBS positive. Prenatal care began at 14 weeks; pregnancy weight gain 55 lb. No surgical history. Not married; father of baby not involved; no support person.","assessment":"LR 125 mL/hr via 20 g right wrist; Pitocin 6 milliunits/min. Fingerstick glucose 90 mg/dL 2 hours ago. BP 138/80; HR 90; RR 22; T 98.9 °F; SpO₂ 99% on room air. FHR 140, moderate variability with accelerations. Strong contractions every 3 minutes lasting 45 seconds. Clear liquids; bed rest (epidural in place).","recommendation":"Report to day-shift physician; start clindamycin; epidural in place, managed by anesthesia. Recheck fingerstick blood glucose 30 minutes after a low glucose result; report the repeat result to the provider."});
 for(const id of Object.keys(profiles)){
  const base=state.simulationBases?.[id];if(!base)continue;
  base.collections.orders=(base.collections.orders||[]).filter(x=>!retiredAmelia.has(x.id));
  if(id==='amelia-sung'){const bg=(base.collections.labs||[]).find(x=>x.id==='amelia-lab-gbs');if(bg)Object.assign(bg,{result:'Positive',flag:'Abnormal',comments:'Group B Strep positive'});}
 }
 const babyProtocol=CHART_RECORDS.find(x=>x.id==='admin-baby-glucose-protocol');
 const babyBase=state.simulationBases?.['baby-boy-sung'];
 if(babyProtocol&&babyBase){
  const saved=babyBase.chartRecords?.find(x=>x.id===babyProtocol.id);
  if(saved)Object.assign(saved,cloneData(babyProtocol));else (babyBase.chartRecords||=[]).push(cloneData(babyProtocol));
  babyBase.releaseQueue=(babyBase.releaseQueue||[]).filter(x=>x.chartRecordId!==babyProtocol.id);
 }
 window.markStateMigration('packetCharts20260917');
}
window.prepareAdminChartData=function(){
 for(let i=CHART_RECORDS.length-1;i>=0;i--)if(retiredChartIds.has(CHART_RECORDS[i].id))CHART_RECORDS.splice(i,1);
 for(let i=CHART_RECORDS.length-1;i>=0;i--)if(CHART_RECORDS[i].category==='io'&&/(?:Output day 1|Output day 2|\bDay 1\b[\s\S]*\bDay 2\b)/i.test(CHART_RECORDS[i].content))CHART_RECORDS.splice(i,1);
 for(const record of CHART_RECORDS)if(record.id!=='admin-baby-glucose-protocol')record.content=compactContent(record.content);
 const amelia=CHART_RECORDS.find(r=>r.patientId==='amelia-sung'&&r.category==='orders');
 if(amelia)amelia.content=amelia.content.replace(/No additional orders entered\. Record new provider orders in the Provider Orders section\.?/gi,'').trim();
 // Stephanie's post-chest-X-ray orders must not appear in her original Admission Orders.
 // They remain separate pending faculty-release items and appear only after individually released.
 for(const record of CHART_RECORDS.filter(r=>r.patientId==='stephanie-smith'&&r.category==='orders'&&/admission/i.test(r.title||''))){
  record.content=compactContent(record.content
   .replace(/^.*(?:infuse\s*)?2\s*units?.*PRBC.*$/gmi,'')
   .replace(/^.*ceftriaxone.*$/gmi,'')
   .replace(/^.*acetaminophen.*$/gmi,'')
   .replace(/^.*CBC\s*(?:in\s*)?(?:the\s*)?(?:AM|morning).*$/gmi,''));
 }
 if(Array.isArray(state.orders)){
  state.orders=state.orders.filter(o=>!(o.patientId==='stephanie-smith'&&/admission/i.test(o.type||o.title||o.orderSet||'')&&/(?:2\s*units?.*PRBC|ceftriaxone|acetaminophen|CBC\s*(?:in\s*)?(?:the\s*)?(?:AM|morning))/i.test(o.text||o.order||o.medication||'')));
 }
 const babyOrders=CHART_RECORDS.find(r=>r.id==='chart-256195d201d5815b8c66c36fd7f6f9b9');
 if(babyOrders)babyOrders.content=compactContent(babyOrders.content.replace(/<tr><td>[^<]*<\/td><td>Chest\s*[Xx]-?\s*ray<\/td><td>[^<]*(?:Laney|Darrelle)[\s\S]*?<\/td><\/tr>/i,''));
 const sanogo=CHART_RECORDS.find(r=>r.id==='chart-28b195d201d5805ca4d1c8978c9278be');
 if(sanogo)sanogo.content=compactContent(sanogo.content.replace(/<tr><td[^>]*><\/td><td>\*\*If hemorrhage is suspected[\s\S]*?<\/tr>/i,'').replace(/<tr><td[^>]*><\/td><td>(?:cbc in 6 hrs|foley cath|15 min fundus\s+checks)<\/td><td>Dr\. Darnell\/KR<\/td><\/tr>/gi,''));
 for(const item of state.customChartRecords||[])if(!retiredChartIds.has(item.id)&&!CHART_RECORDS.some(r=>r.id===item.id))CHART_RECORDS.push({...item});
 normalizeJaneMedicationContent();
};

function sendReleaseMessage(item){
 if(item.kind==='message')return;
 const record=item.chartRecordId&&CHART_RECORDS.find(r=>r.id===item.chartRecordId),target=item.targetCollection||record?.category,destination=target==='orders'||item.kind==='order'?'Orders':target==='mar'||target==='medicationCatalog'?'MAR':target==='labs'||item.kind==='result'?'Labs / Diagnostics':target==='notes'?'Nursing Notes':target==='vitals'?'Flowsheets / Vitals':target==='io'?'Intake & Output':target==='assessments'?'Assessments':target==='laborProgress'?'Labor & Delivery':target==='postpartumRecovery'||target==='pphPads'||target==='pphMedications'?'Postpartum Recovery / PPH':target==='bloodAdministration'?'Blood Administration':target==='surgicalChecklist'||target==='surgicalAssessments'?'Surgical / Post-Op':'Patient Chart';
 state.messages ||= [];
 if(state.messages.some(m=>m.releaseItemId===item.id))return;
 state.messages.push({id:uid('msg'),patientId:item.patientId,at:item.releasedAt||nowLocal(),from:'Faculty',to:'Student',subject:`${item.title} released`,message:`${item.title} is now available in the ${destination} tab.`,read:false,releaseItemId:item.id});
}
const simulationPatientCollections=['orders','labs','notes','vitals','io','assessments','mar','medicationCatalog','bloodUnits','glucoseChecks','laborProgress','postpartumRecovery','pphPads','pphMedications','bloodAdministration','surgicalChecklist','surgicalAssessments','messages','notifications','diagnosticFiles','labPanels'];
const cloneData=value=>JSON.parse(JSON.stringify(value));
function captureSimulationBase(patientId){
 const patient=state.patients.find(x=>x.id===patientId);
 const base={savedAt:new Date().toISOString(),patient:cloneData(patient),collections:Object.fromEntries(simulationPatientCollections.map(key=>[key,cloneData((state[key]||[]).filter(x=>x.patientId===patientId))])),chartRecords:cloneData(CHART_RECORDS.filter(x=>x.patientId===patientId)),releaseQueue:cloneData((state.releaseQueue||[]).filter(x=>x.patientId===patientId&&x.status==='pending')),scenarioStage:cloneData(state.scenarioStage?.[patientId]||null),marVisibility:state.marVisibility?.[patientId]!==false,marHiddenRecords:cloneData(Object.fromEntries(Object.entries(state.marHiddenRecords||{}).filter(([recordId])=>CHART_RECORDS.some(r=>r.id===recordId&&r.patientId===patientId))))};
 base.collections.mar=[];base.collections.bloodAdministration=[];
 return base;
}
function restoreSimulationBase(patientId){
 const base=state.simulationBases?.[patientId];if(!base)return false;
 const patientIndex=state.patients.findIndex(x=>x.id===patientId);state.patients[patientIndex]=cloneData(base.patient);
 for(const key of simulationPatientCollections){const others=(state[key]||[]).filter(x=>x.patientId!==patientId);let starting=cloneData(base.collections[key]||[]);if(key==='mar'||key==='bloodAdministration')starting=[];const janeAdmissionOrders=patientId==='jane-fowler'&&key==='orders'?starting.filter(x=>String(x.id||'').startsWith('jane-preop-')):[];state[key]=others.concat(key==='orders'?janeAdmissionOrders:key==='labs'?[]:starting);}
 for(let i=CHART_RECORDS.length-1;i>=0;i--)if(CHART_RECORDS[i].patientId===patientId)CHART_RECORDS.splice(i,1);CHART_RECORDS.push(...cloneData(base.chartRecords));
 state.chartContentEdits ||= {};for(const id of Object.keys(state.chartContentEdits))if(!CHART_RECORDS.some(r=>r.id===id))delete state.chartContentEdits[id];
 state.customChartRecords=(state.customChartRecords||[]).filter(x=>x.patientId!==patientId).concat(cloneData(base.chartRecords.filter(x=>(state.customChartRecords||[]).some(c=>c.id===x.id))));
 state.releaseQueue=(state.releaseQueue||[]).filter(x=>x.patientId!==patientId).concat(cloneData(base.releaseQueue).map(x=>({...x,status:'pending',releasedAt:''})));
 const queueIfMissing=(kind,title,content,extra={})=>{if(!state.releaseQueue.some(x=>x.patientId===patientId&&x.status==='pending'&&x.title===title))state.releaseQueue.push({id:uid('pending'),kind,patientId,title,content,status:'pending',createdAt:nowLocal(),releasedAt:'',...extra});};
 for(const record of CHART_RECORDS.filter(x=>x.patientId===patientId&&['orders','labs'].includes(x.category))){const janeAdmission=patientId==='jane-fowler'&&record.id==='chart-1d0195d201d581d49553e7787bbe1924';record.status=janeAdmission?'released':'pending';state.chartContentEdits[record.id]={title:record.title,category:record.category,status:record.status,content:record.content};if(!janeAdmission)queueIfMissing(record.category==='orders'?'order':'result',record.title,record.content,{chartRecordId:record.id});}
 for(const row of base.collections.orders||[]){if(patientId==='jane-fowler'&&String(row.id||'').startsWith('jane-preop-'))continue;queueIfMissing('chartdata',row.text||row.medication||'Provider Order',row.text||JSON.stringify(row),{targetCollection:'orders',rowData:cloneData(row),provider:row.provider||''});}
 const janeReleasedMeds=new Set(['Cefazolin (Ancef)','Metoclopramide (Reglan)','Lactated Ringer’s solution (LR)','Midazolam (Versed)']);
 for(const med of (state.medicationCatalog||[]).filter(x=>x.patientId===patientId&&x.status!=='Discontinued')){const janeAdmission=patientId==='jane-fowler'&&janeReleasedMeds.has(med.name);med.releaseStatus=janeAdmission?'released':'pending';med.status=janeAdmission?'Due':'Pending';if(!janeAdmission)queueIfMissing('chartdata',`${med.name} ${med.dose}`,`${med.name} ${med.dose} ${med.route}`,{targetCollection:'medicationCatalog',rowData:cloneData(med),orderType:'Medication',provider:med.provider||''});}
 for(const row of base.collections.labs||[])queueIfMissing('chartdata',row.test||'Laboratory Result',row.result||JSON.stringify(row),{targetCollection:'labs',rowData:cloneData(row)});
 state.diagnosticFiles=(state.diagnosticFiles||[]).map(file=>file.patientId===patientId?{...file,status:'pending',releasedAt:''}:file);for(const file of state.diagnosticFiles.filter(x=>x.patientId===patientId))queueIfMissing('result',file.title||file.fileName,'Diagnostic report/image pending faculty release.',{resultType:'Imaging',fileIds:[file.id]});
 state.scenarioStage ||= {};if(base.scenarioStage===null)delete state.scenarioStage[patientId];else state.scenarioStage[patientId]=cloneData(base.scenarioStage);
 state.marVisibility ||= {};state.marVisibility[patientId]=base.marVisibility;state.marHiddenRecords={...(state.marHiddenRecords||{}),...cloneData(base.marHiddenRecords||{})};return true;
}
function renderBloodAdministration(){
 if(!requirePatient())return;
 const p=activePatient();
 if(!['fatima-sanogo','stephanie-smith'].includes(p.id)){document.getElementById('view').innerHTML=panel('Blood Administration','No blood administration record is assigned to this patient.');return;}
 const rows=patientRows(state.bloodAdministration).slice().reverse();
 document.getElementById('view').innerHTML=panel('Blood Product Scanning & Administration',`<div class="grid3">
 <label>Product<select id="baProduct"><option>Packed red blood cells</option><option>Fresh frozen plasma</option><option>Platelets</option><option>Cryoprecipitate</option></select></label>
 <label>Unit / Donation Number<input id="baUnit"></label><label>Scan Barcode<input id="baBarcode" placeholder="Scan or enter barcode"></label>
 <label>Patient ID Verification<input id="baPatient" value="${esc(p.mrn)}"></label><label>Blood Type / Compatibility<input id="baType"></label><label>Expiration<input id="baExpiry" type="datetime-local"></label>
 <label>Start Time<input id="baStart" type="datetime-local" value="${nowLocal()}"></label><label>End Time<input id="baEnd" type="datetime-local"></label><label>Volume mL<input id="baVolume" type="number"></label>
 <label>Administered By<input id="baStudent"></label><label>Verified By<input id="baVerifier"></label><label>Reaction<select id="baReaction"><option>None</option><option>Suspected reaction—stopped</option><option>Confirmed reaction—stopped</option></select></label>
 <label>Baseline Vitals<input id="baBase" placeholder="T / HR / RR / BP / SpO₂"></label><label>15-minute Vitals<input id="ba15" placeholder="T / HR / RR / BP / SpO₂"></label><label>Completion Vitals<input id="baEndVitals" placeholder="T / HR / RR / BP / SpO₂"></label>
 <label class="wide">Response / Notes<textarea id="baNotes"></textarea></label></div><div class="actions"><button id="baVerify" class="secondary">Verify Scan</button><button id="baSave" class="primary">Save Blood Administration</button></div>`)+panel('Blood Administration Record',`<table><thead><tr><th>Start</th><th>Product / Unit</th><th>Barcode</th><th>Volume</th><th>Reaction</th><th>Administered / Verified</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.startTime)}</td><td>${esc(r.product)}<br>${esc(r.unit)}</td><td>${esc(r.barcode)}</td><td>${esc(r.volume)} mL</td><td>${esc(r.reaction||'None')}</td><td>${esc(r.student)} / ${esc(r.verifiedBy)}</td></tr>`).join('')||'<tr><td colspan="6">No blood products documented.</td></tr>'}</tbody></table>`);
 baVerify.onclick=()=>{if(!baBarcode.value.trim()||baPatient.value.trim()!==String(p.mrn)){alert('Scan the unit and verify the patient MRN.');return}alert('Patient and blood-product scan verified. Complete the independent verifier check before administration.');};
 baSave.onclick=()=>{if(!baUnit.value.trim()||!baBarcode.value.trim()||!baStudent.value.trim()||!baVerifier.value.trim()){alert('Unit, barcode, administering clinician, and independent verifier are required.');return}state.bloodAdministration.push({id:uid('blood'),patientId:p.id,product:baProduct.value,unit:baUnit.value.trim(),barcode:baBarcode.value.trim(),patientVerification:baPatient.value.trim(),bloodType:baType.value.trim(),expiry:baExpiry.value,startTime:baStart.value,endTime:baEnd.value,volume:baVolume.value,student:baStudent.value.trim(),verifiedBy:baVerifier.value.trim(),reaction:baReaction.value,baselineVitals:baBase.value.trim(),fifteenMinuteVitals:ba15.value.trim(),completionVitals:baEndVitals.value.trim(),response:baNotes.value.trim()});save();renderBloodAdministration();};
}
window.renderBloodAdministration=renderBloodAdministration;

let charlesMarShift=1;
function medBarcode(name){return (state.medicationCatalog||[]).find(x=>x.patientId===activePatientId&&x.name===name)?.barcode||`MED-CHARLES-${name.toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'')}`;}
function renderCharlesMAR(){
 const p=activePatient(),faculty=isFaculty(),sheet=CHART_RECORDS.find(r=>r.id===`admin-charles-mar-${charlesMarShift}`),available=faculty||chartRecordReleased(sheet);
 const catalog=window.medicationsForPatient(p.id).map(x=>[x.name,x.route,x.scheduledTime||x.frequency||'']);const meds=catalog.filter(m=>(charlesMarShift===1||charlesMarShift===3)?m[2]!=='2100':m[2]==='2100'||m[2]==='AC/HS');
 const history=patientRows(state.mar).filter(r=>Number(r.shiftNumber||String(r.shift||'').match(/\d/)?.[0])===charlesMarShift).slice().reverse();
 document.getElementById('view').innerHTML=panel('Charles Jones — MAR & Medication Scanning',`<div class="levelTabs">${[1,2,3,4].map(n=>{const r=CHART_RECORDS.find(x=>x.id===`admin-charles-mar-${n}`),open=faculty||chartRecordReleased(r);return `<button class="levelTab charlesShift ${n===charlesMarShift?'active':''}" data-shift="${n}" ${open?'':'disabled'}>Shift ${n} · ${n===1||n===3?'Day':'Night'} ${open?'':'(Pending)'}</button>`}).join('')}</div>${available?`<table><thead><tr><th>Medication</th><th>Dose / Route</th><th>Due</th><th>Status</th><th>Simulation Barcode</th></tr></thead><tbody>${meds.map(m=>`<tr><td><b>${esc(m[0])}</b></td><td>${esc(m[1])}</td><td>${esc(m[2])}</td><td>${m[2].startsWith('HELD')?'Held':'Due'}</td><td><code>${esc(medBarcode(m[0]))}</code></td></tr>`).join('')}</tbody></table>`:'<div class="warn">This MAR sheet is pending faculty release.</div>'}`)+
 (available?panel('Medication Scanning',`<div class="scanGrid"><div><h3>1. Scan Patient Wristband</h3><input id="cjPatientScan" placeholder="Scan wristband or enter printed code"><div id="cjPatientFeedback" class="note"></div></div><div class="scanArrow">→</div><div><h3>2. Scan Medication Barcode</h3><input id="cjMedScan" placeholder="Scan medication barcode"><div id="cjMedFeedback" class="note"></div></div><div class="verifyBox"><b>Verification Status</b><div id="cjVerifyStatus" class="note">Scan the patient and medication.</div></div></div><button id="cjVerifyButton" class="primary">Verify Patient & Medication</button><div id="cjAdminArea" role="status"></div>`):'')+
 panel('Administration History',`<table><thead><tr><th>Time</th><th>Medication</th><th>Status</th><th>Assessment / Education</th><th>Student</th></tr></thead><tbody>${history.map(r=>`<tr><td>${esc(r.time)}</td><td>${esc(r.medication)} ${esc(r.dose)} ${esc(r.route)}</td><td>${esc(r.status)}</td><td>${esc(r.preAssessment)}<br>${esc(r.education)}</td><td>${esc(r.student)}</td></tr>`).join('')||'<tr><td colspan="5">No administrations documented for this shift.</td></tr>'}</tbody></table>`);
 document.querySelectorAll('.charlesShift').forEach(b=>b.onclick=()=>{charlesMarShift=Number(b.dataset.shift);renderMAR();});
 if(!available)return;
 let verifiedMed=null;
 const verify=()=>{const patientOk=[p.barcode,String(p.mrn)].includes(cjPatientScan.value.trim()),med=meds.find(m=>medBarcode(m[0])===cjMedScan.value.trim().toUpperCase()&&(isFaculty()||window.medicationsForPatient(p.id,false).some(x=>x.name===m[0])));cjPatientFeedback.className=patientOk?'success':'warn';cjPatientFeedback.textContent=patientOk?`Patient verified: ${p.name}, MRN ${p.mrn}.`:'PATIENT MISMATCH: Wristband was not recognized.';cjMedFeedback.className=med?'success':'warn';cjMedFeedback.textContent=med?`Medication verified: ${med[0]} ${med[1]}.`:'MEDICATION NOT FOUND OR NOT DUE THIS SHIFT.';verifiedMed=patientOk&&med?med:null;cjVerifyStatus.textContent=verifiedMed?'Patient and medication match this MAR.':'Verification failed. Stop and recheck.';cjAdminArea.innerHTML=verifiedMed?panel('Medication Verification',`${verifiedMed[0].includes('Warfarin')||verifiedMed[0].includes('Insulin')?'<div class="warn"><b>HIGH-ALERT MEDICATION:</b> Independent verification is required.</div>':''}<div class="success">Patient wristband and medication barcode matched.</div><div class="grid3"><label>Student Nurse<input id="cjStudent"></label><label>Administration Time<input id="cjTime" type="datetime-local" value="${nowLocal()}"></label><label>Site / Line<input id="cjSite"></label><label>Pre-administration Assessment<input id="cjAssessment"></label><label>Patient Education<input id="cjEducation"></label><label>Independent Verifier<input id="cjVerifier"></label><label>Status<select id="cjStatus"><option>Given</option><option>Held</option><option>Refused</option><option>Not given</option></select></label><label class="wide">Response / Notes<textarea id="cjNotes"></textarea></label></div><button id="cjDocument" class="primary">Document Medication Administration</button>`):'';if(verifiedMed)cjDocument.onclick=()=>{if((!isFaculty()&&!window.medicationsForPatient(p.id,false).some(x=>x.name===verifiedMed[0]))||![p.barcode,String(p.mrn)].includes(cjPatientScan.value.trim())||medBarcode(verifiedMed[0])!==cjMedScan.value.trim()){alert('Codes changed. Verify the patient and medication again.');return;}if(!cjStudent.value.trim()){alert('Enter the student nurse name.');return}if((verifiedMed[0].includes('Warfarin')||verifiedMed[0].includes('Insulin'))&&!cjVerifier.value.trim()){alert('Enter the independent verifier for this high-alert medication.');return}state.mar.push({id:uid('mar'),patientId:p.id,shiftNumber:charlesMarShift,shift:`Shift ${charlesMarShift}`,time:cjTime.value,student:cjStudent.value.trim(),medication:verifiedMed[0],dose:'',route:verifiedMed[1],due:verifiedMed[2],status:cjStatus.value,site:cjSite.value.trim(),preAssessment:cjAssessment.value.trim(),education:cjEducation.value.trim(),verifiedBy:cjVerifier.value.trim(),response:cjNotes.value.trim(),patientBarcode:cjPatientScan.value.trim(),medicationBarcode:medBarcode(verifiedMed[0])});save();renderMAR();};};
 cjVerifyButton.onclick=verify;cjPatientScan.oninput=cjMedScan.oninput=()=>{verifiedMed=null;cjAdminArea.innerHTML='';cjVerifyStatus.textContent='Codes changed. Verify again.';};cjPatientScan.onkeydown=e=>{if(e.key==='Enter')verify();};cjMedScan.onkeydown=e=>{if(e.key==='Enter')verify();};
}

// Remove the retired ice-pack order from Smith's saved and starting orders.
function removeSmithIcePackOrders(){
 const hasIce=text=>/\bice[\s-]*packs?\b/i.test(String(text||''));
 const clean=text=>String(text||'')
  .replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi,row=>hasIce(row)?'':row)
  .split(/(\r?\n|<br\s*\/?>|(?<=[.!?;])\s+(?=[A-Z]))/i)
  .filter(part=>!hasIce(part)).join('').trim();
 const cleanRows=rows=>(rows||[]).filter(row=>{
  if(row.patientId&&row.patientId!=='stephanie-smith')return true;
  if(row.category&&row.category!=='orders')return true;
  for(const key of ['text','content'])if(hasIce(row[key]))row[key]=clean(row[key]);
  return !(['text','content'].some(key=>key in row)&&!row.text&&!row.content);
 });
 state.orders=cleanRows(state.orders);
 const records=cleanRows(CHART_RECORDS);CHART_RECORDS.splice(0,CHART_RECORDS.length,...records);
 state.customChartRecords=cleanRows(state.customChartRecords);
 for(const [id,edit] of Object.entries(state.chartContentEdits||{})){
  const record=CHART_RECORDS.find(r=>r.id===id);
  if(record?.patientId==='stephanie-smith'&&record.category==='orders'&&hasIce(edit.content))edit.content=clean(edit.content);
 }
 const cleanQueue=queue=>(queue||[]).filter(item=>{
  if(item.patientId!=='stephanie-smith'||!(item.kind==='order'||item.targetCollection==='orders'||item.chartRecordId&&CHART_RECORDS.some(r=>r.id===item.chartRecordId&&r.category==='orders')))return true;
  if(item.rowData&&!cleanRows([item.rowData]).length)return false;
  if(hasIce(item.content))item.content=clean(item.content);
  return !!item.content||!!item.rowData?.text;
 });
 state.releaseQueue=cleanQueue(state.releaseQueue);
 const base=state.simulationBases?.['stephanie-smith'];
 if(base){base.collections.orders=cleanRows(base.collections.orders);base.chartRecords=cleanRows(base.chartRecords);base.releaseQueue=cleanQueue(base.releaseQueue);}
}
function updateSmithTylenolDose(){
 if(window.stateMigrationApplied('smithTylenol650V1'))return;
 const correct=text=>String(text||'').replace(/\b(Tylenol|Acetaminophen)(\s*(?:\([^)]*\))?\s*)\d+(?:\.\d+)?\s*mg\b/gi,(_,name,gap)=>name+gap+'650 mg');
 const update=row=>{
  if(!row)return;
  const name=row.name||row.medication||'';
  if(/^(?:Tylenol|Acetaminophen)\b/i.test(name)&&!/[+/]/.test(name))row.dose='650 mg';
  for(const key of ['title','content','text','name','medication'])if(typeof row[key]==='string')row[key]=correct(row[key]);
 };
 const smith=row=>row.patientId==='stephanie-smith';
 for(const row of CHART_RECORDS.filter(r=>smith(r)&&r.category==='orders')){update(row);update(state.chartContentEdits?.[row.id]);}
 for(const row of (state.customChartRecords||[]).filter(r=>smith(r)&&r.category==='orders'))update(row);
 for(const collection of ['orders','medicationCatalog'])for(const row of (state[collection]||[]).filter(smith))update(row);
 for(const item of (state.releaseQueue||[]).filter(smith)){if(item.kind==='order'||['orders','medicationCatalog'].includes(item.targetCollection)||item.chartRecordId==='admin-stephanie-acetaminophen'){update(item);update(item.rowData);}}
 const base=state.simulationBases?.['stephanie-smith'];
 if(base){for(const row of base.chartRecords||[])if(row.category==='orders')update(row);for(const key of ['orders','medicationCatalog'])for(const row of base.collections?.[key]||[])update(row);for(const item of base.releaseQueue||[])if(item.kind==='order'||['orders','medicationCatalog'].includes(item.targetCollection)||item.chartRecordId==='admin-stephanie-acetaminophen'){update(item);update(item.rowData);}}
 window.markStateMigration('smithTylenol650V1');
}
// Migrate old local/cloud saves once; later faculty edits and releases win.
window.migrateCarlProfile=function(){
 if(window.stateMigrationApplied('carlProfileImportV1'))return;
 const patientId='carl-shapiro',labId='chart-262195d201d580e18688dc6f4d7711db',noteId='chart-262195d201d581ad96b0e8bb01be03b9';
 const fillProfile=p=>{
  if(!p)return;
  if(!p.mrn||p.mrn==='SIM-L3-003')p.mrn='PCS71900';
  if(!p.provider||p.provider==='Simulation Faculty')p.provider='Dr. Chin A. Revis';
  if(!p.unit||p.unit==='Medical Surgical and ICU')p.unit='Progressive Care Unit';
  if(!p.weightKg)p.weightKg=110;
  if(!p.heightCm)p.heightCm=175;
  if(!p.sex)p.sex='Male';
 };
 fillProfile(state.patients.find(p=>p.id===patientId));
 const record=CHART_RECORDS.find(r=>r.id===labId);
 state.chartContentEdits ||= {};
 if(record){record.status='pending';if(state.chartContentEdits[labId])state.chartContentEdits[labId].status='pending';}
 seedChartPending();
 const base=state.simulationBases?.[patientId];
 if(base){
  fillProfile(base.patient);
  base.chartRecords ||= [];
  const saved=base.chartRecords.find(r=>r.id===labId);
  if(saved)saved.status='pending';else if(record)base.chartRecords.push(cloneData(record));
  const note=CHART_RECORDS.find(r=>r.id===noteId);
  if(note&&!base.chartRecords.some(r=>r.id===noteId))base.chartRecords.push(cloneData(note));
  base.releaseQueue ||= [];
  let item=base.releaseQueue.find(r=>r.chartRecordId===labId);
  if(!item&&record){item=cloneData(state.releaseQueue.find(r=>r.chartRecordId===labId));base.releaseQueue.push(item);}
  if(item){item.status='pending';item.releasedAt='';}
 }
 window.markStateMigration('carlProfileImportV1');
};
// Apply the Level 3 chart cleanup once to saved charts and their saved bases.
function migrateLevel3Charts(){
 if(window.stateMigrationApplied('level3ChartCleanupV1'))return;
 const current=Object.fromEntries(level3VitalsStart.map(r=>[r.id,r]));
 for(const r of CHART_RECORDS)if(current[r.id])Object.assign(r,cloneData(current[r.id]));
 for(const id of [...level3RetiredAssessments,...level3VitalsRecords])delete state.chartContentEdits[id];
 state.customChartRecords=state.customChartRecords.filter(r=>!level3RetiredAssessments.includes(r.id));
 for(const base of Object.values(state.simulationBases))if(base?.chartRecords)base.chartRecords=base.chartRecords.filter(r=>!level3RetiredAssessments.includes(r.id)).map(r=>current[r.id]?cloneData(current[r.id]):r);
 window.markStateMigration('level3ChartCleanupV1');
}
window.updateSmithTylenolDose=updateSmithTylenolDose;window.migratePacketCharts=migratePacketCharts;window.migrateLevel3Charts=migrateLevel3Charts;
window.initializeAdminEnhancements=function(){
 state.chartContentEdits ||= {};state.customChartRecords ||= [];state.marVisibility ||= {};state.marHiddenRecords ||= {};state.simulationBases ||= {};
 for(const [id,edit] of Object.entries(state.chartContentEdits)){const r=CHART_RECORDS.find(x=>x.id===id);if(r){Object.assign(r,edit);r.content=compactContent(r.content);edit.content=r.content;}}
 removeSmithIcePackOrders();
 updateSmithTylenolDose();
 normalizeJaneMedicationContent();
 migratePacketCharts();
 migrateCarlProfile();
 window.migrateRuthProfile?.();
 migrateLevel3Charts();
 const baseRelease=releaseItem;releaseItem=function(id){const item=(state.releaseQueue||[]).find(x=>x.id===id),record=item?.chartRecordId&&CHART_RECORDS.find(r=>r.id===item.chartRecordId);if(record)item.kind=record.category==='orders'?'order':record.category==='mar'?'mar':'result';baseRelease(id);if(item&&item.status==='released'){if(item.kind==='chartdata'&&item.targetCollection&&item.rowData){const existing=state[item.targetCollection].find(x=>x.id===item.rowData.id);if(!existing)state[item.targetCollection].push(item.rowData);if(item.targetCollection==='medicationCatalog')Object.assign(existing||item.rowData,{releaseStatus:'released',status:(existing||item.rowData).status==='Pending'?'Due':(existing||item.rowData).status});}const n=(state.notifications||[]).find(x=>x.releaseItemId===item.id);if(n&&record?.category==='mar'){n.title='New MAR Sheet';n.type='mar';}sendReleaseMessage(item);liveSave('released_to_chart',{patientId:item.patientId,itemId:item.id,target:item.targetCollection||record?.category});}};
 const baseChartRecords=chartRecords;chartRecords=function(patientId,categories){return baseChartRecords(patientId,categories).filter(r=>isFaculty()||!state.marHiddenRecords[r.id]);};
 const baseNativeInput=nativeInput;nativeInput=function(label,type='text',options=null){
 const choices={
  // General head-to-toe assessment
  'Orientation':['Oriented ×4','Oriented to person','Oriented to person and place','Oriented to person, place, and time','Disoriented','Unable to assess'],
  'Level of consciousness':['Alert','Drowsy','Lethargic','Responds to voice','Responds to pain','Unresponsive'],
  'Pupils / speech':['PERRLA / speech clear','Pupils equal and reactive / speech slurred','Pupils unequal','Pupils nonreactive','Speech aphasic','Unable to assess'],
  'Cardiac rhythm':['Regular','Irregular','Sinus rhythm','Sinus tachycardia','Sinus bradycardia','Atrial fibrillation','Other'],
  'Pulses / capillary refill / edema':['Pulses 2+ / cap refill <3 sec / no edema','Pulses 1+ / cap refill 3 sec','Pulses 3+ / bounding','Cap refill >3 sec','1+ edema','2+ edema','3+ edema','4+ edema','Other'],
  'Breath sounds':['Clear bilaterally','Crackles','Wheezes','Rhonchi','Diminished','Absent','Stridor','Other'],
  'Respiratory effort':['Unlabored','Tachypneic','Mild retractions','Moderate retractions','Severe retractions','Nasal flaring','Grunting','Apnea','Other'],
  'Oxygen device / flow':['Room air','Nasal cannula','Simple mask','Non-rebreather','Venturi mask','High-flow nasal cannula','CPAP / BiPAP','Mechanical ventilation','Other'],
  'Abdomen':['Soft / non-tender','Soft / tender','Distended','Firm','Rigid','Guarding','Other'],
  'Bowel sounds':['Normoactive ×4','Hypoactive','Hyperactive','Absent','Unable to assess'],
  'Nausea / vomiting':['None','Nausea','Vomiting','Nausea and vomiting'],
  'Mobility / ROM':['Independent / ROM WDL','Assist ×1','Assist ×2','Limited ROM','Bedrest','Unable to assess'],
  'Skin / wounds':['Warm / dry / intact','Pale','Flushed','Diaphoretic','Cool / clammy','Cyanotic','Wound / incision present','Pressure injury present','Other'],
  'IV site':['Left hand','Right hand','Left forearm','Right forearm','Left antecubital','Right antecubital','Other'],
  'IV gauge':['14 g','16 g','18 g','20 g','22 g','24 g','Other'],
  'IV site condition':['Clean / dry / intact','Redness','Swelling','Pain','Infiltration','Phlebitis','Leaking','Other'],
  'Foley present':['No','Yes'],
  'Urine color':['Clear yellow','Pale yellow','Dark yellow / amber','Pink / blood tinged','Red / bloody','Cloudy','Other'],
  'Bed / rails / call light':['Bed low / locked; call light in reach','Bed low / locked; rails ×2; call light in reach','Rails ×4','Needs correction'],
  'Fall precautions / alarm':['Standard precautions','Fall precautions in place','Bed alarm on','Chair alarm on','Not indicated'],
  'ID band':['Verified','Missing','Incorrect / needs correction'],
  'Medication documentation':['Complete','Incomplete','Not applicable'],
  'Report given':['Yes','No','Not yet'],
  'Needs follow-up':['No','Yes'],
  'Pain score / scale':['0 — No pain','1','2','3','4','5','6','7','8','9','10 — Worst pain','FLACC','FACES','Unable to assess'],
  'Fluid':['None / saline lock','Normal saline','Lactated Ringers','D5W','D5 1/2 NS','Other'],
  'Inserted by':['Existing on admission','Student with supervision','RN','Provider','Other'],
  'Other lines / drains':['None','NG / OG tube','JP drain','Chest tube','Central line / PICC','Wound vac','Ostomy','Multiple — describe in abnormal findings','Other'],


  // Pediatric assessment
  'Pain scale (FLACC / FACES / numeric)':['FLACC','FACES','Numeric 0–10','NIPS','Unable to assess'],
  'Behavior':['Appropriate for age','Calm','Playful','Sleeping','Irritable','Restless','Anxious','Lethargic','Difficult to console','Other'],
  'Cry':['No cry / calm','Strong cry','Whimpering','High-pitched cry','Weak cry','Inconsolable','Unable to assess'],
  'Fontanelles':['Soft / flat','Sunken','Bulging','Closed / not palpable','Unable to assess','Not age applicable'],
  'Development appropriate':['Yes','No','Unable to assess'],
  'Feeding type':['Breast','Bottle / formula','Breast and bottle','Regular diet','Clear liquids','NPO','Tube feeding','Other'],
  'Amount / tolerance':['Tolerated well','Fair tolerance','Poor intake','Refused','Emesis after feeding','NPO / not applicable'],
  'Diaper / output':['Wet diaper','Stool diaper','Wet and stool','Dry','Toilet trained / not applicable'],
  'Skin / tone':['Pink / warm / dry / normal tone','Pale','Flushed','Mottled','Cyanotic','Decreased tone','Increased tone','Other'],

  // Mental status assessment
  'Appearance':['Well groomed','Appropriately dressed','Disheveled','Poor hygiene','Bizarre appearance','Other'],
  'Speech':['Normal rate / volume','Pressured','Rapid','Slow','Soft','Loud','Slurred','Mute','Other'],
  'Mood':['Euthymic','Anxious','Depressed','Irritable','Angry','Elevated / euphoric','Fearful','Other'],
  'Affect':['Appropriate / congruent','Flat','Blunted','Restricted','Labile','Incongruent','Other'],
  'Thought process':['Logical / goal directed','Circumstantial','Tangential','Flight of ideas','Disorganized','Thought blocking','Other'],
  'Thought content':['Appropriate','Delusions','Paranoia','Preoccupation','Obsessions','Grandiosity','Other'],
  'Perceptual disturbances':['None','Auditory hallucinations','Visual hallucinations','Tactile hallucinations','Other'],
  'Insight':['Good','Fair','Poor','Absent','Unable to assess'],
  'Judgment':['Intact','Fair','Impaired','Poor','Unable to assess'],
  'Suicide / self-harm assessment':['Denies SI / self-harm','Passive suicidal thoughts','Suicidal ideation without plan','Suicidal ideation with plan','Recent self-harm','Unable to assess'],
  'Harm-to-others assessment':['Denies HI','Homicidal ideation without plan','Homicidal ideation with plan','Threatening behavior','Recent violence','Unable to assess'],

  // Newborn assessment
  'Delivery type':['Spontaneous vaginal delivery','Assisted vaginal delivery','Cesarean section'],
  'GBS':['Negative','Positive — treated','Positive — treatment incomplete','Unknown'],
  'Amniotic fluid':['Clear','Meconium stained','Bloody','Other'],
  'Suction type':['Bulb syringe','Wall suction','DeLee / catheter','None','Other'],
  'Color / consistency':['Clear / thin','White / thin','Bloody','Meconium / thick','Other'],
  'Feeding method':['Breast','Bottle / formula','Breast and bottle','NPO','Other'],
  'Symptoms observed':['None','Jittery','Lethargic','Poor feeding','Apnea','Cyanosis','Hypothermia','Other']
 };
 return baseNativeInput(label,type,options||choices[label]||null);
};
 const baseSummary=renderSummary;renderSummary=function(){baseSummary();[...document.querySelectorAll('.panel')].find(x=>x.querySelector('h2')?.textContent.includes('Recent Chart Activity'))?.remove();};
 const baseSurgery=renderSurgery;renderSurgery=function(){baseSurgery();if(!isFaculty())[...document.querySelectorAll('.panel')].find(x=>x.querySelector('h2')?.textContent==='Scenario Progression')?.remove();};
 const baseFlows=renderFlowsheets;renderFlowsheets=function(){
 baseFlows();document.querySelectorAll('#view details').forEach(d=>d.open=true);
 const fahrenheit=document.getElementById('vTemp');
 if(activePatientId!=='stephanie-smith'||!fahrenheit)return;
 fahrenheit.closest('label').insertAdjacentHTML('beforebegin','<label>Temp °C → °F<input id="vTempC" type="number" step="0.1" placeholder="Enter Celsius"><span class="note">Automatically fills Temp °F</span></label>');
 const celsius=document.getElementById('vTempC');
 celsius.oninput=()=>{const value=celsius.value.trim();fahrenheit.value=value!==''&&Number.isFinite(Number(value))?(Number(value)*9/5+32).toFixed(1):'';};
 fahrenheit.addEventListener('input',()=>{celsius.value='';});
};
 const baseIO=renderIO;renderIO=function(){baseIO();document.querySelectorAll('#view details').forEach(d=>d.open=true);};
 const baseLabs=renderLabs;renderLabs=function(){baseLabs();if(activePatientId==='charles-jones'){document.querySelectorAll('#view .panel').forEach(section=>{const text=section.textContent;if(text.includes('No released laboratory results.')||text.includes('No released diagnostic attachments.'))section.remove();});}};
 const baseMAR=renderMAR;renderMAR=function(){
  if(!isFaculty()&&state.marVisibility[activePatientId]===false){document.getElementById('view').innerHTML=panel('MAR','The MAR is hidden by faculty for this simulation.');return;}
  if(activePatientId==='charles-jones'){renderCharlesMAR();return;}
  baseMAR();
  document.getElementById('view').insertAdjacentHTML('afterbegin',panel('Medication Scanning',`<div class="grid3"><label>Scan Patient Wristband<input id="marPatientScan" placeholder="MRN / wristband barcode"></label><label>Scan Medication<input id="marMedicationScan" placeholder="Medication barcode"></label><label>Due Shift<select id="marShift"><option>Shift 1 — Day</option><option>Shift 2 — Night</option><option>Shift 3 — Day</option><option>Shift 4 — Night</option></select></label><label>Pre-administration Assessment<input id="marPreAssessment" placeholder="Vitals, labs, pain, indication"></label><label>Patient Education<input id="marEducation" placeholder="Education provided"></label><label>Allergy Check<select id="marAllergyCheck"><option>Verified—no conflict</option><option>Potential conflict—do not administer</option></select></label></div><div class="actions"><button id="verifyMarScan" class="primary">Verify Patient & Medication</button></div><div id="marScanResult" class="note" role="status"></div>`));
  verifyMarScan.onclick=()=>{const valid=marPatientScan.value.trim()===String(activePatient().mrn)&&marMedicationScan.value.trim();marScanResult.className=valid?'success':'warn';marScanResult.textContent=valid?'Scan verified. Complete pre-assessment, education, and administration documentation below.':'Patient wristband or medication barcode does not match.';};
  const saveMar=document.getElementById('saveMarAdministration'),baseSave=saveMar?.onclick;if(saveMar&&baseSave)saveMar.onclick=()=>{const before=state.mar.length;baseSave();if(state.mar.length>before){const row=state.mar[state.mar.length-1];row.patientBarcode=marPatientScan.value.trim();row.medicationBarcode=marMedicationScan.value.trim();row.shift=marShift.value;row.preAssessment=marPreAssessment.value.trim();row.education=marEducation.value.trim();row.allergyCheck=marAllergyCheck.value;save();}};
 };
 const baseFaculty=renderFaculty;renderFaculty=function(){
  baseFaculty();if(!isFaculty()||!activePatient())return;
  const patient=activePatient(),profileFields=[['name','Patient Name'],['mrn','MRN'],['dob','Date of Birth'],['age','Age'],['sex','Sex'],['room','Room'],['provider','Provider'],['weightKg','Weight (kg)'],['bloodType','Blood Type'],['codeStatus','Code Status'],['primaryDiagnosis','Primary Diagnosis'],['allergies','Allergies (comma separated)']];
  document.getElementById('view').insertAdjacentHTML('beforeend',panel('Editable Patient Profile',`<div class="note">Correct demographics, identifiers, diagnosis, provider, allergies, and other patient details. Changes save to this chart.</div><div class="grid3">${profileFields.map(([key,label])=>`<label>${label}${key==='primaryDiagnosis'?`<textarea data-profile-field="${key}">${esc(patient[key]||'')}</textarea>`:`<input data-profile-field="${key}" value="${esc(key==='allergies'?(patient.allergies||[]).join(', '):patient[key]??'')}">`}</label>`).join('')}${profileDetailFields(Object.fromEntries(Object.entries(patient).filter(([key])=>!['id',...profileFields.map(x=>x[0])].includes(key))))}</div><div class="actions"><button id="savePatientProfile" class="primary">Save Patient Profile</button></div>`));
  document.getElementById('view').insertAdjacentHTML('beforeend',panel('Add Editable Chart Section',`<div class="grid3"><label>Title<input id="newChartTitle" placeholder="Section title"></label><label>Section<select id="newChartCategory">${['summary','notes','prenatal','labor','surgery','assessments','flowsheets','io','orders','labs','mar','documents'].map(c=>`<option>${c}</option>`).join('')}</select></label><label>Status<select id="newChartStatus"><option>released</option><option>pending</option></select></label><label class="wide">Content<textarea id="newChartContent" placeholder="Enter the chart content"></textarea></label></div><div class="actions"><button id="addChartSection" class="primary">Add Chart Section</button></div>`));
  const editablePending=(state.releaseQueue||[]).filter(x=>x.patientId===activePatientId&&x.status==='pending');
  document.getElementById('view').insertAdjacentHTML('beforeend',panel('Edit Pending Releases',`<div class="note">Correct any pending order, lab, diagnostic result, MAR sheet, or message before releasing it.</div>${editablePending.map(item=>`<div class="releaseCard" data-edit-pending="${esc(item.id)}"><div class="grid3"><label>Title<input class="pendingTitle" value="${esc(item.title||'')}"></label><label>Type<select class="pendingKind">${['order','result','message','mar','chartdata'].map(k=>`<option ${item.kind===k?'selected':''}>${k}</option>`).join('')}</select></label><label>Destination Tab<select class="pendingTarget">${['','orders','labs','mar','medicationCatalog','notes','vitals','io','assessments','laborProgress','postpartumRecovery','bloodAdministration','surgery'].map(k=>`<option value="${k}" ${(item.targetCollection||'')===k?'selected':''}>${k==='medicationCatalog'?'MAR / Medication':(k||'Automatic')}</option>`).join('')}</select></label><label>Provider<input class="pendingProvider" value="${esc(item.provider||'')}"></label><label>Category<input class="pendingCategory" value="${esc(item.orderType||item.resultType||'')}"></label><label>Result Flag<select class="pendingFlag">${['Normal','High','Low','Critical','Abnormal'].map(k=>`<option ${item.flag===k?'selected':''}>${k}</option>`).join('')}</select></label><label class="wide">Content<textarea class="pendingContent">${esc(item.content||'')}</textarea></label></div><div class="actions"><button class="primary pendingSave">Save Changes</button><button class="secondary pendingRelease">Release to Student</button><button class="danger pendingDelete">Delete</button></div></div>`).join('')||'<div class="note">No pending items for this patient.</div>'}`));
  const pendingEditor=[...document.querySelectorAll('#view .panel')].find(x=>x.querySelector('h2')?.textContent==='Edit Pending Releases');
  const actionPanels=[...document.querySelectorAll('#view .panel')];
  const lastPendingPanel=actionPanels.find(x=>x.querySelector('h2')?.textContent?.startsWith('Other Pending Releases'));
  if(pendingEditor&&lastPendingPanel)lastPendingPanel.insertAdjacentElement('afterend',pendingEditor);
  const records=CHART_RECORDS.filter(r=>r.patientId===activePatientId);
  document.getElementById('view').insertAdjacentHTML('beforeend',panel('Editable Chart Content',`<div class="actions"><label style="display:flex;align-items:center;gap:8px"><input id="facultyMarVisible" type="checkbox" style="width:auto" ${state.marVisibility[activePatientId]!==false?'checked':''}> Show MAR to students</label></div><div class="note">Edit, pend, release, or delete any content area for this patient.</div>${records.map(r=>`<div class="releaseCard" data-admin-record="${esc(r.id)}"><div class="grid3"><label>Title<input class="adminTitle" value="${esc(r.title)}"></label><label>Section<select class="adminCategory">${['summary','notes','prenatal','labor','surgery','assessments','flowsheets','io','orders','labs','mar','documents'].map(c=>`<option ${c===r.category?'selected':''}>${c}</option>`).join('')}</select></label><label>Status<select class="adminStatus"><option ${r.status==='released'?'selected':''}>released</option><option ${r.status==='pending'?'selected':''}>pending</option></select></label><label class="wide">Content<textarea class="adminContent">${esc(r.content)}</textarea></label></div><div class="actions"><button class="primary adminSave">Save Edit</button><button class="secondary adminPend">Make Pending</button><button class="secondary adminRelease">Release</button><button class="danger adminDelete">Delete</button></div></div>`).join('')||'<div class="note">No imported content areas for this patient.</div>'}`));
  const liveCollections=['medicationCatalog','bloodUnits','orders','labs','notes','vitals','io','assessments','mar','laborProgress','postpartumRecovery','pphPads','pphMedications','bloodAdministration','surgicalChecklist','surgicalAssessments','messages','notifications','diagnosticFiles','labPanels'];
  const liveRows=liveCollections.flatMap(collection=>(state[collection]||[]).filter(row=>row.patientId===activePatientId).map(row=>({collection,row})));
  document.getElementById('view').insertAdjacentHTML('beforeend',panel('Editable Live Data',`<div class="note">Change the wording or values below. Faculty can save, make an entry pending, or delete it—no coding is required.</div>${liveRows.map(({collection,row})=>`<div class="releaseCard" data-live-collection="${collection}" data-live-id="${esc(row.id)}"><b>${esc(collection.replace(/([A-Z])/g,' $1'))}</b><div class="grid3" style="margin-top:8px">${liveFieldEditor(row)}</div><div class="actions"><button class="primary liveSaveRow">Save Changes</button><button class="secondary livePendRow">Make Pending</button><button class="danger liveDeleteRow">Delete</button></div></div>`).join('')||'<div class="note">No live entries have been charted for this patient.</div>'}`));
  facultyMarVisible.onchange=()=>{state.marVisibility[activePatientId]=facultyMarVisible.checked;liveSave('mar_visibility_changed',{patientId:activePatientId});};
  const simulationActions=[...document.querySelectorAll('#view .panel')].find(x=>x.querySelector('h2')?.textContent==='Simulation Controls')?.querySelector('.actions');if(simulationActions)simulationActions.insertAdjacentHTML('afterbegin',`<button id="saveSimulationBase" class="primary">Save as Base Patient</button>`);
  if(document.getElementById('saveSimulationBase'))saveSimulationBase.onclick=()=>{if(!confirm('Save the current chart as this patient’s new simulation starting point? Future resets will return to this exact base.'))return;state.simulationBases[activePatientId]=captureSimulationBase(activePatientId);liveSave('simulation_base_saved',{patientId:activePatientId});alert('Base patient saved. Future resets will keep these corrections.');renderFaculty();};
  const resetButton=document.getElementById('resetPatient');if(resetButton){resetButton.textContent='Reset to Simulation Start';resetButton.onclick=()=>{if(!state.simulationBases[activePatientId]){alert('Save this chart as the Base Patient first.');return}if(!confirm('Reset this patient? Student-entered charting will be deleted, and starting orders, labs, and diagnostics will return to pending.'))return;if(!restoreSimulationBase(activePatientId))return;liveSave('simulation_reset',{patientId:activePatientId});renderFaculty();};}
  savePatientProfile.onclick=()=>{for(const [key] of profileFields){const value=document.querySelector(`[data-profile-field="${key}"]`).value.trim();patient[key]=key==='allergies'?value.split(',').map(x=>x.trim()).filter(Boolean):key==='weightKg'&&value!==''?Number(value):value;}for(const input of document.querySelectorAll('[data-extra-path]')){const path=JSON.parse(input.dataset.extraPath);let object=patient;for(const key of path.slice(0,-1))object=object[key];const key=path[path.length-1],original=object[key];object[key]=typeof original==='number'&&input.value!==''?Number(input.value):typeof original==='boolean'?input.value==='true':input.value;}save();renderFaculty();};
  addChartSection.onclick=()=>{const title=newChartTitle.value.trim(),content=compactContent(newChartContent.value);if(!title){alert('Enter a section title.');return}const record={id:uid('faculty-record'),patientId:activePatientId,title,category:newChartCategory.value,status:newChartStatus.value,content};CHART_RECORDS.push(record);state.customChartRecords.push({...record});state.chartContentEdits[record.id]={title:record.title,category:record.category,status:record.status,content:record.content};if(record.status==='pending')queueRelease(record.category==='orders'?'order':record.category==='mar'?'mar':'result',record.patientId,record.title,record.content,{chartRecordId:record.id});liveSave('chart_content_created',{patientId:activePatientId,recordId:record.id});renderFaculty();};
  document.querySelectorAll('[data-edit-pending]').forEach(card=>{const id=card.dataset.editPending,getItem=()=>state.releaseQueue.find(x=>x.id===id);card.querySelector('.pendingSave').onclick=()=>{const item=getItem(),category=card.querySelector('.pendingCategory').value.trim(),targetCollection=card.querySelector('.pendingTarget').value;Object.assign(item,{title:card.querySelector('.pendingTitle').value.trim(),kind:card.querySelector('.pendingKind').value,targetCollection,provider:card.querySelector('.pendingProvider').value.trim(),orderType:item.kind==='order'?category:item.orderType,resultType:item.kind==='result'?category:item.resultType,flag:card.querySelector('.pendingFlag').value,content:compactContent(facultyEditorValue(card.querySelector('.pendingContent')))});if(item.chartRecordId){const record=CHART_RECORDS.find(x=>x.id===item.chartRecordId);if(record){Object.assign(record,{title:item.title,content:item.content});if(['orders','labs','mar','notes','flowsheets','io','assessments','labor','surgery'].includes(targetCollection))record.category=targetCollection==='vitals'?'flowsheets':targetCollection;state.chartContentEdits[record.id]={title:record.title,category:record.category,status:'pending',content:record.content};const custom=state.customChartRecords.find(x=>x.id===record.id);if(custom)Object.assign(custom,record);}}liveSave('pending_item_changed',{patientId:activePatientId,itemId:id});renderFaculty();};card.querySelector('.pendingRelease').onclick=()=>{releaseItem(id);renderFaculty();};card.querySelector('.pendingDelete').onclick=()=>{if(!confirm('Delete this pending item?'))return;const item=getItem();if(item?.chartRecordId){const record=CHART_RECORDS.find(x=>x.id===item.chartRecordId);if(record){CHART_RECORDS.splice(CHART_RECORDS.indexOf(record),1);delete state.chartContentEdits[record.id];state.customChartRecords=state.customChartRecords.filter(x=>x.id!==record.id);}}state.releaseQueue=state.releaseQueue.filter(x=>x.id!==id);liveSave('pending_item_deleted',{patientId:activePatientId,itemId:id});renderFaculty();};});
  document.querySelectorAll('[data-admin-record]').forEach(card=>{const id=card.dataset.adminRecord,record=CHART_RECORDS.find(r=>r.id===id);if(record.category==='mar')card.querySelector('.actions').insertAdjacentHTML('afterbegin',`<label style="display:flex;align-items:center;gap:6px"><input class="marSheetVisible" type="checkbox" style="width:auto" ${!state.marHiddenRecords[id]?'checked':''}> Visible to students</label>`);const visibility=card.querySelector('.marSheetVisible');if(visibility)visibility.onchange=()=>{state.marHiddenRecords[id]=!visibility.checked;liveSave('mar_sheet_visibility_changed',{patientId:activePatientId,recordId:id});};const persist=status=>{Object.assign(record,{title:card.querySelector('.adminTitle').value.trim(),category:card.querySelector('.adminCategory').value,status:status||card.querySelector('.adminStatus').value,content:compactContent(facultyEditorValue(card.querySelector('.adminContent')))});state.chartContentEdits[id]={title:record.title,category:record.category,status:record.status,content:record.content};const custom=state.customChartRecords.find(x=>x.id===id);if(custom)Object.assign(custom,record);let q=(state.releaseQueue||[]).find(x=>x.chartRecordId===id);if(record.status==='pending'){if(!q){q=queueRelease(record.category==='orders'?'order':record.category==='mar'?'mar':'result',record.patientId,record.title,record.content,{chartRecordId:id});}q.status='pending';q.title=record.title;q.content=record.content;}else if(q&&q.status==='pending')releaseItem(q.id);liveSave('chart_content_changed',{patientId:record.patientId,recordId:id});renderFaculty();};card.querySelector('.adminSave').onclick=()=>persist();card.querySelector('.adminPend').onclick=()=>persist('pending');card.querySelector('.adminRelease').onclick=()=>persist('released');card.querySelector('.adminDelete').onclick=()=>{if(!confirm(`Delete ${record.title}?`))return;CHART_RECORDS.splice(CHART_RECORDS.indexOf(record),1);state.customChartRecords=state.customChartRecords.filter(x=>x.id!==id);delete state.chartContentEdits[id];state.releaseQueue=(state.releaseQueue||[]).filter(x=>x.chartRecordId!==id);liveSave('chart_content_deleted',{patientId:activePatientId,recordId:id});renderFaculty();};});
  document.querySelectorAll('[data-live-collection]').forEach(card=>{const collection=card.dataset.liveCollection,id=card.dataset.liveId;const getRow=()=>state[collection].find(x=>x.id===id),savePlainFields=()=>{const row=getRow();for(const input of card.querySelectorAll('[data-live-field]')){const key=input.dataset.liveField,original=row[key],value=facultyEditorValue(input);row[key]=typeof original==='number'&&value!==''?Number(value):typeof original==='boolean'?value==='true':value;}return row;};card.querySelector('.liveSaveRow').onclick=()=>{savePlainFields();liveSave('live_content_changed',{patientId:activePatientId,collection,id});renderFaculty();};card.querySelector('.liveDeleteRow').onclick=()=>{if(!confirm('Delete this chart entry?'))return;state[collection]=state[collection].filter(x=>x.id!==id);save();renderFaculty();};card.querySelector('.livePendRow').onclick=()=>{const row={...savePlainFields()},title=row.test||row.medication||row.text||row.type||`${collection} entry`,content=row.result||row.text||row.medication||row.narrative||row.message||row.notes||title;state[collection]=state[collection].filter(x=>x.id!==id);queueRelease('chartdata',activePatientId,title,content,{targetCollection:collection,rowData:row});renderFaculty();};});
  prepareFacultyTextEditors();
 };
 const baseMenu=applyPatientMenu;applyPatientMenu=function(){baseMenu();document.querySelector('[data-view="labor"]')?.classList.toggle('hiddenByPatient',activePatientId==='baby-boy-sung'||!((PATIENT_SPECIALTY_VIEWS[activePatientId]||[]).includes('labor')));};
 const baseAppendImported=appendImportedForView;appendImportedForView=function(view){if(activePatientId==='charles-jones'&&view==='mar')return;baseAppendImported(view);};
 const baseRender=render;render=function(){baseRender();compactRenderedView();};
};
})();

