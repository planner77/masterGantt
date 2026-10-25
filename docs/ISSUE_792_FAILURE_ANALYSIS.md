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



## 2026-10-24 전체 이력 감사 — 기존 원장의 누락 백필

PR #795 branch의 접근 가능한 `CI` Full은 총 **9개, 모두 attempt 1: FAILURE 6개 / CANCELLED 3개**다. 기존 F792-001/F792-002 기록은 최초 확인 범위로 보존하고, 이번 infra 조회로 누락 Run 6개를 보강한다. 각 Run은 `pull_request`, 아래 Head는 원본 `run.head_sha`, base/test-merge는 과거 checkout 로그에서 확인했다. 현재 PR ref 또는 실행 제목으로 과거 SHA를 추정하지 않는다. Source artifact는 메타데이터만 조회했으며 ZIP 실행·정책 검증 영수증 재사용은 하지 않았다. 상세 Job/Step/Artifact 정제 목록은 [보조 증거](evidence/issue-792/ci-history-20261024.json)에 둔다.

| Full / Run ID | 원본 Head | 원본 base / test-merge | 원본 판정·직접 원인 |
| --- | --- | --- | --- |
| [#3231.1](https://github.com/planner77/masterGantt/actions/runs/40067826081) / `40067826081` | `8f1cab235bd9d15845e729641020e936dc42be79` | `b45885812301d14b9f673841e9944b27b2642323` / `f999452b8e1c742e2f28dd82067d46f05875f59a` | FAILURE — H2 누락 (F792-001) |
| [#3232.1](https://github.com/planner77/masterGantt/actions/runs/40068404543) / `40068404543` | `0f2ea6ed587b2d7c63bb8389914188cd16469781` | `b45885812301d14b9f673841e9944b27b2642323` / `103a9c964bd1a43d037694dd90e4ec390f042b83` | FAILURE — DOC_SYNC 기록 누락 (이번 백필) |
| [#3233.1](https://github.com/planner77/masterGantt/actions/runs/40068527434) / `40068527434` | `cb2da0c2917ccb42ca2548b33d480b2188334043` | `b45885812301d14b9f673841e9944b27b2642323` / `UNKNOWN` | CANCELLED — 출처 보존/checkout 중 취소 |
| [#3234.1](https://github.com/planner77/masterGantt/actions/runs/40068533619) / `40068533619` | `b01ec6719e5cebb53730559ae124786b2cf04dff` | `UNKNOWN` / `UNKNOWN` | CANCELLED — Job 0개/Artifact 0개 취소 |
| [#3235.1](https://github.com/planner77/masterGantt/actions/runs/40068539110) / `40068539110` | `20bb271dc126e38ee8bf5bd45c611b598333f1dd` | `b45885812301d14b9f673841e9944b27b2642323` / `UNKNOWN` | CANCELLED — checkout 중 취소 |
| [#3236.1](https://github.com/planner77/masterGantt/actions/runs/40068581178) / `40068581178` | `2b5d5c5764f3efbbc5a54678e7b332427827d40e` | `b45885812301d14b9f673841e9944b27b2642323` / `c97290f43b6bc46ca6598e5c8c196b73329fb1e8` | FAILURE — DOC_SYNC 기록 누락 (이번 백필) |
| [#3238.1](https://github.com/planner77/masterGantt/actions/runs/40068884514) / `40068884514` | `2e72bf6a726ceb7da2d1391156766526c90c7175` | `b45885812301d14b9f673841e9944b27b2642323` / `b0697cf13750c4dbcce45accd356c3385d4d534e` | FAILURE — DOC_SYNC 기록 누락 (이번 백필) |
| [#3239.1](https://github.com/planner77/masterGantt/actions/runs/40069142338) / `40069142338` | `4819a8f8134ca5f5c74e13faf1123121541cdc2c` | `b45885812301d14b9f673841e9944b27b2642323` / `6db0c7017faacc081776724d13ddd793034a5dcc` | FAILURE — AC7 매핑 누락 (F792-002) |
| [#3240.1](https://github.com/planner77/masterGantt/actions/runs/40073927759) / `40073927759` | `25fed516656b2dfa864a7424ab6f3dd4a0df1423` | `b45885812301d14b9f673841e9944b27b2642323` / `41ee531634eeb0a60513b44ff32c3c1a9e1b4595` | FAILURE — TypeScript·ESLint·Vitest 직접 FAIL (F792-003) |

- **백필 F792-B001 / #3232.1**: 05:59:29Z 시작, Preflight Job `120796439262` Step4에서 `DOC_SYNC 기록 누락`. H2는 있었지만 파일별 `- `path`: UPDATED|N/A(reason)` 파싱 결과가 비어 있었다. Fast Gate 및 Required3/QA FAIL은 파생, 실제 TypeScript/ESLint/Vitest/Next/Chromium8/Docker NOT RUN이다.
- **백필 F792-B002 / #3236.1**: 06:01:56Z 시작, Preflight Job `120797103043` Step4 같은 `DOC_SYNC 기록 누락`. **백필 F792-B003 / #3238.1**: 06:06:28Z 시작, Preflight Job `120797881995` Step4 같은 오류. 각 Head에서 별도 실패이며 #3231 H2 오류나 #3239 AC7 오류와 합쳐 지우지 않는다. 두 Run 모두 제품 구현 검사는 NOT RUN, Fast Gate/Required3/QA FAIL은 파생이다. 기존 F792-001 최종 교정의 정형 파일 상태 행을 유지하고 base `docs_gate`로 재검증한다.
- **백필 F792-C001 / #3233.1**: 06:01:09Z 시작, 출처 Job `120796758204` Step3 및 신뢰 경계 Job `120796758086` Step2 취소. Fast Gate `120796786138`, Quality `120796836445`, E2E `120796836605`, Docker `120796836392` FAIL은 취소로 인한 파생이며 제품 Job은 steps=[] 상태에서 취소됐다. 원본 source artifact 없음, test-merge UNKNOWN.
- **백필 F792-C002 / #3234.1**: 06:01:14Z 시작, Job/Artifact 모두 0개로 취소, base/test-merge UNKNOWN. **백필 F792-C003 / #3235.1**: 06:01:18Z 시작, 신뢰 경계 Job `120796906262` Step2 base checkout 취소; Fast Gate `120796926818`, Quality `120796969021`, E2E `120796969093`, Docker `120796969046` FAIL은 파생. 제품 Job steps=[]로 미실행, source artifact 없음/test-merge UNKNOWN. 취소 전 제품 직접 FAIL 증거는 없으며 PASS나 실패 0건 성공으로 계산하지 않는다.
- 같은 branch의 FAST_DEVELOPMENT 9개는 모두 SKIPPED이며 Full PASS가 아니다. 해당 범위의 metadata-only/rerun attempt 추가 기록은 조회되지 않았다. 다른 Issue/Main/Release Run은 #792 PR 실패로 복제하지 않는다.

## F792-003 — Full #3240.1 직접 정적·단위 실패와 동일 source 교정

### 원본 실행 증거

[Run 40073927759 / #3240.1](https://github.com/planner77/masterGantt/actions/runs/40073927759), `CI / pull_request`, 2026-10-24 07:23:15Z 시작. Head `25fed516656b2dfa864a7424ab6f3dd4a0df1423`, base `b45885812301d14b9f673841e9944b27b2642323`, 원본 TypeScript checkout의 test-merge `41ee531634eeb0a60513b44ff32c3c1a9e1b4595`. source artifact `ci-pr-source-40073927759-1` ID `12552715446` (조회 당시 만료 아님).

| 실제 Job / Step | 원본 판정·핵심 오류 |
| --- | --- |
| TypeScript `120813220317` / Step7 `Run npm run typecheck` | FAIL, 07:24:26Z `issue-726-task-logistics.spec.ts(515,10) TS18048: child.compatibilityLinks is possibly undefined` |
| ESLint `120813220333` / Step6 `Run npm run lint` | FAIL, 07:25:14Z `legacy-binding-scope-editor.tsx:48` effect 동기 setState, `react-hooks/set-state-in-effect`. 기존 경고 10개는 별도이며 직접 error는 1개 |
| Vitest `120813220342` / Step6 `Run npm test` | FAIL, `task-target-bindings-handlers.test.ts:360` 비활성 확대 기대 INACTIVE/실제 STALE, `edit-authorization-handlers.test.ts:414` 신규 GET/POST/PATCH 기대 목록 누락. 2 failed / 3268 passed / 3 skipped (3273), 파일 2 failed / 275 passed / 1 skipped (278), 76.22s |

Preflight `120813180344` 및 Policy `120813220307` PASS로 과거 H2/파일별 상태/AC7 교정은 통과했다. Fast Gate `120813589371`, Quality `120813646757`, Chromium `120813646784`, Docker `120813646854`, QA Final Automated `120813664951`의 FAIL은 위 직접 실패의 파생이다. PR Next build `120813647249`, Chromium8 구현 `120813647190`, Docker 구현 `120813647836`은 SKIPPED/NOT RUN이다. advisory Shadow 성공을 Required PASS로 승격하지 않는다.

### 가설·재현·원인별 보완

1. **TEST_CONTRACT**: System.active 변경은 resolver member.active와 fingerprint를 바꾼다. 따라서 예전 fingerprint는 STALE이 먼저 나와야 한다는 가설을 로컬에서 확인했다. 기존 비활성 단언을 삭제하지 않고 과거 fingerprint STALE/DB 불변 → GET 새 fingerprint 변화 → 새 fingerprint INACTIVE/DB 불변을 각각 검사한다. 새 fingerprint까지 허용되는 제품 guard 결함 가설은 기각됐다. 서버 제품 코드는 변경하지 않았다.
2. **TEST_CONTRACT**: 신규 세 route는 실제 inventory에 있으나 exact 기대 목록 소비자만 빠졌다. 목록 및 GET read / POST guarded nonmutation / PATCH guarded mutation 정책을 정확히 추가했다. Origin/session/If-Match 정책을 낮추지 않았다.
3. **PRODUCT / UI lifecycle**: Task/Revision props가 바뀌면 effect에서 동기 reset하던 source 편집 세션을 `taskId:revision` key로 교체한다. 전체 Task Editor/직접 연결 초안은 remount하지 않는다. unmount epoch 무효화로 낡은 GET/preview 응답을 막고 PATCH→`onApplied` 종료까지 parent pending 잠금은 유지한다. lint disable·setTimeout 우회는 없다.
4. **TEST_CONTRACT / 타입**: 선택 필드 compatibilityLinks는 Array.isArray로 존재를 검증해 타입을 좁힌다. 누락은 명시 FAIL이며 `!` 또는 빈 배열 대체로 provenance 검증을 생략하지 않는다.
5. **LOCAL-008 / FIXTURE_OBSERVABILITY**: 최초 실제 #792 Chromium 실행 15.3s FAIL은 지연 PATCH gate를 해제하자마자 `page.unroute`를 호출해 handler의 `route.continue`와 경합한 `Route is already handled!`였다. 지연 중 잠금까지 도달했으며 이후 canonical/readonly 검증은 완료되지 않았다. handler 완료를 기다린 뒤 unroute하여 실제 PATCH 응답과 잠금을 검증한다. 이 로컬 실패를 원격 #3240의 직접 오류나 제품 성공으로 바꾸지 않는다.

### 누적 Cross-run 및 검증 범위

| 사건 | 누적 실패 계약/파일 | 이번 후보의 대응·잔여 |
| --- | --- | --- |
| F792-001 / #3231 | Work Packet H2 | 정확 H2 유지, base docs_gate 재실행 |
| B001/B002/B003 / #3232/#3236/#3238 | Work Packet 파일별 DOC_SYNC 행 | 정형 상태 행 유지, AC1~AC7 포함 재검증 |
| C001/C002/C003 / #3233/#3234/#3235 | 취소·원본 source 미확보 | 미실행으로 보존, 과거 test-merge UNKNOWN |
| F792-002 / #3239 | 역사적 #785 AC7 mapping | AC7의 출처 전용/운영 미검증 범위 유지 |
| F792-003 / #3240 | UI effect / E2E optional field / HTTP fixture / route inventory | 제품 lifecycle 및 기존 테스트 EXTEND. 과거 pending P1 잠금 유지 |
| LOCAL-008 | #726 delayed PATCH handler 정리 경합 | 완료 후 unroute, 로컬 재실행 필요 |

실제 실패 테스트의 누적 합집합은 `tests/server/logistics/task-target-bindings-handlers.test.ts`, `tests/server/projects/edit-authorization-handlers.test.ts`, `tests/e2e/issue-726-task-logistics.spec.ts`다. 직접 UI 파일은 `src/features/gantt/legacy-binding-scope-editor.tsx`, 과거 문서 실패는 Work Packet이다. 인접 `task-target-bindings.test.ts` 및 `issue-785-exchange.test.ts`의 실제 UUID/coverage·원자성·교환 경계를 함께 선택했다. 기존 source auth/revision/whole/subset/FK/rollback/restart·Copy/Template·WBS/Excel은 KEEP_UNIQUE, 전체 로컬 Docker/8-shard/OOXML 재반복은 변경 범위 밖이므로 공식 새 PR Full CI에 맡긴다. 기존 테스트 삭제·skip·retry/timeout/샤드·Required·validator 완화는 없다.

### 로컬·문서·리뷰 및 다음 인계

- 환경: 새 worktree `/home/planner/Dev/masterGantt-792`, Node 22.14.0, `npm ci --no-audit --no-fund` 446 packages / 10s PASS. 과거 커넥터의 실행 불가 진술은 당시 경계로 보존한다.
- backend 원본 재현: `npm test -- tests/server/logistics/task-target-bindings-handlers.test.ts tests/server/projects/edit-authorization-handlers.test.ts` → 2 FAIL / 42 PASS, 1.32s. 보완 뒤 위 두 파일 + `tests/server/logistics/task-target-bindings.test.ts tests/server/projects/issue-785-exchange.test.ts` → 69/69 PASS, 1.96s. qa_docs 별도 재실행 69/69 PASS, 1.97s.
- frontend 원본 대상 ESLint 1 error 및 TypeScript TS18048 재현 후 대상 ESLint / `npm run typecheck` PASS. 실제 Chromium 최종 결과와 코드/테스트 동결 SHA256은 아래 최종 검증 절에 추가한다.
- DOCUMENTATION_SYNC: Work Packet·TEST_PLAN·단일 실패 원장 갱신. 기존 API/DB/보안/UX의 source scope 및 pending 의미 계약은 불변이며 추가 설계 변경 N/A다. 운영 DB/외부 consumer/off-host restore/Windows Excel/수동 운영 UX는 NOT TESTED.
- 실제 역할은 Manager·frontend·backend·infra와 별도 읽기 전용 qa_docs다. qa_docs 로컬 검토는 GitHub 독립 인간 APPROVED 또는 기본 브랜치 Trusted/Owner 영수증이 아니다. HIGH / qa_required=true / OWNER_MANAGED, manager_decision=NOT TESTED / MERGE_READY=BLOCKED, release_required=true / release_authorized=false, version 0.131.0 유지.
- 현재 PR #795는 unresolved thread 0(기존 P1 resolved) / mergeable=true / main 대비 behind0이며, 게시 직전에 최신 상태를 다시 조회한다. 새 exact Head Full PR CI 시작만 승인됐으며 완료 모니터링·병합/Main/GHCR/Release/Finalizer·브랜치 삭제/Issue 종료는 수행하지 않는다.

### F792-003 최종 동결 source의 Local Fast Feedback

- `npm run typecheck`: PASS, Next dev가 바꾼 AGENTS.md/next-env.d.ts/tsconfig.json을 원복한 최종 tracked 설정에서도 확인했다. 대상 UI/E2E·backend 테스트 ESLint 및 `git diff --check` PASS다.
- `npx playwright test --config tests/config/playwright.config.ts tests/e2e/issue-726-task-logistics.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=0 --grep '#792'`: **1/1 PASS**, case 18.6s / 전체 35.5s. 실제 Chromium·HTTP·격리 SQLite에서 390/768/1024/1440/1920px, readonly, preview nonmutation, UUID·whole·상속 불변, PATCH 지연 중 Task 입력·탭·닫기·Escape 잠금, reload 이후 해제 및 최신 scope/preview 초기화를 확인했다. 전체 8-shard/수동 접근성·운영 UX PASS는 아니다. 원본 LOCAL-008 실패 15.3s는 그대로 보존한다.
- SHA256 `src/features/gantt/legacy-binding-scope-editor.tsx`: `d8a6abe26c49bcae6efe1656fca8560321bb448f5102ee78a8901524f8d6b919`; `tests/e2e/issue-726-task-logistics.spec.ts`: `104d4ee1c43b62923812aa22b41b3ba32bc09bc2a5ff935717c29809c9d35b7c`.
- SHA256 `tests/server/logistics/task-target-bindings-handlers.test.ts`: `872c40d9a128c076fa35450367da6cdf4f7012d02421bf52601830cd277557a4`; `tests/server/projects/edit-authorization-handlers.test.ts`: `880fc14eab674fafc604afe3dc01258bf7b170ee1e0c985c770bad68839495be`. 위 동일 source의 HTTP/SQLite·domain·authorization·#785 exchange 4파일 69/69 PASS를 확인했다.
- keyed revision reset 단독 차이를 증명하는 mutation 시험은 미실행이며, 브라우저 결과는 canonical reload를 포함한 실제 사용 흐름 관측이다. unmount cleanup/async epoch/parent pending은 별도 qa_docs의 읽기 전용 코드 검토로도 확인했다. 새 exact Head의 원격 Required3·Trusted/Owner는 NOT TESTED, Manager ACCEPT는 미실시다.
- 기본 브랜치 `b45885812301d14b9f673841e9944b27b2642323`의 `qa_final_automated.py::docs_gate`를 별도 추출해 PR 전체 변경 경로와 AC1~AC7로 실행했다. 필수 문서 9개와 DOC_SYNC/AC 매핑은 `STRUCTURAL_PASS_SEMANTIC_REVIEW_PENDING` / `MAPPING_PASS_SEMANTIC_REVIEW_PENDING`이다. `node scripts/check-markdown-links.mjs` 321파일 링크 PASS, `git diff --check` PASS. 이는 로컬 구조 검사이며 원격 Preflight/Trusted QA PASS가 아니다.


## MAIN-792-001 — 원본 PR #795 병합 후 #3249.1 Main CI 직접 실패와 버전별 교정 (2026-10-24)

- **원본 GitHub Merge:** [PR #795](https://github.com/planner77/masterGantt/pull/795), Merge SHA `4048245f8dc90c1f46dd1cc58948a17a4fb7338e`, parents `b45885812301d14b9f673841e9944b27b2642323`(main) + `7c9b66481f52d6597d59a0fe694aef9529029b71`(PR Head). 원본 Full [#3244.1](https://github.com/planner77/masterGantt/actions/runs/40075199615) Quality/E2E8/8/Docker/QA PASS 및 기본 [Trusted #892.1](https://github.com/planner77/masterGantt/actions/runs/40077159072) PASS, 리뷰 미해결0, 충돌0. Owner 인증 GitHub 계정 planner77. `manager_decision=SCOPED_ACCEPT_MERGE`는 운영 데이터 실증/정식 게시·완료 승인 아님.
- **직접 오류:** [Main CI #3249.1 / Run 40085439884](https://github.com/planner77/masterGantt/actions/runs/40085439884), `push`, attempt1, exact Main Merge SHA 위와 동일, `completed/failure`. `변경 경로 판정` [Job120847305383](https://github.com/planner77/masterGantt/actions/runs/40085439884/job/120847305383)의 `CI 실행 추적 메타데이터 검증` Step에서 `Issue # 접두어는 정확한 단일 행 표준 Merge 제목만 허용합니다`. 실제 Merge API 호출에서 canonical 제목 아래에 여러 줄 `commit_message`를 넣어 `main_ci_run_name.py::parse_merge_title`의 정확 한 줄 전체 메시지 계약 위반. **원인은 응답 작성·병합 오케스트레이션 계약, 구현 제품·CI 정책 결함 증거 없음.**
- **파생/미실행:** Required Quality/E2E/Docker 집계 FAIL은 `changes` 선행 실패의 fail-closed. Policy/TS/ESLint/Vitest/Build/Chromium8/Docker 구현 `SKIPPED/NOT RUN`, Main 임시 GHCR Job SKIPPED, `ci-4048245...` digest/SBOM/provenance 미검증. Failed Job만 retry해도 immutable commit message는 동일하여 치유되지 않으며 rerun 성공 위조·policy 우회 금지.
- **Issue 상태:** 병합 당시 자동 완료 `2026-10-24 10:19:19Z`은 CI/Main/Release/Finalizer 미확정 상태의 **조기 자동 종료**; 실시간 재조회 후 `open/reopened`로 되돌렸다. auto-close 이벤트 원본과 누적 failure를 삭제하지 않는다. [Issue MAIN-792-001 보고](https://github.com/planner77/masterGantt/issues/792#issuecomment-6383081118).
- **회복 선택:** immutable main SHA는 force-push/rewrite 금지. `scripts/main_ci_recovery.py` #639는 *기존 push CI 부재·first-parent 버전 변화·정확 Owner 메타 승인*이 필수이므로 이 Main SHA에는 부적합. 동일 Issue #792의 후속 **corrective PR**로 파일·버전만 정리한 새 Main merge를 만든다. Next Merge에는 `scripts/main_ci_run_name.py::format_merge_title(792, <새PR번호>, "레거시 관계 릴리스 정렬")`의 정확 한 줄 + **빈 commit_message** 사용. Product 코드·CI validator·Required3·8샤드 테스트와 Git 병합 이력은 그대로.
- **버전 정합성:** 기존 annotated `v0.131.0` 태그가 원본 이전 Main `b45885812301d14b9f673841e9944b27b2642323`에 고정, 기존 package·lock 역시 0.131.0. 새 릴리스 후보는 더 높은 `0.132.0`으로 package.json/package-lock.json 두 루트 버전 동기화·CHANGELOG/Work Packet/TEST_PLAN 기록. `v0.132.0` Git ref는 교정 시작 시 404(미발행), **새 태그를 지금 생성하거나 v0.131.0 태그를 이동하지 않는다**. 버전별 formal GHCR Owner 승인·Main exact digest+Release CI·운영 AC 미확정 `NOT TESTED/BLOCKED`.
- **전 이력 교차:** F792-001 Preflight H2, F792-002 AC7, F792-003 TS/ESLint/Vitest 직접 실패 및 취소 3건/이전 백필은 그대로 남는다. #3244.1 Full/Trusted PASS는 원본 Head에만 유효하다. 교정 HEAD의 새 Full/Trusted/Main은 별도 검증해야 하며 이전 성공 재사용 불가.
- **반례·부채:** 기존 #785 archive Copy/Template/JSON·WorkArea/Task/Assignment, SQLite 원본·WBS/Excel, 실제 5폭 pending 회귀를 다시 변경하지 않는다. 기존 version/merge helper의 단일 행 contract는 이미 검증·test 존재하므로, human API 호출 오류를 제품 test 완화로 해결하지 않는다. Legacy 외부 consumer·운영 DB offhost backup/restart·Windows Excel/DRM, 멤버/coverage 일반 편집은 미실증 또는 미구현. Finalizer/Issue close는 운영·Release 의무 충족 전 금지.
