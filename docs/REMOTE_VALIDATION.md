# GitHub-first 테스트 및 검증 정책

> **Issue #8 전송 정책:** production 기본값은 HTTPS다. `ALLOW_INSECURE_HTTP=true`와 canonical HTTP `APP_BASE_URL`을 함께 설정한 내부망은 production HTTP도 지원한다. 시작·readiness·공유 URL·모든 인증 경로는 같은 정책을 사용한다. `SESSION_COOKIE_SECURE`는 미사용 예약값이며 제거했다. HTTP에서는 `mastergantt_edit`, HTTPS production에서는 `__Host-mastergantt_edit; Secure`를 사용하고 HttpOnly·SameSite=Strict·Path=/·TTL 및 Domain 미설정을 유지한다. 아래 과거 검증 이력의 HTTPS-only 표현은 당시 기준이다. 현재 운영·전환 절차는 [HTTP_OPERATION](HTTP_OPERATION.md)을 따른다.


관련 Issue: #5

## Issue #120 원격 검증

동일 PR head에서 quality/e2e/docker를 모두 확인한다. E2E는 semantic token의 실제 computed color 대비, visible focus, 390/768/1024/1440 대표 폭과 기존 Task Editor/Row Menu interaction 회귀를 포함한다. main 병합 뒤에는 해당 merge SHA의 main CI와 임시 GHCR exact digest smoke/cleanup을 확인한다. 정식 0.27.0 release는 `release_required=true`이며 별도의 명시적 `release_authorized=true` 근거가 있을 때만 annotated tag와 release-image workflow를 실행한다.

## 목적

코드 변경의 공식 검증 증거를 개발자 로컬 환경이 아니라 GitHub Actions에 우선 둔다. 로컬 실행은 빠른 피드백과 재현에 사용하고, PR merge 가능 여부와 `main` artifact의 유효성은 원격 workflow 결과로 판단한다.

## 1. 검증 계층

| 단계 | 실행 위치 | 기본 범위 | 판정 용도 |
| --- | --- | --- | --- |
| Local Fast Feedback | 개발 환경 | 변경과 직접 관련된 Vitest, 필요 시 typecheck/lint, 재현용 명령 | 구현 중 빠른 피드백. 공식 전체 회귀 PASS를 의미하지 않음 |
| PR Required Validation | GitHub Actions | version check, typecheck, lint, 전체 Vitest, dependency audit, markdown link, production build, Chromium Playwright E2E, Docker build/runtime/SQLite persistence smoke | 코드 변경의 기본 공식 검증 |
| Main Artifact Validation | GitHub Actions + GHCR | 비문서 `main` push: PR 수준 gate + 임시 `ci-<full SHA>` publish + exact digest pull + readiness/API/auth/restart persistence + SBOM/provenance + 검증 후 package version 삭제. docs-only main push는 registry job SKIPPED | runtime/artifact에 영향이 있는 `main` commit registry 경로 검증 |
| Semantic Release Validation | GitHub Actions + GHCR | release workflow의 version/tag gate, candidate runtime, digest smoke, promotion | 배포 가능한 version artifact 검증 |
| Environment-specific Validation | 실제 대상 환경 | Windows Excel/VBA/DRM, reverse proxy/TLS, off-host backup/restore, 최종 수동 UX 등 | GitHub-hosted runner로 대체할 수 없는 항목 |

## 2. 기본 개발 흐름

1. Issue 또는 승인된 작업 범위를 확인한다.
2. `main`에서 작업 branch/worktree를 만든다.
3. 구현 중에는 변경과 직접 관련된 최소 로컬 테스트만 반복한다. 실패 재현을 위해 필요한 경우 범위를 확대한다.
4. 변경을 원격 branch에 push하고 Pull Request를 생성한다.
5. PR의 `.github/workflows/ci.yml` 결과를 공식 검증으로 사용한다. `quality`, `e2e`, `docker`가 모두 성공하기 전에는 Manager가 기능을 최종 ACCEPT하지 않는다.
6. 실패하면 GitHub run → job → step → 최초 오류를 근거로 원인을 분석한다. 로컬에서만 다시 PASS한 것은 원격 실패 해결 증거가 아니다.
7. PR이 merge되어 `main`에 반영되면 동일 `quality`/`e2e`/`docker` gate를 수행한다. 변경이 `docs/**` 또는 저장소 루트 Markdown만 포함하는 docs-only이면 `publish-commit-image`는 SKIPPED여야 하고, 비문서 파일이 하나라도 있거나 판정이 불가능하면 기존 registry gate가 실행되어야 한다.
8. `main` 완료 보고에는 대상 commit SHA와 CI 결과를 기록한다. 비문서 main push는 임시 GHCR `ci-<full SHA>` exact digest 검증 및 package 삭제 결과를 기록하고, docs-only main push는 변경 유형 판정 결과와 `publish-commit-image=SKIPPED/N/A`를 기록한다.
9. Release는 별도 Semantic Version workflow와 승인 절차를 따른다.

