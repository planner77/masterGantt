# Generic Release Finalizer


### 동일 SHA의 PR required check 재실행 선택

GitHub는 같은 PR head SHA에서 이전 attempt의 실패/cancelled check-run과 최신 재실행의 성공 check-run을 함께 반환할 수 있다. Generic Finalizer는 required check 이름별로 **가장 큰 check-run ID(최신 실행)** 하나만 판정하며, 오래된 실패가 최신 성공을 덮어쓰거나 오래된 성공이 최신 실패를 가리는 것을 허용하지 않는다. 최신 required check가 모두 GitHub Actions SUCCESS인 경우에만 PR gate를 PASS로 취급한다.

## 실행 인스턴스 추적 (#361 / #582)

Generic Finalizer의 workflow 식별자와 trigger는 유지한다. #582부터 `run-name`은 원본 Main의 한 줄 canonical `workflow_run.head_commit.message`를 사용하며 `workflow_run.run_number.run_attempt`와 자체 `github.run_number.github.run_attempt`를 구분하여 표시한다. 예: `Finalizer · Issue #530 · PR #579 · Gantt 복원 경합 보완 · Main #2315.1 · Run #117.1`. 과거 multi-line merge, 신형 prefix 뒤에 개행·본문이 있는 pseudo-canonical 메시지, 직접 Push는 triggering `workflow_run.head_sha`의 짧은 fallback을 사용한다. JSON-escaped CR/LF 검사로 Main CI/Finalizer의 멀티라인 표시를 방지한다. 표시명은 승인·릴리스 권한이 아니며 정확한 SHA → merged PR → canonical `Refs #Issue`를 별도로 확인한다.

승인된 release 경로에서 `issue_lifecycle.py`는 `release-image.yml` workflow dispatch에 Primary Issue와 PR 번호를 input으로 전달한다. 이 metadata는 표시용이며 release authorization, version/tag authority, exact SHA/digest 검증이나 first-parent 처리 순서를 대체하지 않는다.

Issue #350에서 Issue별 one-shot finalizer를 제거하고 main CI 이후 lifecycle을 하나의 공용 경로로 통합한다.

## Trigger

`.github/workflows/release-finalizer.yml`은 `CI`의 `workflow_run.completed` 중 triggering branch가 `main`인 경우만 생성된다. Job mutation은 추가로 triggering event=`push`, head branch=`main`, conclusion=`success`를 모두 요구한다. 따라서 PR CI, feature branch CI, 수동 CI, 실패/취소 main CI는 lifecycle mutation을 수행하지 않는다.

Generic Finalizer와 수동 lifecycle mutation checkout은 credential persistence를 사용하지 않는다. SemVer tag의 존재 확인(`ls-remote`), exact tag fetch, push는 모두 command-scoped auth helper를 사용한다. helper는 inherited `http.extraHeader`를 reset한 뒤 job-scoped `GITHUB_TOKEN` Authorization header 하나만 주입하므로 private repository의 tag read/fetch와 write가 동일한 인증 경계에서 동작하고 `Duplicate header: Authorization`도 방지한다.

Release 완료 재개는 `.github/workflows/release-finalizer-resume.yml`이 담당한다. 이 workflow는 `Publish release image`의 successful `workflow_run.completed`를 fallback으로 구독하는 동시에 `workflow_dispatch(target_sha, release_run_id)`를 지원한다. `release-image.yml`의 publish 성공 후에는 GitHub가 `GITHUB_TOKEN`에 명시적으로 허용하는 `workflow_dispatch`로 Resume을 호출하므로 implicit event delivery 하나에만 의존하지 않는다. Explicit handoff는 source Release run이 아직 active일 수 있으므로 Resume이 exact `release_run_id`를 polling해 `completed/success`, workflow path, head SHA를 확인한 뒤 Generic resolver를 실행한다. 대기는 최대 10분으로 제한하고, 그 안에 completed/success evidence를 확보하지 못하면 Resume만 FAIL하여 lifecycle mutation을 중단한다.

