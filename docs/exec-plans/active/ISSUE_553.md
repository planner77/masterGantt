# Issue #553 Work Packet — marker OFF 기준 재통합 (2026-10-25)

repository: planner77/masterGantt
primary_issue: #553
existing_pr: #562
risk_level: HIGH
qa_method: OWNER_MANAGED
qa_required: true
release_required: true
release_authorized: false
manager_decision: NOT TESTED
MERGE_READY: BLOCKED
lifecycle_phase: REWORK → IMPLEMENTATION → DOCUMENTATION_SYNC → PR_CI_STARTED (requested)
main_baseline: 22144ce3844ab50ac0f22a715742c9df82e072e8
old_pr_head: afd5ec2899183a2464b64f91d34e9de5d8a8319c
archive: archive/issue-553-pr562-20261018
candidate_version: 0.133.2 → 0.133.3 PATCH

## ISSUE_AC

| ID | 수용 의미 | 확인 경로 |
| --- | --- | --- |
| AC1 | 조회·OFF·scope/filter/접힘에 프로젝트 revision, 전체 Task/Link/명시·유효 membership, Gate/roll-up 무손실 | #552 marker-OFF E2E 및 #553 canonical fixture/integration |
| AC2 | JSON1.1 전체 교환·UUID/FK 새 매핑·legacy mixed atomic reject | `milestone-timeline-interchange.test.ts`, actual HTTP spec |
| AC3 | Copy/Template/multi-root Copy/Cut, 완료 잠금·외부 소속·rollback | 동일 integration/HTTP; 기존 #464 tests |
| AC4 | Excel full canonical/기존 sheet·Resource opt-in/E/P/F 및 SVG/PNG full expanded WBS/date clip/fail-closed | integration/HTTP + 기존 image/Resource E2E |
| AC5 | 내보내기 대화상자에 화면과 원본 범위 차이 설명, keyboard/5폭·직접 조회/복귀 정책 | `project-gantt-image-export.spec.ts`; #552 5폭 OFF E2E; #574 통합 |
| AC6 | 최종 사용자 가이드/유효 membership/Ready·Completed·해당 날짜 대체 경로/환경별 한계 | `MILESTONE_USER_GUIDE.md`, traceability |
| AC7 | 기존 실패/미실행/Exact-head/독립 QA/Owner/Release 경계 | 단일 `ISSUE_553_FAILURE_ANALYSIS.md`; 현재 Full8 결과 후 별도 판정 |

## DESIGN / 소유권 / 충돌 처리

[DESIGN](../../../DESIGN.md)과 [Presentation Policy](../../MILESTONE_PRESENTATION_POLICY.md) 우선: native Grid/Chart M row·bar 0 / 생산 Timeline lane·marker OFF. Milestone Dashboard·Task 소속·Editor로 사용자 경로를 대체한다. 기존 full canonical JSON1.1/Excel/이미지 Server renderer·Auth/Origin/If-Match/Revision/SQLite/Resource/Logistics/Stage Gate 계산기 불변. SVAR PRO markers·새 날짜 스크롤 writer/새 export schema/API/DB migration은 비범위.

Old PR #562는 marker ON 기반 91-file diff, 최신 main 대비 1398 commits 뒤처져 dirty. **이전 PR/브랜치/리뷰/실패 결과를 버리지 않는다**. 최신 main tree를 기초로 old HEAD와 main HEAD를 함께 부모로 가지는 새 merge commit을 PR head에 fast-forward한다. 새 tree에는 old E2E marker ON/UI/viewport hotfix/old outdated guide/CI artifacts를 억지로 적용하지 않는다. #553 canonical fixture/실제 HTTP+SQLite/integration, Export 안내 및 기존 이미지 E2E 단언·current-user guide·정규 누적 원장만 이관. 선택 영역 충돌시 main 계약 우선; full integration 수용은 #574.

## AC_TEST_COVERAGE / TEST_LIFECYCLE_REVIEW

