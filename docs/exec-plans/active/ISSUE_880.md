## REWORK R2 — Full #3537.1 readonly 고급 필터 회귀 (현재 단계)

현재Head89e45ad49df4df4a6c905101b0cf07c8a20d704e/base229604522969133d1ccc6de0477e373252670c86/testmerge05e31649926801e8160fb01237a1f7e07874e880. 원본Run42308825744.1은Preflight/quality/Docker PASS,Shard2 project-search-filter:52(line64자식Task행)FAIL/다른7CANCELLED다. [단일원장 R2](../../ISSUE_880_FAILURE_ANALYSIS.md)에최초부터누적하고infra가전체원격이력·attempt/취소로그와출처를대조한다. worker가pristine원본case의실제RED/PASS를먼저확인하며제품수정은원인/설계후frontend가소유한다. Manager는통합/문서·Issue댓글,qa_docs는독립read-only기술검토,ui_ux는responsive높이/overflow설계를읽기전용담당한다.

GSC1.0.0-candidate/standard_read_commit=229604522969133d1ccc6de0477e373252670c86. GSC02/04/06/08/09/11의실제Core·logicalrows·가상DOM/geometry·소유권·누적회귀를적용하고임의remount/새writer/timeout·assertion완화는금지한다. 원본CI실패합집합∪R1 View/selection/Editor/readonly·검색/필터직접·간접·음성을실제수정영향에맞춰같은최종source로검증한다. 상세선정은원인확정후기록한다.

HIGH/OWNER_MANAGED/qa_required=true·후보0.143.0/release_required=true/release_authorized=false 유지. 현재LOCAL_VALIDATED/PR_READY,새Head CI/Trusted/Owner/Manager NOT TESTED,MERGE_READY BLOCKED. 종료점은기존PR883의새FullCI등록이며모니터링/병합/Main/GHCR/Issue종료는제외한다. 아래R1과최초Packet은역사이며이전PASS를새Head로승계하지않는다.

R2원인/설계: pristineRED와height900→1200만바꾼반사실에서Core2행/open/권한/조건은같고native0/Corechart−72→native293/chart221·childDOM복구를확인했다. geometry경계가확정됐으며filter/open알고리즘은기각한다. 고급필터만shrink·내부scroll,Gantttoolbar+header+3coarse행최소공간,낮은창scheduleScope내부scrollfallback을CSS로보장한다. UI조건/밀도/폰트/날짜축/원본writer·인스턴스는유지한다.

TEST_LIFECYCLE_REVIEW=EXTEND 기존project-search-filter3case의readonlycase에원래1024×900자식행단언과실제usableheight·5폭/낮은창/내부scroll/focus·sameinstance/write0를보강한다. KEEP_UNIQUE R1 schedule6/fullscreen6/scale2/TaskEditor33 및 공유 CSS의 Grid/Chart geometry 소비자 projection-row-alignment13(5폭Day/Week+실제visible불일치음성), actualHTTP 정보밀도 project-gantt-density1. 최종7spec/64고유case를worker1/retries0/max-failures0로같은동결source에서검증한다. API/DB/Scheduling/의존성·CI정책불변으로wholeUnit/build/Docker로컬반복은미선정하되새Head Full Required3의전체회귀는필수/NOT TESTED로유지한다.

R2최종동결검증은7spec/64고유case PASS/FAIL0/SKIP0/flaky0(exit0,13.7분),1310입력SHA256 `7e9163c0ea293d898c883c82c38d8c62a0c5de0e33b232f217a4ef31b1dc43b7` before=after=current다. 같은최종지문의선정Unit9파일190PASS/전체typecheck/관련lint0error4기존warning/PostCSSparse/version/cache/discovery303Unit·890browser/preflight11PASS. 원래900px 자식행/현재receipt·body150·5폭/낮은480/Fullscreen·Grid/Chart오류음성·원본쓰기0와이전View선택/viewport회귀를같은실행에서검증했다. [R2정제증거](../../evidence/issue-880/rework-r2-local.json),원격이력은[ci3537-source](../../evidence/issue-880/ci3537-source.json)를따른다. 자동fast/targeted는UNKNOWN8/missing0/sourceStable=true/BLOCKED(기존7+globals.css1),제안metadata/currentIssueAC/전체55경로/currentPacket의base WT replay는PASS(실패0)/최종5DEFERRED,Markdown412/diffcheckPASS다. 원격Head판정으로확대하지않으며별도read-only `/root/preqa`의동결소스·실제64증거·문서/보안기술검토PASS/직접미해결P1·P2=0이다. 이는인간QA_FINAL/Owner/Manager승인이아니며현재리뷰·충돌·최종localcommit40SHA재생/동일Tree게시를마지막확인한다.

