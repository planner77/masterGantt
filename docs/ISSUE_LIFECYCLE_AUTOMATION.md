# Issue 수동 운영과 과거 자동화 경계

현행 [Issue Lifecycle](ISSUE_LIFECYCLE.md)은 로컬 검사·main 직접 fast-forward Push·수동 GHCR·Owner 수동 종료를 사용한다. 모든 위험도에서 PR·GitHub Actions·원격 CI·Trusted QA·자동 Finalizer를 실행하지 않는다. 이름이 Automation인 이 문서는 기존 링크 호환과 퇴역 경계를 설명한다.

기존 `issue-lifecycle.yml`, `release-finalizer.yml`, `release-image.yml`와 관련 원격 스크립트를 신규 경로에서 dispatch/재실행하지 않는다. 로컬 보고·admission은 [LOCAL_PREPR](LOCAL_PREPR.md), 게시·exact digest smoke는 [CI_CD](CI_CD.md), #911 live 관리자 전환은 [GITHUB_OPERATIONS](GITHUB_OPERATIONS.md), 복원은 [DEPLOYMENT](DEPLOYMENT.md)를 따른다.

기존 실패/Run·Attempt/FINAL·태그·digest는 삭제·소급 PASS·재발행하지 않는다. 이전 전체 자동화 계약은 [보존 기록](history/owner-ci-retired-20261110/ISSUE_LIFECYCLE_AUTOMATION.md)에 있다. 문서 정리가 실제 live workflow 비활성이나 운영 완료의 증거는 아니다.
