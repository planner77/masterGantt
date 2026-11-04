# Issue #873 — Metadata-only rerun Artifact 출처와 Trusted QA N/A 계약 교정

- Primary Issue: https://github.com/planner77/masterGantt/issues/873
- 원본 사고: [PR #871](https://github.com/planner77/masterGantt/pull/871), [Full #3487.1](https://github.com/planner77/masterGantt/actions/runs/41768020806) SUCCESS / [Metadata #3488.1→2](https://github.com/planner77/masterGantt/actions/runs/41768107279) FAILURE→SUCCESS / [Metadata Trusted #1135.1](https://github.com/planner77/masterGantt/actions/runs/41771769958) BLOCKED.
- 시작 Main: `4dc4e972ec2c9b6b0d7080b66ffe961eb4b1aab3`, 앱 `0.141.1`. 본 Issue는 운영 CI/QA의 **출처 판정**만 변경. 제품·UI·DB/API·LLM·package/lock/OCI/GHCR/Release 정책 변경 없음.
- 위험/역할: **HIGH**, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=false`, `release_authorized=false`. 기존 3 Required Quality/E2E8/Docker, Trusted default-main read-only 검증·Owner 수동 ACCEPT 불변. 이번 인계는 새 Full PR CI **시작까지**이며 결과 모니터/merge/Main/GHCR/Issue 종료 미승인.

## 관측된 원본과 정확한 원인

1. 기존 [Full #3487.1](https://github.com/planner77/masterGantt/actions/runs/41768020806)은 PR Head `1b5f24aca5bfdfe45f530cf9796d347a284117a7`, Main Base `c048461c0dafc1e7fa89786b6abb7a322788ea60`에 대해 Quality/E2E8/Docker/QA Trusted SUCCESS. 과거 PASS를 이번 신규 SHA의 검증으로 가져오지 않는다.
2. 동일 PR의 Metadata-only #3488 Attempt 1에서 Metadata evidence는 이전 Full 진행 중으로 **DEFERRED/FAIL**, Required3 파생 FAIL. Attempt 2 `rerun-failed-jobs`는 Metadata evidence 및 Required3 SUCCESS. 그러나 `changes` Job은 **실제 재실행되지 않고** 1회차 started/completed `2026-11-04T03:35:54Z / 03:36:10Z`를 2회차 Job 표시에도 승계(새 ID/attempt 표시는 변경될 수 있음). Artifact `ci-pr-source-41768107279-1`만 실제 존재하고 `...-2`는 없음.
3. 기존 `trusted_source`는 항상 현재 `run_attempt`과 일치하는 출처 ZIP을 조회해 새 `...-2`를 요구하므로 Metadata Trusted #1135.1이 **Artifact 누락**에서 BLOCKED. 이것은 기존 Full QA의 실패 증거가 아니다. 최초 Metadata Trusted 실패 #1133.1은 실제 Metadata Run FAIL이므로 역사적 실패로 유지한다.
4. **수정 전제:** GitHub REST `/actions/runs/{id}/attempts/{attempt}/jobs`의 Job ID/attempt 표시가 2회차로 다시 붙어도 `started_at`/`completed_at` 값이 최초 실행 시각인 경우 승계된 Job이라는 제한적 증거로 취급. 서로 다른 원본 Job·다른 실제 실행 시각은 원본 ZIP 재사용을 허용하지 않는다.

## 설계/구현

- `scripts/qa_final_automated.py`: 기존 `source_artifact`·`verified_source`·`effective_run_jobs`·`verify_same_base_full_run`을 재사용하고 **`trusted_metadata_mode`**와 **`carried_metadata_event_source`**만 추가. Metadata-only 여부는 **현재 신뢰된 CI Run의 제목 + 실제 Job topology(메타데이터 검사 성공, Preflight/실제 Full 구현 Job 건너뜀, changes 성공)** 모두로 검증한다. 이름 문자열 단독 판정 금지.
- 최신 Attempt ZIP이 **물리적으로 없고**(만료/중복/손상 ZIP이 있는 경우 제외) `run_attempt>=2`, 원본 Attempt1과 최신 Attempt의 changes Job **started/completed/Run/Head SHA**가 같으며 변경 경로 Job 원본이 성공했을 때만 Attempt1 ZIP을 읽는다. `verified_source`에는 ZIP이 실제 생성된 `run_attempt=1`을 바인딩하고 기존 repository/PR/head/base/test-merge/commit→PR/merged-tree 검증을 전부 수행한다.
- Metadata-only 성공 시에만 Required3 성공·metadata evidence 성공 확인 및 `verify_same_base_full_run`로 독립 exact Full source/3 Required를 재검증한 뒤 Trusted **`automated_qa=N/A`**, `METADATA_ONLY_RECOVERY_NON_AUTHORITATIVE`, 원본 이벤트 artifact attempt와 Full source Run ID를 기록한다. 이 N/A는 Full Trusted SUCCESS 또는 Manager ACCEPT가 아니다.
- Full `[전체 검증]` Run은 현행처럼 **정확 최신 Attempt Artifact가 없으면 무조건 BLOCKED**. Metadata-only Run이라도 최초 Artifact/전송·토폴로지·PR/base/merge/새 Head·현재 ZIP 변조·Full 미성공이면 FAIL/BLOCKED. 정식 Trusted 원본 Full 출처/Required/문서/리뷰·Owner 게이트는 절대 약화하지 않는다.
- `.github/workflows/ci.yml`, `.github/workflows/qa-final-trusted.yml`, Ruleset·Secrets·명령·Runner·timeout·skip·artifact 업로드 경로는 변경하지 않는다. `AGENTS.md` 및 기존 QA 보호 규칙은 그대로다.

## TEST_LIFECYCLE_REVIEW

- **EXTEND** `scripts/test_qa_final_automated.py` 내 기존 #593/#595 metadata, source_artifact, effective_run_jobs 및 direct/default-branch/Full QA 보호 테스트. 새 `Issue873MetadataAttemptTests`는 모의 GitHub API에서 원본 #3488.1→2의 Job 승계·Artifact 최초 Attempt만 존재하는 Positive와 Full exact-source 검증·N/A 판정을 검사.
- **NEGATIVE**: 변경 경로 Job 재실행 시각 변경, head SHA/Run 변조·원본 Job 중복·실패, 현재 Attempt Artifact 존재하지만 만료, Full 모드 위장, Metadata 검사 미성공, 원본 PR/Head/Base 교차 불일치, Full run 실패/불명, 원본 attempt ZIP 읽기 불가. 어떤 상태에서도 자동 Full PASS·Manager ACCEPT 생성 금지.
- **KEEP_UNIQUE** `scripts/test-pr-metadata-evidence.py`, `scripts/test-pr-metadata-reconcile.py`, `scripts/test_qa_final_automated.py` 기존 계약, `scripts/verify-pr-metadata-evidence.py`, `scripts/reconcile-pr-metadata.py`, 8 Chromium shard/3 Required 및 전용 프로젝트 E2E/DB/security; 새 중복 CI/독립 Workflows 없음.
- 실행 가능 공식 환경: 기존 `CI/policy`가 `python3 scripts/test_qa_final_automated.py`·`python3 scripts/test-pr-metadata-reconcile.py`를 실행, 새 PR의 Full Quality/E2E8/Docker/Trusted가 정확 SHA로 재검증. 로컬 GitHub checkout/runner/Playwright/호스트 API 실행은 현재 API 기반 작업에서 **NOT TESTED**; 원격 Full 시작을 완료 조건으로 삼되 결과가 나올 때까지 PASS 선언 금지.

## DOCUMENTATION_SYNC

- `AGENTS.md`: N/A(기존 default-main trusted 경계와 코드 변경자의 HIGH Owner Managed 검증 지침 준수, 정책 원문 수정 없음)
- `DESIGN.md`: N/A(사용자 UI 및 Gantt 화면·디자인 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/ISSUE_LIFECYCLE_AUTOMATION.md`: N/A(기존 lifecycle/릴리스 authority, Owner 종료 순서 변경 없음)
- `docs/API.md`: N/A(업무 HTTP endpoint·DTO/인증 데이터 계약은 불변)
- `docs/DB_SCHEMA.md`: N/A(SQLite 스키마·마이그레이션 변경 없음)
- `docs/SECURITY.md`: N/A(인증과 private GHCR/LLM 보안 경계 변경 없음)
- `scripts/qa_final_automated.py`: UPDATED
- `scripts/test_qa_final_automated.py`: UPDATED
- `docs/exec-plans/active/ISSUE_873.md`: UPDATED
- `docs/ISSUE_873_FAILURE_ANALYSIS.md`: UPDATED

## AC_TEST_COVERAGE

- AC1: `scripts/test_qa_final_automated.py::Issue873MetadataAttemptTests.test_carried_original_source_and_exact_full_required3_yield_nonauthoritative_na` 및 기존 Full Trusted 테스트.
- AC2: `scripts/test_qa_final_automated.py::Issue873MetadataAttemptTests.test_source_carried_execution_must_not_have_rerun_or_changed_sha`와 최초 event/source 검증기 기존 테스트.
- AC3: `Issue873MetadataAttemptTests.test_missing_attempt_two_is_the_only_allowed_fallback`, `test_original_event_and_full_source_mismatch_fail_closed`, `test_bad_original_job_duplicate_or_missing_is_never_accepted` 및 기존 FAIL/CANCELLED/tampered source 테스트.
- AC4: `scripts/test_qa_final_automated.py`, `scripts/test-pr-metadata-evidence.py`, `scripts/test-pr-metadata-reconcile.py` KEEP_UNIQUE/EXTEND, 신규 workflow/skip/retry/assertion 약화 없음.
- AC5: 변경된 CI/QA/GitHub/Remote/TEST 문서 및 [누적 사고 원장](../../ISSUE_873_FAILURE_ANALYSIS.md)의 원본 Job/Artifact/Run·시각 대조.
- AC6: CI HEAD/BASE/REQUIRED3/Trusted/Review/Owner 대조, HIGH OWNER_MANAGED, `release_required=false`·`release_authorized=false`로 PR CI 시작만.

## 잔여 위험 및 단계 경계

- 새 경로는 신뢰된 Job이 과거 Job을 재실행하지 않았다는 시각·SHA 근거가 충분한 metadata-only에만 적용된다. GitHub API가 실제 재실행/원본 증거를 식별할 수 없으면 **BLOCKED**. 새 UI/LLM/DB 기능을 추가하지 않으므로 정식 앱 버전은 `0.141.1` 유지.
- 이번 사용자 지시는 코드/문서/원장/리뷰·충돌 후 **PR CI 시작**까지. CI SUCCESS, Trusted QA, 병합, GHCR, 이슈 종료는 별도 검증·승인 전까지 `NOT TESTED`이다.
