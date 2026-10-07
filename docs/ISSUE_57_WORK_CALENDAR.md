# Issue #57 작업 캘린더 설계 및 구현

## 1. 목적

Project 일정과 Resource 공수 계산에서 사용하는 근무일 규칙을 하나의 Working Calendar 도메인으로 통합한다.

- Project 일정: 주간 기본 규칙 + 국가 공휴일 + 프로젝트 휴무일
- Resource 공수: Project Calendar → Resource Group 근무/휴무 예외 → Resource 개인 근무/휴무 예외
- 외부 공휴일 API에 런타임 의존하지 않는다.
- SVAR React Gantt PRO Calendar/Auto Scheduling 구현에는 의존하지 않는다.

## 2. 요구사항 결정

### 국가 규칙

지원 국가는 다음 7개다.

| Code | 국가 |
| --- | --- |
| KR | 대한민국 |
| CN | 중국 |
| VN | 베트남 |
| PH | 필리핀 |
| TH | 태국 |
| MX | 멕시코 |
| US | 미국 |

신규 Project는 같은 UTC 연도의 사용 가능한 공식 자료가 있으면 `KR / FULL_PROJECT`로 시작한다. #342부터 같은 연도 자료가 없으면 국가 rule 없이 월~금 기본 주간 규칙으로 생성한다. 기존 Project에는 migration만으로 국가 규칙을 새로 추가하지 않는다.

국가 규칙은 `FULL_PROJECT` 또는 `DATE_RANGE`를 사용한다. 여러 국가 규칙을 동시에 적용할 수 있으며 같은 날짜에 같은 `dayType`이 중복되면 하나의 유효 날짜로 합치고 source 목록을 보존한다.

서로 다른 source가 같은 날짜를 `WORKING`과 `NON_WORKING`으로 동시에 지정하면 암묵적으로 우선순위를 고르지 않고 충돌로 거부한다.

### 날짜 예외

Scheduling Domain은 다음 두 종류의 명시적 날짜 예외를 지원한다.

- `NON_WORKING`: 기본 근무일을 휴무일로 변경
- `WORKING`: 기본 주말을 근무일로 변경

우선순위는 **명시적 날짜 예외 > 주간 기본 규칙**이다. 기본 주간 규칙은 기존과 동일한 월~금 근무, 토·일 휴무다.

중국의 주말 보충 근무와 베트남의 교환 근무일은 `WORKING`으로 저장한다.

### 조직·개인 날짜 예외

Issue #57의 NON_WORKING-only CUSTOM은 Issue #261에서 Resource Group/Resource에 `NON_WORKING | WORKING`을 지원하도록 확장했다. Project CUSTOM은 `NON_WORKING`만 허용한다. 이전 요청에서 dayType을 생략하면 `NON_WORKING`으로 정규화한다.

- `PROJECT`: Project 일정과 Resource 공수에 반영
- `RESOURCE_GROUP`: 해당 그룹 Resource의 공수 계산에만 반영
- `RESOURCE`: 해당 Resource의 공수 계산에만 반영

Resource Group/Resource 휴무 때문에 Project Task의 시작/종료일을 변경하지 않는다.

## 3. Effective Calendar

### Project Calendar

```text
Base weekly rule
  + Project COUNTRY date exceptions
  + Project CUSTOM NON_WORKING dates
```

### Resource Calendar

```text
Project Calendar
  → all explicit Resource Group WORKING / NON_WORKING dates
  → explicit Resource WORKING / NON_WORKING dates
```

더 구체적인 명시 예외가 상위 결과를 override한다. 국가/Project 휴무를 Group WORKING이 되돌리고, Group 휴무를 Resource WORKING이 되돌릴 수 있다. 같은 level의 같은 dayType은 계산상 한 번만 적용하면서 모든 source를 추적한다. 반대 dayType은 `RESOURCE_CALENDAR_EXCEPTION_CONFLICT`이며 개인 예외가 Group 상호 충돌을 숨기지 않는다. 빈 Group 동일 target 내부 충돌도 거부한다.

