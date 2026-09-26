# Changelog

## [0.33.1] - 2026-09-26

### Fixed

- Issue #157: 운영 Compose를 GHCR/prebuilt image 전용 경로로 분리하고 `pull_policy: always`를 적용해 rolling tag의 stale local image 재사용 가능성을 줄인다.
- local/CI source build는 `deploy/compose.build.yml` override에서만 허용하고 registry pull을 비활성화하여 운영 image pull과 build 경로를 명확히 분리한다.
- exact SemVer/verified digest 우선 배포, rolling tag의 명시적 pull/recreate, 실행 image identity 확인, Compose config 출력의 secret 마스킹 절차와 회귀 검증을 문서화한다.

## [0.33.0] - 2026-09-26

### Fixed

- Issue #142: Summary Task와 Task를 시작일 셀 좌측부터 종료일 셀 우측까지 inclusive 범위로 표시하고, Milestone을 Day/Week scale의 실제 날짜 셀 중앙에 정렬한다. 가로 스크롤과 390/768/1024/1440px 회귀 검증을 추가하고 기존 drag/resize/progress/dependency 및 날짜 저장 계약을 유지한다.


## [0.32.0] - 2026-09-24

### Added

- Issue #140: Grid 작업명 셀의 한 번 클릭 인라인 편집을 추가한다. Summary·Task·Milestone의 이름을 기존 권한·revision 계약으로 저장하고 Enter·blur 저장, Escape 취소 및 입력 오류 복구를 지원한다.

## [0.31.0] - 2026-09-24

### Added

- Issue #138: 프로젝트 상태 예정·진행 중·완료의 저장·편집과 목록 다중 필터를 추가한다. 기존 프로젝트는 진행 중으로 이관하고 신규·복사 프로젝트는 예정으로 시작하며 기본 목록에서 완료를 제외한다.

## [0.30.0] - 2026-09-24

### Added

- Issue #141: masterGantt 파비콘과 프로젝트명에 따른 브라우저 title을 제공하고 비종속 화면·오류·프로젝트 이탈 시 기본 title로 복원한다.

## [0.29.0] - 2026-09-24

### Added

- Issue #136: 공통 헤더 브랜드 옆에 package.json의 빌드 버전을 표시하고 좁은 화면에서는 기존 탐색 공간을 유지한다.

## [0.28.0] - 2026-09-24

### Added

- Issue #155: Gantt 전체 화면 전환과 키보드 단축키를 추가하고, 종료 시 focus 복귀와 Task Editor 열기 전 안전한 전체 화면 종료를 지원한다.

## [0.27.10] - 2026-09-24

### Fixed

- Issue #130 Phase 4: Project 목록·일정·리소스 검색 도구줄의 필터 수·초기화·결과 표현과 좁은 화면 배치를 통일하고 부분 날짜 안내와 focus 복귀를 유지한다.

## [0.27.9] - 2026-09-24

### Fixed

- Issue #130 Phase 3: Task Editor의 정보 위계와 반응형 필드 배치를 정리하고 본문 스크롤 중 header·탭·footer 접근을 유지한다.

## [0.27.8] - 2026-09-24

### Fixed

- Issue #130 Phase 2: Project Context와 일정·리소스 탭의 간격·시각 토큰을 정합화하고 정보·더보기 disclosure의 Escape focus 복귀를 지원한다.

## [0.27.7] - 2026-09-24

### Fixed

- Issue #130 Phase 1: Project 목록의 정보 위계·간격·상태 토큰을 정리하고 기존 표·검색·행 메뉴와 좁은 화면 내부 스크롤 계약을 유지한다.

## [0.27.6] - 2026-09-24

### Fixed

- Issue #121: App Shell에 키보드 본문 바로가기와 focus 가능한 main landmark를 제공하고 기존 dialog focus trap을 유지한다.

## [0.27.5] - 2026-09-24

### Fixed

- Issue #119: 리소스 할당·캘린더 반복 입력과 Project 생성의 필드 오류를 입력에 연결하고, 명시적 제출의 오류 요약과 키보드 focus 이동을 제공한다.

## [0.27.4] - 2026-09-24

### Fixed

- Issue #118: 좁은 화면에서 Project 제목·상태·일정 검색 도구줄을 읽고 조작하기 쉽게 배치하고, 필터 panel의 키보드 닫기와 focus 복귀를 유지한다.

## [0.27.3] - 2026-09-24

### Fixed

- Issue #117: 리소스 공수와 이름·코드 메타데이터의 조회 상태를 분리하고, 부분 실패·마지막 성공 결과·최신 메타데이터 라벨·focus를 보존하는 개별 재시도를 제공한다.

## [0.27.2] - 2026-09-24

### Fixed

- Issue #116: 작업 Context Menu 하위 메뉴를 화면 여유 공간에 따라 좌우 flyout 또는 같은 폭 drilldown으로 배치하고, 작은 화면·짧은 높이에서 키보드 탐색과 명령 접근을 유지한다. 열린 하위 메뉴에서 일반 root 명령으로 focus/pointer가 이동하면 child를 닫아 표시 상태와 `aria-expanded`를 일치시킨다.

## [0.27.1] - 2026-09-24

### Fixed

