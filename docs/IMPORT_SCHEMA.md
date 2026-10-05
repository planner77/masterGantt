# Import contract 1.0

상태: Manager 승인 초안, Backend + Excel/VBA 공동 CSV 검토 반영; 독립 QA 결과는 [BOOTSTRAP_REVIEW.md](BOOTSTRAP_REVIEW.md). 아직 구현 또는 실제 Excel POC 통과를 뜻하지 않는다. 계약 변경은 양쪽 영향 분석→공동 검토→Manager 결정→문서/구현→QA 순서다.

## 범위와 식별

기존에 생성하고 unlock한 Project에 self-contained batch를 **create-only**로 추가한다. Project는 API URL의 public ID로 지정한다. 파일의 `project`는 원본 metadata이며 대상 name/description/password/calendar를 변경하지 않는다. 다른 Project나 기존 Task를 참조하는 batch는 초기 버전에서 허용하지 않는다. 파일에 password·session·DB internal ID를 넣지 않는다.

`schemaVersion`은 문자열 `"1.0"`이다. Unknown version/field와 숫자의 문자열 강제 변환을 허용하지 않는다. 외부 ID는 1..128 Unicode code point의 case-sensitive 문자열이다. 앞뒤 Unicode whitespace, control character, unpaired surrogate를 거부하고 trim, case folding, Unicode 정규화로 바꾸지 않는다. 한글 업무 ID를 허용하고 행 번호나 WBS를 장기 식별자로 사용하지 않는다. Backend CRUD URL은 별도 server-generated Task UUID를 사용하므로 externalId를 URL segment에 넣지 않는다.

## JSON envelope

UTF-8 JSON object, export는 BOM 없이 작성한다. Reader는 파일 맨 앞 UTF-8 BOM 하나만 제거할 수 있다. Duplicate JSON object key를 검출하여 거부할 수 있는 parser 전략을 구현 때 검증한다. JSON parse만 성공했다고 business validation을 생략하지 않는다.

```json
{
  "schemaVersion": "1.0",
  "project": { "name": "설비 확장", "description": "승인된 일정 추출" },
  "tasks": [
    {
      "externalId": "S-1", "name": "설치", "type": "summary",
      "parentExternalId": null, "predecessors": []
    },
    {
      "externalId": "A-10", "name": "준비", "type": "task",
      "scheduleMode": "auto", "start": "2026-09-11", "end": "2026-09-14",
      "duration": 2, "progress": 50, "parentExternalId": "S-1", "predecessors": []
    },
    {
      "externalId": "M-20", "name": "검수", "type": "milestone",
      "scheduleMode": "auto", "start": "2026-09-15", "end": "2026-09-15",
      "duration": 0, "progress": 0, "parentExternalId": "S-1",
      "predecessors": [{ "externalId": "A-10", "type": "FS", "lag": 0 }]
    }
  ]
}
```

위 예시는 토·일 휴무와 빈 holiday set을 사용한다. 실제 validation은 대상 Project calendar로 수행하며 파일이 이를 바꾸지 않는다.

| Field | Type / required | 규칙 |
| --- | --- | --- |
| schemaVersion | string / 필수 | 정확히 `1.0` |
| project | object / 필수 | name, description만 |
| project.name | string / 필수 | 1..200 chars, 공백만 금지 |
| project.description | string / 필수 | 0..4000 chars |
| tasks | array / 필수 | 1..5000 entries |
| tasks[].externalId | string / 필수 | 위 안정 ID 규칙, 전체 payload 및 대상 DB에서 중복 금지 |
| name | string / 필수 | 1..200 chars, 공백만 금지; 한글 허용 |
| type | string / 필수 | `task`, `summary`, `milestone` |
| scheduleMode | string / 선택 | leaf는 `auto` 기본값 또는 `manual`; summary는 생략 또는 `auto` |
| requestedStart | null / Summary 선택 | 생략 또는 null만 허용; Leaf는 start를 사용 |
| start | string 또는 null / leaf 필수 | Leaf는 유효 YYYY-MM-DD 필수; Summary는 생략/null/source snapshot |
| end | string 또는 null / 선택 | Summary는 생략/null/source snapshot; Leaf 제공 시 유효 날짜 및 consistency 검사 |
| duration | number 또는 null / leaf 필수 | task 정수 1..10000, milestone 정확히 0 |
| progress | number 또는 null / leaf 필수 | 0..100 finite number; `50`은 50%, `0.5`는 0.5% |
| parentExternalId | string 또는 null / 필수 | 같은 batch의 summary ID, root는 null |
| predecessors | array / 필수 | 선행 task/milestone 목록, 없으면 `[]` |

Summary의 start/end/duration/progress는 선택적인 원본 snapshot이다. 제공하면 기본 날짜·숫자 형식과 범위를 검사하지만 authoritative leaf 계산에 사용하지 않는다. 모든 summary 결과는 자식에서 계산하여 preview 차이로 표시한다. Summary duration snapshot은 0..10000 정수로 제한한다. 자손에 실제 일정이 없으면 빈 Summary 및 빈 Summary만 중첩된 구조를 허용하며 `requestedStart/start/end/duration/progress=null`, `scheduleMode=auto`로 정규화한다. 제공된 snapshot은 가짜 일정으로 저장하지 않는다.

