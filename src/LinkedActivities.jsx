import React, { useEffect, useState, useRef } from "react";
import { Check, ChevronRight } from "lucide-react";
const SOURCES={study:{origin:"https://memory-lab.pages.dev",title:"오늘 할 공부",name:"MEMORY LAB"},mind:{origin:"https://mind-flow-4r3.pages.dev",title:"오늘 할 명상",name:"Mind Flow"}};
export function LinkedActivities({ client, userId, today, checks = {}, onCheck, source }) {
  const {origin:HOME,title,name}=SOURCES[source];
  const [link, setLink] = useState(null),
    [snapshot, setSnapshot] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [settings, setSettings] = useState(false),
    [code, setCode] = useState(""),
    [refreshVersion, setRefreshVersion] = useState(0);
  useEffect(() => {
    setLink(null);
    setSnapshot(null);
    setCode("");
    setError("");
    if (!client || !userId) return;
    let live = true,
      inFlight = false;
    const check = async () => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const result = await client
          .from("focus_activity_links")
          .select("id")
          .eq("source", source)
          .eq("focus_user_id", userId)
          .eq("active", true)
          .maybeSingle();
        if (result.error) throw result.error;
        if (!live) return;
        setLink(result.data);
        if (!result.data) {
          setSnapshot(null);
          setError("");
          return;
        }
        const state = await client
          .from("focus_activity_snapshots")
          .select("activities,received_at")
          .eq("link_id", result.data.id)
          .maybeSingle();
        if (state.error) throw state.error;
        if (live) {
          setSnapshot(state.data);
          setCode("");
          setError("");
        }
      } catch (e) {
        if (live)
          setError(
            "일정 연결을 확인해 주세요. 연결 기능 설치 후 새로고침하면 돼요.",
          );
      } finally {
        inFlight = false;
      }
    };
    check();
    const timer = setInterval(check, 12000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [client, userId, source, refreshVersion]);
  const generate = async () => {
    if (!client) return;
    setBusy(true);
    setError("");
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(16)),
        value = [...bytes].map((n) => n.toString(16).padStart(2, "0")).join("");
      const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(value),
        ),
        hash = [...new Uint8Array(digest)]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
      const result = await client.rpc("focus_activity_pair_create", {
        p_source: source,
        p_code_hash: hash,
      });
      if (result.error) throw result.error;
      setCode(value);
    } catch {
      setError(
        "연결 코드를 만들지 못했어요. Supabase 연결 기능 설치와 로그인 상태를 확인해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    if (
      !window.confirm(
        name+" 연결을 끊을까요? 기존 일정과 기록은 보존돼요.",
      )
    )
      return;
    setBusy(true);
    try {
      const r = await client.rpc("focus_activity_disconnect",{p_source:source});
      if (r.error) throw r.error;
      setLink(null);
      setSnapshot(null);
      setCode("");
      setRefreshVersion((v) => v + 1);
    } catch {
      setError("연결 해제에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };
  const activities = (
    Array.isArray(snapshot?.activities) ? snapshot.activities : []
  ).filter((w) => w.date === today);
  const checkKey = (w) => JSON.stringify([link?.id, w.date, w.videoId || w.id]);
  const [pinMenu, setPinMenu] = useState(null);
  const holdTimer=useRef(null);
  const holdStart=useRef(null);
  const startHold=(e,key)=>{if(e.pointerType==='mouse'&&e.button!==0)return; clearTimeout(holdTimer.current);holdStart.current={x:e.clientX,y:e.clientY};holdTimer.current=setTimeout(()=>{setPinMenu(key);holdTimer.current=null},500)};
  const moveHold=e=>{if(holdStart.current&&(Math.abs(e.clientX-holdStart.current.x)>12||Math.abs(e.clientY-holdStart.current.y)>12))clearTimeout(holdTimer.current)};
  const stopHold=()=>{clearTimeout(holdTimer.current);holdTimer.current=null;holdStart.current=null};
  useEffect(()=>()=>clearTimeout(holdTimer.current),[]);
  const pinRank=w=>Number.isFinite(checks[checkKey(w)]?.pinOrder)?checks[checkKey(w)].pinOrder:null;
  const togglePinned=w=>{const key=checkKey(w);const rank=pinRank(w);const next=rank===null?Math.max(0,...Object.values(checks).map(x=>Number.isFinite(x?.pinOrder)?x.pinOrder:0))+1:null;onCheck?.(key,isDone(w),next);setPinMenu(null)};

  const isDone = (w) => typeof checks[checkKey(w)]?.done === "boolean" ? checks[checkKey(w)].done : w.status === "done";
  const href = (w) => {
    try {
      const u = new URL(w.url);
      return u.origin === HOME ? u.href : HOME;
    } catch {
      return HOME;
    }
  };
  return (
    <section
      aria-label={title}
      style={{ marginTop: 30, paddingTop: 22, borderTop: "1px solid #e9e1f0" }}
    >
      <div className="section-top">
        <div>
          <a className="eyebrow" href={HOME} target="_blank" rel="noopener noreferrer" aria-label={`${name} 앱 열기`} title={`${name} 앱 열기`} style={{display:"inline-block",color:"#957bb6",textDecoration:"none",cursor:"pointer",minHeight:28,paddingTop:4}}>{name} <span aria-hidden="true" style={{fontSize:12}}>↗</span></a>
          <h1>{title}</h1>
        </div>
        <button
          className="secondary"
          type="button"
          onClick={() => setSettings((v) => !v)}
        >
          연결 설정
        </button>
      </div>
      {settings && (
        <div
          style={{
            padding: 16,
            border: "1px solid #e9e1f0",
            borderRadius: 14,
            background: "white",
            marginBottom: 15,
          }}
        >
          <p className="hint">
            {link
              ? name+"과 연결됐어요. 완료 체크는 Focus Flow에 저장돼요."
              : name+"에서 로그인한 뒤 아래 연결 코드를 입력해 주세요."}
          </p>
          {link ? (
            <button className="secondary" disabled={busy} onClick={disconnect}>
              연결 해제
            </button>
          ) : (
            <button
              className="secondary"
              disabled={busy || !client}
              onClick={generate}
            >
              연결 코드 만들기
            </button>
          )}
          {code && (
            <>
              <input
                aria-label={name+" 연결 코드"}
                value={code}
                readOnly
                onFocus={(e) => e.target.select()}
                style={{
                  width: "100%",
                  marginTop: 12,
                  fontSize: 16,
                  padding: 10,
                  border: "1px solid #e9e1f0",
                  borderRadius: 8,
                }}
              />
              <p className="hint">
                10분 동안 유효해요. {name}의 Focus Flow 연결란에 붙여 넣어
                주세요.
              </p>
            </>
          )}
        </div>
      )}
      {error && (
        <p className="hint" role="alert">
          {error}
        </p>
      )}
      {!link && (
        <p className="hint">
          {name}을 연결하면 오늘 예정된 일정이 여기에 표시돼요.
        </p>
      )}
      {link && !snapshot && (
        <p className="hint">
          {name}에서 ‘Focus Flow에 표시’를 켜고 동기화해 주세요.
        </p>
      )}
      {activities.length > 0 && <p className="hint" role="status">{activities.filter(isDone).length} / {activities.length}개 완료</p>}
      <ul aria-label={title+" 목록"} style={{listStyle:"none",padding:0,margin:0,display:"grid",gap:10}}>
        {activities.slice().sort((a,b)=>{const x=pinRank(a),y=pinRank(b);return x===null&&y===null?0:x===null?1:y===null?-1:x-y}).map(w => {
          const done = isDone(w);
          return <li className="linked-today-compact" key={w.id} onPointerDown={e=>{if(!e.target.closest('button,a,input'))startHold(e,checkKey(w))}} onPointerMove={moveHold} onPointerUp={stopHold} onPointerCancel={stopHold} onContextMenu={e=>{e.preventDefault();stopHold();setPinMenu(checkKey(w))}} style={{display:"flex",alignItems:"center",gap:8,padding:12,border:"1px solid #e9e1f0",borderRadius:16,background:done?"#f5f3f7":"white",color:done?"#938c9c":"#40384b",WebkitUserSelect:'none',userSelect:'none',WebkitTouchCallout:'none',flexWrap:'wrap'}}>
            {pinRank(w)!==null&&<span aria-label="고정됨">⭐</span>}
            {pinMenu===checkKey(w)&&<div style={{order:5,width:'100%',display:'flex',gap:12,justifyContent:'flex-end'}}><button type="button" onClick={()=>togglePinned(w)}>{pinRank(w)!==null?'☆ 고정 해제':'⭐ 맨 위에 고정'}</button><button type="button" onClick={()=>setPinMenu(null)}>닫기</button></div>}
            <button type="button" role="checkbox" aria-checked={done} aria-label={`${w.title} 완료`} disabled={!onCheck} onClick={() => onCheck(checkKey(w), !done)} style={{width:44,height:44,flexShrink:0,display:"grid",placeItems:"center",padding:0,border:0,background:"transparent",color:done?"#9c91ad":"#a68fc5",cursor:"pointer"}}>
              <span style={{width:26,height:26,border:"2px solid currentColor",borderRadius:"50%",display:"grid",placeItems:"center",background:done?"#e5e0ed":"white"}}>{done && <Check size={17} strokeWidth={3}/>}</span>
            </button>
            <a onPointerDown={e=>startHold(e,checkKey(w))} onPointerMove={moveHold} onPointerUp={stopHold} onContextMenu={e=>{e.preventDefault();stopHold();setPinMenu(checkKey(w))}} href={href(w)} target="_blank" rel="noopener noreferrer" style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:10,color:"inherit",textDecoration:"none",padding:"6px 0"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:650,lineHeight:1.5,overflowWrap:"anywhere",textDecoration:done?"line-through":"none"}}>{w.title}</div>
                <div style={{fontSize:12,marginTop:4,color:done?"#a19aa8":"#9687a5"}}>{{new:"신규 암기",review:"복습",breath:"호흡",mantra:"만트라"}[w.kind] || "일정"}{w.minutes > 0 ? ` · ${w.minutes}분` : ""} · {name}에서 열기</div>
              </div>
              <ChevronRight size={18} aria-hidden="true" style={{flexShrink:0}}/>
            </a>
          </li>;
        })}
      </ul>
      {activities.length === 0 && <p className="hint">오늘 등록된 일정이 없어요.</p>}
      {snapshot?.received_at && (
        <p className="hint">
          마지막 동기화 {new Date(snapshot.received_at).toLocaleString("ko-KR")}
        </p>
      )}
    </section>
  );
}
