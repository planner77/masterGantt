# Issue #712 — 병합 후 PR provenance / Lifecycle Full CI source 선택 교정

## ISSUE WORK PACKET

- Issue: [#712](https://github.com/planner77/masterGantt/issues/712)
- Baseline main: `c1489ff38b29e83bfee5411e82953d61a668acf4` (2026-10-18 검토 시점)
- Branch: `fix/issue-712-post-merge-provenance-lifecycle`. PR Head/SHA는 GitHub에서 매번 다시 확인하고 오래된 SHA를 승인 근거로 재사용하지 않는다.
- Phase: PLAN → local/code review pending → DOCUMENTATION_SYNC → PR_READY / full CI pending.
- Risk: **HIGH/P1**. Protected CI, QA provenance, release-finalizer mutation guard에 직접 영향.
- QA: `qa_required=true`, `qa_method=OWNER_MANAGED`; 보호 코드에 대한 독립 신규 검토 및 Owner HIGH 위험 수용과 정확한 Head/Run/Attempt 근거는 **NOT TESTED/대기**. 이 문서나 PR 제출은 Manager ACCEPT가 아니다.
- Version: 제품/DB/API/UI 기능 변화가 없으므로 application `0.115.0` 유지. `release_required=false`, `release_authorized=false` (이 이슈의 PR). #552의 기존 v0.115.0 Owner 정식 게시 승인은 **별도 기존 원장**에 보존하며 이 PR 자체의 승인으로 이전하지 않는다.
- Execution mode: GitHub 저장소 도구 기반 순차 구현. 별도 Agent/독립 QA 자동 실행 결과를 주장하지 않는다.

## SCOPE AND INVARIANTS

1. `qa_final_automated.verified_source`는 병합 전 open PR에서는 정확 Head/Base/Test merge를 계속 요구한다. 정상 병합 후에는 immutable 원본 full artifact, 두-parent test merge와 실제 merge의 base/head 부모, Git Tree, PR 소유권과 merge SHA를 읽기 전용으로 검증한다. squash/rebase, 다중 PR, ref 조작, 원본 artifact 없음은 BLOCKED.
2. `verify-pr-metadata-evidence.py`는 post-merge edited를 `POST_MERGE_METADATA_NON_AUTHORITATIVE`(감사 전용)로 분리하며 신뢰 가능한 Full Run/Attempt가 있을 때만 성공한다. metadata-only는 Full 회귀를 실행한 것으로 보고하지 않는다. Base/head 불일치, 새 실제 Full 실패/진행 중은 적색.
3. `issue_lifecycle.required_checks_ok`는 동일 이름 Check Run ID 순서를 제거한다. exact PR/head의 최신 진짜 Full Run ID+Attempt 및 artifact와 모든 attempt의 3 required 상태가 증명돼야 한다. Metadata-only 실패는 Full run 결과를 덮지 않는다.
4. 병합 후 QA Final — Automated는 재실행하지 않는다. 기본 브랜치 Trusted QA의 병합 후 입력은 신뢰된 출처 확인 뒤 비권위 감사 `N/A`로만 남기고 과거 PASS를 소급 변경하지 않는다.
5. mutation 금지 불변: PR first-parent / Main strict / GHCR artifact / Owner exact release marker / tag·digest / Cleanup / Finalizer. 검사 미확인/오류에서 절대 자동 PASS나 정식 게시 권한을 만들지 않는다.

**Non-scope:** PR #561 제품 코드, #2892·#2898·#2895 역사적 GitHub Run/Artifact·태그·기존 Issue 댓글 수정, 사용자 동의 없는 정식 GHCR, 기존 CI timeout/retries/skip 완화, 신규 릴리스 helper나 새 이슈 생성.

## FORENSIC REPRODUCTION (READ-ONLY)

- 원본 Full: `39021332528.1` (#2892.1), Head `3420e54453b43681c9634565b57f13ae8f0443a9`, Base `4307c8cdf1cc00a87fd7bff9f5e1a0c924bb3620`, Test merge `23a81e0cbb7ebf5cf28388147e09463c86e40717`; 3 required + 6 Chromium E2E + Docker SUCCESS.
- 이후 edited: `39027102063.1` (#2898.1) FAILURE; 동일 PR Head에 이름이 같은 3 aggregate의 실패가 추가되었을 뿐 새 전체 E2E 테스트는 아님.
- 실제 PR #561 merge `c0eca9ad5bfdb6c14d98dec7c5cfd7256e4619d7`; Test merge와 실제 merge의 부모는 Base/Head 순서로 동일하고 Git Tree도 `4e96ac1f52160364e35a48abfb76f89ed6b8844c`로 동일.
- Main `39025239061.1` (#2895.1) SUCCESS (3 required, 6/6 shards, 임시 commit 이미지 게시·검증·정리 Job 성공). 이는 별도 immutable merge SHA 증거로 보존한다.
- Generic Finalizer `39026497442.2`: release 승인 marker 존재 이후 원래 `NOT TESTED` 게이트에서 차단. 보완된 게이트의 원격 Main/Owner/tag/digest 검증 전 재개 금지.

## CHANGE IMPACT / LOCAL FAST FEEDBACK

- 변경: `scripts/qa_final_automated.py`, `scripts/verify-pr-metadata-evidence.py`, `scripts/issue_lifecycle.py`, CI workflow / 정책 회귀 / QA 문서 / 본 작업 원장.
- 검증 선택: Python fixture + 정적 lifecycle 계약 + 메타데이터 state machine + 자동 QA 원본 source fixture. 변경 영향이 protected CI/Release로 HIGH이므로 전체 PR CI Quality + 6 Chromium E2E + Docker + trusted/default-branch QA를 생략하지 않는다.
- DB·Migration·HTTP API·UI·SVAR Gantt·DESIGN.md: N/A (실행·릴리스 판정 스크립트 전용 변경).
- 로컬/CI 결과는 실행 원본이 확인될 때까지 **NOT TESTED**. CI 완료를 기다리거나 근거 없이 PASS로 표기하지 않는다.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 GitHub CLI merge 및 Ruleset 조작 절차 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 PR 검증 실행 명령과 timeout 및 Runner 계약 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(제품 화면 UX 디자인 또는 컴포넌트 변경 없음)

## AC_TEST_COVERAGE

- AC1: `scripts/test-issue-712.py` 역사적 #552 동일 부모·Tree fixture, merged/live base drift 및 `scripts/test-pr-metadata-evidence.py` post-merge audit 검사.
- AC2: 실제 #2895.1의 exact merge SHA, 3 required·6 shards·임시 GHCR 성공 원본 REST 확인; Owner marker 미존재 또는 버전 범위 불일치 시 기존 mutation gate는 BLOCKED.
- AC3: `scripts/test-issue-712.py` parent/Tree/Head/branch/repository/PR/source run/attempt/artifact 위조·누락 음성 검증.
- AC4: `scripts/test-issue-712.py` 최신 실제 Full failure/in-progress, QA-only 재시도, required aggregate 재시도 실패 검증; `scripts/test-pr-metadata-evidence.py` metadata-only 실패 분리, API collection 전체 페이지 검사.
- AC5: `scripts/verify-issue-lifecycle.py` 및 `scripts/test_qa_final_automated.py`, `scripts/test-issue-712.py`, PR 정책 Job 실행; 전체 원격 Quality/E2E6/Docker/Trusted는 정확 새 Head CI 실행 전 NOT TESTED.
- AC6: #552의 실제 정식 GHCR/tag/release/digest/Finalizer·Issue close는 새 변경 PR 전체 검증·병합·Main 후 기존 Owner release authorization과 정확 실행 증거를 확보해야 가능, 본 PR에서 미수행.

## HIGH RISK QA / HANDOFF

- 변경 코드가 자기 검증기/보안 경로를 다루므로 정확 Head에 관한 독립 검토, 경계 테스트, provenance API·re-run·pagination 원본, false-positive/false-negative 확인을 최종 QA에서 재검증할 것.
- PR CI 시작 후 신규 Head의 실제 Run ID/Attempt, QA Trusted 결과, 미해결 Review thread 0, 충돌 없음은 GitHub 원본으로 확인할 것. CI 결과 모니터링은 사용자 요청에 따라 수행하지 않음.
- PR 병합·정식 GHCR·#712 또는 #552 종료는 별도 Owner 승인 및 실제 후속 게이트 전 금지.
