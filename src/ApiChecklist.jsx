import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';

const groups = [
  {name:'Culture Flow · 축제 포함', items:[
    ['tourapi','한국관광공사 TourAPI','전국 축제·행사·관광정보','공공데이터포털','https://www.data.go.kr/data/15101578/openapi.do'],
    ['festivals','전국문화축제 표준데이터','지역축제 일정·장소·내용·좌표','공공데이터포털','https://www.data.go.kr/data/15013104/standard.do'],
    ['seoul-events','서울시 문화행사 정보','서울 공연·전시·행사·유무료 정보','서울 열린데이터광장','https://data.seoul.go.kr/dataList/OA-15486/S/1/datasetView.do?tab=A'],
    ['culture-api','문화포털 API','전국 공연·전시 API 이용 안내','문화포털','https://www.culture.go.kr/portal/main/contents.do?menuNo=200155'],
    ['seoul-reservations','서울시 공공서비스예약 종합 정보','체험·교육·문화행사 예약정보','서울 열린데이터광장','https://data.seoul.go.kr/dataList/OA-20497/S/1/datasetView.do'],
    ['classes','전국평생학습강좌 표준데이터','문화·평생교육 강좌·수강료·접수기간','공공데이터포털','https://www.data.go.kr/data/15013110/standard.do'],
  ]},
  {name:'Walk Flow', items:[
    ['seoul-parks','서울시 주요 공원현황','서울 주요 공원 설명·사진·시설·좌표','서울 열린데이터광장','https://data.seoul.go.kr/dataList/OA-394/S/1/datasetView.do?tab=A'],
    ['parks','전국도시공원정보 표준데이터','동네 공원까지 목록 확장·주소·시설','공공데이터포털','https://www.data.go.kr/data/15012890/standard.do'],
    ['hiking','산림청 등산로정보','산별 등산로 자료·등산 안내','공공데이터포털','https://www.data.go.kr/data/15002734/openapi.do'],
    ['seoul-trails','서울시 둘레길 선형 위치정보','지도 경로 좌표 · 현행화 중단 자료로 최신 코스 대조 필요','서울 열린데이터광장','https://data.seoul.go.kr/dataList/OA-11986/S/1/datasetView.do'],
  ]},
  {name:'Home Flow · 서울·경기 아파트', items:[
    ['home-apt-list','공동주택 단지 목록제공 서비스','서울·경기 아파트 단지 목록·단지코드 조회','공공데이터포털','https://www.data.go.kr/data/15057332/openapi.do'],
    ['home-apt-basic','공동주택 기본 정보제공 서비스','주소·세대수·난방 등 단지 기본정보','공공데이터포털','https://www.data.go.kr/data/15058453/openapi.do'],
    ['home-apt-trade','아파트 매매 실거래가 자료','지역·계약월별 신고된 아파트 매매 거래','공공데이터포털','https://www.data.go.kr/data/15126469/openapi.do'],
    ['home-apt-rent','아파트 전월세 실거래가 자료','지역·계약월별 전세·월세 실거래 내역','공공데이터포털','https://www.data.go.kr/data/15126474/openapi.do'],
  ]},

  {name:'Trend Flow · Market Flow · Chart / Playlist', items:[
    ['naver-api-hub','NAVER API HUB — 검색·트렌드·쇼핑','Trend·Market: 검색, 검색어 트렌드, 쇼핑인사이트 제공 범위 확인','NAVER Cloud','https://api.ncloud-docs.com/docs/naver-api-hub-overview'],
    ['youtube-data','YouTube Data API','Trend·Chart·Playlist: 영상 검색, 공식 영상, 조회수 및 인기 분석','Google Developers','https://developers.google.com/youtube/v3'],
    ['google-trends-alpha','Google Trends API (알파)','Trend: 검색 관심도·지역 분석 / 일반 공개가 아닌 제한적 알파 신청','Google Developers','https://developers.google.com/search/apis/trends'],
    ['customs-data','관세청 무역·수입 통계 데이터','Market: 중국 소싱·수입 품목·교역 통계에 사용할 데이터셋 조사','관세청 / 공공데이터포털','https://www.data.go.kr/','source'],
  ]},
  {name:'Competition · 공연기회 · Career', items:[
    ['bizinfo','기업마당 지원사업·행사 API','Competition·Performance·Career: 지원사업과 공고 정보 수집','기업마당','https://www.bizinfo.go.kr/apiList.do'],
    ['g2b-bids','나라장터 입찰공고 API','Performance: 축제·행사·공연 관련 용역 공고와 입찰','공공데이터포털','https://www.data.go.kr/data/15129394/openapi.do'],
    ['kstartup','K-Startup 창업지원공고 API','Competition·Market: 창업지원사업·공모 지원 기회','공공데이터포털','https://www.data.go.kr/data/15112711/openapi.do'],
    ['iris-notices','IRIS 연구과제·공모 공고','Competition: 관련 공모·과제 공고의 공개 수집 가능성 조사','범부처통합연구지원시스템','https://www.iris.go.kr/','source'],
    ['culture-opportunity-source','문화재단·축제·평생교육 기관별 모집공고','Performance·Career: 출연자 모집, 문화강사 모집, 제안 접수 / 기관별 확인','기관별 공식 공고','https://www.gokams.or.kr/','source'],
  ]},
  {name:'Grocery Flow · 식품과 가격', items:[
    ['kamis','KAMIS 농수축산물 가격 API','Grocery: 품목별·지역별 일일 가격 / 매장 실판매가와 구분','한국농수산식품유통공사','https://www.kamis.or.kr/customer/reference/openapi_list.do'],
    ['foodsafety','식품안전나라 API','Grocery: 식품 상품정보·바코드·영양정보 제공 범위 확인','식품안전나라','https://www.foodsafetykorea.go.kr/api/main.do'],
    ['cham-price','참가격 생활필수품 가격 정보','Grocery: 공식 소비자가격 공개·API 제공 범위 조사','한국소비자원','https://www.price.go.kr/','source'],
  ]},
  {name:'Student Flow · Culture PR · 공연', items:[
    ['work24','고용24 직업훈련 Open API','Student: 국비 직업훈련 과정 / 기업회원 등 신청 자격 확인','고용24','https://www.work24.go.kr/cm/e/a/0110/selectOpenApiIntro.do'],
    ['kmooc','K-MOOC 강좌정보 API','Student: 온라인 비학위 강좌·교육기관·수강기간','공공데이터포털','https://www.data.go.kr/data/15042355/openapi.do'],
    ['kocw','KOCW 공개강의 데이터','Student: 대학·기관 공개강의 검색 및 접근조건 확인','공공데이터포털','https://www.data.go.kr/data/3069707/openapi.do'],
    ['isbn','국립중앙도서관 ISBN API','Culture PR: 도서 서지·신간 데이터 및 공개 시점 확인','국립중앙도서관','https://www.nl.go.kr/NL/contents/N31101030500.do'],
    ['kobis','KOBIS 영화관입장권 통합전산망 Open API','Culture PR: 영화·개봉 관련 정보','영화진흥위원회','https://www.kobis.or.kr/kobisopenapi/homepg/main/main.do'],
    ['kopis','KOPIS 공연예술통합전산망 Open API','Culture PR·Performance: 공연·공연장·상연 정보','공연예술통합전산망','https://www.kopis.or.kr/por/cs/openapi/openApiInfo.do'],
    ['program-announcements','대학원·비학위·단기교육 모집요강 수집','Student: 2027년 모집공고 / 대학·기관별 공식 원문 조사','대학·교육기관 공식 사이트','https://www.data.go.kr/','source'],
  ]},
  {name:'Running · Fashion · 기타 데이터', items:[
    ['weather-forecast','기상청 단기예보 API','Running·Fashion: 날씨·기온·강수·외부활동 판단','공공데이터포털','https://www.data.go.kr/data/15139470/openapi.do'],
    ['vworld-map','공간정보·지도 Open API','Running: 러닝 코스의 지도·위치·거리 관련 데이터 조사','브이월드','https://www.vworld.kr/'],
    ['volunteer-source','1365 자원봉사 모집정보','Culture / 기회 수집: 공개 모집정보의 데이터 제공 여부 확인','1365 자원봉사포털','https://www.1365.go.kr/','source'],
    ['namdaemun-source','남대문시장 상가 정보','시장 앱: 상가별 공개정보 수집·공식 사용조건 검토','시장·상인회 공식자료','https://www.data.go.kr/','source'],
    ['catholic-source','가톨릭 전례·본당·성가 자료','가톨릭 앱: 공식 전례 및 미사시간·성가 활용 허락 확인','한국천주교주교회의','https://www.cbck.or.kr/','source'],
  ]},
  {name:'Insurance Flow · 보험', items:[
    ['insurance-fsc-medical','금융위원회 실손보험정보','Insurance Flow: 실손보험 유형·담보 및 연령대별 보험료 통계 비교','금융위원회','https://www.data.go.kr/data/15094797/openapi.do'],
    ['insurance-epost-product','우체국 보험상품정보','Insurance Flow: 우체국 보험상품명·상품 종류 등 조회','우정사업본부','https://www.epostlife.go.kr/IPUIOP0000.do'],
    ['insurance-epost-rate','우체국 보험공시이율','Insurance Flow: 우체국 보험 공시이율 비교·추적','우정사업본부','https://www.epostlife.go.kr/IPUIOP0000.do'],
    ['insurance-epost-premium','우체국 보험료 조회','Insurance Flow: 우체국 보험 조건별 1회 보험료 조회','우정사업본부','https://www.epostlife.go.kr/IPUIOP0000.do'],
    ['insurance-policy-lookup','내 보험 가입내역 조회 연동 검토','Insurance Flow: 보험 가입내역·보장·납부정보 조회. 민간 서비스 계약과 본인 인증 필요','민간 보험정보 API','https://www.hyphen.im/product/view?seq=5','source'],
    ['insurance-silson24','실손24 보험금 청구','Insurance Flow: 공식 청구 서비스 이동 및 청구 상태 수동 관리. 일반 공개 청구 API 미확인','보험개발원','https://www.silson24.or.kr/','source'],
  ]},
  {name:'Saving Flow · 저축·금융', items:[
    ['finlife-deposit','금융상품 한눈에 · 정기예금','Saving Flow: 은행·저축은행 정기예금 상품, 기간별 금리·조건 비교','금융감독원','https://finlife.fss.or.kr/'],
    ['finlife-savings','금융상품 한눈에 · 적금','Saving Flow: 적립식 적금, 기본·우대금리 및 만기 비교','금융감독원','https://finlife.fss.or.kr/'],
    ['bok-ecos','한국은행 ECOS 경제통계','Saving Flow: 기준금리와 시장금리 변화 추적','한국은행','https://ecos.bok.or.kr/api/'],
    ['fsc-finance-data','금융 공공데이터','Saving Flow: 금융기관·상품 기초정보 및 공개 데이터 조사','공공데이터포털','https://www.data.go.kr/','source'],
    ['kftc-openbanking','오픈뱅킹 계좌 조회','Saving Flow: 실제 계좌 잔액·거래내역 연동. 이용기관 승인·사용자 동의 필요','금융결제원','https://openapi.kftc.or.kr/service/openBanking','source'],
  ]},
];

