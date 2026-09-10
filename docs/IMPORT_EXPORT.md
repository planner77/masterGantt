# Import / Export

## 1. 문서 상태와 범위

이 문서는 Web Application의 Backend Import와 Excel Export 계획을 정의한다. 현재는 **Planning only** 상태이며, 실제 Excel/DRM/VBA runtime 및 생성 workbook을 검증하지 않았다.

책임 경계는 다음과 같다.

```text
허용된 Excel/VBA
  → JSON 1.0 또는 승인된 CSV fallback 생성
    → Browser file select / preview UI
      → Backend 재검증
        → Scheduling Engine 계산
          → SQLite transaction

SQLite read snapshot
  → Backend ExcelJS
    → Phase 1 .xlsx download
```

- Excel/VBA가 파일을 추출하는 방법은 `docs/VBA_EXPORT.md`가 담당한다.
- JSON의 normative field/type 계약은 `docs/IMPORT_SCHEMA.md`가 담당한다.
- Backend는 contract를 독자적으로 변경하지 않는다.
- Web Application → `.xlsx` 생성은 Backend 책임이며 VBA나 SVAR PRO export에 의존하지 않는다.
- 일정 계산은 `docs/SCHEDULING_ENGINE.md`, 인증과 제한은 `docs/SECURITY.md`, endpoint는 `docs/API.md`를 따른다.

## 2. DRM 및 조직 정책 경계

원본 Workbook에 DRM이 적용되어 있다는 전제를 존중한다.

- Web Application이 원본 DRM Excel을 직접 읽는 흐름을 전제로 하지 않는다.
- DRM 해제, 우회, 비공개 API 사용, clipboard 사용 가능성을 가정하지 않는다.
- 조직 정책상 허용된 Workbook 안에서 VBA가 실행되고 필요한 cell을 읽어 승인된 위치에 JSON/CSV를 저장할 수 있을 때만 진행한다.
- VBA 실행, cell 접근, 파일 저장 또는 HTTP가 차단되면 우회하지 않고 승인된 fallback/manual grid로 전환한다.
- Backend는 `.xlsm`/`.xlsx` 원본 upload를 Import API에서 받지 않는다.

실제 환경 POC는 VBA 실행, header 발견, cell 접근, JSON/CSV 저장, 한글, 날짜, progress, parent/dependency, 오류 row 보고를 검증해야 한다. 대상 Workbook·조직 정책은 UNKNOWN, 필요한 실행 환경·미구현 도구로 수행할 수 없는 시험은 BLOCKED다. 실행하여 PASS한 항목은 없다. 상세 분류는 VBA_EXPORT.md를 따른다.

## 3. Import 목표와 비목표

### 목표

- 승인된 중간 파일을 기존 Project에 안전하게 추가
- Browser preview와 Server validation 모두 제공
- Calendar/Dependency 적용 전후 차이를 사용자가 확인
- 실패 시 Project를 import 이전 상태로 완전히 유지
- 오류 row와 field를 조용히 누락하지 않고 안정적인 code로 보고

### 초기 비목표

- Import로 새 Project 생성
- Payload project metadata로 기존 Project name/description 변경
- Existing task update/delete/replace/upsert
- Partial import 또는 valid row만 저장
- SS/FF/SF, non-zero lag, lead를 FS/0으로 자동 변환
- 원본 Excel layout/style/수식/chart 보존
- DRM 우회

## 4. JSON 1.0 Backend 해석

정확한 JSON shape은 `docs/IMPORT_SCHEMA.md`가 우선한다. Backend 해석 원칙은 다음과 같다.

- `schemaVersion`은 정확히 문자열 `"1.0"`이어야 한다.
- URL의 `{publicId}`가 import 대상이다. Payload의 `project.name`과 `project.description`은 source 식별/preview warning용이며 기존 Project를 변경하지 않는다.
- `tasks[].externalId`는 안정적이고 batch 안에서 unique해야 한다. Case-sensitive exact 값이며 앞뒤 whitespace는 거부한다.
- `tasks` 배열에서 **같은 parent를 가진 row의 등장 순서**가 sibling order다. 별도 top-level order field는 없다.
- Parent가 child보다 배열 뒤에 있어도 모든 ID를 먼저 index한 뒤 관계를 해석한다.
- 각 task의 `predecessors`는 현재 task의 선행 task를 가리킨다. 즉 predecessor `externalId → current task externalId` Link를 만든다.
- Parent와 predecessor는 같은 batch의 external ID만 참조한다. DB existing task를 암묵적으로 연결하지 않는다.
- `type`은 `task`, `summary`, `milestone`만 허용한다.
- `scheduleMode`가 contract에 따라 생략되면 `auto`로 정규화한다. Summary는 항상 파생 계산 대상이다.
- v1 dependency는 `type: "FS"`, `lag: 0`만 허용한다.

