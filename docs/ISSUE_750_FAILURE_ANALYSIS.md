# Issue #750 — #623 테스트 분할 누적 실패·검증 원장

Primary Issue [#750](https://github.com/planner77/masterGantt/issues/750). [Work Packet](exec-plans/active/ISSUE_750.md), [실패 원장 정책](PR_CI_FAILURE_TRIAGE.md). #750 PR Full #3180.1(F750-001)/#3181.1(F750-002)과 첫 Main #3183.1(F750-003)의 직접 실패·파생·취소를 서로 다른 원본으로 보존한다. 다른 Issue 실패나 취소 Shard는 직접 FAIL로 합산하지 않으며 새 HEAD Required3/Trusted는 NOT TESTED다.




## F750-003 — 병합 후 최초 Main CI #3183.1의 #490 Y Scroll Setup 경합 (2026-10-23 KST)

- **원본/신원**: Issue [#750](https://github.com/planner77/masterGantt/issues/750), 원본 [PR #783](https://github.com/planner77/masterGantt/pull/783), 병합 Main SHA `fb43e70a41229d71026f5ffeb9e05424a124d43c`(first parent `d2a82b666836b28bf392215993240c0fae2d4fdc`, second parent `fc28459c70210e00f51f33919dde8170e321dd5e`), [Main CI #3183.1 / Run 39910342165 attempt1](https://github.com/planner77/masterGantt/actions/runs/39910342165), event `push`, source `fb43e70a...`, exact [Shard8 Job120271708367](https://github.com/planner77/masterGantt/actions/runs/39910342165/job/120271708367), [Playwright report Artifact12483641531](https://github.com/planner77/masterGantt/actions/runs/39910342165/artifacts/12483641531), [timing Artifact12483477845](https://github.com/planner77/masterGantt/actions/runs/39910342165/artifacts/12483477845).
- **실제 직접 FAIL**: `tests/e2e/project-settings-layout-490.spec.ts:163` — #490 `설정 탭·닫기·metadata 저장은 WBS·Gantt 상태를 유지한다`의 **초기 Y=38px native scroll setup 검사**, 기대 `38`, 관측 `0`이 Playwright `expect.poll`의 원래 5초 동안 지속. Chromium Shard8 **101 PASS / 1 FAIL**, 나머지 Shard1~7 **각 SUCCESS**. TypeScript/ESLint/Unit/Build·Quality aggregate와 Docker 구현·aggregate **SUCCESS**, E2E aggregate **FAIL(파생)**, GHCR Main 임시 candidate **SKIPPED**, 자동 Finalizer [#900.1](https://github.com/planner77/masterGantt/actions/runs/39913090897) 조건 미충족으로 SKIPPED. Issue는 OPEN. 35분 Job timeout, #623 최신 변경 검사 FAIL, DB/서버 API 장애로 오분류 금지.
- **원시 trace에서 확정된 정보**: 최초 `chartMeasure={scrollWidth:816,clientWidth:797,capacity:19}`에서 내부 X 목표9px을 선택했고 후속 attachment의 `actual={scrollLeft:9,capacity:903}`로 **동일 테스트 시작 단계에서 수평 용량이 19→903으로 변함**을 확인. X=9는 정상. Y 세팅 뒤 `state().verticalScroll`는 0을 계속 반환. 설치 SVAR Gantt의 후행 레이아웃/투영 또는 native vertical scroll 용량 부족을 합리적 원인 후보로 구분해야 하며, **원본 trace에 Y scrollHeight/clientHeight가 없으므로 Core가 Y를 덮었다는 인과 확정은 불가**. #703 Main #2901과 #624 PR #2920의 X 경계 가정 문제가 기존 #490 동일 소비자에 존재하지만 이번 Y 오류와는 독립.
- **교정 계획**: #490 기존 단일 E2E에서 X=interior `expectedChartScroll`을 먼저 실제 native 위치로 검증, **후행 requestAnimationFrame 두 프레임** 관측 후 Y native `scrollHeight-clientHeight >38`을 강제, Y=38을 단 한 번 설정하고 즉시 반환값/용량/X를 비민감 attachment에 기록한다. 두 프레임을 거친 뒤에도 실제 Y=38 엄격 일치 검사와 기존 `state().verticalScroll===38` 및 모든 Settings 탭·닫기·metadata·fullscreen 전후 상태 equality는 원형 유지. 용량 부족/후행 Core reset이면 **실제 FAIL**로 남고 어디서 발생했는지를 명확히 보고한다. 화면/코드/fixture의 업무 계약, 0.130.1 version, timeout/retry/skip/CI shards/Ruleset·GHCR 정책은 바꾸지 않는다.
- **검증/운영**: 원본 #3183.1은 FAILED로 불변, 이전 [PR Full #3182.1](https://github.com/planner77/masterGantt/actions/runs/39899821855)의 8/8 SUCCESS도 별개 역사. 실패 원인 분리는 Trace/attachment 직접 검증, 새 correction PR은 `Refs #750`/main exact SHA 기반 후속 same-Issue PR. 수정 후 동일 Head PR Full Required Quality/E2E8/Docker + trusted QA·Owner 위험 수용 전 **Main 직접 변경, 강제 체크 통과, 원본 Main 재실행을 통한 임의 PASS, GHCR/릴리스/이슈 종료 금지**. 신규 PR CI와 새 Main CI의 영수증은 각각 다른 Run/Attempt/Head로 남긴다. 원본 v0.130.1 Owner 승인 [#6358720169](https://github.com/planner77/masterGantt/issues/750#issuecomment-6358720169)은 과거 release target 범위의 근거이므로 새 corrective SHA의 정식 게시 여부도 Generic Finalizer가 별도 검증할 때만 확정한다.

## F750-002 — PR #783 Full #3181.1 focused status/progress Test Budget 30초 소진 (2026-10-23 KST)

- **원본 provenance**: [PR #783](https://github.com/planner77/masterGantt/pull/783), [Full Run 39895278155.1/#3181.1](https://github.com/planner77/masterGantt/actions/runs/39895278155), event=pull_request, exact head `dc5ecb90df7560c6dcd81cd5efcdf97cfeff5d3e`, base `d2a82b666836b28bf392215993240c0fae2d4fdc`, checkout/test-merge `29ffe19c8eed897b6eaec9200a7846bc3a2f537f`(#751 performance receipt). [Shard1 Job120224964285](https://github.com/planner77/masterGantt/actions/runs/39895278155/job/120224964285), [Playwright Artifact12477090475](https://github.com/planner77/masterGantt/actions/runs/39895278155/artifacts/12477090475) trace/issue623-phase-timing/error-context, [timing Artifact12476244679](https://github.com/planner77/masterGantt/actions/runs/39895278155/artifacts/12476244679). 이 원본 FAIL을 재검증 PASS로 소급하지 않는다.
- **직접/파생**: Shard 1/8 `#623 독립 Resource status/progress·원시 ID·mutation 경계`(spec:318) **30,000ms test timeout**, **36PASS/1FAIL/66NOT RUN**. 2~8 Shard는 matrix fail-fast로 CANCELLED(PASS/직접 FAIL 아님). Policy/TypeScript/ESLint/Vitest/Next build/Quality aggregate 및 Docker Build/Smoke aggregate SUCCESS; Chromium E2E aggregate 및 Automated QA FAIL은 원발 E2E 실패의 파생. Job 35분 Timeout이나 DB 오류로 오분류하지 않는다.
- **실측 분석**: 원본 Playwright `issue623-phase-timing`은 `status=timedOut,bodyMilliseconds=29964,timeoutMilliseconds=30000`이며 시작 `fixture/seed-http` **19,347ms**(실제 seed·초기 canonical 원본 조회/ID·쓰기 관찰기 구성 포함), 화면 준비 `focused/Resource status/progress` **1,399ms**, 상태 변경 `mutation/3-status` **4,484ms**, 진행률 변경·복귀·첨부 `mutation/4-progress` **4,734ms**. 별도 #751 performance receipt `seed_issue_623=15,644.93ms`, `fixture_setup=16,114.31ms`는 중첩된 다른 구간이므로 이 값들을 서로 더해 30초라고 하지 않는다. Trace에서 status/progress의 두 PATCH·canonical revision/ID·Gantt 보존 및 `returnToSchedule`·`issue623-focused-identity` attachment 완료를 확인했다. Assertion FAIL/서버 500이라는 증거 없음.
- **이전 F750-001과 연결**: 첫 Full #3180.1에서 Resource/Assignment 3-write 집중 case가 본문30초를 소진해 status/progress 2-write와 assignment 1-write로 분리했으나 두 번째 Run은 seed+원본 초기화 약19.3초가 여전히 본문30초에 포함돼 종료 시 초과했다. 케이스를 더 쪼개면 Fixture 재기동/DB 생성/Next warmup 횟수가 증가한다. Assertion·retries·skip·timeout 숫자 임의 완화보다 **setup/test body 예산 분리**를 우선한다.
- **보완**: #623 focused 5개 케이스의 `seedIssue623`와 `mutationSession`을 새 `focusedAcceptance` Playwright **test-scoped Fixture**에서 먼저 실행해 실패하면 그대로 FAIL 처리. `isolatedApplicationRuntime`와 일치하는 별도 Fixture `timeout=120000`, focused test 본문 **기본30초 유지**. `timeIsolatedStage("seed_issue_623")` Stage 및 `phaseTiming.fixture/setup`은 Fixture 비용을 계속 기록, 본문은 `beginBody("focused/initial-identity")`부터 시작해 DB/원본 준비와 실제 UI mutation을 분리한다. 초기 페이지 timeout15초, 각 케이스의 독립 SQLite/HTTP/BrowserContext, 호출 수·Task/Assignment ID·revision+N·조회 mutation0·Gantt instance/Core 보존 단언 유지. 기존 #623 Golden/Excel, **six-write/revision+6** 결합 Smoke, 5폭 geometry, CI8/Required3/Trusted/Owner 판정·테스트 개수12는 불변.
- **재검증·비용**: 기존 11case 로컬 PASS, #3180/#3181 원격 FAIL과 비용 표본은 역사적 불변. 새 HEAD/Fixture의 실제 Chromium·Exact Head Required3/Trusted/Owner는 **NOT TESTED**. setup 분리는 총 runner wall-clock 단축을 주장하는 것이 아니며 추가 Fixture 비용·Shard 시간은 원격 별도 관찰 대상으로 둔다. `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `release_required=true`, `release_authorized=false`, Owner 명시 승인 전 Merge/Main/GHCR/Release/Finalizer/Issue 종료 금지.

## F750-001 — PR #783 첫 Full #3180.1 Resource/Assignment 독립 E2E 본문 Timeout (2026-10-23 KST)

- **원본/출처**: [PR #783](https://github.com/planner77/masterGantt/pull/783), [원본 Full #3180.1 (Run 39891124883.1)](https://github.com/planner77/masterGantt/actions/runs/39891124883), event=`pull_request`, Head=`3576c2c177060d14b1e08bf071ef262b0d60cd5d`, base main=`d2a82b666836b28bf392215993240c0fae2d4fdc`, 기존 이슈 CI 시작 영수증 test merge=`5eb1c7226e91e1d40c8bb733f914d0024723c3ff`. 최초 [Shard1 Job 120211500414](https://github.com/planner77/masterGantt/actions/runs/39891124883/job/120211500414), [Playwright report Artifact 12475147116](https://github.com/planner77/masterGantt/actions/runs/39891124883/artifacts/12475147116), 원본 trace/error-context. QA Final 로그는 `run:39891124883.1` 표시, GitHub workflow run 도구의 독립 run_attempt 원시 필드 확인은 별도 미실시.
- **직접 실패**: E2E Shard1 계획 102건 중 **36 PASS / 1 FAIL / 65 NOT RUN**. `tests/e2e/issue-623-resource-mvp.spec.ts:302` 의 `#623 독립 Resource/Assignment·원시 ID·mutation 경계`, `changeResourceAndAssignment` `allocation.fill("80")` line257에서 30,000ms test deadline 소진, locator 대기. 원본 스냅샷에 작업 정보 dialog / Resources 탭과 정확한 레이블의 기존 투입률 입력 100이 마지막 시점에는 존재하므로 레이블 삭제나 DB 쓰기 실패를 근인이라고 단정하지 않는다. 원본 trace에 앞선 상태·진척 2회 저장 이후 allocation 편집에 본문 시간 예산 약 1.4초만 남아 있음을 관측. Fixture timeout 120초 및 E2E test 본문30초는 별개다.
- **파생/미실행**: 나머지 **7 Shards CANCELLED**(PASS/직접 FAIL 아님). TypeScript/Policy/Vitest/ESLint/Next Build 및 Quality aggregate **PASS**, Docker build/smoke/aggregate **PASS**. E2E aggregate Job120213417345와 QA Final Job120213439907 **FAIL은 위 직접 실패와 취소에 따른 파생**. 다른 mock 스펙의 기존 `PROJECT_NOT_FOUND` 404, `git fetch` warning은 직접 실패원인으로 확정하지 않음. 35분 Job timeout 아님.
- **관련 이력**: #732 F732-006과 #751 F-008에 Task Assignment 편집기의 비동기 `assigned-targets` 및 `assignment-targets` 원본 조회 완료 전 입력 locator 검증이 경합했던 이력이 있다. 여기서는 **3 Mutation을 한 집중 테스트에 직렬로 묶은 30초 body budget 소진**이 직접 재현된 실패 분류이며, 정확한 개별 Next 컴파일/CPU/API 지연 인과는 UNKNOWN으로 유지한다.
- **교정**: 하나의 Resource/Assignment 집중 테스트를 독립 fixture의 **`Resource status/progress` 2 PATCH** 및 **`Assignment allocation` 1 PUT** 두 케이스로 분리해 테스트 기본30초 예산 보존. 배정 편집 시 리소스 탭 선택·기존 `할당 저장` 버튼 enabled 상태를 확인하여 두 원본 조회/Revision이 준비되기 전 원래의 정확 레이블 검사를 시작하지 않게 한다. 기존 `mutationSession.assertSaved`의 Task ID 집합, 각 저장 revision delta/쓰기 수, Gantt instance/Core 연결과 Assignment 원본 UUID·투입률80·조회 mutation0을 보존한다. 공통 `changeResourceAndAssignment` 래퍼와 원래 **6 UI 저장/revision+6 통합 Smoke**는 변경하지 않는다. 원래의 개별/전역 timeout·retries/skip/assertions·8-Shard Required3·Trusted QA를 완화하지 않는다.
- **상태·비용**: #623 시나리오 기존 7 → 초기 PR 11 → 교정 HEAD **12 case**(Golden1/Focused5/Smoke1/Geometry5). 독립 Fixture 1회 증가로 CI/runner 비용은 추가 실측 필요. 기존 HEAD 로컬 11 case 349.736872s PASS·36고유 PASS는 **과거 사실**이며 새 소스의 동일-source Chromium PASS/Required3/Trusted QA/Owner ACCEPT는 **NOT TESTED**. 이전 FAIL을 PASS로 소급하지 않는다.
- **리뷰/충돌·승인**: 최초 PR #783 review thread 0·mergeable=true, 최초 base와 main `d2a82b66...` 정렬. 새 HEAD 게시 이후 재확인 예정. HIGH/OWNER_MANAGED, release_required=true/release_authorized=false, Owner 병합/정식 릴리스 승인 없음. PR CI 시작 후 별도 요청 없이 모니터링·병합·Main/GHCR·이슈 종료 금지.

## 출처와 설계 교정

| ID | 원본·증거 | 판단/조치 | 현재 검증 |
| --- | --- | --- | --- |
| SOURCE-730-3012 | [PR #747 CI #3012.1](https://github.com/planner77/masterGantt/actions/runs/39245366403), Shard3 Job118036857253, artifact12184300517; 원본 상세는 [#730 원장](ISSUE_730_FAILURE_ANALYSIS.md) | BeforeHooks14.6797s/별도120s와 본문약59.97s/60s를 구분. 마지막 target-bindings GET은 deadline 시점 취소이며 단일 API60s 장애 확정 아님 | 원본 FAIL 불변; 새 source/원격은 별도 |
| DESIGN-001 | qa_docs read-only 설계검토: 7→11fixture(+57.1%), focused6+smoke6 writes, 현재90s 결합 잔존 | Manager는 요구한 revision+6·6write 동일원본 결합 검증을 보존. smoke에서 반복 상세진입4→1을 줄이고 실제 비용을 비교한다. 비용 절감은 미리 주장하지 않음 | 로컬 전후 측정 중 |
| DESIGN-002 | 현행8-shard CI는 file 계획 선택 | 같은 spec 분할만으로 실제 shard 분산 개선 주장 금지. 로컬 별도 프로세스/역순과 실제 Actions 비용을 구별 | 원격 비용 NOT TESTED |
| LOCAL-ENV-001 | baseline 전후 비교용 별도 worktree에서 node_modules 외부 symlink 사용 시 Turbopack `Could not find the Next.js package` | baseline worktree에 별도 frozen npm ci 설치, 해당 시도 전용 server PID 종료. 제품/config/timeout 변경 없음 | 초기 시도 ENVIRONMENT/테스트 본문 NOT RUN; 독립 설치 후 재실행 |
| REVIEW-001 | qa_docs `/root/review_scope`: 신규 설명 주석 4곳이 영어인 P2 | 관련 주석만 한글화, 식별자/단언/예산 불변. Target·Assignment 원본 GET 직전 단계명도 분리 | 최종 spec SHA256 `bd65af47b59069d9094a6e02d8b6650dc83557fd639a0b89de3a91678f1eab45`; 정적 재검토 및 브라우저 재검증 대상 |
| METADATA-001 | 원본 #750 AC3항목에 `AC1/AC2/AC3` 식별자가 없어 현행 QA의 AC 추적 형식에 맞지 않음 | 원문 요구를 변경하지 않고 해당 세 줄에 번호만 추가. Work Packet의 AC_TEST_COVERAGE/DOCUMENTATION_SYNC도 현행 parser 형식에 맞춤 | 실제 QA/Required 성공으로 간주하지 않으며 원격은 NOT TESTED |
| LOCAL-DOC-001 | 현행 `docs_gate` 직접 검사에서 짧은 AGENTS N/A 사유가 최소 길이 조건에 미달하여 BLOCKED | 항목별 적용 범위와 변경 불필요 사유를 완전하게 기술 | 실제 `docs_gate` 재실행 STRUCTURAL_PASS_SEMANTIC_REVIEW_PENDING/MAPPING_PASS_SEMANTIC_REVIEW_PENDING. 문서 의미검토·원격 QA를 대체하지 않음 |
| REVIEW-002 | 제품교정 후 Work Packet의 rollback 문구가 tests-only 당시 spec/문서만 언급한 P2 | 미발행 후보는 #623/#463 spec·picker·package/lock PATCH·연결문서 전체, 정식 발행 뒤에는 immutable tag/GHCR 유지·새 PATCH 교정으로 구분 | 문서 범위 교정, 재검토 대상; 정식 발행/승인 없음 |

## 1차 소스 동결과 예비 실행 경계

tracked `src/`, `tests/`, `scripts/`, package/lockfile/next.config.ts의 1110파일을 정렬한 path→SHA256 JSON(공백 없는 정렬 key)의 SHA256은 `2a8eae19858f6256fccfa5977e246798a87cb47eafead37a6504eb2c72014a37`이다. 명령마다 시작/종료 hash를 대조한다. Next가 재생성하는 AGENTS의 heading 및 next-env.d.ts/tsconfig.json은 소유 서버 종료 후 baseline으로 복원하며 제품/config 변경으로 게시하지 않는다.

최초 후보 예비 Chromium 실행 도중 REVIEW-001 주석/추가 계측을 수정했으므로 그 실행은 최종 동일-source PASS로 사용하지 않는다. 최종 동결 소스에서 전체11case와 누적 실패 교차선정을 다시 실행한다. 예비 수치와 최종 비용/고유 case 수를 합산하지 않는다.

## 1차 동결 소스 정상 실행·비용 관측

baseline Chromium7/7 PASS와 1차 동결11/11 PASS, skipped0/retry0/flaky0이다. 아래 값은 제품 #463 교정 전 `2a8eae...` source의 불변 이력이며 교정 후 최종 후보의 실행은 별도 기록한다. `npm test -- tests/domain/issue-623-target-resource-acceptance.test.ts tests/server/db/issue-623-target-migration.test.ts tests/server/resources/issue-623-canonical-acceptance.test.ts tests/server/projects/issue-623-target-transfer-acceptance.test.ts`는 실제4files/28tests PASS(2.05s)다.

| 시간 범위 | 변경 전7case | 최종11case |
| --- | --- | --- |
| Playwright 전체 wall | 189.006251s | 312.194110s |
| fixture setup 합계 | 75.60822s | 127.33822s |
| body 합계(seed 포함) | 97.432s | 176.162s |
| 위 body 안의 seed 합계 | 64.67862s | 110.36771s |
| fixture teardown 합계 | 0.79902s | 1.47360s |
| 결합 six-write smoke body(seed 포함) | 21.784s | 28.507s |

실제 전체 wall은 **+123.187859s/+65.177%**다. 원본6-write·revision+6 결합과 독립 경계를 동시에 유지하여 fixture7→11 및 UI 저장6→12가 필요하다. 상세 재진입4→1을 줄였지만 이 단일 표본의 wall 감소를 달성한 것은 아니다. Manager의 제출 결정은 검증 경계·실패 진단을 분리한 후보로서 비용 증가를 공개하고 PR 검증에 인계하는 범위다. 성능 개선/최종 인수 완료나 Owner의 HIGH 위험 수용으로 해석하지 않는다. `seed`는 body 부분집합이므로 body와 더하지 않는다. 별도 fixture120s와 body30/60/90/45s를 구별한다.

각 source1회·같은 Node22.14.0/npm11.10.0/Playwright1.63.0 Chromium/worker1의 로컬 관측이며 운영 성능·통계적 차이나 Actions 비용 절감 보장은 아니다. [정제한 전후 비교](evidence/issue-750/cost-comparison.json)에 각 case의 원시 phase duration·예산·상태를 보존한다. 과거9파일 실패 합집합과 추가 #624 소비자의 실제 교차검증·역순/분리 실행은 다음 절에 기록한다. 실제 Actions8-shard wall/runner 비용은 NOT TESTED다.

## LOCAL-463-001 — 14case 교차검증의 기존 팝업 geometry 실패

2026-10-23 최초 교차실행은 `--workers=1 --retries=0 --max-failures=0`에서13PASS/1FAIL, Playwright wall384.561398s/exit1이다. #621의6case·#624·#719 Milestone·#725·#726·#550past·membership·Task Editor는 PASS이며 최초 실패는 `milestone-dashboard-state.spec.ts:48`의 `inputFocused && inputVisible && activeVisible` 기대true/실제false다. 원본 trace/error-context를 별도 보존했고 원본FAIL을 소급PASS하지 않는다.

원본 trace는390×900→880→900 뒤 End에서 active option0→19, list scrollTop1648, 상위panel scroll457→456을 보인다. 그러나 세 bool과 rect 값은 수록되지 않아 어느 조건이 false였는지는 UNKNOWN이다. 단독 원본 동일case는1PASS/7.7s로 비재현했다. 이는 과거 #730 실패합집합 검사 중 관측한 기존 경로의 비결정적 실패이며 #623 mutation 실패나 실제 API404 장애로 합산하지 않는다. mock Project의 WBS/KPI404도 별도 존재하므로 실제 신규 WBS 기능PASS로 전용하지 않는다.

검증 가설은1)End 뒤 반영 시점,2)resize/상위scroll의 popup 재배치,3)지속적 실제 keyboard/geometry 결함이다. 먼저 해당spec만 같은 즉시측정/모든assertion을 유지하면서 width·각bool/rect·active/마지막option ID를 실패 전 attachment와 메시지에 보존했다. 진단 source `12c7e464707d720221b99a47e9c1df7f5ad6350e5354e1bb378f1ac963047d5b`에서 fail-fast 없이5회 반복하여 구분한다. 제품/timeout/retry/tolerance/poll 변경은 아직 없다.

### 추가 실측·음성 대조와 제품 교정

위5회 진단은4PASS/1FAIL(24.6s). 실패390px에서 `inputFocused=true,inputVisible=true,activeVisible=false`, 마지막option19, active bottom879.5/list bottom879의0.5px 잘림을 관측했다. 후속 임시 음성 대조10회는9PASS/1FAIL(48.2s)이며 원래 측정과 단언을 유지했다. 실패 시 목록scrollTop1776에 `ceil(879.5-879)=1`만 더하면1777, active bottom878.5/list879로 즉시가시성true가 됐다. 이어1776으로 원상복원하고 원래false로 실패시켜 검사를 PASS로 마스킹하지 않았다. 단순 대기 부족이 아니라 native scrollIntoView의 소수점 경계에 남는 실제 clipping이 원인이다.

ui_ux `/root/popup_bounds_design`은 기존 keyboard 가시성 원칙의 Design Delta B로 목록scroll만 한 방향 보정하는 설계를 검토했다. frontend는 기존 scrollIntoView 뒤 option/list null·contains guard 및 현재 rect 기반 top/else-bottom Math.ceil 보정을 추가했다. focus/선택·popup·상위viewport/Gantt·API를 추가 조작하지 않는다. 큰 항목의 완전 containment까지 새로 보장하지 않는다. 임시 DOM 프로브는 제거하고 원래의0허용오차/즉시 단언·진단 attachment를 보존했으며5폭 Home/ArrowDown/Up를 같은 기존case에 추가했다. 제품교정 후 같은case10회는10PASS(55.5s)다. 과거FAIL과 진단반복을 신규 고유PASS case로 합산하지 않는다.

제품 버그 교정이 포함되어 후보PATCH0.130.1/package·lock을 동기화했다. `release_required=true/release_authorized=false`로 전환하며 향후 Owner의 명시승인 전 merge/tag/GHCR는 진행하지 않는다. 기존tests-only0.130.0 착수 계획과 수치는 그때의 이력으로 보존한다.

## 최종 재동결

1110파일 같은 범위의 최종 fingerprint는 `e7a01490ad65655aebd36fa86fe381cf0bd14dfb11f9183c3869269ec1c92891`이다. #623 spec `bd65af47b59069d9094a6e02d8b6650dc83557fd639a0b89de3a91678f1eab45`는 유지, 제품 picker `521fe751eb90c1ff37411b665bf611a797593e3b9adb90fb4d3c27746510737b`, #463 spec `4244a49793e02fe5e31701d902548353864ce3a49d7cc9ee01caef35c4f5f80b`다. 명령 시작/종료마다 재대조하며 #623전체11·cross14·picker직접소비자11·역순4·로컬2part4·의도적실패cleanup을 새 소스에서 수행한다. 이전 단독/예비/교정 전PASS는 이 최종 집합의 PASS로 이월하지 않는다.

## 누적 실패 합집합과 영향

#730 원장 §23까지 9파일: `milestone-dashboard-state`, `milestone-management-persistence`, `issue-719-contextual-help`, `issue-623-resource-mvp`, `issue-726-task-logistics`, `project-resource-memberships-persistence`, `project-task-editor-persistence`, `issue-621-resource-target`, `issue-725-process-workareas` (모두 `tests/e2e/*.spec.ts`)이다. Hook/lint/npm/typecheck 등 비브라우저 원인은 새 E2E 실패로 세지 않는다. #624는 seed 직접 소비자라 추가한다. 원본 Run/Attempt별 FAIL·CANCELLED·NOT RUN은 원본 원장에 보존한다.

## 검증/미해결·승인 경계

baseline main `d2a82b66`, app0.130.0→후보0.130.1. 변경은 #623/#463 spec·공용 picker 경계·package/lock·문서이며 공통 fixture·CI/shard/권한·데이터/산식 계약은 불변이다. 로컬 실행/소스 지문/전후비용/controlled-negative/리뷰 및 충돌 결과를 아래에 추가한다. 신규 PR이 없어 기존 #750 미해결 review thread는 N/A(검색 결과0)이며 PR 생성 후 현재 Head로 다시 조회한다.

`risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`. Agent 사전 검토는 최종 Trusted QA나 Owner 승인 아님. quality/e2e/docker·Trusted·Manager ACCEPT/Actions 비용 NOT TESTED, MERGE_READY=BLOCKED. 요청대로 PR CI 시작 후 모니터링하지 않으며 병합·Main/GHCR·Release·Issue 종료를 수행하지 않는다.


## 최종 동일 소스 실행 결과 — 로컬 빠른 검증

최종 fingerprint `e7a01490ad65655aebd36fa86fe381cf0bd14dfb11f9183c3869269ec1c92891`의 1110파일 시작/종료 대조는 모든 실행에서 일치했다. Node22.14.0/npm11.10.0/Playwright1.63.0, Chromium worker1/retry0/skip0/flaky0이며 테스트·제품 소스를 실행 중 바꾸지 않았다.

| 범위 | 실제 결과 | 증거/경계 |
| --- | --- | --- |
| Domain/서버·picker context·version 검사 | 6files/37tests PASS, 2.00s | 기존 #623 28검사 + context2 + version7 |
| #623 전체 | 11PASS, 349.736872s | 실제 HTTP/SQLite, 기존6write·revision+6·Golden/Excel 유지 |
| 누적 실패 합집합 교차 | 14PASS, 401.732138s | #621 전체6·#624 및 #730 과거 실패 파일; #623은 위 정상 실행에서 별도 포함 |
| picker 직접 소비자 | 11PASS, 61.592217s | #463 나머지6 + #462 mock4/actual1 |
| 독립 경계 역순 | 4PASS | 화면복귀→binding→Resource/Assignment→WBS, 각 별도 프로세스 |
| 로컬 2part 분리 | 2+2PASS | 2/2→1/2, 교집합0·합집합 focused4, Actions8-shard 실증 아님 |
| picker 교정 반복·이미지 | 10+1PASS | 반복200개의 즉시 rect/focus/index 관측; 이미지용1회 별도 |
| 의도적 실패 cleanup | 2회 예상exit1/cleanup PASS | 최초검증 및 raw 보존 재수집; 소유 프로세스·격리 DB/dist 잔존0, trace/diagnostics 보존 |
| 정적 검증 | scoped ESLint·tsc·version·markdown·diff PASS | 실제 명령 결과, 원격 Required3 대체 아님 |

정상11+교차14+직접11은 **고유36case(실제 HTTP/SQLite24, mock12)**다. 역순4+로컬2part4+교정반복10+이미지1=추가19실행이며 고유수에 더하지 않는다. cleanup2회는 계획된 음성 대조이며 제품 회귀 실패나 PASS case 수에 합산하지 않는다. 교정 전13PASS/1FAIL·진단5회·원상복원 음성대조10회·동결 전 예비 실행은 이전 source 이력으로 유지한다.

[실행·명령/소스·cleanup 영수증](evidence/issue-750/local-validation.json), [원시 ID와 revision·Golden Excel](evidence/issue-750/canonical-identity.json), [0.5px 진단·원상복원 FAIL·교정200관측](evidence/issue-750/popup-bounds-verification.json)에 정제한 합성 자료만 저장했다. raw trace/error-context/로그/DB는 Git에 넣지 않았다. 마지막 cleanup의 raw trace/error-context를 test-results 밖에 복사하고 hash/size를 영수증에 남겨 이후 reporter 정리에 잃지 않도록 했다.

### 최종 비용 비교

| 시간 범위 | baseline7case/0.130.0 | 최종11case/0.130.1 |
| --- | --- | --- |
| Playwright 전체 wall | 189.006251s | 349.736872s |
| fixture setup 합계 | 75.60822s | 140.62427s |
| body 합계(seed 포함) | 97.432s | 199.684s |
| 위 body 안의 seed 합계 | 64.67862s | 126.37561s |
| fixture teardown 합계 | 0.79902s | 1.53401s |

각 source 로컬1표본의 최종 증가는 **+160.730621s/+85.040%**다. fixture7→11(+57.1%), 독립6write+필수결합6write로 UI 저장6→12이며 안정성 진단 경계를 위한 비용이다. 이전 source의+65.177%를 최종값으로 보고하지 않는다. seed는 body 부분집합이고 시간 합계는 runner wall과 같지 않다. 원격8-shard wall·총runner 비용·통계적 개선은 NOT TESTED다. [최종 case별 phase/예산 비교](evidence/issue-750/cost-comparison-final.json)와 [초기 불변 비교](evidence/issue-750/cost-comparison.json)를 분리한다.

### UI 증거·리뷰·충돌 처리

[교정 전](evidence/issue-750/popup-before.jpeg)과 [교정 후](evidence/issue-750/popup-after.jpeg)는 390×900 End 직후 원본 trace JPEG다. [추출 hash/시간](evidence/issue-750/popup-images.json)을 보존했다. 화면 배경의 프로젝트 없음은 합성 mock Project WBS/KPI404이며 실제 WBS 기능 PASS 근거가 아니다. 0.5px 판정은 이미지가 아니라 rect JSON에 근거한다.

REVIEW-001 주석·단계명과 REVIEW-002 rollback 범위를 수정했다. ui_ux의 최종 read-only 코드/JSON 비교는 지적0/PASS이며 실제 브라우저 독립 재실행을 주장하지 않는다. qa_docs `/root/review_scope`의 최종 read-only 사전검토는 PASS/미해결P1·P2 0건이다. Reviewer가1110파일 지문·원본 reporter/Unit 로그·비용·역순/part 집합·cleanup raw hash/size·합성 JSON/JPEG를 직접 대조하고 REVIEW-001/002 해결을 확인했다. PR 생성 후 현재 Head review thread/mergeability는 Issue STATUS 영수증으로 기록한다. 원격 main은 `d2a82b666836b28bf392215993240c0fae2d4fdc`이며 해당 baseline에서 분기해 로컬 충돌은 없다. 새 PR 전 기존 #750 PR 검색0건으로 기존 미해결 스레드는 N/A이고 이후 새 PR을 재조회한다.

현재 독립 Agent 사전검토는 OWNER_MANAGED의 최종 Owner QA/Manager ACCEPT가 아니다. HIGH 범위의 비용 증가·제품교정·PATCH 후보에 대한 Owner 위험 수용/정식 release 승인은 아직 없고 MERGE_READY=BLOCKED다. 요청 범위는 PR CI 시작까지다.

## REMOTE-AUTH-001 — PR 게시 경로 복구

로컬 커밋 뒤 git push는 `Invalid username or token`으로 실패하여 원격 branch/PR CI를 만들지 못했다. 자격증명을 출력·변경하지 않고 기존 연결된 GitHub의 blob/tree/commit/branch API로 동일 파일 바이트를 게시한다. 로컬 검토본과 원격 tree SHA 및 최종 parent/base를 교차 확인하고 PR을 생성한다. 이 인증 실패는 제품/테스트 FAIL이나 PR CI FAIL로 세지 않는다.
