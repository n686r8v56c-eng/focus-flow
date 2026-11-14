import React,{useState,useRef,useLayoutEffect} from "react";
const pad=n=>String(n).padStart(2,"0");
const keyOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const move=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const sections=[["memory","메모리랩"],["beauty","뷰티건강"],["write","Write"],["fashion","Fashion"]];
export function DailyCheck({data,onDataChange}){
 const [offset,setOffset]=useState(0);
 const itemInputs=useRef({});
 const pendingFocus=useRef(null);
 useLayoutEffect(()=>{const target=pendingFocus.current;if(!target)return;const input=itemInputs.current[target];if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);pendingFocus.current=null;}});
 const day=move(new Date(),offset),date=keyOf(day);
 const lists=data.dailyCheckLists||{};
 const checked=data.dailyCheckMarks?.[date]||{};
 const edit=fn=>onDataChange(prev=>{const next=fn(prev);return next;});
 const rename=(section,id,title)=>edit(prev=>({...prev,dailyCheckLists:{...(prev.dailyCheckLists||{}),[section]:((prev.dailyCheckLists||{})[section]||[]).map(x=>x.id===id?{...x,title}:x)}}));
 const remove=(section,id)=>{edit(prev=>({...prev,dailyCheckLists:{...(prev.dailyCheckLists||{}),[section]:((prev.dailyCheckLists||{})[section]||[]).filter(x=>x.id!==id)}}));};
 const insertAfter=(section,id)=>{
  const item={id:`dc-${Date.now()}-${Math.random().toString(36).slice(2)}`,title:""};
  pendingFocus.current=item.id;
  edit(prev=>{const current=(prev.dailyCheckLists||{})[section]||[];const index=current.findIndex(x=>x.id===id);const next=[...current];next.splice(index+1,0,item);return {...prev,dailyCheckLists:{...(prev.dailyCheckLists||{}),[section]:next}};});
 };
 const addBlank=(section)=>{
  const current=lists[section]||[];
  const blank=current.find(x=>x.title==="");
  if(blank){pendingFocus.current=blank.id;itemInputs.current[blank.id]?.focus();return;}
  const item={id:`dc-${Date.now()}-${Math.random().toString(36).slice(2)}`,title:""};
  pendingFocus.current=item.id;
  edit(prev=>({...prev,dailyCheckLists:{...(prev.dailyCheckLists||{}),[section]:[...((prev.dailyCheckLists||{})[section]||[]),item]}}));
 };
 const handleItemKey=(e,section,item,index)=>{
  if(e.nativeEvent?.isComposing||e.keyCode===229)return;
  if(e.key==="Enter"){e.preventDefault();insertAfter(section,item.id);}
  else if(e.key==="Backspace"&&item.title===""&&e.currentTarget.selectionStart===0&&e.currentTarget.selectionEnd===0&&index>0){
   e.preventDefault();const prevItem=(lists[section]||[])[index-1];pendingFocus.current=prevItem.id;remove(section,item.id);
  }
 };
 const toggle=id=>edit(prev=>({...prev,dailyCheckMarks:{...(prev.dailyCheckMarks||{}),[date]:{...((prev.dailyCheckMarks||{})[date]||{}),[id]:!((prev.dailyCheckMarks||{})[date]||{})[id]}}}));
 return <section className="daily-check-page" aria-label="데일리 체크">
  <div className="daily-check-heading"><div className="daily-check-title"><small>DAILY CHECK</small><h1>D체크</h1></div>
  <div className="daily-check-navigation"><button type="button" onClick={()=>setOffset(x=>x-1)} aria-label="이전 날">‹</button><strong>{pad(day.getMonth()+1)}.{pad(day.getDate())} ({["일","월","화","수","목","금","토"][day.getDay()]})</strong><button type="button" onClick={()=>setOffset(x=>x+1)} aria-label="다음 날">›</button><button type="button" onClick={()=>setOffset(0)}>오늘</button></div></div>
  <div className="daily-check-grid">{sections.map(([id,name])=><div className="daily-check-section" key={id} onClick={e=>{if(e.target===e.currentTarget)addBlank(id)}}><div className="daily-check-section-title"><b>{name}</b></div>
   <div className="daily-check-items">{(lists[id]||[]).map((item,index)=><div className="daily-check-item" key={item.id}><input type="checkbox" aria-label={item.title+" 완료"} checked={!!checked[item.id]} onChange={()=>toggle(item.id)}/><input className={checked[item.id]?"completed":""} aria-label="체크 항목 수정" ref={el=>{if(el)itemInputs.current[item.id]=el;else delete itemInputs.current[item.id]}} value={item.title} onChange={e=>rename(id,item.id,e.target.value)} onKeyDown={e=>handleItemKey(e,id,item,index)}/><button type="button" aria-label={item.title+" 삭제"} onClick={()=>remove(id,item.id)}>×</button></div>)}</div>
  </div>)}</div>
 </section>;
}
