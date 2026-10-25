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
