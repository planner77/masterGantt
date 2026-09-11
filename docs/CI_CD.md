# CI/CD와 Semantic Container Release

상태: **로컬 구현·독립 QA PASS / Manager ACCEPT**. GitHub Actions 실행과 GHCR push/pull은 원격 자격증명 회전 및 Repository 설정 확인 전까지 **NOT TESTED / BLOCKED**다.

이 문서는 GitHub Actions, 애플리케이션 버전, GHCR container image의 Source of Truth다. Docker runtime과 운영 persistence는 [DEPLOYMENT.md](DEPLOYMENT.md), 검증 분류는 [TEST_PLAN.md](TEST_PLAN.md), 자격증명 정책은 [SECURITY.md](SECURITY.md)를 함께 따른다.

## 1. 자동화 범위

GitHub Actions로 다음 반복 작업을 대체한다.

- Pull Request와 `main` push: frozen `npm ci`, version manifest 검사, typecheck, lint, Vitest, production build
- Chromium E2E: Playwright browser/dependency 설치 후 worker 1로 전체 실행
- Container CI: clean Docker build, non-root runtime, migration/readiness, native SQLite, 임시 volume 재시작 persistence smoke
- Dependency audit: production npm dependency 취약점 검사
- Semantic release: 승인된 version tag에서 release-configured candidate를 먼저 runtime smoke한 뒤에만 GHCR build/push, SBOM/provenance, registry digest 재다운로드와 smoke test

Actions는 실제 운영 CPU/storage, reverse proxy/TLS, off-host backup/restore, Windows Excel/VBA/DRM 환경과 수동 UX 검증을 대신하지 않는다.

## 2. Semantic Versioning 계약

애플리케이션 버전의 Source of Truth는 root `package.json`의 `version`이다. `package-lock.json`의 top-level과 root package version도 항상 같아야 한다.

지원 형식은 Semantic Versioning 2.0.0의 `MAJOR.MINOR.PATCH`와 optional prerelease다. Container tag 호환성과 하나의 canonical 표현을 위해 build metadata(`+metadata`)는 사용하지 않는다.

- MAJOR: 호환되지 않는 public API, import/export schema 또는 운영 계약 변경
- MINOR: 하위 호환 기능 추가
- PATCH: 하위 호환 버그·보안·문서/운영 수정
- Prerelease: `0.2.0-rc.1`처럼 정식 공개 전 검증 이미지

`0.x`에서도 사용자 workflow나 저장/API 계약을 확장하면 MINOR를 올리고, 기존 계약 내 수정은 PATCH를 올린다. 버전은 낮추거나 재사용하지 않는다. Release workflow는 full Git tag history의 유효한 이전 SemVer를 비교하고 새 version이 모두보다 클 때만 진행한다.

Release authority는 package version과 정확히 일치하는 annotated Git tag `vMAJOR.MINOR.PATCH[-PRERELEASE]`다. CI가 임의로 version commit이나 tag를 만들지 않는다. Tag push 전에 review와 일반 CI를 통과해야 하며, tag 이동·삭제·동일 version 재발행은 금지한다.

## 3. Container image 계약

기본 image 이름은 GitHub repository 이름을 lowercase로 정규화한 다음 경로다.

```text
ghcr.io/<owner>/<repository>
```

안정 버전 `v1.4.2`는 다음 tag를 게시한다.

```text
1.4.2
1.4
1
latest
sha-<40-character-commit>
```

Prerelease `v1.5.0-rc.1`은 mutable stable alias를 변경하지 않는다.

```text
1.5.0-rc.1
sha-<40-character-commit>
```

운영과 자동 테스트 입력은 `latest`, major 또는 minor alias를 사용하지 않는다. 정확한 version 또는 publish output의 digest를 사용한다.

```sh
docker pull ghcr.io/<owner>/<repository>:1.4.2
docker pull ghcr.io/<owner>/<repository>@sha256:<digest>
```

Release workflow는 전체 application/E2E gate 뒤 동일 source·version·platform 설정의 local release candidate를 먼저 build하여 image policy, production runtime config 거부, migration, readiness, native SQLite와 재시작 persistence를 확인한다. 이 pre-publish gate가 통과해야 registry write가 시작된다. Registry에는 먼저 immutable `sha-<commit>` candidate만 push하고 그 digest를 새로 pull해 같은 runtime 동작을 다시 확인한다. 검증·attestation 성공 뒤에만 stable rolling alias를 이동하며 immutable exact version tag는 완료 표식으로 마지막에 생성한다.

모든 version release는 repository 단위 concurrency group에서 직렬 실행한다. Monotonic SemVer gate와 결합하여 늦게 끝난 낮은 version이 `latest`/major/minor alias를 되돌리는 것을 막는다. Exact와 commit tag가 이미 있으면 overwrite하지 않는다.

