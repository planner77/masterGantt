# Issue #490 프로젝트 설정·근무 규칙·인증 폼 배치

## 현재 후보: main 이동과 독립 검토 REWORK

현재 구현 후보는 main `4f8fc2c9c86941d1b86ae4472b1e953707c85ef7`, tree `1743c93c3fa654bdf5d25600cd7ec57c06231bd5`, application `0.94.0`을 기반으로 하는 PATCH `0.94.1`이다. 작업 branch는 `fix/issue-490-project-settings-layout`, 현재 전용 worktree는 `/home/planner/Dev/masterGantt-worktrees/issue-490-current`다. 아래의 착수 baseline/0.93.1 검증 기록은 과거 사실로 보존한다.

작업 중 PR #499가 main에 병합되어 52paths가 바뀌었다. 기존 후보와 겹친 CHANGELOG/PROJECT_UX/TEST_PLAN/package/lock 5파일은 양쪽 변경을 통합한다. 제품 5파일은 교집합이 없어 bytes를 유지한다. 기존 `/issue-490` worktree는 같은 HEAD에서 detach하여 dirty 파일·index를 그대로 보존했고, 같은 local 작업 branch를 새 main 기반 worktree로 옮겼다. root raw26파일과 기존 8개 worktree도 보존한다. 이전 후보 487파일과 0.93.1 실행 증거는 소급 갱신하지 않는다.

독립 ui_ux/PRE_QA v1은 제품 결함 추가 단정이 아닌 검증 공백으로 FAIL했다. frontend 소유권의 전용 spec/helper·5개 문서·선택 evidence에서 실제 유효 비밀번호 변경 pending/성공 대표 회귀 1개와 새 calendar field의 390px native visible focus 관측을 보완한다. 제품 코드 추가 쓰기 권한은 없다. 실제 edit-password PUT은 204/ETag revision+1, 기존 세션 revoke 및 호출자 새 세션 발급 계약을 따른다. pending의 빠른 반복 Escape/중복 요청/민감 입력과 성공 후 canonical 재조회·편집 권한·구/새 비밀번호·초점 동작을 확인한다.

프로젝트 설정 호출 버튼은 native fullscreen subtree 밖에 있으므로 fullscreen 중 설정 진입은 지원 경로 N/A다. 실제 fullscreen 진입/복귀의 상태 보존 PASS와 구분하며 미지원 진입을 추가하지 않는다. 실제125% 확대·실기기·스크린리더·운영·최종 수동 UX는 여전히 NOT TESTED다.

새 baseline/0.94.1의 최종 6케이스 및 관련 최소 LFF를 실행하고 새 DOCUMENTATION_SYNC·독립 검토·게시본 동등성 확인을 수행한다. v1 QA를 새 후보 승인으로 재사용하지 않는다. `release_required=true`, `release_authorized=false`와 PR CI 등록 종료점은 유지한다. 원격 quality/e2e/docker 및 최종 QA/Manager ACCEPT는 결과 미조회 상태에서 NOT TESTED다.

## 범위와 요청 경계

