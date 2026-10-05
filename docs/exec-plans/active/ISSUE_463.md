# Issue #463 완료 단계 대시보드·KPI 실행 계획

## 요청 범위와 단계

[Issue #463](https://github.com/planner77/masterGantt/issues/463)의 구현·문서 동기화·원격 게시·PR CI 등록을 수행한다. 과거 registration-only는 최신 구현 요청으로 대체한다. CI 완료 조회·병합·main/GHCR·정식 릴리스·브랜치 삭제·Issue 종료는 범위 밖이다. 구현·관련 Local Fast Feedback 및 DOCUMENTATION_SYNC PASS 후 독립 사전 검토 단계로 전환했다.

선행 [PR #471](https://github.com/planner77/masterGantt/pull/471)의 head `603cd029d279ddc5b70309786abf8876b6bd1692`와 [CI run 37371909631](https://github.com/planner77/masterGantt/actions/runs/37371909631) 등록을 확인했다. [PR #468](https://github.com/planner77/masterGantt/pull/468)·[PR #470](https://github.com/planner77/masterGantt/pull/470)을 포함하는 누적 변경이다. 공식 quality/e2e/docker 결과와 최종 QA는 NOT TESTED다.

## Issue Work Packet

- repository/Issue: planner77/masterGantt / #463, Epic #459.
- 현재 main: `a9107ab2776829cbb0467a762ab8bf9ce1ce82c4`. 처음 확인한 `e812e56f45fc9d641ffcd80e49fb0deaf115b704`는 baseline에 포함돼 있으며 게시 직전 선행 #460 병합을 feature branch에 추가 통합한다.
- branch/baseline: `feat/issue-463-stage-dashboard` / `603cd029d279ddc5b70309786abf8876b6bd1692`, tree `97342e36e138fcafeccd67189beef99ed146d0a0`.
- version: 새 readonly 대시보드/API·KPI의 MINOR `0.88.0`. infra가 package/lock을 갱신하고 version check PASS. release_required=true, release_authorized=false.
- scope: single snapshot 서버 KPI·Calendar/assignment 기반 단계별 공수·관련 물류 단계 projection·Gantt peer dashboard·drill-down·cache/revision/time 갱신·관련 테스트와 문서.
- non-scope: 별도 DB 집계 엔진, 새 권한/이력/실적/실제 완료일/원가/AI 예측, scheduling/상속·Ready 엔진 복제, PRO, Import/Export·Copy/Template, 전체 restyle.
- backend 소유: 신규 contracts/milestone-dashboard.ts·readonly milestone-dashboard API handler/service·관련 repository 조회 helper·pure metric/model·server/domain/HTTP 테스트, 기존 logistics-dashboard 계약/service의 관련 단계 projection·환산 기준 정합화. DB migration·기존 Scheduling algorithm·frontend source는 수정하지 않는다. 계약/interface는 Manager에 먼저 반환하여 고정한 뒤 구현한다.
- frontend 소유: 신규 ProjectMilestoneDashboard·UI pure model/CSS, ProjectReadonlyView의 schedule peer navigation·drill-down/갱신 연동, 기존 Logistics dashboard의 관련 단계 UI·M/M 기준 표시, UI/component/E2E·화면/geometry. server/contracts/repository/버전·공통 서버 문서는 수정하지 않는다.
- frontend Unit Test 구현은 별도 frontend Agent `stage_dashboard_unit_tests`가 `tests/domain/milestone-dashboard-model.test.ts`만 단독 작성한다. UI source·E2E·문서의 기존 소유권은 유지한다. 이 테스트 구현 역할을 독립 QA로 표시하지 않는다.
- 실제 SQLite browser E2E는 별도 frontend Agent `stage_dashboard_browser_tests`가 `tests/e2e/milestone-stage-dashboard.spec.ts`만 작성한다. 기존 frontend는 mock/request-state/geometry를 담당하고, shared Playwright server 실행은 직렬 조정한다.
- backend 문서 소유: REQUIREMENTS/ARCHITECTURE/API/MILESTONE_STAGE_GATES/ISSUE_56_RESOURCE_WORKLOAD/TEST_PLAN 및 영향 서버 문서. TEST_PLAN은 backend 단독 작성이며 frontend는 UI evidence·재현·명령/결과를 handoff한다.
- frontend 문서 소유: PROJECT_UX/UI_UX_GUIDELINES/TASK_EDITOR. DESIGN은 공통 시각 원칙이 새로 필요할 때 Manager에 반환하고 기존 token 재사용 시 N/A 근거를 backend 문서 작성자에게 전달한다.
- ui_ux 설계/최종 비교·scheduler 공수/날짜 경계 검토·qa_docs 사전 QA는 read-only다. 동일 파일 동시 쓰기·다른 담당 변경 되돌리기·재귀 위임 금지.
- Manager 소유: 이 계획·PLAN·CHANGELOG·scope/interface/version/최종 판단. infra 소유: package/lock 및 원격 운영.
- issue_comment_writer=manager. Sub-Agent는 직접 Issue/PR 댓글을 쓰지 않고 Result Contract에 STATUS/EXCEPTION 후보를 반환한다.

## 서버 계약과 계산

Route Handler → Service → Repository → SQLite를 유지한다. readonly GET `/api/projects/{publicId}/milestone-dashboard`와 typed 계약을 backend가 설계하고 Manager가 고정한다. 계약은 아래 결정과 typed DTO를 기준으로 구현하며 API 문서에 상세 필드를 고정한다. projectRevision·필요한 catalog revision·calculatedAt·Project timezone·asOfDate·horizon·정규화된 filter echo·대상 ID/분모를 제공한다. 같은 read snapshot에서 #460 projection과 기존 공수/물류 helper를 사용한다.

E(M)은 전체 effective 고유 일반 Task, P(M)은 전체 predecessor M, S는 단계 검색·선택 및 관련 물류/리소스 조건의 고유 M, F는 조회 Task/assignment 범위다. Ready·memberProgress·완료 불일치는 full E/P로 계산한다. F의 완료 Task만 보고 Ready를 바꾸지 않는다. client는 상속·Ready·공수를 재계산하지 않는다.

완료율은 S의 기록된 completed/전체, 분모 0은 null. Ready는 미완료·비어 있지 않은 단계 중 공용 helper ready=true. Blocked는 미완료 predecessor 존재, 지연은 미완료 M.start<asOf, 임박은 asOf부터 horizon-1일까지(1~90일), 위험은 미완료 member의 canonical end>M.start. 각 축은 중첩 가능하며 해당 ID 집합을 보존한다. Coverage는 보고 범위 ordinary 중 effective target 존재/전체이며 Summary/M 제외, 분모 0은 null. 일정 미설정을 오늘/0으로 채우거나 기록된 완료를 자동 재개하지 않는다.

개인 Resource의 일반 Task assignment만 공수 대상이다. Calendar·할당 구간·기간 필터·allocationPercent·역할/등급을 기존 helper와 동일하게 적용하고 assignment ID로 dedup한다. allocation 미설정은 100%로 추정하지 않으며 group/Summary/M assignment는 개인 공수에 포함하지 않는다. 모든 단계 bucket+미지정 bucket이 동일 F assignment Grand Total과 일치해야 한다. S 표시 선택으로 숨겨진 bucket의 합계 의미를 왜곡하지 않도록 DTO에서 전체 bucket/표시 집합을 구분한다.

현재 Resource workload는 유효한 `RESOURCE_MD_PER_MM`이 없으면 null을 사용하지만 Logistics pure helper는 `filter.mdPerMm ?? 20`이다. 기존 DTO는 이미 nullable이다. Manager의 방향은 새 단계 및 물류 M/M을 명시 query/env 기준으로 정합화하고 무조건 20 fallback을 제거하는 것이다. explicit null·미설정·invalid 기준은 M/M=null이며 기준·출처를 DTO/UI에 표시한다. 기존 Logistics includedTaskIds/progress/plannedMd/기존 경보 범위는 유지하고 M/M 의미 변경·기존 client/test 영향을 API/TEST_PLAN에 명시한다. resolver는 명시 finite-positive query → 유효 RESOURCE_MD_PER_MM → null이며 HTTP mdPerMm=null과 programmatic explicit null은 ENV를 무시하고 null을 유지한다. 값과 query/environment/unset 출처를 응답·화면에 제공한다. query invalid는 400, ENV invalid/누락은 null이다.

물류 관련 M은 M 자신의 기존 물류 match 또는 effective member 중 기존 물류 match가 있을 때 관련 집합에 포함한다. ID로 dedup하되 선택 M의 full E/P를 평가한다. 기존 물류 includedTaskIds·progress·plannedMd 범위를 전체 M으로 확장하지 않고 관련 단계 정보는 별도 projection으로 추가한다. service 순환 의존성을 만들지 않는다. breakdown은 중첩될 수 있으며 dedup Grand Total과 구분한다.

### Manager 승인 계약

- public-read nodejs/force-dynamic/no-store GET. 검색, milestoneIds, 기준일, horizon(기본 14·1~90), from/to, 개인 resourceIds, assignmentRoles, developerGrades, 기존 물류 조건 및 mdPerMm를 typed query로 제공한다. unknown query·반복 scalar·invalid 날짜/enum/UUID/양수 기준은 400이다. 배열은 반복/CSV를 정규화·unique/sort한다. 유효하지만 삭제되거나 범위 밖인 ID는 empty-match이며 조건을 전체로 확대하지 않는다.
- 검색/milestoneIds는 표시 S만 선택하고 기간은 F만 제한한다. resource/role/grade는 같은 assignment가 모두 만족해야 한다. 전체 F의 모든 단계 bucket과 미지정 bucket을 반환하며 rows(S) subtotal과 Grand Total을 혼동하지 않는다.
- DTO는 project/catalog revision·계산 시각·Project timezone·resolved 기준일/범위·요청 filter echo·KPI 대상 ID/분모·rows와 full stageGate·risk 원인·scope·effort 전체 buckets·readonly filter catalog를 제공한다. 초기 default 요청값과 resolved 날짜를 구분하고 filters.mdPerMmProvided로 환산 입력 생략과 explicit null도 구분한다.
- Logistics 기존 수치/ID는 보존하고 related milestoneStages는 별도 projection이다. shared pure projection을 사용하여 Logistics→Milestone service 순환을 만들지 않는다.
- DB migration/repository schema 변경은 N/A다. backend 문서 소유에 SECURITY/LOGISTICS_DASHBOARD를 추가한다. 대시보드는 Project 전체 기준이며 Gantt WBS scope를 적용하지 않는다고 명시한다. 기존 Gantt scope/mount는 보존하고 원인 drill은 명시적인 전체 일정 진입을 사용한다.

## 화면·시간·갱신

DESIGN blue Light/system font/semantic token과 기존 긍정적인 Logistics KPI 배치를 재사용한다. 일정 영역 내부에 Gantt/완료 단계 대시보드 peer view를 두고 WBS scope·리소스/물류 상위 navigation과 구분한다. Gantt를 조건부 제거하지 않고 mounted 상태로 보존한다. dashboard는 조회·loading/error/no-result/0값을 구분하고 stale 값의 drill-down을 잠근다.

서버가 첫 기준일을 Project timezone으로 제공한다. 자동 기준일은 focus/visibility 또는 날짜 경계의 bounded 재조회 정책으로 갱신하고 무제한 polling을 만들지 않는다. Task/Membership/Link/status/Calendar/assignment 및 관련 catalog revision·조건·request 역전은 cache를 무효화한다. 같은 filter/revision의 응답만 채택하며 stale ID drill-down을 활성화하지 않는다. 수동 기준일은 현재 snapshot 평가일이며 과거 실제 상태 복원이 아니다.

행/KPI는 #461 동일 Editor 상세/소속 탭, #462 대상 ID 일정, Resource 범위로 이동한다. full-stage의 scope 밖 원인을 확인하는 경로는 명시적인 전체 범위 진입 또는 readonly canonical 상세로 구분한다. readonly도 조회 가능하며 보기 전환은 mutation·Gantt remount를 만들지 않는다.

## 검증·문서 Gate

backend 관련 unit/integration/HTTP는 E/P/S/F·ID/분모·직접/상속/override·수동/완료 불일치·date 경계/Project TZ·전부 완료나 선행 미완료·부분 물류 필터와 전체 Ready·assignment dedup/Calendar/role/grade/미설정·bucket Grand Total·M/M null/명시 기준·기존 물류 숫자 보존을 검증한다. 실제 SQLite API와 UI E2E는 저장·조회 revision/ID 정합성을 검증한다.

frontend mock/실제 browser는 query/request/revision 역전·에러/재시도·auto/manual 기준일·focus/visibility·readonly·drill-down·Gantt instance/state 보존을 검증한다. 390/768/1024/1440/1920px에서 KPI/필터/표의 header/body 정렬·모든 버튼과 셀 경계·큰 숫자/긴 이름·자체 scroll/overflow·focus/popup을 측정하고 화면을 제공한다. before actual 또는 source 재현 근거를 구분한다. 전체 회귀는 PR CI에 맡긴다.

DOCUMENTATION_SYNC는 지정 문서 소유권으로 갱신 또는 개별 N/A 근거를 완료하고 frontend evidence를 backend TEST_PLAN에 통합한 뒤 통과한다. 코드/계약 변경 후 문서 gate가 stale이면 다시 동기화한다. Manager CHANGELOG/PLAN도 최종 구현과 맞춘다.

다음 handoff: 고정 계약에 따른 backend/frontend 구현·ui_ux 설계·scheduler 검토 → 관련 검증 → DOCUMENTATION_SYNC → ui_ux 비교·qa_docs 사전 QA → Manager PR_READY → infra 게시·exact head PR CI 등록 → #464.

## 구현 중 검증 근거

Backend intermediate freeze는 owned 25 files의 manifest SHA256 `79031d1dccfe2fd9bb4de35cfe10b20310f471518a45d17afeeab6bc6bef6821`이다. 관련 Vitest 최초 9 files/155 tests PASS 뒤 추가 Ready/override 계산 테스트를 포함한 pure 30/30 PASS, security authorization 17/17 PASS, typecheck/변경 ESLint/Markdown link 122 files/diff check PASS를 확보했다. source 13 files에 대한 scheduler의 최종 read-only 검토 PASS이며 계산 blocker 0건이다. frontend 조회 모델 최초 64/64와 해당 ESLint도 PASS다. 이 결과는 공식 전체 회귀/최종 QA가 아니다.

최초 작업 중 DTO narrowing·fixture type/method typecheck 오류와 HTTP fixture role 누락 34 FAIL은 기록하고 수정했다. 모델 test의 최초 FAIL은 없다. `.env.example`의 RESOURCE_MD_PER_MM=20은 명시 설정 예시이며 변경하지 않는다. ENV20을 명시한 운영의 결과는 유지하고 미설정 운영만 M/M=null로 바뀐다.

현재 UI/실제 browser·최종 TEST_PLAN 증거 통합과 전체 DOCUMENTATION_SYNC·독립 사전 QA는 진행 중이다. backend source는 고정했으며 문서·테스트의 최신 최종 manifest는 UI handoff 이후 갱신한다.

### UI REWORK

실제 browser 6차에서 API/Editor/Grid/full E/P/부분 공수/물류/Resource 동일 기간·revision·assignment ID 및 readonly Gantt instance/scale/tree/selection/단계 열/작업명 폭은 통과했으나, chart scrollLeft=120 → native Fullscreen 진입/종료 → Dashboard/Gantt 왕복 후0은 FAIL이다. native FS와 peer 각 단계로 원인을 분리하고 frontend에서 수정한다. assertion 완화/remount/비공개 SVAR API를 사용하지 않는다. 캐시 early-return inFlight와 Resource 기간/revision query-key 렌더 보강도 포함하며 관련 browser/mock를 재검증한다.

최초 테스트 개발 오류는 hidden picker 중복·잘못된 frame selector(두 번째 run interrupt130), KR 2026-10-05 대체공휴일 누락 oracle, DTO 배열 자체 sort 변형, select label 탐색이었다. 제품 결함과 구분해 기록하며 최종 PASS가 최초 FAIL을 숨기지 않는다. 전체 UI DOCUMENTATION_SYNC/사전 QA/PR 게시는 아직 NOT TESTED다.

7차 checkpoint(15.2s, session66170/chunk45a54a)는 FS전/활성/종료/peer숨김 직전 chart.scrollLeft=120을 유지했고 peer복귀만0이었다. nativeFS 자체는 PASS이며 DOM의 max1179→1315는 DOM 범위 축소에 따른 clamp를 뒷받침하지 않았다. Core 내부 scale/resize에 따른 별도 clamp 여부는 후속 공개 상태 조사 대상이다. ProjectGantt nativeFS 변경은 필요하지 않으며 frontend는 peer viewport 복원을 수정한다. max의136px 변화는 Grid split/Chart clientWidth·scrollWidth를 나누어 추가 확인하고 실제 분할 폭 보존을 검증한다. 최종 actual fixture는 실제 물류 KPI 관련 단계 UI assertion도 추가하여 재실행을 기다린다.

8차(15.0s, session28788/chunk2004b7)는 peer DOM 2-frame 복원에도 scroll120→0이어서 REWORK다. Grid split661/Chart client725는 보존됐으므로 max변화는 분할 폭 변경이 아니다. 실제 물류 KPI 관련 단계 UI도 PASS했다. Manager는 ProjectGantt의 최소 peer visibility/public scroll-chart left/top 복원 interface를 승인했다. 기존 처리 queue/public API를 재사용하고 숨김 resize의 Core state 덮어쓰기를 분석한다. nativeFS·Scheduling algorithm·비공개 상태 API·임의 DOM timer retry는 변경하지 않는다. 최종 source/문서 manifest와 actual/mock/browser 증거는 다시 갱신한다.

9차(19.8s, session35360/chunk7a54f0)는 requestedLeft120/DOM120/publicLeft22로 공개 상태 일치 조건에서 FAIL했다. 공개 scroll event는120→22→0이었으며 진단 스냅샷 시점과 실제 reducer 후속 상태를 구분하기 위해 bounded public action trace와 live getState 관측을 보강한다. 후속 layout assertion은 이 실패로 NOT TESTED다. 동일 원인 반복을 따라 read-only researcher가 설치 Core2.7.3의 scroll-chart/resize-chart·기존 timeline queue 순서를 독립 조사한다. frontend 단독 쓰기 소유권·nativeFS 보존·assertion 기준은 유지한다. 과거 peer 복원 요청이 이후 같은 필터에 재사용되지 않도록 1회 소비 guard를 추가하고 mock·관련 #462/fullscreen 검증 후 실제 browser를 직렬 실행한다.

10차(20.4s, session46909/chunk099033)는 live 공개 상태/DOM의 초기 및 nativeFS 종료120을 확인했지만 peer 복귀 이후 둘 다0이었다. 요청120/count1 이후 synthetic resize1972→726 및2040→726과 native scroll0이 관측됐다. 즉 9차의 진단 스냅샷 한계와 별개로 실제 손실이 남아 있었다. 반복 실패를 따라 Manager는 복원 지연을 늘리는 대신 inactive display:none의 zero geometry를 제거하는 최소 shared grid cell·visibility:hidden·inert·aria-hidden 수정으로 계획을 전환했다. 비활성 화면의 focus/키보드/조회 접근을 차단하고 Gantt instance·nativeFS·기존 domain 계약을 유지한다. 변경 후 공개 viewport/후속 layout·관련 회귀·5폭 geometry·실제 API browser를 다시 검증한다.

Mock98701은10개 중8 PASS, 표시값·select selector harness2 FAIL이었다. narrow72881/16265의 refresh race는 응답 대기 수정 후 PASS이며 geometry95025는 닫힌 DETAILS 버튼의 cached rect를 표시 control로 집계한 harness 문제였다. checkVisibility를 사용하되 실제 표시 control의 배치 기준은 유지했고21866의5폭 geometry1 PASS(6.9s), documentWidth=viewport·1052/800 표 및352px scroll owner(390px)·전체 표시 control/focus/popup를 확인했다. 이 geometry 근거는 peer grid layout 수정 전의 것이며 수정 후 재검증을 요구한다. 첫 실패와 actual FAIL을 이후 PASS로 숨기지 않는다.

새 shared grid layout은 typecheck9370 PASS,31864의공개viewport mock·5폭 geometry·기존native Fullscreen2개 총4 PASS(16.0s)를 확보했다. 실제11차(session56655/chunk08d93a)는1 PASS(테스트15.3s/총25.8s)이며 DOM/public120이초기·nativeFS활성/종료·peer복귀·후속viewport1456→1440에서유지되고 Grid661/Chart725·scrollWidth1904·restore count1을확인했다. canonical API/full·scoped KPI/실제물류UI/Resource기간·revision·assignment IDs/readonly401도PASS다. 당시 Gantt0ec97397…/Readonlye32153fe…/DashboardCSSbf2498a1… source는고정했고이전 FAIL 근거를보존했다. 이 변경은 schedule 내부peer범위이며 상위 Resource/Logistics workspace hiding까지 개선했다고 주장하지 않는다. 실제10차 resize payload는726이므로0폭action 직접관측 또는 await누락의단독원인으로기록하지 않는다.

### 최종 문서 동기화와 사전 검토 진입

기존 #462 실제 회귀에서 popup 하단845.5px가 viewport844px를 초과한 FAIL(session23252/chunk19be1c, 9.9s)을 보존했다. anchor/viewport와 실제 popup chrome 높이에 따른 list 제한·위쪽 배치·resize/scroll 재계산 후34383의 #462 실제 회귀와 Dashboard5폭 geometry 총2 PASS(26.3s)를 확보했다. 해당 회귀의 기존6개 screenshot/geometry 파일은 현재 화면 근거로 갱신하며 이전 #462 PR의 원래 근거는 해당 commit에 남는다.

Manager 코드 검토에서 가로 owner `.wx-chart.scrollTop`을 수직 값으로 저장하는 위험을 발견하고 기존 수직 owner `.wx-gantt.scrollTop`으로 수정했다. 최종 mock64059는 scrollMax≥96을 확인하고 native/public 가로120·수직96이 peer 왕복과 후속 layout에서 유지됨을 검증했다(1 PASS,4.3s). 실제11차의 수직0 근거는 해당 범위에서 재사용하며 비영 수직의 실제 SQLite 검증은 NOT TESTED다. picker와 수직 capture 변경은 실제11차 가로/nativeFS 경로의 결과를 바꾸지 않는다는 영향 분석과 별도 교차 검증을 기록했다.

최종 frontend 소유21개 파일 manifest는 `/tmp/issue-463-frontend-manifest.json`, backend 소유25개 파일 manifest는 `/tmp/issue-463-backend-manifest.json`이며 첫 사전 검토 당시 backend manifest SHA256은 `c1ba8f778da4d9b2d5ebbb0071dbf4c403b7536b30eefed0438788e2d7ace977`였다. 조회 모델64개와 Resource drill5개 총69 PASS 이후 해당 순수 source는 불변이다. 최종 typecheck24623·변경 ESLint90970·Markdown122 files·생성파일 diff0을 확인했다. 전체 소유 source ESLint의 기존8개 경고와 신규 generation cleanup ref 경고1개는 규칙별로 분류했고, 신규 경고는 후속 요청의 inFlight를 이전 cleanup이 지우지 않도록 현재 generation을 비교하는 guard다. 독립 QA가 이 근거를 확인한다.

required 서버8개·UI3개 문서 및 Manager PLAN/CHANGELOG/이 계획을 동기화했다. DB/migration·기존 Scheduling/Calendar·Import/Export·CI/Docker/운영 문서는 해당 계약 변경이 없어 N/A다. 게시 allowlist는 screenshot/geometry만 포함하고 runtime trace·raw snapshot·DB·log·최초 실패 보존 폴더는 제외한다. DOCUMENTATION_SYNC PASS이며 ui_ux 비교·qa_docs 사전 검토 후에만 PR_READY로 전환한다. 공식 원격 CI 결과/최종 QA·nativeFS 활성 중 peer 전환·실기기/스크린리더/운영 환경은 NOT TESTED다.


### 게시 직전 main 통합

첫72파일 DOCUMENTATION_SYNC·ui_ux 비교·qa_docs 사전 QA는 PASS였고 qa_docs가 관련5files/141tests를 독립 재실행했다. 원격 게시 직전에 선행 PR#468이 병합되어 main이 `a9107ab2776829cbb0467a762ab8bf9ce1ce82c4`로 바뀌었으므로 infra는 게시를 보류했다. Manager 승인 아래 feature branch에 `merge --no-ff --no-commit origin/main`을 수행했으며 충돌0, HEAD는603cd029…/MERGE_HEAD는a9107ab… 상태다. 원래72파일 hash는 그대로였고 추가된3개 테스트는 exact main 원본과 일치했다.

추가 범위는 기존0022 migration 목록/count22 기대값, Copy ID의 신규 Task→Task fixture, 빈 Project 생성의 mastercatalog 표시 대기다. 제품 code·API·UI·DB 계약을 변경하지 않는다. 새 검토 manifest는75파일이며 기준 문서·TEST_PLAN 증거를 다시 동기화하고 관련 최소LFF와 독립 변화 검토 후 PR_READY를 재확정한다. 이전 UI/서버 결과는 불변 source 범위에서 재사용하며 원격 CI 결과는 계속 NOT TESTED다. 새 원격 commit은603cd029…와a9107ab… 두 parent 및 검증한 exact tree로 게시한다.


main 통합 최소LFF는 qa_docs의 migration-cli3/3 PASS(751ms/chunka6a71a), frontend Copy ID1 PASS(18.6s/79426/ch55efaf), blank 생성1 PASS(3.7s/66106/ch7e9a8a)다. 첫 anchored grep은 파일 경로 접두어로 blank case를 찾지 못해 해당1개만 별도 실행했고 전체 발견 문제와 구분했다. 생성파일 diff0, 제품/UI source 불변을 확인했다. TEST_PLAN과 기준 문서를 재동기화했으며 backend25개 최종 manifest SHA256은 `42dd36ee9f788e97ff422c3420393fd58cca7af301aafbf7d25e63c792c9707a`다. 동일 source/화면 hash에 대한 기존 ui_ux 비교는 재사용하며 새75파일·두 parent의 독립 변화 검토를 다시 요청한다.
