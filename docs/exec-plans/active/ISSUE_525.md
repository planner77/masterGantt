# Issue #525 — Resource·Group 기본 Dashboard

## Issue Work Packet

- Issue: [#525](https://github.com/planner77/masterGantt/issues/525), Epic [#522](https://github.com/planner77/masterGantt/issues/522).
- Lifecycle: IMPLEMENTATION → DOCUMENTATION_SYNC → PRE_QA → 원격 PR / CI 시작. CI 결과 모니터링·병합·main/GHCR·tag·cleanup·Issue 종료는 이번 요청 범위 밖이다.
- 착수 최신 main: `f3373386d084bad5973b88180cd04ee9778e4fd6`. 직접 선행 branch `feat/issue-524-resource-dashboard-api`, exact head `5c17d3a394d95c6799dceb2b22ed166dca34f241`를 기반으로 stacked branch `feat/issue-525-resource-dashboard-ui`를 생성한다. PR base는 `feat/issue-524-resource-dashboard-api`다.
- Version: `0.97.0` → MINOR `0.98.0`. 하위 호환 신규 기능이며 package/lockfile/CHANGELOG를 동기화한다.
- `release_required=true`, `release_authorized=false`; 정식 게시 승인은 없고 PR 단계까지만 요청되었다.
- 목표·AC: Issue 원문 전체와 [Resource KPI 계약](../../RESOURCE_KPI_DASHBOARD.md)을 따른다. 선행 구현과 동일 raw 계산·scope·distinct ID·snapshot/null 의미를 유지한다.
- Non-scope: Milestone tree/matrix·기간 capacity·상위 peer tab 재설계·API 계산 복제.
- #495/#518 및 공유 Workspace 변경은 착수 시 최신 main/관련 PR을 재확인하고 현재 구현을 되돌리지 않는다.

## 소유권과 검증

- 주 담당: frontend. 소유 파일: src/features/resources의 Dashboard UI/model/CSS/tests 및 필요한 Workspace props. 순차 실행하고 같은 파일을 동시에 수정하지 않는다.
- Manager: version/package/CHANGELOG/이 계획/active PLAN·Issue 댓글. ui_ux: read-only 설계/비교, qa_docs: DOCUMENTATION_SYNC 후 독립 사전 QA, infra: 원격 commit/tree 게시·PR·CI 등록.
- Issue 댓글 writer는 Manager; Sub-Agent 허용 유형 NONE. 재귀 Agent 생성·merge/release/close 금지.
- Local Fast Feedback: 변경 관련 Domain/SQLite/HTTP/UI tests, typecheck·changed-file lint. UI는 실제 Chromium geometry 390/768/1024/1440/1920px·keyboard/focus/Gantt instance 보존을 확인한다.
- Required docs: RESOURCE_KPI_DASHBOARD/PROJECT_UX/ISSUE_56_RESOURCE_WORKLOAD/ISSUE_414_ROLE_WORKLOAD_DASHBOARD/REQUIREMENTS/TEST_PLAN, active PLAN/이 계획/CHANGELOG. DB schema·Calendar 원장·AGENTS/DESIGN 공통 원칙 불변이면 항목별 N/A를 실제 diff와 함께 기록한다. API/public query 변경은 API/SECURITY를 동기화한다.
- 공식 quality/e2e/docker·최종 QA·Manager ACCEPT는 NOT TESTED이며 CI 등록 확인 뒤 다음 Issue로 진행한다.
- Environment-specific Windows Excel/실기기·운영 배포/최종 수동 UX는 이번 PASS로 주장하지 않는다.

## 실행 기록

구현과 required 6문서 동기화를 완료했다. 최종 관련 Unit10개·typecheck·changed-file lint(오류0, legacy 기존warning3)·Markdown144 PASS다. Chromium 고유10개 PASS는 신규mock8·실제비빈SQLite/HTTP1·기존actual Stage1로 구분한다. 마지막 제품 source의 5폭 geometry에서 document=viewport, header/body 정렬·셀/toolbar 비중첩·날짜 열208px 최소·6px focus ring containment와 Gantt instance/public-native scroll120/96·열폭·선택·tree·주 scale 보존을 확인했다. ui_ux read-only 제품 설계 비교 PASS이며 최종 캡처 동기화와 frozen tree 독립 qa_docs 검토를 거쳐 원격 게시한다. 공식 quality/e2e/docker·최종 QA·Manager ACCEPT는 NOT TESTED다.

최초 실패 이력을 보존한다. nullable 상세 날짜와 fixture 중복 snapshot의 typecheck, 접근 가능한 이름의 test locator, 역순 resolved range를 만든 날짜 fixture, description 누락/기존12자 상한을 넘은 synthetic password, self WBS와 Task 이름의 중복 text locator 및 hidden Milestone option을 수정했다. 제품 검토에서는 Task/Assignment grain·외부 snapshot stale 재진입·focus 복원·Role 요약·날짜 입력 scope와 중첩 CSS 열 소유권을 보완했다. disabled trigger의 stale409 focus 불가에는 검색 fallback을 제공하고 같은 회귀를 다시 실행했다.

PR용 합성 screenshot390/1440은 docs/evidence/issue-525에 포함하고, 5폭 geometry·전체 캡처·초기 실패 artifacts는 output/playwright/issue-525 및 sibling 경로에 로컬 보존한다. historical before 실제 캡처로 소급하지 않는다. DB/API/보안/Calendar/공통 DESIGN/AGENTS 원칙은 변경하지 않았으므로 N/A이며 제품 UX·필수 문서를 갱신했다. native125% zoom/실기기/스크린리더/운영·최종 수동 UX는 별도 NOT TESTED다.

## UI·호환성 설계 결정

착수 시 main f3373386d084bad5973b88180cd04ee9778e4fd6과 #495/#518 OPEN·미구현 상태를 재확인했다. 이번에는 기존 Workspace 구조를 보존하고 새 Resource UI에 Milestone 용어를 사용한다. 후속 Issue의 상위 탭·전역 용어 범위를 대신 구현하지 않는다.

기본은 명시적인 group mode다. 기존 exact Stage assignmentIds drill은 legacy renderer로 보존하고 기본 Dashboard만 새 report API로 연결한다. active/canonical revision props는 Workspace에서 최소 전달하고 숨긴 view에 polling을 추가하지 않는다. 개인 활성 상태·그룹 활성 소속·검색은 서버 A-only이며 Task 검색/status는 T0에도 적용한다. mode projection 전환은 filters/range/Grand Total/snapshot을 바꾸지 않는다.

요약·상세는 server raw DTO와 selector를 표시하며 페이지·가시 행을 재합산하지 않는다. view=tasks의 assignment=null은 정상이다. 상세에는 canonical Task 일정·저장된 투입 override·이번 clipped 구간을 구별한다. 409/400/422는 정상 빈 결과가 아니며 실패 후 조건을 보존하고 명시 갱신/선택 해제를 제공한다.

표 열 예산과 scroll owner는 DESIGN/UI_UX 및 ui_ux handoff를 따른다. 390/768/1024/1440/1920px 실제 geometry·keyboard/focus·Gantt 상태와 실제 비빈 SQLite/HTTP 경로를 검증한다. 코드·테스트·required docs는 frontend 단독 작성, 버전·CHANGELOG·공유 계획은 Manager 단독 작성한다.

## 독립 사전 QA REWORK 기록

qa_docs가 staged diff에서 신규 Dashboard80행의 trailing whitespace를 발견해 최초 cached diff check는 FAIL이었다. 앞선 unstaged diff check는 신규 untracked 파일을 포함하지 못했다. Manager가 해당 공백 행만 제거하고 freeze manifest hash를 갱신했다. 의미 변화가 없으므로 기존 Unit9·Chromium고유10·5폭 geometry를 재사용하며 최종 cached diff check와 새 tree의 독립 재검토를 수행한다. QA 직접 실행은2파일9개 PASS(2026-10-08 00:57:37 KST,247ms)다. 원격 required gate는 새 head에서 전부 NOT TESTED다.

qa_docs는 기존 geometry가 실제 Dashboard의 짧은 개인1/그룹1/상세Task1만 측정하고 긴35Task는 Gantt에만 적용되어 긴 한국어/영문/ID·많은 Dashboard 행 AC를 검증하지 못했음을 발견했다. 기존 짧은5폭 PASS를 유지하되 해당 범위 전체 PASS로 확대하지 않는다. frontend에 별도 긴 Dashboard·많은 Group/Resource/Task·복수 Role·비활성 fixture와 같은5폭 geometry REWORK를 배정하고 새 source/docs/manifest·tree를 독립 재검토하기 전 게시를 보류했다.

## 긴 Dashboard 검증 REWORK 결과

frontend는 실제 Dashboard 전용 합성 fixture(그룹12/개인40/개인별Task120·상세page50, 긴한국어·영문·code·WBS·UUID, 최대3Role/Role미지정/비활성)를 추가했다. long/many Chromium1개 PASS(9.6s)에서 그룹/개인×390/768/1024/1440/1920px 총10관측을 실행했고 각 populated row·header/body·cell/control containment·date208px·toolbar·documentoverflow·native focus를 확인했다. 기존 짧은5폭 증거와 실제 비빈SQLite/HTTP·legacy 회귀는 보존한다. 이번 추가로 고유 Chromium 범위는11개(mock9/actualHTTP1/legacyactual1)이며 capture/geometry 재실행2개는 고유 수에 더하지 않는다. 제품 CSS/계산 source는 추가 변경하지 않았고 긴 fixture·테스트·문서·PNG·manifest를 새 tree로 동기화한 뒤 독립 QA를 재개한다.

REWORK 최종 source/docs freeze는 manifest SHA256 a43723049660dc9c56464779a35144325a5212114c3a84db4a61b124f9590d33다. 최종 Unit2파일10개 PASS(304ms), typecheck·변경fixture/spec/unit ESLint 오류/경고0·Markdown144·HEAD/cached diff check PASS를 확인했다. 제품 source는 whitespace-only 수정 뒤 추가 변경 없이 유지했고 docs PNG2개는 최종 긴 그룹 화면과 byte일치한다. 생성 Next 설정은 baseline byte로 복원했다. 독립 QA 재검토 후 동일 tree로 게시한다.
