# Backend API

## 1. 문서 상태와 경계

이 문서는 REST API 계약이다. W04의 `POST /api/projects`, `GET /api/projects/{publicId}`와 비활성 collection GET은 구현·Manager 검증했고, 아래 Task/Auth/Import/Export API는 명시된 후속 작업 전까지 계획이다. 구현 상태는 [W04 검증 기록](W04_REVIEW.md)과 함께 본다.

```text
Route Handler
  → Service (authorization, validation, concurrency, transaction orchestration)
    → Scheduling Domain Engine (pure calculation)
    → Repository
      → SQLite
```

Route Handler 안에 SQL이나 일정 알고리즘을 두지 않는다. Client preview나 `canEdit` UI 상태는 mutation 권한의 근거가 아니며, 모든 mutation에서 server가 Project edit session을 다시 검증한다.

## 2. 공통 규약

### URL과 식별자

- API prefix는 `/api`이다.
- Project는 DB integer ID가 아니라 canonical UUID `publicId`로 지정한다.
- Task CRUD URL은 server-generated UUID `taskId`, Link는 UUID `linkId`로 지정한다. `externalId`는 별도 업무 ID이며 JSON parent/dependency/batch 참조에 사용한다. UUID를 알아도 URL Project scope를 검사한다.
- Password, session token, CSRF token 등 secret은 URL, query string, response body에 넣지 않는다.
- Project browser URL은 `/projects/{publicId}`이다.

### Media type과 date

- 일반 request/response는 `application/json; charset=utf-8`이다.
- Domain date는 `YYYY-MM-DD`이며 time 또는 timezone suffix를 허용하지 않는다.
- Timestamp는 UTC ISO 8601이다.
- `start`는 mutation/import 입력에서 사용자가 요청한 시작일이다. 조회 결과는 이를 `requestedStart`로 반환하고 계산 결과 `start`, `end`와 구분한다.
- 계산 `end`는 inclusive date이다.

### Response envelope

성공:

```json
{
  "data": {}
}
```

실패:

```json
{
  "error": {
    "code": "REVISION_MISMATCH",
    "message": "Project changed. Reload and retry.",
    "details": [],
    "requestId": "server-generated-id"
  }
}
```

`details`는 입력 path, 안정 오류 code, 관련 external ID 등 사용자가 수정할 정보만 포함한다. SQL, stack, password/hash/session, filesystem path는 포함하지 않는다.

### Project revision / ETag

Project schedule 전체를 하나의 aggregate로 보고 `projects.revision`을 사용한다.

- Project snapshot과 mutation 성공 응답은 `ETag: "<revision>"` 및 body의 `revision`을 반환한다.
- Password rotation의 204 응답은 body가 없는 예외이며 새 revision은 ETag로 전달한다.
- Project 생성, unlock/logout을 제외한 모든 Project mutation은 `If-Match: "<revision>"`가 필수다.
- Header 누락은 `428 PRECONDITION_REQUIRED`, DB 최신 revision과 불일치는 `412 REVISION_MISMATCH`이다.
- Revision 비교, write, 일정 재계산 결과 저장, revision 증가는 같은 transaction에서 처리한다.
- Import preview는 `baseRevision`을 반환하고 commit은 그 revision을 `If-Match`로 다시 제출한다.
- Preview는 authenticated non-mutating POST다. Session·Origin은 필수지만 If-Match는 요구하지 않고 DB/revision을 변경하지 않는다.

### Canonical schedule mutation response

Project metadata, calendar, task, link, task batch, import commit처럼 schedule aggregate를 바꾸는 모든 성공 응답은 부분 row 또는 서로 다른 변형 대신 최신 canonical full snapshot을 반환한다.

