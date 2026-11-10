# GitHub Issue와 직접 Push 운영

현행 정책은 [Issue Lifecycle](ISSUE_LIFECYCLE.md), 로컬 검증은 [LOCAL_PREPR](LOCAL_PREPR.md), 게시/복구는 [CI_CD](CI_CD.md)·[DEPLOYMENT](DEPLOYMENT.md)를 따른다. 모든 위험도에서 PR·GitHub Actions·원격 CI·Trusted QA·자동 Finalizer를 실행하지 않는다. GitHub는 개발 Issue 원장과 Git 저장소로 사용한다. PUBLIC 저장소에 업무 원시 자료·운영 비밀을 반입하지 않는다.

## 1. Owner·Manager·Agent

Owner는 재사용/요구 범위·고위험 잔여 위험·게시/배포·수동 최종 종료를 결정한다. Manager는 실제 Issue·코드·로컬 증거를 통합하고 Work Packet·공식 Issue 기록을 작성한다. 구현 Agent는 지정 파일·테스트만 수행하며 infra는 승인된 Push·로컬 Docker/GHCR·운영 증거를 담당한다. 역할별 모델 설정은 [AGENT_CONFIGURATION](AGENT_CONFIGURATION.md), 위임/결과 서식은 [AGENT_PROMPTS](AGENT_PROMPTS.md)다.

Issue에는 목표·배경·범위/비범위·AC·선행/관련 이슈·파일 소유권·위험·테스트·문서·요청 종료점을 기록한다. 진행 댓글 유형은 PLAN/STATUS/EXCEPTION/DECISION_REQUIRED/RESUME/FINAL이다. Manager가 기본 writer이며 infra에 위임할 때 Work Packet에 `issue_comment_writer=infra`, `issue_comment_allowed_types=STATUS,EXCEPTION` 범위를 명시한다. 다른 Agent는 댓글 후보와 증거를 반환한다. 단순 조회/정상 반복 명령을 전부 댓글로 남기지 않는다.

## 2. 첫 직접 Push 이전 관리자 전환 (#911)

**이 문서 작성은 live 설정 변경의 증거가 아니다.** 전환 작업은 #911이 담당한다. 최신 live 상태를 읽기 전용으로 조회하고 실제 변경·검증 시각/actor와 정제한 snapshot을 별도 기록한다. 다음 전제가 준비되기 전 Push하지 않는다.

1. 기존 Ruleset/branch protection 전체 rule·bypass·required check/actor, 실행 중 Actions·open PR, baseline main SHA·기존 정상 digest·해당 backup ID를 안전하게 snapshot한다. `issue_comment.created`와 schedule도 원격 Run을 만들 수 있으므로 Actions가 활성인 동안 새 원격 Issue 진행 댓글·자동화 이벤트를 발생시키지 않는다. snapshot과 Actions 비활성 뒤 공식 원격 진행 기록을 게시한다. 이미 생긴 skipped Run도 실행 이력으로 보존하며 PASS나 세션 전체 Run 0건으로 표시하지 않는다.
2. Owner 또는 명시 위임 관리자가 관련 Actions를 먼저 비활성화하고 실제 상태를 확인한다. 이미 실행된 Run·write/publish 상태를 따로 점검한다. 이후 필요한 로컬 코드/문서/테스트와 실패 원장을 완료한다. 준비 중 새 PR·원격 workflow를 시작하지 않는다.
3. Owner 또는 명시적으로 위임받은 관리자가 PR requirement·required status/workflow 조건을 제거한다. force push·branch deletion 금지와 불필요한 writer 제한·immutable tag 보호는 별도로 보존한다. 무제한 bypass로 보호를 해제하지 않는다.
4. 같은 첫 Push 전 CI·QA·Release·Finalizer·Preview 및 PR/main/release/GHCR 자동 실행 workflow를 비활성화한다. 기존 실행 중 Run과 write/publish 상태는 따로 확인한다. `[skip ci]`만 붙이는 방식은 전환이 아니다. 기존 파일/Run 이력은 보존한다.
5. 비활성 이후 일반/HIGH 직접 Push에서 새 자동 Run 0건, local source admission, 수동 GHCR digest smoke를 실제 관측한다. 미관측 항목은 NOT TESTED다. 기존 open PR은 각각 유효 변경/Issue/채택 여부를 Owner가 판단하며 일괄 종료·무검증 병합하지 않는다.

