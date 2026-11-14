import React, {useEffect,useRef,useState} from "react";
const DB="focus-route-subway-map-v1", STORE="maps", KEY="seoul";
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function readMap(){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readonly");const req=tx.objectStore(STORE).get(KEY);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();});}
async function saveMap(blob){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(blob,KEY);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
export function SubwayMapShortcut(){
 const [open,setOpen]=useState(false),[blob,setBlob]=useState(null),[error,setError]=useState(""),[zoom,setZoom]=useState(1);
 const input=useRef(null);
 useEffect(()=>{if(!open)return;let alive=true;readMap().then(v=>{if(alive)setBlob(v)}).catch(()=>{if(alive)setError("저장된 노선도를 읽지 못했어요.")});return()=>{alive=false};},[open]);
 const [url,setUrl]=useState("");
 useEffect(()=>{if(!blob){setUrl("");return;}const objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);return()=>URL.revokeObjectURL(objectUrl);},[blob]);
 async function upload(e){const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")&&file.type!=="application/pdf"){setError("이미지 또는 PDF 파일만 저장할 수 있어요.");return;}try{await saveMap(file);setBlob(file);setError("");setZoom(1);}catch{setError("IndexedDB 저장에 실패했어요. 브라우저 저장 공간을 확인해 주세요.");}e.target.value="";}
 return <>
 <button type="button" onClick={()=>setOpen(true)} title="서울 지하철 노선도" aria-label="서울 지하철 노선도" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:32,height:32,border:0,borderRadius:9,background:"#f0e9ff",fontSize:19,cursor:"pointer"}}>🗺️</button>
 {open&&<div role="dialog" aria-modal="true" aria-label="서울 지하철 노선도" style={{position:"fixed",inset:0,zIndex:99999,background:"#fff",display:"flex",flexDirection:"column"}}>
  <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 14px",borderBottom:"1px solid #eee",flexWrap:"wrap"}}>
   <strong style={{flex:1}}>서울 지하철 노선도</strong>
   <button type="button" onClick={()=>input.current?.click()}>노선도 {blob?"교체":"저장"}</button>
   <button type="button" onClick={()=>setOpen(false)} aria-label="닫기">✕</button>
   <input ref={input} type="file" accept="image/*,application/pdf" onChange={upload} style={{display:"none"}}/>
  </div>
  {error&&<p role="alert" style={{padding:"0 14px",color:"#b42318"}}>{error}</p>}
  {url?<div style={{flex:1,overflow:"auto",background:"#f6f6f6",textAlign:"center",padding:10}}>
    {blob.type==="application/pdf"?<iframe title="저장된 서울 지하철 노선도 PDF" src={url} style={{width:"100%",height:"100%",border:0}}/>:<img src={url} alt="저장된 서울 지하철 노선도" style={{maxWidth:"none",width:(zoom*100)+"%",height:"auto"}}/>}
   </div>:<div style={{flex:1,padding:20,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,textAlign:"center"}}>
    <div style={{fontSize:42}}>🗺️</div><strong>노선도 파일을 한 번 저장해 주세요</strong><p>공식 노선도 이미지나 PDF를 선택하면 이 기기의 IndexedDB에 저장되어 다음부터 오프라인으로 볼 수 있어요.</p>
    <button type="button" onClick={()=>input.current?.click()}>이미지 · PDF 선택</button>
    <a href="https://www.seoulmetro.co.kr/kr/cyberStation.do" target="_blank" rel="noopener noreferrer">서울교통공사 공식 노선도 보기</a>
   </div>}
  {url&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,padding:8,borderTop:"1px solid #eee"}}>
   {blob.type!=="application/pdf"&&<><button type="button" onClick={()=>setZoom(v=>Math.max(1,v/1.5))}>－</button><span>{Math.round(zoom*100)}%</span><button type="button" onClick={()=>setZoom(v=>Math.min(8,v*1.5))}>＋</button></>}
   <small>이 기기에 저장됨 · 다른 기기와 동기화되지 않음</small>
  </div>}
 </div>}
 </>;
}