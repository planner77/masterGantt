# Changelog

이 프로젝트의 주요 변경은 Semantic Versioning과 [CI/CD 정책](docs/CI_CD.md)에 따라 기록한다.

## [Unreleased]

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