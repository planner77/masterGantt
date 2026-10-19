# Issue #731 / PR #746 — 누적 PR CI 실패 분석

Primary Issue: [#731](https://github.com/planner77/masterGantt/issues/731) · PR: [#746](https://github.com/planner77/masterGantt/pull/746) · 첫 원격 실패: 2026-10-19 KST · 기준: [PR CI 실패 누적 지침](PR_CI_FAILURE_TRIAGE.md)

**이 문서 하나가 #731의 canonical 원격 실패 원장이다.** 재실패/재개 시 관련 모든 PR·Run·Attempt·Job·Shard·취소·미실행을 다시 수집하고 다음 F-002+ 절을 누적한다. 과거 실패·기각된 가설·원시 결과는 소급 삭제/성공 변경하지 않는다. [#667 기존 누적 선례](ISSUE_667_FAILURE_ANALYSIS.md)와 현재 이슈 실패를 혼합하지 않는다.

## 1. 모든 관련 PR/Run/Attempt·원본 결과

2026-10-19 조회된 #731 관련 PR은 #746이며, 확인된 Full PR CI 실행은 **1개 Run, attempt 1**이다.

| 범위 | 확인된 실제 증거 |
| --- | --- |
| PR / workflow | [#746](https://github.com/planner77/masterGantt/pull/746), branch feat/issue-731-kpi-integration, event pull_request, Full PR CI #2997.1 |
| Run | [39206611413, attempt 1](https://github.com/planner77/masterGantt/actions/runs/39206611413), conclusion FAILURE |
| SHA | Head ddfbb26791889876306d3b8e178e9a8729f46165; Base 01fdc08bf4b2f69f9797a8bd411d6712e7478c09; Test merge 5b56630436448a2bc402e42956f7a0d061957b78 |
| 앞 단계 | QA Preflight job 117910792909 SUCCESS; Fast Gate 117911127749 SUCCESS; 타입·lint·unit·production build SUCCESS |
| Required aggregate | Quality job 117911684540 SUCCESS; Chromium E2E job 117919065433 SUCCESS; Docker job 117912038965 SUCCESS |
| E2E 여섯 Shard | 1:117911169631, 2:117911169644, 3:117911169608, 4:117911169732, 5:117911169624, 6:117911169668 **모두 SUCCESS**. 실제 E2E test FAIL 0 / CANCELLED 0 |
| 최초 실제 Fail | [QA Final Automated job 117919094703](https://github.com/planner77/masterGantt/actions/runs/39206611413/job/117919094703), Step 3 '최신 PR 증거·문서·리뷰 확인 (read-only)' FAILURE. Summary: '자동 QA: BLOCKED / 사유: 미해결 review thread', exit code 1 |
| 보조 증거 | [QA Final JSON artifact 12167110685](https://github.com/planner77/masterGantt/actions/runs/39206611413/artifacts/12167110685). 조건 미해당 metadata-only·main-specific Job 등은 SKIPPED이며 PASS로 계산하지 않음 |

원격 로그에 NEED_QUALITY, NEED_E2E, NEED_DOCKER가 각각 success, TEST_MERGE_SHA 위 값으로 출력된다. Git에는 정제한 출처만 기록하며 raw 로그/trace/자격증명은 보관하지 않는다.

## 2. 누적 실패 및 교차 분석 매트릭스

| 식별 | 원본 오류·관측 | 원인 분류 / 교정 | 변경 후보 검증과 잔여 위험 |
| --- | --- | --- | --- |
| **F-001 / Run #2997.1 / QA Final** | [Codex P2 리뷰](https://github.com/planner77/masterGantt/pull/746#discussion_r4310736228): src/server/logistics/logistics-kpi-service-core.ts 120행, WorkArea 구성 taskIds가 KPI-selected included와 교차되어 구성 상세의 Task/Assignment ID가 누락됨. 미해결 thread 1개 → QA Final BLOCKED | **POLICY_CI**: 정상적으로 unresolved review를 차단. 원인 **PRODUCT**: WorkArea 구성 원본과 선택 KPI Task/Assignment 분모를 혼동. WorkArea만 full canonical 관계로 계산, 기존 KPI 본문·산식은 유지 | 코드 Blob 6f0f2dd8204e107de689dae5312cc78ff7d064b1, 테스트 Blob 07d916b5dd864d1c66f76b00af9294fbe42c9e7b. 구조 앵커 검사 PASS, 새 Head 로컬 Vitest/TS/Chromium **NOT TESTED**. Review reply/resolve·새 Full CI 필요 |
| 과거 로컬 준비 문제 (**원격 F 아님**) | 초기 node_modules symlink, allocation0/Calendar CHECK fixture, 새 UI query mock 및 readonly oracle 기대 불일치 | [Work Packet 이전 로컬 실패 목록](exec-plans/active/ISSUE_731.md#누적-실행실패-원장)의 수정 이력. 전용 npm ci·올바른 Calendar fixture·기존 readonly 계약과 일치하는 oracle | 원래 Head의 로컬 서버 94/94 및 Chromium 27/27 PASS 증거일 뿐; 수정 Head의 검증으로 합산하지 않음 |

이번 Issue의 첫 원격 실패이므로 F-000 등 과거 원격 동일 이슈 실패는 확인되지 않았다. 인접 #729의 Main/Preflight 실패, #667의 E2E 누적 실패는 분류 규격 참고이며 #731 원격 실패에 합산하지 않는다.

## 3. F-001 최초 실패 사실·반례·수정

1. **원본과 최초 오류:** PR #746, Head ddfbb267..., base 01fdc08..., test merge 5b5663..., event pull_request. QA Final의 신뢰된 base read-only step이 미해결 inline review를 확인하여 BLOCKED exit1로 종료. Quality/E2E6/Docker는 전부 SUCCESS이므로 npm/Playwright/Docker 실패로 재해석할 수 없다. 이전 PASS도 이 Run의 종합 결론 FAILURE를 바꾸지 않는다.
2. **재현 조건/기대값:** KPI에서 공정·설비·시스템·개인 담당자·역할 필터를 선택해 WorkArea와 연결된 일반 Task T3가 선택 KPI에 없을 때에도 구성 WorkArea taskIds에 T3, assignmentIds에 개인 배정 A3가 남아야 한다. 실제 이전 코드는 ordinaryRows를 included.has(task.taskId)로 먼저 잘라 T3와 A3를 구성에서 누락했다. 같은 화면 configuration.targets는 이미 전체 ordinaryRows를 사용하므로 불일치다.
3. **인과 분류:** QA 게이트 오류가 아니라 정확한 미해결 리뷰 검출이다(POLICY_CI 보호 정상). 근원은 **PRODUCT: 구성 원본 모집단 선택 오류**다. mock, runner, 시간초과, 외부 전송으로 해석할 근거가 없다. 단순 thread resolve나 QA 정책 완화만으로 실제 문제를 해결했다고 볼 수 없다.
4. **제품 보완:** src/server/logistics/logistics-kpi-service-core.ts의 WorkArea 루프를 ordinaryRows 전체의 workAreaIds 포함 여부로 필터링하고, 그 Task 집합의 개인 assignments를 중복 제거하여 assignmentIds로 반환한다. 선택 KPI included/selectedAssignments/effort/quality/full Milestone Gate, activeOnly 구성 master 범위, Target/legacy API는 변경하지 않는다.
5. **회귀 추가:** tests/server/logistics/issue-731-kpi.test.ts에 direct / target / mixed 모드별 process, equipment, system, taskAssigneeResource, roleResource 조건의 WorkArea 구성 관계 동일성과, KPI T3/A3 제외 상황의 구역 원본 drill T3/A3 유지 테스트를 추가한다. 원본 Task ID와 개인 Assignment ID를 사용하며 가짜 배정·투입을 만들지 않는다. 기존 중복0·Task/Assignment 분모·설비 여러 WorkArea 연동 정책은 그대로다.
6. **대조/문서:** docs/API.md·docs/LOGISTICS_DASHBOARD.md에 구성 WorkArea full canonical 분모 명시. docs/TEST_PLAN.md와 docs/exec-plans/active/ISSUE_731.md에 테스트 선정·원격 로그·과거 local 오류와 동일 Head 검증 경계를 명시. 이번 scope는 KPI consumer readonly·단위 통합 테스트·문서이며 공통 #728/#729 계산기/DTO, DB/CI/Ruleset, Gantt writer/Calendar/Import, 전역 DESIGN/AGENTS 정책은 그대로다.
7. **검증 단계:** GitHub 연결 Git Data API 환경에서 원본 파일을 읽고 정확 앵커가 단 1회 존재함과 코드를 치환한 뒤 새로운 Blob을 생성했다. 새 코드의 실행식 로컬 Vitest/Typecheck/Playwright, 새 PR Head QA/Owner 승인은 **NOT TESTED**. 기존 Head의 94/27 로컬 PASS와 이번 Run Required3 PASS를 다른 Head에 이식하지 않는다. 변경 commit/tree 검증 및 새 CI 실행은 이후 단계에서 출처 연결한다.

## 4. 누적 실패 파일 합집합과 변경 영향 회귀

- 이번 원격 실패를 만든 테스트 파일은 없다. QA Final의 review gate만 실패했다. Unit/E2E 6-shard/Docker는 모든 Job 성공, 취소0; 조건부 SKIPPED는 별도로 보존.
- 관련 Product 경계: **src/server/logistics/logistics-kpi-service-core.ts**의 WorkArea 구성 task/assignment drill; 수용 테스트 **tests/server/logistics/issue-731-kpi.test.ts**.
- 직접·간접·음성 검사 후보: 신규 #731 integrated API 및 SQLite/HTTP, 기존 logistics-dashboard direct/coordination, #728 Target0/Target-only/mixed WBS source, #729 snapshot/stale, 개인 공수·기준정보/WorkArea 관리, 구성 quantity 중복0, diagnostics, full Milestone Gate, Task/Assignment 원본·조회 복귀·readonly/focus 및 390/768/1024/1440/1920 UI. 새 수정 Head에서 실제 로컬 고유 case 실행은 NOT TESTED; Full PR CI가 필요하다.
- 첫 실패를 그대로 남기고 F-002 이후에는 모든 Run/Attempt 및 직전과 다른 결함 여부를 교차 판단한다. 새 실패 전력을 취소/미실행이나 이전 PASS와 혼동하지 않고 무근거 timeout/skip/retry/Required gate 완화는 금지한다.

## 5. 게시 및 새 CI 인계

- 확인 당시 main과 base는 01fdc08bf4b2f69f9797a8bd411d6712e7478c09로 일치하고 PR mergeable=true. 게시 직전 현재 head/main을 다시 확인하고 Git Data tree+parent 및 non-force expected SHA guard를 적용한다. ref 갱신 후 Review [thread PRRT_kwDOUUB7Bc6tzQVa](https://github.com/planner77/masterGantt/pull/746#discussion_r4310736228)에 코드·테스트 증거 회신, 해결 상태를 확인한다.
- 다음 Full PR CI는 새 Head에 대한 synchronize event를 기대한다. 새 Run ID/Attempt/Head/base/test merge의 **시작까지만** 확인하며 완료 모니터링은 하지 않는다. 새 Head 필수 Quality/E2E/Docker 및 Trusted QA/Owner ACCEPT는 새 검증 전 NOT TESTED / MERGE_READY=BLOCKED.
- 병합/Main CI/GHCR/Finalizer, 정식 version 릴리스 승인, Issue 종료는 **수행하지 않는다**. HIGH/OWNER_MANAGED의 최종 Owner 판단도 이 기록으로 대체하지 않는다.
