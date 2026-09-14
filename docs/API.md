# Backend API

> **Issue #8 전송 정책:** production 기본값은 HTTPS다. `ALLOW_INSECURE_HTTP=true`와 canonical HTTP `APP_BASE_URL`을 함께 설정한 내부망은 production HTTP도 지원한다. 시작·readiness·공유 URL·모든 인증 경로는 같은 정책을 사용한다. `SESSION_COOKIE_SECURE`는 미사용 예약값이며 제거했다. HTTP에서는 `mastergantt_edit`, HTTPS production에서는 `__Host-mastergantt_edit; Secure`를 사용하고 HttpOnly·SameSite=Strict·Path=/·TTL 및 Domain 미설정을 유지한다. 아래 과거 검증 이력의 HTTPS-only 표현은 당시 기준이다. 현재 운영·전환 절차는 [HTTP_OPERATION](HTTP_OPERATION.md)을 따른다.


## 1. 문서 상태와 경계

이 문서는 REST API 계약이다. W04의 Project 생성·직접 Readonly 조회, W05의 edit session lifecycle과 Project 보호 mutation, W06의 pure Calendar/Leaf Scheduling을 기반으로 W07에서 root Leaf Task/Milestone CRUD를 연결했다. W24는 Project 영구 삭제와 명시적 Task→Summary 전환을 포함한 child hierarchy mutation을 추가한다. Link 범위는 Repository CRUD foundation뿐이며 외부 Link route와 FS 재계산은 W09까지 제공하지 않는다. 완료 범위와 검증은 W07/W24 검증 기록과 Calendar/Hierarchy/Import/Export 후속 작업 상태를 함께 본다.

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

### Health endpoints

- `GET /api/health/live`: process와 HTTP router 생존만 확인하며 DB를 열지 않는다. 성공은 `200 { "status": "ok" }`다.
- `GET /api/health/ready`: Node runtime에서 canonical `APP_BASE_URL`, production DB path, application DB 연결, `SELECT 1`, `foreign_keys=1`, 최신 migration의 version/name/checksum ledger 일치를 확인한다. 성공은 `200 { "status": "ok" }`, 실패는 내부 URL·경로·SQL·driver 오류를 숨긴 `503 { "status": "unavailable" }`다. Probe는 DB를 생성하거나 migration하지 않는다.
- 두 응답은 `Cache-Control: no-store`이고 state를 변경하지 않는 public-read다. Docker/Compose와 registry image smoke는 readiness를 사용한다.

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
| Project 목록 discovery | 아니오 | D02 승인: 앱 접속자 전체에게 공개 summary만 반환, 편집 권한 부여 없음 |
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

D02 사용자 승인에 따라 앱 접속 가능한 모든 사용자에게 전체 목록을 제공한다. Session은 필요하지 않으며 `200 OK`, `Cache-Control: private, no-store`를 반환한다. 응답은 `{ "data": { "projects": [] } }` 형식이며 각 항목은 `publicId`, `name`, `description`, `createdAt`, `updatedAt`만 포함한다. 최신 `updatedAt` 내림차순과 안정적인 동률 정렬을 적용한다. 내부 DB ID, password/hash/salt, session/token과 일정 상세는 포함하지 않는다.

DB가 비어 있으면 빈 배열을 반환한다. DB 실패는 공통 sanitized API 오류로 처리하며 빈 목록 성공으로 숨기지 않는다. 이 GET은 session 발급 또는 편집 권한 변경을 수행하지 않는다. 기존 W04의 `405` 비활성 정책은 W23에서 대체했다.

### `GET /api/projects/{publicId}`

Readonly schedule snapshot을 반환한다. Project가 없거나 `publicId`가 canonical lowercase UUID v4가 아니면 동일한 `404 PROJECT_NOT_FOUND`이다. Cookie 유무와 관계없이 `permission: "readonly"`만 반환하며, UI는 W05의 session-current endpoint로 edit 표시를 별도 동기화한다. Mutation은 표시 상태와 무관하게 server에서 다시 인증한다.

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

