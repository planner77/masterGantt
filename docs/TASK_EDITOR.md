# Issue #4 / #22 / #31 / #72 — 작업 메뉴와 Grid / Chart 작업 명령

## Issue #384 — Copy 선택 집합과 단일 편집 경계

Copy clipboard는 `{mode:"copy", taskIds, revision}`, Cut은 `{mode:"cut", taskId, revision}`이다. 신규 Copy는 taskIds를 보내고 서버는 legacy taskId XOR 호환을 제공한다. canonical root 순서·ancestor 제거는 메뉴/keyboard에 동일하다. Paste target 선택은 clipboard를 유지하고 Project·revision·filter/scope 변화는 stale clipboard를 폐기한다.

Edit/Delete/Cut/Move는 메뉴 또는 실제 focus target 하나다. 여러 선택으로 일괄 편집·삭제·이동을 활성화하지 않는다. Assignment 전체 거부, 내부 Dependency 복제·외부 관계 제외, 빈 Summary null과 copied Baseline null/원본 불변은 서버 계약이다. checkbox Ctrl/Cmd+C/V·ContextMenu/Shift+F10은 안전하게 행을 resolve한다. 다른 입력/inline/Task Editor/dialog/contenteditable 내부 shortcut은 유지한다. modifier 클릭은 이름 editor를 열지 않으며 일반 이름 클릭·double-click Editor·Grid DnD의 기존 경로를 보존한다.

## Issue #378 — Context Menu Copy/Paste 관계 경계

- 관계 endpoint인 Task도 Context Menu와 keyboard `Copy`는 허용한다. Copy는 원본 Task/Link를 변경하지 않는다.
- copy clipboard가 유효하면 linked Task를 anchor로 한 `Paste > Above/Below`를 허용한다.
- `Paste > As child`는 anchor가 linked leaf여서 Summary로 변환되어야 하는 경우 기존 관계 endpoint 보호 때문에 비활성/거부한다.
- Cut clipboard는 기존 linked hierarchy guard를 유지한다.
- Copy 성공 시 서버 canonical snapshot의 새 Task/Link를 같은 Gantt instance에 동기화하며 page reload/remount로 처리하지 않는다.
- relation line과 Task Editor 관계 탭은 새 Link ID와 새 endpoint를 canonical snapshot에서 읽는다.


## Issue #345 미산정 Summary 계약

빈 Summary 생성은 일정 도구 모음과 Context Add의 `요약 작업 추가`에서 이름·위치만 전송한다. 날짜 입력이나 임시 Task 삭제를 요구하지 않는다. 이름 수정은 기존 Grid inline 편집과 #461 작업 정보 저장이며 Summary의 일정 필드 직접 편집 권한은 확대하지 않는다. Summary 일정·진척·Baseline은 readonly 파생 값이며 시작·종료·기간·진척 미산정 값은 `—`로 표시하고 진척 slider의 가짜 0%를 표시하지 않는다.

마지막 child 삭제·이동 후 부모는 같은 ID/type의 Summary로 남는다. 자식 없는 Summary 자체 삭제는 기존 단일 작업 삭제이고, 자손 있는 Summary의 포함 삭제 확인은 유지한다. 아래 과거 빈 Summary/마지막 child 거부 설명은 이 현재 정책으로 대체하며 401/412/Dependency 제약과 canonical 복구 정책은 유지한다. Core adapter Renderer 좌표는 이름·일정 수정 payload에 역변환하지 않는다.

## 사용 방법과 범위

프로젝트 Grid의 작업 행 또는 Chart의 작업 막대를 우클릭하면 해당 작업의 **작업 메뉴**를 먼저 연다. 메뉴의 **작업 정보**를 선택해야 기존 작업 정보 대화상자가 열린다. 메뉴를 여는 것만으로 대화상자·저장·삭제가 실행되지 않는다. 선택된 행이나 작업명이 아니라 실제 taskId로 찾는다. Tab으로 작업 행/막대에 포커스를 옮긴 뒤 Shift+F10 또는 ContextMenu 키로 메뉴를 열고, 작업 정보 항목에서 Enter로 진입할 수 있다. Escape는 메뉴를 닫는다. Grid 헤더의 우클릭/Shift+F10은 기존 표시 열 메뉴를 유지하며 두 메뉴는 동시에 표시하지 않는다. 빈 Chart, 링크, 시간축과 입력 상자에는 작업 우클릭 처리를 적용하지 않는다.

일반 작업은 작업명·요청 시작일·기간(근무일)·요청 종료일과 0~100% 진행률 Slider, 여러 줄 Description, `http://`/`https://` URL을 입력하고 **저장**한다. 요청 종료일은 별도 저장 필드가 아니라 현재 Project Effective Calendar로 `requestedStart + duration`에서 도출하는 편집 초안이다. 사용자가 기간을 바꾸면 요청 종료일을 계산하고, 요청 종료일을 바꾸면 기간을 역산한다. 마지막 명시 입력이 기간인지 종료일인지 기억해 요청 시작일 변경 시 반대 필드를 재계산한다. 서버 확정 시작/종료일은 별도 secondary 정보로 표시하며 저장 시 서버가 최신 휴일/주말·WORKING/NON_WORKING 예외, 일정 모드와 Dependency를 다시 적용한다. 마일스톤 기간은 0이며 요청 종료일 양방향 편집을 적용하지 않는다. 요약 작업은 #493부터 이름·Description·URL·하위 작업 기본 완료 단계를 편집하고 일정·진척·Baseline은 계속 읽기 전용이다. 편집 권한이 없으면 같은 정보창에 읽기 전용 사유를 표시하고 저장을 제공하지 않는다. 관계 endpoint인 leaf도 아래 #258 계약에 따라 편집한다. 작업 삭제는 #31의 별도 보호 흐름으로 제공한다. 작업 유형 변경, 관계/담당자 편집과 PRO 기능은 범위 밖이다.

취소/닫기/Escape는 미저장 변경이 있으면 먼저 버리기 확인을 요구한다. 편집기 하나가 열려 있는 동안 다른 작업으로 초안을 조용히 전환하지 않는다. 메뉴의 Escape는 원래 호출 대상으로 포커스를 복구한다. 편집기 종료 시 연결된 원래 대상이 없으면 해당 taskId의 현재 행이나 작업공간을 사용한다. 포커스 복구에는 preventScroll을 사용한다.

## 메뉴 항목 채택 정책

