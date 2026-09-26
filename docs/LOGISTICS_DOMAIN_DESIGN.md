# 물류 구축 프로젝트 도메인 설계

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

code는 trim 후 빈 값 불가, 프로젝트·entity 종류별 UNIQUE, 대소문자 구분이다. name은 표시명이며 유일키가 아니다. 초기 제안 상한은 code 64자, name 200자, 설명 4000 Unicode code points이며 기존 공통 validator와의 일관성을 구현 때 확정한다. 사용자 문자열을 SQL 구조나 HTML로 직접 삽입하지 않는다.

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

기존 Route Handler → Service → Repository → SQLite 경계를 유지한다. 아래 경로는 구현 예정이며 아직 동작하는 API가 아니다.

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

LG-01부터 물류 데이터가 있는 Project의 기존 복사는 LG-06이 준비될 때까지 명시적인409 `LOGISTICS_COPY_NOT_SUPPORTED_YET`로 차단한다. 물류 없는 기존 Project 복사는 유지한다. 복사된 것처럼 보이지만 물류만 누락된 결과를 만들지 않는다.

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
