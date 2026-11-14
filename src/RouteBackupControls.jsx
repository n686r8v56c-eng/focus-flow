import React,{useEffect,useState,useRef} from 'react';
import {backupRoute,restoreRoute} from './route-backup.js';
export function RouteBackupControls({client,userId,visible}) {
  const [status,setStatus]=useState({status:'pending'}),[error,setError]=useState(''),[working,setWorking]=useState(false);
  const busy=useRef(false),retryAfter=useRef(0);
  const run=async(manual=false)=>{
    if(busy.current||!client||!userId||!manual&&Date.now()<retryAfter.current)return;
    busy.current=true;setWorking(true);
    try{setStatus(await backupRoute(client,userId));setError('');retryAfter.current=0;}
    catch(e){setError(e.message||String(e));setStatus({status:'failed'});retryAfter.current=Date.now()+15*60*1000;}
    finally{busy.current=false;setWorking(false)}
  };
  useEffect(()=>{
    let active=true;
    const check=()=>{if(active&&document.visibilityState==='visible')void run()};
    check();const interval=setInterval(check,60000);
    window.addEventListener('focus',check);window.addEventListener('online',check);document.addEventListener('visibilitychange',check);
    return()=>{active=false;clearInterval(interval);window.removeEventListener('focus',check);window.removeEventListener('online',check);document.removeEventListener('visibilitychange',check)};
  },[client,userId]);
  const restore=async()=>{
    if(busy.current||!window.confirm('빈 기기에 ROUTE 백업을 복구할까요? 기존 기록이 있으면 덮어쓰지 않고 중단합니다.'))return;
    busy.current=true;setWorking(true);
    try{await restoreRoute(client,userId);window.location.reload()}
    catch(e){setError(e.message||String(e));}
    finally{busy.current=false;setWorking(false)}
  };
  if(!visible)return null;
  const label=working?'백업 확인 중…':status.status==='saved'?'백업 검증 완료':status.status==='failed'?'백업 확인 필요':status.status==='waiting'?'다음 백업 대기':'ROUTE 백업';
  return <details className="route-backup-controls"><summary title={label} aria-label={label}>{working?'☁️…':status.status==='failed'?'☁️ !':'☁️'}</summary><div><strong>{label}</strong><br/><small>{status.at?'마지막 확인: '+new Date(status.at).toLocaleString('ko-KR'):'변경이 있을 때 하루 한 번 백업해요.'}</small><p>사진 원본은 이 기기에 유지돼요.</p>{error&&<p role="alert">{error}</p>}<button type="button" disabled={working} onClick={()=>run(true)}>백업 확인</button><button type="button" disabled={working} onClick={restore}>빈 기기에 복구</button></div></details>;
}
