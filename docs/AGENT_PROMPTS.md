# Issue Work Packet과 Agent 반환 계약

현행 흐름은 [Issue Lifecycle](ISSUE_LIFECYCLE.md), 테스트는 [TEST_PLAN](TEST_PLAN.md), 실행기는 [LOCAL_PREPR](LOCAL_PREPR.md)이 원본이다. 모든 위험도에서 PR·원격 CI·Trusted QA·자동 Finalizer를 사용하지 않는다. [과거 서식](history/owner-ci-retired-20261110/AGENT_PROMPTS.md)은 이력 조회용이다.

## 1. Manager Work Packet

실제 Issue·현재 main·기존 코드/테스트·관련 [Regression Index](REGRESSION_INDEX.md)/실패 원장을 먼저 읽고 아래를 작성한다. 빈 값이나 미확인은 UNKNOWN/NOT TESTED/BLOCKED로 구분한다.

```text
ISSUE
- repository / primary_issue / related_issues / issue_url / title
- lifecycle_phase / requested_endpoint
REQUIREMENT
- goal / acceptance_criteria / scope / non_scope / dependencies
- risk_level: LOW | MEDIUM | HIGH
- risk_reason / risk_triggers / affected_paths
BASELINE
- main_sha / base_sha / working_branch / source_head_sha / source_fingerprint
- changed_files / fixture_digest / lock_digest / environment_versions
VERSION_RELEASE
- current_version / version_decision / version_reason
- publish_required / publish_authorized / authorization_evidence
- exact_source / unique_tag_scope / semver_or_rolling_authorization
- deploy_requested / deploy_authorized / backup_id / compatible_rollback_digest
OWNERSHIP
- manager / implementation_agent / collaborators / reviewer
- writable_files / read_only_files / shared_interfaces / blocked_files
REUSE_REVIEW
- REUSE_DECISION: REUSE_AS_IS | EXTEND | NEW_APPROVED | N_A_APPROVED
- REUSE_CANDIDATES / REUSE_CONDITIONS / REUSE_OWNER_EVIDENCE
TEST_LIFECYCLE_REVIEW
- changed_contract / existing_search_paths_cases_fixtures / lifecycle_decision
- direct_adjacent_negative_consumers / ac_test_coverage
- selected / excluded_with_reasons / unknown / missing / residual_risks
VALIDATION
- required_local_commands / expected_environment / source_stability
- reports / actual_exit_counts / artifacts / admission
- qa_method: OWNER_MANAGED_LOCAL | AGENT_LOCAL
- qa_required / independent_reviewer_identity / independent_qa
- manager_decision / owner_decision
- required_docs / documentation_owner / docs_updated_or_n_a
- environment_specific_validation / live_transition_evidence_911
- failure_ledger / regression_index_links / evidence_required
ISSUE_LOG
- issue_comment_writer: manager | infra | NONE
- issue_comment_allowed_types
- issue_log_type / issue_log_summary / decision_required / evidence
HANDOFF
- predecessor_result / expected_output / next_owner / stop_conditions
```

`release_required/release_authorized`를 기존 서식 호환으로 사용하면 고유 SHA 게시·정식 SemVer·rolling tag 범위를 명시한다. 일반 “전체 Lifecycle” 요청만으로 정식 버전/운영 배포 승인을 만들지 않는다. 동일 범위의 명확한 게시 승인은 반복 질문하지 않는다.

## 2. Agent Result Contract

```text
ISSUE RESULT
- issue / phase / agent / actual_runtime_identity
- status: PASS | FAIL | BLOCKED | NOT TESTED
- baseline_sha_checked / source_head / source_fingerprint / environment
- risk_level_checked / qa_method / reviewer_identity / independent_qa
- manager_decision / owner_decision
WORK
- findings / changes / files_changed / commit_or_head
- tests_executed / actual_commands_exit_counts / selected_excluded
- source_fixture_environment_stable / admission
- documentation_impact / required_docs / docs_updated / docs_n_a_reasons
EVIDENCE
- local_reports / artifacts / ledger_failure_ids / source_digest_backup_links
- push_status / ghcr_status / deployment_status / unverified_items
RISK
- regressions / security_permission_risk / residual_risk
ISSUE_LOG
- type / summary / decision_required / evidence
- posted_by / comment_url_or_id (위임돼 실제 게시했을 때만)
HANDOFF
- next_phase / next_owner / rework_required / rework_reason
```

## 3. 역할별 경계

Manager는 계획·위험·소유권·버전/게시/배포 승인 범위·단계 전환·문서·Owner FINAL을 책임진다. 별도 Manager Sub-Agent를 만들지 않는다. 실제 도구와 모델 가용성을 확인하고 실행하지 않은 독립 검토를 주장하지 않는다.

frontend/backend/scheduler/excel_vba 및 infrastructure-only 구현 infra는 지정 파일과 관련 테스트·문서를 수행한다. 다른 Agent 변경을 되돌리거나 scope/interface/version/Push/GHCR/종료를 독자 결정하지 않는다. researcher/ui_ux/qa_docs는 read-only이며 구현/문서 쓰기를 하지 않는다. qa_docs는 구현자 보고를 그대로 승인하지 않고 정확 source·AC·diff·문서·실제 로컬 결과를 비교한다.

infra는 승인된 local build/main fast-forward Push/GHCR digest smoke·복구 증거만 수행한다. #911 live 설정·동일 source admission·Owner 승인 범위 전에는 Push/Publish하지 않는다. 자동 workflow·Finalizer를 시작하거나 gate를 우회하지 않는다. Issue 댓글은 명시 위임된 STATUS/EXCEPTION만 쓴다.

재작업은 기존 Issue/branch를 사용하고 최초 FAIL과 새 source를 연결한다. source/fixture/환경 변화 뒤 관련 테스트·admission·문서/QA를 재검증한다. 필수 미통과 상태는 BLOCKED이며 미게시/미배포와 구분한다.
