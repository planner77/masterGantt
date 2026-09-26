# CI/CD

## Issue #157 Compose pull/build 경로 검증

- 운영 `deploy/compose.yml`은 `build:`가 없는 image-only 구성이고 `pull_policy: always`를 사용한다.
- local/CI source build는 `deploy/compose.build.yml` override에서만 `build:`를 추가하며 `pull_policy: never`를 사용한다.
- `scripts/verify-compose-smoke.sh`는 production Compose config와 build override merged config를 각각 검사한 뒤, build override로 만든 격리 image를 `--pull never --no-build` runtime smoke에 사용한다.
- 기존 named volume persistence, startup migration/readiness, Resource 관리자 인증 및 secret 비노출 검증은 그대로 유지한다.
- 운영 rolling tag 배포는 `--pull always --no-build --force-recreate`를 사용하고, exact SemVer 또는 verified digest를 우선한다.
- `docker compose config` 전체 출력에는 치환된 secret이 포함될 수 있으므로 CI/Issue 증거에는 secret을 기록하지 않는다.

 Commit Test Image와 Semantic Container Release

> **Issue #8 전송 정책:** production 기본값은 HTTPS다. `ALLOW_INSECURE_HTTP=true`와 canonical HTTP `APP_BASE_URL`을 함께 설정한 내부망은 production HTTP도 지원한다. 시작·readiness·공유 URL·모든 인증 경로는 같은 정책을 사용한다. `SESSION_COOKIE_SECURE`는 미사용 예약값이며 제거했다. HTTP에서는 `mastergantt_edit`, HTTPS production에서는 `__Host-mastergantt_edit; Secure`를 사용하고 HttpOnly·SameSite=Strict·Path=/·TTL 및 Domain 미설정을 유지한다. 아래 과거 검증 이력의 HTTPS-only 표현은 당시 기준이다. 현재 운영·전환 절차는 [HTTP_OPERATION](HTTP_OPERATION.md)을 따른다.


상태: W20/W22 Semantic Release와 Main Commit Image Automation은 **독립 QA PASS / Manager ACCEPT**다. Main/PR와 `v0.4.0` release Actions, private GHCR publish, commit/release digest의 원격·로컬 smoke 및 SBOM/provenance 조회를 완료했다. D05에 따라 현재 요금제의 branch/tag ruleset 미강제 위험을 수용하고 GitHub Artifact Attestation은 비활성으로 두며 BuildKit SBOM/provenance를 필수로 유지한다.

이 문서는 GitHub Actions, 애플리케이션 버전, GHCR container image의 Source of Truth다. Docker runtime과 운영 persistence는 [DEPLOYMENT.md](DEPLOYMENT.md), 검증 분류는 [TEST_PLAN.md](TEST_PLAN.md), 자격증명 정책은 [SECURITY.md](SECURITY.md)를 함께 따른다.

## 1. 자동화 범위

GitHub Actions로 다음 반복 작업을 대체한다.

- Pull Request와 `main` push: frozen `npm ci`, version manifest 검사, typecheck, lint, 루트/외부 cwd의 테스트 발견 검사, Vitest, production build
- Chromium E2E: Playwright browser/dependency 설치 후 worker 1로 전체 실행
- Container CI: clean Docker build, non-root runtime, migration/readiness, native SQLite, 임시 volume 재시작 persistence smoke
- Dependency audit: production npm dependency 취약점 검사
- Main commit registry smoke: 위 gate를 모두 통과한 **비문서** `main` push만 임시 `ci-<full SHA>`를 GHCR에 게시하고 exact digest를 pull하여 HTTP Project/Task authorization·저장·재시작 persistence를 검증한 뒤 package version 삭제. `docs/**` 또는 저장소 루트 Markdown만 변경된 docs-only main push는 publish job을 SKIPPED
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

성공한 `main` push 중 docs-only가 아닌 변경의 registry 검증 image는 다음 임시 tag 하나를 게시한다. docs-only는 `before..head`의 모든 변경 파일이 `docs/**` 또는 저장소 루트 Markdown인 경우이며, 빈 diff·기준 판정 불가·비문서 파일 혼합은 docs-only로 보지 않는다.

```text
ci-<40-character-commit>
```

같은 tag가 이미 존재하면 덮어쓰지 않고 실패한다. Exact digest pull/runtime 검증이 끝나면 해당 `ci-<commit>` package version을 삭제한다. Commit workflow는 SemVer exact/major/minor/latest tag를 만들지 않는다. PR과 수동 `workflow_dispatch`는 검증만 수행하고 registry에 로그인하거나 쓰지 않는다.

