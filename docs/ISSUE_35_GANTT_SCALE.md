# Issue #35 Gantt 표시 단위 전환

## 요구사항

- Gantt Chart는 최초 진입 시 기존과 동일하게 일 단위로 표시한다.
- 사용자는 Chart 상단의 `일`/`주` 버튼으로 시간축 표시 단위를 전환할 수 있다.
- 단위 전환은 일정 데이터, 선택 상태, 편집 권한과 무관한 표시 전용 상태이며 서버 저장을 발생시키지 않는다.
- 전환 때문에 SVAR Gantt 인스턴스를 재마운트하지 않는다.

## SVAR 근거와 설계

SVAR React Gantt의 `scales` 속성은 `day`, `week`, `month` 등의 시간 단위를 조합할 수 있고 formatter가 각 구간의 날짜를 받을 수 있다. 따라서 별도 Pro zoom API를 모사하지 않고 공개 `scales` 계약만 사용한다.

- 일 보기: 월 + 일 scale. 기존 주말 강조(`highlightTime`)를 유지한다.
- Issue #314 이후 일 scale 하위 Header는 locale 요일/접미사 없이 day-of-month 숫자(`1`~`31`)만 표시한다. 공개 `scales[].format` formatter를 사용하며 cellWidth와 Gantt instance identity는 변경하지 않는다.
- 주 보기: 월 + 주 scale. Issue #51 이후 하위 scale은 ISO 8601 주차를 `W01`~`W53` 형식으로 표시한다.
- ISO week 계산은 월요일 시작, 첫 목요일(동등하게 1월 4일 포함 주)을 Week 1로 하는 규칙을 따른다.
- SVAR formatter의 브라우저 로컬 `Date`에서 달력 연/월/일을 읽고 UTC 계산 값으로 정규화하여 DST와 실행 환경 timezone offset이 week number를 바꾸지 않도록 한다.
- 상태는 `ProjectGantt` 내부의 `day | week` 표시 전용 state로 관리한다.
- DOM 후처리, `key` 변경이나 강제 재마운트를 사용하지 않아 기존 Gantt/API instance identity를 유지한다.
- 버튼 그룹은 `role=group`, `aria-label`, `aria-pressed`를 사용해 키보드·보조기술에서 현재 단위를 식별할 수 있게 한다.

## 검증 기준

- 기본 단위가 `day`인지 확인한다.
- `주` 전환 후 `week` 상태와 버튼 접근성 상태가 일치하는지 확인한다.
- `주` Header가 `W38`, `W39` 등 ISO Week 형식을 표시하고 `9/14–9/20` 같은 날짜 범위를 표시하지 않는지 Chromium E2E에서 확인한다.
- 같은 ISO 주, 월 경계, `W52 → W01`, `W53 → W01` 연말·연초 경계를 Vitest로 확인한다.
- 전환 전후 `data-project-gantt-instance`, `data-project-gantt-api-instance`가 동일한지 확인한다.
- 일 보기의 Header가 `1`~`31` 숫자만 표시하고 `일` 접미사·요일·괄호가 없으며, Day → Week → Day 전환 뒤에도 숫자-only 형식이 복원되는지 확인한다.
- 일 보기의 주말 강조가 주 보기에서는 제거되고 다시 일 보기로 돌아오면 복원되는지 Chromium E2E로 확인한다.
- 기존 CI의 typecheck, lint, Vitest, build, 전체 Chromium E2E, Docker smoke를 통과해야 한다.

## 버전

- Issue #35의 최초 표시 단위 기능은 사용자 노출 신규 기능이므로 `0.8.3`에서 `0.9.0`으로 minor version을 증가시켰다.
- Issue #51은 기존 `주` 표시의 Header 포맷을 ISO Week로 바로잡는 호환 개선이므로 `0.11.0`에서 `0.11.1`로 patch version을 증가시킨다.
- Issue #314는 기존 `일` 표시의 Header 문자열만 compact하게 변경하는 호환 개선이므로 `0.58.0`에서 `0.58.1`로 patch version을 증가시킨다.

## Issue #315 Day Header Tooltip

Issue #314의 숫자-only Day Header는 그대로 유지하고 상세 정보는 hover/focus Tooltip으로 progressive disclosure 한다. Day scale은 SVAR 공개 `scales[].css(date)`로 masterGantt-owned `project-gantt-day-date-YYYYMMDD` class를 부여한다. Tooltip 날짜 lookup은 이 class만 사용하며 SVAR 내부 Header DOM 구조에서 날짜를 역추론하지 않는다.