const STATUS_OPTIONS = [
  {value:'not_started', label:'미진행'},
  {value:'investigating', label:'조사 중'},
  {value:'applied', label:'신청 완료'},
  {value:'key_issued', label:'키 발급·자료 확보'},
  {value:'connected', label:'연결 성공'},
  {value:'collected', label:'수집 성공'},
  {value:'unavailable', label:'제공 불가·보류'},
];
const READY_STATES = new Set(['key_issued', 'connected', 'collected']);

export function ApiChecklist({data,onDataChange}) {
  const keys=data.settings?.apiKeys || {};
  const setKeys=change=>onDataChange(d=>{
    const previous=d.settings?.apiKeys || {};
    return {...d,settings:{...d.settings,apiKeys:typeof change==='function'?change(previous):change}};
  });
  const [visible,setVisible]=useState({});
  const [notice,setNotice]=useState('');
  const copyKey=async(id)=>{
    try { await navigator.clipboard.writeText(keys[id]||'');setNotice('인증키를 복사했어요.'); }
    catch {setNotice('복사하지 못했어요. 보기 버튼을 누르고 직접 복사해 주세요.');}
  };
  const checks=data.settings?.apiChecklist || {};
  const statuses=data.settings?.apiStatuses || {};
  // 기존 체크(준비 완료)는 최초 표시만 '키 발급·자료 확보'로 해석해 기록을 보존합니다.
  const statusOf=id=>statuses[id] || (checks[id]===true ? 'key_issued' : 'not_started');
  const total=groups.reduce((n,g)=>n+g.items.length,0);
  const collected=groups.reduce((n,g)=>n+g.items.filter(([id])=>statusOf(id)==='collected').length,0);
  const ready=groups.reduce((n,g)=>n+g.items.filter(([id])=>READY_STATES.has(statusOf(id))).length,0);
  const setStatus=(id,status)=>onDataChange(d=>({
    ...d,settings:{
      ...d.settings,
      apiStatuses:{...d.settings?.apiStatuses,[id]:status},
      // 레거시 체크 값을 함께 갱신해 기존 기기·기록과 호환되도록 합니다.
      apiChecklist:{...d.settings?.apiChecklist,[id]:READY_STATES.has(status)}
    }
  }));
  return <section className="api-checklist">
    <style>{`
      .api-top-button{border:1px solid #e3d9ee;background:#fff;color:#725299;border-radius:9px;padding:7px 11px;font-size:14px;font-weight:650;min-height:36px}
      .api-top-button[aria-current="page"]{background:#eee6f7;border-color:#baa0d8}
      .api-checklist{max-width:800px;margin:auto;padding:20px 16px 30px}
      .api-checklist h1{margin:0;font-size:23px;color:#50366f}
      .api-checklist .api-intro{margin:8px 0 18px;color:#796e84;font-size:14px;line-height:1.6}
      .api-summary{padding:13px 16px;background:#f0eaf8;border-radius:12px;display:flex;justify-content:space-between;color:#6b4b91;font-size:15px;gap:12px}
      .api-group{margin-top:24px}.api-group h2{font-size:17px;margin:0 0 10px;color:#50366f;display:flex;justify-content:space-between;gap:10px}.api-group h2 span{font-size:13px;color:#8b7b9b;font-weight:500}
      .api-items{border:1px solid #e9e1f0;border-radius:13px;overflow:hidden;background:white}
      .api-item{padding:14px;display:flex;align-items:flex-start;gap:12px;border-bottom:1px solid #eee7f4}.api-item:last-child{border:0}
      .api-details{min-width:0;flex:1}.api-name{display:block;font-size:16px;font-weight:650;color:#463451}.api-done .api-name{color:#705d82}.api-purpose{font-size:14px;color:#81758c;line-height:1.55;margin:4px 0 7px}.api-source{font-size:13px;color:#95899e}
      .api-status-row{display:flex;align-items:center;flex-wrap:wrap;gap:9px;margin:10px 0 5px}
      .api-status-label{font-size:14px;font-weight:600;color:#665479}
      .api-status-select{font-family:inherit;min-height:42px;min-width:160px;max-width:100%;border:1px solid #d6c8e6;background:#fcfaff;border-radius:9px;padding:8px 11px;color:#513d68;font-size:16px;cursor:pointer}
      .api-status-select:focus-visible{outline:2px solid #9472ba;outline-offset:2px}
      .api-status-select[data-status="collected"]{background:#eee6f8;border-color:#9472ba;font-weight:650}
      .api-status-hint{font-size:13px;color:#897b97;line-height:1.45}
      .api-checklist .api-item{display:block}
      .api-type-note{margin:9px 0;color:#81758c;font-size:13px;line-height:1.5}
      .api-link{display:inline-flex;align-items:center;gap:5px;font-size:14px;color:#7953a4;text-decoration:none;padding:5px 0;min-height:32px}.api-done-label{font-size:12px;color:#7953a4;margin-left:8px}
      .api-key-label{display:block;font-size:14px;color:#79668a;margin-top:10px}
      .api-key-input{display:block;width:100%;min-width:0;margin:6px 0;padding:10px 12px;border:1px solid #dfd4ea;border-radius:9px;font-size:16px;background:#fcfaff}
      .api-key-actions{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:5px}
      .api-key-actions button{padding:6px 12px;min-height:36px;border:1px solid #dfd4ea;border-radius:8px;background:#f8f4fc;color:#725299;font-size:14px}
      .api-key-actions button:disabled{opacity:.45}
      .api-key-note{display:block;color:#91829d;font-size:13px;line-height:1.5}
      .api-key-notice{padding:10px 12px;background:#f0eaf8;border-radius:9px;margin:12px 0;color:#6b4b91;font-size:14px}
      .api-guide{margin-top:24px;padding:16px;background:#f7f4fb;border-radius:12px;font-size:14px;line-height:1.7;color:#7b6c89}.api-guide strong{color:#5b4474}.api-guide p{margin:7px 0}.api-guide a{color:#7953a4}
      @media(max-width:420px){.focus-v6-header .header-actions{gap:7px}.focus-v6-header .focus-autosave{display:none}}
    `}</style>
    <h1>API 준비</h1>
    <p className="api-intro">Home·Culture·Walk 기존 항목과 새로 조사한 공통 API를 한곳에서 관리해요. 각 항목의 <strong>진행 상태</strong>를 선택하면 자동 저장돼요.<br/>연결 성공·수집 성공은 직접 테스트한 뒤에 선택해 주세요.</p>
    <p className="api-intro">인증키는 포커스 플로우 계정 데이터에 자동 저장돼요. 탭 이동·새로고침 후에도 유지되고, 같은 계정의 기기에서 동기화돼요.</p>
    {notice&&<p className="api-key-notice" role="status">{notice}</p>}
    <div className="api-summary"><strong>수집 성공 {collected} / {total}</strong><span>자료·키 확보 이상 {ready}건 · 자동 저장</span></div>
    {groups.map(group=><section className="api-group" key={group.name} aria-label={group.name}>
      <h2>{group.name}<span>수집 성공 {group.items.filter(([id])=>statusOf(id)==='collected').length} / {group.items.length}</span></h2>
      <div className="api-items">{group.items.map(([id,name,purpose,provider,url,kind])=>{
        const status=statusOf(id);
        const done=status==='collected';
        const sourceOnly=kind==='source';
        return <div className={`api-item${done?' api-done':''}`} key={id}>
          <div className="api-details"><span className="api-name">{name}</span><p className="api-purpose">{purpose}</p><div className="api-source">{provider}{sourceOnly?' · 공개자료/수집처 조사':' · API'}</div>
            <div className="api-status-row">
              <label className="api-status-label" htmlFor={`api-status-${id}`}>진행 상태</label>
              <select id={`api-status-${id}`} className="api-status-select" data-status={status} value={status} onChange={e=>setStatus(id,e.target.value)}>
                {STATUS_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <a className="api-link" href={url} target="_blank" rel="noopener noreferrer">{sourceOnly?'공식자료·안내 열기':'신청·안내 열기'} <ExternalLink size={14}/></a>
            {sourceOnly?<p className="api-type-note">별도 인증키가 없는 공개자료 조사 항목이에요. 이용조건과 실제 수집 가능성을 확인하고 상태를 선택하세요.</p>:<>
            <label className="api-key-label" htmlFor={`api-key-${id}`}>인증키 붙여넣기 (발급된 경우)</label>
            <input id={`api-key-${id}`} className="api-key-input" type={visible[id]?'text':'password'} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="일반 인증키(Decoding) 등을 붙여넣으세요" value={keys[id]||''} onChange={e=>setKeys(v=>({...v,[id]:e.target.value.trim()}))}/>
            <div className="api-key-actions">
              <button type="button" disabled={!keys[id]} aria-pressed={!!visible[id]} onClick={()=>setVisible(v=>({...v,[id]:!v[id]}))}>{visible[id]?'숨기기':'보기'}</button>
              <button type="button" disabled={!keys[id]} onClick={()=>copyKey(id)}>복사</button>
              <button type="button" disabled={!keys[id]} onClick={()=>{setKeys(v=>({...v,[id]:''}));setVisible(v=>({...v,[id]:false}));setNotice('입력한 인증키를 지웠어요.');}}>지우기</button>
            </div>
            <small className="api-key-note">자동 저장 · 보기·복사 가능 · 실제 API 연결·수집은 별도로 검증하세요.</small>
            </>}
          </div>
        </div>;
      })}</div>
    </section>)}
    <div className="api-guide"><strong>진행 상태 안내</strong><p>미진행 → 조사 중 → 신청 완료 → 키 발급·자료 확보 → 연결 성공 → 수집 성공 순서로 선택하세요. 신청이나 키가 필요 없는 공개자료는 해당 단계를 건너뛰어도 돼요. 기존 체크 완료는 ‘키 발급·자료 확보’로 표시되며 기존 인증키는 변경하지 않아요.</p><p><strong>보안:</strong> 이 화면의 인증키는 계정 데이터에 저장되므로, 비밀 API 키·서버 전용 토큰은 입력하지 말고 Cloudflare 서버 Secrets를 사용하세요.</p><strong>인증키 준비 방법</strong><p>서울 열린데이터광장: 로그인 → 인증키 신청. <a href="https://data.seoul.go.kr/together/guide/useGuide.do" target="_blank" rel="noopener noreferrer">이용 안내 ↗</a></p><p>공공데이터포털: 로그인 → 사용할 데이터별 활용신청 → 승인·인증키 확인.</p><p>문화포털은 안내 페이지에서 사용할 API의 신청 경로를 확인하세요. 발급받은 인증키는 위 입력란에 붙여넣으면 자동 저장돼요.</p></div>
  </section>;
}
