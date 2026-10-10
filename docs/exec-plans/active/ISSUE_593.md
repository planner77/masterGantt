# Issue #593 Work Packet — Trusted QA 실행 출처/metadata 증거 강화
- Repository: planner77/masterGantt / [Issue #593](https://github.com/planner77/masterGantt/issues/593)
- Lifecycle: REVIEW_RESOLVED → OWNER_MANAGED QA 재검증 → PR merge / Main CI 시작 (2026-10-11 지시)
- Baseline: main `e41696430a78045998e35edad7cab5bb901a097e` (PR base SHA 2026-10-11 갱신; 과거 baseline `36b0eaa74a0614a76d1ed867bddb548149feb4bc`은 기록으로 유지)
- Branch: `ci/issue-593-trusted-qa-evidence`
- Risk: HIGH / protected CI workflow, QA policy and evidence validation; `qa_required=true`(Trusted QA/Owner 검토는 필수), `qa_method=OWNER_MANAGED` (#598 정책 기본 경로)
- Reviewer: `OWNER_MANAGED` — 독립 인간 APPROVED 비의무 (#598), 독립 검토는 `N/A(Owner-managed, 독립 검토 없음)`; Codex 리뷰 P2 2건은 모두 해결
- Manager decision: NOT TESTED (2026-10-11 사용자 명시 병합 지시 확보, 최신 변경 Head/Trusted QA/잔여 위험 검증 완료 후 Owner ACCEPT 감사기록 필요)
- Implementation owner: infra; docs owner: Manager; QA validation: trusted main Actions + Owner manual assessment, independent QA: N/A(Owner-managed, 독립 검토 없음)
- release_required: false / release_authorized: false (제품/DB/버전 변경 없음; PR 및 Ruleset 수정/정식 릴리스 미승인)
- Scope: source CI event-provenance artifact (읽기 전용 검사), default-branch Trusted source association, metadata full-run provenance, deterministic regression tests, report and documentation
- Exclusions: existing 3 required check names, SHA/strict merge protections, permission write, official GHCR release, Ruleset edit; current user explicitly authorized PR merge + Main CI startup
- Critical boundary: artifact는 PR에서 온 비신뢰 데이터이며 **절대 실행하지 않고** GitHub run/attempt/Head/base/merge/live PR 및 protected-path 검증과 교차 확인한다. 동일 SHA/branch를 공유하는 다중 PR은 차단한다.
- Current remote baseline: #396 metadata source run `pull_requests=[]`; #591 full CI failure. #580 main/Finalizer 완료 이력은 보존.
- Validation boundary: 이 PR은 workflow 및 validator 자체를 변경하는 HIGH 이슈이며 현재 #598 OWNER_MANAGED 운영 검토 대상으로 전환한다. 원본 PR 코드 자체를 신뢰된 main 검증기로 실행해 자기 승인하지 않는다. 새 validator의 실제 T1 positive proof는 main 병합 이후 non-protected 검증용 PR에서 수행할 것. 이 시점 T1 NOT TESTED.
- Issue comment writer: manager; infra allowed issue comment types: NONE.
- Current authorized stop: 2026-10-11 사용자가 리뷰 해결 후 병합 및 Main CI 시작을 지시. Ruleset 수정/정식 GHCR Release/운영 배포는 별도 승인 필요.

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
- `docs/AGENT_CONFIGURATION.md`: N/A(현재 main으로 PR base ref 갱신 후 직접 변경 파일이 아니며 #598 기존 main의 Agent 설정을 그대로 유지)
- `docs/SCHEDULING_ENGINE.md`: N/A(과거 base 불일치로 일시 표시된 Milestone E2E 변경은 이미 main 반영; #593의 일정 계산 의미 불변)
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
- AC9: 정확한 Head quality/e2e/docker 성공, latest base 정렬·review thread 0·Trusted QA/Owner-managed 검증 및 Owner 명시 병합 결정 기록이 끝나기 전 병합 금지. 독립 인간 QA는 #598 정책상 N/A.

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

## 2026-10-11 최신 main 재정렬 및 충돌 해소 (#598/#582)

- 최신 main 기준: `e41696430a78045998e35edad7cab5bb901a097e`. 본 PR은 직전 Head `4dfb5310aa08a61b6a6b2364e008db2e00d656bd`에서 41 commits behind였고 #598의 Owner-managed QA 정책, #582의 CI 실행명, Docker baseline build 네트워크 재시도 정책을 포함한다.
- `scripts/qa_final_automated.py`는 main의 `OWNER_MANAGED` 및 `AUTOMATED_MANAGER` alias, 선택적 AGENT, `verify_protected_agent_approval()`, `effective_run_jobs()`·Required 3종의 정확한 attempt를 유지하며 #593 `source_artifact()`·`verified_source()`·Head/base/test-merge 귀속 검증을 통합한다. 감사 버전은 `598-593-v1`로 최신 정책/증거 검증을 구분한다.
- `.github/workflows/ci.yml`은 main 최신 실행명/Docker build 수정과 #593의 PR event 출처 artifact/QA bootstrap routing을 함께 유지한다. `OWNER_MANAGED` 보호 변경은 #598 정책상 자동 QA 후보이며, `AGENT`를 명시 선택했을 때만 별도 독립 검토가 필요하다. 2026-10-11 사용자의 명시 병합 지시 및 사전 승인된 #598 Owner 간소화 정책에 따라 본 PR을 `OWNER_MANAGED`로 전환한다. 독립 QA PASS를 만들지 않는다.
- 기존 문서의 일반적 보호 파일 독립 리뷰 필수 문구는 #598의 Owner-managed 운영 결정을 우선한다. 기존 Quality/E2E/Docker 3개 required, strict main, review thread 0, Owner 명시 승인, 최신 Head의 검증, GHCR/정식 release 승인 정책은 보존한다.
- `scripts/test_qa_final_automated.py`에서 #598 Owner-managed 긍정·부정 테스트와 #593 source provenance·stale/attempt/blocked 감사 테스트를 모두 포함한다. 최신 Head의 원격 PR CI는 시작/성공 사실을 별도 run으로 기록하며 이전 #2409.1 PASS를 전용하지 않는다.
- Source of Truth: `AGENTS.md`, `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/GITHUB_OPERATIONS.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/REMOTE_VALIDATION.md`, `docs/TEST_PLAN.md`와 이번 Head의 `DOCUMENTATION_SYNC`를 비교한다. `DESIGN.md`는 UI 변화가 없어 #593 관점 N/A(제품 시각 언어 불변).
- T1 Trusted QA 정상 PASS 원격 실증 및 Manager의 exact-Head 최종 판정은 PR CI 시작 시점에 아직 NOT TESTED. 병합·Main CI·GHCR release는 이번 범위 밖이다.

## 2026-10-11 Owner-managed 경로 및 PR base 정합화 / 병합 준비

- PR #594의 기존 `base.sha=36b0eaa...`가 여러 main merge 이후 갱신되지 않아 GitHub PR files API가 #598의 `.codex/agents/**` 등 총 34개 파일을 #593 변경으로 오인했다. Base branch를 `main`으로 다시 지정해 실제 최신 SHA `e41696430a78045998e35edad7cab5bb901a097e`를 확인했다. 그 결과 PR changed files가 **15개**로 줄고 strict 최신 main mergeability=clean으로 판정되었다. 기존 Trusted QA #64 `BLOCKED: 문서 영향 기록 없음: docs/AGENT_CONFIGURATION.md`는 이 stale-base 파일 범위에 의한 것이며 원장 자체는 수정/소급 PASS하지 않는다.
- User의 2026-10-11 본 대화 명시 병합/Main CI 지시와 [Issue #598](https://github.com/planner77/masterGantt/issues/598)의 Owner 중심 QA 정책에 따라 `qa_method=AGENT` (과거 선택) 대신 `qa_method=OWNER_MANAGED`를 명시한다. 별도 인간 Reviewer의 APPROVED를 수행했다고 주장하지 않는다. HIGH risk/보호 파일 경계, exact Head/base/run/attempt, required Quality/E2E/Docker, Trusted QA 및 Work Packet/AC mapping은 모두 유지한다.
- 이전 PR CI [#2430.1](https://github.com/planner77/masterGantt/actions/runs/38088923929) exact Head `e6a925985ae89a6762961dbd3e6365f1ec5faaeb`의 required 3종 PASS와 리뷰 P2 두 건 resolved를 확인했다. 이 Work Packet 변경으로 Head가 바뀌므로 이전 CI/QA/Owner 검토를 새 Head의 PASS로 전용하지 않는다.
- 새 Head의 Trusted QA `automated_qa` PASS 후에도 `manager_decision`은 기계 검증으로 자동 ACCEPT되지 않는다. 사용자 명시 병합 지시, GitHub 인증 Owner 신원, 최종 Head/base/Run/Attempt, HIGH 잔여 위험(새 provenance 검증기 자체의 의미/운영 검증 T1은 병합 후 필요) 확인을 독립적인 Owner 감사기록으로 남긴 후 병합한다.
- Main CI 성공 및 `ghcr.io/planner77/mastergantt:ci-<merge SHA>` 검증은 병합 이후 비문서 main Job/Finalizer 범위이다. `release_required=false`; 정식 tag/rolling GHCR release는 승인된 범위 아님.

## PR CI #2440.1 — 기준 Base 변경 경합에 대한 운영 보완 (2026-10-11)

- [PR CI #2440.1](https://github.com/planner77/masterGantt/actions/runs/38092539854), Head `67066ea86fa4e708e9a63f54cd46edd4bcfe04bb`, run ID `38092539854`, attempt 1: Quality/Policy, E2E 6/6, Docker 3개 Required aggregate는 모두 SUCCESS. `QA Final — Automated`만 `BLOCKED`하여 전체 CI FAIL.
- Actions 로그에서 검증 시 캡처된 `EVENT_BASE_SHA=e41696430a78045998e35edad7cab5bb901a097e`였으나, CI 중 PR base가 `367b160b2f1db75feb7af1a5ea67046b9828b836`로 재지정되었다. `snapshot()`은 현재 PR base와 이벤트 base가 다를 때 `기준 main/base 변경, test-merge stale`로 **의도적으로 차단**했다.
- 처리: main과 PR base를 모두 `367b160b2f1db75feb7af1a5ea67046b9828b836`로 확인하고 변경을 멈춘 상태에서 이 문서/CI 운영 지침만 갱신한 **새 Head 전체 PR CI**를 시작한다. 검증 중 PR base/head 재지정 금지; 불가피하게 바뀌면 이전 run을 PASS로 재사용하지 않고 새 Head/PR event 기준으로 full CI를 다시 시작한다.
- `scripts/qa_final_automated.py::snapshot()`의 fail-closed 동작과 `test_head_and_merge`의 stale base/merge 거부 회귀는 유지한다. 시차 있는 GitHub API 출처를 강제로 일치시키거나 FAIL을 허위 PASS로 바꾸지 않는다.
- 최신 원본 증거/Trusted QA/Owner ACCEPT는 새 Head에서 다시 판정한다. #598 Owner-managed QA·3 required checks·strict main·GHCR 릴리스 정책은 그대로 유지한다. T1 Trusted QA 정상 경로 실증은 별도 후속 대상.

