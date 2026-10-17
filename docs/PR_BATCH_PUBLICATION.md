# PR 변경 묶음 게시 운영 — Issue #679

코드·테스트·문서를 하나의 논리적 수정 묶음으로 준비하고, 검증한 전체 파일 tree를 대상 PR branch에 한 번 게시한다. 여러 로컬 commit을 하나로 squash해야 한다는 뜻이 아니다. 다음 수정이 필요하면 누적 실패 원장과 리뷰를 반영하여 새 묶음을 완성한 뒤 다시 게시한다.

이 절차는 원격 CI 실행 자체를 생략하지 않는다. 최종 PR Head/base/test-merge의 Required Quality/E2E/Docker, Preflight·Trusted QA·리뷰 thread 0·strict main·Owner 승인 및 기존 main/GHCR/Release 계약은 [원격 검증](REMOTE_VALIDATION.md)과 [QA 정책](QA_REVIEW_POLICY.md)을 따른다. 이번 변경은 workflow, 이벤트, concurrency, path filter, Ruleset을 수정하지 않는다.

## 1. 적용과 방식 선택

신규 PR과 기존 PR의 보완 작업에 적용한다. 구현 Agent는 [변경 영향 분석](TEST_PLAN.md)과 [Local Pre-PR](LOCAL_PREPR.md)을 수행하고, 실패 이력이 있는 Issue는 [누적 실패 분석 지침](PR_CI_FAILURE_TRIAGE.md)에 따라 **해당 Issue의 전체 실패 이력**을 먼저 검토한다.

| 방식 | 선택 조건 | 게시 단위와 주의 |
| --- | --- | --- |
| A · local Git | 이미 허용된 write 인증·worktree가 있음 | 여러 local commit의 최종 Head를 단일 branch refspec의 non-force push 1회로 게시 |
| B · Git Data API | 연결된 blob/tree/commit/ref 도구가 실제 허용됨 | 전체 tree·부모 검증 후 신규 branch 생성 또는 expected SHA가 지정된 Ref 갱신 1회 |
| C · Contents staging | A/B 불가, 별도 staging 및 최종 Ref 이동 경로가 허용됨 | 모든 workflow 영향과 open PR 부재를 먼저 확인. live PR branch에 파일별 쓰기를 하면 중간 CI 감소를 보장할 수 없음 |
| D · CI 정책 변경 | 별도 최신 증거·설계·승인으로 필요성 입증 | 이 작업에서는 보류. skip label/manual-only/event 제거로 Required 검증을 대신하지 않음 |

일반 운영은 A가 단순하다. 실행 환경마다 가용성을 확인하며 A를 사용할 수 없다는 이유로 자격증명을 추출하거나 새 토큰/권한을 구성하지 않는다. B 도구가 보안 검사에 차단되면 다른 경로로 같은 금지 작업을 우회하지 않는다. 기능적으로 부족한 경우 허용되는 C 또는 인계를 검토하되 효과를 과장하지 않는다.

진행상황 기록은 Issue/PR 댓글을 사용한다. 단순 상태 표시를 위해 PR 제목·본문을 반복 편집하면 metadata CI가 추가 생성될 수 있다. 최초 PR 생성 시 canonical 제목과 단일 `Refs #679` 같은 Primary Issue 연결을 완성하고, 실제 내용 교정이 필요한 경우에만 본문을 수정한다.

## 2. 로컬 준비 및 검증 도구

`scripts/verify-pr-batch.mjs`는 **읽기 전용 로컬 구조 비교 도구**다. Git 로컬 조회와 입력 JSON 비교만 수행한다. push/Ref 변경/CI 실행·취소, 자동 재시도, credential 설정, Git reset/clean을 하지 않는다. 정상 결과의 `scope=LOCAL_STRUCTURE_ONLY`는 CI·인증·Owner 승인 성공을 의미하지 않는다.

