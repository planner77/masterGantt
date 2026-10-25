# Issue #553 — PR CI 실패 누적 원장 (Primary Issue 단일 기록)

- 작성/갱신 기준: 2026-10-25. Issue [#553](https://github.com/planner77/masterGantt/issues/553) / 기존 PR [#562](https://github.com/planner77/masterGantt/pull/562). 누적 운영 규칙: [PR_CI_FAILURE_TRIAGE.md](PR_CI_FAILURE_TRIAGE.md), 테스트 lifecycle #711.
- **불변 역사:** 최초 PR 구현은 선행 #552의 marker ON 구형 stacked source / old base `6fea0397bc07d0c3adf2d769f9ba6829473503a2`에서 2026-10-08~09 21회 Full PR Run/Attempt **10 FAIL + 11 CANCELLED**. 모든 Run attempt=1. 취소 내부 test-level 오류의 전수 회수는 **INCOMPLETE**, PASS로 간주 금지. 원본 old Head `afd5ec2899183a2464b64f91d34e9de5d8a8319c`, archive `archive/issue-553-pr562-20261018`.
- **현재 기준선 충돌:** 운영 #552 native 행·marker OFF + 최신 main `22144ce3844ab50ac0f22a715742c9df82e072e8`/앱 0.133.2 대비 old PR 1398 commits behind, dirty(conflict). 원본 대량 viewport/marker ON 제품 패치는 이미 #667/#552 main 소유 GSC에 대체되어 통째 적용하면 후퇴. 원본의 교환 fixture/integration/실제 HTTP tests 및 UI notice만 선택 이관하고 old code/ON spec/ON 가이드는 보존하되 main에 이식하지 않는다.

## 전체 PR Full Run / Attempt 원본 목록 (각 URL·SHA 축약 prefix)

| Run # | URL · attempt | 원본 결론 | HEAD prefix | 원본 관찰·추가 분석 |
| --- | --- | --- | --- | --- |
| 2227 | [37847151509.1](https://github.com/planner77/masterGantt/actions/runs/37847151509) | FAIL | `b4bc7e` | 초기 E2E native M 행/표시·Viewport 구형 계약 |
| 2246 | [37853503260.1](https://github.com/planner77/masterGantt/actions/runs/37853503260) | FAIL | `8734a98` | 초기 E2E 이후 교정 및 viewport/이관 소비자 실패 |
| 2248 | [37856718469.1](https://github.com/planner77/masterGantt/actions/runs/37856718469) | CANCELLED | `8e695d` | 중간 Head 종료, 실패 상세 INCOMPLETE |
| 2250 | [37856833368.1](https://github.com/planner77/masterGantt/actions/runs/37856833368) | FAIL | `8bf7057` | E2E 16: relation 5, inline 2, viewport 9 |
| 2252 | [37859089069.1](https://github.com/planner77/masterGantt/actions/runs/37859089069) | CANCELLED | `7c863cc` | 중간 Head 종료 |
| 2253 | [37859339098.1](https://github.com/planner77/masterGantt/actions/runs/37859339098) | CANCELLED | `0654865` | 중간 Head 종료 |
| 2254 | [37859412326.1](https://github.com/planner77/masterGantt/actions/runs/37859412326) | CANCELLED | `908685b` | 중간 Head 종료 |
| 2255 | [37859565333.1](https://github.com/planner77/masterGantt/actions/runs/37859565333) | FAIL | `97c09f4` | E2E14: 5폭 geometry/scroll/관계/inline |
| 2257 | [37861972743.1](https://github.com/planner77/masterGantt/actions/runs/37861972743) | CANCELLED | `ff39fb4` | 중간 Head 종료 |
| 2258 | [37862064001.1](https://github.com/planner77/masterGantt/actions/runs/37862064001) | FAIL | `5e09f06` | E2E15: shard3~6/viewport, 관계, inline |
| 2264 | [37864863009.1](https://github.com/planner77/masterGantt/actions/runs/37864863009) | CANCELLED | `77174c4` | 중간 Head 종료 |
| 2266 | [37865006516.1](https://github.com/planner77/masterGantt/actions/runs/37865006516) | FAIL | `4e27c04` | E2E17, Docker OAuth connection reset(환경 별개) |
| 2268 | [37867727493.1](https://github.com/planner77/masterGantt/actions/runs/37867727493) | CANCELLED | `9aaaa02` | 중간 Head 종료 |
| 2269 | [37867864388.1](https://github.com/planner77/masterGantt/actions/runs/37867864388) | FAIL | `7137e9d` | E2E16: native viewport 복귀, name sync, 390 marker ON |
| 2271 | [37870681914.1](https://github.com/planner77/masterGantt/actions/runs/37870681914) | CANCELLED | `f483d29` | 중간 Head 종료 |
| 2272 | [37870788583.1](https://github.com/planner77/masterGantt/actions/runs/37870788583) | CANCELLED | `42a68c` | 중간 Head 종료 |
| 2273 | [37870892476.1](https://github.com/planner77/masterGantt/actions/runs/37870892476) | FAIL | `2628cb9` | TS2322 project-gantt.tsx(빌드/Docker 파생), E2E12 |
| 2275 | [37872798612.1](https://github.com/planner77/masterGantt/actions/runs/37872798612) | FAIL | `8d001fd` | E2E10: metadata/peer scroll 9, name Tab 1 |
| 2276 | [37875444216.1](https://github.com/planner77/masterGantt/actions/runs/37875444216) | CANCELLED | `b7523da` | 중간 Head 종료 |
| 2277 | [37875570239.1](https://github.com/planner77/masterGantt/actions/runs/37875570239) | CANCELLED | `0a2d507` | 중간 Head 종료 |
| 2278 | [37875675336.1](https://github.com/planner77/masterGantt/actions/runs/37875675336) | FAIL | `afd5ec2` | E2E 5: #529 peer2, #456 fullscreen1, #140 inline1, #552 marker ON1; static/Docker PASS |

## Cross-run 실제 실패 종합 및 대응

| ID | 관련 Run/원본 오류 | 유형·누적 판단 | 이 교정의 수용/잔여 |
| --- | --- | --- | --- |
| F553-A | #2227, #2246, #2250, #2255·#2258 legacy native M 행/동작, Relation5 / 390px marker ON | TEST_CONTRACT+PRODUCT; #552 WBS와 #693 marker-ON 목표 구별 | 현재 운영 OFF 경로의 기존 #552 E2E 유지. old ON UI spec 무단 복원 금지. 실제 Full8 NOT TESTED |
| F553-B | #2250·#2258·#2269·#2275·#2278 native scroll/peer restore, metadata/filtration; #529 Resource2·#456 fullscreen1 | PRODUCT/GSC, 이전 일회성 patch 반복; 공통 #667/#552 main-first가 권위 | 오래된 `project-gantt.tsx` patch 불이식. 새 Main E2E8/8 회귀 결과 NOT TESTED |
| F553-C | #2250·#2255·#2269·#2273·#2275·#2278 name Tab native update; #140 | PRODUCT+TEST_CONTRACT, 원본 #553/head마다 분리 관찰 | 최신 #552/main inline 계약 유지. 새 Head 회귀 NOT TESTED |
| F553-D | #2273 TS2322 `project-gantt.tsx:1664` string/undefined -> typecheck/Next/Docker 실패 | PRODUCT typing 및 파생 빌드 실패 | 구형 파일 패치 이관하지 않음. 이번 TypeScript/Next/Docker NOT TESTED |
| F553-E | #2266 Docker Hub OAuth network `connection reset by peer` | ENVIRONMENT 별개; 코드 결함이나 PASS 확정 아님 | 원본 실패 보존, 새 Docker 실제 결과 NOT TESTED |
| F553-F | #2278 shard2/3/6 E2E fail; shard1/4/5 + static/type/lint/unit/build/Docker success | 5 직접 E2E FAIL, Required E2E 파생 FAIL. old #553 HTTP3/UI10 자체 shard2 PASS는 현재 OFF head 검증 아님 | canonical standalone 테스트만 안전 재사용, old UI10/marker ON 사용 금지 |

**원본 관련 실패 파일 합집합(최소 확인):** `resource-excel-export-ui.spec.ts`, `task-editor-form-density.spec.ts`, `project-gantt-inline-name.spec.ts`, `milestone-visibility.spec.ts`, `relation-dialog-ux.spec.ts`, `project-gantt-stability.spec.ts`, `project-gantt-fullscreen.spec.ts`, `project-search-filter.spec.ts`, `project-notifications.spec.ts`, `milestone-stage-exchange.spec.ts`. 초기 #2227/#2246 및 취소 11 Run의 실제 trace/경계 전체를 동결된 test-level union으로 회수한 것은 아니므로 **INCOMPLETE**, 더 작은 파일 수로 전수 검증했다고 주장하지 않는다.

## 현재 REWORK / 동일 source 경계 (2026-10-25)

1. A/B: 공개 GitHub 원본 Run 21개 metadata와 #2278 Jobs 확인, 과거 Issue 댓글/기존 Packet/PR 헤드·병합 충돌 대조. 10 FAIL·11 CANCELLED 및 #2278 직접 E2E5를 합산; old 6-shard와 현재 8-shard 불혼합.
2. C/D: 제품 원본 #667/#552 소비자와 old #553 비교: 역사적 marker ON/spec/코어 viewport patch는 최신 운영 계약과 충돌. 공통 기능을 되돌리지 않고 **main source에 교환 단위만 선택 이관**.
3. E: Source: `tests/fixtures/issue-553/canonical-interchange.ts`, `tests/integration/milestone-timeline-interchange.test.ts`, `tests/e2e/milestone-timeline-interchange-http.spec.ts`, `src/features/projects/project-excel-export-button.tsx`, `tests/e2e/project-gantt-image-export.spec.ts`. 새 가이드/추적표/Packet과 PATCH 0.133.3; security/schema/runtime/CI flags 불변.
4. F: 이 실행 환경에서는 GitHub 원격 Repository Connector만 접근 가능하고 Node/npm/Chromium/SQLite 재현용 repository working tree·의존성 실행 환경은 제공되지 않음. **LOCAL TEST NOT TESTED**; 과거 old SHA 로컬 PASS는 새 main HEAD의 PASS로 이월 불가.
5. G: old PR merge 충돌은 first-parent old HEAD, second-parent 최신 main인 **보존형 통합 커밋**으로 해결하고 새 tree는 최신 main+선택 경계로 고정한다. force/rebase/기존 CI 기록 삭제 없음. 스레드 0 (확인), 최신 PR CI Full8 실행 직전 원장 저장. 새 정확 HEAD·Run은 Issue 댓글로 별도 추적; **새 PR CI quality/e2e/docker/Trusted QA/Owner ACCEPT NOT TESTED**, release_authorized=false, merge/Main/GHCR/issue close/branch cleanup 없음.

추가 조사 조건: 새 CI direct failures는 기존 Run/Attempt와 비교해 위 원장에 **추가**하고 취소된 Job에서 확인되는 원본 오류를 보존한다. Test skip/timeout·tolerance 확대/Required gate 완화로 성공 처리하지 않는다.


## F553-G — PR #562 / Full PR CI #3272.1: standalone Refs 누락 (2026-10-25)

| 증거 | 원본 |
| --- | --- |
| 원본 run | [Run 40160694952, #3272.1](https://github.com/planner77/masterGantt/actions/runs/40160694952), event `pull_request`, attempt 1, 2026-10-25T04:06:54Z, FAILURE |
| 귀속 | Issue #553, PR #562, branch `feat/issue-553-milestone-interchange-regression`, HEAD `c906cadffbdaa9f02db01534c17332897014ff55`, base `22144ce3844ab50ac0f22a715742c9df82e072e8`, test-merge `75ef336a6dc085827e9aabfa467f487fd6bafe7a` |
| 직접 실패 | Changes Job ID 121071428069, step `python3 scripts/verify-ci-run-trace.py`, exit 1: `PR 본문에는 canonical 'Refs #<Primary Issue>'가 정확히 1개 필요합니다: []` |
| Expected vs actual | standalone `Refs #553` 정확 1개 필요. 실제 PR body `Refs #553 · #548 · #552 · #574`는 정규식 `^Refs #N$`에 불일치. 분류: **POLICY_CI/metadata**, CI parser 정상 fail-closed |
| 파생 실패 | PR Fast Gate 121071484889 (changes=failure, preflight=skipped); Required Build/static/unit 121071531270, Chromium E2E 121071531136, Docker 121071531108, QA Final Automated 121071548951 실패는 **직접 제품 오류 아님**. QA Final trusted boundary 121071427955 SUCCESS도 QA_FINAL PASS가 아니다 |
| 미실행·취소 경계 | QA Preflight, Policy, TypeScript, ESLint, Vitest, Next build, Chromium 8개 구현 shard, Docker 구현은 SKIPPED/NOT RUN. metadata-only/LOW targeted/Main GHCR도 SKIPPED. 별도 Run 40160694934 (advisory) skipped는 Full PASS 아님 |
| 기존 이력 보존 | 과거 21 Full Run = 10 FAIL + 11 CANCELLED. 이번 22번째 Full = **11 FAIL + 11 CANCELLED**. 6-shard 역사/현재 8-shard 미실행을 성공으로 바꾸지 않음. 옛 취소/초기 test-level 전체 실패집합 INCOMPLETE 유지 |
| 추가 사전 결함 후보 | Base `scripts/qa_preflight.py`와 `scripts/qa_final_automated.py` 분석: Issue body AC1.. 식별자 **없음**, Work Packet에 정확 `## DOCUMENTATION_SYNC`/`## AC_TEST_COVERAGE` 없음. Preflight는 직전 Run에서 SKIPPED이므로 이는 **실행되지 않은 사전 구조 위험**, 별도 직접 FAIL로 계수하지 않음 |
| 한정 보완 | PR body에 독립 `Refs #553` 단 1개, 관련 #548/#552/#574는 별도 관련 이슈 문장. Issue 기존 수용기준 10개를 AC1~AC10으로 색인. 본 Packet에 `docs_required`의 11개 필수 문서 UPDATE/N/A(reason), AC1..AC10 테스트·미실행 mapping. 코드/test assertion/CI/Required/timeout/shard/보안 변경 없음 |
| 재검증/미검증 | GitHub 신뢰된 base Python regex/docs_gate와 PR/Issue live metadata 대조 **정적 기준 확인**. 로컬 Node/Vitest/Playwright/native SQLite **NOT EXECUTED**, 향후 새 HEAD Quality/Full E2E8/Docker/QA/Owner **NOT TESTED** |
| 리뷰/충돌 | GraphQL review threads 0 및 reviews 0, 현재 PR `mergeable=true`, base main 정렬. 정식 MERGE_READY는 별도 CI/Trusted QA/Owner 승인이 필요 |
| handoff | 기존 PR을 force/rebase하지 않고 동일 branch fast-forward 후 새 Full PR CI 시작만 확인; CI 모니터링, merge/Main/GHCR/Finalizer/Issue 종료 안 함 |

F553-A~F의 원본 매트릭스와 교정 근거는 위 항목에 그대로 보존한다. 이 실패는 E2E/제품 결함으로 확정되지 않았으며, 다음 Run의 실제 첫 실패가 생기면 이 원장에 추가한다. 원시 Runner 로그/기밀정보를 Git에 보관하지 않는다.


## F553-H — 2026-10-25 PR #562 Full #3274.1, 정확 Shard Plan 파일 인벤토리 직접 실패

| 구분 | 확인된 원본 증거 / 판단 |
| --- | --- |
| 원본 실행/귀속 | [Run 40162277020 / #3274.1](https://github.com/planner77/masterGantt/actions/runs/40162277020), `pull_request` FINAL_FULL, attempt 1, 2026-10-25T04:32:48Z, FAILURE. Primary #553 / PR #562 |
| HEAD/Base/Test merge | HEAD `b9e1028958196fffe3540a68ae4f4601c9d93f72`, base `22144ce3844ab50ac0f22a715742c9df82e072e8`, synthetic merge `a3c353d94a4dfb791dde892f797cc408adadde9d` (부모 base/head, tree 동일성 Git API 확인) |
| 직접 실패 Job | `Vitest 단위·통합 테스트` Job `121076245850`, step `Run npm test`: `tests/scripts/e2e-shard-planner.test.ts:109` — `covers all current specs exactly once after #767 eight-shard escalation`. Assertion expected 141 real E2E specs, manifest actual 140. Missing exactly `tests/e2e/milestone-timeline-interchange-http.spec.ts`, duplicate0, stale0 |
| Vitest/원본 통합 | Vitest **3293 PASS / 1 FAIL / 3 SKIPPED**, 280 suites 중 1 FAIL, 278 PASS, 1 SKIPPED; 새 `tests/integration/milestone-timeline-interchange.test.ts` **13/13 PASS**, 1297ms. `3 SKIPPED`는 별도 기존 `task-dependency-performance.test.ts`의 명시 skip; 이번 교정으로 추가한 skip 없음 |
| 다른 독립/파생 Job | `변경 경로 판정` 121076139631, `QA Preflight` 121076210022, ESLint 121076245806, TypeScript 121076245845, Policy 121076245932 모두 SUCCESS. `PR 빠른 검사 판정` 121076509315은 `UNIT_RESULT=failure`로 차단. Required Quality 121076557120 / Chromium E2E 121076557117 / Docker 121076557080 및 QA Final 121076572650 FAIL은 **upstream unit의 파생**. `PR Next.js production build`, Chromium 8개 Shard 실행, Docker 구현 모두 SKIPPED/NOT RUN |
| 분류 / 공통·차이 | `TEST_CONTRACT / POLICY_CI_INVENTORY`: old marker-ON/viewport/inline(F553-A~F)와 별개. 직전 F553-G(#3272)는 standalone Refs metadata 문제였고 **이번 #3274 changes/preflight PASS**로 해당 단일 문제의 직접 재발은 관측되지 않음. 새 HTTP E2E를 #552 main-first 최신 기준으로 선별 이식할 때 `tests/config/e2e-shard-plan.json`의 explicit 8-shard 등록과 정확 집합 guard를 함께 이식하지 않은 통합 누락 |
| 이전 기타 Run | [PR #562 Metadata-only #3273.1 / 40162212311](https://github.com/planner77/masterGantt/actions/runs/40162212311): 같은 **이전** head `c906cadf...`, event=`pull_request` edited/metadata-only, `PR metadata evidence` Job 121075997112 `FULL_FAILED` (이전 #3272.1 실패된 Full 출처) → required 3·QA 파생 FAIL. **별개 Full 테스트 실패로 세지 않음**. Fast advisory #102.1 / 40162277016 SKIPPED 역시 Full PASS 아님 |
| 과거 누적 비교 | 초기 old 21 Full = 10 FAIL + 11 CANCELLED; #3272 1 FAIL; **#3274 1 FAIL → 현재 확인된 Full 23회(12 FAIL, 11 CANCELLED)**. #3273 metadata-only 실패 1회 별도. 과거 취소 내부 실제 실패 수집 INCOMPLETE, 6-shard/8-shard 혼동 금지 |
| 조치 | 신규 정확 경로 한 개를 **Shard4**에 명시 등록, 기존 140개 할당 그대로. `tests/scripts/e2e-shard-planner.test.ts`의 `[18,17,18,17,17,18,17,18]` → `[18,17,18,18,17,18,17,18]`, 신규 파일→4 정확 pin. 기존 equality/duplicates/select union 및 stale-plan negative assertion 보존. `issue553ExplicitPlacement` 출처/비용/미측정 기록. CI validator·E2E runtime/spec 내용/timeout/skip/8-shard/Required gate는 변경 없음 |
| 배치 근거 | 최근 성공한 **main** 4회 `#3271.1=40159926912`, `#3268.1=40153743650`, `#3263.1=40148159242`, `#3260.1=40142096133`에서 **Shard4 wall 20.5 / 19.8 / 17.3 / 14.1분** 모두 SUCCESS. 신규 3-case의 구형 Full #2278 역사적 실행 28.4/6.8/13.2초는 이전 환경 참고만; 현재 신규 E2E 비용/Shard4 합산 미래 시간은 **NOT MEASURED**. 35분 한도 여유 추정은 PASS 보증 아님, 역사적 `projectedMs` 그대로 둠 |
| 동일 소스 검증/잔여 | GitHub 현재 `tests/e2e` 실제 상위 spec141개와 Plan 명시 파일141개 **정확 set equality**, duplicate0/stale0, 8 shard ID 1..8, 기존 140개 배치 불변을 원격 읽기 기반 JS 정적 대조 **STATIC PASS**. 새 Head Vitest/Node/Playwright/Docker 실행 **NOT TESTED** (원격 Full 실행 전), 기존 3 skip 불변. 원본 full/unit 실패는 PASS로 소급하지 않음 |
| 리뷰/충돌/후속 | 이전 리뷰 thread0/reviews0, `mergeable=true`/최신 main 정렬 확인. 새 Head push 전 재확인, fast-forward only / force=false, 최신 PR Full CI **시작까지만**. 이후 모니터링·병합/Main/GHCR/정식 Release/Finalizer/이슈 종료 금지. HIGH/OWNER_MANAGED, release_authorized=false |

원본 [F553-G](#f553-g--pr-562--full-pr-ci-32721-standalone-refs-누락-2026-10-25) 및 F553-A~F를 덮어쓰거나 최신 한 건만으로 진단하지 않는다. 원본 Job/Step·성공/미실행/취소 증거를 분리한다. 추가 direct failure가 밝혀지면 같은 원장에 Run/Attempt별로 누적한다.


## F553-I — 2026-10-25 PR #562 Full CI #3275.1: 구형 Milestone 토글 대기 E2E 실패

| 항목 | 원본 관찰·종합 판단 |
| --- | --- |
| Run 출처 | [Full Run 40163358017 / #3275.1](https://github.com/planner77/masterGantt/actions/runs/40163358017), attempt 1, event `pull_request`, 2026-10-25 04:50:40Z 시작, 결론 FAILURE. Issue #553, PR #562. HEAD `2a19bdf0d1d5afae547e8a1a094165bd5d617b58`, Base `22144ce3844ab50ac0f22a715742c9df82e072e8`, test-merge `745ddf999af593a03389b939b58c9bdd8ddbdc18` (정확 Base+Head 부모 및 동일 Git Tree 확인) |
| 최초 직접 실패 | Chromium shard **4/8**, Job **121079815242**, step `E2E shard 실행`, `tests/e2e/milestone-timeline-interchange-http.spec.ts:159`, 세 번째 `actual HTTP supported SVG variant and closed/import/session/revision atomic guards`: `locator.click`가 **존재하지 않는** `getByRole('button',{name:'◆ Milestone 표시',exact:true})`를 기다려 **기존 test timeout 160000ms 초과** (2.7분). Category `TEST_CONTRACT` — old marker-ON 테스트 계약을 #552 production marker-OFF baseline에 이식한 오류 |
| 기대/실제 | old #553 spec은 toggle.click 및 4개 Export 완료 후 `aria-pressed=false`를 요구. 실제 제품·[Presentation Policy](MILESTONE_PRESENTATION_POLICY.md)는 marker OFF, native M Grid row/Chart bar0, lane/guide0, 사용자 토글 **0**. 과거 #552 `milestone-visibility.spec.ts`도 toggle absence를 보호. 사용하지 않는 버튼을 복원하거나 test timeout만 늘려서는 안 됨 |
| 직접 PASS | 변경 경로·QA Preflight·TS·ESLint·Vitest·Policy·PR Fast Gate·Next production build·Docker implementation·Required Quality/Docker 모두 SUCCESS. Chromium shards **1/8, 7/8 SUCCESS**. Shard4는 **29 PASS / 1 FAIL** (전체 17.9분), 신규 HTTP 첫 두 건 JSON/Excel/Resource/Logistics·SQLite restart **32.7초 PASS**, Copy/Template/multi-root Copy/Cut **7.0초 PASS**. 해당 원본 Head에서만 유효 |
| CANCELLED/NOT RUN | 다른 shards **2/8,3/8,5/8,6/8,8/8 CANCELLED** (중간 일부 case 성공을 shard PASS로 승격 금지). 세 번째 #553 테스트는 line159 이후 JSON/Excel/SVG/PNG 다운로드·원자 거부 등 미실행. Chromium Required aggregate Job 121083249524, QA Final Job 121083263875 FAILURE는 직접 E2E 오류의 **파생**, 별도 제품 결함으로 중복 계산하지 않음 |
| Cross-run 원인 구분 | F553-G #3272 canonical Refs 오류: #3275 changes/Preflight 성공으로 직접 재발 관측되지 않음. F553-H #3274 141/140 Shard plan 미등록: #3275 Vitest/실제 8 shard 실행으로 직접 재발 관측되지 않음. F553-A~F의 old native marker/viewport 혼합 과거 장애 중 **구형 표시 E2E** 범주와 연결되며 새로운 제품 결함으로 단정하지 않음 |
| 원본 총계 | 기존 old Full **21회(10 FAIL/11 CANCELLED)** + #3272 FAIL + #3274 FAIL + #3275 FAIL = **24 Full 중 13 FAIL/11 CANCELLED**. #3273 metadata-only FAIL은 별개, FAST_DEVELOPMENT skipped는 PASS/Full 아님. 초기 취소 및 과거 test-level 전체 실패 집합은 INCOMPLETE 유지 |
| 보완 | `tests/e2e/milestone-timeline-interchange-http.spec.ts`에서 구 toggle.click/aria-pressed 단언을 `assertMarkerOff`로 교체. 원본 fixture의 **모든 Milestone ID**에 대한 native Grid row/bar가 실제 DOM 0, lane/guide 0, 사용자 토글 0을 **export 전과 JSON·Excel·SVG·PNG 각각 완료 후** 검사. 33 Task/8 Link/5 membership, real HTTP/SQLite, 원본 snapshot·revision 불변, If-Match, Summary 접힘·FREE 검색, Core instance, 실제 파일 bytes/OOXML/SVG polygon/PNG/URL revoke, 401/412/422/rollback·mutation0 검증은 삭제/완화 없음. 증거에 `markerOffNoNativeRowsOrLane:true` 추가 |
| 테스트 수명주기 | `tests/e2e/milestone-visibility.spec.ts` existing OFF native ID/zero effect **KEEP_UNIQUE**, 이 #553 실제 HTTP/Export는 다른 계약 **KEEP_UNIQUE + EXTEND**. 기존 Stage/Copy/Membership 원장, 실패 보안 경계, `tests/config/e2e-shard-plan.json` 141/141, 8 shards, original 160000ms, worker/Required/skip/timeout 불변. 원본 E2E/메타데이터/CI 기록 삭제나 PASS 소급 없음 |
| 증거·잔여 위험 | [원본 Shard4 로그](https://github.com/planner77/masterGantt/actions/runs/40163358017/job/121079815242), Playwright report Artifact 12586979975 및 실패 trace. 교정된 source는 GitHub blob/기존 #552 표시 정책 기준으로 정적으로 검토, 변경 Head 실제 Chromium/HTTP/SQLite·TypeScript/Vitest/Build/Docker **NOT TESTED**. 미해결 리뷰/merge conflict·새 PR CI는 게시 직전 재확인. 고위험 Owner-managed/release_authorized=false; 병합/Main/GHCR/Finalizer/Issue 종료·CI 모니터링 승인 없음 |

앞선 F553-A~H/원본 Run·Attempt와 취소·미실행 결과는 삭제하지 않는다. 특히 원래 line159뿐 아니라 **각 다운로드 후 반복되던 구형 toggle assertion도 함께 변경**해 동일 원인 반복 노출을 막는다.


## F553-J — PR #562 Full #3277.1: 8/8 E2E·Required3 성공 후 QA provenance BLOCKED (2026-10-25)

| 검토 | 증거 및 판정 |
| --- | --- |
| 실행 및 정확 출처 | [Run 40165691579 / #3277.1](https://github.com/planner77/masterGantt/actions/runs/40165691579), attempt **1**, event `pull_request`, started `2026-10-25T05:29:03Z`, Full final `FAILURE`. Issue #553/PR #562/branch `feat/issue-553-milestone-interchange-regression`. HEAD `f190b639daf775a95fbd382d62f27bace5400030`, Base `22144ce3844ab50ac0f22a715742c9df82e072e8`, test-merge `149a44b91abccdc239617d8a154773fef6d7d9f5` (Git 부모 Base+HEAD/Tree `9ae8d0530f4d00f60842ba9aad0c46cfc966d552` 직접 확인) |
| 직접 차단 | `QA Final — Automated` Job **121091214522**, `scripts/qa_final_automated.py` at 05:58:25Z → **BLOCKED**, error `mergeability 또는 test merge 불일치`. 검증기 `snapshot()`은 `live.mergeable is True` 및 `live.merge_commit_sha == TEST_MERGE_SHA`를 결합 확인한다. 실패 시점 개별 GitHub API 실제 값이 보고되지 않아 **둘 중 정확한 불일치 조건 UNKNOWN**; 제품/테스트 실패나 validator bug 확정 금지 |
| 외부 동시 변경 | Full 시작 시 repo main = event Base `22144ce...`. E2E 실행 중 **2026-10-25T05:39:31Z** [Main #3280.1 / Issue #797 PR #801](https://github.com/planner77/masterGantt/actions/runs/40166327552) push로 main이 `f431806329dd3af492e1eb6ce67bb73c1262d61e`로 변경(첫 부모 old Base). Main CI SUCCESS. 원본 Test-Merge는 old Base에 계속 묶임. 새 main 반영 시 PR API mergeability 재계산·source drift를 유발할 수 있어 **POLICY_CI/PROVENANCE_STALE**이 강하게 지지되는 가설이나 순간의 predicate 값 불명시 사실 보존 |
| 직접 PASS | Changes Job121086156378 / QA Preflight121086206286 / TypeScript121086262031 / ESLint121086262086 / Vitest121086262443 / Policy121086262096 / FastGate121086606580 / PR Next Build121086663904 / Docker smoke121086663914 **SUCCESS**. 세 Required Aggregate **Quality121086861505 / E2E121091200536 / Docker121087057128 모두 SUCCESS**. `QA Final 신뢰 경계 확인` Job121086156577 SUCCESS는 최종 승인 아님 |
| Chromium E2E | **8/8 Shards SUCCESS, cancellation 0, direct assertions FAIL 0**. Shard1 ID121086664119, 2 ID121086664043, 3 ID121086664009, 4 ID121086663948, 5 ID121086664038, 6 ID121086663958, 7 ID121086664187, 8 ID121086663990. Shard4 **92 passed (21.4m)**; #553 actual HTTP/SQLite+restart 32.1s, Copy/Template/multi-root 6.8s, JSON/Excel/SVG/PNG+401/412/422 atomic guard 13.7s 각각 PASS. Vitest **3294 PASS/기존 3 SKIP**, #553 integration **13/13 PASS**. 모두 원본 exact old Head/Base Test-Merge에 한정 |
| Cross-run 종합 | 원본 F553-A~F(old UI/scroll/inline/환경), G(#3272 Refs), H(#3274 141/140 explicit E2E plan), I(#3275 old ON toggle 160s) 관련 소비자 전부 이 old HEAD Full에서 재발 **미관측**. 그러나 과거 취소/미실행 범위는 불변 INCOMPLETE. 초기 Full21(10 FAIL/11 CANCELLED)+#3272/#3274/#3275/#3277 각1 FAIL = **전체 25 Full: 14 FAIL(이번 원인 QA boundary) + 11 CANCELLED**. #3273 metadata-only failure와 FAST skip은 별개, Full count 미포함 |
| 보호·해결 방향 | 신뢰된 QA 원본/실패 출처를 우회하거나 `mergeable` guard 완화 금지. 정확 최신 main에 **PR #562 보존형 first-parent old HEAD + second-parent current main** 병합 후 강제 push 없이 fast-forward. old Base→new Main #797 227 변경 파일 vs #553 현재 25 변경 파일의 **교집합은 `docs/exec-plans/active/PLAN.md` 유일**. 기존 652자 #553 prepend + 새 main PLAN의 #797 변경 전체와 이번 인계를 원문 합쳐 보존. #553 다른 24개 PR path는 new main과 중복이 없으므로 변경 blob만 선택 이관. 갱신된 new main `docs/TEST_PLAN.md`, `docs/UI_UX_GUIDELINES.md`, #797 UI audit/artifact도 전체 보존 |
| 실행/잔여 | 제품/API/DB/검증기/테스트 본문/8-shard·35m/timeout·retry·skip/Required3/Trusted/Owner·릴리스 정책/버전0.133.3 변경 없음. 원격 GitHub의 Run/Job/Commit diff·날짜와 docs/test lifecycle 조사로 원인 분석, 새 merge HEAD의 로컬 Node/Playwright/native SQLite 및 GitHub Full Quality/E2E8/Docker/QA/Owner는 **NOT TESTED**. 리뷰 스레드·충돌 확인 후 새 Full CI 등록까지만. Merge/Main CI/GHCR/Release/Finalizer/Issue Close/branch cleanup 및 모니터링 미승인 |

F553-A~I의 원본 Run/Attempt·실패/취소·수정/미검증 항목은 변경하지 않는다. #3277의 3 Required 및 8/8 PASS를 이번 새 Head의 QA Final/Owner PASS로 이전하지 않는다.
