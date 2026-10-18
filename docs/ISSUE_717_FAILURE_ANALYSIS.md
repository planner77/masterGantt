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
