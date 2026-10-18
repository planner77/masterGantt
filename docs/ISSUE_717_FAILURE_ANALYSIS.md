# Issue #717 — PR CI 누적 실패 분석 및 REWORK 원장

정규 실패 원장: `docs/ISSUE_717_FAILURE_ANALYSIS.md`. Primary Issue [#717](https://github.com/planner77/masterGantt/issues/717); 문서 설계 PR [#718](https://github.com/planner77/masterGantt/pull/718). [공통 실패 지침](PR_CI_FAILURE_TRIAGE.md) #704에 따라 원본 Run/Attempt는 성공 시에도 **원본 FAIL 유지**, 새 실패 때 동일 파일에 추가한다.

## 이력 범위·실패 매트릭스 (2026-10-18 최초 조사)

조회한 `Refs #717` 연계 PR: **#718 하나**. 해당 PR branch `docs/issue-717-name-first-identifier-policy`의 접근 가능한 Full CI는 **1회**(Run #2923 attempt 1). 이전 별도 PR/실패 원장 없음. GitHub 제한·조회 기간 외 실행은 미확인으로 남긴다.

| 실패 ID | 원본 PR / Run / Attempt / Head | 실제 실패 원인·단계 | 보완 및 후속 상태 |
| --- | --- | --- | --- |
| F-001 | PR #718 · [CI #2923.1](https://github.com/planner77/masterGantt/actions/runs/39080414283) · `39080414283.1` · `23e09aada982087047d90037704cdbb8b750bf97` | `POLICY_CI`: PR body risk/QA key의 **독립 전체 줄 선언 부재**, Work Packet **정규 heading 및 행 구조 부재**. Preflight FAIL 5, QA route BLOCKED, Fast Gate 실패, 3 required aggregate 파생 FAIL | 기존 검증기 보존. PR 본문 필드·동일 Work Packet exact section/AC mapping 교정. 새 동일 SHA 로컬 테스트 및 remote Full PASS는 **NOT TESTED** |

### F-001 원본 고정 증거

- **귀속:** PR #718, Issue #717, event `pull_request`, branch `docs/issue-717-name-first-identifier-policy`, Run created 2026-10-17 23:48:25 UTC (=2026-10-18 08:48:25 KST), workflow `CI`, attempt 1.
- **Ref:** Head `23e09aada982087047d90037704cdbb8b750bf97`; Base main `6fea0397bc07d0c3adf2d769f9ba6829473503a2`; GitHub test-merge `fc3aada1cc42043ede90e4af6c7d0c46320218ad` (Fast Gate checkout 로그). 원본은 변경 없이 참조한다.
- **최초 차단 [QA trust boundary job #117536033073](https://github.com/planner77/masterGantt/actions/runs/39080414283/job/117536033073):** `QA 경로 BLOCKED: PR 본문 qa_method의 명시값 필요`.
- **직접 실패 [QA Preflight job #117536064475](https://github.com/planner77/masterGantt/actions/runs/39080414283/job/117536064475):** 전체 5 FAIL: `RISK_LEVEL`·`QA_METHOD`·`QA_REQUIRED` 각각 '정확히 한 개의 선언 필요'; `PATH_POLICY`는 선행 선언 오류의 파생; `DOCUMENTATION_SYNC`는 `Work Packet ## DOCUMENTATION_SYNC 누락`. `PRIMARY_ISSUE`·`ISSUE_AC`는 PASS. [원본 Preflight artifact](https://github.com/planner77/masterGantt/actions/runs/39080414283/artifacts/12118229350).
- **파생 [Fast Gate #117536096158](https://github.com/planner77/masterGantt/actions/runs/39080414283/job/117536096158):** `PREFLIGHT_RESULT=failure`, `POLICY_REQUIRED=true`이나 `POLICY_RESULT=skipped` → FAIL. 필수 집계 `quality #117536119969`, `e2e #117536120004`, `docker #117536120008` **모두 FAILURE**(전제조건 차단 반영).
- **실행 여부:** `policy`/typecheck/lint/unit/Next.js build/Chromium PR shard 6개/Docker 실제 구현 Job은 **SKIPPED / NOT RUN**. `QA Final — Automated`도 **SKIPPED**. 앱 UI 실패·flaky/E2E/물류 로직 결함으로 추정할 증거가 없다.
- **분류:** `POLICY_CI`(문서·PR metadata 계약 위반); (신규 원인). 인증 검증기 자체의 버그로 판정하지 않는다. parser의 전체 줄 선언과 `## DOCUMENTATION_SYNC`·`## AC_TEST_COVERAGE` exact heading, `- \`path\`: UPDATED/N/A(reason)`, `- AC1: ...`~`- AC8: ...` 형태는 `scripts/qa_preflight.py` 및 `scripts/qa_final_automated.py`가 실제 요구한다.

## 재발 원인·보완 계획과 교차 검증

1. **PR 본문 정규 계약:** 키별 정확히 한 줄 `risk_level: LOW`, `qa_method: OWNER_MANAGED`, `qa_required: false`, `release_required: false`, `release_authorized: false`; canonical `Refs #717` 한 줄 유지. 기존 bullet의 inline `\`risk_level: LOW\``는 정규 표현식의 전체 줄 선언이 아님. CI 코드 수정 또는 파서 완화 금지.
2. **Work Packet 정규화:** headings 정확히 `## DOCUMENTATION_SYNC` / `## AC_TEST_COVERAGE`; 수정 파일별 `UPDATED`, 보존 계약은 각 파일별 `N/A(reason)`. Issue AC1~AC8 각각의 **개별 한 줄 mapping**에 실제 구현·검증의 미완료/NOT TESTED를 정직하게 표기. 이번 docs-only이므로 제품 수용 기준을 완료로 체크하지 않는다.
3. **현재 직접 영향:** `DESIGN.md` 내용 불변. `docs/exec-plans/active/ISSUE_717.md`와 `docs/exec-plans/active/PLAN.md`, 본 원장만 추가/수정. PR metadata는 정확한 head에서 유효하게 하며 commit SHA는 branch ref 게시 후 다시 도출.
4. **로컬 정적 회귀:** Issue의 AC1~8과 본문 단일 `Refs`, PR의 풀라인 5개 key를 parser에 맞춰 검사. DOC_SYNC 행과 변경 파일 대응·필수 문서가 일치하는지 검토. 로컬 Python / GitHub Actions는 직접 실행된 것만 PASS로 분리하며 실행 미확인은 NOT TESTED.
5. **원격 새 Full PR CI:** PR main base 변경 여부와 미해결 review thread 0/충돌 없음 확인 → 준비한 보완을 branch 1회 이동하여 PR `synchronize`로 Full CI 생성. edited 메타데이터 이벤트가 생기면 반드시 **metadata-only ≠ full CI**로 구별. 새 Run/Attempt/Head의 required quality/e2e/docker 및 Trusted QA는 실제 완료 전 PASS 아님.

### 누적 범위 및 인계

- 과거 **실제 실패 테스트 파일 합집합: ∅** — 실행된 제품 테스트 자체가 없었다. 의미는 “테스트 전부 성공”이 아니라 “미실행”이다.
- 기존 Run이 취소되거나 재실행된 시도가 추가 확인되면 원본을 소급 수정하지 말고 F-002 이후 새 절을 추가한다.
- 담당: Manager=PR metadata/Work Packet/doc 영향 및 최종 판정; infra=Git 변경 묶음 게시·CI Run 증거; frontend=후속 UI 실제 구현·테스트; qa_docs=증거 검토. 이번 재작업은 **문서 CI 정상화**, 제품 구현·main merge·GHCR·Issue Close 제외.
- 완료 조건(이번 요청): 새 Head를 반영한 **새 Full PR CI 실행 시작**. 모니터링·CI 성공·Trusted QA PASS·Owner 병합 승인은 후속 실제 결과 없이는 주장하지 않는다.


## 2026-10-18 제품 구현 재개와 추가 원장

- 이전 Full #2923.1 원본 FAIL은 불변이다. Issue의 [당시 STATUS](https://github.com/planner77/masterGantt/issues/717#issuecomment-6243490398)는 metadata-only [#2926.1 / 39081286379](https://github.com/planner77/masterGantt/actions/runs/39081286379)도 구 Head `23e09aada982087047d90037704cdbb8b750bf97`에서 FAIL했다고 기록한다. 이 보조 실행은 새 Full #2927.1(`39081290832`, head `d97f1e60419575f4db3785c239b3ae341b3086d5`)의 결과를 대신하지 않는다. 이번 요청은 CI 모니터링을 제외하므로 #2927의 최종 결론을 새로 추정하지 않는다.
- 현재 제품 구현은 기존 docs-only 범위를 확장한 신규 묶음이며 최신 main을 보존하고 충돌 PLAN을 통합한다. PR metadata를 MEDIUM/OWNER_MANAGED/qa_required=true와 release_required=true/release_authorized=false로 교정한 뒤 최종 소스 tree를 한 번 게시한다. metadata-only 이벤트는 Full과 구별한다.
- 로컬 신규 E2E 최초 실패: implicit textarea label의 exact 질의 불일치(명시 aria-label 보완), count badge를 포함한 공정 tab의 exact name selector(실제 AX 이름 사용), search input의 role=textbox 오인(searchbox/label selector 수정). 원래 원문/검색/권한 assertion을 완화하지 않았다. interrupted 실행은 PASS로 집계하지 않는다.
- 독립 PRE_QA는 모바일 공정 identity 약60px 붕괴와 관계 후보의 같은 표시 부모 이름 충돌, Resource Plan 원문 코드·Target ID 접근 누락을 발견했다. 셀 예산/내부 scroll과 실제 cell>=220px 단언, 표시 context 기준 동명 보조, 각 원문 disclosure로 보완했다. 초기 REWORK는 보존하고 새 source 검증을 분리한다.
- 실제 HTTP 새 테스트 초기 setup HTTP400은 필수 description 입력 누락으로 fixture를 수정했다. 제품 HTTP validation을 완화하지 않았다. 최종 실행 결과는 Work Packet/인계 원장으로 구별한다.

- 로컬 전체 Vitest는 2875PASS/3SKIPPED/보안 KDF2FAIL(5초 timeout과 capacity 후속 결과). 제품 보안 소스 변경 없이 관련 보안 파일10+새 Milestone1의 좁은 재실행11/11PASS이며 전체 최초 FAIL은 유지한다. full build·다중 Chromium·잘못 포함한 task-local 생성물 lint가 동시에 실행된 부하가 있었으나 인과를 확정하지 않는다.
- 관련 Chromium66의 최초 소스는 닫힌 disclosure의 숨겨진 버튼을 실제 visible geometry로 계산(5폭 FAIL), 코드 병기 제거 뒤 기존 global name selector 중복(공정1), 예전 code 포함 resource button selector(관련 status)로 실패했다. visible-only 측정·명시 원문 hidden 단언·정확 panel/name selector로 보완하며 기존 허용 오차·mutation/권한/본문 검증은 유지한다. 해당 최신 실패 재검증을 별도 기록한다.
- Local Pre-PR는 MEDIUM이 path HIGH 최소분류보다 낮아 BLOCKED → HIGH 승격 후 미등록18경로·동시 생성물 sourceStable=false로 BLOCKED. 수동 영향 매핑과 개별 실행 증거는 별도이며 자동선택기 정책을 바꾸거나 BLOCKED를 PASS로 재기록하지 않는다.

- 최종 전체 Unit 동일 제품 소스 재실행(`--maxWorkers=2`)은 234 files PASS/1 file SKIPPED, 2877 PASS/3 SKIPPED,62.60초다. 최초 전체2 FAIL은 보존하며 worker 상한으로 로컬 동시성만 제한했고 테스트 timeout·assertion·원격 CI 설정은 바꾸지 않았다.
- 관련66 최초55PASS/10FAIL/기존1SKIPPED에서 실패10의 각 후속 검증은 관리5/5·Resource9/9·공정1/1 PASS. 신규5폭/touch6/6와 real SQLite1/1 PASS. 새 Full PR CI는 별도이며 성공을 미리 선언하지 않는다.
## 2026-10-18 누적 검토 — 제품 구현 Full #2935.1 실패 (F-002 / F-003)

### 원본 수집과 Cross-run 실패 매트릭스

2026-10-18 11:37 KST 전후 GitHub 원본 조회. #717의 연결 PR은 #718 하나, 브랜치 `docs/issue-717-name-first-identifier-policy`. Run `39080414283.1` (#2923.1, Full FAIL), `39081286379.1` (#2926.1, metadata-only FAIL), `39081290832.1` (#2927.1, **docs-only Full SUCCESS**, 실제 제품 E2E 생략), `39090284911.1` (#2935.1, UI 구현 Full FAIL) 네 개가 조회되었다. 다른 회수 불가 Run/Attempt는 성공으로 추정하지 않는다.

| 항목 | PR / Run·Attempt / Head | 직접 실패 또는 역사적 결과 | 다른 실패와 관계 | 보완/검증 |
| --- | --- | --- | --- | --- |
| F-001(역사적) | #718 / [#2923.1](https://github.com/planner77/masterGantt/actions/runs/39080414283) / `23e09aada982087047d90037704cdbb8b750bf97` | 위험도/QA PR 선언, DOC_SYNC exact heading 누락 → Preflight 실패 | 최초 docs-only 구조, 제품 테스트 미실행 | 동일 이슈의 Work Packet·PR 메타데이터 교정; #2927.1 docs-only 성공은 당시 Head 한정 |
| F-002(별도 이벤트) | #718 / [#2926.1 metadata-only](https://github.com/planner77/masterGantt/actions/runs/39081286379) / 구 Head `23e09aada982087047d90037704cdbb8b750bf97` | 구 Head QA 경로 BLOCKED/이벤트 결론 FAIL | 새로운 Full/제품 검증이 아님 | 이전 Run 성공 대체 금지, 현재 새 Head 권한 증거 불가 |
| F-003a (직접) | #718 / [#2935.1](https://github.com/planner77/masterGantt/actions/runs/39090284911) · Shard4 Job [117565762633](https://github.com/planner77/masterGantt/actions/runs/39090284911/job/117565762633) / Head `a0d6cafe9cbc7c73f4980fd36498c628d8f024dc` | `tests/e2e/logistics-target-authoring.spec.ts:14` `locator.fill` strict mode: 동일 이름 `인스턴스 코드`로 read-only textarea 2개 + editable input 1개(3개) | **TEST_CONTRACT**: ID disclosure 도입 후 제어 대상 locator 범위 모호. 실제 서버 mutation/assertion은 그 단계 도달 전 | 새 인스턴스 fieldset + role=textbox, 이름-first 후보 checkbox 범위·코드 필요 예외 조정. 단순 `.last()` 선택/숨김 강제 금지 |
| F-003b (취소 Job 안 실제 FAIL) | #718 / [#2935.1](https://github.com/planner77/masterGantt/actions/runs/39090284911) · Shard5 Job [117565762565](https://github.com/planner77/masterGantt/actions/runs/39090284911/job/117565762565) / 동일 Head | `tests/e2e/issue-622-resource-plan-target.spec.ts:53` → `helpers/identifier-details.ts:7`: 원문 `Target ID` 탐색 결과 `-1`, 5초 poll 실패 | **PRODUCT/PRESENTATION 계약 누락**: `ResourcePlanDetails` 첫 daily 상세에는 선택 Target ID 원문 disclosure가 없고 day-assignments 행에만 제공. Job 자체는 다른 shard fail-fast로 CANCELLED이지만 내부 1 FAIL은 보존 | 현재 필터의 Target ID를 상세 공통 헤더의 닫힌 원문 disclosure로 노출. #622 동일 원본 assertion 유지 |
| F-003c (후속) | #718 / #2935.1 · [E2E aggregate](https://github.com/planner77/masterGantt/actions/runs/39090284911/job/117566293051) 및 [자동 QA](https://github.com/planner77/masterGantt/actions/runs/39090284911/job/117566313375) | Chromium Required=FAIL, `required e2e 미성공` → QA FAIL | F-003a/b에서 파생, 독립 제품 결함으로 중복 계수하지 않음 | 새로운 exact-Head Required3/Trusted/Owner 게이트 그대로 유지 |

**Run #2935.1 고정 범위:** event=pull_request, Base `d2768676aa7a0edff67df9bdeb3e1b49979fd577`, Head `a0d6cafe9cbc7c73f4980fd36498c628d8f024dc`; 2026-10-18 02:29:47–02:34:59 UTC. Quality aggregate `SUCCESS`(TypeScript/ESLint/Unit/Policy/PR build 성공), Docker aggregate/implementation `SUCCESS`; E2E aggregate `FAILURE`. Shard4 `FAILURE`(4 PASS, 1 FAIL, 138 DID NOT RUN), Shard5 **CANCELLED**(1 PASS + 1 실제 FAIL + 80 DID NOT RUN), Shard1/2/3/6 **CANCELLED**(로그상 각각 조기 종료, 완료되지 않은 테스트는 PASS 아님). PR `--max-failures=1` 및 matrix fail-fast 동작은 CI 설정대로이며 별도 오류로 단정하지 않는다. Test traces는 Shard4/5 각각의 `playwright-report-shard-4/-5` artifact에 있으며 [원본 artifacts](https://github.com/planner77/masterGantt/actions/runs/39090284911)에서 조회한다. QA Preflight와 PR Fast Gate는 SUCCESS; 승인 근거 아님.

### 누적 교차 원인과 수정 결정

1. F-001/2는 **문서/PR QA metadata 구조**이고 F-003a는 숨긴 textarea가 추가되며 바뀐 **접근성 검색 범위**, F-003b는 Resource Plan 상세의 **원본 ID 접근 경로 누락**이다. F-003a/b를 환경/flaky로 뭉개지 않고 각각 직접 교정한다.
2. 같은 새 표시 원칙의 간접 소비자: `logistics-target-authoring.spec.ts`의 Target/ACS/MCS 후보에서 코드를 항상 괄호로 기대하는 구형 selector, `issue-623-resource-mvp.spec.ts`의 ACS B subset 및 리소스 배정 코드, `issue-622-resource-plan-target.spec.ts`의 배정 코드. **동명이 아니라면 이름만 primary**, 코드/ID 검색·canonical 저장/관계·whole/subset/readonly/revision·원본 수정은 기존 단언 유지. 관련 Test Plan에 영향 매핑한다.
3. Resource Plan selected/project 참고의 원본: 첫 daily/개인 상세에서도 **출발 필터가 선택한 Target ID**에 접근 가능한 disclosure를 제공한다. 단지 숨긴 값이 있는지 검사하기 위해 필터/서버/조회 흐름을 변형하지 않는다. `unassigned`에는 가상의 UUID를 만들지 않는다.
4. 로컬 원본 repository/node_modules/Chromium이 이 실행 환경에 없으므로 전체 동일-source Playwright 재현·교차 실행은 **NOT TESTED**. GitHub 원격 소스+로그 대조 및 diff·exact selector 구조 정적 검토는 가능. CI 설정/timeout/retry/test skip·expect 완화는 하지 않는다.
5. 보완 후보는 기존 Issue #717 브랜치·PR을 재사용하고 blob/tree/commit 준비 후 단일 non-force ref update로 게시한다. 최신 main/Head, 리뷰 thread0/mergeable 및 Work Packet 문서 정합성을 게시 직전 재검증한다. **새 Full PR CI Run ID/Attempt는 실제 Actions 조회 후 기록**하며 그 전 remote 결과는 NOT TESTED다.

### 다음 CI에서의 판정 기준

- 직접 두 파일(#717 Target authoring, #622 Plan)과 간접 #623 및 신규 #717 이름-first/동명/권한/원문, 전체 Chromium6 shard를 실행해 통과할 때만 E2E PASS. 원본 실패의 종료가 로그상 재현 불가인 경우 원인 단정하지 않는다.
- CI Run 등록 자체는 PASS가 아니다. #2935의 shard5 내부 실패 및 F-001/F-002 실패 이력을 지우거나 과거 SUCCESS로 대체하지 않는다.
- PR CI 성공 후에도 UI 주요 AC의 사용자 수용/Owner 승인·병합/Main/정식 GHCR/이슈 종료는 별도 확인한다.

## 2026-10-18 최신 main #449 합류·충돌 해소 기록

- 준비 당시 #717 Head `a0d6cafe9cbc7c73f4980fd36498c628d8f024dc`, Base `d2768676aa7a0edff67df9bdeb3e1b49979fd577`; 이후 `main`은 [#449 PR #458](https://github.com/planner77/masterGantt/pull/458) 병합 `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`으로 5커밋 앞섰고 GitHub `mergeable_state=dirty`로 조회됐다. 소스 컴포넌트·E2E는 main 변경과 중첩되지 않았고 `DESIGN.md`(4 diff hunks)와 `docs/exec-plans/active/PLAN.md`(새 #449 상단 절)만 양쪽 수정이다.
- 충돌 해결: #717의 이름 우선 정책/지난 실패/구현과 #449의 내부 KPI 참조·목록/입력/검증 정책, ISSUE_449 문서 3개와 PLAN #449 기록을 **양방향 보존**한 신규 두 부모 merge commit으로 최신 main을 브랜치에 포함한다. 공통 원칙과 과거 수행 증거를 삭제/덮어쓰기 하지 않는다.
- 원본 #2935.1 Head/Base/실패 로그는 불변, 신규 exact Head 테스트는 시작 전 **NOT TESTED**. 리뷰 thread0과 충돌 해소 여부는 ref 게시 후 API를 다시 확인한다.

## 2026-10-18 — F-004: PR #718 Full CI #2940.1 Milestone 390px geometry 실패 (누적 원장)

### 누적 Run/Attempt 비교 및 원본 증거
이 문서는 **Primary Issue #717 전용 단일 누적 실패 원장**이다. F-001~F-003 당시 로그와 원인·보완 기록을 삭제하지 않는다. 관련 PR은 #718 하나이며 접근 가능한 다섯 Run의 상태는 아래와 같다.

| 이력 | SHA와 원본 결과 | 이전 수정·이번 연관성 |
| --- | --- | --- |
| [#2923.1](https://github.com/planner77/masterGantt/actions/runs/39080414283) | Head `23e09aada982087047d90037704cdbb8b750bf97`, Full FAIL | F-001 PR 위험도·QA 선언과 Work Packet 문서 구조 미충족, 실제 제품 E2E 미실행 |
| [#2926.1](https://github.com/planner77/masterGantt/actions/runs/39081286379) | 같은 Head, metadata-only FAIL | F-002; 구 Full 증거를 대체하는 실행 아님 |
| [#2927.1](https://github.com/planner77/masterGantt/actions/runs/39081290832) | Head `d97f1e60419575f4db3785c239b3ae341b3086d5`, docs-only Full SUCCESS | 당시 문서/QA 구조 보완 확인, 실제 제품 Chromium/Docker 구현 SKIPPED |
| [#2935.1](https://github.com/planner77/masterGantt/actions/runs/39090284911) | Head `a0d6cafe9cbc7c73f4980fd36498c628d8f024dc`, Full E2E FAIL | F-003a Shard4 `logistics-target-authoring.spec.ts:14` 동명 입력/원문 selector, F-003b Shard5 CANCELLED Job 내부 `issue-622-resource-plan-target.spec.ts:53` Target ID 누락. 새 #2940에서 두 재현 케이스 각각 PASS 확인 |
| [#2940.1](https://github.com/planner77/masterGantt/actions/runs/39091834164) | Head `6b226df1962791a4d647811b9ad8df854d56e3a1`, Full E2E FAIL | **F-004 새로운 Milestone 기본 비표시/geometry 계측 소비자 오류**. 앞선 실패 원인의 단순 재발로 취급하지 않음 |

**F-004 immutable source:** `pull_request`, Run ID/Attempt `39091834164.1` (2026-10-18 02:56:08~03:01:12 UTC), Base `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`; Head 위 SHA. Policy/Preflight/Fast Gate, TypeScript·ESLint·Vitest·Next Build 및 Quality aggregate 모두 SUCCESS. Docker 구현/aggregate SUCCESS. E2E aggregate [Job #117570857792](https://github.com/planner77/masterGantt/actions/runs/39091834164/job/117570857792) FAIL; QA Final — Automated [Job #117570874007](https://github.com/planner77/masterGantt/actions/runs/39091834164/job/117570874007) FAIL은 required E2E 실패에 따른 **파생 차단**.
- **Shard1 Job [#117570351610](https://github.com/planner77/masterGantt/actions/runs/39091834164/job/117570351610):** 7 PASS, 1 FAIL, 126 DID NOT RUN. `tests/e2e/milestone-dashboard-state.spec.ts:58`의 #463 readonly/F 분리·키보드·5폭 UI 회귀, 첫 **390px**에서 `expect(table.headerBodyAligned && table.allControlsContainedInCells && table.siblingCellsNonoverlapping && table.siblingControlsNonoverlapping).toBe(true)`가 actual `false`.
- **Shard2/3/4/5/6:** 전체 Job은 `CANCELLED`(PR maxFailures=1/matrix fail-fast). 로그에 확인된 신규 assertion FAIL은 없으나 미실행은 PASS 아님. Shard4의 이전 F-003a `logistics-target-authoring` 초기 Target A/B·다음 2 케이스 PASS, Shard5 이전 F-003b `issue-622-resource-plan-target` PASS; 이는 이번 exact Head에서 도달한 부분만의 증거.
- **원본 Playwright [shard1 report artifact #12122463440](https://github.com/planner77/masterGantt/actions/runs/39091834164/artifacts/12122463440):** report ZIP/error-context/Trace 확보. Accessibility snapshot의 `<details>`는 기본 닫힌 '식별 정보' summary만 노출하고 내부 복사 버튼은 화면에 나타나지 않음. 테스트 소스는 닫힌 copy 버튼까지 `tbody button` DOM query로 모아 bounding rect를 첫 셀과 비교했다.

### 원인 분류·수정 (사실 / 유력 가설 구분)
- **TEST_CONTRACT / FIXTURE_OBSERVABILITY:** #717 `IdentifierDetails`가 닫힌 native `details` 안에 `작업 ID 복사` 버튼을 보유한다. DOM query에는 포함되지만 실제 배치 rect가 없는 hidden 버튼을 구 #463 geometry 수집기가 painted control로 계산하므로 셀 안에 들어가지 않는 결과가 가능하다. 기존 #550 관리 E2E와 Resource UI geometry는 이미 `checkVisibility()` 기반 선택을 사용한다.
- **남은 불확실성:** 기존 #463의 4개 boolean을 하나로 묶어 검사했으며 runner의 `geometry-partial-390.json`을 Playwright artifact에 넣지 않아 **실제 false 필드와 별도 실배치 문제의 동시 존재 여부는 아직 확증 불가**. 화면 전체 겹침 또는 제품 오류가 없었다고 단언하지 않는다. 이 불확실성을 해결하도록 다음 Full에서 flag별 assertion과 JSON attachment를 추가한다.
- **최소 수정:** `tests/e2e/milestone-dashboard-state.spec.ts`에서 DOM에 숨긴 copy 버튼이 실제 존재하고 닫혀서 `toBeHidden()`인 **별도 음성 확인**을 유지한다. table cell/control bounding 검증은 painted `checkVisibility() && rect.width>0 && rect.height>0`에 한정. 4개의 alignment/containment/overlap 각각의 기준은 동일하게 참이어야 하고, 260px 첫 열·1052px 표 너비·5폭·focus/keyboard/inert/scroll/readonly write0 assertions, E2E timeout/retry/CI fail-fast는 변경하거나 생략하지 않는다.
- **진단 확보:** width별 geometry JSON을 기존 runner local `output/playwright/issue-463`에 저장하면서 **Playwright `test.info().attach`**에도 assertion *이전에* 기록한다. 이후 실패 시 `headerBodyAligned`, `allControlsContainedInCells`, `siblingCellsNonoverlapping`, `siblingControlsNonoverlapping` 중 실제 실패 key와 해당 표 index/화면폭을 보고한다.
- **소비자 집합:** #463 `milestone-dashboard-state` 직접; #717 `issue-717-name-first` 5폭/ID 펼침·복사, #550 `milestone-management`, Target/Resource #622/#623와 앞선 #2935 교정 Target authoring 등 변경 영향. 다른 샤드 취소 시 실제 교차 검증은 계속 `NOT TESTED`.
- **검증 상태:** CI 원본 로그/스냅샷·저장소 소스/정적 회귀 설계 확인은 수행. 현재 실행 환경은 masterGantt checkout/node_modules/Playwright 프로젝트가 없어 실제 동일-source 전체 브라우저·Node 검증은 `NOT TESTED`. 다음 Run 시작만으로 PASS나 QA/Owner 승인 주장 금지. `HIGH/OWNER_MANAGED/qa_required=true`, app`0.116.1`, `release_required=true`, `release_authorized=false`. Issue OPEN/Draft 유지, Merge/Main/정식 GHCR/종료 별도.

## 2026-10-18 — F-005: Full PR CI #2942.1 E2E #621/#461 동시 실패·전체 원장 대조

### 원본 Run/Attempt 및 누적 실패 테스트 합집합
**Primary Issue #717 / PR #718의 단일 정규 실패 파일**은 이 `docs/ISSUE_717_FAILURE_ANALYSIS.md`다. 앞의 F-001~F-004 항목을 변경·삭제하지 않고, 기존 시점의 가설/검증 범위를 그대로 보존한다. Github Actions branch 조회 시 동일 PR에 6개 Run이 있었다.

| 원본 Run/Attempt | Head SHA | 범위/결론 및 이번 교차 비교 |
| --- | --- | --- |
| [#2923.1](https://github.com/planner77/masterGantt/actions/runs/39080414283) · `39080414283.1` | `23e09aada982087047d90037704cdbb8b750bf97` | docs-only Full FAIL, QA 선언 및 `DOCUMENTATION_SYNC` 문서 파서 F-001. E2E 실제 미실행 |
| [#2926.1](https://github.com/planner77/masterGantt/actions/runs/39081286379) · `39081286379.1` | `23e09aada982087047d90037704cdbb8b750bf97` | metadata-only FAIL F-002, Full CI 증거를 대체할 수 없음 |
| [#2927.1](https://github.com/planner77/masterGantt/actions/runs/39081290832) · `39081290832.1` | `d97f1e60419575f4db3785c239b3ae341b3086d5` | docs-only Full SUCCESS, 제품 Chromium/Docker 구현은 SKIPPED |
| [#2935.1](https://github.com/planner77/masterGantt/actions/runs/39090284911) · `39090284911.1` | `a0d6cafe9cbc7c73f4980fd36498c628d8f024dc` | E2E Shard4 `logistics-target-authoring` F-003a, Shard5 CANCELLED 중 내부 `issue-622-resource-plan-target` F-003b 실제 FAIL |
| [#2940.1](https://github.com/planner77/masterGantt/actions/runs/39091834164) · `39091834164.1` | `6b226df1962791a4d647811b9ad8df854d56e3a1` | Shard1 `milestone-dashboard-state` 390px 합성 geometry F-004. #2935의 두 Target/Resource 실패 케이스는 새 Head에서 PASS 확인 |
| **[#2942.1](https://github.com/planner77/masterGantt/actions/runs/39093363065) · `39093363065.1`** | **`6d23240008b0022f5376c5f8c4dcb0d1a3fadffd`** | 이번 F-005a Shard3 `issue-621-resource-target` FAIL + F-005b **Shard2 CANCELLED 안 실제** `milestone-stage-editor` FAIL. 이전 F-004 `milestone-dashboard-state`는 Shard1에서 PASS 확인 |

**전체 직접 실패 E2E 파일 합집합 (원본 Shard/Head별 별도 검사):** `tests/e2e/logistics-target-authoring.spec.ts` (#2935), `tests/e2e/issue-622-resource-plan-target.spec.ts` (#2935), `tests/e2e/milestone-dashboard-state.spec.ts` (#2940), `tests/e2e/issue-621-resource-target.spec.ts` (#2942), `tests/e2e/milestone-stage-editor.spec.ts` (#2942). #2923/#2926은 정책/메타데이터 실패로 E2E 파일 합집합에서 제외한다. 취소/미실행 테스트는 PASS로 합산하지 않고 다음 실행의 교차 대상으로 남긴다.

### F-005 원본 증거와 파생 실패 구분

- **Run:** event=`pull_request`, Run ID `39093363065` Attempt 1, 2026-10-18 03:22:01~03:32:02 UTC. PR #718 Base `3eaa6026923c38f200a463f6985c7cc8f88f9bf0` / Head `6d23240008b0022f5376c5f8c4dcb0d1a3fadffd`. TypeScript/Lint/Unit/Policy/PR build·QA Preflight·PR Fast Gate·Quality aggregate 모두 **SUCCESS**, Docker build/smoke/aggregate **SUCCESS**. [Chromium E2E aggregate](https://github.com/planner77/masterGantt/actions/runs/39093363065/job/117576337830) **FAILURE**; [QA Final Automated](https://github.com/planner77/masterGantt/actions/runs/39093363065/job/117576350300) **FAILURE (required E2E 미성공 파생)**, 실제 제품 QA 독립 결함으로 중복 계산하지 않는다.
- **F-005a Shard3 [Job #117574935119](https://github.com/planner77/masterGantt/actions/runs/39093363065/job/117574935119)**: 41 PASS/1 FAIL/58 DID NOT RUN. `tests/e2e/issue-621-resource-target.spec.ts:335`의 정확 Assignment 한 개인 편집/동료 보존/412·401 검증에서 line 362 `editor.getByLabel("리소스 1 ALICE · 긴 공동 담당 리소스 이름 (ALICE) 투입률 (%)")`가 5초 내 존재하지 않아 `toHaveValue("100")` 실패. 제품 `task-assignment-editor.tsx`의 현재 `identity`는 동일 이름이 중복된 경우에만 코드 괄호를 표시하는 #717 계약. fixture의 ALICE/BOB·Target A/B는 **이름이 서로 달라** 코드 suffix를 기본 노출하지 않음. **TEST_CONTRACT / 접근성 라벨 이전 기대 불일치**. 필드가 없다는 사실만으로 배정 값이 사라졌다고 판정하지 않음. 다른 `투입 시작/종료` 및 Target checkbox도 같은 구형 suffix 가정이 있으므로 함께 수정해 뒤에서 순차 실패하지 않게 한다.
- **F-005b Shard2 [Job #117574935210](https://github.com/planner77/masterGantt/actions/runs/39093363065/job/117574935210)**: Job 최종 `CANCELLED`이지만 로그의 **46 PASS / 1 FAIL / 1 SKIPPED / 72 DID NOT RUN**을 독립 보존. `tests/e2e/milestone-stage-editor.spec.ts:9`, 5폭 중 처음 노출된 Milestone 소속 편집 UI geometry의 line 133, col 361 `expect(measure.allControlsContainedInCells).toBe(true)`가 실제 false. `milestone-membership-panel.tsx`는 `IdentifierDetails` raw code/ID를 **닫힌 native details**로 소속 표의 첫 열에 삽입했고, 구 E2E는 `tbody td button`을 전부 `getBoundingClientRect()`로 계측한다. 이때 닫힌 원문 안의 hidden copy button은 DOM에 있으나 표시되지 않아 0 rect가 셀 바깥으로 계산될 수 있다. **TEST_CONTRACT/GEOMETRY_OBSERVABILITY**. 정확 390/768/1024/1440/1920px 중 어느 폭인지는 기존 실패 line에 별도 width 진단이 없으므로 최초 폭 가능성이 높지만 원본 근거만으로 **확정하지 않는다**.
- **그 외 4개 Shard1/4/5/6:** final `CANCELLED`·미실행 영역 존재. Shard1의 #463 `milestone-dashboard-state.spec.ts` 주요 시나리오를 포함한 도달 테스트 PASS, Shard4 `logistics-target-authoring` 7개 케이스 PASS, Shard5 이전 #622 `issue-622-resource-plan-target` PASS 등 이전 직접 실패에 대한 긍정 사례를 확인했으나 6-Shard 전체 성공이 아니다. PR `--max-failures=1`, matrix fail-fast는 의도된 취소 동작이므로 실행 정책 자체를 약화·해제하지 않는다.

### 원인별 단일 묶음 보완 및 예방 소비자

1. **실제 Code/ID와 표시 Label 분리:** `tests/e2e/issue-621-resource-target.spec.ts`의 배정 `투입률`·`투입 시작`·`투입 종료` label에서 **동명이 아닌 fixture**의 코드 괄호 기대를 제거, `리소스 2` 미노출 음성 검사도 갱신. 나머지 ALICE exact assignment ID, %100→80, companion BOB 그대로, 412 이후 초안 유지, 401 이후 mutation0, 재진입 focus/재편집, request 수, 3개 canonical body/State 검증 유지. 같은 파일의 Target B 체크/해제도 이름-first `getByRole("checkbox", {name: f.targets[1].name, exact:true})`로 갱신하고 기존 저장/변경 무효화 assertion 불변. 테스트 데이터를 동명으로 만들거나 제품에 코드를 강제 노출하지 않는다.
2. **#461 숨김 control과 실제 위치 구분:** `tests/e2e/milestone-stage-editor.spec.ts`에서 닫힌 `tbody details:not([open]) button`의 DOM **존재 + toBeHidden** 음성 검증을 추가. 소속 테이블의 first visible button과 전체 `allControls`는 `checkVisibility() && rect.width>0 && rect.height>0`로 제한해 실제 렌더 버튼의 `allControlsContainedInCells`/sibling overlap 및 각 셀 정렬/960px 표/포커스/스크롤/수정·재개·HTTP/SQLite 무결성 검증은 유지. 폭별 measured JSON을 **assertion 전에** Playwright `test.info().attach`로 보존해 이후 실패의 수치를 인증.
3. **동일 유형의 미실행 간접 소비자 선정:** `tests/e2e/issue-623-resource-mvp.spec.ts`의 Target tree 행도 `IdentifierDetails`를 갖는데 5폭 geometry 측정에서 `tbody button` 모두를 0 rect 포함해 계측하고 있었다. 이 동일 계측 문제를 **이번에 예방 보완**: tree의 닫힌 copy 버튼을 실제 hidden 확인, painted 버튼만 containment 검사, 표시 버튼 count>0·header/cell 정렬/overflow/keyboard/조회 mutation0 원래 strict 검사 유지. Matrix는 ID disclosure 없으므로 기존 전체 버튼 검사 유지(모두 rendered).
4. **소스 경계:** App Source/DB/API/DTO/Export/리소스 Allocation 로직/보안·revision/Gantt Core는 변경하지 않는다. CI required3/Shard6/timeout/maxFailures/rerun/retry/skip·권한·release 조건 완화하지 않는다. 과거 F-001~F-004 각 실패의 원래 Run/Job/코드 상태 불변.
5. **동결 source 재검증:** 이 챗 실행 환경에는 `masterGantt` 동일-source npm/node_modules/브라우저 설치 checkout이 없어 실제 Playwright/전체 Vitest/Next build 재실행 `NOT TESTED`. 원격 원본 로그·source 위치/라벨 생산자/피해 소비자 정적 대조만 수행, CI 시작 전 PASS 주장하지 않는다. 새 PR synchronize는 기존 Branch/PR #718 한 번만 fast-forward 게시하고 최신 main·미해결 스레드/충돌 재확인 후 새 Full Run/Attempt/Head만 기록한다.

### 다음 Full 검증 경계

**필수 직접+교차:** `issue-621-resource-target` exact edit/412/401, `milestone-stage-editor` 5폭/원자 저장, `issue-623-resource-mvp` Target tree/matrix 5폭/원문, 과거 `logistics-target-authoring`, `issue-622-resource-plan-target`, `milestone-dashboard-state`와 신규 `issue-717-name-first`/HTTP persistence, 나머지 6 Shards. 다음 실패 시 이 원장에 **F-006**을 추가하고 다시 합집합을 검토한다. 새 Head Quality/E2E/Docker/Trusted QA/Owner ACCEPT, Main/GHCR/Issue Close는 실제 완료·승인 전 `NOT TESTED`. Version `0.116.1`, `HIGH`, `OWNER_MANAGED`, `qa_required=true`, `release_required=true`, `release_authorized=false` 유지.

## 2026-10-18 — F-006: Full PR CI #2944.1 / #130 그룹 표시 + #623 Target subset E2E 새 실패

### 동일 Issue의 모든 원격 실행과 이번 원인 비교

Issue #717의 **유일한 누적 CI 실패 원장**을 지속 갱신한다. 기존 F-001~F-005(그 시점의 FAIL·가설·교정·미검증 포함)는 수정하거나 삭제하지 않는다. GitHub에서 PR #718의 현재 조회 가능한 Run 7건을 확인했다.

| Run/Attempt / Head (정확한 원격 범위) | 결과 / 직접 실패 및 교정·재발 판정 |
| --- | --- |
| [#2923.1](https://github.com/planner77/masterGantt/actions/runs/39080414283) · `39080414283.1` / `23e09aada982087047d90037704cdbb8b750bf97` | docs-only PR metadata/DOC_SYNC Work Packet Preflight 실패 F-001. 제품 E2E 미실행 |
| [#2926.1](https://github.com/planner77/masterGantt/actions/runs/39081286379) · `39081286379.1` / 같은 Head | 별도 metadata-only QA 실패 F-002. Full PR의 제품 검증 증거 아님 |
| [#2927.1](https://github.com/planner77/masterGantt/actions/runs/39081290832) · `39081290832.1` / `d97f1e60419575f4db3785c239b3ae341b3086d5` | docs-only Full SUCCESS; 실제 Chromium/Docker smoke 구현 SKIPPED. 제품 코드 합격 증거로 전용 금지 |
| [#2935.1](https://github.com/planner77/masterGantt/actions/runs/39090284911) · `39090284911.1` / `a0d6cafe9cbc7c73f4980fd36498c628d8f024dc` | F-003a Shard4 `logistics-target-authoring.spec.ts` 동일 이름 input/textarea strict mode, F-003b 취소된 Shard5 내부 `issue-622-resource-plan-target.spec.ts` 최초 daily Target ID 원문 누락. 이후 각각 보완 |
| [#2940.1](https://github.com/planner77/masterGantt/actions/runs/39091834164) · `39091834164.1` / `6b226df1962791a4d647811b9ad8df854d56e3a1` | F-004 Shard1 `milestone-dashboard-state.spec.ts` 닫힌 IdentifierDetails copy 버튼을 화면 geometry에 포함. #2944 Shard1에서는 해당 #463 E2E PASS 확인 |
| [#2942.1](https://github.com/planner77/masterGantt/actions/runs/39093363065) · `39093363065.1` / `6d23240008b0022f5376c5f8c4dcb0d1a3fadffd` | F-005a Shard3 `issue-621-resource-target.spec.ts` 배정 이름 뒤 코드 강제 기대, F-005b Shard2 CANCELLED 안 실제 `milestone-stage-editor.spec.ts` 숨긴 copy 버튼 geometry. #2944에서 #621 편집 및 #461 소속 E2E PASS 확인 |
| **[#2944.1](https://github.com/planner77/masterGantt/actions/runs/39095135631) · `39095135631.1` / `bfd4173f0099d03f3357262cea01b567a51825cf`** | **F-006a #130 그룹 button 구 표기 기대 / F-006b #623 Target B subset 전체 이름 누락.** Quality/Docker PASS, E2E 실패/QA 후속 차단 |

**이번 원본 고정:** Issue #717, PR #718, `pull_request`, branch `docs/issue-717-name-first-identifier-policy`, Run `39095135631.1` 2026-10-18 03:52:23–04:03:40 UTC, Head `bfd4173f0099d03f3357262cea01b567a51825cf`, Base `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`. 별도 test-merge SHA는 신뢰할 증거를 확보하지 못해 **UNKNOWN**(Head/Base를 대신하지 않음). 정책·QA Preflight/PR Fast Gate/TypeScript/ESLint/Unit/Next PR Build 및 **Quality aggregate SUCCESS**, Docker build/smoke 및 **Docker aggregate SUCCESS**. [E2E aggregate job 117581732726](https://github.com/planner77/masterGantt/actions/runs/39095135631/job/117581732726) FAILURE, [QA Final Automated 117581750238](https://github.com/planner77/masterGantt/actions/runs/39095135631/job/117581750238) FAILURE(필수 E2E 실패의 **파생 결과**).

### 최초 실제 실패 — 두 개의 서로 다른 E2E Shard

- **F-006a (직접):** [Chromium Shard1 Job 117580197570](https://github.com/planner77/masterGantt/actions/runs/39095135631/job/117580197570), `tests/e2e/project-filter-toolbar-consistency.spec.ts:190`, #130 Phase 4 일정·리소스 툴바/필터 5폭. `expect(...getByRole("region", {name:"그룹 현황"}).getByRole("button",{name:/개발팀 \(G-01\)/})).toBeVisible()` 가 5초 동안 `element(s) not found`. **57 PASS / 1 FAIL / 76 DID NOT RUN**. 실제 `src/features/resources/project-resource-dashboard.tsx`의 그룹 disclosure button은 `row.name`만 렌더링하고 원본 `G-01`은 인접 닫힌 `IdentifierDetails`에서만 조회·복사한다. mock fixture `tests/fixtures/resource-dashboard-ui.ts`는 name=`개발팀`, code=`G-01`(중복 이름 없음). **TEST_CONTRACT/접근성 이름 소비자 정합성**: 제품 데이터/그룹 소멸/필터 오류가 아니라 구형 UI 레이블을 찾는 locator가 맞지 않음.
- **F-006b (직접, 전체 Job CANCELLED 안 기록):** [Chromium Shard3 Job 117580197494](https://github.com/planner77/masterGantt/actions/runs/39095135631/job/117580197494), `tests/e2e/issue-623-resource-mvp.spec.ts:177` #623 Target 통합 WBS↔Resource↔Target 6 mutation. `getByRole("group",{name:"Target B 선택 구성원"}).getByRole("checkbox",{name:/^ACS B · 원본 /}).check()` 에서 **테스트 제한시간 60,000ms 초과**, 로그는 해당 Locator를 계속 기다렸음을 표시한다. **43 PASS / 1 FAIL / 56 DID NOT RUN**, GitHub Job 자체는 matrix cancellation으로 `CANCELLED`이지만 내부 실제 1 FAIL을 **반드시 보존**한다. fixture `tests/e2e/fixtures/issue-623-target-resource.ts:43`의 실제 `target.name`은 `Target B · 긴 물류 설비 통합 제어 대상 이름`이며, 제품 `task-target-binding-editor.tsx`의 `fieldset > legend`는 전체 `${target.name} 선택 구성원`. 짧은 고정 이름의 `group`은 존재하지 않는다. 즉 **TEST_CONTRACT**이며 테스트 시간 초과가 서버 timeout·GET 재시도 문제라는 근거는 없다. 선택 그룹을 fixture의 **정확한 전체 Target 이름**으로 찾고, 실제 ACS B 구성원 체크와 최종 서버 canonical `memberIds` 검증은 그대로 둔다.
- **Shard2/4/5/6** 은 최종 `CANCELLED`, 원격 로그에서 추가 독립 assertion FAIL은 관측되지 않았지만 미실행/진행 중 취소를 PASS라고 할 수 없다. #2944 기준 과거 직접 실패 파일의 **부분적 교차 반례**: Shard1 `milestone-dashboard-state` #463 PASS, Shard2 `milestone-stage-editor` #461 PASS, Shard3 `issue-621-resource-target` #621 PASS, Shard4 `logistics-target-authoring` 7개 관련 케이스 PASS, Shard5 `issue-622-resource-plan-target` PASS. 이 증거는 위 exact Head와 완료된 개별 테스트에만 귀속되며 전체 E2E6 PASS는 아님.

**누적 실제 실패 E2E 파일 합집합:** 
1. `tests/e2e/logistics-target-authoring.spec.ts` (#2935 Shard4)
2. `tests/e2e/issue-622-resource-plan-target.spec.ts` (#2935 Shard5 취소 안 실패)
3. `tests/e2e/milestone-dashboard-state.spec.ts` (#2940 Shard1)
4. `tests/e2e/issue-621-resource-target.spec.ts` (#2942 Shard3)
5. `tests/e2e/milestone-stage-editor.spec.ts` (#2942 Shard2 취소 안 실패)
6. `tests/e2e/project-filter-toolbar-consistency.spec.ts` (#2944 Shard1)
7. `tests/e2e/issue-623-resource-mvp.spec.ts` (#2944 Shard3 취소 안 실패)

### 교차 원인 / 단일 변경 묶음 / 검증 경계

- **공통 원인 분류:** F-003a/F-005a/F-006a/F-006b는 “raw code를 상시 표시하던 화면 또는 고정 짧은 이름”을 가정한 **이전 E2E 선택자 계약**과 #717 이름-first/full-name UI의 불일치. F-003b는 선택 Target 원문 disclosure 제품 경로 보완, F-004/F-005b는 raw copy 숨김 control을 layout control로 잘못 센 계측, F-001/2는 QA metadata/Work Packet. 이를 한 가지 flaky/CI 인프라 문제로 합치지 않는다.
- **F-006a 보완:** `tests/e2e/project-filter-toolbar-consistency.spec.ts` 그룹 disclosure는 정확한 `개발팀` accessible name으로 확인하되, 같은 행의 닫힌 `IdentifierDetails`를 열어 `코드=G-01` **원문 값**을 별도로 확인하고 다시 닫는다. 기존 5폭·툴바/검색·고급필터·날짜 오류·Escape/focus/API mutation 경계 assertion 유지.
- **F-006b 보완:** `tests/e2e/issue-623-resource-mvp.spec.ts`는 `getByRole("group",{ name: `${f.targets[1].name} 선택 구성원`, exact:true })`로 실제 canonical fixture의 전체 표시명에 바인딩. 자식 `/^ACS B · 원본 /` checkbox, 기존 정확 ACS-B member UUID·Target A 설비 source·여섯 별도 mutation과 revision·F0/Excel·권한·full 5폭을 그대로 검증. Test timeout 확대·재시도·skip·CI Gate 변경 없음.
- **간접 소비자 점검:** PR #718 수정 E2E 19개와 신규 `project-filter-toolbar-consistency`의 이름/코드 병기 matcher를 정적 검색. 알려진 #621/#622/Target 작성 테스트의 구형 대상 라벨은 이전 F-003/F-005에서 정리되었고 실제 #2944의 해당 도달 테스트 PASS. #623 멤버 선택 그룹의 full name은 신규 실측 입력에서 확인; 다른 고정 그룹 선택은 기존 테스트 데이터와 일치함. 전체 Repository의 미실행 테스트를 전수 로컬 통과했다고 주장하지 않음.
- **서버 계약:** 작업/Target/리소스 실제 ID, API/DB/DTO/Excel/JSON, SVAR Gantt Core, Role/권한·revision·포커스/키보드·선행 관계와 리소스 편집 동작은 변경하지 않는다.
- **검증 불가 범위:** 이 실행 환경에는 masterGantt 동일-source Node 프로젝트/npm dependency/Chromium이 없어서 로컬 Full/선택 E2E와 Vitest/Build의 새로운 후보 실행은 `NOT TESTED`. GitHub 원격 로그/Source/정적 호출 패턴 확인만 수행. CI 실행 전에 remote PASS를 주장하지 않음. 이후 Full PR CI는 strict 6 Shard/Quality/Docker/Trusted QA gate, maxFailures/timeout/retry/skip 불변. 새 Head의 통과·Owner 검토/병합/Main/GHCR/Issue Close는 사용자 승인·실제 Run 증거 이전에 `NOT TESTED`/미실행.
- **Issue Lifecycle:** PR #718/Issue #717 유지, 브랜치 1회 non-force 업데이트, `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=true`, `release_authorized=false`, `app=0.116.1`. 게시 전 최신 `main`, unresolved reviews/conflict 재조회 후 GitHub `pull_request.synchronize` Full Run ID/Attempt와 Head를 실제 조회해 기록. **실행 이후 모니터링하지 않음**.
