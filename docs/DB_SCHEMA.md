# Database Schema

## 1. 문서 상태와 범위

이 문서는 SQLite 논리 모델과 영속성 규칙을 정의한다. W02 SQLite Foundation은 **구현 완료 / 독립 QA PASS / Manager ACCEPT**이며 최초 schema는 `db/migrations/0001_initial_schema.sql`에 있다. W04는 Project와 최초 edit session insert를, W05는 credential/session과 보호 Project 변경을, W07은 Project-scoped Task CRUD와 Link Repository CRUD foundation을 구현했다. W06은 pure Scheduling Domain이다. W04–W07은 기존 `0001` schema를 사용했고, Issue #36에서 Task Description/URL용 `0002_task_description_url.sql`, Issue #19에서 글로벌 Resource/Group 및 Task assignment용 `0003_resource_catalog.sql`, Issue #54에서 Project 표시용 Owner를 위한 `0004_project_owner.sql`을 추가했다. Issue #56에서 Resource 계획 투입 기간/투입률과 workload 조회 index를 위한 `0005_resource_workload.sql`을 추가했고, Issue #57에서 국가·조직·개인 작업 캘린더와 기존 휴일 호환 이관을 위한 `0006_work_calendars.sql`을 추가했다. Issue #99에서 리소스 관리자 런타임 자격증명 해시를 위한 `0007_resource_admin_credentials.sql`을 추가했다. Issue #138에서 Project 상태를 위한 `0008_project_status.sql`을 추가했다. Issue #184에서 물류 도메인 공정·설비·제어/조율 시스템 기초 영속 모델을 위한 `0009_logistics_domain.sql`을 추가한다. Issue #195에서 프로젝트 템플릿 등록·관리 및 템플릿 기반 인스턴스화를 위한 `0012_project_templates.sql`을 추가한다. Issue #200에서 관계 유형(FS/SS/FF/SF) 및 Lag 지원을 위한 `0013_link_types_and_lag.sql`을 추가한다. Issue #202에서 기준 일정(Baseline) 영속화를 위한 `0014_task_baseline.sql`을 추가한다. [W07 검증](W07_REVIEW.md) 이후 schema 변경도 이 문서와 `db/migrations/**`를 같은 변경 단위로 갱신한다.

요구사항으로 확정된 전제는 다음과 같다.

- Database는 SQLite이고 Prisma를 사용하지 않는다.
- 접근 경계는 `Route Handler → Service → Repository → SQLite`이다.
- 일정 계산은 별도 Scheduling Domain Engine이 담당하며 Repository는 계산하지 않는다.
- SQLite 단계의 배포는 단일 Application Instance이다.

초기 Manager 결정은 Node.js runtime과 `better-sqlite3` driver, Project 외부 식별자의 canonical lowercase UUID v4, Project aggregate revision 방식이다. UUID는 Node.js `crypto.randomUUID()`로 생성한다. Library/runtime version과 native build matrix는 설치 시 공식 호환성을 확인한 뒤 고정한다.

## 2. 데이터 접근 원칙

Route Handler는 HTTP 변환과 인증 context 전달만 담당한다. Service는 권한, optimistic concurrency, business validation, Scheduling Engine 호출, transaction 경계를 조정한다. Repository만 SQL을 소유한다.

모든 값은 prepared statement의 parameter binding으로 전달한다. Table명, column명, 정렬 식 같은 SQL 구조 요소는 server-side allowlist에서만 선택하며 사용자 입력을 연결해 SQL을 만들지 않는다.

SQLite foreign key는 connection마다 명시적으로 활성화해야 하므로 process 시작 시 `PRAGMA foreign_keys = ON`을 실행하고 결과가 `1`인지 확인한다. 시작 검증 실패 시 server를 ready 상태로 만들지 않는다.

## 3. 공통 표현

| 대상 | 저장 형식 | 규칙 |
|---|---|---|
| 내부 PK | `INTEGER` | SQLite row 식별용이며 API에 노출하지 않는다. |
| Public ID | `TEXT` | UUID canonical lowercase 문자열, 생성 후 변경하지 않는다. |
| Domain date | `TEXT` | `YYYY-MM-DD`, project timezone 기준의 달력 날짜이다. |
| Timestamp | `TEXT` | UTC ISO 8601 instant, 예: `2026-09-10T01:23:45.678Z`. |
| Boolean | `INTEGER` | 필요한 경우 `0` 또는 `1` CHECK를 둔다. |
| Password material | `BLOB` | salt와 derived key만 저장하며 원문은 저장하지 않는다. |
| Session token | `BLOB` | token 원문 대신 SHA-256 digest만 저장한다. |

SQLite CHECK만으로 실재하는 달력 날짜를 완전히 판별하지 않는다. Zod/API 검증과 Scheduling Domain 검증을 통과한 값만 Repository에 전달한다.

## 4. 관계 개요

```text
projects
  ├─< work_calendar_rules ──< work_calendar_dates
  ├─< tasks ──(self parent)──> tasks
  │      ├─< links >─┘
  │      └─< task_assignments >─ resources / resource_groups
  ├─< edit_sessions
  ├─< project_processes ──(self parent)──> project_processes
  │      ├─< project_equipment ──< project_equipment_systems >── project_logistics_systems
  │      └─< project_system_processes >─────────────────────────────┘
  └─< project_logistics_systems ──< project_system_links >── project_logistics_systems

project_holidays (0006 이후 Project NON_WORKING 호환 VIEW + INSERT trigger)
resource_catalog_state (singleton revision)
resources >─< resource_group_members >─ resource_groups
resource_catalog_admin_sessions (global admin sessions)
resource_catalog_admin_credentials (singleton global admin credential)
```

`project_id`는 단순 조회 filter가 아니라 isolation 경계이다. Task parent와 Link 양 끝, Process 계층, Equipment-Process 관계, System 연계 양 끝은 composite foreign key로 같은 Project에 속함을 DB에서도 강제한다.

## 5. Tables

### 5.1 `projects`

| Column | Type | Null | Constraint / 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | Primary key |
| `public_id` | TEXT | N | UNIQUE, immutable UUID v4 |
| `name` | TEXT | N | trim 후 빈 문자열 불가, 길이는 API 정책으로 제한 |
| `description` | TEXT | N | 기본값 빈 문자열 |
| `status` | TEXT | N | `planned`(예정), `in_progress`(진행 중), `completed`(완료)만 허용; DB 기본값 `planned` |
| `owner_name` | TEXT | Y | Issue #54 표시용 Owner. 새 HTTP 생성/복사는 trim 후 Unicode code point 1–100자를 요구하며, 기존 Project는 NULL 허용 |
| `password_kdf` | TEXT | N | 초기값 `scrypt` |
| `password_salt` | BLOB | N | project별 cryptographic random salt |
| `password_hash` | BLOB | N | scrypt derived key |
| `scrypt_n` | INTEGER | N | 사용한 cost parameter |
| `scrypt_r` | INTEGER | N | 사용한 block size |
| `scrypt_p` | INTEGER | N | 사용한 parallelization |
| `scrypt_key_length` | INTEGER | N | derived key byte 길이 |
| `auth_version` | INTEGER | N | password 변경 시 증가, 기존 session 무효화 기준 |
| `calendar_timezone` | TEXT | N | 초기값 및 v1 지원값 `Asia/Seoul` |
| `revision` | INTEGER | N | Project aggregate optimistic concurrency version, 1부터 시작 |
| `created_at` | TEXT | N | UTC timestamp |
| `updated_at` | TEXT | N | UTC timestamp |

