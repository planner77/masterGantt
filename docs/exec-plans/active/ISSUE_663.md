# Issue #663 — U1 공통 상태 계약·Core 관측 포트·누적 회귀 하니스

Refs #663

## 범위 / 실행 계약

phase: PR_READY → PR_CI
status: LOCAL_VALIDATED / PRE_REVIEW_PASS
risk_level: HIGH
risk_reason: 후속 canonical recovery·receipt·axis 모듈이 공유할 정합성 증거 계약을 정의함
qa_method: OWNER_MANAGED
qa_required: true
qa_review_mode: 별도 qa_docs read-only 사전 검토 후 exact-head 원격 검증
manager_decision: NOT TESTED
MERGE_READY: BLOCKED
release_required: false
release_authorized: false
issue_comment_writer: manager
issue_comment_allowed_types: PLAN, STATUS, EXCEPTION, FINAL
documentation_owner: Manager

사용자 요청의 종료점은 구현·문서 갱신·미해결 리뷰/충돌 처리 후 PR Full CI 시작 확인이다. CI 결과 모니터링, 병합, main CI/GHCR, tag/Release, 브랜치 정리·Issue 종료는 이번 실행에 포함하지 않는다. MODULE_READY는 #552 제품 정합성 PASS나 U2/U3/U4 개발 기준의 main 병합 완료를 뜻하지 않는다.

## 기준선 / 선행 / 필독

- repository: planner77/masterGantt; Issue https://github.com/planner77/masterGantt/issues/663.
- baseline main/document commit: `b09c3148df037acdecc9b0687e0dd4d3051c96a4`.
- branch: `feat/issue-663-gantt-state-contract`; 별도 worktree에서 기존 미추적 자료와 다른 Issue worktree를 보존한다. 착수 조회에서 #663 기존 구현 PR 없음.
- 선행 #661 문서 PR #669의 main 병합과 Owner의 문서·계획 한정 ACCEPT 기록을 확인했다. 규범 상태 자체는 `REVIEW_PENDING`이며 제품 준수 승인으로 확대하지 않는다.
- gantt_standard_version: `1.0.0-candidate`; [GSC](../../GANTT_STATE_CONSISTENCY.md), [Conformance](../../GANTT_STATE_CONFORMANCE.md), [ADR](../../GANTT_ADAPTER_ADR.md), [Trace](../../GANTT_SYNC_TRACE.md), [이행계획](GANTT_STATE_REMEDIATION.md)을 위 document commit에서 읽었다.
- [Lifecycle](../../ISSUE_LIFECYCLE.md), [QA 정책](../../QA_REVIEW_POLICY.md), [Architecture](../../ARCHITECTURE.md), [TEST_PLAN](../../TEST_PLAN.md), [원격 검증](../../REMOTE_VALIDATION.md) 및 AGENTS/REQUIREMENTS/API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY/CI_CD/GITHUB_OPERATIONS/DESIGN/UI_UX_GUIDELINES/active PLAN을 영향 분석에 적용한다.
- application/lockfile `0.114.0`, 실제 설치 `@svar-ui/react-gantt` `2.7.3` / transitive `@svar-ui/gantt-store` `2.7.2`. 제품 기능·런타임 연결 없는 계약/테스트 기반이므로 버전 유지. 패키지·workflow·Required check·권한·릴리스 정책 변경 없음.

## 역할 / 파일 소유권 / 의존성

