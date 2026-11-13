// Cloudflare Pages Function: same-origin authenticated proxy. Never send provider keys to browser.
const SUPABASE_URL = "https://cntwtmaqyjwtnpybjare.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_8tjs1LsNSb2Ro0Hlw7Ka0A_-a60Ak8U";
const response = (body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const errorMessage = status=>status===401?"API 인증 실패":status===403?"API 접근 권한 또는 사용량 제한":status===429?"API 호출 한도 초과":"외부 API 응답 오류";
const clean = s=>String(s??"").replace(/<[^>]*>/g,"").replace(/&(?:amp|lt|gt|quot|apos|#39);/g,m=>({"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'","&#39;":"'"}[m]||m)).trim();
const take = (v,max=100)=>String(v||"").trim().slice(0,max);
async function authorized(request) {
  const bearer=request.headers.get("Authorization")||"";
  if(!/^Bearer\s+\S+$/.test(bearer))return false;
  const res=await fetch(SUPABASE_URL+"/auth/v1/user", {headers:{Authorization:bearer,apikey:SUPABASE_PUBLIC_KEY},signal:AbortSignal.timeout(7000)});
  return res.ok;
}
async function fetchJson(url,options={}){
  const res=await fetch(url,{...options,signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw new Error(errorMessage(res.status)+" ("+res.status+")");
  return res.json();
}
const youtubeVideo = v=>({
  id:v.id, title:v.snippet?.title||"",description:v.snippet?.description||"",publishedAt:v.snippet?.publishedAt||"",
  channel:v.snippet?.channelTitle||"",thumbnail:v.snippet?.thumbnails?.medium?.url||"",
  views:v.statistics?.viewCount??null, likes:v.statistics?.likeCount??null, comments:v.statistics?.commentCount??null,
  url:"https://www.youtube.com/watch?v="+v.id,
});
async function youtube(request,env,kind){
  if(!env.YOUTUBE_API_KEY)return response({configured:false,provider:"youtube",error:"Cloudflare 환경 변수 YOUTUBE_API_KEY가 설정되지 않았어."},503);
  const u=new URL(request.url),q=take(u.searchParams.get("q"),100),days=Math.min(365,Math.max(1,Number(u.searchParams.get("days"))||30));
  const count=Math.min(50,Math.max(1,Number(u.searchParams.get("count"))||20));
  const params=new URLSearchParams({part:"snippet",maxResults:String(count),regionCode:"KR",key:env.YOUTUBE_API_KEY});
  if(kind==="popular"){params.set("chart","mostPopular");params.set("videoCategoryId",["10","24","1"].includes(u.searchParams.get("category"))?u.searchParams.get("category"):"24");
    const data=await fetchJson("https://www.googleapis.com/youtube/v3/videos?"+params);
    return response({provider:"youtube",kind,observedAt:new Date().toISOString(),items:(data.items||[]).map(youtubeVideo),note:"유튜브 선정 현재 인기 차트. 7일·30일 업로드 기간 필터 없음."});
  }
  if(!q)return response({error:"검색 키워드를 입력해 줘."},400);
  const from=new Date(Date.now()-days*864e5).toISOString();
  const order=["viewCount","date","relevance"].includes(u.searchParams.get("order"))?u.searchParams.get("order"):"viewCount";
  params.set("type","video");params.set("q",q);params.set("order",order);params.set("publishedAfter",from);
  // search.list uses substantial quota (100 units); videos.list adds 1 unit.
  const found=await fetchJson("https://www.googleapis.com/youtube/v3/search?"+params);
  const ids=(found.items||[]).map(x=>x.id?.videoId).filter(Boolean);
  if(!ids.length)return response({provider:"youtube",kind,items:[],observedAt:new Date().toISOString()});
  const detail=await fetchJson("https://www.googleapis.com/youtube/v3/videos?"+new URLSearchParams({part:"snippet,statistics",id:ids.join(","),key:env.YOUTUBE_API_KEY}));
  const map=new Map((detail.items||[]).map(v=>[v.id,youtubeVideo(v)]));
  return response({provider:"youtube",kind,q,days,order,observedAt:new Date().toISOString(),items:ids.map(id=>map.get(id)).filter(Boolean),note:"조회수순은 검색 API 결과에 대한 누적 조회수순이며 7·30일 동안의 조회수 증가량이 아님. 검색 결과는 불완전할 수 있음."});
}
async function naver(request,env,kind){
  const id=env.NAVER_API_KEY_ID,secret=env.NAVER_API_KEY;
  if(!id||!secret)return response({configured:false,provider:"naver",error:"Cloudflare 환경 변수 NAVER_API_KEY_ID / NAVER_API_KEY 설정이 필요해."},503);
  const u=new URL(request.url),q=take(u.searchParams.get("q"),100);
  if(!q)return response({error:"검색어가 필요해."},400);
  const headers={"X-NCP-APIGW-API-KEY-ID":id,"X-NCP-APIGW-API-KEY":secret};
  const base="https://naverapihub.apigw.ntruss.com";
  if(kind==="news"){
    const params=new URLSearchParams({query:q,display:"30",sort:u.searchParams.get("sort")==="sim"?"sim":"date"});
    const data=await fetchJson(base+"/search/v1/news?"+params,{headers});
    return response({provider:"naver",kind,q,observedAt:new Date().toISOString(),items:(data.items||[]).map(x=>({title:clean(x.title),description:clean(x.description),url:x.originallink||x.link,pubDate:x.pubDate})),total:data.total,note:"최신순/정확도순 검색 결과. 기사 조회수 인기순위가 아님."});
  }
  const days=Math.min(365,Math.max(7,Number(u.searchParams.get("days"))||30));
  const end=new Date(),start=new Date(end.getTime()-(days-1)*864e5);
  const date=d=>d.toISOString().slice(0,10);
  const body={startDate:date(start),endDate:date(end),timeUnit:"date",keywordGroups:[{groupName:q,keywords:[q]}]};
  const data=await fetchJson(base+"/search-trend/v1/search",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify(body)});
  return response({provider:"naver",kind,q,observedAt:new Date().toISOString(),results:data.results||[],note:"최대값 100 기준 상대 검색 관심도. 실제 검색 횟수가 아님."});
}
function xmlField(xml,field){const m=xml.match(new RegExp("<(?:[\\w-]+:)?"+field+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?"+field+">","i"));return m?clean(m[1].replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g,"$1")):"";}
async function rss(){
  const res=await fetch("https://trends.google.com/trending/rss?geo=KR",{headers:{"User-Agent":"Mozilla/5.0 (compatible; FocusFlowTrend/1.0)"},signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw new Error("구글 트렌드 RSS 응답 오류 ("+res.status+")");
  const xml=await res.text();
  const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,100).map(m=>{
    const x=m[1];return {title:xmlField(x,"title"),traffic:xmlField(x,"approx_traffic"),pubDate:xmlField(x,"pubDate"),url:xmlField(x,"link"),picture:xmlField(x,"picture")};
  }).filter(x=>x.title);
  return response({provider:"google",kind:"rss",observedAt:new Date().toISOString(),items,note:"Google Trends 한국 급상승 RSS. 전체 검색 인기순위나 엔터 분야 공식 순위가 아님."});
}
export async function onRequestGet({request,env}){
  try{
    if(!(await authorized(request)))return response({error:"로그인이 필요한 요청이야."},401);
    const u=new URL(request.url),kind=u.searchParams.get("kind")||"rss";
    if(kind==="rss")return await rss();
    if(kind==="popular"||kind==="search")return await youtube(request,env,kind);
    if(kind==="news"||kind==="interest")return await naver(request,env,kind);
    return response({error:"지원하지 않는 데이터 소스야."},400);
  }catch(e){return response({error:e.message||"요청을 처리하지 못했어."},502);}
}
