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
- Outstanding: direct server SQL query/lazy compile/fan-out causal attribution, genuine failure injection and cleanup repetition, identical-control baseline before/after metrics, official original HAR/Trace intersection. No claims of improvement/PASS until evidence.
- New source local TypeScript/ESLint/E2E and Full PR 3 required checks/Trusted QA: NOT TESTED. High-risk OWNER_MANAGED; release_required=false, release_authorized=false; no merge/GHCR without Owner approval.
