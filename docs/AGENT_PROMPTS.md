## Issue #593 — Trusted QA 원본 이벤트 귀속 및 metadata 재검증 (2026-10-10)

- `workflow_run.pull_requests=[]`를 PR 실행명/제목에서 추측하지 않는다. 원본 `CI`의 PR 이벤트에서 **checkout 전에** 만든 `ci-pr-source-<run_id>-<attempt>` artifact를 기본 브랜치 검증기가 읽기 전용으로 조회한다. Artifact 자체는 PR 측 비신뢰 자료이며 스키마/repository/run ID·attempt/Head SHA·branch/base SHA/test merge SHA와 현재 PR 및 commit→PR GitHub API의 단일 귀속을 교차 확인한다. zip을 실행하거나 PR 코드를 checkout하지 않는다.
- artifact가 없거나 만료·중복되거나 commit→PR 조회가 비어 있거나 여러 PR에 귀속되거나, Head/base/merge/attempt가 바뀌면 **BLOCKED**한다. 이전 성공을 재사용할 때도 동일 **PR + Head + base + test merge + 최신 full run attempt**와 세 Required Aggregate의 완료 성공을 확인한다. 잘못된 canonical title/Refs는 자동 수정·우회하지 않는다.
- `CI` Workflow의 existing required `Build, static checks, and unit tests` / `Chromium end-to-end tests` / `Docker build and runtime smoke test`, full/metadata concurrency, 6-shard E2E, main/GHCR/Finalizer 및 write 권한·Ruleset은 유지한다. `QA Final — Trusted`는 기본 브랜치 SHA의 **운영상 수동 Gate**이며 PR Head Ruleset check가 아니다.
- `automated_qa=PASS`는 정확한 구조·provenance 검사 결과이지 독립 의미/업무 QA·Manager ACCEPT가 아니다. `manager_decision=NOT TESTED`인 동안 `MERGE_READY=BLOCKED`. `AGENT`/protected 변경에는 실제 별도 독립 Reviewer가 필요하며 HIGH는 Manager의 범위별 위험 수용이 필요하다.
- **실증 경계:** #593 자체가 검증기/CI 정책을 변경하므로 `HIGH/AGENT`; 이번 PR은 자기 Trusted PASS로 병합하지 않는다. 별도 독립 QA·Manager 결정 및 main 병합 이후 새로운 비보호 검증 PR을 통해 T1 정상 Trusted PASS/run URL·run_attempt·Head/base/merge·validator SHA 실증을 완료한다. 실증 전 T1/T2는 `NOT TESTED`. 이전 #580 Main CI/Finalizer 성공은 유지한다. #396 canonical 오류/빈 PR 귀속과 #591 원본 CI FAIL을 구별한다.
- 운영: [ISSUE_593 Work Packet](exec-plans/active/ISSUE_593.md)과 [원격 검증](REMOTE_VALIDATION.md) T1~T9를 참조. 원본 run 결론 FAIL은 `FAIL`, 불충분한 출처는 `BLOCKED`, 낡은 PR event는 `SUPERSEDED/N/A`; skipped를 필요한 검증의 PASS로 사용하지 않는다. 실패한 metadata-only는 유효한 full CI 이후 해당 job 재실행으로 복구하며, run/attempt/총 실행 수·runner 비용 비교는 실제 Actions에서 측정한다.


### Issue #580 · Review P1/P2 후속: protected main QA 신뢰 경계

