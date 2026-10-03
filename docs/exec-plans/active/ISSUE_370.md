# Issue #370 Grid 시작일 Date Picker 실행 계획

## 현재 기준

- latest main 기준: `6015abe1bdf8c0cbfb7a47789051bebd69b9392f`
- application version 기준: `0.73.0`
- #370 목표 version: `0.74.0`
- 기존 #373/#378/#384/#390/#399 등 최신 Gantt selection·scoped view·copy·context interaction을 보존한다.
- API/DB/Scheduling Engine 의미는 변경하지 않는다.

## 구현 계약

1. Grid `projectStart`는 서버 canonical effective `start` 표시 전용 열로 유지한다.
2. 편집 가능한 Task/Milestone의 시작일 셀 single click은 기존 Grid row selection을 먼저 수행한 후 다음 event-loop tick에 masterGantt-owned `input[type=date]` overlay를 연다.
3. selection 때문에 SVAR row/cell DOM이 교체될 수 있으므로 timer 실행 시 taskId로 현재 `projectStart` cell을 다시 찾는다.
4. Summary/readonly/mutation lock에서는 Picker를 열지 않는다.
5. 선택 날짜는 기존 Task command gateway의 `{ start: YYYY-MM-DD }`로만 저장하고 server dependency/calendar recalculation 결과를 canonical snapshot으로 반영한다.
6. Enter/Space로 keyboard open, Escape/outside pointer/viewport resize로 close하며 원래 시작일 cell로 focus를 복원한다.
7. double-click은 pending quick-edit timer를 취소해 현재 main의 기존 Task Editor/other double-click 계약을 방해하지 않는다.

## CI 실패에서 확정된 경계

- #1435: getter-only custom Grid column에는 SVAR inline date editor가 생성되지 않아 application-owned overlay로 전환.
- #1438/#1442: Grid scroll/native date popup과 open/close 이벤트 경계를 분리.
- #1444/#1446: SVAR의 후속 cell focus와 Picker focus 경쟁을 확인.
- #1452: quick-edit가 native row selection을 차단하면 기존 fullscreen/stability/resource calendar 회귀가 발생하므로 selection을 보존하도록 변경.
- #1457: 당시 main 기준 전체 PR CI PASS.
- #1483: 최신 main 재정렬 후 전체 static/unit/build/docker와 Chromium 3개 shard, shard 2의 76건이 PASS했고 pointer-open input focus 1건만 실패.
- 2026-10-03 재정렬에서는 최신 main selection flow의 `handleSelectionClick`에 quick-edit scheduling을 직접 통합하고, timer 시 현재 cell을 taskId로 재해석한다.

## 검증

- Unit: `tests/features/gantt/grid-start-date-editor.test.ts`
- E2E: `tests/e2e/project-gantt-inline-start-date.spec.ts`
- 기존 전체 PR CI의 TypeScript/ESLint/Vitest/Next build/Docker/Chromium 4 shards를 새 exact head에서 다시 판정한다.
- 이전 CI PASS는 새 head의 최종 PASS로 전용하지 않는다.

## 이번 요청 종료점

최신 main 재정렬 → PR #374 head 갱신 → 새 PR CI가 시작되는 것까지다. 병합/Main CI/Release Finalizer는 새 PR CI 성공 후 진행한다.
