# Issue #624 — 물류 통합 관점 V1 Work Packet

## 기준·구현 목표

- 상위 [#613](https://github.com/planner77/masterGantt/issues/613), 선행 [#623](https://github.com/planner77/masterGantt/issues/623)(CLOSED). Baseline main `de863713142a92f1cac56dbae044923822bca932`; 작업 branch `feat/issue-624-logistics-unified-views`.
- 기준: `AGENTS.md`, `DESIGN.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/QA_REVIEW_POLICY.md`, `docs/UI_UX_GUIDELINES.md`, [물류 Target](../../LOGISTICS_TARGETS.md), [Resource KPI](../../RESOURCE_KPI_DASHBOARD.md), [Q1 수용](ISSUE_623.md).
- 기존 Resource Target projection #619/#620, Target↔WBS #617/#618, #621 canonical Task/Assignment/Target 편집·복귀, Milestone full Stage Gate를 재사용한다. 새로운 Task 원본·저장용 hierarchy/DB·계산 엔진·Gantt viewport writer·SVAR PRO는 만들지 않는다.
- app `0.115.0` MINOR 후보 (설치 SVAR Core `2.7.3`), `release_required=true`, `release_authorized=false`. 정식 GHCR/tag/Release는 이번 단계 밖이다.

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
- AC5: 기존 bounded `ResourceDashboardDetails` / #528·#621 exact source/return·dirty/stale/readonly, 신규 동일 instance/복귀 focus/조회 저장0. CI 및 수동 경계 NOT TESTED.
- AC6: 신규 Chromium 390/768/1024/1440/1920 긴 fixture·keyboard/overflow, 기존 #620/#623 query/response 예산. 실행/실측 전 NOT TESTED.
- AC7: 동 PR의 본 DOCUMENTATION_SYNC 및 DESIGN Delta, version/CHANGELOG, active PLAN/계약/테스트 업데이트. 최종 docs gate 결과 NOT TESTED.

## QA·원격·릴리스 인계

`risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `independent_qa=N/A(Owner-managed, 독립 최종 리뷰 없음)`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`, `release_required=true`, `release_authorized=false`.

브랜치의 최신 main 대비 ahead/behind 및 충돌·review threads는 PR 게시 시 다시 확인한다. exact Head CI의 Quality/E2E6/Docker/Trusted, Owner의 HIGH 위험 수용·명시적 병합 승인 및 Main/GHCR/Finalizer·정식 Release/Issue 종료는 별도 증거/지시가 필요하다. 이번 사용자 요청은 **미해결 리뷰·충돌 해결 및 Full PR CI 시작**까지이며 CI 결과 모니터링은 하지 않는다.
