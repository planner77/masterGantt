# Issue #816 — PR CI 누적 실패 원장

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