- Manager `/root`: 요구사항·interface 조정, 실제 합성 Core browser fixture/provenance, 이 Work Packet과 관련 문서, GitHub lifecycle 기록/PR/CI 등록.
- frontend `/root/contracts`: `src/features/gantt/state-consistency/**`의 타입/읽기 전용 reader/index 및 전용 contract/core-reader Unit.
- worker `/root/harness`: `tests/config/gantt-state-conformance.json`, manifest validator/fake ports/반례와 전용 Unit. browser·actual-core snapshot/provenance는 Manager 전용이다.
- qa_docs: DOCUMENTATION_SYNC 뒤 별도 read-only 사전 검토. 이 사전 검토는 원격 CI 후 QA_FINAL/Owner ACCEPT가 아니다.
- 생산 코드→신규 state-consistency import 0. TypeScript AST 검사에서 신규3 modules·cycle0·외부 runtime import0·production consumer0을 확인했다. U1→기존 projection/snapshot/receipt/viewport/adapter는 `import type`만 사용한다. U2/U3/U4 concrete 구현 import 없음; reader만 내부 contracts에 의존하며 실행 의존 순환 없음.
- 기존 state authority를 복제한 store나 실제 복구·receipt reuse·axis transaction을 구현하지 않는다. 타입과 테스트의 recovery 전이는 후속 구현을 검증할 reference model이다.

## 상태 / 쓰기 소유권 / GSC 적용

GSC-01~12를 적용한다. canonical revision과 desired identity(query/scope 포함), Core api/dirty/recovery generation, observation attempt, layout/axis, user intent lease를 별도 타입으로 둔다. observation 증가만으로 conformance/lease를 승인하지 않는다. Core 읽기는 공개 serialize tasks/tree/links만 사용하며 실패·null·깨진 hierarchy/Link는 FAILED다. 정규화 비교의 대상은 adapter-owned 필드이며 좌표 캐시·renderer duration·collapse·selection은 저장 authority가 아니다.

