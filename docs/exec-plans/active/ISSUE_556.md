# Issue #556 — 일정 상단 P1 경량 정돈

- Primary Issue: [#556](https://github.com/planner77/masterGantt/issues/556), 2026-10-23 P1 개정 계약.
- baseline: main `427d22245fb8e11254b2424ea5147ccbd5766979`, application `0.130.1`.
- branch: `feat/issue-556-schedule-header-density`, 별도 worktree. 기존 작업공간/다른 Issue 작업은 보존한다.
- version decision: UI 밀도/조회 진입 개선 PATCH `0.130.2`; package/lock 동기화. `release_required=true`, `release_authorized=false`.
- phase: PR_READY; 원격 PR/CI 식별자는 게시 후 Issue STATUS와 최종 인계에 기록한다. 목표 흐름은 IMPLEMENTING → LOCAL_VALIDATED → DOCUMENTATION_SYNC → PR_OPEN → PR_CI(시작까지). 원격 완료 모니터링·병합·Main/GHCR·tag/Release·Finalizer·Issue 종료·branch 정리는 범위 밖.
- `risk_level=HIGH`, `qa_required=true`, `qa_method=OWNER_MANAGED`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`. shared Workspace UI/focus/선택·탐색 소비자에 영향; UI 자체 영향은 MEDIUM이나 package/lock version-only 보호 경로를 포함하므로 전체 HIGH로 상향한다. CI의 최소 위험도 및 보호 경로 gate를 낮추거나 우회하지 않는다.
- 실제 역할: Manager 문서/버전/측정/통합·원격 게시, frontend 단일 TSX/CSS/test writer, ui_ux 읽기 전용 설계/구현 비교, qa_docs 읽기 전용 사전 검토. Agent 사전 검토는 인간 APPROVED·Owner ACCEPT가 아니다. 현행 OWNER_MANAGED의 정식 `independent_qa=N/A(Owner-managed)`; 별도 사전 검토 결과는 아래 기록.
- documentation_owner=Main/Manager; qa_review_mode=OWNER_MANAGED. reviewer=별도 ui_ux/qa_docs 사전 검토이며 정식 Owner 수용은 미실행이다.
- issue_comment_writer=manager. PLAN/주요 STATUS를 기록하며 Sub-Agent는 독자 댓글을 쓰지 않는다.

## 분석·관련 근거

#724/#552/#528/#667/#719/#711의 현재 GitHub 상태와 main 계약을 확인했다. #724의 중복 전체 프로젝트 탭 제거, #552 marker OFF/native Milestone0/빠른 보기3종 제거, #528 정확 선택·Summary 자손 개인 Assignment drill, #667 상태 정합성, #719 상황형 설명 정책, #711 테스트 먼저 검색을 유지한다. 열린 PR #721(매뉴얼), #675(Gantt 진단), #563/#562(이전 Milestone stack), #346(Calendar) 등은 별도 범위이며 미병합 구현을 가져오지 않는다.

Source of Truth: REQUIREMENTS/ARCHITECTURE/API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY/TEST_PLAN/REMOTE_VALIDATION/CI_CD/GITHUB_OPERATIONS/ISSUE_LIFECYCLE/QA_REVIEW_POLICY, DESIGN/PROJECT_UX/UI_UX_GUIDELINES/RESOURCE_KPI_DASHBOARD 및 활성 PLAN. Next 16.4.2 설치 guide의 client boundary 지침을 확인했다. 실제 설치 Core는 2.7.3이다.

공식 자료 2026-10-23 URL 조회: [SVAR Willow](https://docs.svar.dev/react/gantt/samples/#/base/willow), [Filtering](https://docs.svar.dev/react/gantt/guides/data-operations/filtering/), [APG Toolbar](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/). 문서 조회는 실제 demo 조작 증거가 아니다. 신규 Core API/PRO 구현/내부 Toolbar 이동은 없다. APG roving Toolbar를 새로 만들지 않고 기존 검색/필터 keyboard 계약과 별도 native 명령 group을 사용한다.

실제 배포 서비스 URL/source version은 제공되지 않았으며 운영 화면 비교는 NOT TESTED다. 현재 로컬 before는 최신 main의 격리 Next+실제 Chromium에서 테스트 canonical fixture API를 mock한 화면이며 운영 DB/사용자 정보가 아니다.

## 설계

Design Delta B: DESIGN의 기존 compact light/system font·semantic token·상황형 설명 원칙을 화면에 적용한다. DESIGN 자체 변경은 N/A.

```text
일정 / 대시보드 / 기준정보
[열린 Summary 또는 invalid scope일 때만 전체 일정 보기 + Summary 탭]
접근 가능한 sr-only 일정 heading
[실제 빈/무일정·저장 중 상태만 compact 표시]
검색 / 필터 / Milestone 소속 / 초기화 / 결과
인접 명령 group: 담당자·공수 조회 | [현재 Summary 전체 담당자·공수]
기존 Gantt 내부 일/주·선택·복사·해제·요약 추가·전체 화면
Grid / Chart
```

- 정상 전체/열린 Summary0: scope wrapper0, visible 중복 제목/정상 설명0; label/focus heading 보존.
- 열린 Summary1/N·전체 활성: 명시 전체 전환과 열린 탭 유지. 마지막 닫기 시 존재하는 검색 제어로 focus fallback.
- direct rootTask/reload·삭제/비Summary invalid: 기존 경고/복구/범위별 상태 유지; #497 composite 미구현.
- 선택 조회: `ganttSelection.current`/`workspaceSelection` 경로와 기존 `scheduleToResources()` 사용. 선택 Summary 일반 자손 전원과 현재 Summary 전체는 다른 명령.
- readonly는 조회 가능. 선택 없음/일반 Task 없음/편집기 열림/저장·탐색 대기는 원인별 설명과 disabled 연결. 개인 배정0은 기존 서버 빈 안내. dirty/stale·source conflict/복귀는 handler가 보호한다.
- 반응형: Project 영역만 wrap/contain; desktop 강제1행/P2 통합 없음. native fullscreen host와 Gantt toolbar 소유권 불변.

## 변경 영향·선정

| Producer/계약 | 직접 소비자 | 교차/음성 위험과 선정 |
| --- | --- | --- |
| 조건부 scope row / focusScopeTab | 마지막 탭 닫기·전체 전환·rootTask | 0/1/N·전체 활성+열린 탭·삭제 invalid·scope별 검색/복귀·hidden focus |
| hidden heading / compact status | aria-labelledby·기존 탐색 focus 복귀 | 실제 empty/무일정·저장/오류·stale 안내·landmark 이름 유효 |
| Project 조회 command group | #528 선택/현재Summary·readonly | exact Task/Assignment·전원 포함·개인배정0·dirty/pending/source conflict·return |
| Project filter scoped CSS | 검색/고급·Milestone 소속·reset/result | 긴 문자열·5폭/줌 대응·control hit/overlap·native fullscreen/peer·Gantt identity |
| package/lock version only | version check·공식 CI | dependency/script 변화0; 보호 경로 gate 유지 |

## TEST_LIFECYCLE_REVIEW

기존 Vitest/Playwright 시나리오/assertion을 `rg`로 먼저 조회했다. 별도 상시 spec을 추가하지 않고 기존 계약 테스트를 확장한다. 일회 측정 스크립트는 output 증거로 보존하며 CI suite에 중복 등록하지 않는다.

| AC | 기존 테스트/증거 | 판단·이유 |
| --- | --- | --- |
| P1-01/03/04/07/08 | `project-filter-toolbar-consistency.spec.ts`, output capture/geometry | EXTEND: 기존 정상 안내 단언을 새 계약으로 교체하고 scope0/hidden label·조회 상태·5폭 containment 확장; Before/After px는 실제 측정 |
| P1-02/09 | `task-context-menu-hierarchy.spec.ts` #399/#407/#373 | EXTEND: 마지막 닫기 버튼이 사라지는 focus·전체활성 열린탭 검사. 기존 scope/삭제/reload/filter/keyboard oracle 유지 |
| P1-04/05 | `resource-drill-ui.spec.ts`, `issue-621-resource-target.spec.ts` | EXTEND: visible label/readonly·keyboard; 기존 exact ID/all-person·empty·conflict·LIFO 위험은 KEEP_UNIQUE |
| P1-06 | `project-search-filter.spec.ts`, `milestone-visibility.spec.ts` | KEEP_UNIQUE: filter 집계/invalid recovery·native row0/markerOFF를 통합 삭제하지 않음 |
| P1-08/09 | `project-workspace-tabs-518.spec.ts`, `project-gantt-fullscreen.spec.ts` | EXTEND/KEEP_UNIQUE: 새 scope0 기대만 갱신; peer identity/scale/scroll/focus와 native fullscreen 자체 위험 보존 |
| P1-10 | 본 표·문서 동기화·prepr·별도 사전 검토 | 기존 assertion/search 근거 연결; 원격 exact Head Required3/Trusted/Owner는 별도 |

보안/DB/알고리즘 입력은 변경하지 않아 전용 새 unit/서버 전체 회귀는 N/A. 관련 기존 scope/resource pure unit을 선택해 실행한다. 전체 Vitest·Chromium8/Docker 공식 회귀는 PR CI로 인계한다. 실제 운영·native browser zoom·보조기기 검증은 자동화 PASS로 대체하지 않는다.

## AC_TEST_COVERAGE

- AC1: AC-P1-01 = toolbar consistency의 정상 scope navigation DOM0와 실제 geometry; 중복 전체 프로젝트 탭0.
- AC2: AC-P1-02 = hierarchy #399/#407/#373 및 milestone visibility invalid recovery; 마지막 닫기/URL/ARIA/focus.
- AC3: AC-P1-03 = toolbar hidden heading/정상 설명0, empty-summary의 빈/무일정·저장/복구 상태.
- AC4: AC-P1-04 = toolbar 직접 조회/원인별 disabled와 resource-drill readonly keyboard 진입.
- AC5: AC-P1-05 = resource-drill 실제 HTTP/SQLite의 exact Task/Assignment·전원·Summary·개인배정0/dirty/복귀 및 issue621.
- AC6: AC-P1-06 = project-search-filter/milestone-visibility/fullscreen의 필터·native Milestone0/markerOFF·기존 toolbar 명령.
- AC7: AC-P1-07 = output/playwright/issue-556 capture.mjs와 동일fixture before/after geometry/PNG의 실제 px 비교.
- AC8: AC-P1-08 = toolbar/518의5폭 containment·hit target·keyboard 및 별도 유효CSS 폭 측정; native zoom/수동은 별도 NOT TESTED.
- AC9: AC-P1-09 = hierarchy/resource-drill/518/fullscreen의 canonical writes0·revision·동일 Core instance·selection/scroll/scale/복귀.
- AC10: AC-P1-10 = 위 TEST_LIFECYCLE_REVIEW·기존 spec 확장·DOCUMENTATION_SYNC·prepr/사전검토와 향후 exactHead Required3/Trusted/Owner 증거.

GitHub Issue의 기존 AC-P1-01~10은 보호된 QA validator의 AC1.. 식별자에 위 일대일 alias로 연결했다. 요구·체크박스/수용 범위는 변경하지 않고 Issue 본문 끝에 식별자 매핑만 추가했다. canonical 제목/Refs 오류를 자동 수정한 것이 아니다.

## DOCUMENTATION_SYNC

- `docs/REQUIREMENTS.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `DESIGN.md`: N/A(existing compact light visual language applied with Design Delta B)
- `AGENTS.md`: N/A(no agent instruction or ownership policy change)
- `docs/QA_REVIEW_POLICY.md`: N/A(no trusted review policy or approval boundary change)
- `docs/CI_CD.md`: N/A(no workflow registry or release authority change)
- `docs/GITHUB_OPERATIONS.md`: N/A(no remote operation policy or required check change)
- `docs/REMOTE_VALIDATION.md`: N/A(no validation environment or remote gate policy change)
- `docs/API.md`: N/A(existing exact read navigation and endpoint contracts preserved)
- `docs/DB_SCHEMA.md`: N/A(no schema or migration changes)
- `docs/SCHEDULING_ENGINE.md`: N/A(no scheduling algorithm or calculation changes)


- UPDATED: `docs/REQUIREMENTS.md`, `docs/PROJECT_UX.md`, `docs/UI_UX_GUIDELINES.md`, `docs/RESOURCE_KPI_DASHBOARD.md`, `docs/TEST_PLAN.md`, `CHANGELOG.md`, `docs/exec-plans/active/PLAN.md`, 이 Work Packet.
- N/A(reason): `DESIGN.md` 기존 시각언어 적용(Design Delta B); `AGENTS.md`/QA_REVIEW_POLICY/ISSUE_LIFECYCLE 작업/승인 지침 불변.
- N/A(reason): API/DB_SCHEMA/ARCHITECTURE/SCHEDULING_ENGINE/SECURITY 신규 endpoint·DTO·schema·algorithm·authorization 경계 변경0. 기존 navigation source를 재사용한다.
- N/A(reason): CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS workflow·Required3/E2E8·Trusted/Owner·Main/GHCR/Finalizer·release 권한 정책 불변. 새 테스트 file/shard 배치 변경0.
- N/A(reason): IMPORT_SCHEMA/IMPORT_EXPORT/EXCEL_EXPORT/VBA_EXPORT/DEPLOYMENT/HTTP_OPERATION 교환·배포·HTTP 계약 불변. TASK_EDITOR 데이터/저장 단위 불변.
- 매뉴얼 PR #721은 미병합 별도 작업이다. 기존 명령 이름의 제품 설명은 위 문서에 동기화하며 매뉴얼 구현 완료를 주장하지 않는다.

## 실행·검증 원장

### Before

격리 npm ci(446 packages)·Node22.14.0, Next16.4.2, Playwright1.63.0/고정 Chromium. `capture.mjs before http://127.0.0.1:3116`를 실제 실행했다. main TSX/CSS·Gantt·fixture SHA256을 JSON에 포함한다. fixture revision40·readonly·선택0·필터없음, 동일2scope×5폭.

1440×900: full/summary 모두 scope row40px, heading row28px, Gantt 시작 전132px, Gantt579px, Chart/Grid527px. [Before JSON](../../../output/playwright/issue-556/before/geometry.json), [화면](../../../output/playwright/issue-556/before/full-1440.png), [재현 script](../../../output/playwright/issue-556/capture.mjs).

### 구현·After·Local Fast Feedback

최종 제품은 frontend가 단일 writer로 수정했다. source TSX/CSS2·기존 E2E6파일을 확장했으며 Gantt 내부 toolbar·adapter/Core·API/계산 handler는 수정하지 않았다. 기존 pure unit3파일30개 PASS, typecheck PASS, 변경 ESLint0error/기존 unused WbsViewDashboard warning1. 최초 신규 테스트 정규식 /s의 TS target 오류를 [\s\S]로 교정해 재통과했다.

1440×900 동일 fixture 측정 결과:

| 범위 | 상단 영역 before→after | Gantt 높이 before→after | Grid/Chart before→after |
| --- | --- | --- | --- |
| 정상 전체 | 132→52px(-80) | 579→659px(+80) | 527→607px(+80) |
| Summary 열림 | 132→127.5px(-4.5) | 579→583.5px(+4.5) | 527→531.5px(+4.5) |

초기 after Summary의 결과 span 공통 min-height36 때문에 상단144/Gantt567(-12px)이 관측됐다. Project 결과 span에만 min-height0을 적용해 위 최종 수치로 교정했다. 최초 관측을 최종 PASS로 소급하지 않는다. [After JSON](../../../output/playwright/issue-556/after/geometry.json), [전체1440](../../../output/playwright/issue-556/after/full-1440.png), [Summary1440](../../../output/playwright/issue-556/after/summary-1440.png). 2scope×5폭의 documentWidth는 모두 viewport와 같다.

[Responsive script](../../../output/playwright/issue-556/responsive.mjs)와 [결과](../../../output/playwright/issue-556/responsive.json)는 readonly/edit×390/768/1024/1440/1920 및1152/960/720 유효CSS폭16관측을 실행한다. 긴 Summary/Milestone·선택 child·검색/filter/reset, Tab/Shift+Tab/Escape, control containment·겹침0·조회44px hit·revision40/write0·동일 Gantt instance를 확인한다. 1152/960/720은1440 기준125/150/200%의 대응CSS폭이지 native zoom 조작이 아니다.

선택 Chromium 첫 bounded30은27PASS/3FAIL: #621/#528은 Manager가 관리자 설정 없는 외부3116 서버로 실제 fixture를 실행해 admin401이었고, #399의 신규 disabled 단언은 context menu가 valid Summary를 선택하는 정상 동작을 잘못 기대했다. 외부 BASE_URL을 제거해 실제 격리 fixture로 재검증하고 #399는 정확한 selected Summary enabled oracle로 교정한다. [최초 로그](../../../output/playwright/issue-556/logs/bounded-initial.txt)는 보존한다. 최초 성공27은 fullscreen6·markerOFF16·검색3·peer518·directroot373A의 같은 제품 구현의 당시 검증이며 새 CSS 보완 뒤 최종 원장으로 대체해 별도 재검증한다.

`verify:prepr --mode=fast --base=427d22245fb8e11254b2424ea5147ccbd5766979 --issue=556 --risk=HIGH` 실제 실행 결과는 **BLOCKED**다. 선택기에 `src/app/globals.css`의 등록된 producer→consumer map이 없어서 test steps 실행 전에 차단했다. dry-run은 NOT TESTED다. 이 도구를 녹색으로 만들기 위해 보호된 selector 정책을 확장하지 않으며, 위 영향 표·실제 수동 선택 회귀와 로컬 typecheck/lint/unit을 별도 증거로 제공한다. 로컬 CLI 전체 PASS를 주장하지 않는다. 원격 Full Required3는 그대로 실행한다.

720px stress 보완 전 제품 SHA256: TSX `22b568cc7ff62679f5cf81727f8dd1ce97167aa74b9259063e6f66904f209c06`, CSS `be96a3ab5298dbdbf1a9919335d8c44f1284360a2051bb6606a6bceaaf10c288`.당시 After/기본 Responsive를 이 source에서 다시 실행해 JSON source hash 일치를 qa_docs가 독립 확인했다. 최종 CSS 보완 뒤에는 새 source에서 재실행한다. 고정 fixture의 선택 조회 focus 화면390/1440도 보존했다.

REWORK 첫6case는5PASS/1FAIL이었다. 기존 #528 actual SQLite·#399 교정·toolbar1/empty2는 통과했으나 신규 Summary case는 제품 진입 전 seed `/api/projects`의 필수 description 누락으로400을 받았다. 기존 API 계약에 맞게 description을 추가하고 response body 진단을 보강한다. 실제 제품 API/Required assertion은 완화하지 않는다. 이 신규case와 모든 선택 회귀는 최종 같은 동결source에서 재실행해 별도 확정한다.

전체 npm lint는 커스텀 dev 출력 `.next-issue556`까지 순회해 실행 중단했다. 최종 변경 TSX/기존E2E6/evidence mjs2 scoped ESLint는0error/기존 unused 경고1이며 CSS는 matching configuration 부재로 lint 미대상 warning1이다. CSS 품질은 실제 Chromium geometry·상태·시각 검토와 공식 CI로 확인한다. 전체 lint/production build·전체 Vitest/Chromium/Docker 로컬 PASS를 주장하지 않는다.

별도 명령의 Unit 경로 오타로0test(FAIL)가 한 번 있었고 실재 경로 검색 후 최종 Unit3파일30/30 PASS를 확인했다. 테스트 discovery는270Unit files/807browser cases, root/external cwd 동일 PASS이며 신규case1개 추가·기존138spec/8shard 배치는 불변이다.

새 Summary case의 description 보완 후 단독 실행은 PASS(body7.8s/전체27.9s)이며 정확 결과를 [JSON](../../../output/playwright/issue-556/summary-scope-exact-ids.json)에 보존한다. 기존 Task2/Assignment3 대 현재Summary3/4, 개인전원·outside제외·readonly keyboard2회복귀·canonical/write0를 확인했다.

### 720px 실제 선택 긴 Milestone 추가 진단

UI 검토가 기본16관측은 긴 이름을 보유했지만 Milestone 선택값은 전체이고 geometry는 reset 후라는 증거 공백을 지적했다. [기본16원본](../../../output/playwright/issue-556/responsive-basic.json)을 별도 보존하고 script를 실제 긴 Milestone 선택+Summary inherited membership+검색중 초기화/결과 동시 상태로 확장했다.

초기 관측기의 closed native details 자손 버튼은 비표시여도 nonzero DOMRect를 반환해 겹침 오탐을 냈다. 브라우저 checkVisibility로 실제 표시 제어만 검사하도록 보완했다. 이후 **720px에서 실제 containment FAIL**: toolbar x24..696/width672, 필터 width625/right709, Milestone 조건해제 right709로13px 벗어남, 검색폭52px. 문서 scrollWidth가720으로 같아도 내부 clipping이므로 PASS로 처리하지 않았다. [실제 실패 로그](../../../output/playwright/issue-556/logs/responsive-long-selected-720-failure.txt).

원인은 기존 <=50rem의3열 max-content 결과가 filter 열을 확장하고 긴 Stage group이 nowrap인 계약이다. Project 전용 2열·Stage wrap 및 불필요 implicit 여백만 보완하고 모든 명령/검색 폭·44px target을 유지한다. 제품 보완 후 geometry·확장16조건·전체 선택34case를 새 동결source에서 재검증한다. 기존 기본16/이전34 결과를 새 CSS 성공으로 소급하지 않는다.

최종 선택 회귀·사전 검토/원격 시작 증거는 아래 확정 원장에 기록한다.

### 원격·승인·환경

- PR Quality/E2E8/Docker·Trusted QA: NOT TESTED. PR 생성 후 정확 Head/Base/test-merge/Run ID/attempt의 시작만 확인한다.
- Owner ACCEPT/QA_FINAL: NOT TESTED, MERGE_READY=BLOCKED. P1 완료/Issue 종료 판정은 향후 실제 Required/Trusted·Owner 수용 후.
- main artifact/GHCR digest/cleanup·정식 Release/tag/promotion: NOT TESTED/요청 범위 밖. release_authorized=false.
- 실제 운영 proxy/배포/source 비교, native125/150/200% zoom·실기기/screen reader/최종 수동 UX: NOT TESTED. CSS 유효 폭 검사는 native 줌과 구분한다.

## 최종 후보 검증·게시 인계

- 최종 source SHA256: TSX `10fc7658ce1bd38ea62e2e9ed119e62b06ed63ec142704a2305401f38ebb7da9`, CSS `6f6673e45f75ecde8da89a9d90bffd2a4961c03a8ab9cb79645f974aa6b768ea`.
- 720교정: Project 한정2열 search/filter1행·Stage2행·result/reset3행·조회4행. Stage wrap/align-center로 긴 선택/식별 disclosure·해제 버튼을 보존하고 DOM reset→조회 순서로 Tab도 시각순서와 정합했다. 기존 toolbar case의720 실제긴Milestone 선택·선택child/검색/reset/result·containment·검색폭>=120·Tab 회귀를 EXTEND했다. 신규spec/shard/timeout/retry/skip 변화0.
- 최종 기초 after2scope×5폭과 실제 선택 긴Milestone 조건16(readonly/edit×8폭)은 같은 새source에서 PASS. 720 검색폭52→592px, 밖으로 벗어난 제어0·겹침0·문서overflow0·lookup44px·같은instance/revision40/write0이다. nativezoom은 NOT TESTED.
- 최종 기본1440 Gantt+80px/Grid·Chart+80px 및 Summary+4.5px는 유지한다. 390의 기본 전체396→469px(+73), Summary360→369px(+9)로 공간이 늘었다. [최종 after](../../../output/playwright/issue-556/after/geometry.json)·[확장조건16](../../../output/playwright/issue-556/responsive.json)·[선택1440](../../../output/playwright/issue-556/after/selected-1440.png)·[선택390](../../../output/playwright/issue-556/after/selected-390.png).
- 최종 Unit3파일30/30 PASS, typecheck PASS, scoped TSX/test/mjs ESLint0error·기존unused warning1, version/diff-check·Markdown314파일·discovery270unitfiles/807browsercases PASS. CSS는 ESLint 매칭 설정이 없어 lintPASS로 계수하지 않는다.
- 초기 전체 npm lint는 커스텀 dev 출력 순회로 중단했다. 자체 dev서버/출력과 테스트 생성물을 정리한 뒤 최종 **npm run lint PASS(0error/15warning)** 및 **npm run typecheck PASS**를 실제 재실행했다. 초기 중단 기록은 유지한다. verify:prepr는 자동 CSS map 부재로 여전히 BLOCKED다. 전체 로컬 test/build/Docker 회귀·자동선정CLI PASS가 아니며 수동 선정 회귀와 별도 사전검토로 원격 Full CI에 인계한다.
- 최종 같은source의 단일 bounded Chromium **34/34 PASS(5.3분)**. actual HTTP/SQLite5개(#6211·Resource2·hierarchy399/373A2)와 mock canonical/report+실제 Core29개(Milestone16·empty2·toolbar1·fullscreen6·검색3·workspace5181)를 구분한다. 전부 실제 Chromium 조작이지만 전부 actual backend로 합산하지 않는다. [전체 최종 stdout/stderr](../../../output/playwright/issue-556/logs/chromium-final.txt). 이전34와 합산한68unique 또는 최초FAIL 소급PASS가 아니다.
- ui_ux 최종 실제 화면/JSON/script 비교 ACK(PASS): 위 두 source hash 및 실제선택16·5폭 before/after, 720검색592·44px/focus·두명령 구분·같은instance/write0 직접 대조. qa_docs `/root/qa_review` 최종 읽기 전용 PRE_QA PASS: 코드/테스트/문서 의미와 같은source34/34·30/30·최종JSON hash 및 docs_gate를 직접 확인했으며 미해결 제품 지적0이다. 실제 인간 APPROVED·QA_FINAL·Owner ACCEPT와 구분한다.
- 게시: infra가 최신main/대상branch 부재를 재조회하고 로컬 clean commit/tree·원격GitData blob/tree/parent를 일치 검증한 단일 신규ref로 게시한다. 완성된 본문의 Ready PR/원본Full CI 시작까지 확인한다. gh CLI 인증401은 유지하고 연결된 인증GitHub 도구를 사용한다. 비밀값/인증정보는 출력하지 않는다.
- PR Quality/E2E8/Docker·Trusted/Owner 수용은 NOT TESTED, MERGE_READY=BLOCKED; 원격 결과 모니터링·병합·Main/GHCR·Release·cleanup/Issue종료는 수행하지 않는다.

최종 제품2+실행spec9의 정렬된 path/NUL/SHA256/newline 집합 지문은 `19823fbc7c00987c2b1092557f4a63dc49a2fdbf49ed620790960b79a0bd58a3`이다. [검증 영수증](../../../output/playwright/issue-556/validation.json)에 파일별hash·실제 실행/환경·사전검토/승인 경계를 연결했다. Next 자동 생성AGENTS/next-env/tsconfig와 역사적 #528/#724/#621 capture 변경은 /tmp에 보존한 뒤 원본으로 복원했다. 이번 #556 증거만 게시한다.

앱 런타임 WebServer 출력은 Git에 저장하지 않는다. 위 연결한 TXT는 테스트/정적검사 출력 발췌이며 전체 로컬 원본은 /tmp에 보존한다.

## 2026-10-24 — PR #786 첫 Full PR CI 실패 교정 (F-001)

- 원본: [PR #786](https://github.com/planner77/masterGantt/pull/786), [Full PR CI #3186.1, Run 39963612115](https://github.com/planner77/masterGantt/actions/runs/39963612115). Event pull_request / FINAL_FULL. Head 440513cc3612228d4575823bfe2c37e8cdfc5971; base 427d22245fb8e11254b2424ea5147ccbd5766979; test merge 74ee98958f0a0641d6802c85c1a715ad8ab4a2ea.
- 직접 FAIL: [Chromium shard6 Job 120448846041](https://github.com/planner77/masterGantt/actions/runs/39963612115/job/120448846041), tests/e2e/canonical-projection.spec.ts:55, #570 metadata projection 768px Day, expected reasons ["data"], received ["data","layout"]. Shard6 3 PASS/1 FAIL/93 NOT RUN, 타 7개 shard CANCELLED; Quality/Docker PASS, E2E Required/자동 QA FAIL 파생. 별도 FAST_DEVELOPMENT #39963612277 SKIPPED.
- [Playwright artifact 12505462979](https://github.com/planner77/masterGantt/actions/runs/39963612115/artifacts/12505462979) receipt 및 trace 직접 대조: revision40→41, SETTLED, 동일 Gantt API/작업 선택·Core/DOM 집합, filter/column 변동 없음. 편집 중 root 높이 587.5→560→587.5, chart 높이 487.5→460→487.5의 실제 reflow 및 resize-observer 존재. 정확히 어떤 DOM 행이 27.5px 변화시켰는지는 UNKNOWN이다.
- 원인 TEST_CONTRACT: #570 테스트의 reasons exact-only 예상이 실제 layout 관측을 허용하지 않음. 제품 ResizeObserver를 억제하거나 필수 E2E/timeout/skip/retry/assertion을 완화하지 않는다.
- 기존 canonical-projection.spec.ts 5폭×Day/Week test를 EXTEND. data를 반드시 정확히 보존하고, layout이 있으면 같은 트레이스 내 크기 변화 2종 이상 + resize-observer의 실제 관측을 요구한다. 다른 구조/필터/컬럼·선택/서버 write 계약은 유지한다. 테스트 신규 spec 추가/샤드 변경 없음.
- 원본 artifact의 strict oracle offline replay 5/5 (data-only, real-resize PASS; no-resize layout/structure contamination/wrong-order 3 negative blocked)는 완료했으나 새 제품 HEAD의 실제 Chromium/전체 CI·Trusted QA·Owner 승인과 구분한다. 로컬 기존 34/34 PASS는 교정 전 source 증거다.
- [정규 실패 원장](../../ISSUE_556_FAILURE_ANALYSIS.md) 신설; 관련 테스트/본 Work Packet 외 DESIGN/ARCHITECTURE/AGENTS/API/DB/CI/QA 요구 문서는 의미 변경 없음으로 N/A. 기존 verify:prepr CSS map BLOCKED는 계속 BLOCKED. 리뷰 스레드 0, 기존 PR mergeable 및 main behind0 (수정 전 재조회). 새 commit 이후 상태 재검증 필요.
- 인계: 새 exact Head의 공식 Required Quality/Chromium8/Docker·Trusted QA·Owner 수용 NOT TESTED. risk_level=HIGH, qa_method=OWNER_MANAGED, qa_required=true, release_required=true, release_authorized=false, MERGE_READY=BLOCKED 유지. 병합·Main·GHCR·Finalizer·Issue 종료는 이번 범위 밖.

## 2026-10-24 — PR #786 두 번째 Full CI #3193.1 F-002 보안 감사 대응

- [원본 Run 40028881375.1](https://github.com/planner77/masterGantt/actions/runs/40028881375)·Head 411fd5990da7958191661eed2e4f0b5fcff3a619·base 427d22245fb8e11254b2424ea5147ccbd5766979·test merge 951e5aaa1829f47dee10a426ba52db6c89949c56. 실행 event=pull_request FINAL_FULL. 독립 Fast 40028881372 SKIPPED.
- **직접 FAIL**: Policy 120672045024 `npm audit --omit=dev`, Zod 4.6.2에 대한 High GHSA-mrhx-c7xc-m3w5, exit1. Vitest·TS·lint·npm ci·Preflight PASS, Fast Gate FAIL, 실제 E2E8·Docker smoke·PR Build 미실행, Required3·QA 파생 FAIL. F-001 #570 E2E 교정은 여전히 원격 NOT TESTED.
- **보완**: exact Zod 4.6.7 manifest/lock/SRI(패키지 외 변화0), 역사적 Gantt Core Zod4.6.2 원본 캡처는 불변으로 두고 별도 reviewed Zod exact SRI·registry/metadata 승인 후 메모리 정규화. 기존 Next security allowlist 불변, release app0.130.2 유지.
- **TEST_LIFECYCLE_REVIEW**: `prepr-verifier.test.ts` 기존 test EXTEND, manifest/root mismatch, altered version/SRI/URL/extra metadata 총 6개 음성 검증 강화. 다른 Core 캡처 실소비 테스트3개, 기존 #556 UX E2E 및 #570 case, 실제 HTTP/SQLite security schema KEEP_UNIQUE. 신규 spec/샤드/timeout/retry/skip/Required 변경0.
- **DOC_SYNC**: README, RESEARCH, SECURITY, CHANGELOG, Work Packet 및 [누적 원장 F-002](../../ISSUE_556_FAILURE_ANALYSIS.md) 업데이트. TEST_PLAN 기존 지침은 변경 없이 참조; DESIGN/API/DB_SCHEMA/SCHEDULING_ENGINE/AGENTS/CI_CD/QA_REVIEW_POLICY N/A(권한·런타임·CI 게이트 변경 없음).
- **검증 한계**: npm registry DNS 불가로 로컬 신규 Zod 설치·감사·Vitest/TS/Browser 실증 NOT TESTED. 정확 JSON 버전·locked package2 entry, SRI와 음성 fixture source 검증만 수행, 원격 CI에서 npm ci/audit·전체 Vitest/Build/Chromium8/Docker 재검증. Unbounded 입력 배열/집합/맵의 메모리 위험 전수조사까지 완료했다는 의미는 아니다.
- **상태**: HIGH/OWNER_MANAGED, release_required=true/release_authorized=false, QA/Owner/Required new Head=NOT TESTED, MERGE_READY=BLOCKED. 미해결 리뷰/mergeability와 main strict는 push 전후 확인. 새 Full CI 시작 이후 지속 감시, 병합/Main/GHCR/Finalizer/Issue 종료는 범위 밖.
