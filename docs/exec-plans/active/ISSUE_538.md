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


## CI Run #2156.1 실패 / 최신 main 재정렬 및 E2E 안정화 (2026-10-08 KST)

- PR #539 기존 head `c8ad66e7ed2110c9458cd7b0de005d32d989ad5e`, [CI #2156.1](https://github.com/planner77/masterGantt/actions/runs/37736384745) FAIL. Vitest, ESLint, TypeScript, Next.js build, policy, Docker 및 E2E shards 1~5 PASS.
- E2E shard 6: 신규 main #526의 `tests/e2e/resource-milestone-views.spec.ts` 최초 `setup()`에서 Gantt scroll `{left:120,top:96}` 직후 `left=1581`로 이동, 74 PASS / 1 FAIL / 1 SKIP. 실제 제품 반응인지 native row selection 직후 지연 스크롤 경합인지 trace 직접 재생 미검증. 초기 fixture에서 delayed scroll-to-task 실행과 명시 scroll 설정이 경합할 수 있으므로, **두 RAF 이후 DOM과 Core 공개 viewport를 함께 확인하고 목표 좌표를 bounded 재설정**해 상태를 고정한다. 진짜 Resource 탭 왕복 상태 보존 `expect.poll(() => ganttState(page)).toEqual(before)`은 변경하지 않는다.
- main이 `8b9d4d76758f73094ec84590e3a8a49314741587`에서 `b4a0898283571ac4f05d53299266acccadeeff68`로 6 commits 이동했으며 #527 Resource Plan/version 0.100.0을 포함한다. 최신 main과 #538를 다시 두 부모 merge 방식으로 정렬하고 고유 변경·Resource Plan을 함께 보존한다. 버전은 `0.101.0`.
- `release_required=true`, `release_authorized=false`. 새 PR CI exact-head 등록까지만 실행하며 병합/Main CI/정식 GHCR 게시/Issue 종료 미진행.

## 2026-10-08 최신 main 재정렬 (#539)

