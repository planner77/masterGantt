## Issue #771 — F771-001/F771-002 · PR #776 Full #3124.1 REWORK (2026-10-22)

- [원본 CI Run 39730387486.1](https://github.com/planner77/masterGantt/actions/runs/39730387486) · Head `88ac413d2c3f389b8ea4018efed386375ccfcd53`, Base `f550a657c2fd04d49b7dee08783fab3b348e1497`, Test-Merge `c00cf1307439f5cccc338c036f406d4fa4198ac7`: Preflight, TypeScript, ESLint, Vitest PASS. `scripts/verify-issue-lifecycle.py`가 과거 `pull_request.types` 전체 문자열만 검증하여 Policy FAIL, Fast Gate/Required3/QA 파생 실패. Chromium 8샤드, PR Docker, PR Build **미실행**.
- 초기 PR P1 리뷰 2건: [이벤트 계약](https://github.com/planner77/masterGantt/pull/776#discussion_r4344996110)(실제 첫 실패 원인)과 [test ID `..` escape](https://github.com/planner77/masterGantt/pull/776#discussion_r4344996116)(원본 CI Policy 이전 중단으로 아직 미실행된 음성 오류). `scripts/verify-issue-lifecycle.py`를 이벤트 정확 집합 parser로, `ci_fast_development.py`의 선택·제외 경로와 Fast 브라우저 실행의 `.`/`..`·repo root 검증을 보완한다.
- 기존 `edited` metadata-only/Head·Base·Test Merge 출처 및 8-shard/Required3 이름, default-main Trusted, Owner HIGH, strict/latest main, review-thread 0, GHCR/Finalizer는 변경하지 않는다. 이슈별 단일 실패 원장 [ISSUE_771_FAILURE_ANALYSIS.md](../../ISSUE_771_FAILURE_ANALYSIS.md)에서 직접/파생·미실행/수정/QA 잔여 위험 구분.
- 사용자 요청: 수정·문서/실패 원장·미해결 리뷰/충돌 해결 후 새 Full PR CI **시작까지만** 진행하고 모니터링하지 않음. 새 원격 Quality/E2E8/Docker/Trusted 및 Draft→Ready POC/AC5 A/B 효과 **NOT TESTED**. Owner 승인 전 MERGE_READY=BLOCKED.

---
# Issue #771 — FAST_DEVELOPMENT / FINAL_FULL PR CI 안전 분리

## Scope, baseline and manager decisions

- Primary: [Issue #771](https://github.com/planner77/masterGantt/issues/771); Epic [#769](https://github.com/planner77/masterGantt/issues/769); hard dependency [#770](https://github.com/planner77/masterGantt/issues/770) (closed; base policy available).
- main baseline: `f550a657c2fd04d49b7dee08783fab3b348e1497`; branch: `ci/issue-771-fast-full-separation`; application package 0.129.1 unchanged. Current authoritative Chromium = **8 shards** (#767), not issue body's earlier six.
- `risk_level: HIGH`; `qa_method: OWNER_MANAGED`; `qa_required: true`; `independent_qa: N/A(Owner-managed)`; `manager_decision: NOT TESTED`; `release_required: false`; `release_authorized: false`. Documentation/CI policy only; no app/UI/DB/API behavior.
- Implementation owner: infra (CI workflow and trusted detector); manager owns risk, boundaries and final acceptance. Initial request authorizes design/implementation, document sync, then **PR CI start**. No CI monitoring, merge, Main/GHCR, tag/release, Finalizer or Issue closure.

## Design contract

1. Draft `opened`/`reopened`/`synchronize`/`converted_to_draft`: official `CI` keeps its three required aggregate job identities and `if: always()` but returns explicit **failure (DRAFT_BLOCKED)**; no Full E2E8/Docker, no fake green/skipped. Separate read-only `.github/workflows/pr-fast-development.yml` is advisory-only with per-PR `cancel-in-progress` and does not impersonate Required3.
2. On Draft advisory: checkout immutable event base, run trusted #770 `scripts/ci_impact_plan.py --plan-only` with exact PR event, test-merge parent verification, run ID/attempt and base-owned `#699` map. Check generated `test_plan_sha256`/source/inventory/path uniqueness using trusted `scripts/ci_fast_development.py`; only `FAST_TARGETED` with no ambiguity selects already existing Chromium specs. `FULL_REQUIRED`/UNKNOWN/DOCS_VERIFIED -> no fake E2E PASS; static feedback may still execute. The untrusted PR test merge is checked out **only after** the trusted plan and with read-only permissions.
3. Non-draft `ready_for_review` produces new `FINAL_FULL` Run even for unchanged SHA. Non-draft `opened`/`reopened`/`synchronize` stays Full, 8 PR shards, policy/QA Preflight, fast gate, build, E2E, Docker and original artifacts intact. Fast failures/cancellations are diagnostics only; corrected Ready event runs new exact Head/Base/Test-Merge Full. `edited` metadata-only contract remains based on previous authenticated Full.
4. The trusted Preflight recognises `ready_for_review` and requires source/live `draft=false`, exact Head/Base; trusted QA cannot approve Draft even if other jobs appear successful. `main push` and `workflow_dispatch` Full, `workflow_run` trusted QA, Review 0, strict latest main, Ruleset #24043042 and Release/GHCR/Finalizer are unchanged.
5. Both Fast and Full expose their type in Run name/Job Summary; Fast reports plan hash, selected/excluded count, Run ID/Attempt, source head/base/test-merge and actual step outcomes, explicitly **not** per-test actual PASS/merge authority. Official `ci-pr-source-*` and `ci-impact-shadow-*` retain former meanings. The existing metadata evidence validator still expects Full `[전체 검증]` and `edited` `[메타데이터 검증]` markers, which are preserved.
6. Rollback: revert Issue #771 `ci.yml` draft guards and `ready_for_review` addition, turn off new Fast workflow, restore prior `opened/reopened/synchronize/edited` full path; do **not** modify required check names/ruleset, relax QA/Owner, or disguise skipped work.

## Documented verification limitations

- Static regression authored: `tests/python/test_ci_fast_development.py`; `scripts/test_qa_preflight.py` ready/draft cases; existing #770 test inventory/shard regressions reused. Local checkout Python/Node/Playwright runs are **NOT TESTED** in connector-only execution environment; first full PR CI will execute the tests.
- Remote Draft→Ready B1/B2 POC, exact new Run/Attempt, all failure/timeout/fork/rerun/cancel interactions: **NOT TESTED** until independent real GitHub Actions evidence. This PR's opening is non-draft to ensure existing **Full** required CI is used to validate the policy PR.
- B5 same-population A/B (Full run count, Runner-minutes, time-to-merge, retries/cancellations, missed regressions) **INSUFFICIENT_DATA / NOT TESTED**; do not claim measured speedup from theoretical E2E selection.
- Docs-only/metadata/rename/fork/skip and #712 post-merge audit remain explicit safety constraints, not authorization to loosen Strict main/QA/Release.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_771.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: N/A(current issue lifecycle phases, independent Owner approval and Finalizer contract unchanged)
- `DESIGN.md`: N/A(no UI, visual design, Gantt interaction or client-facing product changes)
- `docs/API.md`: N/A(no application API endpoints, request/response or security data contract changed)
- `docs/DB_SCHEMA.md`: N/A(no SQLite migration or database schema change)
- `package.json`: N/A(no app behavior, dependency or version changes; CI infrastructure-only)
- `package-lock.json`: N/A(no package/dependency lock changes)
- `CHANGELOG.md`: N/A(no deployed application or SemVer behavior change)

## AC_TEST_COVERAGE

- AC1: `tests/python/test_ci_fast_development.py::WorkflowGuard` Draft Required3 explicit failure and eight-shard / selected workflow guard; actual Draft repeated synchronize and Ready Full required Job receipt **NOT TESTED**.
- AC2: `scripts/test_qa_preflight.py::test_ready_for_review_same_sha_and_draft_fail_closed`; `tests/python/test_ci_fast_development.py::Modes`, SHA source/attempt drift negative. Metadata-only regression in `scripts/test-pr-metadata-evidence.py`; remote event POC **NOT TESTED**.
- AC3: `tests/python/test_ci_fast_development.py::WorkflowGuard`, `Selection` forged Plan hash/mode/authority and fallback; separate nonrequired Fast workflow. Exact Full+Trusted+Owner approval still BLOCKED without original evidence.
- AC4: existing `scripts/test_pr_fast_gate.py`, `scripts/test_qa_preflight.py`, #770 `tests/python/test_ci_impact_plan.py`; new fork/repository mismatch, draft change, ready, interrupted/unknown plan tests. Remote timeout/cancel/rerun and all negative interactions **NOT TESTED**.
- AC5: before/after A/B matched Full Run and runner-minutes / time-to-merge / cancelled / missed regression metric plan in `docs/TEST_PLAN.md`; **NOT TESTED / INSUFFICIENT_DATA**.
- AC6: every required CI/QA guide updated as shown above, `ISSUE_LIFECYCLE` N/A with unchanged Lifecycle contract, DESIGN/API/DB_SCHEMA N/A each with reason.
- AC7: current PR must execute authoritative exact Head `FINAL_FULL` Quality/E2E **8/8**/Docker + default-main Trusted QA before Owner HIGH approval. This implementation request ends at PR CI **start**, result **NOT TESTED**, not Merge Ready.

## Release and next handoff

- Required remote Full CI/Trusted QA, Owner risk acceptance, review thread 0, strict latest main and any final merge remain later explicit steps. `release_required=false`, no GHCR version tagging.
- PR body must contain standalone `Refs #771` and `risk_level: HIGH`, `qa_method: OWNER_MANAGED`, `qa_required: true`; title must identify Issue #771. Draft status must be false so policy change receives full existing PR validation.