안정 버전 `v1.4.2`는 다음 tag를 게시한다.

```text
1.4.2
1.4
1
latest
```

Prerelease `v1.5.0-rc.1`은 mutable stable alias를 변경하지 않는다.

```text
1.5.0-rc.1
```

운영과 자동 테스트 입력은 `latest`, major 또는 minor alias를 사용하지 않는다. Commit 테스트는 workflow가 출력한 `ci-<full SHA>`의 exact digest를, release 테스트·배포는 정확한 version 또는 release output digest를 사용한다.

```sh
docker pull ghcr.io/<owner>/<repository>:1.4.2
docker pull ghcr.io/<owner>/<repository>@sha256:<digest>
```

Main commit workflow는 먼저 변경 유형을 판정한다. quality, Chromium E2E와 local container smoke는 docs-only 여부와 무관하게 실행하며, docs-only가 아닌 경우에만 별도 publish job을 실행한다. `ci-<full SHA>`를 push한 후 tag가 아니라 build output의 digest로 다시 pull하고 image content policy, migration/readiness, Project 생성과 edit session, root Task 저장, unauthorized mutation 거부, container restart 뒤 Project/Task 재조회를 검증한다. 검증 성공 여부와 무관하게 push가 완료된 임시 package version은 cleanup step에서 삭제하며 `ci-*`를 배포·rollback용으로 보관하지 않는다.

Release workflow는 전체 application/E2E gate 뒤 동일 source·version·platform 설정의 local release candidate를 먼저 build하여 image policy, production runtime config 거부, migration, readiness, native SQLite와 재시작 persistence를 확인한다. 이 pre-publish gate가 통과해야 registry write가 시작된다. Registry에는 commit 고정 `sha-*` candidate를 만들지 않고 exact SemVer tag를 직접 push한 뒤 그 build output digest를 새로 pull해 같은 runtime 동작을 다시 확인한다. Digest 검증과, 활성화된 경우 GitHub Attestation이 성공한 뒤에만 stable rolling alias를 이동한다.

모든 version release는 repository 단위 concurrency group에서 직렬 실행한다. Monotonic SemVer gate와 결합하여 늦게 끝난 낮은 version이 `latest`/major/minor alias를 되돌리는 것을 막는다. Exact version tag가 이미 있으면 overwrite하지 않는다.

초기 publish platform은 `linux/amd64`다. `linux/arm64`는 W16에서 해당 architecture의 `better-sqlite3` build/runtime smoke를 통과한 후 manifest에 추가한다.

## 4. Workflow와 권한

| Workflow | Trigger | 권한 | 역할 |
| --- | --- | --- | --- |
| `.github/workflows/ci.yml` 검증 jobs | PR, `main` push, manual | `contents: read` | application·browser·container 회귀 |
| `.github/workflows/ci.yml` commit publish job | 성공한 비문서 `main` push만; docs-only는 SKIPPED | `contents: read`, `packages: write`; docs-only에서는 job 자체가 시작되지 않아 write 권한을 사용하지 않음 | 임시 `ci-<full SHA>` publish/digest smoke와 검증 후 package cleanup |
| `.github/workflows/release-image.yml` | strict `v*` tag push 또는 annotated `v*` tag ref의 수동 실행 | publish job만 package/attestation 쓰기와 OIDC 권한 선언 | 동일 SemVer/annotated-tag 검증 후 GHCR publish와 digest smoke |
| `.github/workflows/ci.yml` branch cleanup policy check | PR, `main` push, manual | `contents: read` | `scripts/verify-safe-branch-cleanup.py`로 완료 Issue helper 재도입과 직접 branch deletion 우회를 차단하고 공통 fail-closed 계약을 회귀 검증 |

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
6. Exact SemVer image의 registry digest smoke와, 활성화한 경우 GitHub Attestation 뒤 stable rolling alias promotion이 끝났는지 workflow summary에서 확인한다.
7. GHCR package visibility와 consumer `packages: read` 권한을 확인하고 exact version/digest로 테스트한다.

연결된 운영 도구가 `GITHUB_TOKEN`으로 annotated tag를 생성해 tag push가 후속 workflow를 자동 재귀 실행하지 않는 경우에는, 해당 **annotated `v*` tag ref**를 지정해 `workflow_dispatch`로 같은 release workflow를 실행할 수 있다. 이 경로도 package/tag 일치, 이전 SemVer보다 큰 버전, annotated tag 여부와 immutable image 충돌 검사를 우회하지 않는다.

