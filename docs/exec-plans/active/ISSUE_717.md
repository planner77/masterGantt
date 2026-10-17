# Issue #717 — 이름 우선·코드/ID 보조 표시 원칙 및 화면 개선

## ISSUE WORK PACKET / 문서 정책 등록 단계

- Issue: [#717](https://github.com/planner77/masterGantt/issues/717)
- 기준 main: `6fea0397bc07d0c3adf2d769f9ba6829473503a2` (2026-10-18 브랜치 생성 시점); 구현/병합 전 최신 main과 충돌을 재검증한다.
- Branch: `docs/issue-717-name-first-identifier-policy`. 이번 변경은 **DESIGN.md와 문서 계획만**; UI 코드 구현은 후속 단계다.
- Phase: INTAKE/PLAN → 디자인 원칙 문서 반영 → 문서 PR 제안. 제품 UI 구현, 브라우저 검증, QA, Main/GHCR, 이슈 종료는 **미착수**.
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
- 이번 PR 포함: `DESIGN.md`, `docs/exec-plans/active/ISSUE_717.md`, `docs/exec-plans/active/PLAN.md`.
- 제외: Milestone Dashboard/물류 공정 UI 코드·테스트, catalog/DB/API/DTO/schema/export 변경, SVAR Core 수정, 배포/릴리스/이슈 종료.
- UX 공통 원칙이 적용된 **실제 구현**은 후속 PR에서 화면별 계약, 코드/ID 검색·Copy ID·canonical selection, 동일 이름, 긴 코드, 390/768/1024/1440/wide desktop, keyboard/focus/touch 및 browser evidence로 확인한다.

## DOCUMENTATION_SYNC (이번 문서 단계)

| 파일 | 판정과 근거 |
| --- | --- |
| `DESIGN.md` | **UPDATED** — 새 이름 우선/코드·ID 보조 상위 원칙과 UI Issue Workflow 체크 |
| `docs/exec-plans/active/ISSUE_717.md` | **UPDATED** — 이번 문서 범위·AC/미구현/검증 상태 기록 |
| `docs/exec-plans/active/PLAN.md` | **UPDATED** — #717 문서 등록과 구현 분리 기록 |
| `AGENTS.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/AGENT_PROMPTS.md` | N/A — 기존 UI/UX Source of Truth·문서 동기화·Issue Lifecycle 게이트로 충분; 보호 문서 중복 변경 회피 |
| `docs/UI_UX_GUIDELINES.md` | N/A — 이번 PR에서 상세 interaction 변경 없음; 후속 구현에 필요하면 ID full-text 접근성·긴 코드 truncation 세칙 갱신 |
| `docs/PROJECT_UX.md`, `docs/TASK_EDITOR.md`, `docs/TEST_PLAN.md`, `CHANGELOG.md` | N/A (이번 문서 PR); 후속 실제 화면/테스트 변경 시 계약을 동기화 |
| `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/SECURITY.md`, `package.json` | N/A — API/DB/보안/제품 동작 및 버전 변경 없음 |

## AC_TEST_COVERAGE / 분리 검증

- #717 AC1: 알려진 2개 화면의 **소스 기반** 노출 지점과 기존 #519/#715/PROJECT_UX 계약 인벤토리 기록; 전 화면의 완전 인벤토리는 **미완료** (후속 구현 시작 전).
- AC2~AC7: 실제 화면 구현과 browser/E2E 결과가 필요하여 **NOT TESTED**, 이번 docs-only PR이 완료 기준을 충족한 것으로 간주하지 않는다.
- AC8 / 문서 단계: `DESIGN.md` §1.3·§8, AGENTS의 UI/UX Source of Truth, #589 A/B/C/D 구분, #717 Issue/PR의 동일 Primary Issue 연결을 정적 확인. 실제 GitHub CI·독립 QA·Owner review는 **NOT TESTED**.
- GitHub diff에 Markdown 파일만 포함되는지 확인하고 기존 도메인/버전/CI 프로세스가 불변인지 검토한다. 로컬 앱 build/E2E는 화면 코드 변경이 없어 N/A; 원격 aggregate가 skip인지 PASS인지 실제 Actions 실행 후에만 판정한다.

## 다음 단계

1. 문서 PR은 **일부 산출물만 제안**하므로 Merge/완료·release 승인으로 해석하지 않는다.
2. 제품 구현 착수 시 #717의 AC 전체·현재 main/중복 UI 이슈/화면 계약·릴리스·risk/qa를 다시 확정하고 화면별 개선·테스트·문서 동기화를 진행한다.
3. 최신 PR Head의 required CI/Trusted QA/Review thread/Manager ACCEPT 및 충돌 해결을 확인한 이후에만 병합을 판단한다.
