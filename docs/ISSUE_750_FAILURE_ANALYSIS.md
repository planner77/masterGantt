# Issue #750 — #623 테스트 분할 누적 실패·검증 원장

Primary Issue [#750](https://github.com/planner77/masterGantt/issues/750). [Work Packet](exec-plans/active/ISSUE_750.md), [실패 원장 정책](PR_CI_FAILURE_TRIAGE.md). #750 원격 PR CI는 아직 NOT TESTED이며 타 Issue의 실패를 #750 실패 횟수로 합산하지 않는다.

## 출처와 설계 교정

| ID | 원본·증거 | 판단/조치 | 현재 검증 |
| --- | --- | --- | --- |
| SOURCE-730-3012 | [PR #747 CI #3012.1](https://github.com/planner77/masterGantt/actions/runs/39245366403), Shard3 Job118036857253, artifact12184300517; 원본 상세는 [#730 원장](ISSUE_730_FAILURE_ANALYSIS.md) | BeforeHooks14.6797s/별도120s와 본문약59.97s/60s를 구분. 마지막 target-bindings GET은 deadline 시점 취소이며 단일 API60s 장애 확정 아님 | 원본 FAIL 불변; 새 source/원격은 별도 |
| DESIGN-001 | qa_docs read-only 설계검토: 7→11fixture(+57.1%), focused6+smoke6 writes, 현재90s 결합 잔존 | Manager는 요구한 revision+6·6write 동일원본 결합 검증을 보존. smoke에서 반복 상세진입4→1을 줄이고 실제 비용을 비교한다. 비용 절감은 미리 주장하지 않음 | 로컬 전후 측정 중 |
| DESIGN-002 | 현행8-shard CI는 file 계획 선택 | 같은 spec 분할만으로 실제 shard 분산 개선 주장 금지. 로컬 별도 프로세스/역순과 실제 Actions 비용을 구별 | 원격 비용 NOT TESTED |
| LOCAL-ENV-001 | baseline 전후 비교용 별도 worktree에서 node_modules 외부 symlink 사용 시 Turbopack `Could not find the Next.js package` | baseline worktree에 별도 frozen npm ci 설치, 해당 시도 전용 server PID 종료. 제품/config/timeout 변경 없음 | 초기 시도 ENVIRONMENT/테스트 본문 NOT RUN; 독립 설치 후 재실행 |
| REVIEW-001 | qa_docs `/root/review_scope`: 신규 설명 주석 4곳이 영어인 P2 | 관련 주석만 한글화, 식별자/단언/예산 불변. Target·Assignment 원본 GET 직전 단계명도 분리 | 최종 spec SHA256 `bd65af47b59069d9094a6e02d8b6650dc83557fd639a0b89de3a91678f1eab45`; 정적 재검토 및 브라우저 재검증 대상 |
| METADATA-001 | 원본 #750 AC3항목에 `AC1/AC2/AC3` 식별자가 없어 현행 QA의 AC 추적 형식에 맞지 않음 | 원문 요구를 변경하지 않고 해당 세 줄에 번호만 추가. Work Packet의 AC_TEST_COVERAGE/DOCUMENTATION_SYNC도 현행 parser 형식에 맞춤 | 실제 QA/Required 성공으로 간주하지 않으며 원격은 NOT TESTED |
| LOCAL-DOC-001 | 현행 `docs_gate` 직접 검사에서 짧은 AGENTS N/A 사유가 최소 길이 조건에 미달하여 BLOCKED | 항목별 적용 범위와 변경 불필요 사유를 완전하게 기술 | 실제 `docs_gate` 재실행 STRUCTURAL_PASS_SEMANTIC_REVIEW_PENDING/MAPPING_PASS_SEMANTIC_REVIEW_PENDING. 문서 의미검토·원격 QA를 대체하지 않음 |
| REVIEW-002 | 제품교정 후 Work Packet의 rollback 문구가 tests-only 당시 spec/문서만 언급한 P2 | 미발행 후보는 #623/#463 spec·picker·package/lock PATCH·연결문서 전체, 정식 발행 뒤에는 immutable tag/GHCR 유지·새 PATCH 교정으로 구분 | 문서 범위 교정, 재검토 대상; 정식 발행/승인 없음 |

## 1차 소스 동결과 예비 실행 경계

tracked `src/`, `tests/`, `scripts/`, package/lockfile/next.config.ts의 1110파일을 정렬한 path→SHA256 JSON(공백 없는 정렬 key)의 SHA256은 `2a8eae19858f6256fccfa5977e246798a87cb47eafead37a6504eb2c72014a37`이다. 명령마다 시작/종료 hash를 대조한다. Next가 재생성하는 AGENTS의 heading 및 next-env.d.ts/tsconfig.json은 소유 서버 종료 후 baseline으로 복원하며 제품/config 변경으로 게시하지 않는다.

최초 후보 예비 Chromium 실행 도중 REVIEW-001 주석/추가 계측을 수정했으므로 그 실행은 최종 동일-source PASS로 사용하지 않는다. 최종 동결 소스에서 전체11case와 누적 실패 교차선정을 다시 실행한다. 예비 수치와 최종 비용/고유 case 수를 합산하지 않는다.

## 1차 동결 소스 정상 실행·비용 관측

baseline Chromium7/7 PASS와 1차 동결11/11 PASS, skipped0/retry0/flaky0이다. 아래 값은 제품 #463 교정 전 `2a8eae...` source의 불변 이력이며 교정 후 최종 후보의 실행은 별도 기록한다. `npm test -- tests/domain/issue-623-target-resource-acceptance.test.ts tests/server/db/issue-623-target-migration.test.ts tests/server/resources/issue-623-canonical-acceptance.test.ts tests/server/projects/issue-623-target-transfer-acceptance.test.ts`는 실제4files/28tests PASS(2.05s)다.

| 시간 범위 | 변경 전7case | 최종11case |
| --- | --- | --- |
| Playwright 전체 wall | 189.006251s | 312.194110s |
| fixture setup 합계 | 75.60822s | 127.33822s |
| body 합계(seed 포함) | 97.432s | 176.162s |
| 위 body 안의 seed 합계 | 64.67862s | 110.36771s |
| fixture teardown 합계 | 0.79902s | 1.47360s |
| 결합 six-write smoke body(seed 포함) | 21.784s | 28.507s |

실제 전체 wall은 **+123.187859s/+65.177%**다. 원본6-write·revision+6 결합과 독립 경계를 동시에 유지하여 fixture7→11 및 UI 저장6→12가 필요하다. 상세 재진입4→1을 줄였지만 이 단일 표본의 wall 감소를 달성한 것은 아니다. Manager의 제출 결정은 검증 경계·실패 진단을 분리한 후보로서 비용 증가를 공개하고 PR 검증에 인계하는 범위다. 성능 개선/최종 인수 완료나 Owner의 HIGH 위험 수용으로 해석하지 않는다. `seed`는 body 부분집합이므로 body와 더하지 않는다. 별도 fixture120s와 body30/60/90/45s를 구별한다.

각 source1회·같은 Node22.14.0/npm11.10.0/Playwright1.63.0 Chromium/worker1의 로컬 관측이며 운영 성능·통계적 차이나 Actions 비용 절감 보장은 아니다. [정제한 전후 비교](evidence/issue-750/cost-comparison.json)에 각 case의 원시 phase duration·예산·상태를 보존한다. 과거9파일 실패 합집합과 추가 #624 소비자의 실제 교차검증·역순/분리 실행은 다음 절에 기록한다. 실제 Actions8-shard wall/runner 비용은 NOT TESTED다.

## LOCAL-463-001 — 14case 교차검증의 기존 팝업 geometry 실패

2026-10-23 최초 교차실행은 `--workers=1 --retries=0 --max-failures=0`에서13PASS/1FAIL, Playwright wall384.561398s/exit1이다. #621의6case·#624·#719 Milestone·#725·#726·#550past·membership·Task Editor는 PASS이며 최초 실패는 `milestone-dashboard-state.spec.ts:48`의 `inputFocused && inputVisible && activeVisible` 기대true/실제false다. 원본 trace/error-context를 별도 보존했고 원본FAIL을 소급PASS하지 않는다.

원본 trace는390×900→880→900 뒤 End에서 active option0→19, list scrollTop1648, 상위panel scroll457→456을 보인다. 그러나 세 bool과 rect 값은 수록되지 않아 어느 조건이 false였는지는 UNKNOWN이다. 단독 원본 동일case는1PASS/7.7s로 비재현했다. 이는 과거 #730 실패합집합 검사 중 관측한 기존 경로의 비결정적 실패이며 #623 mutation 실패나 실제 API404 장애로 합산하지 않는다. mock Project의 WBS/KPI404도 별도 존재하므로 실제 신규 WBS 기능PASS로 전용하지 않는다.

검증 가설은1)End 뒤 반영 시점,2)resize/상위scroll의 popup 재배치,3)지속적 실제 keyboard/geometry 결함이다. 먼저 해당spec만 같은 즉시측정/모든assertion을 유지하면서 width·각bool/rect·active/마지막option ID를 실패 전 attachment와 메시지에 보존했다. 진단 source `12c7e464707d720221b99a47e9c1df7f5ad6350e5354e1bb378f1ac963047d5b`에서 fail-fast 없이5회 반복하여 구분한다. 제품/timeout/retry/tolerance/poll 변경은 아직 없다.

