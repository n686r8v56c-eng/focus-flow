import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeId,makeInboxItems,inboxEntries,planInboxItem} from '../src/inbox-model.js';
import {mergeState,normalizeState} from '../src/sync.js';
const base=()=>({projects:[],tasks:[],sessions:[]});
let seq=0;const id=()=>`n${++seq}`;
test('pasted videos are separate unclassified records; prose stays intact',()=>{
  const notes=makeInboxItems('https://youtu.be/abcdefghijk\nhttps://www.youtube.com/shorts/ABCDEFGHIJK',id);
  assert.equal(notes.length,2);assert.equal(notes[0].videoId,'abcdefghijk');assert.equal(notes[1].videoId,'ABCDEFGHIJK');assert.ok(notes.every(n=>n.folderId===''));
  const prose='이거 연습하기\nhttps://youtu.be/abcdefghijk';assert.equal(makeInboxItems(prose,id)[0].text,prose);
  assert.equal(youtubeId('https://youtube.com.evil.test/watch?v=abcdefghijk'),'');
});
test('planning retains the source and is idempotent, including completed tasks',()=>{
  const source=makeInboxItems('https://youtu.be/abcdefghijk',id)[0];
  const data={...base(),inboxItems:[source]};
  const next=planInboxItem(data,source,'2026-11-04');
  assert.equal(next.inboxItems[0],source);assert.equal(next.tasks[0].sourceInboxId,source.id);assert.equal(next.tasks[0].url,source.url);
  assert.equal(planInboxItem(next,source,'2026-11-04'),next);
  const done={...next,tasks:next.tasks.map(t=>({...t,status:'done',completedAt:'2026-11-04T01:00:00Z'}))};
  assert.equal(planInboxItem(done,source,'2026-11-04'),done);
  const again=planInboxItem(done,source,'2026-11-05');assert.equal(again.tasks.length,2);assert.equal(again.tasks[0].status,'done');assert.equal(again.tasks[1].status,'todo');
});
test('old undated todos appear without copying or changing dated tasks and schedules',()=>{
  const data={...base(),tasks:[{id:'old',title:'기존 할 일',due:'',status:'todo'},{id:'dated',due:'2026-11-05'},{id:'schedule',time:'09:00',due:''}]};
  const entries=inboxEntries(data);assert.equal(entries.length,1);assert.equal(entries[0].id,'old');
  const planned=planInboxItem(data,entries[0],'2026-11-04');assert.equal(planned.tasks.length,3);assert.equal(planned.tasks[0].id,'old');assert.equal(planned.tasks[0].due,'2026-11-04');assert.equal(planned.tasks[1],data.tasks[1]);assert.equal(planned.tasks[2],data.tasks[2]);
});
test('inbox and folders survive normalization and merge independent device captures',()=>{
  const b=base();const a={...b,inboxItems:[makeInboxItems('첫 생각',id)[0]],inboxFolders:[{id:'folder-a',name:'아이디어'}]};
  const c={...b,inboxItems:[makeInboxItems('두 번째 생각',id)[0]],inboxFolders:[{id:'folder-b',name:'생활'}]};
  const merged=normalizeState(mergeState(b,a,c));assert.equal(merged.inboxItems.length,2);assert.equal(merged.inboxFolders.length,2);assert.deepEqual(merged.tasks,[]);
});

test('dash lists preserve headings, blank lines, links and completion through save and sync', async()=>{
  const {inboxTextLines,toggleInboxTextLine}=await import('../src/inbox-model.js');
  const text='시험 준비\n- 신분증\n- 수험표\n\n안내 https://example.com\n---';
  const item=makeInboxItems(text,id)[0];
  assert.equal(item.title,'시험 준비');
  assert.equal(inboxTextLines(item.text).filter(l=>l.checklist).length,2);
  const checked={...item,text:toggleInboxTextLine(item.text,1)};
  const merged=normalizeState(mergeState({...base(),inboxItems:[item]}, {...base(),inboxItems:[checked]}, {...base(),inboxItems:[item]}));
  const restored=JSON.parse(JSON.stringify(merged)).inboxItems[0];
  assert.equal(inboxTextLines(restored.text)[1].checked,true);
  assert.equal(inboxTextLines(restored.text)[2].checked,false);
  assert.equal(restored.title,'시험 준비');
  assert.ok(restored.text.includes('안내 https://example.com\n---'));
  assert.equal(inboxTextLines(toggleInboxTextLine(restored.text,1))[1].checked,false);
  assert.equal(toggleInboxTextLine(text,0),text);
  assert.equal(toggleInboxTextLine(text,6),text);
});
test('checkbox syntax and Windows line endings round-trip without treating prose as lists',async()=>{
  const {inboxTextLines,toggleInboxTextLine}=await import('../src/inbox-model.js');
  const text='제목\r\n- [X] 완료\r\n- [ ] 준비\r\n-\r\nhttps://example.com/a-b\r\n일반 - 문장';
  const lines=inboxTextLines(text);
  assert.equal(lines[1].checked,true);assert.equal(lines[1].text,'완료');
  assert.equal(lines[2].checked,false);assert.equal(lines[3].checklist,true);
  assert.equal(lines[4].checklist,false);assert.equal(lines[5].checklist,false);
  assert.equal(toggleInboxTextLine(text,2),'제목\r\n- [X] 완료\r\n- [x] 준비\r\n-\r\nhttps://example.com/a-b\r\n일반 - 문장');
});
