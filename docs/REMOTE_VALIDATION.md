# GitHub-first 테스트 및 검증 정책

> **Issue #8 전송 정책:** production 기본값은 HTTPS다. `ALLOW_INSECURE_HTTP=true`와 canonical HTTP `APP_BASE_URL`을 함께 설정한 내부망은 production HTTP도 지원한다. 시작·readiness·공유 URL·모든 인증 경로는 같은 정책을 사용한다. `SESSION_COOKIE_SECURE`는 미사용 예약값이며 제거했다. HTTP에서는 `mastergantt_edit`, HTTPS production에서는 `__Host-mastergantt_edit; Secure`를 사용하고 HttpOnly·SameSite=Strict·Path=/·TTL 및 Domain 미설정을 유지한다. 아래 과거 검증 이력의 HTTPS-only 표현은 당시 기준이다. 현재 운영·전환 절차는 [HTTP_OPERATION](HTTP_OPERATION.md)을 따른다.


관련 Issue: #5

## 목적

코드 변경의 공식 검증 증거를 개발자 로컬 환경이 아니라 GitHub Actions에 우선 둔다. 로컬 실행은 빠른 피드백과 재현에 사용하고, PR merge 가능 여부와 `main` artifact의 유효성은 원격 workflow 결과로 판단한다.

## 1. 검증 계층

| 단계 | 실행 위치 | 기본 범위 | 판정 용도 |
| --- | --- | --- | --- |
| Local Fast Feedback | 개발 환경 | 변경과 직접 관련된 Vitest, 필요 시 typecheck/lint, 재현용 명령 | 구현 중 빠른 피드백. 공식 전체 회귀 PASS를 의미하지 않음 |
| PR Required Validation | GitHub Actions | version check, typecheck, lint, 전체 Vitest, dependency audit, markdown link, production build, Chromium Playwright E2E, Docker build/runtime/SQLite persistence smoke | 코드 변경의 기본 공식 검증 |
| Main Artifact Validation | GitHub Actions + GHCR | PR 수준 gate + 임시 `ci-<full SHA>` publish + exact digest pull + readiness/API/auth/restart persistence + SBOM/provenance + 검증 후 package version 삭제 | `main` commit registry 경로 검증 |
| Semantic Release Validation | GitHub Actions + GHCR | release workflow의 version/tag gate, candidate runtime, digest smoke, promotion | 배포 가능한 version artifact 검증 |
| Environment-specific Validation | 실제 대상 환경 | Windows Excel/VBA/DRM, reverse proxy/TLS, off-host backup/restore, 최종 수동 UX 등 | GitHub-hosted runner로 대체할 수 없는 항목 |

## 2. 기본 개발 흐름

1. Issue 또는 승인된 작업 범위를 확인한다.
2. `main`에서 작업 branch/worktree를 만든다.
3. 구현 중에는 변경과 직접 관련된 최소 로컬 테스트만 반복한다. 실패 재현을 위해 필요한 경우 범위를 확대한다.
4. 변경을 원격 branch에 push하고 Pull Request를 생성한다.
5. PR의 `.github/workflows/ci.yml` 결과를 공식 검증으로 사용한다. `quality`, `e2e`, `docker`가 모두 성공하기 전에는 Manager가 기능을 최종 ACCEPT하지 않는다.
6. 실패하면 GitHub run → job → step → 최초 오류를 근거로 원인을 분석한다. 로컬에서만 다시 PASS한 것은 원격 실패 해결 증거가 아니다.
7. PR이 merge되어 `main`에 반영되면 동일 CI gate 후 `publish-commit-image`가 실행되어야 한다.
8. `main`의 완료 보고에는 대상 commit SHA, CI run 결과, 임시 GHCR `ci-<full SHA>`와 exact digest 검증 결과, package version 삭제 결과를 기록한다. GHCR publish가 필요 없는 문서 전용 변경이라도 현재 workflow가 실행되면 실제 결과를 그대로 기록하며 임의로 PASS를 가정하지 않는다.
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

PR과 동일한 gate를 다시 수행한 뒤 모두 성공한 경우에만:

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

[issue-87-branch-cleanup.yml](../.github/workflows/issue-87-branch-cleanup.yml)의 추가 trigger/권한/퇴역 계약은 [CI_CD.md](CI_CD.md) 9절을 따른다. 정식 release와 별개인 고정 PR #88 운영 정리다.

| 계층 | 실행과 필수 증거 |
| --- | --- |
| Local Fast Feedback | `python3 scripts/verify-issue-87-cleanup.py`; 실제 workflow inline 코드를 추출하여 모형 및 로컬 bare Git 검증 |
| PR cleanup validation | 해당 workflow/script 변경 PR에서 `Issue 87 브랜치 정리 안전 조건 검증` job PASS; contents:read, credential 미보존. 기존 quality/e2e/docker도 별도 모두 PASS |
| 실제 post-main cleanup | main push CI의 실제 merge SHA/attempt와 quality/e2e/docker/main GHCR 네 job success 확인 후 고정 branch의 SHA 조건부 삭제, 실제 ref 404와 run summary |

회귀 스크립트는 24개 API 모형 시나리오와 3개 실제 로컬 Git 시나리오를 포함한다. 정상·이미 없음·무관 run, CI/GHCR 미완료/실패/skipped, 저장소/event/path/attempt/SHA 불일치, squash/잘못된 merge parent, 보호/새 commit/다른 열린 PR 참조를 검증한다. Git 검증은 정상 삭제, 전송 전 stale tip, 서버 광고 이후 pre-receive 경합에서 새 tip 보존을 확인한다. 이 테스트와 토큰 인자/trace 비노출 확인은 실제 GitHub 삭제 PASS를 대신하지 않는다.

Manager는 PR #88에 `merge_method=merge`와 최종 expected_head_sha를 사용한다. squash/rebase는 지원하지 않으므로 임의로 ancestry gate를 제거하지 않는다. cleanup의 단일 삭제 refspec은 명시적 SHA lease를 사용하며 별도 GET 뒤 REST 무조건 DELETE로 fallback하지 않는다. 권한 부족·lease 실패·새 commit·누락 gate는 FAIL/BLOCKED로 남기고 강제 삭제하지 않는다.

infra는 main run/merge SHA, GHCR digest·smoke·package 정리, cleanup run과 최종 ref 404를 기록한다. 독립 검토가 이를 확인한 뒤 Manager가 종료를 판단한다. 다른 main run은 no-op이며 이미 없는 branch는 재삭제하지 않는다. 대상 이름을 재사용하지 않고 workflow 퇴역은 증거 보존 후 별도 검토된 운영 변경으로만 수행한다. 이번 완료 기준은 이 한정 절차를 일반 브랜치 자동 삭제나 제품 릴리스 승인으로 확대하지 않는다.
