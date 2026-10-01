# Issue #372 — Gantt fullscreen에서 Task/Relation Editor 상태 보존

## 최신 기준

- 재정렬 기준 main: `5452e7c7b2014ebf80fee91d92ec8b867bd023dc`
- 기준 version: `0.63.0`
- 작업 branch: `fix/issue-372-fullscreen-editor`
- 후보 version: `0.63.1` PATCH
- PR: #381
- 이전 PR CI: #1448.1 / run `36844396570` — FAILURE
- 사용자 요청 종료점: 재정렬 + 보완 + PR CI 재시작
- release_required: `true` 예상
- release_authorized: `false`

## 이전 실패 분석

#1448.1에서 quality, Vitest, ESLint, typecheck, build, Docker smoke 및 Chromium shard 1/3/4는 PASS했다. shard 2에서 신규 Relation Editor fullscreen 시나리오만 실패했다.

실패 위치:

```text
tests/e2e/project-gantt-fullscreen.spec.ts
Relation Editor도 공통 dialog 경로에서 fullscreen을 유지한다
locator.dblclick timeout
```

Task Editor fullscreen 유지, Grid/Chart double click, Context Menu → Edit, readonly, `exitFullscreen()` 호출 0회 시나리오는 PASS했다.

원인은 stateful fixture의 Relation 두 endpoint 날짜가 2026-09-16과 2026-12-18로 멀어 관계선 DOM target이 현재 viewport에 렌더링되지 않은 상태에서 locator double click을 수행한 것이다. 기존 `relation-dialog-ux.spec.ts`의 안정화 패턴처럼 fixture Task 날짜를 같은 가시 구간으로 맞춘 뒤 실제 link visibility를 확인한다.

## 구현

- `ProjectWorkspace.openTaskEditor/openRelationEditor`: Editor open을 위해 fullscreen을 강제 종료하지 않는다.
- `ProjectGantt`: 더 이상 사용하지 않는 `project-gantt-fullscreen-exit-error` listener를 제거한다.
- native dialog의 top-layer 동작을 사용하며 Gantt instance/state를 보존한다.
- browser가 사용자 Escape 등으로 fullscreen을 종료하는 동작은 차단하지 않는다.

## E2E 보완

- Grid/Chart double click
- Grid/Chart Context Menu → Edit
- readonly Task Editor
- Relation Editor
- Task/Relation dialog open/close 후 fullscreen 유지
- `document.exitFullscreen()` guard 호출 수 0회
- 동일 Gantt root/API identity
- Relation endpoint 날짜를 동일 가시 구간에 배치하고 link visibility 확인 후 double click

## 문서/버전

- `PROJECT_UX.md`, `TASK_EDITOR.md`, `TEST_PLAN.md`, `UI_UX_GUIDELINES.md`, `REQUIREMENTS.md`
- `CHANGELOG.md`
- `package.json`, `package-lock.json` → `0.63.1`

API/DB/Scheduling/Security 계약 변경은 N/A다.

## 실행 상태

- ANALYSIS: PASS
- main 재정렬: 최신 main 기준 재적용
- IMPLEMENTATION: 최신 main에 재적용
- E2E 실패 원인 보완: 반영
- DOCUMENTATION_SYNC: 반영
- Local Fast Feedback: connector 환경에서 별도 shell/browser 실행 없음
- PR CI: branch head 갱신으로 재시작 예정