```json
{
  "data": {
    "project": {
      "publicId": "2fd0c93f-cd37-4b68-9f09-412239d99c79",
      "name": "Plant Expansion",
      "description": "Phase 1 schedule",
      "revision": 8,
      "calendar": {
        "timezone": "Asia/Seoul",
        "weekendDays": [6, 0],
        "holidays": []
      }
    },
    "tasks": [],
    "links": [],
    "warnings": [],
    "operation": {
      "kind": "taskBatch",
      "changedTaskExternalIds": [],
      "deletedTaskExternalIds": [],
      "deletedLinkIds": []
    }
  }
}
```

`operation`의 detail은 operation별로 달라도 `project/tasks/links/warnings` shape은 바꾸지 않는다. 배열 순서는 저장된 hierarchy/sibling 순서와 안정적인 Link 순서를 따른다. Response `ETag`은 body revision과 같다. 이 정책은 초기 소규모 Project에 맞춘 것이며 측정 없이 부분 patch protocol로 바꾸지 않는다.

## 3. 권한 모델

| Operation | Session 필요 | 비고 |
|---|---:|---|
| Project 생성 | 아니오 | 기존 Project가 없으므로 예외. Same-Origin 및 강한 rate limit 필수 |
| Project direct read | 아니오 | URL 보유자는 전체 일정 read 가능; 링크가 기밀성을 뜻하지 않음 |
| Project 목록 discovery | 미확정 | 배포 owner가 공개 directory/upstream 인증/direct-link only 중 결정 전에는 노출하지 않음 |
| Unlock | 아니오 | Password 검증 후 Project-scoped edit session 발급 |
| Metadata/calendar/task/link 변경 | 예 | Project와 session binding을 server에서 확인 |
| Import preview/commit | 예 | CPU abuse 방지 및 편집 workflow 일관성을 위해 preview도 요구 |
| Excel export | 아니오 | Project read와 같은 공개 범위. 별도 rate/size limit 적용 |

Project create는 권한 우회가 아니라 독립 bootstrap operation이다. W04는 정확한 `Origin`, UTF-8 JSON content type, 32 KiB 실제/선언 크기, strict 입력과 process-global 5회/1시간 fail-closed limit을 적용한다. Trusted client IP 경계가 아직 없으므로 forwarded header를 신뢰하지 않는다. 성공 시 생성한 Project에 대한 edit session을 같은 응답에서 발급한다. Proxy/IP 기반 persistent protection은 D03/W16에서 확정한다.

## 4. Project와 Session API

### `POST /api/projects`

Project를 만들고 최초 edit session을 발급한다.

W04 입력은 unknown field를 거부한다. `name`만 trim한 뒤 1–200 Unicode code point, `description`은 원문을 보존하며 0–4,000 code point, `editPassword`는 trim/정규화 없이 최소 12 code point·UTF-8 최대 1,024 bytes다. JSON body 상한은 32 KiB다.

```json
{
  "name": "Plant Expansion",
  "description": "Phase 1 schedule",
  "editPassword": "user-provided-password"
}
```

성공은 `201 Created`, `Location: /projects/{publicId}`, session `Set-Cookie`, 다음 형태의 응답을 반환한다.

```json
{
  "data": {
    "project": {
      "publicId": "2fd0c93f-cd37-4b68-9f09-412239d99c79",
      "name": "Plant Expansion",
      "description": "Phase 1 schedule",
      "revision": 1,
      "calendar": {
        "timezone": "Asia/Seoul",
        "weekendDays": [6, 0],
        "holidays": []
      }
    },
    "permission": "edit"
  }
}
```

Password는 응답하거나 log에 남기지 않는다. UUID collision은 unique constraint 기준으로 제한 횟수만 재생성한다.

### `GET /api/projects`

Project List 화면에 필요한 discovery endpoint 후보이다. 그러나 전역 사용자 인증이 없는 상태에서 Project name/description 목록을 공개하면 direct URL보다 훨씬 넓은 정보 노출이 된다. 배포 owner가 다음 중 하나를 결정하기 전에는 route를 활성화하지 않는다.

