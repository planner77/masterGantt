# Issue #731 — 누적 PR/Main CI 실패 분석

Primary Issue: [#731](https://github.com/planner77/masterGantt/issues/731) · PR: [#746](https://github.com/planner77/masterGantt/pull/746) · 첫 원격 실패: 2026-10-19 KST · 기준: [PR CI 실패 누적 지침](PR_CI_FAILURE_TRIAGE.md)

## 현재 재개 요약 — M-003 / Main #3011.1 (2026-10-19)

이하 기존 F-001~F-004/M-001~M-002의 당시 조회·OPEN·NOT TESTED 문구는 **역사 기록**이다. 현재 관련 PR #746/#748/#749는 모두 merged이고 최신 main은 `0aa1d3d71f13df6976539ef4ebaaadb9037121c4`다. 재개 시 원장 전체와 실제 GitHub Run·Attempt·6 Shard·리뷰 및 [사용자가 제공한 종합 분석](https://chatgpt.com/s/t_6ad60541d474819188b35458bca00f41)을 대조했다. 공유 분석은 진단 입력이고 실제 Run/Trace로 교차 확인한 사실과 가설을 구별한다.

**이번 직접 실패는 2건**: M-003-A는 #623 통합 시나리오60초 종료와 후행 disposed 응답, M-003-B는 Task Editor UI 저장 후 독립 APIRequestContext canonical GET의 ECONNRESET이다. 아래 §11에 추가하며, 기존 #725 restart/PATCH와 KPI focus는 이번 Main에서 PASS한 각각의 실제 케이스로만 기록한다. 다른 Issue #730의 CI #3001/#3003/#3005/#3008/#3009/#3012를 #731 실패에 합산하지 않는다.

### 현재 확인한 전체 source CI 목록

| 범위 | Run URL / Attempt | 원본 결과와 의미 |
| --- | --- | --- |
| PR #746 | [#2997 /39206611413](https://github.com/planner77/masterGantt/actions/runs/39206611413) /1 | Required3 SUCCESS, QA Final unresolved P2 FAILURE(F-001) |
| PR #746 | [#2998 /39211001676](https://github.com/planner77/masterGantt/actions/runs/39211001676) /1 | #726 GET reset·Shard4 FAILURE, 다른5 CANCELLED(F-002) |
| PR #746 | [#2999 /39212770619](https://github.com/planner77/masterGantt/actions/runs/39212770619) /1 | TypeScript TS2488·Fast Gate 실패, E2E/Build/Docker 실제 미실행(F-003) |
| PR #746 | [#3000 /39213900305](https://github.com/planner77/masterGantt/actions/runs/39213900305) /1 | Full CI SUCCESS; 다른 Head의 신규 검증을 대체하지 않음 |
| Main /PR #746 | [#3002 /39218195042](https://github.com/planner77/masterGantt/actions/runs/39218195042) /1 | KPI 정확 공정 행 focus FAIL(M-001); GHCR SKIPPED |
| PR #748 | [#3004 /39223658039](https://github.com/planner77/masterGantt/actions/runs/39223658039) /1 | Required3 SUCCESS, unresolved P1 QA Final FAILURE(F-004) |
| PR #748 | [#3006 /39228359207](https://github.com/planner77/masterGantt/actions/runs/39228359207) /1 | Full CI SUCCESS |
| Main /PR #748 | [#3007 /39232888704](https://github.com/planner77/masterGantt/actions/runs/39232888704) /1 | #725 restart 뒤 PATCH HTML404(M-002); GHCR SKIPPED |
| PR #749 | [#3010 /39239166160](https://github.com/planner77/masterGantt/actions/runs/39239166160) /1 | Quality/E2E6·QA SUCCESS; Docker aggregate SUCCESS, implementation SKIPPED |
| Main /PR #749 | [#3011 /39243175274](https://github.com/planner77/masterGantt/actions/runs/39243175274) /1 | E2E3/4 두 직접 실패(M-003-A/B); Quality/Docker aggregate SUCCESS, Docker implementation 및 GHCR SKIPPED |

총 source CI10건(PR7/Main3), 전부 attempt1. 인증된 run 목록100개 안에 #2997까지 포함됨을 확인했고 #731 source metadata-only 추가 실행은 발견하지 않았다. 별도 Trusted/metadata 감사는 source CI와 섞지 않는다. **#3010/#3011의 Docker는 `REQUIRED=false`, `RESULT=skipped`로 aggregate가 성공한 것이며 runtime smoke 실실행 PASS가 아니다.** 과거 본문·공유 분석의 'Docker PASS'는 이 범위로 읽는다.


> **최신 F-002 (2026-10-19 KST):** [Full PR CI #2998.1](https://github.com/planner77/masterGantt/actions/runs/39211001676)은 최초 F-001 리뷰 해결 후 재실행되었지만, Shard4의 #726 공정 문맥 원본 GET에서 ECONNRESET로 실제 E2E FAIL을 기록했다. Required Quality/Docker SUCCESS·E2E FAILURE·QA Final 파생 FAILURE다. 아래 §6 F-002와 교차 원장에 추가하며 기존 §1의 '1개 Run'은 F-001 작성 시점의 역사 기록이다. **접근 가능한 #731 Full Run 2건: #2997.1, #2998.1.** 그 외 metadata-only 및 새 Head CI는 독립 확인 전 별도다. 현재 transport 결함의 정확한 근인은 UNKNOWN이다.

> **최신 F-003 (2026-10-19 KST):** [PR Full CI #2999.1](https://github.com/planner77/masterGantt/actions/runs/39212770619)에서 `tests/e2e/issue-726-task-logistics.spec.ts:370`의 TypeScript **TS2488**이 직접 실패했다. #2998.1 ECONNRESET 교정 때 정확 DTO `TaskProcessLink[] | null` 타입으로 전환했으나 기존 배열 spread에 null 구분이 빠졌다. Fast Gate가 막아 **E2E·Docker·PR Build는 실행되지 않았다**. 이 원장의 F-001/F-002를 소급 변경하지 않고 F-003을 §7에 누적한다. 연결된 PR #746의 원격 Full CI 확인 이력은 #2997.1/#2998.1/#2999.1 (서로 다른 Head·Run·각 attempt1)이다.

> **2026-10-19 Main 실패 M-001 추가:** PR #746 Full CI [#3000.1](https://github.com/planner77/masterGantt/actions/runs/39213900305) Quality/E2E6/Docker 및 [Trusted QA #643.1](https://github.com/planner77/masterGantt/actions/runs/39217128743) PASS 후 merge SHA `fbe7db83a4baa2877a75db0769a59077bbe308c4`의 [Main #3002.1](https://github.com/planner77/masterGantt/actions/runs/39218195042)은 **Shard6의 #731 공정/WorkArea KPI 원본 초점 복원** 1 FAIL (125 PASS), Quality/Docker PASS, 다른 Shard5 PASS, E2E aggregate FAIL, GHCR 게시 SKIPPED다. 기존 F-001~F-003은 PR 실패 기록으로 유지하고 새로운 **M-001은 Main 별도 실행**으로 §8에 기록한다. #3002의 같은 불변 Merge SHA를 재실행해 교정한 새 소스라고 보고하지 않는다. 필요한 변경은 latest main 기반의 새 보완 PR에서 검증·병합해야 한다.

> **최신 F-004 / PR #748 (2026-10-19 KST):** 원본 Main M-001 교정 PR의 [Full CI #3004.1](https://github.com/planner77/masterGantt/actions/runs/39223658039)는 **Required Quality/E2E6/Docker 모두 SUCCESS**였지만, Codex **P1 미해결 review thread**에 의해 QA Final이 **BLOCKED**됐다. 리뷰에서 제품 포커스 복원 경계의 실제 누락을 지적했으므로 QA 우회가 아니라 모든 외부 가시 사용자 focus를 우선하여 기존 복원을 취소하도록 수정한다. 기존 F-001~F-003/M-001은 불변으로 두고 §9 F-004를 누적한다. 이 Issue의 관련 PR은 **#746(merged) + #748(open)**이며 F-004는 병합 Main이 아닌 **PR** 실패다.

> **Main M-002 추가 (2026-10-19 KST):** [Main CI #3007.1](https://github.com/planner77/masterGantt/actions/runs/39232888704) (PR #748 merge SHA `a0297cd4b01e0083273ad3444edc7fa1ed0a145f`)에서 **Shard3의 이웃 #725 재시작 뒤 설비 PATCH가 HTML HTTP404**를 반환하여 저장 대화상자가 닫히지 않았다. Quality/Docker와 E2E 5 shard PASS, Shard3 101PASS/1FAIL/1SKIP, E2E aggregate FAILURE, GHCR 이미지 Job SKIPPED. 이번 실패는 **#731 Main CI 실행에 귀속되는 M-002**이며 #725 과거 원장에는 합산하지 않는다. 정확한 Next dev 내부 원인은 UNKNOWN이다. 기존 원장 F-001~F-004/M-001은 소급 수정하지 않고 아래 §10에 추가한다.

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

## 6. F-002 — PR #746 Full CI #2998.1, #726 공정 문맥 read ECONNRESET (2026-10-19)

### 6.1 원격 실제 Run / Attempt / Job / Shard / 최초 오류

- **귀속**: Primary #731 / PR #746, event pull_request.synchronize, Full PR CI [#2998.1](https://github.com/planner77/masterGantt/actions/runs/39211001676) ID 39211001676, attempt 1, Head d2a90cd43a601afc1de99b8653d4f6d8ced6f304, base 01fdc08bf4b2f69f9797a8bd411d6712e7478c09, test merge d9fe866487184f94d7659d70dbfaac52edb95f73. 당시는 main strict·PR mergeable=true·미해결 review thread0이었다.
- **선행 / Required**: QA Preflight job 117924191329 SUCCESS, PR fast gate 117924721640 SUCCESS, 정책/TypeScript/ESLint/Vitest/Next build SUCCESS, Quality aggregate 117925051479 SUCCESS, Docker smoke 117924772659 / Docker aggregate 117925868647 SUCCESS.
- **실제 실패 E2E**: Shard4 [job 117924772746](https://github.com/planner77/masterGantt/actions/runs/39211001676/job/117924772746) step7 'E2E shard 실행' FAILURE. 파일 tests/e2e/issue-726-task-logistics.spec.ts:236 case 'Task 공정 0..N·WorkArea self/subtree 원본 연결, 초안·오류 보존과 상위 출처 구별', 최초 실제 실패 line262 → readContext(line244)에서 별도 Playwright APIRequestContext GET 'read ECONNRESET'. 원본 Task process-context를 저장 후 poll로 확인하는 단계다.
- **정확 결과**: 해당 Shard4는 6 PASS / 1 FAIL / 156 NOT RUN (163 planned, --max-failures=1); 별도 runner/global error 1은 초기 비치명 GitCommitInfo fetch timeout 관측이며 본 E2E assertion 원인으로 확정하지 않는다. Shard1 job 117924772917, Shard2 117924772831, Shard3 117924772844, Shard5 117924772818, Shard6 117924772847 모두 **CANCELLED**, 실제 case PASS 수나 실패 부재를 근거 없이 추정하지 않는다. E2E aggregate 117926025207 FAILURE, QA Final 117926057359 FAILURE의 이유는 'required e2e 미성공'으로 **파생 실패**. Main 임시 이미지 Job SKIPPED.
- **원본 보존 위치**: [Playwright trace/report artifact 12167294969](https://github.com/planner77/masterGantt/actions/runs/39211001676/artifacts/12167294969), [QA artifact 12167414622](https://github.com/planner77/masterGantt/actions/runs/39211001676/artifacts/12167414622). raw trace에는 테스트 계정 쿠키/경로가 포함되므로 Git에 넣지 않는다. 정제된 실행/진단 facts만 이 원장에 남긴다.
- **원본 전/후 관측**: Playwright trace에서 첫 context GET HTTP200, UI의 context PUT HTTP200 뒤 선택 상태 '직접 공정 0개'의 저장 직후 두 번째 독립 APIRequestContext GET에서 약 45ms 내 connection reset. 실패 당시 자체 fixture 진단 reason=test_failure(해당 GET이 관측 helper 미사용)는 child CLI generation1 alive/exitCode null/signal null, 실패 후 독립 health /api/health/ready HTTP200/426ms, cgroup oom0→0/oomKill0→0, Node HTTP worker 후보 RSS 1.87GB→4.48GB(KiB 관측치 기반), host free 약12.17GB→9.12GB. CPU/Next heap/worker 재시작·pooled reusedSocket 여부 직접 계측은 없다. 기록된 서버 정상 건강 상태만으로 간헐적 reset 인과를 해결 완료라 주장하지 않는다.

### 6.2 F-001 포함 Cross-run 원인 대조

| Run / 실패 | 직접 원인 / 과거 교정 | #2998에서 확인된 결과 / 새 후보 |
| --- | --- | --- |
| F-001, #2997.1 QA Final | Codex P2 구성 WorkArea가 KPI included에 종속되어 구성 관계 누락. consumer/Unit·문서 보완 d2a90cd; resolved thread | #2998.1의 미해결 review0, Quality SUCCESS(신규 서버 회귀 포함). E2E #726 실패와 다른 근인. 취소된 E2E5개를 #731 UI 회귀 PASS로 간주하지 않음 |
| **F-002, #2998.1 Shard4** | #726 test line244의 **UI 저장 후 canonical 확인 GET**이 APIRequestContext pooled transport를 사용하고 실제 ECONNRESET. HTTP response 자체 미수신. **INIT_TRANSPORT 관측, 근인 UNKNOWN** | 이전 저장 PUT 200/동일 fixture 서버 alive/Health200, cgroup OOM0. 서버가 종료/데이터 영속성 실패/DB crash라고 확정할 근거 없음. 아래 transport boundary 변경, 동일 의미 단언 유지. 새 source의 실제 실행/원격 PASS NOT TESTED |
| 비교 선례 #667 #2814/#2819 | 다른 이슈·다른 Head의 post-Editor 독립 APIRequestContext GET에서 ECONNRESET. 당시 원인 UNKNOWN, UI 이후 같은 출처 browser fetch/no-store·observer로 진단 보강, retry0 | **선례만 재사용**. #731 원격 F 횟수에 포함하지 않으며 #667의 로컬 PASS도 여기에 전용하지 않음 |
| 같은 파일 #726 이전 실패 이력 | #726 소유의 관계 집합/메뉴/fixture 원장 F-001~F-005가 별도로 존재 | 이번 PR의 새로운 reset은 #731 CI 실행에 귀속. #726의 과거 실패 원장 사실/원인 변경 없이 [#726 원장](ISSUE_726_FAILURE_ANALYSIS.md)을 참조함 |

### 6.3 분류, 교정 및 검증 안전성

- **근인 판정**: 앱 API가 500/409 등 HTTP error 응답한 증거는 없고 raw reset이다. 직접 GET 전송 경로는 **INIT_TRANSPORT**, 정확 socket reuse·Next dev lifecycle·worker RSS 증가와의 인과는 UNKNOWN이다. 제품 공정 선택·WorkArea 저장 오류로 분류하지 않는다. 저장/readonly/권한·DB 실제 지속성 검증을 삭제하거나 실패를 숨기는 무조건 retry로 변경하지 않는다.
- **최소 안전 교정**: tests/e2e/issue-726-task-logistics.spec.ts의 **실제 화면 진입 이후** readContext canonical GET을, 프로젝트 URL의 **동일 origin browser fetch(credentials:same-origin, cache:no-store)**로 전환. 기존 [#667 후행 snapshot 검증 선례](../docs/ISSUE_667_FAILURE_ANALYSIS.md)의 transport 경계와 일치시킨다. 다른 seed/auth/쓰기 요청과 독립 network test는 변경하지 않는다.
- **실패 관측 추가**: 해당 readContext만 기존 isolatedApplication fixture의 observeIsolatedApi에 직접 연결하여 route/method/status/x-request-id·transport failure 발생 시 격리 child/health/cgroup 안전 진단을 확보한다. 실제 HTTP200 / JSON 유효성 / data.context 존재 / 기존 원시 processLinks/workAreaLinks·revision·draft·permission / PUT 횟수·UI keyboard·5폭 등 기존 strict assertion을 그대로 유지한다. Promise poll timeout 및 maxFailures/Shard6/CI retry·Required gate·Test skip 변경0; transport retry0.
- **제품 영향**: src server/API/DB/QA policy/CI/Ruleset/Gantt writer 버전 0.123.0과 이전 F-001 WorkArea consumer 수정은 그대로 유지. 테스트 전송 경계 변경만이며 #726 구현을 새로운 #731 기능이라고 주장하지 않는다.
- **동결 후보 식별**: 새 test Blob bbad2bcf5339496fab8c24f2b6b06fbceab93513. 나머지 문서+원장 Blob은 게시와 함께 SHA/Tree로 확인한다. 새 source에 대한 Vitest/Typecheck/Chromium/HTTP 실제 로컬 실행 환경은 GitHub connector에서 제공하지 않으므로 **NOT TESTED**. 기존 #2998 Quality SUCCESS 및 #2997 E2E6 SUCCESS는 서로 다른 Head 검증이며 다음 Head의 성공으로 승격하지 않는다.
- **선정한 회귀 및 제외**: 직접 #726 process-context 실제 HTTP/SQLite/1 case와 해당 spec의 앞선 성공2 case·기존 직접 링크·다섯 폭/UI editor·stale/403/409/412·readonly, 간접 #731 KPI 원본·구성 drill·#728/#729 source/snapshot 및 #667 계열 후행 canonical GET, 전체 E2E6·Quality/Docker remote 필수. 다른 #726 제품 로직 변경과 Gantt scheduling 원본은 없으므로 전부 이전 기준을 유지. 로컬 실행 없이 '재현 PASS' 표시는 하지 않는다.
- **문서**: 동일 정규 원장 이 절/F-002, docs/TEST_PLAN.md의 회귀 선정과 docs/exec-plans/active/ISSUE_731.md Work Packet에 영향/원격 증거·미검증을 추가한다. DESIGN/AGENTS/공통 contract/SECURITY/CI 운영 정책은 변경없음(N/A reason), 제품/UI 매뉴얼 및 CHANGELOG는 제품 변화가 없는 transport-only 테스트 보완으로 N/A.
- **출처 제한**: Playwright isolated test의 safe diagnostic reason=test_failure는 이번 문제를 실제 wrapper에서 검사하지 않아 독립 GET 전송 이벤트를 포착하지 못했다. 새 observer는 이후 재발 시 안전 출처를 제공하며 **기존 reset의 근인을 소급 증명하지 않는다**.

### 6.4 향후 F-003+ 재실패 대응 및 인계

- 같은 원장 F-001+F-002 **전체 Run·Attempt·Fail-fast Shard/별도 global error**를 조회하고 원본 실패의 불변 보존, source/test 교차, 새로운 증상 독립 판단을 유지한다. 기존 원격 실패 파일 합집합: 직접 E2E tests/e2e/issue-726-task-logistics.spec.ts 1개 + QA Final review gate 1개(테스트 파일 아님). 다른 이슈의 실패 파일 목록은 인접 영향 조사만 한다.
- 게시 직전 exact PR Head d2a90cd..., latest main(base) 01fdc08.../mergeable/review0 확인 후 기존 branch에 **단일 logical git commit**으로 코드·원장·테스트 계획·Work Packet을 반영한다. 그 직후 PR review0 및 충돌 상태를 다시 검사한다.
- 새 **pull_request.synchronize Full CI**의 Run ID/Attempt·HEAD/base/test merge와 시작 여부만 확인. CI 완료 모니터링·병합/Main CI/GHCR/Finalizer·Issue 종료/릴리스 승인 제외. 새 Head의 Required3/Trusted QA/Owner ACCEPT는 NOT TESTED; HIGH/OWNER_MANAGED, release_authorized=false 유지.

## 7. F-003 — PR #746 Full CI #2999.1 TypeScript TS2488 / Fast Gate 차단 (2026-10-19)

### 7.1 실제 Source·Run·Job·최초 오류

| 항목 | 확인한 원본 |
| --- | --- |
| Issue/PR/event | [#731](https://github.com/planner77/masterGantt/issues/731) / [#746](https://github.com/planner77/masterGantt/pull/746) / `pull_request.synchronize` Full CI |
| Run/Attempt | [#2999.1 / 39212770619](https://github.com/planner77/masterGantt/actions/runs/39212770619), attempt 1, conclusion FAILURE |
| Exact Head/Base/Test merge | Head `dd493bd1d973afe8eff80c053a03cd2096ff7afd` / Base `01fdc08bf4b2f69f9797a8bd411d6712e7478c09` / test merge `8af177db944fa36e1163f608bf712a2789a50f32` |
| 최초 실제 실패 | [TypeScript job `117929793086`](https://github.com/planner77/masterGantt/actions/runs/39212770619/job/117929793086), step 7 `npm run typecheck` (`tsc --noEmit`), exit 2: `tests/e2e/issue-726-task-logistics.spec.ts(370,14): error TS2488: Type 'TaskProcessLink[] &#124; null' must have a '[Symbol.iterator]()' method`. (표시의 `&#124;`은 Markdown 표 구분자 회피이며 실제 TypeScript `| null` 오류.) |
| 독립 성공 | 경로판정 job `117929657156` SUCCESS, QA Preflight `117929722224` SUCCESS, 정책 `117929793019` SUCCESS, ESLint `117929792988` SUCCESS, Vitest Unit `117929792960` SUCCESS |
| 연쇄 Gate | PR Fast Gate job `117930281120` FAILURE (`TYPECHECK_RESULT=failure`), Required Quality aggregate `117930347573` FAILURE, Required E2E aggregate `117930347572` FAILURE, Required Docker aggregate `117930347470` FAILURE |
| 취소/미실행 | PR Next.js production build `117930348592` **SKIPPED**, Chromium E2E PR shard matrix `117930348759` **SKIPPED**, PR Docker smoke 구현 `117930348419` **SKIPPED**. 실제 E2E 테스트 실행 0, Docker 실행 0, Build 실행 0, Fail-fast 취소된 PR shard 0. Main-only placeholders/metadata-only 검사 또한 조건부 SKIPPED이며 PASS로 집계하지 않는다 |
| QA Final | [job `117930378502`](https://github.com/planner77/masterGantt/actions/runs/39212770619/job/117930378502) FAILURE: `required quality 미성공`; 실질 새로운 리뷰 finding이나 별도 제품 E2E 실패가 아니라 Fast Gate 후속 |

### 7.2 F-001부터 F-003까지 원인 교차 검토

| 원본 사건 | 확정 관측·당시 조치 | F-003에서 확인·미확인 |
| --- | --- | --- |
| F-001 #2997.1 / unresolved P2 | KPI WorkArea 구성 분모 PRODUCT → canonical 전체 Task/개인 Assignment 관계로 교정, 리뷰 resolved | #2999.1의 리뷰 thread0, 관련 Unit SUCCESS; 이 Source의 E2E 결과는 Fast Gate 이전 차단으로 NOT RUN |
| F-002 #2998.1 / Shard4 실제 E2E | `#726 Task process-context` UI 저장 후 독립 APIRequestContext GET의 ECONNRESET, INIT_TRANSPORT(정확 socket/worker 근인 UNKNOWN). 후속 browser same-origin fetch·observeIsolatedApi로 보완 | 같은 E2E는 #2999.1에서 **SKIPPED**이므로 F-002 실증 성공을 주장할 수 없다. 새로운 TypeScript nullability 실패는 이전 reset과 별개. 실제 전송 문제 미재발 여부는 다음 Full E2E까지 UNKNOWN |
| **F-003 #2999.1 / typecheck** | #2998 교정 코드의 `readContext`가 `TaskProcessContextResponse`로 명시되면서 기존의 `[...childContext.processLinks]`가 `TaskProcessLink[] | null`과 충돌. 코드 계약 대비 E2E 소스의 누락된 정적 null 확인 | 이슈 전용 **TEST_CONTRACT**, 원인 검증됨. 기존 `null`=legacy 미설정, `[]`=명시0 의미 유지. 새 후보는 null 즉시 명시 오류, non-null 정확 관계 집합 단언을 유지. 실제 repo typecheck/원격 PASS는 아직 NOT TESTED |

기록된 Run은 각각 다른 Head, 세 Run 모두 attempt1. #2998의 취소된 E2E5개와 #2999의 Fast Gate로 **아예 실행되지 않은** E2E 6개는 동일 상태가 아니다. 직전 E2E의 6 PASS도 이전 Head 결과로만 보존한다. 이전 QA 성공·Ready 조건을 새 Head로 이월하지 않는다.

### 7.3 직접 원인·교정·회귀 방지

- **실제 소스 근거**: `src/contracts/process-context.ts`의 `TaskProcessContextDto.processLinks: TaskProcessLink[] | null`는 legacy-null과 명시0 `[]`를 구분한다. #2998 당시 테스트는 응답을 `as TaskProcessContextResponse`로 변경했으나 기존 테스트 마지막 부분(본 Run line370)에서 null 확인 없이 spread 했다. 이전 readContext의 암시적 `any`에 가려진 테스트 코드의 타입 결함이며 제품 API/DTO/DB 결함이 아니다.
- **교정 범위**: `tests/e2e/issue-726-task-logistics.spec.ts`에서 `const savedProcessLinks = childContext.processLinks;` 뒤 `if (savedProcessLinks === null) throw new Error("저장된 직접 공정 관계가 legacy null로 되돌아왔습니다.");`의 runtime null guard를 둔다. 그다음 `[...savedProcessLinks].sort(byProcessId)`에 대해 기존 두 공정 정확 UUID·`scope:"self"` 비교는 **그대로 유지**한다. 빈 배열로 조용히 대체하거나 null 허용 단언으로 바꾸지 않는다.
- **기존 경계 유지**: 같은 파일에서 legacy initial `toBeNull()`, 명시0 `toEqual([])`, 저장후 2개 관계·하위 포함/WorkArea 정확 원본·리로드·403/409/412·5폭/키보드·full canonical/permission 검사는 삭제/완화하지 않는다. F-002 same-origin/browser API real HTTP/no-store/observer 코드는 변경하지 않는다.
- **후속 확장 범위**: F-001 서버 KPI direct/target/mixed 3모드와 구성 WorkArea original Tasks/Assignment, F-002 동일 #726 3개 E2E와 공정 self/subtree 원본, 인접 #719/#667 후행 GET·#728/#729 snapshot/원본, Task editor 원본·Milestone Gate, 일반 read-only/권한 실패와 metadata/QA 경계를 대상으로 다음 Full CI를 요구한다. 이번 추가 변경은 TypeScript null guard와 문서에 국한하므로 공통 scheduling/Core·DB·API·Docker/CI workflow/rulesets 및 version0.123.0은 건드리지 않는다.
- **기존 실패 대비 테스트 실행**: 정적 파일 내용 검토에서 null guard/정확 집합 단언/legacy-null·명시0·browser transport 보존을 확인했다. 별도 Node22/전역 `tsc --strict --noEmit --target ES2022`의 **최소 타입 재현 코드**로 null guard 뒤 배열 spread 타입 좁힘이 동작하는 것만 PASS 확인(실제 저장소 파일을 컴파일한 것이 아님). 저장소 전체 `npm run typecheck`, Vitest, Playwright Chromium, Docker는 연결 GitHub 편집 환경에서 **NOT TESTED**. 로컬 동결/실제 npm dependencies가 없는 환경의 한계를 공개하며 기존 #2998 Unit SUCCESS 또는 #2997 E2E SUCCESS를 새 Head의 PASS라고 보고하지 않는다.
- **변경 후보**: `tests/e2e/issue-726-task-logistics.spec.ts` 수정된 Blob `4669f12e743d87c1ff93e717a7586c0577434263`. 이 원장 및 `docs/exec-plans/active/ISSUE_731.md`·`docs/TEST_PLAN.md`과 단일 논리 커밋으로 게시한다. 필요 없는 API/문서 의미 변경, full Gate 완화, skip/retry/timeout 증가를 하지 않는다. 향후 유사 오류 방지: 테스트 DTO를 구체화한 후 모든 nullable member 접근을 조사하고, Git Data-only 게시에서는 실제 TypeScript 컴파일 전까지 **NOT TESTED**를 선언한다.

### 7.4 누적 실패 집합·검증·인계

- 직접 테스트 실패 **파일 합집합**: E2E `tests/e2e/issue-726-task-logistics.spec.ts` (F-002 line262, GET ECONNRESET); TypeScript 같은 파일 line370 (F-003, null 스프레드). F-001은 제품 `src/server/logistics/logistics-kpi-service-core.ts` Codex review/QA Final 거부였으며 E2E 테스트 실패가 아니다. 다른 Issue(#667/#726)의 실패는 참고만 하고 이 이슈 실패에 합산하지 않는다.
- **원격 F-003 증거 보존**: Run #2999.1/Job ID/Step과 TypeScript 원문, 빠른 검사 판정, 취소/미실행 결과. 로그 원문/쿠키/환경/trace·자격증명은 Git에 저장하지 않는다. F-001/F-002의 SHA·가설·근인 불확정 기록은 수정하지 않는다.
- 코드·문서 후보의 Git Blob/Tree/Parent 및 실제 PR HEAD를 비교하고 main strict·mergeable/review thread0 확인 후 non-force branch ref 갱신만 한다. push synchronize에 의해 Full PR CI가 시작되면 Run ID/attempt·Head/base/test merge 및 event만 확인한다. CI 완료 모니터링하지 않는다.
- **승인 경계**: HEAD에 대한 원격 Required Quality/E2E6/Docker, Trusted QA 및 Owner 최종 ACCEPT·정식 Release는 새 Run 완료 전 **NOT TESTED/BLOCKED**. 병합/Main/GHCR/Finalizer/Issue close는 요청하지 않았으므로 수행하지 않는다. HIGH/OWNER_MANAGED·`release_authorized=false` 유지.

## 8. M-001 — #731 병합 후 Main CI #3002.1 KPI 원본 공정 포커스 복원 실패 (2026-10-19)

### 8.1 실제 원격 증거와 발생 범위

| 항목 | 원본 증거 |
| --- | --- |
| Primary Issue/PR | [Issue #731](https://github.com/planner77/masterGantt/issues/731), [최초 PR #746](https://github.com/planner77/masterGantt/pull/746) merged; Head `0f844136f8975f6a7e0c246985bd384ea48b43ab`, base `01fdc08bf4b2f69f9797a8bd411d6712e7478c09`, test merge `acbf9a498d3da08262eb58ebf28fe128abdb5aee` |
| 검증된 원본 PR | [Full CI #3000.1 / run39213900305 attempt1](https://github.com/planner77/masterGantt/actions/runs/39213900305) Quality/E2E6/Docker SUCCESS; [Trusted QA #643.1](https://github.com/planner77/masterGantt/actions/runs/39217128743) SUCCESS. 본 Main 오류를 PR SUCCESS로 상쇄할 수 없음 |
| 실제 Main | [Main CI #3002.1 / Run39218195042](https://github.com/planner77/masterGantt/actions/runs/39218195042), event `push`, workflow `.github/workflows/ci.yml`, attempt1, HEAD `fbe7db83a4baa2877a75db0769a59077bbe308c4`, first parent(base) `01fdc08bf4b2f69f9797a8bd411d6712e7478c09`, second parent(PR Head) `0f844136f8975f6a7e0c246985bd384ea48b43ab`, Git Tree `f20d9fd1ae55a8aae9f18f358a955491163c99b9` |
| 독립 성공 | TypeScript, ESLint, Vitest, policy, Next.js production build, main Quality aggregate `117947533008` SUCCESS. Docker smoke `117947042834`/aggregate `117948688108` SUCCESS. Chromium Shard1 `117947042890`, Shard2 `117947042967`, Shard3 `117947042975`, Shard4 `117947042788`, Shard5 `117947042833` 모두 SUCCESS |
| 최초 **실제** 실패 | [Shard6 job `117947043171` step7](https://github.com/planner77/masterGantt/actions/runs/39218195042/job/117947043171), `tests/e2e/logistics-dashboard-request-state.spec.ts:411` case '#731 공정·WorkArea 원본 이동은 정확한 공정 행과 KPI 출발 초점을 복원한다'에서 **line424 `expect(process).toBeFocused()`** FAIL. locator `[id="logistics-master-process-proc-1"]`는 toBeVisible **PASS**, toBeFocused는 5s 동안 `Received: inactive`. 화면의 정확 원본 `입고 공정` 행이 렌더됐지만 키보드 focus 인계 완료가 아니었다 |
| Shard6 및 후속 | Shard6 **125 PASS / 1 FAIL**(126 예정, NOT RUN 0); Main `fail-fast=false`, 다른5 shard 성공. Chromium aggregate `117957329601` FAILURE는 위 Shard6 실패 파생. GHCR 임시 `ci-<merge SHA>` Job `117957373205` **SKIPPED**. QA Final PR-only SKIPPED; Main에 독립 QA FAIL이 있었던 것으로 기록하지 않음 |
| 원본 보존 | [Playwright shard6 report/trace artifact `12171083540`](https://github.com/planner77/masterGantt/actions/runs/39218195042/artifacts/12171083540), CI 로그 및 Run/Job GitHub 출처. Raw trace, 환경, 쿠키·session은 Git에 넣지 않는다 |

### 8.2 누적 F-001~F-003 및 PR PASS와 Main 차이 대조

| 사건 | 당시 근인/교정 | 현재 Main 영향 |
| --- | --- | --- |
| F-001 / PR #2997.1 | WorkArea 구성 원본 모집단 PRODUCT + 정상 QA review gate. Task/Assignment canonical 범위 수정, P2 thread resolve | Main Unit/Build 성공, 별도 구성 상세 회귀 로그 없음. 새로운 **원본 이동 후 focus** 기능이 검증 대상이며 모집단 계산 오류 재발로 단정하지 않음 |
| F-002 / PR #2998.1 | #726 독립 APIRequestContext GET `ECONNRESET` INIT_TRANSPORT(근인 UNKNOWN); UI 이후 browser same-origin GET 및 safe observer 교정 | 이번 실패는 로케이터 toBeFocused이며 HTTP/reset 오류가 아님. Main Shard4 SUCCESS; transport 근인을 소급 증명하지 않음 |
| F-003 / PR #2999.1 | #726 E2E DTO `TaskProcessLink[] | null` TS2488 TEST_CONTRACT; 명시 null guard | Main TypeScript SUCCESS. 이번 focus 문제는 별개의 UI 시점 계약 |
| 최종 PR #3000.1 | 같은 #731 Head의 Full CI: 6-shard 모두 SUCCESS, QA Final/Trusted PASS | 동일 code/tree를 Main의 전용 shard 환경에서 검증하자 Shard6 #731 이동 초점이 FAIL. 단일 성공과 실패의 출처·event/runner/timing을 구별하고 'flaky'나 'CI 오류'로 추정 치유 금지 |
| **M-001 Main #3002.1** | 위치는 원본 이동 이후 행 focus, expected focused vs actual inactive. 제품 src의 클릭 시 단일 `requestAnimationFrame(() => document.getElementById(...).focus())`와 상위 `onSubviewChange`→Parent `setActiveScreen`이 별도 React commit에 의존 | **근인 가설**: click-time rAF가 새 subview/panel commit 또는 렌더/가시성 완료 전에 실행되어 hidden 행 `focus()`가 무효화/나중에 탈취될 수 있음. Trace는 행 존재·불활성만 증명하며 정확한 브라우저 focus 이벤트의 시간순서는 기록 부족으로 UNKNOWN. 제품 focus handoff 경계를 after-commit bounded 확인으로 방어 |

**누적 실제 E2E 실패 파일 합집합**은 `tests/e2e/issue-726-task-logistics.spec.ts`(F-002 전송)와 `tests/e2e/logistics-dashboard-request-state.spec.ts`(M-001 focus)다. F-003은 전자 파일의 타입 검사 실패, F-001은 별도 서버 제품/리뷰 문제. 다른 Issue #667/#726의 사례는 비교 선례이지 #731 원격 실패 건수에 추가하지 않는다.

### 8.3 수정 설계·검증 범위·불확실성

1. **제품 최소 범위:** `src/features/logistics/project-logistics-management.tsx`의 공정/설비/System/WorkArea→공정 원본 이동에서 **click-time 단일 rAF focus를 제거**하고, 정확 canonical `kind,id,revision` 요청을 임시 보존해 **React panel commit 이후** `useLayoutEffect` + 제한 8 frame에서 실제 연결·가시 행만 focus한다. 같은 navigation/연결·revision·subview와 focus 결과를 확인하고 완료 즉시 폐기한다.
2. **부작용 방지:** 최신 화면 전환에 대한 stale request는 수행하지 않고, 현재 도착 panel 안에서 사용자가 새로 초점을 이동했다면 자동 복원으로 가로채지 않는다. `returnToKpi`는 기존 출발 트리거→fallback 포커스를 유지하면서 pending 복원을 취소한다. 숨긴/비활성/없는 행을 무조건 focus하거나 다른 기준정보를 선택하지 않는다. 원래 데이터·API·권한·revision·Gantt Core·DB·KPI 산식·Target/Resource 기능 수정 없음.
3. **테스트 보완:** `tests/e2e/logistics-dashboard-request-state.spec.ts`의 **원래 #731 공정/WorkArea 2회 왕복**에 실제 행 `tabindex=-1`/가시성/포커스, 상위 화면 commit 이후 연속 두 animation frame의 focus 유지, 이후 사용자에 의한 'KPI로 돌아가기' 버튼 수동 focus 유지와 기존 KPI 진단 출발 버튼 focus 복귀를 추가한다. 기존 5초 `toBeFocused`/정확 행 이름·revision·snapshot assertion, 다른 Resource/Task/Assignment drill 검증은 완화하지 않는다.
4. **동일 source 확대 검증 선택:** 원격 실패 합집합 #726 Task process-context E2E와 #731 dashboard-request-state E2E 전체, 인접 master.processes/equipment/systems 및 WorkArea 다중 연결·활성/검색/readonly/새 탭·키보드, Project workspace parent navigation(#724/#717/#624), stale revision/비동기 패널, resource/Task/Assignment 복귀. Next build, lint/typecheck, Unit 및 Full Chromium 6-shard, Docker를 새 HEAD PR CI에 요구. Gantt native layout/Copy/Calendar/Import 등 코드를 건드리지 않는다. 자동 timeout/skip/retry·Assert 완화/QA·Ruleset 변경 없음.
5. **실행 검증 경계:** GitHub connector Git Data로 후보 source와 변경 Blob·Tree를 정적 대조할 수 있지만 프로젝트 checkout/node_modules/Chromium runtime은 제공되지 않으므로 **로컬 TypeScript/Vitest/실제 browser/HTTP NOT TESTED**. 원본 #3000 PR PASS, 원본 #3002 Quality/Docker PASS는 새 HEAD의 결과로 전용하지 않는다. 실제 React rAF 경합의 재현·제품 PASS는 후속 Full PR CI가 필요.
6. **문서/릴리스/후속:** 기존 유일한 canonical 원장 `docs/ISSUE_731_FAILURE_ANALYSIS.md`에 M-001 추가, Work Packet/TEST_PLAN/PROJECT_UX/CHANGELOG 동기화. 별도 디자인 시스템 신설 없음: `DESIGN.md` N/A. Main이 이미 병합된 뒤이므로 **원래 PR #746을 수정하거나 불변 Main #3002의 실패를 다른 코드의 PASS로 재해석 금지**. latest main으로 별도 corrective PR(Refs #731)을 생성하고 필수 PR Quality/E2E6/Docker, Trusted QA, 리뷰 thread0·충돌0, Owner 승인 후에만 새 merge/main SHA를 만들 수 있다. 이전 Main #3002 rerun은 수정이 적용되지 않는 동일 SHA이므로 교정 CI 대신 사용하지 않는다. GHCR/Finalizer/정식 `v0.123.0` Release 권한은 `release_authorized=false`; Issue OPEN 유지.

## 9. F-004 — PR #748 Full CI #3004.1 QA Final P1 review 및 패널 바깥 포커스 가로채기 (2026-10-19)

### 9.1 실제 GitHub 기록과 최초 실패

| 범위 | Run/Attempt/Job/Shards·확정 근거 |
| --- | --- |
| Primary Issue / 연관 PR | [#731](https://github.com/planner77/masterGantt/issues/731), 기존 원본 PR [#746](https://github.com/planner77/masterGantt/pull/746) **MERGED**, Main M-001 교정 PR [#748](https://github.com/planner77/masterGantt/pull/748) **OPEN**, branch `fix/issue-731-main-focus-3002` |
| Full PR source | [PR CI #3004.1 / Run 39223658039](https://github.com/planner77/masterGantt/actions/runs/39223658039), attempt 1, `pull_request`, workflow `.github/workflows/ci.yml`, completed FAILURE. Exact Head `33692194d31b9cc4b6aba82cbeb31e99f7b197fb` / Base `fbe7db83a4baa2877a75db0769a59077bbe308c4` / GitHub test merge `9de5652f25880295f60a827f00ba2788f148dc0c`. 조회 당시 `main == base`, `mergeable=true`, 실제 code tree `8db82b21be25ef3d013a6c6b5b727f9fa6d8451c` |
| 선행 Gate / Quality | QA Preflight `117964722747` SUCCESS, PR Fast Gate `117965443406` SUCCESS, TypeScript `117964812476` SUCCESS, ESLint `117964812352` SUCCESS, Vitest `117964812394` SUCCESS, 정책 `117964812274` SUCCESS, PR build `117965521856` SUCCESS. Required Quality aggregate `117965989824` **SUCCESS** |
| E2E 실제 6 Shards | PR Shard1 `117965521535`, Shard2 `117965521718`, Shard3 `117965521597`, Shard4 `117965521739`, Shard5 `117965521831`, Shard6 `117965521553`: **모두 SUCCESS**, cancelled/실제 실패0. Required E2E aggregate `117974598538` **SUCCESS** |
| Docker | PR Docker smoke 구현 `117965521484` SUCCESS, Required Docker aggregate `117966417354` **SUCCESS** |
| 최초 실제 FAIL | [QA Final — Automated job 117974637296](https://github.com/planner77/masterGantt/actions/runs/39223658039/job/117974637296), step3 `최신 PR 증거·문서·리뷰 확인 (read-only)` FAILURE. 출력 `자동 QA: BLOCKED`, `사유: 미해결 review thread`; `NEED_QUALITY/NEED_E2E/NEED_DOCKER=success`. 테스트·빌드 오류가 아닌 **POLICY_CI의 정상 P1 보호 차단** |
| 리뷰의 구체적 근거 | [Codex inline P1 comment 4311801144](https://github.com/planner77/masterGantt/pull/748#discussion_r4311801144), GraphQL thread `PRRT_kwDOUUB7Bc6t10yb`, `src/features/logistics/project-logistics-management.tsx`의 `focusAfterCommit`. PR의 미해결 review thread **1**; 이전 #746의 P2 thread는 이미 resolved로 유지됨 |
| 보조 미실행 | Main-only 이미지 게시/metadata-only·PR 비대상 placeholder Job **SKIPPED**; Required 세 종 실동작 SUCCESS. 다음 source에서 Product 수정 후 새 Full PR CI만 실제 결과를 재검증할 수 있다 |

### 9.2 F-001~F-003 / Main M-001 교차 판단

| 이전 원격 사건 | 기존 원인·교정 (불변) | #3004.1에서 얻은 증거 및 결손 |
| --- | --- | --- |
| F-001 / #746 #2997.1 | WorkArea 구성의 canonical 모집단 필터 오염 **PRODUCT** + 미해결 P2 차단 **POLICY_CI**. KPI 필터 무관 구성 관계/테스트 수정 후 이전 thread 해결 | E2E6/Unit SUCCESS이지만 이번 리뷰는 **별도 P1** (focus 재시도 범위)이며 F-001의 과거 오류/해결 기록을 섞지 않음 |
| F-002 / #746 #2998.1 | #726 browser/Playwright 독립 APIRequestContext GET ECONNRESET, **INIT_TRANSPORT / 근인 UNKNOWN**; same-origin browser GET·safe observer 보완 | E2E6 SUCCESS. #667 비교 오류와 별개, 실제 Next worker/sockets의 과거 근인을 소급 확정하지 않음 |
| F-003 / #746 #2999.1 | `TaskProcessLink[] | null` TS2488 **TEST_CONTRACT**, guard 이후 exact 관계 단언 보존 | 이번 TypeScript SUCCESS. 별도 P1은 타입 검사 실패가 아님 |
| M-001 / #746 Main #3002.1 | `logistics-dashboard-request-state.spec.ts:424` focus 예상/비활성 실제 FAIL, 125PASS/1FAIL(Shard6), 다른5 PASS, GHCR SKIPPED. Click-time rAF와 parent React commit 경합 **PRODUCT 취약 경계 / 이벤트 정확 근인 UNKNOWN** | #748 교정 source는 post-commit bounded 8 frame focus로 변경되어 이번 E2E6 SUCCESS. 다만 **사용자가 대기 중 새 포커스를 지정한 경우**는 기존 E2E coverage 공백. 새 P1의 정당성을 없애지 않음 |
| **F-004 / #748 #3004.1** | **PRODUCT**: 포커스 재시도 중 새 유효 사용자 초점이 기존 공정 테이블 `#panel-processes` 밖(검색창/‘KPI로 돌아가기’ 버튼/상위 탭)에 있으면 guard가 `focused.closest(`#panel-${view}`)`에 걸리지 않아 원래 공정 행이 나중에 focus를 빼앗을 수 있음. 동시에 **POLICY_CI** 미해결 thread 차단은 정상 동작 | 제품 guard 범위를 destination table 하위에서 **현재 페이지의 모든 새 연결·가시 focus 대상**으로 확장하고, 해당 두 sibling 버튼/input 반례의 E2E 추가. CI 원래 6-shard PASS는 새 Head 증거가 아님 |

**누적 실패 파일/경계 합집합**: E2E 실제 실패 `tests/e2e/issue-726-task-logistics.spec.ts` (F-002) 및 `tests/e2e/logistics-dashboard-request-state.spec.ts` (M-001). F-003 같은 #726 파일의 TypeScript 오류. F-001 제품 `src/server/logistics/logistics-kpi-service-core.ts` review, **F-004 제품 `src/features/logistics/project-logistics-management.tsx` review** 및 QA Final 차단. 단순 E2E TEST FAIL 수와 정책 QA FAIL·취소/미실행을 합산하지 않는다. #746 Full #3000.1 및 #748 Full #3004.1의 서로 다른 Head·Run/Attempt/QA 신뢰 경계 유지.

### 9.3 신규 P1 최소 보완·반례·검증

1. **제품 수정**: `src/features/logistics/project-logistics-management.tsx`에서 `isVisibleFocusTarget(focused) && focused !== target && focused.closest(`#panel-${view}`)`의 마지막 *패널 내부 조건*만 제거한다. 기존 `focused !== document.body`, `focused !== kpiOrigin.trigger`, 정확 target 비교와 connected/getClientRects/not hidden/not inert/disabled 가시성은 유지. 외부 검색/복귀 버튼/상위 탭으로 사용자가 옮긴 **유효한 포커스**가 생기면 pending 복원을 바로 취소한다. 목표 행이 아직 hidden/미존재면 무조건 성공 처리하지 않고 기존 8 frame 유한 시도 유지.
2. **제품 영향**: KPI→공정/WorkArea·설비·시스템 관리 정확 원본, source revision/active tab, 별도 `returnToKpi`의 진단 버튼/summary fallback, 조회·비활성·미연결 상태, 새 화면/사용자 입력 가로채기 금지. DB/API/공수·Target/WBS/Gantt Core/기존 세 Required·QA 정책/Ruleset/timeout/retry/skip·앱 버전 `0.123.0` 무변경.
3. **회귀 테스트 보완**: `tests/e2e/logistics-dashboard-request-state.spec.ts`의 기존 가시 `toBeFocused`/2 animation frame/원본 복귀 검사를 그대로 유지. **추가 2개 실제 브라우저 시나리오**: (a) 'KPI로 돌아가기' (b) toolbar `물류 항목 검색`. 대상 행을 CSS로 *일시적으로만* 표시하지 않아 pending focus 재시도가 대기하도록 통제하고, MutationObserver에서 신규 sibling control이 보이자 직접 focus한 뒤 가림을 제거한다. 다음 animation frame 2개에서 새 control focus가 유지되고 원래 공정 행은 **포커스되지 않음**, 정확한 원본 행 콘텐츠/복귀/수정0을 검증한다. 이 통제 변형은 시험 기법이며 실제 원격 브라우저 재현 PASS가 아니다. Assertion/timeout/CI skip/retry 완화 없음.
4. **직접·간접/음성 검사**: 기존 F-002 #726 실제 SQLite/HTTP GET, M-001 #731 original/wA row 2회 왕복, 이번 focus-preemption sibling2, #724 parent navigation/Tab/hidden section, #717 이름/identifier, #725 다중 WorkArea, #728/#729 원본 KPI source/WorkArea Task/Assignment, readonly, 화면 전환 중 최신 사용자 input, returning source/button focus, stale revision/disabled/hidden/missing target. 신규 Full PR CI의 Quality/Chromium6/Docker 및 default-main Trusted QA/Owner 수용을 새 Head에서 검증한다.
5. **수정 검증 상태**: GitHub 연결 Git Data에서 코드의 정확 유일 anchor 치환, 변경 Blob과 원본 엄격 E2E/추가 2개 시나리오·변경 문서/Tree 경계 정적 대조 **PASS(구조에 한정)**. **프로젝트 runtime/Checkout/Node/npm/Chromium/TypeScript 실제 로컬 실행 NOT TESTED**. #3004 Quality/E2E6/Docker SUCCESS는 이전 Head의 결과일 뿐 새 수정 Head 테스트 PASS가 아님.
6. **리뷰/출처 처리**: 변경 묶음을 하나의 Git commit으로 준비하고 전체 Tree SHA·parent 및 expected Head guard 확인 후 `fix/issue-731-main-focus-3002` 기존 PR #748에 non-force ref 업데이트한다. Codex P1 [4311801144](https://github.com/planner77/masterGantt/pull/748#discussion_r4311801144)에 수정·검증·원장 링크와 미검증을 회신한 뒤 **수정 코드를 실제 게시/확인한 경우만** 스레드를 resolve하고 `unresolved=0`을 읽어 확인한다.
7. **중단점**: 최신 main/base가 변했는지 재검증하고 GitHub mergeable=true, unresolved0 뒤 `pull_request.synchronize` 새 Full PR CI Run/Attempt·Head/base/test merge 시작 여부만 확인. 완료 모니터링하지 않으며 병합/Main CI/GHCR/Finalizer/정식 v0.123.0 release/Issue close는 수행하지 않는다. `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `release_required=true`, `release_authorized=false`, `MERGE_READY=BLOCKED` 유지.

## 10. M-002 — 교정 PR #748 병합 뒤 Main CI #3007.1 설비 PATCH 동적 라우트 404 (2026-10-19)

### 10.1 원본 실행/Shard/최초 실패/후속 차단

| 항목 | 불변 증거 |
| --- | --- |
| Primary Issue / 연결된 PR | [Issue #731](https://github.com/planner77/masterGantt/issues/731), 최초 PR [#746](https://github.com/planner77/masterGantt/pull/746) merged, Main focus 교정 PR [#748](https://github.com/planner77/masterGantt/pull/748) merged |
| 최신 PR 성공 | [Full PR CI #3006.1 / run39228359207 attempt1](https://github.com/planner77/masterGantt/actions/runs/39228359207) Head `05ec16852d8940e638f4f5cb754e119ebe1a532a`, Base `fbe7db83a4baa2877a75db0769a59077bbe308c4`, test merge `54ef8603c6db72fd77bf9dff69b275b443029061`, Required Quality/E2E6/Docker 및 [Trusted QA #648.1](https://github.com/planner77/masterGantt/actions/runs/39232336048) SUCCESS. Main 실패를 덮어쓰지 않음 |
| 해당 Main SHA/source | Merge SHA `a0297cd4b01e0083273ad3444edc7fa1ed0a145f` (parent1 `fbe7db83a4baa2877a75db0769a59077bbe308c4`, parent2 `05ec16852d8940e638f4f5cb754e119ebe1a532a`, git tree `a6e3a249dacb4b653885b6a4cb1d3e3a560b01ee`). [Main CI #3007.1 / run39232888704 attempt1](https://github.com/planner77/masterGantt/actions/runs/39232888704), event `push`, workflow `.github/workflows/ci.yml`, conclusion FAILURE |
| 독립 성공 | TypeScript `117994951689`, ESLint `117994951568`, Vitest `117994951703`, Next.js Build `117994951547`, 정책 `117994951743`, Required Quality aggregate `117995469385` 모두 SUCCESS. Docker smoke `117994951809`, Required Docker aggregate `117996369906` SUCCESS |
| E2E 실제 실행 | Shard1 `117994951875`, Shard2 `117994951766`, Shard4 `117994951736`, Shard5 `117994951723`, Shard6 `117994951720`: **SUCCESS**. [Shard3 job117994951768](https://github.com/planner77/masterGantt/actions/runs/39232888704/job/117994951768) step7 **FAILURE**, Playwright **101 PASS / 1 FAIL / 1 SKIPPED**, Main fail-fast=false, CANCELLED 0. Aggregate Chromium E2E `118006666861` FAILURE(파생). |
| 최초 직접 실패 | `tests/e2e/issue-725-process-workareas.spec.ts:88` case '#725 Target0 독립 공정·WorkArea 관리와 타 공정 E10 다중 연결·재조회·해제·재시작', line275 `expect(dialog).toHaveCount(0)` Expected0/Actual1 after 5s. [Playwright shard3 report/trace artifact 12179125199](https://github.com/planner77/masterGantt/actions/runs/39232888704/artifacts/12179125199) |
| 트레이스의 분리된 HTTP 결과 | 재시작 **전** 같은 설비 URL에 대한 실제 browser `PATCH`는 HTTP **200 / application/json**. 재시작 **후** 실제 browser `PATCH`는 HTTP **404 / text/html**, Next 404 페이지. 화면은 '서버 처리 중 오류가 발생했습니다' 상태에서 원본 편집 Dialog를 유지. 업무 `handleUpdateEquipment`가 404 JSON을 반환한 증거는 없음 |
| 기타 Job/이미지 | Main GHCR 임시 commit 이미지 게시·검증 Job `118006700330` **SKIPPED** (E2E required 실패), PR 전용 metadata/QA placeholder 조건부 SKIPPED. GHCR candidate/tag/digest가 발행됐다고 주장하지 않음 |

### 10.2 전 사건 F-001~F-004 / Main M-001과의 교차 분석

| 과거 사건 | 당시 오류·교정 | M-002의 새 증거/남은 리스크 |
| --- | --- | --- |
| F-001 / PR #746 #2997.1 | KPI WorkArea 구성 Task/Assignment 전체 모집단 PRODUCT + P2 unresolved QA. 원본 관계/회귀를 수정하고 resolve | 이번 실패는 #725 설비 PATCH가 handler JSON이 아닌 Next HTML 404인 별도 라우팅/준비 경계; 구성 분모 계산 재발로 단정하지 않음 |
| F-002 / PR #746 #2998.1 | #726 post-UI `APIRequestContext GET` ECONNRESET, 정확 socket/worker 원인 UNKNOWN. same-origin browser read와 observer로 교정 | 이번 것은 응답 자체가 **HTML HTTP404**, ECONNRESET이 아님. 모두 브라우저/API 경계와 관련 있으므로 별도 INIT_TRANSPORT/초기화·경로 준비 검증 필요 |
| F-003 / PR #746 #2999.1 | #726 E2E typed `TaskProcessLink[] | null` TS2488, strict null guard로 해결 | Main TypeScript SUCCESS이며 이번 TEST_CONTRACT 오류가 아님 |
| M-001 / PR #746 Main #3002.1 | KPI→공정/WorkArea 원본 focus visible-but-inactive, Shard6 125PASS/1FAIL, GHCR SKIPPED | #748 React post-commit focus 교정, 이번 Shard6 SUCCESS. M-002는 독립 **서버 재시작 뒤 PATCH route** 경계이며 UI focus 실패가 아님 |
| F-004 / PR #748 #3004.1 | sibling 사용자 포커스 P1 unresolved review로 QA Final BLOCKED, 제품 guard/2 E2E 음성 회귀 수정 | PR #748 최종 Head의 #3006 E2E6/Trusted PASS; Main #3007에서는 다른 Shard3의 재시작 시나리오에서 새 실제 FAIL. 리뷰를 이번 오류 원인으로 돌리지 않음 |
| **M-002 / Main #3007.1** | `restartIsolatedApplication()` 다음 동적 `PATCH /api/projects/[publicId]/logistics/equipment/[equipmentId]`가 HTML 404를 반환, Dialog 유지 | 현재 fixture의 `startApplication`은 health200과 기본 GET 경로만 warmup; 동적 PATCH-only route의 준비 여부는 확인하지 않는다. **FIXTURE_OBSERVABILITY/ROUTE_READINESS** 취약점 관측. Next.js dev 라우트 등록/워커 교체 등 **404 정확 내부 근인 UNKNOWN**, DB 데이터 소실/권한/비즈니스 404로 확정하지 않음 |

- **누적 #731 실제 실패 테스트 파일 합집합:** `tests/e2e/issue-726-task-logistics.spec.ts` (F-002 HTTP reset, F-003 동일파일 TS), `tests/e2e/logistics-dashboard-request-state.spec.ts` (M-001 focus), **`tests/e2e/issue-725-process-workareas.spec.ts` (M-002 restart/PATCH 404)**. F-001/#748 F-004는 제품/review·QA Final 게이트로 별도 취급한다.
- [#725 전용 실패 원장](ISSUE_725_FAILURE_ANALYSIS.md)의 오래된 F-725-001/002/003은 서로 다른 해당 Issue의 PR CI 오류(120px capacity/POST201/original WorkArea owner DOM 순서)다. **이번 이웃 #725 테스트의 #731 Main 실패를 #725 원본 CI 실패로 변경·합산하지 않음**. 다만 전부 교차 회귀 후보에 포함.

### 10.3 보완: 읽기 전용 재시작 readiness + 원래 쓰기 assertion 보존

1. **실제 코드 비교:** `src/app/api/projects/[publicId]/logistics/equipment/[equipmentId]/route.ts`는 `PATCH` / `DELETE`만 export하고 GET 구현은 없다. [Next.js 공식 Route Handler 문서](https://nextjs.org/docs/app/getting-started/route-handlers)는 지원되지 않은 HTTP 메서드에 **405 Method Not Allowed**를 정의한다. 따라서 같은 origin의 실제 동적 URL로 비변경 **GET→405**를 확인하면 route matcher/handler가 준비됐는지 검증할 수 있다. 여기서 GET 404는 ROUTE 미준비 또는 미매칭 가능성이고, GET405만으로 후속 쓰기 성공·정확 Next 내부 근인을 확정하는 것은 아님.
2. **선택적 fixture 보완:** `tests/e2e/fixtures/isolated-application.ts`의 `restartIsolatedApplication`에 기존 사용자에 영향 없는 선택적 `patchOnlyReadinessPath`를 추가. 특정 형식의 같은 origin 프로젝트 설비 API URL만 허용하고 `restart` 실행 중 같은 `startupMilliseconds=90_000` 예산 안에 GET405가 나타날 때까지 **읽기 전용** 검사. GET404/초기 전송 오류는 서버 초기 준비 기간에 한해 관측하고 100ms 간격의 bounded readiness poll; 다른 HTTP status, 다른 origin/path, child 종료·deadline 초과는 즉시/결국 FAIL로 기록한다. `PATCH` 요청은 **절대 자동 재시도/대체 성공하지 않음**. 기본/타 fixture의 restart 호출은 인자가 없어 이전 초기화 계약 그대로.
3. **직접 테스트/관측:** `tests/e2e/issue-725-process-workareas.spec.ts`에서 단 한 곳 `restartIsolatedApplication(equipmentPatchPath)`로 경로 준비를 요구. 실제 재시작 후 WorkArea A 해제 저장과 최종 전체 연결 해제의 **두 실제 UI PATCH** 각각 `page.waitForResponse`로 원본 URL/메서드/HTTP200/JSON content-type을 명시 검증하고 요청 상태·Content-Type·x-request-id 존재 유무만 sanitized evidence로 첨부. 기존 Dialog0, 정확 WorkAreaIDs([B]→[]), equipment 한 개·quantity10, Task 원본·Target0·서버 SQLite 재시작·readonly/5폭/권한/중복쓰기 단언을 **변경하거나 완화하지 않는다**.
4. **원인 구분:** 이것은 제품 E10 다대다 소속 규약을 바꾸는 것이 아니며, 전체 응답을 mock·success로 대체하거나 PATCH retry/CI timeout 증가/skip/allow-404 등 편법을 도입하지 않는다. 라우터가 deadline까지 GET405를 반환하지 않으면 **준비 실패를 명시 실패로 표면화**한다. 실제 후속 PATCH가 404/500이면 정확 status assertion으로 실패를 보존해 지속 원인을 분리 분석한다.
5. **직접/간접·음성 회귀:** 이번 #725 실제 SQLite·브라우저 restart, #731 KPI focus 원본/2 사용자 override, F-002 #726 Task process-context 이후 GET, #725 WorkArea owner canonical PATCH/P2·Task/Template/Copy, #624/#717 master navigation, #728/#729 WBS/KPI snapshot, stale/401/403/409/412/리소스/설비 다중 구역 수량, 등록-only/Target0 및 필수 Quality·Chromium E2E6·Docker. fixture restart의 기존 인자 없는 사용자는 영향 없는지 실제 검증한다.
6. **검증·잔여:** 연결 GitHub Git Data로 코드·문서 앵커, 전체 Git Tree/부모/원격 HEAD를 정적으로 검증. 연결 환경에 Node/npm/Chromium/원본 repo checkout이 없어 **동결 후보에 대한 TypeScript/Vitest/Playwright/SQLite 로컬 실실행 NOT TESTED**. 기존 #3006 PR PASS / #3007 Quality/Docker PASS는 다음 PR Head로 이월하지 않으며 새 Full PR CI 검증이 필수.
7. **다음 작업:** 이미 병합된 #748은 재작성하지 않는다. exact latest `main=a0297cd4b01e0083273ad3444edc7fa1ed0a145f`를 기준으로 별도 **Refs #731** 교정 PR을 만들고 코드/테스트/**같은 단일 #731 실패 원장**·TEST_PLAN·Work Packet을 한 Git commit/fast-forward branch로 게시한다. 리뷰 thread0·충돌0·새 Full PR Run/Attempt/HEAD/base/test-merge 시작까지만 확인하고 CI 완료는 모니터링하지 않는다. OWNER_MANAGED/HIGH, `release_required=true`/`release_authorized=false` 유지, Main/GHCR/Finalizer/정식 `v0.123.0`/Issue close는 이번 새 PR CI 요청 범위 밖.


## 11. M-003 — PR #749 병합 Main #3011.1의 시간 예산·저장 후 조회 실패

### 11.1 원본 SHA·실제 두 실패·성공/미실행 구분

- Run: [Main #3011.1 /39243175274](https://github.com/planner77/masterGantt/actions/runs/39243175274), attempt1, event=push, workflow `.github/workflows/ci.yml`, conclusion=FAILURE.
- Main SHA `0aa1d3d71f13df6976539ef4ebaaadb9037121c4`, parent1/base `a0297cd4b01e0083273ad3444edc7fa1ed0a145f`, parent2/PR #749 Head `bd8b4cbfc5463681fe776e2e925c9d168385e09a`; immutable PR test-merge `e5d95082f90bddd50c3bb46aff0ab30b9c58aff8`, 동일 Tree `99a73f121cdfb9739171dbc18991f1b54c40ba0e`. 코드 차이로 이번 Main 실패를 설명할 증거는 없다.
- Required Quality aggregate `118029291432` SUCCESS. Docker aggregate `118029249110` SUCCESS는 path policy의 `REQUIRED=false/RESULT=skipped`; Docker 구현은 SKIPPED이므로 실행 PASS를 주장하지 않는다. E2E aggregate `118039660913` FAILURE는 아래 실제 두 실패에 따른 파생 결과. Main GHCR Job `118039691936` SKIPPED.
- Shard3 [Job118028733073](https://github.com/planner77/masterGantt/actions/runs/39243175274/job/118028733073) step7:101 PASS/1 FAIL/1 SKIP. Shard4 [Job118028732994](https://github.com/planner77/masterGantt/actions/runs/39243175274/job/118028732994) step7:161 PASS/1 FAIL/1 SKIP. 나머지 Shard1 `118028732884`135 PASS, Shard2 `118028733148`129 PASS/1 SKIP, Shard5 `118028733159`84 PASS, Shard6 `118028733095`128 PASS 모두 SUCCESS. 합계738 PASS/2 FAIL/3 SKIP, CANCELLED0. 기존 skip를 새 성공으로 계산하지 않는다.
- 원본 artifact: [Shard3 12183612240](https://github.com/planner77/masterGantt/actions/runs/39243175274/artifacts/12183612240), [Shard4 12182763366](https://github.com/planner77/masterGantt/actions/runs/39243175274/artifacts/12182763366). raw trace·로그의 cookie/session/환경은 Git에 넣지 않고 정제한 수치/출처만 기록한다.

### 11.2 M-003-A — #623 시간 예산 및 응답 수명

- 파일 `tests/e2e/issue-623-resource-mvp.spec.ts`, 기존 case '#623 실제 통합 구성·F0 원시5M/D·여섯 별도 mutation·양방향 동일원본 복귀', test limit60,000ms.
- 사실: 과거 같은 통합 case의 #3000 57.8s, #3002 55.3s, #3006 56.9s, #3007 49.0s, #3010 58.9s, 이번 #3011 60초 초과. 직전 PR PASS가 충분한 시간 여유를 증명하지 않았다.
- Trace: body 시작 기준 +59,857ms에 line190 일정 tab click, +59,960ms에 AfterHooks, +60,758ms 뒤 후행 단언/line201 `workbookResponse.body()`의 `Response has been disposed`. 최초 Excel 검증은 line112에서 body를 이미 읽었다. **반복 body 읽기가 최초 지연 또는 제품 Excel 실패의 직접 원인이라는 주장은 기각**한다. 제한시간 종료와 응답 폐기의 순서를 보존한다.
- 원인 경계: fixture·API oracle·UI/OOXML·여섯 mutation·최종 복귀를 한 테스트60초에 결합한 **TEST_CONTRACT(시간 예산 결합)** 취약점과 폐기된 Response 후행 사용의 **TEST_CONTRACT**다. 서버/DB 기능 결함이나 특정 HTTP가 느렸다는 인과는 별도 계측 전 UNKNOWN이다. child alive, Health200, cgroup oom/oomKill0 관측은 OOM·프로세스 종료 확정 근거가 없음을 뜻한다.
- 보완: 조회/기간·M/D/M/M·OOXML golden과 여섯 mutation/양방향 동일원본을 각각 **독립 fixture**의60초 case로 분리한다. 기존5폭 geometry는 아래 로컬 진단에서 추가 예산 취약점이 확인되어 폭별 독립30초 case로 분리한다. 처음 받은 Excel body를 Buffer 한 번으로 확보하여 parsing/bytes evidence에 재사용한다. setup/seed/API/UI/Excel·개별 mutation·복귀/teardown phase 시간을 실패 시에도 attachment에 남긴다. 경고는 진단이며 assertion·timeout·retry/skip 대체가 아니다.
- 보존: 각 fixture 내부의 원시 Task/개인 Assignment/Target/MCS UUID·5M/D/0.25M/M·OOXML Y/Z·snapshot불변, 여섯 정확 method/body/revision+1·같은 Gantt Core·복귀·10조합/5폭/keyboard/query0를 유지한다. **Golden과 mutation case의 UUID는 독립**이므로 동일 Project에서 수행됐다고 보고하지 않는다. 실제 후행 배정/Target 원본 GET2곳도 같은 origin browser fetch/no-store·observer·HTTP200/JSON으로 묶고 재시도하지 않는다.

### 11.3 M-003-B — Summary 저장 뒤 canonical GET ECONNRESET

- 파일 `tests/e2e/project-task-editor-persistence.spec.ts:110`, case 'Summary Description and URL persist while derived schedule stays readonly', 원본 line162 `page.request.get(api)`에서 HTTP 응답 전 `ECONNRESET`.
- UI 저장 이후의 별도 APIRequestContext canonical GET이라는 전송 종류는 F-002/#667 선례와 같지만, 호출 위치가 다른 신규 실패다. same-origin browser fetch/no-store helper·`observeIsolatedApi`로 후행6개 조회를 정합화한다. setup의3개 seed GET과 독립 API 쓰기는 유지한다.
- HTTP200·유효 JSON·원시 Task/description/URL·삭제·스케줄·readonly·mutation count·같은 인스턴스 단언을 유지하며 Summary 저장/삭제 revision+1/+2도 검증한다. helper/production/API/DB·CI 설정은 변경하지 않는다. 정확 socket reuse/Next worker 내부 근인은 **UNKNOWN**이며 단순 미재현 PASS를 근인 해결로 확대하지 않는다.
- 실패 후 직접 진단은 child alive/exitCode·signal null, Health200(Shard3 21ms /Shard4 14ms), baseline/failure cgroup oom0·oomKill0. OOM·DB 손상·프로세스 강제 종료를 확정하지 않는다. browser 경로가 fault route를 우회하거나 자동 성공/재시도로 바뀌지 않는지 음성 검증한다.

### 11.4 전 이력 교차 매트릭스·실패 합집합

| 사건 | 당시 교정 | 최신 Main #3011의 사실·이번 검증 범위 |
| --- | --- | --- |
| F-001 구성 WorkArea/P2 | 전체 canonical Task/Assignment 원본 | Unit·#731 exact source 회귀, 새 필터로 구성 관계를 축소하지 않음 |
| F-002 #726 GET reset | browser no-store·observer | 다른 Task Editor callsite에서 같은 전송형식 M-003-B. 선례를 공통 후행 경계로 재사용하되 정확 내부 근인 UNKNOWN |
| F-003 #726 TS2488 | nullable guard | TypeScript 통과 여부 재검증; legacy null/명시0 의미와 정확 관계 단언 보존 |
| M-001 정확 master focus | post-commit bounded focus | 해당 KPI/WorkArea 원본 왕복과 focus 안정성을 전체 spec에서 다시 실행 |
| F-004 새 사용자 focus/P1 | 외부 가시 초점 우선 | 검색/복귀 버튼·후속 입력 초점 탈취 음성2개를 포함 |
| M-002 #725 restart PATCH404 | read-only GET405 준비·실제 PATCH200/JSON | 최신 Main의 원래 restart case49.7s PASS, owner case16.6s PASS. 이 사실은 Next 내부404 근인 해결 증명이 아님; 이번에도 두 원본 case 재실행 |
| M-003-A #623 budget | coherent scenario 분리·bytes1회·phase 관측 | 원래 모든 원장/수치/여섯 mutation·5폭 검증을 보존하고 동일 source에서 시간 여유를 측정 |
| M-003-B editor reset | 후행6 GET browser authority·observer | seed3GET/독립 API 권한 유지, actual HTTP/SQLite와 helper 오류·외부 경로 음성 검증 |

**실제 실패 테스트 파일의 논리적 합집합은5개**: `issue-726-task-logistics.spec.ts`, `logistics-dashboard-request-state.spec.ts`, `issue-725-process-workareas.spec.ts`, `issue-623-resource-mvp.spec.ts`, `project-task-editor-persistence.spec.ts`. 정책 QA 실패와 TypeScript 같은 파일 중복, 다른 Issue의 별도 실패를 이 합집합 케이스 수로 중복 계산하지 않는다. 신규 source 동결 후 전체5파일을 workers1/retries0/max-failures0으로 한번 실행하고, 시간/전송·재시작·focus의 한정된 과거 실패 case만 별도 새 격리 실행으로 반복한다. 독립 GitHub runner가 아닌 동일 로컬 host라는 한계를 명시한다.

### 11.5 동결 검증·문서·리뷰/충돌 및 새 PR CI

현재 baseline0aa1d3d7, branch `fix/issue-731-main-ci-cumulative`, version0.123.0 유지. 실제 결과·source SHA256·최초 로컬 실패/재시도·미검증을 실행 후 이 절에 누적한다. 런타임/Unit/Chromium 실행 전에는 NOT TESTED이며 다른 Head의 이전 PASS를 가져오지 않는다. source 변경 시 해당 source의 검증을 재수행한다.

원장·Work Packet·TEST_PLAN·CHANGELOG·active PLAN을 동기화한다. 기존 Product/API/DB/일정/Gate·전역 DESIGN/보안·CI/릴리스 정책은 변경하지 않고 파일별 N/A 근거를 Work Packet에 유지한다. 과거 review #746 P2/#748 P1은 이미 resolved, #749 thread0이고 #731 열린 교정 PR은 없는 것으로 조회했다. 게시 직전 main/branch·새 PR 미해결 리뷰/mergeability를 다시 읽어 충돌/리뷰를 처리한 뒤 **새 Full PR CI 시작만 확인**한다. 완료 모니터링·병합·Main/GHCR·Finalizer·정식 Release·Issue 종료는 범위 밖이다. HIGH/OWNER_MANAGED, release_required=true/release_authorized=false, 새 Required/Trusted/Owner ACCEPT는 NOT TESTED다.

### 11.6 이번 로컬 최초 진단 실패와 후속 보완

- 최초 후보의 TypeScript 실행은 `issue-623-resource-mvp.spec.ts:269 TS2532 Object is possibly undefined`로 FAIL했다. 정확 DTO를 도입한 뒤 `bindings.find(...)`의 부재 guard가 빠진 TEST_CONTRACT이며 과거 F-003과 같은 누락 유형이다. DTO·기대 UUID를 완화하지 않고 명시 runtime guard로 좁힌다. 원격 #3011의 실패 원인으로 소급 합산하지 않는다.
- 첫5파일39case 진단은 retries0/max-failures0으로 완주해 **38 PASS/1 FAIL/0 SKIP/0 flaky**,586,621ms(9.8분)였다. #623 golden27.2s·여섯 mutation44.6s PASS였으나 기존 단일 geometry30초 case에서 실제31.0s FAIL을 기록했다. phase attachment는 seed17,595ms/UI13,307ms, budgetWarning=true였다. Trace에서390/768/1024/1440의 tree/matrix8조합은 통과했고1920 tree의 scroll poll은 진입 약1.5ms 만에 전체deadline으로 중단됐다. scrollLeft 값 불일치나 제품 overflow 결함을 직접 관측한 실패로 해석하지 않는다.
- geometry 보완은390/768/1024/1440/1920 **각각 독립 fixture/30초 case**다. default1440에서 snapshot/instance 캡처 후 해당 폭으로 resize하고 tree→matrix 두 모드를 연속 검사한다. 정확 alignment/cell/button bounds·390 keyboard scroll/나머지 focus·write0/canonical 동등/Gantt instance 계약을 유지하며 총10조합이다. 폭별 Project UUID와 evidence JSON/attachment를 분리한다. 전체 또는 case timeout 증가·실패 retry·skip은 없다. 다른 폭을 같은 Project에서 연속 검사했다고 보고하지 않는다.
- 단계 시간은 진단용이다. body80% 경고는 runner 성능 보장/독립 CI 안정성 gate가 아니며 격리 서버 fixture 자체의 별도120초 제한과 body 밖 page/context 비용을 같은 예산으로 오인하지 않는다. 본문 실패 시 finishBody 이전 teardown 일부가 body 관측에 포함될 수 있다. 원시 trace/secret-bearing 환경 로그는 커밋하지 않는다.

- 초기 Pre-PR fast는 source 동결 전에 시작되어 담당자 수정과 겹칠 수 있어 Manager가 해당 로컬 실행만 SIGINT 중단했다. 보고서는 BLOCKED/Interrupted·sourceStable=false이며 최종 검증으로 사용하지 않는다. source 동결 뒤 새 실행으로 대체하고 이 중단을 원격 CI FAIL/취소나 최종 PASS로 계산하지 않는다.

### 11.7 최종 동결 source의 로컬 실제 결과

- 정제한 [실행 영수증·파일별 SHA256](evidence/issue-731/m003-local-validation.json)에 명령·원래 실패·각 case/phase·Pre-PR 판정을 보존한다. 두 변경 spec은 각각 #623 `157f489ebd31cd9e115eefdfa042985a6f40e7f2c9685f9b54e30d25cdc564d1`, persistence `3e266129bf0652a1ac9a191581d01398fbecf180148e058bd58a9a05141db510`다. 원래39case source와 최종43case source를 구별한다.
- 최종 누적5파일: **43/43 PASS,0 FAIL/0 SKIP/0 flaky/retries0**,751,450.72ms(12.5분). 실제 `verify:prepr --mode=targeted`에5파일을 명시 include하고 workers1/retries0, 실제 Playwright config maxFailures0으로 완주했다. 기존 reporter에 JSON reporter만 추가했으며 실패 조기중단/CI 설정/timeout을 변경하지 않았다. mock-backed KPI와 실제 SQLite/Next/browser 검사를 단일 host에서 수행한 증거로만 사용한다.
- 최종 Pre-PR fast의10단계(version/discovery/Markdown/cache/QA fixture/dependencies/TypeScript/ESLint/Unit/production build)는 모두 PASS. 전체 Unit244파일3,048 PASS 및 기존1파일3 SKIP, lint0error/기존13warning. 별도 직접·음성6suite72 PASS는 전체 Unit에 포함되므로 합산하지 않는다. build는 실제 Next/standalone/runtime-tools까지 실행했다.
- **Pre-PR 종합 fast/targeted는 모두 BLOCKED**다. 자동 매핑 UNKNOWN0/missing0이며, 실제 source fingerprint guard가 Next의 `next-env.d.ts`/`tsconfig.json` 생성 변경과 E2E `output/playwright/**` 출력 변화를 감지해 `STALE`을 반환했다. 이를 PASS로 바꾸거나 도구/정책을 완화하지 않았다. 생성 설정과 역사적 tracked evidence를 원래 baseline으로 복원하고 새 raw 출력은 ignored 로컬 보고서로 보존한다. functional source9파일 SHA256은 최초 동결과 일치한다. 기존 tracked #623 cumulative/geometry 원본을 이번 실행의 새 증거라고 주장하지 않는다.

| #623 최종 body 계측 | 제한 ms | body ms | 남은 body 예산 ms | 80% 진단 경고 |
| --- | --- | --- | --- | --- |
| golden / UI·Excel snapshot | 60,000 | 25,212 | 34,788 | false |
| 여섯 mutation·원본 복귀 | 60,000 | 48,851 | 11,149 | true |
| 390px tree→matrix | 30,000 | 24,321 | 5,679 | true |
| 768px tree→matrix | 30,000 | 23,641 | 6,359 | false |
| 1024px tree→matrix | 30,000 | 26,255 | 3,745 | true |
| 1440px tree→matrix | 30,000 | 26,762 | 3,238 | true |
| 1920px tree→matrix | 30,000 | 26,232 | 3,768 | true |

다섯80% 경고가 실제 attachment에 나타났으며 숨기지 않았다. 일부30초 case 여유는3,238ms까지로 여전히 좁다. **PASS는 한 로컬 실행의 관측이고 독립 Runner·연속 Main 안정성은 NOT TESTED**다. 경고는 의미 검증/성공을 대신하지 않고, 같은 제한으로 새 PR CI를 반드시 수행한다. 별도 새 프로세스의 과거 경계/인접 오류13case 실행은 아래 후속 결과로 구별한다.

- 별도 fresh invocation은 **13/13 PASS,0 FAIL/0 SKIP/0 flaky/retries0/max-failures0**였다. 과거 경계7개(golden/여섯 mutation/Summary/#725 restart/KPI 원본 focus/사용자 override2개)와 새 인접 Editor 오류·권한6개(422/500/network/expired401/stale412/readonly)를 한 명령에 실행했다. 누적43개와 겹치는7개를 제외하면 전체 고유 Chromium은49case이며, 반복 실행 수를 고유 수로 합산하지 않는다. 두 번째 golden23.9s/여섯 mutation43.5s/restart51.2s PASS도 같은 로컬 host의 제한된 반복 관측이다.
- 최종 복원 뒤 tracked next-env/tsconfig·역사적 output diff0, functional9 SHA256 일치를 재확인했다. 새 정제 JSON만 증거로 추가하고 raw trace/session/환경 로그는 Git에 넣지 않는다. Markdown269파일 및 docs_gate의 AC1~6/DOCUMENTATION_SYNC **구조 검사 PASS**는 의미 QA·Owner 승인과 별도다.
- 독립 읽기 전용 `731_rework_qa`는 실제 raw JSON43case/최종source9hash와 원장/문서를 대조하고 P1/P2 잔여0을 확인했다. HIGH/OWNER_MANAGED의 사전 검토이며 Trusted QA·Owner 위험수용/Manager ACCEPT를 대신하지 않는다. 과거 PR #746/#748은 thread각1/resolved, #749 thread0으로 unresolved0을 재조회했고 main0aa1d3d7 유지. 새 PR의 exact Head/base/test merge·mergeability·리뷰0 및 Full CI 시작은 게시 직후 Issue/PR STATUS 댓글에서 불변 링크로 연결한다. 요청에 따라 CI 완료는 모니터링하지 않는다.
