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

## 2026-10-13 — PR #660 CI #2690.1 P1 리뷰 후속 보완

- 최신 main 정렬·충돌 해결 Head `ea4a15ab3dc24822cfd6832cecd40c7a1ab1f3f5`, [CI #2690.1](https://github.com/planner77/masterGantt/actions/runs/38401534292): TypeScript/ESLint/Vitest/Policy/Fast Gate/Build/E2E6/Docker 및 세 Required aggregate 모두 PASS. `QA Final — Automated`는 unresolved P1 리뷰 스레드로 BLOCKED(원본 Run 결과 불변).
- P1 [discussion_r4258622127](https://github.com/planner77/masterGantt/pull/660#discussion_r4258622127): skipped legacy Job과 PR Job 이름 중복은 `qa_final_automated.effective_run_jobs`의 strict 중복 거부를 유발한다. 이를 고치지 않고 스레드만 닫으면 Trusted QA가 실패한다.
- 해결: PR Build/E2E 표시명을 구분하고, legacy Docker의 **PR 비대상 이름만** 동적으로 변경. 정확한 `Docker smoke 구현`은 PR 실행 Job과 Main/manual legacy 실행 Job에서 각각 그대로 유지하여 기존 default-main Trusted QA 및 `main_ci_recovery.OTHER_JOBS`를 변경하거나 자기 승인하지 않는다.
- 회귀: `scripts/test_pr_fast_gate.py`에 PR 실제·비실행 Job 원장 replay, exact trusted validator 선택, 동일 이름 중복 시 BLOCKED, Main/manual 복구 이름 정합 검사 추가. Code/doc sync 후 스레드 해결, 새 Head PR CI 시작. PASS 판정은 신규 원격 Run 완료 후에만.
- DOCUMENTATION_SYNC 후속: `docs/CI_CD.md` UPDATED, `docs/GITHUB_OPERATIONS.md` UPDATED, `docs/REMOTE_VALIDATION.md` UPDATED, `docs/TEST_PLAN.md` UPDATED, `docs/exec-plans/active/ISSUE_659.md` UPDATED, `docs/DECISIONS.md` UPDATED. `docs/QA_REVIEW_POLICY.md` N/A(불변 신뢰 경계). `AGENTS.md` N/A(기존 지침 보존). API/DB/UI/버전 N/A.

## 2026-10-13 — CI #2691 E2E Shard4 30초 타임아웃 근본 원인 후속

- [PR CI #2691.1](https://github.com/planner77/masterGantt/actions/runs/38406166683), Head `0f647de240aa8c2f1c6af87b4a3b8a022a96a6f2`: Preflight/TypeScript/ESLint/Vitest/Policy/Fast Gate/Build/Docker/Required Quality·Docker PASS. Shard4의 W05 편집 권한 수명주기 테스트 30,000ms timeout 뒤 `otherContext.close()` protocol exception 동반, 1 FAIL/128 PASS/1 SKIP. Shard 2/3은 matrix fail-fast로 CANCELLED, E2E aggregate 및 QA Final FAIL. 기존 미해결 리뷰 0.
- 같은 테스트는 [#2690.1](https://github.com/planner77/masterGantt/actions/runs/38401534292)에서 22.6초 PASS였고 그 뒤 제품/테스트 코드 변경은 없었다. 테스트는 실제 다중 페이지·권한 session/revision/패스워드 교체까지 수행하므로 W05 테스트 하나만 60초의 **유한 상한**으로 변경한다. 401/412 등 모든 권한 단언, E2E 격리, context close 오류 전달과 retries=0은 불변.
- 추가 원인: shard4의 53번째 테스트가 실패해도 shard Job이 130번째까지 진행하면서 다른 shard cancel이 지연됨. PR event에서만 `PR_E2E_STOP_ON_FAILURE`를 활성화하고 두 E2E 분기(historical planner 및 native fallback)에 `--max-failures=1`을 넘긴다. 기존 matrix fail-fast는 유지하고 Main/manual은 테스트 단위 조기 종료 없이 전수 실행.
- AC1/AC3: PR 조기 중단 2계층/후속 3 Required fail-closed 경로는 정적 테스트 및 신규 원격 Run으로 검증; 실패 주입 효과 증거는 실증 전 NOT TESTED.
- AC4/AC7: 새 Head에서 W05 테스트·E2E 6/6·Quality/Docker·QA Final 재검증. 기존 FAIL 원본 불변. AC2/AC6: Main/manual 전수 실행과 GHCR/Finalizer는 병합 전 별도 원격 검증 없으므로 NOT TESTED.
- AC8: #2691의 첫 실패~Shard 완료 지연 개선량/Runner-minutes는 새 실패 Run 전후 실제 계측 전 NOT TESTED.
- DOCUMENTATION_SYNC: `docs/CI_CD.md`, `docs/REMOTE_VALIDATION.md`, `docs/TEST_PLAN.md`, `docs/GITHUB_OPERATIONS.md`, `docs/exec-plans/active/ISSUE_659.md`, `CHANGELOG.md` 갱신; `docs/QA_REVIEW_POLICY.md`/API/DB/UI N/A(정책·제품 계약 변경 없음).
- 신규 결과가 PASS이거나 Owner가 재작업을 승인하기 전까지 merge/Main CI/GHCR/Finalizer/Issue close 금지. risk_level HIGH/OWNER_MANAGED, release_required=false.


## 2026-10-14 — 최신 main 재정렬 및 충돌 해결

- PR #660 기존 Head `5f931dbad989e48a3f58b49f846845537a9e30ff` / 기존 Base `89f4ab7936fe74062f0398601d4a6596e3e51924`에서 이후 main `bdfd1ea1b9d3453c3b8d97de80820b35ed22ee12`(Issue #661 PR #669 포함)까지 37개 commit이 앞서 병합 충돌 및 QA Final `mergeability/test-merge 불일치`를 확인했다.
- `AGENTS.md`, `CHANGELOG.md`, `docs/CI_CD.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md`, `docs/TEST_PLAN.md`, `docs/exec-plans/active/PLAN.md` 7개 공통 변경은 **#659의 실제 PR prepend delta만** 새 main 문서 전체 앞에 결합했다. main의 #661/#662 및 릴리스 감사/동기화 정책 변경을 삭제하거나 재해석하지 않았다.
- main과 경로가 겹치지 않는 `.github/workflows/ci.yml`, `docs/DECISIONS.md`, 본 Work Packet, `scripts/pr_fast_gate.py`, `scripts/test_pr_fast_gate.py`, `scripts/test_qa_preflight.py`, `tests/e2e/project-edit-authorization.spec.ts`는 기존 PR 버전을 보존한다. 6-shard PR fail-fast, PR-only `--max-failures=1`, W05 단일 테스트 유한 60초, Main/manual 전수 검사와 Required 3종 안전 Gate를 유지한다.
- CI #2701.1은 빠른 검사·E2E 6/6·Docker 및 Required 3종 PASS, 최종 QA는 과거 test-merge 불일치로 BLOCKED. 이 **과거 Run은 FAIL 그대로 유지**하며 새 exact Head/현재 main에서 Full PR CI + QA Final을 새로 검증해야 한다.
- DOCUMENTATION_SYNC: 새 main에서 수정된 문서를 보존하면서 위 7개와 본 Work Packet을 통합. 리스크 HIGH/OWNER_MANAGED, release_required=false/authorized=false 변경 없음; 신규 PR CI 실제 결과 전 NOT TESTED.

## 2026-10-14 — PR CI #2708.1 PASS 후 v0.108.0 main 정렬·재검증

- 검증 원본: [PR CI #2708.1](https://github.com/planner77/masterGantt/actions/runs/38451958896) Head `5464011b8c07564f6d6e92b23d46e83564b39a2e`, 당시 main `bdfd1ea1b9d3453c3b8d97de80820b35ed22ee12`: Quality/E2E 6-shard/Docker 세 Required aggregate, QA Final 모두 SUCCESS. 리뷰 스레드 미해결 0. 이 성공은 이전 Head/base에 속하며 새 main의 합격 증거로 재사용하지 않는다.
- 이후 [Issue #670 · PR #671](https://github.com/planner77/masterGantt/pull/671)의 `v0.108.0` 승계 릴리스 **준비**가 main `2016f38e5039894e5d6ac1d414eaac42221470fe`에 병합되었다. `package.json` 및 lockfile의 현행 app version은 **0.108.0**이며 #659에서는 버전을 올리거나 변경하지 않는다. 앞쪽 `0.107.0 유지` 기록은 이전 기준 시점의 역사적 기록이며 현행 버전을 의미하지 않는다.
- #659의 PR-only Fast Gate, E2E `fail-fast:true`/`--max-failures=1`, W05 개별 60초 제한, QA·Required 세 check·main/manual 전체 회귀 불변. 공통 문서 `CHANGELOG.md`, `docs/CI_CD.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md`, `docs/TEST_PLAN.md`, `docs/exec-plans/active/PLAN.md`는 #659 prepend delta와 최신 main의 #670 섹션 및 하위 원장을 함께 유지한다. #670의 승계 준비는 Owner의 정식 release 게시 승인과 다르며 이 PR에서 새 version tag·formal release/rolling tag를 발행하지 않는다.
- 최신 main과 정렬된 새 Head에서 정확한 source SHA/base/test-merge provenance, 세 Required PASS, QA Final PASS, open thread 0, mergeable=true 재검증 후 사용자가 명시 지시한 병합을 수행한다. 새 CI 결론 확인 전에는 NOT TESTED이며 기존 CI PASS를 소급 사용하지 않는다.
