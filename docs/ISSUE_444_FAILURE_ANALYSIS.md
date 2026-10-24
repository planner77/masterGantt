# Issue #444 — PR CI 누적 실패 원장 (2026-10-24)

Primary Issue: [#444](https://github.com/planner77/masterGantt/issues/444) · 구현 PR: [#789](https://github.com/planner77/masterGantt/pull/789) · 과거 superseded [#448](https://github.com/planner77/masterGantt/pull/448). Source of Truth: [PR CI 실패 처리 지침](PR_CI_FAILURE_TRIAGE.md), [AGENTS](../AGENTS.md), [Work Packet](exec-plans/active/ISSUE_444.md).
risk_level=HIGH / qa_method=OWNER_MANAGED / qa_required=true / release_required=false / release_authorized=false. 고장 원본은 소급 PASS 처리하지 않는다.

## 1. 접근 가능한 전체 PR/Run/Attempt 이력

2026-10-24 조회 가능한 canonical #444 PR의 workflow `.github/workflows/ci.yml` event=`pull_request` 이력이다. 관련 구현 배포 [#450/#451](https://github.com/planner77/masterGantt/pull/451), [#603/#604](https://github.com/planner77/masterGantt/pull/604)는 다른 Primary Issue이므로 #444의 직접 실패에 합산하지 않는다.

| PR | Run(Attempt) / event | source Head 및 경계 | 완료 결론 / 상세 |
| --- | --- | --- | --- |
| #448 | [#1818.1 · 37306164138](https://github.com/planner77/masterGantt/actions/runs/37306164138) | `981e0720e9...` · `pull_request` | success(과거 해당 소스; 최신 #789 PASS 아님) |
| #448 | [#1819.1 · 37309659403](https://github.com/planner77/masterGantt/actions/runs/37309659403) | `3945e31076...` | CANCELLED, 취소 중 Quality/E2E/Docker aggregate FAILURE; 구현 Job/직접 assertion FAIL 증거 확인되지 않음 |
| #448 | [#1820.1 · 37309774079](https://github.com/planner77/masterGantt/actions/runs/37309774079), [#1821.1 · 37309800227](https://github.com/planner77/masterGantt/actions/runs/37309800227) | `b2656cabae...`, `43f3200a5...` | CANCELLED; 최신 job 조회에 독립 직접 FAIL 없음/빈 Job 목록 |
| #448 | [#1822.1 · 37309839401](https://github.com/planner77/masterGantt/actions/runs/37309839401) | `88707a476d...` | CANCELLED, 취소 중 Required 3 aggregate FAILURE; 직접 테스트 FAIL 증거 없음 |
| #448 | [#1823.1 · 37309876915](https://github.com/planner77/masterGantt/actions/runs/37309876915) | `a42ef3daf9...` | CANCELLED, 취소 중 Required 3 aggregate FAILURE; 직접 테스트 FAIL 증거 없음 |
| #448 | [#1824.1 · 37310016326](https://github.com/planner77/masterGantt/actions/runs/37310016326), [#1825.1 · 37310029668](https://github.com/planner77/masterGantt/actions/runs/37310029668), [#1826.1 · 37310047363](https://github.com/planner77/masterGantt/actions/runs/37310047363) | `b5dd3a2b2...`, `96f7e511f...`, `c2deb98cc...` | CANCELLED; 최신 job 조회 빈 목록 |
| #448 | [#1827.1 · 37310094141](https://github.com/planner77/masterGantt/actions/runs/37310094141), [#1828.1 · 37310135909](https://github.com/planner77/masterGantt/actions/runs/37310135909) | `5614ca5811...` | success 당시 PR 이벤트(후속 메타데이터 전환 시점의 효력은 별도) |
| #448 | [#1829.1 · 37312426386](https://github.com/planner77/masterGantt/actions/runs/37312426386) | Head `5614ca58118051702f19bdb3bee81d42319c9f5b`, historical base/test-merge 정확 SHA **UNKNOWN** | **FAIL**, Changes Job 111770847209 직접 trace mismatch; Required3 파생 FAIL, E2E6/Docker/Quality 구현 SKIPPED |
| #789 | [#3211.1 · 40048923080](https://github.com/planner77/masterGantt/actions/runs/40048923080) | Head `93835ad7145d7233b3c7bc1accb1875d53c096b0`, Base `4ce403a1e410ca599a780446f39513e1f1158326`, Test-merge `638ed8e584fde62fd5690a28db878830b9deaee3` | **FAIL**, Preflight+QA Final 직접 / Required3 파생, E2E8/Docker 구현 SKIPPED |

역사적 #448은 2026-10-05에 병합되지 않고 #450 구현 배포 PR #451로 대체. 해당 기간 취소 원본을 성공으로 재작성하지 않으며, 8개 취소에 별도의 독립 원인이 없는 것으로 **확정하지 않는다**. 접근 가능한 Jobs API에서 일부는 aggregate FAILURE, 일부는 빈 목록이며 직접 실패는 `UNKNOWN/NOT RUN`이다.

## 2. Cross-run 직접 실패 및 인접 계약 매트릭스

| 실패 ID | 원본 첫 실패·Job | 분류/인과성 | 보완 계약 및 현재 상태 |
| --- | --- | --- | --- |
| F444-001 (역사) | PR #448 #1829.1 [Job 111770847209](https://github.com/planner77/masterGantt/actions/runs/37312426386/job/111770847209) `scripts/verify-ci-run-trace.py`: `branch issue=444, Primary Issue=450` | POLICY_CI, #448 lifecycle 이관 때 branch/body trace 불일치(메타데이터 직접 원인). Main Docker/Chromium 원인 아님 | #450/PR #451로 canonical 전환(과거 조치); 이번 #789의 branch/title/단일 `Refs #444`는 일치 |
| F444-002 (현재) | PR #789 #3211.1 [QA Preflight 120737006967](https://github.com/planner77/masterGantt/actions/runs/40048923080/job/120737006967): `RISK_LEVEL`, `QA_METHOD`, `QA_REQUIRED`, `PATH_POLICY`, `ISSUE_AC` 5 FAIL. [QA Final 120736938090](https://github.com/planner77/masterGantt/actions/runs/40048923080/job/120736938090) `PR 본문 qa_method의 명시값 필요` BLOCKED | POLICY_CI, PR 본문에 독립 선언 대신 `- risk_level: **HIGH**; ...` 복합행, Issue AC에 ID 부재. F444-001과 root 다름 | PR 본문 정확한 5개 독립 metadata 줄, Issue 기존 체크박스 AC1..AC10 번호 부여. Work Packet docs gate/10개 AC mapping 사전 교정. 신규 Full CI 출처 전 NOT TESTED |
| REVIEW-P1 (별도) | [review discussion_r4365476882](https://github.com/planner77/masterGantt/pull/789#discussion_r4365476882): 신규 CLI 오류 설명이 영어 | 저장소 한글 CI 메시지 정책 위반; #3211.1에서 테스트 자체 실행되지 않았으므로 실행 실패로 중복 계수하지 않음 | 새 메시지 한국어화, `spawnSync` stderr 4개 음성 테스트·현지 Node22 CLI 10개 검증. reviewer reply/resolve 후 새 Head CI |

### 파생 실패와 실제 실행 경계

- #3211.1: [Fast Gate Job 120737069530](https://github.com/planner77/masterGantt/actions/runs/40048923080/job/120737069530) Preflight FAIL·Policy/Node SKIPPED 전파.
- 필수 집계 [Quality 120737129383](https://github.com/planner77/masterGantt/actions/runs/40048923080/job/120737129383), [E2E 120737129494](https://github.com/planner77/masterGantt/actions/runs/40048923080/job/120737129494), [Docker 120737129399](https://github.com/planner77/masterGantt/actions/runs/40048923080/job/120737129399) 실패는 **선행 실패로 fail-closed**. 실제 Typecheck/ESLint/Vitest/Policy/Next/PR E2E8/PR Docker 구현은 **SKIPPED NOT TESTED**. `changes` Job PASS, Shadow advisory PASS.
- #1829.1: Changes trace의 직접 FAIL 이후 6-shard 원본 및 Docker 구현 Job 미실행. 당일 6-shard 역사 기록을 현재 8-shard 성공/실패로 바꾸지 않는다.
- [#3211.1 QA Preflight artifact](https://github.com/planner77/masterGantt/actions/runs/40048923080/artifacts/12542044606)와 Job summary는 sanitized source이며 PASS 증거가 아님.

## 3. 교정 범위, 테스트 생명주기 및 실행 증거

- `scripts/qa_preflight.py::_unique_field`: PR 본문 `^risk_level: HIGH$`, `^qa_method: OWNER_MANAGED$`, `^qa_required: true$` 등 **한 줄 한 선언**을 요구한다. 보호된 `scripts/` + `AGENTS.md` 변경은 `HIGH/OWNER_MANAGED` 및 `qa_required=true`로 유지. Validator 변경이나 QA 완화 금지.
- `qa_final_automated.py::docs_gate`: `DOCUMENTATION_SYNC`는 `- \x60path\x60: UPDATED` 또는 `N/A(reason)` 독립행; `AC_TEST_COVERAGE`는 Issue 본문에 명시된 모든 `AC1`~`AC10` 각각 `- ACn: ...` 줄이 필요하다. 기존 범위 shorthand 및 `UPDATED — 설명` 포맷은 정합성 검증 실패 위험, 이번에 함께 보완.
- 테스트 검색/선정: 기존 `tests/scripts/ci-cache-phase2.test.ts` **EXTEND**(CLI errors Korean, alias/invalid provenance/metric/source), `tests/scripts/ci-setup-provenance.test.ts`·`scripts/verify-ci-cache-contract.mjs` **KEEP_UNIQUE**. deletion/skip/timeout/retries/Required 변경 0.
- 로컬 검증: Node v22.16, 기존 before/after trusted analysis JSON을 사용한 CLI 10개(정상 PR REVIEW_REQUIRED, Main DO_NOT_ADOPT, scope/rename/sample/provenance/invalid cost/duplicate 음성) **PASS**; `node --check` **PASS**. 이 로컬 검사는 GitHub 원격 Vitest/Policy/Chromium/Docker **PASS 증거가 아니며** 새 코드 exact commit은 최종 원격 synchronize Run에서 검증한다. 별도 새 Vitest 4가지 한국어 stderr expectation은 원격 CI 전 NOT TESTED.
- 새 파일은 `docs/ISSUE_444_FAILURE_ANALYSIS.md` 단일 원장으로 시작. 과거 #448 취소/실패 원본을 보존. `AGENTS.md`, [Phase 2 측정 원장](CI_CACHE_PHASE2_EVIDENCE_444.md), Work Packet/CI docs와 연결한다.

## 4. 최신 Main 정렬, 리뷰 및 다음 승인 경계

- 원본 실패 시 기준 Main `4ce403a1e410ca599a780446f39513e1f1158326`. PR #789 branch `ci/issue-444-phase2-evidence-comparison`, 기존 compare `ahead 9 / behind 0`, mergeable true. 새 push 전 Main 최신 SHA/충돌을 재확인하고 필요할 때 정렬한다.
- P1 thread는 코드+음성 테스트 수정 후 실제 응답을 남기고 GraphQL resolved 확인. CI 시작 전 미해결 리뷰 thread=0인지 재조회한다.
- 새 PR Head와 정확 Run/Attempt는 push 이후 GitHub가 부여하며 이 문서에 미래 PASS 값을 채우지 않는다. 이전 Full #3211.1은 FAIL로 보존. 다음 `pull_request.synchronize` Full PR CI 시작까지만 승인, 모니터링/병합/Main/GHCR/Finalizer/Issue 종료는 **미실행**.