Tag/package 불일치, 이전 tag 이하 version, lightweight tag, 기존 exact image, CI 실패, candidate/publish/promotion 실패 또는 registry digest smoke 실패는 release 실패다. 실패한 exact/commit version을 덮어쓰지 않고 원인을 수정한 다음 새 commit의 PATCH/prerelease version을 사용한다.

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

Commit publish 변경은 `ci-<SHA>` overwrite 거부, main-only 조건, upstream gate 의존성, PR/manual read-only, docs-only 판정의 fail-safe 동작, digest pull 및 HTTP persistence smoke를 함께 검토한다. Release publish 변경은 `sha-<SHA>` candidate와 SemVer promotion 불변식을 별도로 검토한다.

Action 또는 base image update PR은 full SHA/digest, release note, permissions 변화, build/runtime smoke를 검토한다. 자동 update PR을 merge했다는 사실만으로 production release를 만들지 않는다.

## Repository layout relocation (#12)

현재 배포 경로와 기존 Compose 프로젝트/volume을 유지하는 전환 절차는 [REPOSITORY_STRUCTURE](REPOSITORY_STRUCTURE.md)를 따른다. CI의 Docker build 4개 참조와 Dependabot 경로를 함께 갱신하고 Docker gate에 `scripts/verify-compose-smoke.sh`를 추가했다. 이 smoke는 새 Compose 경로의 config, startup/readiness, restart 및 강제 recreate 후 SQLite 보존뿐 아니라 `RESOURCE_CATALOG_ADMIN_PASSWORD` 누락 시 config fail-fast, app 컨테이너 환경 전달, 실제 관리자 인증 성공/거부, **인증 요청 직후 로그와 재생성 후 로그의 비밀번호 원문 비노출**을 격리된 CI 리소스로 검사한다. 관리자 비밀번호 값 자체는 Actions 출력에 기록하지 않는다. 기존 quality/E2E/runtime/registry 권한·검증 gate는 유지한다. 결과는 해당 PR/run/head의 실제 증거로 판정하며 과거 Wxx 기록을 이번 변경의 PASS로 전용하지 않는다.

## 9. 공통 작업 브랜치 정리 안전성 (#124)

Issue #124부터 작업 브랜치 삭제는 [공통 안전 cleanup 도구](../scripts/safe_branch_cleanup.py)를 기준으로 한다. 완료된 Issue별 일회성 release/cleanup workflow는 완료 증거를 보존한 채 퇴역하며, 새 Issue 전용 workflow에 삭제 코드를 복제하지 않는다.

공통 도구는 `--repo`, merged `--pr`, `--branch`, 검증된 `--target-sha`를 입력받고 기본적으로 검증만 수행한다. 실제 삭제는 `--delete`를 명시한 경우에만 수행한다.

삭제 전 필수 조건은 다음과 같다.

- PR이 실제 merged 상태이고 base가 `main`이며 head repository/branch가 입력과 정확히 일치한다.
- 현재 remote branch tip이 merged PR head SHA와 정확히 같아야 한다.
- GitHub compare 결과에서 merged PR head가 target main/merge SHA의 ancestor여야 한다.
- protected branch와 해당 branch를 head/base로 사용하는 다른 open PR을 거부한다.
- 삭제 직전 Git ref SHA를 다시 읽어 동일 tip인지 확인한다.
- 최종 삭제는 격리된 bare Git 저장소에서 `--force-with-lease=<ref>:<verified-head>`와 단일 delete refspec으로 수행한다.
- REST 무조건 ref DELETE fallback은 금지한다.
- 삭제 후 GitHub ref가 404인지 확인한다. 조건 불일치·권한·네트워크 오류는 FAIL/BLOCKED이며 보존이 기본이다.

`scripts/verify-safe-branch-cleanup.py`는 위 fail-closed 조건과 workflow 정책을 CI quality job에서 검증한다. `.yml`/`.yaml`, `git push -d/--delete`, empty-source refspec(`:branch`, `+:branch`), REST DELETE, YAML folded `run` 우회까지 검사한다.

Issue #87의 고정 cleanup workflow와 전용 verifier는 이 공통 기준의 선행 사례였으며 Issue #124에서 퇴역했다. 당시 실행 증거와 설계 이력은 [ISSUE_87_COMPLETION](ISSUE_87_COMPLETION.md)에 보존한다.

## Issue #76 정식 릴리스 완료 자동화

