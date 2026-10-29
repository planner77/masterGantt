# Issue #852 — Gantt 탐색 회귀·누적 실패 원장

Primary Issue: https://github.com/planner77/masterGantt/issues/852
기준 main: `de36ff9f3192f47f79a67f8fccc617df9bd024dd`, application `0.138.1`, SVAR Core `2.7.3`.
branch: `fix/issue-852-gantt-navigation`; 후보 application `0.138.2`.
Source of truth: [PR CI 실패 지침](PR_CI_FAILURE_TRIAGE.md), [Work Packet](exec-plans/active/ISSUE_852.md).

사용자 요청에 따라 첫 PR CI 이전부터 로컬 재현·환경 실패를 기록한다. 로컬 실패를 GitHub PR Run 실패로 계산하지 않는다. #367/#514/#571/#666/#667 및 타 Issue CI 실패는 이 Issue의 독립 실패 횟수에 합산하지 않는다.

## 1. 원격 Run/Attempt 전체 목록

착수 시 #852는 OPEN, 댓글0·연결 PR 없음이며 열린 PR 목록에도 #852 구현 PR이 없었다. 이 Issue의 PR CI는 아직 시작하지 않았으므로 Run/Attempt/Head/Base/Test merge 및 Required3는 NOT TESTED다. 조회하지 않은 로그를 성공으로 해석하지 않는다. CI 시작 후 생성된 실제 Run URL을 Issue 인계 댓글에 기록하며 이 요청에서는 결과를 모니터링하지 않는다.

## 2. 누적 실패 파일 및 Cross-run 매트릭스

| 실패 ID | 환경·파일·case | 원본 실제 결과 | 분류·원인 판단 | 보완·최종 source 검증 |
| --- | --- | --- | --- | --- |
| F852-ENV-001 | `gh issue view 852` 및 git push dry-run | HTTP401 Bad credentials / Invalid username or token | ENVIRONMENT; 로컬 GitHub 자격증명 실패 | 연결된 GitHub 도구로 읽기/게시; 토큰 복사·권한 확대 없음 |
| F852-LOCAL-001 | `grid-task-start-reveal.spec.ts` 신규 visible-right alignment Day·Week | 시작점 Chart 상대 X452px 유지, expected≤1px; 두 case FAIL | PRODUCT; 기존 가시성-only 정책은 화면 내부 오른쪽의 좌측 배치를 검증하지 못함 | 최종 Day/Week 실제bar452→0px 및23case PASS |
| F852-LOCAL-002 | 같은 E2E의 새 확장 끝까지 연속 wheel 후 무입력 대기 Week | 실제 width4148px에서 정지, expected>4148px; 기존5초 poll FAIL | PRODUCT; 확장 중 새 edge 입력 후 재예약 누락 가설을 제한 trace로 재검증 | 최종23case와3case×3반복9 PASS; 원래FAIL·동일sourcePASS 보존 |
| F852-LOCAL-003 | 같은 E2E의 nested 마지막 Task 정렬 | 시작점 x21960px, 실제 capacity21163px; NO_SCROLL_CAPACITY | PRODUCT; 가시성-only보다 더 큰 좌측 정렬 capacity 필요 | 같은 TASK_REVEAL lease의 기존 extent transaction 준비로 보완;8행렬 포함 최종23case PASS |
| F852-LOCAL-004 | Week nested reveal 준비의 retained end | 실제 폭6664→7004에도 준비 TIMED_OUT,5초 poll FAIL | PRODUCT; 승인·정착 전 요청 end를 retained end에 선반영하여 실제 범위와 혼동 | 선반영을 제거하고 실제 Core recordEnd만 보존; 좁은4case PASS16.2초는 이후 최종 동결과 별도 |
| F852-TEST-001 | sparse fixture 초기 구성 | 공유 fixture의 tasks[2] 참조 준비 실패 | FIXTURE_OBSERVABILITY; 희소 일정도 공유 fixture 최소3개 행 필요 | 미래 Task 없는 과거3개 Task로 구성; 제품 실패와 구별 |
| F852-TEST-002 | 비동기 reveal 이후 고정8RAF 관측·Week visibleRight 준비 | 중간23case 실행22PASS/1FAIL88초; wheel 전 최초 reveal 미완료로 visibleRight 전제 불성립 | TEST_CONTRACT; 동기 Core show 대신 실제 Coordinator 완료 관측 필요 | 기존5초 poll 안에서 실제 TASK_REVEAL SETTLED를 기다리고 최종 좌표·보존 단언 유지; 제품 수정 없음 |

