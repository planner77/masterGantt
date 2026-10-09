# Issue #530 Resource KPI 통합 회귀와 사용자 가이드

## 2026-10-09 PR #566 CI #2282.1 — Milestone #463 진단 속성 미존재 회귀 보완

- [PR CI #2282.1 / run 37879481685](https://github.com/planner77/masterGantt/actions/runs/37879481685)에서 **제품 문제였던 #530 nested E2E shard6은 SUCCESS**. Chromium shard2의 기존 #463 milestone viewport 회귀는 `JSON.parse(null).count` 예외로 FAIL. [해당 Playwright report](https://github.com/planner77/masterGantt/actions/runs/37879481685/artifacts/11593194720)의 `public-viewport-events`는 restore marker=null이지만 Core/native left120 일치, Gantt API instance=svar-api-1 및 필터 후 vertical0 동기화로 기록한다.
- 명시적 peer 복원 action을 발행하지 않아 원래 위치가 유지될 때 디버그 `data-gantt-peer-restore`가 설정되지 않은 것이므로, 부재를 `restore count 0`으로 해석하는 테스트 자료 정합성 수정. 기존 '복원 요청 중복 호출 없음' 검사는 유지하고, 검색 필터 적용/초기화 뒤 API identity·public/native horizontal120 보존·vertical alignment까지 검사한다. 보이는 행 수가 줄어드는 필터의 세로 clamp는 정상이며 과거 96 고정으로 오판하지 않는다.
- 수정 대상: `tests/e2e/milestone-dashboard-state.spec.ts`, `docs/TEST_PLAN.md`, 본 실행 계획. 신규 Head에 대해 전체 required quality/E2E6/Docker CI 재검증. 테스트 skip/retry/timeout 증가나 제품 입력 보호 로직 변경은 없다.
- `v0.103.1` 후보와 Issue #530 OWNER 정식 GHCR 승인은 유지하며, PR CI와 새 merge SHA Main CI 통과 이전엔 게시/Issue Close를 주장하지 않는다.

## 2026-10-09 Main CI #2280.1 재실패 — 지연 native 스크롤 재덮기 보완

- **정확한 실패 근거:** Issue #530 [Main CI #2280.1](https://github.com/planner77/masterGantt/actions/runs/37876071912), merge SHA `e1e6e2558481fe01d9f7e57c0148288f77a884de`는 TypeScript/ESLint/Vitest/Next.js, Docker 실제 smoke, Chromium 1~5/6 PASS. Chromium shard 6/6의 #530 nested LIFO pop/clear 1 FAIL, 82 PASS, 1 SKIP로 E2E aggregate FAIL, 임시 GHCR image job SKIPPED.
- [Playwright shard6 report/trace](https://github.com/planner77/masterGantt/actions/runs/37876071912/artifacts/11593006119)의 `nested-frame-return-first-pop` 관측에서 기대 Core/native left240, 최종 left0. 동일 SVAR API instance·columns·selection·tree 유지. capture Core/native240 및 명시적 `scroll-chart(240)` 성공(count1/public240/dom240) **이후** `scroll-chart(0)` 명령이 발생. 이전 metadata epoch+pending lease+12rAF만으로 늦은 command를 완전히 차단하지 못했음.
- **제품 보완:** 설치된 SVAR Gantt 2.7.3의 공식 `api.intercept('scroll-chart')`를 사용해, 명시적으로 복원한 nonzero 좌표를 동일 API/visible scope/filter/scale/columns/grid/root geometry에서 우선 보호한다. 그 이후 새 사용자 입력 없이 다른 left 명령이 들어오면 Core action 전에 취소하고, 임의의 시간 만료를 두지 않는다. 실제 Gantt 차트·그리드 영역 내부의 pointerdown/wheel/keydown/touchstart, 화면 숨김·범위·레이아웃 변경만 보호를 해제한다. Task Editor·툴바·타 패널 등 Gantt **외부 입력은 복원 보호를 해제하지 않는다**. [PR #566 Codex P2 리뷰](https://github.com/planner77/masterGantt/pull/566#discussion_r4226332007)를 반영했다. 사용자의 Task 탐색 및 좌측 끝까지 수동 스크롤을 방해하지 않음.
- **회귀:** 기존 120/240px strict Core+native/instance/columns/selection/tree 복귀, 12rAF 후 재검사, 늦은 scroll-chart(0) 0건은 그대로 유지한다. nested pop/clear 완료 후 wheel(-240) 사용자 입력으로 Core/native left0에 도달하는 양방향 테스트를 추가한다. 첫 번째 pop 직후 Gantt 외부 프로젝트 제목 클릭을 끼워 넣어 복원된 public/native240이 12rAF 뒤에도 유지되는지 strict 검사한다. 우회용 timeout/skip/retry/expected 변경 없이 기존 #514/#525/#538 및 E2E6·Quality·Docker required gate 유지.
- **버전 및 승인:** 기존 메인 후보 0.103.1은 아직 immutable v0.103.1 tag/Release 미발행이다. Generic Release Finalizer의 같은 Issue 인접 non-docs corrective coalesce는 가장 오래된 first-parent(0.103.0) → 최종 version(0.103.1)을 비교하므로 이번 추가 보완도 버전 0.103.1을 유지한다. 이미 확인된 [Issue #530 0.103.1 OWNER 정식 GHCR 승인](https://github.com/planner77/masterGantt/issues/530#issuecomment-6073180869)을 재사용한다. 새로운 Main CI/GHCR exact digest 검증 전 PASS로 주장하지 않는다.
- **검증 경계:** 이번 보완의 신규 PR Head CI 및 독립 QA, Manager 병합 판정은 해당 증거 확보 전 NOT TESTED다. 새 PR 품질 검사를 완료한 뒤에만 Main 병합을 추진한다.
## 2026-10-09 PR #564 CI #2270.1 중첩 복귀 실패 재보완

- 이전 Head `74cc35c45aa22f734adb59ebde4f63ac64882e73`의 [CI #2270.1](https://github.com/planner77/masterGantt/actions/runs/37869484841)은 Quality·Docker·Chromium 샤드1~5 PASS, **shard6의 #530 nested frame pop 복원 1 FAIL/82 PASS/1 SKIP**로 전체 실패. 기대 left240, 실제 Core/native left0, 다른 상태는 동일.
- [shard6 Playwright report/trace](https://github.com/planner77/masterGantt/actions/runs/37869484841/artifacts/11590201108)에서 캡처된 Core/native240과 명시적 `scroll-chart(240)`의 실제 적용(count1/public240/dom240)을 확인했으며, 그 직후 오래된 `scroll-chart(0)` 재적용을 발견했다. 이전 PR 제품 patch는 복원 직전에만 epoch를 무효화해 **동시에 새로 발생하는 metadata-only 요청**을 막지 못했다.
- 메타데이터-only 복원과 명시적 peer 복원을 구별한다. Resource 복귀 요청의 layout 단계부터 queue drain/복원/최종 DOM frame 안정화까지 **pending lease**를 유지하고 그동안 metadata-only capture/execute를 차단한다. 향후 메타데이터만 변경될 때는 새 lease 없이 정상 복원할 수 있다.
- nested pop 회귀의 middle240/원래 origin120 및 snapshot·instance·selection·columns·tree strict equality를 유지하고 12rAF 뒤 중첩 재검사, 늦은 `scroll-chart(0)` 0건, 실패 시 debugger 자료 영수증을 추가한다. 0.103.1 후보 버전 유지, 테스트를 skip하거나 timeout/threshold를 완화하지 않는다. 새 Head 독립 QA 및 전체 PR CI는 별도 판정 전 NOT TESTED. 병합·Main CI·GHCR/Release 미수행.

## 2026-10-09 PR CI #2267.1 실패 — 실제 viewport 재덮기와 PATCH 보완

- PR #564 정렬 head `87b8c1cff06c4b2d5b950fdf9dbef043766e77c1`의 [PR CI #2267.1 / Run 37867259587](https://github.com/planner77/masterGantt/actions/runs/37867259587)은 completed/failure. Quality(TypeScript·ESLint·Vitest·Build)와 Docker aggregate, Chromium 샤드 1~5 PASS. **Chromium shard 6/6**에서 `tests/e2e/resource-kpi-integration-ui.spec.ts:314` 실제 #530 viewport 복귀 1 FAIL/82 PASS/1 SKIP: 초기/복귀 capture 모두 Core/native `left=120,top=0`이었으나 복귀 최종 Core/native가 `left=0`이었다. 원래 Gantt instance·선택·열·트리는 보존됐다.
- 보존된 Playwright `fixed-geometry-exact-drill` attachment와 trace의 `data-gantt-public-scroll-events`를 대조하면 peer restore `scroll-chart(120)`이 실제 성공하고 `data-gantt-peer-restore={count:1,requestedLeft:120,publicLeft:120,domLeft:120}`까지 기록된 **이후에 다시 `scroll-chart(0)`이 명시적으로 발생**했다. 따라서 단순한 assertion 지연이나 복원 누락이 아니라, 메타데이터-only 동기화가 이전 scope에서 캡처한 0 좌표를 나중에 복원한 우선순위 경합이다.
- 제품 PATCH: `project-gantt.tsx`에서 metadata-only viewport 요청에 `peerEpoch`를 함께 저장하고 현재 epoch와 같을 때만 적용한다. 명시적인 Resource/peer 복원 직전 epoch를 증가시키며 앞선 메타데이터 요청의 listener/참조를 폐기한다. 정상 메타데이터-only 보존은 유지하면서 **과거 metadata restore가 명시적 peer restore를 덮지 못하도록** 한다. 비동기 pending queue의 target/source·scale·columns·generation·입력 취소·resize guard 및 Core/native 독립 좌표 계약은 유지한다.
- Chromium 회귀는 복귀 직후 전체 viewport 엄격 비교와 정지 후(12 animation frame) **다시 엄격 비교**하고, 명시적 peer 복원보다 늦은 `scroll-chart(0)` 이벤트가 없는지 확인한다. 사용자 입력으로 복원이 취소되는 테스트·중첩 복귀·실제 API/Excel 회귀는 유지한다. timeout/skip/retry나 CI quality gate는 완화하지 않는다.
- 최신 main은 `be17a6c098d0b7c12263d9274a66544b026b6487`의 `0.103.0`; 실제 제품 수정이므로 PATCH **0.103.1**로 올려 package/lock/CHANGELOG를 일치시킨다. 현재 Issue #530의 과거 정식 release 승인 마커는 `0.102.3` 전용이므로 0.103.1에 소급 적용하지 않는다. `release_required=true`, `release_authorized=false` (0.103.1).
- 대상 SHA의 로컬 실행/완전한 Chromium 결과와 새로운 독립 QA는 별도 증거가 없으면 **NOT TESTED**이며 새 정확한 Head의 full PR CI를 등록해 검증한다. 요청 범위는 보완·문서 갱신·새 PR CI 시작까지; 병합/Main CI/GHCR/Release/Issue 종료는 제외한다.

## 2026-10-09 PR #564 QA 재작업·최신 main 정렬 (새 Head CI는 별도 검증)

- **기존 정확한 Head의 CI:** [PR CI #2251.1 / Run 37858842272](https://github.com/planner77/masterGantt/actions/runs/37858842272)는 **기존 Head `55ea089d826fb616a1fa30f9fde38520ca0ae67a`**에서 2026-10-09 **08:35 KST** `completed/success`로 끝났다. Quality(TypeScript/ESLint/Vitest/Next.js build), Chromium E2E **6/6 샤드**, E2E aggregate 성공. 기존 Main #2249.1에서 실패했던 샤드 4/6은 **83 PASS**, 동일 #525 테스트는 **6.5초 PASS**였다. 이 결과는 새 정렬 Head의 성공으로 소급하지 않는다.
- **Docker 검증의 정확한 범위:** 해당 PR CI에서 `Docker build and runtime smoke test` aggregate는 **SUCCESS**였지만 실제 `Docker smoke 구현` job은 **SKIPPED**였다. 따라서 이 Head의 실 Docker runtime smoke는 **NOT TESTED**로 기록한다. 원래 Main #2249.1에서 실제 Docker 구현이 PASS한 사실과 구별한다.
- **독립 QA 지적·보완:** [PR #564의 QA_FINAL FAIL/REWORK](https://github.com/planner77/masterGantt/pull/564#issuecomment-6071312325)에서 `QA530-564-DOC-01`(본 계획 문서의 성공 Run/Head/시각/Docker SKIPPED 근거 누락)을 **차단 1건**으로 지적했다. 위 원격 증거·범위·미검증 내용을 추가한다. `QA530-564-LANG-02`(영어 주석)은 테스트 준비 설명을 한글로 변경해 처리한다. 기능 로직·실제 assertion·CI workflow·timeout/skip/retry는 변경하지 않는다. 자동 이동 종료 뒤 **고정 12 animation frames**의 연속 좌표 안정화 미확인 리스크는 비차단 관찰 대상으로 남긴다.
- **최신 main 재정렬:** 기존 공통 기준 `09e0a77222edb4652a6ca9c44c758d1c96a0e6bc` 이후 main `be17a6c098d0b7c12263d9274a66544b026b6487`에 33개 커밋, 42개 파일 변화가 반영됐다. #564 이전 PR 변경 파일 두 개(테스트·이 문서)와 **파일 경로 교집합 0**이므로 main 파일을 그대로 보존하며 두 변경을 병합한다. 현재 main application 버전은 **0.103.0**이고 #564는 테스트·문서 전용 보완으로 별도 버전 변경을 생성하지 않는다. 과거 이슈 문서의 0.102.3 버전·정식 GHCR 승인 마커는 그 시점 증거이므로 현재 main의 0.103.0 릴리스 승인과 혼동하지 않는다.
- **현재 종료점:** 이 사용자의 요청은 PR #564 최신 main 정렬·QA 지적 문서/주석 보완·새 **full PR CI 시작까지**이다. 새 head의 quality/E2E/Docker 및 독립 QA_FINAL은 별도 확인 전 **NOT TESTED**이다. 기존 QA_FINAL FAIL은 새 독립 판정 없이 PASS로 바꾸지 않는다. PR 병합·Main CI·GHCR/tag/Release·Issue 종료는 수행하지 않는다.


## 2026-10-09 Main CI #2249.1 E2E 스크롤 경합 보완

Issue #530 병합 SHA `09e0a77222edb4652a6ca9c44c758d1c96a0e6bc`의 [Main CI #2249.1](https://github.com/planner77/masterGantt/actions/runs/37856801652)은 quality/Docker 및 Chromium 샤드 1·2·3·5·6 PASS, 샤드4의 `tests/e2e/project-resource-workload-status.spec.ts` #525 회귀 1건 FAIL(82 PASS) 때문에 E2E aggregate FAIL, GHCR 임시 이미지 SKIPPED였다. Grid Task 클릭 후 Chart 자동 이동이 완료되기 전에 테스트가 수동 `scrollLeft=120`을 설정했고, 비동기 이동값 `1581`이 뒤늦게 적용되어 `{left:120,top:96}` 원장 생성 단계의 5초 poll이 실패했다. 테스트 경쟁 조건이며 화면 복귀 불변식 실패라고 확대하지 않는다.

회귀 기대값·전체 검증을 약화하지 않고, 행 선택의 native Chart reveal(>120)을 확인한 다음 canonical sync depth0/animation-frame 안정화를 기다려 수동120/수직96 baseline을 설정한다. 이후 Gantt root identity, Core/DOM/selection/columns/scale 및 돌아온 좌표 전체의 strict equality와 5폭·keyboard 검증은 그대로 보존한다. 제품/API/DB/집계 및 workflow 변경은 없다. 테스트 보완이므로 기존 application 버전 `0.102.3`을 유지하고, 새로운 정확한 Head의 PR CI 및 병합 SHA의 Main CI가 성공하기 전에는 GHCR 게시 완료를 주장하지 않는다. 코드 수정과 다른 독립 QA 검토는 실제 실행 증거로 별도 판정한다.


## 2026-10-09 최신 main 재정렬 — PR #555

기존 head `a87954a7ce76ac14e1095953486aafbb03f33e02`의 기능·검증 이력을 보존하고 main `4f2d8d084c011a33a3fbd633695f97f4b4ec5893`를 통합했다. 후보 버전은 `0.102.3`이다. CHANGELOG의 main 0.102.2와 #530 PATCH 항목을 분리하고 양쪽 문서 추가를 보존했다. #495의 Milestone 표기와 #530 frame별 Core/native viewport·canonical queue·입력 취소를 함께 유지하며, 신규 UI 테스트의 이전 접근성 이름 4종을 현행 소스와 대조해 변경했다. 기존 assertion·공수 기대값·CI gate는 삭제하거나 완화하지 않았다.

[현재 정렬 증거](../../evidence/issue530/alignment-20261009.json)는 최초 PR 실행과 구분한다. GitHub Actions 통합 준비에서 version/typecheck/변경 lint와 대상 Vitest 27개 PASS를 확인했다. 이는 전체 PR CI PASS가 아니다. 새 head quality/e2e/docker, 독립 QA, Windows Excel/DRM은 NOT TESTED다. 과거 243개/18개 실행은 아래 초기 구현 이력으로만 유지한다. 새 full PR CI 등록까지만 승인되었으며 병합·Main CI·GHCR·Release·tag·Issue 종료는 수행하지 않는다. `release_required=true`, `release_authorized=false`다.

DESIGN/AGENTS/API/DB/보안/집계/기존 CI workflow 계약 변경은 N/A다. 임시 통합 실행 workflow는 후보 tree에서 제거하고 원래 CI workflow와 required gate를 유지한다. 후보 Git 객체 생성과 PR ref 갱신을 분리하고, 게시 시 expected-head를 확인한다.

## 범위와 실행 기준

[Issue #530](https://github.com/planner77/masterGantt/issues/530)은 [Epic #522](https://github.com/planner77/masterGantt/issues/522)의 R8이다. #523~#529의 공통 집계 Domain, API, Dashboard, Milestone 비교, Resource Plan, 정확한 일정 이동, Excel을 같은 합성 데이터로 연결해 검증한다. 등록 당시의 등록-only 경계는 최신 사용자의 구현·문서·원격 게시·PR CI 시작 요청으로 전환했다.

- baseline main: `599b824677cec2daa47743a60fcac422297f925b`, tree `17f659167a0c73152a6d15b1ba46ccdf0a626ae7`.
- 작업 branch: `test/issue-530-resource-kpi-integration`, 격리 clone `/tmp/mastergantt-issue530`.
- 착수 application은 `0.102.0`이다. 실제 일정 왕복의 viewport 결함을 확인해 최소 제품 수정과 PATCH로 범위를 보완한다. 확인한 최신 main `dca2f7821f277ef31ee3dbcbdc1e51ad257209f0`의 버전은 `0.102.1`이며, 이를 통합하고 제품 PATCH `0.102.2`를 적용한다. 최신 main 통합을 완료했으며 현재 HEAD는 `dca2f7821f277ef31ee3dbcbdc1e51ad257209f0`, index는 해당 main tree다. 제품·공통 fixture·UI test/helper 실행 bytes는 보존했다.
- 제품 PATCH에 따라 `release_required=true`, `release_authorized=false`로 전환한다. 정식 릴리스 승인과 main artifact는 현재 요청 범위 밖이며 게시·PR CI 등록까지만 수행한다.
- 종료점: 구현·Local Fast Feedback → DOCUMENTATION_SYNC → 독립 PRE_QA → 원격 branch/PR → 정확한 새 head 전체 PR CI 등록. CI 결과 모니터링·병합·main/GHCR·tag·Issue 종료·브랜치 정리는 하지 않는다.

선행 이슈는 착수 시 closed이며 관련 코드가 baseline에 존재한다. 각 선행 PR의 과거 PASS를 새 후보의 PASS로 소급하지 않는다. Task/WBS KPI 확장, Milestone 화면 전면 재설계, 자동 인력 배분, 실적·금액·단가, 새 권한·DB·PRO 기능은 제외한다.

## 공통 원장과 기대값

조회 구간은 동일한 5개 유효 근무일이며 A는 G1/G2, B는 G1에 속한다. T1은 M1의 A50%/B100%, T2는 M2의 A60%, T3은 Milestone 미지정 B20%, T4는 담당 없음, T5는 G1만 직접 지정, T6은 M2의 A allocation=null이다. Summary/Milestone의 책임 관계는 개인 공수를 생성하지 않는다.

| 기준 | 고정 기대값 |
| --- | --- |
| 알려진 공수 / 미설정 | 11.5 M/D / Assignment 1건, 부분합 |
| 고유 개인 할당 Task / Assignment / Resource | 4 / 5 / 2 |
| A / B | 5.5 M/D + 미설정1 / 6.0 M/D |
| G1 / G2 | 11.5 M/D + 미설정1 / 5.5 M/D + 미설정1 |
| M1 / M2 / 미지정 | 7.5 / 3.0 + 미설정1 / 1.0 M/D |
| 개인 미배정 / 완전 미할당 / Group만 지정 | 2 / 1 / 1 Task |
| M/M | 명시적 20일 기준에서만 0.575 |
| 고유 Capacity | A5 + B5 = 10 M/D |

G1+G2의 17 M/D를 Grand Total로 쓰지 않는다. 날짜·상태·진척·전체 Ready·필터·Calendar·기준일·환산까지 같은 원장을 사용하고 원시 ID와 숫자를 비교한다. 표시 반올림 값의 합으로 대조하지 않는다. Calendar/ISO 경계·Peak·부분합·비활성·미분류 등은 명시된 파생 fixture로 검증한다.

## 파일 소유권과 역할

backend는 공통 합성 fixture, Domain 및 실제 SQLite HTTP/API 생성 XLSX 통합 테스트와 관련 서버 문서를 담당한다. frontend는 실제 HTTP seed를 사용하는 Chromium 통합 흐름·5폭·keyboard·Gantt 상태 보존과 UI 문서를 담당한다. ui_ux는 읽기 전용 UX 검토, qa_docs는 작성자와 분리된 독립 검토다. infra는 setup, CHANGELOG, 승인 후 Git/PR/CI 등록을 담당한다. Manager는 본 계획·active PLAN·사용자 가이드·요구사항·workload/role/Milestone 연결·TEST_PLAN을 작성하고 버전·단계를 판단한다. 동일 파일을 동시에 수정하지 않는다.

## 검증 및 문서 동기화

공통 fixture를 Domain → 실제 SQLite HTTP → Dashboard → API 생성 Workbook으로 연결한다. 세 가지 계층과 두 matrix, 주/월→일별→개인 Assignment, 전체 부하 참고, 정확한 일정 왕복, 동일 snapshot Export를 검증한다. 조회만으로 원본·revision이 변하지 않고 재시작 후 같은 identity를 유지해야 한다.

OR/AND와 같은 Assignment 필터, T0/A 분모, 미설정/null/유효0, 진척과 계획 공수 불변, full Ready, 권한·Origin·If-Match·stale·foreign ID·예산·기존 Export/Workload를 다룬다. 성능 수치는 합성 데이터·실행 환경·관측 범위를 함께 기록하고 보장으로 확대하지 않는다.

390/768/1024/1440/1920px에서 실제 populated 표·내부 scroll·header/identity·focus를 확인하고 정상/empty/no-result/error/stale/readonly 전환과 Gantt 인스턴스·선택·viewport 등 기존 보존 계약을 검증한다. screenshot만으로 keyboard/state PASS를 주장하지 않는다. 공식 SVAR URL/API 확인과 실제 demo 조작은 구별하며 Core 2.7.3을 유지한다.

RESOURCE_KPI_DASHBOARD 사용자 가이드에는 팀 Milestone→개인 Task, 개인 주/월→전체 과투입 원인, 개발 Role/등급→동일 범위 Excel, 네 종류 진단 구분·보완 경로를 포함한다. API/ARCHITECTURE/SCHEDULING_ENGINE/SECURITY/EXCEL_EXPORT/PROJECT_UX/UI_UX_GUIDELINES/REQUIREMENTS/ISSUE_56_RESOURCE_WORKLOAD/ISSUE_414_ROLE_WORKLOAD_DASHBOARD/MILESTONE_STAGE_GATES/TEST_PLAN/PLAN/CHANGELOG를 실제 영향에 따라 갱신하거나 N/A 근거를 남긴다. DESIGN·AGENTS·DB·Import·VBA·배포·HTTP·CI gate 불변은 별도 확인한다.

## 실제 통합에서 발견한 결함

고정 1440px Chromium 실행에서 원래 일정의 Core/DOM 수평 위치240이 Resource의 정확한 Task 범위로 이동한 뒤 복귀하면0으로 바뀌었다. 최소 재현에서도120→0이며 API instance·선택·열·트리는 유지됐다. 임시 일정에서 pop할 때 현재0 좌표를 원래 peer 기록으로 재캡처하는 원문 관측을 보존했다. 테스트 기대값을0으로 낮추지 않는다.

각 navigation frame의 source와 destinationBefore에 Core/native viewport를 별도로 보존하고, pop/clear는 복귀 대상의 불변 기록을 사용한다. 실제 canonical queue가 같은 Project·scope/filter·canonical 객체·reset·reader/API identity·layout을 검증한 후 새로운 복귀 요청을 처리한다. 일반 탭 capture와 queued 입력 취소·geometry·stale 검증을 유지하며 중첩 복귀·전체 해제·대기 중 입력 취소를 검증한다.

## 현재 단계

구현과 최신 main 통합·PATCH 반영을 완료했다. Local Fast Feedback은 신규 backend15·관련205·frontend23 Vitest, 실제 Next HTTP1, 브라우저17(신규 실제7/기존 실제2/기존 mock8) PASS다. 별도 실제 Next API1개를 합치면18개다. 통합 후 typecheck·version·diff·Markdown153·root/외부 cwd 테스트 발견도 PASS다. DOCUMENTATION_SYNC PASS다. 독립 PRE_QA는 동결 후보의 별도 보고서와 Issue/PR에 기록한다. 새 원격 quality/e2e/docker와 QA_FINAL/Manager ACCEPT도 NOT TESTED이며 CI 등록 후 결과를 조회하지 않는다. Windows Excel/DRM, 실제 OS 125%, screen reader, 운영 배포는 별도 NOT TESTED다.

## 실행 증거와 검토 범위

[통합 검증 원장](../../evidence/issue530/integration-validation.json)과 [브라우저 source 영수증](../../../output/playwright/issue530/source-evidence.json)을 따른다. 신규 viewport unit12와 기존 Core/native3·navigation8을 합쳐 frontend23개이며 backend220개와 중복 없이 총243개다. 브라우저17개는 실제 UI7·기존 실제2·mock8이며 별도 API1개를 더해18개다. 기존13개 실행, 추가 기존drill3개, 신규 직접flow1개의 별도 영수증을 보존하고 반복 실행을 고유 개수에 더하지 않는다. 최초 제품240/120→0 실패와 수정 후120→120, nested120/240 방문 복귀를 구분한다. 실제 wheel 후 Core30/DOM31을 각각 유지하고 resize1024×768 후0/0을 유지했으며 원래120이 재적용되지 않았다. 정상 target canonical Task IDs 갱신은 계속 적용된다.

5폭 PNG10개와 geometry18관측은 실행 당시 application0.102.0 증거다. 최신 main 통합 뒤0.102.2 screenshot이라고 보고하지 않으며 보호된 제품·테스트 bytes 동일성으로 재사용한다. 실제 원장의 수직좌표는0이므로 nonzero 수직 브라우저 복원은 NOT TESTED이며 pure unit의 Core97/DOM96 비교와 구분한다. UI/UX 최종 검토 재개는 모델 capacity로2회 실행 불가였고 독립 qa_docs가10PNG·geometry·keyboard·상태·source 비교를 인수해 해당 범위PASS를 확인했다. 기존 ui_ux 설계·geometry 정책 검토도 별도PASS다.

추가 직접flow1개는 T1과Assignment2 기간만2026-09-28~10-02로 이동한 파생 데이터에서 M1→Resource→지연KPI→정확한T1 일정→Resource→M1을 확인했다. actualasOf2026-10-08/selectedknown7.5/Task1/Assignment2/지연1 및 canonical/revision 불변PASS다. 기존UI spec32,454bytes prefix와 제품·fixture/helper가 불변이므로 이전13개 증거는 그 실행 당시 범위로 재사용하며, 새1개는 candidate0.102.2의별도12.0초PASS다. Source-bound POST report와 같은 binding detail을 사용한다.
