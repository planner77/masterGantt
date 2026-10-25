# Issue #808 — Resource 분석용 단일 원장 read model

## Issue Work Packet

- repository: `planner77/masterGantt`
- issue: [#808](https://github.com/planner77/masterGantt/issues/808); parent [#806](https://github.com/planner77/masterGantt/issues/806), 선행 [#807/PR #810](https://github.com/planner77/masterGantt/pull/810), 소비 후속 [#809](https://github.com/planner77/masterGantt/issues/809)
- lifecycle_phase: LOCAL_PRE_QA_PASS / PR_CI_START_READY
- requested_scope: 분석·설계·구현·문서 갱신·리뷰/충돌 확인 및 해결·실패 원장 기록 후 Ready PR Full CI 시작. CI 결과 모니터링·병합·Main/GHCR·정식 Release·Finalizer·브랜치 삭제·Issue 종료는 제외한다.
- baseline/main: `048ae92ff673f1d0c4c69171fe3cc9bffe25dc19`
- branch/worktree: `feat/issue-808-resource-analysis`, `/home/planner/Dev/masterGantt-808`
- current_version: `0.133.4`; candidate_version: `0.134.0`
- version_decision: 차트 소비자를 위한 새로운 typed 분석 기능을 추가하므로 MINOR. package/lock의 version만 동기화하고 의존성은 변경하지 않는다.
- release_required: true
- release_authorized: false (정식 GHCR 게시 요청 없음)
- risk_level: HIGH
- risk_reason: 개인 공수·Capacity·다중분류·정확 Task/Assignment 범위 및 stale 판정의 신규 소비 계약과 version 보호 경로
- qa_required: true
- qa_method: OWNER_MANAGED
- independent_qa: N/A(최종 경로는 Owner-managed); 별도 qa_docs 사전 검토는 최종 Trusted/Owner 승인과 구분한다.
- manager_decision: NOT TESTED; MERGE_READY: BLOCKED
- issue_comment_writer: manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION

## 역할·소유권

| 담당 | 소유 파일 / 역할 |
| --- | --- |
| Manager `/root` | 문서·Work Packet·실패 원장·version·통합·Issue 진행 기록 |
| backend `/root/analysis_adapter` | 새 `src/domain/resources/resource-analysis*.ts`, `src/contracts/resource-analysis*.ts`, `tests/domain/resource-analysis*.test.ts` 구현 및 관련 LFF |
| explorer `/root/source_inventory` | 기존 집계·selector·테스트 read-only 인벤토리 |
| infra `/root/publication` | 기존 PR/CI·리뷰/충돌 출처 조회, 동결 후 tree/parent 검증·Ready PR·CI 시작 확인 |
| qa_docs `/root/analysis_qa` | 실제 별도 읽기 전용 사전 검토; 아래 동일 source SHA·19tests·5개 원본 재현·문서 의미 검토 PASS |

동일 파일 동시 작성·타인 변경 되돌리기·재귀 위임 금지. 원 작업 디렉터리의 미추적 자료는 별도 worktree로 보존했다. 실제 역할 실행과 설정 모델 이름의 존재를 구분하며 runtime 모델 검증을 주장하지 않는다.

## 설계·경계

기존 `resolveWbsTaskLedger` / `selectWbsTaskLedger` / `summarizeWbsTaskLedger`를 집계 authority로 유지한다. 새 typed adapter는 canonical 원장과 명시 scope/provenance를 받고 선택·분석 축·순위·정확 상세·기존 Resource Plan series를 제공한다. Group/Role/Milestone/실물 중첩 소계를 합산해 전체를 만들지 않는다. 개발등급은 같은 Resource의 기존 metadata/필터를 재사용한다.

같은 축 OR/다른 축 AND, Task distinct·Assignment distinct·resource-day Capacity, 상태 분자/분모, T0/A/R, 원본 전체 Milestone Gate와 개인 기여의 차이를 유지한다. 미배정·등록-only·역할-only에 허위 개인 Assignment/Capacity를 만들지 않는다. Plan은 기존 `selectWbsTaskLedgerPlanScope` 및 `calculateResourcePlan`의 동일 개인 Project 전체 참조·Calendar·ISO주/월·clip·peak·과투입·null/partial 규칙을 사용한다.

WBS report와 legacy Resource report는 원본이 같아도 서로 다른 snapshot identity다. 새 모델은 이를 cast하거나 독립 fetch 결과를 임의 병합하지 않는다. `source.filters`와 원장 필터는 같아야 하고 좁힌 path/scope/system spec에는 동일 인증 거래의 projection selected Task/Assignment IDs·narrowed taskRows·개인 조건을 적용하지 않는 별도 diagnosticTaskIds(T0)인 `sourceScope`가 필수다. 이는 호출자가 검증한 선언이며 모델 자체가 DB snapshot 해시·접근 권한을 독립 인증하지 않는다. 소비자는 source와 query/pivot/granularity/unit을 결속한 scopeKey를 함께 확인한다. 서버 canonical read snapshot에서 호출하는 순수 adapter이며 HTTP route/DB/추가 persistence/SQL/materialized view를 만들지 않는다. #809의 렌더링·활성 fetch/드릴 UI 연동은 후속이며 #807의 화면 shell을 수정하지 않는다. 사용자 Target 축/필터를 추가하지 않는다.

## AC_TEST_COVERAGE

- AC1: R2-AC1. RESOURCE_KPI_DASHBOARD의 KEEP/EXTEND/N/A 인벤토리·source ID/filter/지원 view·기존 원장 재사용 및 저장소 N/A 판단.
- AC2: R2-AC2. 동일 원장·필터·범위·snapshot에서 기존 ledger/Plan selector와 새 read model의 canonical Task/Assignment/Resource ID·raw M/D/M/M·Task 수 비교. 기존 서버 report↔Excel golden은 고유 경계로 재사용한다.
- AC3: R2-AC3. 다중 공정/WorkArea/Milestone shared5·공동담당50%7.5, 등록-only/역할-only/미배정0 및 비가산 합집합.
- AC4: R2-AC4. 선택80/동일 개인 Project140, peak/초과·Group 개인합·주월 clip·연말 ISO·0 Capacity/null·partial/unset/configured0·M/M 미설정·invalid/empty의 기존 의미.
- AC5: R2-AC5. 개인/Group/Role/grade/Milestone/실물 OR/AND·unknown ID/동명·snapshot/source/revision/generation 역전·조건 해제·current/project. HTTP401/403/412는 새 route 없이 기존 서버 보안 테스트를 KEEP_UNIQUE하며 순수 모델 PASS로 HTTP 실행을 주장하지 않는다.
- AC6: R2-AC6. TEST_LIFECYCLE_REVIEW 및 지표 사전·TEST_PLAN·Excel/architecture 계약과 필요한 N/A 동기화. 기존 CI gate/테스트 삭제·skip·assertion 완화 없음.

## TEST_LIFECYCLE_REVIEW

기존 #523~#530/#619~#623/#728~#736 테스트의 producer/consumer를 탐색한다. `tests/domain/wbs-task-ledger.test.ts`, `wbs-task-ledger-acceptance.test.ts`, `resource-kpi.test.ts`, `resource-plan*.test.ts`, 기존 server ResourceDashboard/WbsView/Excel/Plan 및 feature fetch model/E2E의 scope·권한·generation 경계를 구분한다.

ADD: 새 분석 adapter의 결속·분석 축·read-only 데이터 선택 계약만 검증. KEEP_UNIQUE: 기존 원장 산식·HTTP/SQLite/권한·Excel OOXML·UI fetch/복귀와 browser 검증. 신규 full E2E 중복 작성·기존 테스트 삭제/통합·CI 완화 없음. 최종 명령·case 수·실행 범위는 실제 실행 뒤 아래에 갱신한다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_808.md`: UPDATED
- `docs/evidence/issue-808/local-validation.json`: UPDATED
- `docs/ISSUE_808_FAILURE_ANALYSIS.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/EXCEL_EXPORT.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED

- `docs/API.md`: N/A(기존 HTTP route/요청·응답/공개 API·version 헤더를 변경하지 않는 내부 typed read model)
- `docs/DB_SCHEMA.md`: N/A(DDL/migration/persistence 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Calendar·Plan·공수·Gate 계산 재사용, 일정 알고리즘 변경 없음)
- `docs/SECURITY.md`: N/A(서버 session/Origin/revision/private-read 권한 불변; 새 모델은 권한 수단이 아님)
- `docs/REQUIREMENTS.md`: N/A(기존 Resource 분석 요구의 재사용 adapter, 새 사용자 화면·업무 엔터티 없음)
- `DESIGN.md`: N/A(화면·interaction·지표 기본 표시를 변경하지 않음; 실제 chart UI는 #809)
- `docs/UI_UX_GUIDELINES.md`: N/A(화면·interaction·지표 기본 표시를 변경하지 않음; 실제 chart UI는 #809)
- `docs/PROJECT_UX.md`: N/A(화면·interaction·지표 기본 표시를 변경하지 않음; 실제 chart UI는 #809)
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: N/A(화면·interaction·지표 기본 표시를 변경하지 않음; 실제 chart UI는 #809)
- `docs/IMPORT_SCHEMA.md`: N/A(파일 교환 writer/공개 입력 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(파일 교환 writer/공개 입력 변경 없음)
- `docs/CI_CD.md`: N/A(현행 정책 적용, workflow/Required3/8-shard·권한·승인 기준 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(현행 정책 적용, workflow/Required3/8-shard·권한·승인 기준 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(현행 정책 적용, workflow/Required3/8-shard·권한·승인 기준 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(현행 정책 적용, workflow/Required3/8-shard·권한·승인 기준 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(현행 정책 적용, workflow/Required3/8-shard·권한·승인 기준 변경 없음)

## 검증·현재 상태

구현/관련 LFF·별도 LOCAL_PRE_QA: PASS(아래 동일 source 증거). 원격 quality/e2e/docker·Trusted QA·Manager ACCEPT: NOT TESTED. 초기 GitHub CLI401 및 실제 후속 실패·충돌/리뷰 점검은 [누적 실패 원장](../../ISSUE_808_FAILURE_ANALYSIS.md)에 기록한다. 실제 Windows Excel/DRM·운영 proxy/TLS·수동 UX는 별도 NOT TESTED이며 새 Domain 테스트로 대체하지 않는다.

## 최종 Local Fast Feedback·독립 사전 검토

[실행 증거](../../evidence/issue-808/local-validation.json)의 최종3파일 SHA256은 contracts `b30753dcbe05af762c3b616346fccb91fb84925c09af44d71274e3907199d697`, Domain `e78ee7e8b7c59793896350e6dcda19d80c613aace0d4746a29bf6cf3ef25c0ef`, test `f76b177830ab8b54cd46eaf23c28e7dbf011065efab6ba425a7dccb322d5d821`다. backend 동결·Manager 직접 재검증·별도 qa_docs 검토 전후 모두 동일하다.

- 직접 adapter: `npx vitest run --config tests/config/vitest.config.ts tests/domain/resource-analysis.test.ts --reporter=json --outputFile=/tmp/issue-808-validation/direct-final.json` →19/19 PASS, failed0/skipped0/exit0. 이전12/16/18case는 보완 전 범위이며 더하지 않는다. 로컬은 기존 node_modules symlink의 Node22.14.0/Vitest5.0.0/Next16.3.4를 사용했다. 선언된 Next16.4.2의 frozen npm ci/build/Chromium은 원격 Full CI에서 검증하며 이 pure Domain 변경에 Next API 사용/수정은 없다.
- 인접 원장/Plan·SQLite/HTTP·OOXML/feature 모델: 실패 원장5절의 기존11파일152/152 PASS, failed0/skipped0. 해당 source·테스트·fixture는 이번 diff에서 변경되지 않고 새 adapter를 import하지 않아 영향 분석으로 재사용한다. 두 범위의 고유 합은12파일171tests이며 원격 전체 회귀 수가 아니다.
- 정적: `npm run typecheck`, 신규3파일 `npx eslint ...`, `node scripts/verify-release-version.mjs`, `node scripts/check-markdown-links.mjs`, `git diff --check` PASS. Markdown343문서. 기존 Vite configLoader 안내 warning은 별도이며 test failure가 아니다.
- 독립 LOCAL_PRE_QA: `/root/analysis_qa`의 같은 SHA 직접19/19 PASS(22:20:32KST,525ms), 원본 재현5건(totalE10·pivotE10detail·G1 Plan·R1 T0진단6/미배정2·8,555,787byte fixture 한도 거부) PASS. 알려진 P1/P2 교정 확인·새 코드 지적0·문서 의미 검토 PASS. 실제 독립 인간 GitHub APPROVED나 QA_FINAL/Manager ACCEPT로 전용하지 않는다.
- 테스트 선정: source→새 pure adapter는 ADD. 기존 계산/Calendar·DB/권한·Excel·fetch 모델은 KEEP_UNIQUE. UI·HTTP route 변경0이라 실제 Chromium/새 browser 시나리오·전체 local production build/Docker는 NOT TESTED이며 원격 Full CI가 수행한다.

## 원격·리뷰/충돌 인계

infra 사전조회에서 #808 canonical PR0, 원격 브랜치없음, 과거 #808 CI 실패 관측없음. 선행 PR810의1개 리뷰 스레드는 해결 완료이며 #808로 이관된 미해결 지적없음. 열린8PR의 새 Domain/contract 직접 겹침없음; 기존 문서/버전 잠재겹침은 병합 충돌이 발생했다는 증거가 아니다. 게시 직전 최신 main과 정확 부모·원격 tree/bytes·새 PR의 실제 리뷰/mergeability를 확인한다.

게시 Head·PR/원본 CI Run ID/Attempt는 commit 자기참조를 피하기 위해 Issue808 STATUS와 PR 본문에 기록한다. 이 문서의 PR 시작 준비 판정은 원격 Required3/Trusted QA/Owner 승인 성공이 아니다. 요청대로 CI 시작 확인 후 모니터링하지 않으며 병합·Main/GHCR·release·cleanup·Issue 종료는 수행하지 않는다.
