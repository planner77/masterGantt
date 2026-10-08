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

## Issue #524 서버 Report PLAN과 공개 계약

공개 조회는 `GET /api/projects/{publicId}/resource-dashboard`, bounded 상세는 같은 경로의 `/details`다. schema는 `resource-dashboard/1`이며 compact summary/Resource·Group·Role 행/Milestone cell에 전체 ID를 반복하지 않고 selector를 제공한다. 상세 요청은 report의 정규화 필터와 snapshotId를 다시 보내 같은 read snapshot identity를 확인한다. mode=resource|group은 projection 선택이며 Grand Total/snapshotId를 바꾸지 않는다.

Query 배열은 resourceIds/groupIds/roles/developerGrades/milestoneIds/taskIds/wbsRootIds/statuses다. 같은 축 OR/다른 축 AND이며 groupIds=ungrouped, milestoneIds=unassigned는 null bucket이다. exact duplicate array token은 unique/sort하지만 raw token 개수도 한도에 포함한다. 반복 scalar, unknown key, 빈·잘못된 값은400 INVALID_REQUEST다. UUID 형식은 canonical UUIDv4, 다른 Project Task/Milestone 또는 존재하지 않는·Project에 연결되지 않은 Resource/Group 선택은400 INVALID_SELECTION이다. 이 거부 정책은 기존 Stage API의 unknown-ID200empty와 별개다.

search(200자)는 A에서 Resource 이름/code, 그 Resource의 Project 연결 Group 이름/code 또는 같은 Assignment의 Task 이름/externalId/WBS 이름 경로에 일치한다. 개인 조건이므로 T0에 적용하지 않는다. taskSearch(200자)는 Task 이름/externalId/WBS 경로만 검색하며 T0와 A 모두 적용한다. statuses는 canonical Task status 조건이다. 개인 검색 결과와 T0 진단이 같은 분모가 아님을 metadata로 제공한다. from/to/asOfDate는 date-only다. 기본 범위는 일반 Task의 canonical 유효 endpoints이며 날짜 없는 빈 Project fallback은 현재 기준일이고 rangeFallback=true로 표시한다. mdPerMm은 #523 omission/null/양수 계약을 유지한다.

Project/Catalog revision 및 관련 Calendar fingerprint(calendarRevision), calculatedAt, timezone/asOfDate, normalized filters, resolved range, mdPerMm/source, snapshotId를 반환한다. snapshotId는 Project 원시 Task/Link/Membership/Assignment, Project에 연결된 Resource/Group의 상태, Calendar 규칙/날짜, filter/유효날짜/환산기준에 묶인 SHA256이며 calculatedAt/mode는 포함하지 않는다. 상세 조회는 clock1회와 현재 read snapshot을 재계산해 동일 snapshotId가 아니면409 REPORT_STALE로 재조회 안내한다. 후속 export도 이 서비스의 same-snapshot identity를 재사용해야 하며 #524에 새 export 경로는 추가하지 않는다.

유한 상한은 아래 표를 따른다. `RESOURCE_DASHBOARD_LIMITS`가 실행 값의 기준이다. 한도 초과는422 REPORT_LIMIT_EXCEEDED이며 임의 절삭 없이 범위 축소 안내를 반환한다. full snapshot 상한은 필터로 우회하지 않는다. detail pagination은 전체 KPI를 다시 정의하지 않는다. 모든 Calendar 규칙/날짜는 조회당 bulk load하며 Resource별 계산을 Domain 내부에서 재사용한다.


| 제한 필드 | 상한 | 검사 대상 / 축소 방법 |
| --- | --- | --- |
| tasks | 5000 | 전체 Project snapshot / Project 분리 |
| assignments | 8000 | 전체 Project snapshot / Assignment 정리·Project 분리 |
| links | 20000 | 전체 Project snapshot / Link 정리·Project 분리 |
| calendarRules / calendarDates | 각각20000 | 전체 Project Calendar / 규칙 정리 |
| catalogMemberships | 16000 | Project 연결 개인의 Group 소속 관계 / 소속 정리 |
| rangeDays | 366 | inclusive 조회 기간 / 기간 축소 |
| idsPerField / totalIds | 200 / 400 | 배열축 raw token / 선택 축소·중복 제거 |
| groupsPerResource | 32 | 개인의 전체 연결 Group 수 / 소속 정리 |
| groupAssignmentRows | 16000 | 전체 candidate 일반 개인 Assignment의 Group 반복(미소속1) / 소속·Project 정리 |
| cells | 5000 | Resource·Group×Milestone 내부 미지정 bucket + 전체 Milestone bucket + Role subtotal / 개인·Group·Milestone 선택 축소 |
| wbsPathEntries | 50000 | 전체 WBS 경로 Task node 누적 / 계층 정리·Project 분리 |
| wbsPathChars | 20000 | 한 WBS 경로의 이름 문자 합 / 이름·계층 축소 |
| reportBytes | 2097152 | report/detail JSON 각각2MiB / report 선택 축소 또는 detail page 축소 |
| detailPage / detailOffset | 100 / 8000 | default page50 / 작은 page·유효 offset 선택 |

