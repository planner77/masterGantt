# Issue #586 — 복수 PR FINAL 감사·부분 종료 복구 Work Packet

- Primary Issue: [#586](https://github.com/planner77/masterGantt/issues/586) · PR [#588](https://github.com/planner77/masterGantt/pull/588) · branch `fix/issue-586-multi-pr-finalizer`
- 기준 main: `367b160b2f1db75feb7af1a5ea67046b9828b836`; 애플리케이션 `0.104.0` 유지 (운영 스크립트 수정으로 추가 버전 증분 없음)
- risk_level: HIGH
- risk_reason: 인증된 FINAL/Issue close, first-parent 순서, GHCR 후보 삭제, Release 승인에 영향을 주는 보호된 GitHub 실행 스크립트와 Workflow 수정
- risk_triggers: `scripts/**`, `.github/workflows/**`, `AGENTS.md`, `docs/ISSUE_LIFECYCLE_AUTOMATION.md` 등 protected CI/운영 정책 경계
- qa_required: true
- qa_method: OWNER_MANAGED
- qa_review_mode: #598 기본 Owner-managed 경로 — 신뢰된 기본 브랜치 QA Final, 정확한 Head/base/Run의 Quality/E2E/Docker, 리뷰 스레드 0, 문서/AC 추적과 HIGH 위험 수동 검토. 별도 인간 Reviewer는 선택하지 않음
- independent_qa: N/A(Owner-managed, 독립 검토 없음)
- manager_decision: NOT TESTED (Owner 병합 승인 전)
- release_required: false
- release_authorized: false
- Lifecycle: PR_CI 재검증 / MERGE_READY=NOT TESTED (Owner 명시 병합 승인 전)

## 설계·불변 정책

- Source of Truth: `docs/ISSUE_586_FINAL_MARKER_ADR.md`, `docs/GENERIC_RELEASE_FINALIZER.md`, `docs/ISSUE_LIFECYCLE.md`, `AGENTS.md` 및 #586 T1–T8(AC1–AC8)
- `#565`의 #583 docs-only FINAL은 불변; 후속 #585 non-docs의 exact Merge SHA가 검증 후 별도 FINAL을 기록할 수 있어야 한다. 이전 Run/브랜치/GHCR 상태를 성공으로 소급하거나 무조건 cleanup하지 않는다.
- 같은 Issue의 성공 merge라도 PR/merge SHA별 필수 CI·Main/GHCR·branch 의무를 보존한다. 봇 작성자/PR head/base/Issue/first-parent와 기존 marker를 검사한 후 branch·candidate 변경을 수행한다.
- Dispatcher `main` snapshot SHA를 child에서 검증하고, FINAL 기록 직후 Issue close 실패는 인증된 FINAL의 close-only resume으로 복구한다. 수동 fallback에서 자동 Resolver의 특권 플래그 사용을 금지한다.

## 기존 실패와 진단 이력 (이전 PASS 재사용 불가)

- [Run #2406.1](https://github.com/planner77/masterGantt/actions/runs/38049377802), 이전 head `79c826e6c94dab437e5a2d400ab6c494d27069ee`: 테스트 `SimpleNamespace` import 순서 오류로 정책 Job FAIL; 이후 수정
- [Run #2407.1](https://github.com/planner77/masterGantt/actions/runs/38049810493), 이전 head `7226004090c71d24bd44336a4cb88dedd0ae1c32`: Quality/E2E/Docker 집계 PASS; 자동 QA는 PR body `risk_level` 누락으로 BLOCKED
- 과거 PR 본문에는 `risk_level: HIGH`, `qa_method: AGENT`를 기록했다. Issue #586의 T1–T8에 AC1–AC8 별칭 추가. 2026-10-11 현재 #598 기본 정책에 따라 `risk_level: HIGH` 유지·`qa_method: OWNER_MANAGED` 전환; 과거 QA 결과 소급 변경 금지
- [후속 metadata-only Run](https://github.com/planner77/masterGantt/actions/runs/38050258219)은 과거 같은 Head의 Full CI 원장 확인에서 FAIL; 새 파일 commit의 전체 PR CI를 유도하며, 이 Run을 PASS로 소급하지 않는다
- [PR CI #2441.1](https://github.com/planner77/masterGantt/actions/runs/38093537115): Head `22d3aba6a07c44d835ab0280b76f3230e1d57c6a`의 Quality/E2E/Docker 3 required aggregate PASS. `QA Final — Automated`는 과거 AGENT 선택의 독립 인간 Reviewer 부재로 BLOCKED. 해당 실패는 소급 PASS하지 않으며 변경 후 새 exact Head의 모든 Gate 결과는 시작 전 NOT TESTED. Manager 승인도 NOT TESTED

## DOCUMENTATION_SYNC

- `AGENTS.md`: N/A(현재 main의 기존 #582 한 줄 Merge API 및 SHA lease 지침을 재사용하여 수정 불필요)
- `docs/QA_REVIEW_POLICY.md`: N/A(이미 main에 채택된 #598 OWNER_MANAGED 기본 경로를 PR/Work Packet에 적용; QA 검증기·정책 파일 자체는 변경하지 않음)
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 first-parent·CI/GHCR/Finalizer 실패 복구 원칙은 유지)
- `docs/ISSUE_LIFECYCLE_AUTOMATION.md`: UPDATED
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `docs/ISSUE_586_FINAL_MARKER_ADR.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_586.md`: UPDATED
- `.github/workflows/issue-lifecycle.yml`: N/A(기존 수동 Lifecycle Workflow와 권한 정책 변경 없음)
- `scripts/issue_lifecycle.py`: N/A(기존 exact Main CI와 GHCR 삭제 안전 게이트 불변)
- `scripts/auto_release_finalizer.py`: N/A(기존 동일 Issue의 green 교정 supersession 함수 그대로 사용하고 회귀 추가)
- `scripts/delete-ghcr-package-version-by-tag.mjs`: N/A(임시 GHCR 공유 태그·안전 삭제 함수 변경 없음)
- `scripts/verify-issue-lifecycle.py`: UPDATED
- `scripts/main_ci_run_name.py`: UPDATED
- `DESIGN.md`: N/A(제품 UI·SVAR 화면 상호작용 없음)
- `docs/API.md`: N/A(웹 애플리케이션 REST API·DTO 계약 불변)
- `docs/DB_SCHEMA.md`: N/A(SQLite schema·migration 불변)
- `docs/SECURITY.md`: N/A(보안 권한/보호 검증기 우회 없이 기존 경계 강화)

## AC_TEST_COVERAGE

- AC1: `scripts/verify-issue-lifecycle.py`의 docs-only A→non-docs B 개별 FINAL/CI 시나리오; #565 실제 Main/GHCR 확인은 사후 원격 NOT TESTED
- AC2: `scripts/verify-issue-lifecycle.py`의 성공 동일 Issue PR coalesce 방지와 동일 scope 시에도 target별 cleanup 의무 유지
- AC3: `scripts/verify-issue-lifecycle.py`의 first-parent oldest-first·중간 Issue·CLOSED/no FINAL boundary·수동 skip 차단
- AC4: `scripts/verify-issue-lifecycle.py`의 FINAL 작성자·PR/head/Issue/merge SHA identity 감사, 동일 SHA 멱등/위조 FAIL
- AC5: `scripts/verify-safe-branch-cleanup.py`의 SHA lease·OPEN PR·보호 branch·ancestry·404 멱등 시나리오; 삭제 직후 HTTP 200 경쟁은 분리/후속 검증 필요
- AC6: `scripts/verify-issue-lifecycle.py`의 historical preflight, cleanup·GHCR tag 공유 보호, FINAL 이후 close-only 재개, main snapshot fail-closed 및 #586 실패 Main SHA의 제한적 non-docs GREEN supersession 회귀
- AC7: #565 #583/#585 원본 Merge·Main CI 증거 및 실패 Resume [Run 37958294541](https://github.com/planner77/masterGantt/actions/runs/37958294541) 보존; main 적용 뒤 별도 GHCR/branch 실조회 및 안전한 복구 NOT TESTED
- AC8: `scripts/verify-issue-lifecycle.py` 및 `scripts/verify-safe-branch-cleanup.py`와 원격 Quality/E2E/Docker, AGENTS/운영 문서 정합성; #586 멀티라인 실패 재현, 새 Merge API payload, exact Head/Main GHCR 증거 요구. HIGH 보호 경로는 현행 `OWNER_MANAGED`의 기본 브랜치 Trusted QA, Owner의 명시 병합 허가 및 잔여 위험 수용 전 MERGE_READY=BLOCKED

## QA/검토 및 잔여 위험

- 이전 리뷰 P1/P2에 대한 코드/회귀 수정은 새 Head의 CI 및 Reviewer 검증으로 재확인한다. Reviewer thread 해결 여부는 독립 QA PASS와 별개
- 현행 #598 정책에 따라 본 PR은 `OWNER_MANAGED` 선택. 독립 인간 검토는 N/A(실행 안 함)이며 자동 QA의 PASS도 Owner 승인/잔여 위험 수용·릴리스 권한을 대체하지 않는다. `AGENT` 선택 시 요구되는 독립 인간 QA는 생략이 아닌 선택 경로 차이이고 자동 승인·허위 영수증 금지
- Main 이동 및 Issue PATCH의 TOCTOU, 여러 버전의 승인/취소 marker, share-tag GHCR cleanup, 실제 #565 회복은 독립적으로 검증할 사후 위험
- release_required=false / release_authorized=false: 이 PR의 PR CI 시작은 GHCR/tag·이슈 종료 권한이 아님


## Issue #586 — Main CI #2445.1 사고 복구 (2026-10-11)

- 실제 Merge SHA 490c4ab70b0868729c8415f9f613bd45aa84926a는 [Main CI 38094304911](https://github.com/planner77/masterGantt/actions/runs/38094304911)에서 멀티라인 메시지 trace FAIL. Required Main CI, GHCR candidate, Generic Finalizer는 미완료. 기존 실패를 PASS로 소급하거나 main 강제 수정하지 않는다.
- 현재 기준 main 및 app 0.104.0에서 비문서 회귀 수정 PR을 만든다. 변경 범위는 scripts/main_ci_run_name.py, scripts/verify-issue-lifecycle.py, docs/GENERIC_RELEASE_FINALIZER.md, docs/ISSUE_586_FINAL_MARKER_ADR.md, docs/ISSUE_LIFECYCLE_AUTOMATION.md, docs/CI_CD.md, docs/GITHUB_OPERATIONS.md, docs/REMOTE_VALIDATION.md, docs/TEST_PLAN.md, PLAN 및 이 Work Packet이다.
- 재발 방지: merge_api_payload() 및 --as-merge-payload CLI로 GitHub Merge 호출에 canonical 한 줄 제목 + 빈 본문 + 검증 Head SHA를 필수 세트로 전달. 잘못된 기존 메시지 거부와 CLI/계약 검증을 scripts/verify-issue-lifecycle.py에 추가한다.
- 이전 Main CI FAIL은 다음 **같은 Issue #586의 non-docs exact Main CI SUCCESS** 대상이 있을 때만 supersede_failed_issue_retries()의 SUPERSEDED ATTEMPT로 감사한다. 새 corrective Main CI가 없거나 docs-only이면 기존 FAIL 상태를 유지한다. old PR #588 branch cleanup은 새로운 green target에만 인계한다.
- QA/risk: risk_level=HIGH, qa_method=OWNER_MANAGED, qa_required=true. 독립 인간 검토는 N/A(실시하지 않음). Owner의 명시 병합 지시와 새 Head Required CI/Trusted 검증·남은 위험 인수는 별도. release_required=false, release_authorized=false, formal GHCR/tag N/A.


#### Connector / REST head lease 경계 (Codex P2 후속)

GitHub 연결 도구의 merge_pull_request 입력은 expected_head_sha이며, GitHub REST /pulls/{number}/merge POST는 sha이다. --as-merge-payload의 기본 --merge-api connector는 expected_head_sha를 출력하고 --merge-api rest는 sha를 출력한다. 동일 요청에 두 필드를 섞지 않는다. 각각 body=""와 merge_method=merge, canonical title을 유지하고, 잘못된 대상 값은 거부한다. 해당 양쪽 CLI·helper 회귀를 추가했다.
