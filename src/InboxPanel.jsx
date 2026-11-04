import React, {useRef, useState} from 'react';
import {Plus, Search, Copy, ClipboardPaste, ChevronRight, ChevronDown, Archive, ArchiveRestore, Sun, Folder, X, Pencil, Trash2, ExternalLink} from 'lucide-react';
import {inboxEntries, linksIn, makeInboxItems, planInboxItem, youtubeId} from './inbox-model.js';
import './inbox.css';
const newId = () => globalThis.crypto?.randomUUID?.() || `inbox_${Date.now()}_${Math.random().toString(36).slice(2)}`;
export async function copyInboxText(text, notify) {
  try {await navigator.clipboard.writeText(text); notify('복사했어.');}
  catch {
    const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;opacity:0';document.body.append(area);area.select();
    const ok=document.execCommand('copy');area.remove();notify(ok?'복사했어.':'복사 권한을 허용해 줘.');
  }
}
export function InboxPanel({data, onDataChange, today, renderToday, onOpenTask, notify}) {
  const [view,setView]=useState('inbox'), [draft,setDraft]=useState(''), [query,setQuery]=useState(''), [folderId,setFolderId]=useState(''), [folderDraft,setFolderDraft]=useState(null), [expanded,setExpanded]=useState(null), [edit,setEdit]=useState(null);
  const draftRef=useRef(null);
  const folders=data.inboxFolders || [], entries=inboxEntries(data);
  const changeEntry=(item,patch)=>onDataChange(d=>item.legacyTask ? {...d,tasks:d.tasks.map(t=>t.id===item.id?{...t,...patch,...(patch.archived!==undefined?{inboxArchived:patch.archived}:{}),...(patch.text!==undefined?{title:patch.text}: {})}:t)} : {...d,inboxItems:(d.inboxItems || []).map(n=>n.id===item.id?{...n,...patch}:n)});
  async function capture(text) {
    const added=makeInboxItems(text,newId);
    if (!added.length) return;
    onDataChange(d=>({...d,inboxItems:[...(d.inboxItems || []),...added]}));
    setDraft('');setView('inbox');setFolderId('');setQuery('');notify(`${added.length}개를 인박스에 담았어.`);
    // Failure to read a public title never prevents the original link from saving.
    for (const item of added.filter(n=>n.videoId)) {
      try {
        const r=await fetch('https://www.youtube.com/oembed?url='+encodeURIComponent(item.url)+'&format=json',{signal:AbortSignal.timeout(7000)});
        if(!r.ok) continue;
        const info=await r.json();
        if(info.title) onDataChange(d=>({...d,inboxItems:(d.inboxItems || []).map(n=>n.id===item.id && n.title===item.title ? {...n,title:info.title} : n)}));
      } catch { /* The saved card keeps its editable fallback title. */ }
    }
  }
  const paste=async()=>{try{await capture(await navigator.clipboard.readText());}catch{draftRef.current?.focus();notify('입력창에 붙여넣어 줘.');}};
  const plan=item=>{onDataChange(d=>planInboxItem(d,item,today));notify('오늘 할 일에 담았어. 원본은 그대로 보관돼.');};
  function saveEdit(item) {
    const text=edit.text.trim(),title=edit.title.trim();if(!text&&!title)return;
    const url=linksIn(text)[0] || '';
    changeEntry(item,{text,title:title || text.split('\n')[0],url,videoId:youtubeId(url)});setEdit(null);
  }
  const shown=entries.filter(n=>view==='archive' ? n.archived : !n.archived && (view!=='inbox'||!n.folderId) && (view!=='folders'||!folderId||n.folderId===folderId))
    .filter(n=>`${n.title || ''} ${n.text || ''} ${n.url || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a,b)=>(b.createdAt || '').localeCompare(a.createdAt || ''));
  return <section className="focus-redesign inbox-page">
    <div className="section-top"><h1>인박스</h1><button className="primary small" onClick={()=>draftRef.current?.focus()}><Plus size={16}/> 담기</button></div>
    <nav className="focus-segments inbox-segments" aria-label="인박스 분류">{[['inbox','인박스'],['today','오늘'],['folders','폴더'],['archive','보관함']].map(([id,label])=><button type="button" key={id} className={view===id?'selected':''} onClick={()=>setView(id)} aria-pressed={view===id}>{label}</button>)}</nav>
    <form className="focus-panel inbox-capture" onSubmit={e=>{e.preventDefault();capture(draft);}}>
      <textarea ref={draftRef} rows={2} value={draft} onChange={e=>setDraft(e.target.value)} aria-label="인박스에 담을 내용" placeholder="메모·할 일·링크, 일단 여기에 담기" onPaste={e=>{
        const text=e.clipboardData.getData('text');
        if(!draft.trim() && linksIn(text).length){e.preventDefault();capture(text);}
      }}/>
      <div className="inbox-capture-actions"><span>분류는 나중에 해도 괜찮아.</span><button type="button" onClick={paste} aria-label="클립보드 붙여넣기" title="붙여넣어 바로 저장"><ClipboardPaste size={18}/></button><button type="submit" className="primary small" disabled={!draft.trim()}>담기</button></div>
    </form>
    {view==='today' ? renderToday() : <>
      <div className="inbox-search"><Search size={17}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="제목·내용·링크 검색" aria-label="인박스 검색"/></div>
      {view==='folders' && <div className="inbox-folder-bar">
        <select aria-label="폴더 선택" value={folderId} onChange={e=>setFolderId(e.target.value)}><option value="">모든 폴더와 미분류</option>{folders.map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</select>
        <button type="button" className="focus-move-kind" onClick={()=>setFolderDraft('')}><Plus size={15}/> 폴더</button>
      </div>}
      <section className="focus-panel"><div className="focus-day-title"><h2>{view==='inbox'?'미분류':view==='archive'?'보관함':folders.find(f=>f.id===folderId)?.name || '모든 자료'}</h2><small>{shown.length}개</small></div>
        <div className="focus-task-list">{shown.map(item=>{
          const expandedHere=expanded===item.id;
          const planned=data.tasks.find(t=>t.sourceInboxId===item.id && t.due===today);
          const videoId=item.videoId || youtubeId(item.url),copy=item.url || item.text;
          return <article className="inbox-card" key={item.id}>
            <div className="inbox-row">
              <button type="button" className="inbox-open" aria-expanded={expandedHere} onClick={()=>{setExpanded(expandedHere?null:item.id);setEdit(null);}}>
                {videoId?<img className="inbox-thumbnail" src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="영상 썸네일" loading="lazy"/>:<span className="inbox-note-icon"><Pencil size={18}/></span>}
                <span className="inbox-card-text"><b>{item.title || item.text?.split('\n')[0] || '메모'}</b><small>{[folders.find(f=>f.id===item.folderId)?.name || '미분류',item.legacyTask?'기존 할 일':videoId?'YouTube':item.url?'링크':'메모',planned ? planned.status==='done'?'오늘 완료':'오늘 할 일':'' ].filter(Boolean).join(' · ')}</small></span>
                {expandedHere?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
              </button>
              <button type="button" className="inbox-icon" aria-label={item.url?'링크 복사':'메모 복사'} title={item.url?'링크 복사':'메모 복사'} onClick={()=>copyInboxText(copy,notify)}><Copy size={17}/></button>
              {!item.archived&&<button type="button" className="focus-move-kind inbox-plan" disabled={!!planned} onClick={()=>plan(item)} aria-label="오늘 할 일에 담기"><Sun size={14}/><span>{planned?'담김':'오늘'}</span></button>}
            </div>
            {expandedHere&&<div className="inbox-expanded">
              {edit?.id===item.id?<form className="inbox-edit" onSubmit={e=>{e.preventDefault();saveEdit(item);}}><label>제목<input autoFocus value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})}/></label><label>내용<textarea rows={5} value={edit.text} onChange={e=>setEdit({...edit,text:e.target.value})}/></label><div><button type="button" onClick={()=>setEdit(null)}>취소</button><button type="submit" className="primary small" disabled={!edit.text.trim()&&!edit.title.trim()}>저장</button></div></form>:<p className="inbox-body">{item.text}</p>}
              <div className="inbox-tools">
                <select value={item.folderId || ''} aria-label="메모 폴더" onChange={e=>changeEntry(item,{folderId:e.target.value})}><option value="">미분류</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>
                <button type="button" onClick={()=>setFolderDraft('')} aria-label="새 폴더"><Folder size={17}/><Plus size={12}/></button>
                {item.url&&<a href={item.url} target="_blank" rel="noopener noreferrer" aria-label="원본 링크 열기"><ExternalLink size={17}/></a>}
                <button type="button" onClick={()=>item.legacyTask?onOpenTask(item.id):setEdit({id:item.id,title:item.title || '',text:item.text || ''})} aria-label="메모 수정"><Pencil size={17}/></button>
                <button type="button" onClick={()=>changeEntry(item,{archived:!item.archived})} aria-label={item.archived?'보관 해제':'보관'} title={item.archived?'보관 해제':'보관'}>{item.archived?<ArchiveRestore size={17}/>:<Archive size={17}/>}</button>
                <button type="button" title="삭제" aria-label="메모 삭제" onClick={()=>{if(!window.confirm('원본 메모를 삭제할까? 이미 담은 할 일은 유지돼.'))return;onDataChange(d=>item.legacyTask?{...d,tasks:d.tasks.filter(t=>t.id!==item.id)}:{...d,inboxItems:(d.inboxItems || []).filter(n=>n.id!==item.id)});setExpanded(null);}}><Trash2 size={17}/></button>
              </div>
            </div>}
          </article>;
        })}</div>
        {!shown.length&&<div className="focus-empty">{query?'검색 결과가 없어.':view==='inbox'?'떠오르는 생각이나 링크를 먼저 담아 봐.':view==='archive'?'보관한 자료가 없어.':'메모를 열어 폴더를 지정하면 여기에 모여.'}</div>}
      </section>
    </>}
    {folderDraft!==null&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setFolderDraft(null)}><form className="sheet" onSubmit={e=>{e.preventDefault();const name=folderDraft.trim();if(!name)return;const existing=folders.find(f=>f.name===name);if(existing){setFolderId(existing.id);setView('folders');setFolderDraft(null);return;}const id=newId();onDataChange(d=>({...d,inboxFolders:[...(d.inboxFolders || []),{id,name}]}));setFolderDraft(null);notify('폴더를 만들었어. 메모에서 선택해 줘.');}}><div className="sheet-top"><h2>새 폴더</h2><button type="button" onClick={()=>setFolderDraft(null)} aria-label="닫기"><X size={20}/></button></div><label>폴더 이름<input autoFocus required maxLength={40} value={folderDraft} onChange={e=>setFolderDraft(e.target.value)}/></label><button className="primary save" disabled={!folderDraft.trim()}>만들기</button></form></div>}
  </section>;
}
