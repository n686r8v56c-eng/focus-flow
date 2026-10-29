# Focus Flow v5 배포

기존 Cloudflare Pages 프로젝트와 GitHub 연결을 유지합니다.
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22 LTS 권장
- Production branch: 기존 `main` 유지. 수정 브랜치는 Preview 배포로 확인합니다.

`npm install` 및 `npm run build` 후 배포합니다. `package-lock.json`을 함께 커밋해 버전을 고정합니다.

기존 Supabase 프로젝트, 사용자, 테이블과 RLS 정책을 유지합니다. 업데이트를 위해 `supabase.sql`을 재실행하거나 데이터를 초기화할 필요가 없습니다.

iPhone Safari에서는 시작/소리 켜기/미리 듣기 버튼을 직접 눌러 오디오를 활성화하세요. 잠금 화면이나 백그라운드에서 Safari가 오디오를 중지할 수 있으며, 이 경우 소리와 알림은 보장되지 않습니다. 타이머는 화면 복귀 시 경과 시간을 반영합니다.
