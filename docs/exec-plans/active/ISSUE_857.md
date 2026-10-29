# Issue #857 — v0.138.3 정식 GHCR Release Work Packet

- Primary Issue: https://github.com/planner77/masterGantt/issues/857
- Related implemented Issue: https://github.com/planner77/masterGantt/issues/854
- Main baseline: `3dd20ff3da5f3b3f8a6c337bdc61593c81c4daae`, CI [40957911031.1](https://github.com/planner77/masterGantt/actions/runs/40957911031) SUCCESS, artifact ID 12933143973 verified OCI retained.
- Base tree: `dedca627c221f0be87886dc67bc9cfbba3615c95`
- Branch: `release/issue-857-v0.138.3`
- Risk: `HIGH`, QA `OWNER_MANAGED`, `qa_required=true`, `release_required=true`, `release_authorized=true`.
- Owner's version-scoped release authorization: [comment 6509116199](https://github.com/planner77/masterGantt/issues/857#issuecomment-6509116199) — user's 2026-10-30 explicit request to publish formally, reusing validated OCI if eligible, rebuilding otherwise.
- Exact target version `0.138.3`; existing annotated `v0.138.2` peeled to `5ba0c275669a3521be120751ab260099df2c40aa`. Tag immutability is mandatory.
- PR/Main/Release requirements cannot be bypassed. New source package version makes old `0.138.2` OCI ineligible for formal `0.138.3`; PR→Main OCI conditional reuse (#836) is still preferred when exact source policy allows, otherwise rebuild.

## Scope / Non-scope

**Scope:** update `package.json`, `package-lock.json`, `CHANGELOG.md` and this packet; obtain PR Full CI/Trusted/Owner, zero unresolved reviews, latest Main merge, new exact Main Full CI, registry candidate/digest/policy/smoke and Release `v0.138.3` promotion, verified GHCR digest and lifecycle close.

**Non-scope:** app logic, SQLite schema/migrations, HTTP authorization, Gantt UI, issue #854 failure/FINAL audit, existing tags/images, workflow policies, QA gates, Docker deployment.

## TEST_LIFECYCLE_REVIEW / AC_TEST_COVERAGE

- Existing `scripts/verify-release-version.mjs` and its current release-policy regression suite: **KEEP_UNIQUE**; version validation must compare `package.json`, root lock package and immutable SemVer tags.
- Existing `tests/server/projects/project-issues.test.ts` and `tests/e2e/project-issues.spec.ts` from #854: **KEEP_UNIQUE**; no changes to logic/tests and no new duplicate tests.
- Existing PR Full Quality, Chromium8, Docker, Trusted QA, Main Full and Release static/E2E/candidate smoke: **KEEP_UNIQUE**; no skips, weakened asserts, timeout/runner changes.
- AC1 version metadata: both package version fields equal `0.138.3`, CHANGELOG entry.
- AC2/3 runtime integrity: exact latest PR/merge Main SHA, Full required checks, OCI same-subject/digest and live GHCR smoke.
- AC4 immutable authority: `v0.138.2` untouched, new annotated `v0.138.3` peeled to exact successful Main merge.
- AC5 final image: `ghcr.io/planner77/mastergantt:0.138.3` exact digest matches candidate and Release workflow; Finalizer closes #857 only after actual success.
- Until actual Actions evidence: **PR CI/Trusted/Main/Release/GHCR NOT TESTED; no claim of success**.

## DOCUMENTATION_SYNC

- `package.json`: UPDATED (SemVer only).
- `package-lock.json`: UPDATED (top-level and root package SemVer only).
- `CHANGELOG.md`: UPDATED (new patch release entry).
- `docs/exec-plans/active/ISSUE_857.md`: ADDED.
- `AGENTS.md`, `DESIGN.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/DB_SCHEMA.md`, `docs/ARCHITECTURE.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`, `docs/GITHUB_OPERATIONS.md`: N/A (no product/DB/API/UI or release-policy change; reuse existing documented contracts).
- Failure ledger: no new failures observed in this release PR yet. If required checks fail, create one cumulative `docs/ISSUE_857_FAILURE_ANALYSIS.md` and record direct/derived/not-executed before rerun.
