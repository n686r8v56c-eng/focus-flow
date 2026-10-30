import React from "react";
export function linkedSteps(w, source) {
 const items=w.steps ?? w.sequenceSteps ?? w.sequence?.steps ?? w.sequence?.items ?? w.movements ?? w.exercises;
 if(Array.isArray(items)&&items.length) return items.slice(0,200).map((s,i)=>({key:String(s?.id??s?.stepId??`step-${i}`),label:String(typeof s==="string"?s:s?.name??s?.title??s?.label??`동작 ${i+1}`)}));
 if(source!=="mind" || (w.kind!=="breath" && !/나디\s*쇼다나/.test(w.title??"")))return [];
 const count=Number(w.repetitions??w.repeatCount??w.count??w.rounds??(String(w.title??"").match(/(\d+)\s*회/)||[])[1]);
 if(!Number.isInteger(count)||count<1||count>108)return [];
 const name=String(w.title??"나디 쇼다나").replace(/\s*·?\s*\d+\s*회\s*$/,"").trim();
 return Array.from({length:count},(_,i)=>({key:`repeat-${i+1}`,label:`${name} ${i+1}회`}));
}
export function LinkedSteps({items, value, onChange}) {
 if(!items.length)return null;
 const done=items.filter(x=>!!value?.[x.key]).length;
 return <div style={{width:"100%",boxSizing:"border-box",padding:"4px 6px 4px 52px"}}>
  <div style={{display:"flex",gap:9,alignItems:"center",marginBottom:6}}>
   <svg viewBox="0 0 40 40" width="28" height="28" role="img" aria-label={`${done}/${items.length} 완료`}>
    <circle cx="20" cy="20" r="15" fill="none" stroke="#e9e4ef" strokeWidth="5"/>
    <circle cx="20" cy="20" r="15" fill="none" stroke="#9c85cd" strokeWidth="5" strokeDasharray={`${94.248*done/items.length} 94.248`} transform="rotate(-90 20 20)"/>
   </svg><span style={{fontSize:12,color:"#9484a5"}}>{done}/{items.length} 완료</span>
  </div>
  <div style={{display:"grid",gap:6}}>{items.map(item=><label key={item.key} style={{display:"flex",gap:8,alignItems:"center",fontSize:13}}>
   <input type="checkbox" style={{accentColor:"#9c85cd"}} checked={!!value?.[item.key]} onChange={e=>onChange({...value,[item.key]:e.target.checked})}/>
   <span style={{textDecoration:value?.[item.key]?"line-through":"none",color:value?.[item.key]?"#aaa":"#5f536a"}}>{item.label}</span>
  </label>)}</div>
 </div>;
}
