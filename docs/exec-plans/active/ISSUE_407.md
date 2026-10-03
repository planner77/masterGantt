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