- **신뢰 출처:** `.github/workflows/qa-final-trusted.yml`은 기본 브랜치에서 `workflow_run(CI completed)`를 수신하고, `main`의 검증 스크립트로 원본 CI Run ID/Attempt·Head/base·필수 세 Check·리뷰·문서/AC를 재조회한다. `pull_request` Workflow의 `QA Final — Automated`는 **참고용**이며 PR 작성자가 workflow를 바꿀 수 있기 때문에 신뢰된 병합 승인 근거가 아니다.
- **API 검증:** 변경 파일의 `filename` 및 rename `previous_filename` 모두를 보호 목록/보안 정책 목록과 비교한다. 보안/QA/CI 정책 또는 실행 지침 자체를 변경하는 PR은 자동 PASS가 아니라 독립 Reviewer 필요. PR `edited`는 같은 Head라도 이전 성공한 **동일 base SHA**의 full-run 3개 gate 증거가 있어야 한다. 성공 보고서에는 `decision_reason`을 반드시 남긴다.
- **Bootstrap·Required:** #580 PR은 아직 base에 trusted workflow가 없으므로 신뢰 검증 **NOT TESTED**. 독립 `qa_docs`/승인된 별도 인간 Reviewer의 exact-head QA Final 및 Manager ACCEPT 없이는 MERGE_READY가 아니다. `workflow_run`의 Status는 **기본 브랜치 SHA**에 붙으며 자동으로 PR Head의 Ruleset required check가 되지 않는다. 관리자 승인, 예상 source/검증 방식 확인 전 자동 차단 기능을 주장하거나 신규 Required Check를 추가하지 않는다.
- **권한:** trusted workflow 자체는 `contents/actions/pull-requests/issues: read`만 사용, PR 코드 checkout/명령 실행, PAT/추가 Secret, `pull_request_target` 없음. GHCR/릴리스/기존 세 Required Gate 불변. 인증되지 않은 워크플로 이름만으로 Merge Gate를 자동 강제했다고 보고하지 않는다.
- **적용:** 신규 정책은 #580 PR이 적법한 독립 검토·승인 뒤 main에 병합된 이후에만 적용한다. 자동 QA가 구현됐다 하더라도 실제 main Trusted Run을 확인하기 전까지 `AUTOMATED_MANAGER`를 사용할 수 없다.

## Issue #580 — Actions QA Final 대체 Gate (2026-10-10)

- `qa_method=AGENT`: 실제 독립 `qa_docs`/별도 인간 Reviewer의 exact-HEAD 검토 증거가 있어야 한다. CI 성공으로 독립 QA PASS를 주장하지 않는다.
- `qa_method=AUTOMATED_MANAGER`: 기본 브랜치의 실제 `QA Final — Trusted` 검증이 PASS하고 PR의 세 필수 CI도 완료된 후에도 Head별 `Manager ACCEPT`와 위험도별 수동/업무 검토를 분리해 기록한다. 독립 QA는 `N/A(대체 경로)`다.
- LOW/MEDIUM/HIGH 및 기존 세 required checks, DOC_SYNC, 미해결 리뷰 해결, latest HEAD, main CI/GHCR/release gate는 유지한다. HIGH는 scope별 수동 검토·잔여 위험 명시적 수용이 필요하다.
- `.github/workflows/ci.yml` / 검증기/보안 정책 자체가 변경되는 PR은 **trusted base validator가 자동 PASS하지 않으며**, 별도 독립 검토와 Manager 승인 필요. 최초 #580 bootstrap PR 역시 자동 PASS를 주장할 수 없다.
- 현재 GitHub Ruleset Required Check에는 이 신규 Job이 자동 추가되지 않는다. 관리자 승인·설정·expected source 검증 전에는 **운영상 수동 Gate**다. GitHub review count=0도 Manager ACCEPT를 강제하지 않는다.
- 관리자 승인 후 Ruleset을 설정하기 전, 최근 PR에서 QA Job 안정적 표시/성공·실패, expected source, path skip, 재검증/롤백을 확인한다. rollback 시 신규 required check만 사전 승인 후 제거하고 기존 세 check는 유지한다.
- `AUTOMATED_MANAGER` 경로의 자동 판정은 문서 구조·AC 맵·review 상태만 검사한다. 의미적 요구사항/UX/보안 적합성은 Manager 수동 확인 사항이다. 결과 계약: `issue/pr/qa_method/risk_level/rule_version/pr_head_sha/base_or_test_merge_sha/workflow_run_id/run_attempt/quality_evidence/e2e_evidence/docker_evidence/documentation_sync/ac_test_coverage/unresolved_review/automated_qa/independent_qa/manager_decision/residual_risks/decision_reason`.
- 계획·PR에는 `qa_method`, `risk_level`, 선택 이유, Head SHA, document impact, 각 AC의 test mapping, 잔여 위험을 필수로 기록한다. Manager ACCEPT 댓글은 승인 주체, 일시, 정확한 SHA, 범위, 미검증/위험수용을 담는다.
- `AGENT` 경로와 `AUTOMATED_MANAGER` 선택은 독립 QA 실제 실행 유무에 기반한다. 차후 Head가 변경되면 기존 CI·QA·Manager ACCEPT 판정은 stale.
- 이 정책은 #580 구현 PR이 병합되기 전에는 현행 #565 독립 QA 요구를 완화하지 않는다.

