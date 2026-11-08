# Issue #889 / #890 — 누적 재현·실패·검증 원장

기준 main ecc15d17 / Core2.7.3 / 후보0.145.1. 로컬과 원격 결과를 구별하며 실패 후 성공으로 최초 실패를 지우지 않는다.

| ID | 분류 | 관측·조치 | 상태 |
| --- | --- | --- | --- |
| L001 | 개발 통합 setup | 공통 wheel listener inputRoot 선언 위치가 잘못된 중간 편집본에서 ReferenceError 발생. density effect 내부로 선언을 옮김. locale 현상 RED로 사용하지 않음. | 최초 FAIL / 수정後 재검증 중 |

원격 PR Full·Trusted·Owner/Manager 및 native125%/실기기touch/실제AT는 NOT TESTED. CI 시작 뒤 모니터링하지 않는다.

## R890-001 — pristine main의 전체 고정 헤더 언어 혼합

기준 main ecc15d17의 별도 detached worktree에서 기존 i18n native layout 시나리오에 전체 헤더 정확값 단언만 추가했다. VI 선택 후 실제 native/DOM copySelection=Select(기대 Chọn), projectStart=Start(기대 Bắt đầu), text=Công việc/projectDuration=Thời lượng가 혼합되어 FAIL했다. 안전한 열 ID/헤더만 관측했으며 Task 본문/인증값은 기록하지 않았다. 원본 로그 /tmp/issue-890-pristine.log, trace는 해당 baseline worktree test-results에 보존한다.

설치 Core2.7.3 Grid의 header line 얕은 참조 공유·번역과 기존 saved.columns의 표시 문자열 재주입 경로를 대조했다. 고정 column ID에서 현재 언어의 새 header 객체를 생성하는 수정과 language/scale/fullscreen 복원 회귀로 검증한다. 별도 최소 standalone harness는 실제 앱 queue timing과 달라 PASS했으므로 증상 재현 근거로 사용하지 않는다. 초기 helper syntax/의존성 symlink 실패도 setup 오류로 구별하며 제품 RED로 세지 않는다.

## R889-001 — pristine main의 View 공통 toolbar 이동

같은 main ecc15d17 별도 worktree의 실제 HTTP/SQLite schedule fixture에서 WBS→Resource 전환 시 View selector X가 745 CSS px 이동하여 공통좌표 허용≤1px 단언이 FAIL했다. /tmp/issue-889-pristine.log와 baseline test-results trace에 원본을 보존했다. 공통 상태 슬롯과 비활성 WBS 명령 geometry를 적용하고 같은 신규 경계/기존 고유 테스트로 재검증한다.

## 로컬 선별 검증 중간값

- `npm test -- tests/features/gantt/gantt-density.test.ts tests/features/gantt/schedule-view-scale.test.ts tests/features/gantt/schedule-view-projection.test.ts tests/features/gantt/week-calendar-interval.test.ts tests/features/day-header-tooltip.test.ts tests/features/gantt/viewport-coordinator.test.ts`: 6파일/158 PASS, exit0. 새 locale Unit 반영 전 중간 source이므로 최종 source에서 해당 영향 재검증 예정.
- 첫 `npm run typecheck`: panel nullable task 전달 2건 FAIL. 제품 Agent가 null 허용 타입을 교정하여 현재 다시 실행 중이다. 원본 진단 /tmp/issue-889-890-typecheck.log 보존.

## L002 — 선별 검사·자동 매핑 경계

