# Issue #807 — 누적 실패·리뷰·충돌 원장

Primary Issue: [#807](https://github.com/planner77/masterGantt/issues/807). Source of truth: [PR CI 실패 분석 정책](PR_CI_FAILURE_TRIAGE.md), [Work Packet](exec-plans/active/ISSUE_807.md). 갱신일 2026-10-25. 원본 FAIL/BLOCKED/NOT TESTED를 후속 성공으로 지우지 않는다.

최신 재개는 **F807-R03**이다. 최초 R01/R02와 로컬 L01~L11은 아래에 불변 이력으로 보존한다. 세 Full Run·90개 Job·취소21개 shard의 원본 로그와 출처 교차검증은 [누적 원격 영수증](evidence/issue-807/rework-r03-remote.json)을 참조한다.

## 원본 Run/Attempt 목록

착수 시 #807 관련 PR·원격 CI 없음. 기존 #800/PR #805와 #798/#799 실패는 다른 Issue의 원본 기록이며 이 이슈 실패 횟수에 합산하지 않는다. 새 PR CI의 Required Quality/E2E8/Docker 및 Trusted/Owner 결과는 실행 전 NOT TESTED다.

## 누적 사건 매트릭스

| ID | 원본 사실·분류 | 영향/조치 | 재검증·잔여 위험 |
| --- | --- | --- | --- |
| F807-001 | `gh issue view 807` HTTP401 `Bad credentials`; `git push --dry-run` 저장된 인증 실패. ENVIRONMENT/AUTH, 제품 test 실패 아님 | 연결된 GitHub 도구로 Issue·PR 조회/게시. 원격 mutation0인 dry-run이며 비밀값 기록 없음 | connector read와 credential 없는 공개 exact Git fetch 가능. 실제 게시·tree/부모/bytes 동등성은 후속 검증 |
| F807-L01 | 최초 Playwright CLI open: 최신 CLI가 요구한 Chromium1247 미설치로 daemon 종료(code1). ENVIRONMENT | 설치된 Chromium1243을 임시 CLI 설정의 executablePath로 지정하고 before/after 실제 browser version을 고정 | 설치된 `@playwright/test@1.63.0`의 browsers.json도 Chromium1243/version153.0.8010.12임을 확인했다. 최신 CLI와 package-pinned runner의 요구 차이며 Pre-PR binary 검증 정책은 변경하지 않음 |
| F807-L02 | 최초 before 5폭 관측의 문서 가로 overflow는0이었으나 collector manifest 마감 시 복제 파일명 `issue-807-dashboard-metrics.mjs` ENOENT. TEST_EVIDENCE | collector 파일명을 교정하고 동일 fixture·제품 무변경으로 5폭 전체 재수집 | 첫 관측은 마감 실패로 PARTIAL이며 새 완결 실행과 합산하지 않는다. 최초 파일은 재수집으로 덮였고 이 표가 초기 stdout 요약을 보존함 |
| F807-L03 | 첫 after 5폭의 문서 가로 overflow0 관측 중 마지막 출처 표시 수정이 겹침. SOURCE_STABILITY/PARTIAL | 구현 고정 후 after 5폭 전부 재수집 | 첫 after 관측은 최종 source 증거로 사용하지 않는다. 최종 재수집과 구분해 보존 |
| F807-L04 | #736 전체6 case를 외부 수동 관측 서버3207로 실행. `PLAYWRIGHT_BASE_URL`로 disposable DB 격리를 우회해 기존 seed의 BU/P/S 중복·`createTargetProject` line23 Project master400, fixture5 FAIL/관측기1 PASS. TEST_ENVIRONMENT | 새 disposable DB·서버의 원래 isolated-application fixture로 재실행 | 제품 동작 이전 fixture 실패이며 앞선 관측기1 PASS를 제품6case PASS로 합산하지 않음. 외부 URL 환경을 해제하고 원본 실패 artifact를 보존 |
| F807-L05 | mock workload status batch 앞8case PASS 뒤 마지막 긴 이름 geometry case 약1.5분 timeout, 뒤따른 trace ENOENT. timeout 원인 UNKNOWN | 동시 runner가 같은 `test-results`를 쓴 artifact 경쟁 확인. 원본 보존 경로 `.prepr-reports/issue807-external-failures/`. 실행별 output을 분리하고 순차 실행으로 변경 | trace 경쟁은 확인됐지만 timeout 원인까지 동일하다고 단정하지 않는다. timeout/retry를 늘려 숨기지 않으며 앞8개를 최종 source PASS로 자동 승계하지 않음 |
| F807-L06 | 같은 외부 서버 배치의 기존 Milestone/Plan fixture 초기화 resource-admin401. TEST_ENVIRONMENT | 서버의 Resource 관리자 설정과 다른 fixture 비밀번호를 사용한 외부 서버 우회 제거. 원래 isolated fixture로 재실행 | `resource-milestone-ui.spec.ts`, `resource-plan-ui.spec.ts` 각1 FAIL. 제품 동작 이전이며 독립 DB/원래 관리자 설정에서 재검증 필요 |
| F807-L07 | 중간 after1440 실측: input/select top396/height44, 필터 button top400/height40으로 같은 빠른 조건 줄 baseline4px 불일치. PRODUCT_UI/관측 FAIL. 이후 fresh isolated batch에서도 새 #807 case line249 `controls.every(height>=44)` expected true/actual false로 실제 FAIL | 리소스 host 안 필터 button만 min-height44로 교정하고 동일 source 5폭 재수집·회귀 | 원본 `.prepr-reports/issue807-isolated1/report.json`: 8case 중7PASS/1FAIL, 350.330초·retry0/skip0/flaky0. 전역 button 규칙·공통5관점은 변경하지 않으며 최종 재검증 필요 |
| F807-L08 | fresh isolated E2E와 수동 서버 동시 실행이 같은 worktree의 `next-env.d.ts`/`tsconfig.json` 자동 생성 파일을 건드려 manual HMR 반복·1024 수집 정체. TEST_ENVIRONMENT/관측 PARTIAL | collector/소유 CLI daemon을 중단하고 E2E와 수동 관측을 서버1개·순차 실행으로 변경 | 기존 after는 일부 덮인 중간 자료이며 최종 증거로 쓰지 않는다. source/생성 파일 경합을 반복하지 않도록 Manager가 검증 순서를 고정함 |
| F807-L09 | 수동 CLI 세션 재생성 뒤 관측 준비 보조 코드가 unlock에 잘못된 `password` 필드를 보내400, `editPassword` 정정 후 성공204를201 기대로 오판. TEST_SETUP | 현행 API/fixture의 `editPassword`/204 계약으로 보조 코드 정정, 준비되지 않은 collector 실행 중단 | 제품/API 변경 없음. 실패 준비와 중단된 수집은 PASS 증거로 사용하지 않음 |
| F807-L10 | 최종5폭 이후 보충 조작에서 강제 scroll120→focus/Shift+Tab→peer 왕복의 복귀값0을120과 비교해 실패. TEST_ORACLE | 단계별 진단: set120→동적 button focus120→native Shift+Tab 시 이미0(전환 전)→기본 Enter0→동적 Enter0. 앱이120을 지웠다는 가설 기각 | 사용자 focus 이동이 만든 최신0을 보존한 결과다. 별도 실제 pointer 왕복120→기본0→동적120 PASS. [정제 UI 영수증](../output/playwright/issue-807/local-ui.json)에서 최종5폭 manifest PASS와 보충 기대 오류를 구분 |
| F807-L11 | 실제 `verify:prepr --mode=fast`가 helper/manual collector 두 경로의 자동 producer→consumer mapping UNKNOWN2로 BLOCKED(명령 exit1) | 정책·선택기 수정 없이 Work Packet에 실제 수동 매핑·실행 증거를 기록. [영수증](../output/playwright/issue-807/prepr-fast.json) | sourceStable=true, selected32/missing0/실행 step0. CLI 전체 fast/production build PASS가 아니며 Unit22·선택 Chromium6·최종 typecheck/lint·version/discovery/link는 각각 별도 실제 검증 |

실제 실패 E2E 파일 합집합: `tests/e2e/issue-736-resource-dashboard.spec.ts`(외부 서버 fixture 초기화5case 및 F807-L07 새#807 control height 실제 PRODUCT_UI FAIL), `tests/e2e/project-resource-workload-status.spec.ts`(긴 이름 geometry timeout1case), `tests/e2e/resource-milestone-ui.spec.ts`와 `tests/e2e/resource-plan-ui.spec.ts`(각 fixture401). CLI 시작/관측기 마감 실패는 제품 E2E 실패로 합산하지 않는다. 실행하지 않은 테스트를 PASS로 간주하지 않는다.

첫 fresh isolated batch의 기존 #736 5case와 #526/#527 각1case는 실제 PASS다(원본 report 위 경로). F807-L04/L06의 fixture 실패를 제품 FAIL로 승격하거나 지우지 않고 독립 초기화 결과와 분리한다. 최종 CSS/scroll 수정 뒤 직접 영향 case와 F807-L05의 긴 이름/방문별 LIFO를 별도로 재검증한다.

최종 선택 batch `.prepr-reports/issue807-final1/report.json`은 **6/6 PASS**, retry0/skip0/flaky0이다. #798 다섯 관점5폭·#7365폭·#736 선택80%/Project140% Plan·새#807 독립 조건/기간 인계/숨은 요청/keep-mounted5폭·#525 긴 이름·#530 M1 정확 범위/새 방문 기본 현황/원 견적 peer LIFO·nonzero outer scroll 정확 복원을 실행했다. 기존 source의7PASS와 최종6PASS를 독립13개로 합산하지 않는다(중복2case). F807-L05는 고유 output·fresh 환경에서 재현되지 않았으며 최초 timeout의 원인은 UNKNOWN으로 유지한다. F807-L07은 실제 button44px 단언 통과로 교정 확인했다.

두 환경 초기화 문제가 연쇄 노출되어 Manager는 외부 수동 서버 재사용 계획을 폐기하고 기존 disposable fixture·고유 DB/포트·고정 package browser로 재검증하도록 조정했다. 같은 실패를 단순 rerun하거나 timeout을 늘리지 않는다.

## 리뷰·충돌

착수 및 게시 준비 시 #807 기존 PR 없음. 기존 GitHub 미해결 thread/PR 충돌은 N/A다. 설계/독립 사전검토의 동적 진입 helper 가정·서로 다른 selector/snapshot·방문별 peer/outer scroll·export lease·숨은 요청·범위 표시 지적은 구현과 실제 선택 회귀로 보완했다. 최종 Reviewer `/root/resource_qa`는 LOCAL_PRE_QA PASS/DOCUMENTATION_SYNC PASS·신규 P1/P2 없음으로 반환했다.

게시 전 공개 원격 main 재조회는 baseline `c69c22e248de6d2af9cc753eb0296ff97d4a2b8f`와 일치한다. 생성된 AGENTS/Next 설정과 기존 다른 이슈 tracked output의 본인 생성 변경을 복원했고 기존 사용자 자료는 건드리지 않았다. 실제 새 PR의 thread/mergeability 및 Head/Base/Test-Merge·Run ID/Attempt는 게시 후 Issue STATUS로 기록한다. 원격 결과 기록만을 위해 PR body를 edited하거나 추가 commit으로 CI를 중복 시작하지 않는다.

## 동일 source 검증·다음 단계

before/after 동일 fixture5폭과 최종 Chromium6·Unit22·typecheck/lint·version/discovery/link·DOCUMENTATION_SYNC·별도 qa_docs 사전검토를 완료했다. 자동 Pre-PR fast의 UNKNOWN2 BLOCKED 및 최초 실패는 위 기록대로 유지한다. 새 Head Full CI 시작 후 결과는 NOT TESTED로 인계하며 모니터링·병합·Main/GHCR·정식 게시·Issue 종료는 이번 범위가 아니다.


## F807-R01 — PR #810 Full PR CI #3292.1 직접 실패 및 리뷰 (2026-10-25)

- **귀속:** [PR #810](https://github.com/planner77/masterGantt/pull/810), [Run 40184046283 · attempt 1](https://github.com/planner77/masterGantt/actions/runs/40184046283) / `FINAL_FULL` (`pull_request`). HEAD `6ab0c8f8ba1b844d68e0623b201680750d7171d4`, base `c69c22e248de6d2af9cc753eb0296ff97d4a2b8f`, PR API의 당시 test-merge 후보 `2e005ede2aea25d293d0dcf3d2f39a37653eee79` (Run artifact와 독립 교차 인증하지 않음). 같은 HEAD의 FAST_DEVELOPMENT Run `40184046281.1`은 SKIPPED이며 실제 실패로 계수하지 않는다.
- **직접 FAIL:** [Chromium E2E shard 2/8 job 121141514697](https://github.com/planner77/masterGantt/actions/runs/40184046283/job/121141514697), 2026-10-25 10:20:33 UTC. `tests/e2e/issue-622-resource-plan-target.spec.ts:115`의 `expect(edit).toBeFocused()`가 예상 focused / 실제 inactive, 5000ms 실패. 다른 92case는 fail-fast로 NOT RUN. 같은 로그의 `GitCommitInfo git fetch` 3000ms timeout은 별도 환경 경고로, 이 assertion 실패의 원인으로 확인된 것이 아니다. [원본 trace와 error-context](https://github.com/planner77/masterGantt/actions/runs/40184046283) 업로드 세부/보존 여부는 이번 연결에서 미확인.
- **취소된 7 shard (PASS 아님):** 1/8 job `121141514720`, 3/8 `121141514696`, 4/8 `121141514654`, 5/8 `121141514751`, 6/8 `121141514655`, 7/8 `121141514682`, 8/8 `121141514670` 모두 CANCELLED. 이들 완료 전 부분 assertion을 전체 PASS/FAIL로 환산하지 않는다.
- **성공:** preflight `121141012655`, 정책 `121141073581`, Vitest `121141073521`, TypeScript `121141073545`, ESLint `121141073562`, PR build `121141514602`, Docker smoke `121141514583`, Quality Required `121141807928`, Docker Required `121141975364`. **파생 FAIL:** E2E Required `121142001773`, QA Final `121142019144` (`required e2e 미성공`). Trusted/independent QA·Owner ACCEPT는 NOT TESTED.
- **Root cause / PRODUCT / 관측과 P1 교차:** `finishTaskEditor`에서 `project-panel-resources` 전체의 `[data-ready="false"]`를 검사했다. #807 단일 workspace에서 동적 peer와 과거 visit가 `hidden/inert` 상태로 keep-mounted라 조회를 수행하지 않아 false가 남는다. 보이는 기본/Plan 보고서와 상세가 READY여도 `resourceEditorFocusDecision`이 WAIT 상태에 묶여 6초 cleanup이 발생한다. [P1 review 4370479625](https://github.com/planner77/masterGantt/pull/810#discussion_r4370479625)가 같은 결함을 지적했다. 검사 대상과 활성 peer/visit의 차이가 확인됐고 단순 flaky/test timing으로 분류하지 않는다.
- **보완 범위:** `resource-editor-focus-return.ts`에 숨김/비활성 노드를 제외한 active receipt 판정 추가, `project-readonly-view.tsx` 포커스 handoff에서 해당 판정 사용. 활성 보고서/상세의 미확정·stale·closing/foreign modal은 기존 WAIT/CANCEL을 유지한다. 기존 `tests/features/projects/resource-editor-focus-return.test.ts`에 active vs hidden/이전 visit/상세/negative 사례를 EXTEND하고, 실제 실패 소비자 `tests/e2e/issue-622-resource-plan-target.spec.ts`에서 숨은 동적 peer 존재와 원 포커스 복귀를 확인한다. 테스트 timeout/retry/assertion/skip 및 E2E 8shard·Required 게이트는 변경하지 않는다.
- **Cross-run 합집합:** 과거 F807-L04/L07 `issue-736-resource-dashboard.spec.ts`, F807-L05 `project-resource-workload-status.spec.ts`, F807-L06 `resource-milestone-ui.spec.ts`·`resource-plan-ui.spec.ts` + 본 R01 `issue-622-resource-plan-target.spec.ts`. 직접 현재 회귀는 #622, 인접 #736/#751 editor return, 음성은 hidden dynamic/old visit와 활성 stale/foreign modal, WBS canonical assignment, 권한·stale/Excel/Plan 경계다. 이전 local 환경 장애를 원격 제품 FAIL로 재분류하지 않는다.
- **검증/인계:** 구 HEAD의 과거 선택 Chromium6·Unit22 및 원격 Quality/Docker 성공은 보존하되 **교정된 새 HEAD의 local Node/Vitest/Chromium/빌드 및 전체 8shard는 NOT TESTED**, 원격 Full CI가 최초 증명 대상. GitHub connector에서 source/기존 독립 테스트·Run 로그를 정적 대조했다. 단일 Issue 원장 append-only, Work Packet 및 PR 리뷰·충돌 정리 후 동일 PR의 새 HEAD를 push해 Full CI를 시작하고 모니터링하지 않는다. 병합/정식 게시/Issue 종료 금지.


## F807-R02 — PR #810 두 번째 Full CI #3293.1, #719 구 진입 가정 (2026-10-25)

- **원격 귀속:** [PR #810](https://github.com/planner77/masterGantt/pull/810), [Run `40185606165` attempt `1` · #3293.1](https://github.com/planner77/masterGantt/actions/runs/40185606165), `pull_request` / FINAL_FULL, HEAD `470d202f2475ef3b58581b9bd4ff5a9d63b7defe`, base `c69c22e248de6d2af9cc753eb0296ff97d4a2b8f`; PR API merge candidate `0b0775eb40c09cc1d15ceb83554fe4959aae4a52` (동일 Run artifact의 test-merge SHA는 미교차검증). 동 HEAD Fast advisory Run `40185606126.1` SKIPPED. 시간 2026-10-25 10:44:05 UTC.
- **직접 FAIL:** [Chromium shard 5/8 job `121146212881`](https://github.com/planner77/masterGantt/actions/runs/40185606165/job/121146212881) / `tests/e2e/issue-719-contextual-help.spec.ts:57` (`#719 resource 동일 fixture 5폭 설명 높이·작업면·overflow 및 도움말`). 예상 `data-wbs-state="error"`, 실제 `pending` (5000ms); shard는 9 PASS / 1 FAIL / 94 NOT RUN, 추가 non-test `GitCommitInfo git fetch ...` timeout 경고1건은 실제 assertion 원인으로 입증되지 않음. [원본 Run의 trace/error-context](https://github.com/planner77/masterGantt/actions/runs/40185606165) 링크는 보존하지만 artifact 다운로드·유효성은 이번 도구에서 미검증.
- **다른 E2E shard** 1/8 `121146213012`, 2/8 `121146212918`, 3/8 `121146212837`, 4/8 `121146212792`, 6/8 `121146212838`, 7/8 `121146212889`, 8/8 `121146212896` 모두 CANCELLED. shard2 로그에서 **이전 F807-R01 #622 개별 test PASS**를 확인했으나 shard2 전체 성공 또는 8/8 PASS로 승격하지 않는다. 취소된 shard의 일부 완료 case와 실제 미실행 case는 별도 상태로 보존한다.
- **성공/파생:** TypeScript `121145749931`, ESLint `121145749949`, Vitest `121145750007`, Policy `121145751610`, QA Preflight `121145695746`, PR build `121146212687`, Docker smoke `121146212689`, Required Quality `121146501431`, Required Docker `121146586314` SUCCESS. Required E2E `121146822076` FAIL 및 QA Final `121146838663` FAIL은 shard5의 **파생** (`required e2e 미성공`); Trusted 독립 QA/Owner exact HEAD 승인 NOT TESTED.
- **확정 원인 / TEST_CONTRACT (제품 회귀로 미확정):** #807의 승인된 R1 기본 화면은 `기본 현황`, 동적 WBS는 `hidden/inert`·inactive이고 첫 방문에 요청되지 않는다. 기존 #719 `openSurface(resource)`는 공존·기본 활성인 구 WBS를 가정하여 404 응답을 기다렸지만, 실제 새 peer는 **요청하지 않아 계속 pending**인 것이 옳다. 그래서 옛 테스트가 무조건 error를 기대하면 false FAIL; 리소스 기본 동작을 이전처럼 숨은 조회/상시 적층으로 되돌려서는 안 된다. #719의 Milestone WBS와 Resource 동적 peer의 실제 404/error 복구 커버리지는 유지해야 한다.
- **누적 이력 관계:** R01 PRODUCT focus-handback `#622`는 이번 shard2에서 해당 개별 case 성공으로 교정 방향을 지지하지만 후속 Full 8/8 성공으로 간주 불가. R02는 **새로운 #719 소비자의 오래된 readiness 전제**이며 R01 재발이 아니다. 과거 F807-L04/L05/L06/L07 환경·UI 이력은 계속 보존. 실패 E2E 합집합: `issue-736-resource-dashboard.spec.ts` / `project-resource-workload-status.spec.ts` / `resource-milestone-ui.spec.ts` / `resource-plan-ui.spec.ts` / `issue-622-resource-plan-target.spec.ts` / **`issue-719-contextual-help.spec.ts`**.
- **보완 / AC_TEST_COVERAGE & TEST_LIFECYCLE_REVIEW:** 기존 `issue-719-contextual-help.spec.ts` 하나를 EXTEND. 기본 Resource의 가시 `기본 현황`과 숨은 WBS `pending/data-ready=false` 및 **WBS POST0**를 단언해 요청·지오메트리 무부작용 보호. 지연 404 회귀는 Resource peer를 **사용자가 명시적으로 활성화**한 다음 실제 WBS read POST를 관측하고 `pending→error`를 검증, `기본 현황`으로 복귀한 뒤 기존 tooltip/5폭/스크롤·비쓰기 assertion 유지. Milestone 쪽 원래 pending→error·도움말 검증도 유지. test 이름을 실제 동작으로 정정. 새 중복 spec, skip/retry/timeout/Required/8shard, 제품/API/Gantt/DB 변경 없음.
- **동결/검증:** GitHub 실패 로그·이전 #622 PASS log·프로덕션 view 계약을 source로 대조했다. 이 연결의 로컬 Playwright/npm 의존성·실제 브라우저 및 새 HEAD의 실행 결과는 **NOT TESTED**. 실제 Run 종료와 실패 출처는 위 R01/R02 두 개를 보존. 기존 P1 review thread `PRRT_kwDOUUB7Bc6wAZW-` resolved, 재검토 시 신규 thread/충돌을 확인한다. 이번 범위는 새로운 exact HEAD의 Full PR CI 시작까지(결과 감시/병합/Main/GHCR/tag/Issue 종료 제외).

## F807-R03 — 세 번째 Full #3294.1 및 누락 소비자 전체 진단 (2026-10-25)

### 원본 귀속·직접/파생·미실행

- [Full #3294.1](https://github.com/planner77/masterGantt/actions/runs/40186806490), Run ID `40186806490`, attempt `1`, `pull_request`, `.github/workflows/ci.yml`, `FINAL_FULL`. HEAD `abe66b0e82f399be7484664c35a8adfce34c47a1`, base/main `c69c22e248de6d2af9cc753eb0296ff97d4a2b8f`, test merge `42465b2fccabcf4956982369079c908a0fa7c518`의 두 부모는 해당 base/head다. 원격 실행은 2026-10-25 10:56:26~11:11:06 UTC.
- 직접 FAIL은 [shard6 job `121149785099`](https://github.com/planner77/masterGantt/actions/runs/40186806490/job/121149785099), `tests/e2e/issue-737-target0-acceptance.spec.ts:22`의 `openRoot(resource)`다(첫 통합 case의 호출 line92). `getByTestId('wbs-view-dashboard').filter({visible:true})`에 `data-root=resource`를 기대했으나 가시 요소가 없어 실패했다. 뒤의 `page.waitForResponse: Test ended`는 이미 끝난 테스트의 응답 waiter 정리 오류이며 독립 제품 오류로 계수하지 않는다.
- 실패 shard는 **38 PASS / 1 FAIL / 59 NOT RUN**, 나머지7개 shard CANCELLED다. 세 Full 전체의 취소 **21개 shard 로그를 모두 조회**해 추가 실제 assertion FAIL이 없음을 확인했다. 부분 PASS는 취소 shard 전체 또는 Full8/8 PASS가 아니다. Job별 ID/결론은 위 정제 JSON에 보존한다.
- Required Quality job `121150103378` 및 Docker job `121150248523` SUCCESS; 실제 static/unit/build/Docker도 SUCCESS. Required E2E `121152092441` 및 Automated QA `121152109573` FAIL은 직접 shard 실패의 파생이다. [Trusted #941.1 / Run `40187801757`](https://github.com/planner77/masterGantt/actions/runs/40187801757), job `121152190248`도 원본 CI 미성공으로 FAIL이다. 새로운 Head의 어느 Gate도 이 이전 성공으로 대체하지 않는다.
- `playwright-report-shard-6` Artifact `12597086129`는 조회 시 미만료·5,736,370bytes였다. 메타데이터와 원본 Job 로그는 확인했으나 전체 report ZIP 내부 trace는 다운로드/분석하지 않았다. 출처 artifact `ci-pr-source-40186806490-1` ID `12596169125`는 다운로드 후 **JSON만 데이터로 읽었다**. 실행하거나 artifact 코드를 checkout하지 않았다.

### 전 이력 교차 확인

| 원본 Full/attempt | 직접 실패·분류 | 해당 원본의 결과 | 후속 개별 증거와 한계 |
| --- | --- | --- | --- |
| [#3292.1 / 40184046283](https://github.com/planner77/masterGantt/actions/runs/40184046283) | #622 line115 focus `focused` 기대/`inactive` 실제, PRODUCT | 실패 shard1 FAIL/92 NOT RUN, 나머지7 CANCELLED; Quality/Docker SUCCESS | 470d202f 활성 receipt 교정 뒤 #3293/#3294에서 해당 개별 case PASS. Full/shard 전체 PASS는 아님 |
| [#3293.1 / 40185606165](https://github.com/planner77/masterGantt/actions/runs/40185606165) | #719 line57 `error` 기대/숨은 WBS `pending` 실제, TEST_CONTRACT | 실패 shard9 PASS/1 FAIL/94 NOT RUN, 나머지7 CANCELLED; Quality/Docker SUCCESS | abe66b0e 명시 동적 진입 뒤 #3294에서 #719 개별 case들 PASS. 추가 gate 대기 경합은 별도 아래 기록 |
| [#3294.1 / 40186806490](https://github.com/planner77/masterGantt/actions/runs/40186806490) | #737 line22 공통 root loop의 Resource 동적 기본 활성 가정, TEST_CONTRACT | 실패 shard38 PASS/1 FAIL/59 NOT RUN, 나머지7 CANCELLED; Quality/Docker SUCCESS | 새 원본 RED 재현 후 공통 진입·소비자 전체 보완. 새 source 로컬/원격 결과는 분리 |

세 run/attempt와 원본 source artifact `12594644476` / `12595917257` / `12596169125`의 repository·PR810·Head/base/test merge를 현재 GitHub API와 교차 검증했다. 각 test merge의 정확한 두 부모와 commit→PR **단일810 귀속**을 확인했다. R01/R02에 남아 있는 당시 artifact 미확인 표현은 이력이며 이번 확인으로 덮어쓰지 않는다. 본 재조회는 출처 인증을 추가한 것이지 과거 FAIL을 PASS로 바꾼 것이 아니다.

Trusted #939.1/Run `40184425357` job `121142084029`, #940.1/Run `40186037188` job `121146905153`도 각각 원본 Full 미성공에 따른 FAIL을 확인했다. 초기 문서의 Trusted NOT TESTED는 당시 미확인 상태로 유지하고 이번 결과를 증분 기록한다. 동일 Head의 FAST_DEVELOPMENT #115/#116/#117 SKIPPED는 원격 직접 실패 횟수나 Full 성공으로 합산하지 않는다.

원격 실제 실패 파일 합집합은 **#622/#719/#737 3파일**이다. 과거 로컬 실패 #736/workload-status/milestone-ui/plan-ui4개를 포함한 전체 합집합은 **7파일**이며 fixture 초기화·UI 관측·제품·테스트 계약을 서로 재분류하지 않는다.

### 원인·반례·계획 변경

1. 원본 abe66b0e에서 #737 첫 case를 실제 Chromium으로 **1/1 FAIL(25.2초)** 재현했다. `.prepr-reports/issue807-r03-red/report.json`과 고유 trace/error-context에 line22/92·가시 요소 없음·응답 waiter 파생 오류가 원격과 일치한다. 제품 소스 변경 없이 기존 실패 검사 자체가 RED 신호다.
2. #719 다음 #737에서 같은 기본 활성 가정이 순차 노출되어 Manager가 개별 테스트 한 곳 수정 계획을 중단하고 전체 WBS 소비자/helper·공통 root loop·도움말 fixture를 검색하도록 확대했다. 초기 R1 사전검토는 변경한12개 spec 중심이어서 #719 특수 fixture와 #737 일반 root loop를 놓쳤다. 당시 local PASS/QA 기록은 보존하되 전체 소비자 검증 완료로 확대하지 않는다.
3. 상시 WBS Resource root 소비자는 #719/#730/#736/#737 네 파일이다. #730/#736은 이미 명시 동적 진입을 사용하지만 같은 계약을 공통 helper로 결속한다. #737은 누락을 교정한다. #624는 process/equipment/system만, #762는 process 하위 Resource 축, #732~#735는 자신의 root다. #734의 리소스 탭 왕복은 설비 복귀만 검증한다. legacy 기본 분석 소비자를 일괄 동적 진입으로 바꾸면 승인된 기본 동작을 되돌리는 회귀이므로 유지한다.
4. #719의 R02 지연 case에는 별도 **TEST_CONTRACT 대기 경합**이 있었다. helper가 dynamic을 활성화한 뒤 외부 case가 hidden legacy `data-ready=true`를 기다리면 gate 해제 전 준비를 기다릴 수 있다. #3294에서 개별 PASS였어도 경합이 없다는 증명은 아니다. 준비 단계 handshake를 dynamic 전환 전에 전달해 대기 순서를 명시하고 실제 POST·pending·404 error·기본 현황 복귀·tooltip/scroll·비쓰기 단언을 유지한다.
5. 공유 동적 진입은 inactive→dynamic에서만 실제 Resource report POST를 관측하고 ready를 확인한다. 이미 활성·확정인 동적 보기 재진입은 새 POST/refresh를 강제하지 않는 멱등 동작을 유지한다. 각 호출자의 exact spec/filter/snapshot/원본 ID 단언을 삭제하거나 넓히지 않는다. 제품·서버·도메인·Gantt·버전·CI 정책 변경은 필요 없으며 assertion/timeout/retry/skip·8shard/Required3를 완화하지 않는다.

### 동일 source 검증·독립 검토·게시

기존 세 원격 실패 case와 전체 로컬 실패 합집합·인접/음성 소비자를 한 동결 source의 bounded 선택으로 재검증한다. 자동 도구의 UNKNOWN과 직접 실행을 구별하고 raw command/report fingerprint·실행 결과·미실행을 Work Packet과 정제 영수증에 기록한다. 아직 새 원격 Required3/Trusted/Owner·Manager ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED다. 기존 PR/branch를 재사용하며 최종 리뷰/충돌 재확인·원장 갱신 후 새 synchronize Full CI 등록까지만 수행한다.

R03 보조 편집 도구의 최초 Python 들여쓰기 오류와 오래된 문서 phase anchor의 patch 검증 실패는 파일 쓰기 전에 중단했다. 올바른 현재 anchor/스크립트로 적용 후 typecheck·대상 ESLint를 수행했다. 이 준비 오류를 제품/테스트 실행 FAIL 또는 추가 원격 실패로 계수하지 않는다.

후보A 동결 합집합 진단은 **10개 spec / 28개 case 전부 PASS**, retry0/skip0/flaky0/FAIL0, 총524.369초다. 원격 실패3파일과 전체 과거 실패7파일이 모두 실제 선택에 포함됐다. 원본 #737 RED는 개별 case 약25.2초·전체 Run46.302초이며 최종 결과에 성공으로 합산하지 않는다. raw `.prepr-reports/issue807-r03-red/report.json` SHA256 `d5861ceb72b44586fb8314279d976d247d9549fddb950cb3d5cef7b7d48c9e5c`, 후보A `.prepr-reports/issue807-r03-union/report.json` SHA256 `a42ab6d1baf036120885ea28dfff7c8d5b4e5ad150fd942ab5098e9990224af4`를 보존한다.

테스트 diff SHA256은 시작/종료 모두 `90ef399a68718a37404e387241dea0ac47cef7353223d6b8ec86be2cfcee05d7`, abe66b0e 대비 제품 source 변경0이다. R01 focus-return Unit은 고유4/4 PASS, raw `.prepr-reports/issue807-r03-focus-unit.json` SHA256 `b340a626f2fef488fc8d5e89344feb67c6954f1d165cb197e4006429c4543839`다. 구현 Agent와 Manager의 동일 Unit 중복 실행을8개 고유 test로 합산하지 않는다. 실제 #622/Plan focus·foreign/stale/취소·#719 준비/오류·#737 원시 ID/KPI/Excel·#736 readonly/응답 역전·#530 LIFO/원본·Core 보존과 공통5폭이 통과했다. local PASS는 새 원격 Full 결과가 아니다.

마지막 사전검토에서 후보A의 #730/#737 resource 분기 early return이 원래의 **모든 가시 WBS에 대한 strict locator 단언**을 건너뛰는 경계를 발견했다. helper의 Resource 한정 root 검사는 정상 흐름에서 같지만 원래의 중복 가시 root 검출 범위를 그대로 보존하기 위해 두 caller의 navigation만 else로 분리하고 기존 공통 visible/ready/root 단언을 모든 root에 적용한다. 제품·공유 helper·다른 소비자는 변경하지 않는다. 후보A28PASS는 보존하고 최종 후보B의 직접 영향 #7302case/#7371case를 재실행한다. 나머지25case는 같은 helper/driver·제품 bytes의 영향 없는 Local Fast Feedback로 재사용하며31개 고유 PASS로 합산하지 않는다. 원격 전체 required gate는 언제나 새 Head에서 새로 검증한다.

최종 후보B의 직접3case **3/3 PASS**, retry0/skip0/flaky0,143.619초. raw `.prepr-reports/issue807-r03-final-strict/report.json` SHA256 `f85e11c0d7d04fb80c0d431fc55177034467793a7a82fe69a64d7a59ef1c2a4a`다. 최종 source의 helper/#719/#736 bytes가 후보A와 같고 두 caller만 다름을 별도 Reviewer가 독립 대조했다. [정제 로컬 영수증](../output/playwright/issue-807/rework-r03-local.json)에 전체10spec/28case 선택·원본 RED·A/B 실행·미영향25case 재사용·명령·최종 파일별 hash를 연결한다.

R03 최종 typecheck·대상 ESLint·version/discovery/Markdown·diff PASS와 기존 생성물/과거 캡처 복원을 확인했다. [자동 Pre-PR fast](evidence/issue-807/rework-r03-prepr.json)는 UNKNOWN1(shared resource-workspace helper) 때문에 BLOCKED(exit1/sourceStable=true/selected4/missing0/step0)이며 자동 매핑 정책을 바꾸지 않았다. Work Packet과 실제7파일 합집합·4개 동적 소비자/음성 검증을 수동 매핑했고 CLI fast/build PASS와 개별 검증을 구별한다.

독립 `/root/resource_qa`의 **R03 LOCAL_PRE_QA PASS / DOCUMENTATION_SYNC PASS**, 새 P1/P2 없음. 이번 판정은 새 원격 Required3/Trusted·Owner/Manager ACCEPT가 아니다. 게시 직전 실제 최신 Head/base·미해결 리뷰/충돌을 재조회하고 검토한 tree의 descendant commit 하나를 같은 branch/PR에 게시한다. 새 CI 등록 증거는 Issue STATUS로 인계하고 원격 실행 결과는 NOT TESTED로 둔다.
