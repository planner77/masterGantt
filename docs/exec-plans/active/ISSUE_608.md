# Issue #608 — T7 HTTP 오류별 Mock 회귀와 T8·T9 검증 Work Packet

Primary Issue: [#608](https://github.com/planner77/masterGantt/issues/608) · baseline main `dd7f4d86db06e8a10b8c86b5412ed319154011e0` · 작성 2026-10-24 KST.

## 1. 배경·범위·의사결정

- 본 Issue는 #593의 T3~T9 Trusted QA 검증. T3 실증은 [#609 미병합 종료](https://github.com/planner77/masterGantt/issues/608#issuecomment-6377000597) 및 AC2 완료, T1/T2와 시험 PR/브랜치 정리는 [#608 AC6 기록](https://github.com/planner77/masterGantt/issues/608#issuecomment-6377122490) 완료. T4/T5·T6/T7 잔여 미실증 상태는 [기존 비교](https://github.com/planner77/masterGantt/issues/608#issuecomment-6377225128)로 보존한다.
- 현재 `scripts/qa_final_automated.py::api` 및 `source_artifact`의 `urllib.error.HTTPError`는 이미 `BLOCKED`로 정규화된다. **실제 발견된 구현 결함은 없음**. 상태 코드별 단언이 없는 테스트 격차만 기존 `scripts/test_qa_final_automated.py`의 3개 신규 메서드로 보완한다. QA 검증기·Workflow 자체 변경, 권한/Token/Rate Limit 조작 및 실제 API 장애 주입은 0.
- 보호 `scripts/**` 테스트 변경은 `HIGH/OWNER_MANAGED`, `qa_required=true`, `manager_decision=NOT TESTED`, `release_required=false`, `release_authorized=false`. 역할: Manager 증거·AC·문서 단일 작성자, infra 테스트 작성/검증, qa_docs 기존 assertion·누락 회귀 대조. 독립 인적 QA는 `N/A(Owner-managed)`; 정확 Head Trusted PASS와 HIGH 위험 명시 수용/Owner 병합 허가는 별개.
- 변경 파일 정확 3개: `scripts/test_qa_final_automated.py`, 이 Work Packet `docs/exec-plans/active/ISSUE_608.md`, 누적 실패 원장 `docs/ISSUE_608_FAILURE_ANALYSIS.md`. 이전 T3 시험용 마커·브랜치/PR은 부활시키지 않고 제품/DB/CI/Ruleset/Tag/GHCR/Release 설정은 변경하지 않는다.

## 2. 직접·간접 영향 및 테스트 범위

| API/Producer | 직접 수용·신규 Assertion | 인접/반대 사례·미실증 |
| --- | --- | --- |
| `qa_final_automated.api()` | `test_t7_api_http_status_fail_closed`: GET/POST×403/404/429 정확 `BLOCKED`와 reason/code, Authorization fixture가 오류 이유에 노출되지 않음, `timeout=20` | 기존 `test_blocked_report_uses_current_rule_version`, `test_source_artifact_association_rejects_ambiguous_prs` 유지; 실제 Github API status는 NOT TESTED |
| `qa_final_automated.source_artifact()` | `test_t7_artifact_http_status_fail_closed`: immutable 이름 `ci-pr-source-41-1`·bounded 크기와 정확 artifact ID fixture, ZIP URL opener에 403/404/429를 주입해 `BLOCKED`·reason·no token leak 확인 | 기존 `test_source_artifact_redirect_never_exposes_token`의 same/cross origin 인증 전달/거부 그대로 |
| 두 경계의 Transport | `test_t7_api_artifact_transport_error_fail_closed`: URLError·TimeoutError·ValueError는 원본 증거 모호성 `BLOCKED`, 허위 PASS 0 | 운영 지연/권한 변경·실제 403/404/429는 NOT TESTED |
| full/metadata/trusted/Owner | 기존 `test_head_and_merge`, `test_metadata_full_ci_requires_matching_base`, `test_trusted_qa_only_retry_resolves_exact_prior_aggregate_jobs`, `test_low_medium_high_merge_readiness`, `scripts/test-pr-metadata-evidence.py` M1~M8 | T4 실시간 `pull_requests=[]`, T5 취소 가드 독립, T6 빠른 2~3 edited+Full 경합은 NOT TESTED이며 단위 API 회귀로 대체하지 않는다 |

## TEST_LIFECYCLE_REVIEW

- **사전 검색:** 기존 QA Python 34개 메서드 및 `test_source_artifact_redirect_never_exposes_token`(서명 URL/credential), `test_blocked_report_uses_current_rule_version`(generic API Blocked), `test_source_artifact_association_rejects_ambiguous_prs`(0/1/N PR·fork·repository), `test_metadata_full_ci_requires_matching_base`, `test_trusted_qa_only_retry_resolves_exact_prior_aggregate_jobs`(attempt), `test_low_medium_high_merge_readiness`(Manager); `scripts/test-pr-metadata-evidence.py` M1~M8 및 #711 지침.
- **의미별 판정:** `EXTEND` 기존 한 Python 파일 안에 status별/transport별 3개 고유 음성 테스트. 기존 redirect/token·generic report·provenance·workflow/attempt·Owner 테스트는 `KEEP_UNIQUE`; 중첩되는 generic network BLOCKED는 `PARTIAL_OVERLAP`이지만 status별 assertion을 generic test가 대체하지 못한다. ADD 신규 test file0 / CONSOLIDATE0 / RETIRE0 / 기존 테스트 삭제·skip·retry/timeout 완화0.
- **실행 증거:** 전 원본 검증 코드 `dd7f4d86db06e8a10b8c86b5412ed319154011e0`의 [Full PR #3203.1 Policy Python](https://github.com/planner77/masterGantt/actions/runs/40037395324/job/120700325957) 성공은 기존 34개 메서드의 과거 증거이며 새 3개를 실행했다고 주장하지 않는다. 연결된 GitHub API 작업 환경에 체크아웃/Runner가 없어 로컬 실제 Python, Vitest, Chromium, Docker 실행은 `NOT TESTED`. 새 PR의 정확 Head/Attempt에서 Policy Python 37개 메서드와 Required3/E2E8 및 default-main Trusted가 통과해야 공식 검증.
- **되돌림:** 새 PR 미병합 close로 test/docs 변경만 격리, 원본 실패 Run/Attempt/Artifact·QA 본체·권한·Secret 불변. 보호 테스트 PR은 Owner의 명시적 HIGH 잔여 위험 승인 전 자동 병합/Issue 종료 금지.

## 3. T8·T9 독립 원격 증거 (구 원본/새 Head 분리)

- **T8 Manager 승인 분리:** [PR #609 Full #3203.1](https://github.com/planner77/masterGantt/actions/runs/40037395324) Quality·Chromium8/8·Docker 3 Required PASS, [default-main Trusted #848.1](https://github.com/planner77/masterGantt/actions/runs/40040303870)와 [#850.1](https://github.com/planner77/masterGantt/actions/runs/40041336734) 자동 QA PASS. 각 실제 로그는 `independent QA: N/A(Owner-managed)` / `Manager ACCEPT: 수동 증거 필요, 자동 PASS는 MERGE_READY가 아님`을 출력. `scripts/qa_final_automated.py::manual_merge_readiness`는 `manager!=ACCEPT` 시 BLOCKED하며 Python `test_low_medium_high_merge_readiness`, `test_owner_managed_no_bypass_of_required_or_high_checks`가 실제 #3203.1 Policy PASS. #609는 `closed/merged=false`; GitHub mergeable 플래그와 인증 Owner 승인은 구분한다. Owner ACCEPT 자체는 미발급/NOT TESTED, 정책상 `MERGE_READY=BLOCKED` 유지.
- **T9 기존 회귀:** [Main #3202.1](https://github.com/planner77/masterGantt/actions/runs/40036926528) 최신 당시 main `dd7f4d86db06e8a10b8c86b5412ed319154011e0`, Quality/E2E 8 shard/Docker·Policy SUCCESS. [#608 PR #3203.1](https://github.com/planner77/masterGantt/actions/runs/40037395324) QA Preflight, Policy(Python 원본), TypeScript, ESLint, Vitest, 8-shard E2E, Docker, QA Automated, Trusted #848.1 SUCCESS. [Main workflow_run Trusted #847.1](https://github.com/planner77/masterGantt/actions/runs/40039821551) non-PR event라 Job SKIPPED, 예상된 `N/A(push)`. 이 출처는 새 T7 테스트 PR의 성공 증거가 아님.
- **Finalizer:** #608/이 시험·회귀 PR은 `release_required=false`이고 GHCR/버전/제품 변경 없음. 따라서 이 Issue로 새 Generic Release Finalizer/정식 GHCR을 실행하는 것은 `N/A(릴리스 대상 아님)`; 실제 Finalizer end-to-end 실행은 NOT TESTED/NOT RUN, 기존 규칙/CI Workflow/병합·릴리스 권한은 변경하지 않음.
- **잔여 위험:** 급속 edited 동시성 2~3회, T4 정확 `pull_requests=[]` runtime PR association, 실제 GitHub 403/404/429, 외부 독립 Owner 승인·운영 Secret 경계 실험은 이 PR 범위 밖으로 NOT TESTED 표시. T8/T9의 기존 원격 증거와 현재 보강 PR의 검증은 별도 결론으로 기록한다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_608.md`: UPDATED
- `docs/ISSUE_608_FAILURE_ANALYSIS.md`: UPDATED
- `docs/TEST_PLAN.md`: N/A(정책·테스트 선정 규칙 변경 없음, T7 신규 음성 테스트의 계획과 직접 AC 매핑은 이 Work Packet에 기록)
- `docs/exec-plans/active/PLAN.md`: N/A(기존 범위의 소규모 테스트 확장으로 다른 활성 계획의 선후 의존성 변경 없음)
- `AGENTS.md`: N/A(#711 테스트 검색·#704 단일 누적 원장과 Owner 지침을 그대로 준수, 새 정책 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(검증기/승인/Protected 정책 변경 없이 HTTPError 음성 테스트만 추가)
- `docs/CI_CD.md`: N/A(기존 Full/Metadata/Trusted workflow와 Required3/8-shard 동시성 정책 불변)
- `docs/GITHUB_OPERATIONS.md`: N/A(운영 API/권한/PR branch·Release 절차 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 원격 출처·Job/Attempt 증거 계약 불변, T7 세부는 본 Packet과 Issue 원장)
- `docs/ISSUE_LIFECYCLE.md`: N/A(Issue 종료/Finalizer/Owner/Manager 권한 경계 불변)
- `docs/SECURITY.md`: N/A(실제 인증·HTTP/Token·Validator 코드와 보안 정책 변경 없음)
- `DESIGN.md`: N/A(UI/UX/제품 설계 대상 없음)
- `docs/API.md`: N/A(애플리케이션 API 요청·응답 불변)
- `docs/DB_SCHEMA.md`: N/A(DB/schema/migration 변경 없음)

## AC_TEST_COVERAGE

- AC1: T3~T9의 성공/의도적 FAIL/BLOCKED/NOT TESTED/N/A 분리를 이 Work Packet·[#608 이슈 증거](https://github.com/planner77/masterGantt/issues/608)에 기록하고 전체 최종 수용 미완료.
- AC2: [T3 canonical 오류 차단→복구](https://github.com/planner77/masterGantt/issues/608#issuecomment-6377000597), #609 시험 PR 미병합, 완료 유지.
- AC3: [T4/T5 원본 source·attempt 증거와 Mock](https://github.com/planner77/masterGantt/issues/608#issuecomment-6377122490), live empty-array/취소 독립 guard 미실증.
- AC4: [T6/T7 이전 회귀와 원격 증거](https://github.com/planner77/masterGantt/issues/608#issuecomment-6377225128) + `test_t7_api_http_status_fail_closed`, `test_t7_artifact_http_status_fail_closed`, `test_t7_api_artifact_transport_error_fail_closed`; real 403/404/429 및 T6 같은 Head rapid edited 아직 NOT TESTED.
- AC5: T8 Trusted PASS와 Owner NOT TESTED 분리, T9 PR/Main 3 Required/E2E8·Policy 및 Finalizer `N/A(release_required=false)`; 새 보강 PR Head의 실제 CI/Trusted 결과 전 NOT TESTED.
- AC6: [T1/T2 역사 PASS·T3 시험 PR/branch 정리](https://github.com/planner77/masterGantt/issues/608#issuecomment-6377122490) 완료, 본 신규 보호 테스트 PR은 미병합 유지.
- AC7: 기존 QA 로직 결함 발견 없음; 테스트 갭은 이 Issue 하위 회귀로만 보완하고 별도 버그 Issue를 만들지 않는다. 최종 Owner 결과·문서/실패 원장 및 미실증 인계 후 판정.

## 4. 구현·QA·배포 경계

- **코드 수정:** `scripts/test_qa_final_automated.py` 하나. `qa_final_automated.py`, `.github/**`, `package.json`/lock, 앱/DB, Secret/권한 변경 없음. 이 Work Packet과 누적 원장만 함께 기록. Product version 기존 `0.130.2` 유지.
- **공식 검증:** 새 정확 Head Full PR CI / Python 37 tests/Quality/E2E8/8/Docker + default-main Trusted + 최신 main 정렬 + review thread0 + Owner HIGH 위험 수용 전 `MERGE_READY=BLOCKED`. 코드/문서 변경만으로 `T7 PASS`, `Issue #608 CLOSED`, `GHCR 게시`를 주장하지 않는다.
