import React,{useEffect,useMemo,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {MapPin,Clock3,Plus,Trash2,Pencil,FolderPlus,Folder,ImagePlus,ChevronUp,ChevronDown,Navigation,ExternalLink,Bookmark,CalendarDays,Route as RouteIcon,Map as MapIcon,Check,RotateCcw,NotebookPen} from "lucide-react";
import "./RouteFlow.css";
const pad=n=>String(n).padStart(2,"0");
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const newId=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2);
const blank=()=>({id:newId(),name:"",address:"",folderId:"",visited:false,time:"10:00",minutes:60,mode:"transit",notes:"",checklist:[],fixed:false,done:false});
const blankVisit=()=>({time:"10:00",minutes:60,mode:"transit",notes:"",checklist:[],fixed:false,done:false});
const visitFields=["time","minutes","mode","notes","checklist","fixed","done"];
const visitFrom=p=>Object.fromEntries(visitFields.map(k=>[k,p?.[k]??blankVisit()[k]]));
const cleanPlace=p=>{const out={...p};visitFields.forEach(k=>delete out[k]);return out};
const modes={transit:"대중교통",walking:"도보",driving:"자동차",bicycling:"자전거"};
const mapsSearch=q=>"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(q);
const mapsDirection=(a,b,mode)=>"https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(a)+"&destination="+encodeURIComponent(b)+"&travelmode="+encodeURIComponent(mode);
const naverSearch=q=>"https://map.naver.com/p/search/"+encodeURIComponent(q);
const kakaoDirections=(from,to,mode)=>{
 const valid=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&Number(p.lat)>=-90&&Number(p.lat)<=90&&Number(p.lng)>=-180&&Number(p.lng)<=180;
 if(!valid(from)||!valid(to))return null;
 const by={transit:"publictransit",walking:"foot",driving:"car",bicycling:"bicycle"}[mode]||"publictransit";
 const params=new URLSearchParams({sp:from.lat+","+from.lng,ep:to.lat+","+to.lng,by});
 return "https://m.map.kakao.com/scheme/route?"+params.toString();
};
const kakaoRouteSearch="https://m.map.kakao.com/scheme/open?page=routeSearch";

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
function KakaoRouteMap({ordered,picked,onPick,onAddRoute,onAddSaved}){
 const container=useRef(null),mapRef=useRef(null),markersRef=useRef([]),searchRef=useRef(null);
 const [sdk,setSdk]=useState(null),[geoStatus,setGeoStatus]=useState(""),[geoPoint,setGeoPoint]=useState(null),[query,setQuery]=useState(""),[results,setResults]=useState([]),[found,setFound]=useState(null),[message,setMessage]=useState(""),[moreResults,setMoreResults]=useState(false),[searchMode,setSearchMode]=useState("nearby");
 const paginationRef=useRef(null),searchSeqRef=useRef(0);
 useEffect(()=>{let active=true;loadKakao().then(k=>{if(active)setSdk(k)}).catch(e=>{if(active)setMessage(e.message)});return()=>{active=false}},[]);
 const locate=()=>{if(!navigator.geolocation){setGeoStatus("이 브라우저에서는 위치 기능을 지원하지 않아요.");return}setGeoStatus("현재 위치 확인 중…");navigator.geolocation.getCurrentPosition(pos=>{const point={lat:pos.coords.latitude,lng:pos.coords.longitude};setGeoPoint(point);setGeoStatus("현재 위치 주변 지도를 표시했어요.");if(mapRef.current&&sdk){mapRef.current.setCenter(new sdk.maps.LatLng(point.lat,point.lng));mapRef.current.setLevel(4)}},err=>setGeoStatus(err.code===1?"위치 권한이 꺼져 있어요. iPhone 설정에서 이 사이트의 위치 접근을 허용해 주세요.":"현재 위치를 확인하지 못했어요. 다시 시도해 주세요."),{enableHighAccuracy:false,timeout:10000,maximumAge:300000})};
 useEffect(()=>{if(sdk)locate()},[sdk]);
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
  // A successful geolocation must take priority over saved route pins.
  // Otherwise this effect re-centers the map on the itinerary after permission is granted.
  if(geoPoint){
   const current=new sdk.maps.LatLng(geoPoint.lat,geoPoint.lng);
   const here=new sdk.maps.Marker({map,position:current,title:"현재 위치",zIndex:10});
   markersRef.current.push(here);
  }
  if(found)map.setCenter(new sdk.maps.LatLng(Number(found.y),Number(found.x)));
  else if(geoPoint){map.setCenter(new sdk.maps.LatLng(geoPoint.lat,geoPoint.lng));map.setLevel(4);}
  else if(count>1)map.setBounds(bounds);
  else if(count===1)map.setCenter(bounds.getSouthWest());
  else if(picked?.lat&&picked?.lng)map.setCenter(new sdk.maps.LatLng(Number(picked.lat),Number(picked.lng)));
 },[sdk,ordered,picked,found,onPick,geoPoint]);
 const searchPlaces=(mode="nearby")=>{
  if(!sdk||!query.trim())return;
  const seq=++searchSeqRef.current;
  const nearby=mode==="nearby"&&!!geoPoint;
  setSearchMode(nearby?"nearby":"nationwide");
  setResults([]);setFound(null);setMoreResults(false);paginationRef.current=null;
  setMessage(nearby?"현재 위치 주변 검색 중…":"전국 검색 중…");
  const service=new sdk.maps.services.Places();
  const options={size:15,sort:nearby?sdk.maps.services.SortBy.DISTANCE:sdk.maps.services.SortBy.ACCURACY};
  if(nearby){options.location=new sdk.maps.LatLng(geoPoint.lat,geoPoint.lng);options.radius=20000;}
  service.keywordSearch(query.trim(),(data,status,pagination)=>{
   if(seq!==searchSeqRef.current)return;
   if(status===sdk.maps.services.Status.OK){
    paginationRef.current=pagination;
    setResults(prev=>[...prev,...data.filter(item=>!prev.some(p=>p.id===item.id))]);
    setMoreResults(!!pagination?.hasNextPage);
    setMessage((nearby?"현재 위치 20km 이내 · 거리순":"전국 검색")+" · 결과 더 보기 가능");
   }else if(status===sdk.maps.services.Status.ZERO_RESULT){
    setMoreResults(false);setMessage(nearby?"20km 안에 결과가 없어요. 전국 검색을 눌러보세요.":"검색 결과가 없어요.");
   }else{setMoreResults(false);setMessage("장소 검색에 실패했어요. 다시 시도해 주세요.");}
  },options);
 };
 const search=e=>{e.preventDefault();searchPlaces("nearby");};
 return <div className="route-kakao-panel">
  <div className="route-map-wrap"><div className="route-map" ref={container} aria-label="카카오 지도" /><button className="route-locate-button" type="button" title="내 위치로 이동" aria-label="내 위치로 이동" onClick={locate}><Navigation size={18}/></button></div>
  {geoStatus&&<p role="status" className="route-hint">{geoStatus}</p>}
  <form className="route-kakao-search" onSubmit={search}><input aria-label="장소 검색" placeholder="카페, 병원, 주소, 관광지 검색" value={query} onChange={e=>setQuery(e.target.value)}/><button type="submit" disabled={!sdk}>검색</button></form>
  {message&&<p role="status" className="route-hint">{message}</p>}
  {query.trim()&&<div style={{display:"flex",gap:8,alignItems:"center",margin:"8px 0",flexWrap:"wrap"}}><button type="button" onClick={()=>searchPlaces("nearby")} disabled={!sdk} aria-pressed={searchMode==="nearby"}>📍 내 주변</button><button type="button" onClick={()=>searchPlaces("nationwide")} disabled={!sdk} aria-pressed={searchMode==="nationwide"}>전국 검색</button><small>{results.length}개 표시</small></div>}
  {results.length>0&&<div className="route-kakao-results">{results.map(item=><div className="route-kakao-result" key={item.id}><button type="button" onClick={()=>setFound(item)}><strong>{item.place_name}</strong><small>{item.distance?Number(item.distance).toLocaleString()+"m · ":""}{item.road_address_name||item.address_name}</small></button><div className="route-kakao-add-actions"><button type="button" className="route-kakao-add" onClick={()=>onAddRoute(item)}>+ 동선</button><button type="button" className="route-kakao-add" onClick={()=>onAddSaved(item)}>+ 장소함</button></div></div>)}</div>}
  {moreResults&&<button type="button" style={{width:"100%",padding:10,marginTop:8}} onClick={()=>paginationRef.current?.nextPage()}>검색 결과 더 보기</button>}
  <div className="route-map-pins">{ordered.map((p,i)=><button className={picked?.id===p.id?"active":""} key={p.id} onClick={()=>onPick(p.id)}>{i+1}. {p.name}</button>)}</div>
  {picked&&<div className="route-map-info"><strong><MapPin size={16}/>{picked.name}</strong><p>{picked.address||"주소 미입력"}</p>{picked.lat&&picked.lng?<a target="_blank" rel="noopener noreferrer" href={"https://map.kakao.com/link/to/"+encodeURIComponent(picked.name)+","+picked.lat+","+picked.lng}>카카오맵 길찾기</a>:<a target="_blank" rel="noopener noreferrer" href={"https://map.kakao.com/link/search/"+encodeURIComponent(picked.address||picked.name)}>카카오맵에서 검색</a>}</div>}
  <p className="route-hint">검색한 장소는 좌표와 함께 저장돼요. 교통편 상세 안내는 카카오맵에서 확인할 수 있어요.</p>
 </div>;
}