- **KEEP_UNIQUE:** `tests/integration/milestone-timeline-interchange.test.ts`의 full UUID/FK/parent/Link/Membership·rollback/OOXML+SVG 실제 DB 테스트; `tests/e2e/milestone-timeline-interchange-http.spec.ts`의 실제 HTTP/SQLite/프로세스 재시작은 synthetic `milestone-exchange-state.spec.ts` 및 #552 UI와 위험 경계가 다르므로 별도 유지.
- **EXTEND:** 기존 `tests/e2e/project-gantt-image-export.spec.ts` 실제 SVG/PNG 다운로드에 공통 안내 assertion 추가. 별도 동일 목적 5폭 E2E를 중복 작성하지 않고 #552 `milestone-visibility.spec.ts`의 정확 OFF 5폭·Day/Week 계약을 참조한다.
- **PARTIAL_OVERLAP:** #464 exchange/Resource report 관련 기존 테스트와 #553 full source/실제 HTTP 테스트는 일부 경로만 겹친다. source 비동등으로 승인 없이 통합/삭제 금지.
- **KEEP HISTORICAL / DO NOT IMPORT:** 2026-10-09 old `milestone-timeline-interchange-ui.spec.ts`의 marker ON/cluster/토글 스펙, old `project-gantt.tsx` hotfix, old 0.106.1 사용자 가이드는 운영 OFF와 충돌하여 archive와 old commit에만 보존. 검사 없이 skip/퇴역했다고 기록하지 않는다.
- Search basis: existing `milestone-visibility.spec.ts`, `milestone-wbs-mode.spec.ts`, `milestone-exchange-state.spec.ts`, `milestone-stage-exchange.spec.ts`, `project-gantt-image-export.spec.ts`, `resource-excel-export-ui.spec.ts`, `project-gantt-inline-name.spec.ts`, `task-editor-form-density.spec.ts`. 모든 known test-level 과거 오류는 실패 원장 참조; 최신 Head에 대한 실행은 **NOT TESTED**.
- `npm run typecheck`, `npm test -- tests/integration/milestone-timeline-interchange.test.ts`, `npm run test:e2e -- tests/e2e/milestone-timeline-interchange-http.spec.ts tests/e2e/project-gantt-image-export.spec.ts`, `npm run verify:prepr`은 실행 환경 미제공으로 **NOT EXECUTED**. 원격 Full PR quality + Chromium8 + Docker + Trusted QA가 정규 결과 원천이다. Docker/Windows Excel/DRM/운영 reverse proxy도 NOT TESTED.

## DOCUMENTATION_SYNC & 영향 N/A

- 신규 사용자 [guide](../../MILESTONE_USER_GUIDE.md)·[MT1~MT5 trace](../../MILESTONE_TIMELINE_TRACEABILITY.md)·[누적 실패 원장](../../ISSUE_553_FAILURE_ANALYSIS.md) 및 Changelog/version 갱신. 기존 DESIGN/AGENTS 정책 변경 필요 없음. `MILESTONE_TIMELINE`, `PROJECT_UX`, `REQUIREMENTS`, `TASK_EDITOR`, `TASK_RELATIONS`, `IMPORT_EXPORT`, `EXCEL_EXPORT`, `IMAGE_EXPORT`, `MILESTONE_STAGE_GATES`의 **서버/화면 기본 계약은 unchanged**; 2026-10-15 정책의 marker OFF가 최신 source of truth이며 새 guide에 사용자 동작/차이를 일관되게 명시.
- API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY/CI_CD/DEPLOYMENT N/A: 새 route/schema/migration/권한/계산/writer/Runner/배포 정책 없다. old source의 버전/장치별 log·screenshots 무단 복사 없음.
- 요청 종료점: 기존 PR 리뷰 스레드/mergeability 확인 → latest-main 충돌 해결 → 새로운 PR Full CI **등록**. 이후 모니터링/병합/Main/GHCR/정식 Release/Issue 종료 안 함. 독립 qa_docs/PRE_QA 및 Manager 최종 수용은 별도 검증, 이번 실행에서 수행했다고 주장하지 않는다.


## REWORK_3272 — 반복 사전 FAIL 예방 및 변경 범위 (2026-10-25)

