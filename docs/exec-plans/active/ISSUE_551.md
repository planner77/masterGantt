# Issue #551 — compact Milestone Timeline / 날짜·레이아웃 동기화

## Issue Work Packet

- issue: https://github.com/planner77/masterGantt/issues/551, Epic #548 MT3. 최신 OPEN/comments0, 조회된 branch 없음. 등록-only 과거 문구는 최신 #549~#553 구현·PR CI 시작 요청으로 대체한다.
- phase: ANALYSIS → PLAN → VERSION_DECIDED → BRANCH_READY → IMPLEMENTING → LOCAL_VALIDATED → DOCUMENTATION_SYNC → PRE_QA → PR_CI_STARTED.
- live main: 08ac7749efc4544dfc125853d9e58ef3a9d56b21 /0.102.1.
- predecessor: #550 PR #559 https://github.com/planner77/masterGantt/pull/559, head31345da9346dfbdc1ac02e4e7ca567edafec775f, tree dfbed320c9f63b04a6bb025dd080a350f368b8a8 /0.104.0. exact-head CI37806909407/2216.1 등록 확인, 결과 미조회/NOT TESTED.
- baseline/parent: 31345da9346dfbdc1ac02e4e7ca567edafec775f. 선행 미병합이므로 stacked base feat/issue-550-milestone-management를 사용한다. main 통합/선행 CI PASS로 과대 표시하지 않는다.
- branch/worktree: feat/issue-551-milestone-timeline-lane / /home/planner/Dev/masterGantt-worktrees/issue-551. infra가 exact parent에서 fresh branch를 만든다.
- version: Manager 후보 MINOR0.104.0→0.105.0, 새로운 날짜 Timeline capability 추가. package/rootlock/CHANGELOG는 Manager 소유.
- release_required=true / release_authorized=false. 요청 endpoint PR CI 등록까지만, CI 결과 모니터링/merge/main/GHCR/tag/Issue 종료/cleanup 비범위.

## AC / scope / non-scope

#549의 전체 canonical Milestone 모집단·단일 date adapter와 #550 동일 Editor/관리 gateway를 재사용한 앱 소유 compact lane을 준비한다. 실제 기본 행/빠른 보기 전환은 #552이므로 현재 M native 행·빠른 보기를 유지하고 #551 lane의 기본 활성화는 하지 않는다. 동일 Gantt 인스턴스의 opt-in component interface와 development-only 실제 browser 실험 경로로 검증한다. production 코드의 lane capability는 구현하지만 테스트 제어 hook은 production에 생성하지 않는다.

Chart plot의 실제 x원점·폭·date axis·가로 scroll을 공유하고 Grid 대응 header 공간과 모든 row y/height를 일치시킨다. 한정된 lane 높이/같은 날짜 cluster/근접 label overlap/긴 이름/많은 marker/clip/전체0·viewport0·invalid 날짜를 구별한다. 날짜 anchor를 이동시키지 않는다. native button과 접근 가능한 cluster 목록, keyboard/Enter/Space/목록 방향키/Home/End/Escape/focus, 선택 삭제·날짜 변경·타Project·OFF overlay 정리·dirty/pending/stale를 다룬다. 전체 E(M)에서 가시 일반 Task 강조만 허용하고 Task multi-selection/clipboard와 marker identity를 분리한다.

hover/focus/선택 하나의 pointer-events:none guide line만 제공한다. 기존 Task pointer/context/drag/resize/Dependency hit area와 날짜 tooltip을 유지한다. Day/Week, scroll/resize/Grid열변경/fullscreen/dynamic 확장/상위탭복귀·M-only·Task0·same revision edit response를 같은 Gantt API와 canonical queue에 통합한다. hidden/zero-size를 정상측정으로 저장하지 않고 observer/listener/RAF는 bounded cleanup, 새 사용자 scroll/selection이 stale restore보다 우선한다.

**필수 선행 gate**: #549 독립 QA의 Week 월·연도 헤더 의미 FAIL(2027-01-01 위 July2026, 2026-03-10 위 November2025). 원인/변경 전 baseline NOT TESTED. native anchor±1px만으로 gate 통과 불가. 같은 Gregorian canonical date와 실제 Day 셀/ISO week 구간/월·연도 header boundary를 대조하는 actual E2E oracle을 먼저 확보하고 원인·지원 대안을 검증한다. DST/윤일/월말/연말/scroll/resize/scale/dynamic 포함. 해결 전 lane 좌표 표시를 활성화하지 않는다. 비공개 Core store 수정/PRO 구현 복제/DOM scroll 강제/새 패키지/버전변경/remount로 해결하지 않는다.

