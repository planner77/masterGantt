# Issue #492 — Grid/Chart 작업 Hover Tooltip

## 기준

- Issue: #492
- base main: `d8d0bb3bab5d13ca68a6b319e116dec4ca24d48d`
- branch: `feat/issue-492-task-hover-tooltip`
- base version: `0.94.3`
- candidate version: `0.95.0`
- release_required: true
- release_authorized: true — 사용자가 병합 후 정식 GHCR 게시를 명시적으로 승인했으며 Issue comment의 `expected_version=0.95.0` marker가 authority

## 설계 결정

Grid 작업 행과 Chart Task/Summary/Milestone는 기존 `TASK_TARGET_SELECTOR`가 이미 같은 canonical taskId를 resolve한다. SVAR 공식 Tooltip 경로를 먼저 검토했으나 PR CI #2023/#2026에서 설치 2.7.3 wrapper가 Milestone·WBS scope hover를 일관되게 처리하지 못하고 Header Tooltip과 role이 중복되는 것을 확인했다. 최종 구현은 기존 Header Tooltip과 같은 app-owned delegated hover 방식으로 이 selector를 사용한다.

표시 authority는 `ProjectTaskDto`다. `projectTasksToSvarTasks`는 date-less Summary를 Core에서 행으로 유지하기 위해 임시 anchor 날짜를 사용하므로 Core `ITask.start/end`를 Tooltip 데이터로 사용하지 않는다. pure helper가 canonical `name/start/end`를 기존 `formatLocaleDateOnly`로 변환하고 null은 `—`로 표시한다.

Task Tooltip은 hover 중인 Grid row/Chart bar가 있을 때만 React DOM에 존재하며 pointer event를 받지 않는다. keyboard focus가 Header로 이동하거나 Gantt 영역을 떠나거나 scroll되면 즉시 닫아 #315/#316 Header Tooltip의 단일 `role=tooltip`/Escape 계약을 보존한다. fixed overlay는 `.project-gantt-frame` 내부에 렌더링되어 fullscreen에서도 같은 subtree에 남고 Gantt/API instance를 remount하지 않는다.

## 변경 파일

- `src/features/gantt/project-gantt.tsx`
- `src/features/gantt/task-hover-tooltip.ts`
- `src/features/gantt/gantt-scale-toolbar.css`
- `tests/features/gantt/task-hover-tooltip.test.ts`
- `tests/e2e/project-task-hover-tooltip.spec.ts`
- `docs/REQUIREMENTS.md`
- `docs/PROJECT_UX.md`
- `docs/UI_UX_GUIDELINES.md`
- `docs/TEST_PLAN.md`
- `docs/exec-plans/active/PLAN.md`
- `CHANGELOG.md`
- `package.json`, `package-lock.json`

## 검증

- Unit: canonical locale formatting, null dates.
- Chromium: Grid/Chart 동일 표시, Task/Summary/Milestone, date-less Summary, Week, fullscreen, WBS scope, readonly.
- PR CI #2028에서 Task/Summary·WBS/readonly는 PASS했고 viewport 밖 Milestone만 Playwright `hover()` auto-scroll과 제품의 scroll-dismiss 계약이 경합해 실패했다. E2E는 scroll을 먼저 완료한 뒤 hover하도록 순서를 분리한다.
- PR 전체 회귀: Header Tooltip #315/#316, Context Menu, double-click Editor, Chart drag/dependency 포함.
- PR CI #2040 shard 6에서 #490/#456 viewport 계약의 `scrollLeft 120 → 91` 회귀를 확인했다. Task Tooltip state/event listener를 별도 child layer로 이동해 hover state 변경이 ProjectGantt/SVAR 부모를 재렌더링하지 않도록 한다.
- CI 시작 전/진행 중 결과는 NOT TESTED. 동일 PR head GitHub Actions `quality/e2e/docker` 완료 결과만 공식 판정한다.

## 문서 영향

- REQUIREMENTS/PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN/CHANGELOG/active plan 동기화.
- DESIGN.md는 기존 Data-dense/Progressive disclosure/Precise feedback/SVAR-native interaction 원칙을 그대로 적용하므로 새 전역 디자인 규칙이 없어 변경하지 않는다.
- API/DB/SCHEDULING/SECURITY는 조회 전용 presentation 변경이며 계약 변화가 없어 변경하지 않는다.
