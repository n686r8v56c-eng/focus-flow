import React, {useState} from "react";
const pad=n=>String(n).padStart(2,"0");
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const monday=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-(x.getDay()+6)%7);return x;};
const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const short=d=>`${pad(d.getMonth()+1)}.${pad(d.getDate())}`;
const days=["월","화","수","목","금","토","일"];
export function WeeklyPlanner({data,onDataChange}){
 const [offset,setOffset]=useState(0);
 const [mode,setMode]=useState("plan");
 const start=addDays(monday(new Date()),offset*7);
 const dates=Array.from({length:7},(_,i)=>addDays(start,i));
 const notes=data.weeklyNotes||{};
 const weekMemoKey=`week-note:${dateKey(start)}`;
 const save=(key,value)=>onDataChange(prev=>({...prev,weeklyNotes:{...(prev.weeklyNotes||{}),[key]:value}}));
 const diary=mode==="diary";
 const noteKey=date=>diary?`diary:${date}`:date;
 const placeholder=diary?"이날의 일기를 적어줘":"이날의 계획을 적어줘";
 const freeNoteKey=diary?`diary:${weekMemoKey}`:weekMemoKey;
 return <section className="weekly-planner" aria-label="위클리 플래너">
   <div className="weekly-heading"><div><small>WEEKLY PLAN</small><h1>위클리</h1></div>
   <div className="weekly-navigation"><button type="button" onClick={()=>setOffset(o=>o-1)} aria-label="이전 주">‹</button><strong>{short(start)} – {short(addDays(start,6))}</strong><button type="button" onClick={()=>setOffset(o=>o+1)} aria-label="다음 주">›</button><button type="button" onClick={()=>setOffset(0)} aria-label="이번 주">오늘</button></div></div>
   <div className="weekly-mode-tabs" role="tablist" aria-label="위클리 기록 종류"><button type="button" role="tab" aria-selected={!diary} className={!diary?"active":""} onClick={()=>setMode("plan")}>계획</button><button type="button" role="tab" aria-selected={diary} className={diary?"active":""} onClick={()=>setMode("diary")}>일기</button></div>
   <div className="weekly-grid">{dates.map((d,i)=>{const key=noteKey(dateKey(d));return <div className="weekly-day" key={key}><div className="weekly-day-head"><b>{["M","T","W","T","F","S","S"][i]}</b><span>{short(d)} ({days[i]})</span></div><div className="weekly-note-wrap"><div className="weekly-note-display" aria-hidden="true">{notes[key]||placeholder}</div><textarea aria-label={dateKey(d)+(diary?" 일기":" 계획")} placeholder={placeholder} value={notes[key]||""} onChange={e=>save(key,e.target.value)} /></div></div>})}<div className="weekly-day weekly-free-note" key={freeNoteKey}><div className="weekly-day-head"><b aria-label="주간 자유 메모">💬</b></div><div className="weekly-note-wrap"><div className="weekly-note-display" aria-hidden="true">{notes[freeNoteKey]||"자유롭게 적어줘"}</div><textarea aria-label="주간 자유 메모" placeholder="자유롭게 적어줘" value={notes[freeNoteKey]||""} onChange={e=>save(freeNoteKey,e.target.value)} /></div></div></div>
 </section>;
}
