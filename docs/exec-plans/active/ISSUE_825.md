# Issue #825 — 물류 대시보드 폭·헤더·KPI 조건 영역 정돈

## Issue Work Packet

- repository: `planner77/masterGantt`
- issue: [#825](https://github.com/planner77/masterGantt/issues/825), parent [#824](https://github.com/planner77/masterGantt/issues/824)
- lifecycle_phase: PR_CI_READY
- baseline: `dc8543f390616c0d5aca90a4f91899f3cf7ac5da` / app `0.135.4`
- branch: `fix/issue-825-dashboard-shell`
- worktree: `/home/planner/Dev/masterGantt-worktrees/issue-825`
- requested_scope: 분석·계획·구현·문서 동기화·미해결 리뷰 및 충돌 해결 후 Ready PR CI 시작까지. CI 모니터링·병합·Main/GHCR·정식 게시·Issue 종료는 제외한다.
- version_decision: 기존 계산/조회 계약을 유지하는 UI 회귀 교정 PATCH `0.135.5` 후보.
- release_required: true
- release_authorized: false
- risk_level: HIGH
- risk_reason: 제품 변경은 제한된 UI MEDIUM이나 package/lock version 보호 경로가 포함되어 main 검증기의 risk_floor에 따라 HIGH로 상향한다. 서버·권한·계산·비동기 상태 producer는 수정하지 않는다. 별도 사전 QA와 최종 exact-head Owner/Trusted gate를 분리한다.
- qa_method: OWNER_MANAGED
- qa_required: true
- reviewer: `/root/qa_825`의 과거 read-only PRE_QA=PASS (정식 독립 인간 QA 최종 승인과 별개)
- independent_qa: N/A (OWNER_MANAGED 전환에 따른 최종 독립 인간 리뷰 의무 없음; 기존 사전검토 결과 보존)
- trusted_qa: 이전 Head 두 차례 BLOCKED, 새로운 Head 검증은 NOT TESTED
- owner_high_risk_acceptance: NOT TESTED (OWNER_MANAGED 전환 승인은 병합·HIGH 위험 수용 승인과 구분)
- manager_decision: NOT TESTED
- MERGE_READY: BLOCKED
- issue_comment_writer: Manager
- issue_comment_allowed_types: PLAN, STATUS, EXCEPTION

## 역할·소유권

- ui_ux: 별도 read-only 설계 검토. 공통 폭 소유권·중복 context·KPI 그룹·기준정보 예외를 제안한다.
- frontend: `project-logistics-management.tsx/.module.css`, `project-logistics-dashboard.module.css` 및 필요한 KPI markup, 기존 logistics request-state/management E2E 확장.
- Manager: Work Packet·PLAN·PROJECT_UX·LOGISTICS_DASHBOARD·TEST_PLAN·CHANGELOG와 version/lock, 수동 관측·통합.
- qa_docs: 구현자와 분리된 read-only AC/code/test/docs 사전검토. 로컬 검토를 원격 QA Final로 확대하지 않는다.
- infra: 최종 branch push·Ready PR·충돌/미해결 review thread 확인과 CI 시작 증거. 모니터링하지 않는다.
- 동시 제품 파일 작성자 1명. #826의 `wbs-view.module.css` typography/search/control 변경, Milestone 폭 수정, 전역 관리자100rem·인증32.5rem·Editor44px는 비범위다.

## 현재 상태·목표 흐름

상위 project gutter 안에서 물류 shell이 1440px로 중앙 제한되고, 상위 탭 아래 물류 구성/Gantt WBS와 독립 헤더가 다시 적층된다. `hideSubviewNavigation`은 dashboard뿐 아니라 master에서도 true이므로 이를 조건으로 모든 헤더를 없애면 기준정보의 도움말/readonly 안내가 사라진다. KPI 모바일 필터의 column/stretch와 전폭 input/button도 불필요한 세로 공간을 만든다.

목표 배치는 `프로젝트 context → 대시보드 peer 탭 → KPI 조건/현재 범위 또는 동적 조회 도구 → 핵심 KPI/표 → 진단`이다. KPI/공정&WorkArea/설비/물류 시스템은 host 가용 폭을 사용하고 shell inline padding은0이다. embedded dashboard/unified의 반복 제목만 제거하고 master는 기존 제목/ContextHelp/readonly를 유지한다. 상위 project header의 readonly/edit 상태는 계속 표시한다.

KPI 조건은 기준일+자동 기준일, 임박 일수, 시스템 집계 범위, 활성 조건, 새로고침의 의미별 그룹으로 자연 wrap한다. 높이는 제어/패딩/줄바꿈으로 결정하고 고정 min-height로 bar를 늘리거나 오류·긴 option을 clip하지 않는다. 자동 기준일 버튼은 최종 새로고침의 auto margin과 분리한다. 카드 adaptive grid와 숫자 강조·단위·평가일·분모·미산정/0/부분값·drill 의미는 유지한다.

표 폭 예산은 KPI 공정836/설비1460/시스템1132px 최소 폭과 첫 이름 열220px, master 기존 최소 폭을 유지한다. 추가 가용 폭은 유연한 이름 열이 소비하고 nowrap metadata/control 최소 폭을 줄이지 않는다. 좁은 화면은 표 container가 가로 scroll을 소유한다. 별도 qa_docs 검토 중390px readonly 공정에서 숨은 설명 span의 absolute 위치가 표 밖 containing block을 사용해 document overflow52~53px를 만드는 기존 결함을 재현했다. tableContainer에 position:relative를 두어 숨은 설명을 내부 scroll owner에 귀속하고,852px 내부 표 폭·accessible name을 유지한 채 문서 overflow0을 검증한다.

### 상태·접근성

| 상태 | 보존 계약·검증 |
| --- | --- |
| readonly/edit | 상위 편집 상태, master 안내/도움말, 원본 mutation guard 유지 |
| loading/pending | 현재 조회 상태·refresh disabled, 이전 KPI 숨김 및 늦은 응답 거부 유지 |
| empty/no-result/error | 기존 안내/재시도 및 연결된 기간 오류를 자연 wrap, clipping 금지 |
| stale/401/412 | 기존 원본 확인·정확 snapshot 잠금/재조회 경로 유지 |
| keyboard/help/drill | 보이는 label/연결, Tab·Escape·focus 복원·정확 원본/일정 복귀 유지 |
| fine/coarse | KPI fine compact 제어, coarse44px 이상. 다른 동적 toolbar 크기는 #826 소유 |

### Design Delta

B — 기존 workspace-first·가용 폭·compact toolbar·progressive disclosure·표 소유 scroll 원칙의 구체화. 새 공통 규칙 도입이 없어 `DESIGN.md: N/A`다. ui-ux-pro-max의 Responsive/Table Handling 권고 중 표 container 소유 scroll과 문서 overflow 방지를 채택하며, `overflow-x:hidden`으로 문제를 숨기는 일반 예시는 채택하지 않는다. 설치 Next16.4.2의 CSS Modules 가이드를 확인하고 기존 CSS Modules를 유지한다.

## AC_TEST_COVERAGE

- AC1: 같은 HTTP/SQLite fixture의 390/768/1024/1440/1920px before/after shell/host 좌우 경계 및1920px 폭을 관측. 기존 KPI request-state E2E의 geometry assertion EXTEND.
- AC2: embedded KPI/unified의 반복 헤더0, master 도움말/readonly 유지 및 정확 원본 편집/복귀를 기존 management/request-state 테스트와 별도 source 검토로 확인.
- AC3: filter bar 높이·첫 KPI top·label/control containment·긴 option·날짜/기간 오류·refresh pending을 기존5폭 request-state 시나리오와 before/after로 검증.
- AC4: 기존 adaptive 카드·수치/부분값·정확 drill request-state 및 공정/설비/시스템 dashboard 고유 회귀 KEEP_UNIQUE. 표 최소 폭/유연 열/내부 scroll과 문서 overflow를 관측.
- AC5: 5개 사용자 dashboard와 기준정보 공용 shell을 실제 실행 범위로 구분. Milestone source 불변과 같은 fixture before/after 폭을 대조. 원격 quality/e2e/docker 결과는 CI 시작 시 NOT TESTED.

## TEST_LIFECYCLE_REVIEW

사전 검색: `logistics-dashboard-request-state.spec.ts`, `project-logistics-management.spec.ts`, `issue-733-process-workarea-dashboard.spec.ts`, `issue-734-equipment-dashboard.spec.ts`, `issue-735-system-dashboard.spec.ts`, `issue-732-milestone-dashboard.spec.ts`, `issue-719-contextual-help.spec.ts`, `tests/manual/issue-799-dashboard-metrics.mjs`, 공용 geometry/fixture.

- EXTEND: 기존 KPI5폭 long-name/keyboard와 master 모달/readonly 시나리오에 shell/header/filter 의미 assertion 추가. 독립 전체 E2E 복제 금지.
- KEEP_UNIQUE: 기존 요청 역전·stale·오류·공수/미산정·drill, 원본 editor/dirty/readonly·정확ID·Gantt 보존. 새 assertion으로 기존 단언/timeout/retry/skip을 약화하지 않는다.
- 수동 관측은 기존 #799 collector/실제 fixture를 재사용한 #825 opt-in collector이며 CI 테스트 발견/required gate를 변경하지 않는다. 수동 결과는 runtime JSON·PNG와 source hashes에 귀속한다.
- DELETE/RETIRE/CONSOLIDATE: 없음.

## DOCUMENTATION_SYNC

- `DESIGN.md`: N/A(기존 가용 폭·compact·표 소유 scroll 원칙 구체화)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 responsive·label·focus 계약 유지, 새 공통 interaction 없음)
- `docs/PROJECT_UX.md`: UPDATED
- `docs/LOGISTICS_DASHBOARD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_825.md`: UPDATED
- `docs/evidence/issue-825/geometry.json`: UPDATED
- `CHANGELOG.md`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED
- `AGENTS.md`: N/A(기존 협업·실행 지침 유지, Next 생성 변경은 제외)
- `docs/REQUIREMENTS.md`: N/A(기존 도메인·기능 요구 불변, 배치 회귀 교정)
- `docs/ARCHITECTURE.md`: N/A(기존 component/service와 writer 경계 유지)
- `docs/SECURITY.md`: N/A(session/Origin/revision·권한 guard 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 PR/CI/승인 절차를 적용하며 정책 수정 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 protected AGENT·Owner 승인 gate 유지)
- `docs/API.md`: N/A(서버·요청·응답 DTO와 권한 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB·migration·영속성 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정·Gate·수치 계산 producer 변경 없음)
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: N/A(집계 모집단·계산 grain·부분값 계약 불변)
- `docs/CI_CD.md`: N/A(CI/Required·GHCR·Release 정책 수정 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 원격 검증 절차 유지, 결과는 Issue/PR 기록)

