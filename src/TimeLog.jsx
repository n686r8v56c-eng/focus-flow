import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock3, Pencil, Trash2, Check, X } from 'lucide-react';
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
export function TimeLog({data,onDataChange,client,userId}){
  const [section,setSection]=useState('record');
  const [selectedActivity,setSelectedActivity]=useState('');
  const [goalEditing,setGoalEditing]=useState(false);
  const [goalDraft,setGoalDraft]=useState({});
  const [chartActivity,setChartActivity]=useState('');
  const [dailyDate,setDailyDate]=useState(dateKey(new Date()));
  const [now,setNow]=useState(Date.now());
  const [newActivity,setNewActivity]=useState('');
  const [editingActivity,setEditingActivity]=useState(null);
  const [activityDraft,setActivityDraft]=useState('');
  const [editingEntry,setEditingEntry]=useState(null);
  const [entryDraft,setEntryDraft]=useState({activity:'',start:'',end:''});
  const [entryError,setEntryError]=useState('');
  const [month,setMonth]=useState(dateKey(new Date()).slice(0,7));
  const [selected,setSelected]=useState(dateKey(new Date()));
  const [period,setPeriod]=useState('7');
  const record=data.timeLog||{};
  const [server,setServer]=useState({active:null,entries:[],ready:false});
  const [syncError,setSyncError]=useState('');
  const [busy,setBusy]=useState(false);
  const [pollNonce,setPollNonce]=useState(0);
  const bootstrapped=React.useRef(false);
  const commandVersion=React.useRef(0);
  const active=server.active;
  const logs=server.entries;
  useEffect(()=>{
    if(!client||!userId)return;
    let live=true;
    const refresh=async()=>{
      const rev=commandVersion.current;
      try{
        const isBoot=!bootstrapped.current;
        const {data:result,error}=await client.rpc('focus_timelog_action',isBoot?{p_action:'bootstrap',p_legacy:record.entries||[],p_legacy_active:record.active||null}:{p_action:'read'});
        if(!error)bootstrapped.current=true;
        if(error)throw error;
        if(live&&rev===commandVersion.current){setServer({...result,ready:true});setSyncError('');}
      }catch(error){if(live)setSyncError('서버 동기화 확인이 필요해. SQL 설치와 연결 상태를 확인해 줘.');}
    };
    refresh();
    const interval=setInterval(refresh,5000);
    const handleVisibility=()=>{if(document.visibilityState==='visible')refresh();};
    document.addEventListener('visibilitychange',handleVisibility);
    const channel=client.channel(`timelog-${userId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'focus_timelog_active',filter:`user_id=eq.${userId}`},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'focus_timelog_entries',filter:`user_id=eq.${userId}`},refresh)
      .subscribe();
    return ()=>{live=false;clearInterval(interval);document.removeEventListener('visibilitychange',handleVisibility);client.removeChannel(channel);};
  },[client,userId,pollNonce]);
  const command=async(action,activity)=>{
    if(busy)return;
    commandVersion.current+=1;setBusy(true);setSyncError('');
    try{
      const {data:result,error}=await client.rpc('focus_timelog_action',{p_action:action,p_activity:activity||null});
      if(error)throw error;
      setServer({...result,ready:true});
    }catch(e){setSyncError('명령이 저장되지 않았어. 다시 시도해 줘.');}
    finally{setBusy(false);}
  };
  // New editable catalog; fall back to older installations' built-in/custom activities.
  // Historical time entries remain intact even if an activity is renamed or removed.
  const activities=Array.isArray(record.activityList)
    ? record.activityList
    : [...new Set([...initialActivities,...(record.activities||[])])];
  const startEditActivity=name=>{setEditingActivity(name);setActivityDraft(name);};
  const applyActivityEdit=()=>{
    const next=activityDraft.trim().slice(0,40);
    if(!next || (next!==editingActivity && activities.includes(next)))return;
    if(active?.activity===editingActivity){window.alert('기록 중인 활동은 먼저 종료한 뒤 수정해 줘.');return;}
    save(prev=>({...prev,activityList:activities.map(a=>a===editingActivity?next:a),dailyGoals:Object.fromEntries(Object.entries(prev.dailyGoals||{}).map(([key,value])=>[key===editingActivity?next:key,value]))}));
    if(selectedActivity===editingActivity)setSelectedActivity(next);
    if(chartActivity===editingActivity)setChartActivity(next);
    setEditingActivity(null);setActivityDraft('');
  };
  const deleteActivity=name=>{
    if(active?.activity===name){window.alert('기록 중인 활동은 먼저 종료한 뒤 삭제해 줘.');return;}
    if(!window.confirm(`"${name}" 활동을 목록에서 삭제할까?\\n기존 타임로그 기록과 통계는 삭제되지 않아.`))return;
    save(prev=>({...prev,activityList:activities.filter(a=>a!==name)}));
    if(editingActivity===name){setEditingActivity(null);setActivityDraft('');}
  };
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(id)},[]);
  const save=fn=>onDataChange(d=>({...d,timeLog:fn(d.timeLog||{})}));
  const toLocalInput=iso=>{
    const d=new Date(iso);
    if(Number.isNaN(d.getTime()))return '';
    return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const editEntry=entry=>{
    if(entry.id==='currently-running')return;
    setEditingEntry(entry);
    setEntryDraft({activity:entry.activity,start:toLocalInput(entry.start),end:toLocalInput(entry.end)});
    setEntryError('');
  };
  const saveEntry=async()=>{
    if(busy||!editingEntry)return;
    const start=new Date(entryDraft.start),end=new Date(entryDraft.end);
    if(!entryDraft.activity.trim()){setEntryError('활동을 선택해 줘.');return;}
    if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start){setEntryError('종료 시간이 시작 시간보다 늦어야 해.');return;}
    if(end.getTime()>Date.now()+86400000){setEntryError('미래 날짜는 저장할 수 없어.');return;}
    commandVersion.current+=1;
    setBusy(true);setEntryError('');
    try{
      const {data:result,error}=await client.rpc('focus_timelog_edit_entry',{
        p_entry_id:editingEntry.id,p_activity:entryDraft.activity.trim(),
        p_started_at:start.toISOString(),p_ended_at:end.toISOString(),
        p_expected_started_at:editingEntry.start,p_expected_ended_at:editingEntry.end
      });
      if(error)throw error;
      setServer({...result,ready:true});setEditingEntry(null);setSyncError('');
    }catch(e){setEntryError(e?.message||'수정 내용을 서버에 저장하지 못했어.');}
    finally{setBusy(false);}
  };
  const begin=name=>command('start',name);
  const stop=()=>command('stop');
  const activeMs=active?Math.max(0,now-Date.parse(active.start)):0;
  const computed=active?[...logs,{id:'currently-running',activity:active.activity,start:active.start,end:new Date(now).toISOString()}]:logs;
  const colors=Object.fromEntries(activities.map(a=>[a,colorForActivity(a)]));
  const today=dateKey(new Date());
  const dailyGoals=record.dailyGoals||{};
  const dailyTarget=activities.reduce((sum,name)=>sum+Math.max(0,Number(dailyGoals[name])||0),0)*60000;
  const todaysByActivity=aggregate(computed,today,today).by[today]||{};
  const goalDifference=aggregate(computed,today,today).total-dailyTarget;
  const selectedTimerActivity=activities.includes(selectedActivity)?selectedActivity:(active?.activity||activities[0]||'');
  const currentChartActivity=activities.includes(chartActivity)?chartActivity:(activities[0]||'');
  const formatDelta=ms=>(ms>=0?'+':'−')+minutesText(Math.abs(ms));
  const openGoals=()=>{setGoalDraft(Object.fromEntries(activities.map(name=>[name,Math.max(0,Math.round(Number(dailyGoals[name])||0))])));setGoalEditing(true);};
  const saveGoals=()=>{save(prev=>({...prev,dailyGoals:Object.fromEntries(activities.map(name=>[name,Math.max(0,Math.min(1440,Math.round(Number(goalDraft[name])||0)))]))}));setGoalEditing(false);};
  const updateGoalPart=(name,part,value)=>{
    const n=Math.max(0,Math.floor(Number(value)||0));
    setGoalDraft(old=>{const prev=Math.max(0,Math.round(Number(old[name])||0));return {...old,[name]:part==='hours'?Math.min(24,n)*60+(Math.min(prev%60,59)):Math.floor(prev/60)*60+Math.min(59,n)};});
  };
  const todayTotal=aggregate(computed,today,today).total;
  const weekDate=startOfWeek(new Date());const weekStart=dateKey(weekDate);const sunday=new Date(weekDate);sunday.setDate(sunday.getDate()+6);const weekTotal=aggregate(computed,weekStart,dateKey(sunday)).total;
  const monthStart=new Date(`${month}-01T00:00:00`);const count=new Date(monthStart.getFullYear(),monthStart.getMonth()+1,0).getDate();
  const offset=monthStart.getDay();
  const dayInfo=aggregate(computed,`${month}-01`,`${month}-${pad(count)}`).by;
  const selInfo=dayInfo[selected]||aggregate(computed,selected,selected).by[selected]||{};
  const selectedTotal=Object.values(selInfo).reduce((a,b)=>a+b,0);
  const firstLogMs=computed.reduce((earliest,entry)=>{const d=Date.parse(entry.start);return Number.isFinite(d)?Math.min(earliest,d):earliest;},Date.now());
  const periodDays=period==='all'?Math.max(1,Math.round((new Date(today+'T12:00:00').getTime()-new Date(dateKey(new Date(firstLogMs))+'T12:00:00').getTime())/86400000)+1):Number(period);
  const start=new Date();start.setDate(start.getDate()-(periodDays-1));start.setHours(0,0,0,0);
  const from=dateKey(start);const periodData=aggregate(computed,from,today);
  const totals={};for(const day of Object.values(periodData.by)){for(const [name,ms] of Object.entries(day)){totals[name]=(totals[name]||0)+ms;}}
  const statsDays=Array.from({length:periodDays},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);const k=dateKey(d);return {date:k,total:Object.values(periodData.by[k]||{}).reduce((a,b)=>a+b,0)}});

  const activityTotals={...totals};
  const statsAllActivities=[...new Set([...activities,...Object.keys(activityTotals)])];
  const chartGroupKey=date=>period==='90'?(()=>{const d=new Date(date+'T12:00:00');const week=startOfWeek(d);return dateKey(week);})():period==='all'?date.slice(0,7):date;
  const chartGroupLabel=key=>period==='all'?key.slice(2):period==='90'?key.slice(5):key.slice(5);
  const chartGroups=[];
  for(const day of statsDays){let group=chartGroups.at(-1);const key=chartGroupKey(day.date);if(!group||group.key!==key){group={key,date:day.date,days:0,actual:0,target:0};chartGroups.push(group);}group.days++;group.actual+=periodData.by[day.date]?.[currentChartActivity]||0;group.target+=Math.max(0,Number(dailyGoals[currentChartActivity])||0)*60000;}
  const chartMax=Math.max(1,...chartGroups.flatMap(item=>[item.actual,item.target]));
  const totalGoalForPeriod=periodDays*dailyTarget;
  const overallAttainment=totalGoalForPeriod>0?Math.round(periodData.total/totalGoalForPeriod*100):null;
  const maxDay=Math.max(1,...statsDays.map(x=>x.total));

  const moveMonth=delta=>{const d=new Date(month+'-01T00:00:00');d.setMonth(d.getMonth()+delta);setMonth(dateKey(d).slice(0,7));setSelected(dateKey(d));};
  return <section className="timelog-page">
    {syncError&&<div role="alert" className="auth-error">{syncError} <button type="button" onClick={()=>setPollNonce(n=>n+1)}>재시도</button></div>}
    
    {!server.ready&&<p className="timelog-empty">타임로그 서버 기록 불러오는 중…</p>}
    <div className="timelog-heading"><h1>타임로그</h1><span>{new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric'})}</span></div>
    <div className="timelog-tabs" role="tablist" aria-label="타임로그 메뉴">{[['record','기록'],['stats','통계']].map(([id,label])=><button key={id} type="button" role="tab" aria-selected={section===id} className={section===id?'chosen':''} onClick={()=>setSection(id)}>{label}</button>)}</div>
    {section==='record'&&<>
      <div className="timelog-counter">
        <div className="timelog-counter-head"><span>현재 활동</span><span>{active?'기록 중':'기록 대기'}</span></div>
        <select className="timelog-activity-picker" aria-label="측정할 활동" value={selectedTimerActivity} disabled={!activities.length||busy||!server.ready} onChange={e=>setSelectedActivity(e.target.value)}>{activities.map(name=><option key={name} value={name}>{name}</option>)}</select>
        <div className="timelog-clock">{elapsed(activeMs)}</div>
        <button type="button" className="timelog-primary" disabled={busy||!server.ready||(!active&&!selectedTimerActivity)} onClick={()=>active?stop():begin(selectedTimerActivity)}>{active?'종료 및 저장':'▶ 시작'}</button>
        {active&&selectedTimerActivity!==active.activity&&<button type="button" className="timelog-switch" disabled={busy} onClick={()=>begin(selectedTimerActivity)}>활동 전환 · {selectedTimerActivity}</button>}
      </div>
      <div className="timelog-kpis timelog-three-kpis">
        <div><small>오늘 실제</small><strong>{minutesText(todayTotal)}</strong></div>
        <div><small>오늘 목표</small><strong>{dailyTarget?minutesText(dailyTarget):'미설정'}</strong></div>
        <div><small>목표 차이</small><strong>{dailyTarget?formatDelta(goalDifference):'—'}</strong></div>
      </div>
      <div className="timelog-section-head"><h2>오늘의 활동</h2><button type="button" onClick={openGoals}>목표 설정</button></div>
      <div className="timelog-activity-progress">{activities.map(name=>{
        const actual=todaysByActivity[name]||0,goal=Math.max(0,Number(dailyGoals[name])||0)*60000;
        return <div className="timelog-goal-row" key={name}>
          <div className="timelog-goal-head"><strong>{name}</strong><span>{goal?`${Math.round(actual/goal*100)}%`:'목표 없음'}</span></div>
          <div className="timelog-track"><div style={{width:`${goal?Math.min(100,actual/goal*100):0}%`}}/></div>
          <div className="timelog-goal-foot"><span>{minutesText(actual)} / {goal?minutesText(goal):'목표 미설정'}</span><span>{goal?formatDelta(actual-goal):''}</span></div>
        </div>;
      })}</div>
      <details className="timelog-manage-activities"><summary>활동 관리 · 추가·수정·삭제</summary>
        <div className="timelog-activities">{activities.map(name=><div className="timelog-activity" key={name} style={{gap:7,minWidth:0}}>
          {editingActivity===name
            ?<form onSubmit={e=>{e.preventDefault();applyActivityEdit();}} style={{display:'flex',alignItems:'center',gap:5,flex:1,minWidth:0}}>
              <input autoFocus maxLength={40} aria-label="활동 이름 수정" value={activityDraft} onChange={e=>setActivityDraft(e.target.value)} style={{flex:1,minWidth:0,fontSize:16,padding:9}}/>
              <button aria-label="저장" type="submit"><Check size={16}/></button>
              <button aria-label="취소" type="button" onClick={()=>setEditingActivity(null)}><X size={16}/></button>
            </form>
            :<><span style={{flex:1,minWidth:0,overflowWrap:'anywhere'}}><i style={{background:colors[name]}}/>{name}</span>
              <button type="button" aria-label={name+' 수정'} onClick={()=>startEditActivity(name)}><Pencil size={15}/></button>
              <button type="button" aria-label={name+' 삭제'} onClick={()=>deleteActivity(name)}><Trash2 size={15}/></button></>}
        </div>)}</div>
        <form className="timelog-add" onSubmit={e=>{e.preventDefault();const name=newActivity.trim().slice(0,40);if(!name||activities.includes(name))return;save(prev=>({...prev,activityList:[...activities,name]}));setSelectedActivity(name);setNewActivity('');}}>
          <input aria-label="새 활동 이름" placeholder="새 활동 추가" value={newActivity} onChange={e=>setNewActivity(e.target.value)}/><button type="submit" disabled={!newActivity.trim()}><Plus size={16}/> 추가</button>
        </form>
      </details>
      <div className="timelog-section-head"><h2>오늘의 기록</h2><small>{computed.filter(x=>dailySegments(Date.parse(x.start),Date.parse(x.end)).some(v=>v.date===today)).length}개</small></div>
      {computed.filter(x=>dailySegments(Date.parse(x.start),Date.parse(x.end)).some(v=>v.date===today)).slice().sort((a,b)=>Date.parse(b.start)-Date.parse(a.start)).map(x=><div className="timelog-entry" key={x.id}>
        <span>{x.activity}<small>{new Date(x.start).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}–{x.id==='currently-running'?'진행 중':new Date(x.end).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</small></span>
        <strong>{minutesText(Math.max(0,Math.min(Date.parse(x.end),new Date(today+'T23:59:59').getTime())-Math.max(Date.parse(x.start),new Date(today+'T00:00:00').getTime())))}</strong>
        {x.id!=='currently-running'&&<button type="button" aria-label="기록 수정" onClick={()=>editEntry(x)}><Pencil size={16}/></button>}
      </div>)}
      {!computed.some(x=>dailySegments(Date.parse(x.start),Date.parse(x.end)).some(v=>v.date===today))&&<p className="timelog-empty">오늘의 기록이 아직 없어.</p>}
    </>}
    {section==='stats'&&<>
      <div className="timelog-range">{[['7','7일'],['30','30일'],['90','90일'],['all','전체']].map(([id,label])=><button type="button" key={id} className={period===id?'chosen':''} onClick={()=>setPeriod(id)}>{label}</button>)}</div>
      <div className="timelog-section-head"><h2>활동별 목표 달성</h2><button type="button" onClick={openGoals}>목표 설정</button></div>
      <div className="timelog-kpis timelog-three-kpis">
        <div><small>실제 기록</small><strong>{minutesText(periodData.total)}</strong></div>
        <div><small>기간 목표</small><strong>{totalGoalForPeriod?minutesText(totalGoalForPeriod):'미설정'}</strong></div>
        <div><small>목표 대비</small><strong>{overallAttainment===null?'—':overallAttainment+'%'}</strong></div>
      </div>
      <div className="timelog-activity-progress">{statsAllActivities.map(name=>{
        const actual=activityTotals[name]||0,goal=periodDays*Math.max(0,Number(dailyGoals[name])||0)*60000;
        return <div className="timelog-goal-row" key={name}>
          <div className="timelog-goal-head"><strong>{name}</strong><span>{goal?Math.round(actual/goal*100)+'%':'목표 없음'}</span></div>
          <div className="timelog-track"><div style={{width:`${goal?Math.min(100,actual/goal*100):0}%`}}/></div>
          <div className="timelog-goal-foot"><span>{minutesText(actual)} / {goal?minutesText(goal):'목표 미설정'}</span><span>{goal?formatDelta(actual-goal):''}</span></div>
        </div>;
      })}</div>
      <div className="timelog-section-head"><h2>기간별 시간 비교</h2></div>
      <select className="timelog-activity-picker timelog-stat-picker" aria-label="그래프로 볼 활동" value={currentChartActivity} onChange={e=>setChartActivity(e.target.value)}>{statsAllActivities.map(name=><option key={name} value={name}>{name}</option>)}</select>
      <div className="timelog-chart-scroll" role="region" aria-label="목표와 실제 시간의 기간별 막대그래프" tabIndex={0}>
        <div className="timelog-chart" style={{minWidth:Math.max(280,chartGroups.length*34)+'px'}}>
          {chartGroups.map(group=><div className="timelog-chart-column" key={group.key} title={`${group.date} · 목표 ${minutesText(group.target)} · 실제 ${minutesText(group.actual)}`}>
            <div className="timelog-chart-bars"><div className="timelog-chart-target" style={{height:`${group.target/chartMax*100}%`}}/><div className="timelog-chart-actual" style={{height:`${group.actual/chartMax*100}%`}}/></div>
            <small>{chartGroupLabel(group.key)}</small>
          </div>)}
        </div>
      </div>
      <div className="timelog-chart-legend"><span><i/>목표</span><span><i/>실제</span></div>
      <p className="timelog-hint">7·30일은 일별, 90일은 주별, 전체는 월별로 표시해. 변경한 목표는 현재 목표를 과거 기간에도 적용해서 비교해.</p>
    </>}
    {goalEditing&&<div className="timelog-goal-overlay" role="presentation" onClick={()=>setGoalEditing(false)}>
      <form className="timelog-goal-dialog" role="dialog" aria-modal="true" aria-label="활동별 일일 목표 설정" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();saveGoals();}}>
        <div className="timelog-goal-title"><h2>활동별 하루 목표</h2><button type="button" aria-label="닫기" onClick={()=>setGoalEditing(false)}><X size={18}/></button></div>
        <p>목표가 없으면 0시간 0분으로 설정해 줘.</p>
        {activities.map(name=><div className="timelog-goal-field" key={name}>
          <label>{name}</label><div>
            <input type="number" min="0" max="24" inputMode="numeric" aria-label={name+' 목표 시간'} value={Math.floor((Number(goalDraft[name])||0)/60)} onChange={e=>updateGoalPart(name,'hours',e.target.value)}/><span>시간</span>
            <input type="number" min="0" max="59" inputMode="numeric" aria-label={name+' 목표 분'} value={(Number(goalDraft[name])||0)%60} onChange={e=>updateGoalPart(name,'minutes',e.target.value)}/><span>분</span>
          </div>
        </div>)}
        <div className="timelog-goal-total">일일 목표 합계 <strong>{minutesText(activities.reduce((sum,name)=>sum+(Number(goalDraft[name])||0),0)*60000)}</strong></div>
        <button className="timelog-primary" type="submit">저장</button>
      </form>
    </div>}
    {editingEntry&&<div role="presentation" onClick={()=>!busy&&setEditingEntry(null)} style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(40,33,52,.42)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <form role="dialog" aria-modal="true" aria-label="타임로그 기록 수정" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();saveEntry();}} style={{width:'100%',maxWidth:420,minWidth:0,boxSizing:'border-box',maxHeight:'calc(100dvh - 40px)',overflowY:'auto',background:'#fff',borderRadius:20,padding:20,display:'grid',gap:14,boxShadow:'0 16px 45px rgba(30,20,48,.16)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{margin:0,fontSize:20}}>기록 수정</h2><button type="button" aria-label="닫기" onClick={()=>setEditingEntry(null)} disabled={busy} style={{padding:6}}><X size={19}/></button></div>
        <label style={{display:'grid',gap:5,fontSize:13,fontWeight:650,color:'#81728f'}}>활동
          <select value={entryDraft.activity} onChange={e=>setEntryDraft(v=>({...v,activity:e.target.value}))} style={{width:'100%',minWidth:0,padding:11,border:'1px solid #ddd2e8',borderRadius:12,background:'#fff',fontSize:16}}>
            {[...new Set([...activities,editingEntry.activity])].map(a=><option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label style={{display:'grid',gap:5,fontSize:13,fontWeight:650,color:'#81728f'}}>시작 날짜·시간
          <input type="datetime-local" step="60" required value={entryDraft.start} onChange={e=>setEntryDraft(v=>({...v,start:e.target.value}))} style={{width:'100%',minWidth:0,boxSizing:'border-box',padding:11,border:'1px solid #ddd2e8',borderRadius:12,fontSize:16}}/>
        </label>
        <label style={{display:'grid',gap:5,fontSize:13,fontWeight:650,color:'#81728f'}}>종료 날짜·시간
          <input type="datetime-local" step="60" required value={entryDraft.end} onChange={e=>setEntryDraft(v=>({...v,end:e.target.value}))} style={{width:'100%',minWidth:0,boxSizing:'border-box',padding:11,border:'1px solid #ddd2e8',borderRadius:12,fontSize:16}}/>
        </label>
        {entryError&&<p role="alert" style={{color:'#b44f68',fontSize:13,margin:0,overflowWrap:'anywhere'}}>{entryError}</p>}
        <div style={{display:'flex',gap:8}}><button type="button" onClick={()=>setEditingEntry(null)} disabled={busy} style={{flex:1,padding:12,borderRadius:12}}>취소</button><button type="submit" disabled={busy} style={{flex:2,padding:12,borderRadius:12,background:'#a08acc',color:'#fff',fontWeight:700}}>{busy?'저장 중…':'수정 저장'}</button></div>
      </form>
    </div>}
  </section>;
}


// Visual day runs from 06:00 until 06:00 the following morning.
// A session's exact start/end timestamps determine its position and height.
function DailyTimeLine({selected,onSelect,entries,colors,now,onEditEntry}){
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
          return <div key={`${segment.id}-${i}`} className="timelog-daily-block" title={`${segment.activity}: ${formatTime(segment.from)}–${formatTime(segment.to)}${segment.live?'':' · 탭하여 수정'}`} onClick={()=>!segment.live&&onEditEntry(segment)} role={segment.live?undefined:'button'} tabIndex={segment.live?undefined:0} onKeyDown={e=>{if(!segment.live&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onEditEntry(segment);}}} style={{top,height,minHeight:0,borderLeftColor:color,backgroundColor:`color-mix(in srgb, ${color} 22%, white)`,cursor:segment.live?'default':'pointer'}}>
            {height>=18&&<div className="timelog-daily-block-content"><div className="timelog-daily-block-heading"><strong>{segment.activity}</strong><span>{formatTime(segment.from)}–{segment.live?'진행 중':formatTime(segment.to)}</span></div>{height>=60&&<small>{minutesText(segment.to-segment.from)}</small>}</div>}
          </div>;
        })}
      </div>
    </div>
    {visibleSegments.length===0&&<p className="timelog-empty">선택한 시간대에 기록된 활동이 없어.</p>}
  </div>;
}
