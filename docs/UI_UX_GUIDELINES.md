# masterGantt UI/UX 공통 가이드

관련 Issue: #76, #85

이 문서는 Frontend와 UI/UX 설계의 공통 기준이다. 화면별 요구사항과 충돌하면 사용자 승인 요구사항과 해당 Issue의 acceptance criteria를 우선하고, 충돌 내용을 Manager가 기록한다.

## 1. 기본 원칙

### UX-01. 3단 계층
Global App Shell → Entity Context → Current Workspace View를 구분한다. 사이트 전역 navigation, 현재 Project/Resource의 context, 실제 Gantt/Data Grid 작업 영역의 정보와 action을 섞지 않는다.

### UX-02. Workspace 우선
Gantt, Data Grid, Dashboard 같은 생산성 화면은 장식이나 반복 설명보다 실제 작업공간에 viewport를 우선 배정한다.

### UX-03. Progressive Disclosure
항상 필요한 정보만 항상 표시한다. Description, Owner, Revision, 상세 설정처럼 필요할 때 확인하는 정보는 Popover/Drawer/Dialog/Settings 등 목적에 맞는 surface를 사용한다.

### UX-04. Status와 Action 분리
Status를 command button 사이에 배치하지 않는다. Status는 entity title 근처나 독립 상태 영역, 또는 상태와 직접 연결된 control에 표현한다.

### UX-05. Action hierarchy
한 영역의 Primary Action은 가능하면 하나로 제한한다. 관련 command는 Toolbar로 묶고 낮은 우선순위 action은 Overflow Menu를 검토한다. 파괴적 action은 명확히 구분한다.

### UX-06. Tabs는 Peer View에 사용
같은 context에서 일정/리소스처럼 독립적으로 소비하는 동급 view 전환에 Tabs를 사용한다. 동시 비교가 핵심이면 Split View/Drawer 등 다른 패턴을 검토한다.

### UX-07. 화면 유형별 Width
Form/문서는 constrained width, 목록/Data Table은 wide, Gantt/Dashboard/Workspace는 viewport 기반 wide/full을 기본 후보로 한다. 하나의 max-width를 모든 화면에 적용하지 않는다.

### UX-08. Spacing으로 hierarchy 표현
모든 section을 Card/Border로 감싸지 않는다. spacing, typography, alignment를 우선하고 border/background는 의미 있는 구분에 사용한다.

### UX-09. Semantic interaction
Navigation은 Link, command는 Button, view switching은 Tab, 관련 action 집합은 Toolbar/Menu를 기본으로 한다. 외형 통일을 위해 semantic 역할을 훼손하지 않는다.

### UX-10. Responsive + Accessibility
신규/재설계 UI는 최소 390/768/1024/1440px 관점과 keyboard, focus-visible, Escape, focus restore, document overflow를 검토한다. Dialog/Tabs/Menu 등은 해당 WAI-ARIA APG 패턴과 실제 사용 component의 접근성 계약을 확인한다.

### UX-11. UI 변경으로 Domain 계약을 바꾸지 않음
레이아웃 변경만으로 Project revision, If-Match, permission, canonical snapshot, Gantt lifecycle, Resource workload API 같은 domain/security 계약을 임의 변경하지 않는다.

### UX-12. 작업 상태 보존
Tab/Drawer/Modal/Editor 전환 때문에 Gantt scroll, tree open, column 상태, scale, selection 등 사용자의 작업 context를 불필요하게 초기화하지 않는다.

## 2. UI 변경 조사 순서

SVAR React Gantt와 관련된 기능은 구현 전에 목적과 가장 가까운 공식 sample/guide가 있는지 확인한다.

- Samples: https://docs.svar.dev/react/gantt/samples/#/base/willow
- Editor: https://docs.svar.dev/react/gantt/samples/#/editor/willow
- Context menu: https://docs.svar.dev/react/gantt/samples/#/context-menu/willow
- UI layout/editor guide: https://docs.svar.dev/react/gantt/guides/ui-layout/editor/

SVAR에 적합한 공개 Core API/pattern이 있으면 우선 사용한다. PRO 전용 기능의 비공개 구현을 추측해 복제하지 않는다. SVAR로 해결되지 않는 일반 UI는 shadcn/ui와 현재 프로젝트 pattern을 우선하고, 접근성은 WAI-ARIA APG 등 공식 기준을 확인한다.

## 3. 역할 분리

- `ui_ux`: 사용자 흐름, 정보 구조, interaction, 상태, 접근성, responsive acceptance criteria를 설계/검토한다. 기본 read-only다.
- `frontend`: 승인된 UX와 공개 component/API를 코드와 테스트로 구현한다.
- `qa_docs`: 요구사항·UX 기준·구현·테스트·문서 일치 여부를 독립 검증한다.
- `Manager`: 충돌과 trade-off를 결정하고 최종 ACCEPT/REWORK를 판단한다.

단순 국소 수정은 frontend가 이 문서를 직접 적용할 수 있다. 신규 화면, navigation/workspace/editor 재설계, 복수 화면 공통 pattern, 접근성/반응형 위험이 큰 변경은 Manager가 ui_ux를 우선 배정한다.

## 4. 검증 기준

자동화 가능한 interaction은 필요한 Vitest/Playwright로 회귀를 남긴다. GitHub Actions의 E2E PASS는 자동화한 계약의 근거이며 모든 시각적 품질/사용성을 증명하지 않는다. 실제 browser에서만 판단 가능한 viewport, overflow, focus 흐름, 시각적 hierarchy, 수동 사용성은 Environment-specific Validation으로 분리한다.

UI 변경 완료 보고에는 적용한 UX 원칙, 확인한 SVAR sample/guide, 자동화 검증 범위, 수동 검증 상태와 남은 위험을 구분한다.
