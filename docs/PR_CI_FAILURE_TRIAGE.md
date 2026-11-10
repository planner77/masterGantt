# 과거 PR CI 실패 진단 기록

이 경로의 이전 원격 진단 정책은 [전체 보존 기록](history/owner-ci-retired-20261110/PR_CI_FAILURE_TRIAGE.md)으로 옮겼다. 과거 PR/Run/Attempt·FAIL·수정 이력은 불변이며 신규 원격 실행 지침으로 쓰지 않는다.

현재 실패 원장은 [Issue Lifecycle §5](ISSUE_LIFECYCLE.md#5-실패재작업-원장), 테스트 재사용/선정은 [TEST_PLAN](TEST_PLAN.md), 실제 로컬 보고·admission은 [LOCAL_PREPR](LOCAL_PREPR.md), 교차 검색은 [Regression Index](REGRESSION_INDEX.md)를 따른다. LOCAL/GIT_PUSH/GHCR/DEPLOY/BACKUP/RESTORE/ROLLBACK 단계를 구분하고 최초 오류를 append-only로 보존한다. PR·GitHub Actions·원격 CI·Trusted QA·Finalizer를 시작하지 않는다.