## 실행·인계 증거

제품 구현·문서 동기화 완료. 로컬 검증은 아래 시도·환경별 판정을 따른다. 로컬 PASS는 원격 Required3·독립 QA Final·Manager ACCEPT가 아니다. 63km 실프로젝트 직접 재현, native125%, 실기기·AT 및 운영 환경은 NOT TESTED이며 #517 경계를 유지한다. 정식 릴리스 승인은 이번 PR CI 시작의 선행조건이 아니고 병합/게시 권한으로 확대하지 않는다.

### 로컬 도구와 최초 E2E 관측

- npm ci frozen install PASS(Node22.14.0, Next16.4.2). version check0.135.5·TypeScript·변경 TSX/spec focused ESLint·Markdown links355파일·diff whitespace PASS.
- Pre-PR CLI fast/targeted는 모두 BLOCKED. `.prepr-reports/issue-825-{fast,targeted}/report.json`에 제품4경로와 수동 collector의 미등록 producer→consumer mapping을 기록했다. 자동 매핑/검증 정책을 수정하거나 수동 include로 UNKNOWN을 PASS 처리하지 않았다. 실제 직접 검증은 위 AC 매핑의 기존 E2E와 source/geometry 검토로 별도 수행한다. CLI 실행은 동시 캡처/테스트 중 sourceStable=false도 기록했으므로 전체 Pre-PR PASS를 주장하지 않는다. 최초 잘못된 report-dir 지정도 도구의 경로 가드로 BLOCKED 후 `.prepr-reports/`로 교정했다.
- 첫 실제 Chromium2spec 실행은 workers1/retries0에서41케이스 중36 PASS/5 FAIL(6.5m). 실패5개는 missing-integrated 시나리오의 초기 프로젝트 로딩 timeout1, long-name390/1024의 Gantt 준비 timeout2,768의 기존 captureUi evaluate timeout1,1440의 기존 Gantt instance 보존 단언1이다. 신규 shell/header/filter 단언 실패와 구분하며 원인은 UNKNOWN이다. 동시 browser 관측이 있었지만 원인으로 단정하지 않는다. 원본 trace/HTML은 `output/playwright/issue-825/e2e-first-run/`에 보존한다.
- 별도 qa_docs의 coarse390은 실제 pointer:coarse=true, date/number/select/checkbox label/refresh44px, 도움말 Escape·focus 및 project mutation0을 확인했다. readonly master390에서 shell과 host는 모두 x12/width366으로 gutter0이었고, 공정 표의 숨은 span으로 documentWidth443을 관측했다. DOM 진단의 tableContainer position:relative 적용 후 documentWidth390·scrollWidth852였다. source에도 동일 국소 보정을 반영했다.
- 최종 source의 after25 및 보조 관측, 위 실패5+수정 readonly390+기준정보5폭7case의 분리 재검증 결과를 아래 인계 증거에 기록한다. 최초 실패를 삭제하거나 전체41 PASS로 바꾸지 않는다.

