# Issue #657 — 감사 #16 Refs 인식 오류 및 필수 Python CI

## 배경과 원본 증거
- [Audit #16.1](https://github.com/planner77/masterGantt/actions/runs/38388876066): main `65c66b711f6ba1bd18caa53bd56042b54b391d80`, `historical PR identity`에서 `historical PR #559 Issue #550 귀속 불일치` (원본 실패 이력 보존).
- GitHub PR #559 본문 `Refs #550`, `merged=true`, base=main, merge `40747252c389f2a4d1203a2262a4caa49c90728d` 정상. collector의 raw regex가 `\\s`를 문자 그대로 요구한 것이 실제 원인.
- #655 Main CI #2678.1 SUCCESS와 Finalizer #216.1은 원본에 수정이 필요한 사실과 별개다. #616은 Open, Owner v0.107.0 게시 승인/원본 복구 CI FAIL/승계 준비 미승인 유지.

## 변경 및 경계
- `scripts/release_succession_audit.py`: GitHub PR body의 정확히 한 줄인 `Refs #N`을 검사. CRLF, 행 가장자리 공간·탭을 허용. 중복·다른 Issue·인라인·기형 필드는 여전히 BLOCKED; PR ID/merged/main/repo/exact SHA/first-parent 비교 불변.
- `tests/python/test_release_succession_audit.py`: #559 및 #627/#628/#626/#632를 닮은 실제 여러 줄 본문과 CRLF fixture, 중복/다른 Issue/인라인/변조/404/API 실패 negative tests. `test_release_succession_preflight.py` 전체 기존 테스트 유지.
- `.github/workflows/ci.yml`: `policy` Job에 `python3 -m unittest discover -s tests/python -p 'test_release_succession_*.py' -v` 필수 단계. PR/Main 소스 SHA별 실행이며 정책 Job 실패시 Required Quality 실패; 기존 E2E6/Docker/Trusted 보존.
- default-main 읽기 전용 승계 감사 workflow는 기존 `workflow_dispatch`만 허용하며 신규 버전/tag/GHCR 릴리스·Owner marker·Issue/PR mutation 없음.

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(OWNER_MANAGED/HIGH/Trusted QA 기준과 승인 검증기 자체의 계약 불변)
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_657.md`: ADDED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(사용자 UI 및 디자인 가이드 변경 없음)
- `docs/API.md`: N/A(제품 REST API 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite 및 마이그레이션 변경 없음)

## AC_TEST_COVERAGE
- AC1: `tests/python/test_release_succession_audit.py::test_exact_historical_pr_source_ledger`에서 5개 실형식 다중줄/CRLF/standalone Ref 정상; `test_historical_refs_fail_closed_on_ambiguous_and_inline_text`에서 중복·잘못된 Refs 차단. PR/SHA/repo 음성 검증 유지.
- AC2: `python3 -m unittest discover -s tests/python -p 'test_release_succession_*.py' -v`로 감사 및 preflight 기존 테스트 전부 실행; PASS는 실행 전 NOT TESTED.
- AC3: `.github/workflows/ci.yml`의 `policy` Job 신규 Python3 필수 단계 및 Quality aggregate 연쇄 FAIL 계약; 실제 PR CI job 로그 확인 전 NOT TESTED.
- AC4: release/registry/tag/Issue/comment WRITE 불가, 원본 #616 복구 FAIL·#633 v0.106.1 digest 불변; 검사 범위 변경 없음.
- AC5: 최신 main Full PR CI 3 Required Quality/E2E6/Docker + default-main Trusted QA·미해결 리뷰0·별도 Owner 병합 승인; 미실행 시 NOT TESTED.
- AC6: 병합 + Main CI 성공 후 Owner가 별도 `workflow_dispatch` 감사 재실행 (현 단계 실행 금지). BLOCKED / PREPARE_ONLY는 실제 증거로만 판정.

## 정책
risk_level: HIGH
qa_method: OWNER_MANAGED
qa_required: true
manager_decision: NOT TESTED
release_required: false
release_authorized: false
