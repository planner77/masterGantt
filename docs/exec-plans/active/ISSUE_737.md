# Issue #737 — Target0 다관점 종단 수용·보존

## Work Packet

- repository: planner77/masterGantt; issue: [#737](https://github.com/planner77/masterGantt/issues/737); parent: #723.
- baseline_sha: `56c7cfb96dbb97095e51606e9639cf4dc3fced36`; default branch: main; application: `0.130.0`.
- branch/worktree: `test/issue-737-target0-acceptance`, `/home/planner/Dev/masterGantt-issue-737`. 원래 worktree의 미추적 파일/다른 브랜치를 보존한다.
- phase: PR_READY; 요청 종료점: ready PR Full CI 시작. CI 모니터링·병합·main/GHCR·tag·release·Issue/Epic 종료·브랜치 삭제는 비범위.
- risk_level: HIGH; risk_reason: 다관점 raw ID·개인 공수·legacy/교환/복원·Gantt 보존을 가로지르는 수용. 제품 산식/저장/UI/권한은 변경하지 않는다.
- qa_required: true; qa_method: OWNER_MANAGED; independent_qa: N/A(독립 인간 QA 없음). qa_docs Agent의 실제 읽기 전용 사전 검토는 별도 기록하며 인간 영수증으로 취급하지 않는다.
- manager_decision: NOT TESTED; MERGE_READY: BLOCKED. 새 Head Required3·Trusted QA·리뷰 해결·Owner 위험 수용/명시 병합 허가 전 ACCEPT 금지.
- version_decision: `0.130.0` 유지. tests/docs·신규 spec 인벤토리 등록이며 runtime/dependency/schema/API 변화 없음. release_required=false; release_authorized=false.
- issue_comment_writer: manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION. Sub-Agent는 외부 댓글을 쓰지 않는다.

## 분석과 설계

선행 #724~#736은 착수 시 Closed이며 #736은 복구/퇴역·#767 승계 이력을 가진다. Closed를 모든 원본 CI/릴리스 성공으로 추론하지 않는다. 최신 #762 직접 Project 공정/WorkArea와 Template v5를 포함한 main에서 기존 기능을 재사용한다. [W1/W2 최종 사용자 결정](https://github.com/planner77/masterGantt/issues/723#issuecomment-6245422717)을 적용하며 #737의 오래된 NOT FINAL로 되돌리지 않는다.

새 계산기/화면/writer를 추가하지 않는다. DB→원시 oracle→기존 KPI·5root report/details/scope→Resource Excel의 경계와, 실제 Chromium 기준정보4탭→6관점→원본 편집1회→일정/출발 복귀를 결속한다. direct/target/mixed 합성 파일DB는 전체 table/identity/ledger·report를 backup→restore→2회 reopen에서 대조한다. Copy/지원 Template v5·old schema upgrade는 기존 실증 테스트를 새 source에서 실행/매핑한다. 기존 모든 상태×계층 순열×폭을 신규 중복 E2E로 만들지 않고 pure/contract+대표 cross-feature actual browser+기존 Full 회귀로 분담한다.

실제 지원·미지원과 AC1~7/WBS-01~07/보존표는 [통합 수용표](../../WBS_CROSS_FEATURE_ACCEPTANCE.md)가 단일 인덱스다. #720 `/manual` 제품과 #379 전체 JSON, off-host 운영 복원은 별도 후속이다.

## 실제 역할과 파일 소유권

| 역할 / 실행 Agent | 소유 / 반환 |
| --- | --- |
| Manager `/root` | Work Packet·문서·신규 preservation test·샤드 등록·통합·게시/PR/CI 시작 |
| explorer `acceptance_inventory` | read-only 기존 fixture/테스트/최신 계약 조사 |
| backend `integration_tests` | 신규 `tests/server/resources/issue-737-cross-feature-acceptance.test.ts` |
| frontend `cross_feature_browser` | 신규 `tests/e2e/issue-737-target0-acceptance.spec.ts`, 실제 Chromium |
| qa_docs `acceptance_review` | read-only 요구↔diff↔test↔docs·실행 증거 사전 검토 |

공유 fixture/production 코드는 수정하지 않는다. 모델/effort의 설정 기대값을 실제 실행 확인이라고 보고하지 않는다.

## 변경 영향과 검증 선정

| 수정점 → 소비자·음성 | 위험 | 실행 / 선정·제외 이유 |
| --- | --- | --- |
| 신규 cross-feature server test → 실제 ResourceDashboard/KPI/Excel service·SQLite | HIGH | 신규 테스트, `wbs-dashboard-views-http`, `issue-736-resource-adapter`, `issue-731-kpi`, Domain WBS ledger. stale·unsupported root·미배정/등록-only·중첩 raw union |
| 신규 preservation → SQLite migration/read·legacy identity | HIGH | 신규3mode backup/restore/reopen, 기존 `logistics-template-graph`, `project-copy-logistics`, `issue-623-target-transfer-acceptance`, `tests/server/db/issue-623-target-migration.test.ts`, `tests/server/process-catalog/project-work-areas.test.ts`. 이미 이관된 backup과 old-schema upgrade 분리 |
| 신규 Chromium → workspace routing/editor/Gantt native·API writer | HIGH | 신규 종합1+폭별5. API 실제 fixture이며 성공 응답 mock 없음. 기존 UI 폼/오류/dirty/stale/readonly는 기능별 Full CI에 인계; 전체 permutations 중복 실행 제외 |
| 139번째 spec 등록 → 8-shard selector·unique inventory | HIGH(수용 누락 위험) | 기존138배치 보존, 신규 Shard6 등록 및 planner Unit. timeout/worker/retry/fail-fast/Required 정책 변화 없음. 과거 duration/metrics는 신규 실측으로 변경하지 않음 |
| 문서 → 사용자 흐름/매뉴얼/운영/검증 인계 | MEDIUM | 링크 검사·파일/기능 인벤토리·사전 검토. 문서가 제품/운영 완료 증거가 되지 않음 |

## DOCUMENTATION_SYNC

- `docs/WBS_CROSS_FEATURE_ACCEPTANCE.md`: UPDATED
- `docs/exec-plans/active/ISSUE_737.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/TARGET_RESOURCE_OPERATIONS.md`: UPDATED
- `docs/DEPLOYMENT.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/ISSUE_737_FAILURE_ANALYSIS.md`: UPDATED
- `docs/evidence/issue737/local-validation.json`: UPDATED
- `docs/DB_SCHEMA.md`: N/A(기존 migrated SQLite·migration을 읽고 복원하며 schema나 migration SQL을 변경하지 않음)
- `docs/API.md`: N/A(기존 production handler와 DTO를 검증하며 Route·wire 계약을 변경하지 않음)
- `DESIGN.md`: N/A(제품 UI·interaction·공통 시각 원칙 변경 없는 수용 테스트와 인계 문서)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Calendar·기간·일정·전체 Milestone Gate 권위 결과를 재사용하며 알고리즘 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(기존 Copy·Template v5·Resource Excel 지원 및 미지원 거부를 검증하며 교환 형식 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(Import 입력 schema·parser·처리 경로 변경 없음)
- `docs/EXCEL_EXPORT.md`: N/A(Resource-root의 동일 snapshot·raw IDs·current/project 계약을 검증하며 writer·형식·지원 범위 변경 없음)
- `AGENTS.md`: N/A(기존 Agent 실행·권한·QA·묶음 게시 지침을 적용하며 지침 자체 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(HIGH·OWNER_MANAGED·Trusted QA·Owner 수용 기준을 유지하며 자동 QA 승인 정책 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 canonical Refs·Ready PR·전체 CI 시작과 묶음 게시 운영 정책 변경 없음)

| 검토 문서 | N/A 근거 |
| --- | --- |
| REQUIREMENTS / ARCHITECTURE / API / DB_SCHEMA | 구현 계약·Route·DTO·schema/migration 변경 없음. 기존 #728/#729/#762 계약을 테스트로 결속하며 수용표로 연결 |
| SCHEDULING_ENGINE / LOGISTICS_DOMAIN_DESIGN / LOGISTICS_TARGETS / LOGISTICS_DASHBOARD / RESOURCE_KPI_DASHBOARD | 산식/공정 source/Task·Assignment·수량·Gate 정의 변경 없음. 기존 권위 결과와 raw oracle을 대조 |
| SECURITY / IMPORT_SCHEMA / IMPORT_EXPORT / EXCEL_EXPORT | 권한/교환 형식/지원 여부·Origin/revision·보안 예산 변경 없음. Resource-root 지원/다른 root 거부·전체backup 아님을 수용/사용자/운영 문서에 재확인 |
| DESIGN / UI_UX_GUIDELINES / PROJECT_UX / TASK_EDITOR | Design Delta N/A: 제품 UI·interaction·공통 원칙 변화 없는 테스트/인계. 기존 화면 경로/keyboard/focus 계약 보존 검증 |
| GANTT_STATE_CONSISTENCY / GANTT_STATE_CONFORMANCE / MILESTONE_PRESENTATION_POLICY | canonical/Core/native/viewport writer·marker policy 변경 없음. 신규 identity/marker 검사와 기존 conformance 범위 구분 |
| AGENTS / ISSUE_LIFECYCLE / QA_REVIEW_POLICY / GITHUB_OPERATIONS | 기존 승인·실행/QA/묶음 게시 정책 적용. Gate·권한·릴리스 정책 자체 변경 없음 |
| #720 앱 매뉴얼 registry | 제품 route/registry 미구현 후속. 기존 사용자 Markdown/anchor 인계만 갱신, 앱 매뉴얼 완료 주장 없음 |

## AC_TEST_COVERAGE

- AC1: `tests/e2e/issue-737-target0-acceptance.spec.ts`의 Target0 등록 fixture→4기준정보→KPI/5root→Task 원본 편집→일정/출발 복귀, canonical 원본·revision·조회 mutation0. 실제 등록폼은 기존 #725/#726/#727/#762 spec에 매핑한다.
- AC2: `tests/server/projects/issue-737-preservation.test.ts`의 direct/target/mixed 전체 table·원시 ID·5root backup/restore/reopen, `tests/server/templates/logistics-template-graph.test.ts` v5 Copy/Template remap·legacy·null/empty, `tests/server/db/issue-623-target-migration.test.ts` 및 `tests/server/process-catalog/project-work-areas.test.ts` migration/rollback.
- AC3: `tests/server/resources/issue-737-cross-feature-acceptance.test.ts`의7spec·5root·typed siblings·정확 details/scope와 `tests/e2e/issue-737-target0-acceptance.spec.ts` 직접 축 조작. process→WA→siblings·두 설비 예시·reload 복원은 기존 `issue-733-process-workarea-dashboard.spec.ts`, `issue-734-equipment-dashboard.spec.ts`, `issue-730-view-composer.spec.ts` 및 `wbs-dashboard-views-http.test.ts`와 결합한다.
- AC4: 신규 cross-feature server의 rawSQLite→KPI/5root→OOXML ID/고유공수·5/7.5·수량15/3·등록-only/미배정/fullGate·stale, 기존 `issue-736-resource-adapter.test.ts` selected80/Project140·null/Capacity/Plan, `wbs-task-ledger.test.ts` Domain golden. 실제 UI 수치·원시ID 대조는 신규 Chromium에 포함한다.
- AC5: 신규 Chromium 종합·5개 폭의 keyboard/focus/geometry·Gantt identity/markerOFF 및 수용표의 기존 기능별 E2E. 기존 권한/dirty/pending/stale/error/역전·viewport 전체 SC는 새 로컬 부분 실행으로 PASS를 대체하지 않는다.
- AC6: `docs/WBS_CROSS_FEATURE_ACCEPTANCE.md`, 사용자/운영/배포/CI/원격·TEST_PLAN의 실제 지원·미지원/미검증·#720 screenKey/anchor 인계, Markdown link 검사와 항목별 DOC_SYNC.
- AC7: 본 원장의 baseline·source fingerprint·명령/결과와 Issue STATUS의 exact PR/Head/base/test merge/Run/attempt. Required3/Trusted/Owner/Manager 최종 수용은 별도 NOT TESTED이며 Issue/Epic 종료 비범위.

## 검증 실행 원장

Node `22.14.0`, npm `11.10.0`, Linux 전용 worktree에서 pinned `npm ci --no-audit --no-fund`와 `playwright install --only-shell chromium`을 수행했다. 다른 worktree의 node_modules/symlink를 재사용하지 않는다.

- 초기 focused Vitest: 신규 preservation3 + 기존 Template graph/Domain acceptance/KPI 총4파일53case PASS. 명령: `npx vitest run --config tests/config/vitest.config.ts tests/server/projects/issue-737-preservation.test.ts tests/server/templates/logistics-template-graph.test.ts tests/domain/wbs-task-ledger-acceptance.test.ts tests/server/logistics/issue-731-kpi.test.ts`.
- 기존 Copy/transfer/HTTP/Resource Excel·planner5파일46case, migration/Task context/직접 WorkArea/프로젝트 Resource/WBS domain5파일63case PASS. 신규 cross-feature server6case PASS. 서로 다른 실행 결과는 최종 동결 집중 실행 수와 합산하지 않는다.
- `verify:prepr --mode=fast` 시도는 기존 `tests/config/e2e-shard-plan.json` 자동 consumer map 부재로 BLOCKED(UNKNOWN1/선택4/실제검사0). `.prepr-reports/issue737-fast-attempt/`의 보고서는 자동 PASS가 아니다. Manager의 수동 영향 매핑은 위 표와 실제 planner Unit으로 별도 검증한다. 도구 정책을 넓히거나 UNKNOWN을 무시하는 옵션은 추가하지 않는다.
- backend/Chromium 최종 결과·정적 검사·source fingerprint·Pre-PR 보고서는 동결 후 이 절에 추가한다. 중간 PASS를 새 source의 결과로 합산하지 않는다.
- GitHub Quality/E2E8/Docker·Trusted QA: NOT TESTED. 실행 등록 후 exact PR/Head/base/test merge/Run/attempt는 Issue STATUS에 기록한다. CI 결과 모니터링 없음.
- Owner 수용/Manager ACCEPT: NOT TESTED, MERGE_READY=BLOCKED.
- main GHCR/digest/Finalizer/cleanup·정식 Release: NOT TESTED(이번 범위 밖).
- production/off-host restore·TLS/proxy/실제 storage·Windows Excel/VBA/DRM·native zoom/스크린리더·최종 수동 UX: NOT TESTED.

#737 자체 실패가 발생하면 `docs/ISSUE_737_FAILURE_ANALYSIS.md` 하나에 최초 관측부터 누적한다. 선행 #724~#736/#762/#767의 실패는 해당 원장을 보존하며 다른 Head 성공으로 덮어쓰지 않는다.

## 최종 동결 검증과 게시 인계

- 최종 source: 신규 테스트·기존 fixture·dependency manifest·인벤토리14파일 SHA-256 합성 지문 `8acccd808ba3216c9240b58e5d68cc06749d9684854057e123d26f6dd2633709`. [기계 판독 증거](../../evidence/issue737/local-validation.json)에 파일별 hash·명령·결과를 기록한다. fingerprint는 전체 tree/Head SHA가 아니다.
- 지문 수집 후 최종 focused Vitest15파일168case PASS(07:19:45 Asia/Seoul,6.36s), 신규 server9case 포함. 기존 migration/Copy/Template v5/Task문맥/참여/Domain/KPI/HTTP/Plan·Excel/planner를 포함한다. 실제 명령의 전체 파일 목록은 JSON에 보존한다.
- 최종 Chromium6/6 PASS(약2.5분,workers1/retries0): 종합20.8s와5폭12.0/12.1/12.0/12.0/12.0s. 명령 `npx playwright test --config tests/config/playwright.config.ts tests/e2e/issue-737-target0-acceptance.spec.ts --workers=1 --retries=0`. spec SHA256 `af4fc66deaf7bfe57466d74bba844485e969c2dc36364febcf55384ef75d22a2`;14파일 최종 read-back 불일치0.
- UI fixture의 기본 System direct 모집단은 미연결 작업을 제외하므로 raw Task-System 연결·같은 시스템 KPI breakdown과 대조한다. 다른 root는 전체 일반 Task·미배정 Task를 보존한다. 실제 같은 UI source의 KPI/5root/표시수치·원시ID/OOXML를 결속했고 별도 Domain의15/3/5 golden과 UUID/snapshot이 같다고 주장하지 않는다.
- Next dev 생성 `AGENTS.md` heading·`next-env.d.ts`·`tsconfig.json` isolated dist 변경은 브라우저 종료 후 baseline bytes로 복원했다. 원격 변경 묶음에는 없다. 실행 전체의 worktree sourceStable PASS를 주장하지 않으며 위14개 test/fixture manifest의 전후 일치를 기록한다.
- scoped ESLint4파일 PASS, 기존 pinned install과 application version0.130.0 유지. 생성물 복원 뒤 typecheck/version0.130.0/discovery270unit파일·801browsercase/Markdown308파일/diff 최종 PASS. 전체 로컬 Unit/production build/Docker는 tests/docs 범위 및 자동Pre-PR UNKNOWN으로 실행하지 않았고 공식 Full CI로 인계한다.
- 별도 `/root/acceptance_review`의 읽기 전용 사전 검토 PASS: 신규 server/preservation/planner3파일15case 독립 실행·139개 spec 단일 배치·문서/소스 freeze 검토, 미해결P1/P2 없음. 이는 independent human QA 또는 Owner/Manager ACCEPT가 아니다.
- GitHub CLI의 기존 인증은 HTTP401이지만 연결 GitHub 도구의 조회·Issue 댓글은 정상이다. 허용된 Git Data API(B)로 전체 tree·부모·최신 main·원격 branch 부재를 검증한 뒤 branch Ref1회 생성/Ready PR을 게시한다. local commit과 API candidate의 SHA는 다를 수 있으며 전체 tree가 같은지 확인한다. exact local/candidate Head/tree·PR/base/test merge·Full Run/attempt는 Issue STATUS에 남기고 본문 STATUS 편집은 하지 않는다.
- DOCUMENTATION_SYNC: 구조/AC mapping `STRUCTURAL_PASS_SEMANTIC_REVIEW_PENDING` / `MAPPING_PASS_SEMANTIC_REVIEW_PENDING`; 실제 source/지원 경계의 의미 사전 검토 PASS와 분리한다. 정식 원격 Trusted QA·Owner 위험 수용/병합 허가·Manager ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED.
