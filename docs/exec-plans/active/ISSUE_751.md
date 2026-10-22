# Issue #751 — E2E performance work packet

Status: IMPLEMENTED / NEW-HEAD REMOTE ACCEPTANCE NOT TESTED; before-after measurements INSUFFICIENT_DATA as of 2026-10-19. The historical #3021.1 Full PR CI and #663.1 Trusted QA did PASS on older HEAD 4ea36f4c; this evidence cannot be reused on changed source.

- Primary Issue: https://github.com/planner77/masterGantt/issues/751 ; failure ledger: ../../ISSUE_751_FAILURE_ANALYSIS.md
- CI provenance: Run ID/attempt/checkout SHA (not assumed PR HEAD), stable test ID, project, retry, shard, Node and OS.
- Monotonic stages: SQLite migrate, server readiness, Next warmup, dynamic route warmup, fixture startup/restart, teardown, #623 seed stages.
- Browser network requests and observed fixture API requests: allowlisted endpoint category only, method, relative time, duration, status, abort/network/timeout; no URL, query, ID, headers, token, cookie or raw Trace in new artifact. Browser events do not include all page.request context calls.
- Timing reporter now aggregates receipt on failures too; existing 30-day e2e-timing CI Artifact stores JSON. Job Summary uses warning-only provisional 80%, no new merge gate; >=10 successful matched samples required to calculate P50/P95.
- Distinct 60s test body and 120s fixture timeouts; old #730 trace Before Hooks 14.6797s and body 59.97s are not summed. Test residual body timing is not independently measured for all tests.
- Added tests/scripts/issue-751-performance-receipt.test.ts synthetic success, HTTP 503, abort, timeout, privacy and monotonic fixture/seed coverage. The genuine Chromium/Next/SQLite run and cleanup remain NOT TESTED.
- Added read-only manual workflow_dispatch issue-751-performance-trend.yml and authenticated scripts/issue-751-performance-trend.py collector for last retained successful main-run timing artifacts. It is not operational on default main until merged, and the history may still be INSUFFICIENT_DATA.
- Outstanding: direct server SQL query/lazy compile/fan-out causal attribution, genuine failure injection and cleanup repetition, identical-control baseline before/after metrics, official original Trace intersection. The added local HAR sanitizer does not establish the original HAR evidence without a real trace capture. No claims of improvement/PASS until evidence.
- New source local TypeScript/ESLint/E2E and Full PR 3 required checks/Trusted QA: NOT TESTED. High-risk OWNER_MANAGED; release_required=false, release_authorized=false; no merge/GHCR without Owner approval.

- Added a bounded local HAR converter and unit regression tests for secure timing/error category extraction; it is a manual evidence utility, not proof of tested production requests.

## DOCUMENTATION_SYNC

- `DESIGN.md`: N/A(기존 Keyboard/Focus·scope 보존 원칙의 비동기 복귀 세칙 구체화; Design Delta B로 UI_UX_GUIDELINES에 기록)
- `docs/API.md`: N/A(공개 HTTP endpoint/응답 계약은 불변이며 서버 내부 E2E 로그 필드만 선택적으로 추가)
- `docs/DB_SCHEMA.md`: N/A(SQLite migration 및 영속 테이블·인덱스·Query 의미 변경 없음)
- `AGENTS.md`: N/A(기존 Issue Lifecycle 보호 규칙과 OWNER_MANAGED/QA 승인 절차 불변)
- `docs/QA_REVIEW_POLICY.md`: N/A(독립 검증 및 세 Required aggregate 의무와 운영 게이트를 변경하지 않음)
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: N/A(새 토큰이나 저장소 권한·Issue 병합 및 릴리스 절차 도입 없음)
- `docs/REMOTE_VALIDATION.md`: UPDATED

## AC_TEST_COVERAGE