Edit session, exact same-origin `Origin`, 강한 단일 `If-Match: "<positive revision>"`가 필요하다. strict JSON object에서 `name`과 `description` 중 하나 이상만 변경할 수 있다. Empty object, unknown field, `null`, weak/bare/wildcard/multiple ETag는 거부한다. 성공 시 revision이 정확히 1 증가하며 다음 canonical full snapshot을 반환한다.

```json
{
  "name": "Plant Expansion — Revised",
  "description": "Updated scope"
}
```

```json
{
  "data": {
    "project": { "publicId": "...", "name": "...", "description": "...", "revision": 8, "calendar": { "timezone": "Asia/Seoul", "weekendDays": [6, 0], "holidays": [] } },
    "tasks": [],
    "links": [],
    "warnings": [],
    "operation": {
      "kind": "projectMetadata",
      "changedFields": ["name", "description"]
    }
  }
}
```

응답에는 UI permission을 넣지 않는다. UI는 snapshot과 `GET .../edit-sessions/current`를 분리해 동기화하고 서버는 write transaction 안에서 session과 revision을 최종 재검증한다.

### `DELETE /api/projects/{publicId}`

Project 전체를 삭제하는 보호 mutation이다. 정확히 일치하는 `Origin`, URL Project에 유효한 edit session, 강한 단일 `If-Match: "<positive revision>"`가 모두 필요하다. Request body는 사용하지 않는다. 성공하면 `204 No Content`, `Cache-Control: private, no-store`를 반환하고 현재 단일 edit-session Cookie를 만료한다. 삭제된 resource에는 새 revision이 없으므로 ETag를 반환하지 않는다.

Service는 `IMMEDIATE` transaction 안에서 session의 token digest, Project binding, auth version, strict expiry와 현재 revision을 다시 확인한 후 Project row를 삭제한다. Schema의 Project-scoped foreign key cascade로 holiday, task, dependency, 모든 edit session도 같은 transaction에서 제거한다. 다른 Project의 행은 변경하지 않는다. Cascade나 다른 DB 단계가 실패하면 전체 삭제를 rollback한다.

Canonical 형식이 아니거나 존재하지 않는 `publicId`는 동일한 `404 PROJECT_NOT_FOUND`다. Cookie 없음·malformed·expired·revoked·auth-version 불일치 및 다른 Project 소유 Cookie는 `401 EDIT_SESSION_REQUIRED`, stale revision은 `412 REVISION_MISMATCH`로 처리하며 어떤 경우에도 부분 삭제하지 않는다. 삭제는 복구 기능을 제공하지 않는 영구 작업이므로 UI는 Project 이름을 포함한 명시적 사용자 확인을 거친다.

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

입력은 32 KiB UTF-8 JSON 상한과 strict `{ editPassword }` 계약을 사용한다. 로그인 candidate는 최소 길이로 사전 거부하지 않아 짧거나 빈 잘못된 값도 일반 credential 검증 경계를 통과하며 UTF-8 1,024 bytes를 초과할 수 없다. Unknown Project와 손상 credential에도 지원 profile의 dummy scrypt를 수행한다. W05 개발 경계는 forwarded client IP를 신뢰하지 않고 process-global 50회/15분과 canonical Project별 10회/15분을 함께 적용한다. Project key 저장은 최대 1,024개로 제한하며 capacity 초과는 fail closed한다. Persistent proxy limiter는 D03/W16 범위다.

### `GET /api/projects/{publicId}/edit-sessions/current`

Frontend가 unlock 표시를 동기화하는 선택 endpoint이다. 유효하면 `{ "data": { "permission": "edit", "expiresAt": "..." } }`, 아니면 `{ "data": { "permission": "readonly" } }`를 반환한다. Token 자체는 반환하지 않는다. Canonical Project가 없으면 direct read와 같은 404이고, missing/malformed/unknown/expired/revoked/auth-version mismatch/wrong-project Cookie는 존재하는 Project에서 Readonly다. 이 GET은 session 사용 시각, TTL, Cookie, DB를 변경하지 않는다.

### `DELETE /api/projects/{publicId}/edit-sessions/current`

