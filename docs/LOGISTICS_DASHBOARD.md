# 물류 구축 대시보드 계산·조회 계약

## 1. 상태와 목적

[도메인 설계](LOGISTICS_DOMAIN_DESIGN.md)의 read model이다. 구현 대상 [LG-05 #188](https://github.com/planner77/masterGantt/issues/188), 통합 검증 [LG-06 #189](https://github.com/planner77/masterGantt/issues/189). **계획된 계약**이며 현재 dashboard API나 운영 지표가 존재한다는 의미가 아니다.

사용자가 결정할 질문은 '어떤 공정·설비·시스템의 작업이 지연되어 누구와 조정해야 하는가', '어떤 Milestone이 임박했는가', '책임자나 계획 투입 정보가 비어 있는가'다. 운영 설비 가동률/이상탐지/실적 원가가 목적이 아니다.

기존 [일정 DB 의미](DB_SCHEMA.md), [Resource DTO](../src/contracts/resources.ts), [계획 공수](ISSUE_56_RESOURCE_WORKLOAD.md)를 재사용한다. 아래 진척 가중치와 임박 기간은 **권장 기본안**이며 현장 KPI 표준이라고 주장하지 않는다.

## 2. 집계 입력과 grain

입력은 동일한 SQLite read snapshot의 Project, canonical Task, 직접 물류 연결, 공정/제어/조율 관계, Resource 역할, 기존 Task assignment와 calendar다. Project timezone은 현재 계약의 Asia/Seoul을 따른다. 브라우저 timezone이나 UTC의 날짜를 '오늘'로 대체하지 않는다.

집계 단위를 명시한다.

| 지표 | grain / 중복 제거 key |
| --- | --- |
| 진척·일반 작업 지연 | Project 안의 일반 leaf taskId |
| Milestone 상태 | Project 안의 milestone taskId |
| 계획 공수 | 기존 resource assignmentId |
| 대상/역할 품질 | equipmentId/systemId 및 구체적 role 관계 |
| 설비 등록 수 | equipmentId 행 수 |
| 설비 수량 | 중복 제거한 equipmentId의 quantity 합 |

일반 task는 type=task, Milestone은 type=milestone이다. Summary는 하위 작업을 묶는 context이며 KPI의 추가 실적 row가 아니다. 일반 작업 progress는 0..100, duration은 기존 엔진의 근무일 수, end는 inclusive 날짜다. 엔진이 이미 계산한 값을 사용하고 대시보드가 새 일정 계산 권위가 되지 않는다.

## 3. 유효 대상과 필터

### 3.1 Task의 유효 대상

각 leaf에 대해 자신의 직접 대상과 조상 Summary의 subtree 대상 합집합을 구한다. sourceTaskId, scope, direct/ancestor provenance를 보존한다. 동일 대상이 여러 경로로 발견되어도 leaf는 한 번이다. Summary self 연결은 자손의 유효 집합에 넣지 않는다.

필터가 없는 Project 전체 KPI에는 물류 미연결 일반 Task와 Milestone도 포함한다. 연결되지 않은 작업을 숨겨 전체 진척을 좋게 보이게 만들지 않는다. '물류 연결 작업만'은 별도 명시 필터로만 제공하고 활성 상태를 표시한다.

### 3.2 차원별 의미

| 차원 | 포함 조건 |
| --- | --- |
| 설비 | 유효 equipmentIds 중 선택한 ID 존재 |
| 시스템 direct | 유효 systemIds 중 선택한 ID 존재 |
| 공정 | 선택 공정 또는 명시 includeDescendants 범위에 속한 유효 설비, 또는 processes 범위 시스템의 지정 공정이 일치 |
| 작업 담당 리소스 | 기존 task_assignments에 선택 개인 Resource의 직접 배정 존재 |
| 설비/시스템 역할 리소스 | 유효 대상의 역할 관계가 선택 Resource 및 선택 role 조건과 일치 |

같은 차원에서 여러 값은 OR, 서로 다른 차원은 AND다. 공정 includeDescendants 기본 true를 화면에 명시하며 필요 시 false로 전환한다. global ResourceGroup을 개인 필터로 몰래 확장하지 않는다. group 필터가 필요하면 기존 명시 group assignment 의미를 별도 표시한다.

공정별 표에서 `scope=project` 공통 시스템은 독립 `프로젝트 공통` 행으로 표시한다. 공정마다 MCS 작업을 자동 복제하지 않는다. 하나의 작업이 공정 대상과 공통 시스템 모두에 연결되면 각 drill-down에서 발견될 수 있으나 grand total은 taskId로 dedup한다. '공통 포함' 같은 추가 선택 기능은 기본 공정 필터 의미를 조용히 변경하지 않는다.

관리 목록은 active 기본 필터를 사용할 수 있지만 Project KPI는 비활성 마스터에 연결된 미완료 작업도 유지한다. dashboard에서 active-only를 선택할 때만 좁히며 적용 조건과 제외 개수를 표시한다. 비활성 마스터의 기존 role/Task link는 삭제된 데이터가 아니다.

### 3.3 MCS 조율 범위

시스템 기본은 direct다. coordinator에서만 `조율 범위 포함`을 명시적으로 켤 수 있다.

```text
S = 선택한 coordinator 자신 + coordinates를 따라 도달하는 모든 자손 시스템
E = S 안의 controller가 primary/supporting으로 제어하는 설비 ID 합집합
선택 작업 = (유효 시스템 ∩ S가 비지 않은 leaf)
         ∪ (유효 설비 ∩ E가 비지 않은 leaf)
```

복수 경로/공유 controller/하나의 설비에 복수 시스템이 있어도 taskId로 한 번만 계산한다. 조회 응답에 시스템/설비/조상 연결의 포함 경로를 표시한다. 이 옵션은 read-time 범위이며 task-system row를 저장하거나 FS link를 생성하지 않는다. 시스템 속성 편집에서 MCS 하위 관계가 바뀌면 이 범위가 변할 수 있음을 안내한다.

조율 포함 상태에서 역할 리소스 필터를 사용할 때도 선택한 coordinator 및 범위 S/E의 명시 역할과 연관된 작업만 포함한다. direct 상태에서는 단순히 상위 MCS의 PI라는 이유로 하위 모든 Task를 선택하지 않는다. 필터 정규화/집합 함수는 Grid와 dashboard에서 공유한다.

### 3.4 Grid drill-down

숫자를 클릭하면 동일한 기준의 Task/Milestone ID 집합으로 일정 보기를 연다. 일치 작업의 조상을 표시용 context로 추가하되 진척/개수 분모에는 넣지 않는다. 직접 일치하는 Summary self row는 탐색 가능하지만 '계산에 포함된 leaf 없음'을 숨기지 않는다.

응답의 ID 집합을 재사용하거나 동일 revision을 확인하는 drill-down을 사용한다. Project/catalog revision이 바뀌면 최신 기준으로 다시 계산하여 갱신 사실을 알린다. 이전 숫자와 새 작업 목록을 같은 snapshot이라고 표시하지 않는다.

## 4. 핵심 KPI 3개

### 4.1 기간 가중 진척

선택 집합의 일반 Task를 T라 할 때:

```text
progressPercent = Σ(t.duration × t.progress) / Σ(t.duration), t ∈ T
```

progress가 이미 0..100이므로 다시 100을 곱하지 않는다. Summary와 Milestone, 중복 Task를 제외한다. 분모0은 null이며 '대상 작업 없음'으로 표시한다. UI 표시만 소수1자리 등으로 반올림하고 중간 계산은 반올림하지 않는다. 완료한 일반 작업 비율(count)과 이 기간 가중치(working-day weight)는 별개다.

이 지표는 **기간 가중 진척**이지 실제 설치/검수 완료율이나 공수 가중 실적이 아니다. duration 변경·Task 분할·범위 변경만으로 값이 달라질 수 있으므로 진행률과 함께 작업 수/총 가중 기간/현재 revision을 확인할 수 있게 한다. 물리 설비 수량이나 Summary span을 추가 가중치로 쓰지 않는다.

### 4.2 미완료 지연 일반 작업

```text
overdueTasks = {t ∈ T | t.progress < 100 and t.end < asOfDate}
```

inclusive end가 기준일과 같은 작업은 당일 마감이지 지연이 아니다. 완료된 작업이 과거에 늦게 끝났는지는 실제 완료일이 없으므로 판정하지 않는다. '지연1'은 현재 계획 종료일이 지난 미완료 Task가1개라는 뜻이지 납기준수율/일정 편차의 실적 측정이 아니다.

기한이 지난 근무일 수가 필요하면 기존 Project calendar로 end 다음 날부터 asOfDate까지의 근무일을 계산하고 '현재 계획 기준 지연 근무일'로 표기한다. 실제 finish variance와 혼동하지 않는다.

### 4.3 Milestone 경보

Milestone의 progress=100이면 완료, 그 외에는 미완료다. 날짜가 지났다고 자동 완료하지 않는다. 기존 데이터의 0<progress<100도 미완료로 해석하며 migration으로 임의0/100 정규화하지 않는다.

```text
지연 = 미완료 and due < asOfDate
임박 = 미완료 and asOfDate <= due <= asOfDate + (horizonDays - 1) 달력일
```

기본 horizonDays=14(당일 포함)이며 입력은1..90의 정수로 제한하는 기본안을 사용한다. 과거 지연과 임박을 중복 집계하지 않는다. 실제 검수 승인/증빙 워크플로가 없으므로 완료 flag를 '인수 승인 완료'라고 부르지 않는다.

## 5. 보조 정보와 guardrail

### 기존 계획 공수

[#56](ISSUE_56_RESOURCE_WORKLOAD.md)의 계산 엔진을 호출하거나 동일한 pure domain 모듈을 공유한다. 일반 leaf의 개별 Resource assignment, 유효 투입기간, Project/Resource 달력과 명시 allocationPercent만 사용한다. 조회 구간과 투입 구간의 교집합 근무일 × percent/100이 M/D다. M/M은 설정된 RESOURCE_MD_PER_MM가 유효할 때만 제공한다.

NULL 투입률은 100%가 아니라 '공수 미설정'으로 세고 공수 합에서 제외한다. Summary/Milestone/group assignment와 단순 역할 배정은 공수를 생성하지 않는다. 역할 기준으로 Task를 선택해도 그 사람의 역할만으로 투입 공수를 추가하지 않는다. 사람별 effort 표는 그 사람의 실제 assignment만 집계한다.

물류 필터를 적용한 작업 집합 안의 assignmentId를 한 번씩 합산한다. 같은 Resource의 여러 그룹, 같은 Task의 여러 설비/시스템 때문에 Grand Total을 중복 합산하지 않는다. 기간 filter를 사용하면 workloadFrom/workloadTo를 응답에 포함한다. 미설정 시 선택 Task의 min start/max end를 유도하며 빈 집합은 기간 null이다.

### 품질 경고

대표 담당자/대표 PI 충족은 active 대상에 연결된 active Resource의 primary role 기준이다. 대표 미지정, 담당자 전무, inactive 담당은 각각 식별 가능한 사유다. 개발자0명은 프로젝트 단계상 의도적일 수 있어 정보성 미지정 표시이지 일률적 실패로 만들지 않는다.

작업 물류 연결 누락률은 선택된 전체 leaf(Task+Milestone) 중 유효 설비와 시스템이 모두 없는 leaf 비율이다. 분모0은 null. 프로젝트 공통 작업이 의도적으로 연결되지 않았을 수 있으므로 누락이 곧 작업 오류라고 단정하지 않는다. 상세 목록에서 사용자가 분류할 수 있게 한다.

설비 수는 '등록 관리 단위 수'와 '입력 수량 합'을 구분한다. fleet 구성원/개별 행 중복 여부를 자동 검증할 원장까지는 없으므로 물리 실재 자산 수 검증 완료라고 표시하지 않는다. primary 제어 누락/공정 범위 불일치도 별도 진단으로 제공한다.

핵심 KPI를 하나의 불투명한 적·황·녹 점수로 합치지 않는다. 지연0/미설정0 같은 관측 사실은 표시할 수 있지만 근거 없는 목표치/우수 등급은 만들지 않는다.

## 6. API·표시·캐시

계획 경로: `GET /api/projects/{publicId}/logistics/dashboard`. exact query schema는 구현 PR에서 [API](API.md)에 동기화한다. 서버는 유효한 날짜·UUID·filter enum·개수·범위를 검증한다. Public readonly 범위는 기존 Project read와 동일하고 응답에는 연결된 사람의 최소 표시정보만 포함한다.

응답에는 최소 다음 메타데이터를 포함한다.

```text
projectRevision, catalogRevision
asOfDate, timezone, calculatedAt
normalizedFilters, systemView, horizonDays
workloadRange
includedTaskCount, includedMilestoneCount, excludedCounts
progressPercent|null, totalDuration
incompleteOverdueCount, milestoneOverdueCount, milestoneUpcomingCount
plannedMd, plannedMm|null, unsetAllocationCount
coverageDiagnostics, breakdownRows, drillDownReferences
```

초기는 영속 집계 테이블/백그라운드 job 없이 요청 시 계산한다. 이후 캐시가 필요하면 Project/Catalog revision+필터+asOfDate+달력/공수 설정 버전을 모두 반영한다. 한 response는 같은 read transaction의 값이어야 한다. 네트워크 요청을 transaction 안에서 하지 않는다.

asOfDate는 현재 날짜를 기본으로 한다. 과거 기준일을 허용해도 이는 **현재 저장된 계획·진척을 그 날짜와 비교**하는 것이며 과거 대시보드 재현이 아니다. 실제 추세/S-curve를 위해서는 snapshot/baseline/실적 이력 모델이 먼저 필요하다.

서버 미조회/오류를0으로 렌더링하지 않는다. initial loading, 데이터 없음, filter 결과 없음, 데이터 일부 미설정, 오류, stale를 구별한다. 표와 요약 text로 동일 정보를 제공하고 색상만으로 경고를 구분하지 않는다. 숫자 클릭/뒤로/탭 전환은 Gantt mount/state/focus 계약을 보존한다.

## 7. 결정적 합성 검증 fixture

실제 고객/설비/담당자 정보가 아닌 테스트용 데이터다. 캘린더는 토/일만 휴무, **국가 공휴일 rule 없음**으로 명시한다. 따라서10월9일도 이 fixture에서는 근무일이다. 운영 한국 달력의 사실을 가정한 예제가 아니다. 기준일2026-10-09, 공수 범위2026-10-05..2026-10-12.

마스터: P1/P2/P3; E1=Stocker unit1(P1), E2=AGV fleet4(P2), E3=AMR fleet3(P3). C1=SCS controls E1, C2=ACS controls E2/E3, C3=MCS coordinates C1/C2. R1을 여러 시스템 PI, R2를 개발자로 배정한다.

| Task | 유형 | 부모 | 시작~종료 | duration | progress | 직접 연결 |
| --- | --- | --- | --- | ---: | ---: | --- |
| S1 | summary | root | 자손 파생 | span 파생 | 기존 엔진 파생 | E1, subtree |
| T1 | task | S1 | 2026-10-05..08 | 4 | 50 | E1 self, C1 self |
| T2 | task | S1 | 2026-10-07..08 | 2 | 100 | E2 self, C2 self |
| T3 | task | root | 2026-10-09..12 | 2 | 0 | E2 self, C2 self |
| M1 | milestone | root | 2026-10-08 | 0 | 0 | C3 self |

T2는 S1에서 E1을 상속하고 E2에도 직접 연결된다. T1의 E1은 직접+상속 중복을 제거한다.

| 결과 | 기대값과 근거 |
| --- | --- |
| Project 진척 | (4×50+2×100+2×0)/8 = 50% |
| E1 진척 | T1/T2 각1번: (4×50+2×100)/6 = 66.666…% |
| 일반 지연 | T1만1개, T2는 완료, T3는 아직 종료 전 |
| Milestone 지연 | M1만1개 |
| C3 direct | M1; 일반 Task 분모0 → 진척 null |
| C3 조율 포함 | T1/T2/T3/M1; 진척50%, 총계 중복 없음 |
| 설비 등록/수량 | 관리 단위3개, 입력 수량8대 |
| R2 투입 | T1 50%=2MD, T2 100%=2MD, T3 percent=NULL → 총4MD/미설정1 |

단순히 R1 PI/R2 developer 역할을 추가해도4MD는 증가하지 않는다. E1 관련 MD4와 E2 관련 MD2를 합해6으로 Project 총계를 만들면 **실패**다. T2 assignment가 두 소계에 등장하기 때문이다. 출처 경로가 늘어나도 전체 task/assignment 집합은 동일해야 한다.

## 8. 검증 계획과 비범위

Unit은 집합/중복/진척/날짜경계/분모0/미설정/Scope를 검증한다. SQLite integration은 동일 snapshot/revision/Project isolation/activation/copy를 검증한다. E2E는 실제 입력→저장→재조회→필터→drill-down→복사→재조회 및 a11y/반응형/Gantt state를 검증한다. fixture의 계산 검산은 실제 구현 Unit/CI 실행과 별개다.

대표 규모 제안은 Task5000, 설비1000, 시스템300, 연결20000, 중첩 depth64 이내이며 실제 상한은 기존 import/Task 제한과 맞춰 조정한다. N+1/쿼리 수/EXPLAIN QUERY PLAN/실측시간을 보고한 뒤 병목에 맞춰 index를 추가한다. 초기 숫자를 제품 SLA로 주장하지 않는다.

실제 완료일/검수 증빙/baseline/실적 투입/EV/PV가 없으므로 납기 준수율, SPI/CPI, 실제 공수, 실제 추세를 만들지 않는다. 해당 요구가 생기면 추가 데이터 수집·정의·이력을 먼저 Issue로 설계한다.