비범위: #552 production preference·행 제거·quickview 교체, 새로운 server/API/DB/Membership/Ready/scheduling algorithm, PRO markers/DnD/새 관계 graph, #497 미구현 복합 scope/M root, #556 툴바 전면 정돈, 새로운 Timeline Export.

## ownership / delegation / docs

- Manager: Packet/PLAN/package/rootlock/CHANGELOG, 단계·version·activation 경계·interface 조정, DOCUMENTATION_SYNC 판정, 공식 Issue 댓글.
- infra: branch 준비와 최종 GO 후 API exact tree/commit/ref→public fetch/local equality→stacked PR→exact-head CI 등록 metadata. 제품/docs/version 쓰기와 CI 결과조회 금지.
- ui_ux: read-only DESIGN/공통UX/Issue 기반 배치·높이/marker·cluster interaction·keyboard/focus·5폭 설계와 최종 실제 evidence 비교. 현재 48/88px 후보를 실측 승인 예산으로 간주하지 않는다.
- researcher: read-only 공식 SVAR Core/public geometry/filter/scroll/markers 경계와 설치2.7.3/store2.7.2의 Week header 문제 후보 조사. 공식 자료만 인용, 공개 typed derived state의 version coupling 구별. 원인 확정은 actual baseline/current browser 필요.
- frontend primary: src/features/gantt/project-gantt.tsx, milestone-timeline-adapter.ts, 새 lane component/model/CSS, 필요한 src/features/projects/project-readonly-view.tsx command bridge, 직접 관련 Unit/새 tests/e2e/milestone-timeline-lane.spec.ts와 선별 합성PNGJSON. Workspace/Gantt/CSS 유일 writer. API/domain/server/shared fixtures/config/version/Packet/PLAN 변경은 별도 Manager 허가 없으면 금지. 기존 구현과 타Agent 편집을 되돌리지 않는다.
- frontend documentation_owner: MILESTONE_TIMELINE/PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN. 날짜 helper/public boundary 변경시 PRO_FEATURE_MATRIX/ARCHITECTURE를 영향검토하고 필요한 실제갱신. REQUIREMENTS/기존Editor계약 변경 필요시 Manager에게 반환. DESIGN/AGENTS/API/DB/Scheduling/Security/ImportExport/CIdeploy는 항목별 N/A 또는 필요한변경근거.
- scheduler: 필요시 read-only 순수 날짜/정렬/cluster 계약 자문. 파일 쓰기는 별도 정확 소유권 배정 후만.
- qa_docs: DOCUMENTATION_SYNC PASS 후 actual staged tree 독립 PRE_QA, 구현자 자체PASS와 공식remote gate 구별.
- issue_comment_writer=manager / agent issue_comment_allowed_types=NONE. 모든 Agent read/write 범위 준수, 최대 동시6, 재귀위임/공유파일동시쓰기 금지.

## evidence / handoff

AGENTS/ISSUE_LIFECYCLE/AGENT_PROMPTS/DESIGN/UI_UX_GUIDELINES/PROJECT_UX/MILESTONE_TIMELINE/TEST_PLAN/active PLAN과 관련 API/DB/SECURITY/ARCHITECTURE/SCHEDULING_ENGINE/REMOTE_VALIDATION/CI_CD/GITHUB_OPERATIONS를 읽는다. 관련 실제 #549/#550/#514/#367/#372/#518/#528 및 기존 reference 이슈들을 확인한다. 코드 작성 전에 node_modules/next/dist/docs의 해당 guide를 읽는다. UI skill 사용을 알리고 해당 SKILL을 읽는다.

LFF는 직접 Unit/typecheck/변경lint/date-header 실제 browser oracle와 lane5폭/keyboard/cluster/guidehit/row alignment/viewport와 continuity targeted Chromium이다. 전체Vitest/전체Playwright/Docker 반복하지 않는다. 최초FAIL·sourcehash·명령/exit·known limitations를 보존한다. synthetic API+actualCore UI와 actualserver/production증거를 혼합하지 않는다. PNG/JSON은 합성fixture·timestamp/sourcehash를 포함, DB/runtime logs/trace/build/credentials는Git제외.