초기 publish platform은 `linux/amd64`다. `linux/arm64`는 W16에서 해당 architecture의 `better-sqlite3` build/runtime smoke를 통과한 후 manifest에 추가한다.

## 4. Workflow와 권한

| Workflow | Trigger | 권한 | 역할 |
| --- | --- | --- | --- |
| `.github/workflows/ci.yml` | PR, `main` push, manual | `contents: read` | application·browser·container 회귀 |
| `.github/workflows/release-image.yml` | strict `v*` tag | publish job만 `packages: write`, attestation에 필요한 최소 권한 | 검증 후 GHCR publish와 digest smoke |

- PR workflow에 registry credential 또는 write token을 제공하지 않는다.
- `pull_request_target`에서 repository code를 build/test하지 않는다.
- 같은 repository의 GHCR publish는 개인 PAT 대신 job-scoped `GITHUB_TOKEN`을 사용한다.
- GitHub/Docker Actions는 mutable major tag가 아니라 full commit SHA로 고정한다.
- Base image도 digest로 고정하며 Dependabot의 reviewed PR로만 갱신한다.
- Secret은 Docker build arg, OCI label, cache, artifact, log에 전달하지 않는다.
- Release image는 SBOM과 provenance attestation을 생성한다.

공식 근거: [GitHub Docker image publishing](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images), [GitHub workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations), [Docker test before push](https://docs.docker.com/build/ci/github-actions/test-before-push/), [Docker metadata SemVer tags](https://github.com/docker/metadata-action), [Semantic Versioning 2.0.0](https://semver.org/).

## 5. Release 절차

1. 변경의 호환성에 따라 MAJOR/MINOR/PATCH 또는 prerelease를 결정한다.
2. `package.json`, `package-lock.json`, `CHANGELOG.md`를 같은 commit에서 갱신한다.
3. `npm run version:check`와 전체 CI를 통과시킨다.
4. `main` merge 뒤 동일 commit에 annotated `v<package version>` tag를 만든다.
5. Tag를 원격에 push한다. Release workflow가 local candidate runtime gate를 통과하기 전에는 registry write를 수행하지 않으며 수동 GHCR push는 하지 않는다.
6. Immutable commit candidate의 registry digest smoke와 attestation 뒤 rolling alias 및 exact version promotion이 끝났는지 workflow summary에서 확인한다.
7. GHCR package visibility와 consumer `packages: read` 권한을 확인하고 exact version/digest로 테스트한다.

Tag/package 불일치, 이전 tag 이하 version, lightweight tag, 기존 exact/commit image, CI 실패, candidate/publish/promotion 실패 또는 registry digest smoke 실패는 release 실패다. 실패한 exact/commit version을 덮어쓰지 않고 원인을 수정한 다음 새 commit의 PATCH/prerelease version을 사용한다.

## 6. Repository 설정 Gate

Workflow 파일만으로 다음 GitHub 설정을 강제할 수 없으므로 Repository owner가 확인한다.

- Actions 사용 허용과 workflow `GITHUB_TOKEN` package write 정책
- `main` branch required checks 및 review 정책
- `v*` tag 생성/삭제/force-update 제한 ruleset과 release 승인자
- GHCR package와 repository 연결
- Package visibility(public/private) 및 다른 repository/runner의 pull 권한
- Artifact/attestation retention과 조직 정책

과거 노출된 repository credential을 폐기·재발급하기 전에는 branch/tag push와 release를 수행하지 않는다.

## 7. 검증 증거와 상태

로컬에서는 workflow script, version validator, Dockerfile/Compose, image build/runtime/persistence를 검증할 수 있다. GitHub-hosted runner와 GHCR의 최종 PASS에는 다음 원격 증거가 필요하다.

- Actions run URL, commit과 release tag
- runner/Node/Docker version
- image exact tag와 digest
- attestation/SBOM 생성 결과
- GHCR digest pull 및 post-publish smoke 결과

원격 실행 전에는 문서와 로컬 검증이 완료되어도 `Actions/GHCR NOT TESTED`로 유지한다.

## 8. 상시 변경 규칙

CI, release, version, Docker image 또는 registry 계약을 바꾸면 같은 변경에서 다음을 함께 갱신한다.

- Workflow/Docker/script와 해당 자동화 테스트
- 이 문서와 `DEPLOYMENT.md`, `TEST_PLAN.md`
- 요구사항 또는 architecture가 바뀌면 `REQUIREMENTS.md`, `ARCHITECTURE.md`, `DECISIONS.md`
- 현재 작업 상태가 바뀌면 `ISSUE_BREAKDOWN.md`, active `PLAN.md`, milestone review
- 사용자 설치·release·image 소비 방식이 바뀌면 `README.md`와 `CHANGELOG.md`

Action 또는 base image update PR은 full SHA/digest, release note, permissions 변화, build/runtime smoke를 검토한다. 자동 update PR을 merge했다는 사실만으로 production release를 만들지 않는다.
