# Issue #461 완료 단계 Editor 실행 계획

## 요청 범위와 단계

Epic #459의 [#461](https://github.com/planner77/masterGantt/issues/461) AC 전체를 구현한다. 현재 단계는 PR_READY다. 구현·DOCUMENTATION_SYNC·독립 UI 비교와 사전 QA를 완료했다. 중단된 기존 브랜치와 미커밋 구현을 보존해 사용자 재요청으로 재개했다. 사용자 종료점은 구현·문서 동기화·push·PR 생성·exact head PR CI 시작이며 CI 완료 모니터링·병합·main GHCR·정식 릴리스·브랜치 정리·Issue 종료는 범위 밖이다. 과거 본문의 registration-only는 최신 구현 요청으로 대체한다.

현재 PR_READY다. ui_ux와 qa_docs가 최종 source·문서·브라우저 증거 및 manifest 29개 파일을 독립 확인하여 사전 검토 PASS를 반환했고 차단 finding은 없다. freeze manifest `/tmp/issue461-frontend-manifest-final.json`의 SHA256은 `5b7d7bab6b4df1bbbdd1251ac2d4baedfcca011cfe06c587250e6b44d142e087`이다. 이 판정은 공식 원격 회귀·최종 QA·제품 ACCEPT가 아니다. 원격 commit의 동일 tree 연결을 확인한 뒤 PR CI를 시작한다.

