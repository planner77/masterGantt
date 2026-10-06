# 프로젝트 화면·삭제·하위 작업·알림·링크 복사

## Issue #430 — Cut 활성화와 Dependency 경계

Task Context Menu의 `Cut`과 Grid/Chart의 `Ctrl/Cmd+X`는 edit 가능, mutation lock 해제, 현재 scoped `viewRootTaskId` 자체가 아님이라는 기존 조건에 더해 **source subtree 경계를 넘는 Dependency가 없는 경우** 활성화한다. source와 모든 descendants 사이의 내부 Dependency는 Cut 비활성화 사유가 아니다.

- 내부→내부: Cut 활성, Paste 후 동일 Link 유지
- 외부→내부 / 내부→외부: Cut 비활성 및 keyboard Cut 거부
- 외부→외부: 해당 source의 Cut과 무관
- Copy는 #378/#384처럼 Dependency 유무와 무관하게 기존 정책 유지
- Delete는 여전히 subtree에 Link가 하나라도 있으면 제한하므로 Cut과 동일 capability로 합치지 않는다.

Cut clipboard가 존재할 때 Paste root trigger는 source boundary 규칙으로 판단한다. target/anchor가 별도의 Link endpoint라는 이유만으로 before/after Paste를 비활성화하지 않는다. `As child`가 linked leaf target의 Task→Summary 전환을 요구하면 기존 보호로 해당 submenu item은 비활성화한다. scoped view의 밖으로 이동하는 Paste, self/descendant Paste, stale clipboard와 revision 변경 폐기는 기존 계약을 유지한다.

Context Menu enabled/disabled, keyboard shortcut 및 실제 서버 `reparent`가 같은 boundary 의미를 사용해야 하며, disabled action을 실행한 것처럼 로컬 위치나 clipboard 상태를 변경하지 않는다.

## Issue #409 Relation Editor 식별자 검색/표시

Relation Editor의 관계 추가 검색은 `작업명 / 외부 ID / 작업 ID`를 한 입력에서 지원한다. Context Menu `Copy ID`로 복사한 canonical UUID(`taskId`)를 그대로 붙여넣어 후보를 찾을 수 있어야 한다.

후보와 선택 상태는 이름만 강조하고 보조 식별자는 `외부 ID: ...`, `작업 ID: ...`로 분리해 표시한다. 두 값을 모두 단순히 “ID”라고 표기하지 않는다. 긴 UUID/외부 ID는 wrap 가능해야 하며 390/768/1024/1440px에서 dialog/document overflow를 만들지 않는다. keyboard Enter/Space 선택, Escape popup close, focus restore, dirty/pending protection은 기존 Relation Editor 계약을 유지한다.

## Issue #367 Gantt 날짜 밀도와 우측 Timeline 확장

Project Gantt의 Day Header/timeline cell은 숫자-only 표현에 맞춰 36px를 사용하고 Week는 68px를 유지한다. 오른쪽 Chart 탐색은 최초 Task 범위에서 끝나지 않으며 공개 `scroll-chart.left`와 `resize-chart.width`를 기준으로 남은 timeline 폭이 작아지면 viewport 단위로 미래 scale을 확장한다. React `end` prop을 반복 변경하지 않고 고정 start/open end의 SVAR public resize path를 사용한다.

동적 확장은 UI 전용 상태다. Task/Link/Calendar, Scheduling 결과, revision, DB/API, edit permission을 변경하거나 서버 요청을 만들지 않는다. 사용자가 확보한 미래 end는 단조 증가시키며 canonical sync나 Day/Week 전환 뒤에도 이전 end 이상을 public resize path로 복구한다. range extension 자체가 Core store를 re-init하지 않으므로 Gantt/API instance, horizontal/vertical scroll, tree, column, filter, selection 상태를 불필요하게 초기화하지 않는다.

## Issue #390 작업 ID 복사

Grid 행과 Chart Task Bar의 작업 Context Menu에는 `Copy ID`를 조회성 utility action으로 제공한다. 복사 값은 canonical `ProjectTaskDto.taskId`이며 `externalId`는 이번 기능의 복사 대상이 아니다. Task, Summary, Milestone과 Dependency 연결 여부에 관계없이 표시하고 서버 mutation이 아니므로 readonly 및 mutation lock 상태에서도 사용할 수 있다.

`Copy ID`는 Task 자체를 복제하는 기존 단일/다중 `Copy`와 다른 기능이다. OS clipboard에 ID 문자열만 기록하며 application-level `TaskClipboard`의 mode/taskIds/revision과 선택 집합을 변경하지 않는다. 따라서 Task 선택/Copy 후 `Copy ID`를 사용해도 기존 Paste 대상이 유지되어야 하며 Project revision과 서버 데이터는 변경하지 않는다.

Clipboard 쓰기는 #364의 공통 호환 경로를 재사용한다. secure context에서 modern Clipboard API가 있으면 그 결과를 존중하고, modern API가 없는 HTTP/비보안 환경에서는 legacy copy를 시도한다. modern API가 명시적으로 권한 거부하거나 모든 자동 복사 경로가 실패하면 성공으로 처리하지 않고 수동 복사 Dialog와 재시도를 제공한다. 실제 쓰기 성공 뒤에만 Workspace notification을 표시한다.

## Issue #384 — 다중 선택 Copy/Paste

공개 Core Grid의 별도 56px 선택 열에 native checkbox를 제공해 이름 셀의 tree toggle·inline editor를 유지한다. 앱의 Project-scoped 선택 집합이 Copy 기준이다. 일반 행 클릭은 단일 선택, Ctrl/Cmd 클릭은 추가/해제, Shift는 같은 parent의 보이는 sibling 중 실제 filter match 범위이며 문맥용 ancestor는 자동 포함하지 않는다. 문맥용 Summary를 명시적으로 선택하는 기존 Copy는 유지한다. Checkbox 클릭·Space는 toggle, Shift checkbox도 range다. 범위가 유효하지 않으면 단일 선택과 이유를 표시한다. 선택 개수와 접힌 하위 숨김 수를 표시하고 checked·행 aria-selected·semantic token을 사용한다.

선택 행의 Context Menu는 집합을 유지하고 Copy는 전체에 적용한다. 선택 밖 행은 singleton으로 바꾸되 Paste target용 clipboard는 유지한다. 메뉴와 Ctrl/Cmd+C는 canonical 순서·ancestor 제거를 공통 적용한다. Summary는 서버가 전체 자손을 포함한다. collapse는 선택을 삭제하지 않는다. 실제 filter 조건/scope/ID 집합 변경은 direct selection을 prune하고 이전 Copy/Cut clipboard를 폐기한다. 배열 참조만 달라진 render는 경계 변경이 아니다.

선택 해제 버튼은 Grid region으로 focus를 복원한다. 메뉴/inline editor 밖 Escape는 선택만 해제하고 focus를 유지한다. Day·Week header의 Escape는 기존 Tooltip 닫기를 우선하며 Task 선택을 유지한다. checkbox의 Copy/Paste와 keyboard Context Menu를 지원하며 다른 input/editor/dialog/contenteditable shortcut은 가로채지 않는다. readonly/saving은 기존 Copy/Paste guard를 따른다. Core에는 공개 select-task로 단일 primary만 반영해 Cut/Move/Delete/Edit는 기존 단일 target을 유지한다. canonical sync 선택은 사용자 gesture로 처리하지 않으며 동일 Gantt instance/scale/scroll/collapse/columns 계약을 유지한다.
## Issue #331 Resource 관리 신규 생성 폼 레이아웃

아래는 #331 당시 inline 폼 해결 기록이다. 현재 #453부터 생성 폼은 compact dialog로 이동하며 독립 탭을 사용한다. 입력 containment·native label·API 보호 목적은 유지하고 과거 두 카드/grid 배치는 현행 계약으로 적용하지 않는다.

#331 당시 `/resources`의 신규 리소스 폼(이름/코드/개발자 등급/추가)과 신규 리소스 그룹 폼(이름/코드/추가)은 서로 다른 field count를 가지므로 동일한 고정 4열 최소폭 계약을 공유하지 않는다. 각 폼은 전용 grid modifier를 사용하고 데이터 입력 track은 `minmax(0, ...)`로 shrink 가능하게 하며 label/grid item에는 `min-width: 0`, input/select에는 가용 track을 넘지 않는 width/max-width/box-sizing 계약을 적용한다. Action 버튼은 자신의 grid cell 안에서만 배치한다.

당시에는 두 카드의 desktop 2열 배치와 820px 이하 1열 전환을 유지했다. #453에서는 이 배치를 독립 탭으로 대체한다. 390/768/1024/1440px에서 리소스·그룹 생성 폼의 direct child bounding box가 서로 겹치지 않고 form/document 밖으로 수평 침범하지 않아야 한다. DOM 순서와 native label/input/select/button을 유지해 keyboard Tab 순서와 focus-visible을 바꾸지 않는다. Resource Catalog API, 관리자 session, catalog revision, `If-Match`, stale recovery 및 개발자 등급 값 계약은 변경하지 않는다.

## Issue #375 Summary Task bar 시각 계층

일정이 계산된 Summary는 일반 Task와 같은 SVAR root bar geometry를 유지하되, 실제 색상/border/progress가 보이는 visual body만 root 높이의 **60%**로 줄여 행 중앙에 표시한다. root의 x/width/top/height와 link marker 중심은 변경하지 않아 #142의 날짜 셀 전체 폭 정렬과 기존 click/double-click/right-click/drag hit area를 보존한다. Summary visual body는 `.wx-summary::before`, progress는 같은 20% 상·하 inset을 사용하며 hover/selected/focus/critical 상태는 얇은 body에 표시한다.

일반 Task와 Milestone은 이번 규칙의 적용 대상이 아니다. #345의 일정 없는 Summary는 계속 Grid row만 존재하고 Chart bar를 만들지 않는다. Day/Week, fullscreen, readonly/edit 전환으로 상대 두께가 달라지지 않으며 Gantt/API instance를 remount하지 않는다. 이 규칙은 presentation-only이며 Task/Summary 날짜·기간·진척 계산, Dependency, Calendar, API/DB/revision/If-Match 계약을 변경하지 않는다.

## Issue #373 / #399 Summary 하위 WBS를 Workspace 범위 탭으로 열기

하위 child가 있는 Summary의 Grid/Chart Context Menu `최상위로 열기`는 #399부터 새 browser tab/window를 만들지 않고 현재 Project의 일정 View 내부 WBS 범위 탭을 생성·활성화한다. 일반 Task/Milestone/빈 Summary에는 진입 명령을 표시하지 않으며 accessible name은 `최상위로 열기 (작업공간 탭)`이다. #72의 mouse/keyboard Context Menu 계약을 유지한다.

범위 탭은 `[전체 프로젝트] [Summary A ×] [Summary B ×]` 구조다. 전체 프로젝트는 첫 번째 고정/비삭제 탭이다. Summary 탭은 task public ID로 식별하고 canonical 이름을 label로 사용하며 동일 Summary 재진입은 중복 생성 없이 기존 탭을 활성화한다. active Summary 닫기는 next → previous → 전체 프로젝트 순으로 fallback한다. ArrowLeft/ArrowRight/Home/End automatic activation, Summary 탭 Delete 및 개별 닫기 command를 제공한다. 한 행 `overflow-x:auto` / `overflow-y:hidden`을 사용하고 active/focus 탭은 `inline: nearest`로 노출한다.

기존 `/projects/{publicId}?rootTask={summaryTaskId}` deep link는 외부 공유·reload·직접 진입 계약으로 유지한다. 직접 진입하면 전체 프로젝트와 대상 Summary 내부 탭을 구성해 Summary를 active로 만든다. 내부 scope 전환은 History replace semantics로 `rootTask`만 set/delete하여 full reload와 불필요한 browser history 증가를 만들지 않는다. password/session/internal DB ID는 URL에 넣지 않는다. 열린 탭 집합은 지속하지 않으므로 reload 후 URL의 active scope만 복원한다.

표시 범위는 #373과 동일하게 root Summary + 모든 descendants다. ancestor/sibling/다른 branch는 숨기되 삭제하거나 별도 Project로 복제하지 않는다. 전체 canonical Project snapshot을 유지한 채 scope와 search/filter의 교집합을 `visibleTaskIds`로 전달하고 SVAR 공개 `filter-tasks`를 재사용한다. root의 canonical parent는 바꾸지 않고 adapter에서만 SVAR `parent=0`으로 투영하며 Task/Relation Editor에는 전체 canonical tasks/links를 전달해 scope 밖 Dependency를 보존한다.

범위 탭마다 Gantt를 새로 만들지 않는다. 하나의 ProjectGantt instance와 canonical snapshot을 공유하고 active `viewRootTaskId`와 visible set만 변경한다. scale/column/fullscreen 및 #367의 동적 timeline end 등 project-wide 상태를 유지하고 search/filter/quick-view는 scope별 in-memory state로 복원한다. scope 변경은 기존 selection/clipboard boundary 계약을 따르며 Gantt full remount를 상태 초기화 수단으로 사용하지 않는다.

scoped hierarchy guard도 #373을 유지한다. scope 자체를 read-only 신호로 사용하지 않는다. #418부터 native Grid의 **Header `+`는 현재 범위의 최상위 작업 추가**이며 active Summary root의 immediate child를 만든다. 행 `+`는 scoped root/descendant Task·Summary의 Child add로 취급하고 일반 Task의 첫 child는 기존 Summary 전환 계약을 재사용한다. Header에는 `범위 최상위 작업 추가` accessible name/tooltip을 제공하고 Header/Row 모두 같은 scope-relative resolver로 `aria-disabled`와 실제 mutation target을 결정한다. Milestone 행 `+`, scope 밖 target, 가상 root Above/Below, root 직계 child Outdent 및 `before/after`처럼 결과가 scope 밖이거나 hierarchy상 무효인 경로는 공통 guard로 거부한다. Context Menu `Add → Child task / 요약 작업 추가`도 동일한 subtree 내부 판정을 따른다. 성공 add는 canonical Core sync와 `filter-tasks`를 직렬화하며 mutation 전후 scroll/focus를 복원해 row 전체가 순간적으로 사라지거나 scope 탭/ProjectGantt instance가 바뀌지 않아야 한다.

root가 빈 Summary가 되어도 탭은 유지한다. root 삭제/non-Summary 전환은 다른 scope로 silent fallback하지 않고 invalid 표시, scoped Gantt 숨김, 전체 프로젝트 복귀/탭 닫기 경로를 제공한다.

동일 화면의 내부 scope들은 같은 React canonical state를 공유하므로 한 scope의 성공 mutation이 즉시 다른 내부 탭에도 반영된다. 사용자가 deep link를 실제 별도 browser tab에서 직접 열 수 있으므로 #373의 storage revision announcement와 canonical GET 기반 cross-tab burst/loading freshness는 유지한다.

상위 `일정 / 리소스 / 물류 구성` peer tabs는 scoped schedule에서도 항상 유지한다. WBS 범위 탭은 일정 View의 하위 navigation일 뿐 Resource/Logistics를 subtree로 제한하지 않는다. Logistics→Schedule target filter는 전체 프로젝트 scope를 활성화한 뒤 적용한다. DB/API/Scheduling/Security 계약은 변경하지 않는다.

## Issue #345 빈 Summary 현재 정책

Summary는 자식이 없어도 유지되는 WBS 컨테이너다. 마지막 child 삭제·이동은 기존 부모를 지우거나 Task로 바꾸지 않는다. 아래 과거 Issue 기록의 빈 Summary 금지·마지막 child 거부 부분은 이 정책으로 대체한다. 권한·revision·Dependency 제약과 #344 실패 복구 계약은 유지한다.

편집 화면의 일정 도구 모음 `요약 작업 추가`는 Root에 `새 요약 작업`을 날짜 입력 없이 즉시 생성한다. 기존 Grid 이름 편집으로 이름을 바꾼다. Context Menu의 Add → `요약 작업 추가`는 선택 작업 하위에 생성하며, Task 부모는 기존 명시적 전환 계약을 따른다. 일반 `+`의 Task 추가 의미는 유지한다. Milestone에는 child를 추가할 수 없다.

자식 0개는 `하위 작업 없음`, 빈 Summary만 자손에 있으면 `일정 있는 하위 작업 없음`으로 설명한다. 날짜·기간·진척은 미산정(`null`/`—`)이며 완료로 취급하지 않는다. 전체 미산정 트리는 작업 없음과 구분한다. 날짜·기간·진척 필터에서는 미산정 값을 직접 매칭하지 않고 기존 조상 context 정책을 유지한다. 이름 검색·유형 검색은 정상 지원한다.