## 3. 로컬에서 기본적으로 반복하지 않는 항목

다음 항목은 GitHub-hosted runner에서 재현 가능한 한 매 코드 변경마다 로컬 전체 실행을 완료 조건으로 요구하지 않는다.

- 전체 Vitest suite
- 전체 Chromium Playwright E2E
- clean production Docker build
- container migration/readiness smoke
- native `better-sqlite3` write/restart persistence smoke
- production dependency audit
- GHCR publish/pull/digest smoke
- SBOM/provenance 생성 검증

단, 해당 영역 자체를 수정하거나 CI 실패를 재현하는 경우 담당 Agent가 로컬에서 선택적으로 실행할 수 있다. 로컬 검증은 GitHub Actions 검증을 대체하지 않는다.

## 4. GitHub Actions 책임

현재 `.github/workflows/ci.yml`을 다음 책임의 Source of Truth로 사용한다.

### Pull Request

- `contents: read` 기본 권한
- frozen `npm ci`
- release/version manifest 검사
- TypeScript typecheck
- ESLint
- Vitest
- production dependency audit
- Markdown link 검사
- Next.js production build
- Chromium Playwright E2E
- Docker image build와 content policy
- invalid production configuration fail-closed
- migration/readiness
- native SQLite access와 container restart persistence
- relocated Compose config/startup/recreate persistence
- `RESOURCE_CATALOG_ADMIN_PASSWORD` 누락 config fail-fast와 app 컨테이너 환경 전달
- 실제 Resource Catalog 관리자 인증 성공/거부 및 인증 요청 직후/재생성 후 로그의 비밀번호 원문 비노출
- 실패 시 Playwright report artifact

PR에서는 GHCR login/publish 또는 registry write를 수행하지 않는다.

### main push

PR과 동일한 `quality`/`e2e`/`docker` gate를 다시 수행한다. 별도 `classify_main_change` job은 push의 `before..head` 변경 파일을 판정하며, 모든 파일이 `docs/**` 또는 저장소 루트 Markdown이면 docs-only로 본다. 빈 diff, 기준 SHA 판정 불가, 비문서 파일 혼합은 fail-safe로 docs-only가 아니다.

비문서 main push에서만 다음 registry gate를 수행한다. docs-only main push에서는 `publish-commit-image` job 자체가 SKIPPED이며 `packages: write` job을 시작하지 않는다.

- 임시 `ci-<full SHA>` image를 GHCR에 게시
- 기존 동일 commit tag overwrite 거부
- BuildKit SBOM/provenance 생성
- build output의 exact digest를 다시 pull
- image policy/readiness 검증
- native SQLite restart persistence 검증
- Project/Task API persistence 및 authorization denial 검증
- 검증 완료 후 `ci-<full SHA>` package version 삭제

`main`의 로컬 PASS만으로 GHCR artifact를 정상으로 판정하지 않는다.

## 5. Agent 책임

- `frontend`, `backend`, `scheduler`, `excel_vba`: 구현 중 관련 로컬 fast feedback을 수행하고 원격 branch/PR 검증 대상으로 변경을 전달한다.
- `infra`: GitHub Actions run, workflow, runner, permission, cache, Docker/GHCR 문제를 담당한다. CI 실패 시 run/job/step 근거를 확보한다.
- `qa_docs`: 로컬 결과와 GitHub 원격 결과를 구분하여 독립 검토한다. 원격 CI 미실행은 `NOT TESTED`, 실행 불가/권한 문제는 `BLOCKED`로 기록한다.
- `Manager`: PR 원격 gate 결과와 필요한 환경별 검증을 확인한 뒤 ACCEPT/REWORK/REJECT/DEFER를 결정한다.

