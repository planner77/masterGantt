## Issue #593 — Trusted QA 원본 이벤트 귀속 및 metadata 재검증 (2026-10-10)

- `workflow_run.pull_requests=[]`를 PR 실행명/제목에서 추측하지 않는다. 원본 `CI`의 PR 이벤트에서 **checkout 전에** 만든 `ci-pr-source-<run_id>-<attempt>` artifact를 기본 브랜치 검증기가 읽기 전용으로 조회한다. Artifact 자체는 PR 측 비신뢰 자료이며 스키마/repository/run ID·attempt/Head SHA·branch/base SHA/test merge SHA와 현재 PR 및 commit→PR GitHub API의 단일 귀속을 교차 확인한다. zip을 실행하거나 PR 코드를 checkout하지 않는다.
- artifact가 없거나 만료·중복되거나 commit→PR 조회가 비어 있거나 여러 PR에 귀속되거나, Head/base/merge/attempt가 바뀌면 **BLOCKED**한다. 이전 성공을 재사용할 때도 동일 **PR + Head + base + test merge + 최신 full run attempt**와 세 Required Aggregate의 완료 성공을 확인한다. 잘못된 canonical title/Refs는 자동 수정·우회하지 않는다.
- `CI` Workflow의 existing required `Build, static checks, and unit tests` / `Chromium end-to-end tests` / `Docker build and runtime smoke test`, full/metadata concurrency, 6-shard E2E, main/GHCR/Finalizer 및 write 권한·Ruleset은 유지한다. `QA Final — Trusted`는 기본 브랜치 SHA의 **운영상 수동 Gate**이며 PR Head Ruleset check가 아니다.
- `automated_qa=PASS`는 정확한 구조·provenance 검사 결과이지 독립 의미/업무 QA·Manager ACCEPT가 아니다. `manager_decision=NOT TESTED`인 동안 `MERGE_READY=BLOCKED`. `AGENT`/protected 변경에는 실제 별도 독립 Reviewer가 필요하며 HIGH는 Manager의 범위별 위험 수용이 필요하다.
- **실증 경계:** #593 자체가 검증기/CI 정책을 변경하므로 `HIGH/AGENT`; 이번 PR은 자기 Trusted PASS로 병합하지 않는다. 별도 독립 QA·Manager 결정 및 main 병합 이후 새로운 비보호 검증 PR을 통해 T1 정상 Trusted PASS/run URL·run_attempt·Head/base/merge·validator SHA 실증을 완료한다. 실증 전 T1/T2는 `NOT TESTED`. 이전 #580 Main CI/Finalizer 성공은 유지한다. #396 canonical 오류/빈 PR 귀속과 #591 원본 CI FAIL을 구별한다.
- 운영: [ISSUE_593 Work Packet](docs/exec-plans/active/ISSUE_593.md)과 [원격 검증](docs/REMOTE_VALIDATION.md) T1~T9를 참조. 원본 run 결론 FAIL은 `FAIL`, 불충분한 출처는 `BLOCKED`, 낡은 PR event는 `SUPERSEDED/N/A`; skipped를 필요한 검증의 PASS로 사용하지 않는다. 실패한 metadata-only는 유효한 full CI 이후 해당 job 재실행으로 복구하며, run/attempt/총 실행 수·runner 비용 비교는 실제 Actions에서 측정한다.

# AGENTS.md

## Issue #595 — 보호 파일을 포함한 AGENT QA 최종 판정

`qa_method=AGENT` + `package.json`/lockfile·CI/보안 정책 등 보호 경로가 있는 PR에서 기존 자동 QA의 경로 차단을 제거하거나 기본 PASS로 바꾸지 않는다. 보호된 main validator는 **PR 작성자와 다른 신뢰된 인간 Reviewer의 현재 Head에 대한 `QA_FINAL: PASS` 승인**, 세 필수 Quality/E2E/Docker aggregate 완료·성공, 해당 독립 리뷰보다 늦고 정확 Head/base·원본 CI를 명시한 repository owner의 Manager ACCEPT를 모두 검증할 때에만 리뷰 영수증을 인정한다. 한 조건이라도 빠지면 BLOCKED이며 자동 Codex 댓글·개발자 자체 검토는 독립 QA가 아니다. 상세 신뢰·영수증 규격은 [QA_REVIEW_POLICY](docs/QA_REVIEW_POLICY.md)와 [GITHUB_OPERATIONS](docs/GITHUB_OPERATIONS.md)를 따른다. 릴리스 권한 및 기존 Ruleset 세 필수 Check는 그대로 유지한다.


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

## 1.1 Attention-kind 응답·보고 원칙

