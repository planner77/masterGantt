# Issue #860 — 누적 실패·리뷰·충돌 원장

Primary Issue: https://github.com/planner77/masterGantt/issues/860
Source of truth: [PR CI 실패 원장 지침](PR_CI_FAILURE_TRIAGE.md).
기준 main `fe56cc6b97f0850c316fcbf6bbc2e1ccdfca79bc`; branch `fix/issue-860-milestone-conversion`; 2026-10-30.
HIGH / OWNER_MANAGED / qa_required=true. 사용자 범위는 구현·문서·리뷰/충돌 처리 후 PR Full CI 시작까지이며 모니터링·병합·게시·종료는 제외한다.

## 1. Run/Attempt 전체 목록

착수 시 #860 관련 PR 검색 결과 0개, 원본 CI Run/Attempt와 실제 원격 실패도 없다. PR CI 시작 전 Quality/E2E8/Docker·Trusted QA는 **NOT TESTED**다. 아래 로컬 진단을 원격 CI 실패나 PASS로 표시하지 않는다.

## 2. 누적 실패·재현 매트릭스

| ID·경계 | 원본 관측 | 분류·대응 | 최신 검증·잔여 위험 |
| --- | --- | --- | --- |
| OBS-860-001 사용자 Grid 잔류/Bar 비표시 | Issue #860 사용자 보고; 운영 SHA/tag/mode/지속 시간 미확인 | 원인 UNKNOWN; 최신 main 실제 HTTP/SQLite 동일 ID 변환과 Core/Grid/Chart 대조 | 기준 fixture 변환에서 재현 안 됨. 실제 운영 환경은 NOT TESTED |
| BASE-860-001 기존 hierarchy 변환 | 최신 main 제품 소스에서 실제 HTTP·SQLite Chromium 1/1 PASS | 변환된 같은 ID의 Core visible/선택·Grid 행·Chart Bar 0 및 동명 sibling 유지 | 42.0초 전체/14.2초 test body. peer/config·응답 순서·운영 모드 경계를 별도 검사 |
| UX-860-001 사전 확인/완료 후 접근 | 기존 command는 즉시 POST하며 확인·명시 dashboard action 없음 | 요구된 UX 누락; 기존 modal/gateway/같은 ID Editor를 재사용 | 회귀 RED와 수정 후 검증은 아래 실행 기록에 누적 |
| ENV-860-001 gh 인증 | 최초 `gh issue view 860` HTTP401 Bad credentials | 환경 인증 오류; GitHub 연결 도구로 Issue·PR 조회/작성 수행 | git fetch 정상, git push --dry-run도 인증 실패. 연결 GitHub의 blob/tree/commit/branch로 같은 tree를 게시할 계획이며 credential 출력/변경 없음; 제품 실패 아님 |

누적 실제 원격 실패 파일 합집합: 없음. 로컬 진단 직접 파일은 `tests/e2e/task-context-menu-hierarchy.spec.ts`이며 기존 즉시 POST 소비자 `project-task-context-menu.spec.ts`도 함께 영향 분석한다.

## 3. 가설과 증거 경계

1. peer/행 높이 등 후속 Core config 재구성이 필터를 잃는다면 변환 후 동일 instance의 peer 왕복·cellHeight 변경에서 같은 ID가 다시 나타나야 한다.
2. canonical 응답과 projection/filter 적용 경합이면 지연 응답·동시 config 변화에서 Core visible IDs와 native DOM이 갈라져야 한다.
3. 운영 legacy/source 차이라면 동일 fixture의 현재 기본 mode에서는 재현되지 않고 운영 build SHA/환경 대조가 필요하다.

기준 변환이 PASS라는 이유로 사용자 보고를 해소됐다고 단정하지 않는다. 증거 없는 CSS hide/private Store 수정·remount·retry는 추가하지 않는다. API 문서 조회는 설치 2.7.3 실제 실행 증거가 아니다.

## 4. 최종 source 검증·문서·리뷰

