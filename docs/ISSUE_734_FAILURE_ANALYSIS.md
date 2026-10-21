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


## 6. F734-004 — Full #3066.1 원본 저장 뒤 Browser Response Body 소실 (2026-10-20 UTC)

### 출처와 직접 실패

- [PR CI #3066.1](https://github.com/planner77/masterGantt/actions/runs/39490390734), Run ID `39490390734`, Attempt `1`, event `pull_request`, Head `1bec79f666147b9d98711542e470592ea441439e`, 당시 Base `08a1d9ff25a97aba67f08d6b67029ac55d45121a`, test-merge `cb4579b2a0b4cf97bfdcb9ecae62fbd349009e13` (두 부모 `[08a1d9ff…,1bec79f…]`, Head와 동일 Tree `09a97d2332bb332f7c4b99169ee635c55a006950`). Full FAILURE.
- QA Preflight job `118861816116`, TypeScript `118861967488`, ESLint `118861967403`, Vitest `118861967526`, Policy `118861967635`, PR Fast Gate `118862794402`, Next build `118862894928`, Docker smoke `118862894771` 모두 SUCCESS. Required Quality `118863584144` / Docker `118864102619` SUCCESS, Chromium `118866760808` FAILURE. QA Final `118866812105`은 `required e2e 미성공` 파생 FAIL.
- 실제 실패 [Shard 1 Job 118862894989](https://github.com/planner77/masterGantt/actions/runs/39490390734/job/118862894989): `tests/e2e/issue-734-equipment-dashboard.spec.ts:205` 설비 원본 dirty/정확 PATCH/새 snapshot/focus 테스트의 **237행**에서 `response.json: Protocol error (Network.getResponseBody): No data found for resource with given identifier. Response body is not available for a response that was navigated away from`. 2026-10-20T20:23:53Z, **12 PASS / 1 FAIL / 137 DID NOT RUN**, 실패 자체는 약 **25.2s**로 120s Timeout이 아님. [Playwright report/trace artifact 12296156652](https://github.com/planner77/masterGantt/actions/runs/39490390734/artifacts/12296156652) 보관, 실제 zip/trace 재생 NOT TESTED.
- Shard2 `118862895033` 부분71PASS, 3 `118862895065` 부분41PASS, 4 `118862895059` 부분31PASS, 5 `118862894943` 부분24PASS, 6 `118862894988` 부분33PASS 후 모두 FAIL-FAST CANCELLED. 로그에서 별도 assertion FAIL은 확인되지 않았으나 전체 샤드 PASS라고 추정하지 않는다. 본 Run의 #730 수정 case가 완전히 수행되었는지는 NOT TESTED.

### 전체 이전 실패 이력 대조 및 원인

| ID/Run | 첫 직접 오류 | 당시 조치와 이번 Run의 증거 |
| --- | --- | --- |
| F734-001 · #3058.1 | 설비명272자 HTTP400 | API 최대200자 경계 E2E 변경. #3066.1 해당 5폭 case 22.6초 개별 PASS |
| F734-002 · #3061.1 | 공유 인스턴스 편집의 명시 승인 누락→PATCH wait120s | 확인·취소·재승인 단계를 E2E에 반영. #3066.1에서 승인/PATCH 이후 단계까지 도달, 이번 본문 읽기 오류는 **다른 실패** |
| F734-003 · #3064.1 | #730 인접 테스트의 구 `고유 총계` Locator180s | 현재 `설비 작업 고유 총계`/고유 Task1건으로 교정. #3066.1 Shard6의 해당 후단 PASS는 취소로 미확인 |
| **F734-004 · #3066.1** | 저장 후 조회 응답의 `refreshed.json()` CDP body 소실 | 신규 **FIXTURE_OBSERVABILITY**: 화면 전환 뒤 Browser Response를 뒤늦게 읽는 경쟁 조건. 제품 PATCH 오류/서버 JSON 불량 또는 장기 테스트 Timeout 증거는 없음 |

- 실제 `Promise.all([page.waitForResponse(PATCH),nextReport(page),confirmation.click()])`는 두 HTTP response 이벤트와 클릭 완료만 보장한다. 이후 `await saved.text()`를 수행하는 동안 앱은 성공 저장에 따른 canonical snapshot/revision 및 navigation을 진행한다. Playwright `Page.Response`는 navigation으로 이전 네트워크 리소스 body가 폐기될 수 있어 `refreshed.json()`이 `Network.getResponseBody` 오류를 낸다. 이는 **테스트 관찰 방식의 취약성**이며 실제 서버 응답 데이터가 잘못되었다는 근거가 아니다. 과거 #3064.1의 동일 test 27s PASS는 환경에 따른 레이스의 존재와 모순되지 않는다.
- **수정:** 브라우저에서 실제 PATCH200/실제 WBS report200 이벤트를 확인한 후, `data-ready=true` 및 `data-report-confirmation-id` 증가로 UI가 새 report를 채택한 사실을 독립 관찰한다. `refreshed.request().postDataJSON()`의 **동일 실 query**로 Playwright `page.request.post`의 별도 **읽기 전용 WBS API**를 호출해 보관되는 `APIResponse.json()`으로 projectRevision+1/snapshot 변경/spec 불변을 검사한다. 기존 canonical 설비 이름·WorkArea2/원본 Focus 복귀 및 승인 전 mutation0→승인 후 PATCH1 모두 유지한다. 새 query POST는 기존 정확 경로의 read-only로 간주하며 업무 mutation은 계속 관찰한다.
- 브라우저 Response 본문을 무조건 성공 처리하거나 `response.json().catch(()=>empty)`로 오류를 숨기지 않는다. 직접 API POST도 `HTTP200`과 실제 DTO·Revision·Snapshot·Spec 일치를 요구한다. 제품 코드·writer·API·보안·권한·기존 UI snapshot 사용 동작 변경 없이 E2E 관측 원인만 교정한다. 120s test timeout, 30s PATCH response, Retry/Skip, 전체6 Shard/Required3 유지. 시간이 길어서 재분배하는 조치는 이번 원인을 해결하지 못한다.
- 실제 실패 테스트 파일 누적 합집합 **2파일 / 3고유 case**: `issue-734-equipment-dashboard.spec.ts`의 5폭(case F001), 원본 PATCH/snapshot(서로 다른 두 Run에서 F002/F004 재실패), `issue-730-view-composer.spec.ts`의 원본/응답 역전(F003). 총 **4개 Run에서 4회 direct FAIL**, 고유3case. 취소된 후단 테스트는 NOT TESTED.
- 이슈 #732 PR #761의 main 병합으로 원본 기준 main `08a1d9ff…` → `5ffe02a334d2279fabb63943c90614a7acfaf6ad` (3 commits), app 0.126.0→0.127.0, Issue #734 PR #759는 `behind=3/mergeable=false`인 **별도 merge-base drift**가 발생했다. #732의 신규 Milestone Dashboard·관리·테스트·문서/0.127.0은 보존하고 #734 후보를 **0.128.0 MINOR**로 재정렬한다. 변경 source/새 exact PR Head의 실제 local TypeScript/Vitest/Chromium/Docker 실행은 NOT TESTED이며 이전 PASS를 이관하지 않는다.
- 문서 영향: 동일 Issue 실패 원장과 Work Packet, 최신 TEST_PLAN/PLAN, 양쪽 CHANGELOG/UX/API 등 동기화. 신규 #732를 삭제/대체하지 않음. GSC-01/03/07/08/09/11, 기존 권한/원본 편집 및 readonly, #730 인접 + #734 전용 및 #735 System/#732 Milestone 소비자를 Full PR 6-shard 영향 범위에 포함한다.
- 보완 검증 인계: GitHub 원본 job log vs source/동일 query 계약의 **정적 분석만 수행**, 실제 Node/Chromium/SQLite/Docker는 로컬 GitHub DNS/checkout 부재로 **NOT TESTED**. 새 source가 검증되기 전 출시나 정식 GHCR 승인 없음; `HIGH/OWNER_MANAGED`, `release_required=true`, `release_authorized=false`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`.


## 7. F734-005 — Full PR CI #3070.1 Assignment 저장 후 Editor ready 관측 경합 (2026-10-20 UTC)

### 원본 Run/Job/실제 실패

- [Full PR CI #3070.1, Run ID 39496115287](https://github.com/planner77/masterGantt/actions/runs/39496115287), Attempt 1, event pull_request, PR #759 Head `6a78648a56d476b63e05363000b66ba0abc9a5a7`, Base main `5ffe02a334d2279fabb63943c90614a7acfaf6ad`. 실제 test-merge SHA는 독립 GitHub 원본 조회 전 **UNKNOWN**. 시작 `2026-10-20T20:55:28Z`; 전체 FAILURE.
- QA Preflight `118881632396`, TypeScript `118881776933`, ESLint `118881777118`, Vitest `118881776827`, Policy `118881776834`, Fast Gate `118882589242`, Next Production Build `118882733847`, Docker smoke `118882733723` 모두 SUCCESS. Required Quality `118883581224`, Docker `118883993548` SUCCESS. E2E required `118887745995` FAILURE와 QA Final `118887795869` FAILURE(`required e2e 미성공` 파생 차단).
- 실제 실패 [Chromium Shard 1, job 118882733867](https://github.com/planner77/masterGantt/actions/runs/39496115287/job/118882733867): `tests/e2e/issue-734-equipment-dashboard.spec.ts:137`의 `#734 정확 Task·Assignment 원본 취소와 일정 복귀는 경로·focus를 보존한다` 테스트. `2026-10-20T21:08:02Z`, line 153 `getByRole('dialog',{name:'작업 정보'}).getByRole('button',{name:'할당 저장 (1)'}).toBeEnabled()` → **Expected enabled / Received disabled / Locator assertion timeout 5000ms**. **14 PASS / 1 FAIL / 139 NOT RUN** (총154 test). 해당 테스트 실행 약41.6s이며 Playwright 전체 120s Test Timeout이 아님. [Playwright artifact 12297204517](https://github.com/planner77/masterGantt/actions/runs/39496115287/artifacts/12297204517) 원본 저장, Trace ZIP 재생 **NOT TESTED**.
- 다른 Shard2(job `118882733662`) 개별71 PASS, Shard3(`118882733742`) 45 PASS, Shard4(`118882733806`) 37 PASS, Shard5(`118882733741`) 28 PASS, Shard6(`118882733825`) 32 PASS 후 모두 **CANCELLED**. 원본 로그에서 별도 직접 assertion FAIL 미관찰. 이들 Shard 전체 PASS·#730 수정 case 종단 검증을 단정하지 않는다.

### 직전 F734-001~004 전체 대조·가설/보완

| ID·Run | 과거 원본 실패 | 이 Run의 후속 증거 |
| --- | --- | --- |
| F734-001 #3058.1 | 272자 설비명 API400 | #3070.1은 해당 5폭 case에 도달하지 못함. #3061.1·#3064.1·#3066.1 개별 PASS 이력 보존 |
| F734-002 #3061.1 | 공유 인스턴스 편집 승인 누락 후 PATCH wait120s | #3064.1 개별 PASS; #3070.1 후단 미실행 |
| F734-003 #3064.1 | #730 인접 구형 ARIA 총계 locator180s | #3066.1/#3070.1 해당 Shard6은 취소/후단 미실행; 교정 source 존재하나 새 Full 최종 성공 UNKNOWN |
| F734-004 #3066.1 | Page.Response 본문 navigate-away CDP 소실 | 새 source는 저장/확인 후 별도 API read-only 재조회로 교정; #3070.1 해당 후단 미실행 |
| **F734-005 #3070.1** | Assignment PUT 응답 직후 버튼 disabled (5s) | 이번 교정 후 신규 exact-Head real Chromium NOT TESTED |

**분류: FIXTURE_OBSERVABILITY / POST_MUTATION_READINESS**. 실제 `PUT /tasks/{taskId}/assignments`의 response.status **200을 관측**한 후 곧바로 `할당 저장(1)` 버튼 활성화를 검사했으나, `TaskAssignmentEditor.save`는 HTTP 응답 이후에도 `await onApplied() → ProjectTaskEditor.reload(true) → onReload(fetchCanonicalSnapshot) → revision/target/catalog 재조회 → ready` 단계를 가진다. 해당 5초 동안 UI가 disabled였다는 사실은 확정이나 **정확히 어떤 단계가 완료되지 않았는지/제품에 지속 lock 결함이 있는지는 원본 Trace 재생 없이 UNKNOWN**. 빠른 응답을 UI 동기화 완료로 등치한 테스트의 완료 판정이 취약하다. 이론상 렌더·재조회 부하에 노출되며 41.6초 실행으로 전체 120초 Test/35분 Job 부하 실패라고 결론 내릴 근거는 없다. git shallow fetch의 GitCommitInfo 3s 경고는 테스트 진행을 막지 않았다.

**보완:** 해당 Test는 저장 전 **실제 Project revision**을 보관하고, PUT200 뒤 별도 `f.snapshot()`으로 **revision 정확히 +1**, 같은 Assignment ID·allocation.percent **정확히 50%**를 확인한다. 이어 실제 작업 Editor 헤더 `Revision {newRevision}`, 해당 Resource 투입률 값 `50`, 기존 `할당 저장(1)` 버튼 활성화를 **순차 확인**한 후 Escape/원본 Focus/일정 왕복을 유지한다. UI를 조기 활성화시키거나 강제 reload/retry·sleep으로 성공을 만들지 않으며 5초 button oracle 자체를 제거하거나 증가시키지 않는다. 신규 관측이 실패하면 실제 canonical/editor/selector 상태를 조사해야 한다. 전체 Test 120s/6Shard/Required3/fail-fast 변경 없음; Shard 재분배는 직접 해결책이 아니다.

**누적 실패:** Issue #734 PR #759의 실제 Direct FAIL **5회/5 Full Runs** (#3058.1,#3061.1,#3064.1,#3066.1,#3070.1), **2 test files / 4 unique test cases** (`issue-734-equipment-dashboard.spec.ts`: 5폭, 설비 원본 저장, Task/Assignment 원본 취소·복귀; `issue-730-view-composer.spec.ts`: 인접 고유총계/원본 복귀). 같은 case의 F734-002/F734-004는 각각 별도 Run/원인으로 보존한다. 미실행은 모두 NOT TESTED.

**상위 변경:** #736/PR #760 main 병합으로 현재 main `1c1938851aa8234febcba404f4007d6c94fb2233` / app0.128.0, 이전 main `5ffe02a334d2279fabb63943c90614a7acfaf6ad` 대비 +5commit; #734 Branch는 behind5, PR mergeable=false. #736의 Resource root/Plan·Excel·공통 WBS DTO/consumer/서비스·문서를 모두 보존하면서 #734 독립 설비 기능을 통합하고 후보 app version을 **0.129.0 MINOR**로 조정한다. Source 경계 소유권: #736 Resource 선택/Excel adapter는 #736, #734 equipment metadata/유형 filter는 #734; 공통 DTO/reader·ResourceDashboardService·UI consumer seam에서는 두 선택 계약을 독립 보존한다. #736 프로젝트 Excel writer나 허용 Root 정책을 전역 변경하지 않는다.

**검증·인계:** 신규 candidate Source의 로컬 Node/TS/Vitest/real Chromium/SQLite/Docker는 현재 connector-only checkout 불가로 **NOT TESTED**. 원격 Source/로그와 Git Data blob/tree·PR 리뷰·Main ref의 정적 계약 분석만 수행한다. #734 8개 전용, #730 원본/response inversion, #732 Milestone/#735 System/#736 Resource/Excel, 기존 #729 원장·GSC-01/03/07/08/09/11 및 권한/readonly/409/412 등 부정 소비자를 새 Full CI 6 Shard에 보존하고 이후 결과는 모니터링하지 않는다. Owner HIGH/OWNER_MANAGED, release_required=true/release_authorized=false, manager_decision=NOT TESTED, MERGE_READY=BLOCKED. 새 Head Required3·QA·Owner 수용 전 merge/Main/GHCR/Issue 종료 없음.

## 8. F734-006 — Full #3074.1 인접 #717 정확 원본 GET 전송 초기화 (2026-10-21 KST)

### 원본과 실제 실패 (이전 F734-001~005 보존)

- **귀속:** Primary Issue [#734](https://github.com/planner77/masterGantt/issues/734), [PR #759](https://github.com/planner77/masterGantt/pull/759). [Full PR CI #3074.1, Run 39509862644 / Attempt 1](https://github.com/planner77/masterGantt/actions/runs/39509862644), `event=pull_request`, Full FAILURE. Branch `feat/issue-734-equipment-dashboard`, Head `1dd588c8850df026561e1ad03236ccaf7d0837dd`, 당시 Base `1c1938851aa8234febcba404f4007d6c94fb2233`, test-merge `a456549452633dbbd4330eea3582cfe95221e926` (Git data verified parents [Base, Head] and Head와 동일한 Tree `ff7f84967d24d2ae092be238ec9187cf88a4b600`). PR source artifact `12305076132` 및 GitHub jobs 원본 확보.
- **직접 실패:** [Chromium shard3 Job 118928688588](https://github.com/planner77/masterGantt/actions/runs/39509862644/job/118928688588)에서 `tests/e2e/issue-717-identity-persistence.spec.ts:10`, test '#717 실제 HTTP·SQLite에서 동명 Milestone·공정의 정확한 식별자 편집·삭제·readonly 복사'. `getSnapshot()` line21의 `page.request.get(/api/projects/{publicId})`가 milestone PATCH200 뒤 line76에서 **`apiRequestContext.get: read ECONNRESET`**. UTC `2026-10-20T22:53:59Z`, 해당 test 약9.4초, Shard3 50 PASS / 1 FAIL / 57 DID NOT RUN, 원격 전체 job 실측 약10.4분. 120초 Test Timeout 또는 35분 Job Timeout이 아니다.
- **원본 보조 증거:** [Playwright report/Trace artifact 12305492687](https://github.com/planner77/masterGantt/actions/runs/39509862644/artifacts/12305492687)의 `isolated-application-diagnostics`에서 fail 시 격리 Next 부모 프로세스 생존, health GET HTTP200, cgroup OOM/oomKill=0, 앞선 PATCH200 및 응답 완료 확인. 원인 GET에 대한 정상 HTTP 완료 로그 없음. 이는 서비스 전체 사망·명백한 OOM의 반례이지만 정확 TCP reset 주체, 일시 route compile/reset 여부는 **UNKNOWN**; 제품 자체가 원인이라는 확정 근거도 없음. Job 로그에 `1 error was not a part of any test`도 있어 같은 E2E test 실패를 추가 제품 실패로 중복 집계하지 않는다. Trace의 민감 쿠키/원본 로그는 Git 저장소에 복제하지 않는다.
- **다른 Shard:** PR matrix fail-fast에 따라 1/2/4/5/6 [Jobs 118928688446, 118928688433, 118928688436, 118928688695, 118928688475]는 **CANCELLED**; 원본 로그에서 별도 assertion FAIL 미확인. 부분 실행을 완료 PASS로 해석하지 않음. TypeScript `118928147868`, ESLint `118928147858`, Vitest `118928148049`, 정책 `118928148091`, Fast Gate `118928620912`, PR Build `118928688384`, Docker smoke `118928688480` 모두 SUCCESS. Required Quality `118929186862`, Docker `118929588443` SUCCESS, E2E `118933119740` FAILURE, QA Final `118933149576` FAILURE는 필수 E2E 미성공의 파생 차단.
- **분류:** `INIT_TRANSPORT / ENVIRONMENT_OR_FIXTURE_OBSERVABILITY`(confirmed: GET ECONNRESET; root cause UNKNOWN). #735의 Context Menu 브라우저 canonical GET 전송 초기화 사례는 다른 Issue에서 발생한 유사 증상으로 참고만 하고 #734 성공/실패로 중복 집계하지 않는다. 실제 비정상 status HTTP500/401/412, 잘못된 JSON, revision·Task/Milestone ID 불일치가 발생했다는 증거는 없다.

### 보완 결정과 기존 다섯 실패 교차 매트릭스

| 누적 ID·Run/Attempt | 실제 최초 실패 | 종전 교정·이번 source의 범위 |
| --- | --- | --- |
| F734-001 `39438998422.1` | 설비명272자→API400 | 200자 fixture/5폭 유지, #3061에서 해당 case PASS |
| F734-002 `39482448255.1` | 공유 원본 편집 승인 누락→120초 PATCH wait | 실제 사용처 확인·취소/재확인 후 PATCH, #3064에서 해당 case PASS |
| F734-003 `39485897399.1` | #730 이전 총계 aria-label→180초 locator | 최신 설비 고유총계 선택자·기존 Task oracle 유지 |
| F734-004 `39490390734.1` | Browser Response body/CDP 소실 | 저장 후 별도 read-only canonical HTTP 조회 유지 |
| F734-005 `39496115287.1` | Assignment PUT200 직후 Editor ready 5초 경쟁 | Revision+1·Assignment ID/50% 후 정확 Editor/focus 검증 유지 |
| **F734-006 `39509862644.1`** | 인접 #717 정확 snapshot GET에서 ECONNRESET | #717 테스트 helper의 **GET에만** Playwright `maxRetries:1` 사용, HTTP 오류·원본 불변 검증 유지; 원격 새 Head 결과 **NOT TESTED** |

- **한정적 보완:** `tests/e2e/issue-717-identity-persistence.spec.ts`의 `getSnapshot`에 `page.request.get(api,{maxRetries:1})`만 적용. 공식 [Playwright APIRequestContext.get](https://playwright.dev/docs/api/class-apirequestcontext#get-option-max-retries)는 오직 `ECONNRESET` 전송 오류를 최대1회 다시 시도하고 HTTP 오류코드를 재시도하지 않는다. 여기서는 성공한 **PATCH를 재실행하지 않으며**, GET이 두 번 모두 실패하면 즉시 오류, HTTP200 strict status·JSON·revision+1·동명 Milestone/공정 identity·readonly mutation0·copy/focus·삭제/동료 불변 단언 모두 기존 그대로 실패한다. 120초 Test budget, shard6·worker1·35분 Job, CI Retry/skip/fail-fast/Required3, 제품 API/DB/Auth 코드 수정 없음. 오직 transport에 국한된 수습이며 지속 ECONNRESET이면 Trace/PID/port/Network 오류와 기존 #735 경로 비교 등 근본 진단을 추가한다.
- **테스트 부담/선택:** 이번 최초 실패는 9.4초이며 Shard3 10.4분이므로 장기 단일 테스트/35분 한계가 아님. 제안된 재분배는 원인과 무관. 반면 최신 main #732는 별도로 35분 Shard 부하를 분석하여 `tests/config/e2e-shard-plan.json`의 135 spec 전부 명시 및 관련 #621/#622 편집 준비 계약을 교정했으므로 이 source 통합에 해당 main 변경을 전부 보존한다. #734 8case, #730 1case 및 #717 이 case, #735/#732/#736/#621/#622/#623와 stale/401/412/readonly·Gantt focus/원본을 새 Full CI 6 Shard 교차 범위에서 제외하지 않는다.
- **이력 귀속:** 누적 실제 실패 = **6 Full Run/Attempt**, **3파일/5고유 테스트 케이스**: `issue-734-equipment-dashboard.spec.ts` 3case(원본 저장 case 두 원인), `issue-730-view-composer.spec.ts` 1case, `issue-717-identity-persistence.spec.ts` 1case. 이전 다섯 항목은 원본 FAIL 및 각 후속 일부 PASS/NOT RUN 그대로 보존. 본 ledger만 Primary #734 원본 실패로 기록하고 #717/#732 원장에 본 PR Run을 별도 소속 실패로 중복 생성하지 않음.
- **검증 및 감사:** 연결 GitHub 원본 Job+artifact·Source/HEAD/Base/tree와 Playwright 공식 문서 비교는 수행, 로컬 full checkout/npm/TS/Playwright/SQLite/Docker는 환경 내 원본 실행 조건 부재로 **NOT TESTED**. Source·문서 변경은 새로운 exact Head의 Quality/E2E6/Docker/Trusted QA 결과가 나올 때까지 **NOT TESTED**; 원본 성공 결과와 새 Head 성공 결과를 혼동하지 않는다.
- **최신 main 충돌 조정:** #732 후속 main `62e715adbc3f497e319918306bf26cbdd73353b7` (base `1c1938851aa8234febcba404f4007d6c94fb2233` 대비 +4 commits)의 135-spec shard plan, #621/#622 readiness 및 #732 failure/Work Packet/TEST_PLAN append를 #734 기능·원장과 합치는 **non-force two-parent merge**. `docs/TEST_PLAN.md`은 각각의 독립 추가를 모두 보존. `0.129.0` 후보/다른 Issue 원장·시스템/리소스/Milestone 기능은 임의 삭제·재버전하지 않는다.
- **인계/게이트:** 리뷰 스레드 두 건 resolved(미해결0)이며 새로운 PR synchronize 후 다시 확인. 원격 PR head=base 정렬/충돌없음은 실제 commit/ref 기준 검증; 로컬 정적 source 외 테스트 PASS 주장은 하지 않는다. HIGH/OWNER_MANAGED, `qa_required=true`, `release_required=true`, `release_authorized=false`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`. 새 exact Head Full PR CI 시작까지만 수행, 자동 진행 결과 모니터링·PR merge/Main/GHCR/Release/Issue close 모두 미수행.


## 9. F734-007 — Full #3078.1 main 통합 후 신규 E2E 명시 배치 누락 (2026-10-21)

### 원본 출처·직접 실패·파생 차단

- [Full PR CI #3078.1](https://github.com/planner77/masterGantt/actions/runs/39517277420), Run `39517277420`, Attempt `1`, `pull_request`, 시작 `2026-10-20T23:47:28Z`, FAILURE. PR #759 Head `c1a7e52b6b88932af96a7717af2a7ff176cdf849`, Base `62e715adbc3f497e319918306bf26cbdd73353b7`, test merge `78f379e6277f50a64dfea11d6847c52f91945a35`. 원본 [ci-pr-source artifact 12308505957](https://github.com/planner77/masterGantt/actions/runs/39517277420/artifacts/12308505957)의 v1 JSON·checkout 로그·Git commit API에서 부모 `[Base, Head]`와 Head/merge 동일 Tree `dd8ffe426175f53749ca695d972917b262938ecc`를 교차 확인했다.
- 직접 실패 [Vitest job 118952547800](https://github.com/planner77/masterGantt/actions/runs/39517277420/job/118952547800): `tests/scripts/e2e-shard-planner.test.ts:106:33`, `requires explicit, unique placements for every current browser spec after #732 Main timeout`. `2026-10-20T23:49:12Z`, 배치표 **135**개와 실제 발견 **136**개의 strict equality 실패. 유일한 누락은 `tests/e2e/issue-734-equipment-dashboard.spec.ts`. 원격 Vitest **3159 PASS / 1 FAIL / 3 SKIPPED**, 258파일 중 256 PASS/1 FAIL/1 SKIPPED, 45.87초.
- QA Preflight `118952440192`, TypeScript `118952547991`, ESLint `118952547886`, 정책 `118952547875` SUCCESS. Fast `118952956881`은 `UNIT_RESULT=failure`; Required Quality `118953031218`, Docker `118953031292`, E2E `118953031433`은 Fast 실패로 파생 FAILURE. QA Final `118953067539`의 `required quality 미성공`도 파생 차단이다. 실제 build/Docker/E2E 구현은 **SKIPPED**이며 E2E assertion 재실패나 세 독립 제품 결함으로 집계하지 않는다.

### 전 이력 교차 진단과 보완

원장 모든 절·Issue #734 진행 댓글·PR #759의 접근 가능한 7 Full Run/Attempt를 대조했다. 이전 기록을 삭제하거나 당시 미실행을 PASS로 바꾸지 않는다.

| 실패 ID·Run/Attempt | 원본 직접 실패·기존 교정 | 현재 후보의 교차 검증·잔여 범위 |
| --- | --- | --- |
| F734-001 `39438998422.1` | 272자 이름 HTTP400 → 정확 200자 fixture | #734 5폭/overflow/keyboard case 포함 |
| F734-002 `39482448255.1` | 원본 공유 사용처 승인 누락 → 취소·재확인·승인 후 PATCH | #734 원본 dirty/저장 case 포함 |
| F734-003 `39485897399.1` | #730 이전 총계 locator → 현재 설비 접근성 라벨 | #730 파일 전체 포함 |
| F734-004 `39490390734.1` | navigate-away Browser Response body 소실 → 동일 query 별도 읽기 전용 API | #734 원본 저장/Revision/snapshot case 포함 |
| F734-005 `39496115287.1` | Assignment PUT200 직후 editor ready 경합 → canonical+1/같은 ID50%·editor ready | #734 정확 Task/Assignment/복귀 case 포함 |
| F734-006 `39509862644.1` | #717 canonical GET ECONNRESET → 해당 GET에만 transport 재시도1 | #717 파일 포함; TCP reset 근인은 계속 UNKNOWN |
| **F734-007 `39517277420.1`** | #732 main 통합 후 신규 #734 spec 배치 누락 | 기존 strict 회귀로 로컬 동일 FAIL 재현 후 배치·고정 shard 회귀 교정 |

- **가설과 반증:** (1) main 통합에서 branch 신규 파일 누락, (2) 탐색 기준 불일치, (3) 중복 배치를 검토했다. 실제 파일/plan 차집합은 missing `issue-734-equipment-dashboard.spec.ts` 하나, extra0/duplicate0. 동일 로컬 기존 검사에서도 135 vs136으로 재현되었으며 배치 한 건 추가 후 동일 검사가 PASS했다. 따라서 분류는 `POLICY_CI / INTEGRATION_SHARD_PLAN_COVERAGE`; 전송 오류·Timeout·제품 API 결함이라는 근거는 없다. 별도 계측을 추가할 필요 없이 기존 strict 검사가 실제 seam을 재현하므로 임시 계측/새 중복 테스트는 만들지 않았다.
- **보완:** `tests/config/e2e-shard-plan.json`에 #734 8-case spec을 **shard6 한 곳**에 명시했다. 기존135개 배치·#732/#733 수동 배치 이력과 14-run historical metrics는 보존한다. #732 postPr3072의 이전 추정24.2분인 shard6은 shard2/3/4/5보다 여유가 있었으나 신규 setup/runtime 비용은 미측정이므로 성능 개선·35분 이내 성공을 보장하지 않는다. 새 `issue734ExplicitPlacement`에 근거/신규 비용 미검증을 기록한다. 기존 projectedMs를 새136개 예측값으로 조작하지 않는다.
- `tests/scripts/e2e-shard-planner.test.ts`는 발견파일과 정확히 같은 유일 배치·모든6 shard 보존·stale plan에서 신규파일 누락 금지·잘못된 shard/중복 거부를 유지하고 #734→6 고정 배치도 검사한다. strict 검사를 제거하거나 누락을 허용하지 않는다. Workflow/Required3/6-shard/worker1/35분·retry/skip/fail-fast 및 제품/API/Auth/Gantt/DB/버전0.129.0은 불변이다.
- **누적 실제 실패:** 7 Full Run/Attempt, **4파일/6고유 case**. 합집합은 `tests/e2e/issue-734-equipment-dashboard.spec.ts`(3case, 서로 다른 원인 재실패 포함), `tests/e2e/issue-730-view-composer.spec.ts`(1), `tests/e2e/issue-717-identity-persistence.spec.ts`(1), `tests/scripts/e2e-shard-planner.test.ts`(1). 취소·SKIPPED·NOT RUN은 별도 실제 FAIL로 더하지 않는다.

### 동일 후보 검증·문서·인계

- 로컬 원본 재현: `npx vitest run --config tests/config/vitest.config.ts tests/scripts/e2e-shard-planner.test.ts` → **1 FAIL/5 PASS**, 원격과 동일 missing-file diff. 보완 후 같은 검사 포함 scripts4파일 + `tests/server/resources` + equipment consumer, 총 **31파일354건 PASS**. 명령: `npx vitest run --config tests/config/vitest.config.ts tests/scripts/e2e-shard-planner.test.ts tests/scripts/e2e-shard-optimizer-pr.test.ts tests/scripts/test-config-layout.test.ts tests/scripts/e2e-read-only-requests.test.ts tests/server/resources tests/features/resources/equipment-dashboard.test.ts`. 기존 빈 systemIds×unknown type 거부·동명 유형 식별 회귀도 포함한다.
- 누적 브라우저 실패 합집합은 fail-fast 없는 Chromium worker1/retry0/max-failures0으로 **3파일15case**를 선정했다. #734 8case + #730 6case + #717 1case이며 각각 실제 격리 HTTP/SQLite fixture를 사용한다. 공용 `PLAYWRIGHT_BASE_URL` 지정은 fixture를 external 모드로 바꿔 ECONNREFUSED15건을 만든 **잘못된 로컬 harness**였으므로 제품/원격 실패로 합산하지 않는다. 변수를 제거하고 공식 config를 import한 임시 wrapper로 격리 fixture를 재실행했다. `defineConfig(config,{webServer:undefined})`는 상속 bootstrap을 실제 제거하지 않아 공식 공용3100 서버도 정상 시작되었으며 각 case는 여전히 별도 port/DB/dist의 실제 격리 fixture를 사용했다. 본문·timeout·단언은 변경하지 않는다. 최종 결과는 아래 검증 기록에 추가한다.
- 직접 CI 배치 생산자/소비자는 planner·선택 CLI·config layout·전체 발견파일 inventory이다. 기존 실패3개 E2E파일과 #734 server/consumer 및 읽기 전용 음성검사를 확대했다. #732/#735/#736 전체 화면·전체 Vitest/6-shard/Docker·운영환경 검증은 새 GitHub CI/별도 환경에 맡기며 로컬 부분 성공으로 대체하지 않는다.
- DOCUMENTATION_SYNC: 본 단일 원장·Work Packet·TEST_PLAN·CI_CD·REMOTE_VALIDATION 갱신. DESIGN.md와 제품 UX/API/schema/보안·CHANGELOG는 이번 correction에서 새 제품 계약/버전이 없어 추가 변경 N/A. PR metadata 본문만의 수정으로 불필요한 metadata-only CI를 만들지 않는다.
- 새 정확 Head Required3·Trusted QA·Owner 최종 ACCEPT는 **NOT TESTED**, `risk_level=HIGH`, `qa_required=true`, `qa_method=OWNER_MANAGED`, `release_authorized=false`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`. 별도 infra 원본 분석·frontend 실제 재검증·qa_docs 사전 검토는 최종 Owner 수용을 대신하지 않는다. 미해결 리뷰/최신main 충돌을 확인한 뒤 같은 PR synchronize Full CI 시작까지만 수행하며 결과 모니터링·병합/Main/GHCR/Release/Issue 종료는 수행하지 않는다.

- 추가 로컬 정적 검증: `node scripts/check-markdown-links.mjs` **287문서 PASS**, `node scripts/verify-test-discovery.mjs` **258 Unit파일/790 browser tests, root·외부cwd 동일 발견 PASS**. 기본 브랜치 검증기의 `docs_gate`를 현재 변경파일/AC1~5에 적용하여 **STRUCTURAL_PASS_SEMANTIC_REVIEW_PENDING / MAPPING_PASS_SEMANTIC_REVIEW_PENDING**을 확인했다. 이는 의미 QA나 Trusted PASS가 아니다.
- 자동 `npm run verify:prepr -- --mode=fast --base=origin/main --issue=734 --risk=HIGH`는 **BLOCKED, UNKNOWN5/missing0/실제step0**. DTO·host·snapshot repository/projection·shard config의 자동 producer→consumer 매핑 부족이며 `.prepr-reports/2026-10-21T00-02-32.779Z-1301617-c05f6d85/SUMMARY.md`에 보존한다. DTO/metadata는 #734 server/consumer, projection은 resources server, shard config는 planner/config-layout/발견검사, 실제 host/저장·복귀는 누적3파일 Chromium으로 수동 연결한다. 미선정 전체 Gantt/운영/6runner는 NOT TESTED이며 도구 판정을 강제 PASS로 변경하지 않는다.
- 별도 qa_docs 사전 검토에서 **기존135개 이동0/누락0/extra0, 현재136 unique, #734→6** 및 단언/정책 불변을 확인했고 scripts4파일49검사를 독립 재실행해 PASS했다. 최종 브라우저 결과·자동 생성 config 복원·fingerprint와 최신 리뷰/main 재확인이 남아 있어 Owner 최종 QA/승인으로 보고하지 않는다.

- **과거 출처 보강(당시 UNKNOWN 기록 보존):** F734-005 Run `39496115287.1`의 [원본 source artifact 12298121453](https://github.com/planner77/masterGantt/actions/runs/39496115287/artifacts/12298121453)와 실패 job `118882733867` checkout·Git commit API를 이번에 추가 조회했다. 정확 test merge는 `d26c78075f133e11b6b52c273861a2a3bfd5900d`, 부모 `[5ffe02a334d2279fabb63943c90614a7acfaf6ad,6a78648a56d476b63e05363000b66ba0abc9a5a7]`, merge/Head 동일 Tree `7d01dc10416efc8a2e0d3f04dc5ffc890a22834a`임을 확인했다. 당시 F734-005 실패/미검증 결론은 변하지 않는다.

- **다음 재실패 대응:** 같은 배치 검사가 재실패하면 먼저 실제 CI checkout SHA/plan blob·발견파일 차집합과 이번 게시 source의 일치를 확인하고 누락/중복을 보완한다. 이미 전부 명시되어 있는데 같은 차이가 반복되면 작업 디렉터리·파일 생성/탐색 경계를 진단하며 검사 우회/무수정 rerun은 하지 않는다. F734-006 GET reset이 제한적 재시도 후 다시 발생하면 기존 UNKNOWN 근인을 서버 PID/port/health·cgroup·실제 요청 trace로 조사하고 재시도 횟수를 더 늘리지 않는다. 신규 shard6이 35분 한계에 걸리면 원본 job/test별 실제 시간을 수집해 별도 배치 근거로 사용하며 기존 추정을 성공 증거로 쓰지 않는다. 어떤 후속 실패도 이 원장에 새 Run/Attempt/Head와 전체 실패 합집합을 누적한다.


### F734-007 최종 로컬 결과 및 source 동결

- 실제 Chromium 누적 합집합 **3파일15case PASS / FAIL0 / SKIP0**, session82572 exit0. UTC `2026-10-21T00:01:23.859Z`~`00:08:39.323Z`, wall435.464초/Playwright7.1분, case body합272.501초. 명령: `npx playwright test --config .prepr-reports/issue-734-cumulative/playwright.local.config.ts --project chromium --workers 1 --retries 0 --max-failures 0 tests/e2e/issue-734-equipment-dashboard.spec.ts tests/e2e/issue-730-view-composer.spec.ts tests/e2e/issue-717-identity-persistence.spec.ts`. #734 8/#730 6/#717 1 전부 실행했으며 F001~006의5고유 직접 실패 case도 이번 로컬에서 PASS했다. 과거 원격 FAIL/UNKNOWN 근인을 소급 변경하지 않는다.
- 증거는 ignored `.prepr-reports/issue-734-cumulative/{execution.json,playwright.log,timing.json}` 및 HTML report/generated-output에 보존했다. 시작/종료 E2E SHA256은 #734 `81153dcff9fcd72d2e60d22be9f1b31c135417bfede7c3259fb6e037aa35606a`, #730 `349a81f1e07178d681e206cce3498ca2d22f858c1a76c79e313e9a7015adaaa5`, #717 `d816afa74cd9877f0829ce35ad17c336e9cfee25f9039b40babacf0853e6295d`로 동일했다. 제품 src/기존 E2E 수정0. 보완 config SHA256 `4a6d3ca9b92ea8a8e850eb7bf7059219740345d9dd1fb0c3862cda61bf4c6f1b`, planner test `78eea1ce06e49047c0cbfd1c8478a0ccca663adedc55f1b32f547910fd032448`.
- 자동생성 next-env.d.ts/tsconfig.json UUID 경로 및 tracked #730 PNG5/JSON5를 원본과 대조·복원했다. 복원 뒤 `npm run typecheck`, scoped `npx eslint tests/scripts/e2e-shard-planner.test.ts`, `git diff --check` 모두 exit0. source1062파일 최종 manifest `.prepr-reports/issue-734-cumulative/final-source-manifest.json` SHA256 `3ac2ae9377ffdd6468257af8f6d0995b57e6eb339d40536a2b8ca5625cf593d4`를 기록했다. 문서만의 후속 갱신은 행동 검증 source를 바꾸지 않는다.
- **로컬 증거 보존 예외:** 기존 미추적 `output/playwright/issue-734/equipment-{390,768,1024,1440,1920}.png` 5장은 테스트가 같은 경로로 갱신했다. 사전 개별 백업을 하지 않아 이전 이미지는 복원할 수 없다. 기존 browser-run 로그/source-before.json/attempt-1은 보존했고 갱신된 PNG도 삭제하지 않고 ignored generated-output에 복사했다. 사용자에게 이 사실을 알렸으며 새 이미지로 이전 실행 증거를 주장하지 않는다. Git 게시 대상에 이 출력들은 포함하지 않는다.
- 사전 remote 재확인에서 main `62e715adbc3f497e319918306bf26cbdd73353b7`이 branch 조상이고 PR mergeable=true, 기존2스레드 resolved/미해결0였다. 새 게시 시에도 exact ref/tree와 리뷰/충돌·CI 생성만 재확인한다. 로컬354 Unit/통합+15 Chromium PASS 및 사전 검토 PASS는 새 Head Required3/Trusted QA/Owner ACCEPT가 아니며 이들 원격 결과는 계속 **NOT TESTED**다.
