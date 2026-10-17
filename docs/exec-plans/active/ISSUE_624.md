# Issue #624 — 물류 통합 관점 V1 Work Packet

## 기준·구현 목표

- 상위 [#613](https://github.com/planner77/masterGantt/issues/613), 선행 [#623](https://github.com/planner77/masterGantt/issues/623)(CLOSED). Baseline main `de863713142a92f1cac56dbae044923822bca932`; 작업 branch `feat/issue-624-logistics-unified-views`.
- 기준: [PR CI 전체 이력 REWORK](../../PR_CI_FAILURE_TRIAGE.md), `AGENTS.md`, `DESIGN.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/QA_REVIEW_POLICY.md`, `docs/UI_UX_GUIDELINES.md`, [물류 Target](../../LOGISTICS_TARGETS.md), [Resource KPI](../../RESOURCE_KPI_DASHBOARD.md), [Q1 수용](ISSUE_623.md).
- 기존 Resource Target projection #619/#620, Target↔WBS #617/#618, #621 canonical Task/Assignment/Target 편집·복귀, Milestone full Stage Gate를 재사용한다. 새로운 Task 원본·저장용 hierarchy/DB·계산 엔진·Gantt viewport writer·SVAR PRO는 만들지 않는다.
- app `0.116.0` MINOR 후보 (최신 main 0.115.0 후속) (설치 SVAR Core `2.7.3`), `release_required=true`, `release_authorized=false`. 정식 GHCR/tag/Release는 이번 단계 밖이다.

## 구현 범위·상태 계약

| 관점 | 읽기 전용 `projectionOrder` | 진입/수정 |
| --- | --- | --- |
| 공정 | processType → process → workArea(선택) → target | 기존 정확 Task/Assignment/Target 편집 |
| 설비 | equipmentType → equipment → target | 동일 경로 |
| 시스템 | systemType → system → target | 공유 MCS 포함, 원본 복제0 |
| Target | target → resource | 동일 Resource/Task 복귀 |

- `src/features/logistics/logistics-unified-model.ts`에서 순서, 등록된 고유 설비 quantity·시스템 수, **full** Milestone Gate 표기만 구성한다. `project-logistics-unified.tsx`는 기존 물류 구성 「통합 조회」 탭으로 진입한다. `ResourceTargetViews`, `ResourceDashboardDetails`, `useResourceDashboard`, `ResourceDrillContext`를 재사용한다.
- 공정 종류의 공통 master vs site/product occurrence 구분, WorkArea 없음/project_common/legacy 직접은 *저장 없는 조회 그룹*. 동일 Task가 여러 projection row에 나타나도 `projectionRowKey`만 화면별로 다르며 Task/Assignment/Target/instance canonical ID는 동일하다.
- **서버 고유 총계**: T0 일반 Task와 A Assignment를 구분. 기존 `summary`의 Assignment union·knownMD/MM·assignedTaskProgress를 사용한다. 겹치는 Target·공정/Resource Group 소계는 비가산. `configuredLogisticsInventory` 구성 quantity는 `targetProjection.relatedMembers`의 현재 Task 대상 coverage/물리 설치 실적과 구별한다.
- Milestone `stages[].full`은 전체 canonical membership/predecessor/Ready/Blocked. `selected` 관련 Assignment Task 수는 정보성이고 필터가 full Gate를 변경하지 않는다. marker OFF·SVAR native WBS 유지.
- 기본 compact 관점 selector, 기간·M/D/MM·Target 빠른 필터, 접을 수 있는 상세 조건, 대상 구성/Task scope 분리 요약, Tree/detail/full Gate. 조회 중/empty/invalid date/error+retry/stale/read-only/dirty/pending을 구분하고 오래된 응답의 상세 이동/수정을 차단한다. 정확 Task/Assignment·기존 Target editor 및 source/current scope·snapshot·focus 복귀를 유지한다.
- 기존 SQL read transaction·revision/fingerprint·bounded detail·2MiB/5000 Task/8000 Assignment 등 Resource API 예산 그대로. 새 캐시/저장 API·WBS 자동변경·Task 복제·물리 설치완료/공수 배분 추정 없음.

## Design Delta·공식 참고

기존 Light/compact, progressive disclosure, 표 내부 scroll/keyboard·focus, 선택 scope·snapshot·read-only 원칙을 구체화하는 **Design Delta B**. 여러 화면에 공통 적용할 새로운 원칙 A가 없어 `DESIGN.md: N/A(기존 설계 원칙의 화면별 구체화)`; UI 상세는 `PROJECT_UX.md`에 반영한다. 공식 [SVAR Samples](https://docs.svar.dev/react/gantt/samples/)의 Base/Editor/Grouping/Resource load 표현을 참고하되 [group-tasks는 PRO](https://docs.svar.dev/react/gantt/guides/data-operations/grouping-tasks/)이므로 구현에 사용하지 않는다. Gantt native WBS/timeline은 변경하지 않는다.

## 테스트·검증 경계

- `tests/features/logistics/logistics-unified-model.test.ts`: 네 관점 차원/identity distinct·동일 ID 충돌 수량 경고/full Gate를 검증하는 Vitest. 로컬 실제 실행 **NOT TESTED**.
- `tests/e2e/issue-624-logistics-unified.spec.ts`: #623 실 HTTP synthetic fixture의 두 사업장/공정·선택 WorkArea/공유 MCS·복수 Target를 재사용한다. four projectionOrder의 canonical Task/Assignment/knownMD와 동일 full Milestone Gate, 정확 detail/focus, 조회 mutation0, 같은 Gantt instance, 390/768/1024/1440/1920px document overflow/표 내부 scroll을 확인한다. 긴 이름 포함. Chromium **NOT TESTED**. 전용 최대 120초는 합성 fixture 대상의 유한 시간이며 글로벌 timeout/skip/retry를 변경하지 않는다.
- 관련 #617 pure resolver, #620 HTTP/detail/한도, #621 Resource/Target 편집, #622 Plan/Excel, #623 통합 수용, #528 exact drill, Milestone Stage Gate 기존 회귀는 원본 assertion을 유지한다. 실제 새로운 Head 결과로 별도 판정한다.
- 현재 GitHub 연결 작업 컨테이너에서는 `github.com`에 대한 git DNS 접속이 불가하여 저장소 clone·`npm ci`·typecheck·Chromium 로컬 실행 **NOT TESTED**. 새 PR의 정확 Head/Run·attempt Required CI 및 Trusted QA 실행 결과로 판단해야 하며 CI 시작 자체를 PASS라 주장하지 않는다.
- 운영/오프호스트 실증, 실제 장비 설치진척·원가·현장 데이터, 실기기/스크린리더, 서버 5000 Task 실부하 SLA는 **NOT TESTED**.

## PR CI 실패 누적 원장 / 차기 재검증

- **4차 PR CI #2879.1 실제 실패:** [Run 39009419792.1](https://github.com/planner77/masterGantt/actions/runs/39009419792), HEAD `b3eef1c21f0832f6af92571a8ed7c79080d8e6ae`, base `de863713142a92f1cac56dbae044923822bca932`, test-merge `8b5d0b91276cdb0579f5df48a92c39d08558d3dc`. QA Preflight/Policy/Typecheck/Lint/Vitest/Next build/Docker 및 Required Quality/Docker는 성공. Chromium shard 2/6에서 새 `issue-624-logistics-unified.spec.ts:107`의 390px document 폭704px(expected≤391) 실제 실패, Shard 2는 33PASS/1FAIL/85 미실행, Shard 1/3/4/5/6은 fail-fast CANCELLED(취소 로그의 중간 PASS는 보존). Required E2E/QA Final은 파생 실패.
- **원인별 보완/진단:** 신규 물류 Unified root Grid의 implicit auto track이 내부 넓은 Target/Milestone 테이블의 최소 너비를 문서로 전파할 가능성이 높다. `project-logistics-unified.module.css`의 `.root`를 `grid-template-columns:minmax(0,1fr);width:100%`로 명시. 정적 합성 Chromium에서는 390px document712→390, scroll owner388/710 유지; **실제 앱 전체 CSS geometry와 DOM 기여도는 후속 exact Head CI에서 검증**. 기존 `<=width+1`, 390px 내부 scroll·기타 다섯 폭/identity/full Gate/조회0 검증을 완화하지 않는다. 실패 재발 시 overflow 후보 DOM JSON/root·scroll width를 첨부하도록 E2E 관측 강화.
- **최신 main 정렬:** 진단 시 `main=78ec8d2ced62f543f73a8477c3e62fca8274274b` (원본 base 대비10커밋), 새 [#704 PR 실패 triage 지침](../../PR_CI_FAILURE_TRIAGE.md) 포함. 기존 PR의 제품/문서 변경을 보존하고 main의 AGENTS·CI_CD·LIFECYCLE·REMOTE_VALIDATION·TEST_PLAN·새 triage 문서를 결합한 **실제 Merge Commit**을 만든 뒤 충돌·리뷰0 확인하고 exact new Head CI를 시작한다.
- **전체 이력 재검토:** #2875.1 DOC_SYNC 경로, #2876.1 AC parser, #2877.1 React Hook ESLint은 #2879.1에서 각각 Preflight/Typecheck/Lint/Vitest PASS로 후속 교정이 확인됐고, 이번 신규 E2E overflow는 독립 Root(F-624-019)이다. 최초~현재 F-624-001~021/C-624-001 및 Cross-run matrix는 [단일 누적 원장](../../ISSUE_624_CI_FAILURE_ANALYSIS.md)에 보존한다.


- **3차 PR CI #2877.1 실패 원인 및 보완:** [Run 39008625870.1](https://github.com/planner77/masterGantt/actions/runs/39008625870) (HEAD `9e7cde9223733e2863ce015ad6e37e3d64388e6b`, base `de863713142a92f1cac56dbae044923822bca932`, test-merge `fd21a5d5e32e27da307b543f4b72171edf358ffd`). QA Preflight/Policy/TypeScript/Unit PASS(Vitest 2783/2786, skip3)이나 `project-logistics-unified.tsx:76`의 `react-hooks/set-state-in-effect` ESLint **1 error**로 PR Fast Gate가 중단. E2E6/Build/Docker는 SKIPPED, Required3/QA Final은 파생 FAIL이다. 제품 보완은 effect 내 동기 상태 설정을 제거하고 현재 query/snapshot과 일치하는 상세를 렌더에서 계산, 관점·필터 이벤트에서 명시 무효화, focus effect는 DOM만 동기화한다. 기존 정확 상세/권한·stale/복귀 계약 보존, `tests/features/logistics/logistics-unified-model.test.ts`에 snapshot/query/missing data 음성 회귀를 추가했다. 수정 뒤 로컬 ESLint/Unit/Chromium **NOT TESTED**, 새 exact-head CI에서 검증한다.
- **원장 정합화:** 기존 실패 원장 본문에서 이전 문서 갱신 중 발생한 중복 제1절/깨진 줄을 바로잡는다. F-624-001~018과 #2875.1/#2876.1/#2877.1의 각 원본 증거를 모두 남기고 같은 근인/파생과 미실행 Job을 구별한다. [누적 원장](../../ISSUE_624_CI_FAILURE_ANALYSIS.md).


- **2차 CI #2876.1**: [Run `39008123509.1`](https://github.com/planner77/masterGantt/actions/runs/39008123509), HEAD `cc7604331780bda8dfdb12d2327c290409eb8596`, base `de863713142a92f1cac56dbae044923822bca932`, test-merge `7f45152608a5489a29da2dcd0725ef98c1425109`. 최초 필수 문서 영향 누락은 해소됐으나 `AC_TEST_COVERAGE`의 `- **AC1**:`…`- **AC7**:` 표기가 정책 regex와 불일치하여 모든 AC mapping을 인식하지 못했다. 실제 제품 검증 전 Preflight → Fast Gate → Required3/QA Final로 오류 전파. AC 근거는 유지하고 헤더만 `- AC1:`…`- AC7:`로 정규화했다.
- **동일 문서의 잠재 재발 방지**: 머신 parser가 `UPDATED(설명)`을 읽지 못하므로 `DOCUMENTATION_SYNC`의 UPDATED 상태는 정확히 `UPDATED`로 통일한다. `N/A(reason)` 항목, 권한·산식/회귀·CI Gate는 보존한다. 상세 원인은 [누적 실패 원장](../../ISSUE_624_CI_FAILURE_ANALYSIS.md)에 기록한다.


- 별도 **증거·원인·보완·반복 실패 기록**: [Issue #624 CI Failure Analysis](../../ISSUE_624_CI_FAILURE_ANALYSIS.md). 2026-10-17 PR #702 / Run `39007521324.1` (HEAD `5b57374e24d9842db47a83a5f8ede99cb0dd2bbc`)의 QA Preflight에서 `DOCUMENTATION_SYNC`의 `docs/GITHUB_OPERATIONS.md` 영향 기록 누락 하나가 확정되었다.
- Full PR CI 빠른 Gate가 실패하여 TypeScript/Unit/Chromium6/Docker/Build는 **실행되지 않았다**. 이후 Quality/E2E/Docker 집계 FAIL, QA Final(required quality 미성공)은 전파 결과이며 제품 테스트 실패 증거가 아니다.
- 보완: 아래 `docs/GITHUB_OPERATIONS.md`를 명시적 `N/A(reason)`로 등록한다. `package.json`/`package-lock.json`의 `0.115.0` 버전 변경은 QA 문서 영향 합집합을 요구하나 GitHub PR/권한/CI trigger/merge/GHCR 운영 정책은 불변이다. 검증기·Required Gate나 timeout/skip/assertion을 완화하지 않는다.
- PR 코멘트의 Codex 리뷰 usage limit는 별도의 리뷰 가용성 경고이며 CI 원인으로 취급하지 않는다. 2875.1에서는 실제 review thread 0. 새로운 exact-head CI 결과·Trusted/Owner ACCEPT는 재실행 전 NOT TESTED이며 이전 실패를 PASS로 변경하지 않는다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_624.md`: UPDATED
- `docs/ISSUE_624_CI_FAILURE_ANALYSIS.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/TARGET_RESOURCE_ROLLOUT.md`: UPDATED
- `docs/LOGISTICS_DASHBOARD.md`: UPDATED
- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/API.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(Design Delta B; 새로운 전역 UI 원칙 없음)
- `AGENTS.md`: N/A(기존 실행 지침을 준수하며 지침 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(조회 UI만 확장, migration 없음)
- `docs/SECURITY.md`: N/A(기존 Public Read·편집 session/Origin/If-Match 불변)
- `docs/PR_CI_FAILURE_TRIAGE.md`: N/A(최신 main #704 공통 분석 지침을 적용하며 지침 내용·검증기/CI 정책은 변경하지 않음)
- `docs/CI_CD.md`: N/A(Required Quality/E2E6/Docker 및 Trusted/Owner gate 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(package/lock 버전 메타데이터만 변경; GitHub 운영, CI 트리거, 리뷰·병합·GHCR 승인 절차 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 Issue→PR→CI→Owner 승인 절차 그대로)
- `docs/QA_REVIEW_POLICY.md`: N/A(Owner-managed 현재 정책을 적용, 변경 없음)
- `docs/MILESTONE_STAGE_GATES.md`: N/A(full canonical Gate 계산과 원본 계약 불변)
- `docs/EXCEL_EXPORT.md`: N/A(Excel 보고서/원본 수출 계약 불변)
- `docs/SCHEDULING_ENGINE.md`: N/A(Calendar/scheduler/Gantt Core 불변)

## AC_TEST_COVERAGE

- AC1: #623 raw golden + #620 Resource Target projection vs 신규 네 관점 `summary` Task/Assignment/knownMD 비교; 신규 Unit/Chromium, 현재 NOT TESTED.
- AC2: 기존 #621/#623 editor의 이름/기간/진척/allocation/membership 개별 mutation·canonical ID 유지와 신규 exact drill/조회 저장0/포커스. 전체 교차 수정은 새 Head CI 및 수동 검증 전 NOT TESTED.
- AC3: 기존 #617/#620 resolver/typed member·#623 공유 MCS/AMR/WorkArea 없음/Legacy/다중 site fixture, 신규 Project 구성 ID distinct와 current Task coverage 분리. NOT TESTED.
- AC4: 기존 Resource `summary`, `targetProjection.relatedMembers`, `stages[].full`·`selected`; 신규 Unit Gate 및 Chromium 네 관점 full Gate 비교. 설치실적 등 비범위.
- AC5: 기존 bounded `ResourceDashboardDetails` / #528·#621 exact source/return·dirty/stale/readonly, 신규 동일 instance/복귀 focus/조회 저장0. CI 및 수동 경계 NOT TESTED. 추가 Unit: `currentLogisticsDetail`의 exact query/snapshot 일치·변경/없는 데이터일 때 상세 무효화.
- AC6: 신규 Chromium 390/768/1024/1440/1920 긴 fixture·keyboard/overflow, 기존 #620/#623 query/response 예산. 실행/실측 전 NOT TESTED.
- AC7: 동 PR의 본 DOCUMENTATION_SYNC 및 DESIGN Delta, version/CHANGELOG, active PLAN/계약/테스트 업데이트. 최종 docs gate 결과 NOT TESTED.

## QA·원격·릴리스 인계

`risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `independent_qa=N/A(Owner-managed, 독립 최종 리뷰 없음)`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`, `release_required=true`, `release_authorized=false`.

브랜치의 최신 main 대비 ahead/behind 및 충돌·review threads는 PR 게시 시 다시 확인한다. exact Head CI의 Quality/E2E6/Docker/Trusted, Owner의 HIGH 위험 수용·명시적 병합 승인 및 Main/GHCR/Finalizer·정식 Release/Issue 종료는 별도 증거/지시가 필요하다. 이번 사용자 요청은 **미해결 리뷰·충돌 해결 및 Full PR CI 시작**까지이며 CI 결과 모니터링은 하지 않는다.


## CI #2887.1 재실패 — #621 snapshot INIT_TRANSPORT 보호 및 #679 main 통합 (2026-10-17)

- 원본 [PR CI #2887.1 / Run 39014302310](https://github.com/planner77/masterGantt/actions/runs/39014302310): HEAD `105bd05786089fec2e9b76898ad01921332ba117`, base `78ec8d2ced62f543f73a8477c3e62fca8274274b`, test-merge `30c4fce5904d0fa39b30d7c928bd1828adcbb03c`; Required Quality/Docker PASS, E2E Shard3 #621 snapshot GET `ECONNRESET`, 다른5 Shard CANCELLED, QA Final required E2E FAILURE.
- [누적 실패 원장](../../ISSUE_624_CI_FAILURE_ANALYSIS.md)의 F-624-001/007/013/019(선행4 Root) 전체를 대조했다. Preflight/ESLint·Unit·Typecheck는 재발하지 않았고 #624 390px Chromium 보완은 Shard2 취소로 **미검증**. 이번 F-624-022는 제품 assertion이 아니라 격리 HTTP 전송 reset, idle socket race 가설만 존재. 최초 실패만 보고 이전 문서/제품 계약을 삭제하지 않았다.
- `tests/e2e/fixtures/target-project.ts`의 read-only `snapshot()`만 `Connection: close`로 매 GET 소켓 재사용을 피하고, 실제 전송 오류 시 2초 제한의 read-only health probe + 원인 cause로 실패를 설명한다. 무조건 재시도/skip/timeout 증가·제품 API·DB/Resource 산식 변경 없음. 실제 remote 확인 전 가설 검증 및 새 Head 결과는 NOT TESTED.
- #679 main 두 커밋의 batch publication guide·AGENTS/CI_CD/TEST_PLAN/REMOTE_VALIDATION/active PLAN·scripts/tests 새 변경을 변경 누락 없이 수용한다. 새 HEAD에서 base/main ancestry·review thread0/mergeability/Full CI 시작을 검증해야 하며 병합·Main/GHCR/Release는 승인하지 않는다.

## CI #2893.1 신규 실패 / #624 누적 REWORK과 최신 main 합류 (2026-10-17)

- [누적 실패 분석](../../ISSUE_624_CI_FAILURE_ANALYSIS.md) F-624-001(문서 영향), -007(AC 문법), -013(React Hook), -019(390px overflow), -022(#621 snapshot ECONNRESET), **신규 -025(#456 scoped Week X62 clamp)**를 전부 재조회했다. 첫 세 Root는 #2893.1의 QA/Lint/Typecheck/Unit PASS로 재발하지 않았다. #624 신규 E2E·#621 다섯 사례는 개별 PASS였으나 #624가 속한 Shard2는 CANCELLED.
- [#2893.1 Run 39021459600](https://github.com/planner77/masterGantt/actions/runs/39021459600): Head `417cc3ce1de3b00e7f90386e2dd73bf943e1ce86`, Base `4307c8cdf1cc00a87fd7bff9f5e1a0c924bb3620`, test-merge `efb02ff6beaa379cf0e54798e8e59fd939e3f8ee`. 기존 `task-editor-form-density.spec.ts:150`의 scoped Summary/Week/fullscreen 120px setup가 실제 native X62 상태를 그대로 강제한 뒤 5초 120px을 기다려 실패. Shard3 85PASS/1FAIL/1SKIP/3NOT RUN, Shard6 113PASS, 다른4 CANCELLED. Quality/Docker aggregate PASS, Required E2E/QA Final FAIL.
- 본 보완은 #456 테스트 시작 전에 `waitForGanttReadiness`로 현재 api/revision/scope/Week/query와 Core/native 120px 수용량을 함께 확인하고, 부족할 때 양 capacity>0 음성 검증 후 **한 번의 실제 수평 wheel**로 기존 timeline RANGE_EXTENSION을 준비하며 현재 안정 projection/target120 admission을 재검증한다. 원본 `scrollLeft=120`, vertical38, Editor 열기/닫기 및 메타데이터 저장 후 동일 identity·selection·column geometry 단언은 유지한다. Timeout/Skip/Retry/QA 정책 또는 제품 Gantt writer 완화 없음.
- 최신 main `c0eca9ad5bfdb6c14d98dec7c5cfd7256e4619d7`은 #552 marker-OFF/Gantt 및 `task-editor-form-density.spec.ts`의 Canonical/Visible 교정을 보유하며 app0.115.0이다. branch의 #624 편집/코드와 main의 #552 변경을 모두 보존하도록 merge parent2를 만들고 **app0.116.0 후보**로 package/lock/CHANGELOG를 동기화한다. 이번 #624 PR의 정식 릴리스 게시 승인은 `release_authorized=false`이다.
- 검증: 과거 원본 Head의 특정 PASS는 그 Head에만 유효하다. 새 merge source의 로컬 Chromium, 모든 Shard·Trusted QA/Owner ACCEPT는 새 PR CI 완료 전 NOT TESTED. 리뷰0·최신 main·test-merge 및 문서 Gate는 PR 게시 직후 재확인. 병합/Main/GHCR/Release·Issue 종료 미수행.

## CI #2897.1 — #456 Week 관측의 취소 완료 guard (2026-10-17)

- 원본 [PR #702 Full CI #2897.1 / 39026415903](https://github.com/planner77/masterGantt/actions/runs/39026415903): HEAD `2dac584abb9ee54cfd54353e6497ecf4ff72ae6d`, main/base `c0eca9ad5bfdb6c14d98dec7c5cfd7256e4619d7`, test-merge `0e2bed36b590c37884d31bd4ec3336a9bed41218`. QA/Policy/Typecheck/Lint/Vitest/Build/Docker·Required Quality/Docker 성공, Shard3 #456 test line181의 5s `Gantt observe` 실패, Required E2E/QA Final 파생 실패. Shard5/6 성공, Shard1/2/4 취소. #624 다섯 폭 신규 E2E 개별 PASS·#621 다섯 개별 PASS이나 취소 Shard를 전체 성공으로 보지 않는다.
- 실제 [Shard3 trace 12099027736](https://github.com/planner77/masterGantt/actions/runs/39026415903/artifacts/12099027736)에서 `PRIOR_CANCELLED_OPERATION_NOT_ACCEPTED` 단일 blocker. prior `RANGE_EXTENSION/SUPERSEDED/SUPERSEDED`, 최신 canonical7/7·U3 delivery SETTLED·revision20/Week/scope 일치, Core/native X18/18·capacity810/811; timeout 부족이나 제품 writer 결함 증거가 아니다. #2893의 120→62px clamp와 서로 구별한다.
- 기존 `waitForGanttReadiness` helper의 제한적 opt-in `allowCancelledPriorWork:true`를 scoped Week #456 consumer에만 사용한다. 기존 helper는 이미 취소 확정된 prior work만 허용하고 진행/실패/신규 U3 PENDING·stale는 차단한다. 신규 scoped capacity/음성 Unit과 실제 120px·vertical38·Editor/metadata·same instance 원본 단언을 보존한다.
- [Issue별 누적 원장](../../ISSUE_624_CI_FAILURE_ANALYSIS.md)에 일곱 번의 실패 #2875/#2876/#2877/#2879/#2887/#2893/#2897 및 Cross-run F-624-001~030을 보존. 변경 대상은 #456 test와 Gantt readiness pure unit, 본 Work Packet·TEST_PLAN·REMOTE_VALIDATION·원장뿐이며 제품/DB/API/CI gate/버전 변경은 없다. 새 Head의 직접/교차/음성 로컬 Chromium·Vitest는 **NOT TESTED**. `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `release_required=true`, `release_authorized=false`, `MERGE_READY=BLOCKED` 유지.


## 최신 main #703 정렬 및 PR CI #2900.1 인계 (2026-10-17)

- [PR #702 CI #2900.1](https://github.com/planner77/masterGantt/actions/runs/39028178930)에서 Head `3b0818e011000eee86271ff06a27eba03daa503b`의 Quality/E2E6/Docker와 QA Final SUCCESS. 그러나 본 후보의 old main Base `c0eca9ad...` 뒤 main이 `72bf35c1...`까지21커밋 앞서 병합 충돌이 발생했다. 원본 검증 결과를 새로운 main 통합 HEAD로 이월하지 않는다.
- 공통 조상 기반 3자 비교 결과 docs/REMOTE_VALIDATION.md·docs/TEST_PLAN.md의 #703/#624 추가 기록을 모두 연결하고, `target-project.ts`의 GET `Connection: close`와 `observedReadOnlyGet` 정규 route/안전 관측/첫 ECONNRESET 1회 GET 전용 재조회 규칙을 합쳤다.
- main #703에서 `seedIssue623` 함수의 3번째 인자가 observer로 변경되므로 신규 `issue-624-logistics-unified.spec.ts`를 `seedIssue623(page, origin, observeIsolatedApi, true)`로 수정해 기존 wide=true를 보존한다. Mutation retry0, HTTP/권한 에러 Fail-closed, Milestone full Stage Gate, 390~1920px/원시 ID/readonly/dirty/스냅샷 테스트 계약은 불변.
- 근거와 앞선 실패 전체 출처는 [Issue #624 누적 분석 §10](../../ISSUE_624_CI_FAILURE_ANALYSIS.md)에 보존. 앱 0.116.0 / HIGH OWNER_MANAGED / release_required=true / release_authorized=false. 새 Head의 로컬 TypeScript/Unit/E2E/merge 성공은 새 PR CI 종료 전 NOT TESTED이며 이번 Owner 지시는 PR CI 시작까지만, Main·GHCR·Release·Issue 종료하지 않는다.

