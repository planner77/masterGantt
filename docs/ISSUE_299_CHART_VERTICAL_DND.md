# Issue #299 — Chart 영역 수직 Drag & Drop 작업 재정렬

## 기준

- 구현 기준 main: `74279aa4eccb27f513b3750ad238425567fea225`
- 기준 application version: `0.54.0`
- 구현 version: `0.55.0` (하위 호환 사용자 기능 추가)
- `@svar-ui/react-gantt`: `2.7.3`
- branch: `feat/issue-299-chart-vertical-dnd-reorder`
- release_required: `true` (제품 기능 변경)
- release_authorized: `false` (이번 요청 범위는 PR/CI 시작까지)

## 분석

Issue 본문은 SVAR `drag-task.top`을 Chart 수직 Drag signal로 재사용하는 방향을 제시한다. 공식 API와 공개 source를 함께 확인한 결과 Core Store는 `drag-task.top`과 `move-task`를 지원하지만, React Gantt 2.7.3의 Chart `Bars.jsx`는 pointer 이동에서 X축(`left`/`width`)만 계산한다. 수직 reorder gesture는 Grid 쪽에서만 `drag-task(top)` → `move-task`로 연결된다.

따라서 package fork나 별도 canvas DnD를 만들지 않고 Project Workspace에 얇은 Chart bridge를 둔다.

1. Chart bar pointer down을 capture 단계에서 관찰한다.
2. 작은 dead-zone 뒤 X/Y 이동량으로 gesture axis를 한 번만 lock한다.
3. vertical로 lock되면 SVAR Chart의 horizontal mousemove 전달을 중단하여 schedule PATCH와 hierarchy command가 한 gesture에서 중복되지 않게 한다.
4. 공개 `drag-task(top)` action으로 bar의 vertical feedback을 유지한다.
5. 현재 화면에 실제로 보이는 Chart bar만 drop target으로 사용한다.
6. source와 동일 parent인 target만 `before/after`로 허용한다. 다른 hierarchy level은 이번 범위에서 명시적으로 거부하여 drag가 의도하지 않은 reparent를 만들지 않는다.
7. drop 확정 시 기존 `TaskHierarchyCommandRequest { kind: "reparent" }`를 한 번만 전달한다.
8. 서버의 기존 `task-commands` transaction, revision, dependency/hierarchy invariant와 canonical snapshot recovery를 그대로 사용한다.

## 보안·동시성·계층 계약

- edit session + `editable && !mutationLocked`에서만 시작한다.
- inline editor가 열려 있으면 reorder하지 않는다.
- Dependency link가 있는 source 또는 anchor는 기존 Context Menu hierarchy 정책과 동일하게 차단한다.
- hidden/collapsed/filter-out row는 DOM target 집합에 없으므로 sibling target 계산에 사용하지 않는다.
- Milestone/Summary도 reorder할 수 있다. Task resize handle 영역은 기존 horizontal resize를 우선한다.
- cross-parent drop은 이번 구현에서 허용하지 않는다. 따라서 cycle/Milestone-parent/empty-Summary 규칙을 우회하는 새 경로가 생기지 않는다.
- 긴 프로젝트에서는 기존 `.wx-gantt` vertical scroll container를 edge-scroll하며 Grid/Chart의 공통 vertical viewport를 유지한다.
- 실패 시 Project 상위 mutation handler의 기존 canonical 재조회/rollback 계약을 사용한다. 정상/실패 모두 Gantt remount를 요구하지 않는다.

## 변경 범위

- `src/features/gantt/chart-vertical-dnd.ts`: axis 판별, visible-row drop 계산, canonical sibling no-op 판별
- `src/features/gantt/project-gantt.tsx`: Chart pointer bridge, public `drag-task(top)` feedback, protected hierarchy dispatch, edge scroll
- `src/features/gantt/gantt-scale-toolbar.css`: before/after drop indicator
- Unit + Chromium pointer E2E
- 관련 사용자/테스트/API/스케줄링 문서와 changelog

DB schema와 새 API endpoint는 필요하지 않다.

## 검증 계획

### Unit
- vertical/horizontal/pending axis lock
- nearest visible row의 before/after 판별
- hierarchy-level crossing 거부
- canonical sibling order no-op 차단
- `reparent` command mapping

### Chromium E2E
- 실제 Chart bar mouse pointer gesture로 Gamma를 Beta 앞으로 이동
- `task-commands` POST 1회
- Task PATCH 0회
- Grid 순서와 canonical snapshot 일치
- Gantt instance/API instance 유지
- reload 뒤 순서 유지

PR Actions에서 repository의 quality, Chromium E2E, Docker gate를 최종 검증 근거로 사용한다.

## 문서 영향

- `DESIGN.md`: 변경 없음. 기존 server-authoritative/canonical snapshot 원칙을 그대로 적용한다.
- `docs/API.md`: 기존 task-commands 재사용을 명시한다.
- `docs/DB_SCHEMA.md`: 변경 없음. `parentExternalId/siblingOrder` 기존 저장 계약 재사용.
- `docs/PROJECT_UX.md`, `TASK_EDITOR.md`, `SCHEDULING_ENGINE.md`, `TEST_PLAN.md`, `REQUIREMENTS.md`, `PRO_FEATURE_MATRIX.md`: 기능/검증 계약 동기화.
