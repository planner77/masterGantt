# Issue #335 관계 연결 작업 sibling reorder 실행 계획

기준: 2026-10-03 KST, repository `planner77/masterGantt`, Issue #335, latest main `5101a4a701dd7dbbeb3091696c0c670c667cb840`, application `0.74.0`, SVAR React Gantt Core `2.7.3`.

## Work Packet

- 목표: Dependency가 연결된 Task/Milestone 또는 linked descendant를 가진 subtree도 **parent를 바꾸지 않는 sibling reorder**를 수행할 수 있게 한다.
- 허용: Context Menu Move Up/Down, Grid before/after 중 source와 target parent가 같은 경우.
- 계속 보호: Grid child/cross-parent before/after, Indent/Outdent, Cut/Paste 구조 이동, Delete, Convert, Dependency endpoint/type/lag 변경.
- latest-main integration: #399 Workspace WBS 범위 탭 및 #303 Task status/progress/canonical status를 보존한다.
- branch: `feat/issue-335-linked-task-reorder`.
- version: MINOR `0.75.0`. latest main이 `0.74.0`이므로 다음 하위 호환 기능 version을 사용한다.
- release_required: `true`; release_authorized: `false`. 이번 요청은 PR CI 시작까지다.
- 실행 방식: 단일 에이전트 순차 처리. 별도 Sub-Agent 실행 도구가 없어 독립 QA PASS를 주장하지 않는다.

## 설계

Frontend의 `canMoveUp/canMoveDown`은 Link 여부와 분리하고 sibling boundary/scope/editable/mutation lock으로 판단한다. Add/Indent/Outdent/Convert/Cut/Delete는 기존 Link guard를 유지한다.

상위 Move submenu trigger는 기존 #116 계약 때문에 unlinked Task에서는 하위 방향이 모두 비활성이어도 열 수 있어야 한다. 동시에 #335 linked Task에서는 실제 `canMoveUp || canMoveDown`이 하나라도 true면 열려야 한다. 따라서 root trigger는 `!canMutate && !canMoveUp && !canMoveDown`일 때만 disabled로 둔다.

Backend `move`는 같은 parent reorder이므로 Link guard를 적용하지 않는다. `reparent`는 target parent를 먼저 계산한 뒤 `placement !== "child" && source.parentId === target.parentId`인 경우만 Link guard를 건너뛴다. 그 외에는 source + descendants + anchor의 기존 `assertTasksNotLinked`를 유지한다.

## CI 실패 이력과 보완

### Run #1609.1
`verify-ci-run-trace.py`가 PR 본문의 canonical `Refs #335` 누락으로 fail-closed했다. PR 본문을 `Refs #335` 정확히 1개로 수정했다.

### Run #1613.1
신규 #335 E2E에서 linked Task의 상위 Move trigger가 기존 `canMutate`에 묶여 disabled였다. action-specific Move capability와 root trigger를 연결했다.

### Run #1614.1
metadata/typecheck/lint/unit/build/docker, Chromium shard 1/2/4는 PASS했고 shard 3에서 기존 E2E 두 건이 실패했다.
- #116: 외동 unlinked Task의 Move submenu가 더 이상 열리지 않아 keyboard/geometry 계약이 깨짐.
- #104/#378: linked Task의 Move가 새 #335 정책으로 enabled가 되었지만 과거 테스트가 disabled를 기대함.

보완은 root Move trigger를 `!canMutate && !canMoveUp && !canMoveDown` 조건으로 조정해 #116의 기존 빈 submenu UX를 복원하고, #104/#378 E2E에서 Move만 enabled로 기대하도록 정책 회귀를 갱신한다. 신규 #335 실제 Context Move/Grid DnD 테스트는 Run #1614.1 shard 2에서 PASS했다.

## 검증

- Frontend Unit: linked Move Up/Down 활성, readonly/pending/boundary, Add/Indent 보호.
- Service/SQLite: linked endpoint move와 same-parent before/after, Link/일정/status/progress 불변, revision +1.
- Service/SQLite: linked descendant subtree same-parent before/after 허용, cross-parent child 거부와 rollback.
- Chromium: 신규 #335 실제 Context Move + pointer DnD + relation line + reload persistence.
- Regression: #116 submenu keyboard/geometry, #104/#378 linked Copy/Paste와 새 Move 정책, #399 scope, #300 failure recovery/unlinked DnD.
- Local Fast Feedback은 현재 connector 환경에서 별도 runtime checkout을 확보하지 못해 NOT TESTED이며 동일 PR exact head GitHub Actions를 공식 판정으로 사용한다.

## 문서 영향

갱신: PROJECT_UX, TASK_EDITOR, TASK_RELATIONS, API, REQUIREMENTS, TEST_PLAN, PRO_FEATURE_MATRIX, CHANGELOG, active PLAN. DB_SCHEMA/DESIGN/UI_UX_GUIDELINES는 새 schema/layout pattern이 없어 N/A다.

## 공식 참고

- https://docs.svar.dev/react/gantt/api/actions/move-task/
- https://docs.svar.dev/react/gantt/guides/ui-layout/user-interface/
- https://docs.svar.dev/react/gantt/helpers/getmenuoptions/
- https://docs.svar.dev/react/gantt/samples/#/base/willow

PR CI 시작 이후 병합/main validation/GHCR/Issue 종료는 이번 요청 범위 밖이다.
