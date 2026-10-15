# Issue #667 — 최신 main Gantt 정합성 제품 통합

Refs #667

## 실행 계약

phase: CI_2813_CORRECTION_PR_READY
risk_level: HIGH
risk_reason: 실제 Core 복구·비동기 저장 결과·viewport 의도 및 날짜축 연결의 교차 회귀
qa_method: OWNER_MANAGED
qa_required: true
manager_decision: NOT TESTED
MERGE_READY: BLOCKED
release_required: true
release_authorized: false
issue_comment_writer: manager
issue_comment_allowed_types: PLAN, STATUS, EXCEPTION, FINAL
documentation_owner: Manager

최초 사용자 요청은 구현·관련 문서 동기화·미해결 리뷰와 충돌 해결이며 CI 결과 모니터링은 제외했다. 2026-10-16 후속 요청으로 실패한 PR CI의 원인 분석·보완 및 새 Full PR CI 시작까지 재개했다. 새 실행의 완료 모니터링·병합은 포함하지 않는다. 원격 branch/PR 게시 뒤 Required Quality/E2E/Docker, Trusted QA, Owner ACCEPT는 별도 판정한다. 병합·Main/GHCR·정식 release/tag·브랜치 정리·Issue 종료를 수행하지 않는다.

## 기준선 / 의존성 / 버전