### 추가 실측·음성 대조와 제품 교정

위5회 진단은4PASS/1FAIL(24.6s). 실패390px에서 `inputFocused=true,inputVisible=true,activeVisible=false`, 마지막option19, active bottom879.5/list bottom879의0.5px 잘림을 관측했다. 후속 임시 음성 대조10회는9PASS/1FAIL(48.2s)이며 원래 측정과 단언을 유지했다. 실패 시 목록scrollTop1776에 `ceil(879.5-879)=1`만 더하면1777, active bottom878.5/list879로 즉시가시성true가 됐다. 이어1776으로 원상복원하고 원래false로 실패시켜 검사를 PASS로 마스킹하지 않았다. 단순 대기 부족이 아니라 native scrollIntoView의 소수점 경계에 남는 실제 clipping이 원인이다.

ui_ux `/root/popup_bounds_design`은 기존 keyboard 가시성 원칙의 Design Delta B로 목록scroll만 한 방향 보정하는 설계를 검토했다. frontend는 기존 scrollIntoView 뒤 option/list null·contains guard 및 현재 rect 기반 top/else-bottom Math.ceil 보정을 추가했다. focus/선택·popup·상위viewport/Gantt·API를 추가 조작하지 않는다. 큰 항목의 완전 containment까지 새로 보장하지 않는다. 임시 DOM 프로브는 제거하고 원래의0허용오차/즉시 단언·진단 attachment를 보존했으며5폭 Home/ArrowDown/Up를 같은 기존case에 추가했다. 제품교정 후 같은case10회는10PASS(55.5s)다. 과거FAIL과 진단반복을 신규 고유PASS case로 합산하지 않는다.

