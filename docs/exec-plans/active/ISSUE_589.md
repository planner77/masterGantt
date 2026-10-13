# Issue #589 — UI/UX Skill 기반 Design Delta 조건부 문서 동기화

## 목표 / 변경 범위

UI/UX Skill(실제 사용한 경우)의 제안 중 프로젝트가 **실제로 채택한** 신규 전역 설계 원칙만 DESIGN.md에 승격하고 기존 원칙의 상세화·국소 변경을 전역 문서에 중복 누적하지 않는다. 기존 Source of Truth와 security/domain/API/revision/canonical snapshot/SVAR Core 우선순위, agent read-only, QA/CI/release gate를 보존한다.

- 기준 Issue: https://github.com/planner77/masterGantt/issues/589
- 최초 실행 기준 main: `36b0eaa74a0614a76d1ed867bddb548149feb4bc`
- 브랜치: `docs/issue-589-ui-ux-design-delta`
- 최초 문서 변경 commit: `fed382184bdf6553d1e036e23ef0b1df90b7b289`
- 제품 버전: `0.104.0` 유지 (`version_decision=keep`)
- `release_required=false`, `release_authorized=false`: 제품 산출물 변경 없이 정책 설명 문서만 수정한다.
- 이번 승인 범위: 구현·DOCUMENTATION_SYNC·PR·PR CI 시작까지. 병합, main CI, GHCR, release/tag, branch cleanup, Issue close는 제외.
- 실행 방식: 단일 에이전트 순차 수행. 별도 Sub-Agent/독립 QA 실제 실행을 주장하지 않는다.
- 외부 UI/UX Skill 새 설치·실행이나 기존 화면 재디자인은 **비범위**.

## 위험 / QA 판정

- `risk_level: LOW`, `qa_required: false`, `qa_method: AGENT`
- LOW 근거: 실제 PR diff는 디자인 원칙 및 작업 계획 Markdown만 변경한다. 보호 정책/Agent 실행 문서 변경을 main과 동일하게 복원하여 운영 Gate 수정이 없다. 기존 AGENTS/Agent Prompt/Lifecycle는 DESIGN 참조와 DOCUMENTATION_SYNC를 이미 요구한다.
- `qa_review_mode: N/A`, `independent_qa: N/A(LOW, 보호 정책·기능 계약 변경 없음)`, `manager_decision: NOT TESTED`, `MERGE_READY: BLOCKED`(새 Head required CI/Manager ACCEPT 전).
- 보호된 정책 파일 변경을 우회 승인하지 않으며 이번 PR은 해당 파일을 변경하지 않는다. Required Quality/E2E/Docker와 자동 QA는 새 Head에서 실증한다. docs-only shard SKIPPED를 실제 테스트 PASS로 주장하지 않는다.

## Design Delta / 문서 소유권

| 판정 | 확인 시나리오 | 처리 |
| --- | --- | --- |
| A | 실제 채택된 여러 화면의 새 navigation/상태 표시 원칙 | `DESIGN.md` 기존 관련 절 갱신 및 PR에 이유·영향 범위 |
| B | 특정 Dialog의 Escape/focus 세칙, 기존 방향의 상세화 | `docs/UI_UX_GUIDELINES.md` 또는 해당 화면 계약; `DESIGN.md: N/A` |
| C | 기존 compact control에 맞춘 toolbar gap/padding 수정 | 해당 PR·component/test에서 처리; `DESIGN.md: N/A` |
| D | Skill 권고와 보안/domain/SVAR Core 또는 기존 DESIGN 충돌 | 별도 Manager 의사결정/필요 승인 전 원칙 변경 보류 |

`ui_ux`는 read-only 설계 비교·근거를 전달하고, `frontend`는 승인된 기능 UI/test를 구현하며, Manager/지정 문서 작성자가 원칙 채택과 DESIGN 갱신을 결정한다. 이번 이슈는 화면 구현을 하지 않는다.

## DOCUMENTATION_SYNC

