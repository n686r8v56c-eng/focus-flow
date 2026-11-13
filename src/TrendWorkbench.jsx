import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, Trash2, Bookmark, Download, Search, X, Check, ChevronDown } from "lucide-react";
import "./trend.css";

const SOURCES = [
  { id:"naver", title:"네이버 엔터", note:"뉴스·영상 랭킹 직접 확인", url:"https://entertain.naver.com/" },
  { id:"youtube", title:"유튜브 차트", note:"공식 음악 차트 확인", url:"https://charts.youtube.com/" },
  { id:"google", title:"구글 트렌드", note:"한국 급상승 검색어 확인", url:"https://trends.google.com/trending?geo=KR" },
  { id:"datalab", title:"네이버 데이터랩", note:"검색 관심도 확인", url:"https://datalab.naver.com/" },
];
const CATEGORIES = ["전체","스타","드라마","영화","예능","K팝","기타"];
const today = () => {
  const d = new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
};
const blank = () => ({title:"",category:"스타",summary:"",confirmed:"",unknown:"",source:"naver",url:"",rank:"",views:"",searchInterest:"",observedAt:today(),memo:"",saved:false});
const dbName = "focus-flow-trend-v1";
function openDb() {
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(dbName,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains("workspaces"))db.createObjectStore("workspaces");};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function readIssues(key) {
  const db=await openDb();
  try {return await new Promise((resolve,reject)=>{
    const r=db.transaction("workspaces","readonly").objectStore("workspaces").get(key);
    r.onsuccess=()=>resolve(Array.isArray(r.result)?r.result:[]);
    r.onerror=()=>reject(r.error);
  });} finally {db.close();}
}
async function writeIssues(key,value) {
  const db=await openDb();
  try {await new Promise((resolve,reject)=>{
    const tx=db.transaction("workspaces","readwrite");
    tx.objectStore("workspaces").put(value,key);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error);
  });} finally {db.close();}
}
function safeUrl(value){try{const u=new URL(value);return ["https:","http:"].includes(u.protocol)?u.href:"";}catch{return "";}}
function exportCsv(items){
  const keys=["title","category","summary","confirmed","unknown","source","url","rank","views","searchInterest","observedAt","memo","saved"];
  const escape=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
  const csv="\uFEFF"+[keys.join(","),...items.map(item=>keys.map(k=>escape(item[k])).join(","))].join("\r\n");
  const href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=href;a.download="trend-entertainment-"+today()+".csv";a.click();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
}
export function TrendWorkbench({ userId }) {
  const [tab,setTab]=useState("ranking");
  const [issues,setIssues]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState("");
  const [filter,setFilter]=useState("전체");
  const [period,setPeriod]=useState("7");
  const [query,setQuery]=useState("");
  const [draft,setDraft]=useState(null);
  const [editingId,setEditingId]=useState(null);
  const key="entertainment:"+(userId||"guest");
  useEffect(()=>{
    let active=true;setLoaded(false);
    readIssues(key).then(rows=>{if(active){setIssues(rows);setLoaded(true);}}).catch(()=>{if(active){setError("이 기기에서 IndexedDB를 열 수 없어. 저장 기능을 확인해 줘.");setLoaded(true);}});
    return()=>{active=false;};
  },[key]);
  const save = async next=>{
    if(!loaded||error)return;
    try {await writeIssues(key,next);setIssues(next);}catch{setError("저장에 실패했어. 기존 기록은 유지했어. 브라우저 저장 공간을 확인해 줘.");}
  };
  const filtered=useMemo(()=>issues.filter(item=>{
    const start=new Date();start.setHours(0,0,0,0);start.setDate(start.getDate()-Number(period)+1);
    const date=new Date((item.observedAt||"1970-01-01")+"T00:00:00");
    return (filter==="전체"||item.category===filter)
      &&(tab!=="saved"||item.saved)
      &&date>=start
      &&(item.title+" "+item.summary+" "+item.memo).toLowerCase().includes(query.toLowerCase());
  }).sort((a,b)=>(b.observedAt||"").localeCompare(a.observedAt||"")), [issues,filter,period,query,tab]);
  const startAdd=()=>{setEditingId(null);setDraft(blank());};
  const startEdit=item=>{setEditingId(item.id);setDraft({...item});};
  const commit=async e=>{
    e.preventDefault();
    if(!draft?.title.trim())return;
    if(draft.url.trim()&&!safeUrl(draft.url)){setError("링크는 http 또는 https 주소만 등록할 수 있어.");return;}
    const item={...draft,title:draft.title.trim(),url:safeUrl(draft.url),id:editingId||crypto.randomUUID(),updatedAt:new Date().toISOString()};
    const next=editingId?issues.map(x=>x.id===editingId?item:x):[item,...issues];
    setError("");await save(next);setDraft(null);setEditingId(null);
  };
  return <section className="trend-page">
    <div className="trend-heading"><div><small>FOCUS FLOW / TREND</small><h1>Entertainment</h1><p>직접 확인하는 엔터테인먼트 관심도 관측소</p></div><button type="button" className="trend-primary" onClick={startAdd}><Plus size={17}/> 이슈 등록</button></div>
    <div className="trend-tabs" role="tablist">{[["ranking","랭킹"],["sources","소스"],["verify","검증"],["saved","저장함"]].map(([id,label])=><button type="button" key={id} role="tab" aria-selected={tab===id} className={tab===id?"selected":""} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {error&&<p className="trend-error" role="alert">{error}<button type="button" onClick={()=>setError("")}>닫기</button></p>}
    {(tab==="sources"||tab==="ranking")&&<div className="trend-source-grid">{SOURCES.map(s=><a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="trend-source"><span>{s.title}<ExternalLink size={14}/></span><small>{s.note}</small></a>)}</div>}
    {tab==="sources"&&<div className="trend-note"><strong>원본 확인 원칙</strong><p>네이버 인기기사 순위와 유튜브·구글 관심도는 서로 다른 지표야. 원본 화면에서 확인한 시각과 링크를 기록해 줘. 자동 실시간 수집이나 통합 공식 순위를 제공한다고 표시하지 않아.</p></div>}
    {tab==="verify"&&<div className="trend-note"><strong>교차검증 방법</strong><p>같은 이슈를 네이버 엔터, 유튜브, 구글 트렌드, 네이버 데이터랩에서 검색하고 관측값을 각각 이슈 메모에 남겨. 숫자가 확인되지 않으면 비워 두고, 조회수·검색 관심도·랭킹을 하나의 점수로 섞지 않아.</p><p>이슈 카드를 눌러 출처·순위·조회수·검색 관심도 및 미확인 정보를 수정할 수 있어.</p></div>}
    {tab!=="sources"&&<><div className="trend-filters"><select aria-label="분야 선택" value={filter} onChange={e=>setFilter(e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select><select aria-label="기록 기간" value={period} onChange={e=>setPeriod(e.target.value)}><option value="1">오늘</option><option value="7">7일</option><option value="30">30일</option><option value="3650">전체 기간</option></select><label className="trend-search"><Search size={15}/><input aria-label="이슈 검색" placeholder="이슈 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
      <div className="trend-results"><div className="trend-results-title"><strong>{tab==="verify"?"교차검증 기록":tab==="saved"?"저장한 이슈":"직접 수집한 이슈"} · {filtered.length}건</strong><button type="button" onClick={()=>exportCsv(filtered)} disabled={!filtered.length}><Download size={15}/> CSV</button></div>
      {!loaded?<p className="trend-empty">저장된 이슈를 불러오는 중…</p>:!filtered.length?<div className="trend-empty"><p>아직 해당 조건에 기록된 이슈가 없어.</p><button type="button" onClick={startAdd}>첫 이슈 등록하기</button><small>실시간 순위를 임의로 채우지 않고 직접 확인한 데이터만 보여줘.</small></div>:filtered.map((item,i)=><article key={item.id} className="trend-issue"><div className="trend-issue-head"><button type="button" className="trend-issue-title" onClick={()=>startEdit(item)}><span className="trend-index">{i+1}</span><span><strong>{item.title}</strong><small>{item.category} · {item.observedAt} · {SOURCES.find(s=>s.id===item.source)?.title||"직접 입력"}</small></span></button><button type="button" title={item.saved?"저장 해제":"저장함에 추가"} aria-label={item.saved?"저장 해제":"저장함에 추가"} className={item.saved?"trend-bookmarked":""} onClick={()=>save(issues.map(x=>x.id===item.id?{...x,saved:!x.saved}:x))}><Bookmark size={19} fill={item.saved?"currentColor":"none"}/></button></div>{item.summary&&<p>{item.summary}</p>}<div className="trend-metrics"><span>원본 순위: {item.rank||"미확인"}</span><span>조회수: {item.views||"미확인"}</span><span>검색 관심도: {item.searchInterest||"미확인"}</span></div><div className="trend-issue-actions">{item.url&&<a href={safeUrl(item.url)} target="_blank" rel="noopener noreferrer">원본 보기 <ExternalLink size={13}/></a>}<button type="button" onClick={()=>startEdit(item)}>근거·메모 수정</button><button type="button" title="이슈 삭제" onClick={()=>{if(window.confirm("이 이슈의 기록을 삭제할까?"))save(issues.filter(x=>x.id!==item.id));}}><Trash2 size={15}/></button></div></article>)}</div></>}
    <div className="trend-footnote">기록은 이 브라우저의 별도 IndexedDB에 저장돼. Focus 일정·할 일 데이터와 분리돼 있으며 Supabase 자동 백업·다른 기기 동기화 대상은 아니야. 중요한 기록은 CSV로 내보내 보관해 줘.</div>
    {draft&&<div className="trend-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setDraft(null);}}><form className="trend-editor" onSubmit={commit}><div className="trend-editor-head"><strong>{editingId?"이슈 수정":"새 엔터 이슈 등록"}</strong><button type="button" onClick={()=>setDraft(null)} aria-label="닫기"><X size={20}/></button></div><label>이슈명 *<input required value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="예: 배우 A 신작 공개"/></label><div className="trend-two"><label>분야<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{CATEGORIES.filter(c=>c!=="전체").map(c=><option key={c}>{c}</option>)}</select></label><label>확인 날짜<input type="date" required value={draft.observedAt} onChange={e=>setDraft({...draft,observedAt:e.target.value})}/></label></div><label>핵심 요약<textarea rows="2" value={draft.summary} onChange={e=>setDraft({...draft,summary:e.target.value})} placeholder="무슨 소식인가?"/></label><label>확인된 사실<textarea rows="2" value={draft.confirmed} onChange={e=>setDraft({...draft,confirmed:e.target.value})} placeholder="원본에서 직접 확인한 내용"/></label><label>미확인 정보<textarea rows="2" value={draft.unknown} onChange={e=>setDraft({...draft,unknown:e.target.value})} placeholder="아직 확인되지 않은 주장"/></label><div className="trend-two"><label>원본 소스<select value={draft.source} onChange={e=>setDraft({...draft,source:e.target.value})}>{SOURCES.map(s=><option value={s.id} key={s.id}>{s.title}</option>)}</select></label><label>원본 순위<input value={draft.rank} onChange={e=>setDraft({...draft,rank:e.target.value})} placeholder="예: 3위"/></label></div><label>원본 링크<input type="url" value={draft.url} onChange={e=>setDraft({...draft,url:e.target.value})} placeholder="https://..."/></label><div className="trend-two"><label>영상 조회수 (확인 값)<input value={draft.views} onChange={e=>setDraft({...draft,views:e.target.value})} placeholder="미확인 시 공란"/></label><label>검색 관심도 (확인 값)<input value={draft.searchInterest} onChange={e=>setDraft({...draft,searchInterest:e.target.value})} placeholder="미확인 시 공란"/></label></div><label>다른 소스 비교·메모<textarea rows="3" value={draft.memo} onChange={e=>setDraft({...draft,memo:e.target.value})} placeholder="소스별 확인 시각과 원본 링크를 함께 기록"/></label><label className="trend-checkbox"><input type="checkbox" checked={draft.saved} onChange={e=>setDraft({...draft,saved:e.target.checked})}/> 저장함에도 보관</label><button className="trend-primary" type="submit"><Check size={16}/> 기록 저장</button></form></div>}
  </section>;
}
