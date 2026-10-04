# Backend API

## Issue #430 — `task-commands` Cut/Reparent Dependency 경계

`POST /api/projects/{publicId}/task-commands`의 기존 `reparent` schema는 변경하지 않는다. Cut clipboard는 client 상태이며 실제 저장은 `reparent` 한 번으로 수행한다.

- source Task + descendants를 canonical subtree `C`로 계산한다.
- Link의 predecessor/successor가 모두 `C` 내부이면 parent 변경을 허용하고 기존 Link row/ID, endpoint, type, signed lag/lead를 그대로 유지한다.
- 정확히 한 endpoint만 `C` 내부인 incoming/outgoing boundary Link가 있으면 `409 UNSUPPORTED_SCHEDULE_STRUCTURE`로 전체 mutation을 거부한다.
- 양 endpoint가 모두 `C` 밖인 unrelated Link와 Paste anchor의 독립적인 Link는 before/after reparent 제한 사유가 아니다.
- `placement:"child"`가 linked leaf anchor를 Summary endpoint로 전환해야 하는 경우에는 기존 `UNSUPPORTED_SCHEDULE_STRUCTURE` 보호를 유지한다.
- same-parent sibling reorder의 #335 예외, cycle/Project/parent/revision/session/Origin/If-Match 검증과 성공 revision +1 / 실패 +0 원자성은 유지한다.

Frontend의 Context Menu Cut과 Ctrl/Cmd+X도 동일한 boundary 판정을 사용한다. Copy는 #378/#384의 별도 identity 복제 계약을 유지한다.

## Issue #384 — 여러 Copy source의 원자적 처리

`POST /api/projects/{publicId}/task-commands`의 Copy는 `{ "kind": "copy", "taskIds": ["<source-1>", "<source-2>"], "anchorTaskId": "<target>", "placement": "before|after|child" }`를 지원한다. 기존 `taskId` 하나도 호환하며 parser에서 `taskIds: [taskId]`로 정규화한다. 두 필드 동시 제출, source 누락·빈 배열·중복·잘못된 UUID·unknown field는 `400 INVALID_REQUEST`다. 입력 source ID는 ancestor 정리 전 최대 500개이고 기존 UTF-8 JSON body 32 KiB 제한을 유지한다. 최종 Task 수는 descendants를 포함하여 Project의 5000개 상한을 적용한다.

서버는 현재 Project canonical Task로 모든 source를 resolve하고 선택 ancestor가 있는 항목을 root에서 제거한다. 남은 root와 전체 자손을 중복 없이 canonical hierarchy preorder(각 family의 numeric sibling order)로 복사한다. 선택 배열 순서와 WBS 문자열 사전순은 정렬 기준이 아니다. 여러 root는 before/after/마지막 child 위치에 하나의 연속 block으로 삽입하고 subtree 내부 구조를 유지한다. Project 밖·존재하지 않는 source/anchor는 `404 TASK_NOT_FOUND`, stale If-Match는 `412 REVISION_MISMATCH`다.

전체 Copy 집합의 양쪽 endpoint가 포함된 Dependency만 새 Task/Link ID로 복제한다. 서로 다른 root 사이 관계도 포함하며 #378 type/lag·외부 관계 제외·Calendar 및 Dependency 재계산을 재사용한다. 원본 Baseline은 불변이고 복사본 Baseline은 기존 계약대로 null 초기화한다. Summary Baseline은 기존 파생 규칙이다. 물류 직접 연결을 자동 복제하지 않고 원본 연결은 보존한다. Resource/Group Assignment가 집합에 하나라도 있으면 `409 TASK_COPY_ASSIGNMENTS_UNSUPPORTED`로 전체 거부한다.

기존 descendant anchor Copy 호환을 유지하고 anchor가 집합 안이라는 이유로 새 제한을 만들지 않는다. child Paste의 Milestone parent 및 linked leaf→Summary 보호는 유지한다. 생성·root order·일정·Summary 파생·revision +1은 한 IMMEDIATE transaction이며 실패 시 부분 생성·revision +0으로 rollback한다. 응답 full canonical snapshot/changedTaskExternalIds와 단일 Cut/reparent 계약은 유지한다. scoped view는 client 표시 경계이며 서버 권한이나 별도 aggregate가 아니다.

## Issue #378 — `task-commands` Copy의 Dependency 계약

`POST /api/projects/{publicId}/task-commands`의 `kind: "copy"`는 source Task 또는 source subtree를 서버 canonical hierarchy에서 계산한다. 클라이언트가 Link 목록이나 신규 ID를 제출하지 않는다.

- 단일 입력의 `copySet = source + descendants`; 다중 입력은 normalized roots와 각 subtree의 union
- `internalLinks = links where predecessor ∈ copySet AND successor ∈ copySet`
- internal Link만 새 Task endpoint와 새 Link public ID로 생성한다.
- external→internal / internal→external Link는 생성하지 않는다.
- type과 signed lag/lead를 보존한다.
- source subtree에 Resource assignment가 있으면 기존 `TASK_COPY_ASSIGNMENTS_UNSUPPORTED` fail-closed 계약을 유지한다.
- `placement: "child"`가 linked leaf anchor를 Summary endpoint로 전환해야 하는 경우 기존 `UNSUPPORTED_SCHEDULE_STRUCTURE` 보호를 유지한다. linked anchor의 before/after 위치 사용은 허용한다.
- Copy 전체는 edit session, Origin, strong If-Match, Project 격리와 단일 SQLite transaction을 사용하고 성공 시 Project revision을 정확히 1 증가시킨다.
- 성공 응답은 기존 canonical `tasks[]`와 `links[]` 전체를 반환한다. 복제된 Link는 `links[]`에서 새 ID/new endpoint로 확인하며 별도 client-generated Link metadata는 사용하지 않는다.


> **Issue #8 전송 정책:** production 기본값은 HTTPS다. `ALLOW_INSECURE_HTTP=true`와 canonical HTTP `APP_BASE_URL`을 함께 설정한 내부망은 production HTTP도 지원한다. 시작·readiness·공유 URL·모든 인증 경로는 같은 정책을 사용한다. `SESSION_COOKIE_SECURE`는 미사용 예약값이며 제거했다. HTTP에서는 `mastergantt_edit`, HTTPS production에서는 `__Host-mastergantt_edit; Secure`를 사용하고 HttpOnly·SameSite=Strict·Path=/·TTL 및 Domain 미설정을 유지한다. 아래 과거 검증 이력의 HTTPS-only 표현은 당시 기준이다. 현재 운영·전환 절차는 [HTTP_OPERATION](HTTP_OPERATION.md)을 따른다.


## 1. 문서 상태와 경계

이 문서는 REST API 계약이다. W04의 Project 생성·직접 Readonly 조회, W05의 edit session lifecycle과 Project 보호 mutation, W06의 pure Calendar/Leaf Scheduling을 기반으로 W07에서 root Leaf Task/Milestone CRUD를 연결했다. W24는 Project 영구 삭제와 명시적 Task→Summary 전환을 포함한 child hierarchy mutation을 추가한다. Issue #54는 Project 생성/복사와 조회 DTO에 표시용 Owner(`ownerName`)를 추가한다. Link 범위는 Repository CRUD foundation뿐이며 외부 Link route와 FS 재계산은 W09까지 제공하지 않는다. 완료 범위와 검증은 W07/W24 검증 기록과 Calendar/Hierarchy/Import/Export 후속 작업 상태를 함께 본다.

```text
Route Handler
  → Service (authorization, validation, concurrency, transaction orchestration)
    → Scheduling Domain Engine (pure calculation)
    → Repository
      → SQLite
```

Route Handler 안에 SQL이나 일정 알고리즘을 두지 않는다. Client preview나 `canEdit` UI 상태는 mutation 권한의 근거가 아니며, 모든 mutation에서 server가 Project edit session을 다시 검증한다. `ownerName`은 표시용 Project 메타데이터이며 인증 또는 편집 권한 주체가 아니다.

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

Issue #138부터 Project 상태 코드는 `planned`(예정), `in_progress`(진행 중), `completed`(완료)다. DB와 API는 이 코드만 사용하며 UI가 한국어 표시명을 결정한다. 기존 Project는 migration 시 `in_progress`로 이관하고 새 Project 및 복사본의 기본 상태는 `planned`다. 상태 변경에는 별도 전환 제약을 두지 않는다.

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
      "status": "completed",
      "ownerName": "Production Engineering",
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

`operation`의 detail은 operation별로 달라도 `project/tasks/links/warnings` shape은 바꾸지 않는다. 배열 순서는 저장된 hierarchy/sibling 순서와 안정적인 Link 순서를 따른다. Response `ETag`은 body revision과 같다. 이 정책은 초기 소규모 Project에 맞춘 것이며 측정 없이 부분 patch protocol로 바꾸지 않는다. Issue #54 이전 데이터는 `ownerName: null`로 조회될 수 있으며 UI는 이를 `미지정`으로 표시한다.

#### Calendar exception 이름 projection — Issue #315

Canonical Project snapshot의 `project.calendar.exceptions[]`는 Effective Project Calendar의 날짜별 예외를 반환하며, 현재 서버 응답은 표시용 복수 이름 projection인 `names`를 포함할 수 있다.

```json
{
  "date": "2026-12-25",
  "dayType": "NON_WORKING",
  "name": "기독탄신일",
  "names": ["기독탄신일", "회사 휴무"]
}
```

- `name`은 기존 단일 이름 호환 projection을 유지한다.
- `names`는 같은 날짜에 저장된 의미 있는 Project-level 이름을 trim한 뒤 빈 값을 제외하고, 중복을 제거한 deterministic 정렬 결과다.
- `names`는 표시 metadata이며 Scheduling의 날짜별 effective `dayType` 또는 working-day 계산을 추가로 변경하지 않는다.
- `dayType: "NON_WORKING"`인 항목의 이름은 휴일/비근무 사유로 표시할 수 있다. `dayType: "WORKING"`의 이름은 근무 override 사유일 수 있으므로 휴일명으로 해석하면 안 된다.
- 오래된 fixture/client 호환을 위해 TypeScript 계약에서는 `exceptions`와 `names`가 optional이지만, 현재 canonical server snapshot은 materialized exception 정보를 제공한다.
- `holidays[]`는 기존 non-working holiday 호환 projection이며, 복수 source 이름이 필요한 새 UI는 `exceptions[].names`를 우선 사용한다.


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
| SVG/PNG Gantt export | 아니오 | Project read와 같은 공개 범위. SVG endpoint에 Origin/If-Match/크기 제한 적용 |

Project create는 권한 우회가 아니라 독립 bootstrap operation이다. W04는 정확한 `Origin`, UTF-8 JSON content type, 32 KiB 실제/선언 크기, strict 입력과 process-global 5회/1시간 fail-closed limit을 적용한다. Trusted client IP 경계가 아직 없으므로 forwarded header를 신뢰하지 않는다. 성공 시 생성한 Project에 대한 edit session을 같은 응답에서 발급한다. Proxy/IP 기반 persistent protection은 D03/W16에서 확정한다.

## 4. Project와 Session API

### `POST /api/projects`

Project를 만들고 최초 edit session을 발급한다.

입력은 unknown field를 거부한다. `name`은 trim 후 1–200 Unicode code point, `ownerName`은 trim 후 1–100 Unicode code point로 필수이며 표시용 메타데이터일 뿐 계정/권한과 연결하지 않는다. `description`은 원문을 보존하며 0–4,000 code point, `editPassword`는 trim/정규화 없이 1~12 Unicode code point다. 선택적 `status`는 세 코드값만 허용하고 생략하면 `planned`다. `null`이나 알려지지 않은 상태는 `400 INVALID_REQUEST`다. JSON body 상한은 32 KiB다.

```json
{
  "name": "Plant Expansion",
  "ownerName": "Production Engineering",
  "description": "Phase 1 schedule",
  "status": "planned",
  "editPassword": "user-provided-password"
}
```

성공은 `201 Created`, `Location: /projects/{publicId}`, session `Set-Cookie`, 다음 형태의 응답을 반환한다. Project row, `ownerName`, password derived material, 최초 edit session은 하나의 write transaction에서 저장되며 어느 단계가 실패해도 전체 rollback한다.

