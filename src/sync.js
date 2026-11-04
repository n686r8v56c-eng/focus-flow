import { useEffect, useRef, useState, useCallback } from "react";
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
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
  if (path === "data.inboxItems" && (local === undefined || Array.isArray(local)) && (remote === undefined || Array.isArray(remote)))
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
export function useSyncedState(client, userId, initial) {
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const context = useRef(null);
  useEffect(() => {
    const ctx = {
      userId,
      active: true,
      busy: false,
      dirty: false,
      base: null,
      local: null,
    };
    context.current = ctx;
    setData(null);
    setLoading(true);
    setError("");
    if (!userId) {
      setLoading(false);
      return () => {
        ctx.active = false;
      };
    }
    const key = "focus-flow-pending:" + userId;
    const backup = () => {
      localStorage.setItem(
        key,
        JSON.stringify({ base: ctx.base, local: ctx.local }),
      );
    };
    const read = async () => {
      const { data: row, error } = await client
        .from("focus_flow_states")
        .select("data,updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!row && ctx.rowExists)
        throw new Error(
          "서버 기록을 찾지 못했어. 기존 내용을 덮어쓰지 않았어.",
        );
      return row;
    };
    ctx.flush = async () => {
      if (!ctx.active || ctx.busy || !ctx.dirty || !ctx.base) return;
      ctx.busy = true;
      try {
        for (
          let attempt = 0;
          attempt < 5 && ctx.active && ctx.dirty;
          attempt++
        ) {
          const original = ctx.local,
            base = ctx.base,
            row = await read();
          if (!ctx.active) return;
          const remote = row
              ? normalizeState(row.data)
              : structuredClone(initial),
            merged = mergeState(base, original, remote);
          let result;
          if (row)
            result = await client
              .from("focus_flow_states")
              .update({
                data: merged,
                updated_at: new Date(
                  Math.max(Date.now(), Date.parse(row.updated_at) + 1),
                ).toISOString(),
              })
              .eq("user_id", userId)
              .eq("updated_at", row.updated_at)
              .select("updated_at");
          else
            result = await client
              .from("focus_flow_states")
              .insert({
                user_id: userId,
                data: merged,
                updated_at: new Date().toISOString(),
              })
              .select("updated_at");
          if (!ctx.active) return;
          if (result.error) {
            if (result.error.code === "23505") continue;
            throw result.error;
          }
          if (!result.data?.length) continue; // Another writer won the compare-and-swap. Re-read.
          ctx.local = mergeState(original, ctx.local, merged);
          ctx.base = merged;
          ctx.rowExists = true;
          ctx.dirty = !equal(ctx.local, merged);
          setData(ctx.local);
          setError("");
          if (ctx.dirty) backup();
          else localStorage.removeItem(key);
        }
        if (ctx.dirty)
          throw new Error(
            "동기화를 다시 시도할게. 변경 내용은 이 기기에 보관했어.",
          );
      } catch (e) {
        if (ctx.active) setError("동기화 확인: " + e.message);
      } finally {
        ctx.busy = false;
      }
    };
    ctx.change = (fn) => {
      const next = typeof fn === "function" ? fn(ctx.local) : fn;
      if (equal(next, ctx.local)) return;
      ctx.local = next;
      ctx.dirty = true;
      setData(next);
      try {
        backup();
      } catch (e) {
        setError("기기 임시 저장 실패: " + e.message);
      }
      void ctx.flush();
    };
    const check = async () => {
      if (!ctx.active || document.visibilityState === "hidden" || ctx.busy)
        return;
      if (ctx.dirty) {
        await ctx.flush();
        return;
      }
      ctx.busy = true;
      try {
        const before = ctx.local,
          row = await read();
        if (!ctx.active || ctx.dirty || ctx.local !== before) return;
        if (row) {
          ctx.local = ctx.base = normalizeState(row.data);
          setData(ctx.local);
          setError("");
        }
      } catch (e) {
        if (ctx.active) setError("동기화 확인: " + e.message);
      } finally {
        ctx.busy = false;
        if (ctx.dirty) void ctx.flush();
      }
    };
    (async () => {
      try {
        const row = await read();
        if (!ctx.active) return;
        const remote = row
          ? normalizeState(row.data)
          : structuredClone(initial);
        ctx.local = ctx.base = remote;
        ctx.rowExists = Boolean(row);
        const saved = localStorage.getItem(key);
        if (saved) {
          const pending = JSON.parse(saved);
          ctx.base = normalizeState(pending.base);
          ctx.local = normalizeState(pending.local);
          ctx.dirty = true;
        }
        setData(ctx.local);
        if (ctx.dirty) void ctx.flush();
      } catch (e) {
        if (ctx.active) setError("데이터 불러오기 실패: " + e.message);
      } finally {
        if (ctx.active) setLoading(false);
      }
    })();
    const timer = setInterval(check, 12000);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    const beforeUnload = (e) => {
      if (ctx.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      ctx.active = false;
      clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [client, userId, initial]);
  const change = useCallback((fn) => context.current?.change?.(fn), []);
  const canLogout = useCallback(async () => {
    const ctx = context.current;
    if (ctx?.dirty) await ctx.flush?.();
    return !ctx?.dirty && !ctx?.busy;
  }, []);
  return { data, change, loading, error, canLogout };
}
