# Issue #726 — 누적 PR CI 실패 원장

> **최신 정정 요약 — 2026-10-19 / F-004 재작업:** 완료된 Full Run4개와 모든24 Shard 원문을 대조했다. 실제 실패는5회·고유4 case·4파일이다. F-002의 `CANCELLED` Shard2에도 #719 actual FAIL이 있었으며 F-004는 같은 PRODUCT 회귀의 재발이다. 아래 F-001~F-003의 원본 관측·당시 가설/UNKNOWN/검증 한계는 역사적 기록으로 보존한다. 현재 합집합·정정·새 출처·수정 검증은 §7을 우선한다. 로컬/원격 PASS를 서로 대체하지 않는다.

> Source of Truth: [PR CI 실패 누적 분석 지침](PR_CI_FAILURE_TRIAGE.md). Primary Issue [#726](https://github.com/planner77/masterGantt/issues/726), 구현 PR [#743](https://github.com/planner77/masterGantt/pull/743). 2026-10-19 현재 F-001~F-003 원격 실패 3건을 기록. 기존 원본 실패는 성공으로 재분류하거나 삭제하지 않는다.

## 1. 원격 실행/Attempt 전체 목록

| ID | GitHub Run / event | Head / Base / Test-merge(관측) | Required3 및 하위 Job | 원본 증거 |
| --- | --- | --- | --- | --- |
| F-001 | [#2982.1](https://github.com/planner77/masterGantt/actions/runs/39166340575), `pull_request.opened`, `CI`, 2026-10-18 UTC | Head `0035c48f6e107ec24647bb84d40081b0f9a4a348` / Base `6f6dadb1b3ac10bc837c09273a0922611b2e3f81` / PR metadata `merge_commit_sha=9885c30ed5e46ae5f70ba8bca2104d68d7b45714` (Run에서 독립 교차검증하지 않음) | Quality **SUCCESS** (job `117790677086`); Docker **SUCCESS** (`117790786498`); Chromium E2E **FAILURE** (`117791324057`); QA Final Automated **FAILURE** (`117791341838`, 파생) | [Shard 4 / job 117790363382](https://github.com/planner77/masterGantt/actions/runs/39166340575/job/117790363382), [Playwright report artifact](https://github.com/planner77/masterGantt/actions/runs/39166340575/artifacts/12150668332) |
| F-002 | [#2985.1](https://github.com/planner77/masterGantt/actions/runs/39169140616), `pull_request.synchronize`, `CI`, 2026-10-18 21:44Z | Head `31973c8aefd462ea0e3cf142b829a67252093a95` / Base `6f6dadb1b3ac10bc837c09273a0922611b2e3f81` / Test-merge SHA **UNKNOWN** (현재 PR은 diverged/mergeable=false) | Quality **SUCCESS** (`117799136681`), Docker **SUCCESS** (`117799354160`), Chromium E2E **FAILURE** (`117800756907`); Shard5 **FAILURE** (`117798833705`); QA Final Automated **FAILURE** (`117800776742`, 파생) | [Shard5 original log](https://github.com/planner77/masterGantt/actions/runs/39169140616/job/117798833705), [Playwright report artifact](https://github.com/planner77/masterGantt/actions/runs/39169140616/artifacts/12151294313) |
| F-003 | [#2987.1](https://github.com/planner77/masterGantt/actions/runs/39172673374), `pull_request.synchronize`, `CI`, 2026-10-18 22:32Z | Head `f00755046eb8c80bb3a0eb4187c0bdd84aa00945` / Base `0209c72f8a0702415f2e00b63c895549a65dbe81` / original Run test-merge **UNKNOWN** | Quality **SUCCESS** (`117809526614`), Docker **SUCCESS** (`117809776026`), Chromium E2E **FAILURE** (`117810406514`); Shard4 **FAILURE** (`117809255536`); QA Final **FAILURE** (`117810423023`, 파생) | [Shard4 original job](https://github.com/planner77/masterGantt/actions/runs/39172673374/job/117809255536), [Playwright report artifact](https://github.com/planner77/masterGantt/actions/runs/39172673374/artifacts/12152763184) |
| F-004 | [#2988.1](https://github.com/planner77/masterGantt/actions/runs/39174916249), `pull_request.synchronize`, `CI`, 2026-10-18 UTC | Head `1120722a4f6fa4cf8dd9976e9af1472786b08d88` / Base `0209c72f8a0702415f2e00b63c895549a65dbe81` / Test-merge `b844977696fa807255200622f548d5549dd32482` (추가 확보 출처는 §7) | Quality SUCCESS (`117816142658`), Docker SUCCESS (`117816387498`), E2E FAILURE (`117817798349`), QA Final FAILURE (`117817819838`, required E2E 파생); Shard2 FAILURE (`117815890304`), 나머지5 CANCELLED | [Shard2 원본](https://github.com/planner77/masterGantt/actions/runs/39174916249/job/117815890304), [정제24-shard 감사](evidence/issue726/ci-cumulative-20261019.json) |

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


## 7. F-004 및 과거 누락 백필 — 전체 이력 재감사 (2026-10-19)

### 7.1 수집 범위와 이전 판정 정정

[정제 원본 감사 JSON](evidence/issue726/ci-cumulative-20261019.json)은 기존4개 Full Run의24 Shard 로그, Required aggregates, QA 로그, 원본 출처 artifact를 보존한다. Reviewer/Manager는 누적 JSON과 소스·기존 원장을 대조한다. 원본 artifact는 비신뢰 PR 자료이며 ZIP의 JSON만 읽었고 실행하지 않았다. API run/head/repository 및 실제 checkout SHA·merge 로그와 교차 관측했으나 protected main Trusted QA·commit→PR 단일 귀속·Owner ACCEPT 성공을 뜻하지 않는다. Connector 첫 페이지/과거 attempt API 한계는 JSON에 명시한다.

- **F-002-B 누락 actual FAIL:** Run #2985.1 `39169140616`, attempt1, Head `31973c8aefd462ea0e3cf142b829a67252093a95`, Base `6f6dadb1b3ac10bc837c09273a0922611b2e3f81`. Shard2 job [`117798833747`](https://github.com/planner77/masterGantt/actions/runs/39169140616/job/117798833747)의 최종 결론은 CANCELLED지만 E2E step FAILURE와 Playwright report 업로드 SUCCESS다. 2026-10-18T21:54:41Z에 `issue-719-contextual-help.spec.ts:113/120`에서 `+ 설비 추가`가 disabled여서30초 click timeout: **41 PASS / 1 FAIL / 88 NOT RUN**. [당시 report artifact](https://github.com/planner77/masterGantt/actions/runs/39169140616/artifacts/12152201999). 기존 F-002를 navigation focus 한 건으로만 수집한 것은 불완전했다. 이 기록은 당시 모든 취소 shard에 실패가 없었다는 뜻으로 해석하지 않는다.
- **F-002 QA 정정:** job117800776742의 첫 `decision_reason`은 `mergeability 또는 test merge 불일치`, 자동 판정 BLOCKED이며 GitHub Job 결론은 FAILURE다. E2E 실패도 사실이지만 QA의 원문 사유를 E2E 파생 하나로 단정했던 과거 설명을 정정한다. F-001/F-003/F-004 QA 원문은 실제 `required e2e 미성공`이다.
- **F-004:** [Run #2988.1](https://github.com/planner77/masterGantt/actions/runs/39174916249), ID39174916249/attempt1/Head1120722a4f6fa4cf8dd9976e9af1472786b08d88/Base0209c72f8a0702415f2e00b63c895549a65dbe81. Shard2 job117815890304에서 같은 #719 case113·click120이30초 timeout, **41 PASS / 1 FAIL / 88 NOT RUN**. Quality117816142658·Docker117816387498 SUCCESS, E2E117817798349 FAILURE, QA117817819838는 required E2E 파생 FAILURE. Shard1/3/4/5/6 CANCELLED며 원문에서 별도 actual FAIL은 관측하지 않았다. CANCELLED는 PASS가 아니다.
- `1 error was not a part of any test`는 pinned Playwright가 maxFailures 도달 시 `reporter.onError(Testing stopped early...)`를 생성한 요약이다. 실제 runner source 위치/메시지는 감사 JSON에 기록했다. 별도의 제품 오류 stack 증거가 없으므로 실패 case를 하나 더 만들거나 환경 원인으로 확정하지 않는다. `GitCommitInfo git fetch timeout`도 실제 case가 계속 진행됐으므로 원인으로 확정하지 않는다.

### 7.2 역사적 UNKNOWN 출처 추가 확보

아래는2026-10-19 추가 확보 결과이며 §1~6의 당시 UNKNOWN/미확인 기록을 소급 삭제하지 않는다. source artifact JSON의 run/attempt/repository/PR743/head/base와 실제 checkout 관측이 일치한다. 각 archive/digest·필드 상세는 감사 JSON에 보존한다.

| 실패 / source artifact ID | Head / Base | test merge SHA 추가 관측 |
| --- | --- | --- |
| F-001 / 12150681576 | 0035c48f6e107ec24647bb84d40081b0f9a4a348 / 6f6dadb1b3ac10bc837c09273a0922611b2e3f81 | 9885c30ed5e46ae5f70ba8bca2104d68d7b45714 |
| F-002 / 12152380087 | 31973c8aefd462ea0e3cf142b829a67252093a95 / 6f6dadb1b3ac10bc837c09273a0922611b2e3f81 | c2710a28b930310ee7b20450efd882365f32dff7 |
| F-003 / 12153167119 | f00755046eb8c80bb3a0eb4187c0bdd84aa00945 / 0209c72f8a0702415f2e00b63c895549a65dbe81 | 0d8f33d9cbf07d32b15109acf844c008f10fe2e2 |
| F-004 / 12153698676 | 1120722a4f6fa4cf8dd9976e9af1472786b08d88 / 0209c72f8a0702415f2e00b63c895549a65dbe81 | b844977696fa807255200622f548d5549dd32482 |

### 7.3 전체 이력 Cross-run 원인 재평가와 현재 실패 합집합

| 사건 / 원본 오류 | 원인·이전 교정 | 재발/반례·최종 후보 검증 |
| --- | --- | --- |
| F-001 / Task 직접 공정 집합 순서 | TEST_CONTRACT: UUID 생성 순서와 canonical 정렬 혼동. 양쪽 정렬 후 객체 exact equality | 교정 보존. #2985/#2987 개별 PASS는 해당 source 증거; 새 후보에서 파일 전체 재검증 |
| F-002-A / #518 Dashboard focus | PRODUCT/NAVIGATION_FOCUS: main #717 보완 누락. main0209c72f 2-parent 정렬 | 원래 focus·active subview·5폭·Gantt assertions 보존, 새 후보에서 파일 전체 재검증 |
| F-002-B (숨은 cancelled Shard2) / #719 공정0 disabled | PRODUCT: 기존 경고 handler 도달 불가. 이전 수집에서 누락되어 원인 교정이 빠짐 | F-004와 동일 관측/동일 source 조건. 이번 재작업의 직접 수정 대상 |
| F-003 / Target 이름우선 selector | TEST_CONTRACT: 이름유일시 code 없는 checkbox에 old 이름(code) selector | 현재 exactRole/name·count1·checked·pending·401·writes1 보존. F-004 cancelled Shard4에서 이 case 개별 PASS 관측; 전체 PASS 아님 |
| F-004 / #719 공정0 disabled 재발 | PRODUCT. catalog loading/빈 목록/권한 문제가 없어도 공정0 자체가 button을 영구 비활성화 | 원본 로컬 재현30.2s FAIL, 수정 후 동일 원본과 전체4파일·인접 소비자를 동결 실행 |

현재 누적 실패 파일의 합집합은 **4개**다: `tests/e2e/issue-726-task-logistics.spec.ts`, `tests/e2e/project-workspace-tabs-518.spec.ts`, `tests/e2e/logistics-target-authoring.spec.ts`, `tests/e2e/issue-719-contextual-help.spec.ts`. 서로 다른 Full Run4개에서 actual failure 발생5회/고유case4개다. 원격 전체24 Shard의 최종결론은4 FAILURE/20 CANCELLED이며 취소·미실행을 성공으로 계산하지 않는다.

### 7.4 제품 보완·반례·검증 선정

- `git blame`에서 management.tsx:626의 공정0 disabled 조건은 #726 최초 게시 `0035c48f6e107ec24647bb84d40081b0f9a4a348`에서 추가됐고, 지속 경고 handler의 `setErrorMessage`는 #719 `d5344bdfa`에서 도입됐다. 부모 조건이 onClick을 봉쇄하여 필요한 선행 공정 안내가 사라진 **제품 회귀**다. 현재 #719 문서/테스트는 해당 경고를 지속 alert로 유지할 것을 요구한다.
- 최소 제품 수정: `disabled={busy || isSubmitting || logistics.processes.length === 0}`에서 마지막 공정0 조건만 제거한다. busy/중복 제출 잠금, readonly의 버튼 비노출, 공정0이면 alert·return하여 editor/저장에 진입하지 않는 필수 guard, 서버 auth/Origin/If-Match는 유지한다. 공정 또는 설비/Task/Target를 자동 생성하지 않는다.
- 반례·기각: type catalog fixture 누락만으로 이 원격 실패를 설명할 수 없다. `processes.length===0` 자체로 handler가 영구 도달 불가다. 기존 master의 `유형 조회 실패` button selector는 실제 submit label과 일치하여 그 테스트를 바꾸지 않는다. 유형 loading/error/empty/복구는 별도 신규 case로 검사하며 원래 실패의 원인으로 섞지 않는다.
- 동일 경계 전체 탐색에서 이 도달 불가 공정0 분기는 한 곳이다. project-common System은 공정0에서 정상이고 별도 scope/권한 검증을 그대로 사용한다. Target inline 등록/서버 공정·유형 검증을 완화하지 않는다.
- 직접·간접·음성 선정: 위4개 실패 파일 전체 + `project-logistics-management.spec.ts` 전체(새 loading→503→empty→정상/초안/readonly/writes0 포함) + 실제HTTP/SQLite `issue-726-logistics-master.spec.ts` 전체. `--workers=1 --retries=0 --max-failures=0`으로 모든 선정 case를 끝까지 진단하며 CI의6-shard/max-failures1/aggregate를 바꾸지 않는다. Navigation 모델·Task 공정 draft·물류 server guard Unit을 선정한다. 전체 로컬 E2E/Docker·관련 없는 Copy/알고리즘은 이1행 UI 보완의 직접 변경 비영향으로 제외하며 원격 전체 Required에 맡긴다.
- 원본 재현: 최초 동결 Head1120722a에서 기존 #719 원본 case만 실행하여30.2s click timeout/disabled가 원격과 동일함을 확인했다. 제품 수정 전 FAIL을 `/tmp/issue-726-f004-baseline.json`/로컬trace에 보존했다. 원본 테스트·timeout/assertion/skip/retry를 변경하지 않는다.

### 7.5 로컬 추가 발견 L-001 — master 관측 범위

- 최초 누적36-case 실행은35 PASS/1 FAIL·skip0·flaky0(433.65초)이었고 #719 기존 실패는 PASS했으나, `issue-726-logistics-master.spec.ts` 마지막 재조회 관측이 FAIL했다. `getByText("A 운반로봇", {exact:true})`가 숨은 작업 고급 필터의 span과 보이는 설비 표의 strong 두 곳을 선택한 strict mode 위반이다. 설비/시스템 생성·저장과 원본 수량/WorkArea·Task/Target 보존 검증은 그 전에 통과했다. **TEST_CONTRACT**이며 원격 F-004와 별개의 로컬 발견이다.
- #717 이름 우선 표시 이후의 실제 표 구조를 기준으로 관리 panel의 cell 안 정확한 이름 descendant를 선택하고 count1·visible을 유지한다. 시스템 마지막 관측도 같은 구조로 한정해 disclosure의 추가 접근성 이름에 의존하지 않는다. `.first()`/느슨한 정규식/숨은 항목 포함·timeout 증가로 우회하지 않는다. 유형 조회 실패 selector는 실제 통과했으므로 그대로 둔다.
- 원본 로컬 실패 JSON/trace는 별도 보존하고 소스 동결을 해제한 뒤 수정한다. 최종 검증은 다시 동결한 전체 실패 합집합과 인접 소비자를 실행하여 아래에 기록한다.

### 7.6 동결 검증·인계

최종 로컬 Chromium **6파일36/36 PASS**(427.26초, worker1/retry0/maxFailures0, skip0/flaky0)다. 원격 실패 합집합4파일 전체와 관리/master 직접 소비자2파일을 다시 동결하여 실행했다. 원래 #719 경고, F-001 순서 집합, F-002 Navigation focus/5폭, F-003 Target pending/401, L-001 저장 후 원본 조회와 신규 loading/503/empty/복구·readonly/mutation0가 모두 포함된다. [최종 정제 manifest](evidence/issue726/f004-local-validation.json)에 실제 명령·36개 개별 결과·최초 실패·제외 범위를 기록한다.

- source 지문: `src`/`tests`/package+lock의 추적933파일 시작/끝 SHA256를 대조하여 drift0. aggregate `4be3aa23850d6a4716b7caafd79d6a2ac19e51b032d34d1e775a359cb2dec8d3`. 검증 후 Next 생성 설정과 #719/#724/Target 실행이 재작성한 기존 산출물80파일만 원래대로 복원했으며 제품/테스트는 바꾸지 않았다. raw browser config.env/trace는 Git에 넣지 않고 로컬 보존·해시/정제 결과만 기록한다.
- 관련 Unit4파일51/51 PASS(1.74초): Navigation 모델/Task 공정 draft/Task 직접 물류 server guard/유형 catalog service. TypeScript·변경3파일 scoped ESLint(오류0/경고0)·version0.121.0·Markdown 링크·diff check PASS. 전체 Unit/전체 E2E/Docker는 이번 최소 수정의 로컬 선정 검증에서 제외하며 원격 Required 전체로 검증한다.
- 최종 실제 Pre-PR [fast](evidence/issue726/f004-prepr-fast.json)/[targeted](evidence/issue726/f004-prepr-targeted.json)는 모두 **BLOCKED**(exit1, UNKNOWN7/missing0/steps0/sourceStable=true). working fingerprint `37a8e2d63e450a2c330f0503c7e08c3b724e099e4eddc7d38669589465cac8a1`. 전체 PR의 WorkspaceDialog·물류 관리/CSS/type·Task 직접/문맥 editor/model 자동 매핑 부족을 원래 상태로 보존한다. Manager 수동 매핑은 Work Packet의 기존 `최종 추가 검증·자동 도구 한계`와 위6파일·51 Unit으로 연결하며 이번 변경 제품1행의 직접·간접·음성 실제 실행과 자동 도구 차단을 구분한다. 매핑 정책/분류/SourceStable를 완화하거나 BLOCKED를 PASS로 전환하지 않았다. 이후 추가 문서/정제 증거는933파일의 제품·테스트 지문에 영향이 없다.
- 별도 read-only qa_docs가 원격 정제24 Shard 합계·원본 재현·첫35PASS/1FAIL·최소 source/test patch·문서·최종 지문/결과를 대조한다. 이 사전 검토는 인간 QA_FINAL·Trusted/Owner ACCEPT와 별개다. 새 원격 Required 결과를 PASS로 표시하지 않는다. version0.121.0 유지·HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false. 변경은 UI1행과 관련 시험·이슈 원장/문서/증거이며 API/DB/schema/CI/QA/권한 정책은 불변이다. 게시 직전 main·원격Head·미해결 thread·mergeability를 재검사하고 기존PR743에 변경 묶음을1회 게시한다. 새 exact-Head Required Quality/E2E/Docker·Trusted QA·Owner ACCEPT는 NOT TESTED다. CI 등록 snapshot 뒤 결과 모니터링·병합·main/GHCR·Release·Issue 종료는 수행하지 않는다.
