# Issue #507 · #574 — 누적 실패·리뷰·충돌 원장

Primary Issue: https://github.com/planner77/masterGantt/issues/507
Related Issue: https://github.com/planner77/masterGantt/issues/574
기준 main `8d6d3ba7a47e6df08c509baad6eedcc2adee1407`, version `0.138.4`, Core `2.7.3`.
branch `test/issue-507-574-gantt-acceptance`; 2026-10-31 KST.
공통 규격: [실패 원장 지침](PR_CI_FAILURE_TRIAGE.md). #574의 별도 중복 원장은 만들지 않는다.

## 1. 원격 Run/Attempt 목록과 범위

착수 시 open PR 목록에서 #507/#574의 기존 PR은 없었다. 이후 전체 상태의 canonical `Issue #507`·`Issue #574` 제목 검색도 각각0건이었다. 문서 동결 시점은 새 PR/CI 생성 전이므로 Required Quality/E2E/Docker·Trusted QA 결과는 NOT TESTED다. 게시 후 정확한 PR/Head/base/test-merge/Run/Attempt는 Issue/PR STATUS에 기록한다. 선행 #852/#860의 실패·성공은 해당 Issue 원장에 보존되며 이번 실행으로 재분류하지 않는다.

## 2. 로컬·운영 실패 이력