`issue-76-release-helper.yml`은 Issue #76 정식 릴리스 완료에 사용한 일회성 workflow이며 Issue #124에서 퇴역했다. 아래 내용은 당시 완료 증거와 안전 조건의 역사적 기록이다.

- Trigger: `main` push 중 이 helper 파일이 변경된 경우에만 실행한다. PR/feature branch에서는 실행하지 않는다.
- 권한: `contents: write`, `actions: write`, `issues: write`, `pull-requests: read`만 사용한다.
- 선행 gate: 대상 `main` SHA의 CI가 완료되고 성공해야 하며, 해당 CI에 포함된 임시 `ci-<full SHA>` GHCR 게시·exact digest smoke·임시 package version 정리가 성공해야 한다.
- Release: `package.json`의 `0.21.0`과 annotated `v0.21.0` tag가 정확히 일치해야 한다. helper가 만든 tag는 `release-image.yml`을 해당 tag ref로 dispatch하고, **같은 tag/head SHA이면서 dispatch 시각 이후 생성된 run**만 이번 실행의 증거로 인정한다.
- 복구: tag가 이미 존재할 때는 같은 target SHA의 `release-image.yml` 성공 run이 확인된 경우에만 게시 단계를 반복하지 않고 branch cleanup/Issue 종료를 재개한다. tag만 있고 성공 release 증거가 없으면 실패한 버전을 재사용하지 않고 FAIL 처리한다.
- Cleanup: Issue #76의 고정 작업 브랜치만 대상으로 보호 여부·열린 PR 참조·tip SHA를 재확인하고 SHA lease를 사용해 삭제한다. branch 조회는 HTTP 404만 '이미 없음'으로 처리하고 인증/rate-limit/5xx 등 다른 API 오류는 FAIL한다.
- 완료 계약: release run 성공, branch cleanup 결과와 main CI URL을 Issue #76 댓글에 기록한 뒤에만 Issue를 `completed`로 닫는다. 어느 단계든 실패하면 Issue를 열린 상태로 유지한다.

이 helper는 Issue #76 완료 증거를 보존한 뒤 별도 검토된 운영 변경에서 퇴역한다. 정식 릴리스 승인 경계는 [ISSUE_LIFECYCLE](ISSUE_LIFECYCLE.md)을 따른다.



## Issue #96 정식 릴리스 완료 자동화

`issue-96-release-helper.yml`은 Issue #96의 v0.21.1 GHCR 정식 게시와 Lifecycle 종료에 사용한 일회성 workflow이며 Issue #124에서 퇴역했다. 아래 내용은 당시 완료 증거와 안전 조건의 역사적 기록이다.

- Trigger는 helper 파일이 포함된 `main` push로 한정하며 PR에서는 registry write를 수행하지 않는다.
- 대상 merge SHA의 `ci.yml` push run이 **completed/success**가 될 때까지 polling하고, 명시적 success flag가 없으면 tag 생성이나 release 단계로 진행하지 않는다. 따라서 main 임시 `ci-<SHA>` 게시·exact digest smoke·package cleanup을 포함한 main gate가 선행된다.
- `v0.21.1`은 package version과 대상 SHA가 일치하는 annotated tag여야 한다. 새 tag일 때만 `release-image.yml`을 해당 tag ref로 dispatch하고, 같은 tag/head SHA 및 dispatch 이후 생성된 run의 completed/success만 인정한다.
- 재실행 시 tag가 이미 있으면 같은 tag/head SHA의 기존 성공 release run을 확인하고 게시를 반복하지 않은 채 cleanup/Issue 종료를 재개한다. tag만 있고 성공 release 증거가 없으면 FAIL한다.
- 작업 branch 삭제 전 열린 PR 참조 부재, 현재 tip SHA, tip이 merge target SHA의 ancestor인지, 삭제 직전 ref SHA 불변을 재검증한 뒤 explicit SHA lease로 삭제한다.
- PR #98은 squash/rebase가 아닌 **merge commit 방식**으로 병합한다. cleanup 전에 target SHA가 2개 이상의 parent를 가진 merge commit인지와 `TARGET_SHA^2 == 작업 branch tip SHA`를 검증해 이 전제를 원격 증거로 고정한다.
- 완료 댓글에는 version, main CI URL, 정식 release run URL, tag와 branch cleanup 결과를 남긴 뒤에만 Issue #96을 completed로 닫는다. 중간 실패 시 tag/image overwrite나 gate 우회 없이 Issue를 열린 상태로 유지한다.