누적 실제 실패 파일 합집합: `tests/e2e/grid-task-start-reveal.spec.ts`. 환경 인증 실패는 제품 테스트 실패와 구별한다. 기존 #514 readonly/day/normal은 18.9초 PASS했으나 새 좌측 배치 AC의 PASS 근거는 아니다. 초기 long-future fixture의 native wheel Day/Week 반복3회는 PASS였으며 우측 확장 사용자 보고의 원인 확인 또는 복구 성공으로 확대하지 않는다.

## 3. 개별 실패 사건

### F852-ENV-001 — 로컬 GitHub 인증

- `gh issue view 852 --json number,title,body,url,comments`가 `HTTP 401: Bad credentials`로 종료했다. `git push --dry-run origin HEAD:refs/heads/fix/issue-852-gantt-navigation`도 인증에 실패했다. 원격 main의 공개 fetch는 성공했다.
- GitHub 연결 도구의 Issue/PR 읽기 및 Issue PLAN/STATUS 쓰기는 성공했다. 원본/교정 커밋은 연결 도구로 게시하고 로컬 tree와 비교한다. 자격증명 원문·설정·PAT를 출력하거나 Git에 저장하지 않는다.

### F852-LOCAL-001 — 화면 내부 오른쪽 시작점 미정렬

- 설치 Core2.7.3 실제 Chromium의 Day/Week에서 Grid 일반 클릭 후 시작점이 Chart edge에서452px에 남아 새 expected≤1px 단언이 실패했다. 기존 기본 #514 case PASS와 별개다.
- 순위 가설: 일반 Grid click이 Core 가시성 reveal만 사용하거나 app 선택 branch에서 reveal을 생략; 요청 axis와 실제 geometry 차이; async lease/dataReady 취소. 각각 이벤트·실제 Core/native 좌표·coordinator outcome으로 구별한다.
- 소스 변경 전 기존 테스트 seam을 확장했으며 expectation을 실제 요청 동작인 좌측 배치로 강화한다. Context Menu `show:false`, modifier/keyboard/null start·peer 보호는 삭제하지 않는다.
- 중간 구현에서 native 선택 억제 표식을 microtask에 지우면 Core EventBus의 비동기 native 선택이 뒤늦게 처리되어452px 실패가 반복되었다. 같은 클릭의 native 선택이 실제 소비될 때 표식을 지우고 새 pointer/wheel/keydown·외부 explicit reveal에서는 취소하도록 보완한다. 이 중간 실패를 최종 PASS로 덮어쓰지 않는다.

### F852-LOCAL-002 — 확장 중 새 edge 입력의 재예약 누락

- sparse fixture의 기본3회 및 확장 중단 뒤 별도 wheel3회는 Day/Week 모두 PASS였다. 이는 사용자가 새로 확장된 끝에 이미 도착했는데 다음 입력이 없는 정지 상태를 검증하지 않았다.
- actual resize를 수행한 후 observation RAF를 테스트에서 제한적으로 보류하고, 실제 native wheel로 새 물리 edge까지 이동한 뒤 모든 보류 callback을 해제했다. 추가 wheel 없이 미래 폭 증가를 기다리는 Week 강화 검사에서4148px로 정지하여 기존5초 poll이 FAIL했다. Day의 같은 통제 검사는 PASS였다.
- 통제 RAF gate는 테스트 전용이고 실제 Core/DOM·native wheel 경로를 사용한다. 제품 timeout/retry를 늘리거나 강제 성공 영수증으로 바꾸지 않는다. 정확한 재현 반복·원인·보완·최종 source 결과는 추가 기록한다.
- 동일 source의 직후 재실행은 PASS였다. 한 번의 FAIL과 비재현 PASS를 모두 보존하며 결정론적 재현이라고 표시하지 않는다. 최종 교정 검증은 같은 race 경계와 기본 반복 확장 및 stale 입력 음성을 포함한다.