- [실패 Full Run #3272.1 / 40160694952](https://github.com/planner77/masterGantt/actions/runs/40160694952), HEAD `c906cadffbdaa9f02db01534c17332897014ff55`, base `22144ce3844ab50ac0f22a715742c9df82e072e8`, test-merge `75ef336a6dc085827e9aabfa467f487fd6bafe7a`.
- `changes` 121071428069 직접 실패: 기존 PR body `Refs #553 · #548 · #552 · #574`는 `verify-ci-run-trace.py`의 독립행 정규식 미충족. Fast Gate/Required3/QA Final 실패는 파생, 타입/Unit/Build/Chromium8/Docker **NOT RUN**.
- 같은 trusted base의 `qa_preflight.py`와 `qa_final_automated.py`를 함께 정적 대조했다. Issue #553의 AC 태그 0개와 이 Packet의 명시적 DOC_SYNC/AC_TEST_COVERAGE 섹션 누락은 **다음 Preflight 예상 차단**이므로 실제 Run에서 미실행인 사실을 유지하면서 구조적으로 보완한다.
- 기존 Issue 열 개의 acceptance checkbox를 AC1~10으로 1:1 식별했다. PR body는 canonical standalone `Refs #553` 하나만 둔다. Source/DB/API/UX marker OFF/CI 정책/보안 변경 없음. 8-shard 정식 결과·QA_FINAL·Owner ACCEPT는 시작 전 NOT TESTED.
- TEST_LIFECYCLE_REVIEW: base `scripts/test_qa_preflight.py` / `scripts/verify-ci-run-trace.py` 별도 policy negative test는 **KEEP_UNIQUE**, 제품 PR에서 validator/CI 코드 수정 금지. 기존 #553 canonical fixture/실제 SQLite·HTTP 및 #552 OFF 테스트 보호를 유지. 새로운 테스트 삭제·skip/timeout 완화 없음.

## DOCUMENTATION_SYNC

- `AGENTS.md`: N/A(공통 Issue/QA/CI 실패 대응 절차가 불변이고 metadata 선언만 바로잡는다)
- `DESIGN.md`: N/A(새 레이아웃·상태·semantic token 변경 없이 marker OFF를 보존한다)
- `docs/CI_CD.md`: N/A(기존 Full8, 3 Required checks 및 신뢰된 Preflight 구성이 불변이다)
- `docs/EXCEL_EXPORT.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: N/A(현행 GitHub metadata 검증 계약에 맞추며 workflow 정책은 변경하지 않는다)
- `docs/IMPORT_EXPORT.md`: UPDATED
- `docs/IMPORT_SCHEMA.md`: N/A(JSON 1.1 schema와 입력 검증·UUID FK 계약이 동일하다)
- `docs/QA_REVIEW_POLICY.md`: N/A(HIGH Owner-managed/Trusted QA와 별도 승인 게이트가 동일하다)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 원격 Run/Attempt/Head/Base/Test-Merge 증거 정책이 동일하다)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정·Milestone Gate·Resource Roll-up 계산을 변경하지 않는다)
- `docs/TEST_PLAN.md`: N/A(기존 Test Plan과 #552 marker-OFF 테스트는 불변, 정확 매핑은 아래 AC 표와 추적표로 보완한다)
- `docs/IMAGE_EXPORT.md`: UPDATED
- `docs/MILESTONE_STAGE_GATES.md`: UPDATED
- `docs/MILESTONE_TIMELINE.md`: UPDATED
- `docs/MILESTONE_TIMELINE_TRACEABILITY.md`: UPDATED
- `docs/MILESTONE_USER_GUIDE.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/TASK_RELATIONS.md`: UPDATED
- `README.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_553.md`: UPDATED
- `docs/ISSUE_553_FAILURE_ANALYSIS.md`: UPDATED

위 N/A는 변경 없음의 원인 기록이며 검증 PASS가 아니다. `docs_required`의 전체 합집합 기준으로 변경 여부와 내용 정합을 별도 판정한다.

## AC_TEST_COVERAGE

- AC1: `tests/fixtures/issue-553/canonical-interchange.ts` + `tests/integration/milestone-timeline-interchange.test.ts`와 #552 `milestone-visibility.spec.ts`의 full canonical/조회·Gate·revision 불변, 새 Head NOT TESTED.
- AC2: `tests/e2e/milestone-timeline-interchange-http.spec.ts` 및 integration의 Origin/If-Match/정확 revision, 새 Head NOT TESTED.
- AC3: integration/HTTP JSON1.1 UUID·FK·mixed atomic reject, Copy/Template/multi-root/cut·실제 restart, 새 Head NOT TESTED.
- AC4: integration Excel OOXML/Milestone/Resource opt-in/SVG + 기존 `project-gantt-image-export.spec.ts` SVG/PNG, `resource-excel-export-ui.spec.ts` (#529), 새 Head NOT TESTED.
- AC5: 기존 #552 `milestone-visibility.spec.ts` 소속 필터/복귀, #464 member/관계, #529 Resource full scope 및 #574 후속 종단 QA, 새 Head NOT TESTED.
- AC6: #552 390/768/1024/1440/1920 Day/Week + 기존 image export 실제 keyboard/geometry/readonly; 전체 실측은 새 Head NOT TESTED.
- AC7: 이전 marker-ON #553 UI는 archive 보존·현행 OFF 계약에 무단 적용하지 않음; #552, #140 inline, #529 peer 원본 테스트 유지, skip/허용오차 확대 없음.
- AC8: `docs/MILESTONE_USER_GUIDE.md`와 동일 Export dialog 문구, Dashboard/소속 Task date fallback 및 JSON/Excel/SVG/PNG 범위·제약, 새 Head NOT TESTED.
- AC9: `docs/MILESTONE_TIMELINE_TRACEABILITY.md`의 #549~#553 및 #548/#574, #573/#693 선택 ON 분리; 이전 SHA/6-shard PASS 소급 없음.
- AC10: Issue별 단일 실패 원장 F553-A~G, 독립 QA/Manager 승인/Windows Excel/DRM·운영 proxy 및 #574 종합 QA 상태 명시, 완료 전 NOT TESTED.


## REWORK_3274 — explicit 8-Shard E2E inventory / Fast Gate 직접 Vitest 실패 교정 (2026-10-25)

- [Full PR #3274.1 / Run 40162277020](https://github.com/planner77/masterGantt/actions/runs/40162277020), Head `b9e1028958196fffe3540a68ae4f4601c9d93f72`, Base `22144ce3844ab50ac0f22a715742c9df82e072e8`, test-merge `a3c353d94a4dfb791dde892f797cc408adadde9d`. [단일 누적 실패 원장 F553-H](../../ISSUE_553_FAILURE_ANALYSIS.md).
- 이번 직접 FAIL은 `tests/scripts/e2e-shard-planner.test.ts:109`의 **141 current E2E spec != 140 plan files**. missing `milestone-timeline-interchange-http.spec.ts` 1개, duplicate/stale 0개. 과거 marker-ON 제품/viewport 오류가 아니며 새 3개 실제 HTTP/native SQLite/process restart 테스트는 CI Fast Gate가 막아 **NOT RUN**.
- 출처 비교: `changes`/Trusted QA Preflight/TypeScript/ESLint/Policy **PASS**, Vitest 3293 PASS/1 FAIL/기존 3 SKIP; #553 integration13/13 PASS. PR Fast Gate UNIT failure→Quality/E2E/Docker aggregate 및 QA_FINAL 파생 FAIL, 실제 Chromium 8 shards/Docker/Next production build **NOT RUN**. 다른 metadata-only #3273.1은 구 Full #3272 실패 출처로 인한 파생 실패이며 별도 Full 직접 실패에 합산하지 않는다.
- `tests/config/e2e-shard-plan.json` Shard4에 new spec 정확 1개를 추가하고 기존 140개 배치는 변경하지 않는다(8 groups: 18/17/18/18/17/18/17/18, total141). `tests/scripts/e2e-shard-planner.test.ts`의 exact-length 및 파일→Shard4 positive pin을 보강하고 **원래 missing/duplicate/stale 인벤토리 오류가 실패하도록 유지**한다. Hash fallback으로 수용하지 않으며 전체 spec을 놓치는 skip/negative 완화 없음.
- 비용 판단: 최근 main Full SUCCESS #3271/#3268/#3263/#3260의 Shard4 완료 wall 20.5/19.8/17.3/14.1분(8-shard, 최대 Job35m), 구형 #2278 HTTP 3-case ≈48.4초 참고. 현행 Head 신규 E2E는 **UNMEASURED**. Plan 역사적 `generatedAt/sourceRunIds/metrics/projectedMs` 불변(새 실측치로 둔갑 금지), `issue553ExplicitPlacement`에 실제 출처와 추정 한계 보존.
- **TEST_LIFECYCLE_REVIEW:** 기존 `tests/scripts/e2e-shard-planner.test.ts` exact coverage/unique/selector positive·negative는 **EXTEND/KEEP_UNIQUE**; #767/#737/기존 모든 source-based oracle과 guard는 유지. 새 HTTP E2E는 실제 import/export/권한/restart 위험 **KEEP_UNIQUE**(#464 mocked UI와 구분). Pre-PR/정책 단계는 `scripts/verify-ci-run-trace.py` 및 `qa_preflight.py`로 현행 그대로. 새로운 assertion 축소·테스트 skip·timeout/retry/샤드 수 변경 없음.
- **DOCUMENTATION_SYNC 영향:** `docs/ISSUE_553_FAILURE_ANALYSIS.md`/현재 Packet/`docs/MILESTONE_TIMELINE_TRACEABILITY.md` UPDATED (현재 PR에서 제공). `docs/TEST_PLAN.md`: N/A(기존 정책·테스트 수명주기/전체 커버리지 기준 변경 없음, AC 테스트·Run mapping을 본 Packet에 추가). `AGENTS.md`, `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md`: N/A(기존 8 shard+35m·신뢰된 QA·Owner/Required3·문서 구조 계약 변경 없음). `DESIGN.md`/도메인/API/DB/Scheduling/Import Schema: N/A(마커 OFF/교환 데이터·서버 정책/화면 변경 없음). 이전 `## DOCUMENTATION_SYNC`의 11개 필수 경로 및 `## AC_TEST_COVERAGE`의 AC1~10 full mapping을 그대로 적용, 새로운 위험 AC3/4/6/7/10에 대해 이번 Run 증거를 추가함.
- 검증 전제: 현재 GitHub E2E top-level 141개와 계획 141개 exactly-once 정적 비교 **PASS**, 다른 140 할당 동일, 기존 #553 integration13는 **원본 CI #3274에서만 PASS**. 변경 새 Head의 Vitest/Playwright8/Docker/Trusted/Owner는 **NOT TESTED**; CI 시작까지만, 추후 결과 모니터링·병합/Main/GHCR/Release/Finalizer/Issue Close 수행하지 않는다.
