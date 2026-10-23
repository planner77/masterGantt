# Local Pre-PR Verify — BLOCKED

- Issue: 735, PR: 757, mode: diagnose, risk: HIGH
- Base: ee3ec3a4bc0e9a31f7c933e73febac6ed6b6a60e (ee3ec3a4bc0e9a31f7c933e73febac6ed6b6a60e)
- Head: ee3ec3a4bc0e9a31f7c933e73febac6ed6b6a60e; working fingerprint: 7742ec5c590028ce7970d7b59296c7e6b3218bc614bebfcc7f134ef08f1ab2a5
- End source: 7742ec5c590028ce7970d7b59296c7e6b3218bc614bebfcc7f134ef08f1ab2a5; source stable: true
- Platform: linux/6.6.87.2-microsoft-standard-WSL2, Node v22.14.0, npm 11.10.0
- Playwright: 1.63.0, Chromium *expected metadata revision*: 1243, executable: Playwright-managed (expected revision; actual browser launch is tested only by E2E)
- Changed paths: 20
- Selection: READY, selected 1 tests, UNKNOWN 0, missing 0
- Residual risks: Diagnosis needs one PR and failures across two runs and distinct consumers

| Command | State | Exit | Unique cases (if parsable) | ms |
| --- | --- | --- | --- | --- |
| (none; NOT TESTED) | NOT TESTED | N/A | N/A | N/A |

## CI-only / deferred
- GitHub QA Preflight / Trusted QA / Owner: DEFERRED — GitHub PR metadata, protected base validator and signed approval required
- PR Required Quality/E2E/Docker aggregates: DEFERRED — Exact PR head/base/test-merge/run/attempt must be verified by GitHub Actions
- 6 independent Chromium runners and fail-fast: DEFERRED — Local worker=1 cannot reproduce six GitHub runners
- npm audit --omit=dev: DEFERRED — Requires npm registry and CI environment; run explicitly if available
- remote Compose/transport/GHCR: DEFERRED — Local test never accesses production runtime or registry

## Selected tests and reasons
- tests/e2e/project-task-context-menu.spec.ts [chromium]: Changed test itself

## Excluded, unknown and missing
- None

- Playwright traces/report: NOT TESTED
- Manager/Owner acceptance: NOT TESTED. Local PASS does not approve a merge.
