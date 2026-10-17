# Issue #704 — PR CI 실패 전 이력 누적 REWORK Work Packet

- **Primary Issue:** [#704](https://github.com/planner77/masterGantt/issues/704) · docs-only 프로세스 정책
- **Baseline:** main `de863713142a92f1cac56dbae044923822bca932` (2026-10-17, branch 생성 시)
- **Branch:** `docs/issue-704-pr-ci-cumulative-triage`; 기존 Issue #697/#699는 완료되었으므로 범용 후속 정책을 독립 Issue로 추적
- **Version:** 앱·package version **유지**. `release_required=false`, `release_authorized=false`; GHCR/Release 변경·승인 없음
- **risk_level:** HIGH — `AGENTS.md`/Issue Lifecycle 공통 Agent 운영 계약 변경. `qa_method=OWNER_MANAGED`, `qa_required=true`, `independent_qa=N/A(Owner-managed)`, `manager_decision=NOT TESTED` (실제 Owner 승인 전). Required Quality/E2E/Docker와 Trusted QA는 새 PR 원격 실행 전 `NOT TESTED`
- **담당:** Manager 요구사항·누적 기준/문서 단일 소유, infra 원격 CI 원본 계약·PR/Run 검증, domain 구현 Agent는 후속 Issue REWORK 시 적용. QA docs/read-only 검토는 정책상 필요할 때만 인계
- **목표:** 동일 Issue의 모든 관련 PR/Run/Attempt·Shard 실패를 한 Markdown 원장에 누적하고, 반복 실패 시 과거 전체를 먼저 읽어 원인별 일괄 보완·동결 source 교차 검증을 수행하는 공통 지침
- **비범위:** 기존 Issue #552/#667 구현/실제 장애 원인 수정, Run 재실행·CI workflow/테스트/6 shard/fail-fast/required Gate 변경, 자동 수집 기능, merge/Main/GHCR/Finalizer/Release

## 계획 및 수용 기준

1. **AGENTS / Manager·infra·domain**: 실패 순간/REWORK/세션 인계마다 누적 원장 읽기·작성, 직전 Run-only 분석 금지, 전체 GitHub 이력 재조회 및 소유권 명시.
2. **원장 지침:** `docs/ISSUE_<N>_FAILURE_ANALYSIS.md` Issue당 하나; 최초 실패부터 생성·재실패 시 append; 다중 PR와 rerun Attempt, fail-fast 취소 Job의 실제 오류, 원본 source 및 로그 만료 대응. 기존 `docs/ISSUE_667_FAILURE_ANALYSIS.md` 불변.
3. **Cross-run 보완:** 기존 실패 파일 합집합·원인 분류/가설·반증, 영향 소비자/음성 사례, #697 TEST_PLAN 및 #699 diagnose 연계(도구 API 원격 인증하지 않음). CI Required 통과 우회/timeout·assertion 완화 금지.
4. **문서 연계:** Issue Lifecycle Work Packet/REWORK, TEST_PLAN, CI_CD 및 Remote Validation을 공통 지침으로 연결. 새 Head PR CI/QA와 병합 승인은 기존 계약 유지.
5. **검증:** 변경 전/후 파일 목록·새 상대 링크 유효성·문서 간 충돌·비문서 변경 없음; 원격 PR CI·Trusted QA는 실제 Run 증거가 있을 때만 판정.

## DOCUMENTATION_SYNC

| 파일/영역 | 결정 및 근거 |
| --- | --- |
| `AGENTS.md` | UPDATED — Manager/infra/domain의 Issue 전 이력 기반 대응 의무 |
| `docs/PR_CI_FAILURE_TRIAGE.md` | CREATED — canonical 누적 원장·서식·필드·분류·재검증/승인 기준 |
| `docs/ISSUE_LIFECYCLE.md` | UPDATED — REWORK·Work Packet·인계 계약 |
| `docs/TEST_PLAN.md` | UPDATED — #697의 bounded 확대 진단과 누적 원장 연결 |
| `docs/CI_CD.md` | UPDATED — Run/Attempt 출처와 workflow 불변 안내 |
| `docs/REMOTE_VALIDATION.md` | UPDATED — remote evidence와 취소/미실행/Head 분리 |
| `docs/exec-plans/active/ISSUE_704.md` | CREATED — 현재 Work Packet/문서 영향·잔여 Gate |
| `docs/LOCAL_PREPR.md`, `docs/ISSUE_667_FAILURE_ANALYSIS.md` | N/A — 기존 #699 CLI/원장 증거는 수정하지 않고 연결 |
| `docs/QA_REVIEW_POLICY.md`, `docs/GITHUB_OPERATIONS.md` | N/A — Owner-managed·Trusted QA/승인/보호 권한 정책은 불변 |
| `DESIGN.md`, `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `CHANGELOG.md`, `README.md` | N/A — 앱 UI·기능·DB·배포·사용자 사용법·버전 변경 없음 |
| `.github/**`, `src/**`, `tests/**`, `scripts/**`, package/lock | N/A — CI/제품/테스트 코드 및 의존성 변경 없음 |

## 검증 증거 및 다음 Gate

- 사전 확인: main 실제 `AGENTS.md`, `docs/TEST_PLAN.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/CI_CD.md`, `docs/REMOTE_VALIDATION.md`, `docs/LOCAL_PREPR.md`, `docs/ISSUE_667_FAILURE_ANALYSIS.md` 조회. 기존 #667 원장이 이미 Issue당 누적 파일·불변 Run 증거를 활용함 확인.
- 별도 최종 확인: branch의 Markdown 내부 경로, 변경 파일 비교 및 실제 PR Head를 read-only 검사하고 실행 여부 명시.
- Docs-only 변경이더라도 `AGENTS.md` 보호 경로는 HIGH, Owner-managed, 정확한 PR Head의 Required CI·Trusted QA/리뷰 스레드0·충돌 없음·Owner 명시 승인 전 **병합 불가**. PR 생성/CI 시작은 합격 판정이 아니다.
