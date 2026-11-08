# Issue #896 — Visual Evidence Gate Work Packet (integrated PR, Primary #895)

## REUSE_REVIEW
- REUSE_DECISION: EXTEND
- REUSE_CANDIDATES: existing #703 Preview, tests/e2e/schedule-views.spec.ts isolated fixture, #118 geometry comparator, Playwright testInfo.attach and Chromium8 CI Artifact
- REUSE_CONDITIONS: no production data in public Artifact, deterministic fixture/locale/viewport/exact source SHA, approved golden only, existing E2E/assertions preserved
- REUSE_OWNER_EVIDENCE: 2026-11-08 Owner explicit A extend reuse, current conversation; GitHub Owner semantic approval pending

## Acceptance / Verification
- AC01: DESIGN.md/Issue AC to actual screenshot/geometry/state mapping; actual Owner design accept NOT TESTED.
- AC02: existing test suite extended, no new independent screenshot runner or removal.
- AC03: checksum/PNG magic, synthetic fixture, non-finite geometry and path traversal negative tests.
- AC04: exact source SHA/manifest/PNG digest and Playwright attachment; remote CI artifact NOT TESTED.
- AC05: #889 View transitions existing E2E, and screenshot in synthetic schedule-views case; actual end-to-end new Head NOT TESTED.
- AC06: existing required checks/Trusted QA/Owner separate.

## TEST_LIFECYCLE_REVIEW
EXTEND existing schedule-views.spec.ts, KEEP_UNIQUE original visual/sort/readonly/SQLite tests, ADD thin visual evidence helper and file guard. No new golden without Owner approval.

## DOCUMENTATION_SYNC
- `docs/TEST_PLAN.md`: N/A(기존 대용량 테스트 계획 원본을 보존하고 신규 사항은 docs/TEST_PLAN_895_897.md Addendum에 기록)
- `docs/TEST_PLAN_895_897.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/PREVIEW_PUBLISH.md`: UPDATED
- `AGENTS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED

## Status
risk_level=HIGH; qa_method=OWNER_MANAGED; qa_required=true; release_required=false; release_authorized=false; actual E2E, screenshot artifact and DESIGN Owner accept NOT TESTED.
