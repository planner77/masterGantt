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

## 2026-10-10 리뷰 P1×4 / P2×2 REWORK (병합 전)

- 1. **P1 PR-controlled workflow**: 기본 브랜치 전용 `.github/workflows/qa-final-trusted.yml` 추가. PR workflow 결과는 권위 있는 독립 자동 QA 증거 아님. 신규 trusted workflow는 **main 병합 이전 NOT TESTED**. 보호된 workflow/validator 변경인 #580 자체는 인간/qa_docs 독립 검토 필요.
- 2. **P1 rename**: `filename`과 `previous_filename`을 함께 확인, protected paths 및 Policy 변경을 차단.
- 3. **P1 policy**: `docs/QA_REVIEW_POLICY.md`, `docs/SECURITY.md`, AGENTS/infra/CI/검증기 관련 경로의 수정·rename은 자동 PASS 차단.
- 4. **P1 metadata**: metadata-only 기존 full run은 같은 PR Head **및 base SHA**의 최신 검증 증거, 세 required checks 성공일 때만 재사용.
- 5. **P2 instructions**: infra 실제 실행 지침의 qa_method 분기를 기존 qa_required 조항에도 통합. 기타 정책 문서에 보호된 Bootstrap 예외 및 trusted workflow의 기본 브랜치 상태/운영 gate 경계 명시.
- 6. **P2 decision_reason**: 성공 원장에도 decision_reason 포함, 별도 Manager/independent QA 상태는 NOT TESTED로 유지.
- `scripts/test_qa_final_automated.py`: protected rename, 보안 policy, metadata stale base, trusted workflow 출처, 성공 판정/스키마 회귀 추가.
- documentation sync: 보안/QA 정책 운영 문서와 `docs/exec-plans/active/ISSUE_580.md` 및 신규 `.github/workflows/qa-final-trusted.yml` 동기화.
- `release_required=false`, `release_authorized=false`, 제품 버전 불변.
- **독립 QA_FINAL=NOT TESTED**, **Manager ACCEPT=NOT TESTED**. reviewer 스레드 6건 해소 및 최신 Head CI 검증 전 병합 금지.

## 2026-10-10 독립 QA F1–F4 REWORK (PR #587)

