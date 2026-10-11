# Issue #614 — F0 Target 도메인·집계·이관 계약

Refs [#614](https://github.com/planner77/masterGantt/issues/614), 상위 [#613](https://github.com/planner77/masterGantt/issues/613). 계약 [LOGISTICS_TARGETS](../../LOGISTICS_TARGETS.md), 전체 단계 [TARGET_RESOURCE_ROLLOUT](TARGET_RESOURCE_ROLLOUT.md).

## 범위·기준·실행 주체

- baseline_main_sha: `cbc73740236f3b3e177e2ed3196a0d02a292c741`
- application version: `0.104.4` 유지. 제품 runtime/의존성/DB/API 변경 없는 문서·test-only 계약 작업.
- work_branch: `docs/issue-614-target-resource-contract`
- 승인 종료점: 문서·공통 fixture·빠른 검증·사전 검토·PR 생성과 exact-head PR CI 시작. CI 모니터링·병합·main/GHCR·tag/release·branch cleanup·Issue 종료 비범위.
- release_required: false / release_authorized: false
- risk_level: MEDIUM / qa_method: OWNER_MANAGED / qa_required: true
- risk_reason: 후속 DB/API/Resource/UI의 공통 계약 해석 위험. 현재 영속성·보호 정책·사용자 화면 동작은 변경하지 않음.
- Manager `/root`: 문서 전체·통합·Issue PLAN/STATUS·PR 작성 소유.
- backend `/root/domain_audit`: 현행 코드 대조, `tests/fixtures/logistics-targets.ts`와 `tests/domain/logistics-targets-contract.test.ts` 단독 작성.
- ui_ux `/root/ux_contract`: 문서·텍스트 wireframe/state matrix read-only 설계, 파일/GitHub 쓰기 없음.
- qa_docs: 최종 후보 read-only 독립 사전 검토. 독립 PRE_QA와 OWNER_MANAGED의 최종 병합 권한을 구분.
- issue_comment_writer: Manager. Sub-Agent Issue/PR 댓글 쓰기 없음.

현재 main·migration 파일 ledger0024·open PR을 재조회했다. 기존 #614 PR 없음, #609 Trusted QA T3 임시 Draft는 별개다. 기존 checkout의 untracked QA/browser 산출물을 건드리지 않도록 `/tmp/mastergantt-issue-614` worktree를 생성했다. CLI 조회401은 연결된 GitHub 도구로 복구했고 git fetch는 성공했다. 운영 DB·현재 원격 gate 성공을 새로 검증하지 않았다.

## AC ↔ 산출물·검증 매핑

| AC | 근거·검증 | 현재 경계 |
| --- | --- | --- |
| AC1 확정/기본안/비범위·identity/cardinality | LOGISTICS_TARGETS §1~3 ER/PK/FK/unique/삭제/revision, UI §7 | 문서 의미 검토; 실제 DDL NOT TESTED |
| AC2 whole/subset/self/subtree/legacy 정규화 | §4, F0-L 계열 golden input/output·provenance·순열/중복 | test-only oracle; 제품 Target 엔진 아님 |
| AC3 공정/WorkArea·15대/3식/5M/D·T0/A/R/null | §5~6/9, F0-P/Q/F/R 계열, 기존 calculateResourceKpi/Plan | 기존 엔진 수치 검산; 신규 API/Excel 통합 NOT TESTED |
| AC4 copy/Template/JSON/Resource/Gantt·migration/rollback | §7~8 코드 경로 추적·호환 표 | 코드 대조; migration/운영 restore NOT TESTED |
| AC5 공식 SVAR vs 설치2.7.3 | §10 공식 URL·설치 types/package 대조 | 문서/선언 확인, 실제 demo 조작 NOT TESTED |
| AC6 문서 우선순위·책임·active PLAN | §1, 실행 계획, 기존 물류 설계/지침/KPI 연결, Markdown link check | 문서 동기화·링크 검사 |

## Design Delta

분류 B: 기존 precise feedback/progressive disclosure/accessibility/canonical 및 Gantt 상태 보존 원칙의 국소 구체화다. ui_ux가 `ui-ux-pro-max`의 error summary/validation 지침을 검토했다. 채택은 구성 composer와 binding editor 분리, whole/subset과 self/subtree 독립 축, Resource projection→같은 Task/Assignment editor 진입·복귀다. master와 Task 편집을 하나의 저장으로 혼합하거나 grouping을 WBS Summary로 저장하지 않는다.

`DESIGN.md: N/A — 새 범용 원칙을 추가하지 않고 기존 시각 언어·상태 보존을 LOGISTICS_TARGETS §7에 구체화`. 브라우저 캡처·responsive·keyboard/focus·Gantt mount 실증은 F0 비범위이며 #618/#621의 NOT TESTED다.

## DOCUMENTATION_SYNC

- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/exec-plans/active/TARGET_RESOURCE_ROLLOUT.md`: UPDATED
- `docs/exec-plans/active/ISSUE_614.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: UPDATED
- `docs/LOGISTICS_IMPLEMENTATION_GUIDELINES.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(기존 원칙의 화면 계약 구체화이며 새 범용 시각·탐색 원칙 채택 없음)
- `docs/API.md`: N/A(F0 제안 계약만 기록하며 현재 route·DTO·server 구현 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(신규 논리 ER만 기록하며 실제 DDL·migration·운영 데이터 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Resource 계산기를 test에서 재사용하며 일정 알고리즘 변경 없음)

| 문서 | 조치·근거 |
| --- | --- |
| LOGISTICS_TARGETS / TARGET_RESOURCE_ROLLOUT / ISSUE_614 | 신규 계약·실행 순서·증거·AC mapping |
| active PLAN | #614 현재 범위·상태·선행·요청 종료점 연결 |
| LOGISTICS_DOMAIN_DESIGN / LOGISTICS_IMPLEMENTATION_GUIDELINES | 오래된 계획과 현행 DTO 우선순위, 새 Target 계약/fixture/후속 책임 연결 |
| RESOURCE_KPI_DASHBOARD | 새 Target 지표·T0/A/R·중첩·same-binding·exact scope 계약 연결 |
| TEST_PLAN / CHANGELOG | test-only 검산·후속 환경/통합 NOT TESTED 및 version 유지 |
| REQUIREMENTS/ARCHITECTURE/API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE | N/A: 현재 제품 요구 구현·경로·공개 DTO·DDL·인증·일정 알고리즘 불변. 미래 제안을 현행 목록에 등록하지 않음 |
| TASK_EDITOR/PROJECT_UX/UI_UX_GUIDELINES/DESIGN | N/A: 실제 화면/interaction 변경 없음. 후속 wireframe·state matrix는 신규 계약 문서에 고정 |
| EXCEL_EXPORT/IMPORT_SCHEMA/IMPORT_EXPORT/JSON schema/copy docs | N/A: 현행 포맷/코드 불변. 확장 책임·silent loss guard·무손실 경계는 계약 §8에 기록 |
| CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS/AGENTS/QA_REVIEW_POLICY | N/A: CI/권한/정책 불변. 기존 검증·Owner 승인 경계를 준수 |

## AC_TEST_COVERAGE

- AC1: LOGISTICS_TARGETS §1~3, ER/identity/cardinality/기본안·비범위의 코드 대조와 독립 문서 의미 검토. 실제 신규 DDL은 후속 NOT TESTED.
- AC2: tests/domain/logistics-targets-contract.test.ts F0-L01~L20의 whole/subset/self/subtree/legacy 직접·조상 혼합·명시 재매핑·정렬 출처·중복/순열 golden 검산.
- AC3: 같은 테스트의 F0-P01~P13/Q01~Q02/F01~F12/R01~R11. 15대/3식/A5 B5 전체5, same-binding, T0/A/R·null·M/M·80/140 기대값.
- AC4: LOGISTICS_TARGETS §7~8 및 기존 project-copy/template/import/migration 경로 대조, 호환·rollback 표. 신규 통합 API/Excel/복구는 NOT TESTED.
- AC5: LOGISTICS_TARGETS §10 공식 SVAR URL/설치2.7.3 package·types 대조, filter-tasks 확인. 실제 demo 조작은 NOT TESTED.
- AC6: 물류 설계·지침·Resource KPI·active PLAN·Epic 하위 실행계획 연결과 node scripts/check-markdown-links.mjs 검증.

## 검증 원장

초기 worktree 의존성 없음으로 첫 Vitest 모듈 해석 실패(제품 FAIL 아님)를 보존한다. ignored node_modules를 기존 설치에 연결해 빠른 검증을 수행하며 frozen install/공식 전체 회귀는 PR CI가 담당한다. 원시 합성 ID는 사람이 읽는 fixture 별칭이며 HTTP UUID adapter는 후속 이슈가 제공한다.

최종 로컬 실행과 독립 사전 검토는 아래에 기록한다. quality/e2e/docker·QA_FINAL·Trusted·Manager ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED. 요청 범위의 PR CI 시작을 전체 Lifecycle 완료로 보고하지 않는다.

### 2026-10-12 Local Fast Feedback

| 실행 | 결과·범위 |
| --- | --- |
| `npm test -- tests/domain/logistics-targets-contract.test.ts` | 최종53/53 PASS, Vitest1파일. 초기36·중간44는 이전 후보이며 합산해 최종 실행 수로 보고하지 않음 |
| `npx eslint tests/fixtures/logistics-targets.ts tests/domain/logistics-targets-contract.test.ts` | 변경2파일 PASS |
| `npm run typecheck` | PASS, 신규 test-only 타입을 포함한 정적 검사 |
| `node scripts/check-markdown-links.mjs` |183 Markdown 파일 링크 PASS |
| `node scripts/verify-release-version.mjs` | 기존 v0.104.4 stable 일치 PASS |
| 기존 `qa_final_automated.docs_gate` 로컬 구조 검사 | DOCUMENTATION_SYNC/AC1~AC6 mapping 구조 PASS; 원격 Trusted/의미 QA 성공 아님 |
| `git diff --check` | PASS |

기존 Vite config loader 경고는 그대로 보존했으며 test 실패는 아니다. typecheck/lint·fixture 결과를 전체 회귀/신규 runtime 구현 PASS로 확대하지 않는다.

Fixture 작성 중 중괄호 누락으로 한 번 파싱 실패했으며 수정 뒤 최종53개를 재실행했다. M/M 미설정 case의 초기 assertion은 명시 null의 `source=query`와 기준 생략의 `source=unset`을 혼동해 실패했고 입력을 실제 기준 생략 사례로 바로잡았다. 제품 계산기나 assertion gate를 완화하지 않았다.

### 독립 PRE_QA 보완 이력

Reviewer `/root/f0_pre_qa`가 초기44개 후보에서 P2 두 건을 확인했다: legacy 조상 subtree+직접 Target 혼합 검산 부재, 삭제 subset의 명시 재매핑 positive case 부재. 이를 F0-L16~L20과 F0-F09~F12로 보강했다. subset 복구는 동일 binding의 명시 member 교체이며 whole 자동 확대가 아니다. 추가로 논리 ER의 복합FK 부모 unique key·Service 다중행 제약, CHANGELOG 위치, session/network 상태 표를 정밀화했다. 최초 지적을 최종 PASS로 소급하지 않는다.

최종53개 후보의 독립 재검토는 PR CI 시작용 PRE_QA다. OWNER_MANAGED의 자동 구조 검증·Owner 병합 허가·QA_FINAL·전체 CI 판정과 구분한다.

Reviewer `/root/f0_pre_qa`의 최종 PRE_QA는 PASS(PR CI 시작 범위), 미해결 material finding0이다. Reviewer가 대상53/53·Markdown links183·diff check를 직접 실행했다. 검토 snapshot11파일 SHA256은 `5f749537dcd0bde8a1b58c87f554f2a3e080b91cb2cbeb81910d9b5c75baea3f`이며 이 영수증과 실행 실패 원장 보충 전의 문서 상태를 가리킨다. 최종 테스트 SHA256 `e9c0f17630cd756c87d7fb787a10cb383cf4903a38e7aa26ad8da8e1a6d0b73d`, fixture SHA256 `5ce37600a6bd8cf5dd8b3a2b39f43ace3aef42bfbc77461c5dcfdd14e9a5dc56`은 보존한다. 이 기록은 원격 CI·QA_FINAL·Owner 허가·Manager ACCEPT를 의미하지 않는다.

### 2026-10-12 PR #625 Codex P2 후속 보완 — 신규 Head 검증 대기

- 리뷰1 [P2](https://github.com/planner77/masterGantt/pull/625#discussion_r4242062812): `site_product_processes`의 occurrence identity·unique·FK에 #538의 `businessUnitId`를 포함. 프로젝트 triple 매핑과 WorkArea 경계, 제품 표준의 productId 공유를 문서에 명시한다.
- 리뷰2 [P2](https://github.com/planner77/masterGantt/pull/625#discussion_r4242062815): 동일 SITE-A의 다른 PRODUCT-Q(F0-P09), 동일 site/product지만 다른 BU(F0-P10), 다른 BU의 올바른 triple(F0-P11), triple+unique(F0-P12), 관계 미연결 project triple(F0-P13)을 추가한다. Oracle의 제품 하드코딩을 없애고 세 FK 문맥을 모두 비교한다.
- 이전 53/53 PASS는 첫 PR Head `b23d54a`에만 유효하다. 이번 변경의 예상 Vitest 수는 **58건**이며 새 Head에서의 lint/typecheck/Vitest/전체 CI 성공은 실행 결과가 나올 때까지 **NOT TESTED**다. F0 test-only 계약은 실제 DB/API/운영 통합 검증이 아니다.
- 사용자가 요청한 종료점: 보완 commit 반영 → 신규 exact-head PR CI **시작**, 완료·병합·GHCR·Issue 종료는 후속 별도 판단.
