# Issue #732 — Milestone 최상위 동적 Dashboard

## Issue Work Packet

- Issue: [#732](https://github.com/planner77/masterGantt/issues/732), 상위 #723; 선행 #724/#728/#729/#730, 관련 #459~#464/#548/#550/#552/#624/#733/#720.
- baseline_sha: `05f1e560eee456e6fba5535255c9ede30a357c16` (main); branch: `feat/issue-732-milestone-dashboard`; 별도 worktree로 기존 작업·증거 보존.
- baseline_version: `0.125.0`; candidate_version: `0.126.0` (사용자 Milestone 관점 확장 MINOR; dependency 변경 없음).
- lifecycle_phase: IMPLEMENTATION → LOCAL_FAST_FEEDBACK → DOCUMENTATION_SYNC → PRE_QA → PR_CI.
- risk_level: HIGH; risk_reason: Milestone 전체 Gate/선택 원장 범위, 기존 생성·편집과 canonical/원본 복귀에 영향.
- qa_required: true; qa_method: OWNER_MANAGED; independent_qa: N/A(Owner-managed 최종 경로); manager_decision: NOT TESTED; MERGE_READY: BLOCKED.
- 별도 qa_docs의 실제 사전 검토는 최종 Trusted QA/Owner 승인과 구분한다. 새 Head의 Required Quality/E2E/Docker·Trusted QA·최종 승인 NOT TESTED.
- release_required: true; release_authorized: false. 구현·PR CI 시작은 정식 릴리스 승인이 아니다.
- issue_comment_writer: manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION.
- 요청 종료점: 구현·문서 갱신·리뷰 스레드/충돌 정리·새 Full PR CI 시작. CI 모니터링·병합·main/GHCR·tag/Release·Finalizer·브랜치 삭제·Issue 종료 제외.

## 역할·파일 소유권

- milestone_design / ui_ux: DESIGN/UI_UX_GUIDELINES 및 Milestone 표시/Gantt 상태 계약에 근거한 읽기 전용 설계.
- milestone_frontend / frontend: `src/features/milestones/**`, Project host의 Milestone 연결·생성 안내, 전용 feature/E2E 테스트.
- milestone_contract_tests / backend: 신규 `tests/server/resources/issue-732-milestone-views.test.ts`의 실제 SQLite/read service 수용 검증만 소유.
- Manager: 통합·문서·version·GitHub 게시. 공통 WBS renderer/API/원장 및 Gate 계산은 재사용하며 동시 쓰기 금지.
- qa_docs: 구현·문서 동기화 뒤 읽기 전용 독립 사전 검토. 구현자 자체 PASS를 독립 QA로 사용하지 않는다.

## 구현과 Design Delta B

기존 generic Milestone root를 전용 consumer로 연결하며 공통 composer/table/detail·Project/root 저장 설정을 재사용한다. 기본 root 단독과 수정 가능한 `Milestone→공정→WorkArea→[설비|물류 시스템]→리소스`, `Milestone→리소스→공정` 예시를 제공한다. 설정은 개인 브라우저 상태이며 Task/WBS/Project 업무 revision을 갱신하지 않는다.

전용 요약은 현재 조건의 고유 일반 Task·완료/지연·기간가중 진척, 개인 Assignment 계획공수·미설정, 미배정·미연결 진단과 전체 canonical Gate를 구분한다. 구성/공수/Gate 모집단과 중첩 경로 소계를 합산하지 않는다. 전체 소속0과 조건 밖0, 날짜 미정을 다른 상태로 읽는다. `E1→M`에서 t1만 선택돼도 M의 다른 E2-t2 및 직접 선행 조건은 전체 Gate에 남는다.

현재 저장/API 계약은 Task/Summary의 explicit 0..1 + 상속된 단일 effective Milestone다. #732의 복수 Milestone 문구를 근거로 다중 소속 writer·schema를 만들지 않으며, 여러 관점/공정/WorkArea/Resource 경로에 중복된 Task/Assignment의 고유 합집합을 보존한다. 이 경계는 기존 MILESTONE_STAGE_GATES가 Source of Truth이며 복수 effective 소속의 신규 모델은 비범위다.

Milestone 생성·기존 목록/검색/기간/상태·KPI·명시 Completed·삭제 보호·편집·소속·관계/일정 이동은 기존 Dashboard와 동일 API/editor를 유지한다. 생성 성공은 정확한 새 ID의 Editor로 연결하고 필터 때문에 목록에서 안 보일 수 있다는 접근 안내를 제공한다. 필터를 자동 초기화하지 않는다. readonly/dirty/pending/stale·401/412와 같은 원본 저장/복귀 gateway를 사용한다. marker OFF·native Milestone 행 분리·단일 Gantt coordinator/viewport writer를 보존한다.

## 기능 보존표

| 기존 기능 | 구현 후 경로 |
| --- | --- |
| Milestone 추가·이름/날짜 생성 | 같은 Dashboard 버튼·MilestoneCreateDialog·기존 생성 API·정확 새 ID Editor |
| 검색/기간/기준일/상태/임박·원본 필터 | 기존 ProjectMilestoneDashboard 유지; 새 계층 조건과 별개 |
| 목록·지표별 Milestone 확인 | 기존 관리 표와 KPI 선택·해제·초점 유지 |
| 이름/날짜/상태/명시 Completed 편집 | 같은 canonical Task Editor·Gate guard |
| 전체 소속·상속/override·직접 선행 | 기존 membership/관계 Editor 및 full Stage projection |
| 삭제/일반 Task 전환 보호 | 기존 server/host capability·권한·revision·완료 구조 잠금 |
| 정확 소속 Task 일정/리소스 이동 | 기존 ID/source provider; 숨은 native Milestone 선택·marker 임시 ON 없음 |
| 조건 밖 생성·빈 목록·날짜 미정 | 생성 성공 안내·정확 Editor 접근; 전체 소속0/조건 밖0 별도 |
| 원본·Task/Assignment 편집 및 복귀 | 공통 exact snapshot scope 검증과 기존 host/editor/복귀 lease |

## AC_TEST_COVERAGE

- AC1: 기존 Milestone 생성/편집/삭제 보호·membership/관계/필터 보존표; milestone 관리 관련 기존 feature/E2E + 신규 전용 consumer spec.
- AC2: `tests/features/milestones/milestone-wbs-dashboard.test.ts`와 `tests/server/resources/issue-732-milestone-views.test.ts`, 신규 Milestone dashboard E2E; Target0/root 단독·두 수정 계층·typed 설비/System 형제.
- AC3: 신규 SQLite service test의 E1-t1-M/E2-t2-M 경로 격리·전체 member/선행 Blocked·명시 Completed·WorkArea Task/Assignment 고유 총계; 기존 Gate/domain 원장 회귀.
- AC4: 전용 E2E와 기존 Milestone management/Task Editor의 생성 성공·실패/readonly·401/412·pending/stale·필터 밖 생성·정확 원본/복귀; 날짜미정/member0/selected0 구별.
- AC5: 전용 E2E의 390/768/1024/1440/1920px·keyboard/focus/내부 overflow·readonly·조회 mutation0/Gantt instance/marker OFF; 기존 Milestone/Gantt/Resource 회귀는 원격 Required CI.

## DOCUMENTATION_SYNC

- `docs/PROJECT_UX.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/MILESTONE_STAGE_GATES.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/ISSUE_732_FAILURE_ANALYSIS.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_732.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(기존 Light/system font/semantic token·동적 조회·이름 우선 원칙의 전용 consumer 적용이며 전역 디자인 원칙 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 공통 구성기·표 내부 scroll·focus/권한/상태 규칙을 그대로 적용하며 새 공통 interaction 규칙 없음)
- `docs/MILESTONE_PRESENTATION_POLICY.md`: N/A(marker OFF·native Milestone 행 분리·상세/소속 Task 이동 정책 변경 없음)
- `docs/GANTT_STATE_CONSISTENCY.md`: N/A(기존 coordinator·canonical gateway·복귀 계약 소비이며 viewport/axis writer 변경 없음)
- `docs/GANTT_STATE_CONFORMANCE.md`: N/A(기존 상태/SC 계약과 tolerance·timeout·gate를 변경하지 않음)
- `docs/SCHEDULING_ENGINE.md`: N/A(Gate/Calendar/scheduling 산식 및 membership 저장 계약 변경 없이 기존 read 결과 표시)
- `docs/API.md`: N/A(기존 versioned views와 Milestone 생성/편집 API 소비이며 endpoint/DTO/권한 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(기존 explicit 0..1/effective 소속·원본 테이블 유지 및 migration 없음)
- `docs/ARCHITECTURE.md`: N/A(기존 consumer·read projection·editor host 재사용이며 계층/경계 변경 없음)
- `docs/SECURITY.md`: N/A(기존 server authorization/Origin/revision gateway 유지하며 보안 계약 변경 없음)
- `AGENTS.md`: N/A(실행 지침과 역할/승인 정책 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(최종 QA/Owner 정책 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 단계·문서·원격 gate를 준수하며 정책 변경 없음)
- `docs/CI_CD.md`: N/A(후보 SemVer만 기존 정책대로 갱신하며 CI workflow/release 정책 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 Required3와 exact Head/attempt 증거 계약 변경 없음)

#720의 제품 `/manual`·registry는 baseline에서 NOT IMPLEMENTED다. `dashboard.milestones`의 사용자 절차는 기존 사용자 가이드의 Milestone 절을 이번 PR에서 갱신한다. 전역 매뉴얼 아이콘/route 구현이나 #720 완료를 주장하지 않는다.

## 실제 모델·환경 경계

정상 SQLite의 Milestone은 날짜 필수이며 null 날짜 신규 생성은 지원하지 않는다. 날짜 미정 표시는 예외 snapshot의 방어 UI일 뿐 API/DB 계약 확장이 아니다. `blocked=true`는 미완료 직접 선행 조건이고 소속 Task만 미완료면 `ready=false/blocked=false`인 Not Ready다. member0는 수동 이벤트·Ready N/A로 표시한다. 명시 Completed와 파생 판정은 구별한다.

## 검증 상태와 인계

구현과 문서 동기화를 완료했으며 새 Gate 요약의 수동 이벤트/선행 차단 누락 R732-001도 보완했다. 독립 `milestone_preqa`가 source/AC/문서와 해당 수정을 읽기 전용으로 재검토했다. 이 사전 검토는 원격 QA_FINAL·Owner 최종 승인과 별개다.

- pinned frozen install: `npm ci --offline --no-audit --no-fund` exit0, 447packages/24초. 실제 Next/@next/env16.3.8, Playwright1.63.0, Vitest5.0.0, Node22.14.0.
- 최종 pinned Unit/SQLite/domain: `npx vitest run --config tests/config/vitest.config.ts tests/features/milestones/milestone-wbs-dashboard.test.ts tests/server/resources/issue-732-milestone-views.test.ts tests/domain/milestone-stage-gates.test.ts tests/domain/wbs-task-ledger.test.ts tests/domain/wbs-task-ledger-acceptance.test.ts` — 5files/55tests PASS, 3.60초.
- 초기 installedNext16.3.4의 feature/server/domain54PASS·수정후feature5PASS·전용browser4PASS는 진단 이력으로만 보존한다. 같은 frozen install의 결과로 재사용하지 않는다.
- 브라우저는 최종 source의 5폭/keyboard/marker0와 조건 밖 생성/정확 원본/안내 닫기 focus 두 case를 pinned 환경에서 선별 재실행한다. 기존 #550 생성401/412/network·pending/dirty/stale와 나머지 전용2case는 고정 의존성 로컬 재실행 전 NOT TESTED이고 새 PR의 기존 전체 E2E에 맡긴다.

 새 Head quality/e2e/docker·Trusted QA·Owner ACCEPT NOT TESTED. 이전 Issue의 원격 성공을 새 Head 증거로 재사용하지 않는다. 첫 실패부터 `docs/ISSUE_732_FAILURE_ANALYSIS.md`에 누적하며 skip/retry로 실패를 숨기지 않는다.

최종 pinned 검사: `npm run typecheck` 및 변경 TS/TSX·테스트7파일 대상 ESLint exit0. `npx playwright test --config tests/config/playwright.config.ts tests/e2e/issue-732-milestone-dashboard.spec.ts --project chromium --grep '5폭과 keyboard|조건 밖 생성'` — 2/2 PASS, 총2.7분(5폭/keyboard/marker0 53.6초, 조건 밖 생성/정확 원본 재진입/안내 닫기 초점45.1초). synthetic 390/1440 화면은 `docs/evidence/issue-732/after-390.png`, `after-1440.png`다. 화면은 실제 keyboard·HTTP·DB 검증을 대체하지 않는다. 자동 생성 next-env/tsconfig 변화는 정확 HEAD 내용으로 복원하고 게시하지 않는다.

독립 Agent `milestone_preqa` PRE_QA: 코드·문서 PASS, 미해결 P1/P2 0건. R732-001 수정·초점 복귀·전체/선택 범위와 기존 API/DB 경계를 검토했다. Reviewer의 반환 시점에는 마지막 생성 browser case가 NOT TESTED였으나 이후 Manager가 실제2/2 완료를 확인했다. 최종 QA/Owner ACCEPT 및 공식 원격 전체 회귀는 여전히 NOT TESTED다.

## 최신 main 통합과 게시 재개

게시 대기 중 #735가 main `08a1d9ff25a97aba67f08d6b67029ac55d45121a`/version0.126.0으로 병합됐다. 기존 baseline/후보0.126.0/로컬 검증은 위 역사 기록으로 보존한다. 최신 main을 통합하고 CHANGELOG·TEST_PLAN의 문서 충돌 두 곳에서 #732/#735 내용을 모두 유지했다. 새 #732 후보는 MINOR `0.127.0`으로 package/lock/CHANGELOG를 동기화한다. 정식 release_authorized=false 및 PR CI 시작까지만이라는 요청 범위는 그대로다. 공통 WBS의 #735 additive controls/system spec 변화와 Milestone consumer 호환은 새 tree에서 관련 unit/SQLite/typecheck로 다시 확인하며 원격 Required3/Trusted/Owner 판정은 새 Head에서 NOT TESTED다.

## 2026-10-21 — Full PR CI #3060.1 실패 분석·Milestone Snapshot P2 보완

- 원본: [PR #761](https://github.com/planner77/masterGantt/pull/761), [Run #3060.1 / 39440822411](https://github.com/planner77/masterGantt/actions/runs/39440822411). Required Quality/Chromium 6 shard/Docker는 SUCCESS, QA Final만 `미해결 review thread`로 BLOCKED. P2 [review](https://github.com/planner77/masterGantt/pull/761#discussion_r4326272019)에서 `stageGate`는 이전 Report, 이름·일정·상태는 최신 Task 목록을 읽는 Revision 혼합 지적. Timeout/Shard 부하는 원인 아님.
- 수정 소비자: `src/features/milestones/milestone-wbs-dashboard.tsx`, `milestone-wbs-dashboard-model.ts`. 이름은 Full Gate와 동일 `configurationCatalog` report에서 읽고, Date/Status는 report revision과 host canonical revision이 같을 때만 표시. mismatch 시 과거 Gate는 이전 결과로 구분하고 날짜·상태 숨김/조회 대기 안내. 기존 복수 경로 dedup/Gate 산식/API/DB/권한·marker/viewport writer·원본 생성/editor 보존.
- 추가 검증 코드: `tests/features/milestones/milestone-wbs-dashboard.test.ts`에 actual SQLite report + 새 Revision 완료/날짜/명칭 변경 시 반례, 신규 report 동기화 시 표시 복원. 기존 #732 전용 E2E/서버/도메인 테스트 유지, timeout/skip/retry/shard/Required 설정 불변. 실행 가능한 checkout/dependency가 없으므로 로컬 결과는 NOT TESTED; 새 정확 Head의 Full CI가 필수.
- 이슈별 누적 원장: [ISSUE_732_FAILURE_ANALYSIS.md](../../ISSUE_732_FAILURE_ANALYSIS.md)의 `F732-004`에 L732-001~003/R732-001 대비 원격 원인·Job/Attempt/처리·잔여 위험을 추가. 과거 PASS를 현재 성공으로 치환하지 않음.
- 최신 main/review/mergeability는 PR synchronize 직전 재확인, 개별 리뷰에 수정 근거로 응답하고 Resolve 후 Full CI 시작까지만 수행. CI 이후 Quality/E2E6/Docker/Trusted/Owner ACCEPT는 NOT TESTED, `MERGE_READY=BLOCKED`, `release_authorized=false`.

## 2026-10-21 — #732 Main 실패 후속 Shard Plan 교정

- 실패 출처: Main #3067.1 (Run `39492209464.1`, SHA `5ffe02a334d2279fabb63943c90614a7acfaf6ad`) Shard1 35분 제한 CANCELLED, 145 PASS/1 NOT RUN, Quality/Docker+나머지 Shard PASS, E2E aggregate FAIL, GHCR SKIPPED. 원본 구분·대책은 [F732-005](../../ISSUE_732_FAILURE_ANALYSIS.md) 참조.
- 최신 기준: 이미 다른 Issue #736이 merge되어 main `1c1938851aa8234febcba404f4007d6c94fb2233`/version0.128.0. #732 기존0.127.0 릴리스 부채와 다른 Issue0.128.0을 합산하거나 승인 이월하지 않는다.
- 생산자/소비자: Historical `tests/config/e2e-shard-plan.json`의 116 explicit +19 hash fallback spec = 실제 135개 E2E 파일. #735 System1→2, #732 Milestone1→3, Gantt recovery1→4, #736 Resource5→2. 이전 #733 수동 조정 보존, 이동 외131개 동일 배정, 완료 후 파일수21/25/24/23/21/21. 새 spec 누락 검출용 `tests/scripts/e2e-shard-planner.test.ts` 회귀 추가; runtime fallback은 그대로 두어 누락 없이 실행.
- 검증·AC: 정적 출처/선택 집합·중복0 분석; 실제 Vitest/Chromium/Build/Docker 로컬 NOT TESTED. 이번 교정 PR Full Quality/E2E6/Docker·Trusted QA exact-Head, 리뷰0, Owner HIGH 수용 필요. 기존 #732 4 browser, #735 6, #736 5, Gantt, Excel 마지막 미완료 case를 포함하여 전체 E2E 검증. 기존 35분/6Shard/worker1/CI gates/skip·retry·assertions 모두 유지.
- 문서: 원장 F732-005/이 Work Packet/TEST_PLAN M732-001 수정. DESIGN/API/DB/ARCHITECTURE/CI_CD/AGENTS/CHANGELOG/매뉴얼: 앱·CI 정책과 SemVer 자체 변경 없으므로 N/A. 현재 버전 0.128.0 유지, release/Finalizer/Issue close BLOCKED. manager_decision=NOT TESTED, MERGE_READY=BLOCKED, QA=OWNER_MANAGED/HIGH. 교정 PR CI 시작까지만 요청되었고 추후 모니터링·병합·Main·GHCR 수행하지 않음.

### 2026-10-21 PR #3072.1 Shard2 33.2분 경보 및 병합 전 추가 균형화

- 기존 [Full PR CI #3072.1](https://github.com/planner77/masterGantt/actions/runs/39501650409)은 REQUIRED3·QA 모두 성공했으나 Shard2 Job 33.2분(35분 한계까지1.8분), Shard4 30.2분. 사용자 지시에 따라 해당 성공 HEAD 그대로 병합하지 않고 후속 재배분을 동일 #732 PR #763에 추가한다.
- 변경 위치: System #735 2→5, project-transfer 2→1, canonical projection 2→3, logistics-target authoring 4→1, project-task-delete 4→3, view composer #730 6→5. 기존 첫 교정(#732 Milestone3, #736 Resource2, Gantt recovery4)과 #733 관련 이동은 보존. 135파일 전체 명시/중복·누락0, Shard 파일 수23/22/26/21/23/20.
- 성공 PR 실측 Job 분16.6/33.2/22.0/30.2/18.0/27.4에 이사한 테스트의 본문 시간만 적용한 임시 예상22.5/25.5/25.1/25.2/24.9/24.2분은 예측일 뿐. 새 HEAD에 대한 PR CI/Trusted QA/Owner ACCEPT **NOT TESTED**. 재검증 성공 전 Merge, Main, GHCR, Issue-close 진행하지 않음.
- `tests/config/e2e-shard-plan.json`, `tests/scripts/e2e-shard-planner.test.ts`, #732 단일 누적 실패 원장·Work Packet·TEST_PLAN만 보완. 안전 E2E hash fallback·6Shard/worker1/35분/원본 test·QA/CI required·version0.128.0/제품 계약 불변. 이후 이슈 버전 간 Release 체인은 별도 감사를 요구.

### 2026-10-21 — F732-006: PR Full #3073.1 Shard5 Resource assignment readiness 보완

- **실패 증거:** [Run `39508411997.1`](https://github.com/planner77/masterGantt/actions/runs/39508411997), HEAD `d4b78a4f`의 Shard5 #622 `issue-622-resource-plan-target.spec.ts:92`에서 정확 ALICE 투입률60 입력을 5초 내 찾지 못함, 2PASS/1FAIL/99 NOT RUN; 나머지5 Shard CANCELLED, E2E+QA Final FAIL, Quality/Unit/Build/Docker SUCCESS. **35분 Job Timeout과 무관.** [Issue #732 실패 원장 F732-006](../../ISSUE_732_FAILURE_ANALYSIS.md) 참조.
- **교차 소비자:** 타 Issue #736 Main #3071의 #621도 유사한 개인 투입률 label absence, #732 동일 source PR #3072의 #622 PASS. 아직 raw trace/DOM/네트워크가 검증되지 않아 정확 제품 원인 UNKNOWN, 두 번의 앱 Async Ready 경합 가능성을 제거하는 엄격한 E2E 준비 계약으로 우선 교정. 프로덕션 코드/권한/Assignment 저장은 변경하지 않음.
- **범위/AC:** #622에서 API canonical allocation60/리소스 ID 단언을 추가하고 리소스 tab selected→실제 할당 ready를 의미하는 Save button enabled(`timeout:30000`, per-expect)→기존 정확 label/value와 60→40/Excel/5폭/동료 불변을 수행. #621에서도 첫 화면·재열기 모두 같은 Ready Gate→100/80/70·401/412·Bob 불변을 검증. 에러면 버튼 비활성/기존 assertion FAIL 유지, sleep/retry/skip 및 전역 timeout 35분 불변.
- **회귀/검증:** 기존 #621/#622/#623/#736 기존 브라우저 및 모든 PR E2E6·Unit/Build/Docker, Trusted QA. GitHub source 정적 검토 외 로컬 실행 결과는 NOT TESTED; 새 정확 HEAD 성공 전 MERGE_READY=BLOCKED/Owner ACCEPT 미확인. PR branch `fix/issue-732-main-e2e-shard-1-rebalance` 재사용, plan135/6 shard/과거 #733 이동은 변경 없음.
- **문서/버전:** 단일 실패 원장, Work Packet, TEST_PLAN에 누적. DESIGN/API/DB/CI_CD/AGENTS/CHANGELOG/USER GUIDE는 제품/버전/정책 무변경이라 N/A. #732 v0.127.0 미발행 및 사이의 #736 v0.128.0/Main 실패는 별도 정식 릴리스 부채로 유지.
