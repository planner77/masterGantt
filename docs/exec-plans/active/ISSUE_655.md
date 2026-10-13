# Issue #655 — 릴리스 승계 read-only 감사 수집 및 인증

## Scope
- Issue #655 / 상위 #616 / 이전 #653의 실패 Run #15.1 matching-refs tags/v 153개 응답을 전체 수집한다.
- #550/#615 철회 및 bot retirement, #633 B2 Owner 원장과 원본 CI/OCI digest를 독립 조회한다.
- #616 v0.107.0 Owner 철회 및 v0.108.0 신규 후보 준비 marker 없으면 항상 BLOCKED. 게시 승인과 준비 승인은 서로 다름.

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 HIGH / OWNER_MANAGED, Trusted QA 및 Owner 승인 Gate 불변; 검증기 계약 완화 없음)
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_655.md`: ADDED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(UI/UX 계약 변경 없음)
- `docs/API.md`: N/A(제품 API 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB 변경 없음)

## AC_TEST_COVERAGE
- AC1: tests/python/test_release_succession_audit.py, 153개 단일 응답/중복·비정상 ref/peel. 운영 재실행은 미실시.
- AC2: pages()는 Release/GHCR/jobs/comments 유지, 인증 API 오류 및 GHCR digest 차단. 운영 GHCR 검사 결과 미확인.
- AC3: main() JSON + GITHUB_STEP_SUMMARY stage/reason/run/attempt/SHA; read-only 실패 exit 1. 운영 실증 미실시.
- AC4: #550/#615 Owner marker, B2 #633 원장, bot retirement 및 정확한 source SHA/digest; #559/#627/#628/#626/#632의 GitHub API 실조회 merged/main/PR 번호/merge SHA/Refs Issue 및 first-parent 매핑 독립 확인. tests/python/test_release_succession_audit.py의 정상/변조/미인증 사례 검증. #616 신규 인증 없는 PREPARE_ONLY 금지.
- AC5: PR 세 Required Quality/Chromium 6 shards/Docker 및 Trusted QA·리뷰 확인 후 별도 Owner 병합 승인. 원격 결과 NOT TESTED.
- AC6: 병합 이후 Owner가 직접 default-main workflow_dispatch를 실행해야 하며, 릴리스/퇴역/이슈 종료 자동 실행은 금지.

## Risk / release
risk_level: HIGH
qa_method: OWNER_MANAGED
qa_required: true
manager_decision: NOT TESTED
release_required: false
release_authorized: false

## Verification
`python3 -m unittest tests.python.test_release_succession_audit tests.python.test_release_succession_preflight`
추가 검증: `python3 -m compileall -q scripts/release_succession_audit.py tests/python/test_release_succession_audit.py`.

## CI #2673 리뷰 후속 보완 (2026-10-13)
- Required Build/Quality, Chromium E2E, Docker 및 QA Preflight 모두 PASS. QA Final은 미해결 P1 review 2건으로 BLOCKED (기존 실패 결과 불변).
- P1-A: RETIRED bot 댓글의 자기선언 배열뿐 아니라 역사적 PR 다섯 건의 merged/main/정확한 SHA/primary Issue를 GitHub REST로 직접 재조회. 누락·중복·403/404·불일치 전부 BLOCKED.
- P1-B: 최신 Owner release-authorization note 필수 필드와 unit test fixtures 정합. 의도적으로 note가 비어 있는 음성 테스트는 차단 유지.
- reviewer thread 해결 및 새 exact-Head Required PR CI/Trusted QA 완료 전 Owner ACCEPT 및 병합 금지.