Manager와 모든 Sub-Agent는 사람이 읽는 대화·진행 보고·최종 보고에 [Attention-kind](https://github.com/alexgreensh/attention-span)의 취지를 적용한다. 이는 작업량·분석 깊이·검증 수준을 줄이는 규칙이 아니라, 충분히 수행한 작업을 사람이 빠르게 이해하고 판단할 수 있게 전달하는 규칙이다.

- **결론 우선**: 첫 문장에 가장 중요한 결론·상태·판정을 둔다. 배경 설명으로 시작하지 않는다.
- **짧게 완전하게**: 필요한 사실을 빠뜨리지 않는 범위에서 가장 짧게 쓴다. 반복, 장황한 서론, 같은 결론의 재진술은 제거한다.
- **평이한 표현**: 기술 용어는 필요한 경우에만 사용하고, 독자가 즉시 이해해야 하는 비표준 용어는 짧게 설명한다.
- **정확한 수치와 범위 보존**: 숫자, 임계값, 날짜, SHA, Issue/PR 번호, 조건, 적용 범위(scope)는 축약하지 않는다. 제한된 조건을 전체 규칙처럼 확대해서 쓰지 않는다.
- **위험·경고 우선 보존**: 잘못된 결정으로 이어질 수 있는 위험, 전제조건, 실패 원인, BLOCKED 사유, 미검증 항목은 간결성을 이유로 생략하거나 뒤로 미루지 않는다.
- **증거 보존**: GitHub Actions run/job/step, head SHA, PASS/FAIL/BLOCKED/NOT TESTED, GHCR digest 등 현재 프로젝트의 검증 증거 계약은 그대로 유지한다. "짧게 쓰기"가 검증 증거를 줄이는 근거가 될 수 없다.
- **상세 요청 시 완전성 우선**: 사용자가 원인 분석, 전체 과정, 상세 설명, 설계 근거 등을 명시적으로 요구하면 기본 brevity를 중단하고 의사결정에 필요한 세부사항·조건·위험을 충분히 제공한다.
- **긴 작업 재앵커링**: 긴 작업에서는 중간 보고 시 현재 상태와 다음 핵심 조치를 1~2문장으로 다시 잡아준다. 사용자가 이미 준 정보를 다시 묻지 않는다.
- **한 번에 한 가지 질문**: 실제로 사용자 입력 없이는 진행할 수 없는 blocking question만 묻고, 가능한 작업은 먼저 수행한다.
- **코드와 문서에는 채팅 형식 강제 금지**: `→`, 굵은 글씨 같은 스캔용 형식은 대화·보고에 선택적으로 사용한다. 소스코드 주석과 제품 문서에는 기존 문서 스타일을 우선하고, 명백한 내용보다 이유·주의점을 간결하게 기록한다.

충돌 시 우선순위는 **보안·정확성·Source of Truth·Issue Lifecycle·CI/QA gate > Attention-kind 표현 규칙**이다. 즉, 표현은 간결하게 만들되 기존 프로젝트의 판단 기준과 완료 조건을 약화하지 않는다.


## 2. Source of Truth

상세 요구사항/설계는 `docs/**`를 따른다. 작업 전에 특히 `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/SCHEDULING_ENGINE.md`, `docs/SECURITY.md`, `docs/TEST_PLAN.md`, `docs/REMOTE_VALIDATION.md`, `docs/CI_CD.md`, `docs/GITHUB_OPERATIONS.md`, `docs/ISSUE_LIFECYCLE.md`, `DESIGN.md`, `docs/UI_UX_GUIDELINES.md`, `docs/exec-plans/active/PLAN.md`를 확인한다.

### UI/UX 작업 시 참조

화면 신설·수정·검토를 시작할 때 아래에서 해당하는 문서를 읽는다. 상세 원칙은 기존 문서를 Source of Truth로 유지하고 AGENTS.md에 중복 정의하지 않는다.

| 작업 상황 | 참조 문서와 목적 |
| --- | --- |
| 화면 배치, 정보 밀도, 색상·폰트·간격·공통 상태 변경 | [DESIGN.md](DESIGN.md): 제품 시각 언어, semantic token, Linear/Airtable/Carbon 참조 영역과 우선순위 |
| 메뉴·탭·모달·폼 interaction, 접근성, 반응형 설계 또는 검토 | [UI_UX_GUIDELINES.md](docs/UI_UX_GUIDELINES.md): 설계 산출물, keyboard/focus/Escape/복원, 상태별 동작, 390/768/1024/1440px 검증 |
| 기존 화면의 동작 변경 | 해당 화면별 UX 문서(예: [PROJECT_UX.md](docs/PROJECT_UX.md), [TASK_EDITOR.md](docs/TASK_EDITOR.md)): 기존 동작, 저장·초안·stale 처리, Gantt 인스턴스와 작업 상태 보존 계약 |
| Gantt/Grid/Task Editor/Context Menu 기능 설계 | [UI_UX_GUIDELINES.md의 SVAR 자료](docs/UI_UX_GUIDELINES.md#svar-데모와-api-확인): 유사 공식 demo/API와 설치 버전의 Core/PRO 범위 확인; URL 조회와 실제 조작 증거 구분 |
| 여러 UI/UX 이슈 또는 화면을 단계적으로 개선 | [현재 활성 계획](docs/exec-plans/active/PLAN.md)(현재 UI/UX 범위는 [UI/UX 실행 계획](docs/exec-plans/active/UI_UX_ROLLOUT.md)): 최신 Issue/PR 상태를 확인하고 선행 의존성·중복 범위·단계 순서 조정; 계획 완료·이관 시 참조도 갱신 |
| Milestone Timeline 표시·필터·탐색 분리 | [MILESTONE_TIMELINE.md](docs/MILESTONE_TIMELINE.md): current/target 호환, 전체 canonical/Gate 보존과 Core 기술 gate |
| 담당 배정, 문서 동기화, 위험도 기반 독립 QA, PR/main 완료 판정 | [ISSUE_LIFECYCLE.md](docs/ISSUE_LIFECYCLE.md), [QA_REVIEW_POLICY.md](docs/QA_REVIEW_POLICY.md), [REMOTE_VALIDATION.md](docs/REMOTE_VALIDATION.md): 위험 분류·QA 필수/N/A·역할·gate 및 로컬/원격/환경별 증거 구분 |

Milestone 등 사용자-facing 엔터티 표기의 Source of Truth는 [DESIGN.md](DESIGN.md)의 Product Terminology를 따른다. 상세 도메인·API 계약은 기존 관련 문서를 유지하고 AGENTS.md에 복제하지 않는다.

기본 방향은 기존 파란색 Light UI·system font와 공통 semantic token을 재사용하고 Gantt/Grid의 작업 면적을 우선하는 것이다. 외부 디자인 참조보다 security/domain/API/revision/canonical snapshot 계약을 우선한다. 화면 캡처만으로 keyboard·권한·상태 보존 검증을 대신하지 않는다.

## 3. Core Architecture and Security

Project direct access 기본 상태는 Readonly이며 Password/Session/Secret을 URL에 넣지 않는다. Client UI 상태를 authorization 근거로 사용하지 않고 보호 Mutation은 server-side session/Origin/revision 계약을 따른다. Password 원문은 DB/Log에 저장하지 않는다.

Database는 SQLite + better-sqlite3를 우선하고 Prisma를 사용하지 않는다. `Route Handler → Service → Repository → SQLite` 경계를 유지한다. DB 변경은 migration + `docs/DB_SCHEMA.md`, API 변경은 code + `docs/API.md`를 함께 갱신한다.

Scheduling Engine은 가능한 한 SVAR와 독립된 pure domain logic으로 작성한다. Algorithm 변경에는 Unit Test를 작성한다. SVAR PRO 비공개 구현을 복제하지 않는다. UI는 SVAR React Gantt Core의 공식 기능/API를 우선하고 불명확한 기능은 공식 문서/저장소를 확인한다.

Excel DRM을 해제하거나 우회하지 않는다. Excel/VBA는 승인된 기능만 사용하고 Import contract는 `docs/IMPORT_SCHEMA.md`를 따른다.

## 4. GitHub-first Development and Validation

코드 변경의 공식 전체 회귀 검증은 개발자 로컬 환경보다 **GitHub Actions를 우선**한다. 상세 정책은 `docs/REMOTE_VALIDATION.md`가 Source of Truth다.

### CI/CD 한글 작성 원칙

Manager와 모든 Sub-Agent는 CI/CD 관련 내용 중 사람이 읽는 제목·설명·보고를 **한글로 작성**한다. 상세 대상, 예외와 검토 절차는 `docs/GITHUB_OPERATIONS.md`의 한글 작성 정책을 따른다.

- Workflow의 `name`, `run-name`, job/step의 표시용 `name`, 수동 실행 입력의 `description`, 실행 요약과 직접 작성하는 안내·오류 설명은 한글을 기본으로 한다. CI 관련 Issue/PR/커밋/릴리스의 제목·본문과 검증 보고 제목·설명도 동일하게 적용한다. 필요한 제품명·기술 용어는 원문을 병기할 수 있다.
- `jobs.<job_id>`, step `id`, `needs`, expression, 명령·옵션·환경변수, 파일 경로, Action 참조, image/tag/digest, API 필드와 자동화가 소비하는 상태값·산출물 이름은 번역하지 않는다. Conventional Commits의 `ci:`/`docs:` 같은 접두어는 유지하고 설명을 한글로 쓴다.
- 기존 workflow/job 표시 이름도 required checks, ruleset, `workflow_run`, 상태 조회·외부 자동화에서 참조될 수 있으므로 일괄 치환하지 않는다. 참조와 권한을 먼저 확인하고 연동 변경 및 검증을 함께 수행한다. 확인·변경 권한이 없으면 기존 이름을 유지하고 예외와 사유를 한글로 기록한다. 새로 작성하거나 안전하게 변경 가능한 표시 문구부터 적용한다.
- 외부 도구가 생성한 원문 로그·오류 코드·스택 추적은 변조하지 않고 비밀값을 제거한 근거와 한글 원인·조치 설명을 함께 남긴다. `PASS`/`FAIL`/`BLOCKED`/`NOT TESTED` 판정 코드는 유지하되 사람이 읽는 설명은 한글로 쓴다.
- `infra`는 작성·변경을, `qa_docs`는 한글 적용 및 식별자·연동 보존 검토를 담당한다. Manager는 업무 배정과 최종 검토에 이 기준을 포함한다. 지침 변경만으로 기존 Actions 화면까지 한글화되었다고 보고하지 않는다.

기본 흐름:

```text
Issue / approved scope
→ branch/worktree
→ Local Fast Feedback
→ DOCUMENTATION_SYNC: 관련 문서 영향 분석·갱신 또는 N/A 근거
→ push
→ Pull Request
→ GitHub Actions: quality + e2e + docker
→ QA / Manager review
→ merge to main
→ GitHub Actions 재검증
→ GHCR 임시 ci-<full SHA> 게시
→ exact digest pull smoke
→ 임시 ci-<full SHA> package version 삭제
→ [release_required] 명시적 release_authorized 승인 확인 (미승인 시 BLOCKED)
→ [release_required && release_authorized] annotated version tag / Release CI
→ [release_required && release_authorized] 정식 GHCR 게시 / exact digest smoke / stable promotion
→ 완료 증거 / 작업 브랜치 정리 / Issue 종료
```

### Local Fast Feedback

구현 Agent는 작업 중 변경과 직접 관련된 Unit/Integration test, typecheck/lint 등 필요한 최소 검증을 수행한다. 매 코드 변경마다 전체 Vitest, 전체 Playwright, clean Docker build/runtime smoke, GHCR 검증을 로컬 완료 조건으로 반복하지 않는다. 해당 영역 자체를 수정하거나 CI 실패를 재현할 때 필요한 범위로 확대할 수 있다.

Local PASS는 공식 전체 회귀 PASS가 아니며 GitHub Actions PASS를 대체하지 않는다.

### Pull Request Required Validation

코드 변경은 원격 branch와 PR을 통해 검증하는 것을 기본으로 한다. `.github/workflows/ci.yml`의 version check, typecheck, lint, 전체 Vitest, dependency audit, markdown link, production build, Chromium Playwright E2E, Docker build/runtime/SQLite persistence smoke가 기본 공식 회귀 증거다.

PR은 read-only이며 registry write를 수행하지 않는다. 검토 대상 head SHA에서 `quality`, `e2e`, `docker`가 성공하기 전 Manager는 코드 변경을 최종 ACCEPT하지 않는다. Run이 미실행/진행 중이면 NOT TESTED, 실행 불가면 BLOCKED로 기록한다.

CI cache는 성능 보조 수단이며 검증 PASS 증거가 아니다. `npm ci`의 frozen install은 항상 실행하고 `node_modules`를 cache하지 않는다. setup/cache 변경은 cache miss에서도 동일 required gate가 실행되어야 하며 Secret·`.env`·runtime DB·test PASS 결과를 cache/artifact에 저장하지 않는다. Playwright browser cache 같은 신규 cache는 setup 비용 baseline과 invalidation 근거 없이 추가하지 않는다. Phase 2 baseline은 workflow 파일/event/job/metric별로 분리하고 **서로 다른 successful run ID 10개 이상**을 기준으로 하며 matrix shard 수나 동일 run 재실행 횟수를 표본 수로 대체하지 않는다.

### Main Artifact Validation

`main` push에서는 동일 gate를 다시 통과한 뒤에만 `ci-<full SHA>` image를 GHCR에 게시한다. 게시한 image는 exact digest로 다시 pull하여 policy, readiness, native SQLite, Project/Task API authorization/persistence, restart persistence를 검증하고 SBOM/provenance를 생성한다. **successful non-docs main merge의 verified `ci-<SHA>`는 Main CI가 즉시 삭제하지 않고 Generic Release Finalizer에 lifecycle candidate로 인계**한다. `release_required=false`이면 Finalizer가 exact temporary candidate를 정리하고, release-required이면 formal release가 동일 verified digest를 재사용한다. push 이후 검증에 실패한 artifact run은 Main CI에서 exact `ci-<SHA>` package version을 즉시 정리하며 successful candidate handoff나 정식 release 근거로 사용하지 않는다. `ci-*` 자체는 운영·rollback용 정식 release authority가 아니며, 정식 사용 가능 여부는 annotated tag와 Release workflow의 exact-digest promotion이 성공한 뒤에만 판단한다.

로컬 Docker PASS나 PR PASS만으로 main GHCR artifact PASS를 주장하지 않는다.

### Generic Release Finalizer 확인·재실행 규칙

Issue별 one-shot finalizer workflow를 신규 생성하지 않는다. 정상 경로는 `.github/workflows/release-finalizer.yml` 하나이며, `main` CI 성공 뒤 exact merge SHA → merged PR → canonical `Refs #Issue`를 자동으로 resolve한다.

- merge first parent 대비 application version이 동일하면 `finalize`만 수행한다.
- version이 변경되면 정식 release가 필요하다고 판정하되, CI 성공/version bump만으로 승인을 추론하지 않는다.
- 사용자가 정식 GHCR 게시를 명시적으로 승인하면 Manager는 merge 전에 해당 Issue에 `mastergantt-release-authorization:v1` comment marker를 기록한다. 형식과 OWNER-only trusted author 규칙은 `docs/GENERIC_RELEASE_FINALIZER.md`를 따른다.
- release-required인데 유효한 version-scoped 승인 marker가 없으면 generic finalizer는 fail-closed로 BLOCKED하고 Issue/branch/tag를 변경하지 않는다.
- blocker 제거 또는 승인 marker 추가 후에는 **기존 failed generic finalizer run/job 재실행을 우선**한다.
- `issue-lifecycle.yml workflow_dispatch`는 복구 fallback이며 정상 자동 경로를 대체하지 않는다.
- `issue-<N>-release-helper/finalizer` 및 lifecycle 전용 `issue-<N>-cleanup` 패턴은 금지하며 CI policy가 재도입을 차단한다.
- 최종 완료 보고에는 feature PR/merge SHA, exact main CI, generic finalizer run, 필요 시 release-image run/digest, cleanup, FINAL marker/Issue 상태를 구분해 기록한다.

### Environment-specific Validation

GitHub-hosted runner로 대체할 수 없는 Windows Excel/VBA/DRM, 실제 reverse proxy/TLS, off-host backup/restore, production storage, 최종 수동 UX는 별도 환경 검증으로 유지한다. GitHub Actions PASS와 환경별 PASS는 서로 대체하지 않는다.

## 5. Multi-Agent Model and Responsibilities

```text
Main / Manager → GPT-6.1 Sol / High
researcher     → GPT-6 Luna / Medium
ui_ux          → GPT-6.1 Sol / Medium
frontend       → GPT-6.1 Sol / Medium
backend        → GPT-6.1 Sol / High
scheduler      → GPT-6.1 Sol / High
excel_vba      → GPT-6 Luna / Medium
infra          → GPT-6.1 Sol / High
qa_docs        → GPT-6.1 Sol / High
```

실제 model/effort 지원 여부는 실행 환경에서 확인하며 설정값을 실제 실행 검증으로 과대 표시하지 않는다.

비용 효율 기본값은 GPT-6.1 Sol이며, Astra는 Manager가 작업의 실제 난이도·위험이 Sol High를 초과한다고 판단한 경우에만 해당 작업/세션에 일시 승격한다. 반복적 공식 문서 조사와 정형 Excel/VBA 변환은 GPT-6 Luna를 기본값으로 사용한다.

### Manager

요구사항 분석, Architecture/Decision, Agent 분배, 충돌 조정, 결과 Review, Integration과 최종 ACCEPT/REWORK/REJECT/DEFER를 담당한다. 구현 Agent의 자체 PASS를 자동 승인하지 않는다.

코드 변경은 가능한 한 Issue → branch/worktree → PR 흐름으로 진행한다. 검토 대상 PR head SHA와 GitHub Actions `quality/e2e/docker` 결과를 확인하고 원격 gate가 미완료인 상태에서 코드 변경을 최종 완료/ACCEPT로 보고하지 않는다. main artifact 완료를 주장할 때는 필요한 GHCR exact digest validation까지 확인한다.

### researcher

공식 문서, SVAR/Next.js/SQLite/Docker/Excel 제약, library/version/license, scheduling algorithm을 조사한다. Architecture를 임의 결정하거나 구현 코드를 수정하지 않는 것을 기본으로 한다.

### ui_ux

정보 구조, 화면 배치, interaction, 반응형·접근성, 여러 화면의 일관성을 설계하고 구현 증거와 비교하는 read-only 역할이다. 코드/테스트 구현은 frontend, 문서 반영은 Manager 또는 지정 작성자, 독립 QA는 qa_docs가 담당한다. `DESIGN.md`, `docs/UI_UX_GUIDELINES.md`와 공식 SVAR demo/API를 참조한다. 시각 언어는 DESIGN.md, interaction·접근성·검증 세칙은 UI_UX_GUIDELINES.md를 우선한다.

### frontend

Next.js/React/SVAR UI를 담당한다. 변경 관련 Local Fast Feedback을 수행하고 필요한 Playwright test/fixture를 갱신한 뒤 PR 원격 검증으로 전달한다. 전체 회귀는 GitHub Actions 결과로 판정한다. 작은 UI 수정은 UI/UX를 겸임하고, 구조/interaction/접근성 변경은 ui_ux 설계와 `DESIGN.md` 및 공통 UI/UX 가이드를 따른다.

### backend

SQLite, migration, repository/service/API, auth/session, import/export와 server validation을 담당한다. 변경 관련 Unit/Integration Local Fast Feedback과 테스트를 갱신하여 PR 원격 검증으로 전달한다. 전체 회귀와 main container artifact 결과를 로컬 결과와 구분한다.

### scheduler

Calendar, Duration, Summary, Dependency, Auto Scheduling, WBS/Critical Path 등 domain을 담당한다. Algorithm 변경에는 Unit Test를 반드시 작성하고 Local Fast Feedback 후 PR 원격 회귀 검증으로 전달한다.

### excel_vba

Excel → JSON/CSV 변환과 VBA integration을 담당한다. 자동화 가능한 schema/fixture는 repository test로 만들어 GitHub Actions에서 검증하고 실제 Excel/VBA/DRM은 Environment-specific Validation으로 별도 판정한다.

### infra

GitHub repository 운영, GitHub Actions CI/CD, GHCR, Docker/Compose, SQLite persistence와 deployment를 담당한다. PR `quality/e2e/docker` 실행과 실패 분석, main 임시 GHCR publish/exact digest smoke와 검증 후 package cleanup을 주 담당한다. 원격 run/job/step/head SHA를 증거로 사용하며 gate를 약화해 통과시키지 않는다. 상세 절차는 `docs/GITHUB_OPERATIONS.md`와 `docs/REMOTE_VALIDATION.md`를 따른다.

### qa_docs

독립 Reviewer다. [위험도별 QA 정책](docs/QA_REVIEW_POLICY.md)에서 `qa_required=true`인 Issue의 Requirement/code/test/docs를 실제 분리된 주체로 검토하고 Local Fast Feedback과 Remote GitHub Actions를 구분한다. LOW·일부 MEDIUM의 독립 검토 미선택은 근거 있는 `N/A`로 표시한다. HIGH에는 실제 qa_docs 또는 별도 인간 Reviewer가 필수이고 없으면 BLOCKED다(자동 대체는 #580 후속). 코드 변경의 공식 회귀는 PR `quality/e2e/docker`, main artifact는 별도 GHCR exact digest로 확인하며 PASS/FAIL/BLOCKED/NOT TESTED를 혼동하지 않는다.

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

구현 가능한 업무는 가능한 한 GitHub Issue 단위로 관리한다. Issue에는 목표, 배경, 범위, 인수 기준, 담당 에이전트, 관련 문서를 포함한다.

Issue는 요구사항 등록뿐 아니라 **작업 진행 기록의 기준점**으로 사용한다. Manager는 PLAN 확정, 주요 Lifecycle phase 전환, FAIL/BLOCKED, 예상 밖 특이사항, 사용자/maintainer 결정 필요, 재개, 최종 완료 시점에 필요한 정보를 Issue 댓글로 남긴다. 정상적인 세부 명령·반복 조회를 모두 기록하지 않고 사람이 현재 상태와 다음 조치를 파악하는 데 필요한 변화만 기록한다. 표준 유형은 `PLAN`, `STATUS`, `EXCEPTION`, `DECISION_REQUIRED`, `RESUME`, `FINAL`이며 상세 형식과 책임은 `docs/ISSUE_LIFECYCLE.md`를 따른다.

Sub-Agent는 임의로 Issue/PR에 진행 댓글을 쓰지 않고 자신의 Result Contract에 `issue_log_type`, `issue_log_summary`, `decision_required`와 증거를 포함해 Manager에게 반환한다. Manager 또는 Work Packet에서 `issue_comment_writer=infra`와 허용 유형(`issue_comment_allowed_types`)을 명시적으로 지정받은 infra만 공식 Issue 진행 기록을 대신 남길 수 있다. `issue_log_type`만으로 쓰기 권한을 추론하지 않는다. infra에 위임 가능한 유형은 branch/PR/CI/GHCR 운영의 `STATUS`/`EXCEPTION`에 한정하고 PLAN/DECISION_REQUIRED/RESUME/FINAL은 Manager가 기록한다. researcher/ui_ux/qa_docs의 read-only 경계는 그대로 유지한다. Secret, PAT, Password, Token, `.env`, 민감한 운영 로그나 실제 DB 내용은 Issue 댓글에도 기록하지 않는다.

PR에는 요약, 관련 Issue, 변경 사항, 검증, UI 변경 시 화면 캡처, 갱신 문서, 남은 위험을 포함한다. 검증에는 로컬 빠른 검증(Local Fast Feedback)과 GitHub Actions 결과를 분리한다. CI 관련 제목과 설명은 4절의 한글 작성 원칙을 적용한다.

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
- DOCUMENTATION_SYNC Gate PASS: 관련 Documentation 영향 분석, required docs 갱신 또는 N/A 근거, 코드·계약·문서 정합성 확인
- 위험도 기반 QA Review: `risk_level`/`qa_required`에 따라 실제 독립 Reviewer PASS 또는 사유 있는 `N/A` ([QA_REVIEW_POLICY](docs/QA_REVIEW_POLICY.md))
- Manager Review: 최신 Head SHA·위험도·CI·문서·미해결 지적 증거를 인용한 ACCEPT

`main` artifact까지 완료 범위에 포함되는 작업은 추가로 main CI gate PASS, 임시 `ci-<full SHA>` publish, exact GHCR digest runtime smoke PASS, SBOM/provenance 확인과 임시 package version 삭제을 요구한다.

GitHub-hosted runner로 검증할 수 없는 항목은 해당 환경의 PASS/BLOCKED/NOT TESTED 상태를 별도로 기록한다.

## 10. Final Report

Manager는 다음을 구분하여 한글 제목과 설명으로 보고한다. CI 식별자와 판정 코드는 원문을 유지한다.

```text
완료한 작업
관련 Issue / PR / Head SHA
로컬 빠른 검증 (Local Fast Feedback)
GitHub 품질 검사 (quality)
GitHub E2E 검사 (e2e)
GitHub Docker 스모크 검사 (docker)
main GHCR digest 스모크 검사 / 임시 이미지 정리
정식 GHCR 게시 / version tag / Release CI / digest / promotion
실제 Agent 실행 방식 / 위험도(risk_level) / qa_required / Reviewer 신원 / 독립 QA PASS·N/A·BLOCKED / Manager ACCEPT
작업 브랜치 정리 / Issue 상태
환경별 별도 검증
갱신 문서
결정 사항
남은 작업
위험 사항
권장 후속 작업
```

원격 검증이 완료되지 않았으면 완료로 과대 표시하지 않는다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository layout

배포 파일과 실행 경로의 기준은 `docs/REPOSITORY_STRUCTURE.md`다. `deploy/docker/Dockerfile`, `deploy/compose.yml`, `deploy/docker/container-entrypoint.sh`를 사용한다. 루트 `.dockerignore`/npm/Next/TypeScript/ESLint/PostCSS 진입점은 유지한다. Compose 파일 이동을 이유로 기존 프로젝트명·SQLite volume·운영 데이터를 바꾸지 않는다.

## Test configuration relocation (#13)

설정은 `tests/config/vitest.config.ts`, `tests/config/playwright.config.ts`에 있다. `npm test`, `npm run test:e2e`는 그대로 사용한다. 직접 실행은 `npx vitest run --config tests/config/vitest.config.ts`, `npx playwright test --config tests/config/playwright.config.ts`로 지정한다. 설정 파일 기준 root/testDir/webServer.cwd를 사용하고 E2E DB `.data/playwright.sqlite3`, `.next-e2e`, `test-results/`는 루트 기준으로 유지한다. CI는 `node scripts/verify-test-discovery.mjs`로 루트/외부 cwd의 동일한 테스트 발견을 확인한 뒤 전체 테스트를 실행한다. 편집기에서 자동 발견되지 않으면 같은 설정 경로를 지정한다. 실제 Windows 편집기 UI 검증은 미실행이며 [배치 문서](docs/REPOSITORY_STRUCTURE.md)를 함께 따른다.

## 내부망 HTTP 운영 (#8)

Issue #8: production HTTPS 기본값과 명시적 ALLOW_INSECURE_HTTP=true 내부망 HTTP를 함께 지원한다. 공용 URL parser와 검증된 외부 URL 기반 쿠키 정책을 사용하고 HTTP 때문에 Origin/session/revision 검증을 제거하지 않는다. docs/HTTP_OPERATION.md 및 실제 production HTTP/HTTPS browser CI를 확인한다.


### Issue #580 · Review P1/P2 후속: protected main QA 신뢰 경계

- **신뢰 출처:** `.github/workflows/qa-final-trusted.yml`은 기본 브랜치에서 `workflow_run(CI completed)`를 수신하고, `main`의 검증 스크립트로 원본 CI Run ID/Attempt·Head/base·필수 세 Check·리뷰·문서/AC를 재조회한다. `pull_request` Workflow의 `QA Final — Automated`는 **참고용**이며 PR 작성자가 workflow를 바꿀 수 있기 때문에 신뢰된 병합 승인 근거가 아니다.
- **API 검증:** 변경 파일의 `filename` 및 rename `previous_filename` 모두를 보호 목록/보안 정책 목록과 비교한다. 보안/QA/CI 정책 또는 실행 지침 자체를 변경하는 PR은 자동 PASS가 아니라 독립 Reviewer 필요. PR `edited`는 같은 Head라도 이전 성공한 **동일 base SHA**의 full-run 3개 gate 증거가 있어야 한다. 성공 보고서에는 `decision_reason`을 반드시 남긴다.
- **Bootstrap·Required:** #580 PR은 아직 base에 trusted workflow가 없으므로 신뢰 검증 **NOT TESTED**. 독립 `qa_docs`/승인된 별도 인간 Reviewer의 exact-head QA Final 및 Manager ACCEPT 없이는 MERGE_READY가 아니다. `workflow_run`의 Status는 **기본 브랜치 SHA**에 붙으며 자동으로 PR Head의 Ruleset required check가 되지 않는다. 관리자 승인, 예상 source/검증 방식 확인 전 자동 차단 기능을 주장하거나 신규 Required Check를 추가하지 않는다.
- **권한:** trusted workflow 자체는 `contents/actions/pull-requests/issues: read`만 사용, PR 코드 checkout/명령 실행, PAT/추가 Secret, `pull_request_target` 없음. GHCR/릴리스/기존 세 Required Gate 불변. 인증되지 않은 워크플로 이름만으로 Merge Gate를 자동 강제했다고 보고하지 않는다.
- **적용:** 신규 정책은 #580 PR이 적법한 독립 검토·승인 뒤 main에 병합된 이후에만 적용한다. 자동 QA가 구현됐다 하더라도 실제 main Trusted Run을 확인하기 전까지 `AUTOMATED_MANAGER`를 사용할 수 없다.

## Issue #580 — Actions QA Final 대체 Gate (2026-10-10)

- `qa_method=AGENT`: 실제 독립 `qa_docs`/별도 인간 Reviewer의 exact-HEAD 검토 증거가 있어야 한다. CI 성공으로 독립 QA PASS를 주장하지 않는다.
- `qa_method=AUTOMATED_MANAGER`: 기본 브랜치의 실제 `QA Final — Trusted` 검증이 PASS하고 PR의 세 필수 CI도 완료된 후에도 Head별 `Manager ACCEPT`와 위험도별 수동/업무 검토를 분리해 기록한다. 독립 QA는 `N/A(대체 경로)`다.
- LOW/MEDIUM/HIGH 및 기존 세 required checks, DOC_SYNC, 미해결 리뷰 해결, latest HEAD, main CI/GHCR/release gate는 유지한다. HIGH는 scope별 수동 검토·잔여 위험 명시적 수용이 필요하다.
- `.github/workflows/ci.yml` / 검증기/보안 정책 자체가 변경되는 PR은 **trusted base validator가 자동 PASS하지 않으며**, 별도 독립 검토와 Manager 승인 필요. 최초 #580 bootstrap PR 역시 자동 PASS를 주장할 수 없다.
- 현재 GitHub Ruleset Required Check에는 이 신규 Job이 자동 추가되지 않는다. 관리자 승인·설정·expected source 검증 전에는 **운영상 수동 Gate**다. GitHub review count=0도 Manager ACCEPT를 강제하지 않는다.
- 관리자 승인 후 Ruleset을 설정하기 전, 최근 PR에서 QA Job 안정적 표시/성공·실패, expected source, path skip, 재검증/롤백을 확인한다. rollback 시 신규 required check만 사전 승인 후 제거하고 기존 세 check는 유지한다.
- `AUTOMATED_MANAGER` 경로의 자동 판정은 문서 구조·AC 맵·review 상태만 검사한다. 의미적 요구사항/UX/보안 적합성은 Manager 수동 확인 사항이다. 결과 계약: `issue/pr/qa_method/risk_level/rule_version/pr_head_sha/base_or_test_merge_sha/workflow_run_id/run_attempt/quality_evidence/e2e_evidence/docker_evidence/documentation_sync/ac_test_coverage/unresolved_review/automated_qa/independent_qa/manager_decision/residual_risks/decision_reason`.
- 계획·PR에는 `qa_method`, `risk_level`, 선택 이유, Head SHA, document impact, 각 AC의 test mapping, 잔여 위험을 필수로 기록한다. Manager ACCEPT 댓글은 승인 주체, 일시, 정확한 SHA, 범위, 미검증/위험수용을 담는다.
- `AGENT` 경로와 `AUTOMATED_MANAGER` 선택은 독립 QA 실제 실행 유무에 기반한다. 차후 Head가 변경되면 기존 CI·QA·Manager ACCEPT 판정은 stale.
- 이 정책은 #580 구현 PR이 병합되기 전에는 현행 #565 독립 QA 요구를 완화하지 않는다.

## 11. Manager Issue Lifecycle 자동 위임 (#87)

Manager와 모든 Sub-Agent는 작업 전에 [ISSUE_LIFECYCLE](docs/ISSUE_LIFECYCLE.md)를 읽는다. 사용자가 Issue 처리를 요청하면 Manager는 실제 Issue/코드/PR/CI 상태를 읽고, 문서의 역할 선택표에 따라 필요한 전문 Sub-Agent를 자동 선택·위임한다. 분석만 요청한 작업을 구현/게시로 확대하지 않는다.

- Manager는 단계·인수 기준·release_required·release_authorized와 승인 근거·버전 결정·파일 소유권·의존성을 확정하고 위임/반환 계약을 전달한다. 별도의 Manager Sub-Agent를 만들지 않고 Main Thread가 통합한다.
- 복합 UI/UX 설계는 ui_ux, 구현은 frontend다. 사소한 문구/CSS 변경은 frontend가 UI/UX를 겸임하며 [DESIGN](DESIGN.md)과 [UI_UX_GUIDELINES](docs/UI_UX_GUIDELINES.md)를 따른다. 유사 SVAR 공식 demo와 Core/API/설치 버전 차이를 확인한다.
- 병렬 실행은 독립 작업에 한정한다. 동시 한도 6과 실제 runtime 제한을 준수하고 동일 파일 동시 쓰기, 중복 PR/version/tag, 무단 재귀 위임을 금지한다.
- infra는 branch/PR/CI/merge, main 임시 GHCR 게시·digest 검증·정리, 명시적으로 승인된 정식 version tag/Release CI/GHCR 게시·digest 검증을 담당한다. QA_FINAL은 선택된 경로에 따라 AGENT일 경우 실제 qa_docs/별도 인간 Reviewer가, AUTOMATED_MANAGER일 경우 기본 브랜치 Trusted Actions와 Manager가 분담한다(정책 변경은 AGENT 필수). Manager는 실제 근거와 승인 범위를 확인한다.
- GHCR 게시 단계는 Lifecycle에 포함하되 정식 릴리스 필요성(release_required)과 명시적 게시 승인(release_authorized)은 별개다. 단순 '전체 Lifecycle 진행'만으로 정식 릴리스 범위나 승인을 간주하지 않는다. 사용자 또는 지정 maintainer의 명확한 정식 GHCR 게시 요청/승인 근거가 있어야 annotated tag·정식 게시·rolling tag 변경을 실행한다. 이미 확인한 동일 범위의 승인은 반복 요청하지 않는다. 필요한 릴리스의 승인이 없으면 BLOCKED/승인 대기로 남긴다.
- 문서/Agent 지침만의 변경은 제품 영향이 없음을 확인해 application version 유지와 정식 release N/A를 기록할 수 있다. Lifecycle 문서 수정 요청 자체를 제품 릴리스 승인으로 해석하지 않으며 실제 main 임시 GHCR workflow 결과는 생략하지 않는다.
- 필요한 GHCR 게시·검증과 main gate가 남아 있으면 병합만으로 이슈를 종료하지 않는다. PR에는 조기 자동 종료 대신 Refs 연결을 사용한다. 안전한 branch 정리와 완료 증거를 남긴 뒤 승인 범위에서 종료한다.
- 도구 부재 시 단일 에이전트 순차 처리임을 밝히고 독립 Sub-Agent/QA 실행을 주장하지 않는다. `qa_required=false`로 판정된 LOW/일부 MEDIUM은 독립 QA만 사유 있는 N/A로 처리하되 Manager 검토와 필수 CI는 유지한다. HIGH 또는 `qa_required=true` MEDIUM은 `qa_method=AGENT`에서 별도 Reviewer가 없으면 BLOCKED다. 보호된 CI/보안/QA 정책을 변경하지 않은 후속 PR은 **기본 브랜치** `QA Final — Trusted`의 정확한 Head/base PASS와 Manager 위험 수용으로 `AUTOMATED_MANAGER`를 선택할 수 있으나, #580 최초 Bootstrap은 실제 독립 Reviewer가 의무다. CI/GHCR 미실행을 PASS로 간주하지 않으며 TOML 존재는 runtime 검증이 아니다.
- CI 실패는 근거에 따라 담당 Agent에 REWORK하고, 중단/추가 요청은 Issue/PR에 재개 지점을 기록한다. main PASS, 정식 GHCR PASS, 실제 운영 배포는 서로 대체하지 않는다.

이 지침은 기존 CI/보안/권한 gate를 완화하거나 GitHub에서 상시 Agent 서버를 실행하는 설정이 아니다. 모델·effort·동시 실행 제한의 실제 적용은 사용하는 Codex 환경에서 별도 확인한다.

## 12. Issue Work Packet 기반 실행 표준 (#109)

Issue 기반 개발은 `docs/ISSUE_LIFECYCLE.md`를 전체 단계 Source of Truth로 하고, 실제 위임/반환 형식은 `docs/AGENT_PROMPTS.md`를 사용한다.

- Manager는 작업 시작 시 실제 Issue, main SHA, 기존 branch/PR/CI, version을 조회하고 표준 **Issue Work Packet**을 만든다.
- Packet에는 Issue/AC/scope/non-scope, lifecycle phase, baseline SHA/branch/head, version 결정, release_required/release_authorized, `risk_level`/`risk_reason`/`qa_required`/실제 reviewer/QA 증거/Manager 승인, 파일 소유권, 테스트·required docs·문서 작성자·증거, Issue 댓글 작성자/허용 유형(`issue_comment_writer`/`issue_comment_allowed_types`), 다음 handoff를 포함한다. 위험도 분류는 PLAN·REWORK·Head 변경·병합 전 다시 확인한다.
- 모든 Sub-Agent는 Packet에 지정된 phase와 파일 범위만 수행한다. scope/interface/version/release 판단 변경이 필요하면 독자 결정하지 않고 Manager에게 반환한다.
- frontend/backend/scheduler/excel_vba는 application/domain 구현·관련 테스트·Local Fast Feedback을 담당한다. workflow/Docker/Compose/GHCR 등 infrastructure-only 변경은 infra가 구현 Agent가 될 수 있다. 그 다음 별도 DOCUMENTATION_SYNC Gate에서 문서 영향 분석과 required docs 갱신/N/A 근거를 완료한다. researcher/ui_ux/qa_docs는 read-only 책임을 유지한다.
- version 결정과 전체 단계 전환은 Manager가 소유한다. branch/PR/CI/merge/main GHCR/branch cleanup은 infra가 실행하되 Manager gate와 승인 범위를 따른다.
- 구현 Agent는 자신의 구현 범위를 넘어 version/tag/PR/merge/GHCR/Issue close를 독자 수행하지 않는다. infra가 구현 Agent인 경우에도 version/release/merge gate는 Manager 결정과 위험도별 QA/필수 CI 선행조건을 따른다.
- `qa_required=true`이고 `qa_method=AGENT`이면 qa_docs/승인된 별도 인간 Reviewer가 DOC_SYNC 뒤 AC/code/test/docs/실제 CI를 구현자와 분리해 검토한다. `qa_method=AUTOMATED_MANAGER`는 보호된 CI/QA/보안 정책 파일이 변경되지 않은 경우에만 main trusted QA PASS·Manager HIGH 강화 검토·잔여 위험 수용으로 대체하며, 실제 독립 QA는 `N/A(대체 경로)`로 기록한다. `qa_required=false`인 LOW/일부 MEDIUM은 근거 있는 독립 QA `N/A(reason)`를 사용한다. 구현 Agent의 자체 PASS와 CI 성공을 독립 Reviewer PASS로 사용하지 않는다.
- REWORK/재개 시 기존 Issue/branch/PR을 재사용한다. PR head가 바뀌면 이전 head에 연결된 모든 required PR CI(`quality/e2e/docker`)와 QA_FINAL 판정(독립 PASS 또는 N/A)은 변경 영향도와 무관하게 stale이며 새 head에서 위험도/QA 의무와 실제 증거를 전부 재검증한다. Local Fast Feedback은 변경 영향도에 따라 재사용 여부를 판단할 수 있다. 구현/계약 변경이 문서에 영향을 주면 이전 DOCUMENTATION_SYNC PASS도 stale이다.
- 모든 Agent 결과는 `PASS | FAIL | BLOCKED | NOT TESTED`와 변경 파일/commit 또는 head/실제 검증/미검증/위험/다음 담당을 포함하는 Result Contract로 반환한다.
- 병합만으로 Lifecycle을 끝내지 않는다. main CI, repository 정책상 임시 GHCR digest 검증/cleanup, 안전한 branch 정리와 Issue 종료까지 필요한 gate를 확인한다. 작업 branch 삭제는 `scripts/safe_branch_cleanup.py`의 merged-head/ancestry/protected/open-PR/ref-race/SHA-lease 검증을 사용하며 Issue별 workflow에 무조건 삭제 로직을 복제하지 않는다.
- 정식 release는 `release_required=true`이면서 `release_authorized=true`인 경우에만 실행한다.

### Issue Lifecycle Actions / Ruleset 운영

Issue Lifecycle의 GitHub Actions·Ruleset·Auto-merge 책임 경계와 관리자 설정 기준은 [ISSUE_LIFECYCLE_AUTOMATION.md](docs/ISSUE_LIFECYCLE_AUTOMATION.md)를 따른다.

- 요구사항 분석, AC/DoD, 설계·계획, version/release 판단과 구현은 Manager/Domain Agent 책임이다.
- PR/main/release의 반복 가능한 검증, GHCR digest smoke, 안전한 branch cleanup과 완료 evidence는 GitHub Actions 자동화를 우선한다.
- 병합 gate는 Ruleset + required checks + conversation resolution + Auto-merge를 기본으로 하며 Actions가 quality gate를 우회해 직접 병합하지 않는다.
- 신규 Issue별 `issue-<N>-release-helper.yml`을 만들지 않는다. 범용 lifecycle workflow를 우선하고 기존 일회성 helper는 퇴역 기준에 따라 정리한다.
- 저장소 관리자 설정을 실제로 변경할 수 없는 도구에서는 Ruleset/Auto-merge를 적용했다고 주장하지 않고 BLOCKED/수동 설정으로 기록한다.

## 13. 범용 Issue Lifecycle workflow (#211)

병합 이후의 공통 orchestration은 `.github/workflows/issue-lifecycle.yml`을 사용한다. 신규 Issue별 release-helper를 만들지 않는다. 공식 입력은 Issue/PR 번호와 Manager가 확정한 release_required/release_authorized이며 branch/SHA/version은 원격 evidence에서 다시 도출한다. `verify`는 read-only, `release`와 `finalize`만 job-scoped write 권한을 가진다. workflow는 PR을 병합하지 않고 Ruleset/Auto-merge를 우회하지 않는다.

release/finalize의 target은 PR의 exact `merge_commit_sha`이고, 해당 SHA의 main `ci.yml` success만 인정한다. formal GHCR publish는 `release-image.yml`, branch 삭제는 `scripts/safe_branch_cleanup.py`를 재사용한다. lifecycle workflow에는 `packages: write`를 부여하지 않는다. 사용법·idempotency·migration은 [ISSUE_LIFECYCLE_AUTOMATION](docs/ISSUE_LIFECYCLE_AUTOMATION.md)을 따른다.


### release / finalize / release_finalize 운영 해석 (#248)

현재 `scripts/issue_lifecycle.py finalize`는 `release_required=true`인 경우 내부에서 정식 release evidence를 확보한 뒤 cleanup/FINAL/Issue close를 수행하므로, 구현상 `finalize` 한 번으로 release와 종료가 이어질 수 있다. 다만 Actions UI의 operation 명칭이 이를 충분히 드러내지 않아 운영 혼동이 발생할 수 있으므로 Issue #248에서 명시적인 `release_finalize` operation을 추가한다.

- 정식 release만 수행하고 Issue를 닫지 않을 때: `release`
- 정식 release 없이 종료할 때: `finalize` + `release_required=false`
- 정식 release부터 cleanup/FINAL/Issue close까지 한 번에 수행할 때: `release_finalize` + `release_required=true` + `release_authorized=true`
- `release_finalize`는 `expected_version`과 `authorization_note`를 필수로 하고, release 실패 시 cleanup/close를 실행하지 않는 fail-closed 순서를 유지한다.
- Issue #248 구현 전까지 정식 release+종료를 한 번에 수행해야 한다면 현재 `finalize`의 release 포함 동작을 사용하되, 동일한 승인/버전 입력 계약을 충족해야 한다.

자세한 운영 계약과 idempotency는 `docs/ISSUE_LIFECYCLE_AUTOMATION.md`를 따른다.


### Issue #577 PR CI 메타데이터 운영

PR 생성 시 canonical Primary Issue trace를 완성한다. 이후 진행 기록은 PR/Issue 댓글을 사용하고 상태 전달만을 위한 제목/본문 `edited`를 유발하지 않는다. Metadata-only는 같은 SHA의 최신 full CI required gate 성공을 즉시 확인하며, 오래된 Head는 SUPERSEDED/N/A로 조기 종료한다. full CI 진행 중/실패/미존재는 성공으로 취급하지 않는다. `DEFERRED/MISSING`은 full CI 성공을 확인한 후 해당 metadata 실패 Job 재실행으로 복구한다. 해당 재실행이 실제 strict Ruleset에 반영되었는지 별도 검증한다. 승인 범위가 'PR CI 시작까지'라면 완료를 기다리지 않는다.
