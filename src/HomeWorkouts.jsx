import React, { useEffect, useState } from "react";
const HOME = "https://home-fit-11n.pages.dev";
export function HomeWorkouts({ client, userId, today }) {
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
          .from("focus_home_links")
          .select("id")
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
          .from("focus_home_snapshots")
          .select("workouts,received_at")
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
            "운동 연결을 확인해 주세요. 연결 기능 설치 후 새로고침하면 돼요.",
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
  }, [client, userId, refreshVersion]);
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
      const result = await client.rpc("focus_home_pair_create", {
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
        "Home Fit 연결을 끊을까요? 기존 할 일과 운동 기록은 보존돼요.",
      )
    )
      return;
    setBusy(true);
    try {
      const r = await client.rpc("focus_home_disconnect");
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
  const workouts = (
    Array.isArray(snapshot?.workouts) ? snapshot.workouts : []
  ).filter((w) => w.date === today);
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
      aria-label="오늘의 운동"
      style={{ marginTop: 30, paddingTop: 22, borderTop: "1px solid #e9e1f0" }}
    >
      <div className="section-top">
        <div>
          <div className="eyebrow">HOME FIT</div>
          <h1>오늘의 운동</h1>
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
              ? "Home Fit과 연결됐어요. 운동 시작·완료는 Home Fit에서 기록해 주세요."
              : "Home Fit에서 로그인한 뒤 아래 연결 코드를 입력해 주세요."}
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
                aria-label="Home Fit 연결 코드"
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
                10분 동안 유효해요. Home Fit의 Focus Flow 연결란에 붙여 넣어
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
          Home Fit을 연결하면 오늘 예정된 운동이 여기에 따로 표시돼요.
        </p>
      )}
      {link && !snapshot && (
        <p className="hint">
          Home Fit에서 ‘Focus Flow에 표시’를 켜고 동기화해 주세요.
        </p>
      )}
      <div className="kanban">
        {[
          ["todo", "할 운동"],
          ["doing", "진행 중"],
          ["done", "완료"],
        ].map(([status, label]) => (
          <div className="lane" key={status}>
            <div className={"lane-head " + status}>
              <span>{label}</span>
              <small>
                {workouts.filter((w) => w.status === status).length}
              </small>
            </div>
            <div className="lane-content">
              {workouts
                .filter((w) => w.status === status)
                .map((w) => (
                  <a
                    className="task-card"
                    key={w.id}
                    href={href(w)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div className="task-project">
                      {{
                        workout: "근력운동",
                        stretch: "스트레칭",
                        skin: "마사지",
                      }[w.kind] || "운동"}
                    </div>
                    <div className="task-title">{w.title}</div>
                    <div className="task-foot">
                      <span>
                        {w.minutes > 0 ? `${w.minutes}분 · ` : ""}Home Fit에서{" "}
                        {status === "done" ? "보기" : "시작"} ↗
                      </span>
                    </div>
                  </a>
                ))}
              {!workouts.some((w) => w.status === status) && (
                <div className="empty-lane">등록된 운동이 없어요</div>
              )}
            </div>
          </div>
        ))}
      </div>
      {snapshot?.received_at && (
        <p className="hint">
          마지막 동기화 {new Date(snapshot.received_at).toLocaleString("ko-KR")}
        </p>
      )}
    </section>
  );
}
