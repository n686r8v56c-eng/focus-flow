import React,{useState} from "react";
const pad=n=>String(n).padStart(2,"0");
const keyOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const move=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const sections=[["memory","메모리랩"],["beauty","뷰티건강"],["write","Write"],["fashion","Fashion"]];
export function DailyCheck({data,onDataChange}){
 const [offset,setOffset]=useState(0);
 const [drafts,setDrafts]=useState({});
 const day=move(new Date(),offset),date=keyOf(day);
 const lists=data.dailyCheckLists||{};
 const checked=data.dailyCheckMarks?.[date]||{};
 const edit=fn=>onDataChange(prev=>{const next=fn(prev);return next;});
 const add=(id)=>{const title=(drafts[id]||"").trim();if(!title)return;const item={id:`dc-${Date.now()}-${Math.random().toString(36).slice(2)}`,title};edit(prev=>({...prev,dailyCheckLists:{...(prev.dailyCheckLists||{}),[id]:[...((prev.dailyCheckLists||{})[id]||[]),item]}}));setDrafts(v=>({...v,[id]:""}));};
 const rename=(section,id,title)=>edit(prev=>({...prev,dailyCheckLists:{...(prev.dailyCheckLists||{}),[section]:((prev.dailyCheckLists||{})[section]||[]).map(x=>x.id===id?{...x,title}:x)}}));
 const remove=(section,id)=>{edit(prev=>({...prev,dailyCheckLists:{...(prev.dailyCheckLists||{}),[section]:((prev.dailyCheckLists||{})[section]||[]).filter(x=>x.id!==id)}}));};
 const toggle=id=>edit(prev=>({...prev,dailyCheckMarks:{...(prev.dailyCheckMarks||{}),[date]:{...((prev.dailyCheckMarks||{})[date]||{}),[id]:!((prev.dailyCheckMarks||{})[date]||{})[id]}}}));
 return <section className="daily-check-page" aria-label="데일리 체크">
  <div className="daily-check-title"><small>DAILY CHECK</small><h1>D체크</h1></div>
  <div className="daily-check-navigation"><button type="button" onClick={()=>setOffset(x=>x-1)} aria-label="이전 날">‹</button><strong>{pad(day.getMonth()+1)}.{pad(day.getDate())} ({["일","월","화","수","목","금","토"][day.getDay()]})</strong><button type="button" onClick={()=>setOffset(x=>x+1)} aria-label="다음 날">›</button><button type="button" onClick={()=>setOffset(0)}>오늘</button></div>
  <div className="daily-check-grid">{sections.map(([id,name])=><div className="daily-check-section" key={id}><div className="daily-check-section-title"><b>{name}</b></div>
   <div className="daily-check-items">{(lists[id]||[]).map(item=><div className="daily-check-item" key={item.id}><input type="checkbox" aria-label={item.title+" 완료"} checked={!!checked[item.id]} onChange={()=>toggle(item.id)}/><input className={checked[item.id]?"completed":""} aria-label="체크 항목 수정" value={item.title} onChange={e=>rename(id,item.id,e.target.value)}/><button type="button" aria-label={item.title+" 삭제"} onClick={()=>remove(id,item.id)}>×</button></div>)}</div>
   <form className="daily-check-add" onSubmit={e=>{e.preventDefault();add(id)}}><input aria-label={name+" 새 체크 항목"} placeholder="+ 항목 입력" value={drafts[id]||""} onChange={e=>setDrafts(v=>({...v,[id]:e.target.value}))}/><button type="submit" aria-label={name+" 항목 추가"} disabled={!(drafts[id]||"").trim()}>+</button></form>
  </div>)}</div>
 </section>;
}