### F852-LOCAL-003 — 마지막 Task의 시작점 정렬 capacity

- 새 좌측 정렬은 기존 단순 가시성보다 큰 수평 capacity가 필요하다. nested 마지막 Task의 `$x=21960`에 대해 capacity21163으로 `NO_SCROLL_CAPACITY`가 확인됐다.
- 기존 `TASK_REVEAL` 준비 단계에서 같은 explicit lease로 기존 Axis Transaction을 수행한 다음 projection/geometry를 재관측한다. 별도 RANGE 요청이나 DOM scroll writer를 만들지 않으며 null start와 오래된 gesture는 별도 음성 검증한다.

### F852-LOCAL-004 — 요청 end의 낙관적 선반영

- `expandTimelineScale`이 Coordinator 승인·정착 전에 계산한 요청 end를 `timelineEndReference`에 저장했다. 취소되거나 실제 end와 다른 요청을 확보된 범위처럼 취급하면서 Week nested reveal 준비가 실제 폭6664→7004 증가 후에도 TIMED_OUT했다.
- 요청 end 선반영을 제거하고 기존 `recordTimelineEnd`가 읽은 실제 Core end만 단조 보존한다. 요청 width와 완료 증거를 구분하며 timeout/receipt/capacity 검증을 완화하지 않는다.
- 교정 뒤 같은 Week nested와 peer/filter pending3case의 좁은4case가16.2초 PASS했다. 비동기 Coordinator의 실제 완료를 기다린 뒤 위치 보존을 검사하며 예전 Core 동기 show를 가정한 고정8RAF만으로 완료를 추정하지 않는다. 최종 source 동결 후 다시 확인한다.

### F852-TEST-001/002 — fixture·완료 관측 보완

- sparse 최초 fixture의 공유 `tasks[2]` 접근 실패는 과거 Task3개로 교정했다. 제품 Task 날짜를 미래로 늘려 회귀를 가리지 않았다.
- 기존8개 행렬/peer 중간 관측과 신규 Week visibleRight 준비는 고정8RAF를 실제 완료로 가정했다. Coordinator의 비동기 선택·capacity 준비 이후 해당 시나리오의 실제 완료/시작 가시성을 기다린 다음 원래 strict 좌표·입력 우선·mutation0 단언을 수행한다.
- 최종 준비 중23case 중22PASS/1FAIL88초의 실패는 Week visibleRight를 만들기 전 첫 reveal 완료를 기다리지 않은 전제 오류였다. 제품 소스는 유지하고 기존5초 poll로 첫 TASK_REVEAL SETTLED를 확인한다. timeout/retries/skip/최종 좌측 정렬 허용치를 확대하지 않는다.
- Manager의 원격 게시 tree 사전 대조는 최초 로컬 Git blob 객체 미등록으로 `invalid object`를 반환했다. 제품/test 실패와 구별하며 해당 로컬 파일을 `git hash-object -w`로 등록한 뒤 임시 index tree와 원격 API tree가 정확히 `e33434efc7f9bf8493757f3658f7d1a945c332e9`로 일치함을 확인했다. 원격 branch/PR은 이 사전 대조 실패로 변경하지 않았다.

## 4. 전 이력 종합 진단·검증 범위

