# Issue #617 — WBS–Target 연결 F3 Work Packet

## 기준 및 실행 범위

- Issue: https://github.com/planner77/masterGantt/issues/617, 상위 #613, 완료 선행 #614/#616.
- baseline main: `e195780227a504536d0d9f7f27924f24267f8caf`; branch: `feat/issue-617-task-target-bindings`.
- 현재 phase: QA_READY → PR_CI 준비. 사용자 요청의 마지막 단계는 구현·미해결 리뷰 해결·PR CI 시작 확인이다. CI 모니터링/병합/main 검증/게시/Issue 종료는 후속 범위다.
- application version: `0.108.0` → `0.109.0` minor. WBS binding/API/영속 계약의 추가 기능이며 dependency graph는 유지한다.
- 담당: domain=계약/단일 resolver, backend=DB/service/usage 안전성, HTTP=handler/route/권한 회귀, copy=hierarchy/Copy/Template/포맷, docs=관련 문서 작성, Manager=통합/기록/version, qa_docs=별도 read-only 사전 검토.
- 모든 write ownership은 파일별로 분리한다. Issue 기록 작성자는 Manager이며 Sub-Agent는 GitHub 댓글/PR/commit/게시를 수행하지 않는다.

## 계약 및 비범위

whole은 현재 member의 살아 있는 참조이며 memberIds/coverage를 저장하지 않는다. subset은 같은 Target의 명시 member를 요구하며 Equipment coverage만 null 또는 현재 quantity 이하 양의 정수를 허용한다. 기본 self, Summary만 subtree opt-in. 직접 및 모든 조상 Summary subtree 합집합을 한 pure resolver로 계산하고 출처는 보존하며 인스턴스는 dedup한다. legacy 직접 MCS/Equipment로 Target을 역추론하지 않는다.

Target 변경 확인은 제안 diff와 정확 snapshot/revision에 결속하고 subset 삭제·coverage 초과·stale는 atomic 거부한다. cut/reparent는 binding identity 유지와 영향 확인, copy는 명시 연결만 새 ID로 복사한다. Project Copy/Template는 Target/member/instance를 한 번씩 remap한다. 미지원 포맷은 binding 유실을 성공으로 응답하지 않는다.

`referencedByTaskCount: number | null`에서 null은 미산출, 0은 계산된 실제 0, N은 일반 Task 고유 개수다. Summary는 별도 집계하며 legacy 직접 연결은 Target count로 바꾸지 않는다. 이 값만으로 삭제를 승인하지 않고 실제 binding/revision을 검증한다.

F4 authoring UI, Resource 공수 집계, 일정/status/Dependency/Assignment, Milestone membership/Ready 변경, PRO 기능은 비범위다.