- Issue #115: 작업 캘린더 입력이나 기준 revision이 바뀌면 이전 미리보기를 무효화하고 재계산을 안내한다. 계산 중·실패·완료 상태를 구분하고 초안과 기존 저장·인증 계약을 유지한다.

## [0.27.0] - 2026-09-24

### Added

- Issue #120: 기존 파란색 업무 UI palette를 유지하면서 surface/text/border/action/focus/status 의미를 명시하는 semantic UI token 계층을 추가한다.
- error/warning/info/success 상태와 focus outline을 공통 token으로 정의하고 실제 Chromium computed style에서 텍스트 대비와 focus 가시성을 측정하는 회귀 검증을 추가한다.

### Changed

- Task Editor, Resource Catalog Admin, Project Row Actions, Workspace Feedback의 selected/focus/disabled/error 상태를 공통 semantic token 또는 문서화된 density 예외로 정합화한다.
- focus indicator는 밝은 surface와 3:1 이상, readonly/subtle badge 일반 텍스트는 4.5:1 이상 대비를 유지하도록 실제 렌더링 조합을 검증한다.
- Issue #99가 0.26.0을 선점한 최신 main에 재통합했으므로, 하위 호환 UI enhancement를 다음 MINOR 버전 0.27.0으로 증가한다.


## [0.26.0] - 2026-09-23

### Added

- Issue #99: 유효한 리소스 관리자 세션에서 관리자 비밀번호를 UI/API로 변경하고 SQLite scrypt 자격증명으로 영속화한다.
- 최초 실행 시 `RESOURCE_CATALOG_ADMIN_PASSWORD`를 seed로 사용하며 DB 자격증명이 생성된 뒤에는 런타임 변경값을 우선한다.

### Changed

- 프로젝트 편집 및 리소스 관리 신규 비밀번호 정책을 복잡도 강제 없이 1~12 Unicode 문자로 통일한다.
- 리소스 관리자 비밀번호 변경 시 기존 관리자 세션을 모두 revoke하고 호출자에게 새 세션을 발급한다.
- 기존 장문 Project 비밀번호는 unlock/삭제 재인증에 계속 사용할 수 있도록 호환성을 유지한다.
- 현재 main `0.25.0` 이후 사용자 기능/API 확장이므로 MINOR 버전 `0.26.0`으로 증가한다.

## [0.25.0] - 2026-09-23

### Added

- Issue #84: Project List에 프로젝트명·소유자·설명 Quick Search와 typed 고급 필터를 추가한다.
- 고급 필터는 프로젝트명/소유자/설명 text operator, 소유자 지정 여부, 생성일/최근 변경일의 browser-timezone 날짜 조건을 지원한다.
- 전체 수/일치 수, 검색 결과 0건 전용 상태, 조건별 삭제·전체 초기화, Escape focus 복귀와 responsive 접근성 계약을 추가한다.

### Changed

- Issue #83의 text normalization/operator primitive를 Task/Project filter가 공유하도록 분리하고 Project 전용 predicate는 독립 adapter로 유지한다.
- 검색은 client-side read-only view state이며 Project API/DB/revision과 기존 Row Action 정렬·mutation 계약을 변경하지 않는다.
- 사용자 기능 확장이므로 현재 main `0.23.1` 및 병행 중인 `0.24.0` 후보와 충돌하지 않도록 다음 MINOR 버전 `0.25.0`을 사용한다.

## [0.23.2] - 2026-09-23

### Fixed

- Issue #108: Excel 내보내기 `Gantt` 시트의 주차 헤더에서 ISO week year와 `W` 접두어를 제거하고 주차 번호만 표시한다.
- 월 헤더의 `YYYY-MM` 형식과 기존 ISO week 계산/그룹 경계는 유지하며, 연말·연초 `W53 → W01` 경계를 회귀 테스트로 고정한다.

### Changed

- API/DB 계약 변경 없이 기존 Excel 표시 형식만 수정하므로 Semantic Versioning 정책에 따라 `0.23.1`에서 PATCH 버전 `0.23.2`로 증가한다.


## [0.23.1] - 2026-09-22

### Fixed

- Issue #104: 프로젝트에 Dependency Link가 존재할 때 관계가 없는 Task의 Context Menu mutation까지 전역 비활성화되던 회귀를 수정한다.
- Context Menu/단축키/Task Editor와 서버 Task·Hierarchy·Subtree Delete 검증을 선택 Task 또는 영향 subtree 기준으로 좁혀, unrelated Link는 그대로 보존하면서 unlinked Task의 편집·이동·삭제를 허용한다.
- 관계 endpoint 자체와 관계가 포함된 영향 subtree는 기존 fail-closed 안전 계약을 유지한다.

### Changed

- 하위 호환 UI/서버 권한 판정 버그 수정이므로 Semantic Versioning 정책에 따라 `0.23.0`에서 PATCH 버전 `0.23.1`로 증가한다.

## [0.23.0] - 2026-09-22

### Added

- Issue #83: Project 일정 화면에 Task 통합 텍스트, effective 일정 기간, type/schedule mode, progress/duration, 할당 여부, 특정 Resource/Group ANY·ALL 검색/필터를 추가한다.
- 일치한 하위 Task를 표시할 때 ancestor Summary를 context row로 유지하고 실제 match count와 분리하며, 숨겨진 Task endpoint를 가진 dependency line은 표시하지 않는다.
- Resource 탭에 이름/code, Resource/Group 종류, 활성 상태, 연결 Task 기간 기반 필터를 추가하고 전체 Project workload 집계와 필터된 표시 행을 명확히 구분한다.