이 workflow는 Issue #96 완료 증거 보존 후 별도 검토된 운영 변경에서 퇴역하며, 일반 릴리스 승인으로 확대하지 않는다.


## Issue #84 정식 릴리스 완료 자동화

`issue-84-release-helper.yml`은 Issue #84의 v0.25.0 정식 GHCR 게시와 Lifecycle 종료에 사용한 일회성 workflow이며 Issue #124에서 퇴역했다. 아래 내용은 당시 완료 증거와 안전 조건의 역사적 기록이다.

- Trigger: helper 파일이 포함된 `main` push에서만 실행하며 PR/feature branch에서는 release write를 수행하지 않는다.
- 권한: `contents: write`, `actions: write`, `issues: write`, `pull-requests: read`로 한정한다.
- 선행 Gate: 먼저 기능 PR #114의 **exact final head**에 대한 `ci.yml` pull_request run이 `completed/success`인지, 동일 exact head의 공식 `chatgpt-codex-connector` review node 또는 공식 `chatgpt-codex-connector[bot]`의 `codex-pull-request-review-summary` Completed 증거가 존재하는지, unresolved review thread가 0건인지 확인한다. GitHub Actions REST의 `pull_requests` 배열은 same-repository PR run에서도 비어 있거나 이후 PR 연계 상태에 따라 달라질 수 있으므로 필수 증거로 사용하지 않는다. 대신 PR API에서 exact head SHA·head branch·head repository·base를 확인하고, 같은 source tuple을 가진 PR이 해당 대상 PR 하나뿐임을 검증한다. CI run은 `event=pull_request`인 `ci.yml` 결과 중 exact head SHA + head branch + head repository + repository가 모두 일치하는 latest run을 사용한다. 이어 #114 merge SHA의 main push CI가 `completed/success`인지 확인하여 quality/E2E/Docker와 임시 `ci-<SHA>` GHCR exact-digest smoke 및 package cleanup까지 성공했음을 고정한다. 그 다음 helper는 `TARGET_SHA`를 만든 release-finalization PR을 merge commit 기준으로 식별하고 동일한 exact-head PR CI/공식 Codex identity exact-match review 증거/unresolved-thread Gate를 확인한다. 마지막으로 `TARGET_SHA`의 main push CI도 `completed/success`여야 정식 tag/release로 진행한다.
- Release: package version `0.25.0`과 annotated `v0.25.0`이 정확히 일치하고 tag가 `TARGET_SHA`를 가리켜야 한다. 새 tag를 만든 실행만 `release-image.yml`을 해당 tag ref로 dispatch할 수 있다.
- 실패·재실행 계약: `v0.25.0`이 실행 시작 전에 이미 존재하면 동일 tag/head SHA의 **기존 completed/success release run**이 있을 때만 게시 단계를 재사용한다. 기존 tag만 있고 성공 release 증거가 없으면 실패한 version/tag를 재사용하거나 재게시하지 않고 FAIL한다.
- Branch cleanup: 원격 tip SHA가 merged PR의 recorded head SHA와 일치하고, 해당 merged PR의 merge commit이 `TARGET_SHA`의 ancestor이며, head/base로 열린 PR이 없음을 확인한 뒤 explicit `--force-with-lease=<ref>:<tip SHA>`로 삭제한다. 원격 tip이 merge 이후 변경되면 삭제하지 않는다.
- 완료 증거: 기능 PR #114, 릴리스 마무리 PR, version, feature merge SHA, release target SHA, main CI URL, 정식 release run URL, tag, branch cleanup 결과를 Issue #84에 기록한 뒤에만 `completed`로 닫는다.

이 helper는 Issue #84 완료 증거를 보존하기 위한 한정 자동화이며 일반 release authority나 범용 branch 삭제 권한으로 확대하지 않는다.


## Issue #99 정식 릴리스 완료 자동화 (퇴역)

`.github/workflows/issue-99-release-helper.yml`은 Issue #99의 **v0.26.0 정식 GHCR 게시와 Issue Lifecycle 종료**에 사용한 일회성 운영 workflow이며 Issue #167에서 퇴역했다. 아래 내용은 당시 실행 계약과 완료 증거를 보존하기 위한 역사적 기록이다.

