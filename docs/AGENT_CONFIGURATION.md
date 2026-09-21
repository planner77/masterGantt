# Agent configuration validation

## 2026-09-22: UI/UX 전담 역할과 Issue Lifecycle (#87)

### 결정과 책임

#74/#75/#76의 편집창·목록·Workspace 요구는 개별 UI 구현을 넘어 정보 구조, action/status 계층과 화면 간 일관성을 다룬다. 기존 frontend와 설계 책임을 분리하기 위해 `ui_ux`를 추가한다. 작은 문구/CSS 수정은 frontend가 UI/UX를 겸임하여 불필요한 Agent 실행을 줄인다.

| 역할 | 현재 요청 설정 | 책임 경계 |
| --- | --- | --- |
| Main / Manager | 기존 gpt-6-astra / high 유지 | Issue 분석·자동 배분·단계/파일 소유권·버전/승인·최종 판단 |
| ui_ux | gpt-5.6-terra / high / read-only | 정보 구조·interaction·반응형·접근성 설계와 구현 증거 비교 |
| frontend | 기존 gpt-5.6-terra / medium 유지 | UI/test 구현, 작은 변경의 UI/UX 겸임, browser 증거 |
| infra | 기존 gpt-6-astra / high 유지 | branch/PR/CI/merge 및 main/정식 GHCR 게시·digest 검증 |
| qa_docs | 기존 gpt-5.6-sol / high / read-only 유지 | 요구사항/코드/테스트/문서/UI·GHCR 증거 독립 검토 |

researcher/backend/scheduler/excel_vba의 기존 모델·effort·domain 책임은 유지한다. 전문 역할은 총 8개이며 동시 실행 한도는 기존 6이다. 역할 수와 동시 실행 수는 다르다. 별도의 Manager Sub-Agent는 만들지 않는다.

### 실행 규칙의 연결

- [AGENTS.md](../AGENTS.md): 모든 역할의 공통 진입점과 Manager의 명시적 위임 지시.
- [ISSUE_LIFECYCLE.md](ISSUE_LIFECYCLE.md): 선택표, 위임/반환 계약, 파일 소유권, 단계 gate, REWORK/재개, GHCR 게시와 종료 조건.
- [UI_UX_GUIDELINES.md](UI_UX_GUIDELINES.md): #76 UX-01~12 선행 기준과 SVAR demo/API 확인, 상태·접근성·반응형 검증.
- [.codex/agents/ui-ux.toml](../.codex/agents/ui-ux.toml): 새 역할의 Source of Truth. frontend/qa_docs 설정에도 협업 계약을 연결한다.

ui_ux와 qa_docs는 읽기 중심으로 결과를 반환한다. 설계 문서 반영은 Manager/지정 작성자, UI/test 수정은 frontend다. GHCR 게시에 새 Agent를 추가하지 않고 기존 infra에 배정한다. 정식 release가 필요한 이슈는 version/tag/Release CI/digest 검증 전 종료하지 않는다. 임시 ci-image는 정식 배포 이미지가 아니다.

### 설정과 실제 실행의 구분

공식 [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) 문서에서 프로젝트 `.codex/agents/*.toml`, name/description/developer_instructions, AGENTS 지침에 따른 위임을 확인했다. name이 역할 ID이며 파일명과 하이픈/밑줄이 달라도 된다. 기존 `.codex/config.toml`의 `max_concurrent_threads_per_session = 6`과 Manager 설정은 변경하지 않는다.

새 세션에서 프로젝트 설정이 로드되고 ui_ux가 선택 가능한지, 실제 model/effort와 read-only 경계, 위임/반환/종료를 확인해야 한다. 설정/정적 검사만으로 model access나 독립 실행을 입증하지 않는다. 읽기 전용 sandbox가 connector 쓰기 권한까지 강제한다고 가정하지 않는다.

현재 변경은 지침/Agent 설정만의 변경이며 application version, source/API/DB, workflow/권한, 정식 release를 변경하지 않는다. 정적 검사·PR CI·main 임시 GHCR·실제 Agent 실행은 별도 상태로 Issue/PR에 기록한다. Sub-Agent 도구가 없는 세션의 순차 검토를 독립 qa_docs 실행으로 표시하지 않는다. 이 문서 작성은 #76의 실제 Workspace 구현 완료가 아니다.

아래 2026-09-12 절은 기존 결정 이력이다.

## 2026-09-12: GitHub-first validation 적용

코드 변경 검증 정책을 로컬 전체 실행 중심에서 GitHub Actions 중심으로 전환했다. 상세 정책은 `docs/REMOTE_VALIDATION.md`가 Source of Truth다.

