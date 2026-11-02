import React, {useEffect, useMemo, useState} from 'react';
import {ChevronLeft, ChevronRight, Plus, Pencil, Trash2, RefreshCw, X} from 'lucide-react';
import './timetable.css';

const pad = n => String(n).padStart(2,'0');
const asDate = value => { const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d,12); };
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays = (value,n)=>{const d=asDate(value);d.setDate(d.getDate()+n);return keyOf(d);};
const minTime = value => {const [h,m] = value.split(':').map(Number);return h*60+m;};
const labelTime = minutes => `${pad(Math.floor(minutes/60))}:${pad(minutes%60)}`;
const tones=['#9c85cb','#c4b5df','#8078a8','#d7c8e9','#b3a1d4','#938bb5','#e0d6ef','#77679e'];
const colorFor = name => { let hash=0;for(const c of name)hash=(Math.imul(hash,31)+c.codePointAt(0))|0;return tones[(hash>>>0)%tones.length];};
const freshId = () => globalThis.crypto?.randomUUID?.() || `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const POLAR = (m,r) => {const t = (m/1440)*Math.PI*2-Math.PI/2;return [160+r*Math.cos(t),160+r*Math.sin(t)];};
const pie = (start,end,r=117) => { const [sx,sy]=POLAR(start,r),[ex,ey]=POLAR(end,r);return `M160,160 L${sx},${sy} A${r},${r} 0 ${end-start>720?1:0} 1 ${ex},${ey} Z`;};
const hourOptions = Array.from({length:24},(_,i)=>pad(i));
const minuteOptions = Array.from({length:12},(_,i)=>pad(i*5));
function ClockChart({segments,date,mode}){
  return <svg className="tt-chart" viewBox="0 0 320 320" role="img" aria-label={`${date} ${mode==='plan'?'계획':'실제'} 24시간 원형 시간표`}>
    <circle cx="160" cy="160" r="117" fill="#f3eff9" stroke="#e5ddef" strokeWidth="1"/>
    {segments.map((b,i)=> <path key={`${b.id}-${i}`} d={pie(b.start,b.end)} fill={colorFor(b.title)} stroke="#fff" strokeWidth="1.3" />)}
    <circle cx="160" cy="160" r="37" fill="white"/>
    <text x="160" y="157" textAnchor="middle" fill="#41364c" fontSize="14" fontWeight="700">{Number(date.slice(5,7))}/{Number(date.slice(8,10))}</text>
    <text x="160" y="174" textAnchor="middle" fill="#81748d" fontSize="11">{mode==='plan'?'계획':'실제'}</text>
    {[0,3,6,9,12,15,18,21].map(h=>{const [x,y]=POLAR(h*60,137);return <text key={h} x={x} y={y+4} textAnchor="middle" fontSize="11" fill="currentColor">{h}</text>;})}
  </svg>;
}
export function TimeTable({data, onDataChange, client, userId, initialDate}){
  const [date,setDate]=useState(initialDate || keyOf(new Date()));
  const [mode,setMode]=useState('plan');
  const [start,setStart]=useState('08:00');
  const [end,setEnd]=useState('09:00');
  const [title,setTitle]=useState('');
  const [editing,setEditing]=useState(null);
  const [editorOpen,setEditorOpen]=useState(false);
  const [error,setError]=useState('');
  const [server,setServer]=useState({entries:[],active:null});
  const [syncError,setSyncError]=useState('');
  const [loadNonce,setLoadNonce]=useState(0);
  const plan = Array.isArray(data?.timeBlocks) ? data.timeBlocks : [];
  const weekStart = useMemo(()=>{const d=asDate(date);d.setDate(d.getDate()-d.getDay());return keyOf(d);},[date]);
  useEffect(()=>{
    if(!client||!userId)return;
    let live=true;
    async function load(){try{
      const {data:result,error:e}=await client.rpc('focus_timelog_action',{p_action:'read'});
      if(e)throw e;
      if(live){setServer({entries:result?.entries||[],active:result?.active||null});setSyncError('');}
    }catch(e){if(live)setSyncError('실제 타임로그를 불러오지 못했어. 로그인과 서버 연결을 확인해 줘.');}}
    load();const timer=setInterval(load,10000);
    const refresh=()=>load();
    const channel=client.channel(`timetable-${userId}`).on('postgres_changes',{event:'*',schema:'public',table:'focus_timelog_entries',filter:`user_id=eq.${userId}`},refresh).on('postgres_changes',{event:'*',schema:'public',table:'focus_timelog_active',filter:`user_id=eq.${userId}`},refresh).subscribe();
    const visible=()=>{if(document.visibilityState==='visible')load();};document.addEventListener('visibilitychange',visible);
    return ()=>{live=false;clearInterval(timer);client.removeChannel(channel);document.removeEventListener('visibilitychange',visible);};
  },[client,userId,loadNonce]);
  const segments=useMemo(()=>{
    if(mode==='plan')return plan.filter(b=>b.date===date&&(b.mode||'plan')==='plan').map(b=>({...b,start:Math.round(Number(b.start)*60),end:Math.round(Number(b.end)*60)})).filter(b=>b.end>b.start&&b.end<=1440);
    const midnight=new Date(`${date}T00:00:00`).getTime();const next=addDays(date,1);const limit=new Date(`${next}T00:00:00`).getTime();
    return [...server.entries,...(server.active?[{...server.active,id:'active',start:server.active.start,end:new Date().toISOString()}]:[])].flatMap((entry,i)=>{
      const a=Math.max(midnight,Date.parse(entry.start));const b=Math.min(limit,Date.parse(entry.end));
      if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)return [];
      return [{id:entry.id||i,start:Math.max(0,(a-midnight)/60000),end:Math.min(1440,(b-midnight)/60000),title:entry.activity||'미지정'}];
    }).sort((a,b)=>a.start-b.start);
  },[mode,plan,date,server]);
  const timeTitle = entry=>`${labelTime(Math.round(entry.start))}–${labelTime(Math.round(entry.end))}`;
  const save=e=>{e.preventDefault();const s=minTime(start),t=minTime(end),name=title.trim();if(!name||t<=s){setError('활동을 입력하고 종료 시간을 시작보다 늦게 선택해 줘.');return;}
    const conflicts=segments.some(b=>b.id!==editing&&b.start<t&&s<b.end);
    if(conflicts&&!window.confirm('기존 계획과 시간이 겹쳐. 그래도 추가할까?'))return;
    onDataChange(d=>({...d,timeBlocks:[...(d.timeBlocks||[]).filter(b=>b.id!==editing),{id:editing||freshId(),date,mode:'plan',start:s/60,end:t/60,title:name}]}));
    setEditing(null);setTitle('');setError('');setEditorOpen(false);
  };
  const edit = b=>{setEditing(b.id);setStart(labelTime(Math.round(b.start/5)*5));setEnd(labelTime(Math.round(b.end/5)*5));setTitle(b.title);setError('');setEditorOpen(true);};
  const remove = id=>{if(!window.confirm('이 계획 블록을 삭제할까?'))return;onDataChange(d=>({...d,timeBlocks:(d.timeBlocks||[]).filter(b=>b.id!==id)}));if(editing===id){setEditing(null);setTitle('');}};
  const changeTimePart = (which,part,value) => {
    const current = which==='start' ? start : end;
    const [hour,minute] = current.split(':');
    const next = part==='hour' ? `${value}:${minute}` : `${hour}:${value}`;
    (which==='start' ? setStart : setEnd)(next);
    setError('');
  };
  const timeField = (which,label,value) => {
    const [hour,minute] = value.split(':');
    return <div className="tt-time-field"><span className="tt-time-label">{label}</span><div className="tt-time-parts">
      <label className="tt-time-part"><span>시</span><select aria-label={`${label} 시`} value={hour} onChange={e=>changeTimePart(which,'hour',e.target.value)}>{hourOptions.map(h=><option key={h} value={h}>{h}</option>)}</select></label>
      <span className="tt-time-colon" aria-hidden="true">:</span>
      <label className="tt-time-part"><span>분</span><select aria-label={`${label} 분`} value={minute} onChange={e=>changeTimePart(which,'minute',e.target.value)}>{minuteOptions.map(m=><option key={m} value={m}>{m}</option>)}</select></label>
    </div></div>;
  };
  return <section className="tt-page">
    <header className="tt-heading"><h1>시간표</h1><div><button type="button" onClick={()=>setDate(addDays(date,-7))} aria-label="이전 주"><ChevronLeft size={18}/></button><span>{asDate(date).getFullYear()}년 {asDate(date).getMonth()+1}월</span><button type="button" onClick={()=>setDate(addDays(date,7))} aria-label="다음 주"><ChevronRight size={18}/></button></div></header>
    <div className="tt-week" role="group" aria-label="주간 날짜 선택">{Array.from({length:7},(_,i)=>{const day=addDays(weekStart,i),d=asDate(day);return <button key={day} type="button" onClick={()=>{setDate(day);setEditing(null);setTitle('');}} className={day===date?'active':''}><small>{'일월화수목금토'[i]}</small><strong>{d.getDate()}</strong></button>;})}</div>
    <div className="tt-selected">{Number(date.slice(5,7))}월 {Number(date.slice(8,10))}일 {'일월화수목금토'[asDate(date).getDay()]}요일</div>
    <div className="tt-subtabs" role="tablist" aria-label="시간표 종류"><button type="button" role="tab" aria-selected={mode==='plan'} className={mode==='plan'?'active':''} onClick={()=>setMode('plan')}>계획</button><button type="button" role="tab" aria-selected={mode==='actual'} className={mode==='actual'?'active':''} onClick={()=>setMode('actual')}>실제</button></div>
    {mode==='actual'&&<div className="tt-actual-hint"><span>타임로그 기록으로 자동 생성돼.</span><button type="button" onClick={()=>setLoadNonce(x=>x+1)} aria-label="타임로그 새로고침"><RefreshCw size={16}/></button>{syncError&&<p role="alert">{syncError}</p>}</div>}
    <div className="tt-circle-title"><strong>{mode==='plan'?'계획':'실제'} · 24시간</strong><div className="tt-circle-actions"><span>{segments.length}개 기록</span>{mode==='plan'&&<button type="button" className="tt-add-icon" aria-label="계획 추가" title="계획 추가" onClick={()=>{setEditing(null);setTitle('');setError('');setEditorOpen(true);}}><Plus size={18}/></button>}</div></div>
    {editorOpen&&mode==='plan'&&<div className="tt-modal-backdrop" onClick={()=>setEditorOpen(false)}><div className="tt-modal" role="dialog" aria-modal="true" aria-label={editing?'계획 수정':'계획 추가'} onClick={e=>e.stopPropagation()}>
      <div className="tt-modal-header"><strong>{editing?'계획 수정':'계획 추가'}</strong><button type="button" onClick={()=>setEditorOpen(false)} aria-label="닫기"><X size={20}/></button></div>
      <form className="tt-editor" onSubmit={save}>
        <div className="tt-selects">{timeField('start','시작',start)}{timeField('end','종료',end)}</div>
        <div className="tt-addrow"><input aria-label="활동 이름" maxLength={120} placeholder="예: 식사, 공부, 앱 개발" value={title} onChange={e=>setTitle(e.target.value)}/><button type="submit"><Plus size={17}/>{editing?'저장':'추가'}</button></div>
        {error&&<p role="alert" className="tt-error">{error}</p>}
      </form>
    </div></div>}
    <ClockChart segments={segments} date={date} mode={mode}/>
    <div className="tt-list">{segments.map(b=><div key={b.id} className="tt-entry"><span className="tt-dot" style={{background:colorFor(b.title)}}/><span className="tt-clock">{timeTitle(b)}</span><span className="tt-name">{b.title}</span>{mode==='plan'&&<><button type="button" onClick={()=>edit(b)} aria-label={`${b.title} 수정`}><Pencil size={15}/></button><button type="button" onClick={()=>remove(b.id)} aria-label={`${b.title} 삭제`}><Trash2 size={15}/></button></>}</div>)}{!segments.length&&<div className="tt-empty">{mode==='plan'?'등록된 계획이 없어.':'이날의 타임로그 기록이 없어.'}</div>}</div>
    {mode==='actual'&&<p className="tt-footnote">실제 기록 수정은 상단 타임로그의 기록 편집 기능에서 할 수 있어.</p>}
  </section>;
}
