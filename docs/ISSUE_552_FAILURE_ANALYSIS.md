# Issue #552 / PR #561 — 연속 PR CI 실패 분석 및 재발 대응 원장

기준: 2026-10-17 · 저장소 `planner77/masterGantt` · HIGH / OWNER_MANAGED · `release_required=true` / `release_authorized=false`.

> 이 문서는 **최신 한 건만 고치는 재시도**를 막기 위한 독립 참고 자료다. 원본 GitHub Run/Attempt/HEAD, job 상태, test-level 실패와 미실행을 구분한다. [누적 JSON 실패 원장](evidence/issue-552/ci-cumulative-20261017.json), [#552 Work Packet](exec-plans/active/ISSUE_552.md), [#667 실패 분석](ISSUE_667_FAILURE_ANALYSIS.md), [#530 과거 viewport 회귀](exec-plans/active/ISSUE_530.md)와 함께 사용한다.
**공통 표준:** [PR_CI_FAILURE_TRIAGE](PR_CI_FAILURE_TRIAGE.md)와 동일한 Issue별 정규 경로 `docs/ISSUE_552_FAILURE_ANALYSIS.md`를 따른다. 다음 세션에서는 **새 파일을 만들지 않고 이 파일에 추가**한다. GitHub PR 브랜치의 PR CI 전체 Run 30개를 확인했지만, 아래 test-level 10건은 최근 실패 중 선택 검증된 합집합이며 **옛 22개 Run의 모든 실패 파일 전수 추출은 INCOMPLETE**다. `diagnose`는 당장 확인된 10파일 검증용이고 과거 전체 파일 합집합이라는 주장은 금지한다. 추가 고유 파일이 12개를 넘으면 공통 지침에 따라 합집합을 빠짐없이 분할 검증한다.


## 1. 최신 원본 — PR CI #2878.1 (증거는 수정 불가)

| 항목 | 원본 관측 |
| --- | --- |
| GitHub Run | [#2878.1 / 39008751687](https://github.com/planner77/masterGantt/actions/runs/39008751687) · event `pull_request` · attempt 1 · FAILURE |
| PR HEAD | `37c2c4687d6df61a56e5bc8fa9696863b287cd6d` |
| 당시 `main` Base | `de863713142a92f1cac56dbae044923822bca932` |
| test-merge | `ef26400db5a5fc6aae77783b7330da38cf3dbf5e` (부모: 당시 Base → HEAD) |
| Preflight / policy / typecheck / ESLint / Vitest / build / Docker | **SUCCESS** |
| E2E / QA Final | **FAIL** (QA Final은 E2E Required FAIL 이후 차단; 별도 제품 결함 증거로 세지 않음) |
| 직접 실패 | Chromium shard 5 / job `117326889006`: 64 PASS, 1 FAIL, 17 NOT RUN |
| 실패 파일 / 위치 | `tests/e2e/resource-kpi-integration-ui.spec.ts:14→216` |
| Playwright 오류 | `locator.evaluate: Fixed-geometry Gantt did not settle before navigation comparison` |
| 원본 테스트 범위 | 실제 HTTP+SQLite 프로젝트 및 Resource KPI 3계층·2 Matrix·5개 viewport 폭·Excel·Gantt 왕복 |
| Artifact | `playwright-report-shard-5` ID `12092311845`; artifact ZIP/trace 심층 해석 **NOT TESTED** |

**취소 Job 별도 보존.** Shard 1(job `117326889044`) 74개 PASS 기록, 2(`117326888998`) 85, 3(`117326889009`) 59, 4(`117326889149`) 36, 6(`117326889072`) 63; 다섯 Job 모두 `CANCELLED`, 다운로드한 Job 로그의 개별 `✘`는 0개였다. 기록된 일부 PASS를 Shard 전체 PASS로 승격하지 않는다. 해당 취소 Job의 미실행 범위는 **NOT TESTED**다.

## 2. #2878 인과·증거 분리

- **도달한 지점:** 일정 → 리소스 KPI 그룹/개인 Tree·Matrix, 5폭 반응형, Plan, Excel 다운로드/원장 대조를 수행한 뒤 일정 탭으로 돌아옴. canonical sync depth `0` 확인과 차트 hover/가로 wheel, native left `>0` 확인 뒤 별도 90 RAF 대기에서 실패했다.
- **기존 테스트 준비 조건 누락:** `data-gantt-canonical-sync-depth=0`은 canonical 처리 중이 아님을 뜻할 뿐이다. 최신 Gantt Scale, U2 canonical recovery, U3 semantic projection/visible Grid receipt, viewport coordinator의 완료/취소, 실제 물리 capacity가 모두 동일 시점에 정착했다는 증거가 아니다. Responsive 390/768/1024/1440/1920 전환 이후 과거 위치 복원은 의도적으로 무효화된다.
- **현재 확인 가능한 원인 유형:** `INITIALIZATION_OR_SETTLEMENT_CONTRACT` / `VIEWPORT_SETTLEMENT_UNKNOWN`. 90 RAF/연속 8프레임 내 native `scrollLeft`와 공개 SVAR Core left의 **정확한 일치**에 실패했다는 사실은 확정. 왜 일치하지 않았는지(일시적 projection/axis 경합·차트 width/rounding·Core 이벤트 수신 누락·지연된 이전 restore·실제 제품 버그)는 해당 CI Job 텍스트에 각 좌표/첫 writer가 없어서 **UNKNOWN**이다. 실제 제품 결함이라고 단정하거나, 반대로 테스트 불안정으로만 단정하지 않는다.
- **이전 결과와 구별:** PR #561 CI #2866 shard 4의 삭제된 Lane64px 기대 오류는 이번 #2878의 직접 실패가 아니었다. #2864 Copy 첫 GET500은 주입 전 초기 navigate 지연, #2859는 저장 뒤 GET ECONNRESET, #2862는 pointer/DayWeek 정착, #2863은 canonical84/visible83·제거된 Task 버튼 문제였다. 문자열/Shard가 달라도 모두 [누적 원장](evidence/issue-552/ci-cumulative-20261017.json)에서 유지한다.
- **보호해야 하는 제품 계약:** marker OFF에서 native Milestone row/bar/guide0, 전체 canonical ID·Link·Membership 보존; Resource KPI·Excel 데이터/권한/수정 원자성; 동일 Gantt instance 및 원래 Tree/Selection, 실제 사용자의 scroll; Core/native 원복. `sourceStable`과 최종 Required3/Trusted QA는 별도 판정이다.

## 3. 이번 최소 보완 (새 HEAD의 실행 전 효과는 미확정)

수정 대상은 `tests/e2e/resource-kpi-integration-ui.spec.ts`의 **실제 사용자 wheel 직전 준비 구간**이다.

1. 현행 공통 read-only `waitForGanttReadiness(frame, {operation:"observe", ...})`를 사용해 **정확한 API instance / project revision / day scale / scope null / 검색 조건 / canonical 전체 ID / 실제 Grid DOM / 최신 U2·U3 완료 및 viewport 작업**을 연속 3개 프레임 관측한 후 wheel을 입력한다.
2. 공통 read-only helper는 제품 명령을 호출하거나 내부 상태를 정상으로 위조하지 않는다. `allowCancelledPriorWork`는 현행 helper의 **이미 취소 확정된 작업**만 유효한 최신 입력 후보로 인정하고, 진행 중/실패 중인 작업의 성공으로 간주하지 않는다.
3. 이전의 `90 RAF`, `8연속 안정`, `nativeLeft === publicLeft`, canonical depth0 및 최종 동일 Gantt/tree/selection/viewport/원본 DB를 **그대로 유지**한다. Playwright timeout/retry/skip, CI fail-fast, QA gate 변경 없음.
4. 90프레임 판단 전후 마지막 12개 Core/native X/Y, canonical depth, coordinator phase, U3 영수증 및 이전 peer restore를 `resource-kpi-fixed-geometry-settlement` 테스트 첨부로 남겨, 재실패할 경우 해당 단계의 실제 state와 최초 writer를 조사할 수 있도록 한다. 이 추가 관측의 결과를 제품 수정 검증으로 주장하지 않는다.
5. 제품 코드 `project-gantt.tsx`, `viewport-coordinator`, `svar-viewport-port`의 공통 동기화 authority는 이 Job 로그만으로 결함을 특정할 수 없어 변경하지 않는다. 새 진단에서 실제 제품 버그가 증명되면 제품 및 직접/교차/음성 회귀를 같은 후보에 함께 수정한다.

## 4. 반복 실패 통합 분류 원장

| CI Run | 실제 실패 파일 / 분류 | 확인된 보완 및 미확인 경계 |
| --- | --- | --- |
| [#2844.1](https://github.com/planner77/masterGantt/actions/runs/38905085250) | `gantt-state-product-integration`: 과거 native M 기대·표시 계약 | default Marker OFF M row/bar0, 명시 legacy1로 분리 |
| [#2859.1](https://github.com/planner77/masterGantt/actions/runs/38966513185) | `issue-623-resource-mvp`: 저장 확인 GET ECONNRESET·전송 **UNKNOWN** | spec-local runtime 수명/브라우저 GET 교정, OOM/재시작 근인 미확정 |
| [#2861.1](https://github.com/planner77/masterGantt/actions/runs/38971156752) | `milestone-management-persistence`: M-only native 표시 계약 | 기본 WBS와 legacy 분리, Dashboard exact ID 보존 |
| [#2862.1](https://github.com/planner77/masterGantt/actions/runs/38973584934) | `project-gantt-inline-name`: 리사이즈 전후 pointer 좌표 기대, `project-gantt-scale`: 새 Axis 정착 경계 | 두 테스트 수정; **shard5 Job CANCELLED였으나 실제 FAIL 기록** |
| [#2863.1](https://github.com/planner77/masterGantt/actions/runs/38976543886) | `projection-row-alignment`: Canonical84 vs Visible83; `milestone-timeline-lane`: 제거된 Task 버튼 | 명시적으로 Canonical/Visible/DOM 구별·실제 Task type 필터로 전환; **shard4 CANCELLED 안 실제 FAIL** |
| [#2864.1](https://github.com/planner77/masterGantt/actions/runs/38978855656) | `derived-dialog-recovery`: GET500 주입 전 navigate/load 29.235s·초기화 UNKNOWN | DCL/정상 GET·DOM UI 준비 분리, 실제 delayed request 원인 미확정 |
| [#2866.1](https://github.com/planner77/masterGantt/actions/runs/38982330298) | `project-notifications`: 제거된 marker lane64px null·테스트 계약 | native Gantt geometry/marker0 및 synthetic Root422 검증 수정 |
| [#2878.1](https://github.com/planner77/masterGantt/actions/runs/39008751687) | `resource-kpi-integration-ui`: 최신 U2/U3/viewport 정착 확인 전 사용자 입력·근인 UNKNOWN | readiness gate/실패 좌표·영수증 첨부 추가; 새 HEAD 결과 NOT TESTED |

최근 개별 로그로 검증한 **8개 Run, 테스트-level FAIL 10건, 서로 다른 E2E 파일 10개** (옛 Run test-level 완전성은 INCOMPLETE). `CANCELLED` 안의 실제 FAIL **2건**은 별도 보존. 각 Run의 PASS는 서로 다른 HEAD이므로 최신 전체 PASS가 아니다.

## 5. 다음 반복 실패 시 실행 순서와 판정

**A. 정확한 원본 고정:** PR HEAD, 현재 `main` Base, `refs/pull/561/merge`와 두 부모, Run ID/Attempt, Job ID, 실제 Playwright 실패 지점·다운로드한 Artifact를 기록한다. Job 결론이 CANCELLED이어도 `✘`, 에러 요약·테스트 미완료를 따로 세고 오염된 PASS를 주장하지 않는다. Quality/Docker 실패와 E2E·QA 후속 실패를 구분한다.

**B. 같은 후보의 실패 합집합 전체 진단:** [JSON 원장](evidence/issue-552/ci-cumulative-20261017.json)의 `failures[]`은 현행 `diagnosticSubset`의 `pr/runId/attempt/headSha/status=FAIL/file` 형식이며 최대 12개 서로 다른 브라우저 파일이라는 정책 안에 있다. Node22·의존성·Playwright Chromium·새로운 **독립 worktree**에서 실행한다. 현재 원본 Base는 `de863713142a92f1cac56dbae044923822bca932`였으며 이후 main이 바뀌면 명시 SHA를 다시 고정한다.

```bash
npm run verify:prepr -- --mode=diagnose \
  --base=de863713142a92f1cac56dbae044923822bca932 \
  --risk=HIGH --issue=552 --pr=561 \
  --failure-log=docs/evidence/issue-552/ci-cumulative-20261017.json

# 위 결과 보존 후 코드 변경 없이 동일 source 전체 실행
npm run verify:prepr -- --mode=ci-like \
  --base=de863713142a92f1cac56dbae044923822bca932 \
  --risk=HIGH --issue=552 --pr=561
```

현재 두 모드 실행 여부: **NOT TESTED**. 명령을 문서화한 것이 실행은 아니다. `diagnose`는 worker1/retry0/max-failures0으로 누적 파일 합집합을 완주하고, `ci-like`는 전체 E2E/Unit/typecheck/lint/build를 같은 코드에서 검증한다. 가능한 경우 QA 독립 read-only 재검토도 추가한다. 완료 전에는 사용자나 다른 Agent가 같은 source를 변경하지 않는다.

**C. 실패 세부 분류:** 원본 U2 canonical 깊이/세대, U3 성공 receipt와 최신 시도(성공·취소·타임아웃 구별), Core/native 실제 X/Y, 물리 capacity, axis Day/Week, viewport coordinator phase·writes·gesture·lease, 최초 DOM/Core writer, 브라우저 resize·focus·wheel 시점을 나란히 정렬한다. 정상 경로는 모든 준비 조건 이후 조작하고, *의도적 race 테스트는 별도 테스트*에서 준비를 의도적으로 막았다가 해제한다. 1px rounding 등 허용 계약도 기존 설계 근거와 실제 수치를 먼저 입증한다. 단순 sleep/timeout 일괄 증가·Skip·느슨한 단언·재시도로 숨기는 방법은 금지한다.

**D. SourceStable 차단:** 기존 `UNKNOWN` 영향경로 매핑과 별개로 `next-env.d.ts`, `tsconfig.json`, screenshot 변경 등으로 `sourceStable=false`이면 Local Pre-PR 상위 상태는 **BLOCKED**다. report의 start/end fingerprint·생성물 변경 원인을 기록하고 **격리 worktree에서 원인 제거 후 새 시작 fingerprint**로 반복한다. fingerprint 검증 자체를 삭제하거나 무시하지 않는다.

**E. 완료 기준:** 누적 진단10파일과 같은 HEAD 전체 직접·교차·음성 회귀/로컬 소스 fingerprint 보존 확인, Reviewer 변경검토·unresolved thread0, 최신 main 정렬/충돌0, 새로운 exact Head PR **전체** CI Required Quality/E2E6/Docker·QA Final 결과 각각 기록. GitHub Runner를 실제로 실행하지 못한 모든 검증은 **NOT TESTED**다. Owner 수용 전 `MERGE_READY=BLOCKED`; 명시 승인 없으면 Merge/Main CI/GHCR/Issue 종료 모두 수행하지 않는다.

## 6. 전체 브랜치 PR CI Run 인벤토리 및 미조사 경계 (2026-10-17 보강)

GitHub Actions `branch=feat/issue-552-milestone-visibility`에서 반환된 **30개 Run의 metadata**를 아래와 같이 보존한다. 이력의 상당수가 CI #659 fail-fast 도입 이전으로 한 Run에 여러 파일·Shard FAIL이 있었다. 이 표의 FAIL/CANCELLED는 workflow 결론이지 각 테스트의 실패 개수나 미실행 개수가 아니다. 이전 8Run/10파일과 혼동하지 않는다.

| Run | Run ID / Attempt | Workflow 결론 | Head | 테스트 로그 분석 상태 |
| --- | --- | --- | --- | --- |
| [#2878](https://github.com/planner77/masterGantt/actions/runs/39008751687) | 39008751687 / 1 | FAILURE | `37c2c4687d6d` | 선정 로그 기록 |
| [#2866](https://github.com/planner77/masterGantt/actions/runs/38982330298) | 38982330298 / 1 | FAILURE | `00fd170a5611` | 선정 로그 기록 |
| [#2865](https://github.com/planner77/masterGantt/actions/runs/38982310052) | 38982310052 / 1 | FAILURE | `f48689df9141` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2864](https://github.com/planner77/masterGantt/actions/runs/38978855656) | 38978855656 / 1 | FAILURE | `f48689df9141` | 선정 로그 기록 |
| [#2863](https://github.com/planner77/masterGantt/actions/runs/38976543886) | 38976543886 / 1 | FAILURE | `1abebed18964` | 선정 로그 기록 |
| [#2862](https://github.com/planner77/masterGantt/actions/runs/38973584934) | 38973584934 / 1 | FAILURE | `eb525442fa93` | 선정 로그 기록 |
| [#2861](https://github.com/planner77/masterGantt/actions/runs/38971156752) | 38971156752 / 1 | FAILURE | `2cc5635b9f0e` | 선정 로그 기록 |
| [#2860](https://github.com/planner77/masterGantt/actions/runs/38971119607) | 38971119607 / 1 | FAILURE | `a7ad34482aeb` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2859](https://github.com/planner77/masterGantt/actions/runs/38966513185) | 38966513185 / 1 | FAILURE | `a7ad34482aeb` | 선정 로그 기록 |
| [#2844](https://github.com/planner77/masterGantt/actions/runs/38905085250) | 38905085250 / 1 | FAILURE | `2ce8a276802a` | 선정 로그 기록 |
| [#2682](https://github.com/planner77/masterGantt/actions/runs/38393906015) | 38393906015 / 1 | FAILURE | `d9334c30c6c2` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2679](https://github.com/planner77/masterGantt/actions/runs/38388682185) | 38388682185 / 1 | FAILURE | `ea25c48115ca` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2670](https://github.com/planner77/masterGantt/actions/runs/38383522417) | 38383522417 / 1 | FAILURE | `eb1ff4d7ffbd` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2669](https://github.com/planner77/masterGantt/actions/runs/38379375572) | 38379375572 / 1 | FAILURE | `eb898c54d2cf` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2668](https://github.com/planner77/masterGantt/actions/runs/38379357093) | 38379357093 / 1 | FAILURE | `290119bcfe85` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2667](https://github.com/planner77/masterGantt/actions/runs/38371554385) | 38371554385 / 1 | FAILURE | `290119bcfe85` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2666](https://github.com/planner77/masterGantt/actions/runs/38363844306) | 38363844306 / 1 | CANCELLED | `f42afe102190` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2665](https://github.com/planner77/masterGantt/actions/runs/38362171056) | 38362171056 / 1 | CANCELLED | `5d9f8124ac34` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2661](https://github.com/planner77/masterGantt/actions/runs/38358079542) | 38358079542 / 1 | FAILURE | `a9abf4813aad` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2654](https://github.com/planner77/masterGantt/actions/runs/38354836221) | 38354836221 / 1 | FAILURE | `0e3d39b6e012` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2651](https://github.com/planner77/masterGantt/actions/runs/38352770887) | 38352770887 / 1 | FAILURE | `edeed05ddb43` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2648](https://github.com/planner77/masterGantt/actions/runs/38351816899) | 38351816899 / 1 | CANCELLED | `f03051ed1e2a` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2645](https://github.com/planner77/masterGantt/actions/runs/38351001998) | 38351001998 / 1 | CANCELLED | `2e1eb0324196` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2643](https://github.com/planner77/masterGantt/actions/runs/38348440262) | 38348440262 / 1 | FAILURE | `837c1d50fc86` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2642](https://github.com/planner77/masterGantt/actions/runs/38345784863) | 38345784863 / 1 | FAILURE | `41c2b093ba5d` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2641](https://github.com/planner77/masterGantt/actions/runs/38342994530) | 38342994530 / 1 | FAILURE | `67535b647c2a` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2639](https://github.com/planner77/masterGantt/actions/runs/38338703107) | 38338703107 / 1 | CANCELLED | `8942d3ad875a` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2633](https://github.com/planner77/masterGantt/actions/runs/38336799481) | 38336799481 / 1 | CANCELLED | `4a3aabaa3fdf` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2628](https://github.com/planner77/masterGantt/actions/runs/38326098951) | 38326098951 / 1 | FAILURE | `81a90b51e92b` | 원격 Run 확인·실패 테스트 전수 확인 전 |
| [#2219](https://github.com/planner77/masterGantt/actions/runs/37839172928) | 37839172928 / 1 | FAILURE | `fed88f5e00e1` | 원격 Run 확인·실패 테스트 전수 확인 전 |

**검증한 이전 교차 사례:** #2654/#2661/#2667의 `resource-kpi-integration-ui.spec.ts`는 #530 pending viewport/wheel/resize와 관련된 다른 사례에서 실패했고, #2670에서는 #530 고정 geometry 복귀와 pending queue 케이스가 실패했다. 이들은 현재 #2878 `line216`과 정확히 같은 단언 실패라고 확정하지 않지만, 해당 제품·Fixture 계약에 *반복적 영향*이 있음을 보여 준다. 해당 이전 Run들의 다른 실패는 전체 추출이 되지 않았으므로 아래 검증 상태를 갱신 전까지 **INCOMPLETE**로 유지한다.

향후 담당자는 먼저 `#2219/#2628/#2633~#2682/#2844~#2878`의 모든 *실제 실패* Job 및 `CANCELLED` Job 내 Playwright `✘`를 추출하여 기존 표에 **기록 추가**하고, 전체 distinct failed file 목록과 기여한 소비자를 재계산한다. `verify:prepr diagnose` 제한 12파일을 넘으면 사유를 문서화해 서로 겹치는 bounded partition으로 실행하되 전체 실패 논리적 합집합을 버리지 않는다. 미실행 파일은 NOT TESTED, 로그 권한·보존 만료는 UNKNOWN으로 기록한다. 현재 기존 최근 10파일 진단 및 전체 `ci-like` 실행은 모두 NOT TESTED.

## 7. CI #2885.1 / Run 39010974393 — 일반 Task를 숨은 Milestone으로 오분류한 E2E 진입점 (2026-10-17)

**원본 불변 출처:** [Full PR CI #2885.1](https://github.com/planner77/masterGantt/actions/runs/39010974393) · event `pull_request` · attempt1, HEAD `84009ba5ab3eb35fd434cc98a1dbf29bad7a9156`, 당시 main/Base `78ec8d2ced62f543f73a8477c3e62fca8274274b`, test merge `cf9ac161593088bc6351464074df4811f1685b25` (부모 Base/HEAD). QA Preflight·정책·ESLint·TS·Vitest·Build·Docker **PASS**, E2E Required **FAIL**, QA Final 후속 **FAIL**.

- 최초 실제 실패: shard5 job `117333619456` · `tests/e2e/milestone-stage-exchange.spec.ts:142→147`, 내부 `helpers/milestone-ui.ts:44`. 22 PASS / 1 FAIL / 59 NOT RUN. `[data-milestone-task-id="<ordinary CHILD taskId>"]`에 대해 `toHaveCount(1)` 기대, 실제 `0`, 5000ms 동안 실패.
- Shard 1 job `117333619463`은 22개, 2/`117333619628`은 30개, 3/`117333619487`은 38개, 4/`117333619461`은 10개, 6/`117333619514`는 25개의 통과 기록 후 모두 **CANCELLED**. 이 다섯 Job의 단위 테스트 실패 `✘`는 기록되지 않았으나 남은 케이스는 **NOT TESTED**다.
- [원본 Playwright report artifact 12092074632](https://github.com/planner77/masterGantt/actions/runs/39010974393/artifacts/12092074632)의 `error-context.md`와 실제 Chromium Trace/Network JSON을 **직접 추출·대조**했다. 초기 일정 탭은 “편집 중”이지만 첫 SVAR Grid DOM이 비어 있는 순간이 있으며, 더 늦은 Trace snapshot에는 `CHILD`의 일반 `wx-row[data-id]`가 존재한다. 실패의 UUID는 작업 `CHILD` (`type: "task"`)이며 요청 `GET /milestone-dashboard?search=<CHILD UUID>&horizonDays=14...`은 HTTP **200**, 검색 결과 `rows=[]`; 같은 세션의 검색 전 응답에는 정상 Milestone **6개**와 각각의 정확한 ID가 있다. DB/서버가 Milestone을 누락했다는 증거는 아니다.
- **확정 테스트 결함:** spec-local `openTask(page, taskId)`가 `await nativeRow.count() === 0`을 **Milestone 유형 판정**으로 사용하여, 아직 렌더링되지 않은 일반 Task를 Milestone으로 잘못 판단하고 `openMilestoneEditor(page, CHILD UUID)`를 호출했다. 이는 canonical Task 타입과 visible/native DOM의 의미를 섞은 구형 계약이다. 단지 API가 느려서 생긴 제품 결함 또는 Milestone Server Search의 버그로 단정할 근거는 없다.
- **반복성 대조:** 과거 [#2670.1 / 38383522417](https://github.com/planner77/masterGantt/actions/runs/38383522417)의 같은 `milestone-stage-exchange.spec.ts:142`는 Dashboard `data-milestone-task-id`의 0개/1개 불일치로 실패했으므로 **동일 증상 후보**다. 정확한 내부 원인이 같았는지는 당시 전체 Trace/ID 원장을 추가 비교하기 전까지 **UNKNOWN**으로 유지한다. #2654의 동일 테스트는 후반 일정 Context Menu `data-action=open-task` 기대에서 실패했으므로 동명 spec라도 서로 다른 계약이다. 과거 다른 Shard 실패까지 모두 수정했다고 주장하지 않는다.
- **보완 파일:** `tests/e2e/milestone-stage-exchange.spec.ts`의 `openTask(page, task)`는 **고정된 canonical `task.type`**을 전달받는다. `milestone`일 때만 Dashboard 정확 ID Editor를 사용하고, `task/summary`는 일정 탭에서 해당 native 행이 **실제로 보일 때까지 기다려** 기존 Context Menu와 Task Editor를 이용한다. 일반 Task가 끝내 보이지 않으면 그대로 실제 회귀 **FAIL**, 오판·숨은 row 제조/암묵 검색 완화 금지. `CHILD`는 `type:"task"`, `M-JOIN`은 `type:"milestone"`의 실제 원본을 별도로 확인하고 두 UI 경로를 계속 검증한다.
- **변경하지 않은 계약:** 테스트의 실제 HTTP/SQLite·mutation/revision/Task Link/Copy·Import/Export·Dashboard/Resource/Target, Marker OFF(visible native M row0, canonical M 보존), UI focus/viewport/readonly, Test timeout·retries0·Skip 없음, CI 6Shard/fail-fast/Required3, 제품 코드/API/DB/schema/권한/버전. 증거 없는 서버 수정 금지.
- **실제 검증 경계:** 이 연결 환경에 원본 체크아웃의 node_modules/Chromium/Next runtime이 없어 새 소스 Playwright/Vitest/Typecheck 및 `verify:prepr --mode=diagnose/ci-like` 실행은 **NOT TESTED**. 원본 Trace의 증거 확인과 신규 코드 정적 비교는 실제 E2E PASS가 아니다. 새 HEAD의 Full PR CI·Trusted QA/Owner ACCEPT는 등록 전 **NOT TESTED**.

**합집합/인계:** [JSON 원장](evidence/issue-552/ci-cumulative-20261017.json)에 #2885의 신규 실패 파일을 추가했다. GitHub PR 브랜치 Run metadata **31개**, 그중 최근 **9Run/11개 서로 다른 실패 파일/11개 테스트-level FAIL**의 선택된 원본을 보존한다. 이전 22개 Run의 전체 test-level 파일·취소된 Job에 실제 실패가 모두 수집된 것은 아니므로 `historyCompleteness=INCOMPLETE`. 이 11파일은 전체 과거 실패 합집합이 아니라 **선정된 bounded 진단 subset**이다. 처음부터 수집한 전체 실패 합집합이 12파일을 초과하면 [공통 #704 지침](PR_CI_FAILURE_TRIAGE.md)에 따라 겹치는 그룹으로 분할 진단하되 누락하지 않는다.

**동일 후보에서 실행할 검증(현재 NOT TESTED):**

```bash
npm run verify:prepr -- --mode=diagnose \
  --base=78ec8d2ced62f543f73a8477c3e62fca8274274b \
  --issue=552 --pr=561 --risk=HIGH \
  --failure-log=docs/evidence/issue-552/ci-cumulative-20261017.json

# 정확한 같은 HEAD / 기존 소스 변경 없이 전체 교차 회귀
npm run verify:prepr -- --mode=ci-like \
  --base=78ec8d2ced62f543f73a8477c3e62fca8274274b --issue=552 --pr=561 --risk=HIGH
```

`UNKNOWN` 영향 경로 또는 `sourceStable=false`(Next 생성 타입·스크린샷 변경)가 다시 나오면 최상위 상태 **BLOCKED**를 유지한다. GitHub HEAD/Base/Test-merge, review unresolved0/mergeable, PR CI Run/Attempt가 등록됐다는 사실과 공식 Quality/E2E/Docker/QA PASS는 구분한다. **병합/Main CI/GHCR/태그/Issue 종료는 별도 Owner 승인 전 수행하지 않는다.**

## 8. CI #2886.1 — #2878과 동일한 숨김→복귀 경계의 제품 WBS 필터 재적용 누락 (2026-10-17)

**원본 불변 출처:** [Full PR CI #2886.1 / Run 39013855282](https://github.com/planner77/masterGantt/actions/runs/39013855282) · event `pull_request` · attempt1 · HEAD `51b4f919f16ac9765d20b9256e6521f91150c066` · main Base `78ec8d2ced62f543f73a8477c3e62fca8274274b` · test-merge `959a3b9ce79acbc9c699eb3d86cc71fc69e7ffde` (부모 Base→HEAD). Preflight/TS/ESLint/Vitest/Build/Docker **PASS**; E2E Required **FAIL**, 자동 QA Final 파생 **FAIL**.

### 8.1 Job/Shard 실패와 보존 증거

| 항목 | 원본 관측 |
| --- | --- |
| 직접 실패 Job | shard5 `117342193179` · `tests/e2e/resource-kpi-integration-ui.spec.ts:15 → waitForGanttReadiness:216` |
| 실제 실행 | 64 PASS / 1 FAIL / 17 NOT RUN. 테스트 본문에서는 SQLite/KPI/Excel 원본 검사를 통과한 뒤 일정 탭 복귀 readiness에서 실패 |
| readiness blockers | `LATEST_ATTEMPT_rows_TIMED_OUT`, `CURRENT_OPERATION_FAILED_TIMED_OUT`, `DOM_MEMBERSHIP_OR_ORDER_MISMATCH` |
| 취소 Shard | 1/2/3/4/6 모두 `CANCELLED`. 각각 로그 68/102/79/55/73개 PASS · 관측된 개별 `✘` 0개. 남은 범위는 **NOT TESTED** |
| 원본 Artifact | [playwright-report-shard-5 #12093952484](https://github.com/planner77/masterGantt/actions/runs/39013855282/artifacts/12093952484), ZIP SHA256 `73e4716a35a2123acc9d228026ab78c006a41a8dc7130d49bb21feac28ba610e`, 내부 trace ZIP SHA256 `c19f4fb52187384e5161e4bfc7aba19045f4e3b4afffb0d0a114e23fbd00fb8d` |
| 서버/리소스 | 테스트 소유 isolated Next 프로세스 alive, health GET200/18ms, 계측 OOM/OOMKill 0. 이 범위에서 세션 죽음·DB/네트워크가 원인이라는 증거는 없다 |
| 후속 기준 | 최신 HEAD의 전체 CI/QA/Owner 수용은 별도 Run에서 판정; 이 Run의 원본 실패는 교정 전 결과로 보존 |

### 8.2 실제 Trace에서 이전 #2878과 교차 검증한 공통 원인

[이전 #2878.1 / 39008751687](https://github.com/planner77/masterGantt/actions/runs/39008751687)의 [Playwright Artifact #12092311845](https://github.com/planner77/masterGantt/actions/runs/39008751687/artifacts/12092311845)도 새로 내려받아 비교했다(outer ZIP SHA256 `a9911cc6b91c15998f8d9d0b3f89d29fcec3702dd18c1cf90fdb18878e7fb40c`; Trace SHA256 `8953e4d1ff6f77e15c4f448b2319a02c9dda9d807c0f481c2cf45c7c1401109c`).

| 단계/증거 | #2878 기존 실패 | #2886 최신 실패 |
| --- | --- | --- |
| 선행 일정 view | Gantt instance `svar-api-1`, Peer capture 공개/DOM left120 | 동일 유형의 capture left120 |
| 원래 최신 성공 U3 receipt | 일반 Task **6개**의 logical/core/DOM SETTLED (semantic ID2) | 일반 Task **6개**의 logical/core/DOM SETTLED (semantic ID2) |
| 숨김→복귀 이후 | 성공 receipt가 최신 변화의 완료를 뜻하지 않았음, 새로운 U3 rows PENDING | U3 `generation10` `rows TIMED_OUT`, 새 성공 영수증 없이 기존 6개 receipt 잔존 |
| 실제 marker-OFF DOM | 정상 6개 표시 계약과 불일치하는 UI 상태가 뒤늦게 확인됨 | 최종 `.wx-row` **8개**: 일반 Task6 + canonical Milestone2. 즉 이전 6개 영수증을 최신 DOM 증거로 사용할 수 없음 |
| 축/viewport | 과거 `RANGE_EXTENSION SETTLED`의 폭1872에서 숨김/복귀 후936으로 축소, `PEER_RETURN`이 U3 대기. 테스트의 wheel이 `USER_GESTURE`로 이를 SUPERSEDED시키고 이후 Range extension은 Core30/native31에서 진행. 이전 #2878 실패가 단순 스크롤 오차가 아니었음을 뒷받침 | 이전 확장 폭1872에서936으로 축소·Core width936/chartWidth906/native capacity31. PEER_RETURN(원래120)을 `WAIT_PROJECTION`으로 유지하다 최종 `TIMED_OUT`; Core/native left는 둘 다0. 다른 RANGE_EXTENSION 시도는 `LOWER_PRIORITY`로 SUPERSEDED |
| 테스트 실패 표현 | 원래 `Fixed-geometry Gantt did not settle`, 실패 시점의 U3 미검증으로 원인 UNKNOWN이었음 | 이전 보완의 readiness가 U3 실패·구형 display membership·peer 실패를 실제로 **차단** |

`#2886` 마지막 상태: canonical UUID8(그 중 M2), 최근 성공 receipt의 logical/coreVisibleIds6, 실제 DOM8, `canonical generation3/settled3/depth0/recovery SETTLED`, U3 latest `gen10/rows TIMED_OUT`, SVAR scale day, physical capacity31, peer restore `TIMED_OUT`. **U2 depth0 / U3 이전 성공 receipt / 공개 Core와 native left0 일치만으로 최신 native rows가 올바르게 필터링됐다고 선언하면 안 된다.**

**정정/인과 경계:** 이전 §2~3의 "시험 전에 readiness를 기다리면 된다"는 판단은 불충분했다. 새 readiness는 실제 제품 표시 계약 실패를 정확히 잡아냈으며 PASS로 우회할 대상이 아니다. 제품의 첫 DOM writer나 vendor 내부 원인은 remote Trace에서 직접 특정되지 않았다. 다만 `src/features/gantt/project-gantt.tsx`의 WBS `filter-tasks` 효과는 `viewVisible` 변화가 dependency에 없어, Resource panel이 실제로 Gantt를 `hidden`한 후 보여 줄 때 **다시 filter 상태를 검사할 재진입 트리거가 없었다**. 반면 U3/layout observer 및 Peer-return은 viewVisible 변화에 반응했다. 이 소유권/순서 차이가 실제 Milestone2 노출·U3 대기 교착을 설명하는 직접 확인된 코드 결손이다. **제품 수정 효과는 실행 전 아직 NOT TESTED**.

### 8.3 원인별 일괄 교정 / 보호 경계

1. **제품 표시 필터 소유자 보완:** `project-gantt.tsx`의 기존 `filter-tasks` Effect가 `viewVisible=false→true`에도 실행되도록 dependency에 가시성을 추가한다. hidden 상태에서는 Core 명령을 발행하지 않는다. 재진입 시 canonical source·revision·structure·membership이 같은지 확인하고 **실제 현재 Core rows가 논리적 WBS projection과 다를 때에만** 기존 공개 `filter-tasks` 경로를 재적용한다. 동일 API 및 사용자의 selection/tree intent, 기존 canonical queue→U3/Peer 순서를 유지한다. 브라우저 직접 DOM 숨김/CSS 대체, private Core patch, 무제한 재시도·시간 예산 증가는 하지 않는다.
2. **별도 변경 영향 교차:** 기존 `milestone-visibility.spec.ts`의 marker-OFF 수용 테스트에 물리적으로 일정 panel을 숨기는 **리소스 탭**→일정 복귀 경로를 추가한다. 같은 instance/canonical4/일반 WBS3/실제 DOM3/M row·bar0, U2/U3 readiness, mutation0을 보존한다.
3. **실제 SQLite 복귀 소비자:** `resource-kpi-integration-ui.spec.ts`의 이전 #2878 대비 추가한 readiness/90RAF·8연속 Core/native strict equality는 그대로 유지하고, 다시 열린 Core/native Grid 행이 **Milestone 제외 Task6 ID 목록과 정확히 같음**을 검사한다. 실제 5폭 Matrix·Excel·KPI/Plan·Task/assignment 기준, 여전히 전체 Strict 복귀와 UserIntent/wheel/권한을 확인한다.
4. **향후 진단력:** 공통 읽기 전용 `gantt-readiness.ts`에 public diagnostic probe의 **live Core visible ID** 목록을 추가한다(선택 필드로 Type 선언). 기존 readiness 실패 blocker·timeout·동작 결정에는 개입하지 않으며 다른 테스트 판정을 완화하지 않는다.
5. **보존/롤백:** 제품 `@svar-ui/react-gantt` 버전/서버 DB/API/스케줄/자격·CI Required3·6Shard·QA/릴리스·marker OFF/legacy 기능 분리, `RANGE_EXTENSION`/Peer priority 및 viewport coordinator 단일 writer는 수정하지 않는다. 새 진단에서 여전히 PEER_RETURN 축 용량 실패가 있으면 그 관측에 근거해 **별도의 원인**으로 정리하고 새 후보에서 수정한다.

### 8.4 전체 이력/실행 및 인계 상태

32개 PR-branch CI **Run metadata**, 확인된 최근 10개 Run의 테스트별 실패 **12개**, distinct E2E 파일 **11개**를 [JSON 보조 원장](evidence/issue-552/ci-cumulative-20261017.json)에 보존한다. 과거 22개 Run의 전체 다중 Shard별 실패 파일 합집합은 여전히 **INCOMPLETE**이며 지금의 11개가 전체 역사적 합집합은 아니다. 과거 #2863 Canonical/Visible/DOM 구형 기대, #2866 제거된 Lane, #2885 "DOM row 없음=Milestone 타입" 오판과 이번은 **같은 presentation layer/시간축 관련 소비자**가 있지만 서로 다른 첫 실패 및 원인을 기록한다. 과거 #2670/#2661/#2654의 Resource/Viewport 사례도 완전한 test-level 목록과 일치 여부를 재조사해야 한다.

**실제 환경 부재:** 이 대화의 GitHub 연결로 원본 Job/Playwright Trace/첨부 JSON을 다운로드하여 읽었지만, checkout+Node22+node_modules+Playwright Chromium 전체 애플리케이션 로컬 실행이 없어 신규 제품/테스트 수정의 `verify:prepr --mode=diagnose`, `ci-like`, TS/Unit/Chromium, `sourceStable` 확인은 모두 **NOT TESTED**다. 정적 소스 검토·원본 원격 FAIL을 새 후보 PASS라고 쓰지 않는다. 원장 Input의 11 selected spec은 12개 상한 이내이나 전체 과거 합집합과 혼동 금지.

**권장 동일 frozen 후보 재검증:**
```bash
npm run verify:prepr -- --mode=diagnose \
  --base=78ec8d2ced62f543f73a8477c3e62fca8274274b --risk=HIGH \
  --issue=552 --pr=561 \
  --failure-log=docs/evidence/issue-552/ci-cumulative-20261017.json
npm run verify:prepr -- --mode=ci-like \
  --base=78ec8d2ced62f543f73a8477c3e62fca8274274b --risk=HIGH --issue=552 --pr=561
```

동일 소스 변경 금지, `sourceStart.fingerprint === sourceEnd.fingerprint` 필수, `UNKNOWN` 영향 매핑·Next/스냅샷 생성으로 `sourceStable=false`일 때는 그대로 BLOCKED. 테스트 통과를 위한 Timeout/Skip/Expectation/retry 변경 금지. Work Packet·TEST_PLAN·REMOTE_VALIDATION·Milestone presentation 문서를 동기화하고 최신 main 정렬/리뷰 unresolved0/충돌0, 새 Full PR CI 등록까지만 승인한다. **병합/Main CI/GHCR·tag/release·Issue 종료는 별도 승인 전 금지.**

## 9. CI #2888.1 — #2863의 Canonical/Visible 혼동이 다른 E2E로 재발 (2026-10-17)

### 9.1 원본 실행 및 취소된 Job의 테스트별 사실

| 항목 | GitHub 불변 원본 |
| --- | --- |
| Full PR CI | [#2888.1 / Run 39016580724](https://github.com/planner77/masterGantt/actions/runs/39016580724), `pull_request` / attempt1 / FAILURE |
| Head / Base | `a81ae25ece41f727a963bd9963dcb82575b50286` / `78ec8d2ced62f543f73a8477c3e62fca8274274b` |
| Test-merge | `8bb5d8c9d154fac80f15bdbb7d9666bdd10ac36c`; 부모 Base→Head |
| Gate | QA Preflight·정책·TypeScript·ESLint·Vitest·Next build·Docker smoke **PASS**, E2E Required **FAIL**, QA Final은 E2E 실패 후 종속 **FAIL** |
| 직접 실패 | shard3 job `117350187419`, `tests/e2e/task-editor-form-density.spec.ts:222→232`, `#456 active name filter의 metadata 저장…`: **90 PASS / 1 FAIL / 1 기존 SKIP / 1 NOT RUN** |
| Playwright 오류 | `waitForGanttReadiness` 5s: **`EXPECTED_MEMBERSHIP_MISMATCH`**. 최신 receipt/Coordinator/Canonical/DOM의 나머지 준비조건은 통과 |
| 취소 Shard | 1 job `117350187379`: 81개 통과 로그, 2 `117350187359`: 100, 4 `117350187387`: 64, 5 `117350187404`: 61, 6 `117350187474`: 69. 모두 `CANCELLED`, 로그에 `✘` 없음; 나머지 테스트는 **NOT TESTED** |
| 원본 증거 | [Playwright report-shard-3 #12095402221](https://github.com/planner77/masterGantt/actions/runs/39016580724/artifacts/12095402221). 실제 ZIP SHA256 `a6fca428bae85c543d113904f908645d9368457e92005e0879668f4b75d75bd3`, 내부 Trace ZIP SHA256 `43806b6c6015a372d70d98d1786374e3111315d5a788768ad9adae4e305a6da6` |

**원본 Trace 첨부 `gantt-readiness-failure` 직접 분석:**
- Test expectation: `canonicalIds` **31개**, `visibleIds`도 **31개**. Canonical ID `00000000-0000-4000-8000-000000000005`는 Milestone이다.
- 실제 `__masterganttMilestoneTimeline.read()`: `canonicalTaskCount=31`, `coreTaskCount=31`, `coreVisibleIds=30`. U3 최신 `generation9 / delivery SETTLED`, 성공 receipt는 `logicalVisibleIds=30 / coreVisibleIds=30`, 실제 DOM은 가상화된 **16개 행**, 모두 이 30개 안에 있다. 기대31과 실제30의 **정확한 차집합은 Milestone ID ...0005 단 1개**다.
- `U2 generation4/settled4/depth0/recovery SETTLED`, `scale=week`, `Core left46 / native left47`(기존 허용 ±1px), 수평 Core capacity998/native999, Coordinator `RANGE_EXTENSION SETTLED`; 단순 정착 지연·Viewport 결함이 아니다. 초반 샘플의 PENDING/BUSY는 다음 안정된 샘플에서 해소됐다.
- Source `tests/e2e/fixtures/task-editor-density.ts:44`가 합성 `Milestone`을 `type:"milestone"`로 만들고, `longList:true`는 일반 Task 26개를 추가한다. `tests/e2e/task-editor-form-density.spec.ts:229~232`는 fixture의 모든 ID를 `visibleIds`로 넘겨 이전 native M 행 시절의 오라클을 남겼다. 동일한 복사 코드가 **#570 다음 사례(276~279행)**에도 있으며, 첫 실패 후 fail-fast로 완주하지 않아 #570은 **NOT TESTED**였지만 같은 원인을 공유한다.

### 9.2 이전 실패와의 연관성 및 책임 경계

| 이전 CI / 계약 | 이번 #2888과의 관계 | 지금 필요한 보완 |
| --- | --- | --- |
| [#2863.1](https://github.com/planner77/masterGantt/actions/runs/38976543886), `projection-row-alignment` | Canonical84 vs Visible83(숨긴 Milestone1)로 TEST_CONTRACT 실패한 **같은 유형의 독립 소비자**. 당시 기본 모드에서 canonical 및 WBS를 분리함 | `#456`·`#570`도 Canonical31과 Visible30을 엄격히 분리. 기존 helper·제품 API 전체를 수정할 근거 없음 |
| [#2861.1](https://github.com/planner77/masterGantt/actions/runs/38971156752), M-only `milestone-management-persistence` | native M row/bar를 무조건 기대한 과거의 별도 구형 Oracle | WBS에 M0 유지·Milestone 대시보드/Editor 원본 경로는 별도 검증 |
| [#2886.1](https://github.com/planner77/masterGantt/actions/runs/39013855282), Resource 복귀 필터 | **제품 표시 drift**(옛 receipt Task6 vs 실제 native Task6+M2, U3 rows TIMED_OUT)였음. #2888의 실패는 반대로 정확히 M1이 제외된 상태에서 구형 31 WBS 기대만 실패 | 이전 visibility 재진입 제품 수정은 보존, 오늘의 new E2E에는 제품 변경/skip/timeout 완화 불필요. #2888의 **shard5는 61개 통과 뒤 CANCELLED**, 원래 Resource KPI 복귀 사례를 새 Head에서 통과했다고 단언 불가 |
| [#2885.1](https://github.com/planner77/masterGantt/actions/runs/39010974393), `milestone-stage-exchange` | native row 부재로 일반 Task를 M으로 오분류한 Test Contract. 이번에는 실제 M 행을 WBS에 요구한 반대 유형의 DOM/Canonical 혼동 | 테스트 데이터의 `type`을 authority로 유지, native DOM presence와 canonical identity 구분 |

**원인 분류:** `TEST_CONTRACT / CANONICAL_VS_VISIBLE_WBS_MILESTONE_OFF`. 새 제품 regression / CI 환경 문제 / flaky 또는 무작위 동기화 실패라는 증거는 **없다**. 반대로 #2886 제품 이슈가 이 Run에서 최종 해결됐다는 근거도 **없다**.

### 9.3 수정 사항과 직접·간접·음성 검증

- `tests/e2e/task-editor-form-density.spec.ts`의 두 소비자 `#456`·`#570`에서 `canonicalIds = fixture.tasks.map(taskId)`는 **전체31개**로 유지, `visibleWbsIds = fixture.tasks.filter(type !== "milestone")`은 **30개**로 분리한다. 별도 `milestoneIds` 차집합을 명시해 제거된 유형/수량을 검증한다.
- 기존 `waitForGanttReadiness`에 **전체 Canonical IDs와 Milestone 제외 Visible IDs를 각각 그대로 전달**하며 latest U3·Core/native·완료 영수증·3 frame/실제 용량 검사를 유지한다. 성공 후 `coreVisibleIds`의 **전체30개 set**을 기대값과 대조하고, Milestone ID가 `domIds`와 `lastSuccess.logicalVisibleIds`에 모두 없음을 검증한다. 가상화된 DOM16을 전체30으로 강제하지 않는다.
- #456의 필터 검색 이후 정확 Summary+일반 Task2행, 120px 입력, 메타데이터 저장 후 빈집합/좌측0, revision·mutation1·동일 API 검증 불변. #570의 유지되는 필터에서 metadata-only restore 보호, stale native0 복구·사용자 wheel 우선권·최종 빈집합과 동일 API 단언 불변.
- `tests/e2e/milestone-visibility.spec.ts`, `gantt-state-product-integration.spec.ts`, `projection-row-alignment.spec.ts`의 기존 default M row0/legacy 명시 분기와 cross-consumers를 검토한다. 공통 `gantt-readiness-state.ts`의 EXPECTED_MEMBERSHIP 오라클과 제품 `project-gantt.tsx`·Coordinator/U2/U3·CI Required3·fail-fast, 테스트 `--retries=0`·timeout·Skip·허용오차/릴리스 정책은 **변경하지 않는다**.

### 9.4 후속 누적 진단/Source Freeze

[원장 JSON](evidence/issue-552/ci-cumulative-20261017.json)에 **33개 PR CI Run metadata**와 선택 근거가 명확한 최근 **11개 Run / 테스트-level 실제 FAIL 13개 / 서로 다른 E2E 파일 12개**를 보존했다. 초기 다른 CI Run의 다중 Shard 실패와 CANCELLED 내부 진짜 오류 전체는 아직 `INCOMPLETE`로 표시한다. 최근 12개 파일은 Pre-PR `diagnose` 도구의 **최대12개 경계에 딱 맞지만**, 과거 전체 논리적 실패 합집합은 아니다. 증분 원장과 과거 원장을 다른 범위로 구분하고 필요하면 실제 실패 12파일씩 교차 분할 검사한다.

```bash
# 저장소에 Node22/Playwright/깨끗한 독립 worktree가 있는 환경에서:
npm run verify:prepr -- --mode=diagnose   --base=78ec8d2ced62f543f73a8477c3e62fca8274274b   --risk=HIGH --issue=552 --pr=561   --failure-log=docs/evidence/issue-552/ci-cumulative-20261017.json

# 같은 수정 후보 HEAD, 코드 수정/생성 파일 오염 없이 전체 회귀
npm run verify:prepr -- --mode=ci-like   --base=78ec8d2ced62f543f73a8477c3e62fca8274274b   --risk=HIGH --issue=552 --pr=561
```

이 도구 연결 세션에서는 로컬 **checkout/Node22 의존성/Playwright Chromium이 없어** 두 모드, 선택 browser 테스트, TypeScript·Vitest, sourceStable 검증은 **NOT TESTED**다. 원격 #2888 기존 Unit·Build PASS는 구 HEAD 증거이며 새 후보 PASS가 아니다. 새 HEAD의 필수 Quality/E2E6/Docker, QA/Owner ACCEPT는 새로운 Run 등록 시점 **NOT TESTED**다. 로컬 `UNKNOWN`/source fingerprint drift는 BLOCKED를 유지한다.

최신 main 정렬 후 PR 리뷰 thread0/충돌0 확인 및 **새 전체 PR CI 실행까지만** 승인. 병합·Main CI·GHCR/tag/release·Issue 종료 금지, `release_authorized=false`·MERGE_READY=BLOCKED 유지.

