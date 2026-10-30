# Issue #860 — Milestone 변환 확인·표시 정합·관리 경로

Primary Issue: https://github.com/planner77/masterGantt/issues/860
기준 main: `fe56cc6b97f0850c316fcbf6bbc2e1ccdfca79bc`; application `0.138.3`; SVAR Core `2.7.3`.
branch: `fix/issue-860-milestone-conversion`; 후보 PATCH `0.138.4`.
risk_level: HIGH; qa_required: true; qa_method: OWNER_MANAGED; manager_decision: NOT TESTED.
risk_reason: 기존 canonical 타입 변환과 단일 Gantt·모달/Editor·revision·비동기 탐색 경합에 영향.
issue_comment_writer: Manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION.
release_required: true; release_authorized: false.

사용자가 이슈의 등록 전용 범위를 분석·설계·구현·문서 갱신·미해결 리뷰/충돌 해결·실패 원장 후 PR Full CI 시작까지 확장했다. CI 모니터링·병합·Main/GHCR·tag/Release·Issue 종료는 범위 밖이다. 버전 변경은 게시 승인이 아니다.

## 범위와 역할

- 운영 `separate-milestones`/marker OFF에서 변환된 같은 canonical ID의 native Grid 행·Chart Bar·숨은 선택/clipboard는 0이어야 한다. 전체 canonical Milestone/Link/Membership, Summary roll-up·권한·Export를 보존한다. legacy emergency WBS의 native 표시 계약은 유지한다.
- 확인 전 서버 쓰기 0, 확인 후 기존 `kind:convert` command·Origin/session/strong If-Match/revision·canonical recovery를 사용한다. 새 엔터티·쓰기 API·Stage Gate 규칙·marker ON·PRO·private Store/DOM patch·무조건 remount·무한 retry는 비범위다.
- Manager: 통합·문서·버전·실패 원장·Issue 댓글·PR/CI 시작. ui_ux: read-only Design Delta. frontend: `src/**`, `tests/features/**`. browser_tests: 기존 `tests/e2e/**` 재현·확장. qa_docs: 구현자와 분리된 read-only 사전 검토. 같은 파일 동시 writer와 재귀 위임 없음.
- 기본 OWNER_MANAGED의 사전 에이전트 검토는 인간 GitHub 승인/Trusted QA/Owner HIGH 위험 수용·Manager ACCEPT를 대신하지 않는다. 실제 모델 runtime 신원은 별도 검증하지 않는다.

## 분석·설계

Design Delta B: 기존 semantic token·WorkspaceDialog·일정 작업면과 단일 Gantt/Coordinator를 재사용한다. 별도 ui_ux의 설계 검토와 실제 설치 Core/DOM 실행 증거를 구분한다.

1. Grid/Chart의 같은 context command를 부모 Workspace의 확인으로 연결한다. 대상 이름·기간 0일·운영 모드의 Grid/Chart 숨김 및 `대시보드 → Milestone`을 표시한다. legacy에서는 실제 표시 계약을 안내한다. 서버가 정하는 날짜나 지원 불가능한 소속/구조를 무조건 보존한다고 약속하지 않는다.
2. `취소` 초기 focus, Tab/Shift+Tab trap·Escape·busy guard, 원 trigger의 preventScroll 복원을 사용한다. 현재 Project/Task/revision과 권한·dirty/lock을 확인하고 동기 제출 ref로 중복을 막는다. 성공 후 사라진 trigger는 native dialog close와 원 trigger 복원이 끝난 선택적 `onAfterClose`에서 일반 보기의 작업 검색 또는 Fullscreen의 Gantt 영역으로 focus를 한 번 대체한다. 이벤트 시점 RAF·timer retry로 modal cleanup 순서를 추정하지 않는다.
3. 성공 안내는 Gantt frame의 정상 flow에 두어 기존 focusable 제어를 덮지 않는다. 같은 frame 안이므로 fullscreen 안내 portal/remount를 추가하지 않으며 native instance/viewport는 기존 coordinator가 유지한다. canonical 성공과 실제 Core visible IDs/Grid/Chart 정착을 별도 검사한다. 표시 producer의 데이터 타입 변화·projection/filter와 native consumer의 비동기 순서를 대조하고 원인 확인 전 행 잔류를 특정 모듈 탓으로 확정하지 않는다.
4. 성공 안내 `Milestone으로 변경했습니다` 및 명시적 `Milestone 대시보드에서 보기`를 제공한다. 사용자가 누를 때만 같은 canonical ID/type을 검증해 기존 Milestone 관리로 이동한다. 이름·첫 결과로 대상을 추측하지 않으며 목록 조건으로 숨겨질 수 있음을 안내한다. marker/Chart 날짜 자동 이동 없음.
5. 401/409/412/422/500·network unknown/늦은 응답에는 성공 오인·자동 재전송 없이 기존 canonical 재조회·복구를 유지한다.

