# masterGantt 공통 UI/UX 기준

## Issue #538 — 관계 관리자와 cascade 상태

전역 Project Master의 연결 편집은 app-owned native control이다(SVAR Gantt Core API 적용 대상 아님). 라벨 있는 select/연결 버튼/해제 확인을 사용하며 disabled 이유와 server 409/412 메시지, 로딩/빈 관계/초안 하위 해제 상태를 텍스트로 구분한다. 하위 선택 변경은 저장과 분리하고 Project dirty draft를 무단 제출하지 않는다. 390/768/1024/1440/wide의 table-owned scroll, keyboard focus 및 document overflow를 회귀 검증한다.

## Issue #518 — Project Workspace 단일 상위 탭과 세로 영역

상위 tablist의 peer는 `일정 / Milestone 대시보드 / 리소스 / 물류 구성` 순서다. 일정의 중복 Gantt/Dashboard tablist를 제거하고 #399 WBS scope tablist만 유지한다. 각 tab의 aria-controls/aria-labelledby/aria-selected/roving tabIndex, ArrowLeft/Right/Home/End, focus 이동과 비활성 panel 접근성 차단을 실제 DOM에서 검증한다. 390px 등 좁은 화면은 선택 tab과 focus outline이 잘리지 않도록 tablist 자체만 수평 스크롤하며 height를 적층하지 않는다.

상위 탭 목록은 `overflow-y:hidden`이므로 `:focus-visible`의 3px outline을 음수 offset으로 버튼 안쪽에 그려 상·하단이 잘리지 않도록 한다. 별도 높이/패딩 증가 없이 390/768/1024/1440/1920px 실제 keyboard `ArrowRight` 전환에서 `:focus-visible`, `outlineWidth + outlineOffset <= 0`, 소유 탭의 가로 가시성을 검증한다. 이는 PR #544의 접근성 리뷰(미해결 상태) 개선 항목이다.

Milestone 활성 시 Gantt panel은 Core가 측정 가능한 높이/폭을 가진 visibility:hidden/inert/aria-hidden overlay로 남기고 Milestone 상위 panel만 scroll을 소유한다. 다른 상위 탭은 기존 hidden 정책을 사용한다. 동일 instance와 scope/filter 기준 viewport를 보존한다. Dashboard의 Task Editor/Dialog는 일정 패널 밖에 있어야 한다. 390/768/1024/1440/1920px에서 네비게이션/작업영역 geometry, Dashboard detail→Editor→복귀, readonly/edit, Gantt state를 검증한다.

## Issue #345 Summary 구조와 미산정 일정 구분

Summary의 유형·이름·계층과 일정의 유무는 별개다. 일정 없는 Summary도 Grid/Chart의 동일 행에 남고 bar만 없다. Grid 이름의 보조 설명과 접근 가능한 `aria-description`은 실제 전체 계층에서 자식 0개와 일정 있는 자손 0개를 구분한다. 접기·검색으로 숨겨진 child 수를 빈 상태로 오인하지 않는다. readonly에서는 생성 명령을 노출하지 않고 saving에서는 중복 생성·편집을 차단한다. 기존 메뉴 keyboard/Escape/focus 복원을 재사용하며 도구 모음은 작은 폭에서 wrap한다.