| ID | 최초 관측 | 분류 | 보완·판정 |
| --- | --- | --- | --- |
| F507-OPS-001 | `gh pr list` HTTP401 Bad credentials, infra Git push dry-run Invalid username or token | ENVIRONMENT | credential 추출·변경 없이 허용된 연결 Git Data API의 전체 tree 게시 방식 B 사용. Git CLI 실패를 제품/CI 실패로 분류하지 않음 |
| F507-TOOL-002 | 초기 connector comment/search 입력 스키마 불일치 | TOOL_ARGUMENT | `ALL_TOOLS.description`의 실제 declaration 확인 후 comment `repo_full_name/pr_number/comment`로 수정. 두 Issue PLAN 댓글 생성 성공; 제품/CI 실행 실패 아님 |
| F507-LOCAL-003 | 최초 300행 wheel 계측의 Grid/Chart 중심 오차 최대68.5px 단언 FAIL,16.8초 | UNKNOWN | 원본 trace 보존. Summary bar geometry·계측 가정·native 비동기 frame을 분리 중이며 제품 flicker 원인으로 확정하지 않음 |
| F574-LOCAL-004 | #860 강화 변환 첫 실행의 기존 saved GET 단언 위치에서30초 test timeout | ENVIRONMENT 가설 | 전용 external3180 서버의 cold Next route compile와 동시 로컬 실행을 관측. assertion/timeout/retry 변경 없이 동일 source warm 실행16.5초 PASS. 최초 FAIL은 유지하며 외부 서버 실행을 fixture별 process/DB 격리로 주장하지 않음 |
| F574-FIXTURE-005 (상세 F009) | 새 V3 강화 barrier가 FILTER_RETURN APPLYING을 기다렸으나 history에 FILTER_EMPTY_RESET→SETTLED만 존재하여 FAIL | FIXTURE_OBSERVABILITY | 아래 F009의 첫 실행과 동일 사건이며 별도 실패로 중복 합산하지 않는다. 원본 sequential PASS는 pending 경합의 증거가 아님 |
| F507-PREPR-006 | `verify:prepr --mode=fast` 선택기 UNKNOWN2로 BLOCKED | POLICY_MAPPING | 새 `scale-decoration-observer.ts`와 `vertical-scroll-diagnostics.ts`의 producer→consumer 등록 미지원. 도구/정책을 바꿔 PASS하지 않음. 아래에 수동 영향 매핑·실제 직접 검사와 미실행을 기록하며 Pre-PR 보고서는 BLOCKED 유지 |
| F507-LOCAL-007 | `node scripts/verify-test-discovery.mjs`의 root/외부 cwd 목록 비교 FAIL | SOURCE_CHANGED_DURING_CHECK | Manager가 worker 편집 중 실행하여 같은 테스트의 줄 위치가94→95로 바뀌었다. source 동결 검증이 아니므로 discovery 제품 결함/최종 결과로 해석하지 않는다. source freeze 후 동일 명령을 다시 실행하며 최초 exit1을 보존 |
| F507-ENV-008 | 별도 원본 baseline worktree의 첫 Chromium 실행5.2초 FAIL, app500으로 Gantt frame 없음 | ENVIRONMENT | Turbopack이 외부 worktree node_modules symlink를 hermetic root 밖으로 판정. 실제 worktree 소유 의존성으로 복구 후 원본 source와 동일 계측 비교를 수행. candidate 공유 source를 원본으로 임시 교체하지 않음 |
| F574-FIXTURE-009 | `selection-pending.log`와 `selection-pending2.log`에서 각각5초 gate=false, FILTER_RETURN lease 미관측 | FIXTURE_OBSERVABILITY | 넓은 날짜 fixture에서는 FILTER_EMPTY_RESET만 발생. 기존 scoped bookmark fixture와 실제 scroll capacity witness로 교정. 처음 sequential18초 PASS는 pending 경합 증거가 아니며 원본 이력으로만 보존 |
| F574-FIXTURE-010 | `selection-scoped.log`에서 target76 visible 단언5초 FAIL | FIXTURE_OBSERVABILITY | siblingOrder만 바꾸어 실제 Core가 소비하는 canonical 배열 순서가 갱신되지 않았다. fixture 배열도 같은 순서로 정렬하고 실제 hit-test positive control을 유지. `selection-scoped2.log`11.6초 PASS 후 최종 동결 실행으로 재검증 |
| F507-TYPE-011 | 최종 진단 helper의 `HTMLElement\|SVGElement.offsetWidth` TS2339 | TEST_CONTRACT | 실제 div frame의 HTMLElement 경계를 명시하고 typecheck 재실행. 제품 observer 변경 아님. 실행 중 소스와 임시 Next config는 최종 정규화/동결 후 별도 판정 |
| F507-HARNESS-012 | `after-first`의 CJS dynamic import 로딩 FAIL0.785초 | FIXTURE_OBSERVABILITY | 기존 Playwright CJS 로더와 호환되는 helper 정적 import로 교정. `after-second`34.5초 PASS는 당시 날짜축 밖 bar·빈 columns 측정이므로 최종 사용자 가시/열 보존 근거로 쓰지 않음 |
| F507-PREQA-013 | 독립 최종 QA에서 최소 Core fixture의 `rowHeight={34}`가 설치2.7.3의 지원 prop이 아님을 확인 | TEST_MEASUREMENT_CONFIGURATION | Core prop은 `cellHeight`이고 기본값38이다. 원본3control에는 행 높이 실측이 없어 동일34px 조건이라는 설명은 불충분했다. 원본 source/결과를 이력으로 보존하고 별도 baseline worktree의 최소 control만 `cellHeight={34}`·실제 native row/Core height 단언으로 재실행. 제품 및 baseline/candidate 비교 source는 변경하지 않음 |

`npm ci --no-audit --no-fund`: 446 packages 설치 PASS, eslint9.39.5 지원 종료 경고를 보존한다. 의존성 그래프 변경 없음.

Pre-PR 실제 보고서: `.prepr-reports/2026-10-30T22-32-46.952Z-1900668-97676d8e/report.json` 및 `SUMMARY.md`. 명령 exit1, 설치/선택 단계에서 차단되어 CLI 내 TypeScript/ESLint/Unit/Build는 NOT RUN이다. 앞선 dry-run 보고서 `2026-10-30T22-32-30.507Z-1899780-07aa795b`는 계획일 뿐 NOT TESTED다. 수동 매핑: scale observer producer→Day/Week markCells consumer→새2case Unit/실제 Chromium native MutationObserver/기존 header tooltip·scale 및 #507 vertical wheel; diagnostics helper→기존 stability spec300/1000/3000행. 임시 Next 생성 config가 남아 있어 최종 typecheck/source freeze 전 정규화한다.

## 3. Cross-run 매트릭스·사전 검토

최초 계측 실패와 관련 source 변경·재검증을 같은 원장에 누적한다. 원본 FAIL은 후속 PASS로 덮어쓰지 않는다. 지연·경합·mock HTTP/실제 SQLite·frame 체감·원격 Required gate를 구분한다.