### Changed

- 검색/필터는 Project mutation·revision·DB 저장 없이 page-session view state로 동작하고 일정/리소스 탭별 상태를 유지한다.
- 사용자에게 노출되는 검색/필터 기능 확장이므로 Semantic Versioning 정책에 따라 `0.22.0`에서 `0.23.0`으로 증가한다.

## [0.22.0] - 2026-09-22

### Added

- Issue #97: Gantt의 FS/lag=0 작업 관계 생성·삭제를 보호된 Link API와 SQLite transaction에 연결하고 canonical snapshot으로 동일 SVAR instance를 동기화한다.
- Link 생성·삭제 후 dependency graph를 재계산해 Auto Task와 downstream 일정 및 Summary 파생값을 갱신하며, cycle/self/duplicate/Summary endpoint/Manual conflict를 원자적으로 거부한다.
- `POST /api/projects/{publicId}/links`와 `DELETE /api/projects/{publicId}/links/{linkId}`에 edit session, exact Origin, strong If-Match, Project isolation을 적용한다.

### Changed

- 사용자 기능/API 확장이므로 Semantic Versioning 정책에 따라 `0.21.1`에서 `0.22.0`으로 증가한다.

이 프로젝트의 주요 변경은 Semantic Versioning과 [CI/CD 정책](docs/CI_CD.md)에 따라 기록한다.

## [Unreleased]

## [0.21.1] - 2026-09-22

### Changed

- Issue #96: Task Editor의 작업 정보와 Resource allocation 입력을 content-aware grid로 조정해 넓은 화면에서 불필요한 stretching을 줄인다.
- 작업명은 주 입력 폭으로 제한하고 일정은 날짜/기간/확정 종료일에 맞는 비율, 진행률 slider는 최대 폭, Resource 투입률은 날짜보다 좁은 폭을 사용한다.
- 768px 이하에서는 기존 1열 stack으로 전환하며 Task PATCH, revision, dirty/stale/readonly, Assignment 저장 및 Relation 계약은 변경하지 않는다.
- 기존 기능의 호환 UI 밀도 보완이므로 `0.21.0`에서 PATCH 버전 `0.21.1`로 증가한다.

## [0.21.0] - 2026-09-22

### Added

- Issue #76: Project Workspace에 WAI-ARIA 기반 `일정 / 리소스` peer view 탭을 추가하고 두 panel을 mount 상태로 유지해 탭 전환 중 Gantt instance/state가 불필요하게 초기화되지 않도록 한다.

### Changed

- Global Header를 기존 75rem 제한에서 분리한 full-width App Shell로 변경하고 현재 전역 메뉴에 `aria-current`를 제공한다.
- Project Header를 프로젝트명과 편집 상태 중심의 compact context bar로 재구성하고 Description/Owner/Revision은 Info UI로 이동한다.
- 읽기 전용 편집 비밀번호 form은 상시 노출하지 않고 명시적 `편집 잠금 해제` Dialog에서만 입력하도록 변경한다.
- Resource workload를 Gantt 하단 portal에서 독립적인 full-width Resource View로 이동하고 Summary, M/D·M/M·Refresh toolbar, Group → Resource → Task hierarchy를 정돈한다.
- Issue #87의 `docs/UI_UX_GUIDELINES.md`와 UI/UX Agent 계약을 이번 Workspace 구현에 적용한다.
- 사용자 UI의 하위 호환 기능 확장이므로 Semantic Versioning 정책에 따라 `0.20.2`에서 `0.21.0`으로 증가한다.

## [0.20.2] - 2026-09-22

### Fixed

- Issue #80: Task Editor의 관계 표시가 `window.location.pathname` 파싱과 별도 Project GET에 의존하던 회귀를 수정하고, `ProjectWorkspace`가 이미 보유한 동일 canonical `tasks + links + revision` snapshot을 직접 사용하도록 변경한다.
- Grid 더블클릭, Chart 더블클릭, Context Menu → Edit에서 동일한 선행·후행 관계가 표시되고 Editor open만으로 mutation이 발생하지 않도록 Chromium E2E 회귀를 추가한다. 관계 표시 자체는 별도 Project GET에 의존하지 않는다.
- Readonly/Link 포함 일정에서도 Grid·Chart 더블클릭으로 조회용 Editor를 열 수 있고, 관계의 상대 작업명/externalId/type/lag 및 multiple relation 표시를 유지한다.

### Changed

- `0.20.1`이 Issue #77에서 사용되었으므로 하위 호환 회귀 결함 수정인 Issue #80은 다음 PATCH 버전 `0.20.2`를 사용한다.

## [0.20.1] - 2026-09-22

### Fixed

- Issue #77: Task Context Menu를 열 때 첫 번째 항목인 `Add`에 자동 focus가 지정되어 submenu가 즉시 열리던 회귀를 수정한다.
- 최초 focus는 root menu container에 두고, hover 또는 ArrowDown/ArrowUp/Home/End 등 사용자의 명시적 탐색 이후에만 menuitem과 submenu가 활성화되도록 변경한다.
- Grid와 Chart 모두에서 최초 open, close 후 reopen, pointer hover, keyboard navigation을 Playwright 회귀 테스트로 검증한다.

