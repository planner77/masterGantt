# Issue #407 — Workspace 범위 탭 subtree 내부 작업 추가 회귀

## 기준

- latest main: `5101a4a701dd7dbbeb3091696c0c670c667cb840`
- baseline application: `0.74.0`
- target application: `0.74.1`
- branch: `fix/issue-407-scoped-task-add`
- release_required=true / release_authorized=false
- 종료점: 구현·문서 동기화·PR 생성·PR CI 시작 확인

## 원인

#399의 invalid native add 선제 차단을 scoped Workspace에 적용하면서 `viewRootTaskId !== null`을 add 전면 금지 조건으로 사용했다. 같은 조건이 SVAR interceptor, frame의 `data-task-add-disabled`, native add의 `aria-disabled`에도 중복되어 결과가 현재 subtree 안에 남는 정상 Child add까지 막았다.

## 설계

add 허용 여부는 “scoped view인가?”가 아니라 “생성 결과가 현재 subtree 안에 남는가?”로 판정한다.

- full Project의 native header/root add는 기존대로 허용한다.
- scoped Workspace의 native Grid 행 `+`는 해당 row의 Child add로 취급한다.
- scoped root 또는 descendant Task/Summary가 현재 scope에 포함되고 Milestone이 아니면 Child add를 허용한다.
- 일반 Task의 첫 Child는 기존 `convertParentToSummary: true` 계약을 재사용한다.
- Context Menu create와 native Grid add는 같은 subtree placement 판정을 사용한다.
- scoped header/root-level add, root sibling before/after, scope 밖 parent, Milestone child는 거부한다.
- Outdent/Move/Paste/DnD의 기존 scope escape guard, readonly, mutation lock, edit session, revision/If-Match 계약은 유지한다.
- 같은 Workspace의 scope tab은 하나의 ProjectGantt와 canonical React state를 공유한다.

## 변경

- `src/features/gantt/task-subtree-scope.ts`: add/create 공통 pure subtree placement guard.
- `src/features/gantt/project-gantt.tsx`: click capture/interceptor/ARIA를 target-aware 판정으로 변경하고 scoped 전면 add disable 제거.
- `src/app/globals.css`: scope 전용 global pointer disable 제거; mutation lock은 유지.
- Unit/E2E: scoped root/descendant/native child, nested Summary, normal Task first-child, header/root-level 차단 및 same Gantt instance 회귀.
- REQUIREMENTS / PROJECT_UX / TEST_PLAN / CHANGELOG / active PLAN / package version 동기화.

## DOCUMENTATION_SYNC

- `docs/REQUIREMENTS.md`: scoped add 허용/차단 경계 명시.
- `docs/PROJECT_UX.md`: native Grid 행 `+`와 header/root-level add 의미 분리.
- `docs/TEST_PLAN.md`: #407 Unit/Chromium 회귀 기준 추가.
- `CHANGELOG.md`, `docs/exec-plans/active/PLAN.md`: 0.74.1 및 lifecycle 반영.
- `docs/API.md`: N/A — 신규 endpoint/payload 없음.
- `docs/DB_SCHEMA.md`: N/A — schema/migration 없음.
- `docs/SCHEDULING_ENGINE.md`: N/A — scheduling algorithm 변경 없음.
- `docs/SECURITY.md`: N/A — auth/session/Origin/If-Match 경계 변경 없음.

## 검증

현재 실행 환경은 GitHub clone DNS 접근이 차단되어 Local Fast Feedback은 **NOT TESTED**다. 변경과 직접 관련된 Unit/Chromium E2E를 repository에 추가하고 동일 PR head의 GitHub Actions `quality/e2e/docker`를 공식 회귀 판정으로 사용한다. 사용자 요청 종료점에서는 새 PR CI가 시작된 사실까지만 확인하며 PASS 판정은 하지 않는다.


## PR CI #1620.1 실패 분석 / 보완

Run `37119773303`은 quality(TypeScript/ESLint/Vitest/build/policy)와 Docker, Chromium shard 1/2/3이 PASS했고 shard 4만 FAIL했다. 실패한 두 건은 모두 #407에서 추가한 E2E helper의 selector 오류였다.

Playwright trace의 실제 SVAR Grid DOM은 row identity를 `data-id=":<taskId>"` 형태로 렌더한다. 기존 helper는 `data-id="<taskId>"`를 사용해 scoped root row를 찾지 못했고, 제품 화면에는 row `+`가 정상 렌더된 상태에서도 locator-not-found로 실패했다. 이는 제품 add guard 실패가 아니라 테스트가 SVAR의 canonical TID DOM encoding을 누락한 문제다.

보완:
- `rowByTaskId()`를 기존 SVAR DOM 계약과 동일하게 `data-id=":<taskId>"`로 수정한다.
- 제품 코드/권한/scope predicate/CI gate는 변경하지 않는다.
- 기존 실패 run 재실행이 아니라 수정된 새 PR head에서 전체 PR CI를 새로 시작해 판정한다.


## PR CI #1626.1 실패 분석 / 2차 보완

Run `37120742285`도 quality(TypeScript/ESLint/Vitest/build/policy), Docker, Chromium shard 1/2/3은 PASS했고 shard 4의 #399 test 1건만 FAIL했다. 이전 `data-id` selector 문제는 해소되어 #373 deep-link 회귀는 PASS했다.

실패 시 trace에서 `전체 프로젝트` 탭 전환과 `Scope Beta` 행 가시성까지 성공했지만, #407 검증을 #399 시나리오 중간에 추가하면서 Scope Alpha 아래에 여러 행이 늘어나 Scope Beta가 Gantt viewport 하단으로 이동했다. Playwright의 우클릭이 해당 행을 scroll-into-view한 직후 SVAR selection/virtualized row 갱신이 발생했고 contextmenu가 생성되지 않았다. 실패 snapshot은 전체 프로젝트가 정상 활성화되고 Scope Beta가 선택된 상태이므로 #407 add mutation 또는 scope 전환 실패가 아니다.

보완:
- #399 기존 Workspace tab/navigation E2E에서는 #407의 추가 mutation 시나리오를 제거해 원래 목적과 row geometry를 복원한다.
- #407은 독립 Chromium test로 분리해 scoped root native `+`, empty Summary child, 일반 Task first-child Summary 전환, same ProjectGantt 및 전체 프로젝트 canonical 반영을 검증한다.
- 각 mutation은 새 Task row 표시와 `data-task-mutation-locked` 해제를 기다린 뒤 다음 interaction으로 진행한다.
- 제품 코드와 CI gate는 변경하지 않는다.