- 독립 reviewer qa568 실제 [QA_FINAL=FAIL](https://github.com/planner77/masterGantt/pull/587#issuecomment-6091333221); F1 Composite CI action 우회, F2 mutable validator checkout, F3 Python 테스트 미연결+위험도 인수 시나리오 부족, F4 현재 QA 단계별 책임 표 충돌.
- 보완: `scripts/qa_final_automated.py` protected execution paths, source SHA 검증, `manual_merge_readiness()`; `scripts/test_qa_final_automated.py` LOW/MEDIUM/HIGH, 재사용 base/rename/composite/SHA, `ci.yml` policy에서 Python 실행; Trusted Workflow immutably pinned; 현재 AGENTS/AGENT_PROMPTS/ISSUE_LIFECYCLE 등 표 동기화.
- 추적 AC1: 최신 단계별 Ownership·`qa_method` 분기 일치 및 DOCUMENTATION_SYNC 독립 확인.
- AC2/4: main에 Trusted QA workflow 설치 뒤 read-only 실제 CI workflow_run 검증 (현재 NOT TESTED).
- AC3/7: protected_paths() composite/rename/security assertions 및 CI native Quality/E2E/Docker 유지.
- AC5: validator_sha와 metadata same Head/base, stale·cancelled·review blocker 단위 및 원격 시나리오.
- AC6: test_low_medium_high_merge_readiness, test_ci_execution_control_protection_rejects_composite_actions.
- AC8: 새 Head PR CI의 policy QA Python Step + 3 required aggregates, main trusted 원격 실증은 별도.
- AC9: 정책/운영/source revision/Manager 승인·rollback 문서 기록.
- status: DOCUMENTATION_SYNC 재검토 전 NOT TESTED; independent_qa=NOT TESTED (이전 Head FAIL stale); manager_decision=NOT TESTED. 정책/Workflow Bootstrap은 AGENT 필수, MERGE_READY=BLOCKED.
- 최신 main 45a248f723e11133a4bd4c73ca14bb69b3071cbe (#549 등) 정렬 필요. 제품 version은 최신 main 기준 0.104.0이며 이번 CI/QA 운영 수정 자체에 추가 버전 증분 없음, `release_required=false`, `release_authorized=false`.

## 2026-10-10 신규 QA P1/P2 재검토 및 최신 main 정렬

- 기존 PR CI #2360.1 (run 38008686035) Quality/E2E/Docker SUCCESS; QA Final — Automated는 bootstrap SKIPPED/NOT TESTED, Trusted main workflow NOT TESTED. 신규 Python 보안 시나리오 16/16 PASS였으나 [독립 검토 후 정적 QA FAIL](https://github.com/planner77/masterGantt/pull/587#issuecomment-6092035103)로 구분.
- **보완 A/P1:** `postcss.config.*`, `tsconfig*.json` 포함 루트 CI 빌드 구성 패턴과 rename 원본을 모두 보호하며 `test_all_tracked_ci_config_patterns_and_renames`를 추가.
- **보완 B/P1:** `src/contracts/import.ts`, `src/server/imports/**`, `src/server/exports/**`, `db/migrations/**`, Scheduling/Calendar/Dependency 등의 파일 기반 최저 위험도를 HIGH로 처리하며 위험도 LOW 위장 PR을 BLOCKED로 처리.
- **보완 C/P2:** `docs_required()`가 DB/API/Scheduling/Import·Export의 도메인 문서 계약을 합집합으로 계산하고 문서마다 UPDATED 또는 사유가 충분한 N/A를 요구. `docs/DB_SCHEMA.md`, `docs/API.md`, `docs/SCHEDULING_ENGINE.md`, `docs/IMPORT_SCHEMA.md`, `docs/IMPORT_EXPORT.md`의 실제 파일 존재를 확인.
- **Work Packet 상태:** 이전 설명의 `45a248f...`는 1e0b Head에서 실제로 정렬 완료되었고 뒤이어 main이 `cf1bb035f19ac18423c7f643fbda3a89dcd73a7f`로 이동함. 해당 main의 새로운 #549 파일을 보존하며 새 Head로 재정렬/CI 실행 필요.
- DOCUMENTATION_SYNC 갱신: QA validator·Python 회귀, `docs/TEST_PLAN.md`, `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md` 및 본 Work Packet. `DESIGN.md`/DB_SCHEMA 문서는 #580에서 제품 계약 변경 없음(N/A).
- 진행 gate: `risk_level=HIGH`, `qa_method=AGENT`; 새 Head 독립 QA Final/Manager ACCEPT/리뷰 thread resolution 없이는 MERGE_READY 불가. `release_required=false`, `release_authorized=false`, 제품 v0.104.0 보존.

## 2026-10-10 QA Review 추가 P1×2/P2×1 REWORK / PR #587

- 최신 리뷰 HEAD `4134172614db006677fe0cc51d655364cc3276d3`, PR CI `38026205560` SUCCESS지만 새 [Codex Review P1×2/P2×1](https://github.com/planner77/masterGantt/pull/587) 지적.
- F1/P1: `.codex/agents/qa-docs.toml` 등 정책 실행 지침 누락 → `.codex/**` protected 및 HIGH, rename 포함.
- F2/P1: `src/server/repositories/project-repository-core.ts` password/session token hash 영속성에도 MEDIUM 오분류 → repository/service/auth/db/server API HIGH floor, 명시 MEDIUM/LOW 위장 거부.
- F3/P2: `src/contracts/projects.ts` 등 공용 DTO 계약의 `docs/API.md` 누락 → contracts/service docs_required 합집합 강화.
- 회귀: 추가 Python 단위 테스트 4건, 기존 `policy` Job에서 실제 실행; `docs/TEST_PLAN.md`, `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md` 동기화.
- 현재 동작/범위: HIGH, AGENT 독립 QA 필수, release_required=false, release_authorized=false, 제품버전 0.104.0(추가 증분 없음).
- 새 Head/CI/독립 QA Final/Manager ACCEPT는 실제 증거 전 NOT TESTED; 변경 전 PASS나 review resolve는 새 Head에 소급되지 않음.

## 2026-10-10 Codex 추가 P1×2 / P2×1 보완

- 이전 Head `5b235c8fd6af9a966ac0e5515c041d5b737cad59`: [PR CI #2366.1](https://github.com/planner77/masterGantt/actions/runs/38029853144) 전체 SUCCESS, Python QA 24/24 PASS; 독립 QA_FINAL 새 HEAD 승인 없음.
- **P1 실제 서비스 HIGH:** `src/server/**`를 최소 HIGH로 분류하여 실제 `projects/project-service-core.ts`, `templates/project-template-service-core.ts`, `resources/resource-catalog-service-core.ts` 등이 AUTH 문자열이 없어도 보호되도록 변경.
- **P2 API 문서:** `docs_required()`는 실제 도메인 `src/server/**` 서비스 변경에 `docs/API.md` 요구; DB/Import/Scheduling 문서 영향 합집합 유지.
- **P1 선언 입력:** `next-env.d.ts` 및 루트 `*.d.ts` 수정·rename은 CI 정책 변경에 준하는 protected set에 포함.
- 신규 Python 회귀 2개와 `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md` 동기화.
- 현 상태: `risk_level=HIGH`, `qa_method=AGENT`, 제품 버전 0.104.0 유지, `release_required=false`, `release_authorized=false`. 새 CI/독립 QA/Manager 승인과 리뷰 스레드 최종 검증 전 MERGE_READY=BLOCKED.
