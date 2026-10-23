# Issue #608 — Trusted QA T3~T9 운영 검증 Work Packet

> 기준일: 2026-10-24 KST. 검증 범위는 #593 후속 T3~T9; 이 PR #609는 **T3 전용, 절대 병합하지 않는** 원격 실험 수단이다. 본 문서의 날짜·기록은 최초 #609 실패의 증거를 덮어쓰지 않는다.

## 1. 출처와 작업 경계

- Primary Issue [#608](https://github.com/planner77/masterGantt/issues/608); #593 개선 및 #606/T1·T2 원격 긍정 경로 PASS가 선행이다.
- 최신 정렬 기준 main `427d22245fb8e11254b2424ea5147ccbd5766979` (2026-10-24 재조회 후 작업). 이전 T3 PR Head `6c27d64be4903147fa36283d3c32ab8fe6f175c6`, 옛 base `ac2a3f69d09da1cbc7e4f833da0fa0515434f895`는 **과거 실행 출처**로만 사용한다. Ready 실행 직전 live base·head·test-merge를 다시 검증한다.
- 기존 [#571](https://github.com/planner77/masterGantt/issues/571)은 corrective PR #611 및 Main CI/Finalizer 성공으로 종료. T3 #2497 실패를 과거의 정상 PASS로 소급 변경하지 않는다. 전체화면 회귀 수정 뒤의 #609 새 Head CI는 별도로 증명한다.
- 변경 파일은 `docs/exec-plans/active/ISSUE_608.md` (검증 계획/원장)와 `public/qa-trusted-t3-issue-608.txt` (읽히지 않는 정적 표식) **두 개만**. 앱, QA validator, workflow, 보안·권한·Ruleset, DB/API/버전, GHCR, main에 변경 없음.
- 변경 파일 위험 LOW; 오류 유도·경합을 포함한 **운영 실험 위험 HIGH**. `qa_method=OWNER_MANAGED`, `qa_required=true`, `manager_decision=NOT TESTED`, `release_required=false`, `release_authorized=false`. Owner 최종 ACCEPT/병합·릴리스 권한을 기계 PASS로 승격하지 않는다.
- `AGENTS.md`, `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md`, `docs/TEST_PLAN.md` 및 #593/#595/#598/#600/#712/#770/#771/#772 지침을 우선한다. 역사적 문서의 six-shard 수치를 현재 계약으로 오용하지 않는다.

## 2. 현재 CI 계약과 실행 순서

2026-10-22 #771 이후 **Draft** `opened/synchronize`는 Fast Development 보조 경로이며 세 Required aggregate는 `DRAFT_BLOCKED`; 이를 Full PASS로 인정할 수 없다. 현행 **Ready** `ready_for_review`는 `FINAL_FULL`을 시작한다. #767 이후 기본 Full E2E는 **8 shards**이며 #772의 LOW targeted 선택이 실제 적용되면 Full E2E8/8 자체의 실증 여부를 별도 구분한다.

1. 이 검증 PR의 Head를 최신 main에 안전하게 정렬(기존 PR T3 두 파일 유지, merge/lease로 갱신), diff가 정확히 두 파일임을 재확인한다. 정상 제목에 `Issue #608`, 본문에 정확히 하나의 독립행 `Refs #608` 유지. 리뷰 스레드·mergeability·검증 run 귀속을 점검한다.
2. Draft에서 **Ready for review 전환 후** GitHub `pull_request.ready_for_review`를 통한 원본 PR CI `FINAL_FULL` 시작. 이 전환은 **CI 시동**이지 PASS가 아니다. 자동 진단과 검사 결과를 관측하기 전 T3 live=NOT TESTED.
3. T3 초기 **정상 canonical Full CI**의 source run ID/attempt, 변경 파일/증거 artifact, PR number, Head/base/test-merge/validator SHA, Quality/E2E/Docker 세 Required 결과, 선택된 E2E 실제 shard·Docker Job, Trusted default-main run/attempt/JSON verdict를 모두 확보한다. 원본 실패/취소 또는 main drift는 BLOCKED/FAIL로 남기고 다음 단계로 넘어가지 않는다.
4. 정상 Trusted PASS를 확보한 **후에만**, 다른 PR·main·workflow를 건드리지 않고 같은 PR #609의 제목만 `[Issue #999999] test: T3 invalid canonical trace`로 변경한다. 본문 `Refs #608`, Head 및 변경 파일 불변. metadata-only `edited` 원본과 Trusted가 잘못된 trace를 `FAIL/BLOCKED` 처리하고 잘못된 PASS가 없음을 실제 run/log/artifact로 입증한다.
5. 제목을 `[Issue #608] test: Trusted QA T3 canonical trace negative/recovery`로 원복. 정확한 기존 Full CI 증거가 같은 PR/Head/base/test-merge/attempt에서만 재사용되고 metadata-only가 E2E·Docker heavy Job을 새로 실행하지 않았는지 확인하며 Trusted 복구를 별도 입증한다.
6. T4~T7의 API·보안 부정 경로는 우선 **기존 기록과 단위 negative fixture**를 인증한다. 실제 API 403/404/429/경합을 강제하는 외부 파괴 실험은 하지 않는다. 필요한 별도 무해 PR은 증거가 부족한 경우에만 분리하고 무한 재시도 금지.
7. T8/T9 및 비용·원장·문서 매핑 완성 후, #609는 **미병합 close**, branch 삭제 여부 실제 확인. 이번 단계에서는 CI 시작 후 모니터링·결과 승인·변조 실험·PR close·Issue close 없음.

보호 원칙: 기본 브랜치 검증기에서만 Trusted 실행; PR checkout/미신뢰 코드 및 Secret 실행 금지; source `workflow_run` 원본과 commit→PR API의 **단일 정확 귀속** 필수. `pull_requests=[]`가 PASS 허용 조건은 아니며 인증 가능한 artifact+API가 있어야 한다. 실패·취소·skipped·unknown·오래된 attempt를 SUCCESS나 과거 FAIL 소급 PASS로 위장하지 않는다. metadata `edited`가 in-progress Full CI를 취소하거나 기아 상태를 만드는지도 분리 점검한다.

## 3. 역사적 증거 및 최신 실행 공백

| Test | 역사적 출처·실측 | **현재 default-main 기준** 상태/다음 증거 |
| --- | --- | --- |
| T1/T2 선행 | #606 / [PR #607](https://github.com/planner77/masterGantt/pull/607): source `38119659232.1` → Trusted `38120612831.1` T1 PASS; metadata `38121035255.1` → Trusted `38121084532.1` T2 PASS. 당시 base·validator `c81285741610ad28dc5d6b50f9bb97264970a79d`. | **역사적 PASS 보존**, 2026-10-24 코드로 새로 실행한 T1/T2로 해석 금지. |
| T3 | [Trusted 38034303492](https://github.com/planner77/masterGantt/actions/runs/38034303492): #396 canonical 불일치 BLOCKED (**#593 이전**) | **NOT TESTED**: 현행 정상→bad title 차단→정상 회복의 전체 remote 3단계 필요. |
| T4 | [Trusted 38034388826](https://github.com/planner77/masterGantt/actions/runs/38034388826): #396 `pull_requests=[]` 귀속 부족 BLOCKED (**#593 이전**) | **NOT TESTED**: 현재 validator의 artifact+commit→PR 단일 귀속과 복수/빈 후보·fork/누락 대조. |
| T5 | #609 [Full CI 38124453502.1/.2](https://github.com/planner77/masterGantt/actions/runs/38124453502) 양쪽 E2E shard4 120→110 실패, [Trusted 38125441885](https://github.com/planner77/masterGantt/actions/runs/38125441885) FAIL: source CI 미성공 (#593 이후 역사). #591 초기/후속도 원본 실패 FAIL 이력. | **원본 Full 실패에 대한 역사적 fail-closed 관측**. 최신 코드에서 cancelled/skipped/API 오류별 case는 **NOT TESTED**. |
| T6 | #609 [Full 38122085275.1](https://github.com/planner77/masterGantt/actions/runs/38122085275) 세 Required PASS 후 main 이동으로 QA mergeability/test-merge BLOCKED. | **역사적 stale 차단**, 현행 2~3 edited/head/base/attempt 경합은 **NOT TESTED**. |
| T7 | #593 관련 `scripts/test_qa_final_automated.py`의 protected rename, source provenance 부정 fixture가 존재한다. | **NOT TESTED**(현재 재실행/원격 로그 아직 없음); API 403/404/429는 unit mock으로만, 실제 오류를 강제로 유도하지 않음; non-PR은 N/A(reason)로 구분. |
| T8 | #606 선행 Trusted PASS 시에도 `manager_decision=NOT TESTED` 유지되었다. | **NOT TESTED**(현행 #609 전용 report/merge gate 비교 미실행). `independent_qa=N/A(Owner-managed)`; Owner exact-Head ACCEPT·HIGH 위험 수용이 없으면 `MERGE_READY=BLOCKED`여야 한다. |
| T9 | #571 뒤 코드·#767 E2E8·#770~#772 Fast/Targeted/Source 정책으로 기존 T1/T2 baseline과 실행 계약이 달라짐. | **NOT TESTED**(새 Head Required3/실제 shard 선택/현행 QA·Finalizer 영향/문서). 기존 Main/Finalizer 성공은 이번 검증 PR의 PASS 아님. |

중요: **의도한 `BLOCKED/FAIL`은 보안 합격의 후보 증거**이지만, 원래 T3 malformed trace를 직접 시험하지 않은 E2E 실패는 T3 PASS가 아니다. 원본 실패/attempt 및 코드 변경 원인을 각각 구별한다.

## 4. T4~T9 구체 검증·판정 체크리스트

| Test | 재현/검증 범위 | PASS 요건(실제 증거 없는 경우 NOT TESTED) |
| --- | --- | --- |
| T4 | `scripts/qa_final_automated.py`의 `trusted_source`, `verified_source`, source artifact `ci-pr-source-<run>-<attempt>`, commit→PR API 대조, 0/1/복수 PR, fork/권한 부족 mock | 정확히 PR 1개일 때만 허용; 그 외 BLOCKED 및 원인. Run/attempt, head/base/test-merge, trusted validator SHA·아티팩트 기록 |
| T5 | 3 Required 집계 실패, 원본 Full cancelled/skipped, QA 단독 rerun의 source attempt 확인; #595/#712 policy fixture | 원본 conclusion failure/cancelled/skipped에서 Trusted 허위 PASS 0. 과거 시도 성공으로 최신 실패를 덮지 않음 |
| T6 | 최신 Head push, base 이동, Title/Refs 연속 edited 2~3회, Full/reconcile/trusted attempt 교차 | 최신 Head/base/merge/attempt만 채택; 오래된 실행 SUPERSEDED; Full CI 의도치 않은 cancel 0, 영구 Pending 0. 실제 Job 식별 필수 |
| T7 | protected/rename source·target, policy path, GitHub push/non-PR, API 403/404/429와 지연 (mock) | protected HIGH 라우팅, non-PR 불필요 Trusted N/A, 증거 오류 BLOCKED, secret 권한·미신뢰 checkout 증가 0 |
| T8 | 현행 원본 Trusted report의 `automated_qa/independent_qa/manager_decision`와 merge gate 교차 | PASS/N/A/NOT TESTED와 MERGE_READY BLOCKED 분리. Owner marker 생성·위조·자동 승인 금지 |
| T9 | `scripts/test_qa_final_automated.py`, `scripts/test-pr-metadata-evidence.py`, `tests/python/test_ci_fast_development.py`, #593 policy checks, 최신 PR Quality/E2E/Docker 및 default-main Trusted | 실제 실행 status/Job/attempt 확인, 현행 E2E 실행 shard 수와 선택 정책 구분, docs·lifecycle·Finalizer 회귀 영향 별도 기록 |

## 5. 원격 증거 작성 표준

각 테스트/attempt에 대해 `test_id | verdict(PASS/FAIL/BLOCKED/NOT TESTED/N/A(reason)) | historical/current | PR | source_run_id.attempt | source_job IDs | trusted_run_id.attempt | PR_head | base | test_merge | trusted_validator_SHA | artifact_id | policy/result reason | event time | actual runner-minutes | elapsed time | URL | AC`를 Issue #608 및 이 원장에 추가한다. URL만으로 runner 비용/JSON 필드 내부 값을 확인한 것으로 표기하지 않는다.

### T3 live 증거 대장 (CI 시동 전 상태)

| Phase | Head/base/test merge | Source CI (attempt) | Trusted (attempt) | 평가 |
| --- | --- | --- | --- | --- |
| Ready 정상 기준 | **NOT TESTED** | **NOT TESTED** | **NOT TESTED** | 정상 Full/Trusted PASS 여부 미실측 |
| Edited 제목 오류 | **NOT TESTED** | **NOT TESTED** | **NOT TESTED** | 정상 기준 확보 후에만 실행 |
| Edited 원복 | **NOT TESTED** | **NOT TESTED** | **NOT TESTED** | 오류 차단 입증 후에만 실행 |

## 6. AC_TEST_COVERAGE, 문서 동기화, 완료 경계

- AC1: T3~T9 각각 역사적/현재 verdict 분리 — 이 원장에서 **현 시점 상태를 기록**, 최종 판정은 후속 원격 실행.
- AC2: 현재 T3 3단계 Full/Trusted 원격 실증 — **NOT TESTED**, Ready Full 시작만 이 단계에서 수행.
- AC3: T4/T5 source·attempt·validator 실측/FAIL 차단, API 모호성 — 역사적 일부, 현행 부족은 **NOT TESTED**.
- AC4: T6/T7 자동 부정 회귀 및 필요한 원격 실증 — 기존 테스트 경로 지정; 새 실증 **NOT TESTED**.
- AC5: T8/T9 QA/Owner·3 Required·문서·Finalizer 영향 실증 — 근거 경계 매핑; 현행 실측 **NOT TESTED**.
- AC6: T1/T2 역사 보존, 예외와 진짜 회귀 분리, #609 미병합/branch cleanup — 미병합, **cleanup NOT TESTED**.
- AC7: 실제 운영 결함 확인 시 재현·원인·기대값·출처와 함께 **별도 구현 Issue**. #571은 이미 종료됐으며 기존 실패는 역사적 원장으로 보존. 아직 새 결함 **NOT TESTED**.

**DOCUMENTATION_SYNC**
- `docs/exec-plans/active/ISSUE_608.md`: **UPDATED** (T3~T9 검증 매트릭스·이력·최신 Draft/Ready/E2E8 계약·원격 runbook).
- `public/qa-trusted-t3-issue-608.txt`: **UNCHANGED** (T3용 무해 표식).
- `AGENTS.md`, `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md`, `docs/TEST_PLAN.md`: **N/A (정책·검증기·운영 절차 변경 없음; 본 문서가 현재 계약을 참조)**.
- `DESIGN.md`, `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/ARCHITECTURE.md`: **N/A (제품 UI/API/DB/아키텍처 변경 없음)**.
- **원격 영구 기록:** 이 Work Packet은 미병합 실험 PR의 문서로서 main에 남지 않는다. 완료 후 최종 원장·AC 결과는 Issue #608 댓글에 독립적으로 기록하고 시험 PR은 삭제/close해야 한다.

## 7. 금지 작업

PR #609 또는 테스트 브랜치를 병합하지 않는다. PR #591/#396/다른 업무 PR을 수정하지 않는다. main push/Ruleset/GHCR/정식 release/Issue close, Owner ACCEPT 위조, validator/3 Required 체크 약화·SKIP 녹색화, 실패한 원본 소급 PASS 및 안전성 검증 없는 API 장애 주입 금지. 최초 Ready Full CI의 실제 성공과 Trusted PASS를 확인하기 전 malformed metadata 시험을 시작하지 않는다.