Calendar count와 Task/Assignment/Link/소속 예산은 원시 목록 load 전에 검사한다. `maxProjectionCells`는 공통 Domain에서 A가 확정된 뒤 subtotal/cell materialization 전에 검사하고 서버는 실제 산출 폭도 재확인한다. 전체 snapshot 상한과 projection/기간/page 상한은 공개 오류의 details.path로 구분하며 해당 축소 방법을 안내한다. 임의 절삭 없이 실패하고 완전한 합계라고 표시하지 않는다.

`resourceActivity`와 `groupActivity`는 all|active|inactive, 기본all이다. 개인 활성 상태는 그 Resource, 그룹 활성 소속은 그 Resource의 실제 Project 연결 Group 관계로 판정한다. Group ID와 그룹 활성 소속을 함께 선택하면 같은 Group membership에서 일치해야 한다. 그룹 미소속은 groupActivity=all에서만 통과한다. 두 필터는 A-only이며 T0/full-stage/Calendar의 전체 소속을 바꾸지 않는다. 후보 목록과 기본all은 비활성 기존 참조를 보존한다. eligibility가 명시된 빈 집합이면 개인 대상 없음이며 생략과 구분한다.

`ResourceDashboardRow.assignmentRange`는 그 행의 A에서 clipped 유효 Assignment from 최소/to 최대이며 빈 범위는null이다. 행 기간은 canonical Task 일정과 다르다. 상세에는 canonical taskStart/taskEnd와 raw assignmentStart/assignmentEnd, 조회로 clipped from/to를 별도 제공한다. WBS path는 Project 안의 이름/public ID, Milestone은 explicit/effective/inheritedFrom public ID를 반환한다. catalog에는 해당 Project Task에 실제 개인 참조가 있는 Resource 및 직접 Group 참조/그 Resource의 Group만 있고 글로벌 미배정 인력·Group 전체 구성원·description은 제공하지 않는다.

상세 selector의 dimension은 all/resource/group/role/milestone/diagnostic이고 id는 public ID 또는null이다. null Group은 HTTP id=ungrouped, null Milestone은 id=unassigned로 보낸다. optional milestoneTaskId=null은 HTTP milestoneTaskId=unassigned이며 생략은 모든 Milestone이다. metric은 all/notStarted/inProgress/completed/delayed/unset와 diagnostic용 completelyUnassigned/groupOnly/personallyUnassigned다. Task KPI 클릭은 view=tasks로 고유 Task, Assignment KPI/공수 미설정 Assignment 클릭은 view=assignments로 해당 원시 Assignment를 본다. T0 진단은 dimension=diagnostic/view=tasks이며 가짜 개인/공수 없이 assignment=null이다.

필터 echo의 mdPerMmProvided=false는 detail query에서 mdPerMm을 생략해야 한다. true/null은 문자열null을 보내 ENV를 무시한다. scope를 바꾸면 기존 snapshotId가 detail을 승인하지 않는다. 상세는 Task public ID→Assignment public ID 순으로 안정 정렬하며 offset/limit page에서 전체 totalCount와 nextOffset을 제공한다. report/cell에는 반복되는 전체 ID 목록이 없고 same-scope selector만 있다. Page 행을 합산해 KPI를 재정의하지 않는다. 새 조회는 같은 Project public-read guard, private/no-store 및 JSON nosniff를 적용하고 edit 쿠키를 발급하지 않는다.