### 날짜와 Summary

- 입력 `start`는 requested start이며 저장 후에도 계산 start와 분리한다.
- Domain date는 유효한 Gregorian `YYYY-MM-DD`만 허용한다.
- 일반 task duration은 양의 정수 working days, milestone은 0이고 effective `start=end`이다.
- Auto requested start가 주말/Project holiday이면 다음 working day로 이동하고 warning을 낸다.
- Manual requested start가 비근무일이거나 FS 제약을 위반하면 전체 import를 거부한다.
- 입력 `end`가 있으면 dependency 적용 전, calendar로 정규화한 requested start + duration의 canonical inclusive end와 일치해야 한다.
- Dependency로 effective start/end가 나중에 이동한 것은 end mismatch가 아니라 preview schedule diff다.
- Summary의 start/end/duration/progress는 optional source snapshot이며 authority가 아니다. Scheduling Engine이 descendant leaf로 값을 계산하고 preview가 제공 snapshot과 파생 결과의 차이를 보여 준다.
- Empty summary, summary가 아닌 parent, hierarchy/dependency cycle, summary dependency endpoint는 거부한다.

Project calendar 초기 가정은 timezone `Asia/Seoul`, 토요일/일요일 비근무, Project별 holiday set이다. 국가 공휴일을 자동 추측하지 않는다.

## 5. CSV Fallback v1

Backend와 Excel/VBA가 공동 검토하고 Manager가 승인한 lossless contract이며 normative 정의는 `docs/IMPORT_SCHEMA.md`이다.

### Encoding과 record

- RFC 4180 규칙의 comma-separated file
- Canonical producer는 UTF-8 BOM 포함; reader는 BOM 유무 허용
- 첫 record는 필수 header set
- 이후 한 record가 task 하나
- CRLF를 기본 생성하되 parser는 승인 contract 범위에서 line ending을 처리
- Quote, comma, CR/LF가 포함된 cell은 RFC 4180 double quote 규칙 사용
- 빈 record, 열 수 불일치, duplicate header, unknown header를 오류 처리

Canonical producer header 순서:

```text
schemaVersion,projectName,projectDescription,externalId,name,type,scheduleMode,start,end,duration,progress,parentExternalId,predecessors
```

Reader는 header 이름으로 mapping하므로 순서 변경은 허용하지만 missing/duplicate/unknown header를 거부한다. 각 task row에 `schemaVersion`, `projectName`, `projectDescription`을 반복한다. 모든 row의 세 값은 CSV decode 후 동일해야 하며 다르면 hard error다. `schemaVersion`은 `1.0`, project metadata는 정보용이다.

### Null과 배열

- `predecessors`는 빈 경우에도 literal JSON array text `[]`를 사용한다.
- 하나 이상이면 JSON 1.0의 predecessor array를 cell 문자열로 그대로 넣고 CSV quoting으로 다시 escape한다.
- 예: source JSON text가 `[{"externalId":"A","type":"FS","lag":0}]`이면 CSV cell은 `"[{""externalId"":""A"",""type"":""FS"",""lag"":0}]"` 형태다.
- 빈 `parentExternalId`는 null로 해석한다.
- Contract상 optional인 `end`와 summary의 start/duration/progress snapshot cell은 빈 값일 수 있다. Leaf의 start/duration/progress는 필수다.
- 일반 task/milestone의 required cell은 빈 문자열을 null로 조용히 바꾸지 않는다.
- 같은 parent를 가진 CSV row의 file 순서가 sibling order다.
- Predecessor/parent forward reference를 허용하며 전체 row ID를 먼저 index한다.

CSV cell에서 JSON predecessor를 사용하는 이유는 delimiter 기반 dependency 축약 문법보다 JSON model을 무손실로 유지하기 위해서다. Parser는 이를 code/formula로 실행하지 않으며 중첩 JSON의 field/size/depth를 다시 제한한다.

## 6. Import Workflow

