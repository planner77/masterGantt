## Issue #785 — 공개 실물 출처와 내부 legacy 해석

WBS ledger의 동일 Task/Assignment 원장·F3 whole/subset/coverage·다중 조상 상속·공유 실물 dedup은 그대로다. 기존 내부 graph를 직접 행으로 평탄화하지 않는다. 공개 v2는 실물 ID·source Task·opaque 관계 참조로 제공하고 Target 엔터티 ID/이름·카탈로그·진단을 노출하지 않는다. 내부 golden test와 명시 deprecated v1은 이전 의미를 감사한다. T0/A/R·non-additive 소계·full Gate·same-Task 교집합·W2 명시0/null을 유지한다. [변환 설계/예외](exec-plans/active/ISSUE_785.md), [공개 버전](API.md).

## Issue #735 — 시스템 직접·조율 selector의 공개 소비

시스템 전용 consumer의 `systemView`는 기존 `system` 또는 `systemCoordination` 선택을 공통 WBS report/details/scope에 일관되게 적용한다. mode와 시스템 ID 선택은 spec/snapshot에 결속하며 하위 경로는 동일 Task/Assignment를 계속 교차한다. 조회 모드가 Task 공정·controls·coordinates·개인배정을 생성하지 않는다. 기존 명시 coordinates/controls 검증과 cyclic/foreign 거부를 재사용하며 화면별 계산기를 추가하지 않는다. [API](API.md#issue-735--시스템-root의-직접조율-선택) 및 [검증 원장](exec-plans/active/ISSUE_735.md)을 따른다.

## Issue #733 — 공정 관점의 구성-only 경로

공정 관점은 기존 원장의 고유 Task/Assignment 교집합과 구성 참고를 재사용한다. 등록 공정/구역·설비/System의 작업0 하위 후보는 실제 소속에 근거해 표시하며 개인 Assignment·Task·제어관계를 만들지 않는다. 공정 단독의 catalog 수와 작업 필터의 일반 Task 수는 다른 모집단이다. 공정 관련 설비는 주관리 공정과 명시 WorkArea 소유 공정의 합집합이며 exact WorkArea 경로는 그 소속을 교차한다. 주관리 A의 E10이 B구역에 연결되면 A/B 관련 소계는 각각10, Project 고유 수량은10이다. 구역의 관련 설비 수량은 명시 다중 소속을 반영하되 상위는 원본 ID 합집합이다. 같은 System/Milestone의 다음 단계에서 다른 Task를 다시 가져오지 않는다. [API](API.md), [수치·출처](LOGISTICS_DASHBOARD.md#issue-733--공정workarea-전용-관점), [검증](exec-plans/active/ISSUE_733.md)을 따른다.

공정/occurrence 아래 구성의 구역 없음은 해당 공정 범위에 연결 구역이 없다는 조회 상태이며 타 공정 구역 소속은 유지한다. root WorkArea 없음은 전체 구역 소속0이고, Task의 명시 WorkArea selector 의미는 변경하지 않는다.

## Issue #731 — KPI consumer의 지표 인계

전용 KPI API는 공통 resolver와 #729 snapshot 읽기를 재사용하고 기존 Logistics KPI의 기간가중 진척·지연·임박·계획 공수 계산 authority를 유지한다. 공통 원장/계산기 자체는 변경하지 않는다. 화면은 `source=integrated`를 명시하며 구 API default는 그대로다. 명시 공정 축의 원시 Task/Assignment 범위와 구 구성 유도 공정의 범위가 다르면 수치 동일성을 주장하지 않는다.

| KPI/진단 | 원본·분모·중복 제거·미산정 |
| --- | --- |
| 통합 KPI 호환 envelope | 기존 numeric `effort.plannedMd`는 유지하고 additive `effortState`로 all-unset 미산정·partial 알려진 합계·설정0·empty를 구별. 구 API default 불변 |
| 핵심 진척·지연·공수 | 기존 일반 Task duration/progress/end·고유 개인 Assignment의 Calendar/투입률. 기간분모0=null, null 투입률을100%로 간주하지 않음 |
| 등록 구성 | 전체 Project 등록 공정/WorkArea/typed 설비/System/Resource master ID. 설비 수량은 고유 equipmentId의 원본 quantity 합 |
| 관련 작업0 대상 | 전체 일반 Task의 유효 대상·명시 공정/구역과 교차한 master 목록. Milestone만 연결되어도 일반 작업0일 수 있음 |
| 미연결 일반 Task | 일반 Task 중 유효 설비/System이 모두 없는 정확 Task ID; 기존 leaf(Task+Milestone) 진단과 분모 별도 |
| 개인 미배정·Group-only | 전체 일반 Task의 원시 개인 Assignment 유무; 역할·등록·Group 배정만으로 개인 공수를 생성하지 않음 |
| 공수 미설정 | 일반 Task 개인 Assignment의 allocationPercent=null인 정확 Assignment/Task ID. 설정된0과 구별 |
| Owner/PI/주제어 | 기존 active master·active 역할 Resource·실제 controls 정책의 정확 master ID 목록 |
| WorkArea 관련 수량 | 해당 구성 membership의 고유 equipmentId quantity; W-A/W-B에 E10이 각각10으로 보여도 상위는10, 작업 수행/공수의 증거 아님 |
| full Milestone Gate | 기존 전체 canonical effective membership·직접 선행. 선택 Task 범위로 Ready를 축소하지 않음 |

관련 작업5 M/D가 두 공정에 보여도 Project는5다. Target-only 보완 때 추가된 원시 Task/대상·provenance와 source/version을 확인한다. 각 진단 exact ID·범위와 snapshot은 [KPI 계약](LOGISTICS_DASHBOARD.md#issue-731--기존-kpi와-통합-출처), 테스트/실행 상태는 [Work Packet](exec-plans/active/ISSUE_731.md)을 따른다.

# WBS 작업 중심 공통 해석·KPI 계약 — Issue #728

## 범위와 결정

WBS 일반 Task가 중심 원장이다. 공정·WorkArea·설비·물류 시스템·Milestone·Resource는 같은 Task/Assignment를 조회하는 관점이며 조회 계층이 저장 계층을 만들지 않는다. 이 문서의 pure Domain 계약은 #729의 versioned snapshot/API와 #730 이후 화면이 소비할 입력이다. 이 변경만으로 새 HTTP 응답·화면·DB writer가 제공되지는 않는다.

[#728 결정 댓글](https://github.com/planner77/masterGantt/issues/728#issuecomment-6245431055)이 최초 본문의 OPEN_DECISION보다 우선한다. W1은 다른 공정의 WorkArea0..N을 한 설비에 연결할 수 있다는 결정이다. WorkArea 자체는 정확한 한 소유 공정에 속한다. W2는 Task 관련 공정0..N을 명시 선택하며 설비/System/WorkArea 구성에서 작업 공정을 자동 유도하지 않는다는 결정이다.

## 입력과 호환 경계

한 Project의 완전한 canonical Task·Assignment·Resource/Group/Role·Calendar·Milestone membership/link와 물류 Target/member/binding/instance·공정 snapshot을 기존 `ResourceKpiInput`으로 받는다. #725의 `TaskProcessContextDto`·`EquipmentWorkAreaDto`, #727의 `ProjectResourceMembershipDto`를 재사용한다. 조회 실패·누락 컬렉션을 빈 성공으로 바꾸지 않는다. 호출 adapter는 같은 read transaction의 Project/catalog/문맥 revision을 결속하고 전체 목록을 공급해야 한다. 페이지 일부를 전체 기준정보로 전달해서는 안 된다.

명시 Task 문맥의 local `processId`와 catalog `occurrenceId`, Target의 공정 provenance를 구분한다. 신규 명시 공정 선택이 빈 배열이면 정상 미연결이다. 구형 null은 미도입 상태이며 진단으로 보존한다. 신규 WBS 공정 기준은 Task 자신의 명시 공정 선택을 사용하므로 조상 Summary나 Target·설비·System으로 빈 배열을 채우지 않는다. 기존 Target 공정 해석은 별도 opt-in 호환 기준에서만 사용하며 기존 API/계산기 자체는 변경하지 않는다.

설비/System의 Task 연결에는 기존 직접 연결·조상 Summary subtree·Target whole/subset의 합집합을 사용한다. Summary self는 자손에 전파하지 않는다. 기존 Target resolver의 typed `(kind, entityId)`·binding/member·coverage provenance를 보존하고 ACS-only subset을 AMR로 확대하거나 공유 MCS에서 다른 Target을 역추론하지 않는다. 직접 공정 선택의 새 의미를 모든 기존 분야의 상속 override로 일반화하지 않는다.

## Domain 호출 계약

`resolveWbsTaskLedger`가 검증·정규화한 snapshot을 `selectWbsTaskLedger`의 단계별 selector, `summarizeWbsTaskLedger`의 원시 합집합, `projectWbsTaskLedger`의 순서별 projection이 공유한다. `calculateWbsTaskLedgerKpi`는 이 경계를 묶는 opt-in 호출이며 `selectWbsTaskLedgerPlanScope`는 기존 Resource Plan에 선택/전체 배정과 R을 인계한다. `WBS_TASK_LEDGER_KPI_DICTIONARY`는 실행 가능한 지표 정의다. `summarizeWbsTaskLedgerConfiguration`의 `configurationReference`는 Task 개인배정 모집단과 분리된 기준정보 고유 합집합이다. 사용/미적용 구성 selector를 함께 반환하여 Milestone/WBS/개인 조건을 구성 수량에 적용한 것처럼 표시하지 않는다.

입력 version은 `wbs-task-ledger:v1`, 문맥 기준은 `explicit-task-context:v1` 또는 opt-in `legacy-target-context:v0`다. `snapshotProjectPublicId`는 KPI의 Project ID와 일치해야 한다. 컬렉션은 #725/#727 DTO 그대로 전달하며 장비/System의 명시 제어·조율·책임 역할 metadata도 제공한다. 선택적 `processActivity`/`workAreaActivity`는 비활성 기존 참조 진단을 보강하며 미제공은 `metadata.activitySource=not-supplied`로 구분한다. 빈 성공과 미조회 상태를 같은 의미로 표시하지 않는다. `participation.registeredCount`는 프로젝트 전체 명시 등록 인원이고 `assignedCount`는 현재 선택 A의 배정 인원이다. 프로젝트 전체 일반 Task의 배정 인원은 별도 `projectAssignedCount`로 제공한다. 서로 다른 모집단을 합산하거나 선택 배정 수를 전사/프로젝트 전체라고 표시하지 않는다.

조회 경계는 `kpi.resources`의 고유 Resource ID와 `resourceMemberships`의 ID가 정확히 일치해야 한다. 일부 페이지만 들어오면 `RESOURCE_MEMBERSHIP_SNAPSHOT_INCOMPLETE`로 실패하며 등록 인원·구성 출처를 과소 계산하지 않는다. 미지정 Global Role의 Assignment는 기존 Resource KPI가 `UNSPECIFIED`로 표시하지만 신규 WBS `role: null`(미분류)과 `role: "UNSPECIFIED"`(명시 코드) 선택 모두에서 확인할 수 있다. 개인배정이 없는 Task의 null 분기, 기할당 Task의 Assignment 단위 필터·원시 Task ID를 보존한다. [#728 누적 실패 및 보완 원장](ISSUE_728_FAILURE_ANALYSIS.md)을 따른다.

신규 `process` selector ID는 Project-local 공정 ID이고 `processOccurrence`는 catalog occurrence ID다. 기존 Resource Target projection의 `process`가 occurrence ID였던 계약과 혼용하지 않는다. HTTP wire 이름/버전은 #729가 별도로 고정한다.

`system`의 유효 Task 직접/Target 연관과 `systemCoordination`의 명시 조율 조회는 구분한다. 조율 구성을 선택해도 다른 Task/Assignment를 현재 하위 범위에 새로 합류시키지 않는다. 기존 `ResourceKpiInput.filters`는 기존 의미의 선행 필터이며 새 selector가 그 범위를 교차한다. 새 명시 공정 selector를 구 Target 공정 필드의 무승인 의미 변경으로 대신하지 않는다.

## 관계와 정확 범위

- `task-association`: 같은 Task에 명시 공정·설비·System이 연결된 작업 연관이다. 실제 설비 소속/제어관계가 없어도 유효하다.
- `membership`: 구성 WorkArea 소속 및 프로젝트 Resource 등록이다. 작업 연관·개인배정과 별개다.
- `controls` / `coordinates`: 원본의 설비 제어·시스템 조율 관계다. Task 공통 연관에서 새로 만들어내지 않는다.
- `assignment`: 기존 Task 개인배정이다. Group-only·책임 역할·프로젝트 등록으로 개인배정을 생성하지 않는다. 개인축 null 분기는 원시 개인배정 없는 Task와 선택 개인배정의 미분류를 보존하며 `metadata.personalNullBranch`와 T0 진단으로 두 의미를 구별한다. 개인/기간 필터로 A에서 사라진 배정을 원시 미배정으로 바꾸지 않는다.

selector를 순차 적용할 때 매 단계의 선택 Task ID와 Assignment ID 교집합을 유지한다. `E1 → M → 공정`에서 E1-t1과 E2-t2가 Milestone M을 공유해도 t2나 그 담당자의 Assignment를 가져오지 않는다. 같은 Task의 여러 공정/설비/System은 교차 조회할 수 있다. 축 순서·중복 source·여러 Group·다중 WorkArea·Milestone 때문에 원시 ID를 복제하거나 상위 총계를 자식 소계 합으로 계산하지 않는다.

기준정보 구성 수량과 관련 작업 모집단을 분리한다. 등록만 된 공정/설비/System/Resource는 작업0 현황으로 남길 수 있다. E10이 조립 WA-A와 검사 WA-B에 연결되어도 원본1개·quantity10이며 두 구역 합집합은10이다. E10에 연결된 Task가 조립만 선택했다면 검사 작업 KPI에는 그 Task를 넣지 않는다.

## 공통 지표 사전

| 지표 | 원시 단위와 산식 | 누락·범위 |
| --- | --- | --- |
| 작업수·완료·지연 | 고유 일반 Task ID. 지연은 미완료이고 canonical end가 asOfDate보다 과거 | 미배정 Task도 포함. Summary/Milestone은 일반 Task 분모에서 제외 |
| 기간가중 진척 | Σ(duration × progress) / Σ(duration) | 분모0=null. 설비 수량·구역수·Target수로 가중하지 않음 |
| 관련 계획 M/D | 고유 `(projectPublicId, assignmentId)`의 기존 Calendar·기간·allocation 계산 | all-unset=null, partial=known sum+미설정 ID, 설정된 비근무일=0. 배정 없음은 허위 공수를 만들지 않음 |
| 계획 M/M | 같은 raw M/D / 명시 유효 양수 mdPerMm | 기준 없음=null. 중간 반올림 없음 |
| 설비 수량·System 수 | typed 고유 instance ID; 설비는 원본 quantity 합, System은 고유 ID 수 | 구성 총계와 선택 Task의 관련 구성 범위를 구분. 소계 비가산 |
| 등록/배정 인원 | 명시 프로젝트 Resource 등록 수 / 일반 Task 개인배정의 고유 Resource 수 | 등록2·배정1 가능. 역할·Group·등록-only는 개인 공수 아님 |
| 미배정·미설정 진단 | 기존 T0 일반 Task와 원시 Assignment 기준 | 개인필터 때문에 배정이 사라진 것과 실제 미배정을 혼동하지 않음 |
| Capacity·전체 부하 | 기존 R의 고유 resource-day와 같은 R의 전체 Project Assignment | 선택80%와 Project140%를 함께 보존. 프로젝트 등록으로 R 확대 없음 |
| Milestone full Gate | 전체 canonical effective membership·선행·기존 Stage Gate 계산 | 현재 선택 Task 완료만으로 전체 Ready를 바꾸지 않음 |

개인필터·Assignment 기간 범위는 기존 Resource KPI의 A 계약을 유지하고, 전체 작업 현황과 T0 진단을 개인배정 유무로 소실시키지 않는다. 실제 수행시간·물리 설치실적·원가·가동률·공정별 기여율을 추정하지 않는다.

## 공통 검산과 소비자 인계

MCS1의 공통 T0=2 M/D, 조립 T1=3, 검사 T2=4, 양쪽 T3=5에서 전체는4 Task·14 M/D다. 조립은 T1/T3·8, 검사는 T2/T3·9, 공정 미연결은 T0·2다. 공정 소계17을 전체로 사용하거나 T3를50:50으로 나누지 않는다. 같은5일100% Assignment가 여러 경로에 보이면 전체5 M/D이며 다른 개인의50% Assignment가 추가되면7.5다.

검증은 [Work Packet](exec-plans/active/ISSUE_728.md)의 AC별 테스트와 실행 원장에 기록한다. 새 공정 기준으로 포함 Task가 바뀌는 경우 이전 자동 공정 분류와 숫자까지 같다고 주장하지 않는다. 같은 원시 Task/Assignment 집합의 기존 계산 oracle 일치가 호환 조건이다. #729는 이 source/version과 exact ID 범위를 공개 API/snapshot/detail에 결속해야 하며 구 `projectionOrder`의 의미를 조용히 바꾸지 않는다. #730의 공통 구성기/표는 동급 설비/System 분기와 표시용 row key를 소비하며 Task/WBS/Assignment 원본에는 쓰지 않는다. Project+관점의 개인 조회 설정·정확 상세·원본 복귀의 현재 화면은 [Project UX](PROJECT_UX.md), 실제 검증 범위는 [#730 Work Packet](exec-plans/active/ISSUE_730.md)을 따른다.

## Issue #729 — HTTP 소비와 snapshot 결속

신규 versioned view API는 위 pure Domain을 실제 한 SQLite read transaction에서 읽은 Project/catalog/Calendar/Task 문맥/WorkArea0..N/참여 원장과 결속한다. 기존 Domain의 도입 당시 HTTP 비제공 설명은 #728 범위이며 신규 HTTP 계약은 [API](API.md#issue-729--versioned-wbs-다관점-조회)를 따른다. 구 projectionOrder·legacy 공정 필터는 변경하지 않는다.

root와 선택 하위 단계, equipment/system 형제 stage의 각 경로에 viewRowKey·exact Task/Assignment 선택과 관계 provenance를 제공한다. 같은 Task의 축 교차는 허용하고 공유 Milestone을 통한 다른 Task 확장은 거부한다. 신규 명시0·legacy null 및 미연결 분기는 유지한다. 등록/구성만 있는 root는 작업0이며 개인배정을 생성하지 않는다. 상세·drill은 같은 snapshot/spec/filter/path를 재검증한다. 지원하지 않는 새 spec Excel은 명시 오류이며 기존 보고서와 혼합하지 않는다. 실제 AC/한도/계측·실패 및 원격 미검증은 [#729 Work Packet](exec-plans/active/ISSUE_729.md)에 기록한다.
