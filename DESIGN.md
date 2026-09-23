# masterGantt Design System

적용 기준: 2026-09-23.

이 문서는 masterGantt의 **제품 시각 언어와 화면 설계 방향의 Source of Truth**다. 세부 interaction·접근성·검증 규칙은 [docs/UI_UX_GUIDELINES.md](docs/UI_UX_GUIDELINES.md), 화면별 현재 계약은 [docs/PROJECT_UX.md](docs/PROJECT_UX.md)와 [docs/TASK_EDITOR.md](docs/TASK_EDITOR.md)를 함께 따른다.

## 1. Design Direction

공식 명칭:

> **masterGantt Design System — Linear-inspired Light Enterprise Workspace**

핵심 특성:

- **Light-first**: 장시간 일정·표·Gantt를 읽는 업무 화면에 적합한 밝은 기본 테마를 유지한다.
- **Workspace-first**: 장식보다 실제 작업 영역, 특히 Gantt/Grid의 가용 폭·높이를 우선한다.
- **Data-dense**: 프로젝트·작업·리소스·관계·필터를 한눈에 비교할 수 있도록 불필요한 여백과 반복 설명을 줄인다.
- **Flat surfaces**: 모든 구역을 카드로 감싸지 않고 spacing, typography, hairline divider, subtle surface 차이로 계층을 만든다.
- **Compact controls**: desktop에서는 업무 밀도를 유지하되 keyboard/focus/target size 접근성을 희생하지 않는다.
- **Progressive disclosure**: 설명·revision·상세 설정·보조 명령은 필요할 때 열어 보고, 핵심 상태와 주요 명령만 상시 표시한다.
- **Precise feedback**: loading/empty/readonly/editing/disabled/error/success/stale 상태를 일관된 semantic token과 텍스트로 구분한다.
- **SVAR-native interaction**: Gantt 내부 동작은 설치된 SVAR React Gantt Core의 공식 기능/API와 사용자 기대를 우선한다.

## 2. Reference Hierarchy

외부 제품의 CSS나 비공개 구현을 복제하지 않는다. 다음 순서로 **설계 언어와 interaction을 참고**한다.

| 우선 | Reference | masterGantt 적용 영역 |
| --- | --- | --- |
| Primary | Linear | 정보 밀도, compact toolbar, tab/view hierarchy, action prioritization, flat surface, precise hover/focus/selected state |
| Secondary | Airtable | Project List, table, search/filter builder, structured data workflow |
| Secondary | IBM Carbon | Enterprise form, dialog, status clarity, accessibility와 semantic state |
| Interaction authority | SVAR React Gantt 공식 demo/API | Gantt/Grid/Task Editor/Context Menu의 interaction 및 Core capability |

외부 reference와 저장소 계약이 충돌하면 다음 순서가 우선한다.

1. Security / domain / API / revision / canonical snapshot 계약
2. 이 `DESIGN.md`
3. `docs/UI_UX_GUIDELINES.md`
4. 화면별 현재 계약 문서
5. 외부 reference

## 3. Visual Foundation

### Color

현재 masterGantt의 파란색 업무 UI 정체성을 유지한다. Linear의 lavender/dark palette를 그대로 가져오지 않는다.

semantic 역할을 우선한다.

- canvas/background
- surface/card
- elevated/overlay surface
- primary action
- secondary action
- text / muted text
- border/divider
- focus ring
- selected/current
- disabled
- info/success/warning/error/danger

새 UI는 raw hex를 임의 추가하기보다 기존 또는 #120에서 정립하는 semantic token을 사용한다. 서로 다른 의미의 상태색을 단순히 하나로 합치지 않는다.

### Typography

새 웹폰트를 추가하지 않는다. 현재 system font stack과 한국어 가독성을 유지한다.

권장 계층:

- page/entity title: 20–28px 범위, 화면 밀도에 따라 제한
- section heading: 16–18px
- primary body/control: 14px 전후
- metadata/helper/table header: 12–13px
- 숫자·날짜·revision 등 비교 정보는 가능한 경우 tabular numeric 표현을 사용한다.

큰 제목과 설명이 작업공간을 밀어내지 않도록 한다.

### Spacing

기본 spacing scale:

`4 / 8 / 12 / 16 / 24 / 32px`

- label ↔ control: 4–6px
- 같은 의미의 field/control: 8–12px
- toolbar/control group: 8–12px
- section: 16–24px
- page context 간 큰 구분: 필요할 때만 24–32px

모든 화면에 동일한 간격을 기계적으로 적용하지 않고 정보 관계와 작업 밀도를 기준으로 한다.

### Radius and borders

- compact controls/menu/input: 대체로 6–8px
- panel/dialog/큰 surface: 대체로 8–12px
- hairline border/divider를 우선한다.
- shadow는 overlay/elevation 의미가 있을 때만 사용한다.
- 장식 목적의 과도한 card, shadow, gradient, pill 사용을 피한다.

#120이 실제 token 값을 정합화할 때 현재 CSS와 회귀를 기준으로 세부 값을 확정한다.

## 4. Layout Model

공통 계층:

```text
Global App Shell
  ↓
Entity Context
  ↓
Workspace View / Toolbar
  ↓
Primary Work Surface
```

### Global App Shell

- brand, Projects, Resources 등 전역 navigation과 global utility만 둔다.
- 화면별 작업 명령을 전역 header에 섞지 않는다.
- viewport 기반 gutter를 사용하며 업무 화면을 불필요한 중앙 max-width로 제한하지 않는다.

### Project List

- wide data workspace로 취급한다.
- 프로젝트명은 primary navigation target이다.
- owner/description/date/actions는 정보 중요도에 따라 시각 계층을 둔다.
- search/filter와 row action은 table 자체보다 우선해 공간을 차지하지 않는다.
- Airtable의 structured table/filter UX를 보조 reference로 사용한다.

