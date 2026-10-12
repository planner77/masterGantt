# Issue #643 — trusted manual recovery workflow identity Work Packet

**Primary Issue:** #643
**Related:** completed Issue #639 / PR #641–#642; pending original release Issue #616 / PR #631.
**Base:** main `5da9c039422647490a947c5cd1e80ec24df22db2`, app `0.107.0`.
**Branch:** `fix/issue-643-recovery-workflow-identity`
**Risk:** HIGH, `qa_method=OWNER_MANAGED`, `qa_required=true`, `manager_decision=NOT TESTED`, `independent_qa=N/A(Owner-managed)`, `release_required=false`, `release_authorized=false`.

## Root cause / evidence

- GitHub Actions `run-name` for workflow `.github/workflows/ci.yml` is event-dependent. Real successful [CI #2612.1](https://github.com/planner77/masterGantt/actions/runs/38302427091) has:
  - `run.name=Main CI · Issue #639 · PR #642 · Main CI 제목 계약 교정 · Run #2612.1`
  - `run.workflow_id=356198495`, `run.path=.github/workflows/ci.yml`
  - `run.repository.full_name=planner77/masterGantt`, `head_repository.full_name=planner77/masterGantt`.
- Previous `scripts/main_ci_recovery.py::completed_evidence` uses `run.name == "CI"`; `CI` is the **definition** name, not a stable run-instance value. This is a proven API/validator mismatch; there is no prior Owner `workflow_dispatch` recovery run, so actual dispatch failure remains NOT TESTED.
- Official GitHub API: `GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}` accepts filename `ci.yml`; returns `id,name,path,state` and requires Actions read. Ref: https://docs.github.com/en/rest/actions/workflows#get-a-workflow.

## Implementation / trust boundary

1. Add `verified_workflow_identity(repo,run)` checking run positive integer `workflow_id`, exact `path`, run source repository/head repository, then trusted workflow metadata `GET /actions/workflows/ci.yml` `id/name/path/state=active`; reject UNKNOWN or mismatch before any Owner/attestation/GHCR evidence.
2. Stop using `run.name`/`display_title` as authorization. Retain `workflow_dispatch/main/completed/success`, exact run ID+attempt, actor Owner, current main, original merged PR/Issue, version/first-parent, Owner version/recovery markers, pristine artifact, all Quality/E2E6/Docker jobs, private GHCR digest and Finalizer source SHA.
3. Add isolated GitHub API response mock positive including actual dynamic run-name (also absent/arbitrary), negative alternate source workflow ID/path/repo/head_repo, metadata id/name/path/state UNKNOWN or mismatched, attempted spoofing via `name=CI`, failed/foreign run, source artifact mismatch.
4. Add protected static verification to `scripts/verify-issue-lifecycle.py` and documentation sync. Original `ci.yml`, required aggregate names, GHCR permissions, release rule and product version are unchanged.

## DOCUMENTATION_SYNC

- `scripts/main_ci_recovery.py`: UPDATED
- `scripts/test_main_ci_recovery.py`: UPDATED
- `scripts/verify-issue-lifecycle.py`: UPDATED
- `AGENTS.md`: UPDATED (general trusted source identity guidance)
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_643.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A (existing HIGH/OWNER_MANAGED boundaries unchanged)
- `.github/workflows/ci.yml`, `.github/workflows/release-finalizer.yml`: N/A (workflow event/permissions unchanged)
- `DESIGN.md`, `docs/UI_UX_GUIDELINES.md`, `docs/API.md`, `docs/DB_SCHEMA.md`: N/A (no UI/API/schema changes)
- `package.json`, `package-lock.json`: N/A (no version/dependency changes)
- `docs/LOGISTICS_TARGETS.md`: N/A (not changing business feature)

## AC_TEST_COVERAGE

- **AC1:** Dynamic `run.name` and spoofed `display_title` do not authenticate/reject an otherwise exact trusted source. Cross-check `run.workflow_id/path/repo/head_repo` to metadata `CI/ci.yml/active/id`, with immutable run ID.
- **AC2:** Missing/foreign ID/path/repository/head repository, metadata UNKNOWN or inactive/mismatch, even with `run.name="CI"`, all BLOCKED. No API fallback to display strings.
- **AC3:** `event=workflow_dispatch`, main, success, Owner, exact first-parent/PR/Issue/version/comment/artifact/attempt, all Quality/E2E6/Docker, GHCR digest remain unchanged and fail-closed. Push/ordinary diagnostic cannot gain posting rights.
- **AC4:** `python3 scripts/test_main_ci_recovery.py` offline deterministic positive/negative; `python3 scripts/verify-issue-lifecycle.py` static contract. No forged remote PASS.
- **AC5:** PR CI three Required aggregates on exact Head/Base + Trusted QA + 0 unresolved review threads. HIGH Owner merge approval separate. Main CI/GHCR after merge still requires live check.
- **AC6:** #616 explicit Owner recovery dispatch, v0.107.0 GHCR image/tag/Finalizer, candidate-provenance and Issue close all **not within this step**.

## Evidence and next gates

- Existing #639 Main CI [#2612.1](https://github.com/planner77/masterGantt/actions/runs/38302427091) **SUCCESS** and [Finalizer #180.1](https://github.com/planner77/masterGantt/actions/runs/38303295195) **SUCCESS**, #639 Closed; none of these are manual recovery evidence for #616.
- This Issue #643: new source verifier PR CI / Trusted QA **NOT TESTED** until GitHub returns results. Local scripts execution **NOT TESTED** in connected repo environment; static code review only.
- Next: complete PR CI, resolve review threads, default-branch Trusted QA; hold merge for explicit user approval. After merge + Main CI, Owner adds new separate #616 exact-scoped recovery authorization and dispatches CI from Actions UI. No forced tag, SHA rewriting, or premature release.