Tooltip은 locale weekday를 항상 표시하고 Effective Project Calendar의 named `NON_WORKING` date에만 canonical name 목록을 추가한다. 일반 weekend는 요일만 표시하며 `WORKING` override 이름은 휴일로 표시하지 않는다. Week scale에서는 해당 class와 Tooltip 동작을 적용하지 않는다. 상세 계약은 [Issue #315 설계](ISSUE_315_DAY_HEADER_TOOLTIP.md)를 따른다.


## Issue #316 Week Header Tooltip

Issue #315의 Day Header Tooltip에서 검증한 public scale CSS class/date parser와 hover/focus overlay lifecycle을 Week scale에도 적용한다. Week Header 본문은 기존 ISO `W01~W53`을 유지한다. SVAR Week `css(date)`가 실제 runtime에서 ISO 주의 Sunday anchor를 전달하므로 이를 ISO Monday로 정규화한 뒤 `project-gantt-week-date-YYYYMMDD` app-owned class의 날짜 key로 사용한다.

Tooltip의 근무일 수는 기존 Scheduling `createWorkingCalendar` + `workingDaysBetween`으로 계산한다. 명명된 `NON_WORKING` 날짜는 #315의 `projectHolidayNamesForDate` projection을 재사용해 날짜와 모든 canonical 이름을 표시하고, 이름 없는 휴일은 계산에만 반영한다. `WORKING` override는 실제 근무일 수에 반영하되 공휴일명으로 표시하지 않는다.

Hover/focus, `aria-describedby`, Escape, scroll/resize 재배치, viewport edge clamp 및 Day↔Week 전환 시 overlay 정리는 #315와 같은 interaction 계약을 따른다. Gantt/API instance와 기존 68px Week cell width는 유지한다. 상세 계약은 [Issue #316 설계](ISSUE_316_WEEK_HEADER_TOOLTIP.md)를 따른다.


## Issue #416 Week Header 근무 가능 일수 상시 표시

#316의 Week Header Tooltip 계산 결과를 상시 요약에도 재사용한다. 기존 `scales[].format(date)`은 계속 ISO `W01~W53` 문자열만 반환하고, Week `cellWidth=68`도 유지한다. #316의 공개 `scales[].css(date)`가 부여하는 app-owned ISO Monday date class와 MutationObserver lifecycle에서 같은 `GanttWeekHeaderTooltipData.workingDays`를 읽어 `N일` secondary label을 cell 내부에 추가·갱신한다.

secondary label은 화면상 요약만 담당하므로 `aria-hidden`으로 두며, 접근 가능한 상세 설명은 기존 cell `aria-label`과 hover/focus Tooltip 계약을 유지한다. 요일별 위치/공휴일명/사유는 Header에 중복 노출하지 않는다. Header 폭·scale height를 늘리거나 `Wxx` 문자열을 DOM text replacement로 바꾸지 않고, private SVAR API 또는 별도 Calendar 계산을 추가하지 않는다.

## Issue #367 Day 밀도 추가 개선과 우측 Timeline 동적 확장

Issue #233의 Day `cellWidth=44` 계약을 #314의 숫자-only Header에 맞춰 **36px**로 추가 축소한다. Week는 ISO Week 및 #316 Tooltip 가독성을 위해 68px를 유지한다.

SVAR React 2.7.3은 React `start/end` prop 변경 시 `dataStore.init(storeConfig)`를 다시 실행한다. 따라서 scroll 때마다 `end` prop을 바꾸는 방식은 selection/column/filter 등 mounted view state에 영향을 줄 수 있어 사용하지 않는다. 대신 **고정 `start` + 미지정 `end` + `autoScale=false`**로 두고, 공개 `resize-chart` action의 내부 `expandScale()` 경로를 사용한다. 이 경로는 start가 고정되고 end가 열려 있을 때 `_end`만 확장하며 `_scaleDate`를 기준으로 현재 horizontal scroll을 보존한다.

우측 접근 판정은 공개 `scroll-chart.left`, `resize-chart.width`와 `api.getState()`의 현재 scale width를 사용한다. 남은 폭이 viewport의 1/4 또는 최소 threshold 이하가 되면 최소 한 viewport 분량(또는 Day 14 cell / Week 4 cell)의 scale 폭을 public `resize-chart`로 확장한 뒤 실제 viewport 폭을 즉시 복원한다. 합성 resize 동안 재진입을 막고 같은 frame의 이벤트는 `requestAnimationFrame`으로 합친다.

사용자가 탐색해 확보한 미래 end는 app ref로 단조 증가시킨다. canonical Task sync나 Day/Week 전환이 Core의 flexible end를 다시 계산해 더 짧게 만들면 같은 public resize path로 이전 end 이상을 복구한다. React `end` prop을 변경하지 않으므로 이 확장 자체가 SVAR store re-init을 유발하지 않는다.

Chromium은 native `scrollTo()`로 실제 React `onScroll` → SVAR `scroll-chart` 경로를 발생시켜 3회 연속 미래 확장, 동일 Gantt/API instance, non-zero scroll, mutation 0회를 검증한다. 기존 #373 scoped `filter-tasks`, 다중 selection/column/tree 상태가 range extension 때문에 초기화되지 않는지도 전체 E2E에서 회귀 검증한다.
