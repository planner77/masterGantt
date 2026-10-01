# Issue #373 실행 계획 — Summary 하위 WBS scoped view

## 기준

- Issue: #373 `[Feature/UX] Summary Task 하위 WBS를 새 탭에서 최상위 범위로 열어 조회·편집`
- 기준 main: `2dc06f772390ba41c0687ab2a22353f6c077fc80`
- 기준 application: `0.61.0`
- branch: `feat/issue-373-summary-root-view`
- target version: `0.63.0` (open PR #374 / Issue #370이 `0.62.0` 사용 중)
- `release_required=true`: 사용자-facing feature/version 변경이므로 향후 정식 release 대상이다.
- `release_authorized=false`: 이번 사용자 요청은 구현 후 PR CI 시작까지이며 merge/tag/GHCR 정식 게시 승인은 포함하지 않는다.

## 구현 범위

1. child가 있는 Summary의 기존 Grid/Chart Context Menu에 조회/navigation 명령 `최상위로 열기` 추가.
2. `/projects/{publicId}?rootTask={taskId}` deep link를 새 탭으로 열고 secret/internal ID를 URL에 넣지 않는다.
3. 전체 canonical Project snapshot은 유지하고 선택 Summary + descendants만 existing `visibleTaskIds → SVAR filter-tasks`로 표시한다. 선택 Summary의 canonical parent는 그대로 두고 SVAR adapter에서만 `parent=0`으로 투영한다.
4. 기존 search/filter/quick view는 subtree 안에서만 적용한다. scoped view는 schedule workspace만 보여 전체 Project Resource/Logistics 화면을 subtree 범위로 오인시키지 않는다.
5. 기존 edit session이 있으면 같은 origin 새 탭에서도 기존 Task/Relation edit 계약을 사용한다. readonly에서도 navigation은 가능하다.
6. successful higher revision을 localStorage revision event로 다른 same-origin tab에 알리고 수신 탭은 canonical Project GET으로 최신 상태를 확인한다. localStorage는 데이터/권한 source of truth가 아니다.
7. 빈 Summary root는 유지하고 missing/non-Summary root는 scope 오류와 전체 Project 복귀를 제공한다.

## 파일 소유권

- frontend: `src/features/gantt/project-gantt.tsx`, `task-subtree-scope.ts`, `src/features/projects/project-readonly-view.tsx`, `src/app/globals.css`, unit/E2E.
- Manager/documentation: Requirements, Project UX, Test Plan, CHANGELOG, active plan/version.
- backend/scheduler: 기존 full snapshot 및 mutation/scheduling 계약 변경이 발견될 때만 참여.
- infra: PR 생성 및 Actions 시작/증거.
- qa_docs: PR head 기준 요구사항/코드/테스트/문서 비교. 현재 세션에는 독립 sub-agent 실행 도구가 없으므로 별도 QA PASS를 가장하지 않는다.

## 문서 영향

- 필수 갱신: `docs/REQUIREMENTS.md`, `docs/PROJECT_UX.md`, `docs/TEST_PLAN.md`, `CHANGELOG.md`, active plan.
- `docs/TASK_EDITOR.md`: N/A — Editor 필드/저장/dirty/stale 계약을 변경하지 않고 기존 Editor에 full canonical tasks/links를 전달한다.
- `docs/API.md`: N/A — existing Project GET 및 Task/Link mutation만 사용한다.
- `docs/DB_SCHEMA.md`: N/A — persistence 추가 없음.
- `docs/SCHEDULING_ENGINE.md`: N/A — 일정 계산/Dependency algorithm 변경 없음.
- `docs/SECURITY.md`: N/A — rootTask는 view scope일 뿐이며 기존 edit session/Origin/If-Match/revision server authorization을 유지하고 URL에 secret을 추가하지 않는다.
- `docs/ARCHITECTURE.md`: N/A — 기존 ProjectReadonlyView/ProjectGantt 및 client view state 경계를 재사용한다.

## 검증 계획

- Unit: `tests/features/gantt/task-subtree-scope.test.ts`.
- E2E: `tests/e2e/task-context-menu-hierarchy.spec.ts`에 실제 new tab → scoped view → Task Editor save → original tab canonical refresh → scoped reload를 추가한다.
- 기존 Context Menu / filter / Editor / relation / tree persistence 회귀는 PR quality/e2e에서 확인한다.
- Local Fast Feedback: 현재 ChatGPT 실행 환경에는 repository worktree/runner가 없고 외부 GitHub clone도 불가하므로 실행 증거는 확보할 수 없다. 작성된 테스트는 PR Actions 실행 전 `NOT TESTED`다.
- 공식 검증: PR head의 GitHub Actions `quality/e2e/docker`. 사용자 요청은 **시작 확인**까지이며 성공 판정은 후속 확인 대상이다.

## 완료 경계

이번 실행의 ACCEPT 경계는 구현·문서 동기화·PR 생성 및 PR CI run 시작 확인이다. CI가 queued/in_progress면 `NOT TESTED`이며 merge/main CI/release/finalizer/branch cleanup/Issue close를 수행하지 않는다.
