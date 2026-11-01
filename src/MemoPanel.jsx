import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Pencil, Trash2, Check, X, Star, Search } from 'lucide-react';

const categories = ['지침', '수정사항'];
const displayCategory = value => value === 'Misc' || value === '지침' ? '지침' : '수정사항';
const UNASSIGNED = '__unassigned__';
const ui = {
  field: { width:'100%', maxWidth:'100%', minWidth:0, boxSizing:'border-box', border:'1px solid #e5dcea', borderRadius:12, padding:'12px 13px', background:'#fff', color:'#393343', fontSize:16 },
  card: { minWidth:0, maxWidth:'100%', boxSizing:'border-box', overflow:'hidden', border:'1px solid #e8dfee', borderRadius:15, background:'#fff', padding:13 },
  muted: { color:'#8f809e', fontSize:12 },
};

export function MemoPanel({ data, onDataChange }) {
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const [category, setCategory] = useState('지침');
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const pressTimer = useRef(null);
  const autoSaveTimer = useRef(null);
  const longPressed = useRef(false);
  useEffect(() => () => { clearTimeout(pressTimer.current); clearTimeout(autoSaveTimer.current); }, []);

  const all = Array.isArray(data.projectMemos) ? data.projectMemos : [];
  // Display all existing memos regardless of their former project assignment.
  // Legacy Misc -> 지침; legacy idea/research/action/reflection -> 수정사항.
  const visible = all.filter(m => favoritesOnly ? Boolean(m.favorite) : displayCategory(m.category) === category)
    .filter(m => !search.trim() || [m.text, projects.find(p=>p.id===m.projectId)?.name, displayCategory(m.category)]
      .some(v=>String(v||'').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))
    .slice().sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const change = fn => onDataChange(d => ({ ...d, projectMemos: fn(Array.isArray(d.projectMemos) ? d.projectMemos : []) }));
  const save = e => {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    const id = globalThis.crypto?.randomUUID?.() || `memo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    change(list => [...list, { id, projectId:UNASSIGNED, category, text:content, createdAt:new Date().toISOString() }]);
    setDraft('');
  };
  const startPress = (id, e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    clearTimeout(pressTimer.current);
    longPressed.current = false;
    pressTimer.current = setTimeout(() => { longPressed.current = true; setMenuId(id); }, 550);
  };
  const endPress = () => clearTimeout(pressTimer.current);
  const persistText = (id, value) => { if (!value.trim()) return; change(list => list.map(item => item.id === id ? {...item,text:value,updatedAt:new Date().toISOString()} : item)); };
  const beginEdit = m => { setEditDraft(m.text || ''); setEditingId(m.id); setMenuId(null); setExpandedId(m.id); };
  const commitEdit = id => { clearTimeout(autoSaveTimer.current); persistText(id, editDraft); setEditingId(null); };
  const onEditChange = (id, value) => { setEditDraft(value); clearTimeout(autoSaveTimer.current); autoSaveTimer.current = setTimeout(() => persistText(id,value), 500); };
  const toggleFavorite = m => { change(list => list.map(item => item.id === m.id ? {...item, favorite:!item.favorite} : item)); setMenuId(null); };
  const deleteMemo = id => { if (!window.confirm('이 메모를 삭제할까?')) return; change(list => list.filter(m => m.id !== id)); setMenuId(null); setEditingId(null); };
  const copyMemo = async text => {
    try { await navigator.clipboard.writeText(text || ''); }
    catch { window.prompt('메모를 복사해 줘', text || ''); }
  };

  return <section className="memo-page" style={{paddingBottom:24, width:'100%', maxWidth:'100%', minWidth:0, boxSizing:'border-box', overflowX:'hidden'}}>
    <div className="section-top"><h1>메모</h1></div>
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:15,minWidth:0}}>
      <label style={{display:'flex',alignItems:'center',gap:7,flex:1,minWidth:0,...ui.field,padding:'8px 10px'}}>
        <Search size={17} color="#927db1" style={{flexShrink:0}} />
        <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="메모 검색" aria-label="메모 검색" style={{border:0,outline:0,background:'transparent',width:'100%',minWidth:0,fontSize:14,color:'#393343'}} />
      </label>
      <button type="button" aria-pressed={favoritesOnly} onClick={()=>{setFavoritesOnly(v=>!v);setMenuId(null);setExpandedId(null);}} style={{display:'flex',alignItems:'center',gap:5,flexShrink:0,padding:'10px 11px',border:'1px solid #e5dcea',borderRadius:12,background:favoritesOnly?'#eee7fa':'#fff',color:'#8668b5',fontWeight:700,fontSize:13}}>
        <Star size={17} fill={favoritesOnly?'#9d85ce':'none'}/> 즐겨찾기
      </button>
    </div>
    <div className="pom-subnav" role="tablist" aria-label="메모 분류"
      style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:3,marginBottom:15,minWidth:0}}>
      {categories.map(c=><button type="button" key={c} role="tab" aria-selected={category===c}
        className={category===c?'active':''}
        onClick={()=>{setCategory(c);setExpandedId(null);setMenuId(null);setFavoritesOnly(false);}}
        style={{padding:'10px 2px',minWidth:0,fontSize:13}}>{c}</button>)}
    </div>
    <form onSubmit={save} className="stat-card" style={{padding:15,marginBottom:20,maxWidth:'100%',overflow:'hidden'}}>
      <label htmlFor="memo-draft" style={{display:'block',fontWeight:700,color:'#775991',marginBottom:10}}>{category} 메모</label>
      <textarea id="memo-draft" value={draft} onChange={e=>setDraft(e.target.value)} rows={4} placeholder="메모를 입력해 줘" style={{...ui.field,resize:'vertical',lineHeight:1.6,overflowWrap:'anywhere',wordBreak:'break-word'}} />
      <button type="submit" className="primary" disabled={!draft.trim()} style={{width:'100%',minHeight:46,marginTop:12,borderRadius:12,fontSize:16,fontWeight:750}}>기록하기</button>
    </form>
    <div style={{fontSize:15,fontWeight:750,marginBottom:11}}>메모 목록 <span style={ui.muted}>({visible.length})</span></div>
    <div style={{display:'grid',gap:8,minWidth:0,maxWidth:'100%'}}>
      {visible.map(m => <article key={m.id} style={{...ui.card,WebkitUserSelect:'none',userSelect:'none',WebkitTouchCallout:'none'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
          <button type="button" onPointerDown={e=>startPress(m.id,e)} onPointerUp={endPress} onPointerCancel={endPress} onPointerLeave={endPress} onContextMenu={e=>{e.preventDefault();endPress();setMenuId(m.id);}} onSelectStart={e=>e.preventDefault()} onDragStart={e=>e.preventDefault()} onClick={()=>{if(longPressed.current){longPressed.current=false;return;}setMenuId(null);setExpandedId(x=>x===m.id?null:m.id);}} style={{display:'flex',alignItems:'center',gap:7,flex:1,minWidth:0,textAlign:'left',padding:'5px 0',touchAction:'pan-y'}} title="터치해 펼치기 · 길게 눌러 수정·삭제·즐겨찾기">
            {expandedId===m.id?<ChevronDown size={16} color="#9c84c5"/>:<ChevronRight size={16} color="#9c84c5"/>}
            {m.favorite && <Star size={13} fill="#a18ad1" color="#a18ad1" style={{flexShrink:0}}/>}
            <span style={{fontSize:14,fontWeight:650,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{(m.text||'').split('\n')[0]}</span>
          </button>
          <button type="button" onClick={()=>copyMemo(m.text)} aria-label="메모 복사" title="메모 복사" style={{color:'#9476c5',padding:7,flexShrink:0}}><Copy size={18}/></button>
        </div>
        {menuId===m.id && <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:9,borderTop:'1px solid #f0eaf5',paddingTop:9}}>
          <button type="button" onClick={()=>beginEdit(m)} style={{display:'flex',alignItems:'center',gap:5,color:'#8061b5',padding:7}}><Pencil size={16}/> 수정</button>
          <button type="button" onClick={()=>toggleFavorite(m)} style={{display:'flex',alignItems:'center',gap:5,color:'#8061b5',padding:7}}><Star size={16} fill={m.favorite?'#a18ad1':'none'}/> {m.favorite?'즐겨찾기 해제':'즐겨찾기'}</button>
          <button type="button" onClick={()=>deleteMemo(m.id)} style={{display:'flex',alignItems:'center',gap:5,color:'#b9677d',padding:7}}><Trash2 size={16}/> 삭제</button>
          <button type="button" onClick={()=>setMenuId(null)} aria-label="메뉴 닫기" style={{marginLeft:'auto',padding:7}}><X size={16}/></button>
        </div>}
        {editingId===m.id ? <div style={{marginTop:10}}>
          <textarea autoFocus rows={5} value={editDraft} onChange={e=>onEditChange(m.id,e.target.value)} onBlur={()=>commitEdit(m.id)} style={{...ui.field,resize:'vertical',fontSize:16,overflowWrap:'anywhere',wordBreak:'break-word'}} />
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
            <button type="button" onClick={()=>commitEdit(m.id)} style={{padding:9}}>닫기</button>
            <button type="button" onClick={()=>commitEdit(m.id)} disabled={!editDraft.trim()} style={{padding:'9px 14px',borderRadius:9,background:'#a18ad1',color:'white',display:'flex',gap:4,alignItems:'center'}}><Check size={15}/> 저장</button>
          </div>
        </div> : expandedId===m.id && <div onClick={()=>beginEdit(m)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')beginEdit(m)}} title="탭해서 수정" style={{borderTop:'1px solid #f0eaf5',paddingTop:10,marginTop:9,whiteSpace:'pre-wrap',overflowWrap:'anywhere',wordBreak:'break-word',maxWidth:'100%',minWidth:0,overflowX:'hidden',fontSize:14,lineHeight:1.6,cursor:'text'}}>
          {m.text}
          {favoritesOnly && <div style={{...ui.muted,marginTop:8}}>{m.projectId===UNASSIGNED ? '미지정' : (projects.find(p=>p.id===m.projectId)?.name || '프로젝트 없음')}</div>}
        </div>}
      </article>)}
      {!visible.length && <p className="hint">{favoritesOnly?'즐겨찾기한 메모가 없어.':search.trim()?'검색 결과가 없어.':'아직 메모가 없어. 첫 메모를 기록해 봐.'}</p>}
    </div>
  </section>;
}
