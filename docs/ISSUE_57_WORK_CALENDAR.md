# Issue #57 작업 캘린더 설계 및 구현

## 1. 목적

Project 일정과 Resource 공수 계산에서 사용하는 근무일 규칙을 하나의 Working Calendar 도메인으로 통합한다.

- Project 일정: 주간 기본 규칙 + 국가 공휴일 + 프로젝트 휴무일
- Resource 공수: Project Calendar + Resource Group 휴무일 + Resource 개인 휴무일
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

신규 Project의 기본 국가 규칙은 `KR / FULL_PROJECT`다. 기존 Project에는 migration만으로 국가 규칙을 새로 추가하지 않는다.

국가 규칙은 `FULL_PROJECT` 또는 `DATE_RANGE`를 사용한다. 여러 국가 규칙을 동시에 적용할 수 있으며 같은 날짜에 같은 `dayType`이 중복되면 하나의 유효 날짜로 합치고 source 목록을 보존한다.

서로 다른 source가 같은 날짜를 `WORKING`과 `NON_WORKING`으로 동시에 지정하면 암묵적으로 우선순위를 고르지 않고 충돌로 거부한다.

### 날짜 예외

Scheduling Domain은 다음 두 종류의 명시적 날짜 예외를 지원한다.

- `NON_WORKING`: 기본 근무일을 휴무일로 변경
- `WORKING`: 기본 주말을 근무일로 변경

우선순위는 **명시적 날짜 예외 > 주간 기본 규칙**이다. 기본 주간 규칙은 기존과 동일한 월~금 근무, 토·일 휴무다.

중국의 주말 보충 근무와 베트남의 교환 근무일은 `WORKING`으로 저장한다.

### 조직·개인 휴무

CUSTOM 규칙은 Issue #57에서 `NON_WORKING`만 제공한다.

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
  + all Resource Group NON_WORKING dates for groups containing the resource
  + Resource NON_WORKING dates
```

Resource/Group CUSTOM 휴무는 union 방식이므로 Project의 `WORKING` 날짜도 해당 Resource에 대해서는 다시 `NON_WORKING`이 될 수 있다.

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

현재 규칙과 Project 유효 날짜를 조회한다.

### POST /api/projects/{publicId}/work-calendar/preview

편집 세션 + Origin + `If-Match`를 요구한다. DB를 변경하지 않고 다음을 계산한다.

- Project 적용 날짜
- 자동 일정 변경 Task
- Manual Task 충돌

### PUT /api/projects/{publicId}/work-calendar

편집 세션 + Origin + `If-Match`를 요구한다.

한 SQLite transaction에서 다음을 수행한다.

1. edit session 재검증
2. Project revision 재검증
3. 후보 Calendar materialize 및 충돌 검사
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
- `recalculateHierarchy`

SVAR는 화면 표현과 상호작용에 사용하며 근무일 판정의 권위는 서버/도메인 계층에 둔다.

현재 저장된 dependency link가 존재하는 Project의 Calendar 일괄 재계산은 기존 Dependency Scheduling Engine 범위가 완성되기 전까지 안전하게 거부한다. 링크를 무시하고 일정만 부분 재계산하지 않는다.

## 8. #56 Resource Workload 연계

`ResourceWorkloadService`는 Resource별 Effective Calendar를 계산한다.

따라서 다음 값이 개인/조직 휴무를 반영한다.

- M/D
- M/M 환산의 분자 M/D
- 일별 allocation 합계 및 과투입 판정

Project Task 일정 자체는 Resource/Group 휴무에 의해 변경되지 않는다.

## 9. UI

Project 설정에 작업 캘린더 편집기를 배치한다.

- 국가 규칙 추가/삭제
- 국가 선택
- 전체기간/기간지정
- 프로젝트/그룹/개인 휴무일 등록
- Preview
- 변경 Task 수/Manual 충돌 표시
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

GitHub Actions PR head의 quality, Chromium E2E, Docker gate가 전체 회귀의 공식 판정이다.

## 11. 후속 제약/확장

Issue #57 범위 밖:

- 반일/시간 단위 Calendar
- 국가 내 지역 공휴일
- Resource leveling
- 개인 휴무에 의한 Project Task 자동 재배치
- 런타임 외부 공휴일 API
- SVAR PRO Calendar 구현 복제

향후 국가 fixture의 지원 연도를 추가할 때 기존 source version을 덮어쓰지 않고 연도별 source/version을 보존한다.
