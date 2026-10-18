# Issue #719 / PR #722 — 누적 PR CI 실패 분석
Primary Issue: [#719](https://github.com/planner77/masterGantt/issues/719) | 관련 PR: [#722](https://github.com/planner77/masterGantt/pull/722) | 최초 작성: 2026-10-18
Source of truth: [PR_CI_FAILURE_TRIAGE.md](PR_CI_FAILURE_TRIAGE.md)
상태: **원격 Full PR CI 실패 2회 관측 (#2932.1, #2933.1)**. 각 Run/Attempt 원본 FAILURE를 보존하며 최초 F-001과 후속 F-002를 구분한다. 새 후보의 Quality/E2E/Docker/QA는 검증 완료 전 NOT TESTED.

## 1. Run / Attempt 전체 목록

| PR | 원본 Run / Attempt | workflow / event | Head / Base / Test merge | Required Quality / E2E / Docker | 실패·취소·미실행 | 증거 |
| --- | --- | --- | --- | --- | --- | --- |
| #722 | [#2932.1 · 39086924294](https://github.com/planner77/masterGantt/actions/runs/39086924294), 2026-10-18 01:33:23 UTC 시작 | CI / `pull_request` full | head `d5344bdfa8239c192bccfbe1c84930d02d7763d8`; base `d2768676aa7a0edff67df9bdeb3e1b49979fd577`; test merge `a248bd383b3abdd51a4270e2e96f27622715c3f2`; branch `feat/issue-719-contextual-help` | **SUCCESS / SUCCESS (6/6 shards) / SUCCESS** | QA Final — Automated **FAIL/BLOCKED**; metadata-only, main-only jobs는 조건부 SKIPPED; 실패한 E2E shard 없음 | [QA Final Job 117559273483](https://github.com/planner77/masterGantt/actions/runs/39086924294/job/117559273483), [Review thread](https://github.com/planner77/masterGantt/pull/722#discussion_r4305289690) |
| #722 | [#2933.1 · 39089185087](https://github.com/planner77/masterGantt/actions/runs/39089185087), 2026-10-18 02:14~02:21 UTC 주요 E2E/QA | CI / `pull_request` full | head `c69fc7d08957e790f7ec75350e22bb6b603d608f`; base `d2768676aa7a0edff67df9bdeb3e1b49979fd577`; test merge `53e75bf07e9cf49a65c5b8e44a7074b241406c6d`; 동일 branch | **SUCCESS / FAILURE (shard2 FAIL, 나머지 5 CANCELLED) / SUCCESS** | Shard2 `issue-719-contextual-help.spec.ts:145` tooltip not found. 동일 shard 43 PASS/1 FAIL/86 NOT RUN; QA Final FAIL은 파생; 다른 shard 취소는 PASS 아님 | [Shard2 Job 117562440507](https://github.com/planner77/masterGantt/actions/runs/39089185087/job/117562440507), [Playwright report artifact 12121239923](https://github.com/planner77/masterGantt/actions/runs/39089185087/artifacts/12121239923) |

동일 Head의 `fetch_commit_workflow_runs`에서 관측한 PR workflow run은 위 Full 1회. 이후 발생하는 synchronize/metadata-only/재시도는 별도 행에 추가해야 하며, 최초 FAIL을 재해석하거나 삭제해서는 안 된다.

### 개별 실행 Job 상태

| 계층 | Job ID | 결론 |
| --- | --- | --- |
| TypeScript/Unit/Policy/ESLint/PR Fast Gate | 117555388121 / 117555388146 / 117555388173 / 117555388284 / 117555635038 | 각각 SUCCESS |
| PR Next.js build | 117555675445 | SUCCESS |
| PR E2E shard 1,2,3,4,5,6 | 117555675397 / 117555675520 / 117555675390 / 117555675579 / 117555675480 / 117555675398 | 각각 SUCCESS |
| Docker smoke 구현 | 117555675411 | SUCCESS |
| Required quality / E2E / Docker aggregate | 117555935808 / 117559257158 / 117556101649 | 각각 SUCCESS |
| QA Final — Automated | **117559273483** | **FAIL** (`BLOCKED: 미해결 review thread`; 2026-10-18 01:56:13 UTC) |
| 비대상 main-only / metadata-only job | 117555388726 / 117555389047 / 117555389315 / 117555358153 / 117559274423 | 조건부 SKIPPED (실패나 PASS로 계산하지 않음) |

## 2. 누적 실패 집합 / Cross-run 진단 매트릭스

| 실패 ID / PR·Run·Attempt | 최초 오류와 실제 소비자 | 분류와 인과·반례 | 이번 수정 / 최신 후보 검증 | 누락·잔여 위험 |
| --- | --- | --- | --- | --- |
| F-001 / #722 · 39086924294.1 / QA job 117559273483 | `QA Final — Automated`: `미해결 review thread`; Codex P2 inline `src/components/ui/context-help.tsx:119-124` (`PRRT_kwDOUUB7Bc6tmScK`, comment `4305289690`) | **POLICY_CI = 올바른 fail-closed 차단**. 원인은 리뷰가 지적한 **PRODUCT/접근성**: 스크롤 가능한 portaled tooltip이 키보드로 읽을 수 없음. 모든 필수 3종과 6 E2E shard는 이미 PASS. E2E 실패·환경 이슈라고 단정할 근거 없음. | 열린 trigger에 focus를 유지해 ArrowUp/Down·PageUp/Down·Home/End를 panel 내부 scrollTop으로 처리. 짧은 높이×긴 KO/EN E2E 추가. 새로운 exact-Head Full CI **NOT TESTED(시작 전)** | 화면 확대/스크린리더/실기기·오래된 HEAD 승인/Trusted QA는 별도 검증, 자동 QA PASS로 Owner 승인 대체 금지 |
| F-002 / #722 · 39089185087.1 / shard2 117562440507 | 신규 `tests/e2e/issue-719-contextual-help.spec.ts:137`의 line145: `getByRole('tooltip')` not found (`Expected visible`, timeout 5000ms) | **TEST_CONTRACT / 열림·토글 상태 전제 혼선**. 원본 Playwright Trace: `focus` 직후 팝오버 OPEN/`aria-expanded=true`; 직후 `press('Enter')` 실행 뒤 `aria-expanded=false`/팝오버 제거. 실제 스크롤 테스트까지 진행 못함. 이전 접근성 개선 재발을 입증하지 않음. | 신규 keyboard-scroll 케이스에서 focus가 열어준 팝오버를 먼저 `aria-expanded=true`/`tooltip visible`로 확인하고 곧바로 Arrow/Page/Home/End 동작 검증. 기존 6표시화면×5폭 E2E가 Enter/Space를 별도로 계속 검증. 새 PR CI **NOT TESTED** | 단일 재현 Trace 확인; 원격 새 HEAD 전체 E2E, 취소된 shard 재검증 필요 |

누적 원격 실패 테스트 파일 합집합: **없음**(이 사건은 브라우저 테스트 실패가 아니라 QA 리뷰 차단). 수정 대상 코드는 `src/components/ui/context-help.tsx`, 직접 회귀는 `tests/e2e/issue-719-contextual-help.spec.ts`. 기존 E2E 6/6 PASS는 이전 Head에만 유효하며 새 Head의 PASS로 승계하지 않는다.

## 3. 개별 사건: F-001 (2026-10-18)

- GitHub 원격 첫 오류: [Job 117559273483](https://github.com/planner77/masterGantt/actions/runs/39086924294/job/117559273483)의 `python3 scripts/qa_final_automated.py` 결과 `자동 QA: BLOCKED`, `사유: 미해결 review thread`, exit code 1. Run 결론 FAILURE는 이 후속 QA 때문이지 필수 Quality/E2E/Docker 자체의 실패가 아니다.
- 최초 코드 리뷰 증거: [Codex finding](https://github.com/planner77/masterGantt/pull/722#discussion_r4305289690); 짧은 viewport·browser zoom·긴 localized 문장일 때 tooltip은 `max-height`와 `overflow:auto`로 잘리며, 포털 밖 trigger가 blur되면 닫혀 키보드-only로 남은 본문을 볼 방법이 없다.
- 근본 원인: tooltip 요소에 focus 가능한 keyboard scroll 경로가 없고 trigger에서도 내부 scroll을 제어하지 않았다. 원격 CI는 심각도를 낮추거나 리뷰를 자동으로 무시하지 않았다.
- 제한 보완: trigger의 `onKeyDown`으로 내부 스크롤만 처리, `aria-keyshortcuts` 노출; open·overflow 상태에서만 Arrow/Page/Home/End 가로채며 trigger focus, Escape, pointer/touch, disabled/pending 계약은 그대로 유지한다. tooltip 자체를 `role=dialog`로 바꾸거나 상위 모달·페이지 스크롤을 가로채지 않는다.
- 회귀 선정: 직접 `tests/e2e/issue-719-contextual-help.spec.ts` (모든 6화면·5폭, keyboard/ARIA, touch, 신규 short viewport×긴 설명); 간접 `resource-error-recovery.spec.ts`, `resource-tabs.spec.ts`, `project-master-admin.spec.ts`, `project-logistics-management.spec.ts`; 음성 경로 canonical/Target/Milestone 집계·Gantt marker-OFF를 기존 E2E/6 shard로 확인할 것. 새로운 UI test는 합법적 조건을 늘리며 skip/timeout/assertion 완화 없음.
- 수정 후보 local Fast Feedback: **NOT TESTED**(연결된 GitHub 컨텐츠 API로 원격 수정, 현 실행 환경에 프로젝트 checkout 또는 브라우저/Node 의존성 없음). 정적 코드 검토와 원격 자동 CI를 구별한다. 새 Git Tree/Head/Run ID와 결과는 PR·Issue 기록으로 연결한다.
- Artifact: 원본 CI [Actions](https://github.com/planner77/masterGantt/actions/runs/39086924294)와 [QA report artifact 12121736944](https://github.com/planner77/masterGantt/actions/runs/39086924294/artifacts/12121736944). 로그 또는 ZIP의 raw/secret을 Git에 넣지 않는다.

## 4. 전체 이력 종합 진단과 후속 기준

- 현재 등록된 최초 원격 Full CI 실패는 **1회**이며 이전 원격 실패 이력을 임의로 추가하지 않는다. #719 Work Packet에 기록된 최초 로컬 hydration/focus/HMR 교정은 원격 실패 횟수에 합산하지 않는다.
- 원인 분류: `PRODUCT` (읽기 접근성), 파생된 `POLICY_CI` (정상 차단). `TEST_CONTRACT/FIXTURE_OBSERVABILITY/INIT_TRANSPORT/ENVIRONMENT`로 확정할 증거는 없다.
- 향후 **동일 #719 CI가 다시 실패**하면 이 문서에 Run/Attempt별 원본 Job/Step/Artifact, 최초 실제 오류, 이전 교정의 영향, 누적 실패 파일 합집합, 공통 원인/신규 원인 매트릭스 및 동일 source 교차 검증을 **추가**한다. 직전 Run만 보고 테스트를 무력화하거나 timeout·retry를 일괄 증가시키지 않는다.
- 리뷰 thread가 해제되어도 원본 #2932.1 결과는 FAILURE다. 새 Full PR CI의 exact Head/base/test merge 및 Required3종·QA Final 상태는 다시 인증하며, 별도의 Trusted QA/Owner 최종 병합 허가와 정식 release_authorized=false는 보존한다.

## 5. 동일 최종 source 검증 및 인계

- 이 수정은 기존 PR branch에 **원자적 단일 commit**으로 적용 예정. Code/Tests/Docs/Work Packet/실패 원장은 같은 source를 사용하며 적용 직후 실제 새 Head/Run ID는 PR/Issue에 게시한다.
- 최초 PR `mergeable=true`이고 main과 앞섬 1·뒤짐 0이지만 push 직전에 재확인한다. Codex 리뷰의 실질 코드 교정·댓글 회신 이후 미해결 thread를 해제하고, 새 CI의 Quality/E2E/Docker 및 QA 결과는 시작 전 `NOT TESTED`로 표시한다.
- `risk_level=HIGH, qa_required=true, qa_method=OWNER_MANAGED, release_required=true, release_authorized=false`. **병합, Main CI, GHCR, Finalizer, 정식 tag, Issue 종료는 이 REWORK 요청 범위 밖**.

## 6. F-002 — 두 번째 Full PR CI 실패 / 2026-10-18 추가 (원본 F-001 보존)

### 원격 Run·Job·원본 오류

- 귀속: [Issue #719](https://github.com/planner77/masterGantt/issues/719) / [PR #722](https://github.com/planner77/masterGantt/pull/722). [CI #2933.1, Run 39089185087 / attempt 1](https://github.com/planner77/masterGantt/actions/runs/39089185087); `event=pull_request`, workflow ID `356198495`. Head `c69fc7d08957e790f7ec75350e22bb6b603d608f` / base `d2768676aa7a0edff67df9bdeb3e1b49979fd577` / test merge `53e75bf07e9cf49a65c5b8e44a7074b241406c6d`.
- Required 집계: Quality **SUCCESS** (job 117562694428), Docker **SUCCESS** (117562848836), Chromium E2E **FAILURE** (117563871906); `QA Final — Automated` job 117563890333 **FAILURE**는 `required e2e 미성공`에 따른 올바른 **파생 실패**. Policy·QA Preflight·TypeScript·Vitest·ESLint·Next.js Build는 SUCCESS, conditional Main-only/metadata-only는 SKIPPED.
- 실제 E2E 실패: [Shard 2/6 job 117562440507](https://github.com/planner77/masterGantt/actions/runs/39089185087/job/117562440507)의 `tests/e2e/issue-719-contextual-help.spec.ts:137` 테스트. 2026-10-18 02:19:39 UTC, line145 `await expect(page.getByRole("tooltip")).toBeVisible()`: 5000ms 기다린 후 `element(s) not found`. Shard 2 결과 **43 passed, 1 failed, 86 did not run** (일부 E2E 후보 미실행; 1 error 별도 로깅). 같은 shard의 기존 #719 6화면×5폭 6case, touch, 공정 선행 경고, 리소스 편집 초안 사례는 직전 모두 PASS.
- 다른 PR shard 1/3/4/5/6 job `117562440502/117562440559/117562440541/117562440535/117562440548`: matrix Fail-Fast로 **CANCELLED**. 해당 로그에서 추가 명시 테스트 FAIL 증거는 없지만 시작한 시험이 완료/성공되었다는 뜻이 아니므로 PASS로 합산하지 않는다.
- 원본 artifacts: [Playwright report & trace 12121239923](https://github.com/planner77/masterGantt/actions/runs/39089185087/artifacts/12121239923), [QA Final 12122650730](https://github.com/planner77/masterGantt/actions/runs/39089185087/artifacts/12122650730). 원본 GitHub artifact/trace URL만 링크하며 binary/raw log는 Git에 기록하지 않는다.

### 전 실패와 비교한 검증 사실 / 원인 분류

- F-001은 포털 도움말을 키보드로 스크롤할 수 없는 **PRODUCT 접근성 결함 → QA 리뷰 차단**이었고, `c69fc7d...`에서 원인 해결을 위한 Arrow/Page/Home/End 핸들러 및 증명 테스트를 추가했다. F-002는 그 수정에 추가된 **새 E2E 테스트**에서 발생했으며 기본 Quality·Build·Docker는 통과했다.
- **검증한 Trace 상태 전이:** `scrollIntoViewIfNeeded` 후 `focus()` 완료 시 `aria-expanded=true`, `popover=manual`인 role=tooltip이 **실제로 OPEN**이다 (`call@8236 after`). 이후 테스트가 별도 `press("Enter")`를 수행하기 전에도 확장 상태가 유지된다 (`call@8238 before`). Enter 직후 `aria-expanded=false`로 바뀌고 tooltip이 사라졌다 (`call@8240 before`). 따라서 line145의 최종 `tooltip not found`는 **스크롤 구현 호출 전의 열림/토글 전제 오류**다. 테스트가 focus-open 상태에서 Enter를 중복 수행한 것이 관측된 직접 요인이다. React pinned/ref·브라우저 세부 이벤트 원인은 별도 계측이 없으므로 특정 내부 이벤트로 단정하지 않는다.
- 분류: `TEST_CONTRACT` (중복 토글로 이미 열린 도움말이 닫힌 상태를 잘못 기대). 이전 코드가 수정한 실제 접근성 계약의 재발로 판정할 증거 없음. 실패를 `ENVIRONMENT`·flaky로 처리하거나 timeout/retry를 증가시킬 근거도 없음.
- 직접 보완: `tests/e2e/issue-719-contextual-help.spec.ts`의 **긴 도움말 키보드 스크롤** 케이스에서 `focus()`에 따른 자연스러운 열림을 먼저 `aria-expanded=true` + `tooltip visible`로 단언하고, 그 열린 동일 팝오버에서 ArrowDown/PageDown/End/PageUp/ArrowUp/Home 및 Escape/focus restore·DOM scroll 변화를 계속 검증한다. 중복 `press("Enter")`만 제거한다. 이미 기존 6개 화면×5폭 테스트가 Enter/Space 오픈·Escape·click toggle을 별도로 유지하므로 해당 의미의 회귀 커버리지는 축소하지 않는다. 제품/handler·기존 접근성 UX 정책은 이 원인으로 수정하지 않는다.
- 검증 범위: F-001 `src/components/ui/context-help.tsx` / `tests/e2e/issue-719-contextual-help.spec.ts` 전체, F-002 신규 keyboard case, 간접 관리자 인증/초안 `project-master-admin.spec.ts`·`resource-error-recovery.spec.ts` 및 Milestone/Target/Logistics 상태; 음성 경로 Gantt marker-OFF·canonical. 직전 F-001을 완전 해결했다고 가정하지 않고 최종 source 원격 Full PR CI E2E6/Required QA를 다시 기다린다.
- 정적 diff 구조와 GitHub trace 비교는 수행했지만 로컬 프로젝트 checkout·Playwright/Node 통합 실행은 현재 실행 환경에서 **NOT TESTED**. 새 Head 실행을 과거 PASS로 소급할 수 없다.

### 다음 시행 인계

- 새 test+원장+Work Packet 문서만 **원자적 단일 git commit**으로 수정한다. 다음 PR Head, base/test merge 및 Run/Attempt는 PR/Issue에 기록하며 검사 시작 시 status `IN_PROGRESS` 또는 `NOT TESTED`.
- 위험 `HIGH`, `qa_method=OWNER_MANAGED`, `release_required=true` / `release_authorized=false`, Trusted QA와 Owner 최종 승인 미실시. 병합/정식 GHCR/Finalizer/Issue 종료를 수행하지 않는다. 이후 #719 실패는 **같은 이 누적 문서의 F-003**에 추가하여 F-001/F-002 전체와 합집합 분석한다.
