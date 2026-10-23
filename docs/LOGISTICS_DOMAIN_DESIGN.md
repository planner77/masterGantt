## Issue #785 — 현행 실물 모델과 내부 호환 원본

Logistics Target의 사용자 엔터티/보조 편집 UI 정책은 폐기한다. 신규 업무의 원본은 Project 공정·WorkArea·Equipment/System·Task/Summary 직접 관계다. 공정0..N·구역0..N·공통/공유 System·설비 다중 구역·T0/A/R·같은 WBS 원시 ID를 유지한다. 조회용 그룹을 영속 엔터티나 WBS로 만들지 않는다.

기존 whole/subset·coverage·self/subtree·동명/공유/비활성 원본은 내부 호환 해석으로 유지하고 실제 실물 ID·출처를 제공한다. 새 직접 관계만으로 동적 whole을 표현할 수 없어 평탄화하지 않는다. 외부 전용 경로 퇴역·v2 공개 DTO와 지원 Copy/Template archive 보존은 [API](API.md), [실행 설계](exec-plans/active/ISSUE_785.md)를 따른다. 아래 최초 설계의 Target 보조 화면/작성 설명은 역사이며 현재 정책이 아니다.

## Issue #762 — Project 공정과 WorkArea 직접 소속

신규 정상 등록은 Project 공정→선택 WorkArea0..N의 두 종류로 완결한다. 사업부/제품/사업장은 Project 분류이고 신규 공정/구역 CRUD 전제조건이 아니다. 구역의 owner 공정과 설비의 주 관리 공정은 서로 다르며 설비는 서로 다른 공정의 구역에 연결할 수 있다. Task/Summary는 공정0..N과 선택 구역을 명시하고 WBS 계층을 공정 계층으로 치환하지 않는다.

직접 구역은 `project_work_areas`의 한 Project/공정에 속한다. 기존 유형/제품 표준/site occurrence/global WorkArea/mapping은 호환 원본으로 유지한다. legacy shared 구역은 explicit mapping별 alias이며 복수 processId에 같은 원본 UUID가 나타날 수 있다. 이를 단일 owner로 자동 전환하지 않으며 project edit는 global 구역 수정 권한이 아니다. 참조 해소·승인된 전환 전까지 호환 경로를 유지한다. [Work Packet](exec-plans/active/ISSUE_762.md)의 before→after inventory·배포/검증을 따른다.

## Issue #735 — 시스템 원본을 중심으로 한 조회

