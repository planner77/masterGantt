# Issue #651 — 릴리스 승계 검증 보완

## DOCUMENTATION_SYNC
- UPDATED: AGENTS.md, docs/GENERIC_RELEASE_FINALIZER.md, docs/CI_CD.md, docs/TEST_PLAN.md, docs/REMOTE_VALIDATION.md, docs/exec-plans/active/PLAN.md, docs/exec-plans/active/ISSUE_616.md, docs/exec-plans/active/ISSUE_649.md, CHANGELOG.md.
- N/A: DESIGN.md (UI 변경 없음), docs/API.md (API 변경 없음), docs/DB_SCHEMA.md (DB 변경 없음).

## AC_TEST_COVERAGE
- AC1: tests/python/test_release_succession_preflight.py — 기존 v0.106.1 원본 SHA/digest 인정. 실제 registry 검증 NOT TESTED.
- AC2: tests/python/test_release_succession_preflight.py — 과거 미발행 버전, 신규 후보 충돌, Owner 철회 부재 차단.
- AC3: tests/python/test_release_succession_preflight.py — UNKNOWN/누락/위조 provenance 차단. 실제 authenticated GHCR 수집 경로는 미구현, NOT TESTED.
- AC4: 새 PR CI Quality/E2E6/Docker, Trusted QA, 리뷰 스레드 0은 원격 실증 전 NOT TESTED.
- AC5: release_required=false, release_authorized=false; 게시·퇴역·Issue #616 close 불가.

## 보안 경계
- 원본 #616 v0.107.0 승인 철회 및 v0.108.0 신규 준비는 인증 Owner의 별도 결정이 필요하다.
- 본 PR은 순수 함수 정책과 fixture만 갱신했으며 GitHub API·private GHCR의 신뢰된 수집기를 구현하지 않았다. 수집기 없이는 운영 PREPARE_ONLY 판정을 발행할 수 없다.
- #2644.1은 QA Preflight GitHub API 404로 차단되어 구현 테스트 미실행. 신규 Work Packet 추가 후 새 PR CI 재검증이 필요하다.
