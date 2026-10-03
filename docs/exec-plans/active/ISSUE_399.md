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
