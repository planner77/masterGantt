# Issue #299 — Chart 영역 수직 Drag & Drop 작업 재정렬

## 기준

- 재정렬 기준 main: `da0f39a4dde363bd84ad2e938089c40d2dd9e29a`
- 기준 application version: `0.76.0`
- 구현 version: `0.77.0` (하위 호환 사용자 기능 추가)
- `@svar-ui/react-gantt`: `2.7.3`
- branch: `feat/issue-299-chart-vertical-dnd-reorder`
- release_required: `true`
- release_authorized: `false`

## 최신 main 재정렬 시 확인한 선행 변경

- #300: Grid native `move-task`를 protected hierarchy command에 연결해 canonical order를 영속화한다.
- #335: Dependency가 연결된 Task/Milestone도 **같은 parent의 sibling reorder**는 허용한다. cross-parent/reparent·Indent/Outdent 등은 기존 guard를 유지한다.
- #399: Summary subtree 범위 탭에서 hierarchy command가 현재 scope를 벗어나지 않아야 한다.
- #384: 다중 선택 pointer capture와 Copy/Paste UI가 ProjectGantt에 추가됐다.
- #367/#370: timeline 확장과 Grid 시작일 quick-edit pointer intent를 보존해야 한다.

#299는 위 계약을 덮어쓰지 않고 Chart 전용 수직 gesture bridge만 추가한다.

## SVAR 2.7.3 확인

SVAR 공개 API/소스에서 `drag-task` payload는 `top`을 수직 feedback으로 지원하고, `move-task`는 `before | after | child | up | down` 구조 이동을 지원한다. 다만 React Gantt 2.7.3의 Chart Bars 구현은 pointer 이동에서 X축(`left/width`)만 계산하며 Chart bar 자체의 vertical reorder를 제공하지 않는다.

따라서 package fork나 별도 Gantt renderer를 만들지 않고 ProjectGantt에 얇은 bridge를 둔다.

## 구현 계약

1. Chart bar mousedown을 capture 단계에서 관찰한다.
2. dead-zone을 지난 뒤 X/Y 변위를 비교해 horizontal/vertical 축을 한 번만 lock한다.
3. vertical로 lock되면 이후 mousemove를 window capture에서 차단하여 SVAR horizontal schedule drag가 같은 gesture에서 진행되지 않게 한다.
4. 공개 `drag-task(top)` action으로 수직 bar feedback을 유지한다.
5. 실제 DOM에 표시된 Chart bar만 drop target으로 사용한다.
6. source와 **같은 parent**의 가장 가까운 sibling만 `before/after` drop 대상으로 인정한다.
7. drop 확정 시 기존 `TaskHierarchyCommandRequest { kind: "reparent" }`를 한 번만 제출한다.
8. #399 scoped view에서는 `taskHierarchyCommandStaysInSubtree`를 통과해야 한다.
9. #335 정책에 따라 Dependency 연결 여부만으로 same-parent sibling reorder를 차단하지 않는다.
10. cross-parent implicit reparent는 #299에서 허용하지 않는다.

## UX / 실패 / 스크롤

- drop target bar의 위/아래에 indicator를 표시한다.
- Task resize handle 영역은 기존 좌우 resize가 우선한다.
- 긴 프로젝트에서는 기존 `.wx-gantt` vertical scroller를 edge-scroll한다.
- drop 시 local vertical feedback을 정리한 뒤 server canonical snapshot이 최종 순서를 확정한다.
- protected command 실패/412/network recovery는 Project Workspace의 기존 hierarchy mutation 복구 경로를 재사용한다.
- 정상/실패 모두 Gantt remount를 요구하지 않는다.

## 검증

### Unit
- vertical/horizontal/pending axis lock
- nearest visible row의 before/after
- 다른 parent nearest row 거부
- same-parent reparent command
- canonical no-op 차단

### Chromium E2E
- #300의 검증된 isolated seed helper로 A/B/C root sibling 구성
- 실제 Chart C bar를 B 앞으로 수직 pointer drag
- `POST /task-commands` 정확히 1회
- Task PATCH 0회
- response/Grid 순서 `A,C,B`
- drop indicator 제거
- Gantt/API instance 유지
- reload/GET 뒤 동일 순서 유지

## 과거 PR CI #1246 분석

최초 #299 PR head는 다음 두 문제로 실패했다.

- TypeScript: `taskIdFromElement()`의 `string | null`을 충분히 narrow하지 않아 typecheck/build/Docker가 연쇄 실패.
- Chromium: 전용 E2E가 UI 프로젝트 생성 helper에서 timeout되어 실제 Chart DnD 단계까지 도달하지 못함.

최신 main 재정렬 구현에서는 `taskId` null guard를 명시하고, 현재 main에서 이미 반복 검증 중인 #300 API seed/reorder helper를 재사용한다.

## 문서 영향

- API/DB schema 신규 추가 없음. 기존 `task-commands`, `parentExternalId/siblingOrder`, revision/transaction/canonical snapshot 계약 재사용.
- `DESIGN.md`의 SVAR-native/server-authoritative 원칙 변경 없음.
- UX/Task Editor/Scheduling/Test/Requirements/PRO matrix와 CHANGELOG를 현재 main 기준으로 동기화한다.
