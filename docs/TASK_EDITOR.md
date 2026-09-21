# Issue #4 / #22 / #31 / #72 — 작업 메뉴와 Grid / Chart 작업 명령

## 사용 방법과 범위

프로젝트 Grid의 작업 행 또는 Chart의 작업 막대를 우클릭하면 해당 작업의 **작업 메뉴**를 먼저 연다. 메뉴의 **작업 정보**를 선택해야 기존 작업 정보 대화상자가 열린다. 메뉴를 여는 것만으로 대화상자·저장·삭제가 실행되지 않는다. 선택된 행이나 작업명이 아니라 실제 taskId로 찾는다. Tab으로 작업 행/막대에 포커스를 옮긴 뒤 Shift+F10 또는 ContextMenu 키로 메뉴를 열고, 작업 정보 항목에서 Enter로 진입할 수 있다. Escape는 메뉴를 닫는다. Grid 헤더의 우클릭/Shift+F10은 기존 표시 열 메뉴를 유지하며 두 메뉴는 동시에 표시하지 않는다. 빈 Chart, 링크, 시간축과 입력 상자에는 작업 우클릭 처리를 적용하지 않는다.

일반 작업은 작업명·시작일·기간(근무일)과 0~100% 진행률 Slider, 여러 줄 Description, `http://`/`https://` URL을 입력하고 **저장**한다. 입력 도중에는 저장하지 않는다. 종료일은 마지막 서버 확정값이며 저장 시 서버가 프로젝트의 휴일/주말과 일정 모드로 다시 계산한다. 마일스톤 기간은 0이며 수정할 수 없다. 요약 작업은 조회만 가능하다. 편집 권한이 없거나 연결이 존재하면 같은 정보창에 읽기 전용 사유를 표시하고 저장을 제공하지 않는다. 작업 삭제는 #31의 별도 보호 흐름으로 제공한다. 작업 유형 변경, 관계/담당자 편집과 PRO 기능은 범위 밖이다.

취소/닫기/Escape는 미저장 변경이 있으면 먼저 버리기 확인을 요구한다. 편집기 하나가 열려 있는 동안 다른 작업으로 초안을 조용히 전환하지 않는다. 메뉴의 Escape는 원래 호출 대상으로 포커스를 복구한다. 편집기 종료 시 연결된 원래 대상이 없으면 해당 taskId의 현재 행이나 작업공간을 사용한다. 포커스 복구에는 preventScroll을 사용한다.

## 메뉴 항목 채택 정책