```json
{
  "data": {
    "project": {
      "publicId": "2fd0c93f-cd37-4b68-9f09-412239d99c79",
      "name": "Plant Expansion",
      "description": "Phase 1 schedule",
      "status": "planned",
      "ownerName": "Production Engineering",
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

D02 사용자 승인에 따라 앱 접속 가능한 모든 사용자에게 전체 목록을 제공한다. Session은 필요하지 않으며 `200 OK`, `Cache-Control: private, no-store`를 반환한다. 응답은 `{ "data": { "projects": [] } }` 형식이며 각 항목은 `publicId`, `name`, `description`, `status`, `ownerName`, `createdAt`, `updatedAt`을 포함한다. 모든 상태를 반환하고 Project List가 기본 상태 필터(`planned + in_progress`)와 검색 조건을 함께 적용한다. 기존 Project의 Owner가 없으면 `ownerName`은 `null`이다. 최신 `updatedAt` 내림차순과 안정적인 동률 정렬을 적용한다. 내부 DB ID, password/hash/salt, session/token과 일정 상세는 포함하지 않는다.

DB가 비어 있으면 빈 배열을 반환한다. DB 실패는 공통 sanitized API 오류로 처리하며 빈 목록 성공으로 숨기지 않는다. 이 GET은 session 발급 또는 편집 권한 변경을 수행하지 않는다. 기존 W04의 `405` 비활성 정책은 W23에서 대체했다.

### `GET /api/projects/{publicId}`

Readonly schedule snapshot을 반환한다. Project가 없거나 `publicId`가 canonical lowercase UUID v4가 아니면 동일한 `404 PROJECT_NOT_FOUND`이다. Cookie 유무와 관계없이 `permission: "readonly"`만 반환하며, UI는 W05의 session-current endpoint로 edit 표시를 별도 동기화한다. Mutation은 표시 상태와 무관하게 server에서 다시 인증한다. `ownerName`은 표시 전용이며 편집 session 여부에 영향을 주지 않는다.

```json
{
  "data": {
    "project": {
      "publicId": "2fd0c93f-cd37-4b68-9f09-412239d99c79",
      "name": "Plant Expansion",
      "description": "Phase 1 schedule",
      "status": "in_progress",
      "ownerName": "Production Engineering",
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

### `POST /api/projects/{sourcePublicId}/copy`

서버에 저장된 원본 Project의 일정·계층·의존관계·휴일을 새 Project로 독립 복사한다. 브라우저 snapshot을 복사 payload로 보내지 않으며, 실제 원본 데이터는 같은 DB transaction 안에서 다시 읽는다.

원본 Project의 **유효한 edit session**, exact same-origin `Origin`, 강한 단일 `If-Match: "<source revision>"`가 필요하다. Project 생성과 동일한 process-global 생성 rate limit 및 password KDF 동시 실행 제한을 적용한다. JSON body는 기존 bounded JSON 정책을 따르고 unknown field를 거부한다.

```json
{
  "name": "Plant Expansion (복사본)",
  "ownerName": "Production Engineering",
  "description": "Next planning cycle",
  "editPassword": "new-project-password",
  "resetProgress": false
}
```

- `name`: 기존 Project 생성과 동일하게 trim 후 1–200 Unicode code point.
- `ownerName`: trim 후 1–100 Unicode code point의 필수 표시용 Owner. 계정 또는 권한 식별자가 아니다.
- `description`: 0–4,000 Unicode code point, 원문 보존.
- 복사본의 `status`는 원본 상태와 관계없이 `planned`다. Copy 입력에서 status를 받지 않는다.
- `editPassword`: 새 Project 전용 비밀번호. 원본 password hash/salt/KDF record를 복사하지 않는다.
- `resetProgress`: 선택값이며 기본 `false`. `true`이면 leaf task/milestone progress를 0으로 만들고 summary progress를 계층 규칙으로 재집계한다.

Password hashing은 write transaction 밖에서 수행한다. 이후 `IMMEDIATE` transaction 안에서 원본 session의 Project binding, authVersion, expiry/revocation과 원본 revision을 다시 검사하고 Project/Owner/Task/Link/Holiday/새 edit session 및 공정·설비·시스템·조율관계·역할·태스크연결·리소스배정을 한 번에 원자적으로 복제한다. 중간 실패 시 전체 rollback한다. 새 Project/Task/Link 및 물류 마스터의 내부·공개 ID는 새로 발급하며 Task `externalId`, 계층/sibling order, Link 관계, 날짜/기간, Project 휴일, 공정 트리 계층, 설비 수량, 시스템 연계를 보존한다. 글로벌 리소스(담당자) ID는 동일 참조를 유지한다. 원본 Project의 revision과 일정은 변경하지 않는다.

성공은 `201 Created`, `Location: /projects/{newPublicId}`, `ETag: "1"`, `Cache-Control: private, no-store`와 새 Project에 binding된 edit-session `Set-Cookie`를 반환한다. 현재 root cookie 정책상 성공 후 브라우저의 편집 session 대상은 새 Project로 전환된다.

```json
{
  "data": {
    "project": {
      "publicId": "new-project-uuid",
      "name": "Plant Expansion (복사본)",
      "description": "Next planning cycle",
      "status": "planned",
      "ownerName": "Production Engineering",
      "revision": 1,
      "calendar": {
        "timezone": "Asia/Seoul",
        "weekendDays": [6, 0],
        "holidays": []
      }
    },
    "tasks": [],
    "links": [],
    "assignments": [],
    "logistics": {
      "processes": [],
      "equipment": [],
      "systems": [],
      "systemLinks": [],
      "taskEquipmentLinks": [],
      "taskSystemLinks": []
    },
    "permission": "edit",
    "operation": {
      "kind": "projectCopy",
      "sourcePublicId": "source-project-uuid",
      "sourceRevision": 7,
      "counts": {
        "tasks": 0,
        "links": 0,
        "holidays": 0,
        "assignments": 0,
        "processes": 0,
        "equipment": 0,
        "systems": 0
      }
    },
    "warnings": []
  }
}
```

주요 오류는 다음과 같다. 공통 sanitized error envelope와 `requestId` 규약을 그대로 따른다.

- `400 INVALID_REQUEST`: strict body 또는 `If-Match` 형식 오류
- `401 EDIT_SESSION_REQUIRED`: 원본 edit session 없음·만료·회수·authVersion 불일치
- `403 ORIGIN_NOT_ALLOWED`: 허용되지 않은 Origin
- `404 PROJECT_NOT_FOUND`: 원본 Project 없음 또는 비정상 publicId
- `412 REVISION_MISMATCH`: 확인한 원본 revision 이후 일정이 변경됨
- `409 PERSISTED_SCHEDULE_INVALID`: 저장된 원본 일정/계층/Link가 복사 가능한 canonical 상태가 아님
- `428 PRECONDITION_REQUIRED`: `If-Match` 누락
- `429 RATE_LIMITED`: Project 생성 rate limit 또는 password KDF capacity 초과

### `PATCH /api/projects/{publicId}`

Edit session, exact same-origin `Origin`, 강한 단일 `If-Match: "<positive revision>"`가 필요하다. strict JSON object에서 `name`, `description`, `status` 중 하나 이상을 변경할 수 있다. `status`만 포함한 PATCH도 허용하며 세 코드값 외의 문자열과 `null`을 거부한다. Empty object, unknown field, weak/bare/wildcard/multiple ETag도 거부한다. Issue #54의 `ownerName`은 현재 생성/복사 시점 표시 metadata이며 이 PATCH의 mutable allowlist에는 포함하지 않는다. 성공 시 revision이 정확히 1 증가하며 다음 canonical full snapshot을 반환한다.

```json
{
  "name": "Plant Expansion — Revised",
  "description": "Updated scope",
  "status": "completed"
}
```

```json
{
  "data": {
    "project": { "publicId": "...", "name": "...", "description": "...", "status": "completed", "ownerName": "Production Engineering", "revision": 8, "calendar": { "timezone": "Asia/Seoul", "weekendDays": [6, 0], "holidays": [] } },
    "tasks": [],
    "links": [],
    "warnings": [],
    "operation": {
      "kind": "projectMetadata",
      "changedFields": ["name", "description", "status"]
    }
  }
}
```

응답에는 UI permission을 넣지 않는다. UI는 snapshot과 `GET .../edit-sessions/current`를 분리해 동기화하고 서버는 write transaction 안에서 session과 revision을 최종 재검증한다.

### `DELETE /api/projects/{publicId}`

Project 전체를 삭제하는 보호 mutation이다. 정확히 일치하는 `Origin`, URL Project에 유효한 edit session, 강한 단일 `If-Match: "<positive revision>"`가 모두 필요하다. Request body는 사용하지 않는다. 성공하면 `204 No Content`, `Cache-Control: private, no-store`를 반환하고 현재 단일 edit-session Cookie를 만료한다. 삭제된 resource에는 새 revision이 없으므로 ETag를 반환하지 않는다.

Service는 `IMMEDIATE` transaction 안에서 session의 token digest, Project binding, auth version, strict expiry와 현재 revision을 다시 확인한 후 Project row를 삭제한다. Schema의 Project-scoped foreign key cascade로 holiday, task, dependency, 모든 edit session도 같은 transaction에서 제거한다. 다른 Project의 행은 변경하지 않는다. Cascade나 다른 DB 단계가 실패하면 전체 삭제를 rollback한다.

Canonical 형식이 아니거나 존재하지 않는 `publicId`는 동일한 `404 PROJECT_NOT_FOUND`다. Cookie 없음·malformed·expired·revoked·auth-version 불일치 및 다른 Project 소유 Cookie는 `401 EDIT_SESSION_REQUIRED`, stale revision은 `412 REVISION_MISMATCH`로 처리하며 어떤 경우에도 부분 삭제하지 않는다. 삭제는 복구 기능을 제공하지 않는 영구 작업이므로 UI는 Project 이름을 포함한 명시적 사용자 확인을 거친다.

### 작업 캘린더 API — Issue #57

Issue #57부터 Project Calendar는 단일 holiday 교체 endpoint가 아니라 **국가 규칙 + Custom 근무/휴무 날짜 예외 + materialized date exception** 계약을 사용한다. 이전 설계 문서의 `PUT /api/projects/{publicId}/calendar`는 구현 API가 아니며 아래 endpoint로 대체한다.

#### `GET /api/work-calendars/countries`

지원 국가와 fixture metadata를 공개 조회한다. 현재 지원 코드는 `KR/CN/VN/PH/TH/MX/US`, 최초 지원 연도는 **2026년**이다. 응답에는 국가 표시명, `supportedYears`, `sourceVersion`, `sourceUrl`이 포함된다. 런타임 외부 공휴일 API를 호출하지 않는다.

#### `GET /api/projects/{publicId}/work-calendar`

Project edit session이 필요하다. 현재 Project의 Calendar rule과 Project 일정 계산에 적용되는 materialized date를 반환한다. 성공 시 `ETag: "<projectRevision>"`과 `Cache-Control: private, no-store`를 반환한다. Resource Group/Resource 개인 휴무 사유를 public readonly snapshot에 노출하지 않기 위해 이 endpoint는 편집 세션 read 정책을 사용한다.

응답 핵심 형태:

```json
{
  "data": {
    "projectRevision": 7,
    "rules": [
      {
        "id": "rule-uuid",
        "kind": "COUNTRY",
        "name": "대한민국 공휴일",
        "countryCode": "KR",
        "targetType": "PROJECT",
        "targetId": null,
        "scope": "FULL_PROJECT",
        "effectiveFrom": null,
        "effectiveTo": null,
        "sourceVersion": "KR-2026-law-2026-05-11"
      }
    ],
    "projectDates": [],
    "customDates": []
  }
}
```

#### `POST /api/projects/{publicId}/work-calendar/preview`

저장하지 않고 후보 Calendar를 materialize하고 일정 영향을 계산한다. **exact same-origin Origin, 유효한 edit session, `If-Match: "<revision>"`가 모두 필요**하다. Preview도 stale revision이면 `412 REVISION_MISMATCH`로 거부한다.

입력은 다음 두 집합이다.

```json
{
  "countryRules": [
    {
      "countryCode": "KR",
      "scope": "FULL_PROJECT",
      "effectiveFrom": null,
      "effectiveTo": null
    },
    {
      "countryCode": "VN",
      "scope": "DATE_RANGE",
      "effectiveFrom": "2026-04-01",
      "effectiveTo": "2026-09-30"
    }
  ],
  "customDates": [
    {
      "name": "회사 창립기념일",
      "date": "2026-08-16",
      "targetType": "PROJECT",
      "targetId": null,
      "dayType": "NON_WORKING"
    }
  ]
}
```

Issue #261: `customDates[].dayType`은 `NON_WORKING | WORKING`이다. 기존 입력의 누락값은 `NON_WORKING`으로 정규화한다. `RESOURCE_GROUP/RESOURCE`는 두 값을 허용하고 `PROJECT`의 CUSTOM `WORKING`은 `400 INVALID_WORK_CALENDAR`로 거부한다. GET의 `data.customDates[]` 및 Preview/PUT의 `data.calendar.customDates[]`는 `{id,name,date,targetType,targetId,dayType}` canonical DTO를 반환한다. 국가 rule은 여러 dayType 날짜를 포함할 수 있으므로 rule-level dayType을 추가하지 않는다.

Preview 응답은 후보 rule/date와 함께 `changedTasks`, `manualConflicts`, `resourceExceptionEffects`를 반환한다. Issue #68부터 저장된 `FS/lag=0` Dependency가 있으면 후보 Calendar로 Leaf base 일정을 계산한 뒤 Dependency DAG forward-pass와 Summary 집계를 같은 서버 Scheduling Domain에서 수행한다. `changedTasks[].reasons`는 `CALENDAR | DEPENDENCY | SUMMARY`를, `dependencyPredecessorExternalIds`는 해당 FS lower bound를 만든 선행 작업을 표시한다. Manual 후행이 새 FS bound를 만족하지 못하면 Preview에는 `reason: "DEPENDENCY"`가 포함되고 저장은 `409 MANUAL_DEPENDENCY_CONFLICT`로 전체 거부한다.

`resourceExceptionEffects[]`는 Resource/Group CUSTOM 입력별로 `{ruleId,customDateIndex,date,dayType,targetType,targetId,effect,warningCode,affectedResources}`를 반환한다. `customDateIndex`는 요청 `customDates[]` 위치다. `affectedResources[]`는 `{resourceId,resourceName,beforeDayType,effectiveDayType,effect,winningLayer,winningSources}`이며, `winningSources[]`는 기존 `WorkCalendarDateSourceDto`와 같은 source 목록이다.

- `CHANGED | NO_EFFECT`는 **바로 위 계층 결과 대비** 해당 예외의 효과다. 더 구체적인 Resource 예외에 가려져도 Group 효과는 CHANGED일 수 있으며, 최종 상태는 `effectiveDayType`과 `winningLayer/winningSources`로 확인한다.
- `winningLayer` 계약은 `BASE | PROJECT | RESOURCE_GROUP | RESOURCE`이며 현재 Resource/Group effect의 최종 승자는 명시적 Resource/Group source다.
- 하나라도 영향 Resource의 상태를 바꾸면 입력별 `CHANGED`, 모두 같으면 `NO_EFFECT`다. 후자는 dayType에 따라 `REDUNDANT_WORKING_EXCEPTION | REDUNDANT_NON_WORKING_EXCEPTION` warning을 반환하고 저장을 허용한다. 구성원이 없는 그룹은 `affectedResources: []` 및 `NO_EFFECT`로 응답하므로 UI는 대상 리소스 없음도 안내한다.
- 같은 level의 같은 dayType은 한 번 적용하면서 모든 source를 보존한다. 반대 dayType은 Resource 예외로 가려져도 오류다. 구성원이 없는 동일 Group target 내부 충돌도 거부한다.

#### `PUT /api/projects/{publicId}/work-calendar`

Preview와 같은 입력을 저장한다. exact same-origin Origin, edit session, `If-Match`가 필요하다. Server는 Client가 계산한 휴일 목록을 authority로 신뢰하지 않고 국가 fixture와 Custom 입력을 다시 검증한다.

하나의 SQLite `IMMEDIATE` transaction에서 session/revision 재검증 → 후보 Calendar materialize 및 Resource same-level 충돌 검사 → Manual conflict 검사 → rule/date 전체 교체 → Auto/Summary 일정 재계산 → Project revision **정확히 1 증가** 순으로 처리한다. 실패 시 Calendar와 Task를 부분 저장하지 않는다. 성공 응답은 Preview shape에 새 `projectRevision`을 포함하며 UI는 canonical Project snapshot을 다시 조회해 기존 Gantt instance에 반영한다.

주요 오류:

- `400 INVALID_WORK_CALENDAR`: 잘못된 국가/대상/범위/날짜/입력 구조
- `401 EDIT_SESSION_REQUIRED`: 편집 세션 없음·만료·불일치
- `403 ORIGIN_NOT_ALLOWED`: Origin 불일치
- `409 CALENDAR_EXCEPTION_CONFLICT`: Project level 동일 날짜의 WORKING/NON_WORKING 충돌
- `409 RESOURCE_CALENDAR_EXCEPTION_CONFLICT`: 동일 Resource에 적용되는 Group 또는 Resource level 동일 날짜의 반대 dayType 충돌
- `409 MANUAL_TASK_CALENDAR_CONFLICT`: Manual Task가 후보 Calendar 자체와 충돌
- `409 MANUAL_DEPENDENCY_CONFLICT`: Manual Task가 후보 Calendar 적용 후 FS lower bound를 위반
- `409 DEPENDENCY_CYCLE`: 저장된 Dependency graph에 cycle 존재
- `409 UNSUPPORTED_SCHEDULE_STRUCTURE`: 저장된 Dependency endpoint/관계가 지원 범위를 벗어남
- `412 REVISION_MISMATCH`: stale Project revision
- `422 COUNTRY_CALENDAR_UNAVAILABLE`: 요청 연도의 검증된 국가 fixture가 없음
- `428 PRECONDITION_REQUIRED`: `If-Match` 누락

충돌 오류는 공통 `error.details[] = {path,code,message}` 계약을 사용한다. `date`, `layer`, `resourceId`, 반복 `groupIds/ruleIds`, `rules.<ruleId>` source별 설명을 제공한다. 빈 그룹은 `resourceId` 설명이 `대상 리소스 없음`이다. 편집권한을 확인한 Calendar API는 rule name을 포함할 수 있지만 글로벌 Catalog membership API의 설명은 타 Project 사유를 노출하지 않고 rule ID만 제공한다.

Project Task 일정에는 `PROJECT` 대상 Calendar만 적용한다. Resource workload는 `Project < Resource Group < Resource` 순서의 명시적 근무/휴무 override를 M/D, M/M 분자, 일별 allocation과 과투입 판정에 사용하며 Task start/end/duration을 이동시키지 않는다.

글로벌 `PUT /api/resource-groups/{groupId}/members`도 결과 membership의 same-level 불변조건을 **모든 Project**에서 검사한다. 배정이 없는 Project 및 비활성 Resource도 포함한다. 관리자 세션/Origin/카탈로그 If-Match 계약은 유지하며 충돌이면 위 `409`를 반환하고 membership, catalog revision, Project revision은 모두 원상태다. 성공한 실제 membership 변경은 catalog revision만 정확히 1 증가시킨다.

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

새 password는 생성과 같은 1~12 Unicode code point 정책을 사용하며 문자 종류 조합은 강제하지 않는다. 저비용 Origin/input/session/If-Match precheck 뒤 scrypt는 transaction 밖에서 수행하고, 즉시 write transaction에서 session을 먼저, revision을 다음으로 최종 확인한다. 새 credential·`auth_version + 1`·`revision + 1`·전체 revoke·호출자 새 session 중 하나라도 실패하면 모두 rollback한다.

## 5. Task 표현과 API

현재 root 및 nested `task | milestone | summary` 생성과 명시적 첫-child 생성에 따른 Task→Summary 전환을 공개한다. Create 요청은 API용 `parentTaskId`를 받고 snapshot은 안정적인 `parentExternalId` 관계를 반환한다. Summary 일정은 Scheduling Engine이 계산하며 이름만 직접 변경할 수 있다. Reorder는 아래 task-commands, atomic task-batch는 task-batch endpoint 계약을 따른다. WBS 응답 필드는 해당 절을 따른다. W24 당시 Link mutation과 FS 재계산은 W09 후속 범위였으며, 현재는 Issue #200의 FS/SS/FF/SF 및 signed lag Link 계약과 Issue #258의 연결 Task 일정 재계산 계약을 따른다. Task 생성·삭제·Indent/Outdent/Convert 등은 기존 명령별 Dependency 보호를 유지한다. **Issue #430부터 Cut-Paste에 대응하는 cross-parent `reparent`는 source subtree 내부 Dependency만 존재하면 허용하고 경계를 넘는 incoming/outgoing Link가 있으면 `409 UNSUPPORTED_SCHEDULE_STRUCTURE`로 거부한다.** Issue #258부터 일반 Task/Milestone의 필드 PATCH는 관계 유무와 무관하게 아래 필드별 계약으로 허용한다. 프로젝트의 다른 Task에만 Link가 있는 경우에는 mutation을 허용하고 기존 Link를 canonical snapshot에 그대로 보존한다.

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
  "description": "Foundation work",
  "url": "https://intranet.example/tasks/ACT-100",
  "parentExternalId": null,
  "siblingOrder": 0
}
```

- 일반 task duration은 정수 `>= 1`, milestone은 `0` 및 `start=end`이다.
- Summary의 requestedStart는 null, scheduleMode는 auto이며 start/end/duration/progress/WBS는 Scheduling Engine 결과다. Summary mode 생략은 auto로 정규화하고 manual은 거부한다. W24 API는 Summary와 parent 관계를 공개하지만 WBS 필드는 아직 HTTP DTO에 추가하지 않는다.
- Summary span duration은 descendant leaf의 최소 start부터 최대 end까지의 working-day 수이며 자식 duration 합이 아니다.
- Summary progress는 일반 descendant task의 duration-weighted finite 0..100 값이며 계산/저장 단계에서 반올림하지 않는다. 일반 task가 하나도 없는 milestone-only summary 정책은 Scheduling 문서를 따른다. Import의 summary date/duration/progress는 optional snapshot이고 authority가 아니며 preview가 파생 결과와의 차이를 보고한다.
- Parent는 같은 Project의 summary만 가능하다. 빈 Summary를 허용하며 missing parent와 hierarchy cycle은 거부한다.

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

Strict 입력은 `externalId?`, `parentTaskId?`, `convertParentToSummary?: true`, `name`, `description?`, `url?`, `type`, `scheduleMode?`, `start`, `end?`, `duration`, `progress`, `parentExternalId?: null`이다. `description`은 최대 10,000 Unicode code point이며 공백-only 값은 `null`로 정규화한다. `url`은 trim 후 최대 4,096 code point의 `http:`/`https:` URL만 허용한다. Unknown field와 `siblingOrder` 입력은 거부한다. `parentTaskId`는 같은 Project에 속한 canonical lowercase UUID v4 Task ID이며 생략하면 root 끝에, 지정하면 해당 Parent의 마지막 child로 추가한다. Missing/cross-Project Parent는 동일한 `404 TASK_NOT_FOUND`다. `name`은 trim 후 1–200 Unicode code point, `externalId`는 제공 시 well-formed Unicode 1–128 code point이며 control character와 앞뒤 Unicode whitespace를 허용하지 않는다. 일반 Task mutation body는 선언·실제 UTF-8 모두 32 KiB로 제한한다.

기존 일반 Task에 처음 child를 추가하면 그 Task 자체의 날짜·기간·진척 의미가 descendant 집계로 대체된다. 따라서 `parentTaskId`만 보낸 요청은 `409 PARENT_CONVERSION_REQUIRED`로 거부한다. 현재 UI는 #11/PR #23에서 승인된 팝업 생략 정책에 따라 일반 leaf의 첫 하위 추가에 `convertParentToSummary: true`를 명시하며, parent 전환과 child 생성은 한 transaction에서 실행된다. 별도 확인 팝업 생략은 서버의 명시적 옵션 검증을 제거하지 않는다. `convertParentToSummary`는 `parentTaskId` 없이 사용할 수 없다. 이미 Summary인 Parent에는 전환 flag가 필요 없고 Milestone Parent는 `409 INVALID_PARENT_TASK`다. 성공 시 모든 ancestor Summary의 날짜·기간·진척을 다시 계산해 저장하며 Project revision은 정확히 한 번 증가한다.

UI 생성에서는 `externalId` 생략을 허용하고 server가 Task `taskId`와 서로 다른 canonical UUID를 생성한다. Import에서는 반드시 제공한다. `scheduleMode` 생략은 `auto`, `siblingOrder`는 같은 Parent 아래 현재 최대값 다음으로 정한다. `end`가 제공되면 requested start를 calendar로 정규화한 뒤 duration으로 계산한 dependency 적용 전 end와 일치해야 한다. Dependency가 이후 날짜를 미는 것은 mismatch가 아니라 계산 diff다.

성공은 `201`과 최신 canonical full schedule snapshot, warning 및 operation detail을 반환한다. Frontend는 반드시 server 계산 결과로 화면을 갱신한다.

### `PATCH /api/projects/{publicId}/tasks/{taskId}`

Mutable allowlist는 `name`, `description`, `url`, `scheduleMode`, `start`, `duration`, `progress`, optional assertion `end`, 그리고 기준 일정 필드 `baselineStart`, `baselineDuration`, `baselineEnd`(또는 `{ start, duration }` 형식의 `baseline`)다. `description`은 최대 10,000 Unicode code point이며 공백만 입력하면 `null`로 정규화한다. `url`은 trim 후 최대 4,096 code point의 `http:`/`https:` URL만 허용하고 `javascript:`, `data:`, `vbscript:`, `file:` 등 다른 scheme은 거부한다. Empty object와 unknown field를 거부하며 `taskId`, `externalId`, `type`, parent/order는 불변이다. `start` 변경은 새 `requestedStart`를 만든다. 계산된 `end`만 직접 변경하는 요청은 허용하지 않아 `end`가 있으면 `start` 또는 `duration`도 함께 있어야 한다. `baselineStart`, `baselineDuration`, `baselineEnd`는 기준 일정을 설정하거나 null로 일괄 지정하여 삭제할 수 있으며, 마일스톤의 기준 기간은 0이다. Client Adapter는 이동을 `start`, 좌측 resize를 `start + duration`, 우측 resize를 `duration` 명령으로 변환한다. 기존 persisted `end`를 새 assertion으로 자동 재사용하지 않는다. Nested leaf 변경 후 모든 ancestor Summary를 같은 transaction에서 재계산(일정 및 자손 전원 baseline 존재 시 summary baseline 자동 파생)한다. Summary는 이름만 변경할 수 있고 날짜·기간·진척·기준일정·mode는 `409 SUMMARY_SCHEDULE_READONLY`로 거부한다.

Issue #258부터 incoming/outgoing/both 관계가 있는 일반 Task/Milestone도 편집할 수 있다. `name/description/url/progress/Baseline`만 보낸 요청은 저장된 effective `start/end`와 `requestedStart`를 그대로 보존하고 필요한 Summary 진척/Baseline만 재집계한다. 일정 필드(`start/duration/scheduleMode/end`)가 있으면 Calendar 정규화 및 optional `end` assertion을 먼저 검사하고 모든 leaf를 각 `requestedStart`에서 다시 만들어 현재 FS/SS/FF/SF와 signed lag 그래프를 재계산한다. `end` assertion은 관계 적용 전 Calendar 계산값에 대한 검증이다. Auto 후행은 지연과 앞당김 모두 가능하며, 명시적으로 바꾸지 않은 후행 요청일과 Baseline은 유지한다.

Auto의 비근무 requested start는 다음 근무일로 이동해 `NON_WORKING_START_SHIFTED` warning을 낸다. Manual의 비근무 requested start는 `422 NON_WORKING_MANUAL_START`, 직접 또는 후행 Manual lower bound 위반은 `409 MANUAL_DEPENDENCY_CONFLICT`다. 최종 날짜가 달라진 모든 leaf의 명시 resource allocation을 한 번 읽어 검사하고 범위를 벗어나면 `409 RESOURCE_ASSIGNMENT_SCHEDULE_CONFLICT`로 거부한다. NULL allocation 날짜는 작업 날짜 상속을 유지한다. metadata/일정/Baseline 혼합 요청도 한 transaction이며 충돌 시 모든 Task/Summary/metadata/Baseline과 revision이 그대로 유지된다.

성공은 revision을 정확히 1 증가시키고 전체 canonical snapshot을 반환한다. `operation.changedTaskExternalIds`는 직접 편집 Task, 원본 effective 일정과 최종 일정이 다른 후행 Task(앞당김 포함), 변경 Summary를 포함한다. Link ID/type/lag, assignment와 logistics 참조는 보존한다. Task PATCH는 type/parent/order/Link를 수정할 수 없으며 연결 작업 삭제·변환·계층 명령의 기존 보호를 우회하지 않는다.

### `DELETE /api/projects/{publicId}/tasks/{taskId}`

기본 요청은 기존 계약을 유지하여 Root 또는 nested Leaf/Milestone **한 작업만** 삭제한다. Nested leaf 삭제 후 모든 ancestor Summary를 같은 transaction에서 재계산한다. 마지막 child 삭제는 성공하고 부모 Summary를 미산정 상태로 유지한다. 자식이 없는 Summary 자체는 단건 삭제할 수 있다. child가 있는 Summary를 명시적 subtree 의도 없이 삭제하면 `SUMMARY_DELETE_UNSUPPORTED`로 거부한다. 삭제 대상 Task가 Dependency endpoint이면 `UNSUPPORTED_SCHEDULE_STRUCTURE`로 Task·Link·revision을 모두 보존한다. 다른 Task 사이에만 Link가 있으면 해당 Link를 보존한 채 삭제를 허용한다.

Issue #31부터 선택 작업과 모든 깊이의 자손을 함께 삭제할 때는 다음처럼 명시적인 query를 사용한다.

```http
DELETE /api/projects/{publicId}/tasks/{taskId}?includeDescendants=true
Origin: <canonical APP_BASE_URL origin>
If-Match: "<current revision>"
```

`includeDescendants=true`는 삭제 범위 의도이며 인증을 대체하지 않는다. 기존 Task DELETE와 동일하게 edit session, exact Origin, strong If-Match가 필요하다. 서버는 client가 전달한 자손 ID/개수를 신뢰하지 않고 write transaction 안에서 현재 저장된 parent 관계로 target subtree를 다시 계산한다. child-first로 target+전체 자손을 제거하고 남은 ancestor Summary를 재계산한 뒤 Project revision을 정확히 1 증가시킨다. 응답의 `operation.deletedTaskExternalIds`에는 실제 삭제한 전체 집합을 기록하고 canonical full snapshot을 반환한다.

선택 범위 밖의 parent Summary가 비어도 삭제는 성공하고 해당 부모의 ID/type과 연결을 유지한다.

다음 경우는 전체 rollback한다.

- Task가 존재하지 않거나 다른 Project에 속한다.
- 확인 이후 다른 write로 revision이 바뀐다 (`REVISION_MISMATCH` / HTTP 412).
- 선택 Task/삭제 subtree에 Dependency endpoint가 포함되어 hierarchy mutation 정책을 만족하지 않는다 (`UNSUPPORTED_SCHEDULE_STRUCTURE`).
- 저장된 계층이 cycle/고아/일정 불일치 등으로 유효하지 않다.

UI는 canonical snapshot의 자손 수를 확인창에 표시하지만 이는 안내값이다. 자손이 있으면 작업명·자손 수·총 삭제 수를 표시하고 명시적으로 `하위 작업 포함 삭제`를 선택한 경우에만 위 query를 보낸다. 취소/Escape/닫기 전에는 DELETE를 보내지 않는다. 확인 당시 revision이 stale이면 최신 snapshot을 재조회한 후 새 범위를 다시 확인해야 하며 자동 재시도하지 않는다.

### `POST /api/projects/{publicId}/task-batches` — W08 계획, 현재 Route 없음

다음은 후속 atomic batch endpoint 계약이다. 빈 Summary 생성·마지막 child 이동은 현재 단건/hierarchy 명령에서도 유효하며, batch에서도 Summary 유형을 유지한다. Edit session과 `If-Match`가 필요하다.

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
5. **최종 candidate snapshot 한 번**에 parent type, empty summary, hierarchy/dependency cycle, calendar, Manual/Auto, Summary/WBS 계산을 수행한다. 중간 및 final snapshot 모두 빈 Summary와 미산정 Summary를 허용하며 부분 NULL Leaf는 거부한다.
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

Link 변경 API는 `POST /api/projects/{publicId}/links`, `PATCH /api/projects/{publicId}/links/{linkId}`, `DELETE /api/projects/{publicId}/links/{linkId}`를 제공한다. 모두 Edit Session, exact same-origin `Origin`, 강한 단일 `If-Match: "<positive revision>"`가 필요하며, 그래프 순환 검증 및 일정 재계산, DB 저장이 원자적으로 이루어진다. 성공 시 최신 canonical full snapshot을 반환한다.

지원되는 링크 속성:
- `type`: 의존성 관계 종류 (`FS`, `SS`, `FF`, `SF`). 기본값은 `FS`.
- `lag`: 근무일수 기준 지연/선행 정수 (`-10000..10000`). 기본값은 `0`.

#### `POST /api/projects/{publicId}/links`
- Body: `{ "predecessorExternalId": string, "successorExternalId": string, "type"?: "FS" | "SS" | "FF" | "SF", "lag"?: number }` (또는 `predecessorId`, `successorId`)
- Summary 엔드포인트, 자기 자신 연결, 동일 선행-후행 중복 연결, 그래프 순환(Cycle)은 오류로 거부한다.

#### `PATCH /api/projects/{publicId}/links/{linkId}`
- Body: `{ "type"?: "FS" | "SS" | "FF" | "SF", "lag"?: number }` (최소 1개 이상 필드 필수)
- 기존 값과 동일한 no-op 변경인 경우 불필요한 재계산 없이 현재 snapshot을 반환한다.
- 유효한 변경인 경우 revision이 1 증가하며 스케줄이 재계산된 새 snapshot을 반환한다.
- 대상 링크가 존재하지 않으면 `404 LINK_NOT_FOUND`, 수동 작업 충돌 등이 발생하면 `409` 계열 오류를 반환한다.

#### `DELETE /api/projects/{publicId}/links/{linkId}`
- 링크를 삭제하고 revision을 1 증가시키며, 종속성 해제에 따른 최신 canonical full snapshot을 반환한다.

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

### `POST /api/projects/{publicId}/exports/excel`

Readonly Project 데이터로 `.xlsx`를 생성한다. exact same-origin `Origin`, strong `If-Match`와 bounded JSON export 옵션을 검사하지만 edit session은 요구하지 않는다. 동일 revision의 canonical snapshot으로 workbook을 만들고 상태 코드는 `Project` sheet 마지막 metadata 행에 한국어 표시명으로 기록한다. 기존 metadata/휴일 행 번호는 유지한다.
- 요청 옵션: `includeDependencies: boolean`, `includeLogistics?: boolean` (선택, 기본 false), `scope: "project"`, `scale: "day"`, `hierarchyDisplay: "expanded"`, `layout`.
- `includeLogistics: true`이고 대상 프로젝트에 물류 데이터가 존재하는 경우, 공정·설비·시스템·제어/조율 관계·담당 역할·태스크-물류 연결 정보를 포함하는 `"Logistics"` 보고용 시트가 추가된다.
현재 workbook 구조와 보안·한도는 [EXCEL_EXPORT.md](EXCEL_EXPORT.md)가 Source of Truth다. 성공 header 예시는 다음과 같다.

```text
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="mastergantt-<publicId>-r<revision>.xlsx"
```

Export는 DB read snapshot을 먼저 DTO로 만든 다음 transaction 밖에서 내부 OOXML/ZIP writer로 Gantt/Tasks/Project, 선택적 Dependencies, 선택적 Logistics sheet를 생성한다. Project 상태는 읽기 전용 metadata로 출력하며 Import의 Project metadata 변경 계약에는 영향을 주지 않는다.

## 8.1. Gantt 이미지 Export API

### `POST /api/projects/{publicId}/exports/gantt-svg`

Readonly Project의 canonical snapshot으로 안전한 SVG를 생성한다. `Origin`, strong `If-Match`, 8 KiB 이하 strict JSON을 검사하며 edit session은 요구하지 않는다. `scope: "project"`는 전체 WBS Grid와 Chart를, `scope: "range"`는 `startDate`부터 `endDate`까지의 Chart만 포함한다. 두 scope 모두 `scale: "day" | "week"`와 `hierarchyDisplay: "expanded"`를 받는다. 기간은 date-only 양끝 포함이며 전체 작업 행을 보존한다. PNG는 별도 API 없이 동일 SVG를 브라우저 Canvas에서 rasterize한다. 성공 MIME은 `image/svg+xml; charset=utf-8`이고 파일명은 `mastergantt-{publicId}-r{revision}[-{startDate}-{endDate}].svg`다. 전체 계약과 한도는 [IMAGE_EXPORT.md](IMAGE_EXPORT.md)를 따른다.

## 9. 오류와 HTTP status

| HTTP | 대표 code | 의미 |
|---:|---|---|
| 400 | `INVALID_JSON`, `INVALID_REQUEST` | Parse 실패 또는 기본 request 형식 오류 |
| 401 | `EDIT_SESSION_REQUIRED`, `INVALID_CREDENTIALS`, `SESSION_EXPIRED` | 인증 실패 |
| 403 | `ORIGIN_NOT_ALLOWED` | Same-Origin/CSRF 정책 실패 |
| 404 | `PROJECT_NOT_FOUND`, `TASK_NOT_FOUND`, `LINK_NOT_FOUND` | Scope 안에서 대상 없음 |
| 409 | `DUPLICATE_EXTERNAL_ID`, `TASK_LIMIT_EXCEEDED`, `UNSUPPORTED_SCHEDULE_STRUCTURE`, `PARENT_CONVERSION_REQUIRED`, `INVALID_PARENT_TASK`, `SUMMARY_DELETE_UNSUPPORTED`, `SUMMARY_SCHEDULE_READONLY`, `DEPENDENCY_CYCLE`, `MANUAL_DEPENDENCY_CONFLICT`, `MANUAL_CALENDAR_CONFLICT`, `RESOURCE_ASSIGNMENT_SCHEDULE_CONFLICT` | 현재 aggregate와 domain/capability 충돌 |
| 412 | `REVISION_MISMATCH` | stale If-Match |
| 413 | `REQUEST_TOO_LARGE`, `IMPORT_TOO_LARGE` | 일반 body 또는 Import byte/entity/depth/date range 상한 초과 |
| 415 | `UNSUPPORTED_MEDIA_TYPE`, `UNSUPPORTED_IMPORT_FORMAT` | 허용하지 않은 형식 |
| 422 | `INVALID_DATE`, `INVALID_DURATION`, `END_DURATION_MISMATCH`, `NON_WORKING_MANUAL_START`, `MISSING_PARENT`, `UNSUPPORTED_DEPENDENCY` | 기본 JSON shape은 맞지만 일정 의미 validation 실패 |
| 422 | `EXPORT_LIMIT_EXCEEDED`, `EXPORT_UNSUPPORTED`, `EXPORT_RANGE_NO_OVERLAP` | Gantt 이미지 생성 한도, 지원되지 않는 구조 또는 기간 미교차 |
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

Issue #54에서 추가한 자동화 검증은 다음과 같다.

- create/copy의 `ownerName` strict 입력 및 trim/Unicode 1–100 code point 경계
- Owner 저장, 목록, readonly snapshot 및 container restart round-trip
- legacy `ownerName: null` 호환과 UI `미지정` 처리
- Owner 저장 실패 시 Project/edit session을 남기지 않는 aggregate rollback
- Chromium create fixture 및 production HTTP/HTTPS transport에서 필수 Owner 계약 검증

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

## Issue #56: Resource workload API

### 작업별 리소스 계획 투입

기존 `PUT /api/projects/{publicId}/tasks/{taskId}/assignments`의 resource target은 선택적으로 `assignmentStart`, `assignmentEnd`, `allocationPercent`를 함께 저장한다. `allocationPercent`는 0 초과 100 이하이며, 명시한 시작/종료일은 leaf task의 서버 확정 일정 범위를 벗어날 수 없다. 시작/종료가 없으면 작업의 확정 `start`/`end`를 상속한다. 기존 Issue #19 데이터의 `allocationPercent: null`은 100%로 추정하지 않으며 공수 합계에서 제외한다. group 직접 할당은 담당 팀 참조이므로 개인 공수를 구성원에게 자동 분배하지 않는다.

### `GET /api/projects/{publicId}/resource-workload?from=YYYY-MM-DD&to=YYYY-MM-DD`

Project readonly 범위에서 리소스 계획 공수를 조회한다. `from`/`to`는 선택 사항이며 서버가 프로젝트 일정 범위와 교차해 유효 구간을 계산한다. leaf task의 직접 resource assignment만 집계하고 Summary/Milestone/group 직접 할당은 개인 계획 공수에서 제외한다.

`M/D = 조회 구간 내 프로젝트 근무일 수 × allocationPercent / 100`으로 계산한다. `RESOURCE_MD_PER_MM`이 유효한 양수일 때만 `M/M = M/D / RESOURCE_MD_PER_MM`을 반환한다. 응답은 그룹 → 리소스 → 작업 계층, assignment 기준 Grand Total, `unsetCount`, 일별 할당률 합계가 100%를 초과하는 `overAllocated` 상태를 포함한다. 복수 그룹 소속 리소스는 각 그룹에 보일 수 있지만 Grand Total은 같은 assignment를 중복 집계하지 않는다. 미소속 리소스는 `미분류 리소스`로 표시한다.

## 공통 Request ID / Correlation 계약

주요 API 응답은 `X-Request-ID`를 반환한다. 오류 응답의 `error.requestId`는 이 헤더와 서버 구조화 로그의 `requestId`와 동일하다. 기본 `TRUST_PROXY=false`에서는 클라이언트 제공 `X-Request-ID`를 무시하고 서버 UUID를 사용한다. `TRUST_PROXY=true`인 신뢰 프록시 경계에서도 UUID 또는 Nginx `$request_id` 32-hex 형식만 수용하고 그 외 값은 재생성한다. 이 설정은 인증, Origin, revision, Cookie 또는 HTTP/HTTPS 정책을 변경하지 않는다.

## Issue #72 — Task hierarchy command

### POST `/api/projects/{publicId}/task-commands`

보호된 Project mutation이다. exact Origin, 유효한 edit session과 strong `If-Match: "<revision>"`가 필요하며 성공은 `200`과 새 ETag/canonical Task snapshot을 반환한다. 한 HTTP 명령은 하나의 SQLite immediate transaction에서 parent/order/type/subtree와 파생 Summary를 저장하고 Project revision을 정확히 1 증가시킨다.

지원 `kind`는 `create`, `convert`, `move`, `indent`, `outdent`, `reparent`, `copy`다. 위치가 필요한 명령은 `before | after | child`를 사용한다. `reparent`는 Cut→Paste와 Grid Drag & Drop의 실제 저장 동작이며 같은 parent 안의 재정렬도 지원한다. **#430부터 cross-parent `reparent`는 source subtree 내부에서 완결되는 Dependency를 그대로 보존하여 허용하고, source 경계를 넘는 incoming/outgoing Link가 있으면 거부한다.** linked anchor의 before/after 위치 사용은 허용하지만 `child`가 linked leaf anchor를 Summary로 전환해야 하면 기존 보호를 유지한다. `copy`는 source subtree에 새 taskId/externalId를 발급하고, **복사 집합 내부에서 양쪽 endpoint가 모두 포함된 Dependency Link만 새 Task endpoint와 새 Link ID로 함께 복제한다(#378)**. 외부→내부/내부→외부 Link는 복제하지 않는다. Indent/Outdent/Convert/Delete 등 다른 관계 민감 구조 mutation의 기존 fail-closed 정책은 유지한다. 프로젝트의 unrelated Link만으로는 다른 Task의 계층 명령을 거부하지 않으며 성공 canonical snapshot에 해당 Link를 보존한다.

Issue #300의 Grid 이동은 기존 `{kind:"reparent", taskId, anchorTaskId, placement:"before"|"after"|"child"}` 입력을 사용한다. Context Menu Up/Down은 기존 `{kind:"move",taskId,direction:"up"|"down"}`이다. 두 경로는 같은 hierarchy service와 sibling 순서 불변조건을 사용한다. Source/target은 SVAR 표시 ID가 아닌 canonical Task public ID로 전달한다. 서버는 이동한 family의 `sort_order`를 `0..N-1`로 정규화하고 parent 변경 시 이전/새 family를 함께 저장한다.

이동 성공 뒤 이름 수정은 최신 revision의 `PATCH /tasks/{taskId}`에 `{name}`만 전달한다. 일반 Task PATCH는 구조 필드(`parentTaskId`, `parentExternalId`, `siblingOrder`, `sort_order`)를 허용하지 않으며 rename/description/progress 변경은 저장된 parent/order를 보존한다. 이동과 후속 이름 저장은 각각 revision +1이며, 후속 PATCH가 이전 revision을 사용하면 `412`로 이름·parent/order를 모두 보존한다. Grid 이동 저장 실패는 canonical 재조회로 복구하고 성공처럼 표시하지 않는다. 새 reorder endpoint/입력 계약은 추가하지 않는다.

경계 이동 등 현재 위치에서 의미 없는 명령은 `409 TASK_COMMAND_NOT_AVAILABLE`, 마지막 child 이동은 기존 부모 Summary를 미산정 상태로 유지하며, Resource Assignment가 포함된 subtree Copy는 현재 `409 TASK_COPY_ASSIGNMENTS_UNSUPPORTED`다. stale revision은 `412 REVISION_MISMATCH`이며 부분 저장은 없다.


## Issue #97 — Link mutation API (implemented)

`POST /api/projects/{publicId}/links` creates an FS/lag=0 dependency and `DELETE /api/projects/{publicId}/links/{linkId}` removes it. Both require a valid edit session, exact allowed Origin and strong `If-Match`; success returns the full canonical project/tasks/links snapshot with revision +1. Unsupported dependency shapes and graph conflicts are rejected atomically.


## Issue #83 assigned-target metadata extension

기존 public-read `GET /api/projects/{publicId}/assigned-targets`의 target metadata는 Project-local Resource 검색을 위해 기존 `kind/id/name/code/active`에 선택적 `description`을 추가한다. endpoint 권한, mutation 여부, revision 계약은 변경하지 않는다. 새 API는 추가하지 않는다.


### `PUT /api/resource-catalog/admin-password` (Issue #99)

유효한 Resource catalog 관리자 Cookie가 필요하다. body는 `newPassword`와 동일한 `confirmPassword`를 받으며 1~12 Unicode 문자 정책을 적용한다. 성공 시 기존 Resource 관리자 세션을 모두 revoke하고 호출자에게 새 관리자 Cookie를 발급한다. 원문 비밀번호는 DB·응답·로그에 남기지 않는다. 최초 자격증명이 없을 때만 `RESOURCE_CATALOG_ADMIN_PASSWORD`를 seed로 사용하고, DB 자격증명이 생성된 이후에는 환경변수 변경으로 덮어쓰지 않는다.

## Issue #329 — 미사용 Resource / Resource Group guarded DELETE

관리자용 Resource Catalog 응답의 각 Resource/Group은 `projectUsageCount`와 `deletable`을 반환한다. 이 값은 UI에서 삭제 가능 여부와 사유를 표시하기 위한 힌트이며 authorization 또는 삭제 가능성의 최종 근거가 아니다.

- Resource usage: Task assignment, 설비 `owner/contributor`, 시스템 `pi/developer`, Resource 대상 Work Calendar의 distinct Project 합집합
- Resource Group usage: Task group assignment, Resource Group 대상 Work Calendar의 distinct Project 합집합
- Group membership 자체는 Project usage가 아니다.

### `DELETE /api/resources/{resourceId}`

Resource catalog 관리자 Cookie, exact allowed Origin, strong catalog `If-Match: "<revision>"`가 필요하다. 하나의 SQLite `IMMEDIATE` transaction 안에서 관리자 session/revision → 최신 Project usage → membership cleanup → Resource 삭제 → catalog revision +1 순으로 처리하고 성공 시 새 canonical Resource Catalog와 ETag를 `200`으로 반환한다.

Project usage가 하나라도 있으면 `409 RESOURCE_IN_USE`로 거부한다. 오류 detail에는 Project 이름/내용을 노출하지 않고 `PROJECT_USAGE_COUNT`와 실제 존재하는 usage category별 Project count만 포함한다.

### `DELETE /api/resource-groups/{groupId}`

동일한 관리자/Origin/`If-Match` 계약을 사용한다. Project usage가 0일 때 해당 Group의 `resource_group_members`만 정리하고 Group row를 삭제하며 member Resource row는 보존한다. 사용 중이면 `409 RESOURCE_GROUP_IN_USE`로 원자 거부한다.

두 DELETE 모두 stale catalog는 기존 `412 CATALOG_REVISION_MISMATCH`, 관리자 session 부재/만료는 `401 RESOURCE_ADMIN_SESSION_REQUIRED`, Origin 불일치는 `403 ORIGIN_NOT_ALLOWED`를 유지한다. UI의 `deletable`이 true였더라도 DELETE transaction에서 usage를 다시 계산하므로 동시 Project 할당/Calendar/Logistics 역할 생성은 fail-closed한다.

## Issue #184: Logistics Domain API

물류 공정·설비·시스템 관리 API는 프로젝트 편집 세션(`mastergantt_edit` / `__Host-mastergantt_edit`), 허용된 `Origin`, strong `If-Match: "<revision>"` 검증을 필수로 요구하며, 성공 시 상태 변경과 함께 프로젝트 `revision`을 1 증가시키고 새 ETag와 함께 `200`을 반환한다 (`DELETE`는 `204`).
모든 스냅샷(`GET /api/projects/{publicId}`) 및 프로젝트/태스크/링크 뮤테이션 응답의 `data`에는 `logistics?: ProjectLogisticsDto` aggregate가 항상 포함된다.

### 1. 물류 도메인 조회
- `GET /api/projects/{publicId}/logistics`: 프로젝트의 공정, 설비, 시스템 전체 구성을 조회한다 (Public-read).

### 2. 공정 (Processes)
- `POST /api/projects/{publicId}/logistics/processes`: 공정 생성 (`name`, `code?`, `parentId?`, `sortOrder?`, `active?`). `code` 생략 시 서버가 생성한 공정 public UUID로 `PROC-<UUID>` 내부 코드를 만들며, 명시적으로 전달한 유효 code는 기존 호환 계약대로 보존한다. 명시적 blank/64자 초과 code는 validation error이며 생략과 구분한다.
- `PATCH /api/projects/{publicId}/logistics/processes/{processId}`: 공정 수정 (`code?`, `name?`, `parentId?`, `sortOrder?`, `active?`)
- `DELETE /api/projects/{publicId}/logistics/processes/{processId}`: 공정 영구 삭제 (하위 공정, 소속 설비, 시스템 매핑이 존재할 경우 `409 PROCESS_IN_USE` 거부. 비활성화는 PATCH active=false)

### 3. 설비 (Equipment)
- `POST /api/projects/{publicId}/logistics/equipment`: 설비 생성 (`processId`, `code`, `name`, `equipmentType`, `managementUnit`, `quantity`, `manufacturer?`, `model?`, `description?`, `active?`)
- `PATCH /api/projects/{publicId}/logistics/equipment/{equipmentId}`: 설비 수정
- `DELETE /api/projects/{publicId}/logistics/equipment/{equipmentId}`: 설비 영구 삭제 (제어 시스템 매핑 등이 존재할 경우 `409 EQUIPMENT_IN_USE` 거부)
- `PUT /api/projects/{publicId}/logistics/equipment/{equipmentId}/systems`: 설비-시스템 매핑 교체 (`systems: [{ systemId, controlRole: 'primary' | 'supporting' }]`, primary는 최대 1개)
- `PUT /api/projects/{publicId}/logistics/equipment/{equipmentId}/resource-roles`: 설비 담당자 배정 교체 (`roles: [{ resourceId: string, role: 'owner' | 'contributor', isPrimary?: boolean }]`, `owner`만 `isPrimary` 가능, `isPrimary` 최대 1개, 비활성 리소스 신규 배정 시 `409 RESOURCE_INACTIVE` 거부, 기존 배정 유지 허용)

### 4. 제어 및 조율 시스템 (Logistics Systems)
- `POST /api/projects/{publicId}/logistics/systems`: 시스템 생성 (`code`, `name`, `systemType`, `layer`, `scope`, `vendor?`, `description?`, `active?`)
- `PATCH /api/projects/{publicId}/logistics/systems/{systemId}`: 시스템 수정
- `DELETE /api/projects/{publicId}/logistics/systems/{systemId}`: 시스템 영구 삭제 (설비 연결, 연계 링크, 공정 매핑 존재 시 `409 SYSTEM_IN_USE` 거부)
- `PUT /api/projects/{publicId}/logistics/systems/{systemId}/processes`: 프로세스 스코프 시스템의 담당 공정 매핑 교체 (`processIds: string[]`)
- `PUT /api/projects/{publicId}/logistics/systems/{systemId}/children`: 상위 조율 시스템의 하위 시스템 연계 교체 (`childSystemIds: string[]`, DAG 순환 방지 검증)
- `PUT /api/projects/{publicId}/logistics/systems/{systemId}/resource-roles`: 시스템 PI/개발자 배정 교체 (`roles: [{ resourceId: string, role: 'pi' | 'developer', isPrimary?: boolean }]`, `pi`만 `isPrimary` 가능, `isPrimary` 최대 1개, 비활성 리소스 신규 배정 시 `409 RESOURCE_INACTIVE` 거부, 기존 배정 유지 허용)

### 5. 프로젝트 복사·삭제·내보내기 연계 (Issue #189 LG-06)
- `POST /api/projects/{publicId}/copy`: Issue #184의 임시 복사 가드(`409 LOGISTICS_COPY_NOT_SUPPORTED_YET`)를 해제하고, 동일 transaction 안에서 공정 트리, 설비, 시스템, 제어·조율 관계, 리소스 역할, 태스크 물류 연결 및 리소스 배정을 원자적으로 복제한다.
  - 새 프로젝트 및 복사 대상 로컬 엔티티에 새로운 UUID v4 public ID 발급, 부모-자식 계층 관계 보존, 글로벌 리소스 ID 동일 참조 유지.
  - 비활성 마스터/리소스 복사 시 `warnings` 반환, resetProgress 진척률 0% 초기화 및 WBS Summary 엔진 재계산 지원.
- `DELETE /api/projects/{publicId}`: SQLite 외래 키 cascade를 통해 프로젝트 삭제 시 소속 공정·설비·시스템·역할·태스크 연결이 원자적으로 정리되며, 타 프로젝트 및 글로벌 리소스는 보존된다.
- `POST /api/projects/{publicId}/exports/excel`: `includeLogistics: true` 요청 시 물류 구성 요약, 공정, 설비, 시스템, 태스크-물류 연결 정보를 포함하는 `"Logistics"` 보고용 시트를 추가한다 (수식 주입 방지 처리 및 비가역 보고용 명시).

## Issue #187: Task Logistics Links API (Summary·Task·Milestone 설비·시스템 연결)

태스크(Summary, Leaf Task, Milestone)와 물류 도메인(설비, 시스템)을 연결하는 API이다.
Summary 작업은 `scope: 'subtree'`를 통해 하위 자손 작업들에 설비/시스템 연결을 상속할 수 있다.

### 1. 작업별 물류 연결 조회
- `GET /api/projects/{publicId}/tasks/{taskId}/logistics-links`
  - Public-read (편집 세션 불필요).
  - 응답:
    ```json
    {
      "data": {
        "directEquipmentLinks": [
          { "equipmentId": "eq-uuid", "scope": "self" }
        ],
        "directSystemLinks": [
          { "systemId": "sys-uuid", "scope": "subtree" }
        ],
        "inheritedEquipmentLinks": [
          {
            "equipmentId": "eq-uuid-2",
            "scope": "subtree",
            "sourceTaskId": "parent-task-uuid",
            "sourceTaskName": "1단계 Summary"
          }
        ],
        "inheritedSystemLinks": []
      }
    }
    ```

### 2. 작업별 물류 연결 교체
- `PUT /api/projects/{publicId}/tasks/{taskId}/logistics-links`
  - 프로젝트 편집 세션, 동일한 `Origin`, 강한 단일 `If-Match: "<revision>"` 필수.
  - 요청 본문:
    ```json
    {
      "equipmentLinks": [
        { "equipmentId": "eq-uuid", "scope": "self" }
      ],
      "systemLinks": [
        { "systemId": "sys-uuid", "scope": "subtree" }
      ]
    }
    ```
  - 제약 및 동작 규칙:
    - `scope: 'subtree'`는 대상 작업이 `type === 'summary'`인 경우에만 지정 가능. 일반 Task나 Milestone에 `subtree` 지정 시 `400 INVALID_TASK_LOGISTICS_LINKS`로 거부.
    - 비활성(`active = false`) 설비/시스템의 신규 연결 시도는 `409 EQUIPMENT_INACTIVE` 또는 `409 SYSTEM_INACTIVE`로 거부. 단, 기존에 이미 연결되어 있던 비활성 항목의 유지는 허용.
    - 유효하지 않거나 다른 프로젝트에 속한 설비/시스템 ID 지정 시 `400 INVALID_TASK_LOGISTICS_LINKS`로 거부.
    - SQLite immediate transaction 내에서 원자적으로 교체되며, 성공 시 프로젝트 `revision`을 정확히 1 증가시키고 새 ETag와 함께 교체된 연결 목록 및 상속 목록을 반환.
  - 마스터 삭제 보호:
    - 설비 또는 시스템에 연결된 태스크 링크(직접 연결)가 1개 이상 존재하는 경우, 설비/시스템 영구 삭제(`DELETE ...?hardDelete=true`) 시 각각 `409 EQUIPMENT_IN_USE`, `409 SYSTEM_IN_USE`로 차단.

## 13. 물류 대시보드 API (Logistics Dashboard API, #188)

### `GET /api/projects/{publicId}/logistics/dashboard`
- **권한**: Public-read (프로젝트 직람 가능 시 편집 세션 불필요).
- **설명**: 물류 프로젝트의 3개 핵심 KPI(기간 가중 진척률, 미완료 지연 작업, 마일스톤 경보), 보조 계획 공수(M/D, M/M), 데이터 품질 진단, 공정·설비·시스템별 세부 집계를 단일 읽기 트랜잭션 내에서 일관된 스냅샷으로 계산하여 반환한다.
- **쿼리 파라미터**:
  - `asOfDate` (string, `YYYY-MM-DD`): 기준일 (기본값: 오늘 일자).
  - `horizonDays` (number, `1`~`90`): 마일스톤 임박 판정 기간 일수 (기본값: `14`).
  - `systemView` (`"direct"` | `"coordination"`): 시스템 집계 모드 (기본값: `"direct"`).
    - `direct`: 태스크에 직접 연결된 시스템 기준.
    - `coordination`: Coordinator DAG를 순회하여 하위 Controller 및 해당 Controller가 제어하는 설비까지 roll-up(중복 태스크는 정확히 1번만 집계).
  - `activeOnly` (boolean): `true`일 경우 활성(`active = true`) 마스터 항목만 집계에 포함 (기본값: `false`).
  - `includeDescendantProcesses` (boolean): 공정 필터 시 하위 공정 포함 여부 (기본값: `true`).
  - `mdPerMm` (number): M/M 환산 기준 M/D 일수 (기본값: `20`, 양수).
  - `processIds` (string): 콤마로 구분된 공정 ID 목록.
  - `equipmentIds` (string): 콤마로 구분된 설비 ID 목록.
  - `systemIds` (string): 콤마로 구분된 시스템 ID 목록.
  - `taskAssigneeResourceIds` (string): 콤마로 구분된 태스크 배정 리소스 ID 목록.
  - `roleResourceIds` (string): 콤마로 구분된 설비/시스템 담당 역할 리소스 ID 목록.
- **성공 응답** (`200 OK`):
  ```json
  {
    "data": {
      "project": {
        "publicId": "project-public-id",
        "name": "스마트 물류센터 프로젝트",
        "status": "in_progress",
        "revision": 12
      },
      "catalogRevision": 3,
      "asOfDate": "2026-10-06",
      "horizonDays": 14,
      "systemView": "coordination",
      "kpis": {
        "progressPercent": 62.5,
        "overdueLeafTaskCount": 1,
        "delayedMilestoneCount": 0,
        "upcomingMilestoneCount": 1,
        "totalLeafTaskCount": 3,
        "totalMilestoneCount": 1,
        "totalDurationDays": 8
      },
      "effort": {
        "plannedTotalMd": 5.0,
        "plannedTotalMm": 0.25,
        "unassignedEffortLeafTaskCount": 1,
        "mdPerMm": 20
      },
      "quality": {
        "unlinkedLeafTaskCount": 0,
        "totalLeafTaskCount": 3,
        "unlinkedLeafTaskPercent": 0,
        "equipmentWithoutPrimaryControllerCount": 0,
        "equipmentWithoutOwnerCount": 0,
        "systemsWithoutPrimaryPICount": 0,
        "totalEquipmentQuantity": 8
      },
      "breakdowns": {
        "processes": [
          {
            "id": "proc-id",
            "code": "P1",
            "name": "보관공정",
            "parentProcessId": null,
            "sortOrder": 1,
            "active": true,
            "taskCount": 1,
            "progressPercent": 50.0,
            "overdueTaskCount": 1,
            "plannedMd": 2.0,
            "taskIds": ["task-1"]
          }
        ],
        "equipment": [
          {
            "id": "eq-id",
            "code": "E1",
            "name": "Stocker unit1",
            "equipmentType": "stocker",
            "quantity": 1,
            "processId": "proc-id",
            "processName": "보관공정",
            "primaryControllerName": "SCS",
            "ownerName": "홍길동",
            "active": true,
            "taskCount": 1,
            "progressPercent": 50.0,
            "overdueTaskCount": 1,
            "plannedMd": 2.0,
            "taskIds": ["task-1"]
          }
        ],
        "systems": [
          {
            "id": "sys-id",
            "code": "C3",
            "name": "MCS",
            "systemType": "mcs",
            "layer": "coordinator",
            "scope": "project",
            "primaryPiName": "홍길동",
            "active": true,
            "taskCount": 3,
            "progressPercent": 62.5,
            "overdueTaskCount": 1,
            "plannedMd": 5.0,
            "taskIds": ["task-1", "task-2", "task-3"]
          }
        ]
      },
      "includedLeafTaskIds": ["task-1", "task-2", "task-3"],
      "includedMilestoneIds": ["milestone-1"]
    }
  }
  ```

## 13. 프로젝트 템플릿 API (Issue #195)

프로젝트 템플릿 등록, 관리, 복제 및 템플릿 기반 새 프로젝트 생성을 지원한다.
작업 일정은 첫 작업 기준 근무일 오프셋(`offsetDays`)으로 직렬화되며, 템플릿 인스턴스화 시 입력받은 프로젝트 시작일과 작업 캘린더를 기반으로 스케줄링 엔진(`recalculateFinishStartDependencies`, `recalculateHierarchy`)을 통해 모든 일정이 자동 재계산된다.

### `GET /api/project-templates`

템플릿 목록을 조회한다.

- 인증: 불필요 (Public-read)
- Query Parameters:
  - `activeOnly` (boolean, 기본 `true`): 활성 템플릿만 조회
  - `search` / `query` (string, 선택): 템플릿 이름 또는 설명 검색어
- Response: `200 OK`
  ```json
  {
    "data": [
      {
        "id": "tmpl-uuid",
        "name": "표준 입고 자동화 템플릿",
        "description": "물류 입고 자동화 표준 일정 및 설비 템플릿",
        "sourceProjectId": "1",
        "sourceProjectName": "원본 프로젝트",
        "active": true,
        "taskCount": 4,
        "milestoneCount": 1,
        "processCount": 1,
        "equipmentCount": 2,
        "systemCount": 1,
        "createdAt": "2026-09-27T00:00:00.000Z",
        "updatedAt": "2026-09-27T00:00:00.000Z"
      }
    ]
  }
  ```

### `POST /api/project-templates`

기존 프로젝트의 일정(상대 오프셋), WBS 계층, FS 링크, 리소스 배정 및 물류 마스터/연결을 추출하여 템플릿을 생성한다.

- 인증: 프로젝트 편집 세션 필요 (`mastergantt_edit` 쿠키)
- Headers:
  - `If-Match: "{revision}"` (필수)
  - `Content-Type: application/json`
  - `Origin` (허용된 Origin 검증)
- Request Body:
  ```json
  {
    "sourceProjectPublicId": "source-project-uuid",
    "name": "새 템플릿 명칭",
    "description": "템플릿 설명 (선택)"
  }
  ```
- Response: `201 Created`
  - `Location: /api/project-templates/{templateId}`
  - Body: 템플릿 상세 DTO (`data.previewTasks` 포함)

### `GET /api/project-templates/{templateId}`

템플릿 상세 정보 및 작업 미리보기 목록을 조회한다.

- 인증: 불필요 (Public-read)
- Response: `200 OK`
  ```json
  {
    "data": {
      "id": "tmpl-uuid",
      "name": "표준 입고 자동화 템플릿",
      "description": "설명",
      "sourceProjectId": "1",
      "sourceProjectName": "원본 프로젝트",
      "active": true,
      "taskCount": 4,
      "milestoneCount": 1,
      "processCount": 1,
      "equipmentCount": 2,
      "systemCount": 1,
      "previewTasks": [
        {
          "externalId": "task-t1",
          "name": "설비 설계",
          "type": "task",
          "scheduleMode": "auto",
          "offsetDays": 0,
          "duration": 2,
          "parentExternalId": "task-s1",
          "siblingOrder": 1
        }
      ],
      "sourceRevision": 8,
      "createdAt": "2026-09-27T00:00:00.000Z",
      "updatedAt": "2026-09-27T00:00:00.000Z"
    }
  }
  ```

### `PATCH /api/project-templates/{templateId}`

템플릿 이름, 설명, 활성 상태를 수정한다.

- 인증: Origin 검증
- Request Body:
  ```json
  {
    "name": "수정된 템플릿 명칭",
    "description": "수정된 설명",
    "active": true
  }
  ```
- Response: `200 OK`

### `DELETE /api/project-templates/{templateId}`

템플릿을 삭제한다. 이미 인스턴스화된 프로젝트에는 영향을 주지 않는다.

- 인증: Origin 검증
- Response: `200 OK`
  ```json
  { "success": true }
  ```

### `POST /api/project-templates/{templateId}/duplicate`

템플릿을 복제하여 새로운 독립 사본 템플릿을 생성한다.

- 인증: Origin 검증
- Request Body: `{ "name": "복제된 템플릿 명칭" }` (선택)
- Response: `201 Created`

### `POST /api/project-templates/{templateId}/instantiate`

템플릿을 기반으로 지정된 시작일자에 맞춰 일정을 자동 재계산하고 새 프로젝트를 생성한다.

- 보안: Origin 검증 및 프로젝트 생성 rate limit 적용
- Request Body:
  ```json
  {
    "name": "새 프로젝트 명칭",
    "ownerName": "담당자 / 소유자 명칭",
    "editPassword": "새 편집 비밀번호 (1~12자)",
    "projectStartDate": "2026-11-02",
    "description": "프로젝트 설명 (선택)"
  }
  ```
- 동작:
  - 템플릿의 첫 시작일 기준 상대 근무일 오프셋(`offsetDays`)을 지정된 `projectStartDate`에 더해 시작일 계산 (공휴일/주말 회피).
  - FS 링크 및 WBS Summary 계층 자동 재계산 (`recalculateFinishStartDependencies` + `recalculateHierarchy`).
  - 모든 진척률(`progress`) 0% 초기화.
  - 리소스 배정 및 물류 마스터(공정, 설비, 시스템, 역할, 링크) 독립 ID로 복제.
  - 새 프로젝트의 편집 세션 쿠키(`mastergantt_edit`) 발급.
- Response: `201 Created`
  - `Location: /projects/{newProjectPublicId}`
  - `Set-Cookie: mastergantt_edit=...`
  - Body: `InstantiateProjectTemplateResponse`

## Logistics Type Catalog API (Issue #280)

일반 읽기:
- `GET /api/logistics-catalog/types` — active 설비/시스템 유형의 `code`, `name`만 반환한다.

관리자 세션:
- `POST /api/logistics-catalog/admin-sessions`
- `DELETE /api/logistics-catalog/admin-sessions`
- `PUT /api/logistics-catalog/admin-password`

관리자 카탈로그:
- `GET/POST /api/logistics-catalog/admin/equipment-types`
- `PATCH /api/logistics-catalog/admin/equipment-types/{code}`
- `GET/POST /api/logistics-catalog/admin/system-types`
- `PATCH /api/logistics-catalog/admin/system-types/{code}`

Mutation은 exact Origin과 `If-Match: "<catalog revision>"`을 요구한다. stale revision은 412, 인증 없음은 401, 중복/DB 무결성 충돌은 409 계열로 처리한다. hard delete와 stable code 변경은 제공하지 않는다.

## Issue #288 Resource developer grade

Resource Catalog의 Resource 응답은 `developerGrade: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT" | null`을 포함한다. Resource 생성/수정 요청은 동일한 `developerGrade` 값을 선택적으로 받으며 빈 문자열·대소문자 변형·지원하지 않는 값은 `400 INVALID_REQUEST`로 거부한다. Group에는 개발자 등급 의미를 부여하지 않는다.

`PUT /api/projects/{publicId}/logistics/systems/{systemId}/resource-roles`에서 새로운 `developer` 역할 조합은 대상 Resource의 `developerGrade`가 필수다. 미지정이면 `409 DEVELOPER_GRADE_REQUIRED`를 반환한다. migration 이전부터 존재하던 동일 `developer + grade NULL` 조합을 그대로 보존하는 요청은 호환성을 위해 허용하며, 역할 해제는 Resource 등급을 수정하지 않는다. 기존 edit-session, Origin, strong `If-Match`, project revision 계약은 유지한다.


## Issue #289 — Project master catalog API

- `GET /api/project-master/catalog`: Project 생성/편집용 active 사업부·제품·사업장/법인과 catalog revision을 반환한다.
- `POST|DELETE /api/project-master/admin-sessions`: 별도 project-master 관리자 세션을 생성/종료하며 로그인은 bounded rate-limit을 적용한다.
- `PUT /api/project-master/admin-password`: 인증된 관리자 비밀번호를 회전하고 기존 세션을 revoke한다.
- `GET|POST /api/project-master/admin/items`, `PATCH /api/project-master/admin/items/{itemId}`: 전체 master 목록/usage count 조회와 추가·표시명·활성 상태·정렬 순서 변경을 제공한다. mutation은 Origin, 관리자 Cookie와 strong `If-Match` catalog revision을 요구한다.

Project create/update request는 `businessUnitId/productId/siteEntityId: string | null`을 선택적으로 받는다. canonical Project DTO/List는 선택된 항목을 `{id, code, name, active}`로 반환한다. 신규 선택은 inactive를 거부하지만 현재 Project의 inactive 참조는 다른 메타데이터 저장 때문에 제거되지 않는다. 사용 중 stable code 변경은 `409 PROJECT_MASTER_ITEM_IN_USE`로 거부한다.

## Issue #344 — Task DELETE 실패 후 frontend canonical 복구

서버 API 계약 변경 없음. frontend의 canonical snapshot 수용·실패 복구를 보완한다. Task DELETE 성공은 기존처럼 revision을 증가시키고 canonical full snapshot을 반환한다. Issue #345 이후 마지막 child 삭제·이동은 성공한다. 유효한 거부 조건(401/412 또는 보호되는 Dependency endpoint 등)은 현재 mutation만 거부하며, 이전 성공 삭제나 revision을 되돌리지 않는다. unrelated Link 보존, 인증·Origin·strong `If-Match` 계약은 유지한다.

Frontend는 현재 Project `publicId`와 마지막 확정 revision을 기준으로 snapshot을 확인한다. 다른 Project snapshot과 더 낮은 revision은 적용하지 않는다. `401/409/412/network` 실패 뒤 canonical GET은 `cache: "no-store"`로 요청하고, 확인 가능한 같은 revision 이상의 서버 snapshot만 적용한다. GET 실패 또는 오래된 응답에서는 마지막 확정 snapshot을 기존 Gantt 인스턴스에 동기화한다. 이 fallback은 서버의 현재 상태를 새로 확인했다는 의미가 아니며, 오류 안내와 재조회 경로를 유지한다. 실패한 요청을 자동 재전송하지 않는다.

## Issue #345: 빈 Summary API 계약

Summary는 자식 수와 무관하게 유효한 WBS 컨테이너다. 모든 canonical GET/mutation 응답에서 일정 있는 Task/Milestone 자손이 없으면 `type: summary`, `scheduleMode: auto`, `requestedStart/start/end/duration/progress: null`을 반환한다. 빈 Summary들만 중첩된 경우도 동일하다. 이름/ID/parent/order·직접 Resource/Group·물류 `self/subtree` 연결은 유지한다. Leaf의 필수 날짜·기간·진척, Summary Dependency endpoint 금지는 유지한다.

`POST /api/projects/{publicId}/tasks`는 `{ "name": "설계", "type": "summary" }`와 선택적인 `parentTaskId`로 빈 Summary를 직접 생성한다. Summary의 `start/end/duration/progress` 입력은 생략 또는 명시적 null만 허용하고 `scheduleMode`는 생략/auto만 허용한다. `requestedStart`는 파생 응답 필드이며 create 입력 allowlist에 없으므로 명시하면 unknown field로 거부한다. Task/Milestone은 기존 strict schedule 입력이 필요하다. hierarchy `kind:create`의 task seed도 동일하다. Summary PATCH는 기존 이름 변경 정책을 유지하며 일정 수동 입력을 허용하지 않는다. 생성/복사 시 저장한 description/URL은 부모가 비어도 보존한다.

단건 DELETE는 빈 Summary 자체를 삭제할 수 있다. 자손이 있는 Summary는 기존 `includeDescendants=true` 확인 경로를 이용한다. 마지막 child/선택 subtree 삭제 또는 reparent/indent/outdent 이후에도 범위 밖 부모가 비었다는 이유로 `EMPTY_SUMMARY_NOT_ALLOWED`를 반환하지 않는다. 한 논리적 변경의 transaction/revision/changed/deleted ID 계약과 보호 정책은 유지한다. 과거 오류 코드는 legacy error adapter의 호환 mapping만 남아 있으며 이 조건에서는 발생하지 않는다.

프로젝트/Subtree copy는 null 일정 상태를 보존한다. Template preview의 `offsetDays/duration`은 미산정 Summary에 null이며 인스턴스화의 날짜 이동은 실제 Leaf에만 적용한 뒤 Summary를 재파생한다. calendar preview의 before/after 날짜 필드는 미산정 Summary에 null을 표현할 수 있다. Excel Export는 해당 행을 유지하고 null 일정 셀을 공란으로, SVG/PNG는 행을 유지하고 Grid는 —/Chart는 bar 없이 처리한다.

Import는 [IMPORT_SCHEMA.md](IMPORT_SCHEMA.md)의 pure payload validator만 이번 범위에 포함한다. 새 Import 화면/preview/commit API는 구현하지 않으며 실제 transaction Import 성공을 주장하지 않는다.


## Issue #303 — Task status / progress canonical contract

Task-level `status`는 Project `status`와 별도이며 `not_started | in_progress | completed`만 허용한다. 일반 Task/Milestone의 canonical response에는 status가 포함되고 Project Template instantiate 응답도 동일한 Task shape를 반환한다.

Task create/update에서 status와 progress는 하나의 mutation/revision에 저장한다. `progress=100`은 `completed`, `status=completed`는 `progress=100`, `status=not_started`는 `progress=0`으로 정규화한다. 완료 상태에서 progress를 100 미만으로 낮추면 `in_progress`가 되며, `in_progress`는 0~99를 허용한다. 서버는 완료/진행률 모순 조합을 canonical snapshot에 저장하지 않는다.

Summary는 직접 status를 PATCH하지 않는다. 기존 derived progress가 정확히 100이면 completed, 0보다 크고 100 미만이면 in_progress, 0 또는 미산정(null)이면 not_started로 파생한다. status/progress 변경은 요청/적용 일정, Dependency Link, revision/If-Match/Origin/edit-session 계약을 변경하지 않는다.

## Issue #335 task-commands linked sibling reorder

기존 `POST /api/projects/{publicId}/task-commands` schema를 변경하지 않는다.

- `{"kind":"move","taskId":"...","direction":"up|down"}`: 정의상 같은 parent의 sibling order만 변경하므로 linked Task에도 허용한다.
- `{"kind":"reparent","taskId":"...","anchorTaskId":"...","placement":"before|after"}`: 계산된 target parent가 source의 현재 parent와 같을 때만 linked source/anchor/descendant를 허용한다.
- `placement:"child"` 또는 target parent가 달라지는 before/after는 #430부터 source subtree의 **boundary-crossing Dependency**가 없을 때 허용한다. 내부 Link는 identity/endpoints/type/lag를 보존한다. linked leaf anchor를 Summary로 바꾸는 `child`는 계속 거부한다.

성공은 기존 transaction에서 sibling order를 정규화하고 Project revision을 정확히 +1 한 canonical snapshot을 반환한다. Link ID/endpoints/type/lag와 Task requestedStart/start/end/duration/scheduleMode/status/progress는 reorder로 변경하지 않는다. 실패 시 기존 401/403/404/409/412 계약과 rollback을 유지한다. 새 route, DTO field, DB migration은 없다.

### Issue #299 — Chart 수직 sibling reorder

Chart bar 수직 Drag & Drop은 새 endpoint 없이 기존 `POST /api/projects/{publicId}/task-commands`의 `reparent(before|after)`를 사용한다. edit session, Origin, strong `If-Match`, transaction, revision, canonical response 계약은 기존 hierarchy mutation과 동일하다. #335에 따라 linked same-parent sibling reorder는 허용하고 cross-parent implicit reparent는 만들지 않는다. vertical gesture 한 번은 hierarchy command 1회만 발생시키며 Task PATCH와 중복 저장하지 않는다.

## Issue #412 — Resource global roles

Resource Catalog의 Resource 표현은 `roles` 배열을 반환한다.

```json
{
  "id": "<resource uuid>",
  "name": "홍길동",
  "developerGrade": "ADVANCED",
  "roles": ["PI", "DEVELOPER"],
  "active": true
}
```

`POST /api/resources`와 `PATCH /api/resources/{resourceId}`는 optional `roles`를 받는다. 허용값은 `PI`, `DEVELOPER`, `EQUIPMENT_OWNER`이고 요청 내 중복은 `400 INVALID_REQUEST`로 거부한다. 응답 배열은 위 stable 순서로 canonicalize한다. Resource Group create/update에는 `roles`를 허용하지 않는다.

역할 변경은 기존 Resource Catalog 관리자 session, mutation Origin 검증, strong catalog `If-Match`, stale `412 CATALOG_REVISION_MISMATCH`, canonical Resource Catalog response 계약을 그대로 사용한다. 실제 역할 변경은 catalog revision을 정확히 +1 하지만 동일 canonical 배열은 no-op이다. `DEVELOPER` role 편집은 `developerGrade`를 자동 변경하지 않는다.

Task assignment search/assigned-target DTO에는 이 Issue에서 roles를 새로 결합하지 않는다. 역할 적합성 기반 Task assignment는 후속 #413의 범위다.

## Issue #413 — Task assignment 수행 역할

`GET /api/projects/{publicId}/assignment-targets`와 `GET /api/projects/{publicId}/assigned-targets`의 Resource target은 `roles: ("PI" | "DEVELOPER" | "EQUIPMENT_OWNER")[]`를 제공한다. Group target에는 roles를 제공하지 않는다.

`PUT /api/projects/{publicId}/tasks/{taskId}/assignments`의 Resource target은 optional `role`을 함께 받는다.

```json
{
  "catalogRevision": 23,
  "targets": [
    {
      "kind": "resource",
      "id": "<resource uuid>",
      "role": "DEVELOPER",
      "allocation": { "start": null, "end": null, "percent": 60 }
    }
  ]
}
```

non-null role은 해당 Resource가 현재 보유한 Global Resource Role이어야 한다. omitted/null은 migration 이전 연동과 기존 역할 미지정 assignment의 하위 호환 상태로 유지된다. Group target에 `role` 또는 allocation을 보내면 invalid request다. 응답 `ProjectAssignmentDto.role`은 Resource에서 수행 역할 또는 null, Group에서 null이다.

역할 검증은 기존 edit session, exact Origin, strong Project `If-Match`, `catalogRevision`과 같은 transaction에서 수행한다. stale catalog는 `412 CATALOG_REVISION_MISMATCH`, Resource가 보유하지 않은 role은 `409 ASSIGNMENT_ROLE_INVALID`이다. Resource Catalog에서 사용 중 role 제거는 `409 RESOURCE_ROLE_IN_USE`와 role/Project count/Task count detail을 반환한다.

### Issue #413 역할 기반 assignment target 검색

`GET /api/projects/{publicId}/assignment-targets`는 optional `role=PI|DEVELOPER|EQUIPMENT_OWNER`를 지원한다. role은 Resource 후보에만 적용하며 `kind=group`과 함께 보내면 `400 INVALID_REQUEST`다. 서버는 Global Resource Role membership으로 먼저 필터한 뒤 기존 최대 100건 제한을 적용하므로, 전체 활성 대상이 100건을 넘어도 해당 역할 Resource가 앞선 무관 후보 때문에 잘리지 않는다.

Template instantiate 시 snapshot의 Resource 수행 역할이 현재 Global Role에서 제거된 경우 project 생성 자체를 실패시키지 않는다. 기존 assignment와 allocation은 보존하고 수행 역할만 `null`로 복원하며 warnings에 stale 역할을 명시한다.

## Issue #414 — 역할 기반 Resource workload 응답 확장

`GET /api/projects/{publicId}/resource-workload`는 #56의 public-read/조회범위/M-D·M-M 계산 계약을 유지하면서 역할 기반 진단 필드를 추가한다.

- `asOfDate` / `timezone`: Project calendar timezone 기준 서버 기준일과 timezone.
- `roleTotals[]`: `PI | DEVELOPER | EQUIPMENT_OWNER | UNSPECIFIED`별 `assignmentCount`, `effortMd`, `effortMm`, `unsetCount`.
- `unspecifiedRoleCount`: 조회 범위에 포함된 role-null 일반 Task Resource assignment 수.
- `overAllocatedResourceCount`: 기존 일별 allocation 합계 100% 초과 규칙으로 판정한 고유 Resource 수.
- Resource row는 `developerGrade`를, Task row는 `role`, canonical `taskStart/taskEnd`, `progress`, `status`, `delayed`를 제공한다.

역할은 분류 축일 뿐 공수를 생성하지 않는다. Grand Total과 역할 subtotal은 동일 assignment를 중복 생성하지 않으며 role-null은 Global Role로 추정하지 않고 `UNSPECIFIED`로 유지한다. `delayed`는 #188과 동일하게 `progress < 100 && canonical end < asOfDate`다. 진행률/상태는 계획 공수 산식의 입력이 아니다.

상세 설계: [ISSUE_414_ROLE_WORKLOAD_DASHBOARD.md](ISSUE_414_ROLE_WORKLOAD_DASHBOARD.md).



## Issue #415 — Excel Resource Effort 옵션

`POST /api/projects/{publicId}/exports/excel` 요청에 optional boolean `includeResourceEffort`를 추가한다. true이면 서버는 #414와 동일한 기본 range 및 `RESOURCE_MD_PER_MM` 환경값으로 Resource workload를 계산하고, export 대상 Project snapshot의 revision과 workload `projectRevision`을 비교한다. 불일치하면 기존 stale 보호와 동일하게 412 `REVISION_MISMATCH`를 반환한다.

`GET /api/projects/{publicId}/resource-workload`의 assignment detail에는 additive field `effectiveWorkingDays`가 포함된다. 이 값은 assignment/range clipping 및 Project/Group/Resource Calendar override를 적용한 canonical 근무일 수이며, Excel은 이를 재계산하지 않는다.
