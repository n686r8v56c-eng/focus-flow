# TREND / Entertainment API 설정

## Cloudflare Pages 환경 변수

GitHub에 비밀키를 커밋하거나 웹앱의 입력창/localStorage/IndexedDB에 저장하지 마세요.
Cloudflare 대시보드 → Workers & Pages → focus-flow 프로젝트 → Settings → Variables and Secrets.
Production 및 필요한 경우 Preview 환경에 아래 값을 **Secret(암호화)** 으로 설정 후 재배포하세요.

| 변수 이름 | 출처 | 사용 |
|---|---|---|
| `YOUTUBE_API_KEY` | Google Cloud Console → YouTube Data API v3 활성화 후 API key 발급 | 유튜브 한국 인기 및 키워드 검색 |
| `NAVER_API_KEY_ID` | Naver Cloud Platform → NAVER API HUB → API Key ID | 네이버 뉴스 및 검색어 트렌드 |
| `NAVER_API_KEY` | Naver Cloud Platform → NAVER API HUB → API Key | 네이버 뉴스 및 검색어 트렌드 |

- Google Trends 한국 급상승 RSS는 별도 API 키가 필요 없습니다.
- NAVER API HUB Search API와 Search Trend API의 이용 신청·사용량 제한·과금 조건을 별도로 확인하세요.
- YouTube Data API v3 쿼터에 주의하세요: `search.list` 키워드 1개 조회가 기본 100 units, 영상 통계 조회에 추가 호출이 필요할 수 있습니다. 등록된 키에 API 제한(YouTube Data API v3)을 적용하세요. Cloudflare Pages 서버에서 사용하므로 웹사이트 HTTP referrer 제한 방식은 맞지 않을 수 있습니다.
- Cloudflare 측 요청 제한/WAF를 추가하고 호출량을 모니터링하세요. 로그인 검증은 있지만 사용자별 API 요청 속도 제한은 아직 구현되지 않았습니다.
- Cloudflare Pages Functions는 `functions/api/trend.js`로 배포됩니다. Cloudflare Pages의 빌드 설정에서 Functions 디렉터리가 인식되는지 확인하세요.

## 작동 방식

- TREND → 랭킹 → 자동 발견·API 수집
- 구글 급상승: 한국 RSS → 사용자가 수동 새로고침. 분야 필터는 휴리스틱으로 공식 장르 순위가 아닙니다.
- 유튜브 인기: 한국 공식 영상 카테고리 인기 차트(엔터테인먼트/음악/영화).
- 유튜브 키워드: 최근 7/30/90/180/360일에 게시된 영상 중 조회수순/관련도순/최신순; **조회수순은 기간 중 증가량이 아니라 누적 조회수 순**입니다.
- 키워드 일괄 검색: 쉼표 또는 줄바꿈으로 최대 3개. API 응답 자체는 서로 다른 키워드 전체의 통합 순위가 아닙니다.
- 네이버 뉴스: 키워드 기준 최신 기사 30건. **조회수 기반 기사 인기 순위가 아닙니다.**
- 검색 관심도: 상대 지수(최고 100)로 실제 검색 횟수가 아닙니다.
- API 결과의 개별 '저장함에 추가' 버튼으로 Focus 데이터와 분리된 IndexedDB에 수집 증거를 저장합니다. CSV 내보내기를 지원합니다.

## 아직 포함되지 않은 것

- 실제 자동 스케줄 수집 및 데일리 푸시 발송, 공식 플랫폼 통합 TOP10, 뉴스 이슈 자동 중복 묶기, 기기 간 TREND 기록 동기화는 미구현입니다.
- 기존 Focus Flow의 데이터 구조, 백업 및 동기화 로직은 수정하지 않았습니다.

## 직접 확인

- https://trends.google.com/trending?geo=KR
- https://trends.google.com/trending/rss?geo=KR
- https://entertain.naver.com/
- https://charts.youtube.com/
- https://datalab.naver.com/
