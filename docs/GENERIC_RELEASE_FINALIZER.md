# Generic Release Finalizer


### 동일 SHA의 PR required check 재실행 선택

GitHub는 같은 PR head SHA에서 이전 attempt의 실패/cancelled check-run과 최신 재실행의 성공 check-run을 함께 반환할 수 있다. Generic Finalizer는 required check 이름별로 **가장 큰 check-run ID(최신 실행)** 하나만 판정하며, 오래된 실패가 최신 성공을 덮어쓰거나 오래된 성공이 최신 실패를 가리는 것을 허용하지 않는다. 최신 required check가 모두 GitHub Actions SUCCESS인 경우에만 PR gate를 PASS로 취급한다.

## 실행 인스턴스 추적 (#361)

Generic Finalizer의 workflow 식별자와 trigger는 그대로 유지하면서 `run-name`은 triggering Main CI의 `workflow_run.display_title`을 계승한다. 따라서 PR 단계에서 검증된 Primary Issue/PR trace가 Main CI 표시명에 보존되어 있으면 Finalizer Actions 목록에서도 같은 문자열을 검색할 수 있다. Finalizer 자체 재실행은 별도의 `github.run_number.github.run_attempt`로 구분한다.

승인된 release 경로에서 `issue_lifecycle.py`는 `release-image.yml` workflow dispatch에 Primary Issue와 PR 번호를 input으로 전달한다. 이 metadata는 표시용이며 release authorization, version/tag authority, exact SHA/digest 검증이나 first-parent 처리 순서를 대체하지 않는다.

Issue #350에서 Issue별 one-shot finalizer를 제거하고 main CI 이후 lifecycle을 하나의 공용 경로로 통합한다.

## Trigger

`.github/workflows/release-finalizer.yml`은 `CI`의 `workflow_run.completed` 중 triggering branch가 `main`인 경우만 생성된다. Job mutation은 추가로 triggering event=`push`, head branch=`main`, conclusion=`success`를 모두 요구한다. 따라서 PR CI, feature branch CI, 수동 CI, 실패/취소 main CI는 lifecycle mutation을 수행하지 않는다.

Release 완료 재개는 `.github/workflows/release-finalizer-resume.yml`이 담당한다. 이 workflow는 `Publish release image`의 successful `workflow_run.completed`를 fallback으로 구독하는 동시에 `workflow_dispatch(target_sha, release_run_id)`를 지원한다. `release-image.yml`의 publish 성공 후에는 GitHub가 `GITHUB_TOKEN`에 명시적으로 허용하는 `workflow_dispatch`로 Resume을 호출하므로 implicit event delivery 하나에만 의존하지 않는다. Explicit handoff는 source Release run이 아직 active일 수 있으므로 Resume이 exact `release_run_id`를 polling해 `completed/success`, workflow path, head SHA를 확인한 뒤 Generic resolver를 실행한다. 대기는 최대 10분으로 제한하고, 그 안에 completed/success evidence를 확보하지 못하면 Resume만 FAIL하여 lifecycle mutation을 중단한다.

Resume workflow는 write 권한을 가지므로 triggering tag/manual ref의 repository code를 실행하지 않는다. 항상 trusted `main`을 checkout하고 release의 exact target SHA는 lifecycle resolver 입력 데이터로만 전달한다.

## Exact mapping

`scripts/auto_release_finalizer.py`는 workflow가 시작될 때의 **현재 main snapshot**을 authority로 잡고 first-parent chain을 뒤로 탐색한다. 가장 가까운 완료 boundary(FINAL marker 또는 legacy closed Issue) 다음의 미완료 merge를 oldest → newest 순서로 처리한다.

1. 각 merge commit과 연결된 PR 중 `merge_commit_sha == target SHA`, base=`main`, same repository, merged=true인 PR이 정확히 1개여야 한다.
2. PR body에는 정확히 하나의 canonical `Refs #<Issue>` 줄이 있어야 한다.
3. 선행 merge의 exact main CI가 아직 SUCCESS가 아니면 mutation 없이 `DEFERRED`하고, 이후 main CI 완료 이벤트가 backlog를 다시 계산한다.
4. CI 완료 이벤트 순서가 main first-parent 순서와 달라도 release/finalize는 first-parent oldest → newest 순서를 유지한다.
5. 인접한 same-Issue corrective merge는 각 merge의 immediate first-parent diff가 모두 docs-only이거나 모두 non-docs인 경우에만 최신 target으로 수렴한다. 검증 scope가 다르면 coalesce하지 않아 앞선 실패 merge를 우회하지 않는다.
6. coalesce된 모든 PR identity를 보존하고 formal release가 필요하면 release 성공 후 각 merged branch를 `safe_branch_cleanup.py`로 검증·정리한다. 모든 branch cleanup이 PASS하기 전에는 FINAL marker와 Issue close를 수행하지 않는다.
7. ambiguity 또는 누락은 fail-closed이며 branch/tag/Issue mutation을 하지 않는다.
8. exact main CI는 SUCCESS지만 immutable version tag의 exact `release-image`가 completed non-success로 끝난 경우, later same-Issue corrective merge가 exact main CI SUCCESS이고 validation scope가 동등 이상이면 오래된 release target을 supersede할 수 있다. 실패한 tag는 이동·덮어쓰기하지 않고 이전 PR branch cleanup 의무를 corrective target으로 이관한다. exact release가 아직 실행 중이면 `DEFERRED`하며 supersede하지 않는다.

## Release required 판정

merge commit의 first parent와 merge target의 `package.json.version`을 비교한다.

- version 동일 → `release_required=false` → 기존 `issue_lifecycle.py finalize`
- version 변경 → `release_required=true` → 명시적 release 승인 필요

CI 성공이나 version bump 자체는 release 승인이 아니다.