Resume workflow는 write 권한을 가지므로 triggering tag/manual ref의 repository code를 실행하지 않는다. 항상 trusted `main`을 checkout하고 release의 exact target SHA는 lifecycle resolver 입력 데이터로만 전달한다.

## Exact mapping

`scripts/auto_release_finalizer.py`는 workflow가 시작될 때의 **현재 main snapshot**을 authority로 잡고 first-parent chain을 뒤로 탐색한다. **exact target SHA의 FINAL marker만 강한 완료 boundary**로 사용한다. FINAL marker가 없는 closed Issue merge는 재오픈·branch cleanup·release/finalize mutation 대상에서는 제외하지만, first-parent 수집 중에는 **non-actionable ordering barrier**로 유지한다. adjacent same-Issue corrective coalesce가 끝난 뒤에만 해당 barrier를 lifecycle target에서 필터링하므로, closed merge 양쪽의 retry가 인접한 것으로 오인되지 않으면서 더 오래된 미완료 target 탐색도 계속된다. 최종 actionable merge는 oldest → newest 순서로 처리한다.

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
- Issue comment를 100개 단위로 끝까지 pagination한 뒤 **해당 exact application version**의 trusted marker 가운데 가장 최신 comment ID를 authority로 사용한다. 같은 Issue에 서로 다른 버전의 Release가 있더라도 다른 버전의 승인·철회는 현재 버전의 결정을 덮어쓰지 않는다. 동일 버전의 최신 철회는 반드시 BLOCKED이며, 100번째 이후의 승인·철회도 반영한다.
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


## Main verified candidate lifecycle handoff (#452)

Main CI의 successful non-docs `publish-commit-image`는 verified `ci-<SHA>`를 Generic Finalizer 판단 전에 삭제하지 않는다. 즉 artifact job의 책임은 **build/push + exact digest 검증 + handoff**까지다.

- `release_required=false`: lifecycle `finalize`가 branch cleanup과 함께 exact temporary `ci-<merge SHA>` package version을 fail-closed helper로 정리한다.
- `release_required=true`: candidate는 `release_start`/Release workflow가 동일 digest를 formal tag로 promotion할 수 있도록 유지한다.
- release/cleanup 판단 전 Main CI가 version 변경 여부만으로 candidate를 삭제하지 않는다. same-Issue corrective convergence가 immediate merge의 version delta와 다른 lifecycle delta를 가질 수 있기 때문이다.
- no-release candidate cleanup을 수행하는 Generic Finalizer/Resume은 최소 `packages: write`를 사용한다. PR CI/일반 CI 권한은 확대하지 않는다.
- failed immutable release tag는 이동하거나 덮어쓰지 않는다. 결정적 workflow 결함은 새 SemVer corrective merge로 복구한다.


## Issue #483 Resume 후속 Release dispatch 권한

Release completion Resume는 단순한 완료 확인기만이 아니다. 선행 Release를 `release_finalize`한 뒤 first-parent backlog의 다음 target이 `release_required=true`이면 같은 trusted main의 `auto_release_finalizer.py`가 `release-image.yml`을 `workflow_dispatch`할 수 있다.

- 따라서 `release-finalizer-resume.yml`에는 `actions: write`가 필요하다. `actions: read`만 있으면 tag 생성 뒤 `POST /actions/workflows/release-image.yml/dispatches`가 HTTP 403 `Resource not accessible by integration`으로 실패한다.
- Resume는 계속 `ref: main`, `persist-credentials:false`, exact source Release run/SHA/workflow 검증을 유지한다. 권한 확대는 Actions dispatch에만 사용하며 제품 코드나 triggering tag의 코드를 실행하지 않는다.
- Generic `release-finalizer.yml`도 같은 이유로 `actions: write`를 유지한다.
- `scripts/verify-issue-lifecycle.py`가 두 workflow의 `actions: write` 계약을 정적으로 검사한다.
- Issue #461의 `v0.87.1`은 이미 생성된 annotated tag를 authority로 유지하며 tag 이동/재생성 없이 Release dispatch를 재개한다.