1. 실제 원격 main과 기존 PR Head를 조회·fetch하고 해당 변경을 보존하는 로컬 branch에서 작업한다.
2. 코드·테스트·문서와 누적 실패 원장을 함께 정리한다. `verify:prepr` 및 영향에 맞는 실제 테스트를 실행하고 결과와 미검증 범위를 Work Packet에 남긴다.
3. 변경을 모두 commit한다. staged/unstaged/untracked·충돌·진행 중 merge/rebase가 있으면 prepare는 BLOCKED한다. 실제 변경을 숨길 수 있는 assume-unchanged/skip-worktree 또는 조상 관계를 바꾸는 replace/graft 메타데이터도 BLOCKED하므로 해제·원인 확인 후 재검증한다. 추적 파일에 활성화된 외부 clean/process 필터는 status 조회 전에 탐지·차단한다. 필터가 필요한 저장소는 이 보조 도구의 지원 밖이므로 기존 검토 절차를 사용한다. 출력은 Git 밖 또는 기존 ignored `.prepr-reports/`에 저장한다.
4. 새 CLI 경로는 기존 Pre-PR 선택기에서 batch 테스트로 명시 연결한다. 이 좁은 매핑 외 테스트 정책을 바꾸지 않는다.

신규 branch의 예시다. `<...>`는 직전 실제 조회값으로 대체한다. shell 명령은 인증정보를 인자로 받지 않는다.

```bash
node scripts/verify-pr-batch.mjs prepare \
  --issue=679 --repository=planner77/masterGantt \
  --branch=ci/issue-679-batch-publish \
  --main-sha=<확인한-main-40자리-SHA> --expected-head=ABSENT \
  --method=api > /tmp/issue-679-batch.json
```

기존 branch이면 `--expected-head=<현재-원격-Head-SHA>`를 사용한다. A는 `--method=git`이다. API 조회 오류·권한 불명확을 `ABSENT`로 입력하지 않는다. 부재는 성공한 원격 목록/Ref 조회로 별도 확인해야 한다.

prepare는 local Head/tree, 비교 baseTree, 기대 원격 Head, 최신 main, 게시 부모, source fingerprint와 변경 path/action/mode/blob SHA/크기를 기록한다. 파일 본문·base64·원격 URL·토큰·원문 Git stderr는 manifest에 넣지 않는다. rename은 delete+upsert로 정규화한다. 변경된 symlink/submodule 등 지원하지 않는 특수 모드는 BLOCKED하고 일반 파일 추가·수정·삭제만 다룬다.

출력 envelope의 `manifestSha256`을 **별도 작업 기록에 보존**한다. verify 시 그 값을 외부 인자로 전달하여 manifest와 해시를 함께 바꿔 제출하는 실수를 차단한다. 이 해시는 서명·인증이 아니며 로컬 재구성과 입력 일치 검사를 돕는다.

### 원격 관측 JSON

게시 담당자가 연결된 인증 API에서 **실제로 조회한** branch/main/candidate commit 결과를 다음 최소 형식으로 옮긴다. 임의 작성 JSON만으로 GitHub 인증이나 관측 사실을 증명하지 않는다. 원본 API/commit/branch URL과 조회 시각은 Work Packet 또는 PR 결과 댓글에 함께 기록한다.

```json
{
  "schema": "mastergantt-pr-batch-observation-v1",
  "repository": "planner77/masterGantt",
  "branch": "ci/issue-679-batch-publish",
  "mainSha": "<확인한-main-SHA>",
  "remote": {
    "state": "ABSENT",
    "headSha": null,
    "treeSha": null
  },
  "candidate": {
    "headSha": "<게시할-candidate-SHA>",
    "treeSha": "<실제-candidate-tree-SHA>",
    "parentShas": ["<실제-candidate-parent-SHA>"]
  }
}
```

게시 전 기존 branch는 `state=PRESENT`에 expected Head와 해당 tree를 입력한다. 관측 실패는 `UNKNOWN`이다. 게시 후에는 PRESENT의 Head/tree가 candidate와 일치해야 한다. placeholder·UNKNOWN은 PASS 입력이 아니다.

```bash
node scripts/verify-pr-batch.mjs verify --phase=before \
  --manifest=/tmp/issue-679-batch.json \
  --manifest-sha256=<prepare때-별도-보존한-64자리-해시> \
  --observation=/tmp/issue-679-before.json

# 허용된 Git 또는 API 도구로 아래 3절의 게시 작업 수행

node scripts/verify-pr-batch.mjs verify --phase=after \
  --manifest=/tmp/issue-679-batch.json \
  --manifest-sha256=<동일하게-보존한-해시> \
  --observation=/tmp/issue-679-after.json
```