Core 표현과 Renderer 좌표의 분리, 시험 결과는 [PRO_FEATURE_MATRIX.md](PRO_FEATURE_MATRIX.md#issue-345-빈-summary-core-273-표현)를 따른다. 첫/마지막 child 변경은 동일 Core 인스턴스에서 동기화하며 Tree·scale·스크롤 상태를 보존한다.

## Issue #330 물류 유형 관리자 compact/filter 계약

`/logistics-admin`의 설비 유형/시스템 유형 전환은 동일 높이의 버튼 그룹과 `aria-pressed` 상태를 사용하며 선택 상태가 바뀌어도 layout shift를 만들지 않는다. 목록 상태 필터는 `전체 / 활성 / 비활성` 세 값이며 기본값은 전체다. 필터는 이미 조회한 catalog snapshot에만 적용하고 API 재조회, mutation, catalog revision 증가를 만들지 않으며 설비/시스템 전환 뒤에도 현재 필터를 유지한다.

추가 폼은 유형명/코드/정렬/유형 추가를 content-aware grid로 배치하고 각 grid item/control의 intrinsic width가 인접 control을 침범하지 않게 한다. 가용 폭이 줄면 2열, 이후 1열로 의미 단위 reflow하며 390/768/1024/1440px에서 document-level unintended horizontal overflow를 만들지 않는다. 목록은 header/body 구분과 기존 조작 가능한 action 크기를 유지한 채 row 상하 padding을 줄인다. 필터 결과 0건은 현재 조건에 맞는 empty state로 표시한다.

관리자 로그인/로그아웃/비밀번호 변경, catalog CRUD, 사용 건수, inactive 참조, session/Origin/If-Match/revision/stale 처리 계약은 변경하지 않는다. 이 화면은 SVAR Gantt 내부 UI가 아니므로 SVAR API/PRO 기능을 추가하지 않는다.

## Issue #285 공정 추가 모달 코드 자동 생성

물류 구성 > 공정 관리의 **공정 추가** 모달은 사용자에게 기술 식별자인 공정 코드를 입력받지 않는다. Create mode의 첫 focus는 공정명이며 공정명만 필수로 저장 가능하다. 브라우저 POST payload에는 `code`를 만들거나 포함하지 않고 서버 canonical 응답의 자동 생성 code를 그대로 표시한다.

공정 수정 모달은 기존 code 편집 계약을 유지한다. 기존 공정 row, 검색·표시·Excel/복사/템플릿의 code 소비 계약과 DB의 non-empty/unique invariant도 유지한다. Escape 취소, trigger focus 복원, readonly에서 추가 action 비노출, busy 중 중복 제출 차단은 기존 `WorkspaceDialog` 계약을 그대로 따른다.

## Issue #279 물류 구성 서브탭 overflow 계약

Project Workspace의 물류 구성 하위 탐색은 `KPI 대시보드 / 공정 관리 / 설비 관리 / 물류 시스템 / 제어·조율 관계` 5개 탭을 한 행으로 유지한다. 좁은 viewport에서 폭이 부족하면 tablist 내부의 수평 스크롤을 허용하지만 세로 방향은 scroll container가 되지 않는다. 수평 overflow와 교차축 overflow를 명시적으로 분리하고, active indicator와 focus-visible이 잘리지 않도록 탭 높이를 음수 margin에 의존하지 않는다.

기존 `tablist/tab/tabpanel`, `aria-selected`, `aria-controls`, roving `tabIndex`와 ArrowLeft/ArrowRight/Home/End 키보드 계약을 유지한다. 키보드로 이동한 탭이 수평 viewport 밖에 있으면 해당 탭만 `inline: nearest` 기준으로 보이게 하며, 이 탐색은 API mutation, Project revision 변경 또는 Gantt 재마운트를 만들지 않는다.

반응형 검증 기준은 390/768/1024/1440px이다. 각 폭에서 tablist의 `scrollHeight <= clientHeight`, computed `overflow-y: hidden`, active/focus 탭의 가시성, document-level unintended overflow 부재를 확인한다. 1024/1440px처럼 충분한 폭에서는 불필요한 수평 overflow가 없어야 한다. Linux overlay scrollbar에서 시각적으로 보이지 않는 것만으로 세로 overflow 부재를 판정하지 않고 geometry를 함께 측정한다.


## Issue #269 프로젝트 복사·템플릿 저장 복구

두 대화상자는 열 때 기존 원본의 준비 상태를 해제하고 현재 조회가 성공해야 제출할 수 있다. 조회 실패는 정상 원본으로 취급하지 않으며 다시 시도 버튼을 제공한다. 닫기·다시 열기·새 조회 이후 도착한 이전 응답은 원본·인증·오류 상태를 덮어쓰지 않는다. 새로 연 대화상자의 최초 성공 조회만 기본값을 채우며 복구 조회에서는 이름·담당자·설명·진척률 초기화 등의 일반 초안을 보존한다.

저장 401은 원본 편집 비밀번호 입력을 다시 표시하고 focus를 돌린다. 비밀번호는 요청 완료/실패와 닫기 시 지우며 URL·스토리지에 보관하지 않는다. 412는 이전 원본을 제출 불가능한 상태로 바꾸고 `최신 원본 확인`을 제공한다. 이 동작은 GET으로 요약과 revision을 갱신하며 자동 저장하지 않는다. 사용자가 갱신된 원본을 확인하고 다시 제출해야 새 If-Match를 사용한다. 복사는 제출 전 최신 조회에서도 확인한 revision이 바뀌었으면 POST 없이 같은 확인 흐름으로 돌아간다.

인증 요청부터 최종 mutation 응답까지 중복 제출·닫기·Escape를 차단한다. 읽기 조회 중에는 닫을 수 있으며 취소한 조회의 응답을 무시한다. native WorkspaceDialog의 키보드 경계와 호출 위치 focus 복원, 읽기 전용 진입의 원본 비밀번호 확인을 유지한다. 더보기 메뉴의 전폭 버튼 스타일은 직접 메뉴 항목에만 적용하여 내부 Dialog의 닫기 버튼이 제목 공간을 밀어내지 않도록 한다. 서버 인증·Origin·revision 및 원자 복사/템플릿 계약은 변경하지 않는다.

## Issue #268 리소스 관리자 실패·재조회 복구

리소스/그룹 추가는 성공한 canonical 응답을 확인한 경우에만 해당 이름·코드를 지운다. 실패·중복 요청 방어로 실행하지 않은 경우는 입력을 유지하며 다른 저장 단위·검색·구성원 선택 초안을 초기화하지 않는다. #453의 생성 dialog는 하나만 열 수 있으며 다른 단위 보존 검증은 구성원 초안과 교차한다. 목록 조회 중·실패와 정상 결과를 구분하고, 최신 목록을 확인하지 못하면 이전 결과임을 표시하며 revision을 사용하는 mutation을 잠근다. 재시도는 GET만 수행하고 저장은 사용자가 명시적으로 다시 실행한다.

401은 관리자 화면을 해제하고 재로그인 경로를 제공하되 일반 초안은 페이지 메모리에 보존한다. 로그인·비밀번호 변경의 민감 입력은 네트워크 실패를 포함한 요청 종료 경로에서 지운다. 412는 초안을 유지한 채 최신 목록을 조회하고 다시 확인한 후 저장하도록 안내하며 자동 mutation 재전송은 하지 않는다. 결과를 확인할 수 없는 mutation도 목록 재확인 전 재저장을 막는다.

새로고침으로 구성원 초안을 조용히 바꾸지 않는다. 선택 그룹이 없어졌으면 해당 저장을 차단하고 새 선택을 요구한다. 서버 구성원과 초안이 다르면 검토할 수 있게 알린다. 성공 안내는 오류와 구분하여 status로 표시한다. 기존 검색/선택 계약과 서버 인증·Origin·revision 검증은 유지한다. 비밀번호 변경은 catalog revision을 소비하지 않는 기존 인증 경로를 따른다. 390px에서는 관리자 action row를 버튼 3개 구조로 유지하고 긴 리소스 이름은 강제 줄바꿈하여 document-level horizontal overflow를 만들지 않는다.

## Issue #363 빈 프로젝트 생성 Form semantic grouping / content-aware width 계약

`/projects/new`의 **빈 프로젝트 만들기**는 #282의 wide page/compact top gutter를 유지하면서, 입력을 outer 12-column auto-placement에 직접 섞지 않고 의미 단위 section으로 조직한다. 시각적 구분은 별도 card를 중첩하지 않고 heading, spacing, hairline divider를 사용한다.

- **기본 정보**: 프로젝트 이름 / 소유자 / 상태. Wide desktop에서는 이름을 가장 넓게, 소유자를 중간 폭, 상태를 enum 길이에 맞는 compact 폭으로 배치한다. 1024px 이하에서는 이름·소유자 중심 2열 후 상태가 다음 행으로 reflow한다.
- **프로젝트 분류**: 사업부 / 제품 / 사업장·법인을 하나의 full-width semantic group으로 취급한다. #289의 `.project-master-field-grid`는 outer form의 좁은 auto-placement cell에 들어가지 않고, 긴 catalog label을 고려한 responsive auto-fit grid를 사용한다.
- **설명**: 긴 텍스트 입력용 주요 폭을 사용하며 짧은 select/password와 같은 폭으로 제한하지 않는다.
- **편집 권한**: 편집 비밀번호는 상태/분류와 분리하고 최대 12자 입력과 helper text에 맞는 compact/medium 폭을 사용한다.

390/768/1024/1440/wide desktop에서 section 순서와 DOM/tab order를 일치시키고 document-level unintended horizontal overflow를 만들지 않는다. 좁은 폭에서는 각 semantic group 내부가 1열로 reflow한다. 기존 label, `aria-describedby`, `aria-invalid`, validation summary focus와 생성/tab draft 계약은 유지한다.

Project 생성 API/DB, 기준정보 catalog, Owner 의미, password/session/Origin/rate-limit, Template 생성 계약은 변경하지 않는다. SVAR Gantt Editor를 Project Create form에 도입하지 않는다.

## Issue #282 프로젝트 만들기 Wide / Responsive Form 계약

`/projects/new`는 일반 문서형 화면의 75rem cap 대신 Project List/Workspace와 같은 page-specific wide shell을 사용한다. 사이트 헤더 아래 전역 `clamp(2.25rem, 6vw, 5rem)` 상단 padding을 그대로 적용하지 않고, 생성 작업을 바로 시작할 수 있는 compact top gutter를 사용한다. Heading의 읽기 폭과 form/content의 작업 폭은 분리하며 tab underline, blank form, template selection/form은 같은 좌측 정렬과 가용 폭을 공유한다.

공통 `.project-form` 계약은 변경하지 않는다. Project Create 내부에서만 다음 responsive grid를 적용한다.

- Wide desktop: blank form은 프로젝트명/소유자를 같은 행에 두고 설명을 넓게, 상태/비밀번호를 compact column으로 배치한다. Template instantiate form은 이름/소유자/기준일/비밀번호를 한 행의 content-aware span으로 배치하고 설명과 오류/action은 전체 폭을 사용한다.
- 768~1024px: 두 열 중심으로 reflow하며 blank form의 설명과 template 설명은 전체 폭을 사용한다.
- 704px 이하: logical DOM/tab order를 유지한 한 열 stack으로 전환한다. Submit/action은 좁은 화면에서 가용 폭을 사용한다.
- 320/390/768/1024/1440/1600px에서 document-level horizontal overflow가 없어야 하며, label/error/helper text와 focus-visible이 clipping되지 않아야 한다.

기존 빈 프로젝트/템플릿 생성 API, validation, edit password 보안, draft 보존, tab WAI-ARIA/Arrow/Home/End, template relative schedule 계산과 성공 후 navigation 계약은 변경하지 않는다. Layout 검증은 `tests/e2e/project-create-layout.spec.ts`의 geometry assertion으로 수행하고 기존 생성/초안/템플릿 E2E와 함께 회귀 검증한다.

## Issue #267 물류 대시보드 조회·탭 상태

조건 변경이나 새로고침 중에는 이전 KPI와 작업 이동을 현재 결과처럼 사용하지 않는다. 최신 조건·revision 조회 성공 후에만 결과를 표시하며 실패 시 오류와 재시도를 제공한다. 임박 기간은 1~90 정수만 조회하고 잘못된 입력은 필드에 안내한다. 공정·설비·시스템 세부 현황의 탭 의미와 방향키/Home/End 탐색을 제공한다. 기준일의 서버 timezone 의미와 Gantt 상태 보존은 [대시보드 계약](LOGISTICS_DASHBOARD.md)을 따른다.

## Issue #263 물류 담당자 조회 실패 복구

설비·시스템 담당자 dialog는 리소스 후보 조회 중/실패/성공을 구분한다. 최신 목록 확인 전에는 역할 추가·제거·주 담당자 변경·저장을 잠그고 실패에는 다시 시도를 제공한다. 기존 담당자는 물류 snapshot의 이름·코드를 표시하며 조회 실패를 담당자 0명으로 표현하지 않는다. 창을 연 뒤 Project revision이 바뀌면 충돌을 알리고 취소 후 최신 대상에서 다시 열도록 안내하며, 이전 초안을 새 revision으로 저장하지 않는다. 재시도는 조회만 수행하고 역할 교체 mutation은 명시적 저장에만 실행한다. 권한·Project revision·서버 검증 계약은 변경하지 않는다.

> **Issue #8 전송 정책:** production 기본값은 HTTPS다. `ALLOW_INSECURE_HTTP=true`와 canonical HTTP `APP_BASE_URL`을 함께 설정한 내부망은 production HTTP도 지원한다. 시작·readiness·공유 URL·모든 인증 경로는 같은 정책을 사용한다. `SESSION_COOKIE_SECURE`는 미사용 예약값이며 제거했다. HTTP에서는 `mastergantt_edit`, HTTPS production에서는 `__Host-mastergantt_edit; Secure`를 사용하고 HttpOnly·SameSite=Strict·Path=/·TTL 및 Domain 미설정을 유지한다. 아래 과거 검증 이력의 HTTPS-only 표현은 당시 기준이다. 현재 운영·전환 절차는 [HTTP_OPERATION](HTTP_OPERATION.md)을 따른다.


관련 Issue: #9, #10, #11, #18, #21 / PR: [#23](https://github.com/planner77/masterGantt/pull/23)

## 범위와 요구사항 변경

이번 사용자 요청은 위 다섯 이슈의 구현과 원격 CI 실패 분석·수정까지 승인한다. 과거 이슈 본문의 “이슈 등록만 수행” 기록은 이번 구현 요청에 적용하지 않는다. main 병합, GHCR 게시, Semantic Version 릴리스 및 운영 배포는 별도 범위다.

이 문서는 [요구사항](REQUIREMENTS.md), [아키텍처](ARCHITECTURE.md), [API](API.md), [보안](SECURITY.md), [테스트 계획](TEST_PLAN.md)의 해당 UX 변경에 대한 보충 계약이다. 과거 W24의 화면·확인 창 설명은 당시 검증 이력으로 보존하며 아래 변경이 현재 계약이다.

| Issue | 구현 계약 | 보존하는 경계 |
| --- | --- | --- |
| #9 | 프로젝트명 아래 Revision/시간대/휴일/작업/연결 정보와 펼침 설정 패널을 제거한다. 기존 프로젝트 정보·비밀번호 변경·편집 종료 기능은 헤더의 설정 버튼과 별도 모달에 보존한다. | 데이터와 revision은 삭제하지 않는다. 설정 열기·닫기는 Gantt를 재마운트하지 않는다. |
| #10 | 프로젝트 목록에 삭제 버튼을 항상 표시한다. 클릭 시 최신 이름/revision을 조회하고 파괴적 삭제 경고와 비밀번호 입력 창을 표시한다. 기존 편집 세션이 있어도 새로 입력한 비밀번호 확인이 성공해야 DELETE를 전송한다. | 기존 session/Origin/If-Match 서버 검증, rate limit, transaction, cascade와 rollback을 유지한다. |
| #11 | Grid 행 +의 첫 하위 작업은 확인 팝업 없이 추가한다. 일반 leaf 부모에는 기존 `convertParentToSummary: true`를 명시한다. | 마일스톤 부모 금지, 근무일 보정, 상위 일정·진척 집계, 중복 mutation 차단을 유지한다. 빈 Summary는 #345 현재 정책을 따른다. |
| #18 | 정상 결과는 5초 하단 overlay Toast, 오류는 우측 상단 알림함과 복사 가능한 내용으로 제공한다. | 알림 때문에 화면 공간·scroll·focus·Gantt 인스턴스를 변경하지 않는다. 기존 명시적 오류 복구는 유지한다. |
| #21 | 목록 행과 상세 헤더에 동일한 공용 링크 복사 버튼을 제공한다. 읽기 전용에서도 사용한다. | 서버의 `APP_BASE_URL` 검증과 publicId 직접 접근·인증을 유지한다. 복사는 navigation/DB mutation/revision 변경을 수행하지 않는다. |

#18에 있었던 부모 전환 확인 유지 조건은 이번에 함께 승인된 #11로 대체한다. 서버의 명시적 요약 전환 옵션을 제거하거나 모든 요청을 무조건 승인하는 변경은 아니다.

## Issue #75 프로젝트 목록 Wide Table / Row Action 계약

프로젝트 목록은 일반 Form용 `.main-content` 75rem cap을 그대로 사용하지 않는다. 목록 route에만 명시적인 wide modifier를 적용하여 responsive gutter를 유지하면서 최대 100rem까지 사용한다. Project 상세/Gantt와 다른 Form route의 기존 폭 계약은 변경하지 않는다.

목록은 native `table/thead/th/tbody/td` semantics를 유지한다. 프로젝트명은 상세 화면으로 이동하는 primary Link이며, 행 전체를 click target으로 만들지 않는다. Header는 body와 다른 subtle background, divider와 typography로 구분하고 프로젝트명 → owner/description → 날짜 metadata → action 순으로 시각 우선순위를 둔다. Description은 Wide 화면에서 가장 많은 가변 폭을 받으며 작은 화면에서는 table wrapper 내부 horizontal scroll로 접근한다.

행 작업은 항상 보이는 More 버튼 하나에서 제공한다. 메뉴 항목은 다음 순서와 의미를 갖는다.

- `프로젝트 복사`: native Link, 기존 `?copy=1` 진입 계약 유지
- `링크 복사`: native Button, 기존 APP_BASE_URL/clipboard/fallback 계약 유지
- `삭제`: destructive Button, 기존 최신 revision 재조회 → 비밀번호 재인증 → If-Match DELETE 계약 유지

메뉴 trigger에는 프로젝트명을 포함한 accessible name을 사용한다. 열릴 때 첫 항목으로 focus를 이동하고 Arrow/Home/End와 Escape를 지원한다. Escape 및 command 완료 뒤 focus는 More trigger로 복귀한다. 메뉴는 body portal + fixed positioning으로 table overflow에 잘리지 않게 하고 viewport gutter 안으로 보정한다. clipboard fallback dialog가 필요한 경우 dialog가 유지되도록 메뉴 컴포넌트 수명을 보존한다.

검증 기준은 390/768/1024/1440px과 Wide Desktop이며 Desktop에서는 불필요한 document-level horizontal overflow가 없어야 한다. API schema, DB schema, 목록 정렬, Project 권한 모델은 변경하지 않는다.

## 구조와 UI 정책

`WorkspaceNotifications`는 Gantt 복구 key 밖에 위치한다. 프로젝트 workspace는 publicId를 key로 사용하여 다른 프로젝트에 이전 오류를 섞지 않는다. 목록은 별도의 알림 범위를 가진다. 서버 영구 저장, localStorage, push notification 권한은 사용하지 않는다.

`notificationReducer`는 성공/안내/오류를 호출 지점에서 명시적으로 분류한다. 문구 문자열로 심각도를 추정하지 않는다. Toast는 가장 최근 한 건을 표시하며 5초 후 사라진다. 이전 Toast 타이머가 새 Toast를 지우지 않도록 notice ID를 검사한다. 오류는 Toast가 사라지거나 후속 성공이 발생해도 알림함에 남는다.

오류는 최신순 최대 50건이다. 한도를 넘은 이전 항목의 제외 건수를 표시한다. 패널을 열면 표시 중인 항목을 읽음 처리하고 열린 동안 도착한 오류도 읽음으로 처리한다. “읽은 알림 지우기”는 명시적 사용자 동작이다. 이 보관 상한·읽음 시점은 구현 정책이며 사용자가 숫자를 지정한 것으로 표현하지 않는다.

비근무일 시작의 다음 근무일 보정은 성공 Toast의 부가 안내다. 권한/검증/충돌/네트워크/서버/화면 복구 실패는 보관하는 오류다. 412 후 canonical 재조회에 실패하면 성공적으로 재조회했다고 알리지 않는다. Task mutation 실패의 canonical 재조회가 실패해도 같은 Gantt 인스턴스에 마지막 확정 일정을 다시 동기화한다(#344). 기존 Gantt reset은 공개 SVAR 동기화 자체가 예외를 낸 최후 복구 경로에만 사용한다.

`WorkspaceDialog`는 native dialog의 top layer를 사용한다. 설정 모달 안에서도 안내가 보이도록 해당 dialog 안에 live region을 둔다. 알림함에는 자체 복사 안내 live region을 사용한다. Escape/닫기 후 원래 버튼으로 `preventScroll` focus를 복귀한다. 전송 중인 파괴적 동작은 중복 제출과 닫기를 차단한다. 좁은 화면과 긴 내용은 최대 viewport 크기 및 내부 스크롤/줄바꿈으로 처리한다.

## 삭제 API 흐름과 오류

```text
목록 삭제 클릭
→ GET /api/projects/{publicId} (표시할 최신 이름과 revision)
→ 경고·비밀번호 모달
→ 사용자 제출
→ POST /api/projects/{publicId}/edit-sessions
→ 204인 경우에만 DELETE /api/projects/{publicId} + If-Match
→ 204 후 목록에서 제거
```

입력한 비밀번호는 전송 시작/실패/취소 시 입력 상태에서 제거한다. 원문을 URL·알림·clipboard·로그에 넣지 않는다. 잘못된 비밀번호, rate limit 또는 인증 오류에서는 DELETE를 호출하지 않는다. 412이면 삭제를 자동 재시도하지 않고 사용자가 최신 정보부터 다시 확인하도록 한다. 네트워크 실패로 삭제 결과가 불명확하면 성공으로 단정하지 않는다. 새 API나 DB migration은 추가하지 않는다. 삭제 UI에서의 재인증 정책이며 서버 DELETE 자체는 기존 edit session 계약을 유지한다.

## 링크 URL과 clipboard 보안

공용 `buildProjectShareUrl`은 신뢰한 배포 설정을 기존 `parseApplicationBaseUrl`로 검사하고 허용한 publicId만 결합한다. 서버 페이지는 완성 URL 또는 null만 client에 전달한다. 요청 Host/forwarded header, `window.location.href`, 이름, query/hash와 비밀값을 URL 생성 입력으로 사용하지 않는다. 잘못되거나 없는 APP_BASE_URL은 임의의 origin으로 대체하지 않는다. 끝 슬래시·스킴·포트·subpath 정책은 기존 설정 검증을 그대로 따른다.

복사는 명시적인 사용자 클릭 안에서 수행한다. secure context에서 `navigator.clipboard.writeText`가 제공되면 이를 우선 사용하고, 해당 API가 없거나 insecure HTTP여서 사용할 수 없을 때에만 같은 click activation 안에서 `document.execCommand("copy")` legacy 호환 경로를 시도한다. modern Clipboard API가 존재하지만 권한 거부/reject된 경우에는 legacy 명령으로 우회하지 않는다. 실제 복사가 확인된 경우에만 성공 안내를 내며, 두 자동 복사 경로가 모두 불가능하거나 modern API가 거부되면 읽기 전용 URL과 수동 복사 안내, 다시 시도 버튼이 있는 모달을 연다. 앱은 clipboard 읽기 권한을 요청하지 않는다. 알림 복사는 기존 정책대로 사용자 클릭으로만 실행하며 선택 가능한 읽기 전용 텍스트를 항상 제공한다.

알림에는 코드에 정의된 안전한 메시지, locale 발생 시각, 작업 종류, 프로젝트 publicId 범위만 사용한다. 서버 메타데이터는 허용한 error code 및 UUID 형식 requestId만 포함한다. 서버가 제공하지 않은 코드를 만들어 넣지 않는다. 원문 응답·예외 message·stack·SQL·Password/PAT/Cookie/Session은 표시/복사하지 않는다.

HTTP 사내 주소에서는 브라우저의 secure-context 정책에 따라 modern Clipboard API를 사용할 수 없을 수 있다. 이 경우 같은 사용자 동작 안에서 legacy copy 호환 경로를 먼저 시도하고, 브라우저가 이를 지원하지 않으면 수동 복사를 정상 지원 경로로 사용한다. modern API의 명시적 권한 거부는 legacy로 우회하지 않는다. localhost는 링크를 여는 장치 자신을 가리키므로 다른 장치에 공유할 배포 주소로 사용할 수 없다. 이 기능은 HTTPS/HTTP 운영 지원, 인터넷 공개, 방화벽·네트워크 접근권한 또는 subpath 배포를 새로 추가하지 않는다.

## 보충 테스트 계획과 추적

[GitHub-first 검증 정책](REMOTE_VALIDATION.md)을 따른다. 기존 로컬 테스트 실행 보류는 유지하고, 이번에 승인된 원격 Actions로 전체 회귀를 수행한다. 문서와 코드 정적 검토를 실행 PASS로 표시하지 않는다.

| 검증 항목 | 실행 가능한 테스트 |
| --- | --- |
| 잘못된 설정·스킴·포트·슬래시·publicId·query/hash/secret 제외 | `tests/server/project-share-url.test.ts` |
| 분류·오류 보관 상한·읽음·타이머 ID·안전한 메타데이터·복사 형식 | `tests/features/workspace-notification-state.test.ts` |
| 실제 Chromium clipboard 쓰기, 목록/상세 일치, 비밀번호 오입력 후 DELETE 0회, 정상 DELETE 1회, 삭제 후 404 | `tests/e2e/project-create-and-read.spec.ts` |
| 서로 다른 두 프로젝트의 실제 링크 구분, rename 이후 링크 유지, 복사 시 mutation/revision 불변, 취소 후 비밀번호 삭제, 같은 세션 새 탭/새 세션 직접 Readonly | `tests/e2e/project-links-persistence.spec.ts` |
| 5초 Toast, 오류 직후 성공에도 오류 보존, 미확인/읽음, Gantt DOM·geometry·scroll, 프로젝트 격리, 390px 화면 | `tests/e2e/project-notifications.spec.ts` |
| Clipboard API 없음/insecure HTTP의 legacy 자동 복사, modern 권한 거부 시 legacy 우회 금지·수동 복사·재시도와 키보드/focus | 같은 notification spec. 호환/거부·복구 분기는 mock, 실제 modern 쓰기는 위 persistence spec과 구분 |
| 실제 production HTTP insecure origin의 legacy 자동 복사 | `tests/transport/production-transport.spec.ts`: `plain.gantt.test`, `isSecureContext=false`, modern API 없음, real `execCommand("copy")`/copy event로 canonical URL 검증 |
| 모달 top layer 안의 오류 안내와 닫은 뒤 알림함 보존 | `tests/e2e/project-modal-feedback.spec.ts` |
| 팝업 없는 첫 하위 추가·지연/연속/중복 추가, 401/412/검증/500/network/canonical 복구 | `tests/e2e/project-gantt-stability.spec.ts` |
| 실제 DB 지속성·부모 집계·편집기 초안·권한·날짜·레이아웃 | 기존 task-persistence, task-editor*, edit-authorization, workspace-layout spec |

새 테스트도 기존 isolated application fixture를 사용한다. 테스트별 서버/SQLite 격리는 유지하고 production 생성 제한 5회/시간을 완화하지 않는다. skip/임의 재시도/timeout 확대를 통과 수단으로 사용하지 않는다.

## 확인한 CI 실패와 조치

[CI #44](https://github.com/planner77/masterGantt/actions/runs/34762934120), head `e9b23d942a9d168ac439049efac746145feacd7b`: quality와 Docker는 PASS, Chromium은 31건 중 30 PASS/1 FAIL이었다. 실패는 `project-edit-authorization.spec.ts:75`의 전역 `getByRole('status')`가 설정 모달 내 live region과 workspace Toast 둘에 일치한 strict mode 오류다. 비밀번호 또는 저장 API의 실패로 판단하지 않는다.

후속 커밋 `c88f3666e934a0a530213e29f0d272bae6facc37`에서 W05 알림 검증을 `getByTestId('workspace-toast')`로 한정했다. 모달 안내를 제거하거나 접근성 기능을 숨겨 테스트를 통과시키지 않았다. 모달 내부 안내는 별도 테스트로 유지한다.

이 문서를 포함한 최종 head의 원격 quality/E2E/Docker 결과는 PR #23의 검증 댓글에 run/job/head와 함께 기록한다. 과거 PASS 또는 진행 중인 실행을 최종 PASS로 전용하지 않는다. 이번 변경에는 main GHCR digest smoke가 적용되지 않는다.

## 정적 검토 및 환경별 한계

PR #23 병합 이후 남은 두 리뷰의 수정·독립 검토는 [PR23_FOLLOWUP.md](PR23_FOLLOWUP.md)에서 별도로 추적한다. 아래 미실행 환경 항목은 자동화 PASS와 구분하며, 사내 HTTP에서의 수동 clipboard 설명은 비운영 환경 동작에 관한 것이다. 현재 production HTTPS-only 정책을 완화하지 않는다.

보호 API/DB/domain/CI gate 변경 없이 UI와 테스트를 통합했다. 별도 독립 에이전트를 실행했다고 주장하지 않으며 최종 정적 검토와 GitHub 실행 증거를 구분한다. 실제 사내 HTTP reverse proxy, Windows clipboard·스크린리더, 최종 사용자 UX는 NOT TESTED다. 실제 배포 환경의 PASS를 GitHub Chromium 결과만으로 주장하지 않는다.

## 공식 참고

- [SVAR React Gantt Willow 기본 데모](https://docs.svar.dev/react/gantt/samples/#/base/willow): 공개 데모 진입점 확인. 이 환경에서는 JavaScript 데모를 직접 조작한 것으로 보고하지 않는다.
- [SVAR add-task 공개 API](https://docs.svar.dev/react/gantt/api/actions/add-task/): native 추가 이벤트 경계 유지.
- [MDN Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText): Promise 성공 후 안내, secure context·거부 처리.
- [MDN HTMLDialogElement.showModal](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal): 모달 top layer와 외부 콘텐츠의 inert 경계.

## Issue #76 Project Workspace 현재 계약

Issue #76부터 프로젝트 상세 화면은 다음 3단 계층을 현재 UX 계약으로 사용한다.

1. **Global App Shell**: masterGantt brand, 프로젝트/리소스 primary navigation, global utility. 기존 75rem 중앙 cap을 적용하지 않고 viewport 기반 gutter를 사용한다.
2. **Compact Project Context**: 프로젝트명과 읽기 전용/편집 중 상태를 항상 표시한다. Description, Owner, Revision은 Info UI로 progressive disclosure 한다. Share/Export/Settings/Copy는 action hierarchy에 따라 직접 action과 overflow로 구분한다.
3. **Workspace View**: `일정`과 `리소스`를 peer tab으로 제공한다. 일정이 기본 view이며 tab 전환은 mutation/navigation/reload를 발생시키지 않는다.

Readonly 상태의 password form은 작업공간 위에 상시 노출하지 않는다. 사용자가 `편집 잠금 해제`를 실행한 경우에만 Dialog에서 기존 edit-session API를 사용한다. 401/412 fail-closed, Origin/If-Match/revision, BFCache permission recheck 계약은 유지한다.

Resource workload는 더 이상 page 하단 portal로 누적하지 않고 Resource tab의 full-width content로 표시한다. Group → Resource → Task hierarchy, M/D·M/M·Refresh toolbar, 미설정/과투입 상태와 기존 workload API/calculation 계약은 유지한다.

탭 panel은 동일 Project Workspace 안에서 mount 상태를 유지해 일정 → 리소스 → 일정 전환 시 SVAR Gantt instance, tree/column/scale/selection/scroll 상태가 UI 전환만으로 불필요하게 초기화되지 않도록 한다. 세부 공통 기준은 [UI/UX Guidelines](UI_UX_GUIDELINES.md)를 따른다.


## Issue #83 Project Task / Resource 검색 UX

일정 탭 Toolbar는 즉시 통합 검색, 고급 필터 진입, 전체 초기화, match count를 제공한다. 고급 panel은 text/date/number/enum/assignment 타입에 맞는 native control을 사용하고, Resource/Group 선택은 종류 + 이름/code 검색 + 다중 checkbox + ANY/ALL을 사용한다. 필터된 child를 표시하는 ancestor Summary는 context row이며 결과 수에 포함하지 않는다.

Gantt는 canonical tasks/links를 계속 보유하고 SVAR 2.7.3 공개 `filter-tasks` action으로 가시성만 바꾼다. DOM 행 숨김이나 Project mutation을 사용하지 않는다. 필터 해제 시 같은 Gantt instance에서 canonical hierarchy가 복원된다.

리소스 탭은 기존 Group → Resource → Task 구조를 유지한다. 통합 검색은 assigned target의 name/code/description을 사용하고 kind/active/연결 Task effective 기간을 조합한다. workload summary는 전체 Project 집계임을 명시하고 조건에 맞는 표시 행/Task detail만 제한한다.


## Issue #84 Project List 검색/필터 UX

Project List 상단에는 `프로젝트 검색`, 적용 조건 수를 포함한 `필터 N`, `초기화`, 결과 수를 배치한다. Quick Search는 프로젝트명·소유자·설명을 동시에 검색하며 고급 조건과 AND로 결합한다. 고급 panel은 Project명/소유자/설명의 typed text operator, 소유자 지정 여부, 생성일/최근 변경일의 날짜 조건을 제공하고 각 활성 조건을 개별 삭제할 수 있다.

날짜 입력은 native date control을 사용하며 목록 날짜 표시와 동일한 browser timezone calendar date로 비교한다. 잘못된 range는 자동으로 뒤집거나 추정하지 않고 panel에 오류를 표시하며 해당 invalid condition을 결과 predicate에 적용하지 않는다.

검색 결과 수는 `일치 / 전체` 텍스트로 표시한다. 실제 Project가 0개면 기존 `EmptyProjects`를 사용하고, Project는 존재하지만 결과가 0개면 별도의 “조건에 맞는 프로젝트가 없습니다.” 상태와 초기화 action을 제공한다. 검색 상태에서도 Project Link와 Row Action 메뉴를 그대로 사용할 수 있고 삭제 성공한 Project는 즉시 결과에서 제거된다.

필터 panel은 keyboard 접근 가능한 native controls를 사용한다. Escape 또는 닫기 버튼으로 panel을 닫으면 Filter trigger로 focus를 복원한다. 390/768/1024/1440/wide desktop에서 document-level unintended horizontal overflow를 만들지 않는다.

## Issue #138 프로젝트 상태와 목록 필터

프로젝트 상태는 `planned`(예정), `in_progress`(진행 중), `completed`(완료)의 별도 데이터다. Project List는 `상태` 열에 텍스트 badge를 표시하고, 상세 Context에는 프로젝트 상태와 읽기 전용/편집 권한 badge를 구별해 표시한다. 예정은 info, 진행 중은 selected, 완료는 success semantic token을 쓰되 한국어 상태 텍스트를 항상 함께 표시한다. 새 프로젝트의 상태 선택 기본값은 예정이며, 편집 가능한 사용자는 기존 프로젝트 설정에서 상태를 바꾼다. 상태에는 강제 전이 순서가 없다. 읽기 전용 사용자는 canonical 상태만 확인한다.

목록의 기존 고급 필터에는 native checkbox 세 개를 포함한 `프로젝트 상태` fieldset을 둔다. 첫 진입과 초기화는 예정+진행 중을 선택하고 완료를 제외한다. 필터 안내에서 완료 프로젝트를 선택해 표시할 수 있음을 알린다. 세 상태 모두 선택하거나 하나/아무것도 선택하지 않은 경우도 명시적 사용자 조건이다. 상태 선택이 기본 두 값과 다르면 적용 조건 수에서 한 조건으로 세고 초기화 버튼을 표시한다. 아무것도 선택하지 않으면 선택 상태가 없다는 원인을 적은 결과 0건 상태와 초기화 경로를 표시한다. 상태는 기존 Quick Search·이름/소유자/설명·날짜 조건과 AND이며, 목록 전체 수에는 완료 프로젝트도 포함한다. 필터 변경 자체는 API 재조회나 mutation을 하지 않는다. 필터는 현재 List view의 일시적 상태이며 새 진입에서 기본값으로 돌아간다. URL이나 localStorage에 저장하지 않는다.

상태 저장은 기존 프로젝트 metadata PATCH의 `If-Match` revision 및 401/412 경로를 사용하고, 성공 시 canonical snapshot의 상태로 목록·상세를 표시한다. 실패한 초안 상태를 현재 상태처럼 표시하지 않는다. 목록의 좁은 상태 열을 포함한 table은 390/768px에서 table wrapper 안에서만 가로 스크롤하며 문서 자체에는 가로 overflow를 만들지 않는다. 1024/1440px에서도 헤더·행 작업과 상태 텍스트를 함께 볼 수 있어야 한다. `tests/e2e/project-status.spec.ts`와 기존 List E2E의 열 위치 검증을 갱신했다. 로컬 브라우저·테스트 및 전후 화면 실측은 사용자 지시에 따라 **NOT TESTED**이며 PR CI로 판정한다. API/DB migration 계약 문서는 backend 작성 범위다.

## Issue #181 Project List 고급 필터 패널 밀도

Project List의 검색 도구줄 순서와 `필터 N` accessible name은 유지한다. 고급 필터에서 프로젝트 상태는 항상 보이는 compact checkbox row로 유지하고, `프로젝트 정보`와 `날짜`는 native `details/summary` disclosure로 묶는다. 패널을 새로 열 때 해당 그룹에 활성 조건이 있으면 펼친 상태로 시작하고, 활성 조건이 없으면 접힌 상태로 시작한다. 사용자가 활성 그룹을 다시 접더라도 summary에는 적용 조건 수와 프로젝트명·소유자·설명 값 또는 소유자 지정 여부, 날짜 그룹의 연산자·입력 값을 줄바꿈 가능한 텍스트로 표시해 현재 조건을 숨기지 않는다.

프로젝트 정보의 프로젝트명·소유자·설명·소유자 지정 여부는 1024/1440px에서 2열 compact grid, 390/768px에서 1열로 배치한다. 각 조건의 operator/value/삭제 action은 한 행에 가깝게 배치하되 좁은 폭에서는 세로로 안전하게 쌓인다. 생성일·최근 변경일도 같은 compact group을 사용하며 operator가 `전체`이면 날짜 input과 삭제 action을 렌더링하지 않는다. native summary의 keyboard semantics와 공통 focus outline을 사용하고 별도 custom disclosure state나 새 UI framework는 도입하지 않는다.

#84의 Quick Search+고급 조건 AND predicate, browser-timezone 날짜 비교와 invalid range 미적용, 조건 수·전체 초기화·no-result, #138의 예정+진행 중 기본 상태와 상태 checkbox, #177의 Project List 상태 즉시 변경 및 client-side filter 재평가, API 재조회 없음, Escape/닫기 후 Filter trigger focus 복귀를 변경하지 않는다. 공통 `.project-filter-panel`은 일정/리소스 필터가 공유하므로 #181의 배치 규칙은 Project List CSS module에 한정한다. 390×844·768×900·1024×900·1440×900에서 접힌 패널 geometry, document horizontal overflow, summary keyboard/활성 값 표시와 screenshot을 E2E로 검증한다. 구현 전 동일 fixture의 legacy panel 실측·캡처는 별도 baseline 증거가 확보되기 전까지 **NOT TESTED**다.

## Issue #115 작업 캘린더 미리보기 상태

프로젝트 설정의 작업 캘린더 초안은 국가, 적용 범위·기간, 휴무일 이름·날짜·대상·대상 선택, 규칙·휴무일 추가·삭제가 바뀔 때마다 이전 미리보기를 즉시 숨긴다. 입력을 원래 값으로 되돌려도 이전 결과를 자동으로 다시 표시하지 않으며, 사용자가 `미리보기 계산`을 다시 실행해야 한다. 결과는 계산 당시의 프로젝트 publicId, revision, 요청 본문과 일치할 때만 표시한다. 다른 프로젝트·revision의 늦은 성공/오류 응답은 현재 상태나 알림을 덮어쓰지 않는다.

한 개의 간결한 live status가 초기 안내, 재계산 필요, 계산 중, 실패 후 재시도, 완료 요약을 전달한다. 자세한 변경 작업과 휴무일 목록은 이 live region 밖에 둔다. 계산 중에는 초안과 저장·미리보기 버튼을 잠그며, 계산 실패 때는 결과를 숨기고 재시도 방법을 표시한다. 미리보기는 저장 전 필수 단계가 아니다. 저장 성공 시 이전 미리보기를 지우고 기존 canonical 일정 재조회·알림 경로를 사용한다. 저장 응답을 미리보기 결과처럼 표시하지 않는다. 기존 edit session, Origin, If-Match, 401/412 처리와 서버 인가 계약은 그대로 따른다.

자동 Chromium 검증은 `tests/e2e/project-work-calendar-preview.spec.ts`가 실제 KR→US 미리보기·저장 요청, 초안 변경, 실패·재시도, metadata 저장에 따른 revision 변경·editor unmount 뒤 늦은 응답, 390/768/1024/1440px 상태·버튼 접근을 확인한다. Metadata 저장은 기존 설정 창을 닫으므로 같은 editor 인스턴스에서 revision prop만 바뀌는 경로는 브라우저에서 직접 재현하지 않는다. publicId/revision 일치 검사와 요청 토큰 경계는 코드 검토 및 원격 회귀와 함께 판정한다. 스크린리더와 실제 기기 조작은 별도 환경 검증이다.

## Issue #116 작업 Context Menu 하위 메뉴 배치

변경 전 UI/UX 재현 근거는 390×844에서 root x=8..264, `Add` child x=253..421로 오른쪽 31px가 잘리는 상태다. 작업 메뉴의 활성 하위 메뉴는 실제 root와 하위 메뉴 폭을 기준으로 오른쪽 공간이 충분하면 오른쪽, 오른쪽이 부족하고 왼쪽이 충분하면 왼쪽에 표시한다. 양쪽 모두 부족하면 root와 같은 폭의 drilldown으로 전환한다. 390px 화면의 `Add`는 focus만으로 열리지 않으며 클릭·Enter·Space·ArrowRight로 연다. `Back` 또는 ArrowLeft는 부모 메뉴로 돌아가고 Escape는 메뉴 전체를 닫고 원래 작업 행/막대로 focus를 복원한다. 넓은 화면의 hover·focus 진입과 root 최초 focus 및 닫힌 하위 메뉴 상태는 유지한다.

하위 메뉴 trigger는 `aria-expanded`와 열린 메뉴를 가리키는 `aria-controls`를 제공한다. 하위 메뉴는 이름이 있는 `role=menu`이고 비활성 명령은 그대로 비활성으로 남는다. 넓은 화면에서 ArrowLeft는 부모 trigger에 focus를 돌려주고 child를 닫는다. 하위 메뉴가 열린 상태에서 `Edit`·`Cut` 등 일반 root 명령으로 keyboard focus 또는 mouse pointer가 이동하면 열린 child를 즉시 닫고 해당 trigger의 `aria-expanded=false`를 유지한다. 좁은 drilldown에서 활성 명령이 하나도 없으면 `Back`이 focus를 받는다. 짧은 화면에서는 메뉴 높이를 `100dvh - 16px` 이내로 제한하고 내부 스크롤과 고정된 `Back`을 사용하며 Arrow/Home/End 탐색은 문서가 아닌 메뉴 내부를 스크롤한다. Context Menu의 권한·revision·선택 Task endpoint link 제한, #104의 무관한 Task 동작, canonical Gantt instance 유지 계약은 변경하지 않는다. API·DB·스케줄링 문서 변경은 N/A다.

2026-09-24 확인: 설치 버전은 `@svar-ui/react-gantt` 2.7.3이다. [SVAR 공식 ContextMenu 가이드](https://docs.svar.dev/react/gantt/guides/configuration/configuring_context_menu/)는 공개 Core `ContextMenu`의 `options`/`data` 하위 항목과 `resolver`/`filter`를 설명한다. 이 프로젝트의 작업 명령은 앱의 인가·revision·clipboard·canonical 동기화 경계를 포함해 기존 사용자 메뉴를 유지하며 PRO 전용 기능을 복제하지 않는다. UI/UX 조사에서 공식 데모는 1440px hover와 390px 항목 화면 관찰까지만 근거가 있으며 keyboard 동작은 **NOT TESTED**다. 본 변경의 코드·E2E 명세는 작성했다. 로컬 브라우저·자동 검증은 실행하지 않았고, PR 원격 CI 결과는 해당 PR의 head SHA와 run으로 별도 판정한다.


## Issue #117 리소스 공수 조회 상태

Resource tab은 공수 계산 결과와 assigned-targets 이름·코드·설명 정보를 독립적으로 조회·표시한다. 한쪽 API의 실패가 다른 쪽 성공을 숨기지 않는다. 공수 첫 조회 실패 때는 결과가 없음을 명시하고 빈 검색 결과와 구별한다. 메타데이터 첫 조회 실패 때는 공수 응답에 포함된 Group·Resource 기본 이름과 Resource 기본 코드의 검색·표시를 유지한다. Group 코드는 공수 응답에 없어 메타데이터 성공 전에는 검색할 수 없으며 설명 검색도 제한됨을 알린다. 각 상태에는 별도의 오류 안내와 재시도 버튼이 있다. 전역 `새로고침`은 두 조회를 다시 시작하며 어느 한쪽이라도 조회 중이면 중복 요청을 막기 위해 비활성화한다.

성공한 조회를 새로고침하다 실패하면 마지막 성공 결과를 계속 보여 주되, 실패 상태와 마지막 성공 확인 시각을 함께 표시한다. assigned-targets가 독립적으로 최신화되면 검색뿐 아니라 Group·Resource 행의 이름과 코드도 최신 메타데이터를 우선 사용하고 workload snapshot 값은 메타데이터 실패 시 fallback으로만 사용한다. 늦은 이전 요청의 성공·오류는 최신 요청을 덮지 않는다.

개별 재시도 버튼은 요청 중에도 같은 DOM 위치에 유지되고 disabled/aria-busy 상태로 전환하여 keyboard focus를 잃지 않는다. 실패하면 같은 버튼이 다시 활성화되고 성공하면 완료 상태로 전환된다. 재조회·부분 실패는 검색/종류/상태/기간 필터, M/D·M/M 선택, 열린 Group·Resource details, 일정·리소스 tab 상태와 SVAR Gantt instance를 초기화하지 않는다. Resource API·domain·권한 계약은 변경하지 않으며 API/DB/스케줄링 문서 영향은 N/A다.


## Issue #118 Project Context와 일정 도구줄

긴 Project 이름은 제목 영역에서만 한 줄 말줄임으로 표시하고 전체 이름은 제목의 tooltip에서 확인한다. 읽기 전용/편집 중 badge, 정보 버튼, 공유·내보내기·설정 등 action의 문구는 글자 단위로 줄바꿈되지 않고 읽을 수 있는 크기와 위치를 유지한다. 정보 panel은 viewport 폭 안에 두고 긴 설명은 panel 내부에서 스크롤한다.

390/768px 일정 도구줄은 첫째 줄에 검색과 필터 버튼, 둘째 줄에 일치 결과와 조건이 있을 때만 표시하는 초기화 버튼을 둔다. 필터 버튼의 `aria-expanded`와 `aria-controls`는 고급 필터 panel의 열린 상태와 연결된다. 열린 panel에서 Escape를 누르면 닫고 필터 버튼으로 focus를 돌린다. 초기화 후에는 검색 입력으로 focus를 돌린다. 1024/1440px는 기존 넓은 도구줄 구성을 유지한다. 도구줄 조정은 Project Workspace에만 적용하며 SVAR Gantt 내부 scale toolbar는 변경하지 않는다.

검색·필터·정보 panel 조작과 일정↔리소스 tab 이동은 canonical Gantt instance를 재생성하지 않는다. Gantt 내부 표시 단위 선택과 차트 가로 스크롤도 유지한다. 390/768/1024/1440px의 readonly/editing 각 상태에서 Gantt의 상단 위치·높이, 문서 가로 overflow와 버튼 접근성을 E2E로 확인할 명세를 작성했다. 명세의 `search-idle`/`search-reset` 캡처는 새 구현 안의 두 조작 상태이며 구현 전후 비교 자료가 아니다. Gantt 높이 개선을 판단하려면 동일 fixture·viewport·상태의 구현 전 baseline과 변경 후 측정이 별도로 필요하다. 기존 다른 높이·fixture의 수치를 합격 기준으로 대체하지 않는다. 코드·명세는 작성했으나 로컬 브라우저·테스트·빌드 및 실제 전후 수치는 **NOT TESTED**이며 원격 PR CI는 해당 head/run으로 별도 판정한다. Project API·DB·Scheduling 계약 변경은 N/A다.


## Issue #119 반복 입력과 필드 오류 연결

작업 편집의 반복 리소스 투입 입력은 리소스별 fieldset/legend와 고유한 투입 시작·종료·투입률 이름을 제공한다. 투입률 범위와 날짜 순서 오류는 해당 입력의 `aria-invalid`·`aria-describedby` 및 인접 오류로 연결한다. 명시적 `할당 저장`에서 여러 오류가 있으면 요약으로 focus를 옮기고, 요약의 각 항목을 실행하면 해당 리소스 입력으로 이동한다. 필터로 가려진 대상은 오류 항목 실행 시 표시한 뒤 focus한다. 잘못된 초안은 유지하며 할당 PUT을 보내지 않는다. 작업 저장과 할당 저장은 계속 독립 계약이다.

캘린더의 반복 국가 규칙·휴무일은 항목별 fieldset/legend와 순번을 포함한 고유 control 이름을 제공한다. 기간·이름·날짜·대상 선택 오류를 각 입력에 연결하고, 명시적 Preview/Save에서 오류 요약으로 focus를 옮긴다. 잘못된 초안에서도 두 버튼은 누를 수 있으며 클라이언트 검증 후 API 요청 0회로 멈춘다. 타이핑 중 focus를 강제로 옮기지 않는다. 외부 disabled 또는 계산·저장 중에는 기존처럼 버튼과 입력을 잠근다. #115의 live preview status, 초안 무효화, publicId/revision/늦은 응답 방어, 401/412/If-Match 및 canonical 저장·재조회 계약은 유지한다.

Project 생성은 이름·소유자·비밀번호의 오류를 각각 연결하고 명시적 제출 때 복수 오류 요약으로 focus를 옮긴다. 요약 항목은 해당 입력으로 이동하며 잘못된 제출은 API 요청 없이 입력 초안을 보존한다. 서버 거부·비밀번호 처리 경로는 기존 계약을 유지한다. 네 viewport의 keyboard-only E2E 명세는 작성했으나 로컬 브라우저·테스트·빌드는 **NOT TESTED**다. Project/Assignment/Calendar API·DB·Scheduling 계약 문서 변경은 N/A다.

## Issue #121 App Shell 본문 바로가기

App Shell의 header 앞에 `본문으로 바로가기` 링크를 둔다. 키보드 첫 Tab에서만 화면에 나타나며 링크는 같은 페이지의 `#main-content`로 이동한다. `main`은 `tabIndex=-1`인 focus 대상이어서 Enter 뒤 본문으로 focus가 옮겨지고, 본문에 조작 가능한 control이 있으면 다음 Tab이 그 control로 이어진다. 빈 목록·리소스 관리·생성 화면·프로젝트 조회 중/오류/정상 화면에서 같은 main landmark를 사용한다. 조회 중처럼 본문 control이 없는 상태는 main focus까지 확인한다.

Modal dialog가 열려 있을 때는 기존 native focus trap이 우선하며 skip link가 dialog 밖으로 focus를 빼앗지 않는다. Escape로 닫으면 기존 설정 trigger focus 복원도 유지한다. 링크는 390/1440px에서 focus 상태에만 보이고 화면 밖 가로 overflow를 만들지 않는다. 리소스 관리로의 client navigation에서도 main landmark를 유지하며, 스크롤된 페이지에서는 fragment 이동이 main을 다시 화면에 놓는다. 같은 문서의 fragment만 바뀐 `popstate`는 편집 권한 재확인·reload를 시작하지 않는다. 실제 history 복귀와 BFCache `pageshow.persisted`의 fail-closed 재확인은 계속 수행한다. Fragment 이동 자체는 API mutation이나 Gantt 재생성을 수행하지 않는다. 현재 코드는 native anchor 동작을 사용하며 browser별 focus·scroll 결과와 실제 focus 상태 캡처는 원격 Chromium E2E에서 판정한다. API/DB/Scheduling 계약 문서 영향은 N/A다.

## Issue #130 Phase 1 Project List 시각 정합화

Project List는 기존 native table, Project 이름 Link, 행별 More 메뉴와 #84 검색·필터를 유지한다. 페이지 제목과 목록 사이의 간격, 테이블 헤더·행 간격을 compact하게 정렬한다. Project 이름은 기본 텍스트와 강조된 Link, 소유자·최대 두 줄 설명·날짜는 보조 정보, 날짜는 tabular 숫자로 표시한다. 헤더·구분선·hover/focus·More 메뉴는 #120 의미 토큰을 사용한다. 새로운 행 선택 상태나 검색 predicate는 추가하지 않는다.

390px에서는 최소 62rem table을 목록 wrapper 안에서 가로 스크롤하며 문서 자체의 가로 스크롤을 만들지 않는다. More 메뉴는 기존 portal의 viewport 배치, Arrow/Home/End·Escape와 focus 복원을 유지한다. Copy/link/delete, 삭제 auth·If-Match·401/412 및 빈 목록과 검색 결과 0건의 서로 다른 상태는 기존 계약을 따른다.

같은 긴 한국어·영어 Project 이름/설명과 소유자, 3개 이상 행 fixture를 390×844·768×900·1024×900·1440×900·1600×900, browser zoom 100%에서 구현 전후 각각 측정·촬영한다. wrapper/client/scroll 폭, 열 폭·행 높이, 문서 overflow, 메뉴 bounds와 keyboard focus를 비교한다. 현재 E2E는 새 구현 상태의 캡처와 동작 assertion을 준비했으며, 구현 전 baseline과 실제 브라우저 수치·이미지는 아직 확보하지 않았다(**NOT TESTED**). 따라서 새 캡처를 전후 개선 증거로 사용하지 않는다. API/DB/Scheduling 계약 문서 영향은 N/A다.

## Issue #130 Phase 2 Project Workspace 시각 정합화

Project Context는 긴 제목만 한 줄 말줄임으로 제한하고, 읽기 전용·편집 중 badge, 정보, 공유·내보내기·설정/잠금 해제와 더보기는 줄바꿈 없이 접근 가능하게 유지한다. 제목·action 사이의 간격과 일정/리소스 탭 높이를 compact하게 정렬하며 배경·테두리·상태·focus에 #120 의미 토큰을 사용한다. 정보와 더보기 disclosure에서 Escape를 누르면 닫고 해당 summary로 focus를 돌린다. 정보 panel은 긴 설명을 내부 스크롤하고 viewport 안에 둔다.

일정/리소스 탭의 ArrowLeft/ArrowRight/Home/End, `aria-selected`·`aria-controls`·tabpanel 연결과 탭 왕복 시 같은 Gantt instance를 유지한다. 주 단위 선택·chart 가로 스크롤, tree·column·selection은 기존 Gantt 회귀 계약을 따른다. #118 일정 검색 도구줄, #121 skip link, #119 forms와 #117 Resource 조회 상태는 변경하지 않는다. API/session/revision/401/412/If-Match/canonical 경로도 그대로다.

같은 긴 제목·설명 fixture의 읽기 전용/편집 중 상태를 390×844·768×900·1024×900·1440×900·1600×900에서 구현 전후 각각 촬영하고 Context·Gantt top/height, Info/More panel bounds, 문서 overflow를 비교한다. 현재 작성한 E2E의 PNG는 **변경 후 상태**만 기록하며 구현 전 같은 fixture의 baseline과 실제 수치는 아직 **NOT TESTED**다. 조회 중·조회 오류/재시도도 별도 E2E 명세로 기록한다. API/DB/Scheduling 계약 문서 변경은 N/A다.

## Issue #245 Gantt 이미지 내보내기

Project Context에는 compact `내보내기` 진입점 하나를 둔다. 공통 대화상자에서 Excel, SVG, PNG를 선택한다. Excel 형식에서는 기존 관계 포함/제외 선택을 유지한다. SVG/PNG 형식에서는 전체 Project 또는 기간 지정 scope를 표시하며 기간 지정에서만 시작일·종료일을 활성화한다. 전체는 펼친 WBS Grid+Chart, 기간 지정은 모든 작업 행을 유지한 Chart만 생성한다. 상세 API와 한도는 [IMAGE_EXPORT.md](IMAGE_EXPORT.md)를 따른다.

형식·범위와 날짜는 label이 있는 semantic control로 제공한다. 유효하지 않은 기간의 오류는 해당 입력과 연결하며, 작업 중에는 중복 실행을 막는다. Escape/취소와 닫기 후 trigger focus 복원을 유지한다. 390/768/1024/1440px에서 header action overflow가 없고 내보내기 전후 Gantt 선택·스크롤·Editor 초안이 보존되어야 한다. 이 항목의 실제 브라우저 검증은 해당 PR head의 E2E와 별도 수동 확인으로 판정한다.

## Issue #130 Phase 3 Task Editor 시각 정합화

Task Editor의 modal header는 작업 정보 제목과 작업 유형, External ID, 기준 Revision을 구분해 표시하고 닫기 action을 유지한다. 변경 제한·stale·저장 오류·초안 폐기 확인은 탭 위의 별도 notice 영역에 남긴다. Task/Resource/Relation 탭, 작업 입력과 서버 확정 정보, 관계 조회는 기존 semantic grouping을 유지한다. 좁은 화면에서는 작업 필드와 관계를 한 열로, 1024px 이상에서는 작업명/진행률과 선행/후행 관계를 해당 내용 폭에 맞게 나란히 놓는다.

Dialog 자체는 viewport 안에 두고 **본문만 세로 스크롤**한다. Header·탭·취소/저장/최신 정보 다시 불러오기 footer는 본문 스크롤 중에도 접근할 수 있다. Notice가 여러 개 쌓이면 notice 영역 안에서 스크롤해 본문·footer를 밀어내지 않는다. #120 의미 토큰으로 상태·focus·border를 정렬하되 Task Editor의 기존 compact control 높이와 #119 할당 fieldset/개별 오류 연결은 보존한다.

Dirty close/Escape 확인, stale 뒤 명시적 reload, 실패 시 draft 보존, 저장 중 중복 PATCH 방지, 읽기 전용과 Task PATCH·Assignment PUT의 독립 계약 및 Gantt instance·원래 행 focus 복원은 기존 경로를 따른다. Domain validation은 기존 `prepareTaskEditorCommand`에 맡긴다. 동일 fixture의 390×844·768×900·1024×900·1440×900·1600×900 구현 전후 modal/header/body/footer/필드/관계 geometry와 PNG가 비교 대상이다. 현재 E2E는 **변경 후 상태**만 기록하며 구현 전 baseline·실측, 로컬 브라우저·테스트·빌드는 **NOT TESTED**다. API/DB/Scheduling 문서 변경은 N/A다.

## Issue #130 Phase 4 Search / Filter 공통 표현

Project List, 일정, 리소스의 검색 도구줄은 넓은 화면에서 검색→`필터 N`→조건부 `초기화`→일치/전체 결과 순서로 표시한다. 390/768px에서는 검색·필터가 첫째 행, 결과·조건부 초기화가 둘째 행에 놓인다. 초기화 뒤 검색 입력으로 focus를 돌리고 고급 필터에서 Escape를 누르면 패널을 닫아 필터 버튼으로 focus를 복원한다. 표면·텍스트·테두리·focus·상태는 #120 의미 토큰을 사용하며 새 chip이나 필터 프레임워크는 도입하지 않는다.

Project List의 #84 Quick Search+고급 AND, browser timezone 날짜 및 잘못된 날짜 범위 무시 계약은 그대로다. 일정은 #83 client filter와 canonical Gantt instance를 유지하며, 섹션 설명은 정적 맥락만 보여 주고 동적 결과 수는 도구줄에서 한 번만 표시한다. Resource의 종류·활성·Task 기간 native control은 고급 필터 패널로 모으고, M/D·M/M·새로고침은 별도 공수 도구줄에 남긴다. Resource 날짜가 역순이면 기존처럼 두 날짜 사이 범위로 해석한다고 패널 안에서 알린다. 한쪽 날짜만 입력한 경우 '기간 시작일과 종료일을 모두 입력' 안내를 보여 주고 조건을 적용하지 않는다. 이 미완성 초안은 적용 조건 수 `필터 N`에서 제외하되 초기화로 지울 수 있다. 공수/assigned-targets의 조회 중·첫 실패·stale/부분 실패 상태와 결과 0건은 별개로 유지한다. 오류 카드도 #120 상태 토큰을 사용한다. 필터 조작은 API 재조회나 mutation을 하지 않는다.

같은 fixture의 Project List·일정·리소스 도구줄을 390×844·768×900·1024×900·1440×900·1600×900에서 구현 전후 각각 비교할 계획이다. 현재 명세는 **변경 후 상태**의 배치·focus·overflow·API 불변과 PNG만 작성했고 구현 전 같은 fixture의 baseline, 실제 브라우저 수치와 로컬 실행은 **NOT TESTED**다. API/DB/Scheduling 계약 문서 변경은 N/A다.

## Issue #155 Gantt Grid·Chart 전체화면

일정 화면의 Gantt 표시 단위 도구줄에 `전체화면` 버튼을 둔다. 버튼의 제목과 `aria-keyshortcuts`로 `Ctrl/Cmd+Shift+F`를 안내하며 `.project-gantt-frame`에 브라우저 native Fullscreen API를 요청한다. Grid·Chart·표시 단위·Gantt 내부 열/작업 메뉴만 전체화면에 포함하고 App Shell·프로젝트 정보·검색/필터·리소스 화면은 포함하지 않는다. `Escape` 또는 `전체화면 종료`로 원래 작업공간으로 돌아가며 버튼에 focus를 돌린다. 메뉴가 열린 경우 기존 메뉴 Escape 닫힘을 처리하되 브라우저가 동시에 native fullscreen을 끝낼 수 있다. 이 경우에도 focus가 유효하고 버튼 상태가 실제 `document.fullscreenElement`와 일치해야 한다.

입력 상자·inline 편집·대화상자·메뉴 안에서는 fullscreen shortcut을 실행하지 않는다. **Issue #372부터 작업 정보/관계 대화상자를 열기 위해 Gantt fullscreen을 강제 종료하지 않는다.** Grid/Chart double click과 Context Menu → Edit은 원래 호출 대상을 기억하고 native dialog를 열되 `document.exitFullscreen()`을 호출하지 않으며, 저장·취소·닫기 후에도 사용자가 직접 종료하지 않았다면 같은 `.project-gantt-frame` fullscreen을 유지한다. Fullscreen 요청 거부·미지원에서는 상태를 성공으로 앞당기지 않으며 CSS 모의 전체화면으로 대체하지 않는다. Readonly에서도 같은 fullscreen 조회 흐름을 사용하되 서버 편집 권한은 바뀌지 않는다.

전환과 dialog open/close는 기존 SVAR 인스턴스를 재생성하지 않으며 Grid/Chart split·열 너비/표시 열·일/주 단위·가로/세로 scroll·선택·Summary 펼침·filter 상태와 canonical snapshot을 유지해야 한다. dialog를 닫으면 원래 Task/Link trigger 또는 안전한 fallback으로 `preventScroll` focus를 복원한다. 브라우저가 Escape로 native fullscreen을 종료한 경우에는 해당 동작을 차단하지 않고 `fullscreenchange`와 실제 `document.fullscreenElement`를 기준으로 버튼/focus 상태를 동기화한다. 390/768/1024/1440px에서 viewport, dialog/backdrop, 버튼·Grid·Chart 접근성을 확인하며 Chrome/Edge의 native fullscreen 결과는 PR E2E/실브라우저 증거로 판정한다. API·DB·Scheduling 계약 및 문서 변경은 N/A다.

[SVAR 공식 Fullscreen guide](https://docs.svar.dev/react/gantt/guides/fullscreen/)는 React Core `Fullscreen` wrapper를 안내한다(확인 2026-09-24). 설치된 Gantt 2.7.3/Core 2.6.1에서 Core JavaScript export와 TypeScript 선언이 일치하지 않고 요청 거부·입력 guard·Task Editor 선행 종료를 이 화면의 계약에 맞게 제어할 수 없어, 이번 범위는 [표준 Fullscreen API](https://fullscreen.spec.whatwg.org/)로 frame만 전환한다. 공식 sample의 실제 브라우저 조작 비교는 수행하지 않았다.

## Issue #171 전체화면 우측 컨트롤 비중첩

Issue #155의 native fullscreen 계약을 유지하면서, 전체화면 내부 알림 버튼은 우측 상단에 고정된 독립 hit area를 갖고 Gantt scale toolbar는 그 영역을 침범하지 않아야 한다. 따라서 `.project-gantt-frame:fullscreen` 상태에서만 toolbar 우측 여유 공간을 예약한다. 일반 화면의 toolbar/알림 배치, Fullscreen API 대상, 단축키, focus 복귀, Gantt instance/state 보존 계약은 변경하지 않는다.

390/768/1024/1440px에서 전체화면 종료 버튼과 알림 버튼의 실제 bounding box가 겹치지 않아야 하며, 알림 버튼으로 알림함을 열고 닫은 뒤에도 같은 Gantt instance를 유지하고 전체화면 종료 버튼을 계속 사용할 수 있어야 한다. API/DB/Scheduling/권한 계약은 변경하지 않는다.

## Issue #136 공통 헤더의 빌드 버전

App Shell 브랜드 바로 옆에 `v<SemVer>`를 보조 텍스트로 표시한다. 값은 서버 컴포넌트가 빌드에 포함된 `package.json.version`에서 직접 읽으며 수동 버전 문자열이나 별도 설정값을 두지 않는다. 버전은 홈 링크 바깥에 있어 `masterGantt 홈` 링크의 이름과 이동 동작을 바꾸지 않는다. 544px 이하에서는 보조 버전을 숨기고 브랜드 이름을 우선하며, 416px 이하에서는 M 마크만 남겨 프로젝트·리소스·물류 관리 navigation과 알림 영역의 공간을 확보한다. 헤더 높이와 본문 작업 공간은 늘리지 않는다.

`tests/e2e/workspace-header-version.spec.ts`에 390px의 M 마크, 480px의 브랜드 이름, 768/1024/1440px의 브랜드와 버전, 각 폭의 헤더 높이·navigation·문서 가로 overflow 및 리소스 이동 후 브랜드 홈 복귀 명세를 작성했다. PNG는 변경 후 화면 자료이며 구현 전후 비교나 실제 브라우저 PASS를 뜻하지 않는다. 로컬 테스트·브라우저·빌드는 사용자 지시에 따라 **NOT TESTED**이고 PR head의 원격 CI는 별도로 판정한다. API·DB·Scheduling·권한 계약은 바뀌지 않는다.

## Issue #141 브라우저 제목과 파비콘

브라우저 탭의 비프로젝트 제목은 정확히 `masterGantt`다. 유효한 프로젝트를 열어 canonical 이름을 확인하면 공백 없이 `masterGantt|{프로젝트명}`으로 표시한다. 직접 URL·새로고침의 서버 초기 HTML 제목은 읽기 전용 snapshot의 확정 이름을 사용한다. 클라이언트가 조회 중일 때는 잠시 기본 제목을 허용하고, 조회 완료·설정 저장·재조회 후에는 확정 snapshot의 이름만 반영한다. 입력 중인 이름, 실패한 저장, 401 뒤의 초안은 제목에 반영하지 않는다. 412로 snapshot이 무효화된 재조회 중, 로딩·404·조회 실패 및 App Router 오류 경계에서는 기본 제목을 사용하고 재조회가 성공하면 새 canonical 이름으로 바꾼다. 다른 프로젝트 또는 비프로젝트 화면으로 이동하면 이전 프로젝트 제목을 남기지 않는다. 서로 다른 publicId가 같은 이름을 써도 이전 화면의 cleanup은 현재 URL의 제목을 덮어쓰지 않는다.

Next App Router의 `src/app/icon.svg`는 사이트 헤더의 파란 M 마크를 공유하는 정적 SVG 파비콘이다. 헤더 브랜드·버전 표시는 변경하지 않는다. `tests/e2e/project-browser-title-favicon.spec.ts`에 favicon 응답, 서버 초기 HTML과 hydration 뒤 제목, 비프로젝트 화면, 직접 진입·새로고침·SPA 목록 경유 전환(동일 이름·서로 다른 publicId 포함), 이름 저장과 실패·401·412·조회 실패의 제목 명세를 작성했다. App Router 오류 경계에는 테스트에서 형태가 잘못된 조회 응답을 주입해 화면 오류·재시도 버튼과 기본 제목 복원을 확인한다. 실제 Chromium 결과와 Edge/Chrome/Firefox/Safari 브라우저 탭에서의 시각 확인, 로컬 test/lint/typecheck/build는 **NOT TESTED**이며 PR head CI와 환경별 수동 검증으로 판정한다. API·DB·Scheduling·권한 계약 변경은 N/A다.

## Issue #140 Gantt Grid 작업명 인라인 편집

편집 가능한 프로젝트의 Grid `작업` 열에서 Summary·Task·Milestone의 이름 텍스트를 한 번 클릭하면 SVAR Core text editor가 열린다. 셀 여백, Summary 펼침 아이콘, 다른 열, Chart와 Context Menu는 이 진입점이 아니다. Grid의 기본 키보드/F2와 이름 더블클릭도 같은 이름 전용 검증·저장 경로를 사용한다. Enter 또는 일반 blur에서 trim한 이름을 보호 Task PATCH로 한 번 저장하고, Escape는 `close-editor({ignore:true})`로 취소한다. 한글 IME 조합 확정 Enter는 저장으로 취급하지 않는다. 빈 값·공백만·well-formed Unicode가 아닌 값·200자 초과는 요청 없이 input을 열어 둔 채 해당 input의 `aria-invalid`/`aria-describedby`와 오류 안내를 제공한다. 숫자처럼 보이는 `001`도 문자열 그대로 저장한다.

저장 중 재입력을 잠그고 서버 성공 후 canonical snapshot을 기존 Gantt 인스턴스에 동기화한다. 실패·401·412·409에서는 기존 이름과 명시적 오류/권한 상태를 유지하며, 서버의 Origin·session·If-Match·revision 검사와 기존 rollback/재조회 경로를 재사용한다. Task Editor의 Summary 일정·진척·Baseline readonly와 별도 Task/Assignment 저장 계약은 유지한다. #461부터 Summary 이름·기본 완료 단계는 편집 가능하다. 관계 양 끝 Task의 과거 이름 제한은 #258에서 대체하여 linked leaf도 이름 editor를 연다. 편집 가능한 이름 클릭에서는 작업 URL을 열지 않고, readonly 이름처럼 editor가 열리지 않는 행과 Chart bar의 기존 URL 동작은 유지한다. Readonly에서는 inline editor가 없다.

전용 unit/E2E 명세에는 세 유형, 단일 클릭과 F2, Enter/blur/Escape, 오류·중복·IME, 숫자 원문, 401/409/412/네트워크, 링크 무관 작업, 새로고침 영속성, Grid/Chart 인스턴스 및 390/768/1024/1440px overflow를 포함한다. 이 명세와 구현은 정적 검토만 했으며 실제 로컬 test/lint/typecheck/build/브라우저 조작, 구현 전후 화면 수치는 사용자 지시에 따라 **NOT TESTED**다. 공식 SVAR React Gantt Core 2.7.3의 text column, `getTable(true)`와 Table `open-editor`/`close-editor` API 및 설치 EventBus 순서를 확인했다(2026-09-24); 공식 demo의 실제 조작은 미실행이다. API·DB·Scheduling·Security 계약 문서 변경은 서버 계약 불변으로 N/A다.

## Issue #177 Project 상태 빠른 변경

Project List의 상태 열은 표시 전용 badge 대신 현재 상태를 유지하는 compact native select를 제공한다. 각 control은 프로젝트명을 포함한 accessible name을 가지며 키보드만으로 `예정 / 진행 중 / 완료`를 선택할 수 있다. 변경을 시작하면 대상 Project의 canonical snapshot을 다시 읽어 최신 revision/status를 확보하고 current edit session이 있으면 그대로 사용한다. 세션이 없으면 기존 편집 비밀번호 dialog를 열며 취소·잘못된 비밀번호·rate limit에서는 status PATCH를 보내지 않는다. 비밀번호는 component state에서 제출 직후 비우며 URL·로그·persistent storage에 저장하지 않는다.

실제 저장은 기존 `PATCH /api/projects/{publicId}`에 `{ status }`만 보내고 strong `If-Match`를 사용한다. 성공 시 canonical mutation response의 status만 목록 표시 override에 반영하여 페이지 전체 reload 없이 기존 검색/고급 필터 predicate를 즉시 다시 계산한다. 따라서 기본 `예정 + 진행 중` 보기에서 `진행 중 → 완료`는 행과 결과 건수가 즉시 줄고, 완료 필터를 선택하면 같은 canonical 상태로 다시 보인다. 412에서는 최신 Project를 다시 읽어 stale 선택을 폐기하고, 401/403에서는 성공처럼 표시하지 않는다. 동일 행 mutation 중 selector와 행 action은 중복 실행을 막는다.

Project Workspace의 title row는 readonly에서 기존 lifecycle badge를 그대로 표시한다. edit mode에서는 같은 위치가 compact native select가 되며 Project Settings를 열지 않고 직접 status-only PATCH를 수행한다. 성공 canonical snapshot은 기존 React workspace state에 적용하고 `ProjectGantt` reset generation이나 route navigation을 바꾸지 않는다. 412와 일반 실패는 canonical snapshot을 재조회해 status draft를 폐기하고, 401/403은 기존 readonly 권한 상태로 되돌린다. Settings를 이후 열면 같은 canonical status를 선택값으로 사용한다.

SVAR Task field에는 Project status를 추가하지 않으며 Gantt editor/instance lifecycle과 독립된 Project-level metadata control로 유지한다. API/DB schema 및 scheduling 계산은 변경하지 않는다.

## Issue #196 일정 Toolbar Task/Milestone 빠른 보기

Project Workspace의 일정(Schedule) 도구줄에 `[ 전체 | Task | Milestone ]` 버튼 그룹(`role="group" aria-label="작업 유형 빠른 보기"`)을 배치한다.

- 사용자는 고급 필터 패널을 열지 않고도 Toolbar에서 일반 Task 또는 Milestone만 빠르게 중심 조회할 수 있다.
- 버튼 전환은 독립된 별도 필터 상태를 생성하지 않고 기존 #83의 `TaskFilterState.types`를 조작한다.
  - `전체`: `types = []` (유형 제한만 해제하고 검색어, 기간, 리소스 등 다른 조건은 유지)
  - `Task`: `types = ["task"]`
  - `Milestone`: `types = ["milestone"]`
- 고급 필터 패널에서 복합 유형(예: `["task", "milestone"]`)을 선택한 경우, 빠른 보기 버튼 중 특정 버튼이 선택된 것으로 오인되지 않도록 `aria-pressed="false"`(비활성) 상태를 유지한다.
- child match 시 필요한 ancestor Summary는 기존 `filterTasksWithAncestors()` 정책에 따라 context row로 유지되며 match count에는 포함하지 않는다.
- 버튼 전환은 client-side view state로 동작하여 API 재요청, Project mutation, revision 증가, Gantt remount를 유발하지 않으며 SVAR 공개 `filter-tasks` action을 재사용한다.
- 읽기 전용(readonly)에서도 동일하게 사용 가능하며, 390/768/1024/1440px 및 전체화면 모드에서 컨트롤 겹침 없이 키보드 Tab 및 `aria-pressed` 접근성을 보장한다.


## Issue #186 물류 구성 및 담당자 관리 화면 UI (물류 LG-03)

Project Workspace의 탭 목록을 `일정 (schedule)`, `리소스 (resources)`, `물류 구성 (logistics)` 3개 탭으로 확장한다. ArrowLeft/ArrowRight/Home/End 키보드 탐색과 ARIA tab 연결을 제공하고, 탭 전환 시 기존 Gantt 인스턴스와 scroll/scale/tree/column/selection 상태를 유지한다.

물류 구성 탭은 공정 관리, 설비 관리, 물류 시스템, 제어·조율 관계의 4개 서브 탭을 제공한다. 공정 WBS와 Gantt WBS를 구분하고, 설비의 제어 시스템 및 Owner/Contributor, 시스템의 process scope/조율 관계 및 PI/Developer를 기존 Project-local 물류 API와 global Resource 카탈로그에 연결한다.

Readonly에서는 조회만 허용하고 edit session이 유효할 때만 mutation action을 표시한다. 최신 main API 계약에 따라 조율 관계 교체는 `childSystemIds`를 사용하고 DELETE는 영구 삭제 semantics를 따른다. 401/403은 workspace를 readonly로 강등하며, canonical metadata/task/link mutation 응답의 logistics aggregate를 보존한다. 390/768/1024/1440px, Escape 취소, document overflow 및 Gantt mount 보존을 Chromium E2E로 검증한다.

## Issue #187 일정 화면 공정·설비·시스템 범위 필터 (물류 LG-04)

일정(Gantt) 화면의 고급 검색/필터 패널에 물류 도메인 3개 차원의 범위 필터가 추가되었다:

- **필터 차원**:
  - `공정 필터 (processIds)`: 프로젝트에 정의된 공정 목록 다중 선택
  - `설비 필터 (equipmentIds)`: 프로젝트에 등록된 설비 목록 다중 선택
  - `시스템 필터 (systemIds)`: 프로젝트에 등록된 물류 제어/조율 시스템 목록 다중 선택
- **상속을 고려한 Effective 매칭**:
  - 작업의 직접 연결뿐 아니라 상위 Summary의 `subtree` 상속 연결을 종합한 effective 설비/시스템 집합(`buildTaskEffectiveLogisticsMap`)을 계산하여 필터 조건과 대조한다.
  - 공정 필터의 경우, 작업에 effective 연결된 설비의 소속 공정(`equipment.processId`) 및 연결된 시스템의 담당 공정(`system.processIds`)과의 교집합을 판별하여 일치 여부를 결정한다.
- **계층 무결성과 Context Row 보존**:
  - 필터 조건에 일치하는 leaf 작업(Task 또는 Milestone)이 있을 때, 해당 작업의 모든 조상 Summary 작업은 트리 계층 표시를 위해 화면에 컨텍스트 행(context row)으로 보존된다.
  - 도구줄에 표시되는 검색/필터 일치 결과 수(`일치 / 전체`)에는 실제 일치한 작업 수만 집계하며, 계층 유지를 위해 보존된 context Summary는 카운트에서 제외된다.
- **클라이언트 전용 필터링 및 Gantt 인스턴스 보존**:
  - 필터 선택 및 초기화는 서버 mutation이나 API 재조회를 유발하지 않으며, SVAR 공개 `filter-tasks` action을 통해 동일한 Gantt instance에서 렌더링 가시성만 전환한다.
  - 필터 패널의 Escape 닫기 및 필터 버튼으로의 focus 복귀, 390/768/1024/1440px 반응형 레이아웃 규칙을 유지한다.

## Issue #188 공정·설비·시스템·담당자 대시보드 및 일정 연동 (물류 LG-05)

물류 구성(`logistics`) 탭의 첫 번째 기본 서브탭으로 **물류 대시보드(`dashboard`)**가 추가되었다. (서브탭 목록: `대시보드 (dashboard)`, `공정 관리 (processes)`, `설비 관리 (equipment)`, `물류 시스템 (systems)`, `제어·조율 관계 (relations)` 5종)

- **필터 및 옵션 바**:
  - 기준일(`asOfDate`): `YYYY-MM-DD` native date input (기본값 오늘).
  - 임박 기준(`horizonDays`): 1~90일 범위의 숫자 입력 (기본값 14일).
  - 시스템 집계 범위(`systemView`): `직접 연결만 (direct)` vs `조율 범위 포함 (coordination)`.
  - 활성 마스터만 보기(`activeOnly`): 체크박스 토글.
  - 새로고침 버튼: 최신 서버 스냅샷 기반 대시보드 데이터 수동 재조회.
- **4대 핵심 KPI 카드 그리드**:
  - **기간 가중 진척률**: `Σ(duration * progress) / Σ(duration)` (Summary 및 Milestone 제외, taskId 중복 없이 정확히 1번 집계)과 시각적 진행 게이지 바, 총 대상 작업 수 및 총 기간(근무일수) 표시.
  - **미완료 지연 작업**: 기준일 기준 `progress < 100 AND end < asOfDate`인 지연 일반 작업 건수 및 '일정 필터' drill-down 버튼.
  - **마일스톤 경보**: 기준일 이전 미달성된 지연 마일스톤 수 및 `horizonDays` 이내 도래하는 임박 마일스톤 수 경보 뱃지 및 drill-down 버튼.
  - **투입 계획 공수**: 대상 작업들에 배정된 리소스 계획 공수의 총 M/D 및 M/M 환산치, 공수 미배정 일반 작업 건수 표시.
- **데이터 품질 및 구성 진단 패널**:
  - 물류 미연결 일반 작업 수 및 전체 대비 백분율.
  - 주 제어기(Primary Controller) 미매핑 설비 건수.
  - 주 담당자(Primary Owner) 미지정 설비 건수.
  - 주 책임자(Primary PI) 미지정 물류 시스템 건수.
  - 프로젝트 전체 설비 수량(`quantity`) 합계.
- **공정·설비·시스템별 세부 현황 표 및 일정 Drill-down 연동**:
  - 3개 탭(공정별 / 설비별 / 시스템별)으로 세부 breakdown 테이블 전환.
  - 각 행마다 코드, 명칭, 유형, 주 제어기/책임자, 매핑 작업 수, 기간 가중 진척률, 지연 작업 수, 계획 공수(M/D)를 표시.
  - 각 행의 **'일정 필터'** 버튼 클릭 시, Workspace가 `일정 (schedule)` 탭으로 즉시 전환되며 해당 대상의 ID 또는 연계 작업 ID 목록(`taskIds`, `processIds`, `equipmentIds`, `systemIds`)이 일정 화면의 검색/필터 패널에 자동으로 반영되어 관련 작업들만 즉시 필터링 표시된다.
  - 탭 전환 및 drill-down 과정에서도 기존 Gantt 인스턴스 DOM 및 편집/선택 상태가 보존된다.
- **접근성 및 반응형**:
  - `ArrowLeft`/`ArrowRight`/`Home`/`End` 키보드 탐색(5개 서브탭 지원), WAI-ARIA `role="tab"`/`aria-selected`/`aria-controls` 완전 준수.
  - 390px, 768px, 1024px, 1440px viewport에서 가로 스크롤 테이블 및 유연한 카드 그리드 배치로 레이아웃 깨짐을 방지한다.
## Issue #189: 프로젝트 복사·삭제·내보내기 연계 및 물류 기능 통합 검증 (물류 LG-06)

- **프로젝트 복사 모달 (`ProjectCopyButton`)**:
  - 원본 프로젝트의 일정·휴일뿐 아니라 물류 구성(공정 계층, 설비, 시스템, 제어·조율 관계, 리소스 역할, 태스크 물류 연결)과 리소스 배정이 동일 트랜잭션에서 함께 복사된다.
  - 다이얼로그 본문에 작업·연결·휴일 수 외에 `공정 N · 설비 N · 시스템 N` 카운트를 함께 표시하고, "서버에 저장된 최신 일정·물류 구조를 독립 복사하며, 글로벌 리소스 참조는 그대로 유지됩니다." 안내 문구를 제공한다.
  - 비활성 마스터나 비활성 리소스가 포함된 프로젝트 복사 완료 시, 반환된 `warnings` 목록을 하단 토스트 알림(`notify("info", warning)`)으로 사용자에게 안내한다.
  - `진척률 0%로 초기화` 옵션 선택 시 Leaf 작업 및 마일스톤 진척은 0으로 초기화되고 Summary 작업은 계층 규칙에 따라 자동으로 재계산된다.
- **Excel 내보내기 모달 (`ProjectExcelExportButton`)**:
  - 기존 작업 관계 포함/제외 선택에 더하여, "물류 구성 보고서 포함 (공정·설비·시스템·연결 시트)" 체크박스 옵션을 제공한다 (기본 체크).
  - 체크 시 프로젝트에 등록된 물류 데이터가 있을 경우 독립된 `"Logistics"` 시트가 추가되어 공정/설비/시스템/제어·조율/역할/태스크-물류 연결 정보를 포함한다.
  - 보고서에는 "본 시트는 물류 구성 보고용 출력물이며, 전체 프로젝트 무손실 재가져오기(Import) 백업 파일이 아닙니다." 안내를 명시한다.

## Issue #264 새 프로젝트 생성 초안 보존

생성 방식별 폼은 처음 방문할 때 마운트하고 이후 `hidden` panel 안에 유지한다. 빈 프로젝트의 이름·소유자·설명·상태와 템플릿의 선택·검색·이름·소유자·기준일은 같은 페이지에 머무는 동안 각각 보존한다. 숨겨진 폼은 접근성 탐색과 Tab 이동에서 제외한다. 페이지 이탈 이후의 영구 저장은 제공하지 않는다.

생성 요청 중에는 두 방식 탭의 클릭·방향키/Home/End 전환과 중복 제출을 차단한다. 실패 시 비민감 초안과 현재 방식은 유지하며 사용자가 명시적으로 재시도한다. 비밀번호는 storage나 URL에 저장하지 않고 제출 payload 확보 후 폼 메모리에서 지우며, 재시도에는 다시 입력한다. 초기 `?mode=template`과 본문 바로가기 뒤 현재 폼으로 진입하는 동작을 유지하며, 활성 panel의 첫 입력에 focus가 들어오면 tablist의 역방향 탐색도 즉시 복원한다. 템플릿 목록의 오류·선택 UX 개선은 Issue #265에서 별도로 다룬다.

## Issue #195 프로젝트 템플릿 등록·관리 및 템플릿 기반 프로젝트 생성

- **프로젝트 템플릿으로 저장 (`ProjectSaveAsTemplateButton`)**:
  - 프로젝트 상세 화면(Readonly/Edit 공통) 도구줄의 "더보기(More)" 메뉴에 "템플릿으로 저장" 항목을 제공한다.
  - 클릭 시 `WorkspaceDialog` 기반 템플릿 저장 대화상자가 열리며, 원본 프로젝트의 WBS 계층, FS 링크, 캘린더/휴일, 리소스 배정 및 물류 마스터/역할/태스크 연결 정보가 근무일 상대 오프셋(`offsetDays`) 기반의 표준 스냅샷으로 캡처된다.
  - 템플릿 이름(필수, 1~200자)과 설명(선택)을 입력받으며, 확인한 원본 revision과 작업 수가 요약 정보로 표시된다. 현재 DTO와 입력 폼에는 카테고리가 없다.
  - 저장 완료 시 하단 성공 토스트(`notify("info", ...)`)를 띄우고 메뉴 트리거로 focus를 복원한다. 원본 프로젝트 데이터는 변경하지 않으며, 필요한 원본 비밀번호 인증은 기존 unlock 경로로 편집 세션을 발급할 수 있다.

- **템플릿 기반 새 프로젝트 생성 (`/projects/new` 및 `CreateFromTemplateForm`)**:
  - 새 프로젝트 생성 페이지(`/projects/new`) 상단에 "빈 프로젝트 만들기"와 "템플릿에서 만들기" 2개 탭(`NewProjectTabs`)을 제공한다 (`role="tablist"` 및 키보드 화살표 탐색 지원).
  - **템플릿 선택**: 등록된 활성 템플릿 목록을 그리드 카드로 표시하며, 템플릿명/설명 실시간 검색창을 제공한다. 각 카드는 설명, 작업/마일스톤 수와 물류 포함 여부를 표시한다. 동일 그룹의 native radio로 클릭·방향키·Space 선택을 지원한다.
  - **시작일 기준 일정 자동 재계산**: 새 프로젝트명, 시작일(`projectStartDate`, 기본 오늘), 소유자, 비밀번호(필수 1~12자)를 입력받는다. 인스턴스화 시 지정 시작일 기준으로 작업들의 일정이 근무일 캘린더에 맞춰 자동 재배치되고, 스케줄링 엔진(`recalculateFinishStartDependencies` + `recalculateHierarchy`)을 통해 FS 종속성 및 상위 Summary 일정을 재계산한다. 진척률은 0%로 초기화된다.
  - **세션 자동 발급 및 즉시 전환**: 인스턴스화 완료 시 생성된 프로젝트에 대한 편집 세션 쿠키가 즉시 발급되어 사용자가 비밀번호를 다시 입력할 필요 없이 곧바로 새 프로젝트 편집 화면으로 이동한다.
  - **데이터 독립성 및 오류 처리**: 템플릿이 삭제되어도 생성된 프로젝트는 보존되며, 원본 프로젝트가 삭제되어도 템플릿은 보존된다. 성공한 빈 배열만 등록된 템플릿 없음으로 표현한다. HTTP·네트워크·잘못된 응답은 오류와 명시적 목록 재시도로 구분한다.
  - **접근성 및 반응형**: 390px, 768px, 1024px, 1440px viewport에서 카드 그리드가 유연하게 재배치되며 가로 overflow가 발생하지 않는다.

## Issue #265 템플릿 선택·검색·오류 복구

검색에는 보이는 label, 일치 수/전체 수와 초기화를 제공한다. 검색 결과 밖에서도 현재 선택 요약을 유지하며, 선택이 필터로 숨겨졌으면 이를 알린다. 검색만으로 선택이나 생성 초안을 변경하지 않는다. 다른 템플릿을 선택할 때 현재 프로젝트 이름이 이전 자동 제안과 같을 경우에만 새 제안으로 바꾸고, 사용자가 수정하거나 비운 이름은 유지한다.

최신 목록을 확인하기 전에는 선택·제출을 차단하며 오래된 비동기 응답을 무시한다. 필드 오류를 `aria-invalid`/`aria-describedby`로 연결하고 validation 실패 시 오류 입력으로 focus를 옮긴다. 일반 입력 수정은 해당 오류만 해제한다. 서버 실패는 별도 alert로 알리고 초안과 재시도 경로를 유지한다. 기존 공통 form/error 스타일과 semantic token을 사용하며 긴 카드·폼이 390px에서도 문서 가로 overflow를 만들지 않도록 한다. #264의 hidden panel·초안·중복 제출·비밀번호 삭제 계약은 계속 적용한다.

## Issue #200 관계 Context Menu에서 관계 종류(FS/SS/FF/SF)·Lag 설정 및 일정 재계산

- **관계선 컨텍스트 메뉴 (`RelationContextMenu`)**:
  - Gantt Chart 영역에서 관계선 SVG(`[data-link-id]`)를 우클릭(`contextmenu`)하면 마우스 커서 위치에 관계 설정 컨텍스트 메뉴가 열린다.
  - 선행 작업명(`from`)과 후행 작업명(`to`)을 안내 라벨로 명확하게 표시한다.
  - **관계 종류 선택**: `FS` (Finish-to-Start, 종료 후 시작), `SS` (Start-to-Start, 시작 후 시작), `FF` (Finish-to-End, 종료 후 종료), `SF` (Start-to-End, 시작 후 종료) 라디오/셀렉트 선택 제공.
  - **Lag(지연/선행) 입력**: 근무일수 단위의 정수(음수 선행 lead, 양수 지연 lag)를 입력할 수 있는 숫자 입력 필드 제공.
  - **동작 및 검증**:
    - 기존 값과 변경사항이 없을 경우 "저장" 버튼이 자동으로 비활성화(disabled)되어 불필요한 서버 호출을 방지한다.
    - 저장 시 `PATCH /api/projects/{publicId}/links/{linkId}`를 호출하여 원자적 일정 재계산 및 뷰 갱신을 수행한다.
    - "관계 삭제" 버튼 클릭 시 기존 DELETE 호출을 통해 관계를 제거한다.
    - Escape 키를 누르거나 메뉴 외부를 클릭하면 변경을 취소하고 메뉴를 닫는다.
  - **SVAR React Gantt 시각화 연동**:
    - 관계선 데이터 변환기(`projectLinksToSvarLinks`)에서 `FS → e2s`, `SS → s2s`, `FF → e2e`, `SF → s2e`로 실시간 매핑하여 차트 상에 연결점이 정확하게 렌더링된다.





## Issue #201 프로젝트 재진입 시 Gantt Grid 접힘/펼침(Summary open/collapsed) 상태 복원

- 프로젝트 단위로 브라우저 `localStorage`(`mastergantt:summary-toggle:<projectPublicId>`)에 접힌 Summary task ID 목록을 v1 스키마로 저장한다.
- 마우스 및 키보드 `open-task` 액션 발생 시 최신 상태를 저장하고, 동일 브라우저 프로필에서 재진입/새로고침 시 Gantt API 초기화 후 1회 복원한다.
- 다른 프로젝트의 상태는 섞이지 않으며 삭제/변환된 stale Summary ID는 로드 시 필터링 후 정규화된 값으로 storage에 다시 기록한다.
- 새 Summary는 기존 기본 상태를 사용하고, localStorage 접근 실패·용량 초과·malformed JSON은 비파괴적으로 무시한다.
- 서버 DB/API/Project revision에는 영향을 주지 않는 client-side UI preference다.
- Fullscreen/필터/일정↔리소스 전환에서는 현재 살아 있는 Gantt interaction state를 persisted preference보다 우선한다.

## Issue #202 Schedule Item Baseline 저장·편집·Grid 표시

- Baseline은 현재 일정과 독립적인 계획 스냅샷이며 Task/Milestone에 start/duration/end를 저장한다.
- Task Editor의 작업 정보 탭에서 Baseline을 현재 일정으로 복사하거나 수정·삭제할 수 있다. Summary는 descendant leaf에서 파생된 값을 읽기 전용으로 표시한다.
- 모든 descendant leaf에 Baseline이 있는 Summary만 complete Baseline을 가지며, partial Summary는 완전한 Baseline으로 표시하지 않는다.
- Grid에는 `기준 시작`, `기준 종료` optional column을 제공하며 기본은 숨김이다.
- Baseline mutation은 기존 edit-session / If-Match / revision / canonical snapshot 계약을 따른다.
- Project Copy는 Baseline을 보존한다.
- **Chart Baseline bar/toggle은 이번 Issue #202 범위에서 분리하여 Issue #253에서 처리한다.** SVAR PRO Baseline 기능을 사용하지 않고 Core 공개 API/state 기반 Alignment POC를 먼저 통과해야 한다.

## Issue #266 관계 편집 안전성

Relation Editor는 공통 native Dialog를 사용해 배경 조작과 focus 이탈을 차단한다. 공통 Dialog는 Tab/Shift+Tab 경계에서 활성·표시된 control 사이를 순환하며 disabled/hidden/inert 요소를 제외한다. 후보의 Enter/Space 선택, 후보만 닫는 Escape, dirty 종료/관계 전환 확인, 대상이 명시된 삭제 확인과 요청 중 닫기·중복 실행 방어를 제공한다. 명시적 닫기 버튼은 후보 popup이 열려 있어도 popup만 닫고 멈추지 않고 닫기/dirty 확인 흐름으로 진입한다. 관계 생성 성공 시 새 관계 방향·후보·검색·Type·Lag 초안을 기본값으로 되돌린다. 기존 부모의 호출 위치 focus 복원과 Gantt 상태를 유지하며 상세 동작은 [관계 편집 계약](TASK_RELATIONS.md#issue-266-관계-편집-dialog의-키보드초안요청-보호)을 따른다. 공통 Dialog 헤더는 긴 제목을 줄바꿈하고 닫기 버튼의 글자는 한 줄로 유지한다.

## Issue #377 Task Editor 관계 탭 → Relation Editor

Task Editor 관계 탭은 정보와 핵심 command를 한 곳에 두고 상세 관계 설정은 기존 Relation Editor로 progressive disclosure한다.

- 편집 가능한 Task/Milestone은 관계 탭 상단의 **관계 추가**와 각 relation row의 **편집 / 삭제**를 사용한다. Readonly와 Summary는 조회 의미를 유지하고 mutation action을 노출하지 않는다.
- 저장하지 않은 Task draft가 있으면 relation command를 disabled하고 사유를 같은 탭에 표시한다. 관계 mutation 전에 Task 초안을 강제로 폐기하거나 자동 저장하지 않는다.
- Relation Editor를 열 때 Task Editor component/draft/active tab/scroll을 보존한다. canonical relation mutation 결과는 imperative sync로 Task Editor base에 반영하되 native Task Editor dialog를 다시 top layer에 등록하지 않는다.
- Relation Editor를 닫으면 실제 호출 버튼으로 focus를 복귀한다. 직접 삭제 confirmation은 keyboard trigger를 기억하고 취소 버튼에 focus를 이동한 뒤 취소 시 trigger로 복원한다.
- 390/768px에서는 relation row action이 자연스럽게 stack/wrap되고 1024/1440px에서는 선행/후행 2열 data-dense 구조를 유지한다. document/dialog horizontal overflow를 허용하지 않는다.

## Issue #203 관계선 더블클릭 Relation Editor 및 관련 아이템 검색·추가·삭제

- **진입 경로 및 인터랙션**:
  - Gantt 타임라인의 관계선(`[data-link-id]`) 더블클릭 시 Relation Editor 다이얼로그 모달 오픈.
  - 관계선 우클릭 Relation Context Menu 상단에 "관계 관리... (Relation Editor)" 버튼을 제공하여 키보드/마우스 우클릭 보조 경로 지원.
- **다이얼로그 구조**:
  1. **선택된 관계 설정**:
     - 선행 작업(Predecessor) 및 후행 작업(Successor) 정보(이름, 일정, 기간) 카드 표시.
     - **Anchor(기준 작업) 선택**: "선행 작업을 기준으로 보기" / "후행 작업을 기준으로 보기" 버튼을 통해 기준 작업 전환.
     - 관계 유형(`FS/SS/FF/SF`) 셀렉트 및 Lag(일 단위) 입력 필드.
     - 수정 시 "수정 저장" 활성화, "관계 삭제" 액션 지원.
  2. **기준 작업의 연결된 관계 목록**:
     - Anchor 기준 선행 작업(Incoming) 및 후행 작업(Outgoing) 목록을 카드 리스트로 표시.
     - 각 항목에서 유형/Lag 확인, 선택(현재 편집 대상으로 전환), 삭제 액션 지원.
  3. **새 관계 추가**:
     - 연결 방향 선택: "후행 작업으로 추가 (기준 → 대상)" / "선행 작업으로 추가 (대상 → 기준)".
     - 검색 자동완성: 프로젝트 내 모든 Leaf Task 및 Milestone을 이름/ID로 실시간 검색 (Summary 작업 및 자기 자신, 이미 연결된 중복 관계는 후보에서 자동 제외).
     - 관계 유형 및 Lag 설정 후 "관계 추가"를 통해 단일 화면에서 신규 의존성 생성.
- **접근성 및 상태 보존**:
  - `Escape` 키 닫기 및 모달 내부 Focus Trap 지원.
  - 모달 열기/닫기/추가/수정/삭제 시 Gantt 차트 인스턴스, 스크롤 위치, Summary 접힘 상태가 초기화되지 않고 유지됨.
  - 읽기 전용(`readonly`) 모드에서는 정보 조회만 가능하며 편집/삭제/추가 폼 비활성화.

## Issue #230 프로젝트 목록 필터 입력 컨트롤 너비 및 날짜 범위 From/To 정렬 개선

- 프로젝트명·소유자·설명·소유자 지정 여부의 조건 선택 `select`는 compact한 9.5rem 폭을 사용하고, text input은 14rem의 content-aware 폭을 사용한다.
- 생성일/최근 변경일의 `range` 조건은 From/To date input을 동일한 9.5rem 폭으로 배치하며, 단일 날짜 조건도 같은 date-control 폭을 사용한다.
- 48rem 이하에서는 프로젝트 정보와 날짜 조건 행을 세로 배치하고, From/To는 동일 폭 2열로 유지한다. 28rem 이하에서는 날짜 입력을 1열로 전환한다.
- global filter label 스타일과 충돌하지 않도록 local selector specificity를 확보하며, 공용 `secondary-button`은 `:global(.secondary-button)`으로 선택한다.
- 기존 Project List 필터 predicate, validation/timezone, Escape focus restore, API/DB/revision 계약은 변경하지 않는다.

## Issue #231 프로젝트 화면 '정보'/'더보기' 팝오버 포커스 이탈 시 자동 닫힘

- **외부 인터랙션 및 포커스 이탈 감지**:
  - 헤더 영역의 '정보' 및 '더보기' disclosure를 controlled state(`infoPopoverOpen`, `actionMenuOpen`)로 관리한다.
  - `document` 레벨의 `pointerdown` 및 `focusin` 이벤트 리스너로 클릭 또는 키보드 `Tab` 이동이 trigger + popup 영역 밖으로 벗어나면 자동으로 닫는다.
  - 팝오버 내부의 버튼, 링크, 입력 요소 사이 포커스 이동은 유지하여 내부 조작 가능성을 보장한다.
  - 모달 다이얼로그(`dialog`, `[role="dialog"]`) 내부 상호작용은 outside interaction으로 처리하지 않는다.
- **상호 배타적 오픈 및 접근성**:
  - '정보'와 '더보기'는 동시에 열리지 않으며, 다른 disclosure를 열면 기존 disclosure를 닫는다.
  - 동일 trigger 클릭의 toggle 동작과 `Escape` 닫기/trigger 포커스 복원 동작을 유지한다.
- **회귀 검증**:
  - Playwright E2E에서 외부 pointer 닫힘, Tab/focus 이탈 닫힘, disclosure 상호 배타, 프로젝트 복사 Dialog 내부 조작 예외를 검증한다.

## Issue #232 프로젝트 설정 다이얼로그 정보 구조·탭·반응형 폼 레이아웃 개선

- **전용 와이드 다이얼로그 및 WAI-ARIA 탭 구조**:
  - `WorkspaceDialog`에 `size="wide"`(최대 60rem 폭) 지원을 추가하여 다른 다이얼로그(38rem)에 영향 없이 설정 다이얼로그의 데스크톱 가용 공간 활용.
  - `ProjectSettingsDialog`를 독립 컴포넌트로 분리하고 WAI-ARIA APG 준수 탭 인터페이스(`role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`) 적용.
  - 키보드 `ArrowLeft/ArrowRight` 및 `Home/End` 키를 통한 탭 포커스 이동 지원.
  - 탭 전환 시 각 패널 컴포넌트를 unmount하지 않고 `hidden` 속성으로 제어하여 작업 캘린더 규칙/미리보기, 비밀번호, 설명 등의 초안(draft) 상태 100% 보존.
- **카테고리별 정보 구조(IA) 및 레이아웃**:
  - **기본 정보**: 프로젝트 이름과 상태(compact select)를 2열 그리드로 정렬하고 설명 textarea는 전체 폭으로 배치하여 불필요한 단일 세로 스택을 지양.
  - **작업 캘린더**: 국가 공휴일 규칙 및 휴무일 항목에 2열 그리드와 우측 정렬 액션 행을 적용하여 항목 밀도와 가독성 대폭 향상.
  - **편집·보안**: 비밀번호 변경 폼과 세션 안내 카드 및 편집 모드 종료 액션을 독립 분리하여 안전하고 명확한 세션 관리 지원.
- **반응형 및 안정성 보존**:
  - 390/768px 모바일에서 1열 스택으로 자연스럽게 리플로우되어 가로 overflow 방지.
  - `Escape` 키 닫기 및 닫힘 후 '프로젝트 설정' 트리거 버튼으로의 포커스 복원 보존.
  - Gantt 인스턴스, 트리 접힘 상태, 스크롤 위치 보존 및 API/DB 스키마 불변 유지.

## Issue #233 Project Gantt 정보 밀도

Project Workspace의 일정 화면은 동일 viewport에서 Timeline 가용 면적을 늘리기 위해 다음 기본 geometry를 사용한다.

- 초기 Grid 폭: **480px**
- 작업/외부 ID/시작/기간 column: **180 / 108 / 104 / 56px**
- Day scale cellWidth: **44px**
- Week scale cellWidth: **68px**
- 기간 cell은 canonical working-day duration 숫자만 표시하며 DB/API/Scheduling 의미는 변경하지 않는다.

Grid/Chart resizer와 column resize는 계속 SVAR 공개 API를 사용한다. Day/Week 전환은 현재 mounted Gantt instance와 사용자가 조정한 column 폭을 보존해야 하며, scale 전환 때문에 사용자 resize 상태를 초기값으로 되돌리지 않는다. 390/768/1024/1440px에서 document-level unintended horizontal overflow를 만들지 않고 Gantt 내부 scroll은 기존 계약대로 허용한다.

## Issue #234 리소스 관리 검색 및 그룹 구성원 작업 UX 개선

- **독립 검색 및 상태 관리**:
  - `/resources` 관리 화면에서 리소스 목록, 리소스 그룹 목록, 그룹 구성원 할당 목록 각각에 독립적인 실시간 검색 툴바 추가.
  - 이름(`name`) 및 코드(`code`) 대소문자 무시 substring 일치 지원, 앞뒤 공백 자동 trim, null code 안전 처리.
  - 일치 건수 카운터(`일치 n / 전체 N`, 구성원: `일치 n / 전체 N · 선택 M`)를 통해 검색 결과 현황을 즉시 파악 가능.
  - `Escape` 키 입력 시 검색어 즉시 초기화 지원.
  - 데이터 전체 부재(`등록된 리소스가 없습니다.`)와 검색 결과 부재(`검색 조건과 일치하는 리소스가 없습니다.`) 상태 명확히 분리.
- **그룹 구성원 선택 상태 보존**:
  - 검색어로 일부 리소스가 숨겨지더라도 체크 상태(`selectedMembers`)를 100% 보존.
  - `구성원 저장` 시 검색 필터링 여부와 무관하게 전체 선택된 리소스 ID 목록을 원자적으로 PUT 전송.
- **구성원 액션 푸터 정돈**:
  - `memberFooterActions` 전용 스타일을 적용하여 데스크톱에서 `닫기`(secondary) 좌측, `구성원 저장`(primary) 우측 정렬로 일관되게 배치.
  - 390/768px 모바일에서 자연스러운 flex-wrap 배치로 버튼 겹침 및 가로 overflow 방지.


## Issue #235 Resource 관리 화면

`/resources`는 일반 콘텐츠 페이지보다 높은 정보 밀도가 필요한 관리 workspace다. Issue #452부터 App Shell header와 첫 heading 사이의 compact top spacing을 `/logistics-admin`, `/project-master-admin`과 공통 관리 shell로 적용한다. Project List/Workspace/생성 화면의 별도 `.main-content` geometry 계약은 유지한다.

로그인 후 상단 관리 명령은 `관리자 비밀번호 변경 / 새로고침 / 로그아웃`을 하나의 행으로 그룹화한다. 내부 optimistic concurrency 번호인 `Catalog Revision N`은 화면에 표시하지 않지만 catalog `revision`, `If-Match`, 412 stale reload 계약은 그대로 유지한다.

관리자 비밀번호 변경은 상시 카드가 아니라 `WorkspaceDialog`로 제공한다. Dialog는 Escape/cancel 닫기, trigger focus 복원, 닫을 때 비밀번호 state clear를 보장한다. 비밀번호 정책은 서버와 동일하게 1~12 Unicode code point이며 HTML `maxLength`로 UTF-16 code unit 제한을 추가하지 않는다.

## Issue #260 Project Workspace 필터 영역 밀도와 의미 그룹

일정 Toolbar는 #83/#130/#196의 검색·필터·빠른 보기·Reset·결과 계약을 유지하면서 가용 폭을 우선 활용한다. 1440px 이상은 가능한 한 한 행을 유지하고, 1024px 전후는 최대 두 행의 content-aware grid로 재배치한다. 768px에서는 검색/필터와 빠른 보기/Reset/결과가 불필요하게 전체 폭을 독점하지 않으며, 390px에서만 빠른 보기와 결과 영역을 필요한 만큼 추가 적층한다. Resource Toolbar도 검색+필터와 결과+Reset의 두 의미 행을 사용하고 768px에서 검색 이외 control을 기계적으로 full-width로 만들지 않는다.

Task 고급 필터는 하나의 flat grid 대신 **텍스트 / 일정·수치 / 유형·할당 / 물류** section으로 구분한다. 작업명·설명·External ID의 operator/value, 기간 조건·From·To, 진행률 Min/Max, 기간 Min/Max처럼 함께 해석하는 control은 같은 group에서 읽히도록 배치한다. Resource/Group 대상 picker는 종류·검색·ANY/ALL을 별도 compact grid로 묶고, 공정·설비·시스템 checkbox는 공통 CSS list를 사용해 긴 한국어 이름과 code가 panel 밖으로 밀리지 않게 한다. 기존 inline style은 공통 class로 이동하며 모든 grid child는 intrinsic width로 인한 overlap을 막기 위해 min-width 0 계약을 가진다.

Resource 고급 필터는 종류·상태·Task From/To 계약을 변경하지 않고 1024/768px에서 2열, 390px에서 1열로 reflow한다. 필터 predicate, active count, ancestor Summary context, SVAR `filter-tasks`, canonical Gantt instance, API 재조회 금지, Escape 후 Filter trigger focus 및 Reset 후 search focus는 그대로다. E2E는 390×844·768×900·1024×900·1440×900·1600×900에서 Advanced Panel 열린 상태, 긴 물류 label, direct toolbar child overlap, 모든 input/select의 panel 수평 bounds 및 document-level overflow를 실제 bounding box로 검증한다.

## Issue #261 근무·휴무 날짜 예외

기존 설정 → 작업 캘린더에서 `사용자 날짜 예외`를 편집한다. 항목은 이름·날짜·대상·대상 선택·일 유형을 고유 label과 fieldset으로 묶는다. Resource Group/Resource는 근무일(WORKING)과 휴무일(NON_WORKING)을 선택하고 Project 전체는 휴무일만 제공한다. 근무일 항목을 Project 대상으로 바꾸면 휴무일로 정규화하고 polite 상태로 알린다. 기존 semantic token/system font와 좁은 화면의 한 열 리플로우를 유지한다.

미리보기는 프로젝트 일정 영향과 리소스 날짜 예외 영향을 분리한다. 예외별 `적용됨`/`현재 효과 없음`은 바로 위 계층과 비교한 효과이며 더 구체적인 Resource 예외가 최종 결과를 다시 바꿀 수 있다. 상세에서는 Resource별 상위 상태, 해당 예외 효과, 최종 상태와 적용 출처를 구분한다. 대상 0명인 그룹은 그 사실을 표시하며 NO_EFFECT warning만으로 저장을 차단하지 않는다.

같은 수준의 근무/휴무 충돌은 날짜·대상·규칙·영향 Resource를 식별하는 focus 가능한 오류 요약으로 안내하고 입력으로 이동하는 명령을 제공한다. 동일 초안의 저장은 차단하며 입력 변경 시 충돌과 기존 preview를 무효화한다. PUT 충돌에도 과거 성공 preview를 남기지 않는다. publicId/revision 변경 시 이전 컨텍스트의 충돌 상태를 폐기한다.

저장 후 canonical Calendar와 Project snapshot을 다시 조회하여 서버가 정규화한 날짜 유형을 반영한다. Group/Resource 날짜 예외는 Resource workload만 변경하고 Project Task start/end/duration과 기존 Gantt instance/선택/스크롤을 보존한다. 기존 401/412·초안 보호·늦은 응답 방어 계약은 유지한다. 실제 검증과 잔여 미검증은 [Issue #261 설계·검증 기록](ISSUE_261_RESOURCE_CALENDAR.md)을 따른다.

## Issue #258 — Dependency-aware 편집 결과

Grid 연결 Task의 이름과 Task Editor의 metadata/progress/Baseline 편집을 허용한다. 요청 시작일은 canonical `requestedStart`로 표시하고 적용 start/end는 저장된 값으로 별도 표시한다. 일정 변경은 서버의 전체 graph 계산 결과로 한 번 확정한다. Chart move는 start-only, 왼쪽 resize는 start+근무일 duration, 오른쪽 resize는 duration-only, progress는 progress-only다. inProgress pointer와 내부 canonical 동기화는 mutation을 만들지 않는다.

저장 결과 안내는 요청일→적용일 차이와 변경된 후행 leaf 건수 및 최대 3개 Task 이름/externalId를 표시한다. Manual/리소스 충돌은 초안을 유지하고 원본 canonical 화면을 복구한다. filter-hidden successor도 응답 full snapshot에 포함되며 Gantt instance/filter/scroll/tree/scale/selection 유지 경로를 재사용한다. linked 구조 명령 보호와 readonly/stale/busy 계약은 유지한다. Baseline 복사는 저장된 적용 일정 기준이며 미저장 일정 초안은 먼저 저장하도록 안내한다.


## Issue #300 Grid 작업 행 이동 영속성

Grid에서 행을 놓으면 Context Menu와 같은 보호된 계층 명령으로 parent/sibling order를 저장한다. 드래그 중의 표시 순서는 미확정 상태이며 놓은 이동의 서버 저장이 성공해야 확정된다. 이후 이름·진행률 등 일반 필드를 수정하거나 프로젝트를 다시 열어도 확정된 위치를 유지한다. 저장 중 후속 이름 편집·이동은 잠그고, 실패하거나 revision 충돌이 발생하면 최신 canonical 위치와 오류 안내를 표시한다. 재조회가 성공하면 같은 Gantt/API 인스턴스를 사용한다.

기존 Grid/Chart 배치, Light semantic token, Context Menu·inline 이름 편집·Task Editor 흐름을 재사용하는 interaction 결함 수정이다. 새로운 화면 구조·PRO 기능·Undo/Redo·정렬 정책을 추가하지 않으므로 `DESIGN.md`와 `UI_UX_GUIDELINES.md`의 공통 원칙 변경은 N/A다. 390/768/1024/1440px에서는 기존 내부 Grid scroll과 document overflow 기준을 적용한다. 관련 실제 API 회귀는 `tests/e2e/project-grid-reorder-persistence.spec.ts`에서 DnD→rename→일반 필드 수정→Context Move→reload, 실패/412 복구와 Gantt identity를 검증한다. 로컬 실행 결과와 동일 PR head의 원격 `quality/e2e/docker` 판정은 별도로 기록한다.

## 물류 유형 관리 UX (Issue #280)

전역 navigation의 **물류 관리** → `/logistics-admin`에서 설비 유형과 시스템 유형을 관리한다. 로그인 후 category 전환, 유형 추가, 표시명 수정, 활성/비활성 전환, 사용 건수 확인, 새로고침, 비밀번호 변경, 로그아웃을 제공한다.

Project Workspace의 설비/시스템 추가·수정 select는 active catalog 이름을 표시하고 payload에는 stable code를 저장한다. 기존 row의 현재 type이 inactive이면 해당 값은 `비활성`으로 유지 표시한다. Catalog fetch 실패는 empty state로 처리하지 않으며 저장을 차단하고 재시도를 제공한다.

관리자 비밀번호 변경 dialog는 Escape/닫기/취소 등 모든 닫기 경로에서 새 비밀번호 초안을 즉시 지운다. 서버 logout 요청이 실패하거나 네트워크 오류가 나면 UI는 로컬 관리 화면을 잠그되, 서버 session revoke가 확인되지 않았음을 오류로 명시하여 성공한 logout과 구분한다.


## Issue #315 Gantt Day Header 상세정보

일정 탭의 Day Header는 #314의 숫자-only 밀도를 유지한다. Header cell hover/focus에서 locale 요일을 표시하고 현재 Project Effective Calendar에 이름이 있는 NON_WORKING 날짜에만 휴일명을 추가한다. Tooltip은 Chart layout을 늘리지 않는 overlay이며 viewport 안으로 보정하고 pointer interaction을 가로채지 않는다. 동일 날짜의 복수 이름은 canonical snapshot projection을 사용하며 WORKING override는 휴일명으로 표시하지 않는다. Week view에는 이번 Tooltip을 확대하지 않는다.



## Issue #316 Gantt Week Header 근무일·공휴일 상세정보

일정 탭의 Week Header는 기존 ISO `Wxx`와 68px 폭을 유지한다. Header hover/focus에서 현재 Project Calendar의 실제 7일 근무일 수와 명명된 NON_WORKING 날짜를 progressive disclosure한다. 근무일 수는 월~금 고정값이 아니라 Scheduling calendar의 NON_WORKING/WORKING override를 적용하며, 이름 없는 NON_WORKING은 수치에만 반영한다.

Week Tooltip은 #315 Day Tooltip과 동일한 keyboard/focus, `aria-describedby`, Escape, viewport clamp, resize/scroll 재배치 정책을 사용한다. Day↔Week 전환으로 반대 scale의 target/overlay가 남지 않아야 하며 Project API 재조회, schedule mutation, Gantt/API remount를 발생시키지 않는다. Resource/Resource Group Calendar는 공통 Header 범위에서 제외한다.

## Issue #416 Gantt Week Header 근무 가능 일수 상시 표시

일정 탭의 Week Header는 기존 ISO `Wxx`와 **68px 폭을 유지**하면서, 같은 cell 내부에 현재 Project Calendar 기준 실제 근무 가능 일수를 `N일` secondary text로 상시 표시한다. 이 값은 #316 Tooltip이 사용하는 canonical `workingDays` 결과를 그대로 재사용하며 별도의 월~금/holiday 차감 계산을 만들지 않는다.

Header에는 어느 요일이 근무 가능한지, 공휴일명·비근무 사유를 상시 노출하지 않는다. `Wxx + N일`은 여러 주의 capacity를 빠르게 비교하는 요약이고 상세 원인은 기존 hover/focus Tooltip에서 확인한다. Day↔Week, virtualization, resize/fullscreen에서도 app-owned Week date class lifecycle로 label을 재동기화하되 API 호출, 일정 mutation, Gantt remount, Week cell width 변경을 발생시키지 않는다.

## Issue #289 — 프로젝트 기준정보 UX

`/projects/new` 및 Project 설정의 기본 정보에 사업부·제품·사업장/법인 Select를 추가한다. 세 필드는 선택 사항이며 active catalog만 신규 선택지에 제공한다. catalog 조회 실패는 “선택지 없음”과 구분해 오류/재시도 상태를 표시하고 저장 가능한 정상 빈 목록으로 오인하지 않는다. 기본 필드 validation은 catalog loading 여부와 독립적으로 먼저 제공하며, 유효한 제출은 catalog 확인 전에는 저장하지 않는다.

기존 선택값이 inactive이면 현재값을 “비활성”으로 유지·표시하고 사용자가 다른 active 값 또는 미지정으로 명시적으로 변경할 수 있다. 전역 `/project-master-admin`은 사업부/제품/사업장·법인을 category별로 관리하고 WAI-ARIA tablist/tabpanel, roving tabindex, ArrowLeft/ArrowRight/Home/End 탐색을 제공한다. SVAR Task Editor 내부 모델에는 Project master metadata를 결합하지 않는다.

## Issue #344 — 작업 삭제 실패와 확정 일정 보존

아래 `EMPTY_SUMMARY_NOT_ALLOWED`는 #344 조사 당시 정책과 재현 기록이다. #345 이후 마지막 child 삭제는 성공하고 빈 Summary는 유지된다. 현재 #344 실패 복구 회귀는 유효한 Dependency409/401/412/network를 사용하며 확정 snapshot 보존 계약은 동일하다.

Task C 삭제가 서버에서 성공한 뒤 Summary의 마지막 child 삭제가 `409 EMPTY_SUMMARY_NOT_ALLOWED`로 거부되면, 마지막 child는 유지되고 이미 삭제된 Task C는 Grid/Chart에 다시 나타나지 않아야 한다. 실패 복구의 범위는 현재 요청에서 발생한 미확정 변화다. 빈 Summary를 자동 삭제하거나 일반 Task로 전환하지 않는다.

Workspace는 서버에서 마지막으로 확정된 Project snapshot을 보관한다. Snapshot 적용 시 현재 Project의 `publicId`와 revision을 확인하고, 다른 Project이거나 확정 revision보다 낮은 응답은 적용하지 않는다. 초기 조회와 오류 복구 GET은 `cache: "no-store"`를 사용한다. 재조회가 실패하거나 오래된 응답을 반환하면 마지막 확정 snapshot을 기존 SVAR API 동기화 경로로 다시 적용한다. 삭제 실패를 처리하기 위해 page reload나 Gantt remount를 사용하지 않으며, Summary 접힘·스크롤·scale과 기존 인스턴스를 보존한다. 조회 실패 안내는 원래 mutation 오류와 함께 표시해 `EMPTY_SUMMARY_NOT_ALLOWED` 원인을 가리지 않는다.

`401`은 읽기 전용으로 전환하고 편집 잠금 해제를 안내한다. `412`는 최신 일정을 확인하도록 안내하며, network 실패는 서버 저장 여부를 단정하지 않고 canonical GET 결과를 확인한다. GET이 현재 확정 revision 이상이면 해당 서버 상태를 적용하고, 조회할 수 없으면 마지막 확인 상태를 유지한다. 실패 요청을 자동 재전송하지 않는다. 서버 authorization·Origin·revision 계약과 Task Editor 초안 정책은 기존 계약을 따른다.

성공 삭제의 canonical 동기화는 남아 있는 sibling끼리의 순서를 비교한다. 삭제된 앞쪽 sibling 때문에 index가 줄어든 것을 reorder로 해석하지 않으며, 불필요한 `move-task`로 기존 Summary의 접힘 상태를 바꾸지 않는다.

조사 기준 main `6532edd8418772454b96fdeb895b90c5ab7d3d6d`에서 실제 SQLite/Chromium의 일반 삭제 성공→정상 409→현재 canonical GET 조합을 두 차례 반복했을 때 원증상은 재현되지 않았다. 별도로 복구 GET에 낮은 revision의 삭제 전 snapshot을 주입하면 성공 삭제 Task가 다시 표시되는 결함은 재현됐다. 따라서 이 변경은 오래된 응답의 무조건 적용과 복구 GET 실패 시 remount 경로를 보완하며, 정상 409가 반드시 오래된 응답을 생성한다고 단정하지 않는다. 검증 상세와 상태는 [TEST_PLAN](TEST_PLAN.md#issue-344--작업-삭제-실패-복구-회귀)을 따른다.

## Issue #332 — 프로젝트 기준정보 관리자 정보 계층 및 상태 필터

전역 `/project-master-admin`은 Project edit 화면과 분리된 글로벌 기준정보 관리자라는 점을 화면 구조에서도 명확하게 표현한다.

- 인증 전에는 관리자 인증 제목·설명·비밀번호·로그인 액션을 하나의 section으로 묶고 일반 기준정보 입력과 혼동되지 않도록 divider/surface 차이를 사용한다.
- 인증 후에는 현재 관리자 인증 상태와 비밀번호 변경·새로고침·로그아웃 액션을 별도 section으로 유지하고, 그 아래에 프로젝트 기준정보 관리 section을 둔다.
- 사업부/제품/사업장·법인 category는 기존 WAI-ARIA `tablist`/`tabpanel`, roving tabindex, ArrowLeft/ArrowRight/Home/End 계약을 유지한다.
- category panel 안에서 **항목 추가**와 **목록**을 hairline divider와 heading hierarchy로 구분한다. 목록은 이름/코드/정렬/상태·사용/작업 column header가 있는 semantic table을 사용한다.
- 목록 상태 필터는 `전체 / 활성 / 비활성` 3개 button group이며 기본값은 전체다. 필터는 이미 조회한 catalog snapshot에만 적용하는 client-side view state이고 catalog mutation이나 revision 증가를 발생시키지 않는다.
- 상태 필터는 category를 바꾸어도 유지한다. 필터 결과가 0건이면 현재 선택 상태에 맞는 empty state를 표시한다.
- 좁은 화면에서는 document 자체를 넓히지 않고 목록 table wrapper 안에서만 수평 scroll을 허용한다. 390/768/1024/1440px에서 category/filter/action control은 접근 가능해야 한다.
- Project Master 관리자 session, Origin, login rate-limit, bootstrap credential, `If-Match` revision, CRUD 및 inactive 참조 보존 계약은 기존 동작을 유지한다.

## Issue #343 Project List 사업부·제품·법인/사업장 표시 계약

Project List는 #289의 canonical `ProjectListItemDto.businessUnit/product/siteEntity`를 그대로 사용해 **사업부 / 제품 / 법인·사업장**을 독립 table column으로 표시한다. 별도 catalog fetch나 row별 조회를 추가하지 않으며 raw id/code가 아닌 catalog `name`을 사용자 표시값으로 사용한다.

값이 없으면 기존 nullable metadata와 같은 `미지정`을 표시한다. 기존 Project가 inactive catalog를 참조하더라도 값을 숨기지 않고 표시명 뒤에 `(비활성)`을 붙여 색상에 의존하지 않는 의미를 제공한다. 긴 기준정보명은 row 높이를 늘리지 않는 한 줄 ellipsis로 제한하되 동일 span의 `title`에서 전체 값을 확인할 수 있어야 한다.

프로젝트명 primary Link, 상태 select, owner/description/date, More Row Action과 native `table/thead/th/tbody/td` semantics는 유지한다. 1440px/wide에서는 가용 폭 안에서 세 분류 column을 직접 비교할 수 있도록 하고, 1024px 이하에서는 column을 숨기지 않고 기존 table wrapper 내부 horizontal scroll을 사용한다. document-level unintended horizontal overflow는 만들지 않는다.

이번 변경은 표시 전용이며 사업부/제품/법인·사업장 검색·필터·정렬, API/DB/Scheduling/SVAR Gantt 계약을 추가하지 않는다.

## Issue #403 — Project List 날짜 열 및 Column Budget 계약

Project List의 생성/최근 변경 열은 동일한 metadata column policy를 사용한다.

- 생성/최근 변경 값은 locale/timezone 기반 실제 날짜·시간 문자열이 서로 또는 작업 열을 침범하지 않아야 한다.
- 날짜·상태·작업처럼 최소 폭이 필요한 metadata 열과 프로젝트명·설명 같은 flexible 열의 우선순위를 구분한다.
- Project List에 새 열을 추가하거나 label/format을 변경할 때는 전체 column budget을 다시 계산한다. 기존 percentage width의 단순 유지로 완료 처리하지 않는다.
- viewport가 부족하면 `tableWrap` 내부 horizontal scroll을 허용하되 document-level unintended horizontal overflow는 만들지 않는다.
- header/body alignment, 긴 사업부·제품·법인/사업장·소유자·설명, 생성/최근 변경 datetime, Row Action을 같은 fixture에서 검증한다.
- 390/768/1024/1440/wide desktop 실제 browser evidence와 sibling cell geometry를 확인한다.

세부 공통 기준은 `DESIGN.md`의 Data Table Column Sizing과 `docs/UI_UX_GUIDELINES.md`의 Data-dense Table Column / Geometry 검토 기준을 따른다.


## Issue #303 — 완료 작업 Grid 표시

Task/Milestone의 canonical status가 completed이면 Grid 작업명 텍스트에 취소선을 표시하고 완료 해제 시 같은 Gantt instance에서 즉시 제거한다. Summary는 derived progress가 정확히 100일 때 같은 완료 표시를 사용한다. 완료 표시는 색상에만 의존하지 않으며 tree toggle, indentation, selection, inline-name edit/focus hit area를 변경하지 않는다.

Task Editor는 기존 desktop의 작업명/진행률 2열 배치를 유지하면서 상태 Select를 진행률 보조 영역에 결합한다. 390/768px에서는 status/progress를 자연스럽게 stack하여 overflow를 만들지 않는다. #399 scope tab 전환과 fullscreen/search/filter/scroll/tree/column 상태도 이 표시 때문에 초기화하지 않는다.

## Issue #335 관계 연결 작업의 sibling reorder

Dependency가 연결된 Task/Milestone도 현재 parent 안에서 순서만 바꾸는 Context Menu `Move Up/Down`과 Grid `before/after` DnD를 사용할 수 있다. linked descendant를 가진 Summary/subtree도 같은 규칙을 사용한다. 관계가 있다는 사실 자체를 reorder 비활성 조건으로 쓰지 않는다.

성공 시 서버 canonical snapshot이 siblingOrder와 Project revision을 확정하며 Link, 일정, #303 status/progress 필드는 그대로 유지한다. Grid/Chart row와 relation line은 같은 Gantt instance에서 새 행 위치를 따라 다시 렌더링하고 reload 후에도 순서와 관계를 함께 유지한다. #399 Workspace WBS 범위 탭/scoped guard, readonly, mutation pending, stale/401/412/network 실패 복구는 기존 계약을 유지한다.

상위 `Move` submenu는 기존 #116의 keyboard/geometry 계약을 유지한다. unlinked boundary Task처럼 하위 방향 명령이 모두 비활성인 경우에도 기존 UX대로 submenu를 열 수 있고, linked Task는 Move Up/Down 중 실제 가능한 방향이 있으면 상위 메뉴를 활성화한다. 다른 parent로 들어가는 Grid `child`/cross-parent before/after, Indent/Outdent, Cut/Paste, Delete, Convert는 기존 Dependency 보호를 유지한다.

## Issue #370 — Grid 시작일 Date Picker

Grid의 `projectStart` 열은 계속 서버 확정 effective `start`를 표시한다. 편집 가능한 leaf Task/Milestone에서는 셀 single click과 Enter/Space가 masterGantt 소유의 compact `input[type=date]` Picker를 셀 인접 overlay로 연다. Picker 초기값은 사용자가 현재 Grid에서 보고 있는 effective start이며, 날짜를 실제 선택했을 때만 그 calendar date를 새 requested start로 서버에 제출한다. 비근무일을 선택한 Auto Task는 서버가 다음 유효 근무일 또는 dependency lower bound로 이동시킬 수 있고 기존 schedule-adjustment 안내를 사용한다.

SVAR 2.7.3의 공개 inline `datepicker`를 우선 검증했으나 현재 `projectStart`는 실제 row field가 아니라 getter 기반 display-only 열이어서 설치 버전 Gantt Grid에서 editor가 생성되지 않았다. 따라서 Issue 요구에 정의한 fallback을 사용하며 Core row에 임시 `projectStart`를 저장하지 않는다. 기존 Task command gateway와 revision으로 start-only PATCH를 수행한 뒤 canonical snapshot으로 Grid/Chart를 in-place 동기화한다. Summary/readonly/saving에서는 Picker를 열지 않는다. Escape는 저장 없이 닫고 원래 셀로 focus를 복원하며, 실패 시 scroll/tree/column/scale/selection과 마지막 canonical 일정은 유지한다. Task Editor의 요청 시작일 편집과 의미는 같지만 Grid quick edit은 기간·종료일을 직접 편집하지 않는다.

### Issue #299 — Chart bar 수직 Drag & Drop

Chart의 Task/Summary/Milestone bar를 위·아래로 drag해 같은 parent의 visible sibling 앞/뒤로 순서를 바꾼다. gesture는 dead-zone 뒤 한 축으로 lock되며 vertical로 확정되면 기존 좌우 일정 이동/resize를 같은 gesture에서 실행하지 않는다. target bar 위/아래 drop indicator와 긴 프로젝트 edge-scroll을 제공한다.

검색·필터·접힘으로 보이지 않는 bar와 다른 hierarchy level은 drop 기준으로 사용하지 않는다. #335 linked same-parent reorder는 허용하며 #399/#407 subtree scope를 벗어난 command는 실행하지 않는다. 성공 뒤 Grid/Chart/reload는 canonical siblingOrder와 같은 순서를 유지한다.

## Issue #412 — Resource Catalog 전역 역할 관리

`/resources`의 Resource 영역은 이름/코드/개발자 등급과 별도로 **전역 역할** checkbox group을 제공한다. 생성과 기존 Resource 편집 모두 `PI`, `개발자`, `설비 담당`을 복수 선택할 수 있고 역할이 없으면 전역 역할 열에 `없음`을 표시한다. #453부터 checkbox는 생성/프로필 dialog에서 제공하며 프로필 변경은 명시 저장한다.

개발자 등급과 전역 역할은 서로 다른 의미다. 역할 checkbox 조작으로 등급 select가 자동 변경되지 않으며 반대도 동일하다. Resource Group 구성원 선택 화면은 각 Resource 역할을 참고 텍스트로 보여 주지만 역할에 따라 구성원을 자동 추가/제거하지 않는다.

각 checkbox는 Resource명+역할의 accessible name을 갖고 native keyboard 동작을 사용한다. 저장 중에는 기존 catalog mutation lock을 공유하며 성공/401/412/오류 복구는 기존 Resource Catalog UX를 재사용한다. 390/768/1024/1440px에서는 역할 control이 내부에서 wrap되며 document-level horizontal overflow를 만들지 않아야 한다.

SVAR PRO Resource management는 사용하지 않으며 이 화면은 app-level master data 관리자 화면으로 유지한다. 상세 설계는 [ISSUE_412_RESOURCE_ROLES.md](ISSUE_412_RESOURCE_ROLES.md)를 참조한다.

## Issue #426 — Resource Catalog 역할 UI geometry 정돈

#426의 Identity/Profile/상태·삭제 경계와 footer 보호는 유지한다. #453부터 동시 두 pane·inline 생성/프로필 편집은 아래 독립 탭·표·dialog 계약으로 대체한다. 과거 Resource pane > Group pane 비율/vertical stack은 새 화면의 인수 기준이 아니다.

Resource Group 구성원 footer는 `닫기` secondary를 좌측, `구성원 저장` primary를 우측에 둔다. 두 버튼은 동일한 control 높이/baseline을 유지하며 좁은 화면에서 wrap되더라도 DOM/keyboard 의미 순서와 document overflow 부재를 보존한다.

이 변경은 Resource Catalog의 관리자 session, Origin, strong `If-Match`, revision/412 stale recovery, 삭제 usage guard, Group membership, 역할 PATCH 실패 시 draft 보존 계약을 변경하지 않는다. #288의 개발자 등급 읽기 표시와 #412의 역할 요약 표시 계약도 유지한다.

## Issue #414 — Resource 역할 공수 및 개발 견적

Resource tab의 기존 Group → Resource → Task hierarchy를 유지하면서 역할 기반 분석을 같은 full-width workspace 안에 확장한다.

상단은 전체 계획 공수·공수 미설정·과투입과 PI/개발자/설비 담당/역할 미지정 역할 subtotal을 flat summary로 제공한다. 고급 필터에는 수행 역할과 개발자 등급을 추가하며 `개발 견적` preset은 Resource + DEVELOPER 조건을 한 번에 적용한다. 필터는 서버 집계를 다시 요청하지 않고 현재 성공 snapshot의 drill-down 표시 범위만 변경한다.

역할/기간/등급 필터가 적용되면 Group/Resource row의 표시 subtotal은 현재 보이는 Task만 합산한다. 반대로 상단 Project 전체 및 역할 subtotal은 필터와 무관한 서버 권위 값이다. 개발자 row에는 등급을 표시하고 Task detail에는 수행 역할, canonical 상태/진행률/일정, allocation 기간/%, 계획 M/D·M/M을 함께 표시한다. 지연은 Project timezone 기준 `미완료 && end < 기준일`이다.

기존 independent workload/assigned-target query, stale 결과 보존, source별 retry, M/M 미설정 비활성화, Resource tab 내부 table horizontal scroll, 390/768/1024/1440 responsive, 일정↔리소스 탭 전환 시 Gantt mount/state 보존 계약을 유지한다.


## Issue #452 — 공통 관리자 shell·인증 presentation과 action 간격

`/resources`, `/logistics-admin`, `/project-master-admin`은 동일 관리 page shell을 사용한다. 로그인 전후 heading 시작점과 gutter는 동일하며, description의 자연 줄 수를 고정 높이로 숨기지 않는다. 공통 compact top padding은 1.25rem, bottom은 2.5rem이다. Page 최대 폭은 100rem, 좌우 gutter는 24px(640px 이하 16px), heading은 24px, heading→content gap은 16px이다. 인증 panel만 최대 32.5rem으로 제한하고 기존 관리 목록/작업 영역의 별도 폭은 유지한다.

공통 인증 presentation은 padding 1rem, gap 0.75rem과 제목·권한 설명·visible password label·입력·제출·오류/상태를 제공한다. desktop input/submit은 40px 높이와 bottom alignment를 공유하고, 540px 이하에서는 입력 다음 제출 순서로 쌓는다. 입력은 reset 이후에도 border/background/padding/font/focus/disabled가 식별 가능하며 고유 오류 ID와 연결된다.

물류 관리자 만료 재인증은 로그인 입력이 mount된 뒤 focus를 복원하도록 타이밍을 보정한다. 기존 인증·권한 정책 자체는 바꾸지 않는다.

인증 logic은 각각의 feature에 남는다. Resource/Logistics/Project Master session·비밀번호·API 및 Project edit permission은 서로 교차 승인하지 않는다. Enter/중복 제출 방지/401·403·429/만료 후 재인증/민감 입력 삭제/기존 focus 정책, #268 일반 초안·복구 및 #280/#332 dialog·CRUD·revision 계약을 보존한다.

Secondary button은 기본 외부 margin 0이며 간격은 부모 toolbar/form/footer/독립 CTA가 소유한다. `.text-link`의 기존 간격, KPI의 `margin-top:auto` 및 Task Editor 44px hit-area는 유지한다. 세부 Resource 탭/row·물류 표·기준정보 표 재설계는 #453–#457 후속 범위다. [실행 계획](exec-plans/active/ISSUE_452.md)과 [테스트 계획](TEST_PLAN.md)의 실제 증거를 함께 확인한다.


## Issue #461 양쪽 Editor의 완료 단계 관리

Task/Summary 작업 정보의 단일 완료 단계 검색과 Milestone의 두 번째 소속 작업 N 탭은 같은 canonical Membership을 관리한다. Summary 기본값과 자손 override를 구분하고 해제는 상속 복귀다. Milestone 후보는 Task/Summary이며 현재 단계 조회와 전체/타 단계 후보 검색을 구분한다. 변경은 검색이나 선택 시 저장하지 않고 기본 한 PATCH 또는 소속 batch 한 POST로 명시 저장한다.

기본·소속·Resource·Logistics의 별도 초안은 탭 전환에 남고 교차 mutation을 잠근다. 연결 작업 열기/일정에서 보기와 닫기/최신 조회에는 전체 미저장 초안의 명시 폐기 확인이 필요하다. 성공은 full canonical tasks/links/revision을 기존 Workspace와 열린 Editor에 반영하며 Gantt를 remount하지 않는다. 오류/401/412/network에서 초안을 자동 폐기하거나 재전송하지 않는다. 완료·재개는 상태 명시 저장이며 구조 변경과 묶지 않는다.

고정 Header/Tab/Footer와 단일 active body scroll을 유지한다. 탭은 한 행 내부 horizontal scroll과 동적 keyboard navigation, 소속 표는 이름/WBS300+유형88+현재 단계180+방식/출처180+상태100+명령112=960px 내부 scroll을 사용한다. 390/768/1024/1440/1920px 실제 Chromium 측정과 캡처는 `output/playwright/issue-461/`에 생성하며 원격 E2E의 같은 fixture로 검증한다. 최종 수동 UX/실기기/스크린리더와 PR quality/e2e/docker는 별도 상태다.


## Issue #453 — 리소스 관리 독립 탭과 명시 프로필 저장

기본 `리소스 N`과 `리소스 그룹 N`은 동일 카탈로그의 독립 tabpanel이다. 두 panel은 mounted 상태로 유지하고 비활성 panel은 `hidden`으로 접근성과 focus에서 제외한다. ArrowLeft/Right, Home/End로 탭을 활성화하고 focus를 탭에 유지한다. 다음 Tab은 활성 검색으로 이동하며 Up/Down을 가로채지 않는다. 탭 전환은 GET/mutation을 수행하지 않고 각 검색·상태 조건·표 scroll·구성원 선택과 검색을 보존한다.

리소스 표는 이름/코드 240px 이상, 역할 badge 200px, 등급 112px, 상태/사용 176px, 작업 248px의 최소 976px budget을 갖는다. 그룹 표는 이름/코드 240px 이상, 구성원 수 104px, 상태/사용 176px, 작업 280px의 최소 800px budget이다. fixed 열은 padding을 포함하며 identity만 남는 폭을 사용한다. 긴 한국어/영문 값은 wrap하고 전체 이름을 title과 accessible name으로 제공한다. 좁은 화면의 가로 scroll은 각 표 wrapper가 소유하며 활성 panel은 #452 shell의 가용 작업 폭을 사용한다. 1920px viewport 전체 폭을 작업 폭으로 간주하지 않는다. 검색·전체/활성/비활성·일치 건수·추가 버튼은 toolbar에서 reflow한다.

목록은 표시 중심이며 생성은 compact dialog, 기존 리소스 프로필은 한 dialog에서 등급과 전역 역할을 함께 편집한다. 입력 변경으로 PATCH하지 않고 `프로필 저장` 한 번이 `developerGrade`와 ordered `roles`를 포함하는 기존 PATCH를 원자적으로 호출한다. 역할과 등급, 그룹 구성원의 의미는 독립적이다. 생성 이름 200자·코드 64자 한도는 유지하며 profile에 이름/코드 편집을 추가하지 않는다. 모달은 native WorkspaceDialog를 재사용하며 내부 revision 번호를 표시하지 않는다. 최신 목록 기준 저장 안내로 사용자 맥락을 제공하고 actual If-Match/revision 검증은 유지한다. 생성은 이름, profile은 등급, 폐기 확인은 `계속 편집`에 표시 후 focus를 둔다.

Dirty 생성/profile 취소·닫기·Escape는 `계속 편집 / 초안 폐기` 확인을 거친다. 취소는 원래 control, 폐기는 호출 버튼으로 focus를 복원한다. Group 구성원 section은 그룹 탭 안 목록 아래에 하나만 표시한다. 탭 이동은 초안을 유지하고 다른 그룹 선택 또는 구성원 닫기는 dirty 확인을 거친다. 검색에서 사라진 선택은 보존하며 전체 선택 ID를 PUT한다. 최신 조회에서 그룹이나 선택 Resource가 사라져도 초안을 남기고 이유를 표시하며 부분 PUT를 차단한다. Footer는 닫기 좌측·구성원 저장 우측·동일 높이/중앙 정렬을 유지한다.

두 inline 생성 폼을 동시에 채우던 기존 회귀는 modal 배경 접근 금지 정책에 맞게 이관한다. 실패한 생성 초안·수동 재시도·성공한 저장 단위만 정리는 계속 검증하며 다른 단위 초안 보존은 선행 Group 구성원 초안과 생성 실패/성공을 교차한다. 열린 모달의 `최신 목록 조회`는 기존 GET을 명시 실행하며 초안을 덮어쓰거나 mutation을 자동 재시도하지 않는다.

Pending에서 disabled control 때문에 focus가 body로 빠지지 않도록 해당 열린 native dialog에 focus를 두고, owned panel의 Escape capture로 반복 닫기 요청을 차단한다. Tab/ShiftTab은 dialog 안에 유지한다. Pending은 기존 동기 ref와 표시 disabled를 공유하여 이중 submit·입력·모달 닫기/Escape를 잠근다. 401은 모든 비밀번호를 지우고 로그인 focus로 전환하며 비민감 초안을 memory에 보존한다. 인증 전에는 초안 모달이 로그인 focus를 가리지 않는다. 재로그인 후 최신 카탈로그를 조회하고 `보존한 초안 계속 편집`으로 명시 재진입한다. 412는 기존 최신 GET과 strong If-Match 계약을 유지하며 최신 저장 값과 보존 초안을 검토한 후 수동 저장한다. network/5xx/불명 응답은 저장 완료로 취급하지 않고 mutation을 잠가 명시 최신 조회로 복구한다. 403은 성공 표시 없이 초안을 보존한다.

명시 로그아웃은 성공 또는 서버 확인 실패 모두 관리 화면을 잠근다. 기존 catalog·선택 Group·선택 members·비밀번호 초기화 범위를 유지하며 일반 생성 입력/검색까지 임의 초기화하지 않는다. 삭제는 서버 `deletable === true`일 때만 허용하며 사용 중·사용 여부 미확인을 구분한다. 409/412 삭제 재검증, 취소 호출 버튼 focus·삭제 후 검색 focus 계약은 유지한다. API/DB/auth/domain/공유 dialog primitive 변경은 없다.

## Issue #454 물류 유형 native table 밀도·열·dialog

설비/시스템 유형의 기존 버튼 그룹·공유 상태 필터·inline 추가 폼은 #330 계약을 유지한다. 이름 수정은 stable code를 바꾸지 않는 name-only PATCH이고 활성 변경은 active-only PATCH다. 기존 사용 건수와 프로젝트의 비활성 유형 참조 정책은 서버 계약을 그대로 따른다.

목록은 최소824px native table이다. 표시명은 최소240px에서 남는 폭을 받고, 코드160px·상태88px·사용 건수104px·작업232px은 고정 예산을 사용한다. 긴 한글/영문 표시명과 최대64자 코드는 셀 안에서 줄바꿈하며 전체 값을 숨기지 않는다. 사용 건수는 header/body 우측 및 tabular numeric 정렬이다. 두 row action은40px control과8px gap으로 같은 줄에 두고, td 위아래3px padding을 사용한다. 실제 짧은 AGV/agv 및 MCS/mcs 행은5폭 모두47px이며 긴 값은 필요한 만큼 행 높이가 증가한다. 강제 row height/max-height로 자르지 않는다.

390/768px에서 wrapper만 가로 scroll을 소유하고 문서 폭은 viewport를 넘지 않는다. 1024/1440/1920px에서도 #452 shell 가용 폭을 기준으로 표시명이 확장된다. 부분적으로 보이는 버튼에 native Tab focus가 머물 때는 이 목록 wrapper의 focus capture가 필요한 가로 delta만 적용해 focused control과6px outline 공간을 보인다. 문서/세로 위치나 keyboard 순서를 변경하지 않고 이미 충분히 보이는 pointer control은 가로 이동하지 않는다.

이름 수정과 관리자 비밀번호 dialog의 취소/저장·변경은 같은40px control, 우측 정렬과8px gap을 사용한다. 초기 focus는 이름 또는 새 비밀번호이고 비pending Escape/취소는 호출 버튼으로 복귀한다. 비밀번호 닫기·변경 완료·401에는 password draft를 지운다. 동기 중복 제출은 pending ref로 요청1개만 보내며 pending 입력/취소/닫기 잠금과 실행 handler가 일치한다. 모든 control이 disabled인 동안 열린 dialog에 focus를 유지하고 반복 Escape의 native 닫힘을 owned capture에서 차단한다. 공유 WorkspaceDialog는 수정하지 않는다.

412는 최신 GET 성공일 때 stale 안내를 표시하고 입력을 보존한 수동 저장만 허용한다. 최신 GET이 실패하거나401이면 그 조회/인증 원인을 stale 안내로 덮지 않는다. 열린 이름 dialog의 조회 오류에는 기존 GET을 명시 실행하는 `최신 목록 조회`를 보여주며 정상 상태에는 간단한 기존 footer를 유지한다. network·알 수 없는 canonical 응답은 성공/초안 초기화로 처리하지 않고 최신 조회 전 변경을 잠근다. 401은 보호 화면을 잠그고 비밀번호를 비운 후 로그인 focus로 복귀한다. 새로운 dirty 확인 흐름이나 자동 mutation retry는 추가하지 않는다.

#452가 이미 action margin0을 적용했으므로 역사적 분리 CSS의77.78125→53.78125/24px 제거를 이번 개선 수치로 사용하지 않는다. 동일 긴 code dataset의 before 짧은 행은 자동 열 배분과 작업 열 wrap 때문에390/768에서224.96875px,1024에서140.96875px,1440/1920에서100.96875px였다. after는 같은 dataset에서47px이다. 자세한 실측·실행 실패와 검증 경계는 TEST_PLAN의 #454 절을 따른다.

## Issue #462 완료 단계 조회와 Grid 진입

일정 toolbar의 완료 단계 조건(전체/미지정/특정 Milestone)은 유형 빠른 보기와 독립적으로 유지한다. 기존 검색·기간·리소스·물류·WBS scope 조건과 AND로 조합하고 scope별 TaskFilterState Map에 함께 보존한다. 후보는 이름/외부 ID/작업 ID를 trim·case-insensitive 검색하며 canonical start, externalId, taskId 순으로 안정 정렬한다. 요청일은 상세 metadata이며 정렬이나 WBS 저장의 기준이 아니다. 단계 조건 해제는 나머지 조건을 보존하고 전체 초기화는 모두 비운다.

특정 단계의 진짜 matching은 그 Milestone과 effective 일반 Task다. Summary는 필요한 ancestor/설정 context이며 matchCount/matchingTaskIds와 고유 일반 Task 수에서 제외한다. 빈 Summary의 단계 기본값 context는 types를 제외한 다른 조건을 통과해야 하며 scope 밖 행을 끌어오지 않는다. 미지정은 effective target이 없는 일반 Task이며 상속 Task는 포함하지 않는다. 전체 canonical hierarchy로 projection을 계산하고 가시성만 공개 filter-tasks로 적용한다. open:false는 사용자가 접은 tree 상태를 보존한다.

완료 단계 열은 기본 숨김·180px로 기존 열 메뉴에서 선택한다. 기본 최소 budget 433px, 단계 포함 613px, 전체 선택 열 포함 929px이며 작업명 최소 180px와 owned horizontal scroll을 유지한다. 공개 set-columns는 기존 조절 width/flex를 보존한다. 일반 Task/Summary 셀은 effective 이름·직접/상속을 표시하고 focus 가능한 동일 Editor 진입 버튼의 설명/상세에서 전체 이름·외부 ID·작업 ID·상속 출처를 확인한다. Milestone 자신의 행은 소속으로 표시하지 않는다.

Context Menu 완료 단계 연결…은 #461 기본 작업 탭, 소속 작업 관리…은 같은 Editor의 Milestone 소속 탭을 연다. readonly/완료 상태도 조회할 수 있고 pending은 셀·메뉴 표시와 실제 handler 모두 차단한다. 진입은 mutation하지 않으며 Escape/닫기 후 기존 행 focus로 돌아간다. 필터·열 전환은 Project GET/mutation/revision 증가/remount를 만들지 않는다. URL launcher의 DOM observer는 각 Gantt frame에 공급된 full canonical URL Map을 decoration할 뿐 Project GET을 수행하지 않는다. frame cleanup은 이전 URL을 제거하고 다른 프로젝트 데이터와 격리한다. 초기 조회/명시 refresh·retry와 cross-tab canonical catch-up, 서버 authorization은 기존 계약을 유지한다.

특정 M + Milestone-only는 M 자체와 해당 행을 표시하기 위한 scope 내 hierarchy ancestors만 표시한다. Membership 설정용 Summary context/빈 Summary는 추가하지 않는다. 전체/Task-only에서는 설정 context를 유지하며 match/count와 구분한다.

완료 단계 열 표시 시 공개 `set-columns`의 현재 사용자 width/flexgrow를 보존하고 `resize-grid`로 optional 열의 폭 증감만 반영한다. 작업명 최소 180px을 stage 열 추가로 소비하지 않으며 기본 최소 433px/단계 포함 613px/전체 optional 929px 예산은 Gantt 내부 scroll owner에서 처리한다. 2026-10-06 [공식 resize-grid action](https://docs.svar.dev/react/gantt/api/actions/resize-grid/)과 설치 Core 2.7.3 구현을 확인했고, 실제 grip 조절 뒤 단계 열 표시/숨김의 폭 보존은 관련 Chromium fixture로 검증한다.

## Issue #463 완료 단계 대시보드

일정 영역의 Gantt/완료 단계 대시보드는 같은 작업공간의 peer 보기다. Gantt를 mounted 상태로 유지하고 기존 WBS 범위와 검색 조건을 보존한다. 두 peer는 같은 grid cell을 사용하며 비활성 Gantt는 visibility:hidden·inert·aria-hidden으로 layout box를 유지한다. display:none의 0 크기를 Core에 전달하지 않고 비활성 작업의 초점·키보드·접근성 조회를 차단한다. 대시보드만 활성 body scroll을 소유한다. 일반 peer 왕복은 숨김 직전 Grid/Chart native scroll을 기록하고(가로는 .wx-chart, 수직은 .wx-gantt) visible layout 이후 같은 scope/filter에서 기존 canonical/filter/column queue와 공개 scroll-chart action으로 복원한다. DOM 위치만 변경하여 Core 상태와 다르게 유지하지 않는다. 복원 오류는 동일 instance를 유지하며 한 번 안내한다. 현재 viewport의 최대 scroll보다 큰 위치는 브라우저의 정상 clamp를 따른다. 명시 ID/scope drill은 새 대상 이동을 유지한다. 대시보드에는 **프로젝트 전체 기준 · Gantt WBS 범위 미적용**을 표시한다. 전체 일정으로 이동하는 명시적 drill은 대상 ID 조건을 적용하고 이전 Gantt 범위·조건을 복원하는 버튼을 제공한다. 상세와 소속 작업은 #461의 동일 Editor 작업/소속 탭으로 열며 readonly에서도 조회할 수 있다. 서버 mutation 권한은 기존 계약을 따른다. Gantt native fullscreen 영역 안에는 peer 탭이 포함되지 않으므로 fullscreen 종료 후 보기를 전환한다.

기본 조건은 단계 이름·외부 ID·작업 ID 검색, 단계 선택, 자동/수동 기준일, 1~90일 임박 기간이다. 추가 조건은 개인 리소스·assignment 역할·개발자 등급·물류·공수 기간·M/M 기준이다. 적용 조건 수와 기간·환산 기준을 disclosure 밖에도 표시한다. 여러 단계 선택은 같은 milestoneIds 상태에 유지하고 단일 picker 대신 선택 개수와 해제를 표시한다. 검색과 단계 선택은 표시 단계 S만 제한한다. 기간과 리소스·물류 조건은 Project 전체 보고 공수 F를 제한한다.

완료율·Ready·선행 차단·지연·임박·계획 위험·소속 적용률은 중첩 가능한 지표다. 분모 0은 대상 없음, 실제 0은 0%로 표시한다. 단계 전체 상태 표는 서버 full member/predecessor 상태와 진행률을 표시하며 F의 일부 작업으로 Ready를 다시 계산하지 않는다. 전체 원인에는 현재 보고 조건이나 Gantt WBS 밖의 미완료 작업·직접 선행 단계도 이름과 ID로 공개한다. 완료 기록 불일치는 진단이며 자동 완료·재개를 만들지 않는다.

공수 표는 별도로 모든 F 단계 bucket과 미지정을 표시한다. 단계 검색 결과가 0개여도 F 합계가 있으면 유지한다. Grand Total은 표시 단계 행의 합이 아니라 모든 bucket과 미지정의 합이다. M/M은 명시 query 기준, 유효 환경 기준, 미설정 순이며 미설정은 —와 사유를 표시한다. 기준값·출처를 함께 표시하고 고정 20 fallback을 사용하지 않는다.

리소스 drill은 응답의 Project/Catalog revision, 개인 resource/task/assignment ID, 공수 from/to와 원본 Stage total을 전달한다. 기존 Resource 공수 GET에 같은 기간을 요청하고 range echo와 두 revision을 확인한 뒤 기존 표시 필터와 AND로 조합한다. 빈 ID는 전체로 확대하지 않는다. 범위 해제는 기본 Resource 조회 기간으로 복귀한다. Stage 공수는 반올림 전 합계이고 Resource는 기존 반올림 기준이다. Stage 명시 M/M 기준은 Resource에 전달하지 않으며 Resource 환경 기준과 상단 Project 전체 기간 합계/아래 선택 표시 subtotal 차이를 안내한다.

초기 값은 서버 Project timezone의 기준일이다. 수동 기준일은 현재 snapshot의 평가일이며 과거 실제 상태를 복원하지 않는다. 성공 응답은 프로젝트·revision·정규화된 조건 echo·catalog revision을 확인한다. 이전 요청 역전은 무시하고 조건 변경 중 이전 값을 유지하면 stale 사유와 drill 잠금을 표시한다. 오류에는 명시 재시도를 제공한다. 30초 캐시는 활성 진입과 focus/visibility에서 같은 날의 catalog 변경도 catch-up하며 비활성/hidden 무한 polling을 하지 않는다. 자동 날짜 경계 timer는 local Project day당 한 번만 시도하며 실패하거나 서버가 이전 날짜를 유지해도 매분 재요청하지 않는다. focus/visibility의 TTL 재시도는 별도다. known canonical revision 변경은 즉시 재조회한다.

물류 대시보드는 기존 KPI·포함 작업·진척·계획 M/D를 유지하고 관련 단계 전체 상태를 별도 섹션에 표시한다. 관련 단계는 서버 projection이며 화면이 새 Gate를 계산하지 않는다. 미설정 M/M은 —와 기준 설명을 제공한다.


### #463 Context Menu 선택과 peer layout scroll

Gantt의 Task Context Menu로 현재 선택 밖 작업을 열 때 기존 #384의 app-owned `selectedTaskIds/data-copy-selected`와 공개 Core selection mirror를 모두 유지한다. 다만 Context Menu open 직후 app-owned selection과 React/SVAR virtual-row layout 정렬이 내부 Grid scroll을 만들 수 있으므로, 메뉴 scroll guard는 임의 timeout 없이 bounded two animation frames의 opening settle 동안 이 내부 이동을 새 baseline으로 흡수한다. settle이 끝나면 현재 canonical task element의 실제 scroll 위치를 기준으로 arm하며 이후 가로/세로/페이지의 실제 사용자 scroll은 기존처럼 즉시 메뉴를 닫는다. 동일 위치의 지연 scroll 알림은 닫힘 신호가 아니다. Edit/Copy/Cut/Move/Delete 등 메뉴 명령, 일반 click/checkbox/keyboard selection, 권한·revision·scope 계약은 변경하지 않는다.


### #463 Context Menu settle surface 보존

Task Menu opening settle 중 scroll baseline을 다시 잡을 때는 menu를 연 원래 surface를 보존한다. 연결된 trigger가 남아 있으면 그 실제 DOM 요소를 사용하고, virtual row/bar 교체로 끊어진 경우에만 taskId와 원래 `grid|chart` surface를 함께 사용해 동등한 현재 요소를 찾는다. 따라서 Grid selection/layout 내부 보정은 opening settle에서 흡수하면서도 Chart bar에서 연 메뉴의 이후 실제 Chart scroll은 기존처럼 즉시 닫힘 신호가 된다.
