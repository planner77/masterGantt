# Issue #598 — Owner 중심 QA·병합 단순화

## Work Packet
- 기준 main: `31372f967159b2f993116c73f0adc228eb1ea0ff`; version `0.104.0`; risk_level: HIGH; qa_method: OWNER_MANAGED, AGENT 선택.
- release_required=false; release_authorized=false; 이번 요청은 PR CI 시작까지.
- 기존 trusted main의 검증기와 본 PR에서 수정한 검증기를 구별한다. 본 PR의 기존 protected BLOCKED 판정은 유지하며 별도 Owner 일회성 전환 승인·세 required CI 및 잔여 위험 검토 전 병합 불가.
- 설계: AGENT의 독립 인간 exact HEAD 승인 경로 유지. OWNER_MANAGED와 AUTOMATED_MANAGER(기존 alias)는 protected 경로도 코드상 자동 QA 검증 가능하되, SHA/base/run·required 세 집계·위험도·review thread·문서/AC를 신뢰된 기본 브랜치 validator로 확인하고 Owner 병합 허가는 별도. 자동 QA는 Owner 인증 또는 formal GHCR 게시 권한 아님.
- Risks: UI/DB/API 변경 없음. Bootstrap self-approval·위조 댓글·CI old HEAD·우회 승인 금지. New trusted positive는 main 적용 전 NOT TESTED.
- Local Fast Feedback: 이 GitHub 연결 환경에서는 테스트 실실행 NOT TESTED; 원격 PR policy job에서 `python3 scripts/test_qa_final_automated.py`, `scripts/verify-issue-lifecycle.py` 실행 예정.

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `docs/ISSUE_LIFECYCLE_AUTOMATION.md`: UPDATED
- `docs/AGENT_PROMPTS.md`: UPDATED
- `docs/AGENT_CONFIGURATION.md`: UPDATED
- `docs/DECISIONS.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `.codex/agents/infra.toml`: UPDATED
- `.codex/agents/qa-docs.toml`: UPDATED
- `.codex/agents/frontend.toml`: UPDATED
- `.codex/agents/ui-ux.toml`: UPDATED
- `docs/exec-plans/active/ISSUE_598.md`: UPDATED
- `DESIGN.md`: N/A(UI·UX/시각 설계 변경 없음)
- `docs/API.md`: N/A(외부 API·DTO 불변)
- `docs/DB_SCHEMA.md`: N/A(SQLite·migration 불변)

## AC_TEST_COVERAGE
- AC1: scripts/test_qa_final_automated.py·scripts/qa_final_automated.py 및 docs/QA_REVIEW_POLICY.md; 경로·세 집계 CI 검증
- AC2: scripts/test_qa_final_automated.py·scripts/qa_final_automated.py 및 docs/QA_REVIEW_POLICY.md; 경로·세 집계 CI 검증
- AC3: scripts/test_qa_final_automated.py·scripts/qa_final_automated.py 및 docs/QA_REVIEW_POLICY.md; 경로·세 집계 CI 검증
- AC4: scripts/test_qa_final_automated.py·scripts/qa_final_automated.py 및 docs/QA_REVIEW_POLICY.md; 인증과 상태 분리 검증
- AC5: scripts/test_qa_final_automated.py·scripts/qa_final_automated.py 및 docs/QA_REVIEW_POLICY.md; 인증과 상태 분리 검증
- AC6: scripts/test_qa_final_automated.py·scripts/qa_final_automated.py 및 docs/QA_REVIEW_POLICY.md; 인증과 상태 분리 검증
- AC7: scripts/test_qa_final_automated.py·scripts/qa_final_automated.py 및 docs/QA_REVIEW_POLICY.md; 신뢰·bootstrap·문서·릴리스 검증
- AC8: scripts/test_qa_final_automated.py·scripts/qa_final_automated.py 및 docs/QA_REVIEW_POLICY.md; 신뢰·bootstrap·문서·릴리스 검증
- AC9: scripts/test_qa_final_automated.py·scripts/qa_final_automated.py 및 docs/QA_REVIEW_POLICY.md; 신뢰·bootstrap·문서·릴리스 검증
- AC10: scripts/test_qa_final_automated.py·scripts/qa_final_automated.py 및 docs/QA_REVIEW_POLICY.md; 신뢰·bootstrap·문서·릴리스 검증
- AC11: scripts/test_qa_final_automated.py·scripts/qa_final_automated.py 및 docs/QA_REVIEW_POLICY.md; 신뢰·bootstrap·문서·릴리스 검증

## Evidence boundary
- Independent QA: N/A(Owner-managed, 독립 검토 없음)
- automated_qa: NOT TESTED (새 PR CI 시작 전)
- manager_decision: NOT TESTED
- 기존 QA Final BLOCKED run은 소급 변경 금지. 새 validator의 trusted 실행 증거는 main 반영 후.
- Required Ruleset #24043042: approving reviewers 0; strict required checks Quality/E2E/Docker; unresolved review thread forbidden. Ruleset 설정 미변경.
- Release: Main CI 비문서 GHCR 임시 ci-<SHA>·digest/SBOM/finalizer 유지. 정식 릴리스 승인 없음.

## PR #599 / CI #2415.1 REWORK 기록 (2026-10-10 KST)

- 실패 run: https://github.com/planner77/masterGantt/actions/runs/38053912562 (원본 Head `65284bab397c5e13ea264bdb515a53cb72146ca7`). Quality aggregate FAIL의 직접 원인은 정책 Job 내 markdown link 검사: `docs/TEST_PLAN.md`에서 Work Packet을 잘못된 `ISSUE_598.md` 상대 경로로 링크했다. `exec-plans/active/ISSUE_598.md`로 교정했으며 구 Run은 FAIL 원장에 그대로 남긴다.
- Codex P1 #1: `test_owner_managed_protected_path_and_legacy_alias`의 `TEST_MERGE_SHA` 누락으로 다음 Python 회귀에서 KeyError 발생. 현재 fixture에 올바른 test merge SHA를 추가했다.
- Codex P1 #2: 이전 `test_composite_action_pr_is_not_automatically_accepted`가 구 보호 경로의 전면 BLOCKED를 기대하고 `open_threads`도 구현하지 않았다. OWNER_MANAGED일 때 composite action의 HIGH 분류를 보존하면서, 정확한 PR 증거의 기계 검증 결과와 `manager_decision=NOT TESTED`를 분리하여 확인하고 risk LOW 위장 차단을 함께 테스트한다.
- Node TypeScript/Lint/Unit/Build 및 Docker/E2E Required aggregate는 구 Run에서 성공했지만 최신 Head를 증명하지 않는다. 정책 Python 테스트는 Markdown 단계에서 실행되지 않았으므로 과거 PASS로 기록하지 않으며 새 exact-Head PR CI에서 재검증한다. 원격 실행 전 결과 NOT TESTED.
- 문서 영향: `docs/TEST_PLAN.md` 수정, Work Packet에 원인/검증 mapping 추적 추가. `DESIGN.md`: N/A(제품 UI 변경 없음). 다른 보호 QA·Ruleset·Main/GHCR Gate는 수정 없음.
- 병합/정식 Release/정책 bootstrap Owner 승인 및 GHCR는 이번 실행 요청 범위 밖이다.
