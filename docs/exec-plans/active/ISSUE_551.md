# Issue #551 — compact Milestone Timeline / 날짜·레이아웃 동기화

## 2026-10-13 — CI #2613.3 대형 fixture readiness 재발 교정 (source Head df1d5a14)

- [PR CI #2613.3](https://github.com/planner77/masterGantt/actions/runs/38303775005) / run_id 38303775005 attempt3 / Head `df1d5a14c8ef2d41b32c8d6cdd90cd01424c7ec8`: TypeScript, ESLint, Vitest, Next build, Docker, Chromium shards1/2/3/5/6 PASS; shard4(job115005654126) 129 PASS, 1 FAIL(대형 Task1000+Milestone2000, `milestone-timeline-lane.spec.ts:60` 5초 준비 검사). E2E 집계 FAIL, QA Automated BLOCKED는 종속 실패이며 Trusted QA의 이전 attempt2 artifact 누락과는 별도다.
- 기존 `installMilestoneProbe`는 SVAR `init(api)` 즉시 등록했지만, E2E 준비 predicate가 단지 `instance`를 확인하려고 `probe.read()` 전체를 매번 실행했다. `read()`는 Core derived `_tasks` 상위500개·링크 상위500개·scale rows·canonical IDs 및 이벤트 배열을 매 호출 수집한다. 3000건 렌더 부하가 있는 Chromium에서 불필요한 동기 work와 readiness gate를 결합한 불안정성을 확인했다. 이번 로그만으로 시간 초과가 probe 부재/동일성 불일치/렌더 지연 중 어느 원인인지는 미확정이다.
- 개발 전용 객체에 단순 `instance: instanceId` 필드를 추가하고 Playwright readiness는 native `data-project-gantt-api-instance`와 해당 필드의 정확한 동일성 및 `read` 함수 존재만 5초 안에 확인한다. `read()` 기능/결과·일반 기능 검증·SVAR API identity·3000개 fixture·5초·전체 E2E 6 shard/±1px/skip0/retry0은 유지한다. production/DB/API/Calendar/scroll/UX 불변.
- 검증: 소스 대응 정적 확인 및 신뢰된 CI 전체 재실행 필요. 로컬 Chromium/Unit 직접 실행 환경 미확보 시 NOT TESTED로 유지한다. 이전 attempt2 PR CI PASS는 현재 시도 및 새 Head 검증을 대체하지 않는다. HIGH/OWNER_MANAGED, Owner ACCEPT/Trusted QA/merge/main/GHCR는 새 공식 증거 전 BLOCKED/NOT TESTED.


## 2026-10-13 — 최신 main #639 통합 기준

- 신규 main `5da9c039422647490a947c5cd1e80ec24df22db2`는 이전 `5c79b658c83b86f163826055fa7da6efadef4e63` 이후에도 #639의 Main CI merge-title 검증·문서 및 운영 도구 수정이 추가된 상태다. 기존 Issue #551 base `b97709df8b5c0974f3c8252ac97819f45f73a5b9`와 별개로 최신 main 변경을 두 번째 merge parent로 통합해 보존한다.
- 공통 CHANGELOG/TEST_PLAN/PLAN의 양측 추가 기록을 순서대로 포함하고, Resource KPI 회귀 검증은 이미 latest main의 #639 semantic locator 버전을 채택한다. AGENTS/CI workflow/Finalizer/복구 스크립트는 latest main 그대로 유지한다.
- 본 PR의 새 diagnostic bootstrap·E2E identity·문서 변경만 추가한다. 최신 통합 Head의 required full PR CI/QA Final 및 Owner ACCEPT는 새 run 결과 확인 전 NOT TESTED. main/GHCR/Issue 종료는 수행하지 않는다.

## 2026-10-13 — Full PR CI #2605.1 대형 fixture 진단 초기화 실패 보완

- 원본 [Run #2605.1](https://github.com/planner77/masterGantt/actions/runs/38299775278), 정확한 HEAD `2986c418870ae624a43a1a6aef5f3af0fb4efb81`: QA Preflight/TypeScript/ESLint/Vitest/Build/Docker 및 Chromium shards 1·2·3·5·6 PASS. Shard 4(job114979723093/step7)는 128 PASS / 1 FAIL / 1 skipped; 단일 실패는 `tests/e2e/milestone-timeline-lane.spec.ts:164`의 1000 Task+2000 Milestone fixture 준비 시 개발 `__masterganttMilestoneTimeline` probe 존재 확인이 5초 내 완료되지 않은 것이다. E2E aggregate 및 QA Automated FAIL은 종속 판정이다. 직전 #2603.1 Resource KPI strict selector 오류는 이번 shard5에서 재발하지 않았다.
- [원본 Playwright report](https://github.com/planner77/masterGantt/actions/runs/38299775278/artifacts/11770946451) trace의 화면에는 3000개 작업 상태, Gantt Grid 및 `data-project-gantt-api-instance=svar-api-1`가 존재한다. 따라서 로딩/HTTP 실패나 native API 전무라고 판단하지 않는다. 프로브의 등록은 `useLayoutEffect([apiInstanceId])`에만 묶여 있어 대형 React projection/render와 별도로 `init(api)`가 이미 호출된 뒤에도 표시 프레임에 probe가 제때 연결되지 않을 수 있는 초기화 순서 경계다. 정확한 내부 스케줄링 원인은 CI 계측만으로 미확정이며 해당 경계를 제거한다.
- 보완: 개발 전용 `installMilestoneProbe(api,instanceId,frame)`를 안정적인 lifecycle 보유 객체로 만들고, SVAR `initialize(api)` 콜백에서 즉시 설치한다. React commit/layout effect는 StrictMode mount/cleanup과 API 교체의 재등록 안전망이다. 인스턴스/프레임 ID가 같은 경우 중복 이벤트 리스너를 설치하지 않고, old API 분리·DOM 프로퍼티 소유권 검사·영구 리소스 cleanup을 보장한다. production에서 진단 훅은 계속 설치하지 않으며 제품 UI/스크롤/계약은 변경하지 않는다.
- 회귀: `tests/e2e/milestone-timeline-lane.spec.ts`의 동일 5초 readiness 검증을 `data-project-gantt-api-instance`와 dev probe `read().instance`의 identity 동등성으로 강화한다. 기존 1000+2000 fixture, peer/tab/Grid splitter/fullscreen/scroll, native plot ±1px, 390~1920px, no canonical mutations, Task selection 등 원래 assertions는 변경하지 않는다. `timeout` 상향·retry/skip·fixture 축소/분할은 하지 않는다.
- 현재 `main`은 #639 CI·Finalizer·Resource KPI locator 업데이트를 포함해 `5c79b658c83b86f163826055fa7da6efadef4e63`로 전진했다. 기존 base `b97709df8b5c0974f3c8252ac97819f45f73a5b9` 대비 공통 문서와 Resource KPI 테스트의 양측 변경을 보존하며 main의 #639 계약·권한·워크플로 동작을 되돌리지 않는다. 오래된 base의 PR CI는 유효한 최신 검증이 아니다.
- 범위: 제품 변경은 dev-only probe 설치 순서/cleanup, 회귀 테스트/관련 문서다. `AGENTS.md`, `DESIGN.md`, `docs/SCHEDULING_ENGINE.md` 등 시스템 설계/스케줄링/DB/API/Security는 계약 불변으로 N/A이며 최신 main 문서는 그대로 승계한다. exact-head TypeScript·E2E·Docker/QA_FINAL/Owner 승인·병합/Main CI/GHCR/Issue 종료는 새 run 성공 결과 확인 전 NOT TESTED. `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `release_required=true`, `release_authorized=false` 유지.


## 2026-10-13 — CI #2603.1 #525 Resource Dashboard 중복 KPI 버튼 locator 회귀

- [원본 full PR CI #2603.1](https://github.com/planner77/masterGantt/actions/runs/38296891101), 정확한 HEAD `3f39ba6d5788fc5d8a8ae81f18ce515b45f13ee4` / main `b97709df8b5c0974f3c8252ac97819f45f73a5b9`: QA Preflight, TypeScript/ESLint/Vitest/Build, Docker 및 Chromium shard1/2/3/4/6 SUCCESS. Shard5(job114970191274/step7)는 97 PASS·1 FAIL, E2E aggregate 및 QA Automated는 이 실패로 연쇄 FAIL이다.
- 단일 실패는 `tests/e2e/resource-dashboard-ui.spec.ts:35`, #525 실물 SQLite/HTTP Resource Dashboard. `선택 범위 KPI`의 두 정상 KPI 항목인 `할당 Task`, `공수 미설정`이 모두 `2건`이어서 Playwright가 `strict mode violation: resolved to 2 elements`를 반환했다. 이는 Milestone 날짜축 회귀와 별개이며 제품의 잘못된 2건 집계·버튼 중복 렌더링 버그라고 단정할 증거가 아니다.
- 보완: 기존 KPI 라벨 `할당 Task`의 직접 자식 metric 행을 고유하게 찾아 내부의 `2건` 버튼만 열도록 `tests/e2e/resource-dashboard-ui.spec.ts` selector를 강화한다. 기존 상세 응답 `view=tasks`, `totalCount=2`, 공동 Task 1회, 읽기전용·필터·진단·revision·external refresh 검증은 전부 유지한다. `.first()`/`.nth()`로 잘못된 KPI 버튼을 선택하거나 타임아웃·검증 의무를 완화하지 않는다.
- 문서 영향은 `docs/TEST_PLAN.md` 및 이 Work Packet 업데이트, 제품/기준정보/UI·데이터/API/DB/보안/CI workflow/버전은 불변으로 N/A. 기존 `## DOCUMENTATION_SYNC`, `## AC_TEST_COVERAGE`는 그대로 보존하며 QA Preflight 통과 후 exact HEAD의 전체 PR CI 검증이 필수다. 이 커밋에 대한 직접 로컬 Chromium 실행은 GitHub API만 이용한 범위에서 NOT TESTED, QA Final/Owner ACCEPT/merge/Main CI/GHCR는 요청 범위 밖이다.

## 2026-10-13 — PR CI #2600.1의 공유 #549 reveal 회귀 REWORK

- 요청 범위: 실패 원인 분석·보완·기존 PR #560의 새 exact-head 전체 PR CI 시작. 새 CI 결과 모니터링·병합·main/GHCR·release·Issue 종료·branch 정리는 수행하지 않는다.
- 기준 Head `301579a838865ab5f100824f10ccb9986bb9fbd4`, base `b97709df8b5c0974f3c8252ac97819f45f73a5b9`, test merge `65299d512135264b7d44dc23200f569c217fd24d`. [원본 CI #2600.1](https://github.com/planner77/masterGantt/actions/runs/38264149134), run38264149134/attempt1은 FAIL이다. quality job114862916192와 Docker job114863071170, Chromium 다른 5 shard는 PASS다.
- 기존 실패였던 shard4의 #551 lane19/19 및 #464 교환2/2는 모두 PASS(전체129 PASS/1 skipped). 이번 실패는 shard5 job114862093885/step7의 `milestone-timeline-core.spec.ts`: 5폭 `coordinate.visible=false`, DST exact calendar left 기대에 30px 차이, Milestone-only reveal `TIMED_OUT`의 7 FAIL이다. shard5는91 PASS/7 FAIL이며 QA Automated job114870347998의 FAIL은 E2E 필수 aggregate 실패에 따른 연쇄 판정이다.

원본 실패 artifact는 [playwright-report-shard-5 /11754906161](https://github.com/planner77/masterGantt/actions/runs/38264149134/artifacts/11754906161), ZIP SHA256 `779c70f3cb9f0a039e70cc3790554d75220ad76dfbdd34d818163ac779eac023`(9,609,548 bytes)다. 경로 검증 후 `/tmp/issue551-ci2600-shard5/`에 데이터로만 추출했다. trace의 synthetic cookie/body/header 등 원문은 Git/Issue/PR에 게시하지 않는다. 진단 보고서는 `/tmp/issue551-ci2600-diagnosis.md`이며 새 CI 실행 증거와 구별한다.

### 원인·교정 계약

앞선 #2595 보완에서 공유 개발 probe의 calendar `revealMilestoneDate`를 `DIAGNOSTIC_DATE_REVEAL`로 대체하여 기존 `nativeDateReveal`과 같은 native `scroll-chart({date})`를 실행했다. #549에서 이미 관측한 native date와 calendar-day bar의 차이를 교정 경로에 재도입했으며 boolean 반환도 `ViewportOutcome`으로 바뀌었다. lane19개만 실행하여 공유 Core9개 회귀를 놓친 검증 범위 결함도 인정한다. 이 오류를 native 오차에 맞춘 기대값 변경이나 timeout 확대로 숨기지 않는다.

개발 `reveal`은 단일 adapter의 calendar `contentX`와 실제 native 날짜축 가시성을 읽어, 이미 실제 보이는 날짜는 이동하지 않고 화면 밖 날짜는 기존 `DIAGNOSTIC_SCROLL(left)`의 coordinator 경로로 보낸다. 기존 custom filter는 production projection receipt와 다르므로 native date/projection receipt 경로로 억지 통합하지 않는다. 기존 진단 scroll 분기의 Core/native 정착에 최대3회 bounded repair를 한정하여 추가하며 새 command·production DATE_REVEAL·별도 scroll writer·private Core store write는 도입하지 않는다. 현재 intent/visibility/capacity/취소·숨김·stale 검사를 유지한다. 진단 보정 예산은 기존 peer/restore 예산과 분리하며 production에서는 진단 보정을 거부한다. 진단 요청 도중 revision/projection generation이 바뀌면 취소한다. native Chart 논리 plot 가시성과 좁은 화면의 외부 wrapper clip을 구별해 이미 보이는 날짜에 재명령하지 않는다. 축 오른쪽 끝 날짜는 실제 최대 scroll offset 안에서 reveal하되 canonical contentX/anchor는 그대로 유지한다. `nativeDateReveal`은 원형 오차 비교용으로 별도 유지한다.

Core 테스트의 Milestone-only 성공 반환은 새 `SETTLED` 계약으로 명시하되 0행/날짜 insideRange+visible/축 비축소/canonical·revision 불변 검증을 유지한다. DST exact calendar left±1px·반복 in-view 무이동과 5폭 Day/Week·no-loss 조건은 유지한다. #551 lane19개를 함께 재검증하여 반대 방향 회귀를 검사한다.

### 로컬 원형·중간 후보 실패 보존

- frozen 실제 dependencies/default Turbopack의 원형 Core9는7 FAIL/2 PASS(47.7초)로 원격과 같은 실패 목록을 재현했다. `/tmp/issue551-core-before.log`와 `/tmp/issue551-core-before-evidence/`에 보존한다.
- 첫 numeric 후보의 Core+lane28은22 PASS/6 FAIL(1.1분)이다. DST/Milestone-only는 복원됐지만 far-right 날짜의 `contentX`가 native 최대 scroll을 넘어 기존 진단 명령이 거부됐다. `/tmp/issue551-core-lane-after.log`, `/tmp/issue551-core-first-candidate-evidence/` 보존. axis 안 날짜의 target만 native capacity로 제한하고 canonical contentX/anchor는 유지했다.
- 다음 후보는23 PASS/5 FAIL(1.6분), lane19 전부 PASS다. 마지막2027-01-01의 진단은 기존 #367 `RANGE_EXTENSION`이 같은 rangeController를 갱신해 `SUPERSEDED`였으나 실제 날짜는 visible=true(contentX37332/nativeleft37167/viewportX165)였다. 추가했던 geometry5개의 `SETTLED` 반환 검사가 원형 조건보다 강한 잘못된 oracle였다. 이 신규 assertion만 제거하고 원래 visible/좌표±1px/행·no-loss 조건 및 outcome attachment를 유지한다. 기존 날짜축 취소 동작을 바꾸거나 SUPERSEDED를 성공 영수증으로 해석하지 않는다. `/tmp/issue551-oct13-terminal-oracle-evidence/`에 원형 report/trace/log를 보존했다.
- 실제 독립 Reviewer는 이 판정을 검토했다. Milestone-only/lane의 SETTLED, DST exact calendar-left±1px·반복 scroll-chart event 불변, 원래 geometry assertions는 유지한다. 최종 Core9+lane19 실행 전까지 위 중간 기록을 PASS로 대체하지 않는다.

### Work Packet·소유권·위험

- Manager: 본 Packet/PLAN/CHANGELOG/ARCHITECTURE/MILESTONE_TIMELINE/TEST_PLAN, 문서 영향 분석, 공식 Issue 댓글 및 게시 GO.
- frontend `/root/frontend_fix`: `project-gantt.tsx` 개발 probe, `viewport/viewport-coordinator.ts` 및 `svar-viewport-port.ts`의 기존 개발 진단 scroll 분기, `milestone-timeline-core.spec.ts` 및 직접 관련 Unit. 다른 production command/receipt 정책 변경 금지.
- infra `/root/ci_diagnosis`: 원격 실패 job/log/artifact read-only 진단 및 최종 GO 뒤 기존 branch의 expected-parent/force=false 동등 게시·exact Head CI 등록만 확인. source/docs/Issue 댓글 쓰기 금지.
- 독립 Reviewer `/root/independent_review`: 요구·source/test/docs·실제 로그의 read-only PRE_QA. 최종 QA/Owner 승인과 구별한다. 모든 Agent는 소유권 밖/동일 파일 동시 쓰기·무단 재귀 위임을 하지 않는다.
- risk_level=HIGH / qa_required=true / qa_method=OWNER_MANAGED. 공유 viewport 진단과 반복 회귀 영향으로 HIGH 유지. version0.107.0/package/lock 불변, release_required=true/release_authorized=false.
- 재개 초기 phase=REWORK이며 최종 Local Fast Feedback/PRE_QA는 아래 실행 원장을 따른다. 새 Head quality/e2e/docker·QA_FINAL·Owner/Manager ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED. 앞선 PASS/실패 원장은 보존한다.

### 최종 Local Fast Feedback와 인계

- 실제 frozen dependencies(Node22.14.0/npm11.10.0, Next16.3.8/React19.3.0/Playwright1.63.0/Core2.7.3/store2.7.2), default Turbopack/fresh dist `.next-issue551-final-oct13`, Chromium America/New_York, workers1/retries0, synthetic canonical API. 최종 고정 source의 Core9+lane19 전체28/28 PASS(표시1.5분, exit0), skipped0/retry0. 고유28개이며 중간/원형 실행을 고유 테스트 수에 더하지 않는다.
- 직접 Unit4파일117/117 PASS(522ms, exit0): viewport coordinator/port·Milestone date adapter/lane model. 지연 native 보정·3회 상한/receipt-null·gesture/hidden/context/revision/projection 취소·capacity 축소·진단/peer 예산 분리·production 진단 보정/명령 거부·ordinary repair 보존을 검증했다.
- typecheck exit0, 변경 소스/테스트6파일 scoped ESLint error0/기존 hook warning3, 마지막 변경 test2파일 재검사 error0/warning0. version0.107.0·Markdown191파일·diff check PASS. 서버 종료 후 Next가 생성한 next-env/tsconfig는 원래 HEAD byte로 복원하여 게시 대상에서 제외한다.
- 최종 로그 `/tmp/issue551-oct13-verified-browser.log`, `/tmp/issue551-core-final-unit.log`, `/tmp/issue551-oct13-final-typecheck.log`(generated 복원 뒤 exit0), `/tmp/issue551-oct13-lint.log`, `/tmp/issue551-oct13-final-tests-lint.log`. report/trace는 `/tmp/issue551-oct13-verified-evidence/`, 최초/중간 FAIL은 위 원장을 따른다. runtime DB·server log·원문 trace·build 산출물은 게시하지 않는다.
- 실제 분리된 frontend 구현, infra 진단, Manager의 최종 browser/정적 검증, qa_docs의 read-only 계약·소스·문서·로그 대조로 실행했다. 독립 PRE_QA와 최종 source freeze는 게시 전 별도 확인한다. 문서 동기화 후 정확한 동결 tree만 기존 PR에 게시하며 원격 full CI 등록까지만 확인한다.
- #464는 이번 교정 source 영향이 없는 실제 서버 통합이다. 원본 #2600의2/2 PASS를 그 Head의 증거로 보존하며 새 Head의 원격 회귀 PASS로 재사용하지 않는다. transport 근인 UNKNOWN과 전체 AC/실기기 미검증은 계속 남긴다.
- lifecycle_phase=LOCAL_VALIDATED → DOCUMENTATION_SYNC → PRE_QA → PR_CI_STARTED(각 단계 실제 근거 후 전환). 새 Head quality/e2e/docker/QA_FINAL/Owner·Manager ACCEPT/main/GHCR/정식 release는 NOT TESTED, MERGE_READY=BLOCKED.

실제 독립 Reviewer `/root/independent_review`의 범위 한정 PRE_QA는 PASS/추가 blocker0이다. 검토 manifest SHA256 `87ce867020e6bb7f2d970811f07c81b708da7a535f7d6cbe3a47687b97cca49f`의12/12 bytes/SHA256/base64·allowlist·기준 HEAD와 generated 복원 byte 일치를 대조했다. HTML report의 report.json에서28 expected/unexpected0/flaky0/skipped0/errors0, Unit117 및 typecheck/lint 원문을 직접 확인하고 link191/version/diff 검사도 독립 실행했다. browser/Unit을 별도로 재실행한 것은 아니다. 본 영수증은 source 변경 없는 후속 metadata1문단이다. DOCUMENTATION_SYNC=PASS, 게시 준비 PRE_QA=PASS이며 새 원격 QA_FINAL·Owner/Manager ACCEPT와는 별개다. 원격 동등 게시와 정확 Head full PR CI 등록까지만 수행하도록 Manager가 인계한다.

### 이번 DOCUMENTATION_SYNC 영향

MILESTONE_TIMELINE/ARCHITECTURE/TEST_PLAN/PLAN/본 Packet/CHANGELOG는 UPDATED 대상으로 공유 calendar reveal·진단 정착·회귀 범위를 동기화한다. DESIGN/PROJECT_UX/UI_UX_GUIDELINES는 제품 배치·interaction·접근성 변경이 없어 이번 교정 영향 N/A이며 PR 전체의 기존 UPDATED 기록은 유지한다. API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/IMPORT_EXPORT/IMPORT_SCHEMA/PRO_FEATURE_MATRIX는 서버/도메인/표시 adapter 공개 범위 불변으로 추가 변경 N/A다. AGENTS/CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS는 QA/CI/권한·release 계약을 변경하지 않아 N/A다. workflow/package/lock/required check/Ruleset·timeout/retry/skip/±1px/fixture를 유지한다.

## 2026-10-12 — PR CI #2595.1 반복 실패 분석·보완

- 요청 범위: 원인 분석·관련 코드/테스트/문서 보완·기존 PR #560의 새 full CI 시작. 새 CI의 결과 모니터링, 병합, main/GHCR/Release, Issue 종료 및 브랜치 정리는 수행하지 않는다.
- 기준 Head `b25bb4e72c1f769d47ec3b7f03c9a31740ac299b`, base `b97709df8b5c0974f3c8252ac97819f45f73a5b9`, test merge `3be6f67c08312631058cefd70dc96fcdfff65497`. [원본 CI #2595.1](https://github.com/planner77/masterGantt/actions/runs/38258293115) / attempt1 / shard4 job114842184289 / step7: 123 PASS, 6 FAIL, 1 skipped. quality, Docker 및 다른 Chromium 5 shard PASS. E2E aggregate FAIL에 따른 QA Automated FAIL은 독립 원인으로 합산하지 않는다.
- #551 5폭(390/768/1024/1440/1920px)은 `milestone-timeline-lane.spec.ts:345`의 `observed.anchor=null`로 FAIL. 직전 #2594.1의 3018~3036px 오차와 대형 probe 준비 실패, 초기 #2217.1의 17px 폭 guard 및 #2234.1의 TS18048과 구별한다. #2595.1의 대형 1000 Task+2000 Milestone case는 PASS다.
- 별도 #464 `milestone-stage-exchange.spec.ts:223`은 copy POST 200 후 canonical GET `ECONNRESET`. 원본 diagnostics는 generation1/alive/exit null, readiness 200(17ms), cgroup OOM 0이며 요청 observer 기록은 비어 있다. 서버 종료·OOM·제품 API 결함 또는 단순 flake로 확정할 수 없다. 직전 #2594.1의 같은 테스트는 PASS(49.9s)였다. 원본 오류를 재시도로 숨기지 않고 실패 직전 요청과 lifecycle/health/resource 관측을 보강한다.
- 실제 역할: Manager(범위·문서·통합), `infra`(원격 실패 증거 read-only), `frontend`(Gantt 및 lane 회귀), `backend`(#464 요청 관측), 별도 `qa_docs`(read-only PRE_QA). 기존 worktree를 보존하고 `/tmp/mastergantt-issue551-ci-fix`의 exact remote Head에서 작업한다. 원격 로그/trace의 쿠키·runtime DB·민감한 원문 로그는 Git 또는 Issue 댓글에 복사하지 않는다.
- 위험도 HIGH / qa_required=true. 기존 PR의 OWNER_MANAGED 경로와 별도로 실제 독립 PRE_QA를 수행하며, 이를 새 Head의 원격 QA_FINAL 또는 Manager ACCEPT로 확대하지 않는다. package/lock `0.107.0`은 현재 main 통합본 그대로이며 release_required=true/release_authorized=false를 유지한다.

### 원인과 보완 범위

Day→Week의 실제 관측에서 Core `scrollLeft=7218`/날짜 `contentX=7218`로 state-only `visible=true`였지만 `.wx-scale` 원점 `-9737px + contentX7218px = -2519px`로 대상 날짜는 화면 밖이었다. 실제 축을 기준으로 그리는 lane은 tick을 올바르게 clip했고 기존 probe `revealMilestoneDate()` 호출은 상태 가시성만 보고 이동을 생략했다. 개발 probe만 canonical queue/현재 API/표시 문맥/날짜 범위 확인 후 기존 `DIAGNOSTIC_DATE_REVEAL` coordinator를 사용하도록 바꾼다. 순수 adapter의 기존 in-view 무이동 계약과 production lane geometry/clip은 유지한다. 테스트에는 실제 `SETTLED` 결과와 좌표 diagnostic attachment를 추가하고 기존 null/±1px/row/hit/focus/instance/mutation assertions를 보존한다.

#464의 `createProject()`에 기존 `observeIsolatedApi`를 주입해 Project 생성/GET/mutation/edit-session 호출을 기록한다. operation은 한 번만 실행하며 오류를 그대로 rethrow한다. 실패 순간 수집은 기존 fixture의 정규화 route/status/request ID 및 lifecycle/health/resource allowlist를 사용한다. 재시도·HTTP status 우회·API/domain 변경은 없다. transport 근인은 UNKNOWN으로 남는다.

### 로컬 환경과 최초 실패 보존

- 최초 Node22.14.0/npm11.10.0/Next16.3.8, 기존 node_modules 외부 symlink 조건에서 변경 전 5폭은 4 FAIL/1 PASS였다. 진단 attachment 후 warm 재실행 5 PASS는 최초 FAIL을 무효화하지 않는다.
- 같은 symlink의 webpack 환경에서 보완 suite는 첫 혼합 실행17 PASS/2 FAIL, 이후 cold 단독 실행18 PASS/1 FAIL(1.5분). 실패들은 대형/displayMode fixture의 probe 준비5초 timeout이며, 5폭 날짜 geometry 통과와 별개다. `/tmp/issue551-first-full-failures/`, `/tmp/issue551-final-cold-failures/`에 원형을 보존한다. 테스트 실행 중 CPU 경합·개발 HMR이 있었으나 근인을 단정하지 않는다.
- #464 로컬 원형의 최초 loopback EPERM은 sandbox BLOCKED이며 승인 후 실행했다. 외부 node_modules symlink는 기본 Turbopack의 `Symlink [project]/node_modules is invalid, it points out of the filesystem root`로 시작 BLOCKED였다. 임시 webpack fixture의 원형2 FAIL은 Next `load-manifest.external.js`의 `Unexpected end of JSON input`/HTTP500이며 원격 ECONNRESET 재현이 아니다.
- CI와 같은 lockfile의 `npm ci --no-audit --no-fund`를 실제 node_modules 디렉터리에 실행해447 packages/13초/exit0을 확인했다. package/lock 변경 없이 기본 Turbopack·fresh dist에서 다시 검증한다. 이전 환경의 PASS/FAIL·미검증을 이 실행으로 소급 변경하지 않는다.

### 최종 Local Fast Feedback

- 환경: 실제 frozen dependencies, Node22.14.0/npm11.10.0, Next16.3.8/React19.3.0/Playwright1.63.0/Core2.7.3/store2.7.2. 기본 Turbopack/fresh dist, workers1/retries0. `frontend`의 lane 전체19/19 PASS(58.3초), 같은 소스 5폭 각2회10/10 PASS(30.6초). 고유19개에 반복10개를 더해 고유29개로 합산하지 않는다. 대형 fixture 준비·peer/Grid/fullscreen도 PASS다. 로그 `/tmp/issue551-turbo-lane.log`, `/tmp/issue551-turbo-geometry-repeat.log`; 원형 report `/tmp/issue551-turbo-full-evidence/`.
- `backend`의 #464 실제 SQLite/HTTP 원형2/2 PASS(81.147505초), 관측 보완 실제 spec2/2 PASS(74.724009초), skipped/flaky0. 동일 수정 없는 repository isolated fixture/default Turbopack이며 임시 config는 shared mock webServer만 생략하고 출력 경로를 격리했다. 원형 실행 복사본은 import 경로만 절대화했다. `/tmp/issue551-transport-local/result.json`에 실행 시각/조건/hash, `/tmp/issue551-transport-native-{baseline,final}.log`에 원본을 보존한다. 시간 차이로 성능 개선을 주장하지 않는다. ECONNRESET 미재현이며 근인 UNKNOWN이다.
- 실제 frozen 환경의 직접 Unit3파일17/17 PASS(248ms): `isolated-application-diagnostics.test.ts`7개 + `milestone-timeline-adapter.test.ts`5개 + `milestone-timeline-lane-model.test.ts`5개. `npm test -- tests/server/e2e/isolated-application-diagnostics.test.ts tests/features/gantt/milestone-timeline-adapter.test.ts tests/features/gantt/milestone-timeline-lane-model.test.ts`로 실행했다. `/tmp/issue551-frozen-unit17.log` 보존. 이전 frontend Unit10과 중복 합산하지 않는다.
- `npm run typecheck`, 변경된3파일 ESLint, version check0.107.0, 문서 링크191파일 및 diff check PASS. ESLint error0/기존 hook warning3이며 warning을 해소하거나 새 warning0으로 과장하지 않는다. Next 자동 생성 next-env/tsconfig 및 #464 자동 캡처PNG는 원형으로 복원했고 runtime DB/빌드/로그/trace는 게시 대상에서 제외한다.
- source SHA256: `project-gantt.tsx`=`4b8f5fa767777bdcd1f85bcf7a628ac8073dc1189e560ef3e6b5bad45c685d58`, `milestone-timeline-lane.spec.ts`=`2a92395780cb72e9330f1e6e7fffa3a15b13f3256c8048193741f64c2d3ce349`, `milestone-stage-exchange.spec.ts`=`19c62430a7461f205f3fd07b4fe79bb09001380e1d1a5877681bbf0529676424`. 독립 Reviewer는 같은 source와 원본 로그를 대조한다. 새 Head 원격 quality/e2e/docker·QA_FINAL·Manager ACCEPT는 NOT TESTED다.

### DOCUMENTATION_SYNC 영향 분석

이번 보완의 UPDATED 문서는 MILESTONE_TIMELINE, ARCHITECTURE, TEST_PLAN, active PLAN, 본 Work Packet, CHANGELOG다. PROJECT_UX/UI_UX_GUIDELINES/PRO_FEATURE_MATRIX의 기존64px/44px/실제축/같은 인스턴스 계약은 그대로다. DESIGN/AGENTS는 시각 언어·역할 불변으로 N/A, API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/IMPORT_SCHEMA/IMPORT_EXPORT는 서버/원장/Calendar/교환 계약 불변으로 N/A다. CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS/DEPLOYMENT는 workflow·6 shards·권한/Ruleset/배포 계약을 변경하지 않아 N/A다. 원격 실패 원인과 로컬 실행 기록은 TEST_PLAN 및 본 문서에 보존한다.

Manager의 코드·문서 영향 대조 및 링크/version/diff 검증으로 DOCUMENTATION_SYNC PASS다. 다음은 실제 분리된 `qa_docs`의 범위 한정 PRE_QA와 exact diff 게시이며 새 CI 결과는 모니터링하지 않는다. 최초 실패/환경 한계/transport UNKNOWN을 없애거나 전체 Lifecycle 완료로 판정하지 않는다.

독립 Reviewer 실제 실행ID `/root/independent_review`는 baseline/base 대비9파일 diff, Issue AC1~AC10, 원본 CI 안전 진단·직접 LFF 로그, 문서와 새 PR 본문을 읽기 전용으로 대조해 범위 한정 PRE_QA PASS/추가 blocker0을 반환했다. 검토 당시 freeze9/9 SHA 일치/drift0, manifest SHA256 `ab3db3557c085d9fb681636e8cc070742fde15a68660ff8ea3aa2907a64d64db`다. 뒤에 추가한 본 검토 영수증은 source 변경이 없는 metadata 기록이다. 독립 재실행을 고유 테스트 수에 추가하지 않는다. 이는 게시 준비 검토이며 새 Head의 공식 원격 QA_FINAL·Owner/Manager ACCEPT·MERGE_READY 성공 판정이 아니다. 사용자 요청에 따라 원격 게시 및 exact Head full CI 등록 후 모니터링 없이 인계한다.

## 2026-10-12 — PR CI #2594.1 Chromium shard4 실패와 exact-head 수정

- [전체 Run #2594.1](https://github.com/planner77/masterGantt/actions/runs/38253274533), HEAD `442564b7e14c24b49358351fb55e30c7ecd31230`: QA Preflight, 정책, TypeScript, ESLint, Vitest, Next.js production build, Docker, Chromium shard 1/2/3/5/6 PASS. Chromium shard 4/6은 123 PASS / 6 FAIL / 1 SKIP이며 전체 E2E·자동 QA FAIL. 이 실행 결과를 다른 HEAD의 성적으로 승계하지 않는다.
- 실패 5건은 `tests/e2e/milestone-timeline-lane.spec.ts:340`의 390/768/1024/1440/1920px native Task anchor ↔ sibling lane tick ±1px 검증으로, 실제 차이 3018/3018/3036/3028/3024px였다. 허용오차가 잘못된 것이 아니라 Chart의 실제 렌더링된 좌표계와 앱 lane이 Core 상태 scrollLeft만 사용한 좌표계가 서로 어긋나는 것을 실증했다. 원인이 된 Core/DOM scroll 이벤트 순서 전체는 별도 계측 전 확정하지 않는다.
- 수정은 공개 설치 Core의 canonical date `contentX` 변환을 유지하되, read-only 실제 DOM `.wx-scale`의 렌더링된 X원점을 같은 Chart plot 기준으로 측정해 `axisOrigin + contentX`를 lane tick/cluster에 사용한다. Chart DOM scroll 자체도 mount-scoped observer로 구독하고 cleanup한다. native header/bar와 별도 날짜 Tick을 같은 실제 축에 정렬하되 서버·canonical 일정·private Core store/선택 상태는 변경하지 않는다.
- E2E에서 기존 native Task bar ↔ lane tick ±1px assertion을 보존하고, 독립 원점 `.wx-scale.getBoundingClientRect().x + contentX` ↔ lane tick ±1px 검증을 추가했다. 5개 실제 폭과 Day/Week, peer/scroll/grid/fullscreen·same Gantt instance/zero writes의 기존 검증 조건을 완화하지 않는다.
- 별개 FAIL `milestone-timeline-lane.spec.ts:53`은 1000 Task+2000 Milestone 첫 로딩 후 개발 전용 `__masterganttMilestoneTimeline` 진단 인터페이스가 5초 이내 설치되지 않은 조건이다. Trace에는 3000 원본 Task와 Grid 화면이 보인다. 진단 등록을 passive effect 대신 React layout commit에서 수행하도록 바꿔 후속 passive 작업 대기 경계를 제거했다. 5초 제한·대량 fixture·timeout/retry/skip 정책은 변경하지 않는다.
- Chrome trace/스크린샷과 해당 shard의 원래 FAIL 증거는 Run artifact `playwright-report-shard-4`로 보존. 로컬 Node/Chromium 실행은 이 GitHub 연결 환경에서 NOT TESTED. 모든 새 수정은 exact HEAD의 새 전체 PR CI에서 TypeScript·Vitest·ESLint·Chromium·Docker를 재검증하며 결과/Owner ACCEPT·main 병합/GHCR는 시작 시 NOT TESTED다.

## 2026-10-12 — 후속 main #616 동기화

- 구조 QA 수정을 준비하는 도중 `main`이 `1dc89522192ae2c64c6951c282116a0a34af3a13`에서 `b97709df8b5c0974f3c8252ac97819f45f73a5b9`로 전진했다. #616 Target/Template 계약·DB migration0026 및 애플리케이션 버전 `0.107.0`은 최신 main의 내용이며 #551에서 되돌리지 않는다.
- #551 브랜치의 69개 변경 경로와 이 기간의 main 39개 변경 경로를 비교해 양쪽이 변경한 4개 공통 문서(CHANGELOG, ARCHITECTURE, TEST_PLAN, active PLAN)를 본문·검증 기록을 보존하는 방식으로 합쳤다. 나머지 서로 독립인 코드 및 신규 DB/API/테스트 파일은 현재 main 버전을 유지한다.
- 이 작업은 Milestone opt-in lane의 추가 기능 구현 자체를 변경하지 않는다. 최신 버전의 Gantt/DB/UX 통합 테스트는 새 full PR CI 결과 전 NOT TESTED이며 기존 #2244.1 성공을 재사용하지 않는다. release_required=true, release_authorized=false; merge/main CI/GHCR/Issue 종료는 수행하지 않는다.

## DOCUMENTATION_SYNC

현행 `scripts/qa_final_automated.py`의 `docs_gate` 형식에 따른 PR #560의 변경 경로별 판정이다. `UPDATED`는 이 PR diff의 실제 문서 변경, `N/A(reason)`는 불변 계약을 뜻한다. 의미 타당성 및 QA Final은 별도 판정이며 구조적 기록만으로 완료·승인을 선언하지 않는다.

- `DESIGN.md`: N/A(제품 공통 시각 언어와 semantic token 및 44px 접근성 기본 원칙은 유지하며 Timeline 세부 배치는 프로젝트 UX 지침에 이미 반영)
- `docs/TEST_PLAN.md`: UPDATED
- `docs/SCHEDULING_ENGINE.md`: N/A(이번 변경은 앱 표시용 Week 구간과 Timeline 좌표 계층이며 canonical scheduling 알고리즘 및 서버 Calendar 연산은 변경하지 않음)
- `docs/MILESTONE_TIMELINE.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/PRO_FEATURE_MATRIX.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_551.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `AGENTS.md`: N/A(기존 에이전트 역할과 Source of Truth 및 공통 QA 운영 원칙 변경 없음)
- `docs/API.md`: N/A(신규 API route 및 canonical Revision·session·authorization 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite 테이블, migration 및 Milestone 데이터 저장 형식 변경 없음)
- `docs/SECURITY.md`: N/A(기존 편집 권한·세션·Origin·If-Match 및 조회 권한 계약 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(전체 canonical import 및 export 모집단과 기존 형식·출력 계약 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(교환용 JSON 스키마 및 Milestone 원본 ID 관계 계약 변경 없음)

## AC_TEST_COVERAGE

각 AC는 Issue #551 수용 기준의 원문을 유지한 식별자이다. 아래는 추적 가능한 테스트·증거와 미검증을 연결하는 기록이며, 전 항목 최종 PASS 판정이 아니다. `#2244.1`의 성공은 이전 정확 HEAD `81f8143e` 한정이고, `#2592.1`은 메타데이터 사전검증 FAIL로 실제 테스트 미실행이다. 신규 통합 HEAD에서 다시 실행해야 한다.

- AC1: `tests/e2e/milestone-timeline-lane.spec.ts`의 `#551 public ISO interval date/header semantics independent oracle` 및 5폭 `opt-in sibling lane`에서 native anchor와 Timeline tick의 실제 x좌표 ±1px assertion; `tests/features/gantt/week-calendar-interval.test.ts` Gregorian/ISO week 경계.
- AC2: `tests/e2e/milestone-timeline-lane.spec.ts`의 `enabled slot preserves peer Chart height/scroll and fullscreen Grid/resize alignment`, `dynamic axis/latest native horizontal scroll`, Day/Week 5폭 검증. Grid 개별 열 표시·숨김의 직접 assertion은 NOT TESTED이며 후속 #552로 인계.
- AC3: `tests/e2e/milestone-timeline-lane.spec.ts`의 `opt-in sibling lane` 390·768·1024·1440·1920px에서 native row 높이·Grid/Chart 중심 Y ±1px, ON 64px lane 및 OFF 후 동일 instance/공간 반환 관찰.
- AC4: `tests/features/gantt/milestone-timeline-lane-model.test.ts` 클러스터·clip·anchor 비변경, `tests/e2e/milestone-timeline-lane.spec.ts` 같은 날짜·근접 날짜 50개 paging·긴 이름/접근성 이름·focus, mixed-date guide 및 clipping 후 focus 회복.
- AC5: `tests/e2e/milestone-timeline-lane.spec.ts` `full population empty vs date viewport and Task-only filter stay independent` 및 `milestone-only` fixture, `milestone-timeline-lane-model.test.ts`의 미정/잘못된 날짜·물리 화면 밖·전체 0/viewport 0 구별.
- AC6: `tests/e2e/milestone-timeline-lane.spec.ts` singleton 및 cluster `exact-ID Editor return`, `dynamic axis/latest native horizontal scroll and Task pointer selection`에서 Task selection checkbox 보존·가짜 POST/PATCH 없음. 전체 clipboard 복사·붙여넣기 시나리오는 NOT TESTED.
- AC7: `tests/e2e/milestone-timeline-lane.spec.ts` singleton guide의 hover/focus 및 실제 Task bar elementFromPoint·context menu·checkbox 간섭 없음. Task 전체 drag·resize·Dependency hit-area 포괄 회귀는 NOT TESTED로 #552/#553에 인계.
- AC8: `tests/e2e/milestone-timeline-lane.spec.ts` ON/OFF, milestone-only dirty Editor, 동일 instance와 synthetic canonical API의 posts/patchRequests 0 검사. 실제 서버 revision/GET/authorization/SQLite 회귀는 NOT TESTED.
- AC9: `tests/e2e/milestone-timeline-lane.spec.ts` peer 복귀·Grid resize·dynamic scroll에서 settled viewport와 새 사용자 scroll 유지, `project-gantt.tsx` bounded projection queue 로직. stale 복원 queue와 경쟁하는 전 사용자 gesture 조합의 완전 재현은 NOT TESTED.
- AC10: `tests/e2e/milestone-timeline-lane.spec.ts`의 5폭×Day/Week 실제 Chromium anchor/row/focus bbox 검증, cluster keyboard/Home/End/Escape 및 390px touch emulation. Grid 열 hide 및 document scrollWidth 직접 검증, 실물 터치·screen reader는 NOT TESTED; #552 후속 검증 대상.

## 2026-10-12 — PR CI #2592.1 실패 원인 및 재실행 경계

- [Run #2592.1](https://github.com/planner77/masterGantt/actions/runs/38250992819) / exact HEAD `a9bfdcd3dfec892fe3260deda7bcc0d67a90de72`: QA Preflight `PRIMARY_ISSUE` FAIL. PR 제목 `(#551)`가 신뢰된 `main` 검증기의 `Issue #N` 필수 정규식을 충족하지 않았다. Quality/E2E/Docker required aggregate는 사전검사 실패로 FAIL, 실제 TypeScript/Vitest/E2E/Docker 구현 Job은 SKIPPED. 따라서 앱 결함이나 원격 회귀 PASS/FAIL로 해석하지 않는다.
- PR 제목 `feat: Issue #551 Milestone Timeline lane과 Week 구간 표시 구현`으로 갱신하고 Issue #551 원문 수용 기준 체크리스트 10개에 AC1~AC10 식별자만 부여하였다. `Refs #551`은 PR 본문에서 단일 선언이며 HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false는 유지한다.
- 기존 Work Packet의 서술형 DOCUMENTATION_SYNC·테스트 증거는 그대로 보존하고, 이번에는 현재 검증기에서 읽을 수 있는 두 개의 정형 section과 AC별 부분 검증·미검증을 위에 추가하였다. 관련 변경의 최신 `main` SHA `1dc89522192ae2c64c6951c282116a0a34af3a13`이며 후속 push는 새 exact HEAD의 전체 PR CI 시작만 승인한다.
- PR title edited 이벤트로 실행될 수 있는 metadata-only 검증은 실패한 기존 full run을 대체하지 않는다. 새 HEAD TypeScript/Quality/E2E/Docker/Trusted QA·Manager ACCEPT/merge/Main CI/GHCR는 실제 원격 확인 전 NOT TESTED; 기존 #552 stacked PR은 따로 정렬한다.

## 2026-10-12 — 최신 main 정렬 및 PR CI 재실행 준비

- 최초 #551 HEAD `81f8143e7887e10885a8a4268f3ec79e9f0e5d38`의 PR CI [#2244.1](https://github.com/planner77/masterGantt/actions/runs/37852680599)는 Quality/E2E 6 shard/Docker 모두 SUCCESS였다. 이 결과는 현재 새 통합 tree의 검증 결과가 아니다.
- 최신 main 기준 `1dc89522192ae2c64c6951c282116a0a34af3a13`에 #551 변경 71개 경로를 3-way 합쳤다. 직접 미충돌 59개, 양측 변경 12개 중 문서/Workspace/CSS 10개는 변경 의도를 통합했고 package.json/package-lock.json은 현재 main의 0.106.2 값을 유지했다. 구버전 후보 0.105.0을 재부여하지 않는다.
- #550 PR #559는 main 병합 및 Issue 종료 완료다. 기존 stacked base/구버전/당시 NOT TESTED 문장은 원래 구현 시점의 역사적 증거이며 현재 상태가 아니다. 후속 #552 PR #561은 #551을 기반으로 하므로 #551 정렬 이후 별도 정렬·회귀 검증이 필요하다.
- 이번 작업의 범위는 main 정렬·충돌 해결·새 exact-head PR CI 시작까지다. 통합 HEAD 기준 로컬 TypeScript/Chromium/QA Final·Owner ACCEPT/병합/Main CI/GHCR/태그/Issue 종료는 별도의 증거 전 NOT TESTED. `release_required=true`, `release_authorized=false`를 유지한다.

## Issue Work Packet

- issue: https://github.com/planner77/masterGantt/issues/551, Epic #548 MT3. 최신 OPEN/comments0, 조회된 branch 없음. 등록-only 과거 문구는 최신 #549~#553 구현·PR CI 시작 요청으로 대체한다.
- phase: ANALYSIS → PLAN → VERSION_DECIDED → BRANCH_READY → IMPLEMENTING → LOCAL_VALIDATED → DOCUMENTATION_SYNC → PRE_QA → PR_CI_STARTED.
- live main: 08ac7749efc4544dfc125853d9e58ef3a9d56b21 /0.102.1.
- predecessor: #550 PR #559 https://github.com/planner77/masterGantt/pull/559, head31345da9346dfbdc1ac02e4e7ca567edafec775f, tree dfbed320c9f63b04a6bb025dd080a350f368b8a8 /0.104.0. exact-head CI37806909407/2216.1 등록 확인, 결과 미조회/NOT TESTED.
- baseline/parent: 31345da9346dfbdc1ac02e4e7ca567edafec775f. 선행 미병합이므로 stacked base feat/issue-550-milestone-management를 사용한다. main 통합/선행 CI PASS로 과대 표시하지 않는다.
- branch/worktree: feat/issue-551-milestone-timeline-lane / /home/planner/Dev/masterGantt-worktrees/issue-551. infra가 exact parent에서 fresh branch를 만든다.
- version: Manager 후보 MINOR0.104.0→0.105.0, 새로운 날짜 Timeline capability 추가. package/rootlock/CHANGELOG는 Manager 소유.
- release_required=true / release_authorized=false. 요청 endpoint PR CI 등록까지만, CI 결과 모니터링/merge/main/GHCR/tag/Issue 종료/cleanup 비범위.

## AC / scope / non-scope

#549의 전체 canonical Milestone 모집단·단일 date adapter와 #550 동일 Editor/관리 gateway를 재사용한 앱 소유 compact lane을 준비한다. 실제 기본 행/빠른 보기 전환은 #552이므로 현재 M native 행·빠른 보기를 유지하고 #551 lane의 기본 활성화는 하지 않는다. 동일 Gantt 인스턴스의 opt-in component interface와 development-only 실제 browser 실험 경로로 검증한다. production 코드의 lane capability는 구현하지만 테스트 제어 hook은 production에 생성하지 않는다.

Chart plot의 실제 x원점·폭·date axis·가로 scroll을 공유하고 Grid 대응 header 공간과 모든 row y/height를 일치시킨다. 한정된 lane 높이/같은 날짜 cluster/근접 label overlap/긴 이름/많은 marker/clip/전체0·viewport0·invalid 날짜를 구별한다. 날짜 anchor를 이동시키지 않는다. native button과 접근 가능한 cluster 목록, keyboard/Enter/Space/목록 방향키/Home/End/Escape/focus, 선택 삭제·날짜 변경·타Project·OFF overlay 정리·dirty/pending/stale를 다룬다. 전체 E(M)에서 가시 일반 Task 강조만 허용하고 Task multi-selection/clipboard와 marker identity를 분리한다.

hover/focus/선택 하나의 pointer-events:none guide line만 제공한다. 기존 Task pointer/context/drag/resize/Dependency hit area와 날짜 tooltip을 유지한다. Day/Week, scroll/resize/Grid열변경/fullscreen/dynamic 확장/상위탭복귀·M-only·Task0·same revision edit response를 같은 Gantt API와 canonical queue에 통합한다. hidden/zero-size를 정상측정으로 저장하지 않고 observer/listener/RAF는 bounded cleanup, 새 사용자 scroll/selection이 stale restore보다 우선한다.

**필수 선행 gate**: #549 독립 QA의 Week 월·연도 헤더 의미 FAIL(2027-01-01 위 July2026, 2026-03-10 위 November2025). 원인/변경 전 baseline NOT TESTED. native anchor±1px만으로 gate 통과 불가. 같은 Gregorian canonical date와 실제 Day 셀/ISO week 구간/월·연도 header boundary를 대조하는 actual E2E oracle을 먼저 확보하고 원인·지원 대안을 검증한다. DST/윤일/월말/연말/scroll/resize/scale/dynamic 포함. 해결 전 lane 좌표 표시를 활성화하지 않는다. 비공개 Core store 수정/PRO 구현 복제/DOM scroll 강제/새 패키지/버전변경/remount로 해결하지 않는다.

비범위: #552 production preference·행 제거·quickview 교체, 새로운 server/API/DB/Membership/Ready/scheduling algorithm, PRO markers/DnD/새 관계 graph, #497 미구현 복합 scope/M root, #556 툴바 전면 정돈, 새로운 Timeline Export.

## ownership / delegation / docs

- Manager: Packet/PLAN/package/rootlock/CHANGELOG, 단계·version·activation 경계·interface 조정, DOCUMENTATION_SYNC 판정, 공식 Issue 댓글.
- infra: branch 준비와 최종 GO 후 API exact tree/commit/ref→public fetch/local equality→stacked PR→exact-head CI 등록 metadata. 제품/docs/version 쓰기와 CI 결과조회 금지.
- ui_ux: read-only DESIGN/공통UX/Issue 기반 배치·높이/marker·cluster interaction·keyboard/focus·5폭 설계와 최종 실제 evidence 비교. 현재 48/88px 후보를 실측 승인 예산으로 간주하지 않는다.
- researcher: read-only 공식 SVAR Core/public geometry/filter/scroll/markers 경계와 설치2.7.3/store2.7.2의 Week header 문제 후보 조사. 공식 자료만 인용, 공개 typed derived state의 version coupling 구별. 원인 확정은 actual baseline/current browser 필요.
- frontend primary: src/features/gantt/project-gantt.tsx, milestone-timeline-adapter.ts, 새 lane component/model/CSS, 필요한 src/features/projects/project-readonly-view.tsx command bridge, 직접 관련 Unit/새 tests/e2e/milestone-timeline-lane.spec.ts와 선별 합성PNGJSON. Workspace/Gantt/CSS 유일 writer. API/domain/server/shared fixtures/config/version/Packet/PLAN 변경은 별도 Manager 허가 없으면 금지. 기존 구현과 타Agent 편집을 되돌리지 않는다.
- frontend documentation_owner: MILESTONE_TIMELINE/PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN. 날짜 helper/public boundary 변경시 PRO_FEATURE_MATRIX/ARCHITECTURE를 영향검토하고 필요한 실제갱신. REQUIREMENTS/기존Editor계약 변경 필요시 Manager에게 반환. DESIGN/AGENTS/API/DB/Scheduling/Security/ImportExport/CIdeploy는 항목별 N/A 또는 필요한변경근거.
- scheduler: 필요시 read-only 순수 날짜/정렬/cluster 계약 자문. 파일 쓰기는 별도 정확 소유권 배정 후만.
- qa_docs: DOCUMENTATION_SYNC PASS 후 actual staged tree 독립 PRE_QA, 구현자 자체PASS와 공식remote gate 구별.
- issue_comment_writer=manager / agent issue_comment_allowed_types=NONE. 모든 Agent read/write 범위 준수, 최대 동시6, 재귀위임/공유파일동시쓰기 금지.

## evidence / handoff

AGENTS/ISSUE_LIFECYCLE/AGENT_PROMPTS/DESIGN/UI_UX_GUIDELINES/PROJECT_UX/MILESTONE_TIMELINE/TEST_PLAN/active PLAN과 관련 API/DB/SECURITY/ARCHITECTURE/SCHEDULING_ENGINE/REMOTE_VALIDATION/CI_CD/GITHUB_OPERATIONS를 읽는다. 관련 실제 #549/#550/#514/#367/#372/#518/#528 및 기존 reference 이슈들을 확인한다. 코드 작성 전에 node_modules/next/dist/docs의 해당 guide를 읽는다. UI skill 사용을 알리고 해당 SKILL을 읽는다.

LFF는 직접 Unit/typecheck/변경lint/date-header 실제 browser oracle와 lane5폭/keyboard/cluster/guidehit/row alignment/viewport와 continuity targeted Chromium이다. 전체Vitest/전체Playwright/Docker 반복하지 않는다. 최초FAIL·sourcehash·명령/exit·known limitations를 보존한다. synthetic API+actualCore UI와 actualserver/production증거를 혼합하지 않는다. PNG/JSON은 합성fixture·timestamp/sourcehash를 포함, DB/runtime logs/trace/build/credentials는Git제외.

ui_ux 설계·researcher 자료→Manager interface/공간/gate 결정→frontend date/header gate·lane capability 구현/검증→DOCUMENTATION_SYNC→독립 UI비교/PRE_QA→infra 게시GO→PR CI 등록→결과 미조회 상태로 #552 인계한다. 모든원격결과/QA_FINAL/Manager ACCEPT는 NOT TESTED로 남긴다.


## 설계·공식 자료 인계와 Manager 공간 결정

ui_ux는 plot 원점/8px control 여유·날짜 tick불변·같은 날짜 및 근접날짜 hitcluster의 차이·roving nativebuttons·cluster50페이지·Grid-only lane없음/Chart-only fullplot을권고했다. Manager는새Timeline의pointer/keyboard 공통 target44px(높이/최소폭), 단일lane64px, 상하10px 중6pxoutline외곽+4px여유, label최대160px·최대lane1을선택했다. 기존48/32 및88두줄은 실측PASS 없는 후보이며현재구현예산으로쓰지않는다. 이결정은기존44px규칙을모든제품control로확대한것이아니라새Timeline설계다. 실제5폭geometry와pointer/keyboard/focus은검증전NOT TESTED다.

2026-10-09 researcher 공식문서·설치metadata read-only 확인PASS: Core2.7.3/store2.7.2, 공개filter-tasks/scroll-chart/getState/scales(format(date,next)), markers PRO. _scales/_chartWidth/_weekStart는설치typed derived state이지만안정geometry문서계약이아니며package-rootgetDiffer와기존단일adapter의version결합을구별한다. Week원인은문서만으로확정불가. frontend는제품source불변before actualdate/headeroracle를먼저실행하며월셀rounding누적후보는현재추론이다. scheduler는Gregorian date-only/localDate/ISOweek·월·연도경계의순수oracle를read-only독립검토한다. 기존#367/#372/#514/#528 최신Issue CLOSED본문을읽고경계를보존한다.


## 날짜/header before FAIL 및 공개 대안 검증 결정

제품baseline31345da 소스불변의 실제4Task×Day/Week=8관측에서nativeanchor±1px는일치하지만Monthsemantic3FAIL을확인했다. 2026-03-10위November2025/2027-01-01위July2026재현과lowerISO주차1주선행관찰이다. before capturedAt2026-10-08T16:19:55.634Z, /tmp/issue551-frontend-header-before의stdout/exit/time/hash 및선별8PNG/JSON을보존한다. 기본localeweekStart0과ISOformatterMonday차이는추가실제진단하며월부분weekround누적은진단전후보로구별한다.

Manager 공개대안 검증GO: bounded dev-only read진단, scoped 공개Locale calendar.weekStart=1, Week상위행만week step1/format(date,next)의실제Gregorian월·연도span과accessiblefullISOinterval표시. Day month/day는유지한다. 기존native월셀오류를수정한것으로보고하지않으며지원public표현을정확weeklycalendarinterval로대체한다. 원래월1일nativecellboundaryPASS라고하지않고Gregorian월1일x가실제주cell내부어디에위치하는지별도oracle로검증한다. scheduler독립calendar자문PASS, 실제browser게이트는NOT TESTED이며canonicalGregorian/ISOweek-year가다른Jan1/Dec30·윤일·DST경계를구별한다. ui_ux추가semantic/label검토와frontendactual공개대안PASS뒤lane구현을진행한다.


## bounded 진단 실제 원인과 Week 대안 의미 확정

frontend 실제진단에서 Week._weekStart=0/native start2024-02-25를확인했다. lower168weekcells 총11424px=scale.width11424, upper40monthcells 총13668px로2244px초과였다. Day lower1065cells/upper36monthcells는총38340px로일치한다. 설치resetScales의각월부분week unitSize올림과총폭불일치, Sundaynativecell에이전MondayISOformatter/class가붙는별개의의미경계를실제date/class로대조했다. diagnostic JSON과당시sourcehash를보존하며단순정적후보와실제관측을구별한다.

ui_ux 조건부설계PASS: Week상단은각주가포함하는월·연도이다. [Monday,nextMonday)에서lastincludeddate까지만월·연도span에포함하고기존calendar helper로계산한다. 같은월2027.01/두월2027.01→02/두해2026.12→2027.01, fullISOinterval과Gregorian/ISOweek-year를accessibleWeekdetail/tooltip로확인한다. narrowcell ellipsis와fullkeyboard정보를구별한다. canonicaldate in실제weekinterval/lowerISO/upperGregorianspan/month1일의cell내부위치를실제DOMoracle로검증한다. 실제대안PASS전에는lanegate미통과다. target44/lane64/상하10/6pxring+4px여유설계계산PASS, 390pointerfine합성은actualtouchPASS가아니다.


## 초기 공개 date/header gate 검증과 lane sibling 결정

최신공개대안 actual1case/9.1초 PASS는 NY1440의4날짜×DayWeek8관측+실제Gregorian월1일의Week내부위치3+keyboard Weekfullspan4검증이다. /tmp/issue551-frontend-header-gate 로그/exit/sourcehash를보존한다. 신규format10(1900/2199의2200metadata/invalidclass 포함)+기존Sundayanchor지원weekTooltip8=고유18Unit PASS, 초기13은중복역사로구별한다. typecheck/linterror0/기존hookwarning4·새warning0, 최초진단typeddate/array type오류2를보존했다. 이결과는아직fullDST/5폭/scrollresize/dynamic/fullscreen/peer/lane전체gatePASS가아니다.

Manager lane구현GO: 항상존재하는같은Gantt소유wrapper/ancestry/key, 앱소유sibling64px의Grid대응+plotlane → 기존nativeGrid/dateheader → nativeTaskrows 순서다. lane는기존dateheader위에놓이고Core내DOM삽입/scaleHeight변경/가짜Taskrow없다. OFF는64→0으로동일작업면의공간을반환한다. actualrowy/height·readonlyplotbbox+typedderivedstate의version결합·boundedqueue/observer/RAF·hidden0failclosed·390physicalclip/Tab제외/접근가능한전체목록진입·pointer:none guide를실제검증한다. proposed timelineModel/activeMilestoneTaskId/onOpenMilestone(taskId,actualtrigger)/enabled defaultfalse interface를승인하고fullcanonical Timeline과nativeTaskselectionclipboard를분리한다. defaultproduction전환은552이며최종추가실제gate와독립비교를거친다.

## 날짜 상한과 초기 lane 검증의 범위

지원 입력 범위는 기존 1900-01-01~2199-12-31을 유지한다. 마지막 날짜의 ISO metadata `2200-W01`과 exclusive interval 끝은 UI 표시용 local calendar field 연산으로 다루며 domain 입력 범위를 넓히지 않는다. 주 전체가 지원 Calendar 범위를 벗어나면 근무일 수를 부분 날짜의 합으로 표시하지 않고 `미산정`과 이유를 제공한다. 기존 정상 범위의 Sunday 기반 Week tooltip 계약은 유지한다.

최초 2199 Milestone-only browser 실행은 readiness timeout FAIL이었다. 실제 현재 시각에서 축이 173년으로 늘어난 실행과, browser clock을 2199-12-01로 고정한 작은 축의 1 case PASS/4.2초를 구별한다. 후자는 ISO metadata·keyboard 미산정 이유·pageerror0·mutation0의 증거이며 실제 현재 시각의 전체 날짜 범위 성능 PASS가 아니다. 최초 FAIL 로그와 각 source manifest를 보존한다.

초기 targeted browser 7 case PASS/19.2초는 date/header, 작은 날짜 상한 fixture, 5폭 lane geometry 관측이다. 실제 focus ring/hit·cluster/Editor 복귀·peer/fullscreen/Grid 변화·대형 입력의 최종 판정을 대체하지 않는다. 390px에서 가로 이동 후 전체 목록 버튼이 가려지는 후속 실제 FAIL을 보존한다. Manager는 앱 소유 wrapper의 `overflow:clip`과 단일 adapter의 `controlLeft` 보완을 승인했다. 날짜 tick·논리 plot 원점은 유지하고, 실제 outer scroll owner의 물리 clip과 목록 control이 가리는 조작 영역을 구별한다. 기존 Task popup·scroll·focus clipping도 함께 확인한다.

Chart를 포함한 enabled 상태의 64px slot은 측정 실패나 peer view 숨김과 무관하게 유지한다. 숨길 때 marker와 overlay만 정리하여 같은 Gantt의 Chart 높이·scrollTop이 불필요하게 줄어들지 않게 한다. OFF 또는 명시적인 Grid-only에서 slot을 0으로 반환한다. 전체 canonical Timeline model은 snapshot 변경 시 계산하고 per-scroll E/P graph 재구성을 하지 않는다.

## 이름 표시 예산의 추가 설계 결정

ui_ux 독립 중간 검토는 초기 glyph-only control을 이름 표시 AC 미충족으로 판정했다. Manager는 이름이 보이는 2줄 control을 승인했다. 44px 높이 안에서 첫 줄 glyph12px+gap4px+ellipsis 이름(line-height16px), 둘째 줄 기록 상태·Gate(line-height12px), 줄 gap2px·상하 padding6px·border2px을 사용한다. 개별 읽기 최소96px/최대160px, 묶음 최소120px/최대160px은 border-box 예산이다. 가용 폭이 부족하면 이름을 없애는 대신 전체 목록으로 접근한다.

묶음의 첫 줄은 `N개 Milestone`, 둘째 줄은 동일일 또는 근접 날짜 범위다. 첫 항목의 상태를 묶음 전체 상태로 표시하지 않는다. 실제 전체 control/label bbox 양쪽의 6px focus 외곽+2px 여유를 충돌 기준으로 사용한다. sticky 목록과 오른쪽 물리 clip에 맞춰 clamp한 뒤에도 최종 비중첩을 확인한다. 원래 날짜 tick과 guide 좌표는 control 중심으로 이동하지 않는다. 이 설계 결정은 실제 geometry/keyboard/hit 검증 PASS와 별개다.

기존 앱의 production Core displayMode는 `all`이다. Grid-only/Chart-only의 실제 opt-in 기술 검증은 기존 development-only bounded probe에서 공개 displayMode prop `all/grid/chart`만 전환하여 수행한다. production 제어 hook이나 사용자 명령을 추가하지 않으며 같은 wrapper/key/Gantt 인스턴스를 유지한다. Grid-only는 lane 없음, Chart-only는 실제 전체 plot 원점·폭으로 검증한다.

최신 초기 17 case 실행은 16 PASS/1 FAIL(47.7초)이었다. 실패는 Grid-only에서 DOM 제거를 가정한 oracle이며 실제 hidden DOM과 lane0으로 정정한다. 후속 실제 Chart-only는 왼쪽 Core 고유 rail42px을 관측했다. Manager는 rail을 제외한 실제 날짜 plot 원점·폭을 lane 기준으로 승인했다. widget 전체폭 equality를 주장하지 않고 rail bbox+plot bbox·원점의 실제 합과 lane 정렬을 비교한다. rail 제거·가짜 geometry·Core 내부 수정은 하지 않는다. 두 초기 oracle FAIL과 React Core key warning은 보존한다. nonzero native wheel scroll 후 peer의 Chart 높이·top·left 보존 관측 PASS도 최종 같은 source 실행과 구별하여 기록한다.

## 문서 영향 분석 초안

MILESTONE_TIMELINE/PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN은 새 lane·Week 표시 의미·keyboard/focus·상태·geometry 지원 범위와 실제 증거를 갱신한다. ARCHITECTURE/PRO_FEATURE_MATRIX는 앱 소유 lane과 공개 Locale/scales, 설치 버전에 결합된 read-only geometry adapter의 경계를 검토한다. 최종 구현 후 작성자의 Result Contract와 diff를 대조하여 DOCUMENTATION_SYNC를 판정하며, 현재는 gate PASS가 아니다.

DESIGN/AGENTS는 기존 시각 언어와 역할을 적용하므로 N/A다. API/DB_SCHEMA/SECURITY는 server gateway·session/Origin/revision·storage를 변경하지 않으므로 N/A다. SCHEDULING_ENGINE은 date-only 입력 범위·Calendar·requested/effective 일정 알고리즘을 변경하지 않으므로 N/A다. IMPORT_SCHEMA/VBA_EXPORT/내보내기 계약은 canonical 전체 데이터와 기존 교환·renderer를 유지하므로 N/A다. DEPLOYMENT/CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS는 workflow·권한·배포·검증 정책을 변경하지 않으므로 N/A다. 새로운 unit/targeted browser 실행 기록은 TEST_PLAN과 본 Packet에 남기며 로컬 PASS를 원격 PASS로 대체하지 않는다.

## 추가 실행 이력과 남은 동결 검증

대형 합성 Task1000+Milestone2000의 peer/splitter/fullscreen/resize·동일 인스턴스, canonical 대상 소멸/같은 ID 복귀 자동재개 차단, OFF 중 Editor 유지·native M 선택0의 중간 3 case PASS/12.6초와 390 목록/이름 보완 후 3 case PASS/8.9초를 보존했다. 중간 Unit28/typecheck0은 최종 source 검증과 구별한다.

상태/touch 추가 실행은 3 PASS/1 FAIL이었다. dirty 초안·Escape 확인은 통과했으나 테스트가 기존 Editor의 `변경사항 버리고 닫기`를 생성 form의 `초안 버리고 닫기`로 찾은 oracle 오류여서 제품 변경 없이 selector를 정정했다. touch emulation은 실물 기기 PASS가 아니다.

Chart-only의 실제 42px은 collapsed Grid rail38px+resizer4px이며 두 bbox와 날짜 plot 합을 비교한 후속 case는 PASS였다. 이후 17 case 실행의 16 PASS/1 FAIL(43.2초)은 peer 복귀·splitter resize의 lane 측정 완료 전 bbox 조회 경계였다. 현재 source/API/문맥/display·canonical queue와 실제 좌표가 settled된 상태를 기다리는 oracle로 재검증한다. 임의 sleep·허용오차 확대·최초 FAIL 삭제는 하지 않는다. 최종 전체 동일 source suite·type/lint·6개 문서·선별 증거 동결 전 LOCAL_VALIDATED/DOCUMENTATION_SYNC/PRE_QA 최종 판정은 NOT TESTED다.

## peer/resize 재발에 따른 Manager REWORK

5폭×Day/Week의 실제 lane/native anchor 보완 실행에서도 전체는 16 PASS/1 FAIL(50.8초)이었다. peer 복귀·splitter resize 뒤 projection이 5초 동안 준비되지 않아 앞선 완료 oracle 보완만으로 해결되지 않았다. 앞 문단의 oracle 해석은 초기 가설로 보존하며 최종 원인으로 확대하지 않는다.

frontend는 canonical queue 완료 전 읽은 version과 완료 뒤 version이 달라지면 측정을 폐기하면서 다음 요청을 놓칠 수 있는 source 경계를 확인했다. 같은 원인 재발에 Manager는 REWORK로 재계획했다. queue 완료 후 현재 version을 읽고 기다린 queue identity가 교체됐을 때만 한정 재요청한다. 동일 queue 대기 중 frame/event continuation은 coalesce하며 취소/API/model/view context guard를 유지한다. 상시 polling·새 scroll/selection 복원·Core private write를 추가하지 않는다. 새 source의 targeted suite/type/lint와 DOCUMENTATION_SYNC를 다시 수행한 뒤 독립 QA로 넘긴다.

## 최종 Local Fast Feedback / DOCUMENTATION_SYNC

frontend 동결 source의 Chromium17/17 PASS(exit0, 46.4초), 시작2026-10-08T17:40:10Z/종료17:40:55Z, 실행 전후10개 SHA 일치다. 5폭×Day/Week10관측, date/header·같은 인스턴스·lane/row 정렬·키보드·cluster·touch emulation·peer/resize/fullscreen·OFF/dirty Editor·동적 축·Task hit를 포함한다. 직접 관련 4 Unit 파일29/29 PASS(242ms)는 마지막 source에서 실제 재실행했으며 이전 결과 재사용이 아니다. typecheck/변경lint/Markdown/diff exit0, 기존 hook warning4개 유지, next-env는 parent HEAD로 복원했고 tsconfig는 불변이다.

최종 Gantt SHA256 `f4371b59243bd9301e5abaece578e69b89635a85f36ad2da65054432cf1efb06`. frontend66개 allowlist의 SHA 검증66/66 OK: /tmp/issue551-frontend-final-allowlist.txt 및 /tmp/issue551-frontend-final.sha256. [실행 계약과 선별 증거](../../../output/playwright/issue-551/review-selected/execution-contract.json)는 합성 API+실제 Core 개발 Chromium이다. 최초 FAIL/진단/이전 source와 최신 source를 구별하고 미선별 원본은 /tmp/mastergantt-551-frontend-raw-evidence에 보존한다.

Manager 문서 영향 검토: required6개 MILESTONE_TIMELINE/PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN/PRO_FEATURE_MATRIX/ARCHITECTURE의 실제 갱신과 현재 코드·전체 canonical 계약·Week 의미·64/160/44px·geometry version 결합·최초 실패/queue 보완·환경별 미검증을 대조했다. CHANGELOG/PLAN/version/본 Packet은 Manager가 동기화했다. 위 항목별 N/A 근거도 현재 diff와 일치한다. **DOCUMENTATION_SYNC PASS**, 다음 단계는 정확 staged tree의 독립 ui_ux 비교 및 qa_docs PRE_QA다. 최종 QA/Manager ACCEPT와 quality/e2e/docker는 NOT TESTED다.

최소1900 전체 UI·invalid canonical 서버 DTO·전체 Task drag/Dependency 회귀·독립 runtime observer 수 계측·실제 HTTP authorization/SQLite551·production build/runtime·실물 touch/screen reader는 NOT TESTED다. 상한 날짜의 실제 현재 시각 전체 축 성능도 작은 clock fixture PASS로 대체하지 않는다. 개발 displayMode case의 React child-key warning(render Lt)은 원인 미확정이다. Week header/lane Week 로그에는 미관측이며 baseline이나 두 week row 원인으로 확대하지 않는다. researcher의 설치 TimeScale source rowIdx/cellIdx read-only 확인과 실제 warning 원인은 별개다.

## 독립 UI/UX / PRE_QA 및 PR 인계

독립 ui_ux와 qa_docs는 reviewed tree `6cd706b131f8e1742335a686926c7d924216c844`의71개 index/worktree hash와 FE manifest·10개 browser source hash 일치/drift0을 확인했다. ui_ux bounded 비교 PASS, 추가 blocker0/REWORK 없음: 5폭×Day/Week10관측의 lane64px/control160×44px, tick/native 차이1px·row center차이0.5px, 실제 PNG의 이름·상태·390 가로 접근, Week span·50개 페이지·Editor/OFF/소멸·Task hit·같은 인스턴스를 대조했다. 대형1000Task+2000M의 좌표측정2.6ms는 한 관측이며 전체 성능 보장이 아니다.

qa_docs 독립 PRE_QA PASS는 PR 준비 판정이다. 같은 검토 source의 직접 Unit4파일29/29 PASS(229ms, exit0)와 원본 Chromium17/46.4초·type/lint/문서 근거를 확인했다. 구현자29와 reviewer29를 고유58개로 합산하지 않는다. Reviewer 초기 tree 확인의 `git write-tree`1회는 이미 생성된 tree를 반환했으며 후속 source/index/ref 논리 drift0을 확인했다. 이후 source/문서/GitHub 변경 없이 조회만 수행했다.

Grid 열 표시·숨김과 clipboard 전체 회귀, full Task drag/resize/Dependency, 독립 observer 수·document scrollWidth overflow assertion은 현재 NOT TESTED다. Grid splitter/Chart resize·Task checkbox/context hit를 전체 기능 PASS로 확대하지 않는다. 후속 #552의 실제 표시 전환 검증에 Grid 열 표시·숨김/5폭 document overflow를 포함하고, #553 통합 검증에서 남은 계약을 비교한다. 현재 feature는 opt-in 준비이며 production 기본 활성화/main 통합/최종 AC·QA_FINAL·Manager ACCEPT를 판정하지 않는다.

Manager는 PR 후보 게시를 승인한다. version0.105.0/release_required=true/release_authorized=false, parent550 exact SHA/stacked base 유지. infra의 게시 전 읽기에서 2026-10-09 02:51:28KST main08ac7749efc4544dfc125853d9e58ef3a9d56b21/version0.102.1·predecessor31345da9346dfbdc1ac02e4e7ca567edafec775f 일치, remote551branch/PR 중복0이다. 다음은 최종 tree/byte equality→PR→exact-head CI 등록만이며 결과 조회 없이 #552로 인계한다. 공식 quality/e2e/docker/QA_FINAL/ACCEPT·merge/main/GHCR/tag/Issue 종료/cleanup은 NOT TESTED/비범위로 유지한다.

## Issue #551 PR #560 CI #2217.1 실패 보완 (2026-10-09)

- 최초 head `fb6e5a634b3fcd70d62d4e8404a42cefe0ab6ce9`, [run 37821023371](https://github.com/planner77/masterGantt/actions/runs/37821023371). Next production build, TypeScript, ESLint, Vitest, policy 및 Docker PASS. Chromium 6개 중 shard 2에서 89 PASS/1 FAIL, 나머지 shard PASS. 따라서 E2E 전체 FAIL.
- 실패는 `tests/e2e/milestone-timeline-lane.spec.ts:126`의 1000 Task/2000 Milestone, peer tab 복귀 후 Grid splitter 변경 시 lane plot이 5초간 존재하지 않는 현상이다. CI trace에서 Core `_chartWidth=842px`와 실제 DOM `.wx-chart=825px` 차이 17px, `gridWidth=560px`, `hidden=false`, laneMeasurement.count=14, queueVersion=2를 확인했다.
- Core scrollbar gutter/렌더링 폭 차이 상황에서 DOM 너비와 내부 state 너비가 1px 이내여야 한다는 조건 때문에 lane을 표시하지 못했다. 실제 DOM plot의 x/width/clip을 기준으로 lane 위치를 결정하고 날짜/scrollLeft/unit/cellWidth는 기존 Core state 기반으로 유지한다. zero-size/hidden/inert/unsupported scale은 fail closed하며 timeout·retry·skip은 완화하지 않는다.
- 미해결 PR 리뷰 P2 두 건에 따라 혼합 날짜 cluster item focus/Editor 진입에서 해당 ID의 선택 및 guide 동기화, scroll로 focused marker가 사라질 때 surviving marker 또는 전체 목록 focus 복원을 추가했다. 다른 dialog/tab 사용자가 이미 focus를 옮긴 경우에는 빼앗지 않는다.
- 새 E2E는 기존 대형 fixture의 실제 plot 원점·폭, Grid/Chart/fullscreen/scroll 불변 assertion을 유지하고 혼합 날짜 guide 및 가로 clip 키보드 복원 회귀를 추가한다. 새 head의 정식 quality/E2E/docker, QA_FINAL/Manager ACCEPT는 실제 새 CI 결과 확인 전 NOT TESTED.
- `DESIGN.md`/`AGENTS.md`는 시각 원칙·작업 지침·검증 계약 불변으로 N/A. API/DB/Security/Scheduling/ImportExport/배포/워크플로/패키지 버전 역시 불변이며 제품/테스트/관련 문서만 수정한다. release_required=true, release_authorized=false. 병합/Main CI/GHCR/Issue 종료는 요청 범위 밖이다.


## Issue #551 PR #560 CI #2234.1 TypeScript gate 복구 (2026-10-09)

- 실패 run [#2234.1](https://github.com/planner77/masterGantt/actions/runs/37848762006) / exact head `4f6815575d2078e989554da3f1482143ae3b1213`: Chromium E2E 6/6 shard SUCCESS(앞선 #2217.1의 geometry 회귀 PASS), Vitest/ESLint/정책 SUCCESS. TypeScript TS18048 1건 FAIL로 Next production build와 Docker build 역시 FAIL.
- `src/features/gantt/milestone-timeline-adapter.ts:79`: `state._chartWidth`는 설치 Core의 typed derived state에서 `number | undefined`; `Number.isFinite(x)`만으로 TypeScript narrowing이 되지 않아서 `x <= 0`에서 TS18048이 발생했다. `typeof state._chartWidth !== "number"` 가드를 먼저 평가해 타입을 좁힌 다음 유한·양수 검사를 유지한다.
- 실제 DOM plot x·폭 기준 좌표 정책, 무효/숨김 viewport 차단, scroll/marker/guide/초점 복원, 원래 E2E assertion과 production ON/OFF 설정은 변경하지 않는다. 검사 무력화, 타입 assertion, skip/retry/timeout 상향을 사용하지 않는다.
- 이번 범위의 문서 동기화는 TEST_PLAN 및 본 Work Packet의 원인·증거 반영이며 다른 DESIGN/AGENTS/API/DB/보안/Calendar/릴리스·CI workflow/버전 문서는 계약 불변으로 N/A다. 새 head의 공식 CI 결과·독립 QA_FINAL/Manager ACCEPT는 새 실행 결과 전까지 NOT TESTED, release_required=true/release_authorized=false, 병합/Main CI/GHCR/Issue 종료는 비범위다.