function openRouteImages(){return new Promise((resolve,reject)=>{const req=indexedDB.open("focus-route-images-v1",1);req.onupgradeneeded=()=>req.result.createObjectStore("images");req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function routeImagePut(id,file){const db=await openRouteImages();return new Promise((resolve,reject)=>{const tx=db.transaction("images","readwrite");tx.objectStore("images").put(file,id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function routeImageGet(id){const db=await openRouteImages();return new Promise((resolve,reject)=>{const req=db.transaction("images","readonly").objectStore("images").get(id);req.onsuccess=()=>{db.close();resolve(req.result)};req.onerror=()=>{db.close();reject(req.error)}})}
async function routeImageDelete(id){const db=await openRouteImages();return new Promise((resolve,reject)=>{const tx=db.transaction("images","readwrite");tx.objectStore("images").delete(id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
function RouteJournalPhoto({photoId,onRemove}){
 const [src,setSrc]=useState("");
 useEffect(()=>{let active=true,url="";routeImageGet(photoId).then(blob=>{if(active&&blob){url=URL.createObjectURL(blob);setSrc(url)}}).catch(()=>{});return()=>{active=false;if(url)URL.revokeObjectURL(url)}},[photoId]);
 return <div className="route-journal-photo">{src?<img src={src} alt="방문일지 첨부 사진" loading="lazy"/>:<span>사진 불러오는 중</span>}<button type="button" onClick={()=>onRemove(photoId)} aria-label="첨부 사진 삭제"><Trash2 size={14}/></button></div>;
}
function RouteChecklistImage({nodeId}){const [src,setSrc]=useState("");const [err,setErr]=useState("");useEffect(()=>{let alive=true,url="";routeImageGet(nodeId).then(blob=>{if(alive&&blob){url=URL.createObjectURL(blob);setSrc(url)}}).catch(()=>{});return()=>{alive=false;if(url)URL.revokeObjectURL(url)}},[nodeId]);const upload=async e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")){setErr("이미지 파일만 가능해요.");return}try{await routeImagePut(nodeId,file);const url=URL.createObjectURL(file);setSrc(old=>{if(old?.startsWith("blob:"))URL.revokeObjectURL(old);return url});setErr("")}catch{setErr("이미지를 저장하지 못했어요.")}e.target.value=""};return <div className="route-check-photo"><label title="체크리스트 사진 추가"><input type="file" accept="image/*" onChange={upload}/>{src?<img src={src} alt="체크리스트 첨부 사진"/>:<ImagePlus size={18}/>}</label>{err&&<small role="alert">{err}</small>}</div>}
function RouteChecklist({value,onChange}){
 const nodes=Array.isArray(value)?value:[];
 const patch=(id,changes)=>onChange(nodes.map(n=>n.id===id?{...n,...changes}:n));
 const add=(parentId=null)=>{const parent=nodes.find(n=>n.id===parentId);const level=parent?Math.min(2,(parent.level||0)+1):0;onChange([...nodes,{id:newId(),parentId,level,title:"",done:false}])};
 const remove=id=>{const gone=new Set([id]);let changed=true;while(changed){changed=false;nodes.forEach(n=>{if(gone.has(n.parentId)&&!gone.has(n.id)){gone.add(n.id);changed=true}})}if(window.confirm("이 항목과 하위 체크리스트를 삭제할까요?"))onChange(nodes.filter(n=>!gone.has(n.id)))};
 const render=(parentId=null)=>nodes.filter(n=>(n.parentId||null)===parentId).map(n=><div className="route-check-tree" key={n.id} style={{marginLeft:(n.level||0)*10}}><div className="route-check-row"><input type="checkbox" aria-label="완료" checked={!!n.done} onChange={e=>patch(n.id,{done:e.target.checked})}/><input className={n.done?"checked":""} value={n.title} placeholder={n.level===0?"체크리스트":n.level===1?"서브체크리스트":"서브서브체크리스트"} onChange={e=>patch(n.id,{title:e.target.value})}/><RouteChecklistImage nodeId={n.id}/>{n.level<2&&<button type="button" title="하위 항목 추가" aria-label="하위 항목 추가" onClick={()=>add(n.id)}><Plus size={15}/></button>}<button type="button" title="항목 삭제" aria-label="항목 삭제" onClick={()=>remove(n.id)}><Trash2 size={15}/></button></div>{render(n.id)}</div>);
 return <div className="route-checklist"><div className="route-checklist-head"><strong>체크리스트</strong><button type="button" onClick={()=>add()}><Plus size={15}/> 항목 추가</button></div>{render()}</div>
}


const memoToText=p=>{const lines=[];if(p.notes)lines.push(p.notes);const nodes=Array.isArray(p.checklist)?p.checklist:[];const walk=(parent=null,depth=0)=>{nodes.filter(n=>(n.parentId||null)===parent).forEach(n=>{lines.push(" ".repeat(depth*2)+"- "+(n.title||""));walk(n.id,depth+1)})};walk();return lines.join("\n")};
function parseRouteMemo(text,previous=[]){const nodes=[],memo=[];const parents=[];let lastWasList=false;for(const line of text.split(/\r?\n/)){const m=line.match(/^(\s*)(?:- )(.+)$/);if(m){const depth=Math.min(3,Math.floor(m[1].length/2));const title=m[2].trim();const parentId=depth?parents[depth-1]||null:null;const prior=previous.find(n=>n.title===title&&n.parentId===parentId&&!nodes.some(x=>x.id===n.id));const node={id:prior?.id||newId(),parentId,level:depth,title,done:prior?.done||false};nodes.push(node);parents[depth]=node.id;parents.length=depth+1;lastWasList=true;}else{memo.push(line);lastWasList=false;}}return {notes:memo.join("\n").trim(),checklist:nodes};}
function RouteMemoView({notes,checklist,onToggle}){const nodes=Array.isArray(checklist)?checklist:[];const [items,setItems]=useState(nodes);useEffect(()=>setItems(nodes),[checklist]);return <div className="route-memo-view">{notes&&<p style={{whiteSpace:"pre-wrap"}}>{notes}</p>}{items.map(n=><div key={n.id} style={{marginLeft:Math.min(3,n.level||0)*16,display:"flex",alignItems:"center",gap:8,marginTop:6}}><input type="checkbox" checked={!!n.done} onChange={e=>onToggle?.(n.id,e.target.checked)} disabled={!onToggle} aria-label={n.title+" 완료 상태"}/><span style={{textDecoration:n.done?"line-through":"none",flex:1}}>{n.title}</span><RouteChecklistImage nodeId={n.id}/></div>)}</div>}
function RouteMemoEditor({value,onSave}){const [text,setText]=useState(()=>memoToText(value));useEffect(()=>setText(memoToText(value)),[value.id]);return <div className="route-memo-editor"><label>메모<textarea rows={7} style={{width:"100%",fontSize:16,resize:"vertical",whiteSpace:"pre-wrap"}} value={text} onChange={e=>setText(e.target.value)} placeholder={"메모를 자유롭게 적어 주세요.\n- 체크리스트\n  - 하위 항목\n    - 세부 항목"}/></label><small>일반 문장은 메모, '- '로 시작하는 줄은 체크리스트가 돼요. 들여쓰기 두 칸마다 하위 단계예요.</small><button type="button" onClick={()=>onSave(parseRouteMemo(text,value.checklist||[]))}>메모·체크리스트 저장</button><RouteMemoView notes={value.notes} checklist={value.checklist}/></div>}

export function RouteFlow({userId}){
 const [date,setDate]=useState(today),[tab,setTab]=useState("today"),[places,setPlaces]=useState([]),[routes,setRoutes]=useState({}),[visits,setVisits]=useState({}),[draft,setDraft]=useState(blank),[selected,setSelected]=useState(""),[editing,setEditing]=useState(""),[error,setError]=useState(""),[folders,setFolders]=useState([]),[folderFilter,setFolderFilter]=useState("all"),[placeQuery,setPlaceQuery]=useState(""),[visitFilter,setVisitFilter]=useState("all"),[placeMenu,setPlaceMenu]=useState(""),[folderMenu,setFolderMenu]=useState(""),[journal,setJournal]=useState([]),[journalPlace,setJournalPlace]=useState("all"),[journalEditing,setJournalEditing]=useState(""),[journalDate,setJournalDate]=useState(today),[journalNote,setJournalNote]=useState("");
 const suppressPlaceClick=useRef(false);
 const longPressTimer=useRef(null);
 const clearLongPress=()=>{if(longPressTimer.current!==null){clearTimeout(longPressTimer.current);longPressTimer.current=null;}};
 const startPlacePress=id=>{clearLongPress();suppressPlaceClick.current=false;longPressTimer.current=setTimeout(()=>{suppressPlaceClick.current=true;setPlaceMenu(id);longPressTimer.current=null;},550);};
 useEffect(()=>()=>clearLongPress(),[]);
 const folderPressTimer=useRef(null);
 const clearFolderPress=()=>{if(folderPressTimer.current!==null){clearTimeout(folderPressTimer.current);folderPressTimer.current=null;}};
 const startFolderPress=id=>{clearFolderPress();folderPressTimer.current=setTimeout(()=>{setFolderMenu(id);folderPressTimer.current=null;},550);};
 useEffect(()=>()=>clearFolderPress(),[]);
 const key=storageKey(userId);
 const journalKey=key+":journal-v1";
 useEffect(()=>{try{const raw=JSON.parse(localStorage.getItem(journalKey)||"[]");setJournal(Array.isArray(raw)?raw:[]);}catch{setJournal([]);setError("방문일지 데이터를 읽지 못했어요. 기존 기록은 보존했습니다.");}},[journalKey]);
 const saveJournal=next=>{try{localStorage.setItem(journalKey,JSON.stringify(next));setJournal(next);setError("");return true;}catch(e){setError("방문일지 저장 실패: "+e.message);return false;}};
 const openJournal=id=>{setJournalPlace(id);setJournalEditing("");setJournalDate(today());setJournalNote("");setTab("journal");};
 const submitJournal=()=>{if(journalPlace==="all"){setError("방문한 장소를 선택해 주세요.");return;}if(!journalNote.trim()){setError("방문 메모를 입력해 주세요.");return;}const entry={id:journalEditing||newId(),placeId:journalPlace,date:journalDate,note:journalNote.trim(),photoIds:journalEditing?(journal.find(x=>x.id===journalEditing)?.photoIds||[]):[],updatedAt:new Date().toISOString()};const next=journalEditing?journal.map(x=>x.id===journalEditing?entry:x):[entry,...journal];if(saveJournal(next)){setJournalEditing("");setJournalNote("");}};
 const editJournal=entry=>{setJournalPlace(entry.placeId);setJournalDate(entry.date);setJournalNote(entry.note);setJournalEditing(entry.id);};
 const deleteJournal=async id=>{if(!window.confirm("이 방문 기록과 첨부 사진을 삭제할까요?"))return;const entry=journal.find(x=>x.id===id);if(saveJournal(journal.filter(x=>x.id!==id))){if(journalEditing===id){setJournalEditing("");setJournalNote("");}for(const photoId of entry?.photoIds||[]){try{await routeImageDelete(photoId)}catch{setError("방문 기록은 삭제됐지만 일부 사진 파일 정리에 실패했어요.");}}}};
 const addJournalPhotos=async(entry,files)=>{const images=Array.from(files||[]).filter(file=>file.type.startsWith("image/"));if(!images.length)return;const added=[];try{for(const file of images){if(file.size>12*1024*1024)throw new Error("사진 한 장은 12MB 이하로 선택해 주세요.");const id="journal:"+entry.id+":"+newId();await routeImagePut(id,file);added.push(id);}
 const current=journal.find(x=>x.id===entry.id);if(!current)throw new Error("방문 기록을 찾지 못했어요.");const next=journal.map(x=>x.id===entry.id?{...x,photoIds:[...(x.photoIds||[]),...added]}:x);if(!saveJournal(next))throw new Error("사진 목록을 저장하지 못했어요.");}catch(e){for(const id of added)try{await routeImageDelete(id)}catch{}setError("사진 첨부 실패: "+e.message);}};
 const removeJournalPhoto=async(entry,id)=>{if(!window.confirm("이 사진을 삭제할까요?"))return;const next=journal.map(x=>x.id===entry.id?{...x,photoIds:(x.photoIds||[]).filter(p=>p!==id)}:x);if(saveJournal(next))try{await routeImageDelete(id)}catch{setError("사진 목록에서 제거했지만 저장 파일 삭제에 실패했어요.");}};
 useEffect(()=>{try{const value=JSON.parse(localStorage.getItem(key)||"{}");setPlaces(Array.isArray(value.places)?value.places.map(cleanPlace):[]);setVisits(value.visits&&typeof value.visits==="object"?value.visits:Object.fromEntries(Object.entries(value.routes||{}).map(([day,ids])=>[day,Object.fromEntries((Array.isArray(ids)?ids:[]).map(id=>[id,visitFrom((value.places||[]).find(p=>p.id===id))]))])));setFolders(Array.isArray(value.folders)?value.folders:[]);setRoutes(value.routes&&typeof value.routes==="object"?value.routes:{});setSelected("");setEditing("");setError("")}catch{setPlaces([]);setRoutes({});setVisits({});setFolders([]);setError("동선 데이터를 읽지 못했어요. 기존 저장값은 변경하지 않았습니다.")}},[key]);
 const save=(nextPlaces,nextRoutes,nextFolders=folders,nextVisits=visits)=>{try{localStorage.setItem(key,JSON.stringify({places:nextPlaces.map(cleanPlace),routes:nextRoutes,folders:nextFolders,visits:nextVisits}));setFolders(nextFolders);setPlaces(nextPlaces.map(cleanPlace));setRoutes(nextRoutes);setVisits(nextVisits);setError("")}catch(e){setError("저장 실패: "+e.message)}};
 const addSubfolder=parentId=>{const parent=folders.find(f=>f.id===parentId);if(!parent||parent.parentId)return;const name=window.prompt("2차 분류 이름을 입력해 주세요.");if(!name?.trim())return;if(folders.some(f=>f.parentId===parentId&&f.name===name.trim())){setError("같은 이름의 2차 분류가 있어요.");return}const f={id:newId(),name:name.trim(),parentId};save(places,routes,[...folders,f]);setFolderFilter(f.id)};
 const addFolder=()=>{const name=window.prompt("새 폴더 이름을 입력해 주세요.");if(!name?.trim())return;const value=name.trim();if(folders.some(f=>!f.parentId&&f.name===value)){setError("같은 이름의 폴더가 있어요.");return}const f={id:newId(),name:value};save(places,routes,[...folders,f]);setFolderFilter(f.id)};
 const renameFolder=id=>{const f=folders.find(x=>x.id===id);if(!f)return;const name=window.prompt("폴더 이름 수정",f.name);if(!name?.trim()||name.trim()===f.name)return;if(folders.some(x=>x.id!==id&&x.parentId===f.parentId&&x.name===name.trim())){setError("같은 이름의 폴더가 있어요.");return}save(places,routes,folders.map(x=>x.id===id?{...x,name:name.trim()}:x))};
 const removeFolder=id=>{const f=folders.find(x=>x.id===id);if(!f||!window.confirm('"'+f.name+'" 분류를 삭제할까요? 하위 분류의 장소도 미분류로 이동해요.'))return;const ids=new Set([id,...folders.filter(x=>x.parentId===id).map(x=>x.id)]);save(places.map(p=>ids.has(p.folderId)?{...p,folderId:""}:p),routes,folders.filter(x=>!ids.has(x.id)));setFolderFilter("all")};
 const stops=routes[date]||[];
 const visiblePlaces=places.filter(p=>(visitFilter==="all"||(visitFilter==="visited"?!!p.visited:!p.visited))&&(folderFilter==="all"||folderFilter==="none"&&!p.folderId||p.folderId===folderFilter||folders.some(f=>f.parentId===folderFilter&&f.id===p.folderId))&&(!placeQuery.trim()||(p.name+" "+(p.address||"")).toLocaleLowerCase().includes(placeQuery.trim().toLocaleLowerCase())));
 const ordered=stops.map(id=>{const p=places.find(p=>p.id===id);return p?{...p,...blankVisit(),...(visits[date]?.[id]||{}),id:p.id}:null}).filter(Boolean);
 const picked=places.find(p=>p.id===selected)||ordered[0]||null;
 const updatePlace=p=>save(places.map(x=>x.id===p.id?cleanPlace(p):x),routes);
 const updateVisit=p=>save(places,routes,folders,{...visits,[date]:{...(visits[date]||{}),[p.id]:visitFrom(p)}});
 const add=()=>{if(!draft.name.trim()){setError("장소 이름을 입력해 주세요.");return}const p={...draft,name:draft.name.trim(),address:draft.address.trim()};save([...places,cleanPlace(p)],{...routes,[date]:[...stops,p.id]},folders,{...visits,[date]:{...(visits[date]||{}),[p.id]:visitFrom({...blankVisit(),...draft,minutes:mins(draft.minutes)})}});setDraft(blank());setSelected(p.id);setTab("route")};
 const addSearchResult=(item,target="route")=>{
  const existing=places.find(p=>String(p.kakaoPlaceId)===String(item.id));
  const p=existing||{...blank(),name:item.place_name,address:item.road_address_name||item.address_name||"",lat:Number(item.y),lng:Number(item.x),kakaoPlaceId:item.id};
  const nextPlaces=existing?places:[...places,cleanPlace(p)];
  if(target==="saved"){if(existing){setError("이미 장소함에 저장된 장소예요.");return;}save(nextPlaces,routes);return;}
  if(stops.includes(p.id)){setError("이미 오늘 동선에 있는 장소예요.");return;}
  save(nextPlaces,{...routes,[date]:[...stops,p.id]},folders,{...visits,[date]:{...(visits[date]||{}),[p.id]:visits[date]?.[p.id]||blankVisit()}});setSelected(p.id);
 };
 const reorder=(id,dir)=>{const i=stops.indexOf(id),j=i+dir;if(j<0||j>=stops.length)return;const copy=[...stops];[copy[i],copy[j]]=[copy[j],copy[i]];save(places,{...routes,[date]:copy})};
 const removeFromDay=id=>{if(!window.confirm("오늘 동선에서만 제외할까요? 장소함에는 남아 있어요."))return;save(places,{...routes,[date]:stops.filter(x=>x!==id)})};
 const addExisting=id=>{if(stops.includes(id))return;save(places,{...routes,[date]:[...stops,id]},folders,{...visits,[date]:{...(visits[date]||{}),[id]:visits[date]?.[id]||blankVisit()}})};
 const deletePlace=id=>{if(!window.confirm("장소함과 모든 날짜의 동선에서 삭제할까요?"))return;const next={};Object.keys(routes).forEach(day=>next[day]=routes[day].filter(x=>x!==id));const nextVisits={};Object.entries(visits).forEach(([day,items])=>{const copy={...items};delete copy[id];nextVisits[day]=copy});save(places.filter(x=>x.id!==id),next,folders,nextVisits);if(selected===id)setSelected("")};
 const routeLinks=(p,i)=>{if(!i)return null;const prev=ordered[i-1],from=prev.address||prev.name,to=p.address||p.name;const link=kakaoDirections(prev,p,p.mode);return <div className="route-move"><span>↳ {prev.name} → {p.name} · {modes[p.mode]||"대중교통"}</span><a target="_blank" rel="noopener noreferrer" href={link||kakaoRouteSearch}>{link?"카카오맵 경로 확인":"카카오맵 길찾기 (장소 선택 필요)"} <ExternalLink size={12}/></a>{!link&&<small>두 장소의 지도 좌표를 저장하면 출발지·도착지가 자동 입력돼요.</small>}<a target="_blank" rel="noopener noreferrer" href={mapsDirection(from,to,p.mode||"transit")}>구글 길찾기 <ExternalLink size={12}/></a></div>};
 const form=(p,isEdit=false,placeOnly=false)=><div className="route-form">
  <label>장소 이름<input value={p.name} placeholder="예: 병원, 카페, 서울숲" onChange={e=>isEdit?updatePlace({...p,name:e.target.value}):setDraft({...p,name:e.target.value})}/></label>
  <label>주소 또는 검색어<input value={p.address} placeholder="도로명 주소나 장소 검색어" onChange={e=>isEdit?updatePlace({...p,address:e.target.value}):setDraft({...p,address:e.target.value})}/></label>
  {!placeOnly&&<><div className="route-form-grid"><label>도착 예정<input type="time" value={p.time} onChange={e=>isEdit?updateVisit({...p,time:e.target.value}):setDraft({...p,time:e.target.value})}/></label>
  <label>체류 (분)<input type="number" min="0" step="5" value={p.minutes} onChange={e=>isEdit?updateVisit({...p,minutes:e.target.value}):setDraft({...p,minutes:e.target.value})}/></label></div>
  <label>직전 장소에서 이동<select value={p.mode} onChange={e=>isEdit?updateVisit({...p,mode:e.target.value}):setDraft({...p,mode:e.target.value})}>{Object.entries(modes).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
  </>}
  <label>방문 여부<select value={p.visited?"visited":"unvisited"} onChange={e=>isEdit?updatePlace({...p,visited:e.target.value==="visited"}):setDraft({...p,visited:e.target.value==="visited"})}><option value="unvisited">미방문</option><option value="visited">방문</option></select></label>
  <label>장소함 폴더<select value={p.folderId||""} onChange={e=>isEdit?updatePlace({...p,folderId:e.target.value}):setDraft({...p,folderId:e.target.value})}><option value="">미분류</option>{folders.map(f=><option key={f.id} value={f.id}>{f.parentId?(folders.find(x=>x.id===f.parentId)?.name||"1차")+" / ":""}{f.name}</option>)}</select></label>
  {!placeOnly&&<><RouteMemoEditor value={p} onSave={changes=>isEdit?updateVisit({...p,...changes}):setDraft({...p,...changes})}/>
  </>}
  {isEdit?<button className="route-primary" type="button" onClick={()=>setEditing("")}>수정 닫기</button>:<button className="route-primary" type="button" onClick={add}><Plus size={16}/> 동선에 추가</button>}
 </div>;
 const mapQuery= picked ? (picked.address||picked.name) : "대한민국";
 const mapUrl="https://maps.google.com/maps?q="+encodeURIComponent(mapQuery)+"&output=embed";
 return <section className="route-flow">
  <div className="route-title"><div><small>ROUTE FLOW</small><h1>하루 동선</h1><p>시간 · 장소 · 이동 경로를 한눈에</p></div><label aria-label="날짜 선택"><CalendarDays size={16}/><input type="date" value={date} onChange={e=>{setDate(e.target.value);setSelected("");setEditing("")}}/></label></div>

  
  {error&&<p role="alert" className="route-error">{error}</p>}
  {tab==="today"&&<><div className="route-section-head"><h2>{date} 일정</h2><button onClick={()=>setTab("route")}>동선 편집</button></div>{!ordered.length?<p className="route-empty">아직 방문 장소가 없어요. 동선 탭에서 첫 장소를 추가해 봐요.</p>:ordered.map((p,i)=><div key={p.id}>{routeLinks(p,i)}<article className="route-stop"><div className="route-no">{i+1}</div><div className="route-stop-body"><strong>{p.time} · {p.name}</strong><small>{p.fixed?"🔒 예약 고정 · ":""}{p.minutes}분 체류{p.time?" · "+timeAdd(p.time,p.minutes)+" 종료 예상":""}</small><RouteMemoView notes={p.notes} checklist={p.checklist} onToggle={(id,done)=>updateVisit({...p,checklist:(p.checklist||[]).map(n=>n.id===id?{...n,done}:n)})}/></div></article></div>)}</>}
  {tab==="route"&&<><div className="route-section-head"><h2>방문 순서</h2><span>위아래 화살표로 정렬</span></div>{ordered.map((p,i)=><div key={p.id}>{routeLinks(p,i)}<article className="route-stop route-stop-compact"><div className="route-no">{i+1}</div><div className="route-stop-body"><strong>{p.name}</strong><small>{p.time} · {p.minutes}분{p.fixed?" · 예약 고정":""}</small><RouteMemoView notes={p.notes} checklist={p.checklist}/></div><div className="route-icon-actions"><button type="button" title="수정" aria-label={p.name+" 수정"} onClick={()=>{setEditing(editing===p.id?"":p.id);setSelected(p.id)}}><Pencil size={17}/></button><button type="button" title="동선에서 제외" aria-label={p.name+" 동선에서 제외"} onClick={()=>removeFromDay(p.id)}><Trash2 size={17}/></button><button type="button" title="위로" aria-label={p.name+" 위로"} disabled={i===0} onClick={()=>reorder(p.id,-1)}><ChevronUp size={18}/></button><button type="button" title="아래로" aria-label={p.name+" 아래로"} disabled={i===ordered.length-1} onClick={()=>reorder(p.id,1)}><ChevronDown size={18}/></button></div></article>{editing===p.id&&form(p,true)}</div>)}</>}
  {tab==="map"&&<><div className="route-section-head"><h2>카카오 지도 · 장소 검색</h2></div><KakaoRouteMap ordered={ordered} picked={picked} onPick={setSelected} onAddRoute={item=>addSearchResult(item,"route")} onAddSaved={item=>addSearchResult(item,"saved")}/></>}
  {tab==="saved"&&<><div className="route-section-head"><h2>장소함</h2><button type="button" onClick={addFolder}><FolderPlus size={16}/> 새 폴더</button></div><div className="route-folder-filter">
 <button className={folderFilter==="all"?"active":""} onClick={()=>{setFolderFilter("all");setFolderMenu("");}}>전체 {places.length}</button>
 <button className={folderFilter==="none"?"active":""} onClick={()=>{setFolderFilter("none");setFolderMenu("");}}>미분류 {places.filter(p=>!p.folderId).length}</button>
 {folders.filter(f=>!f.parentId).map(f=><React.Fragment key={f.id}>
  <div className="route-folder-chip" onPointerDown={e=>{if(!e.target.closest("button"))startFolderPress(f.id)}} onPointerUp={clearFolderPress} onPointerCancel={clearFolderPress} onPointerLeave={clearFolderPress} onContextMenu={e=>{e.preventDefault();clearFolderPress();setFolderMenu(f.id)}}>
   <button className={folderFilter===f.id||folders.some(x=>x.parentId===f.id&&x.id===folderFilter)?"active":""} onPointerDown={()=>startFolderPress(f.id)} onPointerUp={clearFolderPress} onPointerLeave={clearFolderPress} onPointerCancel={clearFolderPress} onClick={()=>{setFolderFilter(folderFilter===f.id?"all":f.id);setFolderMenu("");}}><Folder size={13}/>{f.name} {places.filter(p=>p.folderId===f.id||folders.some(x=>x.parentId===f.id&&x.id===p.folderId)).length}</button>
  </div>
  {folderMenu===f.id&&<div className="route-folder-menu" role="group" aria-label={f.name+" 폴더 관리"}><button type="button" onClick={()=>{setFolderMenu("");addSubfolder(f.id)}}><FolderPlus size={14}/> 하위 분류 추가</button><button type="button" onClick={()=>{setFolderMenu("");renameFolder(f.id)}}><Pencil size={14}/> 편집</button><button type="button" onClick={()=>{setFolderMenu("");removeFolder(f.id)}}><Trash2 size={14}/> 삭제</button><button type="button" onClick={()=>setFolderMenu("")}>취소</button></div>}
  {(folderFilter===f.id||folders.some(x=>x.parentId===f.id&&x.id===folderFilter))&&folders.filter(x=>x.parentId===f.id).map(sub=><React.Fragment key={sub.id}>
   <div className="route-folder-chip route-subfolder"><button className={folderFilter===sub.id?"active":""} onPointerDown={()=>startFolderPress(sub.id)} onPointerUp={clearFolderPress} onPointerLeave={clearFolderPress} onPointerCancel={clearFolderPress} onContextMenu={e=>{e.preventDefault();clearFolderPress();setFolderMenu(sub.id)}} onClick={()=>{setFolderFilter(sub.id);setFolderMenu("");}}><Folder size={13}/>{sub.name} {places.filter(p=>p.folderId===sub.id).length}</button></div>
   {folderMenu===sub.id&&<div className="route-folder-menu" role="group" aria-label={sub.name+" 폴더 관리"}><button type="button" onClick={()=>{setFolderMenu("");renameFolder(sub.id)}}><Pencil size={14}/> 편집</button><button type="button" onClick={()=>{setFolderMenu("");removeFolder(sub.id)}}><Trash2 size={14}/> 삭제</button><button type="button" onClick={()=>setFolderMenu("")}>취소</button></div>}
  </React.Fragment>)}
 </React.Fragment>)}</div><div className="route-visit-filter" role="group" aria-label="방문 여부 필터"><button type="button" className={visitFilter==="all"?"active":""} onClick={()=>setVisitFilter("all")}>전체 {places.length}</button><button type="button" className={visitFilter==="unvisited"?"active":""} onClick={()=>setVisitFilter("unvisited")}>미방문 {places.filter(p=>!p.visited).length}</button><button type="button" className={visitFilter==="visited"?"active":""} onClick={()=>setVisitFilter("visited")}>방문 {places.filter(p=>!!p.visited).length}</button></div><input className="route-place-filter-input" aria-label="장소 검색 필터" placeholder="저장한 장소 검색" value={placeQuery} onChange={e=>setPlaceQuery(e.target.value)}/><p className="route-filter-count">{visiblePlaces.length}곳 표시 · 전체 {places.length}곳</p>{!visiblePlaces.length&&<p className="route-empty">이 조건에 해당하는 장소가 없어요.</p>}{visiblePlaces.map(p=><React.Fragment key={p.id}><article className="route-saved" onClick={e=>{if(suppressPlaceClick.current){suppressPlaceClick.current=false;return;}if(!e.target.closest("button"))openJournal(p.id)}} onPointerDown={e=>{if(e.target.closest("button"))return;startPlacePress(p.id)}} onPointerUp={clearLongPress} onPointerCancel={clearLongPress} onPointerLeave={clearLongPress} onContextMenu={e=>{e.preventDefault();clearLongPress();suppressPlaceClick.current=true;setPlaceMenu(p.id)}} style={{touchAction:"pan-y",userSelect:"none"}}><div><strong>{p.name}</strong><small>{p.address||"주소 미입력"} · {folders.find(f=>f.id===p.folderId)?.name||"미분류"} · {p.visited?"방문":"미방문"}</small></div><div className="route-icon-actions"><button title="오늘 동선에 추가" aria-label={p.name+" 오늘 동선에 추가"} disabled={stops.includes(p.id)} onClick={()=>save(places,{...routes,[date]:[...stops,p.id]})}>{stops.includes(p.id)?<Check size={17}/>:<Plus size={17}/>}</button></div></article>{placeMenu===p.id&&<div className="route-place-context" role="group" aria-label={p.name+" 관리"}><button type="button" onClick={()=>{setEditing(p.id);setPlaceMenu("");}}><Pencil size={16}/> 편집</button><button type="button" onClick={()=>{setPlaceMenu("");deletePlace(p.id);}}><Trash2 size={16}/> 삭제</button><button type="button" onClick={()=>setPlaceMenu("")}>취소</button></div>}{editing===p.id&&form(p,true,true)}</React.Fragment>)}</>}
  {tab==="journal"&&<div className="route-journal">
   <div className="route-section-head"><h2>방문일지</h2><span>{journal.length}개 기록</span></div>
   <label>장소 선택<select value={journalPlace} onChange={e=>{setJournalPlace(e.target.value);setJournalEditing("");setJournalNote("");}}><option value="all">전체 장소의 기록</option>{places.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   {journalPlace!=="all"&&<div className="route-journal-editor">
    <label>방문 날짜<input type="date" value={journalDate} onChange={e=>setJournalDate(e.target.value)}/></label>
    <label>방문 노트<textarea rows={5} value={journalNote} placeholder="방문 후 느낀 점, 구매한 것, 다음에 기억할 내용을 적어 주세요." onChange={e=>setJournalNote(e.target.value)}/></label>
    <div className="route-journal-actions"><button type="button" className="route-primary" onClick={submitJournal}>{journalEditing?"기록 수정":"방문일지 저장"}</button>{journalEditing&&<button type="button" onClick={()=>{setJournalEditing("");setJournalNote("");setJournalDate(today());}}>취소</button>}</div>
   </div>}
   <div className="route-journal-list">{journal.filter(x=>journalPlace==="all"||x.placeId===journalPlace).sort((a,b)=>b.date.localeCompare(a.date)||String(b.updatedAt||"").localeCompare(String(a.updatedAt||""))).map(entry=><article key={entry.id} className="route-journal-entry"><div><strong>{places.find(p=>p.id===entry.placeId)?.name||"삭제된 장소"}</strong><small>{entry.date}</small></div><p>{entry.note}</p><div className="route-journal-photos">{(entry.photoIds||[]).map(id=><RouteJournalPhoto key={id} photoId={id} onRemove={photoId=>removeJournalPhoto(entry,photoId)}/>)}</div><label className="route-journal-upload"><ImagePlus size={16}/> 사진 첨부<input type="file" accept="image/*" multiple onChange={async e=>{const files=Array.from(e.target.files||[]);e.target.value="";await addJournalPhotos(entry,files)}}/></label><div className="route-journal-actions"><button type="button" onClick={()=>editJournal(entry)}>편집</button><button type="button" onClick={()=>deleteJournal(entry.id)}>삭제</button></div></article>)}</div>
   {!journal.some(x=>journalPlace==="all"||x.placeId===journalPlace)&&<p className="route-empty">아직 방문 기록이 없어요. 장소함에서 장소를 선택해 첫 기록을 남겨보세요.</p>}
  </div>}
  {createPortal(<nav className="route-tabs" aria-label="루트 메뉴">{[["today","오늘",CalendarDays],["route","동선",RouteIcon],["map","지도",MapIcon],["saved","장소함",Bookmark],["journal","방문일지",NotebookPen]].map(([id,label,Icon])=><button type="button" key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><Icon size={17}/>{label}</button>)}</nav>,document.body)}
  
 </section>
}
