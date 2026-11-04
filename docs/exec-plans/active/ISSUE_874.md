# Issue #874 — Release Runner 이미지 차이 / 인증된 PR→Main OCI digest promotion Work Packet

- Issue: https://github.com/planner77/masterGantt/issues/874
- 2026-11-04; risk_level: HIGH; qa_method: OWNER_MANAGED; qa_required: true
- release_required: false; release_authorized: false; Owner approval for merging and any old-release recovery: NOT GIVEN
- Scope: release verifier / build-provenance boundary + existing CI receipt artifact and regression tests; application/UI/API/DB/package version unchanged.

## SOURCE / 직접 실패와 근거

- Issue #865, PR #871, two-parent Main SHA 78a48b29f3a6e5ec1a0a9817ffa1976dc4de74aa, immutable annotated v0.141.0.
- Main Full #3489.1 (41776085393): Required3/E2E8/Docker/Main GHCR candidate PASS; Finalizer #1346.1 (41779125648) dispatch success only.
- Release #216.1 (41779185247), candidate Job 126417402392: Main verified exact candidate step FAIL with PR_ORIGIN_RELEASE_SOURCE_UNAVAILABLE:PR_MAIN_BUILDER_OR_INPUT_DRIFT; digest sha256:a6a2b658f440280eca66a218b83ec5eb8b86c80d657d8082a7cabb794dcce842 pull PASS, promotion NOT RUN.
- PR Job 126371984402/Main Job 126396726096 ImageVersion=20261101.186.1; Release Job ImageVersion=20261025.179.1. Same Docker 29.4.2/Buildx 0.38.1/BuildKit 0.34.2 observed. Cross-run host rollout must not reclassify already proven PR/Main source.

## Design / authority chain

1. PR producer retains original Full PR run/attempt, actual Docker smoke, PR source Git tree/parents, signed-by-GitHub artifact ZIP digest, OCI archive + index/child/config+SBOM/provenance + build contract. PR workflow cannot publish to registry.
2. Main selector **unchanged**: source/OCI evidence and original PR builder receipt must match actual Main checkout's full Git tree, file digests, pinned base, and current Main runner Buildx/Docker/ImageVersion/platform. Genuine drift → verified Main rebuild, trust conflict → BLOCKED.
3. After Main Docker implementation successfully validates/smokes its exact OCI archive, persist independent Main Run/Attempt-scoped build-contract artifact (same script, same 11-field builder schema). Publisher still requires new Main Quality/E2E8/Docker and publishes only verified exact digest to ci-<SHA>; no PR artifact authorizes publishing alone.
4. Release resolves **unique successful** Main push Run/Attempt with Required3, actual Docker job (one SUCCESS plus optional PR-only SKIPPED twin) and Main publisher SUCCESS. It downloads the exact Main contract artifact via GitHub API, checks artifact ZIP digest, unique name and expiry, then separately authenticates the exact original PR Full source and OCI digest/attestation.
5. PR builder fingerprint == independently evidenced Main builder fingerprint, both Git tree/pinned base/files independently rehashed against immutable Release checkout. Release runner's newly provisioned ImageVersion/Buildx/Docker are never substituted for a previous build; Main receipt schema/version/revision/archive bytes/OCI subject/Run/Attempt must all match. Live GHCR digest is already pulled and passed by protected Release workflow before calling the verifier.
6. Missing/expired/duplicate/wrong attempt/incorrect source or fingerprint or digest is BLOCKED (no Release fallback). Main's previous rebuild fallback stays exclusively in Main selector. Runtime/persistence/transport/SBOM/GHCR/Finalizer/Owner exact version approval and immutable tags unchanged.

## Implementation

- scripts/ci_image_contract.py: extract static source fingerprint; retain existing strict Main builder verification; add Release-only independent certified-Main-builder comparison with direct checkout hash and canonical builder fields.
- scripts/ci_image_reuse.py: accept certified Main builder only when explicitly passed by Release verifier; default Main strict verification unchanged.
- scripts/verify_ci_image_release.py: authenticate Main CI job/publisher and exact Main build receipt before re-authenticating PR source; compare two original builders instead of the Release host; verify both contracts, archive sha256, OCI index, labels and attempt. Main receipt SHA-256 included in summary.
- .github/workflows/ci.yml: emit ci-main-build-contract-<run>-<attempt> only from successful main push Docker implementation.
- Tests: extend tests/python/test_ci_image_release.py, add tests/python/test_ci_image_contract.py. Keep existing tests/python/test_ci_image_reuse.py and original security/OCI validation unchanged.

## AC_TEST_COVERAGE

