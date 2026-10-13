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
- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_662.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(HIGH OWNER_MANAGED 및 Trusted QA 정책 불변)
- `DESIGN.md`: N/A(제품 UI 또는 디자인 체계에 변경이 없음)
- `docs/API.md`: N/A(제품 HTTP API 또는 계약 변경이 없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite 스키마와 마이그레이션 변경이 없음)

## Review #668 — P2 / fail-closed 진단
- [P2 #4259506390](https://github.com/planner77/masterGantt/pull/668#discussion_r4259506390): authenticated manifest evidence is recorded in a separate `LAST_AUTHENTICATED_OCI` context. A later Owner/retirement/main/policy BLOCKED retains the original version/tag/expected+actual digest in artifact and Summary without changing the failing stage or granting PASS.
- An OCI candidate's own missing digest remains explicit `actual_digest=null` and the previously authenticated release manifest is preserved only as `last_authenticated_oci`, not substituted as candidate proof.
- `test_confirmed_digest_survives_later_owner_block_in_json_and_summary` and `test_current_failure_stage_not_mislabelled_as_confirmed_digest` cover the two boundaries.
- PR metadata must contain one independent line each: `risk_level: HIGH`, `qa_method: OWNER_MANAGED`, `qa_required: true`, `release_required: false`, `release_authorized: false`. Never wrap all declarations in inline code or one list line. 
- QA Preflight #2692.1 correctly FAIL before full tests due to metadata/doc syntax; subsequent head requires new tests and review verification.

## Independent provenance and remaining blockers
- Audit #17.1 https://github.com/planner77/masterGantt/actions/runs/38403028531 is immutable historical FAILURE, not retconned.
- Main #2579.1 / Release #165.2 and expected `sha256:0ab78272f2637ca73ae0a1e7bec4f41b24fcc35e35f13cfc94b7e13a9cad560f` are historical release evidence only.
- Current registry authorization, candidate still present/removed cause, all remote PR required checks, local unittest, Trusted QA, Owner HIGH acceptance, operational re-audit: NOT TESTED until executed on suitable runner.
- If CI candidate has been cleaned up, do not republish or waive check: inspect cleanup/retirement ledger and request a separate explicit policy decision.
