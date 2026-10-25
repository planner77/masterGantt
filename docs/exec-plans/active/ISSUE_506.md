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

## AC_TEST_COVERAGE

Issue [#506](https://github.com/planner77/masterGantt/issues/506)의 원문 수용 기준 13개에 보존형 AC ID를 부여하고 동일 test/lifecycle 표에 연결한다. 구조적 AC 매핑과 실제 테스트 통과 여부를 별도로 판단한다.

- AC1: 동일 parent의 root/nested 새 Task 생성 — tests/server/projects/task-hierarchy-command-service.test.ts 및 task-context-menu-hierarchy.spec.ts에서 검증한다.
- AC2: anchor 바로 위 삽입 — server create-before, canonical SVAR next-before 및 E2E 정확 행 순서를 검사한다.
- AC3: root와 nested 양쪽 의미 — server root/nested SQLite, E2E Summary scope 경계가 동일하다.
- AC4: 중간 sibling이 끝으로 append되지 않음 — canonical sync next-before 회귀 Unit, Grid/Chart E2E로 탐지한다.
- AC5: server DTO와 Grid/Chart 순서 일치 — E2E canonical order, Grid DOM row, 실제 Chart bar y 검사를 대응한다.
- AC6: siblingOrder가 연속 0..N-1 — server response와 재조회 및 E2E orderedFamily에서 체크한다.
- AC7: reload 없는 즉시 렌더 — Playwright E2E에서 명령 직후 DOM 폴링과 instance 불변성을 확인한다.
- AC8: reload 이후 위치 영속 — server readonly read-back과 E2E page.reload 후 canonical/DOM 검증이다.
- AC9: Task below 다음 sibling 생성 — root 및 nested create-after, SVAR 중간/끝 Unit, E2E negative를 검증한다.
- AC10: Workspace scope descendant 위치 — E2E Summary 범위의 Child B 앞뒤 command/DOM 확인이다.
- AC11: scope root Above/Below disabled — E2E scope Summary 메뉴 disabled와 기존 #373/#407 guard 유지이다.
- AC12: Gantt/API 리마운트 금지 — E2E mutation 전후 frame instance/api-instance 일치 검증이다.
- AC13: 선택·접힘·스크롤·스케일 보존 — 기존 #373/#407/#418 및 canonical-sync/viewport 특화 회귀 KEEP_UNIQUE, 전체 실행은 CI에서 검증한다.

## TEST_LIFECYCLE_REVIEW
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

변경 diff의 실행·테스트·제품 경로가 요구하는 문서 Source of Truth에 대해 원격 기본 브랜치 `docs_gate`의 항목별 형식과 실제 변경 여부를 일치시킨다.

- `AGENTS.md`: N/A(기존 테스트 생애주기와 기본 브랜치 신뢰정책을 적용하며 본문 수정 불필요)
- `DESIGN.md`: N/A(기존 SVAR-native와 scope-relative 디자인 원칙을 사용하며 신규 정책 없음)
- `docs/TEST_PLAN.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_506.md`: UPDATED
- `docs/ISSUE_506_FAILURE_ANALYSIS.md`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED
- `docs/REQUIREMENTS.md`: N/A(기존 Issue 72 우클릭 상대 위치 요구 및 작업 규칙 유지)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 SVAR context menu 계약과 장애 경계 유지)
- `docs/API.md`: N/A(동일 기존 create command 계약 및 권한과 If-Match 유지)
- `docs/DB_SCHEMA.md`: N/A(새 테이블 컬럼 인덱스 및 SQLite migration 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정 재계산 정책과 sibling hierarchy 서비스 변경 없음)
- `docs/CI_CD.md`: N/A(8-shard 품질 정책 및 Required 세 검사 우회나 조정 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 단계와 QA gating 정책을 변경하지 않고 준수)
- `docs/ARCHITECTURE.md`: N/A(제품 구조 및 구성요소 책임 경계에 변화 없음)


## 검증·Gate 인계
- `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=true`, `release_authorized=false`, `manager_decision=NOT TESTED`.
- 현재 GitHub 원격 코드 비교 및 정적 문자열 검증만 수행. 로컬 Node/npm/Vitest/Playwright/Docker runtime 검증은 실행 가능한 체크아웃 부재로 **NOT RUN / NOT TESTED**. 테스트 코드를 작성한 사실은 PASS 증거가 아니다.
- exact HEAD Full Quality/E2E 8 shards/Docker Required3, Trusted QA, 최신 base, 미해결 리뷰 thread0, Owner 수용 전 `MERGE_READY=BLOCKED`. 사용자가 요청한 이번 단계는 non-draft PR CI **시작**까지만이며 CI 모니터링·병합/Main/GHCR/Finalizer/Issue close는 수행하지 않는다.


## REWORK — PR #803 첫 Full CI #3264.1 / 리뷰 P1 (2026-10-25)

- [원본 Full Run #3264.1](https://github.com/planner77/masterGantt/actions/runs/40149276969): exact head `9ca412219c1d5efc26b691f3e553e51a2d395d9d` / base `fcd1ae59d268efa1913f4de625a9013cabd1de4a` / test merge `6cde0bbce85ea845868aca4827473dfafa95598b`. 직접 `QA Preflight`의 `ISSUE_AC` 구조 실패. 원본 Issue는 13개 체크박스만 있었고 `AC1..AC13` 토큰이 없었다. 이 원본 실패를 소급 PASS로 변경하지 않는다.
- Issue #506의 기존 13개 수용 항목에 동일 내용의 `AC1..AC13` 고유 ID를 부여했고 Work Packet `## AC_TEST_COVERAGE`에 개별 매핑을 작성했다. 이전 결합 제목과 비정형 `DOCUMENTATION_SYNC` 항목도 trusted 기본 브랜치 `docs_gate`가 인식하는 구조로 정리한다. 이는 검증기 완화가 아닌 메타데이터 보완이다.
- [P1 review](https://github.com/planner77/masterGantt/pull/803#discussion_r4369186957): `expectRenderedSiblingOrder`의 Chart `data-task-id`에 SVAR `:` 접두가 있지만 예상 `ProjectTaskDto.taskId`에는 없으므로 비교가 빈 배열이 되는 직접 E2E 테스트 결함. `projection-settled.ts`와 같은 `.replace(/^:/, "")`를 filter/결과 모두 적용. E2E는 원본 Run에서는 **실행되지 않아** 이 오류를 Run 직접 FAIL로 계산하지 않는다.
- 원인 세부 분류, 원본 23 Job·artifact 구분 및 Cross-run 매트릭스: [#506 누적 실패 원장](../../ISSUE_506_FAILURE_ANALYSIS.md). 사전 문서 구조 확인은 원격 PASS가 아니며 신규 exact HEAD Quality/E2E8/Docker/Trusted/Owner 검증 전 `MERGE_READY=BLOCKED`.
