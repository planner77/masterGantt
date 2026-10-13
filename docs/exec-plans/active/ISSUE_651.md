# Issue #651 — 릴리스 승계 검증 보완

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_616.md`: UPDATED
- `docs/exec-plans/active/ISSUE_649.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(이번 변경에서 해당 계약·UI·API·DB 동작은 변경하지 않음)
- `docs/GITHUB_OPERATIONS.md`: N/A(이번 변경에서 해당 계약·UI·API·DB 동작은 변경하지 않음)
- `DESIGN.md`: N/A(이번 변경에서 해당 계약·UI·API·DB 동작은 변경하지 않음)
- `docs/API.md`: N/A(이번 변경에서 해당 계약·UI·API·DB 동작은 변경하지 않음)
- `docs/DB_SCHEMA.md`: N/A(이번 변경에서 해당 계약·UI·API·DB 동작은 변경하지 않음)

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
