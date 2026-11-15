# Issue #920 — 하이브리드 PC Ctrl+휠 원장

## F920-001 — 터치 capability가 실제 마우스 입력을44px에 고정

2026-11-15 Owner의 Windows11/Chrome/터치스크린 보유·마우스 조작 UAT 보고다. 실제 운영0.147.0 sourcef45/image index5ac1904의 별도 합성 환경에서 실제 mouse wheel을 비교했다. fine은34→32px, touch-capable은44→44px였다. ctrl/cancelable/trusted=true, buttons0, deltaY120, prevented=true이며 실제 터치0회였다. capability만 끄면32px가 되어 이벤트 미전달/버튼 누름이 아닌 기존 coarse 고정 경로임을 확인했다.

`LOCAL:920-hybrid-red02`의 기대32/실제44 red와 differential 원문을 보존한다. CLI는 Error를 표시하면서 shell exit0이므로 이를 테스트 PASS로 읽지 않는다. 새 Playwright 회귀의 `npm run test:e2e -- tests/e2e/schedule-views.spec.ts --grep '#920' --reporter=list`도 실제 exit1/1FAIL, 기대32/실제44였다. 최초 raw run의 로그는 보존했으나 그 trace/error-context는 다음 raw run에 덮여 원문 복구하지 못했다. 이후 focused02/03 artifact는 실행별 외부 경로로 보존했다. 이 증거 한계를 숨기지 않는다.

원인: pointer/any-pointer coarse를 현재 입력 방식으로 사용해 coarse 상태와 nextDensityLevel=0이 고정됐다. 수정은 실제 Ctrl+wheel을 fine 선택으로, 실제 touch를44px 복원으로 처리한다. 첫 축소는44→34px, 초기44에서 확대는44px 상한을 유지하도록 보완했다. 버튼의 coarse CSS도 실제 row profile을 따른다. full source/환경 지문 미수집 WIP focused03은2PASS/약1.2분 SCOPED이며 최종 clean gate·운영/Windows UAT와 구별한다.

## F920-002 — 진단 CLI bootstrap 경계

최초 wrapper 직접 실행은 executable bit 부재로 exit126이었다. bash로 호출한 최신 CLI는 설치하지 않은 browser1254를 요구해 exit1/BLOCKED했다. 프로젝트에 이미 설치된 Chromium1243 executable을 진단 config에 명시해 성공했고 새 browser/OS 패키지를 설치하지 않았다. 설치된 Next guide의 확장자/일부 추정 경로 검색 실패도 실제 존재 경로로 바로잡았다. 제품 오류나 현재 공식 gate FAIL로 혼동하지 않는다. 개별 정확 시각은 미수집이며 원본 tool 응답과 private bootstrap 요약을 보존한다.

## F920-003 — CDP session 조기 detach로 capability가 원복

최초 hybrid-red에서 touch emulation을 켜자마자 session을 detach해 media가 원복됐다. height44 대기는30초 timeout이었다. 제품44px 실패 재현에 도달한 것으로 표시하지 않는다. 같은 session을 실제 입력 관측까지 유지한 hybrid-red02/differential에서 coarse=true/anyCoarse=true/maxTouchPoints10·실제44→44를 확인했다. 환경은Linux/WSL2 Chromium1243 CDP이며 Windows 실장치가 아니다.

## F920-004 — 신규 fine hit-area 기대에 row border를 누락

WIP focused02는2case 중1PASS/1FAIL, exit1이었다. 새 마우스32px 상태에서 checkbox target>=32 기대/실제31px였고 원래44px 초기 coarse 검사들은 통과했다. row border를 제외한 내부 content box31px를 새 기대에서 빠뜨린 HARNESS 오류다. target의 row 내부 높이/상하 경계와44px touch 조건을 분리해 기존 인접 행 비침범을 보존했다. 첫44px 축소의34px 진입 계약도 확정했다. focused03은 기존 #822와 신규 #920 모두 PASS이며 original focused02 trace/error-context/log는 private 별도 보존한다. timeout/retry/skip·body owner·원본 데이터 assertion 완화0이다.


## F920-005 — 정식 영향 회귀의 첫 Source 대기 실패와 준비 경계

정확 Head799a404fb50ef00ad984b5f65629c30cc4f0cd56의 targeted01은 Unit164PASS/11파일, Chromium132PASS/1FAIL(45.3분)로 전체FAIL이다. sourceFingerprint66e3d3153ee8b7ca818cd805fd263f2e993a77ba2cb81768406a4089d20b4b8a와 environmentFingerprinta33532b6539bb16cf48d4abd10b9c244daf2e675b4365fd5bd7924e847eab976은 전후 일치했다. 같은 Source의 fast9단계/4013PASS·기존3SKIP와 Docker10단계PASS는 이 FAIL을 대신하지 않는다. 원본 report/runner/log/trace/error-context와 자식 서버 진단을 보존했다.

