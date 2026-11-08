import React,{useMemo,useState} from "react";
import {ChevronLeft,ChevronRight,Plus,Trash2} from "lucide-react";
import "./weekly-focus.css";

const pad=n=>String(n).padStart(2,"0");
const key=d=>[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join("-");
const fromKey=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12)};
const monday=d=>{const a=new Date(d);a.setHours(12,0,0,0);a.setDate(a.getDate()-(a.getDay()+6)%7);return key(a)};
const addDays=(s,n)=>{const d=fromKey(s);d.setDate(d.getDate()+n);return key(d)};
const short=s=>{const d=fromKey(s);return (d.getMonth()+1)+"/"+d.getDate()};
const newRow=()=>({primary:"",goal:"",secondary:[],review:"",done:false});

export function WeeklyFocus({data,onDataChange}){
 const [week,setWeek]=useState(()=>monday(new Date()));
 const [secondaryDraft,setSecondaryDraft]=useState("");
 const [showHistory,setShowHistory]=useState(false);
 const todayWeek=monday(new Date());
 const records=data.weeklyFocus||{};
 const current=records[week]||newRow();
 const projects=(data.projects||[]).map(x=>x.name).filter(Boolean);
 const names=[...new Set([...projects,"Memory Lab","Body Care","Income Flow","Career Flow","Dance Flow","Market Flow","Trend Flow","Beauty Care","Fashion Flow","Cosmetic Flow","Sing Flow","Culture Flow","Mind Flow","Spend Flow","Expression Studio"])];
 const write=patch=>onDataChange(prev=>({...prev,weeklyFocus:{...(prev.weeklyFocus||{}),[week]:{...newRow(),...(prev.weeklyFocus?.[week]||{}),...patch}}}));
 const history=useMemo(()=>Object.keys(records).filter(w=>w<todayWeek).sort((a,b)=>b.localeCompare(a)),[records,todayWeek]);
 return <section className="wf-page">
   <div className="wf-header"><div><small>WEEKLY FOCUS</small><h1>주간 집중</h1></div><span className="wf-tag">{week===todayWeek?"이번 주":week>todayWeek?"미리 계획":"지난 기록"}</span></div>
   <div className="wf-week"><button type="button" aria-label="이전 주" onClick={()=>{setWeek(addDays(week,-7));setSecondaryDraft("")}}><ChevronLeft size={19}/></button><strong>{short(week)} ~ {short(addDays(week,6))}</strong><button type="button" aria-label="다음 주" onClick={()=>{setWeek(addDays(week,7));setSecondaryDraft("")}}><ChevronRight size={19}/></button></div>
   <div className="wf-note"><strong>Daily Routine</strong><span>Memory Lab · Body Care 등 매일 하는 일은 그대로 유지</span></div>
   <div className="wf-panel"><label className="wf-label" htmlFor="wf-main">이번 주 메인 프로젝트</label><input id="wf-main" list="wf-projects" placeholder="집중할 프로젝트 선택 또는 입력" value={current.primary||""} onChange={e=>write({primary:e.target.value})}/><datalist id="wf-projects">{names.map(n=><option value={n} key={n}/>)}</datalist>
   <label className="wf-label" htmlFor="wf-goal">이번 주 달성 목표</label><textarea id="wf-goal" rows={3} placeholder="이번 주에 무엇을 달성할까?" value={current.goal||""} onChange={e=>write({goal:e.target.value})}/>
   <div className="wf-label">보조 프로젝트 <span>최대 2개</span></div>
   <div className="wf-secondary-list">{(current.secondary||[]).map((name,i)=><div className="wf-secondary" key={i}><span>{name}</span><button type="button" aria-label={name+" 삭제"} onClick={()=>write({secondary:current.secondary.filter((_,j)=>j!==i)})}><Trash2 size={16}/></button></div>)}</div>
   {(current.secondary||[]).length<2&&<div className="wf-add"><input list="wf-projects" aria-label="보조 프로젝트 추가" placeholder="보조 프로젝트" value={secondaryDraft} onChange={e=>setSecondaryDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();const n=secondaryDraft.trim();if(n&&n!==current.primary&&!current.secondary?.includes(n)){write({secondary:[...(current.secondary||[]),n]});setSecondaryDraft("")}}}}/><button type="button" disabled={!secondaryDraft.trim()} onClick={()=>{const n=secondaryDraft.trim();if(n&&n!==current.primary&&!current.secondary?.includes(n)){write({secondary:[...(current.secondary||[]),n]});setSecondaryDraft("")}}}><Plus size={17}/> 추가</button></div>}
   <label className="wf-complete"><input type="checkbox" checked={!!current.done} onChange={e=>write({done:e.target.checked})}/> 이번 주 목표 달성</label>
   <label className="wf-label" htmlFor="wf-review">주간 회고</label><textarea id="wf-review" rows={3} placeholder="이번 주에 실제로 한 일과 느낀 점" value={current.review||""} onChange={e=>write({review:e.target.value})}/>
   <small className="wf-autosave">변경 내용 자동 저장 · 지나간 주의 계획도 그대로 남아요.</small></div>
   <div className="wf-history"><button type="button" className="wf-history-toggle" onClick={()=>setShowHistory(x=>!x)}>지난 주간 기록 ({history.length}) <span>{showHistory?"접기":"펼치기"}</span></button>{showHistory&&<div className="wf-history-list">{history.length?history.map(w=><button key={w} type="button" onClick={()=>{setWeek(w);setShowHistory(false)}}><strong>{short(w)} ~ {short(addDays(w,6))}</strong><span>{records[w]?.primary||"미지정"}{records[w]?.done?" ✓":""}</span></button>):<p>아직 지난주 기록이 없어요.</p>}</div>}</div>
 </section>
}
