import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeState} from '../src/sync.js';
const item={id:'video',text:'https://youtu.be/abcdefghijk',title:'유튜브 영상',folderId:'',archived:false};
const state=items=>({projects:[],tasks:[],inboxItems:items});
test('delete racing with a fetched video title recovers the edit without blocking saves',()=>{
  const base=state([item]),local=state([]),remote=state([{...item,title:'영상 제목'}]);
  const merged=mergeState(base,local,remote);
  assert.equal(merged.inboxItems.length,1);
  assert.equal(merged.inboxItems[0].recoveredFrom,item.id);
  assert.equal(merged.inboxItems[0].archived,true);
  assert.equal(merged.inboxItems[0].title,'영상 제목');
  assert.deepEqual(mergeState(base,local,remote),merged);
  assert.deepEqual(mergeState(local,local,merged),merged);
  assert.deepEqual(mergeState(base,remote,local),merged);
});
test('unchanged remote does not resurrect a deleted inbox item',()=>{
  assert.deepEqual(mergeState(state([item]),state([]),state([item])),state([]));
});
test('conflicting text retains both versions and retries do not multiply recovery records',()=>{
  const base=state([item]),local=state([{...item,text:'내 수정'}]),remote=state([{...item,text:'다른 수정'}]);
  const merged=mergeState(base,local,remote);
  assert.equal(merged.inboxItems.length,2);
  assert.ok(merged.inboxItems.some(n=>n.text==='내 수정'&&n.archived));
  assert.ok(merged.inboxItems.some(n=>n.id===item.id&&n.text==='다른 수정'));
  const retry=mergeState(base,local,merged);
  assert.deepEqual(retry,merged);
});
test('independent folder selection and title fetching merge into one record',()=>{
  const merged=mergeState(state([item]),state([{...item,folderId:'folder'}]),state([{...item,title:'실제 제목'}]));
  assert.equal(merged.inboxItems.length,1);assert.equal(merged.inboxItems[0].folderId,'folder');assert.equal(merged.inboxItems[0].title,'실제 제목');
});
test('pending edits during an in-flight save remain recoverable',()=>{
  const original=state([item]),current=state([{...item,text:'추가 수정'}]),saved=state([]);
  const next=mergeState(original,current,saved);
  assert.equal(next.inboxItems[0].text,'추가 수정');assert.equal(next.inboxItems[0].archived,true);
});
test('unrelated task conflicts still use the existing explicit conflict handling',()=>{
  assert.throws(()=>mergeState({tasks:[{id:'t',title:'base'}]},{tasks:[{id:'t',title:'left'}]},{tasks:[{id:'t',title:'right'}]}));
});
