import React, { useState, useEffect, useRef } from "react";
import {
  CalendarDays,
  Columns3,
  Timer,
  FolderKanban,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  Pencil,
  X,
  Check,
  Play,
  Pause,
  Square,
  RotateCcw,
  Clock3,
  Heart,
} from "lucide-react";
import "./style.css";
import "./timeblocks.css";
import focusBellSound from "./assets/focus-bell.mp3";
import { HomeWorkouts } from "./HomeWorkouts.jsx";
import { LinkedActivities } from "./LinkedActivities.jsx";
import { CalendarExternal } from "./CalendarExternal.jsx";
import {
  CLOCK_SOUNDS,
  clockType,
  loadClockBuffer,
  createClockVoice,
} from "./clock-audio.js";
const uid = () => Math.random().toString(36).slice(2, 10);
const pad = (n) => String(n).padStart(2, "0");
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayAdd = (s, n) => {
  const [y, m, d] = s.split("-").map(Number);
  return localDate(new Date(y, m - 1, d + n));
};
export function App({
  initialData,
  onDataChange,
  onLogout,
  bridgeClient,
  bridgeUserId,
}) {
  const data = initialData,
    setData = onDataChange;
  const [tab, setTab] = useState("today"),
    [selectedProject, setSelectedProject] = useState("p1"),
    [blockDate, setBlockDate] = useState(localDate()),
    [blockMode, setBlockMode] = useState("plan"),
    [collapsedToday, setCollapsedToday] = useState({}),
    [blockFirst, setBlockFirst] = useState(null),
    [blockDraft, setBlockDraft] = useState(""),
    [blockEditing, setBlockEditing] = useState(null),
    [blockRange, setBlockRange] = useState(null),
    [sleepEditing, setSleepEditing] = useState(false),
    [sleepDraftStart, setSleepDraftStart] = useState("22:00"),
    [sleepDraftEnd, setSleepDraftEnd] = useState("06:00"),
    [projectSort, setProjectSort] = useState("earliest"),
    [karmaCategory, setKarmaCategory] = useState("me"),
    [karmaDraft, setKarmaDraft] = useState(""),
    [calendarView, setCalendarView] = useState("month"),
    [focusDate, setFocusDate] = useState(localDate()),
    [modal, setModal] = useState(null),
    [editing, setEditing] = useState(null),
    [pomTask, setPomTask] = useState(""),
    [seconds, setSeconds] = useState(1500),
    [running, setRunning] = useState(false),
    [mode, setMode] = useState("focus"),
    [round, setRound] = useState(0),
    [toast, setToast] = useState(""),
    [pomView, setPomView] = useState("timer"),
    [statView, setStatView] = useState("daily"),
    [statMonth, setStatMonth] = useState(localDate().slice(0, 7)),
    [showDone, setShowDone] = useState(false),
    [viewDate,setViewDate]=useState(localDate()),
    [analysisPeriod,setAnalysisPeriod]=useState("daily"),
    [customFocusMinutes,setCustomFocusMinutes]=useState(25),

    [clockNow, setClockNow] = useState(Date.now()),
    [audioStatus, setAudioStatus] = useState("");
  const tickSound = data.settings?.tickSound ?? false,
    tickType = clockType(data.settings?.tickType),
    goalHours = data.settings?.goalHours ?? 3;
  const setting = (key, value) =>
    setData((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
  const setTickSound = (v) => setting("tickSound", v),
    setTickType = (v) => setting("tickType", v),
    setGoalHours = (v) => setting("goalHours", v);
  const alarmEnabled = data.settings?.alarmEnabled ?? true;
  const setAlarmEnabled = v => setting("alarmEnabled",v);
  const endAt = useRef(null);
  const dialDrag = useRef(null);
  const dialValue = useRef(25);
  const audioRef = useRef(null);
  const bellBufferRef = useRef(null);
  const bellLoadRef = useRef(null);
  const testAudioRef = useRef(null);
  const previewRef = useRef(null);
  const previewGeneration = useRef(0);
  const latest = useRef({});
  latest.current = { data, pomTask, mode, round };
  useEffect(() => {
    const refresh = () => setClockNow(Date.now());
    const i = setInterval(refresh, 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(i);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  useEffect(
    () => () => {
      previewGeneration.current++;
      previewRef.current?.stop();
      audioRef.current?.close();
      testAudioRef.current?.pause();
    },
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(t);
  }, [toast]);
  const update = (fn) =>
    setData((old) => (typeof fn === "function" ? fn(old) : fn));
  const project = (id) => data.projects.find((p) => p.id === id);
  const taskProject = (t) => project(t.projectId);
  const addTask = (t) => {
    let id = uid();
    update((d) => ({
      ...d,
      tasks: [
        ...d.tasks,
        {
          id,
          title: t.title.trim(),
          projectId: t.projectId || "",
          due: t.due || "",
          time: t.time || "",
          status: t.status || "todo",
          subtasks: [],
          tally: t.tally || null,
          tallies: Array.isArray(t.tallies)?t.tallies:[],
          estimatedPomodoros: pomCount(t.estimatedPomodoros),
          createdAt: new Date().toISOString(),
          completedAt: null,
        },
      ],
    }));
    setModal(null);
    setEditing(null);
  };
  const changeTask = (id, fields) =>
    update((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...fields } : t)),
    }));
  const advanceTally = (task) => {
    const tally = task.tally;
    if (!tally || !Number(tally.total)) return;
    const total=Math.max(1,Number(tally.total));
    const step=Math.max(1,Number(tally.step)||1);
    const count=Math.min(total,(Number(tally.count)||0)+step);
    changeTask(task.id,{tally:{...tally,count}});
  };
  const advanceMultiTally=(task,index)=>{
    const counters=task.tallies||[];
    const counter=counters[index];if(!counter)return;
    const total=Math.max(1,Number(counter.total)||1);
    const count=Math.min(total, (Number(counter.count)||0)+Math.max(1,Number(counter.step)||1));
    changeTask(task.id,{tallies:counters.map((c,i)=>i===index?{...c,count}:c)});
  };
  const reorderTask=(id,anchorId,targetStatus)=>update(d=>{
    const moving=d.tasks.find(t=>t.id===id);
    if (!moving || (anchorId && id===anchorId)) return d;
    const group=d.tasks.filter(t=>t.id!==id&&t.status===(targetStatus||moving.status)&&t.projectId===moving.projectId);
    const index=anchorId?group.findIndex(t=>t.id===anchorId):group.length;
    group.splice(index<0?group.length:index,0,{...moving,status:targetStatus||moving.status});
    const order=new Map(group.map((t,i)=>[t.id,i]));
    return {...d,tasks:d.tasks.map(t=>order.has(t.id)?{...t,status:targetStatus||moving.status,order:order.get(t.id)}:t)};
  });
  const completeOrStatus = (task, status) =>
    changeTask(task.id, {
      status,
      completedAt: status === "done" ? new Date().toISOString() : null,
    });
  const renameSelectedProject = () => {
  const target = data.projects.find(p => p.id === selectedProject);
  if (!target) return;
  const next = window.prompt("프로젝트 이름 수정", target.name);
  if (next === null || !next.trim() || next.trim() === target.name) return;
  update(d => ({ ...d, projects: d.projects.map(p => p.id === target.id ? {...p, name: next.trim()} : p) }));
};
  const deleteSelectedProject = () => {
    const item = data.projects.find(p => p.id === selectedProject);
    if (!item || !window.confirm(`프로젝트 “${item.name}”을 삭제할까?\n소속 할 일은 삭제하지 않고 개인 일정으로 옮겨져.`)) return;
    update(d => ({
      ...d,
      projects: d.projects.filter(p => p.id !== item.id),
      tasks: d.tasks.map(t => t.projectId === item.id ? {...t, projectId: null} : t),
    }));
    setSelectedProject(data.projects.find(p => p.id !== item.id)?.id || "");
  };
  const projectSortCompare = (a,b) => {
    const dateA = a.due || "9999-12-31";
    const dateB = b.due || "9999-12-31";
    if (dateA !== dateB) return projectSort === "latest" ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
    if (Boolean(a.time) !== Boolean(b.time)) return a.time ? -1 : 1;
    if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time);
    return (a.title || "").localeCompare(b.title || "", "ko");
  };
  const [pinMenuId, setPinMenuId] = useState(null);
  const pinHold = useRef(null);
  const pinHoldOrigin = useRef(null);
  const clearPinHold = () => {
    if (pinHold.current) clearTimeout(pinHold.current);
    pinHold.current = null;
    pinHoldOrigin.current = null;
  };
  useEffect(() => () => clearPinHold(), []);
  const beginPinHold = (event, id) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearPinHold();
    pinHoldOrigin.current = {x:event.clientX,y:event.clientY,pointerId:event.pointerId};
    pinHold.current = setTimeout(() => {
      setPinMenuId(id);
      pinHold.current = null;
      pinHoldOrigin.current = null;
    }, 550);
  };
  const trackPinHold = event => {
    const origin=pinHoldOrigin.current;
    if (origin && (Math.abs(event.clientX-origin.x)>12 || Math.abs(event.clientY-origin.y)>12)) clearPinHold();
  };
  const togglePin = task => {
    update(d => {
      const group=d.tasks.filter(t=>t.projectId===task.projectId && Number.isFinite(t.pinOrder));
      const next=group.reduce((m,t)=>Math.max(m,t.pinOrder),0)+1;
      return {...d,tasks:d.tasks.map(t=>t.id===task.id?{...t,pinOrder:Number.isFinite(t.pinOrder)?null:next}:t)};
    });
    setPinMenuId(null);
  };
  const removeTask = (id) => {
    update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
    setEditing(null);
  };
  const now = new Date(clockNow);
  const today = localDate(now);
  const visibleDate = viewDate;
  const timeText = (seconds) =>
    `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
  // Each session uses its own fixed window (local device time).
  const sessionTimer = (startHour, endHour) => {
    const start = new Date(clockNow);
    start.setHours(startHour, 0, 0, 0);
    const end = new Date(clockNow);
    end.setHours(endHour, 0, 0, 0);
    const total = end.getTime() - start.getTime();
    const elapsed = Math.max(0, Math.min(total, clockNow - start.getTime()));
    const remainingSeconds = Math.max(0, Math.ceil((end.getTime() - Math.max(clockNow, start.getTime())) / 1000));
    return { text: timeText(remainingSeconds), progress: elapsed / total };
  };
  const todayTasks = data.tasks
    .filter(
      (t) =>
        (t.status !== "done" && (!t.due || t.due <= visibleDate)) ||
        (t.status === "done" &&
          t.completedAt &&
          localDate(new Date(t.completedAt)) === visibleDate),
    )
    .sort((a,b) => {const ap=Number.isFinite(a.pinOrder),bp=Number.isFinite(b.pinOrder); if(ap!==bp)return ap?-1:1; if(ap&&bp)return a.pinOrder-b.pinOrder;return (a.order??0)-(b.order??0)||(a.time||"99:99").localeCompare(b.time||"99:99");});
  const plannedTasks = data.tasks.filter((t) => t.due && t.status !== "done");
  const todayNotDone = todayTasks.filter((t) => t.status !== "done");
  const selectedPomTask = data.tasks.find((t) => t.id === pomTask);
  function reportAudioError(error) {
    setAudioStatus(
      "소리를 켜지 못했어. 소리 테스트를 다시 눌러 줘. (" +
        (error?.message || "오디오 확인 필요") +
        ")",
    );
  }
  function activateAudio() {
    // Call directly from a tap, before awaiting anything (Safari user activation).
    try {
      if (window.navigator.audioSession) {
        try {
          window.navigator.audioSession.type = "playback";
        } catch {}
      }
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return Promise.reject(new Error("Web Audio 미지원"));
      if (!audioRef.current || audioRef.current.state === "closed")
        audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      if (!bellLoadRef.current) {
        bellLoadRef.current = fetch(focusBellSound)
          .then(response => { if (!response.ok) throw new Error('Bell download failed'); return response.arrayBuffer(); })
          .then(buffer => ctx.decodeAudioData(buffer))
          .then(decoded => { bellBufferRef.current = decoded; return decoded; })
          .catch(error => { bellLoadRef.current = null; console.warn('종소리를 준비하지 못했어', error); });
      }
      const resumed = ctx.resume();
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      source.connect(ctx.destination);
      source.start(0);
      return Promise.resolve(resumed).then(() => {
        if (ctx.state !== "running") throw new Error("오디오가 일시 중단됐어");
        return ctx;
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }
  function testSound() {
    // A real short WAV through the media path also tests Safari's speaker route.
    try {
      const ready = activateAudio();
      if (!testAudioRef.current) {
        const rate = 16000,
          count = 6400;
        const bytes = new Uint8Array(44 + count * 2),
          view = new DataView(bytes.buffer);
        const text = (offset, value) =>
          [...value].forEach((c, i) =>
            view.setUint8(offset + i, c.charCodeAt(0)),
          );
        text(0, "RIFF");
        view.setUint32(4, 36 + count * 2, true);
        text(8, "WAVE");
        text(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, rate, true);
        view.setUint32(28, rate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        text(36, "data");
        view.setUint32(40, count * 2, true);
        for (let i = 0; i < count; i++) {
          const t = i / rate,
            envelope = Math.min(1, t / 0.01) * Math.exp(-t * 9);
          view.setInt16(
            44 + i * 2,
            Math.round(Math.sin(2 * Math.PI * 660 * t) * envelope * 12000),
            true,
          );
        }
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        testAudioRef.current = new window.Audio(
          "data:audio/wav;base64," + window.btoa(binary),
        );
        testAudioRef.current.preload = "auto";
      }
      const audio = testAudioRef.current;
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0.8;
      // Both play() and resume() run in the original button gesture.
      const played = audio.play();
      Promise.allSettled([ready, Promise.resolve(played)]).then((results) => {
        const failed = results.find((result) => result.status === "rejected");
        if (failed) reportAudioError(failed.reason);
        else
          setAudioStatus(
            "짧은 확인음이 들리는지 확인해 줘. 이제 초침 미리 듣기를 눌러 봐.",
          );
      });
    } catch (error) {
      reportAudioError(error);
    }
  }
  function stopPreview() {
    previewGeneration.current++;
    previewRef.current?.stop();
    previewRef.current = null;
  }
  function previewClock() {
    stopPreview();
    const generation = previewGeneration.current;
    const ready = activateAudio();
    setAudioStatus("시계 소리를 준비하고 있어…");
    ready
      .then(async (ctx) => {
        const buffer = await loadClockBuffer(ctx, tickType);
        if (generation !== previewGeneration.current) return;
        if (running && mode === "focus" && tickSound) {
          setAudioStatus("선택한 시계 소리가 집중 타이머에서 재생 중이야.");
          return;
        }
        previewRef.current = createClockVoice(ctx, buffer, { duration: 8 });
        setAudioStatus("8초 미리 듣기 · 반복되는 경계까지 들어봐.");
      })
      .catch((error) => {
        if (generation === previewGeneration.current) reportAudioError(error);
      });
  }
  useEffect(() => {
    stopPreview();
    if (!running || mode !== "focus" || !tickSound) return;
    let cancelled = false,
      voice;
    const ctx = audioRef.current;
    if (!ctx) {
      reportAudioError(new Error("소리 테스트를 먼저 눌러 줘"));
      return;
    }
    (async () => {
      const buffer = await loadClockBuffer(ctx, tickType);
      if (cancelled) return;
      if (ctx.state !== "running") await ctx.resume();
      if (cancelled) return;
      if (ctx.state !== "running") throw new Error("오디오가 일시 중단됐어");
      // One decoded source loops on the audio thread: no ended/restart or JS interval.
      voice = createClockVoice(ctx, buffer);
    })().catch((error) => {
      if (!cancelled) reportAudioError(error);
    });
    const resume = () => {
      if (
        !cancelled &&
        document.visibilityState === "visible" &&
        ctx.state !== "running"
      )
        ctx.resume().catch(reportAudioError);
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelled = true;
      voice?.stop();
      document.removeEventListener("visibilitychange", resume);
    };
  }, [running, mode, tickSound, tickType]);
  function ringBell() {
    const ctx = audioRef.current;
    if (!ctx || !bellBufferRef.current) {
      // Fallback when the user started before sound decoding finished.
      const audio = new Audio(focusBellSound);
      audio.volume = 0.8;
      audio.play().catch(error => console.warn('종소리 재생 차단', error));
      return;
    }
    try {
      const voice = ctx.createBufferSource();
      voice.buffer = bellBufferRef.current;
      const volume = ctx.createGain();
      volume.gain.value = 0.8;
      voice.connect(volume);
      volume.connect(ctx.destination);
      if (ctx.state === 'suspended') void ctx.resume();
      voice.start(0);
    } catch (error) { console.warn('종소리 재생 실패', error); }
  }
  function finishPom() {
    if (endAt.current === null) return;
    const finishedAt = endAt.current;
    if(alarmEnabled) ringBell();
    const { pomTask, mode, round } = latest.current;
    setRunning(false);
    endAt.current = null;
    if (mode === "focus") {
      if (customFocusMinutes >= 1) update((d) => ({
        ...d,
        sessions: [
          ...(d.sessions || []),
          {
            id: uid(),
            taskId: pomTask || null,
            minutes: customFocusMinutes,
            endedAt: new Date(finishedAt).toISOString(),
          },
        ],
      }));
      setToast(customFocusMinutes >= 1 ? `집중 ${customFocusMinutes}분 완료! 기록에 저장했어.` : "1분 미만은 기록하지 않아.");
      setRound(round + 1);
      setMode("break");
      setSeconds((round + 1) % 4 === 0 ? 900 : 300);
    } else {
      setMode("focus");
      setSeconds(customFocusMinutes * 60);
      setToast("휴식 끝! 다음 집중을 시작해봐.");
    }
  }
  useEffect(() => {
    if (!running) return;
    endAt.current = Date.now() + seconds * 1000;
    const tick = () => {
      if (endAt.current === null) return;
      let left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setSeconds(left);
      if (left === 0) finishPom();
    };
    const i = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(i);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running]);
  const changeFocusMinutes = (minutes) => {
    const next = Math.max(0, Math.min(60, Math.round(minutes)));
    dialValue.current = next;
    setCustomFocusMinutes(next);
    setSeconds(next * 60);
  };
  const dialAngle = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    return (Math.atan2(y, x) * 180 / Math.PI + 450) % 360;
  };
  const dialStart = (event) => {
    if (running || mode !== "focus") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dialDrag.current = { id: event.pointerId, last: dialAngle(event), accumulated: dialValue.current };
  };
  const dialMove = (event) => {
    const drag = dialDrag.current;
    if (!drag || drag.id !== event.pointerId || running || mode !== "focus") return;
    const angle = dialAngle(event);
    let delta = angle - drag.last;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    drag.last = angle;
    drag.accumulated = Math.max(0, Math.min(60, drag.accumulated + delta / 6));
    changeFocusMinutes(drag.accumulated);
  };
  const dialEnd = () => { dialDrag.current = null; };
  const resetTimer = (m = mode) => {
    setRunning(false);
    endAt.current = null;
    setMode(m);
    setSeconds(m === "focus" ? customFocusMinutes*60 : 300);
  };
  function dateItems(date) {
    return data.tasks.filter(
      (t) =>
        t.due === date ||
        (date === today && t.status !== "done" && t.due && t.due < visibleDate),
    );
  }
  function KarmaPanel() {
    const all = Array.isArray(data.karmaEntries) ? data.karmaEntries : [];
    const items = all.filter((entry) => entry.category === karmaCategory)
      .slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
      .slice(0,20);
    const last = all.reduce((latest, item) => {
      const timestamp = Date.parse(item.createdAt);
      return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
    }, 0);
    const elapsed = last ? Math.max(0, Math.floor((Date.now()-last)/1000)) : 0;
    const timer = `${pad(Math.floor(elapsed/3600))}:${pad(Math.floor(elapsed/60)%60)}:${pad(elapsed%60)}`;
    function saveKarma(e) {
      e.preventDefault();
      const memo = karmaDraft.trim();
      if (!memo) return;
      const createdAt = new Date().toISOString();
      update(d => ({ ...d, karmaEntries: [ ...(Array.isArray(d.karmaEntries) ? d.karmaEntries : []),
        { id: uid(), category: karmaCategory, text: memo, createdAt } ] }));
      setKarmaDraft("");
    }
    function deleteKarma(id) {
      if (!window.confirm('이 카르마 기록을 삭제할까? 삭제한 기록은 되돌릴 수 없어.')) return;
      update(d => ({...d, karmaEntries: (Array.isArray(d.karmaEntries) ? d.karmaEntries : []).filter(entry => entry.id !== id)}));
    }
    function downloadKarma() {
      const rows = [['날짜','시각','구분','메모'], ...all.slice()
        .sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt))
        .map(entry => {const date=new Date(entry.createdAt);return [
          Number.isNaN(date.getTime())?'':localDate(date),
          Number.isNaN(date.getTime())?'':`${pad(date.getHours())}:${pad(date.getMinutes())}`,
          entry.category==='world'?'세상':'나',entry.text||'' ];})];
      const csv = '\uFEFF'+rows.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n');
      const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement('a');anchor.href=url;anchor.download=`FocusFlow_Karma_${localDate()}.csv`;
      document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    return <section className="karma-page" style={{paddingBottom:24}}>
      <div className="section-top"><div><div className="eyebrow">작은 선행을 기록하는 공간</div><h1>카르마</h1></div></div>
      <div className="stat-card" style={{textAlign:'center',padding:'22px 12px',marginBottom:18}}>
        <div style={{fontSize:13,color:'#9680aa',fontWeight:700}}>From Last Good Karma</div>
        <div style={{fontSize:'clamp(27px,9vw,40px)',fontWeight:750,fontVariantNumeric:'tabular-nums',letterSpacing:1,marginTop:10}} aria-label="마지막 카르마 이후 경과 시간">{timer}</div>
      </div>
      <div className="pom-subnav" role="tablist" aria-label="카르마 유형">
        <button role="tab" aria-selected={karmaCategory==='me'} className={karmaCategory==='me'?'active':''} onClick={()=>setKarmaCategory('me')}>나</button>
        <button role="tab" aria-selected={karmaCategory==='world'} className={karmaCategory==='world'?'active':''} onClick={()=>setKarmaCategory('world')}>세상</button>
      </div>
      <form onSubmit={saveKarma} className="stat-card" style={{marginTop:16,marginBottom:18}}>
        <label style={{display:'block',fontWeight:700,color:'#775991',marginBottom:10}} htmlFor="karma-memo">{karmaCategory==='me'?'나를 위한 카르마':'세상을 위한 카르마'}</label>
        <textarea id="karma-memo" rows={4} value={karmaDraft} onChange={e=>setKarmaDraft(e.target.value)} placeholder="오늘의 카르마를 기록해 줘" style={{width:'100%',boxSizing:'border-box',resize:'vertical',padding:12,borderRadius:12,border:'1px solid #e5dcea',fontSize:15}} />
        <button className="primary" type="submit" disabled={!karmaDraft.trim()} style={{width:'100%',minHeight:52,marginTop:16,borderRadius:13,padding:'13px 16px',fontSize:16,fontWeight:750,display:'flex',alignItems:'center',justifyContent:'center'}}>기록하기</button>
      </form>
      <div aria-label="카르마 최근 기록" className="karma-record-list">
        {items.map(entry=>{const date=new Date(entry.createdAt);return <article key={entry.id} className="stat-card" style={{marginBottom:10,padding:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:8}}>
            <div style={{fontSize:12,color:'#978aa2',fontVariantNumeric:'tabular-nums'}}>{Number.isNaN(date.getTime())?'':`${String(date.getFullYear()).slice(-2)}${pad(date.getMonth()+1)}${pad(date.getDate())}`}　{Number.isNaN(date.getTime())?'':`${pad(date.getHours())}:${pad(date.getMinutes())}`}</div>
            <button type="button" aria-label="카르마 기록 삭제" title="이 기록 삭제" onClick={()=>deleteKarma(entry.id)} style={{width:40,height:40,flexShrink:0,display:'grid',placeItems:'center',border:'1px solid #f0e5ed',borderRadius:10,color:'#ad8191',background:'#fff'}}> <Trash2 size={17}/> </button>
          </div>
          <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{entry.text}</div>
        </article>})}
        {!items.length && <p className="hint">아직 기록이 없어. 첫 카르마를 남겨봐.</p>}
      </div>
      <button type="button" className="secondary" onClick={downloadKarma} style={{width:'100%',marginTop:14}}>전체 기록 다운로드하기 (CSV)</button>
    </section>;
  }
  const moveTodayKanbanFromHandle = (taskId, targetStatus) => {
    if (!['todo','doing','done'].includes(targetStatus)) return;
    update(d => ({...d, tasks: d.tasks.map(t => t.id !== taskId ? t : ({
      ...t, status: targetStatus,
      completedAt: targetStatus === 'done' ? (t.completedAt || new Date().toISOString()) : null
    }))}));
  };
  const handleKanbanPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    clearPinHold();
    const handle=e.currentTarget;
    handle.dataset.dragging='true';
    handle.style.background='#efe7fb';
    handle.style.color='#795bb4';
    try { handle.setPointerCapture(e.pointerId); } catch {}
  };
  const handleKanbanPointerUp = (e, taskId) => {
    e.stopPropagation();
    const handle=e.currentTarget;
    if (handle.dataset.dragging !== 'true') return;
    handle.dataset.dragging='false';
    handle.style.background='';
    handle.style.color='';
    const el=document.elementFromPoint(e.clientX,e.clientY);
    const lane=el?.closest('[data-today-kanban-lane]');
    if (lane) moveTodayKanbanFromHandle(taskId,lane.getAttribute('data-today-kanban-lane'));
    try { handle.releasePointerCapture(e.pointerId); } catch {}
  };
  const handleKanbanPointerCancel = e => {
    const handle=e.currentTarget;
    handle.dataset.dragging='false';
    handle.style.background='';
    handle.style.color='';
  };
  function TaskCard({ task, compact = false }) {
    const p = taskProject(task),
      total = (task.subtasks || []).length,
      complete = (task.subtasks || []).filter((s) => s.done).length;
    return (
      <div
        className={"task-card today-compact-card " + (compact ? "compact" : "")}
        onClick={() => {if(pinMenuId!==task.id)setEditing(task.id)}}
        onPointerDown={(e) => { if (!e.target.closest('button,input,a,select')) beginPinHold(e,task.id); }}
        onPointerMove={trackPinHold}
        onPointerUp={clearPinHold}
        onPointerCancel={clearPinHold}
        onContextMenu={(e) => {e.preventDefault();clearPinHold();setPinMenuId(task.id);}}
        style={{WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none'}}
      >
        <div className="task-head">
          <span
            className="project-dot"
            style={{ background: p?.color || "#b8b3bf" }}
          />
          <span className="task-project">{p?.name || "개인 일정"}</span>
          <small style={{marginLeft:"auto",fontSize:11,color:"#90889a"}}>{task.due||""}{task.time?" · "+task.time:""}</small>
          {task.due && task.due < today && task.status !== "done" && (
            <span className="carry">자동 이월</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="task-title" style={{ flex: 1, minWidth: 0 }}>
            {Number.isFinite(task.pinOrder) && <span aria-label="고정됨" style={{marginRight:4}}>⭐</span>}
            {task.title}
          </div>
          {total > 0 && (
            <svg viewBox="0 0 40 40" width="36" height="36" role="img"
              aria-label={`서브태스크 진행률 ${Math.round(complete / total * 100)}%`}
              style={{ flexShrink: 0, display: 'block' }}>
              <circle cx="20" cy="20" r="15" fill="none" stroke="#e9e4ef" strokeWidth="5" />
              <circle cx="20" cy="20" r="15" fill="none" stroke="#9c85cd" strokeWidth="5"
                strokeDasharray={`${(complete / total) * (2 * Math.PI * 15)} ${2 * Math.PI * 15}`}
                transform="rotate(-90 20 20)" strokeLinecap="butt"
                style={{ transition: 'stroke-dasharray 180ms ease' }} />
            </svg>
          )}
          <TaskEstimate count={task.estimatedPomodoros} />
        </div>
        {task.tally?.total > 0 && <button type="button" aria-label={`${task.title} 횟수 추가`} onClick={e=>{e.stopPropagation();advanceTally(task)}} style={{width:"100%",border:0,textAlign:"left",marginTop:6,padding:"8px 10px",borderRadius:9,fontWeight:650,background:`linear-gradient(to right,#efb7bc ${Math.min(100,100*(task.tally.count||0)/task.tally.total)}%,#f2eef5 0%)`}}>{task.tally.count||0}/{task.tally.total} · +{task.tally.step||1}</button>}
        {(task.tallies||[]).map((counter,i)=><button key={counter.id||i} type="button" aria-label={`${counter.label||task.title} 횟수 추가`} onClick={e=>{e.stopPropagation();advanceMultiTally(task,i)}} style={{width:"100%",border:0,textAlign:"left",marginTop:6,padding:"8px 10px",borderRadius:9,fontWeight:650,background:`linear-gradient(to right,#efb7bc ${Math.min(100,100*(counter.count||0)/Math.max(1,counter.total))}%,#f2eef5 0%)`}}>{counter.label?counter.label+" · ":""}{counter.count||0}/{counter.total} · +{counter.step||1}</button>)}
        <div className="task-foot">
          <span>{task.tally?.total ? `${task.tally.count||0}/${task.tally.total}` : ""}</span>
          {total > 0 && (
            <span>
              ☑ {complete}/{total}
            </span>
          )}
        </div>
        {!compact && total > 0 && (
          <div className="card-subtasks">
            {task.subtasks.map((sub) => (
              <label key={sub.id} onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={sub.done}
                  onChange={(e) =>
                    changeTask(task.id, {
                      subtasks: task.subtasks.map((x) =>
                        x.id === sub.id ? { ...x, done: e.target.checked } : x,
                      ),
                    })
                  }
                />
                <span className={sub.done ? "struck" : ""}>{sub.text}</span>
              </label>
            ))}
          </div>
        )}
        {pinMenuId===task.id && <div className="today-pin-actions" onClick={e=>e.stopPropagation()} style={{padding:'8px 0',display:'flex',justifyContent:'flex-end',gap:10}}>
          <button type="button" onClick={e=>{e.stopPropagation();togglePin(task)}}>{Number.isFinite(task.pinOrder)?'☆ 고정 해제':'⭐ 맨 위에 고정'}</button>
          <button type="button" onClick={e=>{e.stopPropagation();setPinMenuId(null)}}>닫기</button>
        </div>}
      </div>
    );
  }
  const toggleTodaySection = (key) => setCollapsedToday(prev => ({...prev,[key]:!prev[key]}));
  function Kanban() {
    return (
      <>
        <div
          aria-label="오늘의 시간"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2,minmax(0,1fr))",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {[
            { label: "현재 시각", text: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`, progress: null },
            { label: "오전 타이머", ...sessionTimer(6, 12) },
            { label: "오후 타이머", ...sessionTimer(12, 18) },
            { label: "저녁 타이머", ...sessionTimer(18, 22) },
          ].map(({ label, text, progress }, i) => (
            <div
              key={label}
              role="timer"
              aria-label={`${label}: ${text}${progress === null ? "" : `, ${Math.round(progress * 100)}% 경과`}`}
              style={{
                padding: "15px 12px",
                borderRadius: 15,
                border: "1px solid #e9e1f0",
                background: progress === null
                  ? "#f3edf9"
                  : `linear-gradient(to right, #e7d9f6 ${Math.round(progress * 100)}%, #ffffff ${Math.round(progress * 100)}%)`,
                minWidth: 0,
                transition: "background 0.5s ease",
              }}
            >
              <div style={{ fontSize: 12, color: "#8b7b9c", marginBottom: 7, fontWeight: 650 }}>
                {label}
              </div>
              <div style={{
                fontSize: "clamp(21px,6vw,30px)",
                fontWeight: 750,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-.5px",
                color: i === 0 ? "#7854ab" : "#53465f",
                whiteSpace: "nowrap",
              }}>
                {text}
              </div>
            </div>
          ))}
        </div>
        <div className="today-heading-compact" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6,flexWrap:'nowrap',width:'100%',marginBottom:12}}>
          <div style={{minWidth:0,flex:'1 1 auto'}}>
            <div className="eyebrow" style={{fontSize:12,whiteSpace:'nowrap',color:'#957bb6',display:'flex',alignItems:'flex-end',minHeight:28,paddingBottom:1}}>
              {new Date(visibleDate+'T12:00:00').toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'})}
              <span aria-label="날짜 이동" style={{display:'inline-flex',alignItems:'center',gap:2,marginLeft:8,fontSize:'inherit',fontWeight:'inherit',color:'inherit',whiteSpace:'nowrap',verticalAlign:'baseline'}}>
                <button type="button" aria-label="이전 날짜" onClick={()=>setViewDate(d=>dayAdd(d,-1))} style={{appearance:'none',padding:0,width:16,height:18,minWidth:16,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'transparent',color:'inherit',border:0,font:'inherit',lineHeight:1,cursor:'pointer'}}>{'<'}</button>
                <button type="button" aria-label="다음 날짜" onClick={()=>setViewDate(d=>dayAdd(d,1))} style={{appearance:'none',padding:0,width:16,height:18,minWidth:16,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'transparent',color:'inherit',border:0,font:'inherit',lineHeight:1,cursor:'pointer'}}>{'>'}</button>
              </span>
            </div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,whiteSpace:'nowrap'}}>
              <h1 role="button" tabIndex={0} aria-expanded={!collapsedToday.tasks} onClick={()=>toggleTodaySection("tasks")} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggleTodaySection("tasks")}}} style={{cursor:"pointer",fontSize:27,letterSpacing:'-0.8px',whiteSpace:'nowrap',margin:'5px 0 0'}}>오늘의 할 일</h1>
              <ProgressBadge done={todayTasks.filter(t=>t.status==='done').length} total={todayTasks.length}/>

            </div>
          </div>
          <button type="button" className="primary small" aria-label="할 일 추가" onClick={()=>{setModal('task');setEditing(null);}} style={{width:36,minWidth:36,height:38,padding:0,display:'grid',placeItems:'center',flexShrink:0}}><Plus size={20}/></button>
        </div>

        <section aria-label="오늘의 할 일 체크리스트" style={{display:collapsedToday.tasks?"none":'grid',gap:7,marginBottom:15}}>
          {todayTasks.filter(t=>t.status!=='done').map(t=>{
            const subtasks=t.subtasks||[];
            const count=subtasks.filter(x=>x.done).length;
            const proj=taskProject(t);
            return <div key={t.id} className="today-list-row" onPointerDown={e=>{if(!e.target.closest('button,input,a,select,label'))beginPinHold(e,t.id)}} onPointerMove={trackPinHold} onPointerUp={clearPinHold} onPointerCancel={clearPinHold} onContextMenu={e=>{e.preventDefault();clearPinHold();setPinMenuId(t.id)}} style={{background:'white',border:'1px solid #e9e1f0',borderRadius:16,padding:'9px 12px',WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <button type="button" onClick={()=>completeOrStatus(t,'done')} aria-label={`${t.title} 완료`} style={{width:28,height:28,flexShrink:0,border:'2px solid #ac98c7',borderRadius:'50%',background:'white'}}/>
                <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>{if(pinMenuId!==t.id)setEditing(t.id)}}>
                  <div style={{display:'flex',alignItems:'center',gap:5,fontWeight:700,fontSize:14,overflowWrap:'anywhere'}}>
                    {Number.isFinite(t.pinOrder)&&<span>⭐</span>}
                    <span>{t.title}</span>
                    {!!t.estimatedPomodoros && <span style={{display:'inline-flex',flexShrink:0,alignItems:'center',gap:2}}><TaskEstimate count={t.estimatedPomodoros}/></span>}
                  </div>
                  <div style={{fontSize:11,color:'#978aa5',marginTop:2,display:'flex',alignItems:'center',gap:5}}><span aria-hidden="true" style={{width:7,height:7,borderRadius:'50%',background:proj?.color||'#b8b3bf',display:'inline-block',flexShrink:0}}/>{proj?.name||'개인 일정'}{t.due?' · '+t.due:''}{t.time?' · '+t.time:''}</div>
                </div>
                {subtasks.length>0&&<svg viewBox="0 0 40 40" width="32" height="32" role="img" aria-label={`서브태스크 ${count}/${subtasks.length} 완료`} style={{flexShrink:0}}>
                  <circle cx="20" cy="20" r="15" stroke="#e9e4ef" strokeWidth="5" fill="none"/>
                  <circle cx="20" cy="20" r="15" stroke="#9c85cd" strokeWidth="5" fill="none" strokeDasharray={`${94.248*count/subtasks.length} 94.248`} transform="rotate(-90 20 20)"/>
                </svg>}
              </div>
              {subtasks.length>0&&<div style={{margin:'6px 0 0 36px',display:'grid',gap:5,borderTop:'1px solid #f3eef6',paddingTop:6}}>
                {subtasks.map(sub=><label key={sub.id} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:sub.done?'#aaa':'#675b70'}} onClick={e=>e.stopPropagation()}>
                  <input type="checkbox" checked={!!sub.done} onChange={e=>changeTask(t.id,{subtasks:subtasks.map(x=>x.id===sub.id?{...x,done:e.target.checked}:x)})} style={{accentColor:'#9c85cd'}}/>
                  <span style={{textDecoration:sub.done?'line-through':'none'}}>{sub.text}</span>
                </label>)}
              </div>}
              {pinMenuId===t.id&&<div onClick={e=>e.stopPropagation()} style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:8}}><button type="button" onClick={()=>togglePin(t)}>{Number.isFinite(t.pinOrder)?'☆ 고정 해제':'⭐ 맨 위에 고정'}</button><button type="button" onClick={()=>setPinMenuId(null)}>닫기</button></div>}
            </div>;
          })}
          {!todayTasks.some(t=>t.status!=='done')&&<div style={{padding:18,textAlign:'center',color:'#a397ae'}}>남은 할 일이 없어 🎉</div>}
          {todayTasks.some(t=>t.status==='done')&&<div style={{fontSize:12,fontWeight:700,color:'#9889aa',marginTop:8}}>완료한 할 일 ({todayTasks.filter(t=>t.status==='done').length})</div>}
          {todayTasks.filter(t=>t.status==='done').map(t=>{
            const proj=taskProject(t);
            const subtasks=t.subtasks||[];
            const count=subtasks.filter(x=>x.done).length;
            return <div key={t.id} style={{background:'#f4f1f6',border:'1px solid #e9e3ee',borderRadius:16,padding:'9px 12px',display:'flex',alignItems:'center',gap:10,color:'#9a93a2'}}>
              <button type="button" aria-label={`${t.title} 완료 취소`} onClick={()=>completeOrStatus(t,'todo')} style={{width:28,height:28,flexShrink:0,borderRadius:'50%',background:'#e4ddee',border:'2px solid #a58fc6',color:'#876bb5',fontWeight:700}}>✓</button>
              <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>setEditing(t.id)}><div style={{display:'flex',alignItems:'center',gap:5,fontSize:14,fontWeight:650,textDecoration:'line-through',overflowWrap:'anywhere'}}>{Number.isFinite(t.pinOrder)?'⭐ ':''}<span>{t.title}</span>{!!t.estimatedPomodoros&&<TaskEstimate count={t.estimatedPomodoros}/>}</div><div style={{fontSize:11,marginTop:3,display:'flex',alignItems:'center',gap:5}}><span aria-hidden="true" style={{width:7,height:7,borderRadius:'50%',background:proj?.color||'#b8b3bf',display:'inline-block',flexShrink:0}}/>{proj?.name||'개인 일정'}{t.due?' · '+t.due:''}{t.time?' · '+t.time:''}</div></div>
              {subtasks.length>0&&<svg viewBox="0 0 40 40" width="32" height="32" aria-label={`서브태스크 ${count}/${subtasks.length} 완료`}><circle cx="20" cy="20" r="15" stroke="#e9e4ef" strokeWidth="5" fill="none"/><circle cx="20" cy="20" r="15" stroke="#9c85cd" strokeWidth="5" fill="none" strokeDasharray={`${94.248*count/subtasks.length} 94.248`} transform="rotate(-90 20 20)"/></svg>}
            </div>;
          })}
        </section>
        {!collapsedToday.tasks && <p className="hint">
          미완료 투두는 다음 날에도 표시돼. 완료한 일은 아래에 모아 보여줘. 원래 날짜와 시간은 보존해.
        </p>}
        <div className={`today-fold-wrapper ${collapsedToday.study?"is-folded":""}`} onClickCapture={e=>{if(e.target.closest("h1")){e.stopPropagation();toggleTodaySection("study")}}}>
        <LinkedActivities
          source="study" client={bridgeClient} userId={bridgeUserId} today={today}
          checks={data.activityChecks || {}}
          onCheck={(key, done, pinOrder, subChecks) => setData(d=>({...d, activityChecks:{...(d.activityChecks||{}),[key]:{...(d.activityChecks?.[key]||{}),done,...(pinOrder!==undefined?{pinOrder}:{}),...(subChecks!==undefined?{subChecks}:{})}}}))}
        />
        </div>
        <div className={`today-fold-wrapper ${collapsedToday.workout?"is-folded":""}`} onClickCapture={e=>{if(e.target.closest("h1")){e.stopPropagation();toggleTodaySection("workout")}}}>
        <HomeWorkouts
          client={bridgeClient}
          userId={bridgeUserId}
          today={today}
          checks={data.homeWorkoutChecks || {}}
          onCheck={(key, done, pinOrder, subChecks) => setData(d=>({...d, homeWorkoutChecks:{...(d.homeWorkoutChecks||{}),[key]:{...(d.homeWorkoutChecks?.[key]||{}),done,...(pinOrder!==undefined?{pinOrder}:{}),...(subChecks!==undefined?{subChecks}:{})}}}))}
        />
        </div>
        <div className={`today-fold-wrapper ${collapsedToday.mind?"is-folded":""}`} onClickCapture={e=>{if(e.target.closest("h1")){e.stopPropagation();toggleTodaySection("mind")}}}>
        <LinkedActivities
          source="mind" client={bridgeClient} userId={bridgeUserId} today={today}
          checks={data.activityChecks || {}}
          onCheck={(key, done, pinOrder, subChecks) => setData(d=>({...d, activityChecks:{...(d.activityChecks||{}),[key]:{...(d.activityChecks?.[key]||{}),done,...(pinOrder!==undefined?{pinOrder}:{}),...(subChecks!==undefined?{subChecks}:{})}}}))}
        />
        </div>
      </>
    );
  }
  function CalendarChecklist({date}) {
    const categories=["오늘의 할 일","공부","운동","명상"];
    const tasks=dateItems(date);
    const category=t=>{const name=((taskProject(t)?.name||"")+" "+t.title).toLowerCase();if(/명상|호흡|만트라/.test(name))return "명상";if(/운동|헬스|근력|스트레칭|요가|필라테스/.test(name))return "운동";if(/공부|암기|논점|학습|중국어|독서/.test(name))return "공부";return "오늘의 할 일"};
    return <div className="day-checklists">{categories.map(group=>{
      const local=tasks.filter(t=>category(t)===group);
      return <section key={group} style={{padding:"10px 0",borderBottom:"1px solid #f0ebf4"}}>
        {group === "오늘의 할 일" && <h3 style={{fontSize:14,margin:"4px 0 8px",display:"flex",gap:8,alignItems:"baseline"}}>{group}<ProgressBadge done={local.filter(t=>t.status==="done").length} total={local.length}/></h3>}
        {local.map(t=>{
          const subs=Array.isArray(t.subtasks)?t.subtasks:[];
          const complete=t.status==="done";
          return <div key={t.id} style={{padding:"8px 0",color:complete?"#aaa":"#574b65"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <input type="checkbox" aria-label={`${t.title} 완료`} checked={complete} onChange={e=>completeOrStatus(t,e.target.checked?"done":"todo")}/>
              <span style={{textDecoration:complete?"line-through":"none",flex:1,minWidth:0,overflowWrap:"anywhere"}}>{t.title}</span>
              <span style={{display:"inline-flex",alignItems:"center",gap:6}}><TaskEstimate count={t.estimatedPomodoros}/><small>{t.time||""}</small></span>
            </div>
            {subs.length>0&&<div style={{padding:"6px 0 2px 40px",display:"grid",gap:7}}>
              <span style={{fontSize:11,color:"#9484a5"}}>{subs.filter(s=>s.done).length}/{subs.length} 완료</span>
              {subs.map((sub,i)=><label key={sub.id??i} style={{display:"flex",alignItems:"center",gap:9,fontSize:13,color:sub.done?"#aaa":"#574b65"}}>
                <input type="checkbox" checked={!!sub.done} onChange={e=>changeTask(t.id,{subtasks:subs.map((s,j)=>(sub.id!=null?s.id===sub.id:j===i)?{...s,done:e.target.checked}:s)})}/>
                <span style={{textDecoration:sub.done?"line-through":"none"}}>{sub.text}</span>
              </label>)}
            </div>}
          </div>;
        })}
        {group === "오늘의 할 일" && local.length===0 && <span style={{fontSize:12,color:"#aaa"}}>일정 없음</span>}
        {group!=="오늘의 할 일"&&<CalendarExternal heading={group} localTotal={local.length} localDone={local.filter(t=>t.status==="done").length} source={group==="공부"?"study":group==="운동"?"workout":"mind"} date={date} client={bridgeClient} userId={bridgeUserId} checks={group==="운동"?(data.homeWorkoutChecks||{}):(data.activityChecks||{})} onCheck={(key,done,pinOrder,subChecks)=>update(d=>{
          const field=group==="운동"?"homeWorkoutChecks":"activityChecks";
          const prev=d[field]?.[key]||{};
          return {...d,[field]:{...(d[field]||{}),[key]:{...prev,done,...(pinOrder!==undefined?{pinOrder}:{}),...(subChecks!==undefined?{subChecks}:{})}}};
        })}/>}
      </section>;
    })}</div>;
  }
  function Calendar() {
    const base = new Date(focusDate + "T12:00:00"),
      day = base.getDay(),
      first = localDate(new Date(base.getFullYear(), base.getMonth(), 1));
    const start =
      calendarView === "month"
        ? dayAdd(first, -new Date(first + "T12:00:00").getDay())
        : calendarView === "week"
          ? dayAdd(focusDate, -day)
          : focusDate;
    const length =
      calendarView === "month"
        ? 42
        : calendarView === "week"
          ? 7
          : calendarView === "three"
            ? 3
            : 1;
    const days = Array.from({ length }, (_, i) => dayAdd(start, i));
    const jump = (n) =>
      setFocusDate(
        calendarView === "month"
          ? localDate(
              new Date(
                base.getFullYear(),
                base.getMonth() + n,
                Math.min(base.getDate(), 28),
              ),
            )
          : dayAdd(
              focusDate,
              n *
                (calendarView === "week"
                  ? 7
                  : calendarView === "three"
                    ? 3
                    : 1),
            ),
      );
    return (
      <>
        <div className="section-top">
          <div>
            <div className="eyebrow">프로젝트별 색상으로 일정 구분</div>
            <h1>캘린더</h1>
          </div>
          <button className="primary small" onClick={() => setModal("task")}>
            <Plus size={16} /> 일정
          </button>
        </div>
        <div className="views">
          {[
            ["month", "월간"],
            ["week", "주간"],
            ["three", "3일"],
            ["day", "1일"],
          ].map(([id, name]) => (
            <button
              key={id}
              className={calendarView === id ? "selected" : ""}
              onClick={() => setCalendarView(id)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="calendar-nav">
          <button onClick={() => jump(-1)}>
            <ChevronLeft size={19} />
          </button>
          <strong>
            {calendarView === "month"
              ? `${base.getFullYear()}년 ${base.getMonth() + 1}월`
              : `${focusDate.replaceAll("-", ".")}부터`}
          </strong>
          <button onClick={() => jump(1)}>
            <ChevronRight size={19} />
          </button>
          <button className="today-btn" onClick={() => setFocusDate(today)}>
            오늘
          </button>
        </div>
        {calendarView === "month" ? (
          <>
            <div className="month-grid weekday">
              {"일월화수목금토".split("").map((x) => (
                <div key={x}>{x}</div>
              ))}
            </div>
            <div className="month-grid days">
              {days.map((date) => {
                let items = dateItems(date);
                return (
                  <button
                    key={date}
                    className={
                      "day-cell " +
                      (date.slice(0, 7) !== focusDate.slice(0, 7)
                        ? "muted "
                        : "") +
                      (date === focusDate ? "active" : "")
                    }
                    onClick={() => setFocusDate(date)}
                  >
                    <span className={date === today ? "today-round" : ""}>
                      {Number(date.slice(8))}
                    </span>
                    <div className="dots">
                      {items.slice(0, 5).map((t) => (
                        <i
                          key={t.id}
                          style={{
                            background: taskProject(t)?.color || "#aaa",
                          }}
                        />
                      ))}
                      {items.length > 5 && (
                        <span className="calendar-extra-count" aria-label={`추가 일정 ${items.length - 5}개`}>
                          +{items.length - 5}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="selected-day-agenda">
              <h2>{focusDate} 일정</h2>
              {CalendarChecklist({date:focusDate})}
            </div>
          </>
        ) : (
          <div className="agenda">
            {days.map((date) => (
              <div className="agenda-day" key={date}>
                <div className="agenda-day-head">
                  {new Date(date + "T12:00:00").toLocaleDateString("ko-KR", {
                    month: "short",
                    day: "numeric",
                    weekday: "short",
                  })}{" "}
                  {date === today && <span className="tiny-tag">오늘</span>}
                </div>
                <div className="agenda-items">
                  {CalendarChecklist({date})}

                </div>
              </div>
            ))}
          </div>
        )}
        <div className="legend">
          {data.projects.map((p) => (
            <span key={p.id}>
              <i style={{ background: p.color }} />
              {p.name}
            </span>
          ))}
          <span>
            <i style={{ background: "#b8b3bf" }} />
            개인 일정
          </span>
        </div>
      </>
    );
  }
  function Projects() {
    const selected = project(selectedProject),
      items = data.tasks.filter((t) => t.projectId === selectedProject).sort((a,b)=>{
        const ap=Number.isFinite(a.pinOrder),bp=Number.isFinite(b.pinOrder);
        if(ap!==bp)return ap?-1:1;
        if(ap && bp)return a.pinOrder-b.pinOrder;
        return projectSort === "manual"
          ? (a.order??0)-(b.order??0)||(a.due||"9999").localeCompare(b.due||"9999")||(a.time||"").localeCompare(b.time||"")
          : projectSortCompare(a,b);
      }),
      pending = items.filter((t) => t.status !== "done"),
      done = items.filter((t) => t.status === "done");
    const renderItem = (t) => (
      <div key={t.id} className="project-item-wrap" data-project-task-id={t.id}
        onPointerDown={e => { if(!e.target.closest('button,input,a,select')) beginPinHold(e,t.id); }}
        onPointerMove={trackPinHold}
        onPointerUp={clearPinHold}
        onPointerCancel={clearPinHold}
        onContextMenu={e => { e.preventDefault(); clearPinHold(); setPinMenuId(t.id); }}
        onSelectStart={e => e.preventDefault()}
        onDragStart={e => e.preventDefault()}
        style={{WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none',touchAction:'pan-y'}}>
        <div className="project-list-item compact-project-row">
          <div className="list-middle" onClick={() => {if(pinMenuId!==t.id)setEditing(t.id)}} style={{WebkitUserSelect:'none',userSelect:'none',WebkitTouchCallout:'none'}}>
            <strong className={t.status === "done" ? "struck" : ""}>
              {Number.isFinite(t.pinOrder) ? '⭐ ' : ''}{t.title}
            </strong>
            <small>
              {t.due
                ? `${t.due}${t.time ? " · " + t.time : ""}`
                : "날짜 미설정"}
            </small>
          </div>
          <div onClick={() => setEditing(t.id)} style={{ cursor: "pointer" }}>
            <TaskEstimate count={t.estimatedPomodoros} />
          </div>
          <ChevronRight
            size={17}
            color="#b8b0be"
            onClick={() => setEditing(t.id)}
          />
        </div>
        {pinMenuId === t.id && (
          <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:8,padding:'8px 12px',background:'#f7f2ff'}}>
            <button type="button" onClick={e=>{e.stopPropagation();togglePin(t)}} style={{padding:'10px 14px',borderRadius:10,background:'#fff',color:'#8061b6',fontWeight:700}}>
              {Number.isFinite(t.pinOrder) ? '☆ 고정 해제' : '⭐ 맨 위에 고정'}
            </button>
            <button type="button" onClick={e=>{e.stopPropagation();setPinMenuId(null)}} style={{padding:'10px',color:'#8a8195'}}>닫기</button>
          </div>
        )}
        {t.subtasks.length > 0 && (
          <div className="inline-subtasks">
            {t.subtasks.map((sub) => (
              <label key={sub.id} className="inline-subtask">
                <input
                  type="checkbox"
                  checked={sub.done}
                  onChange={(e) =>
                    changeTask(t.id, {
                      subtasks: t.subtasks.map((x) =>
                        x.id === sub.id ? { ...x, done: e.target.checked } : x,
                      ),
                    })
                  }
                />
                <span className={sub.done ? "struck" : ""}>{sub.text}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
    return (
      <>
        <div className="section-top">
          <div>
            <h1>프로젝트</h1>
          </div>
          <button className="primary small" onClick={() => setModal("project")}>
            <Plus size={16} /> 목록
          </button>
        </div>
        <label className="project-select-label">
          프로젝트 목록
          <select
            className="select-full"
            value={selected?.id || ""}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <div className="project-summary">
            <div>
              <h2>
                <i
                  className="project-color-swatch"
                  style={{ background: selected.color }}
                />
                {selected.name}
              </h2>
              <p>
                {done.length}/{items.length}개 완료
              </p>
            </div>
            <button type="button" className="secondary" onClick={renameSelectedProject} aria-label="선택 프로젝트 이름 수정" style={{marginLeft:"auto",padding:"6px",minWidth:34,minHeight:34,color:"#8d6dce"}}><Pencil size={16}/></button>
            <button type="button" className="secondary" onClick={deleteSelectedProject} aria-label="선택 프로젝트 삭제" style={{padding:"6px",minWidth:34,minHeight:34,color:"#bf667c"}}><Trash2 size={16}/></button>
            <button
              className="secondary add-only project-add-compact"
              aria-label="투두 추가"
              onClick={() => {
                setEditing(null);
                setModal("task");
              }}
            >
              <Plus size={17} />
            </button>
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:8,margin:"12px 0 8px"}}>
          <label htmlFor="project-task-sort" style={{fontSize:12,color:"#8b7b9d"}}>정렬하기</label>
          <select id="project-task-sort" aria-label="프로젝트 할 일 정렬" value={projectSort} onChange={e=>setProjectSort(e.target.value)} style={{maxWidth:"72%",padding:"9px 12px",border:"1px solid #e4daee",borderRadius:10,background:"white",color:"#6f568e"}}>
            <option value="earliest">↑ 가까운 일정부터</option>
            <option value="latest">↓ 먼 일정부터</option>
          </select>
        </div>
        <div className="project-task-list">
          {pending.map(renderItem)}
          {pending.length === 0 && (
            <div className="empty-panel">남은 할 일이 없어.</div>
          )}
        </div>
        <button
          className="completed-toggle"
          onClick={() => setShowDone((v) => !v)}
        >
          <ChevronDown
            size={17}
            style={{ transform: showDone ? "rotate(180deg)" : "none" }}
          />
          완료된 할 일 ({done.length})
        </button>
        {showDone && (
          <div className="project-task-list completed-list">
            {done.map(renderItem)}
            {done.length === 0 && (
              <div className="empty-panel">완료한 일이 없어.</div>
            )}
          </div>
        )}
      </>
    );
  }
  function Pomodoro() {
    const sessionsToday = data.sessions.filter(
      (s) => localDate(new Date(s.endedAt)) === today,
    );
    return (
      <>
        <div className="section-top">
          <div>
            <div className="eyebrow">투두와 연결되는 집중 기록</div>
            <h1>뽀모도로</h1>
          </div>
        </div>
        <div className="pom-subnav">
          <button
            className={pomView === "timer" ? "active" : ""}
            onClick={() => setPomView("timer")}
          >
            타이머
          </button>
          <button
            className={pomView === "stats" ? "active" : ""}
            onClick={() => setPomView("stats")}
          >
            통계
          </button>
        </div>
        {pomView === "stats" ? (
          PomStats()
        ) : (
          <>
            <div className="pom-panel">
              <div className="label">집중할 오늘의 할 일</div>
              <select
                className="select-full"
                disabled={running}
                value={pomTask}
                onChange={(e) => setPomTask(e.target.value)}
              >
                <option value="">할 일 선택 (선택 사항)</option>
                {todayNotDone.map((t) => (
                  <option key={t.id} value={t.id}>
                    {taskProject(t)?.name || "개인"} · {t.title}
                  </option>
                ))}
              </select>
              <div className="mode-switch">
                <button
                  className={mode === "focus" ? "active" : ""}
                  onClick={() => resetTimer("focus")}
                >
                  집중 {customFocusMinutes}분
                </button>
                <button
                  className={mode === "break" ? "active" : ""}
                  onClick={() => resetTimer("break")}
                >
                  휴식 5분
                </button>
              </div>
              <div className="timer-circle" role="slider" aria-label="집중 시간 (원형 다이얼)" aria-valuemin={0} aria-valuemax={60} aria-valuenow={customFocusMinutes} tabIndex={mode === "focus" && !running ? 0 : -1} onKeyDown={(e) => {if(running || mode !== "focus")return;if(e.key === "ArrowRight" || e.key === "ArrowUp"){e.preventDefault();changeFocusMinutes(customFocusMinutes+1);}if(e.key === "ArrowLeft" || e.key === "ArrowDown"){e.preventDefault();changeFocusMinutes(customFocusMinutes-1);}}} style={{position:"relative",touchAction:"none",background:`conic-gradient(from 0deg,#aa8fd9 0deg ${Math.max(0,Math.min(360,seconds/3600*360))}deg,#eae2f5 ${Math.max(0,Math.min(360,seconds/3600*360))}deg 360deg)`}} onPointerDown={dialStart} onPointerMove={dialMove} onPointerUp={dialEnd} onPointerCancel={dialEnd} onLostPointerCapture={dialEnd}>
                <div className="timer-mode">
                  {mode === "focus" ? "FOCUS TIME" : "BREAK TIME"}
                </div>
                <div className="timer-digits">
                  {pad(Math.floor(seconds / 60))}:{pad(seconds % 60)}
                </div>

              </div>
              <label className="tick-option">
                <span>집중 종료 알림 <small>집중이 끝나면 땡~</small></span>
                <input
                  type="checkbox"
                  checked={alarmEnabled}
                  onChange={e => setAlarmEnabled(e.target.checked)}
                  aria-label="집중 종료 알림 켜기"
                />
                <span className="tick-toggle" aria-hidden="true" />
              </label>
              <label className="tick-option">
                <span>
                  시계 초침 소리 <small>집중하는 동안 째깍째깍</small>
                </span>
                <input
                  type="checkbox"
                  checked={tickSound}
                  onChange={(e) => {
                    setTickSound(e.target.checked);
                    if (e.target.checked) {
                      activateAudio().catch(reportAudioError);
                    }
                  }}
                  aria-label="시계 소리 켜기"
                />
                <span className="tick-toggle" aria-hidden="true" />
              </label>
              <div className="tick-type-row">
                <label htmlFor="tick-type">초침 종류</label>
                <select
                  id="tick-type"
                  value={tickType}
                  onChange={(e) => setTickType(e.target.value)}
                >
                  {Object.entries(CLOCK_SOUNDS).map(([id, sound]) => (
                    <option key={id} value={id}>
                      {sound.label}
                    </option>
                  ))}
                </select>
                <button onClick={previewClock}>미리 듣기</button>
              </div>
              <div style={{ width: "100%", marginTop: 12 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={testSound}
                  aria-label="소리 테스트"
                >
                  🔊 소리 테스트
                </button>
                {audioStatus && (
                  <p
                    className="hint"
                    role="status"
                    style={{ margin: "8px 0 0" }}
                  >
                    {audioStatus}
                  </p>
                )}
              </div>


              <div className="timer-actions">
                <button
                  className="reset"
                  onClick={() => resetTimer()}
                  aria-label="초기화"
                >
                  <RotateCcw size={20} />
                </button>
                <button
                  className="primary start"
                  onClick={() => {
                    if (!running && mode === "focus" && seconds === 0) { setToast("집중 시간을 1분 이상 설정해 줘."); return; }
                    if (!running) {
                      activateAudio().catch(reportAudioError);
                    } else if (endAt.current !== null) {
                      setSeconds(
                        Math.max(
                          0,
                          Math.ceil((endAt.current - Date.now()) / 1000),
                        ),
                      );
                      endAt.current = null;
                    }
                    setRunning((v) => !v);
                  }}
                >
                  {running ? (
                    <Pause size={18} fill="currentColor" />
                  ) : (
                    <Play size={18} fill="currentColor" />
                  )}
                  {running ? "일시정지" : "시작"}
                </button>
                <button
                  className="stop-btn"
                  onClick={() => {const left=running&&endAt.current?Math.max(0,Math.ceil((endAt.current-Date.now())/1000)):seconds;const elapsed=Math.max(0,customFocusMinutes*60-left);if(mode==="focus"&&elapsed>=60){update(d=>({...d,sessions:[...(d.sessions||[]),{id:uid(),taskId:pomTask||null,minutes:Number((elapsed/60).toFixed(2)),endedAt:new Date().toISOString(),partial:true}]}));setToast("진행한 집중 시간을 기록했어.");}resetTimer(mode)}}
                  aria-label="정지"
                >
                  <Square size={18} /> 정지
                </button>
              </div>
            </div>
            <div className="session-summary">
              <h2>오늘의 집중</h2>
              <div>
                <span>
                  <b>{sessionsToday.length}</b> 회
                </span>
                <span>
                  <b>
                    {sessionsToday.reduce(
                      (a, s) => a + (Number(s.minutes) || 0),
                      0,
                    )}
                  </b>{" "}
                  분
                </span>
              </div>
              {sessionsToday
                .slice()
                .reverse()
                .map((s) => (
                  <p key={s.id}>
                    ✓{" "}
                    {data.tasks.find((t) => t.id === s.taskId)?.title || "집중"}{" "}
                    · {s.minutes}분
                  </p>
                ))}
            </div>
          </>
        )}
      </>
    );
  }
  function PomStats() {
    const sessions = data.sessions || [],
      total = sessions.reduce((n, s) => n + (Number(s.minutes) || 0), 0),
      weekStart = dayAdd(today, -6),
      week = sessions.filter(
        (s) =>
          localDate(new Date(s.endedAt)) >= weekStart &&
          localDate(new Date(s.endedAt)) <= today,
      ),
      todayMinutes = sessionsTodayMinutes(),
      monthStart = statMonth + "-01",
      first = new Date(monthStart + "T12:00:00"),
      offset = (first.getDay() + 6) % 7,
      numDays = new Date(
        first.getFullYear(),
        first.getMonth() + 1,
        0,
      ).getDate(),
      calendar = [
        ...Array(offset).fill(null),
        ...Array.from(
          { length: numDays },
          (_, i) => statMonth + "-" + pad(i + 1),
        ),
      ],
      daily = (d) =>
        sessions
          .filter((s) => localDate(new Date(s.endedAt)) === d)
          .reduce((n, s) => n + (Number(s.minutes) || 0), 0),
      days = Array.from(
        {
          length:
            statView === "daily"
              ? 7
              : statView === "weekly"
                ? 7
                : statView === "monthly"
                  ? 6
                  : 12,
        },
        (_, i) => {
          if (statView === "daily") {
            const date = dayAdd(today, i - 6);
            return { label: date.slice(5), minutes: daily(date) };
          }
          if (statView === "weekly") {
            const end = dayAdd(today, -(6 - i) * 7),
              start = dayAdd(end, -6);
            return {
              label: start.slice(5) + "~" + end.slice(5),
              minutes: sessions
                .filter((s) => {
                  const d = localDate(new Date(s.endedAt));
                  return d >= start && d <= end;
                })
                .reduce((n, s) => n + (Number(s.minutes) || 0), 0),
            };
          }
          if (statView === "yearly") {
            const year = Number(today.slice(0, 4)) - 11 + i;
            return {
              label: String(year),
              minutes: sessions
                .filter((s) => new Date(s.endedAt).getFullYear() === year)
                .reduce((n, s) => n + (Number(s.minutes) || 0), 0),
            };
          }
          const date = new Date(
              Number(today.slice(0, 4)),
              Number(today.slice(5, 7)) -
                (statView === "monthly" ? 5 - i : 11 - i),
              1,
            ),
            month = localDate(date).slice(0, 7);
          return {
            label: month.slice(2),
            minutes: sessions
              .filter((s) => localDate(new Date(s.endedAt)).startsWith(month))
              .reduce((n, s) => n + (Number(s.minutes) || 0), 0),
          };
        },
      ),
      max = Math.max(goalHours * 60, 1, ...days.map((d) => d.minutes)),
      achieved = calendar.filter((d) => d && daily(d) >= goalHours * 60).length;
    function sessionsTodayMinutes() {
      return sessions
        .filter((s) => localDate(new Date(s.endedAt)) === today)
        .reduce((n, s) => n + (Number(s.minutes) || 0), 0);
    }
    return (
      <div className="pom-stat-page">
        <div className="stat-card">
          <h2>집중 요약</h2>
          <div className="stat-metrics">
            <div>
              <b>{(total / 60).toFixed(1)}</b>
              <small>총 집중 시간(h)</small>
            </div>
            <div>
              <b>
                {(
                  week.reduce((n, s) => n + (Number(s.minutes) || 0), 0) / 60
                ).toFixed(1)}
              </b>
              <small>최근 7일(h)</small>
            </div>
            <div>
              <b>{(todayMinutes / 60).toFixed(1)}</b>
              <small>오늘(h)</small>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-title">
            <h2>뽀모도로 기록</h2>
            <small>{sessions.length}회 기록</small>
          </div>
          <div className="stat-bars">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="stat-hour">
                <span>{pad(h)}:00</span>
                <div>
                  {sessions
                    .filter(
                      (s) =>
                        new Date(s.endedAt).getHours() === h &&
                        localDate(new Date(s.endedAt)) === today,
                    )
                    .map((s) => (
                      <i
                        key={s.id}
                        title={`${s.minutes}분`}
                        style={{
                          width: Math.min(100, (s.minutes / 60) * 100) + "%",
                        }}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-title">
            <h2>일일 집중 목표</h2>
            <button
              className="goal-button"
              onClick={() => {
                const value = window.prompt(
                  "하루 집중 목표 (시간)",
                  String(goalHours),
                );
                if (value !== null && Number(value) > 0 && Number(value) <= 24)
                  setGoalHours(Number(value));
              }}
            >
              목표: {goalHours}시간
            </button>
          </div>
          <p className="stat-sub">목표 달성: {achieved}일 · 선택 월 기준</p>
          <div className="stat-month-nav">
            <button
              onClick={() =>
                setStatMonth(
                  localDate(
                    new Date(
                      Number(statMonth.slice(0, 4)),
                      Number(statMonth.slice(5, 7)) - 2,
                      1,
                    ),
                  ).slice(0, 7),
                )
              }
            >
              ‹
            </button>
            <strong>{statMonth.replace("-", "년 ")}월</strong>
            <button
              onClick={() =>
                setStatMonth(
                  localDate(
                    new Date(
                      Number(statMonth.slice(0, 4)),
                      Number(statMonth.slice(5, 7)),
                      1,
                    ),
                  ).slice(0, 7),
                )
              }
            >
              ›
            </button>
          </div>
          <div className="stat-calendar">
            {["월", "화", "수", "목", "금", "토", "일"].map((x) => (
              <b key={x}>{x}</b>
            ))}
            {calendar.map((d, i) => (
              <div
                key={i}
                className={d && daily(d) >= goalHours * 60 ? "goal-done" : ""}
              >
                {d ? Number(d.slice(-2)) : ""}
                {d && daily(d) > 0 && <span>●</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="stat-card"><h2>카테고리 분석</h2><div className="stat-switch">{[["daily","일별"],["weekly","주별"],["monthly","월별"]].map(([id,label])=><button key={id} className={analysisPeriod===id?"active":""} onClick={()=>setAnalysisPeriod(id)}>{label}</button>)}</div>{(()=>{const sums=new Map();const from=analysisPeriod==="daily"?today:analysisPeriod==="weekly"?dayAdd(today,-6):today.slice(0,7)+"-01";for(const record of sessions){const date=localDate(new Date(record.endedAt));if(date<from||date>today)continue;const task=data.tasks.find(t=>t.id===record.taskId);const name=project(record.projectId||task?.projectId)?.name||"미분류";sums.set(name,(sums.get(name)||0)+(Number(record.minutes)||0))}return [...sums].length?[...sums].sort((a,b)=>b[1]-a[1]).map(([name,value])=><p key={name} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #f0ebf4"}}><span>{name}</span><b>{Number(value.toFixed(1))}분</b></p>):<p className="hint">해당 기간에 집중 기록이 없어.</p>})()}</div>
        <div className="stat-card">
          <h2>집중 시간</h2>
          <div className="stat-switch">
            {[
              ["daily", "일일"],
              ["weekly", "주간"],
              ["monthly", "월간"],
              ["yearly", "연간"],
            ].map(([v, label]) => (
              <button
                key={v}
                className={statView === v ? "active" : ""}
                onClick={() => setStatView(v)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="stat-chart">
            {days.map((d, i) => (
              <div className="stat-col" key={i}>
                <div className="stat-bar-area">
                  <div
                    style={{
                      height:
                        Math.max(d.minutes ? 3 : 0, (100 * d.minutes) / max) +
                        "%",
                    }}
                  />
                </div>
                <small>{d.label}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  // Standalone daily time blocks, stored through the existing Focus Flow sync.
  const timeBlocks = Array.isArray(data.timeBlocks) ? data.timeBlocks : [];
  const changeBlockDate = (delta) => {
    setBlockDate(d => dayAdd(d, delta));
    setBlockFirst(null);
    setBlockRange(null);
  };
  const openBlock = (block) => {
    setBlockFirst(null);
    setBlockRange({start:block.start,end:block.end});
    setBlockEditing(block.id);
    setBlockDraft(block.title);
  };
  const selectBlockHour = (hour) => {
    const sleep = blockMode === "actual" ? (data.timeBlockSleepActual?.[blockDate] || {start:22,end:6}) : {start:22,end:6};
    const asleep = h => sleep.start > sleep.end ? (h >= sleep.start || h < sleep.end) : (h >= sleep.start && h < sleep.end);
    if (asleep(hour)) {
      if (blockMode === "actual") { setSleepDraftStart(`${pad(sleep.start)}:00`); setSleepDraftEnd(`${pad(sleep.end)}:00`); setSleepEditing(true); }
      return;
    }
    const current = timeBlocks.find(b => b.date === blockDate && (b.mode || "plan") === blockMode && hour >= b.start && hour < b.end);
    if (current) { openBlock(current); return; }
    if (blockFirst === null) {
      setBlockFirst(hour);
      setBlockRange({start:hour,end:hour+1});
    } else {
      const start = Math.min(blockFirst, hour);
      const end = Math.max(blockFirst, hour) + 1;
      const conflicts = Array.from({length:end-start},(_,i)=>start+i).some(asleep) || timeBlocks.some(b => b.date === blockDate && (b.mode || "plan") === blockMode && b.start < end && start < b.end);
      if (!conflicts) setBlockRange({start,end});
      setBlockFirst(null);
    }
  };
  const saveTimeBlock = () => {
    const title = blockDraft.trim();
    if (!title || !blockRange) return;
    setData(d => ({...d, timeBlocks:[...(Array.isArray(d.timeBlocks)?d.timeBlocks:[]).filter(b=>b.id!==blockEditing),
      {id:blockEditing === "new" ? uid() : blockEditing,date:blockDate,mode:blockMode,start:blockRange.start,end:blockRange.end,title}]}));
    setBlockRange(null);setBlockFirst(null);setBlockEditing(null);setBlockDraft("");
  };
  function TimeBlocks() {
    const blocks = timeBlocks.filter(b=>b.date===blockDate && (b.mode || "plan") === blockMode).sort((a,b)=>a.start-b.start);
    const day = new Date(blockDate+"T12:00:00");
    const sleep = blockMode === "actual" ? (data.timeBlockSleepActual?.[blockDate] || {start:22,end:6}) : {start:22,end:6};
    const isSleep = h => sleep.start > sleep.end ? (h >= sleep.start || h < sleep.end) : (h >= sleep.start && h < sleep.end);
    // 06:00–22:00 is the 16-hour planning window. Count overlaps once.
    const occupiedHours = new Set();
    for (const b of blocks) {
      const start = Number(b.start), end = Number(b.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      for (let h = Math.max(6, Math.floor(start)); h < Math.min(22, Math.ceil(end)); h++) {
        if (!isSleep(h)) occupiedHours.add(h);
      }
    }
    const available = Array.from({length:16},(_,i)=>i+6).filter(h=>!isSleep(h)).length;
    const allocated = occupiedHours.size;
    return <section className={`timeblock-page mode-${blockMode}`}>
      <div className="timeblock-head">
        <button aria-label="이전 날짜" onClick={()=>changeBlockDate(-1)}><ChevronLeft size={23}/></button>
        <div className="timeblock-date">{day.getMonth()+1}월 {day.getDate()}일 {"일월화수목금토"[day.getDay()]}요일</div>
        <button aria-label="다음 날짜" onClick={()=>changeBlockDate(1)}><ChevronRight size={23}/></button>
        <button className="timeblock-today" onClick={()=>{setBlockDate(localDate());setBlockFirst(null);setBlockRange(null)}}>오늘</button>
      </div>
      <h1>타임블록</h1>
      <div className="timeblock-switch" role="tablist" aria-label="계획과 실제">
        <button type="button" role="tab" aria-selected={blockMode==="plan"} className={blockMode==="plan"?"active":""} onClick={()=>{setBlockMode("plan");setBlockFirst(null);setBlockRange(null);setBlockEditing(null)}}>계획</button>
        <button type="button" role="tab" aria-selected={blockMode==="actual"} className={blockMode==="actual"?"active":""} onClick={()=>{setBlockMode("actual");setBlockFirst(null);setBlockRange(null);setBlockEditing(null)}}>실제</button>
      </div>
      <p className="timeblock-allocation" aria-live="polite">기배정 {allocated}시간 <span aria-hidden="true">·</span> 미배정 {Math.max(0,available - allocated)}시간</p>
      <div className="timeblock-grid">
        {Array.from({length:24},(_,hour)=>{
          const sleeping = isSleep(hour);
          const block = sleeping ? null : blocks.find(b=>hour>=b.start&&hour<b.end);
          const isStart = block?.start===hour;
          const selected = !sleeping && blockRange && !blockEditing && hour>=blockRange.start&&hour<blockRange.end;
          const sleepLabel = hour === sleep.start || hour === 0;
          return <button type="button" key={hour} className={`timeblock-hour ${sleeping?'sleeping':''} ${block?'occupied':''} ${selected?'selected':''}`}
            aria-label={`${pad(hour)}시 ${sleeping?'수면':block?.title||'시간 선택'}`} onClick={()=>selectBlockHour(hour)}>
            <span className="timeblock-hourlabel">{pad(hour)}:00</span>
            <span className="timeblock-content">{sleeping && sleepLabel && <strong>☾ 수면 {pad(sleep.start)}:00–다음 날 {pad(sleep.end)}:00{blockMode==='actual'?' · 수정 가능':''}</strong>}{isStart && <strong>{block.title}</strong>}{selected && !block && <span>선택 중</span>}</span>
          </button>;
        })}
      </div>
      {sleepEditing && blockMode === 'actual' && <div className="timeblock-overlay" onClick={()=>setSleepEditing(false)}>
        <form className="timeblock-dialog" onClick={e=>e.stopPropagation()} onSubmit={e=>{
          e.preventDefault();
          const st=Number(sleepDraftStart.split(':')[0]), en=Number(sleepDraftEnd.split(':')[0]);
          if(!Number.isInteger(st)||!Number.isInteger(en)||st===en)return;
          setData(d=>({...d,timeBlockSleepActual:{...(d.timeBlockSleepActual||{}),[blockDate]:{start:st,end:en}}}));
          setSleepEditing(false);setBlockFirst(null);setBlockRange(null);
        }}>
          <h3>실제 수면 시간</h3>
          <p className="timeblock-sleep-help">시간 단위로 수정할 수 있어. 종료 시간은 다음 날 기준이야.</p>
          <div className="timeblock-sleep-inputs"><label>취침 <input type="time" step="3600" value={sleepDraftStart} onChange={e=>setSleepDraftStart(e.target.value)}/></label><label>기상 <input type="time" step="3600" value={sleepDraftEnd} onChange={e=>setSleepDraftEnd(e.target.value)}/></label></div>
          <div className="timeblock-actions"><button type="button" onClick={()=>{setData(d=>{const next={...(d.timeBlockSleepActual||{})};delete next[blockDate];return {...d,timeBlockSleepActual:next}});setSleepEditing(false)}}>기본 22–06으로</button><button type="button" onClick={()=>setSleepEditing(false)}>취소</button><button type="submit" className="timeblock-save">저장</button></div>
        </form>
      </div>}
      {blockRange && !blockEditing && <div className="timeblock-selection">
        <span>{pad(blockRange.start)}:00–{pad(blockRange.end)}:00</span>
        <button onClick={()=>{setBlockDraft("");setBlockEditing("new")}}>{blockMode==="plan"?"+ 계획 적기":"+ 실제 기록"}</button>
        <button onClick={()=>{setBlockRange(null);setBlockFirst(null)}}>취소</button>
      </div>}
      {blockEditing && blockRange && <div className="timeblock-overlay" onClick={()=>{setBlockEditing(null);setBlockRange(null);setBlockFirst(null)}}>
        <form className="timeblock-dialog" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();saveTimeBlock()}}>
          <h3>{pad(blockRange.start)}:00 – {pad(blockRange.end)}:00</h3>
          <input autoFocus maxLength={120} placeholder="무엇을 할까요?" value={blockDraft} onChange={e=>setBlockDraft(e.target.value)}/>
          <div className="timeblock-actions">
            {blockEditing!=="new"&&<button type="button" className="timeblock-delete" onClick={()=>{setData(d=>({...d,timeBlocks:(d.timeBlocks||[]).filter(b=>b.id!==blockEditing)}));setBlockEditing(null);setBlockRange(null)}}>삭제</button>}
            <button type="button" onClick={()=>{setBlockEditing(null);setBlockRange(null)}}>취소</button>
            <button type="submit" className="timeblock-save" disabled={!blockDraft.trim()}>저장</button>
          </div>
        </form>
      </div>}
    </section>;
  }
  const editTask = data.tasks.find((t) => t.id === editing);
  return (
    <div className="app">
      <header>
        <button
          type="button"
          className="brand"
          aria-label="Focus Flow · 오늘로 이동"
          onClick={() => setTab("today")}
          style={{ padding: 0, textAlign: "left" }}
        >
          <span className="brand-mark">✳</span> Focus Flow
        </button>
        <div className="header-actions">
          <button type="button" className={`header-timer ${tab === "pom" ? "is-active" : ""}`} onClick={() => setTab("pom")} aria-label="뽀모도로 열기" title="뽀모도로"><Timer size={20}/></button>
          <button className="header-pill" onClick={onLogout}>로그아웃</button>
        </div>
      </header>
      <main>
        {tab === "today"
          ? Kanban()
          : tab === "timeblocks"
            ? TimeBlocks()
          : tab === "calendar"
            ? Calendar()
            : tab === "pom"
              ? Pomodoro()
              : tab === "karma"
                ? KarmaPanel()
                : Projects()}
      </main>
      <nav className="bottom-nav">
        {[
          ["today", Columns3, "오늘"],
          ["timeblocks", Clock3, "타임블록"],
          ["projects", FolderKanban, "프로젝트"],
          ["calendar", CalendarDays, "일정"],
          ["karma", Heart, "카르마"],
        ].map(([id, Icon, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={tab === id ? "nav-active" : ""}
          >
            <Icon size={21} strokeWidth={tab === id ? 2.6 : 1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {modal === "task" && (
        <TaskModal
          projects={data.projects}
          preProject={tab === "projects" ? selectedProject : ""}
          onClose={() => setModal(null)}
          onSave={addTask}
        />
      )}
      {modal === "project" && (
        <ProjectModal
          onClose={() => setModal(null)}
          onSave={(p) => {
            const id = uid();
            update((d) => ({ ...d, projects: [...d.projects, { ...p, id }] }));
            setSelectedProject(id);
            setModal(null);
          }}
        />
      )}
      {editTask && (
        <EditTask
          key={editTask.id}
          task={editTask}
          projects={data.projects}
          onClose={() => setEditing(null)}
          onChange={(fields) => changeTask(editTask.id, fields)}
          onStatus={(s) => completeOrStatus(editTask, s)}
          onDelete={() => removeTask(editTask.id)}
          onFocus={() => {
            setPomTask(editTask.id);
            setEditing(null);
            setTab("pom");
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
function pomCount(value) {
  return Math.max(0, Math.min(5, Math.floor(Number(value) || 0)));
}
function PomClock({ filled = true, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 26"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect
        x="9"
        y="0"
        width="6"
        height="3"
        rx="1.5"
        fill={filled ? "#ed6978" : "#e6e3e9"}
      />
      <circle cx="12" cy="15" r="10" fill={filled ? "#ed6978" : "#e6e3e9"} />
      <path
        d="M12 9v6l3 3"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ProgressBadge({done = 0, total = 0}) {
  const pct = total ? Math.round(done / total * 100) : 0;
  return <span aria-label={`진행률 ${done}/${total}, ${pct}%`} style={{fontSize:11,color:"#9484a5",fontWeight:600,whiteSpace:"nowrap"}}>{done}/{total} · {pct}%</span>;
}
function TaskEstimate({ count }) {
  const n = pomCount(count);
  if (!n) return null;
  return (
    <div
      className="task-pom-estimate"
      aria-label={`예상 뽀모도로 ${n}회, ${n * 25}분`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 4,
        flexShrink: 0,
        maxWidth: 110,
      }}
    >
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: n }, (_, i) => (
          <PomClock key={i} size={15} />
        ))}
      </div>
    </div>
  );
}
function PomEstimatePicker({ value, onChange }) {
  const n = pomCount(value);
  return (
    <fieldset
      style={{ border: 0, padding: 0, margin: "5px 0 20px", minWidth: 0 }}
    >
      <legend
        style={{ fontSize: 12, fontWeight: 650, color: "#817689", padding: 0 }}
      >
        예상 뽀모도로 개수
      </legend>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 5,
          marginTop: 10,
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`예상 뽀모도로 ${i}회`}
            aria-pressed={i <= n}
            onClick={() => onChange(i === n ? 0 : i)}
            style={{
              display: "grid",
              placeItems: "center",
              minWidth: 40,
              minHeight: 44,
              padding: 5,
              borderRadius: 10,
            }}
          >
            <PomClock filled={i <= n} size={32} />
          </button>
        ))}
      </div>
      <div
        aria-live="polite"
        style={{ marginTop: 8, fontSize: 12, color: n ? "#ce6775" : "#a297aa" }}
      >
        {n ? `${n}회 · ${n * 25}분` : "선택 안 함 · 1회 25분"}
      </div>
    </fieldset>
  );
}
function TaskModal({ projects, preProject, onClose, onSave }) {
  const [title, setTitle] = useState(""),
    [projectId, setProjectId] = useState(preProject),
    [due, setDue] = useState(localDate()),
    [time, setTime] = useState(""),
    [estimatedPomodoros, setEstimatedPomodoros] = useState(0);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        className="sheet"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim())
            onSave({ title, projectId, due, time, estimatedPomodoros, tally:null,tallies:[] });
        }}
      >
        <div className="sheet-top">
          <h2>새 할 일</h2>
          <button type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <label>
          할 일 이름
          <input
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="무엇을 할까?"
          />
        </label>
        <label>
          프로젝트
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">개인 일정 (프로젝트 없음)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field-row">
          <label>
            날짜
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label>
            <span className="time-label-row">시간 (선택) <button type="button" aria-label="시간 초기화" title="시간 초기화" onClick={()=>setTime("")}>↺</button></span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        </div>
        <PomEstimatePicker
          value={estimatedPomodoros}
          onChange={setEstimatedPomodoros}
        />
        <button className="primary save" type="submit">
          추가하기
        </button>
      </form>
    </div>
  );
}
function ProjectModal({ onClose, onSave }) {
  const [name, setName] = useState(""),
    [color, setColor] = useState("#a897dd");
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        className="sheet"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave({ name: name.trim(), color });
        }}
      >
        <div className="sheet-top">
          <h2>새 프로젝트</h2>
          <button type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <label>
          프로젝트 이름
          <input
            autoFocus
            required
            placeholder="예: 중국어 공부"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          구분 색상
          <div className="colors">
            {[
              "#a897dd",
              "#b9a6e6",
              "#e1a0b8",
              "#e9b6c9",
              "#8dbfb4",
              "#a8d1c5",
              "#e5b174",
              "#efc998",
              "#8faedc",
              "#b0c5e8",
            ].map((c) => (
              <button
                type="button"
                aria-label={c}
                className={color === c ? "picked" : ""}
                style={{ background: c }}
                key={c}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <div className="custom-color">
            <span>사용자 지정</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="사용자 지정 색상"
            />
          </div>
        </label>
        <button className="primary save">프로젝트 추가</button>
      </form>
    </div>
  );
}
function EditTask({
  task,
  projects,
  onClose,
  onChange,
  onStatus,
  onDelete,
  onFocus,
}) {
  const [sub, setSub] = useState("");
  const addSub = (e) => {
    e.preventDefault();
    if (sub.trim()) {
      onChange({
        subtasks: [
          ...task.subtasks,
          { id: uid(), text: sub.trim(), done: false },
        ],
      });
      setSub("");
    }
  };
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sheet edit-sheet">
        <div className="sheet-top">
          <h2>할 일 상세</h2>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <label>
          제목
          <input
            value={task.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </label>
        <label>
          프로젝트
          <select
            value={task.projectId}
            onChange={(e) => onChange({ projectId: e.target.value })}
          >
            <option value="">개인 일정</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field-row">
          <label>
            날짜
            <input
              type="date"
              value={task.due}
              onChange={(e) => onChange({ due: e.target.value })}
            />
          </label>
          <label>
            <span className="time-label-row">시간 <button type="button" title="시간 초기화" aria-label="시간 초기화" onClick={()=>onChange({time:""})}>↺</button></span>
            <input
              type="time"
              value={task.time || ""}
              onChange={(e) => onChange({ time: e.target.value })}
            />
          </label>
        </div>
        <PomEstimatePicker
          value={task.estimatedPomodoros}
          onChange={(value) => onChange({ estimatedPomodoros: value })}
        />
        <label>
          진행 상태
          <select
            value={task.status}
            onChange={(e) => onStatus(e.target.value)}
          >
            <option value="todo">할 일</option>
            <option value="doing">진행 중</option>
            <option value="done">완료</option>
          </select>
        </label>
        <div className="subtask-title">
          서브태스크{" "}
          <span>
            {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
          </span>
        </div>
        <div className="subtask-list">
          {task.subtasks.map((s) => (
            <div key={s.id} className="subtask">
              <input
                type="checkbox"
                checked={s.done}
                onChange={(e) =>
                  onChange({
                    subtasks: task.subtasks.map((x) =>
                      x.id === s.id ? { ...x, done: e.target.checked } : x,
                    ),
                  })
                }
              />
              <span className={s.done ? "struck" : ""}>{s.text}</span>
              <button
                onClick={() =>
                  onChange({
                    subtasks: task.subtasks.filter((x) => x.id !== s.id),
                  })
                }
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
        <form className="add-sub" onSubmit={addSub}>
          <input
            value={sub}
            onChange={(e) => setSub(e.target.value)}
            placeholder="하위 작업 추가"
          />
          <button type="submit">
            <Plus size={18} />
          </button>
        </form>
        <div className="edit-actions">
          <button className="secondary" onClick={onFocus}>
            <Timer size={17} /> 집중하기
          </button>
          <button
            className="danger"
            onClick={() => {
              if (confirm("이 할 일을 삭제할까?")) onDelete();
            }}
          >
            <Trash2 size={17} /> 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
