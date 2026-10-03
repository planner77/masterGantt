# Issue #299 — Chart 영역 수직 Drag & Drop 작업 재정렬

## 기준

- 최종 재정렬 기준 main: `97bb041b9932a590512972b4a194065150a3bec7`
- 기준 application version: `0.76.1`
- 구현 version: `0.77.0`
- `@svar-ui/react-gantt`: `2.7.3`
- release_required: `true`
- release_authorized: `false`

## 최신 main 계약

- #300: Grid native `move-task`를 protected hierarchy command에 연결해 canonical order를 저장한다.
- #335: Dependency Link가 있어도 같은 parent의 sibling reorder는 허용한다.
- #399/#407: Summary subtree view와 scoped add/hierarchy guard를 유지한다.
- #384: 다중 선택 pointer capture를 유지한다.
- #367/#370: timeline 확장과 Grid 시작일 quick-edit pointer intent를 보존한다.

#299는 위 동작을 수정하지 않고 Chart bar에만 vertical reorder bridge를 추가한다.

## SVAR 2.7.3 경계

공개 `drag-task` action은 `top` 수직 feedback을 지원하고 `move-task`는 구조 이동을 지원하지만, React Gantt 2.7.3 Chart Bars는 pointer 이동에서 X축 `left/width`만 계산한다. 따라서 package fork 없이 application-owned bridge를 사용한다.

## 구현

1. Chart bar mousedown을 capture 단계에서 관찰한다.
2. dead-zone 뒤 X/Y 변위를 비교해 horizontal/vertical 축을 lock한다.
3. vertical lock 이후 mousemove는 window capture에서 차단하여 SVAR horizontal schedule drag와 중복 저장되지 않게 한다.
4. 공개 `drag-task(top)`으로 수직 feedback을 표시한다.
5. 실제 표시된 Chart bar만 drop 후보로 사용한다.
6. 같은 parent의 nearest sibling에만 `before/after`를 허용한다.
7. drop 시 기존 `reparent` hierarchy command를 정확히 한 번 제출한다.
8. #399/#407 subtree scope는 `taskHierarchyCommandStaysInSubtree`로 검증한다.
9. #335에 따라 linked same-parent reorder를 허용한다.
10. cross-parent implicit reparent는 허용하지 않는다.

## UX

- target bar의 위/아래에 drop indicator를 표시한다.
- Task resize handle 영역은 기존 horizontal resize가 우선한다.
- 긴 프로젝트에서는 기존 `.wx-gantt` vertical scroller를 edge-scroll한다.
- canonical response가 Grid/Chart의 최종 순서를 확정하며 Gantt remount를 요구하지 않는다.

## 검증

- Unit: axis lock, visible sibling before/after, cross-level 거부, no-op, reparent mapping.
- Chromium: #300 isolated API seed helper로 A/B/C를 만들고 C Chart bar를 B 앞으로 실제 mouse drag.
- `task-commands` POST 1회, Task PATCH 0회, response/Grid `A,C,B`, indicator 제거, Gantt/API instance 유지, reload persistence.

## 과거 CI 보완

- #1246 TypeScript 실패: nullable taskId를 명시적으로 narrow하도록 수정.
- #1246 E2E 실패: UI project-create timeout 대신 현재 main에서 검증된 #300 API seed helper를 재사용.
- 공용 CI trace는 PR 본문에 canonical `Refs #299`를 정확히 한 번 사용한다.
