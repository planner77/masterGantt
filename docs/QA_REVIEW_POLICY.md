# 로컬 QA와 Owner 최종 수용

현행 흐름·상태·완료 기준은 [Issue Lifecycle](ISSUE_LIFECYCLE.md)이다. Owner 2026-11-10 결정에 따라 보호 경로·HIGH도 PR·원격 CI·Trusted QA·자동 Finalizer를 사용하지 않는다. 과거 정책 전문은 [보존 기록](history/owner-ci-retired-20261110/QA_REVIEW_POLICY.md)에 있다.

## 위험도와 검토

| 위험 | 대표 트리거 | 로컬 검토 강도 |
| --- | --- | --- |
| LOW | 공유 계약을 바꾸지 않는 문구·격리 스타일·일반 문서 | 공통 검사와 직접 영향 확인. UI 변경은 실제 Chromium/geometry·keyboard, 일반 문서도 공통 검사를 실행하고 영향 browser/Docker N/A는 근거 필요 |
| MEDIUM | 제한된 기능/화면, 명확한 인접 소비자 | 직접 Unit/Integration·실제 사용자 흐름·취소/경계/오류와 인접 소비자 |
| HIGH | DB/migration/삭제, auth/revision, canonical WBS/연계, 공통 Gantt/state/동시성, Docker/게시 도구, 광범위/unknown | full 관련 Unit/Integration·실제 소비자 Chromium·Docker/runtime/API/SQLite persistence·해당 복원 가능성, 범위별 잔여 위험 점검 |

위험도는 테스트·백업/복원 강도만 바꾸며 실행 경로는 동일하다. [TEST_PLAN](TEST_PLAN.md)의 선정 규칙과 AC 매핑을 따른다. `src/server/**`, DB/보안/인증과 shared contract는 파일명에 auth가 없어도 영향을 평가한다. 경로 이름만으로 LOW로 낮추지 않는다. rename은 원본과 신규 경로 모두 검토한다.

기본 `qa_method=OWNER_MANAGED_LOCAL`이다. Manager는 요구사항·diff·실행 결과·문서·실패 원장·미검증을 검토하고 Owner의 실제 최종 수용과 연결한다. 별도 `qa_docs` 또는 승인된 인간 Reviewer를 실행했다면 `qa_method=AGENT_LOCAL`, 정확 source·신원·실제 검토 범위와 결과를 기록한다. 별도 검토가 없으면 `independent_qa=N/A(실제 독립 검토 없음)`이며 자체 검토·기계 PASS를 독립 PASS로 쓰지 않는다. HIGH에서도 별도 인간 GitHub APPROVED나 서버 영수증을 요구하지 않는다.

## 로컬 최종 검토 기준

- 정확 source/base/head·fixture·lock·환경이 실행 전후 동일하고 필수 로컬 검사와 영향 소비자에 실제 PASS가 있어야 한다. 개별 모드 PASS는 전체 admission이 아니다.
- DOCUMENTATION_SYNC와 `REUSE_REVIEW`/`TEST_LIFECYCLE_REVIEW`, AC→양성/음성/보안/DB/경합/브라우저 매핑을 확인한다.
- Reviewer 지적은 해결/근거 있는 DEFER와 Owner 수용 범위를 명시한다. source가 바뀌면 관련 검토·테스트·admission을 다시 수행한다.
- `automated_local=PASS`는 구조·실행 검산이며 업무/디자인 적합성·Owner ACCEPT와 별도다. #896 manifest 검산도 사람의 시각 적합성을 증명하지 않는다. #897의 로컬 격리 UAT는 실제 Owner가 해당 source/digest/manifest의 흐름을 확인한 결과다.
- 필수 FAIL/BLOCKED/NOT TESTED, 취소·UNKNOWN·오염·출처/환경 drift는 Push·Publish·Close를 차단한다. 위험 수용을 실행 성공으로 기록하지 않는다.

## 결과 계약

```text
issue / risk_level / risk_reason / qa_method / qa_required
source_sha / base_sha / source_fingerprint / fixture_digest / environment
local_commands / exit_codes / counts / selected / excluded / artifacts
documentation_sync / ac_test_coverage / unresolved_findings
reviewer_identity / independent_qa / manager_decision
owner_decision / residual_risks / decision_reason
```

`qa_required`는 계획된 실제 검토의 필요성을 나타내며 원격 gate의 alias가 아니다. Reviewer 미실행·환경별 미검증·운영 미반영을 숨기지 않는다. Owner가 명시적으로 승인한 게시/배포/종료 범위만 실행한다.
