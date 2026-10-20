# Issue #734 — PR CI 누적 실패 원장

> 정규 원장: `docs/ISSUE_734_FAILURE_ANALYSIS.md`. [이슈 #734](https://github.com/planner77/masterGantt/issues/734) / [PR #759](https://github.com/planner77/masterGantt/pull/759). 기준은 [PR_CI_FAILURE_TRIAGE](PR_CI_FAILURE_TRIAGE.md) 및 `AGENTS.md`. 동일 이슈에서 향후 재실패하면 이전 절을 수정·삭제하지 않고 실행별 절을 누적한다.

## 1. F734-001 최초 Full PR CI 실패 (2026-10-20 UTC)

| 항목 | 증거 |
| --- | --- |
| Run | [#3058.1 / 39438998422](https://github.com/planner77/masterGantt/actions/runs/39438998422), `event=pull_request`, Attempt 1, FAILURE |
| Source | PR #759 Head `0786dde2a9fd96539250e91e482e85f4f557407f`, Base main `08a1d9ff25a97aba67f08d6b67029ac55d45121a`, 당시 PR API의 test-merge `a8a71c88e061f1b31b67b47fafee6a21650bd736` (부모 별도 감사 UNKNOWN) |
| 초기 검사 | QA preflight 118683762751, TS 118683918536, Lint 118683918545, Policy 118683918691, Vitest 118683918750, Fast Gate 118685478364 모두 SUCCESS |
| 실제 Heavy | PR Build 118685573523 SUCCESS, Docker smoke 118685573989 SUCCESS; [E2E shard1 118685573823](https://github.com/planner77/masterGantt/actions/runs/39438998422/job/118685573823) FAILURE, shard2~6 CANCELLED |
| Required3 | Quality 118686285539 SUCCESS, Docker 118686900226 SUCCESS, Chromium E2E 118689135769 FAILURE |
| QA Final | 118689188975 FAILURE: `required e2e 미성공` 파생 gate(독립 결함 아님) |
| 원본 | [Shard1 Playwright Report Artifact #12274915136](https://github.com/planner77/masterGantt/actions/runs/39438998422/artifacts/12274915136) — Trace 재생은 NOT TESTED |

**최초 실제 실패**: `tests/e2e/issue-734-equipment-dashboard.spec.ts:164-167`의 `#734 5폭 긴 이름·내부 overflow·열 정렬·native Tab/Escape`가 fixture 준비 `f.mutate(... equipment name ...,"patch")`에서 **HTTP400 INVALID_REQUEST**. 오류 `Equipment name must be non-empty and at most 200 characters.`; `expect(response.ok()).toBe(true)`의 실제 값 `false`. 시간 **2026-10-20T14:34:28Z**. 문자열 `"LongEquipmentNameWithoutWhitespace".repeat(8)`는 **272자**이고 계약 한도는 **200자**. Shard1 **11 PASS, 1 FAIL, 138 NOT RUN**. 다른 5 Shard는 fail-fast **CANCELLED**로 PASS/FAIL로 추정하지 않는다.

**분류 및 원인:** `TEST_FIXTURE / INPUT_CONTRACT`. 실제 제품이 유효하지 않은 설비명을 보호한 것이므로 API 검증을 약화하지 않는다. 별도의 `GitCommitInfo: timeout of 3000ms` 경고가 있지만 테스트 12개가 뒤이어 실행되었고 종료의 직접 원인은 HTTP400이다. E2E 본문 Timeout이 아니므로 Shard 재분배·Timeout/Retry 확대 없음.

## 2. R734-001/002 리뷰 결함 (최초 CI 실패와 별도)

- **R734-001 P2** [PR review](https://github.com/planner77/masterGantt/pull/759): `src/server/resources/wbs-dashboard-views-core.ts`의 `systemIds:[]` 상태에서는 type selector 교차 결과가 빈 집합으로 바로 결정되어 `equipmentTypeCodes:["unknown"]` 검증을 우회. ledger 원본에 존재하는 설비 종류를 교차 조합 전에 독립 확인해 `INVALID_SELECTION` 반환. 반례: 같은 `systemIds:[]`와 정상 `amr` 타입은 200/빈 행. 전용 서버 Unit 보강.
- **R734-002 P2** [PR review](https://github.com/planner77/masterGantt/pull/759): 두 설비 유형의 `code`만 다르고 표시명이 같으면 체크박스의 visible/accessible label이 동일. `equipmentPresentation`에서 중복 이름에만 `이름 (코드)`를 만들고 실제 input을 감싼 HTML label에 표시. 동일 이름·서로 다른 코드의 고유 라벨 및 비중복 이름 우선 회귀 추가. UI 전체에 코드를 강제 표시하지 않는다.

## 3. 누적 실행 매트릭스 및 재발 방지

| Run/Attempt | 첫 오류/실패 파일 | 원인 및 보완 | 보완 HEAD 결과 |
| --- | --- | --- | --- |
| `39438998422.1`, `0786dde2` | `tests/e2e/issue-734-equipment-dashboard.spec.ts`: 다섯 폭 E2E의 272자 Fixture | TEST_FIXTURE: **정확히 200자** 이름으로 교체, 기존 390/768/1024/1440/1920 폭·6열/overflow/Tab/Escape·쓰기0/Gantt/Milestone oracle 유지 | 신규 Required3/E2E6 **NOT TESTED** |

**누적 실제 실패 테스트 파일 합집합:** `tests/e2e/issue-734-equipment-dashboard.spec.ts` 한 파일의 한 테스트. 현재 확인 가능한 #734 전체 PR CI는 위 한 Run/Attempt, 해당 Run의 나머지 Shard는 취소. 다른 이슈의 #623/#730/#733 긴 테스트 Timeout과 혼동하거나 본 이슈의 실제 실패로 합산하지 않는다.

관련 범위: 서버 projection·이슈734 SQLite/HTTP 수용, Equipment 모델/checkbox, 이슈734 E2E, 인접 #730 composer/#735 system consumer와 이전 #624 KPI. 원인별 교정 후 기존 테스트·보안·권한·원본 동일성·고유 공수 등 모든 AC 불변. `docs/exec-plans/active/ISSUE_734.md`에 이력·DOC_SYNC와 선택된 회귀를 기록했다. 신규 source를 직접 checkout/npm/Playwright/Docker 실행하지 못했으므로 **로컬 NOT TESTED**. 최초 source의 Quality/Docker 성공과 과거155개 Unit PASS는 새 Head PASS 주장이 아니다.

이 원장은 대응 지식의 Source of Truth이며 원본 Run을 성공으로 바꾸지 않는다. 단일 수정 commit과 PR `synchronize`로 새 Full CI 시작 후 해당 Head/Run/Attempt를 여기에 계속 누적한다. 실패 해결 전까지 Owner HIGH 위험 수용, Trusted QA, main/GHCR, Issue 종료는 별도 gate. `release_authorized=false`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`.


## 4. F734-002 — 두 번째 Full PR CI #3061.1 저장 확인 단계 누락 / 2026-10-20 UTC

### 출처와 Job/Shard 누적

| 항목 | 이번 실행의 불변 사실 |
| --- | --- |
| Run | [#3061.1](https://github.com/planner77/masterGantt/actions/runs/39482448255), Run ID `39482448255`, attempt `1`, `event=pull_request`, FAIL, 시작 `2026-10-20T19:19:18Z` |
| PR | [#759](https://github.com/planner77/masterGantt/pull/759), Head `712d3edc85b5062ba1903c852427a97d464998f3`, Base `08a1d9ff25a97aba67f08d6b67029ac55d45121a` |
| Test merge | `e5b65a3acdd3631ab80e5d3114041fc9bf972743`의 Git commit 부모 순서가 `[08a1d9ff…,712d3edc…]`, tree가 실제 Head tree `2a76178cb46902a2badc7bc5432386d53f5bb15f`와 같음을 GitHub Git API에서 확인 |
| Fast | QA Preflight `118834338348`, policy `118834450171`, TypeScript `118834450135`, ESLint `118834449992`, Vitest `118834450006`, PR Fast Gate `118835242491` 전부 SUCCESS |
| Heavy | Build `118835413806`, Docker smoke `118835413805` SUCCESS. [E2E Shard1 `118835413964`](https://github.com/planner77/masterGantt/actions/runs/39482448255/job/118835413964) FAILURE; Shard2 `118835414010`, 3 `118835414104`, 4 `118835413985`, 5 `118835413957`, 6 `118835414030` CANCELLED |
| Required3 | Quality `118835933893` SUCCESS / Docker `118836652436` SUCCESS / E2E `118839899046` FAILURE |
| QA Final | `118839935452` FAILURE (`required e2e 미성공`이라는 파생 차단, 독립 정책 결함 아님) |
| 실패 artifact | [Playwright report/Trace #12292417645](https://github.com/planner77/masterGantt/actions/runs/39482448255/artifacts/12292417645); 다운로드·Trace replay는 NOT TESTED, 원본 job text와 호출 코드 교차 확인 |

Shard1은 앞선 F734-001의 `5폭 긴 이름·내부 overflow·열 정렬·native Tab/Escape`까지 포함하여 **12 PASS / 1 FAIL / 137 DID NOT RUN**, 실패 테스트는 **`tests/e2e/issue-734-equipment-dashboard.spec.ts:205`**, 제목 **`설비 원본 dirty 유지·정확 PATCH 저장·새 snapshot과 focus 복귀`**. `2026-10-20T19:30:14Z`에 `Test timeout of 120000ms exceeded`; 줄217의 `page.waitForResponse(PATCH /logistics/equipment/{id})`와 줄218의 `nextReport(POST /resource-dashboard/views)`가 모두 응답을 받지 못했다. 타 Shard2~6의 로그에서 관찰된 개별 PASS는 순서대로 **106 / 44 / 33 / 37 / 32개**, 추가 테스트 assertion FAIL은 관찰되지 않았으나 전체 Shard는 CANCELLED이며 PASS로 집계하지 않는다.

### 원인별 분류와 반례

- **F734-001 TEST_FIXTURE:** 첫 CI #3058.1에서 272자 설비명 사용으로 HTTP400; `712d3ed`에 200자 경계값으로 보완. 두 번째 #3061.1 같은 테스트가 **28.1초에 PASS**, 직전 교정의 해당 케이스 실증(전체 8케이스/Full E2E 성공 아님).
- **F734-002 TEST_CONTRACT / UI 승인 단계 누락:** 실제 `src/features/logistics/project-logistics-management.tsx` 편집 경로는 `EquipmentDialog.onSubmit → previewInstanceEdit → sourceImpact`를 통해 먼저 공유 Target/관련 Task 사용처 GET을 수행하고 **`공유 인스턴스 변경 확인`** 대화상자를 연다. 이후 사용자가 **`공유 사용처 확인 후 원본 저장`**을 누를 때만 `executeMutation(PATCH)`를 수행하도록 명시 설계되었다(동일한 절차는 기존 `tests/e2e/issue-735-system-dashboard.spec.ts`에서 정상 계약으로 모델링). 실패한 #734 테스트는 최초 `저장` 클릭 직후 바로 PATCH/report response를 기다리므로, 승인 단계 없이 존재하지 않는 요청을 무한 대기하다 120초 테스트 예산 소진. **제품 네트워크 병목·장기 API 처리 또는 전체 Shard 과부하라고 판단할 근거 없음.** 별도로 발생한 Playwright `GitCommitInfo: timeout of 3000ms` fetch 경고는 테스트가 계속 실행되었으므로 원인 아님.
- **기각/제약:** 이 동작을 우회하는 자동 확인·제품 API 수정·승인 생략은 하지 않는다. `120_000`을 늘리거나 retry/skip/matrix 분배를 바꾸어도 누락된 사용자 확인은 수행되지 않는다. 직접 원인에 대한 Shard 재분배는 불필요. 추후 실제 장기 수행·Shard 편중은 증거가 있을 때 별도 최적화한다.

### 단일 source 보완 및 교차 회귀

- `tests/e2e/issue-734-equipment-dashboard.spec.ts` 원본 저장 시험은 먼저 명시적 영향 확인 dialog의 **정확 설비 ID·승인 버튼 활성화**와 **쓰기0**을 확인한다. `원본 변경 취소` 후 초안·무쓰기 보존을 확인하고, 다시 저장하여 승인 버튼을 누른 시점에만 실제 PATCH200/최신 report를 관찰한다. `page.waitForResponse`는 승인 클릭과 동시에 arm, PATCH는 bounded **30초** (인접 #735와 동일 관측기 정책)로 실패를 조기에 표면화한다. 원래의 project revision+1/snapshot 변화/spec 불변·원본 이름·2개 WorkArea 보존·focus 복귀·실제 mutation `["PATCH"]` 단언은 그대로 유지한다.
- 기존 F734-001의 200자·5폭/6열/focus/overflow·Gantt instance/marker-OFF, F734 리뷰 P2 둘(빈 systemIds의 invalid type 거부/동명이형 checkbox), 직접 서버/consumer Unit 및 #735 동일 preview 계약을 전체 회귀 범위에서 보존한다. 리소스/Task source·Gantt 단일 writer나 실제 제품 저장 flow는 변경하지 않는다.
- [GSC](GANTT_STATE_CONSISTENCY.md) `1.0.0-candidate`의 GSC-01/07/08/09/11 및 [Conformance](GANTT_STATE_CONFORMANCE.md), [Adapter ADR](GANTT_ADAPTER_ADR.md), [Sync Trace](GANTT_SYNC_TRACE.md)를 인접 drill/focus/revision 영향으로 참조한다. API/DB/Security/DESIGN/CI policy는 불변, `docs/TEST_PLAN.md`·[Work Packet](exec-plans/active/ISSUE_734.md)만 직접 동기화한다.
- 신규 코드의 로컬 npm/Vitest/Playwright/SQLite/Docker **NOT TESTED**: 실행 컨테이너에서 GitHub DNS가 동작하지 않아 checkout이 불가능하고 현재 세션에 로컬 worktree/dependencies가 없다. 변경 source 수동/정적 인과 검토와 이전 Head의 원격 성공(품질/Docker)만 확인했으며 신규 Head의 완전한 PASS를 주장하지 않는다.

### 누적 실제 실패 Cross-run 매트릭스 (#734만)

| 실패 | Run/Head | 실제 실패 경계 | 교정 및 재검증 |
| --- | --- | --- | --- |
| F734-001 | `39438998422.1` / `0786dde2` | 이슈734 E2E 5폭 테스트: 이름272자→HTTP400 | 이름200자 Fixture. `39482448255.1`에서 해당 case **28.1초 PASS**; 후속 누적 전체 종료는 별개 |
| F734-002 | `39482448255.1` / `712d3edc` | 같은 E2E 파일의 **다른 test**: 미수행 공유 인스턴스 승인 때문에 PATCH/다음 조회를 무한 대기, 120초 | 확인/취소/재확인 명시 순서 추가, mutation0→승인 후 PATCH200·최신 revision/snapshot·focus 검증 유지. **새 Head 원격 NOT TESTED** |

**현재 누적 실제 실패 파일 합집합**: `tests/e2e/issue-734-equipment-dashboard.spec.ts` 한 파일 안 **서로 다른 2개 case**. §3의 최초 한 Run/한 case 서술은 작성 당시의 스냅샷이며 본 §4가 최신 누적 상태를 추가한다. 리뷰 원본 R734-001/002는 `712d3ed`에서 답글과 해결되었고 당시 최신 PR에서 미해결0/충돌0이었다. 신규 source 게시 전 같은 조건을 재확인한다. Owner-managed HIGH, `release_required=true`, `release_authorized=false`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`; merge/main/GHCR/이슈 종료는 미수행. 새 PR CI 시작까지만 수행하고 모니터링하지 않는다.


## 5. F734-003 — Full PR CI #3064.1 / 옛 고유 총계 Locator Timeout (2026-10-20 UTC)

### 원격 실행·이력

- 출처: [Full PR CI #3064.1, Run 39485897399](https://github.com/planner77/masterGantt/actions/runs/39485897399), event pull_request, attempt1, Head cd7c3a12465478909c8c11d70f793e57bd72d7ff, Base 08a1d9ff25a97aba67f08d6b67029ac55d45121a. GitHub test merge 541e450d56a451e269d124d24a59a3dc5321a6b6의 부모 [08a1d9ff…, cd7c3a12…] 및 Head와 동일한 Tree a9027f6e0927093327f84f364e09b0f3ed4b3c6b 확인.
- QA Preflight job 118846211190, TypeScript 118846335173, ESLint 118846335277, Policy 118846335100, Vitest 118846335187, PR Fast Gate 118847168880, Next Build 118847280033, Docker Smoke 118847279601 모두 SUCCESS. Required Quality 118847920532 SUCCESS, Docker 118848432370 SUCCESS, E2E 118853592381 FAILURE, QA Final 118853635815 FAILURE(필수 E2E 미성공에 따른 파생 차단).
- 실제 실패: [Chromium Shard 6, job 118847279897](https://github.com/planner77/masterGantt/actions/runs/39485897399/job/118847279897)의 tests/e2e/issue-730-view-composer.spec.ts:277, case '#730 실제 HTTP 원본 Task·Assignment 복귀, 응답 역전·오류 차단·구버전 설정 복구'. line338 locator.innerText()가 getByLabel('고유 총계', exact:true)를 기다리다 180000ms Test Timeout. 2026-10-20T19:57:49Z, shard6 32 PASS / 1 FAIL / 106 DID NOT RUN. [Playwright report/trace artifact 12294272551](https://github.com/planner77/masterGantt/actions/runs/39485897399/artifacts/12294272551)는 별도 ZIP/Trace 재생 NOT TESTED.
- 다른 Shard는 matrix fail-fast에 의해 CANCELLED: Shard1 job118847279860 개별47PASS, Shard2 job118847280169 개별110PASS, Shard3 job118847279825 개별50PASS, Shard4 job118847279856 개별76PASS, Shard5 job118847279794 개별60PASS. 각 원본 log에서 추가 actual FAIL은 관찰되지 않았다. CANCELLED를 전체 SUCCESS로 승격하지 않는다.

### 원인 및 F734-001/002 비교

- 분류: TEST_CONTRACT / CROSS_CONSUMER_REGRESSION. Issue #734의 설비 전용 consumer에서는 기존 공통 WBS 기본 렌더의 aria-label '고유 총계', text 'Task1' 대신 명시적인 dl aria-label '설비 작업 고유 총계', text '고유 Task 1건'을 제공한다. 원본 데이터는 동일 서버 고유 Task/Assignment 총계를 사용하며 사용자 UI 검색으로 합계가 바뀌면 안 된다는 요구는 그대로다.
- #730 회귀가 설비 탭에서 예전 라벨을 338/342/363행 세 차례 사용하여 화면에 없는 요소를 180초 내내 기다린 것이 직접 실패. 데이터 조회 지연, E2E 스케줄러 부하, 실제 저장/Focus 장애라고 볼 근거가 없다. GitCommitInfo 3초 timeout 경고 뒤 실제 테스트 진행이 지속된 점도 본 오류와 구분한다.
- 보완: tests/e2e/issue-730-view-composer.spec.ts의 위 3개 참조를 새 설비 원본 접근성 라벨로 교정하고, 기존 검색 전후 전체 고유 총계 불변·응답 역전 후 고유 Task 정확히 1건·상세/원본/임시 일정 왕복/Focus·stale 409/503 및 잘못된 revision 차단·legacy 저장 설정 복구 단언을 그대로 보존한다. 변경된 UI의 aria-label을 구버전으로 되돌리거나 기대 Task 수를 약화하지 않는다.
- 앞선 F734-001(첫 #3058.1, 설비명272자로 API400)은 #3061.1에서 200자 5폭 case PASS. F734-002(#3061.1, 저장의 공유 사용처 확인 누락으로 PATCH 응답120초 대기)는 #3064.1에서 설비 저장 case 27.0초 PASS. 또한 #3064.1 Shard1에서 issue-734-equipment-dashboard.spec.ts의 서로 다른 **8개 E2E case 모두 개별 PASS**하였지만 Shard1 전체는 CANCELLED이므로 required E2E PASS로 계산하지 않는다.
- 누적 실제 실패 파일 합집합: tests/e2e/issue-734-equipment-dashboard.spec.ts (F734-001/002, 서로 다른 2 cases) + tests/e2e/issue-730-view-composer.spec.ts (F734-003, 1 case) = **2파일·3개 고유 case**. 이 Issue의 PR #759에서 확인된 Full Run은 #3058.1, #3061.1, #3064.1 세 번이며 각각 별도 HEAD/attempt를 가진다. 과거 FAIL, 취소와 미검증은 소급 변경하지 않는다.

### 수정·영향·미검증 및 인계

- 제품/DB/API/Auth/Gantt writer/CI workflow 변경 없이 #730 인접 Chromium 테스트 선택자만 업데이트한다. #734 8 E2E/200자·WorkArea/원본 저장/readonly/stale, #730 공통 UI·scope/검색 및 #733 공정/#735 System의 독립 고유 총계, #624 KPI와 GSC-01/07/08/09/11을 전체 PR Quality/E2E6/Docker의 교차 소비자로 보존한다.
- 테스트 자체의 180s 예산, six-shard, fail-fast, retry/skip 조건은 변경하지 않는다. Timeout의 인과는 없는 locator이므로 테스트 재분배는 직접 해결책이 아니다. 진짜 Shard 부하 불균형은 전체 성공 Run과 실행시간 증거가 수집된 경우 별도 검토.
- DOCUMENTATION_SYNC: 본 Issue #734 단일 실패 원장, docs/exec-plans/active/ISSUE_734.md, docs/TEST_PLAN.md UPDATED. 별도 #730 실패 원장에 이번 #734 PR 오류를 독립 #730 Run으로 잘못 중복 귀속하지 않는다.
- 새 source의 로컬 npm/Playwright/SQLite/Docker/TypeScript 검증은 실행할 수 없어 NOT TESTED. 정적 diff/코드 계약 대조만 수행했고 이전 HEAD 원격 성공을 신규 HEAD의 성공 근거로 사용하지 않는다. 새 Head에 대한 GitHub Full PR CI를 시작한 후 완료는 모니터링하지 않는다.
- 리뷰 스레드 미해결0·strict main 정렬·충돌 없음 상태를 게시 전에 재확인한다. HIGH/OWNER_MANAGED, release_required=true, release_authorized=false, manager_decision=NOT TESTED, MERGE_READY=BLOCKED 유지. 병합/Main CI/GHCR/Release/Issue 종료는 별도 승인 전 수행하지 않는다.
