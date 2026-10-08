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

## PR CI #2132.1 실패 후 보완 (2026-10-08 KST)

- [Run #2132.1](https://github.com/planner77/masterGantt/actions/runs/37709855634), head `22b58c88e0cb1a85d7a69029729959110d5df014`: 빌드·타입 검사·ESLint·Vitest·정책·Docker·E2E shard 1/3/4/5/6 성공, E2E shard 2 실패 (74 PASS / 1 FAIL).
- 실패는 `tests/e2e/project-edit-authorization.spec.ts:79`의 저장 완료 후 read-only `page.request.get(projectPath)`에서 `read ECONNRESET` (HTTP 응답 자체 없음). 로그만으로 Node/Next.js 서버 종료나 제품 API 오류라고 확정할 수 없음. 기능 변경으로 API 응답을 우회하지 않는다.
- 저장소의 `tests/e2e/project-browser-title-favicon.spec.ts`, `milestone-stage-grid.spec.ts`에서 사용하는 동일 패턴에 따라 W05 보안 회귀의 **읽기 전용 프로젝트 GET만** `ECONNRESET/socket hang up` 시 최대 3회, 250ms×시도번호 지연으로 재전송한다. 재시도 소진, HTTP 401/409/500, mutation 실패 등은 기존대로 즉시 실패·검증한다. `HEAD/OPTIONS/PATCH`, 인증·revision·session assertion은 변경하지 않는다.
- 실제 장애 원인 증거가 부족하므로 재시도 후 최종 PASS는 새 exact-head CI 결과가 판단한다. 요청 범위는 새 PR CI 시작까지이고 병합·Main CI·GHCR 게시·Issue 종료는 금지.

## 최신 main 병합·충돌 해결 (2026-10-08 KST)

- 원본 PR #539 head: `3c607e66aead5526f8b8706f65450b4ce4284776`; 최신 main: `8b9d4d76758f73094ec84590e3a8a49314741587`. 공통 조상: `b417fcc094bff98ea142374fcd746bce2458c2e1`.
- main 고유 54개, PR 고유 37개 파일 중 11개 파일에 동시 변경. main의 Resource Dashboard #525/#526 및 E2E/API 문서 변경과 PR #538의 마이그레이션·API·UI·테스트 변경을 모두 보존하여 two-parent merge commit으로 정렬한다.
- 동시 변경 6개 설명서(`API/ARCHITECTURE/PROJECT_UX/REQUIREMENTS/SECURITY/TEST_PLAN`)는 공통 원본을 확인하여 main의 추가된 섹션을 유지하고 PR #538 추가 섹션을 이어 붙인다. `CHANGELOG`에는 새 #538 릴리스 섹션을 main의 0.99.0 앞에 추가한다.
- `package.json`/`package-lock.json`은 main `0.99.0`보다 높은 `0.100.0`으로 통일한다. `route-security-inventory.ts` 및 `edit-authorization-handlers.test.ts`는 main에 새로 추가된 Resource Dashboard route 목록과 PR의 project-master 관계 API 2개를 함께 유지한다.
- 교차 수정 없는 26개 PR 파일은 원본 blob SHA를 그대로 보존하고 나머지 main 변경은 main tree에서 유지한다. 이전 #2135.1 SUCCESS는 **merge 이전 PR head** 증거이므로 merge 후 exact head 신규 PR CI를 별도 실행·검증한다.
- 이번 요청은 최신 main 정렬·충돌 해결·새 PR CI 시작까지이며, 병합(main)·Main CI·GHCR 게시·Issue 종료는 미승인.