기존 #880 nonzero viewport 사례는 첫 prepare(data-ready=true 기대/false 실제,5000ms)에서 실패했다. Ctrl+휠/실제 nonzero scroll을 하기 전이었다. 첫 Source GET 하나는 취소되고 다음 요청은 미완료였으며 health도1504ms timeout이었다. process alive/OOM0/oomKill0이고, 원본의 정확 compile/GC/스케줄 지연 원인은 UNKNOWN이다. 해당 실패를 새 밀도 코드의 결함 또는 성공으로 소급 분류하지 않는다. 신규 #920 및 기존 #898/#822 실제 입력은 이 정식 run에서도 PASS했다.

같은85행·동일 scope의 첫 View 준비까지 자른 격리 probe는 cold/warm 모두PASS했다. cold UI1775.69ms, 사전 missing-Project GET404 첫1449.29ms/다음119.99ms, 그 뒤 UI522.80ms였다. 따라서 단독에서 원본5초 실패를 재현한 것으로 주장하지 않는다. 다만 개발 route 컴파일 준비가 UI readiness 예산에 섞이는 비용을 실제 확인해 기존 #751의 GET-only 준비 패턴을 이 사례에 한정해 확장했다. missing UUID의404/no Set-Cookie만 확인하며 실제 Project source를 미리 읽거나 UI 결과를 주입하지 않는다.

보완 후 원래 전체 사례는40.9초PASS(전체약1.3분)다. 최초 ready5초·전체180초·91행·nonzero capacity/좌표·재조회·Editor 취소/저장·workspace 복귀·늦은 source/새 wheel 우선권·canonical assertion·timeout/retry/skip을 유지했다. 제품 TypeScript/CSS는799와 동일하고 변경은 테스트 준비와 문서/원장이다. 이 WIP 집중PASS는 새 clean source의 전체 공통/영향/Docker/admit를 대체하지 않는다. 원본 내부 지연 UNKNOWN은 보존하고 실제 새 source 결과는 Issue STATUS/FINAL에 연결한다.

초기 F920-001 observed event는 교차 관측과 regression exit1을 함께 요약한다. CLI protocol Error의 shell exit0과 별도 regression-red의 exit1을 구분하며 최초 CLI를 exit1로 오인하지 않는다. bootstrap F920-002도 직접 wrapper126/후속 browser 부재1을 구별한다. SCOPED 요약을 최종 exact gate 증거로 재사용하지 않는다.


F920-005 후속 정리: 같은 API를 사용하는 `schedule-views.spec.ts`의 공통 beforeEach로 동일 GET404 준비를 모았다. 전역 fixture/helper·production API·제품 TS/CSS는 바꾸지 않았다. 기존 #880 전체 사례46.2초와 신규 #920 touch-capable mouse49.1초가 모두PASS(전체2.8분)다. 앞선 특정 사례 내부 준비40.9초PASS를 지우지 않으며, 현재 공통 준비를 사용한 새 source의 전체gate는 별도로 실행한다.


## 최종 제품 source df146825의 실제 회귀

같은 basefc8/source df146825의 fast02는9단계·4013Unit PASS/기존 opt-in3SKIP, targeted02는 영향Unit164/11파일·Chromium133/13파일·0FAIL0SKIP(48.8분), docker02는10단계/runtime/API/SQLite/restart/integrity, admit02는publishAllowed=true PASS다. source/environment 전후 동일이다. 신규 #920은44.197초/retry0·48입력, 기존 F920-005 전체 #880은45.120초/retry0 PASS다. 원래799 실패와 UNKNOWN 내부 지연을 소급 수정하지 않는다. [제품 검증·main 반영](https://github.com/planner77/masterGantt/issues/920#issuecomment-6893948260).

## F920-006 — 읽기 전용 승격 preflight의 외부 종료 신호

고유 SHA publisher01은29단계/17blob/actual exact Pull·runtime/API/SQLite/restart PASS였으나, 후속 정식 승격 preflight01의 외부 session이143(SIGTERM)으로 중단됐다. 마지막 기록은 graph copy exit0/signalnull(12:10:58.158Z)이며 controller 완료는NOT TESTED였다. 정확 신호 발신자는UNKNOWN이다. preflight는 읽기 전용이므로 정식 Git/SemVer/rolling·운영 변경0이었다. 원본 영수증/AES 원문·외부 log hash·관측 시각·자기 lock metadata를 private sidecar로 보존했다.

