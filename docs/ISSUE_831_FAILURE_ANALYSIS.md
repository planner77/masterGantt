# Issue #831 / PR #832 — 누적 PR CI 실패 원장

Primary Issue: [#831](https://github.com/planner77/masterGantt/issues/831) | PR: [#832](https://github.com/planner77/masterGantt/pull/832) | 최초 기록: 2026-10-27
정책: [PR CI Failure Triage](PR_CI_FAILURE_TRIAGE.md), [Work Packet](exec-plans/active/ISSUE_831.md), [AGENTS](../AGENTS.md), [QA 정책](QA_REVIEW_POLICY.md).

## 1. 전체 PR Run/Attempt 역사

GitHub `head_sha=5d24372236df86112277994ebf08915f56606a35` 조회 결과: 연결된 run **2개**, 즉 Full #3329.1 `40453783682.1` FAILURE와 같은 Head의 `FAST_DEVELOPMENT` Run `40453783562.1` SKIPPED. 이 Issue/PR의 별도 기존 Full 실패나 재실행은 현재 확인되지 않았다. Fast SKIPPED는 성공이 아니다.

| 사건 | 출처·실행 시각 | Head / Base / test merge | 검증 상태 |
| --- | --- | --- | --- |
| F831-001 | [Full Run 40453783682 / attempt 1](https://github.com/planner77/masterGantt/actions/runs/40453783682), `pull_request` Ready FINAL_FULL; 2026-10-27T05:10–05:11Z | `5d24372236df86112277994ebf08915f56606a35` / `dc8543f390616c0d5aca90a4f91899f3cf7ac5da` / `f65371c0247171a76727c4fbf58cbeaadee387a8` | QA Preflight 직접 FAIL; aggregate Required 3종·Fast Gate·Automated QA 파생 FAIL. 구현 Job 전부 SKIPPED/NOT RUN |
| advisory | [FAST_DEV 40453783562 / attempt 1](https://github.com/planner77/masterGantt/actions/runs/40453783562), `pull_request` | 동일 Head, Full 승인 출처 아님 | SKIPPED (Ready), 진단/승인 근거 아님 |

### 원본 Job/Step 판정

| 원본 Job ID | Job | 결론·인과 |
| --- | --- | --- |
| `122022281240` | 변경 경로 판정 | SUCCESS |
| `122022281532` | QA Final 신뢰 경계 확인 | SUCCESS |
| **`122022384535`** | **QA Preflight — 정책·문서 사전 검사**, Step4 | **FAIL — 최초 직접 F831-001** |
| `122022466138` | PR 빠른 검사 판정 | FAIL — Preflight failure + Policy/Node 검증 미실행의 파생 차단 |
| `122022544360` | Required Quality | FAIL — Preflight failure 파생 |
| `122022544336` | Required Chromium E2E | FAIL — Preflight failure 파생 |
| `122022544212` | Required Docker | FAIL — Preflight failure 파생 |
| `122022575103` | QA Final — Automated | FAIL — Required 3종 실패로 파생 |
| 나머지 Policy/Typecheck/Lint/Vitest/Build/E2E8/Docker 구현 | 정책·실제 구현 Jobs | SKIPPED/NOT RUN. Chromium 8개 샤드 및 실제 Docker 결과는 PASS도 직접 FAIL도 아님 |
| `122022575122` | 변경 영향 Shadow 계획 | SUCCESS/advisory, Full 승인 대체 아님 |

## 2. 원본 로그 / 원인 / Cross-run 매트릭스

### F831-001 — QA Preflight, 40453783682.1 / POLICY_CI

- 원본: [QA Preflight Job 122022384535](https://github.com/planner77/masterGantt/actions/runs/40453783682/job/122022384535) Step4 `원본 base SHA의 QA Preflight 실행 (read-only)`. 상태시각 `2026-10-27T05:10:52Z`, `Run 40453783682.1`.
- 로그: `FAIL / DOCUMENTATION_SYNC: docs/exec-plans/active/ISSUE_831.md: DOCUMENTATION_SYNC / AC_TEST_COVERAGE — DOC_SYNC 기록 누락` 및 exit 1. `PRIMARY_ISSUE`, `RISK_LEVEL`, `QA_METHOD`, `QA_REQUIRED`, `RELEASE_REQUIRED`, `RELEASE_AUTHORIZED`, `PATH_POLICY`, `ISSUE_AC` 검사 PASS.
- 원본 결과 artifact: [qa-preflight-40453783682-1](https://github.com/planner77/masterGantt/actions/runs/40453783682/artifacts/12711781969); GitHub Run/Step 로그가 1차 근거. raw logs를 Git에 복사하지 않는다.
- 확인된 원인: 신뢰된 **base** `scripts/qa_final_automated.py::docs_gate`의 `DOCUMENTATION_SYNC` 구조 파서는 행 `- \x60path\x60: UPDATED` / `- \x60path\x60: N/A(reason)`를 요구한다. 기존 Work Packet은 해당 소제목 아래 서술형 문장만 있어 `entries={}`, `DOC_SYNC 기록 누락`이 된다. 또 AC가 table 행만 있어 다음 검증 `- AC1: ...` 등 정규식에 맞지 않았다. **원본 검증기가 정상적으로 문서 계약 미준수를 차단한 사건**이며 코어 서비스/제품/실제 Terra 모델 결함은 관측되지 않았다.
- 재발 여부/교정: 최초이자 유일한 원본 direct failure. 이전 교정 없음. #347 모델 정책과 기존 #598 QA 보호 계약 변경 없음.
- 추정/기각: Runner 환경 문제/Playwright flaky/모델 미지원은 작업 자체가 미실행이므로 근거 부족. Preflight의 검증기 버그라고 단정하지 않는다.

| 직접 실패 | 누적 실패 파일/계약 합집합 | 원인 분류 | 교정 | 새 Head 실증 |
| --- | --- | --- | --- | --- |
| F831-001, PR #832 / 40453783682.1 / QA Preflight | `docs/exec-plans/active/ISSUE_831.md`의 DOC_SYNC/AC 매핑 | **POLICY_CI: 문서 구조 계약 미준수** | 정확한 UPDATED/N/A(reason) 7 필수 경로와 AC1..5 `- ACn:` 매핑, 기존 의미 기록 보존 | 정적 계약 재대조 대상, GitHub Full 검증 실행 전 NOT TESTED |

## 3. 교정 범위 · 동결 Source 검증 · 잔여 위험

- 변경 대상: **Work Packet 형식 및 실패 원장·active PLAN**. `scripts/qa_final_automated.py`, `scripts/qa_preflight.py`, `.github/workflows/**`, 테스트 assertion/timeout/retry, Required3, app API/DB/UX는 바꾸지 않는다. `DESIGN.md` Light-first/밀도/SVAR-native 동작은 제품 UI 미변경으로 N/A.
- `docs_required(paths)` 구조 기준 보호 정책 `AGENTS.md`, `docs/AGENT_CONFIGURATION.md` 및 2개 `.codex/agents/`·신규 `tests/scripts/`에 의해 **문서 7개** 필요: `AGENTS.md`, `docs/AGENT_CONFIGURATION.md`, `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md`. 앞 2개 UPDATED, 나머지 5개는 수용 가능한 사유를 명시한 N/A. Work Packet에 추가 활성 계획/원장 문서 영향도 명시.
- 기존 원본 `tests/scripts/agent-qa-contract.test.ts`: KEEP_UNIQUE, 신규 `tests/scripts/agent-model-selection.test.ts`: ADD. 원본 실제 FAIL은 Vitest case가 아닌 Preflight 문서 계약이므로 소비자 합집합은 `docs_gate`, `scripts/test_qa_preflight.py`, 신규 Agent 모델 회귀, 문서 링크/Markdown. 변경 영향의 실제 품질/빌드/8 E2E/Docker 검증은 **원격 새 Head에서 대기**, 원본에서는 미실행.
- 별도 로컬 checkout/npm/실제 Codex 사용 환경이 없어 로컬 Vitest·`scripts/test_qa_preflight.py` 실행과 실제 Runtime `gpt-6.1-terra` 로딩은 **NOT TESTED**. GitHub 읽기 전용으로 base 검사기의 정규식과 후보 Packet을 정적 교차 확인; 실제 CI 결과를 PASS로 앞서 선언하지 않는다.
- 증거: 이전 Head `5d24372236df86112277994ebf08915f56606a35`, base `dc8543f390616c0d5aca90a4f91899f3cf7ac5da`, test merge `f65371c0247171a76727c4fbf58cbeaadee387a8`. 보완은 같은 `issue-831-terra-agent-routing`/PR #832에 단일 변경 커밋으로 추가. 최종 신규 Head/Run은 PR #832·Issue #831 STATUS로 연결하며 현재 값은 새 push 직전 확정할 수 없음.
- 2026-10-27 실패 당시 미해결 리뷰 thread **0**, Codex Code Review `5d24372` COMPLETED/no findings, main/PR Head mergeable=true. 변경 후 재확인 필요. 새 Head의 Trusted QA·Owner ACCEPT / 모델 접근 / 10건 비용 실측은 **NOT TESTED**.
- 인계: Manager=원인·원장·Work Packet/CI 재시작, infra=원격 Run/Job 출처 및 병합 충돌 판단, qa_docs 별도 AGENT 실행하지 않음. 사용자 지시 범위는 **새 Full PR CI 시작까지만**; 모니터링/병합/Main/GHCR/Finalizer/Issue 종료 금지. `HIGH/OWNER_MANAGED/qa_required=true/release_required=false/release_authorized=false`.

## 4. 새 Full PR CI 기록

- 새 commit은 Work Packet/PLAN/본 원장의 한 번의 fast-forward push로 반영. `synchronize`로 실행된 새 Full의 정확한 Head/Run ID/Attempt는 원본 확인 후 Issue STATUS에 기록한다.
- 새 Head의 원본 Quality/E2E8/Docker/Trusted QA 결과는 **NOT TESTED**, `MERGE_READY=BLOCKED`; 이전 실패를 PASS로 갱신하지 않는다.
