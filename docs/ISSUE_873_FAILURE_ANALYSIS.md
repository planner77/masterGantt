# Issue #873 — Metadata-only Trusted QA Artifact 출처 실패 / 누적 실패 원장

- Primary Issue: https://github.com/planner77/masterGantt/issues/873
- 정규 원장: 본 파일 하나. 원본 사고는 #865의 PR #871에서 발생했으며 #865 누적 PR 실패 원장을 대체·삭제하지 않는다.
- 분석 시점: 2026-11-05 KST, 기준 Main `4dc4e972ec2c9b6b0d7080b66ffe961eb4b1aab3` / app `0.141.1`.
- 출처: [Issue #873](https://github.com/planner77/masterGantt/issues/873), `AGENTS.md`, `docs/PR_CI_FAILURE_TRIAGE.md`, `docs/QA_REVIEW_POLICY.md`, `scripts/qa_final_automated.py`, `scripts/reconcile-pr-metadata.py` 및 GitHub Actions Run/Job/Artifact API.

## 1. 원본 Run·Attempt별 관측값과 인과관계

| 출처 / 시점(UTC) | 원본 SHA·Run/Attempt·Job | 실제 결과 | 직접/파생 및 불변성 |
| --- | --- | --- | --- |
| PR #871 Full #3487.1 | [Run 41768020806.1](https://github.com/planner77/masterGantt/actions/runs/41768020806), Head `1b5f24aca5bfdfe45f530cf9796d347a284117a7`, Base `c048461c0dafc1e7fa89786b6abb7a322788ea60` | Quality/E2E8/Docker/QA Automated SUCCESS | 독립 권위 Full 증거; 새 Issue #873 PR에 재사용 불가 |
| PR #871 Full Trusted #1134.1 | [Run 41771629516.1](https://github.com/planner77/masterGantt/actions/runs/41771629516), Job `126382414660` | SUCCESS | Full trusted PASS, metadata Run의 새로운 PASS가 아님 |
| PR #871 Metadata #3488.1 | [Run 41768107279.1](https://github.com/planner77/masterGantt/actions/runs/41768107279), metadata Job `126371263194` | **FAILURE** | 당시 Full Run `41768020806`이 `in_progress`라 `PR metadata evidence: DEFERRED` (2026-11-04 03:36:20 UTC); metadata-only aggregate Required3/QA는 파생 FAIL. 원본 FAIL 유지 |
| 최초 Trusted #1133.1 | [Run 41768207531.1](https://github.com/planner77/masterGantt/actions/runs/41768207531) | FAILURE | 당시 metadata CI 미성공으로 Fail-closed, 정상 판정으로 원본 불변 |
| Metadata #3488.2 | **동일** [Run 41768107279.2](https://github.com/planner77/masterGantt/actions/runs/41768107279), Metadata Job `126382575607`, Quality `126382696701`, E2E `126382696602`, Docker `126382696500`, QA `126382730847` | SUCCESS | `rerun-failed-jobs`가 Full 성공 확인 후 metadata 및 Required3 재판정 완료, 새로운 전체 E2E8 실행·새 Full QA PASS 아님 |
| Metadata Trusted #1135.1 | [Run 41771769958.1](https://github.com/planner77/masterGantt/actions/runs/41771769958), Job `126382866711` | **FAILURE / BLOCKED** | 직접 원인: `원본 CI PR event artifact 누락/중복/만료`, 이 후속 Trusted 실패는 기존 Full Trusted 성공을 무효화하는 원본 증거가 아님 |

## 2. Attempt2 변경 경로 Job이 재실행되지 않았다는 실제 증거

- Actions `attempts/1/jobs`의 `변경 경로 판정` Job `126371165945`은 `started_at=2026-11-04T03:35:54Z`, `completed_at=2026-11-04T03:36:10Z`, `conclusion=success`. 원본 `ci-pr-source-41768107279-1` Artifact ID `13293825695`는 `2026-11-04T03:35:57Z` 생성, `expired=false`.
- Actions `attempts/2/jobs`에 보이는 `변경 경로 판정` Job `126382614107`은 새 Job ID와 `run_attempt=2`로 표시되나 **started/completed가 각각 03:35:54Z / 03:36:10Z로 최초 Job과 완전히 동일**하다. Job 로그의 `ci-pr-source-41768107279-1` 보존은 1회차 03:35:57Z에 완료되었으며 Attempt2를 위한 새 Source Artifact 업로드는 보이지 않는다.
- 원본 GitHub `actions/runs/41768107279/artifacts` inventory에는 `qa-final-automated-41768107279-1`, `qa-final-automated-41768107279-2`, **`ci-pr-source-41768107279-1`**만 존재하며 `ci-pr-source-41768107279-2`가 없다. 원래 changes source Job은 **실제 재실행이 아니라 성공 출력이 후속 Attempt에 승계**된 것으로 판단한다.
- 기존 `trusted_source`는 Run Attempt2의 `ci-pr-source-41768107279-2`를 무조건 조회하고 최초 ZIP `...-1`의 유효성·변경 경로 Job 승계 여부를 보지도 못한 채 BLOCKED. 우회 코드/잘못된 Fixture가 아니라 **metadata-only selective rerun와 증거 수명 계약의 불일치**가 직접 원인이다.
- Test-merge SHA는 별도 source ZIP 내부 값이어서 외부 Job Summary만으로 단정하지 않는다. 새 검증에서는 정상 `source_artifact`→`verified_source`가 Git Tree·PR Head/Base/Test merge를 독립 확인하도록 유지한다.

## 3. 실패 분류 / 과거 유사 사례와 Cross-run 매트릭스

| 사건 | 최초 원인/판정 | 현재 연관성 | 교정 및 검증 경계 |
| --- | --- | --- | --- |
| #865 PR #871 Full #3487.1 / Trusted #1134.1 | 성공한 제품·보안 전체 CI | **독립 SUCCESS**. 새 #873 검증 코드 자체의 PASS로 전용 금지 | `verify_same_base_full_run`으로 원본 Full 3 Required 재검증 |
| #865 Metadata #3488.1 / Trusted #1133.1 | Full 진행 중 DEFERRED 및 선행 Run FAIL | **역사적 정상 FAIL**, 소급 변경 불가 | 최초 CI 실패를 자동 N/A/PASS로 변경 금지 |
| #873 직접 원인 #3488.2 / Trusted #1135.1 | Attempt2 source ZIP 부재, Attempt1 changes Job carry-over | **새로운 provenance contract 오류** | 원본 changes 실제 실행시간·Run/Head 일치와 원본 ZIP 인증 후 metadata-only N/A |
| #593/#595/#600/#712 | 원본 증거·Attempt별 Job·Full 최신 source/metadata post-merge 구분 | 독립 보안/QA 소비자, 삭제 금지 | 기존 회귀 전부 KEEP_UNIQUE; Full exact Artifact 예외 금지 |

**실패 계약 합집합:** `scripts/qa_final_automated.py::trusted_source/source_artifact/verified_source/effective_run_jobs/verify_same_base_full_run`; `scripts/test_qa_final_automated.py`; `scripts/test-pr-metadata-evidence.py`; `scripts/test-pr-metadata-reconcile.py`; `.github/workflows/ci.yml` 및 `qa-final-trusted.yml`의 신뢰 원본/Job topology. 제품 Chromium/SQLite 결함은 관측되지 않았다.

## 4. 구현·보완 범위

- **EXTEND/REPAIR** `scripts/qa_final_automated.py`: `trusted_metadata_mode`(Trusted Base의 실제 Metadata/Preflight/Full 구현 Job topology 인증)와 `carried_metadata_event_source`(새 Artifact가 실제 없고 metadata-only 성공·원본 changes Job 시각/SHA/Run 동일일 때만 원본 `ci-pr-source-…-1`을 엄격 확인)를 도입한다. 기존 `source_artifact`/ZIP untrusted validation·`verified_source`/same-base full 인증·Full latest attempt 필수는 불변.
- metadata-only 성공은 별도 `METADATA_ONLY_RECOVERY_NON_AUTHORITATIVE` / `automated_qa=N/A`로 명시하고 `prior_full_run_id`, `source_event_artifact_attempt`, 원본 Run/Attempt 기록. `Manager ACCEPT`·Full QA PASS로 오해하지 않는다. 실패, 누락·타 repo/Run/PR, 다른 Head/Base/Tree, 만료·변조·중복 현재 Artifact, 실제 rerun된 changes, Full 실패·CANCELLED→모두 BLOCKED/FAIL.
- **EXTEND** `scripts/test_qa_final_automated.py::Issue873MetadataAttemptTests`에 실제 #3488 Fixture의 success/negative 테스트 5건을 추가하고 기존 source ZIP/HTTP 오류·원본 SHA·Full/Trusted·metadata tests 그대로 유지한다.
- **문서 UPDATED** `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md`, `docs/TEST_PLAN.md` 및 [Work Packet](exec-plans/active/ISSUE_873.md). `AGENTS.md`는 기존 보호 규정 준수/N/A.
- **무변경:** `.github/workflows/ci.yml`, `.github/workflows/qa-final-trusted.yml`, `scripts/reconcile-pr-metadata.py`(기존 원본 `rerun-failed-jobs` 정책 유지), 다른 제품 파일/LLM/DB/API/버전/Ruleset·Quality/E2E8/Docker/timeout/retry/skip/QA 신뢰 보호 규정.

## 5. 실제 검증 / 원격 PR 인계

- 실제 GitHub API: Attempts1/2의 최초 changes Job started/completed 및 artifact inventory를 독립적으로 조회해 위 원본을 증명. **GitHub 기록만으로 제품 리그레션 PASS를 주장하지 않음.**
- 코드와 테스트는 GitHub Git Data API로 현재 Main Tree에서 분기해 단일 논리적 변경으로 게시한다. 로컬 checkout/Python test/Next/E2E/Docker는 이 도구 경로에서 **NOT TESTED**, 테스트는 새 Full PR CI Policy Job에서 실행될 예정.
- 새 PR의 High Owner Managed, `qa_required=true`, `release_required=false`, `release_authorized=false` 유지. PR CI/Trusted exact Head 결과 전 `NOT TESTED`, 리뷰/충돌 조회 후 PR CI **시작만** 확인. Main/Release/GHCR/Issue #873 종료와 과거 #865 source·Release 재실행 없음.
