# Issue #667 — 최신 main Gantt 정합성 제품 통합

Refs #667

## 실행 계약

phase: PR_VALIDATION
risk_level: HIGH
risk_reason: 실제 Core 복구·비동기 저장 결과·viewport 의도 및 날짜축 연결의 교차 회귀
qa_method: OWNER_MANAGED
qa_required: true
manager_decision: NOT TESTED
MERGE_READY: BLOCKED
release_required: true
release_authorized: false
issue_comment_writer: manager
issue_comment_allowed_types: PLAN, STATUS, EXCEPTION, RESUME, FINAL
documentation_owner: Manager

2026-10-16 CI #2833 후속의 현재 요청 범위는 최신 main 정렬·미해결 리뷰/충돌 확인·원인 분석과 보완·새 Full PR CI **시작 확인까지**다. 아래 이전 요청의 완료 모니터링은 과거 실행 범위이며 이번 실행에는 적용하지 않는다. Owner ACCEPT·병합·Main/GHCR·정식 release/tag·Issue 종료는 별도다.

최초 사용자 요청은 구현·관련 문서 동기화·미해결 리뷰와 충돌 해결이며 CI 결과 모니터링은 제외했다. 2026-10-16 후속 요청으로 실패한 PR CI의 원인 분석·보완 및 새 Full PR CI 시작까지 재개했다. 이전 2026-10-16 요청에서는 새 PR CI 완료 모니터링을 포함해 당시의 CI 시작까지만 범위를 대체했다(과거 실행 이력). 병합은 포함하지 않는다. 원격 branch/PR 게시 뒤 Required Quality/E2E/Docker, Trusted QA, Owner ACCEPT는 별도 판정한다. 병합·Main/GHCR·정식 release/tag·브랜치 정리·Issue 종료를 수행하지 않는다.

## 기준선 / 의존성 / 버전

