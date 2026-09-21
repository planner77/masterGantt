# Issue #87 후속 검토와 완료 절차

관련: [Issue Lifecycle](ISSUE_LIFECYCLE.md), [Agent 설정](AGENT_CONFIGURATION.md), [GitHub 운영](GITHUB_OPERATIONS.md), [CI/CD](CI_CD.md), [원격 검증](REMOTE_VALIDATION.md), [테스트 계획](TEST_PLAN.md).

## 후속 요청과 범위 보완

사용자는 UI/UX 역할과 GHCR 포함 Lifecycle 지침을 작성한 뒤, PR #88의 남은 검토·병합·main 검증·브랜치 정리·이슈 종료까지 완료하도록 요청했다. 최초 문서/Agent 설정안은 CI workflow 변경이 없었으나, 후속 단계에서 연결된 GitHub 도구에 branch 삭제 action이 없고 저장소의 `delete_branch_on_merge=false`임을 확인했다.

이에 [한정 정리 workflow](../.github/workflows/issue-87-branch-cleanup.yml)를 추가한다. 이 문서의 후속 범위가 기존 Agent 설정 문서에 기록된 최초안의 'workflow 변경 없음' 설명을 보완한다. 기존 `ci.yml`, `release-image.yml`, 제품 소스/API/DB/의존성, 모델·동시 실행 수와 제품 버전은 변경하지 않는다. 기존 CI/CD 및 원격 검증 gate를 대체하거나 약화하지 않는다.

이번 변경은 제품 산출물 변경이 아닌 Agent 지침과 이 작업의 운영 정리 절차이므로 제품 버전 `0.20.0`을 유지한다. 정식 release_required=false이며 annotated version tag/정식 GHCR release/운영 배포는 N/A다. main 임시 GHCR 게시·digest smoke·cleanup은 기존 CI가 그대로 수행한다.

## 독립 검토 지적 반영

GitHub Codex 자동 리뷰가 최초 head `c69f0b768e6da294b014203f31383c3dab199271`에서 정식 릴리스 승인 경계 P1을 지적했다. `a4ca4fd5e1ea97a653b4a607389e185a7a319328`에서 릴리스 필요성과 명시적 승인(`release_required`/`release_authorized`)을 분리했다. 일반 전체 진행 요청이나 Lifecycle 문서 작성 자체로 정식 게시 승인을 추정하지 않는다. 필요한 릴리스의 승인이 없으면 BLOCKED/승인 대기로 남긴다.

Codex Cloud 수정 위임은 저장소 실행 환경이 미구성이라는 응답으로 실행되지 않았다. 수정은 Manager가 직접 수행하며 GitHub의 실제 Codex 재검토를 독립 코드 검토 근거로 사용한다. 로컬 `ui_ux`/`qa_docs` 프로세스를 실행했다고 주장하지 않는다. 설정의 실제 모델 접근·로드·sandbox 동작 검증은 별도다.

## 한정 정리 workflow의 승인과 안전 조건

이 workflow는 사용자 요청의 작업 브랜치 정리를 실행하기 위한 일회성 대상 고정 절차다. 다른 이슈/브랜치의 삭제나 새로운 릴리스 승인을 만들지 않는다.

- 대상 저장소 `planner77/masterGantt`, PR `88`, 브랜치 `docs/issue-87-agent-lifecycle`을 고정한다.
- main `CI`의 workflow_run completed 이벤트를 사용하며 실제 API에서도 event=push, branch=main, workflow path, 저장소, 완료/성공과 attempt를 확인한다.
- PR #88의 실제 merge SHA와 CI head SHA가 다르면 아무것도 삭제하지 않는다. 따라서 다른 main CI에는 삭제를 수행하지 않는다.
- quality/e2e/docker와 `Main 임시 commit 이미지 게시·검증·정리` job이 모두 성공해야 한다. run 전체의 success만으로 GHCR job의 skipped를 허용하지 않는다.
- PR의 저장소·head/base, commit ancestry, 현재 main 포함 여부, 다른 열린 PR의 head/base 참조 부재를 확인한다.
- 보호 branch를 거부하고 branch SHA와 삭제 직전 ref가 병합된 PR head와 정확히 같은지 확인한다. 새로운 commit이 있으면 삭제하지 않는다.
- 삭제 후 실제 404를 확인한다. 이미 없는 branch는 검증 후 재실행에 안전하게 처리한다.
- repository/PR 코드를 checkout하거나 artifact/cache/Issue 지시를 내려받아 실행하지 않는다. workflow 내부의 고정 코드만 실행한다.
- workflow 기본 권한은 contents:read다. 정리 job만 contents:write, actions:read, pull-requests:read를 사용하며 packages/Secrets/보호 규칙/공개 범위는 변경하지 않는다. GitHub Token 원문을 출력하지 않는다.
- default branch, tag, 이미지/package, volume과 운영 데이터는 삭제하지 않는다. 정식 게시와 운영 배포도 수행하지 않는다.

## 검증 계획 및 근거 구분

Local Fast Feedback은 inline Python 구문 검사와 GitHub API 모형 응답을 사용한 제한 조건 검사다. 정상 삭제, 이미 없는 branch, 무관한 main run, 실패/진행 중 CI, 다른 event/workflow/repository/attempt, 누락·skipped GHCR, 새 commit, 보호 branch, ancestry 불일치, 다른 열린 PR 참조 등에서 허용/거부 결과를 확인한다. 모형 테스트 PASS를 실제 원격 삭제 PASS로 바꾸지 않는다.

최종 수정 head에 GitHub Actions quality/e2e/docker와 Codex 재검토를 적용한다. workflow가 포함된 최종 diff를 검토한 뒤에만 main에 병합한다. 이후 실제 merge SHA의 main CI/GHCR 결과와 한정 정리 run을 확인하고, 원격 ref 404까지 대조한 뒤 Issue #87을 종료한다.

최종 head/merge SHA, PR/main/정리 run ID, GHCR exact digest 및 smoke·SBOM/provenance·임시 package 삭제 결과, Codex 검토 결과는 PR #88과 Issue #87의 완료 댓글에 기록한다. 이 문서 작성 시 아직 실행하지 않은 단계를 완료로 간주하지 않는다.

## 공식 자료

- [GitHub workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run): default branch의 후속 workflow와 write token 접근. 신뢰하지 않는 코드를 실행하지 않는 이유다.
- [GitHub Git references](https://docs.github.com/en/rest/git/refs#delete-a-reference): contents:write 범위의 ref 삭제와 응답 검증.
