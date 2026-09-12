# AGENTS.md

## 1. Project Overview

이 Repository는 **SVAR React Gantt 기반의 소규모 Project Gantt Management System**을 개발하기 위한 프로젝트이다.

주요 목적은 다음과 같다.

* Project별 Gantt Chart 작성 및 관리
* Project별 일정 데이터 저장 및 조회
* Project별 Edit Password 기반 편집 권한 제어
* Project Direct Link 제공
* 기존 Excel 일정의 안전한 Import
* Excel 형식 Export
* SVAR React Gantt Core를 활용한 UI 구현
* SVAR PRO 성격의 필요한 기능을 독립 Scheduling Engine으로 구현
* SQLite 기반 단순한 운영
* Docker 기반 배포

본 프로젝트는 Codex Multi-Agent 기반으로 개발한다.
Main Codex Thread가 Manager 역할을 수행하며, 전문 Sub-Agent에게 필요한 작업을 위임한다.

## 2. Source of Truth

상세 요구사항/설계는 `docs/**`를 따른다. 작업 전에 특히 `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/SCHEDULING_ENGINE.md`, `docs/SECURITY.md`, `docs/TEST_PLAN.md`, `docs/REMOTE_VALIDATION.md`, `docs/CI_CD.md`, `docs/GITHUB_OPERATIONS.md`, `docs/exec-plans/active/PLAN.md`를 확인한다.

## 3. Core Architecture and Security

Project direct access 기본 상태는 Readonly이며 Password/Session/Secret을 URL에 넣지 않는다. Client UI 상태를 authorization 근거로 사용하지 않고 보호 Mutation은 server-side session/Origin/revision 계약을 따른다. Password 원문은 DB/Log에 저장하지 않는다.

Database는 SQLite + better-sqlite3를 우선하고 Prisma를 사용하지 않는다. `Route Handler → Service → Repository → SQLite` 경계를 유지한다. DB 변경은 migration + `docs/DB_SCHEMA.md`, API 변경은 code + `docs/API.md`를 함께 갱신한다.

Scheduling Engine은 가능한 한 SVAR와 독립된 pure domain logic으로 작성한다. Algorithm 변경에는 Unit Test를 작성한다. SVAR PRO 비공개 구현을 복제하지 않는다. UI는 SVAR React Gantt Core의 공식 기능/API를 우선하고 불명확한 기능은 공식 문서/저장소를 확인한다.

Excel DRM을 해제하거나 우회하지 않는다. Excel/VBA는 승인된 기능만 사용하고 Import contract는 `docs/IMPORT_SCHEMA.md`를 따른다.

## 4. GitHub-first Development and Validation

코드 변경의 공식 전체 회귀 검증은 개발자 로컬 환경보다 **GitHub Actions를 우선**한다. 상세 정책은 `docs/REMOTE_VALIDATION.md`가 Source of Truth다.

기본 흐름:

```text
Issue / approved scope
→ branch/worktree
→ Local Fast Feedback
→ push
→ Pull Request
→ GitHub Actions: quality + e2e + docker
→ QA / Manager review
→ merge to main
→ GitHub Actions 재검증
→ GHCR immutable ci-<full SHA>
→ exact digest pull smoke
```

### Local Fast Feedback

구현 Agent는 작업 중 변경과 직접 관련된 Unit/Integration test, typecheck/lint 등 필요한 최소 검증을 수행한다. 매 코드 변경마다 전체 Vitest, 전체 Playwright, clean Docker build/runtime smoke, GHCR 검증을 로컬 완료 조건으로 반복하지 않는다. 해당 영역 자체를 수정하거나 CI 실패를 재현할 때 필요한 범위로 확대할 수 있다.

Local PASS는 공식 전체 회귀 PASS가 아니며 GitHub Actions PASS를 대체하지 않는다.

### Pull Request Required Validation

코드 변경은 원격 branch와 PR을 통해 검증하는 것을 기본으로 한다. `.github/workflows/ci.yml`의 version check, typecheck, lint, 전체 Vitest, dependency audit, markdown link, production build, Chromium Playwright E2E, Docker build/runtime/SQLite persistence smoke가 기본 공식 회귀 증거다.

