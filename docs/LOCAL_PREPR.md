# Local Pre-PR Verification — Issue #699

> 개발 Agent용 **로컬 사전 검증 보조 도구**다. 유일한 위험·영향 테스트 선택 정책은 [TEST_PLAN.md의 #697](TEST_PLAN.md#issue-697--변경-영향-기반-로컬-검증과-교차-회귀-선정-2026-10-16)에 있다. `PASS`는 원격 PR exact-Head 세 Required Check/QA/Owner 승인과 동등하지 않다.

## 1. WSL2 Ubuntu 준비

1. 기존 코드를 보호할 **독립 worktree**에서 해당 Issue branch를 체크아웃한다. 기존 서비스가 실행 중인 작업 디렉터리에서 무리하게 검사를 진행하지 않는다.
2. Node.js **22.x** (CI `NODE_VERSION=22`)와 npm, git, Python3를 준비한다. `node -v`, `npm -v`로 확인한다. Node 22 외 환경은 Pre-PR 증거로 인정하지 않는다.
3. 설치 파일 잠금 동기화가 필요한 경우 **별도 worktree에서만** `npm ci --prefer-offline --no-audit`를 수동 수행한다. CLI는 기존 `node_modules`를 재설치/삭제하지 않는다. `npm ci`는 설치된 의존성을 덮어쓸 수 있기 때문이다.
4. Browser 모드 전 `npx --no-install playwright install --only-shell chromium`로 `package.json`에 고정된 Playwright와 연결되는 headless Chromium을 준비한다. 새 Ubuntu에서 OS deps가 필요하면 기존 `.github/actions/playwright-setup/action.yml`을 읽어 환경별 별도 승인·설치를 수행한다. CLI는 sudo/apt를 실행하지 않는다.
5. Docker 모드는 Docker Engine 실행 및 접근 권한을 별도로 준비한다. 운영 Compose 프로젝트, 운영 DB 및 실제 HTTP 서비스를 도구에 전달하지 않는다.

`NEXT_DIST_DIR=.next-prepr`(프로덕션 Build), `.next-e2e`(브라우저)는 서로 독립된 출력이다. 기존 `.next-prepr` 또는 `.runtime-tools`가 있으면 fast/ci-like Build는 **BLOCKED**이며 덮어쓰지 않는다. `.next-e2e`, `test-results`, `playwright-report`, `.data/playwright.sqlite3*`가 존재하거나 localhost:3100 포트가 사용 중이면 Chromium 모드는 **BLOCKED**이다. 격리된 작업 공간을 확보한 뒤 다시 실행한다.

## 2. 명령 예시

```bash
# 변경 영향만 점검 (실제 테스트는 NOT TESTED)
npm run verify:prepr -- --mode=targeted --base=origin/main --issue=699 --risk=HIGH --dry-run

# 동일 기존 npm scripts 기반 정적 검사/Unit/Production Build
npm run verify:prepr -- --mode=fast --base=origin/main --issue=699 --risk=HIGH

# 선택 Unit + 실제 Chromium E2E + 교차/음성 소비자
npm run verify:prepr -- --mode=targeted --base=origin/main --issue=699 --risk=HIGH \
  --include=tests/e2e/project-task-editor.spec.ts \
  --exclude=tests/e2e/project-task-delete-context.spec.ts:Owner-reviewed-not-affected

# fast 후 전체 E2E를 단일 로컬 호스트에서 실행 (원격 6-runner 동일성 보장 X)
npm run verify:prepr -- --mode=ci-like --base=origin/main --issue=699 --risk=HIGH

# 명시적인 로컬 Docker image build + image policy, 기존 이미지 변경 없음
npm run verify:prepr -- --mode=docker --base=origin/main --issue=699

# 같은 PR 두 차례 서로 다른 실제 E2E 실패 입력 후, 연관 subset 진단 1회
npm run verify:prepr -- --mode=diagnose --base=origin/main --issue=699 --pr=695 \
  --failure-log=.prepr-failures/issue-695.json
```

변경된 `src/server/**`는 실제 해당 모듈을 직접 import하는 Unit/Integration 테스트를 선정한다. 일반적인 HTTP smoke만 존재하고 직접 검사 파일을 입증하지 못하면 **BLOCKED/UNKNOWN**이다. 삭제·rename된 test는 `git diff --no-renames`에서 옛 경로를 보존해 **MISSING** 처리하고, `tests/config` 및 공통 E2E fixtures/helpers 등 미등록 테스트 하네스 변경 역시 **BLOCKED**한다. 영향 계약이 불명확한 변경을 자동 성공 처리하지 않는다.

브라우저 모드(`targeted`, `ci-like`, `diagnose`)에서는 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 사용자 지정 실행 파일을 **검증되지 않은 바이너리**로 간주해 거부한다. 환경변수를 해제하고 Playwright에 고정된 headless-shell을 설치한다. JSON의 `chromiumRevision`은 패키지가 요구하는 **예상 revision**이며 실제 브라우저 버전이나 실행 성공의 증거가 아니다. Chromium PASS는 테스트 실행 로그/Trace에서 별도로 확인한다.

변경 대상에 과거 Core 캡처 비교 `tests/fixtures/gantt-state-consistency/capture-install.ts`가 포함되면 세 가지 역사적 Unit과 Pre-PR guard 테스트를 선정한다. 새 개발 전용 npm alias `verify:prepr`의 **정확한 명령만** 비교 시 제외하고 모든 과거 capture snapshot·의존성·기타 npm script·lockfile의 엄격한 검사는 유지한다.

`--include`는 실존하는 `tests/` 테스트 파일만 허용한다. `--exclude=파일:사유`는 선택 목록에서의 제외와 근거를 기록한다. 영향을 받은 producer의 자동 매핑이 없거나 rename/missing test가 있으면 **UNKNOWN/BLOCKED**이며, 제외·선택만으로 위험이나 원격 Required 범위를 자동 완화하지 않는다. Manager가 실제 계약/소비자 수를 다시 확인해 매핑·테스트를 보강해야 한다.

## 3. 진단 이력 입력 (실제 GitHub 근거를 **사용자가 수집**)

```json
{
  "failures": [
    {
      "pr": 695,
      "runId": "38742141930",
      "attempt": 1,
      "headSha": "04b6d3d90d06b742223038c31c84823d525feb21",
      "status": "FAIL",
      "file": "tests/e2e/milestone-dashboard-state.spec.ts",
      "classification": "UNKNOWN"
    },
    {
      "pr": 695,
      "runId": "38793354820",
      "attempt": 1,
      "headSha": "2f8f0573852a69fd85d733d0e57e61e282997372",
      "status": "FAIL",
      "file": "tests/e2e/project-task-delete-context.spec.ts",
      "classification": "UNKNOWN"
    }
  ]
}
```

샘플 값은 과거 #697 분석 문서에 수록된 사례이며 최신 원격 판정이 아니다. 실행기는 입력 PR/run/attempt/HEAD를 **원격 API로 검증하지 않는다**. 소유자가 먼저 GitHub Actions 원장·Trace를 확인하고 JSON에 입력한다. 서로 다른 Run·소비자 실패가 2회 이상이어야 하고 파일 최대 12개다. 진단은 `--workers=1 --retries=0 --max-failures=0`으로 **이 집합만 한 번** 실행한다. 기존 실패 경계/본래 테스트 단언·timeout을 수정하지 않으며, 결과의 `classification`은 제공된 초기 레이블에 불과하다. 확인되지 않은 원인은 UNKNOWN이다.

## 4. 실행 모드와 운영 영향

| 모드 | 실행 | 주의 |
| --- | --- | --- |
| `fast` | release-version, test discovery, Markdown links, CI cache, 로컬 QA fixture, `npm ls --offline`, typecheck, lint, Vitest, production build | OS/Node/npm/lock 적합성 점검; 소유하지 않은 출력은 거부 |
| `targeted` | 실제 파일 기반 선정 Unit 및 Chromium E2E | 정식 browser config, `CI_E2E_FULLY_PARALLEL=true`, worker=1; CI shard/runner 격리와 차이 있음 |
| `ci-like` | fast + 전체 Chromium E2E | 비싼 명시 실행; 여섯 대 독립 runner의 실패 중단/스케줄은 재현하지 않음 |
| `diagnose` | 두 실패의 교집합이 아닌 **서로 다른 실패 파일들의 합집합**만 실제 Chromium 재생 | 동일 이슈·PR 원본 증거, file existence와 상한 요구 |
| `docker` | 이름이 고유한 로컬 Docker image 빌드 + image policy 검사; 자신이 붙인 tag만 정리 | GitHub Buildx/Compose/transport/GHCR Required smoke는 DEFERRED |
| `--dry-run` | Git 변경·선정 근거 보고만 기록 | 상태 NOT TESTED이며 로컬 PASS 증거가 아님 |

모든 모드에서 Git 변경을 기록할 때 `base SHA` + `HEAD SHA` + tracked diff(내용) + untracked file bytes를 hash하고 시작/종료 fingerprint가 다르면 **BLOCKED (stale evidence)**이다. Git reset/clean/force push, 자동 npm ci, 기존 앱 stop/kill, 운영 URL/DB 접근, Docker Compose up/down은 수행하지 않는다. 실행기 자신이 생성한 `.next-prepr`·`.runtime-tools` 및 E2E 임시 DB/출력만 정리한다. Playwright trace와 HTML report는 보고 경로 아래 보존한다. 도중 SIGINT/SIGTERM은 자기 자식 프로세스에 전달하고 미실행은 성공이 아니다.

## 5. 보고 계약 및 해석

실행마다 Git에 추가되지 않는 `.prepr-reports/<timestamp>-<pid>-<id>/report.json`과 `SUMMARY.md`가 생성된다. JSON에는 issue/PR, mode, risk, 시작/종료 시각, base/head/dirty fingerprint, 변경 경로, 설치 버전·로컬 Chromium revision, 선정/제외/UNKNOWN/누락, 각 명령/exit/time/가능한 case count, E2E report/trace 경로, 로컬 PASS/FAIL/BLOCKED/NOT TESTED 및 CI-only DEFERRED 이유를 저장한다. 파싱되지 않는 고유 케이스 수는 임의로 0/성공으로 바꾸지 않고 `null`이다.

완료 보고자는 Work Packet의 변경 producer→consumer→실제 테스트(직접/인접/음성) 선택과 미실행 사유를 첨부한다. **PR 생성 후 `pull_request` Full CI의 정확한 Head/base/test merge·Run ID/Attempt와 Quality/E2E/Docker Required 3종 및 Trusted QA는 별도 원격 검증**으로만 판정한다. CI 시작은 PR CI 성공·Owner ACCEPT가 아니다.

## 6. 효과 검증·장애·롤백

#667과 같은 연쇄 실패는 [#697 사례](exec-plans/active/ISSUE_697.md)와 [실패 원장](ISSUE_667_FAILURE_ANALYSIS.md)을 참조하여 제품/fixture/환경/정책/UNKNOWN으로 분리한다. 도입 전후 비슷한 위험도 PR의 **첫 full PR CI 성공률, PR당 rerun, local false-negative 회귀, Actions runner-minutes, 로컬 검사 시간**을 run/attempt 원장과 `scripts/analyze-ci-setup-metrics.mjs`/`scripts/compare-ci-setup-metrics.mjs`를 이용해 비교한다. 유효한 표본/교란변수 없이 자동 시간 절감률을 주장하지 않는다.

실패 시 표준 출력의 최초 FAIL 명령, JSON에 기록된 exit/status, 증거 fingerprint와 테스트 아티팩트를 확인한 후 동일 source에서 보완/재검증한다. 네트워크 오류/Node·Chromium 미설치/포트 선점은 제품 FAIL이 아니라 BLOCKED 또는 미검증임을 기록한다. 위험 회귀가 생기면 신규 `scripts/prepr-core.*`, `scripts/verify-prepr.mjs`, `tests/scripts/prepr-verifier.test.ts`, npm script alias 및 관련 문서만 원복한다. CI workflow/세 Required Gate/Trusted QA/Main/GHCR/Finalizer는 원본 그대로 유지되므로 이 도구 롤백에 CI 정책 변경이 필요하지 않다.
