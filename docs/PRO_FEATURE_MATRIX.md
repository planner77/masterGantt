# SVAR Core 활용과 독립 기능 계획

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
| Web → Excel Export | PRO의 내장 Export. [Overview](https://docs.svar.dev/react/gantt/overview/) | Backend에서 ExcelJS 검토. 표 Export 후 날짜 Cell Gantt | Backend / 단계적 계획 |
| SS·FF·SF 일정 계산, Lag·Lead | Core Link 표현과 별개. 위 공개 설명만으로 모든 계산 지원을 단정하지 않음 | 독립 Constraint 모델로 향후 검토. v1에서는 명시적 거부 | Scheduler / 후속 |
| Baseline | PRO. [README](https://github.com/svar-widgets/react-gantt) | 불변 Snapshot 설계 후 독립 비교 계산 | Scheduler + Backend / 후속 |
| Critical Path·Total/Free Slack | Critical Path와 Slack 표현은 PRO. [Overview](https://docs.svar.dev/react/gantt/overview/) | CPM·근무일 Slack 의미 확정 후 독립 구현 | Scheduler / 후속 |
| Grouping | PRO. [Changelog 2.7](https://docs.svar.dev/react/gantt/whats-new/changelog/) | 표시 그룹과 Parent 관계를 분리하여 검토 | Frontend + Scheduler / 후속 |
| Resource Assignment·Workload·Calendar | PRO. [Changelog 2.7](https://docs.svar.dev/react/gantt/whats-new/changelog/) | 용량·단위·Calendar 정책 정의 후 검토 | Scheduler + Backend + Frontend / 후속 |
| Rollup | PRO. [Changelog 2.6](https://docs.svar.dev/react/gantt/whats-new/changelog/) | 별도 표시 집계 모델 검토 | Scheduler + Frontend / 후속 |
| Split Task | PRO. [README](https://github.com/svar-widgets/react-gantt) | Segment 계약·의존 Endpoint 정의 후 검토 | Scheduler + Frontend / 후속 |
| Undo/Redo, Vertical Marker, Unscheduled Task | PRO. [README](https://github.com/svar-widgets/react-gantt) | 초기 요구 범위 밖. 자동으로 구현 범위에 추가하지 않음 | 미선정 |
| PNG/PDF·MS Project 교환 | PRO. [Overview](https://docs.svar.dev/react/gantt/overview/) | 초기 요구 범위 밖 | 미선정 |

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