### 최종 화면 실측

[실측·source hashes](../../evidence/issue-825/geometry.json), [coarse/readonly25관측](../../evidence/issue-825/readonly-coarse.json), [KPI1440 보정 관측](../../evidence/issue-825/kpi-1440-corrective.json)을 최종 제품4파일 hash에 결속했다. 기본 collector/fixture·locale·DPR은 before와 동일하다. 최종25회 정규 시도는24관측/1440 초기 로딩 timeout1과 completeness FAIL로 남기고, 별도 같은 source1440 관측을 합쳐5화면×5폭의 실측을 제공한다. 남아 있던 이전1440 JSON/PNG를 최종 source 근거로 재사용하지 않았다. 원본 정규 실패와 보정 출처를 실측 JSON에서 구별한다.

| viewport | shell 폭 before→after | KPI bar 높이 before→after | 첫 KPI top before→after |
| --- | --- | --- | --- |
| 390 | 366→366px | 290→214px | 855.390625→658px |
| 768 | 720→720px | 290→97px | 800.390625→486px |
| 1024 | 976→976px | 116→97px | 578.390625→438px |
| 1440 | 1392→1392px | 65→53px | 527.390625→394px |
| 1920 | 1440→1872px | 65→53px | 527.390625→394px |

모든 최종 dashboard 관측은 문서 overflow0px이며 Milestone 폭은 before/after 동일하다. readonly/coarse 보조 관측은 KPI5폭의44px 제어·도움말 Escape/focus와 master3관점×5폭의 header/readonly/help/가용폭·문서 overflow0, resource master5폭 navigation smoke에 한정한다. 원래 project Task/Assignment/revision fingerprint와 조회 중 project mutation0을 보존했다. 실기기 touch·AT·63km 직접 재현과 전체상태 조합 PASS를 의미하지 않는다.