- repository: planner77/masterGantt; [Issue #667](https://github.com/planner77/masterGantt/issues/667).
- 착수 main/document commit: `29c86ca918baa1811bc12a3eb60f86ffc5406b40`.
- 통합 main: `ee6365bf57ab637b4c0aca61fdedaf5148253052`(#622/PR #692 종료 이력 복구). merge `1fce774825c826b6359181dc6d58d2a12ed85e0a`에서 CHANGELOG 양쪽 항목을 보존해 충돌을 해결했다. `.github/**`/`scripts/**`는 통합 main 대비 diff 0이며 #667에서 정책을 변경하지 않는다.
- branch: `feat/issue-667-gantt-product-integration`; worktree `/home/planner/Dev/masterGantt-worktrees/issue-667`. 기존 checkout의 비추적 검증 자료는 보존한다.
- 선행 #663/PR #687 `d445ec58bf9106414c99a150ee8f52599834baf9`, #665/PR #688 `417dd41e4838f72c3f7c547463591aa10809d25b`, #664/PR #689 `0493ef64d0f2fa5961a241886d48e3dbfdc4f253` 및 #666/PR #690 `40f5f92ee296b2d9f6995bdca96712552537698f`가 main에 포함된다. 모듈 병합은 제품 동작 PASS가 아니다.
- #674/PR #675는 착수 시 OPEN, Head `8d115a1572466717692468a707191b1677db20d8`. 미병합 진단 patch를 복사하지 않는다. main에 이미 반영된 #622/PR #686의 독립 준비 영수증·React API identity 검증을 보존한다. #675와 동시 작성·선병합하지 않는다.
- application `0.114.0` → PATCH `0.114.1`: 기존 제품 동기화 결함 교정이며 신규 Milestone 표시 기능이나 API/DB 변경이 아니다. manifest/lockfile/CHANGELOG를 동기화한다. version bump는 릴리스 승인이나 backlog 승계 승인이 아니다.
- 설치: React Gantt `2.7.3`, gantt-store `2.7.2`, Next `16.3.8`; frozen `npm ci`를 실행한다.

## 필독 / 표준 적용

gantt_standard_version: 1.0.0-candidate
gantt_standard_status: REVIEW_PENDING
document_commit: 29c86ca918baa1811bc12a3eb60f86ffc5406b40
applied_gsc: GSC-01~12
exception_adr: N/A(기존 공개 API·단일 writer 계약 안에서 구현하며 규범 약화 없음)

AGENTS, REQUIREMENTS, ARCHITECTURE, API, DB_SCHEMA, SCHEDULING_ENGINE, SECURITY, TEST_PLAN, REMOTE_VALIDATION, CI_CD, GITHUB_OPERATIONS, ISSUE_LIFECYCLE, QA_REVIEW_POLICY, DESIGN, UI_UX_GUIDELINES, PROJECT_UX, MILESTONE_TIMELINE, GANTT_STATE_CONSISTENCY, GANTT_STATE_CONFORMANCE, GANTT_ADAPTER_ADR, GANTT_SYNC_TRACE 및 active PLAN/보완계획과 #664/#665/#666 Work Packet을 적용한다. Next 설치 문서의 `use-client`/client boundary를 확인한다.

현재 #548 marker-last 결정이 이전 '#552에서만 U5 통합' 설계를 대체한다. 본 PR은 main 대상 Primary `Refs #667`이며 #552/PR #561의 native Milestone 행 분리·marker 표시를 구현하지 않는다. 기존 native Milestone 행/bar와 marker 미활성 상태를 보존한다. marker-OFF의 native 행0 요구는 후속 #552/#574 프로파일이다.

## 역할 / 쓰기 소유권

- Manager `/root`: Work Packet·관련 문서·버전·제품 E2E·Issue 기록·원격 PR 및 충돌 조정.
- frontend `/root/product_wiring`: `project-gantt.tsx`, `project-readonly-view.tsx`, Coordinator/port 및 최소 연결 모듈·관련 Unit의 단일 작성자. 다른 작성자의 변경을 되돌리지 않는다.
- frontend `/root/editor_axis_tests`: Editor/axis E2E의 초기 전용 작성. 최종 통합/후속 보완은 Manager에게 인계했다.
- infra `/root/publish_transport`: 인증된 GitHub Git Data의 blob/tree/commit/branch 게시와 byte 동일성 검증. Issue 댓글·PR 작성은 Manager이며 CI를 모니터링하지 않는다.
- researcher `/root/api_research`: 설치 공개 타입·공식 SVAR API read-only 검증.
- qa_docs `/root/integration_tests`: 실제 테스트/문서/코드의 별도 read-only 사전 검토. 최종 QA_FINAL·Owner ACCEPT와 구분한다.

API/SQLite/보안/일정 알고리즘·CI workflow·Ruleset은 변경하지 않는다. Reconciler는 데이터 차이만, Observation은 읽기만, Coordinator/port는 단일 viewport 쓰기만 소유한다. canonical 서버 snapshot과 full Task/Link/Membership·권한/revision은 기존 계약을 따른다.

## 구현 계획 / 소유권 경로

1. Workspace HTTP 결과 → confirmed snapshot 또는 UNCERTAIN/추가 쓰기 차단 → ProjectGantt U2 mutation ticket/actual-Core 검증 및 복구.
2. U2 proof → U3 semantic observation/data receipt → Coordinator WAIT_PROJECTION의 데이터 완료. 수평 viewport 완료를 data queue에서 기다리지 않는다.
3. Coordinator 원래 lease → svar viewport port U4 axis transaction → 실제 coverage/geometry → 명시 X/Y 정책 → Core/native 정착. await 뒤 새 lease를 발급하지 않는다.
4. 같은 DTO/Calendar-only의 정합 no-op, 실제 dirty drift·거부·unknown 저장, 검색0/복귀·Resource 왕복·실제 사용자 wheel 및 native Milestone 보존을 검증한다.
5. 미사용 early-return/duplicate restore·remount 복구를 실제 연결 경로에서 제거하고 compatibility 및 한계를 ADR에 기록한다.

## 공개 API 근거

2026-10-15 공식 [serialize](https://docs.svar.dev/react/gantt/api/methods/serialize/), [exec](https://docs.svar.dev/react/gantt/api/methods/exec/), [filter-tasks](https://docs.svar.dev/react/gantt/api/actions/filter-tasks/), [scroll-chart](https://docs.svar.dev/react/gantt/api/actions/scroll-chart/), [resize-chart](https://docs.svar.dev/react/gantt/api/actions/resize-chart/), [update-task](https://docs.svar.dev/react/gantt/api/actions/update-task/), [move-task](https://docs.svar.dev/react/gantt/api/actions/move-task/)를 확인했다. 공개 serialize의 collection별 읽기는 원자성을 보장하지 않으므로 API/source/dirty generation을 교차 확인한다.

설치 IApi.exec는 Promise, 최신 문서는 void이므로 반환을 화면 정착으로 취급하지 않는다. 설치 scroll-chart.date는 최신 문서와 다르며 좌표는 left/top을 기준으로 한다. private Store·PRO 기능을 사용하지 않는다. 문서 조회·설치 타입·실제 Chromium 실행을 서로 대체하지 않는다.

## AC_TEST_COVERAGE

- AC1: production U2/U3/U4 import·호출·단일 writer·actual-Core no-op/dirty 및 원래 lease를 코드/Unit/제품 E2E로 확인했다. 선택 로컬 범위 PASS; 원격 인수 NOT TESTED.
- AC2: actual HTTP/SQLite DnD 412/500·날짜 422/412/500·후속 name-only 저장·Bar<0.5px, 성공 add/subtree delete/linked Editor와 native mock·Unit 거부 검증 PASS. 모든 add/link/delete/type 거부 조합의 actual HTTP 전수는 NOT TESTED이며 AC2 전체 인수 PASS로 올리지 않는다.
- AC3: actual Calendar 저장과 동일 revision DTO의 clean no-op/semantic 재사용·새 observation·Core 쓰기 0을 선택 검증했다. 로컬 PASS; 전체 조합·원격 인수 NOT TESTED.
- AC4: 검색0/해제·WBS exact120 bookmark·연속3회축확장·진행중실제wheel·Resource exact120/후속 native-reset·pending wheel/resize·Target 편집을 선택 검증했다. 로컬 PASS; 별도 marker reveal/전체 조합은 NOT TESTED.
- AC5: full canonical Task/Link·권한/revision, unknown/역전GET·추가 mutation0·같은 instance/tree/selection/columns·3000행/3회 cleanup 선택 범위 PASS. 장기 heap/전 listener·전체 Membership 조합은 NOT TESTED.
- AC6: 아래 SC-01~14·원본 실패/재검증·source fingerprint·선택 Unit/actual Core/actual HTTP·SQLite/원격 구분과 #552/#573/#574/#675 인계를 기록했다. DOCUMENTATION_SYNC의 로컬 영향/정합 검토 PASS.
- AC7: Head04b6/#2811.1, Head2f8f/#2812.1, Heada141/#2813.1은 각각 quality/docker PASS, e2e FAIL이다. 각 원본 test FAIL·취소·미실행을 보존한다. 다음 수정 Head required3/Trusted QA·Owner gate는 NOT TESTED, MERGE_READY=BLOCKED다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_667.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/evidence/issue-667/local-validation.json`: UPDATED
- `docs/evidence/issue-667/ci2811-correction.json`: UPDATED
- `docs/evidence/issue-667/ci2812-correction.json`: UPDATED
- `docs/evidence/issue-667/ci2813-correction.json`: UPDATED
- `docs/ISSUE_35_GANTT_SCALE.md`: UPDATED
- `docs/ISSUE_3_REVIEW.md`: UPDATED
- `docs/W21_REVIEW.md`: UPDATED
- `docs/images/issue-667/unknown-workspace-1440.png`: UPDATED
- `docs/images/issue-667/unknown-editor-1440.png`: UPDATED
- `docs/MILESTONE_TIMELINE.md`: UPDATED
- `docs/GANTT_ADAPTER_ADR.md`: UPDATED
- `docs/GANTT_SYNC_TRACE.md`: UPDATED
- `docs/GANTT_STATE_CONFORMANCE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/GANTT_STATE_REMEDIATION.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/GANTT_STATE_CONSISTENCY.md`: N/A(규범 버전·MUST·REVIEW_PENDING 유지, 제품 적용 원장은 Conformance)
- `AGENTS.md`: N/A(현행 지침·역할·승인 gate 적용이며 정책 변경 없음)
- `docs/REQUIREMENTS.md`: N/A(기존 제품 정합성 요구의 결함 교정, 신규 기능 요구 없음)
- `DESIGN.md`: N/A(기존 오류 피드백·semantic token·system font 재사용; Design Delta A 부재)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 오류 안내/초안 보존/명시 재조회 기준을 적용하며 공통 가이드 변경 없음)
- `docs/API.md`: N/A(REST/DTO/Origin/session/revision 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(schema/migration/저장 authority 변경 없음)
- `docs/SECURITY.md`: N/A(보안 정책·URL/password/session 계약 불변)
- `docs/SCHEDULING_ENGINE.md`: N/A(서버 일정 알고리즘·Calendar 계산 불변)
- `docs/IMPORT_SCHEMA.md`: N/A(교환 schema·호환성 불변)
- `docs/IMPORT_EXPORT.md`: N/A(교환/복제/Template 처리 변경 없음)
- `docs/EXCEL_EXPORT.md`: N/A(Excel 형식·Export 처리 변경 없음)
- `docs/VBA_EXPORT.md`: N/A(VBA/DRM 변경·실행 없음)
- `docs/DEPLOYMENT.md`: N/A(Docker/Compose/운영 환경 변경 없음)
- `docs/CI_CD.md`: N/A(기존 CI/릴리스 정책·workflow·required checks 유지)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 로컬/원격/환경 증거 경계 유지, 이번 실행은 Work Packet에 기록)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 Issue/PR/QA/승인 운영 정책 유지)
- `docs/ISSUE_LIFECYCLE.md`: N/A(현행 단계·Work Packet·문서 동기화 계약 적용)
- `docs/QA_REVIEW_POLICY.md`: N/A(HIGH/OWNER_MANAGED·Trusted QA·Owner gate 유지)
- `docs/exec-plans/active/ISSUE_552.md`: N/A(#552 미병합 source/원본 실패·release 원장은 수정하지 않고 본 Packet에서 main-first 후속 인계)

위 UPDATED는 실제 diff로 확인하며 최종 source·실행 원장·사전 검토 이후 DOCUMENTATION_SYNC를 판정한다.

## 검증 원장 / 남은 경계

선택 로컬 검증을 완료했다. Unit/mock/actual Core/actual HTTP·SQLite/원격 전체 CI를 분리하여 아래에 실제 결과를 기록한다. #666 원본390px NOT_MEASURABLE 및 full-capacity clamp FAIL은 그대로 보존한다. 실제 Core/native capacity 교집합 정책은 제품 연결에서 명시하고 지원 성공으로 과대 표시하지 않는다.

SC-01~14의 선택 실행과 전체 인수 범위는 아래 누적표로 구분한다. #573 좁은 화면·marker ON geometry와 #574 최종 전체 통합 gate, #553 JSON/Excel/SVG/PNG/Copy 교환 인수, Windows Excel/DRM·production proxy/TLS·off-host backup·최종 수동 UX는 별도 NOT TESTED다.

GitHub CLI HTTP401을 확인했으며 인증된 GitHub connector와 git fetch를 사용한다. 비밀값·실제 DB·runtime log를 Git/댓글에 저장하지 않는다.

## 롤백

제품 연결 커밋과 소비 adapter를 함께 되돌리면 U2/U3/U4는 미연결 상태로 돌아간다. 서버/DB 강제 수정·mutation 재전송·전체 reset/remount를 복구 수단으로 사용하지 않는다. 롤백은 알려진 actual-Core drift·unknown 저장·viewport 결함을 재도입할 수 있으므로 정상화 PASS가 아니다. #552/#553/#574는 이 통합 source의 새 Head와 검증 한계를 수용한 뒤 순차 진행한다.

## 실제 구현 / compatibility 결정

- Workspace의 Task/Hierarchy/Link/Membership 네 mutation 경로가 실제 요청 전 component-local 단조 증가 request ID·기준 revision·보수적인 전체 Task ID 집합을 고정하고 응답/네트워크 결과를 동일 capsule에 귀속한다. U2 `beginMutation`의 optional baseRevision은 빠른 응답으로 props가 먼저 진행해도 원래 요청 base를 유지하며 비정수·음수·미래 base는 거부한다. 기존 두 인수 호출과 U1 공개 타입은 유지한다.
- 서버 API가 root 목록 뒤 child를 반환하는 경우에도 canonical projection.tasks를 기존 형제순서의 full DFS로 정규화한다. 모든 ID·계층·Link와 서버 DTO 원장을 보존하며 이미 DFS인 입력은 배열 identity를 유지한다. 실제 Core reader의 preorder 검사를 완화하지 않는다.
- 실제 Core 정합 no-op에는 metadata restore/axis/scroll을 예약하지 않는다. native dirty·HTTP pending·unknown에서 bridge를 폐기하고 U3의 actual proof·행/geometry·source 검증을 통과한 data receipt만 기존 Coordinator에 제공한다. legacy observer는 기존 event payload 호환 bridge의 전단으로 남으며 수평 정착 완료를 data queue에서 기다리지 않는다. 레거시 metadata capture는 변경 복구의 명시 PASSIVE_RESTORE 전달에 한정하고 별도 scroll writer로 사용하지 않는다.
- 날짜축은 공개 end prop 전략을 제품에 도입하지 않는다. 설치 wrapper의 init이 선택/열·geometry를 재적용하는 위험을 검토하고 기존 #367의 synchronous synthetic/physical resize pair를 U4 SYNTHETIC_COMPATIBILITY로 감싼다. source-wide taint·active transaction·미완료 callback을 유지하고 등록 명령당 bounded facade(maxExtensions=1)에 원래 lease를 전달한다. 실패·취소·BUSY인 같은 명령을 새 facade로 자동 재시도하지 않는다. 같은 원래 X/Y·실제 coverage·Core/native 정착만 성공이며 #666의 clamp/390px 이력을 성공으로 전용하지 않는다.
- 취소 후 source taint의 복구는 별도 read-only `recoverNaturalGeometry` 계약을 사용한다. 실제 원래 source/API·새 요청의 고정 lease, active/미완료 writer0, 독립 Core 물리 폭·높이와 실제 DOM/axis/capacity·Core/native 위치의 3프레임 일치에만 재승인한다. 성공 위치 replay·resize/scroll 쓰기·확장 예산 초기화·새 facade 우회는 없다. 늦은 Promise는 source-wide counter로 완료까지 추적하고 hidden/불일치/취소/timeout/읽기 실패는 taint를 유지한다.
- UNKNOWN의 Editor는 기존 초안/폐기 확인을 유지하며 재조회·취소를 실제 전송 pending과 분리한다. mutation은 child Resource/Target/물류 Editor까지 readonly로 막는다. 명시 조회 성공은 최신 revision으로 Editor base를 갱신하고 conflict lock만 해제한다. 열린 modal의 native Gantt 편집 잠금은 계속 유지한다. 401은 읽기 전용 및 서버 확인 재인증 후에만 권한 상태를 회복한다.
- production 진단은 비활성이다. 개발 frame에는 코드/숫자 위주의 recovery/semantic/axis 결과를 남기며 payload·요청 ID·Task 이름·URL·비밀번호를 trace에 추가하지 않는다.

## 원본 실패 / 사전 검토 보완

원본 #552 CI #2682 및 #666 캡처의 FAIL/DEFER는 불변이다. 아래는 #667 로컬 실패이며 원격 CI 실패로 보고하지 않는다.

1. 최초 unknown 테스트는 응답을 hold하면서 성공 후 이름을 기다리는 helper를 사용해 2FAIL/1중단/2미실행이었다. 성공 대기와 submit을 분리했다. 후속 3FAIL은 숨겨진 거부 초안이 보존된 상태에서 global Escape만으로 폐기를 추측한 테스트였다. 다시 input을 열어 보존된 초안을 확인하고 input Escape로 명시 폐기한 뒤 새 revision으로 편집한다.
2. 사전 qa_docs가 stale bridge, Membership unknown handler 누락, Editor 재조회/transport busy/child mutation 차단 누락, 새 Date 객체의 wrapper init 위험을 지적했다. 실제 각 source를 보완했으며 별도 사전 검토와 최종 QA/Owner 승인을 구분한다.
3. 첫 제품 선택 회귀13case는 6PASS/7FAIL이었다. harness의 초기 입력 context/readonly Save 제거/열린 modal 잠금 기대를 정정했으며 단언을 삭제하지 않고 최신 source·명시 사용자 단계로 보호했다. 실제 native add201 뒤 `DESIRED_INVALID_TASKS`는 위 full DFS 정규화로 교정했다.
4. main 통합 뒤 같은13case는 11PASS/2FAIL이었다. Editor 후단의 frame 잠금 기대는 modal이 여전히 열린 상황을 반영해 save 재활성·unknown 안내 제거·modal 닫힌 뒤 native unlock으로 옮겼다. 실제 add 뒤 axis width936 유지와 COMPATIBILITY_TAINTED는 read-only 물리 복구 계약을 추가해 재검증한다. timeout/오차/skip을 늘려 성공으로 만들지 않는다.

원본 trace/error-context는 Git 밖 `output/playwright/issue-667/initial-harness-failures`, `draft-contract-failures`, `first-product-regression` 및 후속 실행 폴더에 보존한다. runtime DB/log는 commit하지 않는다.

## 과거 캡처의 immutable provenance

PATCH bump와 U2 optional baseRevision 변경 때문에 U1/U2/U4 과거 캡처의 current-file hash 비교를 그대로 쓰면 실패한다. 원본 관측·capturedAt·sha256는 다시 쓰지 않고 착수 main에서 동일 SHA256인 package/lock/U2 source bytes를 `tests/fixtures/gantt-state-consistency/capture-sources/*.snapshot.txt`에 보존한다. 각 provenance의 captureSourceMappings와 기존 U4 original source snapshots를 명시적으로 소비한다.

`assertCapturedInstall`은 package.version·lock.version·lock.packages[""].version 세 metadata 경로만 제외하고 현재 manifest와 전체 lock dependency tree가 원본과 같은지 확인한다. 의존성이 달라지면 과거 캡처를 재사용하지 못한다. 기록의 lookup 이동은 최신 source를 실제 재수집한 증거가 아니다. 현재 제품/새 모듈 변경의 PASS는 아래 새 Unit·actual 제품 browser 결과로만 판정한다.

## 축 예산 scope와 후속 방어 보완

첫 58개 선택 회귀는 56 PASS / 2 FAIL이었다. `project-gantt-scale.spec.ts`의 기존 3회 edge 확장과 `viewport-coordinator.spec.ts`의 120px bookmark 준비가 mounted facade의 EXTENSION_BUDGET_EXCEEDED/작은 capacity에 막혔다. 원본 #666의 한도는 facade/trial당 3회이며 GSC가 제품 mounted lifetime 3회를 정의하지 않는다. 제품은 새 등록 명령당 facade 1개·실제 확장 최대 1회로 제한하고, source 전체의 10년/1,000,000px·taint/active/미완료 callback 검사를 유지한다. 회복 관측은 예산 초기화나 같은 실패 명령의 자동 재시도가 아니다. 기존 3회 반복 확장·정확한 120px/bookmark 검사를 삭제하거나 완화하지 않는다.

별도 qa_docs는 DFS 순서가 아닌 중복 ID canonical 3개가 Map 정규화로 2개로 줄어 유효해지는 방어 P2를 실제 재현했다. full DFS 정규화는 원본 Task 수가 같을 때만 적용하며 중복 원본은 U2 reader에 그대로 전달하여 INVALID_TASKS로 차단한다. 정상 API의 전체 Task/계층 보존과 잘못된 입력 거부를 함께 Unit으로 검증한다.


## 지연 GET의 출처 검증

사전 검토에서 mutation 이전 GET G1(revision 4)을 지연한 상태로 서버 revision 5 commit/응답 500·후속 G2 조회 실패가 발생하면, 늦은 G1이 같은 confirmed revision 4라는 이유로 UNKNOWN을 해제할 수 있는 P1을 발견했다. Workspace는 mutation 시작 시 canonical read generation을 동기적으로 무효화하고 최신 generation의 성공 조회만 canonical 적용·잠금 해제를 허용한다. superseded 조회는 복구/잠금 상태를 변경하지 않는다. Editor/import의 공통 fetch 경로에도 적용하며 revision 단조성 검사를 유지한다.

SC-05의 별도 actual HTTP/SQLite 사례는 Resource의 `최신 일정 조회`로 실제 이전 snapshot을 확보·지연하고, Task commit/응답 500·최신 GET 실패 뒤 옛 GET을 전달해도 안내·추가 쓰기 차단·mutation 1회를 유지하는지 검증한다. 명시적 G3 최신 조회만 새 revision·같은 Core 인스턴스로 회복한다. background GET이 실패 주입을 먼저 소비할 수 있으므로 G3 허용 전 모든 후속 GET을 실패시켜 단순 요청 순번의 우연에 의존하지 않는다.


## SC-01~14 누적 추적 / 후속 인계

아래는 #667 marker-independent 제품 프로파일이다. 선택 사례 PASS는 각 SC 전체 조합이나 최종 #574 수용을 뜻하지 않는다. 아래에 명시한 선택 사례는 최종 실행 PASS이며 전체 행렬·각 SC 전체 인수와 구별한다.

| SC | 이번 실행 증거 | 범위 / 남은 경계 |
| --- | --- | --- |
| SC-01 | product-consistency Unit; Editor 동일 revision 두 번째 재조회 | semantic 재사용·새 attempt·Core 쓰기 0, Calendar는 SC-06과 함께 검증 |
| SC-02 | actual `project-grid-reorder-persistence` DnD 412/500 | full canonical 순서·revision 복구·후속 name-only 저장 |
| SC-03 | actual `project-task-persistence` 포인터 저장 | 422/412/500의 Grid/Bar 복구와 <0.5px; GET 실패는 명시 복구 후 검사 |
| SC-04 | actual native add 뒤 축 확장·subtree delete; linked Editor; stability; recovery Unit | 임시/누락/Link drift Unit 및 성공 add 제품 보호. 모든 add/link/delete/type 거부 조합의 actual HTTP 전수는 NOT TESTED |
| SC-05 | actual unknown 결과 4개·Editor unknown·역전 GET | commit 성공/미성공·단절·조회 실패·초안·잠금·명시 최신 조회·추가 mutation 0 |
| SC-06 | actual Calendar 저장·같은 DTO Unit/Editor 재조회 | 날짜/Link·유효 X/Y·instance 보존. 전체 Calendar/scale 조합은 별도 |
| SC-07 | conformance/observation/product-consistency Unit | 실제 reader·dirty/API/context invalidation; 모든 제품 API 교체 경쟁 조합은 NOT TESTED |
| SC-08 | milestone-timeline-core 및 canonical-projection 제품 회귀 | empty/M-only/WBS 검색 0행·full canonical·5폭 Day/Week; marker ON geometry와 구분 |
| SC-09 | actual edit/add 뒤 확장; viewport wheel; 연속 scale edge 확장 | 원래 lease·사용자 입력 우선·실제 coverage/geometry. #666 full-capacity clamp FAIL 불변 |
| SC-10 | viewport bookmark·search 회귀 | 정확 120px 복귀 및 실제 wheel 뒤 replay 0. 결과 0행/해제·WBS 범위 |
| SC-11 | actual Resource KPI 고정 geometry·pending wheel/resize | 같은 instance/tree/columns/selection; Target의 Task/Assignment 실제 편집·412/401 초안은 선택 검증, Export/Target 전수 왕복은 #553/#574 NOT TESTED |
| SC-12 | scale/stability/core/canonical projection 회귀 | Day/Week·columns/tree/fullscreen·5폭. #666 390px NOT_MEASURABLE 및 #573 ON 검증 별도 |
| SC-13 | actual native Milestone 행/bar·full canonical·marker DOM 0 | #667 프로파일 보존. #552 행0/OFF 교환·#573 ON focus/상세/관계는 별도 |
| SC-14 | marker OFF actual Core 1000 Task+2000 Milestone·3회 SPA 왕복 | 기존 5초 독립 readiness·old probe/public viewport cleanup·mutation 0. 장기 heap/전 listener 누수·전체 대량 조합은 NOT TESTED |

#552는 본 PR의 원격 exact Head/tree를 최신 main 수용 기준으로 사용하고 native Milestone 행 제거를 별도 구현한다. #553는 OFF의 JSON/Excel/SVG/PNG/Copy/Template 교환을 수용한다. #574는 최종 전체 통합·exact-source Required CI·QA/Owner gate를 소유한다. #573/#693은 선택 marker ON의 좁은 화면·geometry·활성화/rollback 후속이다. #675는 공유 진단 파일이 겹치므로 이 변경을 순차 수용하고 독립 readiness 원장을 보존한다.


## 로컬 실행 명령

각 명령은 isolated worktree root에서 실행한다. 전체 Vitest/전체 E2E/production Docker는 원격 Required CI의 별도 범위이며 아래 선택 실행으로 대체하지 않는다.

```bash
npx vitest run --config tests/config/vitest.config.ts \
  tests/features/gantt/core-conformance.test.ts \
  tests/features/gantt/canonical-recovery.test.ts \
  tests/features/gantt/projection-observation.test.ts \
  tests/features/gantt/axis-transaction.test.ts \
  tests/features/gantt/product-consistency.test.ts \
  tests/features/gantt/svar-viewport-port.test.ts \
  tests/features/gantt/viewport-coordinator.test.ts \
  tests/features/gantt/canonical-projection.test.ts \
  tests/features/gantt/state-consistency-contract.test.ts \
  tests/features/gantt/state-consistency-runtime-fixture.test.ts \
  tests/features/gantt/canonical-recovery-runtime.test.ts \
  tests/features/gantt/axis-transaction-runtime-fixture.test.ts

npx playwright test --config tests/config/playwright.config.ts \
  tests/e2e/gantt-state-product-integration.spec.ts \
  tests/e2e/gantt-state-recovery-editor.spec.ts \
  tests/e2e/project-grid-reorder-persistence.spec.ts \
  tests/e2e/project-resource-calendar-persistence.spec.ts \
  tests/e2e/project-task-persistence.spec.ts \
  tests/e2e/project-task-delete-context.spec.ts \
  tests/e2e/project-task-editor-persistence.spec.ts \
  tests/e2e/project-task-editor.spec.ts \
  tests/e2e/issue-621-resource-target.spec.ts \
  tests/e2e/viewport-coordinator.spec.ts \
  tests/e2e/milestone-timeline-core.spec.ts \
  tests/e2e/milestone-timeline-lane.spec.ts \
  tests/e2e/canonical-projection.spec.ts \
  tests/e2e/project-search-filter.spec.ts \
  tests/e2e/project-gantt-scale.spec.ts \
  tests/e2e/project-gantt-stability.spec.ts \
  tests/e2e/resource-kpi-integration-ui.spec.ts \
  --grep 'SC-|DnD (412|500)|실제 SQLite에 그룹|persists pointer|#571|#549|#570|Task 통합 검색|readonly에서도 Task|switches the Gantt|stable Gantt instance|#530 고정 geometry|#530 explicit frame|atomically deletes|linked requested dates|#621 Resource 동일|#621 Target exact Assignment|opens information without save access|preserves an expired-session draft' \
  --project=chromium --workers=1

npm run typecheck
npx eslint <변경된 src/tests TypeScript 파일>
node scripts/verify-release-version.mjs
node scripts/check-markdown-links.mjs
git diff --check
```

SC-14의 새 3,000행 marker OFF/3회 SPA 사례, 정확 120px bookmark 및 Day/Week 연속 확장은 개별 재검증 PASS다. 최종 동일 source의 67개 선택 회귀와 source hash는 별도 실행 원장에 확정한다.


## 리뷰 / 충돌 확인

연관 PR #561(Head `d9334c30c6c262d9089ac8ad99008587435092ed`)의 review thread는 0개, #675(Head `8d115a1572466717692468a707191b1677db20d8`)는 1개가 resolved이며 unresolved 0개다. GitHub connector로 현재 thread 목록과 PR을 직접 조회했다. #561 및 #675의 mergeable=false는 각 후속 소유자의 최신 main 정렬 대상이다. #667 main-first 제품 안정화와 별도 Milestone 표시 변경의 단일 소유권/순서를 유지하기 위해 이 PR에서 #561을 재작성하거나 병합하지 않는다. #675의 기존 P1(공유 제품 파일의 U5 순서/소유권)은 현재 U5 단일 작성권과 #686 독립 readiness 보존으로 인계하고 미병합 patch를 복사하지 않는다. 본 #667 PR 생성 후 자체 thread/mergeability도 한 번 확인한다. 이 읽기 전용 확인은 Actions 모니터링이 아니다.

main 통합의 CHANGELOG 충돌은 #667 Unreleased/버전 후보와 #622 lifecycle 복구 항목을 모두 남겨 해결했다. 원본 작업 branch나 기존 PR history를 force-push하지 않는다.

요청 상관 ID는 인증 토큰이 아니며 Workspace 수명 내 단조 증가 sequence를 사용한다. 내부망 HTTP에서 미지원할 수 있는 crypto.randomUUID에 의존하지 않고 현재 Core source/API·mutation generation과 함께 귀속한다. 서버 API·인증 정책은 변경하지 않는다.

날짜축 회귀 추가 분석: Day/Week 전환의 옛 Core unit과 새 React 폭을 섞은 확장, 기존 RANGE가 새 FILTER_RETURN과 병렬로 옛 0px를 보존하는 경합을 발견했다. 표시 단위가 일치할 때만 축을 준비하고, prepare는 기존 writer 완전 종료를 원래 lease·120프레임 총 예산 안에서 기다린다. RANGE의 capacity-only 병렬 예외를 제거하고 exact epoch/revision의 위치 권한을 유지한다. 실제 Chart의 앞 이동은 own tag·target과 구분하고 SVAR scroll 이벤트의 요청 좌표와 실제 native DOM 좌표가 일치하는 ingress만 옛 축 lease를 취소한다. 새 edge 요청에는 그 ingress stamp를 전달하며 await 뒤 재발급하지 않는다. programmatic native 이동도 포함할 수 있으므로 이를 실제 인간 wheel 실행으로 과대 표시하지 않으며 실제 wheel 검사는 별도 기존 회귀로 유지한다.

Manager의 범위 내 설계 결정: 위 native 앞 이동 정책을 오래된 passive 축 복원의 취소에 한정해 수용한다. 같은 live API/context의 지연 untagged 물리 이동과 인간 입력은 구별 불가능하며 최종 Owner 위험 수용 대상이다. 이는 QA_FINAL·Manager 병합 ACCEPT나 서버 mutation 권한이 아니다.


진행 중 축의 실제 wheel 경계도 별도 SC-09 제품 사례로 추가했다. 실제 capacity 증가와 RANGE APPLYING 이후에만 RAF 관측을 hold하고 실제 wheel 뒤 모두 release한다. old RANGE SUPERSEDED·후속 resize 0·옛 위치 replay 0·Core/native 일치와 mutation 0을 직접 확인한다. APPLYING trace의 writes는 resize pair 이전 값일 수 있어 이를 현재 write count로 취급하지 않는다. 모든 scroll API 호출 0 전수와 제품의 위치 재생 없음은 구별하며, 취소 후 old command 쓰기 0 자체는 별도 Coordinator/port Unit으로 확인한다. 최초 harness는 이전 axis 결과가 SUPERSEDED인 정상 전환에도 SETTLED 이력을 요구해 실패했으며, canonical sync 종료·실제 준비 프레임과 capacity를 확인하는 전제로 교정했다.

지원 범위는 설치 Core 2.7.3/store 2.7.2 및 현재 동기 resize/scroll handler 프로파일이다. port의 1500ms Promise race와 U4 callback 종료는 임의의 미래 async-before-Store writer가 끝났다는 일반 보장이 아니다. library 또는 해당 handler를 비동기로 변경할 때 source taint·늦은 쓰기·natural recovery를 재검증해야 한다.


첫 65개 확장 회귀는 64 PASS / 1 FAIL(8.1분)이었다. source fingerprint `28bcccb391dabe417c911ce98243f8999d7b97cacb12729aba7de78a7b6ef4d2`에 귀속하며 `output/playwright/issue-667/first-65-regression`에 원본 보고서/trace/source를 보존했다. Resource 고정 geometry의 정확 120px 복귀에서 prepare 내부 축은 실제 SETTLED·capacity를 확보했으나 scrollWidth/axis 변화가 client-size ResizeObserver의 서명을 바꾸지 않아 새 semantic receipt가 발행되지 않았다. WAIT_PROJECTION timeout 뒤 0px가 남은 제품 결함이며 성공으로 처리하거나 timeout을 확대하지 않는다. 실제 extent 정착 뒤 읽기 전용 재관측을 명시하고 물리 extent 변화에만 receipt floor를 요구하도록 보완한다.

동 실행의 실제 HTTP/SQLite Editor 화면 검토에서 UNKNOWN을 editable=false로 막는 동작은 옳지만 사유가 '편집 권한이 없습니다'로 표시되는 혼동도 발견했다. optional 제한 사유를 전달해 UNKNOWN과 실제 401/readonly를 구분하며 저장/하위 mutation gate는 유지한다. 실제 UNKNOWN의 사유/초안·재조회·추가 저장 0과 일반 readonly/expired-session 회귀를 최종 source에서 검증한다.


## 최초 게시 source의 로컬 검증 / 원격 인계

- 동결 source fingerprint: `84800f574b4b919ca0ef09bacb2cddd44f4eb4b07fb69272f602f0ec86718679`. main `ee6365bf57ab637b4c0aca61fdedaf5148253052` 대비 변경 source/test/package 32개 SHA256와 실제 결과를 [실행 증거 JSON](../../evidence/issue-667/local-validation.json)에 고정했다. 테스트 전후 bytes 일치를 확인한다.
- Unit: 위 직접 명령의 12파일 / 311 PASS / 0 FAIL. describe를 포함하는 runner suite 수와 파일 수를 혼동하지 않는다. 과거 U1/U2/U4 캡처 provenance 검증은 신규 제품 재수집의 PASS가 아니다.
- Chromium 선택 회귀: 67 PASS / 0 FAIL / 0 skipped / 0 flaky, 9.3분. actual HTTP/SQLite 21개와 mock API·actual SVAR 46개다. 390/768/1024/1440/1920·Day/Week의 기존 Core/Task 사례는 통과했으나 #666의 별도 390px NOT_MEASURABLE·clamp FAIL/marker ON을 전용하지 않는다.
- 수정 직후 타깃: Resource exact120·Editor UNKNOWN·expired-session·readonly 4/4 PASS(45.1초); 이후 같은 source의 67개에 모두 재포함했다. 정확120·Bar<0.5px·5초 readiness·원래 timeout/skip 정책은 유지했다.
- SC-14 관측: actual Core counts 1000/2000/3000, SPA3회/문서 재요청0/서버 mutation0. 관측된 API `svar-api-1`→`2`→`3`→`4`와 이전 probe/public viewport cleanup을 증거에 남겼다. 장기 heap/전 listener 누수 PASS가 아니다.
- typecheck/변경 TypeScript lint/Markdown 링크227파일/version/diff whitespace: PASS. ESLint 기존 hook warning 3개는 유지하며 오류와 구분한다.
- 화면은 합성 fixture의 실제 실행 after 증거다: [Workspace UNKNOWN](../../images/issue-667/unknown-workspace-1440.png), [Editor UNKNOWN](../../images/issue-667/unknown-editor-1440.png). 실제 DB·비밀값·세션·원시 runtime log를 commit하지 않는다. before/after 비교 실증으로 주장하지 않는다.
- 생성된 next-env/tsconfig 및 추적된 #258 screenshot 원본을 복원하고 해당 새 캡처와 원본 실패 trace/HTML은 Git 밖 `output/playwright/issue-667/`에 보존한다. 원래 checkout은 수정하지 않는다.

위 결과는 Local Fast Feedback이다. quality/e2e/docker·Trusted QA·QA_FINAL·Owner/Manager ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED다. main CI/GHCR digest·SBOM/provenance·임시 이미지 정리, 정식 GHCR/tag/Release/promotion은 수행하지 않았으며 release_authorized=false를 유지한다. 작업 branch와 Issue는 OPEN 상태의 원격 검토를 위해 보존한다.

Git CLI 인증 실패 때문에 인증된 GitHub Git Data connector로 최종 local tree와 byte 동일한 tree를 게시한다. service가 author/date를 생성하므로 unpublished local commit SHA와 원격 commit SHA가 다를 수 있다. 원격 commit은 최신 main을 parent로 가지며 기존 main/다른 PR history를 강제 덮어쓰지 않는다. 정확한 PR/원격 Head/base/tree·게시 검증과 현재 thread/mergeability는 Issue STATUS에 기록한다. CI 결과를 조회하거나 기다리지 않는다.

## 최초 게시 source의 사전 검토 / 문서 판정

pre_qa_reviewer: /root/integration_tests (qa_docs, 별도 read-only 실행)
pre_qa: PASS (코드·문서·선택 로컬 증거의 독립 read-only 사전 검토)
DOCUMENTATION_SYNC: PASS (로컬 영향 분석·코드/문서/실행 증거 정합 검토)

사전 검토는 구현 작성자와 분리된 코드/문서/실제 로컬 증거 검토이며 GitHub QA_FINAL·Owner의 최종 인수·병합 승인을 대신하지 않는다. 전체 AC 미검증과 관련 #561/#675의 남은 충돌 정렬을 숨기지 않는다.

최종 사전 검토는 원본 HTML ZIP의 67개 사례/판정과 증거 JSON mismatch 0, source 32개 SHA256 mismatch 0, Resource exact120/후속 repair 2회 및 SC-14/진행 중 wheel attachment를 직접 확인했다. 미해결 코드 지적 0이며 AC2 전수/AC7·환경/장기 검증과 관련 PR 충돌 인계는 미완료로 유지한다. Manager는 문서 정합성만 로컬 PASS로 판정하며 Manager 병합 ACCEPT는 NOT TESTED다.


## 2026-10-16 — PR #695 / CI #2811.1 보완

### 원본 원격 실패

- Head `04b6d3d90d06b742223038c31c84823d525feb21`, base `ee6365bf57ab637b4c0aca61fdedaf5148253052`, 실제 checkout test merge `0d6c8c909ce5836210f2149c1f53abcb5b5da45a`.
- [CI #2811.1 / run38742141930](https://github.com/planner77/masterGantt/actions/runs/38742141930), attempt1: quality aggregate job116447980101 SUCCESS, docker aggregate job116448436755 SUCCESS, e2e aggregate job116449937942 FAILURE. 자동 QA failure는 이 실패 이후이며 독립 업무 QA/Owner ACCEPT가 아니다.
- 최초 실패: [Chromium E2E shard3 job116447303496](https://github.com/planner77/masterGantt/actions/runs/38742141930/job/116447303496), step7, `milestone-dashboard-state.spec.ts:145`, 5000ms 동안 `data-gantt-peer-restore=null`. 좌표120/96은 도달했으나 완료 영수증이 없었다. 해당 shard21PASS/1FAIL/1SKIP/104NOTRUN, 다른5shard CANCELLED. 후단·미실행을 PASS로 재분류하지 않는다.
- 같은 source의 로컬 단독 재현도 7.0초 FAIL이었다. 원본 trace/HTML은 `output/playwright/issue-667/ci2811-reproduction`에 보존한다.

### 원인과 보완

복귀 전 visible session의 bridge receipt2를 소비한 PEER_RETURN이 APPLY/SETTLING 도중 새 visible 관측 receipt3를 받아 STALE_PROJECTION으로 취소됐다. Core/native120/96은 보존됐지만 strict 완료 판정은 실패했다. visibility 변경의 layout phase에서 이전 bridge를 무효화하여 원래 lease의 복귀 명령이 fresh visible U3 관측을 기다리게 했다. accepted projection 고정·3프레임·exact좌표·원래 timeout·취소/우선순위는 유지하며 자동 재시도나 새 lease를 도입하지 않는다.

미해결 P2 `PRRT_kwDOUUB7Bc6syoNu`는 cross-tab GET만 canonical read generation 밖에서 적용되므로 최신N+1 확정 뒤 늦은 실패복구N이 UNKNOWN을 다시 설정하는 문제였다. cross-tab도 같은 generation 시작/응답 검사를 공유하고 현재 세대의 성공한 canonical만 잠금을 해제한다. 실제 두 탭의 프로젝트 저장→storage event→최신 GET과 이전 recovery stale/500의 두 순서를 검증한다.

독립 검토가 추가 발견한 음성 경계도 보완했다. 최신 cross-tab GET이 pending/500이면 이전 recovery의 supersession만으로 잠금을 생략해서는 안 된다. 실패 mutation handler 진입에서 UNKNOWN ref/state 잠금을 동기적으로 세우고, 현재 성공한 조회만 해제한다. 정상 sameDTO 수동 조회에는 불필요한 UNKNOWN을 만들지 않는다. 안내의 recovered 판단도 현재 잠금 상태를 읽는다. partial fix의 실제 negative 사례는 8.9초 FAIL(잠금 안내 없음)로 재현했으며 `ci2811-cross-tab-negative`에 원본을 보존했다.

### 변경과 검증 범위

제품 변경은 ProjectGantt visibility/bridge와 Workspace canonical read/실패 handler에 한정한다. 새 E2E는 실제 두 탭 HTTP/SQLite에서 최신 성공 뒤 재잠금0, 최신 pending/실패 중 잠금·추가PATCH0, 명시 조회 뒤 같은 instance·최신revision 후속 저장을 검증한다. Coordinator Unit은 null receipt 상태에서 새 visible receipt 이전 APPLY0을 보호한다. 원본 테스트의 단언/timeout/skip·workflow·6shard·Required checks는 변경하지 않는다. application0.114.1 후보·release승인false를 유지한다.

최초67PASS/311Unit의 JSON·source fingerprint는 **이전 source의 역사적 결과**로 보존한다. 현재 수정 source의 선택 회귀·source SHA256·사전 검토는 별도 correction 증거로 기록하며 원본 remote FAIL을 덮어쓰지 않는다. 새 Head 전체회귀는 새 PR CI에서 별도 판정한다.


### 보완 source의 로컬 검증 / 원격 재실행 인계

- 증거: [CI #2811 보완 실행 JSON](../../evidence/issue-667/ci2811-correction.json). parent Head `04b6d3d90d06b742223038c31c84823d525feb21`와 변경 source/test 4개 SHA256를 함께 고정한다. fingerprint `2fa496841617ecdd0fe2bc7985feb04728c2f65ef1fe4c8ce2871f5fe74d89f6`이며 최초32파일 fingerprint를 대체하지 않는다.
- Unit: `npx vitest run --config tests/config/vitest.config.ts`에 viewport-coordinator/svar-viewport-port/projection-observation/product-consistency/canonical-snapshot-recovery/project-revision-sync 6파일을 지정했다. 183 PASS / 0 FAIL. 독립 Reviewer의 별도150 PASS를 합산하지 않는다.
- Chromium: `milestone-dashboard-state`, `gantt-state-product-integration`, `gantt-state-recovery-editor`, `resource-kpi-integration-ui`, `viewport-coordinator`, `project-gantt-scale` 6파일에서 `--grep '#463|SC-|#530 고정 geometry|#530 explicit frame|#571|switches the Gantt' --project=chromium --workers=1`로 선택 실행했다. 32 PASS / 0 FAIL / 0 skipped / 0 flaky, 268616.54ms. actual HTTP/SQLite16개와 mock API·actual SVAR16개이며 원본 실패 및 새 두 탭3사례를 포함한다. 전체67/전체Vitest/로컬Docker 재실행으로 보고하지 않는다.
- typecheck PASS, 변경 TypeScript ESLint 오류0/기존 hook warning3, Markdown 링크227파일/version0.114.1/diff whitespace PASS. 생성된 next-env/tsconfig와 추적된 #463 원본을 복원했다. 원본 실패·partial fix 실패·최종 HTML/Unit 원장은 `output/playwright/issue-667/`에 Git 밖으로 보존한다.
- pre_qa_reviewer: `/root/integration_tests` (qa_docs, 별도 read-only 실행). pre_qa: PASS. DOCUMENTATION_SYNC: PASS(코드·문서·원본 HTML/Unit·4파일 fingerprint의 독립 의미 검토; mismatch0·미해결 코드 지적0). QA_FINAL/Owner ACCEPT 및 원격 리뷰 해소 판정은 포함하지 않는다.
- 게시: 기존 PR #695 branch에 parent `04b6d3d90d06b742223038c31c84823d525feb21`의 후속 commit을 게시한다. Git Data connector의 tree bytes 일치 및 expected_sha/force=false를 확인하며 기존 PR/실패 run 이력을 보존한다. 신규 PR 생성이나 실패한 구 Head 재실행 대신 수정 Head의 Full PR CI 시작을 확인한다.
- 새 Head quality/e2e/docker·Trusted QA·QA_FINAL·Owner/Manager ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED다. 새 run 완료 모니터링·병합·Main/GHCR·정식 release/tag·Issue 종료는 수행하지 않는다. 정확한 게시 Head/tree/run URL·리뷰 해소 결과는 Issue STATUS와 PR 댓글에 기록한다.


## 2026-10-16 — PR #695 / CI #2812.1 재보완

### 원본 실패 / 재개 범위

Head `2f8f0573852a69fd85d733d0e57e61e282997372`, base `ee6365bf57ab637b4c0aca61fdedaf5148253052`, 실제 checkout test merge `7a30c212bca2ec67400eb9dc872e90bc39f47531`. [CI #2812.1 / run38793354820](https://github.com/planner77/masterGantt/actions/runs/38793354820)은 quality job116624908386·docker job116625403534 SUCCESS, e2e aggregate job116628000013 FAILURE다.

- 최초 [shard6 job116624327757](https://github.com/planner77/masterGantt/actions/runs/38793354820/job/116624327757), step7: `project-task-delete-context.spec.ts:155`, 반복 거부 stale 변형의 다음 Delete가 disabled인 채90000ms timeout. 52PASS/1FAIL/37NOTRUN.
- [shard5 job116624327558](https://github.com/planner77/masterGantt/actions/runs/38793354820/job/116624327558), step7: `milestone-management-persistence.spec.ts:236`, 빈 프로젝트→Milestone-only 생성 후 편집 session의 첫 상세가 disabled인 채120000ms timeout. 27PASS/1FAIL/75NOTRUN. job 결론은 CANCELLED지만 기록된 실제 test FAIL을 보존한다. 후반 readonly context의 실패와 혼동하지 않는다.
- 다른4shard도 CANCELLED이며 미실행/취소를 PASS로 사용하지 않는다. QA Automated는 후단 실패이며 Owner ACCEPT가 아니다.

사용자 요청은 두 실패 원인 분석·최소 보완·문서 동기화·독립 사전 검토·기존 PR 새 Full CI 시작이다. 원격 완료 모니터링·병합·Main/GHCR·release/tag·Issue 종료는 제외한다. Manager는 원본 browser 재현·테스트/문서, frontend는 production 단일 작성자, qa_docs는 독립 read-only 검토를 담당한다. 원본/이전 보완 증거는 그대로 보존하며 이번 source 결과를 별도로 기록한다.


### 로컬 원본 재현 / 테스트 계약 보완

원본 Head2f8f에서 두 사례를 같은 명령으로 실행하여 2FAIL을 재현했다. Milestone 상세는 원래120초, 반복 삭제 stale은 원래90초에 각각 같은 disabled 버튼에서 실패했다. 원본 trace/HTML을 `output/playwright/issue-667/ci2812-reproduction`에 보존한다.

삭제 stale/unavailable은 canonical GET이 과거 revision/실패여서 UNKNOWN 잠금 유지가 정상이다. 기존 fixture가 route 해제·APIRequestContext GET만으로 앱이 복구됐다고 가정한 것이 원인이다. 수정은 UNKNOWN 안내·메뉴 Delete disabled·추가 DELETE0을 검증하고 UI 명시 최신 조회 성공 뒤 기존 두 번째 삭제를 계속한다. 인스턴스·접힘·scale·좌표·확정 삭제·revision·원래 timeout 단언을 보존하며 production 쓰기 차단을 완화하지 않는다.

Milestone-only는 U2 SETTLED changed:true 이후 별도 큐에서 `Cannot read properties of undefined (reading 'width')`가 발생해 Workspace 복구 잠금이 남는 실제 제품 결함이다. 강화한 enabled 단언으로 별도8.1초/8.3초 FAIL을 재현하고 임시 DEV 진단으로 queue 예외·설치 SVAR stack을 확인했다. 진단 원본은 `ci2812-diagnostic`/`ci2812-diagnostic-stack`에 보존하며 제품 수정 후 최종 source의 실행 결과를 별도로 기록한다. 성공 영수증과 후속 예외를 구분하고 readonly/보고서 query 문제가 아닌 첫 편집 session의 실패로 기록한다.


### 날짜축 결정 / 실제 경계

임시 raw axis 진단은 `_start=2026-10-15T15:00:00.000Z`, `_end=2026-10-12T15:00:00.000Z`, width=-108, scale cells=[1,0]을 직접 확인했다. 설치 Core는 고정 start를 유지하면서 past Milestone의 end+1unit을 계산해 역전했다. filter-tasks는 재계산 trigger이며 단순 생략으로 해결하지 않는다. 진단8.2초 FAIL과 실제bounds는 `ci2812-diagnostic-axis`에 보존한다.

Manager는 mount고정 start prop을 생략하는 방식을 선택했다. Core가 Task 날짜에서 left bound를 계산하고 기존 U4 resize가 그 현재 bound를 보존한다. stable initial tasks/links/columns·autoScale=false·retained initial right extent·단일 writer/lease·UNKNOWN/auth는 유지한다. 오늘 기준 초기 left 여백은 더 이상 강제하지 않는다. React start/end 동적 prop에 의한 wrapper init·private Store 쓰기·remount는 사용하지 않는다.

고정 start+autoScale=true는 설치 resize가 supplied start를 다시 적용해 past date coverage를 잃으므로 채택하지 않는다. 독립 Reviewer가 실제 설치 Store의 init/add-task/filter-tasks/resize-chart로 A의 유효 범위 보존과 해당 위험을 별도 확인했다. Node Store 실행은 실제 DOM/viewport PASS가 아니며 최종 browser 결과와 구분한다. 최신 공개 [start](https://docs.svar.dev/react/gantt/api/properties/start/)/[end](https://docs.svar.dev/react/gantt/api/properties/end/)/[scales guide](https://docs.svar.dev/react/gantt/guides/timeline/scales/)/[resize-chart](https://docs.svar.dev/react/gantt/api/actions/resize-chart/)와 설치2.7.3 wrapper/2.7.2 Store를 조사했다. 공개 날짜축 setter가 있다고 추정하지 않고 설치 호환 경로 이상으로 일반화하지 않는다.

원본 Milestone 테스트에 과거/60일 이후 평일의 첫 Milestone 두 변형과 Day/Week의 native행/bar·각3회 실제 우측 확장·coverage·같은 API·Dashboard 재복귀를 추가했다. 기존 readonly401·조회 mutation0·canonical 불변 검증은 유지한다. 새 테스트의 첫 실행에서 날짜 Date 객체를 참조로 비교해 두 변형이 실패한 테스트 오류도 `ci2812-axis-test-comparison`에 보존하고 ISO 값 비교로 교정했다. 이는 production 원본 결함·새 제품 회귀 결과와 구분한다. 임시 예외/stack/rawbounds 계측은 최종 production source에서 제거했다.


### 보완 source의 선택 검증 / 게시 인계

- 증거: [CI #2812 보완 JSON](../../evidence/issue-667/ci2812-correction.json). parent Head `2f8f0573852a69fd85d733d0e57e61e282997372`와 변경 source/test3파일 SHA256를 함께 고정한다. fingerprint `ee97b7b8f98b35b093b720b08457d8e8bd3317f68f509ff39e74c27b9392631f`이며 최초/이전 보완 fingerprint를 대체하지 않는다.
- Unit: `npx vitest run --config tests/config/vitest.config.ts`로 viewport-coordinator/svar-viewport-port/projection-observation/product-consistency/canonical-snapshot-recovery/project-revision-sync/canonical-recovery/core-conformance/canonical-snapshot-sync 9파일, 268PASS/0FAIL. 독립 Reviewer61PASS·frontend160PASS와 합산하지 않는다.
- Chromium 명령: `npx playwright test --config tests/config/playwright.config.ts`에 milestone-dashboard-state/gantt-state-product-integration/gantt-state-recovery-editor/resource-kpi-integration-ui/viewport-coordinator/project-gantt-scale/project-task-delete-context/milestone-management-persistence/canonical-projection 9파일을 지정했다. `--grep '#463|SC-|#530 고정 geometry|#530 explicit frame|#571|switches the Gantt|#570|keeps confirmed deletions|confirms and atomically|#550' --project=chromium --workers=1`이다. 최종 누적 결과: 63PASS/0FAIL/0skipped/0flaky, 491027.451ms(8.2분). actual HTTP/SQLite26개, mock API·actual SVAR37개이며 canonical projection21개(5폭/Day·Week)·이전32개·삭제7개·Milestone3개를 포함한다.
- 독립 Reviewer: `/root/integration_tests` qa_docs, read-only source/test/docs·실제 HTML/Unit·fingerprint 검토. pre_qa: PASS. DOCUMENTATION_SYNC: PASS(별도 코드·문서·선택 로컬 증거 의미 검토; HTML63사례/3파일 source SHA·fingerprint mismatch0, 미해결 코드·문서 지적0). QA_FINAL/Owner ACCEPT·전체 인수 판정과 구분한다.
- 기존 PR #695에 parent2f8f의 후속 commit을 동일 tree bytes로 게시하며 expected_sha/force=false를 유지한다. 기존 실패 run을 재실행하거나 새 PR을 만들지 않고 수정 Head Full CI 생성까지만 확인한다. 정확한 게시 Head/base/tree/run·리뷰/mergeability는 Issue STATUS/PR 댓글로 인계한다.
- 새 Head quality/e2e/docker·Trusted QA·QA_FINAL·Owner/Manager ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED다. version0.114.1 후보·release_authorized=false, branch/Issue OPEN을 유지한다. 병합·Main/GHCR/digest/release/tag/cleanup·Windows Excel/DRM·production TLS·최종 수동 UX는 미수행/NOT TESTED다.

이번 선택 회귀는 날짜축 프로파일 변경과 직접 관련된 9파일 범위다. 최초67개/이전32개 전체 결과를 새 source에 재사용하지 않는다. 새 source의 전체 E2E/전체 Vitest/로컬 Docker·장기/환경별 검증은 별도 미실행이며 새 원격 Full CI가 공식 전체 회귀를 수행한다. 기존 #666 합성 fixed-start evidence·390px/clamp 실패와 전체 AC2/장기 heap 미검증도 유지한다.

복원 후 typecheck/Markdown227파일/version0.114.1/diff whitespace PASS와 변경 TypeScript lint오류0·기존hook warning3을 확인했다. raw 최종 HTML은 `output/playwright/issue-667/ci2812-correction-report/playwright-report`에 보존한다. 생성된 next-env/tsconfig·추적 #463 원본을 HEAD로 복원하고 새 #463 산출물은 `ci2812-generated-463`에 보존했다. 최초/이전 보완 JSON bytes는 변경하지 않았다.


## 2026-10-16 — PR #695 / CI #2813.1 DEV 관측 보완

### 원본 실패 / 재현

Head `a141ba3e4daf5ec6bbf8a99a3350edcb6c0c35be`, base `ee6365bf57ab637b4c0aca61fdedaf5148253052`, 실제 checkout test merge `4ef33373f7f5e2ff67098d2c5d8ea1cb51941a0d`. [CI #2813.1 / run38798814906](https://github.com/planner77/masterGantt/actions/runs/38798814906)은 quality job116643628280·docker job116644110558 SUCCESS, e2e aggregate job116645534840 FAILURE다.

최초 [shard2 job116643060487](https://github.com/planner77/masterGantt/actions/runs/38798814906/job/116643060487), step7: `grid-task-start-reveal.spec.ts:30` 관측→line85의 첫 readonly/day/normal matrix에서 `TypeError: Cannot read properties of null (reading 'getFullYear')`. 16PASS/1FAIL/65NOTRUN이며 다른5shard CANCELLED다. pointer reveal 이전 관측에서 실패했으므로 해당 원본만으로 실제 reveal 결함을 주장하지 않는다. 후단 Automated QA failure·취소/미실행을 PASS로 바꾸지 않는다.

원본 Head의 동일 사례는 로컬1.6초 FAIL로 재현했고 trace/HTML은 `output/playwright/issue-667/ci2813-reproduction`에 보존했다. 이전63/268 및 과거 보완 증거 JSON은 각 이전 source의 역사적 결과로 보존한다.

### 원인 / 변경 범위

#2812의 Core 계산 left-bound 프로파일에서는 설정 `state.start`가 null일 수 있지만 실제 렌더링된 날짜축은 유효하다. DEV `__masterganttGridReveal.start`만 설정 prop을 읽었으며 소비자는 #514 observe1곳이다. 현재 `state._scales.start`를 우선하고 `_start`를 차선으로 읽도록 교정했다. Week의 정렬된 origin을 우선하는 점이 실제 port의 TASK_REVEAL 기준과 같다. 존재하지 않는 날짜를 fallback으로 생성하거나 테스트 수식을 우회하지 않는다.

변경은 DEV read-only getter의1줄과 설명 comment1줄이다. 실제 reveal/축 확장·U2/U3/U4·source guard/lease·권한/UNKNOWN·cleanup·stable props와 #2812 날짜축 결정은 불변이다. 기존 #514 테스트·pixel/startVisible/root+nested/selection/keyboard/5폭/Day·Week/peer/wheel/filter 단언·timeout·skip/retry·CI6shard는 변경하지 않는다. 설정값을 그대로 모방하는 Unit은 추가하지 않고 기존 browser 행렬로 관측과 실제 탐색을 함께 검증한다.

관련 문서는 GANTT_SYNC_TRACE·TEST_PLAN·active PLAN/Work Packet·CHANGELOG·새 correction JSON을 갱신한다. 이번 DEV 관측 교정은 PROJECT_UX/ARCHITECTURE/ADR/API/DB/보안/CI/일정 알고리즘의 실제 제품 계약을 변경하지 않는다. 위 DOCUMENTATION_SYNC UPDATED 목록은 최초 main 대비 누적 PR 변경이며 이번 보완에서 모두 재작성했다는 뜻이 아니다.

### 선택 검증 / 게시 인계

- 증거: [CI #2813 보완 JSON](../../evidence/issue-667/ci2813-correction.json). parent Heada141과 변경 source1파일 hash/fingerprint `a5aa4a8237b72894cd2d1884f273eb1ac6fc58a8df03d9b0b6834d4dba72c063`를 함께 고정한다.
- Unit: `npx vitest run --config tests/config/vitest.config.ts tests/features/gantt/viewport-coordinator.test.ts tests/features/gantt/svar-viewport-port.test.ts`, 2파일115PASS/0FAIL. 원래 source 관련 Unit의 선택 실행이며 알고리즘 변경은 없다.
- Chromium: `npx playwright test --config tests/config/playwright.config.ts`에 grid-task-start-reveal/viewport-coordinator/project-gantt-scale/milestone-management-persistence/milestone-dashboard-state 5파일을 지정했다. `--grep '#514|#571|SC-09 실제 축 확장 관측|switches the Gantt|실제 빈 프로젝트|#463 public viewport' --project=chromium --workers=1`. 최종 결과 28PASS/0FAIL/0skipped/0flaky,124319.918ms(2.1분). #514 전체16개·viewport8개·scale1개·Milestone-only2개·원본peer1개이며 actual HTTP/SQLite2개와 mock API·actual SVAR26개를 구분한다.
- 독립 Reviewer `/root/integration_tests` qa_docs: pre_qa PASS, DOCUMENTATION_SYNC PASS(DEV 관측 코드·문서·선택 로컬 증거 의미 검토; 원본 HTML28사례와1파일 SHA/fingerprint mismatch0·미해결 지적0). 실제 원본/최종 보고서와 코드·문서를 별도 read-only 검토하며 QA_FINAL/Owner ACCEPT와 구분한다.
- 현재 미해결 스레드0·mergeable=true를 확인했고 기존 P2 resolve를 유지한다. 게시 뒤 최신 스레드/충돌을 다시 확인한다. 동일 PR branch에 parenta141의 후속 commit을 expected_sha/force=false·동일 tree 검증으로 게시하고 수정 Head Full CI 생성까지만 확인한다. 정확한 Head/base/tree/test-merge/run은 Issue STATUS/PR 댓글에 기록한다.
- 새 Head required3·Trusted QA·QA_FINAL·Owner/Manager ACCEPT는 NOT TESTED, MERGE_READY BLOCKED. version0.114.1 후보/release_authorized=false·branch/Issue OPEN·환경별 미검증을 유지하며 CI 완료 모니터링·병합·Main/GHCR/digest/release/tag/cleanup은 수행하지 않는다.

최종 raw HTML은 `output/playwright/issue-667/ci2813-correction-report/playwright-report`에 보존하고 생성된 next-env/tsconfig를 HEAD로 복원했다. 새로운 제품 화면 변경이 없어 screenshot 추가는 N/A이며 기존 DOM/geometry/viewport attachment를 사용한다. 이번 DEV getter 보완의 선택 검증을 전체 회귀·이전 source63/268 결과와 합산하지 않는다. 실제 source SHA·보고서 대조 및 복원 후 typecheck/Markdown227/version0.114.1/diff PASS, 변경 TypeScript lint오류0·기존hook warning3을 확인했다.