### F507-LOCAL-003 추가 진단

최초 intrusively 매-frame 모든 row/bar geometry를 읽는 방식은 SVAR의 가상화와 비동기 native scroll의 서로 다른 렌더 시점을 관측했다. 최대68.5px 자체를 실제 화면 flicker의 확정 증거로 쓰지 않는다. 성능 구간에서는 native Y·행 수·root identity만 읽고 geometry는 settle 후 별도 측정한다. 최초 raw trace/PNG/JSON은 `output/playwright/issue-507/initial-intrusive/`에 보존한다. 처음 Chart가 날짜축 밖의 stress Task bar를 표시하지 않았던 캡처도 진단 자료이며 최종 visible-bar 증거로 재사용하지 않는다. 생성 Task 날짜를 실제 초기 Chart 가시 범위에 맞추고 동일 native 사용자 입력으로 재검증한다.

동일 최초 관측의 재실행 `test-results-second`도23.8초에68.5px 단언 FAIL했으며 첫16.8초 실행과 둘 다 원본 보존한다. `final-tests`의3case PASS도 처음 columns=[]로 비어 있어 열 보존의 positive evidence가 아니었다. 실제 native header IDs `:copySelection/:text/:projectStart/:projectDuration/:add-task`를 먼저 검사하고 quiet300·1000/3000 및 최종4case에서 같은 값 보존을 재검증한다. 빈 표본·측정하지 않은 frame gap0을 PASS 자료로 쓰지 않는다.

### source와 계측을 맞춘 원본 비교

원본 main 별도 worktree와 candidate의 동일 quiet window300행 Day down/up에서 날짜축 aria-label writes는1593/1593→0/0, header observer 소요179.4/116.6ms→0.5/1.2ms, rAF p95 33.4/33.3ms→16.8/16.8ms, long task 수10/3→0/2였다. Task/헤더·3초 이상 native 입력·helper·Chromium 조건과 source 지문을 정제 receipt에 결속한다. 최소 Core300/1000/3000행 통제에서는 long task0/max rAF16.8ms를 관측했다. 최소 wrapper와 제품 구조의 차이가 있으므로 이 비교는 무관한 날짜축 장식 낭비 제거의 근거다. 다른 app-owned row observer와 Core/전체 React commit은 남으며 모든 flicker·frame drop·long task가 해소되었다는 의미가 아니다. 최초 intrusive 측정과 경량 측정 사이의 개선율을 산출하지 않는다.

정제 원본은 [scroll receipt](evidence/issue-507/scroll.json), [baseline helper](evidence/issue-507/reproduction/baseline-measurement-helper.ts.txt), [quiet candidate helper](evidence/issue-507/reproduction/quiet-candidate-measurement-helper.ts.txt)에 보존한다. 비교 구간의 `instrument`/`sample` 계측과 Day down/up 입력은 같지만 종료 단언·이후 Week/fullscreen 행렬·source 지문과 열 selector 교정이 달라 전체 helper SHA는 다르다. 각 source SHA를 구분하고 전체 파일 byte 동일이라고 주장하지 않는다. [before](evidence/issue-507/before-day.png)·[after](evidence/issue-507/after-day.png)는 동일 fixture의 가시 bar/row 문맥 캡처이며 정지 화면으로 active-scroll flicker를 판정하지 않는다.

F507-PREQA-013 교정 후 최소 Core300/1000/3000은 각각 public `cellHeight=34`와 실제 native Grid23행 모두34px임을 새로 단언했다. long task각0, max rAF각16.8ms, Core/nativeTop3180/3240/3240 일치, exit0이다. source SHA256 `563396d3fbd81cde2316016845782eb6cd57767176060d734d61267e0881356d`, [교정 wrapper](evidence/issue-507/reproduction/core-widget.tsx.txt) SHA256 `58d4c4e67233c702465850840abc1477c8814e291b7c46ce4381c3ed15326a73`와 [실행 계측](evidence/issue-507/reproduction/core-control-corrected.cjs.txt)을 보존한다. [원래 unsupported prop source](evidence/issue-507/reproduction/core-widget.initial-unsupported-rowHeight.tsx.txt)와 원래3결과/측정 원본은 history로 유지하며 새 `scroll.json.minimumCore`만 교정된34px 근거다. 제품2파일·최종 helper를 포함한 공유 source5개는 이 교정 중 변경되지 않았다.

