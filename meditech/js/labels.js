/* Original ATU Avery 5160 layout and encoders, retained from the user's hospital. */
(function(){'use strict';const esc=U.esc;const slug=v=>String(v).toUpperCase().replace(/[^0-9A-Z .$/+%-]/g,'-');
const C39={"0":"nnnwwnwnn","1":"wnnwnnnnw","2":"nnwwnnnnw","3":"wnwwnnnnn","4":"nnnwwnnnw","5":"wnnwwnnnn","6":"nnwwwnnnn","7":"nnnwnnwnw","8":"wnnwnnwnn","9":"nnwwnnwnn","A":"wnnnnwnnw","B":"nnwnnwnnw","C":"wnwnnwnnn","D":"nnnnwwnnw","E":"wnnnwwnnn","F":"nnwnwwnnn","G":"nnnnnwwnw","H":"wnnnnwwnn","I":"nnwnnwwnn","J":"nnnnwwwnn","K":"wnnnnnnww","L":"nnwnnnnww","M":"wnwnnnnwn","N":"nnnnwnnww","O":"wnnnwnnwn","P":"nnwnwnnwn","Q":"nnnnnnwww","R":"wnnnnnwwn","S":"nnwnnnwwn","T":"nnnnwnwwn","U":"wwnnnnnnw","V":"nwwnnnnnw","W":"wwwnnnnnn","X":"nwnnwnnnw","Y":"wwnnwnnnn","Z":"nwwnwnnnn","-":"nwnnnnwnw",".":"wwnnnnwnn"," ":"nwwnnnwnn","*":"nwnnwnwnn"};
function barcodeSvg(code,height=42,narrow=1.15,wide=2.8){const value=`*${slug(code)}*`;let x=12,bars='';for(const char of value){const pattern=C39[char]||C39['-'];for(let i=0;i<pattern.length;i++){const width=pattern[i]==='w'?wide:narrow;if(i%2===0)bars+=`<rect x="${x.toFixed(2)}" y="2" width="${width.toFixed(2)}" height="${height}"/>`;x+=width;}x+=narrow;}const total=x+12;return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${height+18}" viewBox="0 0 ${total} ${height+18}"><rect width="100%" height="100%" fill="white"/><g fill="black">${bars}</g><text x="${total/2}" y="${height+14}" text-anchor="middle" font-family="Arial" font-size="8">${esc(code)}</text></svg>`;}
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
 if(wristband)for(const w of (Array.isArray(wristband)?wristband:[wristband]))for(let i=0;i<(w.copies||1);i++)slots.push({wristband:w});
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

window.OriginalLabels={labelDocument,barcodeSvg};
async function initializeLabels(){
const el=document.getElementById('labels');
if(!Store.session()||!Shared.on()||!Store.instructorUnlocked()){el.innerHTML='<h1>Faculty sign-in required</h1><p>Open Faculty controls in this browser tab, unlock with the Faculty passphrase, then select Print Labels.</p><a href="index.html#/instructor">Return to hospital sign-in</a>';return;}
try{await Shared.loadFacultyEvents();await Shared.loadFacultyCatalog();}catch(error){el.innerHTML='<h1>Faculty connection required</h1><p>'+esc(error.message||'Reconnect to the shared chart and unlock Faculty again.')+'</p><a href="index.html#/instructor">Return to Faculty controls</a>';return;}
const pid=new URLSearchParams(location.search).get('patient');
const p=pid?Model.base(pid):null;
if(pid&&!p){el.textContent='Patient not found.';return;}
const pts=p?[p]:Model.allPatients();
const catalog=Shared.facultyCatalog();
const accepted=catalog?.packages||{};
const original=new Map((catalog?.defaults||[]).map(p=>[p.id,p]));
const codes=p?Model.labelSet(p).atu.packages.map(x=>x.code):Object.keys(accepted);
const rows=codes.map(code=>({code,package:original.get(code)||{id:code,name:accepted[code].name,strength:'',form:''}}));
const wristbands=pts.map(patient=>({patient,code:Scan.wristbandFor(patient)})).filter(w=>w.code);
el.innerHTML=`<a class="btn" href="index.html#/instructor">← Faculty controls</a><h1>${p?esc(p.name.first+' '+p.name.last)+' — ':''}Original ATU Labels</h1><p>Avery 5160 · US Letter · 30 labels per sheet. Select the entire set or individual labels and choose the first unused position.</p><div class="label-tools"><button class="btn" id="select-all">Select all</button><button class="btn" id="clear">Clear selection</button><label>Starting position <input id="start" type="number" min="1" max="30" value="1"></label><button class="btn" id="preview">Print preview</button><button class="btn btn-primary" id="print">Print selected labels</button></div><p class="label-feedback" id="feedback" role="status"></p><details open><summary>Choose labels and quantities</summary><table class="grid"><thead><tr><th>Select</th><th>Label</th><th>Original code</th><th>Copies</th></tr></thead><tbody>${wristbands.map((w,i)=>`<tr data-wrist="${i}"><td><input type="checkbox" checked aria-label="Select wristband ${esc(w.patient.name.first+' '+w.patient.name.last)}"></td><td>${esc(w.patient.name.first+' '+w.patient.name.last)} — wristband</td><td>${esc(w.code)}</td><td><input type="number" min="1" max="300" value="1" aria-label="Wristband copies ${esc(w.code)}"></td></tr>`).join('')}${rows.map((r,i)=>`<tr data-package-row="${i}"><td><input type="checkbox" checked aria-label="Select ${esc(r.code)}"></td><td>${esc(r.package.name)} ${esc([r.package.strength,r.package.form].filter(Boolean).join(' '))}</td><td>${esc(r.code)}</td><td><input type="number" min="1" max="300" value="1" aria-label="Copies ${esc(r.code)}"></td></tr>`).join('')}</tbody></table></details><div id="preview-out"></div>`;
const feedback=document.getElementById('feedback');
function show(print){try{
 const count=row=>{const n=Number(row.querySelector('input[type=number]').value);if(!Number.isInteger(n)||n<1||n>300)throw Error('Copies must be a whole number from 1 to 300.');return n;};
 const items=[...el.querySelectorAll('[data-package-row]')].filter(r=>r.querySelector('[type=checkbox]').checked).map(r=>({package:rows[Number(r.dataset.packageRow)].package,copies:count(r)}));
 const bands=[...el.querySelectorAll('[data-wrist]')].filter(r=>r.querySelector('[type=checkbox]').checked).map(r=>{const w=wristbands[Number(r.dataset.wrist)];return {patient:{name:w.patient.name.first+' '+w.patient.name.last,mrn:w.patient.mrn,dob:U.fmtDOB(w.patient.dob)},barcodeHTML:barcodeSvg(w.code,50),copies:count(r)};});
 if(!items.length&&!bands.length)throw Error('Select at least one label.');
 const source=labelDocument(items,Number(document.getElementById('start').value),bands.length?bands:null);
 const frame=document.createElement('iframe');frame.title='Original ATU Avery 5160 print preview';frame.className='label-preview';frame.srcdoc=source;
 if(print)frame.onload=()=>frame.contentWindow.print();
 document.getElementById('preview-out').replaceChildren(frame);feedback.textContent='Preview ready. Print at 100% / Actual size, with headers and footers off.';
 }catch(e){feedback.textContent=e.message;}}
document.getElementById('select-all').onclick=()=>el.querySelectorAll('[type=checkbox]').forEach(c=>c.checked=true);
document.getElementById('clear').onclick=()=>el.querySelectorAll('[type=checkbox]').forEach(c=>c.checked=false);
document.getElementById('preview').onclick=()=>show(false);
document.getElementById('print').onclick=()=>show(true);
}
initializeLabels();
})();
