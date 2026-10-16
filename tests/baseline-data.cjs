const assert=require('node:assert/strict'),boot=require('./boot.cjs'),copy=x=>JSON.parse(JSON.stringify(x));
const w=boot();try{
 const s=w.testApp.state,b=copy(w.simBaseFor('charles-jones'));
 const compact=w.compactSimulationBase(b);
 assert(JSON.stringify(compact).length<JSON.stringify(b).length*.75,'baseline removes repeated document content');
 assert.deepEqual(copy(w.hydrateSimulationBase(compact)),b,'lossless baseline reference roundtrip');
 b.chartRecords[0].content='Faculty customized content';b.releaseQueue[0].content='Faculty customized pending order';
 b.chartRecords.push({id:'custom-test',patientId:'charles-jones',content:'New custom document',status:'pending'});
 assert.deepEqual(copy(w.hydrateSimulationBase(w.compactSimulationBase(b))),b,'custom content survives');
 s.simulationBases['charles-jones']=b;w.save();w.flushChartSave();
 const stored=JSON.parse(w.localStorage.getItem('atuSimulationHospitalEHRv1'));
 assert.equal(stored.simulationBases['charles-jones'].baselineFormat,1);
 const decoded=w.ATURecordCodec.decode(w.ATURecordCodec.encode(s));assert.deepEqual(copy(decoded.simulationBases['charles-jones']),b);
 const again=boot(stored);try{assert.equal(again.testApp.state.simulationBases['charles-jones'].chartRecords[0].content,'Faculty customized content');again.resetToBase('charles-jones');assert(again.testApp.records.some(r=>r.id==='custom-test'));}finally{again.close();}
 console.log('PASS compact baseline references: lossless roundtrip, custom documents/queues, save/reload, reset and sync codec.');
}finally{w.close();}