별도 qa_docs의 실제 Chromium native MutationObserver 검증은 initial/일반 row추가/무관 class/scale 포함 wrapper/scale 교체/날짜 class/scale text/cleanup 후 변경에서 callback counts `[1,1,1,2,3,4,5,5]`, exit0으로 PASS했다. helper source SHA256 `9f25994b6421280abe4bd624617ddcb63439eeaf4b7d4f311fc8785c045e6697`에 한정한 독립 로컬 근거이며 제품/원격 최종 승인은 아니다.

### #574 최초8case와 강화 assertion의 구별

초기 실제 HTTP/SQLite8case는5.3분에8/8 PASS(각 test body13.5/24.4/35.6/8.0/14.6/22.4/16.0/16.3초)였지만 전체 실행 전후 source 지문을 취득하지 않았다. 실행 중 다른 worker가 header/probe·테스트 계측을 변경했으므로 이8건 전체를 최종 동결 source의 PASS로 주장하지 않는다. 최초 로그 `output/playwright/issue-574/isolated-eight.log`와 개별 artifacts를 보존한다. 또한 UI Paste 비활성만으로는 revision gate의 영향과 저장된 clipboard0을 분리할 수 없어, 비운영 probe의 raw clipboardIds를 positive seed·취소 보존·변환 후0에 직접 대조하도록 보강했다. 최종 실제8case는 app/source·package/lock·공통 fixture/config·선택 spec의 실행 전후 SHA256 및 JSON report를 취득하여 별도 재실행한다.

## 4. 리뷰·충돌·CI 인계

read-only ui_ux의 Design Delta B를 반영했다. 구현자와 분리된 qa_docs가 날짜축 native MutationObserver를 실제 Chromium에서 검증하고 관찰값0의 오해·빈 열 표본·V3 경합·native bar·clipboard positive seed·문서 source 경계를 지적했으며 구현/증거를 보완했다. 사전 검토는 원격 QA Final·Owner·Manager ACCEPT를 대체하지 않는다. 원격 thread·mergeability는 PR 생성 후 확인하며 문서 동결 시점에는 N/A(PR 미생성)다. 최신 main 재조회·전체 tree 게시·exact Head/base/test-merge·Run/Attempt 등록 후 CI 결과 모니터링 없이 인계한다.

## 5. 최종 동결 검증과 남은 경계