ui_ux 설계·researcher 자료→Manager interface/공간/gate 결정→frontend date/header gate·lane capability 구현/검증→DOCUMENTATION_SYNC→독립 UI비교/PRE_QA→infra 게시GO→PR CI 등록→결과 미조회 상태로 #552 인계한다. 모든원격결과/QA_FINAL/Manager ACCEPT는 NOT TESTED로 남긴다.


## 설계·공식 자료 인계와 Manager 공간 결정

ui_ux는 plot 원점/8px control 여유·날짜 tick불변·같은 날짜 및 근접날짜 hitcluster의 차이·roving nativebuttons·cluster50페이지·Grid-only lane없음/Chart-only fullplot을권고했다. Manager는새Timeline의pointer/keyboard 공통 target44px(높이/최소폭), 단일lane64px, 상하10px 중6pxoutline외곽+4px여유, label최대160px·최대lane1을선택했다. 기존48/32 및88두줄은 실측PASS 없는 후보이며현재구현예산으로쓰지않는다. 이결정은기존44px규칙을모든제품control로확대한것이아니라새Timeline설계다. 실제5폭geometry와pointer/keyboard/focus은검증전NOT TESTED다.

2026-10-09 researcher 공식문서·설치metadata read-only 확인PASS: Core2.7.3/store2.7.2, 공개filter-tasks/scroll-chart/getState/scales(format(date,next)), markers PRO. _scales/_chartWidth/_weekStart는설치typed derived state이지만안정geometry문서계약이아니며package-rootgetDiffer와기존단일adapter의version결합을구별한다. Week원인은문서만으로확정불가. frontend는제품source불변before actualdate/headeroracle를먼저실행하며월셀rounding누적후보는현재추론이다. scheduler는Gregorian date-only/localDate/ISOweek·월·연도경계의순수oracle를read-only독립검토한다. 기존#367/#372/#514/#528 최신Issue CLOSED본문을읽고경계를보존한다.


## 날짜/header before FAIL 및 공개 대안 검증 결정

제품baseline31345da 소스불변의 실제4Task×Day/Week=8관측에서nativeanchor±1px는일치하지만Monthsemantic3FAIL을확인했다. 2026-03-10위November2025/2027-01-01위July2026재현과lowerISO주차1주선행관찰이다. before capturedAt2026-10-08T16:19:55.634Z, /tmp/issue551-frontend-header-before의stdout/exit/time/hash 및선별8PNG/JSON을보존한다. 기본localeweekStart0과ISOformatterMonday차이는추가실제진단하며월부분weekround누적은진단전후보로구별한다.

Manager 공개대안 검증GO: bounded dev-only read진단, scoped 공개Locale calendar.weekStart=1, Week상위행만week step1/format(date,next)의실제Gregorian월·연도span과accessiblefullISOinterval표시. Day month/day는유지한다. 기존native월셀오류를수정한것으로보고하지않으며지원public표현을정확weeklycalendarinterval로대체한다. 원래월1일nativecellboundaryPASS라고하지않고Gregorian월1일x가실제주cell내부어디에위치하는지별도oracle로검증한다. scheduler독립calendar자문PASS, 실제browser게이트는NOT TESTED이며canonicalGregorian/ISOweek-year가다른Jan1/Dec30·윤일·DST경계를구별한다. ui_ux추가semantic/label검토와frontendactual공개대안PASS뒤lane구현을진행한다.


## bounded 진단 실제 원인과 Week 대안 의미 확정

frontend 실제진단에서 Week._weekStart=0/native start2024-02-25를확인했다. lower168weekcells 총11424px=scale.width11424, upper40monthcells 총13668px로2244px초과였다. Day lower1065cells/upper36monthcells는총38340px로일치한다. 설치resetScales의각월부분week unitSize올림과총폭불일치, Sundaynativecell에이전MondayISOformatter/class가붙는별개의의미경계를실제date/class로대조했다. diagnostic JSON과당시sourcehash를보존하며단순정적후보와실제관측을구별한다.

