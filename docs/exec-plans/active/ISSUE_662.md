# Issue #662 — Release succession audit #17 / exact GHCR evidence

## Work Packet
- Source: https://github.com/planner77/masterGantt/issues/662
- Baseline main SHA: `89f4ab7936fe74062f0398601d4a6596e3e51924`.
- Branch: `fix/issue-662-audit-ghcr-contract`. Infra-only read-only audit implementation, Python unit tests, documentation sync.
- Priority/risk: HIGH, release trust boundary. qa_method: OWNER_MANAGED; qa_required: true; manager_decision: NOT TESTED.
- Release: `release_required=false`, `release_authorized=false`, app version `0.107.0` unchanged.
- Scope: fix v-prefixed GHCR lookup, source-normalized inventory for 0.105.0/0.106.0/0.106.1/0.107.0/0.108.0, inspect canonical OCI digest, published CI candidate proof, granular failure provenance, fail-closed regressions.
- Non-scope: any GHCR/tag/Release mutation, runtime workflow_dispatch audit, Owner decision issuance, #616 retirement/close, PR merge.

## AC_TEST_COVERAGE
- AC1: `test_ghcr_bare_semver_and_published_candidate_digest`, `test_ghcr_missing_candidate_not_silently_positive`. GHCR exact `0.106.1`; Git `v0.106.1`; immutable SHA/digest.
- AC2: `test_ghcr_invalid_and_duplicate_metadata_fail_closed`, `test_oci_manifest_exact_name_and_top_level_descriptor`, existing 153 Git refs/missing metadata tests; authenticated package pages required, cannot infer ABSENT from 401/403/404/429.
- AC3: `published_candidate` schema/positive & negative fixture in `test_release_succession_preflight.py`; historical verified `ci-09bee924032b4126ff794ec7a485542fd72dd7bf` requires current exact manifest/digest. No unapproved lifecycle fallback.
- AC4: `main()` BLOCKED JSON + summary now includes stage/reason_code/Run/Attempt/main SHA/version/tag/expected_digest/actual_digest; no raw command stderr or Owner comment body. publish/retire/close_issue_616 remain false.
- AC5: `.github/workflows/ci.yml` already has policy job mandatory `python3 -m unittest discover -s tests/python -p 'test_release_succession_*.py' -v`; verify exact PR/Main log and all three required checks, trusted QA and unresolved review 0 in subsequent authorized execution. CURRENT: NOT TESTED.
- AC6: DOCUMENTATION_SYNC tracked below.
- AC7: Only after Owner-authorized merge and successful Main CI, Owner separately runs default-main `release-succession-audit.yml` workflow_dispatch; BLOCKED if Owner v0.107.0 revocation/v0.108.0 prepare absent. PREPARE_ONLY is not publish permission.

## DOCUMENTATION_SYNC
- AGENTS.md: UPDATED (runtime contract and guardrails)
- docs/CI_CD.md: UPDATED (CI suite and fail-closed provenance)
- docs/GITHUB_OPERATIONS.md: UPDATED (Owner vs implementation responsibility)
- docs/REMOTE_VALIDATION.md: UPDATED (validation boundary)
- docs/TEST_PLAN.md: UPDATED (AC/fixture coverage)
- docs/exec-plans/active/PLAN.md: UPDATED
- docs/exec-plans/active/ISSUE_662.md: ADDED
- CHANGELOG.md: UPDATED
- docs/QA_REVIEW_POLICY.md: N/A — existing HIGH OWNER_MANAGED/Trusted QA/manager approval gate unchanged.
- DESIGN.md: N/A — no application UI or UX changes.
- docs/API.md: N/A — no product HTTP API changes.
- docs/DB_SCHEMA.md: N/A — no schema or migrations.

## Independent provenance and remaining blockers
- Audit #17.1 https://github.com/planner77/masterGantt/actions/runs/38403028531 is immutable historical FAILURE, not retconned.
- Main #2579.1 / Release #165.2 and expected `sha256:0ab78272f2637ca73ae0a1e7bec4f41b24fcc35e35f13cfc94b7e13a9cad560f` are historical release evidence only.
- Current registry authorization, candidate still present/removed cause, all remote PR required checks, local unittest, Trusted QA, Owner HIGH acceptance, operational re-audit: NOT TESTED until executed on suitable runner.
- If CI candidate has been cleaned up, do not republish or waive check: inspect cleanup/retirement ledger and request a separate explicit policy decision.