R2생산자→소비자선정: globals.css의scope/filter축소·fallback→검색/필터3의원래900조건·5폭/low480/focus/write0; 같은파일의native/intrinsicmin→Fullscreen6/scale2/Editor33/정보밀도1/행정렬13(실제mismatch음성포함); projectedheight0/min17rem→View6의boundedDOM/원본Editor/source오류·응답역전/다중선택/viewport·locale. 순수filter/density·canonical/selection/Coordinator/source경계는Unit9파일190으로검증했다. 새매핑globals.css의자동미등록상태를이수동검증으로PASS취급하지않는다.

## REWORK R1 — Full #3533.1 metadata 실패와 P2 상태 보존 (현재 단계)

사용자 요청 종료점은 PR #883 새 Full CI 등록이다. 원본 Run42301302919.1은 Preflight의 QA_REQUIRED 독립 줄 누락 직접FAIL/PATH_POLICY파생이며 실제 품질·8Chromium·Docker는 SKIPPED/NOT RUN이다. 본문 flag형식은 검증기를 바꾸지 않고 실제 captured PR payload→base preflight 전체 replay로 beforeFAIL2/afterPASS(실패0)·최종5DEFERRED를 확인했다. [누적 원장 R1](../../ISSUE_880_FAILURE_ANALYSIS.md)의 원본결과를 보존한다.

미해결P2 다중선택/Copy왕복 손실과 projected source재조회/Editor/peer복귀 viewport손실을 수정전실제RED로 재현하고 frontend가 보완한다. TEST_LIFECYCLE_REVIEW=EXTEND 기존 schedule-views의 공유 fixture/선택/viewport·readonly/error·85Task/준비 경계, KEEP_UNIQUE 기존 scale/fullscreen/Editor/canonical/Coordinator·HTTP/SQLite·preflight11이다. Manager 문서·원장/통합,frontend 제품,테스트Agent spec/fixture,qa_docs read-only 기술검토,infra 원격이력·GitData게시를 소유하고 Issue댓글은Manager만 작성한다.

baseline/head=f9bdd26df8196c11f24b4ab90223a3ada00d4cbd,main=229604522969133d1ccc6de0477e373252670c86. 후보0.143.0/HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false 유지. 새 Head의 이전CI/QA판정은stale이며 동결 소스의 재검증·문서 의미/리뷰/충돌을 확인한 뒤 CI를 시작한다. 이후모니터링·병합·GHCR·Issue종료는수행하지 않는다. 현재PR_READY/LOCAL_VALIDATED,MERGE_READY BLOCKED/새원격·Owner/Manager NOT TESTED다. 아래 최초 구현 검증은 역사이며 재사용 범위는 새 보완의 영향 선정에서 명시한다.

R1의동결입력1310 SHA256은 `1b165cd33266318c0e2b8c6e598a574e527b08ca7d01ced4759ebf536a09f280`(sorted-path-sha256-map/json-compact/sort-keys)이며원래PR의변경입력22개중추가delta는Gantt/panel/spec3개뿐이다. P2직접2/2PASS·전체typecheck·변경lint0error/4warning(기존3+새captureBookmark dependency1)·선정Unit7파일175PASS·discovery303Unit/890browser(root/externalcwd)·version/cache/preflight11PASS다. wholeUnit/productionbuild/Docker의로컬반복제외는코드영향선정이며이전Head전체PASS승계가아니다. 정제근거는 [R1 local](../../evidence/issue-880/rework-r1-local.json)에서이전실패와분리한다. 최종47case는47/47PASS/FAIL0/SKIP0(exit0,10.3분),1310입력시작=종료이며기존45와합산하지않는다. 최종제안본문·현재Issue AC·전체47경로·Packet의base checker replay는PASS(실패0)/최종5DEFERRED,자동fast/targeted는UNKNOWN7/missing0/sourceStable=true/BLOCKED다. 원격Head 검증/Owner판정으로확대하지않으며별도read-only `/root/preqa`의동결소스·실제47증거·문서/보안사전기술검토PASS/직접P1·P2=0이다. 인간QA_FINAL·Owner/Manager승인이아니며공개candidate수정근거로기존두리뷰thread를처리하고최신main/head/충돌lease및실제localcommit의base checker를재확인후동일Tree를게시한다.