verify는 local source를 다시 구성하고 manifest hash, branch/Issue/repository, main/expected Head, candidate tree/부모 및 단계별 remote 상태를 대조한다. 누락·불일치·권한 UNKNOWN·stale이면 중단한다. before PASS 직후에도 원격 경합은 가능하므로 게시 도구의 non-force/expected SHA 검사와 **게시 후 재조회**가 모두 필요하다.

## 3. 실제 게시

### A · 단일 Git push

manifest와 before 검증 이후 정확한 source commit을 단일 refspec으로 push한다. 여러 branch/tag를 묶거나 `--force`, `--force-with-lease`, `--mirror`, `--no-verify`를 사용하지 않는다. 여기서는 git 기본 fast-forward 검사를 유지한다.

```bash
git push origin <검증한-local-Head-SHA>:refs/heads/ci/issue-679-batch-publish
```

기존 PR이면 현재 원격 Head가 manifest의 expected Head인지 먼저 재조회한다. main/remote가 이동하면 변경을 가져와 통합·영향 검증 후 새 manifest를 만든다. A의 candidateHead는 localHead와 같아야 한다. 실패/응답 유실은 4절대로 read-back한다.

### B · Git Data API

순서는 `blob → tree → candidate commit → 원격 재조회 → Ref 게시 → read-back`이다. Blob/Tree/Commit 객체 생성만으로 PR branch가 움직이는 것은 아니다.

1. manifest 변경 경로의 blob bytes만 허용된 도구에 전달한다. 반환 blob SHA와 로컬 blob SHA를 비교한다. 파일 본문은 manifest/로그로 출력하지 않는다.
2. manifest의 baseTree에 upsert/delete 전체를 적용한 tree를 만든다. **전체 반환 tree SHA가 검증한 localTree와 같아야 한다.** 변경 파일 몇 개만 비교해서 게시하지 않는다.
3. candidate commit을 만들고 실제 tree와 부모를 조회한다. API가 author/committer/시간을 정하므로 localHead와 candidateHead가 다를 수 있다. 동일 tree라는 이유로 로컬 검증을 원격 exact-Head CI PASS로 기록하지 않는다.
4. 신규 branch는 최신 main을 부모로 사용한다. 기존 branch는 expected Head를 첫 부모로, main이 그 조상이 아니면 main을 추가 부모로 보존한다. 로컬 후보 또한 양쪽 조상을 포함해야 한다. **tree 내용에 최신 main이 들어 있다는 사실만으로 main ancestry를 보존한 것은 아니다.**
5. main/branch를 다시 읽고 before 검증한다. 신규 branch는 candidate에서 생성한다. 기존 branch는 `update_ref(expected_sha=<원래 Head>, sha=<candidate>, force=false)`를 한 번 호출한다.
6. 실제 Ref·candidate를 다시 조회하여 after 검증한다. GitHub 표준 Ref API는 `sha`/`force`를 제공하며 expected_sha는 연결 도구의 추가 계약이다. 문서만으로 서버 내부 원자적 CAS를 단정하지 않는다.
7. 신규 PR을 완성된 metadata로 생성하거나 기존 PR의 synchronize를 확인한다. 최종 Head/base/test-merge/Run/Attempt와 Full CI 시작을 확인하고 결과를 인계한다.

원격 API는 payload 크기/지원 encoding/개체 수 한계가 있다. 이를 넘으면 허용되는 여러 blob 호출로 준비하되 target Ref는 마지막까지 움직이지 않는다. 동일 파일 Contents API로 live PR을 중간 갱신하는 fallback은 자동 수행하지 않는다.

### C · Contents staging

현재 main의 `ci.yml`만 보고 모든 workflow가 staging을 무시한다고 가정하지 않는다. 전체 workflow의 push/create/pull_request/다른 연동과 open PR을 확인해야 한다. 허용된 staging에서 파일별 직렬 commit 후 전체 tree 검증 및 최종 non-force Ref 이동이 가능할 때만 사용한다. 최종 Ref 이동 도구가 없으면 중간 Run 감소를 보장하는 구현으로 보고하지 않고 작업 묶음을 인계하거나 BLOCKED로 남긴다. 이미 생성된 실패·취소 Run은 원장에 유지한다.

## 4. 거부·경합·부분 실패 복구

