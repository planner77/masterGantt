## PR CI #2596.1 실패 원인 및 수정 (2026-10-12)
- 실패 근거: PR #640 / CI run 38259369778 (#2596.1), `변경 경로 판정` job 114845641671, `scripts/verify-ci-run-trace.py`의 branch `issue-NNN` 규칙 불일치. 기존 branch `fix/639-exact-main-recovery`에서 파싱된 Issue 집합은 `[]`이며 PR Primary Issue `#639`와 일치하지 않았다.
- 영향: `changes=FAILURE` → QA Preflight=SKIPPED, 세 required aggregate=FAIL, Automated QA=FAIL. 아직 Quality/E2E/Docker 구현 실패로 판정할 증거는 없다.
- 조치: 검증 규칙을 완화하지 않고 명세에 맞는 `fix/issue-639-exact-main-recovery` 신규 브랜치 및 후속 PR에서 full CI를 새로 기동한다. 최초 PR #640은 superseded로 종료하며 해당 실패 run을 PASS로 소급하지 않는다.
- 현재 시점: 수정 CI, 실행 테스트, GHCR 검증 모두 **NOT TESTED**. Owner 승인 전 병합/Release/Registry mutation 금지.

# Issue #639 — Main SHA recovery Work Packet

**Primary Issue:** #639; base `b97709df8b5c0974f3c8252ac97819f45f73a5b9`; branch `fix/issue-639-exact-main-recovery`. HIGH / OWNER_MANAGED / qa_required=true / manager_decision=NOT TESTED / release_required=false / release_authorized=false.

## Implementation
- Secure default branch controller `scripts/main_ci_recovery.py`; original merge SHA only data after Owner authentication.
- `ci.yml`: mode-separated workflow_dispatch, exact historical checkout for parallel quality/E2E6/Docker; release candidate only after required aggregates. `auto_release_finalizer.py` and `issue_lifecycle.py`: rigorous same-run provenance evidence as independent recovery fallback only; no fake push.
- `release-finalizer.yml`: verified manual recovery workflow_run with trusted checkout and independent auth, old push path unchanged.
- `scripts/test_main_ci_recovery.py`: negative and positive local deterministic tests.

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `.github/workflows/ci.yml`: UPDATED
- `.github/workflows/release-finalizer.yml`: UPDATED
- `scripts/main_ci_recovery.py`: UPDATED
- `scripts/test_main_ci_recovery.py`: UPDATED
- `scripts/issue_lifecycle.py`: UPDATED
- `scripts/auto_release_finalizer.py`: UPDATED
- `docs/exec-plans/active/ISSUE_639.md`: UPDATED
- `DESIGN.md`: N/A(no product UI/UX).
- `docs/API.md`: N/A(no product public REST contract).
- `docs/DB_SCHEMA.md`: N/A(no database migration).
- `package.json` and lock: N/A(no application version change).

## AC_TEST_COVERAGE
- AC1: original missing push SHA/Check evidence and GitHub Actions event suppression hypothesis documented; historical identity immutable.
- AC2: Owner exact marker, source/current main SHA, ancestor/first-parent, merged PR/issue/version, authenticated revocation and stale negative.
- AC3: all quality/e2e six/docker job SUCCESS and same attempt artifact; publish GHCR only after verified gates; digest + BuildKit SBOM/provenance.
- AC4: exact release/finalizer trust boundary reuses existing lifecycle ordering, formal v0.107.0 Owner marker, immutable tag checks and cleanup.
- AC5: duplicate run/job, forged event, missing artifacts, registry UNKNOWN, wrong SHA/actor, old manual diagnostic negative.
- AC6: 3 Required checks/Trusted QA, main/PR original paths retained; docs fully synced.

## Evidence
Local deterministic test outcomes and exact remote PR CI/QA remain **NOT TESTED** until observed. GitHub Actions production recovery requires a *separate new* #616 Owner recovery approval after #639 is merged. Failed historical runs are never rewritten. Rollback: revert workflow/validator changes; original push CI/Finalizer remains fail-closed.