비교 이미지: [1920 before](../../evidence/issue-825/kpi-1920-before.png) / [after](../../evidence/issue-825/kpi-1920-after.png), [390 before](../../evidence/issue-825/kpi-390-before.png) / [after](../../evidence/issue-825/kpi-390-after.png).

### 개발 서버 분리 재검증과 실행환경 진단

최종 relative source의7case 분리 재검증도4 PASS/3 FAIL이었다. long-name390/768/1440과 수정 readonly390은 PASS, missing-integrated 초기 프로젝트 로딩30s·1024 Gantt 준비5s·기준정보5폭 navigation30s는 FAIL이다. 두 trace에서는 `[HMR] connected` 후 `Router action dispatched before initialization`, RSC500의 `Manifest file is empty` 또는 `Unexpected end of JSON input`이 Next `load-manifest.external.js`에서 발생했다. missing-integrated는 API 완료/console 기록이 없어 원인 UNKNOWN을 유지한다. [원본8개 실패 trace의 분류](../../evidence/issue-825/e2e-trace-diagnosis.json)를 보존한다.

제품 source·assertion·timeout/retry를 바꾸지 않고 `.next-prepr` production build와 별도3205 서버로 동일 타깃7case를 실행하여 dev HMR/manifest 오류와 제품 회귀를 분리한다. 마지막 dev 기준정보 케이스와 production build 시작이 일부 겹쳤으므로 generated Next 타입 파일 갱신에 따른 HMR 가능성도 배제하지 않는다. production 결과는 별도 환경 증거이며 dev 실패를 소급 PASS하지 않는다.