- locale 적용 전 첫 fixed Chromium은 기존 openRow(Stable leaf)의 작업 정보 dialog가 열리지 않아 FAIL했다. locale 헤더 단언 전 실패로 #890 원인 증거가 아니며 HMR 여부를 가설로 남겼다. 최종 source의 동일 고유 시나리오로 재검증한다. /tmp/issue-890-fixed-first.log 보존.
- 중간 fast Pre-PR는 UNKNOWN3(panel TSX/CSS/scale helper)·source unstable로 BLOCKED/STALE, 실제 command0이다. report `.prepr-reports/2026-11-08T02-27-00.529Z-1084582-2bd7475b/` 보존. Manager의 수동 생산자/소비자 매핑은 Packet에 별도 기록하며 도구 PASS로 승격하지 않는다.
- Unit9파일231 PASS(exit0), typecheck PASS(exit0), 표적lint 오류0/기존hook경고2, Markdown419파일 PASS, version0.145.1 PASS. source 보완 중의 결과이므로 최종 source와 관련성을 대조한다.
- 독립 qa_docs의 P2: 열린 scale tooltip의locale 잔존·native/projected bar높이 차이·좁은화면 오류가시성·빈본문density·가려진열가로접근·완료/선택style·가상Summary설명. 제품 보완과 표적회귀 뒤 최종 기술판정 예정. 이 사전 검토는 원격Trusted QA나Owner ACCEPT가 아니다.
- 3spec smoke는 확장회귀 추가를 위해15case시작 직후 SIGINT 중단했으며 PASS 증거로 세지 않는다.

## R889-002 — pristine main의 조회 본문 density 입력 누락

별도 pristine HTTP/SQLite direct probe에서 Resource Grid Ctrl+휠의 defaultPrevented=false(기대true)로 FAIL했다. /tmp/issue-889-pristine-density-direct.log 및 baseline trace가 정확한 근거다. 앞선 geometry 단언을 건너뛴 시도는 Week native readiness에서 먼저 실패했으므로 density 근거로 사용하지 않는다. 고정 header 관측 자료는 [정제한 원본열](evidence/issue-889-890/locale-pristine-columns.json)에 보존한다.

## 동결 검증 시작 — 2026-11-08

제품/테스트/scripts/db/deploy/package/config1336입력 SHA256 `6797860d19fde52663ff020b2f48c492b937eaddaa5788130b93b3354306bbeb`에서 Unit9파일231PASS/타입PASS/표적lint오류0·기존hook경고2를 확인했다. 문서와Next생성 next-env는검증제품입력에포함하지않는다. 같은source의Chromium8spec/65case workers1/retries0·기존timeout로실행중이다. 종료원본/실패/수정있으면별도로누적하며결과확인전PASS로선언하지않는다.

## L003 — VI 좁은 화면의 고정 선택 도움말 가림

독립 qa_docs의 같은source 실제 VI390/768/1024/1440 probe에서copy/clear버튼·focus/hit·문서overflow는PASS였으나390 screenshot의고정선택도움말이44pxslot overflow에잘렸다. DESIGN의긴언어고정도움말보존계약에따라P2로처리했다. 기존 ContextHelp의focus/hover/click/Escape·현재locale·top-layer popover를toolbar44pxtrigger로재사용하여전체문구를접근가능하게바꾼다. 새공통component·번역key·권한변경없음.

처음 동결8spec65case 실행은 이보완을위해SIGINT중단했다. 최종리포터38PASS/1interrupted/26NOTRUN/제품FAIL0(4.7분)이며전체PASS가아니다. 최초조회37은종료경계에projection Day3901case가완료되어38로정정했다. 원본 /tmp/issue889-890-final-targeted.log를보존한다. 도움말보완후새source에서schedule7case를선행진단하고최종8spec을다시동결검증한다. 선행진단시작hash ae9d...와이후4edb...의차이는최종CSS보완시간과대조중이며source불안정검사로구별한다.

## L004 — 조회 View의 새 scroll owner 소비자 점검

도움말 보완 후 schedule7case 선행진단의 첫 기존5폭case가390px bar hit에서FAIL했다. 새 panel은 WBS와 같은min720작업면·외부가로scroll을두므로기존테스트의inner[scroll]rect만을물리viewport로간주하는oracle와차이가있다. 실제outer/inner/화면교집합및bar hit를측정하여제품도달불가와테스트owner계약변경을구별한다. 기존실제Chart도달성·문서overflow단언은보존하며원본실패를지우지않는다. 현재그외source실패/응답역전case는진단PASS이고전체최종결과는NOTTESTED다.

