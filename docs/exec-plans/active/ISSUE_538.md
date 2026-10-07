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

## PR #539 검증 후속

- PR CI Run #2119.1 (head `e0c5f15624499da74d01bf9dd34d33080dcc90c4`)은 `변경 경로 판정 / CI 실행 추적 메타데이터 검증`에서 FAIL. `verify-ci-run-trace.py`가 PR 본문 독립 한 줄 `Refs #538` 정확히 1개를 요구하나 최초 본문은 `Refs #538.`으로 한 줄에 문장과 붙어 검출 0개였다.
- PR #539 본문을 canonical `Refs #538` 독립 한 줄로 교정한다. 같은 값의 상위 Select 재선택 시 기존 초안 유지, 하위 현재값의 다른 부모 선택지 유입 방지도 보완한다.
- PR CI 새 head 시작까지만 수행. 이전 Run은 downstream quality/E2E/docker가 선행 gate 실패로 skipped이므로 해당 단계 PASS로 판단하지 않는다.