- 직접: 일반 Grid 선택→TASK_REVEAL→port/target, scroll/resize→RANGE_EXTENSION→Axis Transaction의 실제 Core/native 정착.
- 인접: Day/Week 전환·동일 인스턴스·readonly/editable·root/nested·scope/filter/fullscreen·peer 왕복.
- 음성: Context Menu `show:false`, modifier/checkbox/keyboard·Editor locate·null canonical start·최신 사용자 gesture 우선·서버 mutation0.
- 실제 로컬 단위/Chromium 명령·case 수·시간·source fingerprint는 최종 동결 후 추가한다. 전체 Vitest/E2E/Docker를 반복하지 않으며 원격 Full Quality/E2E8/Docker와 Trusted QA는 별도 NOT TESTED다.

## 5. 같은 최종 source 검증·리뷰·PR CI 인계

최종 로컬 결과: 관련4 Unit파일194/194 PASS, Grid spec23/23 PASS 약1.3분, 연속 wheel·새 선택3case×repeat3=9/9 PASS31.0초, typecheck PASS, 관련 ESLint 오류0/기존Hook 경고3개, diff check PASS. 그 이전22case 실행은15PASS/7FAIL로 Week nested4개와 비동기 완료 관측을 놓친 peer3개였다. 첫23case의22PASS/1FAIL88초와 모두 구별한다. 원래 실패는 소급 PASS하지 않는다.

실제 명령:

```bash
npm test -- tests/features/gantt/svar-viewport-port.test.ts tests/features/gantt/timeline-range.test.ts tests/features/gantt/viewport-coordinator.test.ts tests/features/gantt/axis-transaction.test.ts
CAPTURE_ISSUE_514=issue852-final npm run test:e2e -- tests/e2e/grid-task-start-reveal.spec.ts
CAPTURE_ISSUE_514=issue852-repeat npm run test:e2e -- --grep '#852.*continuous' --repeat-each=3
npx eslint src/features/gantt/project-gantt.tsx src/features/gantt/viewport/svar-viewport-port.ts src/features/gantt/viewport/task-reveal-target.ts src/features/gantt/viewport/viewport-coordinator.ts tests/features/gantt/svar-viewport-port.test.ts tests/e2e/grid-task-start-reveal.spec.ts
npm run typecheck
node scripts/check-markdown-links.mjs
```

[정제 manifest](evidence/issue-852/manifest.json)에 제품4개·테스트2개의 동결SHA256 및 원본/최종 관측을 저장했다. 최종specSHA256은 `f0810b25f833ddc002b8be49a1ff3bc1b5fa56bb5789ece7bcdb9f3fe499670a`다. Day Core/native20248→20700·Week5192→5644, actualbar452→0px/같은instance를 확인했다. 스크린샷은 같은 후보의 클릭 전/후이며 원본 제품RED screenshot이 아니다. `burst-day.json`은 마지막 override=true 음성case가 덮어쓴 결과라 일반Day양성 근거로 쓰지 않는다. 일반 양성은 `wheel-day/week`을 사용하고 새 선택은 `wheel-superseded`로 구분한다. repeat폴더는 마지막 반복만 남으며9회 실행 수는 CLI 결과다. raw trace·HTML report·runtime DB는 Git에 넣지 않는다.

별도 `/root/review`의 사전 검토 PASS/미해결 차단지적0, 독립 관련Unit194PASS 및6개source지문 대조 완료. QA_FINAL/인간 GitHub APPROVED/Owner ACCEPT는 아니다. Next가 만든 AGENTS/next-env 변경은 복원하여 최종diff0이고 제품/test지문은 유지했다. Markdown376파일 링크 및 docs_gate의 DOC_SYNC/AC1~10 구조PASS는 의미/원격 검증PASS를 대체하지 않는다.

최신main은 기준 `de36ff9f3192f47f79a67f8fccc617df9bd024dd`와 같고 사전 충돌0이다. 원격 PR 생성 후 review thread·mergeability·testmerge와 CI 시작을 확인해 Issue에 인계한다. 새 Head Required3/Trusted QA·Owner HIGH위험 수용/Manager ACCEPT는 NOT TESTED다. 실제운영/HTTP SQLite·Shift-wheel/scrollbar drag/touch 동일경합도 NOT TESTED이며 병합·main/GHCR·Release·Issue 종료는 범위 밖이다.
