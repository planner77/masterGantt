# Excel/VBA 일정 Export POC 계획

## 1. 문서 상태와 범위

이 문서는 DRM이 적용된 대상 Excel Workbook에서 조직 정책상 허용된 VBA만 사용해 일정 데이터를 읽고, Web Import용 JSON 또는 CSV로 내보낼 수 있는지 검증하는 **POC 계획**이다.

현재는 Bootstrap/Planning 단계다. 대상 Workbook, Microsoft Excel 실행 환경, DRM 제품·정책, 승인된 저장 위치 및 Web Import 구현을 사용할 수 없으므로 실제 호환성 결과를 주장하지 않는다. 아래 실환경 검증 상태는 각각 `UNKNOWN` 또는 `BLOCKED`로만 기록한다.

이 단계에서는 다음을 하지 않는다.

- VBA 모듈, Add-in, 실행 파일을 구현하거나 배포하지 않는다.
- DRM을 해제·우회하거나 조직의 Macro/Protected View/파일 저장 정책을 변경하지 않는다.
- Clipboard, 외부 HTTP 전송, 임시 Cloud 저장소를 사용 가능하다고 가정하지 않는다.
- Excel 열 문자나 고정 열 번호를 일정 필드의 영구 계약으로 사용하지 않는다.
- VBA에서 Project 일정을 재계산하거나 Web Server 검증을 대체하지 않는다.
- [IMPORT_SCHEMA.md](IMPORT_SCHEMA.md)를 이 문서에서 독자적으로 변경하지 않는다.

JSON의 규범적 계약은 [IMPORT_SCHEMA.md](IMPORT_SCHEMA.md), Server import workflow와 권한은 [API.md](API.md), 원자성과 저장 mapping은 [DB_SCHEMA.md](DB_SCHEMA.md), 일정 의미는 [SCHEDULING_ENGINE.md](SCHEDULING_ENGINE.md), 보안 경계는 [SECURITY.md](SECURITY.md)가 우선한다.

## 2. 확인된 경계와 미확정 입력

### 확인된 설계 경계

- Import 대상은 URL에서 선택한 **기존 Project**다. Export 파일의 Project name/description은 확인용 정보이며 기존 Project metadata를 덮어쓰지 않는다.
- Schema version은 `1.0`이다.
- v1 import는 create-only, all-or-nothing이다. 기존 또는 같은 batch의 중복 `externalId`, 잘못된 Parent/Dependency, Cycle, 일정 오류 중 하나라도 있으면 일부 행만 저장하지 않는다.
- `externalId`는 앞뒤 공백이 없는 case-sensitive opaque identifier다. 행 번호와 WBS는 안정 ID로 대체하지 않는다.
- Parent와 Dependency는 v1에서 같은 import batch의 `externalId`만 참조한다. 모든 ID를 먼저 색인하므로 forward reference는 허용한다.
- Dependency는 leaf task/milestone 사이의 `FS`, `lag: 0`만 허용한다. 다른 type 또는 lag/lead를 자동 변환하거나 누락하지 않는다.
- `tasks` 배열의 등장 순서는 같은 Parent 아래의 형제 순서를 결정한다. Parent가 자식보다 먼저 나올 필요는 없다.
- Input `start`는 사용자 요청일이며, Server는 이를 `requestedStart`로 보존한다. 계산 `start/end`와 구분한다.
- Domain `end`는 양 끝을 포함하는 inclusive date다. 일반 Task duration은 정수 근무일 `>= 1`, Milestone은 `0`이고 `start=end`다.
- Summary의 일정·진척 값은 선택적 source snapshot일 뿐 authoritative하지 않다. Server preview가 자식에서 다시 계산하고 차이를 표시한다.
- Leaf의 `scheduleMode`는 `auto|manual`이고 생략 시 `auto`가 기본이다.

### 실환경에서 확인할 사항

