# Issue #51 Gantt 주 단위 ISO Week Header

## 범위

Gantt의 `주` 표시 모드에서 하위 Chart Header를 날짜 범위(`9/14–9/20`) 대신 ISO 8601 week number로 표시한다. 이번 변경은 표시 포맷에 한정하며 일정 계산, API, DB 계약은 변경하지 않는다.

## 표시 계약

- 주 Header는 `W01`~`W53` 형식을 사용한다.
- 월별 순번으로 초기화하지 않고 ISO week-year 규칙을 따른다.
- 한 주는 월요일에 시작한다.
- ISO Week 1은 해당 ISO 연도의 첫 목요일, 동등하게 1월 4일을 포함하는 주다.
- 12월 말/1월 초에는 달력 연도와 ISO week-year가 다를 수 있으며 `W52 → W01`, 53주 연도에서는 `W53 → W01`을 허용한다.

## 구현

- `src/lib/iso-week.ts`의 순수 helper가 ISO week number와 `Wxx` label을 계산한다.
- SVAR React Gantt의 공식 `scales[].format` API에서 helper를 사용한다.
- SVAR가 전달한 브라우저 로컬 `Date`의 달력 연/월/일을 UTC 값으로 정규화한 뒤 계산하여 DST와 runtime timezone offset 영향을 배제한다.
- 외부 날짜 라이브러리, DOM 후처리, 페이지 reload, Gantt 강제 remount는 사용하지 않는다.

## 회귀 경계

다음 계약은 변경하지 않는다.

- 기본 `일` 모드의 월 + 일 Header
- 일 모드 주말 강조
- 작업 시작일/종료일과 duration
- predecessor/successor 관계
- Grid 데이터
- 서버 API 및 DB
- `일 ↔ 주` 전환 상태와 Gantt/API instance 유지 정책

## 자동 검증

- `tests/lib/iso-week.test.ts`
  - 같은 ISO 주의 동일 week number
  - 월 경계 연속성
  - `W52 → W01`
  - `W53 → W01`
  - 연초 날짜가 이전 ISO week-year에 속하는 경우
  - `W01`~`W09` zero padding
- `tests/e2e/project-gantt-scale.spec.ts`
  - 기본 day mode 유지
  - week mode에서 `W38`, `W39` 표시
  - 날짜 범위 Header 제거
  - `day → week → day → week` 반복 전환 후 Gantt/API instance identity 유지
  - 일 모드 주말 강조 회귀 없음

## 버전

Issue #51은 기존 기능의 표시 포맷을 ISO 8601 기준으로 바로잡는 호환 개선이므로 Semantic Versioning의 PATCH로 분류하고 `0.11.0`에서 `0.11.1`로 증가시킨다.
