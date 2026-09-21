# UI/UX Guidelines

이 문서는 masterGantt Frontend 작업의 공통 UI/UX Source of Truth다. Issue #76에서 제정했으며 Project List, Task Editor, Resource 화면 등 이후 UI 변경도 충돌하지 않는 범위에서 이 기준을 적용한다.

## 1. 정보 계층

### UX-01. Global App Shell → Entity Context → Workspace View

- **Global App Shell**: product identity, primary navigation, global utility만 배치한다.
- **Entity Context**: 현재 Project/Resource 등 사용자가 작업 중인 entity의 이름, status, 핵심 command를 배치한다.
- **Workspace View**: Gantt, Resource workload, Table, Dashboard처럼 실제 업무 화면을 배치한다.
- 세 계층의 metadata, status, command를 서로 섞지 않는다.

### UX-02. Workspace 우선

생산성 화면은 설명·장식보다 작업공간에 viewport를 우선 배정한다. Form/문서는 constrained width, 목록/Data Table은 wide, Gantt/Dashboard/Workspace는 viewport 기반 wide/full을 기본값으로 한다.

### UX-03. Progressive Disclosure

항상 필요한 정보만 항상 표시한다. Description, Owner, Revision, 상세 설정처럼 빈도가 낮은 정보는 Popover/Drawer/Dialog/Settings로 이동하되 조회 가능성은 유지한다.

## 2. Status와 Action

### UX-04. Status와 Action 분리

Status badge를 command button 사이에 두지 않는다. Status는 entity title 근처 또는 독립 status 영역에 표시하고 색상만으로 상태를 전달하지 않는다.

### UX-05. Action hierarchy

한 영역의 primary action은 가능하면 하나로 제한한다. 자주 사용하는 1~2개 command만 직접 노출하고 나머지는 Toolbar/Overflow Menu로 묶는다. destructive/state-changing command는 일반 조회 action과 시각적·구조적으로 분리한다.

### UX-06. Semantic interaction

- Navigation → Link
- Command → Button
- Peer view switching → Tab
- Related commands → Toolbar/Menu

시각적 통일을 위해 semantic 역할을 바꾸지 않는다.

## 3. Tabs와 화면 상태

### UX-07. Tabs는 같은 Context의 Peer View에 사용

일정/리소스처럼 같은 Project Context에 속하지만 독립적으로 소비하는 주요 view는 Tabs를 사용한다. 동시 비교가 필요하면 별도의 Split View/Drawer 요구사항으로 다룬다.

### UX-08. Workspace state 보존

Tab/Drawer/Modal 전환만으로 Gantt scroll, tree open state, column width/visibility, scale, selection과 같은 사용자 작업 상태를 불필요하게 초기화하지 않는다. UI 전환은 canonical reload/mutation의 이유가 아니다.

## 4. Layout와 Spacing

### UX-09. Spacing으로 hierarchy 표현

모든 section을 Card/Border로 감싸지 않는다. typography, spacing, alignment를 먼저 사용하고 border/background는 경계가 실제로 필요한 곳에 제한한다.

### UX-10. Width 정책을 화면 유형에 맞춤

하나의 max-width를 모든 화면에 적용하지 않는다. Global header와 workspace gutter의 기준선을 일관되게 유지하되 wide monitor에서 생산성 화면을 불필요하게 중앙에 가두지 않는다.

## 5. Responsive / Accessibility

### UX-11. 기본 검증 viewport

신규 Frontend 기능은 최소 390 / 768 / 1024 / 1440px / wide desktop에서 확인한다. 좁은 화면에서는 낮은 우선순위 action을 overflow로 이동하고 unintended document-level horizontal overflow를 만들지 않는다. Gantt 자체의 internal horizontal scroll은 별도 계약으로 유지한다.

### UX-12. Keyboard와 Focus

- focus-visible을 제공한다.
- Dialog/Drawer/Menu는 Escape와 focus restore를 지원한다.
- icon-only control은 accessible name을 가진다.
- WAI-ARIA Tabs Pattern의 tablist/tab/tabpanel, selected state, roving tabIndex, Arrow/Home/End navigation을 적용한다.
- hover-only interaction을 만들지 않는다.

## 6. Domain/API 경계

### UX-13. UI 변경으로 Domain 계약을 바꾸지 않음

레이아웃 재설계만으로 Project revision, If-Match, edit-session permission, canonical snapshot, Scheduling Engine, Resource workload API/calculation, Gantt mutation lifecycle을 변경하지 않는다. 계약 변경이 필요하면 별도 요구사항과 설계 검토를 거친다.

## 7. Frontend Issue/PR Checklist

- [ ] Global / Context / View 계층이 올바른가?
- [ ] 화면 유형에 맞는 width 정책인가?
- [ ] 항상 표시할 정보인가, progressive disclosure 대상인가?
- [ ] Status와 Action이 섞이지 않았는가?
- [ ] Action hierarchy가 명확한가?
- [ ] Link/Button/Tab/Menu semantic 역할이 올바른가?
- [ ] 390/768/1024/1440/wide viewport를 검증했는가?
- [ ] keyboard/focus/Escape/focus restore를 검증했는가?
- [ ] document overflow와 component internal scroll 경계를 검증했는가?
- [ ] UI 전환으로 사용자 작업 상태를 불필요하게 잃지 않는가?
- [ ] UI 변경 때문에 Domain/API/Gantt lifecycle을 불필요하게 변경하지 않았는가?

## 참고

- Carbon Design System — UI Shell Header / Tabs
- Fluent 2 — Layout / Toolbar
- WAI-ARIA Authoring Practices — Tabs Pattern
- SVAR React Gantt — UI Layout / Samples

외부 디자인 시스템은 구조와 접근성 원칙의 참고 자료이며 masterGantt의 Domain/API 권위를 대체하지 않는다.
