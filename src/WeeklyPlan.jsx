import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Trash2, Check, X } from 'lucide-react';
import './weekly-plan.css';

const DAYS=['월','화','수','목','금','토','일'];
const SLOTS=['오전 1','오전 2','오전 3','오후 1','오후 2','오후 3','저녁 1','저녁 2'];
const pad=n=>String(n).padStart(2,'0');
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fromKey=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const mondayOf=d=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return dateKey(x)};
const weekDates=key=>Array.from({length:7},(_,i)=>{const d=fromKey(key);d.setDate(d.getDate()+i);return dateKey(d)});
const formatShort=k=>{const d=fromKey(k);return `${d.getMonth()+1}/${d.getDate()}`};
const uid=()=>globalThis.crypto?.randomUUID?.()||`w_${Date.now()}_${Math.random().toString(36).slice(2)}`;
export function WeeklyPlan({data,onDataChange}) {
  const [week,setWeek]=useState(()=>mondayOf(new Date()));
  const [selected,setSelected]=useState(()=>dateKey(new Date()));
  const [slot,setSlot]=useState(SLOTS[0]);
  const [draft,setDraft]=useState('');
  const [editing,setEditing]=useState(null);
  const [error,setError]=useState('');
  const dates=useMemo(()=>weekDates(week),[week]);
  const entries=Array.isArray(data?.weeklyPlans)?data.weeklyPlans:[];
  const visible=entries.filter(e=>dates.includes(e.date));
  const moveWeek=n=>{const d=fromKey(week);d.setDate(d.getDate()+n*7);const k=dateKey(d);setWeek(k);setSelected(k);setEditing(null);setError('');};
  const persist=transform=>onDataChange(prev=>({...prev,weeklyPlans:transform(Array.isArray(prev.weeklyPlans)?prev.weeklyPlans:[])}));
  const save=e=>{
    e.preventDefault();const title=draft.trim();if(!title){setError('활동을 입력해 줘.');return;}
    if(editing){persist(items=>items.map(x=>x.id===editing?{...x,date:selected,slot,title}:x));}
    else persist(items=>[...items,{id:uid(),date:selected,slot,title,createdAt:new Date().toISOString()}]);
    setEditing(null);setDraft('');setError('');
  };
  const beginEdit=e=>{setEditing(e.id);setSelected(e.date);setSlot(e.slot);setDraft(e.title);setError('');};
  const remove=e=>{if(!window.confirm('이 계획을 삭제할까?'))return;persist(items=>items.filter(x=>x.id!==e.id));if(editing===e.id){setEditing(null);setDraft('');}};
  return <section className="wp-page">
    <div className="wp-title"><h1>위클리</h1><div className="wp-week-nav"><button type="button" onClick={()=>moveWeek(-1)} aria-label="이전 주"><ChevronLeft size={20}/></button><strong>{formatShort(dates[0])} ~ {formatShort(dates[6])}</strong><button type="button" onClick={()=>moveWeek(1)} aria-label="다음 주"><ChevronRight size={20}/></button></div></div>
    <div className="wp-days" aria-label="주간 날짜 선택">{dates.map((date,i)=><button key={date} type="button" className={selected===date?'selected':''} onClick={()=>{setSelected(date);setEditing(null);setDraft('');}}><small>{DAYS[i]}</small><b>{Number(date.slice(-2))}</b></button>)}</div>
    <form className="wp-editor" onSubmit={save}>
      <div className="wp-editor-top"><strong>{formatShort(selected)} {DAYS[dates.indexOf(selected)]||''}요일</strong>{editing&&<button type="button" className="wp-quiet" onClick={()=>{setEditing(null);setDraft('');}}>수정 취소 <X size={14}/></button>}</div>
      <div className="wp-input-row"><label><span>시간대</span><select value={slot} onChange={e=>setSlot(e.target.value)}>{SLOTS.map(s=><option key={s}>{s}</option>)}</select></label><label className="wp-activity"><span>활동</span><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="무슨 활동을 할까?" maxLength={300}/></label></div>
      {error&&<div className="wp-error" role="alert">{error}</div>}
      <button className="wp-save" type="submit" disabled={!draft.trim()}>{editing?'수정 저장':'계획 추가'}</button>
    </form>
    <div className="wp-table-title"><strong>주간 계획표</strong><span>{visible.length}개 계획</span></div>
    <div className="wp-scroll"><table className="wp-table"><thead><tr><th scope="col">시간대</th>{dates.map((d,i)=><th key={d} scope="col">{DAYS[i]}<span>{formatShort(d)}</span></th>)}</tr></thead><tbody>{SLOTS.map(s=><tr key={s}><th scope="row">{s}</th>{dates.map(d=>{const cell=visible.filter(e=>e.date===d&&e.slot===s);return <td key={d}>{cell.map(e=><div className="wp-entry" key={e.id}><button className="wp-entry-text" type="button" onClick={()=>beginEdit(e)} title="수정하기">{e.title}</button><div className="wp-entry-actions"><button type="button" onClick={()=>beginEdit(e)} aria-label={`${e.title} 수정`}><Pencil size={12}/></button><button type="button" onClick={()=>remove(e)} aria-label={`${e.title} 삭제`}><Trash2 size={12}/></button></div></div>)}</td>})}</tr>)}</tbody></table></div>
    <p className="wp-hint">시간을 입력하지 않고 오전 3칸·오후 3칸·저녁 2칸, 총 8개 구간으로 계획해. 저장하면 주간 계획표에 즉시 반영돼.</p>
  </section>;
}
