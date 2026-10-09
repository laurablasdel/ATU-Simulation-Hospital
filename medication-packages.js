/* Shared package identity and mailing-label utilities. No patient-specific label data. */
(function(){
const copy=x=>JSON.parse(JSON.stringify(x));
const orderKey=m=>String(m.name||'').trim().toLowerCase()+'|'+String(m.route||'').trim().toLowerCase();
 const cleanCode=value=>String(value||'').trim().replace(/^\](?:C[01]|A0)/,'').replace(/^\*(.*)\*$/,'$1').trim().toUpperCase();
function medicationNameForLabel(name){return String(name||'').replace(/\s+\d.*$/,'').trim();}
function ensurePackages(){
 state.medicationPackages ||= [];
 for(const p of window.MEDICATION_PACKAGE_DEFAULTS||[])if(!state.medicationPackages.some(x=>x.id===p.id))state.medicationPackages.push(copy(p));
 // Update existing saved catalogs while preserving faculty-customized names and barcode identity.
 const naloxone=state.medicationPackages.find(p=>p.id==='MED-0010');
 if(naloxone&&/^naloxone$/i.test(String(naloxone.name||'').trim()))naloxone.name='Naloxone (Narcan)';
 for(const m of state.medicationCatalog||[]){
  if(Array.isArray(m.packageIds))continue;
  const key=orderKey(m);
  let packages=state.medicationPackages.filter(p=>(p.orderKeys||[]).includes(key));
  if(!packages.length){
   // Unknown/new orders get editable drafts, never guessed package strengths.
   let hash=0;for(const c of key)hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;
   let id='MED-'+hash.toString(36).toUpperCase(),n=0;
   while(state.medicationPackages.some(p=>p.id===id))id='MED-'+hash.toString(36).toUpperCase()+(++n);
   const p={id,name:medicationNameForLabel(m.name),strength:'',form:'',orderKeys:[key]};state.medicationPackages.push(p);packages=[p];
  }
  // Older automatically-created package drafts were unnamed and blocked Print All.
  // Recover only their name from the linked order; do not infer strength or form.
  for(const p of packages)if(!String(p.name||'').trim())p.name=medicationNameForLabel(m.name);
  // The relationship comes from package orderKeys, so it survives resets and order ID changes.
 }
 return state.medicationPackages;
}
function packagesFor(m){ensurePackages();return state.medicationPackages.filter(p=>Array.isArray(m.packageIds)?m.packageIds.includes(p.id):(p.orderKeys||[]).includes(orderKey(m)));}
function matchPackage(m,p){return packagesFor(m).some(x=>x.id===p.id);}
function resolveBarcode(code){
 const value=cleanCode(code);ensurePackages();
 const units=(state.bloodUnits||[]).filter(u=>[u.barcode,'MED-B'+u.barcode,...(u.legacyBarcodes||[])].some(c=>c&&cleanCode(c)===value));
 if(units.length>1)return {error:'This blood barcode identifies more than one unit. Faculty must correct the labels.'};
 if(units.length){const bloodUnit=units[0],definition=window.bloodPackageForProduct?.(bloodUnit.product),p=state.medicationPackages.find(p=>p.id===definition?.id);return p?{package:p,bloodUnit,code:value}:{error:'Unknown blood product. Faculty must identify this product before administration.'};}
 const packages=state.medicationPackages.filter(p=>cleanCode(p.id)===value||(p.aliases||[]).some(a=>cleanCode(a)===value));
 if(packages.length===1)return {package:packages[0],code:value};
 if(packages.length>1)return {error:'This barcode identifies more than one package. Faculty must correct the catalog.'};
 const orders=(state.medicationCatalog||[]).filter(m=>[m.barcode,...(m.legacyBarcodes||[])].some(b=>b&&cleanCode(b)===value));
 if(orders.length===1)return {legacyOrder:orders[0],code:value};
 return {error:orders.length?'This legacy code is duplicated. Use a package label.':'Unknown medication barcode. Nothing was documented.'};
}
function packageSvg(p){
 if(!/^MED-[A-Z0-9-]+$/.test(p.id))throw Error('Package identifiers must use MED- followed by letters, numbers or hyphens.');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 JsBarcode(svg,p.id,{format:'CODE128',width:1,height:76,displayValue:false,margin:10,marginTop:0,marginBottom:0});
 const modules=parseFloat(svg.getAttribute('width')),width=Math.max(.94,modules*.0075);
 if(!Number.isFinite(modules))throw Error('Barcode encoder did not return a valid width.');
 if(width>1.7)throw Error(p.id+' is too long for reliable printing on this label. Assign a shorter package identifier.');
 svg.setAttribute('style',`width:${width}in;height:.60in;display:block;flex:none`);
 svg.setAttribute('data-barcode-value',p.id);
 return {html:svg.outerHTML,width,modules};
}
function labelDocument(items,start=1,wristband=null){
 if(!Number.isInteger(start)||start<1||start>30)throw Error('Starting label position must be 1–30.');
 const slots=Array(start-1).fill(null);
 if(wristband)slots.push({wristband});
 for(const {package:p,copies} of items){
  if(!p?.name?.trim())throw Error('Enter the package medication name before printing.');
  if(!Number.isInteger(copies)||copies<1||copies>300)throw Error('Copies must be a whole number from 1 to 300.');
  const barcode=packageSvg(p);for(let i=0;i<copies;i++)slots.push({p,barcode});
 }
 if(!items.length&&!wristband)throw Error('Select at least one medication package.');
 if(slots.length>3000)throw Error('Print at most 3,000 labels at a time.');
 const pages=[];for(let i=0;i<slots.length;i+=30){const page=slots.slice(i,i+30);while(page.length<30)page.push(null);pages.push(page);}
 const labels=pages.map(page=>'<section class="labelSheet">'+page.map(s=>!s?'<div class="medLabel blank" aria-label="Unused label"></div>':s.wristband?`<div class="medLabel wristbandLabel"><div class="labelText"><b>${esc(s.wristband.patient.name)}</b><span>MRN ${esc(s.wristband.patient.mrn)}</span><span>DOB ${esc(s.wristband.patient.dob)}</span></div><div class="labelBarcode" style="width:1.15in">${s.wristband.barcodeHTML}</div></div>`:`<div class="medLabel" data-package="${esc(s.p.id)}"><div class="labelText"><b>${esc(s.p.name)}</b><span>${esc([s.p.strength,s.p.form].filter(Boolean).join(' '))}</span><small>${esc(s.p.id)}</small></div><div class="labelBarcode" style="width:${s.barcode.width}in">${s.barcode.html}<small>${esc(s.p.id)}</small></div></div>`).join('')+'</section>').join('');
 return `<!doctype html><html><head><meta charset="utf-8"><title>Medication Package Labels</title><style>
 @page{size:8.5in 11in;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#e9edf0;color:#000}
 .printHelp{padding:16px}.printHelp button{padding:8px 20px}.labelSheet{width:8.5in;height:11in;padding:.5in .1875in;display:grid;grid-template-columns:repeat(3,2.625in);grid-template-rows:repeat(10,1in);column-gap:.125in;row-gap:0;background:#fff;margin:16px auto;break-after:page;overflow:hidden}.labelSheet:last-child{break-after:auto}
 .medLabel{width:2.625in;height:1in;padding:.04in;display:flex;align-items:center;gap:.025in;outline:1px dashed #bbb;overflow:hidden}.labelText{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;overflow-wrap:anywhere}.labelText b{font-size:12px;line-height:1.05}.labelText span{font-size:10px;line-height:1.05}.labelText small,.labelBarcode small{font-size:8px;line-height:1.1}.labelBarcode{flex:none;display:flex;align-items:center;flex-direction:column;background:white;gap:3px}.wristbandLabel svg{width:1.15in;height:.72in}.blank{visibility:hidden}
 @media print{body{background:white}.printHelp{display:none}.labelSheet{margin:0}.medLabel{outline:none}}
 </style></head><body><div class="printHelp"><button onclick="window.print()">Print labels</button><p>Avery 5160 • US Letter • 30 labels • 1 × 2⅝ inches. Print at 100% / Actual size with headers and footers off. Check alignment on plain paper first. Start position: ${start}.</p></div>${labels}</body></html>`;
}
function openLabels(items,start,printNow=false,wristband=null){
 const html=labelDocument(items,start,wristband),win=window.open('','_blank','width=1000,height=850');
 if(!win)throw Error('Allow pop-ups to open the label preview.');win.document.write(html);
 if(printNow)win.addEventListener('load',()=>win.print(),{once:true});win.document.close();return win;
}
function renderPackageCenter(meds){
 ensurePackages();const relevant=new Set(meds.flatMap(m=>packagesFor(m).map(p=>p.id)));
 const rows=state.medicationPackages.filter(p=>relevant.has(p.id)).map(p=>`<tr data-package-row="${esc(p.id)}"><td><input type="checkbox" class="pkgSelect" aria-label="Select ${esc(p.id)}" ${p.name?'checked':''}></td><td><b>${esc(p.id)}</b><input class="pkgName" aria-label="Package name ${esc(p.id)}" value="${esc(p.name)}" placeholder="Medication name only"></td><td><input class="pkgStrength" aria-label="Package strength ${esc(p.id)}" value="${esc(p.strength)}" placeholder="Not specified"><input class="pkgForm" aria-label="Package form ${esc(p.id)}" value="${esc(p.form)}" placeholder="Dosage form"></td><td><input class="pkgCopies" aria-label="Copies ${esc(p.id)}" type="number" min="1" max="300" value="1"></td></tr>`).join('');
 return panel('Medication Labels — Avery 5160',`<div id="packageLabelCenter"><p>Print a mixed sheet: one label for each selected medication by default. Change each quantity as needed. Only packages linked to this patient’s medication orders are shown, including faculty-release medications. Enter package strength/form from the supplied information; never use the ordered dose as package strength. Blank details are omitted from labels.</p><div class="actions"><button id="savePackageCatalog">Save package details</button><button id="selectAllPackages">Select all shown medications</button><button id="selectPatientPackages">Select this patient's packages</button><button id="clearPackageSelection">Clear selection</button><label>Starting label position<input id="labelStart" type="number" min="1" max="30" value="1"></label><button id="previewPackageLabels">Print preview</button><button id="printPackageLabels">Print labels</button></div><p id="packageFeedback" role="status"></p><div id="packageLabelPreview" class="feedback"></div><div style="overflow:auto"><table><thead><tr><th>Select</th><th>Medication / Package ID</th><th>Package strength / Form</th><th>Copies</th></tr></thead><tbody>${rows}</tbody></table></div><details><summary>Link an order to physical packages / add another strength</summary><p>A package may match several orders. Scanning requires selecting the intended active order. Separate dosage forms should have separate package IDs.</p><label>Order<select id="packageOrder">${meds.filter(m=>!m.id.startsWith('label-')).map(m=>`<option value="${esc(m.id)}">${esc(m.name)} ${esc(m.dose)} ${esc(m.route)}</option>`).join('')}</select></label><label>Package IDs (comma separated)<input id="orderPackageIds"></label><button id="saveOrderPackages">Save order links</button><hr><label>New MED- identifier<input id="newPackageId" maxlength="18" placeholder="MED-ACET325"></label><label>Medication name<input id="newPackageName"></label><label>Package strength<input id="newPackageStrength"></label><label>Dosage form<input id="newPackageForm"></label><button id="addPhysicalPackage">Add package</button></details></div>`);
}
function attachPackageCenter(meds){
 const el=id=>document.getElementById(id),feedback=t=>el('packageFeedback').textContent=t;
 const rows=()=>[...document.querySelectorAll('[data-package-row]')];
 const saveDetails=()=>{let changed=false;for(const row of rows()){const p=state.medicationPackages.find(p=>p.id===row.dataset.packageRow);for(const [field,selector] of [['name','.pkgName'],['strength','.pkgStrength'],['form','.pkgForm']]){const value=row.querySelector(selector).value.trim();if(p[field]!==value){p[field]=value;changed=true;}}}if(changed)liveSave('medication_packages_updated',{});};
 window.saveVisiblePackageDetails=saveDetails;
 el('savePackageCatalog').onclick=()=>{try{saveDetails();feedback('Package details saved.');}catch(e){feedback(e.message);}};
 const show=print=>{try{saveDetails();const items=rows().filter(r=>r.querySelector('.pkgSelect').checked).map(r=>({package:state.medicationPackages.find(p=>p.id===r.dataset.packageRow),copies:Number(r.querySelector('.pkgCopies').value)}));const start=Number(el('labelStart').value);if(print){openLabels(items,start,true);feedback('Print window opened.');}else{const frame=document.createElement('iframe');frame.title='Avery 5160 mixed medication label preview';frame.style='width:100%;height:1150px;border:1px solid #bdc9cb';frame.srcdoc=labelDocument(items,start);el('packageLabelPreview').replaceChildren(frame);feedback('Preview ready. Print at 100% / Actual size.');}}catch(e){feedback(e.message);}};
 el('previewPackageLabels').onclick=()=>show(false);el('printPackageLabels').onclick=()=>show(true);
 el('selectAllPackages').onclick=()=>rows().forEach(r=>r.querySelector('.pkgSelect').checked=!!r.querySelector('.pkgName').value.trim());
 el('clearPackageSelection').onclick=()=>rows().forEach(r=>r.querySelector('.pkgSelect').checked=false);
 el('selectPatientPackages').onclick=()=>{const ids=new Set(meds.flatMap(m=>packagesFor(m).map(p=>p.id)));rows().forEach(r=>r.querySelector('.pkgSelect').checked=ids.has(r.dataset.packageRow));};
 const updateLinks=()=>{const m=meds.find(m=>m.id===el('packageOrder').value);el('orderPackageIds').value=m?packagesFor(m).map(p=>p.id).join(', '):'';};updateLinks();el('packageOrder').onchange=updateLinks;
 el('saveOrderPackages').onclick=()=>{const m=meds.find(m=>m.id===el('packageOrder').value),ids=el('orderPackageIds').value.split(',').map(cleanCode).filter(Boolean);if(!m||ids.some(id=>!state.medicationPackages.some(p=>p.id===id))){feedback('Select an order and valid package IDs.');return;}m.packageIds=[...new Set(ids)];for(const base of [state.simulationBases?.[m.patientId]]){const saved=base?.collections?.medicationCatalog?.find(x=>x.id===m.id);if(saved)saved.packageIds=[...m.packageIds];}liveSave('medication_package_link_updated',{patientId:m.patientId,medicationId:m.id});feedback('Order package links saved. Save the patient base to keep custom links on reset.');};
 el('addPhysicalPackage').onclick=()=>{try{const p={id:cleanCode(el('newPackageId').value),name:el('newPackageName').value.trim(),strength:el('newPackageStrength').value.trim(),form:el('newPackageForm').value.trim(),orderKeys:[]};if(!p.name||state.medicationPackages.some(x=>x.id===p.id))throw Error('Use a medication name and a unique MED- identifier.');packageSvg(p);state.medicationPackages.push(p);liveSave('medication_package_added',{});renderBarcodeCenter();}catch(e){feedback(e.message);}};
}
Object.assign(window,{ensureMedicationPackages:ensurePackages,packagesForMedication:packagesFor,medicationMatchesPackage:matchPackage,resolveMedicationBarcode:resolveBarcode,normalizeMedicationBarcode:cleanCode,medicationPackageSvg:packageSvg,medicationLabelDocument:labelDocument,openMedicationLabels:openLabels,renderPackageLabelCenter:renderPackageCenter,attachPackageLabelCenter:attachPackageCenter});
})();
