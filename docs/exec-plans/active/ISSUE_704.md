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

GitHub QA Preflight/Trusted QA의 `docs_gate()` 구조 검사와 사람의 의미 검토를 **분리**한다. 다음은 `qa.docs_required(paths)` 합집합을 포함한 변경/비변경 판정이다.

- `AGENTS.md`: UPDATED
- `docs/PR_CI_FAILURE_TRIAGE.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/exec-plans/active/ISSUE_704.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 OWNER_MANAGED와 Trusted QA 승인 정책 불변)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 GitHub 권한 및 브랜치 PR 운영 계약 불변)
- `docs/LOCAL_PREPR.md`: N/A(기존 prepr CLI 구현과 입력 규격 불변)
- `docs/ISSUE_667_FAILURE_ANALYSIS.md`: N/A(기존 #667 불변 실패 기록을 교체하지 않고 참조)
- `DESIGN.md`: N/A(제품 사용자 화면과 디자인 동작 변경 없음)
- `docs/API.md`: N/A(제품 HTTP API와 DTO 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(데이터베이스 스키마와 마이그레이션 불변)
- `docs/ARCHITECTURE.md`: N/A(애플리케이션 아키텍처 변경 없음)
- `docs/DEPLOYMENT.md`: N/A(컨테이너 및 배포 절차 변경 없음)
- `CHANGELOG.md`: N/A(앱 기능 출시와 SemVer 변경 없음)
- `README.md`: N/A(앱 최종 사용자 사용법과 설치 계약 불변)

**기타 비범위:** `.github/**`, `src/**`, `tests/**`, `scripts/**`, package/lock은 변경하지 않는다. CI Workflow/6-shard/Required/Trusted 정책을 수정하지 않으므로 제품 회귀 실행 증거를 위장하지 않는다.

## AC_TEST_COVERAGE

- AC1: Issue 전체 PR·Run·Attempt 수집 → 누적 문서 생성/갱신 → 과거 전체 원인 비교 → bounded 진단 → 동결 source 교차 재검증 → 다음 CI 진입을 [공통 지침](../../PR_CI_FAILURE_TRIAGE.md)의 단계 A~G, [AGENTS](../../../AGENTS.md), [Lifecycle](../../ISSUE_LIFECYCLE.md) 문구 및 상대 링크 확인으로 검증. 원격 실제 CI 판정은 NOT TESTED.
- AC2: Issue별 파일 경로, 최초/후속 append 서식, immutable 출처/취소 Job과 실패 케이스 보존, 결손 표기, 복수 PR/rerun·Run/Attempt 템플릿은 [공통 지침](../../PR_CI_FAILURE_TRIAGE.md)의 1/2/4/5절 정적 감사로 검증. 운영 실패 이력 자동 수집은 비범위.
- AC3: #667 기존 원장 불변과 #697 [TEST_PLAN](../../TEST_PLAN.md)/#699 [LOCAL_PREPR](../../LOCAL_PREPR.md) 안내 및 [AGENTS](../../../AGENTS.md)·Lifecycle·CI_CD·Remote Validation의 상대 링크 정합을 확인. 제품 테스트 또는 기존 #667 결과를 소급 성공 처리하지 않는다.
- AC4: compare에서 `AGENTS.md`와 `docs/**` 외 변경 0, Markdown 경로·형식 확인, Work Packet DOCUMENTATION_SYNC 및 risk HIGH, OWNER_MANAGED·release=false, Required/Trusted/Owner remote 상태를 실제 실행 전 NOT TESTED로 검증.

## 검증 증거 및 다음 Gate

- 사전 확인: main 실제 `AGENTS.md`, `docs/TEST_PLAN.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/CI_CD.md`, `docs/REMOTE_VALIDATION.md`, `docs/LOCAL_PREPR.md`, `docs/ISSUE_667_FAILURE_ANALYSIS.md` 조회. 기존 #667 원장이 이미 Issue당 누적 파일·불변 Run 증거를 활용함 확인.
- 별도 최종 확인: branch의 Markdown 내부 경로, 변경 파일 비교 및 실제 PR Head를 read-only 검사하고 실행 여부 명시.
- Docs-only 변경이더라도 `AGENTS.md` 보호 경로는 HIGH, Owner-managed, 정확한 PR Head의 Required CI·Trusted QA/리뷰 스레드0·충돌 없음·Owner 명시 승인 전 **병합 불가**. PR 생성/CI 시작은 합격 판정이 아니다.
