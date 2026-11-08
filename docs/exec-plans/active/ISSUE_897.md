# Issue #897 — Owner Preview UAT Work Packet (integrated PR, Primary #895)

## REUSE_REVIEW
- REUSE_DECISION: EXTEND
- REUSE_CANDIDATES: #703 exact source Preview GHCR workflow, #896 artifact/Manifest, existing qa_final_automated.GitHub read-only API and Owner Manager ACCEPT protocol
- REUSE_CONDITIONS: separate Preview/operations DB, exact SHA+OCI digest+Manifest checksum, Owner User comment authority, UAT not CI/Merge/Release automatic success
- REUSE_OWNER_EVIDENCE: 2026-11-08 Owner explicit A extend reuse, current conversation; GitHub Owner UAT not yet issued

## Acceptance / Verification
- AC01: Issue+exact source/preview digest/manifest digest binding in scripts/preview_uat.py; real Owner preview ACCEPT NOT TESTED.
- AC02: nonOwner, wrong issue, forged/double field, later REWORK and missing comment negative regression.
- AC03: head/OCI/evidence drift causes UAT_STALE.
- AC04: independent UAT from Required3/E2E8/Trusted/Manager ACCEPT/Release; no new GitHub Ruleset.
- AC05: #703 separate Compose & SQLite existing; actual staging instance UAT NOT TESTED.
- AC06: existing Owner decision reuse, only new invalidated source requires fresh confirmation.
- AC07: AGENTS/Lifecycle/Prompts/QA/Preview/CI/TEST_PLAN/UI docs and shared failure ledger.

## TEST_LIFECYCLE_REVIEW
EXTEND existing GitHub read-only QA API and Preview model; ADD pure UAT receipt verifier/negative tests. No Owner password/token/approval service.

## DOCUMENTATION_SYNC
- `docs/TEST_PLAN.md`: N/A(기존 대용량 테스트 계획 원본을 보존하고 신규 사항은 docs/TEST_PLAN_895_897.md Addendum에 기록)
- `docs/TEST_PLAN_895_897.md`: UPDATED
- `docs/PREVIEW_PUBLISH.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED

## Status
risk_level=HIGH; qa_method=OWNER_MANAGED; qa_required=true; release_required=false; release_authorized=false; actual protected PR Full CI/Owner Preview UAT NOT TESTED.