| 항목 | 정책 | 이유 |
| --- | --- | --- |
| 작업 정보 | 제공 | 기존 보호된 편집기에서 조회/편집 여부를 판단한다. 읽기 전용 프로젝트에도 정보 조회를 제공한다. |
| 작업 삭제 | 제공 (#31) | Edit·무연결 일정에서 실제 우클릭 taskId를 대상으로 한다. 자손이 있으면 범위 확인 후 `includeDescendants=true`로 원자 삭제한다. |
| Add / Cut / Copy / Paste | 제공 (#72) | Cut/Copy는 프로젝트 화면의 clipboard 상태만 갱신하고 Paste 시 서버의 원자 계층 명령을 호출한다. Add는 child/above/below 위치를 명시한다. |
| Convert / Move / Indent / Outdent | 제공 (#72) | 현재 canonical hierarchy에서 유효한 명령만 활성화하고 서버가 parent/sibling order와 Summary를 재계산한다. Link 포함 일정은 fail-closed하며 빈 Summary는 #345 현재 정책에 따라 유지한다. |

삭제 메뉴는 Readonly·mutation 진행 중이거나 **선택 Task/삭제 subtree가 Link endpoint를 포함하는 경우** 비활성화 또는 서버에서 거부한다. 프로젝트의 unrelated Link만으로는 선택 Task를 잠그지 않는다. 자손 없는 작업은 기존 단건 DELETE, 자손이 있는 작업은 작업명·자손 수·총 삭제 수를 보여주는 확인창을 거쳐 명시적 subtree DELETE를 사용한다. 취소/Escape/닫기는 DELETE 0회이며 확인 시점 revision이 바뀌면 412 후 최신 범위를 다시 확인한다.

메뉴는 우클릭 지점 근처에 fixed overlay로 표시하고 viewport 경계를 보정한다. 바깥 클릭, 다른 작업 우클릭, Escape, resize/scroll은 닫기 또는 대상 전환으로 처리한다. 기본 상세 편집기와 서버 권한/저장 제약은 메뉴와 별도로 유지한다.

## 저장과 오류 처리 계약

- 메뉴의 작업 정보 선택은 공개 SVAR `show-editor` action을 실행하고 `api.intercept`로 프로젝트 편집기에 연결한다. 기존 double-click/native show-editor 경로를 메뉴 클릭으로 대체하지 않는다. 초기화/해제 tag는 `project-task-editor`이며 native add/update 동기화 가드는 변경하지 않는다.
- `task-context-target.ts`만 SVAR의 행/막대 DOM 속성을 해석한다. `data-id` / `data-task-id`의 문자열 ID 접두사를 해석한 뒤 UUID와 현재 canonical task 목록 양쪽을 확인한다. 이름·선택·정렬 순번으로 fallback하지 않는다.
- `task-editor-model.ts`는 DTO와 해당 Project Calendar를 초안으로 복사하고 변경된 name/start/duration/progress/status/description/url/baseline/explicitMilestoneTaskId만 command로 만든다. Summary command는 name, description, url, explicitMilestoneTaskId만 허용하며 일정·진척·Baseline 필드는 계속 제외한다. 일반 Task의 `requestedEnd`는 UI-only 파생값이며 command whitelist에 포함하지 않는다. 시작일은 date-only 문자열이고 duration은 직접 입력·역산한 근무일이다. 기간 기준이면 `endFromStart`, 종료일 기준이면 `workingDaysBetween`을 기존 pure Scheduling Domain과 동일한 Effective Calendar로 사용한다. Auto 비근무 요청 시작일은 preview에서도 다음 근무일로 정규화하지만 서버가 최종 authority이며, Manual 비근무 시작일과 비근무 요청 종료일은 필드 오류로 저장을 막는다. Pointer resize의 달력 span 변환기를 통과시키지 않는다. name/progress-only PATCH는 start를 포함하지 않으므로 requestedStart를 보존한다.
- 기존 `ProjectReadonlyView.saveTask`가 credentials:same-origin, Content-Type과 If-Match를 포함해 동일 PATCH API를 호출한다. 편집기를 열었을 때의 revision을 명시적으로 전달한다. 서버 session/Origin/revision/스케줄러 계약을 유지하며, Issue #36의 Description/URL은 동일 PATCH 경로와 SQLite migration/canonical snapshot 계약으로 저장한다.
- 편집기 ref mutex와 기존 aggregate mutation mutex로 연속 클릭/Enter 중복 요청을 차단한다. 저장 중 입력/닫기를 막고, 성공한 canonical 응답만 Gantt와 열린 Editor base에 반영한다. 일반 저장은 닫고 Milestone의 명시 상태 변경은 Editor를 유지해 완료·재개 결과를 확인한다. 정상 처리에서는 문서 reload, loading 화면이나 Gantt key 변경이 없다.
- Editor의 400/409/422/5xx/network 오류는 입력을 보존하며 자동 재조회·재전송하지 않는다. 사용자가 최신 정보 조회와 재시도를 명시한다. Grid/native mutation의 기존 canonical recovery는 유지한다. 검증 오류를 수정하거나 사용자가 명시적으로 재시도할 수 있다.
- 401은 즉시 읽기 전용으로 바뀌고 초안을 보존한다. 412 또는 현재 revision과 opened revision이 다르면 저장을 막는다. **최신 정보 다시 불러오기 → 버리기 확인 → 최신 값 검토 → 재편집/저장**이 필요하다. 초안을 최신 revision으로 자동 덮어쓰기하지 않는다. 재조회가 실패하면 이전 초안과 충돌 잠금을 그대로 유지한다.
- 정보 재조회는 편집 권한을 새로 부여하지 않는다. 편집 권한은 기존 session 흐름으로만 확인한다.

## 구현 선택과 공식 참고

[사용자 지정 Willow 데모](https://docs.svar.dev/react/gantt/samples/#/editor/willow), [SVAR Context Menu demo](https://docs.svar.dev/react/gantt/samples/#/context-menu/willow), [공식 ContextMenu API](https://docs.svar.dev/react/gantt/helpers/context_menu/)를 참조한다. Issue #4의 직접 열기 계약은 Issue #22에서 **메뉴 → 작업 정보 → 기존 편집기**로 변경했다. 현재 PR은 프로젝트 전용 React 메뉴와 `task-context-menu.css`를 사용하고, 공개 [show-editor](https://docs.svar.dev/react/gantt/api/actions/show-editor/)와 [intercept](https://docs.svar.dev/react/gantt/api/methods/intercept/)로 기존 편집기에 연결한다. 새로운 패키지나 PRO 의존성을 추가하지 않는다.

프로젝트 편집기는 React/native dialog/CSS Module 기반이다. 기본 Editor의 즉시 로컬 update와 달력일 기간 의미가 프로젝트의 명시적 PATCH/근무일 계약과 다르므로 기존 프로젝트 편집기를 유지한다. 이 사유는 상세 편집기의 선택 이유이며, 공식 ContextMenu helper가 사용 불가능하다는 의미는 아니다. 지정 데모의 실제 화면 실측·pixel 비교와 helper 대비 접근성 적합성 판단은 자동 CI 결과와 별도로 검증해야 한다.

프런트는 서버/DB 모듈을 import하지 않는다. 요청 종료일의 **편집 미리보기**에는 기존 pure Scheduling Domain의 date-only/Working Calendar 함수를 재사용하며 별도 날짜 알고리즘을 만들지 않는다. 이 미리보기는 persisted schedule이 아니고 저장 payload의 canonical source는 계속 `requestedStart + duration`이다. 최종 `start/end` 계산과 Dependency/Manual conflict 판정은 서버가 담당한다. 관련 계약은 [Architecture](ARCHITECTURE.md), [API](API.md), [Scheduling](SCHEDULING_ENGINE.md), [Security](SECURITY.md), [원격 검증](REMOTE_VALIDATION.md)을 따른다.


## Issue #368 — 요청 종료일과 기간 양방향 편집

일반 Task의 일정 입력은 `요청 시작일 / 기간(근무일) / 요청 종료일` 3개를 한 의미 그룹으로 표시한다. 최초 기준은 기간이며, 사용자가 기간을 직접 바꾸면 요청 종료일을, 요청 종료일을 직접 바꾸면 기간을 즉시 계산한다. 이후 요청 시작일을 바꿀 때는 마지막 명시 입력 기준을 유지해 반대 필드만 갱신한다. 계산은 Project canonical snapshot의 Effective Calendar를 사용하고 양 끝 포함 근무일 규칙을 따른다.

`requestedEnd`는 UI draft에만 존재하며 DB/API DTO에 새 영속 필드를 추가하지 않는다. Task PATCH는 기존처럼 변경된 `start`(requestedStart 의미)와 `duration`만 전송하고 `end` 또는 `requestedEnd`를 독립 입력으로 보내지 않는다. 서버 확정 정보에는 저장된 요청 시작일, 적용 시작일, 확정 종료일을 분리해 보여 준다. Dependency로 실제 일정이 이동해도 사용자의 요청 의도와 server canonical result를 혼동하지 않는다.

Auto의 비근무 요청 시작일은 preview에서도 다음 Project 근무일로 보정하여 종료일/기간을 계산하고, Manual의 비근무 요청 시작일은 오류다. 요청 종료일은 Effective Calendar의 근무일이어야 하며 시작일보다 빠르거나 계산 기간이 1~10,000 범위를 벗어나면 해당 필드와 `aria-invalid/aria-describedby`로 연결해 저장을 막는다. 오류 초안은 유지한다. Summary readonly, Milestone `duration=0`, dirty/stale/revision/401/412, 관계 연결 Task의 dependency-aware 저장 계약은 변경하지 않는다.

## 검증 계획과 상태

2026-09-14 PR #26의 최초 CI [Run #55](https://github.com/planner77/masterGantt/actions/runs/34790707897)는 head `0adbccff88ddcd17e859c226d7803d410b845e7b`에서 quality와 docker는 PASS, e2e는 FAIL이었다. E2E 42개 중 12개가 메뉴 선택 없이 편집기를 기다리며 5초 timeout으로 실패했고 30개는 통과했다. 이는 편집 UI 흐름 변경에 따른 테스트 갱신 누락이다. timeout 연장·테스트 제외·게이트 완화로 해결하지 않는다.

후속 테스트 커밋 `461af0ccef377a7ed7ab828d13fe3dffc381e507`은 공통 `chooseTaskInformation` helper를 추가해 메뉴 표시, 메뉴 단계에서 편집기 부재, 실제 항목 클릭/Enter, 메뉴 종료와 단일 편집기 표시를 검증한다. Grid/Chart·마일스톤·읽기 전용·실제 DB 저장·세 시간대 테스트 모두 같은 경로를 사용한다. 기존 저장/PATCH 횟수/권한/초안/오류 복구 검증을 유지하고 메뉴 자체의 부작용 및 두 viewport의 네 모서리 배치 검증을 추가했다.

| 계층 | 범위 | 파일 |
| --- | --- | --- |
| 단위 | 무변경/whitelist, 시작일·기간만 변경, normalized requestedStart 보존, Unicode/범위 검증, milestone/summary/권한/links, DOM ID 파싱 | tests/features/gantt/task-editor-model.test.ts |
| Browser + mock API | 메뉴→편집기, Grid/Chart 실제 타겟, 선택·정렬·접힘·헤더, 키보드/포커스/dirty 닫기, 한 편집기, 지연 및 중복 저장, 휴일 계산 반영, 422/500/network/401/412와 재조회 실패/명시적 재시도 | tests/e2e/project-task-editor.spec.ts |
| 메뉴 회귀 | Escape/ContextMenu/대상 전환, 두 메뉴의 상호 배제, 네 모서리·360px/1440px 경계, geometry/scroll/API identity, mutation/navigation 없음 | tests/e2e/project-task-editor.spec.ts |
| 공통 사용자 동작 | 실제 작업 정보 항목 클릭 또는 Enter 및 단계별 assertion | tests/e2e/helpers/task-context-menu.ts |
| Browser + 실제 SQLite API | 첫 child가 있는 실제 프로젝트에서 메뉴→편집 저장/재조회/reload, 부모 집계, 단일 PATCH, 정상 Gantt identity 유지, UTC/Seoul/New York date-only 표시 | tests/e2e/project-task-editor-persistence.spec.ts |
| 전체 회귀 | 기존 타입/lint/단위/통합/E2E/Docker gate | .github/workflows/ci.yml |

로컬 의존성 설치/브라우저 실행은 이번 실행 환경의 GitHub/npm DNS 해석 실패로 **BLOCKED**다. 수정 후 공식 판정은 [PR #26](https://github.com/planner77/masterGantt/pull/26)의 최종 head SHA와 CI run으로 확인한다. 문서를 커밋하는 시점에 진행 중인 run을 PASS로 미리 기록하지 않는다. 최초 실패 기록은 그대로 유지한다.

mock의 결과는 DB 영속성 증거가 아니며 실제 API 테스트와 구분한다. 네 모서리 검증은 실제 task 대상에 경계 좌표를 전달하는 synthetic event 기반 geometry 검사이며 실제 데모 화면 비교가 아니다. 실제 사용자 환경의 브라우저/스크린리더/Windows 및 지정 데모의 최종 수동 UX 비교는 별도 **NOT TESTED**로 남긴다.

## 남은 범위

PR #16의 초기 시간축 범위 확대 및 canonical sync 종료 시점 입력 잠금 P2 관측은 별도 검토 대상이다. 이번 편집기 저장 결과가 초기 시간축 밖이면 해당 기존 제약의 영향을 받을 수 있다. #8 HTTP production 지원, #9/#10/#11 UI 변경, 릴리스 #17은 이슈 #4의 구현 범위가 아니다. 이 기능 PR 생성과 CI 성공은 main 병합, 정식 이미지 릴리스 또는 운영 배포를 의미하지 않는다.

## Issue #72 계층 메뉴 계약

편집 권한이 있고 다른 mutation이 진행 중이지 않으면 메뉴는 SVAR Willow의 기본 작업 흐름에 맞춰 **Add → Convert to → Edit → Cut/Copy/Paste → Move → Indent/Outdent → Delete** 순서를 제공한다. **Edit과 Copy는 관계가 연결된 Task도 허용**한다. Copy clipboard의 Paste Above/Below도 linked anchor에서 허용하되, Copy 집합 내부 Dependency만 새 endpoint로 복제한다(#378). Add·Convert·Cut·Move·Indent/Outdent·Delete 등 관계 의미를 바꿀 수 있는 구조 명령은 연결 endpoint에서 기존 guard로 비활성화하고, Paste As child가 linked leaf anchor의 Summary 전환을 요구하는 경우도 차단한다. Readonly에서는 정보 조회(Edit)만 실제 동작하며 mutation 항목은 비활성화한다.

Cut은 선택 Task를 즉시 삭제하거나 이동하지 않는다. Copy와 함께 현재 Project revision을 포함한 client clipboard만 만든다. Paste는 `POST /api/projects/{publicId}/task-commands`를 호출하며 Cut은 `reparent`, Copy는 `copy` 명령으로 변환한다. 성공 응답의 canonical snapshot만 동일 Gantt instance에 동기화하고 revision 변경 시 기존 clipboard는 폐기한다. Canonical snapshot의 parent/sibling 구조 변경은 SVAR의 공개 `move-task` action으로 반영하고, 일반 `update-task`에 parent를 직접 덮어쓰지 않는다. 이 규칙은 hierarchy 변경 뒤 recovery remount 없이 동일 Gantt instance를 유지하기 위한 회귀 계약이다. Ctrl/Cmd+X/C/V, Delete/Backspace/Ctrl+D는 input/textarea/dialog/contenteditable 밖의 실제 Task target에서만 동작한다.

Leaf→Summary의 명시적인 Convert 명령 확대는 #345 범위 밖이므로 직접 변환 항목은 비활성화한다. 이는 빈 Summary 자체의 생성·영속화 금지라는 의미가 아니다. Task↔Milestone은 자식이 없는 Leaf에서만 허용한다. Task를 child parent로 사용하는 Add/Indent/Paste는 기존 first-child 정책과 동일하게 해당 Task를 transaction 안에서 Summary로 전환한다. subtree Copy에 Resource Assignment가 존재하면 조용히 누락하지 않고 현재 단계에서는 `TASK_COPY_ASSIGNMENTS_UNSUPPORTED`로 거부한다.


## Issue #74 — 탭 기반 Task Editor UX

기존 서버 권위 저장·revision·권한 계약은 유지하면서 정보 구조만 재설계한다. Task/Summary Editor는 **작업 정보 / 리소스 / 관계 / 물류 연결** 4개 탭, Milestone은 두 번째 **소속 작업 N**을 포함한 5개 탭을 사용하며 최초 진입은 작업 정보다. 탭 전환은 mutation을 발생시키지 않고 패널 상태를 DOM에 유지해 작업 초안과 리소스 입력 상태를 보존한다.

- Desktop modal은 최대 70rem 범위에서 가용 폭을 사용하고 Header/Tab/Footer는 고정된 구조로 유지한다. 스크롤은 active tab body에서만 발생한다.
- 작업 정보 탭은 작업명, 일정 필드, 진행률, Description, URL을 우선 배치하고 서버 확정 정보는 secondary metadata 영역으로 분리한다.
- 리소스 탭은 검색·유형·할당됨 필터와 선택 우선 정렬을 제공한다. Resource/Group 유형과 active 상태를 text/badge로 함께 표시하며 색상만으로 상태를 전달하지 않는다.
- 관계 탭은 wide 화면에서 선행/후행 2열, narrow 화면에서 1열로 표시한다. #377부터 편집 권한이 있는 일반 Task/Milestone은 기존 Relation Editor를 통해 관계 추가·편집·삭제를 수행하며 readonly는 조회만 유지한다.
- Footer의 최신 정보 재조회는 좌측 tertiary 성격, 취소/저장은 우측 action group이며 저장만 primary다. stale/revision conflict 시 기존처럼 저장을 차단한다.
- 탭은 WAI-ARIA `tablist/tab/tabpanel` 역할과 Arrow Left/Right, Home/End 이동을 지원한다. Escape/dirty confirmation/focus restore 계약은 기존 편집기 흐름을 유지한다.
- Task 저장과 Assignment 저장은 원자적으로 통합하지 않는다. Task draft가 dirty/stale이면 Assignment 편집을 잠그고 저장 범위를 화면에서 설명한다.

검증은 `task-editor-view-model.test.ts`의 keyboard navigation 단위 테스트와 `project-task-editor.spec.ts`의 탭 전환·초안 보존·반응형 overflow 회귀를 포함하며, 전체 공식 판정은 PR GitHub Actions quality/e2e/docker를 따른다.


## Issue #80 — 관계 표시 회귀 수정

Task Editor의 관계 탭은 상위 Project 화면이 이미 사용 중인 canonical `tasks + links + revision` snapshot을 사용한다. 관계 표시만을 위한 pathname 재파싱과 별도 Project GET은 수행하지 않는다.

- Grid 더블클릭, Chart 더블클릭, Context Menu → Edit은 모두 동일 `ProjectTaskEditor`와 동일 canonical 관계 모델을 사용한다.
- A → B 관계에서 A에는 B가 후행 작업, B에는 A가 선행 작업으로 표시된다.
- 상대 작업명, externalId, relation type, lag를 표시하고 복수 관계를 누락하지 않는다.
- Readonly 상태에서도 관계 조회는 가능하며 저장 버튼 제공 여부와 관계 조회 가능 여부를 분리한다.
- Editor open만으로 Project mutation 또는 추가 Project snapshot GET을 만들지 않는다.
- Project revision이 Editor session revision과 달라지면 기존 stale 보호 및 명시적 reload 흐름을 사용한다.


## Issue #96 — 입력 폭·간격·배치 밀도 최적화

Issue #74에서 시작된 탭 기반 body-only scroll, 고정 Footer 구조와 모든 저장/권한 계약은 유지하고 presentation density만 조정한다.

- Desktop 작업 정보 탭은 content-aware 2열 grid를 사용한다. 작업명·일정·Description·URL은 주 content 폭을 사용하고 진행률은 보조 열에서 최대 24rem 범위로 제한한다.
- 일정은 요청 시작일 10~13rem, 기간 7~9rem, 요청 종료일 10~13rem 방향의 3열 입력으로 배치해 기간 입력이 날짜 필드와 같은 폭을 강제받지 않는다. 적용 시작일·확정 종료일은 서버 확정 secondary metadata로 분리한다.
- Resource allocation은 시작/종료 10~13rem, 투입률 7~9rem을 사용하며 Search는 flexible, Type은 compact, Assigned only는 intrinsic sizing 계약을 유지한다.
- 768px 이하에서는 Task/일정/Resource allocation을 1열로 전환하고 480px 이하에서는 진행률 값도 자연스럽게 stack한다. document/dialog horizontal overflow는 허용하지 않는다.
- 변경은 CSS Module에 한정하며 JSX inline width, Task API, canonical snapshot, revision/If-Match, 401/412, dirty/stale, Relation 및 Assignment 별도 저장 계약을 변경하지 않는다.

검증 기준은 390/768/1024/1440px에서 input geometry와 horizontal overflow를 확인하고 기존 Task Editor 상호작용 회귀를 함께 실행한다.

## Issue #155 / #372 — 전체화면에서 작업 정보 진입

Issue #155에서 도입한 Gantt native fullscreen은 Issue #372부터 **Task Editor 진입의 부수 효과로 종료하지 않는다.** SVAR `show-editor` intercept(메뉴 Edit 포함), Grid/Chart double click 및 readonly 정보 조회는 호출 대상을 기억한 뒤 현재 native `<dialog>.showModal()`을 열며, 앱은 Editor를 열기 위해 `document.exitFullscreen()`을 호출하지 않는다. 따라서 저장·취소·닫기 후에도 사용자가 전체화면 버튼/Escape 등으로 직접 종료하지 않았다면 동일 `.project-gantt-frame` fullscreen과 Gantt instance를 유지한다.

Task Editor가 열린 동안 기존 shortcut guard, modal focus/Tab 처리, dirty 확인, readonly·revision·If-Match·401/412·Task PATCH/Assignment PUT 계약은 그대로다. 닫은 뒤에는 원래 호출 대상 또는 taskId fallback으로 `preventScroll` focus를 복원하고 Grid/Chart scroll·tree·column·scale·selection/filter를 초기화하지 않는다. 같은 fullscreen-aware dialog 원칙은 Relation Editor에도 적용하며, 사용자 에이전트가 Escape로 native fullscreen 자체를 종료하면 `fullscreenchange`가 실제 `document.fullscreenElement`를 source of truth로 UI 상태를 동기화한다. Editor open/close 자체는 작업·관계·할당 API mutation을 보내지 않는다.

## Issue #140 — Grid 작업명 인라인 편집과 Task Editor 경계

Grid `작업` 이름 텍스트의 single-click·F2·기본 이름 더블클릭은 Core text editor에서 이름만 바꾼다. Enter/blur는 Task PATCH를 한 번 보내고 Escape는 저장 없이 닫는다. 이름은 Task Editor와 같은 trim·well-formed Unicode 1~200자 규칙으로 검증하며, 잘못된 입력은 input focus와 연결된 오류를 유지한다. Task Editor는 메뉴 Edit 및 Chart/비이름 영역의 기존 진입점으로 남는다. Grid에서 변경한 이름과 Task Editor의 이름은 서버 확정 snapshot으로 동기화되고, Task Editor 저장 후 Grid도 동일 canonical snapshot을 표시한다. Grid Summary는 이름만 바꿀 수 있으며 Task Editor의 Summary 일정/정보 readonly는 그대로다. 연결 endpoint 이름 편집의 과거 409 제한은 #258에서 대체한다. 저장 실패·401·412, dirty/stale, Task PATCH/Assignment PUT 분리와 원래 focus 복원 계약은 변경하지 않는다.

## Issue #187 — 작업 정보 대화상자 물류 연결 (logistics) 탭

기존 3개 탭(작업 정보 / 리소스 / 관계)에 이어 4번째 탭으로 **물류 연결 (logistics)** 탭이 추가되었다 (`TASK_EDITOR_TABS = ["info", "resources", "relations", "logistics"]`).

- **정보 구조 및 연결 관리**:
  - 프로젝트 내 등록된 활성 공정/설비 및 제어·조율 시스템 목록을 표시하고, 체크박스로 현재 작업에 연결할 설비 및 시스템을 선택할 수 있다.
  - 설비의 주 담당자(Owner) 및 시스템의 주 담당자(PI) 정보가 함께 표시되어 작업-설비-시스템-담당자 간 연계 책임을 즉시 파악할 수 있다.
- **Summary 하위 상속 (subtree scope)**:
  - 대상 작업이 `type === 'summary'`인 경우, 설비/시스템 연결 시 `하위 자손 작업 상속(subtree)` 옵션을 선택할 수 있다.
  - 일반 작업(Task) 또는 마일스톤(Milestone)인 경우 `subtree` 옵션은 비활성화되며 단일 작업 연결(`self`)로 동작한다.
- **상속된 연결(Inherited Links) 조회**:
  - 상위 조상 Summary로부터 `subtree` scope로 상속된 설비 및 시스템 목록을 별도 영역에 표시한다.
  - 상속 출처 작업명(`sourceTaskName`)을 함께 보여주며, 상속된 연결은 현재 작업에서 직접 해제할 수 없고 출처 Summary 작업에서 수정하도록 안내한다.
- **독립 저장 및 동시성 제어**:
  - 물류 연결은 작업 기본 정보(Task PATCH)나 리소스 할당(Assignment PUT)과 독립적인 `PUT /api/projects/{publicId}/tasks/{taskId}/logistics-links` 엔드포인트를 통해 저장된다.
  - 편집 권한이 있고 Task draft가 stale/dirty 상태가 아니며 현재 Task/revision의 연결·물류 목록 조회가 모두 성공했을 때 '물류 연결 저장' 버튼이 활성화된다.
  - 성공 시 프로젝트 `revision`이 1 증가하며 canonical snapshot을 재동기화한다. Stale revision 충돌 시 `412 REVISION_MISMATCH` 오류로 안전하게 차단된다.

## Issue #263 — 연결·할당 조회 준비 상태와 복구

물류 연결과 리소스 할당은 조회 중·성공·실패를 구분한다. 현재 taskId/revision에 맞는 유효한 응답을 확보하기 전에는 선택·저장 control과 저장 handler를 모두 차단한다. 이전 작업이나 revision의 늦은 응답은 폐기하고 조회를 취소한다.

조회 실패를 '등록된 설비/시스템 없음'으로 표시하지 않으며 오류 안내와 다시 시도를 제공한다. 재시도는 GET만 수행하고 자동 PUT은 하지 않는다. 정상 응답을 받으면 기존 직접 연결/할당을 초안에 복원하고 그 뒤에 사용자 저장을 허용한다. readonly와 Task PATCH/Assignment PUT/물류 PUT의 독립 저장·서버 권한·If-Match 계약은 유지한다.

## Issue #258 — 관계 연결 작업 편집과 요청/적용 일정

일반 Task와 Milestone은 incoming/outgoing/both 관계가 있어도 이름·진척·Description·URL·Baseline과 요청 시작일·근무일 기간·Auto/Manual 모드를 편집한다. Summary 정보창은 읽기 전용이며 Grid Summary 이름만 기존 예외로 허용한다. 삭제·변환·계층·Copy 보호 정책은 별도 계약을 유지한다.

- 시작 입력과 dirty 비교는 `requestedStart ?? start` 기준이다. `현재 적용 일정`은 마지막 canonical start/end이며 preview가 아니다. 적용 시작일과 같은 날짜를 새 요청일로 지정한 변경도 저장한다. 미수정 시작일은 duration/progress-only 요청에 첨부하지 않는다.
- 현재 일정으로 Baseline 설정은 저장된 effective start/duration/end를 복사한다. 미저장 요청일·기간·모드 변경이 있으면 복사 버튼을 잠그고 먼저 저장하도록 설명한다. metadata 초안만 있으면 복사 가능하다. 현재 일정 변경으로 미수정 Baseline을 자동 이동하지 않는다.
- 성공은 full canonical snapshot으로 Grid/Chart를 동기화하며 요청일과 적용일 차이, 실제 날짜가 바뀐 후행 leaf 건수·이름을 기존 안내에 표시한다. Manual/리소스 충돌은 명시적인 오류와 초안을 유지하고 부분 저장하지 않는다.
- 권한·stale·busy·dirty 확인·native dialog·탭 keyboard·focus 복원은 기존 계약을 유지한다. 관계가 있는 이름도 single-click/F2/Enter/blur로 name-only PATCH, Escape는 미저장이다.

SVAR 확인일 2026-09-29: 설치 Core 2.7.3의 공개 [update-task](https://docs.svar.dev/react/gantt/api/actions/update-task/) interaction을 사용한다. 공식 [schedule](https://docs.svar.dev/react/gantt/api/properties/schedule/)와 Calendar는 PRO이며 활성화하지 않는다. 재계산은 자체 domain/server engine이다. 공식 demo URL 조회와 실제 widget 동작 검증은 별도 증거다.

## Issue #300 Grid DnD 후 일반 필드 저장

Grid 행 이동은 SVAR Core 2.7.3의 공개 `move-task` action으로 연결한다. `inProgress=true`인 드래그 피드백은 서버를 변경하지 않고, 놓은 최종 action만 기존 `POST /api/projects/{publicId}/task-commands`의 `reparent` 명령으로 변환한다. #335부터 `before`/`after`가 **source의 기존 parent와 같은 parent**를 가리키면 Dependency Link 존재 여부와 무관하게 sibling order 변경을 허용한다. 다른 parent를 가리키는 `before`/`after`와 `child`는 기존 Link/type/cycle 보호를 유지한다. Context Menu의 Move Up/Down도 같은 parent reorder이므로 linked Task에서 허용하지만 Indent/Outdent 등 parent 변경 명령의 보호는 유지한다. 상위 Move submenu는 기존 unlinked boundary UX를 보존하면서 linked Task에 실제 Move Up/Down 방향이 하나라도 있을 때 열 수 있다. Core 2.7.3의 `inProgress=false` release는 위치 이동을 다시 수행하지 않고 `$reorder`와 drag source를 정리하므로, 보호 명령 전달 후 이 native cleanup은 허용한다. 일반 programmatic 이동은 canonical 응답이 구조를 확정할 때까지 로컬 적용을 차단한다.

확정 응답의 canonical parent/sibling order와 최신 revision을 반영한 뒤 이름·진행률·설명 등의 일반 필드를 저장한다. 이름 변경 PATCH는 `{name}`만 전달하며 parent/sibling order를 다시 지정하지 않는다. canonical 동기화에서 발생하는 내부 `move-task`는 `project-canonical-sync` marker와 실제 sync guard가 함께 있을 때만 허용하고, 이 action을 새 HTTP 요청으로 되돌려 보내지 않는다. 읽기 전용·mutation 진행 중·동기화 중의 사용자 이동과 편집은 차단한다. 이동 실패/412는 기존 확정 snapshot 재조회와 오류 안내로 복구하고, 재조회가 성공하면 Gantt 인스턴스를 유지한다. 재조회까지 실패한 경우의 기존 recovery remount 정책은 유지한다.

2026-09-29 확인: [공식 move-task API](https://docs.svar.dev/react/gantt/api/actions/move-task/)와 [Next.js backend integration](https://docs.svar.dev/react/gantt/integration-guides/nextjs/backend/)의 구조 이동/일반 속성 저장 분리를 참조했다. 설치된 Core Grid source의 `inProgress=true` 이동과 release 시 `inProgress=false` 최종 이동을 확인했다. PRO 기능이나 별도 reorder 저장소를 추가하지 않는다. URL/설치 source 확인과 실제 pointer 재현·원격 CI 결과는 서로 구분한다.


## Issue #377 — 관계 탭에서 Relation Editor 기반 관계 관리

Task Editor 관계 탭은 상위 Project의 canonical `tasks + links + revision` snapshot을 사용하면서 기존 Relation Editor의 추가 진입점을 제공한다.

- 정상 relation row는 상대 작업, externalId, type, lag와 **편집 / 삭제** action을 제공한다. dangling reference는 경고만 표시하고 mutation action은 제공하지 않는다.
- **관계 추가**는 현재 Task/Milestone의 taskId를 Anchor context로 Relation Editor에 전달한다. 관계가 0건이어도 선행/후행 방향, 후보 Task/Milestone, FS/SS/FF/SF, signed Lag를 선택해 기존 Link POST 계약으로 생성할 수 있다. Summary endpoint 정책은 확대하지 않는다.
- Task draft가 dirty이면 관계 추가/편집/삭제를 잠그고 먼저 Task 변경을 저장하거나 취소하도록 안내한다. stale revision, readonly, pending도 fail-closed한다.
- 관계 mutation 성공 시 Project snapshot과 열린 Task Editor의 base/draft/revision을 동일 canonical 응답으로 갱신한다. 이 동기화는 Task Editor native dialog를 다시 `showModal()`하지 않아 Relation Editor가 top layer를 유지하고, 현재 관계 탭을 보존한다.
- Relation Editor 닫힘 후 기존 trigger가 남아 있으면 focus를 복원한다. 관계 탭 직접 삭제 confirmation은 취소 버튼으로 focus를 이동하고 취소 시 원래 삭제 버튼으로 되돌린다.
- Gantt fullscreen, instance, scroll/tree/column/scale/filter 상태는 관계 관리 진입과 canonical sync 때문에 초기화하지 않는다.

기존 #97/#200/#203/#266의 Link API, Scheduling Engine, revision/If-Match, 초안·pending·focus 보호를 재사용하며 Task Editor 전용 relation 저장 모델은 만들지 않는다.


## Issue #339 — Task Editor Footer action geometry 정렬

Task Editor Footer의 `최신 정보 다시 불러오기` / `취소` / `저장`은 기능·저장 계약과 무관하게 동일한 control geometry를 사용한다. 전역 `.secondary-button`이 일반 page action용 `margin-top`을 포함하더라도 Task Editor Footer에서는 Footer 자체가 spacing을 소유하므로 모든 직접 button의 상단 margin을 0으로 정규화한다.

- Footer button은 동일한 `min-height`, vertical/horizontal padding, line-height와 `box-sizing`을 사용한다.
- 768/1024/1440px처럼 한 행으로 배치되는 viewport에서는 Reload / Cancel / Save의 상단 edge와 높이가 일치한다.
- 390px처럼 Footer가 wrap되는 viewport에서는 Reload가 독립 행으로 이동할 수 있지만 Cancel / Save는 같은 행의 상단 기준선을 유지하고 모든 action의 control height는 동일하다.
- stale / disabled / saving / readonly 상태 변화는 기존 Task PATCH, revision/If-Match, dirty draft, reload confirmation 및 accessible name 계약을 변경하지 않는다.
- SVAR React Gantt Editor 자체를 교체하거나 PRO Editor API를 도입하지 않는다. 이 보정은 masterGantt-owned native dialog Footer presentation 범위다.


## Issue #340 리소스 탭 compact 2-pane 레이아웃

- `전체` 유형에서는 1024px 이상에서 담당 리소스와 리소스 그룹을 content-aware 2-pane으로 표시한다. Resource pane은 allocation 입력을 포함하므로 Group pane보다 넓게 배치한다.
- `리소스` 또는 `그룹` 유형 필터에서는 선택한 단일 pane이 가용 폭 전체를 사용하며 비어 있는 반대 pane을 남기지 않는다.
- 미선택 항목은 checkbox + 이름 + 코드 + 비활성 상태를 compact 한 행으로 표시한다. Resource/Group 유형은 section heading에서 구분하므로 반복 badge는 제거한다.
- 선택 Resource의 투입 시작/종료/투입률은 같은 행 바로 아래 detail 영역에서 가용 폭을 사용한다. Group에는 allocation 입력을 추가하지 않는다.
- 각 pane은 현재 표시 건수/전체 건수를 노출하고 `등록된 대상 없음`과 `현재 필터와 일치하는 결과 없음`을 구분한다.
- 768px 이하에서는 pane과 allocation fields를 1열로 stack하며 390/768/1024/1440px에서 dialog/document horizontal overflow를 허용하지 않는다.
- Assignment PUT, Project/Catalog revision, `If-Match`, 401/412, dirty/stale, canonical snapshot 및 Task/Assignment 독립 저장 계약은 변경하지 않는다.


## Issue #303 — Task 상태와 진행률

일반 Task/Milestone의 작업 정보 탭은 `시작 전 / 진행 중 / 완료` 상태 Select를 진행률 영역과 함께 표시한다. Desktop에서는 기존 작업명 좌측/진행률 우측 geometry를 유지하고 상태와 진행률을 보조 열 내부에서 배치하며, 768px 이하에서는 1열로 stack한다.

Draft에서 progress 100% 선택은 즉시 완료로, 완료 선택은 즉시 100%로 동기화한다. 완료에서 100 미만으로 내리면 진행 중, 시작 전 선택은 0%가 된다. 저장은 status/progress를 하나의 PATCH payload로 보내고 canonical response로 재동기화한다. Summary는 직접 편집하지 않으며 #258의 관계 Task 편집 정책, #368 요청 종료일, stale/busy/readonly/save-failure 보호를 유지한다.

## Grid quick start edit와 Task Editor의 일정 계약 (Issue #370)

Project Workspace Grid의 `시작` 셀 Date Picker는 Task Editor를 대체하지 않는 빠른 편집 진입점이다. Grid는 effective canonical `start`를 보여 주지만 Picker에서 선택한 날짜는 Task Editor의 **요청 시작일**과 같은 의미의 `start` mutation 입력으로 처리한다. 저장은 #258의 dependency-aware 서버 경로를 사용하며 서버 확정 `start/end`가 선택일과 달라질 수 있다.

Grid quick edit은 시작일만 변경한다. 기간, 요청 종료일(#368 범위), schedule mode, metadata와 관계 편집은 기존 Task Editor에서 수행한다. Summary 일정 직접 편집 금지와 Milestone `duration=0` 규칙도 동일하게 유지한다.

### Issue #299 — Chart reorder와 후속 편집

Chart 수직 DnD는 일정 PATCH가 아닌 hierarchy mutation이며 vertical gesture 확정 후 `reparent(before|after)`를 한 번만 제출한다. 이후 작업명·Description·URL·진행률·일정 편집은 저장된 parent/sibling order를 보존해야 한다. #335 linked same-parent reorder는 허용하되 cross-parent hierarchy 제한을 우회하지 않는다.

## Issue #485 — 리소스 탭 Global Role 단일 기준

개인 Resource를 선택하면 별도 수행 역할 Select를 표시하지 않는다. 역할은 Resource Catalog의 Global `roles`를 그대로 사용하며 Task assignment는 투입 시작/종료/투입률만 추가로 편집한다.

- Resource 행의 Global Role은 read-only badge로 표시한다. 역할 0개 Resource도 역할 선택을 이유로 assignment 저장을 차단하지 않는다.
- `Global Role` 필터는 `assignment-targets?kind=resource&role=...`를 사용해 해당 Global Role을 가진 Resource 후보만 찾는다. 이 필터는 Task별 역할 값을 생성하지 않는다.
- assignment PUT은 Resource에 `role`을 전송하지 않는다. 호환용 null은 허용할 수 있으나 non-null Task별 역할 입력은 거부한다.
- allocation draft, dirty/stale/pending, Project/Catalog revision, inactive 대상, 401/412 복구 계약은 그대로 유지한다.
- Group pane은 기존 담당 팀 참조 의미를 유지한다.
## Issue #461 완료 단계 소속 Editor

Task의 작업 정보에는 단일 `완료 단계`, Summary에는 `하위 작업 기본 완료 단계` combobox를 둔다. 이름·externalId·canonical taskId를 trim/case-insensitive 검색하며 동일 이름 후보는 외부 ID/작업 ID·날짜·상태로 식별한다. 직접 지정·가장 가까운 Summary 상속·미지정을 구분한다. 직접 지정 해제는 null을 전송하여 상속으로 복귀하며 차단 sentinel은 없다. 해제 초안의 설명과 상속 출처 열기는 같은 preview membership을 사용한다. 이름과 소속은 기본 저장 한 PATCH에 담는다.

Milestone의 소속 작업 N은 중복 제거한 유효 일반 Task 수다. 직접 지정 root 수와 검색 행 수는 별도로 표시한다. 기본은 현재 단계이며 전체 후보/직접/상속/다른 단계/미지정 및 Task/Summary 유형·식별자 검색을 제공한다. Summary 선택은 explicit row 하나만 변경하고 기존 자손 override를 보존한다. 없는 explicit row를 해제 성공으로 표시하지 않으며 상속 출처 열기 또는 다른 직접 지정으로 안내한다. 이동은 이전/새 단계와 유효 일반 작업 영향 수를 preview하고 여러 초안은 milestone-memberships POST 하나로 적용한다.

상속·Gate·영향 계산은 full canonical hierarchy/links를 `stageSnapshotFromProject`와 `previewMilestoneMemberships`에 전달한다. 최종 잠금/완료는 서버 권위다. 성공한 같은 전체 tasks/links/revision을 Workspace·열린 Editor base·소속 패널에 적용하며 dialog를 재등록하지 않는다. Resource/Logistics는 dirty/pending을 부모에 보고한다. 다른 저장 단위의 dirty가 있으면 교차 mutation을 막으며 각 초안은 탭 이동에 유지된다. 닫기/다른 작업 열기/일정에서 보기/최신 조회는 전체 초안 폐기를 명시 확인한다. 모든 pending에는 닫기/Escape/중복 저장을 막는다. 401/412/network 실패는 검색·선택·초안을 유지하고 412는 명시 최신 조회·폐기 검토 후 재시도한다.

Milestone 본인 상태, memberProgress, 미완료 members, 미완료 predecessors, Ready를 분리한다. 0명은 수동 이벤트/N/A이며 predecessorsCompleted이면 명시 완료를 시도할 수 있다. 100% 또는 Ready가 자동 완료를 만들지 않는다. 완료 기록 불일치는 진단만 표시한다. 완료 단계의 소속/관계는 잠기며 상태를 먼저 명시 재개하고 별도 저장 성공 뒤 구조 변경을 한다.

탭은 실제 노출 배열로 ArrowLeft/Right/Home/End 이동하고 active focus를 한 행 tablist 내부에서 보인다. Combobox는 label/expanded/controls/activedescendant, Arrow/Enter/Escape/Tab과 긴 후보 active option scroll을 제공한다. Escape는 후보, 확인, dialog 순서다. 필터는 390px에서 한 열이며 960px 최소 표만 가로 스크롤한다. 고정 Header/Tab/Footer와 본문 세로 scroll, Gantt instance 보존을 유지한다.

SVAR 공식 Editor guide/sample 확인일은 2026-10-05이며 설치 React Gantt Core 2.7.3을 기준으로 한다. Manager의 실제 Willow sample 조작은 General/Links/Successors/Task name/Type 조회까지 확인했고 Escape 후 Editor가 남아 있었다. 최신 demo/helper 지원을 설치 버전 지원으로 확대하지 않으며 앱 명시 저장·초안·focus 계약을 유지한다. PRO UI를 복제하지 않는다.

Readonly/완료 잠금에서도 후보 검색·metadata 조회는 가능하고 지정/해제만 막는다. Pending에는 검색 입력과 선택을 함께 잠근다. 소속 탭 footer는 `소속 변경 적용`으로 현재 저장 단위를 명시하며 긴 표 아래까지 이동해야만 적용할 수 있는 구조를 피한다. 별도 Resource/Logistics 초안이 dirty인 동안 Baseline 입력과 현재 일정 복사/삭제도 기본 mutation으로 잠근다.

검색 combobox의 accessible value는 사용자가 입력하는 query이므로 조회 가능한 입력에 `aria-readonly`를 붙이지 않는다. 소속 지정/해제 잠금은 `aria-describedby`로 연결한 안내와 option/action guard로 표현한다([WAI-ARIA combobox](https://www.w3.org/TR/wai-aria-1.2/#combobox), [aria-readonly](https://www.w3.org/TR/wai-aria-1.2/#aria-readonly), 확인 2026-10-06). 소속 패널 검색 Enter는 부모의 기본 저장·닫기로 전파하지 않으며 pending에는 검색·유형·소속 상태 필터를 함께 잠근다.

## Issue #462 Grid·메뉴의 공통 Editor 진입

Task/Summary의 완료 단계 셀/완료 단계 연결…은 기존 작업 탭 Membership picker를 연다. Milestone 소속 작업 관리…은 initialTab=memberships로 같은 #461 Editor를 연다. 별도 편집기나 API를 만들지 않으며 readonly/완료는 검색·상세 조회를 유지하고 기존 mutation 잠금을 따른다. pending Grid 셀과 메뉴는 disabled이며 실제 진입 handler도 차단한다. 진입 자체의 mutation은 0회다. 저장 성공은 full canonical snapshot의 동일 revision을 적용하므로 scope별 단계 필터와 선택 열에도 같은 소속 결과가 나타난다.

관계 삭제는 기준 작업뿐 아니라 full canonical Link 양 endpoint의 완료 Milestone 여부를 확인한다. 상대 완료 Milestone에 연결된 legacy 관계도 삭제할 수 없고 명시 reopen 후 활성화한다. 일반 Task의 completed 상태나 완료 단계 소속만으로 Task→Task 관계를 막지 않는다. 기존 mixed 관계의 조회는 유지한다.

## Issue #463 단계 대시보드에서 동일 Editor 조회

일정 완료 단계 대시보드와 물류 관련 단계의 상세는 기존 작업 정보 탭, 소속 작업 조회는 기존 memberships 탭을 연다. 신규 편집기나 저장 API는 없다. 대시보드 GET과 Editor 진입은 mutation을 만들지 않으며 readonly의 상세 조회와 완료 단계 구조 잠금, 기본/Resource/Logistics 초안 보호를 유지한다. 닫기는 원래 일정 peer 또는 물류 보기와 trigger focus로 복원한다. Editor의 일정 이동은 명시 전체 일정 ID drill을 사용한다. stale 결과·진행 중 요청·열린 Editor와 다른 mutation의 pending 동안 새로운 대시보드 drill은 잠긴다. 저장 성공의 canonical revision을 동일 workspace에 적용하여 대시보드가 현재 snapshot을 다시 조회한다.

## Issue #464 Copy·Import·Export와 Editor 연결

Task Editor의 기본 정보·Milestone 소속 작업 탭은 canonical Task ID를 그대로 조회한다. 작업 정보·Resource·물류·관계 초안이 열린 동안 Copy와 Import 진입 및 hierarchy mutation을 잠근다. Copy 영향 확인 또는 Import preview/commit은 별도의 저장 단위이며 Editor 저장을 암묵적으로 실행하거나 초안을 폐기하지 않는다. 저장 성공의 전체 canonical snapshot은 기존 Workspace 동기화 경로를 사용하고, Gantt를 재등록하거나 Editor를 remount하는 별도 경로를 만들지 않는다.

Copy는 공유 순수 계획에서 Summary root의 상속 설정과 하위 override를 구분한다. 내부 Milestone 복제 시 연결을 새 ID로 remap하고, 외부 명시 소속 제외·외부/새 목적지 Summary 상속 변화는 같은 revision으로 확인받는다. 완료 단계 구성 잠금은 확인 dialog로 해제하지 않는다. JSON 1.1 교환은 Description·URL·Baseline과 명시 소속을 보존하지만 Resource/Logistics 배정은 제외하므로, 가져오기 후 해당 공수가 원본과 동일하다고 안내하지 않는다. 원본 Task UUID는 참고 값이며 대상 UUID는 새로 발급한다. effective membership/Ready는 서버의 대상 전체 hierarchy/Link 계산 결과를 조회한다.

#470 선택 리뷰의 Resource 신규 선택 해제 후 dirty 정리와 reload 후 유효 탭 정규화 회귀는 `tests/e2e/project-task-editor.spec.ts`의 #461 두 시나리오를 유지한다. #464의 실제 Editor→Milestone 탭→Grid→Dashboard→Logistics/Resource→JSON/Excel 연결 증거는 `tests/e2e/milestone-stage-exchange.spec.ts`, 요청 실패·취소 및 dialog geometry는 `tests/e2e/milestone-exchange-state.spec.ts`를 사용한다. 로컬 실행 결과는 TEST_PLAN 작성자에게 전달하며 원격 E2E 완료를 대체하지 않는다.


## Issue #456 — 폼 정보 밀도와 저장 중 닫기 보호

작업 정보의 요청 시작일·기간·요청 종료일·일정 모드는 이름이 있는 `일정` fieldset 안에 인접하게 배치한다. 설명과 URL은 `상세 정보` fieldset으로 묶는다. 좁은 화면의 DOM 읽기 순서, 설명의 기존 전체 읽기 폭·최소 높이 120px·세로 resize는 유지한다. 상태/slider/진행률 값은 각자의 grid 폭 안에 배정하며 10%와 100% 값·focus outline이 panel 안에서 보여야 한다.

Footer는 Reload 왼쪽, Cancel/Commit 오른쪽을 유지하되 모든 action에 104px 최소 폭을 강제하지 않는다. Commit은 가장 긴 pending label을 aria-hidden sizer로 미리 확보해 저장 전후 geometry를 유지한다. 관계 추가·편집·삭제와 Baseline action의 최소 높이는 44px이며, 모바일 두 줄 label의 자연 높이를 44px로 잘라내지 않는다. Resource, 소속 작업, 물류 연결 및 nested Relation Editor의 저장 단위·동적 탭·초안 계약은 그대로다.

실제 in-flight 상태(Task 저장, 소속 batch, Resource/Logistics 저장 등)에서는 disabled action으로 focus가 body에 떨어져도 반복 Escape가 현재 Task Editor를 닫지 않도록 document capture에서 보호한다. 보호는 열린 dialog의 DOM 순서에서 마지막 항목이 해당 Editor일 때에 한정하고 effect 종료 때 제거한다. 이는 현재 sibling dialog 소비자 범위의 보호이며 모든 native top-layer 순서를 일반적으로 보장하는 API는 아니다. readonly 또는 dirty 자체를 in-flight로 해석하지 않고 기존 Escape/확인 경로와 nested dialog 동작을 유지한다.

동일 WBS 표시 ID 집합의 필터 재적용을 생략하고, metadata-only canonical 응답으로 생기는 viewport zero reset은 실제 visible ID 집합과 일정/계층/Link가 같은 경우에만 동일 queue의 columns 완료 후 공개 scroll-chart로 복원한다. 실제 일정·scope·필터·scale·열 변경과 Chart 사용자 입력은 이전 위치로 덮지 않는다. 상세 guard는 PROJECT_UX의 #456 항목을 따른다.

검증 범위는 TEST_PLAN의 #456 실행 기록을 따른다. B 설정·근무 규칙·인증은 #490, C 생성·복사·template·Import/Export·견적은 #491 후속이며 이 구현의 제품 검증으로 간주하지 않는다.

## Issue #493 — Summary Description/URL 편집

Summary의 Description과 URL은 자손 일정에서 파생되는 값이 아니라 Summary 자체가 소유하는 비일정 메타데이터다. 따라서 편집 권한이 있는 Task Editor에서는 일반 Task와 같은 입력·정규화·검증을 사용한다. Description은 10,000 Unicode code point 이하이며 공백-only는 null, URL은 trim 후 4,096 code point 이하의 HTTP(S)만 허용한다.

Summary의 요청 시작일·기간·일정 모드·진행률·상태·Baseline은 기존 파생/읽기 전용 계약을 유지한다. Description/URL 변경은 이 필드를 payload에 넣지 않으며, 하위 Task 추가·삭제·이동 또는 Summary 재계산이 저장된 Description/URL을 초기화하지 않는다. readonly, 다른 편집 단위의 dirty/pending, stale revision, 저장 중 잠금과 focus/Escape/초안 보호는 기존 Task Editor 규칙을 그대로 따른다.
