# Issue #4 — Grid / Chart 작업 정보 편집기

## 사용 방법과 범위

프로젝트 Grid의 작업 행 또는 Chart의 작업 막대를 우클릭하면 해당 작업의 **작업 정보** 대화상자를 바로 연다. 선택된 행이나 작업명이 아니라 실제 taskId로 찾는다. Tab으로 작업 행/막대에 포커스를 옮긴 뒤 Shift+F10 또는 ContextMenu 키도 사용할 수 있다. Grid 헤더의 우클릭/Shift+F10은 기존 표시 열 메뉴를 유지한다. 빈 Chart, 링크, 시간축과 입력 상자에는 작업 우클릭 처리를 적용하지 않는다.

일반 작업은 작업명·시작일·기간(근무일)·진행률을 입력하고 **저장**한다. 입력 도중에는 저장하지 않는다. 종료일은 마지막 서버 확정값이며 저장 시 서버가 프로젝트의 휴일/주말과 일정 모드로 다시 계산한다. 마일스톤 기간은 0이며 수정할 수 없다. 요약 작업은 조회만 가능하다. 편집 권한이 없거나 연결이 존재하면 같은 정보창에 읽기 전용 사유를 표시하고 저장을 제공하지 않는다. 삭제, 작업 유형 변경, 관계/담당자 편집과 PRO 기능은 범위 밖이다.

취소/닫기/Escape는 미저장 변경이 있으면 먼저 버리기 확인을 요구한다. 편집기 하나가 열려 있는 동안 다른 작업으로 초안을 조용히 전환하지 않는다. 닫은 뒤 원래 행/막대로 포커스를 복구하며, 오류 복구로 DOM이 교체되었으면 해당 taskId의 현재 행이나 작업공간을 사용한다.

## 저장과 오류 처리 계약

- `show-editor`는 공개 SVAR action을 사용하고 `api.intercept`로 프로젝트 편집기에 연결한다. 초기화/해제 tag는 `project-task-editor`이며 native add/update 동기화 가드는 변경하지 않는다.
- `task-context-target.ts`만 SVAR의 행/막대 DOM 속성을 해석한다. `data-id` / `data-task-id`의 문자열 ID 접두사를 해석한 뒤 UUID와 현재 canonical task 목록 양쪽을 확인한다. 이름·선택·정렬 순번으로 fallback하지 않는다.
- `task-editor-model.ts`는 DTO를 초안으로 복사하고 변경된 name/start/duration/progress만 command로 만든다. 시작일은 date-only 문자열이며 duration은 직접 입력한 근무일이다. Pointer resize의 달력 span 변환기를 통과시키지 않는다. name/progress-only PATCH는 start를 포함하지 않으므로 requestedStart를 보존한다.
- 기존 `ProjectReadonlyView.saveTask`가 credentials:same-origin, Content-Type과 If-Match를 포함해 동일 PATCH API를 호출한다. 편집기를 열었을 때의 revision을 명시적으로 전달한다. 서버 session/Origin/revision/스케줄러 계약, DB 스키마와 API는 변경하지 않는다.
- 편집기 ref mutex와 기존 aggregate mutation mutex로 연속 클릭/Enter 중복 요청을 차단한다. 저장 중 입력/닫기를 막고, 성공한 canonical 응답만 Gantt에 반영한 후 닫는다. 정상 처리에서는 문서 reload, loading 화면이나 Gantt key 변경이 없다.
- 400/409/422/5xx/network 오류는 기존 `handleTaskFailure`로 확정 상태를 다시 읽는다. Gantt만 복구할 수 있으며 편집기는 recovery key 바깥에 있으므로 초안을 보존한다. 검증 오류를 수정하거나 사용자가 명시적으로 재시도할 수 있다.
- 401은 즉시 읽기 전용으로 바뀌고 초안을 보존한다. 412 또는 현재 revision과 opened revision이 다르면 저장을 막는다. **최신 정보 다시 불러오기 → 버리기 확인 → 최신 값 검토 → 재편집/저장**이 필요하다. 초안을 최신 revision으로 자동 덮어쓰기하지 않는다. 재조회가 실패하면 이전 초안과 충돌 잠금을 그대로 유지한다.
- 정보 재조회는 편집 권한을 새로 부여하지 않는다. 편집 권한은 기존 session 흐름으로만 확인한다.

