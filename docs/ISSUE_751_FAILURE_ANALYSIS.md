# Issue #751 — CI failure ledger

## F-001: PR #754 Full CI #3014.1 (2026-10-19)
- Source: https://github.com/planner77/masterGantt/actions/runs/39255129930; attempt 1; Head f24f74b4b56fc3a83b6e0496574739f840a56e6e; Base 0aa1d3d71f13df6976539ef4ebaaadb9037121c4; test-merge dea92870e3be362ca88f67b8271c89f3c5bf7d00.
- Changes Job 118068393834 rejected PR title: title Issues=[] (must contain Issue #751 or (#751)).
- QA Final trust Job 118068393592 rejected missing qa_method. Metadata omissions, not product failures.
- Typecheck, lint, unit, build, Chromium E2E 6 shards and Docker actual jobs SKIPPED. Required three aggregate FAILURE derived from missing prereqs. No PASS or product FAIL may be inferred.
- Remedy: title changed to Issue #751: E2E..., PR body declares qa_method=OWNER_MANAGED, risk_level=HIGH, qa_required=true, release_required=false, release_authorized=false.
- Keep #3014.1 FAILURE unchanged. Revalidate with new HEAD Full PR CI; actual test results not yet known.
- Subsequent failures must append new F-number, exact run/attempt/head/base, cause, affected/cancelled jobs and correction without retroactive PASS.

## F-002: PR #754 Full CI #3016.1 (2026-10-19)
- Run https://github.com/planner77/masterGantt/actions/runs/39257936517 , attempt 1, Head `8103ed5723325482027feb4e01cef79afea54f85`, Base `0aa1d3d71f13df6976539ef4ebaaadb9037121c4`.
- QA Preflight 118077952850 FAIL / ISSUE_AC — 원본 Issue 본문에 세 가지 AC 항목은 있었으나 식별자 `AC1..` 누락. 제목/Refs, QA/Risk/Release 메타데이터는 PASS.
- Typecheck/Lint/Unit/Build/Chromium E2E6/Docker 실행 Job은 SKIPPED, 집계 Required FAILURE와 QA Final FAILURE는 선행 실패에 따른 결과임. 제품 실패 단언 근거 없음.
- 조치: Issue #751의 기존 3개 수용 기준을 AC1~AC3으로 식별하고, 해당 HEAD 원본 실패는 소급 변경하지 않는다.

## F-003: PR #754 Full CI #3018.1 (2026-10-19)
- Run https://github.com/planner77/masterGantt/actions/runs/39259814359 , attempt 1, HEAD `3c751c19e978733d65929c14d0d21344ad526944`와 Base `5df178868139c4a307701e4807896691971b3376`.
- QA Preflight job 118084338946: PRIMARY_ISSUE/QA_METHOD/RISK_LEVEL/ISSUE_AC 모두 PASS, 그러나 `FAIL / DOCUMENTATION_SYNC: Work Packet ## DOCUMENTATION_SYNC 누락`. Script, E2E, Docker 및 3 Required 집계의 직접 실행 결과는 SKIPPED/선행 차단.
- 원인: protected CI/scripts 변경에 필요한 문서 영향 계약과 `AC_TEST_COVERAGE` 섹션 누락. 단순 CI retry나 timeout 증가는 해결되지 않음.
- 보완: docs/exec-plans/active/ISSUE_751.md에 문서별 UPDATED/N/A 이유와 AC1~AC3의 source-to-test mapping 및 증거 경계를 기재. Head 변경 뒤 새 Full PR CI 필요. F-001/F-002/F-003 원본 상태를 보존한다.
