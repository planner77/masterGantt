# Issue #896 — DESIGN 기반 Visual Evidence Gate 실행 계획

## Scope / Baseline
- lifecycle_phase: IMPLEMENTATION → LOCAL_VALIDATED → DOCUMENTATION_SYNC → PR_READY → PR_CI_STARTED
- 승인 범위: 2026-11-09 사용자 요청의 분석·설계·구현·문서·미해결 리뷰/충돌 해결·실패 원장·PR CI 시작. CI 모니터링·병합·Main/GHCR·Release·Issue 종료는 범위 밖이다.
- baseline main: `1826b479a80c64ef16efe768b31f75d62170639e`; branch: `feat/issue-896-visual-evidence`.
- version_decision: `0.145.1` 유지. 제품 코드·API·DB·배포 변경 없음.
- risk_level: HIGH; risk_reason: 기존 CI artifact와 QA 증거 검증 계약 확장.
- qa_method: OWNER_MANAGED; qa_required: true; independent_qa: N/A(Owner-managed, 독립 QA Final 없음).
- release_required: false; release_authorized: false; manager_decision: NOT TESTED; MERGE_READY: BLOCKED.
- issue_comment_writer: Manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION. 구현 Agent는 원격 댓글/PR/CI를 쓰지 않는다.

## REUSE_REVIEW
- REUSE_DECISION: EXTEND
- REUSE_CANDIDATES: PR #900의 ui_evidence.py/helper/CI artifacts, 기존 schedule-views.spec.ts와 i18n.spec.ts, #118 measure/compare 도구, #703 Preview, #711 lifecycle, #699 prepr
- REUSE_CONDITIONS: 기존 합성 fixture와 assertions·Full8/Required3/Trusted/Owner/OCI 경계 유지; geometry comparator를 별도 중복 생성하지 않음; golden 자동 승인 없음; 정확 Head/base/test-merge와 환경이 다른 과거 PASS를 새 Head로 승계하지 않음
- REUSE_OWNER_EVIDENCE: 2026-11-09 현재 대화에서 사용자가 Issue896 구현과 각 단계 기존 결과 재사용을 명시; 2026-11-08 #895 Work Packet의 기존 EXTEND 결정도 같은 후보 범위에서 재사용
- 재사용 분석: PR #900은 v1 수집 봉투만 제공한다. baseline/환경/fixture fingerprint/geometry digest/flow와 #890 capture·CSS/drift 음성검사를 보완한다. #895 원장 이력은 링크로 보존한다.

## 설계·파일 소유권
- Manager: Work Packet·실패 원장·관련 문서·기존 ci.yml 증거 env/summary/artifact 연결·통합·PR.
- ui_ux: DESIGN/AC gap 및 1px/밀도 근거 읽기 전용 설계 검토. 실제 QA_FINAL PASS로 간주하지 않는다.
- infra: scripts/ui_evidence.py, tests/python/test_ui_evidence.py, tests/e2e/helpers/ui-evidence.ts.
- frontend: 기존 schedule-views.spec.ts/i18n.spec.ts pilot만 확장.
- worker: 기존 compare-issue-118-layout.mjs의 공용 key/delta·명시적 계약 비교와 관련 unit.
- 같은 파일 동시 writer 없음. 새로운 범용 test runner/SaaS/Required check/권한은 추가하지 않는다.

## UI_EVIDENCE_CONTRACT
상세 계약과 실행 명령은 [UI 증거 운영 계약](../../UI_EVIDENCE.md)을 따른다.

| Issue/AC | DESIGN/화면 계약 | 기존 실제 테스트·상태 | 자동 검증 | 수동/미검증 |
| --- | --- | --- | --- | --- |
| #896 AC01, #889 AC | DESIGN #889/#890, UI_UX_GUIDELINES 일정 표현 | schedule-views #889 공통 shell, 5폭·Day/Week·세 View | toolbar/surface/split/축 좌표 차이 ≤1px, 기존 밀도 입력/쓰기0 | 전체 DESIGN 의도·터치감 Owner 수용 |
| #896 AC02/03 | 기존 #118 key/delta, PROJECT_UX #822 | 동일 viewport/state/fixture/env의 명시 baseline 비교 | header/CSS/밀도 회귀 FAIL, baseline/font/OS/fixture drift BLOCKED | 승인 golden 부재, 픽셀 비교 NOT TESTED |
| #896 AC04 | 합성 화면만 공개, 정확 출처 | helper v2 manifest·PNG·geometry·fixture JSON | SHA256 및 source/base/test-merge/PR 교차 확인 | 선언 metadata는 신뢰 승인 아님 |
| #896 AC05, #890 AC | DESIGN locale와 canonical column ID 분리 | i18n #890 rapid locale round trips, 1440 KO/VI/EN | header 현재 언어·숨긴 열 복원·instance·쓰기0 | native125%, 실제 OS/font·AT·운영 Preview NOT TESTED |
| #896 AC05 | PROJECT_UX 조회/편집 경계 | #880 원본 Editor Enter→Escape, #889 View 왕복·Ctrl+wheel | 실제 기존 flow assertions·canonical API/DB | 화면 캡처로 권한/Revision 증명 금지 |
| #896 AC06 | Stage A advisory | 기존 Chromium8·Artifact·Required3 | 추가 전체 E2E 실행 없음 | Stage B 활성·Owner ACCEPT·성능 개선 NOT TESTED |