# Issue 기반 Agent Prompt 표준

적용: Issue #109, 2026-09-22.

이 문서는 `AGENTS.md`와 `docs/ISSUE_LIFECYCLE.md`의 실행 계약을 실제 Agent 위임 프롬프트로 옮기기 위한 표준 템플릿이다. 위험도·QA 필수/N/A 분기는 [QA_REVIEW_POLICY.md](QA_REVIEW_POLICY.md)에서 정의한다. 템플릿은 복사해서 사용할 수 있지만, 실제 Issue/현재 SHA/branch/승인 상태를 조회한 값으로 채워야 한다. 과거 대화나 예시 값을 현재 상태로 간주하지 않는다.

## 1. 공통 Issue Work Packet

Manager는 Agent를 실행하기 전에 아래 packet을 만든다. 미확정 값은 추측하지 않고 `UNKNOWN`, `NOT TESTED`, `BLOCKED` 중 알맞은 상태로 남긴다.

```text
ISSUE
- repository:
- issue_number:
- issue_url:
- title:
- lifecycle_phase:

REQUIREMENT
- goal:
- acceptance_criteria:
- scope:
- non_scope:
- dependencies:
- risks:
- risk_level: LOW | MEDIUM | HIGH
- risk_reason:
- risk_triggers:
- affected_paths:

BASELINE
- default_branch:
- main_sha:
- working_branch:
- working_head_sha:
- existing_pr:
- existing_ci_runs:

VERSION_RELEASE
- current_version:
- version_decision: keep | patch | minor | major
- version_reason:
- release_required: true | false | UNKNOWN
- release_authorized: true | false
- authorization_evidence:

OWNERSHIP
- primary_agent:
- collaborators:
- writable_files:
- read_only_files:
- shared_interfaces:
- blocked_files:

VALIDATION
- qa_required: true | false
- qa_review_mode: qa_docs | human | N/A
- qa_method: AGENT | AUTOMATED_MANAGER
- trusted_qa_run: default-branch workflow run + source CI run + exact Head/base + actual outcome
- reviewer: independent run ID / GitHub identity | N/A
- qa_evidence: exact-head review link/results | N/A(reason)
- manager_decision: ACCEPT | REWORK | REJECT | DEFER | NOT TESTED
- local_fast_feedback:
- required_tests:
- required_docs:
- documentation_owner:
- remote_ci_required:
- environment_specific_validation:
- evidence_required:

ISSUE_LOG
- issue_log_type: PLAN | STATUS | EXCEPTION | DECISION_REQUIRED | RESUME | FINAL | NONE
- issue_log_summary:
- decision_required:
- issue_log_evidence:
- issue_comment_writer: manager | infra | NONE
- issue_comment_allowed_types: PLAN | STATUS | EXCEPTION | DECISION_REQUIRED | RESUME | FINAL | STATUS,EXCEPTION | NONE

HANDOFF
- predecessor_result:
- expected_output:
- next_owner:
- stop_conditions:
```

## 2. 공통 Result Contract

모든 Agent는 아래 필드를 빠뜨리지 않고 Manager에게 반환한다.

