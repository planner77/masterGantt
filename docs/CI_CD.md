# CI/CD, Commit Test Image와 Semantic Container Release

상태: W20/W22 Semantic Release와 Main Commit Image Automation은 **독립 QA PASS / Manager ACCEPT**다. Main/PR와 `v0.4.0` release Actions, private GHCR publish, commit/release digest의 원격·로컬 smoke 및 SBOM/provenance 조회를 완료했다. D05에 따라 현재 요금제의 branch/tag ruleset 미강제 위험을 수용하고 GitHub Artifact Attestation은 비활성으로 두며 BuildKit SBOM/provenance를 필수로 유지한다.

이 문서는 GitHub Actions, 애플리케이션 버전, GHCR container image의 Source of Truth다. Docker runtime과 운영 persistence는 [DEPLOYMENT.md](DEPLOYMENT.md), 검증 분류는 [TEST_PLAN.md](TEST_PLAN.md), 자격증명 정책은 [SECURITY.md](SECURITY.md)를 함께 따른다.

## 1. 자동화 범위

GitHub Actions로 다음 반복 작업을 대체한다.

- Pull Request와 `main` push: frozen `npm ci`, version manifest 검사, typecheck, lint, 루트/외부 cwd의 테스트 발견 검사, Vitest, production build
- Chromium E2E: Playwright browser/dependency 설치 후 worker 1로 전체 실행
- Container CI: clean Docker build, non-root runtime, migration/readiness, native SQLite, 임시 volume 재시작 persistence smoke
- Dependency audit: production npm dependency 취약점 검사
- Main commit image: 위 gate를 모두 통과한 `main` push만 immutable `ci-<full SHA>`를 GHCR에 게시하고 exact digest를 pull하여 HTTP Project/Task authorization·저장·재시작 persistence 검증
- Semantic release: 승인된 version tag에서 release-configured candidate를 먼저 runtime smoke한 뒤에만 GHCR build/push, SBOM/provenance, registry digest 재다운로드와 smoke test

Actions는 실제 운영 CPU/storage, reverse proxy/TLS, off-host backup/restore, Windows Excel/VBA/DRM 환경과 수동 UX 검증을 대신하지 않는다.

### 필수 테스트 발견 gate (#13)

`.github/workflows/ci.yml`의 `quality` job은 `npm ci` → version → typecheck → lint 다음, `npm test` 전에 `node scripts/verify-test-discovery.mjs`를 실행한다. PR/main/manual CI 모두 같은 순서를 따른다. 이 gate는 단위 테스트 실행이나 Chromium E2E 자체를 대체하지 않는다. Semantic release workflow의 별도 검증 순서는 해당 workflow를 따르며 이 문구가 release에 새 step을 추가했다는 의미는 아니다.

스크립트는 설치된 Vitest와 Playwright CLI를 각각 저장소 루트와 저장소 밖 임시 디렉터리에서 실행하고, 절대 경로로 지정한 `tests/config/vitest.config.ts`와 `tests/config/playwright.config.ts`가 같은 전체 테스트를 발견하는지 확인한다. Vitest 목록은 호출 위치 기준 경로를 정규화·정렬한 뒤 실제 `.test.ts` 파일 목록과 비교하여 누락·추가·중복을 거부한다. Playwright는 전체 목록의 일치와 각 E2E spec 포함 여부, 10개 이상 테스트를 확인한다. 단위 파일 28개 이상은 기존 기준의 최소 안전장치이며, 새 테스트를 제거할 수 있다는 의미가 아니다. 테스트 0개, 설정 로딩 실패, CLI 비정상 종료 또는 발견 범위 불일치는 CI 실패다.

현재 package에는 `type: module`이 없고 Playwright는 `.ts` 설정을 CommonJS로 읽는다. 따라서 이 설정의 저장소 경로는 `resolve(__dirname, "../..")`으로 구한다. Vitest 설정의 `import.meta.url`과 기계적으로 통일하거나, root package 모듈 모드를 바꾸어 오류를 우회하지 않는다. 파일 기반 경로 계산을 유지하면서 실제 CLI로 로딩해야 한다. 타입 검사 PASS만으로 이 gate를 생략하지 않는다. 상세 경로와 편집기 사용은 [REPOSITORY_STRUCTURE](REPOSITORY_STRUCTURE.md)를 따른다.

실패 시 해당 head SHA/run/job/최초 오류를 기록하고 설정 또는 검증 로직을 수정한 **새 commit**으로 전체 CI를 실행한다. 실패 gate를 삭제·skip하거나 `passWithNoTests`로 통과시키지 않는다. 추가 코드 변경 없는 재실행은 transient 원인일 때만 별도 근거를 남기며, 과거 실패 기록은 유지한다.