제품 버그 교정이 포함되어 후보PATCH0.130.1/package·lock을 동기화했다. `release_required=true/release_authorized=false`로 전환하며 향후 Owner의 명시승인 전 merge/tag/GHCR는 진행하지 않는다. 기존tests-only0.130.0 착수 계획과 수치는 그때의 이력으로 보존한다.

## 최종 재동결

1110파일 같은 범위의 최종 fingerprint는 `e7a01490ad65655aebd36fa86fe381cf0bd14dfb11f9183c3869269ec1c92891`이다. #623 spec `bd65af47b59069d9094a6e02d8b6650dc83557fd639a0b89de3a91678f1eab45`는 유지, 제품 picker `521fe751eb90c1ff37411b665bf611a797593e3b9adb90fb4d3c27746510737b`, #463 spec `4244a49793e02fe5e31701d902548353864ce3a49d7cc9ee01caef35c4f5f80b`다. 명령 시작/종료마다 재대조하며 #623전체11·cross14·picker직접소비자11·역순4·로컬2part4·의도적실패cleanup을 새 소스에서 수행한다. 이전 단독/예비/교정 전PASS는 이 최종 집합의 PASS로 이월하지 않는다.

## 누적 실패 합집합과 영향

#730 원장 §23까지 9파일: `milestone-dashboard-state`, `milestone-management-persistence`, `issue-719-contextual-help`, `issue-623-resource-mvp`, `issue-726-task-logistics`, `project-resource-memberships-persistence`, `project-task-editor-persistence`, `issue-621-resource-target`, `issue-725-process-workareas` (모두 `tests/e2e/*.spec.ts`)이다. Hook/lint/npm/typecheck 등 비브라우저 원인은 새 E2E 실패로 세지 않는다. #624는 seed 직접 소비자라 추가한다. 원본 Run/Attempt별 FAIL·CANCELLED·NOT RUN은 원본 원장에 보존한다.

