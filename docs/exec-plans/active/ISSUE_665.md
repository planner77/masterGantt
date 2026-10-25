# Issue #665 — 의미 기반 Projection 관측·완료 영수증

## Work Packet / 승인 범위

- issue: #665; 관련 #661/#663/#664/#666/#667, 기존 #570/#571, 제품 #552/PR #561, 최종 검증 #573/#574.
- phase: IMPLEMENTATION → DOCUMENTATION_SYNC → PRE_QA → PR_CI_STARTED.
- 사용자 승인: 2026-10-15 구현·문서 갱신·미해결 리뷰/충돌 해결·PR CI 시작까지. CI 모니터링·병합·main/GHCR·tag/release·branch 삭제·Issue 종료는 포함하지 않는다.
- baseline/U1 interface SHA: `d445ec58bf9106414c99a150ee8f52599834baf9` (main, #663/PR #687 병합). 문서 #661은 main 반영·Issue CLOSED를 재조회했다. #664/#666 concrete 구현을 참조하지 않는다.
- branch/worktree: `feat/issue-665-semantic-projection` / `/home/planner/Dev/masterGantt-worktrees/issue-665`. 기존 다른 worktree와 미추적 산출물은 보존한다. 시작 시 #665 PR 없음.
- application version: `0.114.0` 유지. 설치/lock `@svar-ui/react-gantt` 2.7.3. 새 facade는 opt-in이며 production 연결·제품 동작 변경 없으므로 version/package/lockfile 변경 없음.
- release_required: false; release_authorized: false. 독립 모듈 개발 범위이며 정식 게시 요청 없음.
- risk_level: HIGH; risk_reason: Core proof/receipt 재사용·source invalidation의 잘못된 승인은 stale 복원 및 실제 drift 은폐 위험.
- qa_method: OWNER_MANAGED; qa_required: true. 별도 qa_docs의 사전 read-only 검토를 사용하되 최종 QA_FINAL/Owner·Manager ACCEPT 및 원격 CI PASS와 구별한다.
- gantt_standard_version: `1.0.0-candidate / REVIEW_PENDING`; 읽은 문서 commit: 위 baseline. 적용 GSC-02/04/06/07/08/11, 관련 GSC-09/10/12. 누적 검증 SC-01/06/07/10/11. 예외 ADR: 없음; timeout/허용오차/skip 변경 없음.

## 소유권 / 위임

- Manager: 범위·설계/버전·Work Packet 및 관련 문서, Issue PLAN/STATUS/EXCEPTION, 통합·최종 인계.
- frontend `/root/implement665`: `viewport/projection-observation.ts`, `projection-settled.ts`, 전용 Unit/fixture 및 관련 LFF. 신규 의미 관측 facade는 기존 소비자 호환을 유지한다.
- qa_docs: DOC_SYNC 뒤 별도 read-only AC/code/test/docs 사전 검토; 직접 수정/원격 쓰기 없음.
- infra: Manager handoff 뒤 branch/PR/CI 시작·latest main/충돌·review thread 조회만. CI 모니터링·merge·registry 쓰기 없음.
- documentation_owner: Manager; issue_comment_writer: Manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION. Sub-Agent는 원격 댓글을 쓰지 않는다.
- 쓰기 소유권: U3는 관측만 담당한다. canonical data writer/Reconciler와 viewport writer/Coordinator authority 불변. `project-gantt.tsx`, `project-readonly-view.tsx`, production Coordinator/port/Workspace 변경 0. U2/U4 concrete import 0.

## 요구사항 / 설계

관측 attempt와 의미 completion을 구별한다. 같은 desired identity·현재 실제 Core proof·유효 API/dirty/recovery/query/scope/layout/axis·사용자 의도에서만 기존 완료 의미를 재사용한다. 매 재관측에서 실제 Core의 전체 payload/tree/order/links를 검증하고 proof 부재/불일치·문맥 변경은 fail-closed한다. 논리 visible 행과 가상 DOM subset을 구별하며 기존 mounted 이름/순서/행 정렬 증거를 유지한다.

data/row receipt는 수평 viewport 복원을 기다리지 않는다. 대기 작업은 등록 당시 lease만 유지하며 적용 전/중/후 source와 delivery 시점을 재확인한다. observer/frame/timer/cancel/dispose를 유한하게 관리하고 trace는 기존 bounded read-only sink에 attempt/semantic 숫자 ID·outcome만 기록한다. 사용자 payload/secret을 진단에 넣지 않는다.

## AC_TEST_COVERAGE

- AC1: `tests/features/gantt/projection-observation.test.ts`의 반복 관측 attempt 증가·semantic completion 유지 및 metadata restore state-machine. 제품 Calendar E2E는 #667/#574에서 별도 검증한다.
- AC2: 같은 파일의 Core 순서/날짜/임시 행/Link 및 missing/invalid proof 음성, U1 captured actual-Core2.7.3 fixture 대조. canonical key 동일성만으로 재사용하지 않는다.
- AC3: API/revision/query/scope/axis/layout/hidden/unmount/invalid receipt 무효화 전용 Unit. 선언된 문맥과 실측 증거를 구별한다.
- AC4: data receipt → Coordinator 대기 순서와 수평 불일치 독립 검증, 기존 `projection-settled.test.ts`의 mounted 행/이름/순서/정렬·수평 복원 회귀.
- AC5: 오래된 lease/새 입력·cancel/dispose/외부 abort·timer/frame cleanup, delivery 직전 source 재검증. timeout/허용오차/skip은 변경하지 않는다.
- AC6: U1 public contracts·`actual-core-2.7.3.json` 재사용 및 product wiring/U2·U4 concrete import0 diff 검사. captured fixture 성공은 browser 재수집·HTTP/SQLite·제품 E2E 실행이 아니다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_665.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/GANTT_ADAPTER_ADR.md`: UPDATED
- `docs/GANTT_SYNC_TRACE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/GANTT_STATE_REMEDIATION.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(미연결 읽기 전용 모듈이며 제품 배치·색상·용어·시각 언어 변경 없음)
- `docs/REQUIREMENTS.md`: N/A(기존 GSC와 Issue665 요구사항 구현이며 제품 요구사항 전환 없음)
- `docs/PROJECT_UX.md`: N/A(기존 제품 호출과 interaction·저장·복원·focus 계약 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(화면·navigation·접근성·반응형 구현 및 규칙 변경 없음)
- `docs/MILESTONE_TIMELINE.md`: N/A(제품 Timeline 표시·필터·탐색 wiring과 동작 변경 없음)
- `docs/API.md`: N/A(서버 route·DTO·mutation·권한·revision 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB·migration·영속 authority 변경 없음)
- `docs/SECURITY.md`: N/A(권한·Origin·session·비밀 정책 불변이며 진단은 기존 numeric allowlist 재사용)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정·Calendar·dependency 알고리즘 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(Import 스키마 및 데이터 교환 계약 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(기존 Import·Export 구현·손실·권한 계약 변경 없음)
- `docs/EXCEL_EXPORT.md`: N/A(Excel 출력·raw 값·formula·크기 예산 변경 없음)
- `docs/VBA_EXPORT.md`: N/A(Excel·VBA 구현 및 DRM 환경 계약 변경 없음)
- `docs/DEPLOYMENT.md`: N/A(배포·컨테이너·storage 변경 없음)
- `docs/CI_CD.md`: N/A(workflow·required checks·cache·version·release 정책 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(공식 PR/main/환경별 검증 gate와 실행 정책 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(GitHub 권한·Ruleset·PR 운영 정책 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(현행 Owner-managed·HIGH·독립 검토·승인 기준 변경 없음)
- `docs/GANTT_STATE_CONSISTENCY.md`: N/A(규범 버전과 REVIEW_PENDING 상태 불변)
- `docs/GANTT_STATE_CONFORMANCE.md`: N/A(전역 누적 시나리오 요구·증거 경계 불변이며 U3 실행 결과는 TEST_PLAN에 기록)

문서 의미 정합성 및 실제 변경은 Manager·별도 qa_docs가 최종 diff와 대조했다. 구조 검증 PASS는 제품/업무 의미 QA나 Owner ACCEPT가 아니다.

## 검증 / 현재 상태

- 최초 구현 LFF: frontend 실행 scoped Vitest 5파일165 tests, scoped ESLint, typecheck PASS. 아래 독립 반례에서 REWORK되었으므로 최종 source의 통과 증거로 재사용하지 않는다.
- 최초 독립 qa_docs PRE_QA: REWORK. 워크트리 수정 없이 Node/esbuild 메모리 번들로 직접 실행한 반례3개 FAIL: geometry 읽기 중 context.source.apiInstance 제자리 변경 및 recovery.phase=PENDING 제자리 변경인데 deliver=true/callback1, 동일 값·중첩 stamp의 property 순서만 역순인 plain U1 context에서 semanticId1→2/reused=false. 원인: final 비교가 live reference를 잡고 있으며 identity가 object property serialization 순서에 의존했다.
- REWORK: frontend가 context/recovery 불변 capture·필드 의미 비교 및 전용 회귀를 보완하고 같은 독립 반례·관련 LFF를 재실행한다. 새 결과를 원본 FAIL과 구별해 기록한다.
- 재작업 LFF: frontend의 최종 source에서 아래 scoped Vitest 5파일167 tests PASS(U3 전용55). scoped ESLint 및 `npx tsc --noEmit` PASS. 최초 dedicated49 보고는 중간 집계였으며 최종55로 확인했다. 원격 전체 회귀 PASS가 아니다.
- 재작업 독립 검증: 관련8파일214 tests/typecheck/scoped lint 및 최초3반례 PASS. 그러나 추가 geometry 읽기 중 `invalidate()` 반례에서 approved=true/callback1/currentAfter=false를 실제 재현하여 PRE_QA=REWORK 유지. 이 네 번째 FAIL은 완료 객체 identity의 최종 재확인 누락이다. 첫3개 FAIL과 후속 PASS를 소급 변경하지 않는다.
- 최종 구현 LFF: 앞선 동일 scoped 명령5파일168 tests PASS(U3전용56), ESLint/typecheck PASS.167개 결과는 추가 invalidate/current-cancel 반례 이전 원장으로 보존한다.
- 최종 독립 qa_docs `/root/qa665` PRE_QA: PASS(미연결 U3 모듈 범위), substantive 미해결0. 직접 실행 Vitest8파일215 tests PASS(exit0,1.47s), typecheck/scoped ESLint/diff 공백 PASS. 외부6반례: context/recovery 제자리 변경·읽기 중 invalidate·현재 attempt cancel은 deliver=false/callback0, property 순서만 변경하면 semanticId1 유지/reused=true/동일 receipt, forged copy는 거부하되 원본 current 유지. 최초4 FAIL과 재검증 PASS를 별도 보존한다.
- 최종 source SHA256: `projection-observation.ts`=`b2f3b1711500cb304d985109135dddecd02fc7cc2ce2dd88f6df78bc20e1aa8a`; 기존 observer+opt-in export=`30821c1e020fc6228eb20d43d9fac6dc083c6195ead3394932b86dd439868be8`; 전용 Unit=`1d845a88886366b1ba232f5f6a5f429bc6a02a8d4bdd1fd582f5f1346440f6a3`.
- Manager 확인: Markdown222파일/version0.114.0/DOC_SYNC 구조·AC1~6 매핑/diff 공백 PASS. 제품 wiring·U2/U4 concrete import·새 writer0. 최종 source/doc 인계 확인 후 infra가 exact tree/HEAD/base·review·mergeability 및 CI 시작만 조회한다.
- 원격 quality/e2e/docker, Trusted QA, QA_FINAL, Owner/Manager ACCEPT: NOT TESTED. MERGE_READY: BLOCKED.
- 실제 GHCR/main/release/제품 Calendar·Resource E2E: 이번 승인 범위 밖, NOT TESTED.
- Git read/fetch 가능. gh 저장 토큰 HTTP401; 연결된 GitHub 도구로 Issue/PR/API를 조회하고 게시한다. 비밀값 출력/추가 token 저장 없음.

## Local Fast Feedback 명령 / 재현 경계

```bash
npx vitest run --config tests/config/vitest.config.ts tests/features/gantt/projection-observation.test.ts tests/features/gantt/projection-settled.test.ts tests/features/gantt/core-reader.test.ts tests/features/gantt/state-consistency-runtime-fixture.test.ts tests/features/gantt/viewport-coordinator.test.ts
npx eslint src/features/gantt/viewport/projection-observation.ts src/features/gantt/projection-settled.ts tests/features/gantt/projection-observation.test.ts
npx tsc --noEmit
node scripts/check-markdown-links.mjs
node scripts/verify-release-version.mjs
git diff --check
```

Manager는 기존 canonical-projection/canonical-snapshot-sync/state-consistency-contract/state-consistency-harness/state-consistency-manifest 5파일63 tests를 별도 실행 PASS했다. 새 facade의 실제 Coordinator adapter는 테스트 파일에만 있으며 production wiring이 아니다. 설치 Core captured fixture/provenance 원본은 재수집/변경하지 않았다. 대량 성능·브라우저·HTTP/SQLite·전체 Playwright·Docker는 로컬 실행하지 않았고 원격 공식 전체 회귀도 시작만 확인한다.

## U5 public facade 인계

- 진입점: `projection-settled.ts`에서 `createProjectionObservation`과 관련 타입을 opt-in export한다. 기존 두 함수의 구현·signature는 변경하지 않는다.
- U3 port는 U1 `CoreReaderPort`, `CoreVerifierPort`, `GeometryReaderPort`, `RecoveryInputPort`, `ConsistencyClockPort`, `ConsistencyAbortPort`를 사용한다. `readContext`/`readRows`/`readLayoutAxis`와 선택적 기존 trace sink는 읽기만 한다.
- `readLayoutAxis()`는 목표 문자열을 복사하는 대신 현재 실제 scale/date extent/columns·layout에서 독립 산출해야 한다. U1 GeometrySnapshot에는 actual axis가 없으므로 U3 전용 read-only port로 추가했으며 U1 public 타입/production port는 수정하지 않는다.
- `observe(desired)`의 result는 이번 `observation.id`와 완료의 `semanticId`를 모두 제공한다. 재사용 시 receipt 객체·receipt의 원본 observation·원래 intent lease를 유지하고 result의 attempt만 새 값이다. Coordinator에 필요한 projection generation은 semantic completion과 연결해야 하며 attempt ID를 취소 세대로 재사용하지 않는다.
- `isCurrent(receipt)`/`deliver(receipt, callback)`은 발급한 객체 identity와 현재 actual Core/row/geometry/axis/recovery·문맥/lease를 다시 검증한다. 비교 기준은 live reference가 아닌 불변 capture이며 plain object property 순서는 의미 변경으로 취급하지 않고 Task/row/Link 배열의 순서는 유지한다. await 뒤 새 lease를 발급하지 않는다. `invalidate`/`dispose` 및 observation `cancel`의 수명 계약을 함께 연결해야 한다. 동일 완료를 새 attempt가 채택한 뒤에는 이전 attempt의 늦은 cancel이 새 holder의 완료를 취소하지 않는다; 최신 채택 attempt의 cancel은 완료를 무효화한다.
- typed outcomes: SETTLED/SUPERSEDED/NOT_MEASURABLE/NO_SCROLL_CAPACITY/TIMED_OUT/FAILED. 명령 반환·보이지 않는 DOM·읽기 실패·invalid proof는 SETTLED 근거가 아니다. data receipt에는 viewport 완료를 포함하지 않는다.
- 생산 source의 native dirty/recovery/query/API/axis/layout/visibility/user-input 변경과 actual read의 coherence는 U5 책임이다. port가 actual evidence 대신 목표를 반환하면 모듈 Unit PASS만으로 안전성을 증명할 수 없다.
- 현재 canonical normalization/actual Core/row 비교는 유한 관측 및 delivery 시에 수행한다. 매 React render의 상시 observer가 아니며 대량 성능·실제 browser geometry/제품 lifecycle은 이번에 측정하지 않았다. 기존 captured synthetic fixture를 새 실제 제품 증거로 재분류하지 않는다.

## 인계 / rollback

#667에 exact source SHA, public exports, semantic identity 규약, receipt 예시·typed failure/source invalidation과 테스트/미검증 경계를 전달한다. 제품 wiring 이후 전역 GSC/SC 적합성을 별도로 검증한다. rollback은 신규 facade 및 연결 소비자를 함께 되돌린다. 기존 observation-generation 취소/receipt 재사용 문제 재발 위험을 기록하며 #570/#571의 역사적 완료/FAIL/PASS를 소급 변경하지 않는다.