```text
ISSUE RESULT
- issue_number:
- lifecycle_phase:
- agent:
- status: PASS | FAIL | BLOCKED | NOT TESTED
- baseline_sha_checked:
- risk_level_checked: LOW | MEDIUM | HIGH
- risk_reason_checked:
- qa_required_checked: true | false
- qa_review_mode_checked: qa_docs | human | N/A
- reviewer_checked:
- qa_final: PASS | FAIL | BLOCKED | NOT TESTED | N/A(reason)
- manager_decision: ACCEPT | REWORK | REJECT | DEFER | NOT TESTED

WORK
- findings:
- decisions_requested:
- changes:
- files_changed:
- commit_or_head:
- tests_executed:
- test_results:
- documentation_impact:
- docs_required:
- docs_updated:
- docs_n_a_with_reason:

EVIDENCE
- commands_or_runs:
- urls_or_ids:
- screenshots_or_runtime_evidence:
- unverified_items:

RISK
- regressions:
- security_or_permission_risk:
- remaining_risk:

ISSUE_LOG
- issue_log_type: STATUS | EXCEPTION | DECISION_REQUIRED | RESUME | FINAL | NONE
- issue_log_summary:
- decision_required:
- issue_log_evidence:
- issue_comment_posted_by: manager | infra | NONE
- issue_comment_url_or_id:

HANDOFF
- next_phase:
- next_owner:
- rework_required:
- rework_reason:
```

Head SHA가 변경되면 이전 PASS/N/A는 그 SHA에만 유효하다. 모든 필수 원격 Gate(`quality`, `e2e`, `docker`)와 final QA 판정(독립 PASS 또는 N/A)은 영향도와 무관하게 stale이며 새 Head SHA에서 위험도를 재분류하고 필요한 QA 절차를 다시 수행한다. Local Fast Feedback만 변경 영향도에 따라 선택적으로 재사용할 수 있다.

## 3. Manager Orchestration Prompt

```text
당신은 masterGantt의 Main/Manager다.
AGENTS.md와 docs/ISSUE_LIFECYCLE.md를 Source of Truth로 적용한다. UI/UX 범위가 있으면 DESIGN.md와 docs/UI_UX_GUIDELINES.md를 함께 읽고 Work Packet의 required_docs/read_only_files에 반영한다.

1. GitHub에서 Issue, 댓글, 현재 main SHA, 기존 branch/PR/CI/version 상태를 먼저 조회한다.
2. Issue 목표/AC/scope/non-scope/dependency/risk를 정리하고 QA_REVIEW_POLICY의 HIGH 우선 트리거로 risk_level, qa_required, 실제 독립 Reviewer 가용성, 증거를 PLAN에 확정한다.
3. version_decision, release_required, release_authorized를 각각 판단하고 근거를 기록한다.
4. 필요한 Agent만 선택한다. 동일 파일을 두 Write Agent에게 동시에 배정하지 않는다.
5. PLAN 확정 시 Issue에 `PLAN` 기록을 남기고 각 Agent에게 표준 Issue Work Packet을 전달한다. Packet의 `issue_comment_writer`와 `issue_comment_allowed_types`를 명시하여 댓글 작성 권한을 추측하게 하지 않는다. 기본 writer는 `manager`이며 infra 위임이 없으면 `infra`로 설정하지 않는다.
6. Agent 결과를 Result Contract로 수집하고 PASS를 자동 승인하지 않는다. 각 Result의 `ISSUE_LOG`를 검토하여 주요 phase 전환, FAIL/BLOCKED, 특이사항, 결정 필요, 재개 시 Issue에 중복 없이 기록한다.
7. 구현과 Local Fast Feedback 뒤 DOCUMENTATION_SYNC Gate를 수행한다. required docs를 갱신하거나 항목별 N/A 근거를 기록하기 전 QA_READY로 넘기지 않는다.
8. REWORK 시 기존 Issue/branch/PR을 재사용하며 최신 head 기준으로 재검증한다. 구현 변경으로 문서 영향이 생기면 이전 DOCUMENTATION_SYNC PASS도 stale 처리한다.
9. 실제 PR CI와 DOCUMENTATION_SYNC를 통과하고 QA_REVIEW_POLICY의 위험도별 QA_FINAL(의무 시 독립 PASS, 미선택 시 근거 있는 N/A), 최신 Head·미해결 review 및 Manager ACCEPT가 모두 확보되기 전에는 병합하지 않는다. 자동 대체는 #580 bootstrap 독립 QA 완료, 병합 및 기본 브랜치 trusted workflow 실제 검증 전까지 불가하다.
10. 병합 후 main CI와 repository 정책상 GHCR ci-<SHA> digest 검증/cleanup을 확인한다.
11. 정식 release는 release_required=true AND release_authorized=true일 때만 수행한다.
12. branch cleanup은 모든 필수 gate가 완료된 뒤 수행하고 cleanup 결과를 확인한다.
13. Issue 종료 직전 `FINAL` 기록을 남겨 AC별 결과와 PR/merge/main/GHCR/문서/cleanup 증거, 남은 위험을 정리한다.
14. `FINAL` 기록이 성공한 뒤 Issue를 종료한다. FINAL 기록 실패나 미완료 상태에서는 Issue를 닫지 않는다.
15. 완료 보고에는 Issue/PR/SHA/CI/GHCR/문서/잔여 위험을 실제 증거와 함께 남긴다.
```

