# Issue #462 완료 단계 Gantt/Grid 실행 계획

## 요청 범위와 현재 상태

[Issue #462](https://github.com/planner77/masterGantt/issues/462)의 전체 구현·관련 테스트·문서 동기화·원격 게시·PR CI 등록 확인을 수행한다. 최신 구현 요청이 본문의 과거 registration-only를 대체한다. CI 완료 모니터링·병합·main/GHCR·정식 릴리스·브랜치 삭제·Issue 종료는 범위 밖이다. 현재 PR_READY다. 구현·Local Fast Feedback·DOCUMENTATION_SYNC·독립 UI 비교 및 사전 QA를 완료했고 writer는 종료했다.

선행 [PR #470](https://github.com/planner77/masterGantt/pull/470)의 head `055f3fb23f94d6d42261927de8e452e237641529`와 [CI run 37367438813](https://github.com/planner77/masterGantt/actions/runs/37367438813)의 등록을 확인했다. 선행 #460 [PR #468](https://github.com/planner77/masterGantt/pull/468)도 포함한 누적 PR을 준비한다. CI 결과는 조회하지 않았으며 quality/e2e/docker와 최종 QA는 NOT TESTED다.

## Issue Work Packet

- repository/Issue: planner77/masterGantt / #462, Epic #459.
- main: `e812e56f45fc9d641ffcd80e49fb0deaf115b704`. 선행 head에 이미 포함되어 추가 merge는 없다.
- branch/baseline: `feat/issue-462-stage-grid` / `055f3fb23f94d6d42261927de8e452e237641529`, tree `73e7f4ebf047dbf67e520773314746d1b9963cbf`.
- version: 새 조회·열·Editor 진입 기능의 MINOR `0.87.0`. infra가 package/lock에 반영하고 version check PASS. release_required=true, release_authorized=false; 게시 승인 없음.
- scope: 단계 조회 필터·선택 Grid 열·공통 Editor 진입·신규 mixed Link UI 제한과 legacy 표시·상태 보존·관련 테스트 및 문서.
- non-scope: DB/API/auth/scheduling 변경, Membership 엔진 복제, Dashboard/KPI/Import/Export·Copy/Template, PRO helper나 내부 DOM authority, 전체 UI restyle.
- frontend 소유: project-readonly-view.tsx·project-search-filter.ts 및 관련 filter UI/model/CSS, project-gantt.tsx와 adapter/column/context-menu 모델·CSS, #461 Editor의 초기 탭 진입 최소 interface, relation 후보/drag UI, 기존 task-context-target.ts URL decorator의 canonical 데이터 공급·cleanup 보강, 관련 unit/component/E2E와 화면·geometry 증거, 아래 기술 문서. 서버/domain/contracts/migration/버전 파일은 수정하지 않는다. 공용 interface 변경 필요는 Manager에 반환한다.
- ui_ux는 read-only 설계·최종 비교, scheduler는 dependency 경계 read-only 검토, qa_docs는 DOCUMENTATION_SYNC 후 독립 사전 QA다. source/test writer는 frontend 한 명이다.
- Manager 소유: 이 계획·PLAN·CHANGELOG·scope/interface/version/최종 판단. infra 소유: package/lock·GitHub 게시/PR 운영. 동일 파일 동시 쓰기·다른 담당 변경 되돌리기·재귀 위임 금지.
- issue_comment_writer=manager; 허용 유형 PLAN/STATUS/EXCEPTION/RESUME. Sub-Agent는 직접 댓글을 쓰지 않고 Result Contract 후보만 반환한다.

## 구현 계약

DESIGN.md의 blue Light/system font/semantic token과 UI_UX_GUIDELINES의 compact toolbar·상태·keyboard/focus·5폭 규칙을 따른다. Next 코드를 쓰기 전 설치 node_modules/next/dist/docs의 관련 가이드를 읽는다. 공식 SVAR Base/filter-tasks/filtering/links 자료와 설치 Core 2.7.3에서 확인한 API를 사용하며 문서 조회와 실제 browser 조작 증거를 구분한다.

유형 quick view와 단계 조건을 독립 상태로 관리한다. 단계는 전체/미지정/특정 M이며 기존 검색·기간·리소스·물류·WBS scope와 AND다. 후보는 canonical start 오름차순과 안정적인 externalId/taskId 보조 키로 정렬하고 name/externalId/taskId trim/case-insensitive 검색한다. 요청일이나 WBS 순서를 변경하지 않는다.

유효 소속은 full canonical hierarchy의 #460 projection을 사용한다. 특정 M은 M행·유효 일반 Task·필요한 Summary context 및 빈 Summary 기본값을 표시하되 type Task는 M행을 숨기고 type Milestone은 M 자체만 표시한다. 미지정은 effective target이 없는 일반 Task다. scope 밖 ancestor 설정은 계산에 사용하지만 scope 밖 Task를 표시하지 않는다. 기존 matched/context count를 유지하며 고유 일반 Task 수를 별도 표시한다. 단계 조건만 해제와 전체 초기화를 구분한다.

유형 Milestone-only에서는 소속 설정용 Summary context·빈 Summary를 추가하지 않는다. M행을 표시하기 위한 scope 안 hierarchy ancestor는 기존 계약대로 유지할 수 있으나 actual matching/count가 아니다. 전체/Task-only의 특정 M 조회에서는 설정 context·빈 Summary 기본값 조회를 유지하고 유형 외 조건은 AND로 적용한다. 이 해석은 Manager가 확정하고 ui_ux가 구현 담당에게 전달했다.

완료 단계 Grid 열은 기본 숨김이며 기존 column preference와 전체 budget을 유지한다. effective 이름·직접/상속·출처·동명이인 ID의 전체 조회 경로를 제공한다. Task/Summary 메뉴는 같은 #461 작업 정보 picker, Milestone은 소속 작업 탭으로 진입하며 메뉴 진입 자체는 mutation 0회다. 새 독립 편집기를 만들지 않는다.

native Link는 Scheduling Dependency다. 신규 후보/drag는 Task→Task 또는 M→M만 허용하며 mixed 제한 이유를 설명한다. 서버 #460 최종 guard를 유지하고 기존 mixed Link를 숨기거나 삭제하지 않는다. 현재 readonly/stale/pending/완료 구조 잠금과 조회 가능한 상세를 구분한다.

scheduler 경계 검토에서 legacy Link 양쪽 endpoint의 완료 Milestone UI 잠금 누락을 발견했다. Manager는 full canonical endpoint 공통 UI guard와 RelationContextMenu·ProjectReadonlyView의 실제 saveLink dispatch 최소 보강을 승인했다. 이는 기존 서버/domain 보호 정책을 UI 실행 경로와 맞추는 변경이다. 완료 잠금이 없는 기존 mixed Link의 조회·type/lag/delete 호환을 유지하고 신규 same-type 후보 규칙으로 legacy 편집을 일괄 차단하지 않는다.

필터는 canonical tasks/links를 잘라내지 않고 공개 filter-tasks로 가시성만 갱신한다. Project GET/mutation/revision 증가/remount 없이 기존 Gantt instance·scroll·tree·scale·selection·columns·fullscreen을 보존한다. canonical Membership 저장 성공은 열린 모든 scope/filter/column에 동일 revision으로 반영한다.

실제 E2E 7741/86338/84605에서 추가 Project GET을 관측했다. 초기 stack과 lazy compile trace로 초기 조회 effect 재연결을 주원인으로 추정했으나 warmup으로 해소되지 않았다. 상세 stack 15377에서 기존 task-context-target.ts의 document MutationObserver가 DOM 변경마다 decorateTaskUrls를 호출해 canonical Project GET을 발생시키는 것을 확정했다. 앞선 추정은 정정한다.

Manager는 기존 URL decorator를 ProjectGantt의 full canonical URL Map 공급 방식으로 바꾸고 observer는 이미 공급된 데이터의 DOM 표시만 갱신하도록 승인했다. frame/프로젝트별 등록·cleanup, canonical URL 수정/삭제 반영, http/https·modifier/drag/inline-edit 제외·noopener/noreferrer 계약을 유지한다. 주원인 추정에 따라 승인했던 초기 조회 완료 marker guard는 필요성이 입증되지 않아 이번 추가분만 제거한다. 기존 초기 조회·명시 retry·cross-tab refresh/catch-up은 유지한다.

설치 Core 2.7.3의 filter-tasks는 open 생략 시 filterTree의 기본 open=true를 사용한다. tree 보존을 위해 공개 action의 open:false를 명시하고 실제 collapsed Summary 상태를 검증한다. URL decorator와 이 변경은 UI lifecycle·공개 action 호출의 보강이며 서버 권한·API·scheduling algorithm 변경이 아니다. 실제 검증 결과와 최초 실패를 구분해 기록한다.

## 검증과 문서

관련 pure model/unit은 직접/상속/override/미지정/빈 Summary/동명이인·같은날 후보, full canonical과 scoped visibility, 기존 조건 AND·단계/전체 초기화·건수·열 preference·menu intent·mixed/legacy 경계를 검증한다. mock browser는 조건 전환의 API 0회·instance/state 보존과 keyboard/readonly·pending를 검증한다. 실제 SQLite E2E는 #461 저장→Grid/filter/열 일치와 revision·ID persistence를 확인한다. 전체 회귀는 원격 PR CI에 맡긴다.

390/768/1024/1440/1920px에서 긴 이름/UUID·많은 조건으로 document overflow·내부 scroll·header/body 열 정렬·셀/버튼 경계 비중첩·focus 가시성을 실제 측정하고 화면을 준비한다. screenshot 존재를 keyboard/권한/state PASS로 대체하지 않는다. before actual 또는 source/재현 근거를 구분한다.

관련 실제 검증 50031의 저장·필터·5폭 geometry는 1/1 PASS였으나 캡처 확인에서 작업명 열 47px 축소를 추가 발견했다. 최소 작업명 180px의 측정이 빠졌던 이전 PASS 범위를 보존하고 공개 resize-grid와 기존 set-columns의 사용자 width/flexgrow를 재사용해 optional 열 폭 증감만 반영했다. 보강 후 57795 관련 브라우저 4/4 PASS(27.9초), 5폭 작업명 227px·단계 열 180px를 확인했다. 실제 grip +48px 조절 후 단계 열 표시/숨김의 원래 폭 보존·pending Editor 진입 차단은 84073의 1/1 PASS(4.8초)다. 기존 fullscreen split/열/scroll/선택/Summary 상태·URL quick-edit 회귀는 83780에서 2/2 PASS(7.2초)다. Unit 4개 파일 35/35 PASS(195ms)와 변경 영향별 결과를 최종 문서 동기화·독립 검토에 연결한다.

frontend required docs: PROJECT_UX/TASK_EDITOR/TASK_RELATIONS/REQUIREMENTS/TEST_PLAN/MILESTONE_STAGE_GATES 및 공통 필터·진입 의미가 변하면 UI_UX_GUIDELINES. DESIGN은 새로운 공통 시각 원칙만 갱신하거나 N/A 근거를 기록한다. API/DB/ARCHITECTURE/SCHEDULING/SECURITY/Import/VBA/CI/배포는 영향 분석 후 갱신 또는 개별 N/A 근거다. Manager는 CHANGELOG/PLAN을 갱신한다.

독립 ui_ux·qa_docs가 최종 manifest 28개 파일과 source/docs/실제 geometry를 직접 확인하여 사전 검토 PASS를 반환했다. manifest SHA256은 `6fd2114b7d132827cf8eaa65fb86d8caa9e7cb09b301f9cadf03494fbdb925ac`다. qa_docs 직접 in-memory 경계 probe 10/10 PASS(exit 0, chunk 136a6a)를 추가 확인했다. 차단 finding은 없으며 원격 quality/e2e/docker·최종 QA와 실제 스크린리더/실기기 검증은 NOT TESTED다. 최종 typecheck 28904·ESLint 10500(exit 0, 기존 hook warning 4개)·Markdown 121개·diff check PASS, Next 생성 drift 없음.

다음 handoff: infra 원격 게시 → 새 head의 동일 내용 독립 연결 → PR 생성·exact head CI 등록 → #463. Manager의 PR_READY gate는 통과했으며 제품 최종 ACCEPT는 아니다.
