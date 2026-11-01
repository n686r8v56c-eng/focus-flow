import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Pencil, Trash2, Check, X } from 'lucide-react';

const categories = ['아이디어', '조사', '실행', '반성'];
const ui = {
  field: { width:'100%', maxWidth:'100%', minWidth:0, boxSizing:'border-box', border:'1px solid #e5dcea', borderRadius:12, padding:'12px 13px', background:'#fff', color:'#393343', fontSize:16 },
  card: { border:'1px solid #e8dfee', borderRadius:15, background:'#fff', padding:13 },
  muted: { color:'#8f809e', fontSize:12 },
};

export function MemoPanel({ data, onDataChange }) {
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const [projectId, setProjectId] = useState(() => projects[0]?.id || '');
  const [category, setCategory] = useState('아이디어');
  const [draft, setDraft] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const pressTimer = useRef(null);
  const longPressed = useRef(false);
  useEffect(() => { if (projectId !== 'all' && !projects.some(p => p.id === projectId)) setProjectId(projects[0]?.id || ''); }, [projects, projectId]);
  useEffect(() => () => clearTimeout(pressTimer.current), []);

  const all = Array.isArray(data.projectMemos) ? data.projectMemos : [];
  const visible = all.filter(m => m.category === category && (projectId === 'all' || m.projectId === projectId))
    .slice().sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const change = fn => onDataChange(d => ({ ...d, projectMemos: fn(Array.isArray(d.projectMemos) ? d.projectMemos : []) }));
  const save = e => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !projectId || projectId === 'all') return;
    const id = globalThis.crypto?.randomUUID?.() || `memo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    change(list => [...list, { id, projectId, category, text:content, createdAt:new Date().toISOString() }]);
    setDraft('');
  };
  const startPress = (id, e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    clearTimeout(pressTimer.current);
    longPressed.current = false;
    pressTimer.current = setTimeout(() => { longPressed.current = true; setMenuId(id); }, 550);
  };
  const endPress = () => clearTimeout(pressTimer.current);
  const beginEdit = m => { setEditDraft(m.text || ''); setEditingId(m.id); setMenuId(null); setExpandedId(m.id); };
  const commitEdit = id => { const value = editDraft.trim(); if (!value) return; change(list => list.map(m => m.id === id ? { ...m, text:value, updatedAt:new Date().toISOString() } : m)); setEditingId(null); };
  const deleteMemo = id => { if (!window.confirm('이 메모를 삭제할까?')) return; change(list => list.filter(m => m.id !== id)); setMenuId(null); setEditingId(null); };
  const copyMemo = async text => {
    try { await navigator.clipboard.writeText(text || ''); }
    catch { window.prompt('메모를 복사해 줘', text || ''); }
  };

  return <section className="memo-page" style={{paddingBottom:24, maxWidth:'100%', minWidth:0}}>
    <div className="section-top"><h1>메모</h1></div>
    <label htmlFor="memo-project" style={{display:'block',fontWeight:700,color:'#826c98',marginBottom:8}}>프로젝트</label>
    <select id="memo-project" value={projectId} onChange={e=>{setProjectId(e.target.value);setMenuId(null);setExpandedId(null);}} style={{...ui.field,marginBottom:15}}>
      {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      <option value="all">전체 프로젝트 (조회)</option>
    </select>
    <div className="pom-subnav" role="tablist" aria-label="메모 분류" style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:2,marginBottom:15}}>
      {categories.map(c=><button type="button" key={c} role="tab" aria-selected={category===c} className={category===c?'active':''} onClick={()=>{setCategory(c);setExpandedId(null);setMenuId(null);}} style={{padding:'12px 2px',minWidth:0,fontSize:14}}>{c}</button>)}
    </div>
    <form onSubmit={save} className="stat-card" style={{padding:15,marginBottom:20,maxWidth:'100%',overflow:'hidden'}}>
      <label htmlFor="memo-draft" style={{display:'block',fontWeight:700,color:'#775991',marginBottom:10}}>{category} 메모</label>
      <textarea id="memo-draft" value={draft} onChange={e=>setDraft(e.target.value)} rows={4} placeholder={projectId==='all'?'기록할 프로젝트를 선택해 줘':'메모를 입력해 줘'} disabled={!projectId || projectId==='all'} style={{...ui.field,resize:'vertical',lineHeight:1.6}} />
      <button type="submit" className="primary" disabled={!draft.trim() || !projectId || projectId==='all'} style={{width:'100%',minHeight:46,marginTop:12,borderRadius:12,fontSize:16,fontWeight:750}}>기록하기</button>
    </form>
    <div style={{fontSize:15,fontWeight:750,marginBottom:11}}>메모 목록 <span style={ui.muted}>({visible.length})</span></div>
    <div style={{display:'grid',gap:8}}>
      {visible.map(m => <article key={m.id} style={ui.card}>
        <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
          <button type="button" onPointerDown={e=>startPress(m.id,e)} onPointerUp={endPress} onPointerCancel={endPress} onPointerLeave={endPress} onContextMenu={e=>{e.preventDefault();setMenuId(m.id);}} onClick={()=>{if(longPressed.current){longPressed.current=false;return;}setMenuId(null);setExpandedId(x=>x===m.id?null:m.id);}} style={{display:'flex',alignItems:'center',gap:7,flex:1,minWidth:0,textAlign:'left',padding:'5px 0',touchAction:'pan-y'}} title="터치해 펼치기 · 길게 눌러 수정 또는 삭제">
            {expandedId===m.id?<ChevronDown size={16} color="#9c84c5"/>:<ChevronRight size={16} color="#9c84c5"/>}
            <span style={{fontSize:14,fontWeight:650,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{(m.text||'').split('\n')[0]}</span>
          </button>
          <button type="button" onClick={()=>copyMemo(m.text)} aria-label="메모 복사" title="메모 복사" style={{color:'#9476c5',padding:7,flexShrink:0}}><Copy size={18}/></button>
        </div>
        {menuId===m.id && <div style={{display:'flex',gap:8,marginTop:9,borderTop:'1px solid #f0eaf5',paddingTop:9}}>
          <button type="button" onClick={()=>beginEdit(m)} style={{display:'flex',alignItems:'center',gap:5,color:'#8061b5',padding:7}}><Pencil size={16}/> 수정</button>
          <button type="button" onClick={()=>deleteMemo(m.id)} style={{display:'flex',alignItems:'center',gap:5,color:'#b9677d',padding:7}}><Trash2 size={16}/> 삭제</button>
          <button type="button" onClick={()=>setMenuId(null)} aria-label="메뉴 닫기" style={{marginLeft:'auto',padding:7}}><X size={16}/></button>
        </div>}
        {editingId===m.id ? <div style={{marginTop:10}}>
          <textarea rows={4} value={editDraft} onChange={e=>setEditDraft(e.target.value)} style={{...ui.field,resize:'vertical'}} />
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
            <button type="button" onClick={()=>setEditingId(null)} style={{padding:9}}>취소</button>
            <button type="button" onClick={()=>commitEdit(m.id)} disabled={!editDraft.trim()} style={{padding:'9px 14px',borderRadius:9,background:'#a18ad1',color:'white',display:'flex',gap:4,alignItems:'center'}}><Check size={15}/> 저장</button>
          </div>
        </div> : expandedId===m.id && <div style={{borderTop:'1px solid #f0eaf5',paddingTop:10,marginTop:9,whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:14,lineHeight:1.6}}>
          {m.text}
          {projectId==='all' && <div style={{...ui.muted,marginTop:8}}>{projects.find(p=>p.id===m.projectId)?.name || '프로젝트 없음'}</div>}
        </div>}
      </article>)}
      {!visible.length && <p className="hint">아직 메모가 없어. 첫 메모를 기록해 봐.</p>}
    </div>
  </section>;
}
