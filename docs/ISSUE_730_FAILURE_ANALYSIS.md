# Issue #730 / PR #747 — 누적 PR CI 실패 분석

Primary Issue: [#730](https://github.com/planner77/masterGantt/issues/730) · PR [#747](https://github.com/planner77/masterGantt/pull/747) · 최초 분석 2026-10-19 (KST).
운영 기준: [공통 실패 원장](PR_CI_FAILURE_TRIAGE.md), [AGENTS.md](../AGENTS.md), [Lifecycle](ISSUE_LIFECYCLE.md), [QA 정책](QA_REVIEW_POLICY.md), [Work Packet](exec-plans/active/ISSUE_730.md). **같은 Issue의 다음 실패는 반드시 이 파일에 이어서 기록**한다. 원본 결과를 소급 PASS로 바꾸거나 다른 이슈 실패로 합산하지 않는다.

최신 재개 인덱스: #3012/#3022 과거 이력 §14–16, 최종 PR 실패 §20, GHCR Release #182 attempts1/2 및 patch 복구 계획 §21–22. 원본 §1–20 실패·미검증 판정은 불변.

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

## 8. F730-003 — Full PR CI #3005.1 설치·네트워크 실패 (2026-10-19)

- 원본: [PR #747 CI #3005.1](https://github.com/planner77/masterGantt/actions/runs/39228148584), Run ID `39228148584`, attempt1, event=`pull_request`, Head `c8f0c283ceb87ff9afc205cd51080c5baed42fea`, event base `fbe7db83a4baa2877a75db0769a59077bbe308c4`. 이는 기존 F730-001(#3001.1)·F730-002(#3003.1)와 **다른 실패**다. 이전 섹션의 사실을 고치거나 PASS로 소급하지 않는다.
- 독립 실제 실패: 정책·저장소 계약 Job [117979619654](https://github.com/planner77/masterGantt/actions/runs/39228148584/job/117979619654)의 `npm ci --prefer-offline --no-audit` 중 `better-sqlite3`의 `node-gyp rebuild`이 Node `v22.23.3` 헤더 검증 자료 `https://nodejs.org/download/release/v22.23.3/SHASUMS256.txt`를 가져올 때 `ECONNRESET`(`socket hang up`) 발생. 그 직전 headers tar.gz GET 200이지만 후속 checksum GET 실패로 `npm ci` exit1. 최초 실제 오류 유형은 `ENVIRONMENT/NETWORK`; 애플리케이션 코드·DB 로직 결함이나 E2E assertion FAIL로 단정하지 않는다. 설치가 네트워크 재시도 없이 재현된다는 주장 역시 불가하다.
- 완료 Job: 변경 경로 판정/QA Preflight/TypeScript/ESLint/Vitest는 SUCCESS. PR Fast Gate [117980299218](https://github.com/planner77/masterGantt/actions/runs/39228148584/job/117980299218)는 정책 Job 실패로 FAILURE; PR build/E2E6/Docker **구현 Job은 SKIPPED**. Required Quality [117980368158](https://github.com/planner77/masterGantt/actions/runs/39228148584/job/117980368158), Chromium E2E [117980368004](https://github.com/planner77/masterGantt/actions/runs/39228148584/job/117980368004), Docker [117980368191](https://github.com/planner77/masterGantt/actions/runs/39228148584/job/117980368191)는 집계 FAILURE이며 실제 Browser/Docker 테스트 FAIL로 계수하지 않는다. QA Final [117980405072](https://github.com/planner77/masterGantt/actions/runs/39228148584/job/117980405072)의 실패도 필수 검증 미성공에 따른 파생 Gate다.
- 대응: 사용자 요청은 **새 main과 정렬·미해결 리뷰/충돌 해결·새 Full PR CI 시작**. CI workflow/setup/npm 정책/timeout/skip/assertion을 재작업 범위 밖에서 변경하거나 네트워크 원인을 제품 patch로 위장하지 않는다. 변경 없는 제품 source에 최신 main #731 포커스 교정을 합치고 새 정확 Head의 설치/E2E 등 검증은 새 Run으로 판정한다. 이전 로컬 #623 시간초과/PrePR BLOCKED와 미검증은 그대로 잔존한다.
- Cross-run 업데이트: F730-001 TEST_CONTRACT #463 readonly POST 오분류, F730-002 PRODUCT static hook deps/lint, R730-001 원본·상세·일정 경합은 기존 교정 그대로 보존한다. **F730-003은 새로운 설치 네트워크 환경 사건**이며 실제 실패 E2E 파일 합집합은 여전히 `milestone-dashboard-state.spec.ts`(#3001)뿐이다.

## 9. 최신 main #731 PR #748 정렬 및 재검증 인계 (2026-10-19)

- 기존 #747 Head `c8f0c283ceb87ff9afc205cd51080c5baed42fea` 이후 #731 [PR #748](https://github.com/planner77/masterGantt/pull/748) 결과로 main이 `fbe7db83a4baa2877a75db0769a59077bbe308c4` → `a0297cd4b01e0083273ad3444edc7fa1ed0a145f`(3 commits) 이동했다. #747은 `behind_by=3`/mergeable=false 상태였고 open review thread=0(과거 P2 thread는 resolved/outdated). 현재 지연은 새로운 E2E 실패가 아닌 main drift 및 mergeability다.
- 공통 수정 네 경로: `CHANGELOG.md`, `docs/PROJECT_UX.md`, `docs/TEST_PLAN.md`, `src/features/logistics/project-logistics-management.tsx`. 원본 공통 base fbe7…를 기준으로 양쪽 diff 적용 결과가 각각 원본 blob과 정확히 동일함을 확인한 뒤 병합했다. `TEST_PLAN.md`의 동일 위치 신규 섹션은 #731 M-001 이력을 먼저, #730 기존 원장을 이어 보존했으며 React의 #731 정확 KPI 원본 포커스와 #730 WBS 조회/원본 인계·callback을 모두 포함한다. 그 외 main-only #731 테스트·원장/소스는 main tree에서 보존하고 branch-only #730 기능은 기존 Head에서 보존한다.
- 브랜치 정렬 커밋은 기존 c8f…를 첫 부모, a029…를 둘째 부모로 사용하는 non-force fast-forward merge여야 한다. 게시 후 `behind_by=0`, `mergeable=true`, 미해결 리뷰0과 새로운 exact Head Full PR CI 등록을 **한 번** 검증한다. 결과 완료 모니터링/재실행은 사용자 요청에서 제외된다. 별도 Owner/Trusted QA/병합/GHCR/Release/Issue 종료를 승인하거나 수행하지 않는다.
- 본 단계의 원격 CI 새 HEAD 결과, 실제 로컬 npm/Playwright/TypeScript/Docker 재실행은 **NOT TESTED**. #3005 기존 성공한 일부 Job을 새 source의 전체 PASS로 사용하지 않는다.

## 10. F730-004 — Full PR CI #3008.1 Shard6 #550 canonical GET transport reset (2026-10-19)

### 원본 Run / Attempt, 직접·파생 오류

| 항목 | 원본 관측 |
| --- | --- |
| Full CI | [#3008.1 / Run 39234279476](https://github.com/planner77/masterGantt/actions/runs/39234279476), pull_request, attempt 1, Head `435ccfffdf60eb4d1695b2260175e7c8728e3918`, Base `a0297cd4b01e0083273ad3444edc7fa1ed0a145f`, test merge `472b1313424e12fe67df4864295a0ee4cf5f9c01` |
| 직접 FAIL | [Chromium Shard6 Job 118000414173](https://github.com/planner77/masterGantt/actions/runs/39234279476/job/118000414173), `tests/e2e/milestone-management-persistence.spec.ts:190,200,230`, #550 Milestone-only(past). `page.request.get(api)`에서 `apiRequestContext.get: read ECONNRESET`; 71 PASS / 1 FAIL / 62 DID NOT RUN |
| 이전 성공과 구별 | 동일 테스트의 Milestone 생성 POST는 HTTP201, Revision2 데이터 화면/원본 trace에 존재. GET의 HTTP 오류 응답(4xx/5xx) 또는 SQLite commit/Task identity mismatch는 관측되지 않음 |
| Required 및 실행 Job | QA Preflight, Fast Gate, Policy, Typecheck, ESLint, Vitest, PR Next.js Build 및 Docker 구현/aggregate SUCCESS; 다른 E2E Shard1~5는 FAIL-FAST CANCELLED (Shard5 로그에 84 PASS가 기록되어도 Job conclusion은 CANCELLED). Chromium aggregate 118005620472 FAILURE |
| QA Final | Job 118005655193: `required e2e 미성공`이므로 종속 FAIL. 별도 제품 테스트 오류로 중복 계산하지 않음 |

### 실패 진단 원본과 불확실성

- [Shard6 Playwright artifact 12179655842](https://github.com/planner77/masterGantt/actions/runs/39234279476/artifacts/12179655842) digest `sha256:2c11ee0da18d2b43708330b42475ab7502699d959bd0a7b082871a1b5588fc03`의 제한된 ZIP 내부 `isolated-application-diagnostics`와 API trace를 읽기 전용 대조. 원시 ZIP/trace, 헤더·cookie·실제 URL·인증값은 Git에 넣지 않음.
- 실패 후 격리 Next CLI process alive=true, exitCode=null, signal=null(전후 동일); 독립 `/api/health/ready` HTTP200/27ms. cgroup `oom=0`, `oomKill=0`; 사용량 약 7.34GB→8.37GB 및 호스트 free 약 11.78GB→10.84GB. 자식 HTTP worker의 연속 생존/전체 메모리 임계값까지 증명되지는 않았으므로 서버 재시작·OOM·Next 버그·stale pooled socket을 근거 없이 확정하지 않는다.
- 판정: **INIT_TRANSPORT / read-only Project GET ECONNRESET, root cause UNKNOWN**. F730-003(#3005.1)의 외부 `nodejs.org/SHASUMS256.txt` 설치 네트워크 ECONNRESET과는 다른 단계·endpoint다. 같은 문자열만으로 동일 사건으로 묶지 않는다. 이전 F730-001(#3001.1)의 #463 read-only POST watcher, F730-002(#3003.1)의 Hook/ESLint 오류 및 R730-001 지연 원본 navigation P2 보완은 불변이다.

### 전체 실패 합집합·직접 교정과 회귀 기준

- 이슈 #730의 접근 가능한 원격 Full 4회는 #3001.1, #3003.1, #3005.1, #3008.1(모두 별도 Head/attempt1/FAIL)이다. **직접 실제 E2E 실패 파일 합집합은** `tests/e2e/milestone-dashboard-state.spec.ts`(#3001)와 `tests/e2e/milestone-management-persistence.spec.ts`(#3008). F730-002는 ESLint, F730-003은 npm install이므로 신규 브라우저 FAIL이 아니다.
- 변경 범위: #550 직접 실패 파일 `tests/e2e/milestone-management-persistence.spec.ts`의 두 원래 `get()` 소비자(관리/프로세스 restart, Milestone-only past/future)에서 기존 `observedReadOnlyGet(observeIsolatedApi, path, operation)`을 재사용하며 요청 GET에 `Connection: close` 적용. 즉시 재전송하지 않고 첫 번째 GET의 ECONNRESET을 **실제 observer가 기록하고 서버 Health/process/cgroup을 수집한 뒤** 동일 읽기 전용 GET을 최대 한 번만 추가 검증한다. 관련 공식 선례: [#703 누적 실패 원장](ISSUE_703_FAILURE_ANALYSIS.md), [원격 검증](REMOTE_VALIDATION.md), [#624 transport 기록](ISSUE_624_CI_FAILURE_ANALYSIS.md).
- 기존 helper와 tests/scripts/isolated-readonly-get.test.ts의 정상 1회 / 첫 ECONNRESET bounded 2회 / 두 번째 실패 / HTTP404·409·503, ETIMEDOUT·ECONNREFUSED·잘못된 JSON·비 Error 음성을 유지. **업무 POST/PUT/PATCH/DELETE 재전송 0, HTTP 실패·불일치·2차 ECONNRESET은 FAIL**, Milestone/Task·원본 ID·revision·Gate·readonly·프로세스 재시작의 정확 단언/전역 Retry/Timeout/Skip은 변경하지 않는다.
- 직접 #550와 기존 #463, 인접 #703/#624, #731 KPI/Milestone·Resource 및 #730 조회/원본 복귀는 새 HEAD PR Full 6 Shard를 통해 검증한다. GitHub 파일/로그/trace 정적 근거 외 로컬 새 코드 npm/Playwright/Docker는 이 세션에서 **NOT TESTED**. 새 Head PR Required Quality/E2E/Docker, Trusted QA·Owner 수용 전 병합·Main/GHCR/Release/이슈 종료 금지.
- 원본 다른 Shard CANCELLED/NOT RUN 및 과거 로컬 #623 30s 불명 시간 위험·PrePR BLOCKED는 해소했다고 선언하지 않는다. 동일 이슈 재실패 시 **본 문서 F730-005 이후에 누적**, 별도 실패 원장 금지. 이번 요청은 새로운 Full PR CI 시작 확인까지만이고 CI 완료 모니터링은 금지.

## 11. F730-005 — PR #747 Full #3009.1 E2E 도움말 표시 위치 차이 (2026-10-19)

- **변경 불가능한 원본:** [PR CI #3009.1](https://github.com/planner77/masterGantt/actions/runs/39238265650), Run ID `39238265650`, attempt1, event=pull_request, Head `da6d256290f1c5fcc6edd5e33643098e19b92cd3`, Base `a0297cd4b01e0083273ad3444edc7fa1ed0a145f`, test merge `1cab9bf9d867cc212b2c8147b1e8dc718a740f25`.
- **직접 실패:** [Shard2 Job 118013575315](https://github.com/planner77/masterGantt/actions/runs/39238265650/job/118013575315), `tests/e2e/issue-719-contextual-help.spec.ts:89:74` — `#719 milestone 동일 fixture 5폭 설명 높이·작업면·overflow 및 도움말`. `opened.primaryDataTop`과 `closed.primaryDataTop` 동일값 단언에서 **expected 1099, received 1119**, 화면상 주요 데이터 상단 위치 20px 차이. 이는 `documentWidth` 차이로 단정하면 안 된다. Shard2 34 PASS, 1 FAIL, 95 DID NOT RUN. [Shard2 Playwright report/trace artifact 12180920482](https://github.com/planner77/masterGantt/actions/runs/39238265650/artifacts/12180920482)는 실제 요청/레이아웃 원인 추적용이며 현재 여기서 trace 내용의 독립 확인은 NOT TESTED.
- **파생/독립 검증:** QA Preflight, Policy, ESLint, TypeScript, Vitest, PR Next.js build 및 Docker 구현, Required Quality Job `118014052633`·Docker Job `118014467444`는 SUCCESS. 다른 Shard1/3/4/5/6는 matrix fail-fast에 따라 CANCELLED; E2E aggregate `118015638193` FAILURE, QA Final `118015668935`은 `required e2e 미성공`에 따른 파생 FAIL. CANCELLED/NOT RUN을 PASS로 재분류하지 않는다.
- **진단 경계:** 기존 [#719 전용 원장](ISSUE_719_FAILURE_ANALYSIS.md)의 popup focus/keyboard/overlay 테스트 과거 이력을 검토했다. 정확한 사용자 도움말 trigger·5폭·scroll owner 상태 차이의 인과는 현재 **UNKNOWN**이다. 수직 스크롤 위치 변화와 실제 레이아웃 변화 모두 가설이며, 20px 차이를 바로 CSS 제품 결함·Next 문제·flaky 환경으로 단정하지 않는다. `GitCommitInfo` 3초 git fetch timeout 부가 로그는 Playwright가 테스트를 지속한 상황이므로 본 assertion의 원인으로 단정하지 않는다.
- **누적 실패 파일 합집합 갱신:** `tests/e2e/milestone-dashboard-state.spec.ts` (#3001, #463), `tests/e2e/milestone-management-persistence.spec.ts` (#3008, #550), `tests/e2e/issue-719-contextual-help.spec.ts` (#3009, #719). #3003은 Hook/ESLint, #3005는 npm 네트워크 실패로 browser FAIL이 아니었다. 이전 F730-001~004와 로컬 L730-001은 그대로 보존한다.
- **이번 요청의 범위:** 사용자는 새 코드 원인 수정을 지시한 것이 아니라 **main 정렬·리뷰/충돌 해결·새 PR CI 시작**을 요청했다. 위 UNKNOWN을 임의 assertion 완화/skip/timeout 증가로 숨기지 않고 외부 별도 검증 위험으로 인계한다. 새 정확 Head의 E2E #719 포함 6개 Shard와 세 Required/Trusted QA 결과는 시작 시 NOT TESTED다.

## 12. 최신 main 정렬·리뷰 스레드·충돌 해결 (2026-10-19)

- 대상 PR [#747](https://github.com/planner77/masterGantt/pull/747), 출발 Head `da6d256290f1c5fcc6edd5e33643098e19b92cd3`(5 commits), 출발 main `0aa1d3d71f13df6976539ef4ebaaadb9037121c4`; 직전 공통 기준 `a0297cd4b01e0083273ad3444edc7fa1ed0a145f`에서 #731 [PR #749](https://github.com/planner77/masterGantt/pull/749) 2커밋이 main에 먼저 반영되어 PR compare `ahead5/behind2`, mergeable=false였다. 이 상태는 새 제품 테스트 실패가 아니라 **stale main 정렬·충돌**이다.
- **리뷰 해결 기록:** `list_pull_request_review_threads`에서 1개 Thread `PRRT_kwDOUUB7Bc6t0iIK`는 이미 이전 #730 P2 수정 답글과 함께 `is_resolved=true`, `is_outdated=true`. **새 미해결 리뷰 0개**, 추가로 임의 resolve하거나 원본 이력을 변조하지 않았다.
- **충돌 해결 범위:** main 변경6경로 가운데 #730과 동시 수정한 곳은 `CHANGELOG.md`, `docs/TEST_PLAN.md` 두 파일. `CHANGELOG.md`의 수정 hunk는 분리되어 양쪽 원문을 보존한다. `TEST_PLAN.md` 마지막 부분 동일 삽입 위치에 #731 M-002의 Next 동적 PATCH 준비 검증과 #730 F730-004 회귀 조항이 겹쳤으므로, **#731 M-002를 먼저, #730 F730-004를 이어서 보존**한 통합 Markdown으로 해결한다. 그 외 #731 `docs/ISSUE_731_FAILURE_ANALYSIS.md`·`docs/exec-plans/active/ISSUE_731.md`·`tests/e2e/fixtures/isolated-application.ts`·`tests/e2e/issue-725-process-workareas.spec.ts`는 최신 main blob을 그대로 유지한다.
- 구현/테스트 변경은 이번 정렬에 추가하지 않으며, #730 기존 WBS 조회/원본 경합/유한 GET 재검증 코드와 #731 API 준비 검증을 모두 보존한다. 워크플로·Quality/E2E/Docker Gate·retry/timeout·실제 업무 mutation·버전 `0.124.0`과 lock의 기준도 그대로 유지한다. 각 문서 수정의 공통 base 대조 및 최신 main에서의 결과 파일 SHA 검사를 거쳐 **기존 Head를 첫 부모·새 main을 둘째 부모로 하는 non-force fast-forward 병합 커밋** 한 개로 게시한다.
- 해결 증거: 새 branch Head에서 `behind_by=0`, `mergeable=true`, review unresolved0와 정확 Head를 확인하고 Full PR CI `pull_request.synchronize` 등록을 한 번 확인한다. 실행 시작 이후 완료 모니터링은 하지 않으며 Main 병합·GHCR·Finalizer·정식 Release·Issue 종료 및 Owner 위험 수용/Manager ACCEPT를 수행하지 않는다.

## 13. #730 main 정렬 — #731 Main M-003 이후 4경로 충돌 해결 (2026-10-19)

- **정확 원본:** PR #747 기존 HEAD `1b793b3652dac75cd75ca652069ea5abd18fcedb`, 새 main `5df178868139c4a307701e4807896691971b3376`, 공통 조상 `0aa1d3d71f13df6976539ef4ebaaadb9037121c4`. 직전 §12의 성공한 이전 main 정렬은 과거 기록으로 보존한다. 새 main에는 #731 PR #753의 Main #3011 이후 교정이 포함된다.
- **분기 변경 대조:** 공통 조상 대비 PR 변경 128경로, 새 main 변경 8경로. 동시 수정한 경로는 `CHANGELOG.md`, `docs/TEST_PLAN.md`, `docs/exec-plans/active/PLAN.md`, `tests/e2e/issue-623-resource-mvp.spec.ts` 4개. main만 수정한 `docs/ISSUE_731_FAILURE_ANALYSIS.md`, `docs/exec-plans/active/ISSUE_731.md`, `tests/e2e/project-task-editor-persistence.spec.ts`, `docs/evidence/issue-731/m003-local-validation.json`는 새 main blob을 그대로 채택했다. #730-only 파일은 기존 HEAD에서 보존한다.
- **문서 세 경로:** 각 브랜치의 공통 조상 대비 수정은 모두 순수 삽입이다. CHANGELOG의 독립 삽입을 모두 보존했다. TEST_PLAN·active/PLAN 첫머리의 동일 위치에는 #731 M-003 기록을 먼저 두고 #730 기존 기록을 이어 결합했다. 후속 단락 삽입도 누락 없이 보존하며 기존 본문 삭제·충돌 마커는 없다.
- **E2E 공통 수정:** 새 main의 #623 golden/Excel와 여섯 mutation 시나리오 분리, phase timing, 5폭 회귀·원본 단언은 보존했다. #730의 `isWbsViewReadQuery` import와 두 쓰기 감시기의 `!isWbsViewReadQuery(request)` 필터를 각각 재적용했다. read-only POST `/resource-dashboard/views`만 업무 mutation 계수에서 제외하고 다른 POST/PUT/PATCH/DELETE 감시는 유지한다. global retry/timeout/skip, workflow 및 application version 변경 없음.
- **리뷰:** GitHub PR #747의 유일한 리뷰 Thread `PRRT_kwDOUUB7Bc6t0iIK`는 과거 P2 cancelOriginal 보완 답글 이후 `is_resolved=true` 및 `is_outdated=true`, **현재 unresolved=0**이다. 추가로 임의 resolve한 스레드 0건이며 기존 기록은 수정하지 않는다.
- **검증:** GitHub 원본 3-way 문자/줄 대조 및 문서 추가분·코드 두 감시기 조건 보존을 정적으로 확인했다. 이 GitHub 도구 실행 경계에서 Node/TypeScript/Vitest/Playwright/Docker 실행은 **NOT TESTED**다. F730-001~005의 원본 실패·미확정 원인(특히 #719 20px, #623 실행 예산)을 PASS로 소급하거나 가리지 않는다.
- **게시/CI:** 기존 HEAD 첫 부모·새 main 둘째 부모의 non-force merge commit 한 개를 준비한다. 브랜치 갱신으로 `pull_request.synchronize` Full PR CI 등록/정확 Head 확인까지만 처리하고, CI 완료 모니터링·Main 병합·GHCR·Finalizer·정식 Release·Issue 종료는 하지 않는다. HIGH/OWNER_MANAGED, `release_authorized=false` 유지.


## 14. F730-006 — 누락된 Full #3012.1의 #623 시간 예산 실패 백필

- 원본 [#3012.1 / Run39245366403](https://github.com/planner77/masterGantt/actions/runs/39245366403), attempt1, Head `1b793b3652dac75cd75ca652069ea5abd18fcedb`, base `0aa1d3d71f13df6976539ef4ebaaadb9037121c4`, test merge `fc5a439a939a25cecadd73f6dcad898c04a88905`. §12는 시작 시점 기록이고 이 완료 실패를 아직 담지 않았으므로 이번 재개에서 백필한다.
- [Shard3 Job118036857253](https://github.com/planner77/masterGantt/actions/runs/39245366403/job/118036857253): `issue-623-resource-mvp.spec.ts:62`의 기존 통합 golden/여섯 mutation case가60,000ms를 초과했다. 후행 `target-bindings` GET 위치188에서 중단,43PASS/1FAIL/59NOT RUN. Quality118037407087/Docker118037863371 SUCCESS, E2E118040985127 FAILURE, QA118041025112는 파생 FAIL이다. 다른 Shard 취소를 PASS로 계산하지 않는다.
- 같은 통합 case의 시간 예산 결합과 후행 Response 수명은 [#731 M-003](ISSUE_731_FAILURE_ANALYSIS.md#11-m-003--pr-749-병합-main-30111의-시간-예산저장-후-조회-실패)에서 별도로 분석·교정되었다. 이 #730 원본 실패를 #731의 실패 횟수에 합산하지 않으며, §13에서 통합한 최신 main의 golden/여섯 mutation/폭별 독립 시나리오를 그대로 보존한다. 과거 로컬 L730-001의30초 geometry 실패도 소급 PASS로 바꾸지 않는다.

## 15. F730-007 — Full #3022.1 Task 물류 연결 원본 GET 전송 실패

- 원본 [#3022.1 / Run39267641340](https://github.com/planner77/masterGantt/actions/runs/39267641340), attempt1, Head `2a97043f40f3437778e2936b9413ff3269d197af`, base `5df178868139c4a307701e4807896691971b3376`, test merge `c519dffd7b59a0b7a9a32b936e64f39ab7f99997`. 원본 checkout 로그와 source artifact12192639409/digest `sha256:2f0d6959bae32e4c1e32f2fa3c120d6a0b64ae668d048d39fb3ccf64590a4555`를 교차 확인한다. Artifact는 비신뢰 PR 자료이며 Trusted QA 승인으로 사용하지 않는다.
- [Shard4 Job118112573965](https://github.com/planner77/masterGantt/actions/runs/39267641340/job/118112573965) `issue-726-task-logistics.spec.ts:66` 첫 case에서 후행 `readLinks`(:39, 호출:118)의 GET `/api/projects/[publicId]/tasks/[taskId]/logistics-links`가 HTTP 응답 전 `apiRequestContext.get: read ECONNRESET`.4PASS/1FAIL/158NOT RUN. Required Quality118113171221/Docker118113752230 SUCCESS, E2E118114067957 FAILURE, QA118114116896는 파생 FAIL. 취소된1/2/3/5/6의 부분PASS4/24/34/8/13과 Job CANCELLED를 구분하고, 추가 실제 테스트 FAIL은 관측하지 않았다.
- 원본 report artifact12194515233/digest `sha256:e673122f7d40b8b600da9cc5cc6cb680071f068392598ab9c5d9ca48fc7e076b`의 제한된 JSON 진단: reason=test_failure,elapsed33170ms, CLI generation1/alive=true/exitCode=null/signal=null, Health200/77ms, Next child RSS 약4.127GB, cgroup oom0/oomKill0. CLI·실패 후 Health가 정상이라는 사실로 HTTP worker의 연속 생존이나 TCP 소켓 원인을 확정하지 않는다. 실패한 helper가 observer를 사용하지 않아 요청 직후 타임라인도 없다. 정확 내부 근인은 **UNKNOWN**, 전송 경계 분류는 **INIT_TRANSPORT**다.
- #3005의 외부 npm 설치 네트워크와는 별개다. #3008의 canonical GET 및 #731 F-002/M-003-B의 저장 후 별도 APIRequestContext GET과 전송 유형이 같지만 호출 위치가 다르다. #726의 `process-context` 소비자만 이전 browser/no-store·observer 교정에 포함되어 `readLinks` 소비자가 누락된 것을 이번에 대조했다. 모든 업무 mutation·readonly/권한·정확 ID/revision 단언은 유지한다.

## 16. 이번 재개의 누적 교정·검증·리뷰 및 main 정렬

- baseline은 위2a97043f, 별도 `fix/issue-730-pr-ci-3022` worktree. 실제 infra 원본 수집·frontend 구현/회귀·read-only ui_ux 과거 geometry 진단·Manager 문서/게시를 분리한다. 기존 다른 worktree와 인증·DB·runtime 로그는 변경/게시하지 않는다. version0.124.0, HIGH/qa_required=true/OWNER_MANAGED/release_required=true/release_authorized=false 유지.
- 누적 실제 실패 E2E 파일 합집합은 **5파일**: `milestone-dashboard-state.spec.ts`(#3001), `milestone-management-persistence.spec.ts`(#3008), `issue-719-contextual-help.spec.ts`(#3009), `issue-623-resource-mvp.spec.ts`(#3012), `issue-726-task-logistics.spec.ts`(#3022). #3003 ESLint 및 #3005 npm 설치는 별도 정적/환경 실패다. 같은 파일의 새 case와 취소/미실행을 중복 성공으로 계산하지 않는다.
- 현재 main5df17886은2a97043f의 조상이다. 시작 시 GitHub mergeable=true, 유일한 기존 P2 Thread `PRRT_kwDOUUB7Bc6t0iIK`는 resolved/outdated, 미해결0. 이번 시작 시 추가 충돌/새 리뷰 해결0건이며 기존 §6/9/12/13의 실제 충돌 해결과 R730-001 답글을 보존한다. 게시 직전 main·Head·리뷰를 다시 확인하고 이동 시 통합한다.
- 원본 재현 준비의 node_modules 외부 symlink는 Turbopack 경계에서 거부되어 테스트 이전 BLOCKED였다. lockfile 일치를 확인한 물리 dependency 배치로 교정했으며 제품/config 수정이나 실제 #726 테스트 실패로 계수하지 않는다. 원래 첫 case는 로컬1PASS(29.7초)/exit0로 reset이 재현되지 않았다. 이것은 원격 FAIL의 소급 해결 증거가 아니다.
- 최종 source 교정·같은 source의 실제 실행·문서/리뷰 결과는 아래에 누적한다. 새 Head Required3/Trusted·Owner/Manager 최종 승인은 **NOT TESTED**이며 사용자 요청은 새 PR Full CI 시작까지만이다.


### 16.1 원인별 교정과 반례

| 누적 사건 | 이번 교정·검증 경계 |
| --- | --- |
| F730-001 #463 조회 POST 오분류 | exact read-only POST helper 및 실제 업무 mutation0 음성을 보존한다. 누적 #463 전체를 최종 source에서 실행한다. |
| F730-002 Hook 의존성 | 기존 modal setter 의존성 교정을 보존한다. 최종 TypeScript/ESLint와 실제 원본 이동 회귀를 실행한다. |
| F730-003 외부 npm 설치 reset | source/config 변경 없음. 후속 Head의 npm 설치 성공과 과거 네트워크 원인 해결을 구별하며 무조건 retry를 추가하지 않는다. |
| F730-004 #550 canonical GET reset | 기존 제한된 read-only GET 재검증 정책을 바꾸지 않고 #550 전체3case를 실행한다. 새 #726 helper는 retry0이며 서로 다른 계약을 혼동하지 않는다. |
| F730-005 #71920px | 원본 trace와 로컬 제어 재현에서 WBS404 pending→error 높이 변경을 확인했다. synthetic fixture의 정확 POST404와 명시 terminal error barrier로 보완한다. |
| F730-006 #62360초 | main의 golden/여섯 mutation/5폭 독립 시나리오를 보존하고 전체7case를 실행한다. 과거 실패를 테스트 삭제·timeout 증가로 숨기지 않는다. |
| F730-007 #726 후행 GET reset | same-origin browser GET/no-store/redirect:error와 safe observer로 누락 callsite를 정합화한다. 정확 TCP 내부 원인은 UNKNOWN이며 실제 HTTP/JSON/원시ID·권한 단언은 유지한다. |
| R730-001 기존 P2 | 최신 의도·부모/Details/host 두 번째 scope 취소 교정을 유지하고 직접 #730 전체6case를 선정한다. 기존 GitHub thread는 이미 resolved이며 새 해결건으로 계수하지 않는다. |

#719의 원본 trace는 call5258/5262에서 scrollTop383을 유지한 채 미처리 POST가404 PROJECT_NOT_FOUND로 끝나고 sibling WBS가 pending24px→error retry44px로 바뀐 것을 보인다. 로컬은 그 응답을 닫힌 geometry 이후에만 해제하여 **closed1099/opened1119/scroll383→383/writes0/browserErrors0**, 기존 exact equality FAIL/exit1을 재현했다. 이것은 실제 옛 원격 실행과 구분한 제어 재현이며 제품 CSS/ContextHelp 변경 근거가 아니다. 새 fixture는 원래 SQLite에 없는 synthetic Project의 **오류를 명시**하고 기다린다. 성공 WBS DTO를 조작하거나 WBS 기능 PASS로 전용하지 않는다. milestone/resource 지연 응답2case와 기존10case에서 준비 barrier·기존 exact geometry·panel scroll·5폭/keyboard/touch/mutation0을 검증했다. [정제 영수증](evidence/issue-730/rework-3022/help-validation.json)에 RED와 최종12PASS를 분리했다.

#726 새 helper의 실제 browser 음성은 connectionreset abort·HTTP401/500·잘못된JSON200에서 실패하고 요청1회를 유지한다. 별도 사전검토의 로컬 P2(default redirect follow)는 `redirect:error` 및 same-origin/foreign302의 source1/destination0 검증으로 보완했다. 이는 **로컬 코드 검토 지적 해결1건**이며 GitHub 리뷰 스레드를 새로 종료한 것은 아니다. 진단 allowlist는 Task logistics-links/process-context template만 추가하고 UUID·query·body·cookie를 보존하지 않는다. 독립 무세션/Origin/revision API 요청과 업무 PUT/PATCH는 기존 별도 API client로 유지한다.

### 16.2 검증 출처와 범위

- [정제 원격 이력](evidence/issue-730/rework-3022/remote-failures.json)은 알려진 Full7건의 latest-attempt Job/직접 실패를 재조회하고 artifact/checkout 및 취소 Shard를 대조한다. wrapper의 첫 페이지·최신 Attempt 응답 한계 때문에 숨은 Run/과거 Attempt의 전체성을 독립 증명했다고 주장하지 않는다. 미발견 metadata/추가 Attempt를 임의로0건 확정하지 않는다.
- #719 최종12case는 owned spec의 실행 전후 SHA256 `aa80e01d426bb34bfb040432d0e639274a31257f7d62f9aab1d570e088bb1a7e`가 같다. 전체 src/tests963파일 manifest는 **첫 case 이후 실행 중** 처음 캡처했고 종료 후 mismatch0이며 실행 중 source 수정은 없었다. 이를 전체 manifest의 실행 전 캡처라고 표현하지 않는다. Manager의 나머지 동결 실행과963파일 bytes를 대조한다.
- 앞선 #726후보4PASS는 redirect 보완 **전** 결과다. 최종 소스의 #7263case·브라우저 음성1case, 누적 다른 파일과 직접/인접 소비자의 결과는 뒤의 별도 실행 영수증에 귀속한다. source가 바뀐 과거 결과를 최종 PASS에 합산하지 않는다.


### 16.3 최종 로컬 결과·문서 동기화와 게시 인계

- 최종 동결 [브라우저 영수증](evidence/issue-730/rework-3022/browser-validation.json):7파일30PASS/0FAIL/0SKIP/0flaky/exit0,966,945ms. helper 음성1+#623전체7+#726전체3+#730전체6+#463전체7+#550전체3+Task Editor canonical 인접3이다. 별도 #719전체12와 중복 없이 **고유42case PASS**이며 이전 후보4PASS·원본 재현1PASS·통제RED를 합산하지 않는다. workers1/retries0/max-failures0이며 독립6 Runner와 동등하지 않다. 실행 중 격리 실패 진단 첨부0건이고, 이전 bounded GET 회복 정책의 첫 reset을 숨긴 PASS라는 관측도 없다.
- 최종 [단위/통합 영수증](evidence/issue-730/rework-3022/unit-validation.json):16파일219PASS/0FAIL/0SKIP/exit0. 기존 직접 domain/model/transport/실제 SQLite HTTP195개와 진단·canonical GET·기존 read-only GET 음성24개를 포함한다. JSON의 numPassedTestSuites35는 describe suite 통계이며35파일을 실행한 뜻이 아니다. 앞선18개 부분 검증은 합산하지 않는다.
- 전체 src/tests963파일의 [동결 manifest](evidence/issue-730/rework-3022/source-freeze.json)는 실행 전후 mismatch0이고, #719 실행 중/후 manifest와 Manager 실행 전 manifest도 bytes mismatch0이다. aggregate SHA256 `f3cefba56460788e58a985395d18c71f7db170f6820c476f7b54011114742a3c`의 직렬화 방법은 JSON에 명시한다. Node v22.14.0/npm11.10.0의 단일 로컬 host이며 CI Node22.x runner·실기기·운영 환경과 구분한다.
- [최종 정적 검사](evidence/issue-730/rework-3022/static-validation.json): 전체 typecheck/ESLint/version0.124.0/test discovery/Markdown275파일/diff check 모두 exit0. lint0error/기존13warning, discovery248unit files/757browser cases는 발견 수이지 전체 실행 PASS 수가 아니다. 로컬 전체 Vitest/Playwright·production build/audit/Docker 및 main/GHCR는 NOT TESTED/별도 gate다.
- 로컬 실행 예외: 브라우저와 병행한 첫 전체 ESLint는 격리 Next 생성물이 존재하는 실행 경계여서 확인한 owned ESLint만 SIGINT로 중단했다(exit130). 브라우저/source를 중단·수정하지 않았다. [첫 정적 시도](evidence/issue-730/rework-3022/static-validation-attempt1.json)는 LOCAL_INTERRUPTED로 보존하고 최종 PASS로 바꾸지 않는다. 브라우저 teardown 후 tracked Next 설정/기존 output26개를 HEAD bytes로 복원, 새 untracked capture12개를 ignored 진단 폴더로 이동한 뒤 standalone 정적 검사를 새로 끝냈다. CI/config/ignore/timeout 규정 변경은 없다.
- 실제 PrePR는 **targeted dry-run만** 실행했다. [선정 영수증](evidence/issue-730/rework-3022/prepr-selection.json)은 NOT TESTED/sourceStable=true/steps0, UNKNOWN7/missing0이다. UNKNOWN은 기존 logistics3producer·WBS fixture·read-only helper와 이번 diagnostic fixture·Task browser helper다. 실제 실행은 위 수동 선정 명령/영수증에 귀속하며 CLI PASS나 fast/diagnose/전체 회귀 실행으로 전용하지 않는다. 과거 fast/targeted BLOCKED 기록도 보존한다.
- 영향 매핑: Task browser helper→#726실제3/실제 browser 오류·302음성1 및 canonical 인접3; diagnostic allowlist→진단 unit·실제 SQLite/HTTP 격리 소비자; help fixture→기존10/지연응답2; 기존 WBS/원본 취소·query observer/main #623 교정→누적 실제 실패5파일/직접 #730/Unit219. 제품·DB writer·공개 API/권한·일정/Import/Export/화면 계약은 추가 변경하지 않아 해당 전수 로컬 검증을 반복하지 않고 Required 원격 전체 gate에 남긴다.
- DOCUMENTATION_SYNC는 이 원장·Work Packet·TEST_PLAN·active PLAN·CHANGELOG·정제 증거를 동기화한다. 제품/설계/API/DB/보안/일정/사용자 가이드·CI/권한/QA 정책의 N/A 근거는 Work Packet을 따른다. raw log/trace/DB/cookie/auth·pre-signed 다운로드 URL은 게시하지 않는다.
- 게시 범위는 기존 PR747의 완성된 단일 묶음과 새 Full CI 시작이다. 별도 qa_docs의 source/문서/원격·로컬 증거 사전 검토를 받고, 최신 main/expected Head·리뷰0·충돌0 및 전체 Git Tree/부모를 전후 대조한다. 실제 게시 Head·Run/Attempt/base/test merge는 Issue/PR STATUS에 기록하여 이 문서의 검증 대상 source와 연결한다. 새 Head Required Quality/E2E/Docker·Trusted/Owner 위험 수용·Manager ACCEPT는 NOT TESTED이며 CI 완료 모니터링·PR main 병합·Main/GHCR/Release·Issue 종료는 수행하지 않는다.


- 최종 별도 read-only Reviewer `/root/qa_review`의 코드·문서·원격/로컬 증거 사전 검토 **PASS, P1/P2 미해결0**. 소스963개 SHA256을 직접 재계산해 mismatch0,42browser/219Unit/정적 검사/PrePR dry-run 경계와 원격 수집 한계·privacy를 대조했다. 구현자의 자체 PASS·독립 인간 QA·Trusted QA·Owner/Manager ACCEPT와 구분한다. 로컬 redirect P2 해결1건, 이번 GitHub 스레드 해결0건이다.
- 게시 전2026-10-19T14:57Z 원격 재조회: PR Head `2a97043f40f3437778e2936b9413ff3269d197af`, main `5df178868139c4a307701e4807896691971b3376`, test merge `c519dffd7b59a0b7a9a32b936e64f39ab7f99997`, mergeable=true, review unresolved0. git fetch와 main ancestry·unmerged index0도 일치한다. **추가 main 병합 N/A, 새 충돌 해결0건**이며 기존 해결 이력은 보존한다. 이후 게시 직전 이동이 발견되면 재통합·검증한다.
- 로컬 Git push dry-run 인증은401로 실패했으므로 기존 연결 Git Data API의 blob→tree→commit 준비/전체 tree 대조→force=false Ref1회→read-back 경로를 사용한다. 토큰 추출·권한 변경·파일별 live PR 게시를 하지 않는다. 실제 Ref/Head·Run 출처와 완료 모니터링 미수행은 게시 후 STATUS로 연결한다.

- 게시 준비 보조 CLI 첫 실행은 LOCAL_BRANCH_MISMATCH/BLOCKED였다(검증용 fix 브랜치와 게시 대상 feat 브랜치가 다름). 기존 feat worktree/브랜치를 변경하지 않고 같은 검증 tree의 별도 게시용 clone에서 대상 이름 브랜치를 구성하여 prepare/before/after를 다시 실행한다. 이 로컬 준비 차단은 source CI 실패나 gate PASS가 아니며 helper 조건을 완화하지 않는다.

## 17. F730-008 — Full PR CI #3023.1 #727 멤버십 저장 후 Project GET 전송 오류 (2026-10-20)

### 17.1 원본 Run·직접 실패와 실패 합집합

- 원본 [PR #747 Full #3023.1 / Run 39274370437](https://github.com/planner77/masterGantt/actions/runs/39274370437), attempt 1, event=`pull_request`, source HEAD `ec1a18e67b7d1a12b040e8298bde98ba93d93256`, base `5df178868139c4a307701e4807896691971b3376`. 새 E2E 실패는 이전 #3022.1 `issue-726-task-logistics.spec.ts`와 **별개 source/파일**이다. 기존 F730-001~007와 이전 42 browser/219 Unit 로컬 증거는 당시 source에만 유효하며 소급 변경하지 않는다.
- **직접 실패:** [Shard1 Job 118135816061](https://github.com/planner77/masterGantt/actions/runs/39274370437/job/118135816061), `tests/e2e/project-resource-memberships-persistence.spec.ts:6:5` — Project 기준정보 리소스 등록 직후 `after = await snapshot()`(callsite :52)에서 `snapshot` 함수(:21)의 `page.request.get(/api/projects/{UUID})`가 `apiRequestContext.get: read ECONNRESET`로 **HTTP 응답 전 전송 실패**. Shard1에서82 PASS/1 FAIL 이후 fail-fast로 나머지 미실행. Shard3는 SUCCESS, Shard2/4/5/6는 CANCELLED. 취소된 테스트는 성공/실패로 재분류하지 않는다. 원본 log의 URI·Cookie·Authorization·원시 trace는 Git 원장에 복사하지 않는다.
- **독립/파생 판정:** QA Preflight·Policy·TypeScript·ESLint·Vitest·PR Build·Docker 구현, Required Quality Job `118136456437` 및 Docker Job `118137060088`는 SUCCESS. Required E2E Job `118145624408`는 FAILURE, QA Final Job `118145674684`은 Required E2E 미성공의 종속 FAILURE. 원본 Head 전체 CI/QA는 FAIL이며 이전 로컬 PASS로 덮을 수 없다.
- 새로 추가된 실패 E2E 파일을 포함하면 #730에서 직접 확인된 **누적 실패 파일 합집합은 6개**: `milestone-dashboard-state.spec.ts` (#3001), `milestone-management-persistence.spec.ts` (#3008), `issue-719-contextual-help.spec.ts` (#3009), `issue-623-resource-mvp.spec.ts` (#3012), `issue-726-task-logistics.spec.ts` (#3022), `project-resource-memberships-persistence.spec.ts` (#3023). 정적/외부 네트워크 실패 #3003/#3005는 browser fail 수에 넣지 않는다.

### 17.2 원인·전용 교정

- UI 등록 PATCH/응답·SQLite persist 실패가 증명된 것이 아니라, UI 등록 후 원본 검증 경로가 여전히 **독립 Playwright APIRequestContext**를 사용하던 누락이다. 로그에는 요청 전송 후 HTTP 응답이 없고 `ECONNRESET`가 있다. `#726 후행 readLinks`, `#550 canonical GET`, `#731 Task Editor GET`과 호출 경로가 같은 종류의 리스크이지만 **실제 TCP 소켓 리셋 내부 근인은 UNKNOWN**이다. 연결 재사용·Next HTTP worker·메모리·서버 재시작은 직접 증거 없이 확정하지 않는다.
- `tests/e2e/project-resource-memberships-persistence.spec.ts`: 등록 전 Resource Catalog/Task/Assignment **준비·독립 권한 API 요청은 기존 API context 그대로** 유지한다. 실제 `page.goto` 및 UI 등록/다이얼로그/재시작 이후에 검증하는 Project canonical snapshot 2회는 기존 `readBrowserCanonicalSnapshot(page, api, observeIsolatedApi)`로, UI 뒤 `assigned-targets` 검증2회와 `resource-memberships` 확인1회는 제한된 browser GET helper로 전환한다. HTTP200·JSON·원본 Task/Links/Assignment ID·등록 여부·Gantt 인스턴스/스크롤/dirty 편집·재시작 보존 단언은 그대로 둔다.
- `tests/e2e/helpers/browser-project-resource-data.ts`는 `/api/projects/{UUID}/(assigned-targets|resource-memberships)` 정확 경로만 허용하고 browser `fetch(credentials:same-origin,cache:no-store,redirect:error)` 및 `observeIsolatedApi`로 각각 **한 번만** 조회한다. HTTP200·JSON·data 및 해당 배열 형식을 검증하고 network abort/401/500/잘못된 JSON·응답 구조/동일·타 origin redirect/잘못된 path에서 fail-closed 한다. 원본 GET 실패를 재전송하지 않고 업무 POST/PUT/PATCH/DELETE는 건드리지 않는다.
- `tests/e2e/fixtures/isolated-application-diagnostics.ts`의 안전한 route template에 위 GET 두 경로만 추가한다. `tests/server/e2e/isolated-application-diagnostics.test.ts`에서 정확 template 허용과 UUID/민감 query/임의 suffix 거부를 검증한다. 원시 Cookie·Authorization·ID·URL·응답 body를 로그에 기록하지 않는다.
- `tests/e2e/browser-project-resource-data.spec.ts`에서 두 GET의 실제 동일 origin 양성 및 abort/401/500/invalid JSON/invalid shape/2종 redirect·잘못된 path 음성을 수행하도록 회귀를 추가한다. 각 요청 횟수1을 확인하고 retry/timeout/skip/기존 E2E6 Shard 정책은 변경하지 않는다.

### 17.3 검증과 반영 경계

- 이 세션의 연결 GitHub 환경에서는 Node 의존성·실제 SQLite/Next/Chromium을 실행할 수 없었다. **로컬 TypeScript/Unit/실제 Browser/Docker 및 Full PrePR = NOT TESTED**. 새 코드/문서의 엄격 경로·원본 변경/신규 helper 스키마는 정적 검토했으며 **PASS를 주장하지 않는다**. 최종 원격 Full PR CI가 새 정확 HEAD에 대한 Required Quality/E2E6/Docker를 판정하도록 유지한다.
- 검증 필요: #727 기존 리소스 등록/Assignment·reload/SQLite restart·Task/원본/dirty guard, 새 브라우저 resource GET 정상·오류/redirect 단발, #731 기존 Task Editor canonical, #726 logistics link, #730 WBS 조회 및 #719 geometry/기존 #623 다중 수정, 전체 기존 Full CI. 최신 Head에서만 유효한 결과를 채택하며 과거 #3023의 다른 Shard CANCELLED를 합산하지 않는다.
- **리뷰/충돌:** 게시 직전 GitHub PR #747의 미해결 스레드0·mergeability/main ancestry를 재확인한다. 기존 P2 thread `PRRT_kwDOUUB7Bc6t0iIK`은 과거 resolved/outdated이며 신규 resolve 0건이다. 새 main 변경이 없을 경우 충돌0/정렬 N/A이고, 바뀌면 보존 통합 후 동일 원장에 추가한다.
- **범위:** HIGH/OWNER_MANAGED, version 0.124.0, release_required=true/release_authorized=false. 브랜치에 변경 원자 커밋 한 건을 게시하고 `pull_request.synchronize` 새 Full CI 등록/HEAD/base/run만 확인한다. CI 완료 모니터링·병합·Main CI/GHCR/Finalizer·정식 Release·Issue 종료·Owner/Manager ACCEPT는 수행하지 않는다.

## 18. F730-009 — PR #747 Full #3025.1 TypeScript TS2532 및 Fast Gate 중단 (2026-10-20)

### 18.1 원본 실패·근거와 이전 이력 구분

- **원본:** [PR Full #3025.1 / Run 39313371409](https://github.com/planner77/masterGantt/actions/runs/39313371409), attempt 1, event=`pull_request`, HEAD `827db790ab567b80ff3a53374f00842ad1ed89b4`, base `5df178868139c4a307701e4807896691971b3376`. 원격 TypeScript Job [118268773525](https://github.com/planner77/masterGantt/actions/runs/39313371409/job/118268773525) 로그에서 `tests/e2e/project-resource-memberships-persistence.spec.ts(91,10): error TS2532: Object is possibly 'undefined'.` → `tsc --noEmit` exit2로 확인했다.
- **직접 원인:** 직전 F730-008 교정에서 `const memberships = await browserResourceRead<...>("resource-memberships")` 이후 `memberships.resources.find(row => row.id === member.id).registered`를 검사했다. `Array.find()`의 반환 계약은 `T | undefined`이므로 TypeScript strict null 검사에서 `.registered` 역참조를 거부한다. 실제 HTTP·SQLite·조회 전송 실패와는 다른 **테스트 작성자 TypeScript 계약 결함**이다. 기존 리소스가 반드시 존재한다는 업무 전제만으로 컴파일러 타입을 좁힐 수 없다.
- **독립/파생:** 이번 Source의 Policy·ESLint·Vitest·QA Preflight는 SUCCESS. [PR Fast Gate Job 118269315070](https://github.com/planner77/masterGantt/actions/runs/39313371409/job/118269315070)은 `TYPECHECK_RESULT=failure`로 FAIL(계약에 따라 fail-closed). Required Quality [118269410026](https://github.com/planner77/masterGantt/actions/runs/39313371409/job/118269410026), Chromium E2E [118269410582](https://github.com/planner77/masterGantt/actions/runs/39313371409/job/118269410582), Docker [118269409987](https://github.com/planner77/masterGantt/actions/runs/39313371409/job/118269409987)은 aggregate FAILURE. 실제 PR Next build / E2E 6 shards / Docker smoke 구현은 **SKIPPED**, 브라우저·Docker 실행 실패로 잘못 기록하지 않는다. QA Final [118269455934](https://github.com/planner77/masterGantt/actions/runs/39313371409/job/118269455934)은 종속 FAILURE. 원본 Run의 결과는 수정하지 않는다.
- **실패 누적 구분:** F730-001~008에 있던 직접 E2E 실패6파일 합집합은 그대로 유지한다. 이 #3025.1은 **새 실제 E2E FAIL 파일을 추가하지 않는 static typecheck FAIL**이며 F730-008의 런타임 ECONNRESET 수정 효과를 검증하는 E2E가 실행되지 못했다. 앞선 TypeScript Hook/ESLint F730-002와도 정확 코드 위치·실패 원인이 다르다.

### 18.2 보완·회귀·검증 경계

- **코드 수정:** `tests/e2e/project-resource-memberships-persistence.spec.ts`의 마지막 원본 멤버십 확인 한 곳만 `const registeredMember = memberships.resources.find((row: { id: string }) => row.id === member.id);`와 `expect(registeredMember, "...").toMatchObject({ registered: true });`로 바꾼다. 존재하지 않으면 `toMatchObject`가 실패하고, 존재하더라도 `registered !== true`이면 실패하므로 **정확 ID·등록 참값 단언을 유지**한다. `!` 단언·`as any`·타입 검사 비활성화/제외/skip·업무 로직/타임아웃/Retry 완화는 사용하지 않는다.
- **테스트 범위 보존:** 초기 seed/API 권한, UI 리소스 등록, Project 원본2회·assigned-targets2회·resource-memberships1회, Task/Links/Assignment ID·dirty guard·Gantt/scroll/SQLite restart 원본 단언, 새 helper의 HTTP/JSON/redirect/transport 음성 등 F730-008의 보완은 불변이다. 이 수정의 직접 요구 검증은 `npm run typecheck`, `npm run lint`, Unit + #727 실제 Chromium, 인접 #726/Task Editor/#730 및 누적 실패6파일/Full Required3이다.
- **실행·증거 구분:** 원본 `tsc` FAIL은 위 GitHub Run에서 실증되었다. 연결 GitHub 파일 편집 환경에는 이 저장소의 전체 Node dependencies/실행 DB·Playwright 소스가 준비되지 않았으므로, 보완한 새로운 전체 HEAD의 `npm run typecheck`/lint/Unit/Chromium/Docker는 **NOT TESTED**. 변경 한 곳의 Source 정적 구조 검토를 새로운 전체 빌드 PASS로 표시하지 않는다. 이번 테스트 결함을 새 Full PR CI가 탐지·검증하도록 기존 게이트를 유지한다.
- **리뷰·main:** 이전 P2 Review Thread `PRRT_kwDOUUB7Bc6t0iIK`은 resolved/outdated. 이번 새 검토에서 unresolved 0, main 기존 HEAD 조상/behind 0 및 mergeable=true인 경우 새 충돌 해결0, 별도 main 정렬0로 기록한다. 게시 직전 기준이 이동했으면 재확인·통합하여 원장에 추가한다.
- **운영 경계:** issue-specific 누적 원장만 갱신하고 `AGENTS.md`, `ISSUE_LIFECYCLE`, `TEST_PLAN`, Work Packet·Changelog 기준을 유지한다. HIGH/OWNER_MANAGED, candidate `0.124.0`, `release_authorized=false` 불변. 한 묶음 커밋 Push로 `pull_request.synchronize` 새 Full PR CI 등록과 정확 Head/base/Run만 확인하며 **완료 모니터링·재실행·병합·Main CI·GHCR·Finalizer·Release·Issue 종료는 하지 않는다**.

## 19. F730-010 — PR Full #3027.1의 #623 여섯 mutation 테스트 예산 재발 (2026-10-20)

### 19.1 원본 실패·실행 귀속

- Full [PR #747 CI #3027.1 / Run 39314765099](https://github.com/planner77/masterGantt/actions/runs/39314765099), `pull_request`, attempt1, source HEAD `6005dfcf00bbe006e5345938d944cce9ee3c7014`, base `5df178868139c4a307701e4807896691971b3376`; test merge `0bd9deb2a72b85de1b0ed2f8403e40d9a9ff6380`는 정확 두 부모 base/head 및 동일 Git tree `2a4457a6135f74f38fd5bd00d3507932cf575df6`를 갖는다. 기존 F730-001~009의 서로 다른 Head/Run/Attempt 원본 실패 판정은 소급 변경하지 않는다.
- 직접 실패: [Chromium Shard3 Job 118274194932](https://github.com/planner77/masterGantt/actions/runs/39314765099/job/118274194932)의 `tests/e2e/issue-623-resource-mvp.spec.ts:185` ‘#623 여섯 별도 mutation·양방향 동일원본 복귀’ — **Test timeout of 60000ms exceeded**. 마지막 stack은 `readMutationSource`의 `page.evaluate`(:82), 호출 :251(`assigned-targets` GET). 이는 전체 예산 종료 시 남아 있던 작업일 뿐 단일 GET이60초 걸렸다는 증거가 아니다.
- Shard3: **44 PASS / 1 FAIL / 63 NOT RUN**, 다른 Shard1/2/4/5/6 CANCELLED. 바로 앞 Golden/OOXML 독립 case는32.4초 PASS. PR Build Job118274194530, TypeScript118273496926, ESLint118273496952, Vitest118273497064, Policy118273497041, Docker 구현118274194790, Required Quality118274963587·Docker118275212283은 SUCCESS. Required E2E118279802717 FAILURE 및 QA Final118279856115 FAILURE는 최초 E2E로부터 파생된 게이트 판정. CANCELLED·NOT RUN을 PASS로 바꾸지 않는다.
- 실제 원본 [E2E Timing Shard3 Artifact #12217861381](https://github.com/planner77/masterGantt/actions/runs/39314765099/artifacts/12217861381) digest `sha256:5032bbcd5eb51363e1b0347d93d4a91f2a034fa2c8ab4a97e55dc68be7c2b564`; [Playwright Report Shard3 #12217981209](https://github.com/planner77/masterGantt/actions/runs/39314765099/artifacts/12217981209) digest `sha256:94f031e0ab41aca5824c491efbc09ff0ac7be16ef10c2f980e8448721a486804`. Trace의 정제 `issue623-phase-timing` JSON은 status `timedOut`, test budget `60000ms`, body `61586ms`, wall `61627ms`. Raw ZIP/trace·쿠키·실 Project ID/URL/DB는 Git에 포함하지 않는다.

### 19.2 이전 실패 합집합과 정확 원인 분석

| 실제 계측 구간 | 관측값 |
| --- | ---: |
| fixture setup | 41ms |
| 실제 SQLite/HTTP fixture seed | 20,790ms |
| 변경 전 원본 Task/Assignment 확인 | 4,948ms |
| 1 WBS 작업명 PATCH·원본 | 5,015ms |
| 2 Target 경유 시작일 PATCH·원본 | 8,587ms |
| Resource 화면 전환 | 2,778ms |
| 3 Task 상태 PATCH·원본 | 6,379ms |
| 4 진척률 PATCH·원본 | 5,920ms |
| 5 Assignment allocation PUT 진행·기한 중단 | 7,170ms |
| 6 Target member PUT | NOT RUN |

- 전체 budget은 여러 단계의 실제 준비·화면 변경·저장/원본 조회가 소비했다. 마지막 `page.evaluate`나 SQL 쿼리가 단독으로60초 정체했다고 주장할 수 없다. 테스트 전체 시간이 개별 정상 HTTP 요청의 합계보다 길어져 실패한 **TEST_CONTRACT / TIME_BUDGET_COUPLING**으로 분류한다. Next worker, TCP socket, OOM, SQLite 이상이 근본 원인이라는 직접 증거는 없다.
- #730 F730-006(#3012.1) 및 #731 M-003-A(#3011.1)는 Golden/Mutation/폭별 대형 테스트 분리로 일부 개선되었다. 이번에는 **여섯 UI 저장 검증 자체가 단일60초 예산**이었으며 동일 문제가 재발했다. 다른 직접 E2E 실패 파일6개(기존 #463/#550/#719/#623/#726/#727)는 변경 없이 합집합에 남는다. #3003 ESLint·#3005 npm·#3025 TypeScript 오류는 별도 원인으로 계속 보존한다.

### 19.3 보완의 선택 이유, 검증 및 잔여 위험

- 3개 독립 SQLite fixture의 두 mutation씩 분리안을 비교했다. 이 안은 더 짧은 실행 단위 대신 **같은 Project/Task/Assignment에 여섯 UI mutation을 연속 적용하는 통합 수용 증거를 없애며**, 반복 fixture seed로 CI 시간이 증가한다. #623 AC2의 단일 원본/6개별 저장·다관점 왕복을 보존하기 위해 **채택하지 않는다**. 준비 과정의 미게시 Git Blob은 PR 브랜치나 코드에 연결하지 않는다.
- **최종 코드 교정은 한 건:** 기존 `tests/e2e/issue-623-resource-mvp.spec.ts`의 위 테스트에만 `test.setTimeout(60_000)` → **`test.setTimeout(90_000)`**를 적용한다. 이는 원본에서 실제 body61,586ms로 검증된 시나리오 하나에만 적용하는 유한한 28,414ms의 실행 여유이며, 전역 timeout·다른 E2E case/Shard/Job·CI runner 정책 변경이 아니다. 해당 test 내부 모든 6개의 원본 ID·Task/Assignment 관계·revision+1~6·업무 실제 저장6회(4PATCH+2PUT)·Target subset/개인80%·조회 mutation0·Gantt 동일 인스턴스·WBS↔Resource/Target 및 일정 복귀, exact HTTP/JSON 오류·stale/권한은 **그대로 유지한다**. Skip/Retry/Assertion 완화도 하지 않는다.
- 회귀 범위는 동일 `issue-623-resource-mvp.spec.ts`의 Golden/OOXML, 여섯 mutation, 폭별 5케이스 전체와 기존 직접 실패6파일, 인접 #726/#727 Resource/Task 원본·#731 Task Editor, #730 WBS 원본·#719, Resource/Target SQL/DTO 및 diagnostic helper 정상·음성이다. 전용 `issue623-phase-timing`/원시 ID attachment는 계속 기록하며 #752 진단 도입 전까지 향후 >90초 재발 시 동일 원장·Trace에서 새 단계별 병목을 분석한다. 이 대응은 **E2E 정상 동작 완료를 보장하거나 서버 지연 자체를 제거했다는 의미가 아니다**.
- **검증 구분:** 원격 실패 원본·Trace와 단계 계측은 실증 확인. 수정 후보는 동일 Git Blob 원본에서 단일 변경만 적용했으며 로컬 TypeScript5.8.3 parser `syntax errors=0`, 원래 6개 저장 단언/기존60초 다른 case 불변을 확인했다. 이 환경에서 저장소 전체 의존성·실 SQLite/Next/Playwright/`npm run typecheck`/Vitest/Build/Docker·PrePR 실제 명령은 **NOT TESTED**. 정적 parser를 전체 typecheck 또는 Chromium PASS라고 주장하지 않는다. 이전42 browser/219 unit 로컬 PASS는 과거 source에 귀속하며 새 HEAD 검증은 Full CI 시작 뒤 결과로만 평가한다.
- **리뷰·정렬:** 이전 P2 Thread `PRRT_kwDOUUB7Bc6t0iIK`는 resolved/outdated이며 신규 unresolved0. baseline HEAD `6005dfcf...`는 main `5df17886...`를 포함하고 PR mergeable=true/behind0였으므로 새 conflict0/추가 main 통합 N/A(게시 직전 재확인). HIGH/OWNER_MANAGED·버전0.124.0·`release_authorized=false` 유지. 동일 이슈 전용 원장/TEST_PLAN/Work Packet/active PLAN/CHANGELOG와 **단일 non-force commit**로 게시한 뒤 새 PR Full CI 등록만 확인한다. 사용자 지시대로 결과 모니터링·병합/Main/GHCR/Finalizer/Release/Issue 종료는 하지 않는다.

## 20. F730-011 — PR #747 Full #3029.1 Task Editor 3시간대 재확인 Test Budget 실패 (2026-10-20)

### 20.1 원본 실행, 직접/파생 실패·증거

- 원본: [Full PR CI #3029.1 / Run 39320381909](https://github.com/planner77/masterGantt/actions/runs/39320381909), attempt1, event=`pull_request`, Head `0e229ca683bf6fc14fcc81013b6e809e61d5dade`, Base `5df178868139c4a307701e4807896691971b3376`. Source test-merge `c3f1754916e4d2f5323c160aeee9259a334c00bf`의 Git 부모가 정확히 base/head이고 Tree는 HEAD와 동일한 `c9fea4991e2e1624059a9cee28bf767d7d32bf83`이다. F730-001~010의 원본 Run/Attempt·실패 판정과 이전 수정은 소급 변경하지 않는다.
- **직접 FAIL:** [Chromium Shard4 Job 118293734277](https://github.com/planner77/masterGantt/actions/runs/39320381909/job/118293734277), `tests/e2e/project-task-editor-persistence.spec.ts:8` ‘persists explicit editor changes, task details and safe URL click without remount’, `Test timeout of 30000ms exceeded`(CLI 30.9s 포함 teardown). 해당 Shard는 **79 PASS / 1 FAIL / 83 NOT RUN**이며 다른 Shard1/2/3/5/6은 **모두 SUCCESS**(앞선 #3027의 다섯 취소와 구별). Required Quality118294178176, Docker118294657281 및 PR Build118293733791, TypeScript/ESLint/Vitest/Policy 모두 SUCCESS. Required E2E118305656588 FAILURE, QA Final118305694493 FAILURE는 E2E 원본 미성공의 종속 실패이다.
- 원본 [Playwright report shard4 artifact #12221407834](https://github.com/planner77/masterGantt/actions/runs/39320381909/artifacts/12221407834), digest `sha256:8088a0c6ef4de1a4175b4e20280e33ad518dc84d2a079e52b933f9bd8c8a4194`; [timing shard4 #12220837876](https://github.com/planner77/masterGantt/actions/runs/39320381909/artifacts/12220837876), digest `sha256:90ea520571c827b53492c0b26905479d9d5f250b09b7e872192f9afd8854a382`. 원본 Playwright nested `test.trace`의 실제 before/after, test body와 fixture 경계를 읽기 전용 대조. 타이밍 JSON `headSha=c3f17549...`는 임시 **test-merge SHA**이며 PR Head `0e229ca6...`와 구별한다. 원시 trace/ZIP·민감 URL·쿠키·Project ID/DB를 원장에 복사하지 않는다. 비치명 GitCommitInfo 3초 git-fetch timeout 알림은 테스트 실패 시점과 별개의 로그로, 원인으로 단정하지 않는다.

### 20.2 Trace 시간순서와 과거 실패 종합

- 해당 test의 **Before Hooks / isolated application fixture 시작 준비**는 약 **15.53초**이며 원본 Test body 30초 예산과 별도다. Test body 시작을 상대 t=0으로 두면 UI 저장·revision/Task·Gantt 인스턴스·URL 팝업·문서 재진입·Task 메뉴 검증을 완료하고 browser storage 수집까지 약 **14.93초**. 이후 저장한 동일 Project/Task에 대해 새 브라우저 Context마다 독립 timezone으로 여는 검증에서 **UTC 약 4.01초 PASS**, **Asia/Seoul 약 5.44초 PASS**; **America/New_York 약 5.62초 후 deadline**이다. 세 번째에서는 실제 페이지/메뉴를 열고 Editor 진입 중 timeout이 발생했으며 마지막 요청 시작일/기간/이름 값 비교를 끝내기 전 종료되었다. 따라서 날짜값 불일치·Gantt 재마운트·Task 저장 실패를 관측한 것이 아니다.
- `tests/e2e/project-task-editor-persistence.spec.ts`는 첫 케이스에 명시된 제한시간이 없어서 Playwright 기본 `30,000ms`를 적용한다. 단일 테스트에 (1) 실제 원본 Task 저장/수정·재진입·팝업, (2) 새 browser context 3개에서 같은 저장값 확인을 연속 실행하며, 이 **TEST_CONTRACT / TIME_BUDGET_COUPLING**이 직접 실패 원인이다. 테스트 단언 자체가 실패한 기록은 없다. 네트워크 `ECONNRESET`, CSS/제품 날짜산식·SQLite·메모리/OOM 문제로 단정할 근거는 없다.
- #730 F730-006(#3012) 및 F730-010(#3027)의 Resource MVP 큰 테스트 예산, #731 M-003-A의 60초 종단간 결합 실패와 동일한 **여러 개별 동작을 한 테스트 기한에 결합**한 유형이다. F730-008(#3023) 및 #731 M-003-B의 Task Editor/canonical GET 전송 reset은 **다른 호출/에러 유형**이며, 이번 Run에서는 별도 전송 오류가 관측되지 않았다.
- 기존 #730의 실제 직접 E2E 실패 파일 합집합 6개(`milestone-dashboard-state.spec.ts`, `milestone-management-persistence.spec.ts`, `issue-719-contextual-help.spec.ts`, `issue-623-resource-mvp.spec.ts`, `issue-726-task-logistics.spec.ts`, `project-resource-memberships-persistence.spec.ts`)에 이번 `project-task-editor-persistence.spec.ts`를 추가해 **고유7개**. F730-002 Hook/ESLint, F730-003 npm 네트워크, F730-009 TypeScript를 E2E 실패 파일로 추가하지 않는다. 이전 Head/취소·미실행을 PASS로 간주하지 않는다.

### 20.3 보완, 교차 검증 및 수용 경계

- **단일 변경:** `tests/e2e/project-task-editor-persistence.spec.ts` 첫 케이스 **한 건에만 `test.setTimeout(45_000)`**를 선언하고, 왜 설정했는지 원본 시간 기록과 함께 주석으로 남긴다. 테스트 body 원래 deadline 30초를 넘어 세 번째 timezone Editor 확인에 도달했던 원본 Trace에 기반하여 **유한 15초 실행 여유**를 부여한다. 다른 동 파일 테스트·프로젝트 전역 Playwright 설정·Shard/Job timeout·Retry·Skip·Fail-fast/Required Gate는 불변. 원본 실측은 30초에 중단되어 **새 45초 완주 시간은 새 Run 검증 전 UNKNOWN**이다.
- **기능/원본 보존:** 같은 Task UUID에서 실제 Editor 저장(PATCH 정확1회), 수정 전/후 canonical Project revision·Task/Summary 시작/종료/기간/진척/Description/URL, Gantt 단일 instance, 새 탭 URL 팝업, Context 메뉴, **UTC / Asia/Seoul / America/New_York 세 개 서로 다른 새 BrowserContext**에서 값 동일 및 각 Context 종료. 조건·확인 횟수·test 이름·assertion을 줄이거나 삭제하지 않는다. 새 상태가 검증되지 않으면 계속 FAIL한다.
- **비교 대안:** 테스트를 ‘UI 저장+URL’과 ‘3시간대’로 분리할 수 있으나, 새 Project/Task fixture로 대체 시 동일한 **Editor 저장 결과를 바로 세 timezone에서 연속 확인**했다는 기존 종단간 인과성이 약해지므로 지금은 분리하지 않는다. 45초는 임의 전역 증액이 아니라 측정된 한 케이스만 조정한 계약이다. 재발 시 타이밍/Trace를 추가 계측하고 실제 DOM/HTTP 단계 병목을 재평가할 필요가 있다.
- **필수 영향 테스트:** 원본 첫 Editor 저장+timezone case, 인접 `project-task-editor-persistence.spec.ts` 전체(다른 2케이스 포함), `issue-623-resource-mvp.spec.ts` Golden/여섯 mutation/5폭, #730 자체 composer/drill, #726 logistics, #727 membership, #719 help, Resource/Task/Assignment·stale/readonly·Gantt state 및 이전 실제 실패 **7파일 합집합**. 기본 PR Full Quality/E2E6/Docker+default branch Trusted QA는 불변이다.
- **실증/미검증 구분:** 실패 Run/Trace와 원본 Context별 경과시간·가시 Editor 값 확인은 실제 Runner 증거다. 이번 Git Data-only 수정의 원본 파일과 새 Git Blob 문자/구조 대비로 수정 범위는 확인했지만, 정확 Source 전체의 TypeScript/lint/Vitest/Chromium/Next/SQLite/Docker/PrePR 실행은 현 연결 실행환경에서 **NOT TESTED**. 이전 42 Chromium/219 Unit 로컬 결과 또는 #3029의 다른 Shard PASS를 새 HEAD 전체 PASS로 이월하지 않는다. 새 정확 Head 원격 CI가 구체적인 게이트 결과를 판정한다.
- **리뷰/main·게시 한계:** 최초 PR #747의 오래된 P2 Thread `PRRT_kwDOUUB7Bc6t0iIK`은 resolved/outdated이고 현재 미해결0. main `5df17886...`가 PR HEAD `0e229ca6...`의 조상, `mergeable=true`/behind0이므로 현재 추가 충돌·정렬 없음(최종 Push 직전 재확인). Issue #730 누적 **같은 파일 하나**에 이력 추가, 테스트 계획/Work Packet/Changelog와 단일 non-force commit 게시. HIGH/OWNER_MANAGED, candidate 0.124.0, `release_authorized=false`. 새 Full PR CI 시작 등록까지만 진행하고 완료 모니터링·병합·Main CI·GHCR·Finalizer·Release/tag·Issue 종료는 하지 않는다.



## 21. F730-012 — GHCR Release #182.1 v0.124.0 포커스 회귀 (2026-10-20)

- **원본:** [PR #747](https://github.com/planner77/masterGantt/pull/747) merge SHA \`71b870b75da73f413da54e22e55bb03dc0f5abe7\`; exact [Main CI #3034.1](https://github.com/planner77/masterGantt/actions/runs/39332756876) SUCCESS(세 Required, temporary verified ci-SHA), [Finalizer #724.1](https://github.com/planner77/masterGantt/actions/runs/39336778674) SUCCESS(tag/handoff 단계). [Release Run 39336847318 attempt1](https://github.com/planner77/masterGantt/actions/runs/39336847318), \`workflow_dispatch\`, annotated tag \`v0.124.0\`, exact merge SHA, **FAILURE**. Prepare/static SUCCESS, Chromium Shard1/2/4/5/6 SUCCESS, [Shard3 Job118348439947](https://github.com/planner77/masterGantt/actions/runs/39336847318/job/118348439947) 106PASS/1FAIL/1SKIP, Quality gate118358833375 파생 FAIL. Candidate 재검증·digest promotion·Resume 모두 SKIPPED. GHCR 인증/Push 에러는 관측되지 않았다.
- **직접 실패:** \`tests/e2e/issue-621-resource-target.spec.ts:146\` Assertion :213 (\`Expected BUTTON, Received SUMMARY\`). [원본 shard3 report+trace artifact #12228073141](https://github.com/planner77/masterGantt/actions/runs/39336847318/artifacts/12228073141). 같은 SHA의 Main Shard3 PASS는 이번 Release PASS가 아니다.
- **검증된 경합:** resource→group \`Target 비교 행\` 전환 직후 \`tbody tr=2\`만 확인해 이전 투영이 남은 상태를 완료로 오인했다. \`data-ready=false\`/stale에서는 \`td button disabled={stale}\`; \`first.focus()\`만으로 비활성/미포커스 실패를 감지하지 못하고 native \`Tab\`이 다른 \`SUMMARY\` 요소로 갔다. 분류 **TEST_CONTRACT / ASYNC_READINESS_RACE**. 제품 키보드 결함 증명 아님; stale 무한 유지나 실제 focus 오류면 FAIL해야 한다.
- **교정:** mode 변경 뒤 \`data-ready=true\`; 각 폭에서 \`data-ready=true\`, 실제 first \`toBeEnabled\` 및 \`toBeFocused\` 동기화 **이후** 기존 native Tab/paint/overflow/header-cell/keyboard/5폭 원래 assertion 전부 실행. UI·API·비즈니스 조건/timeout/retry/skip 변형 없음. 새로운 source 실행은 NOT TESTED.

## 22. F730-013 — 동일 Release #182.2 재실패 및 #623 폭별 예산 결합 (2026-10-20)

- **원본:** [Release Run 39336847318 attempt2](https://github.com/planner77/masterGantt/actions/runs/39336847318/attempts/2) \`triggering_actor=planner77\`, same immutable \`v0.124.0\`/merge SHA, 2026-10-20T00:20:55Z completed/FAILURE. Prepare/static, shards1/2/4/5/6 SUCCESS. [Shard3 Job118370897412](https://github.com/planner77/masterGantt/actions/runs/39336847318/job/118370897412) **103PASS/4FAIL/1SKIP**; [Quality gate118382188066](https://github.com/planner77/masterGantt/actions/runs/39336847318/job/118382188066) \`E2E=failure\` 파생 FAIL. Candidate runtime, digest promotion, resume SKIPPED.
- **4개 직접 FAIL:** 동일 #621 BUTTON→SUMMARY 재발 1건, \`tests/e2e/issue-623-resource-mvp.spec.ts:300\`의 390/768/1024 폭별 독립 geometry 세 건이 기본 \`30_000ms\` timeout. 각 출력 30.9/30.8/30.6s(후처리 포함), 1440/1920은29.5/29.7s PASS로 기한에 근접. 768의 \`apiResponse.text: Response has been disposed\`, 1024의 \`apiRequestContext.get: Test timeout\`는 종료 시 후행 오류이며 단일 HTTP GET 30s 정체 또는 서비스 장애라고 주장할 수 없다. 동일 #623 여섯 mutation case 90s는 PASS. [Attempt2 Playwright 원본 #12231516901](https://github.com/planner77/masterGantt/actions/runs/39336847318/artifacts/12231516901), [timing #12230289609](https://github.com/planner77/masterGantt/actions/runs/39336847318/artifacts/12230289609).
- **과거 원장 종합:** #730 F730-006(#3012)/F730-010(#3027)과 같은 실제 Seed·UI·canonical HTTP 연쇄의 **TEST_BUDGET_COUPLING**이나, 이번에는 기존 6 mutation 60→90s가 적용되지 않는 **다섯 개 별도 5폭 case**다. 제품/SQL/TCP/OOM 근인은 확인되지 않았다. 과거 E2E 직접 실패 파일 7개에 #621 추가하여 합집합 **8파일**(기존 #623는 중복 제외). #730의 lint/tsc/npm 실패는 E2E 파일 합집합에 포함하지 않는다.
- **범위 한정 수정:** 독립 5폭 test 각각 \`test.setTimeout(45_000)\` (기존 30s 예산과 실측29.5~30.9s 기반 유한 margin); fixture에서 Project/Task/Target 각각 실제 SQLite/HTTP 신규 생성, tree→matrix, inner scroll, native ArrowRight, hidden identity, header-cell 좌표/overflow/hit area, screenshots, zero business writes, 동일 Gantt instance, phaseTiming, test identifiers·모든 기존 단언 불변. 전역 Playwright/CI workflow/Retry/Skip/Fail-fast/quality Gate 변경 없음.
- **새 릴리스 복구 경로:** 기존 \`v0.124.0\` annotated tag/merge SHA·실패 attempt1/2·Owner exact-version 승인 \`expected_version=0.124.0\`은 **불변**. 같은 Primary Issue #730의 later corrective PR에서 **0.124.1 PATCH**로 별도 검증해 [Generic Finalizer Recovery](GENERIC_RELEASE_FINALIZER.md#recovery) \`release-failure supersession\` 계약을 사용한다. 원본 tag 삭제/이동·실패 Run PASS 전용 금지. \`0.124.1\` 정식 발행은 별도의 신뢰된 Owner \`expected_version=0.124.1\` 승인 marker가 필요하며 현재 \`release_authorized=false\`; 새 tag/GHCR/branch cleanup/Issue CLOSED는 차단한다.
- **검증 계획/현재 경계:** #621 stale/ready/Tab/5폭과 #623 전체 Golden·6 mutation·5폭 + 과거 직접 실패8파일 합집합, #730 composer/drill, #719 help/#726 logistics/#727 membership/#731 KPI Task Editor 및 timeout/GET/readonly/focus 음성, typecheck/lint/Vitest/real HTTP SQLite/Chromium/Docker, Full PR CI 3 Required·default-main Trusted QA/Owner HIGH 위험 수용. 현재 환경에서 repo npm 설치·브라우저 실행은 **NOT TESTED**. 새로운 HEAD의 CI 결론 확인 전 어떤 기존 Main/PR/Release PASS도 새 HEAD PASS로 재사용하지 않는다.
- **문서·범위:** \`docs/TEST_PLAN.md\`, \`docs/exec-plans/active/ISSUE_730.md\`, \`CHANGELOG.md\`, \`package.json\`/lockfile 0.124.1 동기화. 제품/DB/API/DESIGN/AGENTS/CI policy는 변경 N/A. 최초 0.124.0 실패 원장과 Branch/Issue 상태 보존. Owner 새 버전 승인·Full QA·Main CI·GHCR digest 전 병합·태그·이슈 종료 금지.
