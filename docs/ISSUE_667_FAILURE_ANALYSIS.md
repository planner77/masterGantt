# Issue #667 / PR #695 — 반복 실패의 종합 분석

Refs #667

## 후속 실패 시 먼저 읽을 원장

이 파일은 Issue #667/PR #695의 **별도 누적 실패 분석 원장**이다. 다음 실패 때 이 문서와 해당 `docs/evidence/issue-667/ci<N>-correction.json`을 먼저 읽는다. 개별 원장은 원본 FAIL의 immutable 출처·수정 source·실제 실행/미검증을 보존하며, 서로 다른 Head/시도의 PASS를 합산하지 않는다. Issue 댓글은 게시 Head와 새 CI 시작 출처를 연결하고 이 문서는 재현·판단 근거를 보관한다.

| 실패 실행 | 구분할 증상 | 기존 분석·교정 증거 |
| --- | --- | --- |
| #2811 | visible 전환 receipt/낡은 bridge, cross-tab recovery 재잠금 | [ci2811](evidence/issue-667/ci2811-correction.json) |
| #2812 | UNKNOWN 후 다음 Delete fixture, 빈 Project 첫 과거 Milestone 음수 axis | [ci2812](evidence/issue-667/ci2812-correction.json) |
| #2813 | DEV reveal getter의 null 설정 start | [ci2813](evidence/issue-667/ci2813-correction.json) |
| #2814 | UI 후 canonical APIContext GET의 ECONNRESET; 근인 UNKNOWN | [ci2814](evidence/issue-667/ci2814-correction.json) |
| #2817 | 같은 revision 재조회 후 U3 관측 미전달/queue 정렬 | [ci2817](evidence/issue-667/ci2817-correction.json) |
| #2818 | viewport50ms frame false를 U3 deadline으로 해석 | [ci2818](evidence/issue-667/ci2818-correction.json) |
| #2819 | cross-tab SC-05 최종 canonical 확인 GET ECONNRESET; 근인 UNKNOWN | [ci2819](evidence/issue-667/ci2819-correction.json) |
| #2820 | 실패 관측을 성공 receipt에서 기다린 음성 oracle | [ci2820](evidence/issue-667/ci2820-correction.json) |
| #2825 | 독립 native Y 반영 전 X 주입; 세로 commit의 Chart X 동기화 | [ci2825](evidence/issue-667/ci2825-correction.json) |
| #2827 | Escape 뒤 같은 focused 셀의 focus 전제 오류 + scale clamp의 native-forward 오분류 | [ci2827](evidence/issue-667/ci2827-correction.json) |
| #2829 | Task hover 뒤 후행 native scroll로 정상 close; 첫 hover 전 viewport 정착 전제 | [ci2829](evidence/issue-667/ci2829-correction.json) |
| #2831 | Week 새 receipt 전 reveal 등록; 명령 중 semantic epoch 변경 경합 | [ci2831](evidence/issue-667/ci2831-correction.json) |

### 재개 순서와 기록 규격

1. 최신 PR Head/main/base/test merge·Run ID/Attempt·workflow/event를 새로 조회하고 이 원장의 이전 출처와 비교한다. 새 실패가 이전 증상과 같아도 같은 원인으로 단정하지 않는다.
2. 모든 shard의 최초 실제 단언 FAIL과 fail-fast 취소/미실행을 분리한다. aggregate/QA 파생 FAIL·global error·별도 환경 오류를 구별하고 원본 report/trace의 안전한 필드만 추출한다.
3. 원본 source에서 정확한 사례를 실행한다. 비재현 PASS도 기록하고 필요하면 통제 변형과 대조를 별도로 만든다. 제품/fixture/DEV 관측/transport/UNKNOWN을 증거로 분류한다.
4. 최소 보완과 직접·간접 영향, 선택·제외 이유를 기록한다. 단언/timeout/retry/skip·required gate를 완화하지 않는다. 최종 동결 source에서 관련 교차 회귀를 재검증하고 이전 source와 합산하지 않는다.
5. 새 `ci<N>-correction.json`과 이 문서의 새 절에 원본 run/job/step/Head/base/test merge, 관찰·가설/기각, 재현·보완, source SHA256/fingerprint, 명령/환경/고유 사례 수·PASS/FAIL/SKIP/NOT TESTED, PRE_QA·DOCUMENTATION_SYNC, 남은 위험을 기록한다. raw 로그·HTML/trace는 Git 밖에 보존하고 Secret/실제 DB/민감 데이터는 커밋하지 않는다.
6. 리뷰0·최신 main/충돌·게시 Tree 동일성을 확인해 같은 PR에 게시하고, 새 CI의 Head/base/test merge/Run/Attempt·시작 URL을 Issue STATUS에 연결한다. 시작을 전체 PASS·최종 QA/Owner ACCEPT로 표시하지 않는다.

## 판정과 범위

