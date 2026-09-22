# masterGantt 공통 UI/UX 기준

적용: Issue #87, 2026-09-22. Issue #76의 UX-01~12를 공통 설계 기준으로 선행 정리한다. 이 문서 추가는 #76 Workspace나 다른 화면 재설계의 구현 완료를 뜻하지 않는다. 기존 동작 계약은 [PROJECT_UX.md](PROJECT_UX.md), 도메인/권한은 [REQUIREMENTS.md](REQUIREMENTS.md)와 [SECURITY.md](SECURITY.md)를 함께 따른다.

## 책임과 적용

`ui_ux`는 정보 구조·interaction·접근성 설계와 구현 비교를 담당하고, `frontend`는 구현·브라우저 증거·테스트를 담당한다. 작은 변경은 frontend가 UI/UX를 겸임한다. `qa_docs`는 인수 기준과 증거를 독립 검토하고 Manager가 범위/예외를 결정한다. 역할 선택은 [ISSUE_LIFECYCLE.md](ISSUE_LIFECYCLE.md)를 따른다.

아래 기준은 외부 디자인 시스템을 그대로 도입하라는 요구가 아니라 masterGantt의 설계 선택이다. 기존 shadcn/ui와 SVAR Core를 우선하고 스타일을 이유로 새 UI framework를 추가하지 않는다. 기존 화면을 일괄 수정하지 않고 승인된 이슈 범위부터 적용한다.

## Semantic UI token과 상태 규칙 (Issue #120)

기존 파란색 업무 UI와 시스템 한국어 폰트를 유지한다. palette primitive(`--background`, `--card`, `--foreground`, `--border`, `--primary`, `--ring`)를 직접 없애지 않고, 화면 구현은 의미를 드러내는 아래 alias를 우선 사용한다.

| 의미 | token | 사용 규칙 |
| --- | --- | --- |
| surface | `--surface-page/panel/subtle` | page, card/dialog, readonly/subtle 배경 |
| text | `--text-default/muted` | 기본/보조 텍스트. 상태 텍스트와 혼용하지 않음 |
| border | `--border-default/control` | 구조 경계와 입력 control 경계를 구분 |
| action | `--action-primary/*`, `--action-secondary/*`, `--action-selected/*` | primary action과 selected tab/row를 구분하고 selected를 색만으로 전달하지 않음 |
| focus | `--focus-ring/outline/offset` | keyboard focus는 밝은 panel과 3:1 이상 대비되는 공통 3px solid outline 계약. component가 별도 파란색 outline을 만들지 않음 |
| status | `--status-error/warning/info/success` 및 surface/border variant | 서로 다른 의미의 상태색을 하나로 합치지 않음 |
| disabled | `--state-disabled-opacity` | native disabled/aria 의미를 유지하고 opacity만 보조 표현으로 사용 |

기본 상태는 panel/default text/control border, hover는 기존 component interaction을 유지하되 의미 token을 사용한다. focus는 `--focus-outline`과 `--focus-offset`, selected는 `aria-selected` 등 의미와 `--action-selected`, disabled는 native `disabled`와 공통 opacity, error/success는 role/text와 status token을 함께 사용한다. readonly/output 일반 텍스트는 subtle surface에서도 4.5:1 이상을 유지한다. token 정리만으로 접근성 PASS를 주장하지 않고 실제 computed style의 텍스트 대비와 keyboard focus/인접 surface 대비를 측정한다.

밀도 예외: Task Editor는 Gantt 작업 밀도를 위해 기존 0.4~0.55rem control/card radius를 유지한다. Resource Catalog는 전역 `--radius`와 파생 radius로 정합화한다. Project Row Menu의 2.25rem trigger와 2.5rem menu item, Task Editor의 2.65~2.75rem control 높이는 기존 정보 밀도와 hit-area를 보존하므로 변경하지 않는다. 이 예외는 색상·focus 의미의 독자 정의를 허용하지 않는다.

#120 범위는 Task Editor, Resource Catalog Admin, Project Row Actions, Workspace Feedback 및 이들이 참조하는 전역 semantic token이다. #74/#75/#76/#96의 구조를 되돌리거나 전역 재스타일하지 않는다.

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
| UX-12 | 사용자의 작업 상태를 보존한다. | tab/modal 전환으로 scroll/tree/column/scale/selection을 불필요하게 초기화하지 않는가? |

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