```text
File select
  → Client parse/기본 schema 표시
    → Server preview upload
      → Byte/format parse
        → Schema validation
          → Business/graph/calendar validation
            → Scheduling preview + diff
              → User confirm
                → Server commit upload + If-Match
                  → 전체 재검증
                    → SQLite transaction
                      → Canonical full snapshot
```

Client validation은 빠른 UX일 뿐이다. Preview와 commit 모두 Server가 독립적으로 검증한다.

### 6.1 Preview

`POST /api/projects/{publicId}/imports/preview`는 유효 edit session이 필요하다. DB를 변경하지 않고 다음을 반환한다.

- Target Project와 source metadata 비교
- `baseRevision`
- 생성 예정 task/link 수
- Normalized requested values
- Effective start/end 및 requested schedule 대비 이동 이유
- Auto non-working shift warning
- Summary derived date/duration/progress와 optional source snapshot diff
- 오류이면 field path, external ID, row(가능한 경우), 안정 오류 code

Warning은 정보 손실이나 규칙 위반을 숨기는 수단이 아니다. 안전하고 결정적인 normalization만 warning으로 처리한다. Unsupported type/lag, malformed date, missing reference, duplicate, cycle, Manual conflict는 error다.

### 6.2 Commit

`POST /api/projects/{publicId}/imports`는 같은 source payload, edit session, preview `baseRevision`의 `If-Match`를 요구한다.

1. 최신 Project/session/revision을 transaction 경계에서 확인한다.
2. File을 다시 parse하고 schema/domain/scheduling validation을 다시 수행한다.
3. Payload 내부 duplicate와 target Project DB의 existing external ID를 확인한다.
4. 모든 task/link와 Scheduling 결과를 하나의 transaction에 저장한다.
5. Project revision을 한 번 증가시킨다.
6. 최신 canonical full snapshot과 import summary/warning을 반환한다.

하나라도 실패하면 전체 rollback한다. Preview는 reservation이나 lock이 아니므로 stale revision은 재-preview가 필요하다.

### 6.3 Create-only와 ID 규칙

- Import task는 모두 새 task여야 한다.
- Existing external ID 하나 때문에 나머지를 저장하지 않는다.
- `externalId`의 trim/case fold/Unicode normalization을 하지 않는다.
- Row number, WBS, task name을 stable reference로 대체하지 않는다.
- Parent/dependency missing ID를 NULL로 만들거나 삭제하지 않는다.
- Import array/file row order만 sibling order이며 UI sort/filter가 이를 변경하지 않는다.

## 7. Validation 결과 분류

| Category | 예 | 결과 |
|---|---|---|
| Parse | Invalid JSON, invalid CSV quote/column count, malformed predecessor JSON | Error, 저장 없음 |
| Version | Missing/unsupported schemaVersion | Error, 저장 없음 |
| Identity | Duplicate/blank/whitespace external ID, existing ID conflict | Error, 저장 없음 |
| Field | Missing name/type/date, invalid progress/duration | Error, 저장 없음 |
| Hierarchy | Missing/non-summary parent, parent cycle, empty summary | Error, 저장 없음 |
| Dependency | Missing endpoint, duplicate/self/cycle, summary endpoint, non-FS/non-zero lag | Error, 저장 없음 |
| Calendar | Invalid date/holiday, Manual non-working start | Error, 저장 없음 |
| Schedule | Input end mismatch, Manual FS conflict | Error, 저장 없음 |
| Normalization | Auto requested start shifted to next working day | Warning + preview diff |
| Metadata | Source project name/description differs from target | Warning, target metadata 불변 |
| Summary snapshot | Source optional summary snapshot differs from derived | Warning/diff, derived value 저장 |
| Concurrency | Project revision changed after preview | Error, 재-preview |

서버는 여러 독립 입력 오류를 bounded count까지 모아 사용자가 한 번에 수정할 수 있게 한다. Graph 또는 scheduling처럼 앞 단계가 유효해야 의미 있는 검사는 prerequisite 실패 시 `notEvaluated`로 표시하며 오진하지 않는다.

## 8. Import Resource Limits

다음 항목에 server-side 상한을 둔다.

- File bytes와 decoded string bytes
- CSV row/cell/column 길이, JSON depth
- Task와 total predecessor 수
- External ID/name/description 길이
- Hierarchy depth와 graph traversal
- 최소/최대 date 및 전체 span
- Validation issue 반환 개수
- Preview/commit rate와 동시 Scheduling 작업 수

