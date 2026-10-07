# Resource KPI 공통 집계 계약

Issue #523은 Resource KPI Epic #522의 R1이다. `src/domain/resources/resource-kpi.ts`의 실행 가능한 pure projection과 typed input/output, KPI 사전 및 고정 fixture를 제공한다. HTTP/UI 공개는 #524 이후이며 시간축 capacity, 실제 실적 원장, DB migration은 이 단위 범위 밖이다. 현재 상태의 계산을 다른 기준일과 비교할 수 있지만 과거 상태를 복원하지 않는다.

## 원시 단위와 분류

입력은 한 Project의 전체 canonical Task/WBS/Milestone Membership/Link snapshot, 현재 Resource Group·Global Role·개발 등급, 직접 Assignment와 Calendar다. 입력 Project public ID가 모든 원시 Assignment grain의 Project 부분이다. 하나의 입력에 다른 Project 데이터를 혼합하지 않는 책임은 호출 adapter에 있다.

공수 grain은 `(projectPublicId, assignmentId)`이며 일반 `type=task`의 개인 Assignment만 공수를 만든다. Task count/진척은 distinct `taskId`, Resource count는 distinct `resourceId`다. 동일 ID의 정확히 같은 join row는 한 번만 계산하고, 서로 다른 payload가 같은 ID이면 입력 순서에 의존하지 않고 거부한다. Resource Group/Role 배열은 unique/sort 후 비교한다. Summary/Milestone 개인 참조 및 Group 직접 참조는 `responsibilityReferences`에 full-project 별도 목록으로 보존하며 공수를 생성하지 않는다.

Group과 Role은 복수 소속 가능한 현재 분류다. 소계는 중첩될 수 있고 서로 더할 수 없다. Grand Total은 원시 Assignment에서 직접 계산한다. 분류 없는 Resource는 `groups.id=null`, Role 없는 Resource는 `UNSPECIFIED`다. Milestone bucket은 기존 `projectStageGates`가 해석한 explicit/가장 가까운 Summary 상속/override이며 `milestoneTaskId=null`은 명시적인 미지정 bucket이다. explicit row 해제는 기존 projector대로 상위 상속을 다시 드러낸다.

## 범위 A와 T0

필터 배열 내부는 OR, 서로 다른 조건은 AND다. 비어 있는 배열은 해당 축의 제한 없음이다. Task/WBS/Milestone/기간은 Task를 선택하고, Resource/개인 Group 분류/Global Role/개발 등급은 **같은 개인 Assignment의 Resource**를 제한한다. 서로 다른 담당자의 속성을 조합해 일치로 보지 않는다. WBS root 조건은 root 자신과 자손이며 Milestone 배열에는 `null` 미지정 선택을 넣을 수 있다.

- T0: Project의 고유 일반 Task 중 Task ID, WBS subtree, effective Milestone, canonical Task 일정과 조회 구간의 inclusive 교집합에 맞는 집합.
- A: T0의 개인 Assignment 중 Resource/Group/Role/등급 조건과 유효 Assignment 기간 교집합에 맞는 집합. 할당 Task KPI의 대상은 A에 실제 포함된 고유 Task다.
- T0 진단은 개인 Resource/Group 분류/Role/등급 조건을 적용할 수 없다. `diagnostics.inapplicableFilters`, `personalFiltersAppliedToA`, `denominator`, `taskIds`와 `metadata`가 이를 설명한다. A와 T0는 같은 분모라고 표현하지 않는다.
- T0 개인 존재 여부는 모든 원시 개인 Assignment에서 판정한다. 개인 조건이나 Assignment 기간 때문에 A에서 숨겨진 담당자도 T0에서는 개인 배정이 존재한다. Group 구성원을 개인 배정으로 추정하지 않는다.

완전 미할당은 개인·Group 직접 참조가 모두 없는 Task다. Group만 지정은 Group 참조가 있고 개인 참조는 없는 Task다. 개인 미배정은 두 집합의 합집합이다. 공수 미설정은 개인 Assignment의 allocation=null이며 Task ID 집합과 Assignment ID 집합/개수를 별도로 제공한다. 미배정 공수를 추정하지 않는다.

## KPI 사전

