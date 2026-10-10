# Issue #593 Work Packet — Trusted QA 실행 출처/metadata 증거 강화
- Repository: planner77/masterGantt / [Issue #593](https://github.com/planner77/masterGantt/issues/593)
- Lifecycle: ANALYSIS → PLAN → IMPLEMENTING → DOCUMENTATION_SYNC → PR/CI (이번 사용자 승인 범위)
- Baseline: main `36b0eaa74a0614a76d1ed867bddb548149feb4bc`
- Branch: `ci/issue-593-trusted-qa-evidence`
- Risk: HIGH / protected CI workflow, QA policy and evidence validation; `qa_required=true`, `qa_method=AGENT`
- Reviewer: 구현자와 별도인 `qa_docs` 또는 승인된 인간 Reviewer, 최신 PR Head 독립 검토 필요
- Manager decision: NOT TESTED (PR CI 완료/독립 QA/최종 승인 전)
- Implementation owner: infra; docs owner: Manager; QA owner: independent reviewer (실행 가능 여부 미확인)
- release_required: false / release_authorized: false (제품/DB/버전 변경 없음; PR 및 Ruleset 수정/정식 릴리스 미승인)
- Scope: source CI event-provenance artifact (읽기 전용 검사), default-branch Trusted source association, metadata full-run provenance, deterministic regression tests, report and documentation
- Exclusions: existing 3 required check names, SHA/strict merge protections, permission write, GHCR final release, Ruleset edit, main merge
- Critical boundary: artifact는 PR에서 온 비신뢰 데이터이며 **절대 실행하지 않고** GitHub run/attempt/Head/base/merge/live PR 및 protected-path 검증과 교차 확인한다. 동일 SHA/branch를 공유하는 다중 PR은 차단한다.
- Current remote baseline: #396 metadata source run `pull_requests=[]`; #591 full CI failure. #580 main/Finalizer 완료 이력은 보존.
- Validation boundary: 이 PR은 workflow 및 validator 자체를 변경하는 HIGH/AGENT이므로 main의 자동 Trusted PASS 대상으로 분류하면 안 된다. 수정된 validator의 실제 T1 positive proof는 독립 검토·병합 이후 새 non-protected 검증용 PR에서 수행할 것. 이번 범위의 T1 실증은 아직 NOT TESTED이다.
- Issue comment writer: manager; infra allowed issue comment types: NONE.
- Stop: PR 생성과 GitHub Actions PR CI 시작. 병합/Ruleset/GHCR Release는 실행하지 않음.

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/DECISIONS.md`: UPDATED
- `docs/AGENT_PROMPTS.md`: UPDATED
- `DESIGN.md`: N/A(제품 화면·상태·UX를 변경하지 않는 CI/QA 보안 개선)
- `docs/API.md`: N/A(애플리케이션 API 계약 불변)
- `docs/DB_SCHEMA.md`: N/A(스키마 및 migration 불변)

## AC_TEST_COVERAGE
- AC1: T1 실제 non-protected PR Trusted PASS 및 validator SHA 검증 — 병합 후 실증 NOT TESTED, 절차 docs/REMOTE_VALIDATION.md
- AC2: scripts/test_qa_final_automated.py source association empty PR/다중 후보/누락/rename fail-closed
- AC3: scripts/test-pr-metadata-evidence.py 동일 PR/head/base/test-merge/attempt full run 증거 및 T2 원격 실증 절차
- AC4: scripts/test_qa_final_automated.py T3/T4/T5 결과 및 운영 로그/원장 구별, #396/#591 실측 대비
- AC5: scripts/test_qa_final_automated.py + scripts/test-pr-metadata-evidence.py; T1~T9 원격 실험은 순차 실증, 미실행 NOT TESTED
- AC6: .github/workflows/ci.yml 세 Required job 이름 유지·strict/Finalizer/GHCR 변경 없음, scripts/verify-issue-lifecycle.py 회귀
- AC7: scripts/test_qa_final_automated.py AGENT/보호 경계/Manager ACCEPT 및 docs/QA_REVIEW_POLICY.md 계약
- AC8: 모든 DOCUMENTATION_SYNC 항목과 docs/TEST_PLAN.md T1~T9 매핑 및 실제 Head 원격 증거
- AC9: PR CI 시작 후 정확한 Head quality/e2e/docker 성공, 독립 QA 및 Manager ACCEPT는 미수행 상태로 병합 금지
