# Issue #726 — 누적 PR CI 실패 원장

> Source of Truth: [PR CI 실패 누적 분석 지침](PR_CI_FAILURE_TRIAGE.md). Primary Issue [#726](https://github.com/planner77/masterGantt/issues/726), 구현 PR [#743](https://github.com/planner77/masterGantt/pull/743). 2026-10-19 현재 F-001~F-003 원격 실패 3건을 기록. 기존 원본 실패는 성공으로 재분류하거나 삭제하지 않는다.

## 1. 원격 실행/Attempt 전체 목록

| ID | GitHub Run / event | Head / Base / Test-merge(관측) | Required3 및 하위 Job | 원본 증거 |
| --- | --- | --- | --- | --- |
| F-001 | [#2982.1](https://github.com/planner77/masterGantt/actions/runs/39166340575), `pull_request.opened`, `CI`, 2026-10-18 UTC | Head `0035c48f6e107ec24647bb84d40081b0f9a4a348` / Base `6f6dadb1b3ac10bc837c09273a0922611b2e3f81` / PR metadata `merge_commit_sha=9885c30ed5e46ae5f70ba8bca2104d68d7b45714` (Run에서 독립 교차검증하지 않음) | Quality **SUCCESS** (job `117790677086`); Docker **SUCCESS** (`117790786498`); Chromium E2E **FAILURE** (`117791324057`); QA Final Automated **FAILURE** (`117791341838`, 파생) | [Shard 4 / job 117790363382](https://github.com/planner77/masterGantt/actions/runs/39166340575/job/117790363382), [Playwright report artifact](https://github.com/planner77/masterGantt/actions/runs/39166340575/artifacts/12150668332) |
| F-002 | [#2985.1](https://github.com/planner77/masterGantt/actions/runs/39169140616), `pull_request.synchronize`, `CI`, 2026-10-18 21:44Z | Head `31973c8aefd462ea0e3cf142b829a67252093a95` / Base `6f6dadb1b3ac10bc837c09273a0922611b2e3f81` / Test-merge SHA **UNKNOWN** (현재 PR은 diverged/mergeable=false) | Quality **SUCCESS** (`117799136681`), Docker **SUCCESS** (`117799354160`), Chromium E2E **FAILURE** (`117800756907`); Shard5 **FAILURE** (`117798833705`); QA Final Automated **FAILURE** (`117800776742`, 파생) | [Shard5 original log](https://github.com/planner77/masterGantt/actions/runs/39169140616/job/117798833705), [Playwright report artifact](https://github.com/planner77/masterGantt/actions/runs/39169140616/artifacts/12151294313) |
| F-003 | [#2987.1](https://github.com/planner77/masterGantt/actions/runs/39172673374), `pull_request.synchronize`, `CI`, 2026-10-18 22:32Z | Head `f00755046eb8c80bb3a0eb4187c0bdd84aa00945` / Base `0209c72f8a0702415f2e00b63c895549a65dbe81` / original Run test-merge **UNKNOWN** | Quality **SUCCESS** (`117809526614`), Docker **SUCCESS** (`117809776026`), Chromium E2E **FAILURE** (`117810406514`); Shard4 **FAILURE** (`117809255536`); QA Final **FAILURE** (`117810423023`, 파생) | [Shard4 original job](https://github.com/planner77/masterGantt/actions/runs/39172673374/job/117809255536), [Playwright report artifact](https://github.com/planner77/masterGantt/actions/runs/39172673374/artifacts/12152763184) |

### Shard 완료/실패/취소 구분

- Shard 4: 실제 테스트 **6 PASS, 1 FAIL**, 같은 shard의 149 tests **NOT RUN**; PR `--max-failures=1` 조기 종료.
- Shard 1/2/3/5/6: **CANCELLED** (PR matrix fail-fast); 이들 테스트를 PASS 또는 0개 실패로 계산하지 않는다.
- QA Final Automated 실패는 Required E2E `failure`에 따른 **파생 판정**이다. 정책/QA 자체의 독립 결함이라고 보지 않는다.
- `GitCommitInfo: timeout of 3000ms exceeded while running git fetch origin ...` 경고가 있었으나 테스트는 계속 진행되었으므로 최초 실제 FAIL의 원인으로 확정하지 않는다.

## 2. 누적 실패 파일·교차 분석

| 실패 ID / 경계 | 최초 원본 메시지와 위치 | 제품·테스트·환경 분류 | 보완 후보 및 잔여 위험 |
| --- | --- | --- | --- |
| F-001 — `tests/e2e/issue-726-task-logistics.spec.ts` / `#726 Task 공정 0..N·WorkArea self/subtree ...` | 343행의 `processLinks` 배열 deep equality: 실제 2개 UUID는 기대 2개와 **정확히 동일한 값·scope**이나 배열 순서만 반대 | **TEST_CONTRACT**. Fixture `createTargetProject`는 A→B 생성 순으로 UUID를 쌓지만 DB canonical reader `src/server/repositories/process-context-repository-core.ts`는 `ORDER BY p.public_id`로 읽음. 생성 순서가 UUID 정렬 순서일 보장은 없음. 저장 내용 유실·잘못된 scope 증거는 없음 | 기대/실제 쌍의 `processId`를 정렬한 뒤 객체 전체에 대해 exact deep equality. **중복/누락/scope 변화는 계속 실패**. Remote Chromium 전체/취소 shard의 잠재 다른 실패는 NOT TESTED. |

- Cross-run 현황: #726에 연결된 PR #743의 조회 가능한 `pull_request` Full 실행은 #2982.1 한 건. 최초 실패 전후 추가 원격 재실패 없음. 본 문서는 다음 실패 때 F-002를 추가해 전 이력을 보존한다.
- 실패 파일 합집합: `tests/e2e/issue-726-task-logistics.spec.ts` 1개. 추가 영향 소비자: `tests/e2e/logistics-target-authoring.spec.ts`, `tests/e2e/issue-726-logistics-master.spec.ts`, `tests/e2e/project-logistics-management.spec.ts`, `tests/e2e/project-task-editor.spec.ts`, #725 process-context 회귀. 이들 원격 실행은 shard 취소/미실행 가능성 때문에 모두 PASS라고 표시하지 않는다.

## 3. F-001 원인 분석·REWORK 및 반례

- [원본 로그](https://github.com/planner77/masterGantt/actions/runs/39166340575/job/117790363382)의 expected IDs: `ff70044c...`, `796ba350...`; actual IDs는 그 반대 순서다. 양쪽 `scope: self`, 두 행 존재; 원인 `TEST_CONTRACT`는 테스트가 저장소의 정렬 계약 대신 Fixture 생성 순서를 의존한다는 것.
- **수정:** `tests/e2e/issue-726-task-logistics.spec.ts`에서 direct processLinks는 순서 없는 관계 집합임을 명시하고 비교 대상의 복사본과 expected를 모두 `processId.localeCompare`로 정렬해 exact object equality를 수행. 원본 서버/공정 서비스, API, DB 정렬, CI fail-fast/timeout/retry/Assertion 수는 변경하지 않음.
- 반례: 별도의 Node v22.16.0 순수 비교 검사에서 ID 역순은 PASS, 중복 또는 다른 scope는 FAIL(정규화 비교에 대한 smoke만 확인). Playwright 앱/HTTP/SQLite의 실제 동작을 실행했다는 의미는 **아님**.
- 원격 실행 전 영향 검증: TypeScript/Playwright 직접 실행 **NOT TESTED**. 현재 실행 환경에는 Repository checkout·dependency·GitHub 네트워크가 없어 E2E 재현을 수행하지 못했다. 기존 #726 Work Packet의 11개 로컬 Chromium PASS는 **이전 코드/환경** 증거이지 새 Head의 CI PASS가 아니다.

## 4. 인계·다음 PR CI

- 저장소 원장과 Work Packet을 같은 PR 변경 묶음에 기록한다. `main` 정렬: 관측 `behind_by=0`, `base_sha=6f6dad...`; PR GitHub `mergeable=true`; Review threads **0**. PR 병합·GHCR·릴리스·이슈 종료는 이번 요청 범위 밖.
- 수정 후 새로운 `synchronize` Full PR CI를 시작하며 Required Quality/E2E/Docker와 Trusted QA, Owner ACCEPT는 새 Head에서 **NOT TESTED**이다. 사용자 지침대로 결과 완료 모니터링을 수행하지 않는다.
- 담당: Test contract 보완=구현 담당, Run/Shard/원장 원본 감사=Manager/infra, 실제 원격 판정 및 HIGH 잔여 위험 수용=후속 Owner.

## 5. F-002 — #2985.1 Chromium Shard5 상위 Dashboard 포커스 실패 및 누적 원인 재평가 (2026-10-19)

### 원본 실행 증거 (기존 F-001과 별도 사건)

- Primary Issue [#726](https://github.com/planner77/masterGantt/issues/726), PR [#743](https://github.com/planner77/masterGantt/pull/743), branch `feat/issue-726-logistics-master`. [Run #2985.1](https://github.com/planner77/masterGantt/actions/runs/39169140616): Run ID `39169140616`, attempt `1`, event `pull_request.synchronize`, head `31973c8aefd462ea0e3cf142b829a67252093a95`, base `6f6dadb1b3ac10bc837c09273a0922611b2e3f81`.
- Required Quality **SUCCESS** (`117799136681`), Docker **SUCCESS** (`117799354160`). E2E Shard5 `117798833705`: **50 PASS / 1 FAIL / 33 NOT RUN**. Shard1/2/3/4/6 **CANCELLED**(해당 Shard4의 일부 테스트 15 PASS는 개별 실제 관측, Shard 전체 PASS 아님). E2E aggregate `117800756907` FAILURE. QA Final Automated `117800776742`의 NEED_E2E=failure는 **파생 실패**.
- **첫 실제 실패:** `tests/e2e/project-workspace-tabs-518.spec.ts:79`, `#518 일정·Milestone 상위 탭, dialog origin, Gantt 측정/상태와 5폭 tab geometry`. `schedule.focus()`→`ArrowRight` 이후 Dashboard tab은 `aria-selected=true`, `tabindex=0`이지만 `expect(dashboardTab).toBeFocused()`가 5초 뒤 `Received: inactive`로 실패. 초기 공정/관리 GET의 401/404는 별도 expected/fixture 경계일 수 있어 이 포커스 실패의 직접 원인으로 확정하지 않는다. 원본 [Shard5 Job/Trace](https://github.com/planner77/masterGantt/actions/runs/39169140616/job/117798833705).
- 기존 F-001의 `issue-726-task-logistics.spec.ts:343` UUID 순서 계약은 이번 Shard4에서 실제 **PASS**(`...:229` 단일 테스트 완료, 33.7s)로 관측. 이 사실은 F-001 원격 당시의 원본 FAIL을 변경하지 않으며 나머지 취소/미실행 테스트의 성공을 뜻하지 않는다.

### 과거 전체 이력 교차 분석 (F-001 + F-002 + 선행 #717)

| 실패 | 과거/이번 파일·계약 | 증거·종합 분류 | 이번 수정/잔여 확인 |
| --- | --- | --- | --- |
| F-001 (#2982.1) | `issue-726-task-logistics.spec.ts:343`, 직접 공정 집합 UUID 정렬 | TEST_CONTRACT, id/scope 동일·순서만 다름. #2985 Shard4에서는 해당 case PASS | 정렬 기반 정확 객체 비교 보존; main 병합 후 다시 Full CI 필요 |
| F-002 (#2985.1) | `project-workspace-tabs-518.spec.ts:79`, 상위 Tab keyboard focus·이전 Milestone 화면 유지 | **PRODUCT/NAVIGATION_FOCUS**(기존 base의 focus 지연 경쟁); 선행 #717 원장의 [F-012/CI #2968.1](https://github.com/planner77/masterGantt/actions/runs/39122204893)와 **동일 테스트/관측 증상**. #717의 원본 trace에서는 stale Dashboard subview 복원까지 실증되어 보완되었음. 이번 #2985 trace를 별도 재생하지 않았으므로 내부 microtask·화면복원 동시 발생은 **미확정** | 최신 main #717의 `project-readonly-view.tsx` 수정(상위 탭 동기 focus, 재선택 시 activeScreen 보존, rAF에서 최신 사용자 행동 보호)과 5폭 focus 관측 E2E를 #726의 2-parent merge로 통합. 즉시 원본 테스트 삭제/포커스 assertion 약화/timeout 증가 없음 |

- **왜 재발했는가:** #726의 base/head는 #717 F-012 포커스 보완이 반영되기 전 main `6f6dad...`에서 분기했다. 이후 main이 [#717 merge `0209c72...`](https://github.com/planner77/masterGantt/commit/0209c72f8a0702415f2e00b63c895549a65dbe81)로 전진하면서 #726은 **main보다 23커밋 뒤처지고 GitHub `mergeable=false`**. 이번 원본 CI가 검증한 Head에는 #717 최신 focus fix가 없었다. 동일 장애가 재노출된 것과 #726의 새 공정 데이터 결함은 구분한다.
- **추가 호환 위험/선제 보완:** #717 이름 우선·ID 선택적 표시의 `logisticsName`, `IdentifierDetails`, Task/Target locator 수정과 #726 관리/직접 편집의 충돌을 통합. #726 Target 호환 UI spec은 코드 괄호형 old locator 대신 main의 canonical 이름 우선 selector를 사용하고 실제 whole/subset/coverage assertion은 보존한다. 새 Task 직접 설비/System 목록은 이름-first/동명만 코드 보조, 원본 코드/ID를 인접 disclosure에서 조회·복사하도록 조정; 기존 self/subtree/readonly/원본 ID 저장 경로는 바꾸지 않는다. 이를 정확 코드·ID E2E 확인 항목에 추가한다.
- **기타 메인 통합:** main 0.120.1과 PR 0.121.0의 manifest/lock root는 **0.121.0**으로 통일. #717/ #726 CHANGELOG와 문서의 별개 항목을 모두 보존한다. #717 logistics name-first 변경과 #726 CRUD/dirty/system 범위 변경을 조합하고 공통 테스트 소비자의 locator를 최신 UI에 정렬한다. main #728 WBS·#727 등록 계약과 #724 navigation도 유지한다.

### 동일 후보 source 검증과 다음 실행 경계

- 통합 전 GitHub 비교: main `0209c72f8a0702415f2e00b63c895549a65dbe81`, PR Head `31973c8aefd462ea0e3cf142b829a67252093a95`, merge base `6f6dadb1b3ac10bc837c09273a0922611b2e3f81`, 뒤처짐23·앞섬2. 겹치는 14개 파일 중 3-way base→main / base→PR 통합의 각 원본 patch를 파일 전체와 재구성 대조해 **일치**시킴. 겹친 상단 삽입/버전/동명 선택자를 수동 충돌 해소; main Tree로부터 2-parent merge 생성하며 상대 branch 원본을 force-push하지 않음.
- Source-level 검증: 모든 기존 소스 파일의 각 base/main/PR patch 복원 동등성, 하위 경로별 blob 보존, 0.121.0 manifest/lock, 실제 포커스 수정·관련 테스트 유지, canonical key/저장 Writer 불변. **시스템 local checkout·npm/node_modules·Chromium 실행 경로가 없어 새 2-parent source의 TypeScript/Playwright E2E는 NOT TESTED**. 외부 연결 자료/API 판단과 실제 실행 PASS를 혼동하지 않는다.
- 누적 직접 실패 파일 합집합: `tests/e2e/issue-726-task-logistics.spec.ts`, `tests/e2e/project-workspace-tabs-518.spec.ts` (2개). 확대 소비자: Target whole/subset `tests/e2e/logistics-target-authoring.spec.ts`, management `tests/e2e/issue-726-logistics-master.spec.ts` 및 `project-logistics-management.spec.ts`, #717 name-first 관련 `tests/e2e/issue-621-resource-target.spec.ts`·`issue-623-resource-mvp.spec.ts`, Task editor `tests/e2e/project-task-editor.spec.ts`, #725 process-context/WorkArea, #724 navigation, readonly/dirty/권한·동일 Gantt Core. 원격 전체6-shard는 다음 Full CI에서 검사한다.
- 리뷰: PR #743 기존 미해결 thread=0. 충돌은 위 2-parent main 정렬과 통합으로 해소하며 최신 PR `mergeable`, `behind_by=0`, exact latest head 검증 뒤에만 신규 `pull_request.synchronize` Full CI를 시작한다. 새 Run 시작 전 Required3/Trusted QA/Owner ACCEPT는 **NOT TESTED**. CI 정책/필수 Job/timeout/retry/skip을 변경하지 않음.
- 완료/릴리스: 이번 사용자 범위는 새 CI 시작까지이며 결과 모니터링, PR 병합, Main CI/GHCR/정식 Release/Issue close는 하지 않는다. HIGH·OWNER_MANAGED 및 `release_authorized=false` 유지.

## 6. F-003 — #2987.1 Target 이름 우선 접근성 selector의 잔여 E2E 계약 오류 (2026-10-19)

### 6.1 원격 Run/Job/Shard 및 첫 실패

- Primary Issue #726 / PR #743 / CI `pull_request.synchronize`: [Run #2987.1](https://github.com/planner77/masterGantt/actions/runs/39172673374), ID `39172673374`, attempt `1`, Head `f00755046eb8c80bb3a0eb4187c0bdd84aa00945`, Base `0209c72f8a0702415f2e00b63c895549a65dbe81`. 원본 exact test-merge SHA는 재검증 가능한 증거 부재로 **UNKNOWN**이며 현재 PR merge SHA로 추정하지 않는다.
- Quality aggregate `117809526614` SUCCESS, Docker aggregate `117809776026` SUCCESS. Preflight, lint, typecheck, unit, PR Build, Docker smoke 성공. E2E aggregate `117810406514` FAILURE; QA Final Automated `117810423023` FAILURE는 E2E 실패의 파생 차단이지 별도 제품 테스트 실패 증거가 아니다.
- Chromium Shard4 job [`117809255536`](https://github.com/planner77/masterGantt/actions/runs/39172673374/job/117809255536): **10 PASS / 1 FAIL / 147 NOT RUN** (`--max-failures=1`). Shard1/2/3/5/6은 matrix fail-fast로 **CANCELLED**; 취소되기 전 로그에서 각각 일부 성공이 관측되더라도 전체 Shard 성공으로 집계하지 않는다. [원본 Playwright report](https://github.com/planner77/masterGantt/actions/runs/39172673374/artifacts/12152763184) 존재.
- 최초 실제 FAIL: `tests/e2e/logistics-target-authoring.spec.ts:322`의 `Summary subtree 영향·상속/legacy 출처·pending·401 초안 보호` 시나리오. Target 호환 `details`를 pending 동안 닫고 다시 연 후 `getByLabel("상속 대상 (INHERITED)", {exact:true})`에서 `toBeChecked()` 시 **element(s) not found** (5초). 바로 앞의 선택·subtree·저장/재편집 API 흐름은 이 실패 지점까지 진행되었다.
- `GitCommitInfo: timeout of 3000ms exceeded while running git fetch origin ...`는 보조 경고이며 Chromium 테스트는 계속 진행했다. 이 경고를 F-003 원인으로 확정하지 않는다.

### 6.2 전체 실패 원장의 Cross-run 매트릭스 (F-001~F-003)

| 실패 / 최초 원본 파일 | 이전 보완과 이번 실행의 관계 | 원인 유형 / 보완 및 잔여 위험 |
| --- | --- | --- |
| F-001 #2982.1 / `issue-726-task-logistics.spec.ts:343` | `processLinks` UUID 2개·scope 동일, 순서만 다름. F-001 교정 후 #2985 및 #2987의 동일 공정 시나리오 개별 PASS | `TEST_CONTRACT`; 양쪽 정렬 후 객체 exact 비교 유지. 나머지 취소된 Shard의 성공을 보장하지 않음 |
| F-002 #2985.1 / `project-workspace-tabs-518.spec.ts:79` | Dashboard selected-but-unfocused. #717 원장 F-012 동일 증상 교정을 #726의 main merge로 반영; #2987 Shard5 CANCELLED로 전체 case PASS는 **NOT TESTED** | `PRODUCT/NAVIGATION_FOCUS` 기존 base 누락. 동기 focus/활성 subview·5폭·키보드·URL/E2E assertion 계속 보존 |
| F-003 #2987.1 / `logistics-target-authoring.spec.ts:322` | #717 이름 우선 UI 통합 후 하나의 pending/호환 disclosure 검사만 옛 `이름 (코드)` selector 사용 | `TEST_CONTRACT`; 이름 유일 Target에 대한 `getByRole("checkbox",{name:"상속 대상",exact:true})`와 `toHaveCount(1)`·`toBeChecked()` 사용. 실제 저장·초안 소실의 관측 증거 없음 |

### 6.3 인과·보완 / 같은 Source 검증 계약

- `src/features/gantt/task-target-binding-editor.tsx`의 실제 accessible `<label>`은 Target 이름을 기본으로 쓰며 동일 이름의 다른 Target이 존재할 때만 ` (${target.code})`를 보조 표시한다. 현재 fixture는 이름 `상속 대상`을 하나만 생성한다. `INHERITED`는 canonical code로 검색/저장은 보존하지만, 이 경우 checkbox의 accessible name이 아니다. 따라서 제품 변경/Assertion 완화 대신 **테스트의 구형 selector만 교정**한다.
- 같은 `logistics-target-authoring.spec.ts`에서 Target의 최초 체크/해제, child Task 편집, 401 뒤 초안 유지 검사는 이미 `getByRole("checkbox", {name:"상속 대상",exact:true})`를 사용한다. 파일 내 과거 고정 `getByLabel("상속 대상 (INHERITED)")` 발생 지점은 한 곳뿐임을 재검토. 교정 후 구형 selector 0개, 고유 checkbox `toHaveCount(1)`, pending 중 checked, 401 이후 checked와 쓰기 1회·canonical 미변경, dirty/Escape·whole/subset/coverage 검증은 그대로 유지.
- 과거 실패 파일 합집합: `tests/e2e/issue-726-task-logistics.spec.ts`, `tests/e2e/project-workspace-tabs-518.spec.ts`, **`tests/e2e/logistics-target-authoring.spec.ts`**. 인접 소비자는 신규 `tests/e2e/issue-726-logistics-master.spec.ts`, `tests/e2e/project-logistics-management.spec.ts`, 이름우선 `issue-621-resource-target`·`issue-623-resource-mvp`, `project-task-editor`, #725 WorkArea, #724 Workspace, #717 원본 ID·readonly/dirty, Task/Gantt/HTTP·SQLite/권한; 전체 6-shard 원격 실행을 다음 Head에 요청하며 미실행 범위는 PASS로 승격하지 않는다.
- 소스 검토: GitHub 파일/CI 원본과 접근성 label 근거, 신/구 선택자 비교 완료. Node 22는 있지만 현재 컨테이너 `git ls-remote https://github.com/planner77/masterGantt.git`가 DNS resolve 실패해 Git checkout/npm·Playwright 전체 실행 불가; **동일 수정 Source의 로컬 Chromium/HTTP/SQLite/typecheck는 NOT TESTED**. 원격 CI 이전 Head의 PASS 결과도 새 Head의 검증을 대체하지 않는다.
- 변경: `tests/e2e/logistics-target-authoring.spec.ts`, 이슈 전용 원장, `docs/exec-plans/active/ISSUE_726.md`. 제품/UI/API/DB/Gantt writer, package/lock 버전0.121.0, workflow/Required3·timeout/skip/retry/QA/보안 정책은 변경 없음. Main strict 정렬, unresolved review 0, mergeable, 정확 Head/Run 식별 뒤 새 `pull_request.synchronize` Full CI 시작.
- 릴리스: HIGH / OWNER_MANAGED / release_required=true / release_authorized=false 유지. 새 CI 성공/Trusted QA/Owner ACCEPT는 **NOT TESTED**, MERGE_READY=BLOCKED. 사용자 지시에 따라 결과 모니터링/병합/Main/GHCR/정식 Release/이슈 종료는 진행하지 않음.

