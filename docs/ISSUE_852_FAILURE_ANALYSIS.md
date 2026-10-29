# Issue #852 — Gantt 탐색 회귀·누적 실패 원장

Primary Issue: https://github.com/planner77/masterGantt/issues/852
기준 main: `de36ff9f3192f47f79a67f8fccc617df9bd024dd`, application `0.138.1`, SVAR Core `2.7.3`.
branch: `fix/issue-852-gantt-navigation`; 후보 application `0.138.2`.
Source of truth: [PR CI 실패 지침](PR_CI_FAILURE_TRIAGE.md), [Work Packet](exec-plans/active/ISSUE_852.md).

사용자 요청에 따라 첫 PR CI 이전부터 로컬 재현·환경 실패를 기록한다. 로컬 실패를 GitHub PR Run 실패로 계산하지 않는다. #367/#514/#571/#666/#667 및 타 Issue CI 실패는 이 Issue의 독립 실패 횟수에 합산하지 않는다.

## 1. 원격 Run/Attempt 전체 목록

### 원격 PR #853 두 번째 Full 실행 — #3403.1

| PR/Workflow | Run/Attempt | Head/Base/Test Merge | 원본 Job 결과 |
| --- | --- | --- | --- |
| [#853](https://github.com/planner77/masterGantt/pull/853) pull_request FINAL_FULL | [#3403.1 · 40849080627.1](https://github.com/planner77/masterGantt/actions/runs/40849080627), 2026-10-29 09:22~09:46 UTC | `34c30ae5ef170152bd394c224dbb007f90f5b1e3` / `de36ff9f3192f47f79a67f8fccc617df9bd024dd` / `3f91cbc11abd73255abc32b9a45ac7c8caf37e9e` | E2E Shard5 direct FAIL; Shard1/7 SUCCESS, 2/3/4/6/8 CANCELLED. Quality/Docker SUCCESS. Aggregate E2E/QA Final derivative FAIL |
| #853 FAST_DEVELOPMENT non-authoritative | [#198.1 · 40849080408.1](https://github.com/planner77/masterGantt/actions/runs/40849080408) | same Head | SKIPPED (not Full PASS) |

### 원격 PR #853 첫 Full 실행 — #3402.1 (실제 확인 2026-10-29)

| PR/워크플로 | Run/Attempt · 출처 | Head / Base / Test merge | 원본 결과 |
| --- | --- | --- | --- |
| [#853](https://github.com/planner77/masterGantt/pull/853) · Full CI `pull_request` | [#3402.1 · 40844744482.1](https://github.com/planner77/masterGantt/actions/runs/40844744482), 2026-10-29 08:50~08:53 UTC | Head `72ddbb2349cb26f5a571f3f5469cad8070403ff0`; base `de36ff9f3192f47f79a67f8fccc617df9bd024dd`; test merge `53ee1d2a34224146aeae5b5824feade263af0132` | **E2E shard 3 직접 FAIL 1**; 16 PASS·132 NOT RUN; shard 1/2/4/5/6/7/8 CANCELLED; Quality·Docker PASS; E2E aggregate·QA Final 파생 FAIL |
| #853 · FAST_DEVELOPMENT non-authoritative | [#197.1 · 40844744461.1](https://github.com/planner77/masterGantt/actions/runs/40844744461) · same Head | 동일 Head, 실제 구현 검증 미수행 | SKIPPED, Full PASS 아님 |

아래의 기존 “PR CI 시작 전” 서술은 원본 초안 작성 **당시**의 역사 기록이다. 현재 원격 관측은 위 표 및 F852-CI-001을 우선한다. 접근 가능한 동일 Head의 Full 실행은 #3402.1 1건이며 다른 원격 실패 attempt는 확인되지 않았다.



착수 시 #852는 OPEN, 댓글0·연결 PR 없음이며 열린 PR 목록에도 #852 구현 PR이 없었다. 이 Issue의 PR CI는 아직 시작하지 않았으므로 Run/Attempt/Head/Base/Test merge 및 Required3는 NOT TESTED다. 조회하지 않은 로그를 성공으로 해석하지 않는다. CI 시작 후 생성된 실제 Run URL을 Issue 인계 댓글에 기록하며 이 요청에서는 결과를 모니터링하지 않는다.

## 2. 누적 실패 파일 및 Cross-run 매트릭스

| 실패 ID | 환경·파일·case | 원본 실제 결과 | 분류·원인 판단 | 보완·최종 source 검증 |
| --- | --- | --- | --- | --- |
| F852-CI-002 · PR #853 #3403.1 Shard5 | `resource-plan-dashboard.spec.ts:320 / setup:109` #527 | 5000ms `X>0 && Y===96 && Core/DOM X/Y equal` false; 103PASS/1FAIL/4 NOT RUN | TEST_CONTRACT: #852 aligned-left Grid selection need not produce X>0; vertical96 written before actual TASK_REVEAL settled. Which axis false is UNKNOWN (one bool). Prior #527 sibling case PASS | #527/#526 shared selector+receipt helper, native wheel if X=0, retain strict Y96/Core/native and roundtrip; new HEAD NOT TESTED |
| F852-CI-001 · PR #853 #3402.1, Shard3 | `tests/e2e/grid-task-start-reveal.spec.ts:396/408`, Week fullscreen nested 후 null Summary | `afterNested.startVisible` expected true / actual false; 16PASS·1FAIL·132NOT RUN | TEST_CONTRACT; 고정 8 RAF 시점에 `TASK_REVEAL`이 `WAIT_GEOMETRY`, 이어서 원본 증거에 실제 left=5984와 `SETTLED` 확인. F852-TEST-002와 동일 비동기 완료 가정의 남은 소비자 | 기존 Grid E2E의 실제 `TASK_REVEAL SETTLED` + start 좌측 정렬 ±1px + Core/native 일치 poll; 동일 source 원격 재검증은 다음 Full에서 NOT TESTED |
| F852-ENV-001 | `gh issue view 852` 및 git push dry-run | HTTP401 Bad credentials / Invalid username or token | ENVIRONMENT; 로컬 GitHub 자격증명 실패 | 연결된 GitHub 도구로 읽기/게시; 토큰 복사·권한 확대 없음 |
| F852-LOCAL-001 | `grid-task-start-reveal.spec.ts` 신규 visible-right alignment Day·Week | 시작점 Chart 상대 X452px 유지, expected≤1px; 두 case FAIL | PRODUCT; 기존 가시성-only 정책은 화면 내부 오른쪽의 좌측 배치를 검증하지 못함 | 최종 Day/Week 실제bar452→0px 및23case PASS |
| F852-LOCAL-002 | 같은 E2E의 새 확장 끝까지 연속 wheel 후 무입력 대기 Week | 실제 width4148px에서 정지, expected>4148px; 기존5초 poll FAIL | PRODUCT; 확장 중 새 edge 입력 후 재예약 누락 가설을 제한 trace로 재검증 | 최종23case와3case×3반복9 PASS; 원래FAIL·동일sourcePASS 보존 |
| F852-LOCAL-003 | 같은 E2E의 nested 마지막 Task 정렬 | 시작점 x21960px, 실제 capacity21163px; NO_SCROLL_CAPACITY | PRODUCT; 가시성-only보다 더 큰 좌측 정렬 capacity 필요 | 같은 TASK_REVEAL lease의 기존 extent transaction 준비로 보완;8행렬 포함 최종23case PASS |
| F852-LOCAL-004 | Week nested reveal 준비의 retained end | 실제 폭6664→7004에도 준비 TIMED_OUT,5초 poll FAIL | PRODUCT; 승인·정착 전 요청 end를 retained end에 선반영하여 실제 범위와 혼동 | 선반영을 제거하고 실제 Core recordEnd만 보존; 좁은4case PASS16.2초는 이후 최종 동결과 별도 |
| F852-TEST-001 | sparse fixture 초기 구성 | 공유 fixture의 tasks[2] 참조 준비 실패 | FIXTURE_OBSERVABILITY; 희소 일정도 공유 fixture 최소3개 행 필요 | 미래 Task 없는 과거3개 Task로 구성; 제품 실패와 구별 |
| F852-TEST-002 | 비동기 reveal 이후 고정8RAF 관측·Week visibleRight 준비 | 중간23case 실행22PASS/1FAIL88초; wheel 전 최초 reveal 미완료로 visibleRight 전제 불성립 | TEST_CONTRACT; 동기 Core show 대신 실제 Coordinator 완료 관측 필요 | 기존5초 poll 안에서 실제 TASK_REVEAL SETTLED를 기다리고 최종 좌표·보존 단언 유지; 제품 수정 없음 |

누적 실제 실패 파일 합집합: `tests/e2e/grid-task-start-reveal.spec.ts`. 환경 인증 실패는 제품 테스트 실패와 구별한다. 기존 #514 readonly/day/normal은 18.9초 PASS했으나 새 좌측 배치 AC의 PASS 근거는 아니다. 초기 long-future fixture의 native wheel Day/Week 반복3회는 PASS였으며 우측 확장 사용자 보고의 원인 확인 또는 복구 성공으로 확대하지 않는다.

## 3. 개별 실패 사건

### F852-ENV-001 — 로컬 GitHub 인증

- `gh issue view 852 --json number,title,body,url,comments`가 `HTTP 401: Bad credentials`로 종료했다. `git push --dry-run origin HEAD:refs/heads/fix/issue-852-gantt-navigation`도 인증에 실패했다. 원격 main의 공개 fetch는 성공했다.
- GitHub 연결 도구의 Issue/PR 읽기 및 Issue PLAN/STATUS 쓰기는 성공했다. 원본/교정 커밋은 연결 도구로 게시하고 로컬 tree와 비교한다. 자격증명 원문·설정·PAT를 출력하거나 Git에 저장하지 않는다.

### F852-LOCAL-001 — 화면 내부 오른쪽 시작점 미정렬

- 설치 Core2.7.3 실제 Chromium의 Day/Week에서 Grid 일반 클릭 후 시작점이 Chart edge에서452px에 남아 새 expected≤1px 단언이 실패했다. 기존 기본 #514 case PASS와 별개다.
- 순위 가설: 일반 Grid click이 Core 가시성 reveal만 사용하거나 app 선택 branch에서 reveal을 생략; 요청 axis와 실제 geometry 차이; async lease/dataReady 취소. 각각 이벤트·실제 Core/native 좌표·coordinator outcome으로 구별한다.
- 소스 변경 전 기존 테스트 seam을 확장했으며 expectation을 실제 요청 동작인 좌측 배치로 강화한다. Context Menu `show:false`, modifier/keyboard/null start·peer 보호는 삭제하지 않는다.
- 중간 구현에서 native 선택 억제 표식을 microtask에 지우면 Core EventBus의 비동기 native 선택이 뒤늦게 처리되어452px 실패가 반복되었다. 같은 클릭의 native 선택이 실제 소비될 때 표식을 지우고 새 pointer/wheel/keydown·외부 explicit reveal에서는 취소하도록 보완한다. 이 중간 실패를 최종 PASS로 덮어쓰지 않는다.

### F852-LOCAL-002 — 확장 중 새 edge 입력의 재예약 누락

- sparse fixture의 기본3회 및 확장 중단 뒤 별도 wheel3회는 Day/Week 모두 PASS였다. 이는 사용자가 새로 확장된 끝에 이미 도착했는데 다음 입력이 없는 정지 상태를 검증하지 않았다.
- actual resize를 수행한 후 observation RAF를 테스트에서 제한적으로 보류하고, 실제 native wheel로 새 물리 edge까지 이동한 뒤 모든 보류 callback을 해제했다. 추가 wheel 없이 미래 폭 증가를 기다리는 Week 강화 검사에서4148px로 정지하여 기존5초 poll이 FAIL했다. Day의 같은 통제 검사는 PASS였다.
- 통제 RAF gate는 테스트 전용이고 실제 Core/DOM·native wheel 경로를 사용한다. 제품 timeout/retry를 늘리거나 강제 성공 영수증으로 바꾸지 않는다. 정확한 재현 반복·원인·보완·최종 source 결과는 추가 기록한다.
- 동일 source의 직후 재실행은 PASS였다. 한 번의 FAIL과 비재현 PASS를 모두 보존하며 결정론적 재현이라고 표시하지 않는다. 최종 교정 검증은 같은 race 경계와 기본 반복 확장 및 stale 입력 음성을 포함한다.

### F852-LOCAL-003 — 마지막 Task의 시작점 정렬 capacity

- 새 좌측 정렬은 기존 단순 가시성보다 큰 수평 capacity가 필요하다. nested 마지막 Task의 `$x=21960`에 대해 capacity21163으로 `NO_SCROLL_CAPACITY`가 확인됐다.
- 기존 `TASK_REVEAL` 준비 단계에서 같은 explicit lease로 기존 Axis Transaction을 수행한 다음 projection/geometry를 재관측한다. 별도 RANGE 요청이나 DOM scroll writer를 만들지 않으며 null start와 오래된 gesture는 별도 음성 검증한다.

### F852-LOCAL-004 — 요청 end의 낙관적 선반영

- `expandTimelineScale`이 Coordinator 승인·정착 전에 계산한 요청 end를 `timelineEndReference`에 저장했다. 취소되거나 실제 end와 다른 요청을 확보된 범위처럼 취급하면서 Week nested reveal 준비가 실제 폭6664→7004 증가 후에도 TIMED_OUT했다.
- 요청 end 선반영을 제거하고 기존 `recordTimelineEnd`가 읽은 실제 Core end만 단조 보존한다. 요청 width와 완료 증거를 구분하며 timeout/receipt/capacity 검증을 완화하지 않는다.
- 교정 뒤 같은 Week nested와 peer/filter pending3case의 좁은4case가16.2초 PASS했다. 비동기 Coordinator의 실제 완료를 기다린 뒤 위치 보존을 검사하며 예전 Core 동기 show를 가정한 고정8RAF만으로 완료를 추정하지 않는다. 최종 source 동결 후 다시 확인한다.

### F852-TEST-001/002 — fixture·완료 관측 보완

- sparse 최초 fixture의 공유 `tasks[2]` 접근 실패는 과거 Task3개로 교정했다. 제품 Task 날짜를 미래로 늘려 회귀를 가리지 않았다.
- 기존8개 행렬/peer 중간 관측과 신규 Week visibleRight 준비는 고정8RAF를 실제 완료로 가정했다. Coordinator의 비동기 선택·capacity 준비 이후 해당 시나리오의 실제 완료/시작 가시성을 기다린 다음 원래 strict 좌표·입력 우선·mutation0 단언을 수행한다.
- 최종 준비 중23case 중22PASS/1FAIL88초의 실패는 Week visibleRight를 만들기 전 첫 reveal 완료를 기다리지 않은 전제 오류였다. 제품 소스는 유지하고 기존5초 poll로 첫 TASK_REVEAL SETTLED를 확인한다. timeout/retries/skip/최종 좌측 정렬 허용치를 확대하지 않는다.
- Manager의 원격 게시 tree 사전 대조는 최초 로컬 Git blob 객체 미등록으로 `invalid object`를 반환했다. 제품/test 실패와 구별하며 해당 로컬 파일을 `git hash-object -w`로 등록한 뒤 임시 index tree와 원격 API tree가 정확히 `e33434efc7f9bf8493757f3658f7d1a945c332e9`로 일치함을 확인했다. 원격 branch/PR은 이 사전 대조 실패로 변경하지 않았다.

## 4. 전 이력 종합 진단·검증 범위

- 직접: 일반 Grid 선택→TASK_REVEAL→port/target, scroll/resize→RANGE_EXTENSION→Axis Transaction의 실제 Core/native 정착.
- 인접: Day/Week 전환·동일 인스턴스·readonly/editable·root/nested·scope/filter/fullscreen·peer 왕복.
- 음성: Context Menu `show:false`, modifier/checkbox/keyboard·Editor locate·null canonical start·최신 사용자 gesture 우선·서버 mutation0.
- 실제 로컬 단위/Chromium 명령·case 수·시간·source fingerprint는 최종 동결 후 추가한다. 전체 Vitest/E2E/Docker를 반복하지 않으며 원격 Full Quality/E2E8/Docker와 Trusted QA는 별도 NOT TESTED다.

## 5. 같은 최종 source 검증·리뷰·PR CI 인계

최종 로컬 결과: 관련4 Unit파일194/194 PASS, Grid spec23/23 PASS 약1.3분, 연속 wheel·새 선택3case×repeat3=9/9 PASS31.0초, typecheck PASS, 관련 ESLint 오류0/기존Hook 경고3개, diff check PASS. 그 이전22case 실행은15PASS/7FAIL로 Week nested4개와 비동기 완료 관측을 놓친 peer3개였다. 첫23case의22PASS/1FAIL88초와 모두 구별한다. 원래 실패는 소급 PASS하지 않는다.

실제 명령:

```bash
npm test -- tests/features/gantt/svar-viewport-port.test.ts tests/features/gantt/timeline-range.test.ts tests/features/gantt/viewport-coordinator.test.ts tests/features/gantt/axis-transaction.test.ts
CAPTURE_ISSUE_514=issue852-final npm run test:e2e -- tests/e2e/grid-task-start-reveal.spec.ts
CAPTURE_ISSUE_514=issue852-repeat npm run test:e2e -- --grep '#852.*continuous' --repeat-each=3
npx eslint src/features/gantt/project-gantt.tsx src/features/gantt/viewport/svar-viewport-port.ts src/features/gantt/viewport/task-reveal-target.ts src/features/gantt/viewport/viewport-coordinator.ts tests/features/gantt/svar-viewport-port.test.ts tests/e2e/grid-task-start-reveal.spec.ts
npm run typecheck
node scripts/check-markdown-links.mjs
```

[정제 manifest](evidence/issue-852/manifest.json)에 제품4개·테스트2개의 동결SHA256 및 원본/최종 관측을 저장했다. 최종specSHA256은 `f0810b25f833ddc002b8be49a1ff3bc1b5fa56bb5789ece7bcdb9f3fe499670a`다. Day Core/native20248→20700·Week5192→5644, actualbar452→0px/같은instance를 확인했다. 스크린샷은 같은 후보의 클릭 전/후이며 원본 제품RED screenshot이 아니다. `burst-day.json`은 마지막 override=true 음성case가 덮어쓴 결과라 일반Day양성 근거로 쓰지 않는다. 일반 양성은 `wheel-day/week`을 사용하고 새 선택은 `wheel-superseded`로 구분한다. repeat폴더는 마지막 반복만 남으며9회 실행 수는 CLI 결과다. raw trace·HTML report·runtime DB는 Git에 넣지 않는다.

별도 `/root/review`의 사전 검토 PASS/미해결 차단지적0, 독립 관련Unit194PASS 및6개source지문 대조 완료. QA_FINAL/인간 GitHub APPROVED/Owner ACCEPT는 아니다. Next가 만든 AGENTS/next-env 변경은 복원하여 최종diff0이고 제품/test지문은 유지했다. Markdown376파일 링크 및 docs_gate의 DOC_SYNC/AC1~10 구조PASS는 의미/원격 검증PASS를 대체하지 않는다.

최신main은 기준 `de36ff9f3192f47f79a67f8fccc617df9bd024dd`와 같고 사전 충돌0이다. 원격 PR 생성 후 review thread·mergeability·testmerge와 CI 시작을 확인해 Issue에 인계한다. 새 Head Required3/Trusted QA·Owner HIGH위험 수용/Manager ACCEPT는 NOT TESTED다. 실제운영/HTTP SQLite·Shift-wheel/scrollbar drag/touch 동일경합도 NOT TESTED이며 병합·main/GHCR·Release·Issue 종료는 범위 밖이다.

## 6. F852-CI-001 — PR #853 Full #3402.1 단일 직접 실패 및 REWORK #1 (2026-10-29)

### 불변 원본/귀속

- [Run 40844744482 attempt 1](https://github.com/planner77/masterGantt/actions/runs/40844744482), `pull_request` FINAL_FULL #3402.1, HEAD `72ddbb2349cb26f5a571f3f5469cad8070403ff0`, base `de36ff9f3192f47f79a67f8fccc617df9bd024dd`, test merge `53ee1d2a34224146aeae5b5824feade263af0132`, branch `fix/issue-852-gantt-navigation`, app `0.138.2` candidate / Core2.7.3 / Chromium.
- **직접 FAIL:** [Chromium shard3 Job 123350462098](https://github.com/planner77/masterGantt/actions/runs/40844744482/job/123350462098), `tests/e2e/grid-task-start-reveal.spec.ts:396` case `#514 before Week fullscreen nested reveal and null Summary selection`, line408 `expect.soft(afterNested.startVisible).toBe(true)` → `Received: false`. 149건 중 16 PASS·1 FAIL·132 NOT RUN (`--max-failures=1`). `GitCommitInfo` fetch 3초 warning은 별도 보조 Git origin 네트워크 측정이며 이 assertion 실패의 직접 원인으로 확인되지 않았다.
- **다른 7개 실제 E2E:** shard1 `123350462116`, shard2 `123350462142`, shard4 `123350462046`, shard5 `123350462152`, shard6 `123350462122`, shard7 `123350462091`, shard8 `123350462071` 모두 CANCELLED. 그 실행 내부 이미 수행된 독립 실패는 이번 수집 범위에서 확인되지 않았으나 CANCELLED를 PASS로 판정하지 않는다.
- **Required 구현/집계:** Quality `123351083476` SUCCESS (Policy/TypeScript/ESLint/Vitest/Build 포함), Docker `123351612742` SUCCESS, E2E aggregate `123351404080` FAILURE(Shard3에서 파생), QA Final Automated `123351646203` FAILURE(Required E2E 실패에서 파생, independent QA NOT TESTED). QA Preflight `123349512829` SUCCESS. 별도 FAST `40844744461.1`은 SKIPPED.
- **원본 증거:** [Shard3 Job 로그](https://github.com/planner77/masterGantt/actions/runs/40844744482/job/123350462098), [Playwright report+Trace](https://github.com/planner77/masterGantt/actions/runs/40844744482/artifacts/12884418890). 대용량 raw trace/로그/DB/민감정보는 저장소에 복사하지 않고 아래 정제 수치만 기록한다.

### 원인 교차 검증 — 기존 F852-TEST-002의 미보완 소비자

원본 Chromium 첨부 `week-nested-null-reveal`(같은 **실패 CI attempt** 내 before/after)에서:
1. Nested 선택 직후 **고정 8 RAF 종료 시점**: `afterNested.startX=5984`, Core/native left `0/0`, `startVisible=false`. Axis Transaction 자체는 width `7004`, physical horizontal capacity `6075`로 `SETTLED`; 그러나 선택 `TASK_REVEAL`은 아직 `WAIT_GEOMETRY` 단계다.
2. **같은 테스트의 다음 관측(beforeEmpty)**: null Summary 클릭 **전** Core/native left `5984/5984`가 되어 실제 중첩 Task의 시작 좌측 정렬이 이뤄진다. `afterEmpty` history에는 이 nested reveal의 `SETTLED` 영수증과 null Summary reveal의 `SETTLED` 영수증이 둘 다 있다. null Summary 이후에도 left `5984/5984` 유지.
3. 따라서 원본 **제품의 영구적인 시작점 이동 실패는 관측되지 않았다**. 새 같은-lease 축 확장/영수증 정착은 동기 Core show보다 여러 프레임 소요되는데, 과거 #514 테스트가 임의 `8*requestAnimationFrame`만으로 완료 판정한 **TEST_CONTRACT** 직접 실패다. 초기 F852-LOCAL-003/004의 제품 준비 보완은 그대로 유지된다. F852-TEST-002에서 이미 일부 시나리오를 실제 완료 poll로 교정했으나 이 오래된 fullscreen consumer가 남아 있었다는 커버리지 결손이다.

### 제한 교정·불변 계약·검증 경계

- 유일한 실행 소스 수정은 `tests/e2e/grid-task-start-reveal.spec.ts` (`TEST_LIFECYCLE_REVIEW: EXTEND`). 실제 Coordinator history의 **최신 `TASK_REVEAL` 결과 `SETTLED`**와 실제 Core/native 일치 ±1px, 날짜 시작점이 Chart 왼쪽 ±1px에 보이는지를 기존 Playwright `expect.poll` **기본 제한 내** 관측하는 공통 helper를 추가한다. 결과가 끝내 정착하지 않으면 기존보다 강화된 assertion으로 실패한다.
- 직접 문제인 Week/fullscreen/nested뿐 아니라 같은 fixed-frame 전제를 가진 #514 editable 이름 클릭, 과거/미래/긴 Task 양방향 reveal 및 Context Menu 후 일반 선택도 해당 helper로 변경한다. **null canonical start** 선택에서는 기존 무이동 strict `beforeEmpty/afterEmpty` 비교를 보존한다. #852 Day/Week 3회 연속 확장·선택 우선권·상세 Grid matrix와 #514 modifier/keyboard/peer/filter 음성 검증은 유지한다.
- 없음: 제품/API/SQLite/세션/권한, SVAR/Coordinator/Axis Transaction 로직 변경, UI 스타일/공통 DESIGN 및 AGENTS 원칙 변경, CI/shard/timeout/retry/skip/느슨한 assertion 변경.
- 정적 원격 source 감사를 통해 원본 spec blob `7b643dcd6e784eed49a811d850c3439a75c07f4a`에서 수정 spec blob `f00b810f16fedbf244249b3cdc643cc7386c4e49`으로 변경 확인. 이 연결 환경에서는 실제 Node/Playwright repo checkout 및 browser 실행이 확인되지 않았으므로 **수정 후 로컬 typecheck/Unit/Chromium = NOT TESTED**. 이전 로컬23/23·194/194와 최초 Full Quality/Docker PASS는 **이 새 후보의 결과가 아니다**. 동일 새 Head의 Full Quality/E2E8/Docker, Trusted QA, Owner 위험 수용은 후속 원격 실행 전 **NOT TESTED**; 결과 모니터링은 요청 범위 밖.
- **리뷰/충돌(교정 직전):** PR #853 미해결 inline review thread **0** / 원본 Codex Code Review `72ddbb2` no findings(새 후보 재리뷰로 자동 승격 금지). branch 대비 main **behind=0**, PR mergeable=true, base `de36ff9`; 현재 관측에서 충돌 없음. 새 HEAD의 리뷰/strict-main 및 병합 gate는 실제 재확인해야 한다. OWNER_MANAGED는 Required3/Trusted QA/Owner HIGH 위험 수용을 면제하지 않는다.
- **다음 조치:** 같은 PR branch에 이 단일 보완·불변 실패 원장·Work Packet·PLAN을 동기 커밋하고 새로운 Ready Full CI를 **시작만** 한다. 새 Run ID/Attempt/HEAD는 PR #853 인계 댓글에서 연결하며 이 실패 이력은 보존한다. GHCR/병합/Main/Issue 종료는 금지; `MERGE_READY=BLOCKED`, `release_authorized=false`.

## 7. F852-CI-002 — PR #853 #3403.1 직접/파생·교차 실패 및 REWORK #2 (2026-10-29)

- **원본 귀속:** [Run 40849080627 attempt1](https://github.com/planner77/masterGantt/actions/runs/40849080627), Ready pull_request FINAL_FULL #3403.1, Head `34c30ae5ef170152bd394c224dbb007f90f5b1e3`, Base `de36ff9f3192f47f79a67f8fccc617df9bd024dd`, Test Merge `3f91cbc11abd73255abc32b9a45ac7c8caf37e9e`, branch `fix/issue-852-gantt-navigation`, app candidate0.138.2/Core2.7.3. Historical #3402.1/F852-CI-001 and original F852-LOCAL/TEST items above remain unchanged.
- **Direct FAIL:** Shard5 [Job 123364915884](https://github.com/planner77/masterGantt/actions/runs/40849080627/job/123364915884), `tests/e2e/resource-plan-dashboard.spec.ts:320` #527 selected80/project140 parent warning, detail stack and paging focus → shared `setup:109`: `expect.poll(...).toBe(true)` Expected true/Received false, Timeout5000ms. Assertion is four-way AND: native horizontal >0, native vertical exactly96, public.left identical native.left, public.top identical native.top. Shard5 **103PASS/1FAIL/4 NOT RUN**, preceding #527 Week/Month 20geometry case PASS. [Playwright report + Trace #12887129684](https://github.com/planner77/masterGantt/actions/runs/40849080627/artifacts/12887129684) inspected; selected Week Stable leaf visible, but **which condition failed is UNKNOWN** because original boolean/trace did not record individual numbers. Do not claim confirmed product bug or flaky timing.
- **Jobs:** Quality Required aggregate `123365509916` SUCCESS; Docker `123366082631` SUCCESS; E2E Shard1 `123364915957` SUCCESS/123PASS, Shard7 `123364915862` SUCCESS; Shard2 `123364915877`, Shard3 `123364916087`, Shard4 `123364916039`, Shard6 `123364916003`, Shard8 `123364916280` all CANCELLED (partial PASS is not final shard PASS; inspected canceled logs no additional direct FAIL). E2E aggregate `123374415053` FAILURE; QA Final `123374455150` FAILURE: required E2E derivative; QA Preflight `123363891323` SUCCESS. FAST #198.1 SKIPPED. Previous #514 `grid-task-start-reveal.spec.ts` belongs to Shard3 here and **was not fully tested**: REWORK #1 remote PASS cannot be claimed.
- **Cross-run analysis:** F852-CI-001 was proven early 8RAF observation during `TASK_REVEAL WAIT_GEOMETRY` with actual later Core/native SETTLED. This independent F852-CI-002 is an older #527 peer setup that silently assumes selecting any Task means `scrollLeft>0` and writes vertical `scrollTop=96` without awaiting explicit TASK_REVEAL settle. #852 already-left no-jump behavior legitimately permits X=0. A common async-consumer-contract risk exists; the exact axis that caused CI #3403 false remains UNKNOWN.
- **Fix/Test Lifecycle:** EXTEND both `tests/e2e/resource-plan-dashboard.spec.ts` (#527) and structurally identical `resource-milestone-views.spec.ts` (#526); ADD shared setup `tests/e2e/helpers/selected-peer-viewport.ts` (not duplicate E2E case). Native exact Grid Duration click and selected count 1, await latest Coordinator `TASK_REVEAL=SETTLED`; prove physical chart capacity >120; if X stays at 0, generate genuine horizontal user input `page.mouse.wheel(120,0)`, never DOM horizontal write. Only then set native vertical96, await existing canonical sync depth0 + 8 stable RAF, preserve exact Core/native vertical/horizontal and original before/after peer snapshot equality. Replace single conjunction with diagnostic object whose **all four booleans must be true**. This does not loosen assertions/timeout/retries or skip tests. #527 sticky/focus/20geometry/50row/selected vs project80/140 and #526 Milestone matrix/peer, #852 DayWeek/infinite expansion/start alignment and Context Menu, remain independent KEEP_UNIQUE.
- **Scope/uncertainty:** No product/API/DB/scheduler/security/permissions/CI policy changes or second scroll writer/remount. AGENTS/DESIGN existing source-of-truth policies unchanged. This connector environment does not supply complete locally executable repo/Playwright; **new source local tests, typecheck and new remote Required Quality/E2E8/Docker NOT TESTED**. Prior #3403 successes are from previous Head only.
- **Reviewer/merge handoff:** PR #853 before change inline unresolved thread0, main behind0/mergeable=true at `34c30ae`. New Head must be rechecked. Same PR + new CI start only; no monitoring/merge/Main/GHCR/Issue closure, `release_authorized=false`, `MERGE_READY=BLOCKED`, Trusted QA and Owner HIGH acceptance NOT TESTED.