실제 검증은 `tests/fixtures/resource-dashboard.ts`의 #523 fixture를 새 public UUID로 native SQLite에 적재한 HTTP/Service 테스트다. 다른 연결의 WAL 변경에도 기존 read transaction은 동일 snapshot을 유지하고 다음 상세는409 stale로 거부한다. raw 데이터가 revision bump 없이 바뀐 경우도 fingerprint가 Task/Link/Membership/Assignment/Calendar/개인·Group 상태를 결속한다. 재시작 동일 데이터는 동일 snapshotId이며 calculatedAt/mode만으로 identity를 바꾸지 않는다. Calendar helper는 조회당 고정 bulk read를 사용하고 Resource별 DB resolve를 반복하지 않는다.

넓은 기간 multi-group benchmark는 실제 SQLite Task1011/개인Assignment1005/Group8,365일(260Resource근무일) 입력으로 실행한다. 별도로 실제100개인×50Milestone의5000Assignment cell 폭발,320단계 WBS 경로, 과다 Group 소속/반복 예산을 거부하는 회귀를 포함한다. 시간·byte 측정은 로컬 실행 증거이며 원격 CI 성능 보장은 아니다. 검증 상태와 최초 실패 이력은 [TEST_PLAN](TEST_PLAN.md)의 #524 기록을 따른다.

## Issue #525 기본 Resource·Group Dashboard

기존 Project 리소스 탭의 기본 화면은 `ProjectResourceDashboard`를 통해 #524 `resource-dashboard`와 `/details`를 조회한다. 기본 모드는 그룹이며 그룹 → 개인 → Assignment Task 상세, 개인 모드는 개인 → Assignment Task 상세다. 모드와 M/D·M/M 전환은 표시만 바꾸며 조회 조건·Grand Total·저장 데이터를 바꾸지 않는다. 개발 견적은 Global Role=DEVELOPER의 서버 필터 preset이며 개인 모드로 표시한다. 기존 종류 all/resource/group의 담당 참조 의미는 legacy 단계 drill에만 유지하며 새 그룹/개인 모드와 같은 조건으로 해석하지 않는다.

기간·Milestone·검색은 기본 도구줄, Global Role·개발자 등급·작업 상태·개인 활성 상태·그룹 활성 소속·그룹/개인 선택·작업 검색은 고급 필터다. 한쪽 날짜는 입력 그대로 서버 조건으로 전송한다. 역순 날짜는 오류를 표시하고 조회를 막으며 이전 결과를 stale로 잠근다. 검색 및 activity/개인 필터는 A에만 적용하고, T0 진단은 개인 조건 적용 전 작업범위라고 표시한다. 개인 미배정/완전 미할당/Group만 지정은 실제 고유 Task 상세로 조회한다. Milestone 미지정과 미분류 Resource는 별도 선택이다.

선택 범위 KPI와 Group/Resource/Global Role 행은 서버 raw 값만 표시 경계에서 반올림한다. 화면 행을 재합산하지 않는다. Grand Total과 복수 분류의 비가산 소계를 구분하고, `unset`은 산정 불가, `partial`은 알려진 부분합, configured zero와 empty zero를 구분한다. `empty`(선택 범위 Assignment 0건)는 `할당 없음`으로 표시하고, 설정된 근무일 0 등의 `configured` 실제 0공수만 `0.00 M/D`/`0.00 M/M`으로 표시한다. Global Role 집계 행 자체가 없을 때에도 가짜 확정 0공수를 대신하지 않는다. 환산 기준값과 query/환경 출처를 표시하며 미설정이면 M/M 전환을 비활성화하고 이유를 보인다. 계획 공수는 실제 기여도나 소진 공수로 표현하지 않는다.

할당 Task/완료/지연 KPI 상세는 view=tasks의 고유 Task 표다. 공수 미설정과 개인 행 상세는 view=assignments다. Task 표의 assignment:null은 정상이다. 작업명/UUID/externalId/WBS/현재 상태·진척/작업 일정/effective Milestone을 표시하고, Assignment 표에는 저장 override/상속, 선택 기간으로 자른 투입 구간·근무일·투입률·공수를 추가한다. 표 행의 투입 시작/종료도 선택 기간으로 자른 구간이다.

조회는 schema/publicId/전체 normalized filter echo/기간/Project revision/양수 환산기준/source/scope.identity=snapshotId를 검증한다. 상세는 같은 필터·snapshot·selector/view/page와 Project/Catalog/Calendar revision을 검증한다. 늦은 응답은 abort/generation guard로 버리고 hidden tab에서는 조회·polling하지 않는다. 활성화·focus·visibility 복귀와 canonical revision 변경에 최신 조회를 수행한다. 이전 성공 결과를 유지할 때 stale와 이전 기간·검색을 표시하고 상세/페이지 이동을 잠근다. 오류 후 필터·단위·같은 snapshot의 열린 행을 보존한다.

