# Issue #87 후속 검토와 완료 절차

관련: [Issue Lifecycle](ISSUE_LIFECYCLE.md), [Agent 설정](AGENT_CONFIGURATION.md), [GitHub 운영](GITHUB_OPERATIONS.md), [CI/CD](CI_CD.md), [원격 검증](REMOTE_VALIDATION.md), [테스트 계획](TEST_PLAN.md).

## 후속 요청과 범위

사용자는 UI/UX 역할과 GHCR 포함 Lifecycle 지침을 작성한 뒤 PR #88의 검토·병합·main 검증·브랜치 정리·이슈 종료까지 요청했다. 연결된 GitHub 도구에 branch 삭제 action이 없고 저장소의 `delete_branch_on_merge=false`여서 [고정 대상 정리 workflow](../.github/workflows/issue-87-branch-cleanup.yml)를 추가했다. 최초 문서/Agent 7파일안과 달리 후속 변경에는 이 workflow, 자동화 회귀 스크립트 및 CI 기준 문서 보완이 포함된다.

기존 `ci.yml`/`release-image.yml`, 제품 코드/API/DB/의존성, 기존 모델·동시 실행 수를 유지하고 이 이슈 자체로 제품 버전을 올리지 않는다. 최초 기준은 `0.20.0`이었으나 최종 병합 직전 #77이 main `0adb3da20eaf8bfc0144d662a3d4763be566892a`에 먼저 반영되었다. 해당 main의 제품 버전 `0.20.1`, 코드·테스트·CHANGELOG를 그대로 통합하고 TEST_PLAN의 #77/#87 추가 절을 모두 보존한다. 이를 #87에서 구현한 제품 기능이나 버전 증가로 주장하지 않는다. #87 자체는 제품 산출물을 변경하지 않으므로 정식 release_required=false이며 annotated version tag/정식 GHCR release/운영 배포는 N/A다. 기존 main 임시 GHCR 게시·digest smoke·cleanup은 통합된 최종 SHA에서 그대로 수행한다.

## 독립 검토와 조치

GitHub Codex 리뷰가 발견한 정식 게시 승인 경계는 `release_required`와 기본 false인 `release_authorized`를 분리하여 보완했다. 일반 전체 진행이나 지침 작성 자체를 정식 릴리스 승인으로 해석하지 않는다. 필요한 게시가 미승인인 상태는 BLOCKED/승인 대기다.

후속 workflow 검토의 지적도 반영한다. 이번 PR은 **merge commit 방식만 지원**하며 Manager는 `merge_method=merge`와 최종 `expected_head_sha`를 지정한다. squash/rebase 후 ancestry가 맞다고 추정하지 않고 삭제를 거부한다. 삭제는 REST GET/DELETE 분리가 아닌 명시적 SHA lease의 단일 Git 삭제 refspec을 사용한다. CI source-of-truth의 trigger/권한/검증/퇴역 계약은 CI_CD와 REMOTE_VALIDATION에 함께 반영한다.

수정은 Manager가 직접 수행하며 GitHub Codex의 실제 재검토를 독립 코드 검토 근거로 사용한다. Codex Cloud 수정 환경은 미구성이므로 로컬 ui_ux/qa_docs 또는 Cloud 구현 에이전트를 실행했다고 주장하지 않는다. Agent 설정의 실제 모델 접근·로드·sandbox 동작 검증은 별도다.

## 한정 정리의 승인·안전 경계

저장소 `planner77/masterGantt`, PR `88`, 브랜치 `docs/issue-87-agent-lifecycle`만 대상이다. main CI의 repository/event/path/attempt/완료 결과와 PR merge SHA를 검증한다. quality/e2e/docker/main GHCR 네 job이 모두 성공해야 하며 skipped는 허용하지 않는다. 두 parent를 가진 merge commit의 두 번째 parent가 PR head인지, ancestry/main 포함, 다른 열린 PR 참조 부재, 보호 branch 여부와 tip을 확인한다.

빈 bare 저장소에서 고정 HTTPS 원격으로 `--force-with-lease=refs/heads/<branch>:<verified-head>`와 `:refs/heads/<branch>` 하나만 전송한다. 원격 tip이 검사 후 변경되면 서버의 ref 갱신에서 거부된다. 이는 승인된 branch 삭제의 SHA 조건이지 commit 이력 force update나 tag 이동의 허용이 아니다. checkout/fetch/artifact/cache/외부 스크립트 실행은 없다. 인증은 GITHUB_TOKEN을 명령별 환경 설정으로 전달하고 파일·인자·출력에 쓰지 않는다. 기존 Git trace/global/system 설정도 사용하지 않는다. 삭제 후 실제 404를 확인한다.

쓰기 권한은 cleanup job의 contents:write에 한정하고 actions/pull-requests는 read다. 별도 PR validation job은 contents:read, persist-credentials:false로 고정 회귀 스크립트를 실행한다. PR에 write token이나 registry credential을 주지 않는다. 보호 규칙·Secrets·package·version tag·운영 데이터는 변경하지 않는다.

## 검증과 퇴역

[verify-issue-87-cleanup.py](../scripts/verify-issue-87-cleanup.py)는 workflow의 실제 embedded Python을 읽어 24개 API 모형 시나리오와 3개 실제 로컬 Git 시나리오를 검사한다. 정상 삭제, 이미 없는 branch, 무관 CI, CI/GHCR 실패·skipped, SHA/attempt/저장소 불일치, squash/잘못된 merge parent, 보호/새 commit/다른 PR 참조를 포함한다. 실제 bare Git에서는 정상 삭제, 전송 전 stale tip, 서버 pre-receive 시점의 경쟁 갱신을 재현해 새 commit이 보존되는지 확인한다. 로컬/PR 테스트는 원격 삭제 완료 증거가 아니다.

최종 head의 기존 PR CI와 별도 validation 및 독립 검토를 확인한 뒤 merge commit으로 병합한다. 이후 실제 merge SHA의 main CI/GHCR와 한정 cleanup run/404를 확인한 뒤 Issue #87을 종료한다. 최종 SHA/run/digest·검증·정리 증거는 PR/Issue 완료 댓글에 기록한다.

한정 workflow는 다른 main run에 no-op이며 branch가 이미 없으면 재삭제하지 않는다. 대상 branch 이름을 다른 작업에 재사용하지 않는다. 이 파일의 제거/비활성화는 완료 증거 보존 후 별도 검토된 운영 정리 변경으로만 수행한다. 다른 branch/PR로 대상을 바꾸거나 자체 파일 삭제 commit을 자동 생성하지 않는다.

## 공식 자료

- [GitHub workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)
- [Git push: 명시적 SHA lease와 삭제 refspec](https://git-scm.com/docs/git-push)
- [Git command configuration environment](https://git-scm.com/docs/git-config)