`owner_name`은 인증 또는 권한 주체가 아니라 사용자에게 표시하는 Project 메타데이터다. `0004_project_owner.sql`은 기존 데이터 호환을 위해 NULL을 허용하며, non-NULL 값은 trim된 1–100자만 허용한다. 신규 HTTP 생성/복사는 API 계층에서 Owner를 필수로 검증하고 Project row 및 최초 edit session과 같은 write transaction 안에서 저장한다. 향후 사용자/조직 식별자를 도입하더라도 현재 문자열은 표시명 역할로 분리한다.

`0008_project_status.sql`은 `status`를 `NOT NULL DEFAULT 'planned'`와 세 값만 허용하는 `CHECK`로 추가한 뒤, 이미 저장된 Project row를 같은 migration transaction에서 `in_progress`로 일괄 이관한다. 기존 row의 revision, 일정, 인증 자료는 변경하지 않는다. 이후 생성되는 Project와 복사본은 `planned`를 저장하며, Project status 변경은 다른 metadata 변경과 마찬가지로 검증된 edit session과 현재 revision을 확인한 한 transaction에서 revision을 정확히 한 번 증가시킨다. 목록 조회는 모든 상태를 반환하며 기본 표시 필터는 UI에서 적용한다.

Password parameter를 row와 함께 저장해 향후 cost 변경 후에도 기존 hash를 검증하고 성공 시 재해시할 수 있게 한다. `public_id`는 접근 편의를 위한 주소이지 authorization secret이 아니다.

### 5.2 `project_holidays` 호환 VIEW

`0006_work_calendars.sql` 적용 전에는 Project별 holiday table이었다. 0006은 기존 row를 `work_calendar_rules(kind=CUSTOM,target_type=PROJECT)`와 `work_calendar_dates(day_type=NON_WORKING)`로 **손실 없이 이관한 뒤 원본 table을 제거**한다.

이후 같은 이름은 단계적 하위 호환을 위한 VIEW다. Project 대상 `NON_WORKING` 날짜를 날짜별로 한 번만 투영하며, 기존 focused test/legacy repository의 INSERT는 INSTEAD OF trigger가 `legacy-project-<project_id>` Custom rule/date로 변환한다. 신규 기능은 이 VIEW를 authority로 사용하지 않고 `work_calendar_rules/work_calendar_dates`를 직접 조회한다.


### 5.3 `tasks`

| Column | Type | Null | Constraint / 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | Primary key |
| `project_id` | INTEGER | N | FK → `projects.id` ON DELETE CASCADE |
| `external_id` | TEXT | N | Project 안에서 UNIQUE, API/import의 안정 식별자 |
| `public_id` | TEXT | N | UNIQUE UUID v4, API CRUD의 taskId; externalId와 독립 |
| `name` | TEXT | N | trim 후 빈 문자열 불가 |
| `description` | TEXT | Y | 작업 다중 행 설명, 공백-only 입력은 API에서 NULL 정규화 |
| `url` | TEXT | Y | 작업 링크. API에서 `http:`/`https:`만 허용 |
| `type` | TEXT | N | `task`, `summary`, `milestone` CHECK |
| `schedule_mode` | TEXT | N | `auto`, `manual` CHECK; summary는 항상 auto로 정규화, 날짜는 파생 |
| `requested_start` | TEXT | Y | leaf의 사용자 요청 시작일; summary는 NULL |
| `start_date` | TEXT | Y | 일정 산정 Summary/Leaf의 effective start, 미산정 Summary만 NULL (0018) |
| `end_date` | TEXT | Y | inclusive effective end, 미산정 Summary만 NULL (0018) |
| `duration` | INTEGER | Y | working-day 단위, 미산정 Summary만 NULL; 0은 Milestone 등 실제 계산값 |
| `progress` | REAL | Y | finite 0..100, 미산정 Summary만 NULL; 완료나 0%로 해석하지 않음 |
| `parent_id` | INTEGER | Y | 같은 Project의 summary task만 허용 |
| `sort_order` | INTEGER | N | 같은 parent 아래 sibling의 안정적인 순서, 0 이상 |
| `baseline_start` | TEXT | Y | 기준 일정 시작일 (ISO date YYYY-MM-DD); 미설정 시 NULL (0014 추가) |
| `baseline_duration` | INTEGER | Y | 기준 일정 근무일 기간; 미설정 시 NULL, 마일스톤은 0 (0014 추가) |
| `baseline_end` | TEXT | Y | 기준 일정 종료일 (ISO date YYYY-MM-DD); 미설정 시 NULL (0014 추가) |
| `created_at` | TEXT | N | UTC timestamp |
| `updated_at` | TEXT | N | UTC timestamp |

다음 unique key와 composite foreign key를 둔다.

```text
UNIQUE(project_id, id)
UNIQUE(project_id, external_id)
FOREIGN KEY(project_id, parent_id)
  REFERENCES tasks(project_id, id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
```

`parent_id IS NULL`인 root task도 허용한다. Parent가 summary인지, hierarchy cycle이 없는지는 cross-row domain invariant이므로 Service/Scheduling Engine에서 검증한다. Deferred `NO ACTION`은 일반 parent 단독 삭제를 transaction commit에서 거부하면서 Project aggregate 삭제 시 Project cascade가 전체 task hierarchy를 함께 제거할 수 있게 한다. Project 삭제 API는 이 cascade를 `IMMEDIATE` transaction에서 사용한다.

Issue #300: Grid DnD와 Context Menu의 기존 hierarchy command는 parent별 sibling `sort_order`를 `0..N-1`로 정규화한다. Parent 변경은 이전 family와 새 family를 같은 transaction에서 저장한다. Task 이름 및 다른 비구조 필드 PATCH는 `parent_id/sort_order`를 갱신하지 않으며 재조회 canonical DTO의 `parentExternalId/siblingOrder`는 저장된 관계/순서를 유지한다. 기존 column·constraint·index를 재사용하므로 schema 변경과 신규 migration은 N/A다.

일정 column의 의미는 다음과 같다.

- API/import의 `start`는 요청 시작일이며 `requested_start`에 보존한다.
- `start_date`와 `end_date`는 dependency/calendar 적용 후 계산된 값이다.
- Leaf task는 `start + duration`을 canonical source로 삼고 end를 도출한다.
- 입력에 end가 함께 있으면 dependency shift 전, calendar로 정규화한 requested start와 duration으로 얻은 canonical end와 일치해야 한다.
- Auto task의 requested start가 비근무일이면 다음 근무일로 이동하고 warning을 반환한다.
- Manual task의 비근무일 시작 또는 FS 위반은 변경 전체를 거부한다.
- Milestone은 duration 0이고 `start_date = end_date`이다.
- Summary의 requested start는 NULL이고 날짜, duration, progress는 자식으로부터 계산한 파생값이다. Import가 summary snapshot을 제공해도 비교/preview용일 뿐 저장 계산의 authority가 아니다.
- Summary span duration은 모든 descendant leaf의 최소 start부터 최대 end까지의 working-day 수이며 자식 duration의 합이 아니다.
- 빈 Summary와 빈 Summary만 중첩된 구조를 최종 snapshot에서 허용한다. Parent가 될 수 있는 type은 summary뿐이다.
- `baseline_start`, `baseline_duration`, `baseline_end`(0014)는 프로젝트 계획 기준점(Baseline) 일정이다.
  - Leaf 작업(일반 작업, 마일스톤)은 사용자가 직접 지정하거나 현재 일정에서 복사해 저장할 수 있다.
  - Summary 작업의 baseline은 모든 하위 자손(leaf)에 baseline이 존재할 때만 자손들로부터 파생(`min(baseline_start)`, `max(baseline_end)`, `workingDaysBetween`)된다. 실제 Task/Milestone 자손 중 하나라도 baseline이 없으면 Summary baseline은 NULL이다. 빈 Summary는 baseline 완비성에서 중립이고 실제 Leaf가 하나도 없으면 파생 Summary baseline은 NULL이다. Summary baseline의 직접 수동 수정은 허용되지 않는다(`SummaryScheduleReadonlyError`).

