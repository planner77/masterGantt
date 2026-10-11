# Issue #608 — T3 canonical trace 검증 Work Packet

- Parent: #593; positive baseline: #606 / PR #607, T1/T2 PASS.
- Baseline main: `c81285741610ad28dc5d6b50f9bb97264970a79d`
- Branch: `test/issue-608-t3-canonical-trace`
- Scope: no-op public marker + this Work Packet; test PR never merged.
- Changed-file risk: LOW. QA method: OWNER_MANAGED.
- Issue-level tests: T3~T9; **this PR is exclusively for T3**.
- `release_required=false`, `release_authorized=false`, `manager_decision=NOT TESTED`.
- Tests **NOT TESTED until GitHub run IDs and verdicts recorded**.

## Runbook (no simultaneous PR head/base edits)
1. Create draft PR with *correct* single-line `Refs #608` and title including `Issue #608`; verify full PR CI Quality, Chromium E2E six shards and Docker aggregates SUCCESS and separate default-branch Trusted QA PASS. The PR contains a public static inert fixture only; no executable or protected changes.
2. After the positive baseline, change **only PR title** to `[Issue #999999] test: T3 deliberately mismatched canonical trace` while leaving the PR body `Refs #608` untouched. This invokes metadata edited; do **not** merge or modify code. Expect fail-closed `FAIL/BLOCKED` and no Trusted PASS. Record precise source run/attempt and why policy rejected it. Do not falsely count a source CI failure as a successful direct QA predicate test.
3. Restore canonical title `[Issue #608] test: Trusted QA T3 canonical trace negative/recovery` with no code commit; expect metadata-only validation to reuse exact original full CI when base/head/test merge match, and separate Trusted PASS. A changed main/base means stale proof; restart with a fresh full CI rather than forcing green.
4. Record all CI/Trusted run IDs, attempts, verdict logs, Head/base/test-merge/validator SHA, old evidence reuse, Runner duration/number of jobs. Confirm Owner ACCEPT remains separate and metadata-only does not launch heavy E2E/Docker.
5. On completion close PR **without merge**, delete branch (GitHub UI manual deletion if connector cannot delete); preserve Issue #608 for T4~T9. Existing Dependabot PR #591 and production workflows must not be edited.

## DOCUMENTATION_SYNC
- `docs/exec-plans/active/ISSUE_608.md`: UPDATED (this scoped negative-test Work Packet).
- `public/qa-trusted-t3-issue-608.txt`: UPDATED (inert T3 marker).
- `AGENTS.md`: N/A(no change in policy, agent procedures, or QA gates).
- `docs/QA_REVIEW_POLICY.md`: N/A(existing correct trace/fail-closed validation only).
- `docs/ISSUE_LIFECYCLE.md`: N/A(test PR never merged).
- `docs/CI_CD.md`: N/A(no workflow, required aggregate, or release change).
- `docs/GITHUB_OPERATIONS.md`: N/A(no operational configuration change).
- `docs/REMOTE_VALIDATION.md`: N/A(existing #593 T3 validation procedure used).
- `docs/TEST_PLAN.md`: N/A(existing #593 T3 matrix used).
- `DESIGN.md`: N/A(no UI/UX changes).
- `docs/API.md`: N/A(no API changes).
- `docs/DB_SCHEMA.md`: N/A(no DB changes).

## AC_TEST_COVERAGE
- AC1: This PR contributes T3 only; T4~T9 remain NOT TESTED and require their own evidence.
- AC2: T3 original valid full run and Trusted PASS, edited mismatch fail-closed, edited restoration and Trusted PASS.
- AC3: Source run/attempt/validator SHA and malformed canonical trace detection; T4/T5 separately.
- AC4: Preserve no-code-change and protected/Ruleset boundaries; T6/T7 separately.
- AC5: automated QA PASS does not grant Manager ACCEPT; T8/T9 separately.
- AC6: No merge, cleanup and isolation from existing T1/T2 / other PRs.
- AC7: File bug issue only if behavior deviates from verified expected behavior.

## Evidence ledger
| Phase | PR Head/base/test merge | CI Run | Trusted Run | Expected/actual |
| --- | --- | --- | --- | --- |
| Valid initial | NOT TESTED | NOT TESTED | NOT TESTED | PASS target |
| Broken title | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED/FAIL target |
| Corrected title | NOT TESTED | NOT TESTED | NOT TESTED | PASS target |