1. 공개 directory임을 명시한다.
2. Reverse proxy/SSO 인증 뒤에서만 제공한다.
3. 목록 없이 direct-link only로 운영한다.

W04 route는 discovery가 활성화되지 않았음을 명시하는 `405 METHOD_NOT_ALLOWED`, `Allow: POST`, `Cache-Control: private, no-store`를 반환한다. 홈페이지도 DB 목록을 요청하지 않는다.

### `GET /api/projects/{publicId}`

Readonly schedule snapshot을 반환한다. Project가 없거나 `publicId`가 canonical lowercase UUID v4가 아니면 동일한 `404 PROJECT_NOT_FOUND`이다. W04는 Cookie 유무와 관계없이 `permission: "readonly"`만 반환한다. W05 session-current 경계가 구현된 뒤 edit 표시를 별도로 동기화하며 mutation은 항상 다시 인증한다.

```json
{
  "data": {
    "project": {
      "publicId": "2fd0c93f-cd37-4b68-9f09-412239d99c79",
      "name": "Plant Expansion",
      "description": "Phase 1 schedule",
      "revision": 7,
      "calendar": {
        "timezone": "Asia/Seoul",
        "weekendDays": [6, 0],
        "holidays": [{ "date": "2026-09-21", "name": "Company holiday" }]
      }
    },
    "tasks": [],
    "links": [],
    "permission": "readonly"
  }
}
```

초기 Gantt snapshot은 consistency를 위해 task/link를 한 번에 반환한다. Project 규모 상한을 적용하고 측정 없이 pagination을 추가하지 않는다.

### `PATCH /api/projects/{publicId}`

Edit session과 `If-Match`가 필요하다. `name`과 `description`만 변경한다. Unknown field와 `null`로 삭제하는 요청은 거부한다. 성공 시 revision이 증가한다.

### `PUT /api/projects/{publicId}/calendar`

Project calendar 전체를 명시적으로 교체한다.

```json
{
  "timezone": "Asia/Seoul",
  "weekendDays": [6, 0],
  "holidays": [
    { "date": "2026-09-21", "name": "Company holiday" }
  ]
}
```

v1은 timezone `Asia/Seoul`, weekend `[6,0]`만 허용한다. Holiday 중복/날짜를 검증한 뒤 모든 일정을 재계산한다. 기존 Manual task의 확정 interval이 calendar 변경만으로 달라지거나 FS를 위반하면 `MANUAL_CALENDAR_CONFLICT`로 전체 변경을 거부한다. 사용자가 별도 task edit에서 Manual start/duration을 명시적으로 바꾸는 것은 새로운 interval 요청이다.

### `POST /api/projects/{publicId}/edit-sessions`

```json
{ "editPassword": "user-provided-password" }
```

성공은 `204 No Content`와 HttpOnly Cookie를 발급한다. 실패는 Project 존재 여부나 password mismatch를 구분하지 않는 일반 `401 INVALID_CREDENTIALS`를 반환한다. Rate limit을 적용한다.

### `GET /api/projects/{publicId}/edit-sessions/current`

Frontend가 unlock 표시를 동기화하는 선택 endpoint이다. 유효하면 `{ "data": { "permission": "edit", "expiresAt": "..." } }`, 아니면 `{ "data": { "permission": "readonly" } }`를 반환한다. Token 자체는 반환하지 않는다.

### `DELETE /api/projects/{publicId}/edit-sessions/current`

현재 session을 revoke하고 같은 속성의 만료 Cookie를 내려 보낸다. Logout은 idempotent하게 `204`를 반환한다.

### `PUT /api/projects/{publicId}/edit-password`

현재 edit session, `If-Match`, `newEditPassword`가 필요하다. 새 salt/hash를 저장하고 auth_version과 revision을 증가시키며 기존 session을 모두 revoke한다. 같은 transaction에서 호출자에게만 새 random session을 발급한다. 성공은 204 No Content, 새 ETag와 Set-Cookie다. 호출자는 새 Cookie로 편집을 유지하고 다른 이전 session은 거부된다. 원문 password는 DB/log/response에 남기지 않는다.

