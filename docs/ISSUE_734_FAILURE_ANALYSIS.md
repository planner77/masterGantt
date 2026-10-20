# Issue #734 — PR CI 누적 실패 원장

> 정규 원장: `docs/ISSUE_734_FAILURE_ANALYSIS.md`. [이슈 #734](https://github.com/planner77/masterGantt/issues/734) / [PR #759](https://github.com/planner77/masterGantt/pull/759). 기준은 [PR_CI_FAILURE_TRIAGE](PR_CI_FAILURE_TRIAGE.md) 및 `AGENTS.md`. 동일 이슈에서 향후 재실패하면 이전 절을 수정·삭제하지 않고 실행별 절을 누적한다.

## 1. F734-001 최초 Full PR CI 실패 (2026-10-20 UTC)

| 항목 | 증거 |
| --- | --- |
| Run | [#3058.1 / 39438998422](https://github.com/planner77/masterGantt/actions/runs/39438998422), `event=pull_request`, Attempt 1, FAILURE |
| Source | PR #759 Head `0786dde2a9fd96539250e91e482e85f4f557407f`, Base main `08a1d9ff25a97aba67f08d6b67029ac55d45121a`, 당시 PR API의 test-merge `a8a71c88e061f1b31b67b47fafee6a21650bd736` (부모 별도 감사 UNKNOWN) |
| 초기 검사 | QA preflight 118683762751, TS 118683918536, Lint 118683918545, Policy 118683918691, Vitest 118683918750, Fast Gate 118685478364 모두 SUCCESS |
| 실제 Heavy | PR Build 118685573523 SUCCESS, Docker smoke 118685573989 SUCCESS; [E2E shard1 118685573823](https://github.com/planner77/masterGantt/actions/runs/39438998422/job/118685573823) FAILURE, shard2~6 CANCELLED |
| Required3 | Quality 118686285539 SUCCESS, Docker 118686900226 SUCCESS, Chromium E2E 118689135769 FAILURE |
| QA Final | 118689188975 FAILURE: `required e2e 미성공` 파생 gate(독립 결함 아님) |
| 원본 | [Shard1 Playwright Report Artifact #12274915136](https://github.com/planner77/masterGantt/actions/runs/39438998422/artifacts/12274915136) — Trace 재생은 NOT TESTED |

**최초 실제 실패**: `tests/e2e/issue-734-equipment-dashboard.spec.ts:164-167`의 `#734 5폭 긴 이름·내부 overflow·열 정렬·native Tab/Escape`가 fixture 준비 `f.mutate(... equipment name ...,"patch")`에서 **HTTP400 INVALID_REQUEST**. 오류 `Equipment name must be non-empty and at most 200 characters.`; `expect(response.ok()).toBe(true)`의 실제 값 `false`. 시간 **2026-10-20T14:34:28Z**. 문자열 `"LongEquipmentNameWithoutWhitespace".repeat(8)`는 **272자**이고 계약 한도는 **200자**. Shard1 **11 PASS, 1 FAIL, 138 NOT RUN**. 다른 5 Shard는 fail-fast **CANCELLED**로 PASS/FAIL로 추정하지 않는다.

**분류 및 원인:** `TEST_FIXTURE / INPUT_CONTRACT`. 실제 제품이 유효하지 않은 설비명을 보호한 것이므로 API 검증을 약화하지 않는다. 별도의 `GitCommitInfo: timeout of 3000ms` 경고가 있지만 테스트 12개가 뒤이어 실행되었고 종료의 직접 원인은 HTTP400이다. E2E 본문 Timeout이 아니므로 Shard 재분배·Timeout/Retry 확대 없음.

## 2. R734-001/002 리뷰 결함 (최초 CI 실패와 별도)

- **R734-001 P2** [PR review](https://github.com/planner77/masterGantt/pull/759): `src/server/resources/wbs-dashboard-views-core.ts`의 `systemIds:[]` 상태에서는 type selector 교차 결과가 빈 집합으로 바로 결정되어 `equipmentTypeCodes:["unknown"]` 검증을 우회. ledger 원본에 존재하는 설비 종류를 교차 조합 전에 독립 확인해 `INVALID_SELECTION` 반환. 반례: 같은 `systemIds:[]`와 정상 `amr` 타입은 200/빈 행. 전용 서버 Unit 보강.
- **R734-002 P2** [PR review](https://github.com/planner77/masterGantt/pull/759): 두 설비 유형의 `code`만 다르고 표시명이 같으면 체크박스의 visible/accessible label이 동일. `equipmentPresentation`에서 중복 이름에만 `이름 (코드)`를 만들고 실제 input을 감싼 HTML label에 표시. 동일 이름·서로 다른 코드의 고유 라벨 및 비중복 이름 우선 회귀 추가. UI 전체에 코드를 강제 표시하지 않는다.

## 3. 누적 실행 매트릭스 및 재발 방지

| Run/Attempt | 첫 오류/실패 파일 | 원인 및 보완 | 보완 HEAD 결과 |
| --- | --- | --- | --- |
| `39438998422.1`, `0786dde2` | `tests/e2e/issue-734-equipment-dashboard.spec.ts`: 다섯 폭 E2E의 272자 Fixture | TEST_FIXTURE: **정확히 200자** 이름으로 교체, 기존 390/768/1024/1440/1920 폭·6열/overflow/Tab/Escape·쓰기0/Gantt/Milestone oracle 유지 | 신규 Required3/E2E6 **NOT TESTED** |

**누적 실제 실패 테스트 파일 합집합:** `tests/e2e/issue-734-equipment-dashboard.spec.ts` 한 파일의 한 테스트. 현재 확인 가능한 #734 전체 PR CI는 위 한 Run/Attempt, 해당 Run의 나머지 Shard는 취소. 다른 이슈의 #623/#730/#733 긴 테스트 Timeout과 혼동하거나 본 이슈의 실제 실패로 합산하지 않는다.

관련 범위: 서버 projection·이슈734 SQLite/HTTP 수용, Equipment 모델/checkbox, 이슈734 E2E, 인접 #730 composer/#735 system consumer와 이전 #624 KPI. 원인별 교정 후 기존 테스트·보안·권한·원본 동일성·고유 공수 등 모든 AC 불변. `docs/exec-plans/active/ISSUE_734.md`에 이력·DOC_SYNC와 선택된 회귀를 기록했다. 신규 source를 직접 checkout/npm/Playwright/Docker 실행하지 못했으므로 **로컬 NOT TESTED**. 최초 source의 Quality/Docker 성공과 과거155개 Unit PASS는 새 Head PASS 주장이 아니다.

이 원장은 대응 지식의 Source of Truth이며 원본 Run을 성공으로 바꾸지 않는다. 단일 수정 commit과 PR `synchronize`로 새 Full CI 시작 후 해당 Head/Run/Attempt를 여기에 계속 누적한다. 실패 해결 전까지 Owner HIGH 위험 수용, Trusted QA, main/GHCR, Issue 종료는 별도 gate. `release_authorized=false`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`.