### Changed

- 하위 호환 UI 결함 수정이므로 Semantic Versioning 정책에 따라 `0.20.0`에서 `0.20.1`로 증가한다.

## [0.20.0] - 2026-09-21

### Changed

- Issue #74: Task Editor를 작업 정보·리소스·관계 3개 탭으로 재구성하고 Header/Tab/Footer는 유지한 채 Body만 스크롤하도록 대형 반응형 modal layout을 적용한다.
- WAI-ARIA tab pattern에 맞춰 Arrow Left/Right, Home/End 키보드 탐색과 focus-visible을 제공하고 360/768/1440px에서 horizontal overflow를 방지한다.
- 리소스 할당은 검색·유형·할당됨 필터, 선택 우선 정렬, Resource/Group badge와 row/divider 구조로 정돈하고 기존 Task PATCH와 Assignment PUT 저장 계약은 분리 유지한다.
- 관계 정보는 wide 화면 2열, narrow 화면 1열로 표시하고 관계/할당 건수를 탭과 섹션에서 확인할 수 있게 한다.
- 하위 호환 사용자 UX 확장이므로 Semantic Versioning 정책에 따라 `0.19.0`에서 `0.20.0`으로 증가한다.

## [0.19.1] - 2026-09-21

### Fixed

- Issue #75 정식 release gate에서 좁은 viewport의 행 작업 버튼을 Playwright가 자동 스크롤한 직후 메뉴를 열면서 지연된 `scroll` 이벤트와 경합하던 E2E 불안정성을 수정한다.
- 반응형 메뉴 검증은 작업 trigger를 먼저 `scrollIntoViewIfNeeded()`로 안정화하고 두 animation frame 뒤에 메뉴를 열어 실제 사용자 흐름인 ‘스크롤 완료 후 클릭’을 검증한다.

### Changed

- `v0.19.0` annotated tag의 release run #18은 candidate build/GHCR write 이전 Chromium E2E에서 실패했으므로 tag를 이동·삭제·재사용하지 않는다.
- 실패한 exact version을 덮어쓰지 않는 릴리스 정책에 따라 후속 PATCH 버전 `0.19.1`로 정식 release를 재진행한다.
## [0.19.0] - 2026-09-21

### Changed

- Issue #75: 프로젝트 목록 페이지를 일반 Form 폭과 분리해 최대 100rem의 wide layout으로 확장하고 Header/Table 좌우 기준선을 맞춘다.
- 프로젝트명을 primary navigation으로 유지하면서 행 작업을 `프로젝트 복사`·`링크 복사`·`삭제`가 포함된 accessible overflow menu로 통합한다.
- Header/Row typography, divider, hover/focus-within, Description 우선 열 배분과 반응형 horizontal scroll을 정리한다.
- 기존 링크 복사 fallback과 프로젝트 삭제 재인증/If-Match/오류 처리 계약은 변경하지 않는다.
- 하위 호환 사용자 UX 확장이므로 Semantic Versioning 정책에 따라 `0.18.0`에서 `0.19.0`으로 증가한다.


## [0.18.0] - 2026-09-21

### Added

- Issue #72: 편집 권한이 있는 Grid/Chart 작업의 우클릭 메뉴를 SVAR Willow 기본 작업 흐름에 맞춰 Add, Convert to, Edit, Cut, Copy, Paste, Move, Indent, Outdent, Delete로 확장한다.
- `POST /api/projects/{publicId}/task-commands`를 추가해 생성 위치 지정, 형식 변환, sibling 재정렬, indent/outdent, cut-paste reparent, subtree copy를 서버 권위의 단일 transaction으로 처리한다.
- Canonical hierarchy 동기화는 SVAR 공개 `move-task` action을 사용해 parent/sibling 변경을 반영하며, 구조 변경 중 불필요한 Gantt recovery remount를 방지한다.
- Ctrl/Cmd+X, Ctrl/Cmd+C, Ctrl/Cmd+V와 Delete/Backspace/Ctrl+D 작업 단축키를 추가한다.

### Changed

- 계층 명령 성공 시 전체 canonical snapshot을 반환하고 Project revision을 정확히 1 증가시키며, 기존 Dependency Link가 있는 일정은 기존 정책대로 계층 mutation을 거부한다.
- subtree copy는 리소스 할당을 조용히 누락하지 않도록 할당이 있는 원본을 `TASK_COPY_ASSIGNMENTS_UNSUPPORTED`로 명시적으로 거부한다.
- 하위 호환 사용자 기능/API 확장이므로 Semantic Versioning 정책에 따라 `0.17.0`에서 `0.18.0`으로 증가한다.


## [0.17.0] - 2026-09-19

### Added

- Issue #68: 작업 캘린더 Preview/저장 경로에 기존 `FS/lag=0` Dependency를 포함하는 서버 권위 forward-pass 재계산을 추가한다.
- `changedTasks`에 `CALENDAR` / `DEPENDENCY` / `SUMMARY` 원인과 실제 lower bound를 만든 선행 작업 External ID를 포함한다.
- Calendar 변경 후 Manual 후행 작업이 FS lower bound를 위반하면 `MANUAL_DEPENDENCY_CONFLICT`로 전체 저장을 거부한다.

