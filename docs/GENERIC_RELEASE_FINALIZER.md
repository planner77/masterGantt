# Generic Release Finalizer

Issue #350에서 Issue별 one-shot finalizer를 제거하고 main CI 이후 lifecycle을 하나의 공용 경로로 통합한다.

## Trigger

`.github/workflows/release-finalizer.yml`은 `CI`의 `workflow_run.completed` 중 triggering branch가 `main`인 경우만 생성된다. Job mutation은 추가로 다음을 모두 요구한다.

- triggering event = `push`
- head branch = `main`
- conclusion = `success`

따라서 PR CI, feature branch CI, 수동 `workflow_dispatch` CI, 실패/취소 main CI는 lifecycle mutation을 수행하지 않는다.

## Exact mapping

`scripts/auto_release_finalizer.py`는 workflow가 시작될 때의 **현재 main snapshot**을 authority로 잡고 first-parent chain을 뒤로 탐색한다. 가장 가까운 완료 boundary(FINAL marker 또는 legacy closed Issue) 다음의 미완료 merge를 oldest → newest 순서로 처리한다.

1. 각 merge commit과 연결된 PR 중 `merge_commit_sha == target SHA`, base=`main`, same repository, merged=true인 PR이 정확히 1개여야 한다.
2. PR body에는 정확히 하나의 canonical `Refs #<Issue>` 줄이 있어야 한다.
3. 선행 merge의 exact main CI가 아직 SUCCESS가 아니면 mutation 없이 `DEFERRED`하고, 이후 main CI 완료 이벤트가 backlog를 다시 계산한다.
4. CI 완료 이벤트 순서가 main first-parent 순서와 달라도 release/finalize는 first-parent oldest → newest 순서를 유지한다.
5. 인접한 same-Issue corrective merge는 각 merge의 immediate first-parent diff가 모두 docs-only이거나 모두 non-docs인 경우에만 최신 target으로 수렴한다. 검증 scope가 다르면 coalesce하지 않아 앞선 실패 merge를 우회하지 않는다.
6. coalesce된 모든 PR identity를 보존하고 formal release가 필요하면 release 성공 후 각 merged branch를 `safe_branch_cleanup.py`로 검증·정리한다. 모든 branch cleanup이 PASS하기 전에는 FINAL marker와 Issue close를 수행하지 않는다.
7. ambiguity 또는 누락은 fail-closed이며 branch/tag/Issue mutation을 하지 않는다.

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
- release-image 실패 → 원인 보완 후 동일 release evidence 경로를 재개하며 tag 이동/덮어쓰기를 하지 않는다
- 수동 `issue-lifecycle.yml workflow_dispatch`는 generic 자동 경로가 사용할 수 없는 복구 상황의 fallback으로만 사용한다.
