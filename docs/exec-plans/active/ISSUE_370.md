# Issue #370 Grid 시작일 Date Picker 실행 계획

## 현재 기준

- latest main 기준: `fa57ba77fd632fa530ca2c27091a072536a67172`
- application version 기준: `0.75.0`
- #370 목표 version: `0.76.0`
- 최신 #335 linked-subtree sibling reorder, #399 Workspace 범위 탭, #384 다중 선택/복사, #367 timeline 확장, #303 Task status 계약을 보존한다.
- API/DB/Scheduling Engine 의미는 변경하지 않는다.

## 구현 계약

1. Grid `projectStart`는 서버 canonical effective `start` 표시 전용 열로 유지한다.
2. 편집 가능한 Task/Milestone의 시작일 셀 single click은 기존 Grid row selection을 먼저 확정한 뒤 다음 event-loop tick에 application-owned `input[type=date]` overlay를 연다.
3. pointerdown 시 start-cell taskId/좌표/cell intent를 보존하고, SVAR가 DOM을 교체해도 click 이동 거리 4px 이내면 동일 single-click으로 복원한다.
4. timer 실행 시 taskId로 현재 `projectStart` cell을 다시 찾아 Picker를 연다.
5. Summary/readonly/mutation lock에서는 Picker를 열지 않는다.
6. 선택 날짜는 기존 Task command gateway의 `{ start: YYYY-MM-DD }`로 저장하고 server dependency/calendar recalculation 결과를 canonical snapshot으로 반영한다.
7. Enter/Space keyboard open, Escape/outside pointer/resize close, close 후 원래 cell focus 복원을 제공한다.
8. Picker open 중 SVAR가 Gantt 내부로 focus를 되돌리면 date input으로 microtask 복원한다.
9. double-click은 pending quick-edit timer를 취소해 기존 Task Editor/double-click 계약을 방해하지 않는다.

## 충돌 해결

- latest main의 #335는 `taskSubtreeHasDependencyLinks`를 사용해 linked subtree의 Cut/Delete 보호와 same-parent Move 허용을 구분한다.
- #370 재정렬은 해당 import, shortcut subtree guard, menu subtree guard, Move trigger capability를 그대로 보존한다.
- 문서는 latest main 내용을 유지하고 #370 section만 병합한다.
- application version은 `0.75.0 → 0.76.0`으로 올린다.

## 검증

- Unit: `tests/features/gantt/grid-start-date-editor.test.ts`
- E2E: `tests/e2e/project-gantt-inline-start-date.spec.ts`
- exact head에서 TypeScript / ESLint / Vitest / Next build / Docker / Chromium 4 shards를 모두 다시 판정한다.
- 이전 CI PASS는 새 head의 최종 PASS로 전용하지 않는다.

## 이번 요청 종료점

최신 main 정렬 및 충돌 해결 → PR #374 head 갱신 → 새 PR CI 시작 확인까지다.
