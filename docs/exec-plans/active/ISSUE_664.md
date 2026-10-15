# Issue #664 — U2 actual-Core no-op·저장 결과 복구

Refs #664

## 실행 계약 / 기준선

phase: LOCAL_VALIDATED → DOCUMENTATION_SYNC → PR_CI
risk_level: HIGH
risk_reason: 저장 거부·결과 불명확 및 native Core 정합성을 다루는 비동기 복구 계약
qa_method: OWNER_MANAGED
qa_required: true
manager_decision: NOT TESTED
MERGE_READY: BLOCKED
release_required: false
release_authorized: false
issue_comment_writer: manager
issue_comment_allowed_types: PLAN, STATUS, EXCEPTION
documentation_owner: Manager

사용자 요청 종료점은 구현·DOCUMENTATION_SYNC·미해결 리뷰/충돌 해결 후 exact-head PR CI 시작이다. 결과 모니터링·병합·main/GHCR·Release/tag·브랜치 정리·Issue 종료는 별도다. U5 연결 전에는 제품 해결 완료가 아니라 독립 모듈 후보이며 최종 MODULE_READY도 원격 검증·Owner 수용 후 판정한다.

- baseline main / document commit / U1 interface merge SHA: `d445ec58bf9106414c99a150ee8f52599834baf9` (#663 / PR #687).
- 선행 #661 문서 PR #669 및 #663 구현 PR #687 main 병합, Issue #663 CLOSED를 GitHub와 remote main에서 확인했다. #664 기존 구현 PR은 착수 시 0건이다.
- branch: `feat/issue-664-canonical-recovery`; worktree: `/home/planner/Dev/masterGantt-worktrees/issue-664`. 기존 worktree·미추적 자료는 보존한다.
- application / lockfile: `0.114.0` 유지. 실제 설치 React Gantt `2.7.3` / gantt-store `2.7.2`를 고정한다. 비활성 모듈/fixture 추가이며 제품 version·패키지·API·DB·workflow 변경 없음.
- gantt_standard_version: `1.0.0-candidate`, 규범 상태 `REVIEW_PENDING` 유지. [GSC](../../GANTT_STATE_CONSISTENCY.md), [Conformance](../../GANTT_STATE_CONFORMANCE.md), [ADR](../../GANTT_ADAPTER_ADR.md), [Trace](../../GANTT_SYNC_TRACE.md), [이행계획](GANTT_STATE_REMEDIATION.md)을 위 document commit에서 읽었다.
- AGENTS와 REQUIREMENTS/ARCHITECTURE/API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY/TEST_PLAN/REMOTE_VALIDATION/CI_CD/GITHUB_OPERATIONS/ISSUE_LIFECYCLE/QA_REVIEW_POLICY/DESIGN/UI_UX_GUIDELINES/active PLAN을 영향 분석에 적용했다. 공식 serialize/move-task/update-task 문서 URL 확인과 설치 타입/실행 증거를 구별한다.

## 역할 / 파일 소유권

- frontend `/root/frontend664`: 신규 `src/features/gantt/core-conformance.ts`, `canonical-recovery.ts` 및 전용 Unit. 기존 sync는 signature/동작 보존, 필요 시 opt-in facade만 허용한다.
- Manager `/root`: 이 Work Packet·아래 required docs, 신규 `tests/fixtures/gantt-canonical-recovery/**` 실제 합성 browser 검증, GitHub 기록·게시·PR/CI 시작 확인.
- backend `/root/contract_review664`: 기존 저장/권한/date-only·복구 계약 read-only 사전 검토. 작성 영역과 독립이며 최종 원격 QA 승인을 뜻하지 않는다.
- qa_docs: DOCUMENTATION_SYNC 이후 실제 분리된 read-only 사전 검토. 최종 QA_FINAL/Manager/Owner ACCEPT와 구별한다.
- U1 `state-consistency/**` interface/fixture, U3/U4 concrete 모듈, U5 `project-gantt.tsx`/`project-readonly-view.tsx`/production Coordinator·port는 수정하지 않는다. 같은 파일 동시 쓰기 금지.

## 상태 / 쓰기 소유권 / 적용 규칙

GSC-01/02/03/08/09/11/12를 적용하며 API·query/scope·generation 무효화에는 GSC-06/07을 따른다. 서버 snapshot만 저장 authority이며 Core 임시 상태·canonical target·actual read·request/base/affected IDs·dirty/recovery generation을 구별한다. 새 사용자 pending을 과거 canonical로 덮지 않는다. 412는 최신 GET, 확정 거부는 승인되지 않은 Core 변경 복구, 500/timeout/network는 commit 불명확으로 GET 확인, GET 실패는 uncertain/required 및 충돌 쓰기 차단 계약을 반환한다. 자동 mutation 재전송·임의 revision 승격 없음.

Reconciler는 공개 data/tree/link 최소 diff만 소유하며 viewport/columns/filter/layout·서버 mutation을 실행하지 않는다. 접힘/선택·살아 있는 자식·형제 anchor·full canonical/hidden Milestone 관계 guard는 기존 경계를 보존한다. 실제 읽기 실패·불일치·시간 만료·superseded는 recovered/SETTLED가 아니다. proof는 검증한 API/desired/generation에 한정하며 dirty invalidation을 U5에 인계한다. 예외 ADR: N/A(새 private write/PRO/resize 우회 없음).

## AC_TEST_COVERAGE

- AC1: `core-conformance.test.ts` — same desired/API/revision에서 정상과 순서·날짜·임시 Task·Link 차이, read 실패·dirty proof 무효화.
- AC2: `canonical-recovery.test.ts` — 412/500 순서, 422 날짜, add/link/delete/type 거부 후 actual canonical 일치·후속 편집 잔류 없음. 실제 Core browser 검증은 별도 fixture/영수증.
- AC3: `canonical-recovery.test.ts` — 500 commit 성공/미성공/GET 실패, stale/new request/API/abort·복구 중 pending 전환. 자동 mutation retry 없음.
- AC4: conformance/recovery Unit 및 actual fixture — fresh DTO·정상 no-op의 public mutation0/viewport write0/server mutation0. proof 재사용·실제 drift invalidation을 함께 검사.
- AC5: 설치2.7.3 공개 serialize fixture와 canonical date-only/Milestone start/end/renderer 기본값·hierarchy/order를 비교. actual browser 결과와 mock/refetch 증거를 구별한다.
- AC6: U1 공개 port 기반 독립 테스트, U3/U4 concrete import0·production consumer0·기존 sync 동작 보존, 최소 diff 측정/복잡도 범위와 미검증 기록.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_664.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/GANTT_STATE_CONFORMANCE.md`: UPDATED
- `docs/GANTT_ADAPTER_ADR.md`: UPDATED
- `docs/GANTT_SYNC_TRACE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/GANTT_STATE_REMEDIATION.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/GANTT_STATE_CONSISTENCY.md`: N/A(규범 버전 및 MUST와 REVIEW_PENDING 불변, 구현 현황은 Conformance에 기록)
- `AGENTS.md`: N/A(기존 GSC 필독 및 역할 지침 적용, 실행 지침 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 Lifecycle 절차 적용, 정책 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(HIGH 및 Owner-managed trusted/Owner gate 유지)
- `docs/REQUIREMENTS.md`: N/A(기존 Issue664 AC 구현, 제품 요구사항 활성화는 U5)
- `DESIGN.md`: N/A(제품 UI 및 시각 언어와 사용자 flow 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(제품 interaction 및 focus와 접근성 계약 미변경)
- `docs/PROJECT_UX.md`: N/A(제품 Gantt wiring 및 복구 UI 변경은 U5 소유)
- `docs/MILESTONE_TIMELINE.md`: N/A(Milestone 표시 및 full canonical subtree 계약 유지)
- `docs/API.md`: N/A(기존 권한 및 Origin과 revision 및 GET/저장 응답을 소비하며 REST 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB schema 및 migration과 실제 SQLite 변경 없음)
- `docs/SECURITY.md`: N/A(기존 synthetic 및 allowlist 사용, 보안 정책 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Date/date-only 변환 재사용, 일정 계산 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(교환 schema 및 원장 의미 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(제품 Import/Export 형식 및 동작 변경 없음)
- `docs/EXCEL_EXPORT.md`: N/A(Excel 형식 및 사용자 동작 변경 없음)
- `docs/CI_CD.md`: N/A(기존 Unit runner 및 required checks와 release 계약 불변)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 gate 불변, 실제 PR CI 시작 증거는 Issue/PR에 인계)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 GitHub-first 운영 절차 적용, 권한 및 workflow 변경 없음)

## 검증 / 원본 실패 / 미검증

SC-01~05/07을 독립 모듈 검증에 적용한다. SC-06/08~14의 제품 receipt/axis/geometry/접근성·peer 통합은 U3/U4/U5/#573/#574 소유이며 NOT TESTED다. U1 manifest는 수정하지 않으며 등록 성공을 실행 PASS로 간주하지 않는다.

원본 #552 CI #2682의 DnD412/500 A-C-B 잔류·422 후36px Bar 잔류와 #569의 DEFER/FAIL 이력은 불변이다. 이 모듈의 합성/Unit PASS는 그 제품 실패의 해결 증거가 아니다. 실제 HTTP/SQLite·제품 DnD/Bar geometry·5폭/DayWeek·대량 성능·수명주기·원격 required3/Trusted QA·최종 Owner 수용은 NOT TESTED다.

환경: GitHub CLI 최초 조회는 HTTP401(Bad credentials)로 실패했으나 인증된 GitHub connector와 read-only git fetch는 정상이다. 비밀값을 출력/저장하지 않았다. `npm ci --ignore-scripts` PASS(447 packages); 기존 dependency audit HIGH6 보고, 의존성 자동 수정 없음. 이 install 결과는 runtime native SQLite smoke가 아니다.

로컬 최종 결과와 실제 browser 영수증은 구현·검증 후 아래에 기록한다.

## U5 인계 / 롤백

U5는 공개 exports/결과와 request/base/affected IDs 및 dirty/recovery invalidation 책임을 실제 mutation gateway·serialized Core queue에 연결한다. 서버 GET·권한 잠금/초안 보존·conflicting writes 차단 UI는 U5가 기존 정책에 연결하며 새 저장 authority를 만들지 않는다. 정상 metadata/no-op에서도 proof가 유효한지 확인하고 native 변경·API 교체/새 request/abort를 즉시 무효화한다. 최종 data conformance proof는 viewport 완료 영수증이 아니다.

소비자 전에는 신규 모듈/fixture를 되돌린다. U5 연결 후에는 facade·소비자를 함께 되돌리고 interface 호환성을 확인한다. DB/서버 데이터 rollback 없음. 기존 알려진 회귀를 재도입할 수 있으므로 rollback 자체를 PASS로 표시하지 않는다.

## 사전 QA REWORK 원장

별도 read-only `qa_docs /root/qa664`가 다음 P2를 실제 재현했다. 원본 지적을 삭제하거나 최초 source를 PASS로 바꾸지 않는다.

1. `state().identity`가 port 객체를 참조하여 GET 대기 중 query/key의 in-place 변경이 captured identity까지 바뀌고 과거 복구가 SETTLED되는 문제. context/source/keys/recovery를 immutable value snapshot으로 복사하고 Core read 및 proof 재사용 전후에도 semantic identity를 재검증한다. fresh DTO의 객체 속성 생성 순서는 의미 변화로 간주하지 않는다.
2. GET이 반환한 identity/snapshot도 후속 public exec 대기 중 외부에서 변경될 수 있어 검증한 query와 다른 query의 proof가 SETTLED로 나오는 추가 alias P2를 재현했다. 수신 시 identity/keys와 목표 snapshot을 분리·동결하여 검증/적용/최종 proof/반환의 목표를 동일하게 고정한다.
3. 호출별 timeout을 다시 잡아 GET40ms + update40ms가 전체48ms 예산을 넘어도 SETTLED/proof deadline48을 반환하는 문제. recovery 시작 시 전체 deadline/frame budget을 확정하고 모든 await·최종 actual read에 적용한다. 시간 초과는 TIMED_OUT·UNCERTAIN이며 성공으로 바꾸지 않는다.

4. 최초 사전 검토 PASS 뒤 추가 검토에서 GET과 `clock.frame()` 모두 never-resolving일 때 timeout10ms/maxFrames1에도100ms 외부 watchdog까지 RECONCILING·GET signal 미취소인 추가 P2를 재현했다. 이전 PASS를 REWORK로 갱신하고 게시를 보류했다. RAF와 독립적인 wall-time watchdog과 controller abort wake-up을 모든 await에 적용하고 finally에서 timer/listener를 정리한다. suspended frame/GET·외부취소 회귀 및 변경 source의 실제 Core 영수증 재생성 후 재검토한다.

기존 #552/#2682 제품 실패·U1 원본 실패는 그대로 유지한다. 이번 지적의 수정 Unit과 final source 실제 Core capture·별도 재검토 결과는 아래 최종 증거에 연결한다.

## 공개 API / U5 인계 세부

- `core-conformance.ts`: `verifyCoreConformance`, `reusableCoreProof`, `sameConformanceSnapshot`, semantic context 비교/불변 snapshot helper. full public data read 결과이며 logical visible rows·DOM·viewport 완료를 대체하지 않는다. 매 render/frame에 호출하지 않고 native dirty invalidation 및 명시적 복구/검증 transaction 경계에서 사용한다.
- `canonical-recovery.ts`: `createCanonicalRecovery({core, api, clock, abort, fetchCanonical, currentIdentity, apiInstance}, budget)`; `beginMutation(requestId, affectedIds)` ticket의 base revision/API/generation을 고정하고 `completeMutation(ticket, SUCCESS|401|412|422|500|TIMEOUT|NETWORK)`으로 저장 결과를 분류한다.
- `recover()`는 최신 GET의 validated identity/snapshot과 실제 post-read proof를 SETTLED에서 반환하며 실패·시간초과·superseded·pending은 별도 결과다. `state()`/`canWrite()`는 UI handoff이며 server authorization을 대신하지 않는다. `markDirty()`는 native/app-owned data 변경마다 필요하며 `dispose()`는 인스턴스 수명 종료다.
- `authorizationRequired()`는 401 후 actual Core 복구 성공에도 true를 유지한다. `confirmAuthorization()`은 U5가 서버 권한 확인 성공 후에만 호출한다. 초안 자체는 모듈이 읽거나 변경하지 않는다.
- U5 GET adapter는 현재 Project ID를 확인해야 한다. 공통 identity에는 Project ID가 없으므로 project-scoped controller 수명과 `abort.isCurrent()`가 다른 Project 응답/수명 전환을 차단한다. revision은 confirmed/base 아래로 내려갈 수 없고 query/scope/키 구조도 검증한다. GET helper가 먼저 canonical을 게시하면 captured context를 바꾸므로 read-only 조회 → U2 검증/복구 → 현재 request에서 조건부 게시 순서를 지킨다.
- 직접 server mutation/retry/viewport/filter/columns write0. 실제 Core data actions가 만드는 간접 native geometry 영향은 U5 Coordinator transaction/제품 검증 대상이다.

## 복잡도 / 측정 범위

U1 normalization과 U2 conformance 및 Map Link 비교는 O(T+L) 목표다. 1000 Task + 2000 Milestone synthetic Unit은 full payload의 단일 reader 호출을 확인하며, 실제 browser fixture는5 Task/2 Link의12전환이다. 기존 `applyCanonicalGanttSync`의 hierarchy/sibling scans는 최악 O(T²)여서 전체 recovery를 O(T+L)이라고 주장하지 않는다. 이 PR은 기존 호출자의 동작을 보존하며 U5 전 대량 actual recovery timing/메모리·native geometry는 NOT TESTED다. 추가 task diff 최적화는 기존 anchoring/child survival 회귀를 보존하며 별도 측정 후 결정한다.

## 최종 로컬 검증 원장 / 요청 범위 경계

- Manager: 관련12파일161 Unit PASS, typecheck PASS, 변경8경로 scoped ESLint PASS, Markdown link222파일 및 version0.114.0·diff 공백 검사 PASS. production/U1/U3/U4/CI/package diff0과 module-only 의존 경계를 확인했다.
- 실제 설치 합성 Chromium:12전환 전부 actual drift 감지 후 SETTLED·finalMatch=true, 정상 fresh DTO no-op action0. 링크 추가/삭제는 차이1건만 제거/추가, 날짜/metadata/type 거부는 update-task1건, 임시 부모 삭제 전에 살아 있는 자식을 move-task로 분리했다. 선택fixture-b 및 마지막 collapsed Summary=false를 보존했다. tasks5/links2/1440×900/Asia-Seoul; 초기 원점 X/Y만 관측했고 nonzero viewport·제품 Bar DOM은 미검증이다.
- 영수증: `tests/fixtures/gantt-canonical-recovery/actual-recovery-2.7.3.json`, `actual-recovery-provenance.json`. 모듈/기존sync/U1 reader/fixture/lockfile SHA256를 고정하고 runtime Unit3개가 이를 검증한다. browser controller dispose 및 CLI close 완료.
- Manager 신규 runtime test 최초 typecheck는 JSON union의 빈 action 배열 때문에 indexOf 인자가 never로 추론되어 TS2345 2건 FAIL이었다. action 목록을 readonly string[]로 명시하여 detach-before-delete 단언을 유지하고 재실행 PASS했다. 실제 Core 자료와 모듈 source는 이 타입 수정에서 불변이다.
- 별도 backend `/root/contract_review664`: 저장/권한/date-only 경계 read-only 검토 완료, 실제 테스트 실행 없음. 별도 qa_docs `/root/qa664`: 사전 검토 PASS/미해결P1·P2 0건, P2 alias2종/누적deadline1종 및 stalled-frame timeout1종 재현과 보완 재검토, 독립10파일151 Unit/typecheck/scoped lint·source pin PASS. 이는 사전 검토이며 최종 원격 QA_FINAL·Owner/Manager ACCEPT가 아니다.
- 전체 공식 PR quality/e2e/docker·Trusted QA·최종 Owner 수용: NOT TESTED. 기존 원격 FAIL/DEFER를 소급 변경하지 않는다. PR CI source run/attempt/Head/base/test merge 및 review/충돌 상태는 게시 뒤 Issue/PR STATUS에 정확히 기록한다. 이번 요청은 CI 시작에서 종료하며 결과를 모니터링하지 않는다.

## 게시 전 최종 REWORK 확인

stalled-frame 추가 P2 보완 source에서 Manager 관련12파일161 Unit 및 typecheck/scoped lint를 재검증하고 actual Core12전환/source 영수증을 다시 생성했다. 최초155 Unit과 첫 사전 PASS는 추가 P2 발견 이전 source의 역사적 결과다. 별도 qa_docs는 원본 never-GET/frame·timeout10ms 재현을 새 source에서 재실행하여 약11ms의 TIMED_OUT/UNCERTAIN·GET signal aborted=true·canWrite=false를 확인했다. 단일 watchdog 및 취소 wake-up·GET/exec/post-read frame 경계·timer/listener cleanup 검증을 포함한다. 실제 source fingerprint와 최종 Reviewer 결과는 Issue/PR STATUS에 연결한다.

## PR #689 · CI #2785 리뷰 보완 (2026-10-15)

- Required Quality / Chromium E2E 6/6 / Docker는 원본 Run #2785.1에서 PASS. QA Final은 source provenance에 미해결 P2 review thread 1건으로 BLOCKED; 기능 테스트 실패로 오인하지 않는다.
- 실제 브라우저 영수증의 임시 worktree HEAD `b277c836...`는 게시된 commit graph에 없었다. 원본 `capturedAt`, 12개 합성 시나리오·실행 결과와 source SHA256 원장은 보존하되 `sourceBase`를 GitHub가 확인한 U1 main merge 조상 `d445ec58bf9106414c99a150ee8f52599834baf9`로 교정한다. 이 SHA는 *capture에 사용한 U2 파일 전체의 commit SHA가 아니며*, 구체 소스 일치는 영수증의 별도 SHA256 파일 지문이 담당한다.
- recorder는 전체 Git history·commit object·capture HEAD까지의 조상성을 검증하지 못하면 영수증 생성 자체를 거부한다. Unit은 pinned merge SHA와 비-shallow 환경에서 Git object/ancestry를 검사하고, GitHub Actions의 depth-1 synthetic merge에서는 고정된 검증 조상 SHA와 전체 파일 fingerprint를 확인한다. 이 변경은 브라우저 재실행 증거가 아니며 PR 새 CI·Trusted QA·Owner ACCEPT는 별도 판정한다.

## PR #689 · CI #2788 검증 및 재실행 요청 (2026-10-15)

- 이전 CI #2785.1의 유일한 최종 실패는 병합 불가능한 코드가 아니라 미해결 P2 provenance review thread에 의한 신뢰된 자동 QA BLOCKED였다. 임시 worktree HEAD를 출처로 기록한 문제는 U1의 인증된 병합 SHA `d445ec58bf9106414c99a150ee8f52599834baf9`와 독립 파일 SHA256 영수증으로 분리해 보완했고, 해당 리뷰 스레드를 해결했다.
- 후속 Full PR CI [#2788.1](https://github.com/planner77/masterGantt/actions/runs/38674423344)에서 정책·타입 검사·ESLint·전체 Vitest·Next.js build·PR Chromium E2E 6/6·Docker smoke 및 세 Required aggregate, QA Final — Automated 모두 **SUCCESS**를 확인했다. 과거 #2785.1 실패 결과는 그대로 보존한다. 이는 제품 U5 wiring 또는 #552 실제 DnD/Bar 문제의 완료 판정이 아니다.
- 현재 `main` `417dd41e4838f72c3f7c547463591aa10809d25b` (#665)과 PR HEAD `9b521d8849a94814cd54740ded01b0077d99cabe`는 비교 시 behind=0, mergeable=true, 미해결 review thread=0이었다. 이번 기록에서 잘못 남아 있던 리터럴 `\${base}`를 정확한 검증 SHA로 교정한다.
- 이번 새 CI 요청은 이 문서 정정 커밋의 새로운 exact HEAD에서 시작만 확인한다. 결과 모니터링·병합·Main CI·GHCR/Finalizer·Issue 종료는 범위 밖이며 해당 새 실행의 결과는 확인 전 NOT TESTED다. GSC/SC 불변, API/DB/UI·package/version·기존 로직 및 CI/QA 정책 변경 없음.
