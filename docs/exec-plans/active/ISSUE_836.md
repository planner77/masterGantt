# Issue #836 — PR Verified OCI Image → Main → Release 조건부 재사용 Work Packet
2026-10-28 | [Issue #836](https://github.com/planner77/masterGantt/issues/836) | Branch `issue-836-verified-oci-reuse` | Base main `a4c52b9ba2499a95045a7d85a2c62164210672e6`

## REWORK #1 — Full PR #3348.1 실패·Owner 기본 ON 결정 (2026-10-28)

- [PR #837 Run #3348.1](https://github.com/planner77/masterGantt/actions/runs/40614685816), original Head `f3e71892e8a886157767421b649aefcda6780272`, Base `a4c52b9ba2499a95045a7d85a2c62164210672e6`, Test-Merge `9b17635ba8f118ba63fb4421a8cbe9dbd2bc4307`. **F836-001** 직접 Docker Smoke `version=` 누락: PR changes 단계가 Main-only release_candidate output에 의존해 OCI validator가 `package version invalid`로 차단. Buildx OCI manifest/index/provenance export 자체는 성공. `changes.package_version`를 PR/Main immutable checkout에서 계산해 fallback; validated package.json SemVer는 OCI label/build arg/config와 같아야 한다.
- 동시에 **F836-002** 별도 Chromium shard6 `project-transfer-layout-491.spec.ts:159` API GET `ECONNRESET`, 해당 shard 77 PASS·1 FAIL·1 SKIP·21 NOT RUN. 본 PR의 앱·테스트 파일 변경은 없으며 실제 원인은 미확정. Assertion/skip/Retry/timeout을 약화하지 않고 새 Full8에서 재현 확인, 재발 시 Trace+runner server logs 원인 분리. Required Docker/E2E 및 Automated QA 실패는 이 두 직접 원인의 파생이다. Policy/Typecheck/Lint/Vitest/build/Preflight 성공은 별개.
- Codex Review는 코드 지적이 아니라 사용량 한도 초과로 미완료, 미해결 inline thread 0, 초기 PR mergeable=true. Owner가 Codex/QA Review 리스크를 OWNER_MANAGED로 수용하겠다고 명시했으나 **실제 Full Required3·Trusted 정책·원본 review thread/strict main은 변경하지 않는다**.
- 신규 구체 결정: `PR_IMAGE_REUSE_ENABLED` **미설정/true = 기본 ON**, **false = SHADOW·기존 Safe Build Rollback**. Main에서 실제 source/Build input/OCI subject가 일치하면 PR artifact 재검증+Main Smoke+GHCR 동일 Digest; 정상 불일치는 Main 1회 재빌드 후 전체 검사; 위조/불명은 BLOCKED. Repo variable이 이미 false로 설정되었다면 명시적 rollback으로 간주하며 별도 변경 필요하다.
- 추가 교정: Buildx OCI archive가 중첩 `index.json` wrapper를 가진 경우 레이아웃 digest와 실 Registry subject index digest를 구분해 반환·검증, no-digest relabel 금지; immutable PR Head로 Full run 조회. Regression `test_ci_image_reuse.py`에 wrapped-index/PR SemVer/default ON·false 롤백을 추가.
- 누적 직접/파생 실패·원본 출처·실제 미검증 범위: [Issue #836 Failure Ledger](../../ISSUE_836_FAILURE_ANALYSIS.md). **새 HEAD Full PR CI 전 아직 NOT TESTED**, Main merge/GHCR/Finalizer/Issue 종료 금지.

## REWORK #2 — Main 10 commits 정렬과 BuildKit OCI attestation 경계 (2026-10-28)

- 최근 원본 [PR CI #3365.1](https://github.com/planner77/masterGantt/actions/runs/40621683119)에서 Quality Required=SUCCESS, Chromium E2E 8/8 및 집계 SUCCESS; Docker actual Smoke 실패: `BuildKit statement subject not bound to image manifest`. #3348.1 직접 PR Version 누락은 해결되었으며 E2E `ECONNRESET`은 이번 실행 재발 없음. Required Docker/자동 QA 실패는 Docker의 파생이다. [누적 원장](../../ISSUE_836_FAILURE_ANALYSIS.md) 참조.
- [BuildKit attestation storage](https://github.com/moby/buildkit/blob/master/docs/attestations/attestation-storage.md): 빈 `subject=[]`만을 이유로 거부하면 unnamed OCI exporter의 유효한 진술을 과도하게 차단할 수 있다. 이를 허용할 때에도 OCI artifact `artifactType`, manifest `subject` 및 index `vnd.docker.reference.digest` 모두 실제 tested child manifest SHA에 결부한다. 잘못된 nonempty statement subject·blob hash·Config/Layer·빌드 출처는 기존 fail-closed.
- Main `2a8cf424ac6d892c641e9cdb01aba0096eaf0356`의 #838–#840 Project Issue 기능/API/DB migration, `package.json`/lock version, E2E shard plan/Tests, Main `AGENTS.md` 및 `docs/TEST_PLAN.md`를 원본 손실 없이 보존하는 PR 브랜치 merge를 수행한다. 해당 Main 변경을 #836 PR 범위로 재구현/덮어쓰지 않는다.
- 미해결 review thread=0; Codex 한도 초과는 User `OWNER_MANAGED`로 관리하며 Required3·Trusted QA/strict Main/Owner 최종 병합 승인은 여전히 별개다. 최신 Head Full PR CI 시작까지만 수행하고 모니터링/병합/GHCR/Finalizer/Issue 종료 없음.

## REWORK #3 — Full #3377.1 Docker daemon ImageID 표현 차이 경계 (2026-10-28)

- 원본 [PR Full CI #3377.1 Run 40645362176 Attempt1](https://github.com/planner77/masterGantt/actions/runs/40645362176), exact Head `1ecc7dcc2761e91bfd2fb6c178d6f638d8fbc326`, Base `2a8cf424ac6d892c641e9cdb01aba0096eaf0356`, Test-Merge `e4e6f1c044033fed5e945a2b5876fd98410a62c9`: Quality=SUCCESS, E2E Chromium8/8+aggregate=SUCCESS; Docker 구현 `122673720271` 직접 FAIL, Docker Required·Automated QA 파생 FAIL. OCI subject index `sha256:4012a581885331f90ea35e9ede02b4676aad3a4a521909c6a8f2a5d0f27aee30`, image config `sha256:2a4242b723a8d5cd0995a21ed92ca74a20417944af2c25d696292996ef40c836`; `skopeo`도 동일 Config SHA 복사 기록. 이미지 로드 후 `docker image inspect .Id`와 Config digest 같지 않아 `BLOCKED: OCI archive config differs from tested Docker image`로 차단. 실제 Docker ID 값은 구 로그에 출력되지 않았으므로 메타데이터 재표현 또는 런타임 차이가 무엇인지는 아직 **구분 미확정**이다.
- 교정: SHA 무결성 검증은 그대로 유지한다. 새 `scripts/ci_image_runtime.py`로 원본 OCI archive/report SHA, source OCI config blob hash, 전체 RootFS `diff_ids` 순서, 실제 Docker inspect의 User/Env/Entrypoint/Cmd/Labels/WorkingDir/Healthcheck/Volumes/ExposedPorts 등 실행 속성을 독립 비교한다. 단순 daemon ID 차이는 원본 GHCR OCI subject를 변경하지 않는다. RootFS/실행 설정이 하나라도 다르면 Docker Smoke와 게시를 BLOCKED한다. `tests/python/test_ci_image_reuse.py`에 daemon ID 차이+동등 runtime 긍정 및 악의적 속성/RootFS/Archive 변경 음성 테스트 추가. 새 Runtime Receipt는 원본 OCI Artifact와 별도로 산출한다.
- Main 정렬 상태: `2a8cf424ac6d892c641e9cdb01aba0096eaf0356`와 HEAD merge commit `1ecc7dcc2761e91bfd2fb6c178d6f638d8fbc326`, behind=0/mergeable=true, unresolved inline review=0. Codex/독립 QA는 Owner Managed 리스크 수용; Required3/Trusted/Ruleset은 불변. 다음 Full CI 성공 전 Docker runtime equivalence, GHCR Release/Finalizer, 성능 절감률은 NOT TESTED.

## SOURCE / SCOPE
- 제품 동작/UI/API/DB/앱 SemVer 불변. 구현은 PR OCI evidence, Main source/build contract, Main same-run immutable OCI subject, GHCR exact digest, Release dual-source proof에 한정한다.
- 기준 문서: `AGENTS.md`, `DESIGN.md` (UI 비적용), `docs/CI_CD.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md`, `docs/TEST_PLAN.md`, `docs/GENERIC_RELEASE_FINALIZER.md`, `docs/ISSUE_836_FAILURE_ANALYSIS.md`, `docs/PR_CI_FAILURE_TRIAGE.md`, `docs/ISSUE_LIFECYCLE.md`.
- 연관: #438 Main GHCR digest→SemVer, #773 Release Main static/E2E evidence, #711 TEST_LIFECYCLE_REVIEW, #659 PR Fast Gate, #770/771/772 Full/Targeted/Shadow, #775 no-image 예외, #769 CI Epic, #444/#790 Buildx cache.
- 이 PR/보호 정책 자체 **HIGH**, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=false`, `release_authorized=false`; PR opened→Full CI 시작까지만. Main/GHCR/Release/Finalizer 실행·병합·Issue 종료는 사용자 승인 범위 밖이다.

## 설계 결정 / 검증 경계
1. **공통 PR/Main Docker Smoke**: 같은 Buildx action/Dockerfile/production SemVer arg/source+revision+version labels를 적용하여 `type=oci` 단일 OCI tar를 내보낸다. `scripts/verified_oci.py`로 OCI 상위 index SHA256과 linux/amd64 child manifest/config/layers, file SHA/size, signed-by-origin이 아닌 BuildKit in-toto attestation의 image child subject/SBOM/provenance를 구조·해시 검증한다. `skopeo`로 적재한 image의 **RootFS DiffID·실행 설정 전체**와 OCI source Config Blob의 동일성을 검증하고 기존 HTTP·migration/readiness·SQLite·Compose·image policy/size baseline을 그대로 실행한다. 모든 Smoke 성공 뒤 `ci-oci-pr-<run>-<attempt>` 및 `ci-pr-build-contract-<run>-<attempt>` artifact 발행. PR package-write/registry login 없음.
2. **독립 Main 선택**: 신뢰된 main 스크립트 `scripts/ci_image_reuse.py`가 실제 two-parent merge/PR 귀속, first parent+PR head, 정확 Full Run ID/Attempt + 원본 `ci-pr-source` 이벤트, QA Required3 + 실제 Docker 구현 Job 성공, Test-Merge Git Tree == Main Tree, 신뢰 스크립트 미변경, artifact SHA256/중복/만료, attestation OCI labels, builder·input 환경 계약을 검사한다. PR 자체 metadata/selected Fast/Edited/Draft로 PASS를 생성하지 않는다.
3. **소스와 빌드 입력**: `scripts/ci_image_contract.py`는 immutable Dockerfile Base 이미지 Digest, `.dockerignore`, package/lock, Next config/entrypoint checksum, production Build ARG, OCI index+artifact SHA, `docker buildx version`, Docker server version, GitHub runner image version/OS/arch를 정확 비교한다. 변경·누락·squash/rebase·Test-Merge 트리 불일치는 자동 Main 재빌드. apt/npm 외부 네트워크 패키지의 비트 재현성은 **추정하지 않고** 실제 검증된 바이너리만 다룬다.
4. **결과**: Owner가 2026-10-28 `PR_IMAGE_REUSE_ENABLED` **미설정/true=기본 ON**, **false=SHADOW/롤백**을 명시 지시했다. 실제 인증/Required/Owner Managed QA/정식 GHCR 승인과 구분한다. source+builder+OCI 인증이 모두 성립하면 `PR_REUSE_VERIFIED` → PR OCI 그대로 Main Docker Smoke; 정상 부적격이면 `REBUILD_MAIN_VERIFIED` → 최종 Main SHA로 OCI 1회 build/Main Docker Smoke. 의심스러운 artifact/출처/권한 오류는 `BLOCKED` (flag ON 시 publish 중단), 상태/사유는 JSON + Step Summary. 기존 docs-only 및 recovery no-image gate 유지.
5. **Main 정확 동일 subject 게시**: 전체 Main Quality/Chromium8/Docker 성공 후 Stage1은 동일 Main-smoked artifact를 같은 Run에서 받는다. artifact ZIP/manifest/index/output 값을 재검사하고 `skopeo copy --all --preserve-digests`로 `ci-<Main SHA>` 게시하여 원본 top OCI digest 보존 실패 시 차단한다. Stage0 또는 image-less는 기존 `docker/build-push-action` 경로가 살아 있다. 기존 exact digest pull, non-root policy, HTTPS/browser, SQLite restart, Project/Task API 등 후속 단계 필수. Old GHCR tag 덮어쓰기 금지, 실패 candidate cleanup 지침 보존.
6. **Release 명시적 이중 출처**: 기본 후보 `revision==Main SHA` 유지. 동일 index digest지만 `revision==PR Test-Merge SHA`인 OCI는 `scripts/verify_ci_image_release.py`가 exact trusted two-parent Git mapping, PR Full+Docker Run/Attempt/OCI subject, 별개 성공한 Main push Full Required3+Docker+publish Run/Attempt을 다시 검증한 경우에만 인정한다. 이 자체도 GHCR candidate 후속 runtime tests, #438 immutable SemVer promotion, #773 별도 static/E2E Shadow, Generic Finalizer/Owner approval을 우회하지 않는다. 원본 증거 만료·불명확하면 Release **BLOCKED**.
7. **관측·롤백**: 기본 ON으로 조건부 재사용을 시도하되 각 PR/Main Full 성공, Release 독립 검증 전 정식 게시·병합 승인을 인정하지 않는다. 10개 distinct 성공 Run은 채택 성능 평가 기준이며, 장애 발생 시 false로 즉시 SHADOW 롤백한다. 사례별 `PR_REUSE_VERIFIED`/`REBUILD_MAIN_VERIFIED`/`BLOCKED` 건수, index digest, archive bytes, 업로드/다운로드/build 횟수, Runner-min, P50/P90, release latency 및 storage 비용 비교. 불리하거나 실패할 경우 variable OFF, Main 원래 Safe rebuild로 복귀. 현재 통계 `INSUFFICIENT_DATA`.

## 안전 시험 계획
- `tests/python/test_ci_image_reuse.py`: OCI index-child-config SHA 일치/불일치, 실행 이미지 라벨, SBOM/Provenance 누락, blob 오염/경로 탈출, Stage0/OFF/ON/Recovery, PR Source/Tree 부정.
- `tests/python/test_ci_image_release.py`: Main exact success, OCI digest/Run missing, Main GHCR publish 실패, revision invalid.
- 기존 소비자 `scripts/test_pr_fast_gate.py`, `tests/python/test_release_reuse_evidence.py`, `tests/python/test_preview_publish.py`, `tests/scripts/deployment-layout.test.ts`, `scripts/verify-issue-lifecycle.py` 보존; 정적 계약·negative 합집합으로 수행.
- 필수 CI `.github/workflows/ci.yml` Policy에서 신규 Python 두 파일 직접 실행. 동일 Head Full Quality/Chromium8/8/Docker, default-main Trusted QA·Owner 위험 수용 별도.
- 실제 네트워크 Docker BuildKit→OCI archive/skopeo→GHCR→Release live 동일 Digest, Runner ImageVersion, SBOM subject 플랫폼, 추정 시간/효과는 **원격 CI 전 NOT TESTED**. 추가 테스트 실패 발견 시 [누적 원장](../../ISSUE_836_FAILURE_ANALYSIS.md)에 직접/파생 실패 구분 후 재작업.

## TEST_LIFECYCLE_REVIEW (#711)
- **ADD**: `test_ci_image_reuse.py` (PR→Main immutable source/cross-attempt/OCI byte negative), `test_ci_image_release.py` (dual source release proof); 기존 #773 tests는 static/E2E reuse와 Main source proof가 목적이 달라 새 케이스 고유함.
- **KEEP_UNIQUE**: `test_release_reuse_evidence.py`, `test_preview_publish.py`, `test_pr_fast_gate.py`, `deployment-layout.test.ts` (release static evidence, 권한 preview, Fast Gate/Required3, layout·GHCR cleanup 고유 계약).
- **EXTEND**: Policy workflow Python discovery에서 새 source/digest negative test 병합; 기존 flaky skip/retry/timeout/Required3 완화 없음.
- 탐색 경로: `tests/python/test_ci_*.py`, `tests/python/test_release_reuse_*.py`, `tests/python/test_preview_publish.py`, `tests/scripts/deployment-layout.test.ts`, `scripts/test_pr_fast_gate.py`.
- 로컬 환경은 remote GitHub connector 중심이며 실제 Docker/Node/Playwright 검증 불가: `NOT TESTED`. 정확 Run 결과 전 PASS/경감률/Owner FINAL 주장 금지.

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(Existing Owner/Trusted review policy unchanged)
- `DESIGN.md`: N/A(No UI, UX, product interaction or component changes)
- `docs/API.md`: N/A(No HTTP API route or response changes)
- `docs/DB_SCHEMA.md`: N/A(No SQLite schema or database migration changes)
- `docs/ISSUE_LIFECYCLE.md`: N/A(Exact SHA and finalizer rules unchanged; referenced)
- `docs/exec-plans/active/ISSUE_836.md`: UPDATED
- `docs/ISSUE_836_FAILURE_ANALYSIS.md`: UPDATED

## AC_TEST_COVERAGE
- AC1: OCI archive와 immutable source/BuildKit attestation, PR 실제 Smoke 후 두 Artifact 업로드 + policy negative, 원격 NOT TESTED.
- AC2: Git two-parent/Test-Merge Tree + Docker context/base/lock/Buildx/runner fingerprint 불일치 자동 Main 재빌드, 테스트 negative, 원격 NOT TESTED.
- AC3: Release verified PR revision→Main exact SHA/OCI digest dual-source 검증, 잘못된 revision/Digest 차단 테스트, 원격 NOT TESTED.
- AC4: Stage1 동일 OCI Subject PR Smoke→Main Smoke→ci-tag→Release; index SHA/child config/published digest 증명 필요, 현 상태 NOT TESTED.
- AC5: 안전 부적격은 Main production OCI 빌드 1회 후 Smoke+publish; 위조/불명은 BLOCKED, 케이스 테스트 후 원격 NOT TESTED.
- AC6: 기존 PR/Main Full Required3/Chromium8/8/Trusted/Owner 및 image policy·HTTP(S)·SQLite·Project Task 검증 보존, 실제 CI NOT TESTED.
- AC7: Artifact hash/ATT reference/label/subject 변조, 다른 source/Run, Main 필수 job 실패·metadata 충돌 차단 negative; GHCR 충돌 원격 NOT TESTED.
- AC8: Main exact ci-SHA verified candidate cleanup/attestation, #438 Release immutable SemVer, #773 분리/Generic Finalizer 보존, 원격 NOT TESTED.
- AC9: 명시적 `PR_IMAGE_REUSE_ENABLED=false` SHADOW 롤백 및 빌드 횟수 P50/P90/Runner-min/GB 절감 원장 설계; 10개 원격 유효 Run 전 INSUFFICIENT_DATA.
- AC10: 작업 문서/이슈 실패 원장, CI 관련 AGENTS/CI_CD/TEST_PLAN/REMOTE/Operations/Finalizer 갱신 + #711 lifecycle test registry, 원격 문서 게이트 NOT TESTED.
- AC11: PR 최신 Head Full Required3/Trusted QA, 미해결 thread 0/Strict main/Owner HIGH 확인; Owner 지시에 따라 feature flag 기본 ON을 사용하지만 source 불일치시 Safe Rebuild, 무결성 위반시 BLOCKED, Merge/GHCR/Release 승인과 독립. 새 HEAD Full 결과 아직 NOT TESTED.

## 원격 인수/승인 제한
- PR CI를 시작하고 **모니터링하지 않는다**. Run/Attempt 미관측→`NOT TESTED`, 이슈 **OPEN**, Main/GHCR/Release/tag/Finalizer 실행·Owner Stage1 flag 변경 없음.
