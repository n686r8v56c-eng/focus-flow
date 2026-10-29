# 검증된 v5 적용

이 압축파일은 소스 전체입니다. 기존 Supabase 데이터나 사용자 계정은 포함하지 않으며 데이터베이스를 초기화하지 않습니다.

GitHub 쓰기 권한을 연결한 뒤 작업 브랜치의 커밋을 올리거나, 아래처럼 기존 Codespaces 저장소에서 압축파일 내용을 덮어씁니다. `supabase.sql`은 변경되지 않았으므로 실행하지 않습니다.

```sh
git switch -c fix/v5-verification
# 이 압축파일의 내용을 현재 저장소 폴더에 덮어쓴 뒤:
npm install
npm test
npm run build
git add src package.json package-lock.json tests .gitignore README.md DEPLOY.md SETUP-SUPABASE.md VERIFICATION.md APPLY-UPDATE.md
git commit -m "Apply Focus Flow v5 and protect synchronized focus records"
git push -u origin fix/v5-verification
```

Cloudflare Preview가 성공한 뒤 main으로 Pull Request를 병합하면 기존 Production 연결로 배포됩니다. 배포 후 아이폰/아이패드 모두 새로고침하세요. 동일 계정으로 테스트 투두/서브태스크/집중 기록이 상대 기기에 나타나는지 확인하세요. 초침 소리는 미리 듣기 또는 시작 버튼을 직접 눌러 활성화합니다.
