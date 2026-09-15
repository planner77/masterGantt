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

프로젝트 복사는 원본 `ProjectCopyService`의 동일 transaction 안에서 Description/URL까지 함께 INSERT하여 all-or-nothing 계약을 유지한다. Task 삭제 응답에서도 canonical task snapshot에 신규 필드를 포함한다.

### Task Editor

- 진행률: `input[type=range]`, min 0, max 100, step 1. 현재 `%`를 별도 텍스트로 표시하고 Slider와 명시적인 label을 연결한다.
- 신규 Slider 변경값은 1% 정수 단위를 사용한다. 기존 DB에 저장된 소수 진행률은 다른 필드만 수정할 때 저장을 차단하지 않아 하위 호환성을 유지한다.
- Description: 다중 행 `textarea`, 개행을 보존한다.
- URL: URL 입력 필드. 저장 전 클라이언트 검증과 서버 검증을 모두 적용한다.
- Slider/Description/URL 편집 중 서버 mutation은 발생하지 않으며 `저장` 시 기존 논리적 PATCH 1회로 전송한다.
- 취소, dirty 확인, revision 충돌, reload, readonly 및 Summary 제한은 기존 정책을 유지한다.

### URL 실행

Grid 행 또는 Chart bar의 일반 좌클릭이 완료되었고 해당 Task에 안전한 URL이 있는 경우에만 새 탭으로 연다. 저장된 URL은 canonical snapshot에서 가져오며 실행 직전에도 `http:`/`https:` scheme을 재확인한다.

다음 동작에서는 URL을 실행하지 않는다.

- 우클릭/Context Menu
- pointer 이동 5px 초과(Drag/Resize/스크롤성 이동)
- pointer cancel
- input/textarea/select/button/link/dialog/menu 내부 동작
- pointerdown과 click의 Task가 다른 경우

팝업 차단으로 새 창을 만들지 못하면 사용자에게 안내한다. 링크 실행은 현재 Gantt 페이지를 navigation/reload하지 않는다.

## Import / Export 범위

현재 Import schema v1은 create-only 일정 교환 규약이며 Description/URL은 기존 규약의 필수 필드가 아니다. Issue #36에서는 기존 파일 호환성을 깨지 않기 위해 Import schema version을 변경하지 않는다. 프로젝트 복사에는 신규 필드를 보존한다. 향후 JSON/Excel Import/Export에서 Task 상세 메타데이터를 공식 교환 항목으로 포함하려면 schema version 및 VBA mapping을 함께 변경하는 별도 이슈로 다룬다.

## 테스트 및 리뷰 보정

- `tests/features/gantt/task-editor-model.test.ts`: Slider 진행률, 기존 소수 진행률 호환성, Description 정규화/개행, URL 검증, payload whitelist.
- `tests/server/projects/task-field-contract.test.ts`: 서버 URL scheme 검증 및 정규화.
- `tests/e2e/project-task-editor-persistence.spec.ts`: 명시적 1회 저장, canonical 재조회, Description/URL 영속성, Grid URL 새 탭 실행, context menu 비충돌, Gantt remount 방지, timezone 회귀.
- 신규 `0002_task_description_url.sql` 적용에 맞춰 DB/CLI migration 기대값을 2개 migration으로 갱신했다.
- PR #50의 최초 CI Run #181에서는 정적 검사·단위/통합·빌드·Docker smoke가 통과했으나 Chromium E2E 두 건이 실패했다. 원인은 진행률 값 표시용 `<output>` 추가로 기존 종료일 output selector가 중복되고, label 내부에 현재 값까지 포함되어 접근성 이름이 달라진 것이었다. Slider label을 명시적으로 연결하고 현재 값 표시는 일반 텍스트로 분리하여 기존 종료일 output 계약을 보존했다.
- Codex P1 리뷰에서 확인된 기존 소수 진행률 편집 차단과 프로젝트 복사의 상세 필드 후속 transaction 문제를 각각 하위 호환 검증과 원본 transaction 저장으로 보정했다.
- 최종 head는 GitHub Actions의 typecheck/lint/unit/integration/build/Chromium E2E/Docker smoke 전체 통과를 병합 gate로 사용한다.

## 릴리스

사용자 기능 추가이므로 SemVer minor 증가를 적용하여 `0.11.0` / `v0.11.0`을 릴리스 대상으로 한다. `package.json`과 `package-lock.json`은 `npm version 0.11.0 --no-git-tag-version`으로 함께 갱신했다. PR #50의 최종 CI 통과 후 main 병합, annotated tag 및 release-image 품질 gate를 거쳐 게시한다.
