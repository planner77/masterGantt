# Issue #565 Work Packet — 위험도 기반 QA Final 정책

- Issue: https://github.com/planner77/masterGantt/issues/565
- 관련 후속: https://github.com/planner77/masterGantt/issues/580 (GitHub Actions 기반 대체 QA; 이번 범위 아님)
- 기준 main: `d41032358c5cbeb4758e124d037d9ada18af9ee9`, application `0.103.1`
- Work branch: `docs/issue-565-risk-based-qa-policy`
- lifecycle: PLAN → 문서 정책 구현 → DOCUMENTATION_SYNC → PR_OPEN → PR_CI **시작까지**
- risk_level: **HIGH**, risk_reason: QA/병합 승인 운영 계약 변경. 정책 설명 파일 수만으로 LOW로 내리지 않는다.
- risk_triggers: CI/QA merge governance; 관련 파일: AGENTS.md, docs/ISSUE_LIFECYCLE.md, docs/AGENT_PROMPTS.md 및 하위 운영 지침
- qa_required: **true**; qa_review_mode: `qa_docs` 또는 별도 `human`. 현재 Sub-Agent 실행 도구 없음 → 독립 QA Final은 실제 증거 전 **NOT TESTED/BLOCKED**; Manager 순차 자체 검토를 독립 QA PASS로 주장하지 않음.
- owner: Manager(정책 확정/문서 작성, Issue PLAN/STATUS/최종 판단), infra(원격 branch/PR/CI; 코드 도구 대신 GitHub connector 수행), qa_docs(실제 제공 시 read-only); documentation_owner=Manager.
- version_decision: keep 0.103.1. release_required=false, release_authorized=false. App/API/DB/Scheduling/GHCR 런타임 변경 없음; 정식 release N/A.
- required tests/evidence: 정책 위험 분류 시나리오 표, 각 문서 충돌 대조, Markdown links 및 최신 PR Head의 3 required aggregate CI 결과. Workflow/Ruleset은 변경하지 않음.
- required_docs: `docs/QA_REVIEW_POLICY.md`, `AGENTS.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/AGENT_PROMPTS.md`, `docs/AGENT_CONFIGURATION.md`, `docs/GITHUB_OPERATIONS.md`, `docs/ISSUE_LIFECYCLE_AUTOMATION.md`, `docs/REMOTE_VALIDATION.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`, `docs/DECISIONS.md`, 이 Work Packet.
- N/A rationale: `DESIGN.md`/`docs/API.md`/`docs/DB_SCHEMA.md`/`docs/SCHEDULING.md`/`docs/DEPLOYMENT.md`/`CHANGELOG.md`는 제품 계약/버전/화면/DB/배포가 변경되지 않아 갱신하지 않는다. `.github/workflows/ci.yml`/Ruleset은 #580의 별도 범위.
- latest-pr required aggregate checks quality/e2e/docker: PR 생성 전 NOT TESTED. path-filter로 implementation shard가 SKIPPED이면 aggregate PASS와 별도 구분.
- stopping point: 새 PR 생성 및 PR CI 시작 근거. 병합/정식 GHCR/main CI/Issue 종료는 수행하지 않는다.

## AC 매핑

| AC | 증거/산출물 |
| --- | --- |
| AC1, AC4 | `QA_REVIEW_POLICY.md` 2절 위험 분류/의무·N/A 구분 |
| AC2 | `AGENT_PROMPTS.md` Work Packet·Result Contract, `ISSUE_LIFECYCLE.md` PLAN/PR 기록 |
| AC3 | `QA_REVIEW_POLICY.md` 4절 LOW/MEDIUM/HIGH, 도구 부재, 위험 승격, Head 변경의 기대 판정 시나리오 |
| AC5 | `QA_REVIEW_POLICY.md` 3절과 기존 CI/CD·Ruleset 불변 |
| AC6 | `QA_REVIEW_POLICY.md` 4절의 #525/#530 이력 예시; 과거 판단 소급 안 함 |
| AC7 | AGENTS/AGENT_PROMPTS/LIFECYCLE/AUTOMATION/REMOTE_VALIDATION/GITHUB_OPERATIONS/AGENT_CONFIGURATION |
| AC8 | 실제 PR 생성 시 exact Head와 신규 required CI 실행 시작 확인, Manager ACCEPT/병합은 범위 밖 |