## 검증/미해결·승인 경계

baseline main `d2a82b66`, app0.130.0→후보0.130.1. 변경은 #623/#463 spec·공용 picker 경계·package/lock·문서이며 공통 fixture·CI/shard/권한·데이터/산식 계약은 불변이다. 로컬 실행/소스 지문/전후비용/controlled-negative/리뷰 및 충돌 결과를 아래에 추가한다. 신규 PR이 없어 기존 #750 미해결 review thread는 N/A(검색 결과0)이며 PR 생성 후 현재 Head로 다시 조회한다.

`risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`. Agent 사전 검토는 최종 Trusted QA나 Owner 승인 아님. quality/e2e/docker·Trusted·Manager ACCEPT/Actions 비용 NOT TESTED, MERGE_READY=BLOCKED. 요청대로 PR CI 시작 후 모니터링하지 않으며 병합·Main/GHCR·Release·Issue 종료를 수행하지 않는다.


## 최종 동일 소스 실행 결과 — 로컬 빠른 검증

최종 fingerprint `e7a01490ad65655aebd36fa86fe381cf0bd14dfb11f9183c3869269ec1c92891`의 1110파일 시작/종료 대조는 모든 실행에서 일치했다. Node22.14.0/npm11.10.0/Playwright1.63.0, Chromium worker1/retry0/skip0/flaky0이며 테스트·제품 소스를 실행 중 바꾸지 않았다.

| 범위 | 실제 결과 | 증거/경계 |
| --- | --- | --- |
| Domain/서버·picker context·version 검사 | 6files/37tests PASS, 2.00s | 기존 #623 28검사 + context2 + version7 |
| #623 전체 | 11PASS, 349.736872s | 실제 HTTP/SQLite, 기존6write·revision+6·Golden/Excel 유지 |
| 누적 실패 합집합 교차 | 14PASS, 401.732138s | #621 전체6·#624 및 #730 과거 실패 파일; #623은 위 정상 실행에서 별도 포함 |
| picker 직접 소비자 | 11PASS, 61.592217s | #463 나머지6 + #462 mock4/actual1 |
| 독립 경계 역순 | 4PASS | 화면복귀→binding→Resource/Assignment→WBS, 각 별도 프로세스 |
| 로컬 2part 분리 | 2+2PASS | 2/2→1/2, 교집합0·합집합 focused4, Actions8-shard 실증 아님 |
| picker 교정 반복·이미지 | 10+1PASS | 반복200개의 즉시 rect/focus/index 관측; 이미지용1회 별도 |
| 의도적 실패 cleanup | 2회 예상exit1/cleanup PASS | 최초검증 및 raw 보존 재수집; 소유 프로세스·격리 DB/dist 잔존0, trace/diagnostics 보존 |
| 정적 검증 | scoped ESLint·tsc·version·markdown·diff PASS | 실제 명령 결과, 원격 Required3 대체 아님 |

정상11+교차14+직접11은 **고유36case(실제 HTTP/SQLite24, mock12)**다. 역순4+로컬2part4+교정반복10+이미지1=추가19실행이며 고유수에 더하지 않는다. cleanup2회는 계획된 음성 대조이며 제품 회귀 실패나 PASS case 수에 합산하지 않는다. 교정 전13PASS/1FAIL·진단5회·원상복원 음성대조10회·동결 전 예비 실행은 이전 source 이력으로 유지한다.

