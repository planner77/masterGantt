# Issue #767 — PR #764 교정 승계 및 v0.129.1 PATCH 릴리스

> 상태: IMPLEMENTATION — 신규 이슈/PR 기준 검증 전. Source: [Issue #767](https://github.com/planner77/masterGantt/issues/767). 원본 [PR #764](https://github.com/planner77/masterGantt/pull/764), SHA `5abc65880879647a563c0469bf53c4cd4f654b6b`.

## 1. 목적 및 근거

원본 Issue #736은 2026-10-21 #765 미발행 부채 정리로 RETIRED/Closed되었고, `v0.128.0` 게시 권한이 철회되었다. 교정 PR #764는 이미 `0.129.0` formal image 출처에 **미포함**이므로 새로운 Primary Issue/PR에서 `0.129.1` PATCH로 정식 릴리스 대상 범위를 분리한다. 기존 `v0.129.0` immutable GHCR 이미지·Tag/Finalizer/F765 원장은 변경·재게시하지 않는다.

## 2. 불변 소스/수행 순서

- 원본 `main=71f9b9ddb61be7f6e076accc027188f362e18bb1`, 원본 #764 Head `5abc65880879647a563c0469bf53c4cd4f654b6b` (first parent `cb1e9372...`, second parent `71f9b9d...`). 초기 Full [#3092.1](https://github.com/planner77/masterGantt/actions/runs/39602089760)와 trusted [#734.1](https://github.com/planner77/masterGantt/actions/runs/39607021968) SUCCESS는 *원본* 이력이다.
- 새 branch `fix/issue-767-v0.129.1-assignment-focus`를 원본 main에서 생성. PR #764 diff 10개 파일 전부 cherry-pick equivalent Git blob tree로 계승; 예외적으로 3개 공유 문서 맨 위에 이 Issue의 출처·릴리스 계획을 추가한다. 기능 코드/테스트 4개 + 간접 UI 1개 등 PR 파일의 SHA를 대조한다.
- Manifest `package.json` 0.129.1, lock top-level/root 모두 0.129.1; 의존성·node modules·lock resolution은 변경하지 않는다.
- 버전/문서 변경 후 새 exact Head PR Full CI(3 Required Quality/Chromium6/Docker, QA Final Automated) + default-main Trusted QA; review thread0 및 strict main. 새 Head로 검증될 때까지 `NOT TESTED` 및 `MERGE_READY=BLOCKED`.
- Owner 명시적 병합 지시: “권고안에 따라 교정 릴리스로 정리 후 병합하세요.” 이는 HIGH 잔여 위험 수용·후속 #767 PR/Head/CI 검토와 함께 정확하게 기록하며 **정식 GHCR 게시 승인으로 자동 확대하지 않는다**.
- 성공 시 새로운 PR을 **merge commit** 방식으로 병합한다. Canonical `Issue #767 · PR #<N> · 교정 릴리스` 한글 제목(30자 이내)/빈 커밋 body/expected-head lease 및 test merge tree 동일성 확인 필수. Old #764는 새 PR 대체를 알리고 미병합 close; branch 삭제는 임의 수동 수행하지 않는다.

## 3. 기능/회귀 계약

1. `src/features/gantt/task-assignment-editor.tsx`: exact assignment edit은 canonical assigned-targets를 사용하여 full candidate 목록 GET=0; edit-session permission/expiry authenticated GET로 fail-closed, 일반 Editor full 후보 조회 유지.
2. `src/features/milestones/project-milestone-dashboard.tsx`, `src/features/projects/project-readonly-view.tsx`: M1→리소스→일정→M1 이동/복귀에서 원본 Milestone Task UUID 및 현재 로딩 완료를 확인하고 Resource trigger focus 복구. 다른 이동/모달과 경합 시 취소.
3. `tests/e2e/issue-621-resource-target.spec.ts`: 100→80→70, 다른 Assignment 불변, revoked edit-session readonly/미저장, 401·412 draft 보존, request count 및 원본 focus 검증.
4. `tests/e2e/resource-kpi-integration-ui.spec.ts`: M1 조건/Resource trigger 및 통합 KPI 수치/구간 불변 확인.
5. 변경 밖: API/DB/schema/접근권한 계약, DESIGN/UI_UX_GUIDELINES(기존 형태 유지), CI policy/worker/shard/timeout/retry, GHCR/Finalizer 운영 코드. 변경 필요 없는 문서는 N/A를 기록한다.

## 4. AC / 증거

- [ ] AC1 원본 #764 10 파일 코드는 증거로 동등성 검증, #765 변경·출처 보존.
- [ ] AC2 새 버전 0.129.1 manifest/lock 3곳 및 CHANGELOG/TEST_PLAN/PLAN/new Work Packet 동기화.
- [ ] AC3 새 Primary Issue #767, branch issue-767, PR title `Issue #767`, body **단독** `Refs #767` 계약 충족.
- [ ] AC4 새로운 Head Full PR CI Quality/Chromium6/Docker 및 Trusted QA PASS, 미해결 리뷰 thread0, strict main.
- [ ] AC5 Issue #767 Owner HIGH 위험 수용·새 SHA/run 근거, 정식 merge commit, 새 main CI 시작 확인.
- [ ] AC6 공식 `v0.129.1` 게시 시에만 별도 scoped Owner 승인/verified Main candidate/SBOM/provenance/tag/digest; 최종 FINAL+Close도 실제 증거 후에 수행. 운영 배포 비범위.

## 5. 역할/실행 제한

- frontend: 기존 수정 소스·회귀 보존, qa_docs: source/docs read-only 검토, infra: branch/PR/CI, Manager: 버전/문서/위험/병합. 연결된 API에서는 단일 에이전트 순차 처리하며 독립 인간 QA를 수행했다고 주장하지 않는다.
- Risk HIGH / qa_required=true / qa_method=OWNER_MANAGED / independent_qa=N/A(Owner-managed) / manager_decision=NOT TESTED / MERGE_READY=BLOCKED / release_required=true / release_authorized=false (정식 이미지 게시 별도 승인).
- 실패 발생 시 [단일 실패 원장](../../ISSUE_767_FAILURE_ANALYSIS.md)에 정확한 Run/attempt/Job 및 대응 추가. 기존 #736 실패 원장과 이슈 종료는 변경하지 않음.

## DOCUMENTATION_SYNC

- `DESIGN.md`: N/A(기존 #764 디자인과 상호작용 규칙을 그대로 이관하며 별도 화면 설계 추가 없음)
- `docs/TEST_PLAN.md`: UPDATED
- `docs/SCHEDULING_ENGINE.md`: N/A(일정·마일스톤 계산 엔진과 의존 관계는 건드리지 않고 UI 복귀 포커스만 수정)

추가 동기화 문서: `CHANGELOG.md`, `docs/exec-plans/active/PLAN.md`, `docs/exec-plans/active/ISSUE_736.md`(구 이슈 RETIRED 공지), `docs/ISSUE_736_FAILURE_ANALYSIS.md`(역사적 단일 원장), `docs/ISSUE_767_FAILURE_ANALYSIS.md`(신규 누적 원장) 및 root package/lockfile의 PATCH version 3곳. `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/CI_CD.md`/QA 정책은 API/schema/CI/QA 규칙 변경 없음에 따라 N/A.

## AC_TEST_COVERAGE

- AC1: #764 Source/Head의 변경 code/test 원시 blob SHA를 #767 PR과 대조하고 #765 main 변경 내용·실패 원장을 보존한다.
- AC2: root manifest version 1곳과 lockfile 2곳을 정확한 0.129.1로 확인하고 CHANGELOG/old OCI/Tag 변경 부재를 비교한다.
- AC3: Work Packet/document sync 문서별 UPDATED 또는 N/A 근거, TEST_PLAN 및 PLAN/원장 업데이트와 AC↔테스트를 검증한다.
- AC4: 새 #767 exact Head Full Quality/E2E6/Docker/Trusted QA source/attempt, 미해결 리뷰0, 최신 main strict를 원격 검증한다.
- AC5: Owner HIGH 위험 수용 후 정상 two-parent merge commit 표준 한글 제목/빈 본문/expected head/원격 Main CI 시작을 확인한다.
- AC6: Main CI exact candidate digest/SBOM/provenance와 별도 scoped v0.129.1 release 승인 전 tag/OCI mutation 금지를 검증한다.
- AC7: 원본 PR #764 미병합 close 및 새 PR #768 링크/이력 보존, #736/#765 Closed 불변을 확인한다.