이 규칙은 DB trigger로 중복 구현하지 않고 Scheduling Engine을 단일 계산 소스로 사용한다. 저장 직전 Service가 전체 aggregate 결과를 검증한다.

최종 persisted snapshot의 미산정 Summary는 `start_date/end_date/duration/progress`를 모두 NULL로 저장한다. 부분 NULL이나 불완전 Leaf row는 DB에 넣지 않는다. 일반 task duration은 1..10000, milestone은 0이다. Summary duration은 descendant 전체 span의 계산 결과이므로 일반 task의 10000 제한을 적용하지 않고 Scheduling Engine의 지원 date range로 제한한다. Progress는 `100/3` 같은 파생값을 보존하도록 REAL을 사용하고 UI 표시 단계 전에는 반올림하지 않는다. Service는 `NaN`/무한대를 거부한다.

### 5.4 `links`

`links`는 task dependency를 저장한다. 방향은 `predecessor_task_id → successor_task_id`이다.

| Column | Type | Null | Constraint / 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | Primary key |
| `public_id` | TEXT | N | UNIQUE UUID v4, API 식별자 |
| `project_id` | INTEGER | N | FK → `projects.id` ON DELETE CASCADE |
| `predecessor_task_id` | INTEGER | N | 같은 Project의 predecessor |
| `successor_task_id` | INTEGER | N | 같은 Project의 successor |
| `type` | TEXT | N | `FS`, `SS`, `FF`, `SF` 허용 (기본값 `FS`) |
| `lag` | INTEGER | N | 근무일 단위 정수 `-10000..10000` (기본값 `0`) |
| `created_at` | TEXT | N | UTC timestamp |
| `updated_at` | TEXT | N | UTC timestamp |

다음을 강제한다.

```text
CHECK(predecessor_task_id <> successor_task_id)
CHECK(type IN ('FS', 'SS', 'FF', 'SF'))
CHECK(lag BETWEEN -10000 AND 10000)
UNIQUE(project_id, predecessor_task_id, successor_task_id)
FOREIGN KEY(project_id, predecessor_task_id)
  REFERENCES tasks(project_id, id) ON DELETE CASCADE
FOREIGN KEY(project_id, successor_task_id)
  REFERENCES tasks(project_id, id) ON DELETE CASCADE
```

Dependency endpoint는 leaf task 또는 milestone만 허용하고 summary endpoint는 거부한다. Circular dependency는 graph 검증이 필요하므로 Scheduling Engine이 탐지한다. 의존성 종류(FS/SS/FF/SF)와 Lag(근무일수)에 따라 후행 작업의 시작일 하한선(earliest successor start)이 스케줄링 엔진에 의해 동적으로 계산된다.

### 5.5 `edit_sessions`

| Column | Type | Null | Constraint / 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | Primary key |
| `project_id` | INTEGER | N | FK → `projects.id` ON DELETE CASCADE |
| `token_hash` | BLOB | N | UNIQUE, random session token의 SHA-256 digest |
| `auth_version` | INTEGER | N | 발급 당시 Project auth version |
| `created_at` | TEXT | N | UTC timestamp |
| `expires_at` | TEXT | N | absolute expiry |
| `last_used_at` | TEXT | Y | 관측/정리용; 매 요청 갱신은 하지 않아도 됨 |
| `revoked_at` | TEXT | Y | logout 또는 강제 revoke 시각 |

유효 session 조건은 token digest 일치, 올바른 `project_id`, `revoked_at IS NULL`, `expires_at > now`, `edit_sessions.auth_version = projects.auth_version`를 모두 만족하는 것이다. Token 원문은 DB나 log에 저장하지 않는다.

Session current read는 row나 TTL을 갱신하지 않는다. Unlock과 password rotation lifecycle에서 `revoked_at IS NOT NULL OR expires_at <= now`인 row를 ID 순서로 한 transaction당 최대 100개 삭제한다. 이는 table 전체 cleanup을 request path에서 수행하지 않기 위한 bounded maintenance이며 운영 retention/incident cleanup을 대신하지 않는다.

### 5.6 `resource_catalog_state`

글로벌 Resource/Group catalog의 optimistic concurrency를 위한 singleton row다. `id=1`, `revision>=1`, `updated_at`을 저장하며 Resource/Group/Group member 실제 변경 transaction에서만 revision을 증가시킨다.

### 5.7 `resources` / `resource_groups`

두 테이블은 내부 INTEGER PK와 외부 UUID `public_id`, 필수 `name`, optional unique `code`, `description`, `active`, 생성/수정 시각을 저장한다. `active=0`은 신규 할당 후보에서 제외하지만 기존 assignment는 유지한다. 운영 중 제거는 비활성화를 기본 정책으로 사용한다.

Issue #329부터 Resource Catalog 관리자만 **모든 Project-scoped 참조가 0인 대상**을 영구 삭제할 수 있다. Resource는 `task_assignments`, `project_equipment_resource_roles`, `project_system_resource_roles`, Resource 대상 `work_calendar_rules`를, Group은 `task_assignments`와 Resource Group 대상 `work_calendar_rules`를 모두 검사한다. 삭제 mutation은 SQLite `IMMEDIATE` transaction 안에서 usage를 다시 계산한 뒤 `resource_group_members`만 먼저 정리하고 대상 row를 삭제하며 catalog revision을 정확히 1 증가시킨다. 반대편 Group/Resource row는 삭제하지 않는다. 기존 `RESTRICT/NO ACTION` FK는 서버 usage 판정 누락이나 race를 막는 최종 fail-closed 방어선으로 유지한다. 이 기능은 기존 schema만 사용하므로 신규 migration은 필요하지 않는다.

### 5.8 `resource_group_members`

`(group_id, resource_id)` 복합 PK로 그룹 멤버 중복을 방지한다. Resource와 Group FK는 모두 `ON DELETE RESTRICT`이며 그룹은 중첩하지 않는다. 한 Resource는 여러 Group에 속할 수 있다.

### 5.9 `resource_catalog_admin_sessions`

글로벌 catalog 관리자 세션을 Project edit session과 분리한다. 원문 token은 저장하지 않고 32-byte SHA-256 digest와 생성/만료/폐기 시각만 저장한다.

### 5.10 `resource_catalog_admin_credentials`

Resource catalog 관리자 비밀번호의 런타임 변경값을 저장하는 singleton credential table이다.

| Column | Type | Null | Constraint / 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | Primary key, `CHECK(id = 1)`로 singleton 강제 |
| `password_kdf` | TEXT | N | 현재 `scrypt`만 허용 |
| `password_salt` | BLOB | N | 최소 16-byte random salt |
| `password_hash` | BLOB | N | 32-byte scrypt derived key |
| `updated_at` | TEXT | N | 마지막 seed/rotation UTC timestamp |

