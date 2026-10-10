# Issue #600 — metadata CI 자동 회복 및 QA 중복 억제

## Work Packet
- Base main: `e41696430a78045998e35edad7cab5bb901a097e`; branch `ci/issue-600-metadata-reconcile`; version `0.104.0` 유지.
- Scope: default-branch `workflow_run` metadata recovery + 안전성 Python 테스트·운영 문서; non-scope: merge/main CI/GHCR/Ruleset 변경. risk_level=HIGH; qa_method=OWNER_MANAGED; qa_required=true; independent_qa=N/A(Owner-managed, 독립 검토 없음); manager_decision=NOT TESTED.
- Design A chosen: existing ci.yml unchanged; Full CI + metadata-only never cancel one another. Extra workflow_run job carries narrowly scoped actions:write and only retries the latest failed metadata CI job aggregate after exact three-gate Full CI. Design B would change required source/check contexts and needs Ruleset migration, so rejected. No Runner polling or pre-success PASS.
- IMPORTANT: automation can recover the latest failure only when it has exact PR attribution and first failed attempt evidence; it does not prevent earlier completed Trusted FAIL entries. AC3/AC8 partially met until real end-to-end rehearsal.
- Release: release_required=false; release_authorized=false; no app version/tag/GHCR.
- Fast feedback: Python scenario tests and syntax planned; GitHub PR three aggregate result NOT TESTED until CI.

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/DECISIONS.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `DESIGN.md`: N/A(UI·사용자 기능 변경 없음)
- `docs/API.md`: N/A(서버 API 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB·migration 변경 없음)

## AC_TEST_COVERAGE
- AC1: scripts/test-pr-metadata-reconcile.py exact success/deferred, CI workflow unchanged, live scenario PENDING
- AC2: scripts/test-pr-metadata-reconcile.py failed/cancelled/base/attempt, qa_final_automated.verify_same_base_full_run
- AC3: scripts/test-pr-metadata-reconcile.py latest edited/synchronize stale, real rapid edit PENDING
- AC4: scripts/test-pr-metadata-reconcile.py live trace mismatch plus existing verify-ci-run-trace.py/QA
- AC5: scripts/verify-issue-lifecycle.py contracts, existing aggregate names, actual Ruleset replay PENDING
- AC6: .github/workflows/qa-final-trusted.yml unchanged, #593 provenance tests, real Trusted PENDING
- AC7: scripts/test-pr-metadata-evidence.py M1-M8 + scripts/test-pr-metadata-reconcile.py; #591 real reproduction PENDING
- AC8: docs/CI_CD.md measurement plan, before/after Actions run/Runner minutes PENDING
- AC9: DOCUMENTATION_SYNC and scripts/verify-issue-lifecycle.py document path gate

## Verification boundary
- baseline Full/metadata/QA run URLs in Issue #600, no baseline savings estimate invented.
- Same SHA CI and trusted verifier runtime success NOT TESTED until PR workflows complete; protected workflow modifications require Owner verification before merge.
