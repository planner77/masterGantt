# Issue #703 / PR #705 — PR CI 연속 실패 분석 원장

공통 Source of Truth: [PR CI 실패 전체 이력 기반 REWORK](PR_CI_FAILURE_TRIAGE.md) (Issue #704). 이 문서는 정규 파일 `docs/ISSUE_<N>_FAILURE_ANALYSIS.md`의 #703 단일 원장이다.

이 문서는 CI 재발 시 **직전 실패만 고치지 않고 누적 실패/연쇄 취소/테스트 미실행을 구별**하기 위한 재사용 가능한 기록입니다. 원본 실패는 수정 후에도 실패 이력으로 남깁니다. 첫 기록: 2026-10-17 KST.

## 1. 원본 증거와 대상

- Repository: planner77/masterGantt, [Issue #703](https://github.com/planner77/masterGantt/issues/703), [PR #705](https://github.com/planner77/masterGantt/pull/705)
- [PR CI Run #2880.1](https://github.com/planner77/masterGantt/actions/runs/39009485784), Run ID 39009485784, Attempt 1, 결과 FAILURE.
- 원본 HEAD `9dd6f5c407dcb8417bf8b82b57a941d0ca8dcb26`; Base `de863713142a92f1cac56dbae044923822bca932`; Test-merge `75e9ef89ecdd06111a3bdd16ad14e33ec50db73f`.
- 직접 실패 Job: QA Preflight Job ID `117328744098`. 부수 실패: PR Fast Gate `117328782189`, QA Final `117328828548`.
- Preflight artifact: `qa-preflight-39009485784-1` (artifact ID 12092715042); 원본 진단 `FAIL: 1 / DEFERRED: 5`. QA Final 출력은 `required quality 미성공`이다.

## 2. 실패 원장 (다음 실패 시 행을 추가)

| 원본 Run/Attempt | 원본 SHA·Base | 최초 직접 FAIL | 연쇄 실패와 실제 미실행 | 수정 및 검증 |
| --- | --- | --- | --- | --- |
| [39009485784.1](https://github.com/planner77/masterGantt/actions/runs/39009485784) | `9dd6f5c…` / `de863713…` | QA Preflight `DOCUMENTATION_SYNC — DOC_SYNC 기록 누락` | PR Fast Gate FAILURE; Policy/TypeScript/ESLint/Vitest/Next Build/E2E shards/Docker smoke SKIPPED; 세 Required Aggregate 및 QA Final FAILURE | Work Packet 정형 문서/AC 매핑 및 동일 QA 계약 회귀 추가; 새 Head 원격 결과 전 NOT TESTED |

### 직접 실패의 근거

원본 Preflight 출력은 다음과 같다.

~~~text
FAIL / DOCUMENTATION_SYNC:
docs/exec-plans/active/ISSUE_703.md:
DOCUMENTATION_SYNC / AC_TEST_COVERAGE — DOC_SYNC 기록 누락
~~~

원본 Work Packet의 `## DOCUMENTATION_SYNC`에는 `UPDATED: AGENTS.md, ...`처럼 일반 서술과 일반 표만 존재했습니다. 신뢰된 main의 `scripts/qa_preflight.py`는 `scripts/qa_final_automated.py::docs_gate`를 호출하며, **일반 서술은 유효한 DOC_SYNC 행이 아닙니다**. 검증기가 요구하는 구조는 다음과 같습니다.

~~~markdown
## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(이번 작업에서 기존 QA 계약은 변경하지 않음)
...

## AC_TEST_COVERAGE
- AC1: 실제 관련 구현/테스트와 원격 미검증 경계를 기록
...
- AC8: 실제 관련 구현/테스트와 원격 미검증 경계를 기록
~~~

`docs_required(paths)`가 요구하는 전체 문서 합집합을 다룹니다. CI·Workflow·스크립트를 변경했으므로 `QA_DOCS`인 `AGENTS.md`, `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md`는 모두 대상입니다. `UPDATED`는 실제 PR diff에 존재해야 하며 `N/A(reason)`는 구체적인 이유를 써야 합니다. Issue AC1~AC8 각각 `- ACn:` 정규식 한 행이 필요합니다.

**변경: Work Packet 기록과 구조 회귀만 보완. Preflight 검증기/Required Gate/6-shard/Timeout은 약화하지 않음.**

### 연쇄 실패 분리

| 분류 | 원본 결과 | 해석 |
| --- | --- | --- |
| 변경 경로 판정 | SUCCESS | 경로 분류 성공 |
| QA Preflight | FAILURE | 문서 계약 직접 FAIL 1건 |
| PR Fast Gate | FAILURE | `PREFLIGHT_RESULT=failure`, 다른 빠른 검사 job skipped에 따른 올바른 차단 |
| Policy·TypeScript·Lint·Unit·Build | SKIPPED | 소스 검사 실행되지 않음. 실제 PASS도 제품 FAIL도 아님 |
| Chromium E2E(6개 shard)·Docker smoke | SKIPPED | 실제 테스트 미실행. timeout/flaky/제품 결함 주장 금지 |
| Quality·E2E·Docker Required aggregate | FAILURE 3건 | 보안상 fail-closed 집계이며 자체 원인 아님 |
| QA Final Automated | FAILURE | required quality 미성공의 전파; QA/Owner 승인 아님 |

PR #705 자동 Code Review Summary는 원본 Head에서 `status=failed, has_unresolved_findings=true`를 표시했으나 GitHub inline review thread 조회는 **0건**입니다. 별도 봇 댓글은 Codex code-review 사용 한도 도달을 알립니다. 이를 “보안 검토 완료”로 간주하지 않습니다. 실제 스레드가 생기면 다시 분류합니다.

## 2.1 Cross-run 실제 실패 집합 및 재검증

| 실패 ID · Job | 실제 첫 실패 / 조건 | 확정 원인 분류 | 새 최종 Source 확인 범위 |
| --- | --- | --- | --- |
| F-001 · PR #705 / 39009485784.1 / QA Preflight 117328744098 | `ISSUE_703.md` 비정형 `DOCUMENTATION_SYNC` → `DOC_SYNC 기록 누락` | `POLICY_CI` / 정형 문서 계약 위반 | trusted `qa.docs_gate`에 대한 문서/AC 매핑 positive·negative와 새 원격 QA Preflight. 결과 확인 전 NOT TESTED |

- **실제 실패 테스트 파일의 누적 합집합:** 없음. 최초 Run은 Preflight에서 E2E/Unit/Docker를 시작하지 않아 **테스트 성공 0건이 아니라 미실행 상태**다. 이후 Run의 직접 실패 파일·Case·Shard가 확인되면 표에 누적한다.
- **비최종 CI 시도:** 수정 Head `9b2d90148263504b6e330570416b6677642c6d97`의 Run `39010283771.1`은 과거 base를 기준으로 생성됐으나 이 사이 main이 #704 포함 10커밋 전진하였다. 해당 Run은 사용자의 CI 모니터링 생략 지시에 따라 최종 상태를 확인하지 않았으므로 실패·성공 어느 쪽으로도 재분류하지 않는다.

## 3. 원인 보완·증거 상태

- `docs/exec-plans/active/ISSUE_703.md`에 `## DOCUMENTATION_SYNC` 표준 파일별 `UPDATED/N/A(reason)`와 `## AC_TEST_COVERAGE`의 AC1~AC8 검증 맵을 보완.
- `tests/python/test_preview_publish.py`에 신뢰된 base `qa.docs_gate`와 동일 문서 구조의 positive/negative 회귀를 추가. 특정 문서 누락을 허용하는 테스트 완화가 아니라 원본 검증기를 실제 호출하는 방식.
- 본 분석 원장에 원본 Run ID/Attempt와 Job/최초 실패/연쇄 skipped/미검증 및 Source SHA를 불변으로 남김.
- 본 시점 실제 로컬 Python/Node/Docker 테스트 실행 증거는 **NOT TESTED**. 새로운 PR CI가 시작되어도 완료 성공은 별도 확인 전 NOT TESTED.
- Preview Registry 인증/태그 404, Docker archive/OCI digest 및 이식성, 3개 Run 절감효과는 **실제 Preview workflow main 반영 이후** 검증할 후속 실험이며 원본 CI 실패와 구별.

## 4. 향후 2회 이상 실패 시 반드시 재사용할 절차

1. **동결**: PR 최신 HEAD/Base/Test-Merge, Run ID/Attempt와 main SHA, 작업 파일 fingerprints 확인. Run이 취소되었어도 실제 Job/Trace에 기록된 테스트 FAIL은 따로 보존.
2. **누적 합집합**: 이 문서의 모든 과거 Run과 신규 Run을 함께 나열하고 직접 FAIL한 파일/Step/Assertion·환경·정책과 연쇄된 Required 집계, SKIPPED를 분리. 직전 Run 로그만 보고 원인을 단정하지 않음.
3. **유형별 분류**: 제품 결함, 테스트 fixture/contract, 환경·설치/transport, 정책/문서, source/base stale, 뒤따른 취소·집계 실패로 구분하며 정확한 Job 로그 링크를 붙임.
4. **일괄 보완**: 근거 있는 직접 오류를 모아 원인별로 수정; 합집합의 대상 테스트와 인접/교차/음성 소비자를 같은 고정 Source로 검증. Skip·Assertion 완화·timeout 일괄 증가는 금지. 중간 변경마다 CI를 반복 발생시키지 않도록 수정·문서를 묶어 최종 Push.
5. **세 단계 재검증**: (a) Work Packet `docs_gate`/Preflight 구조 검사 (b) 수정 관련 Policy·Python/Unit/E2E 진단과 교차 회귀 (c) 정확 HEAD/Base의 공식 Required Quality/E2E/Docker. 로컬 미실행은 NOT TESTED이며, 전 Run의 성공을 새 Head에 승계하지 않음.
6. **PR 점검 후 새 CI**: 현재 main 대비 branch behind=0, mergeable=true, 미해결 리뷰 스레드 0, canonical Refs #703·HIGH/OWNER_MANAGED, QA 문서·AC 계약을 확인한 후 정확 새 SHA의 PR CI 생성/시작 근거를 기록. 사용자가 CI 모니터링 생략을 요청하면 Run 시작까지만 보고.
7. **원장 업데이트**: 새 Run 별 Head/Base/Test-Merge, 실패+취소 shard 전체, 제품/계약/환경/정책 유형, 변경 SHA, 결과 및 여전히 NOT TESTED인 검증을 한 행씩 누적. 기존 실패 Run을 PASS로 덮어쓰거나 정식 GHCR/Finalizer를 호출하지 않음.

## 5. 다음 Run에서 먼저 볼 항목

- main #704의 공통 누적 원장을 먼저 읽고 이 문서의 모든 F-ID를 비교한 뒤 새 실패를 추가한다.

- QA Preflight `DOCUMENTATION_SYNC` 성공 여부 → 이번 수정의 직접 회귀 판정.
- 이전에 실행되지 않은 Policy 단계의 `test_preview_publish.py` (새 정책 회귀), Vitest/TS/ESLint, Chromium E2E6 및 Docker의 **최초 실제 오류**를 기록.
- 새로운 Codex 리뷰 스레드가 있다면 코드·문서에 필요한 변경을 반영하고 스레드 해결, 이후 새 HEAD에서 재검증.
- GHCR Preview 실제 게시/정식 Release는 이번 PR CI 요청 범위를 벗어나며 별도 Owner 지시와 검증이 필요.
