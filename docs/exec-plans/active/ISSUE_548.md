# Issue #548 — Milestone marker-last 표시 분리 정책·실행계획 문서 Work Packet

## Issue / 요청 범위 / 기준
- Primary Issue: [#548](https://github.com/planner77/masterGantt/issues/548); related #552/#553/#573/#574/#667, optional marker [#693](https://github.com/planner77/masterGantt/issues/693).
- 문서 base: main `c1dbf61be427934569593796dd7892d0e4ddc2bf` (2026-10-15 조회); 문서 branch: `docs/issue-548-milestone-marker-last`. 실제 PR/병합 전 main 및 head SHA·test-merge를 새로 확인.
- 결정: Milestone Stage Gate, Membership·Task Roll-up을 그대로 두고 native Grid/Chart Milestone 행 제거를 #552에서 먼저 수행한다. **상단 Timeline marker는 OFF**인 baseline을 독립 수용하고 필요하면 #693에서만 선택 ON. #667은 최신 main-first 공통 정합성 안정화.
- User scope: AGENTS/DESIGN/관련 지침·Issue·문서 갱신 및 구현 순서 등록. **이번 PR은 문서만**, 제품 source, DB, API, package, CI/workflow, PR #561 head/branch, Main CI, 정식 GHCR, Issue close는 범위 밖.
- risk_level: HIGH (Milestone 표시 계약·후속 구현 순서 변경); qa_method: OWNER_MANAGED; qa_required: true; release_required: false; release_authorized: false. OWNER 최종 수용과 각 PR의 QA·병합 권한은 별도.

## Source of Truth / 확인과 분리
필독: [AGENTS](../../../AGENTS.md), [DESIGN](../../../DESIGN.md), [Stage Gates](../../MILESTONE_STAGE_GATES.md), [Milestone Timeline](../../MILESTONE_TIMELINE.md), [Gantt State Consistency](../../GANTT_STATE_CONSISTENCY.md), [Gantt State Conformance](../../GANTT_STATE_CONFORMANCE.md), [Gantt Sync ADR](../../GANTT_ADAPTER_ADR.md), [Project UX](../../PROJECT_UX.md), [Test Plan](../../TEST_PLAN.md), [활성 Gantt 실행계획](GANTT_STATE_REMEDIATION.md), [Milestone Presentation Policy](../../MILESTONE_PRESENTATION_POLICY.md).
공식 Willow/SVAR markers(PRO-only)/filter-tasks URL 조회는 실제 설치 Core 2.7.3 조작·통합 PASS가 아니다. main의 #551 lane 기본 OFF와 #552 미병합 PR의 marker ON 결합은 구분한다.

## PLAN / 담당 / 의존
1. #667 **main-first** U1~U4 실제 제품 Reconciler/semantic observation/axis transaction 통합·GSC SC 누적 검증. 별도 main PR 허용은 일반 기능 안정화이고 #552 중복 기능 PR이 아님. #674/PR #675 동일 파일 협업·충돌 정리.
2. #552 / 기존 PR #561: 최신 main(#667 포함)으로 정렬한 뒤 **행/Bar만 제거, marker OFF 기본**. Timeline 기본 ON·일시 날짜 reveal ON·coupled 토글 제거. Dashboard/Task 연결/검색/Legacy Milestone-only 안내, full canonical hidden subtree/Link/Stage Roll-up 유지. 명시 `legacy` 복귀를 해당 PR 내 한정 실험으로 시험.
3. #553 / 기존 PR #562: #552 새 base/head 정렬 후 marker OFF의 JSON/Excel/SVG/PNG·Copy·Template·hidden 관계 무손실/가이드. PR #563 테스트 변경도 원래 #552 경계를 유지하며 정렬·QA 필요. #553은 #552 제품 테스트 전부의 대체가 아님.
4. #574: GSC SC-01~14 중 marker OFF 관련·Resource/Target·Actual HTTP/SQLite·5폭/DayWeek/filter0/Task0/M-only·export 통합, exact Head Quality/E2E6/Docker·Trusted/Owner gate로 baseline 수용. #573은 baseline 완료의 blocker가 아님.
5. [선택] #573 marker ON 실측 좁은 화면·Focus·날짜 tick TECH gate → #693 별도 운영 OFF 기본·guarded opt-in/flag OFF·독립 PR/Revert drill. Owner 선택 승인 없으면 계속 DEFER.

단일 파일 작성자: #667 main-first 제품 연결 → #552 PR #561 표시 통합 → #553 교환 → #574 QA → (별도) #573/#693 마커 검증/활성화. `project-gantt.tsx`/`project-readonly-view.tsx`/`viewport-coordinator.ts`/`svar-viewport-port.ts` 겹침 방지. 기존 #551·#674 도구·실험 기록 삭제 금지, DB/태그를 되돌리지 않는다.

## AC_TEST_COVERAGE
- AC1: `docs/MILESTONE_PRESENTATION_POLICY.md`에서 Stage/Membership과 WBS mode/marker flag의 독립 모델, OFF baseline, legacy rollback, optional ON을 명확히 한다.
- AC2: #552와 #667 구현 대상을 분리한다. #552 marker OFF에서도 native row/bar0·Milestone Dashboard/Task 소속/Ready/Resource·Target/원본 관계 보존, 날짜 reveal의 명시 대체 UX를 갖춘다.
- AC3: #553/#574의 marker OFF 통합·무손실·정합 수용을 #573/#693 선행 없이 실행 가능하게 정의한다. #574는 full CI/QA/Owner를 별도 요구한다.
- AC4: #693은 별도 flag OFF 초기화/마커 전용 side-effect0, #573 실제 geometry·5폭·DayWeek·wheel·Focus 게이트와 독립 revert 가능하도록 분리한다. OFF flag가 runtime 즉시 무중단인지는 검증 전 주장 금지.
- AC5: #548/#552/#553/#573/#574/#667 본문과 #693 별도 활성화 Issue가 최신 dependency·비범위·책임·rollback을 모순 없이 보유한다.
- AC6: AGENTS/DESIGN/MILESTONE_TIMELINE/REQUIREMENTS/PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN/active PLAN/GANTT_STATE_CONFORMANCE/Stage Gates의 명시 적용 우선순위·N/A·원본 보존을 점검한다. 실제 구현·CI·병합은 NOT TESTED로 표기한다.

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
  - 근거: Milestone 표시 변경 전 필수 marker-OFF 기준 정책 참조.
- `DESIGN.md`: UPDATED
  - 근거: WBS 우선 UI와 선택 marker 시각 규칙, 과거 #549 표시 계획의 조건부 변경.
- `docs/MILESTONE_PRESENTATION_POLICY.md`: UPDATED
  - 근거: 신규 추가 — presentation 단일 정책 원본, 두 축/단계·롤백/AC.
- `docs/MILESTONE_TIMELINE.md`: UPDATED
  - 근거: 이전 ON 목표는 역사적 구현안이며 새 marker-OFF 기준선 우선임을 명시.
- `docs/PROJECT_UX.md`: UPDATED
  - 근거: Dashboard/Task 탐색 대체·OFF/legacy/focus 경계.
- `docs/REQUIREMENTS.md`: UPDATED
  - 근거: 단계별 계약·선행 및 비범위 명시.
- `docs/UI_UX_GUIDELINES.md`: UPDATED
  - 근거: UI 공개 상태/mark OFF no-side-effect/반응형 검증.
- `docs/MILESTONE_STAGE_GATES.md`: UPDATED
  - 근거: 표시와 Stage Gate/전체 Task 범위의 분리 강조.
- `docs/GANTT_STATE_CONFORMANCE.md`: UPDATED
  - 근거: SC baseline marker OFF와 선택 ON 검증 경계.
- `docs/exec-plans/active/GANTT_STATE_REMEDIATION.md`: UPDATED
  - 근거: #667 main-first 전환/후속 #552/#553/#574/#573/#693 순서.
- `docs/exec-plans/active/PLAN.md`: UPDATED
  - 근거: 현재 진행 단위와 승계 의존성.
- `docs/TEST_PLAN.md`: UPDATED
  - 근거: marker-OFF MP-01~12와 선택 ON 및 원본 회귀.
- `docs/exec-plans/active/ISSUE_548.md`: UPDATED
  - 근거: 신규 추가 — 본 Work Packet·원장/AC/검증 경계.
- `docs/ARCHITECTURE.md`: UPDATED
  - 근거: #667 main-first / #552 marker-OFF / #693 선택적 marker의 생산 코드 쓰기 소유권과 경계.
- `docs/GANTT_ADAPTER_ADR.md`: N/A(공식 SVAR 2.7.3/PRO 제약 및 이전 adapter DEFER가 그대로 적용됨)
- `docs/GANTT_STATE_CONSISTENCY.md`: N/A(GSC-01~12 규범은 변경하지 않고 새 presentation 프로파일을 참조)
- `docs/API.md`: N/A(API/DTO 계약 미변경)
- `docs/DB_SCHEMA.md`: N/A(schema/migration/identity 미변경)
- `docs/SECURITY.md`: N/A(권한/Origin/Revision 계약 미변경)
- `docs/SCHEDULING_ENGINE.md`: N/A(Scheduling/Stage Gate 연산 미변경)
- `docs/CI_CD.md`: N/A(workflow/Ruleset/Required check 불변)
- `docs/REMOTE_VALIDATION.md`: N/A(현재 검사 기준 그대로 사용; 새 CI 작업 불요)
- `docs/QA_REVIEW_POLICY.md`: N/A(Owner-managed/Trusted QA Gate 불변)
- `docs/GENERIC_RELEASE_FINALIZER.md`: N/A(릴리스 권한/정식 GHCR 범위 불변)
- `CHANGELOG.md`: N/A(제품 기능 및 버전 변경이 없는 정책 문서 PR)
- `docs/exec-plans/active/TARGET_RESOURCE_ROLLOUT.md`: N/A(#623 수용/Resource MVP의 Stage·Assignment 분모 정책 유지)
- `docs/GITHUB_OPERATIONS.md`: N/A(문서 범위 변경만 수행하며 GitHub API·PR·Issue 운영과 안전 병합·release workflow 계약을 변경하지 않음)
## QA / 실증 / 미완료
- Docs-only 결정이며 새로운 marker-OFF 제품 동작은 **NOT IMPLEMENTED / NOT TESTED**. PR #561의 과거 실패·#551 일부 실제 probe·#663~#666 모듈 PASS는 서로 대체하지 않는다.
- Markdown 상대 링크/헤딩/중복·업데이트된 모든 Issue body↔경로↔순서, 단일 소유권/비순환 DAG를 검증한다. Local doc self-check는 전체 GitHub Actions Required Quality/E2E6/Docker/Trusted QA·독립 QA_FINAL·Owner 승인 대신이 아니다.
- PR이 열리면 exact base/Head, 세 Required checks와 QA/리뷰 스레드 0, 변경된 법적/보안/라이브러리 영향이 없음을 다시 확인. merge/Main/GHCR는 이 문서·이슈 요청으로 진행하지 않는다.


## 2026-10-15 PR CI #2801.1 QA Preflight 보완 원장

- 원본: [PR CI #2801.1](https://github.com/planner77/masterGantt/actions/runs/38717280348), Head `d87eb6d79714e118692b292e3d143b6c10cbc8d8`, base `c1dbf61be427934569593796dd7892d0e4ddc2bf`; QA Preflight [Job 116363048295](https://github.com/planner77/masterGantt/actions/runs/38717280348/job/116363048295) **FAIL / ISSUE_AC** (`Issue #548 Acceptance Criteria — Primary Issue 본문에 AC1.. 식별자 없음`).
- 원본 실행은 Docs/QA Preflight 조기 차단이며 TypeScript·Unit·E2E·Docker 실제 구현 Job **SKIPPED**. Required aggregate 및 QA Final의 FAIL은 후속 게이트; 제품 기능/마커 OFF E2E 실패라고 분류하지 않는다.
- #548 Issue 원문과 변경 이전 이력은 유지한 채 `AC1`~`AC6`를 명시하고 이 Packet의 정확한 AC_TEST_COVERAGE와 연결했다. DOCUMENTATION_SYNC는 기존 설명형 표기를 base `qa_final_automated.py::docs_gate()`가 요구하는 `- \`path\`: UPDATED / N/A(reason)` 고정 형식으로 정규화했다. QA 요구 계약에 필요한 `docs/GITHUB_OPERATIONS.md`: N/A(reason)를 추가해 의미 영향도 보존했다.
- QA 검증기/워크플로/Required check·버전·제품/DB/API 코드는 변경하지 않는다. 실제 새 PR CI/Trusted QA 결과와 Owner 최종 수용은 새 exact Head의 증거가 나올 때까지 **NOT TESTED**다. 원본 실행은 실패로 보존한다.