선행 [PR #468](https://github.com/planner77/masterGantt/pull/468)의 head는 `6d22d591cffb1641f17cc21c05ffcb47582e5c08`이며 [CI run 37327951203](https://github.com/planner77/masterGantt/actions/runs/37327951203)은 등록 확인했다. 사전 QA PASS와 원격 quality/e2e/docker 결과 NOT TESTED를 구분한다.

## Issue Work Packet

- 저장소/branch: planner77/masterGantt / `feat/issue-461-stage-editor`. 기존 branch/PR 없음 확인 후 생성했다.
- baseline: 선행 head와 최신 main `e812e56f45fc9d641ffcd80e49fb0deaf115b704`를 보존한 merge head `4b98dd44c44335ae64e65e43f1c64f5f1b3fa384`, tree `6e1ee23822a8fa6cf6673fcc3000f8852d8fe8fe`.
- 선행 PR을 병합하지 않으므로 이 PR은 선행 구현을 포함한다. 의존성과 누적 범위를 PR에 명시한다.
- version: 새 Editor 기능 MINOR `0.86.0`. infra가 package/lock에 반영하고 version check PASS. release_required=true, release_authorized=false; 정식 게시 승인 없음.
- ui_ux 기존 설계를 frontend가 구현하고 ui_ux는 구현 비교만 한다. qa_docs는 DOCUMENTATION_SYNC 후 독립 사전 QA를 담당한다.
- frontend 소유: project-task-editor.tsx/module.css, task-editor-model.ts, task-editor-view-model.ts, 신규 Membership picker/panel/view model, 프로젝트 canonical Editor 연동, 관련 unit/component/E2E·화면 증거 및 아래 기술 UX 문서. backend/domain/DB/API handler, Grid filter/column/dashboard/Import·Copy는 수정하지 않는다. 공유 interface 변경 필요는 Manager에게 반환한다.
- 승인된 UI adapter 최소 확장: project-task-adapter.ts의 ProjectTaskUpdatePayload에 기존 서버 계약 explicitMilestoneTaskId?:string|null를 노출한다. omission/null 의미는 그대로이며 서버 DTO/API shape 변경은 아니다.
- 승인된 별도 초안 보호 확장: task-assignment-editor.tsx/task-logistics-link-editor.tsx에 dirty 보고·부모 집계·저장 단위 간 잠금·명시적 폐기 연동을 추가한다. Membership 성공 revision으로 별도 초안이 조용히 초기화되지 않도록 하며 기존 Resource/Logistics API·권한·payload 계약을 유지한다.
- 독립 파일 병렬 테스트: 별도 frontend 테스트 Agent는 tests/domain/milestone-editor-model.test.ts만 소유하고 pure Membership model/Summary 원자 payload/실제 동적 탭을 검증한다. 주 frontend는 해당 파일을 제외한 source와 component/실제 E2E를 소유한다. 테스트 Agent는 source/docs를 읽기만 하며 QA를 대신하지 않는다.
- Manager 소유: 이 계획·상위 PLAN·CHANGELOG·범위·최종 판단. infra 소유: package/lock과 GitHub 운영. 동일 파일 동시 쓰기·재귀 위임·다른 담당 변경 되돌리기를 금지한다.
- issue_comment_writer=manager. Sub-Agent는 댓글을 직접 쓰지 않고 Result Contract에 STATUS/EXCEPTION 후보와 근거를 반환한다.

## 화면과 저장 계약

DESIGN.md, UI_UX_GUIDELINES, TASK_EDITOR, PROJECT_UX 및 설치 Next 가이드를 따른다. 기존 blue Light UI·system font·semantic token·parent-owned control 간격을 재사용한다. SVAR 설치 Core 2.7.3에 최신 helper/PRO 기능을 가정하지 않는다. ui_ux가 Editor/Base/Context-menu guide와 sample URL을 조회했지만 당시 실제 demo 조작은 NOT TESTED였다.

2026-10-06 Manager는 Playwright CLI의 실제 Chromium으로 [공식 Editor sample](https://docs.svar.dev/react/gantt/samples/#/editor/willow)의 Resource planning Chart Task를 double-click하여 General/Links 탭을 열고 Links의 Successors/Task name/Type 목록을 확인했다. Escape 입력 후 snapshot에서도 해당 Editor가 남아 있었으므로 앱의 자체 Escape/focus/명시 저장 계약을 demo 동작으로 대체하지 않는다. snapshot 근거는 /tmp/mastergantt-demo-review/output/playwright/page-2026-10-05T15-03-19-741Z.yml 및 page-2026-10-05T15-03-35-231Z.yml이며 임시 조사 산출물이다. 최신 sample 조작은 설치 Core 2.7.3의 모든 helper 지원 또는 로컬 구현 UX PASS를 뜻하지 않는다.

Task/Summary 작업 정보에 단일 picker를 둔다. Task의 새 단계 탭은 없다. Summary는 하위 작업 기본 완료 단계로 표현하고 이름·Membership만 편집한다. 일정·진척·Baseline readonly를 유지한다. name/externalId/taskId trim·case-insensitive 검색, UUID 붙여넣기, 동일 이름 식별·날짜·상태·긴 ID 확인을 지원한다. 직접/nearest Summary 상속/미지정을 구분하며 해제는 상속 복귀다. 상속 차단 sentinel은 없다.

Milestone은 기존 탭을 보존한 두 번째 소속 작업 N 탭을 제공한다. N은 canonical 고유 일반 Task memberCount이며 검색/행/직접 root 수와 구분한다. 검색·유형·소속 상태, Task/Summary 후보, direct/inherited/override/타 단계 이동과 영향 preview를 제공한다. Summary 기본값 하나의 변경은 하위 override를 보존한다. inherited row는 explicit 삭제 성공으로 표현하지 않고 출처 열기/다른 단계 지정 경로를 제공한다. 연결 작업 열기/일정에서 보기는 초안 이동 보호를 따른다.

상속/Ready를 별도로 구현하지 않는다. `src/domain/milestones/project-stage-model.ts`의 stageSnapshotFromProject/previewMilestoneMemberships에 full canonical hierarchy/links를 전달하며 최종 권한·잠금·완료는 서버가 검증한다. Task/Summary 기본 저장은 변경 필드와 explicitMilestoneTaskId를 한 PATCH로 처리한다(omission 보존/null 상속 복귀). Milestone batch는 POST milestone-memberships changes 하나다.

성공은 같은 full canonical tasks/links/revision을 Workspace·Editor base·panel에 반영하고 저장한 batch 초안만 초기화한다. 기본 dirty/stale일 때 batch mutation을 막고 batch dirty일 때 다른 mutation을 막는다. 탭 이동은 초안 유지, 다른 작업/닫기/재조회는 명시 폐기 확인이다. Resource/Relation/Logistics 저장 단위·별도 초안을 보존한다. 401/412/network 실패에 초안을 버리거나 자동 재전송하지 않는다.

본인 상태·memberProgress·미완료 members·predecessor·Ready를 분리한다. 0개는 수동 이벤트/N/A, 100%를 완료로 해석하지 않는다. 완료는 명시 mutation이고 재개는 별도 명시 저장 성공 후 구조 편집을 연다. completionInconsistent는 진단만 표시한다.

## Keyboard·배치·검증

실제 노출 탭으로 ArrowLeft/Right/Home/End를 처리하고 한 행 tablist 내부 scroll로 active focus를 보이게 한다. combobox label/expanded/controls/activedescendant와 Arrow/Enter/Escape/Tab을 제공하며 Escape는 후보→확인→dialog 순서다. fixed header/tab/footer와 active body scroll을 유지한다. taskFields nth-child area 대신 명시 class/area로 새 picker를 정렬한다.

소속 table 최소 폭은 이름/WBS300px+유형88px+현재 단계180px+방식/출처180px+상태100px+명령112px=960px이며 table만 가로 scroll한다. 좁은 필터 reflow·390px 한 열, document overflow·sibling 침범 금지, Gantt instance/scroll/tree/scale/selection/fullscreen 보존을 검증한다.

관련 unit/component는 직접/상속/override/clear/search/explicit-only batch/impact/Summary 허용필드, dirty/pending/stale/readonly/completed lock/오류 초안/동적 탭 keyboard를 확인한다. 실제 SQLite API E2E는 기본 PATCH/batch 저장1회 revision+1/rollback, 양쪽 Editor 일치·명시 완료/재개를 확인한다. 실제 브라우저 390/768/1024/1440/wide에서 긴 한글·영문·UUID·많은 탭/행으로 geometry·overflow·focus·Gantt 보존을 확인하고 화면 캡처와 측정 근거를 구분한다. 전체 회귀는 PR CI에 맡긴다.

required docs: TASK_EDITOR/PROJECT_UX/REQUIREMENTS/API/TEST_PLAN/MILESTONE_STAGE_GATES 및 영향 공통 UI_UX_GUIDELINES. DESIGN은 새로운 공통 시각 규칙만 반영하거나 N/A 근거를 기록한다. Manager는 CHANGELOG/PLAN을 동기화한다. 현재 원격 quality/e2e/docker·최종 QA·운영 환경은 NOT TESTED다.

## 재개 시점 검증과 독립 검토

구현 Agent는 Unit 72/72, 최신 #461 E2E 6/6(session 70103, exit 0, 40.9초), 관련 Baseline 잠금 회귀 2/2(session 9549, exit 0, 8.6초), typecheck(session 78442), source ESLint 및 Markdown 120개 파일 검사 PASS를 반환했다. 기술 문서 7개와 390/768/1024/1440/1920px 화면·geometry를 준비했다. before 실제 화면 캡처는 NOT TESTED이며 baseline source와 재현 근거로 구분한다. 이 보고는 독립 QA 또는 원격 회귀 PASS를 대신하지 않는다.

ui_ux 최종 비교에서 query를 편집할 수 있는 combobox에 aria-readonly가 붙는 접근성 의미 불일치를 발견했다. frontend는 query를 검색 가능하게 유지하고 소속 mutation 잠금은 option/action guard와 연결된 설명으로 표시한다. 관련 E2E는 입력·조회 가능과 소속 불변·mutation 미발생을 확인한다. 해당 변경 이후 관련 검증·문서 동기화와 독립 검토를 다시 연결한다.

독립 QA가 확인한 pending 조회 필터 잠금 불일치도 수정하며, 검색 Enter는 결함 재현을 주장하지 않고 입력 흐름 보호로 보강한다. 실제 표 header/body 열 정렬·셀/control 경계·탭 높이와 focus outline 측정을 추가했다. 재검증 50988은 4 PASS/1 FAIL이며, 실패한 focus outline 측정으로 3px outline+3px offset에 비해 tablist 수직 여백 4px가 부족한 실제 clipping을 확인했다. frontend는 기존 focus token을 수용하는 최소 여백으로 수정하고 해당 실제 fixture를 다시 실행한다. 최종 성공 결과와 최초 실패를 구분해 기록한다.

최종 REWORK의 실제 SQLite geometry fixture는 session 22620에서 1/1 PASS(exit 0, 29.8초)다. 5폭의 모든 셀 button 경계·명령 열 control 45개와 control 간 비중첩을 확인했다. session 23587의 변경 source/test ESLint·typecheck·Markdown 120개 파일·diff check는 PASS이며 Next 생성 파일 drift를 복구했다. readonly 검색·소속 불변·pending 필터/Enter 흐름 검증은 50988의 해당 4개 PASS를 재사용한다. 기술 문서는 최종 동기화했고 source writer는 종료했다. 원격 quality/e2e/docker와 최종 QA는 NOT TESTED다.

다음 handoff: infra 원격 게시 → 새 head 내용 연결 확인 → PR 생성·exact head CI 등록 확인 → #462. 독립 UI 비교·사전 QA와 Manager PR_READY gate는 통과했다.
