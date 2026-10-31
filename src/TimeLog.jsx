import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock3 } from 'lucide-react';
import './timelog.css';

const initialActivities = ['앱개발', '공부', '운동', '명상'];
const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const minutesText = ms => {const m=Math.round(ms/60000);return m>=60?`${Math.floor(m/60)}시간 ${m%60}분`:`${m}분`;};
const elapsed = ms => {const s=Math.max(0,Math.floor(ms/1000));return `${pad(Math.floor(s/3600))}:${pad(Math.floor(s%3600/60))}:${pad(s%60)}`;};
const nextDay = d => new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime();
function dailySegments(start,end){
  const result=[];let cursor=start;
  while(cursor<end){const current=new Date(cursor);const cut=Math.min(end,nextDay(current));result.push({date:dateKey(current),ms:cut-cursor});cursor=cut;}
  return result;
}
const startOfWeek = d => {const x=new Date(d);const weekday=(x.getDay()+6)%7;x.setDate(x.getDate()-weekday);x.setHours(0,0,0,0);return x;};
function aggregate(logs,from,to){const by={};let total=0;for(const item of logs){const s=Date.parse(item.start),e=Date.parse(item.end);if(!Number.isFinite(s)||!Number.isFinite(e)||e<=s)continue;for(const part of dailySegments(s,e)){if(part.date<from||part.date>to)continue;by[part.date]??={};by[part.date][item.activity]=(by[part.date][item.activity]||0)+part.ms;total+=part.ms;}}return {by,total};}
// Stable named colors never depend on activity order across devices.
const namedColors = {
  '앱개발':'#9D83CD', '공부':'#5FAE91', '운동':'#E69B72',
  '명상':'#6D9AD9', '개인위생':'#D77FA7', '고미쩌미':'#B7A04C',
  '청소':'#53AEB6'
};
const extraColors=['#B778D2','#D17B67','#678EBD','#8B9C51','#B57583','#6EACA5','#BD944D'];
const colorForActivity = name => {
  if (namedColors[name]) return namedColors[name];
  // Deterministic hashing keeps a custom activity the same color on all devices.
  let hash=0;
  for (const char of name) hash=(Math.imul(hash,31)+char.codePointAt(0))|0;
  return extraColors[(hash>>>0)%extraColors.length];
};
export function TimeLog({data,onDataChange}){
  const [section,setSection]=useState('record');
  const [dailyDate,setDailyDate]=useState(dateKey(new Date()));
  const [now,setNow]=useState(Date.now());
  const [newActivity,setNewActivity]=useState('');
  const [month,setMonth]=useState(dateKey(new Date()).slice(0,7));
  const [selected,setSelected]=useState(dateKey(new Date()));
  const [period,setPeriod]=useState('7');
  const record=data.timeLog||{};
  const active=record.active||null;
  const logs=Array.isArray(record.entries)?record.entries:[];
  const activities=[...new Set([...initialActivities,...(record.activities||[])])];
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(id)},[]);
  const save=fn=>onDataChange(d=>({...d,timeLog:fn(d.timeLog||{})}));
  const completedEntry = (current, end) => current ? {
    // Stable ID prevents duplicate entries when two devices end the same run.
    id: `log-${current.id || `${current.activity}-${current.start}`}`,
    activity:current.activity,start:current.start,end
  } : null;
  const begin=name=>{
    const time=new Date().toISOString();
    const actionId=crypto.randomUUID();
    save(prev=>{
      const finished=completedEntry(prev.active,time);
      return {...prev,
        entries:[...(prev.entries||[]),...(finished?[finished]:[])],
        active:{id:actionId,activity:name,start:time,updatedAt:time},
        lastAction:{id:actionId,at:time,type:'start',activity:name}
      };
    });
  };
  const stop=()=>{
    const time=new Date().toISOString();
    const actionId=crypto.randomUUID();
    save(prev=>{
      if (!prev.active) return prev;
      const finished=completedEntry(prev.active,time);
      return {...prev,entries:[...(prev.entries||[]),finished],active:null,
        lastAction:{id:actionId,at:time,type:'stop'}};
    });
  };
  const activeMs=active?Math.max(0,now-Date.parse(active.start)):0;
  const computed=active?[...logs,{id:'currently-running',activity:active.activity,start:active.start,end:new Date(now).toISOString()}]:logs;
  const colors=Object.fromEntries(activities.map(a=>[a,colorForActivity(a)]));
  const today=dateKey(new Date());
  const todayTotal=aggregate(computed,today,today).total;
  const weekDate=startOfWeek(new Date());const weekStart=dateKey(weekDate);const sunday=new Date(weekDate);sunday.setDate(sunday.getDate()+6);const weekTotal=aggregate(computed,weekStart,dateKey(sunday)).total;
  const monthStart=new Date(`${month}-01T00:00:00`);const count=new Date(monthStart.getFullYear(),monthStart.getMonth()+1,0).getDate();
  const offset=monthStart.getDay();
  const dayInfo=aggregate(computed,`${month}-01`,`${month}-${pad(count)}`).by;
  const selInfo=dayInfo[selected]||aggregate(computed,selected,selected).by[selected]||{};
  const selectedTotal=Object.values(selInfo).reduce((a,b)=>a+b,0);
  const start=new Date();start.setDate(start.getDate()-(Number(period)-1));start.setHours(0,0,0,0);
  const from=dateKey(start);const periodData=aggregate(computed,from,today);
  const totals={};for(const day of Object.values(periodData.by)){for(const [name,ms] of Object.entries(day)){totals[name]=(totals[name]||0)+ms;}}
  const statsDays=Array.from({length:Number(period)},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);const k=dateKey(d);return {date:k,total:Object.values(periodData.by[k]||{}).reduce((a,b)=>a+b,0)}});
  const maxDay=Math.max(1,...statsDays.map(x=>x.total));
  const moveMonth=delta=>{const d=new Date(month+'-01T00:00:00');d.setMonth(d.getMonth()+delta);setMonth(dateKey(d).slice(0,7));setSelected(dateKey(d));};
  return <section className="timelog-page">
    <h1>타임로그</h1>
    <div className="timelog-tabs" role="tablist" aria-label="타임로그 메뉴">{[['record','기록'],['daily','데일리'],['stats','통계'],['calendar','캘린더']].map(([id,label])=><button key={id} type="button" role="tab" aria-selected={section===id} className={section===id?'chosen':''} onClick={()=>setSection(id)}>{label}</button>)}</div>
    {section==='record'&&<>
      <div className="timelog-counter"><div className="timelog-counter-label">{active?`${active.activity} · 기록 중`:'기록 대기'}</div><div className="timelog-clock">{elapsed(activeMs)}</div>{active?<button type="button" className="timelog-primary" onClick={stop}>종료 및 저장</button>:<p>활동을 선택하면 측정이 시작돼.</p>}</div>
      <div className="timelog-kpis"><div><small>오늘</small><strong>{minutesText(todayTotal)}</strong></div><div><small>이번 주 (월–일)</small><strong>{minutesText(weekTotal)}</strong></div></div>
      <h2>활동 목록</h2><div className="timelog-activities">{activities.map(name=><div className="timelog-activity" key={name}><span><i style={{background:colors[name]}}/>{name}</span><button type="button" className={active?.activity===name?'recording':''} disabled={active?.activity===name} onClick={()=>begin(name)}>{active?.activity===name?'기록 중':active?'전환':'시작'}</button></div>)}</div>
      <form className="timelog-add" onSubmit={e=>{e.preventDefault();const name=newActivity.trim().slice(0,40);if(!name||activities.includes(name))return;save(prev=>({...prev,activities:[...(prev.activities||[]),name]}));setNewActivity('')}}><input aria-label="새 활동 이름" placeholder="새 활동 추가" value={newActivity} onChange={e=>setNewActivity(e.target.value)}/><button type="submit" disabled={!newActivity.trim()}><Plus size={17}/> 추가</button></form>
    </>}
    {section==='daily'&&<DailyTimeLine selected={dailyDate} onSelect={setDailyDate} entries={computed} colors={colors} now={now}/>}
    {section==='stats'&&<>
      <div className="timelog-range">{[['1','1일'],['7','7일'],['30','30일'],['90','90일']].map(([v,label])=><button type="button" key={v} className={period===v?'chosen':''} onClick={()=>setPeriod(v)}>{label}</button>)}</div>
      <div className="timelog-kpis"><div><small>총 기록 시간</small><strong>{minutesText(periodData.total)}</strong></div><div><small>하루 평균</small><strong>{minutesText(periodData.total/Number(period))}</strong></div></div>
      <h2>활동별 누적 시간</h2>{Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([name,ms])=><div className="timelog-stat" key={name}><div><span><i style={{background:colors[name]||'#A68CCF'}}/>{name}</span><strong>{minutesText(ms)} · {periodData.total?Math.round(ms/periodData.total*100):0}%</strong></div><div className="timelog-track"><div style={{width:`${periodData.total?ms/periodData.total*100:0}%`,background:colors[name]||'#A68CCF'}}/></div></div>)}{!periodData.total&&<p className="timelog-empty">아직 기록이 없어.</p>}
      <h2>일별 기록</h2><div className="timelog-bars">{statsDays.map(d=><div key={d.date} title={`${d.date} · ${minutesText(d.total)}`}><div className="timelog-bar" style={{height:`${Math.max(d.total?3:0,d.total/maxDay*100)}%`}}/><small>{Number(d.date.slice(-2))}</small></div>)}</div>
    </>}
    {section==='calendar'&&<>
      <div className="timelog-month"><button type="button" aria-label="이전 달" onClick={()=>moveMonth(-1)}><ChevronLeft/></button><strong>{month.replace('-','년 ')}월</strong><button type="button" aria-label="다음 달" onClick={()=>moveMonth(1)}><ChevronRight/></button></div>
      <div className="timelog-calendar">{['일','월','화','수','목','금','토'].map(d=><span className="timelog-weekday" key={d}>{d}</span>)}{Array.from({length:offset},(_,i)=><span key={`blank${i}`}/>)}{Array.from({length:count},(_,i)=>{const date=`${month}-${pad(i+1)}`;const day=dayInfo[date]||{};return <button type="button" key={date} className={selected===date?'selected':''} onClick={()=>setSelected(date)}><span>{i+1}</span><span className="timelog-dots">{Object.keys(day).slice(0,3).map(a=><i key={a} style={{background:colors[a]||'#A68CCF'}}/>)}</span></button>})}</div>
      <div className="timelog-selected"><strong>{selected} 기록</strong><span>총 {minutesText(selectedTotal)}</span></div>{Object.entries(selInfo).sort((a,b)=>b[1]-a[1]).map(([name,ms])=><div className="timelog-summary" key={name}><span><i style={{background:colors[name]||'#A68CCF'}}/>{name}</span><strong>{minutesText(ms)}</strong></div>)}{selectedTotal===0&&<p className="timelog-empty">이 날짜에는 기록이 없어.</p>}
      <h2>상세 기록</h2>{computed.filter(x=>dailySegments(Date.parse(x.start),Date.parse(x.end)).some(v=>v.date===selected)).map(x=>{const startMs=Date.parse(x.start),endMs=Date.parse(x.end);const dayStart=new Date(selected+'T00:00:00').getTime();const part=Math.max(0,Math.min(endMs,dayStart+86400000)-Math.max(startMs,dayStart));return <div className="timelog-entry" key={x.id}><span>{x.activity}<small>{new Date(x.start).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}–{x.id==='currently-running'?'진행 중':new Date(x.end).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</small></span><strong>{minutesText(part)}</strong></div>})}
    </>}
  </section>;
}


