# Local Pre-PR Verify — BLOCKED

- Issue: 730, PR: N/A, mode: targeted, risk: HIGH
- Base: 01fdc08bf4b2f69f9797a8bd411d6712e7478c09 (01fdc08bf4b2f69f9797a8bd411d6712e7478c09)
- Head: 01fdc08bf4b2f69f9797a8bd411d6712e7478c09; working fingerprint: 6e816040174aac50d284a645b9984cb6c6b01ced7a80a922f2c5bc4b6df37e38
- End source: 6e816040174aac50d284a645b9984cb6c6b01ced7a80a922f2c5bc4b6df37e38; source stable: true
- Platform: linux/6.6.87.2-microsoft-standard-WSL2, Node v22.14.0, npm 11.10.0
- Playwright: 1.63.0, Chromium *expected metadata revision*: 1243, executable: Playwright-managed (expected revision; actual browser launch is tested only by E2E)
- Changed paths: 58
- Selection: BLOCKED, selected 27 tests, UNKNOWN 4, missing 0
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
- tests/e2e/issue-624-logistics-unified.spec.ts [chromium]: Changed test itself
- tests/e2e/issue-730-view-composer.spec.ts [chromium]: Changed test itself; Manager manual include
- tests/e2e/milestone-dashboard-state.spec.ts [chromium]: project workspace and canonical Copy guard → error/readonly/selection/Milestone Dashboard/hidden-subtree negative paths
- tests/e2e/milestone-stage-editor.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/e2e/milestone-visibility.spec.ts [chromium]: project workspace and canonical Copy guard → error/readonly/selection/Milestone Dashboard/hidden-subtree negative paths
- tests/e2e/project-edit-authorization.spec.ts [chromium]: project workspace and canonical Copy guard → error/readonly/selection/Milestone Dashboard/hidden-subtree negative paths
- tests/e2e/project-multi-task-copy-paste.spec.ts [chromium]: project workspace and canonical Copy guard → error/readonly/selection/Milestone Dashboard/hidden-subtree negative paths
- tests/e2e/project-notifications.spec.ts [chromium]: project workspace and canonical Copy guard → error/readonly/selection/Milestone Dashboard/hidden-subtree negative paths
- tests/e2e/project-resource-calendar-persistence.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/e2e/project-task-delete-context.spec.ts [chromium]: project workspace and canonical Copy guard → error/readonly/selection/Milestone Dashboard/hidden-subtree negative paths
- tests/e2e/project-task-persistence.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/e2e/project-task-quick-view.spec.ts [chromium]: project workspace and canonical Copy guard → error/readonly/selection/Milestone Dashboard/hidden-subtree negative paths
- tests/e2e/project-work-calendar-preview.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/e2e/project-workspace-tabs-518.spec.ts [chromium]: Changed test itself
- tests/e2e/resource-drill-ui.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/features/gantt/axis-transaction-runtime-fixture.test.ts [unit]: locked dependencies and installed-Core capture provenance → strict manifests, Core runtime and browser compatibility
- tests/features/gantt/axis-transaction.test.ts [unit]: shared resource/calendar/milestone consumers and persisted state
- tests/features/gantt/canonical-recovery-runtime.test.ts [unit]: locked dependencies and installed-Core capture provenance → strict manifests, Core runtime and browser compatibility
- tests/features/gantt/date-adapter.test.ts [unit]: shared resource/calendar/milestone consumers and persisted state
- tests/features/gantt/milestone-timeline-adapter.test.ts [unit]: shared resource/calendar/milestone consumers and persisted state
- tests/features/gantt/state-consistency-runtime-fixture.test.ts [unit]: locked dependencies and installed-Core capture provenance → strict manifests, Core runtime and browser compatibility
- tests/features/resources/resource-drill-navigation-model.test.ts [unit]: Changed test itself
- tests/features/resources/wbs-view-model.test.ts [unit]: Changed test itself
- tests/features/resources/wbs-view-transport.test.ts [unit]: Changed test itself
- tests/scripts/prepr-verifier.test.ts [unit]: locked dependencies and installed-Core capture provenance → strict manifests, Core runtime and browser compatibility; Pre-PR tool parser, source provenance, failure and safety regression
- tests/server/resources/wbs-dashboard-views-http.test.ts [unit]: Manager manual include

## Excluded, unknown and missing
- UNKNOWN src/features/logistics/project-logistics-management.tsx: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN src/features/logistics/project-logistics-unified.tsx: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN src/features/logistics/project-process-management.tsx: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN tests/e2e/fixtures/wbs-view-composer.ts: No verified producer→consumer test map. Manager must map/verify.

- Playwright traces/report: NOT TESTED
- Manager/Owner acceptance: NOT TESTED. Local PASS does not approve a merge.