## 2. Semantic Versioning 계약

애플리케이션 버전의 Source of Truth는 root `package.json`의 `version`이다. `package-lock.json`의 top-level과 root package version도 항상 같아야 한다.

지원 형식은 Semantic Versioning 2.0.0의 `MAJOR.MINOR.PATCH`와 optional prerelease다. Container tag 호환성과 하나의 canonical 표현을 위해 build metadata(`+metadata`)는 사용하지 않는다.

- MAJOR: 호환되지 않는 public API, import/export schema 또는 운영 계약 변경
- MINOR: 하위 호환 기능 추가
- PATCH: 하위 호환 버그·보안·문서/운영 수정
- Prerelease: `0.5.0-rc.1`처럼 정식 공개 전 검증 이미지

`0.x`에서도 사용자 workflow나 저장/API 계약을 확장하면 MINOR를 올리고, 기존 계약 내 수정은 PATCH를 올린다. 버전은 낮추거나 재사용하지 않는다. Release workflow는 full Git tag history의 유효한 이전 SemVer를 비교하고 새 version이 모두보다 클 때만 진행한다.

Release authority는 package version과 정확히 일치하는 annotated Git tag `vMAJOR.MINOR.PATCH[-PRERELEASE]`다. CI가 임의로 version commit이나 tag를 만들지 않는다. Tag push 전에 필수 CI 통과와 지정 release authority를 확인하며, GitHub의 필수 승인 review 수는 0명이다. Tag 이동·삭제·동일 version 재발행은 금지한다.

## 3. Container image 계약

기본 image 이름은 GitHub repository 이름을 lowercase로 정규화한 다음 경로다.

```text
ghcr.io/<owner>/<repository>
```

성공한 `main` push의 사용자·통합 테스트 image는 다음 immutable tag 하나만 게시한다.

```text
ci-<40-character-commit>
```

같은 tag가 이미 존재하면 덮어쓰지 않고 실패한다. Commit workflow는 SemVer exact/major/minor/latest 또는 release candidate `sha-<commit>` tag를 만들지 않는다. PR과 수동 `workflow_dispatch`는 검증만 수행하고 registry에 로그인하거나 쓰지 않는다.

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

운영과 자동 테스트 입력은 `latest`, major 또는 minor alias를 사용하지 않는다. Commit 테스트는 workflow가 출력한 `ci-<full SHA>`의 exact digest를, release 테스트·배포는 정확한 version 또는 release output digest를 사용한다.

```sh
docker pull ghcr.io/<owner>/<repository>:1.4.2
docker pull ghcr.io/<owner>/<repository>:ci-<full-commit>
docker pull ghcr.io/<owner>/<repository>@sha256:<digest>
```

Main commit workflow는 quality, Chromium E2E와 local container smoke가 모두 성공한 뒤 별도 publish job을 실행한다. `ci-<full SHA>`를 push한 후 tag가 아니라 build output의 digest로 다시 pull하고 image content policy, migration/readiness, Project 생성과 edit session, root Task 저장, unauthorized mutation 거부, container restart 뒤 Project/Task 재조회를 검증한다. Commit image의 성공은 SemVer release 승인이 아니며 stable alias를 이동하지 않는다.

Release workflow는 전체 application/E2E gate 뒤 동일 source·version·platform 설정의 local release candidate를 먼저 build하여 image policy, production runtime config 거부, migration, readiness, native SQLite와 재시작 persistence를 확인한다. 이 pre-publish gate가 통과해야 registry write가 시작된다. Registry에는 먼저 immutable `sha-<commit>` candidate만 push하고 그 digest를 새로 pull해 같은 runtime 동작을 다시 확인한다. Digest 검증과, 활성화된 경우 GitHub Attestation이 성공한 뒤에만 stable rolling alias를 이동하며 immutable exact version tag는 완료 표식으로 마지막에 생성한다.

모든 version release는 repository 단위 concurrency group에서 직렬 실행한다. Monotonic SemVer gate와 결합하여 늦게 끝난 낮은 version이 `latest`/major/minor alias를 되돌리는 것을 막는다. Exact와 commit tag가 이미 있으면 overwrite하지 않는다.

초기 publish platform은 `linux/amd64`다. `linux/arm64`는 W16에서 해당 architecture의 `better-sqlite3` build/runtime smoke를 통과한 후 manifest에 추가한다.

## 4. Workflow와 권한