PR은 read-only이며 registry write를 수행하지 않는다. 검토 대상 head SHA에서 `quality`, `e2e`, `docker`가 성공하기 전 Manager는 코드 변경을 최종 ACCEPT하지 않는다. Run이 미실행/진행 중이면 NOT TESTED, 실행 불가면 BLOCKED로 기록한다.

### Main Artifact Validation

`main` push에서는 동일 gate를 다시 통과한 뒤에만 immutable `ci-<full SHA>` image를 GHCR에 게시한다. 게시한 image는 exact digest로 다시 pull하여 policy, readiness, native SQLite, Project/Task API authorization/persistence, restart persistence를 검증하고 SBOM/provenance를 생성한다.

로컬 Docker PASS나 PR PASS만으로 main GHCR artifact PASS를 주장하지 않는다.

### Environment-specific Validation

GitHub-hosted runner로 대체할 수 없는 Windows Excel/VBA/DRM, 실제 reverse proxy/TLS, off-host backup/restore, production storage, 최종 수동 UX는 별도 환경 검증으로 유지한다. GitHub Actions PASS와 환경별 PASS는 서로 대체하지 않는다.

## 5. Multi-Agent Model and Responsibilities

```text
Main / Manager → GPT-6 Astra / High
researcher     → GPT-5.6 Terra / Medium
frontend       → GPT-5.6 Terra / Medium
backend        → GPT-5.6 Sol / High
scheduler      → GPT-6 Astra / High
excel_vba      → GPT-5.6 Sol / Medium
infra          → GPT-6 Astra / High
qa_docs        → GPT-5.6 Sol / High
```

실제 model/effort 지원 여부는 실행 환경에서 확인하며 설정값을 실제 실행 검증으로 과대 표시하지 않는다.

### Manager

요구사항 분석, Architecture/Decision, Agent 분배, 충돌 조정, 결과 Review, Integration과 최종 ACCEPT/REWORK/REJECT/DEFER를 담당한다. 구현 Agent의 자체 PASS를 자동 승인하지 않는다.

코드 변경은 가능한 한 Issue → branch/worktree → PR 흐름으로 진행한다. 검토 대상 PR head SHA와 GitHub Actions `quality/e2e/docker` 결과를 확인하고 원격 gate가 미완료인 상태에서 코드 변경을 최종 완료/ACCEPT로 보고하지 않는다. main artifact 완료를 주장할 때는 필요한 GHCR exact digest validation까지 확인한다.

### researcher

공식 문서, SVAR/Next.js/SQLite/Docker/Excel 제약, library/version/license, scheduling algorithm을 조사한다. Architecture를 임의 결정하거나 구현 코드를 수정하지 않는 것을 기본으로 한다.

### frontend

Next.js/React/SVAR UI를 담당한다. 변경 관련 Local Fast Feedback을 수행하고 필요한 Playwright test/fixture를 갱신한 뒤 PR 원격 검증으로 전달한다. 전체 회귀는 GitHub Actions 결과로 판정한다.

### backend

SQLite, migration, repository/service/API, auth/session, import/export와 server validation을 담당한다. 변경 관련 Unit/Integration Local Fast Feedback과 테스트를 갱신하여 PR 원격 검증으로 전달한다. 전체 회귀와 main container artifact 결과를 로컬 결과와 구분한다.

### scheduler

Calendar, Duration, Summary, Dependency, Auto Scheduling, WBS/Critical Path 등 domain을 담당한다. Algorithm 변경에는 Unit Test를 반드시 작성하고 Local Fast Feedback 후 PR 원격 회귀 검증으로 전달한다.

### excel_vba

Excel → JSON/CSV 변환과 VBA integration을 담당한다. 자동화 가능한 schema/fixture는 repository test로 만들어 GitHub Actions에서 검증하고 실제 Excel/VBA/DRM은 Environment-specific Validation으로 별도 판정한다.

### infra

GitHub repository 운영, GitHub Actions CI/CD, GHCR, Docker/Compose, SQLite persistence와 deployment를 담당한다. PR `quality/e2e/docker` 실행과 실패 분석, main immutable GHCR publish/exact digest smoke를 주 담당한다. 원격 run/job/step/head SHA를 증거로 사용하며 gate를 약화해 통과시키지 않는다. 상세 절차는 `docs/GITHUB_OPERATIONS.md`와 `docs/REMOTE_VALIDATION.md`를 따른다.

