# SVAR Core 활용과 독립 기능 계획

## Issue #418 — Core `add-task`와 scoped command 해석

설치 Core 2.7.3의 Grid `add-task` column과 공개 `add-task` action은 native Header/Row 추가 UI 및 `target + mode(before/after/child)` 계약을 제공한다. masterGantt는 이 공개 interaction을 유지하되 Workspace scope에서 command 의미를 자체 canonical hierarchy에 맞게 해석한다. 전체 Project Header는 root add, scoped Header는 active Summary root의 immediate child, Row는 해당 Task/Summary의 child다. 일반 Task first-child Summary 전환과 일정 계산은 기존 서버 transaction이 담당하며 PRO/비공개 Store를 사용하지 않는다.

#418은 Core의 임시 local mutation을 계속 `api.intercept`로 취소하고 protected HTTP→canonical snapshot→공개 `api.exec` sync만 durable authority로 사용한다. canonical sync와 `filter-tasks`를 한 직렬 경계에 두고 add 전후 scroll/focus를 복원해 scoped filter가 Core의 중간 상태를 노출하지 않게 한다. 공식 참조: [add-task action](https://docs.svar.dev/react/gantt/api/actions/add-task/), [Grid columns](https://docs.svar.dev/react/gantt/api/configs/columns/), [Willow demo](https://docs.svar.dev/react/gantt/samples/#/base/willow). 확인일 2026-10-04. URL/계약 확인은 browser PASS가 아니며 동일 PR head E2E와 구분한다.

## Issue #384 — 앱 소유 다중 Copy 선택

설치 Core 2.7.3의 공개 select-task 타입은 toggle/range·selected 배열을 제공하지만 getState 문서에는 scalar 설명도 남아 있다. 앱 선택 집합이 Copy 기준이고 공개 Core select-task는 단일 primary만 연동한다. 별도 checkbox cell은 공개 IColumnConfig.cell을 사용하고 비공개 Store/PRO 구현을 사용하지 않는다.

