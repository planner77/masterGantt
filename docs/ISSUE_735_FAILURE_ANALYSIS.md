# Issue #735 / PR #757 — 누적 PR CI 실패 분석

Primary Issue: [#735](https://github.com/planner77/masterGantt/issues/735) · PR [#757](https://github.com/planner77/masterGantt/pull/757) · 갱신일: 2026-10-20.
Source of truth: [PR CI 실패 원장 정책](PR_CI_FAILURE_TRIAGE.md), [Work Packet](exec-plans/active/ISSUE_735.md).

최신 재개 인덱스: §6 F735-002 / #3054.1 및 §7 누적 교정. §1~5는 첫 재개 당시의 원본 기록으로 보존한다.

## 1. Run/Attempt 전체 목록

재개 시점 branch/event 조회의 전체 PR CI는 아래 1개이며 attempt1이다. 새 CI의 완료 모니터링은 요청 범위 밖이다.

| PR | Run / attempt / event | Head / base / test merge | Required 결과 | 원본 증거 |
| --- | --- | --- | --- | --- |
| #757 | [#3051.1 / 39408703783](https://github.com/planner77/masterGantt/actions/runs/39408703783) / 1 / pull_request | Head `abd410fc4fa1f87be3c7975d2fa960b36f8d8877`; base `8a0fc9773d33326b40f8d97f6307c17ae0cb6933`; merge `8c9c9c62e4fa38bdfba677ca4a197d2536aea602` | Quality SUCCESS, Docker SUCCESS, E2E FAILURE; Automated QA 파생 FAILURE | [직접 실패 Shard6](https://github.com/planner77/masterGantt/actions/runs/39408703783/job/118581617889), [E2E aggregate](https://github.com/planner77/masterGantt/actions/runs/39408703783/job/118589429808) |

| Shard | Job ID | 원본 결론 / 관측 |
| --- | --- | --- |
| 1 | 118581617893 | CANCELLED, 실제 테스트 FAIL 관측 없음 |
| 2 | 118581617922 | CANCELLED, 실제 테스트 FAIL 관측 없음 |
| 3 | 118581618000 | CANCELLED; 로그 summary107PASS, 실제 테스트 FAIL 관측 없음 |
| 4 | 118581618158 | CANCELLED, 실제 테스트 FAIL 관측 없음 |
| 5 | 118581617952 | CANCELLED; 로그 summary85PASS, 실제 테스트 FAIL 관측 없음 |
| 6 | 118581617889 | FAILURE; 90PASS / 1FAIL / 43 did not run, 테스트 실행18.6분 |

취소된 Shard1~5를 PASS로 세지 않는다. 관측하지 못한 테스트 결과는 미완료이며 summary의 일부 PASS가 Job 결론을 대체하지 않는다. 직접 실패 이후 E2E aggregate와 [Automated QA Job118589464493](https://github.com/planner77/masterGantt/actions/runs/39408703783/job/118589464493)의 `required e2e 미성공`은 파생 실패다.

## 2. 누적 실패 파일 및 Cross-run 매트릭스

| 실패 ID / 파일·case | 최초 실제 실패 | 원인·교정 | 같은 후보 재검증 / 잔여 위험 |
| --- | --- | --- | --- |
| F735-001 / `tests/e2e/project-task-context-menu.spec.ts:385` / Issue #390 Copy ID copies canonical taskId without changing TaskClipboard or revision | #3051.1 Shard6, 변환 후 `snapshot` GET (`:8:39`, 호출 `:413:19`)에서 `apiRequestContext.get: read ECONNRESET` | 직접 관측은 TRANSPORT 오류, 근인 분류 UNKNOWN. Copy ID 클릭 전 실패; 서버 종료/자원/제품 원인 확정 증거 없음. 테스트·제품·timeout·retry·단언 변경0 | 아래 §5의 원형 직접·음성 재실행. 로컬 재현 여부가 원격 FAIL을 소급 변경하지 않음 |

누적 실제 실패 파일 합집합은 `tests/e2e/project-task-context-menu.spec.ts` 1개다. 테스트 취소·미실행은 추가 검증 후보이며 새 실패 파일로 만들어 세지 않는다. 과거 로컬 #735 테스트 하네스/제품 focus 실패는 Work Packet의 기존 이력을 보존하며 원격 CI 실패와 구분한다.

## 3. F735-001 — 원본 사실과 증거

- Shard6 Job 시작 `2026-10-20T10:34:50Z`, 완료 `10:54:37Z`; 직접 오류 로그 시각 `10:54:28.1709251Z`. Step7 `E2E shard 실행`의 실제 GET 연결 종료다. 기대 HTTP200 전 응답 자체가 없었으므로 API 상태/데이터 불일치를 추정하지 않는다.
- `snapshot` helper는 원형 `page.request.get`을 한 번 호출한다. Summary 자식 생성·Milestone 변환 후 canonical snapshot을 읽는 구간이며 Copy ID 명령 실행 전이다. `fetch3초 timeout`의 GitCommitInfo 경고는 reporter 부수 로그, controlled error-boundary는 의도 probe이므로 직접 실패에서 제외했다.
- infra가 기존 Run의 6개 Shard 로그를 각각 단일 조회하여 다른 실제 테스트 FAIL을 찾지 못했다. 원문에는 session 자료가 포함되어 Git/Issue에 복사하지 않는다. 새로운 관측 없이 flaky/환경 문제로 확정하지 않는다.
- Artifact 메타데이터상16개 모두 expired=false. [Shard6 Playwright report12258469489](https://github.com/planner77/masterGantt/actions/runs/39408703783/artifacts/12258469489), [source12257504085](https://github.com/planner77/masterGantt/actions/runs/39408703783/artifacts/12257504085), [timing612259118832](https://github.com/planner77/masterGantt/actions/runs/39408703783/artifacts/12259118832), [QA12258509825](https://github.com/planner77/masterGantt/actions/runs/39408703783/artifacts/12258509825). 내용 다운로드/trace 분석은 NOT TESTED. Shard1~5 report는 없으며 timing3/5·setup1~6 존재를 결과 PASS로 사용하지 않는다.

## 4. 누적 분석과 이번 변경

- 이번 변경은 main `05f1e560eee456e6fba5535255c9ede30a357c16` 정렬이다. #733 Main Shard4 용량 사건의 기존 두 파일 재배치를 그대로 가져왔으며 F735-001 연결 종료의 해결책이라고 주장하지 않는다. 기존 실패 테스트/helper와 #735 제품·전용 테스트 변경0이다.
- 실패 파일의 생산자는 실제 Project/Task/구조 mutation과 snapshot GET, 직접 소비자는 Copy ID 정상 case, 음성 소비자는 clipboard write 거부 fallback이다. 두 case를 원형 그대로 선택했다. 같은 spec 나머지 Context Menu와 취소·미실행 전체 샤드는 새 Full PR CI에 유지한다. 원인 미확정 상태에서 관련 없는 제품·fixture·retry를 수정하지 않는다.
- 기존 #735 동결 source의132개 Unit/API,6개 전용 브라우저 및2개 인접 브라우저 PASS는 과거 로컬 증거다. manifest 동일성을 별도로 확인하고 새 Head 원격 PASS로 재사용하지 않는다. 이번 로컬 재실행은 아래 두 사례에 한정한다.

## 5. 같은 최종 source 검증과 새 CI 인계

- Node22.14.0 / Playwright1.63.0 / managed Chromium153.0.8010.12, 기존 test-scoped 격리 실제 서버·SQLite와 worker1/retries0. 원본 `tests/e2e/project-task-context-menu.spec.ts` SHA256 `e0c2208d1df1c0db39ef7d3824b69eded6dbe99abc81c600cb6a07c3e9d4aaf3`, fixture `e7f85ad48b4d80c882543278702706ab4b7b359467ea2296a8895fe2bbf871a5`.
- 실행 명령: `npx playwright test --config tests/config/playwright.config.ts tests/e2e/project-task-context-menu.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=0 --grep 'Issue #390 Copy ID'`. 두 정상/음성 case를 선택하며 원형 timeout/단언을 유지한다. **2/2 PASS**, 총54.7초(정상17.7초/거부 fallback4.3초). 실행 전후 원본 spec/fixture hash가 동일하다. 로컬에서는 연결 종료가 재현되지 않았으며 GitHub runner/전체 Shard 환경에서의 근인 또는 해결은 증명하지 못했다.
- main 병합은 자동 병합 성공이며 두 Issue의 Changelog/TestPlan 내용과 최신 shard plan을 보존한다. EOF의 추가 빈 줄만 정리한다. 실제 CLI6회에서133개 spec이 정확1회 배정되고 shard counts `[23,23,23,22,21,21]`, #733→5/#726→6/#735→1이다. 누락/중복0. 새 #735 파일 때문에 main 단독132개와 다르다.
- 미해결 리뷰 스레드0, 독립 Agent 사전 검토와 DOC_SYNC는 새 인계 기록에서 확인한다. 새 Head Full CI는 게시 전 NOT TESTED이며 시작 후 URL/attempt/정확 Head는 Issue STATUS에 남긴다. Required3/Trusted QA·Owner ACCEPT/MERGE_READY는 NOT TESTED/BLOCKED다. 기존 Run FAIL과 근인 UNKNOWN을 보존한다.


## 6. F735-002 — Full #3054.1, 다른 계층 명령 후 같은 canonical GET 전송 오류

### 6.1 전체 원격 이력 재대조

branch `feat/issue-735-system-dashboard` / event `pull_request`의 접근 가능한 CI 전체는 #3051.1과 #3054.1 두 Run, 각각 attempt1이다. metadata-only/추가 attempt는 조회되지 않았다. 두 원본의25개 Job과 각6개 Shard 로그를 대조했고, 취소 Shard에서 추가 실제 테스트 FAIL은 없었다. 정제한 Job/diagnostic/timing/setup/artifact 출처는 [실행별 보조 JSON](evidence/issue-735/ci-39418238483-attempt-1.json)에 보존한다. 원시 trace·쿠키·인증 자료는 Git에 저장하지 않는다.

| Run / attempt | Head / base / test merge | Required / 실제 결과 |
| --- | --- | --- |
| [#3054.1 / 39418238483](https://github.com/planner77/masterGantt/actions/runs/39418238483) / 1 / pull_request | Head `ee3ec3a4bc0e9a31f7c933e73febac6ed6b6a60e`; base `05f1e560eee456e6fba5535255c9ede30a357c16`; test merge `58406f47670f18781cc70894df9077179a4cba15` | Quality [118613777916](https://github.com/planner77/masterGantt/actions/runs/39418238483/job/118613777916) SUCCESS; Docker [118614410211](https://github.com/planner77/masterGantt/actions/runs/39418238483/job/118614410211) SUCCESS; E2E [118623821909](https://github.com/planner77/masterGantt/actions/runs/39418238483/job/118623821909) FAILURE; QA [118623855217](https://github.com/planner77/masterGantt/actions/runs/39418238483/job/118623855217) 파생 FAILURE |

| Shard | Job ID | 원본 결론 / 관측 |
| --- | --- | --- |
| 1 | 118613386315 | CANCELLED, 추가 실제 FAIL 없음 |
| 2 | 118613386190 | SUCCESS, 133PASS/1SKIP, 테스트 실행22.8분 |
| 3 | 118613386177 | CANCELLED, summary107PASS/1SKIP, 실제 FAIL 없음 |
| 4 | 118613386205 | SUCCESS, 159PASS/1SKIP, 테스트 실행22.0분 |
| 5 | 118613386220 | CANCELLED, 추가 실제 FAIL 없음 |
| 6 | 118613386214 | FAILURE, 95PASS/1FAIL/41 did not run, 테스트 실행23.8분 |

- 직접 오류: [Shard6 Job118613386214](https://github.com/planner77/masterGantt/actions/runs/39418238483/job/118613386214), Step7 `E2E shard 실행`, `tests/e2e/project-task-context-menu.spec.ts:518`의 `Issue #72 Context Menu hierarchy commands persist canonical state without remounting`. Move up 성공 toast 뒤 snapshot 호출 `:556:19` → helper `:8:39`의 `apiRequestContext.get: read ECONNRESET`. 시각 `2026-10-20T12:20:52.0490293Z`. Job `11:56:17Z`~`12:20:57Z`이며 35분 제한에 도달한 취소가 아니다.
- HTTP200·JSON 검증 전 전송 실패다. canonical 데이터 불일치, UI 명령 실패 또는 Gantt 재마운트는 관측되지 않았다. 같은 Run에서 F735-001 Copy ID 정상 case는25.3초, clipboard 거부 case는7.0초 PASS지만 이는 F735-001 최초 원본 FAIL을 바꾸지 않는다.
- [실제 Shard6 report/진단 artifact12263609782](https://github.com/planner77/masterGantt/actions/runs/39418238483/artifacts/12263609782), [source12262680483](https://github.com/planner77/masterGantt/actions/runs/39418238483/artifacts/12262680483), [timing612264615069](https://github.com/planner77/masterGantt/actions/runs/39418238483/artifacts/12264615069). 실제 report의 fixture 진단과 timing/setup 내용까지 읽었으며 원문은 업로드하지 않았다. 이번 Run artifact17개는 조회 당시 expired=false다.

### 6.2 두 원격 진단과 부하 가설 검증

| 관측 | #3051.1 F735-001 | #3054.1 F735-002 |
| --- | --- | --- |
| 실패 진단 before/after elapsed | 24383/24403ms | 25817/25833ms |
| 프로세스 | generation1, alive=true, exitCode/signal=null, expectedShutdown=false | 동일 |
| lifecycle / Next 메모리 재시작 경고 | spawn1, exit/restart0, allowlist warning0 | 동일 |
| 별도 Health | HTTP200 / 19ms | HTTP200 / 16ms |
| cgroup oom / oomKill | baseline0/0 → failure0/0 | baseline0/0 → failure0/0 |
| cgroup current bytes | 6916947968 → 7632392192 | 7008858112 → 7670308864 |
| host free bytes | 12308516864 → 11523710976 | 12246949888 → 11542183936 |

두 cgroup maxBytes는 null로 한도 미관측이다. 프로세스·Health·OOM 관측은 서버 종료/재시작·OOM 가설을 지지하지 않으며, 모든 종류의 자원 문제를 배제했다는 뜻은 아니다. memory restart warning 부재도 인과 확정 증거가 아니다. **직접 유형 INIT_TRANSPORT, TCP/Next 내부 근인 UNKNOWN**을 유지한다.

부하 비교는 #733 M733-001의35분 용량 취소와 구분한다. 이번 Shard6 setup6종 합계43890ms, Shard4는61146ms이며 dependency mirror 지연의 실증이 없다. Shard6 timing은 성공한95entry/16file 본문1041320ms의 부분 자료다(실행95테스트와파일16개를 혼동하지 않음). Shard2는133entry/23file/892215ms, Shard3는107entry/23file/934781ms, Shard4는159entry/22file/791400ms다. 미완료/취소 timing을 successful-run10개 baseline이나 전체 wall-clock 예측으로 사용하지 않는다. Shard6의 #730/#726 본문243693/169609ms도 관측 부분값이며 이 사건의 연결 리셋 원인을 증명하지 않는다. **이번에는 부하 재배분을 하지 않는다.** 후속 Run에서 실제35분 취소·완료율/메모리·setup 근거가 확보되면 #733 이력과 함께 재배분한다. 기존6-shard/worker1/35분/필수 gate를 유지한다.

## 7. 전 이력 종합 진단과 제한적 교정

| 실패 | 공통/차이 | 이번 원인별 보완과 검증 범위 |
| --- | --- | --- |
| F735-001 / #3051.1 Copy ID | 서로 다른 UI 명령 뒤 같은 helper의 독립 APIRequestContext GET, 응답 전 ECONNRESET | 같은 파일 공통 helper를 실제 UI의 같은 출처 browser GET으로 통일, 실제 관측기 필수; 전7case 및 추가 transport 경계 회귀 |
| F735-002 / #3054.1 계층 Move up | 같은 helper 누락의 재발, 서버 생존·Health200/OOM0, 첫 사례는 같은 Run에서 PASS | 앞 사례 하나만 반복하지 않고 공통helper 모든24개 호출/7개소비자 일괄 보완; seed/업무 mutation 경로와 단언 불변 |

누적 실제 실패 파일 합집합은 계속 `tests/e2e/project-task-context-menu.spec.ts` 1개이며 case는2개다. #703/#730/#731 선례는 비교 자료이고 #735의 원격 실패로 합산하지 않는다.

- 기존 소스 전체 원형 loop: `CI_E2E_FULLY_PARALLEL=true npx playwright test --config tests/config/playwright.config.ts tests/e2e/project-task-context-menu.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=0` → **7/7 PASS**,3.5분. 각6.5/28.8/20.1/4.5/12.2/9.7/10.2초. 기존spec SHA256 `e0c2208d1df1c0db39ef7d3824b69eded6dbe99abc81c600cb6a07c3e9d4aaf3`에서 실행했다. 원격 TCP 오류의 로컬 자연 재현은 실패했으며 이 결과로 근인을 확정하지 않는다.
- 재발을 허용한 확인 가능한 테스트 경계는 **UI 후 canonical oracle가 실제 UI와 다른 독립 Playwright API GET을 사용하고 관측기를 통과하지 않는 누락**이다. [#730 F730-008 선례](ISSUE_730_FAILURE_ANALYSIS.md#17-f730-008--full-pr-ci-30231-727-멤버십-저장-후-project-get-전송-오류-2026-10-20) 및 기존 `readBrowserCanonicalSnapshot`을 재사용한다. 같은 출처 `credentials:same-origin/cache:no-store` browser GET을 정확1회 보내고 `observeIsolatedApi`를 필수 전달한다. 모든 HTTP200/JSON·Project/Task ID·revision·계층/Link/Clipboard·Gantt DOM 불변 단언을 유지하며 seed POST/Link 등 독립 API 및 제품 코드는 바꾸지 않는다.
- 기존 `observedReadOnlyGet`의 유한 재전송 경로 대신 **재전송0**인 이미 사용 중인 browser helper를 선택했다. TCP 내부 원인 수정이라고 주장하지 않는다. browser GET의 실제 실패·HTTP500·잘못된 JSON은 FAIL이며 TypeScript가 observer 누락을 차단한다.
- 변경 producer는 전용 spec의 snapshot helper, 직접 소비자는 이전 두 실패와 같은 파일의 Context Menu/viewport/clipboard/계층/linked CopyPaste/Cut7case다. 간접 소비자는 기존 browser helper를 사용하는 Task Editor 저장/reload와 Milestone persistence, 음성은 helper의 HTTP/JSON/network/foreign path 거부 및 Task 권한/데이터 불변이다. 공통helper·fixture·제품·schema·config·version 변경은 없다. 전체 cancelled shard는 새 Full PR CI에 유지하며 원격 전체를 로컬 반복하지 않는다.
- 신규 controlled 회귀는 실제 Project/Task·브라우저·서버를 사용하고, 테스트의 독립 API GET만 synthetic ECONNRESET으로 차단한다. 기존 snapshot이 그 경로에 의존함을 red로 확인한 뒤 교정 helper가 실제 browser GET1회·독립GET0회 및 원본canonical 전체 동일성을 green으로 검증한다. 이 통제 오류는 원격 TCP 내부 근인의 재현과 다르다.

## 8. 동결 후보 검증과 새 CI 인계

신규 controlled red/green, 교정 후 같은 파일8case 및 직접/간접/음성 회귀·Unit·정적 검사 결과는 종료 후 아래에 누적한다. 테스트 도중 source 변경이 있으면 해당 결과를 재사용하지 않는다. 현재 새 Head/CI Required3·Trusted QA·Owner ACCEPT는 NOT TESTED이며 MERGE_READY BLOCKED다. 사용자 요청 범위는 새 CI 시작까지로 유지한다.


- PrePR diagnose 실제 실행: `npm run verify:prepr -- --mode=diagnose --base=ee3ec3a4bc0e9a31f7c933e73febac6ed6b6a60e --issue=735 --pr=757 --risk=HIGH --failure-log=.prepr-reports/issue735-historical-input.json` → **BLOCKED**, sourceStable=true. 정확 사유는 `Diagnosis needs one PR and failures across two runs and distinct consumers`다. [JSON](evidence/issue-735/prepr-diagnose-3051-3054.json)/[요약](evidence/issue-735/prepr-diagnose-3051-3054.md). 입력은 실제2Run/1file이며 가짜 두 번째 실패 파일을 추가하지 않는다. 도구 시점의 Next 생성 설정 지문은 보존하되 최종 제품 source의 PASS로 사용하지 않는다. 실패 합집합을 빠뜨리지 않는 수동 전체8case+인접/음성 검증을 별도 기록한다.
- 로컬 Unit: `npm test -- tests/server/e2e/browser-canonical-snapshot.test.ts tests/server/e2e/isolated-application-diagnostics.test.ts tests/scripts/isolated-readonly-get.test.ts tests/scripts/e2e-shard-planner.test.ts` → **4파일/30테스트 PASS**,740ms. 실제 helper의 single-call/HTTP500/invalidJSON/network/foreign path 거부와 기존 진단·GET 복구 정책/selector를 검증했다. 프로덕션 TCP 근인 증명은 아니다.
- 후보 spec SHA256 `980b0cdd88d1b92942a82e4af1c0e001b7447d118cc9ec11729b693a3aa6d39d`, 기존 browser helper SHA256 `57c5c151745b48abcc3b15f2c93d2bd8e26ac87bee530b9218e0c54ce90c5b99` 불변. 기존 제품·전용 Unit/API13file 결합SHA `87455823a3fd01d42bc5f5512c38b01e49659cc9f1e717b123cf19dd4a699b04`도 일치한다. main shard plan은 byte 동일하며 실제 selector6회로133spec 정확1회·누락/중복0·분배 `[23,23,23,22,21,21]`, 변경 spec은 원래 Shard6 그대로다.

- 최종 동결된 교정 spec의 전체 직접8case: 앞의 원형 loop와 같은 명령에 교정 source를 사용하여 **8/8 PASS**,3.8분. 각5.9/29.2/21.3/4.8/14.1/11.1/12.3/4.1초이며 시작/끝 spec SHA가 같다. 신규 boundary case를 old helper로 실행한 controlled red4.3초와 교정 green4.3초는 별도 경로 실험이고, 최종8case에 합산해9개로 세지 않는다.
- 인접2case: `CI_E2E_FULLY_PARALLEL=true npx playwright test --config tests/config/playwright.config.ts tests/e2e/project-task-editor-persistence.spec.ts tests/e2e/milestone-management-persistence.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=0 --grep '^persists explicit editor changes|Milestone-only.*\(past\)'`는 grep의 시작 anchor가 full test title과 맞지 않아 Milestone past1개만 선택했고 **1PASS**,37.0초(case17.6초)다. 누락한 Task Editor는 해당 파일에 `--grep 'persists explicit editor changes'`로 별도 실행하여 **1PASS**,39.0초(case20.2초)다. 잘못된 선택을2개 실행했다고 기록하지 않으며 최종 고유 인접 case 수는2개다. 실제 저장/재조회/readonly·Gantt 인스턴스와 기존 exact 데이터 단언을 유지한다.
- 최종 입력13file·결합 지문/도구 버전·고유 결과는 [재검증 source manifest](evidence/issue-735/rework-3054-validation-source.json)에 남긴다. Next가 생성한 next-env.d.ts/tsconfig.json은 로컬 검증 종료 후 원래 추적 값으로 복원했으며, 생성 설정을 포함한 PrePR 시점 지문과 최종 선택13file 지문은 구별한다. 생성 설정은 제품 변경에 포함하지 않는다. raw report/trace는 로컬에만 보존하고 Git에는 정제 manifest만 저장한다.

- 최종 정적 검사: `npm run typecheck`, 변경 spec ESLint, version0.126.0, Markdown281파일, `docs_gate` 구조/AC mapping, diff whitespace PASS. 실제 managed Chromium153.0.8010.12를 별도 launch로 확인했다. 전체 Build/Vitest/E2E6/Docker·원격 Trusted QA는 새 Full PR CI 범위이며 이 로컬 결과로 대체하지 않는다. 원격 최신 main은 `05f1e560eee456e6fba5535255c9ede30a357c16`으로 재확인했고 기존 Head의 ancestor다. 새 Head/run/attempt·리뷰/충돌 최종 상태는 게시 후 Issue STATUS에 기록한다.

- 최종 독립 Agent `/root/system_qa` 사전 QA PASS/미해결 지적0. 실제 HTML의 직접8+인접2 expected10/unexpected·flaky·skipped0 및 최종13file 지문을 독립 재검산했다. 생성 설정 복원 시점 문구 지적1건도 교정했다. 이는 독립 인간 QA·Trusted QA·Owner 최종 ACCEPT가 아니며 원본2Run FAIL/TCP 근인 UNKNOWN을 유지한다.