[실행·명령/소스·cleanup 영수증](evidence/issue-750/local-validation.json), [원시 ID와 revision·Golden Excel](evidence/issue-750/canonical-identity.json), [0.5px 진단·원상복원 FAIL·교정200관측](evidence/issue-750/popup-bounds-verification.json)에 정제한 합성 자료만 저장했다. raw trace/error-context/로그/DB는 Git에 넣지 않았다. 마지막 cleanup의 raw trace/error-context를 test-results 밖에 복사하고 hash/size를 영수증에 남겨 이후 reporter 정리에 잃지 않도록 했다.

### 최종 비용 비교

| 시간 범위 | baseline7case/0.130.0 | 최종11case/0.130.1 |
| --- | --- | --- |
| Playwright 전체 wall | 189.006251s | 349.736872s |
| fixture setup 합계 | 75.60822s | 140.62427s |
| body 합계(seed 포함) | 97.432s | 199.684s |
| 위 body 안의 seed 합계 | 64.67862s | 126.37561s |
| fixture teardown 합계 | 0.79902s | 1.53401s |

각 source 로컬1표본의 최종 증가는 **+160.730621s/+85.040%**다. fixture7→11(+57.1%), 독립6write+필수결합6write로 UI 저장6→12이며 안정성 진단 경계를 위한 비용이다. 이전 source의+65.177%를 최종값으로 보고하지 않는다. seed는 body 부분집합이고 시간 합계는 runner wall과 같지 않다. 원격8-shard wall·총runner 비용·통계적 개선은 NOT TESTED다. [최종 case별 phase/예산 비교](evidence/issue-750/cost-comparison-final.json)와 [초기 불변 비교](evidence/issue-750/cost-comparison.json)를 분리한다.

### UI 증거·리뷰·충돌 처리

[교정 전](evidence/issue-750/popup-before.jpeg)과 [교정 후](evidence/issue-750/popup-after.jpeg)는 390×900 End 직후 원본 trace JPEG다. [추출 hash/시간](evidence/issue-750/popup-images.json)을 보존했다. 화면 배경의 프로젝트 없음은 합성 mock Project WBS/KPI404이며 실제 WBS 기능 PASS 근거가 아니다. 0.5px 판정은 이미지가 아니라 rect JSON에 근거한다.

REVIEW-001 주석·단계명과 REVIEW-002 rollback 범위를 수정했다. ui_ux의 최종 read-only 코드/JSON 비교는 지적0/PASS이며 실제 브라우저 독립 재실행을 주장하지 않는다. qa_docs `/root/review_scope`의 최종 read-only 사전검토는 PASS/미해결P1·P2 0건이다. Reviewer가1110파일 지문·원본 reporter/Unit 로그·비용·역순/part 집합·cleanup raw hash/size·합성 JSON/JPEG를 직접 대조하고 REVIEW-001/002 해결을 확인했다. PR 생성 후 현재 Head review thread/mergeability는 Issue STATUS 영수증으로 기록한다. 원격 main은 `d2a82b666836b28bf392215993240c0fae2d4fdc`이며 해당 baseline에서 분기해 로컬 충돌은 없다. 새 PR 전 기존 #750 PR 검색0건으로 기존 미해결 스레드는 N/A이고 이후 새 PR을 재조회한다.

현재 독립 Agent 사전검토는 OWNER_MANAGED의 최종 Owner QA/Manager ACCEPT가 아니다. HIGH 범위의 비용 증가·제품교정·PATCH 후보에 대한 Owner 위험 수용/정식 release 승인은 아직 없고 MERGE_READY=BLOCKED다. 요청 범위는 PR CI 시작까지다.

## REMOTE-AUTH-001 — PR 게시 경로 복구

로컬 커밋 뒤 git push는 `Invalid username or token`으로 실패하여 원격 branch/PR CI를 만들지 못했다. 자격증명을 출력·변경하지 않고 기존 연결된 GitHub의 blob/tree/commit/branch API로 동일 파일 바이트를 게시한다. 로컬 검토본과 원격 tree SHA 및 최종 parent/base를 교차 확인하고 PR을 생성한다. 이 인증 실패는 제품/테스트 FAIL이나 PR CI FAIL로 세지 않는다.
