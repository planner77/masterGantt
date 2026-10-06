# masterGantt 공통 UI/UX 기준

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

Task/Summary는 기존 네 Editor 탭, Milestone은 두 번째 소속 작업 N 탭을 추가한다. Keyboard 이동은 실제 노출 배열을 사용하고 active tab focus를 한 행 내부 scroll에서 보인다. 검색 combobox의 Arrow 이동은 aria-activedescendant와 visible option을 함께 갱신하며 Escape는 후보 목록→초안 확인→dialog 순서다. 진행 중에는 선택/닫기/Escape를 잠근다.

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

Grid 단계 열은 기본 숨김 180px이며 기존 width/flex·내부 scroll budget을 보존한다. geometry는 390/768/1024/1440/1920px에서 toolbar 모든 control 경계·비중첩, popup/input/active option owner bounds, header/body 열 정렬, 표 모든 버튼과 소유 셀 경계·포커스를 측정한다. 스크린샷만으로 keyboard/권한/state PASS를 대신하지 않는다.

2026-10-06 SVAR 공식 [filter-tasks](https://docs.svar.dev/react/gantt/api/actions/filter-tasks/), [filtering](https://docs.svar.dev/react/gantt/guides/data-operations/filtering/), [links](https://docs.svar.dev/react/gantt/api/properties/links/) 문서를 조회했다. 설치 Core 2.7.3의 DataStore source map에서 filterTree(filter, open ?? true)를 확인하고 기존 공개 action에 open:false를 명시하여 tree-preserve를 검증한다. 최신 문서 조회와 실제 설치 Core browser 조작 증거는 별도로 기록하며 PRO helper는 도입하지 않는다.

완료 단계 열 표시 시 공개 `set-columns`의 현재 사용자 width/flexgrow를 보존하고 `resize-grid`로 optional 열의 폭 증감만 반영한다. 작업명 최소 180px을 stage 열 추가로 소비하지 않으며 기본 최소 433px/단계 포함 613px/전체 optional 929px 예산은 Gantt 내부 scroll owner에서 처리한다. 2026-10-06 [공식 resize-grid action](https://docs.svar.dev/react/gantt/api/actions/resize-grid/)과 설치 Core 2.7.3 구현을 확인했고, 실제 grip 조절 뒤 단계 열 표시/숨김의 폭 보존은 관련 Chromium fixture로 검증한다.
