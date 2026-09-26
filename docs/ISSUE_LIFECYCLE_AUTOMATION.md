# Issue Lifecycle Automation 운영 기준

적용 Issue: #198

이 문서는 `docs/ISSUE_LIFECYCLE.md`의 실행 절차를 GitHub Actions, Ruleset, Auto-merge와 연결하는 운영 기준이다. 요구사항 해석·설계·구현 판단은 Manager/Agent가 담당하고, 반복 가능하고 기계적으로 검증 가능한 gate는 GitHub Actions와 GitHub native protection으로 처리한다.

## 1. 책임 경계

### Manager / Agent

다음 항목은 자동화가 임의 결정하지 않는다.

- Issue 요구사항 명확화
- Acceptance Criteria / Definition of Done 정의
- 영향도 분석과 구현 계획
- `release_required`, `release_authorized` 판단
- Target Version 결정
- 작업 branch 생성과 코드·테스트·문서 구현
- Version bump
- CI/Review 실패 원인 분석과 REWORK

### GitHub Actions / GitHub Native

다음 항목은 자동화를 기본 경로로 사용한다.

- PR `quality`, `e2e`, `docker` 검증
- version/문서/배포 계약의 기계적 검증
- main 재검증
- main 임시 `ci-<full SHA>` GHCR 게시, exact digest smoke, cleanup
- 승인된 정식 release 검증과 GHCR 게시
- fail-closed branch cleanup
- 완료 evidence comment
- 모든 required gate가 충족된 경우 Issue close

병합은 Actions가 quality gate를 우회해 직접 수행하지 않는다. 기본 경로는 **Ruleset + Required Checks + Review/Conversation Resolution + GitHub Auto-merge**다.

## 2. Lifecycle Gate

### Gate A — READY_FOR_DEVELOPMENT

다음이 모두 확정되어야 한다.

- 목표/배경/비범위
- Acceptance Criteria / Definition of Done
- 현재 main/관련 PR·Issue 상태
- 영향 범위와 구현 계획
- 담당 역할과 파일 소유권
- Target Version 또는 version 유지 근거
- `release_required`, `release_authorized`와 근거

### Gate B — READY_FOR_PR

다음이 모두 완료되어야 한다.

- 구현
- 관련 테스트
- Local Fast Feedback
- DOCUMENTATION_SYNC
- package/lockfile/version 정합성
- known risk 및 Environment-specific Validation 식별

### Gate C — READY_FOR_MERGE

최신 PR head SHA 기준으로 다음이 필요하다.

- `quality` PASS
- `e2e` PASS
- `docker` PASS
- blocking review/thread 없음
- Ruleset 충족
- 필요 시 최신 main 재정렬 후 새 head에서 required CI 재실행

PR head가 바뀌면 이전 head의 required CI/최종 QA evidence는 stale이다.

### Gate D — READY_FOR_RELEASE

merge SHA 기준으로 다음이 필요하다.

- main CI PASS
- temporary GHCR `ci-<full SHA>` 게시 PASS
- exact digest pull/runtime smoke PASS
- SBOM/provenance 확인
- temporary GHCR cleanup PASS

정식 release가 필요한 경우 추가로:

- `release_required=true`
- `release_authorized=true`
- annotated `v<version>` tag
- `release-image.yml` PASS
- GHCR exact version digest smoke PASS
- stable release의 rolling tag promotion 확인

### Gate E — DONE

다음이 모두 충족되어야 한다.

- Acceptance Criteria별 evidence 확보
- 필요한 environment validation 상태 기록
- 안전한 작업 branch cleanup 완료 또는 명시적 BLOCKED
- FINAL comment 기록
- Issue를 `completed`로 close

## 3. GitHub Actions 구조

기본 공용 workflow는 다음 책임을 유지한다.

### `.github/workflows/ci.yml`

- PR/main application validation
- Chromium E2E
- Docker/runtime/SQLite/transport smoke
- main 성공 후 temporary commit image publish/digest smoke/cleanup

PR과 수동 CI는 registry write를 하지 않는다.

### `.github/workflows/release-image.yml`

- annotated SemVer tag 검증
- package/tag 일치와 monotonic version 검증
- release quality/E2E/container gate
- GHCR exact version publish
- published digest 재검증
- stable alias promotion

### 범용 `.github/workflows/issue-lifecycle.yml` 목표

Issue #198에서 구현한다.

- 특정 Issue 번호, branch, SHA, version을 source에 hard-code하지 않는다.
- 기존 `ci.yml`, `release-image.yml`, `scripts/safe_branch_cleanup.py`를 재사용한다.
- 상태 검증은 fail-closed로 수행한다.
- stale SHA, 충돌하는 release tag, 보호 branch, 다른 Open PR이 참조하는 branch에서는 중단한다.
- Issue close는 마지막 단계에서만 수행한다.
- 신규 Issue별 `issue-<N>-release-helper.yml`은 만들지 않는다.

권장 operation:

- `verify`: 현재 lifecycle/gate 상태 확인
- `release`: 명시적으로 승인된 정식 release 실행
- `finalize`: main/release evidence 검증 → branch cleanup → FINAL → close

## 4. 작업 Branch Cleanup

