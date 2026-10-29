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
  X,
  Check,
  Play,
  Pause,
  Square,
  RotateCcw,
} from "lucide-react";
import "./style.css";
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
export function App({ initialData, onDataChange, onLogout }) {
  const data = initialData,
    setData = onDataChange;
  const [tab, setTab] = useState("today"),
    [selectedProject, setSelectedProject] = useState("p1"),
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
  const endAt = useRef(null);
  const audioRef = useRef(null);
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
  const completeOrStatus = (task, status) =>
    changeTask(task.id, {
      status,
      completedAt: status === "done" ? new Date().toISOString() : null,
    });
  const removeTask = (id) => {
    update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
    setEditing(null);
  };
  const now = new Date(clockNow);
  const today = localDate(now);
  const timeText = (seconds) =>
    `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
  const remaining = (hour) => {
    const end = new Date(clockNow);
    end.setHours(hour, 0, 0, 0);
    return timeText(Math.max(0, Math.ceil((end.getTime() - clockNow) / 1000)));
  };
  const todayTasks = data.tasks
    .filter(
      (t) =>
        (t.status !== "done" && (!t.due || t.due <= today)) ||
        (t.status === "done" &&
          t.completedAt &&
          localDate(new Date(t.completedAt)) === today),
    )
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
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
    try {
      const ctx = audioRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      [0, 0.32, 0.64].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now + delay);
        osc.frequency.exponentialRampToValueAtTime(660, now + delay + 0.38);
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.18, now + delay + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.56);
      });
    } catch (e) {
      console.warn("알림음 재생 실패", e);
    }
  }
  function finishPom() {
    if (endAt.current === null) return;
    const finishedAt = endAt.current;
    ringBell();
    const { pomTask, mode, round } = latest.current;
    setRunning(false);
    endAt.current = null;
    if (mode === "focus") {
      update((d) => ({
        ...d,
        sessions: [
          ...(d.sessions || []),
          {
            id: uid(),
            taskId: pomTask || null,
            minutes: 25,
            endedAt: new Date(finishedAt).toISOString(),
          },
        ],
      }));
      setToast("집중 25분 완료! 기록에 저장했어.");
      setRound(round + 1);
      setMode("break");
      setSeconds((round + 1) % 4 === 0 ? 900 : 300);
    } else {
      setMode("focus");
      setSeconds(1500);
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
  const resetTimer = (m = mode) => {
    setRunning(false);
    endAt.current = null;
    setMode(m);
    setSeconds(m === "focus" ? 1500 : 300);
  };
  function dateItems(date) {
    return data.tasks.filter(
      (t) =>
        t.due === date ||
        (date === today && t.status !== "done" && t.due && t.due < today),
    );
  }
  function TaskCard({ task, compact = false }) {
    const p = taskProject(task),
      total = (task.subtasks || []).length,
      complete = (task.subtasks || []).filter((s) => s.done).length;
    return (
      <div
        className={"task-card " + (compact ? "compact" : "")}
        onClick={() => setEditing(task.id)}
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      >
        <div className="task-head">
          <span
            className="project-dot"
            style={{ background: p?.color || "#b8b3bf" }}
          />
          <span className="task-project">{p?.name || "개인 일정"}</span>
          {task.due && task.due < today && task.status !== "done" && (
            <span className="carry">자동 이월</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="task-title" style={{ flex: 1, minWidth: 0 }}>
            {task.title}
          </div>
          <TaskEstimate count={task.estimatedPomodoros} />
        </div>
        <div className="task-foot">
          <span>
            {task.due || "날짜 없음"}
            {task.time ? ` · ${task.time}` : ""}
          </span>
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
      </div>
    );
  }
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
            [
              "현재 시각",
              `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
            ],
            ["오전 타이머", remaining(12)],
            ["오후 타이머", remaining(18)],
            ["저녁 타이머", remaining(22)],
          ].map(([label, value], i) => (
            <div
              key={label}
              style={{
                padding: "15px 12px",
                borderRadius: 15,
                border: "1px solid #e9e1f0",
                background: i === 0 ? "#f3edf9" : "white",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#8b7b9c",
                  marginBottom: 7,
                  fontWeight: 650,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: "clamp(21px,6vw,30px)",
                  fontWeight: 750,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-.5px",
                  color: i === 0 ? "#7854ab" : "#53465f",
                  whiteSpace: "nowrap",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
        <div className="section-top">
          <div>
            <div className="eyebrow">
              {new Date().toLocaleDateString("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </div>
            <h1>오늘의 할 일</h1>
          </div>
          <button
            className="primary small"
            onClick={() => {
              setModal("task");
              setEditing(null);
            }}
          >
            <Plus size={16} /> 추가
          </button>
        </div>
        <div className="metrics">
          <span>
            전체 <b>{todayTasks.length}</b>
          </span>
          <span>
            완료 <b>{todayTasks.filter((t) => t.status === "done").length}</b>
          </span>
          <span>
            이월{" "}
            <b>{todayNotDone.filter((t) => t.due && t.due < today).length}</b>
          </span>
        </div>
        <div className="kanban">
          {[
            ["todo", "할 일"],
            ["doing", "진행 중"],
            ["done", "완료"],
          ].map(([key, label]) => (
            <div
              key={key}
              className="lane"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                const t = data.tasks.find((t) => t.id === id);
                if (t) completeOrStatus(t, key);
              }}
            >
              <div className={"lane-head " + key}>
                <span>{label}</span>
                <small>
                  {todayTasks.filter((t) => t.status === key).length}
                </small>
              </div>
              <div className="lane-content">
                {todayTasks
                  .filter((t) => t.status === key)
                  .map((t) => (
                    <TaskCard key={t.id} task={t} />
                  ))}
                {!todayTasks.some((t) => t.status === key) && (
                  <div className="empty-lane">여기로 카드를 끌어와</div>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="hint">
          미완료 투두는 다음 날 자동으로 오늘에 표시돼. 원래 날짜와 시간은
          보존해. 약속처럼 날짜가 중요한 일정은 자동으로 변경되지 않아.
        </p>
      </>
    );
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
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="selected-day-agenda">
              <h2>{focusDate} 일정</h2>
              {dateItems(focusDate).length ? (
                dateItems(focusDate).map((t) => (
                  <TaskCard key={t.id} task={t} compact />
                ))
              ) : (
                <p>등록된 일정이 없어.</p>
              )}
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
                  {dateItems(date)
                    .sort((a, b) =>
                      (a.time || "99:99").localeCompare(b.time || "99:99"),
                    )
                    .map((t) => (
                      <TaskCard key={t.id} task={t} compact />
                    ))}
                  {dateItems(date).length === 0 && (
                    <span className="empty-day">등록된 일정이 없어</span>
                  )}
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
      items = data.tasks.filter((t) => t.projectId === selectedProject),
      pending = items.filter((t) => t.status !== "done"),
      done = items.filter((t) => t.status === "done");
    const renderItem = (t) => (
      <div key={t.id} className="project-item-wrap">
        <div className="project-list-item">
          <button
            className={"check-btn " + (t.status === "done" ? "checked" : "")}
            onClick={() =>
              completeOrStatus(t, t.status === "done" ? "todo" : "done")
            }
          >
            {t.status === "done" && <Check size={15} />}
          </button>
          <div className="list-middle" onClick={() => setEditing(t.id)}>
            <strong className={t.status === "done" ? "struck" : ""}>
              {t.title}
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
            value={selectedProject}
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
            <button
              className="secondary add-only"
              aria-label="투두 추가"
              onClick={() => {
                setEditing(null);
                setModal("task");
              }}
            >
              <Plus size={22} />
            </button>
          </div>
        )}
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
                disabled={running || (mode === "focus" && seconds !== 1500)}
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
                  집중 25분
                </button>
                <button
                  className={mode === "break" ? "active" : ""}
                  onClick={() => resetTimer("break")}
                >
                  휴식 5분
                </button>
              </div>
              <div className="timer-circle">
                <div className="timer-mode">
                  {mode === "focus" ? "FOCUS TIME" : "BREAK TIME"}
                </div>
                <div className="timer-digits">
                  {pad(Math.floor(seconds / 60))}:{pad(seconds % 60)}
                </div>
                <div className="timer-round">완료한 집중 {round}회</div>
              </div>
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
                  onClick={() => resetTimer(mode)}
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
        <button className="header-pill" onClick={onLogout}>
          로그아웃
        </button>
      </header>
      <main>
        {tab === "today"
          ? Kanban()
          : tab === "calendar"
            ? Calendar()
            : tab === "pom"
              ? Pomodoro()
              : Projects()}
      </main>
      <nav className="bottom-nav">
        {[
          ["today", Columns3, "오늘"],
          ["projects", FolderKanban, "프로젝트"],
          ["calendar", CalendarDays, "일정"],
          ["pom", Timer, "뽀모도로"],
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
      <span style={{ color: "#ce6775", fontSize: 11, whiteSpace: "nowrap" }}>
        {n}회 · {n * 25}분
      </span>
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
            onSave({ title, projectId, due, time, estimatedPomodoros });
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
            시간 (선택)
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
            시간
            <input
              type="time"
              value={task.time}
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