ui_ux 조건부설계PASS: Week상단은각주가포함하는월·연도이다. [Monday,nextMonday)에서lastincludeddate까지만월·연도span에포함하고기존calendar helper로계산한다. 같은월2027.01/두월2027.01→02/두해2026.12→2027.01, fullISOinterval과Gregorian/ISOweek-year를accessibleWeekdetail/tooltip로확인한다. narrowcell ellipsis와fullkeyboard정보를구별한다. canonicaldate in실제weekinterval/lowerISO/upperGregorianspan/month1일의cell내부위치를실제DOMoracle로검증한다. 실제대안PASS전에는lanegate미통과다. target44/lane64/상하10/6pxring+4px여유설계계산PASS, 390pointerfine합성은actualtouchPASS가아니다.


## 초기 공개 date/header gate 검증과 lane sibling 결정

최신공개대안 actual1case/9.1초 PASS는 NY1440의4날짜×DayWeek8관측+실제Gregorian월1일의Week내부위치3+keyboard Weekfullspan4검증이다. /tmp/issue551-frontend-header-gate 로그/exit/sourcehash를보존한다. 신규format10(1900/2199의2200metadata/invalidclass 포함)+기존Sundayanchor지원weekTooltip8=고유18Unit PASS, 초기13은중복역사로구별한다. typecheck/linterror0/기존hookwarning4·새warning0, 최초진단typeddate/array type오류2를보존했다. 이결과는아직fullDST/5폭/scrollresize/dynamic/fullscreen/peer/lane전체gatePASS가아니다.

Manager lane구현GO: 항상존재하는같은Gantt소유wrapper/ancestry/key, 앱소유sibling64px의Grid대응+plotlane → 기존nativeGrid/dateheader → nativeTaskrows 순서다. lane는기존dateheader위에놓이고Core내DOM삽입/scaleHeight변경/가짜Taskrow없다. OFF는64→0으로동일작업면의공간을반환한다. actualrowy/height·readonlyplotbbox+typedderivedstate의version결합·boundedqueue/observer/RAF·hidden0failclosed·390physicalclip/Tab제외/접근가능한전체목록진입·pointer:none guide를실제검증한다. proposed timelineModel/activeMilestoneTaskId/onOpenMilestone(taskId,actualtrigger)/enabled defaultfalse interface를승인하고fullcanonical Timeline과nativeTaskselectionclipboard를분리한다. defaultproduction전환은552이며최종추가실제gate와독립비교를거친다.

## 날짜 상한과 초기 lane 검증의 범위

지원 입력 범위는 기존 1900-01-01~2199-12-31을 유지한다. 마지막 날짜의 ISO metadata `2200-W01`과 exclusive interval 끝은 UI 표시용 local calendar field 연산으로 다루며 domain 입력 범위를 넓히지 않는다. 주 전체가 지원 Calendar 범위를 벗어나면 근무일 수를 부분 날짜의 합으로 표시하지 않고 `미산정`과 이유를 제공한다. 기존 정상 범위의 Sunday 기반 Week tooltip 계약은 유지한다.

최초 2199 Milestone-only browser 실행은 readiness timeout FAIL이었다. 실제 현재 시각에서 축이 173년으로 늘어난 실행과, browser clock을 2199-12-01로 고정한 작은 축의 1 case PASS/4.2초를 구별한다. 후자는 ISO metadata·keyboard 미산정 이유·pageerror0·mutation0의 증거이며 실제 현재 시각의 전체 날짜 범위 성능 PASS가 아니다. 최초 FAIL 로그와 각 source manifest를 보존한다.

초기 targeted browser 7 case PASS/19.2초는 date/header, 작은 날짜 상한 fixture, 5폭 lane geometry 관측이다. 실제 focus ring/hit·cluster/Editor 복귀·peer/fullscreen/Grid 변화·대형 입력의 최종 판정을 대체하지 않는다. 390px에서 가로 이동 후 전체 목록 버튼이 가려지는 후속 실제 FAIL을 보존한다. Manager는 앱 소유 wrapper의 `overflow:clip`과 단일 adapter의 `controlLeft` 보완을 승인했다. 날짜 tick·논리 plot 원점은 유지하고, 실제 outer scroll owner의 물리 clip과 목록 control이 가리는 조작 영역을 구별한다. 기존 Task popup·scroll·focus clipping도 함께 확인한다.

