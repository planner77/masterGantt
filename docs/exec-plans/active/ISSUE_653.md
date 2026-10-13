# Issue #653 — 인증 GHCR 승계 감사

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(이번 변경은 해당 계약을 수정하지 않음)
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(이번 변경은 해당 계약을 수정하지 않음)
- `docs/API.md`: N/A(이번 변경은 해당 계약을 수정하지 않음)
- `docs/DB_SCHEMA.md`: N/A(이번 변경은 해당 계약을 수정하지 않음)

## AC_TEST_COVERAGE
- AC1: tests/python/test_release_succession_audit.py — main SHA/first-parent; 실제 main 조회 NOT TESTED.
- AC2: tests/python/test_release_succession_audit.py — Git tag peel/Release/GHCR 페이지 및 OCI metadata; 실제 GHCR NOT TESTED.
- AC3: tests/python/test_release_succession_audit.py — Owner marker 및 누락 시 BLOCKED; 실증 NOT TESTED.
- AC4: tests/python/test_release_succession_preflight.py — strict 정책; provenance 전부 검증 전 BLOCKED.
- AC5: PR #654 Required 3종/Trusted QA 및 Owner 판단 필요, 병합·게시 금지.

## 제한 사항
현재 독립 퇴역·release lifecycle·신규 준비 Owner 원장의 운영 수집은 미완성이므로 PREPARE_ONLY를 주장할 수 없다. #616 역사적 실패와 #633의 정식 발행 사실은 보존한다.
