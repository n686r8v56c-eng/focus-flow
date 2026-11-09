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
 const pxPerMinute=0.8;
 const rowGap=10;
 const blocks=[];
 let cursor=0,offset=0,markerTop=null;
 const pushBlock=(block,height)=>{
   if(markerTop===null && currentMinutes>=block.start && currentMinutes<=block.end){
     markerTop=offset+(currentMinutes-block.start)*pxPerMinute;
   }
   blocks.push({...block,height});
   offset+=height+rowGap;
 };
 const firstStart=timed.length?minutes(timed[0].time):currentMinutes;
 cursor=Math.min(firstStart,currentMinutes);
 for(const t of timed){
   const start=minutes(t.time);
   const duration=Math.max(5,Number(t.durationMinutes||t.minutes||30)||30);
   const end=start+duration;
   if(start>cursor){
     const gap=start-cursor;
     pushBlock({kind:"gap",start:cursor,end:start,key:"gap-"+t.id},gap*pxPerMinute);
   }
   const height=Math.max(100,duration*pxPerMinute);
   if(markerTop===null&&currentMinutes>=start&&currentMinutes<=end){
     markerTop=offset+Math.min(height,(currentMinutes-start)*height/duration);
   }
   blocks.push({kind:"task",key:t.id,task:t,start,end,duration,height});
   offset+=height+rowGap;
   cursor=Math.max(cursor,end);
 }
 if(currentMinutes>cursor){
   const gap=currentMinutes-cursor;
   pushBlock({kind:"gap",start:cursor,end:currentMinutes,key:"gap-current"},gap*pxPerMinute);
 }
 if(markerTop===null)markerTop=0;
 return <section className="focus-redesign" style={{paddingBottom:30}}>
  <div className="macro-board-heading" style={{margin:"3px 0 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}><div><span>DAILY PLAN</span><h2>Timeline</h2></div><button type="button" aria-label="할 일 추가" title="할 일 추가" onClick={onAdd} className="inline-add-task"><Plus size={21}/></button></div>
  <div style={{position:"relative",paddingTop:10}}>
   <div style={{display:"grid",gap:rowGap}}>
    {blocks.map(block=>block.kind==="gap"
     ?<div key={block.key} style={{height:block.height,display:"flex",alignItems:"center",paddingLeft:57,color:"#968ba0",fontSize:12,boxSizing:"border-box"}}>
       {block.end-block.start>=15&&<span>✧ {block.end-block.start}분 빈 시간</span>}
      </div>
     :<div key={block.key} style={{display:"flex",gap:10,alignItems:"stretch",height:block.height}}>
       <span style={{width:47,flexShrink:0,fontSize:12,color:"#93869c",paddingTop:12}}>{fmt(block.start)}</span>
       <div role="button" tabIndex={0} aria-label={`${block.task.title} 일정 수정`} onClick={()=>setEditing(block.task)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setEditing(block.task);}}} style={{flex:1,background:block.task.color||"#eee6f7",borderRadius:13,padding:"12px 14px",color:"#44394d",minWidth:0,boxSizing:"border-box",cursor:"pointer",display:"flex",flexDirection:"column",justifyContent:"center",gap:8}}>
        <span style={{fontSize:12,color:"#71677b",lineHeight:1.3,whiteSpace:"nowrap"}}>{fmt(block.start)}–{fmt(block.end)} · {block.duration}분</span>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
         <button type="button" aria-label={block.task.status==="done"?"완료 취소":"완료 표시"} onClick={e=>{e.stopPropagation();toggle(block.task);}} style={{border:"1.5px solid #71677b",borderRadius:"50%",background:block.task.status==="done"?"#7754aa":"transparent",color:block.task.status==="done"?"white":"#71677b",width:24,height:24,flexShrink:0,display:"grid",placeItems:"center",padding:0,fontSize:15}}>{block.task.status==="done"?"✓":""}</button>
         <strong style={{flex:1,minWidth:0,overflowWrap:"anywhere",fontSize:16,lineHeight:1.35,textDecoration:block.task.status==="done"?"line-through":"none"}}>{block.task.title}</strong>
        </div>
       </div>
      </div>)}
    {timed.length===0&&<p style={{color:"#8d8398",fontSize:14,paddingLeft:57}}>시간을 지정하면 여기에 표시돼.</p>}
   </div>
   <div aria-label={`현재 시각 ${fmt(currentMinutes)}`} style={{position:"absolute",top:10+markerTop,left:0,right:0,height:0,borderTop:"3px solid #56358b",zIndex:5,pointerEvents:"none",display:"flex",alignItems:"center"}}>
     <span style={{position:"absolute",left:0,top:-16,background:"#56358b",color:"white",borderRadius:18,padding:"4px 9px",fontSize:12,fontWeight:700,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{fmt(currentMinutes)}</span>
   </div>
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