// Visual day runs from 06:00 until 06:00 the following morning.
// A session's exact start/end timestamps determine its position and height.
function DailyTimeLine({selected,onSelect,entries,colors,now}){
  const [period,setPeriod]=useState('morning');
  const periods=[{id:'morning',label:'오전',start:6,hours:6},{id:'afternoon',label:'오후',start:12,hours:6},{id:'evening',label:'저녁',start:18,hours:12}];
  const currentPeriod=periods.find(p=>p.id===period)||periods[0];
  const selectedDate=new Date(`${selected}T12:00:00`);
  const weekStart=startOfWeek(selectedDate);
  const weekDays=Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d;});
  const dayStart=new Date(`${selected}T06:00:00`).getTime();
  const dayEnd=new Date(dayStart);dayEnd.setDate(dayEnd.getDate()+1);
  const end=dayEnd.getTime();
  const hourHeight=140;
  const periodStart=new Date(`${selected}T06:00:00`);periodStart.setHours(currentPeriod.start,0,0,0);
  const periodStartMs=periodStart.getTime();
  const periodEndMs=periodStartMs+currentPeriod.hours*3600000;
  const segments=entries.flatMap(entry=>{
    const start=Date.parse(entry.start);
    const finish=entry.id==='currently-running'?now:Date.parse(entry.end);
    if(!Number.isFinite(start)||!Number.isFinite(finish)||finish<=start)return [];
    const from=Math.max(dayStart,start),to=Math.min(end,finish);
    if(to<=from)return [];
    return [{...entry,from,to,live:entry.id==='currently-running'}];
  }).sort((a,b)=>a.from-b.from);
  const visibleSegments=segments.map(s=>({...s,from:Math.max(s.from,periodStartMs),to:Math.min(s.to,periodEndMs)})).filter(s=>s.to>s.from);
  const total=visibleSegments.reduce((n,s)=>n+(s.to-s.from),0);
  const formatTime=t=>new Date(t).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
  const shiftWeek=delta=>{const d=new Date(`${selected}T12:00:00`);d.setDate(d.getDate()+delta*7);onSelect(dateKey(d));};
  return <div className="timelog-daily">
    <div className="timelog-daily-week-nav"><button type="button" onClick={()=>shiftWeek(-1)} aria-label="이전 주"><ChevronLeft size={19}/></button><strong>{weekStart.getFullYear()}년 {weekStart.getMonth()+1}월</strong><button type="button" onClick={()=>shiftWeek(1)} aria-label="다음 주"><ChevronRight size={19}/></button></div>
    <div className="timelog-daily-week">{weekDays.map((day,i)=><button type="button" key={dateKey(day)} onClick={()=>onSelect(dateKey(day))} className={selected===dateKey(day)?'selected':''}><small>{['월','화','수','목','금','토','일'][i]}</small><span>{day.getDate()}</span></button>)}</div>
    <div className="timelog-daily-selected">{selectedDate.toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'})}</div>
    <div className="timelog-daily-periods" role="tablist" aria-label="데일리 시간대">{periods.map(p=><button type="button" key={p.id} role="tab" aria-selected={period===p.id} className={period===p.id?'selected':''} onClick={()=>setPeriod(p.id)}>{p.label}</button>)}</div>
    <div className="timelog-daily-total">총 기록 {minutesText(total)} <span>{currentPeriod.id==='morning'?'06:00–12:00':currentPeriod.id==='afternoon'?'12:00–18:00':'18:00–다음 날 06:00'}</span></div>
    <div className="timelog-daily-grid" style={{height:currentPeriod.hours*hourHeight}}>
      {Array.from({length:currentPeriod.hours},(_,i)=>{const hour=(currentPeriod.start+i)%24;return <div className="timelog-daily-hour" key={i} style={{top:i*hourHeight,height:hourHeight}}><span>{pad(hour)}:00</span></div>})}
      <div className="timelog-daily-track">
        {visibleSegments.map((segment,i)=>{
          const top=(segment.from-periodStartMs)/3600000*hourHeight;
          const height=(segment.to-segment.from)/3600000*hourHeight;
          const color=colors[segment.activity]||'#A68CCF';
          return <div key={`${segment.id}-${i}`} className="timelog-daily-block" title={`${segment.activity}: ${formatTime(segment.from)}–${formatTime(segment.to)}`} style={{top,height,minHeight:0,borderLeftColor:color,backgroundColor:`color-mix(in srgb, ${color} 22%, white)`}}>
            {height>=18&&<div className="timelog-daily-block-content"><div className="timelog-daily-block-heading"><strong>{segment.activity}</strong><span>{formatTime(segment.from)}–{segment.live?'진행 중':formatTime(segment.to)}</span></div>{height>=60&&<small>{minutesText(segment.to-segment.from)}</small>}</div>}
          </div>;
        })}
      </div>
    </div>
    {visibleSegments.length===0&&<p className="timelog-empty">선택한 시간대에 기록된 활동이 없어.</p>}
  </div>;
}
