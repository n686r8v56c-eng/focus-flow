import React,{useEffect,useMemo,useRef,useState} from "react";
import {MapPin,Clock3,Plus,Trash2,ChevronUp,ChevronDown,Navigation,ExternalLink,Bookmark,CalendarDays,Route as RouteIcon,Map as MapIcon,Check,RotateCcw} from "lucide-react";
import "./RouteFlow.css";
const pad=n=>String(n).padStart(2,"0");
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const newId=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2);
const blank=()=>({id:newId(),name:"",address:"",time:"10:00",minutes:60,mode:"transit",notes:"",fixed:false,done:false});
const modes={transit:"대중교통",walking:"도보",driving:"자동차",bicycling:"자전거"};
const mapsSearch=q=>"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(q);
const mapsDirection=(a,b,mode)=>"https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(a)+"&destination="+encodeURIComponent(b)+"&travelmode="+encodeURIComponent(mode);
const naverSearch=q=>"https://map.naver.com/p/search/"+encodeURIComponent(q);
const mins=n=>{const v=Number(n);return Number.isFinite(v)&&v>=0?v:0};
const timeAdd=(t,n)=>{const match=/^(\d\d):(\d\d)$/.exec(t||"");if(!match)return "";const total=Number(match[1])*60+Number(match[2])+Number(n);return pad(Math.floor(((total%1440)+1440)%1440/60))+":"+pad(((total%60)+60)%60)};
const storageKey=id=>"focus-route-flow-v1:"+String(id||"guest");

const KAKAO_KEY=import.meta.env.VITE_KAKAO_MAP_KEY;
let kakaoPromise;
function loadKakao(){
 if(typeof window==="undefined"||!KAKAO_KEY)return Promise.reject(new Error("카카오 JavaScript 키(VITE_KAKAO_MAP_KEY)를 확인해 주세요."));
 if(window.kakao?.maps?.services)return Promise.resolve(window.kakao);
 if(!kakaoPromise)kakaoPromise=new Promise((resolve,reject)=>{
  const script=document.createElement("script");
  script.src="https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&libraries=services&appkey="+encodeURIComponent(KAKAO_KEY);
  script.onload=()=>window.kakao.maps.load(()=>resolve(window.kakao));
  script.onerror=()=>reject(new Error("카카오 지도 SDK를 불러오지 못했어요. 도메인 등록을 확인해 주세요."));
  document.head.appendChild(script);
 }).catch(e=>{kakaoPromise=null;throw e});
 return kakaoPromise;
}
function KakaoRouteMap({ordered,picked,onPick,onAdd}){
 const container=useRef(null),mapRef=useRef(null),markersRef=useRef([]),searchRef=useRef(null);
 const [sdk,setSdk]=useState(null),[query,setQuery]=useState(""),[results,setResults]=useState([]),[found,setFound]=useState(null),[message,setMessage]=useState("");
 useEffect(()=>{let active=true;loadKakao().then(k=>{if(active)setSdk(k)}).catch(e=>{if(active)setMessage(e.message)});return()=>{active=false}},[]);
 useEffect(()=>{
  if(!sdk||!container.current)return;
  if(!mapRef.current)mapRef.current=new sdk.maps.Map(container.current,{center:new sdk.maps.LatLng(37.5665,126.978),level:6});
  const map=mapRef.current;
  markersRef.current.forEach(m=>m.setMap(null));markersRef.current=[];
  const bounds=new sdk.maps.LatLngBounds();let count=0;
  ordered.forEach((p,i)=>{if(!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lng))||!p.lat||!p.lng)return;
   const point=new sdk.maps.LatLng(Number(p.lat),Number(p.lng)),marker=new sdk.maps.Marker({map,position:point,title:(i+1)+". "+p.name});
   sdk.maps.event.addListener(marker,"click",()=>onPick(p.id));markersRef.current.push(marker);bounds.extend(point);count++;
  });
  if(found){const point=new sdk.maps.LatLng(Number(found.y),Number(found.x));const marker=new sdk.maps.Marker({map,position:point,title:found.place_name});markersRef.current.push(marker);bounds.extend(point);count++;}
  if(count>1)map.setBounds(bounds);else if(count===1)map.setCenter(bounds.getSouthWest());
  else if(picked?.lat&&picked?.lng)map.setCenter(new sdk.maps.LatLng(Number(picked.lat),Number(picked.lng)));
 },[sdk,ordered,picked,found,onPick]);
 const search=e=>{
  e.preventDefault();if(!sdk||!query.trim())return;
  setMessage("검색 중…");const service=new sdk.maps.services.Places();
  service.keywordSearch(query.trim(),(data,status)=>{
   if(status===sdk.maps.services.Status.OK){setResults(data);setMessage(data.length+"개 장소를 찾았어요.");setFound(data[0]);}
   else{setResults([]);setFound(null);setMessage(status===sdk.maps.services.Status.ZERO_RESULT?"검색 결과가 없어요.":"장소 검색에 실패했어요.");}
  });
 };
 return <div className="route-kakao-panel">
  <form className="route-kakao-search" onSubmit={search}><input aria-label="장소 검색" placeholder="카페, 병원, 주소, 관광지 검색" value={query} onChange={e=>setQuery(e.target.value)}/><button type="submit" disabled={!sdk}>검색</button></form>
  {message&&<p role="status" className="route-hint">{message}</p>}
  <div className="route-map" ref={container} aria-label="카카오 지도" />
  {results.length>0&&<div className="route-kakao-results">{results.map(item=><div className="route-kakao-result" key={item.id}><button type="button" onClick={()=>setFound(item)}><strong>{item.place_name}</strong><small>{item.road_address_name||item.address_name}</small></button><button type="button" className="route-kakao-add" onClick={()=>onAdd(item)}>+ 동선에 추가</button></div>)}</div>}
  <div className="route-map-pins">{ordered.map((p,i)=><button className={picked?.id===p.id?"active":""} key={p.id} onClick={()=>onPick(p.id)}>{i+1}. {p.name}</button>)}</div>
  {picked&&<div className="route-map-info"><strong><MapPin size={16}/>{picked.name}</strong><p>{picked.address||"주소 미입력"}</p>{picked.lat&&picked.lng?<a target="_blank" rel="noopener noreferrer" href={"https://map.kakao.com/link/to/"+encodeURIComponent(picked.name)+","+picked.lat+","+picked.lng}>카카오맵 길찾기</a>:<a target="_blank" rel="noopener noreferrer" href={"https://map.kakao.com/link/search/"+encodeURIComponent(picked.address||picked.name)}>카카오맵에서 검색</a>}</div>}
  <p className="route-hint">검색한 장소는 좌표와 함께 저장돼요. 교통편 상세 안내는 카카오맵에서 확인할 수 있어요.</p>
 </div>;
}

