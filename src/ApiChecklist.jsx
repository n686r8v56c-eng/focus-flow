import React, { useState } from 'react';
import { ExternalLink, Check } from 'lucide-react';

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
];

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
  const total=groups.reduce((n,g)=>n+g.items.length,0);
  const completed=groups.reduce((n,g)=>n+g.items.filter(([id])=>checks[id]===true).length,0);
  const toggle=id=>onDataChange(d=>({...d,settings:{...d.settings,apiChecklist:{...d.settings?.apiChecklist,[id]:d.settings?.apiChecklist?.[id]!==true}}}));
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
      .api-check{flex:none;border:1px solid #cbbddd;background:white;border-radius:8px;width:32px;height:32px;display:grid;place-items:center;color:white;margin:1px 0 0;cursor:pointer}.api-check[aria-pressed="true"]{background:#8864b0;border-color:#8864b0}.api-check:focus-visible{outline:3px solid #b9a0d8;outline-offset:2px}
      .api-details{min-width:0;flex:1}.api-name{display:block;font-size:16px;font-weight:650;color:#463451}.api-done .api-name{color:#8c7e98}.api-purpose{font-size:14px;color:#81758c;line-height:1.55;margin:4px 0 7px}.api-source{font-size:13px;color:#95899e}
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
    <p className="api-intro">필요한 API를 열어 신청하고, 준비가 끝나면 체크해 두세요.<br/>완료 표시는 신청·인증키 준비에 대한 메모이며, 앱 연동 완료를 뜻하지 않아요.</p>
    <p className="api-intro">인증키는 포커스 플로우 계정 데이터에 자동 저장돼요. 탭 이동·새로고침 후에도 유지되고, 같은 계정의 기기에서 동기화돼요.</p>
    {notice&&<p className="api-key-notice" role="status">{notice}</p>}
    <div className="api-summary"><strong>준비 완료 {completed} / {total}</strong><span>체크·인증키 자동 저장</span></div>
    {groups.map(group=><section className="api-group" key={group.name} aria-label={group.name}>
      <h2>{group.name}<span>{group.items.filter(([id])=>checks[id]===true).length} / {group.items.length}</span></h2>
      <div className="api-items">{group.items.map(([id,name,purpose,provider,url])=>{
        const done=checks[id]===true;
        return <div className={`api-item${done?' api-done':''}`} key={id}>
          <button type="button" className="api-check" aria-label={`${name} 준비 완료`} aria-pressed={done} onClick={()=>toggle(id)}>{done&&<Check size={20}/>}</button>
          <div className="api-details"><span className="api-name">{name}</span><p className="api-purpose">{purpose}</p><div className="api-source">{provider}{done&&<span className="api-done-label">✓ 준비 완료</span>}</div><a className="api-link" href={url} target="_blank" rel="noopener noreferrer">신청·안내 열기 <ExternalLink size={14}/></a>
            <label className="api-key-label" htmlFor={`api-key-${id}`}>인증키 붙여넣기</label>
            <input id={`api-key-${id}`} className="api-key-input" type={visible[id]?'text':'password'} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="일반 인증키(Decoding) 등을 붙여넣으세요" value={keys[id]||''} onChange={e=>setKeys(v=>({...v,[id]:e.target.value.trim()}))}/>
            <div className="api-key-actions">
              <button type="button" disabled={!keys[id]} aria-pressed={!!visible[id]} onClick={()=>setVisible(v=>({...v,[id]:!v[id]}))}>{visible[id]?'숨기기':'보기'}</button>
              <button type="button" disabled={!keys[id]} onClick={()=>copyKey(id)}>복사</button>
              <button type="button" disabled={!keys[id]} onClick={()=>{setKeys(v=>({...v,[id]:''}));setVisible(v=>({...v,[id]:false}));setNotice('입력한 인증키를 지웠어요.');}}>지우기</button>
            </div>
            <small className="api-key-note">자동 저장 · 보기·복사 가능 · 각 앱의 API 연결은 별도로 진행해요.</small>
          </div>
        </div>;
      })}</div>
    </section>)}
    <div className="api-guide"><strong>인증키 준비 방법</strong><p>서울 열린데이터광장: 로그인 → 인증키 신청. <a href="https://data.seoul.go.kr/together/guide/useGuide.do" target="_blank" rel="noopener noreferrer">이용 안내 ↗</a></p><p>공공데이터포털: 로그인 → 사용할 데이터별 활용신청 → 승인·인증키 확인.</p><p>문화포털은 안내 페이지에서 사용할 API의 신청 경로를 확인하세요. 발급받은 인증키는 위 입력란에 붙여넣으면 자동 저장돼요.</p></div>
  </section>;
}