2026-10-16 CI #2831 후속의 현재 요청 종료점은 main 정렬·리뷰/충돌 처리·원인 분석과 보완 후 새 Full PR CI 시작 확인이다. 아래 완료 모니터링은 이전 실행의 요청 이력이다. 새 Head의 원격 검증 완료·Owner ACCEPT·병합·릴리스로 확대하지 않는다.

CI #2811~#2814의 원본 E2E FAIL은 보존한다. 네 실행은 서로 다른 경계에서 실패했으며 하나의 SVAR 결함이나 CI 불안정으로 합치지 않는다. 이전 선택 로컬 PASS는 해당 범위의 증거이고, 그 밖의 전이·기존 소비자·HTTP 경로를 포함한 공식 전체 회귀 PASS가 아니다. 이전 요청은 보완·문서 동기화·미해결 리뷰/충돌 확인 후 새 Full PR CI 시작까지였다. 이전 2026-10-16 요청은 새 CI 완료 모니터링과 실패 시 후속 보완을 포함했다(과거 실행 이력). 병합·릴리스는 제외한다.

아래 #2811~#2814 표의 원본 attempt는 모두1이다. 해당 base는 `ee6365bf57ab637b4c0aca61fdedaf5148253052`이며 quality/docker는 각각 SUCCESS, e2e aggregate는 FAILURE다. 아래 job/step은 실제 실패 테스트의 출처다. 취소된 shard나 아직 실행되지 않은 사례를 PASS로 세지 않는다.

