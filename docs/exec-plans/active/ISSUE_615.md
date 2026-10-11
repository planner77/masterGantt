# Issue #615 — F1 공정 catalog·제품 표준·WorkArea

Refs [#615](https://github.com/planner77/masterGantt/issues/615), 상위 [#613](https://github.com/planner77/masterGantt/issues/613), 선행 [#614](https://github.com/planner77/masterGantt/issues/614), 기존 triple [#538](https://github.com/planner77/masterGantt/issues/538). 계약 [LOGISTICS_TARGETS](../../LOGISTICS_TARGETS.md), 단계 [TARGET_RESOURCE_ROLLOUT](TARGET_RESOURCE_ROLLOUT.md).

## 범위·실행 주체

- baseline_main_sha: `9f17dbb2ad6814d952aef4fb1b6eaea721fb6794` (#614 PR #625 병합 포함)
- work_branch: `feat/issue-615-process-catalog`; 격리 worktree `/tmp/mastergantt-issue-615`
- application_version: 0.105.0 → 0.106.0; 신규 영속 모델/API MINOR, 의존성 변경 없음
- release_required: true / release_authorized: false
- risk_level: HIGH / qa_method: OWNER_MANAGED / qa_required: true
- risk_reason: migration·공통 admin와 Project edit 권한·두 revision·여러 aggregate 참조/복사에서 원자성 및 손실 위험
- Manager `/root`: 계약 결정·통합·모든 문서·version/CHANGELOG·Issue PLAN/STATUS 소유
- backend `/root/domain_audit`: 신규 process-catalog contract/migration0025/repository/service와 domain·migration tests
- backend `/root/f1_http`: 신규 handlers/routes·HTTP tests, 기존 metadata/template/copy handler의409 변환만 소유
- backend `/root/f1_integration`: 기존 ProjectMaster service/repository·ProjectCopy·ProjectTemplate·LogisticsService·compatibility test·DB ledger assertion 소유
- qa_docs `/root/f0_pre_qa`: 구현과 분리된 read-only PRE_QA, 파일/GitHub 쓰기 없음
- infra `/root/publish_pr`: 동결 후 commit/push·PR 생성과 exact-head CI 시작 확인만; issue_comment_writer: Manager

승인 종료점은 구현·관련 문서·빠른 검증·사전 검토 후 PR CI 시작이다. 완료 모니터링·Owner ACCEPT·병합·main/GHCR·tag/release·branch cleanup·Issue 종료는 포함하지 않는다. #614 계약 main 반영과 #614 Issue 전체/운영 artifact 완료를 구분한다. 기존 checkout/untracked 자료는 보존한다. CLI 자격증명 문제는 연결된 GitHub를 사용하며 민감한 값을 기록하지 않는다.

## 구현 계약·결정

제품 표준은 product ID에 공유, occurrence는 BU/product/site exact 유효 triple이다. WorkArea는 occurrence 하나에 소속하고0..N, 선택 null을 허용한다. Process Type code는 immutable, owner code duplicate는409, 같은 label 다른 ID는 허용한다. 참조 중 삭제/부모 변경을 보호하고 비활성 기존 참조는 보존하되 신규 참조를 거절한다.

Catalog revision과 Project revision은 별개이며 body 대기 이후 transaction에서 권한/revision을 재검사한다. Project mapping 성공 응답은 canonical Project/logistics·매핑·revision이다. 실제 변경당 revision1, no-op0. 표준 diff는 읽기 전용; 명시 apply는 occurrence missing/name/sortOrder만 반영하고 Project 자유 공정을 자동 생성·삭제하지 않는다. Project 선택 변경은 참조가 있으면409로 전체 rollback, 명시 unmap 후 변경/remap한다.

Copy는 local 공정 ID만 새로 치환하고 common occurrence/WorkArea ID(비활성 포함)를 보존한다. Template 포맷은 F1에서 확장하지 않으며 mapped source 저장을409로 차단한다. 미매핑 legacy는 기존대로 유지한다. 기존 WBS JSON/Excel은 새 common 참조 full backup 포맷이 아니다. 신규 Target/member/binding·관리 화면은 후속이다.

F1 context는 exact triple의 bounded DTO와 projectMasterRevision/Project/catalog revision·selection/selectionValid를 같은 SQLite read transaction에서 제공한다. 불완전·무효 legacy triple은 빈 후보이며 매핑을 이름으로 추론하지 않는다. 항목별 N+1 없이 고정 SQL과 owner/triple index를 사용한다. Entity별200개 상한 초과422는 truncation 없이 전체 실패이며 mutation도 rollback한다. 이 규모 경계는 후속 scoped 관리/페이지네이션이 필요하다.

## Design Delta

D: 화면/interaction/시각 언어 변경 없음. DESIGN.md의 domain/security 우선·canonical 보존 원칙을 적용하며 새 범용 UX 원칙은 채택하지 않는다. UI_UX_GUIDELINES 및 F0의 SVAR 자료/설치 Core2.7.3 경계를 확인했다. SVAR API·PRO·Gantt mount·viewport 변경 없음; 새 demo 조작/캡처/반응형 검증 N/A.

## DOCUMENTATION_SYNC

- `docs/API.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: UPDATED
- `docs/LOGISTICS_IMPLEMENTATION_GUIDELINES.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/ISSUE_27_PROJECT_COPY.md`: UPDATED
- `docs/IMPORT_EXPORT.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/TARGET_RESOURCE_ROLLOUT.md`: UPDATED
- `docs/exec-plans/active/ISSUE_615.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(화면 및 범용 시각 원칙 변경 없고 기존 domain/security 우선 원칙 적용)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정/Resource 계산 알고리즘과 calendar 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(현행 JSON Import schema와 WBS 입력 계약 확장 없음)
- `docs/EXCEL_EXPORT.md`: N/A(Excel formatter와 export scope 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(신규 화면 및 interaction 변경 없음)
- `docs/CI_CD.md`: N/A(워크플로와 배포 정책 변경 없음, 기존 MINOR/version/release 승인 정책 준수)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 gate 변경 없이 PR 시작에서 중단)
- `AGENTS.md`: N/A(역할 및 실행 지침 변경 없이 기존 Lifecycle과 Owner-managed 정책 준수)
- `docs/QA_REVIEW_POLICY.md`: N/A(보안 문서에 신규 API 권한 적용을 기록하지만 QA 신뢰 및 승인 정책 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(GitHub 권한 및 Ruleset 운영 계약 변경 없음)

## AC_TEST_COVERAGE

- AC1: process-catalog service SQLite tests, 제품 표준 공유·사업장별 적용/추가 비전파·BU exact triple·명시 표준 apply 검증.
- AC2: 같은 suite와 HTTP tests, 선택 WorkArea null/0..N·타 occurrence WorkArea 거부·transaction rollback 검증.
- AC3: service/HTTP tests, 중복 code409·동명 다른 ID·inactive 기존/신규·usage/delete/reparent·standard diff/apply 검증.
- AC4: migration tests 및 process-catalog-compatibility.test.ts, 0024 upgrade/fresh/restart·legacy hierarchy/설비·copy global ID 보존·Template409 검증.
- AC5: process-catalog-handlers.test.ts와 service/compatibility tests, 실제 SQLite Request/Response401403409412·지연 body 세션/revision·전체 rollback·revision1/no-op0 검증.
- AC6: service tests의 scope/overflow/query-plan·고정 query 관측과 context selection/revision snapshot·foreign triple 비노출 검증.
- AC7: required docs 실제 diff·독립 의미 검토·Markdown links·docs_gate 구조 검사 및 version 일치 검증.

## 검증 원장·잔여 위험

node_modules는 기존 설치를 ignored symlink로 연결한 Local Fast Feedback이다. frozen install·전체 Vitest/Chromium6/Docker는 공식 PR CI가 담당한다. 로컬 PASS를 전체 회귀로 확대하지 않는다. 실제 운영 migration/backup restore/TLS/Windows Excel은 NOT TESTED다.

초기 compatibility fixture의 AMR code 대소문자 FK와 Template 응답 필드 타입 오류를 바로잡았다. HTTP duplicate code는 처음500이었고 안전한409 변환으로 수정했다. 독립 QA의 route inventory 검사에서는 신규17개 method 누락으로1 FAIL/2 PASS가 발생해 inventory 및 명시 expected/policy 검증을 보강했다. 최초 오류를 숨기지 않으며 수정 후 동일 관련 검사를 다시 실행한다. 최초 docs_gate 구조 실행은 SECURITY.md 영향에 따른 QA 문서별 N/A 기록 누락으로 BLOCKED였고 정책/승인/운영 불변 근거를 명시해 보완한다. 최종 실행·독립 PRE_QA 증거는 아래에 추가한다.

quality/e2e/docker: NOT TESTED. trusted_qa/qa_final/manager_decision: NOT TESTED. MERGE_READY: BLOCKED. release_authorized: false. Issue OPEN 유지, 작업 branch 유지. 후보 코드/문서의 사전 검토와 최종 Owner 승인·원격 gate를 혼동하지 않는다.

### 최종 Local Fast Feedback — 2026-10-12

| 실행 | 결과·정확 범위 |
| --- | --- |
| 관련 Vitest 통합 실행 | 14파일162/162 PASS: process-catalog3·DB·copy/membership·ProjectMaster·Template/membership·Logistics·Project/Template handlers·route inventory |
| 전용 domain/migration suite | 최종19/19 PASS, AC2 조립 A/B·검사 구역0/null·타 구역 거절 및 retired diff 보강 포함. 이전17은 중간 후보 |
| `npm run typecheck` | 최종 후보 PASS |
| 변경 TypeScript 전체 ESLint | 변경 TypeScript/TSX 전체 PASS |
| `npm run version:check` | package/lock v0.106.0 일치 PASS; 정식 tag/release 게시 성공을 뜻하지 않음 |
| `node scripts/check-markdown-links.mjs` |185 Markdown 파일 링크 PASS |
| 기존 `qa_final_automated.docs_gate` 로컬 실행 | required docs·AC1~AC7 구조 PASS, 의미 검토·Trusted 원격 PASS 아님 |
| `git diff --check` | PASS |

context 조회의 실제 `prepare` 호출은 occurrence1개와31개에서 각각15회다. `EXPLAIN QUERY PLAN`은 `SEARCH site_product_processes USING INDEX sqlite_autoindex_site_product_processes_3 (business_unit_id=? AND product_id=? AND site_entity_id=?)`를 확인했다. 이는 SQLite 합성 fixture 관측이며 production 대규모 latency 측정은 아니다. migration24→25·foreign_key_check·SQLite close/reopen 영속성·실패 전체 rollback을 실행했으며 운영 프로세스/DB restore 검증은 NOT TESTED다.

독립 QA 요청으로 AC2 직접 fixture와 retired standard diff의 read-only/명시 실패·inactive occurrence 보존 검산을 추가했다. Vite configLoader 경고는 보존했으며 test 실패가 아니다. 수정한 오류/중간 후보의 실행 수를 최종162에 합산하지 않는다.

### 독립 PRE_QA 영수증

Reviewer `/root/f0_pre_qa`가 구현 주체와 분리되어 AC1~AC7·diff·실제 assertion·문서 의미를 읽기 전용으로 검토했다. PR CI 시작 범위 PRE_QA PASS, 미해결 material finding0. 직접5suite77/77(domain19/HTTP9/compat7/DB25/inventory17), 쿼리·EXPLAIN 집중1, Markdown185/diff check PASS다. root의14파일162/162와 중복되는 실행이며 합산하지 않는다.

기준 HEAD `9f17dbb2ad6814d952aef4fb1b6eaea721fb6794`의 미커밋 후보를 검토했다. 영수증 삽입 전 정렬된 변경·신규 경로의 `path NUL SHA256 LF` 지문은 전체50파일 `e854bb26db7cf43c5d10e57f41d6cde8de403dac9d73cbdb37d67534966b7292`, production28파일 `a10c943872aa6ebb3af9a3a0edfc39b69aa904b6ce0c599c050a5c783cf969e2`, tests5파일 `8772353395a0111a41666c284264cc4127f73679d6dade61cd844a6c23acf088`이다. 이 영수증 문서 추가 뒤 production/tests는 변경하지 않는다. 최초 inventory FAIL·duplicate500·활성 경로 표시·AC 사례 보강 이력은 유지한다.

DOCUMENTATION_SYNC: PASS(관련 계약 의미 검토 포함). QA_FINAL/Trusted/quality/e2e/docker/Owner Manager ACCEPT: NOT TESTED. 독립 PRE_QA를 Owner-managed 병합 허가로 사용하지 않는다. 요청 종료점 이후의 병합·운영 적용·release·Issue 종료는 별도다.

### CI #2520.1 실패 후 보완 — 2026-10-12

- PR #627, 원본 HEAD `1c9dcf67cb02fb3a3b8f14ba62bd3529a9a9fa99`, [PR CI #2520.1](https://github.com/planner77/masterGantt/actions/runs/38178153973): 전체 Vitest 2103 PASS / 1 FAIL / 3 SKIP. 실패는 `tests/server/migration-cli.test.ts`가 migration 0024까지만 예상한 고정 적용 목록/24행 단언으로, 새 `0025_process_catalog.sql`을 포함한 실제 25행과 불일치한 테스트 fixture 누락이다. DB migration 자체 실패나 E2E 실패가 아니다.
- TypeScript, ESLint, Next build, Chromium 6/6, Docker smoke PASS. quality aggregator는 Vitest 실패로 FAIL, QA Final — Automated는 required quality 미성공으로 종속 FAIL이다.
- 수정: migration CLI 고정 목록에 0025와 25행 기대값을 반영하고 초기 `process_catalog_state`/빈 type catalog/FK 무결성 단언을 추가했다. 리뷰 P2로 지적된 `ProcessContextResponse.data.permission`의 `"readonly" | "edit"` 타입 누락을 보완하고 타입 계약 검증·readonly/edit HTTP 회귀·API 문서를 동기화했다.
- 기존 로컬 PRE_QA 영수증은 원본 HEAD의 이력으로 보존한다. 새 HEAD의 전체 quality/e2e/docker, Trusted QA, QA Final 및 Owner ACCEPT는 새 CI 실행 전에는 NOT TESTED이며, 새 실행 결과로만 재판정한다. 범위 외 병합·GHCR·릴리스·Issue 종료는 진행하지 않는다.