[Issue #490](https://github.com/planner77/masterGantt/issues/490)은 #456의 B 후속, Epic #449의 설정·calendar·인증 화면군이다. 사용자 요청은 구현, 관련 문서 갱신, 독립 사전 검토, 원격 branch/PR 게시 및 해당 head의 PR CI 시작까지다. CI 결과 모니터링, 병합, main CI/GHCR, tag/release, branch 정리, Issue/Epic 종료는 포함하지 않는다. 공식 quality/e2e/docker 및 최종 QA/Manager ACCEPT는 결과 미조회 상태에서 NOT TESTED로 유지한다.

등록 당시 main0.90.2는 현재 baseline이 아니다. 착수 시 최신 main은 `f4d3aeb075a899e0fe379dcdaf5730857117d775`, tree `00dd04c188da97b50d72ab0fa7e49e8984fe3b4c`, application0.93.0이다. 전용 worktree는 `/home/planner/Dev/masterGantt-worktrees/issue-490`, branch는 `fix/issue-490-project-settings-layout`이다. 기존 #490 branch/PR은 없음을 확인했다. 원래 checkout과 기존 8개 worktree 및 root의 미커밋 raw26파일은 보존한다.

## 목표와 비범위

프로젝트 설정의 기본 정보·편집/보안·근무 규칙, 작업 캘린더 fieldset/date grid, 프로젝트 편집 잠금 해제·비밀번호 변경 modal을 실제 조작한다. 의미별 field group, label/error 연결, content-aware control/action 폭, 같은 행 동급 action의 top/height 차이1 CSS px 이하, 자연 wrap과 scroll 소유권을 검증하고 실제 결함만 좁은 화면 모듈에서 고친다.

A Task Editor, C 생성·입출력, 전역 restyle, shared primitive 복제, 신규 기능, API/DB/권한/달력 계산은 제외한다. Task Editor의44px hit-area, calendar scheduling, session/Origin/revision/If-Match, native dialog/keyboard/Escape/focus 복원 및 Gantt 수명은 유지한다. dirty 초안 보존은 기존 close/tab/401/412 수명을 유지하는 의미이며 새 폐기 확인이나 영속 초안 기능을 도입하지 않는다. 비밀번호·session·token을 관측자료나 로그에 수집하지 않는다.

## Source of Truth와 설계

DESIGN.md의 blue Light 업무 UI/system font/semantic token/content-aware controls/parent-owned spacing을 따른다. 상세 interaction과 검증은 UI_UX_GUIDELINES, 기존 화면은 PROJECT_UX, calendar는 ISSUE_57_WORK_CALENDAR 및 ISSUE_68_CALENDAR_DEPENDENCY_RECALC, 보안은 SECURITY/API를 기준으로 한다. REQUIREMENTS/ARCHITECTURE/DB_SCHEMA/SCHEDULING_ENGINE과 TEST_PLAN/REMOTE_VALIDATION/CI_CD/GITHUB_OPERATIONS/ISSUE_LIFECYCLE/AGENT_PROMPTS도 영향 범위를 확인한다.

ui_ux는 read-only inventory/상태별 설계를 작성하고 frontend가 변경 전 실제 화면을 조작하여 FIX/KEEP/FOLLOW-UP을 결정한다. 정적 CSS만으로 before PASS나 결함을 주장하지 않는다. 기존3탭/hidden panels/native WorkspaceDialog를 유지하고 settings/calendar/auth 전용 CSS와 최소 class/semantic 연결을 우선한다. 실제 측정 전 발견은 후보로만 기록한다. 설치 SVAR Core2.7.3/store2.7.2에서 새 API나 PRO 기능을 도입하지 않는다.

## Issue Work Packet과 소유권

| 담당 | phase 및 쓰기 소유권 |
| --- | --- |
| Manager | scope/AC/version/phase 결정, Issue PLAN/STATUS/EXCEPTION, 이 Work Packet과 active PLAN, PR_READY 승인 |
| ui_ux | read-only 설계와 구현 비교; 저장소·GitHub 쓰기 없음 |
| frontend | before 관측용 `tests/e2e/project-settings-layout-490.spec.ts`와 전용 helper/fixture, 이후 승인된 settings/calendar/auth TSX·module CSS 및 관련 테스트, 아래 지정 문서·issue490 증거 |
| infra | branch/worktree/설치, Manager 버전 결정 이후 package.json/package-lock.json/CHANGELOG, 승인 후 명시 allowlist 게시/PR/exact-head CI 등록 |
| qa_docs | DOCUMENTATION_SYNC 이후 독립 code/test/docs/raw evidence 검토 및 원격 게시본 동등성 확인; 저장소·GitHub 쓰기 없음 |

모든 Agent의 `issue_comment_writer=manager`, `issue_comment_allowed_types=NONE`이다. 구현 Agent는 version/PR/tag/merge/GHCR/Issue close를 수행하지 않는다. source/docs/evidence 동결 뒤 Manager 승인 전에 stage/commit/원격 ref 변경을 하지 않는다. 별도 finalizer workflow나 gate 약화는 만들지 않는다.

## 검증 계획

- 같은 spec/fixture의 before/after를390/768/1024/1440/1920px에서 실행한다. 긴 이름·설명·예외명, 날짜/국가 규칙과 normal/focus/validation/readonly/pending/error/stale/401/412를 표면별로 기록한다. mock 오류·지연 관측과 실제 API/runtime 검증은 구분한다.
- 입력 border/background/padding/focus, label/error 연결, action top/height·text/padding, fieldset/date grid 및 문서·내부 scroll geometry를 PNG/JSON으로 남긴다. 실제 viewport/locale/timezone/DPR/높이, source/spec/helper/fixture bytehash와 captureSHA를 기록한다. DPR1을 실제125% 확대 근거로 쓰지 않는다.
- native Tab/Arrow/Home/End/Escape/focus 복원, settings tab 및 비민감 dirty draft의 기존 수명, 비밀번호 clearing/경고, pending 중 중복 mutation 차단,401 재인증 및412 재조회/초안 처리를 확인한다.
- Gantt instance/scroll/tree/column/scale/selection/fullscreen 및 scope tabs를 실제 상태 fixture로 확인한다. 선택적으로 DOM/공개 Core state를 읽고 새 widget API를 도입하지 않는다.
- 각 실행의 stdout/report/trace는 고유 위치에 보존한다. 최초 FAIL을 지우거나 기존 output을 덮어쓰지 않는다. source/test 편집 때 owned Next를 먼저 정지하고 재시작한다. generated next-env/tsconfig 변화는 정확 복원한다.
- 최소 관련 LFF/typecheck/scoped lint/Markdown link/whitespace를 수행한다. 전체 Vitest/Playwright/Docker는 PR CI 공식 gate로 전달한다. CI의 run 등록만 확인하며 status/conclusion/jobs/logs/check 결과를 읽지 않는다.
- 실제125% 확대/실기기/screenreader/운영 환경/최종 수동 UX는 별도 판정이며 미실행은 NOT TESTED로 남긴다.

## DOCUMENTATION_SYNC

frontend는 PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN과 신규 Issue490 관측 보고서에 실제 layout·상태 계약·before/after·환경·제한을 기록한다. calendar 소비자 변경이면 ISSUE_57_WORK_CALENDAR에 presentation 영향과 계산 계약 보존을 반영한다. DESIGN은 시각 언어를 바꾸지 않으므로 원칙 변경 없음을 확인하고 N/A를 기록할 수 있다. API/DB/SECURITY/SCHEDULING_ENGINE/IMPORT_SCHEMA/VBA/DEPLOYMENT/CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS/ARCHITECTURE/REQUIREMENTS는 계약 변경이 없을 때 항목별 N/A 근거를 남긴다. Manager는 packet/active PLAN, infra는 버전/CHANGELOG를 동기화한다. 구현 이후 다시 바뀌면 문서 gate를 재수행한다.

## 버전·릴리스 결정과 handoff

착수 시0.93.0. 5개 폭에서 calendar 입력의 border/padding 부재와 footer gap0, 설정 탭 focus ring 상단6px/하단1px clipping을 실제 확인했고 ui_ux가 PNG/JSON을 독립 대조했다. 하위 호환 presentation 수정으로 PATCH0.93.1을 확정한다. release_required=true이나 release_authorized=false다. 정식 게시 승인을 추론하지 않고 이번 요청의 PR CI 시작 경계에서 멈춘다.

진행: BRANCH_READY → 실제 before/설계 확정 → IMPLEMENTING → LOCAL_VALIDATED → DOCUMENTATION_SYNC → 독립 사전 검토 → PR_READY → 승인 allowlist 원격 게시 → 독립 게시본 동등성 → PR/CI 등록 → 요청 범위 STATUS. 아직 실행하지 않은 단계는 NOT TESTED다. 초기 준비 증거는 `/tmp/issue490-infra-preparation.json`, 원래 보존 증거는 `/tmp/issue490-preserve-before.json`이며 최종 보고에 실제 파일·SHA·명령·PR/run을 보완한다.

## 구현 범위 확정

독립 before 검토 `b0ebcb11fb65527d176b46c0295d8a49d0b2b03946c951a0d29843618798cb1b`에서3개 FIX를 확인했다. frontend의 제품 쓰기는 project-work-calendar-editor.module.css, 해당 TSX의 footer local class, project-settings-dialog.module.css의 tabList focus 여유3파일에 한정한다. 일반정보·보안·unlock의 정상 presentation과 기존 controller/초안/요청 정책은 KEEP이다. 최종 동일 spec baseline 관측이 끝나고 owned Next 정지 및 보존 확인 후 실행한다. 새 상태/인증 정책을 추가하지 않는다. 처음 before-run1의 Escape/reopen 초안 reset oracle FAIL을 원래 부모 state 유지에 맞게 정정하며 실행별 실패와 테스트 변경 hash를 보존한다.

## 상태 보존 REWORK와 소유권 확장

최초3파일 제한 이후 before-run3에서 빠른 반복 Escape에 의한 native 강제 닫힘을 확인했다. 첫 cancel은 취소 가능하지만 빠른 두 번째 cancel은 cancelable=false여서 기존 onCancel.preventDefault로 보호되지 않았다. 설정·unlock 모두 DOM은 남고 dialog.open=false/activeElement=BODY가 되었으며50ms 간격과 빠른 연속을 구분했다. 원래 실패를 보존하며 대기를 추가해 숨기지 않는다.

Manager는 기존 busy 취소 금지 의도를 복원하는 최소 변경을 추가 승인했다. frontend 소유권에 `src/components/workspace-dialog.tsx`를 추가한다. busy인 own dialog의 open/:modal와 실제 backdrop hit-test로 최상단 소유를 확인한 capture Escape keydown만 preventDefault한다. 실제 body focus와 중첩 nonbusy native modal에서 hit-test 소유를 진단했다. busy=false/unmount 때 listener를 제거하며 기존 onCancel/onClose/Tab/focus restore는 유지한다. 공유 primitive 복제나 전역 restyle는 하지 않는다. before 비교 때문에 승인된 새 쓰기를 숨기지 않고 이 절을 초기 read-only 범위보다 우선한다.

공통 동작 영향은 TEST_PLAN/PROJECT_UX/UI_UX_GUIDELINES에 기록하고 빠른 반복 Escape/body focus/중첩 modal/정상 닫기/cleanup과 관련 대표 consumer를 실제 회귀 검증한다. controller/API/DB/session/Origin/revision/scheduling 계약은 변경하지 않는다.

mock canonical Project metadata 저장 후 수평 scroll120→0도 before FAIL로 보존했다. 기본 실제API description-only 및 Summaryscope/optional열/native48pxresize/name+description 저장은120/38을 유지했다. 장기 baseline 등 fixture 차이를 추가 분리하며 mock FAIL을 모든 실제API 경로 FAIL로 확대하지 않는다. Gantt 수정 소유권은 원인 확인 뒤 Manager가 별도 결정한다.

### Gantt 보존 범위의 조건부 승인

실제 SQLite/API의 Summary scope/optional 외부ID 열/native48px resize/name+description 저장과 유효 근무일의 baseline9999까지120/38을 유지했다. 이를 실제 저장 전체 FAIL로 보고하지 않는다. 독립 QA가 정식 DTO와 Task/Link/Calendar 의미 불변을 확인한 mocked canonical 갱신의120→0 FAIL은 별도 회귀 근거로 보존한다.

원래4파일 수정 후 해당 mock 재현이 계속 실패하면 frontend는 `src/features/gantt/project-gantt.tsx`의 최소 보존 guard 조건을 수정할 수 있다. Task metadata 변경만 조건으로 삼지 않고 이전/현재 canonical geometry가 같은 갱신을 보호하며, 기존 same-instance/context/filter/scale/grid/columns/no-user-input/zero-collapse 및 후속 layout 정착 조건은 유지한다. geometry/date/calendar/filter/사용자 입력 변화는 복원하지 않는다. 새 API/scheduling/controller 정책은 도입하지 않는다. mock 및 실제API 조건의 after를 모두 검증하고 실제 경로 PASS와 mocked 스트레스 재현의 범위를 문서에서 분리한다. 최대 제품 소유권은5파일이며 최종 실제 diff와 문서 gate에서 확정한다.

최초 after에서 mocked canonical scroll FAIL이 계속되어 조건부 Gantt guard 확장 승인을 확정했다. 최종 제품 쓰기 소유권은 명시한5파일이다. 개별 column ID/width/native resize/비초기 tree 접힘을 강화하고 같은 source의 추가 before와 after를 구분한다. 동결 후 실제 diff가 승인 범위를 만족하는지 독립 검토한다.

강화한 before state는 개별6열 ID/폭, 비초기 closed Summary1개, vertical38/horizontal120을 기록했다. settings3탭 왕복·닫기는 모두 동일했고 mocked canonical metadata 저장 뒤 가로만0이었다. 이 before를 source0.93.0 근거로 보존하고 최종0.93.1 동일 spec after와 비교한다. 실제 API 복합 조건의 이전 PASS는 이 mock FAIL의 부재 근거로 확대하지 않는다.

infra가 package/lock의 canonical3곳을0.93.1로 반영하고 CHANGELOG를 갱신했다. `npm run version:check`와 scoped diffcheck PASS, 의존성tree변경0, 보호2231파일/index변경0이다. 버전 proof SHA256은 `a7b3ccd21576c18fa60dfc54cd85b2bba805dbd69e3930ac5296223689b6b6be`다. 최종 after는 실제0.93.1에서 같은 강화 spec/helper로 실행한다.

## Local Fast Feedback 현재 결과

최종0.93.1 after-final2에서 동결한 동일 spec/helper의5케이스가 모두 PASS했다(Playwright 표시1.3분). 개별6열 ID/폭·native48px resize·비초기 닫힌 Summary·scroll/scale/selection/scope/instance와 metadata 갱신, busy body focus의 빠른 Escape·중첩 nonbusy modal·cleanup, 실제 API 복합·장기 baseline 조건을 확인했다. calendar와 기본정보·보안·unlock의5폭 상태 관측을 포함한다. 앞선 after-final4 PASS/1 FAIL은390px 마지막 탭 focus ring의 가로6px 잘림이며, local tabList의 기존 content폭과 ring 여유를 함께 보존하는 margin-inline 보완 뒤 같은 spec에서 해결했다. 원래 run은 보존한다.

typecheck PASS, scoped ESLint errors0/기존 Gantt warnings4, canonical sync Vitest2파일15tests PASS를 최종 UI 실행과 구분한다. DOCUMENTATION_SYNC 및 독립 검토·원격 게시·PR CI 등록은 실제 증거가 갖춰지기 전 NOT TESTED다. 전체 원격 quality/e2e/docker와 최종 QA/ACCEPT는 결과 모니터링을 하지 않으므로 NOT TESTED로 유지한다. 실행별 정확한 명령/count/시간/hash 및 선택 게시 자료는 최종 UI 검토 보고서와 provenance를 따른다.

## 최신 main의 보완 회귀 결과

main `4f8fc2c9c86941d1b86ae4472b1e953707c85ef7` / 실제 `0.94.1`에서 최종 관련 6케이스가 모두 PASS했다(Playwright 표시1.5분). 제품 5파일 bytes는 이전 후보와 같으며 새 baseline의 source323/기존 output582/generated2를 보존했다. 별도 보완 2케이스 smoke도 PASS했다(35.9초). 실제 비밀번호 변경 PUT204와 revision 증가, pending BODY focus의 빠른 Escape2회·요청1개·민감 입력 삭제, 호출자 새 세션 edit/기존 peer 세션 readonly, 구 비밀번호401/새 비밀번호204를 확인했다. 성공 canonical loading 뒤 초점은 기존 BODY 동작으로 관측했으며 호출 초점 복원 PASS로 주장하지 않는다. 재조회 후 일반 Escape와 logout/unlock의 초점 복원은 별도 PASS다. 새 Calendar select/date는390px에서 native Tab 후 visible focus ring을 확인했다.

선택 before와 최신0.94.1 after의 실제 geometry/PNG·안전한 진단·실행 이력은 UI 검토 보고서를 따른다. 역사적0.93.1 after와 원래 FAIL은 별도 원본으로 보존하며 최종 spec/source hash를 소급 적용하지 않는다. 새 baseline의 typecheck와 범위 ESLint(오류0/기존 경고4), canonical sync Unit15 tests(154ms), Markdown134파일 링크 및 whitespace 검사는 PASS다. 다음 단계는 문서 동기화·독립 재검토·원격 게시본 동등성·PR CI 등록이다. 관련 로컬 PASS는 전체 회귀나 최종 ACCEPT를 뜻하지 않는다.
