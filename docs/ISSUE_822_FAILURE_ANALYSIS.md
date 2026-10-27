# Issue #822 — 검증·실패 및 잔여 위험 원장

## 범위와 기준

[#822 Work Packet](exec-plans/active/ISSUE_822.md)의 AC1~8에 대한 실제 로컬 실행과 원격 CI를 분리한다. 기준은 main `dc8543f390616c0d5aca90a4f91899f3cf7ac5da`, 설치 Core2.7.3/Next16.4.2, Node22.14.0이다. 복사한 독립 node_modules는 로컬 실행 준비이며 원격 frozen `npm ci`·dependency audit 증거가 아니다.

## F822-LOCAL-001 — 실제 휠 테스트 포인터 위치 준비 실패

- 환경: 독립 `/home/planner/Dev/masterGantt-822`, Chromium mock-backed fixturecanonical99/nativeWBS98행, 새 #822 기존 Summary spec 확장.
- 직접 원인: 테스트 helper가 전체95+ 가상행을 포함하는 `.wx-bars` bounding box의 중앙에 포인터를 두어 보이는 Chart 본문 밖에서 wheel을 보냈다. 제품의 비대상 wheel을 가로채도록 바꾸지 않는다.
- 교정: 보이는 실제 child bar를 Chart 입력 대상으로 사용한다. 원래 실패는 테스트 준비 FAIL로 보존하고 제품 PASS로 소급하지 않는다.
- 초기 교정 결과: 같은 실제 Grid/Chart wheel·geometry case1 PASS(11.4s). 이후 virtual anchor/burst 수정이 이어졌으므로 이 결과를 최종 동결 소스 PASS로 사용하지 않는다.

## F822-LOCAL-002 — 깊이 스크롤한 기준 행 79px 이동

- 실제 Chromium에서 scrolled middle row를 포인터 기준으로 첫 밀도 단계 변경한 결과 Y offset이79px 바뀌어 anchor 보존 assertion이 FAIL했다. 상단 row의 geometry PASS는 이 실패의 반증이 아니다.
- 확장 실행: geometry case1 PASS(7.9s), anchor case1 FAIL(6.6s), 총18.6s. source는 구현 중이며 최종 검증이 아니다.
- 증거: 격리 worktree의 `test-results/project-summary-bar-visual-2e1f8-nsitions-and-touch-modality-chromium/error-context.md`, 같은 디렉터리 `trace.zip`(로컬 원본, Git에 raw trace 저장 안 함).
- 그 앞의 anchor fixture 준비는 transitional DOM에서 candidate가 없어2.0s에 실패했다. 실제 row readiness를 기다리도록 테스트 준비를 교정했으며 이후79px 제품 실패와 구별한다.
- 원인: Core의 native `cellHeight` prop 재초기화가 visible `_tasks`를 다시 구성하여 marker-OFF에서 제외해야 하는 canonical Milestone id4를 되살렸다. 기대 projection128개/Core129개로 membership이 어긋나 fresh receipt가 TIMED_OUT했고 anchor intent가 적용되지 않았다. 단순79px 보정 수치로 숨기지 않는다.
- 교정: 기존 단일 canonical queue의 WBS membership filter effect에 `ganttCellHeight` 의존성을 연결하여 native prop 변경 뒤 동일 projection membership을 재적용한다. Milestone canonical 데이터는 유지하고 표시 subset만 원래 계약으로 복원한다. 새 filter writer·gate 완화는 없다. 교정 뒤 같은 virtual middle-row/실제 wheel·tail·anchor 사례1 PASS(8.0s, 총11.7s)를 확보했다. 이후 touch/pending 보완을 포함한 최종 소스 검증은 별도다. tolerance/timeout/retry·기존 pointer 검증을 완화해 처리하지 않는다.

## F822-LOCAL-003 — 혼합 포인터44px 목표의43px 측정

- 확장한 coarse/hybrid 사례는44px row의 checkbox label이43px여서 엄격한44px 목표 검사에 FAIL했다. 기존 CSS는 primary `(pointer:coarse)`에만 최소44px를 적용하여 `any-pointer:coarse` 혼합 환경과 JS의44px 프로파일 판정이 달랐다.
- 교정: 실제 `data-gantt-cell-height=44` 프로파일을 기준으로 같은 최소44px 목표를 적용한다. 기대값을43px로 낮추거나 혼합 포인터 검증을 skip하지 않는다.
- 교정 뒤 당시 Summary8개 묶음에서는 두 pointer query를 함께 전환한44px 프로파일·label 높이·instance 보존 case2.9s PASS를 확인했다. 독립 primary-fine/any-coarse 및 인접 rect 비중첩은 이후 F006 fixture 보완과 최종137개 실행에서 검증했다. 당시8개 전체53.2s/0FAIL/0SKIP과 최종 source 증거를 구분한다.

## 검토 중 발견한 경계

- document capture의 매 wheel `userInput()`은 accepted density intent 뒤 subthreshold trackpad 잔여 입력만으로도 anchor를 취소할 수 있다. 대상 density wheel과 일반 사용자 입력을 같은 coordinator의 입력 우선 계약 안에서 분리한다. 실제 각 accepted step은 새 lease를 얻고 일반 wheel/key/pointer는 오래된 복원을 취소해야 한다.
- 깊이 스크롤한 가상행에서 cellHeight 갱신 후 원래 anchor가 DOM에서 사라질 수 있다. 기존 port는 fresh projection order와 현재 측정된 native row rect로 같은 ID의 위치를 해석한다. oldScrollTop×배율이나 별도 DOM writer로 우회하지 않는다.
- checkbox 첫 셀의 font만 계측하면 실제 작업명/기간의 가독성을 놓칠 수 있다. 실제 본문 텍스트·명시12px 보조 제어를 구분한다.

이 항목들은 독립 사전검토·구현 중 발견한 위험이며 실제 추가 시험 및 최종 판정은 동결 source의 검증 기록으로 갱신한다. 과거 #816/#818 실패·성공 원장은 변경하지 않는다.

## F822-LOCAL-004 — Pre-PR 신규 producer 매핑 누락

- 최초 `verify:prepr --mode=targeted --dry-run`은 실행 결과 NOT TESTED이며 계획의 selection은 BLOCKED였다. 유일한 UNKNOWN은 신규 `src/features/gantt/gantt-density.ts`; 직접 Unit이 있어도 기존 일반 매핑은 비서버 모듈을 자동 승인하지 않는다.
- 교정: `scripts/prepr-core.mjs`에 이 정확 경로만 HIGH로 등록하여 직접 density Unit과 기존 scale/Summary/projection/native Task/tooltip5spec을 선택한다. 미등록 sibling helper·직접 Unit 누락은 여전히 BLOCKED다.
- 기존 `tests/scripts/prepr-verifier.test.ts` EXTEND25/25 PASS(1.78s), 신규 설명/테스트 제목 한글. catch-all·UNKNOWN 우회·Required/8-shard/QA 정책 완화 없음. 실제 fast/targeted 실행 결과는 별도다.

## F822-LOCAL-005 — Fast 실제10개 명령 PASS와 소스 동일성 BLOCKED

- `.prepr-reports/issue-822-fast/report.json`: version/discovery/Markdown/cache/QA fixture/dependency/typecheck/lint/전체Unit/production build10개 명령은 모두 exit0/PASS. Unit3350 PASS/기존3SKIP,282파일 중281PASS/기존1SKIP. 새skip은 추가하지 않았다. Lint0error/기존17warning.
- 최상위는 exit1/BLOCKED, `sourceStable=false`. 시작 fingerprint `b01f8be3086c524eb2a1fe23dc6ea6615a874e457073c683525eeed84f4f7cec` → 끝 `5bc9117c4b1f56a7aeb3bc2e0bfc6aa3b876109cbce47837ba5860b6a8eadf07`.
- Next production build가 추적된 `next-env.d.ts`와 `tsconfig.json`에 `.next-prepr` 생성 타입 경로를 기록했다. 별도5개 제품 SHA는 geometry 증거와 일치하며 생성 설정은 baseline bytes로 복원했다. fingerprint검사를 완화하거나 총괄PASS로 바꾸지 않는다.

## F822-LOCAL-006 — 독립 hybrid 모의 상태 검증 보완과 선별 실행 중단

- Manager가 독립 hybrid 모드를 추가했으나 새 `matchMedia()` 호출이 이전 모의 상태를 읽지 못하는 fixture 오류를 qa_docs가 정적 검토로 발견했다. 제품 결함/실행 실패로 오인하지 않는다.
- 당시 실제 targeted 첫 실행은 Unit312 PASS 뒤137개 Chromium 계획 중7PASS,1interrupted,129NOT RUN 상태에서 Manager가 소유 Playwright 프로세스에 SIGINT를 보내 조기 중단했다. 중단 시점의8번째 case는SC-05 recovery이며 hybrid assertion 실행 전이다. `.prepr-reports/issue-822-targeted`는 BLOCKED/취소 원본으로 보존하고 성공으로 합산하지 않는다.
- fixture는 두 coarse query의 현재 모드만 저장하여 기존/새 MediaQueryList 모두에 적용한다. 다른 query는 native 원본을 사용한다. primaryfine/anycoarse를 독립 확인하고 실제44px checkbox의 bottom≤다음 target top 비중첩 및 primarycoarse 복귀를 검사한다.
- 수정 후 정확case1 PASS(5.4s, 총10.9s). 제품 source5개는 변경하지 않았다. 기존137개 선정의 최종 재실행은 별도 새 보고서로 기록한다.

## 최종 선별 실행 및 현재 판정

`.prepr-reports/issue-822-targeted-final/report.json`에서 선택 READY/UNKNOWN0/MISSING0, Unit312/11파일 PASS, Chromium137/17spec PASS/0FAIL/0SKIP, workers1/retries0를 확인했다. 최상위는 BLOCKED/exit1/sourceStable=false다. 실행 중 Next dev/격리 HTTP 서버가 생성한 AGENTS heading·next-env.d.ts·tsconfig.json을 baseline bytes로 복원했다. 기존 E2E가 역사적 issue528/issue463/issue258 PNG·geometry 출력도 갱신했다. 해당 실행 원본을 `/tmp/issue822-generated-artifacts`에 보존하고 baseline bytes로 복원하여 커밋에서 제외했다. sourceStable=false는 Next 생성 파일만의 차이가 아니다. 시작 전/종료 후 제품·test·script 13개 파일의 SHA는 모두 같으며, [정제 보고서](evidence/issue-822/local-validation.json)에 각 명령·시작 시각·케이스 수·보고서 SHA·두 fingerprint를 보존한다. 총괄 BLOCKED를 PASS로 소급하지 않는다.

최종 실행에는 수정된 독립 hybrid/44px 인접 rect 비중첩과 현재 fixture가 포함된다. 기존8case 보고서/geometry 단독 capture는 당시 test SHA를 유지하며 현재137case의 test SHA와 혼동하지 않는다. 제품5개 SHA는 같다. 최초 fixture 오류/79px 제품 오류/43px 목표 오류/매핑 UNKNOWN/중단 원본은 위 원장에 보존한다.

실제 qa_docs source 사전검토 PASS는 최종 Trusted/Owner 승인이 아니다. 원격 Quality/Chromium8/Docker·Trusted/Owner/Manager ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED다. Main/GHCR/정식 Release/Finalizer·Issue 종료는 요청 범위 밖이다.

## F822-REMOTE-001 — PR #823 Full #3326.1 Chromium shard4 직접 실패 (2026-10-27)

- 원본: https://github.com/planner77/masterGantt/actions/runs/40446716353 (attempt1, event=pull_request); Head 0e22dd95347bd53d8ccd249c4a1697d521af618e, Base dc8543f390616c0d5aca90a4f91899f3cf7ac5da. 실패 Job ID 122000415734.
- 직접 실패: tests/e2e/task-editor-form-density.spec.ts:324 (#570), line410의 empty active query 결과에서 publicLeft Expected 0 / Received 120, expect.poll 5000ms 초과. shard4 70 PASS / 1 FAIL / 기존1 SKIP / 21 NOT RUN. CI의 max-failures=1 조기 중단.
- 다른 shard: 2/3/5/7/8 성공, 1/6 취소. Quality/Build/Unit/Docker 성공, Chromium aggregate 실패 및 QA Final Automated 실패는 직접 E2E 실패의 파생. GitCommitInfo 3000ms 경고는 직접 assertion 원인 증거가 아님.
- 원인: 현행 filter-tasks 및 metadata 복원은 결과 0건일 때 native/Core 수평 scroll이 120에 남는 경로를 명시적으로 정착시키지 않는다. 빈 필터에 대한 일회성 viewport reset의 미구현 경계가 노출됨. 재실행 trace 없이 간헐적 실패로 단정하지 않음.
- 보완: 기존 단일 Coordinator/Port에 FILTER_EMPTY_RESET typed 명령 추가. filtered+empty+실제 Core _tasks.length=0과 원래 query/source 일치에만 공개 scroll-chart로 left0. 일반 빈 프로젝트·새 사용자 gesture·새 query에는 영향 주지 않고 이전 restore 권한을 취소. 직접 DOM writer/remount/권한·일정·날짜축 변경 없음.
- 검증: 기존 #570 E2E의 line410 기대0·5초 timeout 그대로 유지. Coordinator 단위의 성공/음성 Unit 2개 신규. 기존 #816/#818/#637 테스트 보존, TEST_LIFECYCLE_REVIEW=ADD(Unit)+EXTEND(기존 E2E)+KEEP_UNIQUE(기타 독립 위험). 변경 commit 전 로컬 실행 NOT TESTED, 수정의 효능은 신규 remote PR Full 결과 전 NOT TESTED.
- 리뷰/정렬: 발견한 미해결 리뷰 thread 0, PR mergeable=true, main 기존 base와 동일. CI 실패·취소 원본은 보존하고 과거 PASS로 수정하지 않는다.

## F822-REMOTE-002 — PR #823 Full #3327.1 Vitest 직접 실패 (2026-10-27)

- 원본: https://github.com/planner77/masterGantt/actions/runs/40452136896, attempt=1, event=pull_request, PR#823, HEAD `166d1879babb37561171eadf59d16da7f6e0600e`, base `dc8543f390616c0d5aca90a4f91899f3cf7ac5da`.
- **직접 실패:** Unit Job `122017249896`, `tests/features/gantt/viewport-coordinator.test.ts:95`, `invalidates an empty-filter reset on new user input or query`. 원래 negative assertion `expect(f.port.apply).not.toHaveBeenCalled()` 에서 `FILTER_EMPTY_RESET` 호출 2회 검출. Test Files: 280 PASS/1 FAIL/1 기존 SKIP, Tests: 3351 PASS/1 FAIL/3 SKIP (총3355).
- **파생:** Fast Gate `122017718568`는 `UNIT_RESULT=failure`로 FAIL. PR Next production build, Chromium 8샤드, Docker 구현은 SKIPPED/NOT RUN; Required3와 QA Final은 gate FAIL (본 재실행에서 E2E/Docker 제품 테스트 실패가 아님). TypeScript/Lint/Policy/Preflight는 SUCCESS. `--max-failures`/Required3/Trusted/Ruleset 완화 없음.
- **원인 및 범위:** #3326.1 교정에서 `FILTER_EMPTY_RESET`을 기존 Coordinator로 보냈지만 `request()`가 첫 비동기 checkpoint 이전에 `port.apply()`를 호출한다. 그래서 사용자 `userInput()`이나 새로운 query `contextChanged()`가 같은 JavaScript turn에서 들어와도 native Core write에 이미 진입한 뒤였다. 검증이 경합 취소를 정확히 적발한 **실제 안전 경계 누락**이며 불규칙 CI 장애라고 단정하지 않는다.
- **보완:** `FILTER_EMPTY_RESET`에만 취소 가능한 `port.frame(controller.signal)`을 `port.apply()`보다 먼저 요구하고 그 뒤 `current()` 원 출처·gesture·query 계약을 재확인한다. 해당 프레임 도중 새 입력·query change가 발생하면 `SUPERSEDED`로 종료하고 **Core apply 0**. 무관한 RANGE_EXTENSION/DIAGNOSTIC·기존 viewport intent 동작은 변경하지 않는다. 독립 명령 writer/DOM transform/timeout 증가 없음.
- **테스트 수명:** 기존 negative `port.apply not called`를 유지하고 positive에 `frame 전 apply=0` 단언 추가(EXTEND). 기존 #570 E2E zero 기대, #816/#818/#637 고유 정합성은 KEEP_UNIQUE. 테스트 실행 전 로컬=NOT TESTED, 새 HEAD Full/Trusted/Owner 결과는 실행 뒤에만 판정. #3326.1과 #3327.1 원본 실패/취소·미실행은 보존.
- 리뷰: 원격 review_threads=0, PR mergeable=true, main SHA `dc8543f390616c0d5aca90a4f91899f3cf7ac5da`와 base 일치. 사용자 지시는 수정·원장·PR CI 시작까지이며 CI 모니터링/병합/Main/GHCR/Finalizer/종료 제외.

## ALIGN-822-001 — 최신 Main 30 commits 정렬 / CI Source Provenance (2026-10-28)

- 과거 기본 브랜치 `dc8543f390616c0d5aca90a4f91899f3cf7ac5da`, 최신 `main` `ed82de78f243291251ed32132a233545654b8920`, PR #823 원 Head `3eb95675c09e00a510480915efae2470f3ba42b8`. 정확 merge-base가 과거 base이며 Branch 3 ahead / Main 30 ahead, Main 149 files 변경 / PR 32 files 변경. 기존 PR은 latest main에 비해 behind 상태였다.
- 기존 [Full PR #3328.1 / Run 40453138588](https://github.com/planner77/masterGantt/actions/runs/40453138588) 이벤트 pull_request / RunAttempt1 / 정확 이전 Head의 Quality, Build, Unit, E2E 8/8, Docker 및 QA Final Automated는 `SUCCESS`. **그 당시 source 성공**이며 Main 정렬 후 새 Head의 PASS 아님. 앞선 F822-REMOTE-001(#3326 Chromium)·F822-REMOTE-002(#3327 Unit)는 실패 원장에 그대로 남긴다.
- 파일 충돌 경계는 CHANGELOG, PROJECT_UX, TEST_PLAN, exec-plans/active/PLAN, package.json, package-lock.json의 6개. 네 Markdown 모두 서로 다른 상단 추가 블록이고 동일 old-base suffix가 문자 단위로 일치했으므로 #822와 최신 #825/#824 문서 추가 부분을 모두 보존. package/lock는 root version만 다른 동등한 의존성 그래프이며 latest main `0.135.6` 위의 #822 MINOR 후보 `0.136.0` 채택. main의 AGENTS/DESIGN과 #824/#825 전체 구현/검증·바이너리 증거 유지, Gantt source 직접 겹침 없음.
- Main tree 위에 PR 32개 변경 blob을 overlay하고 문서 4개를 순서 있게 합친 two-parent merge commit을 기존 PR 브랜치에 fast-forward(무 force)한다. 충돌 marker·과거 버전 역행/CI 정책·테스트 skip/assertion/timeout 변경 없이 최신 main ancestry 유지.
- 신규 실패가 확인된 것은 아니다. CI #3328.1 성공 뒤 main이 변경되어 검증 출처가 stale한 상황을 **정렬 감사**로 기록한다. 병합된 소스의 로컬 빌드/E2E 실행 환경은 없어 `NOT TESTED`; exact aligned HEAD 신규 Full PR CI + Trusted/Owner 수용이 필요하다. CI 모니터링·main merge·GHCR 게시·Finalizer·이슈 종료는 사용자 지시 밖이다.
- 병합 전 review thread 0, submitted review 0. Risk HIGH, OWNER_MANAGED, qa_required=true, release_required=true, release_authorized=false, manager_decision=NOT TESTED, MERGE_READY=BLOCKED(신규 검증 전).