# Issue #880 — 일정 WBS / Resource / 설비 View

다음 최초 Work Packet과 수치는 초기 Head의 이력이다. R1의 현재 판정·소스·선정 및 증거는 위 R1 절과 누적 원장을 우선한다.

## Issue Work Packet

- repository: `planner77/masterGantt`; issue: [#880](https://github.com/planner77/masterGantt/issues/880)
- baseline_sha: `229604522969133d1ccc6de0477e373252670c86`; baseline_branch: `main`; baseline_version: `0.142.0`
- branch: `feat/issue-880-schedule-views`; worktree: `/home/planner/Dev/masterGantt-880`
- lifecycle_phase: PR_READY / LOCAL_VALIDATED / DOCUMENTATION_SYNC
- authorization: 2026-11-07 사용자 요청에 따라 등록 시점 분석 전용 범위를 구현·문서·리뷰/충돌 처리·실패 원장·PR Full CI 시작으로 확장한다.
- requested_end: Ready PR Full CI 시작 확인. CI 모니터링·병합·Main/GHCR·Release/Finalizer·브랜치 삭제·Issue 종료 제외.
- current_version: `0.143.0`; version_decision: MINOR(사용자 일정에 신규 View 제공).
- release_required: true; release_authorized: false. 버전 후보는 정식 게시 승인이 아니다.
- risk_level: HIGH; risk_reason: Gantt 표시 계층·canonical Editor mapping·상태 보존·프로젝트 읽기 자료/API가 교차한다.
- qa_required: true; qa_method: OWNER_MANAGED
- reviewer: 별도 read-only `/root/preqa`가 code/API/security/docs·실제45case 증거를 교차 검토했고 직접 미해결P1/P2=0, 최종 `PRE_QA 기술검토 PASS`를 원본 로그·동결지문·문서에 한정해 반환했다; independent_qa: N/A(Owner-managed 최종 경로). Agent 기술검토는 인간 APPROVED나 Owner ACCEPT가 아니다.
- manager_decision: NOT TESTED; MERGE_READY: BLOCKED
- issue_comment_writer: Manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION
- ownership: ui_ux 읽기 전용 설계; frontend 기존 Gantt/UI·i18n/조회 hook; backend projection 순수 함수+Unit; 별도 backend source GET/contract/service+SQLite/HTTP test; 테스트 Agent 신규 schedule-views E2E; Manager 버전·문서·통합·실패 원장; qa_docs 읽기 전용 사전검토; infra 최종 branch/PR/CI 시작.
- next_handoff: 구현 → Local Fast Feedback → DOCUMENTATION_SYNC → 사전 기술검토 및 보완 → 최신 main/리뷰/충돌 확인 → PR Full CI 시작.

## 분석 및 설계

Owner의 설비 다중 표시·Group-only 개인 미지정·완전 미할당·Fleet 원본1건·조회 전용 정책을 유지한다. 최신 main은 #866 ko/en/vi 표시 경계를 제공한다. 신규 UI 문구는 i18n catalog에서, 관리형 이름은 현재 locale 표시명→원본 name에서 읽으며 사용자 입력은 번역하지 않는다.

기존 Gantt Core2.7.3 Reconciler의 canonical Task ID/parent/link 전제를 유지하기 위해 Resource·설비는 app-owned 조회 전용 Grid+Chart adapter로 구현한다. WBS Core는 mounted/hidden/inert 상태로 보존하고 가상 ID를 canonical writer·Core projection·Export에 주입하지 않는다. 기존 Day/Week 날짜축·밀도를 재사용하며 Grid/Chart는 동일 논리행과 단일 세로 scroll owner를 사용한다. View selector는 표시 단위 바로 앞에 visible `View` label과 WBS/Resource/설비 순서로 둔다. 접기/펼치기는 표시행에만 적용한다.

`canonicalTaskId`는 원본 Editor 대상, `viewRowKey`는 view+실제 경로+Task로 구성한 표시 인스턴스다. 같은 Task가 여러 경로에 나타나도 경로 내 중복은 제거하고 업무/공수 총계를 경로별 재합산하지 않는다. 일반 Task만 입력하며 Summary 직접 Assignment는 자손에게 전파하지 않는다. Milestone native 비표시를 유지한다. 설비 type/model/equipment 원본과 direct/subtree/legacy 유효 연결을 재사용하며 Owner·공정·구역·controls로 연결을 추정하지 않는다.

기존 assigned-targets GET은 실제 Resource Group membership를 제공하지 않고 global resource catalog는 관리자 전용이다. 신규 project read-gated `GET /api/projects/{publicId}/schedule-view-source`가 동일 읽기 snapshot에서 필요한 project-scoped Assignment·참조 Resource/Group 및 실제 소속·설비/유형·유효 관계 출처와 Project·Resource 카탈로그·설비 유형 카탈로그 revision을 제공한다. 새 DB/migration/원본 CRUD/일정 엔진은 추가하지 않는다. source와 canonical revision을 맞추고 응답 역전·실패·권한 만료는 최신 정상 View로 받아들이지 않는다.

비-WBS 직접 Gantt mutation/clipboard/context/inline/drag/link/delete/구조 편집은 차단하며 실제 Task의 작업 정보 열기는 canonical ID로 기존 Editor를 연다. Editor dirty/pending·복구 잠금은 View 전환을 잠근다. 선택 복귀는 canonical Task 의미를 기준으로 경로→같은 Task 다른 경로→안전한 fallback 순서로 처리한다. 데이터 Export와 기존 SVG/PNG Export는 canonical WBS 계약을 유지하며 활성 View 화면 캡처로 계약을 바꾸지 않는다.

Design Delta B: 기존 파란 Light/system font/semantic token/내부 scroll/키보드·focus·44px touch를 적용한다. 공식 SVAR Grouping tasks/groupBy는 PRO 전용이며 사용하지 않는다. 공식 문서 URL 조회와 실제 demo/browser 조작 증거를 구분한다.

## Gantt 표준과 상태 소유권

- gantt_standard_version: `GSC 1.0.0-candidate`; standard_read_commit: `229604522969133d1ccc6de0477e373252670c86`.
- GSC01/03/04: canonical snapshot/revision·원본 writer/recovery 소유권 유지; read adapter 서버 쓰기0.
- GSC05/06/07: 기존 날짜축 값을 읽으며 전환 복귀는 기존 coordinator를 사용한다. 새 입력보다 낡은 복원·GET 응답이 우선하지 않는다.
- GSC08/09/10: WBS instance identity·원본 선택과 표시행 key를 분리, 공개 API만 사용; 가상 행은 Core 관측 결과로 오인하지 않는다.
- GSC11/12: 동결 소스·실제 실행/실패·사전검토를 기록한다. 기존 conformance와 Required3/Full8 gate를 약화하지 않는다.
- SC01~13 중 직접 선정: no-op write0, filter/scope, axis/day-week, 선택/Editor·peer 복귀, native WBS 상태 및 geometry. SC14는 80+ 가상행의 windowed DOM·scroll 비용을 측정하며 장기1000Task+2000Milestone/실기기는 별도 NOT TESTED.

## AC_TEST_COVERAGE

- AC1: 신규 schedule-views Chromium에서 View visible label/옵션 순서·기본 WBS·표시단위 앞·5폭·keyboard/ARIA/day-week/fullscreen 검사. 기존 scale/fullscreen 고유 회귀 유지.
- AC2: 같은 실제 HTTP/SQLite fixture의 WBS→Resource→설비→WBS에서 원본/revision/write0·instance/axis/선택·filter/scope 복귀 검사; 기존 canonical/empty Summary/Milestone OFF·Export 회귀 유지.
- AC3: 순수 projection Unit+실제 Chromium fixture에서 공동 개인/복수 Group·Group-only·완전 미할당·그룹 미소속·동일경로 dedupe 및 canonical ID 검사.
- AC4: 순수 projection Unit+SQLite source/Chromium에서 type/model blank/unit/fleet/task0·복수설비·direct/subtree/legacy 중복출처 dedupe 검사.
- AC5: viewRowKey/canonicalTaskId 분리 Unit 및 실제 Task Editor 대상·가상 Summary 비편집·같은 Task 여러행 선택·삭제/재조회/응답 역전 음성 경로 검사.
- AC6: readonly adapter 자체 mutation API 없음·native hidden/inert/gateway 차단 및 mouse/keyboard/context/drag 입력 write0; WBS/원본 Editor의 기존 권한·If-Match 경계 회귀 유지.
- AC7: 80+ 가상행 windowing·Grid/Chart Y·scroll/선택/범위/filter/day-week/fullscreen/instance 측정; 요청세대와 응답 역전·dirty/pending 잠금 검사.
- AC8: 신규 GET actual SQLite/HTTP에서 project isolation/private gate/no-store·일관 revision·관련 Resource/Group만 조회·direct/subtree/legacy provenance·쓰기0 검사. 기존 KPI/Calendar 고유 산식 유지.
- AC9: 본 Packet/Failure Ledger/설계·UX/API/보안/TEST_PLAN/CHANGELOG 동기화, 실제 최소 LFF와 원격 Full Required3+Chromium8/Trusted/Owner 판정 분리. 새 Head 원격은 시작 시 NOT TESTED.

## TEST_LIFECYCLE_REVIEW

기존 `project-gantt-scale`, `project-gantt-fullscreen`, `projection-row-alignment`, `project-task-editor`, `issue-730-view-composer`, equipment/resource-dashboard 및 resource membership/source resolver/visibility 테스트를 사전 검색한다. ADD: 기존에 없는 일정 View projection/GET source/실제 View 전환의 명시 경계. seeded property32개 입력×2 View의64개 permutation pair로 표시 key 집합·고유 pair·모든 선택 Task 보존·canonical 불변을 검사한다. KEEP_UNIQUE: WBS native mutation·projection/viewport·Resource KPI·공수/Calendar·private read·canonical Export/SQLite/HTTP. 새 projection은 대시보드 composer를 대체하지 않는다. PARTIAL_OVERLAP: Row key/집계 원칙만 유사하고 실제 Gantt/권한 경계가 다르다. CONSOLIDATE_CANDIDATE/RETIRE_CANDIDATE 없음; 테스트 삭제·skip·assertion 축소·retry/timeout/Required gate 변경 없음.

기존 정적8shard plan은 새 spec만3번에 등록하고146개 원래 배치를 유지한다. planner/optimizer12개 Unit을 EXTEND/KEEP_UNIQUE하며 총147spec exact-once를 확인한다. 실행/Required 정책과 역사적 timing을 변경하지 않는다.

## LOCAL_VALIDATION_SELECTION

자동 Pre-PR의 UNKNOWN7은 BLOCKED로 보존하며 다음 명시적 생산자→직접·간접·음성 소비자 매핑으로 수동 검증한다. catch-all/정책 변경 또는 자동 도구 PASS 승격은 없다.

| 생산자 | 실제 검증·남은 경계 |
| --- | --- |
| 순수 schedule projection | 13 Unit(32seed×2 View property 포함), 원본·경로 key·Group-only/설비 유효 ID·한도 음성, 전체 Unit에서 재검증 |
| source DTO/GET·Repository·route inventory | actual HTTP/SQLite11 + 기존 auth inventory17/물류 links8/private6, WAL 동일snapshot·foreign/expired/revoked·broken reference·쓰기0; 전체 Unit/type/build 재검증 |
| panel TSX/CSS·Gantt integration | 신규4case 및 기존 scale/fullscreen/Editor41case, 5폭·실제 dateX/폭/Y·Chart hit·80+row/keyboard·scope/filter·같은instance/viewport·readonly 및 source 오류/역전 |
| parent Editor focus·canonical mapping | 신규 actual PATCH/If-Match·viewRowKey focus·Group catalog freshness, 기존 Editor 고유 케이스를 유지해 동일45case 묶음에서 검증 |
| i18n index/catalog | 전체 Unit/type/lint·새 UI의 기존t/managed displayName 경계, View 한국어 브라우저; 신규 View 모든 EN/VI 조합·실제 AT는 별도 NOT TESTED |
| 신규 test fixture 및 static shard plan | 기존 readiness receipt·GET→GET 전체 equality·entity ID matcher, 147spec exact-once/8shard 유지·planner/optimizer12 Unit, 원격 비용/8runner는 NOT TESTED |

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_880.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/ISSUE_880_FAILURE_ANALYSIS.md`: UPDATED
- `docs/evidence/issue-880/local-validation.json`: UPDATED
- `docs/evidence/issue-880/ci3533-source.json`: UPDATED
- `docs/evidence/issue-880/preflight-r1-replay.json`: UPDATED
- `docs/evidence/issue-880/rework-r1-local.json`: UPDATED
- `docs/evidence/issue-880/ci3537-source.json`: UPDATED
- `docs/evidence/issue-880/rework-r2-local.json`: UPDATED
- `docs/evidence/issue-880/r2-before-1024x900.png`: UPDATED
- `docs/evidence/issue-880/r2-after-1024x900.png`: UPDATED
- `docs/evidence/issue-880/r2-after-390x844.png`: UPDATED
- `docs/evidence/issue-880/r2-after-1024x480.png`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/GANTT_ADAPTER_ADR.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(기존 semantic token과 interaction 원칙을 적용하며 공통 시각 체계 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(기존 테이블에서 읽기 전용 자료를 구성하며 schema와 migration 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정 날짜 Calendar Dependency 알고리즘과 canonical Summary 집계 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(기존 canonical WBS 데이터 및 SVG PNG Export 원본과 지원 범위 유지)
- `docs/IMPORT_SCHEMA.md`: N/A(Import 원본 DTO JSON schema와 계약을 변경하지 않음)
- `docs/CI_CD.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 canonical Refs 리뷰 충돌 Owner Gate 운영 정책 적용)
- `AGENTS.md`: N/A(지침 역할 및 승인 정책 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(현행 Owner-managed 및 별도 최종 승인 정책 유지)
- `docs/DEPLOYMENT.md`: N/A(Docker Compose 운영 배포와 storage 변경 없음)

## 검증과 남은 단계

최종 제품/test/script/db/package/Next config1310입력의 source SHA256은 `a3a27d900b6ee2d6573293f2b017d301511fbae7170cc6a50a201720e03ad09f`다. source 시작=종료를 확인하며 전체 Unit3,738 PASS/기존3 SKIP(302파일PASS/기존1SKIP,local maxWorkers2), production build/runtime-tools·전체typecheck·전체lint(0error/기존18warning), version/discovery303Unit·888browser/Markdown412/cache/Pythonpreflight11 PASS다. 원본 lint 생성물 오염 FAIL과 이후동일소스 PASS는 원장L-010에서 구분한다. 신규4+기존41 Chromium은 최종동결45/45 PASS(exit0,6.8분,workers1/retries0/max-failures0)이며 source1310입력은 실행 후에도 동일했다. 최종 scoped logical86/DOM23·scroll2816/client578·End키 focus371.6ms, WBS density32·X120/Y38·scope/columns 보존·조회write0와 원본 Editor If-Match PATCH1을 확인했다. 앞선 단독231.8ms와 최종371.6ms를 합산하거나 성능 개선으로 해석하지 않는다.

자동 Pre-PR fast/targeted UNKNOWN7/missing0/BLOCKED를 수동 선정 PASS와 분리한다. 정제 증거는 [local-validation.json](../../evidence/issue-880/local-validation.json), 실제 명령·최초 실패·교정/미검증은 [단일 원장](../../ISSUE_880_FAILURE_ANALYSIS.md)을 따른다. 새 Head quality/e2e/docker/Trusted·Owner/Manager ACCEPT는 NOT TESTED, MERGE_READY BLOCKED다. 원격 CI 시작 후 모니터링하지 않는다. 실제 screen reader/터치 기기/native125%·운영 배포는 별도 NOT TESTED다.

본 커밋은 게시 직전 검증 snapshot이다. 실제 PR 번호·게시 Head·CI Run/Attempt는 Issue의 STATUS 댓글과 PR 메타데이터에 연결하며, CI 시작 후 상태 기록만을 위한 추가 push/본문 edited는 수행하지 않는다.

## 게시 경로 보완 — 원격 git 인증 만료

최초 local commit `f88e63461c5b48ef07269667f1be00d29c38bb75`의 shell push가 인증 만료로 exit128/FAIL했다. 원격 branch/PR/CI는 아직 없으며 L-011에 원본을 보존한다. Manager 승인에 따라 연결 GitHub GitData API로 동일 최종 Tree를 게시한다. author/date 입력이 지원되지 않아 원격 Head는 local commit과 다를 수 있으므로 부모 main·전체 Tree SHA·검증입력/PNG blob 동등성을 확인하고 실제 원격 Head를 PR/CI/STATUS에 기록한다. token 원문/전역 인증 설정·gate를 변경하지 않는다. 제품/test/script1310 SHA는 그대로이며 테스트 재실행/승계 PASS 조작은 없다.