Exact same-origin `Origin`이 필요하다. 현재 Project에 binding된 session은 revoke하고 같은 name/path/security 속성의 만료 Cookie를 내려 보낸다. Malformed 또는 DB에 없는 token은 안전하게 Cookie를 만료할 수 있고, Cookie가 없어도 성공한다. 전역 `Path=/` Cookie가 다른 Project의 유효 session임을 확인한 경우에는 그 session을 revoke하지 않고 Cookie도 지우지 않는다. Logout은 idempotent하게 `204`를 반환한다.

### `PUT /api/projects/{publicId}/edit-password`

현재 edit session, `If-Match`, `newEditPassword`가 필요하다. 새 salt/hash를 저장하고 auth_version과 revision을 증가시키며 기존 session을 모두 revoke한다. 같은 transaction에서 호출자에게만 새 random session을 발급한다. 성공은 204 No Content, 새 ETag와 Set-Cookie다. 호출자는 새 Cookie로 편집을 유지하고 다른 이전 session은 거부된다. 원문 password는 DB/log/response에 남기지 않는다.

새 password는 생성과 같은 최소 12 Unicode code point·UTF-8 최대 1,024 bytes 정책을 사용한다. 저비용 Origin/input/session/If-Match precheck 뒤 scrypt는 transaction 밖에서 수행하고, 즉시 write transaction에서 session을 먼저, revision을 다음으로 최종 확인한다. 새 credential·`auth_version + 1`·`revision + 1`·전체 revoke·호출자 새 session 중 하나라도 실패하면 모두 rollback한다.

## 5. Task 표현과 API

W24는 root 및 nested `task | milestone` CRUD와 명시적 첫-child 생성에 따른 Task→Summary 전환을 공개한다. Create 요청은 API용 `parentTaskId`를 받고 snapshot은 안정적인 `parentExternalId` 관계를 반환한다. Summary 일정은 Scheduling Engine이 계산하며 이름만 직접 변경할 수 있다. Reorder/task-batch와 WBS 응답 필드는 후속이고, Link mutation과 FS 재계산은 W09 범위다. 기존 snapshot에 Link가 하나라도 있으면 현재 Task mutation은 부분 계산하지 않고 `409 UNSUPPORTED_SCHEDULE_STRUCTURE`로 전체 거부한다.

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
  "parentExternalId": null,
  "siblingOrder": 0
}
```

- 일반 task duration은 정수 `>= 1`, milestone은 `0` 및 `start=end`이다.
- Summary의 requestedStart는 null, scheduleMode는 auto이며 start/end/duration/progress/WBS는 Scheduling Engine 결과다. Summary mode 생략은 auto로 정규화하고 manual은 거부한다. W24 API는 Summary와 parent 관계를 공개하지만 WBS 필드는 아직 HTTP DTO에 추가하지 않는다.
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
  "duration": 2,
  "progress": 0
}
```

Strict 입력은 `externalId?`, `parentTaskId?`, `convertParentToSummary?: true`, `name`, `type`, `scheduleMode?`, `start`, `end?`, `duration`, `progress`, `parentExternalId?: null`이다. Unknown field와 `siblingOrder` 입력은 거부한다. `parentTaskId`는 같은 Project에 속한 canonical lowercase UUID v4 Task ID이며 생략하면 root 끝에, 지정하면 해당 Parent의 마지막 child로 추가한다. Missing/cross-Project Parent는 동일한 `404 TASK_NOT_FOUND`다. `name`은 trim 후 1–200 Unicode code point, `externalId`는 제공 시 well-formed Unicode 1–128 code point이며 control character와 앞뒤 Unicode whitespace를 허용하지 않는다. 일반 Task mutation body는 선언·실제 UTF-8 모두 32 KiB로 제한한다.

기존 일반 Task에 처음 child를 추가하면 그 Task 자체의 날짜·기간·진척 의미가 descendant 집계로 대체된다. 따라서 `parentTaskId`만 보낸 요청은 `409 PARENT_CONVERSION_REQUIRED`로 거부한다. 현재 UI는 #11/PR #23에서 승인된 팝업 생략 정책에 따라 일반 leaf의 첫 하위 추가에 `convertParentToSummary: true`를 명시하며, parent 전환과 child 생성은 한 transaction에서 실행된다. 별도 확인 팝업 생략은 서버의 명시적 옵션 검증을 제거하지 않는다. `convertParentToSummary`는 `parentTaskId` 없이 사용할 수 없다. 이미 Summary인 Parent에는 전환 flag가 필요 없고 Milestone Parent는 `409 INVALID_PARENT_TASK`다. 성공 시 모든 ancestor Summary의 날짜·기간·진척을 다시 계산해 저장하며 Project revision은 정확히 한 번 증가한다.