- `DESIGN.md`: UPDATED
- `AGENTS.md`: N/A(기존 §2가 DESIGN.md와 UI 가이드를 Source of Truth로 직접 참조하므로 중복 수정 불필요)
- `docs/AGENT_PROMPTS.md`: N/A(기존 Manager Orchestration Prompt가 DESIGN 참조와 DOCUMENTATION_SYNC 및 PR 동기화를 요구)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 §9.4가 required_docs 갱신 또는 N/A 근거와 PR 추적을 요구)
- `docs/exec-plans/active/ISSUE_589.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: N/A(상세 interaction/accessibility 규정 불변이며 DESIGN에서 기존 하위 Source of Truth 연결)
- `docs/PROJECT_UX.md`: N/A(프로젝트 화면 동작이나 배치 계약 변경 없음)
- `docs/TASK_EDITOR.md`: N/A(Task Editor UX·Keyboard/Escape 동작 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(위험 분류·QA 필수 경계 불변; 보호 정책 파일 변경으로 HIGH 판정만 적용)
- `docs/CI_CD.md`: N/A(Workflow·Ruleset·Required checks·릴리스 동작 불변)
- `docs/TEST_PLAN.md`: N/A(제품 기능/동작·자동 테스트 계약 변경 없음)
- `docs/API.md`: N/A(API 경로·payload·auth·revision 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB·migration 변경 없음)
- `docs/SECURITY.md`: N/A(보안 보호 정책 변경 없고 기존 우선순위 보존)
- `package.json` / `package-lock.json` / `CHANGELOG.md`: N/A(제품 빌드·동작·버전 불변)

## AC_TEST_COVERAGE

- AC1: DESIGN.md §8의 A/B/C/D 네 유형 정의와 본 문서의 유형별 판정표를 대조해 문서 정적 검토.
- AC2: DESIGN.md §8에서 A의 실제 채택·기존 부재·복수 화면 적용 조건 및 동일 PR 갱신 규칙 확인.
- AC3: DESIGN.md §8 B/C의 DESIGN N/A 및 AGENTS.md의 불필요한 수정 금지 안내 확인.
- AC4: 기존 우선순위·충돌 보류, 하위 가이드/화면 계약 책임 분리·links 정적 확인.
- AC5: 변경 없는 AGENTS.md §2, docs/AGENT_PROMPTS.md Manager/ui_ux 프롬프트, ISSUE_LIFECYCLE.md DOCUMENTATION_SYNC의 기존 참조·역할·Gate 일치 확인.
- AC6: 네 예시 (새 탐색/상태=A, 툴바 간격=C, Dialog Escape=B, 보안·SVAR 위반=D)를 DESIGN.md §8과 대조.
- AC7: GitHub compare 변경 파일 목록이 Markdown만 포함하며 package manifest/version/DB/API/CI workflow 변경이 없음을 확인; PR CI 결과는 실제 Actions로 판단.

## 검증 증거 / 다음 단계

- 정적 확인: GitHub compare diff Markdown-only, 문서의 A~D/예시/역할/보호 계약 문구 검토; 최신 PR Head 확인 후 최종 판정.
- 로컬 browser/E2E: NOT TESTED / N/A(화면·기능 변경 없음). 원격 E2E/Docker aggregate도 실행/skip 여부를 실제 PR CI에서 확인.
- 독립 QA Final: N/A(LOW 문서-only, 보호된 정책 파일 수정 없음). 새 Head 자동 QA·세 Required CI·Manager ACCEPT는 별도 증거 필요.
- 이번 종료점: PR 생성과 PR CI 시작 증거 수집. CI 완료·QA_FINAL·Manager ACCEPT·MERGE_READY는 별도 단계.

## 2026-10-10 — PR CI #2383.1 실패 원인과 리뷰 P2 보완

- [PR #596 CI #2383.1](https://github.com/planner77/masterGantt/actions/runs/38038815437): 같은 Head `ab7fe4377d069b7a2020a8bbae6cb1ded1497e84`의 Quality/E2E/Docker **aggregate PASS**. Markdown-only 경로로 Typecheck/Playwright shard/Docker 구현은 **SKIPPED**이며 실행 PASS와 구분한다.
- `QA Final — Automated`는 `AGENTS.md`, `docs/AGENT_PROMPTS.md`, `docs/ISSUE_LIFECYCLE.md` 보호 정책 변경 감지로 **BLOCKED** 및 Job FAIL(exit 1). 설계된 fail-closed이며 임의 예외·경로 변경·검증기 완화로 우회하지 않는다. HIGH/`qa_required=true`의 별도 인간/`qa_docs` 독립 QA와 정확한 Head Manager ACCEPT 없이는 MERGE_READY=BLOCKED.
- [Codex review P2](https://github.com/planner77/masterGantt/pull/596#discussion_r4237073891): A가 없는 Skill-informed 변경의 `DESIGN.md: N/A(사유)`를 “PR 또는 최종 보고” 중 하나에만 남길 수 있는 모호함 확인. `DESIGN.md` §8을 **구현 PR 기록 필수, 최종 보고는 선택적 반복**으로 정정한다. `AGENTS.md`, Manager Prompt, Lifecycle DOCUMENTATION_SYNC의 기존 PR 필수 원칙과 일치시키며 Gate를 완화하지 않는다.
- 이번 수정의 정적 검증: 전후 문장·A/B/C/D 적용 예시·필수 PR 기록 일치, docs-only diff·제품 버전 불변 및 링크 정합성 확인. 문서 검토 결과는 새 Head의 원격 검증/독립 QA 완료 주장이 아니다.
- 다음 단계: 동일 브랜치 새 commit으로 [PR #596](https://github.com/planner77/masterGantt/pull/596) 최신 Head 생성 → 새로운 PR CI **시작 확인**. 보호된 정책 파일이 diff에 남아 있으므로 `QA Final — Automated`는 계속 의도된 BLOCKED일 수 있다. Required aggregate 결과, 독립 QA, 병합 승인과 구분한다.

## 2026-10-10 — CI #2384.1 실패 후 구조 정합화

- [CI #2384.1](https://github.com/planner77/masterGantt/actions/runs/38039637672): 세 required aggregate PASS (docs-only 구현 shard SKIPPED), 자동 QA만 보호 파일 `AGENTS.md`/`docs/AGENT_PROMPTS.md`/`docs/ISSUE_LIFECYCLE.md`로 BLOCKED/FAIL. 동일 변경으로 반복 실행해도 해결되지 않는다.
- **범위 최소화:** 위 보호 파일 3종을 정확한 main blob으로 복원한다. 기존 AGENTS.md §2는 DESIGN.md를 명시적으로 참조하고, 기존 Agent Prompt/Issue Lifecycle은 required docs 및 DOCUMENTATION_SYNC를 요구하므로 실행 계약의 중복 선언을 별도 보호 문서에 삽입하지 않아도 사용자가 요청한 Design Delta §8은 자동으로 읽힌다.
- `DESIGN.md`의 A/B/C/D 조건부 갱신과 Codex P2 수정(해당 PR에 N/A 사유 필수)은 유지. 기존 PR 리뷰 스레드 [P2](https://github.com/planner77/masterGantt/pull/596#discussion_r4237073891) 답변 및 해결 완료.
- **새 범위의 위험 재평가:** LOW / `qa_required=false` / `QA_FINAL=N/A(문서-only·보호 변경 제거)`. CI/QA 검증기의 보호 목록·required checks·역할·승인 정책은 변경하지 않는다. 만약 현재 diff에 보호 변경이 남거나 자동 Gate가 다른 문제를 보고하면 다시 판정한다.
- 문서 동기화 변경: `AGENTS.md`, `docs/AGENT_PROMPTS.md`, `docs/ISSUE_LIFECYCLE.md` = `N/A(기존 링크·역할·gate 활용)`; `DESIGN.md`, Work Packet, PLAN = UPDATED.

## 2026-10-10 — 최신 main 정렬

- 다른 이슈(#595 등)의 main 변경이 누적돼 최초 PR base SHA `36b0eaa74a0614a76d1ed867bddb548149feb4bc`와 병합이 충돌했다. 최신 main `26e72bbed046a6ad6721e1c3c19bda71ce42e570`을 새 branch parent로 사용하고 `DESIGN.md`, Issue Work Packet, `PLAN.md` 세 문서만 재적용한다.
- main `DESIGN.md`는 최초 baseline과 동일 blob `ae017e4831e1515fb775e3785ea8f258064d1a67`였으므로 PR 변경안을 그대로 사용한다. `PLAN.md`는 기존 main 내용을 보존하고 이번 Issue 섹션만 추가한다. `AGENTS.md`·Agent Prompt·Issue Lifecycle 등 보호 파일은 최신 main 값을 유지한다.
- 새 Head는 기존 CI/QA 증거가 stale이므로 required CI 및 자동 QA를 새로 확인해야 한다. 제품/CI/QA 정책 변경 없음.
