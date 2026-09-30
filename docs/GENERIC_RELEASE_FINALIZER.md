# Generic Release Finalizer

Issue #350에서 Issue별 one-shot finalizer를 제거하고 main CI 이후 lifecycle을 하나의 공용 경로로 통합한다.

## Trigger

`.github/workflows/release-finalizer.yml`은 `CI`의 `workflow_run.completed` 중 triggering branch가 `main`인 경우만 생성된다. Job mutation은 추가로 다음을 모두 요구한다.

- triggering event = `push`
- head branch = `main`
- conclusion = `success`

따라서 PR CI, feature branch CI, 수동 `workflow_dispatch` CI, 실패/취소 main CI는 lifecycle mutation을 수행하지 않는다.

## Exact mapping

`scripts/auto_release_finalizer.py`는 `workflow_run.head_sha`를 authority로 사용한다.

1. commit과 연결된 PR 중 `merge_commit_sha == target SHA`, base=`main`, same repository, merged=true인 PR이 정확히 1개여야 한다.
2. PR body에는 정확히 하나의 canonical `Refs #<Issue>` 줄이 있어야 한다.
3. ambiguity 또는 누락은 fail-closed이며 branch/tag/Issue mutation을 하지 않는다.

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

- `author_association`이 `OWNER`, `MEMBER`, `COLLABORATOR` 중 하나인 comment만 신뢰한다.
- 최신 trusted marker가 authority다.
- `expected_version`이 merge target version과 정확히 일치해야 한다.
- `authorized=false`는 동일 version의 명시적 철회다.
- version이 변경됐는데 유효 marker가 없으면 finalizer는 `BLOCKED`로 실패하고 mutation하지 않는다.
- 승인 marker를 추가한 뒤 기존 failed finalizer job을 재실행하는 것이 기본 복구 경로다.

## Release / Finalize

승인된 release는 기존 `scripts/issue_lifecycle.py release_finalize`를 호출한다. 이 경로는 annotated SemVer tag, `release-image.yml`, GHCR exact image/digest smoke, stable alias promotion, safe branch cleanup, FINAL marker, Issue close를 그대로 재사용한다.

No-release 변경은 `finalize`만 호출하여 safe branch cleanup, FINAL marker, Issue close를 수행한다.

## Concurrency

`release-finalizer.yml`, `issue-lifecycle.yml`, `release-image.yml`은 동일 mutation 종류를 직렬화하고 `queue: max`를 사용한다. 근접한 여러 merge/release가 pending replacement로 유실되지 않게 하며, 정식 GHCR stable alias가 이전 version으로 역행하는 병렬 경쟁을 방지한다.

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
