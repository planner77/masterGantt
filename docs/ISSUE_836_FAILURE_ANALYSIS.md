# Issue #836 — 누적 CI 실패 원장 / PR–Main OCI 이미지 조건부 재사용

Primary: [Issue #836](https://github.com/planner77/masterGantt/issues/836) | Work Packet [ISSUE_836](exec-plans/active/ISSUE_836.md) | 최초 기록 2026-10-28

## Run/Attempt 원본 및 이력

- 본 구현 브랜치 `issue-836-verified-oci-reuse`는 원본 Full #3348.1/#3365.1/#3377.1 모두 FAIL을 보존하며 원인을 각각 누적한다. 이번 신규 Head의 Full CI는 별도 판정.
- 누적 직접 실패 **4건(D836-001/D836-002/D836-003/D836-004, 서로 다른 세 Full Run)**. #3377.1 Quality+Chromium8/8 성공, Docker daemon ID 직접 FAIL 및 Required Docker/QA 파생. 보완 후 새 Head Full CI 결과 `NOT TESTED`.
- 필수 Quality/Chromium E2E8/Docker aggregate, Main GHCR build, Release/Finalizer의 신규 HEAD 결과는 현재 **NOT TESTED**.
- PR Full CI 시작 시 실행한 Run/Attempt·HEAD/BASE/TestMerge·작업/Job ID·재시도·실패 원인·직접 vs 파생 여부를 이 파일에 순차 추가한다. 이전 다른 이슈 실패를 #836의 직접 실패로 오인하지 않는다.

## F836-003 — Full #3377.1 Docker daemon Image ID/OCI config 불일치 (2026-10-28)

- 원본: [PR #837 Full CI Run #3377.1 / 40645362176 Attempt1](https://github.com/planner77/masterGantt/actions/runs/40645362176), Head `1ecc7dcc2761e91bfd2fb6c178d6f638d8fbc326`, Main Base `2a8cf424ac6d892c641e9cdb01aba0096eaf0356`, PR TestMerge `e4e6f1c044033fed5e945a2b5876fd98410a62c9`. Full status=completed/failure.
- **D836-004 / 직접 Docker smoke 구현 Job `122673720271`**: OCI `verified_oci.py` SHA256(index/child/config/layers)·BuildKit provenance/SBOM 성공. Buildx OCI index=`sha256:4012a581885331f90ea35e9ede02b4676aad3a4a521909c6a8f2a5d0f27aee30`, child manifest=`sha256:c6345d9ed01f74dbcf129630e3c3558b5bc9570ef657e5c388e8d4238dd62aa1`, config=`sha256:2a4242b723a8d5cd0995a21ed92ca74a20417944af2c25d696292996ef40c836`, `BUILD_VERSION=0.137.0`. Skopeo copy logs show **same** config sha256:2a4242…, but Docker daemon `inspect --format {{.Id}}` returned a different value (actual ID not logged), triggering `BLOCKED: OCI archive config differs from tested Docker image` before policy/HTTP/SQLite/Compose. 원인 구분: transport/daemon metadata normalization은 추정이고 runtime config 변경 여부 **NOT TESTED**; 원본 OCI SHA 불일치 **확인되지 않음**. ImageID 차이만으로 내용 변경을 단정하거나 원본 OCI Digest를 재라벨하지 않는다.
- **파생 실패:** Required Docker aggregate Job `122674427687` FAIL (actual Docker Job FAIL), Automated QA Final `122684463214` FAIL (`required docker 미성공`). Quality Required `122674285497` SUCCESS, Chromium E2E shards 1..8 Job `122673720327/381/442/331/460/328/388/333` 모두 SUCCESS, E2E aggregate `122684437006` SUCCESS. PR Main commit image publish SKIPPED 정상. 이전 D836-001/002/003은 고유 이력으로 유지하며 본 실행에서는 재발하지 않았다.
- 교정: source `verified_oci.py`의 OCI archive/index/config/layers/attestation SHA 검사 유지. `scripts/ci_image_runtime.py`가 *같은 OCI source blob*의 Config SHA 및 archive SHA를 재계산하고, 적재된 Docker inspect의 RootFS uncompressed DiffID 전체와 실행 설정(User/Env/Entrypoint/Cmd/Labels/WorkingDir/Healthcheck/ExposedPorts/Volumes 등)을 엄격 비교하여 semantic parity를 보증한다. 원본 OCI archive/Registry index digest 자체는 변경 금지; daemon ID 값은 기록만 한다. mismatch/누락은 BLOCKED로 남기며 Image ID 다름만으로 무조건 PASS도 FAIL도 아님. negative 단위/고객형 런타임 테스트 추가; PR Full 최신 HEAD 재시작 후 결과 **NOT TESTED**.
- Main drift **0**, PR mergeable=true, 미해결 review thread 0, Codex quota review 미완료/독립 QA 리스크 Owner Managed. Required3/Trusted/Ruleset, GHCR/Release/Finalizer 승인은 변경하지 않음.

## F836-002 — Full PR CI #3365.1 단일 직접 Docker 실패 및 E2E 8/8 성공 (2026-10-28)

- 원본: [PR #837 / CI Run 40621683119 Attempt 1](https://github.com/planner77/masterGantt/actions/runs/40621683119), Head `b387738fff6c462aa3db8672ab56875743e057fe`, 원래 Base `a4c52b9ba2499a95045a7d85a2c62164210672e6`, test-merge `a0bc32519031d1ab1482680538286cae7adea903`; 최종 `completed/failure` (2026-10-28T03:32:53Z). 원본 #3348.1 실패는 변경·삭제하거나 PASS로 소급하지 않는다.
- **D836-003 / 직접 Docker Smoke Job `122605484859` Step 'OCI blob/digest/SBOM/provenance·런타임 config 동일성 검증'**: OCI build/export 성공, PR `BUILD_VERSION=0.136.0`으로 이전 D836-001의 빈 Version 문제는 해소. 신규 `BLOCKED: invalid OCI image evidence: BuildKit statement subject not bound to image manifest`로 Docker Smoke 미완료. [BuildKit attestation storage 공식](https://github.com/moby/buildkit/blob/master/docs/attestations/attestation-storage.md) 및 [BuildKit writer 구현](https://github.com/moby/buildkit/blob/master/exporter/containerimage/writer.go)에 따르면 export image name이 없는 경우 기본 in-toto statement subject가 빈 배열일 수 있으나, OCI artifact manifest의 `subject` descriptor와 index `vnd.docker.reference.digest`의 정확 child digest 연결은 필수다. 현재 검증기가 빈 statement subject를 무조건 거부하는 **형식 검증 과잉 가능성**이며 실 OCI tar 내부 subject 구조는 아직 별도 Artifact로 확보하지 못했으므로 원인에 대한 직접 관측·추론을 구분한다.
- 교정: nonempty in-toto subject가 있으면 정확 child digest 일치 강제(불일치는 계속 BLOCKED), **빈 배열인 경우에 한해** OCI artifact `artifactType=application/vnd.docker.attestation.manifest.v1+json`, manifest `subject.digest`와 index annotation의 동일 child SHA-256을 모두 요구. OCI blob SHA/index/attestation/Buildx Job·Run 독립 귀속 및 원래 Runtime Smoke 검증을 유지한다. `test_ci_image_reuse.py`에 unnamed export 빈 subject 긍정과 잘못된 nonempty subject 거부 추가.
- **이번 실행의 독립 성공:** Quality Required `122606143099` SUCCESS; Policy/Typecheck/Lint/Vitest/PR Build 전부 SUCCESS. Chromium 8 shards `122605484988/122605484909/122605484902/122605484938/122605484947/122605484930/122605484886/122605484895` 모두 SUCCESS, E2E Required `122615084734` SUCCESS. 원본 D836-002 `ECONNRESET`의 이번 Run 재발 **없음**; 이전 실패 원본은 역사적으로 유지.
- **파생:** Docker Required `122606214501` FAILURE는 직접 D836-003 파생; QA Final Automated `122615109122` FAILURE는 required Docker 미성공 파생; Main image publish는 PR에서 SKIPPED 정상. Owner-managed QA 위험 수용은 이 직접 FAIL을 PASS 처리하지 않는다.
- Main drift: 최초 base `a4c52b9`→새 Main `2a8cf424ac6d892c641e9cdb01aba0096eaf0356` **10 commits**. #838/#839/#840 프로젝트 Issue UI/API/DB SQL Migration/관련 테스트 및 `package.json`·lock version 변경을 보존해야 한다. 겹치는 `AGENTS.md`는 Main #838–#840 접두 지침과 #836 접두 지침을 각각 유지, `docs/TEST_PLAN.md`은 기존 #836 접두와 Main의 #838–#840 끝 추가 시험 계약을 합성한다. 나머지 Main 변경 파일은 source tree에서 손실 없이 보존한다.
- Reviewer: PR #837 unresolved inline thread **0**, Codex 사용량 한도에 의한 review 미완료는 Owner Managed로 수용; 리뷰 성공 주장 금지. Main strict/current and Required3/Trusted QA 계속 필수. Main 정렬 후 새 PR Head의 Full CI 시작(결과는 별도 미확정)까지 진행, CI 모니터링·Main merge·GHCR/Release/Issue 종료는 제외.

## F836-001 — 첫 Full PR CI #3348.1 직접 실패 두 건 및 파생 실패 (2026-10-28)

- 원본: [Full PR CI #3348.1, Run 40614685816](https://github.com/planner77/masterGantt/actions/runs/40614685816), PR #837, Head `f3e71892e8a886157767421b649aefcda6780272`, Base `a4c52b9ba2499a95045a7d85a2c62164210672e6`, synthetic Test-Merge `9b17635ba8f118ba63fb4421a8cbe9dbd2bc4307`. 원본 Full Run `failure`, 기존 READY/non-draft, attempt 1. 별도 FAST_DEVELOPMENT #152.1/`40614685887.1`은 SKIPPED로 승인 증거 아님.
- 직접 **D836-001 / Docker Smoke Job `122575229544` Step13 `OCI blob/digest/SBOM/provenance·런타임 config 동일성 검증` FAIL**: 빌드는 실제 OCI manifest list `sha256:8227f210a428b736375742b57ece73ef2e9b421054e4b62206dd91423150a886`, child image `sha256:5e19460694d48019bf9af1b7fb1cecafce01c88367b411d716f2f2f22683dd9f`, attestation manifest `sha256:967d1e116bffa442aed90223d30717f2db6d5ea778e76b2e4e8160679fbb26a8`까지 export SUCCESS. 그러나 PR `changes.outputs.current_version`이 비어 Docker action의 `build-args: VERSION=`, OCI `org.opencontainers.image.version=`, 검증기 `BUILD_VERSION: `이 되었고 `BLOCKED: invalid OCI image evidence: package version invalid`로 차단. 원인: `changes.release_candidate`는 Main push 전용인데 #836 PR image가 그 출력에 의존하도록 신규 변경됨. **Image integrity 자체가 깨졌다고 오인하지 않음**. 하위 smoke/OCI Archive upload는 미실행이므로 PASS 주장 금지.
- 직접 **D836-002 / PR Chromium E2E shard 6/8 Job `122575229736` Step7 `E2E shard 실행` FAIL**: `tests/e2e/project-transfer-layout-491.spec.ts:148`의 프로젝트 복사 시나리오 최종 `page.request.get(source.path)`(line159)에서 `apiRequestContext.get: read ECONNRESET`; HTTP 127.0.0.1:39343 local test server 연결 종료. `77 passed, 1 failed, 1 skipped, 21 not run` (해당 shard, 20.1분); Playwright Trace Artifact `playwright-report-shard-6`(ID `12785681814`). 본 PR은 테스트/제품 파일을 변경하지 않았으므로 일시적 서버 종료·메모리/네트워크 경합 **가능성**만 있으며 **원인 확정 아님**. assertion/skip/retry/timeout 임의 완화 없이 새 Full8 실행으로 재검증, 재발 시 Trace/server logs와 원본 GitHub Run을 교차 분석.
- 직접 Quality 정책·TypeScript·Lint·Vitest·PR build·Preflight·FastGate **SUCCESS**. Required Docker job `122575918941` FAIL은 D836-001의 **파생**, Required E2E `122582073446` FAIL은 D836-002(다른 5개 샤드 cancel, 7·8 성공, 1~5 중 cancel) **파생**, Automated QA `122582105130` FAIL은 `required e2e 미성공` **파생**. 기존 Full FAIL/미실행을 PASS로 변경하지 않는다.
- Codex 코드 리뷰는 별도 사용량 한도에 의해 review state `failed`, [PR #837 Codex 댓글](https://github.com/planner77/masterGantt/pull/837#issuecomment-6458124889). 변경 Head에 대한 completed 리뷰가 아님. 사용자 Owner는 본 작업의 Codex/QA Review **리스크 관리를 Owner Managed로 명시**했으나 실제 Required3 통과·Trusted QA·strict ruleset은 여전히 필수. 미해결 inline 리뷰 스레드 **0**, PR initial `mergeable=true`로 확인; 이후 Head 변경 시 재확인.
- 복구 교정: PR/Main 공통 exact-checkout `package.json.version`을 independent `changes.package_version`으로 생성하고 `current_version`에 PR fallback 연결. OCI layout wrapper/registry Subject SHA 정합 검증 추가. Owner 요청에 따라 `PR_IMAGE_REUSE_ENABLED`은 **미설정=기본 ON**, `true`=ON, `false`=OFF/롤백; 단 source/digest/Full/Runtime gate 실패 시 재사용 승인 불가. 테스트/관련 문서 갱신 후 **새 Head Full CI 시작(결과 NOT TESTED)**.
- 본 원장에 입증되지 않은 가정: Buildx archive top `index.json` wrapper가 manifest list descriptor를 감싸는 경우 index digest 식별; OCI 변조 없이 검증/게시 digest가 같은지는 신규 실제 Docker Smoke/Publish/Release before activation 검사에서만 확정. 일시적 E2E 환경 문제는 새 Full 결과로 판별.

## 사전 실패 위험 / 예방 조치 (실행 실패로 계수하지 않음)

| ID | 검토한 위험 경계 | 구현상의 보호 | 원격 실증 |
| --- | --- | --- | --- |
| R836-01 | PR Test-Merge revision label != Main merge SHA, 임의 re-label은 digest 변경 | PR OCI 원래 revision 보존, Release 별도 read-only 신뢰 출처→Main SHA와 exact Main Full 원본 검사 | NOT TESTED |
| R836-02 | 기존 Docker daemon `load: true`에서 OCI SBOM/provenance 소실 | Buildx OCI archive, attestation subject+blob hash, skopeo platform-selected Docker smoke, GHCR preserve-digests | NOT TESTED |
| R836-03 | 다른 PR/Run/Attempt, 합성 merge Tree·버전 변경 | Git Tree equality, two parents, exact `ci-pr-source`, immutable ZIP SHA256 + Work contract | NOT TESTED |
| R836-04 | 구버전 Runner/Buildx/lock/Base 이미지·Next 환경 차이 | `ci_image_contract` fingerprint drift→새 Main 빌드, 위조 receipt→BLOCKED | NOT TESTED |
| R836-05 | GHCR 재게시 시 Manifest index 재인코딩/태그 충돌 | `skopeo --all --preserve-digests`, publish 단계 digest 동치 요구, 기존 immutable ci-SHA tag overwrite guard | NOT TESTED |
| R836-06 | 아직 승인되지 않은 feature 활성화로 증명 없는 PR 이미지 게시 | `PR_IMAGE_REUSE_ENABLED` unset=ON/true=ON/false=OFF, Owner가 기본 활성화를 지시했으나 모든 출처/무결성/Required gate 불변 | NOT TESTED |
| R836-07 | 기존 #773의 Release static/E2E 증거 재사용과 #836 이미지 재사용 혼동 | `RELEASE_REUSE_ENABLED`와 별도 flag 및 별도의 immutable Main Full 증명 | NOT TESTED |

## 실패 분석/교정 절차
1. GitHub 원본 Run ID/Attempt, 정확 PR Head/Base/TestMerge 또는 Main SHA, Workflow path, Job/Step 결론과 artifact SHA를 기록한다.
2. 모든 **실제 직접 실패**와 Policy/Fast Gate/Required3/QA의 **파생 차단**을 분리해 누적 이력으로 보존한다. 단일 최신 실패만 수정 금지.
3. `AGENTS.md`, `docs/PR_CI_FAILURE_TRIAGE.md`, `docs/GITHUB_OPERATIONS.md`, `docs/TEST_PLAN.md`, Work Packet와 본 원장 근거로 수정 후 신규 Head PR CI 실행.
4. 절대 이미 실패한 Run을 PASS로 수정하거나 기존 tag/source/실패 로그를 변조하지 않는다. 미해결 Review/merge conflict와 Owner 위험 승인도 별도다.

현재 이슈 `OPEN`, 이전 Full #3348.1/#3365.1/#3377.1 실패; 보완 신규 Full 결과 미확정, 원격 OCI 소스/릴리스 검증 `NOT TESTED`. 요청 범위: PR CI 시작까지, **모니터링·병합·GHCR Release/Issue 종료 없음**.