### Project Workspace

- compact project context + schedule/resources peer tabs + workspace toolbar + Gantt/resource content 구조를 유지한다.
- 프로젝트명·편집 상태는 항상 식별 가능하게 하되 description/owner/revision은 progressive disclosure한다.
- mobile/tablet에서도 toolbar가 Gantt의 가시 높이를 과도하게 줄이지 않게 한다.
- view 전환으로 Gantt instance, scroll, tree, column, scale, selection을 불필요하게 초기화하지 않는다.

### Task Editor

- tab 기반 정보 구조를 유지한다.
- Task / Resource / Relation 정보의 semantic grouping을 명확히 한다.
- 입력은 content-aware width와 정렬을 사용하고 모든 필드를 동일한 1fr/100% 폭으로 만들지 않는다.
- 저장/취소/stale/readonly 등 상태와 action hierarchy를 일관되게 표현한다.
- form density 개선이 label, keyboard, error association을 약화시키지 않는다.

### Search / Filter

- quick search는 즉시 사용 가능해야 한다.
- advanced filter는 field/operator/value 의미가 분명해야 한다.
- 활성 조건 수, 결과 수, 초기화 가능 여부를 명시한다.
- compact toolbar를 우선하되 좁은 화면에서 명령이 숨겨져 사용할 수 없게 만들지 않는다.
- 동일 의미의 Task/Resource/Project filter가 서로 다른 시각 문법을 만들지 않는다.

## 5. Control and State Rules

| State | 원칙 |
| --- | --- |
| default | 주변 콘텐츠보다 과도하게 강조하지 않는다. |
| hover | 클릭 가능성을 보여 주되 layout shift를 만들지 않는다. |
| focus | 색상만이 아니라 명확한 focus ring/outline을 제공한다. |
| selected/current | primary accent + text/shape 차이를 함께 사용한다. |
| disabled | 실행 불가를 보이되 텍스트를 읽을 수 있어야 하며 필요한 경우 이유를 제공한다. |
| readonly/editing | 버튼 사이에 상태를 섞지 않고 독립적인 상태 표현을 사용한다. |
| error/danger | destructive action과 validation/error feedback을 구분한다. |
| loading/saving | 중복 mutation을 막고 현재 진행 중임을 텍스트로 알린다. |
| empty/no result | 실제 데이터 없음과 검색 결과 없음의 의미를 구분한다. |
| stale/conflict | 최신 상태 재조회/재시도 경로를 명확히 제공한다. |

## 6. Responsive and Accessibility

기본 검증 viewport:

- 390px
- 768px
- 1024px
- 1440px
- wide desktop

원칙:

- document-level unintended horizontal overflow를 만들지 않는다.
- Gantt/Grid 자체의 의도된 내부 scroll은 허용한다.
- 좁은 화면에서는 control을 무조건 `width:100%`로 쌓기보다 의미 단위로 wrap/group한다.
- keyboard/focus/Escape/focus restore와 accessible name을 보존한다.
- 색상만으로 상태를 표현하지 않는다.
- 긴 한국어/영문, 긴 Project/Task/Resource 명칭, empty/error/readonly/edit 상태를 함께 검증한다.
- 실제 browser/E2E 증거 없이 정적 CSS 검토만으로 UX PASS를 주장하지 않는다.

## 7. Implementation Rules

- 기존 React/CSS/shadcn/ui/SVAR Core를 우선하며 디자인만을 이유로 새 UI framework를 도입하지 않는다.
- UI 변경으로 domain/API/auth/session/revision/If-Match/canonical snapshot 계약을 바꾸지 않는다.
- SVAR 기능 설계 전 공식 sample/API와 설치 버전의 Core/PRO 차이를 확인한다.
- shared visual rule은 가능한 한 semantic token 또는 공통 primitive로 중앙화한다.
- 화면별 예외는 이유를 문서화한다.
- pixel-perfect 복제보다 정보 구조, 밀도, interaction, 상태 표현과 접근성 일관성을 우선한다.

## 8. UI Issue Workflow

UI/UX Issue를 시작할 때 최소 다음을 확인한다.

1. `DESIGN.md`
2. `docs/UI_UX_GUIDELINES.md`
3. 관련 화면 계약 문서
4. 관련 기존/후속 Issue
5. SVAR 영향이 있으면 공식 demo/API와 설치 버전

구현 전에는 current-state 문제, 목표 사용자 흐름, text wireframe 또는 layout 설명, state matrix, responsive/accessibility 기준을 남긴다.

구현 후에는 before/after browser evidence, keyboard/focus, overflow, relevant E2E와 동일 PR head의 원격 CI를 분리해 검증한다.

## 9. Rollout Strategy

기존 완료 UI를 한 번에 전면 재작성하지 않는다. 다음 순서로 점진 정합화한다.

1. **Project List**
2. **Project Workspace**
3. **Task Editor**
4. **Search / Filter**

각 단계는 완료된 #75/#76/#74/#96/#83/#84의 기능 계약을 유지한다. 공통 token/state 정합화는 #120을 선행 또는 각 단계의 공통 dependency로 취급한다. 현재 #122에서 추적 중인 P2/P3 이슈와 범위가 겹치면 중복 구현하지 않고 해당 이슈를 dependency 또는 선행 조건으로 연결한다.

## 10. Non-goals

- Linear/Airtable/Carbon UI의 직접 복제
- Linear Dark Theme 전환
- 새 UI framework 도입
- Gantt를 일반 dashboard/card UI로 감싸 정보 밀도를 낮추는 변경
- 디자인 정합화를 이유로 API/DB/scheduling/security 정책 변경
- 모든 기존 화면을 한 PR에서 일괄 restyle