### Agent별 적용

| 역할 | 검증 책임 |
| --- | --- |
| Main / Manager | PR head SHA의 GitHub Actions `quality/e2e/docker`가 성공하기 전 코드 변경을 최종 ACCEPT하지 않는다. main artifact 범위는 GHCR exact digest 결과까지 확인한다. |
| frontend | 변경 관련 Local Fast Feedback과 필요한 Playwright test/fixture를 작성하고 PR 원격 검증으로 전달한다. |
| backend | 변경 관련 Unit/Integration Local Fast Feedback과 API/DB/Auth 테스트를 작성하고 PR 원격 검증으로 전달한다. |
| scheduler | Algorithm Unit Test를 작성하고 관련 Local Fast Feedback 후 PR 전체 회귀 검증으로 전달한다. |
| excel_vba | 자동화 가능한 schema/fixture는 GitHub Actions에서 검증하고 실제 Windows Excel/VBA/DRM은 Environment-specific Validation으로 분리한다. |
| infra | PR `quality/e2e/docker`와 main GHCR immutable image/exact digest smoke의 원격 운영 및 실패 분석을 담당한다. |
| qa_docs | Local 결과와 Remote 결과를 분리하고 코드 변경의 공식 전체 회귀 판정은 실제 GitHub Actions 결과를 우선한다. |
| researcher | 읽기 중심 조사 역할이므로 구현 검증 workflow 책임은 추가하지 않는다. |

모든 구현 Agent는 매 변경마다 전체 Vitest/Playwright/Docker smoke를 로컬 완료 조건으로 반복하지 않는다. 변경과 직접 관련된 Local Fast Feedback은 유지하며, 전체 회귀의 공식 증거는 GitHub Actions다. GitHub-hosted runner로 대체할 수 없는 Windows Excel/DRM, 실제 reverse proxy/TLS, backup/restore, 수동 UX는 별도 환경 검증으로 유지한다.

검증 상태는 PASS/FAIL/BLOCKED/NOT TESTED를 구분한다. 로컬 PASS를 원격 PASS로, PR PASS를 main GHCR artifact PASS로 과대 표시하지 않는다.

## 2026-09-12: GitHub / CI / GHCR 담당 역할 확장

기존 `.codex/agents/infra.toml`의 Docker/Compose, GitHub Actions CI, Semantic Version Release Gate, GHCR publish/digest smoke 책임을 확장하여 GitHub 운영 설정과 CI 장애 대응까지 `infra`가 주 담당한다. 별도 GitHub/CI Agent는 추가하지 않는다.

| 항목 | 현재 설정 |
| --- | --- |
| Main / Manager | `gpt-6-astra` / high |
| researcher | `gpt-5.6-terra` / medium / read-only |
| frontend | `gpt-5.6-terra` / medium |
| backend | `gpt-5.6-sol` / high |
| scheduler | `gpt-6-astra` / high |
| excel_vba | `gpt-5.6-sol` / medium |
| infra | `gpt-6-astra` / high |
| qa_docs | `gpt-5.6-sol` / high / read-only |

모델/effort는 설정 요청값이며 실제 실행 모델과 지원 여부는 실행 환경에서 별도 확인한다. `.codex/config.toml`의 Manager 설정과 동시 실행 한도는 변경하지 않는다.

### 검증 범위

- `.codex/agents/*.toml`은 각 역할의 Source of Truth이며 `AGENTS.md`는 공통 작업/검증 원칙을 제공한다.
- 역할 지시문은 `docs/REMOTE_VALIDATION.md`를 직접 참조하도록 갱신했다.
- 실제 Codex custom agent 자동 탐색, model access, sandbox enforcement는 repository 정적 설정만으로 입증하지 않는다.
- GitHub 관리자 설정, Secrets, GHCR visibility/접근 권한, release 발행/운영 배포는 별도 권한/승인 대상이다.
- 변경된 지시문 자체의 공식 회귀 상태는 해당 PR의 실제 GitHub Actions run으로 판정한다.

### 실행 시 확인

새 세션/설정 reload 후 Manager는 구현 Agent에게 작업을 배정할 때 Local Fast Feedback과 Remote Required Validation을 분리해 보고하도록 한다. `infra`는 GitHub run/job/step/head SHA와 GHCR digest를 근거로 보고하고 `qa_docs`는 독립 판정한다. 지원되지 않는 모델은 조용히 대체하지 않고 Manager에게 보고한다.

관련 문서: `AGENTS.md`, `docs/REMOTE_VALIDATION.md`, `docs/GITHUB_OPERATIONS.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`.
