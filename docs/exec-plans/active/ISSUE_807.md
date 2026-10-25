# Issue #807 — 리소스 단일 Workspace

## Issue Work Packet

- repository: `planner77/masterGantt`
- issue: [#807](https://github.com/planner77/masterGantt/issues/807); 상위 [#806](https://github.com/planner77/masterGantt/issues/806)
- lifecycle_phase: REWORK / CORRECTIVE_FULL_PR_CI_START_PENDING
- requested_scope: 분석·설계·구현·문서 동기화·리뷰/충돌 처리·실패 원장 기록·Ready PR Full CI 시작까지. CI 모니터링·병합·main/GHCR·tag/release·Finalizer·브랜치 정리·Issue 종료는 제외한다.
- baseline/main: `c69c22e248de6d2af9cc753eb0296ff97d4a2b8f`; baseline tree `ea77ef51d13660ca271e3c4159d6f7c614db8a41`
- branch/worktree: `feat/issue-807-resource-workspace`, `/home/planner/Dev/masterGantt-807`
- current_version: `0.133.3`; candidate_version: `0.133.4`
- version_decision: 기존 기능·계약을 보존하는 리소스 화면 통합/배치 교정이므로 PATCH. 의존성은 변경하지 않는다.
- release_required: true
- release_authorized: false (이번 요청은 정식 게시 승인이 아니다)
- risk_level: HIGH
- risk_reason: 리소스 host·탐색 복귀·활성 요청·필터/견적/Plan/Excel consumer와 version-only 보호 경로 영향
- qa_required: true
- qa_method: OWNER_MANAGED
- independent_review: 별도 `qa_docs` `/root/resource_qa`의 최종 LOCAL_PRE_QA PASS / DOCUMENTATION_SYNC PASS. 제품 코드·선택 회귀·원문/관측·문서·버전을 검토했으며 Trusted/Owner gate와 구분한다.
- manager_decision: NOT TESTED; MERGE_READY: BLOCKED
- issue_comment_writer: manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION

## 범위·소유권

| 담당 | 책임/파일 |
| --- | --- |
| Manager | Work Packet·관련 문서·실패 원장·버전 결정·통합·Issue 기록 |
| ui_ux `/root/resource_ux` | 읽기 전용 inventory·설계·상태/geometry·Design Delta |
| frontend `/root/resource_frontend` | `project-readonly-view.tsx`, `features/resources`의 host/adapter·전용 CSS·기존 테스트 확장·실제 before/after |
| qa_docs `/root/resource_qa` | 별도 읽기 전용 AC/code/test/docs·실행 증거 사전검토 |
| infra `/root/resource_infra` | 원격 tree/부모/bytes 동등성·Ready PR·리뷰/충돌 조회·CI 시작 확인 |

다른 Agent의 변경을 되돌리지 않으며 동일 파일 동시 작성과 재귀 위임은 금지한다. 기존 작업 디렉터리의 미추적 자료는 별도 worktree 사용으로 보존한다.

R2 [#808](https://github.com/planner77/masterGantt/issues/808)의 집계/read model, R3 [#809](https://github.com/planner77/masterGantt/issues/809)의 차트 구현, 공통 5관점 CSS·서버 API/DTO/DB·Gantt·권한·CI 정책 변경은 비범위다. #800/PR #805는 착수 시점 이미 병합·종료되어 기존 source receipt/geometry 규격을 재사용한다.

## 설계·구현 계약

```text
리소스
[기본 현황] [동적 계층 탐색] [Milestone 교차] [Resource Plan] [견적·Excel]
활성 보고의 조건·범위/기준일·확정 상태
활성 보고 KPI → 표/Plan/근거 상세
```

기존 `ProjectResourceDashboard`를 기본 현황으로 사용한다. `ProjectResourceWorkload`의 visit별 cache/provider·export lease·drill binding, `ResourceWbsDashboard`와 `ResourcePlanView`를 재사용한다. peer는 native button group·`aria-pressed`를 사용하며 숨은 영역은 hidden/inert·inactive로 둔다. 원본 편집/일정 복귀는 workspace mode와 viewId/source를 결속한다. 새 destination과 과거 방문 복귀를 구별한다.

기존 검색·동적 작업 검색·표 이름 찾기, Group/개인·current/project의 selector 의미를 합치지 않는다. 기간·기준일 등 호환 조건만 사용자 명시 인계로 적용하고 다른 선택/고급 조건은 보존한다. source snapshot을 대상 보고 확정 snapshot으로 재사용하지 않는다. 견적 peer 진입만으로 DEVELOPER Role preset을 적용하지 않는다.

loading/error/stale/권한/기간 오류는 상시 피드백을 유지한다. 비활성 요청 abort/generation, 늦은 응답·Excel lease 무효화, 정확 Task/Assignment·공동담당자 범위와 원본 복귀를 보존한다. 등록 인원/개인 배정, 선택80%/Project140%, T0/A/R, 미설정/부분합/0/null·전체 Milestone Gate 의미는 기존 서버 원장을 따른다.

| inventory 판정 | 대상 |
| --- | --- |
| KEEP | 기본 현황·Group/개인·Role/등급·검색/기간·M/D/M/M·Milestone 계층/비교·주월 Plan·일별 과투입·개발 견적·Excel·정확 원본/일정 복귀 |
| KEEP | root=Resource·개인 view spec·사용자 하위 축·등록/배정 구분·동적 Plan·동일 source/snapshot Excel |
| FIX | 기본 펼침 적층·중복 제목/보기 제어·상시 안내·동시 KPI·toolbar 정렬/여백 |
| DELETE-MERGED | `<details open data-resource-compatibility>` wrapper 및 반복 독립조건 안내. 고유 기능 삭제 없음 |

기존 system font·semantic token·14px 업무 제어/12~13px helper·8/12/16px 간격·이름 우선/tabular number·표 내부 scroll을 따른다. 44px 제어를 일괄 36px로 축소하지 않는다. 390/768/1024/1440/1920×900px의 같은 fixture/source·실제 browser에서 bounds(top/height/width)·첫 KPI/표 Y·가시 행·wrap·scroll owner를 수집한다. 키보드 Tab/Shift+Tab/Enter/Space/Escape·focus를 별도 확인한다.

Design Delta **B**(기존 Workspace-first/Compact/Progressive disclosure와 focus 계약 구체화), 국소 CSS는 **C**. 신규 공통 원칙 A 없음, 미해결 충돌 D 없음. `DESIGN.md` 수정 N/A. SVAR 기능/API·Core 구현을 바꾸지 않아 새 공식 demo 조작 증거 N/A다.

## AC_TEST_COVERAGE

- AC1: R1-AC1. 기존 두 consumer·toolbar/KPI/표·Plan/과투입/견적/Excel/복귀 KEEP/FIX/DELETE-MERGED inventory와 같은 fixture 5폭 before source/측정. 원본 `project-readonly-view.tsx`, `project-resource-dashboard.tsx`, `project-resource-workload.tsx`, `resource-wbs-dashboard.tsx`를 연결한다.
- AC2: R1-AC2. 단일 기본 현황·동시 적층 제거·control bounds/첫 KPI·표 Y/가시 행/wrap·overflow의 동일 조건 before/after 비교. 기존 compact baseline과 핵심 hit target 유지.
- AC3: R1-AC3. 기존 #736/#622/Resource Dashboard·Plan 시나리오를 확장해 5개 peer·Group/개인·Milestone 계층/비교·주월 Plan·견적/Excel·동적 spec 접근과 독립 조건/명시 인계를 검증한다.
- AC4: R1-AC4. 기존 리소스 model/API/Plan/Excel·정확 drill/복귀 테스트 재사용. 선택80%/Project140%, 등록/배정, T0/A/R, null/partial/0·full Gate·권한/revision/snapshot을 바꾸지 않는다.
- AC5: R1-AC5. 5폭 실제 browser와 영향 기반 긴 이름/0/empty/error/loading/stale/readonly·활성 고급 조건·keyboard/focus/scroll·정확 원본 왕복·숨은 fetch/응답 역전. 실행하지 않은 조합은 NOT TESTED로 분리한다.
- AC6: R1-AC6. 아래 TEST_LIFECYCLE_REVIEW의 기존 #736/cross-screen/#798/#799/#800/#622 검색 및 EXTEND/KEEP_UNIQUE 기록. 중복 full E2E·삭제/skip/timeout/retry·shard/Required 완화 없음.
- AC7: R1-AC7. PROJECT_UX/UI_UX_GUIDELINES/RESOURCE_KPI_DASHBOARD/TEST_PLAN/사용자 가이드·CHANGELOG·활성 PLAN 동기화. Design Delta B/C, DESIGN.md N/A와 계약별 N/A 사유 기록.

## TEST_LIFECYCLE_REVIEW

- 검색: `tests/e2e/issue-736-resource-dashboard.spec.ts`, `issue-730-view-composer.spec.ts`(#798/#800), `cross-screen-regression.spec.ts`, `resource-plan-dashboard.spec.ts`, #622·#530 정확 복귀·기존 resource model/API/Excel tests와 `tests/e2e/helpers/ui-geometry.ts`.
- EXTEND: 기존 Resource 진입 helper가 동적 root를 가정하므로 동적 peer 명시 선택. 기존 기능 assertion은 보존하며 workspace·상태/명시 인계·활성 요청 경계만 확장한다.
- KEEP_UNIQUE: 실제 HTTP/SQLite·readonly/401/412·stale/응답 역전·Excel/Plan·nested navigation·정확 Task/Assignment·Gantt 보존은 별도 고유 경계다. #800 observer와 provenance 검사는 느슨하게 바꾸지 않는다.
- PARTIAL_OVERLAP: #798/#799/#800 수동 관측/geometry collector는 동일 fixture·증거 형식 재사용. 현재 source의 실행 결과로 혼용하지 않는다.
- ADD/CONSOLIDATE_CANDIDATE/RETIRE_CANDIDATE: 새 중복 full spec·삭제/폐기 계획 없음. 필요한 opt-in 관측은 상시 full E2E와 구별한다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_807.md`: UPDATED
- `docs/ISSUE_807_FAILURE_ANALYSIS.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(기존 Workspace-first·compact·progressive disclosure 원칙 구체화와 국소 배치이며 신규 공통 원칙 없음)
- `docs/REQUIREMENTS.md`: N/A(기존 Resource 기능/업무 요구를 보존하는 화면 통합이며 새로운 계산이나 도메인 요구 없음)
- `docs/ARCHITECTURE.md`: N/A(기존 client host/consumer 상태 adapter 재사용이며 서버 계층·저장·Gantt 구조 변경 없음)
- `docs/API.md`: N/A(기존 조회·drill·Excel API/DTO·selector·권한·revision 및 응답 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(원본 Resource/Assignment·등록·Calendar 저장 구조와 migration 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(공수·Capacity·Calendar·Gate·진척 및 일정 알고리즘 변경 없음)
- `docs/SECURITY.md`: N/A(기존 서버 authorization·session·Origin·strong If-Match·readonly 계약 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(Import wire/schema·Excel/VBA/DRM 및 교환 지원 범위 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(기존 Excel·JSON·이미지 교환 형식과 승인 범위를 유지하며 화면 진입만 재배치함)
- `docs/EXCEL_EXPORT.md`: N/A(Export 진입 재배치만 수행하며 source/snapshot·current/project·산식·출력 형식 변경 없음)
- `docs/CI_CD.md`: N/A(기존 PATCH 버전 정책 적용이며 workflow·Required3·8shard·릴리스 권한 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 원격/환경별 gate 유지이며 이번 실행 출처와 미검증은 본 Work Packet에 기록)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 canonical PR·Trusted/Owner·릴리스 운영 정책을 그대로 적용하며 정책 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 Work Packet·문서/QA·PR Gate 적용이며 승인 범위나 Lifecycle 정책 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(Owner-managed 최종 경로와 별도 Agent 사전검토를 구분해 기존 정책을 적용하며 승인 기준 변경 없음)

## 검증·원격 인계

착수 당시 #807 기존 PR/CI 없음. [실패 원장](../../ISSUE_807_FAILURE_ANALYSIS.md)에 최초 CLI 인증 차단과 모든 실제 local 실패·리뷰/충돌·원격 게시 증거를 축적한다. quality/e2e/docker·Trusted QA·Owner/Manager ACCEPT는 NOT TESTED다.

실제 터치·screen reader·native125% zoom·운영 proxy/TLS·Windows Excel/DRM은 이번 browser 자동화와 별개 NOT TESTED다. PR CI는 등록 확인까지만 수행하며 성공 여부를 모니터링하지 않는다.

## 실제 관측·Local Fast Feedback

- [before manifest](../../../output/playwright/issue-807/before/dashboards-manifest.json): 2026-10-25 09:42:58 UTC,5폭 완결. [최종 after manifest](../../../output/playwright/issue-807/after/dashboards-manifest.json): 10:02:02 UTC,5폭 완결·fault0. collector SHA256은 전후 `128fc1268aca748ac57a5ed8532c007a4bf08c3a23ccab2ba219b011e4c29bac`로 같다.
- 양쪽 실제 DOM/app는 **0.133.3**, Next16.4.2·Playwright1.63.0/Chromium1243(version153.0.8010.12), ko-KR/Asia/Seoul·DPR1·zoom100%·900px 높이의 같은 seeded HTTP/SQLite fixture다. 최종 package PATCH0.133.4 적용은 관측 후 version-only로 분리한다. 제품6파일 hash 동등성을 확인해 Local Fast Feedback를 재사용하며 0.133.4 화면을 캡처했다고 주장하지 않는다.
- 같은 fixture의 revision17·Task4/개인 Assignment1·canonical fingerprint `87416697192d21372d57aec43b9046926e76c5e318fa7a72f131010b2afd721a`가 전후 불변, 업무 mutation0·문서 가로 overflow0(5/5)이다. before는 동적+기존 분석 적층, after는 기존 기본 현황 하나다. 서로 다른 source/selector의 지표 수나 WBS report를 직접 동등 비교하지 않는다. after `reports=[]`는 WBS를 요청하지 않는 legacy 기본 화면의 N/A이며 누락 report의 PASS가 아니다.

| 폭(px) | 기존 분석 첫 KPI Y: before → after | 기존 그룹 표 Y: before → after | after 최초 화면의 완전히 보이는 표 행 |
| --- | --- | --- | --- |
| 390 | 2612 → 1017 | 3078 → 1451 | 0 |
| 768 | 1836.5 → 670 | 2150 → 951.5 | 0 |
| 1024 | 1725.5 → 578 | 1972 → 792.5 | 0 |
| 1440 | 1518 → 526 | 1764.5 → 740.5 | 1 |
| 1920 | 1518 → 526 | 1764.5 → 740.5 | 1 |

1440/1920px에서 기본 분석 첫 KPI는992px, 표는1024px 앞당겼다. 모바일390px의 KPI/표는 여전히 첫900px 화면 밖이며 해당 폭의 above-fold 데이터 확보를 주장하지 않는다. 5폭의 빠른 필터 입력/select/button은44px로 정렬하고 1440/1920px의 top396px이 일치한다. 1024px의 필터 button은 가용 너비에 따라 다음 줄로 정상 wrap한다. 기존 표 열 예산·내부 scroll과44px target을 유지한다.

- [Unit 영수증](../../../output/playwright/issue-807/local-unit.json): 기존 model/transport4파일22/22 PASS. raw `.prepr-reports/issue807-unit.json`, SHA256 `31e2c517504e82302f68fe1b6424f1464eb40f80e7bb94b9919b9dc7978c27d1`.
- Chromium 최초 fresh batch `.prepr-reports/issue807-isolated1/report.json`: 기존 #7365case·#526/#527 각1case PASS, 새#807 control height1case FAIL(350.330초). 실패는 원장 F807-L07로 보존했다.
- 최종 선택 `.prepr-reports/issue807-final1/report.json`: **6/6 PASS, retry0/skip0/flaky0,234.262초**. #798 공통5관점5폭, #7365폭 keyboard/stale 및 선택80%/Project140% Plan·정확 외부 배정 복귀, 새#807 단일 기본면/독립 조건·기간 인계/숨은 요청·keep-mounted5폭, #525 긴 이름, #530 M1 정확 범위·새 방문 기본 현황·기존 견적 peer LIFO와 nonzero outer scroll 정확 복원을 실행했다. raw SHA256 `1fd37be6f96dd455f40519a6b9dba6cdbe613fa938c042fa2eb1f1655d32f76e`.
- 기존7PASS와 최종6PASS는 중복2case가 있으므로13개 고유 test로 합산하지 않는다. 최종 변경은 client host의 CSS 높이/scroll·Project key이며 직접 영향은 최종6case로 재검증했다. 그 밖의 기존 실제 HTTP/SQLite·Milestone/Plan·snapshot Excel/readonly/응답 역전 근거는 source별로 구분해 보존한다. 변경한 나머지 spec 전체의 실행은 원격 Full CI에 인계한다.

실제 별도 Reviewer `/root/resource_qa`는 위 raw6case/최초7PASS+1FAIL 원문·코드/단언·실패 원장과 제품6파일 hash를 독립 대조했다. 제품 파일 hash aggregate `c84dd1549946804786699cadd1b46b6fa2a5cf953baccef3be97b3eb6a1f4055`, 신규 P1/P2 없음·제품/선택 테스트 Local PRE_QA PASS. 최종 DOC_SYNC/버전·관측 검토와 최종 static 검증은 아래 인계에서 구분한다. 최초 긴 이름 timeout은 fresh 고유 output에서 재현되지 않았으며 원인 UNKNOWN을 지우지 않는다.

## 최종 문서·로컬 검증 인계

[정제 UI 영수증](../../../output/playwright/issue-807/local-ui.json)은 source/실행별 case·수치 비교·기존 결과 재사용 경계·보충 scroll 진단을 결속한다. 최종 typecheck와 변경 대상 ESLint는 PASS(exit0/오류0); 변경하지 않은 기존 `project-readonly-view.tsx:697` router 의존성 경고1개는 새 오류로 합산하지 않는다. package/lock 세 version 선언은0.133.4로 동기화했고 `verify-release-version.mjs` PASS, `verify-test-discovery.mjs` PASS(280 Unit 파일/815 browser test, root·외부 cwd 일치), Markdown341파일 링크와 diff 공백 검사가 PASS다. 전체 build/Docker·전체 Vitest/E2E는 이 로컬 선택 실행의 PASS 범위가 아니며 PR Full CI에 인계한다.

[실제 Pre-PR fast 영수증](../../../output/playwright/issue-807/prepr-fast.json)은 **BLOCKED**(exit1), sourceStable=true·selected32·UNKNOWN2·missing0·실행 step0이다. 신규 helper/관측기의 자동 매핑이 없어 중단했으며 CLI를 수정/우회하지 않았다. 수동 producer→consumer 매핑은 다음과 같다.

- `tests/e2e/helpers/resource-workspace.ts` → 기존9개 legacy spec의 동등 peer 진입. 별도 #621/#730/#736의 직접 peer 진입3개 spec과 합쳐 기존12개 spec을 확장했다. 최종 #530 LIFO 및 이전 #526/#527 실제 HTTP/SQLite·기존 legacy 시나리오에서 실행하고 기존 기능 assertion을 보존했다. 변경된 다른 spec 전체는 원격 Full CI에서 검증한다.
- `tests/manual/issue-807-resource-workspace.mjs` → 동일 기존 #798 fixture와 collector·관측 규격을 사용하는 before/after 각5폭. complete manifest·source hash·canonical 불변·overflow·동일 legacy geometry 비교를 실제 확인했으며 기존 상시 spec으로 discover하지 않는다.

이 수동 검증은 자동 Pre-PR 전체 fast PASS가 아니다. Local Fast Feedback 자체는 Unit22·선택 Chromium6·typecheck/lint·version/discovery/link의 개별 실제 결과로 기록한다. 선택기/CI 정책을 넓히거나 Required3/8shard를 바꾸지 않는다. 생성된 AGENTS/Next 설정 파일은 본인 생성 변경만 복원했고 수동 서버·CLI를 종료했다. 다른 이슈 테스트가 생성한 보조 output은 이 PR의 게시 목록에서 제외한다.

보충 scroll 검사의 최초120 기대는 native Shift+Tab이 전환 전에 이미0으로 바꾼 관측 시점 오류였다. source 변경 없이 실제 pointer 왕복120→기본0→동적120을 확인했다. [실패 원장](../../ISSUE_807_FAILURE_ANALYSIS.md) F807-L10에 잘못된 기대·기각 근거를 보존하고 최종5폭/선택6case PASS와 분리한다.

독립 최종 문서 검토와 최신 main/미해결 리뷰·원격 tree 동등성은 게시 인계에서 확인하며 PR 생성 후 Run ID/Attempt/Head/Base/Test-Merge·thread/mergeability는 Issue STATUS에 기록한다. CI 등록 이후 모니터링·병합·릴리스·Issue 종료를 수행하지 않는다.

## 게시 준비 판정

`/root/resource_qa`가 최종 제품 hash·UI/Unit 원문·before/after PNG/manifest·Pre-PR BLOCKED 영수증·수동 매핑·누적 실패·문서별 UPDATED/N/A·버전3곳·생성물 복원을 독립 확인하여 **LOCAL_PRE_QA=PASS / DOCUMENTATION_SYNC=PASS**, 새 P1/P2 없음으로 반환했다. Manager는 PR CI 시작 범위의 게시 준비를 확인했다. 이는 원격 Required3/Trusted QA·Owner 위험 수용·최종 Manager ACCEPT가 아니다.

게시 전 공개 원격 `main`을 재조회하여 baseline `c69c22e248de6d2af9cc753eb0296ff97d4a2b8f`와 같음을 확인했다. #807 기존 PR이 없어 기존 미해결 GitHub thread/병합 충돌은 N/A이고 사전 코드 지적은 조치·검증 완료했다. 최종 원격 commit의 tree/부모/full bytes 및 새 PR의 thread/mergeability·Full run 등록을 infra가 검증하고 Issue STATUS로 인계한다.


## PR #810 · 첫 원격 실패의 교정 인계 (2026-10-25)

- [실제 Full Run #3292.1](https://github.com/planner77/masterGantt/actions/runs/40184046283)에서 Required Quality·Docker는 SUCCESS, shard2 `issue-622-resource-plan-target.spec.ts:115`의 focus 복원이 직접 FAIL, 다른 7 shard는 CANCELLED, E2E aggregate·QA Final은 파생 FAIL. 초기 source `6ab0c8f8ba1b844d68e0623b201680750d7171d4`.
- [P1 리뷰](https://github.com/planner77/masterGantt/pull/810#discussion_r4370479625)와 교차 확인: 숨은 dynamic peer·이전 visit의 미확정 `data-ready`가 visible Plan의 편집 종료 포커스 복귀를 차단. 제품의 visible active receipt만 수집하도록 수정, 기존 실제 canonical report/detail의 readiness와 foreign modal cancellation은 유지.
- `AC_TEST_COVERAGE` R1-AC3/R1-AC5/R1-AC6 및 `TEST_LIFECYCLE_REVIEW`: 기존 `resource-editor-focus-return.test.ts`에 active/hidden/current visit negative regression EXTEND, `issue-622-resource-plan-target.spec.ts`에 hidden-peer 현존/복귀 단언 EXTEND. #736·#751·#622·#530 포함 주변 focus/edit/Plan·stale 범위를 교차 대상으로 유지; 신규 중복 full spec/삭제·skip/timeout/retry/CI 정책 변화 없음.
- `DOCUMENTATION_SYNC`: 기존 사용자 UX·TEST_PLAN·PROJECT_UX 문서는 기능 계약 불변으로 추가 개정 N/A; 본 Work Packet 및 [이슈 누적 원장](../../ISSUE_807_FAILURE_ANALYSIS.md)을 Run/Attempt·직접/파생/취소·수정·검증 미실행·리뷰/충돌로 증분 갱신.
- 원격 이전 Run의 실패·취소는 PASS로 승격하지 않는다. 새 exact HEAD의 Unit/E2E·Required3·Trusted/Owner 승인·Main/GHCR/Release는 CI 시작 전에 모두 NOT TESTED. 신규 교정 push는 검증 시작 목적이며 CI 완료 모니터링·병합·종료는 하지 않는다.