VI390 도움말44px버튼이slot밖으로4.40625px잘리는추가geometry를확인하여<=48rem의copy/clear inlinepadding만8→4px로줄였다. 글꼴/문구/명령·44pxhelp target은유지하며같은scope의실제focus/hit/outline을다시검증한다.

## L005 — 선행 진단의 측정 경계 교정

schedule7case 진단은5PASS/2FAIL(4.7분)이다. 첫FAIL은390px에서외부작업면을pan하지않은이전owner행동이며,교정은outer+inner pan뒤물리화면교집합의실제bar hit와rawclick→정확canonical Editor ID까지확장한다. 신규matrixFAIL은32pxborder-box row의하위Grid/Chart content31px를row32px와동일시한측정oracle였다. 실제row의정확32px·Grid/Chart동일contentheight·1pxdivider·bar중심≤1px를구별해검증한다. 기준오차나단언완화로실패를숨기지않으며수정후2case진단과전체동결회귀를별도로기록한다.

도움말focusring도parentoverflowhidden에서상하6px가잘리는것을실측하여부모clip을제거했다. 긴선택건수만status요소에서ellipsis하고버튼은shrinking하지않는다. Locale별help focus/click/Escape·Fullscreen popover는실제확인했고,오라클의이미focused인버튼재focus/scroll-dismiss뒤옛tooltip대기오류·공유서버종료에따른미도달은제품오류와구별한다.

## L006 — 최종 표시 확인과 생성 설정의 귀속

교정 2case는 2PASS(1.6분)다. 390px의 실제 bar click→원본 Editor, 5폭/Week/Fullscreen의 현재 locale tooltip·Grid header와 공통 geometry/density 신규 matrix가 통과했다. loading을 완료 표시 증거로 쓰지 않도록 data-ready 뒤 화면을 다시 캡처한다. 37px add-task 열의 세로 줄바꿈은 native와 같은 폭의 빈 readonly header로 바꾸고 현재 언어 aria/title/disabled를 보존했다.

Raw source hash 변동의 한 원인은 Next.js가 tsconfig.json include에 자동 추가한 isolated UUID type paths 18행이다. 제품/test 변경과 구별한다. 최종 v2는 1336입력의 정규 SHA256 `0b2533867b12834e06988e4ea141a1c564ff119c9b180b72475de293af195317`을 사용한다. 정규화는`.next-e2e-isolated-<UUID>/(dev/)types/**/*.ts`의 include만 제외하며 나머지 모든 tsconfig 필드가 HEAD와 같음을 검증한다. 생성 next-env는 제외하고 raw hash/생성 include 수를 별도 기록한다. 최초 raw0486417b...와 정규0b253386...을 구별하며 종료 뒤 두 생성 파일을 원복하여 raw/정규 일치를 확인한다. 검증기/CI 출처 판정이나 Gate는 변경하지 않는다.

## R890-002 — active sort 보존 누락 (독립 사전검토 P2)

최종 source0b253386...에서 기존65case는65PASS/FAIL0/SKIP0/retries0(9.7분)이지만 active sort AC 누락을 후속 사전검토가 찾았다. KO native 작업명 header click 뒤 row IDs [3,1,2]가 VI 전환/현재 header·실제Core ready 정착 뒤 [1,2,3]으로 돌아갔다. retained=false/exit1, /tmp/issue890-qa-sort.json·/tmp/issue890-qa-sort-3102.cjs가 원본이다. 정적 column.sort 설정과 getState()._sort의 active TSort[]를 구별하지 않은 것이 원인이다. locale snapshot/public sort-tasks 보완과 single/multi/rapid·최신 입력·canonical/selection/scroll/쓰기0 회귀를 추가한다. 이전65PASS는 정확한 이전 source 기록으로 유지하며 새 source PASS로 승계하지 않는다. PR/CI 게시 전 새 동결 회귀·독립 기술재검토가 필요하다.

## R890-003 — 정렬 표시와 fresh receipt의 차이

