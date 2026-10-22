# Local Pre-PR Verify — BLOCKED

- Issue: 730, PR: 747, mode: fast, risk: HIGH
- Base: fbe7db83a4baa2877a75db0769a59077bbe308c4 (fbe7db83a4baa2877a75db0769a59077bbe308c4)
- Head: b4ba9994ee77a8dbc4a3bb36c8ee6e00beab7a51; working fingerprint: a8a5c562d1b68b7f1b1620af7bff020e4bce912d08b433fb329920795b53509e
- End source: a8a5c562d1b68b7f1b1620af7bff020e4bce912d08b433fb329920795b53509e; source stable: true
- Platform: linux/6.6.87.2-microsoft-standard-WSL2, Node v22.14.0, npm 11.10.0
- Playwright: 1.63.0, Chromium *expected metadata revision*: 1243, executable: Playwright-managed (expected revision; actual browser launch is tested only by E2E)
- Changed paths: 122
- Selection: BLOCKED, selected 36 tests, UNKNOWN 5, missing 0
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
- tests/e2e/issue-621-resource-target.spec.ts [chromium]: Changed test itself
- tests/e2e/issue-623-resource-mvp.spec.ts [chromium]: Changed test itself
- tests/e2e/issue-624-logistics-unified.spec.ts [chromium]: Changed test itself
- tests/e2e/issue-717-identity-persistence.spec.ts [chromium]: Changed test itself
- tests/e2e/issue-719-contextual-help.spec.ts [chromium]: Changed test itself
- tests/e2e/issue-730-view-composer.spec.ts [chromium]: Changed test itself
- tests/e2e/milestone-dashboard-state.spec.ts [chromium]: project workspace and canonical Copy guard → error/readonly/selection/Milestone Dashboard/hidden-subtree negative paths; Changed test itself
- tests/e2e/milestone-stage-editor.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/e2e/milestone-stage-grid.spec.ts [chromium]: Changed test itself
- tests/e2e/milestone-visibility-persistence.spec.ts [chromium]: Changed test itself
- tests/e2e/milestone-visibility.spec.ts [chromium]: project workspace and canonical Copy guard → error/readonly/selection/Milestone Dashboard/hidden-subtree negative paths; Changed test itself
- tests/e2e/project-edit-authorization.spec.ts [chromium]: project workspace and canonical Copy guard → error/readonly/selection/Milestone Dashboard/hidden-subtree negative paths
- tests/e2e/project-filter-toolbar-consistency.spec.ts [chromium]: Changed test itself
- tests/e2e/project-multi-task-copy-paste.spec.ts [chromium]: project workspace and canonical Copy guard → error/readonly/selection/Milestone Dashboard/hidden-subtree negative paths
- tests/e2e/project-notifications.spec.ts [chromium]: project workspace and canonical Copy guard → error/readonly/selection/Milestone Dashboard/hidden-subtree negative paths
- tests/e2e/project-resource-calendar-persistence.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/e2e/project-search-filter.spec.ts [chromium]: Changed test itself
- tests/e2e/project-task-delete-context.spec.ts [chromium]: project workspace and canonical Copy guard → error/readonly/selection/Milestone Dashboard/hidden-subtree negative paths
- tests/e2e/project-task-persistence.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/e2e/project-task-quick-view.spec.ts [chromium]: project workspace and canonical Copy guard → error/readonly/selection/Milestone Dashboard/hidden-subtree negative paths
- tests/e2e/project-work-calendar-preview.spec.ts [chromium]: shared resource/calendar/milestone consumers and persisted state
- tests/e2e/project-workspace-tabs-518.spec.ts [chromium]: Changed test itself
- tests/e2e/project-workspace-ux.spec.ts [chromium]: Changed test itself
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
- tests/scripts/e2e-read-only-requests.test.ts [unit]: Changed test itself
- tests/scripts/prepr-verifier.test.ts [unit]: locked dependencies and installed-Core capture provenance → strict manifests, Core runtime and browser compatibility; Pre-PR tool parser, source provenance, failure and safety regression

## Excluded, unknown and missing
- UNKNOWN src/features/logistics/project-logistics-management.tsx: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN src/features/logistics/project-logistics-unified.tsx: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN src/features/logistics/project-process-management.tsx: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN tests/e2e/fixtures/wbs-view-composer.ts: No verified producer→consumer test map. Manager must map/verify.
- UNKNOWN tests/e2e/helpers/read-only-requests.ts: No verified producer→consumer test map. Manager must map/verify.

- Playwright traces/report: NOT TESTED
- Manager/Owner acceptance: NOT TESTED. Local PASS does not approve a merge.
