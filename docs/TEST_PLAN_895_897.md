# Test Plan Addendum — Issues #895 / #896 / #897 (2026-11-08)

The existing large docs/TEST_PLAN.md is preserved byte-for-byte to retain historical test/CI evidence; this addendum owns the new narrow contract. The Work Packet records that preservation and links this file.

## #895 — reuse review contract
- Existing trusted scripts/qa_preflight.py and scripts/qa_final_automated.py check a Work Packet ## REUSE_REVIEW for REUSE_DECISION/CANDIDATES/CONDITIONS/OWNER_EVIDENCE. Structural success is not authenticated Owner approval.
- Existing scripts/test_qa_preflight.py and scripts/test_qa_final_automated.py cover explicit EXTEND, missing section, PENDING and invalid Owner evidence; tests remain in CI's existing policy job.
- No retrospective reclassification of old successful PRs; new/REWORK issue decisions are validated when processing under updated trusted base.

## #896 — existing Playwright capture & evidence integrity
- tests/e2e/schedule-views.spec.ts uses the #889 isolated synthetic fixture to capture an additional screenshot/geometry manifest in tests/e2e/helpers/ui-evidence.ts. It is an OBSERVED_NOT_APPROVED evidence record with exact commit SHA, Issue/AC, viewport/locale, element rectangles and PNG SHA256.
- Existing Chromium8 test still exercises Task/view and HTTP/SQLite contracts. scripts/ui_evidence.py validates screenshot checksum, fixture provenance, non-finite geometry, source identity and path-safety; visual approval requires a separate Owner review.
- tests/python/test_ui_evidence.py covers valid and invalid manifests; ci.yml uploads **only** synthetic ui-evidence files after existing E2E shards. No separate visual test runner, no automatic golden baseline or false positive DESIGN PASS.

## #897 — Preview UAT approval integrity
- scripts/preview_uat.py reuses the existing qa_final_automated.GitHub read-only authenticated API wrapper and #703 Preview source/digest. It checks actual repo User Owner comments, Issue/PR latest Head, and both digest strings, newest valid comment authority.
- tests/python/test_preview_uat.py covers correct Owner receipt, REWORK after ACCEPT, stale SHA/image/evidence, nonOwner/foreign Issue, duplicate or incomplete comment and unavailable decision.
- Actual browser UAT on isolated Preview + Owner ACCEPT is **NOT TESTED** in this implementation; do not fabricate a screenshot or GHCR deployment.

## Current validation boundary
- Source authored on branch ci/issue-895-896-897-reuse-visual-uat from exact main SHA 90c5a1a951c749a9690b1c83e5a74b6d122dd6e3 (PR #894 already merged).
- No full local Node/Python/Chromium/Docker environment in this session; exact updated PR Head's required CI and default-main Trusted QA are necessary evidence.
- Test coverage is additive; original E2E8, workers=1, Quality, Docker, owner merge authorization, Release evidence reuse and finalizer remain unchanged.
