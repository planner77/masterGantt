# Issue #490 프로젝트 설정 UI/UX 검토 기록

현재 후보는 최신 main `4f8fc2c9c86941d1b86ae4472b1e953707c85ef7`/tree `1743c93c3fa654bdf5d25600cd7ec57c06231bd5`를 반영한0.94.1이다. 아래0.93.1 구현·16run40case·5case 결과는 historical로 유지하고, 독립 검토의 비밀번호 변경/새 Calendar field focus gap을 새6case로 보완한다. 제품5파일 bytes는 v1과 동일하다.

## 범위와 판정 경계

Project 설정의 기본 정보·작업 캘린더·편집/보안 및 편집 활성화 폼을 검토했다. 제품 변경은 Calendar 로컬 CSS/버튼 wrapper, 설정 탭 focus 여유, WorkspaceDialog의 기존 busy 취소 금지 복원, Gantt canonical geometry 동일 갱신의 viewport guard 5파일이다. 정상 일반정보·보안·unlock 표현은 KEEP이며 새 auth/API/초안 정책은 도입하지 않는다.

0.93.1 단계의 baseline은 main `f4d3aeb075a899e0fe379dcdaf5730857117d775`/0.93.0이며 당시 제품은 0.93.1이다. 캡처 sourceSha는 커밋 전 baseline HEAD를 가리키므로 실제 구현 bytes는 각 JSON의 sourceFiles/sourceAggregateSha256을 함께 확인한다. 실행 환경은 Node22.14, Next16.3.8, React19.3.0, SVAR Core2.7.3/store2.7.2, Playwright1.63.0이다. Core의 공개 getState/scroll-chart/set-columns 및 native Grid resize를 사용하며 PRO 구현을 복제하지 않는다. 공통 SVAR 자료와 기존 #456 viewport 계약은 UI_UX_GUIDELINES/PROJECT_UX를 참조했다. 새 SVAR API/공식 demo 조작 검증은 N/A다.

## 실제 FIX / KEEP / FOLLOW-UP

