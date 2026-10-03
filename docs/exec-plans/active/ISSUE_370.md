# Issue #370 Grid 시작일 Date Picker 실행 계획

## 현재 기준

- latest main 기준: `5101a4a701dd7dbbeb3091696c0c670c667cb840`
- application version 기준: `0.74.0`
- #370 목표 version: `0.75.0`
- 최신 Gantt의 다중 선택, scoped view, Copy/Context Menu, timeline 확장, Task status/완료 취소선 계약을 모두 보존한다.
- API/DB/Scheduling Engine 의미는 변경하지 않는다.

## 구현 계약

1. Grid `projectStart`는 서버 canonical effective `start` 표시 전용 열로 유지한다.
2. 편집 가능한 Task/Milestone의 시작일 셀 single click은 기존 Grid row selection을 먼저 확정한 뒤 다음 event-loop tick에 application-owned `input[type=date]` overlay를 연다.
3. selection 처리로 SVAR row/cell DOM이 교체될 수 있으므로 timer 실행 시 taskId로 현재 `projectStart` cell을 다시 찾는다.
4. Summary/readonly/mutation lock에서는 Picker를 열지 않는다.
5. 선택 날짜는 기존 Task command gateway의 `{ start: YYYY-MM-DD }`로만 저장하고 server dependency/calendar recalculation 결과를 canonical snapshot으로 반영한다.
6. Enter/Space로 keyboard open, Escape/outside pointer/viewport resize로 close하며 원래 시작일 cell로 focus를 복원한다.
7. double-click은 pending quick-edit timer를 취소해 현재 main의 기존 double-click 계약을 방해하지 않는다.
8. Picker input은 autoFocus를 사용하고 Grid가 후속 focus를 되돌린 경우에만 한 차례 보정한다.

## CI 이력에서 확정된 경계

- #1435: getter-only custom Grid column에서는 SVAR inline date editor가 생성되지 않아 application-owned overlay로 전환.
- #1438/#1442: Grid scroll/native date popup과 open/close 이벤트 경계를 분리.
- #1444/#1446: SVAR의 후속 cell focus와 Picker focus 경쟁 확인.
- #1452: quick-edit가 native row selection을 차단하면 기존 fullscreen/stability/resource calendar 회귀 발생.
- #1457: 당시 main 기준 전체 PR CI PASS.
- #1483: 재정렬 후 static/unit/build/docker 및 Chromium 3개 shard, shard 2의 76건 PASS; pointer-open input focus 1건 실패.
- 2026-10-03 최신 구현은 현재 다중 선택 `handleSelectionClick` 흐름 안에서 selection 후 Picker를 예약하고 현재 cell을 재해석한다.

## 검증

- Unit: `tests/features/gantt/grid-start-date-editor.test.ts`
- E2E: `tests/e2e/project-gantt-inline-start-date.spec.ts`
- 새 exact head에서 TypeScript / ESLint / Vitest / Next build / Docker / Chromium 4 shards를 모두 다시 판정한다.
- 이전 CI 성공은 새 head의 최종 PASS로 전용하지 않는다.

## 이번 요청 종료점

최신 main 재정렬 → PR #374 head 갱신 → 새 PR CI 시작까지다. 병합/Main CI/Release Finalizer는 새 PR CI 성공 후 진행한다.