## 6. 완료 보고 최소 증거

코드 변경 완료 보고에는 가능한 경우 다음을 포함한다.

```text
Issue / PR:
Head commit SHA:
Local Fast Feedback: PASS | FAIL | NOT TESTED
GitHub quality: PASS | FAIL | BLOCKED | NOT TESTED
GitHub E2E: PASS | FAIL | BLOCKED | NOT TESTED
GitHub Docker smoke: PASS | FAIL | BLOCKED | NOT TESTED
Main GHCR digest smoke: PASS | FAIL | BLOCKED | NOT TESTED | N/A
Environment-specific validation: PASS | FAIL | BLOCKED | NOT TESTED | N/A
Remaining risks:
```

GitHub Actions run이 아직 끝나지 않았으면 완료로 과대 표시하지 않는다.

## 7. 예외

GitHub-hosted runner가 접근할 수 없는 사내 시스템, Windows Excel/DRM, 실제 reverse proxy/TLS, 운영 storage/backup/restore, 사람이 판단해야 하는 UX는 로컬/대상 환경 검증으로 남긴다. 이러한 항목을 GitHub Actions에서 성공한 일반 테스트로 대체했다고 주장하지 않는다.

현재 repository에서 branch/ruleset 강제가 지원되지 않거나 활성화되지 않은 경우에도 위 workflow를 운영 규칙으로 적용한다. 보호 설정이 실제로 적용됐다고 가정하지 않는다.

## Repository layout relocation (#12)

현재 배포 경로와 기존 Compose 프로젝트/volume을 유지하는 전환 절차는 [REPOSITORY_STRUCTURE](REPOSITORY_STRUCTURE.md)를 따른다. Docker gate의 `scripts/verify-compose-smoke.sh`는 새 Compose 경로의 config/startup/readiness/restart/강제 recreate SQLite 보존과 함께 `RESOURCE_CATALOG_ADMIN_PASSWORD` 필수 전달 계약을 검증한다. 비밀번호 누락은 container 생성 전 config 단계에서 실패해야 하고, 설정된 값은 app 환경으로 전달되어 실제 관리자 인증의 정상 201/오류 401 동작을 만들어야 한다. 인증 요청 직후의 기존 container 로그와 강제 재생성 이후 로그 양쪽에서 정상/오류 입력 비밀번호 원문이 없어야 한다. 기존 quality/E2E/runtime/registry 권한·검증 gate는 유지하며, 결과는 해당 PR/run/head의 실제 증거로 판정한다.

## Test configuration relocation (#13)

설정은 `tests/config/vitest.config.ts`, `tests/config/playwright.config.ts`에 있다. `npm test`, `npm run test:e2e`는 그대로 사용한다. 직접 실행은 `npx vitest run --config tests/config/vitest.config.ts`, `npx playwright test --config tests/config/playwright.config.ts`로 지정한다. 설정 파일 기준 root/testDir/webServer.cwd를 사용하고 E2E DB `.data/playwright.sqlite3`, `.next-e2e`, `test-results/`는 루트 기준으로 유지한다. CI는 `node scripts/verify-test-discovery.mjs`로 루트/외부 cwd의 동일한 테스트 발견을 확인한 뒤 전체 테스트를 실행한다. 편집기에서 자동 발견되지 않으면 같은 설정 경로를 지정한다. 실제 Windows 편집기 UI 검증은 미실행이며 [배치 문서](REPOSITORY_STRUCTURE.md)를 함께 따른다.

## Issue #87 브랜치 정리 검증과 종료 Gate

Issue #87에서 사용한 고정 cleanup workflow는 Issue #124에서 퇴역했다. 현재 branch cleanup 검증/삭제 계약은 [공통 안전 cleanup 도구](../scripts/safe_branch_cleanup.py)와 [CI_CD.md](CI_CD.md) 9절을 따른다. 아래 표는 당시 PR #88 운영 정리 증거의 역사적 기록이다.