최종 동결 source 검증 결과는 아래 §7에 기록한다. [Work Packet](exec-plans/active/ISSUE_860.md)에 AC1~AC6·TEST_LIFECYCLE_REVIEW·DOCUMENTATION_SYNC 및 역할을 기록한다. 실행 중 발생하는 첫 실패와 수정/미검증을 삭제하지 않고 이 원장에 추가한다. 최신 main 충돌·PR 미해결 thread·새 Head/CI 시작 provenance는 게시 시 Issue STATUS로 기록하며 결과를 기다리지 않는다.

## 5. 통합 인계

#574 V1~V8 중 이 변경은 V1(변환 저장/실패), V2(peer 복귀), V3(필터0), V4(표시 정합), V6(명시 Milestone 관리), V8(전체 canonical/Export 보존)에 연결된다. V5 inline/V7 날짜축 등 기존 고유 검사는 보존하며 #860의 일부 로컬 PASS로 #574 전체를 수용하지 않는다. 운영 사용자 프로젝트·배포 환경·최종 수동 UX·전체 조합은 NOT TESTED다.


## 6. 로컬 실행 중간 결과·리뷰 보완

- F860-FIXTURE-001: 새 확인 시나리오의 합성 비밀번호가 입력 상한12자를 초과해 프로젝트 생성 요청 전에 timeout. TEST_FIXTURE 오류이며 제품/원격 실패가 아니다. 유효한 합성 입력으로 교정하고 동일 시나리오를 재실행한다. 로그/trace의 인증 입력은 게시하지 않는다.
- F860-PROVENANCE-001: 확인 누락 RED 수집 도중 frontend 소스 쓰기가 겹쳤다. 해당 실행을 변경 전 RED 증거로 사용할 수 없다. 제품이 동결됐던 기존 HTTP/SQLite display baseline PASS만 유효하며 별도 pristine baseline을 확보하거나 정적 UX 누락 근거와 구분한다.
- PRE_QA-P2-001: 독립 qa_docs가 실제 성공 screenshot에서 persistent fixed notice가 헤더의 기존 Project/조회 제어를 덮고, 뒤의 focusable 제어가 Tab 순서에 남는 문제를 지적했다. 안내를 단순히 보이게 한 것만으로 접근성 PASS를 주장하지 않으며 제품 보완과 keyboard geometry 재검증을 진행한다.
- PRE_QA-RACE-001: fullscreen 종료 await 뒤 stale React snapshot을 사용할 수 있는 후보를 검토했다. 최신 confirmed snapshot identity·Project·Task type을 재확인하고 같은 snapshot의 Task/calendar/revision으로 Editor를 구성하며 Editor 진입이 수락된 경우에만 Dashboard를 전환하도록 보완했다. 실제 관측 실패와 정적 예방 보완을 구별한다.
- 중간 #860 정상 Chromium 1/1 PASS: 취소/Chart Escape·실제 지연 HTTP 성공·중복 submit0·동명 target/기간0·Core/Grid/Chart0·명시 filtered-dashboard 동일 ID 상세/peer/reload. 최종 소스 변경 전 중간 결과이며 후속 판정은 최종 source에서 재검증한다.
- 관련 기존 Vitest 3파일56/56 PASS: `task-hierarchy-command-service.test.ts`, `milestone-stage-service.test.ts`, `task-context-menu-model.test.ts`(3.77초). `npm ci`, version check0.138.4, Markdown links382파일, 현재 docs_gate AC1~6 구조 검증 PASS. 이는 공식 원격 전체 회귀가 아니다.

- PRE_QA-P2-001 source 보완: 성공 안내를 기존 Gantt frame의 정상 flow/toolbar 앞 `operationNotice` slot으로 옮기고 fixed 위치와 안내의 fullscreen portal을 제거했다. 원본 겹침 screenshot은 초기 후보 증거이며 최종 after로 재사용하지 않는다. 같은 frame/단일 native instance와 기존 Coordinator를 유지하고 줄어든 표시 높이·실제 keyboard/정렬을 최종 source에서 검사한다. 확인 dialog의 fullscreen portal은 별도 유지한다.

