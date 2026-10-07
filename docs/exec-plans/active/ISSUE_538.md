# Issue #538 — Project master hierarchy

## 범위·결정
대상: 사업부→제품→사업장/법인 관계 저장소/API/관리자/프로젝트 분류 UI, 회귀·문서. 기존 #289 안정 ID/권한/카탈로그 revision 유지. 제품의 복수 사업부 연결 허용, 사업부만/사업부+제품 선택 허용. 사용 중 관계 해제 금지. Partial legacy는 추정하지 않으며 Project migration은 매핑 테이블만 backfill.

## 변경 경계
- backend: migration 0024, ProjectMasterRepository/Service/handlers, security route inventory, Project create/update validation.
- frontend: 관리자 관계 관리 및 Project 생성/설정 cascading(서버 catalog relations 사용), 사용 중 관계 해제 실패 메시지.
- qa/docs: catalog unit/integration, admin/component E2E fixture 갱신, 요구사항/DB/API/UX/security/test 문서.
- infra: PR CI 시작까지, 이후 병합·main CI·GHCR 승인 없음.

## 검증·릴리스
로컬 독립 QA 또는 브라우저 실측 결과를 확보하기 전 PASS 선언 금지. PR CI head/run/link 및 실패 원인은 실제 GitHub Actions로 판정. `release_required=true` (기능 확장), `release_authorized=false`. 사용자의 현재 승인 범위는 PR CI 시작까지.
