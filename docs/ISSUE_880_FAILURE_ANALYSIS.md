# Issue #880 — 누적 실패·검증 원장

Primary Issue: [#880](https://github.com/planner77/masterGantt/issues/880). Source of truth: [PR CI 실패 처리](PR_CI_FAILURE_TRIAGE.md). 갱신일: 2026-11-07.

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