초기 contract 상한은 payload 5 MiB, task 5,000개, 전체 Link 20,000개, task당 predecessor 100개, hierarchy depth 64, 날짜 `1900-01-01..2199-12-31`, 일반 task duration `1..10000` working days이다. 이는 성능 보장이 아니며 대표 Workbook 및 Scheduling/SVAR benchmark 후 producer/consumer 문서를 함께 조정한다. Client가 보낸 `Content-Length`만 믿지 않고 실제 읽은 byte도 제한한다.

## 9. Excel Export Phase 1

### 9.1 Library와 생성 위치

Backend Node runtime에서 ExcelJS를 사용해 `.xlsx`를 생성한다. 특정 version은 지원 Node runtime, license, 알려진 compatibility를 공식 repository에서 확인한 후 설치 시점에 고정한다. SVAR PRO export와 VBA를 호출하지 않는다.

Repository에서 Project aggregate를 일관된 read snapshot DTO로 가져온 뒤 DB transaction을 닫고 workbook을 생성한다. Excel 생성/streaming 동안 SQLite transaction을 열어 두지 않는다. 큰 workbook의 memory 사용과 동시 export 수를 제한한다.

### 9.2 Sheet 구성

고정 sheet name은 `Project`, `Tasks`, `Dependencies`이다. 사용자 입력을 sheet name으로 사용하지 않는다.

#### `Project`

Key/value table에 최소 다음을 포함한다.

| Field | 값 |
|---|---|
| Project Name | Project name |
| Description | Project description |
| Export Date | Export 시각과 timezone을 명시한 값 |
| Project Timezone | `Asia/Seoul` |
| Project Direct URL | 검증된 direct URL text |
| Project Direct Hyperlink | 같은 URL을 target으로 하는 clickable hyperlink |

Direct URL은 오직 다음 규칙으로 만든다.

```text
validated APP_BASE_URL
+ /projects/
+ project.public_id
```

`APP_BASE_URL`은 absolute http(s), production https, credential/query/fragment 없음으로 startup 시 검증한다. Request Host나 forwarded Host를 사용하지 않는다. URL에는 password, session token, Cookie, revision을 포함하지 않는다.

#### `Tasks`

제안 column 순서:

```text
External ID
WBS
Name
Type
Schedule Mode
Requested Start
Start
End
Duration (Working Days)
Progress
Parent External ID
Sibling Order
```

Task는 hierarchy/sibling order로 안정적으로 정렬한다. Requested Start와 calculated Start/End를 모두 내보내 이동을 숨기지 않는다. Summary는 derived 값, milestone은 duration 0이다.

#### `Dependencies`

제안 column 순서:

```text
Link ID
Predecessor External ID
Successor External ID
Type
Lag (Working Days)
```

방향은 predecessor → successor이다. 초기 값은 FS/0이지만 type/lag column을 유지해 계약을 명확히 한다.

### 9.3 Cell type과 formatting

- Header style, freeze panes, auto filter, 적정 column width를 적용한다.
- Domain date는 calendar date를 timezone shift하지 않는 공통 helper로 Excel serial date에 기록하고 `yyyy-mm-dd` number format을 적용한다. Round-trip test에서 원래 문자열과 같아야 한다.
- Progress는 numeric fraction으로 기록하고 percentage format을 적용한다. 표시 반올림과 저장 0..100 semantics를 구분한다.
- Duration, sibling order, lag는 numeric cell이다.
- Long description/name은 wrap하되 row/column 최대 크기를 제한한다.
- Summary와 milestone은 type을 식별할 최소 style만 사용하고 data 의미를 color에만 의존하지 않는다.
- Formula는 Phase 1에 필요하지 않다.

### 9.4 Workbook 안전

- User string은 text cell로만 기록하고 `formula`, rich value, hyperlink로 해석하지 않는다.
- `=`, `+`, `-`, `@`로 시작하는 task/name/description/external ID도 formula가 아니어야 한다.
- Hyperlink object는 trusted direct Project URL 한 cell에만 사용한다.
- User-provided URL을 자동 link로 만들지 않는다.
- Internal DB ID, password material, session, Cookie, `.env` 값을 포함하지 않는다.
- Filename은 `project-<publicId>.xlsx` 같은 ASCII server-generated 값만 사용한다.
- Sheet name, filename, Content-Disposition에 CR/LF 또는 path separator가 들어가지 않게 한다.

### 9.5 HTTP response

```text
GET /api/projects/{publicId}/exports/excel
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="project-<publicId>.xlsx"
```

