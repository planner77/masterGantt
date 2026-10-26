## 2026-10-27 후속 추적 — F816-006 / Issue #818

이 문서의 F816-006 원본 PRODUCT/AC4 FAIL과 #816 당시 판정은 그대로 보존한다. 별도 [Issue #818](https://github.com/planner77/masterGantt/issues/818)의 [Work Packet](exec-plans/active/ISSUE_818.md)·[누적 실패 원장](ISSUE_818_FAILURE_ANALYSIS.md)에서 실제 raw pointer RED, 최소 CSS 후보와 후속 교차 회귀를 추적한다. #818 새 source의 로컬 성공이나 PR CI 시작을 과거 실패의 소급 PASS·정식 QA/Owner 승인으로 해석하지 않는다.

# Issue #816 — PR CI 누적 실패 원장

## 2026-10-26 네 번째 Full 실패 — #3318.1 / F816-005 Task 삭제 우클릭

- **귀속:** [Full #3318.1 / Run 40311630203.1](https://github.com/planner77/masterGantt/actions/runs/40311630203), `.github/workflows/ci.yml`, `pull_request` Ready `FINAL_FULL`, 2026-10-26 10:59:17~11:21:23 UTC. PR #817 / branch `feat/issue-816-gantt-row-density`, Head `e69cd78c530f3d3ec148f74484e540a2aa236e97`, base `cd010d6bcff26f10ad00c42cdf3528b851519938`, test merge `2dc65601e46a0273872b6245399554c42c8d0a30`, tree `0ab26322ac6c91b4087a0247fcee1975db7abb15`. Infra가 [source artifact12645131741](https://github.com/planner77/masterGantt/actions/runs/40311630203/artifacts/12645131741)의 실제 zip JSON을 읽고 Run/Attempt·repository/PR·Head/base/test merge, merge 부모·tree 및 commit→PR 단일 #817 귀속을 교차 확인했다. Fast #133.1 /40311628804 SKIPPED는 공식 Full 근거가 아니다.
- **직접 실패:** [Shard5 job121535073428](https://github.com/planner77/masterGantt/actions/runs/40311630203/job/121535073428)의 `tests/e2e/project-task-delete-context.spec.ts:108:98`, `keeps confirmed deletions after repeated mutation rejection (normal)` line158 `target.click({button:'right'})`. Delete D 일반 Task bar 우클릭에서 Summary subtree의 `.wx-progress-marker`(`0`)가 pointer events를 가로막았고 본래90초 test timeout에 도달했다. [원본 report12646755359](https://github.com/planner77/masterGantt/actions/runs/40311630203/artifacts/12646755359)의 trace를 실제 열람했다(Trace SHA-256 `e4b4522fa1d956941e630be248e35349457171598dc420e325ed98f1e6dffcd9`). 최초 click target root는 x597/y458/w10/h27, click(602,471.5)이며 실패 클릭 시 실제 viewport1440×1000/DPR1/fine/noTouch/Chromium153.0.8010.12다. 초기 context-options의1280×720와 구별하며, 원본 `Page.setViewportSize` 뒤 실패 action frame-snapshot1440×1000를 확인했다. 삭제 메뉴 이후 canonical/revision 단언은 미도달이며 삭제 rollback 제품 오류로 단정하지 않는다. 첫 우클릭 시작11:18:19.135130 UTC, FAIL reporter11:19:43.7094474 UTC, 상세 출력11:19:43.8252842 UTC의 반복 interception은 관측 사실이고 근본 원인 분류는 재현 전 **UNKNOWN**이다.
- **Required/파생:** [Quality121535579693](https://github.com/planner77/masterGantt/actions/runs/40311630203/job/121535579693) **PASS**, [Docker121536075095](https://github.com/planner77/masterGantt/actions/runs/40311630203/job/121536075095) **PASS**. [E2E121543240537](https://github.com/planner77/masterGantt/actions/runs/40311630203/job/121543240537) **FAIL** 및 [QA Automated121543277212](https://github.com/planner77/masterGantt/actions/runs/40311630203/job/121543277212) **FAIL**은 E2E 실패/취소의 파생이다. 총30 jobs(success13/failure3/cancelled7/skipped7), 실제 실행23개 원본 로그를 infra가 전부 대조했고 추가 직접 FAIL은 발견되지 않았다.

| Shard / Job ID | 최종 결론 | 완료 PASS / FAIL / SKIP | 미완료(진행 중 취소 포함) |
| --- | --- | --- | --- |
| 1 / 121535073236 | CANCELLED | 104 / 0 / 0 | 1 |
| 2 / 121535073469 | CANCELLED | 65 / 0 / 0 | 28 |
| 3 / 121535073431 | CANCELLED | 84 / 0 / 1 | 57 |
| 4 / 121535073301 | CANCELLED | 43 / 0 / 0 | 50 |
| 5 / 121535073428 | FAIL | 87 / 1 / 0 | 17 |
| 6 / 121535073593 | CANCELLED | 68 / 0 / 1 | 29 |
| 7 / 121535073317 | CANCELLED | 67 / 0 / 0 | 11 |
| 8 / 121535073420 | CANCELLED | 94 / 0 / 0 | 9 |

- 전체817 cases = **612 PASS / 1 FAIL / 2 SKIP / 202 미완료**. Shard1 원본 coarse case3.3s 및 Summary4.5s **PASS**로 F816-004의 해당 원격 재검증을 확인했다. Shard6 hover6 cases(Week/fullscreen/WBS/readonly5.8s 포함) **PASS**로 F816-002/003의 해당 소비자도 통과했다. F816-001 projection spec는 Shard3 취소 전 미도달이므로 이 Run에서는 **NOT TESTED**. 전체 shard 성공 또는 전체 AC 완료로 확대하지 않는다.

- **이력 회수 범위:** 전체 상태 PR검색에서 #816 canonical PR은 #817 한 개다. 검색의 #782는 canonical #737이므로 본 이슈 Run에 합산하지 않았다. 알려진4개 Head의 API Run 조회와 개별 Run의 `run_attempt=1`을 재확인해 Full4개(#3314/3315/3317/3318), metadata1개(#3316), FAST130~133 SKIPPED를 대조했다. 커넥터의 커밋별 조회는 첫 페이지 제한이 있어 무제한 pagination까지 조사한 것으로 주장하지 않는다. 원본23 Job 정제 로그·report/trace는 `/tmp/issue816-ci3318-infra/`에 보존하며 raw trace/쿠키·민감 header는 Git/댓글에 넣지 않는다.

### F816-005 원본 재현과 가설 검증

- frontend가 기존90초 normal recovery 사례를 수정 없이 e69cd78c production standalone·fresh SQLite31 migrations·private `/data` mount namespace에서 실행해 **원격과 같은 marker interception FAIL**을 재현했다. 상세 실행·결과와 최종 지문은 아래 후보 검증 시 확정한다. 외부3101 서버는 본 작업 소유이며 운영 DB/서비스를 사용하지 않는다.
- 순위 가설은 (1) Summary progress hover affordance가 행 밖까지 남아 pointer를 가로막음, (2) 삭제/recovery 뒤 projection Y 미정착, (3) raw chart scroll과 Core/native 좌표 불일치였다. read-only DOM geometry에서 root Summary y424/h27, marker top80%=21.5938/h26 → y445.5938~471.5938, 다음 Delete D y458/h27의 중심471.5를 **0.0938px** 가로막는 것을 관측했다. marker는 `opacity:0`이어도 `pointer-events:all`이다. 임시 force/hover 없는 두 번째 probe에서도 같은 적중을 확인했다.
- Grid34px/bar27px의 같은 ID 중심 오차는0.5px 이내였고 상대 겹침은 scroll과 무관하게 유지되어 가설2/3을 기각했다. 기존38px/bar31px 산식에서는 marker 하단이 다음 중심보다 위에 있어 이번 밀도 축소가 겹침을 드러냈다. 이 비교 산식은 같은 fixture의 전체 main before/after 실제 계측 PASS를 대신하지 않는다.
- **PRODUCT 확정 및 최초 설계 후보:** 당시에는 pointer 이벤트를 끄거나 다른 pixel만 우클릭하는 방식으로 숨기지 않고 native26px progress handle을 자기 Task/Summary bar 안으로 배치하는 Project-local CSS를 검토했다. 이 중앙 배치안은 아래 설계 통제 실험에서 자기 Task 이동 회귀로 기각했으며 최종 후보는 비표시 marker의 visibility만 수정한다. 공개 progress 제어와 label/drag/hover·readonly, Summary60%/full hitbox, 일반34px·coarse44px, strictY±1px 및 날짜x/width는 보존해야 한다. 별도 ui_ux가 설치 Core/기존 UX 계약과 설계·수용 조건을 read-only 비교한다.
- F816-002/003의 과거 occluder는 원본에 없어 계속 UNKNOWN이다. 이번 marker 발견만으로 과거 root cause를 소급 확정하지 않으며 기존 실제 hit-point 검증도 별도 인과 증거 없이 제거하지 않는다. 진단용 일시 instrumentation·force/짧은 probe timeout은 최종 후보에서 제거하고 원본 right-click/90초·회귀 단언을 유지한다.

### 설계 통제 실험과 기각한 대안

- 최초 후보인26px marker 중앙 배치는 인접 행 침범을 없애지만 좁은 Week19px 막대의 progress0/50/100에서 자기 Task 중심을 덮어 Task 이동이 progress drag로 분기할 위험이 확인돼 **채택하지 않았다**. ui_ux의 조건부 설계 검토도 실제 body 이동·resize·progress 조작 보존을 전제로 했으며 구현 PASS/QA_FINAL이 아니었다.
- bounded control A는 native top80%/26px·progress 드래그 위치를 유지하면서 **보이지 않는 marker만 `visibility:hidden`**, 기존 bar hover/`wx-progress-in-drag`에서 visible로 하는 CSS를 브라우저에 적용했다. 원본 normal 사례는 click/assertion을 변경하지 않고 **4.6s PASS**했다. 이 값은 통제 실험이며 최종 source 검증 수에 더하지 않는다.
- 최종 CSS 후보와 active marker/Task 이동·resize/hover/readonly·coarse 실측 결과는 이어지는 동결 검증 기록에서 확정한다. 숨은 marker 차단만으로 표시 중인 native handle의 모든 행 밖 geometry가 해결됐다고 주장하지 않는다. 탐색용 containment 사례의 FAIL과 임시 진단은 후보 회귀 테스트 및 원본90초 사례와 구별한다.

- **통제 실험 B:** `isolation:isolate`만 브라우저에 적용한 원본 normal은4.4s PASS였다. 그러나 active progress 숫자/stacking과 전체조작 보존이 검증되지 않아 채택하지 않는다. 별도 active-hover probe는 반복 Project 생성의 HTTP429로 준비 단계에서 실패해 hover action에 미도달했다. 이를 활성 침범 실제 FAIL로 집계하지 않으며 **NOT TESTED**로 남긴다. disposable 서버/새 DB를 준비해 재검증하고 rate-limit 정책은 변경하지 않는다.
- **새 회귀 RED:** 최종 비표시 실제 hit 검사의 fine/coarse2cases를 원본 CSS에서 실행해 fine의 다음 Task 중심 actual Task ID 불일치 **FAIL**, coarse **PASS**(5.8s). 탐색용 중앙 containment 실패2개는 폐기한 설계의 실험이며 최종 수용 기준이나 제품 실패 수에 합산하지 않는다.

- **최종 검사 준비 중 실패도 보존:** 첫4case는3 PASS/1 FAIL(11.9s)이며 신규 native 조작 사례의 dynamic import SyntaxError는 테스트 하네스 오류로 static import로 교정했다. 이어서 body 중심 Week 이동(progress0/50/100), Day resize·revision/이웃 불변은 통과했지만 마지막 progress는 기대70/실제69로 FAIL했다. 마우스 client 정수 좌표 반올림으로19% delta가 된 것을 확인하고 drag 시작/이동을 정수CSS 픽셀로 고정했다. 엄격70 기대를69 허용으로 완화하지 않는다. 이 중간 결과는 최종 source PASS에 합산하지 않는다.
- active-hover 새 probe의 read-only hit는 이전 Summary marker였지만 실제 다음 Task 우클릭은 성공했다. 따라서 앞선 준비429와 별개로 **active right-click blocked를 실제 재현했다고 주장하지 않는다**. 정확 메뉴 대상과 최종 source 결과는 아래에서 확정한다. Build 완료 전 standalone을 일찍 시작해 파일이 없던 준비 실패도 제품 FAIL과 구분한다.

### 동결 source 첫 누적 실행의 환경 지연

- 같은7파일 지문에서 webpack dev의 첫23case 누적 검증 중 원래 #375 Summary 사례가31.5s FAIL했다. Geometry/5폭·Week/fullscreen 단언을 지난 최종 readonly reload의 `읽기 전용` 대기에서 전체30초를 소진했다. 원본 trace상 최초 navigation22,123ms(browser goto20,766ms), 마지막 reload2,273ms, 마지막 matcher에 남은 시간686ms였고 session closed는 timeout 뒤 파생이다. geometry 값 불일치로 분류할 근거는 없다.
- 이 실패를 숨기거나 시험 timeout을 늘리지 않는다. 첫23case 전체 완료와 실패 증거를 보존한 뒤 같은 소스·같은23cases를 준비된 서버에서 다시 실행해 cold navigation/setup 비용 가설을 검증한다. 최종 결과는 별도 아래 표에 기록하고 첫 실행과 합산하지 않는다.

### F816-006 — 활성 marker의 실제 포인터 우클릭 대상 오류 (미해결)

- **새 로컬 직접 PRODUCT / AC4 FAIL:** 같은 최종 CSS에서 이전 Summary를 hover한 뒤 locator의 자동 스크롤 없이 실제 `page.mouse.move`→`mouse.click({button:'right'})`를 사용했다. Week child rect x578/y391/w10/h27의 중심(583,404.5)에서 이전 Summary의 marker0이 실제 hit됐고, 이어서 Edit에 열린 이름은 기대 `Existing summary child` / 실제 **`Stable summary`**였다. `/tmp/issue816-active-raw.log`의6.0s는 진단 capture 완료 시간이지 기능 PASS가 아니다. 이 진단의 임시 파일은 repository에서 제거하고 정제한 결과만 원장에 보존한다.
- **재현 조건:** viewport1440×1000/fine pointer/Week, stateful fixture의 Summary와 child는 start/end `2026-01-05`, duration1, progress0. Summary(ID `00000000-0000-4000-8000-000000000001`) hover → child(ID `00000000-0000-4000-8000-000000000002`) bounding box 중심으로 raw mouse 이동·우클릭 → 메뉴 Edit → Task name 확인 순서다. 정제 진단 코드 `/tmp/issue816-active-raw-probe.ts` SHA-256은 `723b3214566723248411917565c1787e2f97575c2d3f6650bf7e9aec1e731530`이다. 별도 qa_docs는 이를 **P1 병합 blocker**로 판정했다. 잘못된 대상의 Edit를 확인했으며 실제 오대상 삭제는 실행하지 않았다.
- 앞서 통과한 locator.click→Edit child 검증은 자동 스크롤이 포함된 별도 경로다. 그 PASS로 raw 사용자 포인터의 wrong-target FAIL을 덮어쓰지 않는다. 이는 기존 원격 #3318의 **비표시 marker** 원인과 다른 활성 상태이며, 비표시 visibility 보완으로 해결됐다고 주장하지 않는다.
- **Manager 범위 결정:** 이번 사용자 요청의 종료점은 PR CI 보완·새 CI 시작이다. native26px/top80%·body 중심 이동/진행률 제어를 유지하는 비표시 marker 수정은 게시하되 활성 geometry의 설계·실제 포인터 회귀 자동화/해결은 **REWORK**로 남긴다. `AC4=FAIL`, `manager_decision=REWORK`, `MERGE_READY=BLOCKED`; 이 새 직접 오류가 해결되기 전 전체 #816 완료/QA_FINAL PASS·Owner ACCEPT·병합을 주장하지 않는다. 기존 삭제/hover/행 geometry의 자동 검사 PASS와 별도 원장에 노출한다.

### REWORK #4 같은 최종 source 실행 증거

- 환경: WSL2 Linux/Node22.14.0/npm11.10.0, Next16.4.2/React19.3.0/SVAR Core2.7.3, Playwright1.63.0/Chromium153.0.8010.12, better-sqlite3 13.0.3. 운영 DB/서비스를 사용하지 않고 앱/테스트에서 credential 환경변수를 제거했다.7파일 동결 지문은 `/tmp/issue816-rework4-frozen.sha256`에 저장하고 매 순차 실행 뒤 일치를 확인한다.
- 누적4spec은 같은 product/test bytes에서 **자동31 PASS/0 FAIL/0 SKIP**다. 단, 별도 실제 raw 포인터 진단 F816-006은 **FAIL**이며 전체AC4 PASS가 아니다. Dev-only public diagnostic port가 필요한 기존3spec은 fresh webpack dev3102, 실제 삭제/선택은 fresh production standalone3101+private `/data`/새 SQLite31 migrations에서 실행한다. 환경을 혼합한 하나의 Full CI PASS로 주장하지 않는다.

| 검증 | 실제 명령/조건·로그 | 결과 |
| --- | --- | --- |
| 누적 Summary/projection/hover3spec | `npm run test:e2e -- tests/e2e/projection-row-alignment.spec.ts tests/e2e/project-task-hover-tooltip.spec.ts tests/e2e/project-summary-bar-visual.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=0 --output=/tmp/issue816-rework4-union-dev-final-results --reporter=list`, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3102`; `/tmp/issue816-rework4-union-dev-final.log` | **23 PASS/0 FAIL/0 SKIP**,2.4m. 첫22PASS/1cold-timeout(2.7m)은 보존; 동일 source #375는13.5s PASS |
| 누적 delete-context 전체 | 같은 옵션, `tests/e2e/project-task-delete-context.spec.ts`; fresh production 프로세스/DB를5+3case 두 순차 묶음으로 실행. `/tmp/issue816-rework4-delete-batch1.log`, `...-batch2.log` | 고유 **8 PASS/0 FAIL/0 SKIP**,25.2s+17.9s. 원래7cases/신규 native 조작1 포함 |
| 인접 선택/keyboard/URL/filter | 같은 E2E 옵션, `tests/e2e/project-multi-task-copy-paste.spec.ts`의 기존 선택5case; fresh production/실제 HTTP·SQLite. `/tmp/issue816-rework4-selection-final.log` | **5 PASS/0 FAIL/0 SKIP**,13.8s |
| 선택/readiness unit | `npm test -- tests/features/gantt/task-selection-model.test.ts tests/features/gantt/gantt-readiness.test.ts` | **40 PASS**,318ms |
| TypeScript/변경 test ESLint | `npm run typecheck`; `node_modules/.bin/eslint tests/e2e/project-summary-bar-visual.spec.ts tests/e2e/project-task-delete-context.spec.ts` | PASS,lint0 error/0 warning |
| Production build | `npm run build`; `/tmp/issue816-delete-build.log` | PASS. build 전 premature standalone 준비 실패는 별도 이력 |
| active raw pointer 음성 진단 | 위 F816-006, native mouse 직접 우클릭→Edit 대상 | **FAIL**(wrong Summary), 자동31PASS와 구분 |

- **로컬 환경 실패 F816-LOCAL-002:** 하나의 외부 shared production 프로세스로 delete8을 실행한 중간 결과는5 PASS/3 seed FAIL(29.2s)였다.412/network/new native3cases의 실패는 실제 동작 전에 Project POST HTTP429/RATE_LIMITED(RetryAfter3576)였다. CI 원래 isolated fixture는 case별 프로세스 격리인데 external-base 진단 서버는 rate-limit 메모리를 공유했다. 제품 guard·retry·timeout을 바꾸지 않고 정확8cases를 새 소유 production 프로세스/새 DB의5+3case로 분할해 위 결과를 얻었다. 첫 실패를 삭제하거나 최종 PASS 수에 반복 합산하지 않는다.
- dev 종료 뒤 Next가 생성한 `next-env.d.ts`/`tsconfig.json`의 자체 출력 경로만 HEAD bytes로 복원했다. 자체 dev 출력은 `/tmp/issue816-rework4-dev-output-preserved`로 이동 보존했고 실제 DB/원시 trace·민감 header·빌드는 커밋하지 않는다. 같은 출력을 동시에 쓰는 browser/build 실행은 하지 않았다. 로컬 전체8shard/Docker·정확 main before/after·실제 터치/native125%·새Head Required3/Trusted/Owner는 **NOT TESTED**다.

### Pre-PR 자동 선정·문서/QA 및 CI 인계

- Local Pre-PR 두 실제 명령 `npm run verify:prepr -- --mode=fast --base=origin/main --issue=816 --pr=817 --risk=HIGH` 및 같은 `--mode=targeted`는 **BLOCKED / exit1**이다. 전체 PR diff16paths의 영향 선정18tests 중 `tests/e2e/helpers/gantt-readiness.ts`, `gantt-readiness-state.ts` 두 helper의 자동 producer→consumer map이 UNKNOWN이라 테스트 실행 전에 차단됐다. 범용 selector/정책은 수정하거나 우회 PASS하지 않는다. 직접 검증한 소비자는 실제 hover6·projection/negative·Summary/touch와 readiness unit 등 위 수동 한정 집합이고, 자동18개 전체 실행 증거가 아니다.
- 보고서: `.prepr-reports/2026-10-26T12-16-37.434Z-2190312-a3c1ea75/{report.json,SUMMARY.md}`(fast), `.prepr-reports/2026-10-26T12-16-44.835Z-2190708-30a90c17/{report.json,SUMMARY.md}`(targeted). 두 실행의 base `cd010d6bcff26f10ad00c42cdf3528b851519938`, Head `e69cd78c530f3d3ec148f74484e540a2aa236e97`, working fingerprint `80d7bc86a5708213d2566d89737cf12f7c835aabf823ed4f54892399650bc139`는 시작/끝 동일(`sourceStable=true`)이다. 이 지문은 당시 문서 bytes를 포함하고 이후 문서 결과 보강과 구별한다. Playwright expected revision1243 메타데이터를 실제 browser 실행 PASS로 세지 않는다.
- 최종 자동 한정 사례는 **고유 E2E36+unit40 PASS**이며 재실행/통제 실험을 더하지 않는다. 별도 실제 pointer 진단 **F816-006 FAIL**과 Pre-PR **BLOCKED**는 그대로다. 개발/production 실행 환경별 구분·cold/429 중간 실패·미실행을 보존한다. Required3/8shard·전체AC·Trusted/Owner의 PASS가 아니다.
- DOCUMENTATION_SYNC: 본 원장·Work Packet·PROJECT_UX·TEST_PLAN·CHANGELOG·active PLAN UPDATED. package/lock0.135.2 유지, README/AGENTS/DESIGN/UI_UX_GUIDELINES/Architecture/API/DB/Scheduling/GSC/Conformance/CI_CD/REMOTE_VALIDATION/GitHub/Lifecycle는 기존 기능/권한/구조/원격 검증 정책 불변 또는 기존 원칙 적용으로 N/A(자세한 영향은 Packet). 원래7delete cases와 기존 skip/retry/timeout/Required3/8shard는 유지한다.
- 실제 역할: root Manager=계획·문서/원장·통합/게시, infra=원격30Job/23로그 및 출처 감사, frontend=원본/통제/최종 실행과 CSS/test, ui_ux=설계 read-only(중앙안 철회), qa_docs=별도 source/원본·최종 로그/문서 read-only 검토. 별도 read-only `/root/rework4_review` 최종 사전검토는 **CI 원인 한정 수정·가드 보존 PASS**와 **기능QA AC4 FAIL / REWORK / P1 병합 blocker**를 구분하며 QA_FINAL PASS·Owner ACCEPT로 대체하지 않는다.
- 최신 PR 조회: main/base/head 변화 없음, Ready/draft=false/mergeable=true, 기존 review1개 resolved/미해결0. 최종 일반 commit/push 전 다시 확인한다. 이 원장과 제한·잔여 오류를 Issue/PR에 게시하고 새 exact-Head Full PR CI **시작만 확인**한다. 이후 모니터링·merge/Main/GHCR/Release/Finalizer/Issue close는 하지 않는다.

| 동결 파일 | SHA-256 |
| --- | --- |
| `src/features/gantt/gantt-scale-toolbar.css` | `1fc822361ef160028987c1cdd2d10c34b153e561d47fd04b8293535d8b48a59e` |
| `tests/e2e/project-task-delete-context.spec.ts` | `88543a9f613032ac2841a14dd797f420f6bb13cd4207c6c6aa77c1e0acb4366a` |
| `tests/e2e/project-summary-bar-visual.spec.ts` | `7da83df55db6ca7fccbc6367d4520fe8099bc32f03c0463759f965519ae3eda0` |
| `tests/e2e/projection-row-alignment.spec.ts` | `d68c6e556a41428cd9780598e429d885099928663b943e9abc67718d20a6e618` |
| `tests/e2e/project-task-hover-tooltip.spec.ts` | `28855c0516b39b24794b49504d4454a8ffcc4238780527d5dfbc943aade23dd1` |
| `tests/e2e/helpers/gantt-readiness.ts` | `ac479c6e869ed91d6b63ecddb9e4f2037d85e947ff11f28a1740cf9a489ec3d5` |
| `tests/e2e/project-multi-task-copy-paste.spec.ts` | `88f4c984e3c14d4fece799a92f17b65a6ddac2d0a65b2b8a2d7606ab1f83a48d` |

### 최신 전 이력 매트릭스 / 동결 검증 계획

| 원본 Run/Attempt | 누적 실제 실패/이전 교정 | #3318.1 관측 | REWORK #4 후보 source |
| --- | --- | --- | --- |
| #3314.1 /40284101069.1 | F816-001 virtual max TEST_CONTRACT, F816-002 hover(hit UNKNOWN) | projection 미도달; hover6 PASS | projection/hover 포함 누적4spec 31 PASS; 활성 포인터 F816-006은 별도 FAIL |
| #3315.1 /40301017370.1 | F816-002 반복, F816-003 좁은 bar 실제 hit-point 보완 | hover6 PASS; 당시 occluder는 여전히 UNKNOWN | hover6 PASS; 과거 occluder와 이번 원인의 동일성은 미확정 |
| #3316.1 /40301188286.1 | metadata-only Full 진행 중 DEFERRED | 직접 제품 실패 아님 | 과거 FAIL 그대로, 새 Full 결과와 분리 |
| #3317.1 /40306434180.1 | F816-004 native coarse click 소실 PRODUCT | 원본 coarse PASS | Summary/touch 포함23 PASS 및 인접 선택5 PASS |
| #3318.1 /40311630203.1 | F816-005 일반 Task 우클릭 marker interception | 신규 직접 FAIL, 삭제 복구 검증 미도달 | PRODUCT 재현·비표시 marker 수정; delete8 PASS / 활성 F816-006 FAIL |

- **누적 실제 실패 파일 합집합:** `tests/e2e/projection-row-alignment.spec.ts`, `tests/e2e/project-task-hover-tooltip.spec.ts`, `tests/e2e/project-summary-bar-visual.spec.ts`, `tests/e2e/project-task-delete-context.spec.ts` 총4개다. 이전 고정 scroll/hover/touch를 누락하지 않고 직접/인접/음성 소비자를 추가해 동일 후보에서 순차 검증했다(누적31 PASS·인접5 PASS, F816-006 별도 FAIL).
- **역할/승인:** root Manager=계획/누적 원장·문서/최종 commit·push, infra=원격 read-only 증거, frontend=재현·최소 보완/관련 실제 실행, qa_docs=DOC_SYNC 후 별도 read-only 사전검토. HIGH/OWNER_MANAGED/qa_required=true, version0.135.2 후보 유지/release_authorized=false. 새 Head Required3/Trusted/Owner는 **NOT TESTED**, `MERGE_READY=BLOCKED`. 사용자 범위는 새 PR CI 시작 확인까지이며 이후 모니터링·merge/Main/GHCR/Finalizer/Issue 종료는 제외한다.

## 2026-10-26 세 번째 Full 실패 — #3317.1 / F816-004 터치 선택

- **귀속:** [Full #3317.1 / Run 40306434180.1](https://github.com/planner77/masterGantt/actions/runs/40306434180), `.github/workflows/ci.yml`, `pull_request` Ready `FINAL_FULL`, 2026-10-26 10:18:56~10:36:30 UTC. Head `b3475c064e1b7ef03e4657d0ec6c0b9207ee2e28`, base/main `cd010d6bcff26f10ad00c42cdf3528b851519938`, test merge `e86aba882eb0059d13ee003df66cb435f7b0fd5e`, tree `b469ca3975a1cb1464b5ed686444dc6d74232d36`. [Source artifact 12643440397](https://github.com/planner77/masterGantt/actions/runs/40306434180/artifacts/12643440397)의 repository/run/attempt/PR/head/base/test merge를 현재 PR·merge 부모·commit→PR API 단일 #817 귀속과 교차 확인했다. 원본 전체 CI 목록은 Full #3314/#3315/#3317, 별도 metadata #3316이며 모두 attempt1이다.
- **실제 최초 오류:** [Shard1 job121517917754](https://github.com/planner77/masterGantt/actions/runs/40306434180/job/121517917754), `project-summary-bar-visual.spec.ts:153:5`의 coarse-pointer case, 10:34:38 UTC. line174 `label.tap()`은 visible/enabled/stable·스크롤·tap 성공으로 완료했지만 line175 `toBeChecked`가 expected checked / received unchecked로 5초 후 FAIL. [Report 12642793544](https://github.com/planner77/masterGantt/actions/runs/40306434180/artifacts/12642793544) 원본 trace에서 label x13/y733.5/w55/h44, 실제 tap (40.5,755.5)를 확인했다. Timeout 확대나 tap 강제는 원인 보완이 아니다.
- **Required/파생 구별:** Quality aggregate121518566455 **PASS**, Docker aggregate121518900449 **PASS**. TypeScript/Lint/Policy/Build/Docker 구현 성공, Vitest 280 files PASS/1 SKIP·3344 tests PASS/3 SKIP. E2E aggregate121524064762 **FAIL**, QA Automated121524104064 **FAIL**은 `NEED_E2E=failure` 파생이다. 총30 Jobs(success13/failure3/cancelled7/skipped7), 실행23개 원본 로그를 전부 확인했다. Shard1의 maximum allowed failures 중단 보고를 두 번째 제품 오류로 중복 계산하지 않는다.

| Shard / Job ID | 최종 결론 | 완료 PASS / FAIL / SKIP | 미완료(진행 중 취소 포함) |
| --- | --- | --- | --- |
| 1 / 121517917754 | FAIL | 93 / 1 / 0 | 11 |
| 2 / 121517917919 | CANCELLED | 33 / 0 / 0 | 60 |
| 3 / 121517918317 | CANCELLED | 97 / 0 / 1 | 44 |
| 4 / 121517917841 | CANCELLED | 31 / 0 / 0 | 62 |
| 5 / 121517917786 | CANCELLED | 30 / 0 / 0 | 75 |
| 6 / 121517917746 | CANCELLED | 56 / 0 / 1 | 41 |
| 7 / 121517917828 | CANCELLED | 68 / 0 / 0 | 10 |
| 8 / 121517917976 | CANCELLED | 89 / 0 / 0 | 14 |

- 전체 선언817 cases 중 **497 PASS / 1 FAIL / 2 SKIP / 317 미완료**. 취소7 shard 내부에서 추가 직접 FAIL은 발견되지 않았다. Shard3의 projection 기본9 cases PASS 뒤 1920px Week 진행 중 취소로 **F816-001 virtual-scroll 미도달**; Shard6은 master-controls-density 이후 취소되어 **F816-002/003 hover 미도달**. 이전 보완을 이번 원격 PASS로 표시하지 않는다.
- **역할/환경:** root Manager가 요구·AC·범위/문서와 최종 commit/push를 담당하고 infra(gpt-6.1-sol/high)가 원본30 Jobs/23 로그·17 artifacts·provenance를 read-only 회수했다. frontend(gpt-6.1-sol/medium)가 실제 원본 Chromium 재현과 최소 보완/관련 테스트, 별도 qa_docs가 후보 source를 검토한다. 실제 실행한 역할만 기록한다. 사용자 범위는 새 PR CI 시작까지이며 이후 모니터링·병합/Main/GHCR/Finalizer/Issue close 및 정식 release 승인은 없다.

### F816-004 원인과 통제 재현

- **PRODUCT:** 390px·hasTouch/isMobile Chromium에서 원본 coarse E2E를 수정 없이 실행해 같은 line175 unchecked를 재현했다(`--grep 44px`, 1 FAIL, 27.5s). 실제 이벤트 관측은 최초 hit=INPUT, pointerdown/mousedown=INPUT, 후속 click=DIV.wx-scroll, input/change 없음이다. 초기 hit가 다른 요소였다는 가설과 정상 change 뒤 선택이 덮였다는 가설은 이 관측으로 기각했다. 설치된 SVAR Grid의 mousedown 포커스 처리와, label에서 mousedown 전파만 막았을 때 INPUT click/input/change가 되살아나고 원래 테스트가 통과한 통제 결과(1 PASS, 5.3s)가 원인 분리 근거다. 포커스에 의한 viewport 이동은 이 이벤트·설치 코드·통제 실험에 근거한 해석이며 중간 scroll delta를 직접 계측한 것은 아니다.
- mousedown만 막은 후보는 label 여백 탭 확장 사례에서 실패했다. 최종 `ProjectTaskSelectionCell` label에 pointerdown/mousedown/click 전파 차단을 적용해 Grid의 포커스·선택 처리와 native label 활성화를 분리했다. `preventDefault`, 직접 checked write, 추가 toggle, 라이브러리 수정 또는 Core/private API write는 없다. input의 기존 native onChange 단일 toggle·Shift range·키보드 처리는 유지한다.
- 기존 coarse `label.tap()`과 checked assertion을 보존하고 label 여백↔input 탭의 1회 토글, 선택 수0/1, 이웃 행 오선택0, readonly 선택과 POST/PATCH0을 같은 E2E에서 EXTEND했다. 34/44px·Summary0.55~0.70·Y±1px·virtual bottom·strict negative/hover content/close·CI8샤드/timeout/retry/skip는 변경하지 않았다.

### 로컬 실행 실패도 보존 (F816-LOCAL-001)

- 최초 default dev는 symlink 의존성이 Turbopack filesystem root 밖에 있어 Next build-manifest ENOENT로 준비 실패했다. 원래 제품 오류의 재현 또는 PASS로 세지 않는다. 동일 Next16.4.2 의존성을 사용하는 별도 `next dev --webpack` 3101 서버로 원본을 재현했고 임시 환경 설정과 generated AGENTS/next-env/tsconfig 변경은 제거했다.
- 첫 동결 후보 검증에서 union과 선택 E2E를 같은 Playwright outputDir로 동시에 실행한 실행 오류가 있었다. Union은 **18 PASS/3 FAIL(2.2m)**, 실패3개(hover leave/1024Week/1920Day)는 모두 `browserContext.close: ENOENT` trace/network/zip 누락이었다. 선택 묶음은 **1 PASS/4 FAIL(57.3s)**로 seed/checkbox 준비, filter 선택수(예상1/실제0), seed500 및 Next JSON parse 오류도 관측했다. 이 중간 실패를 숨기거나 모두 제품 PASS로 승격하지 않는다. 같은 제품·테스트 소스를 유지한 채 output/report를 격리하고 두 묶음을 **순차 실행**하여 환경 경합과 제품/테스트 오류를 구별했다. 최종 결과는 아래 동결 source 검증 표만을 근거로 한다.
- 별도 출력 순차 선택 실행도 **4 PASS/1 FAIL(37.4s)**이었다. 미완료 Shift-filter case는 selection 동작 전 seed의 POST links expected201/actual500으로 실패했다. 정제한 서버/trace stack은 `JSON.parse → next/dist/server/load-manifest.external.js:loadManifest → loadManifestFromRelativePath → AppRouteRouteModule.loadManifests/prepareImpl`이며 **request JSON 또는 앱 route handler 이전의 Next 개발 manifest parse 실패**를 가리켰다. 따라서 이를 selection 제품 PASS로 세지 않고, 소유한 개발 cache/서버를 새로 준비한 뒤 같은5개 선택 사례 전체를 순차 검증했다. 임시 Next 생성 config를 서버 실행 중 되돌려 reload를 유발하지 않도록 종료 후 복원한다. 원시 trace/쿠키·민감 헤더는 Git에 넣지 않는다.
- 깨끗한 dev 재시도도 **1 PASS/4 FAIL(44.9s)**였고 manifest/seed 준비 오류를 유지했다. production Build는 PASS했으나 첫 standalone 선택 실행은 **0 PASS/5 FAIL**: 기존 production DB 경로가 반드시 `/data` 아래여야 한다는 guard에 임시 DB 경로가 맞지 않아 seed create가500이었다. guard/권한/제품 코드는 바꾸지 않았다. 쓰기 가능한 `/data`가 없는 호스트에서 private user+mount namespace 안에 새 소유 임시 디렉터리만 `/data`로 bind하고 새 DB에31 migrations를 적용해 production runtime을 준비했다. 호스트의 기존 `/data`는 변경하지 않았고 운영 DB를 사용하지 않았다.

### 같은 최종 source 교차 검증

WSL2 Linux6.6.87.2 x86_64, Node22.14.0/npm11.10.0, Next16.4.2/React19.3.0/SVAR2.7.3, Playwright1.63.0/Chromium153.0.8010.12, better-sqlite3 13.0.3. Git 자격증명 환경변수는 앱/테스트에서 제거했고 실제 `.env`를 복사하지 않았다. 직접 CLI는 원본 재현 spec과 전체 실패 합집합을 명시적으로 선택하기 위해 사용했으며 Pre-PR 도구나 CI 선택 정책을 변경하지 않았다. 모든 E2E는 workers1/retries0/max-failures0, output/report 격리·순차 실행이다.

| 검증 | 실제 명령/조건 | 최종 결과 |
| --- | --- | --- |
| 과거 실패3개 spec 합집합 | `npm run test:e2e -- tests/e2e/projection-row-alignment.spec.ts tests/e2e/project-task-hover-tooltip.spec.ts tests/e2e/project-summary-bar-visual.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=0 --output=/tmp/issue816-union-serial-results --reporter=list`, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3101`, webpack dev | **21 PASS/0 FAIL/0 SKIP**, 1.8m. 5폭×Day/Week·virtual bottom2·strict negative/recovery·Summary·touch·Week/fullscreen/WBS/readonly/tooltip close 포함 |
| 인접·음성 선택 | 같은 E2E 옵션, `tests/e2e/project-multi-task-copy-paste.spec.ts --grep 'modifier·Shift\|접힘은\|URL task\|Shift 범위\|선택된 Task'`, 별도 output·production standalone/private `/data`/실제 HTTP·SQLite | **5 PASS/0 FAIL/0 SKIP**, 10.9s. Shift/Space/Escape/keyboard Context/Copy-Paste·collapse/filter/clipboard·URL label padding/Chart·context ancestor 제외·Day/Week header Escape |
| 선택/Readiness unit | `npm test -- tests/features/gantt/task-selection-model.test.ts tests/features/gantt/gantt-readiness.test.ts` | **2 files/40 PASS/0 FAIL/0 SKIP**, 408ms |
| TypeScript | `npm run typecheck` | PASS exit0 |
| 변경 파일 ESLint | `node_modules/.bin/eslint src/features/gantt/project-gantt.tsx tests/e2e/project-summary-bar-visual.spec.ts` | exit0, **0 errors/3 warnings**. HEAD 원본 stdin lint도 동일3개 기존 hook dependency warning임을 비교 확인 |
| Production Build | `npm run build` | PASS exit0, Next webpack+TypeScript+standalone prep+runtime-tools. compiled18.9s |
| 소스/정적 검사 | `sha256sum -c /tmp/issue816-frozen.sha256`, `git diff --check`, debug 계측 제거 | PASS. 테스트 실행 전후 아래6개 fingerprint 동일 |

| 동결 파일 | SHA-256 |
| --- | --- |
| `src/features/gantt/project-gantt.tsx` | `d7c1e510a5a0a4a2dd6916f37265eabf831f9a069e10dd5f57f2daf831331803` |
| `tests/e2e/project-summary-bar-visual.spec.ts` | `68e1fb7847c25a4243f9a3dcbe8bc26a92be424d6728e79e79bfbe3bcb46e417` |
| `tests/e2e/projection-row-alignment.spec.ts` | `d68c6e556a41428cd9780598e429d885099928663b943e9abc67718d20a6e618` |
| `tests/e2e/project-task-hover-tooltip.spec.ts` | `28855c0516b39b24794b49504d4454a8ffcc4238780527d5dfbc943aade23dd1` |
| `tests/e2e/helpers/gantt-readiness.ts` | `ac479c6e869ed91d6b63ecddb9e4f2037d85e947ff11f28a1740cf9a489ec3d5` |
| `tests/e2e/project-multi-task-copy-paste.spec.ts` | `88f4c984e3c14d4fece799a92f17b65a6ddac2d0a65b2b8a2d7606ab1f83a48d` |

최종 고유 사례는 **E2E26+unit40**이며 반복 실행/통제 실험을 고유 개수에 더하지 않는다. 로컬 전체 Vitest·전체8-shard·Docker·Trusted QA/Owner·동일 fixture의 main before/after 가시 행수·실제 터치 기기/native125%는 **NOT TESTED**. production 인접5개는 실제 HTTP/SQLite이나 각 case별 독립 프로세스/DB/restart 격리까지 검증한 것은 아니다. 원격 CI는 기존 공식 범위 그대로 새 Head에서 실행한다.

### Cross-run / 문서 / 다음 handoff

| 원본 실행 | 누적 직접 실패/보완 | 이번 동결 로컬 증거 | 새 Head 원격 판정 |
| --- | --- | --- | --- |
| #3314.1 | F816-001 max scroll 계약, F816-002 cancelled 내부 hover 실제 FAIL | virtual Day/Week·strict negative와 hover 전체 위21 PASS | NOT TESTED |
| #3315.1 | F816-002 반복 FAIL, F816-003 좁은 bar 실제 hit 관측/좌표 보완 | Week/fullscreen/WBS/readonly/close PASS, 원래 실패를 소급 PASS로 바꾸지 않음 | NOT TESTED |
| #3316.1 | metadata-only DEFERRED, 직접 제품 실패 아님 | 과거 Full 진행 중 결과 그대로 보존 | 별도 metadata 재실행은 이번 범위 아님 |
| #3317.1 | F816-004 coarse native input click 소실 PRODUCT | 확장 coarse case와 선택5 PASS, Build/unit/typecheck PASS | NOT TESTED |

- **TEST_LIFECYCLE_REVIEW:** #375/#816 spec EXTEND. 이전 실패 union3개와 선택·Readiness/unit/Shift/filter/URL/keyboard/context 음성 경계는 KEEP_UNIQUE; 삭제/통합/skip/재시도/허용오차/CI 정책 변경 없음. 변경 생산자는 label event 경계, 직접 소비자는 native input/onChange·coarse tap이며 기존 선택 model/Core/tooltip/projection은 독립 회귀다.
- **DOCUMENTATION_SYNC:** 본 원장, Work Packet, PROJECT_UX, TEST_PLAN, CHANGELOG, active PLAN 갱신. 버전0.135.2 후보 유지(새 bump/릴리스 없음). README는 실행법·사용 기능 계약 불변 N/A, DESIGN/UI_UX_GUIDELINES는 기존 native label/44px 원칙 적용(Delta C) N/A, Architecture/API/DB/Scheduling/GSC/CI/Remote/Lifecycle는 구조·저장·권한·viewport writer·정책 불변 N/A. generated AGENTS/Next 설정·임시 DB/빌드/원시 trace는 커밋하지 않는다.
- **별도 사전검토:** qa_docs(gpt-6.1-sol/high)가 변경8파일·원본/통제/최종 실행 로그·6개 지문과 링크를 read-only 검토해 **PASS**를 반환했다(코드/test blocker0). Work Packet phase와 과거 NOT TESTED 문구의 시점 P3는 Manager가 현재 REWORK3/역사 문구로 교정했다. root의 Markdown link 검사350파일 PASS·diff check PASS. 이는 QA_FINAL/Owner ACCEPT 또는 새 Head 원격 PASS가 아니다.
- **다음 Gate:** Manager 검토 → 원격 main/head·미해결 리뷰 재조회 → root 일반 commit/push로 새 Ready Full CI 시작 확인. 조사 시 main behind0/mergeable=true, 기존 review thread1개 resolved/미해결0; 새 소스의 Required3/Trusted/Owner는 **NOT TESTED**, `MERGE_READY=BLOCKED`, HIGH/OWNER_MANAGED/release_authorized=false 유지. 새 CI 결과를 모니터링하지 않고 시작 URL·exact HEAD만 최종 보고한다.


## 2026-10-26 재실패 — Full #3315.1 / Metadata #3316.1

- **원본 Full CI** [Run 40301017370.1](https://github.com/planner77/masterGantt/actions/runs/40301017370) (2026-10-26 09:37:43~10:00:14 UTC): Head `a2c876a29c8eda35bd60e0a19a2eb7dc08dbf7c7`, base `cd010d6bcff26f10ad00c42cdf3528b851519938`, authenticated test-merge `3633e9661e87c9fe700b16bb1481038ca9932f17` (parents base/head, tree `8be54ef0c95b7231501bcfbbb3f68ee7a792a424`), source [artifact 12640581191](https://github.com/planner77/masterGantt/actions/runs/40301017370/artifacts/12640581191). Quality job121500500375 PASS, Docker job121500717893 PASS, Chromium aggregate121508153099 FAIL, QA Final121508184397 FAIL(직접 E2E 미성공 파생). Shard2 job121499884998 PASS(93 tests), shard7 job121499884941 PASS(78 tests). Shard6 job121499884827 **FAIL**(63 PASS/1 FAIL/1 SKIP/33 DID NOT RUN), 나머지 Shard1/3/4/5/8 **CANCELLED** (각 로그 확인, 별도 직접 FAIL 발견되지 않음, PASS 아님).
- **F816-002 재발/재평가:** Shard6 [원본 Job](https://github.com/planner77/masterGantt/actions/runs/40301017370/job/121499884827) `project-task-hover-tooltip.spec.ts:97:5`의 #492 Week/fullscreen/WBS/read-only에서 첫 **Week Chart Task hover**(line108) `HOVER_TARGET_NOT_HITTABLE` 5s. 이전 #3314.1의 동일 결과. 중앙 `scrollIntoView` 추가 후보는 **실패**, 해결 주장 철회. [Playwright report artifact 12640913047](https://github.com/planner77/masterGantt/actions/runs/40301017370/artifacts/12640913047)의 nested trace 및 `gantt-readiness-failure` JSON 실제 열람:
  - 4개 연속 sample 모두 동일: Task root rect **x578,y417.5,width19,height27 CSS px**, probe center **(587.5,431)**; `hover.hit=false`만 blocker, 다른 준비 조건 없음.
  - viewport **1280×720**, Gantt Chart client 745×400, actual Core & native `left=0/top=0`, Core width3536, chartWidth746; semantic/latest delivery SETTLED, api `svar-api-1`, revision40, scale Week. **중앙 정렬/늦은 scroll 단독 원인 가설은 반증**.
  - Screenshot의 파란 bar 실제 표시와 중심 `elementFromPoint` false는 함께 관측. **실제 중앙을 가로막는 topmost DOM tag/class 및 주변 구역 포인터 적중 여부는 당시 snapshot에 없어 UNKNOWN**. 직접 제품 클릭/Tooltip 장애라고 확정하지 않는다.
- **F816-003 교정 전략:** read-only `gantt-readiness.ts`의 hover 검사는 **Grid 및 넓은 Bar는 원래 중앙 실제 hit**를 그대로 요구한다. 폭 **24px 이하**의 좁은 `.wx-bar`에만 중앙+수평25%·75%(세로50/25/75%)에서 실제 `elementFromPoint`가 **해당 bar 또는 자손**을 가리키는 위치를 탐색한다. 한 곳도 실제 hit하지 않으면 기존 `HOVER_TARGET_NOT_HITTABLE`를 그대로 FAIL; 모든 샘플의 x/y/hit/topmost tag/class를 기존 failure attachment에 기록해 불투명한 실패를 없앤다. 선택된 동일 pixel을 Playwright의 **실제 `locator.hover({position})`**로 조작하고 원래 Task 이름/날짜 Tooltip, Day/Week/Fullscreen/WBS/Readonly, no-write/close 조건을 보존한다. `force`/retry/timeout/skip, synthetic tooltip, Core write, browser event fabrication 없음. 성공 시에도 중심의 미적중은 JSON `centerHit:false`로 보존하며 Task 전체 hit 문제/실사용 위험은 Owner 확인 대상이다.
- **별도 Metadata Run** [#3316.1/40301188286.1](https://github.com/planner77/masterGantt/actions/runs/40301188286) event=pull_request edited/**METADATA_ONLY** (same Head). `verify-pr-metadata-evidence.py` job121499331649 **DEFERRED** because Full #3315 당시 `in_progress`(09:39:40 UTC), exit1. Quality/E2E/Docker aggregate FAIL 및 QA Automated FAIL은 **metadata-only의 미실행/파생**, 이번 source의 신규 구현 실패가 아니다. 옛 Full PASS로 재판정하거나 CI required source를 바꾸지 않는다.
- **Cross-run matrix:** `#3314.1` F816-001 `TEST_CONTRACT` + F816-002 `UNKNOWN`; `#3315.1` F816-002 **반복 FAIL(동일 blocker)**, F816-001 수정 후 Shard3 최종 CANCELLED/해당 virtual-scroll case **NOT TESTED**. 위약 `center scroll` 가설 기각. `#3316.1` 별도 metadata-only DEFERRED. 기존 실패의 최초/취소·미실행 기록은 위 절에 보존, 새 source에서 최초 실제 PASS 전 해소 표기 금지.
- **TEST_LIFECYCLE_REVIEW:** 직접 반복 `project-task-hover-tooltip.spec.ts` **EXTEND**, 동일 source의 helper `gantt-readiness.ts` / `-state.ts` HIT 관측·재현성만 변경. #637 `projection-row-alignment.spec.ts`와 #375 `project-summary-bar-visual.spec.ts` **KEEP_UNIQUE**, virtual 34px bottom/±1px strict negative와 44px touch 불변. 영향: #492 Week 좁은 막대, Day 넓은 막대, Grid, Summary, scope/fullscreen/readonly, 5폭 E2E, 기존 readiness Unit/other Gantt U3. 실패 대체 test 삭제·timeout/retry/CI policy 약화 없음. 일반 폭 중앙 hit는 유지, 좁은 폭에서는 실제 검증된 다른 내부 좌표를 명시 사용한다.
- **로컬 synthetic control (제품 검증 아님):** headless Chromium에서 19×27 Bar 중심을 겹치는 투명 7px sibling으로 가린 통제 HTML을 대상으로 `elementFromPoint` 실행: center hit=false, 좌측25%/우측75% 실제 bar hit=true. 이는 새 probe의 필요조건 실험일 뿐 운영 SVAR2.7.3/실제 PR Head의 검증이 아니다. **로컬 실제 Node/Next/SQLite/Playwright/전체 8샤드/실기기 NOT TESTED**.
- **DOCUMENTATION_SYNC:** 누적 원장 본 절, Work Packet의 재검토·다음 검증/미확정 원인 갱신. GSC-01..12/SC의 canonical·Core·native·사용자 입력 순서 수정 없음; 제품 Task/Gantt/API/DB/Style/수치 변경0으로 DESIGN/PROJECT_UX/ARCHITECTURE/TEST_PLAN/CHANGELOG/CI 문서 N/A(기존 계약·원본 유지). 새 Head Required3·8-shard/Trusted/Owner는 새 Full 원본 성공 전 **NOT TESTED**; PR #817 OPEN/HIGH OWNER_MANAGED, release_authorized=false, MERGE_READY BLOCKED. Main 뒤처짐0, 리뷰 thread0 확인 후 새 Full CI만 시작.

Source of Truth: [PR_CI_FAILURE_TRIAGE](PR_CI_FAILURE_TRIAGE.md), [Work Packet](exec-plans/active/ISSUE_816.md). 과거 실패/취소/미실행은 후속 시도로 덮어쓰지 않는다.

## 2026-10-26 원본 및 전체 이력 (F816-001/F816-002)

- Primary [Issue #816](https://github.com/planner77/masterGantt/issues/816) / [PR #817](https://github.com/planner77/masterGantt/pull/817), `pull_request` Ready `FINAL_FULL`, branch `feat/issue-816-gantt-row-density`. 확인된 연결 Full PR CI는 아래 **1회/1attempt**이며 별도 Fast #130.1은 SKIPPED; 기존 누적 원장 없어서 첫 작성.
- [원본 Full CI #3314.1, Run 40284101069 / Attempt 1](https://github.com/planner77/masterGantt/actions/runs/40284101069) (2026-10-26 07:09:53~07:32:41 UTC), **FAIL**. Head `ced5fbf3ef99ba4f3d52bfeed2fc84e87b4e53c4`, base `cd010d6bcff26f10ad00c42cdf3528b851519938`, test merge `46426d99588d037637bef1d97a27e4efcead09e2` (parents base/head, tree `d00447aff59f692357685a238c6cf4d386926785`). [원본 source artifact](https://github.com/planner77/masterGantt/actions/runs/40284101069/artifacts/12632684852).
- Main↔branch 비교: ahead 2 / behind 0 / `mergeable=true` (원본 분석 시점). 미해결 Codex P2 review 1건 [#4374759680](https://github.com/planner77/masterGantt/pull/817#discussion_r4374759680)·GraphQL thread `PRRT_kwDOUUB7Bc6wKoAZ` 발견. 작업 후 재검사 필요.

| 원본 실행 | 직접 실패 | Required Quality/Docker | Required E2E/QA Automated | 분류 |
| --- | --- | --- | --- | --- |
| `40284101069.1` | F816-001 Shard3 FAIL; F816-002 Shard6 최종 CANCELLED이나 내부 실제 FAIL | PASS/PASS | FAIL / FAIL(파생) | TEST_CONTRACT / UNKNOWN(hit) |

### 모든 E2E Shard별 실제 결과

| Shard · Job ID | 최종 Job | 실제 테스트·원본 근거 |
| --- | --- | --- |
| [3/8 · 121444542220](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121444542220) | FAIL | **98 PASS/1 FAIL/1 SKIP/42 DID NOT RUN**, [Playwright report](https://github.com/planner77/masterGantt/actions/runs/40284101069/artifacts/12634058353), F816-001 |
| [6/8 · 121444542208](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121444542208) | **CANCELLED** | 내부 step에서 **63 PASS/1 FAIL/1 SKIP/33 DID NOT RUN** 확인, F816-002; [timing artifact](https://github.com/planner77/masterGantt/actions/runs/40284101069/artifacts/12633878924). 최종 취소를 PASS로 변경하지 않음 |
| 1/8 · 121444542331, 2/8 · 121444542186, 4/8 · 121444542227, 5/8 · 121444542243, 7/8 · 121444542439, 8/8 · 121444542234 | CANCELLED | 접근한 각 Job 로그상 추가 직접 assertion FAIL 미발견. 일부 실행 완료가 있었더라도 해당 Job 전체 PASS 아님 |
| [Required Quality 121445157171](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121445157171), [Docker 121445317198](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121445317198) | PASS/PASS | 원본 exact Head의 typecheck/lint/unit/policy/build·Docker smoke 성공 |
| [E2E aggregate 121450933831](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121450933831), [QA Automated 121450970008](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121450970008) | FAIL/FAIL | 집계는 shard fail/cancel의 **파생**. QA는 `NEED_E2E=failure`로 **파생 실패**, independent QA NOT TESTED·Manager ACCEPT 없음 |

### F816-001 — Shard3 #637 고정 스크롤 지시가 실제 최대 범위 초과

- **원본 직접 에러:** 2026-10-26 07:31:48 UTC, `tests/e2e/projection-row-alignment.spec.ts:82:42` Day, 실패 line110. `expect.poll(coreTop).toBe(2400)`, 실제 `2287`, 5초. [Job 원본 로그](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121444542220). 80 synthetic + 기존 visible 총83행이 34px × 83 = 2822px가 되어, 1440×900 사용 가능 Y scroll은 2400보다 짧다. 브라우저가 허용 최대 위치로 clamp한 사실과 합치한다.
- **판정:** `TEST_CONTRACT` 직접 확정. 이 실패만으로 실제 Grid↔Chart Y 중심 오류, virtualized Task 누락이나 제품 bar hit 악화를 증명하지 못한다. 후속 assertion 미도달을 PASS로 계산하지 않는다.
- **보완:** `.wx-gantt.scrollHeight-clientHeight`를 실제 브라우저에서 읽고 `[300,1200,maxTop,0]`를 검사, `maxTop>1200`을 강제하여 깊은 가상행 구간 검증을 남긴다. `native-scroll-virtual-budget` JSON 첨부. Grid X=120, Core/owner/chart scrollTop 정확동일, virtual mounted ID·bar pairs·Grid Y0/±1px/strict negative/recovery 단언은 그대로. Codex P2 review와 동일 원인 교정.

### F816-002 — CANCELLED Shard6 #492 내부 Hover 실제 실패

- **원본 직접 에러:** 2026-10-26 07:32:01 UTC, `tests/e2e/project-task-hover-tooltip.spec.ts:89` 시나리오의 line100 **첫 Chart bar hover**에서 `waitForGanttReadiness`가 5초 동안 `HOVER_TARGET_NOT_HITTABLE`만 반환. [Job 로그](https://github.com/planner77/masterGantt/actions/runs/40284101069/job/121444542208). 첫 번째 동일 Grid+Chart canonical 툴팁 case는 Shard6에서 PASS였다. 이 실패는 Shard3 집계 파생이 아니라 **Shard6 자체 실제 단언 실패**다.
- **판정:** `UNKNOWN`(실제 제품 hit rectangle/overlay 또는 테스트 준비 시 native 위치 경합). `elementFromPoint`의 실제 occluder identity·좌표 trace가 최종 cancel로 보존되지 않았으므로 확정된 근본 원인으로 '제품'/'flaky'를 단정하지 않는다.
- **제한적 보완/검증 후보:** Chart bar에만 최초 `scrollIntoViewIfNeeded` 다음 **한 번** `scrollIntoView({block:"center",inline:"center"})` 배치하여 중앙에서 실제 bar hit를 검사하는 fixture prep을 추가. 기존 real `elementFromPoint`/U3/3RAF/native scroll settlement, `hover()`·canonical Tooltip contents, Week/Fullscreen/WBS/readonly/close·mutation0 검증은 그대로이며 retry/skip/assertion/timeout 완화 없음. 새 정확 Head Chromium 통과 전 F816-002 **해결 미확정**; 재발 시 non-cancelled trace·occluder hit-test 확보해 별도 제품 보완 판단.

## 종합 진단 / 선택 테스트 / 문서·다음 게이트

- **A→C:** 원본 Full PR 1건과 Fast skipped, 모든 8개 Shard 실제 Job logs, 독립 Quality/Docker·E2E 집계·QA 파생과 한 개 P2 리뷰를 대조. F816-001은 새 cellHeight와 이전 2400 상수의 테스트 계약 충돌, F816-002는 별개의 실제 Hover blocker(원인 UNKNOWN)로 분리. 앞선 historical #637 38px/31px 및 #667 tooltip history를 이번 source PASS로 재사용하지 않는다.
- **D/E/TEST_LIFECYCLE_REVIEW:** 원래 실패 2개 spec **EXTEND**. #375 `project-summary-bar-visual.spec.ts`의 Summary 비율/조작/터치, #637 strict negative·virtual/selection, #492 canonical·hit·close 및 독립 Editor/Drag/Resize/Focus의 KEEP_UNIQUE 경계 유지. 새 test 폐기/skip/timeout/retry/CI shard 설정 변경0. 기존 #816 AC1/3/4 수용 여부는 다음 실제 E2E 필요.
- **F:** 원본 Required Quality/Docker만 원래 Head PASS. 새 수정 source 로컬 실행 환경 접근 불가: TypeScript/Vitest/Next/Playwright/Chromium/SQLite/실기기 **NOT TESTED**. 새 CI와 QA/Owner가 이전 결과를 대체했다고 선언하지 않는다.
- **G:** 본 이슈별 누적 원장, [Work Packet](exec-plans/active/ISSUE_816.md), [active PLAN](exec-plans/active/PLAN.md) 및 두 E2E spec 갱신. `docs/TEST_PLAN.md` 및 `docs/PROJECT_UX.md`의 기존 #816 공식 제품·AC 계약은 변경 없음. 리뷰 P2 응답·resolve 및 main 충돌 확인 후 수정 Head로 Ready Full PR CI를 새로 시작한다. 새 Run/Attempt·HEAD 확인만 하고 **지속 모니터링·병합/Main/GHCR/Finalizer/Issue 종료 금지**.
- risk_level `HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=true`, `release_authorized=false`, `MERGE_READY=BLOCKED`. F816-002 occlusion 미확정, 실제 before/after px·native touch/125%/Chrome Full·Trusted/Owner QA 미검증을 잔여 위험으로 보존한다.
