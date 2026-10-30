import React, { useEffect, useState } from "react";

const sources = {
  study: { label: "MEMORY LAB", home: "https://memory-lab.pages.dev", link: "focus_activity_links", snapshot: "focus_activity_snapshots", field: "activities", extra: true },
  mind: { label: "Mind Flow", home: "https://mind-flow-4r3.pages.dev", link: "focus_activity_links", snapshot: "focus_activity_snapshots", field: "activities", extra: true },
  workout: { label: "HOME FIT", home: "https://home-fit-11n.pages.dev", link: "focus_home_links", snapshot: "focus_home_snapshots", field: "workouts", extra: false },
};
export function CalendarExternal({ source, date, client, userId, checks = {}, onCheck, heading, localTotal = 0, localDone = 0 }) {
  const config = sources[source];
  const [result, setResult] = useState({ list: [], linkId: null });
  useEffect(() => {
    let live = true;
    setResult({ list: [], linkId: null });
    if (!client || !userId || !config) return;
    async function load() {
      try {
        let q = client.from(config.link).select("id").eq("focus_user_id", userId).eq("active", true);
        if (config.extra) q = q.eq("source", source);
        const link = await q.maybeSingle();
        if (link.error) throw link.error;
        if (!link.data) { if (live) setResult({ list: [], linkId: null }); return; }
        const snapshot = await client.from(config.snapshot).select(config.field).eq("link_id", link.data.id).maybeSingle();
        if (snapshot.error) throw snapshot.error;
        if (live) setResult({ list: Array.isArray(snapshot.data?.[config.field]) ? snapshot.data[config.field] : [], linkId: link.data.id });
      } catch (e) { console.warn("Calendar linked activity fetch failed", source, e); }
    }
    load();
    const reload = () => { if (document.visibilityState === "visible") load(); };
    const timer = setInterval(reload, 12000);
    window.addEventListener("focus", reload);
    return () => { live = false; clearInterval(timer); window.removeEventListener("focus", reload); };
  }, [client, userId, source]);
  const list = result.list.filter(item => item.date === date);
  const destination = item => {
    try { const u = new URL(item.url); return u.origin === config.home ? u.href : config.home; }
    catch { return config.home; }
  };
  const linkedDone = list.filter(item => {
    const key = JSON.stringify([result.linkId, item.date, item.videoId || item.id]);
    return typeof checks[key]?.done === "boolean" ? checks[key].done : item.status === "done";
  }).length;
  const total = localTotal + list.length;
  const doneCount = localDone + linkedDone;
  const pct = total ? Math.round(100 * doneCount / total) : 0;
  return <div aria-label={config.label + " 연동 일정"}>
    {heading && <h3 style={{fontSize:14,margin:"4px 0 8px",display:"flex",gap:8,alignItems:"baseline"}}>{heading}<span aria-label={`진행률 ${doneCount}/${total}, ${pct}%`} style={{fontSize:11,color:"#9484a5",fontWeight:600,whiteSpace:"nowrap"}}>{doneCount}/{total} · {pct}%</span></h3>}
    {list.map(item => {
      const key = JSON.stringify([result.linkId, item.date, item.videoId || item.id]);
      const done = typeof checks[key]?.done === "boolean" ? checks[key].done : item.status === "done";
      return <div key={key} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", color:done?"#aaa":"#574b65" }}>
        <input type="checkbox" aria-label={item.title + " 완료"} checked={done} disabled={!onCheck} onChange={e => onCheck(key,e.target.checked)} />
        <a href={destination(item)} target="_blank" rel="noopener noreferrer" style={{ flex:1,minWidth:0,overflowWrap:"anywhere",color:"inherit",textDecoration:done?"line-through":"none" }}>
          {item.title} <span style={{fontSize:10,color:"#9c8bac"}}>↗ {config.label}</span>
        </a>
      </div>;
    })}
  </div>;
}