409 상세 stale는 명시 새로고침 후 사용자가 상세를 다시 열어야 한다. 삭제/해제된 선택400은 조건을 유지하며 해제/초기화를 안내하고422는 한도 및 범위 축소를 안내한다. Project revision이 달라져 report만으로 복구할 수 없으면 `최신 일정 조회`가 기존 Workspace canonical 조회를 실행한다. pending/열린 편집기 상태에는 이 동작을 잠그고 초안을 자동 폐기하지 않는다. snapshot/query 교체 시 기존 selector를 새 범위로 자동 적용하지 않으며, 사라진 상세에 초점이 있었을 때만 원래 trigger 또는 검색 입력으로 복원한다. stale로 trigger가 disabled이면 검색으로 복원한다.

기존 MilestoneResourceDrill의 exact assignmentIds 표시 경로는 `LegacyProjectResourceWorkload`에 그대로 유지한다. 기본 Dashboard를 hidden/inert로 mount 보존하고 drill 중 active=false로 만들어 이전 기본 조건·단위·모드가 복귀 시 유지된다. legacy HTTP/4자리 계산 의미와 상위 Workspace/Gantt 구조는 변경하지 않는다. #528 이전에 새 외부 navigation을 노출하지 않는다.

SVAR Core2.7.3의 기존 Gantt 인스턴스를 재사용하고 앱 소유 HTML 표를 사용한다. 공식 Base/Grouping/Resource Load 문서는 2026-10-07 Issue 등록 시 확인했으며 PRO API를 호출하지 않는다. 공식 demo 실제 interaction은 NOT TESTED다. 요약 표1120px(280+64×4+88+112×2+144+128), Assignment 표1360px(320+112+80+208×2+88+144+200), 고유 Task 표920px(320+112+80+208+200)를 내부 scroll owner에 둔다. 열 예산은 해당 표의 직접 thead에만 적용해 중첩 표에 상위 너비가 전파되지 않는다. 날짜 토큰은 줄 중간에서 자르지 않는다.


### Issue #525 긴 이름·다중 행 인수 보완

2026-10-08 독립 QA에서 기존 짧은 Dashboard fixture만으로 긴 이름·많은 행을 검증하지 못한 점을 발견하여, 제품 코드를 변경하지 않고 별도 `longResourceDashboardUiFixture`를 추가했다. 합성 입력은 Group12개·Resource40명·공동 Task120개·Assignment4800개이며 이름200자/코드64자/외부 ID128자 및 WBS 각 구간200자 상한 안의 긴 한국어·영문을 사용한다. 최대3개 Global Role(PI/DEVELOPER/EQUIPMENT_OWNER)과 Role 미지정 각각1행, 복수 Role39행 및 비활성 개인·Group을 포함한다.

`project-resource-workload-status.spec.ts`의 긴 이름·다중 행 geometry1개를 실제 Chromium에서 실행했다(1 PASS,9.6초). 그룹/개인 각각390/768/1024/1440/1920px의 총10개 관측에서 그룹12행/개인40행/Assignment 상세50행(전체120행, 다음 페이지50)을 실제 Dashboard DOM으로 측정한다. 조건은 개인 활성 상태/그룹 활성 소속 전체이며 normalized filter와 mode를 geometry JSON에 기록한다. 모든 populated 행의 header/body 정렬·cell 비중첩·control containment, toolbar 비중첩·화면 내 containment, 날짜 열208px 이상/날짜 토큰 비분리, 소유 table 내부 가로·세로 overflow, document 폭=viewport, native Tab focus ring의 cell/scroll owner/viewport containment를 통과했다. 안정 UUID Task50개·상세 WBS 최대375자·화면 identity 최대233자를 확인했으며 Gantt fixture로 대체하지 않았다.