- 정렬 전 PR head: `4c63af8cb7d4d50bb6cdafcd108aa5df0f0a4cc0`, 기준 latest main: `599b824677cec2daa47743a60fcac422297f925b` (Issue #514/#518/#528/#529 병합, app 0.102.0).
- 공통 parent `b4a0898283571ac4f05d53299266acccadeeff68` 이후 PR 고유 변경 38파일, main 변경 134파일 중 **동시 변경 14파일**을 교차 검토했다.
- 최신 main의 전체 tree에서 출발해 #538 전용 24파일을 원본 blob SHA로 보존. 동시 수정된 7개 문서는 PR의 #538 추가 섹션만 최신 main 문서 뒤에 통합하고 #514/#518/#528/#529 내용을 유지했다.
- 최신 main `project-gantt.tsx`(새로운 Grid 날짜 표시 이동 및 peer viewport 처리)의 코드를 유지하면서 #538 메타데이터 저장 뒤 비영점 스크롤 복원 helper/import만 해당 guard에 적용한다. `tests/e2e/resource-milestone-views.spec.ts`는 최신 main #529에서 이미 DOM·SVAR Core의 안정화된 스크롤을 검증하도록 개선했으므로 PR의 과거 #526 테스트 픽스처 재시도안으로 덮어쓰지 않고 main을 선택한다.
- `src/server/security/route-security-inventory.ts`와 `tests/server/projects/edit-authorization-handlers.test.ts`는 최신 main의 새 Query/Scope API 계약을 유지하고 #538 전역 관리자 관계 POST/DELETE 두 경로만 추가했다.
- `CHANGELOG.md`는 main의 0.102.0 및 기존 릴리스 이력을 보존하면서 Issue #538의 0.103.0 내용을 상단에 추가. `package.json`과 `package-lock.json` 루트 버전은 둘 다 0.103.0.
- 최종 결과는 두 부모 merge commit의 GitHub trees/refs와 PR CI exact head로 검증해야 하며, 이전 Run #2160.1 SUCCESS는 정렬 전 head 증거로만 남긴다.
- 승인 범위는 main 정렬·충돌 해결·**새 PR CI 시작**까지. main 병합, Main CI, 정식 GHCR 게시, Issue 종료는 별도 승인 전 시행하지 않는다.

## 최신 main 정렬 기록 — 2026-10-08, PR #539

- 본 병합의 PR 부모: `73d63a4a3c98a955b4230badd847f6265b808f0a`; 최신 main 부모: `dca2f7821f277ef31ee3dbcbdc1e51ad257209f0` (#519 Milestone 후보 ID 제거, 버전 0.102.1 포함). 공통 조상: `599b824677cec2daa47743a60fcac422297f925b`.
- 공통 조상 이후 PR 독립 37파일, main 변경 11파일, 중복 변경 6파일. 최신 main tree를 기준으로 PR 독립 31파일은 원래 blob SHA를 그대로 적용. 이 방식으로 main 고유 Milestone 관련 source/test와 문서 변경을 모두 보존.
- 동시 변경 문서 `PROJECT_UX.md`, `TEST_PLAN.md`, `UI_UX_GUIDELINES.md`에는 최신 main의 수정 사항을 보존하고 #538 독립 섹션을 병합. `CHANGELOG.md`에 #538 0.103.0 변경을 0.102.1 앞에 추가하고 `package.json`·`package-lock.json` 버전을 0.103.0으로 통일.
- 이전 PR CI #2189.1은 부모 SHA `73d63a4a3c98a955b4230badd847f6265b808f0a`에 대해 SUCCESS. 최신 main 반영 후 exact-head full PR CI를 새로 시작해야 하므로 부모 CI 성공만으로 병합 승인하지 않음.
- 작업 범위는 최신 main 정렬·충돌 해소·새 PR CI 시작까지. Main 병합, Main CI, GHCR 게시, Issue 종료 미진행.

## 병합 전 리뷰 보완 · 2026-10-08

- PR #539 Codex 리뷰의 unresolved P1 migration schema assertion은 앞선 commit에서 이미 테스트 동기화하여 CI #2197.1 통과. 나머지 P2 3건(비활성 상위항목 유지 상태에서 하위 선택 변경, 비활성 관계의 idempotent 재연결, 과거 template 인스턴스화의 hierarchy 충돌 500) 보완.
- project master는 값 전체 변경 때 기존의 비활성 상위·형제·하위 항목을 신규 조합으로 재사용할 수 없도록 검증한다. 세 분류값 모두 변화 없으면 과거 프로젝트 보존 정책을 유지한다.
- 관리자 기존 관계 POST 재시도는 활성 검증 전에 idempotent no-op으로 처리해 revision을 증가시키지 않는다. 신규 관계 연결만 활성 검증을 요구한다.
- 기존 template snapshot의 잘못된 계층은 서버에서 409 `PROJECT_MASTER_RELATION_INVALID`로 번역하며 500을 노출하지 않는다. 템플릿 스냅샷의 무추정 보존 및 트랜잭션 롤백 계약을 유지한다.
- Vitest 단위 및 handler 테스트를 추가하고 이 PR의 exact head 새 CI에서 검증한다. 명시적 GHCR 릴리스 승인 요청을 Issue #538의 v0.103.0 marker로 기록한 다음 성공 Main CI 이후 범용 Finalizer 절차로 게시한다.

## 리뷰 보완 성공 및 #487 최신 main 정렬

- 리뷰 지적 P1 1건/P2 3건의 검토·수정·리뷰 스레드 해결 완료. `650e2a45d8b952e5c302390dbab61c33bec588df`에서 전체 PR CI #2201.1 SUCCESS, PR metadata #2202 SUCCESS.
- Latest main `08ac7749efc4544dfc125853d9e58ef3a9d56b21` (Issue #487 Playwright CI 안정화)를 PR과 이중 부모 병합하여 release candidate `v0.103.0`을 보존. GitHub synchronization 시 새 정확한 HEAD의 full PR CI를 요구한다.
- OWNER 댓글 #6061984912는 `mastergantt-release-authorization:v1` with `expected_version=0.103.0`로 검증. CI 성공 전 병합/태그 금지, merge 후 main CI SUCCESS와 범용 Release Finalizer로 GHCR 게시.
