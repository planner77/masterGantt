# Issue #751 — isolated E2E telemetry work packet

Status: PARTIAL IMPLEMENTATION / NOT TESTED (2026-10-19)

## Source and constraints
- [Issue #751](https://github.com/planner77/masterGantt/issues/751); #730/#623 raw trace is the historical source, not a new PASS.
- `AGENTS.md`, `docs/PR_CI_FAILURE_TRIAGE.md`, `docs/TEST_PLAN.md`, `docs/CI_CD.md`, `docs/ISSUE_LIFECYCLE.md` remain authoritative.
- Fixture timeout 120000ms and test body timeout 60000ms are **distinct**. Before Hooks 14.6797s must not be added to the measured test body 59.97s to conclude a fixture-induced timeout.
- Never raise global timeouts, retry counts, skips, or relax existing assertions to obtain green CI.

## Current implementation scope
- Monotonic `performance.now()` stage samples for isolated SQLite migrate, next server readiness, warmed routes, patch-only readiness, fixture startup/restart, teardown.
- Every isolated run attaches `issue-751-isolated-performance` JSON with stage outcome and classification, timeout limits, test stable ID, retry/worker/project, run/attempt and checkout SHA where available.
- All stage labels and values come from a strict internal allowlist; no raw URL, query, payload, cookie, token, raw trace, or database path is written to this receipt.
- The `checkoutSha` field is deliberately **not** named `headSha`: GitHub PR checkout can refer to a synthetic merge commit. Verify the exact PR Head independently.

## Outstanding AC (NOT TESTED / not implemented)
- Test body and seedIssue623 substage timings; fixture teardown on every crash/failed cleanup.
- Browser network request outcome/duration/status/cancel and source-linked sanitized HAR/trace event aggregation.
- Explicit Next.js lazy compile/DB query/fan-out attribution; these are hypotheses until evidence.
- CI artifact retention/export, Job Summary and on-demand authenticated trend collector for identical environment/shard/test stable ID; success-only P50/P95 and provisional timeout-80% warning.
- Controlled normal/slow/abort/network-failure experiments, environment cleanup and repeated runs, same-source baseline comparison.
- This code has not been locally executed here. CI results, Required3, trusted QA, Owner decision remain NOT TESTED.

## Lifecycle
- HIGH / OWNER_MANAGED, release_required=false, release_authorized=false.
- No merge/GHCR/release without separate Owner approval.
