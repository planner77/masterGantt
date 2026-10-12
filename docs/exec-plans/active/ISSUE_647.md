# Issue #647 — #616 immutable recovery CI #2621 E2E failure work packet

**Primary Issue:** #647 (HIGH/OWNER_MANAGED, qa_required=true).
**Upstream:** original Issue #616/PR #631 merge `b97709df8b5c0974f3c8252ac97819f45f73a5b9` (open/immutable).
**Branch/base:** `fix/issue-647-milestone-delete-focus-recovery` from main `c9e695f2c6757d941f73e2c8d009442c9e5a74f0`.
**Version:** 0.107.0 unchanged; `release_required=false` for this isolated QA/accessibility fix; `release_authorized=false`, `manager_decision=NOT TESTED`, `independent_qa=N/A(Owner-managed)`.
**Requested boundary:** analyze #616's manual recovery CI failure; correct current-main focus and retain already-corrected resource KPI strict selector, synchronize documentation, start full PR CI. No merge/GHCR/formal v0.107.0 release authorization in this request.

## Verified failure / evidence

- [Manual recovery Run #2621.1](https://github.com/planner77/masterGantt/actions/runs/38313359094), `workflow_dispatch` from main controller `c9e695f2...`, actual checkout original target `b97709df...`. It is **not PR CI**.
- Shard3 job #115024221427: `tests/e2e/milestone-management.spec.ts:197` focus returns null after deletion confirmation; 122 pass / 1 fail / 1 skip. After the deleted trigger disappears, existing `focusMilestoneDashboard` schedules only one RAF, potentially while native modal still owns focus in asynchronous Dialog cleanup.
- Shard5 job #115024221361: `tests/e2e/resource-dashboard-ui.spec.ts:35` two `2건` buttons throw Playwright strict mode collision; 97 pass / 1 fail. **main already fixes this** via #639's unique `할당 Task` KPI. The original target's old source lacks the fix.
- Quality, Vitest, TS, lint, production build, Docker, E2E shard1/2/4/6 PASS. Chromium E2E required aggregate FAIL; GHCR candidate SKIPPED; no versioned formal release.
- GitHub blob comparison: Milestone management old/main test `93316bea427630dabe3a9b41f804442ec522bc50`, resource KPI old `3437b22e4312ab620fec775105e20542442d694e` and current `cf2c55501ff816b1fc5fe938472b41aaf0dc6871`. Actual native modal frame race is an evidence-based hypothesis; synthetic/current-head E2E is required to validate.

## Code design / verification

1. `src/features/projects/project-readonly-view.tsx`: after delete confirmation/cancel, restore Milestone list focus using finite 24-RAF bound; no focus attempt while any native `:modal` is open, source dashboard `data-project-public-id` must be current and tab visible. Use existing `isVisibleFocusTarget` for old trigger then `search/add/heading` fallback; preserve focus already successfully owned by this panel. No new uncontrolled timer or global event listener.
2. `tests/e2e/milestone-management.spec.ts`: after confirm hidden + deleted row absent, assert `document.activeElement` belongs to connected visible Milestone panel and focus marker is search/add/heading, then specific visible `Milestone 검색` input focused; retain canonical mutation count/revision/Gantt instance assertions.
3. Do **not** alter current `tests/e2e/resource-dashboard-ui.spec.ts`, already protected #639 exact metric selector, nor relax Chromium strict mode or use `.first()/.nth()`.
4. Tests to verify on actual new PR Head: TypeScript/ESLint/Vitest/Next build, full PR CI Quality/E2E/Docker required checks and Trusted QA, review threads resolved; environment-specific screenshot/effect before then NOT TESTED.
5. **Immutable recovery distinction:** PR CI on amended current main does not change historical `b977...`, which the #616 manual recovery checks out for every shard. Old #616 version-scoped Owner marker and release obligation remain, no override/skip/retag; a subsequent explicit safe corrected-version disposition is required before claiming historical formal release completion.

## DOCUMENTATION_SYNC

- `src/features/projects/project-readonly-view.tsx`: UPDATED
- `tests/e2e/milestone-management.spec.ts`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/MILESTONE_TIMELINE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_647.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `AGENTS.md`: N/A(Existing lifecycle, accessibility and QA guard unchanged)
- `DESIGN.md`: N/A(Existing Design Delta B focus rule unchanged; no new design direction)
- `docs/UI_UX_GUIDELINES.md`: N/A(Existing keyboard focus and modal guidance sufficient)
- `docs/SCHEDULING_ENGINE.md`: N/A(No Milestone Task status or scheduling algorithm changed)
- `docs/API.md`: N/A(No API route/request/response changes)
- `docs/DB_SCHEMA.md`: N/A(No DB migration or persistence schema changes)
- `docs/SECURITY.md`: N/A(No authentication or authorization policy changes)
- `.github/workflows/ci.yml`: N/A(No shard topology/permissions or required E2E policy change)
- `tests/e2e/resource-dashboard-ui.spec.ts`: N/A(Already fixed in current main by Issue #639; original immutable SHA differs)
- `package.json`: N/A(Application SemVer 0.107.0 preserved pending original release decision)
- `package-lock.json`: N/A(No dependency or version change)

## AC_TEST_COVERAGE

- AC1: `tests/e2e/milestone-management.spec.ts` delete-with-descendant confirmation removes source row and verifies visible same-project panel search actual focus after native `:modal` closes, with bounded retries.
- AC2: `focusMilestoneDashboard` keeps visible/connected trigger, fallback order search/add/heading, hidden/foreign/another modal checks and preserves already-owned focus; existing Escape/cancel/readonly behaviors covered by original Milestone E2E suite.
- AC3: current main #639 Resource KPI test is verified as repaired by blob diff, original #616 SHA is explicitly old and not rewritten, no E2E skip/shard-count relaxation.
- AC4: `docs/TEST_PLAN.md` and remote evidence preserve original Run failures; real exact-head PR CI required 3 + default-main Trusted QA and Review 0 are the official gates. Local Playwright/Vitest are NOT TESTED until observed.
- AC5: no formal v0.107.0 release/Issue #616 closure/attempt to reinterpret E2E old SHA as PASS. New test PR updates modern main only; any corrected-version source disposition requires explicit Owner decision.

## Initial status

- Code, docs changes prepared but PR CI/Trusted QA **NOT TESTED** until actual Actions run.
- Rollback: revert localized RAF logic and stronger browser assertion; existing modal/panel UX preserved, original #616 SHA and #2621 failed check immutably recorded.