이미 상위와 같은 dayType을 명시한 예외는 저장 가능한 NO_EFFECT warning이다. 이 효과는 바로 위 계층과 비교하며 최종 상태/winning layer/source를 별도로 반환한다. 글로벌 Group membership 변경도 모든 Project(미배정 포함)의 동일-level 불변조건을 transaction 안에서 검증하며 실패하면 membership/revision을 rollback한다.

## 4. 데이터 모델

### work_calendar_rules

규칙의 출처와 적용 대상을 저장한다.

- `kind`: `COUNTRY | CUSTOM`
- `country_code`: KR/CN/VN/PH/TH/MX/US
- `target_type`: `PROJECT | RESOURCE_GROUP | RESOURCE`
- `target_public_id`
- `scope`: `FULL_PROJECT | DATE_RANGE`
- `effective_from`, `effective_to`
- `source_version`

### work_calendar_dates

실제 계산 가능한 날짜 예외를 materialize한다.

- `calendar_rule_id`
- `date`
- `day_type`: `NON_WORKING | WORKING`
- `name`
- `source_key`
- `source_version`

### 기존 project_holidays 호환

`0006_work_calendars.sql`은 기존 `project_holidays`를 Project CUSTOM 규칙으로 이관한다.

기존 Scheduling/fixture 코드와 단계적 호환을 위해 `project_holidays` 이름의 VIEW와 INSERT trigger를 유지한다. VIEW는 Project 대상 `NON_WORKING` 날짜만 노출한다.

## 5. 국가 공휴일 데이터 정책

런타임 외부 API 호출은 하지 않는다. 각 국가 fixture는 저장소에 다음 metadata와 함께 고정한다.

- 국가
- 지원 연도
- source version
- 공식/공공기관 source URL
- 날짜별 source key

Issue #57 최초 구현 지원 연도는 **2026년**이다.

지원 범위를 벗어난 국가 캘린더가 필요한 Preview/저장은 `COUNTRY_CALENDAR_UNAVAILABLE`로 거부한다. 국가 데이터가 갱신되어도 기존 Project 일정을 자동으로 재계산하지 않는다.

## 6. API

### GET /api/work-calendars/countries

지원 국가, 지원연도, source version/source URL을 조회한다.

### GET /api/projects/{publicId}/work-calendar

편집 세션을 요구한다. 현재 규칙과 Project 유효 날짜, 저장한 dayType을 복원하는 canonical `customDates[]`를 조회하며 Resource/Group/개인 휴무 사유가 공개 read API로 노출되지 않도록 한다.

### POST /api/projects/{publicId}/work-calendar/preview

편집 세션 + Origin + `If-Match`를 요구한다. DB를 변경하지 않고 다음을 계산한다.

- Project 적용 날짜
- 자동 일정 변경 Task
- Manual Task 충돌
- 입력 Resource/Group 예외별 CHANGED/NO_EFFECT, 영향 Resource, 최종 dayType/winning layer/source

### PUT /api/projects/{publicId}/work-calendar

편집 세션 + Origin + `If-Match`를 요구한다.

한 SQLite transaction에서 다음을 수행한다.

1. edit session 재검증
2. Project revision 재검증
3. 후보 Calendar materialize 및 Project/Resource/Group same-level 충돌 검사
4. Manual Task 충돌 거부
5. Calendar rule/date 교체
6. Auto Task 및 Summary 일정 재계산/저장
7. Project revision 정확히 1 증가

성공 후 클라이언트는 canonical Project snapshot을 다시 읽고 동일 화면에 반영한다.

## 7. Scheduling Engine 경계

Working Calendar 계산은 Pure Domain으로 유지한다.

- `createWorkingCalendar`
- `isWorkingDay`
- `nextWorkingDay`
- `workingDaysBetween`
- `endFromStart`
- `scheduleLeaf`
- `recalculateFinishStartDependencies`
- `recalculateHierarchy`

SVAR는 화면 표현과 상호작용에 사용하며 근무일 판정의 권위는 서버/도메인 계층에 둔다.

