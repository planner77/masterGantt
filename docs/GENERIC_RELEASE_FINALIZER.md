# 자동 Finalizer 퇴역 기록

Owner 2026-11-10 결정으로 신규 Issue의 종료에 자동 Finalizer를 사용하지 않는다. PR·GitHub Actions·원격 CI·Trusted QA·Release/Finalizer workflow를 실행하지 않는다. 기존 workflow·스크립트·Run·FINAL/태그·digest 이력은 보존하며 신규 로컬 경로에 연결하지 않는다.

현재 단계·종료 조건은 [Issue Lifecycle](ISSUE_LIFECYCLE.md), 게시·검증은 [CI_CD](CI_CD.md), 실제 관리자 비활성 전환은 [GITHUB_OPERATIONS](GITHUB_OPERATIONS.md)의 #911을 따른다. 모든 요청 gate와 FINAL 증거가 갖춰진 뒤 실제 Owner 또는 동일 범위를 명시 위임받은 Manager가 수동 종료한다.

과거 전체 계약·재실행/복구 절차는 [보존 기록](history/owner-ci-retired-20261110/GENERIC_RELEASE_FINALIZER.md)에 있다. 과거 증거는 불변이며 현재 PASS·승인의 대체가 아니다.
