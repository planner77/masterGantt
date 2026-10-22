# Local Pre-PR Verify — BLOCKED

- Issue: 735, PR: N/A, mode: fast, risk: HIGH
- Base: origin/main (8a0fc9773d33326b40f8d97f6307c17ae0cb6933)
- Head: 8a0fc9773d33326b40f8d97f6307c17ae0cb6933; working fingerprint: bc593db5bdc2d1edf5f36616e96ff53ec2aef626fa52765928d08cd62a953f46
- End source: bc593db5bdc2d1edf5f36616e96ff53ec2aef626fa52765928d08cd62a953f46; source stable: true
- Platform: linux/6.6.87.2-microsoft-standard-WSL2, Node v22.14.0, npm 11.10.0
- Playwright: 1.63.0, Chromium *expected metadata revision*: 1243, executable: Playwright-managed (expected revision; actual browser launch is tested only by E2E)
- Changed paths: 41
- Selection: BLOCKED, selected 33 tests, UNKNOWN 3, missing 0
- Residual risks: BLOCKED: unknown/missing impacted tests; Manager must map scope before local PASS

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
- tests/e2e/gantt-state-product-integration.spec.ts [chromium]: locked dependencies and installed-Core capture provenance → strict manifests, Core runtime and browser compatibility
- tests/e2e/issue-735-system-dashboard.spec.ts [chromium]: Changed test itself
- tests/e2e/milestone-stage-editor.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/e2e/project-create-isolation.spec.ts [chromium]: actual HTTP/SQLite/session/401/409/412/422/500, persistence and failure recovery; confirm actual assertions manually
- tests/e2e/project-edit-authorization.spec.ts [chromium]: actual HTTP/SQLite/session/401/409/412/422/500, persistence and failure recovery; confirm actual assertions manually
- tests/e2e/project-json-import.spec.ts [chromium]: actual HTTP/SQLite/session/401/409/412/422/500, persistence and failure recovery; confirm actual assertions manually
- tests/e2e/project-resource-calendar-persistence.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/e2e/project-task-persistence.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state; actual HTTP/SQLite/session/401/409/412/422/500, persistence and failure recovery; confirm actual assertions manually
- tests/e2e/project-work-calendar-preview.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/e2e/resource-drill-api.spec.ts [chromium]: actual HTTP/SQLite/session/401/409/412/422/500, persistence and failure recovery; confirm actual assertions manually
- tests/e2e/resource-drill-ui.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/features/gantt/axis-transaction-runtime-fixture.test.ts [unit]: locked dependencies and installed-Core capture provenance → strict manifests, Core runtime and browser compatibility
- tests/features/gantt/axis-transaction.test.ts [unit]: shared resource/calendar/milestone consumers and persisted state
- tests/features/gantt/canonical-recovery-runtime.test.ts [unit]: locked dependencies and installed-Core capture provenance → strict manifests, Core runtime and browser compatibility
- tests/features/gantt/date-adapter.test.ts [unit]: shared resource/calendar/milestone consumers and persisted state
- tests/features/gantt/milestone-timeline-adapter.test.ts [unit]: shared resource/calendar/milestone consumers and persisted state
- tests/features/gantt/state-consistency-runtime-fixture.test.ts [unit]: locked dependencies and installed-Core capture provenance → strict manifests, Core runtime and browser compatibility
- tests/features/resources/system-dashboard.test.ts [unit]: Direct import of changed server module; Changed test itself
- tests/features/resources/wbs-view-model.test.ts [unit]: Direct import of changed server module
- tests/scripts/prepr-verifier.test.ts [unit]: locked dependencies and installed-Core capture provenance → strict manifests, Core runtime and browser compatibility; Pre-PR tool parser, source provenance, failure and safety regression
- tests/server/db/database.test.ts [unit]: actual HTTP/SQLite/session/401/409/412/422/500, persistence and failure recovery; confirm actual assertions manually
- tests/server/projects/edit-authorization-handlers.test.ts [unit]: actual HTTP/SQLite/session/401/409/412/422/500, persistence and failure recovery; confirm actual assertions manually
- tests/server/projects/task-handler-integration.test.ts [unit]: actual HTTP/SQLite/session/401/409/412/422/500, persistence and failure recovery; confirm actual assertions manually
- tests/server/resources/issue-735-system-dashboard.test.ts [unit]: Changed test itself
- tests/server/resources/project-resource-memberships.test.ts [unit]: Direct import of changed server module
- tests/server/resources/resource-dashboard-rollup.test.ts [unit]: Direct import of changed server module
- tests/server/resources/resource-dashboard.test.ts [unit]: Direct import of changed server module
- tests/server/resources/resource-drill.test.ts [unit]: Direct import of changed server module
- tests/server/resources/resource-kpi-integration.test.ts [unit]: Direct import of changed server module
- tests/server/resources/resource-plan.test.ts [unit]: Direct import of changed server module
- tests/server/resources/resource-target-dashboard.test.ts [unit]: Direct import of changed server module
- tests/server/resources/wbs-dashboard-views-http.test.ts [unit]: Direct import of changed server module
- tests/server/templates/logistics-template-graph.test.ts [unit]: Direct import of changed server module

## Excluded, unknown and missing
- UNKNOWN src/contracts/wbs-dashboard-views.ts: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN src/features/logistics/project-logistics-unified.tsx: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN src/server/resources/wbs-dashboard-views-core.ts: No actual direct server-module test import found; generic smoke tests are insufficient

- Playwright traces/report: NOT TESTED
- Manager/Owner acceptance: NOT TESTED. Local PASS does not approve a merge.