### Production 보조 환경의 초기 설정 오류와 교정

첫 production 실행은 Manager가 DATABASE_PATH를 작업폴더 `.data/`로 지정해 `/data` 하위만 허용하는 기존 production guard가 차단했다. health/live200만 확인한 준비 검증은 충분하지 않았고, 실제 project HTML의 RSC에 서버 digest3017141885가 포함되어 client module과 mock 요청 이전에7case가 모두 FAIL했다. 정적 chunk는200/HMR없음이므로 앞선 dev manifest 실패와 구별한다. [환경 실패 원장](../../evidence/issue-825/e2e-production-environment-failure.json)을 보존한다. 제품 guard를 완화하지 않는다.

호스트 `/data`는 쓰기 권한이 없고 비대화 sudo도 불가하여, 새 task전용 `.data/issue-825-production-root`를 bwrap의 private mount namespace 내부 `/data`에 bind했다. 호스트 root는 read-only이고 운영 `/data`에는 쓰지 않는다. 동일 standalone source의 DATABASE_PATH=/data/verification.sqlite3로 health/ready200/statusok와 project HTML200/ProjectReadonlyView module 존재·기존 error digest 부재를 먼저 확인한 뒤 같은7case를 실행한다. Docker/원격 CI 검증을 대체하는 실행은 아니다.

### 최종 로컬 결과와 PR 인계

교정된 standalone production 환경에서 **타깃7/7 PASS,17.2초**. Chromium153.0.8010.12/Playwright1.63.0,workers1/retries0/기존timeout을 유지했고 제품·테스트6파일 hash는 이전 시도와 동일하다. missing-integrated 오류/재시도, long-name390/768/1024/1440의 새 framing·keyboard/drill·Gantt 보존, readonly390의 도움말/Escape·overflow0·표 내부 scroll과 master5폭 모달 경계를 통과했다. [고유case·source hashes·이전 실패 보존](../../evidence/issue-825/e2e-production-corrected.json). production build(TypeScript/runtime-tools 포함) PASS. 로컬 전체41회귀나 GitHub Required3 PASS로 확대하지 않는다.

별도 ui_ux `/root/ux_825` → frontend `/root/frontend_825` → qa_docs `/root/qa_825` → infra `/root/infra_825`를 실제 별도 세션으로 실행했고 Manager가 문서·소유권·통합을 담당했다. QA P2의 표 숨은 설명 넘침은 source 보정·기존 고유case 확장·독립 browser로 해결했다. AGENT protected 최종 인간 리뷰 영수증·기본브랜치 Trusted/Owner·Manager ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED다.

Head별 원격 quality/e2e/docker의 run/attempt·review thread0·mergeability 및 최신main은 게시 후 Issue/PR STATUS에서 정확한 SHA와 함께 확인한다. 요청대로 CI 시작까지만 진행하고 모니터링하지 않는다. main/GHCR/Release·branch cleanup·Issue 종료는 수행하지 않고 작업 branch와 open Issue를 유지한다.

### 독립 사전검토

`/root/qa_825`의 실제 분리된 read-only **PRE_QA=PASS**, 미해결 finding0건. 제품·테스트6파일의 최종 production 영수증 hash, AC1~AC5·문서·version-only·P2보정·실측출처·실패보존을 확인했다. main 검증기의 순수 구조 검사도 DOCUMENTATION_SYNC=STRUCTURAL_PASS_SEMANTIC_REVIEW_PENDING / AC_TEST_COVERAGE=MAPPING_PASS_SEMANTIC_REVIEW_PENDING, risk_floor=HIGH이며 보호 경로는 package.json/package-lock.json2개다. 이 로컬 사전검토/구조 검사는 원격 QA Final·인간 review 영수증·Manager ACCEPT가 아니다.

## Main 정렬 인계 (2026-10-27)