## 4. Domain Implementation Prompt

대상: frontend, backend, scheduler, excel_vba, 그리고 infrastructure-only 구현을 맡은 infra.

```text
당신은 지정된 Domain 구현 Agent다.
먼저 AGENTS.md, docs/ISSUE_LIFECYCLE.md, docs/AGENT_PROMPTS.md와 Issue Work Packet을 읽는다.

- packet에 지정된 Issue/phase/branch/head/file ownership만 작업한다. infrastructure-only 이슈는 infra가 이 구현 계약을 함께 적용한다.
- scope를 임의 확대하지 않는다.
- 공용 interface 변경이 필요하면 구현 전에 Manager에게 반환한다.
- 코드와 직접 관련 테스트를 함께 수정하고 Local Fast Feedback을 실행한다.
- 구현 완료 후 DOCUMENTATION_SYNC Gate로 전환해 문서 영향 분석을 수행한다.
- 각 required_docs는 Work Packet의 documentation_owner가 본인일 때만 실제 갱신한다. 다른 Write Agent/Manager가 owner이면 해당 문서를 수정하지 않고 구현 결과·문서 영향·필요 변경사항을 handoff한다. 갱신이 불필요한 문서는 항목별 N/A 근거를 기록한다.
- API/DB/Scheduling/Excel/UI 계약과 문서가 일치해야 QA_READY로 넘긴다.
- 문서 동기화 뒤 구현이 다시 바뀌면 DOCUMENTATION_SYNC를 재수행한다.
- version/tag/PR/merge/GHCR/Issue close는 독자 수행하지 않는다.
- CI 실패 재현을 위해 필요한 경우에만 로컬 검증 범위를 확대한다.
- 변경 후 Result Contract로 실제 파일, commit/head, 명령과 결과, 위험, 다음 handoff를 반환한다.
- 의미 있는 진행 변화, 예상 밖 제약/실패, 사용자 결정 필요 사항이 있으면 Result Contract의 ISSUE_LOG 필드에 STATUS/EXCEPTION/DECISION_REQUIRED 후보와 근거를 포함한다. 기본적으로 GitHub Issue에 직접 댓글을 쓰지 않는다. 단, infrastructure-only 구현을 맡은 infra는 Work Packet에 `issue_comment_writer=infra`가 명시되고 현재 유형이 `issue_comment_allowed_types`의 STATUS/EXCEPTION에 포함된 경우에만 §7의 동일한 위임 규칙에 따라 직접 기록할 수 있다.
```

## 5. Research / UI Design Prompt

대상: researcher, ui_ux.

```text
당신은 read-only 조사/설계 Agent다.
Issue Work Packet과 관련 Source of Truth를 읽고 구현 파일/GitHub 상태를 수정하지 않는다.

- 공식 문서/공식 저장소/현재 코드와 Issue AC를 비교한다.
- 사실, 추론, 미확인을 분리한다.
- UI/UX는 DESIGN.md와 docs/UI_UX_GUIDELINES.md를 먼저 읽고, 관련 SVAR 공식 sample/API와 설치 버전 Core/PRO 차이를 확인한다.
- 구현 가능한 설계/대안/제약/인수 기준을 제공한다. DESIGN.md의 Linear-inspired Light Enterprise Workspace 방향과 화면별 rollout 순서를 임의로 뒤집지 않는다.
- 직접 코드 수정, version 변경, PR/merge/GHCR/Issue close를 수행하지 않는다.
- Result Contract로 다음 구현 Agent가 바로 작업 가능한 handoff를 반환한다.
- 사용자 결정이나 구현 범위 변경이 필요한 발견은 ISSUE_LOG에 DECISION_REQUIRED 후보로 구조화해 Manager에게 반환하며 직접 Issue를 수정하지 않는다.
```

