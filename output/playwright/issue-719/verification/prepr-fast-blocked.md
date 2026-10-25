# Local Pre-PR Verify — BLOCKED

- Issue: 719, PR: N/A, mode: fast, risk: HIGH
- Base: origin/main (d2768676aa7a0edff67df9bdeb3e1b49979fd577)
- Head: d2768676aa7a0edff67df9bdeb3e1b49979fd577; working fingerprint: f0c12fd3b93b43b0078d0ca817902a75fed050a655186f8764a07d2fd1a2affa
- End source: f0c12fd3b93b43b0078d0ca817902a75fed050a655186f8764a07d2fd1a2affa; source stable: true
- Platform: linux/6.6.87.2-microsoft-standard-WSL2, Node v22.14.0, npm 11.10.0
- Playwright: 1.63.0, Chromium *expected metadata revision*: 1243, executable: Playwright-managed (expected revision; actual browser launch is tested only by E2E)
- Changed paths: 226
- Selection: BLOCKED, selected 16 tests, UNKNOWN 10, missing 0
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
- tests/e2e/issue-719-contextual-help.spec.ts [chromium]: Changed test itself
- tests/e2e/master-controls-density.spec.ts [chromium]: Changed test itself
- tests/e2e/milestone-stage-editor.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/e2e/project-logistics-management.spec.ts [chromium]: Changed test itself
- tests/e2e/project-resource-calendar-persistence.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/e2e/project-task-persistence.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/e2e/project-work-calendar-preview.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/e2e/resource-drill-ui.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/features/gantt/axis-transaction-runtime-fixture.test.ts [unit]: locked dependencies and installed-Core capture provenance → strict manifests, Core runtime and browser compatibility
- tests/features/gantt/axis-transaction.test.ts [unit]: shared resource/calendar/milestone consumers and persisted state
- tests/features/gantt/canonical-recovery-runtime.test.ts [unit]: locked dependencies and installed-Core capture provenance → strict manifests, Core runtime and browser compatibility
- tests/features/gantt/date-adapter.test.ts [unit]: shared resource/calendar/milestone consumers and persisted state
- tests/features/gantt/milestone-timeline-adapter.test.ts [unit]: shared resource/calendar/milestone consumers and persisted state
- tests/features/gantt/state-consistency-runtime-fixture.test.ts [unit]: locked dependencies and installed-Core capture provenance → strict manifests, Core runtime and browser compatibility
- tests/scripts/prepr-verifier.test.ts [unit]: locked dependencies and installed-Core capture provenance → strict manifests, Core runtime and browser compatibility; Pre-PR tool parser, source provenance, failure and safety regression

## Excluded, unknown and missing
- UNKNOWN src/app/logistics-admin/page.tsx: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN src/app/project-master-admin/page.tsx: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN src/components/ui/context-help.module.css: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN src/components/ui/context-help.tsx: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN src/features/logistics/project-logistics-dashboard.module.css: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN src/features/logistics/project-logistics-dashboard.tsx: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN src/features/logistics/project-logistics-management.module.css: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN src/features/logistics/project-logistics-management.tsx: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN src/features/project-master/project-master-admin.module.css: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN src/features/project-master/project-master-admin.tsx: No verified producer→consumer test map. Manager must map/verify.

- Playwright traces/report: NOT TESTED
- Manager/Owner acceptance: NOT TESTED. Local PASS does not approve a merge.
