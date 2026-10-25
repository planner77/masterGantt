# Issue #807 — 누적 실패·리뷰·충돌 원장

Primary Issue: [#807](https://github.com/planner77/masterGantt/issues/807). Source of truth: [PR CI 실패 분석 정책](PR_CI_FAILURE_TRIAGE.md), [Work Packet](exec-plans/active/ISSUE_807.md). 갱신일 2026-10-25. 원본 FAIL/BLOCKED/NOT TESTED를 후속 성공으로 지우지 않는다.

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
