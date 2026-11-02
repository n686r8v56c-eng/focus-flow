import React, { useMemo, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import './weekly-plan.css';

const DAYS=['월','화','수','목','금','토','일'];
const SLOTS=['오전 1','오전 2','오전 3','오후 1','오후 2','오후 3','저녁 1','저녁 2'];
const SLOT_HOURS = Object.fromEntries(SLOTS.map((name,index) => { const start=6+index*2; const end=start+2; return [name, `${String(start).padStart(2,'0')}:00–${String(end).padStart(2,'0')}:00`]; }));
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
  const [menuEntry,setMenuEntry]=useState(null);
  const [quickCell,setQuickCell]=useState(null);
  const [quickDraft,setQuickDraft]=useState('');
  const longPressTimer=useRef(null);
  const longPressed=useRef(false);
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
  const openQuickCell=(date,chosenSlot)=>{
    setSelected(date);setSlot(chosenSlot);
    setQuickCell({date,slot:chosenSlot});setQuickDraft('');setError('');
  };
  const saveQuickCell=ev=>{
    ev.preventDefault();ev.stopPropagation();
    const title=quickDraft.trim();if(!title||!quickCell)return;
    // Release focused input before removing the inline editor (iOS Safari zoom guard).
    if (ev.currentTarget?.elements?.[0]?.blur) ev.currentTarget.elements[0].blur();
    persist(items=>quickCell.editId ? items.map(item=>item.id===quickCell.editId?{...item,title}:item) : items.filter(item=>item.date===quickCell.date&&item.slot===quickCell.slot).length>=2 ? items : [...items,{id:uid(),date:quickCell.date,slot:quickCell.slot,title,createdAt:new Date().toISOString()}]);
    setQuickCell(null);setQuickDraft('');
  };
  const openLongPress=e=>{longPressed.current=true;setMenuEntry(e);};
  const clearLongPress=()=>{clearTimeout(longPressTimer.current);};
  const beginEdit=e=>{setSelected(e.date);setSlot(e.slot);setQuickCell({date:e.date,slot:e.slot,editId:e.id});setQuickDraft(e.title);setError('');};
  const remove=e=>{if(!window.confirm('이 계획을 삭제할까?'))return;persist(items=>items.filter(x=>x.id!==e.id));if(editing===e.id){setEditing(null);setDraft('');}};
  return <section className="wp-page">
    <div className="wp-title"><h1>위클리</h1><div className="wp-week-nav"><button type="button" onClick={()=>moveWeek(-1)} aria-label="이전 주"><ChevronLeft size={20}/></button><strong>{formatShort(dates[0])} ~ {formatShort(dates[6])}</strong><button type="button" onClick={()=>moveWeek(1)} aria-label="다음 주"><ChevronRight size={20}/></button></div></div>
    <div className="wp-days" aria-label="주간 날짜 선택">{dates.map((date,i)=><button key={date} type="button" className={selected===date?'selected':''} onClick={()=>{setSelected(date);setEditing(null);setDraft('');}}><small>{DAYS[i]}</small><b>{Number(date.slice(-2))}</b></button>)}</div>
    <div className="wp-table-title"><strong>주간 계획표</strong><span>{visible.length}개 계획</span></div>
    <div className="wp-scroll" aria-label="좌우로 스크롤하여 주말 보기"><table className="wp-table"><thead><tr><th scope="col">시간대</th>{dates.map((d,i)=><th key={d} scope="col">{DAYS[i]}<span>{formatShort(d)}</span></th>)}</tr></thead><tbody>{SLOTS.map(s=><tr key={s}><th scope="row"><span className="wp-slot-name">{s}</span><span className="wp-slot-hours">{SLOT_HOURS[s]}</span></th>{dates.map(d=>{const cell=visible.filter(e=>e.date===d&&e.slot===s);return <td key={d} className="wp-cell" onClick={event=>{if(event.target===event.currentTarget)openQuickCell(d,s);}} title="빈 공간을 탭해서 활동 입력">
      {quickCell?.date===d&&quickCell?.slot===s&&<form className="wp-inline-editor" onSubmit={saveQuickCell} onClick={ev=>ev.stopPropagation()}>
        <input autoFocus type="text" value={quickDraft} onChange={ev=>setQuickDraft(ev.target.value)} maxLength={300} placeholder="활동 입력" aria-label={`${formatShort(d)} ${s} 활동 입력`}/>
        <div className="wp-inline-actions"><button type="submit" disabled={!quickDraft.trim()}>{quickCell?.editId?'저장':'추가'}</button><button type="button" onClick={()=>setQuickCell(null)}>취소</button></div>
      </form>}
      {cell.map(e=><div className="wp-entry" key={e.id}><button className="wp-entry-text" type="button"
        onPointerDown={event=>{if(event.pointerType==='mouse'&&event.button!==0)return;clearLongPress();longPressed.current=false;longPressTimer.current=setTimeout(()=>openLongPress(e),550);}}
        onPointerUp={clearLongPress} onPointerCancel={clearLongPress} onPointerLeave={clearLongPress}
        onContextMenu={ev=>{ev.preventDefault();clearLongPress();openLongPress(e);}}
        onClick={()=>{if(longPressed.current){longPressed.current=false;return;}setSelected(e.date);setSlot(e.slot);}}
        title="길게 누르면 수정·삭제" aria-label={`${e.title}, 길게 누르면 수정 또는 삭제`}>{e.title}</button></div>)}
      {cell.length<2&&!(quickCell?.date===d&&quickCell?.slot===s)&&<button type="button" className="wp-cell-add" onClick={ev=>{ev.stopPropagation();openQuickCell(d,s);}} aria-label={`${formatShort(d)} ${s} 계획 추가`}>＋</button>}</td>})}</tr>)}</tbody></table></div>
    {menuEntry && <div className="wp-modal-backdrop" onClick={()=>setMenuEntry(null)}><div className="wp-action-modal" role="dialog" aria-modal="true" aria-label="위클리 계획 편집" onClick={e=>e.stopPropagation()}><strong>{menuEntry.title}</strong><div className="wp-modal-actions"><button type="button" onClick={()=>{beginEdit(menuEntry);setMenuEntry(null);}}>수정</button><button type="button" onClick={()=>{remove(menuEntry);setMenuEntry(null);}}>삭제</button><button type="button" onClick={()=>setMenuEntry(null)}>취소</button></div></div></div>}
    <p className="wp-hint">시간을 입력하지 않고 오전 3칸·오후 3칸·저녁 2칸, 총 8개 구간으로 계획해. 저장하면 주간 계획표에 즉시 반영돼.</p>
  </section>;
}
