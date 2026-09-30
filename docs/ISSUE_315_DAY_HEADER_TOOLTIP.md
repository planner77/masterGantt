# Issue #315 — Gantt Day Header 요일·휴일명 Tooltip

상태: 구현 branch 기준 DOCUMENTATION_SYNC. 최종 PASS/FAIL은 동일 PR head의 GitHub Actions로 판정한다.

## 목적과 범위

Project Workspace의 Gantt가 **일(day) 표시 단위**일 때 compact 숫자 Header를 유지하면서, 날짜 Header hover/focus에서 요일과 Project Effective Calendar의 명명된 비근무일을 확인할 수 있게 한다.

- Day Header 본문은 Issue #314의 day-of-month 숫자-only 표현을 유지한다.
- Week/Month Header에는 이번 Issue의 Tooltip을 추가하지 않는다.
- Scheduling Engine, 근무일 계산, Task/Link/Grid 저장 계약은 변경하지 않는다.
- WORKING override는 비근무 휴일명으로 표시하지 않는다.

## 설계 근거

### masterGantt

- `DESIGN.md`: Workspace-first, Data-dense, Progressive disclosure, layout shift 방지 원칙.
- `docs/UI_UX_GUIDELINES.md`: 기존 primitive/semantic token과 keyboard 접근성, viewport clipping 방지.
- `docs/ISSUE_57_WORK_CALENDAR.md`: Project Effective Calendar는 COUNTRY/CUSTOM Project 규칙의 materialized date를 canonical source로 사용하고 `work_calendar_dates.name`을 보존한다.
- `docs/ISSUE_35_GANTT_SCALE.md`: Day/Week scale 전환은 SVAR 공개 scale API를 사용하고 Gantt instance를 remount하지 않는다.

### SVAR React Gantt 2.7.3

공식 `scales` API의 `format`과 `css(date)` extension point를 사용한다.

- https://docs.svar.dev/react/gantt/api/properties/scales/
- https://docs.svar.dev/react/gantt/guides/timeline/scales/
- https://docs.svar.dev/react/gantt/samples/#/base/willow

SVAR 내부 Header DOM에서 날짜를 역추론하지 않는다. Day scale의 `css(date)`가 반환하는 masterGantt-owned class
`project-gantt-day-date-YYYYMMDD`를 날짜 식별 계약으로 사용한다.

## Calendar projection

Scheduling domain은 기존처럼 날짜당 effective exception 하나를 사용한다. 복수 source 이름을 표시하기 위해 Scheduling 입력을 복수 exception으로 바꾸지 않는다.

Canonical Project snapshot의 `ProjectCalendarExceptionDto`에 optional `names: string[]` projection을 추가한다.

- `name`: 기존 단일 이름 호환 projection 유지.
- `names`: 같은 날짜·같은 effective dayType에 저장된 의미 있는 Project-level 이름을 trim/deduplicate 후 binary lexical order로 제공.
- 반대 dayType 충돌은 기존처럼 fail-closed.
- `WORKING`의 `names`는 snapshot에 존재할 수 있으나 Day Header Tooltip은 이를 휴일명으로 표시하지 않는다.
- legacy fixture처럼 `exceptions`가 없는 경우 `holidays[]` 이름을 fallback으로 사용한다.

이 확장은 DB migration을 추가하지 않고 기존 `work_calendar_dates`를 읽기 전용 projection으로 재사용한다.

## Date / timezone 규칙

- lookup key는 `YYYY-MM-DD`.
- SVAR가 `css(date)`에 전달한 browser-local Date의 연/월/일을 기존 `dateOnlyFromLocalDate`로 추출한다.
- date-only weekday는 문자열을 UTC timestamp로 parse하지 않고, 연/월/일 field를 검증한 뒤 `Date.UTC` + `Intl.DateTimeFormat(..., { weekday: "long", timeZone: "UTC" })`로 표시한다.
- 따라서 `new Date("YYYY-MM-DD")` 같은 timezone-sensitive parsing을 도입하지 않는다.

## Tooltip UX / 접근성

- hover 또는 focus에서 동일 내용을 표시한다.
- 각 Day scale cell은 focus 가능하며 localized weekday를 항상 제공하고 named NON_WORKING일 때만 휴일명 line을 추가한다.
- 일반 토·일은 weekday만 표시한다.
- 토·일과 명명된 NON_WORKING date가 겹치면 이름은 숨기지 않는다.
- Tooltip은 `role="tooltip"`과 active cell의 `aria-describedby`를 연결한다.
- active cell의 `aria-label`에는 date key + weekday + 표시 이름을 포함한다.
- Escape로 Tooltip을 닫을 수 있다.
- overlay는 `position: fixed`, `pointer-events: none`이며 viewport gutter 안으로 보정해 Chart drag/scroll interaction과 layout을 변경하지 않는다.
- light theme semantic token을 재사용하고 새 UI framework/dependency를 추가하지 않는다.

## 테스트

### Unit

`tests/features/day-header-tooltip.test.ts`

- public scale CSS class ↔ date-only round-trip
- `ko-KR` weekday
- 일반 weekend vs named weekend
- 복수 이름 trim/deduplicate/deterministic order
- WORKING override 제외
- legacy `holidays[]` fallback

### Server

`tests/server/calendars/work-calendar-service.test.ts`

- 동일 Project/date/NON_WORKING의 복수 persisted 이름을 canonical snapshot `exceptions[].names`에 모두 보존
- 기존 single `name` projection과 effective dayType 유지

### Chromium E2E

`tests/e2e/project-gantt-scale.spec.ts`

- 일반 평일 hover
- 복수 named NON_WORKING hover
- 주말 + named holiday focus
- WORKING override 이름 미표시
- Day → Week에서 day tooltip target/overlay 제거
- 기존 숫자-only Header, ISO Week, weekend highlight, Gantt/API instance identity 회귀

로컬 저장소 clone은 현재 실행 환경에서 `github.com` DNS 해석이 되지 않아 Local Fast Feedback을 실행할 수 없다. 공식 판정은 PR의 `quality/e2e/docker` GitHub Actions 결과로 수행한다.

## 버전 / 릴리스

- Issue #314 stacked base: `0.57.1`
- Issue #315: 하위 호환 사용자 기능 추가이므로 `0.58.0` (MINOR)
- `release_required=true`
- 사용자 요청 범위는 PR CI 시작까지이므로 `release_authorized=false`
- 이번 단계에서 merge, tag, 정식 GHCR publish, lifecycle finalize는 수행하지 않는다.