| 계층 | 실행과 필수 증거 |
| --- | --- |
| Local Fast Feedback | `python3 scripts/verify-issue-87-cleanup.py`; 실제 workflow inline 코드를 추출하여 모형 및 로컬 bare Git 검증 |
| PR cleanup validation | 해당 workflow/script 변경 PR에서 `Issue 87 브랜치 정리 안전 조건 검증` job PASS; contents:read, credential 미보존. 기존 quality/e2e/docker도 별도 모두 PASS |
| 실제 post-main cleanup | main push CI의 실제 merge SHA/attempt와 quality/e2e/docker/main GHCR 네 job success 확인 후 고정 branch의 SHA 조건부 삭제, 실제 ref 404와 run summary |

회귀 스크립트는 24개 API 모형 시나리오와 3개 실제 로컬 Git 시나리오를 포함한다. 정상·이미 없음·무관 run, CI/GHCR 미완료/실패/skipped, 저장소/event/path/attempt/SHA 불일치, squash/잘못된 merge parent, 보호/새 commit/다른 열린 PR 참조를 검증한다. Git 검증은 정상 삭제, 전송 전 stale tip, 서버 광고 이후 pre-receive 경합에서 새 tip 보존을 확인한다. 이 테스트와 토큰 인자/trace 비노출 확인은 실제 GitHub 삭제 PASS를 대신하지 않는다.

Manager는 PR #88에 `merge_method=merge`와 최종 expected_head_sha를 사용한다. squash/rebase는 지원하지 않으므로 임의로 ancestry gate를 제거하지 않는다. cleanup의 단일 삭제 refspec은 명시적 SHA lease를 사용하며 별도 GET 뒤 REST 무조건 DELETE로 fallback하지 않는다. 권한 부족·lease 실패·새 commit·누락 gate는 FAIL/BLOCKED로 남기고 강제 삭제하지 않는다.

infra는 main run/merge SHA, GHCR digest·smoke·package 정리, cleanup run과 최종 ref 404를 기록한다. 독립 검토가 이를 확인한 뒤 Manager가 종료를 판단한다. 다른 main run은 no-op이며 이미 없는 branch는 재삭제하지 않는다. 대상 이름을 재사용하지 않고 workflow 퇴역은 증거 보존 후 별도 검토된 운영 변경으로만 수행한다. 이번 완료 기준은 이 한정 절차를 일반 브랜치 자동 삭제나 제품 릴리스 승인으로 확대하지 않는다.

## Issue #76 원격 릴리스 검증

Issue #76의 제품 변경은 PR의 `quality/e2e/docker` PASS만으로 완료하지 않는다. 사용자 요청으로 정식 GHCR 게시가 승인된 범위이므로 아래 원격 증거를 모두 확인한다.

1. 최종 PR head SHA에서 `quality`, Chromium E2E, Docker smoke가 모두 PASS인지 확인한다.
2. PR 병합 후 실제 `main` merge SHA의 CI가 PASS인지 확인한다. `publish-commit-image`가 게시한 임시 `ci-<full SHA>` image의 exact digest pull/smoke와 package version 정리 결과를 같은 run에서 확인한다.
3. `v0.21.0` annotated tag가 실제 merge SHA를 가리키는지 확인한다.
4. `release-image.yml`은 `v0.21.0` ref로 실행하며, helper가 기록한 dispatch 시각 이후 생성되고 `head_branch=v0.21.0`, `head_sha=<merge SHA>`인 성공 run만 이번 정식 릴리스 PASS로 인정한다.
5. helper 재실행 시 tag가 이미 존재하면 동일 target의 성공 release run을 확인한 경우에만 release 단계를 skip하고 cleanup/Issue 종료를 재개할 수 있다. 성공 증거가 없는 기존 tag는 FAIL이다.
6. branch cleanup은 HTTP 404인 branch만 이미 없는 것으로 간주한다. API 401/403/429/5xx, 보호 branch, 열린 PR 참조, tip 변경, SHA lease 실패는 FAIL/BLOCKED이며 Issue를 닫지 않는다.
7. Issue #76 종료 댓글에는 버전, main CI URL, 정식 release run URL, 삭제/보존 branch를 기록한다.

