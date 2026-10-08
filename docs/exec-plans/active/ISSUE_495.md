# Issue #495 — Milestone 사용자 표기 정합화 실행 계획

## 목적과 기준

- Issue: https://github.com/planner77/masterGantt/issues/495
- 범위: 사용자 UI의 `완료 단계`/`마일스톤` 및 Milestone을 뜻하는 단독 `단계` → `Milestone`; Editor/Grid/Dashboard/검색/접근성/오류/리소스·물류/Template/Import/Copy/Export/문서 포함.
- 기준 main `dca2f7821f277ef31ee3dbcbdc1e51ad257209f0` (2026-10-08), app `0.102.1`; branch `fix/issue-495-milestone-terminology`, PATCH 후보 `0.102.2`.
- 기준: `AGENTS.md`, `DESIGN.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/UI_UX_GUIDELINES.md`, `docs/PROJECT_UX.md`, `docs/TASK_EDITOR.md`, `docs/MILESTONE_STAGE_GATES.md`.

## 범위 및 호환성

1. 화면·도움말·오류·접근성 용어를 Milestone으로 정합화한다. 일반 완료 상태·이동 이력 최대 8단계·Calendar 충돌 단계는 Milestone 용어로 바꾸지 않는다.
2. Playwright E2E에서 label/role/dialog/Grid header와 drill 연결을 검증한다. 사용자가 입력한 Task/Milestone 이름은 자유 텍스트이므로 이름 값 자체의 강제 정규화는 하지 않는다.
3. `DESIGN.md`에 표기 원칙, `AGENTS.md`에 교차 참조, REQUIREMENTS/Editor/UX/API/DB/Scheduling/Test/Export/CHANGELOG·PLAN에 연동한다. 과거 Issue/PR/CI 증거는 소급 편집하지 않는다.
4. `stageGate`/DTO·API path·SQLite FK/migration·JSON schema/field와 Excel 고정 header/sheet, Membership/Dependency/Scheduling/Ready 계산은 보존한다. Excel 보고 제목은 새 용어로 하되 고정 헤더 변경은 별도 호환성 검토 대상이다.

## 검증 및 실행 단계

- [x] Issue·기존 문서·최신 기준 main·영향 문자열 검토 후 전용 branch 생성.
- [x] UI 문자열·접근성 및 기존 E2E selector 동기화.
- [x] DESIGN/AGENTS/도메인·UX·Test·Export 문서/버전/CHANGELOG 동기화.
- [ ] 로컬 npm/typecheck/Chromium: GitHub connector 접근과 격리된 checkout/runner가 없어 NOT TESTED.
- [ ] qa_docs 독립 리뷰: 별도 Sub-Agent 실행 경로가 없어 NOT TESTED. 자체 검토를 독립 PASS로 기록하지 않는다.
- [ ] 동일 PR head에 `quality/e2e/docker` CI run 등록 및 상태를 확인한다. 결과가 완료되기 전 PASS로 주장하지 않는다.

## 승인 및 출구

제품 표시 PATCH로 `release_required=true`, `release_authorized=false`. 요청 범위는 PR CI 시작까지다. 병합/Main CI/GHCR tag·정식 release/Issue 종료는 승인되지 않았으며 PR 본문에는 `Refs #495`만 사용한다.