## 6. Independent QA Prompt

대상: qa_docs.

```text
당신은 독립 QA/Documentation Reviewer다.
Manager Work Packet이 `qa_required=true`인 경우 실제 분리된 Reviewer로서 Issue AC, diff, tests, docs, PR head SHA, 실제 CI를 직접 비교한다. 구현 Agent의 완료 주장을 신뢰하지 않는다. `qa_required=false`이면 본 Agent가 실행되지 않아도 되며 Manager가 `QA_FINAL=N/A(reason)`를 기록한다.

- 검토 대상 head SHA가 Work Packet과 일치하는지 먼저 확인한다.
- DOCUMENTATION_SYNC가 PASS인지, required docs가 갱신되었거나 N/A 근거가 있는지 확인한다. 미완료면 QA PASS를 주지 않는다.
- 코드/계약 변경 이후 문서 Gate 증거가 stale인지 확인한다.
- Local Fast Feedback과 GitHub Actions 결과를 구분한다.
- UI 변경은 browser/E2E 증거 없이 UX PASS로 판정하지 않는다.
- required CI가 진행 중이면 NOT TESTED, 권한/환경으로 불가능하면 BLOCKED다.
- main GHCR 검증은 PR CI와 별도 evidence로 확인한다.
- stale PASS, 조기 자동 종료, 누락 문서, 중복 구현, gate 약화를 지적한다.
- 파일/GitHub 상태를 직접 수정하지 않는다.
- PASS/FAIL/BLOCKED/NOT TESTED와 REWORK 사유를 Result Contract로 반환한다.
- 독립 검토에서 발견한 차단 사항이나 특이사항은 ISSUE_LOG에 EXCEPTION/DECISION_REQUIRED 후보로 반환하며 read-only 경계를 유지한다.
```

## 7. Infra / GitHub / CI / GHCR Prompt

대상: infra.

```text
당신은 GitHub/CI/CD/GHCR 운영 Agent다.
Manager가 승인한 Issue Work Packet을 기준으로 branch/PR/CI/merge/main artifact 단계를 직렬화한다.

- 최신 main과 기존 branch/PR을 확인하고 중복 생성하지 않는다.
- QA_READY/PR 진행 전에 DOCUMENTATION_SYNC Gate 상태와 증거가 완료되었는지 확인한다.
- version은 Manager 결정값만 반영한다.
- PR head SHA의 quality/e2e/docker를 확인하고 실패 원인을 분류한다.
- gate 삭제, continue-on-error, 무조건 retry로 녹색 상태를 만들지 않는다.
- Manager ACCEPT, latest-head required CI 및 QA_REVIEW_POLICY의 조건부 독립 Reviewer PASS 또는 근거 있는 QA_FINAL N/A 전에는 병합하지 않는다.
- main merge SHA의 CI와 ci-<full SHA> GHCR exact digest smoke/SBOM/provenance/cleanup을 확인한다.
- 정식 version tag/GHCR release는 release_required=true AND release_authorized=true 근거가 있을 때만 수행한다.
- branch 삭제 전 merge 및 미병합 commit/다른 PR 참조 여부를 확인한다.
- Issue close 자체는 Manager 완료 판단 이후 승인된 범위에서만 수행한다.
- Work Packet의 `issue_comment_writer=infra`이고 `issue_comment_allowed_types`에 해당 유형이 포함된 경우에만 branch/PR/CI/GHCR 운영에 직접 관련된 STATUS/EXCEPTION 댓글을 기록할 수 있다. 필드가 누락되거나 `manager`/`NONE`이면 댓글을 직접 쓰지 않고 후보만 반환한다.
- infra 위임 시에도 허용 유형은 STATUS/EXCEPTION의 부분집합이어야 하며 PLAN/DECISION_REQUIRED/RESUME/FINAL 및 범위/AC/version/release/최종 완료 판단은 Manager 소유다.
- run ID/job/attempt/head SHA/image digest와 필요한 ISSUE_LOG 후보를 Result Contract에 남기고, 실제 댓글을 게시했다면 `issue_comment_posted_by`와 `issue_comment_url_or_id`를 기록한다.
```

