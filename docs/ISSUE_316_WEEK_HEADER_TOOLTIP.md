# Issue #316 — Gantt Week Header 근무일·공휴일 Tooltip

상태: 최신 `main@acd5fe45` 기준 재정렬. 최종 PASS/FAIL은 동일 PR head의 GitHub Actions로 판정한다.

## 목적과 범위

Project Workspace의 Gantt가 **주(week) 표시 단위**일 때 기존 ISO Week `W01~W53` Header를 유지하면서, Header hover/focus에서 해당 주의 Project Calendar 정보를 확인할 수 있게 한다.

- Project Calendar 기준 실제 근무일 수를 `근무일: N일`로 표시한다.
- 해당 주의 이름 있는 `NON_WORKING` 날짜는 날짜와 모든 canonical 표시 이름을 제공한다.
- 이름 없는 `NON_WORKING` 날짜는 근무일 수에는 반영하지만 임의 휴일명을 만들지 않는다.
- `WORKING` override는 실제 근무일 수에는 반영하지만 공휴일명으로 표시하지 않는다.
- Resource/Resource Group Calendar, 일정 계산 저장, API/DB schema는 변경하지 않는다.

## 구현 근거

- `DESIGN.md`, `docs/UI_UX_GUIDELINES.md`
- Issue #315 Day Header Tooltip의 scale CSS class/date parser + hover/focus/MutationObserver/viewport-safe overlay 패턴
- Issue #51 ISO Week Header
- SVAR React Gantt 2.7.3 공개 `scales` API: https://docs.svar.dev/react/gantt/api/properties/scales/

CI #1418 trace에서 Week `css(date)` callback은 실제 화면 `W38`에 `2026-09-20`(Sunday anchor)을 전달하는 것을 확인했다. 따라서 callback date를 ISO Monday로 정규화한 뒤 class key와 Tooltip 시작일로 사용한다.

## Calendar 계산

- `createWorkingCalendar` + `workingDaysBetween`을 재사용한다.
- Sunday anchor → ISO Monday 정규화 후 Monday + 6일까지 실제 7일 구간을 계산한다.
- 휴일명은 #315의 `projectHolidayNamesForDate`를 재사용하여 `exceptions[].names` 우선, legacy `holidays[]` fallback, trim/deduplicate/deterministic order 계약을 유지한다.
- `WORKING` 이름은 공휴일명으로 표시하지 않는다.
- W53→W01 연도 경계를 date-only 계산으로 처리한다.

## Tooltip UX / 접근성

- hover와 keyboard/programmatic focus에서 동일 정보를 제공한다.
- Week scale cell은 focus 가능하며 `aria-label`과 `aria-describedby`를 제공한다.
- Escape로 닫을 수 있다.
- resize/scroll에서 live cell 기준 위치를 재계산하고 viewport gutter 안으로 보정한다.
- Day↔Week 전환 시 반대 scale Tooltip/target을 제거한다.
- `position: fixed`, `pointer-events: none` overlay로 Gantt layout/drag/scroll을 변경하지 않는다.
- Gantt/API instance identity를 유지하며 hover/focus로 서버 API를 호출하지 않는다.

## 테스트

- Unit: Sunday anchor→ISO Monday, 일반 주 5일, 복수/이름 없는 NON_WORKING, weekend WORKING, legacy holidays, W53→W01.
- Chromium: W38 일반 주 hover, W39 공휴일 주 focus, 실제 근무일 수/복수 이름, WORKING 이름 제외, 접근성 연결, viewport edge clamp, Day Tooltip/ISO Wxx/44·68px/Gantt identity 회귀.
- CI #1426은 이전 main 기준으로 quality/e2e/docker 전체 PASS했다. 최신 main 재정렬 후 새 PR CI로 다시 판정한다.

## 버전 / 릴리스

- 최신 main: `0.64.0`
- Issue #316: 하위 호환 사용자 기능 추가 → `0.65.0` (MINOR)
- `release_required=true`, `release_authorized=false`
- 현재 범위는 최신 main 정렬 후 PR CI 시작까지이며 merge/main CI/GHCR/finalize는 수행하지 않는다.


## 후속 Issue #416

#416은 이 문서의 Project Calendar 계산과 `GanttWeekHeaderTooltipData.workingDays`를 새로 계산하지 않고 그대로 재사용해 Week Header에 `N일`을 상시 표시한다. 기존 ISO `Wxx`, 68px 폭, hover/focus Tooltip의 공휴일 상세와 접근성 계약은 유지한다. 어느 요일이 근무일인지와 비근무 사유는 상시 Header에 추가하지 않는다.

현재 Day 폭은 후속 #367에서 36px로 축소되었지만 Week 폭은 계속 68px이며 #416도 이 값을 변경하지 않는다.
