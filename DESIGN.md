# masterGantt Design System

적용 기준: 2026-09-23.

최종 구체화: 2026-10-27, [대시보드·관리 화면 재점검 #824](https://github.com/planner77/masterGantt/issues/824). 아래 목표 기준의 문서 반영은 제품 적용 완료를 뜻하지 않는다. 실제 관측과 미검증 범위는 [재점검 기록](docs/UI_UX_REAUDIT_2026_10_27.md)을 따른다.

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
- **Scope-relative command semantics**: 동일한 native action은 현재 WBS scope의 사용자 의미와 canonical hierarchy를 함께 반영하는 단일 resolver로 해석한다. 표시된 enabled/disabled 상태, pointer/keyboard target, 실제 서버 command가 서로 다른 의미를 가져서는 안 되며 scope 변경을 Gantt remount나 임시 client state로 해결하지 않는다.

### 1.2 Product Terminology (Issue #495)

- 프로젝트 일정의 확인 지점인 엔터티는 모든 사용자 화면, 검색·필터, Editor, Dashboard, 도움말, 오류 및 접근성 이름에서 **Milestone**이라고 표기한다. 같은 엔터티를 `완료 단계`, `마일스톤`, `Stage Gate`로 별도 명명하지 않는다.
- Milestone의 `Ready`(완료 가능 판정)와 `Completed`(명시 완료 상태)는 다르다. 일반 Task의 완료 상태, 구현·배포·CI 단계, Gantt 계층 깊이는 별개의 의미다.
- 내부 `stageGate` DTO/guard, API 경로, DB 스키마 및 JSON·Excel의 기존 고정 key/header는 호환성 계약이다. 표시 용어만을 이유로 변경하지 않으며 외부 형식 변경은 별도 versioning 검토를 요구한다.
- `Milestone` 표기의 길이가 Grid/Table/Popover의 geometry·접근성·keyboard/focus 계약을 깨지 않아야 한다. 구체 동작은 UI_UX_GUIDELINES와 화면별 Source of Truth를 따른다.

### 1.3 사용자에게 보이는 식별 정보 계층: 이름 우선·코드/ID 보조 (Issue #717)

여러 화면에서 같은 엔터티를 보여 줄 때 **사람이 읽고 판단하는 이름을 primary identity**, 기술 코드·외부 ID·내부 UUID를 **secondary/on-demand metadata**로 취급한다. 이 원칙은 프로젝트·Milestone·Task·리소스·공정·설비·시스템·기준정보의 목록, 표, 선택 후보, 검색 결과, KPI drill 및 상세 진입점에 공통 적용한다.

- **이름 우선(Name-first):** 표의 첫 식별 열, 행 제목, 선택 항목과 탐색 결과는 이름을 먼저 읽고 선택할 수 있어야 한다. 코드/ID가 이름보다 앞에 오거나 모든 행에 긴 식별자를 상시 병기하여 주요 작업 영역을 차지하지 않는다.
- **필요할 때만 식별자(Identifier-on-demand):** 일반 탐색에서는 코드·ID를 숨기는 것이 기본이다. 운영상 함께 볼 필요가 있는 짧은 업무 코드는 이름 뒤에 보조 typography로 간결하게 표시할 수 있다. 긴 코드·UUID 원문은 상세·관리·명시적 복사 등 요청 시 확인 가능하게 하며, 잘린 표시 문자열을 실제 선택/복사 ID로 쓰지 않는다.
- **정확한 대상 구분:** 같은 이름이 여러 개인 경우 우선 상위 경로·공정/구역·날짜/상태 등 **사용자 의미의 맥락**으로 구분한다. 그래도 불충분하거나 연결·수정·삭제 대상의 안전한 식별에 필요하면 코드/ID를 보조 정보 또는 확인 단계에 명시한다. 코드가 업무의 필수 식별자인 관리자·외부 연동·매핑·감사 화면은 근거가 있는 예외로 다룬다.
- **표시와 데이터 식별의 분리:** 이름을 보여 주더라도 React key, 선택·관계·저장·검색·링크 및 권한 판단에는 기존 canonical ID를 사용한다. 코드/ID 검색·복사, API/DB/DTO, JSON·Excel 교환 형식과 revision/보안 계약은 표시 단순화를 이유로 변경하지 않는다.
- **접근성과 가독성:** 말줄임·숨김으로 식별자를 유일하게 확인할 수 있는 수단이 hover-only tooltip이 되어서는 안 된다. 필요한 원문은 keyboard·focus·touch에서도 접근 가능하도록 하고, 동일 이름·긴 이름/코드·좁은 화면에서 선택 오류나 표/대화상자 overflow가 없도록 [UI/UX 가이드](docs/UI_UX_GUIDELINES.md) 및 화면별 계약에 따라 검증한다.

예: 공정 관리의 첫 식별 정보는 **공정명**이며, 긴 공정 코드는 필요 시 이름 뒤의 보조 표시/상세 조회로 제공한다. Milestone·작업 목록은 이름·상태·일정이 기본이며 외부 ID·작업 ID의 반복 노출을 지양한다.

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

### 내부 참조: 프로젝트 물류 KPI (Issue #449)

프로젝트 → 대시보드 → KPI는 의미별 구획, 수평 필터 묶음, 가용 폭에 따른 grid, 숫자·단위 정렬과 상태색의 내부 참조다. 이 정보 구조를 해당 업무에 맞게 적용하며 모든 화면을 KPI 카드로 감싸거나 raw fallback 색상·미정의 token을 복사하지 않는다. Gantt/Grid 작업 면적과 기존 semantic token·도메인 계산을 우선한다.

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

반복 조회 대시보드는 탭 → 현재 조건 → 요약 → 본문의 계층을 사용한다. 탭에서 이미 식별되는 화면명을 큰 제목으로 다시 선언하지 않는다. 조회 경로·검색 라벨·보조 설명은 13px 전후, 본문·표는 14px 전후, 필요한 section heading은 16px를 기준으로 한다. 같은 역할의 상단 동적 조회와 하단 대시보드가 서로 다른 기본 글꼴을 상속하지 않도록 호스트가 크기·line-height를 소유한다. semantic heading level은 유지하며 KPI 숫자·단위의 강조는 일반 본문·action label 크기와 별도로 결정한다.

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

### 프로젝트 작업면의 폭과 context 소유권 (Issue #824)

- 대시보드와 프로젝트 기준정보의 작업 폭·좌우 gutter는 상위 Project Workspace가 소유한다. 하위에 삽입한 물류·조회 컴포넌트는 그 가용 폭을 사용하며 독립 페이지용 `1440px` 중앙 제한이나 중복 gutter를 다시 적용하지 않는다. 전체 폭은 viewport 끝까지 붙인다는 뜻이 아니라 상위 gutter를 제외한 작업 폭이다.
- 선택 탭 아래에는 해당 화면의 조건·주요 데이터가 이어진다. `물류 구성 / Gantt WBS와 독립`처럼 여러 탭에 반복되는 구현·도메인 관계 설명은 상시 헤더로 쌓지 않고 기존 상황형 도움말로 제공한다. 현재 읽기 전용/편집 상태는 식별 가능하게 유지하고 권한·오류·stale·집계 범위에 필요한 안내는 해당 명령이나 결과 옆에 둔다.
- 제목/도구/본문과 서로 다른 업무 구획은 작은 heading, 관계에 맞는 간격, hairline divider 또는 subtle surface로 구분한다. Milestone의 선택 작업 계층 조회와 전체 Gate·관리처럼 모집단이 다른 구획은 범위를 각각 명시하며 시각 정돈을 위해 합치지 않는다.
- 가용 폭과 실제 내용 폭, 좌우 gutter 및 첫 데이터 위치를 같은 viewport에서 비교한다. 폭을 넓힐 때 표의 column budget도 재산정하며 고정 metadata만 늘리거나 문서 전체에 가로 스크롤을 만들지 않는다. 전역 관리자 shell과 인증 폼의 명시적 제한은 다음 절의 별도 계약이다.

### 공통 관리자 페이지와 인증 폼 (Issue #452)

`/resources`, `/logistics-admin`, `/project-master-admin`은 동일 레벨의 관리 workspace로 같은 page gutter·compact top spacing·heading scale을 사용한다. 로그인 전후 page shell은 같으며 설명 줄 수에 따른 자연 높이 차이를 고정 높이로 숨기지 않는다. 인증 form만 내용 제한 폭을 적용하고 관리 목록의 작업 면적은 별도로 확보한다.

관리 page는 desktop 최대 100rem, 좌우 gutter 24px(640px 이하 16px), top 20px/bottom 40px, heading 24px와 heading→content gap 16px를 소유한다. 공통 presentation은 최대 `32.5rem` 인증 panel, 16px padding, 12px gap과 명시적인 입력 경계·배경·높이·padding을 소유한다. desktop에서는 label 아래 password input과 제출 버튼의 bottom alignment 및 40px control-size를 맞춘다. 같은 행의 top/height 차이는 1 CSS px 이하여야 하며 좁은 화면은 input 다음 submit 순서로 쌓는다. 세 관리자 영역의 비밀번호·세션·API·권한은 공유하지 않는다.

Global Resource 카탈로그와 프로젝트의 리소스 분석/참여관리는 서로 다른 소비자다. 하나의 정돈을 다른 화면의 완료 근거로 쓰지 않는다. 전역 관리자 목록은 인증 폼의 제한 폭을 상속하지 않으며 본문·표 14px 전후, 보조 정보 12–13px, section heading 16px와 기존 40px 제어를 비교 기준으로 사용한다. 등록·검색·상태·목록·구성원/관계 편집의 필요한 구획을 유지하면서 불필요한 중첩 panel과 상속 글꼴 차이를 줄인다. 인증 후 populated·장문·오류 상태를 실제 확인한 뒤 문제 구역만 변경한다. 인증 전 화면이 양호하다는 이유로 관리 목록을 PASS로 판정하지 않는다.

button primitive의 기본 외부 margin은 0이며 간격과 위치는 toolbar/form/footer/독립 CTA의 부모가 소유한다. `.text-link`의 문맥별 간격, KPI 카드의 `margin-top:auto`와 Task Editor의 기존 44px hit-area는 별도 의미를 유지한다. 전역 `button { margin:0!important }`나 화면별 무차별 상쇄 대신 실제 소비자의 의도 간격을 이관한다. [구현·검증 계획](docs/exec-plans/active/ISSUE_452.md)을 따른다.

### Project List

- wide data workspace로 취급한다.
- 프로젝트명은 primary navigation target이다.
- owner/description/date/actions는 정보 중요도에 따라 시각 계층을 둔다.
- search/filter와 row action은 table 자체보다 우선해 공간을 차지하지 않는다.
- Airtable의 structured table/filter UX를 보조 reference로 사용한다.

### Data Table Column Sizing

Project List와 관리 화면처럼 열이 많은 data table은 **column budget을 명시적으로 설계**한다.

- 열을 모두 percentage width로 합계 100%까지 채운 뒤 action 등 fixed-width 열을 추가하지 않는다.
- 열을 `fixed / minimum / flexible` 역할로 구분하고, 날짜·상태·코드·action처럼 `nowrap`이 필요한 metadata는 실제 표시 문자열의 intrinsic width와 padding을 포함한 최소 폭을 확보한다.
- Project/Description처럼 가변 텍스트가 있는 열이 남는 폭을 우선 흡수하고, metadata 열은 인접 셀을 침범하지 않게 한다.
- 열 추가·삭제·label 변경·locale/date format 변경 시 기존 width를 그대로 두지 말고 **전체 column budget을 다시 계산**한다.
- viewport가 부족하면 cell overlap이나 document-level overflow로 버티지 않고 table container가 소유하는 horizontal scroll을 사용한다.
- header/body의 열 경계, 긴 문자열, locale/timezone 기반 날짜/시간, 390/768/1024/1440/wide desktop을 실제 browser에서 확인한다.
- 정적 CSS 값만으로 충분하다고 판단하지 않고 E2E 또는 browser geometry evidence로 sibling cell 침범 여부를 검증한다.

### Data-dense Management Screen Geometry

Table이 아닌 Resource/Admin list·card·pane도 **명시적 geometry budget**을 가진다.

- 정보량이 다른 sibling pane을 기계적으로 `1fr / 1fr`로 나누지 않는다. 각 pane의 minimum/intrinsic requirement를 먼저 정의하고 primary workspace가 더 많은 metadata·편집 control을 가지면 더 큰 flexible budget을 배정한다.
- 관리 row는 `identity / profile(metadata·capability) / lifecycle·destructive action`처럼 의미 단위로 나누고 fixed/minimum/flexible 역할을 정한다. `minmax(0, 1fr) + auto`의 auto 영역이 primary identity를 한두 글자 폭으로 collapse시키는 구조를 허용하지 않는다.
- profile field는 서로 근접 배치하고 lifecycle/destructive action은 spacing, divider 또는 별도 action group으로 구분한다.
- inline editable control 수가 안정적으로 들어가지 않으면 무한 wrap으로 버티지 말고 popover/dialog/detail row 같은 progressive disclosure를 우선 검토한다.
- search/filter/create toolbar와 실제 list workspace는 서로 다른 layout responsibility다. toolbar 또는 create form의 intrinsic width가 list usable width를 소유하거나 침범하지 않게 한다.
- footer에서는 secondary navigation/cancel과 primary commit action의 우선순위·위치를 화면 계약으로 명시하고 전역 button margin 때문에 footer geometry가 변하지 않게 한다.
- 필드/role/action 추가 시 기존 CSS를 그대로 재사용하지 말고 pane/row budget을 다시 계산한다. 390/768/1024/1440/wide desktop과 긴 문자열·최대 control 조합을 실제 browser geometry로 검증한다.

### 동등한 목록과 행 밀도 (Issue #449)

- 동시 비교가 필요 없는 동등한 목록은 활성 목록이 가용 작업 폭을 쓰는 peer tab을 우선 검토한다. 동시 비교가 필요한 pane은 기존 content-aware budget을 유지한다. 탭 전환으로 각 목록의 search/filter/scroll·초안·keyboard/focus를 잃지 않게 한다.
- 목록은 비교용 정보를 우선하며 모든 행에 표시값과 편집기를 중복 상시 노출하지 않는다. 생성·프로필·구성원 편집은 필요한 시점에 열 수 있게 하고 기존 권한·저장·복귀 계약을 보존한다.
- row height는 content/control과 내부 padding으로 결정한다. action margin·중복 heading·불필요한 section 여백을 먼저 줄이고 고정 height나 clipping으로 장문·오류·focus를 잘라 밀도를 맞추지 않는다. 높이·버튼 폭의 예외는 화면 계약과 실제 측정 근거를 남긴다. 관리자 40px control과 Task Editor 44px hit-area를 하나의 전역 크기로 강제하지 않는다.

### Project Workspace

- compact project context + `일정 / Issue / 대시보드 / 기준정보` 상위 peer tabs + workspace toolbar + 업무 작업면 구조를 유지한다.
- 대시보드 하위는 `KPI / Milestone / 공정&WorkArea / 설비 / 물류 시스템 / 리소스`, 기준정보 하위는 `공정&WorkArea / 설비 / 물류 시스템 / 리소스` 순서다. 일정은 전체 WBS가 기본이며 열린 Summary 범위 탭과 명시적인 `전체 일정 보기` 명령을 제공한다. 중복 `전체 프로젝트` 하위 탭은 두지 않는다.
- 관리와 분석을 탐색에서 구분한다. 기준정보는 원본 등록·수정, 대시보드는 조회·정확한 원본 편집으로 이동하는 경로다. 같은 엔터티의 ID/API/editor를 재사용하며 조회용 계층을 저장 WBS로 만들거나 기준정보·Task·Assignment를 복제하지 않는다.
- WBS Task가 중심 원장이다. 공정·WorkArea·설비·시스템은 같은 작업을 읽는 관점이며 기준정보 트리를 별도 일정으로 만들지 않는다. 공정의 WorkArea0..N과 설비의 다중 WorkArea0..N을 구분하고, Task의 명시 공정0..N은 구성 관계에서 자동 채우지 않는다. 구역 미연결·공정 미선택은 정상 상태이며 가짜 기본 항목을 생성하지 않는다. 설비가 여러 구역과 관련돼도 원본 수량은 고유 설비 기준으로 유지한다.
- Logistics Target은 사용자 도메인에서 폐기한다(#785). 별도 목록·생성·연결·필터·출처·진단·Excel 축을 제공하지 않는다. 기존 자료는 실제 공정/WorkArea/설비/System과 원본 Task·Assignment의 출처로 조회하며 동적 whole/subset·coverage·상속을 보존하는 내부 호환 해석을 사용한다. 이를 직접 관계로 자동 평탄화하거나 숨은 그룹으로 새로 저장하지 않는다. 기존 전역 관리자 권한과 Project 편집 권한은 분리한다.
- 일반 탭/조회 복귀는 사용자의 명시적인 전체 scope 선택과 다르다. 검색·기간·접힘·선택·focus 및 scope별 상태를 보존하며 숨은 panel을 키보드·보조기술에서 차단한다. Gantt 측정·복원은 기존 lifecycle과 단일 Coordinator를 사용한다.
- 프로젝트명·편집 상태는 항상 식별 가능하게 하되 description/owner/revision은 progressive disclosure한다.
- mobile/tablet에서도 toolbar가 Gantt의 가시 높이를 과도하게 줄이지 않게 한다.
- view 전환으로 Gantt instance, scroll, tree, column, scale, selection을 불필요하게 초기화하지 않는다.

### 동적 조회 구조와 WBS 원본 (Issue #730)

대시보드의 Milestone·공정&WorkArea·설비·물류 시스템·리소스는 해당 관점의 root를 고정하고, 사용자가 하위 축을 추가·삭제·재정렬하거나 하위 없는 요약으로 조회한다. 구성 preset은 수정 가능한 시작점이며 실제 업무 계층을 강제하는 분류가 아니다. 조회 구성·정렬·접힘을 변경해 WBS parent, Task, Assignment, Target 또는 기준정보를 생성·재배치하지 않는다.

다른 부모 아래 설비와 물류 시스템을 함께 배치할 때는 같은 깊이의 typed 형제 분기를 사용한다. 이를 설비→시스템의 실제 종속 관계로 표시하지 않는다. 설비 root 자체는 고정 관점이므로 `설비 → 공정 → 물류 시스템 → 리소스`, `설비 → Milestone → 공정`처럼 서로 다른 하위 경로를 허용한다. 실제 구성 membership·controls/coordinates와 같은 Task를 공유하는 업무 연관을 구별한다.

같은 원본이 여러 WorkArea·공정·Milestone 경로에 나타나도 원본 ID는 하나이며 경로별 행 ID만 다르다. 상위 고유 총계는 서버의 Task/Assignment 합집합 값이고 중첩 소계의 합이 아니다. 구성 수량·등록 인원·관련 Task·개인 Assignment·계획공수·Milestone 전체 Gate의 단위를 분리한다. 등록-only·미연결·미배정은 삭제나 오류로 간주하지 않는다.

조회 설정은 Project와 관점별 개인 브라우저 상태로 관리하고 업무 revision·다른 사용자의 설정과 분리한다. 구성기와 표는 기존 compact control·이름 우선·상황형 도움말·표 소유 scroll을 사용한다. 출발 관점의 조건·snapshot·펼침·선택·스크롤·focus를 정확한 원본 편집과 조회 복귀에서도 보존하고, stale 원본에서 상세나 이동을 실행하지 않는다. 세부 검증·저장·복구 계약은 [UI/UX 가이드](docs/UI_UX_GUIDELINES.md)와 [Project UX](docs/PROJECT_UX.md)를 따른다.

### 화면 확장 시 밀도·식별·정보 계층 상속 (Issue #819)

새 peer·하위 분석·상세 화면은 호스트의 제어 크기·글꼴·설명 노출·이름 우선·상태 계층을 상속한다. 기능을 추가할 때 컴포넌트의 `font:inherit` 또는 포인터 구분 없는 `min-height:44px`로 이미 확정된 밀도를 되돌리지 않는다. 공통 제어 기준은 한 곳에서 소유하고 해당 소비자의 회귀 검증을 함께 확장한다.

- **반복 조회 대시보드 제어:** fine pointer의 compact 기준은 36px 높이, 13px label/20px line-height와 수평 10px padding이다. 버튼은 내용 폭과 padding으로 결정하고 내용은 수직·수평 중앙 정렬한다. Native select처럼 플랫폼이 line-height를 소유하는 제어는 appearance/조작을 바꾸지 않고 실제 높이·font·행 정렬로 동일성을 검증한다. coarse pointer는 최소 44px 조작 영역을 유지한다. 긴 값·오류를 고정 높이나 clipping으로 숨기지 않으며 icon-only는 접근 가능한 이름과 폭·높이를 보장한다. 첫 적용 범위는 프로젝트 리소스 6peer다. 다른 기존 대시보드의 명시적인 44px, 관리자 40px·Task Editor 44px 계약은 해당 소비자의 별도 교정·검증 전까지 유지하며 전역에서 일괄 변경하지 않는다.
- **정렬과 typography:** 같은 control 행의 input/select/button은 top·bottom 차이 1 CSS px 이내를 목표로 하고 부모가 gap·정렬을 소유한다. 의미 없는 stretch·최소 폭이나 라벨보다 과도한 padding을 추가하지 않는다. action label은 주변 본문보다 크게 만들지 않는다. 주요 KPI 숫자 강조는 수치·단위의 별도 typography이며 그 안의 버튼 라벨까지 커지는 근거가 아니다.
- **정보 구획:** 조건·현재 범위 → 핵심 KPI → 주요 데이터 → 보조 진단·Export 순서로 읽히게 한다. 작은 section heading, 관계에 맞는 간격, hairline divider와 subtle semantic surface로 구분하고 모든 구역을 카드로 감싸지 않는다. 숫자는 단위와 함께 비교 가능하게 강조하며 정상 0·미설정·부분값·경고의 의미를 구별한다.
- **설명과 기술 정보:** 반복 사용법은 명명된 도움말로, snapshot/revision/내부 ID는 접힌 상세·진단·복사로 제공한다. 기본 행에서는 이름과 사용자 의미의 맥락을 우선한다. canonical ID·검색·정확한 원본 탐색·복사 데이터는 바꾸지 않는다. 현재 범위·분모·단위·비가산/부분값·권한·stale와 같은 판단 필수 정보는 짧은 인접 문구로 유지한다.
- **재발 검증:** 같은 fixture·source·환경의 전체 peer와 390/768/1024/1440/1920px에서 control bounds·라벨 크기·첫 데이터 위치·겹침·문서/표 소유 overflow를 비교한다. coarse target, 긴/동일 이름, 원문 상세의 keyboard/touch 접근, 도움말 Escape/focus 복귀와 기존 필터·선택·snapshot/오류 상태도 직접 검증한다. 새 하위 화면 추가 시 호스트의 밀도/식별 검증을 적용하고 과거 screenshot·CSS 선언만으로 PASS하지 않는다.

이 기준은 #807/#736에서 리소스 제어에 일괄 적용했던 fine-pointer 44px를 #819의 pointer별 계약으로 교정한다. 적용 화면과 실제 검증은 [리소스 화면 계약](docs/PROJECT_UX.md) 및 [UI/UX 가이드](docs/UI_UX_GUIDELINES.md)를 따른다.

#824 후속에서는 같은 반복 조회 제어의 목표를 KPI·Milestone·공정&WorkArea·설비·물류 시스템에도 적용한다. fine pointer는 36px 제어·13px 도구 라벨, coarse pointer는 최소 44px 조작 영역을 사용한다. 이는 #825~#827의 소비자별 구현·검증 대상이며 위의 기존 44px 소비자가 이미 교정됐다는 선언이 아니다. 관리자 40px·Task Editor 44px 및 native checkbox/radio의 별도 의미·label target은 유지한다. 프로젝트 기준정보의 목록 검색·관리 제어는 40px, 편집 dialog는 별도 44px 계약을 적용하고 대시보드 반복 조회의 36px 검색과 구분한다. 소비자별 before/after와 coarse target은 별도로 검증하며 전역 축소하지 않는다.

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

넓은 화면의 quick search는 **보이는 label과 input을 같은 행**에 두고 주변 조건·결과 수·명령과 정렬한다. label 연결과 accessible name을 보존하며 placeholder만으로 대체하지 않는다. 좁은 폭·긴 라벨에서는 의미 단위로 wrap하고 필요한 경우 label 위 배치를 허용한다. 인증·복합 등록 폼의 label 위 배치는 별도 계약이다.

KPI 기간·기준일·집계 범위 도구의 배경 높이는 실제 제어와 줄 수, 6–8px 전후의 세로 padding으로 결정한다. 빈 최소 높이·stretch·중첩 surface padding으로 도구 영역을 늘리지 않는다. 필요한 기간/기준일·단위·모집단·활성 조건·오류 설명은 짧은 인접 문구로 남기며 높이를 줄이려고 잘라내지 않는다. 동일 행 input/select/button의 top·bottom 차이는 1 CSS px 이내를 목표로 한다.

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

### 입력 컨트롤 식별성 (Issue #449)

input/select/textarea는 CSS reset 이후에도 정상 상태의 경계·배경·내부 padding·높이·font와 focus/error/disabled/readonly 상태가 식별되어야 한다. label과 오류 연결을 유지하며 placeholder·DOM 존재·fill 성공만으로 식별성을 판정하지 않는다. native radio/checkbox는 브라우저 표현과 연결 label·접근 가능한 target을 검증하며 text input의 border/크기를 일괄 강제하지 않는다. 세부 computed-style·키보드 검증은 [공통 UI/UX 가이드](docs/UI_UX_GUIDELINES.md)와 [회귀 coverage](docs/ISSUE_457_UI_UX_COVERAGE.md)를 따른다.

### 설명 밀도 및 상황형 도움말 정책 (Issue #715)

Milestone 대시보드, Resource·물류 구성 Workspace, 리소스·물류 유형·기준정보 관리 등 **반복 조회·편집형 화면에서 설명을 별도 상시 영역으로 쌓지 않는다.** 정보 전달 자체를 줄이기보다 사용자에게 **언제, 어디서 필요한가**를 기준으로 노출 수준을 정한다. 이는 기존 Workspace-first·Data-dense·Progressive disclosure를 여러 화면에 일관 적용하기 위한 영속 UI 정책이다.

- **기본 화면:** 화면·현재 범위/선택·주요 KPI와 단위·유효 상태·핵심 작업 명령을 우선한다. 제목을 반복하거나 일반적인 사용 방법을 설명하는 고정 문단/배너가 Primary Work Surface를 밀어내게 하지 않는다. 기본 접힘 도움말이 빈 자리나 고정 높이를 예약하지 않는다.
- **보조·학습 정보:** 필드 의미, 관계 규칙, 사용 방법, 상세 계산 기준처럼 즉시 읽지 않아도 작업 가능한 설명은 해당 헤더·지표·필드 옆의 명명된 도움말 진입점(tooltip/popover/상세 보기)으로 필요할 때 제공한다. **Hover만으로 제공하지 않고 keyboard focus·click/touch·보조기술로 접근 가능**하게 한다.
- **의사결정에 필수인 맥락:** 선택 범위와 전체 기준의 차이, 지표 분모·단위, 집계 불가·미산정/부분합, 권한·삭제 영향·데이터 손실 등 **숨기면 오해하거나 되돌리기 어려운 정보는** 짧은 인접 라벨·상태/경고·행위 직전 확인으로 명확히 남긴다. 필수 근거를 접근 불가능한 tooltip 하나에만 숨기지 않는다.
- **상황형 피드백:** 단순 성공·비차단 결과는 임시 상태 알림/Toast, 사용자가 즉시 수정할 입력 오류는 해당 필드, 지속적인 오류·stale·401/412 등은 원인과 복구 경로가 남는 상태 영역, 삭제·파괴적 변경이나 명시적 결정이 필요한 경우는 확인 Dialog를 사용한다. 일반 오류마다 차단 Modal을 남발하지 않고 실패를 성공/빈 결과처럼 표시하지 않는다.
- **회귀 기준:** 설명을 옮겨도 실제 기능/도메인/API·권한·revision·canonical snapshot 계약과 기존 조회/편집 상태를 바꾸지 않는다. 동일 조건 before/after에서 설명 점유 높이·업무 내용의 시작 위치·가시성, 390/768/1024/1440/wide 폭, keyboard/Escape/focus·touch·접근성·오류 복구를 증거로 확인한다. 실제 실행 전에는 PASS로 표기하지 않는다.

상세 진입·닫기·피드백·상태/검증 규칙은 [공통 UI/UX 가이드](docs/UI_UX_GUIDELINES.md#설명도움말피드백-노출-기준-issue-715)를 따른다. 이번 영속 원칙은 [#715](https://github.com/planner77/masterGantt/issues/715)의 **제품 구현 완료**를 뜻하지 않으며 각 화면의 실제 개편은 별도 구현·검증·병합 Gate를 통과해야 한다.

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

엔터티 이름·코드·ID의 표시를 신설·변경할 때는 **§1.3 이름 우선·코드/ID 보조 원칙**과 예외의 업무상 필요성을 함께 검토한다.

### UI/UX Skill 기반 Design Delta와 조건부 원칙 승격 (Issue #589)

UI/UX 관련 Skill을 **실제로 사용**해 화면을 설계·구현·검토했다면, DOCUMENTATION_SYNC에서 Skill의 제안 중 **프로젝트가 실제 채택한 지침**을 기존 설계·계약과 비교한다. Skill 사용 자체는 의무가 아니며 재사용 가능한 제안이라고 자동 채택하거나 기존 계약을 덮어쓰지 않는다.

| 판정 | 기준 | 문서 처리 |
| --- | --- | --- |
| **A. 신규 공통 원칙** | 기존 `DESIGN.md`에 없고, 정보 구조·시각 계층·배치·상태·탐색·상호작용 방향에 여러 화면/공통 컴포넌트에 걸쳐 지속 적용되며, 프로젝트가 실제 채택함 | **같은 구현 PR에서 `DESIGN.md` 갱신**. 적절한 기존 절에 원칙·의도·적용 대상·예외를 간결하게 통합하고 필요한 상세 가이드를 연결 |
| **B. 기존 원칙의 구체화** | 상위 방향은 이미 이 문서에 있으며, 세부 interaction·keyboard/focus·반응형·접근성·검증 또는 화면별 계약만 새로 확정 | 중복된 전역 원칙을 추가하지 않고 `docs/UI_UX_GUIDELINES.md` 또는 해당 화면 계약만 필요에 따라 갱신. `DESIGN.md: N/A` |
| **C. 국소적 수정** | 한 화면의 padding·버튼 폭·아이콘 위치·일회성 CSS 보정·개별 버그 해결처럼 공통 원칙이 아님 | `DESIGN.md` 수정 없음. 필요한 경우 Issue/PR·컴포넌트·테스트에만 기록하고 `DESIGN.md: N/A` |
| **D. 충돌·미확정** | Skill 권고가 기존 DESIGN 또는 더 우선하는 보안·도메인·API·revision·canonical snapshot·SVAR 계약과 충돌하거나 범위/채택 여부가 미확정 | 자동 승격·무단 덮어쓰기 금지. Manager가 근거/대안을 검토하고 별도 의사결정·필요 승인 전에는 원칙 변경 보류 |

예시: 여러 화면에 채택한 **새 탐색·상태 표시 방향**은 A, 기존 compact controls에 따른 **툴바 간격 조정**은 C, 특정 Dialog의 **Escape/focus 복원 세칙**은 B(하위 가이드/화면 문서), 보안·SVAR Core 계약에 반하는 Skill 권고는 D다. 제안이 여러 곳에 적용 가능하다는 이유만으로 A가 되지 않는다.

`ui_ux`는 read-only로 제안과 기존 원칙 간 차이·근거를 제공하고, `frontend`는 승인된 UI/test 변경을 구현한다. **Manager 또는 지정된 문서 작성자**가 원칙 채택 여부와 `DESIGN.md` 변경의 최종 책임을 진다. A라면 PR에 채택 이유, 영향 화면/공통 컴포넌트, 하위 문서 연결을 설명한다. A가 없다면 **구현 PR에 반드시** `DESIGN.md: N/A — 기존 원칙 구체화 / 국소 변경`처럼 짧은 판정 사유를 남기고, 필요하면 최종 보고에도 반복한다. 기존 Source of Truth 우선순위, read-only 역할, DOCUMENTATION_SYNC 및 QA/CI/release gate는 그대로 유지한다.

구현 전에는 current-state 문제, 목표 사용자 흐름, text wireframe 또는 layout 설명, state matrix, responsive/accessibility 기준을 남긴다.

구현 후에는 before/after browser evidence, keyboard/focus, overflow, relevant E2E와 동일 PR head의 원격 CI를 분리해 검증한다.

공통 CSS/primitive 변경은 양호한 기존 화면도 포함한 소비자 목록을 작성하고 같은 fixture·viewport·실제 환경에서 screenshot과 geometry를 비교한다. 사용자 관찰·source 사실·분리 CSS 실험·실제 앱 조작·E2E·원격 CI·독립 QA를 구분하며 한 증거를 다른 단계의 PASS로 확대하지 않는다. 실제 native 125% zoom과 DPR/deviceScaleFactor는 다른 검증이다. 미실행 환경은 사유와 담당 후속을 남긴다. #449의 역사적 감사와 현재 이관은 [감사 기록](docs/ISSUE_449_UI_UX_AUDIT.md), 화면별 검증 범위와 예외는 [회귀 coverage](docs/ISSUE_457_UI_UX_COVERAGE.md)를 따른다.

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

## Milestone Timeline 표시 분리 (#549)

[Milestone Timeline](docs/MILESTONE_TIMELINE.md)의 MT1은 WBS 작업 행과 프로젝트 전체 날짜 모집단, 작업 필터와 별도 표시 환경설정을 분리한다. 기본 ON 설정과 가시 member 강조는 canonical 일정·전체 Gate 계산·권한·Export를 바꾸지 않는다. 현재 Milestone 행/빠른 보기는 유지하며 후속 lane/표시 전환은 기술 gate 이후다. 기존 파란 Light UI, system font와 semantic token, flat/compact 배치로 Grid/Chart 작업 면적을 유지한다.


## Milestone WBS 표시 우선·선택적 상단 마커 (#548 / 2026-10-15)

[Milestone Presentation Policy](docs/MILESTONE_PRESENTATION_POLICY.md)의 현행 수용 목표는 **Gantt native Grid/Chart에서 Milestone 행·Bar를 제외하고 Stage Gate/Task 취합·Roll-up을 기존 Milestone Dashboard에서 관리하는 marker-OFF 기준선**이다. 앞 절 #549의 '기본 ON'은 당시 계획/순수 모델 값이며 이번 별도 제품 활성화의 기본값이 아니다. 기본 화면은 Summary/일반 Task에 공간을 우선 배정하며 'Milestone 표시'와 Milestone 소속 Task 필터를 같은 조작으로 혼합하지 않는다.

Milestone 관리·날짜·소속 Task 탐색은 Gantt marker 없이도 항상 접근 가능해야 한다. 사용자가 marker OFF 상태에서 '해당 날짜에서 보기'를 요청하면 숨은 native 행이나 일시 marker 활성화에 의존하지 않고 기존 Dashboard·Task로 명시적으로 안내한다. 표시 전환은 원본 Stage Gate, 일정, Link, Resource/Target 집계, 권한·Export를 바꾸지 않는다.

추후 상단 Timeline marker는 [#693](https://github.com/planner77/masterGantt/issues/693)의 **선택적인 별도 단계**로만 활성화하며 처음에는 OFF여야 한다. #573의 접근성/390px/날짜축 gate 및 실제 rollback 검증 전 기본 ON으로 출시하지 않는다. 같은 화면에 native Milestone 행과 marker를 중복 노출하지 않는다. 기존 token/flat density/keyboard/focus 원칙은 유지하고 새 시각 테마를 만들지 않는다.


### Project Issue peer workspace — Issues #838–#840 (2026-10-28)

Project Workspace 상위 peer 탭은 **일정 / Issue / 대시보드 / 기준정보** 순서를 따른다. Issue는 Task 일정·Milestone·기준정보의 새 하위 탭이 아닌 독립 Project Issue 조회/편집 화면이다. 탭 전환은 기존 SVAR Gantt instance·viewport·scale·selection·dirty 상태를 재생성/변경하지 않는다. 직접 URL screen=issue 복귀·focus·aria-controls/tabpanel·키보드 ArrowRight/Left/Home/End를 제공한다.

Issue는 **compact toolbar(전체 완료 KPI + 등록) → 검색 조건(문구/완료 상태) → 목록 → 하단 pagination** 순서로 배치한다. 완료 N / 전체 M (%)는 페이지/검색과 무관하게 전체 프로젝트 분모. 목록은 Issue명/완료여부/담당자/발생일/완료일을 사용하고, 긴 Issue명은 가용 너비를 흡수하며 나머지 metadata는 intrinsic min width와 표 내부 가로 스크롤을 사용한다. 검색·페이지 크기 변경은 첫 페이지로 복귀한다.

등록/수정은 필요할 때 여는 detail form이며 제목/등록일/등록자·담당자/발생일/완료 체크+날짜/**관련 Task → Issue 내용 multiline** 순서로 표시한다. Issue 내용 원문과 URL을 그대로 보존하되 별도 '링크 미리보기' 영역은 제거한다. 자원/Task 직접 입력과 검색 선택 ID/이름을 구별한다. 신규 등록에는 Issue 비밀번호+확인, 보호 Issue 수정·삭제에는 해당 비밀번호, 기존 레코드 초기화·분실 재설정에는 Project 편집 세션+실제 Project 비밀번호를 명시적으로 요구한다. 삭제는 경고·확인 후 논리 상태 전환이며 목록/완료 KPI에서 제외한다. 비밀번호·오류·readonly/pending·409/412/429 안내, Escape/Tab/focus restore를 compact UI로 제공한다. 390/768/1024/1440/1920px·키보드·스크린리더 label·coarse pointer 확인을 필요로 한다. 공통 시각 디자인 토큰/전역 Layout 규칙은 변경하지 않는다. 세부 [#846 Issue 가이드](docs/PROJECT_ISSUES_USER_GUIDE.md).
