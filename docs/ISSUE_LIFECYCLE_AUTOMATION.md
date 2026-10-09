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

병합은 Actions가 quality gate를 우회해 직접 수행하지 않는다. 기본 경로는 **Ruleset + Required Checks + Review/Conversation Resolution + GitHub Auto-merge**다. QA의 위험도별 선택·운영상 Manager ACCEPT는 [QA_REVIEW_POLICY.md](QA_REVIEW_POLICY.md)가 Source of Truth이며, 기존 Ruleset은 이를 전부 기계적으로 강제하지 않는다.

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
- PLAN/PR 최신 Head의 `risk_level`/`risk_reason`/`qa_required`/실제 reviewer/qa_evidence 기록
- `qa_required=true`이면 별도 qa_docs 또는 승인된 인간 Reviewer의 정확한 Head 독립 QA_FINAL PASS, `qa_required=false`이면 조건을 충족하는 LOW/일부 MEDIUM의 `QA_FINAL=N/A(reason)`
- 위 증거와 문서 동기화 결과를 확인한 **Manager ACCEPT** (CI PASS 또는 Ruleset의 승인 리뷰 수 0으로 대체하지 않음)

PR head가 바뀌면 이전 head의 required CI/최종 QA PASS 또는 N/A evidence는 stale이다. #580 자동 QA Job은 후속 이슈이며 #565에서 새 required check를 도입하거나 기존 3개를 완화하지 않는다.

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

## 11. 구현 상태 — Issue #211

Issue #198에서 정의한 목표를 Issue #211에서 `.github/workflows/issue-lifecycle.yml`로 구현한다. 공식 entry point는 `workflow_dispatch`이며 `verify / release / finalize` operation을 제공한다.

- 식별 입력은 Issue/PR 번호이며 branch/SHA/version은 원격 상태에서 재도출한다.
- PR required checks와 exact PR `merge_commit_sha`의 main CI만 evidence로 인정한다.
- `release_required / release_authorized / expected_version / authorization_note` 경계를 fail-closed로 검증한다.
- formal release는 기존 `release-image.yml`, branch 삭제는 `scripts/safe_branch_cleanup.py`를 재사용한다.
- lifecycle workflow 자체에는 `packages: write`를 부여하지 않는다.
- FINAL은 `<!-- issue-lifecycle-final:<issue>:<target_sha> -->`로 PR/merge SHA별 불변 증거를 남긴다. 완료 경계 판단 시점에 bot 작성자·canonical Refs·head/merge SHA·main first-parent를 인증한다. 동일 identity의 재진입은 멱등, 다른 과거 exact SHA의 정상 marker는 허용하되 위조·충돌 기록은 fail-closed한다. 수동·자동·Resume lifecycle mutation은 동일 직렬화 group으로 동시 쓰기 경쟁을 방지한다.
- PR 단계 contract/scenario 검증은 `scripts/verify-issue-lifecycle.py`를 CI quality job에서 수행한다.
- main 병합 후 non-destructive `verify` 실제 실행을 확보한 다음 기존 Issue별 helper의 퇴역 가능 여부를 판단한다.


## 12. release와 finalize 통합 운영 (#248)

현재 범용 lifecycle 구현에서 `finalize`는 `release_required=true`이면 내부적으로 정식 release를 확보한 뒤 branch cleanup, FINAL comment, Issue close를 수행한다. 따라서 현재 구현도 한 번의 `finalize` dispatch로 release와 종료를 연속 수행할 수 있다. 그러나 operation 이름만 보면 `release` 후 `finalize`를 별도로 실행해야 하는 것으로 오해하기 쉬우므로 Issue #248에서 명시적인 `release_finalize` operation을 도입한다.

### 목표 operation 의미

| operation | 의미 | Issue close |
| --- | --- | --- |
| `verify` | read-only lifecycle evidence 검증 | 아니오 |
| `release` | 승인된 정식 release만 수행 | 아니오 |
| `finalize` | release가 불필요한 종료 또는 기존 release evidence를 포함한 종료 | 예 |
| `release_finalize` | 승인된 정식 release → cleanup → FINAL → Issue close 일괄 수행 | 예 |

`release_finalize`의 필수 입력은 `release_required=true`, `release_authorized=true`, 정확한 `expected_version`, 추적 가능한 `authorization_note`다. 어느 하나라도 누락되거나 exact merge SHA의 main CI가 성공하지 않았으면 mutation을 시작하지 않는다.

### fail-closed 순서

```text
verify exact Issue/PR/head/merge SHA/version/checks/main CI
→ ensure formal release
→ verify exact release-image success evidence
→ safe branch cleanup
→ FINAL evidence
→ Issue completed close
```

release 실패, timeout, tag 충돌, wrong SHA, lightweight tag, release evidence 부재, branch cleanup 실패, FINAL marker 충돌 중 하나라도 발생하면 Issue를 열린 상태로 유지한다.

### idempotency

