# Issue #303 — Task 상태·진행률 완료 동기화

## 최신 기준

- 재정렬 기준 main: `6015abe1bdf8c0cbfb7a47789051bebd69b9392f`
- baseline application: `0.73.0`
- target application: `0.74.0`
- migration: `0019_task_status.sql`
- `@svar-ui/react-gantt`: `2.7.3`

## Canonical 상태 모델

Task/Milestone은 `not_started | in_progress | completed` 상태를 영속화한다. Project status와 타입/의미를 공유하지 않는다. Summary는 직접 편집하지 않고 derived progress로 status를 계산한다.

| 입력/전환 | canonical 결과 |
|---|---|
| progress = 100 | completed + 100 |
| status = completed | completed + 100 |
| completed에서 progress < 100 | in_progress + 입력 progress |
| status = not_started | not_started + 0 |
| status = in_progress, 기존 100 | in_progress + 0 |
| progress 1~99 | in_progress + progress |

## 최신 main 통합 결정

- #258: Dependency endpoint도 leaf field 편집 가능 정책을 그대로 사용한다.
- #368: requestedEnd/duration 양방향 Task Editor 모델을 보존한다.
- #384: 다중 subtree Copy에서 원본 status를 각 복제 Task에 보존한다.
- #399: Workspace scope tab / 단일 ProjectGantt instance를 유지한다.
- 기존 Phase 3 E2E의 desktop 작업명/진행률 2열 geometry를 유지하기 위해 상태 Select는 진행률 보조 영역 내부에 배치한다.
- Scheduling purity를 위해 hierarchy는 `domain/task-status`를 import하지 않고 derived progress로 Summary status를 직접 파생한다.

## 과거 PR #310 실패 보완

- migration 기대값은 최신 ledger 19건으로 갱신한다.
- hierarchy의 cross-domain import를 제거해 purity boundary를 보존한다.
- Task Editor 진행률 위치를 새 행으로 내리지 않고 기존 desktop 보조 열을 유지한다.
- Codex P2: subtree Copy status 보존, Template instantiate response status 포함을 반영한다.

## 검증 경계

새 head에서 TypeScript, ESLint, Vitest, build, Docker smoke, Chromium E2E 전체를 다시 실행한다. 과거 head의 PASS/FAIL은 최신 head 판정에 재사용하지 않는다.