- F860-LOCAL-002 / `task-context-menu-hierarchy.spec.ts`의 #407/#418: 변환 후 전체 scope로 복귀하는 기존 일반 Task DOM visibility 단언이5초에 FAIL. 원본 receipt의 revision10/SETTLED·logicalVisibleIds/CoreVisibleIds7개에 기대 child ID가 포함되고 DOM만6개, Chart 높이는224→102px여서 마지막행이 가상화됐다. canonical/논리 행 소실이 아닌 TEST_VIEWPORT_CONTRACT로 분류했다. 변환 M0·projection 검사를 유지한 뒤 새 성공 안내를 명시적으로 닫고 기존 전체 scope·일반7개 정확 ID visibility 단언을 그대로 수행한다. timeout·retry·기존 보호 삭제 없음. 안내 자체도 desktop 한 줄 flex-wrap·8px padding·44px 버튼으로 줄이고 필터 안내를 title/aria-describedby에 보존했다. 최종 source의 동일 소비자 재실행으로 판정한다.

- F860-LOCAL-003 / 새 #860 정상 시나리오: 지연 저장·busy중 반복 Enter/Escape 후 성공 시 activeElement가body로 남아 가시 focus 기대5초 FAIL. 실제 제품 focus 결함이며 모달 unmount와 단발 RAF의 순서를 보완한 뒤 동일 source에서 재검증한다. 기존 정상 성공의 원격/운영 결과로 확대하지 않는다.
- F860-FIXTURE-004 / 새 #860 오류 시나리오: 409/412/422/500/network 이후 마지막401에서 dialog에 권한 경고와 요청 오류 role=alert2개가 있어 locator strict mode FAIL. UI 실패/정상 원본은 보존되고 기존 오류 assertion을 정확한 요청 오류 alert로 한정해 모호성을 제거한다. 마지막401 전체 완료는 최종 재실행 전 NOT TESTED다.
- 중간 bounded6case 결과는3PASS/3FAIL(4.5분). CopyID·기존 context hierarchy·기존 reload roundtrip3개 PASS, 나머지 실제 실패3개는 위 개별 사건으로 보존하며 최종 source의 PASS로 소급 변경하지 않는다.

- F860-LOCAL-003 source 보완: 이벤트 시점 RAF가 React의 modal passive cleanup보다 먼저 실행되면 dialog존재 검사로 조기 종료해 focus복원이 유실됐다. 공용 `WorkspaceDialog`에 선택적 `onAfterClose`를 추가해 native close·기존 trigger복원 직후 #860의 소유권/성공·다른 modal/새 focus guard를 한 번 실행한다. RAF/timer 재시도는 제거했고 기존 caller는 opt-in하지 않아 동작을 유지한다. StrictMode/portal cleanup 중 살아있는 요청에는 추가focus를 하지 않는다.
- 최종 제품5파일 typecheck PASS, 관련 ESLint0errors/기존Hook경고4개, diff check PASS. 제품 Unit3파일30/30PASS(`task-context-menu-model`, `canonical-projection`, `canonical-snapshot-sync`), Manager의3파일56/56 및 Reviewer의2파일14/14는 중복 case를 합산하지 않는다. 마지막 JSX/CSS·dialog opt-in 변경은 이들 순수 모델/서버의 import경계를 바꾸지 않아 관련 Unit 결과를 재사용하며 native/focus는 최종 Chromium으로 별도 판정한다.


## 7. 최종 동결 source·사전 검토·다음 PR CI

