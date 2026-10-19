# Issue #751 — CI failure ledger

## F-001: PR #754 Full CI #3014.1 (2026-10-19)
- Source: https://github.com/planner77/masterGantt/actions/runs/39255129930; attempt 1; Head f24f74b4b56fc3a83b6e0496574739f840a56e6e; Base 0aa1d3d71f13df6976539ef4ebaaadb9037121c4; test-merge dea92870e3be362ca88f67b8271c89f3c5bf7d00.
- Changes Job 118068393834 rejected PR title: title Issues=[] (must contain Issue #751 or (#751)).
- QA Final trust Job 118068393592 rejected missing qa_method. Metadata omissions, not product failures.
- Typecheck, lint, unit, build, Chromium E2E 6 shards and Docker actual jobs SKIPPED. Required three aggregate FAILURE derived from missing prereqs. No PASS or product FAIL may be inferred.
- Remedy: title changed to Issue #751: E2E..., PR body declares qa_method=OWNER_MANAGED, risk_level=HIGH, qa_required=true, release_required=false, release_authorized=false.
- Keep #3014.1 FAILURE unchanged. Revalidate with new HEAD Full PR CI; actual test results not yet known.
- Subsequent failures must append new F-number, exact run/attempt/head/base, cause, affected/cancelled jobs and correction without retroactive PASS.