Issue #68에서 저장된 `FS/lag=0` dependency link까지 Calendar Preview/저장 재계산에 통합했다. 후보 Calendar로 Leaf base 일정을 다시 만든 뒤 FS forward-pass와 Summary 집계를 적용하며, Manual dependency 충돌은 전체 저장을 거부한다. 상세 계약은 [Issue #68](ISSUE_68_CALENDAR_DEPENDENCY_RECALC.md)을 따른다.

## 8. #56 Resource Workload 연계

`ResourceWorkloadService`는 Resource별 Effective Calendar를 계산한다.

따라서 다음 값이 개인/조직의 근무/휴무 override를 반영한다.

- M/D
- M/M 환산의 분자 M/D
- 일별 allocation 합계 및 과투입 판정

Project Task 일정 자체는 Resource/Group 휴무에 의해 변경되지 않는다.

## 9. UI

Project 설정에 작업 캘린더 편집기를 배치한다.

- 국가 규칙 추가/삭제
- 국가 선택
- 전체기간/기간지정
- Project 휴무일 및 그룹/개인 근무·휴무 날짜 예외 등록
- Preview
- 변경 Task 수/Manual 충돌 및 입력 예외별 적용됨/효과 없음 표시
- 적용 날짜 및 source 확인
- 저장

저장 후 브라우저 전체 reload를 수행하지 않고 canonical snapshot만 재조회한다.

## 10. 테스트 기준

필수 회귀 범위는 다음과 같다.

1. Domain: `WORKING` 주말 override, `NON_WORKING` 평일 override, 충돌 거부
2. Migration: 기존 `project_holidays` 보존
3. Country fixture: 7개 국가 2026 지원, 지원 외 연도 거부, CN/VN `WORKING`
4. Service: Preview는 무변경, PUT은 revision +1 및 원자 저장
5. Manual Task 충돌 시 저장 거부
6. Resource Effective Calendar가 #56 M/D와 과투입에 반영
7. UI: Preview/Save, 401/412 처리, canonical snapshot 동기화
8. Issue #261 SQLite/API: dayType round-trip/누락 정규화, Project WORKING 거부, same-level 충돌 Calendar/membership rollback, 모든 Project 검증, M/D/M/M/일별 과투입 및 Task 일정 불변, NO_EFFECT 저장 허용

GitHub Actions PR head의 quality, Chromium E2E, Docker gate가 전체 회귀의 공식 판정이다.

Issue #261 신규 migration은 N/A다. 기존 0006의 day_type/target CHECK와 index가 필요한 저장 구조를 이미 지원하며 구조 변경 없이 해석 규칙만 확장한다. 세부 응답/오류 계약은 [API](API.md), 영속 불변조건은 [DB_SCHEMA](DB_SCHEMA.md)를 따른다.

## 11. 후속 제약/확장

Issue #57 범위 밖:

- 반일/시간 단위 Calendar
- 국가 내 지역 공휴일
- Resource leveling
- 개인 휴무에 의한 Project Task 자동 재배치
- 런타임 외부 공휴일 API
- SVAR PRO Calendar 구현 복제

향후 국가 fixture의 지원 연도를 추가할 때 기존 source version을 덮어쓰지 않고 연도별 source/version을 보존한다.


## Issue #315 Project snapshot 표시용 이름 projection

Gantt Day Header처럼 읽기 전용 canonical Project snapshot만 사용하는 화면에서 Effective Calendar 이름을 재사용할 수 있도록 `ProjectCalendarDto.exceptions[]`에 optional `names`를 제공한다. 같은 Project/date/effective dayType에 저장된 `work_calendar_dates.name`을 trim·중복 제거·deterministic order로 모은 **표시용 projection**이다.

Scheduling Engine은 계속 날짜당 effective exception 하나만 사용한다. `names` 추가는 근무일 판정, COUNTRY/CUSTOM precedence, 충돌 규칙, DB schema를 바꾸지 않는다. `WORKING` 이름도 snapshot에는 보존할 수 있으나 #315 Tooltip은 이를 NON_WORKING 휴일명으로 표시하지 않는다.

## Issue #490 설정 소비자 presentation