Predecessor object는 `{externalId: string, type?: "FS" | "SS" | "FF" | "SF", lag?: number}`이다 (생략 시 기본값 `type: "FS"`, `lag: 0`). `externalId`는 **선행** Task이고 이 object를 포함하는 현재 Task가 후행이다. 중복 edge, 자기 참조, summary endpoint, 누락 참조, cycle을 거부한다. 지원되는 관계 종류(`FS`, `SS`, `FF`, `SF`) 및 정수 `lag`(-10000..10000)를 수용한다.

별도 `order` field는 없다. 같은 parent에 속한 Task의 입력 배열 출현 순서가 sibling order다. Parent가 배열 뒤에 있어도 전체 ID index를 만든 후 연결하므로 유효하다. WBS는 파생 결과다.

## 날짜·진척·계산

Gregorian 날짜의 유효 일자만 허용한다. 허용 기간은 1900-01-01..2199-12-31이고 1900-02-29는 유효하지 않다. 시각·timezone suffix·locale 문자열·Excel serial number는 JSON에 허용하지 않는다. Producer는 Workbook 날짜 system과 승인된 원본 해석을 확인하여 정규화한다.

Leaf의 입력 `start`는 저장 시 `requested_start`다. Service 응답에는 `requestedStart`와 effective `start/end`가 별도로 있다. End는 inclusive이며 duration은 project working-day 수다.

1. Auto의 비근무 start는 다음 근무일로 정규화하고 warning을 낸다. Manual 비근무 start는 거부한다.
2. 정규화한 start와 duration으로 dependency 적용 **전** end를 계산한다. 제공한 end가 이것과 다르면 `END_DURATION_MISMATCH`다.
3. FS를 적용해 effective start/end를 구한다. 이동은 preview diff이며 2번의 원본 end 검사를 다시 적용하지 않는다.
4. Manual의 FS 충돌은 전체 거부다. Milestone은 duration0/start=end이며 FS는 milestone에도 선행 end 다음 첫 근무일을 사용한다.
5. Summary와 WBS를 계산한다. 자세한 규칙은 [SCHEDULING_ENGINE.md](SCHEDULING_ENGINE.md)를 따른다.

Source에 start/end만 있으면 producer 또는 mapping 단계가 대상 calendar로 duration을 계산하고 사용자가 preview에서 확인한 뒤 이 정규 계약을 생성한다. 별도 Source calendar가 확인되지 않으면 VBA가 임의로 duration을 만들지 않는다. Percent cell `50%`와 numeric `0.5`, plain `50`의 원본 의미는 Header mapping/POC에서 명시하며 server가 magnitude로 추정하지 않는다.

## CSV fallback

Backend와 Excel/VBA가 공동 검토한 lossless `1.0` 표현이다. Export는 UTF-8 BOM을 사용하며 Reader는 BOM 유무 모두 허용한다. [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180) 방식의 comma delimiter, double quote escaping, CRLF record를 사용한다. Reader는 LF도 수용할 수 있다. Quoted cell의 comma·double quote·줄바꿈을 보존한다. `sep=,` 행은 계약 밖이다.

Canonical header 순서:

```text
schemaVersion,projectName,projectDescription,externalId,name,type,scheduleMode,start,end,duration,progress,parentExternalId,predecessors
```

모든 Header가 필수다. Reader는 이름으로 mapping하므로 순서 변경은 허용하지만 duplicate/unknown/missing Header는 거부한다. 각 데이터 record가 Task 하나이며 record 순서가 JSON array 순서다.

- schemaVersion/projectName/projectDescription은 모든 행에서 반복하며 값이 동일해야 한다.
- blank parentExternalId는 JSON null로 변환한다.
- 선택적인 end/scheduleMode와 summary의 start/duration/progress snapshot의 빈 cell은 JSON field 생략으로 변환한다. Leaf start/duration/progress가 비면 오류다.
- duration/progress는 decimal dot의 locale-independent 숫자 literal만 받으며 천 단위 comma·percent suffix는 거부한다. ID를 숫자로 변환하지 않는다.
- predecessors는 JSON array를 **하나의 cell**에 저장한다. 비어 있으면 `[]`; blank cell은 오류다. 세미콜론 축약 관계 문법은 없다.
- Formula를 실행·평가하지 않는다. 이름이 `=` 등으로 시작해도 plain text다. 이 교환 CSV를 Excel에서 더블클릭해 여는 것은 웹 parser 검증과 다르므로 사용자 문서에서 text import를 안내한다.

예시 record:

