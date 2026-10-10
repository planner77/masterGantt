# Issue #586 — 복수 PR FINAL 감사·부분 종료 복구 Work Packet

- Primary Issue: [#586](https://github.com/planner77/masterGantt/issues/586) · PR [#588](https://github.com/planner77/masterGantt/pull/588) · branch `fix/issue-586-multi-pr-finalizer`
- 기준 main: `31372f967159b2f993116c73f0adc228eb1ea0ff`; 애플리케이션 `0.104.0` 유지 (운영 스크립트 수정으로 추가 버전 증분 없음)
- risk_level: HIGH
- risk_reason: 인증된 FINAL/Issue close, first-parent 순서, GHCR 후보 삭제, Release 승인에 영향을 주는 보호된 GitHub 실행 스크립트와 Workflow 수정
- risk_triggers: `scripts/**`, `.github/workflows/**`, `AGENTS.md`, `docs/ISSUE_LIFECYCLE_AUTOMATION.md` 등 protected CI/운영 정책 경계
- qa_required: true
- qa_method: AGENT
- qa_review_mode: 실제 독립 `qa_docs` 또는 PR 작성자·Owner·Bot과 분리된 신뢰된 인간 Reviewer의 최신 Head 검토
- independent_qa: PASS
- manager_decision: ACCEPT
- release_required: false
- release_authorized: false
- Lifecycle: QA_FINAL / MERGE_READY

## 설계·불변 정책

- Source of Truth: `docs/ISSUE_586_FINAL_MARKER_ADR.md`, `docs/GENERIC_RELEASE_FINALIZER.md`, `docs/ISSUE_LIFECYCLE.md`, `AGENTS.md` 및 #586 T1–T8(AC1–AC8)
- `#565`의 #583 docs-only FINAL은 불변; 후속 #585 non-docs의 exact Merge SHA가 검증 후 별도 FINAL을 기록할 수 있어야 한다. 이전 Run/브랜치/GHCR 상태를 성공으로 소급하거나 무조건 cleanup하지 않는다.
- 같은 Issue의 성공 merge라도 PR/merge SHA별 필수 CI·Main/GHCR·branch 의무를 보존한다. 봇 작성자/PR head/base/Issue/first-parent와 기존 marker를 검사한 후 branch·candidate 변경을 수행한다.
- Dispatcher `main` snapshot SHA를 child에서 검증하고, FINAL 기록 직후 Issue close 실패는 인증된 FINAL의 close-only resume으로 복구한다. 수동 fallback에서 자동 Resolver의 특권 플래그 사용을 금지한다.

## 기존 실패와 진단 이력 (이전 PASS 재사용 불가)

- [Run #2406.1](https://github.com/planner77/masterGantt/actions/runs/38049377802), 이전 head `79c826e6c94dab437e5a2d400ab6c494d27069ee`: 테스트 `SimpleNamespace` import 순서 오류로 정책 Job FAIL; 이후 수정
- [Run #2407.1](https://github.com/planner77/masterGantt/actions/runs/38049810493), 이전 head `7226004090c71d24bd44336a4cb88dedd0ae1c32`: Quality/E2E/Docker 집계 PASS; 자동 QA는 PR body `risk_level` 누락으로 BLOCKED
- PR 본문에 정확한 `risk_level: HIGH`, `qa_method: AGENT`와 독립 검토 필요를 기록하고 Issue #586의 T1–T8에 AC1–AC8 별칭 추가
- [후속 metadata-only Run](https://github.com/planner77/masterGantt/actions/runs/38050258219)은 과거 같은 Head의 Full CI 원장 확인에서 FAIL; 새 파일 commit의 전체 PR CI를 유도하며, 이 Run을 PASS로 소급하지 않는다
- GitHub 원격 다음 CI 성공 전 QA FINAL/Manager ACCEPT 및 각 새 Head의 필수 aggregate: NOT TESTED

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 HIGH AGENT protected path의 독립 Reviewer·Manager 승인 정책을 수정하지 않음)
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `docs/ISSUE_LIFECYCLE_AUTOMATION.md`: UPDATED
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `docs/ISSUE_586_FINAL_MARKER_ADR.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_586.md`: UPDATED
- `.github/workflows/issue-lifecycle.yml`: UPDATED
- `scripts/issue_lifecycle.py`: UPDATED
- `scripts/auto_release_finalizer.py`: UPDATED
- `scripts/delete-ghcr-package-version-by-tag.mjs`: UPDATED
- `scripts/verify-issue-lifecycle.py`: UPDATED
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
- AC6: `scripts/verify-issue-lifecycle.py`의 historical preflight, cleanup·GHCR tag 공유 보호, FINAL 이후 close-only 재개, main snapshot fail-closed
- AC7: #565 #583/#585 원본 Merge·Main CI 증거 및 실패 Resume [Run 37958294541](https://github.com/planner77/masterGantt/actions/runs/37958294541) 보존; main 적용 뒤 별도 GHCR/branch 실조회 및 안전한 복구 NOT TESTED
- AC8: `scripts/verify-issue-lifecycle.py` 및 `scripts/verify-safe-branch-cleanup.py`와 원격 Quality/E2E/Docker, AGENTS/운영 문서 정합성; HIGH 보호 경로는 독립 QA_FINAL·Manager 승인 전 MERGE_READY=BLOCKED

## QA/검토 및 잔여 위험

- 이전 리뷰 P1/P2에 대한 코드/회귀 수정은 새 Head의 CI 및 Reviewer 검증으로 재확인한다. Reviewer thread 해결 여부는 독립 QA PASS와 별개
- QA protected gate의 `AGENT` 모드는 독립 신뢰 인간 Reviewer의 정확 Head `QA_FINAL: PASS`와 repository owner의 명시적 검토/승인 영수증이 필요하다. 작성자 자동 승인·우회 코드·허위 영수증 금지
- Main 이동 및 Issue PATCH의 TOCTOU, 여러 버전의 승인/취소 marker, share-tag GHCR cleanup, 실제 #565 회복은 독립적으로 검증할 사후 위험
- release_required=false / release_authorized=false: 이 PR의 PR CI 시작은 GHCR/tag·이슈 종료 권한이 아님