## 구현 선택과 공식 참고

[SVAR Context Menu demo](https://docs.svar.dev/react/gantt/samples/#/context-menu/willow)는 같은 API를 ContextMenu/Gantt/Editor가 공유하지만 메뉴 선택을 거쳐 Editor를 여는 예제다. 이슈의 직접 열기 요구에 따라 별도 메뉴 단계 없이 공개 [show-editor](https://docs.svar.dev/react/gantt/api/actions/show-editor/)와 [intercept](https://docs.svar.dev/react/gantt/api/methods/intercept/)를 사용한다. 편집 UI는 기존 설치 스택의 React/native dialog/CSS Module로 구성하여 새로운 패키지나 PRO 의존성을 추가하지 않는다. 기본 Editor의 즉시 로컬 update와 달력일 기간 의미가 프로젝트의 명시적 PATCH/근무일 계약과 다르므로 프로젝트 전용 편집기를 사용한다.

프런트는 서버/DB 모듈을 import하지 않는다. 날짜 형식 검증만 기존 pure domain의 parseDateOnly를 사용하며 종료일 계산은 서버에 맡긴다. 관련 계약은 [Architecture](ARCHITECTURE.md), [API](API.md), [Scheduling](SCHEDULING_ENGINE.md), [Security](SECURITY.md), [원격 검증](REMOTE_VALIDATION.md)을 따른다.

## 검증 계획과 상태

기준 main `1c8ae78ddf20799aa2b705c1a770cc53e136f44c`. 로컬 테스트는 기존 사용자 보류 요청에 따라 **NOT TESTED**다. 이 문서 작성 시 새 기능의 원격 검증도 **NOT TESTED**이며, 커밋 후 PR의 정확한 head SHA/run 결과로만 판정한다. 기존 main/PR #16 PASS를 이 기능의 PASS로 재사용하지 않는다.

| 계층 | 범위 | 파일 |
| --- | --- | --- |
| 단위 | 무변경/whitelist, 시작일·기간만 변경, normalized requestedStart 보존, Unicode/범위 검증, milestone/summary/권한/links, DOM ID 파싱 | tests/features/gantt/task-editor-model.test.ts |
| Browser + mock API | Grid/Chart 실제 타겟, 선택·정렬·접힘·헤더, 키보드/포커스/dirty 닫기, 한 편집기, 지연 및 중복 저장, 휴일 계산 반영, 422/500/network/401/412와 재조회 실패/명시적 재시도 | tests/e2e/project-task-editor.spec.ts |
| Browser + 실제 SQLite API | 첫 child가 있는 실제 프로젝트에서 편집 저장/재조회/reload, 부모 집계, 단일 PATCH, 정상 Gantt identity 유지, UTC/Seoul/New York date-only 표시 | tests/e2e/project-task-editor-persistence.spec.ts |
| 전체 회귀 | 기존 타입/lint/단위/통합/E2E/Docker gate | .github/workflows/ci.yml |

mock의 결과는 DB 영속성 증거가 아니며 실제 API 테스트와 구분한다. UI 캡처가 없으면 해당 테스트 파일과 CI 로그를 기능 증거로 제시한다. 실제 사용자 환경의 브라우저/스크린리더/Windows 및 최종 수동 UX는 별도 **NOT TESTED**로 남긴다.

## 남은 범위

PR #16의 초기 시간축 범위 확대 및 canonical sync 종료 시점 입력 잠금 P2 관측은 별도 검토 대상이다. 이번 편집기 저장 결과가 초기 시간축 밖이면 해당 기존 제약의 영향을 받을 수 있다. #8 HTTP production 지원, #9/#10/#11 UI 변경, 릴리스 #17은 이슈 #4의 구현 범위가 아니다. 이 기능 PR 생성과 CI 성공은 main 병합, 정식 이미지 릴리스 또는 운영 배포를 의미하지 않는다.
