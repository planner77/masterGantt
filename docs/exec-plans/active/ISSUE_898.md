# Issues #898 / #899 — 실제 휠 입력·조회 Task 선택 재작업

## ISSUE / REQUIREMENT

Primary [#898](https://github.com/planner77/masterGantt/issues/898), related [#899](https://github.com/planner77/masterGantt/issues/899). 현행 [Issue Lifecycle](../../ISSUE_LIFECYCLE.md)의 로컬 경로를 따른다. 이전 #904는 CLOSED/merged=false이며 해당 구현을 채택 완료한 상태가 아니다. 현재 요청은 두 제품 결함의 구현·로컬 검증·문서·통합 준비다. 필수 Gate가 모두 성공한 경우에만 정상 main fast-forward Push한다. 이미지 게시·정식 tag/rolling alias·운영 배포·수동 종료는 각각 실제 Owner 승인 범위를 확인한다. 사용자 실기기 UAT는 자동 브라우저 PASS와 별도다.

- lifecycle_phase: LOCAL_IMPLEMENTED; risk_level: HIGH; qa_method: AGENT_LOCAL; qa_required: true.
- 위험: 공통 Ctrl+wheel 기본동작·Core/조회 viewport·Editor focus와 동시 입력/source 세대 영향.
- 목표: #898 세 View의 가시 Grid/Chart 본문 실제 Control+mouse.wheel과 page zoom 방지. #899 Resource/설비 Grid 단일 선택+현재 표시행의 시작점 정렬, 명시 Editor 진입/keyboard/focus 보존.
- non_scope: DB/API/auth/일정 계산·canonical writer·Core2.7.3·CI/권한 정책·기존 v0.145.1 tag/digest/FINAL 변경.

## BASELINE / VERSION_RELEASE

- main_sha / base_sha: `f9a6488d686ae7e4b3228c8a9fe9c33a7fd00185`.
- working_branch: `fix/issues-898-899-local`; worktree `/home/planner/Dev/masterGantt-worktrees/issues-898-899`.
- 이전 #904 candidate: `ccb7cd4f997c733a88c2e105a8a7df6a3dc3b75e`, base `4aad8865972e3446f0d34c7ffcfd2bbab439e366`.
- baseline_version: 0.145.1; candidate_version: 0.145.2. 수정 PATCH 후보 0.145.2는 로컬 검증 전에 package/lock을 함께 맞춘다. candidate version 변경은 정식 tag/게시 승인이 아니다.
- publish_authorized: false; semver_or_rolling_authorization: false; deploy_requested/deploy_authorized: false. 기존 image/운영 자원은 보존한다.
- 환경: Node22.14.0/npm11.10.0, frozen `npm ci --prefer-offline --no-audit` 실제 exit0/711 packages. lock/browser/fixture digest·최종 source fingerprint는 exact commit 보고서에서 고정한다.
- live_transition_evidence_911: 현재 Actions enabled=false, main ruleset24043042 active/rules deletion+non_fast_forward 실제 읽기 조회. Push 직전 재조회한다.

## OWNERSHIP / HANDOFF

Manager는 문서/원장/버전·검증 선정·통합·Issue 댓글, frontend `/root/frontend_fix`는 src/features/gantt의 density/project-gantt/schedule-view-panel/reveal·src/features/projects/project-readonly-view 및 직접 테스트 단일 writer다. ui_ux `/root/ux_review`는 read-only 설계, qa_docs는 최종 source 독립 read-only 검토다. 실제 모델은 실행 도구의 role 설정을 기록하며 최신 저장소의 Terra 기본값을 실행한 것으로 과대 표시하지 않는다. 이번 frontend role은 도구가 제공한 GPT-6.1 Sol/Medium, ui_ux는 GPT-6.1 Sol/Medium이다. 별도 Manager Agent는 만들지 않는다.

## REUSE_REVIEW

- REUSE_DECISION: EXTEND.
- REUSE_OWNER_EVIDENCE: 기존 #904 Work Packet의 사용자 결과 재활용 명시 승인, [#911 이관 결정](../../PR_DISPOSITIONS_911.md), 현재 사용자 `이슈 898,899 진행하세요`. 같은 기능·테스트의 로컬 재작업이며 신규 병렬 제품/검증 엔진을 만들지 않는다.
- REUSE_CANDIDATES: #822 density state machine·frame capture listener·실제 pointer test, #880/#889 ScheduleViewPanel/read-only HTTP SQLite fixture·source receipt/bookmark·projection/rowKey, #852 WBS TASK_REVEAL start 의미, #896 UI evidence helper·manifest와 #897 격리 UAT.
- REUSE_CONDITIONS: 기존 #904 제품/테스트 diff를 현재 소스와 대조해 필요한 부분만 적용. 원본 첫 실패·취소를 보존하고 실제 현행 source에서 다시 실행. 새 Core/scroll writer·전역 wheel 차단·테스트 skip/timeout/retry/허용오차 완화 금지.
- 검색: REGRESSION_INDEX/원장, ISSUE_822_FAILURE_ANALYSIS, ISSUE_880_FAILURE_ANALYSIS, ISSUE_896_FAILURE_ANALYSIS 및 보존한 #904 통합 원장. #822 가상 전체 bbox 포인터 오류, #904 Editor 복귀·End/Arrow·header readiness 실패를 재시험한다.

## TEST_LIFECYCLE_REVIEW / AC_TEST_COVERAGE

| 계약 | 재사용/수명주기 | 실제 검증 계획 |
| --- | --- | --- |
| #898 AC01/02/05 세 View 실제 wheel·zoom | schedule-views EXTEND, project-summary-bar-visual EXTEND, density Unit EXTEND | Control+page.mouse.wheel, elementFromPoint/가시 본문·빈 배경/scroll layer, 34→32→30→28→30→32→34, DPR/innerWidth/visualViewport와 native row/font/bar geometry |
| #898 AC03/04 제외·상태·쓰기0 | 기존 #822/#889/GSC KEEP_UNIQUE | 일반 wheel/header/toolbar/input/dialog/menu·coarse/상하한/burst, canonical/revision·WBS instance·readonly·POST/PATCH0 |
| #899 AC01/02/04 선택/reveal/editor | schedule-views EXTEND, 기존 #880 Editor Enter/Escape KEEP_UNIQUE | 실제 Grid click, bar-left와 sticky grid-right≤1px, dialog0, 명시 info/더블클릭/Bar·Enter/Space·focus 복귀 |
| #899 AC03 source/중복/가상화 | 기존 80+행/source receipt 사례 EXTEND, reveal Unit ADD | clicked rowKey, duplicate canonical selection, 연속 입력/wheel 우선, NO_DATE/NO_SCROLL_CAPACITY/NOT_MEASURABLE typed 분류 |
| 두 AC04/05 UI/증거 | #889 5폭 Day/Week/fullscreen 및 #890 locale 회귀 KEEP_UNIQUE | 390/768/1024/1440/1920, KO/EN/VI, 대표 #896 PNG/geometry/manifest·flow; 전체 Cartesian/운영 장치 UAT로 확대 주장하지 않음 |
| 두 AC06 문서/검증 | 현행 fast/targeted/docker/admit 재사용 | 현재 clean exact source의 실제 로컬 결과만 인정; 과거 Required3/E2E8/Trusted/Main/Release는 보존 이력, 신규 N/A |

공통 필수: typecheck/lint·전체 Unit/Integration·version/discovery/문서/production build. HIGH 영향 Gantt 소비자 합집합·실제 Chromium과 Docker image policy/runtime/API/SQLite restart를 수행한다. 직접/인접/음성 consumer 선정은 실행기 dry-run과 실제 파일을 대조한다. unknown/missing/미실행 필수는 Push 차단하며 임의 exclude하지 않는다. 실기기 Chrome/Edge·native125%·trackpad/hybrid·AT·사용자 최종 UAT는 실제 증거가 없으면 NOT TESTED다.

## UI_EVIDENCE_CONTRACT

기존 `tests/e2e/helpers/ui-evidence.ts`와 `scripts/ui_evidence.py`를 재사용한다. 합성 SQLite fixture만 캡처하며 actual source/test/fixture/lock/environment·PNG/Geometry/Flow를 연결한다. #898 density geometry는 34/32/30/28·coarse44, #899 측정 가능한 start alignment 오차≤1CSSpx다. Manifest 무결성/수치 성공은 사람의 시각·업무 수용이 아니다. 원본 source의 red/수정 후 green·대표 5폭/언어는 각각 출처를 기록하고 운영 화면/DB는 사용하지 않는다.

## DOCUMENTATION_SYNC

UPDATED 예정: DESIGN, PROJECT_UX, UI_UX_GUIDELINES, GANTT_STATE_CONSISTENCY, TASK_EDITOR, TEST_PLAN, CHANGELOG, 이 Packet/PLAN, 두 원장/Regression Index, 보존된 #904 최초 원장. AGENTS는 현행 실행 정책을 유지하며 제품 계약을 중복하지 않는 이유로 N/A. API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE은 서버·계산 계약 불변으로 N/A. CI_CD/GITHUB_OPERATIONS/LOCAL_PREPR/QA 정책은 현행 로컬 실행·권한 계약 변경 없음으로 N/A. 테스트 소비자 매핑에 실제 공백이 있으면 정확 경로만 등록하고 직접 회귀와 문서 근거를 함께 검증한다.

## ISSUE_LOG / 현재 판정

issue_comment_writer: manager. PLAN/RESUME는 #898/#899에 기록했다. 구현/동적 테스트/정확 source admission·Manager/Owner 최종 판정은 실제 실행 전 NOT TESTED다. 이미지 NOT PUBLISHED, 운영 NOT DEPLOYED. 필수 실패·source drift·미해결 지적은 후속 단계 BLOCKED다.


## 실제 조사/재사용 판정 후속

- 변경 전 #899 Grid click은 dialog 기대0/실제1로 red. 기존 #904 고정 휠 좌표는 main에서도 PASS해 결함 검출 능력이 부족했다. 가시 blank Grid scroll층·Chart SVG hit-test로 확장한 실제 Control+mouse.wheel은 기대32/실제34px로 red를 재현했다. 이 실패 시 baseline Page Zoom 지표 자체는 미측정이므로 제품 density 누락과 구별한다. [원장 F898-002/003](../../ISSUE_898_FAILURE_ANALYSIS.md).
- 영향 매핑 공백은 `schedule-view-panel.tsx/.css`·`schedule-view-reveal.ts` 정확 세 경로를 HIGH로 등록해 보완했다. 직접 Unit projection/scale/reveal과 Chromium schedule-views/i18n/fullscreen/editor-persistence/viewport-coordinator를 선택하고 sibling unknown/누락/위험 하향 차단을 유지한다. 전체 변경 합집합 계획은 Unit7+Chromium18, READY/unknown0/missing0였으며 이는 계획이지 실행 PASS가 아니다. 지정 매핑 회귀49PASS는 WIP SCOPED로 전체 Gate를 대신하지 않는다.
- ui_ux 실제 read-only 설계 검토는 기존 patch EXTEND를 지지했으나 고정 휠 좌표·중복 first()만으로 AC 전체를 충족할 수 없음을 지적했다. 개발 Agent는 이 빈 부분과 native pointer 시험을 확장한다. qa_docs `/root/independent_review`가 분리된 읽기 검토를 수행하며 최종 freeze/report 전 PASS를 선언하지 않는다.


## DOCUMENTATION_SYNC 적용

DESIGN/PROJECT_UX/UI_UX_GUIDELINES/GANTT_STATE_CONSISTENCY/TASK_EDITOR/TEST_PLAN·Packet/PLAN·두 원장/Regression Index와 원본 #904 실패 보존을 실제 갱신했다. 정확 세 경로 영향 매핑 변경은 TEST_PLAN/이 Packet에 직접 소비자·음성 차단 근거를 기록했으며 LOCAL_PREPR 실행 계약·권한/필수 Gate는 변경하지 않아 추가 정책 변경 N/A다. CHANGELOG는 제품 freeze 시 candidate version과 함께 갱신한다.


## Candidate 버전·검증 준비

두 사용자-facing 결함의 수정 PATCH로 package.json/package-lock의 root/top을 실제0.145.2로 동기화했다. 새 SemVer tag/GHCR/rolling 승인으로 간주하지 않으며 기존0.145.1 tag/digest는 변경하지 않는다. 최종 검사 launcher는 같은 `node scripts/verify-prepr.mjs`, 고정base/issue898을 사용한다. Docker29.8.0/Buildx0.37.0/linux-amd64와 설치된 Chromium headless-shell1243을 읽기 확인했다. 원본 worktree의 사용자 변경과 기존 운영 서비스/DB는 건드리지 않는다.

## LOCAL_IMPLEMENTED freeze와 다음 exact source Gate

frontend의 제품/테스트 수정을 완료했다. 직접 #899 최종 집중1PASS49.8초, #898 확장33.1초 PASS, #822 native blank4.9초 PASS는 WIP SCOPED다. #8995폭×DayWeek는 실제 capacity가 충분한 경우≤1px, 부족한 경우 typed NO_SCROLL_CAPACITY·clamp·잔차를 각각 검증한다. #8983View×Grid/Chart별34→28→34 전체 실제 입력과 blank/Bar·header/input 제외, 추가 Equipment Week/fullscreen 실제 row hit를 확인했다. 모든 조합/운영 장치에 성공을 확대하지 않는다.

진단 중 생긴 setup 실패/비취소 이벤트/미관측 원인을 F898-004~008로 보존했고 최종 집중 검사는 교정한 현재 전제를 검증했다. 최종 정적·전체 Unit·빌드/18Chromium·Docker/admit·독립 QA는 clean exact commit에서 실제 실행 전 NOT TESTED이며 결과를 Issue에 추가한다. 검사 뒤 문서 수정으로 source를 바꾸지 않는다. 정식 tag/rolling·GHCR 게시·운영 배포와 Owner UAT/종료는 미승인/미실증으로 구별한다.

## 독립 QA P2 재작업과 두 번째 source freeze

독립 qa_docs가 일반 Grid 날짜/기간 셀 double-click의 trigger 귀속 누락을 발견했고 별도 f1 제품/합성 HTTP SQLite 진단에서 두 View의 행 focus 소실을 실제 재현했다. f1 fast3976PASS/기존3SKIP와 Docker10단계PASS는 보존한다. f1 전체 Chromium은 Manager가 재작업을 위해 중단했고12PASS/1interrupted/146미실행으로 BLOCKED다. 실제로는 조회 root에 focus가 남았으며 숨긴 WBS 이동은 관측되지 않았다.

최소 교정은 같은 행 선택 버튼(작업명 숨김 시 tabindex=-1 Grid)을 Editor 열기 전에 focus하고 기존 role별 종료 복원에 Grid 역할을 추가하는 것이다. 기존 큰 #899 회귀+신규 visible/hidden Task명×Resource/설비 plaincell 실제 double-click·Escape·같은 rowKey focus 검사가2PASS(41.8초/21.4초)였다. 원본 callback/서버·canonical writer/추가Tab순서는 불변이다. 이 WIP 집중 결과를 새 exact commit 전체 검증으로 전용하지 않는다.

최종 package/lock을 포함한 실제 영향 계획은10Unit/19Chromium이며 버전 동기화 전7/18 계획보다 lock provenance 소비자가 추가됐다. 누락/UNKNOWN/exclude0을 다시 확인한다. 새 source Gate는 fast를 마친 뒤 targeted를 순차 실행하고 Docker는 격리 설치로 독립 수행한다. f1 동시 Unit이 남긴 원본 설치cache bytes drift는 F898-012로 보존하며 hashguard를 완화하지 않는다. 새 최종 보고서와 독립 QA·admit·Push/게시/Owner UAT는 실제 실행 전 NOT TESTED다.

## 출력 source 불변 교정과 최종 재검증

f4의 개별 Unit140/Chromium160은 실제 PASS였지만 tracked output13+untracked16으로 snapshot 전체는 BLOCKED였다. src/tests 코드1221개·index·설치5시점은 독립 일치 검산했고 Next2 외 legacy출력도 dirty 원인이었다. F898-013/014에 lint 출력 배치·그 회복·실제160PASS/guardBLOCKED·UI관측의 DECLARATION_ONLY 경계를 추가했다.

frontend는 기존4spec의29PNG/JSON변형(10write+mkdir1) 목적지만 testInfo.outputPath로 바꿨다. 역치환 bytes 동일·직접소비자 검색·typecheck/4spec lint를 통과했고 제품 src/API/DB/fixture·assertions/gate/timeout/retry/skip은 바꾸지 않았다. TEST_PLAN/LOCAL_PREPR/UI_EVIDENCE의 출력 계약을 동기화한다. 새 source의 공통·160Chromium·Docker·snapshot/admit/독립 QA는 다시 실제 실행 전 NOT TESTED다. f4 PASS는 새 source에 전용하지 않는다.

Owner가 사용할 수 있도록 자기 합성 SQLite snapshot을 일관 backup했고 기존 helper의73tables/38migrations/pending0을 확인했다. dataset capture source는 f4이고 활성 testtitle은 UNKNOWN이다. 새 source에서 제품/fixture bytes 호환·검증된 이미지 provenance를 확인한 후 별도 runtime copy로만 로컬 UAT를 준비한다. 실제 Owner 수용/운영배포/GHCR 게시·정식tag는 미실증/미승인으로 유지한다.