공식 참조: [select-task](https://docs.svar.dev/react/gantt/api/actions/select-task/), [getState](https://docs.svar.dev/react/gantt/api/methods/getstate/), [Context Menu](https://docs.svar.dev/react/gantt/helpers/getmenuoptions/). 확인일 2026-10-02. URL·설치 타입 확인은 실제 demo 조작이나 구현 browser PASS가 아니다. 실행 결과는 TEST_PLAN/PR의 exact head evidence를 따른다.

## Issue #335 — linked sibling reorder와 Core 공개 move-task

설치 Core 2.7.3의 공개 `move-task` action은 `up/down/before/after/child`를 구분한다. masterGantt는 이 공개 interaction을 사용하되 서버 canonical hierarchy를 authority로 유지하며, #335에서는 같은 parent의 `up/down/before/after`만 Dependency 연결 상태와 분리해 허용한다. parent 변경/`child` 보호와 자체 Dependency/Scheduling 검증은 그대로다.

공식 참조: [move-task](https://docs.svar.dev/react/gantt/api/actions/move-task/), [User interface](https://docs.svar.dev/react/gantt/guides/ui-layout/user-interface/), [Context Menu helper](https://docs.svar.dev/react/gantt/helpers/getmenuoptions/), [Willow demo](https://docs.svar.dev/react/gantt/samples/#/base/willow). 확인일 2026-10-03. PRO package나 비공개 Store 구현을 사용하지 않는다. URL 확인은 실제 제품 browser PASS가 아니며 PR exact head E2E와 구분한다.

## Issue #345 빈 Summary Core 2.7.3 표현

2026-10-01 설치 Core 2.7.3 실제 Chromium probe에서 날짜 없는 native `summary`는 `Summary tasks must have start and end dates if they have no subtasks`로 초기 로드가 실패했다. 날짜 없는 public custom type은 행을 남기지만 유효하지 않은 bar 좌표를 만들었다. 이 두 경로를 채택하지 않는다. 공식 [taskTypes](https://docs.svar.dev/react/gantt/api/properties/tasktypes/) 확장과 앱 adapter로 Renderer 전용 `summary-container`를 사용한다. PRO `unscheduledTasks`/`summary` 옵션과 비공개 `$skip` 조작은 사용하지 않는다.

canonical Summary의 `start/end/duration/progress`는 계속 `null`이다. Renderer만 날짜 있는 실제 Leaf의 최소 시작일(모두 미산정이면 표시용 오늘 범위)에 `start=end`인 영폭 좌표를 준다. Core의 공개 Task 입력 계산은 이 영폭의 bar wrapper를 만들지 않는다. 이는 일정이나 duration 0 Milestone이 아니다. `summary-container`는 Domain/API/DB/Import/Export에 존재하지 않는다.

Grid의 날짜·정렬·기간, Editor, 필터, 진척과 완료, 이미지/Excel Export는 원본 DTO를 사용한다. Renderer serialize의 영폭 날짜는 저장/복사/계층 명령의 일정 입력으로 재사용하지 않는다. reverse adapter는 null Summary에 날짜/진척/resize 명령을 거부하고 명시적 이름 변경만 허용한다. native Summary drag/resize intercept와 no-bar 표현을 유지한다. 마지막 child를 잃은 노드에는 `open-task`를 복원하지 않아 Core의 빈 child collection 예외를 방지한다.

실제 probe는 `tests/e2e/project-empty-summary.spec.ts`, 실제 SQLite/API first/last child·same-instance·재조회는 `tests/e2e/project-empty-summary-persistence.spec.ts`로 검증한다. URL/문서 확인과 browser 조작 증거는 구분하며 CI 완료 전 전체 회귀는 NOT TESTED다.

상태: W03 Core-only 최소 통합, W06 독립 Calendar/Leaf Scheduling과 W07 root Task/Milestone persistence 완료. 확인일: 2026-09-12. W24는 명시적으로 확인한 첫 child 생성과 Summary 집계, 순수 WBS 계산을 선행 구현했지만 W08 전체를 완료한 것은 아니다. Reparent, WBS HTTP DTO/UI와 FS 재계산은 후속이다. 무료 Core가 표현할 수 있는 Link가 곧 본 시스템의 Scheduling 지원 범위인 것은 아니다.

## 1. 원칙과 근거

Core의 Task·Link 표현, 편집, Tree, Grid·Timeline을 공식 API로 사용한다. 일정의 최종 날짜는 독립 Domain Engine에서 계산한다. PRO 코드·비공개 알고리즘을 복제하거나 상용 패키지를 우회하지 않는다. PRO 패키지 설치·License 구매는 초기 계획에 포함하지 않는다.

공식 [Overview의 License 및 기능 구분](https://docs.svar.dev/react/gantt/overview/)은 Core를 MIT, PRO를 상용으로 설명한다. [공개 Repository README](https://github.com/svar-widgets/react-gantt)도 Core 기능과 PRO 기능을 별도로 나열한다. 아래 제품 분류는 이 두 공개 설명과 개별 Changelog에 근거하며, 독립 구현의 세부 규칙은 프로젝트가 정의한다.

| 기능 | 공식 제공 구분과 근거 | 본 프로젝트 초기 방침 | 담당 / 상태 |
| --- | --- | --- | --- |
| Task·Milestone·Summary 표현, 하위 Tree | Core. [Overview](https://docs.svar.dev/react/gantt/overview/) | 공식 렌더링·Hierarchy UI 사용 | Root Task/Milestone W07 PASS; W24 child 생성·Summary 표시 구현, Reparent/subtree 변경은 W08 후속 |
| Drag·Resize·편집 Form·Progress UI | Core. [README](https://github.com/svar-widgets/react-gantt) | 공식 이벤트를 명령으로 변환하고 서버 결과 반영 | Frontend / W07 root Task pointer·server·reload PASS |
| Grid·Timeline·Scale·정렬·필터 | Core. [README](https://github.com/svar-widgets/react-gantt) | 공식 기능 사용. UI 정렬과 저장 WBS 순서는 분리 | Frontend / W03 기본 Grid·Timeline PASS; 정렬·필터 후속 |
| Readonly | Core. [Overview](https://docs.svar.dev/react/gantt/overview/) | 기본 Readonly와 서버 Mutation 권한 검증 함께 적용 | W05 Project / W07 root Task mutation authorization PASS |
| Dependency Link 표현·편집 | Core는 FS·SS·FF·SF 표현 제공. [Overview](https://docs.svar.dev/react/gantt/overview/) | UI/API 유효 입력은 초기 FS/0으로 제한 | W03 FS 표현 / W07 Repository foundation PASS; mutation·계산 W09 |
| 주말·휴일 시각 강조 | Core. [Overview](https://docs.svar.dev/react/gantt/overview/) | Calendar와 같은 날짜 목록으로 강조 | Frontend / W24 주말 강조 구현, Project holiday 강조 후속 |
| 근무 Calendar와 근무일 계산 | Calendar 자동화는 PRO. [공식 문서 홈](https://docs.svar.dev/react/gantt/) | Project Calendar·Duration을 Pure Domain으로 계산 | Scheduler / W06 date-only·weekend·holiday·Leaf PASS |
| FS 기반 Auto Scheduling | PRO. [README](https://github.com/svar-widgets/react-gantt) | 자체 DAG 검증과 Forward Recalculation | Scheduler / 초기 계획 |
| 잘못된 Link 처리 | PRO 자동 처리로 명시. [Changelog 2.4.3](https://docs.svar.dev/react/gantt/whats-new/changelog/) | 자체 서버 검증으로 누락·Cycle·미지원 제약 거부 | Scheduler + Backend / 초기 계획 |
| Summary 자동화 | PRO의 진척 계산·Type 자동 변환. [Changelog 2.5.2](https://docs.svar.dev/react/gantt/whats-new/changelog/) | 날짜·Duration·진척 자체 집계. Type은 명시적으로 검증 | W24 child 기반 집계·원자적 첫 전환 구현; Summary는 이름만 API 변경 가능, 일정 직접 편집·삭제는 후속 |
| WBS 코드 | PRO. [Changelog 2.7](https://docs.svar.dev/react/gantt/whats-new/changelog/) | Parent와 Sibling Order에서 자체 생성 | W24 Pure Domain 계산 구현; HTTP DTO·Grid 표시와 Reparent는 후속 |
| Web → Excel Export | PRO의 내장 Export. [Overview](https://docs.svar.dev/react/gantt/overview/) | Backend 내부 OOXML/ZIP writer로 Gantt/Tasks/Project와 선택적 Dependencies sheet 생성 | [EXCEL_EXPORT](EXCEL_EXPORT.md) 구현 |
| SS·FF·SF 일정 계산, Lag·Lead | Core Link 표현과 별개. 위 공개 설명만으로 모든 계산 지원을 단정하지 않음 | 독립 Constraint 모델로 향후 검토. v1에서는 명시적 거부 | Scheduler / 후속 |
| Baseline | PRO. [README](https://github.com/svar-widgets/react-gantt) | 불변 Snapshot 설계 후 독립 비교 계산 | Scheduler + Backend / 후속 |
| Critical Path·Total/Free Slack | Critical Path와 Slack 표현은 PRO. [Overview](https://docs.svar.dev/react/gantt/overview/) | CPM·근무일 Slack 의미 확정 후 독립 구현 | Scheduler / 후속 |
| Grouping | PRO. [Changelog 2.7](https://docs.svar.dev/react/gantt/whats-new/changelog/) | 표시 그룹과 Parent 관계를 분리하여 검토 | Frontend + Scheduler / 후속 |
| Resource Assignment·Workload·Calendar | PRO. [Changelog 2.7](https://docs.svar.dev/react/gantt/whats-new/changelog/) | 자체 API·SQLite 할당, M/D·M/M workload, Project < Group < Resource 날짜 예외 | Scheduler + Backend + Frontend / #19/#56/#57 기반, #261 WORKING 확장(PR 검증 대상); PRO API 미사용 |
| Rollup | PRO. [Changelog 2.6](https://docs.svar.dev/react/gantt/whats-new/changelog/) | 별도 표시 집계 모델 검토 | Scheduler + Frontend / 후속 |
| Split Task | PRO. [README](https://github.com/svar-widgets/react-gantt) | Segment 계약·의존 Endpoint 정의 후 검토 | Scheduler + Frontend / 후속 |
| Undo/Redo, Vertical Marker, Unscheduled Task | PRO. [README](https://github.com/svar-widgets/react-gantt) | 초기 요구 범위 밖. 자동으로 구현 범위에 추가하지 않음 | 미선정 |
| PNG/PDF·MS Project 교환 | 공식 server-side export는 PRO. [Overview](https://docs.svar.dev/react/gantt/overview/) | Issue #245는 자체 SVG renderer와 브라우저 PNG 변환을 구현하며 PDF/MS Project는 범위 밖 | SVG/PNG는 [IMAGE_EXPORT](IMAGE_EXPORT.md), PDF/MS Project 미선정 |

## 2. 기능 경계의 주의점

주말을 칠하는 기능은 근무일을 제외한 Duration 계산과 다르다. 초기 Timeline은 Calendar 날짜를 계속 표시하고, Engine이 주말·Holiday를 제외하여 계산한 날짜를 전달한다. 시간 축에서 비근무일을 제거하는 비선형 Calendar를 직접 재현하는 것은 초기 요구가 아니다.

Summary 바 표현은 Core를 사용하되 날짜·진척 산출은 프로젝트 규칙으로 처리한다. Core의 내부 보조 동작과 Domain 결과가 충돌하지 않는지 Integration POC에서 확인하고, 동일 변경이 두 번 계산·저장되지 않도록 Adapter를 검증한다.

WBS는 표준적인 Tree 번호 계산이며 데이터 식별자가 아니다. Excel Export는 SVAR 내장 Export를 호출하지 않고 Repository의 프로젝트 데이터를 사용하는 Backend 기능이다. Excel → JSON/CSV는 Excel/VBA의 별도 경계이며 DRM 우회나 원본 Workbook 직접 업로드를 전제로 하지 않는다.

## 3. 구현 확인과 후속 완료 기준

- W03에서 설치 Core 2.7.3의 Version·MIT·React peer 범위, browser mount, fixture Task/Milestone/Summary/FS Link, 기본 readonly, 날짜 Adapter round-trip과 local final update command를 검증했다. 근거는 [RESEARCH.md](RESEARCH.md)와 [W03_REVIEW.md](W03_REVIEW.md)에 기록한다.
- `end` exclusive 해석은 공식 예제 기반 추론이다. W07은 설치된 Core 2.7.3에서 root Task의 실제 이동·좌우 resize, 서버 저장 왕복, 401/412/422/500 및 canonical read 실패 복원, Task/Link ID mapping을 검증했다. W24의 Summary는 이름만 API로 변경할 수 있고 일정 drag/resize와 직접 삭제를 허용하지 않는다. 실제 Link 편집은 W09까지 완료로 표시하지 않는다.
- [SCHEDULING_ENGINE.md](SCHEDULING_ENGINE.md)의 Calendar/Leaf fixture는 W06에서 PASS했다. W24는 Parent graph·Summary 집계와 WBS의 순수 계산 및 child 저장 경계를 추가했다. WBS DTO/UI, Reparent와 FS 계산·저장은 W08/W09 후속이므로 전체 완료로 표시하지 않는다.
- 상용 API를 호출하지 않고 필요한 결과를 표시할 수 있는지 기능별 QA를 수행한다. 확인하지 못한 항목은 완료로 표시하지 않는다.

공식 분류는 공개 문서의 확인 시점 기준이다. 설치 Version에서 달라지면 문서와 Adapter 계획을 함께 갱신한다. 자세한 초기 계약과 후속 기능의 결정 사항은 [SCHEDULING_ENGINE.md](SCHEDULING_ENGINE.md) 및 [REQUIREMENTS.md](REQUIREMENTS.md)를 따른다.


## Issue #57 Working Calendar 경계

SVAR 공개 Calendar 문서의 global/task/resource calendar 및 date/range exception 개념은 설계 참고만 한다. Issue #57 구현은 PRO Calendar package/API를 설치하거나 호출하지 않는다.

masterGantt의 실제 구현 경계는 다음과 같다.

- SVAR Core: Grid/Chart 표시·편집 이벤트와 기존 Gantt instance 유지.
- masterGantt Scheduling Domain: Gregorian ordinal, Base weekly rule, `WORKING/NON_WORKING` 예외, Leaf/Summary 계산.
- Calendar Server 계층: 7개 국가 2026 fixture materialize, Project/Group/Resource rule 저장, Preview/원자 commit.
- Resource workload: Project+Group+Resource Effective Calendar로 M/D 계산.
- 범위 밖: Resource leveling, 개인 휴무에 의한 Task 자동 재배치, 시간/반일 Calendar, SVAR PRO scheduling/calendar.

따라서 Issue #57의 기능 완성 여부는 SVAR PRO 기능과의 parity가 아니라 [ISSUE_57_WORK_CALENDAR](ISSUE_57_WORK_CALENDAR.md)의 자체 수용 기준과 GitHub Actions 회귀 검증으로 판단한다.


- Issue #97의 FS/lag=0 Link 생성·삭제와 서버 scheduling은 SVAR Core action interception + 자체 API/SQLite 구현이며 PRO auto-scheduling 기능에 의존하지 않는다.

## Issue #261 Resource 날짜 예외 확장

확인일: 2026-09-29. 설치 Core는 `@svar-ui/react-gantt` 2.7.3이다. [공식 Calendars guide](https://docs.svar.dev/react/gantt/guides/scheduling/calendars/), [Resource Calendar guide](https://docs.svar.dev/react/gantt/guides/resources/resource-calendar/), [resources API](https://docs.svar.dev/react/gantt/api/properties/resources/)의 PRO 구분과 Task/Resource Calendar 경계를 참조했다. 공식 sample URL 조회와 실제 JavaScript demo 조작은 구분하며 후자는 NOT TESTED다.

자체 순수 Scheduling Domain이 Project < Group < Resource 날짜 예외를 결정하고 서버가 충돌·원자 저장을 검증한다. Group/Resource WORKING으로 상위 휴무를 되돌리면 자체 Resource workload M/D·M/M 분자·일별 allocation·과투입 판정에 포함하지만 Task start/end/duration은 Project Calendar만 따른다. 최신 SVAR guide의 Task/Resource 근무시간 교집합 계산은 이 제품 요구와 다르므로 채택하지 않는다. PRO package/API·비공개 구현 도입, Project CUSTOM WORKING, 시간/반일, Resource Leveling은 범위 밖이다. 세부 계약과 검증 범위는 [Issue #261 설계 기록](ISSUE_261_RESOURCE_CALENDAR.md)을 따른다.

## Issue #258 — 관계 연결 Task 편집

Core 2.7.3의 공개 Grid text editor·Chart move/resize·update-task interaction을 보호된 Task PATCH로 연결한다. 요청 시작일과 적용 일정의 구분, Baseline effective schedule 복사, 전체 successor 재계산·Summary 파생은 자체 domain/server 구현이다. SVAR PRO `schedule`/working calendar/auto-scheduling은 활성화하지 않는다. 구조 명령의 linked 보호는 확대하지 않는다.

## Issue #299 Chart 수직 Drag & Drop

same-parent Chart reorder는 SVAR PRO에 의존하지 않는다. Core 2.7.3의 공개 `drag-task(top)` feedback과 masterGantt의 protected hierarchy command를 연결하며, 별도 PRO package·비공개 구현·cross-parent implicit reparent는 사용하지 않는다.


## Issue #549 — Milestone Timeline Core 연동 제한

확인일 2026-10-08, react-gantt 2.7.3 / 종속 gantt-store 2.7.2. [markers](https://docs.svar.dev/react/gantt/api/properties/markers/)는 PRO이며 MT1은 이를 호출하거나 복제하지 않는다. 공개 filter-tasks/scroll-chart/getState를 사용한다. date geometry의 문서화된 안정 widget API는 확인되지 않았으며 published typed derived scale state와 이미 설치된 store package-root exported getDiffer의 read-only 조합을 단일 version-bound 앱 adapter에 격리한다. react-gantt 타입 reexport와 runtime 미export의 차이 때문에 store root를 사용하며 deep import/새 패키지/private write는 없다. Day/Week step1/lengthUnit day의 실제 DOM ±1px 기준 검증과 unsupported/zero-size fail-closed가 후속 활성화 조건이다. Core 단발 filter는 scale props 갱신 후 초기화될 수 있어 앱의 canonical queue 뒤 controlled projection 재적용이 필요하다. 현재 운영 행 전환과 PRO 기능 parity는 완료 범위가 아니다. [기술 gate·실패·대안](MILESTONE_TIMELINE.md)을 따른다.

#549 독립 UI/UX 비교에서 Week month/year 헤더와 native Task의 canonical 날짜 의미 불일치가 선별 화면으로 확인되었다. Task start 대비 adapter x ±1px 자동 PASS는 전체 헤더 의미 PASS가 아니다. 원인/변경 전 baseline 재현은 NOT TESTED이며 #551 lane 활성화는 [별도 date/header 의미 gate](MILESTONE_TIMELINE.md#독립-uiux-비교에서-확인한-week-날짜-헤더-불일치)를 통과하기 전 허용하지 않는다.