```csv
schemaVersion,projectName,projectDescription,externalId,name,type,scheduleMode,start,end,duration,progress,parentExternalId,predecessors
1.0,설비 확장,승인된 일정 추출,A-10,준비,task,auto,2026-09-11,2026-09-14,2,50,,[]
1.0,설비 확장,승인된 일정 추출,M-20,검수,milestone,auto,2026-09-15,2026-09-15,0,0,,"[{""externalId"":""A-10"",""type"":""FS"",""lag"":0}]"
```

CSV parsing 이후 동일 JSON contract와 domain validation으로 들어간다. CSV에서 지원되지 않는 관계를 제거하거나 행을 skip하지 않는다. Metadata가 없는 CSV/사용자별 Header alias는 UI mapping 후보 입력이며 이 canonical contract와 구분한다.

## Validation·오류·Transaction

순서: byte limit/encoding→parse→strict schema→전체 ID index→parent tree→calendar/date→dependency graph→schedule→preview. Server가 authoritative validation을 수행한다. Preview 성공 후 commit도 같은 payload를 다시 검증하고 `If-Match`로 DB revision을 확인한다.

초기 resource budget은 payload 5 MiB, tasks5000, 전체 links20000, task당 predecessors100, hierarchy depth64다. 과다 입력은 `IMPORT_TOO_LARGE`로 거부한다. 날짜 계산 결과도 허용 범위를 넘지 못한다. 이는 안전한 초기 제품 상한 가정이며 실제 성능 보장은 아니다. Benchmark 후 producer/consumer 문서를 함께 갱신한다.

Error는 stable code, JSON path 또는 CSV logical record number, externalId(알려진 경우), 사용자 메시지를 포함한다. Row number는 진단 위치일 뿐 관계 ID가 아니다. 로그에 전체 파일·셀·password·session을 기록하지 않는다. 예시:

```json
{
  "code": "MISSING_PARENT",
  "path": "tasks[2].parentExternalId",
  "externalId": "A-20",
  "message": "Parent is not present in this import batch."
}
```

Parse/encoding/version/missing field/date/progress/type/duplicate/missing parent/unsupported link/cycle/Manual conflict 중 하나라도 있으면 commit은 0건이다. Warning만 있는 경우 이동 내역과 원본 비교를 preview에서 확인한 후 제출할 수 있다. Commit write 중 실패해도 전체 rollback한다. 부분 성공, silent row skip, 기존 Task upsert·delete, Project metadata 교체는 없다.

Preview 응답과 오류 envelope, HTTP status, auth, revision은 [API.md](API.md), producer 오류 보고·한국어 검증은 [VBA_EXPORT.md](VBA_EXPORT.md), 독립 검증은 [TEST_PLAN.md](TEST_PLAN.md)를 따른다.

## 물류 도메인과의 경계 (Issue #189 LG-06)

- 본 Import 계약 1.0은 순수 일정(Tasks, Predecessors, Calendar)만을 대상으로 하며, 물류 도메인(공정, 설비, 시스템, 태스크-물류 연결)을 포함하지 않는다.
- `schemaVersion`은 `"1.0"`을 엄격히 유지하며, 임의의 물류 필드가 포함될 경우 unknown field로 거부된다.
- 이번 물류 MVP의 입력 수단은 웹 UI(물류 구성 화면) 및 프로젝트 복사 기능이며, VBA 매크로 기반 물류 데이터 추출기 및 물류 bulk import는 비범위(Out of Scope)다. 향후 물류 대량 등록이 필요한 경우 backend + excel_vba 공동 검토를 거쳐 승인된 별도 스키마 버전으로 확장한다.


## Issue #345 구현 경계와 검증

`src/contracts/import.ts`의 `validateImportPayload(input, calendar)`는 이미 파싱한 JSON object에 대해 strict schema, 1.0 버전, ID/parent/dependency/date/Leaf schedule과 Summary null/legacy snapshot을 검증하고 Domain canonical Tasks/Links를 생성한다. Summary의 requestedStart는 생략/null만, start/end/duration/progress는 생략/null/유효 source snapshot을 허용한다. Leaf의 null 날짜/기간/진척은 거부한다. CSV Summary 빈 셀→field 생략은 같은 null 정규화 의미를 유지한다. CSV에 requestedStart 컬럼을 추가하지 않는다.

검증기 결과의 taskId는 순수 계산용 임시 externalId이며 저장용 public UUID가 아니다. 후속 commit 구현은 server-generated UUID를 발급하고 대상 DB 충돌·authorization/revision을 별도로 검증해야 한다.

이 순수 검증기는 HTTP Import preview/commit, create-only 대상 DB 충돌, byte/encoding/duplicate JSON key/CSV parsing을 구현한 것이 아니다. 사용자 확정 범위에 따라 신규 Import 화면/API는 별도 Issue로 분리하며 위 계약의 transaction 구현은 후속이다. 테스트는 `tests/contracts/import.test.ts`의 새/기존 입력, 중첩/혼합 Summary, invalid Leaf/null/날짜/관계/version fixture다. Windows Excel/VBA/DRM 실제 실행 및 원격 Import commit은 NOT TESTED다.
