# W20 CI/CD and Semantic Container Release Review

검증일: 2026-09-12

상태: **로컬 구현·독립 QA PASS / Manager ACCEPT**. 이 문서의 원격 차단 평가는 W20 완료 당시 기준이다. 2026-09-12 D04 정책과 credential 재사용 위험 수용 뒤 W22에서 repository admin 인증은 성공했지만, GitHub-hosted Actions와 GHCR publish/digest pull 자체는 여전히 **NOT TESTED**이며 private ruleset/attestation은 D05에서 별도 **BLOCKED**다.

## Summary

W20은 W07까지 사람이 반복 실행하던 application·browser·container 검증을 GitHub Actions workflow로 옮기고, `package.json`을 Source of Truth로 하는 strict Semantic Version release 계약을 추가했다. Release는 package/lock version과 정확히 일치하는 annotated `v<version>` tag에서만 진행한다. 원격 쓰기 전에 같은 source·version·platform 설정의 local candidate를 runtime 검증하고, 통과한 경우에만 `linux/amd64` image를 GHCR에 게시한 뒤 registry digest를 다시 pull하여 실행하는 구조다.

W20이 선행한 container/readiness 기반은 W16의 실제 production host, reverse proxy/TLS, backup/restore와 rollback 승인을 완료한 것으로 간주하지 않는다.

## Requirement Coverage

| ID | 로컬 판정 | 원격 판정 | 근거 |
| --- | --- | --- | --- |
| CI01 | PASS | NOT TESTED | frozen install, version, typecheck, lint, Vitest, audit, link, build workflow와 로컬 동등 명령 |
| CI02 | PASS | NOT TESTED | Chromium E2E 8/8, worker 1, 실패 report upload 정의 |
| CI03 | PASS | NOT TESTED | `linux/amd64` clean image, UID/GID 1001, migration/readiness/native SQLite |
| CI04 | PASS | NOT TESTED | 격리 named volume write→container restart→readback; image content policy |
| CI05 | PASS | NOT TESTED | strict SemVer/package-lock/tag 및 monotonic precedence validator 6개 회귀 테스트, annotated tag object gate |
| CI06 | PASS STATIC | NOT TESTED | PR `contents: read`, publish job 최소 권한, full Action SHA/base digest pin |
| CI07 | PASS STATIC | NOT TESTED | repository-global 직렬화, monotonic tag gate, stable/prerelease 분기, OCI label, SBOM/provenance/attestation 정의 |
| CI08 | PASS STATIC | BLOCKED | local candidate→commit candidate→digest smoke·attest→rolling/exact promotion; 실제 GHCR 실행은 tag push 필요 |

## Test Results

