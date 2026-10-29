# Codespaces 없이 Cloudflare Pages 배포
1. GitHub에서 새 저장소 `Focus-Flow` 생성.
2. 이 폴더의 파일을 저장소 최상위에 업로드 (`src`, `index.html`, `package.json` 등).
3. Cloudflare Dashboard > Workers & Pages > Create > Pages > Connect to Git > 저장소 선택.
4. Framework preset: Vite, Build command: `npm run build`, Build output directory: `dist`.
5. 배포가 완료되면 Cloudflare의 `*.pages.dev` 주소로 아이폰에서 열기.

# Supabase 준비
1. Supabase 새 프로젝트 생성.
2. SQL Editor에서 `supabase.sql` 실행.
3. Project URL과 publishable key를 확인. `service_role`/secret key 공유 금지.
4. 앱의 로그인·읽기·쓰기 연결 코드는 아직 구현 전. 데이터 테이블 준비 단계임.

현재 v1은 localStorage 기반으로 기기 간 동기화가 불가능하므로, Supabase 연결 완료 전 중요 기록 입력은 피하세요.
