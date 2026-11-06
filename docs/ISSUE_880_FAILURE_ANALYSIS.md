# Issue #880 — 누적 실패·검증 원장

Primary Issue: [#880](https://github.com/planner77/masterGantt/issues/880). Source of truth: [PR CI 실패 처리](PR_CI_FAILURE_TRIAGE.md). 갱신일: 2026-11-07.

## 현재 판정 — R1

PR #883 원본 Full #3533.1/42301302919.1은 qa_required 독립 줄 누락으로 FAIL했다. 실제 Quality/E2E/Docker 구현은 SKIPPED/NOT RUN이다. 문서 하단 R1에 원본 출처·실제 P2 RED·보완 중 실패와 재검증을 누적한다. 새 Head 원격/Owner/Manager는 NOT TESTED이며 요청 종료점은 새 Full CI 등록이다. 다음 최초 등록 전 이력은 당시 snapshot으로 보존한다.

## Run/Attempt 전체 목록

착수 시 GitHub Issue 본문/전체 댓글 및 `880` 관련 PR 검색 결과 기존 PR·CI 이력은 없다. 이는 제품 테스트 PASS가 아니다. 신규 PR Full CI 시작까지만 수행하며 이후 결과는 수집하지 않는다.

| 범위 | 원본 실행 | 결과 및 경계 |
| --- | --- | --- |
| 기존 PR CI | 해당 없음 | #880 최초 구현, 이전 원격 실패 미관측 |
| 신규 PR CI | 본 커밋은 원격 등록 직전 snapshot | 실제 PR/게시 Head/Run은 Issue STATUS 댓글에서 연결; quality/e2e/docker/Trusted NOT TESTED |
| 로컬 의존성 설치 | npm ci --ignore-scripts=false --no-audit --no-fund | 446 packages, exit0; 원격 install/audit PASS 아님 |

## 누적 실패 파일 및 Cross-run 매트릭스

원격 실제 실패 파일 합집합은 아직 없다. 로컬 구현·진단 실패가 생기면 아래에 원본/원인/교정/재검증을 추가하며 최종 PASS로 덮어쓰지 않는다.

## 사건 기록

- 착수 환경의 기존 worktree에 unrelated tracked/untracked 변경이 있어 그대로 보존하고 최신 main `22960452` 기반 별도 worktree를 생성했다.
- 문서 탐색에서 존재하지 않는 `ISSUE_879.md`, Next `.mdx` 경로를 읽으려 한 명령 exit2는 파일 탐색 오류다. 실제 Packet은 `ISSUE_866.md`, Next 설치 문서는 `.md` 경로를 확인했다. 제품·CI 실패로 계산하지 않는다.

### L-001 — 초기 전체 TypeScript narrowing 실패

- 명령: `npx tsc --noEmit`; exit2, `schedule-view-projection.ts`88/155/165/170 TS18048/TS2345 4건.
- 원인: `never` 반환 arrow helper의 control-flow narrowing이 적용되지 않았다. `function fail(code): never` 선언으로 바꿔 동일한 fail-closed 런타임 계약을 유지했다.
- 보완 후 projection Unit12/12·ESLint PASS. 최종 공용 typecheck는 별도로 실행한다. 당시 다른 구현 Agent의 tsc가 중복 실행된 사실도 보존하며 중복 결과를 고유 검증으로 합산하지 않는다.

### L-002 — UI 초기 ESLint refs 규칙

- 최초 UI ESLint에서 render 중 api ref 직접 읽기 규칙 위반이 검출됐다. frontend는 callback `readApi`를 통해 layout effect에서 읽도록 바꿨다. 원본 로그 `/tmp/issue880-ui-eslint*.log`는 로컬에만 보존하며 재검증은 최종 LFF에서 별도 기록한다.
- 사전 기술검토에서 (1) projection 예외가 전체 ErrorBoundary로 전파됨, (2) 동일 탭의 global Group 명칭/소속 변경 후 stale source 가능성, (3) 원본 Editor 저장 후 hidden WBS로 focus 복귀할 가능성을 확인했다. frontend가 View 오류 처리·workspace 활성/Editor 복귀 재조회·원본 Task 기반 표시행 focus 경로를 보완 중이다. 실제 실행 전 해결 PASS로 단정하지 않는다.

### L-003 — source test cleanup TypeScript 반환

- 최초 source API 전체 typecheck에서 테스트 cleanup callback `()=>writer.close()`가 Database를 반환하여 TS2322 1건을 검출했다. `()=>{writer.close();}` void wrapper로 교정했다. 읽기·권한·자료 로직은 불변이다.
- 보완 뒤 source/inventory/기존 물류 links/private visibility4파일42개 PASS, 소유8파일 ESLint0error/0warning. 초기2파일27개 PASS는 이42개의 부분집합/구소스이므로 합산하지 않는다. 최종 공용 typecheck는 별도다.

### L-004 — 자동 Pre-PR 영향 매핑 BLOCKED

- 실제 fast/targeted CLI 실행: `.prepr-reports/issue880-initial-fast/{report.json,SUMMARY.md}`, `.prepr-reports/issue880-initial-targeted/{report.json,SUMMARY.md}`. 둘 다 exit1/BLOCKED, UNKNOWN6/missing0, sourceStable=true. 선택된 테스트41개(종류별 고유 파일)지만 실제 하위 검사 실행0이다.
- UNKNOWN: 신규 `src/contracts/schedule-views.ts`, `schedule-view-panel.css/.tsx`, `src/lib/i18n/catalogs/schedule-views.ts`, `src/lib/i18n/index.ts`, `tests/e2e/fixtures/schedule-views.ts`. Manager가 아래 생산자/소비자를 명시하고 수동 선정 검증을 실행한다. 자동 도구 결과는 BLOCKED로 유지하며 catch-all/정책 매핑 우회·remote Full 범위 축소 없음.
- 보고서의 six-runner 텍스트는 기존 도구의 역사적 설명이다. 현 원격 Full은8 Chromium shards/Required3이며 CLI 보고서를 원격 runner 동등성 근거로 사용하지 않는다.

### L-005 — 첫 실제 Chromium 탐색의 준비 관측 실패

- 명령: `npx playwright test --config tests/config/playwright.config.ts tests/e2e/schedule-views.spec.ts --project chromium --workers=1 --retries=0 --max-failures=0` (당시3case). 실제2 PASS(45.2s/21.7s),1 FAIL(21.2s), source가 작업 중인 탐색 결과다.
- 실패: 85Task 가상화 측정에서 scrollHeight>clientHeight633을 기대했지만 실제633. error-context에는 source loading이 남아 있어, 단순 panel visible을 자료 준비 완료로 사용한 fixture 관측 오류로 분류한다. 실제 window의 data-ready=true 및 logical rows>=85를 기다린 후 동일 scroll/window 단언을 유지한다.
- 원본 context/trace는 `test-results/schedule-views--880-85개-일반-f869b--window와-검색·계층-필터의-동일-원본-조회-chromium`이며 raw 파일은 로컬 보존한다. 다음 실행 전 별도 폴더로 보존하고 원본 실패를 덮어쓰지 않는다.
- 정적 QA의 추가 좁은 화면 지적: sticky 이름열480px이390px 작업면에서 Chart를 가릴 수 있어 실제 Chart 노출/가로scroll을 확인하고 adaptive 이름열 폭을 보완한다. 이전 문서 overflow0/2 PASS를 mobile Chart 수용 PASS로 확대하지 않는다.

### L-006 — 최초 전체 Unit3건 및 로컬 lint 오염

- 동결 후보의 `npm test` 최초 전체: 303파일 중299 PASS/3 FAIL/기존1 SKIP, 3,735 PASS/3 FAIL/기존3 SKIP, 56.27초(06:21:30 시작). 원본 `.prepr-reports/issue880-manual/unit.log`.
- 직접1: `tests/scripts/e2e-shard-planner.test.ts:110` exact plan 전체목록 비교, 기대147spec/실제146spec. 신규 `tests/e2e/schedule-views.spec.ts`의 정적8shard plan 등록 누락이다. infra가 현행 생성 규격에 맞춰 plan/정확 기대값만 갱신한다.8shard/Required/skip/retry 강도는 유지한다.
- 직접2: `tests/server/llm/llm-boundary.test.ts:65` real source graph 음성검사5,000ms timeout(실제5,806ms). 직접3: `tests/server/projects/edit-authorization-security.test.ts:105` scrypt 정상/오류/손상 검증5,000ms timeout(실제5,013ms). 동일 시점 full Unit/lint/Chromium 병행으로 자원경합 가능성은 가설이며 기존 보안 코드/timeout/assertion은 수정하지 않는다. 제한된 재현 후 동일 후보 전체검증은 실행을 직렬화하고 필요시 local worker budget을 제한해 환경 차이를 명시한다.
- 같은 시도 `npm run lint`는 `output/issue-880/initial/playwright-report/trace/assets/*.js` 등 보존한 raw 출력까지 검사했다(Babel500KB deoptimisation 관측). root가 자신이 시작한 lint PID2017688을 SIGTERM해 중단했다. 결과는 PASS가 아닌 CANCELLED/INCOMPLETE이며 raw 보존을 worktree 밖 `/tmp/issue880-exploration`으로 옮기고 lint를 재실행한다. eslint/CI policy ignore를 변경하지 않는다.
- 이때 frontend가 literal View만 기존 i18n `t` 경계로 정리한 작은 후속 변경을 전달했다. 최종 동결지문과 실제 검증은 재수집하며 이전 결과를 최종 source PASS로 승계하지 않는다.

### L-006 보완 — 정적8shard plan 등록

- 변경2파일: `tests/config/e2e-shard-plan.json`, `tests/scripts/e2e-shard-planner.test.ts`. 신규 schedule-views만Shard3 등록, 원래146개 배치 보존, 개수 `[19,18,19,18,18,18,18,19]` 및 발견147spec exact equality를 유지했다.
- 선택 근거: Shard2~7은18개 공동최소이고 과거 projectedMs가 가장 작은3번을 선택했다. generatedAt/sourceRunIds/metrics/projectedMs는 역사적 값 그대로이며 새 실행 성능으로 해석하지 않는다.
- 변경 후 planner/optimizer2파일12개 PASS, 변경 test ESLint PASS. 새 원격 Full8은 NOT TESTED. CI_CD/REMOTE_VALIDATION/TEST_PLAN·Packet 문서 동기화, gate/skip/retry/timeout 정책 변경0.

### L-007 — 4case 확장 실행의 GET/Mutation permission 오라클 차이

- 새4case 실행의 첫2case PASS(30.3s/19.3s),3번째 FAIL(26.1s). strict scope/density·WBS X120/Y38·column 왕복,85Task End/Home/가상화·검색 단언은 통과한 뒤 마지막 전체 DTO 비교에서 실패했다.
- 비교 원본: imports POST mutation 응답permission=edit, 최종 canonical GET permission=readonly, 다른 canonical 값 차이0. 분류 TEST_CONTRACT. Import 직후 canonical GET baseline을 따로 확보하여 같은 GET→GET의 전체 DTO strict equality로 바꾸며 권한/데이터 assertion을 제거하지 않는다.
- 실행 중 frontend의 selected anchor axis 준비 guard/dependency2줄 변경이 있어 이 run은 동결source 성공으로 승인하지 않는다. 실제 원본/시작·끝 지문을 보존하고 axis guard 포함 제품을 엄격 동결한 뒤4case 재검증한다. 기능 결과와 source 안정성을 구분한다.

### L-006 제한적 timeout 재현

기존 원본 source graph/password2파일만 동일5초/기존모든assertion으로 실행: `npx vitest run --config tests/config/vitest.config.ts tests/server/llm/llm-boundary.test.ts tests/server/projects/edit-authorization-security.test.ts`,13개 PASS/exit0,3.18초(06:23:28 시작). 최초 전체 동시 실행의 두timeout은 이 재현에서 비관측이며 환경 원인을 확정하지 않는다. 최종 전체 Unit은 병행 부하를 제거하고 local maxWorkers2로 실행하며 원격 CI 설정은 변경하지 않는다.

### L-008 — Group stale 검사의 부분문자열 오매칭

- 확장4case 원본 최종2 PASS/2 FAIL,3.6분. L-007 외4번째의 actual Editor PATCH/If-Match·동일표시행 focus·Group 갱신 및 Task row3→2는 통과한 뒤 `not.toContainText('Group 2')`에서 실패했다.
- 화면 text가 새 Group명 뒤 작업 개수 `2개 작업`을 붙여 `...Group 2개 작업`이 되어, 삭제한 Group2 원본의 존재와 무관하게 부분문자열이 매칭됐다. 분류 TEST_MATCHER. 실체 `entityId=g2` 행0과 `entityId=g1`의 새 이름을 검사하도록 교정하여 stale 검사 대상을 명확히 한다. stale 검증 의미를 축소하거나 제품 값을 숨기지 않는다.
- raw 원본·로그·before/after source 지문은 별도 보존하며 다음 axis guard 포함 엄격 동결4case 실행과 합산하지 않는다. 브라우저 직접 원본 실패 합집합은 신규 schedule-views spec 내 준비/permission 비교/Group 식별 경계다.

### L-009 — View 전환 전 density setup의 native scroll 준비 경합

- 다음 엄격 동결4case 실행은3 PASS/1 FAIL,3.2분. 신규 실제5폭 Chart hit/dateX·폭,source 오류/역전,Editor/canonical 저장 및 Group 변경은 PASS했으며 source 지문 안정성을 별도 확인한다.
- 실패는3번째 View 전환 **전** WBS 준비의 `chartLeft=120` 기대/실제0(26.8초)이다. 직전 run 동일 setup·왕복은 통과했지만 density 변경 직후 pending anchor/layout 관측 없이 native scroll을 기록한 준비 경합 가능성을 확인했다. 실제 View 전환의 상태 복귀 FAIL과 구분한다.
- Manager는 기존 `waitForGanttReadiness`의 현재 canonical/axis/Core-native/currentWork·안정 frame 관측 후 동일120/38을 적용하도록 fixture 수정을 승인했다. 오래된 SETTLED receipt 하나만으로 준비를 승인하지 않는다. timeout/retry/허용오차·최종 viewport exact equality를 유지한다. 먼저 실패case 한정 진단, 이후 최종4case 동일소스 검증으로 수렴한다.

### 실행 순서 조정 — 최종 검사 직렬화

원본 추가4case 시작 직후 Manager의 직렬화 지시를 반영해 fixture 준비 단계에서 SIGINT했다(exit130,1 interrupted/3 NOT RUN). 실제 assertion FAIL로 합산하지 않으며 `/tmp/issue880-exploration/pre-targeted-interrupted`에 보존한다. 신규3번째 단독 진단 후 제품/test source를 동결하고 Unit(maxWorkers2)→build→type/lint/정책→신규4case+기존scale/fullscreen/Task Editor41case의 총45개를 workers1/retries0/max-failures0 한 묶음으로 검증한다. 원격8shard/Required3 정책을 바꾸지 않는다.

### L-010 — 빌드 산출물·중단된 fixture의 고아 프로세스가 전체 lint에 포함됨

- 최종 직렬 후보의 Unit3,738 PASS/기존3 SKIP,production build+runtime-tools PASS,전체typecheck PASS 후 `npm run lint`가 exit1이었다. 소스 지문1310입력은 시작=종료였다.
- 전체로그를 파일별로 분류한 실제778 error는 전부 생성물: 중단된 fixture의 `.next-e2e-isolated-9afc92ad-9f20-4500-a8f3-eff69877a3f7`763건과 직전 build가 만든 `.runtime-tools`15건. 제품/src/tests/scripts의 lint error0이며 기존 warning은 유지한다. 총9,053문제=778error/8,275warning 원본은 `.prepr-reports/issue880-manual/final/lint.log`에 보존한다.
- 중단 fixture의 detached Next PID2051285/PGID2051285,port37379 및 child2051531/2051708이 남아 있었다. 해당 실행 소유 테스트 Agent가 그 process group만 종료하고 생성dist/DB를 원본 보존한다. root의 사후lint종료 시도는 프로세스가 이미exit1하여 `No such process`였다. 이를 CANCELLED로 바꾸지 않는다.
- root가 build 이전에 lint를 수행하거나 산출물을 분리했어야 했다. runtime-tools는 `/tmp/issue880-build-runtime-tools`로 원본 보존하고 소스/정책은 변경하지 않는다. 고아실행 종료/생성물 분리 후 lint와 미실행 정책검사만 재실행한다. 동일소스에서 이미 성공한 Unit/build/typecheck를 중복합산/반복하지 않는다.

## 진단·검증 선정

새 pure projection/읽기 API+SQLite·HTTP/실제 View Chromium을 직접 검사한다. 인접 WBS native scale/fullscreen/selection·viewport·Editor/visibility/Resource·설비 소비자는 변경 영향에 맞게 선정하고 미실행을 명시한다. 원격 Full Required3/8 shard가 공식 전체 회귀다. 원본 failures·미실행·취소·동결 소스 지문과 재검증 명령을 분리한다.

## 최종 source 검증 진행

- 3번째 readiness 한정진단 PASS(exit0,test28.1초/전체56.0초),9파일 시작/종료hash동일. source93 canonical/일반Task85를 scoped logical86행/DOM23행으로 표시했고 scrollHeight2816/client578,End키 마지막행focus231.8ms, density32·WBS X120/Y38·scope/columns exact보존·Project write0였다. 이 수치를 후속45case 측정으로 오인하지 않는다.
- 제품/test/script/db/package/Next config1310입력 SHA256 `a3a27d900b6ee2d6573293f2b017d301511fbae7170cc6a50a201720e03ad09f`, 첫검증/continuation 모두 sourceStable=true이며 두지문 동일. 전체Unit3,738 PASS/기존3 SKIP(302파일PASS/기존1SKIP,local maxWorkers2),build/runtime-tools·전체typecheck PASS. L-010 생성물을 분리한 이후 전체lint0error/기존18warning 및 version/discovery303Unit·888browser/Markdown412/cache/Pythonpreflight11 PASS다.
- 원본 full default-worker의 timeout2건과신규spec누락1건은 L-006에 불변보존하며 최종소스전체재검증에서실제PASS했다. local worker budget은2로제한했고GitHub CI worker/8shard 정책변경0이다.
- 정제 실행·소스변경22입력sha는 [local-validation.json](evidence/issue-880/local-validation.json)에기록한다. 신규4+기존scale/fullscreen/Editor41의45case 단일Chromium을 workers1/retries0/max-failures0로실행해45 PASS/FAIL0/SKIP0(exit0,6.8분)를 확인했다. 신규4case는22.3/17.6/26.0/21.3초이며 이후1310입력 전체hash도동일했다. 최종성능은 logical86/DOM23·scroll2816/client578·키보드End focus371.6ms다. 앞선단독231.8ms와분리하며장기성능/8runner성능개선을주장하지않는다.

### 게시 직전 자동 Pre-PR 최종 상태

`.prepr-reports/issue880-publish-{fast,targeted}/{report.json,SUMMARY.md}` 두 실제 실행은 exit1/BLOCKED,sourceStable=true,UNKNOWN7/missing0이다. L-004 초기6개에 새 명시 shard 등록 `tests/config/e2e-shard-plan.json`의 자동 영향 매핑 미등록1개가 추가됐다. 초기6개 기록은 수정하지 않는다. 이 추가 생산자는 planner/optimizer12개 및 전체Unit/147spec exact-once로 명시 검증했으며 Packet 매핑에 포함했다. 자동검사 자체PASS나정책완화는없다.

## 같은 최종 source와 다음 PR CI

구현·명시 수동 Local Fast Feedback 및 문서 동기화를 마쳤고 최종 사전 기술검토·미해결 리뷰/충돌·게시 동등성 확인 후 한 번의 Ready PR Full CI를 시작한다. 정상 종료 후 ownNext/3100listener/isolateddist/DB 잔여0을 확인하고 raw를 `/tmp/issue880-final-combined`에 보존했다. 자동 생성 next-env.d.ts/tsconfig.json/기존 Issue461 picker geometry는 `/tmp/issue880-generated-final`로 보존 후 baseline bytes로 복원했으며 제품/test/script source1310은 불변이다. 새 Head 원격 결과/Owner/Manager는 NOT TESTED이고 병합·GHCR·Finalizer·Issue 종료는 범위 밖이다.

별도 read-only `/root/preqa`는 같은1310입력/변경22개 drift0,실제원본로그·45case/정제receipt·문서/정책을 교차 검토해 범위한정 PRE_QA 기술검토 PASS/직접P1·P2=0을 반환했다. 이는 인간 QA_FINAL·Trusted/Owner·Manager ACCEPT가 아니다.

게시대상 raw 제외: task 전용 `output/issue-880`의 로그/지문은 `/tmp/issue880-local-output`에 원본 보존하고 커밋에는 정제 JSON4개·PNG3개 및 요약 검증JSON만 포함한다.

## L-011 — 원격 git 인증 만료와 동일 Tree GitData 게시 대안

- 최초 로컬 구현 commit: `f88e63461c5b48ef07269667f1be00d29c38bb75`,44files. infra가 변경 검증입력22개·PNG3개의 commit blob SHA 동등성과 clean worktree/main lease를 확인했다.
- `git push`는 `Invalid username or token` / `Authentication failed`,exit128이었다. shell의 git HTTPS/gh 저장 인증이 만료됐으며 해당 시점 원격 branch/PR/CI는 생성되지 않았다. 제품/테스트 FAIL이나 GitHub Actions FAIL로 합산하지 않는다. credential 원문은 출력·기록하지 않는다.
- Manager는 연결 GitHub 앱의 GitData API로 같은 최종 파일 Tree를 게시하는 대안을 승인했다. 이미 만든 content-addressed blob은 실행/branch가 아니며 원격commit/branch/PR 전에 이 운영 실패를 문서·원장에 반영한다. 전역 git/gh 인증이나 Secret을 임의 변경하지 않는다.
- GitData create_commit 도구는 author/date를 지정하지 못하므로 원격 commit SHA가 로컬 SHA와 달라질 수 있다. 원본 로컬commit을 보존하고 최종 로컬 Tree SHA·변경입력22개/PNG3개 blob·부모 main을 원격에서 재검증한 뒤 실제 PR 원격Head를 본문/CI 조회/Issue STATUS에 사용한다. SHA 동일성을 추정하거나 결과를 혼합하지 않는다.
- 본 커밋은 GitData 재개 직전 snapshot이다. 최종 로컬commit/원격Head·Tree 동등성/PR/CI Run·attempt는 Issue STATUS에서 이어 기록한다. 원격 gate/Owner/Manager ACCEPT는 여전히 NOT TESTED다.


## R1 — PR #883 Full #3533.1 및 미해결 P2 보완 (2026-11-07)

본 절부터는 최초 PR 등록 뒤 사용자의 CI 실패 보완 요청으로 재개한 이력이다. 앞의 등록 전 snapshot과 L001~011은 당시 근거로 보존한다. 기존 로컬 PASS를 새 Head/원격 PASS로 바꾸지 않는다.

### 원본 Run/Attempt 및 파생 실패

- 원본 Full: [#3533.1 / Run42301302919](https://github.com/planner77/masterGantt/actions/runs/42301302919),pull_request/opened,attempt1,최종 FAILURE. Head `f9bdd26df8196c11f24b4ab90223a3ada00d4cbd` / base `229604522969133d1ccc6de0477e373252670c86` / 등록 PR test merge `0d4ecddd7f46550cf8caf7c4e9cacb9547734d51`. 원본 ci-pr-source artifact와 GitHub 전체 실행 provenance는 별도 정제 증거로 추가한다.
- FAST_DEVELOPMENT #288.1/42301302977 SKIPPED는 공식 회귀 근거가 아니다. 현재 조회에서 metadata run0이며 infra가 pagination/attempt/Trusted 전체를 교차 확인한다.
- 직접 실패: QA Preflight Job128179660470,step4 `원본 base SHA의 QA Preflight 실행 (read-only)`,2026-11-06T22:01:14Z. FAIL2는 QA_REQUIRED `qa_required: 정확히 한 개의 선언 필요` 및 그 파생 PATH_POLICY `위험도/QA 선언 오류를 먼저 수정`. elapsed2.107초,DEFERRED5. PRIMARY_ISSUE/RISK_LEVEL/QA_METHOD/선택release플래그/ISSUE_AC/DOCUMENTATION_SYNC는 PASS였다.
- 파생: Fast Gate128179832051,Required Quality128179955262/E2E128179955381/Docker128179955126,QA Final Automated128180005623 FAILURE. 실제 Type128179833063/Vitest128179833274/ESLint128179833435/Policy128179833853/Build128179957482/Chromium128179957032/Docker128179956983는 SKIPPED/NOT RUN이다. 원본에는 실제 테스트 assertion 실패가 없다.
- 원본 Preflight artifact: [13543668166](https://github.com/planner77/masterGantt/actions/runs/42301302919/artifacts/13543668166),ZIP SHA256 `093b0c9b71a6b8bf02f13db399198f1bdd304a8971acf6bac711aa3bbca7bf23`. 원본 FAIL은 불변이다.

### F880-CI-001 — PR 기계 선언 형식 누락

분류 POLICY_CI/PR_METADATA. 본문의 `qa_required=true`는 prose의 backtick 안에만 있고 `_unique_field`가 요구하는 독립 줄 선언이0개였다. release_required/release_authorized도 선택 parser에서 선언으로 인식되지 않은 상태였다. 중복 선언/지원값 오류를 후보로 배제했고 inline 선언0개가 exact원인임을 재현했다.

실제 PR 본문·Issue AC·Head/base·전체 변경 파일44개·원본 Head Packet을 unchanged base `qa_preflight.check`에 replay했다. `/tmp/issue880-preflight-replay.py`: before FAIL2 `[QA_REQUIRED,PATH_POLICY]` → 독립 줄 `qa_required=true`, `release_required=true`, `release_authorized=false`를 데이터에만 추가한 after PASS(실패0)/최종QA5개DEFERRED,exit0. local `.prepr-reports/issue880-rework-r1/preflight-{before,after}.json`에 정제 결과를 보존했다. rawPR본문/로컬 재생 harness는 공개 소스 실행이나 서버 원격 QA PASS가 아니다. 검증기/정책은 수정하지 않는다. PR 본문은 게시 직전 한 번에 교정한다.

### 리뷰 실제 실패 집합 및 보완 계획

| 실패/리뷰 ID | 원본 증상·파일 | 전체 이력 관계와 검증 계획 |
| --- | --- | --- |
| F880-CI-001 | 실제 PR 본문 qa_required 독립줄0,Preflight128179660470 | 이전 로컬은docs_gate만 확인해 이 metadata 계약을 놓쳤다. 전체 base preflight에 실제 payload replay하여 sibling flags/docs/AC까지 확인한다. |
| R880-P2-001 · discussion4498098345 | project-gantt.tsx WBS복귀가firstTask single-selection gesture로다중선택축소 | 이전45case의 WBS instance/viewport 검사에는 실제 multi-selection·Copy왕복이 없어 검출되지 않았다. 수정 전 실제선택/Copy RED,같은 canonical 전체선택/anchor/clipboard 유지·readonly/no-write 회귀를 확장한다. |
| R880-P2-002 · discussion4498098352 | schedule-view-panel.tsx blocked/refresh/active source무효화로canvas제거·scroll0 | 이전검사는Editor focus/단일PATCH와WBSviewport였으며 projected뷰nonzeroX/Y재조회 보존이빠졌다. 수정 전 Editor/refresh/peer 재조회 RED,stale/권한실패 차단·의미앵커/최신입력/축변경 음성을 함께검증한다. |

원격 실제 테스트 실패 합집합은 아직0이고 metadata직접실패1종과 제품리뷰2종을 구별한다. 누적 로컬 실패 L005/L007/L008/L009의 동일 schedule-views fixture/오라클 경계도 새 후보의 재검증 합집합에 포함하며 timeout/retry/허용오차·skip·Required3/8shard를 완화하지 않는다. 현재 재현/보완 중,새 Head QA/CI/Owner/Manager는 NOT TESTED다.


### R1 원격 출처 전체 대조 완료

[ci3533-source.json](evidence/issue-880/ci3533-source.json)은 관련PR883만·branch Full1/metadata0/FAST1,모두attempt1을 확인했다. Full23jobs=SUCCESS3/FAILURE6/SKIPPED14이며 취소0·실제품질/E2E8/Docker구현실행0이다. 원본 source artifact13544197575는ZIPdigest/JSON정적읽기만으로 repository/run/attempt/PR883·Head/base/test-merge와두부모(base2296+headf9)·Tree69930b86fb316a4d87871fc44899add72520e928·commit→PR단일귀속을 교차확인했다. 원본 Trusted #1180.1/Run42301509594(Job128180179625)은 main validator229604522969133d1ccc6de0477e373252670c86에서 원본CI FAIL로 조기종료했고 report head/base=null이다. 원격source검증PASS나독립QA로확대하지 않는다. metadata reconcile#1080/진단#375 SUCCESS는보조 실행이며 metadataCI0/FullFAIL불변이다.


### R1 제품 RED 실증 및 가설

명령: `npx playwright test --config tests/config/playwright.config.ts tests/e2e/schedule-views.spec.ts --project chromium --workers=1 --retries=0 --max-failures=0 --grep '#880 P2'`. 원래제품f9bdd26d에서2 FAIL(exit1,20.1/38.5초),제품3파일+테스트5입력 before/after SHA동일. 원본 log/context/trace는 `/tmp/issue880-pr883-red`로보존하고정상종료후ownNext/isolateddist/DB잔여0을확인했다.

- R880-P2-001: app선택[A,B]→[A],Core primary[B]→[A]. 기존clipboard[A,B]는직후남아도재Copy[A]로축소되고Shift+C가[B,C]대신[A,B,C]가된다. canonical write0·sameinstance는유지돼저장/마운트실패와구별한다.
- R880-P2-002: 실제projectedX120/Y512→refresh0/0,Editor취소·PATCH200저장·workspace복귀후0/714. pendingGET중실제wheel로기대160/576을만들어도0/0이며응답후에도0/0. loadingcanvas제거와자동selectedreveal이사용자위치를덮는실제증상이다.
- 검증 전 가설순위:①WBSreturn single gesture가선택/anchor/Core를새로정의,②source무효화의canvas부재로capacity0/nativeclamp,③재조회selectedreveal/일회X초기화가clamp된좌표를보존하지못함. Core readonly재초기화/별도selection boundary축소도대조후배제한다.
- 교정범위:무Task조작왕복은전체선택·primary·anchor·clipboard보존,비WBS명시Task선택은새선택의도우선. 재수집중이전source는geometry만제공하고실제Taskrows/Editor활성0을유지한다. 현재project/view/scale/scope/filter/layout·request/intent가맞을때만원본행/날짜북마크를복구하며새wheel/key/권한/stale/응답역전은우선한다. WBS에새좌표writer를추가하지않는다.

TEST_LIFECYCLE_REVIEW=EXTEND 기존spec에고유P2두case만추가(6case=기존4+추가2),KEEP_UNIQUE 기존fullscreen6/scale2/TaskEditor33. 최종고유회귀47case/4spec로검증한다. RED2는이전45나향후47PASS와합산하지않는다. 현재제품교정중,원본RED·원격FAIL은불변이다.


### F880-R1-LOCAL-001 — 첫 보완의 TSX 구문 오류와 준비 단계 실패

첫 보완의 P2 두 case GREEN 시도는 setup warmup의 Project 페이지 HTTP500/health500으로 각1ms에 종료했다(exit1,본문2개NOT RUN). 동시에 수행한 변경파일ESLint는 `schedule-view-panel.tsx:320 Parsing error: '}' expected`를 검출했다. 새 `visibleRows` 함수의닫는 `};` 누락이 직접원인이다. fixture transport/환경장애로확정하거나제품assertion실패로합산하지않는다. 원본 `/tmp/issue880-pr883-green`과 `.prepr-reports/issue880-rework-r1/changed-lint.log`를보존했고 ownNext/orphan/dist/DB잔여0이다.

Manager가문법검사를브라우저보다먼저완료했어야했다. frontend가구문을수정한뒤 lint/typecheck를선행한다. timeout/retry/skip/허용오차는바꾸지않는다. 별도read-only검토에서같은P2의freshGET receipt동일성(Editor/peer sourceKey왕복)과locale을화면identity로취급해geometry를제거하는경로를추가검출했다. 새source당검증세대를구별하고locale표시만갱신하면서semantic row/date앵커를유지하도록같은보완에포함한다.

후속 선행typecheck는ancestor loop의 `string|null`에 `undefined`를대입한TS2322로exit2였다. `byKey.get(parent)?.parentViewRowKey ?? null`로종료값을명시한뒤전체typecheck exit0/PASS했다. `any`나컴파일옵션완화없이수정했고첫실패log도그대로보존한다. 변경파일lint는교정후exit0/기존warning3이었다.


### R1 Local Fast Feedback 선정·제외

R1의제품변경은클라이언트2파일의선택/조회viewport다. sourceAPI/DB/Scheduling/의존성/build·CI정책은변경하지않았다. 직접·인접Unit7파일175개(task-selection/viewport-coordinator/canonical-projection/projection-settled/peer-viewport-capture/schedule-view-projection/sourceHTTP·SQLite)PASS,전체typecheck교정후PASS,변경lintPASS/기존warning3,version/cache/Pythonpreflight11PASS다.

wholeUnit/production build/Docker의로컬반복은영향선정상제외한다. 이전Head의3738Unit/build PASS를새소스PASS로승계하지않는다. 실제Next·HTTP/SQLite를사용하는P2회귀및최종47case,base metadata전체replay·문서검사로직접소비자를검증하고,새Head Full Quality의전체Unit/productionbuild·Chromium8/Docker는원격필수/NOT TESTED로유지한다. qa_docs는이선정범위와원격gate유지조건을read-only로교차검토했다.


### F880-R1-LOCAL-002 — 추가 metadata 검사에서 가상 행 준비 누락

두번째보완GREEN시도는선택case1PASS(7.4초),viewportcase1FAIL(timeout180초),전체3.8분이다. viewport의원래refresh/Editor취소·PATCH200저장/workspace복귀/실제wheel160·576유지는모두PASS했으며,새metadata단계의Task20/G1작업정보button대기(line520)에서실패했다. 원본 `/tmp/issue880-pr883-green-2`와제품/test지문을보존한다.

분류TEST_FIXTURE/VIRTUAL_ROW_PREPARATION. projection은첫Task의첫분기부터행을만든다. 첫Task미할당으로unassigned가먼저생겼고Task20의Group분기는끝쪽인데metadata준비를Y34에두어Task20은virtualDOM밖이었다. 또한Y34의toplogicalanchor는개인행이라Taskcanonicalfallback오라클과불일치했다. 별도metadata검사대상을첫Task0(Alice배정)로선정해Group분기를앞에만들고,실제Task의logicalindex/cellHeight로topanchor를준비한다. 제품코드·원래120/512 및새wheel160/576의단언·85Task수/6·47case·timeout/retry는변경하지않는다. 실행전원본과cleanup을확인한뒤같은P2두case를재검증한다.


### R1 P2 직접 GREEN

fixture교정후동일P2두case는2/2PASS(exit0,6.9/27.6초,전체1.2분),workers1/retries0/max-failures0이다. 제품/test/script/db/package/Next config1310개입력의동결SHA256(sorted-path-sha256-map/json-compact/sort-keys) `1b165cd33266318c0e2b8c6e598a574e527b08ca7d01ced4759ebf536a09f280`은시작=종료다. raw는 `/tmp/issue880-pr883-green-3`에보존한다. 최초RED2·준비구문실패·추가fixture실패를삭제하거나이PASS와합산하지않는다. 최종47case는별도실행으로판정한다.

실제무Task조작복수선택/원래Coreprimary/Copy/Shiftanchor보존과명시새TaskC→WBSapp/CoreC·새anchor우선,nonzero재조회/Editor취소·PATCH200저장/peer복귀·pendingGET중실제wheel160/576·카탈로그정렬/경로삭제의Task앵커fallback·KO/EN/KO위치보존이통과했다. 추가metadata검사의catalog변경은Projectcanonical snapshot을바꾸지않음을확인한다.

최종lint수치정정: `.prepr-reports/issue880-rework-r1/lint-final.log`의실제결과는exit0/0error/4warning이다. 기존Gantt3개외새panel의`captureBookmark` hook dependency경고1개가있다. 앞의기존3개만표기한중간요약은최종총수를나타내지않는다. read-onlyqa_docs가closure의실제값이명시deps에포함되고새loaded는unique receipt로구별됨을검토해직접P1/P2로판정하지않았다. 경고나lint규칙을숨기지않고최종source동결을유지한다.


### R1 최종 동결 회귀

`schedule-views.spec.ts`6 + fullscreen6 + scale2 + TaskEditor33의최종단일Chromium은47/47PASS/FAIL0/SKIP0(exit0,10.3분),workers1/retries0/max-failures0이다. 신규6개는31.2/22.4/32.0/25.5/12.2/49.6초다. 시작과종료1310입력SHA256 `1b165cd33266318c0e2b8c6e598a574e527b08ca7d01ced4759ebf536a09f280`을Manager도재해시하여동일함을확인했다. raw전체는 `/tmp/issue880-pr883-final47`,정제근거는 [rework-r1-local.json](evidence/issue-880/rework-r1-local.json)에보존한다. 기존45범위·새P2둘과readonly/stale/응답역전·실제HTTP/SQLite음성은이같은동결실행에서통과했다. 기존단독GREEN2및과거45와합산해표본/성능을늘리지않는다.

최종fast/targeted자동Pre-PR의두실제실행은각exit1/BLOCKED,UNKNOWN7/missing0/sourceStable=true였다. `.prepr-reports/issue880-r1-final-{fast,targeted}`에원본을보존한다. 수동선정PASS와분리하며정책/매핑catch-all은추가하지않았다. final47정상종료후ownNext/3100/isolateddist/DB잔여0이며Next생성2파일과기존Issue461pickerJSON은 `/tmp/issue880-r1-generated-final`에보존하고HEAD bytes로복원했다.

최종제안PR본문/최신IssueAC(원본captured와동일)/전체47변경경로/현재Packet을 unchangedbase preflight에로컬재생해PASS(실패0)/최종5DEFERRED를확인했다. 이는worktree데이터검사이며원본f9를Head anchor로사용했다. 새원격Head의provenance나Trusted/OwnerPASS가아니다. 최종로컬commit생성후그commit의본문·경로·Packet에도다시재생하여게시STATUS에실제commit을연결한다. 검증기blob은base와불변이다.

별도read-only `/root/preqa`가최종47raw/정제receipt·before/after/current1310지문·Unit/type/lint·전체47경로문서의미/AC·보안음성·제외범위를교차검토해PRE_QA기술검토PASS/미해결직접P1·P2=0을반환했다. 인간QA_FINAL·Owner승인·ManagerACCEPT와구분한다. 기존원격P2두thread는공개candidatecommit의수정·실제검증근거로댓글후resolve하고현재main/headlease와충돌을재확인한뒤같은Tree의새FullCI등록으로넘긴다. 게시후CI결과를모니터링하지않는다.


### F880-R1-LOCAL-003 — 최종 재생 명령의 축약 SHA 인수

최초localcandidate `c5d2c4279fe7462cd0dc8568bdaf54750cb7cd3d`에대한사후재생명령에Manager가축약8자리SHA를넘겨exit1/Blocked `원본 이벤트의 PR/Head/base 출처 불일치`였다. 검증기는정확40자리SHA를요구하므로정상fail-closed이며제품/원격CI실패가아니다. 같은commit의40자리전체SHA로인수를교정한실제재생은PASS(실패0)/최종5DEFERRED/exit0이었다. verifier나원격자료를수정하지않았다. 이추가기록은문서전용이며제품/test1310지문은동일하다. 게시대상최종commit도전체SHA로재생하고실제값은Issue STATUS에서연결한다.