live 변경 전/후 값과 복원용 snapshot은 접근 통제된 곳에 보관하고 공개 원장에는 민감 정보 없는 결과만 적는다. 정책 변경이 필요하면 별도 Owner 결정으로 처리하며 오류 복구를 이유로 CI/PR을 임의 재활성화하지 않는다.

## 3. 매 Push 절차

1. 동일 소스의 로컬 공통/영향/위험별 검사·문서·QA와 admission을 완료한다. clean exact commit·base/main·fixture/환경을 보고서와 대조한다.
2. `git fetch origin main`으로 최신 원격 main을 읽고 검증 baseline과 ancestry·fast-forward 가능성을 확인한다. 원격 main 이동/충돌이나 소스 변경은 새 검증이 필요하다.
3. Owner 권한으로 일반 fast-forward Push한다. `--force`, `--force-with-lease`와 history rewrite는 사용하지 않는다. 활성 PR branch에 Push해 자동 실행시키지 않는다.
4. 원격 main exact SHA와 해당 변경의 자동 Run 0건을 재조회해 MAIN_PUSHED 근거로 남긴다. 동시 원격 변경·자동 Run 발생 시 EXCEPTION을 기록하고 Publish/Close를 중단한다.
5. 승인된 GHCR 단계와 필요 운영 배포를 별도로 수행한다. 최종 기록 뒤 Owner 또는 종료를 명시적으로 위임받은 Manager가 수동 종료한다.

Push 권한/서버 제약으로 실패하면 `GIT_PUSH/BLOCKED`와 실제 오류를 정제해 원장에 남긴다. 새 PR 생성이나 관리자 우회로 녹색 상태를 만들지 않는다.

## 4. 원장·공개 보안·복구

GitHub 개발 Issue와 제품 내 Project Issue는 별도 원장이다. 개발 실패는 `docs/ISSUE_<N>_FAILURE_ANALYSIS.md`에 append-only로 유지하고 #907 Regression Index와 연결한다. 구현 전에는 현재 코드/테스트와 관련 원장을 검색한다. #906/#907/#908 통합 승인 범위에는 [원장 계약](ISSUE_LEDGER.md)·인덱스 validator도 포함되며 실제 검증 전 완료로 표시하지 않는다.

실운영 DB·백업·Cookie/Authorization·토큰·비밀번호·사내 URL/IP·실제 화면/원시 로그·영업/생산 자료는 PUBLIC Git/Issue/이미지에 넣지 않는다. 공개 테스트 입력은 합성 fixture, 보고는 정제한 명령/exit/source/digest/상태만 사용한다. 실패 원문은 필요 시 비밀값 제거 후 최소 근거로 보존한다.

운영 오류는 새 Git revert/교정 commit, 이전 검증 digest 및 호환 DB backup 쌍으로 복구한다. migration 이후 코드만 rollback해 DB를 복원했다고 주장하지 않는다. [DEPLOYMENT §8](DEPLOYMENT.md#8-backup-restore-rollback).

## 5. 문구와 과거 이력

운영/검증 관련 사람이 읽는 제목·설명·커밋·Issue 보고는 한글로 작성한다. 경로·옵션·식별자·API 필드·`PASS/FAIL/BLOCKED/NOT TESTED`와 외부 도구 원문 로그는 번역하지 않는다. 비밀값 제거 후 한글 원인/조치를 함께 남긴다.

과거 Ruleset #24043042·Required checks·Run/Attempt·Trusted·Finalizer 설명은 [전체 보존 기록](history/owner-ci-retired-20261110/GITHUB_OPERATIONS.md)이다. 과거 성공/승인을 새 source의 증거로 재사용하지 않는다.
