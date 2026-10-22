# Issue #752 / PR #780 — 누적 PR CI 실패 분석

Primary Issue: [#752](https://github.com/planner77/masterGantt/issues/752) | PR: [#780](https://github.com/planner77/masterGantt/pull/780) | 작성: 2026-10-22

원본: [PR CI 실패 공통 지침](PR_CI_FAILURE_TRIAGE.md), [작업 원장](exec-plans/active/ISSUE_752.md). 각 Head·Run·Attempt의 실제 실패/취소는 불변이며, 다른 Head의 PASS로 소급 변경하지 않는다.

## 1. Run/Attempt 이력 및 원본 출처

| 이력 | Head / Base / test-merge | 원본 Job·Step | 판정 |
| --- | --- | --- | --- |
| PR #780 [Full #3151.1](https://github.com/planner77/masterGantt/actions/runs/39782427411), Run 39782427411 attempt 1 | Head `d90c5760a31297271a9b0e61e8eee6202a15410c`, Base `72c2c9d0a912dc906d4101ea41a7a57e0c686597`, Test-Merge `76d1a1016725d7480a393f026e6365fc5d2ef7e1` | 정책·TypeScript·Lint·Vitest·Build·E2E **8/8**·Docker·Required3 SUCCESS. QA Final Job `119850267324` step #3 `PR latest Head stale` FAIL; 뒤따른 새로운 HEAD로 전체 Workflow CANCELLED | 원본 HEAD stale/QA 차단. Chromium 직접 실패 관측0, 취소된 전체 Workflow를 PASS로 간주하지 않음 |
| PR #780 [Full #3152.1](https://github.com/planner77/masterGantt/actions/runs/39782641377), Run 39782641377 attempt 1 | Head `21f26a41969a9b46e081290c27efce2cefd21b03`, Base `72c2c9d0a912dc906d4101ea41a7a57e0c686597`, Test-Merge `f28b80b50d768e6179b240fe26c62d298553b40f` | 정책·TypeScript·Lint·Vitest·Build·E2E **8/8**·Docker·Required3 SUCCESS. [QA Final Job 119863804861](https://github.com/planner77/masterGantt/actions/runs/39782641377/job/119863804861) step #3 `최신 PR 증거·문서·리뷰 확인` exit1; 사유 `미해결 review thread`. QA Report Artifact ID 12430986481 | 원본 Workflow FAILURE (QA 리뷰 차단, POLICY_CI), 제품 Assertion/Runner TimeOut 직접 실패 관측0 |

- 원본 Full Run은 서로 다른 HEAD이며 모두 정확 PR #780의 pull_request 이벤트이다. #3151의 stale와 #3152의 리뷰 위반은 별개 사건으로 분류한다.
- Job/API 결과를 확인했지만 original ZIP을 이번 요청에서 다시 다운로드해 독립 교차 검증한 것은 아니므로 별도 Trusted QA 출처 PASS로 승격하지 않는다.
- 최신 Head가 바뀌면 과거 Quality/E2E8/Docker PASS는 역사적 증거일 뿐, 새 Head의 Required PASS가 아니다.

## 2. 누적 실패·리뷰 종합 매트릭스

| ID | 실제 원인 및 출처 | 교정 대상 | 현재 검증 상태 |
| --- | --- | --- | --- |
| F752-001 · Full #3151.1 | `QA Final: PR latest Head stale`; 원본 종료 CANCELLED, 정책상 정상 차단. `POLICY_CI/STALE` | 새 Head Full CI에서만 공식 Required 재검증. 이전 성공/취소 재분류 금지 | 원본 확정, 후속 Head는 별도 |
| F752-002 · Full #3152.1 | `QA Final: 미해결 review thread`; 스레드 5개. `POLICY_CI/REVIEW_BLOCKED` | 리뷰 지적 보완·답변·Resolve 후 새 Head에서 QA 검증 | 원본 확정, 현재 후보는 NOT TESTED |
| R752-01 P1 | [상대 경로 삭제](https://github.com/planner77/masterGantt/pull/780#discussion_r4348598565): Playwright testDir-relative spec을 empty path로 만들어 reporter `suites=[]` 가능 | 승인된 file-relative/repo-relative/absolute canonical spec 정규화, 중첩 Suite와 traversal/미선정 음성 회귀 | 수정 후보 / 원격 미검증 |
| R752-02 P1 | [저장소 전체 300 Run으로 잘못된 INCOMPLETE](https://github.com/planner77/masterGantt/pull/780#discussion_r4348598575) | GitHub Actions REST query에 `branch=`를 pagination보다 앞에서 적용, 해당 PR/source 재검증 | 수정 후보 / 원격 미검증 |
| R752-03 P1 | [Base의 오래된 실패 원장](https://github.com/planner77/masterGantt/pull/780#discussion_r4348598579) | 직전 커밋에서 `ledger_text(..., head)`로 수정 완료; exact 불변 PR Head를 비실행 데이터로만 사용, 회귀 테스트 추가 | 기존 수정 재검토 / 원격 미검증 |
| R752-04 P2 | [선정한 일부 spec 미보고인데 READY](https://github.com/planner77/masterGantt/pull/780#discussion_r4348598589) | 선택된 개별 Spec 결과 없으면 `SPEC_NOT_OBSERVED`; skip/interrupted/UNKNOWN이면 `SPEC_NOT_FULLY_EXECUTED`, 결과 `INCOMPLETE` 유지 | 수정 후보 / 원격 미검증 |
| R752-05 P1 | [신규 워크플로 영문 표시](https://github.com/planner77/masterGantt/pull/780#discussion_r4348598602) | 사람이 읽는 workflow/run/job/step/input·Summary/댓글을 한글로 변경, ID·Required Check·판정 코드는 보존 | 수정 후보 / 원격 미검증 |
| R752-06 인접 | QA Final 단독 리뷰 위반을 독립 테스트 실패로 잘못 계산할 수 있음 | `QA Final — Automated`/Shadow 등 파생 Job은 2회 직접 실패 감지에서 제외하고 음성 회귀 | 수정 후보 / 원격 미검증 |

**직접 실패 E2E 테스트 파일 합집합: 관측0건.** 두 Full에서 Chromium E2E 8개 Shard는 모두 SUCCESS다. 신규 `workflow_dispatch` 기반 제한 진단이 실제로 정상이라는 뜻은 아니며, 별도 main 적용 이후의 실증이 필요하다.

## 3. 영향·보완 대상과 동일 source 회귀

- 직접 코드: `scripts/issue_752_diagnostics.py`(원본 이력/ledger/상태 판정/파일 정규화), `.github/workflows/issue-752-diagnostics.yml`(표시 언어/Worker 정제), `tests/python/test_issue_752_diagnostics.py`(경계 회귀).
- 간접/음성 소비자: [#770 영향/Shadow](exec-plans/active/ISSUE_770.md), [#771 Draft/Ready](exec-plans/active/ISSUE_771.md), [#772 LOW 정책](exec-plans/active/ISSUE_772.md), 기존 `scripts/test_qa_final_automated.py` 및 PR 정확 HEAD Full Chromium 8/8·Docker.
- 기존 Required3·Trusted QA·Owner/Ruleset·GitHub 보존 원본 변경 없음. 진단 Report/Artifact·PR 댓글은 권고이며 최신 Head의 Full CI PASS가 아니다.
- 로컬 checkout/실제 Python·Node·Chromium·Docker 실행 불가: `NOT TESTED`. 코드·단위 회귀를 단일 Git Tree 묶음으로 준비하며 게시 후 원격 CI 실행은 새 HEAD로 별도 판정한다. 신규 workflow_dispatch의 진단 관측·성능 개선 수치는 `INSUFFICIENT_DATA / NOT TESTED`.
- 패치 중 쪼개진 Contents API HEAD를 생성하지 않도록 Git Tree 일괄 게시 및 예상 부모 SHA 검증을 사용한다.

## 4. 리뷰·충돌·인계

- 2026-10-22 초기 확인: Review 5개 모두 `is_resolved=false`. main Base SHA `72c2c9d0a912dc906d4101ea41a7a57e0c686597`와 Head `21f26a41969a9b46e081290c27efce2cefd21b03`, GitHub `mergeable=true`, 실제 충돌 없음.
- 개선 code+tests/docs 묶음 게시 후 review 답글과 실제 Resolve를 확인한다. QA gate를 disable/skip 처리하거나 요구된 테스트 단언을 완화하지 않는다.
- 최신 Head exact Full Required, default-main Trusted QA, Manager/Owner HIGH 승인 `NOT TESTED`. Issue 종료·Release/GHCR/Finalizer는 사용자 별도 승인 사항.
- 향후 새로운 PR CI 실패가 발생하면 이 파일에 **F752-003 이후로 이어서 기록**하고 최초 두 Run의 취소·리뷰 차단 원본을 삭제·PASS로 바꾸지 않는다.
