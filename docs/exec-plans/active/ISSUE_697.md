# Issue #697 — 변경 영향 분석 기반 검증 Work Packet

- 기준: 2026-10-16 / [Issue #697](https://github.com/planner77/masterGantt/issues/697), 착수 main ee6365bf57ab637b4c0aca61fdedaf5148253052.
- 작업: docs/issue-697-impact-based-test-validation / 역할: Manager 문서 단일 작성자, 구현 Agent 적용, qa_docs·Reviewer read-only 검토 대상.
- risk_level: HIGH (AGENTS.md 및 docs/ISSUE_LIFECYCLE.md는 기본 브랜치의 보호 CI/QA 정책 경로이며, qa_final_automated.py/risk_floor의 최소 위험도가 HIGH. 제품/CI Workflow는 불변). qa_method: OWNER_MANAGED. qa_required: true. independent_qa: N/A(Owner-managed, 독립 검토 없음). manager_decision: NOT TESTED. release_required: false. release_authorized: false.
- Scope: [AGENTS](../../../AGENTS.md), [TEST_PLAN](../../TEST_PLAN.md#issue-697--변경-영향-기반-로컬-검증과-교차-회귀-선정-2026-10-16), [ISSUE_LIFECYCLE](../../ISSUE_LIFECYCLE.md#922-변경-영향과-테스트-증거-기록-697)의 위험도·선정·증거 정합성 및 #667 시범 적용. 제품 코드·CI workflow·version/DB/API/릴리스 수정은 비범위.

## DOCUMENTATION_SYNC

기준: PR #698의 실제 변경 파일과 원본 main QA 검증기 `docs_required(paths)`(HEAD `a5fd082648b2d9b77308e9d5bb021705ff6594f0`), 문서 영향 실체·N/A 근거를 함께 기록한다. 보호 정책 파일 포함으로 위험도는 **HIGH**이며 문서만 변경해도 보호 QA·Owner/Required gate를 임의 완화하지 않는다. 본 문서는 변경 파일 자체와 검증 대상으로 구분한다.

- `AGENTS.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `docs/exec-plans/active/ISSUE_697.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(현행 OWNER_MANAGED와 AGENT 구분은 그대로 두고 AGENTS/LIFECYCLE의 오래된 설명만 정합화함)
- `docs/CI_CD.md`: N/A(Required Quality/E2E/Docker 집계 및 PR 6-shard fail-fast 실행 정책 자체 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(브랜치·PR/운영 명령·승인 또는 신뢰된 Reviewer 절차의 동작 정책 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(로컬 선택 검증과 원격 exact-head CI 분리는 이미 정립되어 추가 계약 변경 없음)

### 변경 문서·비대상 영향 상세

| 문서 | 판정과 이유 |
| --- | --- |
| AGENTS.md | UPDATE — PLAN/REWORK/공통 계약 변경과 Manager·구현 Agent·Reviewer의 영향 분석 책임 |
| docs/TEST_PLAN.md | UPDATE — LOW/MEDIUM/HIGH, 선택·교차·음성 검증, 분류·진단 확대·종료 기준 단일 원본 |
| docs/ISSUE_LIFECYCLE.md | UPDATE — 영향/테스트 증거 표준 필드 및 현재 OWNER_MANAGED QA 표현 정합 |
| docs/exec-plans/active/ISSUE_697.md | UPDATE — 실제 경로가 있는 #667 시범표, 사례별 증거 수준 및 이번 문서 작업 인계 |
| docs/REMOTE_VALIDATION.md | N/A — 로컬·원격 공식 검사 구분/문서-only 및 정확 Head 검사 규칙이 기존에 명시됨 |
| docs/CI_CD.md, .github/workflows/ci.yml | N/A — #659 fail-fast/6 shard, Quality/E2E/Docker Required, 경로 판정과 release/main 정책 불변 |
| DESIGN.md, docs/ARCHITECTURE.md, API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY, UI/UX·배포 문서 | N/A — 사용자 화면·제품/API/DB·설치 동작 변경 없음 |
| CHANGELOG.md, active PLAN.md, package/lock/version | N/A — 프로세스 문서의 현행 절차 안내이며 앱 기능/버전/로드맵 변경 없음 |

## #667 실제 사례 — 수정 범위와 간접 영향 그래프

원본 참조: [Issue #667](https://github.com/planner77/masterGantt/issues/667), [PR #695](https://github.com/planner77/masterGantt/pull/695), [#667 Work Packet (2026-10-16 Head 852056e)](https://github.com/planner77/masterGantt/blob/852056e71526968baf70c599eb09e1c37331e1e1/docs/exec-plans/active/ISSUE_667.md), [실패 종합 분석](https://github.com/planner77/masterGantt/blob/852056e71526968baf70c599eb09e1c37331e1e1/docs/ISSUE_667_FAILURE_ANALYSIS.md). #697 문서의 사례 source는 #667 Head 852056e71526968baf70c599eb09e1c37331e1e1이며, 각 실패의 실제 source·attempt는 아래 별도로 제시한다. 후속 Head로 자동 최신화되거나 #667의 제품 수용 PASS가 되지 않는다.

| producer → 영향받는 소비자/음성 경로 | 선정할 기존·추가 test 파일 (tests/ 기준; #695에서만 추가된 파일은 표시) | 분류, 근거·미검증 |
| --- | --- | --- |
| U2 actual-Core canonical/recovery → Task add/edit/delete/move, revision 401/412/422/500, UNKNOWN/GET 실패 후 추가 저장 0 | features/gantt/canonical-recovery.test.ts, canonical-recovery-runtime.test.ts; e2e/gantt-state-recovery-editor.spec.ts (#695), project-task-delete-context.spec.ts, project-task-editor-persistence.spec.ts | #2812 Delete가 비활성화돼 E2E FAIL. 실제 HTTP/SQLite 모든 음성 조합은 NOT TESTED |
| U2 Task ID/계층/Link/저장 결과 → Copy/Paste·관계 보존과 rollback | domain/membership-copy-plan.test.ts; e2e/project-links-persistence.spec.ts, project-multi-task-copy-paste.spec.ts, task-link-load-safety.spec.ts | 저장 성공과 viewport/Link 정합은 독립 assertion. 모든 Link 조합 PASS 아님 |
| U3 semantic receipt → peer 복귀·Editor UNKNOWN/cross-tab, stale/최신 visible observation | features/gantt/projection-observation.test.ts, state-consistency-harness.test.ts; e2e/milestone-dashboard-state.spec.ts, gantt-state-product-integration.spec.ts (#695), gantt-state-recovery-editor.spec.ts (#695) | #2811 PEER_RETURN 완료 receipt 부재는 실제 실패. receipt 교정 후 직접·cross-tab 병행 선정 |
| U3 projection → Resource 왕복·검색 결과 0/필터 해제·Grid reveal·focus | e2e/resource-drill-ui.spec.ts, resource-drill-dashboard.spec.ts, project-search-filter.spec.ts, canonical-projection.spec.ts (#695), grid-task-start-reveal.spec.ts | #2813 DEV getter null은 관측 코드 문제로 분류. 실제 UI reveal 제품 FAIL이라고 단정 금지 |
| U4 axis transaction → 첫/과거 Milestone·Day/Week·Calendar 휴일·3회 확장 | features/gantt/axis-transaction.test.ts; e2e/milestone-stage-editor.spec.ts, milestone-stage-grid.spec.ts, project-work-calendar-preview.spec.ts | #2812 실제 Core left/right bound 역전 제품 문제; 테스트의 weekday-only 공휴일 가정은 별도 fixture 분류 |
| U4 viewport → 새 wheel, 검색/Fullscreen, Grid/Chart 정렬·390px/capacity | features/gantt/viewport-coordinator.test.ts; e2e/viewport-coordinator.spec.ts, project-gantt-fullscreen.spec.ts, projection-row-alignment.spec.ts | #666 390px NOT_MEASURABLE / full-capacity clamp FAIL 유지. 이 문서 작업은 관련 제품 재검증 미수행 |
| #384 다중 Copy/Paste 성공 → 화면 수평 46→0 부수효과 | e2e/project-multi-task-copy-paste.spec.ts; features/gantt/copy-viewport-continuity.test.ts (#695) | #667 확대 실행에서 발견한 별도 제품 회귀. 46→0 좌표·저장 성공·새 사용자 입력 우선권 검증 대상 |
| UI 후 저장 확인 GET·HTTP/SQLite → Milestone Editor/Resource·Calendar 및 transport | e2e/project-task-persistence.spec.ts, milestone-stage-exchange.spec.ts, resource-drill-api.spec.ts, project-resource-calendar-persistence.spec.ts | #2814 ECONNRESET 원인 UNKNOWN. 실제 commit과 단순 GET transport 분리; OOM/서버종료/flake로 추측 확정 금지 |

이 표는 **수동 영향 매핑과 테스트 선정 예시**다. 해당 파일이 최종 Head에 존재하는지, scenario/assertion이 계약에 부합하는지 실제 착수 때 재검토한다. 특정 테스트의 실행·PASS를 증명하는 표가 아니다. Unit/mock·actual Chromium·actual HTTP/SQLite·remote Quality/E2E/Docker 각각 별도 열로 실제 결과를 수집해야 한다.

## #2811~#2814 원본 실패·SHA·분류 (과거 원장 보존)

| 과거 CI / source | 최초 실패·결과 | 뒤따르는 선택/교차 검증 |
| --- | --- | --- |
| [#2811.1](https://github.com/planner77/masterGantt/actions/runs/38742141930), Head 04b6d3d90d06b742223038c31c84823d525feb21 / attempt 1 | milestone-dashboard-state.spec.ts:145, visible Peer 복귀 receipt 없어 E2E FAIL. shard 21 PASS/1 FAIL/1 SKIP/104 NOT RUN, 다른 5 shard CANCELLED | U3 fresh receipt, Task/Resource peer·Editor cross-tab UNKNOWN/GET 상태 |
| [#2812.1](https://github.com/planner77/masterGantt/actions/runs/38793354820), Head 2f8f0573852a69fd85d733d0e57e61e282997372 / attempt 1 | project-task-delete-context.spec.ts:155 다음 Delete disabled, E2E FAIL. Milestone 초기 과거 날짜 Core 역전도 발견 | U2 Delete/UNKNOWN와 U4 첫 Milestone/Day·Week·Calendar, 기존 fixture의 비교/공휴일 오류를 구분 |
| [#2813.1](https://github.com/planner77/masterGantt/actions/runs/38798814906), Head a141ba3e4daf5ec6bbf8a99a3350edcb6c0c35be / attempt 1 | grid-task-start-reveal.spec.ts:30→85, DEV getter null getFullYear, E2E FAIL. 실제 reveal 동작까지 실행되지 않음 | 실제 렌더된 날짜축 origin과 DEV 관측을 분리한 뒤 기존 Grid reveal UI assertion을 유지 |
| #2814.1, 원본 #667 Work Packet 참조 | UI 뒤 확인 GET에서 ECONNRESET, 원인 **미확정**, E2E FAIL | 요청 경계/browser GET·APIContext·worker/readiness/OOM/trace 관측; 반복 재시도로 덮지 않음 |
| #384 Copy/Paste / #667 진단 확대 | 성공한 다중 Copy/Paste 뒤 X 46→0 제품 회귀; 46개 E2E 파일→49개 영향 파일로 한정 확대 | 저장 성공과 원래 X/lease·새 wheel의 우선권을 구분; 최초 및 보완 후 같은 source 테스트 결과만 별도 기록 |

모든 이전 CI의 FAIL, 취소·미실행은 해당 run/attempt에 귀속한다. 서로 다른 Head를 합산해 PASS라고 판단하지 않는다. #667은 실제 CI #2811~#2814 이후에도 후속 수정/CI가 있으므로 이 시범표가 최신 완료·원인 판정이 아니다.

## PR #698 — CI #2821.1 원인 분석·REWORK (2026-10-16)

원본 [PR CI #2821 / run 38836682399, attempt 1](https://github.com/planner77/masterGantt/actions/runs/38836682399) / Head `a5fd082648b2d9b77308e9d5bb021705ff6594f0`, base `ee6365bf57ab637b4c0aca61fdedaf5148253052`는 **FAIL**이며 과거 결과를 지우거나 PASS로 갱신하지 않는다.

- QA Final 신뢰 경계 [job 116767275432](https://github.com/planner77/masterGantt/actions/runs/38836682399/job/116767275432): `AGENTS.md` 변경은 보호 경로인데 PR `risk_level=MEDIUM`이므로 `보호된 CI/QA/정책 파일 변경은 HIGH 위험도 필수`로 차단. 문서상 일반 프로세스 변경 MEDIUM 제안보다 기본 브랜치 신뢰 정책의 HIGH floor 우선. 이번 Work Packet과 PR body를 HIGH로 정정하고 이력을 분리한다. `qa_method=OWNER_MANAGED`, `qa_required=true`, 원격 검증·Owner 승인 필수 유지.
- QA Preflight [job 116767349326](https://github.com/planner77/masterGantt/actions/runs/38836682399/job/116767349326): `## DOCUMENTATION_SYNC 영향 원장`은 검증기가 요구하는 정확한 `## DOCUMENTATION_SYNC`가 아니고, Markdown 표는 `- \`path\`: UPDATED|N/A(reason)` 포맷으로 파싱되지 않으며 `## AC_TEST_COVERAGE`에서 AC1~AC7의 `- ACn:` 구조도 누락. 원본 FAIL 1개는 최초 heading에서 중단한 상태였으므로 **후속 실패 가능성까지 구조적으로 보완**.
- PR Fast Gate [job 116767400923](https://github.com/planner77/masterGantt/actions/runs/38836682399/job/116767400923): Preflight failure·필수 policy skipped 후속 FAIL. 세 Required aggregate FAIL 및 E2E/Docker·TypeScript·Vitest 실제 실행은 skipped/NOT TESTED. 제품 Unit/E2E 실패로 분류하지 않음.
- P2 리뷰: [PR #698](https://github.com/planner77/masterGantt/pull/698) TEST_PLAN의 Playwright 명령에 이전에 이동한 `tests/config/playwright.config.ts`의 `--config`가 없었다. 실행 전에 실패하는 재현 가능한 문서 명령 오류이며 해당 옵션을 추가해 리뷰 후 확인.
- 조치 범위: `docs/TEST_PLAN.md` 명령, 이 Work Packet의 risk/구조/원본 CI 이력, PR risk metadata 정정. `AGENTS.md`·`docs/ISSUE_LIFECYCLE.md`에서 작성한 기준 자체는 유지, workflow·CI 검증기를 수정하지 않음.

## 위험도 3예시와 확대 종료

- LOW 설명 문구/링크 변경: Markdown/link와 실제 변경 범위를 검사, UI/DB E2E는 N/A(동작 불변) — 매 수정 전체 로컬 E2E는 과잉.
- MEDIUM 단일 Editor 버튼: handler Unit+해당 UI Chromium+keyboard/focus/Escape·readonly·저장 인접 회귀 — snapshot만으로는 과소.
- HIGH async canonical/U2·U3·U4: state·recovery Unit, 실제 소비자·HTTP/SQLite 음성, Copy/Paste·Milestone·Resource·검색/Fullscreen·390px 범위의 수행·제외를 명시 — Unit PASS만으로는 과소.

연쇄적인 서로 다른 실패 2회 이상, 공유 Core/서버 복구 변경 또는 선택 PASS 뒤 교차 회귀가 발견되면 Manager는 관련 파일 한정 **로컬, fail-fast 없는 1회 진단**을 결정한다. 실제 파일 수/케이스 수/예상 비용을 기록하고 최초 실패·새 실패를 원인별 수집한 뒤 동일 최종 source 재검증 또는 미해결 위험 인계로 종료한다. 공식 PR 6-shard fail-fast, timeout·retry·skip/Required gate는 불변이다.

## AC_TEST_COVERAGE

- AC1: 기존 Local Fast Feedback, exact-head Quality/E2E/Docker Required, 6-shard fail-fast, QA/Owner 및 RELEASE 경계 불변을 변경 파일 diff와 본문으로 확인. 이 문서만으로 원격 PASS 판정 불가.
- AC2: TEST_PLAN의 LOW/MEDIUM/HIGH와 shared state·HTTP/SQLite·async/간접 소비자 기준, 로컬 선정·제외·N/A(reason), 전체 로컬 E2E 비의무 표의 완전성 점검.
- AC3: AGENTS에서 PLAN/REWORK·공유 계약 변경 때 Manager·구현 Agent의 영향 표와 테스트 선정/제외 의무, qa_docs read-only 검토 및 현행 QA 경계 분리.
- AC4: 시범 Work Packet에 producer/영향 소비자→실제 테스트 파일→실행 환경/원본 source SHA→FAIL/NOT TESTED·미검증을 구분; Unit/mock/actual browser/HTTP·SQLite/원격 증거를 혼동하지 않음.
- AC5: #667 PR #695 CI #2811~#2814 peer/UNKNOWN/Delete/Milestone axis/DEV getter/ECONNRESET과 #384 다중 Copy/Paste 46→0의 근거·선정 파일·원인 확정 수준을 매핑.
- AC6: 다른 사례 연쇄 실패 두 차례 및 shared Core/복구 변경 시 한정 로컬 fail-fast 없는 확대 진단/원인별 종료와 LOW 문구·MEDIUM Editor·HIGH async 3예시를 대조하고 검사 완화 없음.
- AC7: 문서 4개 동기화, 실제 저장소 Markdown 링크·형식·CI Preflight 계약 확인, 미해결 리뷰·충돌 정리 후 정확 새 Head PR CI 시작. 원격 결과/QA_FINAL/Owner/merge는 별도 확인 전 NOT TESTED.

## 이번 문서 PR 검증/인계 계약

| 검증 | 상태 및 판정 |
| --- | --- |
| 정적 문서·내부/상대 링크·문구 정합·변경 파일 목록 | 실행 결과를 PR/Issue에 기록, 최종 Head에서 재확인 |
| 로컬 제품 Unit/Chromium/HTTP·SQLite | N/A(reason): 제품/서버/Workflow 변경 없는 문서 전용 PR. #667 선택 PASS로 대체하지 않음 |
| 원격 exact Head Quality/E2E/Docker | PR CI 시작 전 NOT TESTED, 실행 후 Run ID/attempt/Head 및 docs-only 경로 판정으로만 판정 |
| 독립 QA | N/A(Owner-managed, 독립 인간 검토를 수행했다고 주장하지 않음) |
| Owner ACCEPT / merge / main CI / GHCR/Finalizer | NOT TESTED 또는 N/A: 이번 지시는 PR CI 시작까지, 모니터링·병합·정식 게시 없음 |

**AC 매핑:** AC1 기존 gate 보존과 QA 정합, AC2 위험 결정표/제외, AC3 AGENTS 역할과 책임, AC4 Work Packet source·실행/미검증 연결, AC5 #667 Peer/UNKNOWN/Milestone/DEV/ECONNRESET·Copy/Paste 실례, AC6 확대 조건/종료·3예시, AC7 문서 동기화·정적 링크와 실제 신규 PR CI 시작. CI 완료나 제품 인수는 확인 전 PASS가 아니다.