| Workflow | Trigger | 권한 | 역할 |
| --- | --- | --- | --- |
| `.github/workflows/ci.yml` 검증 jobs | PR, `main` push, manual | `contents: read` | application·browser·container 회귀 |
| `.github/workflows/ci.yml` commit publish job | 성공한 `main` push만 | `contents: read`, `packages: write`; optional attestation을 위해 job에 `attestations: write`, `id-token: write` 선언 | immutable `ci-<full SHA>` publish와 digest HTTP persistence smoke |
| `.github/workflows/release-image.yml` | strict `v*` tag | publish job만 package/attestation 쓰기와 OIDC 권한 선언 | 검증 후 GHCR publish와 digest smoke |

- PR과 수동 CI에는 registry credential 또는 write token을 제공하지 않는다.
- `pull_request_target`에서 repository code를 build/test하지 않는다.
- 같은 repository의 GHCR publish는 개인 PAT 대신 job-scoped `GITHUB_TOKEN`을 사용한다.
- GitHub/Docker Actions는 mutable major tag가 아니라 full commit SHA로 고정한다.
- Base image도 digest로 고정하며 Dependabot의 reviewed PR로만 갱신한다.
- Secret은 Docker build arg, OCI label, cache, artifact, log에 전달하지 않는다.
- Commit과 release image는 BuildKit SBOM/provenance를 항상 생성한다. GitHub Artifact Attestation은 private repository에서 Enterprise Cloud가 필요하므로 `ENABLE_GITHUB_ATTESTATIONS=true`인 지원 환경에서만 step을 실행하고, 미지원 상태를 성공 attestation으로 기록하지 않는다. 현재 workflow는 optional step을 같은 publish job에 두어 attestation/OIDC 권한 자체는 flag가 꺼진 run에도 선언된다. 권한까지 조건부로 축소하려면 별도 gated attestation job으로 분리하고 publish/promotion 순서를 다시 검증해야 한다.

