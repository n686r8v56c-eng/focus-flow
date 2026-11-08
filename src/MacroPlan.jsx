import React,{useState} from "react";
import {ChevronLeft,ChevronRight,Plus,Palette,X,ArrowUp,ArrowDown} from "lucide-react";
import "./macro-plan.css";
const palettes=[
["#eee2fb","#cfb9f0","#ad8adc","#8054bd","#573089"],
["#def5ec","#aee4d1","#7ac9ae","#449f82","#24745e"],
["#fbe5ed","#f3bfd1","#e58eae","#c35c87","#903b67"],
["#e1edfc","#b9d5f5","#88b5e9","#558aca","#305f98"],
["#fff2ce","#f6dc9f","#e9bf69","#ba8e37","#806022"],
["#ffe6dc","#f5c1ad","#e99479","#cf6d50","#9d4735"],
["#e3e4fa","#bcbef1","#9095dd","#606ab9","#3c468f"],
["#e3f3c9","#c2e499","#9bc869","#679d42","#426f2c"]];
const pad=n=>String(n).padStart(2,"0");
const key=d=>[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join("-");
const date=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12)};
const monday=d=>{const x=new Date(d);x.setHours(12);x.setDate(x.getDate()-(x.getDay()+6)%7);return key(x)};
const move=(s,n)=>{const d=date(s);d.setDate(d.getDate()+n);return key(d)};
const short=s=>{const d=date(s);return (d.getMonth()+1)+"/"+d.getDate()};
const uid=()=>Math.random().toString(36).slice(2,10);
export function MacroPlan({data,onDataChange,onOpenWeekly}){
const rows=data.macroPlan?.projects||[];
const [weeks,setWeeks]=useState(6),[start,setStart]=useState(()=>monday(new Date())),[name,setName]=useState(""),[error,setError]=useState("");
const dates=Array.from({length:weeks},(_,i)=>move(start,i*7));
const mutate=fn=>onDataChange(old=>({...old,macroPlan:fn(old.macroPlan||{})}));
const editProject=(id,patch)=>mutate(s=>({...s,projects:(s.projects||[]).map(p=>p.id===id?{...p,...patch}:p)}));
const editCell=(id,week,patch)=>mutate(s=>({...s,projects:(s.projects||[]).map(p=>p.id===id?{...p,cells:{...p.cells,[week]:{...p.cells?.[week],...patch}}}:p)}));
const add=e=>{e.preventDefault();const title=name.trim();if(!title)return;if(rows.some(p=>p.name.toLowerCase()===title.toLowerCase())){setError("이미 등록된 프로젝트야.");return;}
mutate(s=>({...s,projects:[...(s.projects||[]),{id:uid(),name:title,palette:(s.projects||[]).length%palettes.length,cells:{}}]}));setName("");setError("");};
const reorder=(i,delta)=>{const j=i+delta;if(j<0||j>=rows.length)return;mutate(s=>{const list=[...(s.projects||[])];[list[i],list[j]]=[list[j],list[i]];return {...s,projects:list}})};
const remove=id=>{if(window.confirm("매크로에서 이 프로젝트와 주차 목표를 제거할까?"))mutate(s=>({...s,projects:(s.projects||[]).filter(p=>p.id!==id)}))};
return <section className="macro-page" aria-label="매크로 계획">
<div className="macro-top"><div><small>MACRO PLAN</small><h2>프로젝트 로드맵</h2></div><div className="macro-period">{[4,6,12].map(n=><button type="button" key={n} className={n===weeks?"active":""} aria-pressed={n===weeks} onClick={()=>setWeeks(n)}>{n}주</button>)}</div></div>
<div className="macro-nav"><button type="button" aria-label="이전 기간" onClick={()=>setStart(s=>move(s,-weeks*7))}><ChevronLeft size={18}/></button><strong>{short(start)} – {short(move(start,weeks*7-1))}</strong><button type="button" aria-label="다음 기간" onClick={()=>setStart(s=>move(s,weeks*7))}><ChevronRight size={18}/></button><button type="button" onClick={()=>setStart(monday(new Date()))}>이번 주</button></div>
<div className="macro-scroll" role="region" aria-label="주차별 프로젝트 계획" tabIndex={0}><table className="macro-table"><thead><tr><th>프로젝트</th>{dates.map(d=><th key={d}><button type="button" title="이번 주 집중에서 보기" onClick={()=>onOpenWeekly(d)}>{short(d)} ↗</button></th>)}</tr></thead><tbody>
{rows.map((p,i)=><tr key={p.id}><th><div className="macro-project"><strong>{p.name}</strong><div className="macro-actions"><button type="button" disabled={i===0} aria-label="위로" onClick={()=>reorder(i,-1)}><ArrowUp size={13}/></button><button type="button" disabled={i===rows.length-1} aria-label="아래로" onClick={()=>reorder(i,1)}><ArrowDown size={13}/></button><button type="button" aria-label="프로젝트 색상 계열 변경" onClick={()=>editProject(p.id,{palette:((p.palette??i)+1)%palettes.length})}><Palette size={13}/></button><button type="button" aria-label="프로젝트 제거" onClick={()=>remove(p.id)}><X size={13}/></button></div></div></th>
{dates.map(d=>{const c=p.cells?.[d]||{},shade=c.shade??0,fg=shade>=3?"#fff":"#30273c";return <td key={d}><div className="macro-cell" style={{background:palettes[(p.palette??i)%palettes.length][shade],color:fg}}><textarea rows={2} value={c.text||""} placeholder="+" aria-label={p.name+" "+d+" 목표"} style={{color:fg}} onChange={e=>editCell(p.id,d,{text:e.target.value})}/><button type="button" aria-label="색상 명도 변경" title="색상 변경" style={{color:fg}} onClick={()=>editCell(p.id,d,{shade:(shade+1)%5})}><Palette size={13}/></button></div></td>})}</tr>)}
</tbody></table></div>
<form className="macro-add" onSubmit={add}><input list="macro-name-options" placeholder="프로젝트 선택 또는 입력" aria-label="추가할 프로젝트" value={name} onChange={e=>{setName(e.target.value);setError("")}}/><datalist id="macro-name-options">{(data.projects||[]).map(p=><option key={p.id} value={p.name}/>)}</datalist><button type="submit"><Plus size={16}/> 추가</button></form>
{error&&<p role="alert" className="macro-error">{error}</p>}
<p className="macro-help">칸에서 목표 수정 · 팔레트로 5단계 색상 변경 · 주차 제목을 눌러 Weekly Focus로 이동</p>
</section>;
}