공식 [filter-tasks](https://docs.svar.dev/react/gantt/api/actions/filter-tasks/)와 [Willow](https://docs.svar.dev/react/gantt/samples/#/base/willow)를 2026-10-30 조회했다. 공개 filter predicate 계약의 문서 근거이며 데모 실제 조작·설치 2.7.3의 통합 성공 증거는 아니다. Next 코드는 설치 `node_modules/next/dist/docs/`의 관련 가이드를 먼저 확인한다.

## TEST_LIFECYCLE_REVIEW

- EXTEND: `tests/e2e/task-context-menu-hierarchy.spec.ts`의 실제 HTTP·SQLite 변환/왕복. 기존 Grid row0·canonical type 단언을 유지하고 확인/취소/실제 Core·Chart/정착·관리 경로·오류를 같은 시나리오에 연결한다.
- KEEP_UNIQUE: `tests/e2e/milestone-visibility.spec.ts`의 marker OFF 5폭/native Grid·Chart·Resource 복귀/선택·DOM0/mutation0, `milestone-visibility-persistence.spec.ts`의 실제 저장, `milestone-dashboard-state.spec.ts`와 `project-workspace-tabs-518.spec.ts`의 필터·peer·instance 보존, 서버 hierarchy tests의 If-Match/권한/SQLite/관계·완료 잠금은 별개 경계다.
- ADD는 실제 기존 seam의 부족이 확인된 최소 단위/fixture에 한정한다. 새 중복 E2E·skip·assertion/timeout/retry·8-shard/Required3/Trusted gate 완화 없음.
- 검색 범위: `tests/e2e/task-context-menu-hierarchy.spec.ts`, `tests/e2e/milestone*`, `tests/e2e/project-workspace-tabs-518.spec.ts`, `tests/features/gantt/**`, `tests/server/**`의 conversion/hierarchy/Stage Gate 사례.

## AC_TEST_COVERAGE

- AC1: 기존 hierarchy Chromium에서 Grid/Chart→같은 확인 dialog·정확 이름·기간/표시 안내·취소/Escape/focus·확인 전 POST/revision0과 readonly/linked/non-leaf 음성을 검사한다.
- AC2: 실제 HTTP·SQLite 변환/GET의 같은 taskId/type과 Core visible IDs·native Grid/Chart Bar0·일반 Task/Summary 순서/정렬·settle/reload를 대조한다. 브라우저 mock과 실제 backend 증거를 구별한다.
- AC3: 기존 visibility/peer/scale/scope/cellHeight/columns 검사를 재사용하고 변경 후 재진입을 확장한다. 5폭×모든 상태 전체 행렬은 실제 수행분 외 NOT TESTED다.
- AC4: 기존 canonical ID의 성공 안내→명시 Milestone dashboard/Editor, 필터·동명·소속0의 정확 대상과 자동 이동0을 검사한다.
- AC5: 동일 hierarchy browser seam에서 지연/연속 입력/오류·stale revision과 기존 server 권한/If-Match·재조회 회복을 연결한다. 미실행 상태는 PASS로 간주하지 않는다.
- AC6: 기존 hidden M/Link/Membership·JSON1.1/Excel/Copy/Template·완료 잠금 보호를 KEEP_UNIQUE로 보존한다. 이 변경의 직접 실행과 #574 V1~V8 통합 최종 수용을 구분하며 #573/#693 ON은 별도 후속이다.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `DESIGN.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/MILESTONE_USER_GUIDE.md`: UPDATED
- `docs/MILESTONE_TIMELINE_TRACEABILITY.md`: UPDATED
- `docs/GANTT_STATE_CONFORMANCE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_860.md`: UPDATED
- `docs/ISSUE_860_FAILURE_ANALYSIS.md`: UPDATED
- `docs/evidence/issue-860/manifest.json`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/REQUIREMENTS.md`: N/A(기존 Milestone 분리·변환 요구를 구현하며 도메인이나 제품 범위 확장 없음)
- `docs/TASK_EDITOR.md`: N/A(기존 동일 ID Task Editor와 저장·권한·draft 계약을 재사용)
- `docs/WBS_CROSS_FEATURE_ACCEPTANCE.md`: N/A(#574 통합 최종 수용이 아닌 #860 부분 증거를 기존 Milestone 추적표에 인계)
- `docs/ARCHITECTURE.md`: N/A(기존 부모 Workspace 확인·canonical gateway 경계를 재사용하고 새 저장 계층을 추가하지 않음)
- `docs/API.md`: N/A(기존 task-command convert·canonical snapshot 계약을 유지하며 REST 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite schema·migration 변경 없이 기존 동일 Task ID 변환 사용)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Milestone duration0·서버 변환 제약을 재사용하고 일정 계산 변경 없음)
- `docs/SECURITY.md`: N/A(기존 Origin·session·strong If-Match·revision 인가 경계 유지)
- `docs/IMPORT_EXPORT.md`: N/A(표시에서만 숨기며 canonical Copy·Export 계약 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(JSON1.1 교환 schema·검증·무손실의 기존 계약 유지)
- `docs/UI_UX_GUIDELINES.md`: N/A(공통 dialog·focus·semantic token 지침을 재사용하고 화면 계약만 갱신)
- `docs/MILESTONE_PRESENTATION_POLICY.md`: N/A(기존 marker OFF·legacy emergency 표시 정책 유지)
- `docs/MILESTONE_STAGE_GATES.md`: N/A(기존 Ready·Completed·소속·관계의 서버 제약 유지)
- `docs/CI_CD.md`: N/A(기존 PATCH 정책·Full8·Required3·Main·Release 계약 유지)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 exact Head·base·test merge·Run Attempt 검증 경계 유지)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 canonical Refs·PR CI 시작 절차·권한 유지)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 문서·QA·PR CI 시작 인계를 적용하며 gate 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 OWNER_MANAGED·Trusted·Owner 최종 승인 유지)
- `docs/PR_CI_FAILURE_TRIAGE.md`: N/A(기존 지침을 새 Issue860 단일 원장에 적용하며 공통 정책 변경 없음)

AGENTS.md 차이는 Next가 재생성하는 기존 block의 제목 수준뿐이며 지침 본문·QA/CI 정책 변경은 없다. Next 지침에 따라 재생성 차이를 보존한다.

## 실행·실패·리뷰·인계

현재 단계: 구현·DOCUMENTATION_SYNC·로컬 회귀 완료, PR Full CI 시작 인계 준비. `npm ci --no-audit --no-fund` PASS(Node22.14.0/npm11.10.0, 446 packages). 기준 source·실패·최종 실행은 [단일 원장](../../ISSUE_860_FAILURE_ANALYSIS.md)에 기록한다.

최종 동결5개 제품·2개 E2E source에서 기존 변환 소비자4개와 새 #860 시나리오3개 **7/7 PASS, 3.5분**, 별도 `NEXT_PUBLIC_GANTT_WBS_MODE=legacy` 기존 스모크 **1/1 PASS, 7.8초**다. 전자는 실제 isolated HTTP·SQLite이며 후자는 mock HTTP fixture다. legacy의 부수 KPI404는 matching mock 부재이며 해당 native 표시·marker side-effect0 검증과 구분한다. 실행 전후7개 SHA256 변경0을 [정제 manifest](../../evidence/issue-860/manifest.json), [browser receipt](../../evidence/issue-860/browser-receipt.json), [source freeze](../../evidence/issue-860/source-freeze.json)에 보존한다. 원본 trace/인증 가능 로그는 로컬에만 보관한다.

390/768/1024/1440/1920×Day/Week10조합에서 변환 M ID `582538f9-5446-42af-b6a6-a0a2299cd5ce`의 Core/native Grid/Chart0, 일반 ID `f7df1485-2940-4f8f-adc5-f233c6d92a5f`의 정렬≤1px·동일 `svar-api-1`을 확인했다. Ctrl-wheel 행 높이·검색0/초기화·Resource peer 후 revision4 불변. 성공 notice의 실제 Tab center-hit/390px 가시성, 긴 동명 항목·필터된 Dashboard의 동일 ID 상세·취소/Chart Escape/저장 후 focus를 검사했다. 401/409/412/422/500 및 서버 쓰기 전 network abort에서 원본·revision 유지/성공 안내0/자동 재전송0을 확인했다.

관련 순수 모델·서버 Unit3파일30/30, 별도3파일56/56, Reviewer2파일14/14는 겹치는 사례를 합산하지 않는다. 최종 typecheck·관련 ESLint0errors/기존Hook경고4개·Markdown 링크·version0.138.4·diff check 및 docs_gate AC1~6 구조 검증 PASS다. Unit은 변경 없는 import 경계의 결과를 재사용하며 native/모달은 별도 Chromium으로 검증했다. Next가 만든 임시 next-env/tsconfig 경로는 소유 서버 종료 후 원본으로 복원했다.

독립 ui_ux/read-only qa_docs `/root/review`가 overlay P2와 실제 focus-body FAIL, fullscreen await의 최신 snapshot 경계 보완을 검토했다. 최종 사전검토는 별도 증거로 기록하며 인간 GitHub 승인·Trusted QA/Owner 위험 수용·Manager ACCEPT로 격상하지 않는다. **원래 사용자 운영 환경의 행 잔류는 재현되지 않았고**, 확인/관리 UX·새로 확인한 focus/겹침을 교정했다. Core 필터에 추측성 수정을 추가하지 않았다.

잔여 NOT TESTED: 서버 commit 후 response 유실 복구, 확인/전체화면 action 대기 중 다른 탭 revision 경합, 변환 후 명시 Grid-only/Chart-only·열 resize 및 모든 scope 상태의 전체 조합, 운영 배포 source/mode/사용자 프로젝트·최종 수동 UX/스크린리더·실기기 zoom, 새 Head 전체 Export/Copy/Template·#574 V1~V8 수용. 원격 Required3·Trusted·Owner/Manager 최종 수용은 별도다.

기존 #860 PR은 검색 결과 0개이며 신규 PR을 준비한다. 최신 main 충돌과 미해결 thread는 게시 직전/PR 생성 직후 확인한다. Required Quality/E2E8/Docker·Trusted QA·Owner HIGH 수용·Manager ACCEPT는 NOT TESTED다. 운영 사용자 환경/배포 source·수동 UX/스크린리더·Windows/DRM은 별도 NOT TESTED다.


## 최종 사전 검토 판정

독립 read-only `/root/review` **PRE_QA: PASS**, 최종 source의 미해결 차단 지적0. 제품5/E2E2 SHA256은동결7/7일치, manifest 산출물15/15의 byte수·SHA256 일치, 문서 의미/AC·실패 보존·보호경계와 실제 screenshot·실행 증거를 대조했다. 별도 ui_ux 설계/구현 정적 검토와 frontend/browser_tests 실행도 수행했다. 이 사전검토는 인간 GitHub review나 QA_FINAL·Owner 위험 수용·Manager ACCEPT가 아니다.

게시 직전 재조회한 main은 기준 `fe56cc6b97f0850c316fcbf6bbc2e1ccdfca79bc`와 같으며 기존 #860 원격 작업 branch/PR이 없어 새 branch/Ready PR로 인계한다. 충돌0의 최신 main을 부모로 게시하고 생성 직후 PR thread/test merge·Full CI 등록을 한 번 확인해 Issue STATUS에 exact Head/base/test merge/Run Attempt를 남긴다. 이후 모니터링하지 않는다.
