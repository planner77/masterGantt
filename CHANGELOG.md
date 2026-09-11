# Changelog

이 프로젝트의 주요 변경은 Semantic Versioning과 [CI/CD 정책](docs/CI_CD.md)에 따라 기록한다.

## [Unreleased]

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
