import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import { App } from "./App.jsx";
import { useSyncedState } from "./sync.js";
const supabase = createClient(
  "https://cntwtmaqyjwtnpybjare.supabase.co",
  "sb_publishable_8tjs1LsNSb2Ro0Hlw7Ka0A_-a60Ak8U",
);
const initial = {
  projects: [
    { id: "p1", name: "앱 개발", color: "#a897dd" },
    { id: "p2", name: "공부", color: "#e1a0b8" },
    { id: "p3", name: "생활", color: "#8dbfb4" },
  ],
  tasks: [],
  sessions: [],
};
function AuthGate() {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signUp, setSignUp] = useState(false),
    [working, setWorking] = useState(false);
  const {
    data: snapshot,
    change: save,
    loading: dataLoading,
    error: syncError,
    canLogout,
    backupNow,
    backupInfo,
  } = useSyncedState(supabase, session?.user?.id, initial);
  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!live) return;
      if (error) setError(error.message);
      setSession(data?.session || null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (live) setSession(next);
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);
  async function login(e) {
    e.preventDefault();
    setWorking(true);
    setError("");
    const result = signUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setError(result.error.message);
    else if (signUp && !result.data.session)
      setError("가입 확인 메일을 확인한 뒤 로그인해줘.");
    setWorking(false);
  }
  if (loading || dataLoading)
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Focus Flow</h1>
          <p>데이터를 불러오는 중…</p>
        </div>
      </div>
    );
  if (!session)
    return (
      <div className="auth-page">
        <form className="auth-card" onSubmit={login}>
          <div className="auth-star">✳</div>
          <h1>Focus Flow</h1>
          <p>오늘을 차곡차곡 정리하는 나만의 플래너</p>
          <div className="auth-switch">
            <button
              type="button"
              className={!signUp ? "selected" : ""}
              onClick={() => {
                setSignUp(false);
                setError("");
              }}
            >
              로그인
            </button>
            <button
              type="button"
              className={signUp ? "selected" : ""}
              onClick={() => {
                setSignUp(true);
                setError("");
              }}
            >
              회원가입
            </button>
          </div>
          <label>
            이메일
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              required
              minLength={6}
              autoComplete={signUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
            />
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary auth-submit" disabled={working}>
            {working ? "처리 중…" : signUp ? "회원가입" : "로그인"}
          </button>
        </form>
      </div>
    );
  if (!snapshot)
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>연결 확인 필요</h1>
          <p>{syncError || error || "데이터를 가져오지 못했어."}</p>
          <button className="secondary" onClick={() => supabase.auth.signOut()}>
            로그아웃
          </button>
        </div>
      </div>
    );
  return (
    <>
      <App
        key={session.user.id}
        bridgeClient={supabase}
        bridgeUserId={session.user.id}
        initialData={snapshot}
        onDataChange={save}
        onLogout={async () => {
          if (await canLogout()) await supabase.auth.signOut();
          else
            setError(
              "저장이 끝난 뒤 로그아웃해 줘. 변경 내용은 이 기기에 보관했어.",
            );
        }}
      />
      <div className="backup-status" style={{position:"fixed",right:8,bottom:76,zIndex:20,display:"flex",gap:6,alignItems:"center",background:"#fff",border:"1px solid #e4d9ef",borderRadius:14,padding:"5px 8px",fontSize:11,color:"#725299",boxShadow:"0 2px 8px #0001"}}><span>{backupInfo.status==="saved"?"백업 완료":backupInfo.status==="failed"?"백업 실패":backupInfo.status==="backing-up"?"백업 중":"백업 대기"}</span><button type="button" onClick={backupNow} disabled={backupInfo.status==="backing-up"} style={{fontSize:11,padding:"3px 6px",borderRadius:8}}>지금 백업</button></div>
      {(error || syncError) && (
        <div className="sync-warning" role="alert">
          {error || syncError}
        </div>
      )}
    </>
  );
}
if (document.getElementById("root"))
  createRoot(document.getElementById("root")).render(<AuthGate />);

import './mobile-readability.css';
