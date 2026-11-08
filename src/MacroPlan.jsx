import React,{useState,useRef,useEffect} from "react";
import {ChevronLeft,ChevronRight,Plus,X,Check,Trash2,Eraser} from "lucide-react";
import "./macro-plan.css";

const PALETTES=[
 {name:"보라",colors:["#EDE2FA","#D7BCEF","#BD99E5","#9B72D1","#7749B2","#523083"]},
 {name:"민트",colors:["#E0F7EE","#B8EAD8","#8BD6BE","#5BBB9D","#368F75","#216956"]},
 {name:"핑크",colors:["#FCE9F1","#F7CBDD","#EBA8C6","#DB80AD","#BD568C","#8D3567"]},
 {name:"블루",colors:["#E7F2FC","#C3DDF8","#99C4EF","#6BA6E2","#427EBD","#285D94"]},
 {name:"옐로",colors:["#FFF6DA","#FBE8B3","#F3D480","#DFB451","#AE8335","#77581F"]},
 {name:"코랄",colors:["#FDE9E1","#F8CFC0","#F2AA91","#E48768","#BE624A","#914434"]},
 {name:"인디고",colors:["#E9E9FA","#C9CAF2","#A6AAE3","#858BD0","#5E65AF","#41477E"]},
 {name:"그린",colors:["#EDF5DE","#D3E8B2","#B0D68B","#89BA62","#609642","#3E702E"]}
];
const paletteOf=family=>PALETTES.find(p=>p.name===family)||PALETTES[0];
const swatchOf=(family,shade)=>paletteOf(family).colors[Math.max(0,Math.min(5,Number(shade)||0))];
const colorText=hex=>{
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
 const light=rgb.map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
 const luminance=0.2126*light[0]+0.7152*light[1]+0.0722*light[2];
 return luminance<0.31?"#FFFFFF":"#30243D";
};
const pad=n=>String(n).padStart(2,"0");
const dateString=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const monday=d=>{const result=new Date(d);result.setHours(12,0,0,0);result.setDate(result.getDate()-(result.getDay()+6)%7);return result;};
const weekDates=(year,anchor)=>{const base=monday(new Date(year,anchor.getMonth(),anchor.getDate(),12));return Array.from({length:52},(_,i)=>{const d=new Date(base);d.setDate(base.getDate()+i*7);return d;});};
const short=d=>`${d.getMonth()+1}/${d.getDate()}`;
const uid=()=>Math.random().toString(36).slice(2,11);

