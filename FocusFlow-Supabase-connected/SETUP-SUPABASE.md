# Focus Flow — Supabase 연결

프로젝트 URL과 publishable key는 src/main.jsx에 연결되어 있습니다. Publishable key는 공개 가능한 클라이언트 키이며, service_role/secret 키는 넣지 마세요.

## 1. 데이터베이스 만들기
Supabase Dashboard → SQL Editor → New query → `supabase.sql` 전체 붙여넣기 → Run.

## 2. 로그인 설정
Authentication → Providers → Email 활성화. 이메일 확인 기능을 켜두었다면 가입 후 메일 확인이 필요합니다.
Authentication → URL Configuration → Site URL을 실제 Cloudflare Pages 주소로 설정하고 Redirect URLs에도 `https://<프로젝트>.pages.dev/**` 추가하세요.

## 3. GitHub/Cloudflare Pages
압축 해제한 파일/폴더를 GitHub 저장소 루트에 업로드합니다.
Cloudflare Pages: GitHub repo 연결 / Framework preset: Vite / Build command: `npm run build` / Output directory: `dist`.

## 4. 주의
최초 로그인 시 서버에 데이터가 없으면 기본 프로젝트만 표시합니다. 이전 브라우저 localStorage의 기록은 자동으로 가져오지 않습니다.
기본 데이터는 사용자별 JSON 상태를 Supabase에 저장합니다. 다른 기기에서 이미 열린 화면이 실시간 자동 갱신되는 기능은 아직 구현하지 않았습니다. 다른 기기에서 변경한 기록은 페이지를 새로 열면 불러옵니다. 동시에 두 기기에서 수정하면 마지막 저장이 덮어쓸 수 있습니다.
Codespaces 없이 Cloudflare 자동 빌드가 가능합니다.