Project delete API는 초기 요구사항에 없고 복구 정책이 정해지지 않았으므로 제공하지 않는다.

## 5. Task 표현과 API

### Task response

```json
{
  "externalId": "ACT-100",
  "name": "Foundation",
  "type": "task",
  "scheduleMode": "auto",
  "taskId": "f6760712-5649-4edc-9781-5df172e27e88",
  "requestedStart": "2026-09-11",
  "start": "2026-09-15",
  "end": "2026-09-16",
  "duration": 2,
  "progress": 25,
  "parentExternalId": "SUM-10",
  "siblingOrder": 3,
  "wbs": "1.2"
}
```

- 일반 task duration은 정수 `>= 1`, milestone은 `0` 및 `start=end`이다.
- Summary의 requestedStart는 null, scheduleMode는 auto이며 start/end/duration/progress/WBS는 Scheduling Engine 결과다. Summary mode 생략은 auto로 정규화하고 manual은 거부한다.
- Summary span duration은 descendant leaf의 최소 start부터 최대 end까지의 working-day 수이며 자식 duration 합이 아니다.
- Summary progress는 일반 descendant task의 duration-weighted finite 0..100 값이며 계산/저장 단계에서 반올림하지 않는다. 일반 task가 하나도 없는 milestone-only summary 정책은 Scheduling 문서를 따른다. Import의 summary date/duration/progress는 optional snapshot이고 authority가 아니며 preview가 파생 결과와의 차이를 보고한다.
- Parent는 같은 Project의 summary만 가능하다. Empty summary, missing parent, hierarchy cycle을 거부한다.

### `POST /api/projects/{publicId}/tasks`

Edit session과 `If-Match`가 필요하다.

```json
{
  "externalId": "ACT-100",
  "name": "Foundation",
  "type": "task",
  "scheduleMode": "auto",
  "start": "2026-09-11",
  "end": "2026-09-14",
  "duration": 2,
  "progress": 0,
  "parentExternalId": "SUM-10",
  "siblingOrder": 3
}
```

UI 생성에서는 `externalId` 생략을 허용하고 server가 UUID를 생성한다. Import에서는 반드시 제공한다. `end`가 제공되면 requested start를 calendar로 정규화한 뒤 duration으로 계산한 dependency 적용 전 end와 일치해야 한다. Dependency가 이후 날짜를 미는 것은 mismatch가 아니라 계산 diff다.

성공은 `201`과 최신 canonical full schedule snapshot, warning 및 operation detail을 반환한다. Frontend는 반드시 server 계산 결과로 화면을 갱신한다.

### `PATCH /api/projects/{publicId}/tasks/{taskId}`

명시된 field만 바꾼다. `start` 변경은 새 `requestedStart`를 만든다. 계산된 `end`만 직접 변경하는 요청은 허용하지 않으며 resize는 `start + duration` 명령으로 변환한다. Summary bar drag/resize는 초기 범위에서 거부한다.

Auto의 비근무 requested start는 다음 근무일로 이동해 `NON_WORKING_START_SHIFTED` warning을 낸다. Manual의 비근무 requested start는 `NON_WORKING_MANUAL_START`, FS violation은 `MANUAL_DEPENDENCY_CONFLICT`로 전체 mutation을 거부한다.

### `DELETE /api/projects/{publicId}/tasks/{taskId}`

관련 Link 삭제와 재계산을 하나의 transaction으로 처리하고 삭제된 Link ID를 결과에 명시한다. 다음 경우는 명시적으로 거부한다.

- Task가 존재하지 않거나 다른 Project에 속한다.
- Leaf 삭제 결과 parent summary가 비게 된다.
- Summary에 child가 있는데 cascade intent가 없다.

Subtree 삭제가 필요하면 별도의 명시적 `cascade=true` 계약과 UI 확인을 구현할 때 추가한다. 초기 route가 암묵적으로 descendant를 삭제하지 않는다.

