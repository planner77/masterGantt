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

## REWORK — PR #902 / Full #3594.1
- 현재 원본: Run42526579195.1, Head1cc214f85ba2e1c16a65d10d51044829eef5dc98/base1826b479a80c64ef16efe768b31f75d62170639e/test-merge3dfd3f29732ec5cebe1982dd641c3cc00fabee8e. quality/docker PASS, E2E3/8 직접 helper ENOBUFS FAIL,7샤드 CANCELLED. 원본 ci-pr-source artifact·전체8로그 대조 완료.
- REUSE_DECISION 범위 유지: 기존 capture/manifest/validator/fixture/CI를 재사용하고 대용량 stdout 처리만 보완한다. Owner의 이번 실패분석·구현·문서·같은 PR CI 재시작 지시가 승인 근거다. 신규 승인 요청이나 별도 PR/runner는 필요하지 않다.
- infra 소유: ui-evidence.ts와 전용 ui-evidence-provenance.test.ts. Manager 소유: 문서·원장·실제 browser·통합·리뷰/충돌·push. qa_docs는 별도 read-only 기술검토.
- TEST_LIFECYCLE_REVIEW: EXTEND 기존 helper/실제 #880/#889/#890; ADD 정확 Git 출력 seam의 대용량·실패 양음성 unit; KEEP_UNIQUE 기존 v2 integrity/118 비교/8shard. 신규 테스트 파일은 기존 Vitest discovery를 사용한다.
- 설계: 전체 git diff --binary HEAD stdout을 bytes 순서대로 SHA256에 streaming 반영해 기존 digest 의미를 유지한다. status도 output buffering 없이 dirty boolean을 관측하고 Git 실패는 차단한다. diff 생략/임의 maxBuffer 확대·테스트 assertion/timeout/retry 완화 없음.
- AC01~06/UI_EVIDENCE_CONTRACT·기존 수치/범위 유지. 추가 AC03/04 커버리지는 실제 Git 대용량 RED/GREEN와 full-byte 동등성·오류 실패 검증이며 실제 #880/#889/#890 소비자로 교차 확인한다.
- DOCUMENTATION_SYNC는 PR 전체 base 대비 실제 변경을 기준으로 기존 UPDATED/N/A를 유지한다. 후속 커밋은 CI_CD/REMOTE_VALIDATION/TEST_PLAN/UI_EVIDENCE/PLAN/이 Packet/단일 원장만 추가 갱신하고 그 외 원래 문서 변경도 PR diff에 남아 있다.
- 새 exact Head의 required quality/e2e/docker/Trusted·Owner/Manager는 NOT TESTED이며 MERGE_READY=BLOCKED. CI 등록 후 모니터링하지 않는다.


## REWORK 로컬 결과·최종 인계
- 실제 helper 대용량 binary1,351,672bytes RED ENOBUFS2회→streaming GREEN, 동일 full-byte SHA256. 신규 provenance5 unit PASS와 별도 qa_docs 기술 검토 PASS.
- 영향 소비자3개 실제 Chromium PASS(총4.3분), canonical14건/1,581,745bytes 무결성 PASS. 중간 Resource flow NOT TESTED·의도적 CSS FAIL1건을 최종 test PASS와 분리해 유지한다. 기존 Python/비교기 결과는 불변 파일 근거로 재사용했다.
- 원격 원본 실패·취소7샤드/출처artifact·전체 로그·추가실패미관측·수정설계·코드지문·명령은 같은 실패 원장에 추가했다. 버전/보호정책·Full8/Required3·release 판단 불변.
- unresolved thread0, main ancestry/충돌 없음. 별도 infra 구현 + qa_docs read-only 기술 검토로 수행했으며 independent QA_FINAL=N/A(OWNER_MANAGED), Owner/Manager·신규 원격 결과 NOT TESTED다.

## REWORK — PR #902 / Full #3595.1 (신규 F-002)

- A–C: [Run42532136493 attempt1](https://github.com/planner77/masterGantt/actions/runs/42532136493) Head997841a7/base1826b479/test-merge d6d9e8ef. #3594 ENOBUFS(F-001)은 streaming 수정 뒤 shard3에서 재발 미관측. 신규 직접 F-002는 E2E8/8 **121 PASS/123 선택·2 미완료**에서 35m Job 한계 취소. 다른7샤드 PASS(기존 SKIP3), shard6 32m 근접; Quality/Docker PASS, E2E aggregate/QA Final FAIL은 파생. [누적 원장](../../ISSUE_896_FAILURE_ANALYSIS.md)에 전체 Run/Job·상태와 로그 연결.
- **REUSE_REVIEW=EXTEND** 유지: #900 샤드 계획·현재 8그룹 선택기·기존 단위 테스트·#880/#889/#890 UI assertions·기존 프레임워크와 HISTORY를 재사용한다. #3595 실제 완료 whole-spec 기준 세 file만 이동: #621 Resource target 8→2, #490 settings layout 8→1, #491 transfer layout 6→4. 최초 #900 이동 자체는 되돌리지 않는다. UI 제품 코드·workflow·Runner/Timeout/Retry/Skip 변경 없음.
- **TEST_LIFECYCLE_REVIEW:** EXTEND `tests/scripts/e2e-shard-planner.test.ts`에서 최신 counts[18,19,17,22,18,16,19,18]·147 unique/inventory·원본 #902→#900→#894→#885 역산/3개 전체 file 이동 확인. KEEP_UNIQUE 이전 provenance5, 실제 #880/#889/#890, UI/권한/Geometry, 기존 Full8/Required3. ADD 신규 manifest `manualRebalance902`와 그 source/job 증거. 기존 통과는 새 Head에 이월하지 않는다.
- **DOCUMENTATION_SYNC:** 변경 `tests/config/e2e-shard-plan.json`, `tests/scripts/e2e-shard-planner.test.ts`, 이 Packet, 단일 `docs/ISSUE_896_FAILURE_ANALYSIS.md`. AGENTS/DESIGN/CI_CD/CI workflow/제품 계약은 동일해 N/A. 현재 동일 소스 static·unit 검증 및 인계는 누적 원장에 덧붙인다. 원격 새 exact Head Full/Owner/Manager NOT TESTED, MERGE_READY=BLOCKED. CI 시작 후 감시·병합/GHCR·이슈 종료는 수행하지 않는다.
