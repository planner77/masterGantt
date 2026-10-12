# Issue #645 — Immutable Main CI #2617 PR provenance recovery Work Packet

**Primary Issue:** #645. **Related original release Issue:** #616 (Open, `v0.107.0` formal release not yet published); #639/#643 closed trusted-controller repairs.
**Branch:** `fix/issue-645-commit-pr-recovery-proof` from main `a7779bd027d2c1093be0cb67388d671ba02b4800`.
**Risk:** HIGH; `qa_method=OWNER_MANAGED`; `qa_required=true`; `manager_decision=NOT TESTED`; `independent_qa=N/A(Owner-managed)`; `release_required=false`; `release_authorized=false`.
**App version:** `0.107.0` unchanged. This PR must not close #616 or publish its release.

## Evidence / verified root cause

- Original Issue #616 / PR #631 merged `b97709df8b5c0974f3c8252ac97819f45f73a5b9` (parents `1dc89522192ae2c64c6951c282116a0a34af3a13`, `fcb76af9aa74a8335d3744ec7fec94f113be6a4e`). The Owner recovery marker #6132769240 and version-specific release marker #6124632287 remain valid and exactly scoped.
- [Recovery CI #2617.1](https://github.com/planner77/masterGantt/actions/runs/38310183123) (`workflow_dispatch`, trusted source `a7779bd...`) failed **before** implementation tests: `changes` job #115013710881, `scripts/main_ci_recovery.py authorize`, `BLOCKED: ... commit-to-PR identity not uniquely verified`.
- Live GitHub REST `GET /commits/b97709df.../pulls` returned `[]`; `GET /pulls/631` `merged=true`, state=closed, exact `merge_commit_sha`, correct PR base/head; `GET /pulls?state=closed&sort=updated&direction=desc` returned matching #631. This disproves the assumption that a valid two-parent merge must appear in the commit association endpoint; it does not authorize any missing PR without independent proof.

## Implementation & security invariants

1. `scripts/main_ci_recovery.py::verified_merge_pr_association()`: **direct** indexed 1 exact associated merged PR normally. If the commit association index is empty, enumerate **every** closed PR page (per_page=100, max 100 pages, bounded fail-closed) and require one unique exact `merge_commit_sha`, numbered PR, state closed and nonempty `merged_at`; do not infer permission from the index gap.
2. No alternate trust for ambiguous/incomplete/disabled APIs, 2+ associations, unknown/mismatched SHA, unmerged PR or paging limits. Preserve `GET /pulls/{PR}` explicit `merged=true`, canonical `Refs #Issue`, verified head repository/base branch and verify Git merge parent1==PR base SHA, parent2==PR head SHA. Existing trusted Owner/release approvals, main first-parent, version, original missing push run, source workflow ID/attempt, artifact, all Quality/E2E6/Docker jobs and GHCR digest remain.
3. `scripts/test_main_ci_recovery.py`: offline real #2617 fallback, direct positive, duplicate/mismatch/unmerged/typed ID/partial history/paging/API negatives and full `validate()` parent guards; never use external GitHub API or registry writes. `scripts/verify-issue-lifecycle.py` static policy regression. No CI workflow/Ruleset/permissions change.
4. Requested scope: fix code, sync AGENTS and affected operational docs, submit independent non-release PR and start PR CI. Owner merges and separately starts original #616 recovery dispatch; this Work Packet does not constitute approval to publish v0.107.0.

## DOCUMENTATION_SYNC

- `scripts/main_ci_recovery.py`: UPDATED
- `scripts/test_main_ci_recovery.py`: UPDATED
- `scripts/verify-issue-lifecycle.py`: UPDATED
- `AGENTS.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_645.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(Existing HIGH OWNER_MANAGED review and gate contracts unchanged)
- `DESIGN.md`: N/A(No UI or common design guidance changes)
- `docs/API.md`: N/A(No product API contract changes)
- `docs/DB_SCHEMA.md`: N/A(No database schema or migrations)
- `docs/SECURITY.md`: N/A(Existing CI trust controls documented in operation and lifecycle docs)
- `docs/ISSUE_LIFECYCLE_AUTOMATION.md`: N/A(Generic automation not modified by manual recovery validator)
- `.github/workflows/ci.yml`: N/A(Existing push PR and manual recovery trigger untouched)
- `.github/workflows/release-finalizer.yml`: N/A(Existing Finalizer source and GHCR identity untouched)
- `package.json`: N/A(No app version change)
- `package-lock.json`: N/A(No package dependency update)

## AC_TEST_COVERAGE

- AC1: Exact original SHA `b97709df...`, Owner `#616`/PR `#631`; empty commit association + independent uniquely merged closed PR history positive fixture. Direct unique commit association still passes.
- AC2: Duplicate/wrong/unmerged/stale/unsupported metadata and truncated or malformed history APIs all fail-closed. Two immutable Git parents must match separately authenticated PR base/head.
- AC3: Owner marker and version release approval, trusted workflow dispatch, original first-parent SHA and absent push CI, run/attempt artifact, full Quality/Chromium6/Docker and GHCR candidate digest remain mandatory.
- AC4: `python3 scripts/test_main_ci_recovery.py` full mocked regression and `python3 scripts/verify-issue-lifecycle.py` static policy. No network or live registry results treated as offline fixture PASS.
- AC5: Official exact-head PR CI Quality/E2E/Docker required aggregates and default-main Trusted QA + review thread resolution; Owner HIGH merge consent separately.
- AC6: Version-neutral Issue #645 does not supersede original #616 release obligation, create formal SemVer tags or complete #616 Finalizer; actual remote recovery end-to-end remains NOT TESTED until future Owner dispatch.

## Evidence / next gates

- Known failed source [CI #2617.1](https://github.com/planner77/masterGantt/actions/runs/38310183123): immutable FAILURE, did not publish original SHA candidate.
- GitHub real commit association index [] and closed PR history #631 evidence above, verified via connector.
- New PR required 3 CI and Trusted QA: **NOT TESTED until observed**. Local Python execution: **NOT TESTED** in GitHub-linked environment until remote policy steps run.
- No original #616 production recovery re-run, GHCR candidate, formal release or Issue close in this work scope.
