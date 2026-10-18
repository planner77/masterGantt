# Issue #719 / PR #722 — 누적 PR CI 실패 분석
Primary Issue: [#719](https://github.com/planner77/masterGantt/issues/719) | 관련 PR: [#722](https://github.com/planner77/masterGantt/pull/722) | 최초 작성: 2026-10-18
Source of truth: [PR_CI_FAILURE_TRIAGE.md](PR_CI_FAILURE_TRIAGE.md)
상태: **Full PR CI 6회 관측** — #2932.1/#2933.1/#2939.1/#2941.1/#2943.1 전체 FAILURE, #2937.1 전체 CANCELLED(Shard2 실제 FAILURE). F-001~F-006의 각 원본 Run/Attempt/Job을 보존한다. 다음 Head의 세 Required/QA는 시작 시 NOT TESTED.

## 1. Run / Attempt 전체 목록

| PR | 원본 Run / Attempt | workflow / event | Head / Base / Test merge | Required Quality / E2E / Docker | 실패·취소·미실행 | 증거 |
| --- | --- | --- | --- | --- | --- | --- |
| #722 | [#2932.1 · 39086924294](https://github.com/planner77/masterGantt/actions/runs/39086924294), 2026-10-18 01:33:23 UTC 시작 | CI / `pull_request` full | head `d5344bdfa8239c192bccfbe1c84930d02d7763d8`; base `d2768676aa7a0edff67df9bdeb3e1b49979fd577`; test merge `a248bd383b3abdd51a4270e2e96f27622715c3f2`; branch `feat/issue-719-contextual-help` | **SUCCESS / SUCCESS (6/6 shards) / SUCCESS** | QA Final — Automated **FAIL/BLOCKED**; metadata-only, main-only jobs는 조건부 SKIPPED; 실패한 E2E shard 없음 | [QA Final Job 117559273483](https://github.com/planner77/masterGantt/actions/runs/39086924294/job/117559273483), [Review thread](https://github.com/planner77/masterGantt/pull/722#discussion_r4305289690) |
| #722 | [#2933.1 · 39089185087](https://github.com/planner77/masterGantt/actions/runs/39089185087), 2026-10-18 02:14~02:21 UTC 주요 E2E/QA | CI / `pull_request` full | head `c69fc7d08957e790f7ec75350e22bb6b603d608f`; base `d2768676aa7a0edff67df9bdeb3e1b49979fd577`; test merge `53e75bf07e9cf49a65c5b8e44a7074b241406c6d`; 동일 branch | **SUCCESS / FAILURE (shard2 FAIL, 나머지 5 CANCELLED) / SUCCESS** | Shard2 `issue-719-contextual-help.spec.ts:145` tooltip not found. 동일 shard 43 PASS/1 FAIL/86 NOT RUN; QA Final FAIL은 파생; 다른 shard 취소는 PASS 아님 | [Shard2 Job 117562440507](https://github.com/planner77/masterGantt/actions/runs/39089185087/job/117562440507), [Playwright report artifact 12121239923](https://github.com/planner77/masterGantt/actions/runs/39089185087/artifacts/12121239923) |
| #722 | [#2937.1 · 39090801870](https://github.com/planner77/masterGantt/actions/runs/39090801870), attempt 1 | CI / `pull_request` Full, 전체 Run CANCELLED | Head `fd51674396f7d69f9edcc08b0af6314a6e2f9d5b`; base `d2768676aa7a0edff67df9bdeb3e1b49979fd577`; test merge `1583e53eeb84277c091c038e1ac90338c9e31275` | Quality SUCCESS / E2E FAILURE (Shard2 실제 FAIL·5 shard CANCELLED) / Docker SUCCESS | keyboard case line148 tooltip missing; shard2 43 PASS/1 FAIL/86 NOT RUN. QA BLOCKED(Head stale), 최종 Run CANCELLED | [Shard2 Job 117567275416](https://github.com/planner77/masterGantt/actions/runs/39090801870/job/117567275416), [trace artifact 12122362921](https://github.com/planner77/masterGantt/actions/runs/39090801870/artifacts/12122362921) |
| #722 | [#2939.1 · 39091346735](https://github.com/planner77/masterGantt/actions/runs/39091346735), attempt 1 | CI / `pull_request` Full, 전체 Run FAILURE | Head `e16ae7e5aa95ac430bbcd61b429c7196bcd241d1`; base `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`; test merge `ffb0b8ed98b8f834fcbe20a2b542e22620a78638` | Quality SUCCESS / E2E FAILURE (Shard2 FAIL·5 shard CANCELLED) / Docker SUCCESS | keyboard case line157 tooltip locator.evaluate timeout30s after synthetic DOM append; shard2 43 PASS/1 FAIL/86 NOT RUN. QA derived FAIL(required e2e) | [Shard2 Job 117569031265](https://github.com/planner77/masterGantt/actions/runs/39091346735/job/117569031265), [trace artifact 12122537841](https://github.com/planner77/masterGantt/actions/runs/39091346735/artifacts/12122537841) |

| #722 | [#2941.1 · 39092799612](https://github.com/planner77/masterGantt/actions/runs/39092799612), attempt 1, 2026-10-18 03:12~03:23 UTC | CI / `pull_request` Full, 전체 Run FAILURE | HEAD `650488e44a775497cdb66f1f4c205c16178d9d85`; base `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`; test merge `b521ffc99dfc63268dfc13025ac315c62d0c3a01` | Quality SUCCESS (117573499451) / E2E FAILURE (117574895331; shard2 117573274705 FAIL, 다른 5 CANCELLED) / Docker SUCCESS (117573656471) | 동일 keyboard E2E `spec.ts:153` `toBeInViewport()` expected in viewport, received ratio0. Shard2 43 PASS/1 FAIL/86 NOT RUN. QA Final 117574907740 파생 FAIL(required e2e). | [Shard2 job](https://github.com/planner77/masterGantt/actions/runs/39092799612/job/117573274705), [Playwright report 12123900477](https://github.com/planner77/masterGantt/actions/runs/39092799612/artifacts/12123900477) |

| #722 | [#2943.1 · 39094878403](https://github.com/planner77/masterGantt/actions/runs/39094878403), attempt1, 2026-10-18 03:47~04:03 UTC | CI / `pull_request` Full workflow356198495, FAILURE | Head `d54ee4e5609ae025a01586fdfcad3b1b304331a0`; base `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`; test merge `dfb4a5309171736359ba0f083d57d60df7c75b3a` | Quality SUCCESS 117579685298 / E2E FAILURE 117581661035 (Shard5 FAIL 117579485941; Shard6 SUCCESS; other4 CANCELLED) / Docker SUCCESS 117579888155 | Shard5 `resource-kpi-integration-ui.spec.ts:295` canonical GET `ECONNRESET`, 64PASS/1FAIL/17NOTRUN; QA Final 117581678648 derived FAIL | [Shard5 Job](https://github.com/planner77/masterGantt/actions/runs/39094878403/job/117579485941) · [Trace/diag artifact12124279029](https://github.com/planner77/masterGantt/actions/runs/39094878403/artifacts/12124279029) |

여섯 개 Full Run은 각각의 **서로 다른 Head**에 귀속된다. 각 원본 Run/Attempt의 실패 판정은 불변이며 이후 synchronize/metadata-only/rerun도 Head·event·attempt별 별도 행에 추가한다. 접근 가능한 실행에 한해 집계하므로 미관측 실행을 성공으로 간주하지 않는다.

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
| F-003 / #722 · 39090801870.1 / Shard2 117567275416 | 같은 keyboard E2E의 line148 `getByRole('tooltip')` not visible. Focus 직후 `aria-expanded=true`/popover OPEN, 이어 tooltip assertion 중 `false`/닫힘. | **FIXTURE_OBSERVABILITY / TEST_CONTRACT 의심**, 확정된 외부 scroll/resize/blur 원인은 UNKNOWN. F-002의 중복 Enter는 이미 제거돼 해당 이전 원인 재발이 아니다. 전체 Run은 supersede CANCELLED라도 실제 실패 인정. | 뷰포트 변경·하단 요소 scrollIntoView를 focus 전에 일으키지 않게 시나리오 재설계. 최종 Full PR CI NOT TESTED | 제품이 프로그램 scroll 직후 focus로 도움말이 닫히는 실제 현상인지 별도 추적 필요; GUI 수동 검증 미실시 |
| F-004 / #722 · 39091346735.1 / Shard2 117569031265 | keyboard E2E line157 두 번째 `tooltip.evaluate`의 자동 대기30s timeout. 같은 실행의 first visible/DOM append는 통과; 그 직후 React portal popover 제거. | **TEST_CONTRACT/FIXTURE_OBSERVABILITY**: 테스트가 React 관리하는 열린 tooltip 내부에 직접 DOM append함. Trace는 append 직후 expanded=false를 확인하지만 닫힌 이벤트의 세부 원인은 검증 전 UNKNOWN. F-001 keyboard code의 scroll 동작까지 도달하지 못함. | 앱 실제 help copy를 CSS로 좁혀 overflow를 *열기 전*에 만들고 DOM mutation 제거; keyboard Arrow/Page/Home/End·Escape 단언 모두 유지. 최종 Full CI NOT TESTED | 외부 환경 native zoom·실제 screen reader·오래된 head 재검증 제외 근거 유지 |

| F-005 / #722 · 39092799612.1 / Shard2 117573274705 | `tests/e2e/issue-719-contextual-help.spec.ts:153` `toBeInViewport` failed; target help trigger was found but 390×320 viewport ratio0. | **TEST_CONTRACT/LAYOUT_PRECONDITION**: top admin heading is below fold at that small viewport; original popup keyboard handler was never reached. F-004 portal DOM mutation had already been removed. | Use known working 390×900 five-width fixture, but cap the real tooltip to max-height 56px and width112px before focus to test actual content overflow. Preserve button visibility, Arrow/Page/Home/End, scrollTop, ARIA, Escape/focus assertions; add `clientHeight<=56`. New Full CI NOT TESTED. | Actual short physical viewport/native zoom/screen-reader manual checks remain separate. No product defect proven. |

| F-006 / #722 · 39094878403.1 / Shard5 117579485941 | `resource-kpi-integration-ui.spec.ts:295` final Project snapshot GET `ECONNRESET` after resource KPI/Excel/Gantt round-trip, direct unobserved fixture `request.get(api)`. | **INIT_TRANSPORT, physical cause UNKNOWN**. Parent alive, Health200/14ms, OOM kill0; child RSS and cgroup usage grew but not proof of OOM. Different test than F-002~F-005. | Reuse #703 bounded observedReadOnlyGet + Connection close; pass real observer to all **8 seed callers** (7 UI/1 API), add negative Unit. Writes/other faults fail-closed. | Exact-head Full 6Shard/Trusted/Owner NOT TESTED; observed socket reset remains historically FAIL. |

누적 원격 실패 **테스트 파일 합집합: `tests/e2e/issue-719-contextual-help.spec.ts`의 keyboard scroll case(F-002~F-005) + `tests/e2e/resource-kpi-integration-ui.spec.ts`의 실제 SQLite/HTTP 왕복 case(F-006)**. F-001은 브라우저 실패 없이 QA 리뷰 차단. F-001은 실패한 브라우저 테스트 0건이며 QA 리뷰 차단이다. F-002의 Shard2 43 PASS/1 FAIL/86 NOT RUN과 다른 5 shard CANCELLED를 별도 보존한다. 기존 E2E 6/6 PASS는 F-001의 이전 Head에서만 유효하고 F-002 이후 새 Head로 승계하지 않는다.

## 3. 개별 사건: F-001 (2026-10-18)

- GitHub 원격 첫 오류: [Job 117559273483](https://github.com/planner77/masterGantt/actions/runs/39086924294/job/117559273483)의 `python3 scripts/qa_final_automated.py` 결과 `자동 QA: BLOCKED`, `사유: 미해결 review thread`, exit code 1. Run 결론 FAILURE는 이 후속 QA 때문이지 필수 Quality/E2E/Docker 자체의 실패가 아니다.
- 최초 코드 리뷰 증거: [Codex finding](https://github.com/planner77/masterGantt/pull/722#discussion_r4305289690); 짧은 viewport·browser zoom·긴 localized 문장일 때 tooltip은 `max-height`와 `overflow:auto`로 잘리며, 포털 밖 trigger가 blur되면 닫혀 키보드-only로 남은 본문을 볼 방법이 없다.
- 근본 원인: tooltip 요소에 focus 가능한 keyboard scroll 경로가 없고 trigger에서도 내부 scroll을 제어하지 않았다. 원격 CI는 심각도를 낮추거나 리뷰를 자동으로 무시하지 않았다.
- 제한 보완: trigger의 `onKeyDown`으로 내부 스크롤만 처리, `aria-keyshortcuts` 노출; open·overflow 상태에서만 Arrow/Page/Home/End 가로채며 trigger focus, Escape, pointer/touch, disabled/pending 계약은 그대로 유지한다. tooltip 자체를 `role=dialog`로 바꾸거나 상위 모달·페이지 스크롤을 가로채지 않는다.
- 회귀 선정: 직접 `tests/e2e/issue-719-contextual-help.spec.ts` (모든 6화면·5폭, keyboard/ARIA, touch, 신규 short viewport×긴 설명); 간접 `resource-error-recovery.spec.ts`, `resource-tabs.spec.ts`, `project-master-admin.spec.ts`, `project-logistics-management.spec.ts`; 음성 경로 canonical/Target/Milestone 집계·Gantt marker-OFF를 기존 E2E/6 shard로 확인할 것. 새로운 UI test는 합법적 조건을 늘리며 skip/timeout/assertion 완화 없음.
- 수정 후보 local Fast Feedback: **NOT TESTED**(연결된 GitHub 컨텐츠 API로 원격 수정, 현 실행 환경에 프로젝트 checkout 또는 브라우저/Node 의존성 없음). 정적 코드 검토와 원격 자동 CI를 구별한다. 새 Git Tree/Head/Run ID와 결과는 PR·Issue 기록으로 연결한다.
- Artifact: 원본 CI [Actions](https://github.com/planner77/masterGantt/actions/runs/39086924294)와 [QA report artifact 12121736944](https://github.com/planner77/masterGantt/actions/runs/39086924294/artifacts/12121736944). 로그 또는 ZIP의 raw/secret을 Git에 넣지 않는다.

## 4. 전체 이력 종합 진단과 후속 기준

- **접근 가능한 Full PR CI 6개 실행 중 전체 FAILURE 5회·CANCELLED 1회(Shard2 실제 FAIL)**: F-001(#2932.1)은 QA 리뷰 미해결→정책상 정상 차단, F-002(#2933.1)는 신규 E2E focus/Enter 열림 상태 전제 충돌→Shard2 실패·다른 shard 취소 및 QA 파생 실패. 동일 실패로 합산하지 않는다. 원본 로컬 hydration/focus/HMR 교정은 별도 Work Packet 기록이며 원격 실패 수에 포함하지 않는다.
- **전체 원인 분류**: F-001의 `PRODUCT`(키보드 scroll 접근성) + `POLICY_CI`(열린 리뷰 적법 차단); F-002의 `TEST_CONTRACT`(focus-open 직후 Enter로 이미 열린 popover 토글). 환경 불안정·fixture·transport 문제로 확정할 증거 없음. 기존 원인과 신규 원인을 코드·Trace·Review 근거로 구분한다.
- 향후 **동일 #719 CI가 다시 실패**하면 이 문서에 Run/Attempt별 원본 Job/Step/Artifact, 최초 실제 오류, 이전 교정의 영향, 누적 실패 파일 합집합, 공통 원인/신규 원인 매트릭스 및 동일 source 교차 검증을 **추가**한다. 직전 Run만 보고 테스트를 무력화하거나 timeout·retry를 일괄 증가시키지 않는다.
- 리뷰 thread가 해제되어도 원본 #2932.1 결과는 FAILURE다. 새 Full PR CI의 exact Head/base/test merge 및 Required3종·QA Final 상태는 다시 인증하며, 별도의 Trusted QA/Owner 최종 병합 허가와 정식 release_authorized=false는 보존한다.

## 5. 동일 최종 source 검증 및 인계

- 실제 수정 이력: F-001 제품 키보드 스크롤 교정·테스트 도입 commit `c69fc7d08957e790f7ec75350e22bb6b603d608f`; F-002 E2E focus-open 상태 계약 교정·동일 원장 백필 commit `fd51674396f7d69f9edcc08b0af6314a6e2f9d5b`. 이번 정렬은 두 원본 수정과 실패 기록을 보존하면서 새 main의 #449 문서만 병합한다.
- main 변경 전 PR은 최신이었지만 2026-10-18 `main=3eaa6026923c38f200a463f6985c7cc8f88f9bf0`(#449 PR #458 docs) 병합 뒤 `behind=5, ahead=3, mergeable=false`로 변했다. 공통 변경 파일은 `docs/exec-plans/active/PLAN.md` 단 한 개이며 main 상단 #449와 브랜치 하단 #719 섹션을 모두 살리는 결합으로 resolve한다. `DESIGN.md` 및 #449 신규 3개 문서는 main의 exact blob을 사용한다.
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

- F-002 보완은 `fd51674396f7d69f9edcc08b0af6314a6e2f9d5b`로 기존 branch에 이미 제출되었고 [Full CI #2937.1](https://github.com/planner77/masterGantt/actions/runs/39090801870)이 시작되었다. 그러나 그 사이 main #449 변경으로 충돌이 발생하여 이번 요청에서 정확한 최신 main을 2-parent merge로 포함하고 교차 원장 설명도 현재 누적 2회 기준으로 정정한다. 다음 CI는 이 merge 정렬 HEAD 기준 Full PR CI를 별도로 시작한다.
- 위험 `HIGH`, `qa_method=OWNER_MANAGED`, `release_required=true` / `release_authorized=false`, Trusted QA와 Owner 최종 승인 미실시. 병합/정식 GHCR/Finalizer/Issue 종료를 수행하지 않는다. 이후 #719 실패는 **같은 이 누적 문서의 F-003**에 추가하여 F-001/F-002 전체와 합집합 분석한다.

## 7. F-001/F-002 누적 원인 교차 검증 및 최신 main 정렬 (2026-10-18)

| 항목 | F-001 (#2932.1) | F-002 (#2933.1) | 현 후보 조치·검증 경계 |
| --- | --- | --- | --- |
| 최초 실제 장애 | 미해결 리뷰의 keyboard scroll 접근성 | 신규 long-content E2E에서 tooltip 미발견 | F-001 제품 `ContextHelp` Arrow/Page/Home/End 키보드 내부 스크롤 유지, F-002 focus-open 후 중복 Enter 제거 |
| Required aggregates | Quality SUCCESS / E2E6 SUCCESS / Docker SUCCESS, QA BLOCKED | Quality SUCCESS / E2E FAILURE(1fail/5cancelled) / Docker SUCCESS, QA 파생 FAIL | 각 원본 Head·attempt에서만 인정, 새 exact-Head Quality/E2E6/Docker/QA는 **NOT TESTED** |
| 원인 분류 | PRODUCT + POLICY_CI | TEST_CONTRACT | ENVIRONMENT/fixture/transport 단정 근거 없음, skip/assertion/timeout/CI Required 완화 없음 |
| 직접/교차·음성 소비자 | 도움말 primitive, 6화면×5폭, keyboard/touch/초안 | `issue-719-contextual-help.spec.ts`의 focus-open 긴 문자열/short viewport | 인접 Resource/Admin·Milestone/Logistics, Gantt marker-OFF·canonical 계약 새 Full CI 재검증 예정 |

- 이 정렬 직전 #719 HEAD는 `fd51674396f7d69f9edcc08b0af6314a6e2f9d5b`. [Full CI #2937.1 / Run 39090801870](https://github.com/planner77/masterGantt/actions/runs/39090801870)이 해당 Head로 시작했으나 그 사이 main의 [#449 PR #458 merge `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`](https://github.com/planner77/masterGantt/commit/3eaa6026923c38f200a463f6985c7cc8f88f9bf0)까지 다섯 커밋 반영됐다. 정렬 직전 GitHub PR은 `behind=5`/`mergeable=false`; 기존 실행은 새로운 strict main-aligned Head의 검증을 대체하지 않는다.
- main 변경은 `DESIGN.md`, #449 신규 원장·감사·Work Packet과 `PLAN.md`. #719 제품/테스트와 겹치는 직접 수정은 없고 양측에 동시에 변경된 파일은 `PLAN.md` 하나다. main의 상단 #449와 feature의 하단 #719 계획을 모두 보존한다. #449 DESIGN.md 변경은 기존 #715/#719 도움말 원칙을 삭제하지 않고 화면 간 밀도·컨트롤 식별성·실증 기준을 추가한다. 현재 UI/API/DB/version/CI/QA 보호 정책 불변.
- 정렬 방법은 기존 feature Head를 첫 부모, latest main을 둘째 부모로 하는 **비강제 Git merge**. 기존 HEAD tree에 main exact blobs + `PLAN.md` 양측 추가 문단 + 누적 원장·Work Packet 정정만 반영한다. 배포 후보 버전 `0.116.1`, `release_required=true` / `release_authorized=false` 유지. 새 HEAD/base/test merge/Run ID는 push 후 다시 조회한다.
- 이번 GitHub connector-only 실행에서 local Node/Playwright/Chromium **NOT TESTED**. 원격 Git object/tree/parent/ref와 strict behind0, unresolved review0을 검증하고 새 Full PR CI를 시작한다. 최신 Head Quality/E2E/Docker/Trusted QA/Owner ACCEPT는 완료 전 NOT TESTED. 병합·Main/GHCR/Finalizer·tag/Issue 종료는 수행하지 않는다.

## 8. F-003 / F-004 — 동일 접근성 회귀 테스트 연속 실패 종합 (2026-10-18)

### F-003: CI #2937.1 — 취소된 Workflow에도 실제 Shard 실패 존재

- [Run 39090801870 attempt 1](https://github.com/planner77/masterGantt/actions/runs/39090801870), event=`pull_request`, workflow=CI(356198495), Head `fd51674396f7d69f9edcc08b0af6314a6e2f9d5b`, Base `d2768676aa7a0edff67df9bdeb3e1b49979fd577`, Test merge `1583e53eeb84277c091c038e1ac90338c9e31275`. 새로운 main 정렬 commit에 의해 전체 Run은 CANCELLED로 기록되었지만 [E2E Shard 2 Job 117567275416](https://github.com/planner77/masterGantt/actions/runs/39090801870/job/117567275416)에는 실제 FAIL이 존재한다.
- 실제 원본 오류: `tests/e2e/issue-719-contextual-help.spec.ts:137`의 long help keyboard case, line148 `await expect(tooltip).toBeVisible()`, `getByRole('tooltip')` element not found after 5s. 이전 F-002와 **중복 Enter 제거한 소스**임에도 연속 실패. Shard2 `43 passed / 1 failed / 86 did not run`, 나머지 5 shard CANCELLED. Quality SUCCESS (117567487282), Docker SUCCESS (117567686365), E2E aggregate FAILURE (117568632265), QA Automated BLOCKED (117568643376: `PR latest Head stale`). `CANCELLED` 최종 상태를 `FAILURE` 전체 Run으로 바꾸지는 않으나 테스트 FAIL은 보존한다.
- [Playwright trace 12122362921](https://github.com/planner77/masterGantt/actions/runs/39090801870/artifacts/12122362921) 실제 분석: trigger.focus 후 `aria-expanded=true`/popover OPEN 스냅샷 뒤 다음 tooltip assertion 시 `aria-expanded=false`/popover 미존재. 추가 Enter 없음. 바깥 문서 scroll/resize/blur 등 어떤 handler가 실제 호출됐는지는 로그에 없으므로 확정하지 않는다.
- F-001의 키보드 스크롤 접근성 코드와 F-002의 중복 Enter 수정을 유지한다. F-003은 열린 도움말 자체가 사라지는 fixture/lifecycle 관측 문제이며 E2E가 Arrow/Page 스크롤 assertions까지 도달하지 못했다.

### F-004: CI #2939.1 — React 관리 노드 외부 변형 직후 tooltip 소실

- [Run 39091346735 attempt 1](https://github.com/planner77/masterGantt/actions/runs/39091346735), event=`pull_request`, workflow=CI(356198495), Head `e16ae7e5aa95ac430bbcd61b429c7196bcd241d1`, Base `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`, Test merge `ffb0b8ed98b8f834fcbe20a2b542e22620a78638`. 전체 FAILURE.
- Quality SUCCESS (117569202597), Docker SUCCESS (117569466315), E2E aggregate FAILURE (117570169224). [Shard2 Job 117569031265](https://github.com/planner77/masterGantt/actions/runs/39091346735/job/117569031265) `43 passed / 1 failed / 86 did not run`; 나머지 5 shards CANCELLED. QA Automated FAIL 117570179840는 `required e2e 미성공` 파생으로, 별도 제품 실패가 아니다.
- 실제 원본 오류: 동일 test line157 `tooltip.evaluate(...scrollHeight/clientHeight...)`에서 locator가 재발견되지 않아 30초 **test timeout**, 최초 `toBeVisible` 및 첫 번째 `tooltip.evaluate(element.appendChild(longCopy))`는 통과했다.
- [Playwright trace 12122537841](https://github.com/planner77/masterGantt/actions/runs/39091346735/artifacts/12122537841)의 DOM 스냅샷: focus 후 `aria-expanded=true` + role=tooltip OPEN; synthetic KO/EN `appendChild` 평가 이후 `aria-expanded=false` + tooltip 없음. **인위적 DOM 추가와 닫힘의 시간 순서는 확인되나**, 내부 popover dismiss event 종류는 UNKNOWN이다. Root product bug 확정이나 CI flaky 추측·timeout 증액·skip으로 대체하지 않는다.

### F-001~F-004 종합 보완 및 동일 후보 검증

- 이전 PRODUCT(P2 keyboard overflow)와 F-002의 중복 Enter 문제는 각각 `c69fc7d`/`fd516743`에서 직접 교정했다. F-003/F-004는 그 **새로운 테스트의 열림 상태가 검증 전 사라지는 동일 구간**에서 반복되어 UI primitive와 테스트 fixture의 시간 순서·DOM 소유권을 다시 평가했다.
- 신규 회귀 변경은 `tests/e2e/issue-719-contextual-help.spec.ts` **하나**다. 테스트에서 viewport 390×320을 navigation 전에 고정하고, 화면 상단의 실제 `프로젝트 기준정보 관리 도움말`을 사용하므로 하단 설명의 `scrollIntoViewIfNeeded`와 이후 focus 사이의 이벤트 경합을 제거한다. 열린 popover의 React-managed DOM에 `appendChild` 하지 않고, **오픈 전에 주입한 테스트 CSS**(`max-height:56px; width/max-width:112px`)로 실제 KO help 문구를 세로로 자르되 접근 가능한 원문과 앱 컴포넌트는 변경하지 않는다.
- 강제 좁은 도움말은 긴 KO/EN 로컬라이제이션에서 동일한 overflow 조건을 만드는 **통제된 layout proxy**다. 영어 설명 실제 번역 문구를 실행했다고 주장하지 않는다. 여전히 `scrollHeight>clientHeight`, `viewport>clientHeight`, trigger focus + aria-expanded·accessible description, ArrowDown/PageDown/End/PageUp/ArrowUp/Home의 실제 scrollTop, Escape 닫기/초점 복원 **모든 assertion 유지**. 최초 #719 6화면×5폭/Enter·Space·hover·touch/권한·pending/dirty 경로도 유지한다.
- 변경 영향: 직접 #719 E2E 전체(기존 6화면×5폭 + keyboard); 간접 `project-master-admin.spec.ts`, `resource-error-recovery.spec.ts`, `resource-tabs.spec.ts`, `project-logistics-management.spec.ts`; 음성 Milestone/Target/canonical/Gantt marker-OFF. #2939 동일 Head의 원본 43 PASS는 참고만 하고 새 Head의 CI PASS로 재사용하지 않는다. Test timeout/retry/skip·product validation·CI shard fail-fast·Required check 변경 없음.
- 원격 최종 source의 local Node/Playwright E2E 및 native125%/screen reader/실기기: **NOT TESTED**(이 환경은 GitHub API 수정 및 기존 zip trace 분석만 수행). 신규 Full PR CI를 정확 Head에서 시작한 뒤 결과는 **IN_PROGRESS/NOT TESTED**로 남기며 요청대로 CI 모니터링·병합·Main/GHCR/Finalizer·tag·Issue 종료는 하지 않는다. 잔여 위험은 실제 focus 상태의 외부 scroll에 의한 tooltip dismissal 여부(원격 trace가 닫힘 원인 이벤트를 노출하지 않음) 및 환경별 확대/스크린리더 실증이다.
- 후속 실패 F-005(#2941.1)는 아래 §9에 추가했다. 이번 실패 F-006을 §10에 기록하고 다음은 F-007부터 같은 원장에 누적하고 F-001~F-005의 실제 Run/Attempt/Job 및 테스트 합집합을 먼저 재평가한다.

## 9. F-005 — CI #2941.1 재실패 및 화면 배치 테스트 전제 교정 (2026-10-18)

### 원본 증거와 전체 Run 판정

- [PR #722 Full CI #2941.1](https://github.com/planner77/masterGantt/actions/runs/39092799612), Run 39092799612 attempt 1, event `pull_request`, workflow 356198495, HEAD `650488e44a775497cdb66f1f4c205c16178d9d85`, base `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`, test merge `b521ffc99dfc63268dfc13025ac315c62d0c3a01`. 전체 **FAILURE**.
- Quality aggregate job 117573499451 **SUCCESS**, Docker 117573656471 **SUCCESS**. Chromium aggregate 117574895331 **FAILURE**: [Shard 2 job 117573274705](https://github.com/planner77/masterGantt/actions/runs/39092799612/job/117573274705) 실제 43 PASS / 1 FAIL / 86 NOT RUN, 다른 5 shards Fail-Fast **CANCELLED**. [QA Final job 117574907740](https://github.com/planner77/masterGantt/actions/runs/39092799612/job/117574907740) `required e2e 미성공` 파생 FAIL. Skipped 및 취소는 PASS 아님.
- 최초 실패 `tests/e2e/issue-719-contextual-help.spec.ts:153:25`: `expect(trigger).toBeInViewport()`에서 `Expected: in viewport`, `Received: viewport ratio 0`, timeout5000ms. Locator는 버튼으로 정상 resolve됨 (`aria-expanded=false`); 팝오버 open/Arrow/Page/Home/End까지 미진행. [Playwright trace/report artifact 12123900477](https://github.com/planner77/masterGantt/actions/runs/39092799612/artifacts/12123900477). 실제 대상은 관리자 상단 `프로젝트 기준정보 관리 도움말`; 390×320에서는 상위 레이아웃 때문에 visible 화면 밖이므로 `toBeInViewport`의 사전 전제가 거짓.

### F-001~F-005 누적 Cross-run 인과와 수렴 판정

| 사건 | 실패 위치/원인 | 보완 유지 여부/이번 차이 |
| --- | --- | --- |
| F-001 #2932.1 | 제품 도움말 keyboard scroll 접근성 결함 → 미해결 리뷰 QA BLOCKED | 기존 `ContextHelp` Arrow/Page/Home/End 접근성 코드는 유지. 이번 실패는 호출 전이라 제품 회귀 입증 아님 |
| F-002 #2933.1 | focus-open 이후 중복 Enter로 tooltip 닫힘 | 중복 Enter 제거 유지; 이번에는 Enter 이전 사전 조건 실패 |
| F-003 #2937.1 | 이미 열린 팝오버가 focus/scroll 중 사라짐 (root cause UNKNOWN); Run 전체 CANCELLED, shard 실제 FAIL | late scroll/resize 제거는 유지했으나 320px viewport에서 top trigger visible이라는 가정이 남았음 |
| F-004 #2939.1 | 테스트가 React-owned portal 자식에 직접 DOM append 후 tooltip 소실 | synthetic DOM mutation 제거 유지; 이번 실패는 DOM 조작 이전 |
| **F-005 #2941.1** | **TEST_CONTRACT / LAYOUT_PRECONDITION** — 390×320에서 top help trigger viewport ratio0 | 실제 앱에서 검증됐던 390×900 관리자 viewport 사용, 열기 전 tooltip **자체를** CSS max-height56px/폭112px으로 제한하여 긴 KO 설명의 `scrollHeight>clientHeight`를 직접 증명 |

- F-002~F-005가 같은 한 테스트에서 순차 발생해도 원인을 하나로 뭉뚱그리지 않는다. 제품 접근성 계약을 검증하기 전 테스트 setup에서 발생한 결함들이며 `flaky`/환경/제품 원인으로 근거 없이 단정하지 않는다. 원본 원장/Run/Trace의 실패를 PASS로 변경하지 않는다.
- 수정 범위: `tests/e2e/issue-719-contextual-help.spec.ts`의 마지막 keyboard-scroll case만 `page.setViewportSize({ width:390, height:900 })`로 변경. 기존 CSS `width/max-width:112px;max-height:56px` 및 기본 버튼 `toBeInViewport`, `aria-expanded=true`, accessible description, `scrollHeight>clientHeight`, 실제 ArrowUp/Down, PageUp/Down, Home/End scrollTop, Escape/focus restore 단언 **모두 보존**. `clientHeight<=56`을 추가하여 clipping 조건을 직접 강화. 제품/CI/리트라이/timeout/skip 또는 assertion 완화는 없음.
- 테스트 영향: 직접 six-surface×5-width/keyboard/focus/touch 신규 spec + 기존 F-001~F-004 원인 합집합; 간접 Project Master/Resource profile dirty draft·Logistics/Target UI, 음성 Gantt marker-OFF/canonical/Milestone scope. 새 Full 6 shards에서 이전 취소 영역 재검증. Local browser/Node 진단은 이번 GitHub connector-only 환경에서 **NOT TESTED**; 이전 HEAD PASS는 새 HEAD의 PASS가 아님.
- 최신 main strict / review thread 0 / Git Tree·부모·PR head/Run ID는 업데이트 뒤 재조회한다. 위험 HIGH, qa_required=true, qa_method=OWNER_MANAGED, release_required=true, release_authorized=false. 정확 신규 Head Required Quality/E2E/Docker/QA는 시작 시 NOT TESTED. 병합/Main/GHCR/Finalizer/tag/Issue 종료는 비범위다.

## 10. F-006 — PR CI #2943.1 canonical GET ECONNRESET 분석 및 한정 보완 (2026-10-18)

- **원본:** [Issue #719](https://github.com/planner77/masterGantt/issues/719) / [PR #722](https://github.com/planner77/masterGantt/pull/722), [Full CI #2943.1 / Run39094878403 attempt1](https://github.com/planner77/masterGantt/actions/runs/39094878403), event pull_request, workflow356198495; HEAD `d54ee4e5609ae025a01586fdfcad3b1b304331a0`, base `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`, test merge `dfb4a5309171736359ba0f083d57d60df7c75b3a`. Overall FAILURE. Quality SUCCESS job117579685298, Docker SUCCESS job117579888155, Chromium aggregate FAILURE job117581661035. Shard5 job117579485941 64PASS/1FAIL/17NOTRUN, Shard6 job117579485949 SUCCESS, Shard1~4 CANCELLED; QA Final117581678648 `required e2e 미성공` 파생 FAIL.
- **첫 실제 오류:** [Shard5](https://github.com/planner77/masterGantt/actions/runs/39094878403/job/117579485941)의 `tests/e2e/resource-kpi-integration-ui.spec.ts:295` 최종 `seeded.getSnapshot()` → `tests/e2e/fixtures/resource-kpi-integration-ui.ts:18` 직접 `request.get(api)`의 `apiRequestContext.get: read ECONNRESET`. HTTP status/payload/revision 불일치는 관측되지 않았음. [Trace + diagnostics artifact ID12124279029](https://github.com/planner77/masterGantt/actions/runs/39094878403/artifacts/12124279029).
- **진단:** 격리 Fixture `reason=test_failure`, `requests=[]`은 실패한 GET이 `observeIsolatedApi` 호출 경로에 없었기 때문. Parent PID11604 `alive=true`, exit/signal null; 장애 후 독립 Health HTTP200/14ms, cgroup oomKill0. Next child RSS 1,841,576→4,059,496KB 및 cgroup current 7,151,710,208→9,735,340,032B 증가 관측. 서버 프로세스 종료/OOM/네트워크 keepalive 근인은 **UNKNOWN**, 메모리 증가만으로 인과 증명 불가.
- **F-001~F-005와 교차:** F-001은 PRODUCT keyboard 접근성 리뷰/QA 차단, F-002~F-005는 `issue-719-contextual-help.spec.ts`의 keyboard E2E 열림/DOM/layout TEST_CONTRACT 실패. F-006은 #530 `resource-kpi-integration-ui.spec.ts`의 새로운 `INIT_TRANSPORT` 위치. 과거 교정 코드·원본 FAILURE/CANCELLED를 덮어쓰거나 새 Head PASS로 승계하지 않는다. 누적 직접 실패 테스트는 이 두 파일의 합집합.
- **기존 정책 재사용:** [#703 원격 검증](REMOTE_VALIDATION.md)의 `observedReadOnlyGet` + [공통 Unit](../tests/scripts/isolated-readonly-get.test.ts)는 **첫 ECONNRESET을 안전한 process/health/cgroup 진단으로 포착한 뒤 동일 read-only canonical GET만 1회** 다시 실행한다. 이번 #530 fixture는 그 보호가 누락된 소비자였음. `Connection:close`로 stale pooled connection 가능성을 줄인다. HTTP4xx/5xx, 다른 network 오류·bad JSON·두 번째 ECONNRESET은 FAIL, POST/PUT/PATCH/DELETE 재전송0. 서버의 실제 물리적 리셋 원인 자체를 해결했다고 주장하지 않는다.
- **제품/테스트 수정:** `tests/e2e/fixtures/resource-kpi-integration-ui.ts`에 `readResourceKpiSnapshot`과 필수 `ObserveIsolatedApi`를 도입. 실제 호출자 `tests/e2e/resource-kpi-integration-ui.spec.ts` **7개** 및 `tests/e2e/resource-kpi-integration-api.spec.ts` **1개**에 observer 전달. `tests/scripts/resource-kpi-canonical-get.test.ts`의 정확 snapshot/1회 GET/Connection close, 1회 reset-only recovery, 2차 reset FAIL, HTTP404/409/503·timeout·malformed JSON FAIL로 소비자 정책을 증명한다. 기존 #703 Unit과 원본 #530/719 및 Resource/Plan/Target/Excel·Milestone/Gantt/canonical/권한 교차 회귀는 약화하지 않는다.
- **검증/승인:** 이번 연결 도구 환경에서 로컬 Node/Playwright 실행 **NOT TESTED**; 새 exact-head Full PR CI의 Quality/E2E6/Docker 및 Trusted QA/Owner는 시작 시 NOT TESTED. 변경은 E2E Fixture/소비자/Unit+이슈 전용 원장/Work Packet 한정. `DESIGN.md`/`docs/REMOTE_VALIDATION.md`/TEST_PLAN/AGENTS/CI/제품/API/DB는 계약 불변 N/A. risk HIGH/OWNER_MANAGED, v0.116.1, release_required=true/release_authorized=false, 병합/Main/GHCR/Finalizer/tag/Issue 종료 미실행. 다음 실패는 같은 원장 F-007에 append.
