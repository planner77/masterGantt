# Issue #35 Gantt 표시 단위 전환

## 요구사항

- Gantt Chart는 최초 진입 시 기존과 동일하게 일 단위로 표시한다.
- 사용자는 Chart 상단의 `일`/`주` 버튼으로 시간축 표시 단위를 전환할 수 있다.
- 단위 전환은 일정 데이터, 선택 상태, 편집 권한과 무관한 표시 전용 상태이며 서버 저장을 발생시키지 않는다.
- 전환 때문에 SVAR Gantt 인스턴스를 재마운트하지 않는다.

## SVAR 근거와 설계

SVAR React Gantt의 `scales` 속성은 `day`, `week`, `month` 등의 시간 단위를 조합할 수 있고 formatter가 각 구간의 날짜를 받을 수 있다. 따라서 별도 Pro zoom API를 모사하지 않고 공개 `scales` 계약만 사용한다.

- 일 보기: 월 + 일 scale. 기존 주말 강조(`highlightTime`)를 유지한다.
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
- 일 보기의 주말 강조가 주 보기에서는 제거되고 다시 일 보기로 돌아오면 복원되는지 Chromium E2E로 확인한다.
- 기존 CI의 typecheck, lint, Vitest, build, 전체 Chromium E2E, Docker smoke를 통과해야 한다.

## 버전

- Issue #35의 최초 표시 단위 기능은 사용자 노출 신규 기능이므로 `0.8.3`에서 `0.9.0`으로 minor version을 증가시켰다.
- Issue #51은 기존 `주` 표시의 Header 포맷을 ISO Week로 바로잡는 호환 개선이므로 `0.11.0`에서 `0.11.1`로 patch version을 증가시킨다.
