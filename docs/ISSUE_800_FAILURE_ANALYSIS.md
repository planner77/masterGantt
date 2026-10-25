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
