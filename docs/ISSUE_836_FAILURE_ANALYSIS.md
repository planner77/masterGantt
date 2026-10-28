# Issue #836 — 누적 CI 실패 원장 / PR–Main OCI 이미지 조건부 재사용

Primary: [Issue #836](https://github.com/planner77/masterGantt/issues/836) | Work Packet [ISSUE_836](exec-plans/active/ISSUE_836.md) | 최초 기록 2026-10-28

## Run/Attempt 원본 및 이력

- 본 구현 브랜치 `issue-836-verified-oci-reuse`는 PR 생성 전이므로 확인된 PR Full CI Run/Attempt **없음**.
- 직접 실패 0건 **관측 전 상태**. 0건 관측은 CI PASS가 아니며 `NOT TESTED`.
- 필수 Quality/Chromium E2E8/Docker aggregate, Main GHCR build, Release/Finalizer의 신규 HEAD 결과는 현재 **NOT TESTED**.
- PR Full CI 시작 시 실행한 Run/Attempt·HEAD/BASE/TestMerge·작업/Job ID·재시도·실패 원인·직접 vs 파생 여부를 이 파일에 순차 추가한다. 이전 다른 이슈 실패를 #836의 직접 실패로 오인하지 않는다.

## 사전 실패 위험 / 예방 조치 (실행 실패로 계수하지 않음)

| ID | 검토한 위험 경계 | 구현상의 보호 | 원격 실증 |
| --- | --- | --- | --- |
| R836-01 | PR Test-Merge revision label != Main merge SHA, 임의 re-label은 digest 변경 | PR OCI 원래 revision 보존, Release 별도 read-only 신뢰 출처→Main SHA와 exact Main Full 원본 검사 | NOT TESTED |
| R836-02 | 기존 Docker daemon `load: true`에서 OCI SBOM/provenance 소실 | Buildx OCI archive, attestation subject+blob hash, skopeo platform-selected Docker smoke, GHCR preserve-digests | NOT TESTED |
| R836-03 | 다른 PR/Run/Attempt, 합성 merge Tree·버전 변경 | Git Tree equality, two parents, exact `ci-pr-source`, immutable ZIP SHA256 + Work contract | NOT TESTED |
| R836-04 | 구버전 Runner/Buildx/lock/Base 이미지·Next 환경 차이 | `ci_image_contract` fingerprint drift→새 Main 빌드, 위조 receipt→BLOCKED | NOT TESTED |
| R836-05 | GHCR 재게시 시 Manifest index 재인코딩/태그 충돌 | `skopeo --all --preserve-digests`, publish 단계 digest 동치 요구, 기존 immutable ci-SHA tag overwrite guard | NOT TESTED |
| R836-06 | 아직 승인되지 않은 feature 활성화로 증명 없는 PR 이미지 게시 | `PR_IMAGE_REUSE_ENABLED` default OFF/SHADOW. Owner Stage1 독립 승인 전 ON 금지 | NOT TESTED |
| R836-07 | 기존 #773의 Release static/E2E 증거 재사용과 #836 이미지 재사용 혼동 | `RELEASE_REUSE_ENABLED`와 별도 flag 및 별도의 immutable Main Full 증명 | NOT TESTED |

## 실패 분석/교정 절차
1. GitHub 원본 Run ID/Attempt, 정확 PR Head/Base/TestMerge 또는 Main SHA, Workflow path, Job/Step 결론과 artifact SHA를 기록한다.
2. 모든 **실제 직접 실패**와 Policy/Fast Gate/Required3/QA의 **파생 차단**을 분리해 누적 이력으로 보존한다. 단일 최신 실패만 수정 금지.
3. `AGENTS.md`, `docs/PR_CI_FAILURE_TRIAGE.md`, `docs/GITHUB_OPERATIONS.md`, `docs/TEST_PLAN.md`, Work Packet와 본 원장 근거로 수정 후 신규 Head PR CI 실행.
4. 절대 이미 실패한 Run을 PASS로 수정하거나 기존 tag/source/실패 로그를 변조하지 않는다. 미해결 Review/merge conflict와 Owner 위험 승인도 별도다.

현재 이슈 `OPEN`, PR CI 미시작, 원격 OCI 소스/릴리스 검증 `NOT TESTED`. 요청 범위: PR CI 시작까지, **모니터링·병합·GHCR Release/Issue 종료 없음**.