### Changed

- Dependency Link 존재만으로 반환하던 `CALENDAR_RECALC_UNSUPPORTED` 제한을 제거하고, cycle은 `DEPENDENCY_CYCLE`, 지원 외 구조는 `UNSUPPORTED_SCHEDULE_STRUCTURE`로 구분한다.
- Calendar rule/date, Auto Task, Summary 파생값과 Project revision은 하나의 SQLite transaction에서 저장하며 revision은 정확히 1 증가한다.
- 하위 호환 일정 기능 확장이므로 Semantic Versioning 정책에 따라 `0.16.1`에서 `0.17.0`으로 증가한다.


## [0.16.1] - 2026-09-18

### Fixed

- Issue #67: Docker Compose가 `.env`의 `RESOURCE_CATALOG_ADMIN_PASSWORD`를 app 컨테이너에 전달하지 않던 결함을 수정한다.
- 관리자 비밀번호 누락 시 Compose config 단계에서 fail-fast하고, CI Docker smoke에서 실제 컨테이너 환경 전달·인증 성공/거부·로그 비노출을 검증한다.

### Changed

- 하위 호환 Docker 배포 결함 수정이므로 Semantic Versioning 정책에 따라 `0.16.0`에서 `0.16.1`로 증가한다.

## [0.16.0] - 2026-09-18

### Added

- Issue #57: 프로젝트별 작업 캘린더 관리 기능을 추가한다. 대한민국을 기본 국가로 하고 중국, 베트남, 필리핀, 태국, 멕시코, 미국의 2026년 국가 공휴일 fixture와 출처/version metadata를 저장소에 고정한다.
- 국가 규칙은 프로젝트 전체 또는 기간 범위로 적용할 수 있으며, 조직·개인·프로젝트 휴무일을 별도 CUSTOM 규칙으로 관리한다.
- Scheduling Domain에 명시적 `NON_WORKING` / `WORKING` 날짜 예외를 추가해 중국·베트남의 보충 근무일처럼 주말을 근무일로 전환하는 규칙을 지원한다.
- `GET /api/work-calendars/countries`, `GET/PUT /api/projects/{publicId}/work-calendar`, `POST /api/projects/{publicId}/work-calendar/preview` API와 Preview UI를 추가한다.
- 리소스 공수 계산은 Project + Resource Group + Resource 휴무일을 합성한 Effective Calendar를 사용한다.

### Changed

- 기존 `project_holidays` 데이터는 migration에서 신규 작업 캘린더 모델로 손실 없이 옮기고 호환 VIEW/trigger를 유지한다.
- 신규 프로젝트에는 생성 시점의 대한민국 `FULL_PROJECT` 국가 규칙을 기본 생성하며, 기존 프로젝트에는 migration만으로 국가 규칙을 자동 추가하지 않는다.
- 작업 생성·수정·삭제 및 하위 작업 삭제 재계산은 신규 Project Calendar를 서버 권위 일정 계산에 사용한다.
- 사용자 기능, API와 DB 계약을 하위 호환으로 확장하므로 Semantic Versioning 정책에 따라 `0.15.0`에서 `0.16.0`으로 증가한다.

## [0.15.0] - 2026-09-18

### Added

- Issue #64: Docker/server stdout에 JSON 한 줄 구조화 logger, 실제 `LOG_LEVEL` 필터, 민감 필드 redaction과 안전한 500 진단을 추가한다.
- 검증된 `X-Request-ID` 또는 서버 UUID를 API lifecycle, 오류 body, 응답 header와 서버 로그에서 동일하게 사용하는 request correlation을 추가한다.
- runtime configuration, DB migration, application startup과 readiness 장애/복구 운영 이벤트 및 Nginx↔Docker 추적 문서를 추가한다.

### Changed

- Issue #61의 리소스 관리자 인증 진단을 공통 logger에 연결하고 주요 Project/Task/Resource/Export API를 동일 request lifecycle 체계에 편입한다.
- 하위 호환 운영 관측성 및 request-correlation 기능 추가이므로 Semantic Versioning 정책에 따라 `0.14.1`에서 `0.15.0`으로 증가한다.


## [0.14.1] - 2026-09-18

### Fixed

- Issue #61: 리소스 편집 관리자 인증 실패 원인을 Docker/server stdout의 구조화 로그에서 구분할 수 있도록 진단 로그를 추가한다.
- 비밀번호 미설정·정책 위반·불일치를 `ADMIN_PASSWORD_NOT_CONFIGURED`, `ADMIN_PASSWORD_POLICY_INVALID`, `ADMIN_PASSWORD_MISMATCH`로 구분하면서 외부 API는 기존 `RESOURCE_ADMIN_AUTH_FAILED` 계약을 유지한다.
- 비밀번호, session token, Cookie/Authorization 및 예외 원문이 로그에 노출되지 않도록 회귀 테스트를 추가하고 `requestId` 기반 추적 절차를 문서화한다.

### Changed

- 하위 호환 운영 진단/보안 수정이므로 Semantic Versioning 정책에 따라 `0.14.0`에서 `0.14.1`로 증가한다.

