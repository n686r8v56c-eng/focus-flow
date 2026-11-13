import React, {useState} from "react";
import { Search, RefreshCw, BookmarkPlus, ExternalLink } from "lucide-react";
const kinds=[["rss","구글 급상승"],["popular","유튜브 인기"],["search","키워드 영상"],["news","네이버 뉴스"],["interest","검색 관심도"]];
const tabs=[["all","전체"],["스타","스타"],["드라마","드라마"],["영화","영화"],["예능","예능"],["K팝","K팝"]];
const wordFilter={
 "스타":/(배우|연예인|가수|아이돌|셀럽|스타|열애|결혼|이혼|소속사)/i,
 "드라마":/(드라마|시리즈|넷플릭스|방영|연기|출연)/i,
 "영화":/(영화|극장|박스오피스|감독|개봉)/i,
 "예능":/(예능|방송|프로그램|출연|MC)/i,
 "K팝":/(아이돌|컴백|신곡|뮤비|뮤직비디오|콘서트|K-?pop)/i
};
const shortDate=()=>new Date().toLocaleDateString("sv-SE");
function scoreNum(n){return n===null||n===undefined?"미확인":Number(n).toLocaleString("ko-KR");}
export function TrendAuto({client,onAdd}){
 const [kind,setKind]=useState("rss"),[keyword,setKeyword]=useState(""),[days,setDays]=useState(30),[order,setOrder]=useState("viewCount"),[category,setCategory]=useState("24");
 const [sector,setSector]=useState("all"),[data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[added,setAdded]=useState([]),[lastQuery,setLastQuery]=useState("");
 const needsQ=["search","news","interest"].includes(kind);
 const search=async()=>{
   if(needsQ&&!keyword.trim()){setError("검색어를 입력해 줘.");return;}
   setBusy(true);setError("");setData(null);setAdded([]);
   try{
     const {data:auth,error:authErr}=await client.auth.getSession();
     if(authErr||!auth?.session?.access_token)throw new Error("로그인을 확인할 수 없어. 다시 로그인해 줘.");
     const params=new URLSearchParams({kind,days:String(days),order,category,q:keyword.trim()});
     const r=await fetch("/api/trend?"+params,{headers:{Authorization:"Bearer "+auth.session.access_token}});
     const json=await r.json().catch(()=>({}));
     if(!r.ok)throw new Error(json.error||"API 요청 실패");
     setData(json);setLastQuery(keyword.trim());
   }catch(e){setError(e.message||"데이터를 가져올 수 없어.");}finally{setBusy(false);}
 };
 const items=Array.isArray(data?.items)?data.items:[];
 // Google RSS is not officially classified by entertainment genre; filter here is heuristic, not a verified tag.
 const visible=(kind==="rss"&&sector!=="all")?items.filter(x=>wordFilter[sector]?.test(x.title||"")):items;
 const makeRecord=(item)=>{
   const isVideo=kind==="search"||kind==="popular",isNews=kind==="news",isRss=kind==="rss";
   const title=item.title||lastQuery;
   const source=isVideo?"youtube":isNews?"naver":isRss?"google":"datalab";
   return {title,category:sector==="all"?"기타":sector,summary:isVideo?(item.channel+" · "+item.publishedAt?.slice(0,10)):isNews?item.description||"":isRss?"구글 급상승 키워드: "+(item.traffic||"검색량 미확인"):"",confirmed:source+" API 응답에서 확인됨 · 수집 "+data.observedAt,unknown:"이슈의 엔터테인먼트 분야 분류 및 플랫폼 간 통합 순위는 미확인",source,url:item.url||"",rank:"",views:isVideo?String(item.views??""):"",searchInterest:"",observedAt:shortDate(),memo:"원본: "+source+"\n조회 조건: "+(lastQuery||"한국 인기/급상승")+"\n"+(data.note||""),saved:true};
 };
 const add=async(item,i)=>{try{await onAdd(makeRecord(item));setAdded(x=>[...x,i]);}catch(e){setError(e.message||"저장에 실패했어.");}};
 return <section className="trend-auto">
   <div className="trend-auto-head"><div><strong>자동 발견 · API 수집</strong><small>직접 새로고침할 때만 호출 · 한국 기준</small></div><span>실제 데이터</span></div>
   <div className="trend-auto-modes">{kinds.map(([id,label])=><button key={id} type="button" className={kind===id?"on":""} onClick={()=>{setKind(id);setData(null);setError("");}}>{label}</button>)}</div>
   <div className="trend-auto-controls">
     {needsQ&&<label>검색 키워드<input value={keyword} onChange={e=>setKeyword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")search();}} placeholder="예: 공항패션, 아이유, 경량패딩"/></label>}
     {(kind==="search"||kind==="interest")&&<label>기간<select value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90,180,360].map(n=><option key={n} value={n}>{n}일</option>)}</select></label>}
     {kind==="search"&&<label>정렬<select value={order} onChange={e=>setOrder(e.target.value)}><option value="viewCount">누적 조회수순</option><option value="relevance">관련도순</option><option value="date">최신순</option></select></label>}
     {kind==="popular"&&<label>유튜브 분야<select value={category} onChange={e=>setCategory(e.target.value)}><option value="24">엔터테인먼트</option><option value="10">음악</option><option value="1">영화·애니메이션</option></select></label>}
     {kind==="rss"&&<label>관심 분야 (비공식 키워드 필터)<select value={sector} onChange={e=>setSector(e.target.value)}>{tabs.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>}
     <button type="button" onClick={search} disabled={busy}><RefreshCw size={15}/>{busy?"수집 중…":"API 조회"}</button>
   </div>
   {kind==="search"&&<p className="trend-auto-tip">유튜브 키워드 검색은 요청 1회당 약 100 quota units를 사용해. 선택 기간에 업로드된 영상의 누적 조회수순이며 그 기간의 조회수 증가순은 아니야.</p>}
   {kind==="rss"&&<p className="trend-auto-tip">Google RSS의 분야 필터는 앱의 단순 단어 매칭이야. 엔터 키워드가 누락되거나 다른 분야가 포함될 수 있어.</p>}
   {kind==="popular"&&<p className="trend-auto-tip">유튜브가 선정한 현재 한국 인기 영상이며 7일·30일 기간 조회가 아니야.</p>}
   {error&&<p className="trend-auto-error" role="alert">{error}</p>}
   {data&&<div className="trend-auto-results"><div className="trend-auto-result-head"><strong>{kind==="interest"?"검색 관심도 추이":"API 수집 결과"} · {kind==="interest"?(data.results?.length||0):visible.length}건</strong><small>{new Date(data.observedAt).toLocaleString("ko-KR")}</small></div>
    {data.note&&<p className="trend-auto-tip">{data.note}</p>}
    {kind==="interest"?(data.results||[]).map((r,i)=><div key={i} className="trend-auto-item"><strong>{r.title||lastQuery}</strong><p>일별 상대 검색 관심도 (최고 100)</p><div className="trend-auto-ratios">{(r.data||[]).slice(-14).map((v,j)=><span title={v.period+" : "+v.ratio} key={j} style={{height:Math.max(2,Number(v.ratio||0))+"%"}}/>)}</div><small>최근 값: {r.data?.length?r.data[r.data.length-1].ratio:"미확인"} · 실제 검색 횟수 아님</small><button onClick={()=>add({title:r.title||lastQuery},i)} disabled={added.includes(i)}>{added.includes(i)?"저장됨":"관심 키워드 저장"}</button></div>)
    :visible.length?visible.map((item,i)=><article key={item.id||item.url||i} className="trend-auto-item">{item.thumbnail&&<img src={item.thumbnail} alt="" loading="lazy"/>}<div><strong>{item.title}</strong><small>{item.channel||item.pubDate||item.publishedAt?.slice(0,10)||""}</small>{(kind==="search"||kind==="popular")&&<p>조회수 {scoreNum(item.views)} · 좋아요 {scoreNum(item.likes)} · 댓글 {scoreNum(item.comments)}</p>}{kind==="rss"&&<p>급상승 검색량 구간: {item.traffic||"미확인"}</p>}<div className="trend-auto-actions">{item.url&&<a href={item.url} target="_blank" rel="noopener noreferrer">원본 <ExternalLink size={12}/></a>}<button type="button" disabled={added.includes(i)} onClick={()=>add(item,i)}><BookmarkPlus size={13}/>{added.includes(i)?"저장됨":"저장함에 추가"}</button></div></div></article>):<p className="trend-empty">해당 조건의 결과가 없어. 필터를 변경하거나 다시 조회해 줘.</p>}
   </div>}
   {!data&&!busy&&!error&&<p className="trend-auto-tip">API 키가 설정되면 결과가 표시돼. 외부 키는 Cloudflare 환경 변수에 저장하며 이 화면에는 노출되지 않아.</p>}
 </section>;
}
