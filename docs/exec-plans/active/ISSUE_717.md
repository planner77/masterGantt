# Issue #717 — 이름 우선·코드/ID 보조 표시 원칙 및 화면 개선

## ISSUE WORK PACKET / 문서 정책 등록 단계

- 최신 PR: [#718](https://github.com/planner77/masterGantt/pull/718). 실패 Full CI [#2923.1](https://github.com/planner77/masterGantt/actions/runs/39080414283)의 동일 Issue 누적 원장은 [docs/ISSUE_717_FAILURE_ANALYSIS.md](../../ISSUE_717_FAILURE_ANALYSIS.md). 원본 FAIL은 고정해 보존하고 새 Head 성공으로 소급 수정하지 않는다.

- Issue: [#717](https://github.com/planner77/masterGantt/issues/717)
- 기준 main: `6fea0397bc07d0c3adf2d769f9ba6829473503a2` (2026-10-18 브랜치 생성 시점); 구현/병합 전 최신 main과 충돌을 재검증한다.
- Branch: `docs/issue-717-name-first-identifier-policy`. 이번 변경은 **DESIGN.md와 문서 계획만**; UI 코드 구현은 후속 단계다.
- Phase: PR_CI_FAIL → REWORK(DOCUMENTATION_SYNC + PR metadata) → 문서 PR 재검증. 제품 UI 구현, 브라우저 검증, QA, Main/GHCR, 이슈 종료는 **미착수**.
- Risk (이번 docs-only 변경): `LOW`, `qa_required=false`, `qa_method=OWNER_MANAGED`. protected CI·보안·QA 스크립트/워크플로/DB/API/SVAR 변경 없음. 추후 UI 구현 PR의 위험도/QA는 새 기준으로 다시 판단한다.
- Version: application `0.115.0` 유지; `release_required=false`, `release_authorized=false` (이번 문서 변경). 제품 변경 이후 버전·릴리스는 별도 Owner 판정.
- 역할: Manager=정책/원칙 채택 및 문서 작성, ui_ux=read-only 비교·검토, frontend=후속 UI 구현·테스트, qa_docs=QA 근거 검토, infra=승인 후 GitHub CI/병합/릴리스. 실제 별도 Agent/브라우저/CI 검증을 수행했다고 주장하지 않는다.
- 이번 승인 종료점: 새 Issue와 문서 커밋, PR 제안까지만. PR Merge/Main CI/GHCR/Issue Close는 승인 범위 밖.

## CURRENT STATE / 관련 계약

1. `src/features/milestones/project-milestone-stage-table.tsx`의 Milestone 이름 아래 외부 ID, 원인 행에 외부 ID+작업 ID 반복 노출.
2. `src/features/logistics/project-logistics-management.tsx`의 공정 표가 `공정 코드`를 `공정명` 앞 열에 배치하고 다른 연결 보기에서 `이름(코드)`/ `이름(ID)`를 사용.
3. `docs/PROJECT_UX.md` #409의 Relation Editor ID 검색/표시, #285의 공정 신규 코드 자동 생성·수정 코드 편집; #519의 Membership picker 비노출을 유지·범위별로 정합화.
4. #715의 불필요한 설명 문구 축소는 별도 UI 작업이다. 식별자 주·보조 정보 계층은 본 #717에서 담당.

## DESIGN DELTA / SCOPE

- 판정: **A — 전역 새로 채택한 시각적 정보 계층**. 기존 Workspace-first, Data-dense, Progressive disclosure를 여러 엔터티 화면의 primary name/secondary identifier 구조로 **명시적으로 구체화**한다. 화면별 긴 코드 제거·숨김/정확 대상 확인 예외까지 공통으로 적용.
- `DESIGN.md` §1.3에 이름 우선·요청 시 ID 접근·동명이인 구분·식별자 데이터 불변·접근성/가독성 규칙을 추가. §8 UI Issue Workflow에 변경 시 §1.3 검토 연결.
- 이번 PR 포함: `DESIGN.md`, `docs/exec-plans/active/ISSUE_717.md`, `docs/exec-plans/active/PLAN.md`, `docs/ISSUE_717_FAILURE_ANALYSIS.md`.
- 제외: Milestone Dashboard/물류 공정 UI 코드·테스트, catalog/DB/API/DTO/schema/export 변경, SVAR Core 수정, 배포/릴리스/이슈 종료.
- UX 공통 원칙이 적용된 **실제 구현**은 후속 PR에서 화면별 계약, 코드/ID 검색·Copy ID·canonical selection, 동일 이름, 긴 코드, 390/768/1024/1440/wide desktop, keyboard/focus/touch 및 browser evidence로 확인한다.

## DOCUMENTATION_SYNC

정확히 다음 Markdown 항목 단위로 문서 영향·이번 변경 파일 여부를 분리한다. 이번 변경은 사용자 화면이 아닌 **docs-only 정책 원칙**이며 #717의 제품 수용 기준 전부가 완료됐음을 뜻하지 않는다.

- `DESIGN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_717.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/ISSUE_717_FAILURE_ANALYSIS.md`: UPDATED
- `AGENTS.md`: N/A(기존 DESIGN 참조 및 UI Source of Truth 계약 유지)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 단계별 검증과 승인 게이트 유지)
- `docs/AGENT_PROMPTS.md`: N/A(에이전트 역할 및 문서 동기화 절차 불변)
- `docs/UI_UX_GUIDELINES.md`: N/A(제품 화면 interaction 변경 없음, 후속 UI 구현에서 세칙 적용)
- `docs/PROJECT_UX.md`: N/A(현재 Milestone 및 공정 화면 표시 동작 변경 없음)
- `docs/TASK_EDITOR.md`: N/A(현재 Editor/Picker 화면 동작 변경 없음)
- `docs/TEST_PLAN.md`: N/A(제품 UI 테스트 코드 변경 없음, 후속 구현에서 보완)
- `CHANGELOG.md`: N/A(기능 및 배포 버전 변화 없는 docs-only 기록)
- `docs/API.md`: N/A(HTTP API 및 외부 DTO 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB 스키마 및 마이그레이션 변경 없음)
- `docs/SECURITY.md`: N/A(인증, 권한 및 세션 정책 변경 없음)
- `package.json`: N/A(제품 버전 0.115.0 변경 없음)

## AC_TEST_COVERAGE

아래 AC별 계획은 Issue 수용 기준과 테스트 책임을 **추적하기 위한 매핑**이다. 문서-only 단계에서 제품 기능이 검증됐다는 의미가 아니다.

- AC1: Milestone 표·원인/공정 관리 노출 위치를 소스 기반으로 확인; 전 화면 전체 인벤토리 미완료, 후속 frontend 감사 필요.
- AC2: Milestone 대시보드 이름 우선/ID on-demand 실제 구현 및 단위·브라우저 검증 필요. NOT TESTED.
- AC3: 공정 관리 공정명 우선/긴 코드 보조 표시·코드 자동생성 보존의 실제 구현과 브라우저 검증 필요. NOT TESTED.
- AC4: 물류/리소스/Target/기준정보 화면별 예외·원문 접근 흐름을 전수 조사하고 구현 후 검증 필요. NOT TESTED.
- AC5: 이름·코드·외부 ID·UUID 검색, Copy ID, 동일 이름/누락 이름의 canonical 정확 선택·수정·삭제를 제품 회귀로 검증 필요. NOT TESTED.
- AC6: 390/768/1024/1440/wide desktop 및 keyboard/focus/스크린리더/touch, 긴 ID truncated copy 원문·내부 표 scroll 검증 필요. NOT TESTED.
- AC7: 실제 후속 UI 코드·테스트·문서 동기화와 API/DB/JSON/Excel/revision 무변경 여부 검증 필요. 이번 문서 PR에서는 변경 diff만 정적 확인.
- AC8: AGENTS.md와 DESIGN.md/하위 문서·Issue Lifecycle 준수는 문서 정적 점검; 원격 PR required/Trusted QA/Owner ACCEPT는 새 Run 전 NOT TESTED.

## CI #2923.1 (2026-10-18 KST) 누적 REWORK 진단

- 확인된 관련 PR: #718 하나. 기존 최초 Full Run `39080414283.1`, Head `23e09aada982087047d90037704cdbb8b750bf97`, Base `6fea0397bc07d0c3adf2d769f9ba6829473503a2`, test merge `fc3aada1cc42043ede90e4af6c7d0c46320218ad`.
- 원인: PR 본문 필수 full-line `risk_level` / `qa_method` / `qa_required` 누락과 Work Packet 정규 heading·기계 판독 가능한 doc impact·AC 1~8 행 누락. 즉 `POLICY_CI / METADATA_DOCUMENTATION` 실패이며 실제 E2E6/Docker/앱 코드 테스트는 실행되지 않았다.
- 대응: QA parser나 required check/검증 난이도를 완화하지 않고, PR 본문 단일 선언과 본 Packet의 exact heading/line-by-line 영향/AC mapping을 정규화한다. 신규 Run 이전에는 로컬/원격 PASS 주장 금지.
- 새로운 동기화 이벤트의 Full PR CI는 새 Head+Base/Test-Merge 및 동일 Source of Truth로 재평가해야 한다. QA/Owner/병합·Main/GHCR/Issue close 금지.

## 다음 단계

1. 문서 PR은 **일부 산출물만 제안**하므로 Merge/완료·release 승인으로 해석하지 않는다.
2. 제품 구현 착수 시 #717의 AC 전체·현재 main/중복 UI 이슈/화면 계약·릴리스·risk/qa를 다시 확정하고 화면별 개선·테스트·문서 동기화를 진행한다.
3. 최신 PR Head의 required CI/Trusted QA/Review thread/Manager ACCEPT 및 충돌 해결을 확인한 이후에만 병합을 판단한다.