- 제품5파일·기존 E2E2파일의 [source freeze](evidence/issue-860/source-freeze.json)에서 모든 SHA256이 실행 전후 일치한다. 기존 소비자4+새3 **7/7 PASS, 3.5분**(실제 isolated HTTP/SQLite), 별도 기존 legacy WBS **1/1 PASS, 7.8초**(mock HTTP)를 [browser receipt](evidence/issue-860/browser-receipt.json)와 [7case 요약](evidence/issue-860/chromium-summary.json)에 분리했다. 반복/행렬을 고유8case 외 별도 고유case로 합산하지 않는다.
- 최초 display baseline에서 보고된 잔류는 재현되지 않았다. 새 정상 시나리오와 최종 matrix 모두 정확 ID Core/Grid/Chart0·동명 ordinary 유지·Y정렬≤1px·selection0·같은 API, revision4/보기 mutation0을 확인했다. 5폭×DayWeek10조합, fullscreen 확인·취소와 Ctrl-wheel/검색0/Resource 복귀는 [reentry](evidence/issue-860/reentry.json). 원래 운영 증상 해결이나 #574 전체 PASS로 확대하지 않는다.
- F860-LOCAL-002: 최종 scoped #407/#418 **PASS10.5초**, 정확 canonical/Core와 M0를 검사하고 새 안내를 명시 닫은 뒤 원래 일반행 검사를 보존했다. F860-LOCAL-003: 지연 응답/중복 Enter/Escape 후 성공 focus 복원 포함 정상 #860 **PASS10.5초**. F860-FIXTURE-004: 정확 요청 오류 alert 및401/409/412/422/500/network 단일POST·원본 유지 **PASS8.9초**. 이전 실패는 원본 FAIL로 보존한다.
- PRE_QA-P2-001: 정상 흐름의 compact notice·390/1440 Tab center-hit·실제 screenshot에서 배경 제어를 덮지 않음. [초기 notice](evidence/issue-860/notice-before.png)는 중간 후보이며 변경 전 main screenshot/정식 geometry 비교가 아니다. [최종390](evidence/issue-860/success-390.png)·[1440](evidence/issue-860/success-1440.png), [확인](evidence/issue-860/confirmation-390.png), [동일 ID 상세](evidence/issue-860/detail-1440.png)를 정제 보존했다.
- 타입 검사·관련 ESLint0errors/기존Hook경고4개·version0.138.4·Markdown 링크·diff check 및 docs_gate AC1~6 구조검사는 PASS. 순수 모델/서버 Unit30/56/14 실행은 겹치는 case를 합산하지 않으며 마지막 JSX/CSS/dialog opt-in으로 import 경계가 바뀌지 않아 재사용한다. 설치446packages의 deprecation 경고를 숨기지 않았으며 dependency graph 변경은 없다.
- 증거 작성 도구가 Playwright HTML JSON을 표준report 객체로 오해해 첫 summary 작성에 AttributeError를 냈다. 실제 형식은 normalized array였고 최종 원본7case 로그·별도 정제 receipt로 다시 작성했다. 제품/CI 실패가 아니며 artifact 누락/데이터 변경으로 PASS를 만들지 않았다. [manifest](evidence/issue-860/manifest.json)는 선택된 정제 파일의 byte SHA256을 결속한다. 원본 trace/HTML report/runtime log는 인증 가능 자료라 Git에 넣지 않았다.
- 공용 dialog onAfterClose는 #860 유일 opt-in이며 다른 호출자는 기존 동작 유지. 별도 ui_ux/frontend/browser_tests/qa_docs를 실행했고, qa_docs는 구현자와 분리된 사전 검토다. runtime 모델 신원·인간 GitHub 승인·QA_FINAL/Owner HIGH 수용·Manager ACCEPT는 주장하지 않는다.
- 미검증은 [Work Packet](exec-plans/active/ISSUE_860.md)의 실제 범위를 따른다. 서버가 이미 commit했으나 응답이 유실된 경로는 route.abort 전쓰기 시험과 다르다. 별도 탭 경합/전체화면 action await·명시 Grid-only/Chart-only·열 resize/운영 source·수동/AT와 새 Head 전체 Export·#574 통합 수용은 NOT TESTED다.
- 새 PR CI는 정확한 Head/base/test merge·Run ID/Attempt를 최초 등록 시 한 번 확인해 Issue STATUS에 기록한다. CI 결과 모니터링·병합·Main/GHCR·정식 게시·Issue 종료는 하지 않는다. 최종 Required Quality/E2E8/Docker·Trusted/Owner/Manager는 NOT TESTED다.