- AC1: src/server/db/e2e-sql-observer-core.ts, src/server/http/request-context-core.ts, src/server/db/database.ts는 격리 개발 서버에서만 SQL 실행 횟수/시간/실패를 요청별 수집한다. tests/e2e/fixtures/isolated-application*.ts와 isolated-performance-receipt.ts는 Stage/Route/API/서버 합계를 기록하며 브라우저 동시 요청과 DB 시간을 단순 합산하지 않는다. tests/server/db/issue-751-sql-observer.test.ts 및 #623 기존 7개 E2E(Timing phase 보존), tests/config/e2e-timing-reporter.cjs, Python Trace 정제 테스트가 출처·민감정보를 검증한다. 다음 HEAD 실제 CI 결과는 NOT TESTED.
- AC2: tests/e2e/issue-751-performance-telemetry.spec.ts에서 독립 Next/SQLite 인스턴스를 실제 실행해 정상/90ms 지연/HTTP503/네트워크 중단/명시 취소 Browser 이벤트와 읽기 전용 서버 응답을 검증한다. tests/scripts/issue-751-performance-receipt.test.ts, issue-751-sanitize-har.test.ts, tests/python/test_issue_751_trace_sanitize.py 및 기존 #623/#731 격리 E2E는 자동 정리·재시작·오류·마스킹 회귀를 검증한다. 단위 모의와 실제 network fault injection의 범위는 구별하며 새 Head 원격 E2E는 NOT TESTED.
- AC3: scripts/issue-751-performance-summary.mjs의 느린 Stage/HTTP 횟수/SQL share 후보 Job Summary와 scripts/issue-751-performance-compare.py의 provenance-인증 6/6 Shard 및 독립 성공 Run 최소10개/집단 P50/P95·HTTP 호출 수·SQL 집계 전후 비교를 사용한다. .github/workflows/issue-751-performance-trend.yml에서 Owner가 정확한 baseline/candidate Run ID를 입력해 조회하며 tests/python/test_issue_751_performance_compare.py가 누락/취소/중복/다른 환경/부족 표본을 INSUFFICIENT_DATA로 검증한다. 실제 전후 효과·SQL/Next compile 인과는 근거 충족 이전 PASS 아님.

## CURRENT_VERIFICATION

- #3014.1 F-001: 제목/qa_method 원본 실패, 테스트는 SKIPPED.
- #3016.1 F-002: Issue AC 식별자 누락, 테스트는 SKIPPED.
- #3018.1 F-003: Issue AC PASS, Work Packet DOCUMENTATION_SYNC 누락으로 Preflight FAIL, 테스트는 SKIPPED.
- #3020.1 F-004: Preflight/ESLint/Vitest/Policy PASS, TypeScript `TS18048` 두 건(격리 Fixture `child` mutable ref), E2E/Docker 구현 SKIPPED. 동일 서버 instance를 캡처한 `application` const로 readiness 상태 참조를 교정. [전용 원장 F-004](../../ISSUE_751_FAILURE_ANALYSIS.md), 새 HEAD 전체 CI `NOT TESTED`.
- 이 문서의 AC 및 DOCUMENTATION_SYNC 작성 자체는 원격 검증 PASS가 아님. 최신 HEAD에서 Full PR CI 세 Required와 Trusted QA/Owner 승인 증거를 별도 확인한다.

## 2026-10-19 — AC 잔여 구현 / 원격 재검증 경계

