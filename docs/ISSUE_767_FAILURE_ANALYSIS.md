# Issue #767 — 누적 실패 원장

## 목적

`v0.129.1` 교정 릴리스/후속 Issue #767의 새 PR·Main·Release CI 실패를 이슈 단위로 누적한다. 새 Run 전에는 실패를 만들어 기록하지 않으며, 과거 #736의 실패와 분리한다.

## 역사적 출처 (새 Issue 실패로 계산하지 않음)

| 구분 | 근거 | 결과 및 의미 |
| --- | --- | --- |
| #736 Main #3071.1 | [Run 39499988360](https://github.com/planner77/masterGantt/actions/runs/39499988360) | 정확 Assignment 초기 입력 미렌더, 원본 실패 M736-001 |
| #764 PR #3076.1 | [Run 39510892786](https://github.com/planner77/masterGantt/actions/runs/39510892786) | Milestone→Resource→일정 LIFO focus 실패 및 P2 권한 재검사, 원본 F736-004 |
| #764 PR #3092.1 | [Run 39602089760](https://github.com/planner77/masterGantt/actions/runs/39602089760) | Head 5abc658의 원본 Full Success; 새 Head PASS 아님 |
| #764 Trusted #734.1 | [Run 39607021968](https://github.com/planner77/masterGantt/actions/runs/39607021968) | 원본 Head에 대한 trusted SUCCESS; 후속 PR 재실행 필요 |

## 신규 실패 기록

초기 작성 당시 없음. 아래 F767-001~004로 신규 실패를 누적한다. 새 Full PR/Main/Release 실패 발생 시 `F767-001`부터 원본 Run ID/attempt/Job/정확 테스트/증거/원인/대책/새 SHA/반복 시 차이를 추가한다. 단순 실패 run 재실행이나 timeout 확대는 원인 분석 후 승인에 따르며 CI 실패 이력을 덮어쓰지 않는다.

## F767-001 — PR #768 Full #3093.1 QA Preflight Issue AC 식별자 누락 (2026-10-21 KST)