UI 생성에서는 `externalId` 생략을 허용하고 server가 Task `taskId`와 서로 다른 canonical UUID를 생성한다. Import에서는 반드시 제공한다. `scheduleMode` 생략은 `auto`, `siblingOrder`는 같은 Parent 아래 현재 최대값 다음으로 정한다. `end`가 제공되면 requested start를 calendar로 정규화한 뒤 duration으로 계산한 dependency 적용 전 end와 일치해야 한다. Dependency가 이후 날짜를 미는 것은 mismatch가 아니라 계산 diff다.

성공은 `201`과 최신 canonical full schedule snapshot, warning 및 operation detail을 반환한다. Frontend는 반드시 server 계산 결과로 화면을 갱신한다.

### `PATCH /api/projects/{publicId}/tasks/{taskId}`

Mutable allowlist는 `name`, `scheduleMode`, `start`, `duration`, `progress`, optional assertion `end`다. Empty object와 unknown field를 거부하며 `taskId`, `externalId`, `type`, parent/order는 불변이다. `start` 변경은 새 `requestedStart`를 만든다. 계산된 `end`만 직접 변경하는 요청은 허용하지 않아 `end`가 있으면 `start` 또는 `duration`도 함께 있어야 한다. Client Adapter는 이동을 `start`, 좌측 resize를 `start + duration`, 우측 resize를 `duration` 명령으로 변환한다. 기존 persisted `end`를 새 assertion으로 자동 재사용하지 않는다. Nested leaf 변경 후 모든 ancestor Summary를 같은 transaction에서 재계산한다. Summary는 이름만 변경할 수 있고 날짜·기간·진척·mode는 `409 SUMMARY_SCHEDULE_READONLY`로 거부한다.

Auto의 비근무 requested start는 다음 근무일로 이동해 `NON_WORKING_START_SHIFTED` warning을 낸다. Manual의 비근무 requested start는 `NON_WORKING_MANUAL_START`, FS violation은 `MANUAL_DEPENDENCY_CONFLICT`로 전체 mutation을 거부한다.

### `DELETE /api/projects/{publicId}/tasks/{taskId}`

기본 요청은 기존 계약을 유지하여 Root 또는 nested Leaf/Milestone **한 작업만** 삭제한다. Nested leaf 삭제 후 모든 ancestor Summary를 같은 transaction에서 재계산한다. 마지막 child 삭제는 `EMPTY_SUMMARY_NOT_ALLOWED`, child가 있는 Summary를 명시적 subtree 의도 없이 삭제하면 `SUMMARY_DELETE_UNSUPPORTED`로 거부한다. 기존 Link가 있으면 `UNSUPPORTED_SCHEDULE_STRUCTURE`로 Task·Link·revision을 모두 보존한다.

Issue #31부터 선택 작업과 모든 깊이의 자손을 함께 삭제할 때는 다음처럼 명시적인 query를 사용한다.

```http
DELETE /api/projects/{publicId}/tasks/{taskId}?includeDescendants=true
Origin: <canonical APP_BASE_URL origin>
If-Match: "<current revision>"
```

`includeDescendants=true`는 삭제 범위 의도이며 인증을 대체하지 않는다. 기존 Task DELETE와 동일하게 edit session, exact Origin, strong If-Match가 필요하다. 서버는 client가 전달한 자손 ID/개수를 신뢰하지 않고 write transaction 안에서 현재 저장된 parent 관계로 target subtree를 다시 계산한다. child-first로 target+전체 자손을 제거하고 남은 ancestor Summary를 재계산한 뒤 Project revision을 정확히 1 증가시킨다. 응답의 `operation.deletedTaskExternalIds`에는 실제 삭제한 전체 집합을 기록하고 canonical full snapshot을 반환한다.

다음 경우는 전체 rollback한다.