Chart를 포함한 enabled 상태의 64px slot은 측정 실패나 peer view 숨김과 무관하게 유지한다. 숨길 때 marker와 overlay만 정리하여 같은 Gantt의 Chart 높이·scrollTop이 불필요하게 줄어들지 않게 한다. OFF 또는 명시적인 Grid-only에서 slot을 0으로 반환한다. 전체 canonical Timeline model은 snapshot 변경 시 계산하고 per-scroll E/P graph 재구성을 하지 않는다.

## 이름 표시 예산의 추가 설계 결정

ui_ux 독립 중간 검토는 초기 glyph-only control을 이름 표시 AC 미충족으로 판정했다. Manager는 이름이 보이는 2줄 control을 승인했다. 44px 높이 안에서 첫 줄 glyph12px+gap4px+ellipsis 이름(line-height16px), 둘째 줄 기록 상태·Gate(line-height12px), 줄 gap2px·상하 padding6px·border2px을 사용한다. 개별 읽기 최소96px/최대160px, 묶음 최소120px/최대160px은 border-box 예산이다. 가용 폭이 부족하면 이름을 없애는 대신 전체 목록으로 접근한다.

묶음의 첫 줄은 `N개 Milestone`, 둘째 줄은 동일일 또는 근접 날짜 범위다. 첫 항목의 상태를 묶음 전체 상태로 표시하지 않는다. 실제 전체 control/label bbox 양쪽의 6px focus 외곽+2px 여유를 충돌 기준으로 사용한다. sticky 목록과 오른쪽 물리 clip에 맞춰 clamp한 뒤에도 최종 비중첩을 확인한다. 원래 날짜 tick과 guide 좌표는 control 중심으로 이동하지 않는다. 이 설계 결정은 실제 geometry/keyboard/hit 검증 PASS와 별개다.

기존 앱의 production Core displayMode는 `all`이다. Grid-only/Chart-only의 실제 opt-in 기술 검증은 기존 development-only bounded probe에서 공개 displayMode prop `all/grid/chart`만 전환하여 수행한다. production 제어 hook이나 사용자 명령을 추가하지 않으며 같은 wrapper/key/Gantt 인스턴스를 유지한다. Grid-only는 lane 없음, Chart-only는 실제 전체 plot 원점·폭으로 검증한다.

최신 초기 17 case 실행은 16 PASS/1 FAIL(47.7초)이었다. 실패는 Grid-only에서 DOM 제거를 가정한 oracle이며 실제 hidden DOM과 lane0으로 정정한다. 후속 실제 Chart-only는 왼쪽 Core 고유 rail42px을 관측했다. Manager는 rail을 제외한 실제 날짜 plot 원점·폭을 lane 기준으로 승인했다. widget 전체폭 equality를 주장하지 않고 rail bbox+plot bbox·원점의 실제 합과 lane 정렬을 비교한다. rail 제거·가짜 geometry·Core 내부 수정은 하지 않는다. 두 초기 oracle FAIL과 React Core key warning은 보존한다. nonzero native wheel scroll 후 peer의 Chart 높이·top·left 보존 관측 PASS도 최종 같은 source 실행과 구별하여 기록한다.

## 문서 영향 분석 초안

MILESTONE_TIMELINE/PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN은 새 lane·Week 표시 의미·keyboard/focus·상태·geometry 지원 범위와 실제 증거를 갱신한다. ARCHITECTURE/PRO_FEATURE_MATRIX는 앱 소유 lane과 공개 Locale/scales, 설치 버전에 결합된 read-only geometry adapter의 경계를 검토한다. 최종 구현 후 작성자의 Result Contract와 diff를 대조하여 DOCUMENTATION_SYNC를 판정하며, 현재는 gate PASS가 아니다.

DESIGN/AGENTS는 기존 시각 언어와 역할을 적용하므로 N/A다. API/DB_SCHEMA/SECURITY는 server gateway·session/Origin/revision·storage를 변경하지 않으므로 N/A다. SCHEDULING_ENGINE은 date-only 입력 범위·Calendar·requested/effective 일정 알고리즘을 변경하지 않으므로 N/A다. IMPORT_SCHEMA/VBA_EXPORT/내보내기 계약은 canonical 전체 데이터와 기존 교환·renderer를 유지하므로 N/A다. DEPLOYMENT/CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS는 workflow·권한·배포·검증 정책을 변경하지 않으므로 N/A다. 새로운 unit/targeted browser 실행 기록은 TEST_PLAN과 본 Packet에 남기며 로컬 PASS를 원격 PASS로 대체하지 않는다.