Locale public sort replay만 적용한 단독 probe는 [3,1,2] 유지로 GREEN이었지만 새 active-sort E2E는 첫 VI 뒤 LATEST_ATTEMPT_semantic_FAILED / CURRENT_OPERATION_FAILED_TIMED_OUT / DOM_MEMBERSHIP_OR_ORDER_MISMATCH로 FAIL했다. actual Core/DOM 정렬과 last-good canonical 순서 receipt가 달랐으며 쓰기0·X120/Y68은 보존됐다. /tmp/issue890-sort-smoke-3102.log와 해당 trace에 원본을 보존한다. 최초3100 실행은 QA3102의 같은 Next dist lock 때문에 테스트 미실행이므로 환경 차단으로 구별한다.

CoreReader는 기존 serialize(tasks)의 canonical 순서와 serialize(tree)의 표시 정렬 순서를 구별해야 한다. 독립 expected sibling preorder와 canonical payload/parent/branch/ID 검증 후에만 정규화하며, 실제 Core/DOM·Y는 기대 표시 순서와 정확 비교한다. 무정렬 경로는 기존 strict reader를 유지하고 recovery의 actual snapshot과 desired canonical 비교를 분리한다. custom comparator는 live desired DTO closure 대신 각 ITask의 기존 projectDisplayKey 원본 필드를 읽어 세대를 구별한다. 단순 ID set 완화나 실제 native 순서를 기대값으로 채택하는 변경은 허용하지 않는다.

## L007 — 역사적 실제 Core 관측 보존

core-reader 변경으로 기존 U2 historical provenance source hash guard가 FAIL했다(선정 Unit174PASS/1FAIL). 원래 관측/시나리오/SHA를 갱신하지 않고 기존 original.snapshot mapping 패턴으로 원본 bytes를 별도 보존한다. 새 core-reader-original.snapshot.txt는 origin/main과 완전 같고 SHA256 `86fb8cdc53f703d985a76febc0ebfbe9f70ba6147e42abe93ec3f2aaf736ab6b`이며 독립 qa_docs가 확인했다. provenance JSON은 captureSourceMappings 한 항목 외 전체가 원본과 동일하다. 현재 reader는 새 실제 Core12시나리오/실행 receipt와 Unit/E2E로 별도 검증한다. 옛 관측을 새 source PASS로 재귀속하거나 source SHA만 치환하지 않는다.

## L008 — 실제 serialize 근인과 최종 reader 역할 분리

초기 정적 'tree만 정렬' 가정은 실제 app와 standalone public Core 모두에서 틀렸다. serialize(tasks/tree) 모두 표시 정렬 순서가 되어 tree만 정규화하면 desired canonical proof가 실패했다. /tmp/issue890-probe-debug.log가 실제 public ID 순서의 근거다. actual source JSON의 siblingOrder로 canonical 순서를 추론하는 B안도 서버 internal ID의 동률 규칙을 재현할 수 없어 채택하지 않았다.

최종은 원본 strict raw reader(실제 복구 계획)와 독립 sort/desired 순서·payload 검증 후 승인하는 reader를 분리한다. Recovery optional verificationCore/beforeVerification은 정상 정렬 no-op, raw no-op sort reset, 날짜/기간의 세대 변화·추가/삭제/parent/Link 복구, stale sort와 잘못된 승인 자료 거부를 검증한다. 기존48 Unit의48ms/3frame은 유지하고 신규14 시나리오만 engine 기본250ms/12frame을 사용했다. 새 시나리오의 최초6FAIL은 추가await를 기존3frame fixture로 검사한 예산 경계였으며 원본 로그는 보존한다.

새 active-sort 소형2회 실패는 가시 header label에 정렬 priority 숫자1/2를 합친 측정과, 의도한 최신 USER_GESTURE에 따라 옛 PASSIVE_RESTORE가 SUPERSEDED된 정상 상태를 generic helper가 거부한 테스트 경계였다. 고정 label은 native .wx-text로 정확 비교하고 priority1/2는 별도 단언을 유지했다. 명시적 최신 gesture 구간에서만 old kind/outcome/reason을 정확 확인하면서 현재 fresh SETTLED를 별도 요구한다. 공통 checker·기존 Unique 테스트는 완화하지 않았다. 소형v3 PASS9.3초 뒤 새 동결66case를 시작했다.

