# Issue #506 — Context Menu Add Above/Below sibling 위치 복구

## 범위·근거
- Source [#506](https://github.com/planner77/masterGantt/issues/506), 최초 요구 #72, 관련 #373/#399/#407/#418; 2026-10-25 기준 `main` `fcd1ae59d268efa1913f4de625a9013cabd1de4a`, 작업 브랜치 `fix/issue-506-add-above-order-20261025`.
- `AGENTS.md`의 Test Lifecycle/QA 및 `DESIGN.md` SVAR-native·scoped-view 원칙, [SVAR 공식 add-task](https://docs.svar.dev/react/gantt/api/actions/add-task/)의 `mode="before"|"after"`/`target`, [Willow Context Menu 데모](https://docs.svar.dev/react/gantt/samples/#/context-menu/willow)를 기준으로 한다.
- old `fix/issue-506-context-add-sibling-order` 브랜치는 main 대비 1437 커밋 뒤처졌으므로 전체 병합 금지. 현재 canonical sync/viewport/collapse/reparent 개선을 보존한 최소 교정.
- **버전**: v0.133.0 annotated Git tag가 이미 존재하여 이동/재사용 금지. 신규 PATCH `0.133.1` package+lock root 3군데 동기화, 미발행 후보.

## 분석·설계
1. 프런트 `project-gantt.tsx::createTaskFromMenu`은 `anchorTaskId,placement`를 정상 전달한다. 서버 `task-hierarchy-service-core.ts::insertionTarget/create/rewriteFamily`도 같은 parent의 정확한 index와 연속 siblingOrder를 계산하므로 계약·DB·API 변경 없이 기존 구현을 보존한다.
2. `canonical-snapshot-sync.ts::applyCanonicalGanttSync`는 새 Task가 기존 두 sibling 사이에 올 때 **previous-after**를 우선 사용해 SVAR가 서버의 목표 위치와 어긋날 여지가 있었다. 다음 survivor가 있으면 **next-before**를 우선하고, 마지막에서만 previous-after, 자식 첫 추가면 parent-child, root first-only면 기본 add를 유지한다. 불필요한 sibling `move-task`와 remount는 금지.
3. 별도 selection, expansion, scroll/scale, scope/readonly/mutation lock·revision, dependency, milestone/type, view projection/key, summary schedule 계산 변경 없음.

## AC_TEST_COVERAGE / TEST_LIFECYCLE_REVIEW
| AC | 증거 구현 | Lifecycle |
| --- | --- | --- |
| Root 첫/중간/끝에서 Above/Below가 즉시 sibling이고 server read-back 연속 | `tests/server/projects/task-hierarchy-command-service.test.ts` (root test), `tests/features/gantt/canonical-snapshot-sync.test.ts` (public-action tests) | EXTEND/ADD |
| Nested Summary 부모·서버 order 유지 | 동일 두 unit+SQLite 테스트; `tests/e2e/task-context-menu-hierarchy.spec.ts` scoped child A/B/C | EXTEND/ADD |
| 실제 Grid/Chart 즉시 표시, reload, API/Gantt instance 그대로 | Playwright `Issue #506 places root and nested…` 케이스의 DOM/Chart Y 위치 polling 및 동일 instance ID | EXTEND/ADD |
| Scope root 메뉴 disabled, readonly/edit/selection/collapsed/mutation lock/scroll/scale | 기존 #72/#373/#399/#407/#418, canonical/projection 및 viewport E2E 유지 | KEEP_UNIQUE |
| API Origin/If-Match/revision, 경합/DB rollback, Link/Move/delete 경로 | 기존 HTTP/Service 테스트 유지, 추가 server revision/read-back assertions | KEEP_UNIQUE |
- 선행 검색: `tests/features/gantt/canonical-sync-execution.test.ts`는 처음 sibling 앞 추가는 확인하나 양옆에 존재하는 sibling 중간 삽입은 미포함. #72 E2E는 새 작업이 존재하는지만 확인해 middle/tail 역전을 탐지하지 못함. #373/#407/#418은 scope/권한 계약과 중첩되는 부분만 공유함.
- PARTIAL_OVERLAP 기존 존재/순서 단언; 테스트 파일 분리 목적이 SQLite/HTTP vs SVAR action vs 실제 browser라 유지. `CONSOLIDATE_CANDIDATE=N/A`, `RETIRE_CANDIDATE=N/A`. 기존 파일 삭제/skip/retry/timeout/CI 샤드 변경 없음.

## DOCUMENTATION_SYNC
- UPDATED `CHANGELOG.md`, `docs/PROJECT_UX.md`, `docs/TEST_PLAN.md`, `docs/exec-plans/active/PLAN.md`, 새 `docs/exec-plans/active/ISSUE_506.md`, `package.json`, `package-lock.json`.
- N/A `AGENTS.md`, `DESIGN.md`(원칙·스타일 SoT 불변), `docs/REQUIREMENTS.md`, `docs/UI_UX_GUIDELINES.md`(기존 #72 명세), `docs/API.md`(새 payload 없음), `docs/DB_SCHEMA.md`·`docs/SCHEDULING_ENGINE.md`(DDL/scheduler 변경 없음), `docs/ARCHITECTURE.md`·`docs/ISSUE_LIFECYCLE.md`·`docs/CI_CD.md`(인프라·정책 변경 없음).

## 검증·Gate 인계
- `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=true`, `release_authorized=false`, `manager_decision=NOT TESTED`.
- 현재 GitHub 원격 코드 비교 및 정적 문자열 검증만 수행. 로컬 Node/npm/Vitest/Playwright/Docker runtime 검증은 실행 가능한 체크아웃 부재로 **NOT RUN / NOT TESTED**. 테스트 코드를 작성한 사실은 PASS 증거가 아니다.
- exact HEAD Full Quality/E2E 8 shards/Docker Required3, Trusted QA, 최신 base, 미해결 리뷰 thread0, Owner 수용 전 `MERGE_READY=BLOCKED`. 사용자가 요청한 이번 단계는 non-draft PR CI **시작**까지만이며 CI 모니터링·병합/Main/GHCR/Finalizer/Issue close는 수행하지 않는다.
