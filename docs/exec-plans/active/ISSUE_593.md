# Issue #593 Work Packet — Trusted QA 실행 출처/metadata 증거 강화
- Repository: planner77/masterGantt / [Issue #593](https://github.com/planner77/masterGantt/issues/593)
- Lifecycle: QA_FINAL / MERGE_READY
- Baseline: main `36b0eaa74a0614a76d1ed867bddb548149feb4bc`
- Branch: `ci/issue-593-trusted-qa-evidence`
- Risk: HIGH / protected CI workflow, QA policy and evidence validation; `qa_required=true`, `qa_method=AGENT`
- Reviewer: 구현자와 별도인 `qa_docs` 또는 승인된 인간 Reviewer, 최신 PR Head 독립 검토 필요
- Manager decision: ACCEPT
- Implementation owner: infra; docs owner: Manager; QA owner: independent reviewer (PASS)
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

## PR CI #2379.1 실패 및 보완
- Run `38038368267`, Head `49475dbef3ddbe61edddfed24ae5af4a621d03f2`: 필수 Quality/E2E/Docker 모두 성공, protected diff로 자동 QA BLOCKED.
- Trusted base validator 기반 PR/head/base/보호 파일 검증과 AGENT N/A routing 추가. 자동 QA SKIPPED를 PASS로 취급하지 않고 독립 QA + Manager 승인 필수. 다음 원격 CI는 새 Head에서 실행.

## PR #594 리뷰 P2 보완 (2026-10-10)
- Codex 리뷰 2건: Fork PR의 `head_repository`를 무조건 base와 동일하게 제한한 문제와 BLOCKED 보고서의 오래된 `rule_version=580-v1` 수정.
- 실제 GitHub PR live `head.repo.full_name` 및 `base.repo.full_name`과 artifact 각각 대조하고 HEAD/branch/base/test-merge/run-attempt, 단일 commit→PR 교차 증거는 유지한다. Fork 및 잘못된 repository 반례 테스트를 추가한다.
- `main()` 초기 보고서 버전도 `593-v1`로 수정하여 PASS/FAIL/BLOCKED 원장 동기화. 새 Head CI와 독립 QA는 아직 NOT TESTED, 이전 Head PASS 재사용 금지.

## PR CI #2403.1 실패 원인·복구 (2026-10-10)

- [Run #2403.1](https://github.com/planner77/masterGantt/actions/runs/38049021611), Head `a22248562cd52be1dbcc1d581063bce96b86440c`: Chromium E2E 6/6, Docker, TypeScript/Unit/Build/Lint PASS. Quality aggregate만 Policy Python 32개 중 `test_metadata_full_ci_requires_matching_base`가 `KeyError: 'run_attempt'`를 발생시켜 FAIL(31 PASS, 1 ERROR).
- `verify_same_base_full_run`는 source artifact/API 조회 **전에** 원본 `run_attempt`가 정확한 정수 1~10인지 검사하며, 누락/None/0/음수/초과/문자열/불리언은 `Blocked(BLOCKED, reason)`로 차단한다. 테스트는 누락·비정상 입력에서 `source_artifact` 호출 자체가 없어야 함을 검증한다.
- #595의 독립 QA 승인 영수증 및 `effective_run_jobs` latest-attempt aggregation, #593의 Head/base/test-merge/PR attribution, 세 Required Check는 축소하지 않는다. 이전 CI 성공을 새 Head 승인으로 전용하지 않는다. 본 수정 이후 CI/QA/Manager ACCEPT는 새 Head에 대해 재판정한다.