- Trigger는 helper 파일이 포함된 `main` push로 한정하며 PR/feature branch에서는 registry write를 수행하지 않는다.
- 기능 PR #127과 release-validation PR #133은 merge commit 방식으로 병합한다. helper는 #127 merge SHA가 최종 release target의 ancestor인지 확인하고, 최종 target 자체는 #133의 merge commit이며 두 번째 parent가 #133 head와 정확히 일치하는지 검증한다.
- 대상 main SHA의 `ci.yml` push run이 `completed/success`가 된 뒤에만 annotated `v0.26.0` tag를 생성하고 `release-image.yml`을 해당 tag ref로 dispatch한다.
- 동일 tag/head의 기존 성공 release run이 있으면 재사용하며, tag만 있고 성공 release 증거가 없으면 gate를 우회하지 않는다.
- 정식 release 성공 후에만 PR #127의 기능 branch와 PR #133의 release-validation branch를 각각 `scripts/safe_branch_cleanup.py`로 검증·삭제한다. 이전 재통합 branch는 merged-PR-head 조건을 충족하지 않으므로 공통 안전 도구를 우회해 자동 삭제하지 않는다.
- 완료 댓글에는 기능 PR #127, release-validation PR #133, version, release target SHA, main CI, 정식 release run, tag, 두 merged branch cleanup 결과를 기록하고 마지막 단계에서만 Issue #99를 `completed`로 닫는다.

이 helper는 더 이상 존재하거나 실행되지 않으며, 신규 lifecycle 작업은 공통 `ci.yml`, `release-image.yml`, `scripts/safe_branch_cleanup.py`와 현재 Issue Lifecycle 절차를 사용한다.


## Issue #118 Lifecycle 완료 자동화

`.github/workflows/issue-118-release-helper.yml`은 Issue #118의 기능 PR #146 병합 이후 main 검증과 안전한 branch cleanup, 최종 Issue 종료를 직렬화하는 한정 helper다.

- 기능 기준은 PR #146 최종 head `80159c5a5e6a2bfacf8b0c4fad03675801a79ef0`, merge SHA `6386db860af69635cfb0fe626fd1a937905b9a56`, application version `0.27.4`다.
- helper는 자신이 포함된 main commit의 `ci.yml` push run이 `completed/success`가 될 때까지 기다린다. 이 성공에는 quality/E2E/Docker와 main 임시 `ci-<SHA>` GHCR 게시·exact digest smoke·cleanup이 포함된다.
- 기능 branch `fix/issue-118-project-context-toolbar`와 helper finalization branch는 `scripts/safe_branch_cleanup.py`의 merged PR/head SHA/ancestor/open-PR/lease 조건을 모두 통과한 경우에만 삭제한다.
- 기능 PR의 resolved Codex P1, 문서 동기화(`PROJECT_UX`, `TEST_PLAN`, `CHANGELOG`)와 main 검증 증거를 FINAL 댓글에 기록한 뒤 Issue #118을 `completed`로 닫는다.
- 정식 SemVer/GHCR release는 별도 명시적 승인 없이 자동 생성하지 않는다. 이 helper는 main 임시 commit image 검증까지만 완료하며 정식 release authority를 확대하지 않는다.


## Issue #118 구현 전후 레이아웃 증거 Workflow

`.github/workflows/issue-118-before-after-evidence.yml`은 #118 Acceptance Criteria의 동일 조건 구현 전/후 증거를 생성하는 검증 전용 Workflow다.

- Trigger: 해당 Workflow, 측정/비교 script 또는 관련 검증 문서가 변경된 PR과 수동 `workflow_dispatch`.
- 비교 revision은 Before `703a6f08595dea06a918366192df464d7215108e`, After `6386db860af69635cfb0fe626fd1a937905b9a56`(#118 기능 병합 SHA)로 고정한다.
- 두 revision에 PR head의 **동일 측정 harness**를 적용하고 390/768/1024/1440px 모두 높이 844px, editing/readonly 동일 mock fixture로 실행한다.
- PASS 기준: 390px 및 768px의 editing/readonly에서 After의 viewport 내 Gantt 가시 높이가 Before보다 증가하고, 모든 After 조건에서 document horizontal overflow가 없으며 정보 컨트롤이 한 줄을 유지해야 한다.
- 증거: raw geometry JSON, comparison JSON, Markdown 요약, 동일 조건 before/after screenshot을 `issue-118-before-after-evidence` artifact로 90일 보관한다.
- 이 Workflow는 제품 CI `quality/e2e/docker`, main 임시 GHCR 검증, 실제 모바일/스크린리더 검증을 대체하지 않는다. #118/122 종료에는 최신 PR head의 일반 CI와 이 evidence Workflow 결과를 각각 확인한다.