## 추가 실행 이력과 남은 동결 검증

대형 합성 Task1000+Milestone2000의 peer/splitter/fullscreen/resize·동일 인스턴스, canonical 대상 소멸/같은 ID 복귀 자동재개 차단, OFF 중 Editor 유지·native M 선택0의 중간 3 case PASS/12.6초와 390 목록/이름 보완 후 3 case PASS/8.9초를 보존했다. 중간 Unit28/typecheck0은 최종 source 검증과 구별한다.

상태/touch 추가 실행은 3 PASS/1 FAIL이었다. dirty 초안·Escape 확인은 통과했으나 테스트가 기존 Editor의 `변경사항 버리고 닫기`를 생성 form의 `초안 버리고 닫기`로 찾은 oracle 오류여서 제품 변경 없이 selector를 정정했다. touch emulation은 실물 기기 PASS가 아니다.

Chart-only의 실제 42px은 collapsed Grid rail38px+resizer4px이며 두 bbox와 날짜 plot 합을 비교한 후속 case는 PASS였다. 이후 17 case 실행의 16 PASS/1 FAIL(43.2초)은 peer 복귀·splitter resize의 lane 측정 완료 전 bbox 조회 경계였다. 현재 source/API/문맥/display·canonical queue와 실제 좌표가 settled된 상태를 기다리는 oracle로 재검증한다. 임의 sleep·허용오차 확대·최초 FAIL 삭제는 하지 않는다. 최종 전체 동일 source suite·type/lint·6개 문서·선별 증거 동결 전 LOCAL_VALIDATED/DOCUMENTATION_SYNC/PRE_QA 최종 판정은 NOT TESTED다.

## peer/resize 재발에 따른 Manager REWORK

5폭×Day/Week의 실제 lane/native anchor 보완 실행에서도 전체는 16 PASS/1 FAIL(50.8초)이었다. peer 복귀·splitter resize 뒤 projection이 5초 동안 준비되지 않아 앞선 완료 oracle 보완만으로 해결되지 않았다. 앞 문단의 oracle 해석은 초기 가설로 보존하며 최종 원인으로 확대하지 않는다.

frontend는 canonical queue 완료 전 읽은 version과 완료 뒤 version이 달라지면 측정을 폐기하면서 다음 요청을 놓칠 수 있는 source 경계를 확인했다. 같은 원인 재발에 Manager는 REWORK로 재계획했다. queue 완료 후 현재 version을 읽고 기다린 queue identity가 교체됐을 때만 한정 재요청한다. 동일 queue 대기 중 frame/event continuation은 coalesce하며 취소/API/model/view context guard를 유지한다. 상시 polling·새 scroll/selection 복원·Core private write를 추가하지 않는다. 새 source의 targeted suite/type/lint와 DOCUMENTATION_SYNC를 다시 수행한 뒤 독립 QA로 넘긴다.

## 최종 Local Fast Feedback / DOCUMENTATION_SYNC

frontend 동결 source의 Chromium17/17 PASS(exit0, 46.4초), 시작2026-10-08T17:40:10Z/종료17:40:55Z, 실행 전후10개 SHA 일치다. 5폭×Day/Week10관측, date/header·같은 인스턴스·lane/row 정렬·키보드·cluster·touch emulation·peer/resize/fullscreen·OFF/dirty Editor·동적 축·Task hit를 포함한다. 직접 관련 4 Unit 파일29/29 PASS(242ms)는 마지막 source에서 실제 재실행했으며 이전 결과 재사용이 아니다. typecheck/변경lint/Markdown/diff exit0, 기존 hook warning4개 유지, next-env는 parent HEAD로 복원했고 tsconfig는 불변이다.

최종 Gantt SHA256 `f4371b59243bd9301e5abaece578e69b89635a85f36ad2da65054432cf1efb06`. frontend66개 allowlist의 SHA 검증66/66 OK: /tmp/issue551-frontend-final-allowlist.txt 및 /tmp/issue551-frontend-final.sha256. [실행 계약과 선별 증거](../../../output/playwright/issue-551/review-selected/execution-contract.json)는 합성 API+실제 Core 개발 Chromium이다. 최초 FAIL/진단/이전 source와 최신 source를 구별하고 미선별 원본은 /tmp/mastergantt-551-frontend-raw-evidence에 보존한다.

