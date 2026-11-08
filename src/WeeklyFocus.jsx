import React,{useState} from "react";
import {ChevronLeft,ChevronRight} from "lucide-react";
import "./weekly-focus.css";
import {MacroPlan} from "./MacroPlan.jsx";

const pad=n=>String(n).padStart(2,"0");
const key=d=>[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join("-");
const fromKey=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12)};
const monday=d=>{const a=new Date(d);a.setHours(12,0,0,0);a.setDate(a.getDate()-(a.getDay()+6)%7);return key(a)};
const addDays=(s,n)=>{const d=fromKey(s);d.setDate(d.getDate()+n);return key(d)};
const short=s=>{const d=fromKey(s);return (d.getMonth()+1)+"/"+d.getDate()};

export function WeeklyFocus({data,onDataChange}){
 const [mode,setMode]=useState("current");
 const [week,setWeek]=useState(()=>monday(new Date()));
 const todayWeek=monday(new Date());
 const records=data.weeklyFocus||{};
 const current=records[week]||{};
 const futureWeeks=Array.from({length:8},(_,i)=>addDays(todayWeek,(i+1)*7));
 const projects=(data.projects||[]).map(x=>x.name).filter(Boolean);
 const names=[...new Set([...projects,"Memory Lab","Body Care","Income Flow","Career Flow","Dance Flow","Market Flow","Trend Flow","Beauty Care","Fashion Flow","Cosmetic Flow","Sing Flow","Culture Flow","Mind Flow","Spend Flow","Expression Studio"])];
 const write=(date,patch)=>onDataChange(prev=>({...prev,weeklyFocus:{...(prev.weeklyFocus||{}),[date]:{...(prev.weeklyFocus?.[date]||{}),...patch}}}));
 return <section className="wf-page">
   <div className="wf-header"><div><small>WEEKLY FOCUS</small><h1>주간 집중</h1></div></div>
   <div className="wf-subtabs" role="tablist" aria-label="주간 집중 보기">
     <button type="button" role="tab" aria-selected={mode==="current"} className={mode==="current"?"active":""} onClick={()=>setMode("current")}>이번 주</button>
     <button type="button" role="tab" aria-selected={mode==="future"} className={mode==="future"?"active":""} onClick={()=>setMode("future")}>매크로</button>
   </div>
   <datalist id="wf-projects">{names.map(n=><option value={n} key={n}/>)}</datalist>
   {mode==="current"?<>
     <div className="wf-week"><button type="button" aria-label="이전 주" onClick={()=>setWeek(addDays(week,-7))}><ChevronLeft size={19}/></button><strong>{short(week)} ~ {short(addDays(week,6))}</strong><button type="button" aria-label="다음 주" onClick={()=>setWeek(addDays(week,7))}><ChevronRight size={19}/></button></div>
     <div className="wf-note"><strong>Daily Routine</strong><span>Memory Lab · Body Care 등 매일 하는 일은 그대로 유지</span></div>
     <div className="wf-panel">
       <label className="wf-label" htmlFor="wf-main">이번 주 메인 프로젝트</label>
       <input id="wf-main" list="wf-projects" placeholder="집중할 프로젝트 선택 또는 입력" value={current.primary||""} onChange={e=>write(week,{primary:e.target.value})}/>
       <label className="wf-label" htmlFor="wf-goal">이번 주 달성 목표</label>
       <textarea id="wf-goal" rows={3} placeholder="이번 주에 무엇을 달성할까?" value={current.goal||""} onChange={e=>write(week,{goal:e.target.value})}/>
     </div>
   </>:<MacroPlan data={data} onDataChange={onDataChange} onOpenWeekly={date=>{setWeek(date);setMode("current")}} />}
 </section>;
}
