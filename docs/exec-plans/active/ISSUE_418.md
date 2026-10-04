# Issue #418 — Workspace 범위 Header/Row 작업 추가 일관성 및 화면 연속성

## 기준

- latest main: `888b3a657ee9e29a69f322c505cb494d22f0275a`
- baseline application: `0.79.0`
- target application: `0.79.1`
- installed SVAR React Gantt: `2.7.3`
- branch: `fix/issue-418-scoped-native-add-continuity`
- latest-main integration: #412 Resource 전역 역할 + #409 Relation Editor taskId 검색 + #416 Week Header `Wxx + N일` 표시/Tooltip lifecycle 보존
- release_required=true / release_authorized=false
- 종료점: 구현·문서 동기화·PR 생성·PR CI 시작 확인

## 원인

#407은 scoped Workspace에서 유효한 **행 `+` Child add**를 복구하면서 scoped Header/root-level add는 scope 밖 생성으로 간주해 차단했다. 그 결과 같은 화면의 Header `+`와 Row `+`가 서로 다른 의미/활성 상태를 가졌고, native DOM click target과 SVAR `add-task` event payload가 분리된 경로도 남았다.

또한 canonical snapshot 반영과 `filter-tasks`가 서로 다른 effect에서 독립 실행되어, 새 child가 React visible set에는 포함됐지만 SVAR Core store에는 아직 `add-task`되지 않은 짧은 구간이 가능했다. scoped filter가 이 중간 상태를 먼저 관찰하면 Grid가 순간적으로 비거나 위치가 흔들릴 수 있다.

## 설계

- native add의 의미를 `source=header|row`와 active `viewRootTaskId`로 해석하는 pure resolver 하나로 통합한다.
- 전체 Project Header `+`: 기존 root Task 추가를 유지한다.
- scoped Header `+`: Project root/sibling이 아니라 **현재 scope root Summary의 immediate child**를 추가한다. 사용자가 보는 범위에서의 “최상위 작업 추가” 의미다.
- scoped root/descendant Row `+`: 해당 Row의 child를 추가한다.
- 일반 Task Row의 첫 child는 기존 서버 계약 `convertParentToSummary: true`를 재사용한다.
- Milestone, missing/out-of-scope target, `before/after`처럼 scope를 탈출하는 placement는 fail-closed 한다.
- Header/Row의 `aria-disabled`, focusability, accessible name과 실제 mutation resolver를 같은 판정으로 만든다.
- canonical `add-task/update-task/move-task` queue 뒤에 `filter-tasks`를 직렬화해 Core가 새 row를 갖기 전에 새 visible set을 적용하지 않는다.
- native add 직전 Project/Gantt scroll과 trigger context를 저장하고 mutation lock 해제 뒤 같은 scope에서 scroll/focus를 복원한다.
- 정상 저장은 기존 단일 `ProjectGantt` instance, protected HTTP mutation, canonical snapshot, If-Match/revision 계약을 유지한다.

## SVAR 근거

설치 Core 2.7.3의 공개 Grid `add-task` column과 `add-task` action(`target`, `mode=before|after|child`)을 그대로 사용한다. 별도 임시 Task store나 비공개 API를 만들지 않는다.

- https://docs.svar.dev/react/gantt/api/actions/add-task/
- https://docs.svar.dev/react/gantt/api/configs/columns/
- https://docs.svar.dev/react/gantt/samples/#/base/willow

## 검증

- Unit: `native-task-add-intent.test.ts`에서 full/scoped Header, scoped root/descendant Task/Summary, Milestone, outside target, before/after, invalid scope를 검증한다.
- Chromium: 실제 SVAR Header/Row `+`를 클릭해 scope-root immediate child, descendant Summary child, 일반 Task first-child Summary 전환을 서버 응답과 canonical row로 검증한다.
- Milestone native `+`는 disabled + mutation 0 + 명시적 feedback을 검증한다.
- `requestAnimationFrame` probe로 성공 add 동안 row count가 0이 되지 않고 Gantt frame이 disconnect/hidden되지 않는지 확인한다. horizontal scroll, focus, active scope, ProjectGantt/API instance 보존도 확인한다.
- 기존 #373/#399 deep link, #407 scope guard, #299 vertical DnD, #370 Date Picker, #384 selection, #367 timeline 및 protected mutation 회귀를 전체 PR CI에서 판정한다.

현재 실행 환경은 GitHub clone DNS 접근이 차단되어 Local Fast Feedback은 **NOT TESTED**다. 동일 PR head의 GitHub Actions `quality/e2e/docker`가 공식 회귀 판정이다. 사용자 요청 종료점은 CI 시작 확인이며 PASS, merge, main CI, GHCR, release finalizer, Issue 종료는 이번 단계 범위 밖이다.

