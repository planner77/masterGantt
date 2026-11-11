# 로컬 검증 Gate

`npm run verify:prepr`는 기존 #697/#699 실행기를 확장한 **로컬 전용** 도구다. 현행 운영은 [Issue Lifecycle](ISSUE_LIFECYCLE.md), 테스트 선정은 [TEST_PLAN](TEST_PLAN.md)이 원본이다. PR·GitHub Actions·원격 CI·Trusted QA·Finalizer를 실행하지 않는다. `ci-like`는 로컬 모드 이름이며 원격 CI가 아니다.

## 1. 준비와 안전 경계

독립 worktree에서 package.json engines의 Node >=22·npm·git·Python3·package/lock·필요 Docker를 확인한다. 기존 서비스 디렉터리나 운영 DB를 사용하지 않는다. 의존성은 별도 worktree에서 명시적으로 `npm ci --prefer-offline --no-audit`, browser는 고정 package에 맞는 `npx --no-install playwright install --only-shell chromium`으로 준비한다. 실행기는 임의 재설치·sudo/apt·기존 서버 중지를 수행하지 않는다.

`.env*` 입력 변형·운영 환경변수는 모든 실행 모드에서 거부한다. `fast`의 production build는 표준 `.next`를 사용하며 기존 `.next`/`.runtime-tools`가 있으면 덮어쓰지 않고 BLOCKED한다. `PLAYWRIGHT_BASE_URL`/`APP_BASE_URL`/`DATABASE_PATH` 등 외부·운영 입력과 임의 Chromium executable, localhost:3100 점유를 거부한다. 검증 전에 안전한 새 worktree를 준비한다.

시작/종료의 base SHA·HEAD SHA·tracked diff/untracked bytes·fixture/lock digest·실행 환경을 비교한다. 호출마다 달라지는 관측 전용 CODEX_TOOL_CALL_ID는 PWD/TERM류 transient로 분리하고 trace hash로만 보존하며, 실제 PATH/버전/설치/동작 환경은 계속 검증한다. 입력 변경·오염·환경 불일치·취소는 PASS가 아니다. 자신이 만든 생성물만 정리하고 Playwright failure artifact는 로컬 보고에 보존한다. 공개 증거는 합성 fixture와 정제한 결과만 사용한다.

브라우저 실행은 clean exact HEAD가 필요하다. 실행기는 `.prepr-reports/<run>/browser-source`에 동일 Head의 일회용 source snapshot을 만들고 입력 bytes가 원본과 같은지 확인한 뒤 기존 Playwright 설정·fixture를 실행한다. 동일하게 고정된 설치 의존성을 snapshot 내부로 CoW 또는 실제 파일 복사하여 self-contained 실행 root를 만든다. 복사 전후 dependency inventory/hash 일치를 확인하고 내부 상대 `.bin` 링크를 보존하되 snapshot 밖으로 해석되는 의존성·링크는 거부한다. snapshot에서 npm install/ci를 실행하거나 source·설치 입력을 수정하지 않으며 운영 URL/DB를 전달하지 않는다. E2E의 `.data/playwright.sqlite3*`, `.next-e2e*`, `test-results`, `playwright-report`는 snapshot 안의 격리 출력이다.

검사 전후 원본 checkout의 source/index/fixture/환경은 그대로여야 한다. snapshot도 제품·테스트·fixture·설정 bytes가 그대로여야 하며, 설치된 Next가 만드는 정확한 `next-env.d.ts` import/notice와 `tsconfig.json`의 격리 타입 출력 경로 include 추가만 생성 출력으로 검증한다. 다른 옵션·코드·fixture 변경은 BLOCKED다. 허용한 생성 출력의 전후 hash·차이를 보고하고 원본 파일을 복원하거나 source fingerprint에서 제외해 PASS를 만들지 않는다.

## 2. 모드와 실행 예시