## Issue #520 동일 merge SHA 중복 Main CI evidence 선택

PR required check는 같은 head SHA에서도 최신 check-run을 판정하는 기존 정책을 유지한다. 반면 merge 이후의 `main` commit은 immutable하므로, 동일 merge SHA에 여러 push CI가 등록된 경우 lifecycle evidence는 다음과 같이 해석한다.

- `auto_release_finalizer.py`는 동일 exact SHA의 completed/success Main CI가 하나 이상 있으면 성공 run 중 가장 최신 것을 CI evidence로 사용한다.
- `issue_lifecycle.py`는 Main CI run 자체의 SUCCESS만으로 충분하지 않다. 해당 run의 변경 유형에 맞는 `Main 임시 commit 이미지 게시·검증·정리` gate까지 성공/N/A인 run만 authoritative evidence로 선택한다.
- 이후 중복 run의 failed/cancelled 기록은 삭제하거나 성공으로 바꾸지 않는다. successful evidence가 전혀 없으면 최신 exact-SHA run URL을 diagnostics로 보존하고 mutation은 계속 fail-closed한다.
- 이 규칙은 immutable `ci-<SHA>`를 overwrite하는 허용이 아니다. 이미 검증된 exact SHA evidence를 lifecycle이 재사용하는 규칙이다.

#502 merge SHA `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab`에서 #2083.1 SUCCESS 뒤 #2084.1이 기존 `ci-<SHA>` overwrite 거부로 실패한 사례가 #520의 회귀 기준이다.


## Issue #586 — 동일 Issue 다중 Merge의 불변 FINAL (2026-10-10)