Workflow 파일의 존재나 과거 성공 run은 현재 head의 PASS를 대신하지 않는다. release/tag/GHCR/branch cleanup/Issue 종료는 각 단계의 실제 GitHub 원격 증거로 판정한다.



## Issue #96 원격 릴리스 검증

Issue #96은 Task Editor UI 변경과 함께 사용자가 GHCR 정식 게시를 명시적으로 승인했으므로 아래 증거가 모두 확인되어야 완료다.

1. 최종 PR head에서 quality, Chromium E2E, Docker smoke가 모두 PASS이고 독립 Codex review의 unresolved finding이 없어야 한다.
2. merge 후 실제 `main` merge SHA의 CI가 completed/success여야 하며, 같은 run의 `publish-commit-image`가 임시 `ci-<full SHA>` 게시, exact digest 재다운로드/runtime smoke, SBOM/provenance, 임시 package cleanup을 완료해야 한다.
3. package version `0.21.1`과 annotated `v0.21.1` tag가 정확히 일치하고 tag가 실제 merge SHA를 가리켜야 한다.
4. 새 tag에서 `release-image.yml`은 `v0.21.1` ref로 dispatch하며, helper의 dispatch 시각 이후 생성되고 `head_branch=v0.21.1`, `head_sha=<merge SHA>`, completed/success인 run만 정식 게시 PASS로 인정한다.
5. helper 재실행 시 기존 tag가 같은 target을 가리키고 동일 tag/head SHA의 성공 release run이 있는 경우에만 publish를 반복하지 않고 cleanup/Issue 종료를 재개한다.
6. PR #98은 **merge commit 방식**으로 병합해야 하며 squash/rebase merge는 허용하지 않는다. branch cleanup은 target SHA가 2개 이상의 parent를 가진 merge commit이고 `TARGET_SHA^2 == 작업 branch tip SHA`임을 확인한 뒤, 열린 PR 참조가 없고 현재 tip이 merge target의 ancestor이며 삭제 직전 SHA가 재검증된 경우에만 explicit SHA lease로 수행한다. 새 commit, lease 불일치, API 오류는 FAIL/BLOCKED다.
7. Issue #96 완료 댓글에 version, main CI/임시 GHCR 검증 URL, 정식 release run URL, tag, branch cleanup 결과를 기록한 뒤 completed로 닫는다.

Workflow 파일의 존재나 과거 run은 현재 target SHA의 PASS를 대신하지 않는다. GHCR 게시 성공은 운영 환경 배포 완료를 의미하지 않는다.


## Issue #84 원격 릴리스 검증

Issue #84는 PR #114에서 기능·테스트·Documentation Sync를 완료하고, 사용자가 GHCR 정식 게시까지 명시적으로 요청한 범위다. 완료 판정은 다음 원격 증거를 모두 요구한다.

