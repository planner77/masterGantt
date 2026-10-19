# Issue #751 — E2E performance work packet

Status: implementation extended; actual CI and controlled tests NOT TESTED as of 2026-10-19.

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

- `AGENTS.md`: N/A(기존 Issue Lifecycle 보호 규칙과 OWNER_MANAGED/QA 승인 절차 불변)
- `docs/QA_REVIEW_POLICY.md`: N/A(독립 검증 및 세 Required aggregate 의무와 운영 게이트를 변경하지 않음)
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: N/A(새 토큰이나 저장소 권한·Issue 병합 및 릴리스 절차 도입 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 Full CI/Trusted QA/Owner 수용 절차 불변이며 실행 증거는 전용 Work Packet과 TEST_PLAN에 기록)

## AC_TEST_COVERAGE

- AC1: tests/e2e/fixtures/isolated-performance-receipt.ts, isolated-application.ts, tests/config/e2e-timing-reporter.cjs, tests/e2e/issue-623-resource-mvp.spec.ts 세 종류의 main #731 분할 테스트를 연결하여 fixture/hook/body/seed/API 측정과 source Run/Attempt/checkout 경계를 검증한다. 실제 Chromium 전용 환경은 새 PR CI 전 NOT TESTED.
- AC2: tests/scripts/issue-751-sanitize-har.test.ts and tests/scripts/issue-751-performance-receipt.test.ts의 monotonic/HTTP503/Abort/Timeout/마스킹 통제와 테스트별 격리 SQLite 생성·정리 계약을 회귀한다. 실제 서버 종료·느린 네트워크·오류 주입 반복은 원격 실행 전 NOT TESTED.
- AC3: scripts/issue-751-performance-summary.mjs, scripts/issue-751-performance-trend.py, .github/workflows/issue-751-performance-trend.yml, docs/TEST_PLAN.md와 docs/CI_CD.md를 연결하여 각 출처의 동일 환경 P50/P95, warning-only, 표본 부족을 검증한다. 유효한 전후 동일 환경 성능 개선 판단은 실측 전 INSUFFICIENT_DATA.

## CURRENT_VERIFICATION

- #3014.1 F-001: 제목/qa_method 원본 실패, 테스트는 SKIPPED.
- #3016.1 F-002: Issue AC 식별자 누락, 테스트는 SKIPPED.
- #3018.1 F-003: Issue AC PASS, Work Packet DOCUMENTATION_SYNC 누락으로 Preflight FAIL, 테스트는 SKIPPED.
- #3020.1 F-004: Preflight/ESLint/Vitest/Policy PASS, TypeScript `TS18048` 두 건(격리 Fixture `child` mutable ref), E2E/Docker 구현 SKIPPED. 동일 서버 instance를 캡처한 `application` const로 readiness 상태 참조를 교정. [전용 원장 F-004](../../ISSUE_751_FAILURE_ANALYSIS.md), 새 HEAD 전체 CI `NOT TESTED`.
- 이 문서의 AC 및 DOCUMENTATION_SYNC 작성 자체는 원격 검증 PASS가 아님. 최신 HEAD에서 Full PR CI 세 Required와 Trusted QA/Owner 승인 증거를 별도 확인한다.