설계 결정·대안 비교·운영 복구 조건은 [#586 ADR](ISSUE_586_FINAL_MARKER_ADR.md)을 따른다.

최초 완료 PR의 FINAL marker는 변경하지 않는다. 이후 같은 Issue의 PR이 병합되더라도 각 exact merge SHA의 PR Quality/E2E/Docker, Main CI, docs-only 분류 및 필요한 GHCR candidate 검증을 별도 수행한다. coalesce는 검증된 성공 merge를 삭제하지 않는다. 실패 target의 명시적 corrective supersession만 제한적으로 유지한다.

**first-parent backlog의 완료 경계 판정 전** 그리고 FINAL 기록 전에 모든 기존 FINAL comment를 pagination하여 marker 형식·작성자·PR number·canonical Refs·head SHA/branch·base main·동일 repo·exact merge SHA·main first-parent 계보를 검증한다. 다른 사용자/PR/SHA가 넣은 위조 marker는 정상 완료 경계로 SKIPPED하지 않고 FAIL 처리한다. 동일한 bot-origin PR identity·SHA로 중복 생성된 과거 marker는 중복 mutation 없이 멱등하게 해석하되, 충돌하는 PR identity는 거부한다. 이어서 관련 브랜치(리스·보호·참조·조상)와 GHCR candidate(다른 tag 공유 없음)를 읽기 전용 preflight한다. 안전하지 않은 경우 삭제·FINAL 기록 전에 FAIL한다.

수동 `issue-lifecycle.yml`과 자동 `release-finalizer.yml`/Resume는 `mastergantt-release-finalizer` concurrency group을 공유하고 `queue: max`로 직렬화한다. 동일 SHA의 병렬 FINAL 쓰기 경쟁을 줄이되, 기존에 생성된 완전히 동일한 인증 marker의 멱등 처리는 유지한다. 후속 같은 Issue merge가 미완료라면 앞선 target의 FINAL을 기록하되 Issue close는 지연한다. 정확히 같은 SHA/PR의 재진입은 중복 FINAL/정리 없이 멱등 통과한다. 부수효과 도중 중단된 경우 기존 브랜치 404와 GHCR candidate absent를 안전하게 재검증하고 이어서 진행한다. 새로운/위조된 marker는 무시하지 않고 BLOCKED한다.

실제 #565: PR #583 merge `1ed682dd062012f3d04c2517110835bf7c28ac13`의 기존 FINAL은 불변. PR #585 merge `1839ddb138808068ca06590163ad687d12cab50a`의 Main CI [37954486201](https://github.com/planner77/masterGantt/actions/runs/37954486201) SUCCESS 및 기존 Resume Run [37958294541](https://github.com/planner77/masterGantt/actions/runs/37958294541) FAIL은 과거 증거로 유지한다. 새 버전이 main에 병합되기 전에는 #585 FINAL을 성공으로 소급 기록하지 않으며 GHCR 현재 잔존 여부는 별도 조회해야 한다.

- risk_level=HIGH / qa_required=true; 독립 Reviewer의 exact PR Head 검토 필요
- version 0.103.1 유지; release_required=false / release_authorized=false
- PR 단계에는 병합·Main CI·정식 tag/release·#565 자동 복구를 포함하지 않는다

### #586 수동 Lifecycle 호출의 oldest-first 검증

수동 `issue-lifecycle.yml`의 `finalize`와 `release_finalize`는 Generic Resolver가 사용하는 first-parent pending backlog를 재검사한다. 선택된 PR이 oldest actionable 대상이 아니거나 같은 Issue에 나중 PR이 미완료이면 **변경 전 BLOCKED**하고 자동 Generic Finalizer의 ordered resume을 사용한다. 자동 경로만 `--resolver-ordered`를 전달하며, 수동은 전달하지 않는다. 기존 FINAL을 수동으로 재호출해도 다른 후속 PR의 진행 상태를 확인하지 않고 Issue를 재종료하지 않는다.

### #586 FINAL 이후 close-only 복구

Resolver는 최신 인증 FINAL 경계를 따로 보존하고 OPEN Issue이며 같은 Issue 후속 병합이 없을 때만 `close_resume`을 호출한다. 원본 FINAL·후보/브랜치 cleanup·정식 release는 재실행하지 않는다. 하위 Lifecycle은 Resolver main snapshot을 재검증하여 변경된 first-parent에서 잘못된 종료를 금지한다.

### Issue #586 — 잘못된 Merge 메시지와 실패 Main CI의 복구 (2026-10-11)

원본 PR #588의 merge SHA 490c4ab70b0868729c8415f9f613bd45aa84926a는 여러 줄의 Merge message로 Main CI #2445.1 trace 검증에서 실패했다. 구 SHA의 CI FAIL 및 GHCR/Finalizer SKIPPED 기록을 변경하지 않는다.

기존 supersede_failed_issue_retries 계약에 따라, 같은 Issue #586의 후속 **비문서(non-docs) PR**에서 새 Main CI·GHCR 검증이 성공한 경우에만 이전 실패를 SUPERSEDED ATTEMPT로 표시하고 PR #588의 브랜치 정리 의무를 교정 PR에 인계한다. 후속 PR이 docs-only이거나 Main CI가 실패하면 이전 SHA는 여전히 blocker이다. 다른 Issue가 중간에 있으면 first-parent 순서를 유지한다.

새 교정 PR 병합 시 main_ci_run_name.py의 --as-merge-payload 및 --expected-head-sha로 한 줄 commit_title, 빈 commit_message, 정확한 expected_head_sha를 함께 생성하고 merge_method=merge로 호출한다. 새 exact Main CI/verified GHCR/Finalizer 근거 없이 FINAL 및 Issue close를 완료 주장하지 않는다. 정식 GHCR tag/release는 release_required=false이므로 허용하지 않는다.
