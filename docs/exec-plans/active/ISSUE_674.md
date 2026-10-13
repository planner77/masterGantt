# Issue #674 — #659 Main CI #2712 Milestone 대형 Fixture 진단 식별자 초기화 경합

## Baseline / Source of truth
- Issue: https://github.com/planner77/masterGantt/issues/674
- Failure origin: [#659 PR #660](https://github.com/planner77/masterGantt/pull/660) merged SHA `3b21fe6e17ccc8abcdc9dc634c0a73b82dfa78bb`, [Main CI #2712.1](https://github.com/planner77/masterGantt/actions/runs/38470067933) completed/**failure**. Immutable failure artifact is preserved, not retroactively marked SUCCESS.
- Failing Chromium shard 4: `tests/e2e/milestone-timeline-lane.spec.ts:173` #551 1,000 Task + 2,000 Milestone fixture. Exact predicate `frame.dataset.projectGanttApiInstance === frame.__masterganttMilestoneTimeline.instance` plus callable `read` did not become true within 5,000ms. Other 5 shards and TypeScript/ESLint/Vitest/Build/Docker PASS.
- Initial branch `fix/issue-674-main-e2e-api-identity` from main `e195780227a504536d0d9f7f27924f24267f8caf` (version `0.108.0`). New run/head/base are NOT TESTED before GitHub execution.
- [Later Main CI #2718.1](https://github.com/planner77/masterGantt/actions/runs/38473289913) completed/SUCCESS but the E2E implementation shard was **SKIPPED** by path routing; it does not constitute this #551 3,000-row regression passing.

## Cause / Scope
- `ProjectGantt.initialize(api)` publishes `__masterganttMilestoneTimeline` immediately via `installMilestoneProbe`, and then calls `setApiInstanceId(initializedId)`. React's `data-project-gantt-api-instance={apiInstanceId ?? undefined}` is populated on a later state commit; the expensive projection of the 3,000-row fixture can delay that commit. This confirmed **source-order gap** is corrected. Exact CPU scheduling/root cause of the prior 5-second timeout remains a hypothesis without the original trace's full timeline.
- A pure `stampInitializedGanttApiIdentity` publishes **only** the precise init callback ID to the connected frame before the development-only probe. It is invoked only after checking `NODE_ENV !== production` and `frame.isConnected`; React subsequently reconciles to the same value.
- No polling/sleep/timeout increase, retry/skip/Fixture reduction, semantically earlier fake `read()`, production probe, duplicate Gantt API, explicit Core private store mutation or change to canonical Task/Milestone data. Existing 5s predicate, 1,000+2,000 fixture, layout/scroll/fullscreen/resize/zero-mutation assertions remain byte-identical.

## DOCUMENTATION_SYNC
- `src/features/gantt/project-gantt.tsx`: UPDATED — publish the real API identity in synchronous SVAR init's diagnostic setup.
- `src/features/gantt/gantt-api-identity.ts`: ADDED — narrow pure helper for connected frame and repeated initialization.
- `tests/gantt-api-identity.test.ts`: ADDED — exact ID, stale ID replacement and disconnected frame regression.
- `tests/e2e/milestone-timeline-lane.spec.ts`: N/A — original 5s performance/geometry/large fixture gate intentionally unchanged.
- `docs/MILESTONE_TIMELINE.md`: UPDATED — dev probe publication/lifecycle order, no geometry readiness overclaim.
- `docs/TEST_PLAN.md`: UPDATED — targeted fast unit and immutable 5s actual Chromium E2E test conditions.
- `docs/REMOTE_VALIDATION.md`: UPDATED — #2712 failure and new exact-head PR/Main E2E 6/6 validation.
- `docs/CI_CD.md`: UPDATED — rerun vs new SHA/PR/Main safety and path filter gap.
- `docs/exec-plans/active/PLAN.md`: UPDATED — corrective issue execution and release scope.
- `docs/exec-plans/active/ISSUE_674.md`: ADDED — AC trace, risk and decisions.
- `CHANGELOG.md`: UPDATED — dev-only diagnostic fix; immutable #2712 failure.
- `AGENTS.md`: N/A — lifecycle/role/review guidance and CI QA contracts unchanged.
- `DESIGN.md`, `docs/UI_UX_GUIDELINES.md`, `docs/PROJECT_UX.md`: N/A — no layout, visual or interaction contract change.
- `docs/ARCHITECTURE.md`, `docs/QA_REVIEW_POLICY.md`, `docs/GITHUB_OPERATIONS.md`: N/A — no public API, trust boundary, review or owner policy change.
- `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/SECURITY.md`, `docs/SCHEDULING_ENGINE.md`: N/A — service contracts/DB/security/schedule immutable.
- `package.json`/`package-lock.json`: N/A — version `0.108.0` remains; CI-only dev diagnostic repair, no new SemVer release/GHCR formal promotion.

## AC_TEST_COVERAGE
- AC1: `tests/gantt-api-identity.test.ts` publishes an exact initialized ID to a connected frame without a React update and follows the same `initialize(api)` callpath as the milestone probe; original E2E oracle retains exact identity requirement. Full running integration NOT TESTED before CI.
- AC2: the existing `tests/e2e/milestone-timeline-lane.spec.ts` 3,000-item #551 case, unchanged native 5-second readiness, Chart/Grid peer scroll/resize/fullscreen and geometry; new PR and Main E2E shard outputs required. NOT TESTED before remote CI.
- AC3: Vitest unit assertions: exact ID, second init replaces stale value and disconnected frame unchanged. GitHub CI TypeScript/ESLint/Vitest required; NOT TESTED before remote CI.
- AC4: updated docs and no-code-change rationale as mapped in DOCUMENTATION_SYNC; product version and release owner policies unchanged.
- AC5: fresh PR exact HEAD with Quality/E2E six shards/Docker/QA Final, unresolved review threads zero, mergeable clean; user explicitly requested merge/Main CI after verified PR. Official new Main push SHA needs its own full E2E evidence. New exact Main CI to be started only after merge.
- AC6: inspect existing `.github/workflows/ci.yml` PR fail-fast true/`--max-failures=1`, Main fail-fast false, `if:always()` aggregates, Trusted QA/GHCR/Finalizer guards. Workflow and policy source files not edited.

## Risk / QA / Release
risk_level: HIGH
qa_method: OWNER_MANAGED
qa_required: true
manager_decision: NOT TESTED
release_required: false
release_authorized: false

- Owner requested: correct Main CI failure and start a fresh Main CI. Safe chain is corrective PR exact-head CI, review threads and source main alignment, merge with canonical one-line subject and new Main CI push. A rerun of #2712 on the *old immutable SHA* is diagnostic recovery, not validation of the new patch. If CI is still running, do not bypass its result or claim merge readiness.
