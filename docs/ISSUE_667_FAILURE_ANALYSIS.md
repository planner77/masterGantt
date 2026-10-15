# Issue #667 / PR #695 — 반복 실패의 종합 분석

Refs #667

## 판정과 범위

CI #2811~#2814의 원본 E2E FAIL은 보존한다. 네 실행은 서로 다른 경계에서 실패했으며 하나의 SVAR 결함이나 CI 불안정으로 합치지 않는다. 이전 선택 로컬 PASS는 해당 범위의 증거이고, 그 밖의 전이·기존 소비자·HTTP 경로를 포함한 공식 전체 회귀 PASS가 아니다. 이번 요청의 종료점은 보완·문서 동기화·미해결 리뷰/충돌 확인 후 새 Full PR CI 시작이다. 완료 모니터링·병합·릴리스는 제외한다.

모든 원본 attempt는 1이다. base는 `ee6365bf57ab637b4c0aca61fdedaf5148253052`이며 quality/docker는 각각 SUCCESS, e2e aggregate는 FAILURE다. 아래 job/step은 실제 실패 테스트의 출처다. 취소된 shard나 아직 실행되지 않은 사례를 PASS로 세지 않는다.

| 원본 CI / Head / test merge | 실제 실패와 원인 | 보완과 보존할 검증 |
| --- | --- | --- |
| [#2811 / 38742141930](https://github.com/planner77/masterGantt/actions/runs/38742141930), Head `04b6d3d90d06b742223038c31c84823d525feb21`, merge `0d6c8c909ce5836210f2149c1f53abcb5b5da45a` | shard3 job `116447303496`, step7, `milestone-dashboard-state.spec.ts:145`. visibility 전환 뒤 receipt2→3의 낡은 bridge가 STALE_PROJECTION이 되어 viewport 완료가 남지 않음. 21 PASS / 1 FAIL / 1 SKIP / 104 NOT RUN, 다른5 shard CANCELLED | visibility layout에서 옛 bridge 무효화. 별도 P2 리뷰의 cross-tab canonical 세대와 UNKNOWN hard lock도 보완. exact120/96·완료count1·3프레임·5초 단언 유지. [교정 원장](evidence/issue-667/ci2811-correction.json) |
| [#2812 / 38793354820](https://github.com/planner77/masterGantt/actions/runs/38793354820), Head `2f8f0573852a69fd85d733d0e57e61e282997372`, merge `7a30c212bca2ec67400eb9dc872e90bc39f47531` | shard6 job `116624327757`, step7, `project-task-delete-context.spec.ts:155`: failed recovery 뒤 UNKNOWN인데 테스트가 앱의 명시 최신 조회 없이 다음 Delete를 시도. 52 PASS / 1 FAIL / 37 NOT RUN. shard5 job `116624327558`, step7, `milestone-management-persistence.spec.ts:236`: 빈 프로젝트의 첫 과거 Milestone이 supplied start보다 이른 자동 end를 만들어 실제 축 width=-108/cells=[1,0], U2 SETTLED 뒤 filter-tasks 재계산 예외로 Workspace 복구 잠금 지속. editable 단계 실패이며 readonly 단계는 미도달. 27 PASS / 1 FAIL / 75 NOT RUN, job CANCELLED에도 실제 테스트 FAIL 보존; 다른4 shard CANCELLED | UNKNOWN 안내·추가 DELETE0·명시 앱 조회 후 두 번째 Delete 검증. supplied start 생략·Core 계산 시작일·open end/autoScale=false·right floor로 과거 첫 Milestone을 포함. supplied start+autoScale=true 후보는 resize에서 coverage를 잃어 기각. Day/Week 과거/미래 첫 Milestone·각3회 확장·같은 API·readonly401 유지. [교정 원장](evidence/issue-667/ci2812-correction.json) |
| [#2813 / 38798814906](https://github.com/planner77/masterGantt/actions/runs/38798814906), Head `a141ba3e4daf5ec6bbf8a99a3350edcb6c0c35be`, merge `4ef33373f7f5e2ff67098d2c5d8ea1cb51941a0d` | shard2 job `116643060487`, step7, `grid-task-start-reveal.spec.ts:30→85`: DEV getter가 생략된 설정 start=null을 날짜로 읽어 pointer 동작 전에 getFullYear 예외. 16 PASS / 1 FAIL / 65 NOT RUN, 다른5 shard CANCELLED | DEV getter가 계산된 scale 원점(Week 정렬 우선)을 읽도록 수정. 제품 reveal·기존 테스트 단언은 불변. [교정 원장](evidence/issue-667/ci2813-correction.json) |
| [#2814 / 38801237807](https://github.com/planner77/masterGantt/actions/runs/38801237807), Head `c6f18c11331be0ce2235cd5e7ac2cc6f9db3a72e`, merge `e03c36bedb460a79083dd88ac8f3377b22218505` | shard3 job `116651482123`, step7, `milestone-stage-dashboard.spec.ts:70→16`: Editor 저장·닫기 뒤 별도 APIRequestContext canonical GET의 `read ECONNRESET`. 18.286초에 실패(240초 timeout 아님). 42 PASS / 1 FAIL / 1 SKIP / 83 NOT RUN, 다른5 shard CANCELLED | UI 이후 canonical 확인3곳을 같은 출처 browser fetch/no-store로 변경하고 직접 관측. HTTP200·유효 JSON·revision+1·Membership·KPI·readonly와 viewport 검증 유지. 재시도 추가0. 연결 종료의 근인은 UNKNOWN이며 아래 진단 경계를 유지. [교정 원장](evidence/issue-667/ci2814-correction.json) |

quality/docker/e2e aggregate job ID는 각 immutable 교정 원장에 기록한다. #2814는 각각 `116652069177` / `116652701146` / `116654611375`이며 QA Automated `116654648367`도 FAILURE, Main image는 SKIPPED다.

## 최초 구현과 반복 보완에서 드러난 경계

원격 네 실행 이전 로컬 실패도 [Work Packet](exec-plans/active/ISSUE_667.md)에 보존했다. native add의 비DFS canonical→DESIRED_INVALID_TASKS는 전체 ID/형제순서를 보존하는 DFS 정규화로 수정했고 중복 ID는 계속 거부한다. 취소 뒤 늦은 writer·source taint는 실제 source/API/원래 lease·미완료 writer0·3프레임 Core/native geometry가 일치하는 read-only 복구로 처리했다. facade 예산을 mounted lifetime으로 오해해 기존3회 확장과 120px bookmark가 실패한 사례는 명령당 bounded facade로 교정하되 source 전체 bounds·taint·자동 재시도 금지를 유지했다. extent 정착 뒤 U3 재관측, stale GET 세대, Membership unknown handler, Editor child/transport busy 잠금 누락도 각각 보완했다.

잘못된 테스트 가정은 실제 계약으로 교정했다. hold된 응답에 성공-save helper를 사용한 경우, 숨겨진 거부 초안을 global Escape로 폐기했다고 가정한 경우, readonly Save 부재·열린 Editor의 native 잠금을 오류로 본 경우, 정상 SUPERSEDED를 항상 SETTLED로 기대한 경우, Date 객체 identity를 날짜 동등성으로 사용한 경우가 해당한다. 원본 실패를 삭제하거나 과거 캡처·source hash를 최신 PASS로 다시 쓰지 않는다.

반복 실패의 공통 개선점은 검증 범위다. 모듈별 성공만으로 실제 데이터→projection→axis→viewport 완료를 추론할 수 없으며, empty→첫 과거 Milestone·UNKNOWN→명시 회복·설정 변경의 기존 DEV 소비자·큰 실제 SQLite Dashboard 전이까지 포함해야 한다. 이전 PR fail-fast가 뒤쪽 사례를 미실행으로 남겨 다음 실패를 순차 노출했으므로 이번 로컬 진단은 관련46파일260사례를 `--max-failures=0 --retries=0 --workers=1`로 끝까지 실행한다. 원격6-shard/fail-fast/required gate 정책은 바꾸지 않는다. 이 로컬 집합은 전체 repository E2E가 아니다.

## 종합 로컬 실행에서 추가로 드러난 제품 회귀

첫46파일260사례 실행은 최초 실패에서 중단하지 않았다. `project-multi-task-copy-paste.spec.ts:43`의 line89에서 Expected46 / Received0인 가로 scroll 보존 실패가 추가로 드러났다. canonical Copy 결과·내부 Link·접힘·열폭은 앞선 단언을 통과했고, 안전한 trace 필드에서 copy 전 Core/native46→task-command 성공 뒤 scroll-chart0→후속 RANGE_EXTENSION baseline0을 확인했다. U2 SETTLED를 viewport 보존 완료로 취급할 수 없다.

[PROJECT_UX](PROJECT_UX.md)의 canonical sync, [#384 Work Packet](exec-plans/active/ISSUE_384.md), TEST_PLAN의 실제 다중 Copy/Paste는 same instance/scale/columns/collapse/scroll 보존을 요구한다. 따라서 exactX 단언 완화는 근거가 없다. 원본 실행을 보존한 뒤 단독 재현하고, copy dispatch에서 원래 좌표·사용자 의도를 고정해 검증된 성공 request/revision·U2 proof에서만 기존 Coordinator에 한 번 전달하는 제품 보완을 검증한다. 늦은 응답에서 새 쓰기 권한을 만들지 않으며 새 wheel/filter/reveal·API 교체·UNKNOWN이면 과거 복원을 폐기한다. 확대 원본 실행은 공유 Hierarchy/Editor3파일을 추가한49파일로 넓혔으며 원본 FAIL과 이후 교정 결과를 구분한다.

## 확대 실행의 검색 완료 영수증 경합

확대 원본 제품 source를 동결한49파일299사례 실행에서 `canonical-projection.spec.ts:255`가 첫 collapse 뒤 queryConditionsChanged=false 대기에 실패했다. 첫46파일 실행에서는 PASS했던 사례다. 안전 trace는 search 뒤에도 49192.489/49307.657/49314.334/49395.740ms에 초기 generation1/filterKey `f503993a4`/queryChanged=true/전체4행을 읽고, 첫 toggle 뒤 49505.302ms에 새 검색 generation3/filterKey `f80395d73`/queryChanged=true가 도착한 순서를 보였다. 시간은 Playwright getAttribute 완료 endTime의 밀리초이며 UTC 시각이 아니다. 새 query인지 확인하지 않은 flag-only poll이 초기 영수증을 승인한 테스트 완료 경합이다. Copy capsule 없는 mock scenario이며 새 latch/callback은 동작하지 않는다.

제품 source는 유지하고, search 전 generation/filterKey를 고정한 뒤 새 generation·새 filterKey·현재 revision/SETTLED/queryChanged=true·예상 filtered logical/Core 행 ID를 확인하는 fixture 보완을 적용한다. 기존 collapse/open/selection/layout의 후속 단언·timeout/skip/retry는 그대로다. 별도 qa_docs는 기대 행 집합과 barrier를 확인했고 관련 receipt 소비 코드에서 같은 후속 검색의 flag-only 승인 패턴을 추가로 발견하지 못했다.

49파일299사례 원본 실행은 294 PASS / 4 FAIL / 기존 baseline1 SKIP / 0 flaky / 0 미실행, 2160737.220ms로 끝났고 source12 hash drift0이었다. 검색 receipt1·달력 입력2·Resource 복원1의 FAIL을 보존한다. Resource 제품 준비 단계도 보완하므로 fixture24만으로 전체 영향 검증을 대체하지 않고 공유 port의 관련 회귀를 다시 수행한다. 서로 다른 source/실행을 단일299사례 PASS로 합치지 않는다. 원격 전체 CI는 새 PR Head에서 별도로 수행한다.

## 달력 fixture 보완 과정의 canonical DTO 경계 오류

새 근무일 fixture의 실제 past/future 두 사례는 page.goto 전에 `SchedulingError`/`DUPLICATE_CALENDAR_EXCEPTION`으로 실패했다. canonical Project calendar의 holidays는 NON_WORKING exceptions의 호환 projection인데 그대로 domain validator에 함께 전달해 날짜 예외를 중복 입력한 보완 오류였다. 합성 근무일 Unit85 PASS만으로 실제 DTO 경계의 PASS를 주장하지 않았으며, 원본 두 FAIL도 보존한다.

[API Calendar 규격](API.md)의 exceptions authority/holidays 호환 projection과 기존 `src/contracts/import.ts` 및 `src/features/gantt/project-task-adapter.ts`처럼 exceptions가 있으면 holidays를 비운 입력으로 정규화하고, exceptions가 undefined인 legacy 입력의 holidays는 유지한다. canonical DTO·Calendar validator·서버 일정 알고리즘은 바꾸지 않는다. 휴일12/25→12/28, WORKING 예외12/26 우선, legacy 입력을 별도 합성 실증했고 strict start=end=requestedDate를 유지한다. 위 검색 fixture와 함께 변경2파일24사례를 재검증하며 Resource 제품 보완 이후 공유 port 영향 검증을 별도로 수행한다.

## Resource 복귀의 Core/native 수용 범위 차이

확대 실행의 `resource-kpi-integration-ui.spec.ts:14`는 line248의 기존5초 poll에서 X=31→30으로 FAIL했고 PEER_RETURN이 TIMED_OUT했다. 원본 단일 expected/actual 비교에서 instance·columns·selection·tree 필드는 같았고 좌표 필드가 달랐다. 이 실패는 조회 연결 종료나 Copy 완료 fixture 경합과 구분한다. 독립 qa_docs는 public viewport getter가 실제 api.getState 좌표를 읽으며 원본 fixture가8실제 프레임에서 Core/native31 일치를 확인했음을 검토했다. 원본 native scrollWidth936-clientWidth905=31과 설치 Core의 독립 clamp 수식은 확인했다. 원본 변경 없는 단독 실행도21.0초 FAIL(Core/native31→30)이었다. 별도 임시 숫자 probe 진단에서 현재 public Core width906/scaleWidth936→capacity30과 native clientWidth905/scrollWidth936→capacity31을 직접 확인했다. 진단은 시작 좌표120으로 달라16.9초 PASS였으며 원본31 좌표 재현의 PASS로 대체하지 않는다. 임시 test 변경은 원래 SHA로 정확 복원했다. native capacity만 확인한 prepare 조기 반환은 Core exact31을 증명하지 못한다. 보존할 날짜 end를 조기 반환 전에 확인하고 Core exact/native±1 수용 범위를 함께 준비하는 최소 제품 보완을 적용한다. extent 변경 뒤에는 양쪽 capacity를3프레임 관측하며, 이미 충분한 빠른 경로도 apply 직전 공동 capacity를 재검사하고 최종3실제 프레임 Core exact/native±1 정착으로 완료한다. 기존 U4 PRESERVE·원래 source/current·extent 합집합·새 projection receipt를 유지하며 알 수 없는 Core geometry는 승인하지 않는다. #666의 원래390px NOT_MEASURABLE/full-capacity clamp FAIL·DEFER 합성 증거를 소급 PASS로 바꾸지 않으며 이번 제품 준비 경계의 새 증거로 구분한다. Core exact/native±1·기존 timeout·3프레임 완료·원래 lease/receipt 조건을 유지한다.

## #2814 연결 오류에서 확인한 것과 미확인한 것

원본 artifact `12005610099`의 안전 필드만 추출했다. CLI PID6660/generation1은 전후 alive이며 exit/signal 기록이 없다. HTTP worker 후보 PID6672는 두 snapshot에 모두 존재하지만 두 시점만으로 연속 생존을 증명할 수 없다. 실패 뒤 readiness HTTP200/32ms, cgroup oom/oomKill은 0→0, 호스트 free 약11.62GB→9.19GB/total 약16.76GB였다. worker 후보 `rssKb=1820640→3933340`은 RSS이며 Next heapUsed/heapLimit·80% threshold 측정이 아니다. stderr discarded0/stdout discarded109, 직접 관측 wrapper를 사용하지 않아 request 배열은 비어 있다. PATCH/tasks200 완료는 canonical GET 성공 증거가 아니다.

원본 source의 같은 단일 테스트는 로컬 PASS(16.234초, report27.039초)하여 원격 오류를 재현하지 못했다. OOM·worker 재시작·keep-alive socket 재사용을 원인으로 확정하지 않는다. [Node request.reusedSocket](https://nodejs.org/api/http.html#requestreusedsocket)은 재사용 연결의 reset 가능성을 설명하지만 이 실행의 인과 증거가 아니다. [Playwright APIRequestContext GET](https://playwright.dev/docs/api/class-apirequestcontext#api-request-context-get)의 maxRetries 기본0은 APIContext 설정이며 browser fetch 설정으로 확대하지 않는다.

기존 #680은 진단을 남긴 readonly GET의 최대1회 ECONNRESET 복구를 별도 승인했다. 이번 교정은 기존 browser same-origin 확인 선례를 적용하고 앱/테스트 재시도를 추가하지 않는다. seed APIContext GET과 UI 이후 browser GET 모두 직접 observer를 사용한다. 네트워크 실패·HTTP 실패·JSON 형식 실패를 구분하고 revision/Membership의 의미 검증은 그대로 남긴다.

다음 실패의 진단 공백을 줄이기 위해 설치 Next의 정확한 메시지3종만 `MEMORY_RESTART_WARNING` / `SERVER_START_FAILURE` / `TURBOPACK_INTERNAL_ERROR` 고정 코드로 기록한다. warning 자체는 실제 worker exit/restart 증명이 아니다. raw message·stack·header/cookie·body·env를 저장하지 않으며 변조·추가 문자열·자격증명·위조 JSON은 버린다. byte/record 한도와 lifecycle 기록·실패 재전파를 유지한다.

## 테스트 적정성 감사

별도 qa_docs가 관련41기능 spec을 정적으로 감사했다. filename 기준은 `gantt|milestone|grid-task|viewport|workspace|canonical-projection|task-persistence|task-delete|task-editor|inline-name|derived-dialog|resource-kpi`다. skip/fixme0, 명시 runner retry/toPass0, force5, expect.soft7, timeout 선언24다. 별도로 Grid reorder·Copy/Paste 보존 계약·기존 readonly GET 복구·공통 fixture·전체 E2E의 before-capture baseline skip3개를 확인했다. baseline의 after 검증은 존재하며 이번에 skip을 추가하지 않는다.

| 항목 | 판정 / 조치 |
| --- | --- |
| exact120/96, Core/native±1, 3프레임, same-instance, tree/selection/columns, UNKNOWN/auth/revision | 명시 제품 계약. 과도한 검증으로 보지 않고 유지 |
| #514의 paused RAF 중 force4, fullscreen 링크 force1 | 해당 상호작용을 위한 제한된 fixture. 별도 실제 pointer/8행렬·geometry 검증이 있어 일괄 제거하지 않음 |
| expect.soft7 / timeout60~360초 | soft도 테스트 실패로 집계. 다중전략 PoC360초를 포함한 기존 예산이며 최신18초 reset 원인 아님. 증가0 |
| #526 취소된 child409 뒤 임의100ms 대기 | 처리 완료를 보장하지 않아 false PASS 가능. 실제 해당 request의 ERR_ABORTED→route 완료→실제8RAF→ready/alert0을 검사하고 finally에서 hold/route 정리. 계약 완화가 아닌 음성 검증 강화 |
| 실패 메시지에 eager response.text() | 전체 DTO가 로그로 노출될 수 있음. HTTP status·템플릿 route·allowlist error.code만 표시. 원래 응답 의미 단언 유지 |
| 과거/미래 첫 Milestone fixture의 weekday-only 날짜 선택 | 공휴일이면 정상 schedule이 다음 근무일로 이동해 strict 날짜 단언이 false FAIL. fresh Project calendar의 createWorkingCalendar→nextWorkingDay로 입력 사전조건을 교정. 합성 휴일2026-12-25(금)→12-28(월) 실증. start=end=requestedDate·coverage·Day/Week 각3회 확장은 유지 |
| Copy 행 가시화 직후 즉시 viewport 완료로 간주 | 초기 제품 보완 뒤에도 WAIT_PROJECTION 중 exactX 검사가 먼저 실행된 중간 FAIL 보존. dispatch 전 sequence 이후의 이번 PASSIVE_RESTORE·현재 revision/receipt의 SETTLED를 기다린 뒤 기존 exactX와 Core/native±1 검사. data queue와 viewport wait를 결합하지 않음 |
| 기존 #462 reset backoff | 문서화된 readonly 전송 복구 범위. 임의 fixed wait와 구분해 유지 |

## 최종 증거와 남은 승인

광역 실행 시작 source4파일의 fingerprint는 `e64efc078c3638f9a854e53d33fc22c7c4b18d8241e233a1f055f1bf63c2d6a0`이며 parent는 #2814 Head다. 이 광역 실행 뒤 공휴일 입력·Copy 제품/완료 barrier·권한 폐기 이력을 보완한 확대12 source파일과49파일299사례 실행은 별도로 귀속한다. canonical DTO를 정규화한 실제 SQLite 달력3사례는 성공한 fixture24에 포함되며 최종 선택56과 별도 귀속한다. 확대 실행 source fingerprint는 `59e135de1b24cd32a7869b65c6321fd7774a13db0e2a94bee757b46fc937d9b3`이며 확대 원본 source의 Unit51파일714사례가 PASS했다. 실제 Copy positive/wheel/scale왕복3사례는59051.38ms에 PASS했다. Resource/fixture 보완 뒤 최종15파일 fingerprint `0c8fbccde4deadb266f2bffa5332023a28c4654a448fc6f3295b39a64178e924`에서 Unit51파일723 PASS/0FAIL/0pending, Resource strict1 PASS·fixture24 PASS를 확인했다. 같은49파일299사례의 최종 실행은 마지막61번 PASS 관측 뒤 세션이 종료되어 완료 보고서가 없다. 전체 결과는 NOT TESTED로 남기고 동일 source의 핵심7파일56사례는525610.539ms에56 PASS/0FAIL/0SKIP/0flaky로 별도 검증했다. source별 hash·명령·개별 E2E 결과·기존 skip·Unit 결과·독립 PRE_QA는 [새 교정 원장](evidence/issue-667/ci2814-correction.json)에 기록한다. 과거 JSON·캡처는 변경하지 않는다. runtime report/trace/원본 archive는 Git 밖에 보존한다.

추가 Copy/Resource 보완은 Gantt/Workspace/내부 guard와 기존 Coordinator의 권한 제한·단일 port 준비 경로를 수정한다. API/DB/SVAR dependency/CI workflow 변경0이며, Copy 제품 결함 교정과 별개인 ECONNRESET의 근인 UNKNOWN을 해결 완료했다고 주장하지 않는다. 위험도 HIGH/OWNER_MANAGED, qa_required=true를 유지하며 실제 별도 qa_docs PRE_QA와 최종 QA_FINAL·Owner ACCEPT는 다르다. 새 exact-head Quality/E2E/Docker·Trusted QA·Owner 승인은 NOT TESTED, MERGE_READY=BLOCKED다. version0.114.1·release_required=true·release_authorized=false를 유지한다.

최종 독립 사전 검토는 `/root/integration_tests` qa_docs가26게시파일·최종15source·원본 HTML56 전건/fixture24/Unit723·문서와 역사 증거를 대조해 PRE_QA PASS/DOCUMENTATION_SYNC 의미 검토 PASS·추가 지적0으로 판정했다. 복원 후 typecheck·Markdown228·version0.114.1·whitespace PASS, 변경 lint오류0·기존hook warning3이다. 이는 인간 QA_FINAL이나 새 Head 원격 전체 회귀 PASS·Owner ACCEPT가 아니다.
