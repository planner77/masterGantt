# Issue #733 / PR #755 — 누적 PR CI 실패 원장

Primary Issue: [#733](https://github.com/planner77/masterGantt/issues/733), PR [#755](https://github.com/planner77/masterGantt/pull/755), 최초 분석 2026-10-20 KST.
공통 정책: [AGENTS.md](../AGENTS.md), [PR CI 실패 원장 정책](PR_CI_FAILURE_TRIAGE.md), [Issue Lifecycle](ISSUE_LIFECYCLE.md), [TEST_PLAN](TEST_PLAN.md), [Work Packet](exec-plans/active/ISSUE_733.md).

> **최신 재개 인덱스 (2026-10-20):** 아래 §8 F733-003과 §1 신규 #3039/#3042 행 참조. §1~7의 최초 시점 결과·과거 가설은 불변 이력입니다.

> **최신 재개 인덱스 (2026-10-20 KST):** §9 F733-004와 §1 #3043.1 행이 최신입니다. §1~8과 #3039.1 PASS·F733-001~003의 시점별 판단은 불변입니다.

이 문서가 #733의 단일 누적 정규 원장이다. 재실패 시 동일 파일에 Run/Attempt·새 실패 ID·전체 결과를 이어 붙이고 과거 결과는 소급 PASS로 수정하지 않는다.

## 1. PR CI 전체 원격 Run/Attempt

| 원본 | 불변 Head/Base/Test merge | 실제 Required/Job 상태 | 다른 Shard·미실행 |
| --- | --- | --- | --- |
| [PR #755 / Full CI #3035.1](https://github.com/planner77/masterGantt/actions/runs/39341161717), run ID 39341161717 / attempt 1 / pull_request, 2026-10-19 23:22–23:28 UTC | Head 51cfda4b091e520fd083f4d52fc2122010b10a01, branch feat/issue-733-process-dashboard; base 71b870b75da73f413da54e22e55bb03dc0f5abe7; test merge 40335bedbb3cceb615d774aa5e942595908bd714 | Quality job 118364253798 SUCCESS; Docker job 118364385289 SUCCESS; E2E aggregate job 118364569845 FAILURE; QA Final job 118364596280 FAILURE; Shard5 job 118363586237 FAILURE | Shard1 118363586212, Shard2 118363586234, Shard3 118363586285, Shard4 118363586292, Shard6 118363586310 all CANCELLED (fail-fast). Shard5 2 PASS / 1 FAIL / 82 NOT RUN. |
| [PR #755 / Full CI #3038.1](https://github.com/planner77/masterGantt/actions/runs/39353259152), run ID 39353259152 / attempt 1 / pull_request, 2026-10-20T01:24:32–01:26:56Z | Head 8726ce90403cc0548387591921c123ba9294852a, branch feat/issue-733-process-dashboard; base 71b870b75da73f413da54e22e55bb03dc0f5abe7; test merge 374b9735ecec8d121e1b0ea4593ad4831f802089 | Quality job 118402744962 FAILURE; E2E aggregate 118402744885 FAILURE; Docker aggregate 118402744768 FAILURE; QA Final 118402769781 FAILURE; Vitest job 118402276422 FAILURE; TypeScript, ESLint, Policy, QA Preflight SUCCESS | PR Fast Gate 118402682583 FAILURE due UNIT_RESULT=failure. PR Build/E2E6/Docker smoke implementation SKIPPED (not executed). Vitest 3096 PASS / 1 FAIL / 3 SKIPPED; 248 test files PASS / 1 FAIL / 1 SKIPPED. |
| [#3039.1 — Full CI PASS](https://github.com/planner77/masterGantt/actions/runs/39354788252), Run 39354788252 / attempt 1 / pull_request, 2026-10-20 01:41–02:07 UTC | Head `1b9da29990d5f9c1a84f6a689fa3569a07164971`, base `71b870b75da73f413da54e22e55bb03dc0f5abe7`, test merge `3dbf69fab4d7e6b97412cd03df92e0f7ea6bad07` (immutable source artifact `12234951327`) | Quality `118408064781`, E2E `118414612035`, Docker `118408316528`, QA Final `118414657579` all SUCCESS | Chromium 6/6 shards SUCCESS for this exact old head/base only; not proof of later #3042 merged source. |
| [#3042.1 — Full CI FAIL](https://github.com/planner77/masterGantt/actions/runs/39368321617), Run 39368321617 / attempt 1 / pull_request, 2026-10-20 04:12–04:19 UTC | Head `c3a9dbe8f05767a16d62f15a55cf09e0e42bf525`, base `80a42514d2c57490aebe065485f95bdfdac73723`, test merge `89ca3ff75dacacda5ad71d632d4f8985a258b2f8` (source artifact `12240406056`) | Quality `118451187344` SUCCESS / Docker `118451504510` SUCCESS / E2E `118452023873` FAILURE / QA Final `118452051997` FAILURE; actual Shard6 job `118450833178` FAILURE | Shard6 `19 PASS / 1 FAIL / 114 NOT RUN`. Shards1 `118450833102`,2 `118450833183`,3 `118450833214`,4 `118450833173`,5 `118450833220` CANCELLED (partial previously completed PASS 11/29/38/6/22, not complete). |
| [#3043.1 / Full CI FAIL](https://github.com/planner77/masterGantt/actions/runs/39370750961), Run 39370750961, attempt1, pull_request, 2026-10-20 04:39:48–05:01:34 UTC | Head eace4007a6bf64d288becf200f7c91e230f5d978; base 80a42514d2c57490aebe065485f95bdfdac73723; test merge cf6c6f6fb5957185fa53681156a0a141f1e3bae4; ci-pr-source artifact 12241098616 | Quality 118458739220 SUCCESS, Next build 118458469488 SUCCESS, Docker 118459114545 SUCCESS, E2E 118463686874 FAILURE, QA Final 118463716357 FAILURE; direct Shard3 job 118458469567 FAILURE | Shard3 57 PASS /1 FAIL/50 NOT RUN; Shard6 118458469549 134 PASS/SUCCESS; Shard1 118458470005 (116 partial PASS), Shard2 118458469530 (122), Shard4 118458469485 (79), Shard5 118458469577 (80) all CANCELLED, not complete |

확인 당시 연결된 PR은 #755 1개이며 해당 최초 Head에 대한 조회 가능한 Full PR CI는 위 한 Run이다. 추가 history 발견 시 정확 SHA/Attempt와 함께 새 행을 추가한다. TypeScript·ESLint·Vitest·정책 검사·Next production build·Docker smoke는 최초 Head에서 성공했고 이 사실은 수정 Head에 승계되지 않는다. SKIPPED matrix placeholder는 실제 CI 성공이 아니다.

## 2. 누적 Cross-run 실패·교정 매트릭스

| ID / 파일·유형 | 최초 관측과 성격 | 판단 / 보완 | 수정 Source 검증 |
| --- | --- | --- | --- |
| F733-001 / tests/e2e/issue-622-resource-plan-target.spec.ts / PRODUCT focus / [Shard5](https://github.com/planner77/masterGantt/actions/runs/39341161717/job/118363586237) | Test line 105:22, #622 Target 선택80·Project140·외부 배정 편집 복귀·동일 Excel·다섯 화면폭. expect(edit).toBeFocused() expected focused, actual inactive, timeout 5000ms. 2026-10-19T23:27:13Z. 대상 Task fb8479eb-1859-4f7b-a783-8f96589cf977, 버튼 ALICE · 긴 공동 담당 리소스 이름. Canonical Assignment ID와 40% 갱신·row/ready 검사는 PASS. | 최신 Resource dashboard/detail이 비동기 재조회 중일 때 focus 복원이 조기 fallback/1회성 동작할 수 있는 제품 취약성. 정확한 실패 RAF 타이밍은 Trace로 확정 불가하여 원인은 합리적 경합 가설 (UNKNOWN 세부 root). 동일 상세 key/Task/Assignment·ready·가시 버튼을 유한 180 RAF로 재확인하며 외부 신규 사용자 focus 우선. 기존 strict assertion과 2 RAF 후 재확인 유지. | 신규 source local/PR NOT TESTED |
| R733-001 / src/server/resources/wbs-dashboard-views-core.ts / PRODUCT P2 | [Codex comment 4319896982](https://github.com/planner77/masterGantt/pull/755#discussion_r4319896982), thread PRRT_kwDOUUB7Bc6uJFvB. WorkArea 후보를 설비ID만으로 취합하면 동일 occurrence를 가진 공정 A와 C에서 C-only WorkArea를 A 하위로 잘못 나열 가능. | 사용한 W1 membership 자체의 processId를 현재 선택한 process.id와 정확히 교집합으로 제한. #729 공통 구성 snapshot 단일 출처 유지. SQLite test에서 동일 occurrence A/C, C-only WA, equipment/control System 양쪽의 A 음성·C 양성 및 Task0/Assignment0 검증. | 신규 source local/PR NOT TESTED |
| F733-002 / tests/server/resources/issue-733-process-configuration.test.ts / FIXTURE_OBSERVABILITY / [Vitest job](https://github.com/planner77/masterGantt/actions/runs/39353259152/job/118402276422) | New test `restricts a shared-occurrence WorkArea to its exact project process through equipment and controller` threw `PublicApiError INVALID_SELECTION`, converted from the domain input validation. The fixture assigned `f.systems[2]` (MCS, layer=coordinator) as the direct equipment controller, which violates `INVALID_CONTROL_RELATION` (only layer=controller is allowed). | Replace the invalid coordinator control edge with a new ACS `layer=controller` and explicit A/C process-scoped system memberships; preserve C-only W1 and the original A negative/C positive Task0 assertions. CI gate and production algorithms unchanged. Earlier F733-001 still unverified on this Run because E2E skipped. | New corrected source local/PR NOT TESTED; Run #3038 failure remains immutable |
| F733-003 / `tests/e2e/grid-task-start-reveal.spec.ts` / TEST_CONTRACT timing | [#3042.1 Shard6 job](https://github.com/planner77/masterGantt/actions/runs/39368321617/job/118450833178) #514 pending peer wheel: `page.clock.pauseAt(new Date())`, Playwright `Cannot fast-forward to the past` at spec:126. Shard6 19PASS/1FAIL/114NOT RUN; remaining5 CANCELLED. | Product viewport assertions were not reached. `clock.install()` keeps clock running; second fresh Node `new Date()` may be older than already-running browser virtual time. Reuse #569 exact one-sampled target, install 60s before target, then pause at sampled target. Change all three same-source #514 sequences and same unguarded #529 resource export peer test; preserve native wheel/selection/RAF/keyboard and readonly assertions. | New corrected source real Chromium/CI NOT TESTED; previous #3039 full SUCCESS belongs to earlier Head. |
| **F733-004 / tests/e2e/issue-725-process-workareas.spec.ts / INIT_TRANSPORT** | [#3043.1 Shard3 job](https://github.com/planner77/masterGantt/actions/runs/39370750961/job/118458469567), test line88, restart call line273. Real Next isolated restart equipment PATCH-only URL read-only GET remained HTTP404 instead of expected 405; fixture fails at isolated-application.ts:216 before any post-restart equipment PATCH/Task GET/PUT assertions. Process alive, health200, OOM kill0; Next internal cause not confirmed. | Exact project-scoped #725 suite opts in to official Next dev Webpack instead of default Turbopack; existing exact GET405 and real PATCH200 JSON/Task GET200 JSON assertions retained, MIME fail-closed (only temporary HTML404 can be retried), sanitized bundler/attempt receipt added. No global CI gate/timeouts/retries/skip/product change. | New source local/Full CI NOT TESTED; see §9. |
| D733-001 / 정책·파생 | Required E2E FAILURE, QA Final FAILURE; 5개 Shard CANCELLED | 실물 1 E2E FAIL과 미해결 리뷰의 차단이 후속 gate로 전달됨. 취소를 PASS로 치환하거나 CI gate/timeout/skip/retries를 완화하지 않음. | 새 exact Head required/QA NOT TESTED |

**실제 원격 실패 테스트 파일 합집합:** tests/e2e/issue-622-resource-plan-target.spec.ts (1 file, 1 confirmed failing case). QA Final/aggregate를 별개 제품 FAIL로 중복 계수하지 않는다. 취소5·Shard5 미실행82는 **UNKNOWN/NOT RUN**으로 관리한다.

## 3. 첫 실제 실패 증거·확정/추정

- [Run #3035.1](https://github.com/planner77/masterGantt/actions/runs/39341161717), [Shard5 로그](https://github.com/planner77/masterGantt/actions/runs/39341161717/job/118363586237), [원본 Playwright report/trace artifact 12229655653](https://github.com/planner77/masterGantt/actions/runs/39341161717/artifacts/12229655653). GitHub upload SHA256: 31bd3dc3ab96b3bdaf05e437066dc6c1506dc3c023abd33f7c88f7aa0fc423bb. Raw trace·압축파일·쿠키/토큰·이미지는 원격 Git 원장에 넣지 않고 링크만 유지한다.
- Locator는 대기 중 실제 버튼으로 반복 resolve되었지만 Received inactive였다. 반대로 allocation 값 60→40, canonical assignment 항등성, 데이터 40%, detail ready는 이미 PASS했으므로 저장 실패라고 단정하지 않는다. Task Editor close→Resource 비동기 렌더→복귀의 정확한 내부 프레임 순서는 확인되지 않았으므로 스케줄링/원본 교체 경합 가설을 확정 root와 구분한다.
- Shard5 GitCommitInfo git fetch 3000ms 초과 경고는 테스트 assertion을 발생시킨 실제 원인이 아니다. 완료된 이전 두 E2E는 PASS; 이후 82개 미실행, 다른 Shard는 CANCELLED. 새 수정 소스의 성공을 시사하지 않는다.

## 4. AGENTS.md 및 과거 실패 원장 교차 분석

- [#730 원장](ISSUE_730_FAILURE_ANALYSIS.md)에서 WBS 원본 복귀/상세 비동기 generation, 조회-only POST와 writer 감시 분리, 실제 호출·권한/스냅샷, 원본 read-only와 음성 assertion 유지 정책을 참고한다. 해당 원장의 독립 FAIL을 #733 횟수로 합산하지 않는다.
- [#731 원장](ISSUE_731_FAILURE_ANALYSIS.md)의 KPI original focus 실패 및 새 사용자 검색/복귀 초점 가로채기 P1 사례를 참고해 source scope가 일치하지 않거나 새 외부 focus/모달이면 stale restore를 중단한다. 독립적인 경로지만 공통 focus 안정성 계약이다.
- [#728 원장](ISSUE_728_FAILURE_ANALYSIS.md)의 WorkArea/Target 분리 및 [#729 공통 snapshot](exec-plans/active/ISSUE_733.md)의 실설비·등록 구성 후보와 정확 W1 공정 교집합을 보존한다. #622 테스트 FAIL은 이 #733 PR에서 처음 실제 관측된 것으로 처리한다.
- 최초 HEAD의 로컬 검증 결과 (Work Packet에 기록된 Unit/Browser)는 원본에만 귀속한다. 취소된 Shard를 과거 PASS로 치환하지 않는다. 원인이 다른 REVIEW 제품 결함은 F733-001과 구별한다.

## 5. 보완, 검증 범위, 잔여 위험

1. F733-001: src/features/projects/project-readonly-view.tsx의 Task Editor resources-origin finish 분기에서 정확 detail key 검색·ready 상태·현재 활성 버튼 확인 후 focus 복원. 이전 조기 fallback 대신 최대 180 animation frame의 유한 검증 경로, 이전 세대/다른 modal/다른 화면/외부 신규 focus 보호를 유지. 기존 Task/Assignment 원본·저장·권한 의미 불변. tests/e2e/issue-622-resource-plan-target.spec.ts strict 5s toBeFocused, 2 RAF 안정성 재확인 추가.
2. R733-001: src/server/resources/wbs-dashboard-views-core.ts에서 equipmentWorkAreas 후보를 exact processId 필터와 교집합. tests/server/resources/issue-733-process-configuration.test.ts에서 같은 occurrence의 A/C와 C-only WorkArea의 equipment/controller false-positive 방지 및 C-only Task0 구성 양성 테스트. 설비 수량·System 식수/Task/Assignment는 별개의 기준이며 WBS/Resource snapshot 변경·mutate 금지.
3. 테스트 선정: 직접 #622 focus/Target80/Project140/Excel/5폭, #733 process/WorkArea/equipment/System/Task0/HTTP/SQLite 및 snapshot; 간접 #730 original/detail, #731 KPI focus; 음성 readonly #624, 원본 Task/Assignment 항등성, data-ready/취소/새 사용자 focus. 동결된 같은 source의 npm/Vitest/Chromium/Next Build/Docker 검증은 GitHub Git Data만 이용 가능한 이 환경에서는 수행할 수 없어 NOT TESTED. 외부 원격 Full CI로 모든 6 Shard 증거를 새로 검증한다.
4. CI fail-fast·timeout/retry/skip·policy/QA·DB writer·정식 릴리스 태그는 변경하지 않는다. 이전 Head의 Success는 신규 Head Success를 대신하지 않는다. P2 리뷰 해결과 최신 main strict merge/no conflicts를 PR 갱신 시 재확인한다.
5. Manager/infra: 원본 Run/Jobs/artifacts 검증 및 누적 원장 인계. domain: 코드·회귀 보완. Reviewer: P2 답글/resolve. Owner: HIGH 위험 최종 수용·Trusted QA 후 승인. 현재 MERGE_READY=BLOCKED, 새 Head의 Required/Owner=NOT TESTED, release_authorized=false.

## 6. 다음 Full PR CI 인계

- 원래 SHA 51cfda4b...의 실패는 §1에 고정. 수정 commit은 기존 branch non-force fast-forward 후 pull_request synchronize로 새로운 정확 HEAD/Run을 시작한다. 실제 신규 HEAD/Run URL은 게시 후 PR/Issue 댓글에서 연결한다. 미확인 값은 만들지 않는다.
- 리뷰 스레드 해결·main base 최신성·충돌 없음 확인하고 새 CI 시작 이후 **완료 모니터링 없음**. 병합/Main CI/정식 GHCR/Issue 종료는 수행하지 않는다.
- 재실패 시 Issue #733의 모든 접근 가능한 PR, Full/metadata, Run/Attempt, actual FAIL, CANCELLED/NOT RUN 및 기존 원장 F733-001·R733-001를 다시 분석 후 같은 문서에 F733-002부터 append한다.

## 7. F733-002 — PR #755 Full CI #3038.1 신규 회귀 fixture 실패 (2026-10-20)

### 7.1 원본 Run·전체 Job·첫 오류
- [Run 39353259152 / #3038.1](https://github.com/planner77/masterGantt/actions/runs/39353259152) attempt 1, event `pull_request`, 2026-10-20 01:24:32–01:26:56 UTC; branch `feat/issue-733-process-dashboard`, exact HEAD `8726ce90403cc0548387591921c123ba9294852a`, base `71b870b75da73f413da54e22e55bb03dc0f5abe7`, test merge `374b9735ecec8d121e1b0ea4593ad4831f802089`. [Source artifact](https://github.com/planner77/masterGantt/actions/runs/39353259152/artifacts/12234215875) digest `sha256:7d5287c0999d120e49eb803059c5a8f993923f24b60f25887a2ce65223591517` (GitHub artifact metadata).
- 원본 [Vitest job 118402276422](https://github.com/planner77/masterGantt/actions/runs/39353259152/job/118402276422) `Run npm test`: test `tests/server/resources/issue-733-process-configuration.test.ts` → `restricts a shared-occurrence WorkArea to its exact project process through equipment and controller`, `PublicApiError: 현재 프로젝트에 연결된 조회 대상을 다시 선택해 주세요.` at `resource-dashboard-service-core.ts:42`. 정확한 원격 aggregate: test files 248 PASSED / 1 FAILED / 1 SKIPPED of 250, tests 3096 PASSED / 1 FAILED / 3 SKIPPED of 3100.
- TypeScript job `118402276413`, ESLint `118402276368`, 정책 `118402276330`, QA Preflight `118402201328` SUCCESS. Fast Gate `118402682583`은 `UNIT_RESULT=failure`로 차단. 원격 Production Build·Chromium E2E6·Docker smoke 구현은 SKIPPED; 세 Required aggregate(Quality `118402744962`, E2E `118402744885`, Docker `118402744768`)는 하위 검사 실패/미실행의 정상 파생 FAILURE, QA Final `118402769781`도 `required quality 미성공`으로 FAIL. 미실행을 E2E/Docker 제품 PASS/FAIL 또는 #622 포커스 재발이라고 단정하지 않는다.

### 7.2 누적 Cross-run 진단·확인된 원인
- **F733-001**: #3035.1 Shard5의 #622 Task Editor 후 `toBeFocused` FAIL. 8726ce9의 Resource origin bounded restore 보완은 #3038.1에서 TypeScript/ESLint만 PASS이고 E2E는 Fast Gate로 SKIPPED, 따라서 원격 제품 결과 **NOT TESTED**. 포커스 원래 단언과 두 RAF 안정성 및 앞선 UNKNOWN 세부 root를 유지한다.
- **R733-001**: Codex P2에서 확인한 동일 occurrence의 공정별 WorkArea 오귀속 후보. 8726ce9의 `processId` 정확 후보 제한은 TypeScript/ESLint PASS이나 새 반례의 검증 단계가 fixture 자체의 잘못된 구성 때문에 중단되었으며 제품 정합 PASS로 판단하지 않는다.
- **F733-002 (신규·직접)**: 직전 보완 때 신규 SQLite 테스트가 `f.logistics.setEquipmentSystems(... f.systems[2].id ...)`를 실행했다. `tests/fixtures/resource-dashboard-targets.ts`는 `systems[2]`를 MCS `layer='coordinator'`로 생성하고, `src/domain/resources/wbs-task-ledger.ts`의 `resolveWbsTaskLedger`는 설비 `controlSystems`에 대해 **`layer='controller'` + 역할 `primary|supporting`만 허용**, 위반 시 `INVALID_CONTROL_RELATION`을 발생시킨다. `ResourceDashboardService.queryWbsView`는 입력 오류를 외부 `PublicApiError INVALID_SELECTION`으로 정규화한다. 원격 메시지의 숨은 내부 code는 별도 노출되지 않지만 코드·fixture 조건이 직접 일치하므로 **원인 유형=FIXTURE_OBSERVABILITY(테스트에 잘못 생성한 도메인 입력)**; 기존 제품 데이터의 회귀·관계 유효성 완화로 해결할 문제가 아니다.
- 이전 #730/#731 원장의 원본 복귀·focus 사례, #728/#729의 snapshot/공정·구역 참조, #624 readonly 영향은 첫 원장 §4에 보존한다. 다른 Issue의 실패를 #733의 원격 실패로 새로 합산하지 않는다. **현재 실제 원격 실패 파일 합집합은 2개**: `tests/e2e/issue-622-resource-plan-target.spec.ts` (#3035.1), `tests/server/resources/issue-733-process-configuration.test.ts` (#3038.1).

### 7.3 일괄 보완과 회귀 선정
- 테스트 *데이터만* 교정: 유효한 신규 `ACS controller` 시스템 `scope='processes'`를 구성하고 공정 A/C 양쪽의 시스템 membership을 명시 등록하며, E0의 직접 `controlSystems`는 해당 `controller`로 지정. 설비의 W1 WorkArea C 전용은 유지한다. `process A→equipment/system→C-only WA` **불허**와 `process C→equipment/system→C-only WA` **허용**, 동일 Task0/Assignment0 및 등록 구성 수량·공정 정합 검증을 유지한다.
- `src/domain/resources/wbs-task-ledger.ts`, `resource-dashboard-service-core.ts`, 공통 projection, DB/API/writer, React focus fix, CI Required3/6 shard/fail-fast/timeout/retry/skip 모두 **변경하지 않는다**. 잘못된 fixture를 허용하도록 production validator를 약화하지 않는다.
- 직접 Unit: 전체 `tests/server/resources/issue-733-process-configuration.test.ts`, #733 대상 source/transport·W1/등록-only, 이전 원격 F733-001 #622 Chromium 및 #733 전용5·#730 canonical navigation, 간접 #731 KPI focus, 음성 #624 legacy/readonly·Target 관련 계약을 동일 동결 소스에서 재실행해야 한다. 이 연결 경로에서 Node/SQLite/Chromium runner 실행이 불가능하므로 수정 후보의 로컬 실제 통과는 **NOT TESTED**, 원격 Full 새 HEAD CI만 유효한 확인 수단이다.
- 원인 코드와 최소 수정 텍스트를 교차 점검하되 **원본 #3038.1 결과를 소급 성공으로 기록하지 않는다**. 버전 0.125.0, HIGH/OWNER_MANAGED, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`, `release_authorized=false`; 새 Head의 Required Quality/E2E/Docker·Trusted QA·Owner 수용 전 병합/정식 릴리스 금지.

### 7.4 다음 CI 인계
- 진단 시 main/base `71b870b75da73f413da54e22e55bb03dc0f5abe7`에 비해 HEAD `8726ce90403cc0548387591921c123ba9294852a`는 ahead 2/behind 0이고 PR mergeable=true; 기존 Codex P2 thread는 resolved 1, 미해결 0. 게시 직전/후 최신 main·Head/리뷰·merge 충돌 재확인 후 single non-force branch synchronize로 **새 Full PR CI 시작**. 신규 Run/Attempt와 Source SHA는 GitHub 실제 반환으로만 PR 댓글 연결.
- 사용자 요청에 따라 CI 완료 모니터링하지 않는다. 병합/Main/GHCR·Release/tag·Issue 종료·Owner 승인 수행하지 않는다. 다음 실패 시 본 단일 원장의 #3035.1 F733-001, #3038.1 F733-002·R733-001 및 새 증거를 모두 대조 후 F733-003부터 추가한다.


## 8. F733-003 — main 정렬 후 Full PR #3042.1의 Playwright 시계 역행 (2026-10-20)

### 8.1 불변 Run, 정상 Gate와 실제 실패 분리

- [#3039.1 / Run 39354788252](https://github.com/planner77/masterGantt/actions/runs/39354788252) attempt 1 은 Head `1b9da29990d5f9c1a84f6a689fa3569a07164971`, base `71b870b75da73f413da54e22e55bb03dc0f5abe7`, test merge `3dbf69fab4d7e6b97412cd03df92e0f7ea6bad07`로 **Required3 + QA Final + Chromium 6/6 SUCCESS**였다. [동결 source artifact ID12234951327](https://github.com/planner77/masterGantt/actions/runs/39354788252/artifacts/12234951327), sha256:9c37be9c1059129933821dcf5300f3c04573ad04ebe1bade155846462f370204. 이 성공은 #3035.1 F733-001과 #3038.1 F733-002가 그 특정 Head에서 재발하지 않았다는 증거이나 다른 base/Head의 성공 증명은 아니다.
- [#3042.1 / Run 39368321617](https://github.com/planner77/masterGantt/actions/runs/39368321617) attempt 1, event `pull_request`, 2026-10-20 04:12:14–04:19:06 UTC, Head `c3a9dbe8f05767a16d62f15a55cf09e0e42bf525`, base `80a42514d2c57490aebe065485f95bdfdac73723`, test merge `89ca3ff75dacacda5ad71d632d4f8985a258b2f8`. [동결 source artifact ID12240406056](https://github.com/planner77/masterGantt/actions/runs/39368321617/artifacts/12240406056), sha256:e2835733e5dc7384e265be8fda0aaebcc4b5edf71e77e4d81cd318f6cdf4bf8d.
- Quality `118451187344` SUCCESS (typecheck, ESLint, Vitest, Policy, Next build) / Docker `118451504510` SUCCESS. 실제 원인은 [Chromium Shard6 `118450833178`](https://github.com/planner77/masterGantt/actions/runs/39368321617/job/118450833178)의 `tests/e2e/grid-task-start-reveal.spec.ts:126:48` #514 `pending peer wheel and rapid selections preserve latest actual user intent`: `page.clock.pauseAt: Error: Cannot fast-forward to the past` at 2026-10-20T04:18:05Z. 해당 Shard 예정134개 중 19PASS/1FAIL/114NOT RUN(종료까지 fail-fast); 나머지 Shard1/2/3/4/5는 각각 11/29/38/6/22개의 관측된 부분 PASS 후 CANCELLED. 전체 6-shard 성공 아님.
- Required E2E `118452023873` FAILURE 및 QA Final `118452051997` (required e2e 미성공) FAILURE는 *이 원본 한 건에 따른 파생 차단*, 별도 제품 실패가 아니다. `GitCommitInfo git fetch` 3000ms 경고·React key 경고·mock GET404는 원본 clock exception과 별도이며 직접 원인으로 분류하지 않는다. [Shard6 Playwright report/trace ID12240985256](https://github.com/planner77/masterGantt/actions/runs/39368321617/artifacts/12240985256), upload sha256:c9acc9b4e7213e3320931687119c25440e21a6503eac2729a2c172e6c8f7c366; raw trace/log/secret은 Git에 저장하지 않음.

### 8.2 이전 전체 원인 대조와 이번 원인

| ID | 이전 근인·당시 수정 | #3042.1에서 직접 확인/미확인 |
| --- | --- | --- |
| F733-001 | #3035 Shard5 #622 Task Editor 후 원본 배정 focus 미복원; bounded ready/origin restore와 2 RAF 단언 보강 | #3039 Full 성공. #3042 Shard5는 취소되어 미검증; 과거 실패·가설 보존 |
| R733-001 | PR Code Review P2 공유 occurrence의 공정별 WorkArea 잘못된 후보; exact processId 후보 한정 | 리뷰 resolved. #3039 관련 Unit/Full 통과; #3042 Unit SUCCESS. 실제 #514 clock FAIL과 다른 경로 |
| F733-002 | #3038 신규 동일 occurrence fixture가 MCS/coordinator를 직접 설비 controller로 설정; 유효한 ACS/controller로 교정 | #3039 Unit/Full 성공 및 #3042 Unit SUCCESS. 직접 기존 fixture 오류 재발은 관측되지 않음 |
| **F733-003** | **신규 E2E TEST_CONTRACT/시계 초기화 경합**: #514 원래 `await page.clock.install(); await page.clock.pauseAt(new Date());`는 install이 실시간으로 흐른 뒤, 목표로 잡은 다른 Node 시각이 가상 시계보다 뒤처질 수 있다. `pauseAt`은 지정 시각으로 전진하는 API이므로 실제 오류를 반환함 | #3042 Shard6 19PASS/1FAIL/114NOT RUN. 당시 제품 wheel/새 선택/원본 복귀 단언에는 도달하지 않았으므로 그 기능의 실패는 단정하지 않음 |

- 이전 [#569 Run 실증](evidence/issue569/rework/ci-history.json)에서 동일 `Cannot fast-forward to the past`가 `resource-kpi-integration-ui.spec.ts`에서도 발생했다. 현재 [#569 교정 패턴](../tests/e2e/resource-kpi-integration-ui.spec.ts)은 **단일 `pauseTime` 샘플**을 만든 뒤 `install({time:pauseTime-60_000})` / `pauseAt(pauseTime)` 순으로 사용한다. 별개 Issue의 실패를 #733 카운트로 합산하지 않고, 기존 검증 근거·패턴만 재사용한다.
- 제품 `project-gantt.tsx`, WBS 코어·Milestone·Resource·Gantt State/viewport writer·DB/API는 이번 FAIL 증거상 변경 사유가 없다. 시간 경합을 없앤 뒤에도 같은 기존 `wheel 120→151`, 빠른 다중 선택 최신 우선, 필터 cancel, fullscreen/5폭, 실제 DOM/Core 좌표와 읽기 전용 mutation0, 동기화·원본 focus 단언이 유지되어야 한다. Test Timeout/Retry/Skip/max-failures 및 CI 6-shard 필수 게이트는 완화하지 않는다.

### 8.3 범위 있는 일괄 보완과 동일 소스 검증 인계

- 직접 `tests/e2e/grid-task-start-reveal.spec.ts`의 동일한 unsafe `install();pauseAt(new Date())` **세 곳**(#514 wheel/rapid selections, filter source-change, pending peer Task reveal)을 모두 교정한다. 인접 `tests/e2e/resource-excel-export-ui.spec.ts`의 동일 unsafe 패턴 **한 곳**(#529 pending peer restore)도 함께 교정한다. `resource-kpi-integration-ui.spec.ts`의 안정화된 동일 패턴은 읽기 전용 비교 근거이며 변경하지 않는다. #529의 별도 `pauseAt(browser time +100ms)`는 이번 원본 FAIL 패턴과 다르므로 임의 확대하지 않고 기존 실제 browser 취소 단언을 보존한다.
- 최소 diff 4곳 모두 `const pauseTime=new Date()` → `page.clock.install({time:new Date(pauseTime.getTime()-60_000)})` → `page.clock.pauseAt(pauseTime)`; 일정한 목표/선행 시간 관계를 코드로 확보한다. Clock/RAF를 우회하거나 제품 로직을 대체하지 않는다. 테스트의 `runFor(32/200/300/500)`, `resume()`, selection/focus/geometry/native wheel/assertions는 변경하지 않는다.
- 회귀 집합: 누적 실제 실패 `tests/e2e/issue-622-resource-plan-target.spec.ts`·`tests/server/resources/issue-733-process-configuration.test.ts`·`tests/e2e/grid-task-start-reveal.spec.ts`, 인접 `resource-excel-export-ui.spec.ts`·`resource-kpi-integration-ui.spec.ts`; #733 공정 전용 E2E/HTTP/SQLite·#730 원본 경합·#731 KPI 초점·#624 readonly·#463 mutation0·GSC-07/08/09 및 이전 #569 반례를 참조. 신규 Base 이후 Quality/E2E6/Docker 및 Trusted QA로 미실행/취소된 후단 전체를 확인한다.
- 이 GitHub Git Data만 제공된 실행 경로에서 수정 source의 Node/Playwright/SQLite 실동작은 **NOT TESTED**. 읽기 전용 파일/코드 diff·4곳 교정 수·기존 단언 보존·최신 PR HEAD/base/merge/리뷰 확인은 별도 감사한다. 기존 #3039 PASS 및 #3042 Quality/Docker PASS는 새 Head의 PASS로 전용하지 않는다. 원격 새 Full CI 검증 전 `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`, `release_authorized=false`.
- 정책·버전: HIGH/OWNER_MANAGED, `version=0.125.0` 불변, Work Packet·TEST_PLAN·CHANGELOG 동기화. 새 commit/push는 expected Head lease를 사용하여 단일 `synchronize`만 유발하고 그 새 CI 시작 여부만 확인한다. CI 완료 모니터링/병합/Main/GHCR/Release/Issue 종료 없음. 후속 실패 시 본 원장에 F733-004부터 추가하여 전체 이력을 다시 분석한다.


## 9. F733-004 — Full PR CI #3043.1 격리 Next dev 재시작 동적 설비 경로 미준비 (2026-10-20)

### 9.1 Source, 원본 실제 실패 및 취소/미실행

- [Run #3043.1](https://github.com/planner77/masterGantt/actions/runs/39370750961): attempt1/event=pull_request, 2026-10-20 04:39:48–05:01:34 UTC; PR #755 branch feat/issue-733-process-dashboard, HEAD eace4007a6bf64d288becf200f7c91e230f5d978, base/main 80a42514d2c57490aebe065485f95bdfdac73723, test-merge cf6c6f6fb5957185fa53681156a0a141f1e3bae4. [Source artifact 12241098616](https://github.com/planner77/masterGantt/actions/runs/39370750961/artifacts/12241098616), SHA256 ce2cc7fdbcdfdeab82ffa3656ef1b218749468e45cd7f553dab9f4f1b7a831c2.
- 최초 FAIL: [Chromium Shard3 job 118458469567](https://github.com/planner77/masterGantt/actions/runs/39370750961/job/118458469567) / tests/e2e/issue-725-process-workareas.spec.ts:88, restartIsolatedApplication(equipmentPatchPath, taskContextPath) at line273. tests/e2e/fixtures/isolated-application.ts:216 error: 격리 E2E 서버 재시작 후 설비 PATCH 경로가 준비되지 않았습니다: read-only GET 마지막 HTTP 404, 예상 405. Shard3 57PASS/1FAIL/50NOT RUN (max-failures=1). 실제 postrestart equipment PATCH/Task GET/PUT 및 후단 assertions 미실행.
- Shard6 job 118458469549 **134/134 SUCCESS**: 이전 F733-003의 #514 Playwright clock exception 이번 Run 재발 없음. Shards1/2/4/5 각각 부분 116/122/79/80 PASS 뒤 CANCELLED(완료 PASS 아님). Required Quality 118458739220 SUCCESS, Next production build 118458469488 SUCCESS, Docker 118459114545 SUCCESS, E2E aggregate 118463686874 FAILURE, QA Final 118463716357 FAILURE(required e2e 미성공 파생). 정책/Preflight PASS. [원본 Playwright report/trace artifact 12242241857](https://github.com/planner77/masterGantt/actions/runs/39370750961/artifacts/12242241857), digest SHA256 05ebd50bb3a2b65c6fd681a8b63debcedbbb90e1cfae8557cc564f9a52a297f5.

### 9.2 관측된 사실과 미확정 근인

- Trace의 isolated-application-diagnostics: 처음 격리 Next child 정상 종료(exit0, expected shutdown); restart 후 두 번째 child 프로세스 살아 있음, health HTTP200(14ms), Linux cgroup oomKill=0, 당시 host free memory 약13.1GB. 재시작 이전 실제 설비 PATCH는 HTTP200으로 관측됨. restart 후 해당 PATCH-only 동적 경로에 대한 비변경 GET405 준비 검사에서 상태404가 90초 내 해결되지 않음. 실제 postrestart PATCH는 보내지 않았으므로 업무 저장 실패로 단정하지 않는다.
- src/app/api/projects/[publicId]/logistics/equipment/[equipmentId]/route.ts는 PATCH/DELETE만 export하고 GET은 미구현. 공식 [Next Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)는 경로 인식 후 미지원 GET에 405 반환을 규정한다. /api/health/ready 200은 **별도 동적 route 등록 증거가 아님**. 해당 초기 404의 MIME은 기존 원본 진단에서 기록되지 않았으므로 HTML404인지 앱 JSON404인지는 UNKNOWN.
- 범주: **INIT_TRANSPORT** (Next dev 동적 route 등록/컴파일). 구체적인 Next/Turbopack 내부 버그는 **UNKNOWN/가설**. #731 M-002의 restart PATCH HTML404 및 #730 F730-014의 별도 Task Context GET HTML404와 같은 위험 계열이나 해당 Issue의 실패 건수를 #733에 합산하지 않는다. [Upstream Next dev 재시작/동적 404 사례](https://github.com/vercel/next.js/issues/97897)는 다른 route-group 조건의 유사 사례일 뿐 본 repo 근인을 증명하지 않는다.
- [공식 Next CLI](https://nextjs.org/docs/app/api-reference/cli/next)의 지원 옵션 next dev --webpack으로, 이 오류가 발생한 #725 isolated suite **두 테스트에만** webpack opt-in을 설정해 기본 Turbopack의 route-tree 준비 경합 가능성을 회피하는 **새 가설 기반 조치**. 그대로 실패하면 추가 원시 증거로 새 Failure ID에 누적해야 하며 성공을 선결 주장하지 않는다.

### 9.3 이전 실패 전원장과 이번 Run 교차

| ID | 기존 오류/교정 | 이번 결과 |
| --- | --- | --- |
| F733-001 #3035 Shard5 | Resource Editor 원본 배정 focus 실패, bounded confirmed-detail 복귀·2RAF 단언 | 이전 #3039 Full PASS; 이번 Shard5 CANCELLED로 해당 테스트 새 Source 완료 확인 불가 |
| R733-001 P2 리뷰 | 동일 occurrence cross-process WorkArea 후보 오류, exact processId·ACS controller 회귀 | Review RESOLVED, Vitest SUCCESS, 이번 직접 오류와 무관 |
| F733-002 #3038 Vitest | 무효 MCS/coordinator controller fixture → 유효 ACS 교정 | 이번 Vitest SUCCESS |
| F733-003 #3042 Shard6 | clock.install 이후 pauseAt 시계 역행 → 3+1 fixed baseline | 이번 Shard6 134 PASS, 해당 오류 미재발 |
| **F733-004 #3043 Shard3** | 격리 Next dev restart 후 설비 PATCH-only GET이 404로 남음 | 신규 직접 FAIL. 원시 Next 내부 근인은 UNKNOWN, Webpack 격리 opt-in 새 CI 필요 |

현재 이슈 #733 원격 실제 실패 파일 **합집합 4개**: tests/e2e/issue-622-resource-plan-target.spec.ts, tests/server/resources/issue-733-process-configuration.test.ts, tests/e2e/grid-task-start-reveal.spec.ts, tests/e2e/issue-725-process-workareas.spec.ts. #3039.1은 특정 과거 SHA/Base에서 Full PASS, 이전 실패 결과 소급 변경 금지.

### 9.4 수정, 안전 불변식, 회귀 검증 및 인계

- 변경 1: tests/e2e/fixtures/isolated-application.ts에 타입이 제한된 test 옵션 isolatedDevBundler(turbopack|webpack), **기본 turbopack 유지**, opt-in만 next dev --webpack. 테스트별 독립 loopback/SQLite/NEXT_DIST_DIR와 정상 종료/cleanup, 인증·실제 저장 세션·fixture 일체 유지. 기존 GET405 readiness 검사 보존, **일시 HTML404만** 준비 중 재조회하며 JSON404/401/403/500 및 잘못된 MIME은 즉시 실패. route template/method/attempts/bundler/업무 mutation retry0만 sanitized receipt로 남긴다.
- 변경 2: tests/e2e/issue-725-process-workareas.spec.ts 두 실제 E2E 시나리오에만 isolatedDevBundler=webpack opt-in. 실제 restart, GET405 및 Task GET200 JSON, 설비 PATCH200 JSON 두 번, task process-context PUT 및 null→[A,B]→[B]→[], WorkArea 수량/Target0, 5폭·readonly·focus·Gantt instance·permission·mutation count 원래 단언 유지. **작업 재전송, synthetic PATCH, assertion 완화, CI skip/retry/global timeout 변경 없음**; 기존 90초 준비/180초 test·120초 fixture 예산 불변.
- 직접/간접/음성 검증: #725 두 actual browser/HTTP/SQLite, #730 F730-014 Task ready와 #731 M-002 equipment restart, #726 Task Context, #621/#623 E2E, #733 공정/구성 Unit/E2E, 누적 F733-001~003의 #622 focus·#733 SQLite·#514 wheel clock, #529/569 peer clock, #624 readonly, GSC-07/08/09 state, status/mime/URL/권한·다른 Project negative, 6 shard 전체. 로컬 Node/Vitest/Chromium/SQLite/Docker **NOT TESTED** (GitHub Git Data 연결 경로, 실행 환경 부재). 정적 소스 diff/원본 로그·artifact 조회는 실행 PASS가 아니다.
- 문서: 동일 본 실패 원장·Work Packet·TEST_PLAN·CHANGELOG 갱신; DESIGN/API/DB schema/사용자 매뉴얼 N/A(제품 기능·스키마 변경 없음). candidate version 0.125.0, HIGH/OWNER_MANAGED, manager_decision=NOT TESTED, MERGE_READY=BLOCKED, release_authorized=false. 최신 main strict/review unresolved0/mergeable 확인 후 non-force 단일 commit push → 새 exact source Full PR CI 시작만 확인. 이후 CI 완료 모니터링, 병합/Main CI/GHCR/Release/tag·Issue 종료는 수행하지 않는다.
- 새 Head에서도 같은 문제 발생 시 이 **한 문서에 §10 F733-005부터** 추가하며 과거 4개 직접 실패 파일과 동결된 새 Source의 사용 소비자 전체를 재대조한다.