공식 근거: [GitHub Docker image publishing](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images), [GitHub workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations), [Docker test before push](https://docs.docker.com/build/ci/github-actions/test-before-push/), [Docker metadata SemVer tags](https://github.com/docker/metadata-action), [Semantic Versioning 2.0.0](https://semver.org/).

## 5. Release 절차

1. 변경의 호환성에 따라 MAJOR/MINOR/PATCH 또는 prerelease를 결정한다.
2. `package.json`, `package-lock.json`, `CHANGELOG.md`를 같은 commit에서 갱신한다.
3. `npm run version:check`와 전체 CI를 통과시킨다.
4. `main` merge 뒤 동일 commit에 annotated `v<package version>` tag를 만든다.
5. Tag를 원격에 push한다. Release workflow가 local candidate runtime gate를 통과하기 전에는 registry write를 수행하지 않으며 수동 GHCR push는 하지 않는다.
6. Immutable commit candidate의 registry digest smoke와, 활성화한 경우 GitHub Attestation 뒤 rolling alias 및 exact version promotion이 끝났는지 workflow summary에서 확인한다.
7. GHCR package visibility와 consumer `packages: read` 권한을 확인하고 exact version/digest로 테스트한다.

Tag/package 불일치, 이전 tag 이하 version, lightweight tag, 기존 exact/commit image, CI 실패, candidate/publish/promotion 실패 또는 registry digest smoke 실패는 release 실패다. 실패한 exact/commit version을 덮어쓰지 않고 원인을 수정한 다음 새 commit의 PATCH/prerelease version을 사용한다.

### Main commit image 소비 절차

1. `main` push의 quality, E2E, container와 publish job이 모두 성공했는지 확인한다.
2. Workflow summary의 `ci-<full SHA>`와 `sha256:<digest>`가 대상 commit과 일치하는지 확인한다.
3. Private GHCR consumer는 필요한 범위의 `packages: read` credential로 로그인한다.
4. tag를 배포 기준으로 재해석하지 말고 summary의 exact digest를 pull해 격리 volume에서 테스트한다.
5. release가 필요하면 별도 SemVer bump·CHANGELOG·annotated tag 절차를 수행한다. Commit image를 release alias로 retag하지 않는다.

## 6. Repository 설정 Gate

Workflow 파일만으로 다음 GitHub 설정을 강제할 수 없으므로 Repository owner가 확인한다.

- Actions 사용 허용과 workflow `GITHUB_TOKEN` package write 정책
- `main` branch required checks 및 review 정책
- `v*` tag 생성/삭제/force-update 제한 ruleset과 release 승인자
- GHCR package와 repository 연결
- Package visibility(public/private) 및 다른 repository/runner의 pull 권한
- Artifact/attestation retention과 조직 정책

2026-09-12 D04 정책 결정은 다음과 같다.

- GHCR package는 private으로 유지한다.
- downstream consumer에는 필요한 대상에만 최소 `packages: read`를 부여한다.
- `main`은 필수 CI를 통과해야 하며 Pull Request 흐름은 유지하되 필수 승인 review 수는 0명이다.
- `refs/tags/v*` update/delete/force-update를 금지하고 지정 maintainer만 release authority를 가진다.
- package-repository linkage와 SBOM/provenance/attestation 보존을 활성화하고 최초 publish 뒤 실제 설정을 재검증한다.

사용자 승인 범위의 in-memory helper를 통해 기존 repository credential의 admin 인증이 성공했고 `planner77/masterGantt`가 private임을 확인했다. Credential 평문을 화면·로그·문서·workflow 입력에 출력하거나 별도 파일로 복사하지 않는다. 허용된 helper가 필요 시 값을 process memory로 불러와 HTTPS API 인증에 사용하는 것은 값의 사람/모델 열람·출력과 구분한다. 과거 노출 credential을 계속 사용하는 것은 사용자가 수용한 잔여 위험이며 안전 판정이 아니다.

원격 확인에서 아직 `mastergantt` container package는 존재하지 않았다. Private repository의 ruleset API는 현재 plan에서 403을 반환했다. GitHub 공식 정책상 private branch/tag ruleset은 Pro/Team/Enterprise에서, private Artifact Attestation은 Enterprise Cloud에서 지원된다. D05에서 사용자는 현재 private 요금제를 유지하고 ruleset 미강제 위험을 명시적으로 수용했다. 이는 보호가 적용됐다는 뜻이 아니며 지정 maintainer와 문서화된 절차를 운영 통제로 유지한다. GitHub Attestation은 비활성으로 두고 `ENABLE_GITHUB_ATTESTATIONS`를 설정하지 않으며 BuildKit SBOM/provenance는 항상 유지한다.

## 7. 검증 증거와 상태

로컬에서는 workflow script, version validator, Dockerfile/Compose, image build/runtime/persistence를 검증할 수 있다. Admin 인증 성공은 workflow/artifact PASS가 아니다. Commit image와 SemVer release의 최종 PASS에는 각각 다음 원격 증거가 필요하다.

- Actions run URL, event와 commit; release에는 annotated tag도 포함
- runner/Node/Docker version
- commit `ci-<full SHA>` 또는 release exact tag와 digest
- BuildKit provenance/SBOM 생성 결과와, opt-in한 경우에만 GitHub Attestation 결과
- GHCR digest pull 및 post-publish smoke 결과
- Commit image는 HTTP Project/Task authorization·저장·restart 재조회 결과

원격 실행 전에는 문서와 로컬 검증이 완료되어도 해당 Commit/Release 경로를 `Actions/GHCR NOT TESTED`로 유지한다. 한 경로의 성공을 다른 경로의 증거로 대체하지 않는다.

## 8. 상시 변경 규칙

CI, release, version, Docker image 또는 registry 계약을 바꾸면 같은 변경에서 다음을 함께 갱신한다.

- Workflow/Docker/script와 해당 자동화 테스트
- 이 문서와 `DEPLOYMENT.md`, `TEST_PLAN.md`
- 요구사항 또는 architecture가 바뀌면 `REQUIREMENTS.md`, `ARCHITECTURE.md`, `DECISIONS.md`
- 현재 작업 상태가 바뀌면 `ISSUE_BREAKDOWN.md`, active `PLAN.md`, milestone review
- 사용자 설치·release·image 소비 방식이 바뀌면 `README.md`와 `CHANGELOG.md`

Commit publish 변경은 `ci-<SHA>` overwrite 거부, main-only 조건, upstream gate 의존성, PR/manual read-only, digest pull 및 HTTP persistence smoke를 함께 검토한다. Release publish 변경은 `sha-<SHA>` candidate와 SemVer promotion 불변식을 별도로 검토한다.

Action 또는 base image update PR은 full SHA/digest, release note, permissions 변화, build/runtime smoke를 검토한다. 자동 update PR을 merge했다는 사실만으로 production release를 만들지 않는다.

## Repository layout relocation (#12)

현재 배포 경로와 기존 Compose 프로젝트/volume을 유지하는 전환 절차는 [REPOSITORY_STRUCTURE](REPOSITORY_STRUCTURE.md)를 따른다. CI의 Docker build 4개 참조와 Dependabot 경로를 함께 갱신하고 Docker gate에 `scripts/verify-compose-smoke.sh`를 추가했다. 새 Compose 경로의 config, startup/readiness, restart 및 강제 recreate 후 SQLite 보존을 격리된 CI 리소스로 검사한다. 기존 quality/E2E/runtime/registry 권한·검증 gate는 유지한다. 결과는 해당 PR/run/head의 실제 증거로 판정하며 과거 Wxx 기록을 이번 이동의 PASS로 전용하지 않는다.