## [0.14.0] - 2026-09-17

### Added

- Issue #56: 작업별 개별 리소스에 계획 투입 시작일·종료일·투입률을 저장하고 프로젝트 근무일 기준 M/D를 계산한다.
- 프로젝트 화면에 `그룹 → 리소스 → 작업` 계층의 리소스 공수 조회를 추가하고 M/D와 설정된 기준의 M/M 전환, 미설정 공수 및 과투입 표시를 제공한다.
- `GET /api/projects/{publicId}/resource-workload` 집계 API와 SQLite `0005_resource_workload.sql` migration을 추가한다.

### Changed

- `RESOURCE_MD_PER_MM`이 유효한 양수일 때만 M/M 환산을 제공하고, 미설정 시 임의 기준을 사용하지 않는다.
- 하위 호환 사용자 workflow와 API/DB 계약 추가이므로 Semantic Versioning 정책에 따라 `0.13.0`에서 `0.14.0`으로 증가한다.

### Fixed

- 공수 조회 영역이 기존 프로젝트 작업면의 Gantt 폭·스크롤 계약을 변경하지 않도록 portal로 격리하고, E2E 레이아웃 검증 경계를 실제 `.project-schedule`로 맞춘다.


## [0.13.0] - 2026-09-16

### Added

- Issue #28: 프로젝트의 Grid와 Gantt Chart를 계층/WBS, 시작·종료일, 근무일 기간, 진행률과 함께 Excel(.xlsx)로 내보내는 기능을 추가한다.
- 내보내기 실행 때마다 작업 관계 포함/제외/취소를 명시적으로 선택하며, 관계 포함 시 Dependencies 시트와 Gantt 관계 화살표를 생성한다.
- canonical snapshot과 strong If-Match를 사용해 동일 revision의 읽기 전용 데이터를 내보내고, 외부 Excel 서비스나 SVAR PRO export 기능에 프로젝트 데이터를 전송하지 않는다.

### Changed

- 사용자 기능 추가에 따라 Semantic Versioning 정책으로 애플리케이션 버전을 0.12.0에서 0.13.0으로 증가한다.


## [0.12.0] - 2026-09-16

### Added

- Issue #19: 프로젝트에 종속되지 않는 글로벌 리소스와 리소스 그룹을 관리하고, Task/Summary/Milestone에 개별 리소스 또는 그룹을 직접 할당·해제할 수 있다.
- 별도 `resource_catalog_admin` 세션, catalog revision, Project revision 기반 동시성 검증과 SQLite `0003_resource_catalog.sql` migration을 추가한다.
- `/resources` 관리 화면과 Task Editor의 리소스/그룹 다중 할당 UI를 추가한다. SVAR PRO Resource API는 사용하지 않는다.

### Changed

- Assignment PUT 성공 응답을 `project`, `tasks`, `links`, `assignments` 전체 canonical aggregate와 strong Project ETag를 반환하는 계약으로 확정한다.
- 사용자 workflow와 API/DB 계약을 하위 호환으로 확장하므로 Semantic Versioning 정책에 따라 `0.11.1`에서 `0.12.0`으로 증가한다.

## [0.11.1] - 2026-09-15

### Changed

- Issue #51: Gantt `주` 표시의 하위 Chart Header를 날짜 범위에서 ISO 8601 Week(`W01`~`W53`)로 변경했다.
- ISO week 계산을 독립 helper로 분리하고 월 경계 및 `W52/W53 → W01` 연말·연초 경계를 단위 테스트로 검증한다.
- Chromium E2E에서 ISO week Header 표시, 날짜 범위 제거, `일 ↔ 주` 반복 전환 시 Gantt/API 인스턴스 유지와 일 모드 주말 강조 회귀를 검증한다.

## [0.11.0] - 2026-09-15

### Added

- Issue #36: Task Editor의 진행률 입력을 0~100%, 1% 단위 Slider로 변경하고 현재 값을 명시적으로 표시한다.
- Task에 여러 줄 Description과 `http://`/`https://` URL을 저장할 수 있으며, 위험한 URL scheme은 클라이언트와 서버에서 거부한다.
- URL이 저장된 Grid 행/Chart 작업은 일반 클릭으로 새 탭에서 링크를 열며 drag/resize/우클릭 동작과 분리한다.
- SQLite migration `0002_task_description_url.sql`을 추가하고 canonical snapshot, 프로젝트 복사, subtree 삭제 응답까지 신규 필드를 보존한다.

### Fixed

- 기존에 저장된 소수 진행률은 다른 필드만 편집할 때 저장을 막지 않도록 호환성을 유지하고, 사용자가 Slider로 변경하는 값부터 1% 정수 단위를 적용한다.
- 프로젝트 복사 시 Description/URL을 원본 복사 transaction 안에서 함께 저장하여 all-or-nothing 계약을 유지한다.

## [0.10.0] - 2026-09-15

### Added

- Issue #34: Task Editor에 현재 작업의 선행/후행 관계를 조회 전용으로 표시한다. 상대 작업명과 externalId, 관계 유형, lag를 함께 보여주며 Editor 기준 revision과 동일한 canonical snapshot만 채택해 stale 관계 혼합을 차단한다. 사용자 기능 추가에 따라 버전을 `0.10.0`으로 갱신한다.


