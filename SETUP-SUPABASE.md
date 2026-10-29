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

## 4. 기존 사용자는 데이터 보존
기존 Supabase 연결과 테이블, 사용자, RLS를 유지합니다. 이번 코드 업데이트를 위해 SQL을 다시 실행할 필요가 없습니다.
최초 로그인 시 서버 행이 없으면 기본 프로젝트를 표시합니다. 이전 v1 localStorage 데이터는 자동 가져오지 않습니다.
다른 기기의 변경은 화면 포커스 복귀 및 12초 간격으로 확인합니다. 저장은 updated_at 비교 후 갱신하며, 독립 수정은 병합하고 동일 항목 충돌은 경고합니다. 네트워크 오류나 충돌 시 미저장 변경은 사용자별 localStorage에 보관합니다.
새 코드 배포 후 모든 기기를 새로고침하세요. 구버전 클라이언트의 무조건 덮어쓰기는 새 코드로 보호할 수 없습니다.