### `POST /api/projects/{publicId}/task-batches`

Empty summary를 금지하면서 summary와 첫 child를 만들거나 마지막 child를 옮기고 빈 summary를 삭제할 수 있도록 작은 atomic command endpoint를 제공한다. Edit session과 `If-Match`가 필요하다.

```json
{
  "operations": [
    {
      "op": "create",
      "task": {
        "externalId": "SUM-20",
        "name": "Construction",
        "type": "summary",
        "parentExternalId": null,
        "siblingOrder": 1
      }
    },
    {
      "op": "update",
      "externalId": "ACT-100",
      "changes": {
        "parentExternalId": "SUM-20",
        "siblingOrder": 0
      }
    }
  ]
}
```

허용 operation은 `create`, `update`, `delete`뿐이며 각 payload field는 해당 단일-task endpoint allowlist와 같다. Server는 다음 순서로 처리한다.

Batch target은 JSON externalId로 참조하며 URL CRUD의 taskId와 구분한다. 상한은 100 operations, HTTP body 5 MiB이며 최종 aggregate 상한도 검증한다. 한 externalId를 여러 operation의 변경 대상으로 반복 지정하면 거부한다. Parent 참조는 중복 변경 대상에 해당하지 않는다.

1. Operation 수/크기 상한, 중복 target, unknown field를 검증한다.
2. 현재 snapshot의 메모리 복사본에 배열 순서대로 operation을 적용한다.
3. 같은 batch에서 먼저 생성한 external ID를 뒤 operation이 참조할 수 있다. Update/delete 대상이 그 시점에 없거나 이미 삭제되었으면 전체를 거부한다.
4. Sibling order를 최종 parent별 contiguous 순서로 정규화한다.
5. **최종 candidate snapshot 한 번**에 parent type, empty summary, hierarchy/dependency cycle, calendar, Manual/Auto, Summary/WBS 계산을 수행한다. 중간 candidate의 empty summary는 허용하지만 final snapshot에는 허용하지 않는다.
6. Revision을 다시 확인하고 하나의 transaction으로 저장한 뒤 canonical full snapshot을 반환한다.

예를 들어 새 summary와 child를 함께 생성하거나, 기존 task를 새 summary로 감싸거나, 기존 summary의 모든 child를 명시적으로 reparent/delete한 뒤 summary를 삭제할 수 있다. `delete`는 지정한 task 하나만 삭제하며 descendant를 암묵적으로 cascade하지 않는다. 지정 task의 incident Link 삭제는 단일 delete와 동일하게 결과의 `deletedLinkIds`에 명시한다.

Batch가 기존 Link를 깨뜨리거나 Manual conflict를 만들면 전체 실패한다. Task와 Link를 동시에 임의 편집하는 일반-purpose transaction language로 확장하지 않는다. 그 요구가 생기면 별도 versioned command contract를 결정한다.

## 6. Dependency API

### Link response/request

```json
{
  "id": "ce05ae0a-f95d-4e0c-a126-38c7d44b4ec8",
  "predecessorExternalId": "ACT-100",
  "successorExternalId": "ACT-200",
  "type": "FS",
  "lag": 0
}
```

`POST /api/projects/{publicId}/links`, `PATCH /api/projects/{publicId}/links/{linkId}`, `DELETE /api/projects/{publicId}/links/{linkId}`를 제공한다. 모두 edit session과 `If-Match`가 필요하고, 전체 graph validation/recalculation 및 저장은 원자적이다. 성공은 최신 canonical full snapshot을 반환한다.

v1은 leaf task/milestone endpoint, `FS`, `lag: 0`만 허용한다. Summary endpoint, self-link, duplicate, missing/cross-project target, cycle, SS/FF/SF, non-zero lag/lead를 조용히 바꾸거나 버리지 않고 안정 오류 code로 거부한다.

