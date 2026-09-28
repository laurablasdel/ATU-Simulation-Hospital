const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),boot=require('./boot.cjs'),{BitArray,Code128Reader,Code39Reader}=require('@zxing/library');
const w=boot();try{
 const packages=w.ensureMedicationPackages();let decoded=0;
 for(const p of packages){
  const b=w.medicationPackageSvg(p),svg=new w.DOMParser().parseFromString(b.html,'image/svg+xml'),group=svg.querySelector('g'),offset=Number(group.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
  assert(offset>=10,'Left quiet zone');const bars=[...group.querySelectorAll('rect')].map(r=>({x:Number(r.getAttribute('x'))+offset,width:Number(r.getAttribute('width'))}));
  assert(b.modules-Math.max(...bars.map(r=>r.x+r.width))>=10,'Right quiet zone');
  for(const dpi of [203,300,600]){const width=Math.ceil(b.width*dpi),bits=new BitArray(width);for(let x=0;x<width;x++){const pos=(x+.5)/(b.width*dpi)*b.modules;if(bars.some(r=>pos>=r.x&&pos<r.x+r.width))bits.set(x);}assert.equal(new Code128Reader().decodeRow(0,bits).getText(),p.id,`${dpi} dpi ${p.id}`);}
  decoded++;
 }
 let wristbands=0;const oldOpen=w.open;w.open=()=>({document:{write(html){const doc=new w.DOMParser().parseFromString(html,'text/html'),svg=doc.querySelector('svg'),width=Number(svg.getAttribute('width')),bars=[...svg.querySelectorAll('g rect')].map(e=>({x:Number(e.getAttribute('x')),width:Number(e.getAttribute('width'))}));const pixels=Math.ceil(width*4),bits=new BitArray(pixels);for(let x=0;x<pixels;x++)if(bars.some(r=>x/4>=r.x&&x/4<r.x+r.width))bits.set(x);assert.equal(new Code39Reader().decodeRow(0,bits).getText(),w.testApp.state.patients.find(p=>p.id===currentPatient).barcode);wristbands++;},close(){}}});let currentPatient='';for(const patient of w.testApp.state.patients){currentPatient=patient.id;w.testApp.setPatient(patient.id);w.testApp.setView('barcodes');w.render();w.document.getElementById('printPatientBarcode').click();}w.open=oldOpen;assert.equal(wristbands,13);
 const p=packages.find(p=>p.id==='MED-ACET325');p.patientName='SECRET PATIENT';p.dose='650 mg';p.route='PO';p.frequency='Daily';
 const html=w.medicationLabelDocument([{package:p,copies:25}],8),doc=new w.DOMParser().parseFromString(html,'text/html');
 assert.equal(doc.querySelectorAll('.labelSheet').length,2);assert.equal(doc.querySelectorAll('.medLabel').length,60);assert.equal(doc.querySelectorAll('.medLabel:not(.blank)').length,25);
 assert([...doc.querySelectorAll('.medLabel')].slice(0,7).every(e=>e.classList.contains('blank')));assert.equal(doc.querySelectorAll('.medLabel')[7].dataset.package,p.id);
 const text=[...doc.querySelectorAll('.medLabel')].map(e=>e.textContent).join(' ');for(const forbidden of ['SECRET PATIENT','650 mg','Daily','Simulation Use Only'])assert(!text.includes(forbidden));assert(text.includes('325 mg tablet'));
 assert(html.includes('grid-template-columns:repeat(3,2.625in)'));assert(html.includes('grid-template-rows:repeat(10,1in)'));assert(html.includes('size:8.5in 11in'));
 for(const start of [0,31,1.5])assert.throws(()=>w.medicationLabelDocument([{package:p,copies:1}],start));
 for(const copies of [0,1.5,301])assert.throws(()=>w.medicationLabelDocument([{package:p,copies}],1));
 assert.throws(()=>w.medicationPackageSvg({id:'MED-VERY-LONG-PACKAGE-IDENTIFIER'}));
 const mixed=w.medicationLabelDocument(packages.map(package=>({package,copies:1})),1),mixedDoc=new w.DOMParser().parseFromString(mixed,'text/html');assert.equal(mixedDoc.querySelectorAll('.medLabel:not(.blank)').length,packages.length);assert.equal(new Set([...mixedDoc.querySelectorAll('[data-package]')].map(e=>e.dataset.package)).size,packages.length);
 w.testApp.setPatient('charles-jones');w.testApp.setView('barcodes');w.render();assert([...w.document.querySelectorAll('.pkgCopies')].every(e=>e.value==='1'));w.document.getElementById('clearPackageSelection').click();assert(!w.document.querySelector('.pkgSelect:checked'));w.document.getElementById('selectAllPackages').click();assert.equal(w.document.querySelectorAll('.pkgSelect:checked').length,packages.length);w.document.getElementById('previewPackageLabels').click();assert(w.document.querySelector('#packageLabelPreview iframe').srcdoc.includes('Avery 5160'));
 if(process.env.LABEL_PREVIEW_PATH)fs.writeFileSync(process.env.LABEL_PREVIEW_PATH,mixed);
 console.log(`PASS labels: ${decoded} package barcodes independently decoded at 203/300/600 dpi; sheet dimensions, position 8, page overflow, invalid inputs and package-only content checked.`);
}finally{setImmediate(()=>w.close());}