기존 짧은5폭 PASS와 초기 실패 artifact는 보존한다. 새 근거는 로컬 `output/playwright/issue-525/long-many/geometry.json`과 mode별5폭 PNG 및 `run-long-many-final-frozen.log`다. PR PNG390/1440은 새 긴 그룹 기본화면과 일치하며 이전 짧은 PNG는 로컬 `short-before-rework/`에 보존한다. 합성 geometry는 별도 실제 SQLite/HTTP 회귀를 대체하지 않는다. 기존 고유 Chromium10개 PASS에 신규1개를 더한 고유11개이며 반복 geometry 실행을 추가 테스트로 세지 않는다. Unit은 긴 fixture 계약 검증1개를 추가해 관련2파일10개다. 원격 quality/e2e/docker·최종 독립 QA 및 실제 환경 검증은 별도 NOT TESTED다.


## Issue #526 서버 Milestone roll-up 계약

기존 schema `resource-dashboard/1`과 report/detail 진입점을 유지하며 같은 SQLite read transaction을 prepareSnapshot → pure Assignment 선택/합계 → 필요한 DTO 렌더링으로 분리한다. Project read부터 clock1회를 고정하고 full Membership/Stage projector와 Resource의 전체 Group Calendar를 공유한다. 개인 Calendar와 clipped Assignment 공수 행은 snapshot 내에서 재사용하며 reference 계산을 위해 전체 비교표를 다시 생성하지 않는다. prepared 입력과 캐시는 요청 동안만 사용하고 새 원장·DB write·지속 report cache를 만들지 않는다.

report의 optional 타입 필드 `reference`, `excluded`, `milestoneSelection`은 신규 서버 응답에 항상 존재한다. selected는 기존 summary의 A, reference는 같은 모든 조건 중 Milestone 조건만 제거한 A, excluded는 reference의 실제 Assignment ID 집합에서 selected ID를 제거한 집합이다. 각각 동일 pure totals helper로 distinct Task/Resource/Assignment·진척·raw M/D/M/M·null/partial을 계산한다. Resource 수/진척/비율을 reference-selected 숫자로 차감하지 않는다. Milestone 제한이 없으면 reference=selected이고 excluded는 empty다. 두 summary는 totals-only이며 reference의 미선택 Milestone Resource/Group cells를 생성하지 않는다. `milestoneSelection.applied`와 두 집합 설명을 함께 제공한다.

selector의 `assignmentScope`는 selected(기본), milestoneReference, milestoneExcluded다. 기본 범위를 생략한 기존 요청도 selected로 정규화해 echo한다. reference/excluded summary의 selector로 같은 snapshot 상세를 조회한다. diagnostic은 selected scope만 허용하며 T0/full-stage 계약을 바꾸지 않는다. `resourceId`는 optional public UUID 문자열이고 dimension=group에서만 허용한다. null은 허용하지 않고 제한 없음은 생략한다. Group Resource 상세는 Group∩Resource∩선택 scope이며 기존 Resource 전체 selector로 바꾸지 않는다.

`GET /api/projects/{publicId}/resource-dashboard/group-children`은 기존 report filters와 필수 snapshotId/groupId, optional milestoneTaskId, offset/limit를 받는다. groupId=null은 HTTP `ungrouped`, milestoneTaskId=null은 `unassigned`로 전송하며 Milestone 생략은 모든 선택 단계다. metric/resourceId/assignmentScope query는 이 경로에서 허용하지 않는다. Group→Resource→Milestone은 Milestone 생략, Group→Milestone→Resource는 해당 Milestone 지정으로 조회한다. metric 전환은 서버 summary를 표시할 뿐 자식 요청의 집합을 바꾸지 않는다.

응답은 schema/snapshotId/projectPublicId/Project·Catalog·Calendar revision, 정규화 filters, resolved range/asOfDate/mdPerMm/source, groupId/optional milestoneTaskId와 서버 summary/Resource rows를 반환한다. 각 행의 summary/assignmentRange/milestones는 Group 교집합의 A다. summary selector와 모든 cell selector에 groupId/resourceId를 보존한다. Resource는 public ID 순으로 페이지하고 offset/default50/max100/상한8000, totalCount/nextOffset을 echo한다. optional Milestone의 생략과 명시null은 구별한다. 페이지는 전체 그룹 summary를 바꾸지 않고 frontend는 받은 페이지 행으로 그룹 합계를 다시 계산하지 않는다.