FS/0의 earliest successor start는 predecessor end **다음의 첫 근무일**이다. 이 규칙은 predecessor/successor가 milestone이어도 동일하다.

## 7. Import API

공식 payload contract는 `docs/IMPORT_SCHEMA.md`이며 API 문서가 독자적으로 schema를 변경하지 않는다. Import 대상은 URL로 지정한 기존 Project이고 unlock 상태여야 한다. Payload의 Project name/description은 정보용이며 Project metadata를 덮어쓰지 않는다.

### `POST /api/projects/{publicId}/imports/preview`

Edit session이 필요하지만 Project revision을 변경하지 않는다.

- JSON: `Content-Type: application/vnd.mastergantt.import+json`, body는 schema `1.0` object
- CSV: `Content-Type: text/csv; charset=utf-8`, body는 `docs/IMPORT_SCHEMA.md`의 승인된 CSV 1.0 contract

CSV reader는 BOM 유무를 허용하고 header name으로 mapping한다. Missing/duplicate/unknown header, malformed predecessor JSON array, row별 schema/project metadata 불일치를 거부한다. 임의의 predecessor 축약 문법으로 데이터를 손실시키지 않는다.

Preview 단계도 server가 parsing, schema, business, calendar, hierarchy, dependency와 cycle을 모두 검증한다.

```json
{
  "data": {
    "schemaVersion": "1.0",
    "baseRevision": 7,
    "summary": { "taskCreates": 12, "linkCreates": 9 },
    "normalizedTasks": [],
    "changedTasks": [],
    "warnings": []
  }
}
```

`changedTasks`에는 dependency 때문에 requested schedule에서 이동한 effective start/end와 reason을 포함한다. 오류가 있으면 commit 가능한 부분 결과를 반환하지 않는다.

### `POST /api/projects/{publicId}/imports`

Preview와 같은 payload를 다시 제출하며 edit session 및 `If-Match: "<baseRevision>"`가 필요하다. Server는 payload와 최신 DB 상태를 다시 검증한다.

v1 import는 create-only, all-or-nothing이다.

- Payload 내부 duplicate external ID 또는 Project DB의 기존 external ID가 하나라도 있으면 전체 거부
- Parent/dependency는 같은 batch의 external ID만 참조
- Missing/invalid parent, dependency, cycle, 잘못된 날짜/progress/type 또는 sibling 배열 순서는 전체 거부
- 비지원 dependency type 또는 lag는 전체 거부하고 FS/0으로 자동 변환하지 않음
- Existing task update/delete, implicit replacement, Project metadata 변경 없음
- Manual conflict가 하나라도 있으면 전체 rollback

성공은 `201 Created`와 최신 canonical full snapshot을 반환하고 `operation`에 생성 수와 import warning/diff를 포함한다.

### 입력 상한

초기 server-side 상한 가정은 payload 5 MiB, task 5,000개, 전체 Link 20,000개, task당 predecessor 100개, hierarchy depth 64, 날짜 `1900-01-01..2199-12-31`, 일반 task duration `1..10000` working days이다. Date 계산 결과도 범위를 벗어나면 안 된다. 이는 성능 보장이 아니며 SVAR/Scheduling benchmark 후 producer/consumer 문서를 함께 변경한다. Stream을 무제한 buffering하지 않고 content length와 실제 read bytes를 모두 제한한다.

## 8. Excel Export API

### `GET /api/projects/{publicId}/exports/excel`

Readonly Project 데이터로 Phase 1 `.xlsx`를 생성한다. 성공 header 예시는 다음과 같다.

```text
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="project-<publicId>.xlsx"
```

Export는 DB read snapshot을 먼저 DTO로 만든 다음 transaction 밖에서 ExcelJS workbook을 생성한다. Project Direct URL은 server 설정 `APP_BASE_URL + /projects/ + project.public_id`로만 만들며 password, Cookie, query token을 포함하지 않는다. 상세 sheet와 안전 규칙은 `docs/IMPORT_EXPORT.md`를 따른다.

