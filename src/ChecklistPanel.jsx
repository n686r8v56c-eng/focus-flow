import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ArrowLeft, Plus, ClipboardCheck, Copy, Trash2, Pencil, ChevronDown, ChevronRight, Check, X} from 'lucide-react';
import './checklist.css';

const uuid = () => crypto.randomUUID();
const clean = v => String(v ?? '').trim();
const starterText = `앱 개발 체크리스트
GitHub
- 새 저장소 생성 (영문 이름)
- 로그인·회원가입 화면 포함
- 디자인 지침 13개 적용
- 프로젝트 파일 업로드 및 커밋
Supabase
- 앱용 이메일 계정 준비
- 새 프로젝트 생성
- SQL 실행
- Project URL 복사
- Publishable Key 복사
Cloudflare Pages
- 새 애플리케이션 생성
- 환경변수 2개 등록
- 빌드 및 배포`;
// Lines prefixed by -, ㅁ, ☐, □ or task-markdown are checklist items,
// independent of indentation. All other lines after the title are groups.
export function parseChecklist(input) {
  const lines = String(input || '').replace(/\r\n?/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);
  if (!lines.length) throw Error('제목과 체크 항목을 입력해 줘.');
  const title = lines[0].replace(/^#+\s*/, '').trim();
  if (!title) throw Error('첫 줄에 제목을 입력해 줘.');
  let groups = [], current = null, total = 0;
  const itemRe = /^(?:[-*•]\s*(?:\[[ xX]\]\s*)?|[ㅁ☐□☑✓✔]\s*)+(.+)$/u;
  for (const line of lines.slice(1)) {
    const m = line.match(itemRe);
    if (m) {
      if (!current) {current = {id: uuid(), title:'기타', items:[]}; groups.push(current);}
      const label = clean(m[1]);
      if (!label) continue;
      current.items.push({id:uuid(), text:label, done:/^[-*•]\s*\[[xX]\]|^[☑✓✔]/u.test(line)});
      total += 1;
    } else {
      current = {id:uuid(), title:line.replace(/^#+\s*/, ''), items:[]};
      groups.push(current);
    }
  }
  if (!total) throw Error('체크할 항목이 없어. 각 항목을 - 또는 ㅁ으로 시작해 줘.');
  return {title, groups};
}

const countDone = list => (list.groups||[]).flatMap(g=>g.items||[]).filter(x=>x.done).length;
const countAll = list => (list.groups||[]).reduce((n,g)=>n+(g.items||[]).length,0);

export function ChecklistPanel({client,userId,onClose}) {
  const [lists,setLists] = useState([]);
  const [selectedId,setSelectedId] = useState(null);
  const [mode,setMode] = useState('list');
  const [source,setSource] = useState(starterText);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [collapsed,setCollapsed] = useState({});
  const [editing,setEditing] = useState(null);
  const [draft,setDraft] = useState('');
  const selected = lists.find(x=>x.id===selectedId);

  const refresh = useCallback(async () => {
    if (!client || !userId) return;
    const {data,error} = await client.from('focus_checklists').select('*').eq('user_id',userId).order('created_at',{ascending:false});
    if (error) {setError('체크리스트 목록을 불러오지 못했어: '+error.message);return;}
    setLists(data||[]);
  },[client,userId]);
  useEffect(()=>{refresh();},[refresh]);
  useEffect(()=>{
    if(!client || !userId) return;
    const ch=client.channel('focus-checklists-'+userId).on('postgres_changes',{
      event:'*',schema:'public',table:'focus_checklists',filter:`user_id=eq.${userId}`
    },()=>refresh()).subscribe();
    return ()=>{client.removeChannel(ch);};
  },[client,userId,refresh]);
  const fail=e=>{setError(e.message||String(e));setMessage('');};
  const saved=txt=>{setError('');setMessage(txt);};

  async function createFromText() {
    let parsed;
    try {parsed=parseChecklist(source);} catch(e) {fail(e);return;}
    if(!client || !userId) {fail(Error('로그인을 확인해 줘.'));return;}
    setBusy(true);setError('');
    try {
      const {data,error}=await client.from('focus_checklists').insert({
        user_id:userId,title:parsed.title,groups:parsed.groups
      }).select().single();
      if(error) throw error;
      setLists(prev=>[data,...prev.filter(x=>x.id!==data.id)]);
      setSelectedId(data.id);setMode('detail');saved('체크리스트를 저장했어.');
    } catch(e) {fail(e);} finally {setBusy(false);}
  }
  async function updateRow(row,patch,ok='저장했어.') {
    setBusy(true);setError('');
    try {
      const {data,error}=await client.from('focus_checklists').update(patch).eq('user_id',userId).eq('id',row.id).select().single();
      if(error) throw error;
      setLists(prev=>prev.map(x=>x.id===row.id?data:x)); saved(ok);
      return true;
    } catch(e) {fail(e);await refresh();return false;} finally {setBusy(false);}
  }
  async function toggleItem(groupId,itemId) {
    if(!selected || busy)return;
    const groups=selected.groups.map(g=>g.id!==groupId?g:{...g,items:g.items.map(x=>x.id!==itemId?x:{...x,done:!x.done})});
    await updateRow(selected,{groups},'체크 상태 저장됨');
  }
  async function editText() {
    if(!selected || !clean(draft)) {setError('내용을 입력해 줘.');return;}
    let patch;
    if(editing.kind==='title') patch={title:clean(draft)};
    else patch={groups:selected.groups.map(g=>{
      if(editing.kind==='group'&&g.id===editing.groupId)return {...g,title:clean(draft)};
      if(editing.kind==='item'&&g.id===editing.groupId)return {...g,items:g.items.map(x=>x.id===editing.itemId?{...x,text:clean(draft)}:x)};
      return g;
    })};
    if(await updateRow(selected,patch))setEditing(null);
  }
  async function addItem(groupId) {
    if(!selected)return;
    const value=window.prompt('추가할 체크 항목');
    if(!clean(value))return;
    await updateRow(selected,{groups:selected.groups.map(g=>g.id===groupId?{...g,items:[...g.items,{id:uuid(),text:clean(value),done:false}]}:g)});
  }
  async function removeItem(groupId,itemId) {
    if(!selected || !window.confirm('이 체크 항목을 삭제할까?'))return;
    await updateRow(selected,{groups:selected.groups.map(g=>g.id===groupId?{...g,items:g.items.filter(x=>x.id!==itemId)}:g)});
  }
  async function addGroup() {
    if(!selected)return;
    const name=window.prompt('새 그룹 이름');if(!clean(name))return;
    await updateRow(selected,{groups:[...selected.groups,{id:uuid(),title:clean(name),items:[]}]});
  }
  async function clone() {
    if(!selected||busy)return;
    setBusy(true);setError('');
    try{
      const groups=selected.groups.map(g=>({...g,id:uuid(),items:g.items.map(x=>({...x,id:uuid(),done:false}))}));
      const {data,error}=await client.from('focus_checklists').insert({user_id:userId,title:selected.title+' 복사',groups}).select().single();
      if(error)throw error;
      setLists(old=>[data,...old]);setSelectedId(data.id);saved('체크하지 않은 새 복사본을 만들었어.');
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function removeList(){
    if(!selected||!window.confirm(`'${selected.title}' 체크리스트를 삭제할까?`))return;
    setBusy(true);try{
      const {error}=await client.from('focus_checklists').delete().eq('user_id',userId).eq('id',selected.id);
      if(error)throw error;
      setLists(old=>old.filter(x=>x.id!==selected.id));setSelectedId(null);setMode('list');saved('삭제했어.');
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  const progress=selected?`${countDone(selected)}/${countAll(selected)}`:'0/0';
  return <section className="cl-page">
    <div className="cl-header">
      <button type="button" className="cl-back" onClick={()=>{if(mode==='list')onClose();else{setMode('list');setEditing(null);}}} aria-label="뒤로가기"><ArrowLeft size={19}/></button>
      <h1>체크리스트</h1>
      {mode==='list'&&<button className="cl-new" onClick={()=>{setSource(starterText);setMode('create');setError('');}}><Plus size={18}/> 추가</button>}
    </div>
    {error&&<p className="cl-error" role="alert">{error}</p>}
    {message&&<p className="cl-message" role="status">{message}</p>}
    {mode==='list'&&<>
      <p className="cl-helper">목록을 선택하면 체크할 수 있어. 새 체크리스트는 글을 붙여넣어서 만들어 줘.</p>
      <div className="cl-list">{lists.map(l=><button className="cl-list-row" key={l.id} onClick={()=>{setSelectedId(l.id);setMode('detail');setMessage('');}}>
        <span><strong>{l.title}</strong><small>{countDone(l)}/{countAll(l)} 완료</small></span><ChevronRight size={18}/>
      </button>)}{!lists.length&&<p className="cl-empty">아직 체크리스트가 없어. + 추가로 만들어 봐!</p>}</div>
    </>}
    {mode==='create'&&<div className="cl-card">
      <h2>글 붙여넣기</h2>
      <p className="cl-helper">첫 줄은 제목, 일반 줄은 그룹, - · ㅁ · ☐ · □ 로 시작하는 줄은 체크 항목이야. 들여쓰기는 필요 없어.</p>
      <textarea aria-label="체크리스트 텍스트" className="cl-import" value={source} onChange={e=>setSource(e.target.value)} rows={15}/>
      <button className="cl-primary" disabled={busy} onClick={createFromText}>체크리스트 생성 및 저장</button>
    </div>}
    {mode==='detail'&&selected&&<>
      <div className="cl-detail-head"><div><h2>{selected.title}</h2><p className="cl-muted">{progress} 완료</p></div>
        <div className="cl-actions">
          <button aria-label="제목 수정" title="제목 수정" onClick={()=>{setEditing({kind:'title'});setDraft(selected.title);}}><Pencil size={17}/></button>
          <button aria-label="체크리스트 복제" title="복제" onClick={clone}><Copy size={17}/></button>
          <button aria-label="체크리스트 삭제" title="삭제" onClick={removeList}><Trash2 size={17}/></button>
        </div>
      </div>
      {selected.groups.map(g=>{
        const closed=!!collapsed[g.id], done=g.items.filter(x=>x.done).length;
        return <div className="cl-card" key={g.id}>
          <div className="cl-group-head">
            <button className="cl-group-toggle" onClick={()=>setCollapsed(p=>({...p,[g.id]:!p[g.id]}))} aria-expanded={!closed}>
              {closed?<ChevronRight size={17}/>:<ChevronDown size={17}/>} <strong>{g.title}</strong>
            </button>
            <span className="cl-muted">{done}/{g.items.length}</span>
            <button className="cl-small" aria-label={`${g.title} 이름 수정`} onClick={()=>{setEditing({kind:'group',groupId:g.id});setDraft(g.title);}}><Pencil size={15}/></button>
          </div>
          {!closed&&<><div className="cl-items">{g.items.map(x=><div className="cl-item" key={x.id}>
            <label className={x.done?'cl-done':''}><input type="checkbox" disabled={busy} checked={!!x.done} onChange={()=>toggleItem(g.id,x.id)}/><span>{x.text}</span></label>
            <button className="cl-small" aria-label={`${x.text} 수정`} onClick={()=>{setEditing({kind:'item',groupId:g.id,itemId:x.id});setDraft(x.text);}}><Pencil size={15}/></button>
            <button className="cl-small" aria-label={`${x.text} 삭제`} onClick={()=>removeItem(g.id,x.id)}><X size={15}/></button>
          </div>)}</div><button className="cl-add" onClick={()=>addItem(g.id)}><Plus size={16}/> 항목 추가</button></>}
        </div>;
      })}
      <button className="cl-add cl-bottom-add" onClick={addGroup}><Plus size={16}/> 그룹 추가</button>
      {editing&&<div className="cl-editor-backdrop" onClick={()=>setEditing(null)}><form className="cl-editor" onSubmit={e=>{e.preventDefault();editText();}} onClick={e=>e.stopPropagation()}>
        <h3>내용 수정</h3><textarea autoFocus rows={3} value={draft} onChange={e=>setDraft(e.target.value)}/>
        <div className="cl-editor-actions"><button type="button" onClick={()=>setEditing(null)}>취소</button><button className="cl-primary" disabled={busy||!clean(draft)}>저장</button></div>
      </form></div>}
    </>}
  </section>;
}
