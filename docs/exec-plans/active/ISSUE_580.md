# Issue #580 Work Packet

- baseline_main: f1ac9fef186a635d08b51c878376925567653736
- branch: feat/issue-580-automated-qa-final
- risk_level: HIGH
- qa_method: AGENT (bootstrap trusted-validator 없음)
- release_required: false; release_authorized: false
- independent_qa: NOT TESTED; manager_decision: NOT TESTED
- current phase: IMPLEMENTING / DOCUMENTATION_SYNC; requested stop: PR CI START

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `docs/AGENT_PROMPTS.md`: UPDATED
- `docs/AGENT_CONFIGURATION.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/ISSUE_LIFECYCLE_AUTOMATION.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/DECISIONS.md`: UPDATED
- `DESIGN.md`: N/A(제품 UI/기능 설계 자체를 변경하지 않는 GitHub QA 운영 자동화)
- `docs/DB_SCHEMA.md`: N/A(데이터 모델과 migration 변경 없음)

## AC_TEST_COVERAGE
- AC1: scripts/test_qa_final_automated.py 구조 회귀 + PR CI/Manager 수동 인수 확인 (QA 의미 검토 필요)
- AC2: scripts/test_qa_final_automated.py 구조 회귀 + PR CI/Manager 수동 인수 확인 (QA 의미 검토 필요)
- AC3: scripts/test_qa_final_automated.py 구조 회귀 + PR CI/Manager 수동 인수 확인 (QA 의미 검토 필요)
- AC4: scripts/test_qa_final_automated.py 구조 회귀 + PR CI/Manager 수동 인수 확인 (QA 의미 검토 필요)
- AC5: scripts/test_qa_final_automated.py 구조 회귀 + PR CI/Manager 수동 인수 확인 (QA 의미 검토 필요)
- AC6: scripts/test_qa_final_automated.py 구조 회귀 + PR CI/Manager 수동 인수 확인 (QA 의미 검토 필요)
- AC7: scripts/test_qa_final_automated.py 구조 회귀 + PR CI/Manager 수동 인수 확인 (QA 의미 검토 필요)
- AC8: scripts/test_qa_final_automated.py 구조 회귀 + PR CI/Manager 수동 인수 확인 (QA 의미 검토 필요)
- AC9: scripts/test_qa_final_automated.py 구조 회귀 + PR CI/Manager 수동 인수 확인 (QA 의미 검토 필요)

## HIGH_REVIEW
- 권한: read-only job scoped token, 외부 PR 코드 실행 금지
- bootstrap: #2334.1에서 최초 도입 QA 검증기 부재로 QA Final FAIL 확인; 보완 후 qa_bootstrap에서 NOT TESTED 명시, QA Final SKIPPED, 독립 reviewer는 여전히 필수
- 후속: HIGH 강화 수동 검토 및 Manager ACCEPT 전 MERGE_READY 불가

## 2026-10-10 QA_FINAL Bootstrap REWORK

- 원격 증거: run 37998967929 / PR #587 / head 965c8e1865525e56545611b228cc828332b02a31
- 최초 PR CI: Quality/E2E/Docker required aggregate PASS; 새 QA Final 최초 검증기 부재로 FAIL
- 원인: 신뢰된 base validator가 아직 없어 의도적 차단을 Job 실패로 모델링한 bootstrap lifecycle 설계 충돌
- 수정: base SHA 신뢰 확인 전용 qa_bootstrap Job, validator가 없으면 자동 QA SKIPPED 및 NOT TESTED 요약; 이후 base에 validator 존재하면 QA Final 본검사
- DOC_SYNC: .github/workflows/ci.yml, scripts/test_qa_final_automated.py, QA_REVIEW_POLICY/CI_CD/GITHUB_OPERATIONS/REMOTE_VALIDATION/TEST_PLAN, 본 Work Packet 갱신
- 기대: 신규 PR CI 시작, existing 3 required checks 보존, 독립 QA 및 Manager 승인 전 병합 금지. Ruleset 변경 미진행
- `DESIGN.md`: N/A(제품 기능/UI 무변경); `docs/DB_SCHEMA.md`: N/A(DB/API 변경 없음)
