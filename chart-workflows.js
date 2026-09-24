/* Native chart documentation; all entries stay with the selected simulation patient. */
function renderChartDoc(value){
 const tokens=[];
 const token=html=>`CHARTTOKEN${tokens.push(html)-1}END`;
 let source=String(value||'').replace(/<\/?(?:p|li)[^>]*>/gi,'\n').replace(/<br\s*\/?>/gi,'\n').replace(/!\[([^\]]*)\]\((assets\/[A-Za-z0-9_.\/-]+)\)/g,(_,alt,path)=>token(`<a href="${esc(path)}" target="_blank" rel="noopener"><img src="${esc(path)}" alt="${esc(alt||'Patient chart attachment')}" loading="lazy" style="display:block;max-width:100%;max-height:800px;object-fit:contain;margin:12px auto"></a>`));
 source=source.replace(/\[([^\]]+)\]\((assets\/[A-Za-z0-9_.\/-]+|https:\/\/[^\s)]+)\)/g,(_,label,url)=>token(`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`));
 let html=legacyRenderChartDoc(source).replace(/(^|<br>)#\s+([^<]+)/g,'$1<h3>$2</h3>');
 return html.replace(/CHARTTOKEN(\d+)END/g,(_,i)=>tokens[Number(i)]||'');
}
// Preserve order boundaries in imported records and released multiline orders.
function renderOrderContent(value){
 const source=String(value||'').replace(/<br\s*\/?>/gi,'\n')
  .replace(/<\/?(?:p|li|ul|ol|div)[^>]*>/gi,'\n')
  .replace(/([^\n])\s+(?=[-•]\s+[A-Za-z])/g,'$1\n')
  .replace(/([^\n])\s+(?=\d+\.\s+[A-Z])/g,'$1\n');
 if(/<table\b/i.test(source))return renderChartDoc(source);
 return source.split(/\r?\n/).map(line=>line.trim()).filter(Boolean)
  .map(line=>`<div class="orderLine" style="display:block;margin:0 0 6px">${renderChartDoc(line.replace(/^[-•]\s*/,''))}</div>`).join('');
}
function chartRecordCards(records){
 return records.map((r,i)=>{
  const editable=['assessments','flowsheets','io'].includes(r.category)&&/_{3,}|<td>\s*<\/td>|\[ \]/.test(r.content);
  let body=r.category==='orders'?renderOrderContent(r.content):['summary','notes'].includes(r.category)&&!/<table\b/i.test(r.content)?r.content.split(/\n\s*\n/).filter(x=>x.trim()).map(text=>`<section class="chartTextSection" style="margin:0 0 12px;padding:8px;border-bottom:1px solid #d5dfe4">${renderChartDoc(text)}</section>`).join(''):renderChartDoc(r.content),n=0;
  if(editable){
   body=body.replace(/_{3,}/g,()=>`<input aria-label="Response ${++n} in ${esc(r.title)}" name="field-${n}" style="display:inline-block;width:130px;margin:3px">`)
    .replace(/☐|☑/g,()=>`<input type="checkbox" aria-label="Selection ${++n} in ${esc(r.title)}" name="field-${n}" style="width:auto">`)
    .replace(/<td>\s*<\/td>/g,()=>`<td><input aria-label="Table entry ${++n} in ${esc(r.title)}" name="field-${n}"></td>`);
   body=`<form class="recordEntry" data-record="${esc(r.id)}"><label>Student / Initials<input name="student" required></label><label>Shift<input name="shift" required></label>${body}<button type="submit" class="primary">Save ${esc(r.title)}</button><span class="entryFeedback" role="status"></span></form>`;
  }
  const entries=(state.chartEntries||[]).filter(e=>e.patientId===activePatientId&&e.recordId===r.id);
  const history=entries.map(e=>`<details><summary>${esc(e.time)} • ${esc(e.student)} • ${esc(e.shift)}</summary>${e.snapshot||renderEntryValues(e.values)}</details>`).join('');
  return `<details class="chartRecord" ${r.category==='summary'||i===0?'open':''}><summary>${esc(r.title)}</summary><div class="chartRecordBody">${body}${history}</div></details>`;
 }).join('');
}
function renderEntryValues(values){return `<dl>${Object.entries(values||{}).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;}
function nativeInput(label,type='text',options=null){
 return `<label>${esc(label)}${options?`<select name="${esc(label)}"><option value="">Select…</option>${options.map(v=>`<option>${esc(v)}</option>`).join('')}</select>`:type==='textarea'?`<textarea name="${esc(label)}"></textarea>`:`<input name="${esc(label)}" type="${type}" ${type==='number'?'step="any"':''}>`}</label>`;
}
function nativeSection(title,fields){return `<fieldset><legend>${esc(title)}</legend><div class="grid3">${fields.map(f=>Array.isArray(f)?nativeInput(...f):nativeInput(f)).join('')}</div></fieldset>`;}
function nativeForm(id,title,sections){
 const entries=(state.chartEntries||[]).filter(e=>e.patientId===activePatientId&&e.recordId===id);
 return panel(title,`<form class="nativeEntry" data-record="${id}"><div class="grid3"><label>Student / Initials<input name="student" required></label><label>Shift<input name="shift" required></label><label>Date/Time<input type="datetime-local" name="time" value="${nowLocal()}" required></label></div>${sections}<button class="primary" type="submit">Save ${esc(title)}</button><span class="entryFeedback" role="status"></span></form><div class="nativeHistory">${entries.slice().reverse().map(e=>`<details><summary>${esc(e.time)} • ${esc(e.student)} • ${esc(e.shift)}</summary>${renderEntryValues(e.values)}</details>`).join('')}</div>`);
}
function nativeAssessmentForms(){
 const p=activePatientId;let html='';
 if(p==='baby-boy-sung'){
  let apgar='';
  for(const minute of [1,5,10])apgar+=nativeSection(`Apgar — ${minute} minute`,['Appearance','Pulse','Grimace','Activity','Respiration'].map(k=>[`${minute} min ${k}`,'text',['0','1','2']]))+`<output data-score="apgar-${minute}">Total: —</output>`;
  html+=nativeForm('newborn-assessment','Newborn Assessment',
   nativeSection('Delivery',['Delivery type','Time of birth','Gestational age','Rupture of membranes time','GBS','Amniotic fluid',['Complications','textarea']])+apgar+
   nativeSection('Measurements & Vitals',['Weight (kg)','Weight (lb/oz)','Length (cm)','Length (in)','Head circumference (cm)','Chest circumference (cm)','Temperature','Heart rate','Respiratory rate','SpO₂'])+
   nativeSection('Resuscitation & Suction',[['Interventions performed','textarea'],'Time initiated',['Response / outcome','textarea'],'Suction type','Amount suctioned','Color / consistency','Number of passes','Time suctioned'])+
   nativeSection('Birth Injury',[['Clavicle / brachial plexus / Moro / arm movement findings','textarea'],['Other findings','textarea']])+
   nativeSection('Ballard Observed Scores',['Posture','Square window','Arm recoil','Popliteal angle','Scarf sign','Heel to ear','Skin','Lanugo','Plantar surface','Breast','Eye / ear','Genitals'].map(k=>[k,'number']))+'<output data-score="ballard">Ballard total: —</output>'+nativeSection('Clinical assessment',['Assessed gestational age (weeks)',['Clinical notes','textarea']]));
  html+=nativeForm('newborn-glucose','Newborn Glucose & Feeding Record',nativeSection('Monitoring',['Blood glucose (mg/dL)','Time checked','Feeding method','Feeding amount','Symptoms observed','Glucose gel dose administered (mL)','Dose number','Administration time','Repeat glucose (mg/dL)','Repeat time','Provider notified / time','IV glucose / time',['Response and follow-up','textarea']]));
 }
 if(['molly-thomas','stephanie-smith'].includes(p)){
  html+=nativeForm('pediatric-assessment','Pediatric Assessment',nativeSection('Development, Pain & Feeding',['Pain scale (FLACC / FACES / numeric)','Pain score','Behavior','Cry','Fontanelles','Development appropriate','Feeding type','Amount / tolerance','Diaper / output','Urine color','Skin / tone',['Escalation and follow-up','textarea']]));
 }
 if(p==='david-carter')html+=nativeForm('mental-status','Mental Status Assessment',nativeSection('Mental status',['Appearance','Behavior','Speech','Mood','Affect','Orientation','Thought process','Thought content','Perceptual disturbances','Insight','Judgment','Suicide / self-harm assessment','Harm-to-others assessment',['Safety interventions','textarea'],['Narrative','textarea']]));
 html+=nativeForm('detailed-head-to-toe','Detailed Head-to-Toe Assessment',
 nativeSection('Vitals & Pain',['Temperature','Heart rate','Respiratory rate','Blood pressure','SpO₂','Pain score / scale'])+
 nativeSection('Systems',['Orientation','Level of consciousness','Pupils / speech','Cardiac rhythm','Pulses / capillary refill / edema','Breath sounds','Respiratory effort','Oxygen device / flow','Abdomen','Bowel sounds','Nausea / vomiting','Last bowel movement','Mobility / ROM','Skin / wounds'])+
 nativeSection('IV & Foley',['IV site','IV gauge','IV site condition','Fluid','Rate (mL/hr)','Foley present','French size','Balloon volume','Inserted by','Urine color','Urine output (mL)','Other lines / drains'])+
 nativeSection('Safety & Handoff',['Bed / rails / call light','Fall precautions / alarm','ID band','Medication documentation','Report given','Needs follow-up',['Abnormal findings and interventions','textarea']]));
 return html;
}
function updateNativeScores(form){
 const val=name=>form.elements.namedItem(name)?.value??'';
 const sum=names=>names.every(n=>val(n)!==''&&Number.isFinite(Number(val(n))))?names.reduce((s,n)=>s+Number(val(n)),0):'—';
 for(const m of [1,5,10]){const out=form.querySelector(`[data-score="apgar-${m}"]`);if(out)out.textContent='Total: '+sum(['Appearance','Pulse','Grimace','Activity','Respiration'].map(k=>`${m} min ${k}`));}
 const ballard=form.querySelector('[data-score="ballard"]');if(ballard)ballard.textContent='Ballard total: '+sum(['Posture','Square window','Arm recoil','Popliteal angle','Scarf sign','Heel to ear','Skin','Lanugo','Plantar surface','Breast','Eye / ear','Genitals']);
}
function initializeNativeCharts(){
 state.chartEntries ||= [];
 const baseAssessments=renderAssessments;
 renderAssessments=function(){baseAssessments();if(activePatient())document.getElementById('view').insertAdjacentHTML('afterbegin',nativeAssessmentForms());};
 document.addEventListener('input',event=>{const form=event.target.closest('.nativeEntry');if(form)updateNativeScores(form);});
 document.addEventListener('submit',event=>{
  const form=event.target;if(!form.matches('.nativeEntry,.recordEntry'))return;event.preventDefault();
  if(!activePatient()||!form.reportValidity())return;
  const values={};for(const el of form.elements){if(el.name)values[el.name]=el.type==='checkbox'?(el.checked?'Yes':'No'):el.value;}
  if(!values.student?.trim()||!values.shift?.trim())return;
  updateNativeScores(form);form.querySelectorAll('output').forEach(o=>values[o.dataset.score]=o.textContent);
  let snapshot='';if(form.matches('.recordEntry')){const copy=form.cloneNode(true);copy.querySelectorAll('input,select,textarea').forEach(el=>{const span=document.createElement('span');span.textContent=values[el.name]||'—';el.replaceWith(span);});copy.querySelectorAll('button,.entryFeedback').forEach(el=>el.remove());snapshot=copy.innerHTML;}
  state.chartEntries ||= [];state.chartEntries.push({id:uid('chart-entry'),patientId:activePatientId,recordId:form.dataset.record,time:values.time||nowLocal(),student:values.student.trim(),shift:values.shift.trim(),values,snapshot});
  audit('Chart form signed',activePatientId,`${values.student}: ${form.dataset.record}`);liveSave('chart_form_saved',{patientId:activePatientId});
  const history=document.createElement('details');history.open=true;history.innerHTML=`<summary>Saved • ${esc(values.student)} • ${esc(values.shift)}</summary>${snapshot||renderEntryValues(values)}`;form.after(history);form.reset();form.querySelector('.entryFeedback').textContent=' Saved to this patient’s chart.';
 });
}