서버/mutation gateway, Reconciler, Projection observation, Viewport Coordinator, Workspace의 기존 쓰기 소유권은 불변이다. 신규 production wiring·Core/DOM/서버 write·상시 polling·diagnostic server 없음. 예외 ADR: N/A(신규 synthetic resize/private/PRO 우회 없음; 기존 #569 DEFER/FAIL 유지).

## AC_TEST_COVERAGE

- AC1: `src/features/gantt/state-consistency/contracts.ts`와 `index.ts`, `tests/features/gantt/state-consistency-contract.test.ts`의 별도 identity/typed port·기존 결과 호환과 import 경계 검사; Architecture와 이 Packet의 authority/DAG 대조.
- AC2: `tests/features/gantt/core-reader.test.ts`, `state-consistency-harness.test.ts`, `state-consistency-runtime-fixture.test.ts`의 정상/Core order·date·temporary task·Link drift 구분. 실제 설치 public serialize snapshot과 합성 반례를 구분한다.
- AC3: `tests/fixtures/gantt-state-consistency/synthetic.ts` 및 하니스 Unit의 rejected/uncertain 결과, same-revision actual drift, pending newer edit/user supersession 모델. production 복구 알고리즘 증거는 #664/#667의 후속이다.
- AC4: `tests/config/gantt-state-conformance.json`, `tests/features/gantt/state-consistency-manifest.test.ts`에서 SC-01~14와 GSC-01~12/owner/evidence/spec+case 연결·누락/중복/비존재 음성 검증. manifest 통과는 실제 E2E 실행 PASS가 아니다.
- AC5: `tests/fixtures/gantt-state-consistency/browser.tsx`, `actual-core-2.7.3.json`, `actual-core-provenance.json` 및 runtime-fixture Unit으로 설치 타입/공식 serialize 문서/실제 synthetic Chromium 출력 차이를 고정. trace는 기존 #568 bounded allowlist 재사용, 실제 데이터/secret 제외.
- AC6: 관련 Unit/typecheck/scoped lint/version/link/DOC_SYNC·production import0 검사; 실제 local/remote 결과·미실행을 아래 구분. U2/U3/U4 및 product integration0은 diff로 확인한다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_663.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/GANTT_STATE_CONFORMANCE.md`: UPDATED
- `docs/GANTT_ADAPTER_ADR.md`: UPDATED
- `docs/GANTT_SYNC_TRACE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/GANTT_STATE_REMEDIATION.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/GANTT_STATE_CONSISTENCY.md`: N/A(규범 버전과 MUST 및 REVIEW_PENDING 상태 불변이며 U1 구현 현황은 Conformance와 본 Packet에 기록)
- `AGENTS.md`: N/A(기존 GSC 필독·위임·검증 지침을 적용하며 실행 지침 변경 없음)
- `docs/REQUIREMENTS.md`: N/A(제품 기능 변경 없이 이미 등록된 U1 AC를 구현하며 요구사항 authority는 Issue663)
- `DESIGN.md`: N/A(제품 시각 언어·화면·사용자 flow 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(제품 interaction·focus·접근성 계약 변경 없음)
- `docs/PROJECT_UX.md`: N/A(제품 Gantt 연결과 복구 동작 변경은 U5 소유)
- `docs/MILESTONE_TIMELINE.md`: N/A(Milestone 표시·canonical/전체 subtree 계약 변경 없음)
- `docs/API.md`: N/A(서버 REST API·권한·revision 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB schema/migration/실제 SQLite 변경 없음)
- `docs/SECURITY.md`: N/A(기존 synthetic/allowlist 경계를 적용하며 보안 정책 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정 계산·date-only 도메인 알고리즘 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(데이터 교환 schema 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(제품 Import/Export 계약 변경 없음)
- `docs/EXCEL_EXPORT.md`: N/A(Excel 형식·동작 변경 없음)
- `docs/CI_CD.md`: N/A(기존 Unit runner를 사용하며 workflow·Required checks·version/release 계약 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 gate 불변이며 PR CI 시작과 미검증은 본 Packet·Issue·PR에 기록)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 Issue lifecycle/PR 운영 절차 적용)
- `docs/QA_REVIEW_POLICY.md`: N/A(HIGH/OWNER_MANAGED와 기존 trusted·Owner gate 유지)

## 누적 시나리오 / 증거 경계

SC-01~14 전부 manifest 등록·구조 검사 대상이다. SC-01~07의 same-revision drift/dirty invalidation/pending·uncertain/user supersession은 fake port reference model로 검증하며 실제 HTTP/SQLite 복구 또는 제품 receipt 동작이 아니다. SC-08~13 axis/geometry/peer/Milestone 접근성 제품 실행은 U4/U5/#573/#574에서 NOT TESTED로 남긴다. SC-14의 public reader snapshot은 실제 작은 synthetic Core fixture이며 1000 Task+2000 Milestone 성능·반복 mount/unmount 제품 통과 증거가 아니다. manifest의 existing spec/case는 연결 확인이고 해당 E2E를 이번 실행에서 모두 재실행했다는 의미가 아니다.

기존 #568 bounded trace와 `tests/e2e/fixtures/isolated-application.ts`의 HTTP fixture 경계를 재사용/참조한다. 새 서버를 만들지 않고 file:// 합성 HTML에서 Core init 공개 API를 읽는다. 실제 제품 API/권한/DB는 이 fixture에 연결되지 않는다. 원본 #552 CI #2679/#2682 실패와 #569 DEFER는 유지한다.

## 로컬 빠른 검증 / 원본 실패 / 미검증

신규 계약·manifest·하니스 관련 Unit과 기존 projection/sync/trace 관련 회귀를 실행했다. 최종 통합 수치는 아래 실행 원장에 기록한다. 실제 synthetic browser public snapshot은 tasks4/tree4/links1이며 NATIVE_LAYOUT_SETTLED, bounded trace6개를 수집했다. 최초 통합 Unit은 44 PASS/1 FAIL이었다. 실패는 transitive store package 버전을 React wrapper와 같다고 가정한 테스트 기대값(2.7.3)에 실제 설치2.7.2를 대조하여 발생했다. 원본 provenance는 이미2.7.2를 정확히 기록했으며 테스트·문서만 설치 사실로 정정했다. 별도 구현 Agent의 최초 typecheck는 각각 raw fixture 타입1건/JSON 음성 test inference4건 FAIL 후 교정·재실행 PASS였다. npm ci는 PASS. 설치 전체 audit는 dev dependency HIGH6을 보고했고 production `npm audit --omit=dev --json`은 취약점0 PASS; 의존성/lockfile은 변경하지 않았다. CLI 최초 실행은 기본 Chrome 경로 미설치와 기본 file:// 차단으로 BLOCKED였다. 기존 설치 Chromium1243 executable 및 로컬 합성 file 접근을 명시하고 1440×900/Asia-Seoul에서 재실행 PASS했다. prepare-browser는 동일 session config를 생성하며 record-browser는 source/lockfile/snapshot hash를 기록한다. 이는 Core reader 실패가 아니다.

공식 quality/e2e/docker·Trusted QA·QA_FINAL·Manager/Owner ACCEPT: NOT TESTED. main/GHCR/정식 release·실제 배포/Excel/최종 수동 UX: 이번 범위 밖. 로컬 synthetic fixture PASS를 이 항목으로 대체하지 않는다.

## 후속 인계 / 롤백

U2 #664는 실제 Core no-op·복구, U3 #665는 semantic receipt, U4 #666은 날짜축 transaction의 구체 구현을 소유한다. 공개 exports/interface 및 fixture/manifest 버전과 exact PR Head를 인계하되 main merge SHA는 미생성이다. main 통합·Required CI·현행 QA·별도 Owner 승인 전 MODULE_READY 최종 완료 또는 병렬 구현 선행 완료로 보고하지 않는다.

U5 #667은 기존 #552/PR #561에서 제품 연결을 단독 수행한다. #573 작은 화면/focus와 #574 최종 통합 QA, #553 교환 인수는 별도다. 소비자 전에는 U1 커밋을 되돌릴 수 있고 소비자 발생 뒤에는 public 계약 호환성을 함께 확인한다. DB/서버 데이터 rollback 없음.

## 실행 원장 / 검토 인계

- `node tests/fixtures/gantt-state-consistency/prepare-browser.mjs` → 기존 설치 Chromium1243의 file:// 합성 Core 로드 → `window.__gsc663.observe()` → `record-browser.mjs`: PASS. 1440×900/Asia-Seoul, public tasks4/tree4/links1, NATIVE_LAYOUT_SETTLED, bounded ring32 중6 entries/dropped0. 호출 반환·actual Core snapshot·native settle은 별도 증거다. 마지막 dispose/브라우저 종료 수행. 설치/fixture/hash/명령/원본 실패는 actual-core-provenance.json에 고정한다.
- 최종 통합 Local Fast Feedback: 신규5파일58 tests + 기존 projection/sync/receipt3파일31 tests, 합계8파일89 tests PASS. 명령: `npm test -- tests/features/gantt/state-consistency-contract.test.ts tests/features/gantt/core-reader.test.ts tests/features/gantt/state-consistency-harness.test.ts tests/features/gantt/state-consistency-manifest.test.ts tests/features/gantt/state-consistency-runtime-fixture.test.ts tests/features/gantt/canonical-snapshot-sync.test.ts tests/features/gantt/canonical-projection.test.ts tests/features/gantt/projection-settled.test.ts`. #568 trace는 실제 경로 `tests/domain/core-action-trace.test.ts`로 별도10 tests PASS하여 총 관련99 tests PASS다. 최초 Unit44 PASS/1 FAIL 및 별도 typecheck fixture 타입 실패는 위 원장에 보존했다.
- typecheck/scoped ESLint/version0.114.0/Markdown221/DOC_SYNC 구조·AC1~6 매핑/diff 공백: PASS. DOC_SYNC 구조 검증은 의미 검토 대체가 아니며 별도 qa_docs가 실제 diff·타입·fixture·문서를 검토한다.
- fresh Core 일치 proof와 reuse reference model은 actual drift/API/dirty/recovery/revision/query/scope/layout/axis/intent 변화에 무효화된다. 같은 의미의 observation 증가만으로 폐기/새 PASS를 만들지 않으며 새 PENDING 편집에는 과거 response rollback/retry0을 검증한다. 실제 production proof/recovery/receipt 적용은 후속이다.
- production src/package/lockfile/workflow/deploy/DB 기존 파일 변경0, 신규 state-consistency를 production caller에서 import0. 신규 reader만 런타임 코드이며 아직 호출하지 않는다. source capture는 baseline main+fixture SHA256으로 식별하며 미생성 PR/Head/run을 꾸며 쓰지 않는다.

Required PR CI·Trusted QA·QA_FINAL·Owner/Manager ACCEPT는 NOT TESTED이고 MERGE_READY=BLOCKED다. 별도 사전 검토 및 PR 게시 직전 latest-main·미해결 review thread를 확인한다.

## 별도 사전 검토 / 게시 인계

별도 read-only Reviewer `/root/qa`가 원격 Issue663 원문 AC1~6와 변경25파일·문서/증거 경계를 직접 비교했다. 사전 구현·문서 검토 PASS, 신규 P1/P2 지적0건. 신규58+기존31+trace10=99 tests, typecheck·scoped ESLint·diff 공백을 독립 재실행 PASS했다. 설치 타입/공식 serialize/합성 actual snapshot·provenance hashes를 대조했으나 실제 브라우저 수집을 Reviewer가 다시 실행한 것은 아니다. 이는 PR CI 전 사전 검토이며 최종 QA_FINAL·Owner/Manager ACCEPT가 아니다.

게시 직전 latest main은 baseline b09c3148과 동일하며 behind0, 충돌0이다. 기존 #663 PR이 없어 단일 신규 PR을 생성한다. exact commit Head/base/test-merge·review thread 수·CI run ID/attempt/URL은 생성 뒤 GitHub Issue/PR의 STATUS 인계에 기록한다. CI 시작 이후 결과 모니터링은 하지 않으며 quality/e2e/docker·Trusted QA·최종 ACCEPT는 NOT TESTED다. main merge SHA/GHCR·Release·Issue 종료는 아직 없고 요청 범위 밖이다.

게시 예외: 로컬 Git HTTPS push는 Invalid username or token으로 BLOCKED였다. 인증된 GitHub connector의 Git tree/commit/branch API로 동일 검증 파일을 게시하고 local/remote tree SHA가 정확히 같은지 대조한다. 인증 토큰을 읽거나 변경하지 않으며 기본 브랜치와 기존 branch 이력을 덮어쓰지 않는다. 원격 commit SHA는 API가 생성한 author/time으로 달라질 수 있어 최종 exact Head를 별도 기록한다.

## REWORK — 2026-10-15 / PR #687 CI #2779.1 / Codex P2

- 원격 실제 결과: PR CI run `38660449088.1`, Head `974f9953db714a8c63eef90622f00f877c9fa545`, base `b09c3148df037acdecc9b0687e0dd4d3051c96a4`. TypeScript/ESLint/Unit/Build/Chromium 6 shards/Docker 및 세 Required 집계 PASS; **QA Final — Automated BLOCKED**: unresolved review thread 1건. 해당 리뷰는 Core reader의 실제 계약 오류(P2)이므로 단순 스레드 종결 대신 코드·테스트 수정.
- root cause: installed SVAR 2.7.3 Core가 canonical에서 시작·종료일을 생략한 `summary`의 하위 Task 날짜를 roll-up해 serialize하는 반면 `normalizeCanonicalCore`는 누락 날짜를 null로 남겨 동등한 실제 Core도 불일치로 판단했다.
- 조치: 누락된 canonical Summary 날짜에 한하여 DFS 역순으로 자식의 최소 시작·최대 종료를 재귀 반영한다. 명시적 canonical 날짜와 실제 Core의 관측값은 그대로 유지하고 구조·형제 순서·Link/leaf 날짜 차이를 숨기지 않는다. 원본 browser.tsx(undated summary)의 synthetic Core snapshot과 원본 canonical 입력을 직접 비교하는 새 Unit 및 nested-summary/실제 summary-date drift 음성 검사를 추가한다. 기존 수집 산출물과 provenance SHA는 변경하지 않는다.
- 범위: 공통 U1 reader/Unit/Work Packet만. 제품 wiring, CI/버전/패키지, 기존 표준/Design/DB/API/권한/릴리스 정책 불변. DESIGN.md N/A(화면 변경 없음). 변경 후 새 exact Head PR CI를 시작하고 **모니터링하지 않음**. 로컬 독립 테스트 재실행은 연결된 GitHub API만 이용할 수 있어 NOT RUN이며 새로운 원격 CI 결과는 실행 후 확인하지 않음. HIGH/OWNER_MANAGED 최종 ACCEPT·병합 미승인 유지.


## REWORK — CI #2780.1의 테스트 import 누락 (2026-10-15)

- 재개 기준: PR #687 Head `273fe49b991139606e9c64a91c5716c869ee81b1`, latest main/document commit `b09c3148df037acdecc9b0687e0dd4d3051c96a4`, test merge `6df8de69b8ad265b48ad9f9114ae8803ff420d53`. 기존 worktree/PR을 재사용하고 원격 보완 커밋을 fast-forward했다. 미추적 browser 자료를 보존했다.
- GSC `1.0.0-candidate`·GSC-01~12/SC-01~14, AGENTS/DESIGN/ADR/Trace/Conformance/이행계획·Lifecycle·QA/원격 지침을 다시 읽었다. 상태별 authority/쓰기 소유권·제품 wiring0·원본 snapshot/provenance·규범 상태는 불변이다. 신규 예외 ADR 없음.
- 원본 [CI #2779.1](https://github.com/planner77/masterGantt/actions/runs/38660449088), run38660449088/attempt1/Head974f9953db714a8c63eef90622f00f877c9fa545는 세 Required와 실제 Chromium6 shard PASS 뒤 QA Final job116187508466의 미해결 P2 스레드로 BLOCKED였다. Summary 날짜의 실제 계약 보완과 thread 해결은 이미 원격273fe49 커밋에 존재한다. 과거 FAIL을 소급 PASS하지 않는다.
- 최신 [CI #2780.1](https://github.com/planner77/masterGantt/actions/runs/38663357241), run38663357241/attempt1/Head273fe49b991139606e9c64a91c5716c869ee81b1은 TypeScript job116189661103 step7 `TS2304: Cannot find name 'normalizeCanonicalCore'`와 Vitest job116189661090 step6 `ReferenceError: normalizeCanonicalCore is not defined`로 FAIL했다. 원인은 새 실제 Core 비교 테스트의 public export import 누락이다. Manager가 집중2suite에서11 PASS/1 FAIL로 같은 line46 실패를 재현했다.
- Fast Gate job116189996123는 typecheck/unit failure를 적법하게 차단했다. Build/E2E/Docker 구현은 SKIPPED/NOT TESTED이며 실제 실행 실패로 해석하지 않는다. Required3 집계의 FAIL과 QA Final job116190078426의 `required quality 미성공`은 연쇄 결과다. 정책/ESLint/Preflight는 원본에서 SUCCESS였다.
- 보완: `tests/features/gantt/state-consistency-runtime-fixture.test.ts`에 기존 public `normalizeCanonicalCore` import만 추가했다. #2779 P2에서 추가한 원본 synthetic canonical↔captured Core 일치 및 Summary/leaf/date/Link drift 음성 단언을 그대로 실행한다. production reader/복구·viewport writer·API/DB·package/lockfile·CI/timeout/skip 변경 없음. 다른 실행의 기존 보완을 덮어쓰지 않는다.
- 실제 역할: frontend `/root/fix663` 해당 import 단독 작성·관련 LFF, infra `/root/ci663` 원본 Run/API/job/log read-only 분석, Manager 문서/통합/원격 게시, 별도 qa_docs 사전 검토. documentation_owner/issue_comment_writer=Manager 유지; Sub-Agent 원격 쓰기 없음.
- Local Fast Feedback: 구현자가 reader+runtime2suite12 tests, typecheck, 변경부 scoped ESLint 및 diff 공백 PASS를 실행했다. 이는 위 이전 재작업의 NOT RUN 기록 이후 새 실행이며 원격 전체 PASS를 대체하지 않는다. 아래 통합검증·별도 사전 검토 결과를 이어 기록한다.
- DOCUMENTATION_SYNC 재수행: Work Packet/TEST_PLAN/ARCHITECTURE/GANTT_ADAPTER_ADR/active PLAN/CHANGELOG에 누락 canonical Summary 날짜의 bottom-up 기대값 정규화·실제 Core drift 보존과 두 CI 실패/검증 경계를 동기화한다. DESIGN/UI_UX/PROJECT_UX/API/DB/SECURITY/SCHEDULING/CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS/QA 정책은 실제 화면·도메인·권한·원격 gate/릴리스 정책 변경 없음으로 기존 N/A 근거 유지한다.
- HIGH/OWNER_MANAGED/qa_required=true, application0.114.0, release_required=false/release_authorized=false. 현재 remote quality/e2e/docker·Trusted QA·QA_FINAL·최종 Owner/Manager ACCEPT는 새 Head에서 NOT TESTED, MERGE_READY=BLOCKED다. 미해결 리뷰와 최신 main·충돌을 확인하고 새 Full PR CI 시작까지만 수행한다. CI 모니터링·병합/main/GHCR/Release/tag/Issue 종료는 별도다.

- 통합 재검증: 기존2개 P2 추가 단언을 포함한 신규·관련9파일101 tests PASS, typecheck·reader/runtime scoped ESLint·version0.114.0·Markdown221·기본 검증기의 DOC_SYNC 구조/AC1~6 매핑·diff 공백 PASS. 과거99개 결과에 이번 실행의 추가2개를 합쳐 기존 결과를 재표시한 것이 아니라 동일 source에서101개를 실제 실행했다. browser snapshot/provenance는 재수집하지 않고 원본 hash 검사를 통과했다.
- infra는 원본 Run/정확 attempts/1/jobs/checkout/QA env를 교차 확인했다. #2780 Vitest 원본은1 FAIL/2432 PASS/3 SKIP,211 files 중1 FAIL/209 PASS/1 SKIP였다. 첫 #2779와 후속 #2780은 서로 다른 원인이며 이 원장으로 보존한다.

- 별도 read-only qa_docs `/root/qa663_rework` 사전 검토 PASS, 신규 P1/P2 0건. Issue663 원문·보완7파일·GSC/문서 계약과 원격 #2779/#2780 run/job/log·resolved review 상태를 직접 대조하고 reader/runtime12 tests/typecheck/scoped ESLint/diff를 독립 실행 PASS했다. 실제 browser 재수집이나 HTTP/SQLite/UI geometry는 검토자가 실행하지 않았다. 최종 QA_FINAL/Owner/Manager ACCEPT와 새 Head의 원격 CI/Trusted는 NOT TESTED다.
- 게시: 기존 Git HTTPS 인증 제약의 기록된 connector 절차를 재사용하여 직전 원격 Head273fe49에서 fast-forward한다. local/remote tree 동일성·현재 Head lease·latest main·review0 확인 후 Full CI 시작만 조회하며 진행 결과는 모니터링하지 않는다. exact 새 Head/base/test merge/run/attempt는 Issue/PR 인계 댓글에 남긴다.