| 항목 | 현재 상태 | 확인이 필요한 내용 |
| --- | --- | --- |
| Excel 환경 | UNKNOWN | Windows/Mac, Excel edition/build, 32/64-bit, Workbook 확장자, VBA project 배치 방식 |
| Macro 정책 | UNKNOWN | 서명, Trusted Publisher/Location, Protected View, 관리자 정책에서 실행 허용 여부 |
| DRM 동작 | UNKNOWN | VBA 실행, Cell 읽기, 새 파일 생성, 승인된 directory 쓰기 각각의 허용 여부 |
| Workbook 구조 | UNKNOWN | 대상 sheet, header 위치, 병합 셀, 숨김 행/열, Table 사용 여부, Formula/오류 셀 |
| Source 문법 | UNKNOWN | Type, Progress, Parent, Predecessor, 날짜가 실제로 어떤 값·표시 형식으로 저장되는지 |
| Project metadata 출처 | UNKNOWN | Workbook 명명 영역/별도 sheet/operator 입력 중 승인된 출처 |
| 저장 위치 | UNKNOWN | 허용된 local/network directory, 파일명 규칙, overwrite와 보존 정책 |
| Web importer | BLOCKED | 아직 구현되지 않아 실제 preview/commit round-trip을 수행할 수 없음 |

