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

## F898-009 — exact f1 browser 진입 전 자기 진단 출력 잔존 BLOCKED

- exact source `f1da5ebb88edafe3f2e2e79ca12c1f379bf3fa44`, base `f9a6488d686ae7e4b3228c8a9fe9c33a7fd00185`, fingerprint `edecc134d6087178561e41802776607d77f31574c0338ae5b37aed3a73117ca8`. 환경 지문 `bed4cede1c15093724f318701df5333a949aa62f3fe2e49f498bdb5e303ae131`, Node22.14.0/npm11.10.0/LinuxWSL2。
- 2026-11-12T03:39:44.502Z~03:39:53.890Z, `node scripts/verify-prepr.mjs --mode=targeted --base=f9a6488d686ae7e4b3228c8a9fe9c33a7fd00185 --issue=898 --report-dir=.prepr-reports/final-targeted-01`, exit1/BLOCKED. 실제 Unit10파일140PASS 뒤 `Existing E2E resource: test-results`로 Chromium 실행 전 중단했다. 제품 FAIL/Chromium FAIL이 아니다.
- 원본 report checksum `14d58f561fe52d3643c61da621418efbba3fba5b72d314f4f78860761f38a251`, 파일SHA256 `a279103a064308e2121f10729beca13ef8545fffc5070344db189a193afecdee`. [동시 외부 증거](https://github.com/planner77/masterGantt/issues/898#issuecomment-6813714309).
- frontend가 복사 보존한 자기 마지막 test-results 원본 폴더가 남았다. Manager가 이를 ignored `.prepr-reports/diagnostic-898/final-selection-original-test-results`로 이동 보존하고 같은 source의 targeted02를 시작했다. source/fixture/설치/정책·기존 서비스/운영 DB는 변경하지 않았다. 첫 BLOCKED는 삭제하지 않는다.

## F898-010 — 일반 Grid 날짜 셀 더블클릭 후 행 포커스 소실 (#899 P2)

- 독립 qa_docs는 source f1의 Grid 전체 double-click→openTask 경로에서 `document.activeElement` 귀속 누락을 찾았다. 독립 Chromium nonfocusable div probe는 실제 activeTag=BODY/activeId빈값, exit0/1.3567초였다. 이는 DOM 경계만 실증한 것이며 제품 Escape 결과와 구별했다.
- 제품 red: 별도 detached f1 worktree의 실제 HTTP/SQLite fixture, 독립3301 포트, `npx --no-install playwright test --config tests/config/playwright.cell-focus.config.ts tests/e2e/schedule-views.spec.ts --grep '#899 diagnostic plain date cell' --reporter=list`, exit1/1testFAIL34.7초. Resource/설비 양쪽 실제 datecell dblclick→동일 canonical Editor 열림→Escape 닫힘은 성공했으나 same-row 선택 버튼 focus는 inactive였다. 실제 activeElement는 두 경우 모두 DIV.project-schedule-view-scroll, rowKey=null/projected=true/native=false였다.
- 정정: 처음 정적 경로의 숨긴 WBS fallback 가능성은 가설이었다. 이 앱 재현은 **조회 root로 행 포커스가 소실된 사실**이며 숨긴 WBS focus는 관측되지 않았다. 두 사실을 혼동하지 않는다. 진단에는 테스트/config diff가 있어 전체 source fingerprint 미수집 SCOPED이며 제품 코드는 f1 그대로다.
- 합성 근거 `LOCAL:899-plain-cell-red`(.prepr-reports/cell-focus-source/test-results의 해당 trace/error-context). 실제 운영 DB/화면을 사용하지 않았다.
- 교정 범위: double-click 때 같은 행 선택 버튼을 먼저 focus하고, 작업명 열이 숨겨졌으면 tabIndex=-1 Grid를 프로그램 focus한 뒤 기존 canonical Editor를 연다. Editor 동안 DOM이 교체돼도 동일 rowKey/명령 역할의 Grid를 우선 복원한다. 새 Tab 순서·Editor callback·canonical/서버 writer는 만들지 않는다. 기존 focus-visible token을 Grid에도 적용한다. 새 회귀는 실제 표시열 메뉴로 작업명 보임/숨김×Resource/설비를 검증하며 정확 rowKey·같은 Core/쓰기0를 함께 검사한다. 교정 뒤 실행은 후속 기록으로 구별한다.

## F898-011 — QA 재작업을 위한 f1 전체 Chromium 의도적 중단

- f1의 fast01은 2026-11-12T03:45:32.270Z 실제 PASS: 공통9단계·전체 Unit3976PASS/기존 opt-in3SKIP·production build. checksum `f6842883367511df0a0b27e01198076d634ed47201cc621a78a4af6ca73846ee`/파일SHA256 `32d1558de8d69ad15642bc06f4fb5224cf411752c871162ea40c5e043215bb47`.
- 같은 f1 Docker01은03:45:34.062Z 실제 PASS:10단계·OCI SBOM/provenance·policy·runtime/API/auth·SQLite restart/integrity/FK. checksum `9a30f78913f87145fca8d2d360c79fc013c36ab0ad97d34429086bd12baecc7b`/파일SHA256 `caf5e55d40c8735aa246e3d373bc6543b75e48dff97ba5895071efa16bff2adf`.
- F898-010 해결을 위해 Manager는 자기 verifier와 해당 Playwright process에 SIGINT를 보내 targeted02를 종료했다. 03:40:46.457Z~03:47:17.249Z, exit1/BLOCKED/interrupted=true, Unit140PASS·Chromium12PASS/1interrupted/146not-run. 중단된 i18n 사례의 `Test was interrupted`/`locator.selectOption: Test ended`는 취소 결과이며 원래 제품 회귀 FAIL로 확정하지 않는다. 필요한 미실행을 PASS로 표시하지 않는다.
- report checksum `7eb69828c02cb598d0cdadf195c3a61c9d3a249c24c549791663e580eb1e5c9a`/파일SHA256 `fa3065833155216e2539239d88720d7b2cb8d2338860b6378e708e511f4f2cb1`. 원본 보고/trace·미실행은 보존한다. 새 source 전체 Gate에 f1 PASS를 전용하지 않는다. f1에 admit/Manager ACCEPT/Push/게시를 수행하지 않았다.

## F898-012 — fast/targeted 동시 실행 중 원본 설치 cache bytes 변화

- f1 targeted02의 snapshot verification도 별도로 BLOCKED였다. root tracked source/environment는 stable이었고 복사 설치는 before/copied/originalAfterCopy/snapshotAfterRun 모두 `81f1160925d06ab01ec663b051b5eb4bc79dd9400ea2770d3b046b9df8396330`으로 같았다. 원본 node_modules만 originalAfterRun `b8ddd654ed8613fd41ea2708b16ecb6eaad37a751bea7013837a65542c909966`으로 바뀌었다. 파일34108/dir3308/link35 수는 같고 총683131782→683162408bytes(+30626)였다.
- 읽기 전용 infra 진단에서 실행창 mtime의 현재 파일은 `.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json` 하나(31674bytes/319results/03:43:20.145509Z)였으며 fast Unit 종료03:43:20.815Z와 일치한다. targeted Unit은03:40:56.650Z 종료 후 snapshot을 만들었다. **동시 fast Unit의 Vitest cache 덮어쓰기로 판단되는 강한 시간 근거**지만 변경 전 파일별 hash/bytes가 없어 정확한 변경 파일 전체는 UNKNOWN이다. production build 원인 증거는 없다.
- guard의 차단은 타당하며 cache hash 제외나 정책 완화로 우회하지 않는다. 다음 exact source는 fast 완료 후 targeted를 순차 실행하며 그 동안 원본 root의 Unit/빌드/설치를 병행하지 않는다. Docker는 자체 container 설치를 사용하므로 독립 실행할 수 있다. 이전 BLOCKED/취소를 보존하고 새 source에서 실제 source/설치 일치를 확인한다.

## F898-010 교정 후 집중 GREEN (SCOPED)

- `npm run test:e2e -- tests/e2e/schedule-views.spec.ts --grep '#899 plain Grid|#899 projected' --reporter=list`, 실제 exit0/2PASS/약1.7분. 기존 #899 중복/5폭·scale/Editor/경쟁 회귀41.8초, 새 일반 셀 double-click focus 회귀21.4초였다.
- 새 회귀는 실제 열 메뉴로 작업명 보임/숨김×Resource/설비4조합에서 마지막 중복 표시행의 날짜 셀을 실제 더블클릭하고 정확 canonical Editor/Escape·같은 행 선택 버튼 또는 프로그램 focus Grid·rowKey·같은 WBS Core·canonical snapshot/쓰기0를 단언했다. 본문 입력/readonly 소유권을 바꾸지 않았다.
- source는 교정 코드+문서의 WIP이며 당시 전체 지문 미수집 SCOPED다. 최종 clean commit의 공통·영향·Docker/admit·독립 QA 결과는 이후 실제 보고서에 귀속한다. 이전 f1 결과·미관측 값·취소는 보존한다.
- 명시적 작업명 열 숨김과 별개로, 내부 Grid 가로 스크롤에서 Task 선택 버튼이 부분 clipping된 모든 조합은 이 새 focus 사례에서 전수 검증하지 않았다. 이전 scroll/viewport 인접 회귀와 대표5폭은 계속 실행하며 실기기/AT·Owner UAT와 전체 Cartesian 조합 수용을 주장하지 않는다.

## F898-013 — 진단 worktree/HTML report 생성 코드가 root lint 입력에 포함

- source `f4a07533067324c4e630ae01de27f748d9d66b1c`는 clean/전후불변이었다. final-fast-02(03:53:20.539Z~03:55:40.937Z)는 `FAILED: Lint`, exit1이었다. 별도 red 진단 worktree를 `.prepr-reports/cell-focus-source`에 만든 Manager의 배치 때문에 그 안의 Next 생성 코드가 기존 ESLint 입력이 됐다. 로그104경로 중87은 nested 진단,883errors/8360warnings였다. checksum `1f2f8327c36cda9448808c64794ccb3145c3a1d12bb8fc3e3bb2d6fa52583fc6`.
- 진단 worktree 전체를 source 밖 sibling으로 `git worktree move`해 보존했다. 이후 fast-03(03:57:15.840Z~03:58:21.193Z)도 이전 f1 HTML trace viewer 생성 JS7개가 남아259errors/2815warnings로 lint FAIL(exit1)이었다. checksum `e6cb8b8613de8046d618e19741a2d81b35de871518951f78cc40ac5cbe5629e9`. 첫 환경 정리가 이 범위를 포함하지 못했다.
- HTML report 전체도 source 밖 sibling archive로 이동 보존하고 보고 폴더의 생성 JS/TS가0개임을 확인했다. ESLint 설정·제품·테스트·설치·기존 trace/로그를 수정하거나 지우지 않았다. [외부 최초 기록](https://github.com/planner77/masterGantt/issues/898#issuecomment-6813999368), [후속 기록](https://github.com/planner77/masterGantt/issues/898#issuecomment-6814052705).
- 같은 f4의 fast-04(03:59:18.657Z~04:02:37.049Z)는 공통9단계 exit0/PASS,319 Unit파일3976PASS/0FAIL/기존opt-in3SKIP·production build였다. checksum `bcca248af6f58a40839aa84b15bc6f672de370add0d2acd231154e23828d3a3e`. 이 회복은 f4 공통 검사에만 귀속하며 아래 snapshot BLOCKED를 전체 PASS로 바꾸지 않는다.

## F898-014 — 실제 160 Chromium PASS 후 legacy 출력의 source snapshot 변경

- exact f4, `node scripts/verify-prepr.mjs --mode=targeted --base=f9a6488d686ae7e4b3228c8a9fe9c33a7fd00185 --issue=898 --report-dir=.prepr-reports/final-targeted-03`,03:02가 아니라 **2026-11-12T04:02:57.464Z~04:33:24.115Z**, 전체 exit1/BLOCKED. report checksum `676a5b0cba8172b8cf1c583ab1bb19f293b53f7c686ba1a4e59427f1278e7748`.
- 개별 실행은 실제 Unit10파일140PASS와 Chromium19파일160PASS/0FAIL/0SKIP(Chromium command exit0/1792878ms)이었다. 그러나 snapshot guard는 `snapshot 입력/Head/파일 목록 근거가 다릅니다`로 차단했다. 전체 PASS/admit/Push를 주장하지 않는다.
- 최초 조사에서 untracked16개를 확인했고 독립 QA는 추가로 tracked15개 변경을 확인했다. 이 중 Next 표준 생성 metadata2개와 **legacy 출력13개 덮어쓰기**를 구별한다. untracked16은 #463 partial geometry5JSON, #818 PNG2, #889/#890 View PNG7, #258 PNG2였다. tracked13은 #463 dashboard5PNG+stage-table5PNG+geometry.json 및 #258390/1440PNG였다. 따라서 dirty를 Next2만의 변화로 단정한 앞선 가설은 정정한다.
- 독립 재검산: src/tests1221파일의 audit.before SHA와 실제 `git show f4` bytes 일치, audit의 src/tests before/after변경0, index동일, 의존성5시점 manifest `261c68a56fd7f037496dd82b78f544fff936f9871215843356fd7aefc290f20d` 전부동일. Next2는 기존 validateNextGenerated 허용 형식이었다. 앱/테스트 코드가 바뀐 FAIL과는 구별하지만 이미지/JSON source 변경도 guard가 정상 거부해야 한다.
- UIv2 canonical16개의 무결성/원본test·helper SHA와 대표 Resource1440/Equipment390/VI1440 PNG를 독립 확인했다. controlled-negative-selector-offset1개 수치FAIL은 의도적 음성이다. 신규 #8992개는 fixture DECLARATION_ONLY와 dirty 관측이라 baseline 비교/Owner UAT 승인으로 쓰지 않는다. f4 전체 source guard는 BLOCKED다.
- QA 보조검산에서 logFile을 reportdir 대신 repo 기준으로 읽은 ENOENT/exit1을 실제 reportdir로 정정해19logs 재해시가 exit0이었다. ephemeral browser-source의 자동 삭제 후 그 옛 경로를 읽은 오류/validator directory-missing BLOCKED도 보존한다. 실제 보존 report.artifacts의 test-results를 사용한 runner/UI 재검산은 exit0이었다. 이 조회 오류들은 제품 FAIL이 아니며 after 파일 직접 재해시가 가능한 것처럼 주장하지 않는다. audit/Git source·test 대조와 보존된 실제 runner bytes의 범위를 구별했다.
- 교정은 기존4spec의 **출력 목적지만** Playwright testInfo.outputPath로 이동한다: milestone-dashboard-state의 #463 PNG/JSON16변형, project-summary-bar-visual의 #818 PNG2, project-task-editor-persistence의 #258 PNG4, schedule-views의 #880/#889 PNG7. 총29변형/10write호출+mkdir1이다. 기존 attachments/geometry/assertion/threshold/timeout/retry/skip/fixture와 committed PNG/JSON/golden은 유지한다. scripts/tests 검색에서 해당 파일을 읽는 test/golden 소비자는 없고 역사 문서만 참조했다.
- 변경4files를 출력 문자열 역치환하면 f4의 동일 files와 완전 같은 bytes임을 검산했다. 관련 typecheck/4spec lint(오류·경고0)/diffcheck는 exit0이고 새로운 출력 경로의 실제 Chromium은 다음 exact source 전체 Gate에서 재검증한다. guard allowlist/ignore/Git 기준을 넓혀 우회하지 않는다.

## 합성 UAT 데이터 재사용 준비 (Owner 수용 아님)

- 자기 f4 browser snapshot의 실제 schedule-views isolated SQLite를 mode=ro/query_only로 식별했다. Task/개인/Group/설비와 마지막 ARCHIVE-880 exact self/whole binding·직접설비2·개인assignment2까지 seed완료를 확인하고 online backup했다. 공용 mock DB·운영 DB는 사용하지 않았다.
- 캡처04:27:05.117015Z~04:27:05.227183Z, 새 소유0700/tmp 폴더/0600baseline·manifest. baseline SHA256 `d0d9ff828d952fbbe0ce7128734a286792dc4598612330764f5f49d31730e249`, manifest SHA256 `c314f2d5256fa27b5ee2f3aacb488b1287314e6ffe3def0bb2aae3e0a15ff73a`。복사본에서 기존 inspectSqliteSnapshot/assertImageMigrationCompatibility를 재사용해 integrity/FK·73tables/38migrations/exactSQL/pending0을 확인했다.
- 활성 test title은 직접 연결 증거가 없어 UNKNOWN으로 보존한다. fixture 소스/spec hashes와 actual source f4·시각은 manifest에 있다. 이것은 특정 test case PASS나 clean UI capture의 대체 증거가 아니다. 새 검증 source의 앱/fixture bytes 호환을 확인하고 같은 새 이미지에 별도 runtime copy를 연결해야 하며 Owner UAT는 NOT TESTED다. 원본 baseline은 변경하지 않는다.

## F898-015 — 원장 초안의 PASS verification 누락과 버전 metadata 정정

- 새 F898-013 회복 PASS event를 초안 작성하며 verification의 source/환경·image/backup 결속을 누락해 `node scripts/verify-issue-ledger.mjs --base=f4a07533067324c4e630ae01de27f748d9d66b1c`가 실제 FAIL(두 결속 오류)이었다. 제품/검증기 결함이 아닌 Manager 원장 작성 오류다.
- 실제 f4 report의 source/환경과 null image/backup을 verification에 명시해 같은 구조 검산이 exit0/PASS(9issues/46failures/93events)였다. 이 PASS는 원장 구조·원본 보존 검사뿐이며 전체 source admission을 뜻하지 않는다. 초안 전체 지문/개별 시각은 미수집 SCOPED다.
- 함께 확인한 F898-009~012 최초 environmentVersion0.145.1은 복사 오기였다. 보존된 f1 원본 report의 실제 packageVersion은0.145.2다. 기존 event prefix를 수정하지 않고 각 version_metadata_correction 후속 event로 정정했다. 최초 FAIL/BLOCKED·실제 source SHA/명령/결과는 바꾸지 않았다. 새 F898-013/014의 실제 환경 버전은0.145.2로 기록한다.