1. helper는 기능 PR #114의 **exact final head SHA**에 대한 `ci.yml` pull_request run이 completed/success인지 확인하고, 동일 exact head를 검토한 공식 `chatgpt-codex-connector` review node 또는 공식 `chatgpt-codex-connector[bot]`의 `codex-pull-request-review-summary` Completed 증거가 존재하며 unresolved review thread가 0건인지 검증한다. PR CI run의 `pull_requests` 배열은 증거로 요구하지 않는다. 대신 PR API에서 exact head SHA·head branch·head repository·base를 확인하고, 동일 source tuple에 해당하는 PR이 대상 PR 하나뿐인지 확인한다. 그 후 `event=pull_request`의 `ci.yml` run에서 exact head SHA + head branch + head repository + repository를 모두 대조해 대상 PR의 CI 증거로 결속한다.
2. PR #114 merge 뒤 실제 feature merge SHA의 main push CI가 completed/success인지 별도로 확인한다. 이 run 성공은 quality/E2E/Docker뿐 아니라 임시 `ci-<full SHA>` 게시 → exact digest pull/runtime smoke → package version cleanup까지 성공했음을 의미해야 한다.
3. 릴리스 마무리 helper는 자기 `TARGET_SHA`를 만든 merged PR을 확인한 뒤, 해당 PR latest head의 exact SHA·head branch·head repository·base와 source PR uniqueness를 확인한 뒤, 동일 SHA/branch/repository tuple의 `ci.yml` pull_request run이 completed/success인지 검증한다. 또한 그 exact head에 대한 공식 Codex identity exact-match review node 또는 Completed review summary 증거가 존재하고 unresolved review thread가 0건이어야 한다. 직접 main push나 review/CI 우회 병합은 release Gate를 통과할 수 없다.
4. package version `0.25.0`과 annotated `v0.25.0` tag가 정확히 일치하고 tag가 release target main SHA를 가리켜야 한다.
5. 새 tag에서만 `release-image.yml`을 dispatch한다. 실행 시작 전에 tag가 이미 존재한다면 동일 tag/head SHA의 completed/success release run이 있는 경우에만 publish를 반복하지 않고 후속 cleanup/Issue 종료를 재개한다. **기존 tag만 있고 성공 release 증거가 없으면 FAIL**이며 동일 version/tag를 재사용하지 않는다.
6. 작업 branch와 release-finalization branch 삭제 전 현재 remote tip이 해당 merged PR의 recorded head SHA와 동일한지 확인하고, merge commit이 release target의 ancestor인지와 열린 head/base PR 부재를 확인한다. 마지막 삭제는 explicit SHA lease를 사용한다. 새 commit/race/API 오류가 있으면 삭제하지 않고 FAIL/BLOCKED로 남긴다.
7. 정식 release workflow의 exact SemVer image digest 재다운로드/runtime smoke와 stable alias promotion 결과를 실제 run/job 증거로 확인한다.
8. Issue #84 완료 댓글에 기능/릴리스 PR, version, main CI, 정식 release run, tag, branch cleanup 결과를 남긴 뒤 completed로 닫는다.

Workflow 파일 존재나 과거 다른 version의 성공 run은 현재 `v0.25.0` release 성공 증거를 대신하지 않는다. GitHub-hosted 검증은 최종 수동 UX/실제 사내 reverse proxy 등 환경별 검증을 자동으로 완료한 것으로 간주하지 않는다.


## Issue #118 구현 전후 원격 증거

#118의 동일 fixture 구현 전/후 높이·screenshot 증거는 PR의 `Issue #118 구현 전후 레이아웃 증거` Workflow로 판정한다.

1. 대상 PR head에서 일반 `CI`의 quality/e2e/docker가 completed/success여야 한다.
2. 같은 PR head에서 `Issue #118 구현 전후 레이아웃 증거` run이 completed/success여야 한다.
3. 비교 revision은 Before `703a6f08595dea06a918366192df464d7215108e`, After `6386db860af69635cfb0fe626fd1a937905b9a56`로 고정하며 두 revision에 동일 harness를 사용한다.
4. viewport는 390×844, 768×844, 1024×844, 1440×844이며 editing/readonly 모두 같은 mock Project/Task 데이터를 사용한다.
5. 390/768의 각 상태에서 Gantt 가시 높이 delta가 양수이고 After의 document horizontal overflow가 없으며 정보 컨트롤이 한 줄이어야 PASS다.
6. `issue-118-before-after-evidence` artifact에 raw metrics, comparison JSON, Markdown 요약, 각 viewport/state의 before/after screenshot이 존재하는지 확인한다.
7. 이 증거는 실제 모바일 기기·스크린리더 수동 검증을 완료한 것으로 해석하지 않는다.

## Issue Lifecycle 원격 검증 (#211)

`.github/workflows/issue-lifecycle.yml`의 `verify`는 비파괴 원격 integration 검증 수단이다. 다음을 같은 실행에서 확인한다: Issue/PR identity, same-repository `main` PR, `Refs #N`, PR final head required checks, merge SHA의 main ancestry, manifest/lock version, exact merge SHA의 main `ci.yml` run.

범용 workflow 자체가 main에 병합되기 전에는 실제 `workflow_dispatch verify` 증거를 만들 수 없으므로 PR 단계에서는 `scripts/verify-issue-lifecycle.py`의 contract/scenario test와 일반 PR quality/e2e/docker를 사용한다. 병합 후 대표 merged Issue/PR에 대해 non-destructive verify 실행을 별도 evidence로 확보한 다음 기존 helper migration을 진행한다.
