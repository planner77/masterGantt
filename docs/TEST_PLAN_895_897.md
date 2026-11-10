# #895–#897 재사용·시각 증거·로컬 UAT 적용

현재 재사용 판단과 테스트 수명주기는 [TEST_PLAN](TEST_PLAN.md), 역할/흐름은 [Issue Lifecycle](ISSUE_LIFECYCLE.md), #896 manifest는 [UI_EVIDENCE](UI_EVIDENCE.md), #897 로컬 격리 UAT는 [PREVIEW_PUBLISH](PREVIEW_PUBLISH.md)를 따른다. PR·GitHub Actions·원격 CI·Trusted QA·자동 Finalizer를 실행하지 않는다.

#895는 기존 코드/fixture/테스트·실패 원장의 REUSE_REVIEW와 Owner 근거를 유지한다. #896은 기존 `tests/e2e/helpers/ui-evidence.ts`와 `scripts/ui_evidence.py`의 합성 screenshot·geometry·source/PNG/fixture digest 검산을 재사용한다. 무결성 검사는 실제 디자인 적합성/UAT 승인이 아니다. #897은 PR/Main provenance를 새로운 gate로 호출하지 않고 로컬 격리 사용자 흐름의 source/digest/manifest·실제 Owner 결정을 기록한다. 미조작은 NOT TESTED다.

전체 원본·실패/교정·Run/Attempt와 과거 미검증은 [보존 기록](history/owner-ci-retired-20261110/TEST_PLAN_895_897.md)에 있다. 기존 케이스·단언·fixture·실패를 삭제/완화하거나 새 source PASS로 승계하지 않는다.
