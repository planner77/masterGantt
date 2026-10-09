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
| AC1, AC4 | `QA_REVIEW_POLICY.md` `2 위험 분류/의무·N/A 구분 |
| AC2 | `AGENT_PROMPTS.md` Work Packet·Result Contract, `ISSUE_LIFECYCLE.md` PLAN/PR 기록 |
| AC3 | `QA_REVIEW_POLICY.md` `4에서 LOW/MEDIUM/HIGH, 도구 부재, 위험 승격, Head 변경의 기대 판정 시나리오 |
| AC5 | `QA_REVIEW_POLICY.md` `3과 기존 CI/CD·Ruleset 불변 |
| AC6 | `QA_REVIEW_POLICY.md` `4의 #525/#530 이력 예시; 과거 판단 소급 안 함 |
| AC7 | AGENTS/AGENT_PROMPTS/LIFECYCLE/AUTOMATION/REMOTE_VALIDATION/GITHUB_OPERATIONS/AGENT_CONFIGURATION |
| AC8 | 실제 PR 생성 시 exact Head와 신규 required CI 실행 시작 확인, Manager ACCEPT/병합은 범위 밖 |

이 문서의 판정 시나리오는 **정책 설계의 기대 결과**이지 실행된 단위 테스트·독립 QA·원격 Actions 증거가 아니다.
