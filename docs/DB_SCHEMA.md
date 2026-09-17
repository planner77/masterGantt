# Database Schema

## 1. 문서 상태와 범위

이 문서는 SQLite 논리 모델과 영속성 규칙을 정의한다. W02 SQLite Foundation은 **구현 완료 / 독립 QA PASS / Manager ACCEPT**이며 최초 schema는 `db/migrations/0001_initial_schema.sql`에 있다. W04는 Project와 최초 edit session insert를, W05는 credential/session과 보호 Project 변경을, W07은 Project-scoped Task CRUD와 Link Repository CRUD foundation을 구현했다. W06은 pure Scheduling Domain이다. W04–W07은 기존 `0001` schema를 사용했고, Issue #36에서 Task Description/URL용 `0002_task_description_url.sql`, Issue #19에서 글로벌 Resource/Group 및 Task assignment용 `0003_resource_catalog.sql`, Issue #54에서 Project 표시용 Owner를 위한 `0004_project_owner.sql`을 추가했다. Issue #56에서 Resource 계획 투입 기간/투입률과 workload 조회 index를 위한 `0005_resource_workload.sql`을 추가했다. [W07 검증](W07_REVIEW.md) 이후 schema 변경도 이 문서와 `db/migrations/**`를 같은 변경 단위로 갱신한다.

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
  ├─< project_holidays
  ├─< tasks ──(self parent)──> tasks
  │      ├─< links >─┘
  │      └─< task_assignments >─ resources / resource_groups
  └─< edit_sessions

resource_catalog_state (singleton revision)
resources >─< resource_group_members >─ resource_groups
resource_catalog_admin_sessions (global admin)
```

`project_id`는 단순 조회 filter가 아니라 isolation 경계이다. Task parent와 Link 양 끝은 composite foreign key로 같은 Project에 속함을 DB에서도 강제한다.

## 5. Tables

### 5.1 `projects`

| Column | Type | Null | Constraint / 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | Primary key |
| `public_id` | TEXT | N | UNIQUE, immutable UUID v4 |
| `name` | TEXT | N | trim 후 빈 문자열 불가, 길이는 API 정책으로 제한 |
| `description` | TEXT | N | 기본값 빈 문자열 |
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

Password parameter를 row와 함께 저장해 향후 cost 변경 후에도 기존 hash를 검증하고 성공 시 재해시할 수 있게 한다. `public_id`는 접근 편의를 위한 주소이지 authorization secret이 아니다.

### 5.2 `project_holidays`

Project별 holiday set을 정규화해 저장한다.

| Column | Type | Null | Constraint / 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | Primary key |
| `project_id` | INTEGER | N | FK → `projects.id` ON DELETE CASCADE |
| `holiday_date` | TEXT | N | `YYYY-MM-DD` |
| `name` | TEXT | Y | 표시용 명칭 |
| `created_at` | TEXT | N | UTC timestamp |

`UNIQUE(project_id, holiday_date)`를 둔다. v1 working calendar는 토요일/일요일을 비근무일로 고정하고, holiday는 이 table의 Project별 집합을 사용한다. Timezone은 `Asia/Seoul`만 지원한다는 초기 가정이며 일반화는 별도 결정이다.

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
| `start_date` | TEXT | N | Scheduling Engine이 계산한 effective start |
| `end_date` | TEXT | N | Scheduling Engine이 계산한 inclusive effective end |
| `duration` | INTEGER | N | working-day 단위, 0 이상 |
| `progress` | REAL | N | finite 0..100, 계산 중 반올림하지 않음 |
| `parent_id` | INTEGER | Y | 같은 Project의 summary task만 허용 |
| `sort_order` | INTEGER | N | 같은 parent 아래 sibling의 안정적인 순서, 0 이상 |
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
- Empty summary는 최종 snapshot에서 허용하지 않는다. Parent가 될 수 있는 type은 summary뿐이다.

이 규칙은 DB trigger로 중복 구현하지 않고 Scheduling Engine을 단일 계산 소스로 사용한다. 저장 직전 Service가 전체 aggregate 결과를 검증한다.

최종 persisted snapshot은 empty summary를 허용하지 않으므로 summary도 계산된 `start_date/end_date`가 항상 존재한다. Batch 처리 중간 candidate는 메모리에만 있고 불완전 row를 DB에 먼저 넣지 않는다. 일반 task duration은 1..10000, milestone은 0이다. Summary duration은 descendant 전체 span의 계산 결과이므로 일반 task의 10000 제한을 적용하지 않고 Scheduling Engine의 지원 date range로 제한한다. Progress는 `100/3` 같은 파생값을 보존하도록 REAL을 사용하고 UI 표시 단계 전에는 반올림하지 않는다. Service는 `NaN`/무한대를 거부한다.

### 5.4 `links`

`links`는 task dependency를 저장한다. 방향은 `predecessor_task_id → successor_task_id`이다.

| Column | Type | Null | Constraint / 의미 |
|---|---|---:|---|
| `id` | INTEGER | N | Primary key |
| `public_id` | TEXT | N | UNIQUE UUID v4, API 식별자 |
| `project_id` | INTEGER | N | FK → `projects.id` ON DELETE CASCADE |
| `predecessor_task_id` | INTEGER | N | 같은 Project의 predecessor |
| `successor_task_id` | INTEGER | N | 같은 Project의 successor |
| `type` | TEXT | N | v1은 `FS`만 허용 |
| `lag` | INTEGER | N | v1은 `0`만 허용 |
| `created_at` | TEXT | N | UTC timestamp |
| `updated_at` | TEXT | N | UTC timestamp |

다음을 강제한다.

```text
CHECK(predecessor_task_id <> successor_task_id)
CHECK(type = 'FS')
CHECK(lag = 0)
UNIQUE(project_id, predecessor_task_id, successor_task_id, type)
FOREIGN KEY(project_id, predecessor_task_id)
  REFERENCES tasks(project_id, id) ON DELETE CASCADE
FOREIGN KEY(project_id, successor_task_id)
  REFERENCES tasks(project_id, id) ON DELETE CASCADE
```

Dependency endpoint는 leaf task 또는 milestone만 허용하고 summary endpoint는 거부한다. Circular dependency는 graph 검증이 필요하므로 Scheduling Engine이 탐지한다. 모든 FS successor는 predecessor가 milestone인지와 무관하게 predecessor end 다음의 첫 근무일보다 빠르게 시작할 수 없다.

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

두 테이블은 내부 INTEGER PK와 외부 UUID `public_id`, 필수 `name`, optional unique `code`, `description`, `active`, 생성/수정 시각을 저장한다. `active=0`은 신규 할당 후보에서 제외하지만 기존 assignment는 유지한다. 물리 삭제보다 비활성화를 기본 정책으로 사용한다.

### 5.8 `resource_group_members`

`(group_id, resource_id)` 복합 PK로 그룹 멤버 중복을 방지한다. Resource와 Group FK는 모두 `ON DELETE RESTRICT`이며 그룹은 중첩하지 않는다. 한 Resource는 여러 Group에 속할 수 있다.

### 5.9 `resource_catalog_admin_sessions`

글로벌 catalog 관리자 세션을 Project edit session과 분리한다. 원문 token은 저장하지 않고 32-byte SHA-256 digest와 생성/만료/폐기 시각만 저장한다.

### 5.10 `task_assignments`

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