- [정제 evidence manifest](evidence/issue-507/manifest.json)는 코드·측정 지문, source 비교·최소 Core 재현 source, 선택적 assertion receipts·before/after 캡처를 결속한다. raw Trace/HTML/runtime log·쿠키·실제 DB를 Git에 넣지 않았다. 실제 fixture 자료와 원본 오류 이력은 로컬 `output/playwright/issue-507/` 및 `issue-574/`에 보존한다.
- #507 최종4/4 PASS(50/300/1000/3000=43.7/35.6/30.9/46.4초, 총2.6분), 기존 밀도/header2/2 PASS. 실제 Grid/Chart wheel·peer/density·native/API root·positive selection/columns/tree·revision/mutation0을 확인했다. up/down 입력 횟수 차이로 원래 Summary가 가상화 밖에 남지 않도록 추가 실제 wheel로 원점 귀환을 확인한 최종 helper SHA256은 `dbcc1228e573bff32d74ea9e4576ed779ee78cc1829e1d9c7a8a0c2d2ce525ae`다.
- #574 최종26/26 PASS: mock/native11건58.2초, 실제 격리 HTTP/SQLite8건5.2분, 교차 HTTP/SQLite7건3.2분; FAIL/SKIP/flaky0. 세 실행의 application fingerprint `a08e9483a5610b88ae2fc269e722df76599c802eaebac3ab2453fafc1268dbe7`가 같으며 [선택 case 결과](evidence/issue-507/cross-feature.json)에 각각 source·시간·case·artifact를 기록했다. 보충7건은 SC-05 commit500+GET실패, M-only 과거/미래, 삭제401/412/network, Resource pending wheel이다.
- actual8의 broad source hash는 실행 중 **미사용 vertical helper 하나**가 바뀌어 불일치였다. 이를 숨기지 않고 실제 선택 테스트의 재귀 import 경계·전체 app/package/config578파일의 불변을 검증했다. 다른 두 묶음은 broad/relevant 모두 불변이다. Manager가 세 실행의 관련 모든 파일을 현재 게시 tree byte hash와 대조해 일치함을 확인했다. 서로 다른 실제 fixture를 동일 DB/snapshot으로 합치지 않는다.
- Unit61고유/8파일 PASS: Manager48/6파일7.36초 및 header/observer15/3파일에서 공통 observer2case를 제외한 합집합이다. 독립 qa_docs native DOM 검증은 별도다. 최종 Next generated type 경로 정규화 후 `npm run typecheck` exit0, 변경8파일 ESLint exit0/오류0·기존경고3, discovery285 Unit files/861 browser tests(root·외부 cwd 동일), version0.138.5·Markdown385파일 링크·diff check PASS. 최초 discovery/type 오류는 위에 보존하고 최종 PASS로 덮어쓰지 않는다.
- 자동 Pre-PR 선택기는 UNKNOWN2의 **BLOCKED**를 유지한다. 실제 수동 영향 mapping과 직접 검증을 [validation receipt](evidence/issue-507/validation.json)에 구분했고 자동 CLI 내 전체 Unit/production build·로컬 clean Docker는 NOT RUN/NOT TESTED다. 공식 Full PR Required3/Chromium8 및 Trusted/Owner·Manager는 원격 별도다.
- 수동 체감·물리 trackpad/실기기·native thumb drag(gutter0), production storage/TLS·Windows Excel/VBA/DRM과 모든 조건의 전수 곱은 NOT TESTED다. 다른 row observer·Core/전체 React commit·일부 long task가 남는다. 제품 보완을 모든 flicker 완전 해소로 확대하지 않는다.

최종 독립 사전 검토: `qa_docs /root/coverage_audit` PASS, 남은 차단 지적0. 실제 native observer·수정된 최소 Core와 manifest23자료/크기/SHA, application561파일 및 실행별 관련580/578/585파일·원본 assertion을 직접 대조했다. manifest SHA256 `8cce0aa1f55c239767c5ef1a5e33b5940b018ba04fd8e7b1e32359ef6a01ac8a`; 검토 scope는 PR 게시 전 source와 로컬 증거이며 원격 QA Final/Owner·Manager ACCEPT는 NOT TESTED다.

## 6. PR #862 최초 Full PR CI #3449.1 — QA Preflight Primary Issue AC 식별자 부재 (2026-10-31 KST)

