/* Session-scoped faculty authoring. Pending items appear in clinical tabs only after release. */
(function(){
 const esc=U.esc,clone=value=>JSON.parse(JSON.stringify(value));
 const field=(name,label,value='',multiline=false)=>`<label class="field"><span>${esc(label)}</span>${multiline?`<textarea name="${name}" rows="4">${esc(value)}</textarea>`:`<input name="${name}" value="${esc(value)}">`}</label>`;
 function saveEvent(pid,event,api){
  if(!Store.instructorUnlocked()||!Shared.on())return false;
  Shared.saveScenarioEvent(pid,event).then(()=>{
   UI.toast('Saved for this simulation session.');if(api)api.close();App.render();
  }).catch(error=>{if(api)UI.formError(api.el.querySelector('.modal-body'),error.message);else UI.toast(error.message||'The scenario release could not be saved.','error');});
  return false;
 }
 function objectEditor(title,draft,onSave){
  const fields=[];
  const names={t:'Test',v:'Result',u:'Units',ref:'Reference range',by:'Provider',freq:'Frequency',cat:'Category',meds:'Medications',labs:'Laboratory',instructorNotes:'Instructor notes',group:'Shift / scenario stage'};
  function inputs(object,context=''){
   return Object.entries(object).map(([key,value])=>{
    if(key==='text'&&typeof object.md==='string')return '';
    if(['id','includes','images','attachment','aka','discontinue','hold','activate','patch','revision','time','day','at','isNew','eventId','facultyGuide','instructorGuide','instructorNotes','facultyNotes'].includes(key))return '';
    const label=(context?context+' · ':'')+(names[key]||key.replace(/([A-Z])/g,' $1'));
    if(Array.isArray(value))return value.map((v,i)=>v&&typeof v==='object'?inputs(v,label+' '+(i+1)):'').join('');
    if(value&&typeof value==='object')return inputs(value,label);
    if(!['string','number','boolean'].includes(typeof value))return '';
    const name='edit-'+fields.length;fields.push({object,key,name,type:typeof value});
    return typeof value==='boolean'?`<label class="check"><input type="checkbox" name="${name}" ${value?'checked':''}>${esc(label)}</label>`:field(name,label,value,/text|notes|instructions|md/i.test(key));
   }).join('');
  }
  UI.modal({title,wide:true,body:`<p class="muted small">Changes apply to this patient for this simulation session.</p>${inputs(draft)}`,buttons:[{label:'Cancel'},{label:'Save Changes',cls:'btn-primary',onClick(api){
   const values=U.formValues(api.el);
   for(const item of fields){const value=values[item.name];if(item.type==='number'&&(!String(value).trim()||!Number.isFinite(Number(value)))){UI.formError(api.el.querySelector('.modal-body'),'Enter a valid number for '+item.key+'.');return false;}item.object[item.key]=item.type==='boolean'?!!value:item.type==='number'?Number(value):value;}
   if('title' in draft&&!draft.title.trim()){UI.formError(api.el.querySelector('.modal-body'),'Enter a title.');return false;}
   return onSave(draft,api);
  }}]});
 }
 window.FacultySession={
  add(pid){
   if(!Store.instructorUnlocked())return;
   const patient=Model.get(pid),editor=Views.orders.editor;
   const groups=[...new Set((Model.base(pid).events||[]).map(e=>e.group).filter(Boolean))];
   let attachment=null,loading=false;
   UI.modal({title:'Add Pending Chart Item',wide:true,
    body:`<p class="muted small">Release this item from this patient’s faculty controls when students should see it.</p>${field('title','Release title')}
     <label class="field"><span>Shift / scenario stage</span><input name="group" list="release-groups" value="Session additions"><datalist id="release-groups">${groups.map(g=>`<option value="${esc(g)}">`).join('')}</datalist></label>
     <label class="field"><span>Destination</span><select name="destination"><option value="order">Orders / Medication MAR</option><option value="lab">Diagnostics — Laboratory</option><option value="imaging">Diagnostics — Imaging</option><option value="note">Provider Notes</option><option value="document">Other Clinical — Documents</option></select></label>
     <div data-order-fields>${editor.render(patient,{cat:'Medication'})}</div>
     <div data-content-fields hidden>${field('content','Report / note text','',true)}</div>
     <div data-lab-fields hidden><div class="form-grid">${field('test','Test name')}${field('value','Result')}${field('unit','Units')}${field('reference','Reference range')}</div></div>
     <div data-file-fields hidden><label class="field"><span>Attach image or document (optional)</span><input name="attachment" type="file" accept="image/png,image/jpeg,image/webp,application/pdf,.docx"></label><p class="small muted" data-file-status></p></div>`,
    onOpen(api){editor.bind(api.el);api.el.querySelector('[name=destination]').onchange=e=>{
     const type=e.target.value;api.el.querySelector('[data-order-fields]').hidden=type!=='order';api.el.querySelector('[data-lab-fields]').hidden=type!=='lab';api.el.querySelector('[data-content-fields]').hidden=type==='order'||type==='lab';api.el.querySelector('[data-file-fields]').hidden=!['imaging','document'].includes(type);
    };
    api.el.querySelector('[name=attachment]').onchange=e=>{
     attachment=null;const f=e.target.files[0],status=api.el.querySelector('[data-file-status]');if(!f){status.textContent='';return;}
     const allowed=['image/png','image/jpeg','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
     if(!allowed.includes(f.type)||f.size>2*1024*1024){status.textContent='Choose a PNG, JPEG, WebP, PDF, or DOCX file up to 2 MB for this local preview.';e.target.value='';return;}
     loading=true;status.textContent='Reading attachment…';const reader=new FileReader();reader.onload=()=>{loading=false;attachment={name:f.name,type:f.type,data:reader.result};status.textContent=f.name+' ready.';};reader.onerror=()=>{loading=false;status.textContent='The file could not be read.';};reader.readAsDataURL(f);
    };},
    buttons:[{label:'Cancel'},{label:'Save Pending',cls:'btn-primary',onClick(api){
     const v=U.formValues(api.el),id='session-'+U.uid();const fail=m=>{UI.formError(api.el.querySelector('.modal-body'),m);return false;};
     if(loading)return fail('Wait for the attachment to finish loading.');if(!v.title.trim())return fail('Enter a release title.');
     const event={id,title:v.title.trim(),group:v.group.trim()||'Session additions'};
     if(v.destination==='order'){
      const result=editor.read(api.el);if(result.error)return fail(result.error);const order=result.order;
      if(order.med)event.meds=[Model.enteredMed(Object.assign({id:id+'-med'},order))];else event.orders=[{id:id+'-order',cat:order.cat,text:order.text,by:order.provider,priority:order.priority,at:0}];
     }else if(v.destination==='lab'){
      if(!v.test.trim()||!v.value.trim())return fail('Enter a test name and result.');event.labs=[{id:id+'-lab',panel:v.title,at:0,results:[{t:v.test.trim(),v:v.value.trim(),u:v.unit,ref:v.reference}]}];
     }else{
      if(!v.content.trim()&&!attachment)return fail('Enter chart text or attach a file.');
      const item={id:id+'-content',at:0,text:v.content.trim()};if(attachment&&['document','imaging'].includes(v.destination))item.attachment=attachment;
      if(v.destination==='imaging')event.imaging=[Object.assign(item,{study:v.title})];
      if(v.destination==='note')event.notes=[Object.assign(item,{title:v.title,type:'Provider Note',author:patient.attending})];
      if(v.destination==='document')event.documents=[Object.assign(item,{title:v.title,category:'documents',md:v.content.trim()})];
     }
     return saveEvent(pid,event,api);
    }}]});
  },
  edit(pid,id){
   if(!Store.instructorUnlocked()||Store.released(pid)[id])return;
   const event=(Model.base(pid).events||[]).find(e=>e.id===id);if(!event)return;
   objectEditor('Edit Pending Release',clone(event),(draft,api)=>{if(Store.released(pid)[id]){UI.formError(api.el.querySelector('.modal-body'),'This item was released. Edit it from the chart.');return false;}return saveEvent(pid,draft,api);});
  },
  correct(pid,section,id){
   if(!Store.instructorUnlocked()||!['labs','imaging','documents','notes'].includes(section))return;
   const base=Model.base(pid),live=(Model.get(pid)[section]||[]).find(x=>x.id===id);if(!live)return;
   const event=live.eventId?(base.events||[]).find(e=>e.id===live.eventId):null;
   const source=((event||base)[section]||[]).find(x=>x.id===id);if(!source)return;
   objectEditor('Correct Chart Entry',clone(source),(draft,api)=>{
    const current=Model.get(pid);if(!(current[section]||[]).some(x=>x.id===id))return false;
    draft.isNew=true;
    if(event){
     const updated=clone(event);updated[section]=(updated[section]||[]).map(x=>x.id===id?draft:x);
     Shared.correctScenarioEvent(pid,updated).then(()=>{
      Store.add(pid,'orders',{kind:'chart-correction',ref:id,section,text:'Corrected '+(draft.title||draft.panel||draft.study||draft.type||'chart entry')},current.clock.now(),current.clock.now());
      UI.toast('Chart entry corrected.');api.close();App.render();
     }).catch(error=>UI.formError(api.el.querySelector('.modal-body'),error.message||'Chart correction could not be saved.'));
     return false;
    }
    const patch=clone(Store.patientEdits(pid));
    patch[section]=(Model.base(pid)[section]||[]).map(x=>x.id===id?draft:x);
    if(!Store.savePatientEdits(pid,patch))return false;
    Store.add(pid,'orders',{kind:'chart-correction',ref:id,section,text:'Corrected '+(draft.title||draft.panel||draft.study||draft.type||'chart entry')},current.clock.now(),current.clock.now());
    UI.toast('Chart entry corrected.');return true;
   });
  },
  bindCorrections(root,p){root.querySelectorAll('[data-correct-chart]').forEach(b=>b.addEventListener('click',()=>{const [section,id]=b.dataset.correctChart.split('|');FacultySession.correct(p.id,section,id);}));},
  editButton(section,item){return Store.instructorUnlocked()?`<button class="btn btn-sm" data-correct-chart="${esc(section)}|${esc(item.id)}">Edit</button>`:'';}
 };
})();