| 항목 | 정책 | 이유 |
| --- | --- | --- |
| 작업 정보 | 제공 | 기존 보호된 편집기에서 조회/편집 여부를 판단한다. 읽기 전용 프로젝트에도 정보 조회를 제공한다. |
| 작업 삭제 | 제공 (#31) | Edit·무연결 일정에서 실제 우클릭 taskId를 대상으로 한다. 자손이 있으면 범위 확인 후 `includeDescendants=true`로 원자 삭제한다. |
| Add / Cut / Copy / Paste | 제공 (#72) | Cut/Copy는 프로젝트 화면의 clipboard 상태만 갱신하고 Paste 시 서버의 원자 계층 명령을 호출한다. Add는 child/above/below 위치를 명시한다. |
| Convert / Move / Indent / Outdent | 제공 (#72) | 현재 canonical hierarchy에서 유효한 명령만 활성화하고 서버가 parent/sibling order와 Summary를 재계산한다. 빈 Summary 또는 Link 포함 일정은 fail-closed한다. |

삭제 메뉴는 Readonly·mutation 진행 중·Link가 있는 일정에서는 비활성화한다. 자손 없는 작업은 기존 단건 DELETE, 자손이 있는 작업은 작업명·자손 수·총 삭제 수를 보여주는 확인창을 거쳐 명시적 subtree DELETE를 사용한다. 취소/Escape/닫기는 DELETE 0회이며 확인 시점 revision이 바뀌면 412 후 최신 범위를 다시 확인한다.

메뉴는 우클릭 지점 근처에 fixed overlay로 표시하고 viewport 경계를 보정한다. 바깥 클릭, 다른 작업 우클릭, Escape, resize/scroll은 닫기 또는 대상 전환으로 처리한다. 기본 상세 편집기와 서버 권한/저장 제약은 메뉴와 별도로 유지한다.

## 저장과 오류 처리 계약

- 메뉴의 작업 정보 선택은 공개 SVAR `show-editor` action을 실행하고 `api.intercept`로 프로젝트 편집기에 연결한다. 기존 double-click/native show-editor 경로를 메뉴 클릭으로 대체하지 않는다. 초기화/해제 tag는 `project-task-editor`이며 native add/update 동기화 가드는 변경하지 않는다.
- `task-context-target.ts`만 SVAR의 행/막대 DOM 속성을 해석한다. `data-id` / `data-task-id`의 문자열 ID 접두사를 해석한 뒤 UUID와 현재 canonical task 목록 양쪽을 확인한다. 이름·선택·정렬 순번으로 fallback하지 않는다.
- `task-editor-model.ts`는 DTO를 초안으로 복사하고 변경된 name/start/duration/progress/description/url만 command로 만든다. 시작일은 date-only 문자열이며 duration은 직접 입력한 근무일이다. Pointer resize의 달력 span 변환기를 통과시키지 않는다. name/progress-only PATCH는 start를 포함하지 않으므로 requestedStart를 보존한다.
- 기존 `ProjectReadonlyView.saveTask`가 credentials:same-origin, Content-Type과 If-Match를 포함해 동일 PATCH API를 호출한다. 편집기를 열었을 때의 revision을 명시적으로 전달한다. 서버 session/Origin/revision/스케줄러 계약을 유지하며, Issue #36의 Description/URL은 동일 PATCH 경로와 SQLite migration/canonical snapshot 계약으로 저장한다.
- 편집기 ref mutex와 기존 aggregate mutation mutex로 연속 클릭/Enter 중복 요청을 차단한다. 저장 중 입력/닫기를 막고, 성공한 canonical 응답만 Gantt에 반영한 후 닫는다. 정상 처리에서는 문서 reload, loading 화면이나 Gantt key 변경이 없다.
- 400/409/422/5xx/network 오류는 기존 `handleTaskFailure`로 확정 상태를 다시 읽는다. Gantt만 복구할 수 있으며 편집기는 recovery key 바깥에 있으므로 초안을 보존한다. 검증 오류를 수정하거나 사용자가 명시적으로 재시도할 수 있다.
- 401은 즉시 읽기 전용으로 바뀌고 초안을 보존한다. 412 또는 현재 revision과 opened revision이 다르면 저장을 막는다. **최신 정보 다시 불러오기 → 버리기 확인 → 최신 값 검토 → 재편집/저장**이 필요하다. 초안을 최신 revision으로 자동 덮어쓰기하지 않는다. 재조회가 실패하면 이전 초안과 충돌 잠금을 그대로 유지한다.
- 정보 재조회는 편집 권한을 새로 부여하지 않는다. 편집 권한은 기존 session 흐름으로만 확인한다.

## 구현 선택과 공식 참고

[사용자 지정 Willow 데모](https://docs.svar.dev/react/gantt/samples/#/editor/willow), [SVAR Context Menu demo](https://docs.svar.dev/react/gantt/samples/#/context-menu/willow), [공식 ContextMenu API](https://docs.svar.dev/react/gantt/helpers/context_menu/)를 참조한다. Issue #4의 직접 열기 계약은 Issue #22에서 **메뉴 → 작업 정보 → 기존 편집기**로 변경했다. 현재 PR은 프로젝트 전용 React 메뉴와 `task-context-menu.css`를 사용하고, 공개 [show-editor](https://docs.svar.dev/react/gantt/api/actions/show-editor/)와 [intercept](https://docs.svar.dev/react/gantt/api/methods/intercept/)로 기존 편집기에 연결한다. 새로운 패키지나 PRO 의존성을 추가하지 않는다.

프로젝트 편집기는 React/native dialog/CSS Module 기반이다. 기본 Editor의 즉시 로컬 update와 달력일 기간 의미가 프로젝트의 명시적 PATCH/근무일 계약과 다르므로 기존 프로젝트 편집기를 유지한다. 이 사유는 상세 편집기의 선택 이유이며, 공식 ContextMenu helper가 사용 불가능하다는 의미는 아니다. 지정 데모의 실제 화면 실측·pixel 비교와 helper 대비 접근성 적합성 판단은 자동 CI 결과와 별도로 검증해야 한다.

프런트는 서버/DB 모듈을 import하지 않는다. 날짜 형식 검증만 기존 pure domain의 parseDateOnly를 사용하며 종료일 계산은 서버에 맡긴다. 관련 계약은 [Architecture](ARCHITECTURE.md), [API](API.md), [Scheduling](SCHEDULING_ENGINE.md), [Security](SECURITY.md), [원격 검증](REMOTE_VALIDATION.md)을 따른다.

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

편집 권한이 있고 다른 mutation이 진행 중이지 않으며 Dependency Link가 없는 경우 메뉴는 SVAR Willow의 기본 작업 흐름에 맞춰 **Add → Convert to → Edit → Cut/Copy/Paste → Move → Indent/Outdent → Delete** 순서를 제공한다. Readonly에서는 정보 조회(Edit)만 실제 동작하며 mutation 항목은 비활성화한다.

Cut은 선택 Task를 즉시 삭제하거나 이동하지 않는다. Copy와 함께 현재 Project revision을 포함한 client clipboard만 만든다. Paste는 `POST /api/projects/{publicId}/task-commands`를 호출하며 Cut은 `reparent`, Copy는 `copy` 명령으로 변환한다. 성공 응답의 canonical snapshot만 동일 Gantt instance에 동기화하고 revision 변경 시 기존 clipboard는 폐기한다. Ctrl/Cmd+X/C/V, Delete/Backspace/Ctrl+D는 input/textarea/dialog/contenteditable 밖의 실제 Task target에서만 동작한다.

Leaf→Summary는 빈 Summary를 영속화하지 않는 기존 모델 때문에 직접 변환 항목을 비활성화한다. Task↔Milestone은 자식이 없는 Leaf에서만 허용한다. Task를 child parent로 사용하는 Add/Indent/Paste는 기존 first-child 정책과 동일하게 해당 Task를 transaction 안에서 Summary로 전환한다. subtree Copy에 Resource Assignment가 존재하면 조용히 누락하지 않고 현재 단계에서는 `TASK_COPY_ASSIGNMENTS_UNSUPPORTED`로 거부한다.
