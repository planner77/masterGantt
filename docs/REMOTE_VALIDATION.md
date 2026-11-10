# 로컬·환경별 검증 증거

Owner 2026-11-10 결정으로 신규 작업의 원격 검증은 `N/A(정책상 미사용)`다. 모든 위험도에서 PR·GitHub Actions·원격 CI·Trusted QA·자동 Finalizer를 실행하지 않는다. 파일명은 기존 링크 호환을 위해 유지한다. 현행 검증은 [TEST_PLAN](TEST_PLAN.md)과 [LOCAL_PREPR](LOCAL_PREPR.md), 상태·종료 기준은 [Issue Lifecycle](ISSUE_LIFECYCLE.md)에 있다.

## 현재 증거 경계

| 범위 | 인정할 증거 | 다른 범위로 확대할 수 없는 것 |
| --- | --- | --- |
| 로컬 자동 검사 | 같은 source/base/fixture·환경, 실제 command/exit/count·selected/excluded·artifact·admission | Owner 업무/디자인 수용, 실제 운영 배포 |
| 로컬 UI | 실제 합성 fixture Chromium 조작·keyboard/반응형/geometry와 #896 manifest | manifest 검산만으로 디자인 적합·#897 UAT PASS |
| 로컬 Docker | image policy·설정 fail-closed·readiness·API auth/revision·native SQLite restart persistence | GHCR Push/Pull·운영 host/TLS·off-host 복원 |
| GHCR | registry exact digest 새 Pull·source label/architecture·격리 runtime/API/SQLite smoke | 태그 Pull만의 성공, 운영 미반영을 배포 PASS로 표시 |
| 환경별 | 실제 Windows Excel/VBA/DRM, reverse proxy/TLS, host storage/권한, off-host backup·격리 restore, 수동 UX | 로컬 자동 결과로 미실증 환경을 대체 |

실제 실행 없이 PASS를 쓰지 않는다. 실행 실패는 FAIL, 환경/권한/외부 의존 불가는 BLOCKED, 미실행은 NOT TESTED다. 필수 검사가 불충분하면 Push/Publish/Close하지 않는다. 이미지 미게시·운영 미배포는 별도 상태로 보존한다.

## 관리자 전환 검증

#911의 live Ruleset/branch protection·Actions 비활성 snapshot과 첫 direct Push의 새 자동 Run 0건은 로컬 source 테스트와 별도 운영 증거다. 문서·workflow 파일이 존재한다는 사실, `[skip ci]`, 과거 설정/Run만으로 전환 완료를 주장하지 않는다. Owner 또는 명시 위임 관리자가 [GITHUB_OPERATIONS](GITHUB_OPERATIONS.md)에 따라 실제 설정과 Push를 확인한다.

## 과거 실행 이력

이전 T1~T9·PR/Main/Release/Finalizer·Run/Attempt·Head/base/test-merge·Trusted provenance 계약은 [전체 보존 기록](history/owner-ci-retired-20261110/REMOTE_VALIDATION.md)에 있다. 이 기록의 FAIL/BLOCKED/NOT TESTED와 immutable 출처를 변경하지 않는다. 신규 source의 필수 Gate나 PASS로 재사용하지 않는다.