- `npm ci`: PASS
- `npm run version:check`: PASS — `v0.2.0 (stable)`
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm test`: PASS — 24 files / 309 tests
- `npm run build`: PASS — `/api/health/ready` Node route 포함
- `npm run test:e2e`: PASS — clean isolated Chromium 8/8
- `npm audit --omit=dev`: PASS — production vulnerability 0
- Markdown local-link check: PASS after this review is present
- `actionlint` 1.7.12: PASS
- `docker compose config --quiet`: PASS
- Local Docker image build/policy: PASS — `linux/amd64`, configured user `mastergantt`, secret/DB/test artifact 제외
- Runtime smoke: PASS — missing/insecure production URL exit 1, migration, readiness, `better-sqlite3` write, container restart readback
- `git diff --check`: PASS

초기 smoke에서 기본 host port 3000이 범위 밖의 기존 container와 충돌했으나 격리 port를 사용해 재실행했고 product/container 결함 없이 PASS했다. W20이 만든 container와 volume은 검증 후 제거했으며 사용자 DB는 사용하거나 변경하지 않았다.

## Security Findings

- PR/main workflow에는 registry login·write permission·PAT가 없고 checkout credential persistence도 비활성화했다.
- GHCR publish job만 `packages: write`, `attestations: write`, `id-token: write`를 갖는다.
- 모든 GitHub/Docker Action은 reviewed full commit SHA, Node base image는 digest로 고정했다.
- Release tag와 image tag를 shell에 넣기 전 strict validator를 통과시키며, direct Action expression은 환경변수 경계로 전달한다.
- 기존 exact version 또는 immutable commit image가 있으면 overwrite하지 않고 실패한다.
- Release는 repository 단위 직렬화되고 tag history보다 큰 SemVer만 허용한다. Registry에는 commit candidate만 먼저 쓰며 digest smoke와, 활성화된 경우 GitHub Attestation 뒤 rolling alias와 exact version을 승격한다. Attestation의 private plan 조건은 W22/ADR51에서 후속 명확화했다.
- `.dockerignore`와 runtime image policy가 `.env*`, Git metadata, SQLite/WAL/SHM, tests와 local output 포함을 거부한다.
- Readiness는 DB를 생성·migrate하지 않고 기존 파일을 readonly로 열어 SQLite, foreign keys와 required migration name/checksum만 검사하며 오류 세부를 숨긴 503을 반환한다.

## Regression Findings

전체 309 Vitest와 Chromium 8/8이 W01–W07의 Project 생성, direct readonly, edit authorization, scheduling, Task persistence와 Gantt interaction 회귀 없이 통과했다. Readiness, runtime configuration과 version validator 회귀가 추가됐다.

## Documentation Findings

요구사항, architecture, security, deployment, API, test plan, decisions, active plan, issue breakdown, README, changelog와 Agent 상시 규칙을 같은 변경에서 갱신했다. 향후 CI/version/registry 변경은 workflow/script/test와 `CI_CD.md`, `TEST_PLAN.md`, 필요 시 README/changelog를 함께 갱신해야 한다.

## Independent QA

`qa_docs`는 초기 검토에서 lightweight tag 허용, publish 전 release runtime gate 부재, SemVer 역행과 stable alias 경쟁, 잘못된 production URL의 readiness 200, 미존재 review link를 발견했다. Manager가 annotated tag object, pre-publish candidate, repository-global 직렬화와 monotonic version, commit candidate digest promotion, startup/readiness config gate 및 문서 동기화로 수정했다.

수정 뒤 QA가 typecheck, lint, 24 files/309 Vitest, production build, Chromium 8/8, actionlint, Compose, Markdown 30 files, audit 0, Docker image policy, invalid URL exit 1과 named-volume restart persistence를 독립 재실행했다. 열린 로컬 blocking failure 없이 **PASS / Manager ACCEPT 권고**했다.

## Remaining Risks

- 실제 GitHub-hosted runner의 Action run과 effective `GITHUB_TOKEN` 권한은 아직 검증하지 않았다.
- GHCR package visibility/repository linkage, exact/rolling tag와 attestation/SBOM, digest pull smoke 증거가 없다.
- 초기 target은 `linux/amd64`만 지원한다. `linux/arm64`는 native module build/runtime 재검증 전 지원하지 않는다.
- Production host bind-mount 권한, reverse proxy/TLS, backup/restore/rollback은 W16 범위다.
- 과거 노출된 repository credential 재사용은 사용자 수용 잔여 위험이다. W20 당시 usable 인증이 없어 원격 push를 수행하지 못했으며, W22에서 admin 인증 성공을 확인했다. 이는 실제 workflow/GHCR artifact PASS를 뜻하지 않는다.

## Recommendation

로컬 W20 구현은 독립 QA PASS를 근거로 Manager ACCEPT한다. 후속 W22에서 admin 인증은 성공했으나 현재 plan은 private ruleset을 지원하지 않는다. 원격 요구는 D05를 결정하고, main commit과 최신 annotated release를 각각 승인된 절차로 실행해 Actions URL·image digest·registry smoke 증거를 추가해야 PASS다. GitHub Attestation은 Enterprise Cloud와 명시적 opt-in이 있을 때만 요구하며 BuildKit SBOM/provenance와 구분한다.
