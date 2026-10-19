# Issue #751 — CI failure ledger

## F-001: PR #754 Full CI #3014.1 (2026-10-19)
- Source: https://github.com/planner77/masterGantt/actions/runs/39255129930; attempt 1; Head f24f74b4b56fc3a83b6e0496574739f840a56e6e; Base 0aa1d3d71f13df6976539ef4ebaaadb9037121c4; test-merge dea92870e3be362ca88f67b8271c89f3c5bf7d00.
- Changes Job 118068393834 rejected PR title: title Issues=[] (must contain Issue #751 or (#751)).
- QA Final trust Job 118068393592 rejected missing qa_method. Metadata omissions, not product failures.
- Typecheck, lint, unit, build, Chromium E2E 6 shards and Docker actual jobs SKIPPED. Required three aggregate FAILURE derived from missing prereqs. No PASS or product FAIL may be inferred.
- Remedy: title changed to Issue #751: E2E..., PR body declares qa_method=OWNER_MANAGED, risk_level=HIGH, qa_required=true, release_required=false, release_authorized=false.
- Keep #3014.1 FAILURE unchanged. Revalidate with new HEAD Full PR CI; actual test results not yet known.
- Subsequent failures must append new F-number, exact run/attempt/head/base, cause, affected/cancelled jobs and correction without retroactive PASS.

## F-002: PR #754 Full CI #3016.1 (2026-10-19)
- Run https://github.com/planner77/masterGantt/actions/runs/39257936517 , attempt 1, Head `8103ed5723325482027feb4e01cef79afea54f85`, Base `0aa1d3d71f13df6976539ef4ebaaadb9037121c4`.
- QA Preflight 118077952850 FAIL / ISSUE_AC — 원본 Issue 본문에 세 가지 AC 항목은 있었으나 식별자 `AC1..` 누락. 제목/Refs, QA/Risk/Release 메타데이터는 PASS.
- Typecheck/Lint/Unit/Build/Chromium E2E6/Docker 실행 Job은 SKIPPED, 집계 Required FAILURE와 QA Final FAILURE는 선행 실패에 따른 결과임. 제품 실패 단언 근거 없음.
- 조치: Issue #751의 기존 3개 수용 기준을 AC1~AC3으로 식별하고, 해당 HEAD 원본 실패는 소급 변경하지 않는다.

## F-003: PR #754 Full CI #3018.1 (2026-10-19)
- Run https://github.com/planner77/masterGantt/actions/runs/39259814359 , attempt 1, HEAD `3c751c19e978733d65929c14d0d21344ad526944`와 Base `5df178868139c4a307701e4807896691971b3376`.
- QA Preflight job 118084338946: PRIMARY_ISSUE/QA_METHOD/RISK_LEVEL/ISSUE_AC 모두 PASS, 그러나 `FAIL / DOCUMENTATION_SYNC: Work Packet ## DOCUMENTATION_SYNC 누락`. Script, E2E, Docker 및 3 Required 집계의 직접 실행 결과는 SKIPPED/선행 차단.
- 원인: protected CI/scripts 변경에 필요한 문서 영향 계약과 `AC_TEST_COVERAGE` 섹션 누락. 단순 CI retry나 timeout 증가는 해결되지 않음.
- 보완: docs/exec-plans/active/ISSUE_751.md에 문서별 UPDATED/N/A 이유와 AC1~AC3의 source-to-test mapping 및 증거 경계를 기재. Head 변경 뒤 새 Full PR CI 필요. F-001/F-002/F-003 원본 상태를 보존한다.

## F-004: PR #754 Full CI #3020.1 (2026-10-19) — TypeScript narrowing defect

- **원본 실행**: [GitHub Run #3020.1](https://github.com/planner77/masterGantt/actions/runs/39261158546), ID `39261158546`, attempt `1`, event `pull_request`, Head `eb2327b123727760cf375dcc68c06252c9338a28`, Base `5df178868139c4a307701e4807896691971b3376`, test-merge `3df933a90d840bfbc30b1c29ac90a23aa642d5bc` (당시 PR Git ref 관측). 변경 범위는 격리 E2E Fixture/관측, Work Packet·CI 계측/경고·문서, 전후 SQL 병목 직접 계측은 아직 없음.
- **실패 Job/최초 실제 에러**: TypeScript 타입 검사 Job `118089428497`의 `npm run typecheck` 실행 중 `tests/e2e/fixtures/isolated-application.ts:172:29, :172:56` 에서 `TS18048: 'child' is possibly 'undefined'` 2건 발생, exit code 2. 원본 컴파일 실패 위치는 새 `performanceReceipt.measure("server_start_readiness", async () => { ... })` 내부이다.
- **직접/파생 분리**: QA Preflight `118089315248` PASS(Primary Issue, risk, qa_method, Issue AC, documentation sync 포함); ESLint `118089428500` PASS; policy `118089428528` PASS; Vitest `118089428579` PASS. TypeScript만 직접 FAIL. PR Fast Gate `118090284285` FAIL 및 required Quality `118090384271`/E2E `118090383934`/Docker `118090384549` FAILURE는 선행 실패에 따른 파생 결과. PR production build/Chromium 6-shard/Docker 구현 Jobs는 SKIPPED, 제품/E2E 본문 실패나 성공으로 해석 금지. QA Final `118090425830` FAIL도 aggregate 미성공이 원인이다.
- **누적 비교 및 분류**: F-001(PR 제목과 qa_method 누락), F-002(Issue AC 식별자 누락), F-003(Work Packet 문서/AC 매핑 누락)는 `POLICY_CI`에 의한 Preflight/metadata 조기 실패로 실제 TypeScript가 실행되지 않았었다. 이번 F-004는 선행 3가지가 PASS로 전환된 뒤 드러난 신규 `FIXTURE_OBSERVABILITY` 구현의 **정적 타입 결함**. 기존 이력의 원인이 재발한 것이 아니며 E2E 실행시간·API 지연/SQL/OOM 원인이라고 확정할 근거도 없다.
- **근인**: `child: ChildProcess | undefined`는 외부에서 다시 대입 가능한 mutable 변수이므로 비동기 내부 콜백에서 TypeScript의 nullish narrowing이 유지되지 않는다. 반면 해당 서버 시작에서 캡처한 `const application = child`는 non-undefined ChildProcess로 고정된다. `child!` 또는 임의 타입 캐스팅, 테스트 비활성화로 오류 은폐하지 않는다.
- **대응**: readiness 측정 루프의 exit/signal 상태를 `application.exitCode`와 `application.signalCode`로 확인한다. 이 변수는 기존 `close` 이벤트를 설치한 현재 생성 세대의 동일 Process이고 종료/재시작/Timeout/재시도 계약을 바꾸지 않는다. 다른 `child` 참조는 동일 block에서 안전 검사 후 사용하고 기존 assertion/timeout/retries/skip 불변.
- **검증 경계**: 해당 수정 전 원격 TypeScript FAIL을 보존한다. 새 source에서 Syntax/타입 검사, 정책·기존 격리 Fixture 회귀 및 PR Full Quality/E2E6/Docker를 새로운 run/attempt로 검증해야 한다. 기존 F-004 실패를 PASS로 소급 처리하지 않는다. 원격 새 CI/QA/Owner 판정은 실행 전 `NOT TESTED`. HIGH/OWNER_MANAGED, release_required=false, release_authorized=false; 병합/GHCR/릴리스 및 이슈 종료 금지.

## S-001 — 기존 HEAD의 검증 성공 (재작업 전 기준, 2026-10-19)

- [Full PR #3021.1](https://github.com/planner77/masterGantt/actions/runs/39263069941), Run ID 39263069941 attempt 1, event pull_request, Head `4ea36f4c0a25f98b2250d9ab583040982e655b85`, Base `5df178868139c4a307701e4807896691971b3376`.
- Required Quality SUCCESS, Chromium E2E 6/6 Shards 및 aggregate SUCCESS, Docker implementation/aggregate SUCCESS, QA Final Automated SUCCESS; PR metadata path SKIPPED 정상.
- [Trusted QA #663.1](https://github.com/planner77/masterGantt/actions/runs/39267787594) Run ID 39267787594 attempt 1, QA Final — Trusted SUCCESS. 기본 main 검증기 SHA는 당시 main `5df178868139c4a307701e4807896691971b3376`.
- **실증 경계**: 기존 Fixture/partial telemetry는 성공한 것이나 SQL query count, trace.network 정제, 실제 slow/abort 통제, cohort before/after comparator는 구 HEAD에 없었다. 따라서 Issue #751 AC 전체 PASS 또는 변경 후 신규 HEAD 성공으로 이월하지 않는다.

## Cross-run 원인 비교와 신규 AC 구현 경계

| 순번 | 원본 실행 | 직접 실패 유형 | 제품 본문 검증 | 교정·증거 |
| --- | --- | --- | --- | --- |
| F-001 | Full #3014.1 | POLICY_CI: PR title/qa_method | SKIPPED | 정규 Issue #751 제목·QA meta |
| F-002 | Full #3016.1 | POLICY_CI: Issue AC 번호 | SKIPPED | AC1~AC3 |
| F-003 | Full #3018.1 | POLICY_CI: Work Packet 문서 매핑 | SKIPPED | DOCUMENTATION_SYNC·AC_TEST_COVERAGE |
| F-004 | Full #3020.1 | FIXTURE_OBSERVABILITY: TS18048 child null narrowing | SKIPPED | 안정 const application 참조 |
| F-005 | Full #3024.1 | TEST_CONTRACT / ESLint prefer-const | Vitest 1 FAIL, E2E6/Docker SKIPPED | proxy const + 서버 기록 2건 정확 oracle |
| F-006 | Full #3026.1 | PRODUCT_UI / async projection Focus | Shard5 #622 Focus 1 FAIL; 5 Shard CANCELLED, Quality/Docker PASS | confirmed readiness + user-intent-safe focus handoff; new E2E pending |
| S-001 | Full #3021.1 / Trusted #663.1 | 검증 성공(구 HEAD) | 6 shards PASS | 추가 AC 구현 전 baseline, 신규 HEAD에는 재검증 필수 |

- 새 작업은 기존 metadata/AC/timeout/required gate 실패를 재발시키지 않는 범위에서 격리 SQL·브라우저·Server 계측, 통제 E2E, read-only comparison/Trace sanitizer와 검증 테스트를 추가한다. 운영 DB/프로덕션 기본 경로 변경 없음.
- 현재 SQL·compile·fan-out 인과/개선 효과는 검증된 자료가 없으면 `UNKNOWN`/`INSUFFICIENT_DATA`로 보존한다. 새 CI 시작은 성공이나 병합 승인 증거가 아니며 Owner HIGH 위험 수용이 별도로 필요하다.

## F-005: PR #754 Full CI #3024.1 (2026-10-19) — ESLint and Vitest failure on new telemetry

- **출처**: [Full PR CI #3024.1](https://github.com/planner77/masterGantt/actions/runs/39276316902), Run ID `39276316902`, Attempt `1`, event `pull_request`, Head `1acb01cb2b06054ecfbb43e3df5914715a42dc52`, Base `5df178868139c4a307701e4807896691971b3376`; 현재 동일 Head/Base에서 관찰한 PR test-merge ref `fde209e1db3e2159659fcb9ba233547e643affa6`이며 원본 run artifact의 test-merge 교차 인증은 별도.
- **직접 FAIL A**: ESLint Job `118141705999` `src/server/db/e2e-sql-observer-core.ts:31:3` `prefer-const: 'proxy' is never reassigned`(1 error/13 unrelated warnings). 기존 `let proxy: T; proxy = new Proxy(...)` 두 단계 선언을 동등한 `const proxy: T = new Proxy(...)`로 변경한다. Proxy getter 안의 `proxy`를 참조하는 클로저와 better-sqlite3 receiver, SQL 계측/SQL error 분류는 유지한다.
- **직접 FAIL B**: Vitest Job `118141706317` (248 실행 대상 파일 중 247 PASS/1 FAIL, 1 SKIPPED; 3056 PASS/1 FAIL/3 SKIPPED). `tests/scripts/issue-751-performance-receipt.test.ts:52`: `serverRequests` 길이 2(알려진 `assignment-targets` 1 + 마스킹된 `other-api` 1)인데 기대 배열 길이 1로 `toMatchObject` 비교하여 Assertion FAIL. 제품 API 실패/개인정보 누출이 아니라 테스트 oracle의 누락이다.
- **수정 B**: `serverRequests` 길이 2를 정확히 검사하고 첫 요청의 HTTP200/235ms/SQL8/17.8ms 및 두 번째 알 수 없는 API의 안전한 `other-api` 분류·status null/SQL100/원시 ID·SQL 텍스트 비포함을 각각 명시해 양쪽 관측을 더 엄격히 검증한다. 제품 계측 동작을 삭제하거나 `expect`/timeout/skip/retry 완화 금지.
- **직접/파생 구분**: QA Preflight, 정책 검사, TypeScript SUCCESS. 원본 Fast Gate FAIL은 ESLint·Vitest 미성공에 따른 파생 결과. 이후 PR Build, Chromium E2E 6 shard, Docker 구현 Job은 SKIPPED이고 Required Quality/E2E/Docker aggregate FAILURE 및 QA Final FAILURE는 보호에 따른 파생 결과이다. 어떠한 E2E/Build/Docker PASS도 추정하지 않는다.
- **전 원장 대조**: F-001/002/003은 `POLICY_CI` 사전 차단, F-004는 `FIXTURE_OBSERVABILITY` TypeScript nullability로 이번 lint/unit 결함과 서로 다른 근인. S-001 구 HEAD #3021.1 Required3/Trusted QA PASS는 구간 근거일 뿐 이번 코드의 PASS가 아니다. F-005는 첫 실제 full unit 집합에서 드러난 새로운 **TEST_CONTRACT + 정적 LINT 구현 결함**이며 데이터·성능 인과관계와 혼동하지 않는다.
- **교차 검증/인계**: 영향 집합은 두 수정 파일, `tests/server/db/issue-751-sql-observer.test.ts`, `tests/scripts/issue-751-performance-summary.test.ts`, trace/HAR privacy Unit, #623 기존 E2E 및 신규 `issue-751-performance-telemetry.spec.ts`. 로컬 Node/Vitest/ESLint 실행 증거는 이 세션에서 `NOT TESTED`; 기존 원격 TypeScript/Policy PASS도 새 Head로 자동 승계하지 않는다. 새 Full PR CI exact HEAD, Required Quality/Chromium6/Docker 및 기본 main Trusted QA가 필요하다. HIGH/OWNER_MANAGED, Draft, 별도 Owner 최종 병합 승인 전 병합/배포/Issue 종료 금지.

## F-006: PR #754 Full CI #3026.1 (2026-10-19) — #622 Resource Plan edit focus restoration race

- **Run/Attempt/출처**: [Full PR CI #3026.1](https://github.com/planner77/masterGantt/actions/runs/39314211842), Run ID `39314211842`, attempt `1`, event `pull_request`, PR #754, Head `d658baa366eaa613ac1e295a2f2320f5dd1a49ae`, Base/main `5df178868139c4a307701e4807896691971b3376`, exact test-merge `f641b46402e2cb421d8cccb72412ada55b45fe65`. 전용 원본 [ci-pr-source Artifact #12215828967](https://github.com/planner77/masterGantt/actions/runs/39314211842/artifacts/12215828967)의 PR/repo/head/base/attempt/merge SHA와 동치 확인.
- **첫 직접 FAIL**: Chromium E2E Shard 5 Job `118272495898`, [Playwright report #12215654837](https://github.com/planner77/masterGantt/actions/runs/39314211842/artifacts/12215654837), `tests/e2e/issue-622-resource-plan-target.spec.ts:105`, `expect(edit).toBeFocused()` received `inactive` for *실재하고 표시된* `data-resource-assignment-edit` 버튼(5초 strict focus assertion). 1440px/Task Editor 종료 후 화면. Shard5 원본 1 PASS, 1 FAIL, 83 NOT RUN, 1 non-test cleanup diagnostic; Runtime 39.4s of failed case. 저장 후 배정과 filter/Target 40% 및 Detail ready는 이 Assertion 이전까지 검증됨.
- **취소 포함 실제 Job 증거**: QA Preflight `118271478840` SUCCESS, Policy `118271654403` SUCCESS, ESLint `118271654332` SUCCESS, TypeScript `118271654768` SUCCESS, Vitest `118271654478` SUCCESS, PR Fast Gate `118272407448` SUCCESS, Next Build `118272495820` SUCCESS, Docker smoke `118272495841` SUCCESS, Quality aggregate `118273177656` SUCCESS, Docker Required `118274589753` SUCCESS. Chromium Shard 1/2/3/4/6은 `118272495780/118272495850/118272495815/118272496272/118272495790` CANCELLED; 취소 전 로그에서 별도 실제 FAIL은 관측되지 않았다. Chromium aggregate `118273819853` FAIL, QA Final `118274642181` FAIL은 Shard 5 직접 실패의 파생 결과. CANCELLED는 PASS/FAIL 근거가 아님.
- **원본 Trace 관측**: Task Editor 종료 시점 이후 `ResourceDashboardDetails` projection의 `data-detail-state`는 `stale` (trace monotonic 약 63307ms)→`loading` (64350ms)→`ready` (64578ms)로 변했다. 페이지의 배정 편집 버튼은 최종 ready 상태에서 DOM에 존재하되 focus=false. 원래 `project-readonly-view.tsx:finishTaskEditor(resources)`는 modal 종료 및 `[data-ready=false]`/`[data-detail-state=loading]`이 최대 60 requestAnimationFrame을 넘으면 준비 여부 무관하게 focus 시도로 진행한다. 늦은 projection 교체가 focus 소실을 초래할 수 있는 코딩 결함으로 확인; 정확한 restore callback 시각은 Trace의 명시 instrumentation 부재로 `INFERRED`이다.
- **전 이력 교차**: F-001~003 = POLICY_CI 메타데이터·문서, F-004 = FIXTURE_OBSERVABILITY TypeScript, F-005 = ESLint + TEST_CONTRACT Vitest, 모두 이번 Quality·Policy·Unit에서 PASS. 신규 F-006은 UI 비동기 canonical detail/Focus 결함으로 다른 유형이다. S-001 [Full #3021.1](https://github.com/planner77/masterGantt/actions/runs/39263069941) Shard5 Job `118096667254`에서는 **같은 #622 E2E 35.8초 PASS**였으므로 항상 재현하는 실패 또는 기존 Issue #622만의 신기능 문제라 단정하지 않는다. 신규 SQL/E2E 계측 및 비동기 Runner 경쟁은 지연 후보지만 직접 인과 입증 없음.
- **제품 수정·테스트 근거**: `src/features/projects/project-readonly-view.tsx` Resource Editor focus 복원은 60프레임을 준비 완료 판정으로 삼지 않고 Native Modal 닫힘 → current Resource Dashboard ready → 동일 `data-projection-detail-key`의 Detail `ready` + 유효 confirmation ID → 논리 Task/Assignment 활성 버튼 순으로 판단한다. MutationObserver로 갱신 후 다시 확인하고, 사용자 pointer/keydown/wheel·새 Modal/네비게이션 generation 변경 시 취소, 범위 탈락 뒤 confirmed report 시 fallback, observer+watchdog 해제. `src/features/projects/resource-editor-focus-return.ts` 순수 결정 함수와 `tests/features/projects/resource-editor-focus-return.test.ts`의 readiness/취소/fallback 음성을 추가한다. `tests/e2e/issue-622-resource-plan-target.spec.ts`의 strict Focus, Assignment/Target·Excel/5 viewport assertion은 불변. E2E Timeout/skip/retry·6Shard/Fail Fast 정책 변경 없음.
- **영향/교차 검증**: 누적 실제 실패 합집합 = F-001 PR trace 검증/QA meta, F-002 Issue AC, F-003 Docs Gate, F-004 `isolated-application.ts` TS, F-005 `e2e-sql-observer-core.ts` lint와 `issue-751-performance-receipt.test.ts`, F-006 `issue-622-resource-plan-target.spec.ts`. 직접/인접: `resource-kpi-integration-ui.spec.ts`, `resource-plan-dashboard.spec.ts`, `project-workspace-tabs-518.spec.ts`, `issue-623-resource-mvp.spec.ts`, `issue-751-performance-telemetry.spec.ts`, `tests/features/projects/resource-editor-focus-return.test.ts`. 원본 SHA/run/원인과 임의 외부 테스트 재실행을 혼합하지 않음.
- **검증/인계**: 코드 구조 검사 및 출처/Trace 직접 분석은 수행; 이 연결 환경에는 동일 repo의 Node_modules·Chromium 실행 코드가 없으므로 변경 HEAD의 로컬 Vitest/Playwright/ESLint/TypeScript는 `NOT TESTED`. 새 HEAD와 최신 main align, 미해결 review 0/merge conflict 0 확인 후 새로운 Full CI 시작. 직전 F-006 원본 FAIL은 소급 PASS 금지. Reviewer/Owner `HIGH/OWNER_MANAGED`, Draft, `release_required=false`, `release_authorized=false`; 병합·Main/GHCR/Issue close 불허.