- Task가 존재하지 않거나 다른 Project에 속한다.
- 선택 범위 밖의 parent Summary가 비게 된다 (`EMPTY_SUMMARY_NOT_ALLOWED`).
- 확인 이후 다른 write로 revision이 바뀐다 (`REVISION_MISMATCH` / HTTP 412).
- 기존 Link가 있어 현재 hierarchy mutation 정책을 만족하지 않는다 (`UNSUPPORTED_SCHEDULE_STRUCTURE`).
- 저장된 계층이 cycle/고아/일정 불일치 등으로 유효하지 않다.

UI는 canonical snapshot의 자손 수를 확인창에 표시하지만 이는 안내값이다. 자손이 있으면 작업명·자손 수·총 삭제 수를 표시하고 명시적으로 `하위 작업 포함 삭제`를 선택한 경우에만 위 query를 보낸다. 취소/Escape/닫기 전에는 DELETE를 보내지 않는다. 확인 당시 revision이 stale이면 최신 snapshot을 재조회한 후 새 범위를 다시 확인해야 하며 자동 재시도하지 않는다.

### `POST /api/projects/{publicId}/task-batches` — W08 계획, 현재 Route 없음

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

이 절은 W09 목표 계약이다. W07은 Project-scoped Link Repository와 snapshot read foundation만 검증하며 Link POST/PATCH/DELETE Route를 만들지 않는다.

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

W09에서 `POST /api/projects/{publicId}/links`, `PATCH /api/projects/{publicId}/links/{linkId}`, `DELETE /api/projects/{publicId}/links/{linkId}`를 제공한다. 모두 edit session과 `If-Match`가 필요하고, 전체 graph validation/recalculation 및 저장은 원자적이다. 성공은 최신 canonical full snapshot을 반환한다.

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
| 409 | `DUPLICATE_EXTERNAL_ID`, `TASK_LIMIT_EXCEEDED`, `UNSUPPORTED_SCHEDULE_STRUCTURE`, `PARENT_CONVERSION_REQUIRED`, `INVALID_PARENT_TASK`, `EMPTY_SUMMARY_NOT_ALLOWED`, `SUMMARY_DELETE_UNSUPPORTED`, `SUMMARY_SCHEDULE_READONLY`, `DEPENDENCY_CYCLE`, `MANUAL_DEPENDENCY_CONFLICT`, `MANUAL_CALENDAR_CONFLICT` | 현재 aggregate와 domain/capability 충돌 |
| 412 | `REVISION_MISMATCH` | stale If-Match |
| 413 | `REQUEST_TOO_LARGE`, `IMPORT_TOO_LARGE` | 일반 body 또는 Import byte/entity/depth/date range 상한 초과 |
| 415 | `UNSUPPORTED_MEDIA_TYPE`, `UNSUPPORTED_IMPORT_FORMAT` | 허용하지 않은 형식 |
| 422 | `INVALID_DATE`, `INVALID_DURATION`, `END_DURATION_MISMATCH`, `NON_WORKING_MANUAL_START`, `MISSING_PARENT`, `UNSUPPORTED_DEPENDENCY` | 기본 JSON shape은 맞지만 일정 의미 validation 실패 |
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


## `POST /api/projects/{sourcePublicId}/copy` — 프로젝트 복사

원본의 유효한 edit session, exact Origin, strong `If-Match`가 필요하다. 요청은 `name`, `description`, `editPassword`, 선택적 `resetProgress`만 허용한다. 성공은 `201 Created`, `Location: /projects/{newPublicId}`, `ETag: "1"`, 새 프로젝트 edit-session Cookie를 반환한다. Project/Task/Link public/internal ID는 새로 발급하고 Task `externalId`, 일정, 계층, FS/lag 0 연결, 휴일을 보존한다. `resetProgress=true`이면 leaf/milestone progress를 0으로 하고 summary progress를 재집계한다. 전체 복사는 하나의 SQLite IMMEDIATE transaction이며 실패 시 신규 aggregate를 남기지 않는다.

Task create/PATCH 및 canonical snapshot의 `ProjectTaskDto`는 `description: string | null`(최대 4,000자)과 `url: string | null`(최대 2,048자, http/https)을 포함한다.
