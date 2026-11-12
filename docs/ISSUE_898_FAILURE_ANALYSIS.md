# Issue #898 · #899 로컬 재작업 실패 원장

Primary #898, related #899. baseline main `f9a6488d686ae7e4b3228c8a9fe9c33a7fd00185`; 이전 #904 source `ccb7cd4f997c733a88c2e105a8a7df6a3dc3b75e`, base `4aad8865972e3446f0d34c7ffcfd2bbab439e366`. [보존된 최초 원장](ISSUE_898_899_FAILURE_ANALYSIS.md)의 5개 PR_CI 실패·보완·취소는 역사 근거이고 신규 검증은 로컬만 수행한다. 현재 source/환경/실제 명령·exit와 후속 결과를 아래에 추가한다.

## F898-001 — PLAN 댓글 baseline SHA 오기

- 단계 LOCAL_PREP / 분류 HARNESS / 상태 FAIL 후 정정. Manager가 #898 PLAN의 전체 SHA를 실제 조회 없이 입력해 오기했다. 해당 값은 존재하는 commit/검증 source로 사용하지 않았다.
- 실제 명령 `git rev-parse HEAD`, exit 0: `f9a6488d686ae7e4b3228c8a9fe9c33a7fd00185`. 동일 댓글을 실제 조회값으로 정정하고 정정 이유를 남겼다. [댓글](https://github.com/planner77/masterGantt/issues/898#issuecomment-6813382515).
- 환경 Node22.14.0/npm11.10.0/Linux. 개별 발생 시각/원본 diff 지문 미수집: SCOPED이며 제품 검증/최종 admission 근거가 아니다. 회귀는 Manager의 실제 Git 조회와 source 고정 절차이며 자동 제품 테스트 PASS를 주장하지 않는다.
- 원격 실행 N/A(Owner 정책상 미사용), 정식 게시/운영 배포/Owner UAT NOT TESTED.

## F898-002 — 현행 main의 조회 Grid 단일 클릭 Editor 자동 열림 (#899)

- 단계 PLAYWRIGHT / 분류 PRODUCT / 최초 FAIL. 제품 소스는 baseline main 불변, 기존 #904의 실제 HTTP/SQLite 테스트만 재사용한 dirty 진단 source다. 실제 포인터 Grid 이름 클릭 뒤 dialog count 기대0/실제1이었다.
- 명령 `npm run test:e2e -- tests/e2e/schedule-views.spec.ts --grep '#898' --reporter=list`, exit1: 선택/reveal 1FAIL·기존 고정 휠 좌표 1PASS. 이 휠 PASS는 빈 본문 문제를 덮지 못해 #898 성공 증거로 쓰지 않는다.
- 환경 Linux/Node22.14.0/npm11.10.0/설치 Playwright1.63.0·Chromium 고정 package. 진단 중 개별 전체 source 지문/시각 미수집으로 SCOPED다. 합성 오류 근거 `LOCAL:898-baseline-selection-error`이며 실운영 DB/화면은 사용하지 않았다.
- 원인 후보: Grid 이름 button이 선택과 기존 openTask를 연속 호출. 교정 후보는 클릭 선택/reveal과 명시 정보/더블클릭/Bar를 분리하되 동일 canonical Editor/권한/focus를 재사용한다. 이전 #904의 focus·End/Arrow 최초 회귀도 같은 현행 source에서 재검증한다. 수정 후 실제 결과는 별도 추가한다.

## F898-003 — 빈 WBS Grid scroll층·Chart SVG 실제 휠 밀도 누락 (#898)

- 단계 PLAYWRIGHT / 분류 PRODUCT / 최초 FAIL. baseline main 제품 불변, 기존 physical test를 가시 blank body 실제 hit-test로 확장했다.
- 명령 `npm run test:e2e -- tests/e2e/schedule-views.spec.ts --grep '#898 real' --reporter=list`, exit1/1FAIL, case17.2초(전체 setup 약30초).
- 실제 합성 fixture viewport의 포인터 `(105,953)`은 `DIV.wx-4VuBwK2D.wx-scroll`(row 아님), `(562,953)`은 `SVG.wx-dkx3NwEn.wx-links`(row 아님)였다. 실제 `Control+page.mouse.wheel` 뒤 기대32px/실제34px로 Grid target에서 실패했다. 숫자는 해당 fixture 측정이며 모든 운영 화면 좌표로 일반화하지 않는다.
- 이 실패는 density 누락의 직접 재현이다. 실패 위치에서 browser Page Zoom 독립 지표까지 관측하지 못했으므로 운영 Page Zoom 발생 재현을 주장하지 않는다. 수정 후 성공은 DPR/innerWidth/visualViewport와 앱 geometry를 독립 확인해야 한다.
- 근거 `LOCAL:898-baseline-empty`(진단 output/playwright/issues-898-899/baseline-empty). 환경/출처는 F898-002와 같고 당시 전체 source 지문 미수집으로 SCOPED다. 이전 source의 제한된 휠 PASS·합성 defaultPrevented를 최종 증거로 전용하지 않는다.

## F898-002/003 후속 — 최초 교정 진단 green

- frontend가 기존 #904 제품 patch를 현재 source에 필요한 범위로 이식한 뒤 실제 `--grep '#898'` 두 사례가 2PASS/약1.2분으로 통과했다. source는 추가 중복행/음성/native 회귀 구현 전 WIP이며 최종 exact-source Gate PASS가 아니다. 당시 전체 source fingerprint/개별 시작시각 미수집으로 SCOPED다.
- 이전 baseline red·고정 좌표의 제한적 PASS는 보존한다. 아직 전체 영향 소비자·공통/Docker/admission·운영 장치/Owner UAT는 NOT TESTED다.

## F898-004 — reveal Unit의 별칭 import 통합 오류

- 단계 UNIT / 분류 HARNESS / 최초 FAIL. strict date helper 재사용 시 Vitest가 지원하지 않는 별칭 import를 사용해 suite load1FAIL/다른4testsPASS, exit1이었다. 제품 동작 실패와 구별한다.
- 기존 상대 import 관례로 수정한 뒤 같은 두 파일 Unit7PASS/135ms, exit0. 해당 검사는 WIP SCOPED이며 당시 source 지문·정확 개별 명령/시각은 수집 전이다. 테스트 시작 전 module import 오류이므로 browser/API/최종 Gate 성공 증거로 쓰지 않는다.
- strict date parser를 재사용하며 날짜 rollover를 별도 성공으로 처리하지 않는다. 최종 source에서 실제 Unit·전체 검사와 함께 다시 실행한다.

## F898-005 — 5폭/Week reveal 시험의 scroll capacity 전제 누락

- 단계 PLAYWRIGHT / 분류 HARNESS / 최초 FAIL. 명령 `npm run test:e2e -- tests/e2e/schedule-views.spec.ts tests/e2e/project-summary-bar-visual.spec.ts --grep '#899 projected|#898 real|#822 scopes cancellation' --reporter=list`, exit1/2PASS·1FAIL/약1.6분.
- #899 신규 행렬의 390px/Week/Resource에서 `Expected ALIGNED / Received NO_SCROLL_CAPACITY`로 실패했다(line956, trace 순서 확인). 당시 target/max capacity를 먼저 측정하지 않았으므로 실제 값을 추측해 기록하지 않는다. 근거 `LOCAL:898-capacity`(.prepr-reports/diagnostic-898/capacity/trace.zip,error-context.md).
- Issue는 기존 축/오른쪽 경계를 임의 확장하지 않고 용량 부족을 typed 결과로 명시하도록 요구한다. 테스트의 모든 조합 ALIGNED 전제가 잘못됐다. 교정은 각 조합의 target/max/actual scrollLeft와 barX/splitX/status를 먼저 독립 측정하며, 가능한 경우 기존≤1px 단언을 유지하고 불가능한 경우 NO_SCROLL_CAPACITY·정확 clamp·잔여 오차>1을 단언한다. 허용오차/timeout/retry/skip·제품 축을 바꾸지 않는다.
- 환경은 위 WIP Chromium 진단과 동일하며 당시 전체 source fingerprint/개별 시각 미수집으로 SCOPED다. 교정 후 최종 exact source 실제 재시험 전에는 PASS로 바꾸지 않는다.

## F898-006 — 후속 일반 휠 시험의 양성 scroll 여유 전제 미계측

- 단계 PLAYWRIGHT / 분류 HARNESS / 최초 FAIL. 명령은 F898-005와 같은 세 focused case 실행이며 exit1/1PASS·2FAIL/약2.0분이다.
- #899 20개 matrix의 typed capacity 분기는 통과했으나 그 뒤1440/Day 복귀 후 deltaX120에서 `Expected >0 / Received0`(line1006), 실제 scrollLeft0이었다. 당시 max capacity를 수집하지 않았으므로 제품이 일반 wheel을 무시했거나 충분한 공간이 있었다고 확정하지 않는다.
- 합성 근거 `LOCAL:898-expanded-selection`(.prepr-reports/diagnostic-898/expanded의 해당899 trace/error-context). 후속 시험은 처음의 측정 가능한1440Day에서 target/max/여유와 방향을 먼저 확인하고 서로 다른 Task 실제 클릭→그 이후 일반 wheel→기존 bookmark/RAF가 덮지 않음을 검증한다. 5폭/Week matrix는 그대로 유지한다. 제품 축 확대·허용오차/timeout 완화는 하지 않는다.
- 당시 전체 source 지문/개별 시각 미수집으로 SCOPED다. 과거 max/axis 상태는 UNKNOWN으로 보존하고 현행 source는 실제 양성 전제와 최종 Gate로 별도 검증한다.

## F898-007 — 추가 전체화면 물리 휠의 비취소 이벤트

- 단계 PLAYWRIGHT / 분류 UNKNOWN(원래 hit target 미수집) / 최초 FAIL. F898-006과 같은 명령/실행이다. #898 세 View의 Grid·Chart 독립 전체 profile cycle·Bar/header/input은 진행했으나 추가 Equipment/Week/fullscreen probe에서 `cancelable true` 기대/실제false(line1063, 호출1164)로 중단했다. 이 이벤트의 성공·browser Zoom 차단을 주장하지 않는다.
- trace의 포인터 `(1368,948)`, deltaY120은 관측됐으나 실제 event target을 저장하지 않아 원래 포인터가 frame 밖이었다고 확정하지 않는다. 근거 `LOCAL:898-expanded-fullscreen`(.prepr-reports/diagnostic-898/expanded의 해당898 trace/error-context).
- 후속은 실제 `document.fullscreenElement` owner·가시 row bounds·elementFromPoint의 frame 내부 귀속을 먼저 확인한다. 첫 cancelable 이벤트에서 실제 density/geometry/browser metrics를 검사하며 noncancelable을 PASS로 바꾸거나 skip하지 않는다. 고정 sleep/timeout/retry·제품 listener 범위를 넓히지 않는다.
- 당시 전체 source fingerprint/개별 시각 미수집으로 SCOPED다. 원래 target UNKNOWN은 보존하고 새 정확 source·현재 실제 target 경로의 결과와 분리한다. 운영 Chrome/Edge/hybrid UAT는 계속 NOT TESTED다.

## F898-008 — matrix 이전 native 완료 helper의 무관한 과거 operation 차단

- 단계 PLAYWRIGHT / 분류 HARNESS / 최초 FAIL. `npm run test:e2e -- tests/e2e/schedule-views.spec.ts --grep '#899 projected|#898 real' --reporter=list`, exit1/1PASS·1FAIL/약1.7분. #898 확장 실제 입력은33.1초 PASS였으며 신규 #899는 line992의 추가 `waitForGanttReadiness`가 `CURRENT_OPERATION_FAILED_NO_SCROLL_CAPACITY`를 반환해 중단했다. 이 helper의 다른 readiness blocker는 없었다.
- #899 최초 rapid selection·양성 scroll 여유 측정/그 이후 일반 wheel 우선권은 이 실행에서 통과했다. matrix의 현재 projected geometry와 무관한 과거 native operation의 NO_SCROLL_CAPACITY 완료 판정을 이 helper가 함께 요구했다. helper 자체나 기존 readiness 시험/제품 gate는 수정하지 않는다.
- 교정은 새 matrix만 실제 현재 Core scale unit을 poll하고 기존 axisGeometry(date/Bar left/width vs 현재 native axis)로 필요한 현재 축 계약을 확인한다. 이전 NO_SCROLL_CAPACITY는 성공 정렬로 승격하지 않으며 각 조합의 capacity 분기·≤1px/잔여 오차·실제 scroll 단언은 유지한다.
- 근거 `LOCAL:898-readiness`(.prepr-reports/diagnostic-898/readiness의 해당899 trace/error-context). 당시 WIP 전체 source fingerprint/개별시각 미수집 SCOPED이며 최종 exact Gate·운영 UAT와 별도다.

## 교정 후 최종 freeze 직전 집중 검사 (SCOPED)

- F898-002/005/006/008의 현재 계약 교정 후 `npm run test:e2e -- tests/e2e/schedule-views.spec.ts --grep '#899 projected' --reporter=list` 실제 exit0/1PASS49.8초(전체약1.2분). 모든 중복 표시 경로·선택/명시 Editor Enter/Space·focus·빠른 선택/일반 wheel 우선·5폭/DayWeek의 capacity 분기·fullscreen이 통과했다.
- F898-003/007의 현재 실제 target/fullscreen owner 조건을 갖춘 #898 확장 사례는33.1초 PASS, 기존 #822 실제 입력에 추가한 native blank 시험은4.9초 PASS였다. 각 실제 wheel은 이전 Zoom baseline과 비교하고 row/Bar geometry·source/canonical 쓰기0를 검증했다. 이전 비취소 이벤트/미관측 target은 삭제하거나 소급 PASS로 바꾸지 않는다.
- 직접 typecheck와 변경 소스 lint는 exit0, lint는 기존 hook warnings3/오류0이었다. 원장 구조40Failure/81events/기존7Markdown prefix와465개 Markdown 링크 검산은 실제 PASS였다. 이는 제품 exact-source 최종 Gate를 대신하지 않는다.
- frontend는 지정 제품/테스트 수정을 동결하고 자기 진단 artifact를 ignored `.prepr-reports/diagnostic-898`에 보존했다. Next가 진단 중 만든 next-env.d.ts/tsconfig.json 차이만 원본대로 복원했고 자기 서버 종료/3100 free를 확인했다. 원래 사용자 worktree 변경·운영 DB/서비스는 건드리지 않았다.
- baseline origin/main은 실제 fetch 뒤에도 `f9a6488d686ae7e4b3228c8a9fe9c33a7fd00185`였다. 다음 clean commit의 실제 fast/targeted/docker/admit·독립 최종 QA를 보고서와 Issue에 결속한다. 여기의 작업중 집중 PASS는 source 지문 미수집 SCOPED이며 최종 검증으로 소급 승격하지 않는다. 이미지 NOT PUBLISHED/운영 NOT DEPLOYED/Owner UAT NOT TESTED다.