동일 merge SHA와 annotated `v<version>` tag에 대해 성공한 `release-image.yml` evidence가 이미 존재하면 게시를 반복하지 않고 다음 단계로 재개한다. 이미 동일 FINAL marker로 종료된 대상은 destructive 작업을 반복하지 않아야 한다. 다른 target SHA의 tag/FINAL marker는 재사용하지 않는다.

### 구현 전 임시 운영

Issue #248 구현 전에는 정식 release+종료를 한 번에 수행해야 할 때 기존 `finalize`를 `release_required=true`, `release_authorized=true`, 정확한 `expected_version`, 승인 근거가 있는 `authorization_note`와 함께 실행할 수 있다. 별도의 `release` 선행 실행은 필수는 아니다.

## 13. one-shot finalizer 임시 운영과 재실행

범용 `.github/workflows/issue-lifecycle.yml`의 `workflow_dispatch`가 표준 entry point다. 다만 연결된 실행 도구가 workflow dispatch mutation을 제공하지 않고 사용자가 #283/#266과 동일한 자동 finalize 패턴을 명시적으로 요청한 경우에는, 한 번의 main push로 실행되는 `issue-<N>-finalizer.yml`을 임시 운영 경로로 사용할 수 있다. 이는 범용 lifecycle을 대체하는 새 표준이 아니며, 관성적인 Issue별 helper 생성 금지 원칙의 예외다.

### 실행 식별

one-shot finalizer PR이 main에 병합되면 같은 merge SHA에서 다음이 독립적으로 발생할 수 있다.

1. 일반 `ci.yml` Main CI
2. `issue-<N>-finalizer.yml`의 finalizer run

따라서 “CI #NNNN” 하나만으로 자동 finalize 성공을 판정하지 않는다. merge SHA의 check-runs/workflow-runs를 조회하여 **workflow 이름, job 이름, run ID**를 각각 확인한다. 예를 들어 일반 Main CI가 성공해도 `Finalize and close Issue <N>` job은 별도 run에서 실패할 수 있다.

### fail-closed 실패와 재개

finalizer는 `scripts/safe_branch_cleanup.py`가 다음과 같은 조건을 발견하면 Issue close 전에 실패해야 한다.

- 다른 Open PR이 feature branch를 base/head로 사용
- remote branch tip이 merged PR head와 불일치
- target main이 merged head를 포함하지 않음
- 보호 branch 또는 삭제 안전 조건 불충족

이 경우 수동 branch 삭제나 Issue close로 우회하지 않는다. 먼저 blocker를 제거한다. stacked PR 때문에 feature branch를 base로 사용 중이었다면 후속 PR을 최신 main 또는 올바른 선행 branch로 재정렬하고 base를 갱신한다.

blocker가 해소된 뒤에는 다음 우선순위를 따른다.

1. 기존 failed finalizer workflow run/job이 재실행 가능한지 확인
2. 가능하면 **동일 run의 failed job 재실행** 또는 failed workflow rerun
3. exact merge target/main CI/release evidence를 lifecycle script가 다시 검증하게 함
4. branch cleanup → FINAL marker → Issue completed close 확인
5. 기존 run 재사용이 불가능하거나 workflow 파일이 더 이상 유효하지 않을 때만 Manager 승인 하에 새 one-shot finalizer PR을 만든다

재실행 전에는 Issue가 아직 open인지, FINAL marker가 없는지, feature branch가 존재하는지, blocker였던 Open PR 참조가 실제로 제거됐는지 다시 확인한다. 재실행 후에는 일반 Main CI와 finalizer run을 혼동하지 않고 각각의 결과를 Issue STATUS/FINAL에 기록한다.



### #586 다중 PR FINAL·부분 종료 방지

동일 Issue의 모든 성공 Main merge를 개별 SHA로 검증한다. 과거 FINAL marker는 불변 감사 대상이며 안전한 PR/head/merge/base/canonical Refs/first-parent 확인을 통과할 때만 후속 FINAL을 기록한다. Finalizer는 FINAL과 candidate/branch preflight를 삭제보다 앞서 수행하고 중간 실패 뒤에는 기존 부수효과를 멱등 확인하여 재시도한다. 동일 Issue 후속 target이 pending이면 close하지 않는다. 원본 사건 #565/#583/#585는 [GENERIC_RELEASE_FINALIZER.md](GENERIC_RELEASE_FINALIZER.md)를 참조한다.

### Issue #586: 수동 FINAL 순서 검증

수동 dispatch `finalize`/`release_finalize`는 현재 main의 first-parent backlog를 재검증하여 자신이 **최초 미완료 actionable PR**이고 동일 Issue의 더 최신 미완료 PR이 없는 경우에만 삭제/FINAL 단계로 진행한다. 그렇지 않으면 어떤 브랜치/GHCR/Issue mutation도 실행하지 않고 Generic Finalizer 재개를 요구한다. 자동 Resolver의 `--resolver-ordered`는 내부 검증 계약이며 수동 workflow input으로 노출하지 않는다. 이미 존재하는 정확한 FINAL의 수동 재호출은 close를 수행하지 않는다.