아래 사전은 exported `RESOURCE_KPI_DICTIONARY` 17개 항목과 일치한다. 모든 지표의 기준은 canonical 현재 snapshot + 명시적인 Project timezone/asOfDate다. Group/Role 중첩 소계에서 count와 공수는 가산이 아니며, 공수는 서로 겹치지 않는 Assignment partition에 대해서만 가산이다. 비율과 full-stage 상태는 비가산이다.

| 이름 | 단위 / grain | 분자 / 분모 | 범위 | 누락 의미 / drill-down |
| --- | --- | --- | --- | --- |
| 할당 Task | Task / distinct Task | A의 고유 일반 Task 수 / 없음 | A | 빈0 / taskIds |
| 시작 전 Task | Task / distinct Task | status=not_started 수 / 없음 | A | 빈0 / notStarted.taskIds |
| 진행 중 Task | Task / distinct Task | status=in_progress 수 / 없음 | A | 빈0 / inProgress.taskIds |
| 완료 Task | Task / distinct Task | status=completed 수 / 없음 | A | 빈0 / completed.taskIds |
| 지연 Task | Task / distinct Task | progress<100 AND canonical end<asOfDate 수 / 없음 | A | 빈0 / delayed.taskIds |
| Resource | Resource / distinct Resource | A의 고유 Resource 수 / 없음 | A | 빈0 / resourceIds |
| Assignment | Assignment / Project+Assignment | A의 고유 개인 Assignment 수 / 없음 | A | 빈0 / assignmentIds |
| 완료율 | % / distinct Task | 완료 고유 Task 수 / A의 고유 Task 수 | A | 분모0=null / completion.taskIds·completedTaskIds |
| 할당 작업 진척 | % / distinct Task | sum(duration×progress) / sum(duration) | A | 분모0=null / assignedTaskProgress.taskIds |
| 계획 M/D | M/D / Project+Assignment | clipped Resource 근무일×allocation/100 / 없음 | A | unset/partial 아래 계약 / effort.assignmentIds·unsetAssignmentIds |
| 계획 M/M | M/M / Project+Assignment | 같은 raw M/D / 유효 양수 mdPerMm | A | 기준 미설정=null / effort.assignmentIds |
| 완전 미할당 | Task / distinct Task | 완전 미할당 수 / T0 Task 수(진단 기준) | T0 | 빈0 / diagnostics.completelyUnassigned.taskIds |
| Group만 지정 | Task / distinct Task | Group만 지정 수 / T0 Task 수(진단 기준) | T0 | 빈0 / diagnostics.groupOnly.taskIds |
| 개인 미배정 | Task / distinct Task | 위 두 집합 합집합 수 / T0 Task 수(진단 기준) | T0 | 빈0 / diagnostics.personallyUnassigned.taskIds |
| 공수 미설정 Task | Task / distinct Task | allocation=null인 개인 Assignment가 있는 Task 수 / T0 Task 수(진단 기준) | T0 | 빈0 / diagnostics.unsetTasks.taskIds |
| 공수 미설정 Assignment | Assignment / Project+Assignment | T0의 allocation=null 개인 Assignment 수 / 없음 | T0 | 빈0 / diagnostics.unsetAssignmentIds |
| Milestone 전체 진척/Ready/Blocked | Milestone / full stage | full canonical E(M)/P(M), 진척은 full duration 가중 / full E(M) duration | full snapshot | 수동 이벤트 진척/Ready=null / fullMilestones.stageGate |

Task 완료 판정은 canonical status이며 표시 반올림 100%가 완료를 만들지 않는다. 할당 작업 진척은 개인의 실제 기여도/생산성이 아니다. 지연 helper `isResourceKpiTaskDelayed`는 기존 #414/Logistics와 같은 date-only 정의를 사용한다.

## Calendar·공수·null·정밀도

기본은 저장 canonical Task 일정이며 Assignment 날짜 생략은 Task start/end 상속이다. Assignment 기간은 Task 일정 안에 있어야 한다. 조회 기간과의 inclusive 교집합에서 `resolveResourceCalendar` 및 `workingDaysBetween`을 재사용한다. Project < 모든 유효 Group < Resource 예외 우선순위를 유지하고 선택 Group 필터로 Calendar 소속을 잘라내지 않는다. Resource WORKING은 Project 비근무일을 덮어쓸 수 있으며 Task Calendar와 단순 AND하지 않는다. 같은 Group 계층 충돌은 Resource override로 숨기지 않고 기존 resolver대로 거부한다.

