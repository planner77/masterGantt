# Issue #608 — Trusted QA T3~T9 운영 검증 Work Packet

> 기준일: 2026-10-24 KST. 검증 범위는 #593 후속 T3~T9; 이 PR #609는 **T3 전용, 절대 병합하지 않는** 원격 실험 수단이다. 본 문서의 날짜·기록은 최초 #609 실패의 증거를 덮어쓰지 않는다.

## 1. 출처와 작업 경계

- Primary Issue [#608](https://github.com/planner77/masterGantt/issues/608); #593 개선 및 #606/T1·T2 원격 긍정 경로 PASS가 선행이다.
- 2026-10-24 최초 정렬 기준 main `427d22245fb8e11254b2424ea5147ccbd5766979` (#3201.1의 역사적 base). **이번 F608-004 보완 최신 main `dd7f4d86db06e8a10b8c86b5412ed319154011e0`, app `0.130.2`, Zod `4.6.7`**은 아래 REWORK에 별도 기록한다. 이전 T3 PR Head `6c27d64be4903147fa36283d3c32ab8fe6f175c6`, 옛 base `ac2a3f69d09da1cbc7e4f833da0fa0515434f895`는 **과거 실행 출처**로만 사용한다. Ready 실행 직전 live base·head·test-merge를 다시 검증한다.
- 기존 [#571](https://github.com/planner77/masterGantt/issues/571)은 corrective PR #611 및 Main CI/Finalizer 성공으로 종료. T3 #2497 실패를 과거의 정상 PASS로 소급 변경하지 않는다. 전체화면 회귀 수정 뒤의 #609 새 Head CI는 별도로 증명한다.
- 변경 파일은 `docs/exec-plans/active/ISSUE_608.md` (검증 계획), `docs/ISSUE_608_FAILURE_ANALYSIS.md` (누적 실패 원장), `public/qa-trusted-t3-issue-608.txt` (기존 무해한 정적 표식) **세 개만**. 앱, QA validator, workflow, 보안·권한·Ruleset, DB/API/버전, GHCR, main에 변경 없음.
- 변경 파일 위험 LOW; 오류 유도·경합을 포함한 **운영 실험 위험 HIGH**. `qa_method=OWNER_MANAGED`, `qa_required=true`, `manager_decision=NOT TESTED`, `release_required=false`, `release_authorized=false`. Owner 최종 ACCEPT/병합·릴리스 권한을 기계 PASS로 승격하지 않는다.
- `AGENTS.md`, `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md`, `docs/TEST_PLAN.md` 및 #593/#595/#598/#600/#712/#770/#771/#772 지침을 우선한다. 역사적 문서의 six-shard 수치를 현재 계약으로 오용하지 않는다.

## 2. 현재 CI 계약과 실행 순서

2026-10-22 #771 이후 **Draft** `opened/synchronize`는 Fast Development 보조 경로이며 세 Required aggregate는 `DRAFT_BLOCKED`; 이를 Full PASS로 인정할 수 없다. 현행 **Ready** `ready_for_review`는 `FINAL_FULL`을 시작한다. #767 이후 기본 Full E2E는 **8 shards**이며 #772의 LOW targeted 선택이 실제 적용되면 Full E2E8/8 자체의 실증 여부를 별도 구분한다.

1. 이 검증 PR의 Head를 최신 main에 안전하게 정렬(기존 T3 표식/Work Packet과 누적 실패 원장을 함께 보존, merge/lease로 갱신), diff가 원래 PR 고유 세 파일(Work Packet·누적 실패 원장·기존 정적 표식)인지 재확인한다. 정상 제목에 `Issue #608`, 본문에 정확히 하나의 독립행 `Refs #608` 유지. 리뷰 스레드·mergeability·검증 run 귀속을 점검한다.
2. Ready Full `#3200.1`의 문서 구조 FAIL 이후 `#3201.1`은 Preflight/TS/ESLint/Vitest PASS이나 Zod 4.6.2 Production Dependency Audit High로 FAIL. 최신 main #556의 안전한 Zod 4.6.7 및 나머지 변경을 ancestry/tree로 보존한 뒤 기존 Ready PR에 단 한 번의 `synchronize FINAL_FULL` CI를 시작한다. 새 정확 Head의 Security Audit/Required3/Trusted 성공은 확인 전 NOT TESTED.
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

### T3 live 증거 대장 (Ready #3200.1 문서 Preflight FAIL 이후)

| Phase | Head/base/test merge | Source CI (attempt) | Trusted (attempt) | 평가 |
| --- | --- | --- | --- | --- |
| Ready 정상 기준 | Head `b29eb44d44d7db98336b2cf6816d6a977ebc539a` / base `427d22245fb8e11254b2424ea5147ccbd5766979` / merge `e0bd16b7329a047b9a4ecd04092e5700e8d3f8c7` | [#3200.1](https://github.com/planner77/masterGantt/actions/runs/40035409513) DOCUMENTATION_SYNC Preflight FAIL | **NOT TESTED** | 정확 Head Full/Trusted PASS 미확보; 문서 구조 교정 후 새 `synchronize` Full 필요 |
| Edited 제목 오류 | **NOT TESTED** | **NOT TESTED** | **NOT TESTED** | 정상 기준 확보 후에만 실행 |
| Edited 원복 | **NOT TESTED** | **NOT TESTED** | **NOT TESTED** | 오류 차단 입증 후에만 실행 |

## TEST_LIFECYCLE_REVIEW

**사전 검색 범위(#711):** 최신 main `427d22245fb8e11254b2424ea5147ccbd5766979`의 기존 Policy Python, Playwright E2E 및 #593/#595/#629/#712 관련 테스트를 소스 파일/메서드/단언별로 읽기 전용 확인. 파일명만으로 중복을 확정하지 않고 기존 `AC_TEST_COVERAGE`의 AC1~AC7을 재사용한다.

- **Policy canonical/Docs (AC1/AC2/AC7, KEEP_UNIQUE):** `scripts/test_qa_final_automated.py::test_primary_issue_and_injection`은 정확 `[Issue #580]`+독립행 `Refs #580` 반환과 `Refs #565` 불일치 BLOCKED를 단언하며, `::test_documents_and_ac`는 `docs_gate` 문서 매핑의 긍정과 AC/required-doc 누락 BLOCKED를 확인한다. `scripts/test_qa_preflight.py::test_replay_550_2373_primary_title_refs_before_heavy`, `::test_replay_626_2522_missing_required_docs_before_heavy` 및 `::test_ready_for_review_same_sha_and_draft_fail_closed`가 제목·문서·Draft/Ready 부정/긍정 사례를 구분한다. 이번 #3200.1의 `## DOCUMENTATION_SYNC` 누락은 **이 검사기가 정상 차단한 실제 문서 실수**이며 테스트 삭제·Assertion 완화 대상이 아니다.
- **source·metadata/stale (AC3/AC4/AC5, KEEP_UNIQUE/PARTIAL_OVERLAP):** `scripts/test_qa_final_automated.py::test_source_artifact_association_rejects_ambiguous_prs`는 source `pull_requests=[]`에서도 단일 artifact+API 귀속만 허용하고 2 PR/불일치 base/head/attempt/fork를 차단한다. `::test_metadata_full_ci_requires_matching_base`, `::test_metadata_reuses_exact_full_run_after_qa_only_retry`, `::test_trusted_workflow_definition_never_checks_out_pr_code`는 attempt·base·default-branch 실행을 개별 검증한다. `scripts/test-pr-metadata-evidence.py`의 `M7-stale-head`, `M8-metadata-only`, `T6-multiple-associated-PRs`는 이전 Full 증거 잘못 재사용을 거부한다. Mock은 **실제 default-main Trusted workflow_run과 GitHub Actions retry/edited 경합 실행을 증명하지 못하므로** 원격 T3~T7 검증과 부분 중첩만 있다.
- **브라우저 회귀 (AC4/AC5/AC6, KEEP_UNIQUE):** `tests/e2e/project-gantt-fullscreen.spec.ts`(기존 실패 지점 약 188행)는 Fullscreen 진입·종료 각각 native chart `scrollLeft`를 기존 `chartScroll`과 `toBeCloseTo(..., 0)`으로 비교하고 native vertical, Grid/Bar 정렬/선택도 보존한다. #2497.1/.2의 120→110은 진짜 원격 assertion 실패, #571 corrective #611 이전 기록. 이번 문서 수정은 해당 실제 브라우저 시험의 대체가 될 수 없어 **KEEP_UNIQUE**, 새 Head에서 재검증 필요.
- **운영 의존성 보안 경계 (AC4/AC5/AC7, KEEP_UNIQUE):** `.github/workflows/ci.yml` Policy Job은 `npm ci`와 `npm audit --omit=dev`로 고위험 운영 패키지를 실제 차단한다. #3201.1 `zod@4.6.2` <4.6.6 High [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)를 관측했다. [#556 F-002](../../ISSUE_556_FAILURE_ANALYSIS.md) 및 [Security](../../SECURITY.md)에서 선행 교정한 정확 `zod@4.6.7`·lock/SRI 및 역사 캡처 회귀를 최신 main에서 인수한다. 보안 검사를 끄거나 경고를 허용하지 않는다. Mock Docs Gate나 T3 실험과 달라 `KEEP_UNIQUE`이며 새 Head 실제 `npm audit`/Chromium 호환은 **NOT TESTED**.
- **추가·확장·통합·폐기 판단:** 신규 제품/Policy validator 동작이나 assertion 변경 **0**이므로 `ADD=0`, `EXTEND=0`, `CONSOLIDATE_CANDIDATE=0`, `RETIRE_CANDIDATE=0`. 기존 Policy/브라우저 테스트는 환경·입출력·source provenance가 달라 의미적으로 중복이 아니다. 유사 실패 원장/검증 문서만 보완, 기존 테스트 삭제·Skip/Retry/Timeout 확대 금지.
- **검색 및 검증 상태:** 위 소스 원문 메서드/단언 **정적 확인 완료**, 새 Work Packet의 H2/AC 문서 계약을 정적 대조한다. 실제 로컬 Python/Vitest/Playwright/Docker 실행은 `NOT TESTED`, 원격 새 `FINAL_FULL` 및 default-main Trusted도 완료 전 `NOT TESTED`. 기존 `#3200.1`은 Preflight 오류로 원격 E2E **NOT RUN**, 과거 #2497 실패를 PASS로 소급하지 않는다.
- **잔여 위험/rollback:** 실제 GitHub `edited` 트리거·원본 run+attempt/test-merge/validator, API 응답 지연·권한 403/429, 8-shard E2E 안정성은 Unit/mock으로 입증할 수 없다. T3 정상 Full+Trusted PASS 전 malformed title 실험 금지. 오류 교정은 문서 2개만 revert 가능하며 비보호 marker/제품/Policy/QA/Ruleset·Owner 인수 불변. 안전한 close/branch deletion은 T3~T9 증거가 Issue #608에 기록된 뒤 별도 진행한다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_608.md`: UPDATED
- `docs/ISSUE_608_FAILURE_ANALYSIS.md`: UPDATED
- `AGENTS.md`: N/A(#704 누적 실패 및 #711 Test Lifecycle 기존 규정만 적용하고 정책 자체는 변경하지 않음)
- `docs/QA_REVIEW_POLICY.md`: N/A(Trusted QA 위험 승인 및 기본 브랜치 보안 경계 불변)
- `docs/CI_CD.md`: N/A(기존 Required3와 Draft Ready Full CI 정책·Workflow 변경 없음)
- `docs/TEST_PLAN.md`: N/A(기존 Test Lifecycle 및 회귀 테스트의 실행 의미를 변경하지 않음)
- `docs/GITHUB_OPERATIONS.md`: N/A(운영 설정 및 Ruleset 권한 불변)
- `docs/REMOTE_VALIDATION.md`: N/A(현재 원격 T3 검증 계획의 인수 기준만 본 Work Packet에 기록)
- `docs/ISSUE_LIFECYCLE.md`: N/A(검증 PR은 미병합이고 Issue 종료 및 Owner 승인 진행하지 않음)
- `DESIGN.md`: N/A(제품 UI와 UX 계약 변경 없음)
- `docs/API.md`: N/A(서버 API 및 요청 응답 불변)
- `docs/DB_SCHEMA.md`: N/A(SQLite 스키마 및 데이터 변경 없음)
- `docs/ARCHITECTURE.md`: N/A(제품 구조와 코드 변경 없음)

변경하지 않은 기존 `public/qa-trusted-t3-issue-608.txt` 정적 표식은 시험 범위에서 유지한다. `UPDATED` 두 문서는 이번 보완의 실제 수정 파일이며, 승인/QA 검증기를 변경하지 않는다.

## AC_TEST_COVERAGE

- AC1: T3~T9 각각 역사적/현재 verdict 분리 — 이 원장에서 **현 시점 상태를 기록**, 최종 판정은 후속 원격 실행.
- AC2: 현재 T3 3단계 Full/Trusted 원격 실증 — **NOT TESTED**, Ready Full 시작만 이 단계에서 수행.
- AC3: T4/T5 source·attempt·validator 실측/FAIL 차단, API 모호성 — 역사적 일부, 현행 부족은 **NOT TESTED**.
- AC4: T6/T7 자동 부정 회귀 및 필요한 원격 실증 — 기존 테스트 경로 지정; 새 실증 **NOT TESTED**.
- AC5: T8/T9 QA/Owner·3 Required·문서·Finalizer 영향 실증 — 근거 경계 매핑; 현행 실측 **NOT TESTED**.
- AC6: T1/T2 역사 보존, 예외와 진짜 회귀 분리, #609 미병합/branch cleanup — 미병합, **cleanup NOT TESTED**.
- AC7: 실제 운영 결함 확인 시 재현·원인·기대값·출처와 함께 **별도 구현 Issue**. #571은 이미 종료됐으며 기존 실패는 역사적 원장으로 보존. 아직 새 결함 **NOT TESTED**.

- **Review P1 연결:** `TEST_LIFECYCLE_REVIEW`에서 기존 Policy canonical/Docs↔AC1/2/7, source·stale↔AC3/4/5, 실제 브라우저 회귀↔AC4/5/6의 기존 assertion 및 mock/remote 미커버 영역을 근거로 `KEEP_UNIQUE/PARTIAL_OVERLAP` 판정하였다. Test 추가/삭제 없으며 원격 Required3와 T3 부정 실험은 독립 증거로 계속 요구한다.
- **누적 F608-004 (AC4/AC5/AC7):** [CI #3201.1](https://github.com/planner77/masterGantt/actions/runs/40036338192) Preflight·TypeScript·ESLint·Vitest PASS, npm production dependency audit의 Zod High 보안 실패로 Fast Gate/Required3/QA Final 파생 FAIL; E2E8/Docker/Next Build NOT RUN. [실패 원장](../../ISSUE_608_FAILURE_ANALYSIS.md)에 직접 오류·과거 실패·최신 main #556 수정 인수·미검증 경계 보존.
- **누적 F608-003:** [PR CI #3200.1](https://github.com/planner77/masterGantt/actions/runs/40035409513)의 `## DOCUMENTATION_SYNC` 구조 누락으로 QA Preflight FAIL; Unit/8-shard/Docker 실제 Job은 SKIPPED/NOT TESTED. 역사적 #2493/#2497 및 신규 #3199 Draft 기대 FAIL을 별도 [#608 실패 원장](../../ISSUE_608_FAILURE_ANALYSIS.md)에 보존한다.

## 7. 금지 작업

PR #609 또는 테스트 브랜치를 병합하지 않는다. PR #591/#396/다른 업무 PR을 수정하지 않는다. main push/Ruleset/GHCR/정식 release/Issue close, Owner ACCEPT 위조, validator/3 Required 체크 약화·SKIP 녹색화, 실패한 원본 소급 PASS 및 안전성 검증 없는 API 장애 주입 금지. 최초 Ready Full CI의 실제 성공과 Trusted PASS를 확인하기 전 malformed metadata 시험을 시작하지 않는다.


## 8. REWORK F608-004 — #3201.1 Zod High npm audit / 최신 main 재정렬 (2026-10-24)

- **원본 실패:** [CI #3201.1 / Run 40036338192.1](https://github.com/planner77/masterGantt/actions/runs/40036338192), `pull_request.synchronize FINAL_FULL`, Head `e76270aa5ddd25c05f38ce5b3e99ba133636b62e`, base `427d22245fb8e11254b2424ea5147ccbd5766979`, original test merge `7da06fb2611e6ea933691757e23ec0ada9db2d06`. 성공했던 Preflight Job `120696722896`, TypeScript `120696807254`, ESLint `120696807223`, Vitest `120696807188`와 Policy **실패** Job `120696807185`의 결론을 구별한다.
- **원인:** Policy `npm audit --omit=dev`에서 Zod 4.6.2의 High GHSA-mrhx-c7xc-m3w5(`zod <4.6.6`)를 검출했다. Fast Gate Job `120697386591` FAIL, Required Quality/E2E/Docker `120697450242/120697450184/120697450214` FAIL 및 QA Final `120697485779` FAIL은 연쇄 차단. 실제 Playwright 8 shards·Docker smoke·Next Build는 **SKIPPED / NOT RUN**, 앱 결함 근거 없음.
- **교정:** #556의 별도 보안 패치가 이미 최신 `main` `dd7f4d86db06e8a10b8c86b5412ed319154011e0`의 `package.json`/lock에 앱 `0.130.2`, `zod=4.6.7`로 반영되었음을 조회했다. PR이 새 보호 package 파일을 별도로 변경하지 않고 최신 main **전체 tree 및 ancestry**를 인수하도록 PR branch를 fast-forward 정렬한다. PR만의 변경은 원래 비보호 Work Packet·실패 원장·정적 marker 세 파일뿐이다. 실제 설치/보안 Audit PASS 및 새 Head 8-shard 성공은 원격 새 Run 전 **NOT TESTED**.
- **원인 구분:** F608-003 이전 `DOCUMENTATION_SYNC` FAIL은 #3201 Preflight PASS로 교정이 관측되었다. 구 #2497 E2E 120→110 회귀와 보안 Audit 오류를 같은 실패로 취급하지 않는다. 이전 run의 성공/실패·Attempt/Trusted 귀속 원본 변경 금지.
- **검토:** 기존 `TEST_LIFECYCLE_REVIEW`는 Python mock·정책 source·실제 Playwright를 `KEEP_UNIQUE/PARTIAL_OVERLAP`로 보존하고, npm 고위험 의존성 Audit 경계 `KEEP_UNIQUE`를 추가 연결했다. 새 테스트 삭제/skip/timeout·정책 Severity 완화0. Codex P1은 이전 Head에서 해결되었고 최신 미해결 review thread/충돌은 게시 전 다시 확인한다.
- **Document Sync:** 본 Work Packet + `docs/ISSUE_608_FAILURE_ANALYSIS.md`만 PR에서 UPDATED. `AGENTS.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`, `docs/QA_REVIEW_POLICY.md`, `DESIGN.md`, `docs/API.md`, `docs/DB_SCHEMA.md` 등의 다른 문서는 PR 단독 정책/제품 변경이 없어 기존 `N/A(reason)` 유지; main #556 개선은 보존하되 새 #608 변경이라고 주장하지 않는다.
- **검증·승인:** `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`, `release_required=false`, `release_authorized=false`. 메타데이터 실험은 최신 Full CI와 default-main Trusted PASS 이후에만 실행한다. PR #609는 **병합 금지**; Main/Ruleset/GHCR/Finalizer/Issue 종료 모두 비대상. 새 PR CI는 **시작까지만 확인**하고 모니터링하지 않는다.