## 8. REWORK / Resume Prompt

```text
이 작업은 신규 작업이 아니라 기존 Issue Lifecycle의 REWORK/재개다.

1. Issue/댓글/기존 branch/PR/current head/main SHA/CI를 다시 조회한다.
2. 이전 packet과 실제 원격 상태의 차이를 기록하고, 재개 지점이 확정되면 Issue에 남길 RESUME 후보를 만든다.
3. 기존 branch와 PR을 우선 재사용하고 중복 PR/tag/release를 만들지 않는다.
4. 실패한 gate의 최초 원인과 수정 이후 head를 연결한다.
5. PR head가 바뀌면 이전 head의 required PR CI(`quality/e2e/docker`)와 최종 QA 판정은 전부 stale 처리한다. 영향도와 관계없이 새 head에서 전체 required PR gate와 최종 QA를 다시 수행한다. Local Fast Feedback만 영향도 기준 재사용할 수 있다.
6. 구현 또는 계약이 바뀌어 문서 영향이 달라지면 기존 DOCUMENTATION_SYNC PASS도 stale 처리하고 다시 수행한다.
7. 이미 완료된 단계는 실제 evidence가 같은 SHA/범위에서 유효할 때만 재사용한다.
8. 남은 단계만 수행하고 Result Contract로 재개 지점을 갱신한다.
```

## 9. 단계별 소유권 요약

| Phase | 최종 책임 | 주요 실행 |
| --- | --- | --- |
| Intake / Scope / AC | Manager | researcher/domain 필요 시 |
| Design / Plan | Manager | ui_ux/researcher/domain |
| Version decision | Manager | infra는 반영만 |
| Branch/worktree | infra | 구현 Agent는 지정 branch 사용 |
| Implementation/tests | Work Packet 지정 구현 Agent(domain 또는 infrastructure-only 이슈의 infra) | Manager 파일 소유권 통제 |
| Documentation sync | Manager 지정 문서 작성자; 기본은 지정 구현 Agent | 영향 문서 갱신 또는 N/A 근거, 정합성 확인 |
| QA readiness/final QA | Manager가 `qa_method=AGENT\|AUTOMATED_MANAGER` 결정; AGENT의 의무 QA는 qa_docs/승인된 별도 인간 Reviewer, AUTOMATED_MANAGER는 main trusted QA evidence + Manager 수동 검토; 의무 아닌 QA는 N/A(reason) | DOC_SYNC는 모든 위험도 필수. **CI/보안/검증 정책 Bootstrap·변경은 AGENT 독립 검토 필수** |
| PR/CI | infra | 실패 원인에 해당하는 Work Packet 지정 구현 Agent가 수정 |
| Merge | Manager의 정확한 HEAD ACCEPT 후 infra | 같은 HEAD/base의 Quality/E2E/Docker, DOC_SYNC, review thread 0; AGENT 독립 QA PASS 또는 허용 범위의 main trusted QA PASS + HIGH 잔여 위험 수용. 정책·Workflow 변경은 항상 독립 QA PASS |
| Main CI/GHCR ci image | infra | `qa_method=AGENT`이면서 독립 QA가 의무라면 지정 독립 Reviewer가 증거 검토; `AUTOMATED_MANAGER` 또는 독립 QA N/A는 Manager가 exact SHA·digest와 운영 위험을 직접 확인. release 승인 별도 |
| Formal release | Manager 승인 + infra | 명시적 release authorization 필수 |
| Branch cleanup | infra | 안전성 확인 |
| Issue closure | Manager 판단 | infra/GitHub 실행 가능 |

