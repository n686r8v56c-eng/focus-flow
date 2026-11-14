import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {parseRouteMemo,updateRouteRecord,mirrorRouteMetadata,readRouteMirror} from '../src/route-safety.js';
import {backupRoute,hashBlob,collectRouteImageIds,restoreRoute} from '../src/route-backup.js';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}};
function mockCloud({badDownload=false,failRow=false}={}) {
  const objects=new Map();let row=null,uploads=0,writes=0;
  const client={storage:{from:()=>({upload:async(path,blob)=>{uploads++;objects.set(path,blob);return {error:null}},download:async path=>({data:badDownload?new Blob(['corrupt']):objects.get(path),error:null})})},from:()=>{
    let payload,expected;const q={select:()=>payload?(async()=>{writes++;if(failRow)return {error:Error('offline')};if(expected&&row?.updated_at!==expected)return {data:[]};row={...payload};return {data:[{updated_at:row.updated_at}]} })():q,eq:(k,v)=>{if(k==='updated_at')expected=v;return q},maybeSingle:async()=>({data:row,error:null}),insert:p=>{payload=p;return q},update:p=>{payload=p;return q}};return q;
  }};return {client,objects,get row(){return row},get uploads(){return uploads},get writes(){return writes},set row(value){row=value}};
}
test('renaming a parent preserves parent and child identities, photos and completion',()=>{
  const old=[{id:'p',title:'준비',parentId:null,level:0,done:true},{id:'c',title:'예약',parentId:'p',level:1,done:true}];
  const next=parseRouteMemo('- 준비물\n  - 예약',old,()=> 'new');
  assert.deepEqual(next.checklist.map(x=>[x.id,x.parentId,x.done]),[['p',null,true],['c','p',true]]);
});
test('inserting and reordering does not steal existing item identities',()=>{
 const old=[{id:'a',title:'A',level:0},{id:'b',title:'B',level:0}];
 assert.deepEqual(parseRouteMemo('- 새 항목\n- B\n- A',old,()=> 'new').checklist.map(x=>x.id),['new','b','a']);
});
test('uploads complete against latest metadata, including two overlapping uploads',async()=>{
 const s=memory(),key='route:place-photos-v1';
 const add=id=>updateRouteRecord(s,key,{},current=>({...current,p:{ids:[...(current.p?.ids||[]),id],cover:current.p?.cover||id}}));
 await Promise.all([Promise.resolve().then(()=>add('photo1')),Promise.resolve().then(()=>add('photo2'))]);
 assert.deepEqual(JSON.parse(s.getItem(key)).p.ids,['photo1','photo2']);
 s.setItem(key,'{bad');assert.throws(()=>add('photo3'));assert.equal(s.getItem(key),'{bad');
});
test('malformed startup data never replaces a good IndexedDB mirror',async()=>{
 const key='test:mirror';await mirrorRouteMetadata(key,JSON.stringify({places:[{id:'saved'}]}));
 await assert.rejects(mirrorRouteMetadata(key,'{broken',{startup:true}));
 await mirrorRouteMetadata(key,JSON.stringify({places:[]}),{startup:true});
 assert.deepEqual(JSON.parse(await readRouteMirror(key)).places,[{id:'saved'}]);
});
test('mirror writes are ordered and retain the latest confirmed snapshot',async()=>{
 const key='test:ordered';await Promise.all([mirrorRouteMetadata(key,'{"places":[{"id":"a"}]}'),mirrorRouteMetadata(key,'{"places":[{"id":"b"}]}')]);
 assert.equal(JSON.parse(await readRouteMirror(key)).places[0].id,'b');
});
function fixture(id){const s=memory(),key='focus-route-flow-v1:'+id;s.setItem(key,JSON.stringify({places:[{id:'p'}],routes:{},visits:{}}));s.setItem(key+':place-photos-v1',JSON.stringify({p:{ids:['photo'],cover:'photo'}}));return s;}
test('backup verifies photo bytes and row, runs once daily, unchanged data never writes again',async()=>{
 const s=fixture('owner'),cloud=mockCloud(),blob=new Blob(['original'],{type:'image/png'});
 const options={storage:s,readImage:async()=>blob,day:'day1'};
 assert.equal((await backupRoute(cloud.client,'owner',options)).status,'saved');assert.equal(cloud.uploads,1);assert.equal(cloud.writes,1);
 await backupRoute(cloud.client,'owner',options);await backupRoute(cloud.client,'owner',{...options,day:'day2'});
 assert.equal(cloud.uploads,1);assert.equal(cloud.writes,1);assert.equal(await hashBlob(blob),cloud.row.snapshot.images[0].sha256);
});
test('changed data after daily backup is pending until a later day',async()=>{
 const s=fixture('waiting'),cloud=mockCloud(),options={storage:s,readImage:async()=>new Blob(['a']),day:'day1'};
 await backupRoute(cloud.client,'waiting',options);s.setItem('route-image-revision','new');
 assert.equal((await backupRoute(cloud.client,'waiting',options)).status,'waiting');assert.equal(cloud.writes,1);
});
test('corrupt upload or failed row never advances completion marker or removes original',async()=>{
 for(const settings of [{badDownload:true},{failRow:true}]){const id=JSON.stringify(settings),s=fixture(id),cloud=mockCloud(settings),original=new Blob(['original']);
 await assert.rejects(backupRoute(cloud.client,id,{storage:s,readImage:async()=>original,day:'day1'}));
 assert.equal(s.getItem('focus-route-flow-v1:'+id+':backup-state-v1'),null);assert.equal(await original.text(),'original');}
});
test('unknown remote backup is preserved rather than overwritten',async()=>{
 const s=fixture('conflict'),cloud=mockCloud();cloud.row={snapshot:{fingerprint:'another-device'},updated_at:'2026-01-01'};
 await assert.rejects(backupRoute(cloud.client,'conflict',{storage:s,readImage:async()=>new Blob(['x'])}));assert.equal(cloud.uploads,0);assert.equal(cloud.writes,0);
});
test('missing referenced photo aborts backup before cloud writes',async()=>{
 const s=fixture('missing'),cloud=mockCloud();await assert.rejects(backupRoute(cloud.client,'missing',{storage:s,readImage:async()=>null}));assert.equal(cloud.writes,0);
});
test('restore refuses to overwrite existing local ROUTE records',async()=>{
 globalThis.localStorage=fixture('restore-existing');await assert.rejects(restoreRoute(mockCloud().client,'restore-existing'),/기록이 있어/);
});
test('collects place, journal and checklist image references',()=>{
 const records={'r':JSON.stringify({visits:{today:{p:{checklist:[{id:'check'}]}}}}),'r:journal-v1':JSON.stringify([{id:'j',photoIds:['journal']}]),'r:place-photos-v1':JSON.stringify({p:{ids:['place']}})};
 assert.deepEqual(collectRouteImageIds(records),['check','journal','place']);
});
test('restore downloads and verifies original photos before publishing restored metadata',async()=>{
 const id='roundtrip',source=fixture(id),cloud=mockCloud(),original=new Blob(['original photograph'],{type:'image/png'});
 await backupRoute(cloud.client,id,{storage:source,readImage:async()=>original});
 globalThis.localStorage=memory();
 assert.equal((await restoreRoute(cloud.client,id)).status,'restored');
 assert.deepEqual(JSON.parse(localStorage.getItem('focus-route-flow-v1:'+id+':place-photos-v1')).p.ids,['photo']);
});
test('corrupt restore leaves existing local records untouched',async()=>{
 const id='corrupt-restore',source=fixture(id),cloud=mockCloud(),original=new Blob(['original']);
 await backupRoute(cloud.client,id,{storage:source,readImage:async()=>original});
 const path=cloud.row.snapshot.images[0].path;cloud.objects.set(path,new Blob(['wrong']));globalThis.localStorage=memory();
 await assert.rejects(restoreRoute(cloud.client,id),/検証|검증/);
 assert.equal(localStorage.getItem('focus-route-flow-v1:'+id),null);
});