| 원본 CI / Head / test merge | 실제 실패와 원인 | 보완과 보존할 검증 |
| --- | --- | --- |
| [#2811 / 38742141930](https://github.com/planner77/masterGantt/actions/runs/38742141930), Head `04b6d3d90d06b742223038c31c84823d525feb21`, merge `0d6c8c909ce5836210f2149c1f53abcb5b5da45a` | shard3 job `116447303496`, step7, `milestone-dashboard-state.spec.ts:145`. visibility 전환 뒤 receipt2→3의 낡은 bridge가 STALE_PROJECTION이 되어 viewport 완료가 남지 않음. 21 PASS / 1 FAIL / 1 SKIP / 104 NOT RUN, 다른5 shard CANCELLED | visibility layout에서 옛 bridge 무효화. 별도 P2 리뷰의 cross-tab canonical 세대와 UNKNOWN hard lock도 보완. exact120/96·완료count1·3프레임·5초 단언 유지. [교정 원장](evidence/issue-667/ci2811-correction.json) |
| [#2812 / 38793354820](https://github.com/planner77/masterGantt/actions/runs/38793354820), Head `2f8f0573852a69fd85d733d0e57e61e282997372`, merge `7a30c212bca2ec67400eb9dc872e90bc39f47531` | shard6 job `116624327757`, step7, `project-task-delete-context.spec.ts:155`: failed recovery 뒤 UNKNOWN인데 테스트가 앱의 명시 최신 조회 없이 다음 Delete를 시도. 52 PASS / 1 FAIL / 37 NOT RUN. shard5 job `116624327558`, step7, `milestone-management-persistence.spec.ts:236`: 빈 프로젝트의 첫 과거 Milestone이 supplied start보다 이른 자동 end를 만들어 실제 축 width=-108/cells=[1,0], U2 SETTLED 뒤 filter-tasks 재계산 예외로 Workspace 복구 잠금 지속. editable 단계 실패이며 readonly 단계는 미도달. 27 PASS / 1 FAIL / 75 NOT RUN, job CANCELLED에도 실제 테스트 FAIL 보존; 다른4 shard CANCELLED | UNKNOWN 안내·추가 DELETE0·명시 앱 조회 후 두 번째 Delete 검증. supplied start 생략·Core 계산 시작일·open end/autoScale=false·right floor로 과거 첫 Milestone을 포함. supplied start+autoScale=true 후보는 resize에서 coverage를 잃어 기각. Day/Week 과거/미래 첫 Milestone·각3회 확장·같은 API·readonly401 유지. [교정 원장](evidence/issue-667/ci2812-correction.json) |
| [#2813 / 38798814906](https://github.com/planner77/masterGantt/actions/runs/38798814906), Head `a141ba3e4daf5ec6bbf8a99a3350edcb6c0c35be`, merge `4ef33373f7f5e2ff67098d2c5d8ea1cb51941a0d` | shard2 job `116643060487`, step7, `grid-task-start-reveal.spec.ts:30→85`: DEV getter가 생략된 설정 start=null을 날짜로 읽어 pointer 동작 전에 getFullYear 예외. 16 PASS / 1 FAIL / 65 NOT RUN, 다른5 shard CANCELLED | DEV getter가 계산된 scale 원점(Week 정렬 우선)을 읽도록 수정. 제품 reveal·기존 테스트 단언은 불변. [교정 원장](evidence/issue-667/ci2813-correction.json) |
| [#2814 / 38801237807](https://github.com/planner77/masterGantt/actions/runs/38801237807), Head `c6f18c11331be0ce2235cd5e7ac2cc6f9db3a72e`, merge `e03c36bedb460a79083dd88ac8f3377b22218505` | shard3 job `116651482123`, step7, `milestone-stage-dashboard.spec.ts:70→16`: Editor 저장·닫기 뒤 별도 APIRequestContext canonical GET의 `read ECONNRESET`. 18.286초에 실패(240초 timeout 아님). 42 PASS / 1 FAIL / 1 SKIP / 83 NOT RUN, 다른5 shard CANCELLED | UI 이후 canonical 확인3곳을 같은 출처 browser fetch/no-store로 변경하고 직접 관측. HTTP200·유효 JSON·revision+1·Membership·KPI·readonly와 viewport 검증 유지. 재시도 추가0. 연결 종료의 근인은 UNKNOWN이며 아래 진단 경계를 유지. [교정 원장](evidence/issue-667/ci2814-correction.json) |

quality/docker/e2e aggregate job ID는 각 immutable 교정 원장에 기록한다. #2814는 각각 `116652069177` / `116652701146` / `116654611375`이며 QA Automated `116654648367`도 FAILURE, Main image는 SKIPPED다.

## CI #2817 — Editor 동일 revision 재조회 뒤 관측 미전달

[run38824812168 / #2817.1](https://github.com/planner77/masterGantt/actions/runs/38824812168)의 Head는 `06d34e77006ef6edcef53a6341bfbf5b4e916e69`, base는 위와 같고 원본 출처 artifact로 확인한 test merge는 `8b4bb4c75988559cc5f938e8f023e4d18b8d41bc`다. Quality job116730713030·Docker job116730953213 SUCCESS, E2E aggregate116731165862 FAILURE다. shard1 job116730267339 step7의 `gantt-state-recovery-editor.spec.ts:15→36`에서 첫 최신 조회 이후 observation3이 유지돼 새 관측 단언이 실패했다. 해당 shard1 PASS/1 FAIL/110 NOT RUN, 다른5 shard CANCELLED다.

실패 trace는 Editor GET200(96.375ms), canonical sync generation3→4·settled generation3→4·depth0, U2 `SETTLED/changed=false`를 보여 준다. U3 receipt는 revision4/semanticId2/observation3에서 바뀌지 않았다. 서버 전송 실패 #2814와 구분하며, 현재 자료에는 당시 새 U3 시도의 취소/실패 사유가 없어 직접 원인을 확정하지 않는다. 원본 SC-01 로컬 단독1회 및 별도3회는 모두 PASS였다. 원격 FAIL을 로컬 비재현으로 대체하지 않는다.

TEST_PLAN·SC-01의 새 observation/같은 semantic receipt/실제 Core 쓰기0 요구를 유지한다. GET200이나 Editor 버튼 재활성만으로 projection 완료를 승인하지 않는다. 코드 검토에서 최초 관측만 data queue를 기다리고 open/select/layout의 관측은 직접 실행하는 순서 경계를 발견했다. 실제 canonical 처리와 관측의 순서 검증 및 안전한 단계별 진단을 보완하며 원본 출처·수정·검증을 [CI #2817 원장](evidence/issue-667/ci2817-correction.json)에 기록한다.

최종 source3 fingerprint `677f27b6e682eb7214d463aba603c14c82ca35bf8c57334c5f25c128281c6a71`의 Unit71 및 Chromium40이 PASS했다. 원격 직접 근인은 UNKNOWN이며 queue ordering Unit과 실제 기존 Editor/검색/선택/viewport 회귀를 구분한다. 독립 검토에서 발견한 새 helper 오류 후 옛 waiter의 추가 관측 P2는 drain token 폐기로 교정했고 원래 원격 실패의 원인으로 돌리지 않는다. 중간 source 또는 중단된 실행은 최종40 PASS에 합산하지 않는다.

## CI #2818 — 같은 SC-01 재발과 의미 관측 조기 timeout

[CI #2818.1 / run38827799811](https://github.com/planner77/masterGantt/actions/runs/38827799811), Head `f94f2f633301a59a04a3fce2c6c7078a68f1c72d`, base `ee6365bf57ab637b4c0aca61fdedaf5148253052`, 출처 artifact로 확인한 test merge `41f9f007570aefce21c0174cf8d962b28be588c5`에서 같은 SC-01 line36이 observation3 유지로 실패했다. Quality116740291029/Docker116740499332 SUCCESS, E2E116740700316 FAILURE다. shard1 job116739804326 step7은1 PASS/1 FAIL/110 NOT RUN, 다른5 shard CANCELLED다. 이전 queue 순서 보완 및 선택40 PASS를 원격 문제 해소로 확대할 수 없었다.

이번 단계 진단은 reload GET200(66.992ms)·U2 generation4/settled4/SETTLED changed=false 뒤 generation6이 rows PENDING→semantic PENDING→semantic TIMED_OUT에 도달했음을 보인다. 초기 receipt를 재전달하는 데 실패했으며 관측 시작 누락이나 전송 오류와 구분한다. 원격 자료에는 frame false 반환의 원인과 실제 CPU/RAF 지연이 직접 계측되지 않아 그 세부 실행 원인은 미확정이다.

코드에서는 U3 의미 관측이 viewport port의 frame 함수를 공유한다. 이 함수는 한 실제 RAF가50ms 안에 오지 않으면 false를 반환하고, U3는 false를 자체1500ms deadline 소진으로 해석해 즉시 TIMED_OUT한다. 이 숨은 더 짧은 예산 경계를 원본 소스의 실제 지연 RAF로 재현한 뒤 U3 frame 대기만 분리한다. U2 recovery와 U4/viewport의 기존50ms 정책·U3의1500ms/120frame/3안정frame·actual Core/semantic/취소 조건을 유지한다. 최종 실행 증거는 원장에 별도 기록하며 원격 자체의 원인 확정은 새 CI 완료 결과와 구분한다.

원본production의 실제RAF90ms 지연 SC-01은1 FAIL(7725ms/report20059.393ms), semantic TIMED_OUT을 재현했다. U3-only 분리 후 같은 변형은 semanticId3 유지/observation3→4/reused=true/delivery SETTLED로 통과했다. 최종5 source fingerprint `058eb1aaf9d6c20f493e5b698a4a0be00e9f547efd6d1786836aba1a56725b06`에서 선택 Chromium41 PASS/0FAIL/0SKIP/0flaky/globalErrors0(157070.556ms)·Unit76 PASS를 확인했다. 원본/green 검증은 [CI #2818 원장](evidence/issue-667/ci2818-correction.json)에 귀속하며 원격 runner의 실제 지연 발생 원인은 직접 측정하지 않았다.

## CI #2819 — SC-05 최종 저장 확인의 ECONNRESET

U3 frame 보완을 게시한 Head `a376dc0914ea7ad525e9ec12bda8e0fe04207089`의 [CI #2819.1/run38830613612](https://github.com/planner77/masterGantt/actions/runs/38830613612)을 완료까지 확인했다. Quality116749238464/Docker116749517448 PASS, E2E116750083738/QA116750113482 FAIL이다. shard2 job116748850362 step7의 cross-tab stale SC-05가 line269 최종 APIRequestContext GET에서 read ECONNRESET으로11.2초에 실패했다. 12 PASS/1 FAIL/69 NOT RUN이며 다른5 shard는 CANCELLED(별도 실제 FAIL 표시 없음/완료 판정 없음)다.

UNKNOWN·잠금 해제·same API·canonical 행·후속 name-only 저장 단언 이후 마지막 실제 SQLite snapshot 확인 전송이 실패했다. 이전 의미 관측 timeout과 구분하며 #2814의 다른 callsite에서 같은 전송 종류가 드러났다. 최종 GET의 project.name/revision+3/tasks/links 검증은 필요하며 삭제하지 않는다. same-origin browser fetch는 page.route를 통과하므로 각 fault/hold route가 실제 서버로 continue되는지 확인한 호출만 교정한다. seed/auth·API독립·다른 context·재시작 persistence 또는 route 우회 검증은 기계 치환하지 않는다. 단일 최신 사례만 바꾸지 않고 관련 U5 UI 후 canonical 확인 호출의 감사·공유 helper·선택 회귀를 수행한다.

최종test5 fingerprint `da4dbdacf3237392aa07532aa11314a6fff8229afc5c4b7d650b17331604c685`의 관련 실제HTTP/SQLite18 PASS(289748.963ms)·Unit17 PASS를 확인했다. 원본stale/500 로컬2 PASS는 오류 비재현 결과이며 원격 근인은 UNKNOWN으로 유지한다. inventory64(spec62+seedhelper2) 중11곳을 교정하고 spec51/helper2의 제외 근거를 명시했다. 실제 변경은 테스트 helper/3spec/Unit5파일이며 production diff0다. [CI #2819 원장](evidence/issue-667/ci2819-correction.json)에 source·감사·원본진단·최종 선택 검증을 기록한다.

## CI #2820 — Grid Y 음성 테스트의 오래된 실패 영수증 가정

[CI #2820.1/run38832668354](https://github.com/planner77/masterGantt/actions/runs/38832668354), Head `852056e71526968baf70c599eb09e1c37331e1e1`은 Quality/Docker PASS·E2E FAIL이다. shard1 job116755309771 step7의 `projection-row-alignment.spec.ts:119→130`에서 새 성공receipt generation의 TIMED_OUT을 기대했으나 null이었다.80 PASS/1 FAIL/32 NOT RUN이며 취소5shard는 추가FAIL표시 없이 미완료다. 기존SC-01 정상/90ms는 각 개별PASS로 확인했고 Trusted 실패 사유도 원본CI FAIL이다.

실제rows 관측은gen3 TIMED_OUT을 기록하고 성공receipt는oldgen1 SETTLED를 유지했다. 원본 단독도 같은 실패(report9768.609ms)와 진단을 재현했다. 성공영수증에 실패결과 게시를 요구하는 구 테스트의 관측 대상이 #667 계약과 달랐다. 음성 검증 자체는 정당하므로 최신rows 실패진단으로 확인하고, canonical/Core/DOM IDs는 stale receipt 대신 실제 public Core/DOM에서 읽는다. 실제27.5px Y불일치·mutation0·sameinstance·복원 후fresh attempt/정렬을 유지하며 semanticId 증가를 임의로 강제하지 않는다.

최종 test1 fingerprint `b3b24d46639e866f0e128fc4fcf8318033081012307bf9ccca6049016e495d49`에서 관련42 PASS/0FAIL/0SKIP/0flaky(95593.296ms)를 확인했다. negative의 baseline gen2 delivery SETTLED→gen3 rows TIMED_OUT(oldsuccess 불변)→gen4 fresh delivery SETTLED·actual alignment를 실제 Core/DOM으로 검증했다. production/timeout/retry/skip 변경0이며 Unit은 N/A다. 원본 FAIL·최종mock API/실제Core·신규원격미검증을 [CI #2820 원장](evidence/issue-667/ci2820-correction.json)에 분리했다.

## CI #2825 — 세로 입력 반영 전 가로 입력을 주입한 fixture 경합

[CI #2825.1/run38841181071](https://github.com/planner77/masterGantt/actions/runs/38841181071)의 Head는 `6bec3a1098e603b9db9968d2206af95df12ac126`이다. Quality job116782205772/Docker job116782574511 PASS, E2E aggregate116783004794/QA Automated116783036050 FAIL이다. shard3 job116781889683 step7의 `milestone-dashboard-state.spec.ts:117→191`에서 public/native `(180,128)`을 기대했으나 `(120,128)`로 5000ms에 실패했다. 해당 shard21 PASS/1 FAIL/기존1 SKIP/106 NOT RUN, 다른5 shard는 별도 단언 FAIL 없이 CANCELLED다. 보고서의 non-test error1은 fail-fast 종료 메시지이며 별도 제품 오류가 아니다.

원본 Run API/source artifact12020974214/QA 환경의 event base는 `ee6365bf57ab637b4c0aca61fdedaf5148253052`지만, test merge `464aba6c364bf52eb87ec848537304f910696fd9`의 실제 부모는 최신 main `fd219130491c53d054754eac41a58e4a6a3da0c6`과 해당 Head다. 두 값을 같은 base로 다시 쓰지 않는다. 로컬 merge `8a88b1fbd62a91d6884b9a949ebce89a4ad59e4e`에서 최신 main/#697 검증 지침과 기존 PR 이력을 보존했다. 새 게시 후의 source provenance·required checks는 별도 검증이다.

원본 trace의 FILTER_RETURN은 이미 SETTLED였으며 새 입력 전후 Coordinator writes6/intent6/context8/projection5가 불변이었다. RANGE_EXTENSION이나 새 Coordinator 복원 쓰기는 관측되지 않았고 가로 capacity2631px도180px을 수용했다. 실제 public180 scroll 이벤트는 없었다. 따라서 새 Coordinator가180을120으로 재복원했다는 최초 가설은 지지되지 않는다.

설치 SVAR Chart는 Core scrollTop 변경의 layout에서 native Chart X를 현재 Core X로 동기화한다. fixture는 native top128 설정 직후 Core 반영을 확인하지 않고 native left180을 설정했다. 로컬 원본 단독은 PASS여서 원격 재현으로 주장하지 않는다. 같은 tick의 양축 DOM 설정·세로 scroll 이벤트 우선 전달 진단에서는 실제 Core/native `(120,128)`과 동일5000ms FAIL을 재현했다. 이는 입력 overlap의 코드 경계 증거이며 원격 runner의 정확한 이벤트 스케줄을 직접 계측한 결과는 아니다.

보완은 fixture의 독립 세로 입력이 Core/native에서 완료됐는지 확인한 뒤 가로 입력을 넣는 순서에 한정한다. 최종 `(180,128)`·필터와 layout 뒤 위치·same instance·기존5000ms·실제 wheel 우선권 단언은 유지한다. 제품/의존성/CI 변경0이며 vendor의 동시에 주입한 양축 DOM 입력 자체를 지원 보강했다고 주장하지 않는다. 최종 source·선택 회귀·사전 검토는 [이번 원장](evidence/issue-667/ci2825-correction.json)과 Work Packet에 별도로 기록한다.

최종 두 곳 barrier source1 SHA256 `1b853b2dd9be5d181bdd5ff7528d579a022524137798dde7293e23631e776cd0`에서6spec42 PASS/0 FAIL/0 SKIP/0 flaky/globalErrors0(414509.547ms), 기존Unit4파일206 PASS를 확인했다. 실제HTTP/SQLite17과 mock API/actual SVAR·DOM25를 구분하며 중간35 PASS와 합산하지 않는다. Y의 Core/native owner 반영 확인은 React Chart layout commit 전체 보증이 아니며 실제 동시양축wheel 전수와 원격의 정확 스케줄은 미검증이다. 최종 원격CI/QA/Owner는 별도다.

## CI #2827 — Escape 뒤 재사용된 focused 주차 셀의 새 focus 전제 오류

[CI #2827.1/run38844184124](https://github.com/planner77/masterGantt/actions/runs/38844184124), Head `6ba4ee3da3e36b2724880be62fd97c607cbbeb12`, base `fd219130491c53d054754eac41a58e4a6a3da0c6`, test merge `f892e95723034f82c26a07a5eeb387290233587f`의 source artifact12021948759/Run API/QA 환경/Git 부모는 일치한다. Quality116791581372/Docker116791792050 PASS, E2E116794361792/QA Automated116794380310 FAIL이다. shard4 job116791304138 step7의 `milestone-timeline-lane.spec.ts:321→346`은 주차 셀 focus 뒤 `ISO 2026-W05` Tooltip 부재로5000ms FAIL이었다. 해당 shard51 PASS/1 FAIL/기존1 SKIP/87 NOT RUN, shard6는89 PASS/기존1 SKIP으로 완료했고 다른4 shard는 추가 단언 FAIL 없이 CANCELLED다. report의 별도 error1은 fail-fast 중단 메시지다.

원본 trace는 첫 `2024-W09` focus/Tooltip PASS→Escape→두 번째 `2026-W05` focus 정상 반환과 정확 class/tabindex/ISO aria-label을 보이나 두 번째 aria-describedby/Tooltip은 없다. activeElement/노드 동일성이 원격에 기록되지 않아 직접 원격 원인은 원본 trace만으로 확정할 수 없다. 이전 #463 viewport·SC-01 정상/실제RAF90ms는 이번 실행에서 개별 PASS했으며 취소shard전체나 과거 FAIL의 소급 PASS가 아니다.

원본 source의 정확 단독 사례도 W05 Tooltip 부재/5000ms로1 FAIL(개별8086ms/report11881.094ms)이었다. 읽기전용 진단 변형은 첫W09 focus전 active=false/이전node동일=false, 둘째W05 active=true/이전node동일=true/이전node연결=true/describedby=null을 직접 확인하고 같은1 FAIL(report11343.132ms)을 기록했다. 설치 Core가 index key로 날짜 셀 DOM을 재사용하고 Escape는 Tooltip을 닫되 실제 focus를 유지하므로, 이미 focused인 같은 노드에 `.focus()`를 다시 호출해도 새 focusin을 만들지 않는다. 같은 원본 FAIL·통제 관측은 fixture의 독립 focus 진입 전제 오류를 지지한다. 원격 노드 정체성은 직접 계측되지 않았다는 경계는 유지한다.

보완은 현재 보이는 `주` toolbar control로 focus를 옮겨 실제 이탈을 확인한 뒤 해당 week cell로 새 focus 진입을 확인한다. 기존 ISO year/week·포함월·반개구간·날짜/월1일 경계·좌표±1px·5000ms·mutation0은 유지하고, Escape 뒤 Tooltip0·그 cell focus 유지도 추가 검증한다. 날짜 이동만으로 Escape-dismissed Tooltip을 자동재개하는 제품정책 변경은 하지 않는다. 보완 단독은1 PASS(개별4275ms/report7502.032ms)이며 제품/의존성/CI 변경0이다. 최종 교차검증·source·문서·사전검토는 [ci2827 원장](evidence/issue-667/ci2827-correction.json)에 따로 기록한다. 원본/진단/보완 실행을 합산하지 않는다.

### CI #2827 확대 진단의 별도 제품 결함 — scale clamp를 새 입력으로 오분류

Tooltip 보완 source의 5spec41 실행은38 PASS/3 FAIL/0 SKIP/0 flaky/errors0(150918.7ms)이었다. 새 실패는1024/1440/1920px의 lane geometry에서 Day 이동 SETTLED 후 Week 전환 뒤 날짜 이동의 `SETTLED` 기대에 `SUPERSEDED`가 반환된 것이다. geometry 테스트 자체는 Tooltip 변경과 무관하며 원본 source의 같은3사례도2 PASS/1 FAIL(1440px)을 보였다. 이 결과를 Tooltip 교정의 실패나 전체 PASS로 합치지 않는다.

1440px 읽기전용 입력 기원 진단에서 pointerdown3개는 모두 viewport 밖이고 wheel/keydown/touch는0이었다. axis 등록 당시 Core9362/native25683, callback은 event/native10315·Core9362·baseline9362를 직접 관측했다. native는 Day 잔여25683에서 Week capacity clamp10315로 **뒤로** 이동했는데 기존 guard가 Core baseline만 비교해10315>9362를 새 forward로 승격했다. 이어 userInput으로 원래 명시 이동을 취소하고 새 axis를 Core10314/native10315로 등록했다. 이 로컬 제품 경계는 프로그램 clamp를 사용자 입력으로 오분류한 결함이며 원격의 primary Tooltip 실패 원인과 별개다.

최소 제품 교정은 axis 등록의 같은 `read()` snapshot에서 Core/native baseline의 최댓값을 고정한다. 실제 native/event 일치·Core/native 차이·현재 원래 lease·own tagged 제외·1회 nativeHandled 조건은 유지하고, 양쪽 등록 좌표보다1px 초과 앞선 이동만 기존 native-forward 취소 경로로 전달한다. 실제 document wheel/pointer/keyboard 입력의 취소, 단일 port writer와 좌표/3frame·첫 날짜이동 `SETTLED` 기대는 유지한다. geometry fixture에 임의 대기·재시도·`SUPERSEDED` 허용을 추가해 숨기지 않는다. 관련 Unit과 최종 동결 source의 Timeline/viewport/Copy/Resource 교차 검증은 원장에 별도로 기록한다.

최종 source3 fingerprint `092ea07e53e767fee0d8a1163a4f2163d477fbaa6fd9cc46bdb8dab3ecb8b1fe`에서10파일250 Unit PASS(352ms)·6spec56 Chromium PASS/0 FAIL/0 SKIP/0 flaky/globalErrors0(462987.804ms)·hash drift0을 확인했다. 실제 HTTP/SQLite17과 mock API/actual SVAR·DOM39를 구분한다. 중간/원본/진단의 FAIL·PASS는 최종56에 합산하지 않으며 새 exact-Head 원격 Required/Trusted·Owner ACCEPT는 NOT TESTED다. 이 원장과 ci2827의 실제 명령/해시/분류/남은 범위를 후속 실패 때 먼저 참조한다.

## CI #2829 — Milestone hover 뒤 후행 scroll과 Tooltip close의 순서

[CI #2829.1/run38847881348](https://github.com/planner77/masterGantt/actions/runs/38847881348), Head `80ae8628cb5ac98345936bb5867de5ca8f2e8d39`, base `fd219130491c53d054754eac41a58e4a6a3da0c6`, test merge `a49e9d46057be9f9cd63950771ae2780087bc391`의 source artifact12024251684/Run API/QA 환경/Git 부모는 일치한다. Quality116803227873/Docker116803455191 PASS, E2E116806623308/QA Automated116806644918 FAIL이다. shard4 job116802892064 step7의 `project-task-hover-tooltip.spec.ts:44→71→38`은 `Stable milestone` Chart bar hover 뒤 Tooltip 가시성5000ms FAIL이었다. 해당 shard99 PASS/1 FAIL/기존1 SKIP/39 NOT RUN, shard6는89 PASS/기존1 SKIP 완료, 다른4 shard는 추가 단언 FAIL 없이 취소됐다. global error1은 fail-fast 중단 메시지다.

원장을 먼저 읽고 이전 #2827과 분리했다. 이번 source에서 이전 #551 ISO4.0s·geometry5폭·#463 viewport·SC-01 정상/RAF90ms는 개별 PASS지만 취소 shard 전체 성공/과거 FAIL의 소급 PASS가 아니다. 실패한 hover 대상은 정확 Milestone31×31 box 중앙이었고, trace699246.151ms에 정확 canonical Tooltip이 존재했다가699251.145ms에 사라졌다. 이 시간은 trace 상대ms이며 UTC가 아니다. 당시 RANGE_EXTENSION은 APPLYING/Core11818/native11819/width12564, 종료 때 SETTLED/writes3/Core=native11818/width13320/axisPRESERVED였다. 생성 실패나 Week header의 반복 focus 전제와 구분한다.

원본 spec SHA256 `a99cafd220a841514685793c3068ab2e176c152c005c0cbdd475e518ef2eb255`는 remote/local trace와 Git Head의 bytes가 같았다. 정확 source의 로컬1 FAIL은 같은 Milestone Tooltip 소멸을 재현했으나 가시성 순간 통과 뒤 name39에서 실패했다(개별6810ms/report9925.863ms). 원격의 visible38 FAIL과 같은 assertion이라고 쓰지 않는다.

읽기전용 lifecycle-v2는 nativechart scroll11819 at1591.2ms→Milestone mousemove at1641.2ms→nativechart scroll11818 at1657.3ms, 이후 추가 mousemove0을 기록했다. 기존 #492는 focus/scroll/영역 이탈 때 Tooltip을 닫는다. fixture는 `scrollIntoViewIfNeeded()` 뒤 현재 axis/native 정착을 확인하지 않고 hover해 후행 보존 scroll과 경합했다. 로컬 진단이 정상 close 기원을 확인했으며 원격은 정확 close event 미기록이라는 인과추론 경계를 유지한다. 첫 진단은 visible 순간 PASS 뒤 name FAIL의 catch 누락이 있어 v2와 별도로 보존한다.

최소 보완은 첫 hover1회 전에 현재 작업·실제 Core/native·geometry/hit가3실제프레임 안정적인지 읽기전용으로 확인하는 fixture 전제다. 과거 history의 SETTLED만 재사용하거나 임의sleep/rehover/retry·timeout 증가로 숨기지 않는다. canonical 이름/date/null·Grid/Chart 동일 내용·readonly/scope/Week/fullscreen·mutation0과 실제 scroll/focus/이탈 close 정책은 유지한다. 최종 동결 source의 A25/B1은 고유26 PASS(FAIL/SKIP/flaky/global errors0), 각각197420.692ms/7679.310ms이며 별도 HTML/시간으로 보존한다. formatter2 PASS/123ms와 초기69 Unit·초기보완6은 중복합산하지 않는다. typecheck/변경spec lint/Markdown229/version/diff PASS다. 제품/CI/의존성 변경0, 기존11개 evidence bytes 유지와 source drift0을 확인했다. source SHA·fingerprint·명령/환경/예산·선정/제외·남은 범위는 [ci2829](evidence/issue-667/ci2829-correction.json)에 분리 기록한다. 새 원격 전체 Required·QA_FINAL/Owner ACCEPT는 NOT TESTED다.

## CI #2831 — Week 새 projection 완료 전 geometry reveal

[CI #2831.1/run38852119218](https://github.com/planner77/masterGantt/actions/runs/38852119218), Head `b300ae0411117a31ea3cfc59692f69f3d64f21be`, base `fd219130491c53d054754eac41a58e4a6a3da0c6`, test merge `4bba91fea299e68b032c9a0b366dfbc0e8557373`의 source artifact12025212600/Run API/QA 환경/Git 부모는 일치한다. Quality116816278914/Docker116816495532 PASS, E2E116819334172/QA Automated116819352862 FAIL이다. shard4 job116815978545 step7의 `milestone-timeline-lane.spec.ts:380→391`은 768px sibling lane geometry에서 reveal 결과 SETTLED 기대/SUPERSEDED 수신이다. 해당 shard53 PASS/1 FAIL/기존1 SKIP/89 NOT RUN, shard6는89 PASS/기존1 SKIP 완료, 다른4 shard는 추가 assertion FAIL 없이 취소됐다. global error1은 fail-fast 중단 메시지다.

이번 원장 비교에서 #2827의 같은 SUPERSEDED 문자열과 #2829 hover 준비 전제를 구분했다. 원격768 Day geometry 첨부는 PASS지만 Week 클릭 후 최신 observation6→7은 rows/PENDING, delivery receipt는 아직day/gen2/semantic2obs2였다. reveal 직전 RANGE_EXTENSION SETTLING/writes5, Core=native10032/axisSETTLED·PRESERVED, context1/intent0/gesture0이다. 새 DIAGNOSTIC_SCROLL 등록·취소 terminal은 원본 trace에 없어 정확한 직접 취소 기원은 UNKNOWN이며 새 USER_GESTURE 취소로 단정하지 않는다. 원본768 단독 로컬1 PASS는 비재현 증거로 보존한다.

이번 ISO oracle5.3s·390 geometry3.5s·#463 viewport·SC-01 정상/RAF90ms는 개별 PASS이고, 1024/1440/1920 geometry·이전 #2829 Task hover는 미도달이다. 취소 shard 전체 성공이나 이전 FAIL의 소급 PASS로 바꾸지 않는다. 자연5폭 진단은 모두PASS였으므로 pending 단독 충분원인 가설은 기각했다. 통제 진단에서 Week DIAG 정착 관측만24actualRAF 보류하자 day/gen2로 등록된 명령 중 week/gen3가 도착해 SUPERSEDED를 재현했다. API/revision40/context1/gesture0/intent0·새USER_GESTURE0은 불변이고, 기존RANGE의NEW_RANGE 취소와 DIAG의STALE_CONTEXT_OR_INTENT를 구분했다. range current()의 initial.projectionEpoch 고정과 일치하는 로컬 인과 증거이며 원격 직접 취소 미계측은 유지한다. 임시DEV 필드/24RAF 변형은 원복하고 첫 reveal 전 현재 scale의 semantic/delivery·실제 axis/geometry 준비를 확인하는 최소 fixture 보완을 적용한다. 최초명령1회/STRICTSETTLED·의도적pending/wheel 취소 검증은 유지한다. 같은24RAF 통제에 현재Week 준비gate를 적용하면 week/gen3→gen3·최초revealSETTLED와geometryPASS였다. 최종제품0/spec1개동결후6spec 고유55 PASS(FAIL/SKIP/flaky/global errors0, report300934.710ms/test합190573ms), Coordinator91 PASS/194ms와typecheck/변경spec lint/Markdown229/version/diff PASS를 확인했다. 이전12개evidence/runtime3파일불변·source drift0, 임시DEV/24RAF·generated설정원복을 확인했다. 원본/자연/통제/최종결과는 합산하지 않으며 일부재구성snapshot provenance와 timing reporter의FAIL제외0/HTML실패2218ms를 구분한다. 최종 source/명령/환경·선정/제외는 [ci2831](evidence/issue-667/ci2831-correction.json)에 분리 누적한다. 새원격Required/QA_FINAL/Owner ACCEPT는NOT TESTED다.

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