| 관측 | 판정과 다음 조치 |
| --- | --- |
| blob/tree/commit 준비 중 실패 | Ref를 조회. 미게시이면 완성 객체 식별자만 checkpoint에 남기고 원인 해소 후 재사용. branch rollback 불필요 |
| 게시 직전 expected SHA/main 불일치 | BLOCKED. 실제 새 변경을 통합·검증하고 새 manifest 준비. expected 자동 교체 금지 |
| Ref 요청 응답 유실, 현재 Head=candidate 및 tree 일치 | 게시 완료로 확인. Ref 요청을 반복하지 않고 after/CI 시작 확인 |
| 응답 유실, 현재 Head=expected 또는 인증된 신규 branch 부재 | 미게시로 확인. 권한·소스·부모·현재 main을 재검토한 뒤 동일 candidate로 제한적 재시도 |
| 현재 Head가 expected/candidate와 다름 | 제3자 변경/경합. 추가 write 중단하고 최신 branch 보존·통합 |
| 인증 만료/보안 차단/조회 실패 | UNKNOWN/BLOCKED. 오류를 ABSENT/PASS로 바꾸거나 토큰/보호 규칙으로 우회하지 않음 |
| 게시 후 tree/parent 불일치 | FAIL/BLOCKED. 자동 원복 없이 원인 조사·정방향 corrective/revert 묶음과 새 CI |
| 도구 사용 중단/rollback | 보조 CLI·매핑만 revert 가능. 기존 CI/Ruleset/Trusted/Owner 절차를 계속 사용 |

로컬 fixture가 위 분기를 통과한 것은 입력·Git 구조 계약의 실증이다. 실제 GitHub 권한 만료·서버 경합·자동 승인 거부를 운영에 주입한 증거로 보고하지 않는다. 보안 도구가 거부한 작업은 거부 이유와 안전하게 완료된 범위를 따로 기록한다.

## 5. 실행 수와 비용 측정

게시 횟수, commit 수, synchronize 이벤트, 전체 Run 수는 서로 다른 값이다. Finalizer/Trusted/metadata 및 Main 실행도 Full PR CI와 분리한다. 한 번의 Ref 게시가 플랫폼 전체에서 정확히 한 Run만 만든다고 단정하지 않는다.

묶음마다 다음을 기록한다.

- source local Head/tree/fingerprint, candidate Head/parents, 게시 전후 branch/main, PR base/test-merge.
- 게시 방식, 실제 Ref 요청 수, 의도한 중간 checkpoint와 의도하지 않은 중간 Full Run.
- Run ID/Attempt/Head/event 및 확인한 action, status/conclusion, 취소/미실행 Job도 포함한 원본 기록.
- 유효 started_at→completed_at의 assigned Job 시간 합, 생성→첫 Job 시작 지연, 최종 검증 wall-clock.
- billable Runner 분·금액은 별도 API/청구 근거가 있을 때만 표기. 목적 표본을 보장된 절감률이나 통계적 신뢰구간으로 해석하지 않음.

[기준 측정 JSON](evidence/issue-679/ci-publication-baseline.json)과 [#679 Work Packet](exec-plans/active/ISSUE_679.md)을 참고한다. #618에서는 중간 #2731이 91.22분의 Job 시간 후 stale이 됐지만 #2732~#2739는 jobs=0이었다. #552 최근 Full10회는 모두 실패여서 게시 묶음이 회귀 실패 자체를 줄인다는 근거가 없다.

사용자 범위가 **PR CI 시작까지**이면 Run/Attempt/Head의 생성 snapshot만 확인하고 완료를 기다리지 않는다. 실행시간·성공률·전후 비용 비교는 NOT TESTED로 인계한다. 측정을 위해 새 자동화나 중복 Full CI를 만들지 않는다.

## 6. 기준·공식 자료

- [Git push](https://git-scm.com/docs/git-push): refspec, fast-forward 및 dry-run.
- [GitHub Git references](https://docs.github.com/en/rest/git/refs#update-a-reference): Ref 갱신과 force=false.
- [GitHub workflow triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow): actor/token·이벤트 조건에 따른 실제 실행은 현행 공식 정책과 원격 Run으로 확인.
- [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency): 실행 취소와 대기 규칙.
- [Issue Lifecycle](ISSUE_LIFECYCLE.md), [GitHub 운영](GITHUB_OPERATIONS.md), [CI/CD](CI_CD.md): 이 절차의 승인·검증 경계.