### qa_docs

독립 Reviewer다. Requirement/code/test/docs를 비교하고 Local Fast Feedback과 Remote GitHub Actions를 분리한다. 코드 변경의 공식 회귀 판정은 실제 PR `quality/e2e/docker` 결과를 우선하며 main artifact는 GHCR digest evidence를 별도 확인한다. 결과는 PASS/FAIL/BLOCKED/NOT TESTED로 구분한다.

## 6. Collaboration Rules

여러 Write Agent가 동일 파일을 동시에 수정하지 않는다. 공용 Interface는 Manager가 조정한다.

- DB 변경: migration + `docs/DB_SCHEMA.md`
- API 변경: code + `docs/API.md`
- Scheduling 변경: code + tests + `docs/SCHEDULING_ENGINE.md`
- Import contract: `docs/IMPORT_SCHEMA.md`
- VBA 변경: VBA + `docs/VBA_EXPORT.md`
- Docker 변경: Docker files + `docs/DEPLOYMENT.md`
- CI/GitHub/GHCR 변경: `.github/**`/scripts + `docs/CI_CD.md` + `docs/REMOTE_VALIDATION.md` + 필요한 `docs/TEST_PLAN.md`

Secret, `.env`, PAT, Password, Token, 실제 SQLite DB와 runtime log는 Git에 저장하지 않는다.

## 7. GitHub Workflow

구현 가능한 업무는 가능한 한 GitHub Issue 단위로 관리한다. Issue에는 Goal, Background, Scope, Acceptance Criteria, Assigned Agent, Related Documents를 포함한다.

PR에는 Summary, Related Issue, Changes, Verification, UI 변경 시 Screenshot, Documentation Updated, Remaining Risks를 포함한다. Verification에는 Local Fast Feedback과 GitHub Actions 결과를 분리한다.

Application version은 `package.json`을 Source of Truth로 하고 lockfile과 일치시킨다. Release는 `docs/CI_CD.md`의 Semantic Version/tag/GHCR 정책을 따른다.

PR과 수동 CI에는 write token/registry secret을 주지 않는다. `main` commit/release publish job만 최소 job-scoped 권한을 사용한다. 외부 Action은 full commit SHA, base image는 digest pin을 유지한다.

## 8. Verification Status Rules

- PASS: 해당 환경에서 실제 실행 증거가 있음
- FAIL: 실행 결과가 계약과 다름
- BLOCKED: 환경/권한/외부 의존성 때문에 실행 불가
- NOT TESTED: 계획은 있으나 아직 실행하지 않음

문서 존재, Agent 완료 보고, 로컬 PASS는 원격 CI PASS가 아니다. GitHub Actions가 아직 끝나지 않았으면 PASS로 과대 표시하지 않는다. 실패 retry로 최초 오류를 숨기지 않는다.

## 9. Definition of Done

코드 변경의 기본 완료 조건:

- Requirement 충족
- 관련 코드와 테스트 작성
- 필요한 Local Fast Feedback 수행 또는 미실행 사유 기록
- 원격 branch/PR 생성
- 검토 대상 head SHA의 GitHub Actions quality PASS
- GitHub Actions e2e PASS
- GitHub Actions docker PASS
- Security/Error Handling 충족
- 관련 Documentation 갱신
- QA Review
- Manager Review

`main` artifact까지 완료 범위에 포함되는 작업은 추가로 main CI gate PASS, immutable `ci-<full SHA>` publish, exact GHCR digest runtime smoke PASS, SBOM/provenance 확인을 요구한다.

GitHub-hosted runner로 검증할 수 없는 항목은 해당 환경의 PASS/BLOCKED/NOT TESTED 상태를 별도로 기록한다.

## 10. Final Report

Manager는 다음을 구분하여 보고한다.

```text
Completed
Issue / PR / Head SHA
Local Fast Feedback
GitHub Quality
GitHub E2E
GitHub Docker Smoke
Main GHCR Digest Smoke
Environment-specific Validation
Documentation Updated
Decisions
Remaining
Risks
Recommended Next Work
```

원격 검증이 완료되지 않았으면 Completed로 과대 표시하지 않는다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