- 최종 독립 read-only Reviewer `/root/review`: **PRE_QA PASS**, 미해결 차단 지적0. 최종 source7/7 및 정제 산출물15/15 byte/hash 일치, 문서/AC/실패·원래 증상 미재현/미실행 경계까지 대조했다. UI/UX 검토·구현·browser 검증과 Reviewer를 실제 분리했다. 인간 GitHub review·QA_FINAL·Manager ACCEPT 아님.
- 게시 직전 main 재조회는 기준 SHA와 동일해 충돌0이며, 원격 #860 branch/PR은 아직 없어 기존 미해결 리뷰 thread는 없다. PR 생성 직후 thread와 test merge를 재확인한다. GitHub Required3와 Trusted/Owner/Manager 판정은 NOT TESTED로 남기고 새 CI 등록 provenance만 Issue STATUS에 한 번 기록한다.


## 8. 최초 원격 Full PR CI 실패·동일 source 제한 보완 (2026-10-30 KST)

### F860-PR-001 — PR #861 / #3441.1 / 41037374219.1

| 출처 | 정확한 기록 |
| --- | --- |
| 원본 Run | [Full PR CI #3441.1](https://github.com/planner77/masterGantt/actions/runs/41037374219), ID `41037374219`, attempt `1`, `pull_request`, `.github/workflows/ci.yml`, `FINAL_FULL` |
| Head / Base / Test-Merge | `e5c9e29eaf004de8bfa516695e741bc58bd33fe7` / `fe56cc6b97f0850c316fcbf6bbc2e1ccdfca79bc` / `f05d0551a3fffb4bb337c92952eea0385b99ca1a` |
| 최초 직접 FAIL | [Shard 5/8 Job 124002442022](https://github.com/planner77/masterGantt/actions/runs/41037374219/job/124002442022), Step `E2E shard 실행`, `tests/e2e/issue-730-view-composer.spec.ts:221`의 기존 실제 HTTP 5관점/복귀 테스트. `f.snapshot()` 호출(당시 line 284) → `tests/e2e/fixtures/target-project.ts:57`의 읽기 전용 `page.request.get`에서 `apiRequestContext.get: socket hang up` (10:05:55 UTC); HTTP status 미수신 |
| Shard 5 결과 | 고유 케이스 21 PASS, 1 FAIL, 86 NOT RUN (해당 job 로그 출력). 실패 뒤 `--max-failures=1`로 중단. 별도 `GitCommitInfo: timeout of 3000ms exceeded`는 Git fetch 계측 오류 메시지로 E2E assertions 실패와 구분. |
| 취소 | E2E Shard 1/2/3/4/6/7/8 Job 124002442052 / 124002442028 / 124002441890 / 124002441946 / 124002442009 / 124002442148 / 124002442175 = CANCELLED. 이들 샤드는 전체 PASS도 전체 미실행도 아님; 개별 취소 Job 안의 테스트 성공을 Full PASS로 승격하지 않음. |
| 직접 성공 | QA Preflight 124001589698, TypeScript 124001700714, ESLint 124001700767, Vitest 124001700670, PR production build 124002441747, Docker smoke 구현 124002441783, Required Quality 124003205021, Required Docker 124003331452 = SUCCESS. |
| 파생 | Required E2E 집계 Job 124004423089 FAILURE(Shard5 직접 FAIL), QA Final Automated Job 124004453789 FAILURE(`required e2e 미성공`); 독립 제품 실패 2건으로 중복 계수하지 않음. QA Final 신뢰 경계 확인 124001447335 SUCCESS는 Owner/Manager ACCEPT가 아님. |
| 원본 Artifact | [Playwright report / trace, ID 12969301117](https://github.com/planner77/masterGantt/actions/runs/41037374219/artifacts/12969301117), [Shard5 timing, ID 12968588832](https://github.com/planner77/masterGantt/actions/runs/41037374219/artifacts/12968588832). 원시 trace/credential·request URL을 Git 원장에 복사하지 않음. |

**누적 원격 직접 실패 파일 합집합:** `tests/e2e/issue-730-view-composer.spec.ts` 1건(F860-PR-001). 이전 F860-LOCAL-002/003/FIXTURE-004 및 사전 UI P2는 독립적인 *로컬* 원본 이력이며 원격 두 번째 실패로 세지 않는다. 최초 작성 당시 §1의 '원격 실패 없음'은 PR 생성 *전* 시점 기록이며, 지금은 본 절이 추가된 원격 실패 이력이다.

### C: 관측/가설/반례와 최소 보완

- **관측 사실:** 실패는 서버의 JSON/HTTP 401·409·500이나 화면 assertion이 아니라 GET의 응답 이전 전송 종료. #860 변경 제품5파일/E2E2파일을 실행하는 별도 shard에서 #730의 기존 test가 실패했다. 서버 SIGKILL/OOM/Next dev process 종료·keep-alive 인과는 Job 로그만으로 확정되지 않으며, 첨부 내부 진단 및 같은 source 재현은 이번 작업 환경에서 **NOT TESTED/UNKNOWN**이다. 제품 회귀라고 단정하거나 기존 사용자 Grid 잔류 원인과 결부하지 않는다.
- **확인 가능한 테스트 fixture 불일치:** 공통 `transportFailureKind`는 같은 메시지를 `SOCKET_HANG_UP`으로 분류하지만, `observedReadOnlyGet`는 메시지 `ECONNRESET`에만 두 번째 GET을 허용하여 첫 진단 이후 바로 전파했다. 과거 [#703 누적 원장](ISSUE_703_FAILURE_ANALYSIS.md)의 *정확한 GET-only 1회* 정책과 [#538 선례](exec-plans/active/ISSUE_538.md)의 동일한 전송 메시지 계약을 대조한다.
- **보완:** `tests/e2e/fixtures/isolated-application-diagnostics.ts`에서 이미 존재하는 sanitize classifier의 `ECONNRESET | SOCKET_HANG_UP` 두 값에만 기존 단발 read-only GET 복구를 적용한다. 첫 실패 관측·진단 capture를 삭제하지 않는다. `tests/scripts/isolated-readonly-get.test.ts`에 (1) 첫 socket hang up 후 정확 2회 + 진단 캡처 (2) 재차 socket hang up 시 2회로 FAIL하는 직접 regression을 추가한다. 기존 ECONNRESET 및 HTTP status/timeouts/비 Error·쓰기 재시도 금지 보호는 그대로 유지. 테스트나 workflow의 retry count/timeout/skip/assertion/8Shard/Required3 완화 없음.
- **근본 물리 원인과 계약 구분:** 두 번째 GET이 성공할지는 새로운 source의 시험 사항이며, 실제 서버가 죽어 있거나 반복 종료된다면 그대로 FAIL해야 한다. 소스의 분기 누락은 정적으로 확인했으나 transport의 발생 원인은 **UNKNOWN**이다.
- **Cross-run 실행 경계:** 이번 실패 유일 파일 `issue-730-view-composer.spec.ts`, 새 직접 unit `isolated-readonly-get.test.ts`, 동일 helper의 다른 canonical GET 소비자(예: `target-project.ts`, `milestone-stage-exchange.spec.ts`), 직접 #860 기존 `task-context-menu-hierarchy.spec.ts`·`project-task-context-menu.spec.ts`, hidden Milestone visibility와 서버 도메인은 공식 Full CI에서 검증. GitHub 연결로 읽기/쓰기 가능하지만 현재 실행환경에서 repository checkout, Node dependencies, HTTP/SQLite/Chromium은 **NOT TESTED**, 모든 케이스의 새 Head 원격 결과 역시 시작 전 NOT TESTED로 기재한다.
- **리뷰·충돌:** 첫 Head `e5c9e29`의 GitHub review threads `[]`, Codex 완료/미해결 findings 없음, 비교 `main` 대비 ahead1/behind0·`mergeable=true`. 새 push 전후 최신 Head/base·thread·mergeable을 재조회하고 달라지면 재판정한다. 코드나 서류의 원격 PASS는 본 section으로 대체하지 않는다. 배포·Main CI·GHCR·Issue 종료는 미승인.

**다음 CI:** 리뷰/충돌 재확인 후 이 원장 및 Work Packet과 테스트 fixture+unit을 단일 commit에 넣어 PR #861 Head synchronize로 새로운 `pull_request` Full CI를 시작한다. Run ID/Attempt는 실제 등록 확인 후 Issue STATUS에 따로 기록하고, 모니터링·Main/GHCR·정식 게시·Issue 종료는 수행하지 않는다.