Project 설정의 Calendar 국가/기간/날짜 예외 input/select에 기존 semantic border/background/padding/focus/disabled 표현을 적용한다. 기본 높이는 40px이며 footer 미리보기/저장 버튼은 12px gap과 자연스러운 wrap을 사용한다. label/fieldset/error association, 미리보기 stale 안내, 날짜 validation과 readonly/pending/401/412 처리는 기존 구현을 유지한다.

이 변경은 Calendar 계산·국가 fixture·COUNTRY/CUSTOM precedence·Resource 정책·API/DB schema를 변경하지 않는다. 401/412 뒤 설정이 닫힌 화면은 page-level 관측이며 Calendar 초안이 모두 보존된다는 의미가 아니다. 실제 5폭 상태/geometry와 계산 계약 N/A 근거는 [Issue #490 검토 기록](ISSUE_490_UI_UX_REVIEW.md)을 따른다.

#490 독립 검토 후390px에서 새 .field 적용 범위 select와 시작일 input을 실제 native Tab로 이동해 직접 focus를 관측한다. 기존 국가 select의 UA outline과 구분하고 visible bbox/outline3px+offset3px/clip owner를 검증한다. 현재 제품 CSS bytes는0.93.1 구현과 같으며 최신main/0.94.1 재검증의 source/spec/helper provenance를 새 파일에 기록한다. 과거 focused date가 viewport 아래에 있었던 사진을 가시성 PASS로 사용하지 않는다.


## Issue #342 국가 데이터 운영 확장

위 #57 최초 2026 fixture 계약은 #342에서 국가 원본 catalog 관리로 확장된다. 관리 범위 7국가 × 2026~2037 = 84 slots와 상태 OFFICIAL/UNAVAILABLE/SUPERSEDED를 제공한다. actual supportedYears는 완전 공식 자료가 있는 연도만 포함한다. 미래 관습 추정과 runtime 외부 API는 계속 금지한다. 공식 획득·발표·scope·sourceVersion 절차와 JSON/CSV 샘플은 [국가 데이터 운영](COUNTRY_CALENDAR_DATA.md)을 따른다.

built-in + DB override 모델에서 명시적 UNAVAILABLE/SUPERSEDED override는 built-in을 마스킹한다. 최신 자료는 명시적 Project Calendar Preview/Save에서만 materialize하며 기존 Project의 rule/date/Task/revision은 자동 갱신하지 않는다. Copy/Template/Workload도 저장 snapshot을 사용한다. 새 built-in sourceVersion은 기존 날짜에 소급 반영되지 않는다.

VN 2026의 1/2 NON_WORKING·1/10 WORKING 교환과 11/24 휴일은 공식 공지·법률에 따른 새 version이다. US 2027~2030은 OPM 고정 표이며 2028 표의 2027-12-31은 2027 dataset으로 정규화하고 원표 연도를 보존한다. TH 2027은 BOT 공식기관 scope의 18 dates다. 상세 scope와 추가 확보 중 연도 상태는 운영 문서가 기록한다.

관리자는 기존 Project Master session으로 JSON/CSV validation/Preview/전체 교체와 날짜 CRUD/metadata를 수행한다. Preview token은 raw UTF-8 / format / target / catalog revision / 현재 관리자 session / expiry 결속, Apply는 권한·자료를 같은 transaction에서 재검증한다. 날짜 actual 수정은 UNAVAILABLE + 출처 null로 공식 provenance를 무효화하고 명시적 source 재확인 후에만 OFFICIAL로 복귀한다. no-op은 write 0, actual 변경은 revision + 1, failure는 전체 rollback이다.

Project Preview는 countryCatalogRevision을 제공하고 신규 UI Save는 이를 보내 stale catalog 변화를 412로 막는다. 기존 Project If-Match/edit-session/Origin은 유지한다. 기본 신규 Project는 같은 UTC year KR current → 같은 year verified built-in → 국가 rule 없는 월~금으로 생성 가능하며, 명시적 국가 적용은 여전히 미확보 시 422다. API·영속 구조·보안 세칙은 [API](API.md), [DB_SCHEMA](DB_SCHEMA.md), [SECURITY](SECURITY.md)를 따른다.