비밀번호 원문은 저장하지 않는다. 테이블이 비어 있는 최초 실행/업그레이드 상태에서만 `RESOURCE_CATALOG_ADMIN_PASSWORD`를 bootstrap seed로 사용할 수 있으며, 정상 인증 후 salt/hash를 이 table에 저장한다. 신규 seed는 1~12 Unicode code point를 사용하고, 이전 정책에서 유효했던 16자 이상 값은 bounded legacy bootstrap 경로에서만 허용한다. credential row가 생성된 뒤에는 DB 값이 환경변수보다 우선한다. 비밀번호 rotation은 singleton row를 upsert하고 기존 Resource 관리자 session을 모두 revoke한 뒤 호출자에게 새 session을 발급한다.

### 5.11 `task_assignments`

Task/Summary/Milestone과 글로벌 Resource 또는 Group의 직접 할당을 저장한다. `(project_id, task_id)` composite FK로 Project 경계를 DB에서도 강제하고, `resource_id`와 `group_id`는 XOR CHECK로 정확히 하나만 허용한다. 부분 UNIQUE index로 같은 Task에 같은 Resource/Group의 중복 할당을 차단한다. Task/Project 삭제에는 assignment가 cascade되지만 글로벌 catalog FK는 `ON DELETE RESTRICT`다. Group assignment는 팀 참조이며 Group member 개인 assignment로 자동 확장하지 않는다.

`0005_resource_workload.sql`은 기존 row 호환을 위해 Resource assignment의 `assignment_start`, `assignment_end`, `allocation_percent`를 nullable로 추가한다. 두 날짜는 `YYYY-MM-DD` 길이 제약을 DB에서 두고 실제 Gregorian 날짜 검증은 Scheduling Domain의 `parseDateOnly`가 담당한다. `allocation_percent`는 NULL 또는 `0 < value <= 100`만 허용한다. 기존 NULL allocation은 100%로 추정하지 않고 `공수 미설정`으로 취급한다. Group assignment에는 이 세 필드를 사용하지 않는다. 명시 Resource allocation 기간은 leaf Task의 확정 `start_date/end_date` 안에 있어야 하며 Task 일정 변경도 같은 invariant를 다시 검증해 위반 시 transaction 전체를 rollback한다.

## 6. Index 계획

최소 index는 다음과 같다.

```text
projects(public_id) UNIQUE
tasks(project_id, external_id) UNIQUE
tasks(public_id) UNIQUE
tasks(project_id, parent_id)
tasks(project_id, sort_order)
links(public_id) UNIQUE
links(project_id, predecessor_task_id)
links(project_id, successor_task_id)
project_holidays(project_id, holiday_date) UNIQUE
edit_sessions(token_hash) UNIQUE
edit_sessions(project_id, expires_at)
resource_group_members(resource_id, group_id)
task_assignments(project_id, task_id)
task_assignments(resource_id) WHERE resource_id IS NOT NULL
task_assignments(project_id, resource_id, assignment_start, assignment_end) WHERE resource_id IS NOT NULL
task_assignments(group_id) WHERE group_id IS NOT NULL
resource_catalog_admin_sessions(expires_at, revoked_at)
```

Foreign key child column을 index해 삭제/검증 시 전체 scan을 피한다. 실제 query plan은 대표 Project 크기의 fixture로 확인한 후 추가한다.

## 7. Revision과 동시성

`projects.revision`을 Project schedule aggregate 전체의 version으로 사용한다. Project metadata, calendar, task, link, import 중 하나라도 성공적으로 변경되면 같은 transaction에서 정확히 1 증가시킨다.

Mutation은 client가 보낸 `If-Match` revision과 현재 revision을 transaction 안에서 비교한다. 누락은 `428 PRECONDITION_REQUIRED`, 불일치는 `412 REVISION_MISMATCH`로 처리한다. Scheduling 재계산으로 여러 task가 바뀌어도 하나의 aggregate revision만 증가한다. 이 방식은 row별 revision보다 보수적이지만 작은 Project 편집기에서 lost update와 stale import commit을 단순하게 방지한다.

Project 영구 삭제도 동일한 edit-session과 `If-Match` 검증을 거쳐 `IMMEDIATE` transaction에서 수행한다. `projects` 한 행이 삭제되면 `project_holidays`, `tasks`, `links`, `edit_sessions`의 `ON DELETE CASCADE`가 해당 Project aggregate만 함께 제거한다. Task의 self-reference는 deferred constraint이므로 transaction 종료 시 전체 Project Task가 함께 사라지는 것을 허용한다. Cascade 또는 constraint 처리 중 오류가 나면 Project 삭제 전체가 rollback된다.

## 8. Transaction 경계

다음은 각각 하나의 write transaction이다.

- Project 생성 + `owner_name` 저장 + password hash 저장 + 최초 edit session 발급
- Project 복사 + `owner_name` 저장 + Task/Link/Holiday + 새 edit session 발급
- Project metadata/password/calendar 변경
- Task create/update/delete + dependency validation + 전체 일정 재계산
- Link create/update/delete + 전체 일정 재계산
- Import 전체 validation 결과 저장
- Password 변경 + `auth_version` 증가 + 기존 session 모두 revoke + 호출자 새 session 발급

Service는 transaction 전에 schema parsing과 순수 Scheduling 계산을 준비할 수 있지만, 최종 revision 확인과 영향 row 저장은 하나의 `BEGIN IMMEDIATE` transaction에서 다시 확인한다. Import의 duplicate existing external ID 검증도 transaction 안에서 수행한다. 오류가 발생하면 예외를 전파해 전체 rollback하며 partial import를 만들지 않는다. 신규 Project 생성/복사에서 Owner 저장 또는 session 저장이 실패하는 경우에도 Project row를 포함해 전체 aggregate를 rollback한다.

`better-sqlite3` transaction callback은 synchronous하게 유지하고 내부에서 `await`, network I/O, 파일 I/O를 수행하지 않는다. 외부 작업이 필요한 Excel 생성은 read snapshot을 메모리 DTO로 가져온 뒤 transaction 밖에서 수행한다.

## 9. Connection과 운영 설정

초기 제안은 다음과 같다.

```text
PRAGMA foreign_keys = ON
PRAGMA journal_mode = WAL
PRAGMA synchronous = FULL
PRAGMA busy_timeout = 5000
```

WAL 사용 가능 여부는 실제 persistent volume의 파일 locking과 함께 Docker 검증 대상이다. Database, `-wal`, `-shm` 파일을 동일한 persistent directory에 둔다. Single Application Instance 원칙을 벗어나거나 network filesystem을 사용하려면 SQLite 운영 적합성을 다시 검토한다.

Migration은 순서가 고정된 `NNNN_name.sql` 파일과 별도 `schema_migrations` ledger로 관리한다. 파일 목록을 먼저 읽은 뒤 ledger 생성, 적용 이력 검증, 모든 pending SQL과 ledger insert를 하나의 `BEGIN IMMEDIATE` transaction에서 수행한다. 오류가 하나라도 발생하면 ledger를 포함한 pending 변경 전체를 rollback한다. 적용 이력은 disk migration의 정확한 연속 prefix여야 하며 빈 migration directory, sequence gap, 누락·이름 변경·checksum 변경은 시작을 실패시킨다.