Project Readonly 공개 범위와 동일하게 edit session은 요구하지 않는 초기 설계다. Direct URL이 기밀성을 제공하지 않는 것과 같은 이유다. Export에는 별도 rate/size/concurrency limit을 둔다. Read 권한 모델이 바뀌면 Export도 함께 바꾼다.

## 10. Excel Export Phase 2 — Deferred

Phase 1 table workbook이 구현·검증된 뒤 `Gantt` sheet를 검토한다. 현재 구현 범위와 API 보장은 아니다.

초기 방향은 Excel Chart Object가 아니라 날짜별 cell rendering이다.

```text
Task          09/11  09/12  09/13  09/14
Foundation      ■      ·      ·      ■
Milestone                              ◆
```

착수 전에 다음을 결정한다.

- Month/week/date header와 supported date span
- Weekend/holiday 표시와 print area
- Effective start/end, progress overlay, summary/milestone 표현
- Page orientation, repeating rows/columns, freeze panes
- Very wide sheet의 size/memory 제한
- Color/accessibility 및 Excel/LibreOffice compatibility

Phase 2가 완료되기 전에는 빈 Gantt sheet나 오해할 수 있는 부분 rendering을 Phase 1 workbook에 넣지 않는다.

## 11. Verification Plan

상태는 모두 **NOT TESTED — planning only**이다.

### JSON/CSV Import

- Valid JSON 1.0, UTF-8 한글, Unicode external/name round-trip
- Invalid JSON/CSV quote/column count/UTF-8/predecessor JSON
- Unsupported/missing schemaVersion 및 row별 반복값 불일치
- Duplicate payload/existing external ID, surrounding whitespace/case-sensitive ID
- Parent forward reference, missing/non-summary parent, parent cycle, empty summary
- Dependency forward reference, missing/self/duplicate/cycle/summary endpoint
- FS/0 성공, SS/FF/SF/non-zero lag/lead 명시적 실패
- Requested start, weekend/holiday Auto warning, Manual failure
- End consistency를 dependency shift 전에 검증하고 shift를 preview diff로 표시
- Summary optional snapshot 차이와 derived storage
- Task row/array 기반 sibling order 및 Parent가 뒤에 있는 입력
- Preview 후 revision 변경 시 commit 실패
- Commit validation/DB 중간 오류의 전체 rollback
- File/row/cell/depth/graph/date limit과 rate limit
- Formula-like CSV text가 실행/변형되지 않음

### Excel Export Phase 1

- `.xlsx` open 가능, `Project/Tasks/Dependencies`만 존재
- Project name/description/export date/timezone/direct URL/hyperlink
- URL이 정확히 APP_BASE_URL + path + UUID이며 secret 없음
- Requested/effective date, duration, progress, parent/sibling/WBS round-trip
- Dependency 방향/type/lag 정확성
- 날짜와 percentage numeric formatting
- Korean/Unicode, comma/newline/quote, long cell
- Formula-like strings가 formula가 아닌 text로 저장됨
- Workbook XML과 metadata에 password/session/internal ID 없음
- Content-Type, safe filename, rate/size/concurrency 실패
- Excel과 조직에서 허용한 호환 viewer에서 수동 open 검증

### Excel/VBA POC

- 대상 Workbook에서 VBA 실행 및 필요한 cell 접근
- Header name mapping과 불필요 column 제외
- 승인 위치 JSON/CSV 저장
- UTF-8 BOM CSV 및 한글 손상 없음
- Date/progress/parent/predecessor 정상화
- 오류 row와 warning 보고
- 생성 파일의 Web preview/commit 연동

## 12. Decision Required / Remaining

- Import file/task/link/depth/date range의 실제 상한
- Summary source snapshot mismatch를 warning으로만 둘지 별도 strict mode를 제공할지
- Export Date를 UTC instant 하나로 쓸지 Project timezone 표시값을 병기할지
- ExcelJS 설치 version과 Node/native deployment matrix
- Export에 Readonly 공개 정책을 유지할지 향후 read authorization과 함께 제한할지
- Phase 2 Gantt 상세 layout과 착수 시점

## 13. 근거 자료

- [RFC 4180: Common Format and MIME Type for CSV Files](https://www.rfc-editor.org/rfc/rfc4180)
- [ExcelJS official repository](https://github.com/exceljs/exceljs)
- [`better-sqlite3` transaction API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#transactionfunction---function)
- [Node.js URL API](https://nodejs.org/api/url.html)