## DOCUMENTATION_SYNC

- `DESIGN.md`: scope-relative native action은 UI 상태와 command target을 한 resolver로 해석한다는 원칙 추가.
- `docs/REQUIREMENTS.md`, `docs/PROJECT_UX.md`: scoped Header `+`를 scope root immediate child 생성으로 정의하고 Row/Milestone 경계를 명시.
- `docs/TEST_PLAN.md`: #418 native controls/continuity/focus/instance 회귀 기준 추가.
- `docs/PRO_FEATURE_MATRIX.md`: Core 공개 `add-task` 사용 경계와 독립 canonical resolver 기록.
- `docs/ARCHITECTURE.md`: full-project Header와 scoped Header의 command 의미를 구분.
- `CHANGELOG.md`, active `PLAN.md`, `package*.json`: `0.77.1` 후보와 lifecycle 동기화.
- `docs/API.md`: N/A — endpoint/payload/HTTP status 변경 없음.
- `docs/DB_SCHEMA.md`: N/A — schema/migration 변경 없음.
- `docs/SCHEDULING_ENGINE.md`: N/A — 일정 계산 규칙 변경 없음.
- `docs/SECURITY.md`: N/A — 인증/session/Origin/If-Match/revision 경계 변경 없음.

## PR CI #1670.1 실패 분석 / 보완

Run `37181077927`은 제품 코드 검증 전에 `변경 경로 판정` job에서 실패했다. 원인은 PR 본문에 workflow trace 정책이 요구하는 canonical `Refs #418`가 없고 `Issue: #418`만 존재한 것이다. 이 실패로 quality/E2E/Docker 구현 job은 모두 skip되었으며 제품 코드의 PASS/FAIL 근거로 사용할 수 없다.

보완:
- PR #420 본문에 `Refs #418`를 정확히 한 번 추가한다.
- 제품 코드/테스트 구현은 이 실패 원인과 무관하므로 변경하지 않는다.
- 새 head commit을 생성해 기존 run 재실행이 아니라 전체 PR CI를 새로 시작한다.


## PR CI #1679.1 실패 분석 / 보완

Run `37184416846`은 변경 경로 판정, TypeScript, ESLint, Vitest, Next build, policy, Docker와 Chromium shard 1/3/4가 PASS했고 **Chromium shard 2/4의 기존 Issue #3 회귀 1건만 실패**했다.

실패 위치는 `project-gantt-stability.spec.ts`의 Milestone Row `+` 클릭이다. #418은 Milestone add control에 `role=button`, `aria-disabled=true`, `tabIndex=-1`을 일치시켜 disabled semantics를 강화했다. Playwright의 일반 `.click()`은 이 상태를 올바르게 disabled로 해석해 activation 전에 timeout했다. 제품 mutation 실패가 아니라 기존 테스트가 과거의 “겉보기 disabled지만 일반 click 가능” 상태를 전제로 한 회귀다.

보완:
- 기존 stability E2E에서 Milestone `+`의 `aria-disabled=true`를 먼저 검증한다.
- disabled control의 reject/notification handler 회귀는 기존 `project-notifications.spec.ts`와 같은 방식으로 `dispatchEvent("click")`을 사용한다.
- mutation 0회와 명시적 feedback 검증은 유지한다.
- 제품 코드의 disabled semantics는 완화하지 않는다.
- 수정된 새 head에서 전체 PR CI를 새로 시작한다.


## PR #424 review P2 보완

자동 review의 3개 P2를 반영한다.

- Keyboard activation: SVAR custom `<i data-action="add-task">`는 native button이 아니므로 Gantt keydown capture에서 enabled add control의 Enter/Space를 click activation으로 연결하고 disabled control은 activation하지 않는다. Chromium에서 scoped Header Enter와 descendant Row Space를 실제 POST/canonical row까지 검증한다.
- Focus fallback: native add 뒤 permission이 401로 readonly가 되면 원래 add action이 `aria-disabled=true/tabIndex=-1`이므로 focus를 되돌리지 않고 Gantt region으로 복원한다. Stability E2E가 readonly 전환 뒤 region focus를 검증한다.
- Decoration cost: scoped subtree와 task map을 decoration effect당 한 번 계산하고 각 add action은 Set/Map lookup만 사용한다. MutationObserver 반복에서도 row마다 subtree를 다시 순회하지 않는다.

새 exact head의 전체 PR CI PASS 후 review thread를 resolve하고 merge한다.