| 영역 | before 근거 | 구현과 확인 범위 |
| --- | --- | --- |
| Calendar input/select | 국가 적용 범위 21px, 날짜/예외 입력24px·padding0, 시각적 테두리 부재 | semantic 1px border, 40px 높이, padding8px/12px, focus/disabled 표현. 국가 선택 자체 기존40px는 유지 |
| Calendar footer | preview/save wrapper gap0 | 로컬 flex wrap·gap12px·align center. 같은 행 버튼 높이 차이≤1px/간격≥8px; 좁은 폭 자연 wrap |
| 설정 탭 focus | outline3px+offset3px가 clip owner 상단6px/하단1px에 걸림 | 사방padding6px. 첫 after에서390px 마지막 탭 right350+ring6이 owner350을 넘어 FAIL; margin-inline:-6px로 기존 content폭과 여유를 같이 확보. dialog 내부와 document overflow를 측정 |
| 빠른 Escape | 설정·unlock pending에서 첫 native cancel은 취소 가능, 빠른 두 번째는 cancelable=false. React DOM1개가 남지만 open=false/BODY 초점 | busy commit의 capture keydown에서 own open/:modal·native backdrop hit-test 최상단 소유일 때 Escape만 preventDefault. 기존 cancel/Tab/restoreFocus 유지. nested nonbusy modal·busy=false/언마운트 cleanup 분리 |
| 같은 geometry canonical refresh | 정식 Project metadata DTO mock에서 Task/Link/Calendar 불변이어도 public/DOM 가로120→0; 세로38 유지 | Task metadata 변경 조건 대신 canonical geometry 동일 조건. 기존 instance/context/filter/scale/grid/columns/no-user-input/0-collapse/layout-settle guard는 유지 |
| 일반/보안/auth 정상 | 기존 form-field 표현 정상 | KEEP. 민감 password clearing, validation 정책과 authorization/Origin/revision 유지 |
| 125%/실기기/screen reader/배포 | 미실행 | 환경 FOLLOW-UP/NOT TESTED 또는 BLOCKED: [#517](https://github.com/planner77/masterGantt/issues/517) |

실제 API의 Summary scope·optional 열·48px resize·주 scale·long baseline9999·Project name/description 저장은 before에서도 가로120/세로38을 유지했다. mock 스트레스 재현과 실제 API PASS는 별도 조건이며 실제 저장 경로 전체의 결함이라고 주장하지 않는다.

## 상태별 AC / 증거

기본 폭은390/768/1024/1440/1920px, 높이900, ko-KR/Asia-Seoul, DPR1/default100%이다. fixture는 긴 한국어/영문 이름·긴 설명·KR 기간 규칙·긴 날짜 예외 이름을 사용한다. native Tab/Home/Arrow/End/Escape, 폼 label/fieldset/error description, document overflow와 visible control geometry를 측정한다. password/input 값은 geometry에 수집하지 않는다.

| surface/state | 5폭 관측 key | 추가 계약 |
| --- | --- | --- |
| 기본 정보 정상/validation/focus | general-long, general-validation, general-native-focus | 부모 초안 탭 전환/Escape/reopen 유지 |
| 세 탭 native focus | tab-general-focus, tab-calendar-focus, tab-security-focus | Home/Arrow/End; ring clip owner 경계 |
| 기본 정보 pending/error | general-pending, general-error | controlled PATCH500·중복 요청1·Origin/If-Match·즉시 두Escape |
| 보안 정상/validation | security-normal, security-validation | Tab/ShiftTab 순환·기존 password validation/clearing |
| readonly auth/validation/pending/401 | auth-readonly, auth-validation, auth-pending, auth-401 | controlled unlock401·즉시 두Escape·disabled/민감 입력 clearing·호출 초점 복원 |
| Calendar 정상/focus/validation | calendar-long-dates, calendar-native-focus, calendar-validation | 날짜 순서 error association·국가/날짜/예외 입력 식별 |
| Calendar pending/ready/stale/error | calendar-pending, calendar-ready, calendar-stale, calendar-error | controlled preview 계약·변경 후 stale·500 |
| Calendar401/412 | calendar-401, calendar-412 | dialog가 닫힌 뒤 main/page-level readonly 또는 canonical refresh. dialog PASS로 세지 않음 |

기존 23 statekeys×5=115 PNG/geometry는 역사적 기본 비교 집합이며 현재도 같은 기본 집합을 재관측한다. 현재 최종 UI 관측120개에는 대표 Calendar focus2개와 rotation3개가 별도로 추가된다. 모든 state×모든surface cross-product를 실행한 것은 아니다. 0.93.1 당시 보안 password rotation의 성공/전 상태, 모든 Calendar 대상 선택의 모든 조합, auth 네트워크500/412의 별도 경로는 당시 spec의 직접 검증 범위 밖이다. 현재1440px 실제 rotation은 아래 REWORK에서 추가한다. 기존 원격 전체 E2E 검증과 이번 관측을 구분한다.

Mock Gantt state는1440px에서6개 개별 열 ID/폭, optional 외부ID, native48px resize, 닫힌 중첩 Summary1개, native 선택1개, 주 scale, Summary WBS scope/rootTask, API/instance, public/DOM scroll120/38을 비교한다. 세 탭/닫기/metadata 저장과 native fullscreen 왕복을 검사한다. 프로젝트 header는 fullscreen 밖이므로 설정 진입은 fullscreen=false에서 검증하며, fullscreen 중 설정 진입 보존은 직접 검증하지 않았다. 실제 API 진단은 viewport/instance/scale와 Task/Link/Calendar 불변·revision+1을 비교한다. mock의 모든 tree/선택/개별열 assertion을 실제 API에서도 수행했다는 뜻은 아니다.

기본 정보 부모 초안은 Escape/reopen 뒤 유지한다. Calendar 내부 초안의 기존 unmount 수명과 password 초기화는 변경하지 않는다. 401은 readonly,412는 beginRefresh(false)의 설정 닫기/canonical GET/metadata 재작성 정책을 따른다. 새 discard confirmation이나 persistent draft는 추가하지 않는다.

## 게시 증거와 재사용

- [before 선택 목록](../output/playwright/issue-490/before-selected/selection.json): before-final85개 UI PNG/JSON과 source bytes가 같은 before-run2의 누락30개를 원본 그대로 선택했다. source/test hash·시각을 소급 갱신하지 않았다. before-run2 pending은 이전 키 준비이며 빠른 반복 Escape의 실패 근거는 별도 native 진단이다.
- [강화 before Gantt 상태](../output/playwright/issue-490/before-state-final3/gantt-state-1440.json): 6개 열·닫힌 Summary·native 선택 준비 후 metadata 가로120→0 원래 FAIL을 기록했다.
- [before native 진단](../output/playwright/issue-490/diagnostics/before-native.json), [before 실제 API 진단](../output/playwright/issue-490/diagnostics/before-actual.json): 당시 safe 관측 원본이다. native 진단은50ms 간격과 빠른 연속/최상단 modal 조건을 분리했다. 별도 당시 test-byte hash는 수집하지 않았으므로 최종 spec과 같은 hash라고 주장하지 않는다.
- [최종 after 기본 정보](../output/playwright/issue-490/after-current-0941/general-long-1440.png), [Calendar](../output/playwright/issue-490/after-current-0941/calendar-long-dates-390.png), [보안 focus](../output/playwright/issue-490/after-current-0941/tab-security-focus-390.json), [Gantt 상태](../output/playwright/issue-490/after-current-0941/gantt-state-1440.json), [native 진단](../output/playwright/issue-490/diagnostics/current-native.json), [실제 API 진단](../output/playwright/issue-490/diagnostics/current-actual.json), [실행 이력](../output/playwright/issue-490/runs.json), [환경/source provenance](../output/playwright/issue-490/provenance.json)를 게시한다.

역사적0.93.1 최종 spec SHA256은 `dee81a623896cbe92aaef7d0197e8cb3e7830adecb8d5a47dae0263f42e66d67`, helper는 `febcb43afb3c8f91af6bd303e376c1f97f8bf024c97accff4e8d7f422c10da18`이다. 강화 before-state-final3와 역사적 0.93.1 after-final2는 같은 당시 spec/helper이며, 앞선 전체 UI 캡처는 추가 관측/native keyboard 준비/fixture 정정에 따른 이전 hash를 보존한다. 첫 Escape 초안 reset 기대를 실제 유지 정책으로 정정했고, programmatic focus-visible 준비를 native Home으로 정정했다. 닫힌 subtree 관측 준비가 scale/scroll 뒤에도 안정적이도록 fixture splice와 마지막 native collapse 순서를 정정했다. 실패 assertion을 삭제하거나 완화하지 않았다.

실행16회40case는27 PASS/13 FAIL이며 준비 oracle 오류와 제품 결함을 실행 이력에서 구분한다. Geometry provenance.command는 helper의 기본 spec 명령이며 실행별 env/filter 전체의 실제 명령 기록을 뜻하지 않는다. 최종 after-final2와 강화 before-state-final3의 실제 명령은 실행 이력에 기록하고, 이전 진단의 정확한 -g 문자열은 별도 수집하지 않아 NOT RECORDED로 남긴다.

중간 HTML/trace/stdout/results는 실행별 고유 `/tmp/issue490-<run>-*`에 남기며 게시하지 않는다. 중간 PNG/JSON 전체는 `/tmp/issue490-intermediate-captures-preserved`에도 bytes 그대로 보존한다. before/after source 변경은 own Next STOP 후 수행했고 Next generated2는 baseline bytes로 복원했다. 기존 tracked output582와 baseline source323 hash로 보호했으며 Manager의 root raw26 보호는 별도 근거다. 최종 게시 allowlist에 과거 중간 폴더 전체/HTML/stdout/trace/DB/runtime log/password/session/Cookie/token은 포함하지 않는다.

## DOCUMENTATION_SYNC / N/A

PROJECT_UX, UI_UX_GUIDELINES, TEST_PLAN, ISSUE_57_WORK_CALENDAR 및 이 기록을 frontend가 갱신한다. Work Packet/PLAN은 Manager, package/lock/CHANGELOG는 infra 소유다. DESIGN은 기존 Light/system font/semantic token·40px 원칙 유지라 원칙 수정 N/A다.

| 문서 | N/A 이유 |
| --- | --- |
| API / DB_SCHEMA | Route/DTO/schema/migration 변경 없음 |
| SECURITY | 서버 auth/session/Origin/revision 정책 변경 없음; password clearing 유지 |
| SCHEDULING_ENGINE | 순수 일정/Calendar 알고리즘 변경 없음 |
| IMPORT_SCHEMA / VBA_EXPORT | Import/Excel/VBA 변경 없음 |
| DEPLOYMENT / CI_CD / REMOTE_VALIDATION / GITHUB_OPERATIONS | 배포/workflow/원격 gate 정책 변경 없음 |
| ARCHITECTURE / REQUIREMENTS | 기존 설정과 상태 보존 계약의 결함 수정; 새 서비스/요구사항 없음 |

## 동결 결과

역사적 after-final2는 당시 동일 동결 spec/helper, 실제0.93.1에서 5case PASS(1.3분)이다. UI115 PNG/JSON과 Gantt1 PNG/JSON, 별도 safe native/actual API 진단을 동결했다. 390px 보안 탭은 button right344+ring6=350≤owner right356이며 owner x34/right356은 dialog x19/right371 안에 있다. 모든5폭/세탭 focus와 document overflow assertion을 통과했다. 강화 mock 상태는 metadata 저장과 fullscreen 왕복 뒤 가로120/세로38·6열·닫힌 tree·선택·scope·instance를 유지했다. 실제 API는 schedule fingerprint 불변과 revision+1, viewport 보존을 통과했다.

Local Fast Feedback은 typecheck PASS, 범위 ESLint0errors/기존 Gantt warning4개, canonical sync Vitest2파일15 tests PASS(163ms)다. 최종 Markdown link/diff check와 독립 검토는 각 담당의 실제 실행 결과로 분리한다. 로컬 관측/구현 자체 확인은 독립 QA 승인과 원격 quality/e2e/docker PASS를 대체하지 않는다. 원격 검증은 NOT TESTED이며 사용자의 요청 경계는 push/PR CI 시작이다. main GHCR·정식 Release·실제 운영은 이번 범위 밖이다.

## 최신 main REWORK 검증

main #485/PR499는52파일을 변경하고 제품 버전을0.94.0으로 올렸다. Issue490 제품5파일과 겹침은0이지만 PROJECT_UX/TEST_PLAN의 main 변경을 무충돌3way 결과로 함께 보존하고0.94.1로 재검증한다. source323 전체의 실제 hash는 새 관측에 기록한다. db migration0023은 실제 isolated runtime에 적용되며 tests/fixtures/stateful-project.ts의 workload role 변경은 이 spec이 사용하는 task-editor-density fixture와 별개다. 후자의 assignmentTargets 옵션도 사용하지 않는다.

독립 ui_ux v1은 제품 표현/guard/기존 관측은 PASS였지만 유효 password rotation과 새 Calendar .field focus 직접 증거가 없어 FAIL이었다. qa_docs도 이 AC gap으로 기존 사전 후보를 REWORK했다. 기존 source/test/evidence hash에 새 검증을 소급하지 않는다. 새 helper는 대표 폭 선택과 새 field focus 가시성 assertion을 추가하며 기존5case에 Calendar 관측2개를 더하고 actual rotation1case를 추가한다.

actual password rotation은 PUT edit-password204/ETag revision+1이다. 입력을 즉시 비워 disabled로 잠그고 BODY 초점에서 지연 없이 두Escape를 입력한다. 기존 busy guard로 open/:modal 유지, 반복 requestSubmit 후 PUT1개를 확인한다. native End의 보안탭 focus는 ring을 보이며 허용된다. 요청을 release한 뒤 실제 Route→Service→SQLite를 계속 호출해 Set-Cookie 처리는 browser에 맡기며 원문 password/token/cookie/body를 게시하지 않는다. safe 관측은 method/path/Origin/If-Match/status/revision/boolean뿐이다.

성공 시 설정 닫기→loading/readonly checking→canonical GET/current session 확인 뒤 호출자는 edit를 유지한다. 이전 peer 세션은 readonly, 구 비밀번호는401, 새 비밀번호는204이며 Task/Link/Calendar 불변과 일반 초안 canonical 재작성을 확인한다. 성공 재조회 동안 호출 버튼이 unmount되므로 실제 초점 BODY/settings=false를 기록했다. 이를 성공 호출 초점 복원 PASS로 세지 않는다. 재조회 후 정상 Escape/settings, logout/unlock, 새 password unlock/settings 초점 복원을 별도로 확인한다.

390px Calendar select/date는 native Tab 이후 실제 y403.8..443.8 /481.6..521.6,40px/outline3px+offset3px으로 화면 안에 보인다. 전체 owner 경계를 assertion으로 확인하며 기존 country1의 UA focus1px과 분리한다. fullscreen frame 밖의 project header에는 지원되는 fullscreen 중 설정 진입이 없으므로 이 조작은 N/A다. 지원 fullscreen 왕복 후 상태 유지 PASS와 구분하며 새 entry/portal을 도입하지 않는다.

신규 smoke2case는35.9초 PASS, 최신main/0.94.1 최종6case는1.5분 PASS다. 새 spec SHA256 `e4ca40048a4c7151abf80bed8034c5a489dccfdd21fa8052a1f674187da61ef5`, helper `1bc5e8bbbf9a7ab4426c050c55cd119acf98d46dfbad7e527100b44e17ff3468`로 동결했다. 기존 frozen spec/helper와 다르며 과거 증거의 hash는 유지한다. 최종source aggregate는 `47c3326c89ceb733d43b7c03664fa56fdabfe5732cbca15294b5c8afe1a9acb9`다. 실제 argv/env/명령/시간과6case 결과는 runs.json의 currentReworkRuns에 기록했다. 전체18runs48case=35PASS/13FAIL이며 역사적16runs40case와 새8PASS를 구분한다.

[실제 rotation pending](../output/playwright/issue-490/after-current-0941/security-rotation-pending-1440.png), [보안 탭 pending focus](../output/playwright/issue-490/after-current-0941/tab-rotation-security-focus-1440.json), [rotation 실제 계약](../output/playwright/issue-490/after-current-0941/security-rotation-contract-1440.json), [새 Calendar select focus](../output/playwright/issue-490/after-current-0941/calendar-field-select-focus-390.png), [새 Calendar date focus](../output/playwright/issue-490/after-current-0941/calendar-field-date-focus-390.json)를 게시한다. 최종 UI120 PNG/JSON+Gantt1 PNG/JSON+rotation contract1 JSON이다. 0.93.1 after 전체 중복 게시를 제외하고 원본470 evidence는 oldworktree와 /tmp/issue490-v1-published-evidence-preserved에 원래 SHA로 보존한다. provenance의 historicalV1/미게시 경로와 v1 manifest에 연결하며 같은 자료를 새환경 증거로 소급하지 않는다. before-selected 원본 PNG/JSON bytes는 그대로다. 기존16runs/40case=27PASS/13FAIL을 유지하고 신규 실행을 별도로 추가한다. 원격 quality/e2e/docker와 독립 최종 QA/Manager ACCEPT는 아직 NOT TESTED다.

최신main Local Fast Feedback은 typecheck PASS, scoped ESLint0errors/기존 Gantt warning4개, canonical sync Vitest2파일15tests PASS(154ms), Markdown134파일과 diff check PASS다. source323/제품5bytes/기존 tracked output582는 새경로 사전 hash와 동일하고 generated2는 정확 복원했다. owned Next는 STOP이며 추가 browser 실행은 없다. Native/actual metadata 진단의 원래 JSON에는 viewport/environment 별도 측정이 없어 configured default1280×720를 실제 측정으로 확대하지 않는다. UI/rotation geometry의 실제 viewport/locale/timezone/browser 값은 각 current provenance를 따른다. DOCUMENTATION_SYNC는 frontend 범위 PASS이며 독립 재검토·원격 공식 gate는 별도다.