- AC1: PR/Main ImageVersion 20261101.186.1과 Release 20261025.179.1 안전 양성은 tests/python/test_ci_image_contract.py와 test_ci_image_release.py fixture로 검증 (새 CI 전 NOT TESTED).
- AC2: PR↔Main Buildx/Docker/Runner·Tree·파일·Base·OCI 불일치 음성은 test_ci_image_contract.py 및 기존 test_ci_image_reuse.py의 fail-closed·Main 재빌드 보존.
- AC3: Publisher 비성공·다른 Run/Attempt·위조/누락 receipt·OCI digest/버전 차이는 test_ci_image_release.py와 test_ci_image_contract.py 부정 회귀 확인.
- AC4: 기존 scripts/ci_image_contract.py, ci_image_reuse.py, verify_ci_image_release.py와 OCI/reuse/release 테스트 검색 후 EXTEND/ADD/KEEP_UNIQUE, CI 게이트 약화 없음.
- AC5: AGENTS.md와 docs/CI_CD.md, GITHUB_OPERATIONS, GENERIC_RELEASE_FINALIZER, QA_REVIEW_POLICY, TEST_PLAN 및 ISSUE_874_FAILURE_ANALYSIS.md를 Work Packet DOCUMENTATION_SYNC로 연결.
- AC6: 위험 HIGH·OWNER_MANAGED, qa_required=true, release_required=false, release_authorized=false 유지; 정확 Head Full/Trusted/Owner 승인 전 병합·정식 Release 금지.

## TEST_LIFECYCLE_REVIEW

Search existing code/tests before implementation: scripts/{ci_image_contract,ci_image_reuse,verify_ci_image_release,verified_oci}.py, tests/python/{test_ci_image_release,test_ci_image_reuse}.py, .github/workflows/{ci,release-image}.yml.
- **EXTEND** release verifier original mapping/unique success/skipped duplicate test with exact Main contract artifact, expired/unavailable, invalid JSON, missing publisher, digest mismatch and wrong Main source.
- **ADD** contract positive test PR/Main ImageVersion=20261101.186.1 versus Release=20261025.179.1; negatives for PR↔Main ImageVersion/Buildx/Docker/platform/base/files/Tree/OCI digest/Run+Attempt/version/receipt malformation. Ensure no Release host Docker fingerprint probe.
- **KEEP_UNIQUE** existing OCI index/child/attestation/archive and daemon runtime/RootFS, PR Full source and Main fallback, other CI protection tests. No skip/retry/timeout, Ready-Full/8-shard/QA/workflow/Ruleset change.
- AC1: positive certified two-receipt comparison; AC2: builder/source change negative; AC3: Main job/receipt/OCI source/attempt negative; AC4: existing tests retained; AC5: docs + dedicated ledger; AC6: Owner-managed and no release authorization.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_874.md`: UPDATED
- `docs/ISSUE_874_FAILURE_ANALYSIS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: N/A(원격 검증과 CI 원본 증거 Gate 정책 변경 없음)
- `docs/API.md`: N/A(REST API/DTO 기능 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite Schema 및 migration 변경 없음)
- `DESIGN.md`: N/A(UI 시각 언어 변경 없음)
- `docs/SECURITY.md`: N/A(원본 OCI 인증 보안 계약 유지)
- `.github/workflows/ci.yml`: UPDATED
- `scripts/ci_image_contract.py`: UPDATED
- `scripts/ci_image_reuse.py`: UPDATED
- `scripts/verify_ci_image_release.py`: UPDATED
- `tests/python/test_ci_image_contract.py`: UPDATED
- `tests/python/test_ci_image_release.py`: UPDATED

## Verification / limits

- Static source/code review: structural changes and inherited tests inspected in GitHub. Local source checkout, Docker-based OCI end-to-end test, and remote Full CI result are **NOT TESTED** before PR CI start. No claim of passing local or remote tests without execution.
- First non-draft PR opened only when all changes/docs/ledger are committed; that event starts existing Full PR CI. No CI monitoring, merge, Main/GHCR publish, tag movement, Finalizer or Issue close in this task.
- v0.141.0 annotated tag + previous failed #216.1 history and its old source verifier remain unchanged. This patch cannot repair old tag by rerunning the same workflow. Recovery/next PATCH and Issue #865 closure require separate Owner decision.

## REWORK #1 — PR #875 Full #3490.1 메타데이터 실패·Codex P1 처리 (2026-11-04)

- [Full #3490.1 / Run 41802463033](https://github.com/planner77/masterGantt/actions/runs/41802463033), 원래 Head `2aac0397dac3cb0ab1f9222f7f62ebc5d5c58cca`: 변경 경로 Job 126481300326에서 독립 `Refs #874` 누락, QA 경로 Job 126481300894에서 독립 `qa_method: OWNER_MANAGED` 누락으로 직접 FAIL. Fast Gate/Required3 파생 실패, 구현 테스트/E2E8/Docker NOT RUN.
- PR body의 canonical Refs 및 5개 위험·QA·Release 선언을 독립 행으로 수정하고 PR 제목 설명 한글화; GitHub 추적/Trusted QA 파서는 변경하지 않는다.
- Codex P1 thread PRRT_kwDOUUB7Bc6zhIlt (comment 4465524798): 새 Main receipt workflow step과 Release summary의 사용자-facing 영문 설명을 한글화. Artifact/Run·Attempt/기존 Required Check 식별자는 유지. 회귀 단언 EXTEND.
- 실패 시각/Jobs/직접·파생 분리와 조치 기록은 [전용 실패 원장](../../ISSUE_874_FAILURE_ANALYSIS.md) F874-003 참조. 이전 Full #3490.1은 FAILURE로 불변; 새로운 Head에서 Full PR CI 재시작, 모니터링·병합·Main/GHCR·종료 제외.
