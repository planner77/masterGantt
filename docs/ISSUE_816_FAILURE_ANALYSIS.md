# Issue #816 — PR CI 누적 실패 원장

## 2026-10-26 재실패 — Full #3315.1 / Metadata #3316.1

- **원본 Full CI** [Run 40301017370.1](https://github.com/planner77/masterGantt/actions/runs/40301017370) (2026-10-26 09:37:43~10:00:14 UTC): Head `a2c876a29c8eda35bd60e0a19a2eb7dc08dbf7c7`, base `cd010d6bcff26f10ad00c42cdf3528b851519938`, authenticated test-merge `3633e9661e87c9fe700b16bb1481038ca9932f17` (parents base/head, tree `8be54ef0c95b7231501bcfbbb3f68ee7a792a424`), source [artifact 12640581191](https://github.com/planner77/masterGantt/actions/runs/40301017370/artifacts/12640581191). Quality job121500500375 PASS, Docker job121500717893 PASS, Chromium aggregate121508153099 FAIL, QA Final121508184397 FAIL(직접 E2E 미성공 파생). Shard2 job121499884998 PASS(93 tests), shard7 job121499884941 PASS(78 tests). Shard6 job121499884827 **FAIL**(63 PASS/1 FAIL/1 SKIP/33 DID NOT RUN), 나머지 Shard1/3/4/5/8 **CANCELLED** (각 로그 확인, 별도 직접 FAIL 발견되지 않음, PASS 아님).
- **F816-002 재발/재평가:** Shard6 [원본 Job](https://github.com/planner77/masterGantt/actions/runs/40301017370/job/121499884827) `project-task-hover-tooltip.spec.ts:97:5`의 #492 Week/fullscreen/WBS/read-only에서 첫 **Week Chart Task hover**(line108) `HOVER_TARGET_NOT_HITTABLE` 5s. 이전 #3314.1의 동일 결과. 중앙 `scrollIntoView` 추가 후보는 **실패**, 해결 주장 철회. [Playwright report artifact 12640913047](https://github.com/planner77/masterGantt/actions/runs/40301017370/artifacts/12640913047)의 nested trace 및 `gantt-readiness-failure` JSON 실제 열람:
  - 4개 연속 sample 모두 동일: Task root rect **x578,y417.5,width19,height27 CSS px**, probe center **(587.5,431)**; `hover.hit=false`만 blocker, 다른 준비 조건 없음.
  - viewport **1280×720**, Gantt Chart client 745×400, actual Core & native `left=0/top=0`, Core width3536, chartWidth746; semantic/latest delivery SETTLED, api `svar-api-1`, revision40, scale Week. **중앙 정렬/늦은 scroll 단독 원인 가설은 반증**.
  - Screenshot의 파란 bar 실제 표시와 중심 `elementFromPoint` false는 함께 관측. **실제 중앙을 가로막는 topmost DOM tag/class 및 주변 구역 포인터 적중 여부는 당시 snapshot에 없어 UNKNOWN**. 직접 제품 클릭/Tooltip 장애라고 확정하지 않는다.
- **F816-003 교정 전략:** read-only `gantt-readiness.ts`의 hover 검사는 **Grid 및 넓은 Bar는 원래 중앙 실제 hit**를 그대로 요구한다. 폭 **24px 이하**의 좁은 `.wx-bar`에만 중앙+수평25%·75%(세로50/25/75%)에서 실제 `elementFromPoint`가 **해당 bar 또는 자손**을 가리키는 위치를 탐색한다. 한 곳도 실제 hit하지 않으면 기존 `HOVER_TARGET_NOT_HITTABLE`를 그대로 FAIL; 모든 샘플의 x/y/hit/topmost tag/class를 기존 failure attachment에 기록해 불투명한 실패를 없앤다. 선택된 동일 pixel을 Playwright의 **실제 `locator.hover({position})`**로 조작하고 원래 Task 이름/날짜 Tooltip, Day/Week/Fullscreen/WBS/Readonly, no-write/close 조건을 보존한다. `force`/retry/timeout/skip, synthetic tooltip, Core write, browser event fabrication 없음. 성공 시에도 중심의 미적중은 JSON `centerHit:false`로 보존하며 Task 전체 hit 문제/실사용 위험은 Owner 확인 대상이다.
- **별도 Metadata Run** [#3316.1/40301188286.1](https://github.com/planner77/masterGantt/actions/runs/40301188286) event=pull_request edited/**METADATA_ONLY** (same Head). `verify-pr-metadata-evidence.py` job121499331649 **DEFERRED** because Full #3315 당시 `in_progress`(09:39:40 UTC), exit1. Quality/E2E/Docker aggregate FAIL 및 QA Automated FAIL은 **metadata-only의 미실행/파생**, 이번 source의 신규 구현 실패가 아니다. 옛 Full PASS로 재판정하거나 CI required source를 바꾸지 않는다.
- **Cross-run matrix:** `#3314.1` F816-001 `TEST_CONTRACT` + F816-002 `UNKNOWN`; `#3315.1` F816-002 **반복 FAIL(동일 blocker)**, F816-001 수정 후 Shard3 최종 CANCELLED/해당 virtual-scroll case **NOT TESTED**. 위약 `center scroll` 가설 기각. `#3316.1` 별도 metadata-only DEFERRED. 기존 실패의 최초/취소·미실행 기록은 위 절에 보존, 새 source에서 최초 실제 PASS 전 해소 표기 금지.
- **TEST_LIFECYCLE_REVIEW:** 직접 반복 `project-task-hover-tooltip.spec.ts` **EXTEND**, 동일 source의 helper `gantt-readiness.ts` / `-state.ts` HIT 관측·재현성만 변경. #637 `projection-row-alignment.spec.ts`와 #375 `project-summary-bar-visual.spec.ts` **KEEP_UNIQUE**, virtual 34px bottom/±1px strict negative와 44px touch 불변. 영향: #492 Week 좁은 막대, Day 넓은 막대, Grid, Summary, scope/fullscreen/readonly, 5폭 E2E, 기존 readiness Unit/other Gantt U3. 실패 대체 test 삭제·timeout/retry/CI policy 약화 없음. 일반 폭 중앙 hit는 유지, 좁은 폭에서는 실제 검증된 다른 내부 좌표를 명시 사용한다.
- **로컬 synthetic control (제품 검증 아님):** headless Chromium에서 19×27 Bar 중심을 겹치는 투명 7px sibling으로 가린 통제 HTML을 대상으로 `elementFromPoint` 실행: center hit=false, 좌측25%/우측75% 실제 bar hit=true. 이는 새 probe의 필요조건 실험일 뿐 운영 SVAR2.7.3/실제 PR Head의 검증이 아니다. **로컬 실제 Node/Next/SQLite/Playwright/전체 8샤드/실기기 NOT TESTED**.
- **DOCUMENTATION_SYNC:** 누적 원장 본 절, Work Packet의 재검토·다음 검증/미확정 원인 갱신. GSC-01..12/SC의 canonical·Core·native·사용자 입력 순서 수정 없음; 제품 Task/Gantt/API/DB/Style/수치 변경0으로 DESIGN/PROJECT_UX/ARCHITECTURE/TEST_PLAN/CHANGELOG/CI 문서 N/A(기존 계약·원본 유지). 새 Head Required3·8-shard/Trusted/Owner는 새 Full 원본 성공 전 **NOT TESTED**; PR #817 OPEN/HIGH OWNER_MANAGED, release_authorized=false, MERGE_READY BLOCKED. Main 뒤처짐0, 리뷰 thread0 확인 후 새 Full CI만 시작.

Source of Truth: [PR_CI_FAILURE_TRIAGE](PR_CI_FAILURE_TRIAGE.md), [Work Packet](exec-plans/active/ISSUE_816.md). 과거 실패/취소/미실행은 후속 시도로 덮어쓰지 않는다.

## 2026-10-26 원본 및 전체 이력 (F816-001/F816-002)

- Primary [Issue #816](https://github.com/planner77/masterGantt/issues/816) / [PR #817](https://github.com/planner77/masterGantt/pull/817), `pull_request` Ready `FINAL_FULL`, branch `feat/issue-816-gantt-row-density`. 확인된 연결 Full PR CI는 아래 **1회/1attempt**이며 별도 Fast #130.1은 SKIPPED; 기존 누적 원장 없어서 첫 작성.
- [원본 Full CI #3314.1, Run 40284101069 / Attempt 1](https://github.com/planner77/masterGantt/actions/runs/40284101069) (2026-10-26 07:09:53~07:32:41 UTC), **FAIL**. Head `ced5fbf3ef99ba4f3d52bfeed2fc84e87b4e53c4`, base `cd010d6bcff26f10ad00c42cdf3528b851519938`, test merge `46426d99588d037637bef1d97a27e4efcead09e2` (parents base/head, tree `d00447aff59f692357685a238c6cf4d386926785`). [원본 source artifact](https://github.com/planner77/masterGantt/actions/runs/40284101069/artifacts/12632684852).
- Main↔branch 비교: ahead 2 / behind 0 / `mergeable=true` (원본 분석 시점). 미해결 Codex P2 review 1건 [#4374759680](https://github.com/planner77/masterGantt/pull/817#discussion_r4374759680)·GraphQL thread `PRRT_kwDOUUB7Bc6wKoAZ` 발견. 작업 후 재검사 필요.

| 원본 실행 | 직접 실패 | Required Quality/Docker | Required E2E/QA Automated | 분류 |
| --- | --- | --- | --- | --- |
| `40284101069.1` | F816-001 Shard3 FAIL; F816-002 Shard6 최종 CANCELLED이나 내부 실제 FAIL | PASS/PASS | FAIL / FAIL(파생) | TEST_CONTRACT / UNKNOWN(hit) |

### 모든 E2E Shard별 실제 결과

| Shard · Job ID | 최종 Job | 실제 테스트·원본 근거 |
| --- | --- | --- |
| [3/8 · 121444542220](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121444542220) | FAIL | **98 PASS/1 FAIL/1 SKIP/42 DID NOT RUN**, [Playwright report](https://github.com/planner77/masterGantt/actions/runs/40284101069/artifacts/12634058353), F816-001 |
| [6/8 · 121444542208](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121444542208) | **CANCELLED** | 내부 step에서 **63 PASS/1 FAIL/1 SKIP/33 DID NOT RUN** 확인, F816-002; [timing artifact](https://github.com/planner77/masterGantt/actions/runs/40284101069/artifacts/12633878924). 최종 취소를 PASS로 변경하지 않음 |
| 1/8 · 121444542331, 2/8 · 121444542186, 4/8 · 121444542227, 5/8 · 121444542243, 7/8 · 121444542439, 8/8 · 121444542234 | CANCELLED | 접근한 각 Job 로그상 추가 직접 assertion FAIL 미발견. 일부 실행 완료가 있었더라도 해당 Job 전체 PASS 아님 |
| [Required Quality 121445157171](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121445157171), [Docker 121445317198](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121445317198) | PASS/PASS | 원본 exact Head의 typecheck/lint/unit/policy/build·Docker smoke 성공 |
| [E2E aggregate 121450933831](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121450933831), [QA Automated 121450970008](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121450970008) | FAIL/FAIL | 집계는 shard fail/cancel의 **파생**. QA는 `NEED_E2E=failure`로 **파생 실패**, independent QA NOT TESTED·Manager ACCEPT 없음 |

### F816-001 — Shard3 #637 고정 스크롤 지시가 실제 최대 범위 초과

- **원본 직접 에러:** 2026-10-26 07:31:48 UTC, `tests/e2e/projection-row-alignment.spec.ts:82:42` Day, 실패 line110. `expect.poll(coreTop).toBe(2400)`, 실제 `2287`, 5초. [Job 원본 로그](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121444542220). 80 synthetic + 기존 visible 총83행이 34px × 83 = 2822px가 되어, 1440×900 사용 가능 Y scroll은 2400보다 짧다. 브라우저가 허용 최대 위치로 clamp한 사실과 합치한다.
- **판정:** `TEST_CONTRACT` 직접 확정. 이 실패만으로 실제 Grid↔Chart Y 중심 오류, virtualized Task 누락이나 제품 bar hit 악화를 증명하지 못한다. 후속 assertion 미도달을 PASS로 계산하지 않는다.
- **보완:** `.wx-gantt.scrollHeight-clientHeight`를 실제 브라우저에서 읽고 `[300,1200,maxTop,0]`를 검사, `maxTop>1200`을 강제하여 깊은 가상행 구간 검증을 남긴다. `native-scroll-virtual-budget` JSON 첨부. Grid X=120, Core/owner/chart scrollTop 정확동일, virtual mounted ID·bar pairs·Grid Y0/±1px/strict negative/recovery 단언은 그대로. Codex P2 review와 동일 원인 교정.

### F816-002 — CANCELLED Shard6 #492 내부 Hover 실제 실패

- **원본 직접 에러:** 2026-10-26 07:32:01 UTC, `tests/e2e/project-task-hover-tooltip.spec.ts:89` 시나리오의 line100 **첫 Chart bar hover**에서 `waitForGanttReadiness`가 5초 동안 `HOVER_TARGET_NOT_HITTABLE`만 반환. [Job 로그](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121444542208). 첫 번째 동일 Grid+Chart canonical 툴팁 case는 Shard6에서 PASS였다. 이 실패는 Shard3 집계 파생이 아니라 **Shard6 자체 실제 단언 실패**다.
- **판정:** `UNKNOWN`(실제 제품 hit rectangle/overlay 또는 테스트 준비 시 native 위치 경합). `elementFromPoint`의 실제 occluder identity·좌표 trace가 최종 cancel로 보존되지 않았으므로 확정된 근본 원인으로 '제품'/'flaky'를 단정하지 않는다.
- **제한적 보완/검증 후보:** Chart bar에만 최초 `scrollIntoViewIfNeeded` 다음 **한 번** `scrollIntoView({block:"center",inline:"center"})` 배치하여 중앙에서 실제 bar hit를 검사하는 fixture prep을 추가. 기존 real `elementFromPoint`/U3/3RAF/native scroll settlement, `hover()`·canonical Tooltip contents, Week/Fullscreen/WBS/readonly/close·mutation0 검증은 그대로이며 retry/skip/assertion/timeout 완화 없음. 새 정확 Head Chromium 통과 전 F816-002 **해결 미확정**; 재발 시 non-cancelled trace·occluder hit-test 확보해 별도 제품 보완 판단.

## 종합 진단 / 선택 테스트 / 문서·다음 게이트

- **A→C:** 원본 Full PR 1건과 Fast skipped, 모든 8개 Shard 실제 Job logs, 독립 Quality/Docker·E2E 집계·QA 파생과 한 개 P2 리뷰를 대조. F816-001은 새 cellHeight와 이전 2400 상수의 테스트 계약 충돌, F816-002는 별개의 실제 Hover blocker(원인 UNKNOWN)로 분리. 앞선 historical #637 38px/31px 및 #667 tooltip history를 이번 source PASS로 재사용하지 않는다.
- **D/E/TEST_LIFECYCLE_REVIEW:** 원래 실패 2개 spec **EXTEND**. #375 `project-summary-bar-visual.spec.ts`의 Summary 비율/조작/터치, #637 strict negative·virtual/selection, #492 canonical·hit·close 및 독립 Editor/Drag/Resize/Focus의 KEEP_UNIQUE 경계 유지. 새 test 폐기/skip/timeout/retry/CI shard 설정 변경0. 기존 #816 AC1/3/4 수용 여부는 다음 실제 E2E 필요.
- **F:** 원본 Required Quality/Docker만 원래 Head PASS. 새 수정 source 로컬 실행 환경 접근 불가: TypeScript/Vitest/Next/Playwright/Chromium/SQLite/실기기 **NOT TESTED**. 새 CI와 QA/Owner가 이전 결과를 대체했다고 선언하지 않는다.
- **G:** 본 이슈별 누적 원장, [Work Packet](exec-plans/active/ISSUE_816.md), [active PLAN](exec-plans/active/PLAN.md) 및 두 E2E spec 갱신. `docs/TEST_PLAN.md` 및 `docs/PROJECT_UX.md`의 기존 #816 공식 제품·AC 계약은 변경 없음. 리뷰 P2 응답·resolve 및 main 충돌 확인 후 수정 Head로 Ready Full PR CI를 새로 시작한다. 새 Run/Attempt·HEAD 확인만 하고 **지속 모니터링·병합/Main/GHCR/Finalizer/Issue 종료 금지**.
- risk_level `HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=true`, `release_authorized=false`, `MERGE_READY=BLOCKED`. F816-002 occlusion 미확정, 실제 before/after px·native touch/125%/Chrome Full·Trusted/Owner QA 미검증을 잔여 위험으로 보존한다.