export function MacroPlan({data,onDataChange}){
 const [year,setYear]=useState(()=>new Date().getFullYear());
 const [selected,setSelected]=useState(null);
 const [modal,setModal]=useState(false);
 const [editing,setEditing]=useState(null);
 const [draft,setDraft]=useState("");
 const [shade,setShade]=useState(0);
 const [family,setFamily]=useState("보라");
 const [error,setError]=useState("");
 const [erase,setErase]=useState(false);
 const longPressTimer=useRef(null);
 const longPressTriggered=useRef(false);
 const holdId=useRef(null);
 useEffect(()=>()=>clearTimeout(longPressTimer.current),[]);
 const cancelHold=()=>{clearTimeout(longPressTimer.current);holdId.current=null;};
 const startHold=(e,item)=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  cancelHold();
  holdId.current=item.id;
  longPressTriggered.current=false;
  longPressTimer.current=setTimeout(()=>{
   longPressTriggered.current=true;
   holdId.current=null;
   openEdit(item);
  },550);
 };
 const selectCategory=id=>{
  if(longPressTriggered.current){longPressTriggered.current=false;return;}
  setSelected(id);setErase(false);
 };
 const macro=data.macroPlan||{};
 const categories=macro.categories||[];
 const assignments=macro.assignments?.[year]||{};
 // Keep the 52-week board anchored to its initial start week, not Jan 1.
 // For the current plan the first row starts November 9, 2026.
 const anchorDate=macro.anchorWeek?new Date(macro.anchorWeek+"T12:00:00"):monday(new Date());
 const weeks=weekDates(year,anchorDate);
 const currentMonday=monday(new Date());
 const currentIndex=weeks.findIndex(d=>dateString(d)===dateString(currentMonday));
 const chosen=categories.find(c=>c.id===selected);
 const update=fn=>onDataChange(old=>({...old,macroPlan:fn({...old.macroPlan,anchorWeek:old.macroPlan?.anchorWeek||dateString(anchorDate)})}));
 const openNew=()=>{setEditing(null);setDraft("");setFamily(PALETTES[categories.length%PALETTES.length].name);setShade(0);setError("");setModal(true);};
 const openEdit=c=>{setEditing(c.id);setDraft(c.name);setShade(c.shade??0);setFamily(c.family||"보라");setError("");setModal(true);};
 const save=e=>{
  e.preventDefault();
  const name=draft.trim();
  if(!name){setError("이름을 입력해 줘.");return;}
  if(categories.some(c=>c.id!==editing&&c.name.toLowerCase()===name.toLowerCase())){setError("같은 이름이 있어.");return;}
  if(editing){
   update(m=>({...m,categories:(m.categories||[]).map(c=>c.id===editing?{...c,name,shade,family}:c)}));
  }else{
   const id=uid();update(m=>({...m,categories:[...(m.categories||[]),{id,name,shade,family}]}));setSelected(id);setErase(false);
  }
  setModal(false);
 };
 const deleteCategory=()=>{
  if(!editing||!window.confirm("이 항목과 배정된 주차를 모두 지울까?"))return;
  update(m=>({...m,categories:(m.categories||[]).filter(c=>c.id!==editing),assignments:Object.fromEntries(Object.entries(m.assignments||{}).map(([y,cells])=>[y,Object.fromEntries(Object.entries(cells||{}).filter(([,id])=>id!==editing))]))}));
  if(selected===editing)setSelected(null);
  setModal(false);
 };
 const paint=i=>{
  const target=erase?null:selected;
  if(!erase&&!chosen)return;
  update(m=>{
   const all={...(m.assignments||{})};
   const next={...(all[year]||{})};
   if(!target||next[i]===target)delete next[i];else next[i]=target;
   all[year]=next;
   return {...m,assignments:all};
  });
 };
 return <section className="macro-board" aria-label="매크로 52주 계획">
  <div className="macro-board-header">
   <div className="macro-board-heading"><span>MACRO PLAN</span><h2>52 Weeks</h2></div>
   <div className="macro-year-nav"><button type="button" aria-label="이전 연도" onClick={()=>setYear(y=>y-1)}><ChevronLeft size={19}/></button><strong>{year}</strong><button type="button" aria-label="다음 연도" onClick={()=>setYear(y=>y+1)}><ChevronRight size={19}/></button></div>
  </div>
  <div className="macro-board-body">
   <div className="macro-week-side">
    <div className="macro-week-column-label"><span>WEEK</span><span>01–52</span></div>
    <div className="macro-week-grid">
     {Array.from({length:13},(_,row)=><div className="macro-week-row" key={row}>
      <span className="macro-row-date" title={dateString(weeks[row*4])}>{pad(weeks[row*4].getMonth()+1)}.{pad(weeks[row*4].getDate())}</span>
      {weeks.slice(row*4,row*4+4).map((d,col)=>{
       const i=row*4+col;
       const assigned=categories.find(c=>c.id===assignments[i]);
       const swatch=swatchOf(assigned?.family,assigned?.shade);
       return <button type="button" key={i} onClick={()=>paint(i)}
        aria-label={`${i+1}주차 ${short(d)}부터 ${assigned?.name||"미배정"}`}
        aria-pressed={Boolean(assigned)}
        className={`macro-week-tile ${i===currentIndex?"is-current":""} ${assigned?"is-assigned":""}`}
        style={assigned?{backgroundColor:swatch,color:colorText(swatch)}:undefined}>
        {assigned?<span className="macro-week-name">{assigned.name}</span>:<span className="macro-week-placeholder">+</span>}
       </button>;
      })}
     </div>)}
    </div>
   </div>
   <aside className="macro-palette" aria-label="컬러 항목">
    {categories.map(c=><div key={c.id} className="macro-palette-item">
     <button type="button" className={`macro-palette-choice ${selected===c.id&&!erase?"selected":""}`}
      style={{backgroundColor:swatchOf(c.family,c.shade),color:colorText(swatchOf(c.family,c.shade))}}
      aria-pressed={selected===c.id&&!erase}
      aria-label={c.name+" 선택, 길게 눌러 수정"}
      onPointerDown={e=>startHold(e,c)}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onPointerLeave={cancelHold}
      onContextMenu={e=>e.preventDefault()}
      onClick={()=>selectCategory(c.id)} title={c.name}>
      <span>{c.name}</span>{selected===c.id&&!erase&&<Check size={15} strokeWidth={3}/>}
     </button>
    </div>)}
    <button type="button" className="macro-palette-add" onClick={openNew} aria-label="컬러 항목 추가"><Plus size={25}/></button>
    <button type="button" className={`macro-palette-eraser ${erase?"selected":""}`} onClick={()=>{setErase(true);setSelected(null)}} aria-pressed={erase}><Eraser size={19}/></button>
   </aside>
  </div>
  <div className="macro-board-footer"><span>{Object.keys(assignments).filter(k=>categories.some(c=>c.id===assignments[k])).length} / 52주 배정</span><span>{erase?"지울 주차를 눌러줘":chosen?`${chosen.name} 선택 중 · 주차를 눌러 배정`:"오른쪽에서 항목을 선택해 줘"}</span></div>
  {modal&&<div className="macro-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}>
   <form className="macro-modal" onSubmit={save} role="dialog" aria-modal="true" aria-label={editing?"항목 수정":"항목 추가"}>
    <div className="macro-modal-heading"><h3>{editing?"항목 수정":"새 항목"}</h3><button type="button" aria-label="닫기" onClick={()=>setModal(false)}><X size={21}/></button></div>
    <label htmlFor="macro-category-name">이름</label>
    <input id="macro-category-name" autoFocus maxLength={30} value={draft} onChange={e=>{setDraft(e.target.value);setError("")}} placeholder="예: 논점 진도"/>
    <div className="macro-modal-color-label">컬러 계열</div>
    <div className="macro-family-options" role="group" aria-label="컬러 계열 선택">
     {PALETTES.map(p=><button type="button" key={p.name} className={family===p.name?"active":""} aria-pressed={family===p.name}
      onClick={()=>setFamily(p.name)}>
      <span className="macro-family-dot" style={{background:p.colors[3]}}/>
      <span>{p.name}</span>
     </button>)}
    </div>
    <div className="macro-modal-color-label">명도 6단계</div>
    <div className="macro-color-options">{paletteOf(family).colors.map((hex,i)=><button type="button" key={i} aria-label={family+" "+(i+1)+"단계"} aria-pressed={shade===i} className={shade===i?"active":""} style={{backgroundColor:hex,color:colorText(hex)}} onClick={()=>setShade(i)}>{shade===i&&<Check size={22} strokeWidth={3}/>}</button>)}</div>
    <div className="macro-modal-preview" style={{background:swatchOf(family,shade),color:colorText(swatchOf(family,shade))}}>{draft||"미리보기"}</div>
    {error&&<p className="macro-modal-error" role="alert">{error}</p>}
    <div className="macro-modal-actions">{editing&&<button type="button" className="macro-delete" onClick={deleteCategory}><Trash2 size={16}/> 삭제</button>}<button type="button" className="macro-cancel" onClick={()=>setModal(false)}>취소</button><button type="submit" className="macro-save">저장</button></div>
   </form>
  </div>}
 </section>;
}