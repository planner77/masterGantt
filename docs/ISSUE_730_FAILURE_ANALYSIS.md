# Issue #730 / PR #747 — 누적 PR CI 실패 분석

Primary Issue: [#730](https://github.com/planner77/masterGantt/issues/730) · PR [#747](https://github.com/planner77/masterGantt/pull/747) · 최초 분석 2026-10-19 (KST).
운영 기준: [공통 실패 원장](PR_CI_FAILURE_TRIAGE.md), [AGENTS.md](../AGENTS.md), [Lifecycle](ISSUE_LIFECYCLE.md), [QA 정책](QA_REVIEW_POLICY.md), [Work Packet](exec-plans/active/ISSUE_730.md). **같은 Issue의 다음 실패는 반드시 이 파일에 이어서 기록**한다. 원본 결과를 소급 PASS로 바꾸거나 다른 이슈 실패로 합산하지 않는다.

## 1. 전체 원격 Run/Attempt 목록

| 원본 PR·Workflow/Run | 정확한 Head/Base/Test Merge | 실제 Job/Required 집계 | 결과 |
| --- | --- | --- | --- |
| #747 / `pull_request` Full / [CI #3001.1](https://github.com/planner77/masterGantt/actions/runs/39215173057), Run ID `39215173057`, attempt 1, 2026-10-19 UTC | branch `feat/issue-730-view-composer`; head `3962299f07e90108990f75b5dbdd811815057e02`; base `01fdc08bf4b2f69f9797a8bd411d6712e7478c09`; test merge `aed0793999f7642d5daf154d36ced58069a97fc4` | Quality aggregate `117938574494` SUCCESS (TypeScript/ESLint/Unit/Policy/Next build SUCCESS), Docker aggregate `117938744232` SUCCESS, Chromium aggregate `117939346560` FAILURE, QA Final `117939373635` FAILURE | Shard1 `117937947454` FAIL; other 5 Shards CANCELLED (matrix fail-fast); QA Final `required e2e 미성공` |

당시 조회한 #730 PR은 #747 한 건이고 이슈별 원격 Full 실행은 #3001.1 한 건이다. 접근 불가한 추가 이전 시도를 임의로 추정하지 않는다. 이후 `synchronize`/rerun은 정확 Run ID·Attempt·HEAD를 이곳에 추가한다.

## 2. 누적 실제 실패 파일 합집합 / Cross-run 매트릭스

| ID/성격 | 최초 실제 오류 / 독립성 | 원인/보완, 향후 재발 검사 |
| --- | --- | --- |
| **F730-001 / TEST_CONTRACT** / [milestone-dashboard-state.spec.ts:85 #463](https://github.com/planner77/masterGantt/actions/runs/39215173057/job/117937947454) | `[chromium] #463 readonly full-state/F separation, keyboard and five-width geometry`: `expect(writes).toBe(0)`, expected `0` received `1`. 원본 shard1 7 PASS, 1 FAIL, 127 DID NOT RUN. | 기존 Playwright request listener는 GET/HEAD 이외 모든 HTTP를 mutation으로 계수. #730 새 조회가 read-only POST로 호출되므로 오분류. `method=POST`+`/api/projects/{UUID}/resource-dashboard/views` 정확 경로만 제외하고 실제 비조회 업무 변경 감지는 유지. #463/#552/#518/#730 교차 보완. 새 source 결과 NOT TESTED. |
| **R730-001 / PRODUCT (PR 리뷰 P2)** / [review thread](https://github.com/planner77/masterGantt/pull/747#discussion_r4311267545) | 원본 scope 이동이 지연된 동안 `상세` 또는 행 이름 검색으로 사용자의 의도가 바뀌어도 기존 `onOpenEntity`가 실행될 수 있음. 직접 CI #3001 실패와 별도 제품 결함. | `originalGeneration`과 `reportGeneration` 분리; 새 row-level action/검색/필터/구성/정렬/refresh에서 `AbortController`+generation 동기 취소. scope 응답 보류 후 두 새 의도를 순서대로 검증하는 E2E 추가. 로컬·신규 원격 NOT TESTED. |
| **F730-001 파생 / POLICY_CI QA Final** / [Job](https://github.com/planner77/masterGantt/actions/runs/39215173057/job/117939373635) | `NEED_QUALITY=success`, `NEED_DOCKER=success`, `NEED_E2E=failure` → `required e2e 미성공` 정상 차단. 독립 제품 실패 아님. | 자동 QA·Required E2E6 gate 우회/완화 금지. 새 Full PR CI 후 출처 검증은 별도 판정. |

**원격 실제 실패 테스트 파일 합집합:** `tests/e2e/milestone-dashboard-state.spec.ts` (#463 한 건). 다른 5개 Shard의 CANCELLED를 PASS로 계산하지 않는다. 추가 실행해야 할 소비자는 `tests/e2e/milestone-visibility.spec.ts` (#552), `tests/e2e/project-workspace-tabs-518.spec.ts` (#518), `tests/e2e/issue-730-view-composer.spec.ts` (R730-001 비동기 역전), 그리고 기존 #624/Gantt 원본 이동 계약이다.

## 3. F730-001 원본 증거 / 확인과 추정 구분

- [Shard1 로그](https://github.com/planner77/masterGantt/actions/runs/39215173057/job/117937947454): 2026-10-19 07:24:26~27 UTC에 파일 `tests/e2e/milestone-dashboard-state.spec.ts` line85:423 FAIL. 원본 [Playwright shard1 report/trace artifact](https://github.com/planner77/masterGantt/actions/runs/39215173057/artifacts/12169197471)로 증거 유지. 다음 5개 shard job IDs: `117937947644`, `117937947299`, `117937947430`, `117937947331`, `117937947414` 모두 CANCELLED. 완료된 다른 오류는 로그에서 확인되지 않았으며 취소로 미실행된 항목은 UNKNOWN/NOT RUN.
- #502 의도적인 ErrorBoundaryProbe 예외 로그는 원본 직접 실패와 무관하며 별개 실패로 중복 계수하지 않는다. 실제 write count `1`의 개별 요청 URL을 trace 네트워크로 독립 확인한 것은 **UNKNOWN**: 직접 확인한 근거는 read-only POST 코드, 기존 request watcher와 #730 Work Packet에서 같은 유형을 수정한 로컬 #518/#724 이력이다. 이를 확정된 프로덕션 mutation으로 단정하지 않는다.
- 기존 PR head와 main 비교는 `ahead_by=1`/`behind_by=0`, `mergeable=true`, source/parent 정확. 원본 Test Merge의 SHA는 above, 이후 main 이동 여부는 push 직전에 재검증한다.

## 4. 과거 이력 참조와 원인별 일괄 보완

- [#730 Work Packet](exec-plans/active/ISSUE_730.md)에 기록된 로컬 alias/fixture/selector/readonly POST 분류/지연 복귀·focus 실패는 해당 동결 로컬 source의 최초 실패·보완·재검증이다. 이를 다른 원격 CI 실패로 셈하지 않고 원래 기록을 보존한다.
- [#728 원장](ISSUE_728_FAILURE_ANALYSIS.md)의 unresolved review thread → QA Final BLOCKED, [#717 원장](ISSUE_717_FAILURE_ANALYSIS.md)의 stale base/test merge, [#724 원장](ISSUE_724_FAILURE_ANALYSIS.md)의 고정 제품 assertion을 유지한 fixture/contract 교정은 교차 검토 지침으로 확인했다. 다른 이슈의 실제 FAIL을 #730 원격 Run에 합산하지 않는다.
- TEST_CONTRACT는 관찰기에서 **정확히** 조회 POST만 제외하고 mutation0 판정 그대로 보존. PRODUCT P2는 request 취소 외에도 report refresh generation을 독립시켜 응답 역전의 부작용을 제거한다. Gate/timeout/retries/skip/기존 비음성 assertions를 바꾸지 않는다.

## 5. 수정 소스·검증·다음 CI 인계

- 변경 파일: `src/features/resources/wbs-view-dashboard.tsx`, `tests/e2e/helpers/read-only-requests.ts`, `tests/e2e/milestone-dashboard-state.spec.ts`, `tests/e2e/milestone-visibility.spec.ts`, `tests/e2e/project-workspace-tabs-518.spec.ts`, `tests/e2e/issue-730-view-composer.spec.ts`, `docs/exec-plans/active/ISSUE_730.md`, `docs/TEST_PLAN.md`, 본 단일 이슈 원장.
- GitHub 연결의 원격 파일/API 검증으로 정적 diff/일치 여부를 확인했으나, 실제 checkout/npm/Playwright/Docker 실행은 이 도구 경로에서 수행하지 않았다. 신규 source의 동일 HEAD unit/browser/full PR 검증 **NOT TESTED**, 기존 Quality/Docker PASS는 **원본 Head 한정**이다.
- 원본 code-review thread R730-001는 코드 게시 뒤 근거 답글·resolve, unresolved0·conflict0·strict main 확인한다. 이후 해당 PR Head를 non-force fast-forward 갱신하면 GitHub `pull_request.synchronize`로 Full CI를 시작할 수 있다. 사용자 지침에 따라 **CI 완료 모니터링 없음**. 원본 실패/새 실패는 모두 동일 이슈 원장에 누적한다.
- Full Required Quality/E2E6/Docker, 기본 브랜치 Trusted QA, Owner의 HIGH 위험 수용 및 명시적 병합 승인과 정식 GHCR·Release·Issue 종료는 이번 PR CI 시작만으로 완료되지 않으며 별도 게이트로 남는다.

## 6. latest main 이동·충돌 대응 (같은 F730-001 보완의 일부)

- 진단 도중 다른 Issue [#731 PR #746](https://github.com/planner77/masterGantt/pull/746)이 main을 `01fdc08bf4b2f69f9797a8bd411d6712e7478c09` → `fbe7db83a4baa2877a75db0769a59077bbe308c4` (5 commits)로 이동시켜 #747의 `mergeable=false`, `behind_by=5`가 관측됐다. 이것은 **#730의 추가 CI 실패가 아닌 병합 베이스 변경**이다.
- baseline별 파일 변경을 대조한 공통 경로 15개: 사용자 안내/설계/API/지표·테스트·PLAN, CHANGELOG, package/lock, `project-logistics-management.tsx`, `project-readonly-view.tsx`. #731의 KPI read source·drill·진단·test와 #730의 app-owned WBS tree·원본 scope가 모두 유지되도록 구성하고, 0.123.0 기존 버전 기록과 0.124.0 후보/lock root를 병행한다. 원본 #731 구현·GHCR·CI 이력을 건드리거나 승인을 위조하지 않는다.
- 중복 원인별 파일 집합 및 기존 실패는 위 표를 계속 사용한다. 이번 main 통합 후보의 로컬/원격 정확 Head 검증 결과는 새 CI 전 **NOT TESTED**. 단일 Head의 Full CI를 `pull_request.synchronize`로 시작한 뒤 사용자 요청대로 모니터링하지 않는다. 추가 실패 시 다른 문서를 만들지 말고 본 문서 F730-002 이후 누적한다.