- 최초 PR: [#833](https://github.com/planner77/masterGantt/pull/833), 원본 Head `b66f58843fa29c86bf1756182676b501cbe3fd8f`, 원본 base `dc8543f390616c0d5aca90a4f91899f3cf7ac5da`. 최초 원격 [Full CI #3330.1 / Run 40455522644.1](https://github.com/planner77/masterGantt/actions/runs/40455522644)는 quality/E2E 8/8/docker SUCCESS. 이 성공은 원본 HEAD/Base 귀속이며 새로운 정렬 HEAD의 검증 결과가 아니다.
- 최신 main `09d461f96f4cf99f5addd56d0894500cdbe02ed6` (Issue #831/PR #832 포함)에 대해 원본 PR HEAD와 main을 두 부모로 보존하는 merge commit으로 정렬한다. force/rebase 없이 최신 main의 `.codex/agents/frontend.toml`, `.codex/agents/ui-ux.toml`, `AGENTS.md`, `docs/AGENT_CONFIGURATION.md`, `docs/ISSUE_831_FAILURE_ANALYSIS.md`, `docs/exec-plans/active/ISSUE_831.md`, `tests/scripts/agent-model-selection.test.ts`의 정확한 blob을 통합한다.
- 실제 충돌: `docs/exec-plans/active/PLAN.md` 맨 앞에 #825·#831 문단이 각각 추가되어 GitHub `mergeable_state=dirty`로 판정됐다. 원본 base의 229,831자 suffix를 두 쪽이 모두 그대로 보존하므로 #825 문단·#831 두 문단·공통 base 원문 순으로 병합하여 이전 계획 기록을 삭제하지 않는다. 제품/테스트/회귀·기존 source 증거는 그대로 유지한다.
- 새 HEAD 작성 전 PR review threads 0건, PR reviews 0건. 이전 사전 QA의 PRE_QA PASS/로컬 production 7/7 PASS는 HEAD가 변한 이후 보호된 최종 QA 및 원격 Full CI를 대신하지 않는다. 새 HEAD에 대해 risk=HIGH, qa_method=AGENT, qa_required=true, release_required=true, release_authorized=false, Manager ACCEPT=NOT TESTED, MERGE_READY=BLOCKED를 유지한다.
- [누적 실패 원장 정책](../../PR_CI_FAILURE_TRIAGE.md)은 **최초 원격 PR CI 실패 시** `docs/ISSUE_825_FAILURE_ANALYSIS.md`를 생성하도록 요구한다. 이슈 #825의 원격 Full PR CI 첫 시도는 성공했으므로 아직 해당 원장 파일은 없다. 개발 서버 HMR/RSC·잘못된 production DB 경로·Pre-PR BLOCKED 등의 원본 실패는 앞선 절과 `docs/evidence/issue-825/`에 보존, #831 원격 PR 실패는 최신 main의 독립 원장에 그대로 남긴다. 병합 충돌을 PR CI 직접 실패로 오분류하지 않는다.
- 요청된 종료점: 새 `pull_request/synchronize` Full CI를 **시작**하고 run/attempt를 별도 Issue STATUS로 보고. 이후 결과 확인·최종 Trusted/인간 리뷰·Owner 승인·병합·Main/GHCR·Release/Issue 종료는 수행하지 않는다. 새 HEAD Required3 및 QA Final 결과는 시작 시점 NOT TESTED.

## QA Trusted #979/#981 및 Owner-managed 전환 (2026-10-27)

### 원본 이력과 직접 실패 (기존 판정 불변)

| 경계 | 정확 Head / Base | 실제 Run / Attempt | 결론·최초 직접 차단 |
| --- | --- | --- | --- |
| 원본 Full PR CI | `b66f58843fa29c86bf1756182676b501cbe3fd8f` / `dc8543f390616c0d5aca90a4f91899f3cf7ac5da` | [40455522644.1](https://github.com/planner77/masterGantt/actions/runs/40455522644) | SUCCESS — Quality, Chromium E2E 8/8, Docker 모두 성공 |
| Trusted #979 | 위 원본 Full Run 귀속, 신뢰된 검증기 main `09d461f96f4cf99f5addd56d0894500cdbe02ed6` | [40458359626.1](https://github.com/planner77/masterGantt/actions/runs/40458359626), Job `122036866602` | FAILURE — Step “원본 PR CI/Head/base 및 차단 리뷰·문서 증거 독립 조회” |
| Main 정렬 후 Full PR CI | `a7f45f6e5175bc09cf57f565bfb29ac7588edba5` / `09d461f96f4cf99f5addd56d0894500cdbe02ed6` | [40470969178.1](https://github.com/planner77/masterGantt/actions/runs/40470969178) | SUCCESS — Quality, Chromium E2E 8/8, Docker 성공 |
| Trusted #981 | 위 Main 정렬 Full Run 귀속, 동일 신뢰된 main 검증기 | [40474635264.1](https://github.com/planner77/masterGantt/actions/runs/40474635264), Job `122089718678` | FAILURE — 동일 Step/동일 차단 사유 |

두 Trusted Job 원본 로그의 직접 사유: **“AGENT 보호 파일: 현재 Head에 대한 독립 인간 QA_FINAL: PASS 리뷰 필요”**. 두 Head에 대하여 GitHub APPROVED 리뷰 0건, 미해결 review thread 0건이며, 이전 별도 `qa_docs PRE_QA=PASS`는 GitHub가 요구하는 독립 인간 최종 리뷰가 아님. 판정: 선택된 **QA 승인 경로의 요구 증거 부재 (POLICY_CI / GATE_MISSING)**. 제품 결함이나 PR Required3 직접 실패로 분류하지 않는다. 앞선 Full PASS를 Trusted PASS로 바꾸지 않는다. 별도의 원격 Full PR CI 직접 실패가 없으므로 [실패 원장 정책](../../PR_CI_FAILURE_TRIAGE.md)의 “최초 PR CI 실패 시 `docs/ISSUE_825_FAILURE_ANALYSIS.md` 생성” 조건은 아직 발동하지 않았다. QA Trusted 두 실제 실패 및 개발 서버/환경·Pre-PR 관측은 여기와 기존 source 증거에 누적 보존한다.

### 사용자 결정·후속 검증

- 사용자 명시 지시: **`qa_method=OWNER_MANAGED` 전환 후 신규 Full PR CI 재시작**. 현재 QA 정책 [#598](../../QA_REVIEW_POLICY.md)은 HIGH 및 보호 package/lock 경로에서도 Owner-managed를 허용한다. `risk_level=HIGH`, `qa_required=true` 유지; `independent_qa=N/A(Owner-managed, 독립 검토 없음)`는 미실행의 정직한 표기이지 사람의 QA PASS가 아니다.
- 제품 변경 파일, 기존 테스트/정적 분석/QA 실패 원본, `package.json` 및 lock version `0.135.5`, AC1~AC5·문서/증거 링크를 그대로 보존한다. QA·CI/Ruleset 검증기 자체는 변경하지 않는다.
- 변경사항은 Work Packet·활성 PLAN·PR 본문의 QA 선택 및 최신 상태 기록에 한정한다. **DOCUMENTATION_SYNC:** `docs/exec-plans/active/ISSUE_825.md` UPDATED (QA 전환·Trusted 실패 원본·경계), `docs/exec-plans/active/PLAN.md` UPDATED (현행 QA 방법 및 Run 인계), `docs/QA_REVIEW_POLICY.md` N/A (기존 #598 정책 적용), `AGENTS.md` N/A (실행 지침 변경 없음), `docs/TEST_PLAN.md` N/A (테스트·AC 검증 계약 불변), `docs/PROJECT_UX.md`, `docs/LOGISTICS_DASHBOARD.md`, `CHANGELOG.md` N/A (제품/사용자 기능 추가 변경 없음), `DESIGN.md` N/A (디자인 계약 불변), `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/SCHEDULING_ENGINE.md` N/A (API/DB/일정 변경 없음), `docs/CI_CD.md`, `docs/REMOTE_VALIDATION.md` N/A (CI/검증 정책과 실행 계약 불변).
- 원본 Full CI의 성공은 새 HEAD 성공으로 재사용하지 않는다. 새 `pull_request/synchronize` Full8+Quality/Docker 및 trusted main QA의 **실제 Run/Attempt·Head/Base/Test Merge**는 새 HEAD 게시 후 확인한다. 신규 Trusted QA가 PASS여도 Owner의 별도 HIGH 위험 수용, Manager ACCEPT·병합 승인, 정식 릴리스 승인(`release_authorized=false`)은 자동 성립하지 않는다.
- 요청 범위: 신규 PR CI **시작까지**. CI 결과 모니터링, PR 병합, Main CI, GHCR 게시, 정식 Release, branch cleanup, Issue 종료는 수행하지 않는다. MERGE_READY=BLOCKED.