## [0.9.0] - 2026-09-15

### Added

- Issue #35: Gantt Chart 상단에서 기본 일 단위와 주 단위를 즉시 전환할 수 있다. 전환은 동일 SVAR Gantt 인스턴스를 유지하며 일 보기에서만 기존 주말 강조를 표시한다. 사용자 기능 추가에 따라 버전을 `0.9.0`으로 갱신한다.

## [0.8.3] - 2026-09-15

### Fixed

- Issue #37: 프로젝트 직접 진입뿐 아니라 브라우저 history/BFCache 복원에서도 서버의 현재 편집 세션을 다시 확인한다. 재검증 중 작업공간을 inert 처리하고, 만료·잘못된 응답·조회 실패는 fail-closed로 읽기 전용 재진입시켜 stale edit UI를 폐기한다. 정상 edit 재검증은 기존 Gantt 인스턴스를 유지한다.

## [0.8.2] - 2026-09-15

### Fixed

- Issue #40: Task Editor E2E의 스크롤 불변성 검증이 레이아웃 시점마다 달라질 수 있는 전체 scrollable DOM 목록을 비교하지 않도록 변경했다. `window`, 프로젝트 작업공간, SVAR Grid, Chart의 명시적 컨테이너 위치만 비교하고 실제 스크롤에 따른 메뉴 닫힘 검증은 전용 `task-context-menu-scroll.spec.ts`에 유지하여 동일 head 재실행에서도 안정적으로 회귀를 검출한다.

## [0.8.1] - 2026-09-15

### Fixed

- Issue #33: 운영 상단 주요 메뉴에서 `Gantt 데모` 링크를 제거한다. `/gantt-demo` route와 fixture는 SVAR 통합·timezone/hydration E2E 검증 자산으로 유지하고, 헤더 회귀 테스트는 프로젝트 메뉴와 알림 hit-area 및 데모 링크 미노출을 검증한다.
- 저장이 거부된 drag/resize의 canonical 조회가 성공하면 동일 Gantt 인스턴스에 서버 snapshot을 동기화하고, 조회 실패 시에만 강제 reset하여 검증되지 않은 로컬 변경을 폐기한다. 관련 비동기 E2E는 실제 스크롤 상태와 canonical 일정 복구를 기다려 검증한다.


## [0.8.0] - 2026-09-15

### Added