allocation은 canonical 저장 계약처럼 null 또는 0 초과100 이하의 유한 값이다. allocation0을 새 저장 값으로 허용하지 않는다. 유효0공수는 설정된 Assignment 기간에 Resource 근무일이0인 경우다. 진척/완료 변경은 계획 공수를 차감하지 않는다. 실제공수·소진공수·계획×미완료율 잔여공수는 제공하지 않는다.

| 대상 | knownMd | plannedMd | state | partial / unsetCount |
| --- | --- | --- | --- | --- |
| 0건 | 0 | 0 | empty | false / 0 |
| 모두 미설정 | 0 | null | unset | true / 대상 Assignment 수 |
| 일부 미설정 | 알려진 raw 합 | 알려진 raw 합 | partial | true / 미설정 수 |
| 설정된0공수 | 0 | 0 | configured | false / 0 |

`plannedMm`은 nullable plannedMd와 유효 기준이 모두 있는 경우에만 같은 raw 값에서 환산한다. 명시 양수 query → 유효 ENV 문자열 → null이며 ENV는 호출자가 주입한다. programmatic null은 ENV를 무시하고 source=query다. Domain의 invalid query는 오류이며 HTTP parsing/400 mapping은 후속 adapter가 담당한다. invalid/빈 ENV는 null/source=unset, omitted query 여부는 mdPerMmProvided다. 숨은20일/21일 fallback은 없다. pure helper는 `src/domain/resources/md-per-mm.ts`이며 기존 server 경로는 re-export shim으로 #463의 반환 정책을 보존한다.

raw 합산·환산에는 반올림하지 않는다. 각 Resource/Group의 모든 Milestone+미지정 bucket knownMd 합이 해당 subtotal과 부동소수 정밀도 안에서 일치한다. 표시 경계만 round한다. 기존 Resource workload는 기존 per-assignment·subtotal 4자리 반올림 및 legacy unset 응답을 유지한다. 신규 all-unset=null 의미를 legacy 응답에 조용히 적용하지 않는다.

## full Milestone 상태

`fullMilestones`는 필터 이전 전체 snapshot의 `projectStageGates` 결과다. 선택한 Resource/Group 안의 진척은 선택 Task만 계산하되 full E(M) 작업의 미완료와 full P(M) 선행 차단은 유지한다. 날짜순이나 Task 간 Dependency를 Milestone Dependency로 추론하지 않는다. 조회는 원본 소속·status·Link·일정을 변경하지 않는다.

## 표준 fixture와 검증

`tests/fixtures/resource-kpi.ts`는 Project 휴일10-06, T1 10-05..09(duration4), T2 10-05..16(duration9), T5 10-09..12(duration2)와 T5 Assignment10-10..11의 정상 canonical 기간을 사용한다. 기준일10-17, 조회10-05..18이다. R1은 G1/G2 및 PI/DEVELOPER 복수 분류, R2는 G1/EQUIPMENT_OWNER다. T1의50%·33.333333% 개인 Assignment는 Task1/Resource2/Assignment2와 raw2+1.3333333200000002 M/D를 만든다. T2는 미설정2Assignment/1Task, T3는 완전 미할당, T4는 Group만 지정, T5는 비근무일 부분기간으로 설정된0공수다. Summary/Milestone 직접 개인 참조는 별도로 보존한다. Milestone 일정은 한 날짜이며 빈 Summary, nested override, clear와 미지정도 검증한다.

Domain 테스트는 순열/중복입력/교집합/원시합/M/M/null/분모0/전체 Ready를 검증한다. `tests/server/resources/resource-kpi-compatibility.test.ts`는 실제 in-memory native SQLite와 기존 Workload Service를 통해 raw1.3333333200000002와 legacy1.3333 M/D,19기준 legacy0.0702 M/M를 구별한다. 기존 Workload/Stage/Logistics fixture 회귀도 함께 실행한다. HTTP/API/DB/DESIGN/AGENTS 변경은 없다. 별도 공개 DTO의 범위·revision·bounded drill-down과 성능 한도는 #524가 담당한다.