Manager 문서 영향 검토: required6개 MILESTONE_TIMELINE/PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN/PRO_FEATURE_MATRIX/ARCHITECTURE의 실제 갱신과 현재 코드·전체 canonical 계약·Week 의미·64/160/44px·geometry version 결합·최초 실패/queue 보완·환경별 미검증을 대조했다. CHANGELOG/PLAN/version/본 Packet은 Manager가 동기화했다. 위 항목별 N/A 근거도 현재 diff와 일치한다. **DOCUMENTATION_SYNC PASS**, 다음 단계는 정확 staged tree의 독립 ui_ux 비교 및 qa_docs PRE_QA다. 최종 QA/Manager ACCEPT와 quality/e2e/docker는 NOT TESTED다.

최소1900 전체 UI·invalid canonical 서버 DTO·전체 Task drag/Dependency 회귀·독립 runtime observer 수 계측·실제 HTTP authorization/SQLite551·production build/runtime·실물 touch/screen reader는 NOT TESTED다. 상한 날짜의 실제 현재 시각 전체 축 성능도 작은 clock fixture PASS로 대체하지 않는다. 개발 displayMode case의 React child-key warning(render Lt)은 원인 미확정이다. Week header/lane Week 로그에는 미관측이며 baseline이나 두 week row 원인으로 확대하지 않는다. researcher의 설치 TimeScale source rowIdx/cellIdx read-only 확인과 실제 warning 원인은 별개다.

## 독립 UI/UX / PRE_QA 및 PR 인계

독립 ui_ux와 qa_docs는 reviewed tree `6cd706b131f8e1742335a686926c7d924216c844`의71개 index/worktree hash와 FE manifest·10개 browser source hash 일치/drift0을 확인했다. ui_ux bounded 비교 PASS, 추가 blocker0/REWORK 없음: 5폭×Day/Week10관측의 lane64px/control160×44px, tick/native 차이1px·row center차이0.5px, 실제 PNG의 이름·상태·390 가로 접근, Week span·50개 페이지·Editor/OFF/소멸·Task hit·같은 인스턴스를 대조했다. 대형1000Task+2000M의 좌표측정2.6ms는 한 관측이며 전체 성능 보장이 아니다.

qa_docs 독립 PRE_QA PASS는 PR 준비 판정이다. 같은 검토 source의 직접 Unit4파일29/29 PASS(229ms, exit0)와 원본 Chromium17/46.4초·type/lint/문서 근거를 확인했다. 구현자29와 reviewer29를 고유58개로 합산하지 않는다. Reviewer 초기 tree 확인의 `git write-tree`1회는 이미 생성된 tree를 반환했으며 후속 source/index/ref 논리 drift0을 확인했다. 이후 source/문서/GitHub 변경 없이 조회만 수행했다.

Grid 열 표시·숨김과 clipboard 전체 회귀, full Task drag/resize/Dependency, 독립 observer 수·document scrollWidth overflow assertion은 현재 NOT TESTED다. Grid splitter/Chart resize·Task checkbox/context hit를 전체 기능 PASS로 확대하지 않는다. 후속 #552의 실제 표시 전환 검증에 Grid 열 표시·숨김/5폭 document overflow를 포함하고, #553 통합 검증에서 남은 계약을 비교한다. 현재 feature는 opt-in 준비이며 production 기본 활성화/main 통합/최종 AC·QA_FINAL·Manager ACCEPT를 판정하지 않는다.

Manager는 PR 후보 게시를 승인한다. version0.105.0/release_required=true/release_authorized=false, parent550 exact SHA/stacked base 유지. infra의 게시 전 읽기에서 2026-10-09 02:51:28KST main08ac7749efc4544dfc125853d9e58ef3a9d56b21/version0.102.1·predecessor31345da9346dfbdc1ac02e4e7ca567edafec775f 일치, remote551branch/PR 중복0이다. 다음은 최종 tree/byte equality→PR→exact-head CI 등록만이며 결과 조회 없이 #552로 인계한다. 공식 quality/e2e/docker/QA_FINAL/ACCEPT·merge/main/GHCR/tag/Issue 종료/cleanup은 NOT TESTED/비범위로 유지한다.