SQL migration은 검토된 repository 코드이며 사용자 입력을 실행하는 경로가 아니다. Transaction 제어는 runner만 담당한다. Migration 파일에 `BEGIN`/`COMMIT`/`ROLLBACK`이나 transaction 밖 작업을 요구하는 운영 명령을 넣지 않는다.

Connection은 import 시 자동으로 열리지 않는다. Production entry가 처음 요청할 때 명시적으로 열며 각 connection에서 `foreign_keys=ON`, `journal_mode=WAL`, `synchronous=FULL`, `busy_timeout=5000`을 설정하고 실제 foreign-key/WAL 상태와 `foreign_key_check` 결과를 검증한다. In-memory test database만 SQLite의 `memory` journal mode를 허용한다.

Production `DATABASE_PATH`는 정규화된 절대 경로이며 `/data` 바로 아래 또는 하위에 있어야 한다. `:memory:`, SQLite URI, 상대 경로, `/data` 밖 경로는 거부한다. 이 검증은 lexical boundary이며 mount와 symlink 안전성은 deployment 설정에서 보장한다. Development CLI는 명시적으로 제공한 workspace-relative path를 허용한다.

## 10. Import 저장 규칙

공식 JSON contract는 `docs/IMPORT_SCHEMA.md`이다. Backend DB mapping은 다음 원칙을 추가한다.

- Import는 이미 존재하고 unlock된 Project를 대상으로 한다. `project.name/description`은 정보 및 mismatch warning 용도이며 DB metadata를 변경하지 않는다.
- v1은 create-only이다. Payload 내부 duplicate 또는 해당 Project DB에 이미 존재하는 `externalId`가 하나라도 있으면 전체를 거부한다.
- `externalId`는 앞뒤 공백을 허용하지 않고 case-sensitive opaque identifier로 취급한다.
- 별도 top-level `order` field는 없다. Import `tasks` 배열에서 같은 parent를 가진 task의 등장 순서를 sibling `sort_order`로 materialize한다. Parent가 배열의 자식보다 뒤에 있어도 ID map을 먼저 만든 후 같은 규칙을 적용한다.
- Parent/link external ID는 같은 import batch 안의 task로만 해석한다. Existing task를 암묵적으로 연결하거나 덮어쓰지 않는다.
- 비지원 dependency type, non-zero lag, missing parent/target, cycle을 조용히 버리지 않는다.
- 저장 전 Scheduling Engine 결과와 preview diff를 생성하고 commit 시 같은 payload를 다시 검증한다.

CSV 1.0은 `docs/IMPORT_SCHEMA.md`의 공동 승인 grammar를 따른다. RFC 4180, canonical UTF-8 BOM 출력, 필수 header name mapping, row별 동일한 schema/project metadata, predecessor JSON array cell을 사용하며 CSV row 순서를 JSON task array 순서로 보존한다. 축약 dependency 문법이나 silent field drop을 허용하지 않는다.

## 11. 미확정 사항

- Project 목록을 public directory로 노출할지, upstream 인증 뒤에 둘지, direct-link only로 할지는 deployment owner 결정이 필요하다.
- Summary import의 입력 date/duration/progress는 optional snapshot이며 authority가 아니다. Preview는 파생 결과를 반환하고 제공 snapshot과 다르면 차이를 알린다.
- Password scrypt parameter와 edit session TTL의 실제 수치는 운영 Node runtime/하드웨어 benchmark 후 보안 문서의 하한 이상으로 확정한다.

## 12. 구현 시 검증

W02 자동화 검증 범위:

- connection PRAGMA, 5개 domain table, ledger, 필수 index
- migration 재실행 idempotency와 file DB reopen persistence
- migration 중간 실패 시 ledger와 모든 pending DDL rollback
- 빈 directory, sequence gap, 누락 파일, non-prefix ledger, 이름/checksum 변경 fail-closed
- 다른 Project task를 parent 또는 link endpoint로 지정하는 insert 실패
- Project aggregate cascade와 parent 단독 삭제 방지
- production DB path boundary

Issue #54 추가 자동화 검증 범위:

- `0004_project_owner.sql` 적용 및 legacy `owner_name IS NULL` 호환
- 신규 생성 Owner 저장/목록/snapshot round-trip
- Owner persistence 실패 시 Project와 edit session까지 aggregate rollback
- Docker 재시작 후 Owner 포함 Project snapshot 영속성

후속 work item에서 검증할 범위:

- duplicate external ID의 Service 오류 mapping과 stale revision mutation
- import 중간 오류의 전체 domain transaction rollback
- weekend/holiday와 requested/effective date round-trip
- password 변경 후 이전 session 무효화
- container restart 후 DB/WAL volume persistence

## 13. 근거 자료

