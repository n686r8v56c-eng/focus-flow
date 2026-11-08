import React, {useRef, useState} from 'react';
import {Plus, Search, Copy, ClipboardPaste, ChevronRight, ChevronDown, Archive, ArchiveRestore, Sun, Folder, X, Pencil, Trash2, ExternalLink, ImagePlus, Check} from 'lucide-react';
import {inboxEntries, inboxTextLines, toggleInboxTextLine, linksIn, makeInboxItems, planInboxItem, youtubeId} from './inbox-model.js';
import './inbox.css';
const newId = () => globalThis.crypto?.randomUUID?.() || `inbox_${Date.now()}_${Math.random().toString(36).slice(2)}`;
export async function copyInboxText(text, notify) {
  try {await navigator.clipboard.writeText(text); notify('복사했어.');}
  catch {
    const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;opacity:0';document.body.append(area);area.select();
    const ok=document.execCommand('copy');area.remove();notify(ok?'복사했어.':'복사 권한을 허용해 줘.');
  }
}

const IMAGE_BUCKET = 'focus-inbox-images';
const IMAGE_LIMIT = 5;
async function prepareImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일만 첨부할 수 있어.');
  if (file.size > 20 * 1024 * 1024) throw new Error('원본 사진은 20MB 이하만 가능해.');
  const source = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = source;
    await img.decode();
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .8));
    if (!blob) throw new Error('사진 변환에 실패했어.');
    return blob;
  } finally { URL.revokeObjectURL(source); }
}
function InboxPhoto({client, path, thumbnail=false}) {
  const [url, setUrl] = React.useState('');
  React.useEffect(() => {
    let active = true;
    if (!client || !path) return;
    client.storage.from(IMAGE_BUCKET).createSignedUrl(path, 3600).then(({data}) => {
      if (active) setUrl(data?.signedUrl || '');
    });
    return () => { active = false; };
  }, [client,path]);
  return url ? <img className={thumbnail?'inbox-thumbnail':'inbox-photo'} src={url} alt="첨부 사진" loading="lazy" onClick={thumbnail?undefined:()=>window.open(url,'_blank','noopener,noreferrer')}/> : <span className="inbox-note-icon"><ImagePlus size={18}/></span>;
}
export function InboxPanel({data, onDataChange, today, renderToday, onOpenTask, notify, storageClient, userId, kind = 'inbox'}) {
  const [view,setView]=useState(kind === 'inbox' ? 'today' : 'inbox'), [draft,setDraft]=useState(''), [query,setQuery]=useState(''), [folderId,setFolderId]=useState(''), [folderDraft,setFolderDraft]=useState(null), [expanded,setExpanded]=useState(null), [edit,setEdit]=useState(null);
  const draftRef=useRef(null);
  const photoInput=useRef(null);
  const [pendingPhotos,setPendingPhotos]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [uploadTarget,setUploadTarget]=useState(null);
  const [photoError,setPhotoError]=useState('');
  async function uploadPhotos(files) {
    if (!storageClient || !userId) throw new Error('로그인 후 사진을 저장할 수 있어.');
    const saved=[];
    try {
      for (const file of files) {
        const blob=await prepareImage(file);
        const path=`${userId}/${newId()}.jpg`;
        const {error}=await storageClient.storage.from(IMAGE_BUCKET).upload(path,blob,{contentType:'image/jpeg',upsert:false});
        if(error) throw error;
        saved.push(path);
      }
      return saved;
    } catch(error) {
      if(saved.length) await storageClient.storage.from(IMAGE_BUCKET).remove(saved).catch(()=>{});
      throw error;
    }
  }
  function addPending(files) {
    const selected=Array.from(files || []).filter(f=>f.type.startsWith('image/'));
    const remaining=IMAGE_LIMIT-pendingPhotos.length;
    if(selected.length>remaining) setPhotoError('사진은 한 메모에 최대 5장까지 첨부할 수 있어.');
    setPendingPhotos(old=>[...old,...selected.slice(0,Math.max(0,remaining))]);
  }
  async function addToEntry(item,files) {
    const selected=Array.from(files || []).filter(f=>f.type.startsWith('image/'));
    const remaining=IMAGE_LIMIT-(item.images || []).length;
    if(!selected.length) return;
    if(selected.length>remaining){setPhotoError('사진은 최대 5장까지 첨부할 수 있어.');return;}
    setUploadTarget(item.id);setPhotoError('');
    try {const paths=await uploadPhotos(selected);changeEntry(item,{images:[...(item.images||[]),...paths]});notify('사진을 추가했어.');}
    catch(e){setPhotoError(e.message || '사진 업로드에 실패했어.');}
    finally {setUploadTarget(null);}
  }
  async function removePhoto(item,path) {
    changeEntry(item,{images:(item.images||[]).filter(p=>p!==path)});
    // The file is intentionally retained to prevent another unsynced device losing it.
  }
  const isOpportunity = kind === 'opportunity';
  const itemsKey = isOpportunity ? 'opportunityItems' : 'inboxItems';
  const foldersKey = isOpportunity ? 'opportunityFolders' : 'inboxFolders';
  const label = isOpportunity ? '기회' : '인박스';
  const folders=data[foldersKey] || [], entries=isOpportunity ? (data[itemsKey] || []) : inboxEntries(data);
  const changeEntry=(item,patch)=>onDataChange(d=>item.legacyTask ? {...d,tasks:d.tasks.map(t=>t.id===item.id?{...t,...patch,...(patch.archived!==undefined?{inboxArchived:patch.archived}:{}),...(patch.text!==undefined?{title:patch.text}: {})}:t)} : {...d,[itemsKey]:(d[itemsKey] || []).map(n=>n.id===item.id?{...n,...patch}:n)});
  const toggleLine=(item,index)=>onDataChange(d=>item.legacyTask
    ? {...d,tasks:d.tasks.map(t=>t.id===item.id?{...t,title:toggleInboxTextLine(t.title || '',index)}:t)}
    : {...d,[itemsKey]:(d[itemsKey] || []).map(n=>n.id===item.id?{...n,text:toggleInboxTextLine(n.text || '',index)}:n)});
  async function capture(text) {
    if(uploading) return;
    const added=makeInboxItems(text,newId);
    if (!added.length && !pendingPhotos.length) return;
    setUploading(true);setPhotoError('');
    try {
      if (pendingPhotos.length) {
        const paths=await uploadPhotos(pendingPhotos);
        if(!added.length) added.push({id:newId(),title:'사진',text:'',url:'',videoId:'',folderId:'',archived:false,createdAt:new Date().toISOString(),images:paths});
        else added[0]={...added[0],images:paths};
      }
    } catch(e) {setPhotoError(e.message || '사진을 저장하지 못했어. 저장소 설정을 확인해 줘.');setUploading(false);return;}
    setUploading(false);setPendingPhotos([]);
    onDataChange(d=>({...d,[itemsKey]:[...(d[itemsKey] || []),...added]}));
    setDraft('');setView('inbox');setFolderId('');setQuery('');notify(`${added.length}개를 ${label}에 담았어.`);
    // Failure to read a public title never prevents the original link from saving.
    for (const item of added.filter(n=>n.videoId)) {
      try {
        const r=await fetch('https://www.youtube.com/oembed?url='+encodeURIComponent(item.url)+'&format=json',{signal:AbortSignal.timeout(7000)});
        if(!r.ok) continue;
        const info=await r.json();
        if(info.title) onDataChange(d=>({...d,[itemsKey]:(d[itemsKey] || []).map(n=>n.id===item.id && n.title===item.title ? {...n,title:info.title} : n)}));
      } catch { /* The saved card keeps its editable fallback title. */ }
    }
  }
  const paste=async()=>{try{await capture(await navigator.clipboard.readText());}catch{draftRef.current?.focus();notify('입력창에 붙여넣어 줘.');}};
  const plan=item=>{onDataChange(d=>planInboxItem(d,item,today));notify('오늘 할 일에 담았어. 원본은 그대로 보관돼.');};
  function saveEdit(item) {
    const text=edit.text.trim(),title=edit.title.trim();if(!text&&!title&&!(item.images||[]).length)return;
    const url=linksIn(text)[0] || '';
    changeEntry(item,{text,title:title || text.split('\n')[0],url,videoId:youtubeId(url)});setEdit(null);
  }
  const shown=entries.filter(n=>view==='archive' ? n.archived : !n.archived && (view!=='inbox'||!n.folderId) && (view!=='folders'||!folderId||n.folderId===folderId))
    .filter(n=>`${n.title || ''} ${n.text || ''} ${n.url || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a,b)=>(b.createdAt || '').localeCompare(a.createdAt || ''));
  return <section className="focus-redesign inbox-page">
    <nav className="focus-segments inbox-segments" aria-label={`${label} 분류`}>{[['inbox',label],['today','오늘'],['folders','폴더'],['archive','보관함']].map(([id,label])=><button type="button" key={id} className={view===id?'selected':''} onClick={()=>setView(id)} aria-pressed={view===id}>{label}</button>)}</nav>
    <form className="focus-panel inbox-capture" onSubmit={e=>{e.preventDefault();capture(draft);}}>
      <textarea ref={draftRef} rows={2} value={draft} onChange={e=>setDraft(e.target.value)} aria-label={`${label}에 담을 내용`} placeholder={isOpportunity ? '모집·공모·제안·협업 기회와 링크를 담기' : '메모·할 일·링크, 일단 여기에 담기'} onPaste={e=>{
        const text=e.clipboardData.getData('text');
        if(!draft.trim() && linksIn(text).length){e.preventDefault();capture(text);}
      }}/>
      {pendingPhotos.length>0&&<div className="inbox-pending-images">{pendingPhotos.map((file,i)=><span key={i}><ImagePlus size={15}/>{file.name}<button type="button" aria-label="선택한 사진 제거" onClick={()=>setPendingPhotos(old=>old.filter((_,n)=>n!==i))}><X size={14}/></button></span>)}</div>}
      <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={e=>{addPending(e.target.files);e.target.value='';}}/>
      <div className="inbox-capture-actions"><button type="button" onClick={()=>photoInput.current?.click()} aria-label="사진 첨부" title="사진 첨부"><ImagePlus size={19}/></button><button type="button" onClick={paste} aria-label="클립보드 붙여넣기" title="붙여넣어 바로 저장"><ClipboardPaste size={18}/></button><button type="submit" className="primary small" disabled={uploading||(!draft.trim()&&!pendingPhotos.length)}>{uploading?'저장 중…':'담기'}</button></div>
    </form>
    {photoError&&<p className="inbox-photo-error" role="alert">{photoError}</p>}
    {view==='today' ? (renderToday ? renderToday() : <div className="focus-empty">오늘의 할 일을 인박스에서 확인해 줘.</div>) : <>
      <div className="inbox-search"><Search size={17}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="제목·내용·링크 검색" aria-label="인박스 검색"/></div>
      {view==='folders' && <div className="inbox-folder-bar">
        <select aria-label="폴더 선택" value={folderId} onChange={e=>setFolderId(e.target.value)}><option value="">모든 폴더와 미분류</option>{folders.map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</select>
        <button type="button" className="focus-move-kind" onClick={()=>setFolderDraft('')}><Plus size={15}/> 폴더</button>
      </div>}
      <section className="focus-panel">{view==='archive'&&entries.some(n=>n.recoveredFrom)&&<p className="focus-help" style={{marginBottom:12}}>동기화 중 다른 수정 내용이 발견되면 복구본을 여기에 보관해. 내용을 확인하고 보관 해제로 다시 꺼낼 수 있어.</p>}<div className="focus-day-title"><h2>{view==='inbox'?'미분류':view==='archive'?'보관함':folders.find(f=>f.id===folderId)?.name || '모든 자료'}</h2><small>{shown.length}개</small></div>
        <div className="focus-task-list">{shown.map(item=>{
          const expandedHere=expanded===item.id;
          const planned=data.tasks.find(t=>t.sourceInboxId===item.id && t.due===today);
          const lines=inboxTextLines(item.text || ''),hasChecklist=lines.some(line=>line.checklist);
          const videoId=item.videoId || youtubeId(item.url),copy=hasChecklist?item.text:item.url || item.text;
          return <article className="inbox-card" key={item.id}>
            <div className="inbox-row">
              <button type="button" className="inbox-open" aria-expanded={expandedHere} onClick={()=>{setExpanded(expandedHere?null:item.id);setEdit(null);}}>
                {item.images?.length?<InboxPhoto client={storageClient} path={item.images[0]} thumbnail/>:videoId?<img className="inbox-thumbnail" src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="영상 썸네일" loading="lazy"/>:<span className="inbox-note-icon"><Pencil size={18}/></span>}
                <span className="inbox-card-text"><b>{item.title || item.text?.split('\n')[0] || '메모'}</b><small>{[folders.find(f=>f.id===item.folderId)?.name || '미분류',item.legacyTask?'기존 할 일':item.images?.length?'사진 '+item.images.length+'장':videoId?'YouTube':item.url?'링크':'메모',item.recoveredFrom?'동기화 복구본':'',planned ? planned.status==='done'?'오늘 완료':'오늘 할 일':'' ].filter(Boolean).join(' · ')}</small></span>
                {expandedHere?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
              </button>
              <button type="button" className="inbox-icon" aria-label={item.url?'링크 복사':'메모 복사'} title={item.url?'링크 복사':'메모 복사'} onClick={()=>copyInboxText(copy,notify)}><Copy size={17}/></button>
              {!item.archived&&<button type="button" className="focus-move-kind inbox-plan" disabled={!!planned} onClick={()=>plan(item)} aria-label="오늘 할 일에 담기"><Sun size={14}/><span>{planned?'담김':'오늘'}</span></button>}
            </div>
            {expandedHere&&<div className="inbox-expanded">
              {edit?.id===item.id?<form className="inbox-edit" onSubmit={e=>{e.preventDefault();saveEdit(item);}}><label>제목<input autoFocus value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})}/></label><label>내용<textarea rows={5} value={edit.text} onChange={e=>setEdit({...edit,text:e.target.value})}/></label><div><button type="button" onClick={()=>setEdit(null)}>취소</button><button type="submit" className="primary small" disabled={!edit.text.trim()&&!edit.title.trim()&&!(item.images||[]).length}>저장</button></div></form>:hasChecklist?<div className="inbox-body inbox-checklist">{lines.map(line=>line.checklist?<button type="button" role="checkbox" aria-checked={line.checked?true:line.active?"mixed":false} aria-label={line.text || "빈 항목"} className={`inbox-checklist-row${line.active?" is-active":""}${line.checked?" is-done":""}`} key={line.index} onClick={()=>toggleLine(item,line.index)}><span className="inbox-checklist-box" aria-hidden="true">{line.checked&&<Check size={16}/>}</span><span className="inbox-checklist-label">{line.text || "\u00a0"}</span></button>:<div className="inbox-text-line" key={line.index}>{line.text || "\u00a0"}</div>)}</div>:<p className="inbox-body">{item.text}</p>}
              {!!item.images?.length&&<div className="inbox-photo-grid">{item.images.map(path=><div key={path} className="inbox-photo-item"><InboxPhoto client={storageClient} path={path}/><button type="button" aria-label="첨부 사진 제거" onClick={()=>removePhoto(item,path)}><X size={16}/></button></div>)}</div>}
              <div className="inbox-tools">
                {!item.legacyTask&&<label className="inbox-add-photo"><ImagePlus size={17}/> {uploadTarget===item.id?'업로드 중…':'사진 추가'}<input type="file" accept="image/*" multiple disabled={uploadTarget===item.id} onChange={e=>{addToEntry(item,e.target.files);e.target.value='';}} hidden/></label>}
                <select value={item.folderId || ''} aria-label="메모 폴더" onChange={e=>changeEntry(item,{folderId:e.target.value})}><option value="">미분류</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>
                <button type="button" onClick={()=>setFolderDraft('')} aria-label="새 폴더"><Folder size={17}/><Plus size={12}/></button>
                {item.url&&<a href={item.url} target="_blank" rel="noopener noreferrer" aria-label="원본 링크 열기"><ExternalLink size={17}/></a>}
                <button type="button" onClick={()=>item.legacyTask?onOpenTask(item.id):setEdit({id:item.id,title:item.title || '',text:item.text || ''})} aria-label="메모 수정"><Pencil size={17}/></button>
                <button type="button" onClick={()=>changeEntry(item,{archived:!item.archived})} aria-label={item.archived?'보관 해제':'보관'} title={item.archived?'보관 해제':'보관'}>{item.archived?<ArchiveRestore size={17}/>:<Archive size={17}/>}</button>
                <button type="button" title="삭제" aria-label="메모 삭제" onClick={()=>{if(!window.confirm('원본 메모를 삭제할까? 이미 담은 할 일은 유지돼.'))return;onDataChange(d=>item.legacyTask?{...d,tasks:d.tasks.filter(t=>t.id!==item.id)}:{...d,[itemsKey]:(d[itemsKey] || []).filter(n=>n.id!==item.id)});setExpanded(null);}}><Trash2 size={17}/></button>
              </div>
            </div>}
          </article>;
        })}</div>
        {!shown.length&&<div className="focus-empty">{query?'검색 결과가 없어.':view==='inbox'?'떠오르는 생각이나 링크를 먼저 담아 봐.':view==='archive'?'보관한 자료가 없어.':'메모를 열어 폴더를 지정하면 여기에 모여.'}</div>}
      </section>
    </>}
    {folderDraft!==null&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setFolderDraft(null)}><form className="sheet" onSubmit={e=>{e.preventDefault();const name=folderDraft.trim();if(!name)return;const existing=folders.find(f=>f.name===name);if(existing){setFolderId(existing.id);setView('folders');setFolderDraft(null);return;}const id=newId();onDataChange(d=>({...d,[foldersKey]:[...(d[foldersKey] || []),{id,name}]}));setFolderDraft(null);notify('폴더를 만들었어. 메모에서 선택해 줘.');}}><div className="sheet-top"><h2>새 폴더</h2><button type="button" onClick={()=>setFolderDraft(null)} aria-label="닫기"><X size={20}/></button></div><label>폴더 이름<input autoFocus required maxLength={40} value={folderDraft} onChange={e=>setFolderDraft(e.target.value)}/></label><button className="primary save" disabled={!folderDraft.trim()}>만들기</button></form></div>}
  </section>;
}
