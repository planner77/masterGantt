# Issue #399 — Workspace 내부 WBS 범위 탭 실행 계획

## 기준
- latest main: `fd397c477ebbbdfaff7804be16bacd87fb8411d5`
- baseline application: `0.72.0` (#403/#367/#390 포함)
- target: `0.73.0`
- branch: `feat/issue-399-workspace-scope-tabs`
- release_required=true / release_authorized=false
- 종료점: 구현·문서 동기화·PR 생성·PR CI 시작

## 설계
#373의 subtree 계산, virtual root, `visibleTaskIds/filter-tasks`, canonical snapshot, Dependency context, hierarchy guard, `?rootTask=` direct link, 실제 browser 간 revision freshness는 재사용한다. #399는 `window.open` 기본 진입을 현재 일정 View 내부 `[전체 프로젝트] [Summary ×]` scope tabs로 교체한다.

- 전체 프로젝트 고정/비삭제, Summary taskId key, duplicate open→activate.
- close fallback next→previous→all.
- ArrowLeft/Right/Home/End automatic activation, Delete/close command.
- horizontal tablist, vertical overflow 금지, active/focus nearest scroll.
- single ProjectGantt instance, scope별 filter state, URL history replace.
- direct URL reload는 active scope만 bootstrap; 열린 tab set 전체는 persistence하지 않음.
- 상위 일정/리소스/물류 peer tabs 유지.
- #390 Copy ID 및 #364 clipboard compatibility 보존.

## 변경
`project-readonly-view.tsx`, `project-gantt.tsx`, `globals.css`, `task-context-menu-hierarchy.spec.ts`, PROJECT_UX/REQUIREMENTS/TEST_PLAN/CHANGELOG/PLAN, package version.

## DOCUMENTATION_SYNC
API.md N/A(새 endpoint/payload 없음), DB_SCHEMA.md N/A(migration 없음), SCHEDULING_ENGINE.md N/A(계산 변경 없음), SECURITY.md N/A(auth/session/Origin/If-Match 경계 변경 없음).

## 검증
Local clone은 실행 환경 DNS 제한으로 불가하여 Local Fast Feedback은 NOT TESTED. 동일 PR head의 version check, TypeScript, ESLint, Vitest, Next build, Chromium shards, Docker smoke, lifecycle/policy checks를 공식 판정으로 사용한다. 집중 E2E는 browser page 불변, scope tabs 중복/닫기/URL/reload/filter, Gantt instance, keyboard, 4 viewport overflow와 #373 direct cross-tab burst/loading을 포함한다.


## PR CI #1577.1 실패 보완

Run `37099974800`은 quality/build/typecheck/ESLint/Vitest/Docker 및 Chromium shard 1/3/4가 PASS했고 shard 2/4만 FAIL했다. 실패 report의 320/360/361/401px `project-notifications.spec.ts`에서 unread badge 생성 직후 document `scrollTop`이 약 30~31px 증가해 header bell의 y가 `8 → -22/-23`으로 이동했다.

원인은 #399가 narrow Workspace에 WBS scope tab 2.125rem과 schedule flex gap 0.5rem, 합계 2.625rem을 추가하면서 기존 mobile Gantt minimum 22rem을 그대로 유지해 document가 새로 scrollable해진 것이다. 알림 badge DOM 변화 시 Chromium scroll anchoring이 그 scroll range를 사용하면서 기존 header hit-area 불변 계약을 깨뜨렸다.

보완은 `max-width:48rem`에서 #399 scope panel 내부 Gantt minimum만 `calc(22rem - 2.625rem)`으로 조정해 기존 전체 Workspace vertical budget을 보존한다. 기존 header/notification CSS나 실패 assertion은 완화하지 않는다.


## PR CI #1583.1 재분석 / 2차 보완

Run `37101121153`도 quality/build/typecheck/ESLint/Vitest/Docker 및 Chromium shard 1/3/4가 PASS하고 shard 2/4의 동일 320/360/361/401px notification hit-area만 FAIL했다. 이전 Gantt minimum `22rem - 2.625rem` 보완은 실패 값(`scrollTop 30~31px`, bell y `-22/-23`)을 줄이지 못해 원인 가설이 틀렸음을 확인했다.

두 번째 Playwright trace에서 document scroll은 `dispatchEvent` 자체가 아니라 unread badge/Toast가 React commit되는 시점에 `0 → 30/31px`로 바뀐다. #399이 일정 View에 새 scope tab + tabpanel wrapper를 삽입한 뒤 Chromium document scroll anchoring이 Project 본문의 descendant를 anchor 후보로 사용하고, header feedback DOM 변화에 맞춰 document scroll을 보정하는 것이 직접 원인이다.

따라서 이전 mobile Gantt 높이 차감은 철회하고 기존 22rem minimum을 복원한다. 대신 `.project-readonly { overflow-anchor: none; }`으로 Project Workspace subtree를 document scroll-anchor 후보에서 제외한다. Gantt는 자체 내부 scroll/collapse/selection 상태를 이미 소유하므로 이 설정은 도메인/API 상태를 바꾸지 않고 header feedback 변화가 전체 문서를 이동시키는 것만 차단한다. 기존 notification hit-area assertion은 그대로 유지한다.


## PR CI #1586.1 3차 분석 / 공통 scroll 보존 보완

Run `37101966096`도 quality/build/typecheck/ESLint/Vitest/Docker 및 Chromium shard 1/3/4가 PASS했고, shard 2/4의 320/360/361/401px notification hit-area만 동일하게 FAIL했다. `overflow-anchor:none` 적용 후에도 `scrollTop=31px`이 그대로여서 scroll anchoring 가설 역시 기각한다.

세 번째 trace를 frame snapshot 단위로 비교하면 rejected native add 직후 Toast/unread badge가 이미 렌더된 snapshot에서는 document scroll이 0이고, 약 6ms 뒤 document `scrollTop=31`과 동시에 `.project-gantt-scroll.scrollLeft=286`이 함께 발생한다. 따라서 원인은 feedback DOM 자체가 아니라 SVAR native add event가 취소된 뒤에도 이벤트 대상인 우측 `+` cell의 visibility/focus 후처리 스크롤이 남는 것이다. #399의 추가 vertical 구조가 이 기존 후처리의 y-scroll을 관찰 가능하게 만들었다.

보완은 공통 `WorkspaceNotifications.notify()`에서 첫 publish 직전 `window.scrollX/Y`와 모든 `.project-gantt-scroll`의 scrollLeft/Top을 캡처하고, React/SVAR 후처리가 끝나는 다음 animation frame에 복원한다. 같은 frame에 연속 알림이 발생하면 첫 pre-notification snapshot만 유지해 이미 이동한 위치가 새 기준으로 덮어써지지 않게 한다. unmount 시 pending animation frame을 취소한다. 실패 테스트나 SVAR gate를 완화하지 않는다.

효과가 없었던 `.project-readonly { overflow-anchor:none }` 변경은 제거한다.


## PR CI #1591.1 4차 분석 / commit-phase 복원

Run `37103170043`은 quality/build/typecheck/ESLint/Vitest/Docker 및 Chromium shard 1/3이 PASS했고 shard 2/4와 shard 4/4가 FAIL했다.

- shard 2: 기존 320/360/361/401px notification hit-area가 동일하게 `bell y 8 → -22/-23`로 실패했다. 3차 rAF 복원은 Toast/badge DOM이 먼저 관찰된 뒤 실행될 수 있어 timing이 늦었다.
- shard 4: `Issue #72 hierarchy commands persist...`의 마지막 Project GET에서 `read ECONNRESET`이 발생했다. HTTP status/assertion 실패가 아니라 Playwright APIRequestContext의 test-server connection reset이며 #399 제품 로직과 직접 연결되는 증거는 없다. 전체 새 CI로 재검증한다.

4차 보완은 notification publish 직전 첫 scroll snapshot을 캡처하는 점은 유지하되, 복원 시점을 `requestAnimationFrame`에서 React `useLayoutEffect`로 이동한다. SVAR native add handler가 callback 반환 뒤 visibility/focus scroll을 수행하고 event가 끝난 다음 React가 feedback state를 commit하므로, layout effect는 Toast/badge가 paint되어 테스트/사용자에게 노출되기 전에 page/Gantt scroll을 원래 위치로 복원한다. 연속 publish는 첫 pending snapshot만 유지한다.


## PR CI #1596.1 5차 분석 / SVAR reject 경계로 수정 축소

Run `37104319586`은 quality/build/typecheck/ESLint/Vitest/Docker, Chromium shard 1/3/4가 PASS했고 shard 2/4의 동일 320/360/361/401px notification geometry 4건만 FAIL했다. 이전 run에서 발생한 shard 4 `ECONNRESET`은 재현되지 않아 환경성으로 정리한다.

4차 `useLayoutEffect` 복원도 실패했다. 이유는 milestone native add가 `ProjectGantt.interceptNativeTaskAdd`에서 즉시 거부되는 것이 아니라 `onTaskCreate`를 호출한 뒤 Project Workspace의 `createNativeTask`가 milestone parent를 거부하면서 notification state가 먼저 commit되고, 그 후 SVAR Core가 interceptor 반환 뒤 visibility/focus scroll을 계속 수행하기 때문이다. 따라서 notification 계층에서 어느 React phase에 복원해도 Core 후처리보다 앞설 수 있다.

5차 보완은 책임 경계를 SVAR interceptor로 되돌린다.
- `ProjectGantt`가 canonical tasks map으로 milestone target을 직접 판별한다.
- scope/missing/milestone native add reject 사유를 명시적으로 부모 callback에 전달한다.
- reject 직전 page, outer `.project-gantt-scroll`, inner table/chart scroll을 캡처한다.
- current task 종료 후 Core 후처리보다 늦은 double-rAF까지 위치를 반복 복원하고 Gantt region에 `preventScroll` focus를 둔다.
- viewport가 안정된 뒤에만 부모 notification을 publish한다.
- 공통 `WorkspaceNotifications`의 scroll 보존 변경은 main 상태로 완전히 되돌린다.
- 기존 parent milestone guard는 다른 호출 경로의 defense-in-depth로 유지한다.

실패 assertion/CI gate는 수정하지 않는다.


## Latest main 재정렬 — #403 / #367 반영

PR #404 작업 중 main이 `cbe90acf...`에서 `fd397c477...`로 21 commits 전진했다. #403 Project List 날짜 열/공통 UI·QA 기준과 #367 Gantt Day 36px + public resize 기반 timeline 동적 확장을 모두 보존해야 하므로 단순 충돌 해결 대신 latest main tree를 기준으로 #399 변경을 재합성한다.

- `project-readonly-view.tsx`, `globals.css`, hierarchy E2E, REQUIREMENTS는 main에서 해당 기간 변경이 없어 #399 blob을 그대로 재사용한다.
- `project-gantt.tsx`는 latest main의 #367 `GANTT_CELL_WIDTH`, timeline range/resize 로직을 기준으로 #399 menu semantics와 native add reject viewport guard만 재적용한다.
- PROJECT_UX / TEST_PLAN / active PLAN / CHANGELOG는 latest main 내용을 보존하고 #399 section만 합성한다.
- main `0.72.0`과 충돌하므로 #399 target은 다음 MINOR `0.73.0`으로 재산정한다.
- 이전 CI #1596.1에서 shard 4의 `ECONNRESET`은 재현되지 않았고 shard 2 notification geometry만 남았다. 최신 main 정렬 head에서 전체 CI를 다시 판정한다.


## PR CI #1600.1 6차 분석 / pre-Core viewport capture

Run `37105809279`은 latest main `fd397c477...` 정렬 head에서 quality/build/typecheck/ESLint/Vitest/Docker 및 Chromium shard 1/3/4가 PASS했고 shard 2/4의 notification geometry가 4건에서 3건(360/361/401px)으로 줄었다. 320px은 PASS하여 SVAR reject 경계로 수정한 방향은 일부 효과가 확인됐다.

Trace timeline을 다시 보면 `dispatchEvent("click")` 완료 직후부터 첫 Toast assertion 전 사이에 document `scrollTop=30`과 outer Gantt `scrollLeft=294`가 이미 적용된다. 기존 5차 구현은 `interceptNativeTaskAdd`가 호출된 뒤 viewport를 캡처했으므로, Core가 add cell을 active/visible 처리하며 이미 이동시킨 값을 snapshot으로 저장했다. 이후 double-rAF 복원은 잘못된 위치를 정확히 복원하고 있었다.

6차 보완은 캡처 시점을 SVAR보다 앞으로 이동한다.
- `.project-gantt-scroll`의 React `onClickCapture`에서 `[data-action="add-task"]` 이벤트를 감지한다.
- child/SVAR handler가 실행되기 전 page, outer Gantt, inner table/chart scroll을 저장한다.
- interceptor reject는 pre-Core snapshot을 consume하고, 없을 때만 현재 위치를 fallback으로 캡처한다.
- scope/missing/milestone reject 후 microtask + double-rAF 복원과 notification publish는 유지한다.
- 정상 add는 pending snapshot을 즉시 폐기해 다음 command에 stale 위치가 남지 않게 한다.
- 복원 과정에서 focus target을 임의 변경하지 않는다.

실패 E2E와 CI gate는 그대로 유지한다.
