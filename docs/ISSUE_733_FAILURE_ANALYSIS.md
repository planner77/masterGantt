# Issue #733 / PR #755 — 누적 PR CI 실패 원장

Primary Issue: [#733](https://github.com/planner77/masterGantt/issues/733), PR [#755](https://github.com/planner77/masterGantt/pull/755), 최초 분석 2026-10-20 KST.
공통 정책: [AGENTS.md](../AGENTS.md), [PR CI 실패 원장 정책](PR_CI_FAILURE_TRIAGE.md), [Issue Lifecycle](ISSUE_LIFECYCLE.md), [TEST_PLAN](TEST_PLAN.md), [Work Packet](exec-plans/active/ISSUE_733.md).

이 문서가 #733의 단일 누적 정규 원장이다. 재실패 시 동일 파일에 Run/Attempt·새 실패 ID·전체 결과를 이어 붙이고 과거 결과는 소급 PASS로 수정하지 않는다.

## 1. PR CI 전체 원격 Run/Attempt

| 원본 | 불변 Head/Base/Test merge | 실제 Required/Job 상태 | 다른 Shard·미실행 |
| --- | --- | --- | --- |
| [PR #755 / Full CI #3035.1](https://github.com/planner77/masterGantt/actions/runs/39341161717), run ID 39341161717 / attempt 1 / pull_request, 2026-10-19 23:22–23:28 UTC | Head 51cfda4b091e520fd083f4d52fc2122010b10a01, branch feat/issue-733-process-dashboard; base 71b870b75da73f413da54e22e55bb03dc0f5abe7; test merge 40335bedbb3cceb615d774aa5e942595908bd714 | Quality job 118364253798 SUCCESS; Docker job 118364385289 SUCCESS; E2E aggregate job 118364569845 FAILURE; QA Final job 118364596280 FAILURE; Shard5 job 118363586237 FAILURE | Shard1 118363586212, Shard2 118363586234, Shard3 118363586285, Shard4 118363586292, Shard6 118363586310 all CANCELLED (fail-fast). Shard5 2 PASS / 1 FAIL / 82 NOT RUN. |
| [PR #755 / Full CI #3038.1](https://github.com/planner77/masterGantt/actions/runs/39353259152), run ID 39353259152 / attempt 1 / pull_request, 2026-10-20T01:24:32–01:26:56Z | Head 8726ce90403cc0548387591921c123ba9294852a, branch feat/issue-733-process-dashboard; base 71b870b75da73f413da54e22e55bb03dc0f5abe7; test merge 374b9735ecec8d121e1b0ea4593ad4831f802089 | Quality job 118402744962 FAILURE; E2E aggregate 118402744885 FAILURE; Docker aggregate 118402744768 FAILURE; QA Final 118402769781 FAILURE; Vitest job 118402276422 FAILURE; TypeScript, ESLint, Policy, QA Preflight SUCCESS | PR Fast Gate 118402682583 FAILURE due UNIT_RESULT=failure. PR Build/E2E6/Docker smoke implementation SKIPPED (not executed). Vitest 3096 PASS / 1 FAIL / 3 SKIPPED; 248 test files PASS / 1 FAIL / 1 SKIPPED. |

확인 당시 연결된 PR은 #755 1개이며 해당 최초 Head에 대한 조회 가능한 Full PR CI는 위 한 Run이다. 추가 history 발견 시 정확 SHA/Attempt와 함께 새 행을 추가한다. TypeScript·ESLint·Vitest·정책 검사·Next production build·Docker smoke는 최초 Head에서 성공했고 이 사실은 수정 Head에 승계되지 않는다. SKIPPED matrix placeholder는 실제 CI 성공이 아니다.

## 2. 누적 Cross-run 실패·교정 매트릭스

| ID / 파일·유형 | 최초 관측과 성격 | 판단 / 보완 | 수정 Source 검증 |
| --- | --- | --- | --- |
| F733-001 / tests/e2e/issue-622-resource-plan-target.spec.ts / PRODUCT focus / [Shard5](https://github.com/planner77/masterGantt/actions/runs/39341161717/job/118363586237) | Test line 105:22, #622 Target 선택80·Project140·외부 배정 편집 복귀·동일 Excel·다섯 화면폭. expect(edit).toBeFocused() expected focused, actual inactive, timeout 5000ms. 2026-10-19T23:27:13Z. 대상 Task fb8479eb-1859-4f7b-a783-8f96589cf977, 버튼 ALICE · 긴 공동 담당 리소스 이름. Canonical Assignment ID와 40% 갱신·row/ready 검사는 PASS. | 최신 Resource dashboard/detail이 비동기 재조회 중일 때 focus 복원이 조기 fallback/1회성 동작할 수 있는 제품 취약성. 정확한 실패 RAF 타이밍은 Trace로 확정 불가하여 원인은 합리적 경합 가설 (UNKNOWN 세부 root). 동일 상세 key/Task/Assignment·ready·가시 버튼을 유한 180 RAF로 재확인하며 외부 신규 사용자 focus 우선. 기존 strict assertion과 2 RAF 후 재확인 유지. | 신규 source local/PR NOT TESTED |
| R733-001 / src/server/resources/wbs-dashboard-views-core.ts / PRODUCT P2 | [Codex comment 4319896982](https://github.com/planner77/masterGantt/pull/755#discussion_r4319896982), thread PRRT_kwDOUUB7Bc6uJFvB. WorkArea 후보를 설비ID만으로 취합하면 동일 occurrence를 가진 공정 A와 C에서 C-only WorkArea를 A 하위로 잘못 나열 가능. | 사용한 W1 membership 자체의 processId를 현재 선택한 process.id와 정확히 교집합으로 제한. #729 공통 구성 snapshot 단일 출처 유지. SQLite test에서 동일 occurrence A/C, C-only WA, equipment/control System 양쪽의 A 음성·C 양성 및 Task0/Assignment0 검증. | 신규 source local/PR NOT TESTED |
| F733-002 / tests/server/resources/issue-733-process-configuration.test.ts / FIXTURE_OBSERVABILITY / [Vitest job](https://github.com/planner77/masterGantt/actions/runs/39353259152/job/118402276422) | New test `restricts a shared-occurrence WorkArea to its exact project process through equipment and controller` threw `PublicApiError INVALID_SELECTION`, converted from the domain input validation. The fixture assigned `f.systems[2]` (MCS, layer=coordinator) as the direct equipment controller, which violates `INVALID_CONTROL_RELATION` (only layer=controller is allowed). | Replace the invalid coordinator control edge with a new ACS `layer=controller` and explicit A/C process-scoped system memberships; preserve C-only W1 and the original A negative/C positive Task0 assertions. CI gate and production algorithms unchanged. Earlier F733-001 still unverified on this Run because E2E skipped. | New corrected source local/PR NOT TESTED; Run #3038 failure remains immutable |
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