- Original verified PASS: [PR CI #3021.1](https://github.com/planner77/masterGantt/actions/runs/39263069941) (Run 39263069941 attempt 1, Head 4ea36f4c0a25f98b2250d9ab583040982e655b85, Base 5df178868139c4a307701e4807896691971b3376) Quality/Chromium6/Docker PASS; [Trusted QA #663.1](https://github.com/planner77/masterGantt/actions/runs/39267787594) PASS. This is past source; the new observer code requires a NEW exact HEAD Full CI.
- Added opt-in SQLITE observer only for test-scoped Next dev process (`NODE_ENV=development` and `ISSUE_751_SQL_METRICS=true`); raw SQL, bind parameters, public IDs, auth and cookies are never recorded in new receipts. Real production without the flag is not instrumented.
- SQL count/time per HTTP handler comes from better-sqlite3 synchronous execution; server request Duration includes other work. A high SQL share is only `SQL_SHARE_HIGH_CANDIDATE`. Low SQL share and slow client GET does not prove first compilation, network contention or fan-out. Captured browser/observer/server views are independent (not joined by guessed timestamps).
- One controlled Chromium fixture test now proves browser slow/503/network/abort and read-only real backend health; independent fixture cleanup is preserved (stop child process, remove only allocated SQLite and Next dist output; failures remain FAIL). Existing #623 phaseTiming for golden/mutation/5 widths remains authoritative for 60s body and 120s fixture boundary.
- Both local HAR and Playwright trace.network ZIP sanitizer are strict allowlist and caller-asserted UNVERIFIED until authenticated Run ID, attempt, head, job and artifact are provided. Unverified, missing, cancelled or expired data do not become baseline successes.
- Comparison requires both cohorts to have at least 10 **distinct successful source runs**, six passed Shards per Run, same event/OS/Node/shard/fullyParallel/project/stable test ID. The original #730 trace was produced before this SQL instrumentation; therefore no legitimate before/after SQL improvement result is currently available. `INSUFFICIENT_DATA` is the correct verdict, not a performance improvement claim.
- No changes to assertion counts, retries, skip, test timeout, CI required gates, underlying data model, GHCR/release authorization. Remains HIGH/OWNER_MANAGED and Draft until Owner reviews residual risks.

## 2026-10-20 — F-005 원본 실패와 신규 Full CI 조건

- Full PR [#3024.1](https://github.com/planner77/masterGantt/actions/runs/39276316902) Head `1acb01cb2b06054ecfbb43e3df5914715a42dc52` / Base `5df178868139c4a307701e4807896691971b3376`는 QA Preflight/Policy/TypeScript SUCCESS, ESLint prefer-const 및 Vitest issue-751-performance-receipt array oracle 두 직접 FAIL을 기록했다. Build/Chromium6/Docker는 Fast Gate로 SKIPPED, Required Aggregate FAILURE는 파생 결과. 이 원본 실패는 불변으로 유지한다.
- [전용 누적 실패 원장 F-005](../../ISSUE_751_FAILURE_ANALYSIS.md)에 F-001~F-004와 구 HEAD 성공 S-001 교차 비교를 기록했다. SQL observer의 Proxy는 const로 바꾸고 Vitest는 **원본 2건 모두** 검사하여 raw URL/SQL/ID의 비공개를 계속 단언한다. 기존 assert 강도, 타임아웃·skip·retry 및 6 Shard 정책 불변.
- 이 세션의 로컬 테스트는 NOT TESTED. 새 커밋의 Full PR CI가 시작되더라도 결과/Trusted QA/Owner AC 완료 판정은 실행 후 증거가 필요하다. 일단 새 Run 시작까지만 진행하고 CI 모니터링·병합·Main CI·GHCR·Issue 종료는 수행하지 않는다.

## 2026-10-20 — F-006 Resource Plan Focus 원본 재현/회귀 경계

- Full [#3026.1](https://github.com/planner77/masterGantt/actions/runs/39314211842) Run 39314211842 attempt1, PR #754 Head `d658baa366eaa613ac1e295a2f2320f5dd1a49ae`, Base `5df178868139c4a307701e4807896691971b3376`: Quality/Build/Docker 직접 PASS, Chromium Shard5 #622 Focus FAILED, 나머지 다섯 Shard는 FAIL-FAST 취소(고유 미관측 FAIL 없음), 전체 E2E/Trusted 최종 불가. 최초 F-001~F-005 및 구 HEAD #3021.1 PASS와 별도 원장 F-006을 대조한다.
- 원본 Trace `playwright-report-shard-5`의 native Task Editor 닫힘 이후 Resource detail 상태 전이 `stale→loading→ready` 동안 변경 전 Resource focus handler는 최대 60 RAF 후 준비 확인 없이 통과하는 경로를 가진다. 포커스 복원 실패는 확인; 정확한 단일 callback race는 관찰 미완으로 추론이다.
- 보완은 `src/features/projects/project-readonly-view.tsx` Resource Editor 닫기 branch의 **준비 완료 전 포커스 시도 자체를 제거**하고, `resource-editor-focus-return.ts`의 current report/detail receipt 결정과 MutationObserver 알림을 통해 현재 Assignment 버튼에만 반환한다. 새 사용자 pointer/keyboard/wheel·새 Modal·숨은 Panel/화면 변경 시 기존 restoration 취소; 유효한 current report에서 행이 사라진 경우 활성 fallback에 포커스. Watchdog는 관측 리소스를 회수할 뿐 pending을 ready로 바꾸지 않는다.
- `tests/features/projects/resource-editor-focus-return.test.ts`에서 stale/loading/0/모달/ready 및 fallback 검사. 실제 `tests/e2e/issue-622-resource-plan-target.spec.ts`의 Focus strict assertion 및 데이터·투입률·Excel·5폭 geometry는 수정하지 않는다. 관련 consumer: #621/#622/#623 Resource/Target, KPI/Plan Dashboard, Workspace focus, 기존 해당 E2E 병합.
- 이 작업은 Release 필수 QA/Owner 승인을 자동 수용하는 것이 아니다. 새 commit의 local npm/typecheck/Chromium 환경 결과는 이 API 세션에서 NOT TESTED, 새 PR CI Required Quality/E2E6/Docker·Trusted 결과도 실행 전 NOT TESTED. PR Draft, release_required=false/release_authorized=false 유지.


## 2026-10-20 — F-007 E2E Native npm setup 외부 연결 실패 및 국소적 복구

- GitHub [Full PR CI #3028.1](https://github.com/planner77/masterGantt/actions/runs/39318895759) Head `2eb1e31970a85c12ccd1a77c238b24ddc6c7f9c1`, Base `5df178868139c4a307701e4807896691971b3376`, exact test merge `d741b087aaa158cd2b15a46d4dce7bd71e01e0e7`. Shard2 Job `118288652891`에서 `better-sqlite3` `node-gyp rebuild` 중 Node 22.23.3 `SHASUMS256.txt` fetch `ECONNRESET`. QA Preflight/Policy/TypeScript/ESLint/Vitest/Build/Docker PASS; Shard2 test body NOT RUN, 나머지 5 Shards CANCELLED, Required E2E/QA Final 파생 FAIL.
- 이전 F-001~F-006/S-001과의 비교: POLICY/TS/LINT/Unit 원인은 현재 재현되지 않았으며 Focus 문제 F-006은 **Shard5 취소** 때문에 재검증되지 않았다. [Issue 전용 원장 F-007](../../ISSUE_751_FAILURE_ANALYSIS.md)에 단계별 상태와 원본 Evidence를 보존.
- `.github/actions/node-setup/action.yml`에 기본값 false인 `use-local-node-headers`를 도입해 `.github/workflows/ci.yml` **E2E Shard 공유 steps에서만** opt-in true; `process.execPath`에서 동일 Node 설치 prefix를 유도하고 node.h/common.gypi 존재 후 `npm_config_nodedir`를 export하여 frozen `npm ci`를 실행한다. 다른 Quality/Build/Release는 기존 경로 유지; 테스트 timeout/skip/retry/Fail Fast 변경 없음.
- `tests/scripts/issue-751-native-node-headers.test.ts`가 E2E 한정 옵트인 및 헤더 존재·기본 false를 테스트한다. 실제 Runner v22.23.3의 동일 version native build 재현 PASS는 새 Full CI 전 `NOT TESTED`. Node header 누락 시 setup 원인을 드러내며 의존성 설치를 PASS로 처리하지 않는다.
- 검증 영향: 직접 F-007 npm 설치, 누적 모든 실패 원인의 TypeScript/ESLint/Vitest/Policy·docs, 간접 #622 Focus, #623/730/731 Fixture·#751 SQL/Trace 통제, 반례 Quality/Docker·Main E2E 공통 anchor. 새 Full PR CI Quality/Chromium6/Docker, Trusted QA 및 Owner AC 수용은 서로 다른 단계이다. 새로운 E2E 완료 결과가 확인되기 전 #751 AC1~AC3 및 `manager_decision`은 `NOT TESTED`로 유지한다.



## 2026-10-20 — F-008 CI #3030.1: #622 Allocation input cold API candidate readiness

- [원본 Full CI #3030.1](https://github.com/planner77/masterGantt/actions/runs/39321562557) Run39321562557 attempt1 Head `501e10081161cc4971b062e83042088cf60e08a1` Base `5df178868139c4a307701e4807896691971b3376`, test merge `b6b75342a3116cf0f4fd15a1fd7dfff050396c10`, Shard5 `118297734692`. Same existing #622 tests now FAIL at line92 `allocation.toHaveValue("60")` because resource assignment candidate fetch is pending; previous F-006 focus failure line105 is **not exercised** this time. [Artifact #12220107976](https://github.com/planner77/masterGantt/actions/runs/39321562557/artifacts/12220107976) trace: assigned-targets HTTP200 112.646ms; assignment-targets HTTP200 4501.785ms; Fast Refresh 3954ms overlaps; Input 5s assertion expired. React and network causal decomposition **UNKNOWN**.
- Old F-001~F-005 policy/TypeScript/Lint/Unit paths, F-007 node-gyp native header on Shard5 PASS (new `node-gyp local headers enabled...` and npm 447 packages installed), but E2E fails on later hidden field. Other Shards CANCELLED, #751 new E2E not reached, prior F-006 strict Focus NOT TESTED. Cumulative comparison and per-job evidence in [F-008 issue ledger](../../ISSUE_751_FAILURE_ANALYSIS.md).
- `isolated-route-warmup.ts` retains 11 existing GET paths and adds read-only nonexistent-project `assigned-targets`/`assignment-targets` to avoid first-time Next Route compile during strict test body. `isolated-application.ts` uses the same 90000ms startup deadline and records both API stage timings nested under overall next_route_warmup. No project mutation, no retries/new timeout/no skipped/assertions removed.
- AC1 `tests/e2e/issue-751-performance-telemetry.spec.ts` now requires two successful warm-up stage receipts; `tests/scripts/issue-751-route-warmup.test.ts` asserts canonical missing UUID, sequential and unique safe GET paths. AC2 existing strict `tests/e2e/issue-622-resource-plan-target.spec.ts` unchanged and still guards input60→save40→focus original button→Excel/5 viewport. New full CI on exact HEAD required before PASS. AC3 original trace with cold compile vs new fixture warm-up is descriptive, not a valid P50/P95 before-after performance claim.
- Design Delta: `DESIGN.md` remains N/A (no UI change). `docs/TEST_PLAN.md`/REMOTE_VALIDATION UPDATED; `docs/CI_CD.md` N/A new CI workflow semantics remain unchanged. Local Node-specific helper validation and GitHub Full6 results separately recorded, no inferential PASS.

## 2026-10-20 — F-009 Full #3031.1 / #751 Chrome terminal request events

- 원본 [Full PR #3031.1](https://github.com/planner77/masterGantt/actions/runs/39324488213) Run `39324488213` attempt1, Head `4aa0619b39e0bfd9c876a84e74e9e0f4c7d00757`, Base `5df178868139c4a307701e4807896691971b3376`, test-merge `891e1b4c3565e310fa8ac8e406ee4d22341d1474` Shard5 Job `118307697128`에서 #622 Resource Plan **PASS(36s)** 후 신규 `issue-751-performance-telemetry.spec.ts:64`에서 complete Expected2/Actual1 FAIL. 원본 Timing Artifact `12221842831`: controlled assignment-targets 1 complete200, 1 incomplete200, 1 incomplete503, 2 other(null), 실제 통제 본문 5요청. 5개 다른 shard cancelled, Quality/Docker PASS, E2E/QA Final FAIL. 전 원장 F-001~F-008과 비교 및 F-009 상세는 [전용 실패 원장](../../ISSUE_751_FAILURE_ANALYSIS.md)에 보존.
- AC1: `tests/e2e/fixtures/isolated-performance-receipt.ts`의 browser `requestfailed`는 Playwright `Request.failure()?.errorText` 객체를 받아 sanitized 분류한다(`abort`, `network`, `timeout`); raw URL/쿼리/header/errorText 저장 금지. `tests/scripts/issue-751-performance-receipt.test.ts`는 real object 모양, HTTP503 response/header만 수신한 pending을 incomplete로 보존, terminal requestfinished에 한해서 complete/http_error를 보존하는 음성 회귀 추가.
- AC2: `tests/e2e/issue-751-performance-telemetry.spec.ts`는 각 scripted browser synthetic GET의 `requestfinished` 또는 `requestfailed` waiter를 fetch 실행 전에 등록하고 HTTP 응답 body(`arrayBuffer`)를 소비한다. Route 제거 전에 terminal 수신을 확인하며 2 complete200(90ms delayed 포함)·1 http_error503·1 network·1 abort를 **정확히** 검증하고 `incomplete`/`other`를 허용하지 않는다. 5s/60s/120s timeout, Retry/Skip, 신규 90ms 제어, #622 strict 데이터·Focus·Excel·5폭 E2E 단언 변경 없음.
- AC3: 브라우저 정상 완료 시점과 실패 원인 분류가 수정되어 원본 `e2e-timing-ci-shard-*` artifact 신뢰도가 개선될 것으로 예상하되, 아직 새 Run에서 실증되지 않아 `NOT TESTED`. 과거 SQL/Next compile 근인 및 전후 P50/P95 개선 효과는 기존과 같이 `UNKNOWN/INSUFFICIENT_DATA`. #3031.1의 #622 strict E2E PASS는 이전 F-006/F-008 근인 조치 경로의 성공 관측이며 전체 6-shard 성공은 아니다.
- `DOCUMENTATION_SYNC`: DESIGN.md N/A(화면·동작 원칙 변화 없음), AGENTS.md N/A(기존 실패 대응 규칙 그대로), docs/API.md·docs/DB_SCHEMA.md N/A(공개 계약/DB 저장 변화 없음), CI/CD N/A(Workflow Gate/Shard/Timeout 동일), `docs/TEST_PLAN.md` 및 `docs/REMOTE_VALIDATION.md` UPDATED. 새 exact Head Full CI 및 HIGH OWNER 승인 없이는 병합 불가.

## 2026-10-22 — 최신 main 동기화·8-Shard 계약 충돌 정렬

- 이전 #751 원장의 Full #3014~#3031 검증은 6/6 당시의 불변 이력이며 최신 main에서 PASS로 승계되지 않는다.
- PR #754 branch를 2026-10-22 main `b7cf247530ca17a61b3a934a6ebb4c2b6d3b2701` (Issue #767의 E2E 8/8 및 #770 Shadow 포함)에 병합 정렬한다. main의 .github/workflows/ci.yml Required Quality/E2E/Docker, 8 shard 수·timeout/QA 보호는 보존하며 #751 계측, 브라우저 terminal/Resource 포커스 검증도 보존한다.
- src/features/projects/project-readonly-view.tsx에서는 main의 Resource WBS 내비게이션을 보존하고 #751의 report/detail readiness 기반 Focus MutationObserver를 통합한다. tests/e2e/fixtures/isolated-application.ts에서는 #733 process-workareas serial GET/prewarm·Webpack opt-in·fresh dist/restart·task process-context 경로 검증과 #751 stage/SQL/HTTP 수집을 동시에 적용한다. tests/config/e2e-timing-reporter.cjs의 main skip evidence와 #751 receipt를 모두 유지한다.
- `scripts/issue-751-performance-compare.py`와 trend 수집기는 과거 6/6 또는 새 8/8 **각 실행별 완전한 동일 토폴로지**만 수용한다. 개별 실행에서 6/8·일부 취소·다른 환경/Head/Attempt 혼합은 `INSUFFICIENT_DATA`; baseline 6 vs candidate 8을 동질 cohort로 간주하지 않는다. 해당 8-way 회귀 테스트 추가.
- 본 소스의 로컬 타입·Lint·Unit·실제 Chromium 8/8 검증은 아직 `NOT TESTED`. 새로운 exact-Head PR CI의 Required Quality/E2E8/Docker와 Trusted QA는 별도 판정. HIGH/OWNER_MANAGED 및 release_authorized=false 유지, 병합·GHCR·Issue 종료 권한 없음.

## 2026-10-22 — F-010 PR #754 Full #3117.1 fast-gate repair

- [Full #3117.1 / Run 39718978497](https://github.com/planner77/masterGantt/actions/runs/39718978497): exact Head `3c21a52a2935c77a29ddf0b5bbd932f6f8a3a70b`, main base `b7cf247530ca17a61b3a934a6ebb4c2b6d3b2701`. Policy/Python 1 ERROR and Vitest 1 FAIL are the two direct failures; actual PR Chromium 8-shard, Docker and Build skipped. [F-010 ledger](../../ISSUE_751_FAILURE_ANALYSIS.md).
- #770 trusted impact-observation test calls reporter `onTestEnd` without optional attachments/steps; #751 telemetry must not throw or synthesize receipts, while retaining separate passed/skipped timing and failed test receipt on valid input. Add/retain required Python policy regression for both input shapes.
- #767 had 136 registered E2E spec files. #751 adds 137th; explicitly slot on shard **1/8**, retain all old slots and strict full-inventory test. Only shard 1 becomes 18 files; others remain 17. Do not characterize historical 136-file projected duration as the new test's measured latency or re-weight other specs without evidence. Required 8/8 and 35-minute shard budgets unchanged.
- `DOCUMENTATION_SYNC`: docs/TEST_PLAN.md and this Work Packet UPDATED; docs/CI_CD.md N/A (no workflow/gate/timeout change); DESIGN.md/API.md/DB_SCHEMA.md/AGENTS.md/QA policy N/A (no production contract/CI authorization change). `AC_TEST_COVERAGE`: AC1 reporter regression (missing/malformed receipts never measured); AC2 real #751 browser E2E explicitly scheduled; AC3 6/6 historic vs complete 8/8 new timing cohort still fail-closed. Owner HIGH/`OWNER_MANAGED`/Draft remains in effect. New source TypeScript/Lint/Vitest/Policy/Chromium/Trusted state `NOT TESTED` until new exact-Head CI. Start new Full PR CI only; do not monitor/merge/release/close.