export function RouteFlow({userId}){
 const [date,setDate]=useState(today),[tab,setTab]=useState("today"),[places,setPlaces]=useState([]),[routes,setRoutes]=useState({}),[draft,setDraft]=useState(blank),[selected,setSelected]=useState(""),[editing,setEditing]=useState(""),[error,setError]=useState("");
 const key=storageKey(userId);
 useEffect(()=>{try{const value=JSON.parse(localStorage.getItem(key)||"{}");setPlaces(Array.isArray(value.places)?value.places:[]);setRoutes(value.routes&&typeof value.routes==="object"?value.routes:{});setSelected("");setEditing("");setError("")}catch{setPlaces([]);setRoutes({});setError("동선 데이터를 읽지 못했어요. 기존 저장값은 변경하지 않았습니다.")}},[key]);
 const save=(nextPlaces,nextRoutes)=>{try{localStorage.setItem(key,JSON.stringify({places:nextPlaces,routes:nextRoutes}));setPlaces(nextPlaces);setRoutes(nextRoutes);setError("")}catch(e){setError("저장 실패: "+e.message)}};
 const stops=routes[date]||[];
 const ordered=stops.map(id=>places.find(p=>p.id===id)).filter(Boolean);
 const picked=places.find(p=>p.id===selected)||ordered[0]||null;
 const updatePlace=p=>save(places.map(x=>x.id===p.id?p:x),routes);
 const add=()=>{if(!draft.name.trim()){setError("장소 이름을 입력해 주세요.");return}const p={...draft,name:draft.name.trim(),address:draft.address.trim(),minutes:mins(draft.minutes)};save([...places,p],{...routes,[date]:[...stops,p.id]});setDraft(blank());setSelected(p.id);setTab("route")};
 const addSearchResult=item=>{const p={...blank(),name:item.place_name,address:item.road_address_name||item.address_name||"",lat:Number(item.y),lng:Number(item.x),kakaoPlaceId:item.id};save([...places,p],{...routes,[date]:[...stops,p.id]});setSelected(p.id)};
 const reorder=(id,dir)=>{const i=stops.indexOf(id),j=i+dir;if(j<0||j>=stops.length)return;const copy=[...stops];[copy[i],copy[j]]=[copy[j],copy[i]];save(places,{...routes,[date]:copy})};
 const removeFromDay=id=>{if(!window.confirm("오늘 동선에서만 제외할까요? 장소함에는 남아 있어요."))return;save(places,{...routes,[date]:stops.filter(x=>x!==id)})};
 const deletePlace=id=>{if(!window.confirm("장소함과 모든 날짜의 동선에서 삭제할까요?"))return;const next={};Object.keys(routes).forEach(day=>next[day]=routes[day].filter(x=>x!==id));save(places.filter(x=>x.id!==id),next);if(selected===id)setSelected("")};
 const routeLinks=(p,i)=>{if(!i)return null;const prev=ordered[i-1],from=prev.address||prev.name,to=p.address||p.name;return <div className="route-move"><span>↳ {modes[p.mode]||"대중교통"} 이동</span><a target="_blank" rel="noopener noreferrer" href={mapsDirection(from,to,p.mode||"transit")}>구글 길찾기 <ExternalLink size={12}/></a><a target="_blank" rel="noopener noreferrer" href={naverSearch(to)}>네이버 지도 <ExternalLink size={12}/></a></div>};
 const form=(p,isEdit=false)=><div className="route-form">
  <label>장소 이름<input value={p.name} placeholder="예: 병원, 카페, 서울숲" onChange={e=>isEdit?updatePlace({...p,name:e.target.value}):setDraft({...p,name:e.target.value})}/></label>
  <label>주소 또는 검색어<input value={p.address} placeholder="도로명 주소나 장소 검색어" onChange={e=>isEdit?updatePlace({...p,address:e.target.value}):setDraft({...p,address:e.target.value})}/></label>
  <div className="route-form-grid"><label>도착 예정<input type="time" value={p.time} onChange={e=>isEdit?updatePlace({...p,time:e.target.value}):setDraft({...p,time:e.target.value})}/></label>
  <label>체류 (분)<input type="number" min="0" step="5" value={p.minutes} onChange={e=>isEdit?updatePlace({...p,minutes:e.target.value}):setDraft({...p,minutes:e.target.value})}/></label></div>
  <label>직전 장소에서 이동<select value={p.mode} onChange={e=>isEdit?updatePlace({...p,mode:e.target.value}):setDraft({...p,mode:e.target.value})}>{Object.entries(modes).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
  <label>메모<input value={p.notes||""} placeholder="예약 / 준비물 / 해야 할 일" onChange={e=>isEdit?updatePlace({...p,notes:e.target.value}):setDraft({...p,notes:e.target.value})}/></label>
  <label className="route-check"><input type="checkbox" checked={!!p.fixed} onChange={e=>isEdit?updatePlace({...p,fixed:e.target.checked}):setDraft({...p,fixed:e.target.checked})}/> 고정 예약 시간</label>
  {isEdit?<button className="route-primary" type="button" onClick={()=>setEditing("")}>수정 닫기</button>:<button className="route-primary" type="button" onClick={add}><Plus size={16}/> 동선에 추가</button>}
 </div>;
 const mapQuery= picked ? (picked.address||picked.name) : "대한민국";
 const mapUrl="https://maps.google.com/maps?q="+encodeURIComponent(mapQuery)+"&output=embed";
 return <section className="route-flow">
  <div className="route-title"><div><small>ROUTE FLOW</small><h1>하루 동선</h1><p>시간 · 장소 · 이동 경로를 한눈에</p></div><label aria-label="날짜 선택"><CalendarDays size={16}/><input type="date" value={date} onChange={e=>{setDate(e.target.value);setSelected("");setEditing("")}}/></label></div>
  <div className="route-stats"><span>방문 <b>{ordered.length}곳</b></span><span>체류 <b>{ordered.reduce((a,p)=>a+mins(p.minutes),0)}분</b></span><span>고정 약속 <b>{ordered.filter(p=>p.fixed).length}개</b></span></div>
  <nav className="route-tabs" aria-label="루트 메뉴">{[["today","오늘",CalendarDays],["route","동선",RouteIcon],["map","지도",MapIcon],["saved","장소함",Bookmark]].map(([id,label,Icon])=><button type="button" key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><Icon size={17}/>{label}</button>)}</nav>
  {error&&<p role="alert" className="route-error">{error}</p>}
  {tab==="today"&&<><div className="route-section-head"><h2>{date} 일정</h2><button onClick={()=>setTab("route")}>동선 편집</button></div>{!ordered.length?<p className="route-empty">아직 방문 장소가 없어요. 동선 탭에서 첫 장소를 추가해 봐요.</p>:ordered.map((p,i)=><div key={p.id}>{routeLinks(p,i)}<article className="route-stop"><div className="route-no">{i+1}</div><div className="route-stop-body"><strong>{p.time} · {p.name}</strong><small>{p.fixed?"🔒 예약 고정 · ":""}{p.minutes}분 체류{p.time?" · "+timeAdd(p.time,p.minutes)+" 종료 예상":""}</small>{p.notes&&<p>{p.notes}</p>}</div><button aria-label={p.name+" 완료"} className={p.done?"route-done":""} onClick={()=>updatePlace({...p,done:!p.done})}><Check size={18}/></button></article></div>)}</>}
  {tab==="route"&&<><div className="route-section-head"><h2>방문 순서</h2><span>화살표로 순서 변경</span></div>{ordered.map((p,i)=><div key={p.id}>{routeLinks(p,i)}<article className="route-stop"><div className="route-no">{i+1}</div><div className="route-stop-body"><strong>{p.name}</strong><small>{p.time} · {p.minutes}분{p.fixed?" · 예약 고정":""}</small><div className="route-actions"><button onClick={()=>{setEditing(editing===p.id?"":p.id);setSelected(p.id)}}>수정</button><button onClick={()=>removeFromDay(p.id)}>동선 제외</button></div></div><div className="route-order"><button aria-label="위로" disabled={i===0} onClick={()=>reorder(p.id,-1)}><ChevronUp size={17}/></button><button aria-label="아래로" disabled={i===ordered.length-1} onClick={()=>reorder(p.id,1)}><ChevronDown size={17}/></button></div></article>{editing===p.id&&form(p,true)}</div>)}<div className="route-section-head"><h2>장소 추가</h2></div>{form(draft)}{places.some(p=>!stops.includes(p.id))&&<div className="route-reuse"><h3>장소함에서 추가</h3>{places.filter(p=>!stops.includes(p.id)).map(p=><button key={p.id} onClick={()=>save(places,{...routes,[date]:[...stops,p.id]})}><Plus size={14}/>{p.name}</button>)}</div>}</>}
  {tab==="map"&&<><div className="route-section-head"><h2>카카오 지도 · 장소 검색</h2></div><KakaoRouteMap ordered={ordered} picked={picked} onPick={setSelected} onAdd={addSearchResult}/></>}
  {tab==="saved"&&<><div className="route-section-head"><h2>장소함</h2><span>저장 {places.length}곳</span></div>{!places.length&&<p className="route-empty">동선에서 장소를 추가하면 여기에 모여요.</p>}{places.map(p=><article className="route-saved" key={p.id}><div><strong>{p.name}</strong><small>{p.address||"주소 미입력"}</small></div><button disabled={stops.includes(p.id)} onClick={()=>save(places,{...routes,[date]:[...stops,p.id]})}>{stops.includes(p.id)?"추가됨":"오늘 추가"}</button><button aria-label={p.name+" 삭제"} onClick={()=>deletePlace(p.id)}><Trash2 size={16}/></button></article>)}</>}
  <p className="route-storage-note">ROUTE 기록은 현재 이 브라우저에 별도 저장됩니다. Focus Flow의 기존 일정·백업 데이터에는 영향을 주지 않으며, 다른 기기와 자동 동기화되지 않습니다. 교통편은 지도에서 조회해 주세요.</p>
 </section>
}