Renderer 좌표는 [빈 Summary Core adapter 계약](PRO_FEATURE_MATRIX.md#issue-345-빈-summary-core-273-표현)에 한정한다. 필드 표시·정렬·검색·진척·완료·Mutation·Export는 서버 canonical 값만 사용한다. 실제 browser 검증은 [TEST_PLAN.md](TEST_PLAN.md)의 #345 기록과 원격 CI 결과를 구분한다.

적용: Issue #87, 2026-09-22. Issue #76의 UX-01~12를 공통 설계 기준으로 선행 정리한다. 이 문서 추가는 #76 Workspace나 다른 화면 재설계의 구현 완료를 뜻하지 않는다. 제품 시각 언어와 화면 설계 방향은 저장소 루트의 [DESIGN.md](../DESIGN.md)를 Source of Truth로 사용한다. 이 문서는 interaction·접근성·반응형·검증 규칙을 구체화한다. 기존 동작 계약은 [PROJECT_UX.md](PROJECT_UX.md), 도메인/권한은 [REQUIREMENTS.md](REQUIREMENTS.md)와 [SECURITY.md](SECURITY.md)를 함께 따른다.

## 책임과 적용

`ui_ux`는 정보 구조·interaction·접근성 설계와 구현 비교를 담당하고, `frontend`는 구현·브라우저 증거·테스트를 담당한다. 작은 변경은 frontend가 UI/UX를 겸임한다. `qa_docs`는 인수 기준과 증거를 독립 검토하고 Manager가 범위/예외를 결정한다. 역할 선택은 [ISSUE_LIFECYCLE.md](ISSUE_LIFECYCLE.md)를 따른다.

아래 기준은 외부 디자인 시스템을 그대로 도입하라는 요구가 아니라 masterGantt의 설계 선택이다. `DESIGN.md`의 **Linear-inspired Light Enterprise Workspace** 방향을 적용하되 기존 파란색 Light UI, shadcn/ui와 SVAR Core를 우선하고 스타일을 이유로 새 UI framework를 추가하지 않는다. Linear는 정보 밀도·toolbar·tab·flat surface의 primary reference, Airtable은 table/search/filter, IBM Carbon은 enterprise form/status/accessibility의 secondary reference다. 기존 화면을 일괄 수정하지 않고 승인된 이슈 범위부터 적용한다.


## Design language 적용 규칙

UI 변경은 다음 순서로 판단한다.

1. security/domain/API/revision/canonical snapshot 계약
2. `DESIGN.md`
3. 이 UI/UX 가이드
4. 화면별 현재 UX 문서
5. 외부 reference

공통 시각 원칙은 **Light-first, workspace-first, data-dense, flat surface, compact controls, progressive disclosure**다. 모든 영역을 카드로 감싸거나 큰 제목·설명·여백으로 Gantt/Grid의 작업 면적을 줄이지 않는다. 시각 계층은 spacing, typography, hairline divider, subtle surface, semantic state로 만든다.

기본 spacing은 4/8/12/16/24/32px scale을 기준으로 하며, compact control/menu/input은 대체로 6–8px radius, 큰 panel/dialog는 8–12px 범위에서 현재 token과 회귀를 기준으로 정한다. 숫자·날짜처럼 비교가 중요한 정보는 가능한 경우 tabular numeric 표현을 사용한다.

색상·focus·selected·disabled·error/success 상태는 raw color의 화면별 추가보다 semantic token을 우선한다. 실제 token 정합화 범위와 값은 Issue #120에서 현재 UI 회귀와 함께 확정한다. 색을 통일한다는 이유로 서로 다른 의미의 상태까지 하나로 합치지 않는다.

화면별 디자인 적용 순서는 `Project List → Project Workspace → Task Editor → Search/Filter`다. 완료된 #75/#76/#74/#96/#83/#84의 기능 계약을 유지하며, #122의 P2/P3 이슈와 범위가 겹치면 별도 중복 구현 대신 dependency로 연결한다.

## Semantic UI token과 상태 규칙 (Issue #120)

기존 파란색 업무 UI와 시스템 한국어 폰트를 유지한다. palette primitive(`--background`, `--card`, `--foreground`, `--border`, `--primary`, `--ring`)를 제거하지 않고 구현은 의미 alias를 우선한다.

| 의미 | token | 사용 규칙 |
| --- | --- | --- |
| surface | `--surface-page/panel/subtle` | page, card/dialog, readonly/subtle 배경 |
| text | `--text-default/muted/readonly` | 기본/보조/대비가 필요한 readonly·subtle badge 텍스트 |
| border | `--border-default/control` | 구조 경계와 입력 control 경계 |
| action | `--action-primary/*`, `--action-secondary/*`, `--action-selected/*` | primary action과 selected 상태 분리 |
| focus | `--focus-ring/outline/offset` | 밝은 panel과 3:1 이상 대비되는 공통 3px solid outline과 공통 offset |
| status | `--status-error/warning/info/success` 및 surface/border variant | 서로 다른 의미의 상태색을 합치지 않음 |
| disabled | `--state-disabled-opacity` | native disabled/aria 의미를 유지하고 opacity는 보조 표현 |

selected는 `aria-selected` 등 의미와 색을 함께 사용한다. readonly/output 및 작은 subtle badge의 일반 텍스트는 실제 배경에서 4.5:1 이상을 유지한다. token 존재만으로 접근성 PASS를 주장하지 않고 computed style의 텍스트 대비와 keyboard focus/인접 surface 대비를 측정한다.

밀도 예외: Task Editor는 기존 compact radius/control 높이를 유지하고 Resource Catalog는 전역 radius 계열로 정합화한다. Project Row Menu와 Task Editor의 기존 hit-area를 유지하며, 이 예외는 색상·focus 의미의 독자 정의를 허용하지 않는다.

#120 범위는 Task Editor, Resource Catalog Admin, Project Row Actions, Workspace Feedback 및 이들이 참조하는 전역 semantic token이다. #74/#75/#76/#96 구조를 되돌리거나 전역 재스타일하지 않는다.

## 공통 원칙

| ID | 기준 | 설계/검토 질문 |
| --- | --- | --- |
| UX-01 | Global App Shell → Entity Context → Workspace View를 구분한다. | 사이트 navigation, 프로젝트 상태, 현재 View 명령이 섞이지 않았는가? |
| UX-02 | 실제 작업공간을 우선한다. | Gantt/Grid의 유효 폭·높이를 불필요한 장식/설명이 줄이지 않는가? |
| UX-03 | 항상 필요한 정보만 상시 표시한다. | 설명/소유자/상세 설정을 필요할 때 접근할 수 있으며 정보가 소실되지 않는가? |
| UX-04 | 상태와 명령을 분리한다. | 읽기 전용/편집 상태를 버튼 사이에 섞거나 색만으로 전달하지 않는가? |
| UX-05 | 명령의 우선순위를 표현한다. | primary 명령은 명확하고 보조 명령은 toolbar/overflow로 정리됐는가? |
| UX-06 | 같은 컨텍스트의 동등한 View에는 tab을 검토한다. | 동시 비교가 필요하면 split/drawer 등 대안과 장단점을 검토했는가? |
| UX-07 | 화면 유형별 너비를 선택한다. | Form/문서는 constrained, 목록은 wide, Gantt/Workspace는 viewport 기반인가? |
| UX-08 | 간격·정렬·글자 계층으로 관계를 표현한다. | 모든 영역을 card/border로 감싸지 않고 기존 token을 재사용하는가? |
| UX-09 | 의미에 맞는 요소를 사용한다. | 이동은 link, 명령은 button, view 전환은 tab이며 아이콘에 이름이 있는가? |
| UX-10 | 반응형/접근성을 기본 검증한다. | keyboard/focus/Escape/복원/overflow를 실제 동작으로 확인했는가? |
| UX-11 | UI 변경으로 domain 계약을 바꾸지 않는다. | revision/If-Match/session/Origin/API/canonical snapshot 계약을 유지하는가? |
| UX-12 | 사용자의 작업 상태를 보존한다. | tab/modal 전환으로 scroll/tree/column/scale/selection/fullscreen을 불필요하게 초기화하지 않는가? |

## SVAR 데모와 API 확인

UI 기능 설계 전에 유사한 공식 데모가 있는지 확인하고 참조 URL, 확인일, 적용할 interaction, 차이, 사용하는 Core API/설치 버전을 설계 기록에 남긴다.

| 대상 | 확인할 공식 자료 |
| --- | --- |
| Gantt 기본 Grid/Chart | [Base demo](https://docs.svar.dev/react/gantt/samples/#/base/willow) |
| Task Editor/입력 배치 | [Editor demo](https://docs.svar.dev/react/gantt/samples/#/editor/willow), [Editor guide](https://docs.svar.dev/react/gantt/guides/ui-layout/editor/) |
| 우클릭/계층 명령 | [Context menu demo](https://docs.svar.dev/react/gantt/samples/#/context-menu/willow), [Context menu guide](https://docs.svar.dev/react/gantt/guides/configuration/configuring_context_menu) |

데모와 현재 설치 버전의 기능이 같다고 가정하지 않는다. Core/PRO 범위를 확인하고 PRO의 비공개 구현을 복제하지 않는다. 자체 scheduling/resource 기능은 독립 domain/API로 유지한다. 데모에 유사 사례가 없으면 해당 사실과 자체 설계 근거를 기록한다.

문서/URL 조회와 실제 브라우저 조작을 구분한다. JavaScript 데모를 실행할 수 없거나 브라우저 도구가 없으면 interaction 검증은 NOT TESTED/BLOCKED다. 이번 기준 작성에서는 공식 guide 내용과 demo 주소를 확인했으며 demo의 실제 조작·화면 비교는 수행하지 않았다.

## UI 작업의 최소 설계 산출물

사용자 목표/주요 흐름, 변경 전 문제와 근거, 제안 배치 또는 텍스트 wireframe, 주요/보조 명령, 다음 상태별 동작을 적는다. 구조 변경이면 대안을 비교하되 사소한 변경에 불필요한 전체 재설계를 요구하지 않는다.

| 상태 | 기록할 내용 |
| --- | --- |
| 정상/읽기 전용/편집 가능 | 표시 정보, 가능한 동작과 거부 이유, server authorization 유지 |
| 로딩/빈 결과 | 진행 상태, 빈 이유와 다음 행동; 빈 화면을 오류처럼 표현하지 않음 |
| validation/요청 실패 | 필드별 오류, 복구 경로, 입력 보존, 중복 제출 방지 |
| session 만료/권한 거부 | 편집 취소/재인증 안내, 비밀번호·token 비노출 |
| 좁은 화면/긴 문자열/대량 항목 | 줄바꿈/축약/scroll 영역, 전체 내용 접근, Gantt lifecycle 보존 |

## Data-dense Table Column / Geometry 검토 기준 (Issue #403)

Project List, Resource/Admin 목록처럼 열이 많은 table을 설계·수정할 때는 시각적 인상뿐 아니라 **column budget과 browser geometry**를 함께 검토한다.

- 각 열을 fixed/minimum/flexible로 분류하고, 전체 percentage 합계와 별도 fixed-width 열이 가용 폭을 초과하지 않는지 확인한다.
- `white-space: nowrap`인 날짜·상태·코드·action 열은 실제 콘텐츠 + 좌우 padding을 포함한 최소 가독 폭을 확보한다.
- 긴 프로젝트명/분류명/소유자/설명, null 값, locale/timezone에 따라 길이가 달라지는 날짜/시간을 fixture에 포함한다.
- header와 body의 동일 열 경계가 맞는지, sibling cell의 bounding box 및 visible text가 서로 침범하지 않는지 확인한다.
- truncation/ellipsis를 사용하면 전체 값에 접근 가능한 title/tooltip/상세 경로 등 기존 접근성 패턴을 유지한다.
- viewport 축소 시 document 자체를 가로로 밀어내지 말고 table wrapper가 scroll을 소유하게 한다. 의도된 table scroll과 unintended document overflow를 별도로 판정한다.
- 390/768/1024/1440/wide desktop을 기본으로 하고, data table 레이아웃 변경은 최소 100% zoom, 가능하면 125% zoom에서도 smoke 검증한다.
- 열을 새로 추가하는 Issue는 기존 열의 회귀 검증을 Acceptance Criteria에 포함하고, 기존 percentage width를 기계적으로 재사용하지 않는다.

QA/browser evidence에는 viewport, locale/timezone, long-content fixture, `scrollWidth/clientWidth` 또는 동등한 geometry 근거를 남긴다. 정적 CSS/DOM 확인만으로 PASS하지 않는다.

## Data-dense Management List / Pane Geometry 검토 기준 (Issue #426)

이전 #426 Resource Catalog처럼 table이 아닌 관리 화면도 column budget과 같은 수준의 geometry 검토를 적용한다.

- sibling pane의 bounding box가 겹치지 않는지와 각 pane의 usable width를 함께 확인한다. 정보량이 다른 pane은 50:50을 기본값으로 간주하지 않는다.
- list row의 identity 영역이 profile/action의 intrinsic width 때문에 collapse하지 않는지 확인하고, profile·lifecycle·destructive action의 semantic boundary가 시각 순서와 keyboard Tab 순서에 일치해야 한다.
- search/filter toolbar, create form, list 사이의 수직·수평 경계를 측정하여 서로 침범하지 않는지 확인한다. wrap 전후 row height가 비정상적으로 급증하면 progressive disclosure 또는 breakpoint를 재검토한다.
- role/tag/button을 추가하면 현재 값만 확인하지 말고 0/1/최대 role 조합, 가장 긴 developer grade label, active/inactive/delete-unavailable 상태를 포함해 전체 geometry를 다시 계산한다.
- 긴 한국어/영문 name·code를 fixture에 포함하고 390/768/1024/1440/wide desktop에서 document overflow와 component-owned overflow를 구분한다.
- management footer는 secondary action과 primary commit action의 위치, 동일 높이/baseline, wrap/stack 후 접근성을 실제 bounding box로 검증한다.
- 기본 100% zoom에서 필수 검증하고 가능하면 125% zoom smoke도 수행한다.

## 관리자 인증 presentation 및 간격 소유권 (Issue #452)

세 관리 route는 같은 shell에서 로그인 전후 heading 위치와 gutter를 유지한다. 공통 page는 최대 100rem, 좌우 gutter 24px(640px 이하 16px), top 20px/bottom 40px, heading 24px와 heading→content gap 16px를 적용한다. 인증 panel만 최대 `32.5rem`, padding 1rem, gap 0.75rem으로 제한한다. desktop label/input과 submit은 bottom alignment를 맞추고 40px control-size에서 top/height 차이 ≤1 CSS px를 실제 bounding box로 검증한다. 540px 이하에서는 DOM 순서대로 입력·제출을 쌓으며 wrap 상태는 같은 행 비교와 구분한다.

- password input의 label과 고유 오류 ID를 연결하고 관련 오류가 있을 때 `aria-describedby`로 접근 가능하게 한다. 서버/네트워크/세션 오류를 모두 필드 validation으로 오인해 `aria-invalid`를 추가하지 않는다.
- Tailwind reset 뒤에도 border/background/padding/font/focus/error/disabled를 명시적으로 식별할 수 있어야 한다. [Preflight 공식 문서](https://tailwindcss.com/docs/preflight)의 margin/border reset을 실제 CSS cascade와 computed style로 확인한다.
- Enter 제출, 확인 중 중복 요청 차단, 민감 입력 삭제, 기존 focus/401/403/429/만료 재인증 및 영역별 권한 분리를 보존한다. 공유 component는 시각 구조를 소유하며 인증 controller를 합치지 않는다.
- button의 기본 외부 margin은 0이다. 부모가 gap/padding/position을 소유하고 같은 행 동급 action의 정렬을 검증한다. `.text-link`와 KPI `margin-top:auto`, Task Editor 44px hit-area 같은 의도 배치는 따로 보존한다.
- legacy margin 사용처 목록은 list/new/workspace/dialog/empty/error/KPI까지 포함하고 변경 전후 측정 또는 N/A 이유를 기록한다. 390/768/1024/1440/1920px와 긴 한글·영문·busy/error/focus를 검증한다.

인증 shell은 app-owned UI이므로 SVAR Gantt demo를 관리자 로그인 구현으로 대체하지 않는다. 기존 Gantt instance/권한/domain/API/revision 계약은 유지한다.

## 접근성과 반응형 검증

프로젝트의 기본 확인 폭은 390/768/1024/1440px이며 표준 규격의 공식 breakpoint라는 의미는 아니다. 변경 범위에 해당하는 화면에서 다음을 검사한다.

- 키보드만으로 진입/실행/종료 가능, 보이는 focus, 논리적인 이동 순서와 접근 가능한 이름. native element를 우선하고 custom tab/menu/dialog는 WAI-ARIA APG의 해당 패턴을 따른다.
- modal의 적절한 초기 focus, 내부 focus 유지, 허용된 Escape 닫기와 호출 지점 복원. 메뉴를 열었다는 이유만으로 하위 명령을 실행하거나 불필요하게 하위 메뉴를 펼치지 않는다.
- tab의 selected/tabpanel 연결과 방향키 이동. view 전환이 draft/선택/scroll을 잃게 하지 않는다.
- 문서 전체의 불필요한 가로 overflow가 없고 Gantt/Grid 자체 scroll과 구분된다. 작은 화면에서도 닫기·저장·복구 명령이 가려지지 않는다.
- 긴 한국어 작업명/설명, 빈 값, 에러/로딩 상태, readonly/edit 상태를 포함한다. 색상만으로 상태를 표현하지 않는다.

frontend는 변경 전후 screenshot 또는 재현 근거, viewport, 실행 명령과 Playwright test/fixture를 제공한다. qa_docs는 UI 인수 기준과 head SHA에 맞는 결과인지 비교한다. CSS/DOM 정적 확인, 실제 browser/E2E, 사람의 사용성 판단을 분리한다. 스크린샷만으로 keyboard나 server 권한 PASS를 판정하지 않는다.

## 공식 참고자료와 적용 근거

확인일: 2026-09-22. 이 자료들은 설계 근거이며 특정 library나 시각 스타일 도입 결정은 아니다.

- [Carbon UI shell header](https://carbondesignsystem.com/components/UI-shell-header/usage/): 전역 navigation/utility, viewport 기반 shell과 좁은 화면 대응을 UX-01/07에 참고했다.
- [Fluent 2 Layout](https://fluent2.microsoft.design/layout): 간격과 proximity로 관계/계층을 표현하고 내용에 따라 layout을 선택하는 원칙을 UX-08에 참고했다.
- [WAI-ARIA APG patterns](https://www.w3.org/WAI/ARIA/apg/patterns/), [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), [Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): 의미·keyboard·focus 검토의 기준이다.
- SVAR Editor/Context menu 공식 guide와 demo: 기존 Gantt interaction을 우선 검토하는 근거이며 프로젝트의 권한/저장 정책보다 우선하지 않는다.


## Issue #461 동적 탭과 소속 검색

Task/Summary는 기존 네 Editor 탭, Milestone은 두 번째 소속 작업 N 탭을 추가한다. #519부터 이 Task/Summary Membership 후보만 이름·날짜·상태를 표시하고 외부 ID/작업 ID는 숨긴다. ID/UUID 검색 및 canonical taskId 선택은 유지하며 Grid Milestone 필터와 Relation Editor의 식별자 표시 정책에는 영향이 없다. Keyboard 이동은 실제 노출 배열을 사용하고 active tab focus를 한 행 내부 scroll에서 보인다. 검색 combobox의 Arrow 이동은 aria-activedescendant와 visible option을 함께 갱신하며 Escape는 후보 목록→초안 확인→dialog 순서다. 진행 중에는 선택/닫기/Escape를 잠근다.

소속 표는 960px column budget을 유지한 소유 scroll container만 가로 넘치며 필터는 390px에서 한 열로 reflow한다. Header/Tab/Footer는 본문 세로 scroll과 분리한다. 다른 저장 단위의 dirty를 집계하여 cross-unit mutation을 차단하고 탭 이동은 초안을 유지한다. 연결 작업 열기/일정에서 보기·닫기·재조회에 전체 초안 폐기를 명시 확인한다. 기존 semantic tokens와 Editor 44px control/focus 규칙을 사용하며 제품 공통 시각 체계는 변경하지 않는다.

Readonly/completed lock은 후보 검색을 숨기거나 disable하지 않고 option의 mutation 불가 상태와 사유를 표시한다. Pending은 조회 입력도 잠근다. 소속 탭의 고정 footer는 기본 `저장`과 구분한 `소속 변경 적용`을 제공한다. 초안 확인 중에는 body를 inert로 처리하고 footer/submit mutation을 잠그며 계속 편집 버튼에 초기 focus를 둔 뒤 취소 시 원래 trigger에 복원한다.

Editable 검색 입력의 query와 별도 Membership 지정 값을 구분한다. query가 편집 가능하면 `aria-readonly`를 사용하지 않고 `aria-describedby`로 검색·조회 가능 및 소속 변경 잠금 안내를 연결한다. Option/action의 mutation 잠금은 유지한다. 소속 패널 검색 Enter는 입력 흐름 안에서 처리하며 pending에는 조회 필터도 disable한다. Geometry 증거는 표 header/body column 정렬, sibling cell/control 비중첩, tablist scrollHeight/clientHeight와 focus outline 경계, 긴 후보의 focused input/active option/listbox scroll owner 가시성을 함께 기록한다.

Horizontal tablist에서 overflow-y를 숨길 때 공통 focus outline과 offset을 합친 공간을 block padding에 확보해 외곽선이 잘리지 않게 한다. #461 실제 geometry 검증은 3px outline+3px offset의 6px 공간과 내부 scroll 높이를 검사한다.


## Issue #453 리소스 관리자 탭·표·모달 검증

Resource Catalog는 #453부터 독립 tabpanel 안 native table을 사용한다. 이전 #426 두 pane 비율/stack 기준은 활성 panel의 전체 가용 폭·비활성 접근/focus 제외로 대체하며 역할·등급 독립, 사용 여부, 초안, footer 보호는 유지한다. 최소 table budget 976/800px과 identity 240px, header/body 동일 경계, 셀 안 전체 action control containment, sibling 비중첩을 측정한다. 의도된 표 가로 scroll과 document overflow를 구분하며 검색·상태 toolbar는 390px에서 reflow한다.

생성/profile/폐기 확인은 app-owned native dialog 흐름이다. React autofocus만으로 showModal 후 focus를 주장하지 않고 실제 focused control을 검증한다. 초기 이름/등급/계속 편집, Escape와 계속 편집 후 복원, 명시 폐기 후 호출 버튼, 401 로그인 focus와 명시 초안 재진입을 확인한다. 공유 dialog primitive/API/auth를 바꾸지 않는다. pending 표시와 동기 handler guard, 명시 최신 GET과 자동 mutation 재시도 부재를 함께 검사한다.

동일 긴 KO/EN fixture를 390/768/1024/1440/1920px 기본 100% zoom에서 before/after 비교한다. before production Resource TSX/CSS는 fd8fdc9e9207ab43a6fb7ff85b5a5acbe91d4553 기준이며 header version은 브랜치 준비값 0.90.0이다. application 전체 byte 동일 baseline이라고 주장하지 않는다. before부터 document overflow는 0이었으므로 after 표 소유 scroll은 이전 document overflow 수정으로 설명하지 않는다. 1920px에서 작업 면적은 max100rem shell의 가용 폭을 기준으로 측정한다. 실제 125% browser zoom을 실행하지 못하면 NOT TESTED와 사유를 남기며 DSF/CSS zoom을 대체 PASS로 사용하지 않는다.

#453 pending native dialog는 disabled control에서 focus가 body로 빠지는 경우도 검증한다. 해당 모달에 focus를 두고 owned Escape capture로 반복 닫기 요청을 차단하며, Tab/ShiftTab·포인터 닫기·이중 제출·응답 이후 focus와 성공/실패 전환을 확인한다. 비pending Escape·탭 동작과 다른 화면은 가로채지 않는다. 원시 revision 번호는 표시하지 않으며 기존 If-Match 검증을 사용자용 최신 목록 안내와 구분한다.

## Issue #462 단계 조회 interaction

단계 popup은 전체/미지정/검색 가능한 Milestone을 제공하고 canonical 적용 예정일→외부 ID→작업 ID로 정렬한다. 후보에 외부 ID/작업 ID/적용 예정일/요청일 라벨을 분리한다. combobox는 Arrow/Home/End active option·Enter 선택·Escape popup 닫기·Tab 이동을 지원하고 active option을 listbox의 scroll owner 안에 보이게 한다. 선택/Escape는 trigger.focus({preventScroll:true})로 복원한다. 좁은 toolbar는 기존 grid에 별도 단계 행을 배치하며 전체 이름은 focus 가능한 동일 Editor 조회로 제공한다. readonly에서도 조회하며 pending 셀/메뉴의 disabled와 handler 차단이 일치해야 한다.

Grid Milestone 열은 기본 숨김 180px이며 기존 width/flex·내부 scroll budget을 보존한다. geometry는 390/768/1024/1440/1920px에서 toolbar 모든 control 경계·비중첩, popup/input/active option owner bounds, header/body 열 정렬, 표 모든 버튼과 소유 셀 경계·포커스를 측정한다. 스크린샷만으로 keyboard/권한/state PASS를 대신하지 않는다.

2026-10-06 SVAR 공식 [filter-tasks](https://docs.svar.dev/react/gantt/api/actions/filter-tasks/), [filtering](https://docs.svar.dev/react/gantt/guides/data-operations/filtering/), [links](https://docs.svar.dev/react/gantt/api/properties/links/) 문서를 조회했다. 설치 Core 2.7.3의 DataStore source map에서 filterTree(filter, open ?? true)를 확인하고 기존 공개 action에 open:false를 명시하여 tree-preserve를 검증한다. 최신 문서 조회와 실제 설치 Core browser 조작 증거는 별도로 기록하며 PRO helper는 도입하지 않는다.

Milestone 열 표시 시 공개 `set-columns`의 현재 사용자 width/flexgrow를 보존하고 `resize-grid`로 optional 열의 폭 증감만 반영한다. 작업명 최소 180px을 stage 열 추가로 소비하지 않으며 기본 최소 433px/단계 포함 613px/전체 optional 929px 예산은 Gantt 내부 scroll owner에서 처리한다. 2026-10-06 [공식 resize-grid action](https://docs.svar.dev/react/gantt/api/actions/resize-grid/)과 설치 Core 2.7.3 구현을 확인했고, 실제 grip 조절 뒤 Milestone 열 표시/숨김의 폭 보존은 관련 Chromium fixture로 검증한다.

## Issue #463 Dashboard interaction과 표 예산

#463의 일정 내부 peer 배치는 #518 이후 상위 `일정 / Milestone 대시보드` peer tab으로 대체한다. 동일 Gantt component를 유지하며 비활성 일정은 측정 가능한 크기로 overlay하되 visibility:hidden·inert·aria-hidden으로 keyboard/focus/접근성 조회에서 제외한다. 활성 Milestone 상위 panel만 세로 body scroll을 소유한다. 상위 tablist는 Arrow/Home/End와 활성 panel 관계를 제공한다. Milestone 선택은 #462의 검색·명시 ID 라벨·active option 가시성·Escape 복원(preventScroll)을 재사용한다. 다중 선택과 단일 picker는 같은 선택 상태를 표현하고 다중값을 조용히 단일값으로 덮지 않는다. 추가 조건과 원인 영역은 disclosure 의미를 공개한다. 원인 확인은 제목에 focus를 옮기고 Escape/닫기 뒤 trigger로 복원한다. readonly는 조회·필터·원인·drill을 허용하며 pending/stale에서는 조회 결과에 대한 이동 버튼과 실행 handler를 함께 잠근다.

Milestone 전체 상태 표의 최소 예산은 1052px이다. identity는 최소 260px의 가변 열이고 날짜 112px, 상태 96px, member progress 160px, 완료/전체 104px, 선행 차단 88px, 위험 88px, 조회 144px을 둔다. 긴 이름·외부 ID·UUID는 cell 안에서 wrap/ellipsis와 전체 title로 접근한다. 숫자는 우측 정렬하고 공수는 별도 표에 둔다. 작은 폭에서는 필터/KPI를 reflow하고 표 자체 가로 scroll을 사용한다. 활성 Milestone 상위 panel이 세로 scroll을 소유하며 document/sibling overflow를 만들지 않는다.

로컬 Chromium 근거는 `tests/e2e/milestone-dashboard-state.spec.ts`의 390/768/1024/1440/1920px 화면과 geometry, `tests/e2e/milestone-stage-dashboard.spec.ts`의 실제 SQLite drill/Gantt 상태 조작으로 구분한다. geometry는 header/body alignment, 모든 row button의 cell containment와 비중첩, 필터 control 경계, 실제 focus outline 가시성, popup viewport/active option/input 경계, tab 높이와 body scroll owner를 측정한다. 변경 전 actual 화면은 NOT TESTED이며 baseline `603cd029d279ddc5b70309786abf8876b6bd1692`의 일정 화면에는 peer 대시보드가 없다는 source 재현 근거를 사용한다. 실제 기기·screen reader·최종 수동 UX와 원격 CI는 별도 검증이다.

2026-10-06 [공식 scroll-chart action](https://docs.svar.dev/react/gantt/api/actions/scroll-chart/)과 설치 Core 2.7.3 `DataStore.d.ts`의 공개 left/top 계약을 확인했다. 일반 peer 복원은 visible·세대·scope/filter key를 확인하고 기존 canonical/column queue 뒤에 공개 viewport action을 직렬 적용한다. native fullscreen과 scheduling 정책은 변경하지 않는다. 복원 오류는 canonical reset/remount를 호출하지 않는다. 공개 scroll event/state 진단은 개발/test에만 한정하며 최근 256건의 공개 scroll/resize/select 진단을 보존한다. select 진단은 ID/show/eventSource에 한정하며 Task 본문이나 비밀값을 포함하지 않는다. 문서 조회와 실제 Chromium의 public state/DOM 및 후속 layout 유지 근거는 구분한다.

변경 전 재현 근거는 baseline `603cd029d279ddc5b70309786abf8876b6bd1692`의 `src/features/projects/project-readonly-view.tsx`다. 해당 source의 일정 영역에는 Gantt만 있고 Milestone Dashboard peer가 없다. baseline에서 Project 직접 링크를 열어 일정 탭을 선택하는 절차와 변경 후 peer 선택 절차를 비교한다. 변경 전 실제 캡처는 수행하지 않았으며 source 비교를 실제 browser PASS로 표시하지 않는다. geometry는 실제 표시되는 control만 집계하고 닫힌 details 자식의 캐시 bounding rect는 `checkVisibility()`로 제외한다.

공용 단계 popup은 anchor와 현재 viewport의 실제 여유를 계산한다. 검색·border·padding·list margin을 포함한 chrome 높이를 실측해 list max-height를 제한하고 아래 공간이 부족하면 위로 배치한다. 가로 경계는 viewport 안으로 clamp하며 열린 상태의 viewport resize와 외부 scroll에서 다시 배치한다. 내부 list scroll은 owner 안에서 유지하고 End active option과 Escape trigger focus 복원을 검증한다.

## Issue #464 교환·Copy 확인 interaction

Copy 영향 확인은 기존 Task 메뉴와 키보드 Paste의 공통 Workspace dispatch에 둔다. 영향 표는 제외 explicit row 수와 변화 Task/Summary 수를 별도로 표시하고, 기존 target과 복제 예정 target(원본 ID)을 구별한다. 검토 revision/command가 바뀌면 기존 동의는 사용할 수 없다. 완료 잠금·권한·서버 validation 실패는 확인으로 우회하지 않는다. native fullscreen host를 기존 portal 패턴으로 관측해 fullscreen 안에서도 dialog와 초기 취소 focus가 보이도록 한다. 취소는 저장하지 않고 호출 목적지로 `preventScroll` focus를 복원한다.

Import preview는 조회 중 취소·abort를 허용하고 generation이 다른 늦은 응답을 적용하지 않는다. commit은 동일 File·대상·preview revision/digest로만 실행하고, 동기 pending guard와 실제 disabled/닫기/Escape가 일치해야 한다. 401/412/네트워크 실패에는 File을 보존하되 이전 preview로 자동 재저장하지 않는다. 조회·검토와 DB commit의 상태 문구를 분리한다. JSON Export의 legacy mixed 안내도 실제 다운로드에 사용할 최신 snapshot revision에 연결한다.

새 표의 수치·범위는 서버 DTO를 표시하며 클라이언트에서 effective membership/Ready/공수 계산을 재구현하지 않는다. Copy 표 720px, Import 표 960px 최소폭과 `min(360px,40dvh)` 표 내부 세로 budget을 사용한다. Copy/Import의 고정 헤더·action과 내부 body 세로 스크롤을 유지하고 390/768/1024/1440/1920px에서 문서 overflow 0, 표 자체 가로 스크롤, header/body 정렬, 표시되는 모든 control의 cell/owner containment와 비중첩, focus outline 및 native dialog keyboard 경계를 실제 측정한다. 닫힌 details·inert·비표시 자식은 표시 control로 세지 않는다. 변경 전 실제 캡처와 변경 후 실제 증거, mock과 실제 SQLite, 로컬 LFF와 원격 CI는 각각 구분한다. 설치 SVAR Core 2.7.3의 Task/canonical/viewport 계약은 유지하고 PRO 교환 UI나 새 Gantt 엔진을 복제하지 않는다.

Import 412에서는 파일과 dialog를 유지한 채 `최신 일정 조회`로 전체 canonical snapshot을 명시적으로 조회한다. 이 GET은 Workspace ready 상태를 유지하고 dialog를 unmount하지 않는다. 기존 preview를 무효화한 뒤 새 revision이 표시되면 사용자가 `다시 미리보기`와 `기존 일정에 추가`를 각각 실행한다. 자동 preview/commit은 없다. 최신 조회도 취소·target/generation·AbortSignal을 검사하며, 취소하거나 프로젝트가 바뀐 뒤 도착한 응답은 parent snapshot 적용 전에 폐기한다. 조회 실패에는 File을 유지하고 명시적 재조회만 허용한다.

#464의 변경 후 Chromium 증거는 `output/playwright/issue-464/`의 Copy·Import·Excel·JSON별 390/768/1024/1440/1920px PNG 20개와 geometry JSON 20개다. 2026-10-06 마지막 영향 검증은 Import 기존 2개·412 최신 조회 복구 2개·5폭 geometry·SVG/PNG/Excel·다중 Copy canonical·pending Copy 412의 8개를 실행해 PASS했다. 이전 source와 무관한 Copy fullscreen·JSON 최신 revision·외부 revision·완료 경계·Editor 리뷰 2개는 재사용하여 고유 14개 범위를 검증했다. 단일 실행의 14 PASS나 원격 전체 회귀 PASS로 해석하지 않는다. 최초 테스트 메뉴/문구 선택 실패와 별도로, Manager가 발견한 Import 412 최신 조회 수단 누락은 제품 보완 사항으로 기록한다. 실제 SQLite 통합·독립 QA·원격 CI 및 실제 기기/스크린리더 결과는 [테스트 계획](TEST_PLAN.md)에서 별도로 확인한다.

작업 메뉴를 열기 위한 미선택 행 선택은 공개 `select-task`의 `show:false`로 Core에 반영한다. 이미 보이는 호출 대상의 위치를 선택 직후 자동으로 이동시키지 않으며, 일반 클릭·키보드 선택의 기존 reveal 및 modifier/multi-selection은 유지한다. 메뉴가 열린 뒤 실제 사용자 스크롤·resize에는 기존 guard가 즉시 메뉴를 닫고, 같은 위치의 지연 scroll 알림은 무시한다. 설치 Core 2.7.3 타입과 [공식 select-task action](https://docs.svar.dev/react/gantt/api/actions/select-task/)의 show 기본 true/false 계약을 2026-10-06 확인했다. 하단 가상 행의 미선택 namecell 우클릭과 native/public 수직 위치 보존은 `tests/e2e/task-context-menu-scroll.spec.ts`에서 검증하며, 문서 확인과 실제 browser 결과를 구분한다.

2026-10-06 context 선택 수정 후 좁은 Chromium 4개(하단 가상 행 미선택 우클릭, 화면 밖 Chart 우클릭/실제 스크롤 닫힘, 다중 Copy canonical, pending Copy 412)는 같은 source에서 PASS했다. 하단 이름 셀 우클릭 후 native/public top192와 소유/Core 선택을 유지하고 Copy 조회에 POST를 만들지 않았다. 실제 이후 스크롤은 메뉴를 닫는다. 기존 40개 화면/geometry는 layout 변경이 없어 재사용하며 실제 #464 통합 fixture와 원격/독립 QA 결과는 별도로 판정한다.

Context 선택은 기존 Copy 완료 feedback도 보존한다. 미선택 목적지 우클릭 직후 조건부 feedback 줄을 제거하면 Gantt 높이가 바뀌고 scrollIntoView된 Grid 조상의 위치가 clamp되어 새 메뉴가 닫힐 수 있기 때문이다. 메시지는 clipboard의 복사 결과를 계속 설명하며 일반 클릭·키보드·modifier 선택의 기존 메시지 정리는 유지한다. Copy→더 아래 목적지 이름 셀 우클릭→활성 Paste 위치 submenu→소속 영향 확인·취소의 실제 경로를 검증하며 clipboard/revision 조건이나 실제 사용자 scroll 닫힘을 완화하지 않는다.

Copy feedback 보존 보강 후 같은 좁은 Chromium 4개를 다시 실행해 PASS했다. 확장된 하단 가상 행 회귀는 Copy→한 행 아래 미선택 목적지의 실제 scrollIntoView/이름 셀 우클릭→활성 Paste/Below→소속 영향 확인·취소까지 도달했다. 우클릭 전후 Grid 조상 위치와 Gantt 높이, native/public top192를 유지하고 DB mutation은 0회다. 실제 사용자 이후 스크롤 닫힘과 기존 다중 Copy/pending412도 유지했다. 원본 actual 통합 테스트의 수정 후 결과는 별도 근거다.


## Issue #492 작업 Hover Tooltip — SVAR 공식 경로

2026-10-06 SVAR React Gantt 공식 [Adding tooltips](https://docs.svar.dev/react/gantt/guides/tasks/add-tooltip/)와 [Tooltip API](https://docs.svar.dev/react/gantt/api/tooltip/)를 확인했다. 다만 설치 2.7.3의 실제 PR CI에서 wrapper/custom resolver 경로가 일반 Task에는 동작하면서 Milestone·WBS scope에서는 content를 만들지 못했고, hover shell이 기존 Header Tooltip과 동시에 `role=tooltip`으로 남는 회귀가 확인됐다.

#492 최종 구현은 이 실증 결과에 따라 기존 app-owned Header Tooltip 패턴과 `TASK_TARGET_SELECTOR`를 재사용한다. Grid/Chart의 mouse move를 event delegation으로 canonical taskId에 연결하고 `ProjectTaskDto.start/end`만 표시한다. hover 대상이 없거나 keyboard focus/scroll/영역 이탈이 발생하면 Task Tooltip을 제거해 #315/#316 Header Tooltip과 동시에 accessible tooltip이 존재하지 않게 한다. 긴 이름은 viewport 안에서 wrap하고 pointer-events를 받지 않으며 fullscreen frame 내부 fixed overlay로 표시한다. PR CI #2040에서 부모 hover state가 #490 viewport 복원과 교차해 scrollLeft를 120→91로 바꾸는 회귀가 확인되어, Tooltip state/event listener는 전용 child layer로 격리하고 Gantt 부모 렌더 경계를 건드리지 않는다.


### Issue #456 Task Editor 폼 검토 기준

- schedule 날짜·기간·mode는 이름이 있는 fieldset으로 인접하게 배치하고 작은 화면에서도 label 연결과 읽기 순서를 유지한다. 설명/URL은 별도 semantic group으로 묶되 기존 설명 읽기 폭과 resize를 줄이지 않는다.
- 진행률은 slider와 실제 숫자 text·focus outline의 containment를 함께 확인한다. document horizontal overflow 0만으로 내부 clipping을 PASS 처리하지 않는다.
- Footer action은 label/padding 기반의 폭과 pending label budget을 사용한다. 숨김 sizer는 accessible name을 중복시키지 않으며 normal/pending 상단·높이·폭 차이는 1px 이내여야 한다. native action hit area 최소 44px와 모바일 multiline 자연 높이를 보존한다.
- 실제 pending에서 disabled 버튼→body focus→반복 Escape를 확인하고 readonly/dirty/unlock 이후 기존 Escape, nested dialog, 401/412·reload와 교차 draft 잠금도 별도로 검증한다. 화면 캡처는 keyboard/state evidence를 대신하지 않는다.
- Gantt 보존은 실제 public/DOM scroll, 존재하는 header 열 폭, 선택/tree/scale/scope/fullscreen과 instance를 함께 비교한다. 빈 배열이나 instance identity만 비교한 결과를 전체 상태 보존 PASS로 사용하지 않는다. 실제 날짜/filter/scope 이동은 이전 viewport로 덮지 않아야 한다. active name/status filter에서 metadata 저장으로 실제 표시 ID 집합이 바뀌는 경우도 확인한다. raw query가 같은 것만으로 동일 필터 상태라고 판정하지 않는다.

#456의 390/768/1024/1440/1920px before/after와 대표 상태 evidence는 TEST_PLAN에 기록한다. B #490 및 C #491은 별도 후속/NOT TESTED이며 이 항목을 통해 인수하지 않는다. SVAR 자료 확인일은 2026-10-06, 설치 Core는 2.7.3이다. 공식 문서 확인과 실제 브라우저 조작 증거는 구분한다.

## Issue #457 공통 관측과 coverage 계약

[전 화면 coverage](ISSUE_457_UI_UX_COVERAGE.md)는 각 표면의 route/entry·fixture·child Issue/PR·실제 viewport/state·source/test/env provenance·artifact·판정·남은 이유를 함께 기록한다. 전체 행의 대표 PASS를 해당 화면 모든 상태 PASS로 확대하지 않는다. 이전 source의 before/after와 현재 actual browser를 구분하고 동일 product/CSS 변경0은 KEEP로 판정한다. 일반 회귀 실행은 tracked evidence를 덮어쓰지 않아야 하며, 증거 게시 경로는 명시적으로 opt-in한다. KEEP/REGRESSION 같은 판정은 명시적 source baseline과 비교할 때만 계산하고 baseline 없는 관측은 중립 상태로 기록한다.

공통 observer는 표시 control의 경계/배경/padding/font/높이, 실제 label/description, native focus-visible/outline와 clipping owner, error/disabled 상태를 관찰한다. populated row/header/control의 최소수를 명시하며 empty colspan·숨은 text·0rect·inert/비활성 panel을 제외한다. 형제 control만 비중첩 검사하고 parent-child를 같은 층으로 비교하지 않는다. Cell text 침범과 의도된 ellipsis/clip은 구분하며 document overflow는 clientWidth+1, table/Gantt 내부 scroll은 별도 소유자로 측정한다. viewport와 owner에 실제 교차하는 row 수와 usable budget을 수집하며 가상 DOM 수를 전체 Task 수로 부르지 않는다.

비교 환경을 먼저 맞춘다. #457 cross-admin은 같은390/768/1024/1440/1920px·높이900·ko-KR/Asia-Seoul/default100%를 사용한다. 설명 줄 수의 정상 높이 차이를 공통 shell 실패로 판정하지 않는다. Native125가 실행 불가능하면 NOT TESTED로 남기고 DPR를 zoom으로 대체하지 않는다. 관찰용 scroll 준비는 keyboard 접근 증거와 분리하며 마지막 action은 native Tab로 owner 안에 보이는 실제 focus outline을 확인한다. 기존40px admin/44px Task Editor/nested Relation 자체33.5px 예외를 보존한다.

실제 browser·E2E·source-only·분리 CSS 실험·원격 CI·독립 ui_ux/QA 결과는 각각 기록한다. 실행별 HTML/trace/JSON 원본을 다음 실행 전에 분리 보존하고 후기 hash를 이전 capture에 소급하지 않는다. #452 first PR에는 지역 observer만 있었으며 재사용 helper를 당시부터 존재한 것으로 쓰지 않는다. B#490/C#491와 별도로 실제 React boundary 자동화는 #502, 실제 배포·native125 환경 검증은 #517에서 추적하며 사진/문서만으로 Epic 완료를 선언하지 않는다.

[Follow-up #502](https://github.com/planner77/masterGantt/issues/502)는 실제 React error boundary 자동화를 추적하고, 환경별 native125/실기기·screen reader·최종 수동 UX/배포 source·version은 [#517](https://github.com/planner77/masterGantt/issues/517)에서 FOLLOW-UP/NOT TESTED 또는 BLOCKED로 추적한다. ui_ux·infra·qa_docs가 #517 환경 증거를 작성/비교/독립 확인하고 Manager가 환경 제공과 수용 범위를 판단한다.

#457 독립 검토의 provenance 정정: 목록 `list-populated-1440`/`list-no-result-1440` key는 별칭이며 실제 JSON/PNG는1280×720이다. Current62 JSON은 ko-KR/Asia-Seoul/높이900/DPR1 49개, en-US/Asia-Seoul/높이900/DPR1 11개, en-US/Asia-Seoul/높이720/DPR1 목록2개다. 정상 Master auth는 기존 autofocus 때문에 focused/focusVisible=true이므로 normal을 비포커스 baseline으로 해석하지 않는다. 과거capture/test/source hash와141개raw PNG/JSON은 그대로 유지한다. 착수 시 stacked 계획과 달리 parent PR#500 외부 병합 후 최종 base는 main `24072f4fd28cd1306b3c348d3f7da1a0e3dbc075`/0.92.1이며 tree `6a322cc119ed5b0a435f3b1ff20fe5826035ed66`이 원래 capture source b397eedf35d50befb4ae17e623036f0a8d77f556과 정확히 같아 LFF를 재사용한다. 실제 운영 배포는 #517 NOT TESTED/BLOCKED다.

## Issue #490 설정 폼 검증 적용

설정 탭의 native Home/Arrow/End 및 Tab 이동에서 focus ring은 scroll owner 안에 완전히 보여야 한다. outline 3px + offset 3px인 소비자는 최소 6px 여유를 확보한다. Calendar 입력의 식별 가능한 테두리·padding·focus·disabled 표현과 footer의 같은 행 높이/간격, 좁은 폭의 자연스러운 wrap을 측정한다. 일반 정보·보안·unlock의 정상 표현은 기존 공통 form-field를 재사용한다. Task Editor의 44px 정책과 공통 전역 token은 변경하지 않는다.

Pending Escape 회귀는 busy DOM 반영 직후 지연 없이 두 번 누른다. listener 준비 대기나 50ms 간격으로 실패를 숨기지 않는다. BODY 초점·가장 위의 native modal 소유·중첩 nonbusy modal·busy=false/unmount cleanup을 분리한다. PNG만으로 keyboard/초안/권한/viewport 보존 PASS를 대신하지 않는다. 실제 125% zoom, 실기기와 screen reader는 [환경별 후속 #517](https://github.com/planner77/masterGantt/issues/517)의 NOT TESTED/BLOCKED 범위다. 상세 비교는 [Issue #490 검토 기록](ISSUE_490_UI_UX_REVIEW.md)을 따른다.

#490 검증 보완은 기존 국가 select의 UA focus 관측과 새 Calendar .field의 focus 관측을 분리한다. 390px에서 국가→적용 범위 select→시작일 input을 native Tab로 이동하고 browser가 보이도록 스크롤한 실제 bbox/outline3px+offset3px/clip owner를 확인한다. 화면 아래의 focused input 사진이나 기존 country의 UA outline1px을 새 field focus PASS로 쓰지 않는다. 유효 password rotation은 대표1440px 실제 pending/204 성공/session 교체 경로로 추가하며 모든 상태×5폭으로 확대하지 않는다. canonical refresh 중 BODY 초점은 실제 기존 정책으로 기록하고 정상 닫기/로그아웃/unlock의 호출 초점 복원과 구분한다.

## Issue #491 소비자 전송 폼 검증

실제 FIX는 템플릿 저장 field/footer와 action peers의0px gap, Export footer의0px 수평/세로 gap, JSON Import region의6px native ring 예산 부족이었다. 로컬 form/footer gap12px와 Import body8px/scroll-padding8px/table scroll-margin8px으로 보완한다. 36px compact Export 입력과 browser-native13px radio/checkbox는 기존 경계·label·focus 계약을 충족하므로 전역40px 강제나 choice restyle을 하지 않는다.

회귀 oracle은 실제 `.dialog-actions`/`.form-actions` bbox의 peers gap≥11px, 같은 행 top/height≤1px, 템플릿 마지막 field/footer gap≥11px와 native region ring의 viewport/실제 clipping owner containment를 검사한다. text/date/select/textarea 경계 assertion을 native choice에 적용하지 않는다. choice는 label·nonzero rect·native appearance를 검증하고 genuine Tab/ShiftTab proof와 관찰용 resize/full-page 캡처를 구분한다.

[Issue #491 검토](ISSUE_491_UI_UX_REVIEW.md)의 5폭·대표 native focus·actual API/controlled fixture·실행별 원래 실패·source/spec/helper hash·지원 entry N/A를 참조한다. CSS 보완은 공용 dialog의 preview 취소/commit busy·401/412·민감 입력 clearing·Gantt 보존 의미를 바꾸지 않는다. 새로운 shell/flow/견적 modal/CSV mapping을 도입하지 않는다.

Issue #491의 최신 검증 기준은 main `d8d0bb3bab5d13ca68a6b319e116dec4ca24d48d`/0.94.4이며 제품4/spec/helper byte를 유지한 after-current8case PASS다. 역사적0.94.3 증거와 최신 선택 관측은 [Issue #491 검토](ISSUE_491_UI_UX_REVIEW.md)에서 구분한다. 템플릿 instantiate는 실제 navigation·편집 상태·원본 불변을 확인했으며201은 서버 계약값으로 response.status 직접 검증이 아니다. 공식 원격 CI와 최신 독립 QA는 별도 판정 전까지 NOT TESTED다.

Issue #491의 두 번째 통합 최신 기준은 main `61a5f511d79e1f9429635bb0da35c0c02ee2163c`/0.95.1이다. 기존 #492 HoverTooltip 변경을 보존하고 동일 소비자 제품4/spec/helper로 새8case PASS를 확인했다. 이전0.94.3/0.94.4는 역사적 검증으로 보존하며 총10run61case(50PASS/11원래FAIL)와 최신 관측은 [Issue #491 검토](ISSUE_491_UI_UX_REVIEW.md)를 따른다. create/copy/instantiate201의 간접 근거와 직접 response.status 검증은 구분한다. 공식 CI와 최신 독립 검토는 별도다.

## Issue #502 Error Boundary 복구와 환경별 접근성 경계

실제 route error boundary는 일반 API/network 오류 상태와 별도 검증한다. E2E probe는 오류 전 keyboard focus가 있던 테스트 control에서 실제 client render 오류를 일으키고, fallback의 `다시 시도`를 native Tab/Enter로 실행한 뒤 reset된 segment에서 같은 probe focus가 복원되는지 확인한다. 이 절차는 screenshot만으로 대체하지 않는다.

Probe UI는 제품 기능이 아니며 production에서 활성화하지 않는다. `NODE_ENV !== "production"`과 명시적 E2E flag를 동시에 요구하고, gantt-demo는 추가 query opt-in까지 요구한다. 일반 사용자가 접근하는 화면·권한·데이터 계약은 이 검증을 위해 변경하지 않는다.

자동 Chromium 390/1440px 결과는 실제 boundary/keyboard/focus 범위에만 적용한다. native125% zoom, 실기기, screen reader, 최종 수동 UX 및 운영 reverse proxy/source-version 일치는 환경별 후속 [#517](https://github.com/planner77/masterGantt/issues/517)에서 검증한다. DPR 또는 device emulation을 native zoom 근거로 사용하지 않으며, 환경이 없으면 NOT TESTED/BLOCKED를 유지한다.


### #502 자동화와 #517 환경 검증 분리

PR #516의 Error Boundary 하니스/keyboard/focus 검증은 #502의 자동화 범위다. 실제 브라우저 native125%·실기기/screen reader·최종 수동 UX·운영 source/version/proxy는 #517의 환경별 범위이며, #502 CI 또는 merge/close를 해당 환경 PASS로 해석하지 않는다.


## Issue #514 — null 시작과 입력 뒤 viewport 복원 경계

canonical start=null을 renderer anchor가 있는 날짜 작업으로 취급하지 않는다. 해당 native `select-task show:xy`만 공개 `show:y`로 좁혀 선택/focus·수직 reveal을 유지한다. dated native xy, Context Menu false, modifier/checkbox/keyboard와 canonical-owned 선택은 일괄 변경하지 않는다.

지연된 peer viewport 복원은 실제 작업면 pointerdown/wheel/keydown과 source/snapshot/instance/sync/visibility/scale/column/grid 변경 뒤 취소한다. DOM와 Core 경로를 각각 검증하며 marker 해제나 screenshot만으로 사용자 위치 보존을 판단하지 않는다. public/native 위치가 rounding 때문에 다를 수 있으므로 입력 직후 각각의 값을 pending queue 후 각각 비교한다. 복원 준비의 RAF는 앱 통합 선택이며 SVAR layout-settled 보장으로 기록하지 않는다. Production DOM 복원은 snapshot/reset generation/instance/input/geometry를 검사하고 Core 복원은 실제 canonicalSyncVersion ref를 검사한다. DOM sync marker는 기존 개발/test 전용 추가 검사이며 개발 browser 증거를 production marker PASS로 해석하지 않는다.

설치 Core2.7.3와 2026-10-08 공식 [select-task](https://docs.svar.dev/react/gantt/api/actions/select-task/)·[scroll-chart](https://docs.svar.dev/react/gantt/api/actions/scroll-chart/)의 공개 계약을 확인했다. 문서 URL 조회와 실제 project fixture Chromium pointer 증거를 구별하며 공식 demo 실제 조작은 NOT TESTED다. Core 공개 action을 사용하고 PRO·비공개 state·날짜 픽셀 탐색 구현을 추가하지 않는다. 좁은 화면의 기존 내부 작업면 제한은 [프로젝트 UX](PROJECT_UX.md#issue-514--grid-시작-위치와-지연된-peer-복원)를 따른다.

## Issue #530 동일 원장 통합 UI 검증

Resource 기본 현황·세 계층·두 Milestone 비교표·주/월 Resource Plan은 같은 합성 원장을 실제 SQLite/HTTP로 읽어 검증한다. 원시 합계 외에 현재 응답의 기간·기준일·환산값·출처, 상세 Task/Assignment scope를 확인한다. Group 소계의 합을 Grand로 대체하지 않는다.

390/768/1024/1440/1920px의 populated 비교표는 문서 overflow와 표 내부 scroll, 셀 control containment를 측정한다. keyboard Enter로 실제 계층과 상세를 열고 제목 focus 및 Escape의 visible trigger 복원을 확인한다. Gantt는 instance뿐 아니라 public/native viewport·선택·열·tree를 별도로 대조한다. 합성 fixture의 자료량으로 수직 overflow가 생기지 않는 경우 이를 nonzero 수직 viewport 검증으로 보고하지 않는다. 긴 이름과 많은 행의 기존 mock 회귀 및 실제 원장 통합 증거도 구분한다.

Resource 임시 이동 반환의 검증은 고정 1440px에서 서로 다른 비영 Core/native 위치의 nested pop, 현재 보기의 가장 이른 baseline으로 전체 해제, pending 복원 중 실제 wheel 이후 사용자 위치 유지까지 포함한다. 반응형 5폭 검증과 고정 geometry 상태 보존 검증은 분리한다. frame 기록의 조건 검사와 canonical queue의 실제 target filter 검사, Core 좌표와 native owner 좌표 검증을 각각 수행하며 hidden/inert·분리·교체된 native owner에는 복원을 적용하지 않는다.

Issue #530의 추가 직접 경로는 실제 API로 T1과 개인 Assignment2개의 기간만2026-09-28~10-02로 이동한 명시 파생 원장에서 검증한다. M1 원인→정확한 Resource(T1/Assignment2,known7.5 M/D)→지연 KPI1→정확한T1 일정→원래 Resource 지연 상세→원래 M1 원인·검색·기간·focus의 두 단계 LIFO 복귀와 조회 전후 canonical/revision 불변을 확인했다. 실제 server asOf2026-10-08과 해당 report scope/환산을 사용하며 공통 기본11.5 M/D 원장과 파생 조회 context를 혼합하지 않는다. Source-bound report/detail은 같은 binding의 POST query로 대조하며 binding 없는 GET fallback으로 범위를 확대하지 않는다. [실행 증거](../output/playwright/issue530/cross-flow-evidence.json)는 제품4개·fixture/helper 불변, 기존spec32,454byte prefix 보존, 추가case1건12.0초PASS를 기록한다.
