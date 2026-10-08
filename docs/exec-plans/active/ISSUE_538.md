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

## Run #2121.1 실패와 후속 교정 (2026-10-08 KST)

- [CI Run #2121.1](https://github.com/planner77/masterGantt/actions/runs/37703276171) FAIL: Vitest 4건은 migration 0024 신규 적용의 기존 snapshot(목록·migration count·스키마 table/index)과 두 admin relation Route inventory 고정 목록 미동기화. Vitest 전체 1,581 PASS / 4 FAIL / 3 SKIP.
- E2E shard 3/6: 관리자 관계 테스트의 `getByLabel("사업부", {exact:true})`가 같은 accessible name을 가진 tabpanel에 매칭되어 `selectOption`이 실패. selector를 `project-master-relations-heading` section 내부의 실제 `select`로 좁힘. 해당 shard 총 73 PASS, 1 FAIL.
- TypeScript, ESLint, production build, policy, Docker smoke는 PASS. 새 CI로 모든 동일 head 검증을 다시 실시하며 이전 결과를 재사용해 전체 성공으로 판정하지 않는다.

## PR CI #2123.1 실패 후속 (2026-10-08 KST)

- [Run #2123.1](https://github.com/planner77/masterGantt/actions/runs/37706749312), head `b0a9dcc232afc7abc2fec6ae8b2b87597c0c6607`: 변경 경로/TypeScript/ESLint/build/Vitest/정책/Docker PASS, E2E shard 1–5 PASS. Shard 6은 기존 #456 `task-editor-form-density.spec.ts`의 *metadata 저장 후 Gantt viewport continuity* assertion에서 FAIL (기대 chartScroll/publicViewport.left=120, 실제=91; 다른 상태는 보존), shard 6 = 72 PASS / 1 FAIL / 1 SKIP.
- 현재 Core canonical metadata sync 후 Gantt viewport 복원은 `scrollLeft===0` 또는 `scrollTop===0`에서만 보정한다. 기존 nonzero 좌표 `120 → 91`의 일부 변동은 복원하지 않는다. 동일 API/scope/geometry/columns/scale 및 사용자 입력 없음이라는 기존 `currentRequest()` guard를 유지하고 *실제 값이 이전 좌표와 다르면* public `scroll-chart`로 정확히 복원하도록 보완한다. 별도 순수 helper와 0/partial/nonzero/invalid 단위 회귀를 추가한다. 사용자 입력 후 offset을 강제로 되돌리지 않도록 기존 `hasInput` guard를 그대로 유지한다.
- 원격 브라우저 trace ZIP의 직접 재생/독립 실험은 수행하지 않았다. 원인은 코드 검토 + observed numeric mismatch의 합리적 추정이며 수정 효과는 새 PR exact-head CI에서 검증할 것. 사용자 승인 범위는 보완 후 PR CI 시작까지이며 병합/메인 CI/정식 릴리스는 미승인.
