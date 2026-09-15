# Issue #36 — Task Editor 확장 구현 및 검증

## 범위

Issue #36은 기존 명시적 저장 방식의 Task Editor를 유지하면서 진행률 Slider, Description, URL을 추가하고 Grid/Chart 일반 클릭으로 저장된 URL을 여는 기능을 구현한다.

## 구현 구조

### 데이터베이스

`db/migrations/0002_task_description_url.sql`에서 `tasks.description`, `tasks.url` TEXT nullable 컬럼을 추가한다. 기존 행은 두 필드 모두 `NULL`로 유지되므로 기존 프로젝트 migration 시 일정 데이터는 변경되지 않는다.

### API 계약 및 검증

Task 생성/수정 계약에 `description`, `url`을 선택 필드로 추가한다.

- Description: 최대 10,000 Unicode code point, 개행 보존, 공백만 있는 값은 `null`.
- URL: 저장 전 trim, 최대 4,096 code point, `http:` 또는 `https:`만 허용.
- `javascript:`, `data:`, `vbscript:`, `file:` 및 파싱할 수 없는 URL은 400 검증 오류로 거부한다.
- strict request schema와 기존 If-Match/revision 검증은 유지한다.

### Repository / Service / canonical snapshot

ScheduleRepository는 신규 컬럼을 읽고 생성 시 저장하며, 일정 갱신에서는 Description/URL을 덮어쓰지 않는다. TaskFieldProjectService는 기존 scheduling 중심 ProjectService를 확장하여 Task 상세 필드의 저장과 canonical snapshot 반환을 담당한다.

프로젝트 복사는 원본 작업의 Description/URL을 같은 externalId의 복사본에 전달한다. Task 삭제·프로젝트 metadata 변경 응답에서도 canonical task snapshot에 신규 필드를 포함한다.

### Task Editor

- 진행률: `input[type=range]`, min 0, max 100, step 1. 현재 `%`를 별도 output으로 표시한다.
- Description: 다중 행 `textarea`, 개행을 보존한다.
- URL: URL 입력 필드. 저장 전 클라이언트 검증과 서버 검증을 모두 적용한다.
- Slider/Description/URL 편집 중 서버 mutation은 발생하지 않으며 `저장` 시 기존 논리적 PATCH 1회로 전송한다.
- 취소, dirty 확인, revision 충돌, reload, readonly 및 Summary 제한은 기존 정책을 유지한다.

### URL 실행

Grid 행 또는 Chart bar의 일반 좌클릭이 완료되었고 해당 Task에 안전한 URL이 있는 경우에만 `window.open(url, "_blank", "noopener,noreferrer")`로 연다.

다음 동작에서는 URL을 실행하지 않는다.

- 우클릭/Context Menu
- pointer 이동 5px 초과(Drag/Resize/스크롤성 이동)
- pointer cancel
- input/textarea/select/button/link/dialog/menu 내부 동작
- pointerdown과 click의 Task가 다른 경우

팝업 차단으로 새 창을 만들지 못하면 사용자에게 안내한다. 링크 실행은 현재 Gantt 페이지를 navigation/reload하지 않는다.

## Import / Export 범위

현재 Import schema v1은 create-only 일정 교환 규약이며 Description/URL은 기존 규약의 필수 필드가 아니다. Issue #36에서는 기존 파일 호환성을 깨지 않기 위해 Import schema version을 변경하지 않는다. 프로젝트 복사에는 신규 필드를 보존한다. 향후 JSON/Excel Import/Export에서 Task 상세 메타데이터를 공식 교환 항목으로 포함하려면 schema version 및 VBA mapping을 함께 변경하는 별도 이슈로 다룬다.

## 테스트

- `tests/features/gantt/task-editor-model.test.ts`: Slider 정수 진행률, Description 정규화/개행, URL 검증, payload whitelist.
- `tests/server/projects/task-field-contract.test.ts`: 서버 URL scheme 검증 및 정규화.
- `tests/e2e/project-task-editor-persistence.spec.ts`: 명시적 1회 저장, canonical 재조회, Description/URL 영속성, Grid URL 새 탭 실행, context menu 비충돌, Gantt remount 방지, timezone 회귀.
- 신규 `0002_task_description_url.sql` 적용에 맞춰 DB/CLI migration 기대값을 2개 migration으로 갱신했다.
- PR CI #178의 최초 실패는 신규 migration을 반영하지 않은 두 고정 기대값 때문이었으며 typecheck/lint와 나머지 518개 단위·통합 테스트는 통과했다. 해당 기대값을 수정한 뒤 전체 CI를 다시 검증한다.
- 기존 CI의 typecheck/lint/unit/integration/build/Chromium E2E/Docker smoke를 함께 통과해야 한다.

## 릴리스

사용자 기능 추가이므로 SemVer minor 증가를 적용하여 `0.11.0` / `v0.11.0`을 릴리스 대상으로 한다. 실제 릴리스는 PR CI와 main 병합 후 release 검증 workflow까지 성공한 뒤 게시한다.
