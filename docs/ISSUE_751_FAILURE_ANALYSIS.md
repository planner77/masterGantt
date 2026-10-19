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
| S-001 | Full #3021.1 / Trusted #663.1 | 검증 성공(구 HEAD) | 6 shards PASS | 추가 AC 구현 전 baseline, 신규 HEAD에는 재검증 필수 |

- 새 작업은 기존 metadata/AC/timeout/required gate 실패를 재발시키지 않는 범위에서 격리 SQL·브라우저·Server 계측, 통제 E2E, read-only comparison/Trace sanitizer와 검증 테스트를 추가한다. 운영 DB/프로덕션 기본 경로 변경 없음.
- 현재 SQL·compile·fan-out 인과/개선 효과는 검증된 자료가 없으면 `UNKNOWN`/`INSUFFICIENT_DATA`로 보존한다. 새 CI 시작은 성공이나 병합 승인 증거가 아니며 Owner HIGH 위험 수용이 별도로 필요하다.
