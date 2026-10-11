# Issue #600 — metadata CI 자동 회복 및 QA 중복 억제

## Work Packet
- Base main: `e41696430a78045998e35edad7cab5bb901a097e`; branch `ci/issue-600-metadata-reconcile`; version `0.104.0` 유지.
- Scope: default-branch `workflow_run` metadata recovery + 안전성 Python 테스트·운영 문서; non-scope: merge/main CI/GHCR/Ruleset 변경. risk_level=HIGH; qa_method=OWNER_MANAGED; qa_required=true; independent_qa=N/A(Owner-managed, 독립 검토 없음); manager_decision=NOT TESTED.
- Design A chosen: existing ci.yml Required gate / concurrency logic unchanged (policy job additionally runs #600 Python scenarios); Full CI + metadata-only never cancel one another. Extra workflow_run job carries narrowly scoped actions:write and only retries the latest failed metadata CI job aggregate after exact three-gate Full CI. Design B would change required source/check contexts and needs Ruleset migration, so rejected. No Runner polling or pre-success PASS.
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

## CI #2432.1 REWORK (2026-10-11 KST)
- Failed run: https://github.com/planner77/masterGantt/actions/runs/38089024177 , exact prior Head `9e62a6fc233a235c638c249546809d1a4f8532f9`.
- Policy job actually executed `python3 scripts/test-pr-metadata-reconcile.py`: 11 tests, 1 ERROR and 1 FAIL. `test_old_success_never_overrides_latest_failure` selected metadata run #23 but GH.get mock returned #22 irrespective of run ID, producing false STALE. `test_failed_nonmetadata_job_is_not_retried` assigned success again to an already-successful changes job and therefore could not raise expected NO_RETRY.
- Fix: map API /actions/runs/<id> to exactly one mock run and assert unexpected ID; for changes-job scenario set failure and for metadata/required-aggregate scenarios replace the original failure with success. Assert exact NO_RETRY in all negative cases; retain the remaining nine tests and #577 M1-M8.
- Consequence: Quality aggregate and QA Final — Automated failed because policy failed. TypeScript/ESLint/Vitest/production build/E2E shards 6 of 6/Docker smoke jobs were SUCCESS for the previous Head only and are not evidence for the next Head. No bypass or forced PASS.
- New PR CI execution after this correction: NOT TESTED until its new exact Head workflow starts; no merge/Main CI/GHCR requested.

## 2026-10-11 최신 main 충돌 해소 및 #593 provenance 호환
- 이전 PR Head: `ef852df9465a2e83aa0546d3085b327b66f35822`; 이전 PR CI [#2438.1](https://github.com/planner77/masterGantt/actions/runs/38090571785)는 SUCCESS지만 이번 main alignment Head에는 증거로 재사용하지 않는다.
- 최신 main 고정 SHA: `25e368ef7b4ba7cf59ac5b81e94dd0a98b87f31d`; 기준점 `e41696430a78045998e35edad7cab5bb901a097e` 이후 main 93개 커밋 선반영. Two-parent merge commit으로 main의 #593 신뢰 QA provenance, #586 Finalizer, #437 E2E shard plan 및 CI 계약을 유지하고 #600 경량 workflow·테스트·문서 델타만 결합한다.
- 문서 8종 공통 변경은 #600 상단 정책 문단과 latest main 전체 본문을 양쪽 모두 보존하였다. `.github/workflows/ci.yml`은 main의 PR 출처 artifact, Required Check 이름, E2E shard 및 나머지 모든 변경을 유지하면서 #600 Python recovery 테스트 실행 step만 다시 적용한다. `scripts/verify-issue-lifecycle.py` 역시 latest main 계약 검사 전체와 #600 정적 계약·#593 provenance 의무를 병합한다.
- #593 도입 `source_artifact`/`verified_source` 기반 CI 원본 이벤트 원장을 복구 판정에도 적용한다. `workflow_run.pull_requests=[]`를 단독 승인하지 않되, 정확한 run/attempt artifact와 단일 commit→PR 조회가 일치하면 정상 판정할 수 있다. SHA/Head/base/test-merge, 살아 있는 PR, 신뢰된 default branch, required 3종, write token 최소권한 및 fail-closed는 불변.
- #600 회귀는 13개 deterministic scenario(빈 pull_requests/없는 artifact 포함) + 기존 #577 M1–M8 + #593 QA Python regression. Local Fast Feedback은 GitHub 커넥터만 사용하므로 NOT TESTED, 정확 새 Head의 policy/Quality/E2E/Docker/Trusted QA는 PR CI에서 새로 판정한다.
- Merge/Main CI/GHCR/릴리스/이슈 종료는 이번 요청 범위 밖. PR CI 시작 직후 결과 NOT TESTED, HIGH Owner 최종 검토 별도.