이 문서의 판정 시나리오는 **정책 설계의 기대 결과**이지 실행된 단위 테스트·독립 QA·원격 Actions 증거가 아니다.

## 2026-10-10: PR #583 병합 이후 독립 QA F1 정합화 — 후속 PR

- 근거: [이전 독립 QA FAIL/REWORK](https://github.com/planner77/masterGantt/issues/565#issuecomment-6083701630), 문제 위치 `.codex/agents/infra.toml` 82/103. 이전 PR #583은 merge SHA `1ed682dd062012f3d04c2517110835bf7c28ac13`로 반영됐고 Main CI #2320.1 SUCCESS이나, 이 사실만으로 F1 해소를 주장하지 않는다.
- 신규 시작 기준 `main=1ed682dd062012f3d04c2517110835bf7c28ac13`, 후속 branch `fix/issue-565-agent-qa-policy-consistency`, 변경 범위는 Agent TOML 실제 `developer_instructions`와 QA 위험도 정책·검증/운영 문서. 기존 merged PR #583을 수정/재개하지 않고 단일 후속 PR을 생성한다.
- 위험 `risk_level=HIGH` (`qa_required=true`): CI/병합 QA 승인 정책 실행 지침. 실 QA Final은 새 Head에 대한 실제 독립 `qa_docs` 또는 승인된 별도 인간 Reviewer가 판정해야 한다. 이 세션은 독립 Sub-Agent 실행 가능성이 확인되지 않아 `QA_FINAL=NOT TESTED`; PR CI만으로 PASS를 주장하지 않는다.
- Owner: infra 또는 Manager 지정 writer가 Agent 지침/문서 변경을 수행. `documentation_owner=Manager`, `issue_comment_writer=manager`. QA Reviewer는 read-only를 유지한다.
- 필수 검증: TOML 문법/8개 Agent TOML 중 조건부 QA 승인 관련 문구 대조, QA_REVIEW_POLICY LOW/MEDIUM/HIGH·N/A·BLOCKED 기대 판정표, 기존 required checks 및 Main CI/GHCR 보존. PR 생성 뒤 exact Head CI Run 확인 및 실행 결과 별도 기록.
- DOC_SYNC 변경: `.codex/agents/infra.toml`(F1), `.codex/agents/frontend.toml`/`ui-ux.toml`(표현 정합성), `docs/QA_REVIEW_POLICY.md`, `docs/AGENT_CONFIGURATION.md`, `docs/GITHUB_OPERATIONS.md`, `docs/TEST_PLAN.md`, 본 Work Packet. `AGENTS.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/AGENT_PROMPTS.md`, `docs/REMOTE_VALIDATION.md`, `docs/CI_CD.md`는 기존 위험도 분기·필수 CI/증거 계약이 유효하여 이번 실행 지침 보완으로 변경할 조항 없음 → 항목별 갱신 N/A. `docs/ISSUE_LIFECYCLE_AUTOMATION.md`는 이미 Gate C의 필수 CI·리뷰 스레드 해결·정렬 및 정책 문서의 위험도별 QA/Manager ACCEPT 참조를 보존하고 있으며 이번 후속 PR은 Actions/Ruleset/자동 병합 절차를 바꾸지 않아 N/A. `docs/DECISIONS.md`는 #565의 LOW/MEDIUM/HIGH 정책 및 #580 후속 분리 결정이 이미 기록되어 있고 이번 변경은 기존 결정의 실제 Agent TOML 적용 누락 수정이므로 새로운 ADR 또는 과거 결정 수정이 불필요하여 N/A. `DESIGN.md`/API/DB/Scheduling/DEPLOYMENT/CHANGELOG는 기능·API·DB·화면·애플리케이션 버전 무변경 → N/A.
- 기존 제품 version `0.103.1` keep, `release_required=false`, `release_authorized=false`. `.codex/**`가 비문서 경로로 분류될 수 있어 병합 후 임시 GHCR Gate의 실행 여부는 추후 실제 main CI에서 판단한다. #580의 Actions 기반 대체 QA는 이번 범위 아님.
- 요청 종료점: **해당 수정/문서 동기화 + 후속 PR CI 검증**, 병합/Main CI/정식 GHCR/Finalizer/branch cleanup/Issue 종료는 시작하지 않는다.
