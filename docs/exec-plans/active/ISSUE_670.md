# Issue #670 — v0.108.0 successor release preparation (not publication)

## Scope and immutable evidence

- Primary Issue: [#670](https://github.com/planner77/masterGantt/issues/670); predecessor Target F2 obligation: [#616](https://github.com/planner77/masterGantt/issues/616); prior release-debt and audit policy: #633/#649/#651/#653/#655/#657/#662.
- Checkout baseline at branch creation: trusted main `bdfd1ea1b9d3453c3b8d97de80820b35ed22ee12`; implementation branch `release/issue-670-v0.108.0-preparation`. All later Heads/merges must be read live; these two SHAs are *not* interchangeable.
- [Read-only audit #19.1](https://github.com/planner77/masterGantt/actions/runs/38452926077): Run ID `38452926077`, attempt `1`, workflow_dispatch on baseline main, `completed/success`, policy `PREPARE_ONLY` / `reason_code=NONE`. Job Summary and [artifact #11841746774](https://github.com/planner77/masterGantt/actions/runs/38452926077/artifacts/11841746774) are the source; a plan document is not an independent registry authentication.
- [#616 Owner v0.107.0 revocation](https://github.com/planner77/masterGantt/issues/616#issuecomment-6153135410): latest version-scoped `mastergantt-release-authorization:v1` has `authorized=false`. [#616 Owner successor prepare decision](https://github.com/planner77/masterGantt/issues/616#issuecomment-6153144664): `mastergantt-release-succession-prepare:v1`, `v0.108.0`, candidate SHA exactly `bdfd1ea1b9d3453c3b8d97de80820b35ed22ee12`.
- [#616 historical original recovery #2621.1](https://github.com/planner77/masterGantt/actions/runs/38313359094): immutable FAILURE; never treat as a successful publication. Audit #17/#18 failures remain immutable. [#633 completed v0.106.1 release](https://github.com/planner77/masterGantt/actions/runs/38221400193): annotated Git `v0.106.1`, peeled SHA `09bee924032b4126ff794ec7a485542fd72dd7bf`, verified OCI digest `sha256:0ab78272f2637ca73ae0a1e7bec4f41b24fcc35e35f13cfc94b7e13a9cad560f`.
- At implementation baseline, Git matching-refs for `v0.108.0`/ `v0.107.0` returned empty and all reported GitHub Release objects excluded those tags. **The authenticated private GHCR `:0.108.0` absence came only from audit #19 at its historical SHA/time; it must be rechecked before a new release.** A GitHub Release by-tag 404 is not evidence of GHCR absence.

## Implemented in preparation PR (authorization boundaries unchanged)

- `package.json` `version=0.108.0`; `package-lock.json` top-level `version=0.108.0` and `packages[""].version=0.108.0`. No dependency, resolved URL, integrity, lockfileVersion or script changes. Historical 0.107.0 is a revoked/unissued version, not an existing release tag.
- Extend `tests/scripts/verify-release-version.test.ts` with actual checked-in manifest/lockfile/previous-published-tag verification plus negative incomplete lock root/top and old `v0.107.0` tag. `scripts/verify-release-version.mjs` original SemVer/annotated-tag runtime contract remains unchanged; its pure helper cannot authenticate a remote tag, Owner decision, GHCR or digest.
- Confirmed on baseline source (code presence, **not a fresh PASS**): `src/server/logistics/logistics-targets-service-core.ts`, `db/migrations/0026_logistics_targets.sql`, `tests/server/logistics/logistics-targets.test.ts` (typed Target, transaction/revision, project-local references and copy), `tests/server/templates/logistics-template-graph.test.ts` (two process Targets, AMR A10/AMR B5, common MCS, Template ID remap/negative graph, legacy snapshot); `tests/e2e/resource-dashboard-ui.spec.ts` unique `할당 Task` KPI selector (#639); `tests/e2e/milestone-management.spec.ts` live visible delete-focus restoration (#647).
- No Target F2 domain, SQL, UI, API or feature code is changed by this *version-preparation* PR. Existing authored tests are neither live production acceptance nor a claim that every #616 AC passed. New exact-Head unit/E2E/Docker and business acceptance evidence are required.

## DOCUMENTATION_SYNC
- `AGENTS.md`: N/A(기존 CI/Owner 승인 및 Git·GHCR 신뢰 정책에 새 전역 가이드를 추가하지 않음)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 HIGH OWNER_MANAGED 및 Trusted QA 기준과 정책 불변)
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 범용 lifecycle 및 수동 승인 절차 재사용)
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_670.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED
- `tests/scripts/verify-release-version.test.ts`: UPDATED
- `scripts/verify-release-version.mjs`: N/A(기존 strict SemVer와 manifest/lock/tag 검증기를 테스트로 재사용)
- `docs/LOGISTICS_TARGETS.md`: N/A(Target 도메인 서비스·제어/조율 관계 동작 불변)
- `docs/API.md`: N/A(프로젝트 REST API 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(기존 migration 0026 및 SQLite schema 불변)
- `docs/SECURITY.md`: N/A(프로젝트 권한, Origin, Session, 릴리스 시크릿·권한 정책 변경 없음)
- `docs/REQUIREMENTS.md`: N/A(기존 Target F2 요구·기능 목록 불변)
- `DESIGN.md`: N/A(UI·SVAR 차트·상호작용 변경 없음)
- `README.md`: N/A(실행 명령 및 사용자 워크플로 변경 없음)

## AC_TEST_COVERAGE

- AC1: Audit #19.1 Run `38452926077.1`, trusted SHA `bdfd1ea1...`, artifact `11841746774`, #616 Owner marker comment IDs `6153135410`/`6153144664`; historical #17/#18/#2621 FAIL and #633 verified release. Baseline provenance checked; later merge needs new verification.
- AC2: `package.json`, `package-lock.json` exact three-field bump, `tests/scripts/verify-release-version.test.ts` checked-in pair positive and mismatch negatives; `npm run version:check` and Vitest PR CI execution **NOT TESTED** until Run.
- AC3: Authenticated audit #19 for historical exact previous version, empty Git refs/Release inventory for `v0.108.0` at baseline; fresh private GHCR exact tag absence and CI candidate digest before formal release **NOT TESTED**, no mutation permitted.
- AC4: #616 code/DDL/F2 graph and Project Copy/Template tests plus #639 resource E2E and #647 Milestone E2E linked above; current-branch actual test execution and Owner F2 business acceptance **NOT TESTED**.
- AC5: Exact PR Head/base, three Required Quality/Chromium E2E6/Docker aggregates, policy Python suite, Trusted QA, unresolved thread 0 and Owner HIGH risk acceptance: **NOT TESTED** until live PR workflow.
- AC6: The exact `DOCUMENTATION_SYNC` entries in this file and AC1–AC9 traceability are consumed by trusted QA Preflight; a green PR CI only supports structural checks, not semantic F2 signoff.
- AC7: New post-merge immutable main SHA push CI / authenticated `ci-<newSHA>` digest/SBOM/provenance: **NOT TESTED**, deliberately outside this PR-only request; never reuse #19 SHA as a release artifact.
- AC8: `release_required=true`, `release_authorized=false`; no new annotated `v0.108.0`/GHCR exact `:0.108.0`/rolling tag changes, release-image dispatch or #616 close now. Separate exact-version Owner release authorization and immutable gate required for later mutation.
- AC9: #616 F2 business acceptance and new release/Finalizer completion must both be evidenced before closing #616; this prep Issue and #616 stay Open now. Historical failure/Owner ledger not altered.

## QA and downstream release gate

risk_level: HIGH
qa_method: OWNER_MANAGED
qa_required: true
manager_decision: NOT TESTED
release_required: true
release_authorized: false

- The target is a formal `v0.108.0` successor release; this PR **does not** contain Owner approval for publication. Do not use automatic finalization for issue closure or release tagging while `release_authorized=false`.
- PR stage: create PR from exact branch, verify no conflicts/current base and collect full required CI3 + Trusted QA, resolve review threads, independently obtain Owner HIGH merge acceptance. New Head/base invalidates previous QA.
- **After a separately authorized future merge**: recheck current main/first-parent, issue identity, package/lock, protected `v0.108.0` tag absence, no conflicting GHCR version; verify actual push Main CI, retained candidate/digest/SBOM/provenance. Missing/deleted candidate does not authorize republish or skipping verified digest checks.
- **Only after separate Owner `v0.108.0` release authorization**: create immutable annotated tag on the *actual* new merge SHA via trusted lifecycle, run `.github/workflows/release-image.yml`, authenticate exact OCI digest and Release CI, and decide F2 #616 retirement/close. A prior `PREPARE_ONLY` audit is not a publication gate or Finalizer success.
- This user request stops after implementation and **new PR CI start**. No merge/Main CI/formal tag/GHCR publication/Issue #616 close is authorized by this work.
