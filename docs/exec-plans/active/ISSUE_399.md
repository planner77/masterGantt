# Issue #399 — Workspace 내부 WBS 범위 탭 실행 계획

## 기준
- latest main: `cbe90acf0bf9785240e6a0ff2a2e5c532ab9251f`
- baseline application: `0.71.0` (#390 포함)
- target: `0.72.0`
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
