# Issue #730 / PR #747 — 누적 PR CI 실패 분석

Primary Issue: [#730](https://github.com/planner77/masterGantt/issues/730) · PR [#747](https://github.com/planner77/masterGantt/pull/747) · 최초 분석 2026-10-19 (KST).
운영 기준: [공통 실패 원장](PR_CI_FAILURE_TRIAGE.md), [AGENTS.md](../AGENTS.md), [Lifecycle](ISSUE_LIFECYCLE.md), [QA 정책](QA_REVIEW_POLICY.md), [Work Packet](exec-plans/active/ISSUE_730.md). **같은 Issue의 다음 실패는 반드시 이 파일에 이어서 기록**한다. 원본 결과를 소급 PASS로 바꾸거나 다른 이슈 실패로 합산하지 않는다.

최신 재개 인덱스: **두 Full Run/Attempt의 누적 목록·Cross-run 매트릭스·보완/검증은 [§7](#7-f730-002--full-30031-통합-후-react-hook-의존성-오류-2026-10-19)**를 참조한다. 아래 §1–6은 최초 진단 당시 이력으로 보존한다.

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

## 7. F730-002 — Full #3003.1 통합 후 React Hook 의존성 오류 (2026-10-19)

### 7.1 두 원본 Run/Attempt 재수집

이 재개에서는 최초 원장 전체와 #730 Issue/PR 댓글·리뷰를 읽고, 접근 가능한 두 PR Head의 Full Run을 다시 조회했다. [정제된 원격 원장](evidence/issue-730/rework-20261019/remote-failures.json)에 전체 Job/Step 결론·원본 source artifact·최초 오류와 취소 Shard 관측을 보존한다. 각 commit 조회는 첫 페이지이고 각 Head별 Full 한 건/attempt1을 반환했으며 별도 metadata run은 발견하지 않았다. 접근하지 않은 숨은 이력을 추정하지 않는다.

| Run/Attempt | 불변 출처·Required와 최초 오류 | 취소/미실행 및 판정 |
| --- | --- | --- |
| [#3001.1 / 39215173057](https://github.com/planner77/masterGantt/actions/runs/39215173057) | Head `3962299f07e90108990f75b5dbdd811815057e02`, base `01fdc08bf4b2f69f9797a8bd411d6712e7478c09`, test merge `aed0793999f7642d5daf154d36ced58069a97fc4`. Quality/Docker SUCCESS, E2E FAILURE. F730-001 #463 writes expected0/received1, Shard1 7PASS/1FAIL/127NOT RUN. | 취소된 Shard2/3/4/5/6 로그에서 부분 PASS27/38/7/21/28개를 관측했고 추가 assertion/test FAIL은 관측하지 않았다. CANCELLED를 전체 PASS로 바꾸지 않는다. QA Final은 E2E 미성공 파생 실패. |
| [#3003.1 / 39221287023](https://github.com/planner77/masterGantt/actions/runs/39221287023), 시작2026-10-19T08:13:51Z | Head `b4ba9994ee77a8dbc4a3bb36c8ee6e00beab7a51`, base `fbe7db83a4baa2877a75db0769a59077bbe308c4`, test merge `91d7cd32c4a00339f4e401294cadc267ab7be35e`. [ESLint job117957148731](https://github.com/planner77/masterGantt/actions/runs/39221287023/job/117957148731) step6 `npm run lint`: `project-logistics-management.tsx:526:37`, `react-hooks/preserve-manual-memoization`, 3errors/13warnings. | Fast Gate117957800228 FAIL, 실제 PR production build/E2E6/Docker 구현 SKIPPED. Required quality117957870277/e2e117957869921/docker117957870200 모두 FAILURE. QA Final117957906105 `required quality 미성공`은 파생 실패이며 새 E2E 결함으로 합산하지 않는다. |

원본 #3001 API의 nested `run.pull_requests`는 현재 PR Head/base로 바뀐 것을 확인했다. 원본 checkout 이전 `ci-pr-source-<run>-1` artifact의 제한된 JSON을 읽기 전용으로 확인하고 GitHub artifact digest와 ZIP SHA256을 대조했으며, checkout 로그·test merge 두 부모와 교차 확인했다. artifact는 PR 측 자료이므로 이 수집을 독립 Trusted QA 승인으로 간주하지 않는다. ID12169166787/digest `sha256:10ea707d8c7169c8f21d6e7f1fc616a69b265eb4007fdcbbc283a9a1e2c2f5ef`는 최초 Run, ID12172285386/digest `sha256:6d4245feb0a28c4cd1f761a8172878c9c17c775d468d99ea111f0d2ed7fd3119`는 #3003에 귀속된다. 원시 ZIP/log/trace·인증값은 Git에 넣지 않는다.

### 7.2 전체 이력 Cross-run 원인 대조

| 누적 ID | 확정 관측·분류 | 현재 보완과 반례/경계 |
| --- | --- | --- |
| F730-001 | TEST_CONTRACT: 조회-only POST 도입 후 #463 쓰기 감지0 기대와1 관측. 개별 원본 요청 URL의 trace 독립 확인은 최초 원장처럼 UNKNOWN 유지. | b4의 exact POST+UUID `/resource-dashboard/views` helper를 보존하고 실제 이 조회를 소비하는 인접 관찰기를 조사한다. 업무 mutation0/원본 ID/Gantt 상태 단언을 그대로 유지한다. |
| F730-002 | PRODUCT/정적 통합 계약: #731 통합 상태의 `openWbsEntity` closure가 세 modal setter를 참조하지만 useCallback deps는 기존4개만 남았다. React Compiler가 inferred deps 불일치3개를 ESLint 오류로 검출. 초기 F730-001 재발이 아니다. | `setEquipmentModal`/`setSystemModal`/`setProcessModal`을 명시 의존성으로 추가. callback body·권한·원본 ID/모달 동작은 보존하고 인접 callback을 점검한다. lint disable이나 정책 우회는 하지 않는다. |
| R730-001 | PRODUCT/리뷰 P2: 늦은 기준정보 scope가 새 상세·검색을 덮는 경합. b4의 parent generation/abort 분리는 유지. | 사전 검토에서 Details 내부 원본/일정 명령과 부모 행 명령 사이의 양방향 최신 intent 경계를 추가 점검했다. 실제 목적지는 설비 수정 dialog이므로 Task dialog 부재만 검사하는 기존 음성 오라클도 교정한다. 실제 응답을 보류한 교차 순서와 통제 변형의 감도를 검증한다. |
| 파생 Gate | F730-001은 E2E 미성공, F730-002는 Fast Gate/Quality 미성공으로 최종 QA 차단. | 원격 Required3·6shard·fail-fast·Trusted/Owner·권한/Release 규정은 변경하지 않는다. |

현재 누적 실제 실패 테스트 파일 합집합은 `tests/e2e/milestone-dashboard-state.spec.ts` 한 파일이다. F730-002는 테스트 파일 FAIL이 아니라 제품 파일 ESLint이며 그 파일을 전체 lint의 직접 대상으로 포함한다. 취소 로그에서 추가 실제 테스트 FAIL은 발견되지 않았다. 기존 원장의 가설·최초 실패·당시 NOT TESTED와 최초 구현 source22/155unit/11browser 기록은 과거 Head에 그대로 귀속한다.

### 7.3 영향 선정·검증 계획과 승인 경계

- 최신 main `fbe7db83a4baa2877a75db0769a59077bbe308c4`는 baseline b4의 조상이다. main의 #731 KPI source/구성 관계·null processLinks 및 transport 교정, #730 WBS 조회/receipt/원본 복귀, version0.124.0/lock·0.123.0 CHANGELOG를 모두 보존한다. 기존 checkout 대신 `fix/issue-730-ci-cumulative` 별도 worktree에서 작업한다.
- 이전 실제 실패 파일 전체, R730-001 지연 원본·최신 의도, 정확 query helper의 업무 변경 음성, 직접 WBS/Resource/Milestone 및 #731 통합 소비자를 같은 최종 동결 소스로 검증한다. source/test 변경 중의 통제 실패와 수정 후 동결 PASS를 구분하고 고유 케이스를 중복 합산하지 않는다. 자동 Pre-PR UNKNOWN은 실제 수동 매핑·실행과 별개로 BLOCKED를 유지한다.
- 시작 조회에서 리뷰 스레드1개는 이미 b4의 근거 답글로 resolved이며 unresolved0, mergeable=true였다. 게시 직전 Head/main/리뷰·충돌을 다시 조회해 추가 변경을 보존한다. 새 Head의 quality/e2e/docker·Trusted/Owner 최종 결과는 NOT TESTED다. 이번 요청 범위는 단일 보완 게시와 PR Full CI 시작이며 완료 모니터링·병합·Main/GHCR·정식 Release·Issue 종료는 수행하지 않는다.

### 7.4 동결 후보의 직접 재현·대조 및 제한적 회귀

- 원본 b4 제품 파일을 `git show HEAD:src/features/logistics/project-logistics-management.tsx | ./node_modules/.bin/eslint --stdin --stdin-filename src/features/logistics/project-logistics-management.tsx`로 실제 lint했다. exit1/3errors/0warnings로 F730-002의 세 inferred dependency 오류를 재현했다. 파일 내용을 바꾸지 않은 stdin 진단이며 후보 file의 scoped lint exit0와 구분한다. 컴파일러가 과거 Head에서는 같은 setter를 어떻게 분석했는지 내부 기전을 추정하지 않는다.
- R730-001은 parent/Details가 공유하는 AbortSignal lease를 사용한다. 새 parent intent는 child pending scope까지 동기 취소하고, 새 child 원본/일정·보기/page intent는 parent scope를 취소한다. child는 공유 신호와 자체 controller/generation을 함께 확인하고 listener를 finally 해제한다. reportGeneration은 원본 명령 세대와 분리해 정상 report 조회를 잃지 않는다. 정확 source/권한 재검증·snapshot owner/receipt는 그대로 유지한다.
- 음성 오라클의 감도: 제품 `cancelOriginal`만 의도적으로 무효화한 통제 변형1회는 실제 설비 수정 dialog count0 기대/1관측으로 FAIL/exit1이었다. 이는 실제 옛 Head 전체 재현이나 새 제품 실패가 아니라 **검사 감도 확인**이며 정상 source PASS와 섞지 않는다. try/finally로 제품 bytes를 정확히 복원했고 전후 SHA256 `bf7ccfc2da3629970a153d684429aab9bfc75b28f414eb9eb812656f2e7036ce`가 동일하다. 원시 trace/log는 ignored 경로, [정제 영수증](../output/playwright/issue-730-rework/controlled-negative-receipt.json)은 별도로 보존한다.
- 정상 동결의 R730 직접1개는 parent 원본→새 상세/검색, parent 원본→상세 Task 명령, 상세 Task→새 parent 설비 원본의 늦은 응답 차단과 실제 정확한 목적지/취소를 검증해 PASS/exit0를 관측했다. 뒤의 동일 source 전체 선정 결과에 포함되므로 별도 성공 수를 더하지 않는다.
- 직접/인접 Unit·실제 SQLite/HTTP13files/195tests PASS, exit0. 기존 WBS/model/transport/navigation·domain/server와 통합 #731 KPI17개, exact query helper 음성23개를 포함한다. 별도 qa_docs가 실행한 helper23개는 같은 집합의 부분집합이며 합산하지 않는다. [handoff 전 Unit 결과](evidence/issue-730/rework-20261019/unit-before-handoff-results.json)는 최초 구현 결과를 덮어쓰지 않는다.
- 최종 Chromium 선정은 고유27개다: 누적 실제 실패 파일 `milestone-dashboard-state.spec.ts`7개 전체, 직접 #7306개, 변경 관찰기 직접 소비자13개, 인접 #5181개. `workers=1/retries=0/max-failures=0`으로 분할 실행하며 실행 중 source 변경은 stale로 분리한다. [선정·제외](../output/playwright/issue-730-rework/selection.json)의 KPI-only·master-only·일정-only/정확 mutation endpoint 관찰기는 이 조회에 진입하지 않아 변경하지 않는다. 전체 remote6shard와 동등하다고 주장하지 않는다.

- 중간 관측: 직접 #730 실제 HTTP6개와 누적 실패 #4637개 전체는 각각 정상 종료/전후 source 지문 일치로 PASS를 확인했다. 기존 #463은 mock-backed legacy Milestone UI이며 mock Project가 없는 신규 WBS POST404를 신규 WBS 기능 PASS로 전용하지 않는다. 새 WBS 성공·편집·경합 증거는 실제 HTTP/SQLite #730에 귀속한다. 나머지 수정 관찰기·인접 소비자 결과는 전체 동결 실행 종료 뒤 확정한다.

### 7.5 F730-001 원본 요청 URL의 후속 확인 — 기존 UNKNOWN 보존

2026-10-19T08:37:04.508458Z 추가 조사에서 최초 shard1 `playwright-report-shard-1` artifact12169197471(5,766,811bytes)와 GitHub digest/SHA256 `428cdaba126af35a7fd368652890806e428255cde1d4d07bb37eda45a73b68f4`를 검증했다. 제한된 ZIP과 유일한 중첩 trace ZIP(5,402,194bytes)을 메모리에서 읽었고 stacks는 `milestone-dashboard-state.spec.ts`에 귀속됐다. 경로 실행·일괄 추출을 하지 않았다.

네트워크의 **유일한 non-GET API 요청은 `POST /api/projects/[publicId]/resource-dashboard/views`, HTTP404**였다. 기존 mock Project가 신규 WBS 실제 조회에 준비되지 않은 것과 일치하며 HTTP200 성공으로 오인하지 않는다. 업무 mutation이 아닌 조회 POST가 기존 쓰기 관찰기에 잡힌 사실을 원본 네트워크에서도 확인했다. 최초 §3의 당시 UNKNOWN 판단은 삭제/소급 변경하지 않고 이 날짜의 추가 근거로 해소한다. [정제된 관측](evidence/issue-730/rework-20261019/trace-readonly-observation.json)에는 method·route template·상태·artifact provenance만 보존하며 body/header/cookie/query·다운로드 URL·원시 ZIP/trace는 Git에 포함하지 않는다.

### 7.6 후속 사전 검토 — 일정 handoff의 두 번째 scope 취소

첫 동결 후보는 위 계획27개 모두 PASS/각 subprocess exit0/전후 source 지문 일치를 기록했다. 그러나 별도 source 검토에서 Details의 첫 scope200 뒤 `scheduleWbsRequest` → `performResourceNavigation`이 두 번째 scope를 검증하는 동안 공유 최신-intent 신호가 전달되지 않는 P2를 추가 발견했다. 표 이름 검색/정렬이 새 의도가 되어도 이 두 번째 요청의 옛 일정 이동이 commit될 수 있다. 이는 새 원격 CI 실패나 F730-002의 Hook 의존성 교정에 따른 회귀가 아니라 R730-001의 같은 취소 계약에서 누락된 후속 비동기 경계다.

이 경계를 이번 범위에 포함해 app-owned optional intent signal을 host까지 전달하고, resolve/commit·충돌 확인 대기까지 같은 lease를 확인한다. transient signal은 저장된 탐색 frame에서 제거해 복귀 시 과거 취소 신호를 재사용하지 않는다. Milestone/Resource가 자체 navigationLoading을 busy로 전달할 때 정상 일정 이동을 자기 취소하지 않도록 user/context intent와 단순 busy 전환을 분리한다. 기존 original/Details 자체 scope는 busy/locked에서 여전히 차단하며 legacy/KPI 호출에 signal이 없으면 기존 동작을 유지한다.

앞선27PASS 및195Unit는 **handoff 보완 전 후보**에만 귀속한다. 최종 동일 source가 아니므로 새 보완의 전체 PASS로 이월하지 않는다. 구현과 고위험 second-scope 지연 음성·Milestone/Resource 정상 일정 복귀 양성을 기존 선택 범위 안에서 완성한 뒤, 새 source/test 지문을 동결하여27개 전체와195Unit를 다시 검증한다. timeout/retry/skip·원격 gate 변경 없이 같은 이슈 원장에 앞선 결과와 후속 결과를 분리한다.

- handoff 구현 중의 로컬 첫 scoped lint는 `react-hooks/immutability`3errors/0warnings, exit1(9.529s)이었다. 작성 중 cleanup에서 `navigationConfirmation.current?.releaseIntent?.()`를 effect에 직접 노출한 형태를 controller.signal abort listener의 정리로 바꾼 뒤 같은4file scoped ESLint exit0(7.833s), 마지막 수정 후 `npm run typecheck` exit0(6.048s)를 확인했다. 오류 위치는 당시 `project-readonly-view.tsx:2121:9/2538:5/2576:7`이며 원시 로그 파일은 따로 보존하지 않았다(도구 실행 출력). 이 보완 중 피드백은 원격 F730-002나 새 CI 실패로 집계하지 않는다. 최신4file read-only QA 코드 검토의 미해결 P1/P2는0건이며 이제 같은 최종 source의27개를 검증한다.

- `verify:prepr --mode=diagnose`는 서로 다른 실제 E2E 실패2회와 실존 browser 파일 입력을 요구하지만 이 원장의 두 번째 원격 실패는 ESLint 제품 파일이다. 실제 browser 실패 Run은1회이므로 가짜 두 번째 E2E 항목을 만들지 않고 동일 실패 파일 전체·인접 소비자의 수동 bounded27개로 검증한다. 별도의 실제 fast/targeted 실행과 자동 매핑 판정은 최종 로컬 원장에 기록한다.

### 7.7 최종 동결 선정의 추가 로컬 실패 — L730-001 (#623, 원격 실패와 분리)

최종 source의 선정27개를 fail-fast 없이 끝까지 실행한 첫 결과는 **26PASS/1FAIL**이다. 고유 실제 원격 실패 파일 #4637개 전체·#7306개·다른 인접13개는 PASS이며 `issue-623-resource-mvp.spec.ts`의 다섯 폭 tree/matrix geometry·keyboard case1개가 전체30,000ms 제한에 도달했다. Resource 마지막 배치 subprocess는 exit1(드라이버 자체 정상 종료와 다름), 나머지5배치는 exit0, 모든 배치 sourceStable=true다. 이 로컬 실패를 원격 F730-003이나 제품 결함 확정으로 분류하지 않는다.

- 최초 원시 trace/error-context는 ignored `.prepr-reports/issue-730-rework/final-watcher-http-resource/`에 보존한다. trace상10조합 중9개 screenshot을 마쳤고 마지막1920px matrix의 line223 scrollLeft0 poll 진입 약0.4ms만에 전체 deadline 오류가 났다. 이 poll의 값이 반복 불일치했다는 증거는 없다. 중간 handoff 전 같은 case는29.2초 PASS였으나 이전 source PASS로 대체하지 않는다.
- 별도 read-only qa_docs도 before-hook 약14.695초/fixture boot 약14.645초와 개별 API fetch 약972–1338ms를 확인했다. 이 시간을 test-body 관측과 단순 합산하거나 근거 없이 host 일정 handoff 제품 회귀로 단정하지 않는다. 정확 원인은 UNKNOWN이며 로컬 시간 여유/환경 지연이 후보이다.
- 제품·테스트 source, timeout/retry/skip/단언과 CI 설정을 바꾸지 않고 같은 source의 **#623 전체2case를 단 한 번** 독립 프로세스로 추가 진단한다. 반복 PASS 재시도를 하지 않으며 진단 성공도 최초26/1FAIL을 소급27/27PASS로 바꾸지 않는다. 최종 로컬/원격 판정·원인 미확정 위험과 추가 결과는 아래 이어서 기록한다.

추가 진단 확정: 같은 source의 #623 전체2개는 **1PASS/1FAIL, subprocess exit1/sourceStable=true**였다. 원본과 같은9/10 screenshot 완료 후 마지막1920px matrix의 전역30초 제한이며 poll 실행은 각각0.403/0.569ms였다. HTTP104건은 모두 오류 없이 완료했고 요청 시간 합22,951.784/24,017.740ms는 동시 요청을 포함하므로 벽시계 시간과 합산하지 않는다. hook 종료부터 첫 viewport까지21,815.182/22,474.550ms였다. fixture/before-hook 중첩 기간과 test-body 시간을 구분한 [시간 비교](../output/playwright/issue-730-rework/failure-timing-comparison.json), [단발 진단](../output/playwright/issue-730-rework/diagnostic-resource623-receipt.json), [최종27개 원장](../output/playwright/issue-730-rework/local-ui-receipt.json)을 보존한다. 추가 실행·timeout/단언/fixture 변경은 하지 않았다. **LOCAL_VALIDATED=FAIL, 원인 UNKNOWN/ENV_CANDIDATE는 가설**, 미해결 로컬 시간 위험을 게시문에 명시하고 원격 Required3/Trusted/Owner·Manager 최종 판정은 별도로 남긴다.

### 7.8 최종 소스·검증 증거와 게시 전 경계

- 최종 제품/테스트 변경35개 지문 [source-freeze.json](evidence/issue-730/rework-20261019/source-freeze.json)의 aggregate는 `23bdf4d64b17273755fd17fb3d1b97d12e823c60e824f1c43193ebd20f01a133`이다. 전체 product/E2E656개 [최종 manifest](../output/playwright/issue-730-rework/final-source-freeze.json)는 `c743f9103205eab7cae3f5550f0097bcf0c3621a0d64054ea13379bc7f09cbda`이며 양쪽 bytes 대조 mismatch0이다. docs/정제 evidence 추가 뒤 dirty working-tree 전체 지문과 혼동하지 않는다.
- handoff 보완 후13files/195Unit·SQLite HTTP를 같은 소스로 새로 실행해 PASS/exit0, [최종 Unit JSON](evidence/issue-730/rework-20261019/unit-results.json)에 보존했다. 기존155개와 #731 KPI17개·helper 음성23개를 포함하며 중간195 결과를 합산하지 않는다.
- Chromium 선정 원본26PASS/1FAIL·추가 #6232개 진단 및 미확정 시간 위험은 §7.7을 따른다. 전체 Playwright747개·Vitest248files는 discovery 수이고 실행PASS 수가 아니다. 로컬 전체회귀·production build/audit/Docker·main/GHCR·실기기/환경별 UX 검증은 NOT TESTED/별도 gate다.
- REVIEW/문서: 별도 qa_docs가 최신 intent/host 확인·busy 정상 이동·frame 신호 제거·legacy/KPI 경계와5폭 geometry/PNG를 읽기전용으로 검토했다. source P1/P2 미해결0이며 제품 계약의 로컬 검토이지 독립 인간 QA·Trusted PASS·Owner 위험 수용/병합 승인 또는 Manager ACCEPT가 아니다. HIGH/qa_required=true/OWNER_MANAGED와 manager_decision=NOT TESTED를 유지한다.

- 최종 전체 `npm run typecheck` exit0, `npm run lint` exit0/0errors/13warnings, version0.124.0 검증 exit0. test discovery는 root/외부 cwd248unit files/747browser cases 발견/exit0이며 전체 실행PASS가 아니다. 테스트가 덮어쓴 Next 설정과 이전 이슈 tracked67개 및 후속 진단12개는 HEAD bytes로 복원했다. untracked 과거 진단7개는 ignored 진단 경로로 이동했다. 새 #730 rework 정제 증거만 게시하며 owned browser/server 프로세스0이다.
- 실제 `verify:prepr` fast/targeted 둘 다 **BLOCKED/exit1/sourceStable=true**, 동일 working fingerprint `a8a5c562d1b68b7f1b1620af7bff020e4bce912d08b433fb329920795b53509e`, UNKNOWN5/missing0/실행단계0. 선정36/38files를 실행 결과로 세지 않는다. UNKNOWN은 logistics producer3개·WBS fixture·readonly helper이며 Work Packet의 실제 수동 매핑으로 설명하되 CLI selector/정책이나 BLOCKED를 바꾸지 않는다. diagnose는 §7.6의 자격 부족 때문에 실행하지 않았다. [통합 로컬 원장](evidence/issue-730/rework-20261019/local-validation.json), [fast JSON](evidence/issue-730/rework-20261019/prepr-fast.json)/[요약](evidence/issue-730/rework-20261019/prepr-fast-summary.md), [targeted JSON](evidence/issue-730/rework-20261019/prepr-targeted.json)/[요약](evidence/issue-730/rework-20261019/prepr-targeted-summary.md)을 따른다. 이 working 지문은 후속 문서·증거 추가 뒤 전체 tree가 같은 값이라는 뜻이 아니다.
- 게시 결정 범위는 로컬 위험을 공개한 기존 PR747의 **단일 source 갱신 및 새 Full CI 시작**이다. source P1/P2 미해결0을 로컬 전체PASS나 Owner/Manager ACCEPT로 과장하지 않는다. 게시 직전/직후 expected remote Head b4와 최신 main fbe7·리뷰 unresolved0·conflict0·전체 tree 일치 및 새 Run/Attempt/Head/base/test merge를 Issue STATUS/PR 댓글로 기록한다. 사용자 요청에 따라 CI 완료 모니터링·병합·Main/GHCR·정식 Release·Issue 종료는 제외한다.

- PrePR `SUMMARY.md`/JSON은 기존 자동 도구의 영문 원문 영수증을 무변조 보존했다. 판정·원인·조치는 본 한글 원장에서 설명하며 workflow/job 표시 이름·검증기 출력 정책은 변경하지 않았다.

- 최종 별도 qa_docs 사전 코드·문서·증거 검토 PASS, source P1/P2 미해결0;35/656개 bytes mismatch0,195Unit·26/1·단발1/1·PrePR BLOCKED와 영어 원문 예외를 직접 대조했다. Markdown275files/exit0·diff check exit0. #623 반복 deadline 원인UNKNOWN과 WBS 상세50행 초과 실제 페이지 클릭 NOT TESTED는 남은 위험으로 유지한다. 이 검토는 로컬 전체PASS나 최종 QA/Manager ACCEPT가 아니며 명시된 위험을 공개한 단일 게시·PR Full CI 시작만 인계한다.