자기 lock의 pid 사망과 nonce/inode/dev를 확인한 뒤 그 stale lock만 정리했다. 같은 script bytes와 product source/환경에서 새 directory/layout/AES evidence의 분리 process session으로 전체 검사를 새로 실행했다. 이전 partial layout을 재사용하지 않았으며 timeout/retry/graph 검사를 변경하지 않았다. 두 번째 phase는34단계·graph17blob·exact runtime/API/auth/SQLite/restart·fresh admission·ref 보존을 완료하고 READY_FOR_PROMOTION/preflight PASS와 정상 lock cleanup을 기록했다. Manager의 실제 검산 명령은exit0, AES68stream 인증/hash·truncation0, 미해결 지적0이다. 별도 Reviewer는 없으며 OWNER_MANAGED_LOCAL/independent_qa=N/A다.

두 번째 detached Node 자체의 외부 OS exit는 별도 수집하지 못했다. 실제 하위 명령 exit·최종 영수증·정상 lock cleanup 및 검산 명령exit0를 근거로 한 범위다. 원본 종료 신호 재현·원인 해결이나 자동 SIGTERM 회귀 PASS로 확대하지 않는다. [원본 EXCEPTION](https://github.com/planner77/masterGantt/issues/920#issuecomment-6894134630). 새 승격·운영 배포 결과는 Issue의 후속 기록에서 구분하며 실제 Windows 장치 Owner UAT는 별도다.


## F920-007 — 후속 원장 검산 CLI 옵션 오입력

후속 docs-only 초안에서 Manager가 존재하지 않는 `--previous-ref=df146825…`를 사용해 CLI가 exit1/BLOCKED(알 수 없거나 빈 옵션)로 거부했다. 해당 호출은 원장 검증을 실행하지 않았으며 PASS가 아니다. 실제 parser/help의 기존 `--base=<SHA>`로 바로잡고 validator·출처/append-only guard를 변경하지 않는다. 제품/정식 artifact source·GHCR/운영 변경0인 도구 인수 오류다. 초안의 새 공개 근거 종류도 실제 schema의 PUBLIC_URL과 대조해 공식 검산 전에 정합화했다. 새 최종 docs source의 공통 검사·admission은 별도로 수행한다.


F920-007의 실제 교정 검산은 `node scripts/verify-issue-ledger.mjs --base=df1468250566e840ccf00e94c276ab4aeeeb06bd` exit0/PASS였다. 당시14Issue·117Failure·254event와 기존14Markdown prefix를 보존했다. 이후 실제 회복·게시·배포 event를 append했으며 새 최종 docs source 검증은 별도다.

## 실제 정식 게시·운영 교체·Owner 수용

정식 product source df146825/0.147.1, exact index `sha256:a87b9a3e2157aae2e5bb4e8f4a84bc2ba03c19d59e1fc01e3b446a200121f54a`의 승격은102단계/외부exit0·Git/SemVer/rolling VERIFIED다. 기존502개 tag name 보존→503개, 지정6개 descriptor와 기존Git tags 불변, AES204stream 인증·hash·truncation0이다. 상세 [정식·운영 STATUS](https://github.com/planner77/masterGantt/issues/920#issuecomment-6894271081).

운영 교체는2026-11-15T12:22:45.697Z~12:23:00.859Z PASS였다. 최종 백업 `mg-quiesced-01471-20261115T122246Z-95c81e8a`를 암호화·exact 복원하고 이전/신규 이미지로 원본 hash·schema/ledger·integrity/FK를 대조한 뒤 교체했다. 별도 새 온라인 백업의 network-none 복원 volume에서 실제 권한/Origin/revision/Export·restart를 확인했다. 운영은 schema39→39/추가migration0/모든 원본table row hash 보존, app1개healthy·canonical/loopback/live/ready200, publicProject2개읽기·운영 Mutation0이다. project/volume/env/port/network·사용자Compose를 보존했고 .env는IMAGE_NAME만 바꿨다. 운영DB 복원/되감기는 수행하지 않았다.

Owner는 실제 운영 Chrome에서Ctrl+F5 후 Ctrl+마우스 휠이 정상 작동한다고 확인하고 “UAT 승인하고 #919·#920을 종료해 주세요.”로 최종 수용·종료를 위임했다. 이 실제 Windows11/Chrome 입력 범위를PASS로 기록하며 pen/pinch/AT·전기종/모든조합·off-host로 확대하지 않는다. 후속 docs-only source는 제품/빌드/태그/digest를 바꾸지 않으며 공통 검사와 admission 후 실제 main/Issue 상태를 최종 댓글에 연결한다.