- Issue #27: 기존 프로젝트의 저장 일정·계층·의존관계·휴일을 독립 프로젝트로 원자 복사하고 새 ID·편집 비밀번호를 발급한다. 목록과 상세 작업공간에서 복사 대화상자에 진입할 수 있으며 선택적으로 진척률을 초기화한다.
- Issue #8: production 내부망 HTTP opt-in, 외부 URL 기반 쿠키 정책, Nginx HTTP 예제 및 production HTTP/HTTPS 브라우저·영속성 CI.
- Issue #31: Grid·Chart 작업 우클릭 메뉴에 보호된 작업 삭제를 추가하고, 자손이 있으면 범위를 확인한 뒤 서버가 저장 계층을 재계산하여 하나의 transaction으로 subtree를 삭제한다. 사용자 기능/API 확장에 따라 버전을 `0.7.0`으로 갱신한다.
- PR #23 후속: 작은 화면의 알림 아이콘·상단 navigation 겹침과 인증 오류 진단 코드 누락을 보완하고 관련 UX 계약·회귀 검증을 정리한다. 원격 결과는 후속 PR에 기록한다.
- 공간을 차지하지 않는 5초 Toast와 최대 50건 오류 알림함·미확인 표시·안전한 내용 복사 (#18).
- 목록과 상세 화면의 공용 프로젝트 링크 복사 및 clipboard 거부/미지원 시 수동 복사 (#21). APP_BASE_URL/publicId 기반 직접 접근과 기존 권한을 유지한다.
- Grid 행/Chart 막대 우클릭 및 키보드로 여는 작업 정보 편집기 (#4). 명시적 PATCH 저장, 근무일 기간, 권한/요약 작업 읽기 전용, 실패 시 초안 보존과 Revision 충돌 재검토를 제공한다. 사용법과 검증 범위는 [Task Editor](docs/TASK_EDITOR.md)를 참조한다.

### Fixed

- 모달 top layer 안에서 안내를 확인할 수 있도록 dialog 내 live region을 제공하고, 전역 status 선택자로 발생하던 W05 E2E strict mode 오류를 수정했다. 관련 [UX 계약·CI 실패 분석·보충 테스트 계획](docs/PROJECT_UX.md)을 참조한다.
- 작업 저장 중 Gantt 재마운트를 제거하고 서버 확정 snapshot을 같은 인스턴스에 반영하도록 개선 (#3). 기존 화면 상태 보존 및 중복 mutation 차단 회귀 검증은 해당 PR 결과로 추적.

### Repository layout

- Vitest/Playwright 설정을 `tests/config/`로 이동하고 명시적 config 선택과 root/외부 cwd 테스트 발견 검증을 추가했다 (#13).
- 배포 파일을 `deploy/`로 이동하고 Compose 프로젝트명 명시, CI/Dependabot 참조와 격리 Compose 재생성·영속성 검증을 추가했다 (#12).

### Changed

- annotated `v*` tag ref를 지정한 수동 실행에서도 기존 Semantic Release 검증과 GHCR digest smoke를 동일하게 수행할 수 있도록 release workflow 실행 경로를 보완했다.
- 프로젝트명 하단의 Revision/시간대/휴일/작업/연결·펼침 설정을 제거하고 설정 기능을 헤더 버튼의 별도 창으로 이동했다 (#9).
- 목록의 삭제 버튼을 항상 표시하되 기존 세션과 무관하게 새로 입력한 비밀번호 확인 후 보호 DELETE/If-Match를 호출한다 (#10).
- Grid 행 +의 첫 하위 추가 시 확인 팝업 없이 기존 명시적 요약 전환 옵션을 전송한다 (#11). 마일스톤/계층·집계 검증은 유지한다.
- Grid Header 우클릭 표시 열 선택으로 전환하고 외부 ID를 기본 숨김 처리. 별도 외부 ID 표시/숨기기 버튼 제거.
- Grid/Chart 상단의 ‘작업 추가 또는 삭제’ 패널과 전용 UI 상태 제거. Native Grid `+`와 서버 Task 삭제 API는 유지.
- 새 작업 생성 시 이름·시작일·기간 입력을 제거하고 `새 작업`·오늘·1일 자동 적용(Milestone은 0일 유지). 과거 Summary 전환 확인은 #11로 대체한다.
- 과거 로컬 검증 보류 기록은 `docs/PENDING_TESTS.md`에 보존한다. 이번 다섯 이슈는 사용자 승인에 따라 GitHub Actions로 검증하며, 최종 head의 실제 결과는 PR #23에서 추적한다.

## [0.6.0] - 2026-09-12

### Added

- 편집 권한을 확인하는 Project 삭제와 전체 목록의 표 형태 UI
- SVAR Grid Header/행 `+` 기반 최상위·하위 작업 추가와 명시적 상위 Summary 전환
- 하위 일정 변경에 따른 조상 Summary 일정·진척 집계
- 외부 ID 표시 선택, 오늘/1일 기본값, 주말 음영, 사용자 locale 날짜 표시

### Changed

- 프로젝트 설정을 접고 프로젝트·Grid·Chart Header를 유지하는 내부 세로 스크롤 작업공간

## [0.5.0] - 2026-09-12

### Added

- D02 승인에 따른 전체 Project 목록 API와 홈 목록 화면; 생성 후 복귀·새로고침 시 저장 목록 표시
- 목록은 공개 summary만 반환하고 기존 프로젝트별 편집 인증 유지

### Changed

- 현재 비공개 플랜에서 main/tag 보호 규칙 미강제 위험을 수용하고 GHCR 자동화를 진행하도록 D05 확정
- 최초 원격 push에서 확인한 PAT `workflow` scope 누락을 배포 선행 조건으로 문서화
- PAT 권한 보완 후 실제 main/`v0.4.0` Actions·private GHCR 게시·digest 실행 검증 완료 기록 추가

## [0.4.0] - 2026-09-12

### Added

- main commit마다 검증을 통과한 GHCR `ci-<full SHA>` 테스트 이미지 게시와 registry digest 재다운로드 검증
- 게시 이미지의 Project/Task HTTP 저장·권한·재시작 persistence 검증

### Changed

- Commit 테스트 이미지와 Semantic Version release 이미지의 태그 공간 분리
- BuildKit SBOM/provenance를 유지하고 GitHub 서명 attestation은 지원 플랜에서 명시적으로 활성화

## [0.3.1] - 2026-09-12

### Changed

- D04 운영 결정을 GHCR private, 최소 `packages: read`, 필수 CI, 보호된 `v*` tag와 지정 release 권한으로 확정
- Pull Request는 유지하되 필수 승인 review 수를 0으로 설정
- 과거 노출 credential의 재사용을 사용자 수용 잔여 위험으로 기록하고 원격 차단 사유를 인증 미구성으로 변경

## [0.3.0] - 2026-09-12

### Added

- Project 화면의 좌측 계층 Task Grid와 우측 동기 Gantt Chart 작업공간
- 빈 일정, 생성 직후 양쪽 표시, Desktop geometry와 narrow 내부 scroll Browser 회귀 검증

### Changed

- Project route가 viewport 폭·높이를 사용하고 Project 설정과 Task 관리를 접이식으로 표시

### Fixed

- 빈 Project에서 Gantt가 렌더링되지 않던 문제와 좁은 화면에서 Gantt min-content가 document 전체를 확장하던 문제

## [0.2.0] - 2026-09-12

### Added

- Project별 root Task/Milestone 생성·수정·삭제와 실제 SVAR pointer persistence
- GitHub Actions application/E2E/container CI
- Semantic version tag 기반 GHCR image publish, SBOM/provenance와 registry digest smoke
- SQLite migration/readiness 및 non-root persistent container 기반

### Security

- Project edit session, optimistic concurrency와 transaction 내부 authorization 재검증
- Workflow 최소 권한, immutable Action SHA와 base image digest 정책

## [0.1.0] - 2026-09-11

### Added

- Next.js, SQLite migration/repository, SVAR Core와 Project 생성·직접 Readonly 기반
- Project edit password/session lifecycle
- Working Calendar와 Leaf/Milestone Scheduling Engine 기반
