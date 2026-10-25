# Issue #450 — #444 Phase 2 readiness 자동화 배포

## Work Packet
- Primary Issue: #450 / 구현 PR #451 / Parent #444 (실측·최적화 종료 전 OPEN 유지). PR #448은 superseded.
- 작업 branch: ci/issue-450-phase2-readiness-deploy, 기준 main 25e368ef7b4ba7cf59ac5b81e94dd0a98b87f31d.
- risk_level: HIGH; qa_method: OWNER_MANAGED. GitHub Actions workflow, build cache, setup metric provenance 및 배포 준비 측정을 변경하므로 보호 파일로 분류한다.
- release_required: false; release_authorized: false; application version: 0.104.0 유지. 실제 제품 UI/API/DB/스케줄 알고리즘 변경 없음.
- 구현: Phase 2 분석기·before/after 비교기, npm/Next/Docker/Playwright cache guard, trusted main readiness workflow, #444 marker 댓글 갱신과 10-run baseline 최소 표본 판정.
- 보안 경계: 성공한 workflow artifact에만 GitHub workflow run 메타데이터를 binding하고 --require-bound-provenance true 검증; PR 코드가 아닌 trusted main checkout, issues:write 이외 write 금지; #444 CLOSED면 no-op; READY에서도 PR/Issue/cache 변경 자동화 금지.
- 직접 CI 복구: Run #2462.1 policy+Vitest는 readiness workflow의 required provenance 검증 옵션이 누락되어 FAIL. QA route는 PR qa_method/risk_level 누락으로 BLOCKED. shard 3 E2E #463은 fake clock 단일 32ms frame 시점에서 캐시 복귀 준비상태가 false여서 FAIL.
- E2E 복구는 production 로직 수정이 아니라 테스트 스케줄링 보완(최대 8×16ms)이며 느린 stale response를 여전히 미해결 상태로 유지, 추가 HTTP 호출 금지 및 data-ready 검증을 보존한다.
- Local Fast Feedback: 연결형 GitHub 수정 환경에서 npm/Vitest/Playwright 로컬 실행은 NOT TESTED. 새 exact-head GitHub PR CI의 policy, unit, E2E 6-shard, Docker 실실행 결과로 판정한다.
- 본 요청 범위: 보완 후 새 PR CI 시작. 새 CI PASS, 독립 의미 검토 또는 Manager ACCEPT, 병합/Main CI/GHCR/Issue 종료는 아직 주장하지 않는다.

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 Issue 598 Owner-managed HIGH 검증 정책을 따르며 QA 정책 코드는 변경하지 않음)
- `docs/SCHEDULING_ENGINE.md`: N/A(Milestone 데이터와 스케줄링 계약은 불변; Issue 463 테스트 fake clock 진행만 보정)
- `docs/exec-plans/active/ISSUE_444.md`: UPDATED
- `docs/exec-plans/active/ISSUE_450.md`: UPDATED
- `DESIGN.md`: N/A(제품 UI 또는 UX 계약 변경 없음)
- `docs/API.md`: N/A(제품 API DTO/HTTP 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite Schema 및 Migration 불변)

## AC_TEST_COVERAGE
- AC1: PR #451 GitHub Actions Quality, E2E 6-shard, Docker required aggregates의 exact-head PASS 확인; 기존 gate 삭제/우회 없음.
- AC2: scripts/analyze-ci-setup-metrics.mjs·scripts/bind-ci-setup-artifact-provenance.mjs 및 tests/scripts/ci-setup-provenance.test.ts; distinct successful run과 provenance binding 검증.
- AC3: scripts/compare-ci-setup-metrics.mjs·scripts/verify-ci-cache-contract.mjs 및 tests/scripts/ci-cache-phase2.test.ts; cache invalidation·fallback·before/after 기준 검증.
- AC4: .github/workflows/ci-setup-readiness.yml·scripts/render-ci-setup-readiness.mjs 및 tests/scripts/ci-setup-readiness.test.ts; default branch trusted checkout, marker idempotency, #444 OPEN/CLOSED/READY 경계 검증.
- AC5: AGENTS.md·docs/CI_CD.md·docs/GITHUB_OPERATIONS.md·docs/REMOTE_VALIDATION.md·docs/TEST_PLAN.md; 문서 계약과 #444 OPEN 추적 확인.
- AC6: PR 병합/Main CI/릴리스 경계는 이번 PR CI 시작 요청에서는 NOT TESTED; 배포 후 별도 evidence 확인. formal GHCR release N/A/0.104.0 유지.

## Evidence boundary
- 실패 원장: PR CI #2462.1, https://github.com/planner77/masterGantt/actions/runs/38099672570. 정책/Unit: provenance 필수 옵션 누락; QA 경계: PR 메타데이터 누락; E2E shard 3: Issue 463 cached query fake clock 32ms 지연.
- 새로운 PR CI 시작 후 verdict는 실행 완료 전 NOT TESTED. 기존 실패 run은 소급 PASS가 아니다.
- independent_qa=N/A(Owner-managed 경로), automated_qa=NOT TESTED, manager_decision=NOT TESTED. HIGH 잔여 위험의 Owner 위험 수용·명시 병합 승인 없이는 MERGE_READY를 주장하지 않는다.
- #444는 baseline/Phase 2 실제 채택·전후 비교가 끝날 때까지 OPEN; #450은 배포 검증 전 OPEN.
