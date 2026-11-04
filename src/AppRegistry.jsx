import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, Copy, ExternalLink, Upload, Download, ChevronRight, X, Check, RefreshCw } from 'lucide-react';
import './app-registry.css';

const STATUSES = ['배포 후 수정','배포','개발 중','기획 중','보류'];
const FILTER_STATUSES = ['배포 후 수정','배포','개발 중','기획 중'];
const FILTER_LABELS = {'배포 후 수정':'수정','배포':'배포','개발 중':'개발','기획 중':'기획'};
const emptyApp = (status='배포') => ({ name:'',status,email_account_id:'',deployment_url:'',memo:'' });
const emptyAccount = () => ({email:'',memo:''});
const id = () => crypto.randomUUID();
const norm = s => String(s || '').trim();
const low = s => norm(s).toLocaleLowerCase();
const validUrl = value => { if (!value) return true; try { return ['http:','https:'].includes(new URL(value).protocol); } catch { return false; } };
const download = (name,content,type='application/json') => { const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500); };
const readCSV = text => { const rows=[];let row=[],field='',quoted=false; text=text.replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}else field+=c;}row.push(field);if(row.some(Boolean))rows.push(row);return rows;};
// Browser-native XLSX reader. Reads the first worksheet; no external CDN or extra npm dependency.
async function readXlsx(file){
 const bytes=new Uint8Array(await file.arrayBuffer()), dv=new DataView(bytes.buffer);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(dv.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error('올바른 XLSX 파일이 아니야.');
 let pos=dv.getUint32(end+16,true),count=dv.getUint16(end+10,true);const files=new Map();
 for(let j=0;j<count;j++){
  if(dv.getUint32(pos,true)!==0x02014b50)throw Error('XLSX 압축 목록을 읽지 못했어.');
  const method=dv.getUint16(pos+10,true),size=dv.getUint32(pos+20,true),nl=dv.getUint16(pos+28,true),ex=dv.getUint16(pos+30,true),cl=dv.getUint16(pos+32,true),offset=dv.getUint32(pos+42,true);
  const name=new TextDecoder().decode(bytes.subarray(pos+46,pos+46+nl));files.set(name,{method,size,offset});pos+=46+nl+ex+cl;
 }
 const get=async name=>{const f=files.get(name);if(!f)return null;const p=f.offset;if(dv.getUint32(p,true)!==0x04034b50)throw Error('XLSX 파일을 읽을 수 없어.');const start=p+30+dv.getUint16(p+26,true)+dv.getUint16(p+28,true);const buf=bytes.slice(start,start+f.size);if(f.method===0)return new TextDecoder().decode(buf);if(f.method!==8||!globalThis.DecompressionStream)throw Error('이 브라우저에서 XLSX 압축을 지원하지 않아. CSV로 저장해 가져와 줘.');const stream=new Blob([buf]).stream().pipeThrough(new DecompressionStream('deflate-raw'));return await new Response(stream).text();};
 const parse=xml=>new DOMParser().parseFromString(xml,'application/xml');
 const ss=await get('xl/sharedStrings.xml');const shared=ss?Array.from(parse(ss).getElementsByTagName('si')).map(n=>Array.from(n.getElementsByTagName('t')).map(t=>t.textContent).join('')):[];
 const wb=await get('xl/workbook.xml');let path='xl/worksheets/sheet1.xml';
 if(wb){const doc=parse(wb),sheet=doc.getElementsByTagName('sheet')[0];const rid=sheet?.getAttribute('r:id');const rel=await get('xl/_rels/workbook.xml.rels');if(rid&&rel){const relationship=Array.from(parse(rel).getElementsByTagName('Relationship')).find(x=>x.getAttribute('Id')===rid);const target=relationship?.getAttribute('Target');if(target)path=target.startsWith('/')?target.slice(1):target.startsWith('xl/')?target:'xl/'+target.replace(/^\.\//,'');}}
 const xml=await get(path);if(!xml)throw Error('첫 번째 시트를 찾지 못했어.');
 const doc=parse(xml),rows=[];
 for(const r of doc.getElementsByTagName('row')){const values=[];for(const c of r.getElementsByTagName('c')){const ref=c.getAttribute('r')||'A1',letters=ref.match(/^[A-Z]+/)?.[0]||'A';let col=0;for(const letter of letters)col=col*26+letter.charCodeAt(0)-64;const v=c.getElementsByTagName('v')[0]?.textContent||'';const inline=c.getElementsByTagName('is')[0];values[col-1]=c.getAttribute('t')==='s'?shared[Number(v)]||'':inline?Array.from(inline.getElementsByTagName('t')).map(x=>x.textContent).join(''):v;}rows.push(values);}
 return rows;
}
const parseSheet = rows => {
 if(!rows.length)throw Error('가져올 데이터가 없어.');
 const header=rows[0].map(x=>low(x).replace(/\s/g,''));
 const find=(...terms)=>header.findIndex(x=>terms.some(t=>x.includes(t)));
 const nameCol=find('앱이름','앱명','appname','name'), emailCol=find('가입이메일','이메일','email'), urlCol=find('cloudflare배포url','배포url','배포주소','deploymenturl','url'), statusCol=find('진행상태','개발상태','status'), memoCol=find('메모','memo','비고');
 if(nameCol<0)throw Error('앱 이름 열을 찾지 못했어. 첫 행의 제목을 확인해 줘.');
 const ghCol=find('github'),supCol=find('supabase프로젝트');
 return rows.slice(1).filter(r=>norm(r[nameCol])).map(r=>{
 const url=norm(urlCol>=0?r[urlCol]:'');const rawStatus=norm(statusCol>=0?r[statusCol]:'');const status=STATUSES.includes(rawStatus)?rawStatus:(url?'배포':'기획 중');
 const extras=[ghCol>=0&&r[ghCol]?`GitHub: ${r[ghCol]}`:'',supCol>=0&&r[supCol]?`Supabase: ${r[supCol]}`:''].filter(Boolean);
 return {name:norm(r[nameCol]),status,email:norm(emailCol>=0?r[emailCol]:''),deployment_url:url,memo:[norm(memoCol>=0?r[memoCol]:''),...extras].filter(Boolean).join('\n'),selected:true,action:'new'};
 });
};
const fieldLabel=(label,child)=><label className="ar-label">{label}{child}</label>;

export function AppRegistry({client,userId,onClose}){
 const [tab,setTab]=useState('apps'),[status,setStatus]=useState('배포'),[apps,setApps]=useState([]),[accounts,setAccounts]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[view,setView]=useState(null),[editing,setEditing]=useState(false),[draft,setDraft]=useState(null),[preview,setPreview]=useState(null),[importAccounts,setImportAccounts]=useState([]);const inputRef=useRef(null),filePickerOpenRef=useRef(false);
 const load=useCallback(async()=>{if(!client||!userId)return;setLoading(true);setError('');try{const [a,b]=await Promise.all([client.from('app_registry_apps').select('*').eq('user_id',userId).order('name'),client.from('app_registry_accounts').select('*').eq('user_id',userId).order('email')]);if(a.error)throw a.error;if(b.error)throw b.error;setApps(a.data||[]);setAccounts(b.data||[]);}catch(e){setError(`서버 데이터를 불러오지 못했어. SQL과 연결 상태를 확인해 줘. (${e.message})`);}finally{setLoading(false);}},[client,userId]);
 useEffect(()=>{load();},[load]);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible'&&!filePickerOpenRef.current)load();};document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);return()=>{document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);};},[load]);
 useEffect(()=>{if(!client||!userId)return;const ch=client.channel(`app-registry-${userId}`).on('postgres_changes',{event:'*',schema:'public',table:'app_registry_apps',filter:`user_id=eq.${userId}`},()=>load()).on('postgres_changes',{event:'*',schema:'public',table:'app_registry_accounts',filter:`user_id=eq.${userId}`},()=>load()).subscribe();return()=>{client.removeChannel(ch);};},[client,userId,load]);
 const fail=e=>{setError(e.message||String(e));setNotice('');};
 const success=msg=>{setError('');setNotice(msg);};
 const saveApp=async()=>{const name=norm(draft?.name),url=norm(draft?.deployment_url),email=low(draft?.email_text ?? accounts.find(a=>a.id===draft?.email_account_id)?.email);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setError('올바른 이메일 주소를 입력해 줘.');return;}if(!name){setError('앱 이름을 입력해 줘.');return;}if(!validUrl(url)){setError('배포 URL은 http:// 또는 https:// 주소로 입력해 줘.');return;}if(apps.some(a=>low(a.name)===low(name)&&a.id!==draft.id)&&!window.confirm('같은 이름의 앱이 이미 있어. 그래도 저장할까?'))return;if(draft.status==='배포'&&!url&&!window.confirm('배포 URL이 등록되지 않았어. 배포 상태로 저장할까?'))return;
 setBusy(true);setError('');try{
 let linkedAccountId=null;
 if(email){
   const existing=accounts.find(a=>low(a.email)===email);
   if(existing) linkedAccountId=existing.id;
   else {
     const accountId=id();
     const {data:created,error:accountError}=await client.from('app_registry_accounts')
       .insert({id:accountId,user_id:userId,email,memo:''})
       .select('id').single();
     if(accountError){
       // A concurrent device may have registered the same email already.
       if(accountError.code!=='23505')throw accountError;
       const {data:found,error:findError}=await client.from('app_registry_accounts')
         .select('id').eq('user_id',userId).eq('email',email).single();
       if(findError)throw findError;
       linkedAccountId=found.id;
     }else linkedAccountId=created.id;
   }
 }
 const payload={user_id:userId,name,status:draft.status,email_account_id:linkedAccountId,deployment_url:url||null,memo:norm(draft.memo)};const q=draft.id?client.from('app_registry_apps').update(payload).eq('id',draft.id).eq('user_id',userId):client.from('app_registry_apps').insert({...payload,id:id()});const {error:e}=await q;if(e)throw e;setStatus(draft.status);setEditing(false);setDraft(null);setView(null);await load();success('앱 정보를 저장했어.');}catch(e){fail(e);}finally{setBusy(false);}};
 const saveAccount=async()=>{const email=low(draft?.email);if(!/^\S+@\S+\.\S+$/.test(email)){setError('올바른 이메일 주소를 입력해 줘.');return;}if(accounts.some(a=>low(a.email)===email&&a.id!==draft.id)){setError('이미 등록된 이메일이야.');return;}setBusy(true);setError('');try{const payload={user_id:userId,email,memo:norm(draft.memo)};const {error:e}=await(draft.id?client.from('app_registry_accounts').update(payload).eq('id',draft.id).eq('user_id',userId):client.from('app_registry_accounts').insert({...payload,id:id()}));if(e)throw e;setEditing(false);setDraft(null);setView(null);await load();success('계정을 저장했어.');}catch(e){fail(e);}finally{setBusy(false);}};
 const remove=async(kind,item)=>{const connected=kind==='accounts'?apps.filter(a=>a.email_account_id===item.id):[];const msg=kind==='apps'?'이 앱을 관리 목록에서 삭제하시겠습니까? 실제 배포된 앱이나 외부 서비스는 삭제되지 않습니다.':`이 계정을 관리 목록에서 삭제할까? 연결된 앱 ${connected.length}개는 유지되고 이메일 연결만 해제돼. 실제 Gmail이나 Supabase 계정은 삭제되지 않아.`;if(!window.confirm(msg))return;setBusy(true);setError('');try{const {error:e}=await client.from(kind==='apps'?'app_registry_apps':'app_registry_accounts').delete().eq('id',item.id).eq('user_id',userId);if(e)throw e;setView(null);await load();success('관리대장 기록만 삭제했어.');}catch(e){fail(e);}finally{setBusy(false);}};
 const openNew=()=>{setError('');setView(null);setDraft(tab==='apps'?emptyApp(status):emptyAccount());setEditing(true);};
 const openItem=item=>{setView(item);setDraft(null);setEditing(false);setError('');};
 const editItem=()=>{setDraft({...view});setEditing(true);};
 const copy=async s=>{try{await navigator.clipboard.writeText(s);success('복사했어.');}catch{window.prompt('복사할 내용',s);}};
 const importFile=async file=>{filePickerOpenRef.current=false;if(!file){setNotice('파일 선택이 취소되었어.');return;}setError('');setNotice(`파일 읽는 중: ${file.name}`);try{const ext=file.name.split('.').pop().toLowerCase();let rows;if(ext==='csv')rows=readCSV(await file.text());else if(ext==='xlsx')rows=await readXlsx(file);else if(ext==='json'){
 const obj=JSON.parse(await file.text());if(!Array.isArray(obj.apps)||!Array.isArray(obj.accounts))throw Error('App Registry 백업 JSON이 아니야.');const list=obj.apps.map(a=>({name:a.name,status:STATUSES.includes(a.status)?a.status:'기획 중',email:a.email||'',deployment_url:a.deployment_url||'',memo:a.memo||'',selected:true,action:'new'}));setImportAccounts(obj.accounts||[]);setPreview(list.map(a=>({...a,action:apps.some(x=>low(x.name)===low(a.name))?'skip':'new'})));setNotice(`${list.length}개 앱을 읽었어. 미리보기에서 확인해 줘.`);return;
 }else throw Error('CSV, XLSX, JSON 파일만 지원해.');const list=parseSheet(rows);setImportAccounts([]);setPreview(list.map(a=>({...a,action:apps.some(x=>low(x.name)===low(a.name))?'skip':'new'})));setNotice(`${list.length}개 앱을 읽었어. 미리보기에서 확인해 줘.`);}catch(e){fail(e);}finally{if(inputRef.current)inputRef.current.value='';}};
 const commitImport=async()=>{const chosen=preview.filter(x=>x.selected&&x.action!=='skip');if(!chosen.length&&!importAccounts.length){setPreview(null);return;}setBusy(true);setError('');try{
 // First insert account rows, then use returned IDs for the app foreign keys.
 const byEmail=new Map(accounts.map(a=>[low(a.email),a.id]));const newEmails=[...new Set([...chosen.map(a=>low(a.email)),...importAccounts.map(a=>low(a.email))].filter(Boolean))].filter(e=>!byEmail.has(e));if(newEmails.length){const {data,error:e}=await client.from('app_registry_accounts').upsert(newEmails.map(email=>({id:id(),user_id:userId,email,memo:norm(importAccounts.find(a=>low(a.email)===email)?.memo)})),{onConflict:'user_id,email'}).select('id,email');if(e)throw e;for(const a of data||[])byEmail.set(low(a.email),a.id);}
 for(const item of chosen){const payload={user_id:userId,name:norm(item.name),status:item.status,email_account_id:byEmail.get(low(item.email))||null,deployment_url:norm(item.deployment_url)||null,memo:norm(item.memo)};if(item.action==='update'){const existing=apps.find(a=>low(a.name)===low(item.name));if(existing){const {error:e}=await client.from('app_registry_apps').update(payload).eq('id',existing.id).eq('user_id',userId);if(e)throw e;continue;}}const {error:e}=await client.from('app_registry_apps').insert({...payload,id:id()});if(e)throw e;}
 setPreview(null);setImportAccounts([]);await load();success(`${chosen.length}개 앱 가져오기 완료.`);
 }catch(e){fail(e);await load();}finally{setBusy(false);}};
 const exportJSON=()=>{const data={version:1,exportedAt:new Date().toISOString(),accounts:accounts.map(a=>({email:a.email,memo:a.memo})),apps:apps.map(a=>({name:a.name,status:a.status,email:accounts.find(c=>c.id===a.email_account_id)?.email||'',deployment_url:a.deployment_url,memo:a.memo}))};download('FocusFlow_AppRegistry_Backup.json',JSON.stringify(data,null,2));};
 const accountFor=a=>accounts.find(c=>c.id===a.email_account_id);
 const display=tab==='apps'?apps.filter(a=>a.status===status):accounts;
 const activeView=view&&(tab==='apps'?apps:accounts).find(x=>x.id===view.id)||view;
 return <section className="ar-page">
  <div className="ar-heading focus-page-heading"><h1>앱관리</h1><button className="ar-icon" onClick={load} aria-label="앱 목록 새로고침" title="새로고침"><RefreshCw size={18}/></button></div>
  <div className="ar-tabs">{[['apps','앱 목록'],['accounts','계정']].map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>{setTab(key);setView(null);setEditing(false);setPreview(null);setError('');}}>{label}</button>)}</div>
  {error&&<div role="alert" className="ar-alert">{error}</div>}{notice&&!error&&<div className="ar-notice">{notice}</div>}
  {loading&&<p className="ar-muted">서버에서 불러오는 중…</p>}
  {!loading&&!editing&&!preview&&activeView&&<div className="ar-detail"><div className="ar-row"><button className="ar-back" onClick={()=>setView(null)}><ArrowLeft size={17}/> 목록</button><div className="ar-actions"><button onClick={editItem} aria-label="수정"><Pencil size={18}/></button><button onClick={()=>remove(tab,activeView)} disabled={busy} aria-label="삭제"><Trash2 size={18}/></button></div></div><h2>{tab==='apps'?activeView.name:activeView.email}</h2>{tab==='apps'?<><div className="ar-muted">{activeView.status}</div><div className="ar-info"><b>가입 이메일</b><span>{accountFor(activeView)?.email||'미등록'}{accountFor(activeView)?.email&&<button onClick={()=>copy(accountFor(activeView).email)} aria-label="이메일 복사"><Copy size={17}/></button>}</span></div><div className="ar-info"><b>배포 주소</b><span className="ar-break">{activeView.deployment_url||'미등록'}{activeView.deployment_url&&<a href={activeView.deployment_url} target="_blank" rel="noopener noreferrer" aria-label="배포 앱 열기"><ExternalLink size={17}/></a>}</span></div></>:<><div className="ar-info"><b>이메일 복사</b><span><button onClick={()=>copy(activeView.email)}><Copy size={17}/></button></span></div><h3>연결된 앱</h3>{apps.filter(a=>a.email_account_id===activeView.id).map(a=><button key={a.id} className="ar-list-row" onClick={()=>{setTab('apps');setStatus(a.status);openItem(a);}}>{a.name}<ChevronRight size={16}/></button>)}{!apps.some(a=>a.email_account_id===activeView.id)&&<p className="ar-muted">연결된 앱이 없어.</p>}</>}<h3>메모</h3><p className="ar-memo">{activeView.memo||'메모 없음'}</p></div>}
  {!loading&&editing&&draft&&<div className="ar-editor"><div className="ar-row"><h2>{draft.id?'정보 수정':tab==='apps'?'앱 추가':'계정 추가'}</h2><button className="ar-icon" onClick={()=>{setEditing(false);setDraft(null);}} aria-label="닫기"><X size={20}/></button></div>{tab==='apps'?<>
  {fieldLabel('앱 이름 *',<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} maxLength={150}/>)}
  {fieldLabel('개발 상태 *',<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>)}
  {fieldLabel('가입 이메일',<input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" placeholder="이메일 주소 직접 입력 (선택)" value={draft.email_text ?? accounts.find(a=>a.id===draft.email_account_id)?.email ?? ''} onChange={e=>setDraft({...draft,email_text:e.target.value})}/>)}
  {fieldLabel('배포 URL',<input value={draft.deployment_url||''} onChange={e=>setDraft({...draft,deployment_url:e.target.value})} placeholder="https://..." inputMode="url"/>)}
  </>:fieldLabel('이메일 주소 *',<input type="email" value={draft.email||''} onChange={e=>setDraft({...draft,email:e.target.value})} autoCapitalize="none"/>)}
  {fieldLabel('메모',<textarea rows={5} value={draft.memo||''} onChange={e=>setDraft({...draft,memo:e.target.value})}/>)}
  <button className="ar-primary" disabled={busy} onClick={tab==='apps'?saveApp:saveAccount}>{busy?'저장 중…':'저장하기'}</button></div>}
  {!loading&&!editing&&!preview&&!view&&<><div className="ar-row ar-list-head"><h2>{tab==='apps'?'앱 목록':'계정'}</h2><button className="ar-add" onClick={openNew}><Plus size={18}/> 추가</button></div>{tab==='apps'&&<div className="ar-filters">{FILTER_STATUSES.map(s=><button key={s} className={s===status?'active':''} onClick={()=>setStatus(s)}>{FILTER_LABELS[s]} {apps.filter(a=>a.status===s).length}</button>)}</div>}
   <div className="ar-list">{display.map(item=><button className="ar-list-row" key={item.id} onClick={()=>openItem(item)}><span>{tab==='apps'?item.name:item.email}</span>{tab==='accounts'&&<small>{apps.filter(a=>a.email_account_id===item.id).length}개 앱</small>}<ChevronRight size={18}/></button>)}{display.length===0&&<p className="ar-muted">등록된 {tab==='apps'?'앱':'계정'}이 없어.</p>}</div>
   <div className="ar-tools"><button onClick={exportJSON}><Download size={17}/> JSON 백업</button><button onClick={()=>{filePickerOpenRef.current=true;setError('');setNotice('가져올 파일을 선택해 줘.');inputRef.current?.click();}}><Upload size={17}/> {tab==='apps'?'엑셀·CSV·JSON 가져오기':'JSON 복원'}</button></div></>}
  <input ref={inputRef} type="file" style={{display:'none'}} accept=".xlsx,.csv,.json,application/json,text/csv" onChange={e=>importFile(e.target.files?.[0])} onCancel={()=>{filePickerOpenRef.current=false;setNotice('파일 선택이 취소되었어.');}}/>
  {!loading&&preview&&<div className="ar-import"><div className="ar-row"><h2>가져오기 미리보기</h2><button className="ar-icon" onClick={()=>setPreview(null)}><X size={19}/></button></div><p className="ar-muted">신규 등록·기존 업데이트·건너뛰기를 선택해 줘. 기존 앱은 자동으로 건너뛰어.</p><div className="ar-import-list">{preview.map((a,i)=><div key={i} className="ar-import-item"><label><input type="checkbox" checked={a.selected} onChange={e=>setPreview(p=>p.map((x,j)=>j===i?{...x,selected:e.target.checked}:x))}/><strong>{a.name}</strong></label><select value={a.action} onChange={e=>setPreview(p=>p.map((x,j)=>j===i?{...x,action:e.target.value}:x))}><option value="new">신규 등록</option>{apps.some(x=>low(x.name)===low(a.name))&&<option value="update">기존 업데이트</option>}<option value="skip">건너뛰기</option></select><select value={a.status} onChange={e=>setPreview(p=>p.map((x,j)=>j===i?{...x,status:e.target.value}:x))}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select><small>{a.email||'이메일 없음'} · {a.deployment_url||'배포 URL 없음'}</small></div>)}</div><button className="ar-primary" onClick={commitImport} disabled={busy}>{busy?'가져오는 중…':'확인 후 가져오기'}</button></div>}
 </section>;
}