Resource 선택은 Project 연결과 해당 Group의 실제 소속을 검증한다. 유효 구성원이 현재 조건에서 제외되면 정상200/0건이다. 미연결 Resource, 다른 Group 구성원, 잘못된 selector는400이고 snapshot 변경은409 REPORT_STALE다. 미분류 Group은 실제 Group 미소속 개인만 통과한다. 글로벌 미배정 구성원은 공개하지 않는다. 신규 route도 public-read·private/no-store·nosniff이며 Cookie/Origin/session mutation 계약을 변경하지 않는다.

Milestone 정렬은 canonical 예정일→안정 public ID이며 날짜 없는 경우 뒤로, 미지정은 마지막이다. report stages와 catalog Milestone 후보, 전체/Resource/Group cells 및 children cells에 같은 순서를 적용한다. full stages는 필터 이전 전체 상태이고 selected cells는 선택 집합이다. sparse cell 생략은 대상 없음이며 화면에서 유효0으로 위장하거나 추가 Assignment를 만들지 않는다.

기존 full snapshot 및 selected cells5000 예산을 유지한다. reference/excluded는 전체 Assignment8000 상한 안에서 totals-only다. children page의 실제 Resource×Milestone bucket(미지정 포함)을 materialization 전에 cells5000으로 검사하고 응답2MiB를 적용한다. 초과 시422 REPORT_LIMIT_EXCEEDED이며 절삭 합계를 반환하지 않는다. 화면 tree/matrix 페이지·열 창은 표시 범위만 줄이고 서버 raw 계산 범위는 유지한다. 후속 capacity는 같은 prepared 입력/Calendar/검증된 개인 Assignment grain을 재사용할 수 있으며 본 단위에 capacity 계산은 추가하지 않는다.

### Issue #526 Milestone 계층과 비교표 UI

기존 리소스 탭에서 기본 현황/Milestone 계층/비교표를 선택한다. Group→Milestone→Resource→Task, Group→Resource→Milestone→Task, Resource→Milestone→Task는 서버 selector의 교차 범위로 조회하며 WBS를 변경하지 않는다. Group children는 동일 snapshot·filter·Calendar/Catalog revision을 검증하고 페이지당50개 개인을 조회한다. Task 상세는 고유 Task, 공수 상세는 Assignment 행이다.

비교표는 Group 또는 Resource를50행씩, canonical 예정일·동률 stable ID로 정렬한 Milestone을6열씩 표시하며 미지정은 마지막, 전체는 별도 열이다. 전체값은 서버 summary로 유지하고 표시 행/열을 합산하지 않는다. 계획 공수/Task/완료율/지연을 한 지표씩 표시한다. 누락된 교차 셀은 대상 없음으로 비활성, 유효0은0으로 표시하고 미설정·부분합·M/M 기준 부재를 구별한다. Row/Milestone fullname은 accessible name과 title로 보존하면서 시각 이름은2줄로 제한한다. Identity264px/Milestone144px 최소폭과 표 내부 scroll을 사용한다.

Milestone 조건이 없으면 기준=선택·제외0을 한 줄로 표시한다. 조건이 있으면 선택/reference/excluded raw 서버값을 평이한 집계 줄로 표시하며 각각 실제 Assignment 집합에 연결된 상세를 연다. 선택 할당 작업 진척과 단계 전체 member/Ready/Blocked는 별도 라벨이다. 단계 완료 mutation은 제공하지 않는다.

펼침 의도·nested pager는 안정 ID tuple로 보존하며 실제 mount되는 펼침은 provider admission으로 최대12개다. 페이지 밖 상태를 지우지 않고 상위부터 허용하여 ancestor 재펼침·페이지 복귀 시12개를 넘기지 않는다. 동일 query에서 mode/order 변경은 상태를 유지하고 snapshot/filter 변경은 새 상태다. canceled/이전 child409는 현재 report를 stale로 만들지 않는다. stale 클릭을 잠그고 실패를 이전 정상 결과로 위장하지 않는다. 상세 Escape는 유효한 visible trigger로 복원하고 숨김/inert/disabled/unmounted trigger는 검색으로 복원한다.

2026-10-08 공식 [SVAR Group tasks](https://docs.svar.dev/react/gantt/guides/data-operations/grouping-tasks/) 문서를 확인했다. 해당 grouping은 PRO 기능이며 설치 Core2.7.3의 API로 가정하지 않는다. 앱 서버 projection을 표/계층으로 표시하며 Gantt 자체의 tree/grouping을 재구성하지 않는다. 공식 demo JavaScript 직접 조작은 NOT TESTED다.
