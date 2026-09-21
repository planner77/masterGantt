# Agent configuration validation

## 2026-09-12: GitHub-first validation 적용

코드 변경 검증 정책을 로컬 전체 실행 중심에서 GitHub Actions 중심으로 전환했다. 상세 정책은 `docs/REMOTE_VALIDATION.md`가 Source of Truth다.

### Agent별 적용

| 역할 | 검증 책임 |
| --- | --- |
| Main / Manager | PR head SHA의 GitHub Actions `quality/e2e/docker`가 성공하기 전 코드 변경을 최종 ACCEPT하지 않는다. main artifact 범위는 GHCR exact digest 결과까지 확인한다. |
| ui_ux | UI/UX 설계·접근성·responsive acceptance criteria를 read-only로 검토하며 실제 browser 검증은 별도 상태로 분리한다. |
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
| ui_ux | `gpt-5.6-terra` / medium / read-only |
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

관련 문서: `AGENTS.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/UI_UX_GUIDELINES.md`, `docs/REMOTE_VALIDATION.md`, `docs/GITHUB_OPERATIONS.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`.

## 2026-09-22: UI/UX 전담 역할과 Issue Lifecycle 자동 배분

Issue #85에서 #74/#75/#76과 같은 화면 재설계 요구를 검토했다. 기존 frontend는 구현과 테스트 책임이 중심이므로, 정보 구조·interaction·접근성·responsive 판단을 구현과 분리하기 위해 read-only `ui_ux`를 추가했다. 모든 UI 수정에 강제하지 않고 신규 화면/Workspace·Editor·Navigation 재설계/공통 pattern/접근성 위험이 큰 변경에 Manager가 선택적으로 배정한다.

`docs/ISSUE_LIFECYCLE.md`는 Manager의 Issue intake, 역할 선택, 파일 소유권, version 결정, branch, 구현, QA, PR/CI, REWORK, merge, main 검증, Issue close와 재개 규칙의 Source of Truth다. `docs/UI_UX_GUIDELINES.md`는 frontend/ui_ux/qa_docs의 공통 UX 기준이다.

이번 변경은 agent instruction과 문서 계약이며 application runtime/API/DB/dependency를 변경하지 않으므로 application version을 올리지 않는다. `.codex/config.toml`의 Manager 모델/effort와 `max_concurrent_threads_per_session = 6`도 유지한다. 역할 TOML이 존재하는 사실은 실제 custom agent 실행, model access 또는 sandbox enforcement의 실행 증거가 아니다.