- repository: planner77/masterGantt; [Issue #667](https://github.com/planner77/masterGantt/issues/667).
- 착수 main/document commit: `29c86ca918baa1811bc12a3eb60f86ffc5406b40`.
- 2026-10-16 최신 통합 main: `fd219130491c53d054754eac41a58e4a6a3da0c6`(#697/PR #698). 로컬 merge `8a88b1fbd62a91d6884b9a949ebce89a4ad59e4e`에서 원격 PR Head `6bec3a1098e603b9db9968d2206af95df12ac126`과 양쪽 이력을 보존했다. 새 통합은 AGENTS/TEST_PLAN/ISSUE_LIFECYCLE/#697 문서 변경이며 제품 소스 변경·충돌은 없다. 게시 전 최신 main을 다시 확인한다.
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
- infra `/root/publish_transport`: 인증된 GitHub Git Data의 blob/tree/commit/branch 게시와 byte 동일성 검증. Issue 댓글·PR 작성은 Manager다. 이전 실행에서는 새 CI 완료까지 모니터링했으며 #2825 후속의 현재 범위는 시작 확인까지다.
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
- AC6: 아래 SC-01~14·원본 실패/재검증·source fingerprint·선택 Unit/actual Core/actual HTTP·SQLite/원격 구분과 #552/#573/#574/#675 인계를 기록했다. 이전 게시 source의 DOCUMENTATION_SYNC 로컬 영향/정합 검토 PASS를 이력으로 보존한다. 이전 Resource/fixture 보완의 DOCUMENTATION_SYNC 의미 검토·PRE_QA PASS(26게시파일·15source·선택 로컬 증거 범위)는 이력으로 보존한다. CI #2817 관측 순서·#2818 U3 frame 분리·#2819 UI후 canonical 확인 전송·#2820 음성 oracle 교정의 최종 검토·원본/재검증은 아래 각 원장을 따른다.
- AC7: Head04b6/#2811.1, Head2f8f/#2812.1, Heada141/#2813.1, Headc6f18/#2814.1, Head06d34/#2817.1, Headf94f/#2818.1, Heada376/#2819.1, Head852056/#2820.1은 각각 quality/docker PASS, e2e FAIL이다. 각 원본 test FAIL·취소·미실행을 보존한다. 다음 수정 Head required3/Trusted QA·Owner gate는 NOT TESTED, MERGE_READY=BLOCKED다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_667.md`: UPDATED
- `docs/exec-plans/active/ISSUE_637.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/evidence/issue-667/local-validation.json`: UPDATED
- `docs/evidence/issue-667/ci2811-correction.json`: UPDATED
- `docs/evidence/issue-667/ci2812-correction.json`: UPDATED
- `docs/evidence/issue-667/ci2813-correction.json`: UPDATED
- `docs/evidence/issue-667/ci2814-correction.json`: UPDATED
- `docs/evidence/issue-667/ci2817-correction.json`: UPDATED
- `docs/evidence/issue-667/ci2818-correction.json`: UPDATED
- `docs/evidence/issue-667/ci2819-correction.json`: UPDATED
- `docs/evidence/issue-667/ci2820-correction.json`: UPDATED
- `docs/ISSUE_667_FAILURE_ANALYSIS.md`: UPDATED
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
- `docs/REMOTE_VALIDATION.md`: UPDATED
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

## CI #2814 / 전체 이전 실패 종합 재개

사용자의 반복 실패 종합 분석 요청에 따라 [종합 분석](../../ISSUE_667_FAILURE_ANALYSIS.md)에 최초 로컬 실패부터 원격 #2811~#2814까지 원인·교정·테스트 가정·미실행 경계를 연결했다. 최신 연결 종료의 근인은 UNKNOWN이며 원본 same-case 로컬 PASS로 원격 FAIL을 대체하지 않는다. UI 이후 확인 GET의 same-origin browser transport·직접 진단, 안전한 Next 메시지 분류, 취소 child callback 완료 검증을 보완했다. 최초 전송 교정은 production 변경0이었고 후속 Copy/Resource 제품 보완은 별도로 귀속한다. 재시도/timeout/skip 증가0이다.

관련46 E2E 파일260사례를 fail-fast 없이 실행하고 Gantt 전체 feature Unit·project recovery/revision·진단50파일666사례를 검사한다. 최종 수치·source fingerprint·PRE_QA는 [교정 원장](../../evidence/issue-667/ci2814-correction.json)에 기록한다. 새 Full PR CI 시작까지 수행하며 완료 모니터링·병합·release는 수행하지 않는다.

추가 독립 감사 P2로 첫 Milestone의 weekday-only fixture가 평일 공휴일에서 정상 일정 이동을 오류로 판정할 수 있음을 확인했다. frontend가 해당 E2E 한 파일만 fresh Project calendar의 nextWorkingDay 입력으로 보완했다. strict 날짜·coverage·각3회 확장은 유지한다. 당시 광역4-source 검증과 Copy 제품 보완을 포함한 확대 원본49파일 검증을 분리해 원장에 귀속했다. 이후 정규화한 달력 실제 SQLite3사례는 성공한 fixture24에 포함하며 최종 선택56과 분리한다.

첫 종합 로컬 46파일260사례는 258 PASS / 1 FAIL / 기존 baseline1 SKIP / 0 flaky·미실행0, 1871955.909ms였다. 추가 Copy 원본은 exactX46→0이며 단독도 FAIL(test4148ms/report14765.092ms)이다. 원본 보고서·안전한 결과 목록을 Git 밖에 보존했다.

제품 copy-only capsule은 dispatch의 원래 입력 권한/가로 위치를 정확 request에 연결하고, body 검증+canonical 수용의 confirmed revision/U2 proof 뒤 기존 단일 Coordinator로 한 번 handoff한다. 비데이터 context·환경을 바꿨다 돌아온 이력도 요청별로 영구 폐기하며 callback이 새 권한을 만들지 않도록 쓰기 직전까지 추가 제한을 적용한다.

초기 보완 뒤 row.visible을 viewport 완료로 보던 중간 FAIL도 보존하고, 이번 명령의 현재 revision/receipt SETTLED를 기다린 뒤 기존 exactX를 검사한다. 확대 원본49파일은 shared Hierarchy/Editor3파일을 추가했으며 원격6shard/timeout/retry/skip 정책은 불변이다.

확대 원본 실행의 동결은12 source파일 fingerprint `59e135de1b24cd32a7869b65c6321fd7774a13db0e2a94bee757b46fc937d9b3`다. 새 Gantt 전체 feature+project recovery/revision+진단 Unit51파일714 PASS/0FAIL/0pending이며 초기666과 합산하지 않는다. Copy positive/실제wheel/scale왕복3사례는59051.38ms에 PASS했다. 확대49파일299사례는294 PASS/4 FAIL/기존1 SKIP/0 flaky/0 미실행으로 완료했으며 원격 전체 CI/QA_FINAL·Owner 승인은 NOT TESTED다.

확대49파일의 canonical-projection 검색 receipt 사례는 old generation1/filterKey를 새 검색으로 승인한 테스트 완료 경합으로 FAIL했다. 실제 새 generation3은 첫 collapse 뒤 도착했다. 제품 source를 유지하고 새 query identity/정확한 filtered 행 집합을 확인하는 fixture만 보완한다. 전체299 실행을 보존한 뒤 변경 파일21사례를 재검증하며, 다른48파일과 단일 실행 PASS로 합치지 않는다.

추가 달력 fixture의 실제 past/future 실패는 canonical holidays/exceptions 호환 projection을 중복 입력해 DUPLICATE_CALENDAR_EXCEPTION이 발생한 보완 오류였다. 기존 adapter와 같은 정규화로 수정하며 validator/DTO/Calendar 알고리즘은 유지한다. 검색 receipt21+관리 actual3의 변경2파일24사례와 Resource 공유 port 제품 보완 이후 관련 회귀를 재검증한다. 원본299의 FAIL을 단일 full PASS로 다시 쓰지 않는다.

Resource 첫 통합 사례의 기존5초 poll은 X=31→30 및 PEER_RETURN TIMED_OUT으로 FAIL했다. native 수용 범위만으로 조기 완료한 준비 단계와 retained extent/Core capacity를 원본 단독·공개 state·독립 검토로 확인한 뒤 최소 보완한다. 전체299 원본과 최종 source/결과를 구분하며 strict 좌표·3프레임·원래 lease/receipt 조건은 유지한다.

Resource 최소 보완 후 원본 strict1 PASS, 검색21+Milestone관리3의 fixture24 PASS를 확인했다. 최종15 source/test fingerprint `0c8fbccde4deadb266f2bffa5332023a28c4654a448fc6f3295b39a64178e924`를 동결했고 새 Unit51파일723 PASS/0FAIL/0pending이다. 과거666/714·별도 reviewer/구현자 Unit과 합산하지 않는다. 같은49파일299사례의 최종 재실행은 마지막61번 PASS 관측 뒤 세션이 종료되어 완료 보고서가 없다. 전체 결과는 NOT TESTED이며 같은 source의 핵심7파일56사례를 max-failures=0/retries=0/workers=1로 별도 검증해56 PASS/0FAIL/0SKIP/0flaky,525610.539ms를 확인했다. 최종 DOCUMENTATION_SYNC 의미 검토·PRE_QA는 PASS(별도 qa_docs의26게시파일·15source·선택 로컬 증거 검토)다.

최종 게시 인계: 독립 Reviewer `/root/integration_tests` qa_docs의 PRE_QA PASS/DOCUMENTATION_SYNC 의미 검토 PASS·미해결 지적0, typecheck/Markdown228/version0.114.1/whitespace PASS와 변경 source lint오류0·기존hook warning3을 확인했다. source15 fingerprint0c8f와 원본 HTML56/fixture24/Unit723 및 과거4JSON 불변을 대조했다. 부모 c6f18의 후속 commit을 기존 PR #695에 exact tree bytes·expected_sha/force=false로 게시하고 새 Full PR CI 등록까지만 확인한다. 정확한 게시 Head/tree/base/PR test merge·run URL·리뷰/충돌 상태는 Issue STATUS/PR 댓글에 기록한다. 원격 required3·Trusted QA·QA_FINAL·Owner/Manager ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED다.


## CI #2817 — 동일 revision Editor 재조회 후 관측 누락 조사

2026-10-16 사용자 요청으로 같은 PR #695의 실패 보완을 재개했다. 원본 Head `06d34e77006ef6edcef53a6341bfbf5b4e916e69`, base `ee6365bf57ab637b4c0aca61fdedaf5148253052`, [run38824812168 / #2817.1](https://github.com/planner77/masterGantt/actions/runs/38824812168)의 Quality job116730713030·Docker job116730953213은 SUCCESS, E2E job116731165862는 FAILURE다. shard1 job116730267339 step7의 `gantt-state-recovery-editor.spec.ts:15` SC-01에서 첫 Editor 최신 조회 GET200 이후 line36의 새 observation 검증이 실패했다. observation3이 유지됐으며 shard1은1 PASS/1 FAIL/110 NOT RUN, 다른5 shard는 CANCELLED다. 이전 #2814 ECONNRESET과 다른 실패로 분류한다.

실제 Manager·frontend `/root/editor_reload_fix`·infra `/root/publish_transport`·독립 read-only qa_docs `/root/integration_tests`가 원인/수정/문서/원격 인계를 분담한다. frontend가 production·관련 테스트와 단일 browser 실행을 소유하고 Manager가 문서를 작성한다. 원본/보완 source와 검증 결과를 분리하며 새 Full PR CI 시작까지만 진행한다. 이전 사전검토·로컬 PASS를 이번 원격 FAIL이나 새 Head의 PASS로 재사용하지 않는다.

이번 source와 원본 원격 분석·로컬 원본 비재현·선택 회귀·독립 검토는 [CI #2817 보완 원장](../../evidence/issue-667/ci2817-correction.json)에 기록한다. 원격 source artifact와 실제 test-merge 부모/Tree 교차확인은 완료했으며 기존5개 증거 JSON은 불변으로 보존한다.

### 이번 보완 및 최종 선택 검증

최초·open/select/layout·axis 관측 요청을 동일 최신 canonical data queue 뒤로 정렬하고 trigger 집합을 보존한다. 관측 완료는 data queue 밖에서 기다린다. 독립 검토가 찾은 새 helper의 P2(예외 뒤 옛 waiter가 fresh 요청을 소비하고 빈 추가 관측 생성)는 실패/cleanup drain 토큰 폐기와 실제 held-queue Unit으로 교정했다. 이 P2는 보완 중 발견한 오류이며 원격 #2817의 근인으로 소급하지 않는다. 개발 진단은 rows/semantic/delivery/ordering 단계와 고정 outcome만 남기고 실패·차단·전달 거부를 성공과 구분한다.

최종 source3 fingerprint `677f27b6e682eb7214d463aba603c14c82ca35bf8c57334c5f25c128281c6a71`에서 Unit3파일71 PASS/0FAIL/0pending, Chromium4파일40 PASS/0FAIL/0SKIP/0flaky/globalErrors0,141619.053ms,exit0을 확인했다. browser 대상은 canonical-projection21·gantt-state-recovery-editor4·viewport-coordinator8·milestone-dashboard-state7이며 workers1/retries0/max-failures0이다. 원본 SC-01 1+3 PASS·중간 source 실행·중단된40 실행은 별도 보존하고 최종40에 합산하지 않는다. typecheck PASS, scoped lint오류0·기존hook warning3, Markdown228/version0.114.1/whitespace PASS다.

원격 당시 미전달의 직접 근인은 UNKNOWN이다. 신규 Unit은 queue 순서·trigger 보존·오류/cleanup 경계를 검증하며 원격 경합의 actual browser 재현 증거는 아니다. 최종40은 기존 SC-01의 새 observation/semantic reuse/Core쓰기0·canonical·인스턴스 단언을 그대로 검사한다. API/DB/일정/보안/CI 정책·timeout/retry/skip 변경은 없고 version0.114.1/release_authorized=false를 유지한다. 독립 사전 검토·게시 Head/Tree/새 Full CI 출처·리뷰/충돌은 원장과 Issue/PR 댓글에 인계한다.

최종 독립 `/root/integration_tests` 검토는 PRE_QA PASS / DOCUMENTATION_SYNC PASS,12게시파일·3source·선택40/71근거 범위이며 미해결 지적0이다. HTML과 안전 JSON의40개 결과/시간 및 source hash를 전부 대조했고 기존5개 evidence JSON 불변을 확인했다. 현재 리뷰 스레드0·mergeable=true를 재확인했다. 새 Head 전체 Required3/Trusted QA/QA_FINAL/Owner ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED로 인계하며 완료 모니터링·병합·릴리스를 수행하지 않는다.


## CI #2818 — 같은 SC-01 실패 재발 / 원격 완료 모니터링 재개

당시 사용자 요청에 따라 새 PR CI 완료까지 모니터링하며 이전 CI 시작까지만의 범위를 대체했다(과거 실행 이력). 원본 [CI #2818.1 / run38827799811](https://github.com/planner77/masterGantt/actions/runs/38827799811), Head `f94f2f633301a59a04a3fce2c6c7078a68f1c72d`, base `ee6365bf57ab637b4c0aca61fdedaf5148253052`에서 Quality job116740291029·Docker job116740499332은 SUCCESS, E2E aggregate116740700316은 FAILURE다. shard1 job116739804326 step7의 `gantt-state-recovery-editor.spec.ts:15→36` observation3 유지가 재발했다. 표시11.7초,1 PASS/1 FAIL/110 NOT RUN, 다른5 shard CANCELLED다. 이전 선택40/Unit71 PASS·사전 검토를 원격 해소 증거로 사용하지 않는다.

infra는 새 단계 진단과 원본 artifact/출처를 분석하고 frontend `/root/editor_reload_fix`가 production·관련 테스트 단일 작성자/단일 browser 실행자, qa_docs `/root/integration_tests`가 독립 read-only 검토, Manager가 통합·문서를 맡는다. 원본 상태에서 TZ=UTC/CI_E2E_FULLY_PARALLEL=true 등 실제 환경 차이를 재현하고 직접 원인 증거를 우선 확보한다. 추측만으로 관측 예산·단언·보안·원격 gate를 변경하지 않는다. 병합·Main/GHCR·release는 별도 범위다.

원본의 실제90ms RAF 지연 SC-01 변형은1 FAIL(7725ms/report20059.393ms/exit1)이며 semantic TIMED_OUT과 고정 observation을 재현했다. CI 환경 모사2 PASS는 비재현 결과로만 보존한다. U3-only 실제 RAF helper 연결·abort/hidden cleanup 및 진단 finally 정리 보완을 독립 검토했다. 기존deadline/120frame/3안정frame·U2/U4 frame정책·권한/UNKNOWN/서버 계약을 유지한다. 이번 최종5 source와 원본/보완 검증은 [CI #2818 원장](../../evidence/issue-667/ci2818-correction.json)에 귀속한다.

### 최종 source 선택 검증과 원격 인계

최종5 source fingerprint `058eb1aaf9d6c20f493e5b698a4a0be00e9f547efd6d1786836aba1a56725b06`에서 Unit4파일76 PASS/0FAIL/0pending, Chromium4파일41 PASS/0FAIL/0SKIP/0flaky/globalErrors0,157070.556ms/exit0을 확인했다. 실행 환경은TZ=UTC/CI=true/CI_E2E_FULLY_PARALLEL=true/workers1/retries0/max-failures0이다.

구성은 canonical-projection21·Editor복구5(원래4+실제RAF90ms1)·viewport8·Milestone복귀7이다. 실제 지연 변형은 같은 semanticId3에서 observation3→4/reused=true/delivery SETTLED를 확인했다. 원본red1FAIL·CI환경모사2PASS(별도HTML없음/rawlog보존)와 최종41을 분리한다. 소스/HTML/안전JSON·명령·Unit76은 이번 원장에 귀속하며 생성 설정·기존캡처는 백업 후 원본bytes로 복원했다. typecheck/lint오류0(기존hook경고3)·Markdown228·version0.114.1·whitespace PASS, 과거6개 evidence JSON 불변이다.

문서 영향은 ARCHITECTURE/ADR/TEST_PLAN/REMOTE_VALIDATION/누적 실패 분석/Work Packet/PLAN/CHANGELOG 및 새 원장이다. 서버 API/DB/일정 알고리즘/보안/제품 시각언어·사용자 흐름·SVAR dependency/CI workflow는 변경하지 않아 해당 상세 문서 변경은 N/A다. 실제 변경은 내부 U3 clock 연결과 회귀 타이밍 주입·정리에 한정한다. 독립 사전 검토 후 동일 PR에 게시하고 새 Required3 완료까지 모니터링하며 run/attempt/Head/base/test merge·원격 결과는 Issue/PR STATUS에 기록한다. 새 결과를 커밋해 Head를 바꾸면서 이전CI를 재사용하지 않는다. Owner ACCEPT·병합·main/GHCR·release는 별도다.

최종 독립 `/root/integration_tests`의 PRE_QA/DOCUMENTATION_SYNC는 PASS(14게시파일·5source·선택41/76범위), 지적0이다. 원본red와green의 실제SC-01·HTML41개·UnitJSON·source5 fingerprint 및 과거6JSON불변을 대조했다. 리뷰0/mergeable=true를 재확인했으며 게시 후 재확인한다. 원격 Required3·Trusted QA·Owner ACCEPT는 새 Head에서 별도 판정하고 완료까지 모니터링한다. version0.114.1/release_authorized=false 및 Issue/PR OPEN을 유지한다.


## CI #2819 — 완료 모니터링에서 드러난 별도 canonical GET 전송 실패

새 Head `a376dc0914ea7ad525e9ec12bda8e0fe04207089`, test merge `ef0fc8f0d0c08cea63541093c32b1c19a71ca115`, [CI #2819.1 / run38830613612](https://github.com/planner77/masterGantt/actions/runs/38830613612)을 완료까지 모니터링했다. Quality116749238464/Docker116749517448 PASS, E2E116750083738/QA116750113482 FAIL이다. shard2 job116748850362 step7의 `gantt-state-product-integration.spec.ts:177→269`, SC-05 cross-tab stale 변형의 최종 `page.request.get(api)`가 read ECONNRESET으로11.2초 FAIL이었다. 12 PASS/1 FAIL/69 NOT RUN, 다른5 shard CANCELLED이며 취소 로그에 별도 실제 FAIL 표시는 없었다. 완료한 보고서가 없으므로 취소를 PASS로 올리지 않는다.

UNKNOWN 해제·같은 API·canonical 행·후속 renameInline까지 앞선 단언은 통과했고 최종 실제 저장 DTO 확인 GET이 실패했다. #2817/#2818의 의미 관측 timeout 재발이 아닌 #2814와 같은 전송 종류의 다른 callsite다. 관련 post-UI 확인 GET을 seed/auth/API독립 검증·다른 context/route우회·재시작 persistence와 구분해 감사한다. 실제 persistence 단언을 삭제하거나 mock으로 대체하지 않고 동일 출처 browser transport/no-store·직접 안전 observer의 기존 #2814 계약을 공유한다. 원격 상세 원인은 별도 lifecycle/resource 증거로 판단하며 무재시도·기존 timeout·권한/UNKNOWN·required gates를 유지한다.

이번 감사는 spec literal62/helper2=64 inventory에서 UI후 U5 확인11곳을 교정한다. 다른 spec51/helper2는 분류/제외 근거를 남기되 전수 의미 검토나 전체 전송 오류 해소로 보고하지 않는다. 기존stage browser 구현만 shared helper로 이관하며 production·API/DB·보안·U2/U3/U4·CI workflow 변경0, version0.114.1/release_authorized=false를 유지한다. 원본 stale/5002사례는 로컬 PASS하여 원격 오류의 직접 근인은 UNKNOWN으로 보존한다. 원격 취소shard1의 정상SC-01 8.7초/90msSC-01 9.5초 개별PASS는 부분 증거이며 전체shard는 CANCELLED다. 호출별 routecontinue/unroute·실제HTTP/SQLite·exactcanonical 검증, source/test5 fingerprint와 선택검증은 [CI #2819 원장](../../evidence/issue-667/ci2819-correction.json)을 따른다.

### 최종 선택 검증과 재게시 준비

최종test5 fingerprint `da4dbdacf3237392aa07532aa11314a6fff8229afc5c4b7d650b17331604c685`에서 실제 HTTP/SQLite4파일18 PASS/0FAIL/0SKIP/0flaky/globalErrors0,289748.963ms/exit0 및 Unit2파일17 PASS/0FAIL/0pending을 확인했다. 구성은 U5 product9·Editor5·stage1·Milestone관리3이다. Unit은 shared helper7+진단10이며 별도 독립7 PASS와 합산하지 않는다. typecheck·scoped lint오류/경고0·Markdown228/version0.114.1/whitespace PASS다. 원본cross-tab stale/5002 PASS의 별도 HTML/trace와 최종18·sourcehash·감사64 분류를 구분했다.

생산코드 diff0, 과거7 evidence JSON 불변이며 생성 Next설정은 백업 후 원본bytes로 복원했다. 이번 문서 영향은 TEST_PLAN/REMOTE_VALIDATION/누적분석/Packet/PLAN/CHANGELOG/새 원장이다. 제품 architecture/ADR/UX/API/DB/일정·보안·CI workflow 계약은 변경하지 않아 상세 수정은 N/A다. 최종 독립 사전 검토 후 같은 PR에 게시하고 새 Full CI 완료까지 다시 모니터링한다. 이번 교정은 원격 ECONNRESET 근인 확정이나 범위 밖53개 GET의 연결 안정성을 보증하지 않는다.

최종 독립 `/root/integration_tests`의 PRE_QA/DOCUMENTATION_SYNC는 PASS(12게시파일·5테스트·선택18/17범위), 지적0이다. HTML18개·UnitJSON·source/test fingerprint 및64 inventory를 전건 대조했고 과거7JSON불변을 확인했다. 리뷰/충돌 상태는 게시 전후 다시 확인하고 새exact-head FullCI 완료까지 모니터링한다. Owner ACCEPT·병합·main/GHCR·release는 별도다.


## CI #2820 — Grid Y 음성 oracle와 성공 영수증 계약 분리

Head `852056e71526968baf70c599eb09e1c37331e1e1`의 [CI #2820.1/run38832668354](https://github.com/planner77/masterGantt/actions/runs/38832668354)을 완료까지 확인했다. Quality116755740613/Docker116755979757 PASS, E2E116758017146/QA116758040610 FAIL이다. shard1 job116755309771 step7의 `projection-row-alignment.spec.ts:119→130` 음성 사례가 Expected TIMED_OUT/Received null로 실패했다.80 PASS/1 FAIL/32 NOT RUN, 다른5 shard CANCELLED(추가 실제FAIL표시0)다. 정상SC-01 6.2초/90ms SC-01 6.8초는 개별PASS로 보존한다. 기본브랜치 trusted run38833752118/job116758111603도 원본CI FAIL 때문에 실패했으며 Owner gate와 혼동하지 않는다.

원격 trace와 원본 단독 재현은 CSS GridY28px corruption/viewport1440→1439 뒤 새 관측gen3 rows PENDING→TIMED_OUT, 성공receiptgen1 SETTLED 유지였다. 원본단독 report9768.609ms/exit1로 같은 null 단언 실패를 재현했다. #667의 실패관측/성공영수증 분리 이후 구 #637 테스트가 실패를 성공receipt에 게시하길 요구한 계약 불일치다. 실제음성oracle를 최신 관측generation+rows TIMED_OUT으로 검사하고 current Core/DOM IDs·27.5px 차이·같은instance/mutation0를 직접 확인한다. 복구는 새 attempt의delivery SETTLED/fresh semantic observation(semanticId재사용허용) 및 실제정렬로 확인한다. production·timeout/retry/skip 변경 없이 테스트만 교정하고 관련42개를 재검증한다.

### 최종 음성 oracle 선택 검증

최종test1 fingerprint `b3b24d46639e866f0e128fc4fcf8318033081012307bf9ccca6049016e495d49`의 Chromium3파일42 PASS/0FAIL/0SKIP/0flaky/globalErrors0,95593.296ms/exit0이다. TZ=UTC/CI=true/CI_E2E_FULLY_PARALLEL=true/workers1/retries0/max-failures0으로 projection-row-alignment13·canonical-projection21·viewport8을 실행했다. mock API/실제 설치Core·DOM geometry 선택 검증이며 HTTP/SQLite 전체 저장 인수나 원격 전체 회귀가 아니다.

음성 첨부는 baseline gen2 delivery/SETTLED→실패 gen3 rows/TIMED_OUT(oldsuccess/semantic 불변)→복구 gen4 delivery/SETTLED와 freshsemantic observation을 확인한다. 실제4개 row/bar의27.5px 오정렬·currentcanonical/Core/DOM 동일·sameinstance/mutation0 검증을 유지했다. typecheck/복원후typecheck/scoped lint오류·경고0/Markdown228/version0.114.1/whitespace PASS, Unit은N/A(생산변경 없는 기존E2Eoracle수정)다. 생성설정은 백업 후 원본bytes로 복원했고 source drift0·과거8JSON불변이다.

이번 문서는 TEST_PLAN/GANTT_SYNC_TRACE/REMOTE_VALIDATION/누적분석/CHANGELOG/PLAN/WorkPacket667 및637 후속호환 기록/새 원장만 갱신한다. #637 과거판정·캡처·Issue 상태는 변경하지 않는다. 제품코드/architecture/ADR/UX/API/DB/일정/보안/CI정책 계약 변경은 N/A다. 독립 검토 후 게시하고 새FullCI 완료까지 모니터링한다.

최종 독립 Reviewer `/root/qa_final`은 PRE_QA/DOCUMENTATION_SYNC PASS(게시10파일·test1·선택42범위), 지적0으로 판정했다. HTML42개·음성첨부·sourcefingerprint 및 과거8JSON불변을 전건 대조했다. 조회 시 미해결review0/mergeable=true이며 게시 후 재확인한다. 동일source를 게시하고 새Head의Required3·QA/Trusted 완료까지 모니터링한다. Owner ACCEPT·병합·main/GHCR/release는 별도이며 현재MERGE_READY=BLOCKED다.


## CI #2825 후속 — 최신 main 정렬과 독립 native 입력 fixture 교정

[원본 #2825.1](https://github.com/planner77/masterGantt/actions/runs/38841181071) Head `6bec3a1098e603b9db9968d2206af95df12ac126`: Quality/Docker PASS·E2E FAIL. shard3의 #463 native viewport는 기대 `(180,128)` 대신 `(120,128)`에서5000ms FAIL,21 PASS/기존1 SKIP/106 NOT RUN이었다. 다른5 shard 취소에는 별도 단언 FAIL이 없다. 원본 event base와 실제 test-merge first parent의 차이도 [교정 원장](../../evidence/issue-667/ci2825-correction.json)에 보존했다.

현재 실행의 frontend `/root/viewport_fix`는 테스트 단일 작성자, infra `/root/ci_investigation`은 원본 GitHub 로그/artifact read-only 조사, qa_docs `/root/pre_review`는 독립 read-only PRE_QA다. Manager는 문서/증거·원격 게시를 소유한다. 기존 작성자의 source와 원본 이력을 되돌리지 않는다.

### 변경 영향·선정·제외 (#697)

| 경계 | 조치 / 검증 |
| --- | --- |
| 직접 변경 | `milestone-dashboard-state.spec.ts`의 초기 Y96→X120 및 후속 Y128→X180 독립 native 입력 사이에 public Core/native 세로 반영 완료 확인. 기존 최종 exactX/Y·필터/layout·peer 영수증·same instance·5000ms 유지 |
| 원인 분류 | 원본 trace의 Coordinator 쓰기6 불변·capacity2631·public180 이벤트0. 로컬 원본 단독 PASS는 비재현, 같은 tick 양축 주입/세로 이벤트 우선 진단은 동일120/128 FAIL. 설치 SVAR의 top→Chart X 동기화 경계와 일치하나 원격 스케줄의 직접 계측은 없음 |
| 직접·교차 선택 | 수정 #463 전체·viewport 실제 wheel/필터/axis·scale·Copy/Paste 실제 HTTP/SQLite·Milestone Core·Resource 복귀. 최종 명령·source·고유 사례 수는 JSON 원장에 별도 기록 |
| 의도적 overlap | SC-09의 pending axis 중 native X 입력은 순서 fixture 교정 대상 아님. 기존 취소/후속 쓰기0 회귀 유지 |
| Unit | 제품 변경0. 새로운 알고리즘 Unit 추가 N/A. 실행한 기존 관련 Unit은 로컬 경계 확인으로만 기록 |
| 제외 | API/DB/권한/Calendar/UNKNOWN 제품 코드 불변으로 해당 전수 재실행 N/A. 전체 E2E/SC 매트릭스·동시 양축 실제 wheel의 모든 조합은 NOT TESTED; 이번 fixture 교정으로 제품 지원 범위를 확정하지 않음 |
| 최신 source | main `fd219130491c53d054754eac41a58e4a6a3da0c6`을 양쪽 이력 보존 merge로 포함. 사용자 기존 비추적 자료·원본 FAIL/캡처/과거 JSON 유지 |

### DOCUMENTATION_SYNC

- UPDATE: Work Packet/PLAN, ISSUE_667_FAILURE_ANALYSIS, TEST_PLAN, REMOTE_VALIDATION, CHANGELOG 및 새 교정 JSON. 원본 FAIL·재현/대조·최종 선택 실행·원격 시작 경계를 분리한다.
- N/A: ARCHITECTURE/PROJECT_UX/GANTT_ADAPTER_ADR/GANTT_STATE_CONFORMANCE/GANTT_SYNC_TRACE/MILESTONE_TIMELINE/TASK_EDITOR/DESIGN/UI_UX_GUIDELINES — 제품 동작·GSC 규범·표시/interaction·API 계약 변경0, 기존 사용자 우선권/정확 viewport 계약 유지.
- N/A: API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/CI_CD/GITHUB_OPERATIONS/QA_REVIEW_POLICY, workflows/scripts/package/lock — 서버/알고리즘·권한·CI/릴리스 정책·버전 변경0. main에서 통합한 #697 검증 지침은 그대로 사용한다.

HIGH/OWNER_MANAGED/qa_required=true, manager_decision=NOT TESTED·MERGE_READY=BLOCKED, version0.114.1·release_required=true/release_authorized=false를 유지한다. read-only PRE_QA는 최종 인간 QA_FINAL/Owner ACCEPT가 아니다. 현재 사용자 범위는 새 Full PR CI 시작 확인이며 원격 Required/Trusted QA 완료·병합·Main/GHCR·release/tag·Issue 종료는 별도다.


### 최종 로컬 검증 (CI #2825 후속)

최종 test1 SHA256 `1b853b2dd9be5d181bdd5ff7528d579a022524137798dde7293e23631e776cd0`, source fingerprint `7293bd3bb337afe91cee22d94ebece3a91afa950f62e66cf91c6e0cf9b47bc90`에서6spec42 PASS/0 FAIL/0 SKIP/0 flaky/globalErrors0,414509.547ms를 확인했다. 실제 HTTP/SQLite Copy10+Resource7=17과 mock API/actual SVAR·DOM25를 구분한다. 390/768/1024/1440/1920px·native M·Day/Week·필터/peer/실제wheel·pending axis·Resource exact31·Copy 및 readonly/stale 선택 회귀가 포함된다. 제품 알고리즘 변경0이며 기존 관련 Unit4파일206 PASS는 불변식 확인이다. 중간 source35 PASS를 최종42에 합산하지 않는다.

Core/native owner의 Y 반영 확인은 React Chart layout commit 전체의 완료 영수증이 아니다. 실제 동시양축 wheel 전수·모든 scheduling 조합은 NOT TESTED이며 새 exact-Head 원격CI를 해소 증거로 확인해야 한다. 로컬 선택 PASS만으로 원격 전체·QA_FINAL/Owner ACCEPT를 선언하지 않는다. 생성된 next-env/tsconfig·기존캡처/geometry는 새 결과를 Git 밖에 보존한 뒤 원본bytes로 복원했다. 명령·원본/통제실험·실행 환경·source·최종결과는 이번 JSON 원장에 기록했다.

정적 확인은 typecheck·변경 spec ESLint 오류0/경고0·Markdown229·version0.114.1·git diff --check PASS다. 새 Required Quality/E2E/Docker·Trusted QA 완료는 NOT TESTED이며, 이번 게시 후에는 CI 시작 출처만 기록한다.

별도 qa_docs `/root/pre_review`는 최종 source/HTML42전건·원본/진단/대조·문서를 직접 대조해 PRE_QA/DOCUMENTATION_SYNC PASS·차단 지적0으로 판정했다. Unit206은 구현 Agent의 실제 도구 transcript `f523c7`에 근거하며 독립 재실행으로 표시하지 않는다. 이번 사전 검토는 선택 범위에 한정하고 QA_FINAL/Owner ACCEPT·새 원격 전체 CI는 NOT TESTED를 유지한다.


## CI #2827 후속 — focus fixture와 native clamp 제품 교정

현재 사용자 범위는 보완·원인 분석 별도 누적 저장·미해결 리뷰/충돌 처리 후 새 Full PR CI **시작 확인까지**다. main `fd219130491c53d054754eac41a58e4a6a3da0c6`은 원본 Head `6ba4ee3da3e36b2724880be62fd97c607cbbeb12`에 이미 통합돼 있다. 원본 run38844184124/attempt1의 Quality/Docker PASS·E2E/QA FAIL·Tooltip 실패와 취소 shard는 [별도 누적 분석](../../ISSUE_667_FAILURE_ANALYSIS.md)과 [ci2827](../../evidence/issue-667/ci2827-correction.json)에 보존한다.

frontend `/root/viewport_fix`는 fixture·port·Unit의 단일 작성자, infra `/root/ci_investigation`은 원본 remote evidence read-only 조사, qa_docs `/root/pre_review`는 별도 read-only PRE_QA, Manager는 docs/게시를 소유한다. 사용자 기존 산출물·이전 FAIL/성공 원장·release 승인을 바꾸지 않는다.

### 변경 영향·선정·제외

| 경계 | 조치·검증 |
| --- | --- |
| 원격 primary 실패 | ISO independent oracle의 Escape 후 같은 focused 가상화 셀 재사용. 실제 Week toolbar로 blur 확인→week cell focus 진입 확인·기존 ISO/포함월/geometry·Escape 닫힘/포커스 유지 검증. 원본 단독1 FAIL·진단1 FAIL·보완single1 PASS를 분리 |
| 확대 진단 | 첫 5spec41은38 PASS/3 FAIL. geometry1024/1440/1920의 Day→Week 전환 뒤 reveal SUPERSEDED를 발견했고 원본 source3사례도2 PASS/1 FAIL. 이 실패를 Tooltip 교정과 별도로 보존 |
| 추가 제품 교정 | `svar-viewport-port.ts`에서 같은 read의 Core/native baseline 최댓값을 등록. Day 잔여 native의 뒤로 clamp를 새 forward로 오분류하는 경계 차단. current lease·tag·1px·1회 처리·single writer·실제 입력 취소는 유지 |
| 제품 원인 실증 | 실제 입력은 viewport 밖 pointerdown3·wheel/keydown/touch0. Core9362/native25683→native10315 clamp를 기존 Core-only guard가 forward로 승격. 보완 뒤 원래 geometry3사례는 readiness/timeout/결과 변경 없이3 PASS |
| Unit | 새 mismatch clamp/equal/1px 음성과 두 baseline 초과 실제 forward 양성, 기존 API-only/tagged/stale/반대 방향·axis/coordinator/copy/header/ISO. 최종10파일250 PASS·352ms. 원본 guard에 새 음성 테스트를 적용한1 FAIL/40 PASS도 보존 |
| 최종 선택 | Timeline lane21·Core9·viewport8·Copy 전체10·Resource7·scale1의6spec56사례를 실제 실행해56 PASS. 실제 HTTP/SQLite17과 mock API/actual SVAR·DOM39를 구분. 최종 동결 source의 실제 결과·명령·환경은 JSON에 기록 |
| 제외 | geometry fixture에는 임의 대기/재시도/단언 완화 없음. API/DB/보안/일정 알고리즘·U2/U3 코드 불변으로 해당 전수 재실행 N/A. 전체 E2E/SC 인수·Windows/운영 환경·실제 동시 양축 wheel 전수는 NOT TESTED/후속 검증 |

### DOCUMENTATION_SYNC

UPDATE: ISSUE_667_FAILURE_ANALYSIS의 증상 인덱스/재개6단계/새 분석, ci2827 JSON, Work Packet/PLAN/TEST_PLAN/CHANGELOG, ARCHITECTURE/PROJECT_UX/GANTT_ADAPTER_ADR/GANTT_SYNC_TRACE. 추가 제품 결함 발견으로 초기 Tooltip-only 문서 N/A 중 포트 설명은 UPDATE로 전환했다.

N/A: GANTT_STATE_CONFORMANCE/MILESTONE_TIMELINE/TASK_EDITOR/DESIGN/UI_UX_GUIDELINES — GSC·Milestone 표시·Editor·시각언어/Tooltip focus 정책 자체는 변경하지 않는다. 기존 최신 입력/프로그램 clamp·focus/Escape·날짜/좌표 계약을 구현/검증한다.

N/A: API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS/QA_REVIEW_POLICY, workflows/scripts/package/lock — 서버/도메인·CI/권한·release 정책/버전 변경0. 원격 source·실패와 새 CI 시작 출처는 이번 원장/Issue STATUS에서 보존한다.

### 누적 저장과 남은 승인

후속 실패는 별도 원장의 증상 인덱스·재개6단계부터 읽는다. 최신 Head/main·source/Run/Attempt/Git 부모→전체 shard FAIL/취소 분리→원본 재현/통제 진단→최소 보완/선정·제외→최종 source 검증→새 CI 시작 출처를 연결한다. raw HTML/trace의 만료/격리 경계를 명시하고 안전한 분석/해시/결과는 Git에 보존한다.

HIGH/OWNER_MANAGED/qa_required=true·version0.114.1·release_required=true/release_authorized=false·Manager ACCEPT/QA_FINAL=NOT TESTED·MERGE_READY=BLOCKED를 유지한다. 원격 Required/Trusted QA 완료·병합·Main/GHCR·release/tag·Issue/branch 종료는 이번 범위 밖이다.


### 최종 동결 검증 (CI #2827 후속)

source3 fingerprint `092ea07e53e767fee0d8a1163a4f2163d477fbaa6fd9cc46bdb8dab3ecb8b1fe`에서 최종10파일250 Unit PASS(352ms), 6spec56 Chromium PASS/0 FAIL/0 SKIP/0 flaky/globalErrors0(462987.804ms), source hash drift0을 확인했다. 실제 HTTP/SQLite17과 mock API/actual SVAR·DOM39를 구분한다. 원본 Tooltip FAIL·노드 진단 FAIL·single PASS·확대38/3·원본 geometry2/1·입력 기원 FAIL·Unit red40/1·보완 geometry3 PASS는 각 source/실행으로 분리하며 최종56에 합산하지 않는다.

명령·환경·원본 source provenance·안전한 진단 숫자·최종 source SHA256와 결과를 별도 누적 문서/JSON에 보존했다. red Unit의 raw stdout은 직접 실행 원본이며 red source snapshot은 사후 patch로 재구성했음을 명시한다. 실제 code snapshot과 pre-run hash로 과대 표시하지 않는다. 생성 next-env/tsconfig와 기존530산출물은 새 결과를 보존한 뒤 원본 bytes로 복원했고 사용자 기존 비추적 자료는 유지했다. 원격 Required/Trusted QA 완료·Owner/Manager ACCEPT는 NOT TESTED다.

최종 정적 검사: typecheck·변경3파일 lint 오류/경고0·Markdown229·version0.114.1·diff-check PASS.

별도 qa_docs `/root/pre_review`는 최종3source·56 HTML 전건·원본/진단/Unit red/교정·문서13파일을 대조해 PRE_QA/DOCUMENTATION_SYNC PASS·추가 지적0으로 판정했다. 이전 JSON10개 불변과 생성 설정/진단 코드 복원도 확인했다. 정적 검사 PASS는 Manager 실행 근거이며 독립 재실행으로 표시하지 않는다. 새 원격 전체 Required/Trusted QA·QA_FINAL/Owner ACCEPT는 NOT TESTED를 유지한다.


## CI #2829 후속 — Task hover 전 현재 viewport 정착 전제

사용자가 지정한 별도 실패 분석 원장의 증상 인덱스·재개6단계 및 ci2827부터 읽었다. 원본 Head `80ae8628cb5ac98345936bb5867de5ca8f2e8d39`, 포함된 main `fd219130491c53d054754eac41a58e4a6a3da0c6`, 원본 run38847881348/attempt1/test merge `a49e9d46057be9f9cd63950771ae2780087bc391`을 고정했다. 현재 미해결 리뷰0·충돌0이며 새 main/Head는 게시 전에 다시 확인한다. 범위는 보완·원장 누적·리뷰/충돌 처리 후 새 Full PR CI **시작 확인까지**다.

frontend `/root/viewport_fix`는 hover spec/helper의 단일 작성자, infra `/root/ci_investigation`은 원본 remote evidence read-only 조사, qa_docs `/root/pre_review`는 별도 read-only 사전 검토, Manager는 문서/게시를 소유한다. 기존 #2827의 Core/native 양 baseline 제품 guard와 원본/성공 이력을 보존한다.

### 변경 영향·선정·제외

| 경계 | 조치·검증 |
| --- | --- |
| 원장 비교 | 이전 Week focus/scale clamp와 다르다. 이번 #551 ISO/geometry5폭·#463/SC-01은 개별 PASS지만 취소 shard 전체 성공으로 확대하지 않는다 |
| 원격 원본 | Task Milestone hover 뒤 정확 canonical Tooltip 생성→약5ms 뒤 소멸. RANGE_EXTENSION 진행 중이었다. shard4 99 PASS/1 FAIL/기존1 SKIP/39 NOT RUN·다른4 취소·shard6 89 PASS/기존1 SKIP, Quality/Docker PASS를 원장에 분리 보존 |
| 로컬 원본 | 정확 source의 같은 target 소멸 재현. 원격은 visible38, 로컬은 visible 순간 통과 뒤 name39 FAIL이며 같은 assertion으로 표시하지 않는다 |
| 직접 원인 | 읽기전용 계측에서 native scroll11819→Milestone mousemove→native scroll11818→추가 mousemove0. 기존 #492의 scroll close 정책은 정상이며 fixture가 첫 hover 전에 후행 viewport 보존 작업 정착을 확인하지 않은 전제 오류 |
| 최소 보완 | scrollIntoView 뒤 현재 API/revision/scale·URL rootTask scope·semantic/delivery·현재 Coordinator·Core/native/geometry/hit가3실제RAF 안정적인지 읽기전용 확인 후 첫 hover1회. 필터편집0인 이 spec에서 filterKey는 fresh receipt 안정성 범위로 한정한다. 과거 history SETTLED 재사용/새 writer/임의sleep/rehover/retry/기존5000ms 단언 완화 없음 |
| 직접·음성 선택 | 기존 Grid/Chart canonical 이름/date/null·Week/fullscreen/WBS/readonly·mutation0과390px hover. 실제 wheel 좌표 변화 후 scroll close, root focus close, root 밖 pointer leave close를 별도 검증 |
| 간접·제외 | A=hover6+scale1+viewport8+Copy10(25개), B=#551 ISO1개 별도 run으로 선택한다. 동일 source의 고유26개이며 A/B 시간·HTML은 합산하지 않는다. 제품/U2/U3/U4/서버/DB/보안/Calendar/Resource 알고리즘 변경0으로 해당 전체 전수 재실행 N/A. 전체 SC/원격 E2E·환경별 검증은 새 CI/후속 소유자 범위 |
| Unit | canonical tooltip formatter 기존 Unit은 smoke로 구분하고 새 read-only helper 모사 Unit은 N/A. 제품 알고리즘 변경0 |

### DOCUMENTATION_SYNC / 승인 경계

UPDATE: 별도 ISSUE_667_FAILURE_ANALYSIS 인덱스/ci2829 분석, 새 ci2829 JSON, Work Packet/PLAN/TEST_PLAN/CHANGELOG. 원본/진단/보완·최종 source 명령/환경·선정/제외와 남은 검증을 구분한다.

N/A: ARCHITECTURE/PROJECT_UX/GANTT_ADAPTER_ADR/GANTT_SYNC_TRACE/GANTT_STATE_CONFORMANCE/MILESTONE_TIMELINE/TASK_EDITOR/DESIGN/UI_UX_GUIDELINES — 기존 hover 표시·scroll/focus/leave close와 단일 writer/GSC·시각/interaction 정책은 유지한다. 보완은 테스트의 현재 준비 상태 확인이다.

N/A: API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS/QA_REVIEW_POLICY, workflows/scripts/package/lock — 서버/권한/도메인/CI/QA/release/버전 변경0. 원격 실패와 새 CI 시작의 실제 출처는 이번 원장/Issue STATUS에 기록한다.

HIGH/OWNER_MANAGED/qa_required=true, version0.114.1·release_required=true/release_authorized=false를 유지한다. 새 Required quality/e2e/docker·Trusted QA 완료·QA_FINAL/Owner·Manager ACCEPT=NOT TESTED·MERGE_READY=BLOCKED다. 최종 source의 실제 로컬/사전 검토 결과는 아래 및 JSON 원장에 별도로 기록하고 CI 완료 모니터링·병합·Main/GHCR·release/tag·Issue/branch 종료는 수행하지 않는다.

### 최종 동결 source의 로컬 증거

변경 source는 hover spec1개이며 SHA256 `2fa50d530f3bafd780814285577668e51a2170cc5414509a23be20fe84070261`, path→hash compact JSON fingerprint `9c6d6b8e5a398f9595bffd5d3e851401a6e850702468da16c0379ea776d70612`다. 제품runtime3파일은 원본 Head bytes와 동일하며 원본/진단 trace의 embedded source도 실제 추출·해시로 구분했다. generated next-env/tsconfig는 원래 bytes로 복원했다.

| 검증 | 결과·경계 |
| --- | --- |
| 최종 A | hover6+scale1+viewport8+Copy10=25 PASS/0 FAIL/0 SKIP/0 flaky/global errors0, 197420.692ms |
| 최종 B | #551 ISO 독립 oracle1 PASS/0 FAIL/0 SKIP/0 flaky/global errors0, 7679.310ms |
| 고유·실행 경계 | A/B testId 교집합0·고유26, 실제HTTP/SQLite10·mock API/실제SVAR/DOM16. source drift0. 서로 다른 HTML/시간 유지 |
| Unit | 최종 formatter1파일2 PASS/123ms. 초기5파일69 PASS/221ms와 formatter2 중복이므로 합산하지 않음 |
| 정적 검사 | typecheck PASS·변경spec lint 오류/경고0·Markdown229·version0.114.1·diff PASS |
| 원본 실패 보존 | 원본visible38 FAIL/로컬name39 FAIL·lifecycle v1/v2 FAIL·초기보완6 PASS를 최종26에 합산하지 않음 |

명령/환경/예산/HTML hash는 ci2829 JSON에 고정한다. Nodev22.14.0/Playwright1.63.0/Chromium153.0.8010.12, workers1/retries0, 기존 expect5000ms/test30000ms·Copy기존90000/180000ms를 유지했다. A는 browser timezoneId unset/process TZ UTC(실제 browser timezone 별도미측정), B는 원본 spec의 America/New_York로 구분한다. 이 로컬 선택 PASS는 새 Head 원격 전체 Required 또는 QA_FINAL/Owner ACCEPT가 아니다.

별도 qa_docs `/root/pre_review`의 read-only PRE_QA=PASS / DOCUMENTATION_SYNC=PASS(이번7파일·선택26사례 한정), 추가지적0이다. 최종 HTML/hash·case중복0·source drift0·과거11개 evidence bytes·runtime3파일 불변을 직접 확인했다. HIGH/OWNER_MANAGED·QA_FINAL/Owner/Manager ACCEPT=NOT TESTED·MERGE_READY=BLOCKED를 유지한다.

## CI #2831 후속 — 768px geometry의 reveal SUPERSEDED

별도 실패 원장의 증상 인덱스·재개6단계와 ci2827/ci2829를 먼저 읽었다. 기준 Head `b300ae0411117a31ea3cfc59692f69f3d64f21be`, main `fd219130491c53d054754eac41a58e4a6a3da0c6`을 고정했다. 원본 run38852119218의 shard4 job116815978545 step7은 `milestone-timeline-lane.spec.ts:380→391`, 768px geometry reveal의 SETTLED 기대/SUPERSEDED 수신이다. Quality/Docker PASS·E2E/QA Automated FAIL, 해당 shard53 PASS/1 FAIL/기존1 SKIP/89 NOT RUN이다. 취소 shard와 미실행을 성공으로 보지 않는다.

원본768 단독 로컬 PASS는 비재현으로 기록한다. 원격 마지막 snapshot은 reveal 직전 RANGE_EXTENSION SETTLING이며 새 DIAGNOSTIC_SCROLL의 직접 취소 사유는 미계측이다. #2827 native-forward clamp·#2829 hover 준비 전제와 동일 원인이라고 단정하지 않는다. 정확한 원인·통제 재현·최소 보완·선정/제외·최종 동결 source는 [ci2831](../../evidence/issue-667/ci2831-correction.json)에 단계별로 기록한다.

frontend `/root/viewport_fix`는 관련 제품/테스트와 browser/server의 단일 작성자·운영자, infra `/root/ci_investigation`은 remote read-only 증거 조사, qa_docs `/root/pre_review`는 별도 read-only PRE_QA, Manager는 문서/통합/게시를 담당한다. 기존12개 evidence와 원본/생성 설정/capture를 보존한다. 제품·CI gate/단일writer/timeout/retry/skip·성공 단언은 유지하고 geometry fixture의 읽기 전용 등록 전제만 보완한다.

현재 main 포함·미해결 리뷰0·충돌0을 확인했으며 게시 전에 재검증한다. 이번 범위는 보완·문서 동기화 후 같은 PR695의 새 Full PR CI 시작 확인까지다. HIGH/OWNER_MANAGED·qa_required=true/version0.114.1/release_required=true/release_authorized=false, QA_FINAL/Owner/Manager ACCEPT=NOT TESTED·MERGE_READY=BLOCKED를 유지한다. 병합·Main/GHCR·release/tag·Issue/branch 종료는 별도다.

### 변경 영향·선정·제외 및 DOCUMENTATION_SYNC

| 경계 | 이번 조치·검증 |
| --- | --- |
| 직접 생산/소비 | #551 geometry test의scale전환→현재U3 semantic/delivery·실제축준비→최초probe.reveal 호출1회(필요 시 DIAGNOSTIC_SCROLL). 제품range current()의initial.projectionEpoch fail-closed는유지 |
| 원본/진단 분리 | 원본768단독PASS·자연5폭/10관측PASS는비재현. 정착관측24actualRAF보류통제1FAIL의day2→week3·SUPERSEDED와원격직접cancelUNKNOWN을구별 |
| 직접·인접 선택 | lane전체/5폭Day·Week+Core9·viewport8·scale1·hover6·실제HTTP/SQLiteCopy10. 최종discovery고유case수로확정, retries0/maxFailures0에서모든추가FAIL관찰 |
| 취소 음성 | SC-09의의도적pending/wheel에는새준비gate미적용. viewport-coordinator Unit의gesture/hidden/context/revision/projection취소·후속repair0를보존/검증 |
| 제외 | 최종제품/공유helper변경0전제에서Resource/Calendar/서버/auth/DB/보안전체재실행N/A. 전체SC/공식전체회귀/환경별인수는새PRCI와후속소유자범위 |

UPDATE: ISSUE_667_FAILURE_ANALYSIS와새ci2831JSON·TEST_PLAN·Work Packet/PLAN·CHANGELOG. 이전12개evidence bytes, 원본/통제/최종source·명령·환경·선정/제외·확정/UNKNOWN경계를보존한다.

N/A: ARCHITECTURE/PROJECT_UX/GANTT_ADAPTER_ADR/GANTT_SYNC_TRACE/GANTT_STATE_CONFORMANCE/MILESTONE_TIMELINE/TASK_EDITOR/DESIGN/UI_UX_GUIDELINES — 기존제품scale/receipt/취소·단일writer·시각/interaction계약변경0, 검증명령등록전제를명시한다.

N/A: API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS/QA_REVIEW_POLICY 및workflows/scripts/package/lock — 서버/권한/도메인/CI/QA/release/버전변경0. 원격실패와새시작의실제출처는원장/IssueSTATUS로보존한다.

### 최종 동결 source의 로컬 증거

변경 source는 lane spec1개(+53/−0)이며 SHA256 `29f9380dc4e09fa62540f42061534777bf14c500295863e5fde35d097563482a`, 변경path→hash compact JSON fingerprint `122414ffa09f855b847f3af475f4a5ce1c2fc7b006b565097d8ed1f8436f6267`다. 임시제품2파일을 원복했고 runtime3파일·기존12개evidence는 HEAD bytes와 같다. 기존 Core/native 양baseline guard·Task hover 보완·geometry/취소 단언을 유지한다.

| 실행 단계 | 결과·시간·경계 |
| --- | --- |
| 원본768 | 1 PASS(비재현), test2578ms/report5738.975ms |
| 자연5폭 | 5 PASS/10 Day·Week관측, test합11424ms/report14851.171ms; pending단독항상실패가설기각 |
| no-gate24RAF통제 | 1 FAIL, test2218ms/report5553.964ms; 원문FAIL보존 |
| 동일24RAF+gate통제 | 1 PASS, test3164ms/report6585.704ms; 현재week/gen3→gen3·최초revealSETTLED |
| 최종6spec | lane21+Core9+viewport8+scale1+hover6+Copy10=고유55 PASS/0 FAIL/0 SKIP/0 flaky/global errors0 |
| 최종 시간·실행 경계 | report300934.710ms/test합190573ms, 실제HTTP/SQLite10·mock API/실제SVAR/DOM45. source drift0·retries0 |
| Unit | Coordinator1파일91 PASS/194ms; gesture/hidden/context/revision/projection취소·후속repair0음성포함 |
| 정적 검사 | typecheck PASS·변경spec lint 오류/경고0·Markdown229·version0.114.1·diff PASS |

명령/환경/timeout예산·각HTML hash·source snapshot provenance는 ci2831 JSON에 고정했다. 일부진단snapshot은원본backup/실제편집스크립트로재구성해당시보존hash와대조한증거이며원격원본traceembedded 직접bytes확인과구분한다. timing reporter의FAIL제외 duration합0은실제실패시간0이아니므로HTML의2218ms와별도로구분했다. generated next-env/tsconfig는 HEAD bytes로원복하고생성bytes를Git밖에보존했다. 로컬선택/통제결과와공식새exact-Head전체Required·QA_FINAL/Owner ACCEPT는별도다.

별도 qa_docs `/root/pre_review`의 PRE_QA=PASS / DOCUMENTATION_SYNC=PASS(이번7파일·선택55사례·Unit91의원문/소스대조한정), 미해결지적0이다. Reviewer별도재실행은없으며 HIGH/OWNER_MANAGED·QA_FINAL/Owner/Manager ACCEPT=NOT TESTED·MERGE_READY=BLOCKED를 유지한다.

## CI #2833 후속 — metadata 저장 전 현재검색/Week capacity 준비

별도원장의증상인덱스·재개6단계와ci2831/ci2829/ci2827을먼저읽었다. 기준Head `56349bd1d8a23900f38988439c7125b1dfdee4bb`, 포함main `fd219130491c53d054754eac41a58e4a6a3da0c6`, 원본run38855912664/attempt1/testmerge `d2fbf60e5724c8dcaa7e12b9b8733885b4e1d97b`를고정했다. shard5 초기120기대/46실제와원본/진단의nativecapacity47 browserclamp를분리기록하며metadata저장후결함으로분류하지않는다. shard2 E2EstepSUCCESS/82개완료와JobCANCELLED도구별한다.

frontend `/root/viewport_fix`는관련fixture/test·browser/server단일작성/운영, infra `/root/ci_investigation`은원격read-only조사, qa_docs `/root/pre_review`는별도read-only PRE_QA, Manager는문서/통합/게시를소유한다. 기존13개evidence/output/capture를보존하고임시진단/generated설정은원복한다.

### 변경 영향·선정·제외 및 DOCUMENTATION_SYNC

| 경계 | 이번 조치·검증 |
| --- | --- |
| 직접전제 | 기존Week전환RANGE·현재U3/axis capacity≥120정착→첫검색현재query/정확2IDs/U3전달→최초native120setter1회. 새writer/range발행/후행재주입없음 |
| 원본·후보 | 원본/읽기전용진단FAIL의clamp와첫후보bareUUID/DOMprefix혼동·정규화후capacity준비FAIL을별도source로보존 |
| 직접·교차 | density전체7+canonical-projection21+viewport8+scale1+실제Editor persistence3+Copy10=discovery고유50/6spec. actualHTTP/SQLite13·mockAPI/실제SVAR37, 최종동일source결과는별도기록 |
| 음성 | 최종직접선택은latezero차단/실제wheel우선·동일query빈집합0·SC-09wheel취소·Copy pending/filter/API/stale/실제412·추가mutation차단. scale중FILTER_INPUT취소는원본/진단관측계약이며제품취소source불변을확인하되별도최종취소음성PASS로확대하지않음 |
| 제외 | 제품/공유helper/Calendar/Resource/서버auth변경0전제로해당전수재실행N/A. 이번원격geometry5폭/hover6/viewport463PASS와제품불변으로기존55전체반복N/A. 전체SC/공식새PRCI/환경별인수는별도 |

UPDATE: 별도실패원장·새ci2833JSON·TEST_PLAN·Work Packet/PLAN·CHANGELOG. 원본/진단/후보/최종source·명령/환경·선정/제외·확정/인과추론경계를보존한다.

N/A: ARCHITECTURE/PROJECT_UX/GANTT_ADAPTER_ADR/GANTT_SYNC_TRACE/GANTT_STATE_CONFORMANCE/MILESTONE_TIMELINE/TASK_EDITOR/DESIGN/UI_UX_GUIDELINES — 기존제품membership/geometry clamp·metadata보존/취소·단일writer·시각/interaction계약변경0. 테스트입력등록전제만정리한다.

N/A: API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS/QA_REVIEW_POLICY 및workflows/scripts/package/lock — 서버/권한/도메인/CI/QA/release/버전변경0. 실제remote실패/새시작출처는원장/IssueSTATUS로기록한다.

현재main포함·미해결리뷰0·충돌0, 게시직전/직후재검증한다. 이번범위는보완·문서동기화후같은PR695의새FullPRCI시작확인까지다. HIGH/OWNER_MANAGED·qa_required=true/version0.114.1/release_required=true/release_authorized=false, QA_FINAL/Owner/Manager ACCEPT=NOT TESTED·MERGE_READY=BLOCKED를유지한다. 병합·Main/GHCR·release/tag·Issue/branch종료는별도다.

Unit N/A: 제품/알고리즘/공유helper변경0이며새read-only fixture를모사한Unit은추가하지않는다. 원본exact-Head quality/Vitest PASS와최종density7·이전불변43참고교차증거·정적검사를구분한다. 이전선택Unit91을이번새Local PASS수에합산하지않는다.

검증환경정정: 캡처분리용`ISSUE456_CAPTURE_PHASE=ci2833-final`이첫densitycase의기존`phase===after`geometry단언을우회함을발견했다. 해당동결run31PASS/1INTERRUPTED/18NOTRUN(exit130)은제품FAIL이아니며전체검증NOT TESTED로보존하고최종50에합산하지않는다. 기존after86파일/SHA를백업후기본after전체단언으로50을다시실행하며, 새after산출물을분리보존하고기존bytes를복구한다. 원본/진단#570단독은env미지정·해당case내phase분기0으로영향없다.

환경중단범위정정: customphase 실행은density도달전에우회가능조건을발견해중단했다. 실제31PASS는canonical21+scale1+Copy앞9개, Copy마지막1INTERRUPTED·density7/실제Editor3/viewport8=18NOTRUN이다. rawHTML은ok=true/skipped19(중단포함)이지만전체검증PASS가아니며NOT TESTED로제외한다(report203262.704ms).

### 확대 추가실패와 최종선정 조정

기본after환경확대50은49 PASS/1 FAIL(FAIL외SKIP/flaky/global errors0, report413974.643ms)이며인접#456 active-name-filter metadata사례의저장전초기120기대/46실제가추가로실패했다. 같은capacity47·FILTER_INPUT취소/후행46보존을확인했고#570전체단언은PASS였다. 초기에동일setup의직접소비자하나를놓친것을교정하며원래49/1FAIL을보존한다.

최종은동일file전용준비helper를#456/#570두사례에만재사용(+56줄), density7을기본after/원래모든단언으로재검증한다. 다른5spec43은해당source/runtime/공유fixture/config HEADbytes불변을확인해앞선참고교차증거로유지한다. 최종7과43을합산한새50PASS 또는단일최종source50runPASS로표시하지않는다. 전체새PRCI는이최종Head의별도원격검증이다.

### 최종 source의 실제 증거

최종source는densityspec1개(+56줄), SHA256 `1055c1261d6688ea4f6aa310044de5bde59a0ffa47e864c03cb35e8c90092da0`, fingerprint `6d37bc283e22881233c1b8d65d699b0c422a59e3de178c3dae29650ff154c404`이다. 최종density7 PASS/0 FAIL/0 SKIP/0 flaky/global errors0·retry0, report35049.085ms/test합31143ms다. 앞선정상after확대49/1FAIL·다른불변5spec43참고교차증거와분리하며합산한새50PASS를주장하지않는다. 해당43은실제HTTP/SQLite Editor3+Copy10과mock canonical21+viewport8+scale1이다.

기본after·PLAYWRIGHT_BASE_URL unset, Node22.14.0/Playwright1.63.0/Chromium153.0.8010.12, workers1/retries0/maxFailures0, 기존expect5000ms/test30000ms·density120000/90000ms·Copy90000/180000ms를유지했다. 최종첫case의원래overflow기하단언15회/footer버튼높이20회를HTML에서대조했다. 새capture environment는after/UTC·이번mtime로확인했고density기존86파일·Editor기존2PNG bytes/set을정확복구, 이번새768/1024PNG는archive후원위치에서제거했다. generated next-env/tsconfig도HEAD bytes로원복했다.

typecheck/변경spec lint(오류·경고0)/Markdown229/version0.114.1/diff PASS. 제품/공유fixture/config·기존13개evidence불변과source drift0을확인했다. Unit은제품/알고리즘변경0으로N/A이며이전Unit91을이번PASS에합산하지않는다. 원본/진단/보완중3FAIL·중간PASS·환경중단·확대49/1·최종7의실제명령/환경/source/HTMLhash/각시간은ci2833 JSON에분리보존한다.

별도qa_docs `/root/pre_review`의 PRE_QA=PASS / DOCUMENTATION_SYNC=PASS(이번7파일/최종density7·이전불변43참고·원문증거대조한정), 미해결지적0이다. Reviewer별도재실행은없으며HIGH/OWNER_MANAGED·QA_FINAL/Owner/Manager ACCEPT=NOT TESTED·MERGE_READY=BLOCKED를유지한다.

## CI #2835 후속 — 공유 분석과 정상 준비 계약의 공통화

현재 범위는 사용자 제공 공유 분석·별도 실패 원장 참조, 최신 main 정렬·미해결 리뷰/충돌 처리, 원인 분석·보완 후 같은 PR695의 새 Full PR CI 시작 확인까지다. 원격 #2835.1/run38861176558/Head `e67528cdca5435fe7af6539476e536d303104762`와 source artifact/test merge 귀속을 재확인했다. Quality/Docker PASS·E2E FAIL이며 #456 첫 검색 전 준비가 용량47px에서 실패했다. 이전 #2833 검색 취소와 현재 Week/U3 SETTLED를 구분한다. 실제 출처·모든 shard·미도달 단계는 [누적 실패 원장](../../ISSUE_667_FAILURE_ANALYSIS.md)과 [ci2835](../../evidence/issue-667/ci2835-correction.json)를 따른다.

frontend `/root/viewport_fix`는 공통 테스트 helper/소비자/Unit 및 browser/server 단일 작성·운영, infra `/root/ci_investigation`은 원격 read-only 조사, qa_docs `/root/pre_review`는 별도 read-only PRE_QA, Manager는 문서/통합/게시를 담당한다. 임시 진단 source·generated 설정·기존 캡처는 검증 후 원래 bytes로 복구한다.

### 반영 범위와 문서 동기화

- 공유 제안 A: 현재 data/성공 receipt/최신 attempt/semantic/current operation/목표 수용 범위의 동작별 read-only 계약. 기존 U2/U3/U4·Coordinator 권한과 번호 공간 유지.
- 공유 제안 B: 정상 setup과 전환·취소 음성을 구별. helper 안 입력/resize/remount/range 재발행/후행120 재주입 없음.
- 공유 제안 C: metadata/geometry/hover와 유사 fixed-coordinate 소비자를 감사해 exact 목표·비영점 baseline·의도적 경합으로 분류. 이관 범위와 제외 근거는 ci2835에 기록.
- 공유 제안 D: SETTLED+용량47은 목표120을 거절하는 통제 반례, 명시적 실제 입력 뒤 새 RANGE·양 capacity 수용, stale/current 문맥 Unit 및 최종 동결 source의 변경 소비자 회귀를 구분 검증.

UPDATE: TEST_PLAN·별도 실패 원장/새 ci2835 JSON·Work Packet/PLAN·CHANGELOG. 기존 원격 FAIL·원본 비재현·통제 source·최종 source·새 CI 시작을 분리한다.

N/A: ARCHITECTURE/PROJECT_UX/GANTT_ADAPTER_ADR/GANTT_SYNC_TRACE/GANTT_STATE_CONFORMANCE/MILESTONE_TIMELINE/TASK_EDITOR/DESIGN/UI_UX_GUIDELINES — 현재 제품 API/UX/단일 writer/취소·보존 계약 변경 없음. 정상 테스트 입력 등록 전제를 공통 관측한다. 기간 탐색/축 축소/재초기화/라이브러리 교체는 필요성 증거 없이 도입하지 않는다.

N/A: API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS/QA_REVIEW_POLICY 및 workflows/scripts/package/lock — 서버/도메인/권한/CI/QA/release/버전 정책 변경 없음. 새 Head 원격 전체 회귀는 별도 CI로 수행한다.

현재 main 포함·미해결 리뷰0·충돌0이며 게시 직전/직후 다시 확인한다. HIGH/OWNER_MANAGED·qa_required=true/version0.114.1/release_required=true/release_authorized=false를 유지한다. PRE_QA는 인간 QA_FINAL/Owner ACCEPT가 아니며 QA_FINAL/Manager ACCEPT NOT TESTED·MERGE_READY BLOCKED다. 병합·main/GHCR·release/tag·Issue/branch 종료는 범위 밖이다.

### CI #2835 최종 소스와 로컬 검증

최종 변경은 공통 read-only reader/evaluator·의미 반례 Unit·기존 density/lane/hover의6개 테스트 파일이다. source fingerprint는 `30768c91545090f4df9331037311938136508d113575bfc248a1652af85e31d8`이며 개별 SHA256과 정의는 ci2835 JSON을 따른다. 최종 Unit117(신규 evaluator26+기존 Coordinator91,184ms) 및 Chromium 고유43/5spec이 PASS했다. 직접 density7+lane21+hover6=34와 viewport8+실제HTTP pending Copy wheel1을 같은 고정 source에서 검증했다. 전체 PR CI나 전체 서버 회귀 PASS와 구분한다.

원본 정확 단독1 PASS는 비재현이다. 지속 left0 통제의 원본1 FAIL·보완2 FAIL과 initial-only 통제2 PASS는 서로 다른 source로 보존한다. 후자의 Core46/native47→명시적wheel(120,0)1회→현재 RANGE SETTLED/양capacity998/999와 기존 metadata·빈집합·latezero/wheel 완료는 liveness 실증이며 원격 RANGE 기원 재현은 아니다. 중간 source의43 실행23 PASS/1 INTERRUPTED/19 NOT RUN(exit130, raw HTML expected23/skipped20/ok=true)은 NOT TESTED로 제외한다. Unit114/116도 최종117에 합산하지 않는다.

독립 전제 감사에서 발견한 hover X exact/date canonical ID 배열 순서/metadata 첫 검색 전 nonempty DOM을 복원하고 의미 음성3개를 추가했다. receipt·attempt counter만 증가하는 안정성 경계는 현재 sample 유효성 검사와 의미/권한/실제 geometry key로 분리한다. geometry/hover의 이전 취소 명시 허용은 현재 context의 새 동작 준비이며 취소 명령 완료가 아니다. query witness는 다른 filter를 편집하지 않은 단일 query 전환만 증명한다.

추가 settings/transfer exact 좌표 후보는 정적 감사만 수행했고, 복수 물리 UI 작업 완료가 용량 보장 실증은 아니므로 잔여 capacity 전제는 미검증으로 남긴다. 비영점 baseline·기존 buffer 준비·SC-14/3000행·의도적 경합에는 기계 이관하지 않는다. DEV reader500개 한계와 실제 이관 fixture31/10/5개 범위를 유지한다. 제품3파일·공유fixture/config13·package/lock·이전14개 증거 불변을 확인하고 기본after 캡처/생성 설정을 복구한다. 최종 명령/환경·각 source/report 해시·선정/제외·PRE_QA/DOCUMENTATION_SYNC·새 원격 미검증 경계는 ci2835를 따른다.

별도 qa_docs `/root/pre_review`의 최종 PRE_QA=PASS / DOCUMENTATION_SYNC=PASS, 미해결 지적0이다. 변경6test/6docs와 실제117/43 원문·source·복구를 직접 대조했으며 Reviewer 재실행은 없다. 원래 capture88(after86+Editor2) bytes/exactset과 generated2파일을 복구했다. 최종 typecheck·6파일ESLint(오류/경고0)·Markdown229·version0.114.1·diff PASS다. E2E는TZUTC/context별시간대, Unit은TZunset/IntlAsiaSeoul로 구분한다. HIGH/OWNER_MANAGED·QA_FINAL/Owner/Manager ACCEPT NOT TESTED·MERGE_READY BLOCKED를 유지하며 새 Full PR CI 시작 출처는 게시 후 Issue STATUS에 연결한다.


## CI #2837 후속 — #571 WBS bookmark 최초 X 입력 준비 조건 보완

- 원본 PR #695 / [Full CI #2837.1](https://github.com/planner77/masterGantt/actions/runs/38870387493): Head `5b1b0f4187064a2d4797771c851103969a685362`; Quality/Docker PASS, E2E Shard4 `116873483182`에서 #571 `viewport-coordinator.spec.ts:161` Expected120/Actual0, 139PASS/1FAIL/기존1SKIP/3NOTRUN. 다른 Shard5 성공; QA Automated 파생 실패. 원본을 소급 PASS로 변경하지 않음.
- 변경 영향 표: `viewport-coordinator.spec.ts`의 WBS scope+Week → 기존 native X 입력 → 빠른 Milestone 필터 bookmark, 검색 및 실제 wheel 취소. 기존 `gantt-readiness`의 제품 소비자는 유지; `gantt-readiness.test.ts`에 APPLYING/high capacity·rows PENDING 음성 계약 추가. 제품 공유 writer/Coordinator/서버·API/DB 계약 수정0.
- 직접 검증 선정: #571 첫 native120 준비, Core/native120, filter120→0→120, wheel 후0, 검색 해제 후0, 동일 API·mutation0. 인접 검증: #456/#570 metadata 소비자, 기존 Viewport와 Gantt 축/peer 경합. 원본 상태 전이와 다르게 임의 sleep·retry·skip·timeout 증가를 허용하지 않음.
- 문서 영향: `docs/ISSUE_667_FAILURE_ANALYSIS.md` 및 `docs/evidence/issue-667/ci2837-correction.json`, 현재 Work Packet **UPDATED**. `docs/TEST_PLAN.md`는 #697 영향 기반 테스트 선정과 기존 SC-07/08/09·#571 명세를 그대로 적용하므로 **N/A(정책 불변)**. `AGENTS.md`, DESIGN, API, DB_SCHEMA, SECURITY, SCHEDULING_ENGINE, REMOTE_VALIDATION, CI_CD, CHANGELOG는 정책·제품·사용자 노출 동작/버전 변경 없으므로 **N/A**.
- 확인 사항: 변경 source의 TypeScript/Vitest/Playwright 로컬 실행은 GitHub 소스 조회 세션에서 실행 불가 → **NOT TESTED**, 통과 표시 금지. 자동화 CI는 새 Head 게시 후 별도 검증; 원본 아티팩트·기존 시도 증거 보존. qa_method OWNER_MANAGED/risk_level HIGH/qa_required true/release_required true/release_authorized false, MERGE_READY BLOCKED 유지.


## CI #2838 후속 — FILTER_RETURN post-geometry capacity 재검사 및 유한 재준비

원본 [Full PR CI #2838.1](https://github.com/planner77/masterGantt/actions/runs/38875147458) Head `131cdc285844b40ed9834e494d0c0a0140637767`: Quality/Docker PASS, Shard4 #571 quick Milestone→전체 bookmark (line192) 139PASS/1FAIL/기존1SKIP/3NOTRUN, 다른5 Shard SUCCESS. 최초 X120과 filtered X0은 PASS이고 '전체' 복원만 X0/NO_SCROLL_CAPACITY다.

### 변경 영향 분석 / AC_TEST_COVERAGE
- **Core/Viewport 제품:** `viewport-coordinator.ts`는 FILTER_RETURN의 기존 source·gesture·context 검사를 유지하면서 port.prepare에 compatibility=true를 전달하고 post-WAIT_GEOMETRY에 한 번의 Core/native admission 확인을 추가. `svar-viewport-port.ts`는 공용 writer에 쓰기 없는 `admitPosition` reader만 추가. 둘 외의 runtime, DB/API/permission, SVAR 도메인·축 알고리즘 구현은 유지.
- **직접 회귀:** `viewport-coordinator.spec.ts` #571 첫120→Milestone0→전체120→실제wheel0·검색해제0와 모든 기존 단언 유지. 새로운 Coordinator Unit의 축 축소 중간삽입·bounded reprepare 실패·기존 filter/wheel/reveal/columns 경계, port Unit의 Core/native 별도 admission.
- **교차 회귀:** #456/#570 metadata120 준비·late zero, #464 Resource peer, #384 Copy, #549 Week axis, #571 gesture·filter cancel, #666 U4 physical geometry 범위와 원래 Source lease.
- **증거/한계:** 원본 Actions log 및 artifact trace 안전 필드를 재검토했다. 최종 제품·Unit·문서 source의 정적 계약 검사만 완료; Node/npm 프로젝트 실행·Chromium local은 **NOT TESTED**. 원본 성공 사례와 새 Source PASS를 합산하지 않는다.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_667_FAILURE_ANALYSIS.md`, `docs/exec-plans/active/ISSUE_667.md`, `docs/TEST_PLAN.md`, `docs/evidence/issue-667/ci2838-correction.json` UPDATE. `AGENTS.md`, PROJECT_UX, GANTT_STATE_CONSISTENCY/CONFORMANCE, DESIGN, API, DB_SCHEMA, SECURITY, CI_CD, REMOTE_VALIDATION은 기본 계약/사용자-facing 동작 불변으로 N/A. .github workflow, package/lock, main version, GHCR release policy 불변. HIGH/OWNER_MANAGED·QA_FINAL/Owner·Manager ACCEPT는 NOT TESTED, MERGE_READY BLOCKED.

## CI #2840 후속 — 기존 Core exact/native ±1 경계 보존

최신 원격 Head `728c4ad4da48d0267fc34dd6ae738c7faec1b716`의 외부3커밋을 fast-forward로 보존했다. [별도 실패 원장](../../ISSUE_667_FAILURE_ANALYSIS.md)·ci2835/ci2837/ci2838을 먼저 읽었으며 최신 [#2840.1/run38880368154](https://github.com/planner77/masterGantt/actions/runs/38880368154)는 Unit1FAIL/2741PASS/3SKIP이다. Fast Gate로 productionbuild/E2E6/Docker구현은 SKIPPED·NOT TESTED이고 세 Required aggregate는 FAIL이다. 이전2837/2838의 E2E 오류와 구분한다.

직접 원인은 신규 port.admitPosition의 native119 거부 기대와 기존 native±1 정책의 불일치다. Core119 거부는 유지하고 native118 거부/119 허용/120 허용·명령0을 분리한다. source port의 수식은 변경하지 않는다. ci2838의 양exact/native119거부 문구는 당시 원장으로 보존하되 기존 ADR177/239에 따라 이번 후속에서 정정한다.

외부 FILTER_RETURN 보완을 보존하면서 두 번째 준비 중 user/filter/context/API 폐기→늦은 readytrue apply/repair0·SUPERSEDED4반례와, 두 번째 readytrue 후 재축소→세 번째 준비0/apply0/repair0·NO_SCROLL_CAPACITY1반례를 추가한다. Unit173(48+98+27)과 실제 viewport8·별도HTTP pending Copywheel1을 구분 검증한다. E2E8 실행 후 바뀐 Unit파일은 E2E 의존성이 아니므로 제품/E2E/helper/fixture/config 해시 불변에 한정해 8결과를 유지하고 단일9run이나 이전168Unit 합산으로 표시하지 않는다. Copy 중단 Channel closed/exit143·계약단언FAIL 미관측은 NOT TESTED로 별도 보존하며 근인은 UNKNOWN이다.

frontend `/root/viewport_fix`는 Unit2파일·browser/server 단일 작성/운영, infra `/root/ci_investigation`은 출처 read-only 분석, qa_docs `/root/pre_review`는 독립 read-only PRE_QA, Manager는 문서/통합/게시를 담당한다. 새 [ci2840 교정 원장](../../evidence/issue-667/ci2840-correction.json)에 실제 source·명령·환경·원본/보완/중단/최종 결과·별도검토를 기록한다. 기존17증거JSON·88capture·generated2를 복구하며 제품·CI·서버·의존성·버전 변경0을 유지한다.

DOCUMENTATION_SYNC UPDATE: 별도원장/ci2840JSON·TEST_PLAN·CHANGELOG·WorkPacket/PLAN·GANTT_ADAPTER_ADR의 native1px 경계 예시. N/A: ARCHITECTURE/GANTT_SYNC_TRACE/PROJECT_UX/DESIGN/UI_UX_GUIDELINES/API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS/QA_REVIEW_POLICY — 이번 제품/시각/서버/권한/CI/QA/release 계약변경없음. 외부 FILTER_RETURN 보완의 미검증을 실제 Unit·브라우저 교차로 확인한다.

범위는 최신main/리뷰/충돌 재확인·보완 게시 후 새FullPRCI 시작 확인까지다. HIGH/OWNER_MANAGED·qa_required=true·version0.114.1·release_required=true·release_authorized=false, QA_FINAL/Owner/Manager ACCEPT NOT TESTED·MERGE_READY BLOCKED를 유지한다.

CI #2840 보완의 마지막 증거 정정: 첫 Copy stdout은 보존된 실제 파일이 없어 log=null로 명시했다. 보존된 trace/error-context의 경로·SHA와54.031s Test ended/context닫힘을 확인하며, Channel closed/exit143은 당시 tool 관측과 구분한다. 원문 stdout을 재구성하거나 보존했다고 주장하지 않는다. 최종 별도 Copy1 PASS는 report19358.243ms/test4513ms, viewport8은 report41046.995ms/test합35353ms다. 총Unit173의 실제 분해는 Port48/Coordinator98/readiness27이며 이전 집계 오기를 정정했다. owned2 fingerprint는 명시된 path+NUL+SHA256+newline 정의의 `1b78cf85839945bdd54869646016b308bf82211e0019350a163132e8180c797c`다.

CI #2840 최종 독립 검토 `/root/pre_review`: PRE_QA PASS / DOCUMENTATION_SYNC PASS·미해결지적0, 문서7/Unit2와 실제173·viewport8/별도Copy1·15source/107baseline 대조한정이며 Reviewer 재실행은 없다. typecheck·변경2파일lint(오류/경고0)·Markdown229·version0.114.1·diff PASS다. 첫 Copy stdout 미보존과 Unit 실행시간대 NOT CAPTURED(명령TZoverride없음)를 유지한다. QA_FINAL/Owner/Manager ACCEPT는 NOT TESTED·MERGE_READY BLOCKED이며 새FullCI시작출처는게시후IssueSTATUS로연결한다.