Microsoft 365 Apps는 Internet 출처 파일의 Macro를 기본 차단할 수 있고 조직 정책이 사용자 선택보다 우선할 수 있다. POC는 차단 설정을 낮추지 않고 관리자에게 승인된 배포 방식만 확인한다. [Microsoft: Macros from the internet are blocked by default](https://learn.microsoft.com/en-us/microsoft-365-apps/security/internet-macros-blocked)

## 3. POC 실행 원칙

1. 조직 담당자가 POC Workbook, Macro 실행 방식, 출력 directory를 명시적으로 승인한다.
2. 승인된 원본의 사본 또는 승인된 시험 Workbook에서 시작한다. 원본 Workbook을 저장하거나 구조를 변경하지 않는다.
3. 사용자가 Workbook과 Worksheet를 명시적으로 선택한다. `ActiveWorkbook`/`ActiveSheet`가 우연히 올바르다고 가정하지 않는다.
4. 진단 단계는 Workbook 정보와 Cell 값을 **읽기만** 한다. `RefreshAll`, 외부 연결 갱신, Link update, 계산 모드 변경을 수행하지 않는다.
5. Header mapping과 전체 행 validation을 메모리에서 완료한 뒤에만 출력한다.
6. 오류가 하나라도 있으면 import 파일을 성공 산출물로 확정하지 않는다. 모든 오류 행을 사용자에게 보고하며 조용히 건너뛰지 않는다.
7. Warning만 있는 경우 사용자가 내용을 확인한 뒤 출력한다. Warning은 Server validation을 면제하지 않는다.
8. 사용자가 선택한 승인 directory 외에 파일을 저장하지 않는다. HTTP upload는 별도 조직 승인이 없는 한 범위 밖이다.
9. 생성 파일은 Web preview에서 다시 parsing, schema, business, calendar, hierarchy, dependency, cycle 검증을 거친다.

## 4. Worksheet와 Header 탐색

### 탐색 절차

POC는 다음 값을 operator profile로 명시적으로 받는다.

- Workbook과 Worksheet
- 검색할 header row 범위(초기 후보: 실제 사용 영역 안의 앞 50개 행, 환경 확인 후 조정)
- Project metadata 위치 또는 입력 방식
- Source-specific Header alias 추가 목록
- Progress 단위와 Predecessor source 문법

각 후보 행에서 빈 Cell을 제외한 header text를 읽고, 앞뒤 공백 제거와 연속 whitespace 축약 후 Unicode 문자열을 case-insensitive alias table과 비교한다. 이 정규화는 **Header 이름에만** 적용하며 데이터 `externalId`에는 적용하지 않는다.

하나의 필수 field가 둘 이상의 열에 매핑되거나, 여러 후보 행이 같은 최대 필수 Header 집합을 가지거나, 필수 Header가 빠지면 자동 선택하지 않고 오류로 종료한다. 병합된 Header, 다단 Header, 동일 이름 중복은 대상 Workbook에 맞춘 profile 승인 전까지 `AMBIGUOUS_HEADER`다.

열 문자/번호는 탐색 결과로 현재 실행 중에만 사용한다. 저장된 mapping은 Header 이름과 Worksheet fingerprint를 함께 표시하고, Workbook 구조가 달라지면 다시 탐색한다.

### 초기 Header alias 후보

실제 Workbook 조사 후 alias를 좁히거나 추가한다. Alias 충돌은 첫 번째 일치로 해결하지 않는다.

| Canonical field | 초기 alias 후보 | v1 처리 |
| --- | --- | --- |
| `externalId` | `External ID`, `ExternalId`, `Activity ID`, `Task ID`, `업무 ID`, `작업 ID` | 모든 Task에 필수 |
| `name` | `Name`, `Activity`, `Task`, `Task Name`, `업무`, `작업명` | 모든 Task에 필수 |
| `type` | `Type`, `Task Type`, `유형`, `작업 유형` | 모든 Task에 필수 |
| `scheduleMode` | `Schedule Mode`, `Mode`, `일정 모드` | 선택; 빈 값은 `auto` |
| `start` | `Start`, `Start Date`, `시작`, `시작일` | Task/Milestone 필수, Summary 선택 snapshot |
| `end` | `Finish`, `End`, `End Date`, `Finish Date`, `종료`, `종료일` | 선택; 제공 시 Server가 canonical end와 비교 |
| `duration` | `Duration`, `Working Days`, `기간`, `작업일수` | Task/Milestone 필수, Summary 선택 snapshot |
| `progress` | `Progress`, `% Complete`, `Complete %`, `진척률`, `진행률` | Task/Milestone 필수, Summary 선택 snapshot |
| `parentExternalId` | `Parent ID`, `Parent External ID`, `상위 업무 ID`, `부모 ID` | 선택; 빈 값은 `null` |
| `predecessors` | `Predecessors`, `Predecessor`, `선행 업무`, `선행 작업` | 선택 source; 빈 값은 빈 배열로 정규화 |

그 밖의 열은 읽기 범위를 넓히지 않고 무시한다. 특히 WBS, 화면상의 행 번호, Excel outline level을 `externalId` 또는 Parent 관계로 암묵 변환하지 않는다.

## 5. 값 정규화와 관계 변환

### 문자열과 `externalId`

- `name`과 Project 표시 문자열은 VBA Unicode 문자열로 읽고 JSON escaping 후 UTF-8로 encode한다.
- JSON string은 `"`, `\\`, 제어문자 U+0000–U+001F를 올바르게 escape한다. 한글, 일반 Unicode, 줄바꿈, 따옴표, backslash fixture를 round-trip한다.
- `externalId`는 source 값을 그대로 보존한다. 앞뒤 whitespace가 있으면 trim해 고치지 않고 `EXTERNAL_ID_WHITESPACE` 오류로 알린다.
- Exact duplicate만 중복이며 `A-1`과 `a-1`은 서로 다른 ID다. Unicode normalization이나 대소문자 folding을 적용하지 않는다.
- 명시적 안정 ID 열이 없으면 행 번호를 생성 ID로 쓰지 않고 POC를 중단한다. 조직이 승인한 안정 ID 생성 규칙은 별도 schema 영향 검토 후에만 추가한다.
- `=`, `+`, `-`, `@`로 시작하는 name/ID도 계약상 일반 문자열이다. 앞에 apostrophe를 붙여 값을 변형하지 않으며 Web importer는 이를 Formula로 평가하지 않는다.

### Type과 Schedule Mode

초기 source mapping 후보는 `Task|업무|작업 → task`, `Summary|요약 → summary`, `Milestone|마일스톤 → milestone`, `Auto|자동 → auto`, `Manual|수동 → manual`이다. 빈 `scheduleMode`만 `auto`로 정규화한다. 알려지지 않은 값이나 빈 `type`은 오류이며 indentation, bold style, duration 0만으로 type을 추측하지 않는다.

### 날짜

- 출력은 시각·timezone suffix 없는 실제 Gregorian date `YYYY-MM-DD`만 허용한다.
- `Range.Text`는 표시 format과 열 너비의 영향을 받으므로 canonical source로 쓰지 않는다. `Range.Value2`는 Date/Currency subtype 대신 숫자 값을 반환하므로 Cell type과 Workbook date system을 별도로 확인한다. [Microsoft: Range.Value2](https://learn.microsoft.com/en-us/office/vba/api/excel.range.value2), [Microsoft: Range.Text](https://learn.microsoft.com/en-us/office/vba/api/excel.range.text)
- 숫자형 Excel date는 `Workbook.Date1904`를 확인한 뒤 Workbook의 date system에 맞게 calendar date로 변환한다. 이 property는 Workbook이 1904 date system을 쓰는지 알려준다. [Microsoft: Workbook.Date1904](https://learn.microsoft.com/en-us/office/vba/api/excel.workbook.date1904)
- Excel의 1900/1904 date system은 같은 날짜의 serial이 1,462일 차이 난다. Raw serial을 언제나 1900 기준으로 해석하지 않고, 두 date system의 sentinel Workbook으로 결과를 검증한다. [Microsoft: Date systems in Excel](https://support.microsoft.com/en-au/office/date-systems-in-excel-e7fe7167-48a9-4b96-bb53-5612a800b487)
- Text date는 초기에는 exact ISO `YYYY-MM-DD`만 자동 허용한다. `09/10/26`, `10-09-2026` 같은 locale-dependent 문자열은 `AMBIGUOUS_DATE_TEXT`로 보고하며 `CDate` 추측 변환을 하지 않는다.
- 숫자 serial에 fractional time이 있거나 Formula error/Boolean/빈 leaf date면 오류다. Project 범위 밖의 오래된 Excel edge date 지원 범위는 target data 조사 후 정한다.
- Exporter는 weekend/holiday/FS를 재계산하지 않는다. `end`가 있으면 그대로 canonical date로 전달하고, Server preview가 Project calendar로 정규화한 requested `start + duration`의 dependency 적용 전 end와 일치하는지 검증한다.

### Duration과 Progress

- Task duration은 정수 `>=1`, Milestone duration은 정확히 `0`이어야 한다. Summary 값은 선택 snapshot이다. 숫자 문자열, 소수, 음수, 빈 leaf duration을 자동 반올림하거나 type 변환하지 않는다.
- Canonical progress는 finite number `0..100`이며 소수를 보존한다. 예: 25.5는 25.5%다. 정수 강제 변환이나 반올림으로 바꾸지 않는다.
- Percent-format Cell은 저장 numeric value에 100을 곱하는 profile, plain numeric Cell은 이미 0..100인 profile을 사용한다. 한 column 안에서 두 단위를 행별 heuristic으로 섞지 않는다.
- 실제 Workbook에서 `0`, `0.25`, `1`, `25`, `25%`, `100%`, 빈 값과 formula 결과를 조사해 source profile을 승인한다. `1`이 1%인지 100%인지 알 수 없는 상태에서는 `AMBIGUOUS_PROGRESS_UNIT`로 중단한다.

### Parent와 Predecessor

- 모든 Task의 `externalId`를 첫 pass에서 색인하고, 두 번째 pass에서 Parent와 Predecessor를 연결한다.
- `parentExternalId`는 같은 batch의 exact ID 또는 `null`이다. Self parent, missing parent, non-summary parent, hierarchy cycle은 오류다.
- Predecessor는 successor Task의 `predecessors` 배열로 출력하며 각 원소는 `{"externalId":"<predecessor>","type":"FS","lag":0}`다.
- Self dependency, duplicate edge, missing target, summary endpoint, dependency cycle은 오류다.
- Source Workbook의 다중 Predecessor 문법은 아직 UNKNOWN이다. JSON array cell, 별도 dependency table 등 무손실 source grammar를 먼저 확인한다. 쉼표/세미콜론 split은 ID 자체에 해당 문자가 없다는 승인된 제약 없이는 사용하지 않는다.
- `SS`, `FF`, `SF`, non-zero lag/lead를 발견하면 FS/0으로 바꾸지 않고 `UNSUPPORTED_DEPENDENCY`로 보고한다.

## 6. JSON 출력 계획

JSON이 primary format이다. 아래는 POC가 따라야 할 v1 구조의 설명이며 필수/선택 세부 규칙은 [IMPORT_SCHEMA.md](IMPORT_SCHEMA.md)가 우선한다.

```json
{
  "schemaVersion": "1.0",
  "project": {
    "name": "설비 증설",
    "description": "기존 Excel 일정"
  },
  "tasks": [
    {
      "externalId": "SUM-10", "name": "공사", "type": "summary",
      "parentExternalId": null, "predecessors": []
    },
    {
      "externalId": "ACT-090", "name": "설계", "type": "task",
      "start": "2026-09-10", "end": "2026-09-10", "duration": 1,
      "progress": 100, "parentExternalId": "SUM-10", "predecessors": []
    },
    {
      "externalId": "ACT-100",
      "name": "기초 공사",
      "type": "task",
      "scheduleMode": "auto",
      "start": "2026-09-11",
      "end": "2026-09-14",
      "duration": 2,
      "progress": 25,
      "parentExternalId": "SUM-10",
      "predecessors": [
        { "externalId": "ACT-090", "type": "FS", "lag": 0 }
      ]
    }
  ]
}
```

Canonical POC export는 UTF-8 **without BOM**으로 쓴다. Reader가 leading UTF-8 BOM을 방어적으로 제거할 수 있더라도 exporter는 BOM을 생성하지 않는다. Excel/VBA의 기본 text output encoding이나 system locale을 신뢰하지 않고 byte-level UTF-8 결과를 검증한다.

## 7. 승인된 CSV fallback v1

CSV는 JSON과 같은 domain model을 무손실로 표현하는 fallback이다. Manager와 Backend 공동 검토에서 다음 grammar가 승인되었고 독립 Planning QA를 통과했다. 실제 producer/parser 실행 검증은 아직 남아 있다.

### Encoding과 record grammar

- Canonical exporter는 UTF-8 BOM을 반드시 쓴다. Backend reader는 BOM 유무를 모두 수용한다.
- RFC 4180 방식의 comma delimiter, double quote escaping, CRLF record ending을 사용한다.
- 한 행은 Task 하나다. Header 다음 첫 data row부터의 등장 순서가 JSON `tasks` 배열 순서이고, 같은 Parent 아래에서 sibling order가 된다.
- Excel의 locale list separator나 `SaveAs` 기본 code page에 의존하지 않는다. Microsoft 문서에 따르면 Excel의 CSV/text `SaveAs`는 현재 computer의 system locale code page를 사용할 수 있다. [Microsoft: Workbook.SaveAs](https://learn.microsoft.com/en-us/office/vba/api/excel.workbook.saveas)
- 따라서 POC는 comma/quote/CRLF와 UTF-8 BOM을 직접 제어하는 writer를 검증한다. Excel의 `xlCSVUTF8` 지원 여부만으로 grammar 일치를 가정하지 않는다. `xlCSVUTF8` 상수는 UTF-8 CSV를 나타내지만 실제 대상 build와 delimiter round-trip은 별도 확인한다. [Microsoft: XlFileFormat enumeration](https://learn.microsoft.com/en-us/office/vba/api/excel.xlfileformat)

정확한 Header와 순서는 다음과 같다. 모든 Header가 필수이며 unknown, missing, duplicate, 순서 불일치는 hard error다.

```text
schemaVersion,projectName,projectDescription,externalId,name,type,scheduleMode,start,end,duration,progress,parentExternalId,predecessors
```

### Cell 규칙

- `schemaVersion`, `projectName`, `projectDescription`은 모든 data row에 반복하며 각각 모든 행에서 byte-decoded string 값이 동일해야 한다. last-row-wins로 처리하지 않는다.
- `schemaVersion`은 매 행 exact `1.0`이다. Project metadata는 확인용이며 target Project를 수정하지 않는다.
- `parentExternalId` 빈 Cell은 `null`로 변환한다.
- `end` 빈 Cell은 JSON contract가 허용하는 absent/null 의미로 변환한다.
- `predecessors`는 JSON 1.0 predecessor array를 담은 JSON text Cell이다. 빈 배열은 literal `[]`이며 blank Cell은 오류다.
- Summary의 start/end/duration/progress Cell은 비우거나 source snapshot을 담을 수 있지만 Server 계산의 authoritative input이 아니다.
- Task/Milestone의 계약상 필수 Cell은 비울 수 없다.
- 빈 data row, metadata 불일치, 잘못된 embedded JSON, 잘못된 quote는 전체 파일 오류다.
- Formula-like text는 text 그대로 parsing하고 실행하지 않는다.

예시의 마지막 Cell은 CSV quote 규칙 때문에 JSON의 double quote를 두 번 쓴다.

```csv
schemaVersion,projectName,projectDescription,externalId,name,type,scheduleMode,start,end,duration,progress,parentExternalId,predecessors
1.0,설비 증설,기존 Excel 일정,SUM-10,공사,summary,auto,,,,,,[]
1.0,설비 증설,기존 Excel 일정,ACT-090,설계,task,auto,2026-09-10,2026-09-10,1,100,SUM-10,[]
1.0,설비 증설,기존 Excel 일정,ACT-100,"기초, 공사",task,auto,2026-09-11,2026-09-14,2,25,SUM-10,"[{""externalId"":""ACT-090"",""type"":""FS"",""lag"":0}]"
```

CSV를 Excel에서 다시 열고 저장하는 round-trip은 계약의 일부가 아니다. Excel이 formula-like text나 locale delimiter를 재해석할 수 있으므로 생성 파일을 수동 재저장하지 않고 Web Import에 직접 전달한다.

## 8. File Save와 오류 보고

### File Save

1. `Application.GetSaveAsFilename` 같은 사용자 선택 dialog로 경로만 선택하고, 취소는 정상 종료로 처리한다. 이 method는 경로를 반환할 뿐 실제 파일을 저장하지 않는다. [Microsoft: Application.GetSaveAsFilename](https://learn.microsoft.com/en-us/office/vba/api/excel.application.getsaveasfilename)
2. 승인된 directory인지 확인하고 `.json` 또는 `.csv` 확장자를 format과 일치시킨다.
3. 기존 파일을 명시적 확인 없이 overwrite하지 않는다.
4. 같은 directory의 임시 파일에 완전한 bytes를 쓴 뒤 close/size 확인 후 최종 이름으로 확정하는 방식을 POC에서 검증한다.
5. JSON은 UTF-8 no BOM, CSV는 UTF-8 BOM을 byte inspection으로 확인한다.
6. 최종 경로와 row/error/warning count를 화면에 보여 주되 Workbook password, DRM 정보, Cell 전체 내용 같은 민감 정보를 log에 쓰지 않는다.

저장 API와 UTF-8 writer는 대상 OS/Excel bitness에서 사용 가능한 승인된 방식으로 선택한다. Windows-only COM component를 Mac에서도 된다고 가정하거나, 참조 library가 없는 환경에서 silent fallback하지 않는다.

### 오류와 Warning

각 문제는 최소 다음 정보를 가진다.

```text
severity: ERROR | WARNING
code: stable machine-readable code
worksheet: sheet name
row: source row number
field: canonical field
externalId: 안전하게 표시 가능한 경우
message: 사용자가 수정할 수 있는 설명
```

초기 오류 code 후보:

- `MACRO_NOT_ALLOWED`, `CELL_READ_BLOCKED`, `SAVE_NOT_ALLOWED`
- `HEADER_NOT_FOUND`, `AMBIGUOUS_HEADER`, `DUPLICATE_HEADER`
- `MISSING_REQUIRED_VALUE`, `INVALID_TASK_TYPE`, `INVALID_SCHEDULE_MODE`
- `EXTERNAL_ID_WHITESPACE`, `DUPLICATE_EXTERNAL_ID`
- `INVALID_DATE`, `AMBIGUOUS_DATE_TEXT`, `DATE_SYSTEM_MISMATCH`
- `INVALID_DURATION`, `INVALID_PROGRESS`, `AMBIGUOUS_PROGRESS_UNIT`
- `MISSING_PARENT`, `INVALID_PARENT_TYPE`, `PARENT_CYCLE`
- `MISSING_DEPENDENCY`, `DUPLICATE_DEPENDENCY`, `DEPENDENCY_CYCLE`, `UNSUPPORTED_DEPENDENCY`
- `JSON_ENCODING_ERROR`, `CSV_ENCODING_ERROR`, `FILE_WRITE_ERROR`

오류 보고 자체를 파일로 저장해야 한다면 그 위치도 조직 승인을 받아야 한다. 승인이 없으면 Excel 화면의 bounded summary와 row별 결과 sheet 생성 여부를 별도로 결정하며, 원본 Workbook에는 자동으로 sheet를 추가하지 않는다.

## 9. 실환경 POC Matrix

현재 실환경이 없으므로 완료 증거가 없는 항목을 `PASS`로 표시하지 않는다.

POC는 두 Gate로 나눈다. **초기 W10 Gate**는 승인 환경에서 VBA/cell/header/추출/JSON·CSV 저장/한글/날짜를 확인하고, W11의 작은 browser file-reader/parser harness로 실제 생성 파일을 읽는 데까지다. 전체 Import API/UI를 먼저 구현하지 않는다. **후속 통합 Gate**인 POC-13/17/18/19의 완성된 application preview/commit은 W12/W13 이후 검증한다. Web integration 행이 초기 POC와 full importer의 순환 의존성을 만들지 않게 한다.

| ID | 검증 항목 | 실행 방법과 fixture | 완료 기준/증거 | 현재 상태 | 해제 조건 |
| --- | --- | --- | --- | --- | --- |
| POC-01 | 대상 Workbook에서 VBA 실행 | 승인된 진단 Macro를 사용자 동작으로 1회 실행 | Excel build, Workbook, 실행 시각, 승인 경로와 정상 종료 기록 | BLOCKED | 대상 Excel/DRM 환경과 Macro 승인 |
| POC-02 | 필요한 Cell 읽기 | 한글/숫자/date/formula/error/hidden Cell의 값을 read-only로 조사 | 각 type의 원시 type/value를 읽고 원본이 변경되지 않음 | BLOCKED | 대상 Workbook 제공 |
| POC-03 | Header 발견 | Header 순서 변경, extra column, alias, duplicate/missing fixture | 위치가 달라도 유일 mapping; ambiguity/missing은 명시 오류 | BLOCKED | Workbook 구조와 alias 승인 |
| POC-04 | 필요한 열만 추출 | unrelated/hidden/PII test column 포함 fixture | canonical field만 산출되고 제외 열이 JSON/CSV/log에 없음 | BLOCKED | 대상 mapping profile 확정 |
| POC-05 | JSON 생성 | quote, backslash, CRLF, `설계 검토 – 서울`, emoji fixture | JSON parser 성공, schemaVersion 1.0, UTF-8 no BOM, code point round-trip | BLOCKED | VBA writer와 parser fixture 구현 |
| POC-06 | CSV fallback 생성 | comma, double quote, CRLF, Korean, empty array, multi-predecessor | 승인 Header/grammar, UTF-8 BOM, RFC 4180 parse, JSON model과 동등 | BLOCKED | VBA writer와 Backend CSV parser 구현 |
| POC-07 | 1900 date system | known cells `2026-09-11`, leap/month/year boundary | expected `YYYY-MM-DD`; no locale/time suffix | BLOCKED | 1900-system sentinel Workbook |
| POC-08 | 1904 date system | POC-07과 동일한 calendar dates의 1904 Workbook | 1900 fixture와 같은 output date; 1,462일 drift 없음 | BLOCKED | 1904-system sentinel Workbook |
| POC-09 | Progress | 0, 0.25, 1, 25.5, 25%, 100%, invalid/mixed unit | 승인된 profile대로 finite 0..100 소수 보존; ambiguous/invalid 명시 오류 | BLOCKED | 실제 source 단위 확인 |
| POC-10 | `externalId` | duplicate, `A`/`a`, leading/trailing space, missing ID | exact/case-sensitive 보존; duplicate/공백/빈 값 전체 오류 | BLOCKED | Target fixture 실행 |
| POC-11 | Parent 변환 | forward parent, missing/non-summary/self/cycle fixture | valid exact reference 유지; 각 invalid 관계가 명시 오류 | BLOCKED | Source Parent grammar 확인 |
| POC-12 | Dependency 변환 | single/multiple/forward/missing/self/cycle/SS/lag fixture | FS/0만 정확한 array; unsupported를 변환·누락하지 않음 | BLOCKED | Source Predecessor grammar 확인 |
| POC-13 | Summary snapshot | summary snapshot과 자식 계산값이 다른 fixture | Export 보존/생략 규칙 일치, Web preview가 derived diff 표시 | BLOCKED | Import schema와 Server preview 구현 |
| POC-14 | 승인 위치 JSON 저장 | cancel, denied directory, existing file, disk/write failure | 취소/실패가 원본·기존 파일을 훼손하지 않고 명시 오류 | BLOCKED | 승인 directory와 VBA writer 제공 |
| POC-15 | 승인 위치 CSV 저장 | POC-14와 동일 | BOM/완전한 file만 최종 이름에 존재 | BLOCKED | 승인 directory와 VBA writer 제공 |
| POC-16 | 오류 행 보고 | 한 파일에 여러 독립 오류와 warning 삽입 | 모든 문제 위치/code 표시, 오류 행 silent skip 없음, import artifact 미확정 | BLOCKED | VBA validation/report UI 구현 |
| POC-17 | Web JSON preview | 생성 JSON을 unlock된 기존 Project에 preview | Server parse/schema/business validation, normalized result와 warning 확인 | BLOCKED | Web JSON preview 구현과 edit session |
| POC-18 | Web CSV preview | 생성 CSV를 동일 fixture로 preview | JSON preview와 동등한 tasks/dependencies/order/result | BLOCKED | 승인 CSV parser와 preview 구현 |
| POC-19 | Atomic commit | valid batch 및 마지막 행 invalid batch 각각 commit | valid 전체 생성; invalid는 task/link 0건 생성, revision/DB 불변 | BLOCKED | Backend import transaction 구현 |
| POC-20 | DRM/정책 negative path | Macro, Cell read, JSON save, CSV save를 정책별로 확인 | 차단 이유를 기록하고 우회 없이 승인 대안으로 종료 | BLOCKED | 조직 보안 담당자 동반 실환경 시험 |

## 10. POC 실행 기록 Template

각 실행은 다음 정보를 남긴다. 민감한 원본 Cell 값이나 Password는 기록하지 않는다.

```text
POC ID:
Date/time:
Tester:
Excel OS/edition/build/bitness:
Workbook identifier (비민감 값):
Workbook.Date1904:
DRM/product policy identifier (허용 범위 내):
Macro approval/deployment method:
Worksheet/header profile version:
Approved output location class:
Input row count:
Output task/dependency count:
Error/warning count and codes:
SHA-256 of generated fixture file:
Web preview request/result identifier:
Status: UNKNOWN | BLOCKED | PASS | FAIL
Evidence location:
Notes:
```

현재 문서의 표에는 실행되지 않은 결과를 기록하지 않는다. 실제 POC 수행 뒤에만 담당자가 증거와 함께 `PASS` 또는 `FAIL`로 갱신한다.

## 11. 중단 기준과 승인 필요 사항

다음 중 하나면 POC 또는 구현을 중단하고 Manager/조직 담당자에게 보고한다.

- VBA 실행, Cell read, file write가 DRM 또는 관리자 정책으로 차단됨
- 차단을 해제하려면 Macro/Protected View/DRM/Endpoint 보안 정책을 낮춰야 함
- 안정적인 `externalId` 또는 무손실 Parent/Predecessor source 문법을 찾을 수 없음
- 승인 directory가 없거나 한글 UTF-8 round-trip을 보장할 writer를 사용할 수 없음
- 날짜 system 또는 Progress 단위를 유일하게 결정할 수 없음
- 실제 Workbook 계약이 `IMPORT_SCHEMA.md`와 충돌함
- Backend preview/commit이 JSON과 CSV에서 다른 domain result를 만듦

허용 가능한 전환 후보는 조직이 승인한 별도 JSON/CSV 생성 절차 또는 Manual Import Grid다. DRM 해제·우회, Clipboard 사용 가능성 추정, 승인되지 않은 HTTP 전송은 대안이 아니다.

## 12. 구현 착수 전 남은 결정

- 대상 Excel version/OS 범위와 Windows-only dependency 허용 여부
- Macro 서명/배포와 source Workbook에 code를 포함할지 별도 `.xlam`을 사용할지
- Worksheet 선택 UI, Header 검색 범위 및 실제 alias profile
- Project metadata 입력 위치와 mismatch warning UX
- 실제 Workbook의 Parent/Predecessor source grammar
- Progress column 단위와 Formula result 허용 정책
- Excel date 지원 최소/최대 범위
- 승인된 output directory, filename, overwrite, 오류 report 보존 정책
- Web import byte/row/depth/date range 상한
- CSV grammar에 대한 독립 QA 결과

이 결정과 실환경 POC가 끝나기 전에는 VBA 본 구현의 호환성 또는 DRM 환경 성공을 완료로 간주하지 않는다.
