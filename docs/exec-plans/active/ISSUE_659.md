# Issue #659 — PR CI E2E Fail-Fast + Fast Gate 단계별 고비용 검사 차단

## Lifecycle / Source
- Issue: https://github.com/planner77/masterGantt/issues/659
- Phase: ANALYSIS → PLAN → BRANCH → IMPLEMENT/TEST → DOCUMENTATION_SYNC → PR CI (진행)
- Baseline main SHA: `65c66b711f6ba1bd18caa53bd56042b54b391d80`
- Implementation branch: `ci/issue-659-pr-fast-gate`
- App version: `0.107.0` 유지 (CI-only; version bump/lockfile 수정 없음)
- Implementation owner: infra. Manager는 위험·버전·병합/릴리스 판단. QA method: OWNER_MANAGED.

## Scope / Non-scope
- A: `pr_e2e_shard.strategy.fail-fast=true` (PR full). `e2e_shard`는 Main/manual에서 `false`.
- B: PR full의 기존 Preflight 이후 policy/typecheck/lint/unit을 병렬 실행한 뒤 `pr_fast_gate`가 PASS일 때에만 `pr_build/pr_e2e_shard/pr_docker_smoke` 시작.
- Main/manual은 기존 `build/e2e_shard/docker_smoke`의 병렬성, 6-shard/workers=1, step/timeout, metadata-only full CI 증거 재사용 보존. PR/Main 중복 step은 GitHub YAML anchor/alias로 공유.
- `quality/e2e/docker` 세 Required check와 QA Final/Trusted/Owner, main GHCR candidate/Finalizer/Release guard 변경 금지.
- Non-scope: 앱 UI/API/DB/scheduling 수정, GitHub Ruleset 편집, formal tag/GHCR release 게시, 고의 실패를 main에 병합, #629 QA Preflight 재구현.

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 HIGH/OWNER_MANAGED, Trusted QA, Owner 신뢰 경계 불변)
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_659.md`: ADDED
- `docs/DECISIONS.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 lifecycle·QA·권한 불변)
- `DESIGN.md`: N/A(UI/UX 변경 없음)
- `docs/API.md`: N/A(애플리케이션 API 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB schema/마이그레이션 변경 없음)
- `docs/DEPLOYMENT.md`: N/A(제품 배포 경로·Compose/Dockerfile 변경 없음)

## AC_TEST_COVERAGE
- AC1: GitHub PR E2E matrix `fail-fast=true`, Unit 구조 검증(`scripts/test_pr_fast_gate.py`). 단일 실패 Shard에 의한 실제 5개 취소 및 Playwright 실패 보고서는 별도 원격 실패 주입 전 NOT TESTED.
- AC2: `scripts/test_pr_fast_gate.py::WorkflowContract.test_main_and_manual_jobs_not_gated`; Main/manual 실제 Run 실행 전 NOT TESTED.
- AC3: `scripts/test_pr_fast_gate.py::FastGateDecision` 실패/취소/skip/unknown fixture; 실제 PR 실패 주입/3 Required FAIL은 별도 원격 검증 전 NOT TESTED.
- AC4: 동일 PR Head의 실제 Quality/E2E 6-shard/Docker 정상 실행과 required aggregate PASS로 검증. CI 완료 전 NOT TESTED.
- AC5: `scripts/test_pr_fast_gate.py`, 기존 `scripts/test_qa_preflight.py`, PR metadata-only·docs-only·fork·stale Head 계약. 실제 edited 이벤트 재현 전 NOT TESTED.
- AC6: Workflow Main/manual Job의 `needs` 정적 검사, 원격 Main/복구 및 GHCR/Finalizer는 병합 전 NOT TESTED.
- AC7: `scripts/test_pr_fast_gate.py::WorkflowContract.test_required_aggregates_are_fail_closed`, Preflight aggregate 테스트, 원격 Required check 결과. 완전한 원격 실패 Run 전 NOT TESTED.
- AC8: GitHub Actions jobs의 wall-clock/runner-minutes/early-stop 시각을 정확한 event/Head/workload 기준으로 비교; 기준 실측 전 NOT TESTED.
- AC9: 상기 DOCUMENTATION_SYNC 갱신 파일 및 변경 영향 N/A 근거.

## Risk / release
risk_level: HIGH
risk_reason: GitHub CI 보호 경로와 Required Check 라우팅 변경. PR 스스로 최종 승인하지 않음.
qa_method: OWNER_MANAGED
qa_required: true
manager_decision: NOT TESTED
release_required: false
release_authorized: false
independent_qa: N/A(Owner-managed, 별도 독립 QA 미실시)

## Verification commands / Evidence
- Local Fast Feedback: `python3 scripts/test_pr_fast_gate.py`, `python3 scripts/test_qa_preflight.py`, `python3 -m py_compile scripts/pr_fast_gate.py scripts/test_pr_fast_gate.py`, YAML 파싱·Required Check 이름 검증.
- GitHub Remote: Full PR `CI` exact Head (Quality, Chromium E2E six shards, Docker); latest head/base/run/attempt QA Final/Trusted 검사.
- 실패 주입, 정상/실패 Runner-minutes 실측과 Main 복구 경로 검증은 PR CI 시작만으로 PASS 아님.

## Next
- PR metadata: `[Issue #659] ...` 제목, 본문 단일 `Refs #659`, HIGH/OWNER_MANAGED/release flags, AC_TEST_COVERAGE와 DOCUMENTATION_SYNC를 명확히 기록한다.
- PR CI 시작 이후 결과·미해결 리뷰 검토. 병합·Main CI·GHCR·Finalizer·Issue 종료는 Owner 별도 지시 전 실행 금지.
