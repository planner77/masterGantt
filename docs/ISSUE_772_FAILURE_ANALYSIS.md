# Issue #772 — PR CI 누적 실패 원장

Issue [#772](https://github.com/planner77/masterGantt/issues/772) · [PR #778](https://github.com/planner77/masterGantt/pull/778) · 2026-10-22 (KST). 관리 기준: [PR CI 실패 누적 분석](PR_CI_FAILURE_TRIAGE.md), [Work Packet](exec-plans/active/ISSUE_772.md), [AGENTS](../AGENTS.md). 정책 HIGH / OWNER_MANAGED / qa_required=true; default `LOW_TARGETED_POLICY_ENABLED=OFF`.

## 1. 원본 Run/Attempt 출처 (역사적 증거, 변경 금지)

| Run / Head/Base/Test-Merge | 직접 실패 | 파생 실패 또는 미실행 |
| --- | --- | --- |
| [PR CI #3141.1 / 39759380633.1](https://github.com/planner77/masterGantt/actions/runs/39759380633), `pull_request.opened`, PR #778, 2026-10-22 18:57~18:59 KST. Head `3c989d0aee004ac1e7ab525974a7d517748896a5`, Base `53aee48eba52860d6abf17149cc72292c4187dae`, Test-Merge `487ae32cb63a695e378a52be1f3cf30e7782fad0` | [Policy Job 119759642271](https://github.com/planner77/masterGantt/actions/runs/39759380633/job/119759642271): QA Preflight 테스트의 기존 `needs` 전체 문자열 단언 실패 (`AssertionError`) | Fast Gate/Required3/QA Final FAIL; PR Chromium 8-shard/Docker/PR Build는 **SKIPPED / NOT RUN** |

- Policy 첫 직접 FAIL: `scripts/test_qa_preflight.py::Contract.test_workflow_aggregate_guard_contract` line 208. 과거 `needs: [changes, preflight, metadata_evidence, e2e_shard, pr_e2e_shard, pr_fast_gate]`만 완전 일치 요구; #772가 인증된 `low_e2e_plan` 및 `low_e2e_targeted`를 같은 E2E Required Job에 추가하자 새 코드를 검사하지 못하고 FAILURE. 테스트를 제거·완화하지 말고 확장된 정확 Job 의존성과 E2E 집계 환경변수/차단 조건을 구조화해 검사한다.
- 실제 통과: Preflight/TypeScript/ESLint/Vitest 및 실패 step 이전 실행된 #712 regression 등. #772 신규 Python policy/test 소스는 실패 step 뒤에 있어 **NOT RUN**, 새로운 Head 성공 주장은 금지.
- 파생: PR Fast Gate Job `119760255982`는 `POLICY_RESULT=failure`로 FAIL; Required Quality `119760391343`, E2E `119760391623`, Docker `119760391559` FAIL; QA Final `119760432324`는 `required quality 미성공` FAIL. PR Chromium/Docker 구현 테스트에 Assertion FAIL/Timeout이 발생했다는 증거는 없음.
- Source: 최초 원격 Run 1회이며 과거 실패는 없음(추가 원본이 발견되면 여기 누적). Codex P1 2건은 실행 전 발견된 잠재 결함이므로 이번 직접 CI 실패 수와 별개.

## 2. 누적 실패·리뷰 P1 교차 매트릭스

| ID · 출처 | 원인/영향 | 보완·검증 |
| --- | --- | --- |
| **F772-001** · [Policy 로그](https://github.com/planner77/masterGantt/actions/runs/39759380633/job/119759642271) | `scripts/test_qa_preflight.py`의 오래된 E2E `needs` 완전 문자열 계약, 새 인증 의존성을 오탐 실패. **실제 원격 직접 실패** | 삭제/skip 없이 `e2e` Job의 최신 정확 `needs` 집합/중복·`set -u` 환경변수/false-green 차단 판정으로 교정, 회귀 범위 확대 |
| **F772-002** · [P1 리뷰 #4346971684](https://github.com/planner77/masterGantt/pull/778#discussion_r4346971684) | E2E aggregate shell이 `set -u` 중 사용한 `LOW_MODE/LOW_PLAN/LOW_TARGETED` 값을 Step env로 공급하지 않음. OFF Full8의 aggregate까지 차단할 **코드 결함**이나 이번 Run은 선행 Fast Gate에서 실패해 해당 사용지점 **NOT RUN** | E2E 집계 step에 `needs.low_e2e_plan.outputs.mode || ''`, `needs.low_e2e_plan.result`, `needs.low_e2e_targeted.result`를 각각 바인딩. 선택 mode가 없는 OFF/Docs/Main에서도 기존 Full8 경로 보존 |
| **F772-003** · [P1 리뷰 #4346971692](https://github.com/planner77/masterGantt/pull/778#discussion_r4346971692) | ON 후보 `low_e2e_targeted` attestation은 plan과 동일한 Owner `LOW_TARGETED_POLICY_ENABLED`를 받지 않아 OFF로 재분류, 계획 hash mismatch 실패 가능. ON 시험 Run **NOT TESTED** | attestation step에 Owner 저장소 변수를 추가하고 정확 계획/선정 spec/실제 reporter/출처 재검증 및 결측 fail-closed 유지 |

## 3. 선정·배제·검증 범위

- **직접/인접/음성 테스트 합집합:** `scripts/test_qa_preflight.py::test_workflow_aggregate_guard_contract`, `tests/python/test_ci_low_workflow.py`(신규, OFF Full8/ON 변수/Required3·실행 guard), 기존 `tests/python/test_ci_low_policy.py`, `tests/python/test_ci_low_source.py`; `.github/workflows/ci.yml` 두 Step과 E2E 집계.
- **교차 회귀:** `scripts/test_qa_final_automated.py`, `scripts/test-pr-metadata-evidence.py`, `scripts/verify-issue-lifecycle.py`, `tests/python/test_ci_impact_plan.py`(#770), `tests/python/test_ci_fast_development.py`(#771) 및 #712 메타데이터 원본 검증. main 8 shard 분배/fixtures/retries/timeout은 이번 실패 원인과 무관하므로 변경하지 않는다.
- GitHub 조회로 확인한 수정 전 main `53aee48eba52860d6abf17149cc72292c4187dae` vs branch는 **ahead=30 / behind=0**, PR mergeable=true, unresolved Codex 2 threads. Commit 게시 전 최신 main/mergeability 재확인. 코드·테스트·AGENTS/Work Packet·본 원장을 **단일 새 commit**으로 동기화.
- 로컬 저장소 git clone 불가: container의 `git ls-remote`가 `Could not resolve host: github.com` 반환. 따라서 로컬 실제 Python/Node/E2E: **NOT TESTED**. 정적 소스 구조 대조와 새 Head 원격 QA·8-shard 실제 실행을 분리; 정확한 신규 CI Run 결과는 **시작 직후 NOT TESTED**.
- `LOW_TARGETED_POLICY_ENABLED` 기본 **OFF** 유지. Required3 이름/Ruleset #24043042 strict·review, 기존 Main Full8/Docker/Quality/GHCR/Finalizer 및 Owner HIGH 위험 수용·릴리스 권한 변경 금지.

## 4. 리뷰·충돌 및 후속 원장 규칙

리뷰 P1 별도 코드 답변 후 해결 표시, 새 Head/main mergeability 점검. 새 PR CI 시작만 수행하며 모니터링/병합/Main/정식 GHCR/Issue 종료 없음. 다음 실패에는 원본 #3141.1 기록을 변경하지 않고 새로운 Run/Attempt/Head/Base/Test-Merge와 첫 직접 Job·증상을 **동일 원장에 추가**한다.
