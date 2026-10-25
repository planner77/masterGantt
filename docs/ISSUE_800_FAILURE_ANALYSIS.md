# Issue #800 — PR CI 누적 실패 원장 (단일 Source of Truth)

대상: [Issue #800](https://github.com/planner77/masterGantt/issues/800) / [PR #805](https://github.com/planner77/masterGantt/pull/805). [AGENTS.md](../AGENTS.md), [원장 정책](PR_CI_FAILURE_TRIAGE.md), [Issue #800 Work Packet](exec-plans/active/ISSUE_800.md)을 따른다. 이 파일은 모든 새 실패/attempt를 덧붙여 축적한다. 원본 FAIL/CANCELLED/NOT RUN을 PASS로 수정하지 않는다.

## 누적 실행 매트릭스

| 원본 source | HEAD / base / test merge | 최초 직접 실패 | 파생·미실행 | 후속 |
| --- | --- | --- | --- | --- |
| [PR #805 Full #3281.1](https://github.com/planner77/masterGantt/actions/runs/40168112076) (run ID **40168112076**, attempt **1**, 2026-10-25 06:09~06:10 UTC) | Head `a669546b231b805f723aa0015797473039033cee`, base `f431806329dd3af492e1eb6ce67bb73c1262d61e`, event `pull_request / opened FINAL_FULL`, test merge `b18021fc39fcc5aafe3ca7a6c3e96177fefb657e` (PR Fast Gate checkout 로그) | QA Preflight `RISK_LEVEL/QA_METHOD/QA_REQUIRED/PATH_POLICY/DOCUMENTATION_SYNC` FAIL; separate QA Final route `qa_method` BLOCKED | Fast Gate FAIL은 Preflight/정책·Node 미실행의 파생. Quality/E2E/Docker Required3 FAIL, 실제 TypeScript/ESLint/Policy/Vitest/Build/Chromium8/Docker smoke SKIPPED/NOT RUN. | Metadata/Work Packet·P1/P2 검증 강화 후 **새 HEAD Full CI 필요** |

[Run #3281.1](https://github.com/planner77/masterGantt/actions/runs/40168112076) 최초에는 성공한 `변경 경로 판정` Job(121093218451), shadow advisory(121093395664)가 있었다. `FAST_DEVELOPMENT #107.1`([run 40168112111](https://github.com/planner77/masterGantt/actions/runs/40168112111))은 동일 HEAD의 non-authoritative SKIPPED이며 Full CI 성공도 추가 FAIL도 아니다. 서로 다른 attempt 및 Head는 합산하지 않는다. 취소한 E2E shard의 직접 FAIL 증거는 해당 Run에 **없음**(모든 실제 shard SKIPPED). Main/Release/Finalizer는 해당 PR에서 실행되지 않았다.

## F800-R001 — 원본 QA Preflight와 정책 차단

원본 Job: **121093277535**, step `원본 base SHA의 QA Preflight 실행 (read-only)`, 결과 FAIL(경과1.579초, FAIL5/DEFERRED5). [Actions 로그](https://github.com/planner77/masterGantt/actions/runs/40168112076/job/121093277535) 및 `qa-preflight-40168112076-1` Artifact ID **12589965068**, [원본 Artifact](https://github.com/planner77/masterGantt/actions/runs/40168112076/artifacts/12589965068).

신뢰된 base `scripts/qa_preflight.py::_unique_field`는 PR 본문의 **정확히 한 개의 독립 한 줄 필드**를 요구한다. 원래 PR 설명에서는 `risk_level: HIGH`, `qa_method: OWNER_MANAGED`, `qa_required: true`를 여러 Markdown inline backtick을 쉼표로 묶어 표시해서 regex가 하나도 인식하지 못했다. 정확한 원본 실패:
- RISK_LEVEL: `risk_level: 정확히 한 개의 선언 필요`
- QA_METHOD: `qa_method: 정확히 한 개의 선언 필요`
- QA_REQUIRED: `qa_required: 정확히 한 개의 선언 필요`
- PATH_POLICY: 위 위험/QA 미확정의 **파생** (허용되었다는 증거 아님)
- DOCUMENTATION_SYNC: `docs/exec-plans/active/ISSUE_800.md: Work Packet ## DOCUMENTATION_SYNC 누락`.

원래 QA Final route Job **121093218571**, step4 FAIL: `QA 경로 BLOCKED: PR 본문 qa_method의 명시값 필요`. 이는 동일 metadata 결함을 base validator가 독립 확인한 것으로, 기능 검증 실패가 아니다. Fast Gate Job **121093329284** FAIL: `PREFLIGHT_RESULT=failure`, `POLICY/TYPECHECK/LINT/UNIT=skipped`. Required aggregate Quality Job **121093377703**, E2E **121093377681**, Docker **121093377662**는 모두 FAIL(Preflight 차단의 파생)이며 실제 구현은 모두 SKIPPED; 이를 제품 test FAIL로 계수하지 않는다. 비정상 종료/취소를 전체 PASS로 대체하지 않는다.

분류: **POLICY_CI (PR metadata/Work Packet 입력 계약 불충족)**. 신뢰된 validator·Required Check 완화 없이 PR body에 독립 5개 metadata 선언을 추가하고, 같은 Work Packet에 `## DOCUMENTATION_SYNC` (파일별 UPDATED/N/A)·`## AC_TEST_COVERAGE` (AC1~AC6 원본 assertion/미실행 매핑)을 추가한다.

## F800-R001-REVIEW — 동일 HEAD의 미해결 Code Review 2건

기존 Full CI는 Preflight에서 차단되어 브라우저가 실행되지 않았으므로 다음 두 지적은 **정적 source 분석에 의한 잠재 직접 회귀/거짓 PASS 위험**이며 새 Chromium 실패 로그가 아니다.

| Thread/댓글 | 근거 / 영향 / 보완 | 검증 |
| --- | --- | --- |
| [P1, comment 4369868207](https://github.com/planner77/masterGantt/pull/805#discussion_r4369868207), `PRRT_kwDOUUB7Bc6v-5ys` | KPI `logistics-dashboard-view` 카드는 `h4`, 기존 observer는 뒤에 오는 관련 Milestone `h3`을 header로 선택하여 `firstSummary.y >= header.y`라는 거짓 회귀 실패를 만들 수 있다. KPI의 context anchor를 실제 view root로 정하고 동적 관점은 기존 title heading 유지. 제품 KPI/렌더러 변경 없음. | source 보완 완료, 실제 동일 HEAD browser **NOT TESTED** |
| [P2, comment 4369868209](https://github.com/planner77/masterGantt/pull/805#discussion_r4369868209), `PRRT_kwDOUUB7Bc6v-5yt` | before/after의 `reports: []` 양쪽이 같으면 snapshot/spec/filter/totals가 없는 비교가 PASS가 되는 위험. 비KPI 25쌍의 양쪽에 최소1건의 유효한 `snapshotId`, `spec.root`, `filters`, `totals`, `range`, `asOfDate` 수신 영수증을 요구한 후 원본 값 비교. 누락은 FAIL/NOT_COMPARABLE이며 KPI는 WBS report가 없으므로 예외 유지. | source 보완 완료, 실제 synthetic negative + 역사 캡처 비교 **NOT TESTED** |

## REWORK 범위·검증·인계

- 기존 원장 대조: #800 첫 Full run/attempt이므로 이전 같은 Issue 원격 실패 없음(이 시점 조회 기준). #797/#798/#799 실패 분석은 서로 다른 이슈·원본의 선행 지침/fixture 맥락으로만 참조; 이 원장의 실패 횟수에 합산하지 않는다.
- 수정: PR 본문 metadata(별도 `edited` 이벤트는 새 Full의 성공 증거 아님); `docs/exec-plans/active/ISSUE_800.md` 문서 구조·AC; `tests/e2e/helpers/ui-geometry.ts` KPI anchor; `tests/manual/issue-800-compare-geometry.mjs` 조회 증거. `src/`/CI/workflow/lockfile/API/DB·QA gate·shard 변경 **없음**.
- TEST_LIFECYCLE_REVIEW: 기존 `#798 다섯 관점` 원본 하나 EXTEND, #732~736/API/Gantt·Editor/권한·state KEEP_UNIQUE, 수동 comparator는 opt-in ADD. 이전 리뷰를 해결 처리하기 전에 해당 source diff와 댓글 응답을 확인한다.
- 로컬/원격 보완 검증: GitHub source/validator 구조 검토 외 local Node/TypeScript/ESLint/Chromium/negative comparer 실행 **NOT TESTED**, 원격 새 Full CI 및 Trusted QA도 **NOT TESTED**. 특정 source를 검사하지 않은 상태를 PASS라고 보고하지 않는다.
- 차기 Gate: 최신 main·PR Head/mergeable·0 unresolved review threads 확인 → Ready PR에 새 source `synchronize`로 Full PR CI **시작**, 이후 모니터링하지 않음. Risk HIGH, qa_method OWNER_MANAGED, qa_required true, Manager ACCEPT/merge/Main/GHCR/Finalizer/Issue 종료는 승인·증거 별도.


## F800-R002 — Metadata-only #3283.1은 이전 Full FAILED의 확인 (2026-10-25 UTC)

[PR metadata #3283.1](https://github.com/planner77/masterGantt/actions/runs/40168523258), Run ID **40168523258**, attempt **1**, event `pull_request / edited METADATA_ONLY`, Head `a669546b231b805f723aa0015797473039033cee`. PR 본문을 규정대로 갱신한 **동일 Head**가 대상이다. QA route Job 121094422996은 SUCCESS(최초 qa_method 파싱 보완의 근거)이지만 metadata evidence Job **121094478976**은 `FULL_FAILED · full_run=40168112076 · Full CI 40168112076.1 conclusion=failure`를 확인해 FAIL. Automated QA Job **121094541000** `required quality 미성공` FAIL; Required3 집계도 FAIL. 독립 Chromium/TypeScript/Docker 구현 PASS가 아니다. 분류 `POLICY_CI / 기존 Full failure 파생`. metadata-only를 Full 재실행/성공으로 계수하지 않는다.

## F800-R003 — 중간 synchronize Full3건의 취소·실패 보존

연속 보완 commit이 PR HEAD를 교체하는 동안 발생한 별도 **전체 검증** 세 Run이다. 모두 원격 `conclusion=cancelled`이지만 일부 Job은 실제 failure 출력을 남겼다. Run을 하나의 FAIL 또는 PASS로 단순화하지 않는다.

| Run·attempt·Head | 확인한 직접/간접 Job 결과 | 미실행·판정 |
| --- | --- | --- |
| [#3284.1 / 40168580992](https://github.com/planner77/masterGantt/actions/runs/40168580992), `a5bebc6b55b86d77bf810b98d41d085337aa312a` | QA route PASS, 변경 경로 PASS; QA Preflight CANCELLED, PR Fast Gate Job121094691120 FAIL; Required3 aggregate FAIL; Automated QA Job121094754744 `PR latest Head stale` BLOCKED | Unit/ESLint/TypeScript/E2E/Shards/Docker 구현 CANCELLED. stale는 이후 HEAD 교체의 인증 차단, app test FAIL 불명. |
| [#3285.1 / 40168609095](https://github.com/planner77/masterGantt/actions/runs/40168609095), `d382b645f24523445152dbde4f7290ad201e2eda` | QA Preflight Job **121094850381** `FAIL 1: Work Packet ## DOCUMENTATION_SYNC 누락` (원래 5개 중 metadata3 해결). PR Fast Gate Job121094901752와 Required3 aggregate FAIL; Automated QA Job121094958431 FAIL | TypeScript/ESLint/Vitest/Chromium/Docker 구현 SKIPPED/CANCELLED. 원본 누락 교정은 Work Packet 후속 HEAD에서 수행. |
| [#3286.1 / 40168686669](https://github.com/planner77/masterGantt/actions/runs/40168686669), `0b5108102ec4495487eb5c5fd045f52b95145018` | QA route Job **121095004256** `최신 PR/head/base 귀속 검증 실패 (stale이면 재실행 필요)` FAIL. PR Fast Gate/Required3 FAIL(의존/취소 파생) | QA Preflight/실제 구현 검사 CANCELLED, 자동 QA CANCELLED. 해당 Run의 TEST PASS 증거 없음. |

- 3284와3286의 aggregate FAIL은 취소/정책 의존의 **파생**으로, 원본 Chromium shard test의 직접 단언 실패를 증명하지 않는다. 3285의 유일한 확인된 직접 정책 FAIL은 `DOCUMENTATION_SYNC` 누락이며 다음 Head에서 필수 `## DOCUMENTATION_SYNC`와 `## AC_TEST_COVERAGE`를 추가했다.
- [#3287.1](https://github.com/planner77/masterGantt/actions/runs/40168731490), Head `cf467fb8754414dc50d34ddfd10d9692b6864e89`은 2026-10-25 06:21 UTC 시점 **in_progress** 상태까지 식별했다. 이 기록은 PASS·FAIL 판정이 아니며 추후 source update가 해당 실행을 supersede할 수 있다. 이번 최종 통합 Head의 새 Full run/attempt는 실제 시작 확인 후 별도로 인계한다.
- 반례/공통 원인: Run #3283에서 metadata parser가 고쳐졌음에도 기존 Full이 실패해 metadata-only만 재실행하는 것은 해결이 아니다. #3285가 해당 metadata에 관해 실패1건만 남긴 것은 교정이 작동했음을 보여 주지만, 해당 Run은 완결되지 않았으므로 문서 gate 또는 제품의 실제 PASS를 증명하지 않는다.
- REWORK 정적 검토: `qa_preflight.py`와 `qa_final_automated.docs_gate`의 선언·section 정규식에 따라 PR body의 metadata 5개는 정확히 각각 독립 한 줄 1회, Work Packet의 `AC1..AC6`/`DOCUMENTATION_SYNC` 및 `docs/TEST_PLAN.md: UPDATED` 원장 일치가 확인되었다. 실제 새 Full remote 결과는 **NOT TESTED**. 테스트/보안/권한 Gate 우회 없음.


## F800-R004 — #3288.1 Full의 전체 구현 PASS 이후 QA Final 출처/병합 차단 (2026-10-25)

| 귀속 | 원본 |
| --- | --- |
| Issue/PR | [#800](https://github.com/planner77/masterGantt/issues/800) / [#805](https://github.com/planner77/masterGantt/pull/805) |
| 원본 CI | [Full PR CI #3288.1](https://github.com/planner77/masterGantt/actions/runs/40169055755), run ID 40169055755, attempt 1, event pull_request/synchronize, 완료 2026-10-25 07:20 UTC |
| source | HEAD `9daa8d722dd1daeff0eb78f712f2b887e4efa9bb` / 이벤트 Base `f431806329dd3af492e1eb6ce67bb73c1262d61e` / 이벤트 Test Merge `f6b0dc34435807254dd91685ae41ca025e9ff65f` (parents Base/HEAD, 당시의 인증된 tree) |
| 직접 실패 | QA Final — Automated Job **121105760594**, step3 `최신 PR 증거·문서·리뷰 확인`: `자동 QA BLOCKED; 사유: mergeability 또는 test merge 불일치` |
| 실제 성공 | QA route·Preflight·Policy·PR Fast Gate, TypeScript, ESLint, Vitest, production build, Chromium E2E shard 1/8~8/8 및 E2E Required aggregate, Quality Required aggregate, Docker Required aggregate **SUCCESS**. PR Docker 구현 Job SKIPPED(경로 판정에 따른 정상 분기) |
| 별도 미실행 | Independent QA / Owner ACCEPT / Main/GHCR/Finalizer **NOT TESTED**; 사용자 요청 전 merge 금지 |

**시점·원인:** PR #805의 원본 Test Merge는 06:25:50 UTC 구 Base `f431806` 기준으로 구성되었다. CI 진행 중 06:54:52 UTC에 [#553/PR #562](https://github.com/planner77/masterGantt/pull/562)의 병합이 Main을 `efc40c1864ffc3629f16d6956bf57c3b0889b96d` / 앱 v0.133.3으로 갱신했다. QA Final이 07:20:25 UTC에 현재 PR의 `mergeable`과 Test Merge를 재인증할 때에는 구 원본과 최신 기준이 달랐고 GitHub는 `mergeable=false / mergeable_state=dirty`를 보고했다. 이 때문에 소스/통합 충돌 상태를 fail-closed로 차단했다. **제품/Chromium 테스트 실패가 아닌 base-drift·Git 충돌/증거 귀속(POLICY_CI)**이며 기존 필수 성공 결과를 새 Head의 PASS로 승격하지 않는다.

**Main sync 교정:** 역사 원장과 최초 source는 보존하고 PR 원래 Head와 최신 Main의 두 부모를 갖는 실제 merge commit으로 정렬. 두 브랜치가 공통으로 수정한 파일은 `docs/PROJECT_UX.md` 1개이며, 양쪽이 당시 Base 앞에 각각 `#800`과 `#553` 안내 섹션을 prepend한 변경이다. Base 본문·main의 #553 전문·PR #800 전문을 정확히 모두 보존해 순서 `#553 → #800 → 원본`으로 충돌 해결. 나머지 #800 코드·fixture·docs 변경은 그대로, 최신 main의 Milestone/export·E2E shard plan·version 0.133.3 모두 유지. 변경 HEAD에 대한 이전 #3288 결과는 역사적 Run으로 유지하고 새로운 Full CI의 성공은 새 Run/Attempt로만 판정한다.

**검증·위험:** 원본 두 tree와 공통 Base의 blob SHA 및 전체 recursive tree 비교, 충돌 파일의 prefix/suffix 정확 일치, 변경 외 모든 main 경로 보존/PR 변경 경로 보존을 기록. 실제 병합 후 QA/Review thread 0·mergeable 재조회 및 새 PR CI 시작까지만 진행. 본 원장 작성 시 최종 병합 SHA/새 Run ID는 생성 전이라 미확정, 임의 PASS/성능 개선 수치 없음. Owner-managed HIGH, qa_required=true, release_required=false; CI 모니터링/병합/Main/GHCR/Issue 종료는 별도 지시 전 수행하지 않는다.