시스템 관점의 관리 대상은 유형이 아닌 System 인스턴스다. 공유 MCS는 프로젝트 공통 또는 복수 공정 속성을 가진 단일 원본이며 조회 경로별 복제·숨은 Target·공수 배분 입력을 요구하지 않는다. 실제 coordinates/controls와 같은 Task의 공정/설비/리소스 연관을 구별한다. 직접/조율 모드는 기존 공통 원장을 선택할 뿐 구성·WBS·Task 명시 공정0..N을 변경하지 않는다. 책임 역할 PI/개발자는 개인 투입·개발 실적·가동률의 증거가 아니다. [시스템 관점](LOGISTICS_DASHBOARD.md#issue-735--물류-시스템-전용-관점), [구현/검증 경계](exec-plans/active/ISSUE_735.md)를 따른다.

## Issue #726 — 기존 관리 원본과 직접 Task 편집

기준정보 설비/물류 시스템은 기존 단일 CRUD·공유 인스턴스 editor를 재사용한다. 같은 설비/MCS를 공정·Target·표시 경로별로 복제하지 않으며 공유 원본 수정, Target 구성원 해제, 실물 삭제를 구별한다. 수량·역할·controls/coordinates 변경은 기존 공유 사용처 확인과 서버 방어를 통한다.

Task 물류 연결은 직접 Equipment/System 및 #725의 명시 공정/WorkArea 편집이 기본이며 기존 whole/subset/coverage는 내부 호환 원본으로 보존하며 공개 보조 편집은 폐기한다. 각 경로는 독립 저장이고 UI 재배치로 관계를 자동 복사·변환하지 않는다. 명시 공정0..N·legacy null·self/subtree와 직접/조상 출처를 보존한다. Task에 함께 연결된 설비와 MCS는 작업 연관이며 자동 제어관계·공수 배분·Task 복제의 근거가 아니다. 기준정보 다중 WorkArea는 주 관리 공정과 별도다.

새 schema/서버 writer는 없고 #725 API의 Project/catalog revision 및 기존 canonical gateway를 사용한다. 조회 실패는 빈 연결로 처리하지 않으며 독립 저장 간 dirty/pending 잠금을 유지한다. 출처 안내는 명시 ancestor subtree이며 전체 #728 해석/후속 #729 공개 조회와 구별한다. [Task UX](TASK_EDITOR.md), [검증](exec-plans/active/ISSUE_726.md).

## Issue #728 — 구성 원장과 WBS 작업 연관

WBS Task가 분석 출발점이다. 같은 Task의 명시 공정·설비·System은 실제 구성/제어관계가 없어도 교차 조회할 수 있지만, 이를 설비 공정 소속/controls/coordinates로 바꾸지 않는다. `E1→Milestone M→공정`은 E1에 관련된 Task/Assignment를 유지하며 M의 다른 작업으로 확장하지 않는다. full Gate는 전체 원본을 유지한다.

W1의 타 공정 다중 WorkArea와 W2의 Task 명시 공정0..N을 적용한다. 기준정보의 담당 공정과 Task 작업 공정은 별도며 명시0은 정상이다. 신규 해석기는 구성·작업·Target 출처/version을 구분하고 구형 API 산식/필터는 보존한다. [단일 Domain 입력·KPI 계약](WBS_TASK_LEDGER.md), [검증 원장](exec-plans/active/ISSUE_728.md)을 따른다. 공개 조회 통합은 #729 이후다.

## Issue #725 — WBS 중심의 선택적 공정·WorkArea 문맥

#723/#725의 최신 W1/W2 결정은 아래 최초 설계 기본안보다 우선한다. 공정 occurrence 하나의 WorkArea는0..N이고 각 WorkArea는 정확히 occurrence 하나에 소속한다. 설비 하나는 타 공정 구역을 포함한0..N WorkArea에 연결될 수 있다. `Equipment.processId`는 계속 주 관리 공정이며 실제 WorkArea 소유 공정과 별개다. 설비–구역은 typed 관계 컬렉션으로 저장하고 공정 매핑의 기존 `workAreaId`는 호환 기본 구역으로 유지한다.

Task/Summary 직접 공정은 사용자가0..N개 선택한다. Equipment/System/WorkArea/Target로 Task 공정을 자동 채우지 않는다. 명시0개의 marker와 구형 미도입 null을 구분하며 명시0개를 legacy fallback 허가로 읽지 않는다. 직접 WorkArea는 실제 소유 공정을 명시 선택해야 하고 공정을 자동 추가하지 않는다. self/subtree 및 직접/legacy/기준정보 출처를 보존하며 공통 해석·집계는 #728/#729, Task Editor 화면은 #726의 범위다.

같은 E10을 조립 WA-A와 검사 WA-B에 연결해도 Equipment 원본1개·quantity10이다. 두 구역의 관련 수량이 각각10이어도 Project 고유 총량은10이며 구역별 배치 대수를 뜻하지 않는다. 구성 관계가 제어 관계·Task Dependency·Task/Target 복제·공수 배분을 만들지 않는다. 별도 기준정보 화면은 Target0개에서 동작하고 숨은 Target을 생성하지 않는다.

실제 신규 저장 계약은 migration0028, [DB](DB_SCHEMA.md#issue-725--선택적-다중-workareatask-직접-문맥-migration-0028)와 [API](API.md#issue-725--target-없는-공정workarea-직접-문맥)를 따른다. 아래 LG 초기 계획의 미구현 경로/복사 차단은 도입 당시 기록이며 현재 [Copy·Template](ISSUE_27_PROJECT_COPY.md#issue-725--직접-문맥의-copytemplate-v4) 지원이 우선한다. 실제 검증은 [실행 원장](exec-plans/active/ISSUE_725.md)에서 구별한다.

# 물류 구축 프로젝트 도메인 설계

## Issue #615 — F1 기반 모델

[#615 Work Packet](exec-plans/active/ISSUE_615.md)의 migration0025·공통 process catalog·명시 Project mapping API가 F1 구현 범위다. legacy 공정/Task/설비를 변환하지 않고 WorkArea는 선택 사항이며 BU/product/site의 정확한 occurrence만 연결한다. 표준 변경은 Project 공정을 자동 생성·삭제하지 않는다. 같은 triple copy는 공통 ID를 보존하고 F1 당시 mapped Template 저장은 포맷 확장 전409였으며 현재 versioned Template 지원을 따른다. 실제 계약은 [API](API.md)/[DB_SCHEMA](DB_SCHEMA.md)/[LOGISTICS_TARGETS](LOGISTICS_TARGETS.md)를 따른다. 새 화면·Target/member/binding·Resource 축 및 운영 적용/원격 CI 성공은 후속 증거가 필요하다.

## Issue #614 — 현행 물류와 Target 확장 계약

이 문서의 최초 계획 상태와 과거 고정 type 목록은 당시 설계 이력이다. 현재 구현은 `src/contracts/logistics.ts`·Service·migration ledger와 [API](API.md)/[DB_SCHEMA](DB_SCHEMA.md)를 우선하며 Equipment/System type은 동적 catalog code string이다. 새 공정 master·occurrence/WorkArea·Target/member/binding·관련 Resource 공수 계약은 [LOGISTICS_TARGETS](LOGISTICS_TARGETS.md), 우선순위와 책임은 [Target/Resource 실행 계획](exec-plans/active/TARGET_RESOURCE_ROLLOUT.md)을 따른다. F0는 문서·합성 fixture 검산이며 신규 runtime/DDL 구현을 의미하지 않는다. 기존 직접 연결·합집합 상속·권한·일정 계약은 보존한다.

## 1. 상태·요구·근거

- 상위: [Epic #183](https://github.com/planner77/masterGantt/issues/183).
- 상태: **설계 제안 / 구현 이슈 등록**. 제품 구현·migration 적용·독립 QA·배포 완료를 의미하지 않는다.
- 조사 기준: 2026-09-26, main `9f313eb30328486f3e6a2cfa31935542bc2067d2`, application `0.33.0`, `@svar-ui/react-gantt 2.7.3`.
- 이번 범위: 도메인·화면·집계 설계와 지침 기록, 구현 Issue 분해. runtime/의존성/application version 변경 없음.
- 연결 문서: [대시보드 계산](LOGISTICS_DASHBOARD.md), [구현 지침](LOGISTICS_IMPLEMENTATION_GUIDELINES.md), [실행 계획](exec-plans/active/LOGISTICS_ROLLOUT.md).

사용자 확정 요구는 공정별 Stocker/AGV/AMR 등의 설비, 직접 제어 물류시스템과 이를 조율하는 MCS, 설비 담당자·시스템 PI·개발자를 관리하고 Summary/Task/Milestone에 설비·시스템을 연결하는 것이다. 사람은 기존 Resource를 사용한다. 아래 cardinality, 대표 담당 정책, 집계 공식은 이 요구를 구현하기 위한 **설계 기본안**이며 사용자에게 이미 확정받은 업무 규칙으로 표현하지 않는다. PI의 조직별 정식 명칭을 추측해 확장하지 않고 역할명 `PI`를 유지한다.

실제 확인한 기존 계약: [AGENTS](../AGENTS.md), [DB_SCHEMA](DB_SCHEMA.md), [프로젝트 DTO](../src/contracts/projects.ts), [리소스 DTO](../src/contracts/resources.ts), [계획 공수](ISSUE_56_RESOURCE_WORKLOAD.md), [Lifecycle](ISSUE_LIFECYCLE.md). 기존 글로벌 Resource/Group, task_assignments, Project revision, inclusive date, 별도 일정 엔진을 확장한다. 이 설계가 기존 보안·일정·권한 계약을 변경하지 않는다. 구현 PR에서 변경된 부분만 기존 API/DB/요구/테스트 문서에 동기화한다.

## 2. 구조적 결정과 대안

| 결정 | 선택 이유 | 채택하지 않는 방식 |
| --- | --- | --- |
| 공정 트리와 WBS 분리 | 공정은 구축 대상 구조, WBS는 작업 구조이며 한 시스템이 여러 공정을 지원함 | Summary 이름을 공정 master key로 사용 |
| Equipment와 System 분리 | 물리 설비와 소프트웨어의 수량·속성·책임·관계가 다름 | 전부 Resource 또는 이름 문자열로 저장 |
| 기존 Resource 참조 + 대상별 역할 | 동일 인물의 여러 프로젝트·설비·역할 겸임과 명칭 변경을 안정적으로 처리 | PI/개발자별 별도 인력 마스터 |
| 명시적 관계 테이블 | M:N 중복·FK·Project 격리·삭제 영향 검증 가능 | 쉼표 목록, JSON 문자열 ID 배열, FK 없는 target_type/target_id |
| 직접 연결과 파생 범위 분리 | Summary 변경 시 자식 row 복제·데이터 표류·중복 합산 방지 | 부모 연결을 모든 자식에 자동 저장 |
| 책임 역할과 작업 allocation 분리 | '책임자'가 모든 하위 작업에 100% 투입된다는 잘못된 공수 방지 | PI를 모든 작업 assignee로 자동 배정 |
| 현재 계획의 read model | 현재 보유한 데이터로 설명 가능한 지표를 제공 | 실제 완료일·baseline 없이 납기 준수율/실적 공수 추정 |

SQLite + better-sqlite3, 단일 application instance, 기존 Next.js/React/SVAR Core를 유지한다. 새로운 graph DB, 별도 서비스, 관제 시스템, PRO 의존성은 필요하지 않다. 작은 프로젝트용 관계형 모델로 우선 구현하고 실제 query plan/측정 전 확장성이나 응답시간을 보장하지 않는다.

## 3. 개념 모델

```text
Project
  ├─ Process tree                    (공정 구조: WBS와 독립)
  │    └─ Equipment                  (주 관리 공정 1개)
  ├─ Logistics System
  │    ├─ process scope              (프로젝트 공통 또는 복수 공정)
  │    ├─ controls ↔ Equipment       (controller만, M:N)
  │    └─ coordinates → System       (coordinator만, DAG)
  └─ Task tree                       (기존 Summary / Task / Milestone)
       ├─ task_equipment_links → Equipment
       ├─ task_system_links → System
       └─ task_assignments → Resource/Group   (기존 작업 투입)

Equipment → equipment_resource_roles → 기존 global Resource
System    → system_resource_roles    → 기존 global Resource
```

MCS를 Project와 동일시하지 않는다. 프로젝트에 MCS가 여러 개이거나 계층형 coordinator가 있어도 표현할 수 있다. ACS/SCS/OCS/LCS/MCS는 시스템 유형 예시이며 제품명만으로 역할을 추정하지 않는다. `layer`가 관계 검증의 기준이다. `coordinates`는 관리상 조율 계층이지 실제 통신 패킷의 방향/전체 인터페이스 그래프가 아니다.

## 4. 마스터와 관계의 논리 스키마

아래는 **계획된 논리 모델**이며 존재하는 테이블 목록이 아니다. 공통 신규 local entity에는 내부 INTEGER PK, immutable public UUID, project_id, created_at/updated_at을 둔다. API는 내부 PK를 노출하지 않는다. 신규 migration 번호는 착수 시 최신 main의 ledger 다음 번호로 확정한다.

### 4.1 공정·설비·시스템

| 테이블 | 주요 필드 | 계약 |
| --- | --- | --- |
| project_processes | public_id, project_id, code, name, parent_id, sort_order, active | 자기참조/순환 금지, 프로젝트 내부 트리 |
| project_equipment | public_id, project_id, process_id, code, name, equipment_type, management_unit, quantity, manufacturer, model, description, active | 주 관리 공정 1개; unit이면 quantity=1, fleet이면 양의 정수 |
| project_logistics_systems | public_id, project_id, code, name, system_type, layer, scope, vendor, description, active | layer=controller/coordinator; scope=project/processes |
| project_system_processes | project_id, system_id, process_id | systems와 processes M:N, 동일 쌍 UNIQUE |
| project_equipment_systems | project_id, equipment_id, system_id, control_role | controller만; primary/supporting, 동일 쌍 UNIQUE; 설비별 primary 최대1 |
| project_system_links | project_id, source_system_id, target_system_id, relation_type | relation_type=coordinates; source는 coordinator; 동일 쌍 UNIQUE; self/cycle 금지 |

기본 설비 유형: stocker/agv/amr/oht/conveyor/other. 기본 시스템 유형: scs/acs/ocs/lcs/mcs/other. 다른 현장 명칭은 name과 other로 수용하고 유형 추가는 allowlist·문서·테스트를 같이 변경한다. type으로 특정 vendor 구현을 강제하지 않는다.

Persistence의 code는 trim 후 빈 값 불가, 프로젝트·entity 종류별 UNIQUE, 대소문자 구분이다. name은 표시명이며 유일키가 아니다. 공정 생성 UX에서는 code를 사용자 필수 입력으로 요구하지 않고, 생성 요청에서 code가 생략되면 서버가 해당 공정 public UUID를 기반으로 `PROC-<UUID>`를 생성해 이 invariant를 만족시킨다. 명시적 legacy/business code는 기존 API 호환을 위해 허용하고 검증·중복 규칙을 유지한다. 설비·시스템 code 입력 정책은 변경하지 않는다. 상한은 code 64자, name 200자, 설명 4000 Unicode code points이다. 사용자 문자열을 SQL 구조나 HTML로 직접 삽입하지 않는다.

`fleet`는 예를 들어 '포장공정 AMR 3대'를 하나의 관리 대상으로 표현한다. 개별 장비 식별이 필요하면 unit 행으로 관리한다. fleet와 구성 개별 장비를 동시에 등록해 수량을 두 번 세지 않도록 입력 안내를 둔다. fleet 구성원 계보·실시간 차량 식별/위치 추적은 초기 범위 밖이며 자동 분해하지 않는다. AGV/AMR의 process_id는 **주 관리 공정**이지 가능한 모든 주행 공정이나 경로가 아니다.

시스템 `scope=project`는 명시적인 프로젝트 공통이며 process 연결 0개다. `scope=processes`는 transaction 완료 시 process 연결 1개 이상을 요구한다. 제어 설비의 공정과 선언 범위가 다르면 범위 불일치 경고로 노출하되 공정 범위를 자동 변경하지 않는다. 원격 조회로 보이는 모든 시스템을 각 공정에 복제하지 않는다.

primary 제어시스템 미지정은 초기 계획 등록을 막지 않는 품질 경고다. 한 설비의 여러 공동 제어 주체는 supporting으로 표현할 수 있다. coordinator의 직접 설비 제어 연결은 이 모델에서 거부한다. 실제 한 제품이 두 역할을 수행하면 역할별 논리 시스템으로 나누고 관계를 명시하거나 구현 전에 모델 변경 결정을 남긴다.

### 4.2 Resource 기반 역할

| 테이블 | 필드 | 규칙 |
| --- | --- | --- |
| equipment_resource_roles | project_id, equipment_id, resource_id, role, is_primary | role=owner/contributor; primary는 owner만 |
| system_resource_roles | project_id, system_id, resource_id, role, is_primary | role=pi/developer; primary는 pi만 |

동일 대상·Resource·role은 UNIQUE. 설비별 primary owner 최대1, 시스템별 primary PI 최대1이다. 대표 이외의 공동 담당/PI와 복수 개발자를 허용한다. 동일 Resource가 같은 시스템에서 PI와 developer를 겸임할 수 있다. 대표 담당자 0명은 저장 가능하며 데이터 품질로 표시한다. '대표 미지정'과 '어떤 담당자도 없음'을 구별한다.

대표성은 Project 범위의 현재 책임이고 global Resource의 영구 직종이나 접근권한이 아니다. 초기 범위는 현재 역할만 관리한다. 변경 전 역할의 유효기간·감사이력·과거 시점 담당자 조회는 이 테이블만으로 제공한다고 주장하지 않는다.

후보는 기존 개인 Resource를 사용하고 Group을 개인 대용으로 연결하지 않는다. 동명이인은 code/ID로 구분한다. 미등록 개인은 기존 Resource 관리자 흐름으로 등록한 뒤 선택한다. Project edit 권한으로 global catalog 생성/수정·동명이인 병합을 수행하지 않는다.

inactive Resource의 새 연결은 거부한다. 기존 연결은 표시/제거/변경 없는 유지가 가능하며 경고한다. inactive primary는 유효 담당 충족으로 보지 않는다. Resource 비활성화가 역할이나 task_assignments를 자동 삭제하지 않는다. Resource hard-delete 사용 영향 조회에 이 두 테이블을 추가하고 참조 중 삭제를 차단한다.

### 4.3 Task 연결

| 테이블 | 필드 | 규칙 |
| --- | --- | --- |
| task_equipment_links | project_id, task_id, equipment_id, scope | Task·설비 쌍 UNIQUE; scope=self/subtree |
| task_system_links | project_id, task_id, system_id, scope | Task·시스템 쌍 UNIQUE; scope=self/subtree |

Summary/Task/Milestone 모두 복수 설비와 복수 시스템에 연결 가능하다. 모든 타입의 기본은 `self`이며 Summary만 `subtree`를 명시적으로 선택할 수 있다. UI 문구는 '이 항목만'과 '하위 작업 포함(파생)'으로 구분한다.

## 5. 연결·범위 계산의 불변식

leaf L의 유효 설비 집합은 L의 직접 설비 연결과 모든 조상 Summary의 subtree 설비 연결의 합집합이다. 시스템도 동일하다. 결과는 대상 ID로 dedup하고 `direct` 또는 원본 `ancestorTaskId/link` 출처 목록을 함께 제공한다. 직접 연결이 이미 있으면 파생 원인을 지우지 않는다.

예: Summary S가 E1을 subtree로 지정하고 자식 T가 E1과 E2를 직접 지정하면 T의 유효 대상은 E1/E2다. E1을 두 번 세지 않는다. E2를 지정했다고 E1을 자동 제외하지 않는다. 상속 제외/override는 초기 범위 밖이다. 전체 WBS를 포괄하는 Summary에 특정 설비를 연결하기 전 영향 작업 수를 보여 준다.

Summary의 self 연결은 Summary 자체의 관리 표시이며 하위 KPI 작업 집합을 늘리지 않는다. Summary에서 '자손에 등장하는 대상 요약'은 역방향 조회값으로 따로 표시한다. 필터에서 직접 일치하는 Summary는 표시하되, 그 자손이 자동 일치한 것으로 처리하지 않는다. 일치 leaf를 보여 주기 위한 조상은 context row이며 metric denominator에는 포함하지 않는다.

Task 이동 시 조상에 따라 유효 대상이 달라질 수 있으므로 변경 전후 영향 수와 출처를 보여 준다. row 복제 없이 계산한다. subtree 연결이 있는 Summary를 leaf로 바꿀 때는 self 전환의 명시적 확인을 같은 atomic command에 포함하거나 오류로 거부한다. Task 삭제는 해당 Task 연결만 삭제하고 설비/시스템을 삭제하지 않는다.

설비에 연결했다는 이유로 Task의 task-system row를 자동 생성하지 않는다. MCS 조율 관계를 Gantt predecessor/successor로 바꾸지 않는다. 일정 의존성은 기존 links와 Scheduling Engine이 관리한다. 물류 관계는 schedule/calendar/progress/공수와 독립된 메타데이터다.

## 6. SQLite 무결성·삭제·revision

Local endpoint는 `UNIQUE(project_id,id)`를 만들고 child의 `(project_id,endpoint_id)`가 이를 참조하게 한다. API 필터만으로 Project 격리를 대신하지 않는다. 관계마다 prepared statement와 서버 allowlist를 사용한다.

기본 형태는 아래와 같다. 이는 특정 migration 번호의 실행 코드가 아니라 구현 검토용 패턴이다.

```sql
-- endpoint에는 UNIQUE(project_id,id)가 존재해야 한다.
FOREIGN KEY (project_id, equipment_id)
  REFERENCES project_equipment(project_id, id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
```

각 local 자식/관계 row는 Project FK에 ON DELETE CASCADE를 둔다. 개별 마스터 endpoint의 deferred NO ACTION은 참조 중 단독 삭제를 막으면서 Project 삭제 transaction에서 전체 자식 제거를 허용한다. 즉시 RESTRICT 때문에 aggregate cascade가 실패하지 않는지 검증한다. Task 연결의 Task FK는 ON DELETE CASCADE, global Resource FK는 ON DELETE RESTRICT다. global Resource에는 Project cascade를 걸지 않는다.

primary invariant는 로컬 컬럼 CHECK와 부분 UNIQUE index로 구현한다.

```sql
CREATE UNIQUE INDEX equipment_one_primary_owner
  ON equipment_resource_roles(project_id, equipment_id)
  WHERE is_primary = 1;
-- role CHECK와 is_primary => role='owner' CHECK가 함께 필요하다.
```

시스템 PI와 설비 primary control에도 같은 방식의 인덱스를 적용한다. 부분 index의 WHERE에서 다른 테이블 상태(active 등)를 참조하지 않는다. 리소스 활성 상태, 타입·layer, 사이클, Summary-only scope는 Service에서 검증한다. primary 교체는 row 업데이트 순서에 따라 충돌하지 않도록 대상 collection을 한 transaction에서 검증·교체한다.

보호 mutation은 기존 edit session/Origin/strong If-Match와 `BEGIN IMMEDIATE`를 사용한다. 프로젝트 변경은 실제 변경 시 revision을 정확히 1회 증가시킨다. Resource를 새로 선택·교체하는 요청은 catalogRevision도 요구하고 같은 transaction에서 검사한다. 권한/참조/계산/SQL 어느 단계든 실패하면 전체 rollback. 동기 transaction 안에서 await/파일/네트워크 I/O를 수행하지 않는다.

마스터의 기본 제거는 active=false다. 관계·진척·Task는 보존한다. 연결된 마스터의 hard-delete는 409와 안전한 영향 건수로 거부한다. 비활성화가 자식 전체를 몰래 비활성화하거나 프로젝트 지표에서 미완료 작업을 없애서는 안 된다.

## 7. API·canonical 계약 제안

기존 Route Handler → Service → Repository → SQLite 경계를 유지한다. 아래 경로는 최초 LG 설계 당시 제안이며 현재 동작 여부·정확한 경로는 [API](API.md)의 구현 계약을 따른다.

| 경로 | 목적 |
| --- | --- |
| /api/projects/{publicId}/logistics | Project 물류 snapshot 조회 |
| .../logistics/processes, equipment, systems | collection GET/POST, 개별 PATCH/DELETE |
| .../logistics/equipment/{equipmentId}/systems | 제어 collection GET/PUT |
| .../logistics/systems/{systemId}/processes | 공정 범위 collection GET/PUT |
| .../logistics/systems/{systemId}/children | 조율 관계 collection GET/PUT |
| .../logistics/equipment/{equipmentId}/roles | Resource 역할 GET/PUT |
| .../logistics/systems/{systemId}/roles | PI/개발자 GET/PUT |
| /api/projects/{publicId}/tasks/{taskId}/logistics-links | Task 설비·시스템 collection GET/PUT |
| /api/projects/{publicId}/logistics/dashboard | 서버 집계 조회 |

시스템 scope와 process 목록은 유효하지 않은 중간상태를 만들지 않도록 하나의 atomic command로 변경한다. 정확한 DTO·collection limits·HTTP 오류 코드는 구현 PR에서 API 문서에 고정한다. scope/cycle/duplicate/cross-project는 validation 오류, 사용 중 삭제는409, Project revision 누락428/불일치412를 유지한다. catalog stale은 기존 assignment 오류 계약을 재사용하고 임의 새로운 성공 처리를 만들지 않는다.

기존 canonical Project snapshot과 Project/Task/assignment mutation 응답에 `logistics` aggregate를 일관되게 확장한다. 실제 서버 응답은 빈 프로젝트에서도 빈 collection을 반환하며, 클라이언트의 오래된 fixture 호환을 위한 optional 타입을 서버 누락 허용 정책으로 바꾸지 않는다. 다른 mutation에서 물류 데이터가 사라지거나 별도 stale state로 덮이지 않게 한다.

한 저장 버튼으로 Task 일정/기존 assignment/새 연결을 함께 저장한다면 하나의 atomic command여야 한다. 여러 independent HTTP 요청 중 하나만 실패했는데 전체 저장 성공으로 표시하는 방식은 금지한다. 별도 저장 action을 쓰는 대안은 각각의 변경 범위와 성공 상태를 UI에서 명확히 구분해야 한다.

신규 POST의 응답이 유실되면 성공 여부를 추측하지 않고 canonical ID/code를 조회한다. 자동 재POST로 중복 생성하지 않는다. Public ID는 접근권한 secret이 아니다. 보호 동작을 URL token이나 client의 readonly flag로 대체하지 않는다.

## 8. 화면·보안 경계

Workspace는 기존 `일정`/`리소스`에 `물류 구성`/`대시보드` 보기를 추가한다. Gantt 패널 mount와 scroll/tree/column/scale/selection을 보존한다. 넓은 화면의 공정 탐색+목록+상세를 좁은 화면에서는 순차 탐색/패널로 전환한다. 새 패널을 기존 Gantt 옆에 강제로 배치해 작업 폭을 줄이지 않는다.

Task Editor에는 관련 설비/시스템, 직접·하위 적용, 출처와 연결된 사람의 역할을 표시한다. 사람 역할 목록은 기존 '작업 투입 리소스/투입률'과 별도로 표시한다. Grid 관계 열은 선택 가능하고 기본 이름 인라인 편집을 침범하지 않는다.

Readonly/edit, loading/empty/no-result/error, dirty draft/취소, 401/403/412, focus/Escape/return, 390/768/1024/1440px를 정의하고 테스트한다. 현재 스타일·semantic token과 [UI 가이드](UI_UX_GUIDELINES.md)를 따른다. 실제 브라우저 증거 없이 UX PASS를 주장하지 않는다.

현재 Project direct read와 같은 범위의 물류 조회를 전제로 한다. 이 공개 범위가 조직 보안 정책에 맞는지 배포 owner가 확인해야 한다. 신규 API가 전체 global catalog 후보나 다른 Project 목록을 덤프해서는 안 된다. Project에 연결된 개인의 필요한 표시정보만 노출하고 연락처·전화번호·이메일을 추가하지 않는다. 실장비 IP/계정/토큰/접속 비밀·PLC 제어 명령은 저장 대상이 아니다. 공개 GitHub 예제에는 합성 code/name만 사용한다.

## 9. 복사·교환·단계적 배포

초기 LG-01부터 LG-06 도입 전까지 물류 Project 복사는 명시적인409 `LOGISTICS_COPY_NOT_SUPPORTED_YET`로 차단했다. 현재는 전체 물류 Copy·versioned Template 참조 remap을 지원한다. 물류 없는 기존 Project 복사는 유지한다. 복사된 것처럼 보이지만 물류만 누락된 결과를 만들지 않는다.

완전 복사는 새 local ID 매핑으로 공정/WBS/설비/시스템/모든 관계를 원자 복사하고 global Resource ID는 유지한다. inactive와 self/subtree도 보존한다. resetProgress는 기존 계약을 따르고 Summary 재계산을 수행한다. Project 삭제는 global catalog를 보존한다.

Excel은 선택적 물류 보고용 sheet를 추가하고 직접/파생, code/public ID, 계산 기준/revision을 구별한다. 기존 일정 export를 무손실 Project backup이라고 부르지 않는다. [#30](https://github.com/planner77/masterGantt/issues/30)의 제안 Import2.0을 이번 작업이 독자 확정하지 않는다. 기존 schema 의미를 유지하고 미지원 물류 필드/버전은 명시 오류로 처리한다. 물류 VBA/bulk import는 별도 승인된 후속 범위다.

## 10. 초기 범위와 향후 결정

초기 범위는 구축 계획 관리다. 실시간 설비 관제, 장애 이벤트, PLC/ACS/MCS 명령 송신, 공급사 SLA, 실제 검수 증빙/승인, baseline·실제 완료일·변경 이력, 효과일별 역할 이력, cross-project 설비 재사용, fleet 구성원 추적은 포함하지 않는다. 필요해지면 기존 데이터를 왜곡해 흉내 내지 않고 추가 요구·모델·지표를 별도 설계한다.

안전한 기본안은 대표 책임자 최대1+공동 담당, 설비별 주 관리 공정1, Summary 하위 적용 opt-in이다. 현장의 공동 책임 정책/이동 설비 관리단위/시스템 역할이 이 기본안과 맞지 않으면 LG-01/LG-02 착수 전에 DECISION_REQUIRED로 남기고 schema와 AC를 함께 조정한다. 등록 자체를 막는 미정사항으로 숨기지 않는다.

## 11. 공식 자료와 확인 수준

- [SVAR Willow demo](https://docs.svar.dev/react/gantt/samples/#/base/willow)
- [SVAR Editor: custom controls/custom form/readonly](https://docs.svar.dev/react/gantt/guides/ui-layout/editor/)
- [SVAR columns API](https://docs.svar.dev/react/gantt/api/properties/columns/)
- [SQLite Foreign Keys](https://www.sqlite.org/foreignkeys.html)
- [SQLite Partial Indexes](https://www.sqlite.org/partialindex.html)

2026-09-26 URL·공식 문서·관련 sample 링크를 조회했다. SPA의 실제 조작/캡처와 설치2.7.3 runtime 검증은 수행하지 않았다. 온라인 Editor 예제의 확장 방식은 참조하되 설치 패키지 API와 Core/PRO 경계를 다시 확인한다. 온라인 기본 Resources tab은 Summary에서 숨겨진다고 설명되어 있어, 3종 Task의 물류 연결을 그것에 의존하지 않고 masterGantt 자체 편집 영역으로 설계했다. 공식 문서 조회를 라이브러리 업그레이드 승인으로 해석하지 않는다.

## 관리형 물류 유형 카탈로그 (Issue #280)

설비 `equipment_type`과 시스템 `system_type`은 전 프로젝트 공통 글로벌 카탈로그의 stable `code`를 저장 기준으로 사용하고 사용자 화면은 `name`을 표시한다.

- 신규/변경 선택에는 `active = 1` 유형만 허용한다.
- 기존 엔티티가 비활성 유형을 사용 중이면 참조와 표시는 유지하며 다른 필드 수정도 허용한다.
- 사용 중인 유형의 code는 변경/삭제하지 않고 활성/비활성 lifecycle을 사용한다.
- Project Copy/Template/Task Logistics Link/Dashboard/Export는 stable type code를 보존한다.
- migration 0015는 기존 12개 code를 seed하고 기존 물류 row의 type 값을 보존한 채 fixed `CHECK IN (...)`을 catalog FK로 전환한다.

## Issue #288 Developer grade 확장

시스템의 PI/Developer 역할은 계속 기존 global Resource를 참조한다. 별도 Developer master나 `resourceType`은 추가하지 않는다. Resource의 전역 메타데이터 `developerGrade`를 역할 관계와 조합하며, 신규 Developer 역할은 등급 지정 Resource만 허용한다. 기존 미지정 Developer 역할은 migration 호환을 위해 보존할 수 있고 UI에서 `등급 미지정`으로 식별한다. 역할 해제와 Task assignment는 전역 등급을 변경하지 않는다.

## Issue #345: 빈 컨테이너의 연결

Summary는 자손 0개여도 `self/subtree` 연결을 그대로 보존한다. 마지막 자식 삭제·이동은 부모 연결의 scope를 바꾸거나 삭제하지 않으며 나중에 추가되는 실제 자손은 기존 ancestor subtree 상속 규칙을 적용받는다. 미산정 Summary는 날짜 있는 Leaf로 취급하지 않는다. 명시적으로 Summary 자체를 삭제할 때만 그 row의 직접 연결이 기존 FK 삭제 계약을 따른다.

## Issue #617 — WBS–Target 연결과 단일 해석기

F3는 Target/member를 Task/Summary에 whole/subset 및 self/subtree로 연결한다. 모든 Summary 조상의 subtree와 직접 연결을 합집합으로 읽으며 하위 명시는 조상을 대체하지 않는다. Project-local UUID와 typed member 소유를 저장 경계에서 검증하고 effective instance dedup 뒤에도 모든 Target 경로와 legacy 직접 연결 출처를 보존한다. 공유 System 직접 연결만으로 Target을 추론하지 않는다. Equipment coverage는 연결의 작업 수량이고 instance quantity와 Resource 공수 원장을 변경하지 않는다.

[LOGISTICS_TARGETS](LOGISTICS_TARGETS.md)의 F3 절 및 [API](API.md)/[DB_SCHEMA](DB_SCHEMA.md)가 신규 runtime 계약이다. 모든 후속 보기/Resource 계산은 같은 pure resolver를 재사용하며 별도 화면 해석기를 만들지 않는다. 현재 물류 Dashboard/Resource KPI의 기존 필터·분모를 조용히 Target 축으로 확대하지 않는다. Target UI/Resource 축은 #618/#619 이후, 이번 원격 CI·운영 적용 증거는 [#617 Work Packet](exec-plans/active/ISSUE_617.md)에서 별도로 판정한다.

## Issue #719 — 물류 화면 설명과 선행 조건

물류 구성 소개·빈 목록의 생성 학습문구와 관련 Milestone의 상세 정의는 인접 도움말로 이동한다. `Gantt WBS와 독립`, 조회의 평가일·환산·전체 소속/직접 선행 기준 및 물류 KPI 범위 불변은 직접 유지한다. 공정 없는 설비 추가는 mutation 없이 지속 오류로 선행 조건을 알린다.

공유 Target/원본의 수정 영향, 연결 해제와 원본 삭제의 구별, 사용 중 삭제 제한, Primary 역할 제약·readonly·401/412/stale·초안/pending 계약은 기존 UI에 직접 남는다. Domain/API/DB·통합 조회 집계·원본 연결은 변경하지 않는다. [실행 원장](exec-plans/active/ISSUE_719.md)을 따른다.