## DOCUMENTATION_SYNC
- `AGENTS.md`: N/A(기존 실행 지침과 신뢰 경계를 변경하지 않음)
- `DESIGN.md`: N/A(화면 및 공통 시각 언어 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(새 화면과 interaction 구현은 후속 F4 범위)
- `docs/PROJECT_UX.md`: N/A(Workspace 컴포넌트 동작 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(독립 QA 및 병합 승인 정책 불변)
- `docs/ISSUE_LIFECYCLE.md`: N/A(Lifecycle 정책 및 권한 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(GitHub 운영 및 required checks 권한 불변)
- `docs/CI_CD.md`: N/A(기존 minor version 및 릴리스 승인 정책 준수)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 전체 원격 회귀 gate 유지, 이번 상태는 Work Packet 기록)
- `docs/SECURITY.md`: N/A(기존 read/edit 세션 Origin strong If-Match 계약 재사용)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정 알고리즘 및 Milestone 의미 변경 없음)
- `docs/DEPLOYMENT.md`: N/A(컨테이너 배포 및 운영 저장 경로 불변)
- `docs/API.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/IMPORT_EXPORT.md`: UPDATED
- `docs/IMPORT_SCHEMA.md`: UPDATED
- `docs/EXCEL_EXPORT.md`: UPDATED
- `docs/LOGISTICS_DASHBOARD.md`: UPDATED
- `docs/ISSUE_27_PROJECT_COPY.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/TARGET_RESOURCE_ROLLOUT.md`: UPDATED
- `docs/exec-plans/active/ISSUE_617.md`: UPDATED
- `CHANGELOG.md`: UPDATED

## AC_TEST_COVERAGE
- AC1: pure resolver golden A/B whole, ACS-only subset, legacy equipment-only and management Summary fixtures; actual SQLite binding API acceptance.
- AC2: direct/self/subtree/nested Summary source unions and reversed input order invariance; no descendant override.
- AC3: legacy shared MCS never implies Target; duplicate Target/legacy instances dedup while sources remain.
- AC4: actual SQLite whole impact preview/confirm, subset member removal, coverage quantity reduction, stale revision and rollback tests.
- AC5: hierarchy copy/reparent impact, Project Copy/Template ID remap, shared MCS once, migration/restart and unchanged legacy/WBS/Milestone integration fixtures.
- AC6: handler negative read/edit/session/Origin/strong If-Match/body/query tests; read revision remains unchanged.
- AC7: DOCUMENTATION_SYNC paths reflect actual DTO/API/DDL/copy/template and format boundaries; link and preflight contract verification.
- AC8: unsupported null vs calculated 0/N, distinct regular Task count with summary separate and whole/subset/self/subtree/legacy provenance tests.

## 위험도 및 QA·릴리스
risk_level: HIGH
risk_reason: 영속 graph·합집합 상속·공유 수량·복사 및 권한/revision 경계
qa_required: true
qa_method: AGENT
reviewer: /root/qa (별도 qa_docs 실행, read-only 사전 검토)
independent_qa: NOT TESTED
manager_decision: NOT TESTED
release_required: true
release_authorized: false

새 minor version 준비는 release 승인 또는 배포가 아니다. 보호 package version 변경에는 기존 trusted human receipt 요구를 유지한다. 별도 Agent 사전 검토는 인간 영수증 또는 원격 QA_FINAL을 대체하지 않는다. 최신 Head의 Required Quality/E2E/Docker 완료 전 MERGE_READY=BLOCKED다.

## 검증 원장

- Local Fast Feedback: PASS. 통합 타깃 Vitest 19 files / 315 tests (2026-10-14), typecheck, version:check, ESLint (0 errors, 기존 warnings), Markdown 링크 210 files, git diff --check. 로컬 공유 node_modules를 이용한 빠른 검증이며 CI frozen npm ci·전체 회귀를 대체하지 않는다.
- GitHub quality/e2e/docker: NOT TESTED (PR CI 시작 전).
- DOCUMENTATION_SYNC: PASS. 문서별 UPDATED/N/A 정합성 및 trusted docs_gate 구조/AC1~AC8 mapping 확인. 전체 ProjectSnapshot에 binding을 추가했다고 주장하지 않으며 전용 canonical binding aggregate를 사용한다.
- 독립 사전 검토: NOT TESTED.
- main GHCR/정식 Release/cleanup: NOT TESTED (현재 요청 범위 밖).
- 환경별 운영 DB backup/restore·다중 프로세스·수동 UI: NOT TESTED.

## 사전 검토 및 보완 원장

- 별도 qa_docs가 실제 SQLite에서 Project DELETE FK 충돌, subset→whole 후 선택 row 잔존을 재현했다. migration0027의 deferred NO ACTION FK 및 selection guard로 보완 후 동일 시나리오를 별도 재검증: PASS. binding identity 변경도 DB guard로 차단한다.
- Task copy는 새로운 Target binding과 기존 명시 self/subtree Equipment/System 링크를 함께 복사한다. 원본 참조는 유지하고 inherited 출처는 저장 행으로 평탄화하지 않는다. 기존 legacy copy 생략 기대값은 이 명시 복사 계약으로 갱신했다.
- 전체 ProjectSnapshot은 기존 형식을 유지하며 신규 GET/PUT target-bindings 전용 aggregate로 명시/상속/legacy 유효집합을 제공한다.
- 최종 QA_FINAL/Trusted human receipt/Manager ACCEPT는 원격 CI 및 별도 승인 전 NOT TESTED이며 MERGE_READY=BLOCKED다.

## PR #676 리뷰 후속 (2026-10-14)

- Source PR CI #2723.1 (run 38482212214) Required Quality/E2E 6개/Docker: PASS (이전 Head b7686b686beb9ee7a58474701037eab455d11146). 새 리뷰 보완 Head에서는 재검증 필수.
- Trusted QA #363.1 (run 38484216563): BLOCKED — 원본 Head의 미해결 리뷰 스레드 2건. Required 세 종 PASS를 QA_FINAL 또는 MERGE_READY PASS로 오인하지 않는다.
- 리뷰 P1: 전체 바인딩/legacy 목록의 task별 O(tasks × links) 반복 검색을 sourceTask별 인덱스 조회로 대체한다. 5,000 Task × 10 binding 규모 회귀를 추가하고 기존 순서 불변 golden 결과는 유지한다.
- 리뷰 P2: inactive Target/member는 기존 scope·selection·memberIds·coverage가 변경되지 않은 참조만 재저장할 수 있다. 동일 Target ID의 self→subtree/whole→subset 확장·변경을 409로 거부하고 SQLite 회귀를 추가한다.
- 이 변경의 원격 PR CI·Trusted QA 및 인간 QA/Manager 위험 수용·정식 GHCR 릴리스는 신규 증거 전 NOT TESTED/BLOCKED다. 기존 QA_METHOD=AGENT, release_required=true, release_authorized=false를 바꾸지 않는다.