- **Original immutable Run**: [PR Full #3093.1 / 39609933138 attempt 1](https://github.com/planner77/masterGantt/actions/runs/39609933138), Head `e873e9c54e2812408e0be90381d106dc2828a6b3`, Base `71f9b9ddb61be7f6e076accc027188f362e18bb1`, event=`pull_request`.
- **직접 실패**: `QA Preflight — 정책·문서 사전 검사` Job `119256007917`, step `원본 base SHA의 QA Preflight 실행 (read-only)`. 보고서 `FAIL / ISSUE_AC: Issue #767 Acceptance Criteria — Primary Issue 본문에 AC1.. 식별자 없음` (artifact `12348994611`). 원본 Issue body는 `## AC` 아래 체크리스트 7줄이 있지만 `AC1`~`AC7` 식별자가 없었다.
- **파생 결과**: PR Fast Gate/3 Required aggregate/Automated QA FAIL; 실제 Quality/E2E6/Docker 구현 Job은 SKIPPED. 테스트 본문/Shard 35m Timeout, 소스 기능 결함 또는 새 Manifest/lockfile의 테스트 실패 **아님**.
- **원인**: 신규 후속 Issue #767 등록 시 docs의 Work Packet AC1..AC6과 달리 GitHub Primary Issue checklist에는 번호 접두어가 누락됨. 기존 #629 trusted base `qa_preflight.py`는 Issue 본문 **독립 AC1..** 식별자를 필수로 요구한다. 의도된 fail-closed 판정.
- **보완**: [Issue #767](https://github.com/planner77/masterGantt/issues/767) 본문의 기존 7개 체크리스트만 `AC1`~`AC7`로 변경해 내용·기준/Owner 권한/릴리스 범위는 불변. 이 실패를 단일 이슈 원장에 누적하고 문서-only 새 commit으로 Full PR CI `synchronize` 실행. 새 CI의 실제 3 Required 및 Trusted QA 결과는 별도 검증, 이전 SUCCESS로 추정 금지.
- **회귀 정책**: 해당 실패 때문에 글로벌 timeout/Retry/Shard/QA Preflight를 완화·비활성화하지 않음. 동일 issue 재실패 시 Primary Issue 실제 JSON/body와 new Run source를 먼저 대조한다.

## F767-002 — PR #768 Full #3094.1 Work Packet DOCUMENTATION_SYNC/AC_TEST_COVERAGE 누락 (2026-10-21 KST)

- **원본 Run**: [PR Full #3094.1 / 39610534229 attempt 1](https://github.com/planner77/masterGantt/actions/runs/39610534229), head `0a7ae24fbb3d862128c719b56a398c42e2abacd7`, base `71f9b9ddb61be7f6e076accc027188f362e18bb1`.
- **직접 원인**: `QA Preflight — 정책·문서 사전 검사`가 `ISSUE_AC PASS`까지 확인 후 `FAIL / DOCUMENTATION_SYNC: docs/exec-plans/active/ISSUE_767.md: DOCUMENTATION_SYNC / AC_TEST_COVERAGE — Work Packet ## DOCUMENTATION_SYNC 누락`으로 중단. #3093.1의 AC 번호 오류는 해결, 이번 실패는 신규 Work Packet의 필수 구조 누락이다.
- **파생**: Fast Gate/세 Required aggregate/QA Final FAILURE, 실제 Quality/E2E/Docker 구현 job SKIPPED. 35분 E2E timeout 또는 제품 Assertion 오류가 아니다.
- **개선**: 기준 `scripts/qa_preflight.py`→`scripts/qa_final_automated.py::docs_gate`를 확인하고 신규 Work Packet에 별도 정확한 `## DOCUMENTATION_SYNC`/ `## AC_TEST_COVERAGE` 절을 작성. 변경 path 영향 union의 `DESIGN.md` (N/A 근거), `docs/TEST_PLAN.md` (UPDATED), `docs/SCHEDULING_ENGINE.md` (N/A 근거), Issue 본문 AC1..AC7 모두 각 테스트·증거에 매핑. 새 commit 후 Full CI를 `synchronize`로 다시 실행한다.
- **과거 증거/안전성**: 원본 #3093.1/#3094.1 실패를 PASS로 바꾸지 않고, 검증기/timeout/Retry/Shard/Required 정책 변경 또는 Owner 자동 승인 생성 금지.

## F767-003 — PR #768 Full #3095.1 Shard 6/6 35분 Job Timeout 취소 및 재배치 (2026-10-21 KST)

- **원본 출처/상태**: [PR Full CI #3095.1 · Run 39611062916 / attempt 1](https://github.com/planner77/masterGantt/actions/runs/39611062916), event=`pull_request`, PR #768, Head `d762cecbe00d60d26ce301f4d59b36f05a1d76f2`, base `71f9b9ddb61be7f6e076accc027188f362e18bb1`, 원본 overall **CANCELLED**(success/failure로 소급 변경하지 않음), test-merge `b99cc2945dc8f80be37ebc085673f21fb37c6501`.
- **실제 Job 결과**: QA Preflight/Policy/TypeScript/ESLint/Vitest/PR Build/Quality aggregate 및 Docker implementation+aggregate는 **SUCCESS**. E2E Shard1/2/3/4/5 **SUCCESS**(각 113/122/133/156/90 PASS; Shard2~4 각 1 SKIP은 기존 상태). [Shard6 Job 119260956062](https://github.com/planner77/masterGantt/actions/runs/39611062916/job/119260956062)는 2026-10-21T13:49:49Z~14:25:11Z 35분22초 경과 후 **CANCELLED**. Playwright `Running 174 tests using 1 worker`이며 **173 PASS/1 미완료**, 최종 `template-picker-ux.spec.ts` 1440px Case PASS 뒤 `The operation was canceled`. Shard6 본문 Assertion FAIL 관측0, 완료하지 않은 174번째 테스트는 NOT RUN/PASS 불명이며 timing artifact 미생성. [E2E aggregate Job 119279386588](https://github.com/planner77/masterGantt/actions/runs/39611062916/job/119279386588) 실패 메시지는 `RESULT=cancelled` 파생; 자동 QA Final FAIL도 해당 Required 미성공의 파생이다.
- **증거/원인 판정**: 신뢰된 기본 `.github/workflows/ci.yml`은 PR Shard의 `timeout-minutes: 35`, `workers=1`, 6-shard 계획을 규정한다. 원본 Job 시작~취소 35분22초 및 로그의 정상 케이스 진행과 OS cancellation으로 **Job time budget 초과에 따른 취소**가 지지된다. 사용자 수동 취소/Assertion/특정 제품 결함으로 분류할 증거는 없음. F767-001 `ISSUE_AC`, F767-002 `DOCUMENTATION_SYNC`는 이번 Preflight에서 PASS; 독립 세 번째 실패다. Shard 시작부터 종료까지 실제 5/6 Job wall [19.05,29.87,22.27,25.27,25.37]분 vs Shard6 35.37분으로 불균형 확인.
- **최소 교정(기존 #765 원장 보존)**: `tests/config/e2e-shard-plan.json`에서 spec **전체 파일 3개만** Shard6에서 이동: `issue-734-equipment-dashboard.spec.ts` **6→1**(원본 8 PASS/테스트 본문≈5.31분), `project-task-editor.spec.ts` **6→3**(33 PASS/≈3.58분), `issue-726-task-logistics.spec.ts` **6→4**(3 PASS/≈2.81분). 136 unique E2E specs를 6개 Shard에 단일 배치; 이동 이전 이력 `manualRebalance765`, 기존 `metrics.projectedMs` 값은 역사적 값 그대로 유지하고 신규 `manualRebalance767`에서 최근 실측과 부정확도 별도 기록. 예상 Job wall [24.36,29.87,25.85,28.08,25.37,23.67]분은 **테스트 본문만 이관한 정적 추정**이고 Runner/fixture 변동 및 마지막 미완료 Case의 시간을 반영하지 않은 비보증 수치다.
- **인접 테스트/문서**: `tests/scripts/e2e-shard-planner.test.ts`의 **고정 배치 기대값 3개를 동시 변경**한다(#765 F765-004의 Unit 재실패 유형 방지). `docs/exec-plans/active/ISSUE_767.md`, `docs/TEST_PLAN.md`, `docs/exec-plans/active/PLAN.md`를 함께 갱신하고 `scripts/e2e-shard-planner.mjs`의 유일 배치/전 파일 선택 원칙 준수. Test 내용/Assertions/Fixture/API/DB/Product code와 `35min`/Workers1/Retry0/PR fail-fast/6-Shard/세 Required Aggregate 및 QA/릴리스 Gate 완화 **없음**. `DESIGN.md`, `docs/SCHEDULING_ENGINE.md`는 N/A (UI·일정 계산 계약 불변).
- **정적 확인/재검증 경계**: GitHub exact Head Tree의 현행 **136개 E2E spec**과 수정 계획의 136개 유일 배치를 비교해야 하고 고정 기대값도 일치해야 한다. 이 연결에서는 실제 `npm test` 및 새 Playwright, 35분 원격 Runner 실증은 **NOT TESTED**; 새 Head PR CI(Preflight/Unit/E2E6/Docker) 및 default-main Trusted QA 성공과 Owner HIGH 승인 전 `MERGE_READY=BLOCKED`. `release_required=true/release_authorized=false`, 공식 `v0.129.0` immutable / 새로운 `v0.129.1` 게시 대기는 불변. 과거 Run #3093.1, #3094.1, #3095.1 판정은 변경하지 않는다.

## F767-004 — PR #768 Full #3096.1 Shard6 E2E PASS 후 timing Artifact CreateArtifact ECONNRESET (2026-10-22 KST)

### 정확한 원본 및 분류

- **귀속**: [Issue #767](https://github.com/planner77/masterGantt/issues/767) · [PR #768](https://github.com/planner77/masterGantt/pull/768) · [Full PR CI #3096.1, Run 39619154900 attempt 1](https://github.com/planner77/masterGantt/actions/runs/39619154900), `event=pull_request`, `.github/workflows/ci.yml`, branch `fix/issue-767-v0.129.1-assignment-focus`, Head `305a6897d56b40e89da639726401b77458e4475d`, Base `71f9b9ddb61be7f6e076accc027188f362e18bb1`, test-merge `420304cf7f29f42186e95a1fb0b15adfe1b6c1de`. Run은 2026-10-21T14:42:11Z 생성, **completed/failure**로 기록되어 있으며 원본 결론을 바꾸지 않는다.
- **성공과 취소 구분**: QA Preflight/Policy/TypeScript/ESLint/Vitest/PR Build와 Required Quality Job `119289610822`, Docker 구현/Required Docker Job `119290159720` 모두 **SUCCESS**. [E2E Shard6 Job 119288924640](https://github.com/planner77/masterGantt/actions/runs/39619154900/job/119288924640)의 실제 Playwright 결과는 **130/130 PASS (14.8분)**. 이어 `E2E timing artifact 업로드` step8에서 `test-results/e2e-timing-shard-6.json` 파일 존재를 확인했지만 2026-10-21T15:00:29.131Z(한국시간 2026-10-22 00:00:29) `Failed to CreateArtifact: Unable to make request: ECONNRESET` 발생하여 **Shard6 Job FAILURE**. **테스트 실패, shard Job 35분 Timeout, 파일 경로 누락의 증거 없음**.
- **Artifact 단독 실패 근거**: 원본 Run에 `e2e-timing-ci-shard-6`은 등록되지 않았다. 같은 Job의 `ci-setup-metrics-e2e-shard-6` artifact `12355046698`, `playwright-report-shard-6` artifact `12356070228`는 이후 **SUCCESS**로 업로드했다. 따라서 일시적인 Artifact Create API/네트워크 연결 리셋이 확인되지만 GitHub 서비스·네트워크 중 정확 어느 지점에서 TCP가 종료됐는지는 **UNKNOWN**. 해당 단독 실패는 `ENVIRONMENT / ARTIFACT_TRANSPORT`로 분류하고 제품 기능/보안/Assertion 결함으로 단정하지 않는다.
- **파생**: PR E2E matrix `strategy.fail-fast=true`로 Shard1~5 Job(`119288924476, 119288924677, 119288924601, 119288924939, 119288924606`)은 **CANCELLED**(미완료 테스트는 NOT RUN; 중간 PASS는 Shard PASS가 아님). E2E Required 집계 Job `119297643788`은 **FAILURE**, 원본 `RESULT=failure`; 자동 QA Final Job `119297684526`은 **BLOCKED**이며 `실행 ID/attempt/검증 대상 SHA 불일치`를 별도 반환. 최종 QA 중 이 메타데이터 차이가 발생한 이유는 현재 증거로는 **UNKNOWN**(원본 run/head/attempt가 이후 조회에서는 일치). 다음 Full 실행에서 독립 재확인, 반복되면 QA source API/status 타이밍 원장으로 분리 분석. QA/Required 성공 증거로 간주 금지.
- **이전 누적 장애 대비**: F767-001(#3093.1)은 `ISSUE_AC` 형식, F767-002(#3094.1)는 `DOCUMENTATION_SYNC` 형식, F767-003(#3095.1)는 **Shard6 35분 Job 취소**이다. 이번 #3096.1에서 앞의 정책/문서 두 Gate는 SUCCESS이고, F767-003에 따라 6→1/3/4로 3개 파일을 이동한 결과 **Shard6 130건/14.8분 성공**까지 관측하였지만 나머지 Shard 5개가 취소되어 **신규 배치의 6/6 성공은 NOT TESTED**. F767-004는 새 외부 전송 장애로서 기존 코드 회귀로 분류하지 않는다.

### 종합 원인 매트릭스 및 보완

| 누적 사건 | 확인된 직접 실패 | 당시 조치/이번 Run 재발 여부 | 현재 검증·잔여 위험 |
| --- | --- | --- | --- |
| F767-001 · Full #3093.1 | Primary Issue AC1.. 식별자 누락 | Issue AC1~AC7 보완; #3096.1 Preflight PASS | 변경 후 브랜치 기본 QA 게이트 계속 유지 |
| F767-002 · Full #3094.1 | Work Packet DOC_SYNC/AC mapping 누락 | `DOCUMENTATION_SYNC`/`AC_TEST_COVERAGE` 보완; #3096.1 Preflight PASS | 새 문서 변경을 다음 Head로 재검증 |
| F767-003 · Full #3095.1 | Shard6 35분 예산 초과 173/174 진행 후 취소 | 136개 spec 유지 및 3개 전체 파일을 Shard6에서 분산; #3096.1 Shard6 130/130 PASS, 다른 Shards 취소 | 전체 E2E6 재검증 NOT TESTED |
| F767-004 · Full #3096.1 | E2E 테스트 전부 통과 후 `upload-artifact CreateArtifact ECONNRESET` | 이슈 전용 원장/TEST_PLAN/Work Packet/PLAN 보완 후 **새 Full PR synchronize**로 전 6 shard 재실행; 소스 제품/CI policy 변경 안 함 | 인프라 재발 가능, 정확 네트워크 지점 UNKNOWN, 다음 Head CI/Trusted NOT TESTED |

- **다음 조치의 근거**: 테스트 단언이나 버전/코드에 의한 결정적 재현 실패가 없고, 원본 업로드 Action의 다른 두 Artifact가 즉시 성공했다. 이 **단일 전송 장애**에 맞춰 테스트/QA fail-closed 조건, artifact failure visibility, matrix fail-fast를 약화하는 소스 변경이나 광역 Retry/Timeout 증가는 하지 않는다. 문서 보완 commit의 **새 exact Head**에서 전체 Required Quality/E2E6/Docker를 다시 실행하여 모든 취소된 Shard의 완주와 timing upload를 확인한다. 기존 실패 Run rerun을 성공으로 소급하지 않는다.
- **재발 시 결정**: 별도의 새 Run에서도 `CreateArtifact ECONNRESET`이 반복되면 첫 응답 상태/Artifact ID 유무/동일 이름 중복·다른 업로드 성공/공용 uploader 조치 범위를 조사한 뒤 **유한 1회 전송 재시도 + 실패 시 FAIL 유지 + artifact identity/digest 확인**을 CI 정책 보호 경로의 독립된 수정안으로 평가한다. 이미 존재하는 Artifact를 임의 overwrite하거나 실패를 무시하는 `continue-on-error` 우회는 금지.
- **변경 및 검증**: `docs/ISSUE_767_FAILURE_ANALYSIS.md`, `docs/exec-plans/active/ISSUE_767.md`, `docs/TEST_PLAN.md`, `docs/exec-plans/active/PLAN.md`만 문서 동기화. 제품/테스트/Shard 배치/CI workflow·GitHub Actions/GA/QA validator/버전/`v0.129.0` 태그·digest 전부 **수정하지 않음**. 로컬 GitHub 호스팅 아티팩트 네트워크 재현은 NOT TESTED. 신규 Full CI/Trusted QA/Owner HIGH 수용 전 `MERGE_READY=BLOCKED`, `release_required=true`/`release_authorized=false`; 병합/Main/정식 GHCR/Finalizer/이슈 종료 금지. 미해결 review threads 0, PR mergeable=true는 마지막 확인 상태이며 최종 Gate 시 재검증.
