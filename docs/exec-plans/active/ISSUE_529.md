# Issue #529 — Resource Plan·공수 견적 Excel 보고

## Issue Work Packet

- repository: planner77/masterGantt, Issue [#529](https://github.com/planner77/masterGantt/issues/529), Epic #522.
- lifecycle_phase: ANALYSIS/DESIGN → IMPLEMENTING → LOCAL_VALIDATED → DOCUMENTATION_SYNC → PRE_QA → 원격 게시·PR_CI_STARTED.
- 요청 종료점: PR CI 등록 확인. CI 결과 모니터링·병합·main/GHCR·tag/release·Issue 종료·branch cleanup은 범위 밖이다.
- 착수 Issue OPEN/comments0, 기존 branch/PR 없음. main `b417fcc094bff98ea142374fcd746bce2458c2e1` / application0.97.0이다. 선행 제품 기능은 최신 #528 branch에 있으므로 `feat/issue-528-resource-schedule-drill` / `899d5d7d12855771339e84f7d7b10ce1e1012983` / application0.101.0을 stacked baseline으로 사용한다.
- working_branch: `feat/issue-529-resource-excel-report`, worktree `/home/planner/Dev/masterGantt-worktrees/issue-529`, parent `899d5d7d12855771339e84f7d7b10ce1e1012983`, initial tree `24c9b3974c33a989ac452b6e295b8d70388cfbff`, PR base는 선행 #528 branch다.
- 기존 main의 #524 diagnostic unset fix `747f477d21880a8357a710dee9c621973a5f19bd`는 backend가 현재 source와 비교해 필요한 부분을 통합한다. 외부 #528 navigation/E2E fix899 및 #527 test fix452는 baseline에 포함된다.
- version_decision: MINOR0.101.0→0.102.0. 하위 호환 opt-in 제품 기능이며 package/root lockfile/CHANGELOG를 동기화한다.
- release_required=true, release_authorized=false. 정식 게시 요청/승인은 없으며 PR 단계까지만 요청되었다.

## 목표·인수 기준·비범위

Issue 원문 전체를 수용 기준으로 사용한다. 기존 `POST /api/projects/{publicId}/exports/excel`과 handcrafted OOXML/ZIP writer를 재사용해 명시 opt-in Resource 보고를 추가한다. 기존 기본 Export의 이름·순서·의미를 보존한다.

1. 같은 scope/revision/Calendar/환산 기준에서 Dashboard/API/Workbook raw 값 일치.
2. Group·개인×Milestone 및 미지정·주/월 Plan 출력.
3. 공동 Task·다중 Group/Role에도 assignmentId당 상세1행.
4. 미설정/부분합/null/0 및 M/M 미설정 구별.
5. 부분 bucket/ISO week-year/Calendar override/동일 개인 Project 전체 참고값 재현.
6. 현재 조회 vs Project 전체 선택·stale·Origin/If-Match·기존 권한·위험 문자열·예산 실패.
7. 기존 Project/WBS/Gantt/Logistics/Milestone/Resource Export 조합 회귀 방지.
8. 실제 API 생성 XLSX를 자동 parser로 cell type/value/metadata/합계 확인.
9. 실제 Windows Excel/DRM은 별도 환경 판정이며 자동 parser PASS로 대체하지 않음.

금액/단가/인건비·실적·새 Excel SaaS/ExcelJS/SVAR PRO Export·DB schema·새 권한·domain 알고리즘 재구현·Workbook 재가져오기는 비범위다.

## 소유권·위임·댓글

- Manager: package/lock/version/CHANGELOG/이 Packet/PLAN·Interface/단계 결정·Issue 댓글.
- backend: export 계약 DTO/parser·snapshot 서비스·typed report bundle·OOXML writer·handler 및 관련 Unit/native API/자동 parser tests. 공용 DTO를 먼저 확정·동결해 frontend로 인계한다. Resource Domain의 산식을 복제하지 않는다.
- frontend: 공용 DTO 동결 뒤 기존 Export dialog/Workspace/Resource toolbar context 옵션·상태·model/CSS·관련 Unit/mock/native UI. backend/DTO/version에는 쓰지 않는다.
- frontend 후속 승인: 상태 보존 AC의 baseline REWORK에 한해 readonly workspace capture/restore 및 `src/features/gantt/project-gantt.tsx`의 기존 peerViewportRestore effect/직접 dependencies/사용자입력 취소 guard를 단독 소유한다. Gantt 전체 재설계·비공개 state 쓰기·Domain 알고리즘 변경은 허용하지 않는다.
- ui_ux: read-only interaction 설계·최종 source/log/PNG/geometry 비교.
- excel_vba: read-only OOXML·숫자/null·관계/시트 제약·Windows 호환 검토. 실제 환경 미실행은 NOT TESTED.
- qa_docs: DOCUMENTATION_SYNC 후 독립 AC/code/test/docs/security/source freeze·Local 검증. 구현자의 자체 PASS로 승인하지 않는다.
- infra: branch 준비·exact tree/commit 원격 게시·PR 생성·exact head CI 등록 확인만 수행한다.
- issue_comment_writer=manager, Sub-Agent issue_comment_allowed_types=NONE. 같은 파일 동시 쓰기·재귀 Agent 생성·무단 범위/버전/PR/release 변경 금지.
- backend API/ARCHITECTURE/SECURITY/EXCEL_EXPORT/RESOURCE_KPI_DASHBOARD/REQUIREMENTS/TEST_PLAN 문서는 단독 작성 후 shared 문서 작성권을 frontend에 순차 반환한다. frontend는 PROJECT_UX 및 반환받은 EXCEL_EXPORT/RESOURCE_KPI_DASHBOARD/REQUIREMENTS/TEST_PLAN만 갱신한다.

## 검증·문서·다음 handoff

Local Fast Feedback은 관련 Unit/SQLite/HTTP/OOXML parser·typecheck·changed-file lint·Markdown/version/diff와 실제 native API/UI에 한정한다. 전체 Vitest/Playwright/Docker 검증은 PR Actions에 넘기며 결과를 모니터링하지 않는다. parser는 기존 Node 표준 모듈/테스트 helper를 재사용하고 새 dependency를 추가하지 않는다.

UI는 기존 semantic token/compact primitive·keyboard/focus/Escape/복원·390/768/1024/1440/1920px·초안/조건/Gantt instance 보존·중복 요청/취소/late/stale를 검증한다. 공용 OOXML string writing·numeric raw/null·셀32,767 code point·기존 timeline/행/셀 및 추가 보고 예산을 fail-closed로 유지한다.

required_docs: RESOURCE_KPI_DASHBOARD/EXCEL_EXPORT/API/REQUIREMENTS/ARCHITECTURE/SECURITY/TEST_PLAN/PROJECT_UX/PLAN/이 Packet/CHANGELOG. DB_SCHEMA/migration/AGENTS/DESIGN/SCHEDULING_ENGINE/CI_CD/REMOTE_VALIDATION/배포/IMPORT_SCHEMA/VBA는 실제 diff 불변일 때 항목별 N/A 사유를 기록한다.

Next/@next/env 선언·lock·실제 설치16.3.8, SVAR Core2.7.3을 branch 준비에서 확인했고 node_modules를 물리 복사했다. runtime DB/.next/실행 로그는 복사·Git 저장하지 않는다. 구현 전 설치 `node_modules/next/dist/docs/`의 관련 guide를 읽는다.

공식 quality/e2e/docker·QA_FINAL/Manager ACCEPT 및 main/GHCR·실제 운영·Windows Excel/DRM·최종 수동 UX는 NOT TESTED다. Agent의 source/문서 동결 뒤 independent PRE_QA를 수행하고 exact tree를 게시한다. 각 Result Contract에 실제 명령/exit/시각/수치/hash/초기 FAIL·REWORK/미검증·문서 영향/N/A/Issue 로그 후보와 다음 owner를 포함한다.

## 실행 기록

BRANCH_READY PASS: parent/main/full SHA·기존 중복 없음·clean tree·모듈 환경 확인. backend/ui_ux/excel_vba read-only 설계 검토를 시작했으며 상세 API·시트·예산·UI 계약은 구현 전 Manager가 확정한다.

## 초기 설계 결정과 main 수정 통합 승인

새 Resource 보고서는 일반 Export에서 opt-in 기본 해제, Resource toolbar의 Excel 보고서 진입에서는 포함/현재 조회를 선택한다. 기존 단일 Export dialog와 legacy 시트 순서를 재사용하고 추가 시트만 append한다. 현재 조회 범위는 추가 Resource 보고서에만 적용되며 기존 Gantt/Tasks/Stages/Resource Effort는 기존 전체 범위를 유지한다고 안내한다. Project 전체도 확인 영역의 실제 기간/asOf/환산 정책은 유지하고 분류/개인/Task/WBS/Milestone/search/status/exact 범위만 명시적으로 제외한다. 사용자의 filter/LIFO/cache는 수정하지 않는다.

현재 조회는 cached 성공 DTO 존재만으로 활성화하지 않는다. active visitID/phase ready/actual query와 binding 일치 및 실제 target snapshot/source context를 확인한다. original drill source의 기간·환산과 현재 target DTO의 정책은 별도로 표시한다. 최신 Project GET으로 이전 report revision을 덮어쓰지 않으며 stale일 때 옵션·조건을 보존하고 재조회/재확인을 요구한다. UI는 DESIGN 및 UI/UX Pro Max의 modal focus 지침을 기존 semantic token·compact primitive와 함께 적용한다.

Export의 기존 actual body 한도8KiB와 Origin/If-Match/readonly 권한을 유지한다. exact descriptor/filter가 한도를 넘으면 명시413으로 전체 실패하고 IDs/page를 잘라내지 않는다. 새 report 시트는 원문 inlineStr/XML escape를 사용하고 기존 시트의 apostrophe 정책은 불변이다. 고유 Assignment 상세는 기간별 중복이 없는 assignmentId당1행이며 Plan period rows는 별도 시트다. 실제 Windows Excel/DRM은 NOT TESTED다.

backend probe에서 최신 main747의 unset diagnostic Assignment 상세·scope 수정이 선행 #528 source에는 없음을 확인했다. diagnostic unset만 view=assignments를 허용하고 T0의 개인/role 조건 전 unset Assignment IDs를 상세·scope·품질 원장에 반영하되 원래 source allowed Task/Assignment 교집합을 유지한다. parser/service/test3파일의 적응 통합을 backend에 먼저 승인했고, 그 외 Export 구현은 공용 interface 확정 뒤 승인한다. Source 전체 포맷이나 domain 산식을 복제하지 않는다.

## 확정 Interface와 구현 단계

IMPLEMENTING: backend의 공개 Export DTO/parser typecheck는 첫 실행 PASS다. `src/contracts/project-excel-export.ts`, `src/contracts/resource-excel-export.ts`, `src/server/exports/project-excel-export-contract.ts`를 동결하고 frontend의 전체 UI 통합을 승인했다. 이후 Interface 변경은 Manager 조정을 거친다.

`resourceDashboard`는 선택 옵션이다. current 요청은 실제 대상 `expectedReport.context`, raw `snapshotId`, `ResourceDashboardFilterInput` 및 필요 시 원래 drill의 `binding`을 포함한다. project 요청은 `expectedReport.context`만 기준으로 사용하고 binding/filters/snapshotId를 허용하지 않는다. 원래 drill 출처는 별도 `originalSourceContext`로 기록하며 실제 대상 보고 기간/asOf/timezone/환산 정책과 구별한다. `granularities`는 week/month의 중복 없는 1~2개다. 현재 전체 Report DTO의 내부 filter metadata를 그대로 request input으로 보내지 않는다.

기존 시트 뒤에 `Resource Report`, `Resource Milestones`, `Group Milestones`, `Resource Plan`, `Resource Assignments`, `Resource Quality`, `Resource Relations`를 추가한다. Assignment 상세는 고유 ID당 1행이며 Group/Role 관계는 별도 관계 행으로 정규화한다. 표시 반올림은 raw numeric 값에 영향을 주지 않는다. 0~100 진척/Load 값에 Excel의 100배 percent 변환을 적용하지 않는다.

추가 보고 예산은 신규 시트당 header/metadata 포함 50,000행, 전체 신규 보고 150,000행·실제 1,000,000셀이다. opt-in workbook 전체 XML 32 MiB·ZIP/response 16 MiB를 검사하며 초과하면 전체 실패한다. 기존 옵션만의 Export에는 신규 예산을 적용하지 않고 기존 예산과 byte/sheet 호환성을 유지한다. 기존 body 8 KiB는 변경하지 않는다.

같은 SQLite read transaction과 고정 clock에서 기존 Domain 서비스를 이용해 report/plans/Assignment/품질 DTO를 생성한다. Resource stale는 Export의 412 REVISION_MISMATCH로 반환한다. UI가 전달한 합계나 최신 Project GET으로 이전 보고 기준을 덮어쓰지 않는다.

main747 통합에서 기간 밖 unset Assignment가 진단 count에 있으나 기존 상세 선택에서 빠지는 추가 경계를 확인했다. backend에 optional `allocationOverlapsReport`/`effortRangeBasis` 2필드와 기존 Calendar helper를 통한 원래 실효기간 근무일 계산을 승인했다. within-period 값은 유지하고 outside-period MD/MM은 null이다. 모든 대상의 원래 기간 합 1,000,000일을 page 처리 전에 검사해 초과를 명시적 전체 실패로 처리한다. 날짜가 다른 계산에 기존 Assignment-ID-only clipped cache를 재사용하지 않는다. 현재 raw exact source Task/Assignment 교집합을 유지한다. 신규 Excel 품질 원장은 기간 밖 여부를 명시하고 선택 Assignment 합계에 섞지 않는다. UI 상세에도 원래 배정 기간 기준을 표시한다.

excel_vba의 read-only 계약 검토는 재검토 PASS다. 최초에는 current.binding이 optional이므로 exact 범위 누락이 성공한다고 지적했으나, 실제 service의 scope-bound snapshot fingerprint 비교를 확인해 지적을 철회했다. exact 보고서의 기존 snapshotId를 유지한 채 binding을 누락하면 scope 없는 새 identity와 불일치하여 Resource stale 및 Export 412로 실패한다. 정상 비-drill current에는 binding omission이 필요하다. 이 실제 서버 경로와 UI adapter 전달을 회귀 테스트 대상으로 지정했다. 이 검토는 writer 또는 실제 Windows 환경 PASS가 아니다.

backend 역할 지침의 Project Hyperlink 요구를 신규 Resource Report에 한정해 승인했다. 기존 validated APP_BASE_URL parser를 통해 public Project direct URL을 생성하고 사용자 URL/query/fragment/credential 없이 해당 신규 시트의 external hyperlink relationship 1개만 허용한다. 기존 시트와 legacy relationship/bytes는 유지한다. 이 예외의 실제 코드/allowlist/parser 검증과 문서를 함께 동기화한다. server-only bundle metadata의 additive URL은 허용하며 공개 요청 DTO는 변경하지 않는다.

ui_ux 초안 source 비교는 REWORK였다. 실제 조건/ID/revision/exact scope 확인 영역, 서버409/412 이후 새 조회 receipt와 명시 사용자 확인을 통한 재제출 잠금, 상세 stale의 Export evidence 전파, hidden/inert/제거 trigger의 visible focus fallback을 frontend에 보완 요청했다. 긴 조건·개별 control/footer·내부 scroll·native focus·5폭 containment 및 native Gantt 상태 검증 범위도 보강한다. 기존 compact Export primitive 예외는 유지한다. 이 source 검토를 실제 browser PASS로 표시하지 않는다.

ui_ux의 후속 실제 mock3/PNG5/source hash 비교에서 방문마다 초기화되는 confirmationId를 단일 rejectedReceipt와 비교하는 재확인 blocker를 발견했다. frontend는 visit/query/binding+confirmationId proof를 묶어 같은 요청에서만 receipt 증가를 비교하고 새 ready 방문은 명시 확인으로 승인하도록 수정했다. 최초 mock3 PASS 및 후속 REWORK/재검증 PASS를 모두 보존하며 수정된 source에 맞춰 PNG/geometry/hash를 다시 생성한다.

excel_vba의 writer read-only 검토는 XML1.0 금지 문자 U+FFFE/U+FFFF가 inlineStr에 남는 경계로 FAIL이었다. 새 Resource report는 XML1.0 금지 문자와 unpaired surrogate를 발견하면 EXPORT_UNSUPPORTED로 전체 실패하도록 backend에 승인했다. 허용 tab/LF/CR와 정상 supplementary Unicode 및 원문 =+-@ 문자열은 보존한다. valid legacy workbook bytes와 기존 string 정책은 유지한다. 이 결함을 수정한 코드/fixture/parser 및 문서 검증 뒤 재검토한다. 실제 Windows Excel/DRM은 계속 NOT TESTED다.

XML 재검토에서 Resource bundle만 검사하면 opt-in 파일의 기존 시트에 포함되는 Project/선택 범위 밖 Task·기타 보고 문자열이 검사되지 않는 같은 원인의 두 번째 FAIL을 확인했다. Manager는 검사 범위를 opt-in workbook의 모든 typed 입력(snapshot/legacy workload/stage DTO/Resource bundle)으로 확정했다. writer 진입에서 전체 XML1.0 문자열과 유한 숫자를 선검증하고 위반 시 전체 실패한다. 기존 no-opt-in 정상 byte 경로는 유지하며 실제 Project 이름·scope 밖 Task fixture도 포함한다. 최초 FAIL/부분 수정/재검토 FAIL과 최종 검증을 구분한다.

## 문서 영향 분석

required docs는 구현·테스트의 실제 반환 뒤 DOCUMENTATION_SYNC에서 정합성을 확인한다. PROJECT_UX는 frontend, API/EXCEL_EXPORT/RESOURCE_KPI_DASHBOARD/REQUIREMENTS/ARCHITECTURE/SECURITY/TEST_PLAN은 backend, PLAN/Packet/CHANGELOG는 Manager 소유다.

| 문서 | N/A 근거 |
| --- | --- |
| DB_SCHEMA / migration | 기존 원장을 읽는 보고 기능이며 table/column/index/persistence 계약을 변경하지 않는다. |
| AGENTS | 역할·Lifecycle·권한·완료 gate 정책을 변경하지 않는다. |
| DESIGN / UI_UX_GUIDELINES | 기존 시각 token·compact primitive·modal/focus 원칙을 적용하며 공통 디자인 정책은 유지한다. 화면별 실제 동작은 PROJECT_UX에 반영한다. |
| SCHEDULING_ENGINE | 기존 Resource KPI/Plan·Calendar 함수를 재사용하며 Scheduling 알고리즘이나 canonical 일정 계약을 변경하지 않는다. |
| CI_CD / REMOTE_VALIDATION | 기존 PR quality/e2e/docker gate·권한·workflow를 그대로 사용한다. version 0.102.0과 이번 실행 증거는 CHANGELOG/Packet에 기록한다. |
| DEPLOYMENT / Docker / REPOSITORY_STRUCTURE | 배포 파일·Compose·volume·실행 경로를 변경하지 않는다. |
| IMPORT_SCHEMA / VBA_EXPORT | 서버 OOXML 보고서 추가이며 Import schema/VBA/DRM 계약이나 코드를 변경하지 않는다. 실제 Windows Excel/DRM 판정은 별도 NOT TESTED다. |

현재 tracked diff 기준 위 N/A 범위에 코드/계약 변경이 없으며, 게시 전 최종 diff에서 다시 확인한다.

## Native UI 스크롤 REWORK

current 실제 Next XLSX parser의 raw/metadata 검증은 성공했지만 일정→Resource→일정 복귀의 DOM scroll120→0에서 첫 Native UI가 FAIL이었다. 기존 public viewport/native wheel oracle를 적용한 두 번째 실행에서도 이동 전 public Core+DOM120, 복귀 후 둘 다0으로 같은 계약 FAIL을 확인했다. selection/column/tree·DOM identity는 유지됐다. 두 번 같은 원인이므로 Manager는 fixture 시점 가정 대신 실제 peer viewport REWORK로 재분류했다.

frontend가 Export 미진입의 동일 전환 control, parent899 및 이번 readonly view diff, saved viewport/restore/public events를 비교한 뒤 최소 원인/수정 범위를 반환한다. scroll assertion 제거·0 baseline·timeout 확대는 금지한다. 필요한 제품 수정은 Manager의 범위 확정 뒤 수행하고 영향 native/기존 state 검증과 문서를 갱신한다. 해당 Local gate 해결 전 PR 게시 단계로 넘기지 않는다.

no-Export native control도 시작 public/DOM120 → Resource 비활성 public120/DOM0 → 복귀 public/DOM0, restore=null·같은 API instance/sync generation2로 FAIL이었다. parent899의 plain `activateWorkspaceView`에는 viewport capture가 없고 `activateScheduleView`의 Gantt→Milestone에만 기존 capture/restore가 있었다. 이번 초기 readonly view diff는 Export ref/callback 10줄이며 기존 peer handling을 바꾸지 않았다.

Manager는 AC의 작업 상태 보존에 필요한 baseline 보완을 승인했다. frontend 단독 소유 `project-readonly-view.tsx`에서 기존 Milestone peer capture helper를 재사용해 실제 활성 일정/Gantt → Resource/물류 workspace 전환에서도 public viewport와 generation을 보존한다. 복귀는 기존 Core scroll-chart restore를 사용하고 hidden DOM0 덮어쓰기·다른 source/instance/sync generation의 stale 복원을 차단한다. Gantt module/Domain/API·remount는 변경하지 않는다. no-Export control/Export 고유1/기존 Milestone viewport 고유1 및 필요한 Unit·문서·정확 sourcehash를 검증한다.

1차 readonly 보완 뒤 restore 요청/public/DOM120은 실제 성공했지만 같은 instance/sync generation의 후행 resize-chart1980→906과 scroll-chart0이 덮어써 Native Export/control이 FAIL이었다. 기존 Milestone control은 다른 주 scale/다행 fixture에서 PASS였다. 최초 capture 누락과 후행 resize 경계를 구분하고 before/after FAIL artifact를 보존한다.

### 후속 제한 승인 — 현재 viewport 구현 범위

Manager는 기존 `project-gantt.tsx` peerViewportRestore effect에 한정해 기존 metadata restore의 `ensureTimelineEnd → RAF → public scroll-chart` 경로와 instance/continuity key/canonical sync version/filter/scale/columns/gridWidth/사용자입력 취소 guard를 재사용하도록 승인했다. 위의 1차 Gantt module 제외 범위는 이 제한 승인으로 대체하며 Domain/API·remount·비공개 state 쓰기·무한 재복원은 계속 금지한다. 먼저 no-Export control1에서 판정하고 Export1/기존 Milestone viewport1 및 취소·stale guard 영향 검증을 수행한다.

read-only researcher는 설치 react-gantt2.7.3/gantt-store2.7.2 공개 type과 [exec](https://docs.svar.dev/react/gantt/api/methods/exec/), [scroll-chart](https://docs.svar.dev/react/gantt/api/actions/scroll-chart/), [resize-chart](https://docs.svar.dev/react/gantt/api/actions/resize-chart/), [on](https://docs.svar.dev/react/gantt/api/methods/on/) 공식 문서를 대조했다. 설치 exec Promise와 문서 void의 차이가 있고 어느 것도 최종 layout/resize settle를 보장하지 않는다. 공개 payload에 user-origin/settled marker가 없다. native Gantt 입력 취소와 RAF 순서는 앱 통합 선택이며 SVAR 보장이나 실제 조작 PASS로 표시하지 않는다. 실제 Chromium 검증으로 판단한다.

## Backend 동결과 문서 handoff

backend는 소유 21파일의 구현·문서 자체 PASS 및 쓰기 중단을 반환했다. 최종 관련 9파일 130 Unit과 별도 authorization 17 Unit의 고유 합은 147 PASS다. typecheck/changed lint/Markdown149/diff도 PASS다. 실제 Next HTTP NativeAPI 고유 1case는 16.4초 PASS이며 실행 당시 12파일 SHA를 보존했다. 이후 Resource writer의 `taskSubtotalsAdditive=false` 및 `assignmentEffortAdditiveAcrossResources` 설명 metadata만 변경했고 현 최종 Unit130으로 검증했다. NativeAPI 이전 exact writer bytes와 현재 영향 검증을 구분한다.

backend manifest `/tmp/issue-529-backend-freeze.json`, Native 실행 manifest `/tmp/issue-529-native-api-third-source.json`, 원래 FAIL/REWORK와 최종 로그는 로컬 검토 근거다. 이 임시 로그·실제 DB/runtime는 Git/Issue artifact에 저장하지 않는다. backend가 작성한 API/ARCHITECTURE/SECURITY는 동결하고 공유 EXCEL_EXPORT/RESOURCE_KPI_DASHBOARD/REQUIREMENTS/TEST_PLAN 4개는 frontend로 단일 소유권을 인계했다. PROJECT_UX/UI 검증과 스크롤 REWORK 후 전체 DOCUMENTATION_SYNC를 수행한다.

Hyperlink 요구 출처는 backend 역할 developer 지침의 “Excel Export에는 APP_BASE_URL + /projects/ + project.public_id 로 생성한 Direct Project Link를 Hyperlink로 포함한다.”이며 파일 경로는 없다. Manager의 이번 opt-in 단일 링크 승인과 API/보안/legacy 범위 구분을 적용했다. 독립 코드 검토 PASS나 Local PASS를 공식 CI/최종 QA/Windows PASS로 대체하지 않는다.

## 최종 소스 동결과 DOCUMENTATION_SYNC

frontend의 소유 33파일 동결 manifest는 `/tmp/issue-529-frontend-freeze.json`이다. 관련 3파일 18 Unit, quiesced typecheck, lint 오류0/기존 Gantt warning4/신규0, Markdown149/diff PASS다. UI 고유 범위는 mock3/native3/기존 Milestone1이며 반복 실행은 합산하지 않는다. current/exact/whole 실제 Next XLSX의 typed cells·고유 Assignment·raw MD·대상/원래 context 대조는 최종 Export1 PASS4.4초다. 같은 묶음의 control은 Project 생성429로 Export 진입 전 FAIL했고, rate-limit 변경 없이 새 dedicated 서버의 최종 control1 PASS7.5초로 구분한다.

viewport 최종 순서는 현재 source/instance/sync/filter/scale/columns/gridWidth/input guard 아래 timeline 준비·RAF·실제 필요한 가로 범위 준비·공개 scroll-chart 1회다. no-Export control의 public/DOM120 및 기존 Milestone viewport1 PASS1.9초를 확인했다. pending 취소1 PASS3.3초는 controlled RAF와 실제 native wheel/조건 변경 fixture이며 자연 layout settle 증거와 구별한다. 최초 capture 누락/후행 scroll0/ensure-only clamp30 FAIL과 historical source hash 미수집 NOT TESTED를 공개 근거 README와 원래 JSON에 보존했다.

required docs 11개를 실제 API/서버 writer/UI/검증과 대조했다. API/ARCHITECTURE/SECURITY는 backend 동결본, EXCEL_EXPORT/RESOURCE_KPI_DASHBOARD/REQUIREMENTS/TEST_PLAN은 backend→frontend 순차 인계본, PROJECT_UX는 frontend, PLAN/Packet/CHANGELOG는 Manager가 작성했다. 기존 primitive와 권한·revision·canonical snapshot을 유지하고 opt-in 범위·단일 검증 링크·예산·null/raw·stale/명시 확인·viewport 보완을 동기화했다. 문서 영향 분석 표의 N/A 대상은 최종 diff에서도 불변이다. DOCUMENTATION_SYNC를 완료한 뒤 독립 PRE_QA에 인계한다.

PNG5와 소규모 합성 fixture JSON/README만 게시한다. 실제 DB·runtime log·다운로드 XLSX·쿠키/암호·generated Next 설정은 제외하며 소유 runtime 종료와 생성 설정 HEAD byte 복원을 확인했다. 최종 stage/tree와 독립 검토 결과, 원격 commit/PR/exact-head CI 등록은 외부 Issue/PR 증거로 기록해 검토 후 committed source를 변경하지 않는다. 공식 quality/e2e/docker·QA_FINAL/Manager ACCEPT·main/GHCR·Windows Excel/DRM은 NOT TESTED다.

## 독립 PRE_QA REWORK — DOM 복원의 입력 취소

최초 staged tree `d6906d47d8ce2aa58527bbfc7483c0fe4278307d`의 독립 PRE_QA에서 입력 취소 계약 FAIL을 발견했다. Gantt Core effect는 wheel/pointer/keydown으로 취소하지만 readonly view의 별도 DOM 복원 RAF에는 같은 취소 guard가 없었다. 취소 JSON의 실제 이벤트는 사용자 wheel requested31/public30 뒤 이전 requested120/public120을 보여 주는데 기존 oracle은 dev restore marker가 null인지만 검사해 PASS였다. 해당 기존 취소 PASS는 계약 충족 증거로 무효이며 값·source hash·원래 실행 결과를 historical REWORK로 보존한다. 앞의 구현자/UI 비교 PASS를 이 독립 FAIL의 승인으로 사용하지 않는다.

Manager는 frontend에 DOM/공개 Core 양쪽의 입력 취소와 현재 source/instance/generation guard 보완, pending RAF 완료 뒤 최종 public/DOM 사용자 위치 보존 및 이전120 복원 없음의 직접 assertion을 승인했다. backend/DTO/권한/Domain은 변경하지 않는다. 취소·양수 control·actual Export·기존 Milestone의 영향 검증과 관련 문서/공개 근거를 재동결한 후 DOCUMENTATION_SYNC·독립 PRE_QA를 반복한다. 기존 tree와 문서 gate는 stale이며 원격 게시를 보류한다.

## 입력 취소 재작업 검증

frontend는 readonly DOM RAF에도 Gantt 영역의 입력 취소 및 현재 panel/source/instance/sync/geometry guard를 적용했다. Core effect는 그대로 유지했다. 정상 기존 Milestone1/실제 Export1/no-Export control1은 각각 PASS1.8/6.2/2.2초이며 제품 source가 같은 최종 취소1은 PASS6.8초다. 취소 테스트는 실제 wheel 직후 public30/DOM31을 각각 캡처하고 pending RAF 200+300ms 후 exact 값 보존, 이전 requested120 이벤트 없음 및 source/filter 변경 취소를 직접 검증한다. 서로 다른 public/DOM 값을 같다고 가정한 두 번의 oracle FAIL과 가상 clock보다 과거 pauseAt fixture FAIL도 별도로 보존했다. 마지막 spec 변경은 두 번째 pause 기준만 browser의 현재 clock+100ms로 보완했으며 positive3의 실행 source/spec와 재사용 범위를 구분한다.

최초 marker-only 취소 PASS와 ui_ux의 해당 판정은 NOT VALID로 유지하고 원본 근거를 삭제하지 않는다. 새 동결 manifest와 source hashes/공개 JSON/관련 문서를 다시 대조해 DOCUMENTATION_SYNC를 수행하고 새 staged tree에서 독립 PRE_QA와 ui_ux delta 검토를 요청한다. 정식 CI gate·QA_FINAL/Manager ACCEPT·Windows Excel/DRM은 계속 NOT TESTED다.


## Issue #529 CI #2145 후속 (2026-10-08)

- 실패: PR #543 CI #2145, Chromium E2E shard 4(#83) 및 shard 6(#526). Static/Unit/Build/Docker/Policy PASS.
- #83: 선택 범위에 개인 Assignment가 없는 empty 상태는 할당 없음으로 표시. configured 0 M/D·M/M, unset은 서로 구별. Unit 검증 추가.
- #526: Task 선택 후 SVAR 자동 가로 이동과 DOM-only 120px 스크롤 설정 경합 제거. 기존 #527 패턴으로 canonical sync 및 연속 animation frame 이후 Core/DOM 일치 상태를 기준으로 하여 화면 복귀 strict equality 유지.
- 새 exact-head CI 결과가 확인되기 전 PASS 미주장. QA_FINAL/Manager ACCEPT/Windows Excel/GHCR NOT TESTED, release_authorized=false.

## CI #2148 실패 및 후속 보완 (2026-10-08)

- PR #543 / commit `58f3ef97` CI #2148: Chromium shard1의 기존 #502 `error-boundary-regression.spec.ts` Gantt Demo error boundary assertion 1건 FAIL; 나머지 E2E shard2~6 및 Quality/Build/Docker/Policy PASS.
- SSR-visible React button의 hydrate 전 native Enter race를 방지하기 위해 비운영 gated `ErrorBoundaryProbe`의 effect readiness marker 및 Playwright onClick receipt를 추가한다. 여전히 실제 render throw → route boundary → retry/reset → focus 복구를 검증한다.
- 임의 timeout/skip/expected failure로 위장하지 않는다. #529 Resource Excel/Domain/API/DB 변경 없음. CI와 최종 QA 결과는 새 exact-head 검증 전 NOT TESTED, merge/main/GHCR/Issue close 미승인.

## 최신 main 정렬·충돌 해결 — 2026-10-08

- #527 PR #535와 #528 PR #536이 main에 병합되었다. #528 merge SHA `3fa543b10e98d59e50f63f3f53613affe720b648`가 이 정렬의 기준이고, 기존 #529 공통 조상은 `899d5d7d12855771339e84f7d7b10ce1e1012983`이다. 기존 #529 head `c521e18d2368729ac757614c003b9376e660ea0f`의 PR CI #2150은 PASS지만, 새 병합 tree에 대한 재검증으로 취급하지 않는다.
- 변경 비교: main 쪽24파일, #529 쪽70파일. #529에만 있는51파일은 그대로 보존하고 동일 경로 수정19파일은 공통 조상 3-way 비교로 합쳤다. 충돌7곳은 아래 계약을 기준으로 명시적으로 해소했다.
- `docs/TEST_PLAN.md`: main의 #527/#528/PR #545 검증 기록과 #529 Export/CI 기록을 모두 유지한다.
- `project-resource-dashboard.tsx`: main의 query/snapshot 변경 시 selection/expanded 무효화와 #529의 Excel evidence/refresh callback을 둘 다 유지한다.
- `resource-dashboard-service-core.ts`: main의 `diagnosticSelection`과 #529의 exact Assignment 진단용 `diagnosticDomain`을 둘 다 반환한다. 기존 GET/POST 원장·조회 권한의 축소/확대를 허용하지 않는다.
- `resource-milestone-ui.spec.ts`: main의 직접 하위 Alice node 선택 및 dimension/resourceId/milestone 판정과 #529의 excluded Assignment 상세 검증을 둘 다 보존한다.
- `resource-plan-dashboard.spec.ts`: #529에서 CI 통과한 Core auto-pan 이후 nonzero public/DOM 안정 상태를 유지하며 왕복 strict equality도 보존한다. main의 임의 120px 입력 경합 회피 목적도 유지한다.
- `resource-dashboard-model.test.ts`: empty MD/MM 0/null, configured 0, unset/partial 구별을 모두 테스트한다. `resource-dashboard-ui.ts` fixture는 main의 동일 날짜 교집합 동작을 사용한다.
- 공통 소스에는 Release 승인·제품 버전·DB schema·기존 권한·CI gate 변경을 가하지 않는다. 충돌 해결 후 exact-tree PR CI가 최종 검증이며 QA_FINAL/Manager ACCEPT, main/GHCR/정식 Release는 이번 요청 범위 밖이다. `release_required=true`, `release_authorized=false`.

## PR CI #2171 실패·동일 SHA 메타데이터 CI #2172 구분 (2026-10-08)

- PR #543 full CI #2171 (run `37752287987`, head `ff7576cf6a398804dfe87239dc70e84d7bd762fc`): 6 Chromium E2E shard / ESLint / repository policy PASS. TypeScript `TS2304` at `resource-dashboard-service-core.ts:339`, Vitest `resource-dashboard.test.ts` 4개 FAIL; Next.js build와 Docker image build 연쇄 FAIL. 정확한 원인은 최신 main/#529 충돌 해결 시 기존 `getDetails`가 참조하는 미정의 `domain` 분기와 진단 상세 행을 다시 잘라내는 `diagnosticSelection` 우회 로직을 남긴 것이다.
- 같은 HEAD의 PR metadata-only CI #2172 (run `37753712741`)는 새 전체 검증이 아니며 #2171의 failed required gates를 회복하지 못했다.
- 해결: `getDetails`는 `detailTargets`의 canonical `diagnosticUnsetRows` 결과를 그대로 사용한다. 원본 Assignment 기간과 보고기간 겹침, exact ID 범위 및 개인 필터 미적용 T0 진단의 3가지 기존 회귀 `tests/server/resources/resource-dashboard.test.ts`를 유지한다. 결과를 다시 `diagnosticSelection` clipped 행으로 덮어쓰지 않는다. 필터·원장·권한·DTO·API 변경 없이 미정의 식별자를 제거한다.
- CI 오류를 기존 PASS라고 보고하지 않는다. 새 head 공식 Quality/E2E/Docker 결과와 QA_FINAL/Manager ACCEPT는 실행/판정 전 NOT TESTED. release_required=true, release_authorized=false; 병합, Main CI, GHCR, Issue 종료는 요청 범위 밖이다.

## 2026-10-08 — 최종 PR 리뷰 해소와 명시적 릴리스 승인

- 원격 HEAD `c79d7abdf201c4d8f0e268a7d820605401ec3701`의 PR CI #2174는 quality/e2e/docker PASS였으나 오래된 PR Review P2 두 건이 unresolved 상태였다. 변경된 신규 HEAD는 이 성공 증거를 재사용하지 않는다.
- Raw unset Excel quality의 원래 Assignment 기간 합산 1,000,000일 예산을 기존 interactive 진단과 동일 함수에서 수행하도록 변경. 원래 기간 1,000,000일 허용, 1,000,001일 전체 422; 개인 필터/상세 페이지로 우회 불가. 기존 제한·출력 계약은 변경하지 않는다.
- Excel 보고서 확인창의 Task/WBS 필터를 실제 catalog name + stable ID로 표시하며 missing ID는 그대로 남긴다. 전체/Group/Resource/Milestone 조건은 기존 출력 계약 유지. 두 지적에 대한 회귀 테스트 및 TEST_PLAN/PROJECT_UX/CHANGELOG를 동기화한다.
- **사용자 명시 승인:** 2026-10-08 18:47 KST `GHCR 게시를 포함한 병합 후 Main CI 시작까지 진행` 요청. Issue #529의 `release_required=true`, `release_authorized=true` (대상 application `0.102.0`). 승인 근거는 이 요청이며 Generic Finalizer가 읽을 수 있도록 Issue #529에 Owner-authored version-scoped marker를 별도 남긴다. PR/merge 후 Main CI·임시 image exact digest·formal Release CI·GHCR promotion이 PASS여야 정식 게시 완료다. 운영 배포/Windows Excel/DRM은 승인 범위에 포함되지 않는다.

## 2026-10-08 — #518 병합 후 최신 main 정렬

- #518 상위 Workspace 탭 단순화가 포함된 main `f94c22b00cac57bab409ca57e744b0530d2d35e5`(application `0.101.1`)를 새로운 정렬 기준으로 사용한다. #529의 `0.102.0` MINOR 및 Resource Excel 계약은 유지하고, #518의 `일정 / Milestone 대시보드 / 리소스 / 물류 구성` 탭 4개·공통 Editor 위치·키보드 이동을 보존한다.
- #529의 Gantt viewport 보호 및 Excel evidence 수집/내보내기 진입은 #518 상위 탭 이벤트에 통합하고, 제거된 `scheduleView`와 하위 Gantt/Milestone 탭 코드가 재도입되지 않도록 한다.
- #518 `0.101.1` CHANGELOG 및 PLAN 히스토리와 #529 `0.102.0`의 릴리스 승인 근거를 동시에 보존한다. 기존 PR CI #2176 성공 여부만으로 새 main merge tree의 검증을 대체하지 않으며 exact-head PR CI 재실행 후 병합한다.

