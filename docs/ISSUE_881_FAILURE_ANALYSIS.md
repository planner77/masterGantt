# Issue #881 — 누적 실패 원장

- Primary: https://github.com/planner77/masterGantt/issues/881
- Baseline: main `229604522969133d1ccc6de0477e373252670c86` (0.142.0)
- 2026-11-07 초기 단계에는 실제 PR CI 실패가 존재하지 않음. 원격 Run/Attempt/직접 실패는 확인될 때만 추가.
- 미커밋 편집 스크립트 1차 실행에서 DTO 공통 문자열 중복 일치로 로컬 편집 시도 중단됨. Git ref/브랜치에 적용되지 않았으며 unique interface anchor로 보완하고 blob staging 재실행함. CI/제품 결함이 아니다.
- 로컬 런타임은 GitHub network unavailable, 원본 repository/dependencies 없음: TypeScript/Vitest/Playwright/Docker **NOT TESTED**. 외부 CI run이 started/queued인 것과 성공은 별개.
- 남은 위험: DB 0037 old-file backup/reopen, Project Copy/template, edit session 경합, hidden last-screen 및 dirty/pending, KO/EN/VI, browser geometry/focus/native125%, Gantt instance continuity, 운영 reverse proxy. 실제 실패를 파생 실패/정책 차단과 구분하고 정확한 Head/Attempt 단위로 원장에 누적한다.

## F881-001 — PR #884 Full #3534.1 QA 정책 사전 차단 (2026-11-07 KST)

- Source: [Full run 42305023293](https://github.com/planner77/masterGantt/actions/runs/42305023293), attempt1, event `pull_request`, PR #884, HEAD `3842c797cb3106abcf47ae2bb3b93e7c4afb2e67`, Base `229604522969133d1ccc6de0477e373252670c86`, test merge `66e2a4690f31409c2e99502fcc1e91b8027749e4`. Workflow **FAILURE**.
- **Direct** (not product test failures):
  1. QA Final 신뢰 경계 Job [128192084990](https://github.com/planner77/masterGantt/actions/runs/42305023293/job/128192084990): `QA 경로 BLOCKED: PR 본문 qa_method의 명시값 필요`; `scripts/qa_final_automated.py:pr_field` requires one full-line `qa_method: OWNER_MANAGED` without backticks.
  2. QA Preflight Job [128192281867](https://github.com/planner77/masterGantt/actions/runs/42305023293/job/128192281867): `RISK_LEVEL`, `QA_METHOD`, `QA_REQUIRED` lacked unique standalone lines; `PATH_POLICY` consequently failed; `DOCUMENTATION_SYNC` lacked per-path machine-readable entries `- \`path\`: UPDATED|N/A(reason)`. AC coverage combined identifiers also needed individual AC1..AC10.
- **Derived/untested**: PR Fast Gate Job128192418656 failed because Preflight failure; Quality/E2E/Docker aggregate jobs report failure on skipped dependencies, not underlying application defects. Actual TypeScript/Vitest/Chromium E2E8/Docker smoke **SKIPPED / NOT TESTED**; do not treat aggregate FAIL as four independent product failures.
- **Collateral source audit finding**: first PR mistakenly replaced the 5,806-line `docs/TEST_PLAN.md` with a 644-character snippet. Not identified by CI directly; on PR source audit restore original main blob `c9318ac0f4904c2b4637c32b3c4f7d0c2aad31a6` and move new plan into `docs/ISSUE_881_TEST_PLAN.md`, with explicit `N/A(reason)` in Work Packet. No pre-existing test cases may be silently deleted.
- **Corrections**: preserve QA Owner Managed HIGH policy and Required3, correct PR description exact fields; Work Packet `DOCUMENTATION_SYNC` explicit path records and individual `AC_TEST_COVERAGE`; restore Test Plan; include KO/EN/VI fixed message catalog+unit, Settings cancel draft reset. Product code changes are proactive risk remediation, not a reported CI product bug.
- **Verification boundary**: old Run remains FAILURE; new Head's Full/Trusted status must be separately observed. At time of writing no new execution PASS is asserted. Review threads/conflicts should be read after commit, and no monitoring after PR CI starts.