## Release authorization marker

정식 release 승인은 **Issue comment**에 version-scoped marker로 남긴다. Manager/승인된 운영 도구는 사용자의 명시적 정식 release 요청을 확인한 뒤 merge 전에 다음 형식으로 기록한다.

```text
<!-- mastergantt-release-authorization:v1 {"authorized":true,"expected_version":"0.59.0","note":"사용자가 GHCR 정식 게시를 명시적으로 승인함"} -->
```

검증 규칙:

- 현재 개인 소유 저장소에서는 `author_association=OWNER`인 comment만 신뢰한다. 조직 저장소로 이전할 경우 별도 permission-check 설계 없이 이 범위를 넓히지 않는다.
- Issue comment를 100개 단위로 끝까지 pagination한 뒤 최신 trusted marker를 authority로 사용한다. 100번째 이후의 승인·철회도 반드시 반영한다.
- `expected_version`이 merge target version과 정확히 일치해야 한다.
- `authorized=false`는 동일 version의 명시적 철회다.
- version이 변경됐는데 유효 marker가 없으면 finalizer는 `BLOCKED`로 실패하고 mutation하지 않는다.
- 승인 marker를 추가한 뒤 기존 failed finalizer job을 재실행하는 것이 기본 복구 경로다.

## Release / Finalize

승인된 release는 기존 `scripts/issue_lifecycle.py release_finalize`를 호출한다. 이 경로는 annotated SemVer tag, `release-image.yml`, GHCR exact image/digest smoke, stable alias promotion, safe branch cleanup, FINAL marker, Issue close를 그대로 재사용한다. same-Issue corrective merge가 수렴된 경우에는 latest PR뿐 아니라 함께 보존한 이전 PR branch도 모두 cleanup 대상이다.

No-release 변경은 `finalize`만 호출하여 동일한 multi-PR safe branch cleanup을 완료한 뒤 FINAL marker와 Issue close를 수행한다.

## Concurrency

`release-finalizer.yml`, `issue-lifecycle.yml`, `release-image.yml`은 동일 mutation 종류를 직렬화하고 GitHub Actions의 `queue: max`를 사용한다. `queue: max`는 burst 실행의 pending 보존에 사용하지만 **semantic release 순서를 보장하는 근거로 사용하지 않는다**. GitHub는 concurrency 처리 순서를 보장하지 않으므로 Generic Finalizer가 현재 main first-parent backlog를 매 실행마다 재계산하고 oldest → newest 순서로 처리한다. 따라서 CI 완료 이벤트가 뒤집혀도 낮은 version merge가 높은 version merge보다 먼저 lifecycle을 통과한다.

## Legacy workflow policy

다음 Issue별 lifecycle 파일 패턴은 금지한다.

- `issue-<N>-release-helper.yml`
- `issue-<N>-release-finalizer.yml`
- `issue-<N>-finalizer.yml`
- lifecycle 용도의 `issue-<N>-cleanup.yml`

`scripts/verify-issue-lifecycle.py`가 이를 CI에서 검사한다. 독립 evidence/test workflow는 lifecycle mutation을 수행하지 않는 경우에만 별도 목적과 근거를 명시하여 유지한다.

## Recovery

- release approval 부족 → 승인 marker 기록 후 failed generic finalizer 재실행
- safe branch cleanup blocker → stacked/open PR dependency 정리 후 기존 run 재실행
- release-image 실패 → 동일 immutable tag를 반복 덮어쓰지 않는다. 동일 source에서 재실행 가능한 일시 실패면 기존 release run을 재개하고, 결정적 제품/회귀 결함이면 later same-Issue corrective merge를 새 SemVer로 검증해 release-failure supersession 경로를 사용한다.
- 수동 `issue-lifecycle.yml workflow_dispatch`는 generic 자동 경로가 사용할 수 없는 복구 상황의 fallback으로만 사용한다.

## Issue #435 Event-driven release completion

Generic Finalizer는 release-required target을 하나의 장시간 동기 job으로 처리하지 않는다.

1. Main CI SUCCESS event에서 backlog를 oldest → newest로 해석한다.
2. release가 필요 없으면 기존 `finalize`를 즉시 실행한다.
3. release가 필요하고 승인되었으며 state가 `not-started`이면 내부 전용 `release_start` operation으로 annotated tag와 `release-image.yml` dispatch까지만 수행하고 종료한다.
4. `tagged` 또는 `in-progress`이면 mutation 없이 DEFERRED한다.
5. `failed`이면 Issue/branch를 유지하고 기존 release run 재실행을 기다린다. 새 tag나 duplicate release를 만들지 않는다.
6. `Publish release image`의 exact/rolling tag promotion이 성공하면 release workflow가 `release-finalizer-resume.yml`을 `workflow_dispatch(target_sha, release_run_id)`로 명시적으로 호출한다. 기존 `workflow_run.completed` 구독도 fallback으로 유지한다.
7. Explicit Resume은 source Release run이 `completed/success`가 될 때까지 exact run ID를 polling하고, source workflow path와 `head_sha == target_sha`까지 확인한다. 그 뒤 exact tag/head SHA의 successful release evidence가 있을 때만 `release_finalize`를 호출해 safe cleanup, FINAL marker, Issue close를 수행한다.
8. publication 이후 handoff job은 `continue-on-error`로 release 성공 자체를 뒤집지 않는다. explicit dispatch가 실패해도 workflow_run fallback과 이후 Main CI backlog 재평가가 복구 경로로 남는다.

따라서 release 실행시간만큼 Finalizer runner를 polling에 묶지 않으며, 정상 경로에서는 release 성공 후 lifecycle이 자동 재개된다. Release workflow 자체의 repository-wide serialization과 immutable/stable alias 정책은 그대로 유지한다.