현재 source1339 정규SHA `9425e0521645433d958bc72952feed5618e892d48b2282887e493087a158b5e5`에서 확장 Unit23파일491PASS·타입PASS·표적lint오류0(기존2경고와생성next-env명시ignore경고1), 실제 installed Core12/12 PASS를 확보했다. 최초 current-Core receipt 뒤 approved 중복 guard로 recovery SHA가 바뀐 것을 찾아 prepare-browser+actual runner를 최종 source에서 다시 실행했다. 최신 reader SHA84a6e1d71bc19adb1221a52fde6b4589702990753acc9dde74f6f66618f3d591, recovery SHA26c6447468ba32a85fa236278442d3978034abb88493beba764a0d4ce1459305 및 source8파일/start=end/current·runtime/runner hash를 독립 qa_docs가 재확인했다. 새 runtime/receipt는 과거 실제 capture와 구별하며 unsorted 기본 복구12검증을 sorted product66case의 대체로 쓰지 않는다.

## 최종 동결 로컬 판정 — 2026-11-08

최종1339입력 정규 source9425e0521645433d958bc72952feed5618e892d48b2282887e493087a158b5e5의8spec66case는66PASS/FAIL0/SKIP0/INTERRUPT0/retries0/worker1(8.9분)/exit0이다. 시작과 종료 정규SHA가 같고 종료 raw9f73598d8f3ec76268e052d79bc66132fb78af022219be2e87486144a3d86a3a는 knownUUIDinclude14행뿐이었다. 생성 설정 원복 뒤 raw=정규=9425e052...를 확인한다. Unit23파일491/491 PASS(동일source), 타입/lint오류0·기존2경고/version/Markdown419 PASS다. 최종표시증거는 data-ready 후 다시 캡처했다. 현재Core12 actual 실행·source8파일 일치와 독립6전환/도움말/포커스 ring 증거를 함께 보존한다.

최초 source0b...의65PASS는 active sort AC 누락이 있는 별도 역사적 source이며 최종66PASS와 합산하지 않는다. 모든 제품/측정/fixture/환경 실패·중단은 위에 남긴다. 임시 DEBUG-sort-890는 최종src0이며 historical capture 원본은 mapping 외 불변이다. 원격CI·Trusted/Owner·Manager는 아직 NOT TESTED이고 CI 시작 뒤 모니터링하지 않는다.

## 최종 자동 도구 판정

최종 fast report .prepr-reports/2026-11-08T03-38-37.052Z-1297450-b9f8ec06은 시작/종료fingerprint e174f0d040f176cbacd749b733a677f84b198baca422a6c12f13618344c8ca4a 동일(sourceStable=true), UNKNOWN6/MISSING0/선정36·실행0으로 BLOCKED다. 초기 UNKNOWN3/STALE와 구별한다. 새 product consistency와 historical mapping을 포함한 각 UNKNOWN의 수동 생산자/소비자 선정·실제 Unit491/Chromium66/Core12 증거는 Packet에 기록했다. 도구를 PASS로 승격하거나 mapping/guard를 변경하지 않는다.

## CI-3570-001 — PR #894 Full #3570.1 Chromium Shard 3, #574 zero-result → newest Task reveal (2026-11-08)