공통 `scripts/safe_branch_cleanup.py`를 사용한다.

삭제 조건:

- PR이 merged 상태
- PR base가 `main`
- 요청 branch가 실제 merged PR head branch와 일치
- 현재 remote branch tip이 merged PR head SHA와 일치
- target main SHA가 merged PR head를 포함
- protected branch가 아님
- 다른 Open PR이 해당 branch를 head/base로 사용하지 않음
- 삭제 직전 remote ref SHA 재확인
- SHA lease 기반 삭제
- 삭제 후 ref 부재 확인

조건을 만족하지 않으면 자동 삭제하지 않는다.

## 5. Ruleset 목표 설정

2026-09-26 재검증 기준 `main-lifecycle-gate` Ruleset은 Active이며 default branch에 적용된다. Branch protection 상세 endpoint는 연결된 GitHub App의 administration 권한 제한으로 직접 검증하지 못했다.

현재 적용값:

- Require a pull request before merging: ON
- Require status checks before merging: ON
- Required checks:
  - `Build, static checks, and unit tests`
  - `Chromium end-to-end tests`
  - `Docker build and runtime smoke test`
- Required check source: GitHub Actions
- Require branches to be up to date before merging: ON
- Require conversation resolution: ON
- Allowed merge method: merge commit
- Block force pushes: ON
- Block branch deletion: ON
- broad bypass: 없음
- linear history: 현재 merge commit 운용과 충돌하므로 OFF

PR이 `behind`이면 Update branch 또는 재정렬 후 새 head에서 required checks를 다시 통과해야 한다.

### GitHub UI 설정 경로

Repository → **Settings → Rules → Rulesets**

1. New branch ruleset
2. Target branch: `main`
3. 위 보호 규칙 활성화
4. Required status checks에 실제 CI check 이름 등록
5. Enforcement를 Active로 전환
6. 테스트 PR에서 required checks와 conversation resolution이 실제 merge를 차단하는지 확인

workflow/job 표시 이름을 변경할 때는 Ruleset의 required check 참조도 같은 변경에서 갱신한다.

## 6. Auto-merge / Update branch 설정

2026-09-26 재검증 값:

- `allow_auto_merge=true`
- `allow_update_branch=true`

현재 운영값:

- Allow auto-merge: ON
- Always suggest updating pull request branches: ON

GitHub UI:

Repository → **Settings → General → Pull Requests**

- Allow auto-merge 활성화
- 필요 시 Always suggest updating pull request branches 활성화

Auto-merge는 required checks/review/ruleset을 우회하지 않는다. Gate C를 만족한 PR만 자동 병합되도록 사용한다.

현재 연결된 GitHub connector는 repository administration 설정 변경 기능을 제공하지 않으므로 실제 설정 변경이 불가능한 실행에서는 **설정 미적용을 BLOCKED/수동 설정**으로 기록하고 적용 완료를 주장하지 않는다.

## 7. Issue별 Helper 퇴역 정책

- 신규 Issue 전용 release-helper 생성 금지
- 기존 helper는 해당 Issue가 열려 있고 종료 자동화에 실제 필요할 때만 임시 유지
- 범용 lifecycle workflow가 동등 이상의 검증을 제공하면 종료된 helper 제거
- 특정 Issue의 before/after evidence 등 검증 자체가 목적의 workflow는 release-helper와 별도로 판단

## 8. Issue 기록 규칙

Issue는 작업 진행의 기준점이다.

필수 전환 기록:

- `PLAN`: Gate A 완료
- `STATUS`: 주요 phase 전환
- `EXCEPTION`: FAIL/BLOCKED/예상 밖 상태
- `DECISION_REQUIRED`: 사용자/maintainer 결정 필요
- `RESUME`: 중단 후 재개
- `FINAL`: Gate E 직전 완료 evidence

FINAL에는 최소 다음을 기록한다.

- Issue / PR
- PR head SHA
- merge SHA
- application version
- PR CI run
- main CI run
- release_required / release_authorized
- release tag / release run
- GHCR image / exact digest
- branch cleanup 결과
- environment validation
- 남은 위험

## 9. 버전 정책

문서/Agent 지침만 변경하고 application runtime/API/DB/배포 계약에 영향이 없으면 application version은 유지할 수 있다.

반대로 CI/release/runtime 계약 또는 실제 product artifact 의미가 바뀌는 변경은 Manager가 Semantic Version 영향을 판단하고 작업 branch에서 한 번만 반영한다.

## 10. 표준 Issue Lifecycle

```text
Issue
→ Current-state check
→ Analyze
→ AC / DoD
→ Plan
→ Version decision
→ Branch
→ Implement + Tests
→ Local Fast Feedback
→ Documentation Sync
→ PR
→ PR CI
→ Review / Ruleset
→ Rebase or Update branch if required
→ PR CI again
→ Auto-merge
→ Main CI
→ Temporary GHCR digest smoke
→ [Release required + authorized] Formal Release
→ Safe branch cleanup
→ FINAL evidence
→ Issue Close
```

이 순서를 기본값으로 사용하되, 사용자 요청 범위가 PR/CI까지만인 경우 해당 gate에서 멈춘다.