- [SQLite Foreign Key Support](https://www.sqlite.org/foreignkeys.html)
- [SQLite Transactions](https://www.sqlite.org/lang_transaction.html)
- [SQLite Write-Ahead Logging](https://www.sqlite.org/wal.html)
- [`better-sqlite3` API: transactions and pragmas](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- [Node.js Crypto API](https://nodejs.org/api/crypto.html)


## Issue #57 Working Calendar 영속 모델

### 5.12 `work_calendar_rules`

Calendar의 출처와 적용 범위를 저장한다.

| Column | Type | Null | 의미 |
|---|---|---:|---|
| `public_id` | TEXT | N | API에서 사용하는 안정 rule ID |
| `project_id` | INTEGER | N | Project FK, Project 삭제 시 cascade |
| `kind` | TEXT | N | `COUNTRY | CUSTOM` |
| `name` | TEXT | N | 표시용 규칙명 |
| `country_code` | TEXT | Y | COUNTRY일 때 KR/CN/VN/PH/TH/MX/US |
| `target_type` | TEXT | N | `PROJECT | RESOURCE_GROUP | RESOURCE` |
| `target_public_id` | TEXT | Y | Project 대상은 NULL, Group/Resource는 public ID |
| `scope` | TEXT | N | `FULL_PROJECT | DATE_RANGE` |
| `effective_from/to` | TEXT | Y | DATE_RANGE일 때 양쪽 모두 필요 |
| `source_version` | TEXT | Y | materialized 국가 fixture 버전 |
| `created_at/updated_at` | TEXT | N | UTC timestamp |

COUNTRY rule은 Project 대상만 허용한다. CUSTOM은 Project/Group/Resource를 허용한다. Issue #261부터 Group/Resource는 `NON_WORKING | WORKING`을 저장하고 Project CUSTOM은 기존 `NON_WORKING`만 허용한다. `FULL_PROJECT`는 물리적인 Project 최소/최대 날짜를 저장하지 않는 논리 범위다.

### 5.13 `work_calendar_dates`

실제 계산 입력이 되는 materialized 날짜 예외다.

| Column | Type | Null | 의미 |
|---|---|---:|---|
| `calendar_rule_id` | INTEGER | N | `work_calendar_rules.id` FK, rule 삭제 시 cascade |
| `date` | TEXT | N | `YYYY-MM-DD` |
| `day_type` | TEXT | N | `NON_WORKING | WORKING` |
| `name` | TEXT | Y | 휴일/근무일 표시명 |
| `source_key` | TEXT | Y | 국가 fixture 안의 안정 source key |
| `source_version` | TEXT | Y | 날짜를 생성한 fixture 버전 |
| `created_at` | TEXT | N | UTC timestamp |

`UNIQUE(calendar_rule_id,date)`로 한 rule 안의 중복을 막는다. 같은 level의 서로 다른 rule이 같은 Resource/날짜·같은 day type을 제공하면 계산은 한 번 적용하고 source 목록은 보존한다. 동일 Resource에 적용되는 같은 level의 반대 dayType은 Service가 저장 전에 거부한다. 서로 다른 level에서는 더 구체적인 명시 예외가 상위 결과를 override한다. Resource 예외가 Group-level 상호 충돌을 숨길 수 없으며 구성원 없는 동일 Group target 내부 충돌도 거부한다.

Project 일정 계산은 Project target rule만 사용한다. Resource workload 계산은 `Project < Resource Group < Resource` 순서로 명시적 `WORKING/NON_WORKING`을 override한다. 이 Resource Effective Calendar는 Task row의 `start_date/end_date`를 변경하지 않고 M/D와 일별 allocation 판정에만 사용한다.

Issue #261의 NO_EFFECT 예외도 원래 dayType을 저장한다. 글로벌 Group membership 교체는 하나의 IMMEDIATE transaction 안에서 모든 Project의 결과 Resource Calendar 충돌을 검사하고 실패하면 membership/catalog revision을 rollback한다. Resource 배정 유무나 활성 여부는 불변조건의 적용 범위를 줄이지 않는다.

신규 migration은 N/A다. 기존 `0006_work_calendars.sql`의 `day_type CHECK (day_type IN ('NON_WORKING','WORKING'))`, target 및 날짜 index가 새 계약을 이미 지원하며 column/constraint/index 변경이 없다. 기존 row는 그대로 새 계층 규칙으로 해석한다.

### Migration 0006 호환 원칙

- 기존 Project의 `project_holidays`는 Custom Project rule로 이관하며 국가 공휴일을 자동 추가하지 않는다.
- 신규 Project는 생성 시 2026 KR `FULL_PROJECT` 국가 rule/date를 materialize한다.
- 국가 fixture update는 기존 Project row를 조용히 다시 쓰지 않는다. 사용자가 Preview/저장을 수행할 때만 새 candidate가 저장된다.
- Calendar 교체와 Auto/Summary Task 재계산, Project revision 증가는 하나의 transaction에서 처리한다.

## Issue #184 Logistics Domain 영속 모델 (Migration 0009)

### 5.14 `project_processes`

공정 단계를 정의한다. Project 내 계층 트리(self-parent)와 순서를 가진다.

| Column | Type | Null | 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | PK |
| `public_id` | TEXT | N | UUID public 식별자 (UNIQUE) |
| `project_id` | INTEGER | N | Project FK, cascade |
| `code` | TEXT | N | 공정 코드 (Project 내 UNIQUE) |
| `name` | TEXT | N | 공정명 (1~200자) |
| `parent_id` | INTEGER | Y | 상위 공정 PK (동일 프로젝트 composite FK, NO ACTION DEFERRED) |
| `sort_order` | INTEGER | N | 정렬 순서 (기본 0, >= 0) |
| `active` | INTEGER | N | 활성 여부 (0 또는 1, 기본 1) |
| `created_at/updated_at` | TEXT | N | UTC timestamp |

### 5.15 `project_equipment`

프로젝트 내 설비를 정의한다. 설비는 반드시 하나의 특정 공정(`process_id`)에 소속된다.

| Column | Type | Null | 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | PK |
| `public_id` | TEXT | N | UUID public 식별자 (UNIQUE) |
| `project_id` | INTEGER | N | Project FK, cascade |
| `process_id` | INTEGER | N | 소속 공정 PK (동일 프로젝트 composite FK, NO ACTION DEFERRED) |
| `code` | TEXT | N | 설비 코드 (Project 내 UNIQUE) |
| `name` | TEXT | N | 설비명 (1~200자) |
| `equipment_type` | TEXT | N | `stocker \| agv \| amr \| oht \| conveyor \| other` |
| `management_unit` | TEXT | N | `unit \| fleet` |
| `quantity` | INTEGER | N | 수량 (unit=1 고정, fleet>=1 CHECK) |
| `manufacturer` | TEXT | N | 제조사 (기본 '') |
| `model` | TEXT | N | 모델명 (기본 '') |
| `description` | TEXT | N | 설명 (최대 4000자, 기본 '') |
| `active` | INTEGER | N | 활성 여부 (0 또는 1, 기본 1) |
| `created_at/updated_at` | TEXT | N | UTC timestamp |

### 5.16 `project_logistics_systems`

프로젝트 내 제어 및 조율 소프트웨어 시스템을 정의한다.

| Column | Type | Null | 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | PK |
| `public_id` | TEXT | N | UUID public 식별자 (UNIQUE) |
| `project_id` | INTEGER | N | Project FK, cascade |
| `code` | TEXT | N | 시스템 코드 (Project 내 UNIQUE) |
| `name` | TEXT | N | 시스템명 (1~200자) |
| `system_type` | TEXT | N | `scs \| acs \| ocs \| lcs \| mcs \| other` |
| `layer` | TEXT | N | `controller \| coordinator` |
| `scope` | TEXT | N | `project \| processes` |
| `vendor` | TEXT | N | 벤더사 (기본 '') |
| `description` | TEXT | N | 설명 (최대 4000자, 기본 '') |
| `active` | INTEGER | N | 활성 여부 (0 또는 1, 기본 1) |
| `created_at/updated_at` | TEXT | N | UTC timestamp |

### 5.17 `project_system_processes`

Scope가 `processes`인 시스템과 담당 공정 간의 다대다 매핑 테이블이다.

| Column | Type | Null | 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | PK |
| `project_id` | INTEGER | N | Project FK, cascade |
| `system_id` | INTEGER | N | 시스템 PK (동일 프로젝트 composite FK, cascade) |
| `process_id` | INTEGER | N | 공정 PK (동일 프로젝트 composite FK, cascade) |
| `created_at` | TEXT | N | UTC timestamp |

`UNIQUE(project_id, system_id, process_id)`

### 5.18 `project_equipment_systems`

설비와 이를 제어하는 시스템 간의 매핑 테이블이다. 설비당 주 제어 시스템(`primary`)은 최대 1개(`WHERE control_role = 'primary'` partial unique index)만 허용되며, 보조 제어 시스템(`supporting`)은 복수 개 지정 가능하다. 제어 시스템(`controller`) 계층의 시스템만 연결 가능하다.

| Column | Type | Null | 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | PK |
| `project_id` | INTEGER | N | Project FK, cascade |
| `equipment_id` | INTEGER | N | 설비 PK (동일 프로젝트 composite FK, cascade) |
| `system_id` | INTEGER | N | 시스템 PK (동일 프로젝트 composite FK, cascade) |
| `control_role` | TEXT | N | `primary \| supporting` |
| `created_at` | TEXT | N | UTC timestamp |

`UNIQUE(project_id, equipment_id, system_id)`

### 5.19 `project_system_links`

상위 조율 시스템(`coordinator`)과 하위 제어/조율 시스템 간의 방향성 연계(DAG) 테이블이다.

| Column | Type | Null | 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | PK |
| `project_id` | INTEGER | N | Project FK, cascade |
| `source_system_id` | INTEGER | N | 상위 조율 시스템 PK (동일 프로젝트 composite FK, cascade) |
| `target_system_id` | INTEGER | N | 하위 시스템 PK (동일 프로젝트 composite FK, cascade) |
| `relation_type` | TEXT | N | `coordinates` (CHECK) |
| `created_at` | TEXT | N | UTC timestamp |

`UNIQUE(project_id, source_system_id, target_system_id)`, `CHECK(source_system_id <> target_system_id)`

### 5.20 `project_equipment_resource_roles`

설비 담당자 역할 배정 테이블이다. 기존 리소스 카탈로그(`resources`)의 리소스를 설비에 배정하며, 역할은 설비 담당(`owner`) 또는 참여(`contributor`)이다. 설비당 주 담당자(`is_primary = 1`)는 최대 1개(`WHERE is_primary = 1` partial unique index)만 허용되며, `owner` 역할에만 주 담당자 지정이 가능하다 (`CHECK(is_primary = 0 OR role = 'owner')`). 리소스 삭제 시 배정 데이터 보존을 위해 `FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE NO ACTION`으로 보호된다.

| Column | Type | Null | 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | PK |
| `project_id` | INTEGER | N | Project FK, cascade |
| `equipment_id` | INTEGER | N | 설비 PK (동일 프로젝트 composite FK, cascade) |
| `resource_id` | INTEGER | N | 리소스 PK (`resources.id` FK, NO ACTION) |
| `role` | TEXT | N | `owner \| contributor` |
| `is_primary` | INTEGER | N | 주 담당자 여부 (0 또는 1, 기본 0) |
| `created_at/updated_at` | TEXT | N | UTC timestamp |

`UNIQUE(project_id, equipment_id, resource_id, role)`

### 5.21 `project_system_resource_roles`

물류 시스템 PI/개발자 역할 배정 테이블이다. 기존 리소스 카탈로그(`resources`)의 리소스를 시스템에 배정하며, 역할은 책임자(`pi`) 또는 개발자(`developer`)이다. 시스템당 주 책임자(`is_primary = 1`)는 최대 1개(`WHERE is_primary = 1` partial unique index)만 허용되며, `pi` 역할에만 주 책임자 지정이 가능하다 (`CHECK(is_primary = 0 OR role = 'pi')`). 리소스 삭제 시 배정 데이터 보존을 위해 `FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE NO ACTION`으로 보호된다.

| Column | Type | Null | 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | PK |
| `project_id` | INTEGER | N | Project FK, cascade |
| `system_id` | INTEGER | N | 시스템 PK (동일 프로젝트 composite FK, cascade) |
| `resource_id` | INTEGER | N | 리소스 PK (`resources.id` FK, NO ACTION) |
| `role` | TEXT | N | `pi \| developer` |
| `is_primary` | INTEGER | N | 주 책임자 여부 (0 또는 1, 기본 0) |
| `created_at/updated_at` | TEXT | N | UTC timestamp |

`UNIQUE(project_id, system_id, resource_id, role)`

### 5.22 `task_equipment_links`

Task(Summary, Task, Milestone)와 설비 간의 연결 테이블이다. `scope`는 `'self' | 'subtree'`를 가지며, 기본값은 `'self'`이고 Summary 작업에만 `'subtree'`(하위 작업 포함) 지정이 허용된다. Task 삭제 시 cascade 삭제되며 설비 단독 삭제 시 `NO ACTION DEFERRABLE INITIALLY DEFERRED`로 보호된다.

| Column | Type | Null | 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | PK |
| `project_id` | INTEGER | N | Project FK, cascade |
| `task_id` | INTEGER | N | Task PK (동일 프로젝트 composite FK, cascade) |
| `equipment_id` | INTEGER | N | 설비 PK (동일 프로젝트 composite FK, NO ACTION) |
| `scope` | TEXT | N | `self \| subtree` (CHECK) |
| `created_at/updated_at` | TEXT | N | UTC timestamp |

`UNIQUE(project_id, task_id, equipment_id)`

### 5.23 `task_system_links`

Task(Summary, Task, Milestone)와 물류 시스템 간의 연결 테이블이다. `scope`는 `'self' | 'subtree'`를 가지며, 기본값은 `'self'`이고 Summary 작업에만 `'subtree'`(하위 작업 포함) 지정이 허용된다. Task 삭제 시 cascade 삭제되며 시스템 단독 삭제 시 `NO ACTION DEFERRABLE INITIALLY DEFERRED`로 보호된다.

| Column | Type | Null | 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | PK |
| `project_id` | INTEGER | N | Project FK, cascade |
| `task_id` | INTEGER | N | Task PK (동일 프로젝트 composite FK, cascade) |
| `system_id` | INTEGER | N | 시스템 PK (동일 프로젝트 composite FK, NO ACTION) |
| `scope` | TEXT | N | `self \| subtree` (CHECK) |
| `created_at/updated_at` | TEXT | N | UTC timestamp |

`UNIQUE(project_id, task_id, system_id)`

### 5.24 `project_templates`

프로젝트 템플릿 등록 및 템플릿 기반 새 프로젝트 생성을 위한 전역 템플릿 보관 테이블이다 (Issue #195, `0012_project_templates.sql`). 기존 프로젝트에서 태스크(상대 근무일 offsetDays 기준), 링크, 리소스 배정, 물류 마스터(공정, 설비, 시스템, 역할, 링크) 스냅샷을 `content_json`에 비정규화 보관한다. 원본 프로젝트가 삭제되어도 템플릿은 보존되며(`source_project_id ON DELETE SET NULL`), 템플릿이 삭제되어도 이미 생성된 프로젝트는 영향받지 않는다.

| Column | Type | Null | 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | PK |
| `public_id` | TEXT | N | 템플릿 Public UUID canonical lowercase (UNIQUE) |
| `name` | TEXT | N | 템플릿 명칭 (1~200자) |
| `description` | TEXT | N | 템플릿 설명 (최대 4000자, 기본 `''`) |
| `source_project_id` | INTEGER | Y | 원본 프로젝트 FK (`projects.id` ON DELETE SET NULL) |
| `source_project_name` | TEXT | Y | 원본 프로젝트 명칭 (원본 삭제 후에도 표시용 보존) |
| `active` | INTEGER | N | 활성 상태 (0 또는 1, 기본 1) |
| `task_count` | INTEGER | N | 작업 수 (마일스톤 제외 일반/요약 작업 수, 기본 0) |
| `milestone_count` | INTEGER | N | 마일스톤 수 (기본 0) |
| `content_json` | TEXT | N | 템플릿 전체 스냅샷 JSON (태스크, 링크, 배정, 물류 마스터/연결) |
| `created_at` | TEXT | N | UTC timestamp |
| `updated_at` | TEXT | N | UTC timestamp |

인덱스:
- `project_templates_active_idx ON project_templates(active)`
- `project_templates_created_at_idx ON project_templates(created_at)`

## Issue #280 — Logistics Type Catalog

Migration `0015_logistics_type_catalog.sql`은 다음 글로벌 테이블을 추가한다.

- `logistics_type_catalog_state`: optimistic-concurrency revision
- `logistics_equipment_types`: `code` PK, display `name`, `active`, `sort_order`
- `logistics_system_types`: `code` PK, display `name`, `active`, `sort_order`
- `logistics_catalog_admin_credentials`: scrypt credential 1건
- `logistics_catalog_admin_sessions`: 전용 관리자 세션

`project_equipment.equipment_type`과 `project_logistics_systems.system_type`은 기존 fixed enum CHECK 대신 각 catalog `code`를 FK로 참조한다. Migration은 기존 관계/역할/task link를 임시 staging 후 원래 id와 type code로 복구하며 `foreign_key_check`를 통과해야 한다.

## Issue #288 Resource developer grade

Migration `0016_resource_developer_grade.sql`은 `resources.developer_grade TEXT NULL`을 추가한다.

허용값은 `BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `EXPERT` 또는 `NULL`뿐이며 DB `CHECK`로 방어한다. 기존 Resource는 migration 후 `NULL`을 유지하고, 기존 `project_system_resource_roles.role = 'developer'` row는 변경하지 않는다. 역할 제거도 이 전역 속성을 자동 수정하지 않는다.


## Issue #289 — Project master catalog

Migration `0017_project_master_catalog.sql`은 `project_master_items`와 catalog revision, 전용 관리자 credential/session을 추가하고 `projects.business_unit_id/product_id/site_entity_id`를 nullable FK로 확장한다. 기존 Project는 migration 후 세 참조가 모두 NULL이며 임의 backfill을 하지 않는다.

`project_master_items`는 `BUSINESS_UNIT | PRODUCT | SITE_ENTITY` category, stable public ID/code, 표시명, active, sort_order를 가진다. `UNIQUE(category, code)`와 category별 참조 trigger로 잘못된 category 연결을 차단한다. Project FK는 `ON DELETE RESTRICT`이며 Project 삭제가 global master row를 삭제하지 않는다. `0016_resource_developer_grade.sql` 이후 순차 적용한다.

## Issue #345: 미산정 Summary와 migration 0018

`0018_empty_summary_schedule.sql`은 tasks를 재생성하고 모든 ID·외부 ID·parent/order·description/URL·Baseline·timestamp를 그대로 복사한다. 기존 migration checksum은 변경하지 않는다. leaf의 날짜/기간/진척 필수 규칙 및 Task/Milestone 기간 CHECK를 유지한다. Summary는 `auto/requested_start=NULL`이고 일정 4필드가 모두 NULL이거나 모두 유효한 값이어야 한다. 부분 NULL 조합은 DB CHECK로 거부한다.

미산정 Summary는 직접 자식이 0개이거나 자손이 빈 Summary들뿐인 경우다. 서버가 전체 계층에서 재계산하여 `start_date/end_date/duration/progress=NULL`을 저장하며 ID·type·직접 할당·물류 연결은 유지한다. 첫 실제 Leaf가 추가되면 집계값을 저장한다. 날짜가 있는 Milestone은 일정 있는 Leaf이며 기간 0을 미산정 판별에 쓰지 않는다.

참조되는 tasks table의 DROP이 Link/Assignment/물류 연결을 cascade 삭제하지 않게 migration runner가 해당 pending migration의 선언을 확인하고 **BEGIN 밖에서** FK enforcement를 잠시 끈다. 같은 IMMEDIATE transaction 안에서 재생성·ledger 기록·`foreign_key_check`를 완료한 뒤 commit하며 모든 실패를 rollback한다. finally에서 원래 FK 설정을 복원한다. 활성 transaction 안에서 이 재생성을 중첩 실행하지 않는다. 기존 table을 먼저 rename하는 방식은 사용하지 않는다.

실제 파일 SQLite 업그레이드/reopen과 SQL 실패·FK 위반 주입 rollback, ID/Link/Assignment/Baseline 보존은 `tests/server/db/database.test.ts`가 검증한다. 새 서버 시작 시 기본 FK ON 정책은 유지한다.


## Issue #303 — Task status migration 0019

`0019_task_status.sql`은 `tasks.status TEXT NOT NULL DEFAULT 'not_started'`를 추가하고 허용값을 `not_started | in_progress | completed`로 제한한다. 기존 row는 progress 기준으로 `100 → completed`, `0 < progress < 100 → in_progress`, `0 또는 Summary 미산정 값 → not_started`로 backfill한다.

Repository write는 status/progress 일관성을 검증한다. Summary schedule 갱신은 derived progress에서 status를 함께 갱신하며, subtree Copy는 원본의 명시적 status를 보존한다. Migration ledger는 0018 이후 0019를 순차 적용하고 실제 파일 reopen 및 invalid status CHECK를 회귀 테스트한다.

## Issue #412 — Resource global roles migration 0020

`0020_resource_roles.sql`은 Resource의 전역 역량 역할을 별도 M:N으로 저장하는 `resource_roles`를 추가한다. 기존 `resources.developer_grade`, `resource_group_members`, Project별 `project_equipment_resource_roles` / `project_system_resource_roles`는 변경하지 않는다.

`resource_roles`의 PK는 `(resource_id, role)`이며 role은 `PI | DEVELOPER | EQUIPMENT_OWNER`만 허용한다. Resource 삭제 시에만 role row를 cascade 삭제하고 역할 편집 자체는 다른 연결 정보를 수정하지 않는다. 기존 Resource에는 migration backfill을 하지 않아 역할 0개로 시작한다. `resource_roles_role_resource_idx(role, resource_id)`는 후속 역할 기반 검색/할당 필터가 role→resource 방향으로 조회할 수 있게 한다.

상세 결정과 검증 범위는 [ISSUE_412_RESOURCE_ROLES.md](ISSUE_412_RESOURCE_ROLES.md)를 따른다.

## Issue #413 — Task assignment 수행 역할 migration 0021

`0021_task_assignment_roles.sql`은 기존 `task_assignments`에 nullable `assignment_role TEXT`를 추가한다. 허용값은 `PI | DEVELOPER | EQUIPMENT_OWNER`이며 migration 이전 row는 `NULL`을 유지한다. Group assignment는 역할을 사용하지 않는다.

`task_assignments_resource_role_idx(resource_id, assignment_role)`는 사용 중 역할 조회를 지원한다. INSERT/UPDATE guard는 non-null 수행 역할이 해당 Resource의 `resource_roles`에 존재하는지 검사하고, `resource_roles_assignment_delete_guard`는 Task assignment가 참조 중인 Global Role 삭제를 거부한다. 기존 `(project_id, task_id, resource_id)` unique index는 그대로 유지하므로 하나의 Task+Resource는 최대 하나의 수행 역할만 가진다.

Project Copy와 Template은 `assignment_role`을 보존하고 workload/Calendar 계산은 이 필드에 의존하지 않는다. 상세 결정은 [ISSUE_413_TASK_ASSIGNMENT_ROLES.md](ISSUE_413_TASK_ASSIGNMENT_ROLES.md)를 따른다.

## Issue #342 Country Calendar Catalog — migration 0022

0022_country_calendar_catalog.sql은 Project별 materialized Calendar와 분리된 글로벌 국가 Calendar Catalog를 추가한다.

- country_calendar_catalog_state: 관리자 optimistic concurrency용 단일 revision row
- country_calendar_datasets: country_code + calendar_year unique, OFFICIAL/UNAVAILABLE/SUPERSEDED status, sourceVersion/sourceUrl, updated_at
- country_calendar_dates: dataset별 ISO date, name, NON_WORKING/WORKING, sourceKey. dataset 삭제 시 cascade
- 관리 가능 year CHECK 범위: 2026..2037

Repository built-in 2026 fixture는 DB로 일괄 복제하지 않는다. override가 필요할 때 첫 mutation이 built-in dataset을 DB에 clone하고 이후 DB가 resolution 우선권을 가진다. 기존 work_calendar_rules/work_calendar_dates는 Project snapshot이므로 Catalog mutation으로 수정되지 않는다.
