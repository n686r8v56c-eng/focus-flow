import { useEffect, useRef, useState, useCallback } from "react";
const equal = (a, b) => {const order=x=>Array.isArray(x)?x.map(order):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,order(x[k])])):x;return JSON.stringify(order(a))===JSON.stringify(order(b))};
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
// Three-way merge: preserve independent edits; never silently pick a winner.
// Resolve concurrent running-timer edits by event time, while preserving both
// devices' completed entries. The active value is never merged field by field.
const actionTime = (state) => {
  const action = state?.lastAction;
  const value = action?.at || state?.active?.updatedAt || state?.active?.start;
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
};
function mergeTimeLog(base, local, remote, path) {
  const result = {};
  for (const key of new Set([...Object.keys(base || {}), ...Object.keys(local || {}), ...Object.keys(remote || {})])) {
    if (key === "active" || key === "lastAction") continue;
    if (key === "activities" && Array.isArray(local?.activities) && Array.isArray(remote?.activities)) {
      result.activities = [...new Set([...remote.activities, ...local.activities])];
      continue;
    }
    const merged = mergeState(base?.[key], local?.[key], remote?.[key], `${path}.${key}`);
    if (merged !== undefined) result[key] = merged;
  }
  const lChanged = !equal(local?.active, base?.active) || !equal(local?.lastAction, base?.lastAction);
  const rChanged = !equal(remote?.active, base?.active) || !equal(remote?.lastAction, base?.lastAction);
  // When one side only edited history or the activity list, keep the
  // other side's active session unchanged.
  let winner;
  if (!lChanged) winner = remote;
  else if (!rChanged) winner = local;
  else {
    const lt = actionTime(local), rt = actionTime(remote);
    winner = lt > rt ? local : rt > lt ? remote
      : String(local?.lastAction?.id || local?.active?.id || "") >= String(remote?.lastAction?.id || remote?.active?.id || "") ? local : remote;
  }
  if (winner?.active) result.active = winner.active;
  else result.active = null;
  if (winner?.lastAction) result.lastAction = winner.lastAction;
  return result;
}
// Preserve an edited version when a record was deleted or changed on another
// device. The deterministic ID makes retrying pending saves idempotent.
function inboxRecoveryCopy(item) {
  const canonical = value => object(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
    : Array.isArray(value) ? value.map(canonical) : value;
  const text = JSON.stringify(canonical(item));
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return {...item, id:`${item.id}~recovery-${hash.toString(16)}`, archived:true, recoveredFrom:item.id};
}
function mergeInbox(base, local, remote, path) {
  const b = new Map((base || []).map(item => [item.id,item]));
  const l = new Map((local || []).map(item => [item.id,item]));
  const r = new Map((remote || []).map(item => [item.id,item]));
  const result = new Map();
  for (const id of new Set([...r.keys(),...l.keys()])) {
    const before=b.get(id), left=l.get(id), right=r.get(id);
    try {
      const item=mergeState(before,left,right,`${path}.${id}`);
      if(item!==undefined) result.set(item.id,item);
    } catch (error) {
      // A true concurrent edit keeps the server record plus a recoverable local
      // version. Delete/edit conflicts keep only the recoverable edited version.
      if (right && left) result.set(right.id,right);
      const copy=inboxRecoveryCopy(left || right);
      if(!l.has(copy.id) && !r.has(copy.id)) result.set(copy.id,copy);
    }
  }
  return [...result.values()];
}
export function mergeState(base, local, remote, path = "data") {
  if (path === "data.timeLog" && object(local) && object(remote)) return mergeTimeLog(base, local, remote, path);
  if (path.startsWith("data.timeLog.entries.") && object(local) && object(remote)) {
    // Same running session ended on both devices: retain one completed record.
    const l = Date.parse(local.end || ""), r = Date.parse(remote.end || "");
    return (Number.isFinite(l) ? l : 0) >= (Number.isFinite(r) ? r : 0) ? local : remote;
  }
  if (equal(local, base)) return remote;
  if (equal(remote, base) || equal(local, remote)) return local;
  if ((path === "data.inboxItems" || path === "data.opportunityItems") && (local === undefined || Array.isArray(local)) && (remote === undefined || Array.isArray(remote)))
    return mergeInbox(base,local,remote,path);
  if (
    Array.isArray(local) &&
    Array.isArray(remote) &&
    [...(base || []), ...local, ...remote].every(
      (v) => object(v) && typeof v.id === "string",
    )
  ) {
    const b = new Map((base || []).map((v) => [v.id, v])),
      l = new Map(local.map((v) => [v.id, v])),
      r = new Map(remote.map((v) => [v.id, v]));
    return [...new Set([...r.keys(), ...l.keys()])]
      .map((id) => mergeState(b.get(id), l.get(id), r.get(id), path + "." + id))
      .filter((v) => v !== undefined);
  }
  if (object(local) && object(remote) && (base === undefined || object(base))) {
    const result = {};
    for (const k of new Set([
      ...Object.keys(base || {}),
      ...Object.keys(local),
      ...Object.keys(remote),
    ])) {
      const v = mergeState(base?.[k], local[k], remote[k], path + "." + k);
      if (v !== undefined) result[k] = v;
    }
    return result;
  }
  throw new Error(
    "다른 기기에서 같은 항목을 수정했어. 현재 변경은 이 기기에 보관했어. 다른 기기의 변경을 확인해 줘. (" +
      path +
      ")",
  );
}
export function normalizeState(value) {
  if (
    !value ||
    !Array.isArray(value.projects) ||
    !Array.isArray(value.tasks) ||
    (value.sessions !== undefined && !Array.isArray(value.sessions))
  )
    throw new Error("저장된 데이터 형식을 확인해야 해. 덮어쓰지 않았어.");
  return {
    ...value,
    tasks: value.tasks.map((t) => ({ ...t, subtasks: t.subtasks || [] })),
    sessions: value.sessions || [],
  };
}

const DB_NAME = "focus-flow-local-v1";
const STORE = "snapshots";
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function diskRead(key) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}
async function diskWrite(key, value) {
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
const dayStamp = () => new Date().toLocaleDateString("en-CA");
export function useSyncedState(client, userId, initial) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [backupInfo, setBackupInfo] = useState({status:"loading",lastBackup:null});
  const context = useRef(null);
  useEffect(() => {
    const ctx = {active:true,userId,local:null,base:null,dirty:false,busy:false,lastBackup:null,backupDay:null,write:Promise.resolve()};
    context.current = ctx;
    setLoading(true);setData(null);setError("");
    if (!userId) {setLoading(false);return ()=>{ctx.active=false;};}
    const key = "state:"+userId;
    const legacyKey = "focus-flow-pending:"+userId;
    const persist = () => {
      const snapshot = {local:ctx.local,base:ctx.base,dirty:ctx.dirty,lastBackup:ctx.lastBackup,backupDay:ctx.backupDay};
      ctx.write = ctx.write.then(()=>diskWrite(key,snapshot)).catch(e=>{
        if(ctx.active)setError("기기 저장 실패: "+e.message);
        throw e;
      });
      return ctx.write;
    };
    const fetchRemote = async () => {
      const {data:row,error:e} = await client.from("focus_flow_states").select("data,updated_at").eq("user_id",userId).maybeSingle();
      if(e)throw e;
      return row;
    };
    ctx.backup = async (manual=false) => {
      if (!ctx.active || ctx.busy || !ctx.local || !ctx.dirty || (!manual && ctx.backupDay===dayStamp())) return;
      ctx.busy=true;
      setBackupInfo({status:"backing-up",lastBackup:ctx.lastBackup});
      try {
        await ctx.write;
        const localAtStart=ctx.local;
        const row=await fetchRemote();
        const remote=row?normalizeState(row.data):structuredClone(initial);
        const merged=mergeState(ctx.base||remote,localAtStart,remote);
        let result;
        if(row) result=await client.from("focus_flow_states").update({data:merged,updated_at:new Date(Math.max(Date.now(),Date.parse(row.updated_at)+1)).toISOString()}).eq("user_id",userId).eq("updated_at",row.updated_at).select("updated_at");
        else result=await client.from("focus_flow_states").insert({user_id:userId,data:merged,updated_at:new Date().toISOString()}).select("updated_at");
        if(result.error)throw result.error;
        if(!result.data?.length)throw new Error("서버 데이터가 변경됐어. 다음 백업에서 다시 확인할게.");
        ctx.base=merged;
        ctx.local=mergeState(localAtStart,ctx.local,merged);
        ctx.dirty=!equal(ctx.local,merged);
        ctx.lastBackup=new Date().toISOString();
        ctx.backupDay=dayStamp();
        await persist();
        if(ctx.active){setData(ctx.local);setError("");setBackupInfo({status:ctx.dirty?"pending":"saved",lastBackup:ctx.lastBackup});}
      }catch(e){
        if(ctx.active){setError("백업 실패 (로컬 데이터 유지): "+e.message);setBackupInfo({status:"failed",lastBackup:ctx.lastBackup});}
      }finally{ctx.busy=false;}
    };
    ctx.change=(fn)=>{
      const next=typeof fn==="function"?fn(ctx.local):fn;
      if(equal(next,ctx.local))return;
      ctx.local=next;ctx.dirty=true;
      setData(next);setBackupInfo({status:"pending",lastBackup:ctx.lastBackup});
      void persist().catch(()=>{});
    };
    (async()=>{
      try {
        const saved=await diskRead(key);
        if(saved) {
          ctx.local=normalizeState(saved.local);
          ctx.base=saved.base?normalizeState(saved.base):null;
          ctx.dirty=Boolean(saved.dirty);
          ctx.lastBackup=saved.lastBackup||null;
          ctx.backupDay=saved.backupDay||null;
          setData(ctx.local);
        } else {
          // First migration: import the authoritative Supabase snapshot BEFORE enabling local writes.
          const row=await fetchRemote();
          const remote=row?normalizeState(row.data):structuredClone(initial);
          let local=remote,base=remote,dirty=false;
          const pending=localStorage.getItem(legacyKey);
          if(pending){
            const parsed=JSON.parse(pending);
            base=normalizeState(parsed.base);
            local=normalizeState(parsed.local);
            dirty=true;
          }
          ctx.local=local;ctx.base=base;ctx.dirty=dirty;
          await persist();
          // Verify the persisted snapshot before declaring migration successful.
          const verified=await diskRead(key);
          if(!verified||!equal(verified.local,local))throw new Error("IndexedDB 이전 검증 실패");
          if(pending)localStorage.removeItem(legacyKey);
          setData(local);
        }
        if(ctx.active){
          setBackupInfo({status:ctx.dirty?"pending":"saved",lastBackup:ctx.lastBackup});
          if(ctx.dirty && ctx.backupDay!==dayStamp())void ctx.backup();
        }
      }catch(e){if(ctx.active)setError("데이터 이전/불러오기 실패 (서버 데이터 보존): "+e.message);}
      finally{if(ctx.active)setLoading(false);}
    })();
    const onResume=()=>{if(document.visibilityState==="visible"&&ctx.dirty&&ctx.backupDay!==dayStamp())void ctx.backup();};
    window.addEventListener("focus",onResume);
    window.addEventListener("online",onResume);
    document.addEventListener("visibilitychange",onResume);
    return ()=>{ctx.active=false;window.removeEventListener("focus",onResume);window.removeEventListener("online",onResume);document.removeEventListener("visibilitychange",onResume);};
  },[client,userId,initial]);
  const change=useCallback(fn=>context.current?.change?.(fn),[]);
  const backupNow=useCallback(()=>context.current?.backup?.(true),[]);
  const canLogout=useCallback(async()=>{const ctx=context.current;if(!ctx)return true;try{await ctx.write;}catch{return false;}return !ctx.dirty;},[]);
  return {data,change,loading,error,canLogout,backupNow,backupInfo};
}