Phase 2 Gantt sheet endpoint/option은 Phase 1 검증 후 추가하며 현재 계약에 포함하지 않는다.

## 9. 오류와 HTTP status

| HTTP | 대표 code | 의미 |
|---:|---|---|
| 400 | `INVALID_JSON`, `INVALID_REQUEST` | Parse 실패 또는 기본 request 형식 오류 |
| 401 | `EDIT_SESSION_REQUIRED`, `INVALID_CREDENTIALS`, `SESSION_EXPIRED` | 인증 실패 |
| 403 | `ORIGIN_NOT_ALLOWED` | Same-Origin/CSRF 정책 실패 |
| 404 | `PROJECT_NOT_FOUND`, `TASK_NOT_FOUND`, `LINK_NOT_FOUND` | Scope 안에서 대상 없음 |
| 409 | `DUPLICATE_EXTERNAL_ID`, `DEPENDENCY_CYCLE`, `MANUAL_DEPENDENCY_CONFLICT`, `MANUAL_CALENDAR_CONFLICT` | 현재 aggregate와 domain 충돌 |
| 412 | `REVISION_MISMATCH` | stale If-Match |
| 413 | `REQUEST_TOO_LARGE`, `IMPORT_TOO_LARGE` | 일반 body 또는 Import byte/entity/depth/date range 상한 초과 |
| 415 | `UNSUPPORTED_MEDIA_TYPE`, `UNSUPPORTED_IMPORT_FORMAT` | 허용하지 않은 형식 |
| 422 | `INVALID_DATE`, `END_DURATION_MISMATCH`, `MISSING_PARENT`, `UNSUPPORTED_DEPENDENCY` | 의미 validation 실패 |
| 428 | `PRECONDITION_REQUIRED` | If-Match 누락 |
| 429 | `RATE_LIMITED` | rate limit 초과, 가능한 경우 `Retry-After` 포함 |
| 500 | `INTERNAL_ERROR` | 세부정보를 숨긴 server 오류 |

같은 category에서 Project 존재 여부를 password endpoint로 추론하기 어렵게 unlock 오류 메시지와 status를 통일한다. 모든 실패는 transaction 이전 상태를 유지해야 한다.

## 10. 구현 검증

W04에서 아래 항목을 실제 Vitest/Chromium으로 PASS했다.

- strict 생성 입력, malformed UTF-8/JSON/content type/content encoding/선언·실제 32 KiB 상한
- Project+password derived material+최초 session digest 원자 저장, 원문 password DB/응답 미포함, DB 재개방 direct read
- exact Origin, process-global 5/hour limit, KDF concurrency 2, production/local Cookie 속성
- canonical UUID collision bounded retry, public DTO의 Project 격리, malformed/absent UUID 동일 404
- 생성·reload·새 browser Direct Readonly UI, 컬렉션 요청 부재와 API 405, password URL/DOM 비노출

나머지 목록은 후속 전체 제품 검증 항목이다.

- Password 없이 Project GET은 성공하지만 모든 mutation은 실패
- Project create만 preexisting session 없이 성공하며 cross-origin/과도한 요청은 실패
- 올바른/잘못된 password, 만료/revoked/wrong-project session
- `If-Match` 누락 및 stale revision
- Cross-project parent/link ID 거부
- Auto warning, Manual conflict rollback, milestone FS next-working-day
- Invalid/duplicate/missing/circular import와 중간 write 실패 rollback
- Export workbook content type, filename, URL과 secret 미포함
- 오류 response/log에 password, Cookie, hash, SQL/stack이 없음

## 11. 관련 근거

- [HTTP Semantics: If-Match](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match)
- [Node.js Crypto API](https://nodejs.org/api/crypto.html)
- [`better-sqlite3` transaction API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#transactionfunction---function)
- [ExcelJS](https://github.com/exceljs/exceljs)
