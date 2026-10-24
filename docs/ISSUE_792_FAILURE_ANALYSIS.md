# Issue #792 — 누적 실패·재시도·충돌 원장

Primary Issue: https://github.com/planner77/masterGantt/issues/792
공통 분류: [PR_CI_FAILURE_TRIAGE](PR_CI_FAILURE_TRIAGE.md) · [Work Packet](exec-plans/active/ISSUE_792.md) · [#785 이력](ISSUE_785_FAILURE_ANALYSIS.md)

## F792-000 · 2026-10-24 · 착수 및 위험 한계

- baseline: main `b45885812301d14b9f673841e9944b27b2642323`에서 `feat/issue-792-legacy-source-scope-safety` 독립 분기. #785 원본과 공개 410 상태 보존.
- 직접 제품/CI 실패 관측: **없음 (NOT RUN/NOT TESTED, PASS가 아님)**. 기존 #785/#793의 역사적 실패는 본 Issue 실패로 복제하거나 원본 판정을 수정하지 않는다.
- 원인/조치 구분: #785에는 직접 archive 관계 안전 편집이 없어 Summary 바인딩 범위만 preview/confirm/in-place UPDATE 기능을 추가한다. 회원 변경·whole 정의·coverage·운영 DB 이전은 미구현·별도 승인 범위.
- 입력/실행: GitHub 커넥터 source fetch·branch 파일 편집만 가능. Node/npm/Vitest/Chromium/Docker/실제 오프호스트 데이터베이스 접근·로그 수집이 없어 로컬 검사 전체 `NOT TESTED`. 기존 테스트 Fixture를 확장했지만 테스트 작성은 실행 성공이 아니다.
- 보안/원자성 코드 위험: Origin/edit-session/If-Match+서버 재검사·source fingerprint·impact token·SQLite IMMEDIATE rollback·postcheck를 구현했다. 실제 공격·경합·운영 restore 실증이 끝나지 않아 `qa_required=true`/HIGH/OWNER_MANAGED/Owner 승인 전 병합 금지.
- 재현/교정: 현재 최초 CI 실패를 보고받지 않았다. 다음 Full Run의 **Job별 직접 FAIL**, skip/cancel로 인한 파생 Required3/QA와 exact Head/base/test-merge를 구분해 F792-001부터 추가한다.
- 처리 범위: PR 비Draft `opened`로 Full CI를 **한 번 시작**하고 모니터링은 하지 않는다. Merge/Main/GHCR/Finalizer/Issue 종료는 승인 밖.

## 로컬 코드 자기점검 기록 (원격 테스트와 구별)

| ID | 분류 | 수정/검토 | 실행 결과 |
| --- | --- | --- | --- |
| LOCAL-001 | 정적 위험 교정 | patch parser의 literal `true as const`로 TS 반환 타입 명확화 | 타입 검사 NOT RUN |
| LOCAL-002 | 정적 위험 교정 | UI Map tuple 타입, 취소 시 busy 해제, 브라우저 수동 Origin 헤더 제거 | Chromium NOT RUN |
| LOCAL-003 | 정적 위험 교정 | Vitest SQLite raw row 비교 callback을 `unknown` 안전 캐스트로 조정 | Vitest NOT RUN |
| LOCAL-004 | 정적 위험 교정 | 신규 subtree 후보의 provenance fanout 50,000건 경로 한도 검증 전치 | 단위테스트/부하 NOT RUN |
| LOCAL-005 | 정적 위험 교정 | 비활성 Target/member의 self→subtree 확대 차단, active coverage/regression 추가 | Vitest NOT RUN |
| LOCAL-006 | 검증 범위 확대 | orphan/인증·stale async body race/SQLite file restart·Equipment numeric coverage=4·역범위 복원 테스트 확장 | 실행 NOT RUN |
| LOCAL-007 | 브라우저 영향 테스트 | 기존 #726격리 SQLite·실제 브라우저 시나리오에 Summary source preview/apply·5폭·readonly·출처 불변 검증 추가 | Playwright NOT RUN |

## PR / Review / Merge / CI 출처 (F792-000 최초 PR 개설 전 상태)

- PR 번호, exact Head SHA, base SHA, test merge SHA: **PR 개설 전 미확정**. 개설 후 실제 영수증만 기록.
- 미해결 리뷰 스레드: **개설 후 별도 조회**; 다른 PR/#785/#793의 스레드를 임의 resolve하지 않는다.
- `mergeable`은 GitHub PR 검사에서만 확인하며 최신 main 정렬 후 재확인한다. 이전 base로 판정한 결과를 현행 최신으로 오인하지 않는다.
- `CI_STARTED`는 PR `opened` 이벤트로만 확인. Run ID/Attempt가 조회되지 않았거나 사용자 지시로 모니터링하지 않은 경우 **NOT CONFIRMED / NOT TESTED**로 기록한다.
- 재시도 시 취소 Run도 기록하고 cancellation 이전의 실제 첫 실패와 별개 집계 실패를 구분한다.

## 운영 검증 보류

| 항목 | 상태·근거 |
| --- | --- |
| 운영 원본 row/coverage/Task/Assignment before/after | NOT TESTED — 운영 DB 접근 없음 |
| 외부 클라이언트 구형 API 사용량·410 영향 | NOT TESTED — 인증된 접속/consumer 로그 없음 |
| off-host SQLite backup+manifest+restore+restart | NOT TESTED — 운영 볼륨/복구 호스트 접근 없음 |
| 사용자 UI 390·768·1024·1440·1920px, Tab/Escape/focus | NOT TESTED — 브라우저 세션 없음 |
| Owner HIGH 위험 수용·정확 Head Trusted QA | NOT TESTED — 원격 완료 후 별도 |

변경 부채와 신뢰 경계는 [운영 가이드](TARGET_RESOURCE_OPERATIONS.md)와 [Issue #792 Work Packet](exec-plans/active/ISSUE_792.md)을 따른다.


## F792-001 — PR #795 첫 Full Run #3231.1 실패 · 누적 사건 (2026-10-24 KST)

**원본 증거 (수정으로 소급 PASS 금지)**

| 항목 | Source / 원본 결과 |
| --- | --- |
| Primary / PR | [#792](https://github.com/planner77/masterGantt/issues/792) / [#795](https://github.com/planner77/masterGantt/pull/795) · non-draft opened |
| Run/Attempt | [Full #3231.1 / 40067826081](https://github.com/planner77/masterGantt/actions/runs/40067826081) · attempt=1 · workflow `.github/workflows/ci.yml` ID 356198495 · `pull_request` · 2026-10-24 05:50:24Z 시작, 05:51:28Z 종료 · `FAILURE` |
| 정확 원본 Head/Base | head `8f1cab235bd9d15845e729641020e936dc42be79`; base `b45885812301d14b9f673841e9944b27b2642323` · `feat/issue-792-legacy-source-scope-safety` |
| 원본 test-merge | 현재 `refs/pull/795/merge`는 수정 Head와 함께 이동했으므로 원본 merge SHA로 사용 **금지**. 원본 CI artifact/checkout SHA 별도 인증 전 `UNKNOWN` |
| 직접 Job/Step | `QA Preflight — 정책·문서 사전 검사` [Job 120794727284](https://github.com/planner77/masterGantt/actions/runs/40067826081/job/120794727284) Step4 `원본 base SHA의 QA Preflight 실행 (read-only)`: `FAIL / DOCUMENTATION_SYNC: docs/exec-plans/active/ISSUE_792.md ... Work Packet ## DOCUMENTATION_SYNC 누락`. QA Preflight JSON artifact [12550066959](https://github.com/planner77/masterGantt/actions/runs/40067826081/artifacts/12550066959) |
| 통과 | 변경 경로 판정 Job120794676490 `SUCCESS`, QA Final 신뢰 경계 확인 Job120794676639 `SUCCESS` (이 성공이 최종 Trusted/Owner PASS는 아님), 변경 영향 Shadow Job120794821828 `SUCCESS` advisory |
| 1차 파생 | PR Fast Gate Job120794772122 `FAIL` (`PREFLIGHT_RESULT=failure`, policy/typecheck/lint/unit skipped), Quality aggregate Job120794805118 `FAIL`, Chromium aggregate Job120794805191 `FAIL`, Docker aggregate Job120794805277 `FAIL` |
| 2차 파생 | QA Final Automated Job120794821847 `FAIL` (required quality 미성공). 근본 Chromium·Docker 실패가 아님 |
| 미실행/중단 | Policy, TypeScript, ESLint, Vitest, PR Next production build, Chromium E2E 8개 구현 shard, Docker smoke 구현 모두 `SKIPPED/NOT RUN`. 첫 원격 제품 테스트 PASS/FAIL을 주장할 수 없음 |
| 다른 Run | 동일 원본 Head의 FAST_DEVELOPMENT Run40067825998(#70.1)는 `SKIPPED`이며 Full/Required PASS로 계산하지 않음. 최초 Run 이후 동기화 HEAD 자동 발생·취소 여부는 각각의 source/attempt로 별도 확인 |

**분류 및 교정 (F792-001의 연쇄 원인을 하나로 묶음)**

- **POLICY_CI / Work Packet 구조 계약 위반(확정):** 최초 `## DOCUMENTATION_SYNC / N/A` 제목은 신뢰된 `scripts/qa_final_automated.py::section(plan,"DOCUMENTATION_SYNC")`의 `^## DOCUMENTATION_SYNC$`와 불일치. Preflight는 가장 먼저 이 조건을 거부하여 제품 검증을 진행하지 않았다. 기존 [#703](ISSUE_703_FAILURE_ANALYSIS.md)/[#608](ISSUE_608_FAILURE_ANALYSIS.md)의 동종 교정 선례와 다르지 않다.
- **추가 잠재 문서 차단(원본 Job에서는 미관측, 구조 감사로 확인):** H2를 바로잡아도 `docs_gate`는 `- \`path\`: UPDATED|N/A(reason)`별로 QA_DOCS∪DESIGN/API/DB_SCHEMA/TEST_PLAN을 요구하며 `AC_TEST_COVERAGE`의 `- AC1:`~`- AC6:` 행도 요구한다. 원래 일반 `UPDATED:` 단락·AC Markdown 표는 이 규격이 아니므로 같은 수정을 일괄 반영한다. CI validator/QA/Required를 바꾸지 않는다.
- **별도 PRODUCT/UX P1 리뷰 #4366175663 (원격 CI 직접 원인 아님):** Scope PATCH `busy`는 과거 nested UI 내부에만 있고 parent `TaskLogisticsLinkEditor`의 `onPendingChange`는 `saving`만 보고하였다. PATCH 뒤 `ProjectTaskEditor.reload(true)`가 다른 사용자 초안을 무확인 초기화할 수 있다. `legacyScopePending`을 기존 pending 잠금에 합산하고 PATCH 및 canonical reload 전체 기간에 true, 완료/오류 finally에 false. 탭 버튼/키보드도 parent `locked`으로 보호. [리뷰 답글](https://github.com/planner77/masterGantt/pull/795#discussion_r4366206416), 동일 inline thread `PRRT_kwDOUUB7Bc6v2Bgm` **resolved** (실제 원격 스레드 확인).
- 동일 레거시 source writer 범위/보안/임시 토큰·Origin/409/412·whole/subset+coverage/직접 관계·WBS/Excel·외부 소비자/운영 복구 계약은 불변이다. 잠금 추가와 doc 구조만 변경하고 skip·timeout 증가·Policy 완화·DDL/flatten 없음.

**Cross-run 실패 합집합 및 다음 실행 범위**

| F-ID | 원본 실패 항목 | 이전 원인·교정 | 최신 직접/인접 검증 |
| --- | --- | --- | --- |
| F792-000 | 최초 PR 전 제품/CI 실패 없음 | 사전 설계·코드 원장(테스트 작성 ≠ 실행) | 미래 Full 결과를 이전 PASS로 대체 불가 |
| F792-001 | #3231.1 QA Preflight `DOCUMENTATION_SYNC` | 정형 H2, 파일별 상태·정확 AC1~AC6 매핑 | trusted `docs_gate` 재실행 필요, source HEAD 결과 전 `NOT TESTED` |
| P1-REVIEW | #795 댓글4366175663 · scope PATCH 중 Task Editor 초안 소실 위험 (CI 실패 원인과 별개) | writer 합산 pending·tab/keyboard 잠금, #726 실제 HTTP delayed PATCH 테스트 EXTEND | 신규 Chromium 8-shard 및 keyboard/readonly/response 오류/초안 보존 `NOT TESTED` |

- 직접 실패 **테스트 파일 합집합**: 0개, 첫 Full은 문서 사전 Gate에서 차단되어 Unit/E2E/Build/Docker 구현 미실행. **신규 교차 보호**는 `tests/e2e/issue-726-task-logistics.spec.ts`, `tests/server/logistics/task-target-bindings-handlers.test.ts`, `tests/server/logistics/task-target-bindings.test.ts`, #785 Copy/Template/OOXML·WBS Resource 공통 경계다. 임의 테스트 삭제/통합/약화 없음.
- 로컬 환경: git clone 대상 GitHub DNS 접근 불가, Node 전용 실제 의존성 설치·TypeScript 전체 빌드/Chromium/Docker 불가. 커넥터 소스 검사·Python 계약과 동등한 구조 정적검사만 수행; 실행 전 `NOT TESTED`. 새 exact Head의 원격 Full8·Trusted·Owner가 실제 검증이다.
- 이후 rework는 동일 PR #795/branch, latest main 비교 behind=0·Git mergeable·미해결 리뷰 0을 확인하고 정상 non-draft `synchronize` Full을 시작한다. 신규 Run/Attempt·정확 Git HEAD는 Github 원본에서 확인 후 Issue STATUS에 기록, 결과 모니터링 생략; 미확인 Result는 `NOT TESTED`. Merge/Main/GHCR/Release/Finalizer/Issue close 금지.

## F792-002 — PR #795 Full #3239.1 DOCUMENTATION_SYNC AC7 mapping failure

### 원본 provenance / 직접 실패 (2026-10-24 KST)
- [PR #795 Full Run #3239.1](https://github.com/planner77/masterGantt/actions/runs/40069142338) — `CI` (`pull_request`), **Run ID `40069142338`, attempt 1**, 2026-10-24 06:10:25Z 시작·06:11:32Z 종료, `FAILURE`.
- Immutable Head `4819a8f8134ca5f5c74e13faf1123121541cdc2c`; base/main `b45885812301d14b9f673841e9944b27b2642323`; 해당 Run의 변경 경로 판정 checkout/test-merge `6db0c7017faacc081776724d13ddd793034a5dcc` (Job `120798594011`의 fetch/checkout 로그). source artifact `ci-pr-source-40069142338-1` ID `12550845046`; preflight report artifact `qa-preflight-40069142338-1` ID `12550253899`.
- **직접 실패: `QA Preflight — 정책·문서 사전 검사` Job `120798654052` Step4 `원본 base SHA의 QA Preflight 실행 (read-only)`**. 결과 `FAIL:1/DEFERRED:5`, `DOCUMENTATION_SYNC`: `Issue AC / test evidence mapping 부족: AC7`. `PRIMARY_ISSUE`, `RISK_LEVEL`, `QA_METHOD`, `QA_REQUIRED`, `RELEASE_REQUIRED`, `RELEASE_AUTHORIZED`, `PATH_POLICY`, `ISSUE_AC`은 PASS.
- **직접 원인 분류 `POLICY_CI / TEST_CONTRACT`**: Issue #792 본문의 첫 문단은 이전 #785의 `AC4/AC7` 역사적 잔여 범위를 언급한다. 신뢰된 main의 `scripts/qa_preflight.py`는 issue 전체에서 `\\bAC\\d+\\b` regex로 숫자를 수집하고, `scripts/qa_final_automated.py::docs_gate`는 Work Packet `## AC_TEST_COVERAGE` 내 `- ACn:` 형식과 집합 포함을 검사한다. Issue 자체 체크박스는 AC1~AC6인데 intro의 **역사적 #785 AC7**이 추가로 포착되었다. #792에 AC7 기능이 새로 설계되거나 구현된 것이 아님. 임의 validator weakening/본문 삭제 대신 참조용 명시 mapping을 추가한다.
- **파생 실패**: PR Fast Gate `120798704593` FAIL(preflight failure), Required Quality `120798747566`, Chromium E2E `120798747579`, Docker `120798747597` aggregate FAIL; QA Final Automated `120798768856` FAIL(required quality failure). **실제** TypeScript `120798705516`, ESLint `120798705232`, Vitest `120798705234`, Policy `120798705326`, PR Next production build `120798748447`, Chromium 8-Shard `120798748518`, Docker 구현 `120798748343` **SKIPPED / NOT RUN**, 제품 테스트 결과 불명. `변경 경로 판정` `120798594011` / `QA Final 신뢰 경계 확인` `120798593831` PASS, `Shadow` `120798768784`는 advisory 성공으로 Full PASS를 대신하지 않는다.
- 추가 source: Job log `https://github.com/planner77/masterGantt/actions/runs/40069142338/job/120798654052`; 정확 test-merge는 mutable PR merge ref가 아닌 해당 Run의 과거 checkout 기록에서 확보.

### 전 이력 대조와 교정
- **F792-001 #3231.1** 원인은 `## DOCUMENTATION_SYNC / N/A` H2 불일치였다. 첫 원본 Run `40067826081.1` checkout 기록을 추가 확인해 test-merge SHA를 `f999452b8e1c742e2f28dd82067d46f05875f59a`로 복원 (과거 원장의 UNKNOWN 진술은 당시 확인 경계였으며 덮어쓰지 않음). QA Preflight/Trust/Trace 중첩 오류가 아닌 **다른 문서 매핑 결함**이 뒤이어 드러남. 이전 P1 초안 소실 review는 구현 교정 후 resolved 상태로 보존.
- **F792-002 #3239.1**에서는 H2/PR metadata/QA declarations/required docs 모두 통과 단계에 도달하고 오직 AC7 항목이 누락. 당초 Work Packet `- AC1:`.. `- AC6:`에 `- AC7:`를 추가하되 명시적으로 **상위 #785 historical AC7 / #792 AC2·AC4·AC5 근거 링크**, 운영 consumer=0/복구·이관/Excel 실측 미완료 및 `NOT TESTED/BLOCKED`를 선언한다.
- 누적 cross-run 집합: `F792-001` = `DOCUMENTATION_SYNC` section header; `F792-002` = `DOCUMENTATION_SYNC` AC7 reference mapping. 두 Run에서 *직접 실패한 제품 단위/실제 브라우저 spec은 0개*, **미실행이므로 PASS나 문제 없음의 증거가 아님**. 실패 Job/Attempt는 각각 독립 보존한다. 새 source에서도 실패한다면 이전 원장을 교차 감사하며 새 사건을 추가한다.
- 영향/음성 검증 후보는 기존 `tests/server/logistics/task-target-bindings-handlers.test.ts`, `task-target-bindings.test.ts`, `tests/e2e/issue-726-task-logistics.spec.ts`와 #785 보존/복사·템플릿/OOXML/보안/SQLite 복구 검증, 신규 변경은 Work Packet 매핑 **문서만**. Source of Truth `AGENTS.md`, `docs/TEST_PLAN.md`, `docs/PR_CI_FAILURE_TRIAGE.md` 지침대로 ADD/EXTEND/KEEP_UNIQUE 평가 유지, assertions/timeout/shard/Required Gate 완화0.
- **최신 후보 검증**: 신뢰된 main `docs_gate`의 문서 영향 합집합과 Issue 전체 `AC token` 대조를 커밋 전 정적 수행; 실행 성공이 아니므로 `Full Build/Vitest/E2E8/Docker/Trusted QA/Owner=NOT TESTED`. 최신 main compare·review unresolved·mergeability 재조회 후 GitHub branch push의 `synchronize`로 **새 Full PR CI 시작까지만**, 모니터링·Main/GHCR/Finalizer/Issue 종료 없이 인계.

### F792 누적 사건 비교

| 사건 | Run/Attempt | 최초 실제 실패 | 검증된 조치 | 실 실행/잔여 |
| --- | --- | --- | --- | --- |
| F792-000 | PR 생성 전 | N/A | source/plan 설계 | 미실행 |
| F792-001 | [40067826081.1](https://github.com/planner77/masterGantt/actions/runs/40067826081) | `QA Preflight DOCUMENTATION_SYNC H2` 누락 | H2/필수파일/AC1~6 보완 + P1 Draft 잠금 병렬 보완 | 차기 Run의 H2 개선 확인, 제품 검사 여전히 미실행 |
| F792-002 | [40069142338.1](https://github.com/planner77/masterGantt/actions/runs/40069142338) | `QA Preflight DOCUMENTATION_SYNC AC7` 누락 | #785 AC7 역사적 cross-issue 참조만 `- AC7:`로 명시, 실측 미완료 유지 | 새 Head의 원격 Full 결과 전 NOT TESTED |

