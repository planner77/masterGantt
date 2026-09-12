# Changelog

이 프로젝트의 주요 변경은 Semantic Versioning과 [CI/CD 정책](docs/CI_CD.md)에 따라 기록한다.

## [Unreleased]

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