- **원본 고정:** [Full PR CI #3570.1, Run 42443918977](https://github.com/planner77/masterGantt/actions/runs/42443918977), Head `25782be168ad6dd664d540f649dd3fcc68c2a194`, base `ecc15d171f08dbb249ff52b13ca616592d1c9ac7`, PR #894 (Refs #889, related #890). Chromium Shard 3 job `128619360826`: 11 PASS / 1 FAIL / 137 NOT RUN (fail-fast). Quality/type/lint/Unit/build/Docker/QA preflight는 PASS, QA Final은 Chromium Required gate 실패로 연쇄 FAIL. 다른 샤드 취소/미실행은 PASS가 아니다.
- **실패 계약(불변):** `tests/e2e/grid-task-start-reveal.spec.ts:188`의 #574 V3. zero-result 필터 복귀 중 사용자가 미래 Task `EDITOR-76`을 클릭한 후 최신 `TASK_REVEAL`은 `SETTLED`와 시작점 좌측 정렬·Core/native 일치여야 한다. 원본에서는 `outcome=NO_SCROLL_CAPACITY`, `startVisible=false`, `aligned=false`, `coreNative=true`. 기존 5초 poll/±1px/취소 및 최신 입력 우선/0 mutation 조건은 변경하지 않는다.
- **원본 Playwright artifact:** 동일 Run의 `playwright-report-shard-3` (artifact `13602019155`), 원본 failure attachment `attachments/3f4c5c7f4658d793bb7a15d448548a99d83b5a7b`. 최신 `FILTER_RETURN=SUPERSEDED/USER_GESTURE` 후 `TASK_REVEAL`은 `WAIT_PROJECTION → PREPARING_GEOMETRY → NO_SCROLL_CAPACITY`로 종료. Axis Transaction 실제 `outcome=FAILED, reason=COMMAND_REJECTED, requestedPosition={left:120,top:0}`; `resize-chart` 확장/물리 복귀 두 명령이 발생했고 native `scrollWidth 2176→3060`, Task `startX=2040`, chart width `905`, Core/native left `120/120`. 단일 실패 attachment만으로 두 resize 중 어떤 exec가 `false`를 반환했는지까지는 단정하지 않는다.
- **원인/경계:** product port의 공통 `exec` 래퍼는 `api.exec()===false`를 즉시 `COMMAND_REJECTED`로 변환해 U4 synthetic extent의 실제 Core/DOM 변화가 이미 있었더라도 독립 후속 axis/viewport 증명 전에 종료시켰다. `TASK_REVEAL` Coordinator, 본래 #574 입력 우선권 및 날짜 정렬 단언을 완화해 해결하지 않는다.
- **설계·보완:** `src/features/gantt/viewport/svar-viewport-port.ts`의 *U4 Axis Transaction 내부* synthetic `resize-chart` 두 번과 같은 트랜잭션의 `scroll-chart`에만 `false` 반환을 미확정 응답으로 수용한다. 축 범위/10년·상한·원래 lease/취소·geometry/용량·Core exact/native ±1px/3 stable frame은 기존 `createAxisTransaction`이 **실제값으로** 완전 검증한다. 증거가 없으면 여전히 TIMEOUT/NO_SCROLL_CAPACITY/FAILED/SUPERSEDED 및 source taint; 독립 Coordinator의 일반 scroll `false`는 기존과 같이 즉시 거부. 재시도 루프, 새 DOM writer, 임의 axis 성공/강제 clamp 없음.
- **TEST_LIFECYCLE_REVIEW:** EXTEND `tests/features/gantt/svar-viewport-port.test.ts` (명령이 `false`를 반환해도 실제 range/좌표가 정착한 양성 및 실제 범위가 전혀 늘지 않은 음성; 일반 명령의 strict false 확인). KEEP_UNIQUE #574 실제 브라우저 회귀는 원본 그대로 유지. 기존 `axis-transaction.test.ts`의 명시 callback false 거부·원본 보호 상한 및 전체 Required3/E2E8/Trusted QA 불변.
- **현재 검증의 경계:** 원본 Trace 분석 및 변경 파일 정적 검토는 수행. 동일 교정 source의 로컬 Node/Vitest/Chromium/typecheck는 연결 환경에 실행 가능한 repo checkout/dependencies가 없어 **NOT TESTED**. 신 HEAD Full PR CI 결과·Trusted QA/Owner/Manager ACCEPT 역시 **NOT TESTED**. 이번 범위는 원장·설계 동기화 후 새 PR CI 자동 시작만 하며 실행 결과 모니터링/병합/Main/GHCR/Issue 종료는 하지 않는다. `MERGE_READY=BLOCKED`, `release_authorized=false`.
