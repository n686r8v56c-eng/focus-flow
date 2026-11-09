import React,{useMemo,useState,useEffect,useRef} from "react";
import {Plus} from "lucide-react";
const dateKey=(d)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const shift=(date,days)=>{const [y,m,d]=date.split("-").map(Number);return dateKey(new Date(y,m-1,d+days));};
const minutes=(value)=>{const [h,m]=String(value||"").split(":").map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;};
const fmt=(m)=>String(Math.floor(m/60)%24).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
export function Timeline({data,onDataChange,onAdd}) {
 const [now,setNow]=useState(Date.now());
 const scrollRef=useRef(null);
 const hasPositioned=useRef(false);
 const date=dateKey(new Date(now));
 const [editing,setEditing]=useState(null);
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(id);},[]);
 const tasks=useMemo(()=>(Array.isArray(data.timelineTasks)?data.timelineTasks:(data.tasks||[]).filter(t=>Boolean(t.time))).filter(t=>t.due===date || (date===dateKey(new Date())&&t.due&&t.due<date&&t.status!=="done")), [data.timelineTasks,data.tasks,date]);
 const timed=tasks.filter(t=>minutes(t.time)!==null).sort((a,b)=>minutes(a.time)-minutes(b.time));
 const change=(id,fields)=>onDataChange(prev=>({...prev,timelineTasks:(Array.isArray(prev.timelineTasks)?prev.timelineTasks:(prev.tasks||[]).filter(t=>Boolean(t.time)).map(t=>({...t}))).map(t=>t.id===id?{...t,...fields}:t)}));
 const current=new Date(now),today=dateKey(current),currentMinutes=current.getHours()*60+current.getMinutes();
 const startHour=6,endHour=22;
 const dayStart=startHour*60,dayEnd=endHour*60;
 const hourHeight=288;
 const gutter=62;
 const dayHeight=(endHour-startHour)*hourHeight;
 const timeToY=m=>(m-dayStart)/60*hourHeight;
 useEffect(()=>{
   if(hasPositioned.current)return;
   const el=scrollRef.current;
   if(!el)return;
   hasPositioned.current=true;
   const currentTime=new Date();
   const minute=currentTime.getHours()*60+currentTime.getMinutes();
   const heading=el.querySelector(".timeline-sticky-heading");
   const headingHeight=heading?.getBoundingClientRect().height||80;
   const timeline=el.querySelector(".timeline-hour-grid");
   const timelineOffset=timeline?.offsetTop||0;
   const currentY=(minute-dayStart)/60*hourHeight;
   const target=timelineOffset+currentY-headingHeight-Math.max(40,(el.clientHeight-headingHeight)*0.3);
   el.scrollTop=Math.max(0,Math.min(el.scrollHeight-el.clientHeight,target));
 },[]);
 const lineVisible=currentMinutes>=dayStart&&currentMinutes<=dayEnd;
 const remainingToBed=Math.max(0,dayEnd-currentMinutes);
 const remainingToBedLabel=`${Math.floor(remainingToBed/60)}시간 ${String(remainingToBed%60).padStart(2,'0')}분`;
 const visibleTasks=timed.filter(t=>{
   const start=minutes(t.time);
   return start<dayEnd && start+Math.max(5,Number(t.durationMinutes||t.minutes||30)||30)>dayStart;
 });
 // Count elapsed scheduled time by card color, not future planned minutes.
 const colorHours=useMemo(()=>{
   const grouped=new Map();
   for(const task of timed){
     const start=minutes(task.time);
     if(start===null)continue;
     const duration=Math.max(5,Number(task.durationMinutes||task.minutes||30)||30);
     const end=Math.min(start+duration,currentMinutes,dayEnd);
     const from=Math.max(start,dayStart);
     if(end<=from)continue;
     const color=task.color||"#eee6f7";
     if(!grouped.has(color))grouped.set(color,[]);
     grouped.get(color).push([from,end]);
   }
   return [...grouped.entries()].map(([color,ranges])=>{
     ranges.sort((a,b)=>a[0]-b[0]);
     let total=0,left=-1,right=-1;
     for(const [a,b] of ranges){
       if(a>right){if(right>left)total+=right-left;left=a;right=b;}
       else right=Math.max(right,b);
     }
     if(right>left)total+=right-left;
     return {color,hours:(total/60).toFixed(1)};
   });
 },[timed,currentMinutes,dayEnd,dayStart]);
 const gaps=visibleTasks.slice(1).map((task,i)=>{
   const previous=visibleTasks[i];
   const previousEnd=minutes(previous.time)+Math.max(5,Number(previous.durationMinutes||previous.minutes||30)||30);
   const nextStart=minutes(task.time);
   return {key:`${previous.id}-${task.id}`,start:previousEnd,end:nextStart,duration:nextStart-previousEnd};
 }).filter(g=>g.duration>0&&g.start>=dayStart&&g.end<=dayEnd);
 return <section ref={scrollRef} className="focus-redesign" style={{height:"calc(100dvh - 66px - 27px - 90px)",minHeight:320,overflowY:"auto",overflowX:"clip",overscrollBehavior:"contain",WebkitOverflowScrolling:"touch",paddingBottom:30}}>
  <div className="macro-board-heading timeline-sticky-heading" style={{position:"sticky",top:0,zIndex:20,flexShrink:0,margin:"0 0 18px",padding:"12px 0",background:"#faf8fd",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}><div style={{minWidth:0}}><span>DAILY PLAN</span><div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><h2 style={{margin:0}}>Timeline</h2><div aria-label="색상별 오늘 현재까지 진행한 시간" style={{display:"flex",gap:"5px 10px",alignItems:"center",flexWrap:"wrap"}}>{colorHours.map(({color,hours})=><span key={color} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:"#71677b",whiteSpace:"nowrap",fontVariantNumeric:"tabular-nums"}}><i aria-hidden="true" style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:color,border:"1px solid #c9bfd2",flexShrink:0}}/>{hours}시간</span>)}</div></div></div><button type="button" aria-label="할 일 추가" title="할 일 추가" onClick={onAdd} className="inline-add-task"><Plus size={21}/></button></div>
  <div className="timeline-hour-grid" style={{position:"relative",height:dayHeight,marginTop:30}}>
   {Array.from({length:endHour-startHour+1},(_,i)=>{
     const h=startHour+i;
     const top=i*hourHeight;
     return <div key={h} style={{position:"absolute",top,left:0,right:0,height:0}}>
       <span style={{position:"absolute",left:0,top:-10,width:gutter-9,textAlign:"left",fontSize:13,color:"#9b90a6",fontVariantNumeric:"tabular-nums"}}>{String(h).padStart(2,"0")}:00{h===6?" 기상":h===22?" 수면":""}</span>
       <div style={{position:"absolute",left:gutter,right:0,borderTop:"1px solid #e9e2ef"}}/>
     </div>;
   })}
   {gaps.map(g=><div key={g.key} style={{position:"absolute",top:timeToY(g.start),height:timeToY(g.end)-timeToY(g.start),left:gutter,right:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",color:"#9788a7",fontSize:12,fontWeight:500}}>
     <span style={{background:"#faf8fd",padding:"1px 8px",borderRadius:10}}>✧ {g.duration}분 빈 시간</span>
   </div>)}
   {visibleTasks.map(t=>{
     const start=minutes(t.time);
     const duration=Math.max(5,Number(t.durationMinutes||t.minutes||30)||30);
     const end=start+duration;
     const top=timeToY(Math.max(dayStart,start));
     const height=Math.max(24,timeToY(Math.min(dayEnd,end))-top-3);
     const compact=height<65;
     const remainingLabel=currentMinutes<start?"시작 전":currentMinutes>=end?"종료":`${Math.max(0,Math.ceil((end*60000-(now-new Date(current.getFullYear(),current.getMonth(),current.getDate()).getTime()))/60000))}분 남음`;
     return <div key={t.id} role="button" tabIndex={0} aria-label={`${t.title} 일정 수정`} onClick={()=>setEditing(t)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setEditing(t);}}}
       style={{position:"absolute",top,left:gutter,right:0,height,boxSizing:"border-box",borderRadius:12,background:t.color||"#eee6f7",color:"#44394d",padding:compact?"1px 9px":"8px 12px",display:"flex",flexDirection:"column",justifyContent:"center",gap:compact?1:5,alignItems:"stretch",overflow:"hidden",cursor:"pointer"}}>
       <span style={{fontSize:compact?10:11,color:"#71677b",whiteSpace:"nowrap",lineHeight:compact?1:1.2}}>{fmt(start)}–{fmt(end)} · {duration}분</span>
       <div style={{display:"flex",flexDirection:"column",gap:compact?0:2,minWidth:0}}>
         <strong style={{minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:compact?11:15,lineHeight:compact?1:1.2,textDecoration:t.status==="done"?"line-through":"none"}}>{t.title}</strong>
         <span style={{fontSize:compact?10:12,color:"#674b9d",lineHeight:compact?1:1.15,fontWeight:600}}>{remainingLabel}</span>
       </div>
     </div>;
   })}
   {lineVisible&&<div aria-label={`현재 시각 ${fmt(currentMinutes)}`} style={{position:"absolute",top:timeToY(currentMinutes),left:0,right:0,height:0,zIndex:5,pointerEvents:"none"}}>
     <div style={{position:"absolute",top:0,left:gutter,right:0,borderTop:"1px solid #56358b"}}/>
     <span style={{position:"absolute",right:`calc(100% - ${gutter-5}px)`,top:-9,background:"#56358b",color:"white",borderRadius:9,padding:"2px 5px",fontSize:10,fontWeight:700,lineHeight:"15px",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{fmt(currentMinutes)}</span>
     <span aria-label={`22시까지 ${remainingToBedLabel} 남음`} title="22:00까지 남은 시간" style={{position:"absolute",right:0,top:-9,background:"#56358b",color:"white",borderRadius:9,padding:"2px 7px",fontSize:10,fontWeight:700,lineHeight:"15px",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{remainingToBedLabel}</span>
   </div>}
  </div>
  {editing&&<div style={{position:"fixed",inset:0,zIndex:100,background:"#0006",display:"grid",placeItems:"center",padding:20}}>
   <form onSubmit={e=>{e.preventDefault();const fd=new FormData(e.currentTarget);change(editing.id,{title:String(fd.get("title")||"").trim()||editing.title,time:fd.get("time")||"",durationMinutes:Number(fd.get("duration"))||30,color:fd.get("color")||editing.color||"#eee6f7"});setEditing(null);}} style={{width:"100%",maxWidth:380,background:"white",padding:22,borderRadius:18,display:"grid",gap:12}}>
    <strong>일정 수정</strong><label>할 일 이름 <input name="title" required defaultValue={editing.title}/></label><label>시작 시간 <input name="time" type="time" defaultValue={editing.time||""}/></label>
    <label>소요 시간(분) <input name="duration" type="number" min="5" step="5" defaultValue={editing.durationMinutes||editing.minutes||30}/></label>
    <label>컬러 <select name="color" defaultValue={editing.color||"#eee6f7"}>{["#eee6f7","#e6edf8","#e5f2ed","#fff0df","#f9e5ec","#e9e7f8","#f2eddf","#e6f0f4"].map((c,i)=><option key={c} value={c}>컬러 {i+1}</option>)}</select></label>\n    <div style={{display:"flex",gap:8}}><button type="button" className="secondary" onClick={()=>setEditing(null)}>취소</button><button type="submit" className="primary">저장</button></div>
   </form>
  </div>}
 </section>;
}