| 모드 | 로컬 실행 범위 | 판정 경계 |
| --- | --- | --- |
| `fast` | version/discovery/문서·의존 확인, typecheck/lint·전체 Unit/Integration·production build | 공통 검사 결과. 영향 browser/Docker는 별도 확인 |
| `targeted` | 실제 파일의 영향 Unit·snapshot의 Chromium과 직접/인접/음성 consumer | browser는 clean exact HEAD 필요; 선정·제외 이유, UNKNOWN·미실행 보존 |
| `ci-like` | 공통 검사 + snapshot의 전체 Chromium | 단일 로컬 호스트 검증이며 원격 실행이 아님 |
| `docker` | Docker build/image policy + 격리 runtime/API/SQLite restart smoke | GHCR Push/Pull·운영 반영은 수행하지 않음 |
| `admit` | 동일 source 복수 보고서를 read-only 비교하고 공통+영향+필요 Docker의 완결성을 검사 | `admission.publishAllowed`는 로컬 준비 판정이며 인증된 서버 Gate·Owner 허가가 아님 |
| `--dry-run` | 영향·선정 계획만 조사 | NOT TESTED, admission PASS 증거로 사용할 수 없음 |

```bash
# 테스트 계획만 조사
npm run verify:prepr -- --mode=targeted --base=origin/main --issue=908 --dry-run

# 동일한 고정 baseline의 공통 검사
npm run verify:prepr -- --mode=fast --base=<baseline-main-sha> --issue=908

# 영향 consumer 실행
npm run verify:prepr -- --mode=targeted --base=<baseline-main-sha> --issue=908

# 코드·도구/컨테이너 영향의 Docker smoke
npm run verify:prepr -- --mode=docker --base=<baseline-main-sha> --issue=908

# 필요한 경우 전체 로컬 Chromium
npm run verify:prepr -- --mode=ci-like --base=<baseline-main-sha> --issue=908

# 최종 clean commit과 고정된 이전 baseline의 보고서를 결합(각 경로는 실제 생성 위치)
npm run verify:prepr -- --mode=admit --base=<baseline-main-sha> --issue=908 \
  --reports=.prepr-reports/<fast-run>/report.json \
  --reports=.prepr-reports/<targeted-run>/report.json \
  --reports=.prepr-reports/<docker-run>/report.json
```

`--include=tests/...`는 실존 테스트의 추가 선정, `--exclude=tests/...:reason`은 제외 근거 기록이며 필수 검사나 미해결 consumer를 면제하지 않는다. CLI `--risk`로 추론 위험을 낮추지 않는다. LOW UI라고 요청해도 shared code/interaction이면 MEDIUM/HIGH로 높인다.

과거 `diagnose --pr=... --failure-log=...`는 기존 원격 실패 원본의 재생 호환만 제공한다. 신규 admission은 PR 번호·check/run/status·test-merge·Trusted에 의존하지 않는다. 오래된 입력의 존재를 현재 검증 성공이나 Owner 승인으로 사용하지 않는다.

## 3. 보고와 admission

실행마다 Git 제외인 `.prepr-reports/<run>/report.json`과 `SUMMARY.md`를 만든다. issue·mode·risk, 시작/종료 source, fixture/lock·환경, 실제 명령/exit·시각/시간·해석 가능한 case 수, selected/excluded/UNKNOWN/missing, artifact·미실행/잔여 위험을 기록한다. 해석할 수 없는 case 수는 null/UNKNOWN이며 0 PASS가 아니다.

admit에는 `--issue=<Primary>`와 `--base=<고정된 이전 baseline SHA>`가 필요하다. base는 Head의 ancestor이며 Head와 같거나 diff가 비어 있으면 거부한다. `--reports`는 반복 선택 입력이고 동일 source의 `.prepr-reports` 저장 보고서도 자동 조회하므로 뒤의 같은 mode FAIL을 숨길 수 없다.