수치 허용오차는 기존 #889 ≤1px와 #822 fine34/32/30/28px·coarse44px만 사용한다. 변경된 golden 자동 채택·mask 확대·skip·timeout/retry 완화 없음. 대표 PNG만 수집하며 모든 화면×모든 상태 조합을 실행했다고 보고하지 않는다.

## TEST_LIFECYCLE_REVIEW
- EXTEND: tests/python/test_ui_evidence.py의 기존 보안/무결성 양·음성, 기존 schedule-views #889/#880, i18n #890, #118 비교기.
- KEEP_UNIQUE: #118 역사 CLI/measure, 기존 API·DB 권한/Revision·canonical snapshot·readonly·locale·geometry assertions, E2E8 배치.
- ADD: 기존 비교기의 v2 계약 양·음성 unit. 테스트 폐기·중복 runner 없음.
- AC_TEST_COVERAGE를 단일 매핑으로 사용한다. 로컬 최소 검증은 전용 Python/비교 unit/type/lint와 실제 pilot Chromium, 원격은 기존 Full8/Required3다.

## AC_TEST_COVERAGE
- AC01: UI_EVIDENCE_CONTRACT 표와 docs/UI_EVIDENCE.md에 AC→DESIGN→자동/수동/NOT TESTED 상태·환경을 고정한다.
- AC02: 기존 PR900 helper/validator/E2E와 #118 key/delta 실제 재사용; Owner 재사용 지시·TEST_LIFECYCLE_REVIEW 기록.
- AC03: test_ui_evidence.py·compare-layout-evidence.test.ts의 PNG/geometry/fixture 변조, CSS/header/density·baseline/font/OS drift 양·음성; 불확실 자료 PASS 금지.
- AC04: helper v2 source/baseline/checkout/PR/run/attempt·환경·test/flow·PNG/geometry/fixture SHA256와 기존 CI summary/artifact 링크; 실제 신규 원격 artifact NOT TESTED.
- AC05: 기존 schedule-views #889 5폭·Day/Week·View/밀도와 i18n #890 언어 왕복 대표 실제 Chromium. Owner 전체 UX/Preview·native125% NOT TESTED.
- AC06: 기존 Required3/E2E8·Docker/Trusted/OCI/Release/Finalizer 유지, 실패 원장·문서·Test Lifecycle와 비용/크기 미측정 범위 명시.

## DOCUMENTATION_SYNC
- `docs/CI_CD.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/TEST_PLAN_895_897.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `docs/PREVIEW_PUBLISH.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/UI_EVIDENCE.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `AGENTS.md`: N/A(기존 Stage A 재사용·QA 책임 규정 유지, Agent 지침 변경 없음)
- `docs/ARCHITECTURE.md`: N/A(제품 계층과 배포 구조 변경 없이 기존 테스트 증거만 확장)
- `DESIGN.md`: N/A(기존 1px·행 밀도 수치 재사용, 제품 시각 언어 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(schedule-views 테스트 증거만 확장, 일정 알고리즘 변경 없음)
- `docs/API.md`: N/A(기존 실제 API 검증 재사용, endpoint와 인증·revision 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(합성 fixture만 사용, 제품 schema/migration 변경 없음)

## 검증·인계
- 최초 baseline의 관련 PR #900/#901은 이미 MERGED다. #900의 리뷰 스레드 3개 모두 resolved/outdated이며 source-head 변수·UAT 파서·한글 step 교정은 재사용한다. 이번 신규 PR의 미해결 리뷰/충돌은 게시 직전 확인한다.
- 로컬 실제 결과·누적 실패·미실행은 [#896 원장](../../ISSUE_896_FAILURE_ANALYSIS.md)에 기록한다. 이전 #895 원장의 Full/metadata/Main 실패는 본 Issue의 신규 실패로 재집계하지 않는다.
- 신규 exact Head quality/e2e/docker·Trusted QA·Owner UAT·Manager ACCEPT는 NOT TESTED. PR CI 시작 뒤 모니터링하지 않는다.
- Stage B 수용 Gate 활성, baseline golden 승인, Preview GHCR 게시, Main/Release/Finalizer/Issue 종료 없음.

## 최종 Local Fast Feedback
- 실제 대표 Chromium2개 PASS(#88943.7초/#89012.4초), canonical13건/1,444,704bytes 무결성 PASS. 의도적 CSS 4px 회귀1건은 FAIL 관측으로 보존하고 복원 PASS다.
- Vitest bounded80 PASS(5파일), Python91 PASS, typecheck/대상lint/Markdown426/YAML/diff PASS. 원장에 명령·이전 오류·환경·재사용 범위를 구분했다.
- qa_docs의 실제 별도 읽기 전용 기술 사전 검토 PASS, QA_FINAL=N/A(Owner-managed). Owner 디자인 수용·native125%·운영 Preview·원격CI는 NOT TESTED.
- 자동 prepr targeted dry-run은 UNKNOWN5/selection BLOCKED다. 수동 영향 매핑과 위 개별 검사 근거를 사용하며 자동 READY라고 보고하지 않는다.
