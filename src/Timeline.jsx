import React,{useMemo,useState,useEffect} from "react";
import {Plus} from "lucide-react";
const dateKey=(d)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const shift=(date,days)=>{const [y,m,d]=date.split("-").map(Number);return dateKey(new Date(y,m-1,d+days));};
const minutes=(value)=>{const [h,m]=String(value||"").split(":").map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;};
const fmt=(m)=>String(Math.floor(m/60)%24).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
export function Timeline({data,onDataChange,onAdd}) {
 const [now,setNow]=useState(Date.now());
 const date=dateKey(new Date(now));
 const [editing,setEditing]=useState(null);
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(id);},[]);
 const tasks=useMemo(()=>(Array.isArray(data.timelineTasks)?data.timelineTasks:(data.tasks||[]).filter(t=>Boolean(t.time))).filter(t=>t.due===date || (date===dateKey(new Date())&&t.due&&t.due<date&&t.status!=="done")), [data.timelineTasks,data.tasks,date]);
 const timed=tasks.filter(t=>minutes(t.time)!==null).sort((a,b)=>minutes(a.time)-minutes(b.time));
 const change=(id,fields)=>onDataChange(prev=>({...prev,timelineTasks:(Array.isArray(prev.timelineTasks)?prev.timelineTasks:(prev.tasks||[]).filter(t=>Boolean(t.time)).map(t=>({...t}))).map(t=>t.id===id?{...t,...fields}:t)}));
 const toggle=t=>change(t.id,t.status==="done"?{status:"todo",completedAt:null}:{status:"done",completedAt:new Date().toISOString()});
 const current=new Date(now),today=dateKey(current),currentMinutes=current.getHours()*60+current.getMinutes();
 let previousEnd=0;
 return <section className="focus-redesign" style={{paddingBottom:30}}>
  <div className="macro-board-heading" style={{margin:"3px 0 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}><div><span>DAILY PLAN</span><h2>Timeline</h2></div><button type="button" aria-label="할 일 추가" title="할 일 추가" onClick={onAdd} className="inline-add-task"><Plus size={21}/></button></div>
  <div style={{display:"grid",gap:10}}>
   {timed.length===0&&<p style={{color:"#8d8398",fontSize:14}}>시간을 지정하면 여기에 표시돼.</p>}
   {timed.map(t=>{const start=minutes(t.time);const duration=Math.max(5,Number(t.durationMinutes||t.minutes||30)||30);const end=start+duration;const gap=Math.max(0,start-previousEnd);previousEnd=Math.max(previousEnd,end);return <React.Fragment key={t.id}>
    {gap>0&&<div style={{paddingLeft:57,color:"#968ba0",fontSize:12}}>✧ {gap}분 빈 시간</div>}
    {date===today&&currentMinutes>=start&&currentMinutes<end&&<div style={{color:"#7051a3",fontSize:12,fontWeight:700}}>● 현재 {fmt(currentMinutes)}</div>}
    <div style={{display:"flex",gap:10,alignItems:"stretch"}}>
     <span style={{width:47,flexShrink:0,fontSize:12,color:"#93869c",paddingTop:12}}>{fmt(start)}</span>
     <div style={{flex:1,background:t.color||"#eee6f7",borderRadius:13,padding:13,minHeight:Math.min(130,Math.max(62,duration*.55)),color:"#44394d"}}>
      <small>{fmt(start)}–{fmt(end)} · {duration}분</small>
      <div style={{display:"flex",alignItems:"center",gap:9,marginTop:6}}>
       <button onClick={()=>toggle(t)} style={{border:0,background:"transparent",fontSize:21}}>{t.status==="done"?"☑":"○"}</button>
       <strong onClick={()=>setEditing(t)} style={{flex:1,textDecoration:t.status==="done"?"line-through":"none"}}>{t.title}</strong>
       <button onClick={()=>setEditing(t)} className="secondary">수정</button>
      </div>
     </div>
    </div>
   </React.Fragment>;})}
  </div>
  {editing&&<div style={{position:"fixed",inset:0,zIndex:100,background:"#0006",display:"grid",placeItems:"center",padding:20}}>
   <form onSubmit={e=>{e.preventDefault();const fd=new FormData(e.currentTarget);change(editing.id,{time:fd.get("time")||"",durationMinutes:Number(fd.get("duration"))||30});setEditing(null);}} style={{width:"100%",maxWidth:380,background:"white",padding:22,borderRadius:18,display:"grid",gap:12}}>
    <strong>{editing.title}</strong><label>시작 시간 <input name="time" type="time" defaultValue={editing.time||""}/></label>
    <label>소요 시간(분) <input name="duration" type="number" min="5" step="5" defaultValue={editing.durationMinutes||editing.minutes||30}/></label>
    <div style={{display:"flex",gap:8}}><button type="button" className="secondary" onClick={()=>setEditing(null)}>취소</button><button type="submit" className="primary">저장</button></div>
   </form>
  </div>}
 </section>;
}
