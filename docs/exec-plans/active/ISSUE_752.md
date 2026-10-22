# Issue #752 — 반복 PR Full 실패 읽기 전용 진단과 수동 bounded E2E

## Issue Work Packet

- Issue: [#752](https://github.com/planner77/masterGantt/issues/752).
- Baseline: main `72c2c9d0a912dc906d4101ea41a7a57e0c686597` (2026-10-22); Branch: `feat/issue-752-ci-diagnostics`.
- 위험도: `HIGH`; QA: `qa_required=true`, `qa_method=OWNER_MANAGED`, `manager_decision=NOT TESTED`.
- `release_required=false`, `release_authorized=false`. 앱 버전 0.129.1, API/UI/DB/schema, exact-version GHCR/Finalizer, Ruleset 불변.
- 구현 지시 범위: 설계·코드·정책 회귀·관련 문서 동기화·PR 생성/Full CI 시작. CI 모니터링·병합/Main CI/GHCR/Issue 종료 제외.
- Source of truth: [AGENTS.md](../../../AGENTS.md), [PR 실패 종합 지침](../../PR_CI_FAILURE_TRIAGE.md), [CI/CD](../../CI_CD.md), [원격 검증](../../REMOTE_VALIDATION.md), [#730 원장](../../ISSUE_730_FAILURE_ANALYSIS.md), [#751 원장](../../ISSUE_751_FAILURE_ANALYSIS.md).

## 설계 — 기본 신뢰 경계

1. `.github/workflows/issue-752-diagnostics.yml`는 **신뢰된 기본 브랜치** `workflow_run` 완료 이벤트의 별도 advisory Job으로만 과거 Run을 탐색한다. 기존 PR CI의 3 Required Check, 8-Shard, Preflight·Fast Gate, Trusted QA/Owner 결정을 수정하지 않는다.
2. 원본 `ci-pr-source-<run_id>-<attempt>` pre-checkout Artifact, Git two-parent test merge, repository, PR canonical Issue, 워크플로 ID/path, 실제 원본 Job 결론을 교차 확인한다. 단순 CI Title, 과거 Head 성공, edited metadata-only, cancelled/skip 및 파생 aggregate/QA 실패는 직접 독립 실패로 계수하지 않는다. History 조회 누락·보존 만료는 `INCOMPLETE_EVIDENCE`이자 진단 승인 거부다.
3. **동일 canonical PR에 서로 다른 2회 이상 완료된 직접 Full CI 실패**가 있고 마지막 원본이 현재 HEAD에 귀속할 때만 `DIAGNOSIS_RECOMMENDED`. `observe_notify`는 별도 최소 write 권한과 결정적 PR/head/failure-key 댓글 upsert. 실패/댓글 미전달은 Required3 비변경. 최초 bootstrap/새 브랜치 외 과거 History 조회 한계는 보수적인 미인증 상태로 남긴다.
4. 권한 있는 Writer/Owner가 Actions > `Issue #752 — 반복 PR 실패 진단` > Run workflow에서 `PR number`, `Primary Issue number`, `expected exact HEAD SHA`를 제공해 수동 실행. 실행 직전 최신 PR Head/Base/test merge, canonical Refs, 누적 Issue 원장, source artifact, actor 권한, 변경 테스트 인벤토리를 재인증한다. stale/누락/권한 거부는 `BLOCKED`.
5. 선정 집합은 단일 원장에 기록된 역사적 실제 실패 E2E spec ∪ PR 변경 E2E spec이며 최대 24개, 4개 독립 bounded 파트로 나눈다. 추가 간접/음성 소비자는 Owner가 원장에 확정해 보강해야 한다. **한계 초과 시 FULL 자동 재실행이 아닌 분할 계획 재승인**. 같은 Issue 원장 전 실패 합집합을 지우지 않는다.
6. 진단에서는 승인된 exact HEAD 테스트 코드를 **읽기 전용** runner에서 실행하며 `--retries=0 --max-failures=0 --workers=1 --project=chromium --reporter=json`, 4파트 `strategy.fail-fast=false`를 적용한다. 격리된 worker에는 댓글 쓰기 토큰이 없고, 댓글 Job은 PR Head 코드를 실행하지 않는다. 진단 결과는 애초에 **Required PASS가 아니며** 과거 PASS로 승격 금지.
7. `finish`는 정확 worker Run ID/Head/선정 path 및 raw reporter를 **데이터로만** 교차 검증한다. 정제된 파일/케이스 상태와 P50/P95/취소율, 원장 링크, Run 목록을 Job Summary와 14일 보존 JSON·Markdown Artifact로 노출. 원시 Trace/URL/헤더/토큰/SQL/DB/스택 전체는 repository에 커밋하거나 PR 댓글에 복사하지 않는다. 원본 CI source artifact 30일, worker 진단 artifact 14일; 만료 시 자동 PASS 금지.
8. 종결 댓글은 **진단 보고서 Artifact 업로드가 실제 조회되는 경우에만 READY**로 표기한다. 누락·업로드 실패·출처 미확인·Part 미실행은 `DIAGNOSIS_INCOMPLETE` 또는 `BLOCKED`. 보고서의 `RESOLVED_CANDIDATE`는 원래 Full 회귀 검증 전 확정 RESOLVED가 아니다.
9. Issue #767의 35분 근접 취소는 단순 취소로 실패 2회 규칙에 포함하지 않는다. `RECURRING_JOB_TIMEOUT_REVIEW`는 신뢰된 Runner 취소 사유와 로그까지 검증한 **별도 warning-only 후속 후보**로 남기며 코드 변경 없이 취소→독립 실패 간주 금지. 현재 PR/Main/Release 활성 E2E=8개; #730 6개는 당시 기록만 유지.

## 운영·예외

- 알림은 GitHub Conversation/Watch 설정에 따라 전달되므로 사용자가 Run Job Summary와 댓글에서 직접 확인 가능해야 한다.
- `workflow_dispatch`는 기본 main에 병합된 뒤에만 실제로 제공된다. 이번 PR의 부트스트랩 상태를 실제 운영 진단이 이미 설치되었다고 해석하지 않는다.
- 안전 롤백: 신규 advisory workflow만 비활성화/제거. 기존 CI 3 Required, QA/Trusted, Main/Release/Ruleset/Owner 정책은 건드리지 않는다.
- Running metrics: 과거 SHA/OS/Node/Shard 달라질 때 P50/P95는 관찰 지표만 가능, 환경 동등성과 10개 독립 표본 없이는 성능 개선 판정 `INSUFFICIENT_DATA`.
- Source baseline 보호 파일 변경이며 Owner HIGH 범위 수용/정확 HEAD Full8·Trusted QA 전 Merge BLOCKED. `#752` 스스로 QA/릴리스 승인 안 됨.

## AC_TEST_COVERAGE

- AC1: `tests/python/test_issue_752_diagnostics.py`에서 1회/2회 독립 실패, stale Head/Attempt, metadata-only, cancelled, aggregate/Preflight 파생 상태, 원본 Artifact/test-merge 불일치와 교차 검증.
- AC2: 수동 선택 파일 합집합·경로 탐색 금지·24개 상한, 4개 파트 fail-fast false / retries0 / maxFailures0 계약 및 원본 Required3과 분리; 기존 `scripts/test_pr_fast_gate.py` 및 QA 정책 교차 회귀.
- AC3: 인증 현재 PR/head/base/test-merge, 권한/원장/Artifact 누락 → BLOCKED 또는 INCOMPLETE, 정제된 Worker 실패와 PART 미실행 반례, READY에 보고서 업로드 확인.
- AC4: P50/P95/취소율 정제·원시 개인정보 비노출, 누적 `RECURRING/NEW/RESOLVED_CANDIDATE/UNKNOWN`, Job Summary/PR 댓글 idempotent 링크·영수증. 실제 원격 Run은 새 HEAD CI 전 `NOT TESTED`.
- AC5: 역사적 `#730` #3001/#3003/#3005/#3008/#3009/#3012 각각 실제 Job/Artifact 보존 여부, 원본 에러 상세/환경 분류, #767 반복 35분 취소 원인: **새 진단 도입 PR에서는 원본 Run 추가 다운로드/실행하지 않았으므로 NOT TESTED**, 후속 수동 진단/Owner 판단이 필요. 과거 원장을 실제 진단 성공으로 바꾸지 않는다.
- AC6: `tests/python/test_issue_752_diagnostics.py` + 기본 정책 회귀; 재실패 시 본 Work Packet 갱신과 이슈별 `docs/ISSUE_752_FAILURE_ANALYSIS.md` 단일 누적 원장 생성.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/PR_CI_FAILURE_TRIAGE.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/ISSUE_752_FAILURE_ANALYSIS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 HIGH/OWNER_MANAGED·원본 QA·Owner 승인 규칙 불변)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 GitHub 최소 권한·PR/운영 승인 경계를 재사용하고 별도 권한 상승 없음)
- `docs/TEST_PLAN.md`: N/A(시험·음성 상세 계약을 전용 Work Packet과 신규 정책 단위 테스트로 별도 기록하며 기존 선정 표준 불변)
- `docs/ISSUE_LIFECYCLE.md`: N/A(Required PR·Main/GHCR/Finalizer·종료 단계/승인 불변)
- `DESIGN.md`: N/A(제품 UI 및 공통 시각 디자인 원칙 변경 없음)
- `docs/API.md`: N/A(제품 HTTP API 경로·입출력 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(제품 데이터베이스 스키마·마이그레이션 변경 없음)

## 2026-10-22 — PR #780 반복 QA 차단·미해결 리뷰 5건 종합 교정

- [전용 실패 원장](../../ISSUE_752_FAILURE_ANALYSIS.md) F752-001: [Full #3151.1](https://github.com/planner77/masterGantt/actions/runs/39782427411)은 이전 HEAD의 QA `PR latest Head stale`/Workflow CANCELLED. F752-002: [Full #3152.1](https://github.com/planner77/masterGantt/actions/runs/39782641377)은 **Quality/E2E8/8/Docker 모두 성공** 후 QA Final의 미해결 리뷰 5건으로 FAILURE. 테스트 직접 FAIL 관측0이며 QA 파생 실패를 누적 실제 E2E 실패로 계수하지 않는다.
- P1 Reporter 경로: Playwright JSON의 testDir-relative `example.spec.ts`와 repo-relative/absolute 경로를 승인된 `tests/e2e/...spec.ts`로 정규화하고, 중첩 Suite의 file inheritance·spec 자체 file, 악성 `..` 및 미선정 경로를 별도 음성 테스트로 차단한다. 원시 오류·URL·Trace는 worker JSON Artifact 업로드 전에 정제하고 `finalize`에서 두 번째 allowlist 검사.
- P1 Run History: repository-wide 300개 실행 조회 대신 REST `branch=`를 **API pagination 전** 적용하여 해당 head branch만 조회. 검색 결과 각 Run/Attempt·event/source artifact/PR/Test-Merge는 여전히 인증한다. 브랜치 자체 이력 초과, 보존 기간/권한 누락은 INCOMPLETE/BLOCKED.
- P1 Head 원장: 기존 `ledger_text(gh, issue, head)` 코드의 불변 PR HEAD 데이터 조회를 유지하며 `head`가 아닌 base 최신 원장 오독을 방지하는 Unit 추가. HEAD Markdown을 실행할 수 있는 정책이나 코드로 사용하지 않는다.
- P2 부분 미관측: 선정 파일이 최종 reporter에 0건이면 `SPEC_NOT_OBSERVED` + NOT RUN; 해당 파일이 skipped/interrupted/UNKNOWN 상태이면 `SPEC_NOT_FULLY_EXECUTED`. 다른 파일 한 개 PASS로 전체 `DIAGNOSIS_READY`가 되는 오탐을 없앤다.
- P1 한국어: 신규 workflow `name/run-name`·Job/Step 표시명·수동 입력 `description`·Job Summary/PR 댓글/오류 안내를 한글화한다. `jobs.<id>`·GitHub expression·기존 Required 명칭·상태값·워크플로 ID 및 자동 소비 경로는 변경하지 않는다.
- 인접 발견: `QA Final — Automated` 및 Shadow 같은 파생 결과만 실패인 Run은 "독립 Full 오류 2회" 권고의 계수에서 제외한다. 권고/수동 진단이 원래 QA Final과 Required3 PASS로 잘못 승격되는 경로는 허용하지 않는다.
- **AC_TEST_COVERAGE 보강**: `test_report_spec_paths_are_restricted_and_relative_paths_are_preserved`, `test_branch_filter_prevents_repository_wide_false_truncation`, `test_latest_ledger_is_read_from_frozen_pr_head`, `test_one_missing_selected_spec_blocks_ready`, `test_skipped_only_spec_is_incomplete`, `test_qa_final_review_block_is_not_independent_full_test_failure`, `test_workflow_displays_korean_without_changing_machine_identifiers`. 변경된 Head의 실제 원격 Full8/8·Trusted 및 수동 workflow_dispatch 실증은 별도이고 검증 전 `NOT TESTED`.
- **DOCUMENTATION_SYNC**: 본 Work Packet, `docs/ISSUE_752_FAILURE_ANALYSIS.md`, `docs/CI_CD.md`, `docs/REMOTE_VALIDATION.md` 업데이트. `AGENTS.md`/`docs/QA_REVIEW_POLICY.md` 정책 의미·원격 제품 API/DB·릴리스 권한 자체는 변경 없음.
- **사전 검증/인계**: GitHub Code/CI Job/Review API 확인, 로컬 Python/Chromium/Docker 실 실행은 환경상 `NOT TESTED`. 개선한 Tree를 단일 Head로 반영해 발생하는 새 PR CI는 모니터링하지 않으며, Owner 승인 전 병합/Main/GHCR/Finalizer/이슈 종료 금지.

## 검증·인계

- 본 브랜치 구현은 GitHub 연결 편집으로 반영. 이 작업 환경은 원격 repository checkout/npm/python/Playwright/Docker를 실행할 수 없으므로 **로컬 실제 실행 NOT TESTED**. 정책 회귀를 `.github/workflows/ci.yml`의 기존 Policy 필수 Job에 추가했고, 새 non-draft PR 생성으로 원격 Full8/8 실행을 시작한다.
- 원격 새 Head PR CI, Trusted QA, Owner 승인, 재실패 분석, Main/Release 및 실제 `workflow_dispatch` 진단: 현재 `NOT TESTED`; 병합·GHCR·Issue 종료는 이번 요청 범위 밖.
