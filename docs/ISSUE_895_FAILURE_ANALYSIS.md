# Issue #895 / #896 / #897 — 단일 PR 초기 누적 검증·실패 원장

## 최초 상태 / Source
- Created: 2026-11-08, primary #895; related #896, #897.
- User-approved scope: one new PR, preserve already merged #894 for #889/#890 only, reuse option A (existing Preview/Playwright/Geometry/QA/Lifecycle).
- Baseline main 90c5a1a951c749a9690b1c83e5a74b6d122dd6e3, version 0.145.1. New branch ci/issue-895-896-897-reuse-visual-uat.
- At initial authoring: no PR run/attempt; all new/modified code local Python/TypeScript tests, Chromium, Docker, Main/GHCR and Preview UAT are NOT TESTED. GitHub source creation is not a runtime test.

## Actual known failures / rework
- None recorded at initial Issue implementation. Historical #889/#890 failures belong to docs/ISSUE_889_890_FAILURE_ANALYSIS.md and must not be relabeled or counted here.
- The first PR Full CI must be attached with exact PR/head/base/test merge, Run ID/Attempt, actual direct failures and cancellations (not aggregate-only), test file/shard status, corrections and unchanged-source outcomes. Never overwrite history.

## Reuse inventory and impact
- #895: AGENTS/Issue Lifecycle/AGENT_PROMPTS/qa_preflight.py/qa_final_automated.py, existing policy tests. No standalone new approval database.
- #896: existing schedule-views Playwright fixture and page.screenshot + geometry, CI E2E8 shard; new integrity checker validates only sanitized synthetic artifacts. Existing #118 before/after comparator retained for its own history; no replacement.
- #897: existing #703 Preview SHA/digest, existing QA GitHub read-only API and Owner GitHub Issue comments; no new token or CI bypass.
- Source/test contract: protected workflow/QA change HIGH; existing main trusted validation, required Quality/Chromium8/Docker, Owner final confirmation and no automatic self-approval.

## Next gate
- Exact new Head PR + CI run initiation; until then Full CI and manual real Preview UAT NOT TESTED.
- release_required=false / release_authorized=false. No merge/Main/GHCR/Issue closure by this initial request.
