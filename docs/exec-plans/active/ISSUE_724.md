# Issue #724 — 일정·대시보드·기준정보 탐색 N1

## Work Packet

- Issue: [#724](https://github.com/planner77/masterGantt/issues/724), 상위 [#723](https://github.com/planner77/masterGantt/issues/723).
- lifecycle_phase: PR_READY. 구현·DOCUMENTATION_SYNC·선정 Local Fast Feedback·독립 사전 검토 완료 후 infra가 PR_CI_STARTED로 인계한다.
- baseline: main `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`, application `0.116.0`.
- working_branch: `feat/issue-724-workspace-navigation`; 착수 시 기존 PR 없음.
- version_decision: MINOR `0.117.0`; 기존 기능을 재사용하면서 사용자 탐색·관리/분석 workflow를 확장한다.
- release_required: true (후속 제품 릴리스 필요).
- release_authorized: false. 사용자는 구현·문서 갱신·PR CI 시작까지만 요청했다. CI 모니터링·병합·main/GHCR·tag·Release·브랜치 삭제·Issue 종료는 이번 범위 밖이다.
- risk_level: HIGH.
- risk_reason: 공통 탐색·정확 drill 목적지·WBS 범위·숨김/표시·편집기 및 Gantt 인스턴스/viewport 상태에 교차 영향.
- qa_required: true.
- qa_method: OWNER_MANAGED. 사전 Agent 검토와 원격 Trusted QA 및 Owner 최종 승인은 구별한다.
- manager_decision: NOT TESTED. 원격 Required Quality/E2E/Docker·Trusted QA는 실행 결과 확인 전 NOT TESTED다.

## 범위와 소유권

N1은 탐색 shell과 기존 기능 재배치다. 상위 `일정 / 대시보드 / 기준정보`, 대시보드 `KPI / Milestone / 공정&WorkArea / 설비 / 물류 시스템 / 리소스`, 기준정보 `공정&WorkArea / 설비 / 물류 시스템 / 리소스`를 제공한다. 일정의 중복 `전체 프로젝트` 하위 탭만 제거하고 기본 전체 일정·명시 복귀·열린 여러 Summary 탭·닫기 fallback·`rootTask`를 유지한다. 일반 탭/조회 복귀는 명시 전체 scope 선택과 구분한다.

새 집계 엔진·기준정보 CRUD·프로젝트 리소스 참여 원장·숨은 Target 생성·조회용 WBS 변형·marker ON은 비범위다. 기존 Target은 해당 기준정보의 보조 호환 경로로 유지한다. #725/M1, #726/M2, #727/M3, #730/U1 및 관점별 후속이 공개 subview/screenKey 계약으로 연결되며 host를 각자 재작성하지 않는다.

| 담당 | 소유 파일/책임 |
| --- | --- |
| Main/Manager | 계획·version/package/lock·DESIGN·화면/요구사항/아키텍처/검증/사용자 가이드/CHANGELOG·Issue 진행 기록 |
| ui_ux `navigation_design` | 읽기 전용 설계·기능 보존표·키보드/상태 검토 |
| frontend `navigation_implementation` | Project host/routing/CSS, 최소 logistics/resource adapter 및 관련 코드 |
| 지정 테스트 담당 | 기존 탭/범위 E2E 갱신 및 직접·인접·음성 회귀 |
| qa_docs | 구현자와 분리된 읽기 전용 사전 검토; 원격 QA/Owner 승인 대체 금지 |
| infra | 최종 변경 묶음 게시·PR 작성·정확 Head CI 시작 확인; 모니터링 금지 |

같은 파일을 여러 Write Agent가 동시에 수정하지 않는다. 전역 Resource 관리자 인증과 Project 편집 권한은 분리한다. 기존 server session/Origin/If-Match/revision·dirty/pending/stale·정확 Task/Assignment ID 계약을 유지한다.

## 인수 기준과 검증 매핑

| AC | 요구사항 | 검증 |
| --- | --- | --- |
| AC1 | 정확한 3개 상위/6개 분석/4개 기준정보 순서와 기존 기능 접근 | 기존 Workspace tab E2E·screen routing unit·5폭 Chromium |
| AC2 | 전체 일정 기본/복귀·Summary 추가/선택/닫기·여러 열린 root·deep link·필터 보존 | 기존 subtree Workspace tab E2E·scope/filter 회귀 |
| AC3 | 탭 전환 canonical write/Task·Assignment 복제0, 동일 Gantt/API·scale/scroll/selection/fullscreen·marker OFF | 기존 Workspace/Gantt peer·Resource KPI 통합 회귀 |
| AC4 | Milestone/KPI/Resource 편집·Target 보조 호환, readonly/dirty/pending/stale·오류 복귀 | 기존 Milestone/Target/Resource 정확 drill·Editor 회귀 |
| AC5 | 390/768/1024/1440/1920px·ARIA/roving focus/Arrow/Home/End/Enter/Escape·내부 overflow·숨은 panel focus 차단 | 기존 탭 E2E 갱신·실제 Chromium; 중복 spec 금지 |
| AC6 | DESIGN/현재 화면/사용자 경로·screenKey/매뉴얼 영향 정합성 | 문서 링크·경로 검사·독립 사전 검토 |

GSC-01/04/06~11 및 기존 SC-11의 표시·상태·권한·동일 인스턴스/viewport 계약을 적용한다. 상위 전환을 새 writer/강제 remount로 해결하지 않는다. 기존 #399/#407/#418/#497/#518/#548/#552/#667 증거는 취소하지 않으며 과거 메뉴 설명과 현행 계약을 구별한다.

## DOCUMENTATION_SYNC

- `DESIGN.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/LOGISTICS_DASHBOARD.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/API.md`: N/A(탐색과 기존 편집 진입만 이동하며 서버 endpoint·입출력 계약은 변경하지 않음)
- `docs/DB_SCHEMA.md`: N/A(기존 원본과 관리자 재사용이며 schema·migration·저장 원장 추가 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Milestone 관련 테스트의 메뉴 진입만 이관하며 날짜·계층·집계 알고리즘 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(Resource Excel·교환 회귀의 메뉴 경로만 이관하며 교환 형식·권한·보존 계약 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(기존 Import·Copy·Export 경로의 탐색만 유지하며 JSON·CSV·Template schema 변경 없음)
- `docs/EXCEL_EXPORT.md`: N/A(Excel 회귀의 진입 메뉴만 이관하며 시트·헤더·수식 방어·출력 수치 계약 변경 없음)
- `docs/SECURITY.md`: N/A(기존 Project session과 독립 관리자 인증을 재사용하며 Origin·revision·권한 정책 변경 없음)
- `AGENTS.md`: N/A(기존 역할·검증·매뉴얼 영향 및 승인 지침을 적용하며 실행 지침 자체의 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 구현·문서·사전 검토·PR CI 시작 경계를 적용하며 Lifecycle 정책 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(HIGH OWNER_MANAGED·독립 사전 검토와 별도 Owner 승인 경계를 적용하며 QA 정책 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 단일 Refs·branch·PR·출처 및 게시 절차 재사용으로 운영 정책 변경 없음)
- `docs/CI_CD.md`: N/A(후보 버전만 동기화하며 CI Workflow·Required Check·Main/GHCR·Release 정책 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 Required 회귀와 실제 환경 증거 구분을 유지하며 검증 정책 변경 없음)

- required_docs: `DESIGN.md`, `docs/PROJECT_UX.md`, `docs/UI_UX_GUIDELINES.md`, `docs/TASK_EDITOR.md`, `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/TEST_PLAN.md`, `docs/TARGET_RESOURCE_USER_GUIDE.md`, `docs/exec-plans/active/PLAN.md`, `CHANGELOG.md`, 이 Work Packet.
- documentation_owner: Main/Manager.
- Design Delta A: 관리(원본 등록/편집)와 분석(조회/원본으로 이동)을 상위 탐색에서 구분하고 동일 ID/API/editor를 재사용하는 원칙을 DESIGN에 승격한다.
- API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY: 새 endpoint/schema/계산/권한 정책 변경이 없으므로 N/A. UI 이동이 기존 보호 계약을 완화하지 않는다.
- CI_CD/REMOTE_VALIDATION: workflow/required checks/runner·GHCR·검증 환경 정책 변경이 없으므로 N/A. 실제 검증 상태는 TEST_PLAN/여기에 기록한다.
- UI_UX_GUIDELINES: #518의 현재형 구 메뉴/다른 peer hidden 설명을 #724의 3/6/4 탐색·전체 measured overlay로 교정했다. AGENTS/ISSUE_LIFECYCLE은 기존 문서 동기화/역할/gate 절차 재사용으로 N/A.
- #717 이름 우선/#719 설명 밀도: 미병합 구현을 포함한 것으로 주장하지 않으며 새 메뉴는 제품명 우선·상황형 보조 경로를 사용한다.
- #720: 착수 main에는 매뉴얼 제품 route/icon/registry가 없다. N1의 screenKey·이전 경로 대응표를 PROJECT_UX 및 사용자 가이드에 기록한다. `/manual`을 구현한 것으로 주장하지 않으며 향후 registry/anchor 연계는 #720 소유다.

## AC_TEST_COVERAGE

- AC1: `tests/features/project-workspace-navigation.test.ts`, `tests/e2e/project-workspace-tabs-518.spec.ts`의 정확 3/6/4 메뉴·기존 host/subview 매핑 및 실제 기능 접근.
- AC2: `tests/e2e/task-context-menu-hierarchy.spec.ts`의 기존 #399/#407/#373 Summary 생성/선택/닫기·마지막 fallback·rootTask·scope별 검색 및 대시보드 왕복, `project-search-filter.spec.ts`의 조회 조건.
- AC3: `tests/e2e/project-workspace-tabs-518.spec.ts`, `project-workspace-ux.spec.ts`, `resource-kpi-integration-ui.spec.ts`의 동일 Gantt/API·scroll/scale/선택·LIFO·무쓰기; 기존 Gantt/Milestone 표시 회귀의 marker OFF 단언 보존.
- AC4: `tests/e2e/milestone-management.spec.ts`, `logistics-target-authoring.spec.ts`, `issue-624-logistics-unified.spec.ts`, `resource-kpi-integration-ui.spec.ts`의 Milestone 추가/dirty/pending, Task/정확 Assignment/Target 편집·원본 불변·복귀.
- AC5: `tests/e2e/project-workspace-tabs-518.spec.ts`, `project-workspace-ux.spec.ts`, `project-logistics-management.spec.ts`, `issue-624-logistics-unified.spec.ts`의 Chromium 390/768/1024/1440/1920·ARIA/roving/Arrow/Home/End/Enter/Escape·visible fallback·내부 overflow·숨은 panel focus 차단.
- AC6: `node scripts/check-markdown-links.mjs`, 실제 screenKey/이전 경로/매뉴얼 영향 대응표와 변경 코드·사용자 가이드·DESIGN·공통 UX 및 읽기 전용 독립 사전 검토.

## 실행 및 인계 원장

- PLAN: 실제 GitHub Issue/상위 및 main 확인, 격리 worktree 생성. 기존 주 작업공간의 미추적 증거와 branch는 보존했다.
- GitHub CLI credential은 401. 연결된 GitHub 도구로 조회·Issue PLAN 기록, 공개 git read로 최신 main을 확보했다. 토큰/비밀값은 출력·저장하지 않았다.
- 실제 실행: Main + 읽기 전용 ui_ux + frontend, 이후 테스트/qa_docs/infra 순차 handoff. 독립 Agent 사전 검토는 인간 APPROVED 또는 Owner ACCEPT가 아니다.
- Source freeze: frontend source6파일 구현 후 typecheck PASS, 변경 source ESLint0error/기존 warning1, source diff-check PASS. 추가 수정 시 관련 결과를 새 source에서 재검증한다.
- Local Fast Feedback: routing unit36 PASS(초기21개 이후 호환/음성 입력 추가), 아래 최종 Chromium 보완6개 PASS. 기존44 spec의 경로 이동은 helper로 실제 상위→하위 메뉴를 조작하며 의미/음성 단언은 유지한다.
- PR Quality/E2E/Docker·Trusted QA: NOT TESTED.
- 환경별 수동 UX/스크린리더·운영 배포: NOT TESTED; 자동 Chromium과 별도다.
- issue_comment_writer: manager. Agent는 결과에 issue_log_type/summary/decision_required를 반환하고 원격 댓글을 독자 작성하지 않는다.
- 다음 담당: 구현/테스트 → 문서 정합성 및 사전 검토 → infra 원격 PR·CI 시작. 첫 실패부터 `docs/ISSUE_724_FAILURE_ANALYSIS.md`에 누적 기록한다.

### 사전 검토 REWORK

읽기 전용 `navigation_review`가 정확 Logistics drill/Editor의 원래 trigger 소실 시 숨은 구형 탭·입력으로 focus가 이동하는 fallback 세 곳을 지적했다. frontend가 visible screenKey/control/heading 복귀로 보완하고 기존 #624 통합 테스트의 trigger 교체 음성 회귀로 검증한다. 보완 후 source typecheck·ESLint0error/기존warning1 및 diff-check는 PASS이며 runtime 관련 재검증을 진행한다. Target 테스트의 잘못된 logistics helper 목적지 및 UI_UX_GUIDELINES 현재형 구 메뉴 설명은 교정했다. 원격 QA/Owner 승인과 별도 사전 코드 검토이며 모든 실제 결과는 누적 원장에 보존한다.

코드·문서 독립 사전 재검토: `navigation_review` PASS. source host SHA256 `614a93a2a780bf1a7900825cc95a7b59b05fce7808bb59952bc518919c3799fb`, Management SHA256 `595d71a3fd61fc11737b2c00cfee66e21414ec117b24babb6165d3b33bf2a422`에서 원래 세 focus 지적 및 테스트·문서 교정을 실제 확인했다. 이는 런타임 최종 결과나 원격 Trusted QA·Owner 승인 대체가 아니다. 실행 중인6케이스 이후 실패한 DOM 준비 selector는 같은 기존 #624 테스트에서만 재검증한다.


### 런타임 음성 회귀 L9

위 source 해시의 사전 검토 PASS 뒤, #624 실제 Chromium에서 Task Editor 종료 시 원래 trigger 교체 후 같은 Task 버튼 focus가 복원되지 않았다. 일정 drill의 보이는 exact 탭 복귀는 PASS이며, Target 복귀 음성은 앞선 실패로 미실행이었다. L8 준비 selector 실패와 구분하고 actual activeElement/modal/visible 후보 진단 후 frontend REWORK·동일 테스트 재검증을 수행한다. 이전 사전 PASS를 이 미해결 런타임 항목의 PASS로 재사용하지 않으며 원격 게시를 보류한다.

L9 실제 진단2: Task Editor 종료 후 `BUTTON#project-tab-dashboard.process`(공정&WorkArea), visible=true/hiddenAncestor=false/disabled=false, screen=dashboard.process, 열린 modal0. 같은 화면의 보이는 탭은 원래 설계가 허용한 fallback이므로 Task 버튼만 기대한 신규 음성 oracle의 TEST_CONTRACT 오류로 분류했다. source는 사전 검토 해시 그대로 동결하며 검증은 정확 화면의 visible control/heading/tab 전체를 검사한다. Task/Assignment control이면 canonical ID 일치도 요구하고 body/숨은 요소/다른 화면은 실패로 유지한다. 진단1에서 먼저 실패한 일정 복귀의 실제 activeElement는 미수집 UNKNOWN으로 남기고 최종 동일 테스트에서 해당 경로를 다시 검증한다.


## 최종 로컬 결과 및 게시 인계

- 구현·DOCUMENTATION_SYNC: PASS. 기존 3/6/4 실제 기능을 이관하고 DESIGN·현재 화면·사용자 경로·공개 adapter·#720 매뉴얼 영향을 동기화했다. 신규 집계/CRUD/참여 원장·정식 게시/병합은 수행하지 않았다.
- 최종 코드·문서 및 test-contract 사전 검토: navigation_review PASS. 원래 source focus3곳 지적을 보완했고 L9 실제 진단과 최종 허용 fallback 검사가 기존 AC를 약화하지 않음을 별도 확인했다. 동일 source hash 유지.
- Local Fast Feedback: routing36 unit PASS, typecheck/변경 source ESLint0error·기존 warning1 PASS. 테스트 lint/diff/버전·Markdown 검사 결과를 최종 인계에 포함한다.
- Chromium: 초기29=27 PASS/2 FAIL, 기본 compiler 선택14=12 PASS/2 FAIL, 보완6=5 PASS/1 FAIL. 각 실패의 원인·교정·추가 진단은 누적 원장을 유지한다. 최종 #624 단독은23.0초/전체39.4초 PASS이며 보완 대상6개는 동일 source의5 PASS와 이1 PASS로 모두 통과했다. 중복 실행을 고유 케이스 수나 단일6/6 run으로 합산하지 않는다.
- 최종 #624는 기존4관점/같은 raw ID·전체 Milestone Gate·390/768/1024/1440/1920px·정확 Task/Assignment·origin 소실3종·writes0·full snapshot·같은 Gantt를 실제 Chromium/HTTP·SQLite로 확인했다. 개별 회귀는 TEST_PLAN 실행표 참조.
- 화면 증거: 고정 fixture [390px 대시보드](../../evidence/issue-724/navigation-390.png), [1440px 기준정보](../../evidence/issue-724/navigation-1440.png). 최종 보완 source에서 갱신했으며 운영 DB/사용자 자료가 아니다.
- 원격 Quality/E2E/Docker·Trusted QA/Owner ACCEPT: NOT TESTED. 기본 OWNER_MANAGED의 정식 independent_qa는 N/A이며 위 실제 Agent 사전 검토를 인간 APPROVED나 Owner 승인으로 전용하지 않는다.
- 환경별 수동 UX·스크린리더·운영 배포, main/GHCR·정식 Release/tag: NOT TESTED/요청 범위 밖. release_authorized=false 유지.
- infra 인계: 테스트 자동 생성 next-env/tsconfig·tracked 실측 output은 신규 증거를 밖에 보존하고 baseline으로 복원한다. 신규 untracked output도 별도 보존하고 source/tests/docs/버전/PNG2만 게시한다. 최신 main·원격 branch/PR 부재·전체 tree·부모를 재조회 검증한 한 번의 최종 ref 게시 및 PR Full CI 시작만 수행한다.
- 최종 PR/Head/Run/Attempt URL은 원격 생성 후 Issue STATUS 및 최종 보고에 남긴다. CI 완료를 모니터링하거나 병합·Issue 종료하지 않는다.


최종 정리: typecheck PASS, 변경46테스트 ESLint0error0warning, routing36/36 PASS, diff-check·version0.117.0·Markdown 링크 PASS. 최종 세 복귀 실제 focus는 모두 보이는/활성/동일 host의 공정&WorkArea 탭이며 screenKey는 process/process/target이다. [검증 JSON](../../evidence/issue-724/local-validation.json)에 source6 SHA256·실제 focus·실행 경계를 남겼다. Next 자동 생성 next-env/tsconfig 및 tracked cross-flow 실측 파일은 baseline으로 복원했고 신규 실측은 별도 /tmp에 보존했다. 현재 미해결 로컬 지적 없음, 원격 PR CI 등록은 infra에 인계한다.


### PR CI 첫 원격 실패 F01 / 리뷰·최신 main 충돌 보완 (2026-10-18)

[Run #2947.1](https://github.com/planner77/masterGantt/actions/runs/39099275805) HEAD `ab5693ab911f280188f783865448940ab1aa3543`에서 Chromium shard1 #551 Chart 563→510px가 직접 실패했고 다른 5 shard는 취소되었다. QA Final은 E2E 실패 및 mergeability/test-merge 불일치를 보고했다. 원격 최초 F01과 과거 로컬 L1–L10의 교차 분석·근본 원인·수정·추후 재발 대응은 [#724 단일 누적 원장](../../ISSUE_724_FAILURE_ANALYSIS.md)에 기록한다. 비활성 일정 패널 measured-height 보존, 보조 화면 ARIA 선택/roving 일치, 기존 E2E 엄격 단언과 추가 직접 회귀, 최신 main #719 도움말/테스트/문서/버전 충돌 보존을 수정 후보에 적용한다. 새로운 exact Head의 Required3/Trusted QA/Owner ACCEPT는 아직 **NOT TESTED**. `release_authorized=false`, 병합·Main/GHCR·Issue 종료·CI 완료 모니터링은 요청 범위 밖이다.


### PR CI #2949.1 누적 실패 F02 — 기존 #552 Summary 복구 selector 교정

- [원본 Run 39101001199.1](https://github.com/planner77/masterGantt/actions/runs/39101001199) HEAD `7d61e956686aff0fa66a06c677c60a53d5dee6f8`, Base `7393483c4a15007868fceeaee70fb9e13c8b119a`, test merge `c4540dd3c7d6887660fffe9ce58fdde4d51d1c69`. Quality/Docker PASS, Chromium shard4의 `milestone-visibility.spec.ts:145` strict locator 2매칭 FAIL, 다른5 shard 취소 및 QA Final required E2E FAIL. 새 코드의 모든 E2E 결과는 아직 미확정.
- [누적 실패 원장 F02](../../ISSUE_724_FAILURE_ANALYSIS.md)에 과거 L1–L10/F01 전체와의 공통 TEST_CONTRACT 유형·미검증 경계를 기록한다. 기존 Summary→Milestone 명시 복구에서 경고 내부 복구 버튼만 정확히 선택하고 상단 전역 버튼의 `aria-pressed=false`를 확인한다. 클릭 이후 동일 Gantt/native Milestone 제거/무쓰기 단언은 보존한다.
- 재확인한 최신 main `7393483c4a15007868fceeaee70fb9e13c8b119a`는 현재 HEAD에 합류 완료(behind=0), PR mergeable=true, 미해결 리뷰0; 불필요한 second merge를 만들지 않는다. 새 수정 Commit Push 시 새 Full PR CI가 시작되어야 하며 모니터링/병합/Main/GHCR/Issue 종료는 하지 않는다. 원격 결과·Owner ACCEPT는 **NOT TESTED**, release_authorized=false.


### PR CI #2950.1 F03 — #719 신규 E2E 탐색 계약 합류 (2026-10-18)

- 원본 [Run 39102030888.1](https://github.com/planner77/masterGantt/actions/runs/39102030888), HEAD `dc5e4107bad8adc9a3b8eecdf264b2335fba1e11` / Base `7393483c4a15007868fceeaee70fb9e13c8b119a` / test merge `b056100a718f475c813ae009f4149147bf9004c3`. Quality/Docker PASS, Chromium shard2 #719 `openSurface`의 구 상위 Milestone 탭 lookup 120s timeout, 나머지5 shard CANCELLED, QA Final required E2E FAIL.
- 누적 [#724 실패 원장 F03](../../ISSUE_724_FAILURE_ANALYSIS.md)에는 L1–L10/F01/F02와 비교·원인·다른 shard 미검증·수정 대상을 추가한다. 동일 #719 파일의 *두* 낡은 navigation 경로를 공유 2단계 Workspace helper로 변경한다. Milestone/리소스/KPI와 공정 없는 설비 경로의 visible selected-tab 단언을 보존·추가하고 기존 도움말·미저장·5폭·focus/모달·초안 테스트를 전부 유지한다.
- #719은 최신 main의 이미 병합된 기능이며 원본 도움말 제품 코드/테스트 정책을 되돌리지 않는다. 현 시점 latest main 정렬 behind=0·충돌0·리뷰 스레드0. 새 HEAD의 실제 PR Quality/E2E6/Docker/Trusted QA 결과와 Owner ACCEPT는 실행 전 **NOT TESTED**. release_required=true / release_authorized=false, 병합·Main CI·GHCR·Issue 종료 또는 CI 모니터링은 요청 범위 밖이다.


### PR CI #2951.1 누적 F04 — #572 숨김 Gantt 계약/테스트 일치화 (2026-10-18)

- 원본 [Run 39103122269.1](https://github.com/planner77/masterGantt/actions/runs/39103122269), HEAD `39c4e250a4cf64db7a32444d6a965c9127a38d53`, Base `7393483c4a15007868fceeaee70fb9e13c8b119a`, test merge `2f1642ec3b7ad5f6595333ae57b4c16b01b522a3`. Quality/Docker PASS, shard2 `project-gantt-inline-name.spec.ts:159` resource peer의 옛 `hidden` 기대가 실제 `inert/aria-hidden`과 어긋나 FAIL; 기타5 shard 취소, QA Final required E2E FAIL. Shard2의 #719 10건은 PASS.
- [단일 누적 #724 원장 F04](../../ISSUE_724_FAILURE_ANALYSIS.md)에 L1–L10/F01/F02/F03 전부와 비교·실제 상태·cancelled/NOT RUN·수정 범위를 보존한다. #572 기존 resources/milestones 양쪽의 inactive `inert/aria-hidden/data-dashboard-inactive/visibility:hidden`, active 복귀 시 속성 제거/visibility:visible과 같은 Gantt instance를 검증한다. 단일 PATCH/Revision/저장 확정/Row·focus/오류 회귀는 삭제하지 않는다. 제품·서버/DB·CI gate/timeout/skip/retry 변경 없음.
- 최신 main 정렬/리뷰/mergeability 별도 확인 후 PR HEAD에 문서·테스트 좁은 수정 커밋을 게시한다. 새 exact Head의 Full PR CI, Trusted QA·Owner ACCEPT는 실행 후 증거 전 **NOT TESTED**. release_required=true, release_authorized=false. 이번 요청은 PR CI 시작까지이며 CI 완료 모니터링·병합·Main/GHCR·이슈 종료는 하지 않는다.


### PR #738 — PR CI #2953.1 F05 (2026-10-18)

- 원본 [CI #2953.1 / Run 39104119364](https://github.com/planner77/masterGantt/actions/runs/39104119364), event pull_request, HEAD `f8ac8806d3a2950848eb9d2f633fa1ec55655d9b`, base `7393483c4a15007868fceeaee70fb9e13c8b119a`, test-merge `1f5d165db4b3391a515fbfad8224d437fd1bcb0c`. Required Quality/Docker success, Chromium Shard 4 #529 focus 104 PASS/1 FAIL/38 NOT RUN; 2/3/5/6 success, 1 cancelled, QA Final derived E2E failure.
- [#724 이슈 전용 누적 원장 F05](../../ISSUE_724_FAILURE_ANALYSIS.md)에 L1–L10·F01–F05 전체 비교와 최초 E2E assertion/trace·수정·남은 미검증을 추가했다. AGENTS.md §#704 및 [CI triage 지침](../../PR_CI_FAILURE_TRIAGE.md), GSC-07/08/09/11, #724 PROJECT_UX 정확 screenKey 복귀, CI no-bypass를 참조했다. 원본 DOM activeElement ID는 UNKNOWN으로 보존한다.
- **영향/변경:** `src/features/projects/project-excel-export-button.tsx`의 유효성 확인 및 2-level selected-tab 우선순위. Modal/Resource/Task·Assignment/주된 Gantt 상태·서버 JSON/DB/보안·export 결과·버전 `0.117.0`은 변경하지 않는다. `tests/e2e/resource-excel-export-dashboard.spec.ts`의 #529 stale/focus에서 부모 및 자식 selected 중 child 실제 focus·parent nonfocus·원래 숨김 trigger 검증을 강화한다. 기존 직접 #529 5폭/export 오류/409, #572/#551/#552/#719/#624 소비자 교차 회귀는 축소하지 않는다.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_724_FAILURE_ANALYSIS.md`, `docs/exec-plans/active/ISSUE_724.md`, `docs/TEST_PLAN.md` UPDATED; `DESIGN.md`, PROJECT_UX, UI_UX_GUIDELINES: N/A — 같은 visible exact-screen fallback의 **기존 규칙을 준수**하는 오류 수정이며 상위 메뉴 설계/ARIA/데이터 계약 신규 변경 없음. API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/CI_CD/REMOTE_VALIDATION/AGENTS: N/A — 서버/권한/일정/검증 운영 규칙 불변. Code/test/doc만 한 번의 논리적 변경 묶음으로 게시.
- **검증 경계:** 실제 localhost full source/node_modules/Playwright browser를 사용할 수 없으므로 로컬 E2E와 전체 CI-like 명령은 NOT TESTED; 기존 Run PASS를 새 HEAD의 결과로 이월하지 않는다. 현재 main 정렬, review threads=0, mergeable conflict=none을 PR branch 업데이트 전에 재확인한다. 신규 Head PR Full CI 시작 후 모니터링·병합·Main CI·GHCR/Release/Issue 종료는 사용자 요청 범위 밖. Risk HIGH, QA OWNER_MANAGED, Manager ACCEPT NOT TESTED, `release_required=true`/`release_authorized=false`.

### Main CI M01 (#2957.1) / corrective PR scope

- GitHub [Main #2957.1](https://github.com/planner77/masterGantt/actions/runs/39108991895), exact SHA `ea4194763568432ef98e823bb796b59a5beb317c`: Required Quality/Docker and shard1/2/4/5/6 success, shard3 #456 120px Core+native capacity admission FAIL (91PASS/1FAIL/1SKIP), aggregate E2E FAIL, ci-image SKIPPED. Issue remains open and release v0.117.0 remains unauthorized to *proceed* until all CI/digest gates pass (Owner's explicit conditional authorization [comment](https://github.com/planner77/masterGantt/issues/724#issuecomment-6247282437) remains on record).
- Compare [#724 L1–L10/F01–F05 + M01](../../ISSUE_724_FAILURE_ANALYSIS.md), #624 F-624-025 same #456 120/62 capacity history, GSC 1.0.0-candidate §05/07/08/09/11 and AGENTS.md #704. Root issue is test setup not guaranteeing timeline capacity; actual product bug remains UNKNOWN. Use test-only `scrollCapacityWitness` normal future Task in scoped WBS; no product writer/DOM synthetic width/skip/retry/timeout change. Preserve exact 120/38 + prior Editor/canonical/selection/one PATCH claims.
- DOCUMENTATION_SYNC: same #724 ledger, Work Packet, TEST_PLAN UPDATED; DESIGN, PROJECT_UX, API/DB, SECURITY, GSC and CI policies N/A (no change to contract). New corrective branch/PR against latest merged main required; PR Full CI then Trusted QA/Owner approval and merge precede new Main CI. Tests not locally executed in restricted connector environment, new Head actual CI NOT TESTED. No Main force push or uncorrected rerun; release/finalizer/issue close BLOCKED until full gates.


### Main 복구 재개 — PR #740 F06 정책 선언 보완 (2026-10-18)

- 현재 요청은 Main #2957 실패 분석·보완, 미해결 리뷰/충돌 정리와 **수정된 새 Main CI 시작**까지다. 앞선 PR CI 시작까지만인 범위 기록은 당시 이력이며 현재 요청의 범위를 제한하지 않는다. 새 Main CI 완료 모니터링·정식 release/Issue 종료 결과는 별도다.
- [#740 Full #2960.1](https://github.com/planner77/masterGantt/actions/runs/39111327137)은 본문의 세 정책 선언을 한 문장에 넣어 QA route/Preflight가 읽지 못했다. Quality/E2E/Docker 구현은 실행 전 SKIPPED, Required3는 파생 FAIL이다. [단일 누적 원장 F06](../../ISSUE_724_FAILURE_ANALYSIS.md)에 M01과 구분하여 원본 Job·전체 결과·교정·재발 절차를 추가했다.
- 각 위험도/QA/release 필드를 별도 줄로 교정하고 base parser·DOC_SYNC/AC1–AC6 검증 PASS 및 preflight10 PASS. 실제 Chromium 직접 #456 PASS, 변경2파일 ESLint·typecheck PASS. 과거 실패 합집합의 최종 source 검증 결과는 아래 추가한다. 제품 source/CI/gate/timeout/skip/retry/version 변경 없음.
- 교정 PR 자체는 version 불변으로 release_required=false/release_authorized=false. #724 원본 제품의 release_required=true와 [Owner의 v0.117.0 조건부 승인](https://github.com/planner77/masterGantt/issues/724#issuecomment-6247282437)은 유지하며, 새 Main/GHCR/Finalizer 성공 전 릴리스나 Issue 완료로 판정하지 않는다.
- DOCUMENTATION_SYNC: `docs/ISSUE_724_FAILURE_ANALYSIS.md`, 이 Work Packet, `docs/exec-plans/active/PLAN.md`, `docs/TEST_PLAN.md` UPDATED. DESIGN/API/DB/SECURITY/CI_CD/REMOTE_VALIDATION N/A(기존 제품·서버·보호·검증 정책 계약 불변). 새 exact-head Full3/Trusted QA 통과 및 Owner 병합 판단 후 표준 한 줄 제목/빈 본문의 two-parent merge로 Main CI를 시작한다.


### Main 복구 후보의 최종 로컬 결과

같은 fixture/spec 지문(91774c62/f85f4010)에서 누적9파일91 PASS(7.0분)+인접5파일12 PASS(2.1분), **103개 고유 Chromium 케이스 PASS**, 실패/skip/retry0. 별도 직접 #4561 PASS는 중복 수로 구분한다. 원본 Core62/native63<120은 scoped Task 보완 후 실제1354/1355로 admission 통과했고 exact X120/Y38·같은 Gantt/선택/열/범위·Editor 취소/metadata PATCH1을 보존했다. source/test 변경0. 변경 lint/typecheck·base parser·preflight10·Markdown/version/diff PASS. Pre-PR 자동 선택은 미등록 fixture 매핑 UNKNOWN으로 BLOCKED이며 수동 실제 소비자 선정·검증을 별도 기록했다. 전체 원격 Required3/Trusted/Main/GHCR의 PASS가 아니다. 별도 infra 읽기 전용 소스·문서 검토 PASS, 사람 Owner/Trusted 승인 대체 없음. 전체 이력·정확 지문·명령/환경·미실행·승인 경계는 [누적 원장](../../ISSUE_724_FAILURE_ANALYSIS.md)에 기록한다.