개별 모드 PASS와 `admission.publishAllowed=true`는 별개다. admission은 동일 Issue·clean exact Head/base/content·fixture/환경의 보고서를 결합해 공통 필수, 선정된 영향 테스트, 코드 변경의 필요한 Docker/runtime/API/SQLite를 충족하는지 확인한다. 실패·누락·dry-run·중단·stale source/fixture·환경 drift·unknown/임의 제외는 Push/Publish/Close를 BLOCKED로 만든다. 보고 뒤 source가 바뀌면 관련 검증을 재실행한다. 최종 commit 뒤 같은 launcher·환경·고정 base로 fast/targeted/docker/admit를 수행한다. docs-only도 공통 정적·전체 Unit/Integration·build를 실행하며 Docker만 N/A다. runner JSON·로그의 실제 bytes SHA와 파일별 passed/failed/skipped를 비교한다. 공통 Unit은 전체 발견 파일의 runner 결과와 실제 pass를 확인한다. 예외는 이번에 확인한 `tests/server/projects/task-dependency-performance.test.ts`의 기존 default 3SKIP뿐이며, `RUN_TASK_DEPENDENCY_BENCHMARK !== "1"`이고 해당 파일이 영향 선정·명시 include되지 않았을 때만 NOT TESTED 사유로 보존한다. 이 파일이 selected이면 실제 pass가 필요하다. 다른 skip-only·예상 개수 불일치·발견 파일 보고 누락은 BLOCKED이며 coveredTests에 skip-only를 넣지 않는다. snapshot의 runner 경로는 확인된 실행 root에서 원본의 canonical 테스트 경로로 귀속하며 원본 밖의 경로·누락·임의 변경을 실행 coverage로 인정하지 않는다. 로그·runner 결과·실패 artifact와 생성 출력 provenance를 로컬 보고에 보존한다. Docker PASS 이미지는 `report.dockerImage`로 유지·인계하고 admission에서 실제 daemon image ID/tag/source/platform을 다시 확인한다.

로컬 JSON/훅은 Owner 단말의 보조 수단이며 변조 방지된 인증 서버가 아니다. Manager는 실제 실행과 출처·AC를 대조하고 Owner의 대상 범위 승인, #911 live 설정과 최신 main을 별도로 확인한다. 이 도구는 Git/GHCR 쓰기를 수행하지 않는다.

### 후속 backup·publish 소비자

#912의 SQLite backup/restore CLI와 #909의 publisher는 기존 Gate의 실제 직접 테스트 소비자로 선정한다. 공통/영향/필요 Docker·admit를 같은 고정 source·launcher·환경에서 마친 뒤 [CI_CD의 게시 CLI](CI_CD.md#로컬-게시-cli)로 인계한다. `node scripts/verify-prepr.mjs`와 publisher의 직접 Node 실행을 사용할 수 있으며 npm/PATH/실제 기능 환경 차이를 transient로 숨기지 않는다. `--include`가 필요하면 Gate와 publisher에서 동일하게 지정한다.

backup의 정적 SQL prefix·manifest 검증, publisher `plan`/`verify`, 실제 exact digest runtime/격리 복원은 각각 다른 증거다. 도구의 출력·문서·과거 수동 게시 PASS만으로 새로운 runtime 또는 운영 복원 성공을 선언하지 않는다. 별도 전용 private 로그·backup key 경계는 [CI_CD](CI_CD.md)·[DEPLOYMENT](DEPLOYMENT.md)를 따른다.

## 4. 재작업과 원장

최초 FAIL·환경 BLOCKED·미실행을 `docs/ISSUE_<N>_FAILURE_ANALYSIS.md`에 append-only로 기록한다. 제품/fixture/환경/정책/UNKNOWN을 분류하고 수정 SHA와 재실행의 동일 source·결과를 추가한다. [Regression Index](REGRESSION_INDEX.md)와 관련 원장에서 같은 consumer를 조사하며 이전 PASS를 새 source에 전용하지 않는다. #907의 [원장 계약](ISSUE_LEDGER.md)·기계 검증 가능한 인덱스와 validator는 이번 #906/#907/#908 통합 구현 범위다. 등록·구현 사실과 실제 검증 성공을 구별하고 그 결과를 같은 source 증거에 연결한다.

과거 전체 절차·실패 입력 예시는 [보존 기록](history/owner-ci-retired-20261110/LOCAL_PREPR.md)에 있다. 그 안의 원격 실행 요구는 현재 gate가 아니다.