- **귀속/원본**: [PR #862](https://github.com/planner77/masterGantt/pull/862), Primary [#507](https://github.com/planner77/masterGantt/issues/507) / related #574, branch `test/issue-507-574-gantt-acceptance`; event `pull_request`, `FINAL_FULL`. [CI Run 41141587774 / attempt 1 / #3449](https://github.com/planner77/masterGantt/actions/runs/41141587774), 최초 시작 2026-10-30 22:58:48 UTC (2026-10-31 07:58:48 KST); 원본 Head `22b44e2001a42a77f830fab3b51a399f63e1366d`, event/base `8d6d3ba7a47e6df08c509baad6eedcc2adee1407`; GitHub PR의 당시 test-merge `da70dbeeef35ebc1fe7fdb15975122e684ef2a00`(이전 PR STATUS에서 parent/tree 비교 기록, 이번 원격 신뢰 검증 결과로 승격하지 않음).
- **F507-PRCI-014 / PRIMARY / METADATA_CONTRACT**: Job `QA Preflight — 정책·문서 사전 검사` ID `124357009528`, step 4 `원본 base SHA의 QA Preflight 실행 (read-only)` 최초 직접 exit1. [원격 로그](https://github.com/planner77/masterGantt/actions/runs/41141587774/job/124357009528)에서 `FAIL / ISSUE_AC: Issue #507 Acceptance Criteria — Primary Issue 본문에 AC1.. 식별자 없음`. 해당 시점 Issue #507의 §9 Acceptance Criteria에는 미완료 checklist가 있었지만 `AC1`처럼 구조화된 식별자가 없었다. 원본 base `scripts/qa_preflight.py`는 Primary Issue body에서 `\bAC\d+\b`를 검사하며 미검출 시 `DOCUMENTATION_SYNC` 경로도 진행하지 않는다. PR title/Refs, risk, QA method/flags, PATH_POLICY는 모두 PASS였다. 이 오류는 **Issue 본문 ↔ Work Packet 정합성** 문제이지 Unit/E2E/제품 회귀의 실제 실행 FAIL이 아니다.
- **F507-PRCI-014 / DERIVED / NOT_RUN**: `PR 빠른 검사 판정` ID `124357138256` 실패 후 TypeScript/ESLint/Unit/Next Build, PR E2E shard 8개, Docker smoke 구현은 모두 **skipped / NOT RUN**. Required aggregate `Build, static checks, and unit tests` ID `124357238000`, `Chromium end-to-end tests` ID `124357237983`, `Docker build and runtime smoke test` ID `124357238109`은 이 선행 gate 실패 때문에 **FAIL (파생)**. `QA Final — Automated` ID `124357268588`도 Required3 FAIL과 independent QA NOT TESTED를 보고 **FAIL (파생)**. 다른 제품/테스트 직접 실패로 중복 계수하지 않는다.
- **과거 이력 연계**: 이전 F507-OPS-001부터 F507-PREQA-013까지는 로컬·도구·fixture·선택기 증거로 보존하며 원격 CI의 별도 성공/실패로 합산하지 않는다. 자동 Pre-PR 신규 helper 영향 미등록 `UNKNOWN2/BLOCKED` 역시 유지한다. 이번 직접 실패를 그 문제나 브라우저 flicker로 오인하지 않는다.
- **원인 보완 (GitHub Issue 본문)**: 원본 §9 checklist 및 이력은 보존하고 #507의 상단에 `AC1`~`AC7` 식별자를 가진 추적 표기를 보완했다. #507 제품/성능 AC1~3, 관련 #574 V1~V8 교차 AC4~6, 문서·CI 인계 AC7은 기존 `docs/exec-plans/active/ISSUE_507.md`의 `## AC_TEST_COVERAGE`와 1:1 대응한다. 미수행 수동 체감과 나머지 기존 체크박스는 완료 처리하지 않는다. Base Preflight의 `docs_gate` 규칙에 맞추어 Work Packet `## DOCUMENTATION_SYNC`의 필수 문서(Design/TEST_PLAN/SCHEDULING_ENGINE) 및 `AC1..AC7` 매핑을 정적으로 확인했다. **이 정적 확인은 새 Full CI PASS가 아니다**.
- **리뷰/충돌 검토**: 원본 PR Head에서 inline review thread 미해결 **0건**, GitHub submitted review 0건, Codex 리뷰 summary 완료/지적 없음(후속 commit은 별도 재판정), `mergeable=true`. `main`과 비교 `ahead=1, behind=0`, 정확 Base `8d6d3ba...` 및 merge-base 동일, 충돌 징후 없음. QA/Owner HIGH 위험 수용/Manager ACCEPT는 아직 별도.
- **REWORK / 재시작 방식**: 실패 원장 갱신 commit을 동일 PR branch에 추가 Push하여 GitHub `pull_request.synchronize`의 **새 Head Full PR CI**를 시작한다. 이전 Run attempt 재실행만으로는 새로운 원장 commit을 검증할 수 없으므로 사용하지 않는다. 새 Run ID/attempt는 시작 후 PR/Issue STATUS에서 확인한다. 이번 사용자 지시에 따라 새 CI 결과 지속 모니터링, 병합, Main CI, GHCR 게시, Issue 종료는 **수행하지 않는다**. 새 Required3/E2E8/Trusted·Owner·Manager 결과는 시작만으로 PASS가 아니며 **NOT TESTED**다.
