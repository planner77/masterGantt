# Issue #822 — Grid·Chart Ctrl+휠 세로 밀도

## Issue Work Packet

- repository: `planner77/masterGantt`; issue: [#822](https://github.com/planner77/masterGantt/issues/822)
- baseline_sha: `dc8543f390616c0d5aca90a4f91899f3cf7ac5da`; baseline_branch: `main`; baseline_version: `0.135.4`
- branch: `feat/issue-822-gantt-density`; worktree: `/home/planner/Dev/masterGantt-822`
- lifecycle_phase: PR_CI_START_READY / LOCAL_SELECTED_PASS / PREPR_BLOCKED
- requested_scope: 분석·계획·구현·로컬 검증·문서 동기화·미해결 리뷰/충돌 처리·Ready PR Full CI 시작. CI 모니터링·병합·Main/GHCR·Release/Finalizer·Issue 종료 제외.
- authorization: 2026-10-27 사용자 구현 요청이 이슈 등록 당시의 설계 전용 범위를 확장한다.
- current_version: `0.136.0`; version_decision: MINOR(사용자 조작 가능한 신규 표시 기능); 원격 tag 미존재 확인.
- release_required: true; release_authorized: false. 버전 후보 생성은 정식 게시 승인이 아니다.
- risk_level: HIGH; risk_reason: 전체 Gantt 가상행 geometry·진행률 hit-test·projection receipt·viewport 입력 우선순위 교차 변경.
- qa_method: OWNER_MANAGED; qa_required: true
- reviewer: 실제 별도 read-only `/root/qa_822` source 사전검토 PASS; 최종 문서 및 원격/Owner gate는 별도; independent_qa: N/A(Owner-managed 최종 경로). Sub-Agent 사전검토는 인간 APPROVED가 아니다.
- manager_decision: NOT TESTED; MERGE_READY: BLOCKED. 최신 Head의 Required3·Trusted·Owner 위험 수용/명시 승인 전 병합 불가.
- ownership: ui_ux=read-only 설계; frontend=`src/features/gantt/**`·Summary/native Task E2E·Unit; 별도 frontend=`project-gantt-scale.spec.ts`·`project-task-hover-tooltip.spec.ts`의 scope/filter/Shift·tooltip 회귀; Manager=버전·문서·증거·통합; qa_docs=read-only 사전검토; infra=exact density producer의 개발용 Pre-PR 매핑/회귀·원격 branch/PR/CI 시작.
- issue_comment_writer: Manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION
- next_handoff: 구현·선별 Local Fast Feedback → DOCUMENTATION_SYNC → 독립 사전검토 → 리뷰/충돌 재확인 → Ready PR Full CI 시작.

## 분석 및 설계

선행 #816의 fine34px/coarse44px, #375 Summary60%, #818 활성 진행률 stacking과 #637 같은 Task의 Grid/Chart Y 중심 오차≤1px를 보존한다. 설치 React Core는2.7.3/transitive gantt-store2.7.2, Next16.4.2다. 공식 [cellHeight](https://docs.svar.dev/react/gantt/api/properties/cellheight/)는 양쪽 행 geometry를 소유하며 [zoom](https://docs.svar.dev/react/gantt/api/properties/zoom/)은 수평 날짜축 기능이다. [Willow demo](https://docs.svar.dev/react/gantt/samples/#/base/willow) URL 조회는 실제 demo 조작 증거가 아니다.

fine34/32/30/28px 단계와 Grid 본문 글꼴14/13.3/12.6/12.04px를 사용한다.28px 하한은 실제 geometry·가시 행 증가·native leaf 조작·Summary/checkbox/inline 검사로 확인하며 최종 동결 source 결과는 아래 기록한다. 명시12px 보조 제어는 최소 크기를 유지한다. `(pointer:coarse)` 또는 `(any-pointer:coarse)`인 터치·혼합 장치는44px 단일 프로파일로 clamp한다. 저장/복구 잠금·포인터 드래그 중에는 대상 Ctrl+휠만 소비하고 밀도 변경을 보류하며44px 터치 안전 전환은 유지한다. 별도 버튼·전역 글꼴·서버 설정·브라우저 영속화는 도입하지 않는다. Day/Week·scope/filter·fullscreen·대시보드 왕복은 같은 ProjectGantt의 로컬 밀도 상태를 사용한다.

Gantt root의 native capture/non-passive wheel만 Grid/Chart 본문에서 Ctrl 입력을 소유한다. header/toolbar·입력·contenteditable·dialog/menu/popover는 제외한다. 일반 휠과 외부 Ctrl+휠을 보존하고 대상 Ctrl+휠은 경계에서도 browser zoom/수평 zoom 중복을 막는다. deltaMode는 pixel그대로/line×16px/page×100px로 환산한다.60px누적 임계값에서 정수 한 단계,250ms유휴/방향반전 시 잔량 초기화,RAF당최대1단계와cleanup을 사용한다.

기존 단일 viewport coordinator/port에 밀도 변경의 typed intent를 연결한다. 변경 전 실제 Task ID/본문 내 Y offset을 저장하고 변경 후 공개 cellHeight와 새 projection 관측 결과의 실제 row rect를 사용한다. 직접 scrollTop writer·oldTop×행높이 배율·TASK_REVEAL(날짜 X 이동 가능)·key remount·private state 쓰기는 금지한다. 새 사용자 입력·문맥 변경이 오래된 복원을 취소한다. 밀도 변경은 새 layout 관측을 요구하며 기존 receipt를 무조건 재사용하지 않는다.

Design Delta B: 기존 workspace-first·system font·native interaction·44px 터치·semantic token 원칙의 화면별 적용. DESIGN/AGENTS의 공통 규칙 변경은 N/A다.

## Gantt 표준·상태 소유권

- gantt_standard_version: `GSC 1.0.0-candidate`, 문서 상태 `REVIEW_PENDING` 유지.
- standard_read_commit: `dc8543f390616c0d5aca90a4f91899f3cf7ac5da`; `GANTT_STATE_CONSISTENCY.md`, `GANTT_STATE_CONFORMANCE.md`, `GANTT_ADAPTER_ADR.md`, `GANTT_SYNC_TRACE.md` 및 현행 `GANTT_STATE_REMEDIATION.md` 확인.
- 적용 GSC:01(표시/write0),02(실제 Core 검증 및 no-op),04(단일 writer),05(날짜축·밀도 geometry·X/Y 분리),06(밀도 layout 재관측),07(새 입력 취소),08(실제 SETTLED),09(instance/선택/focus),10(Core2.7.3 공개 API),11(누적/환경별 증거),12(이 Packet/독립 검토). GSC03의 mutation 복구 authority는 기존 Reconciler가 유지한다.
- 상태/쓰기 영향: ProjectGantt는 로컬 density 및 MediaQuery/state·wheel ingress만 소유한다. 기존 Canonical Reconciler는 Task/tree/order/link·revision을 계속 소유한다. native `cellHeight`는 Grid/Chart row geometry를, 기존 Projection observer는 새 layout receipt를 소유한다. 기존 Viewport Coordinator/port만 `DENSITY_ANCHOR`의 X/Y 쓰기를 소유하며 Core/native settle·신규 입력/문맥에 따른 폐기를 확인한다. native 일반 wheel·selection은 Core 소유다. 두 번째 scroll writer·private Store·밀도 서버 저장은 없다.
- exception_adr: N/A(공개 cellHeight 및 기존 등록 port로 처리; 표준 허용오차·writer 예외 신설 없음). 기존 버전 한정 axis compatibility의 승인 범위를 확대하지 않는다.

| 시나리오 | #822 선정·제외 및 증거 경계 |
| --- | --- |
| SC-01 | 기존 no-op/canonical Unit KEEP_UNIQUE. 밀도는 새 layout 의미이므로 이전 receipt 재사용 금지; 동결 source 검증 결과는 아래 기록. |
| SC-02~05 | 기존 DnD/날짜/구조 거부·uncertain 복구 유지. 최소/중간 native Task mutation 인접 검증을 선정하고 모든 실패 응답 조합 재실행은 원격 Full에 위임, 로컬 전체 PASS 주장 금지. |
| SC-06 | Calendar 계산/저장 변경 없음. 기존 Unit 유지; 밀도만 fresh layout 관측, Calendar-only 전체 E2E는 원격 Full. |
| SC-07 | density anchor의 새 receipt·API/query/입력 stale 취소를 기존 coordinator Unit·실제 browser로 검증. |
| SC-08 | empty/filter0 기존 계약 유지. 밀도 입력이0행에서 서버/날짜 범위를 변경하지 않는지 인접 회귀 및 Full에 연결. |
| SC-09 | 새 typed density intent와 wheel·범위 확장/신규 입력의 우선순위 검증. 기존 axis 전체 고유 회귀 KEEP_UNIQUE. |
| SC-10 | scope/filter 전환·조건 해제의 밀도 유지 및 새 사용자 의도 우선 검사, 기존 bookmark 음성 보존. |
| SC-11 | 대시보드 왕복·pending restore·같은 instance/선택/scroll 상태 검사. Resource/Calendar/Export 모든 왕복 조합은 로컬 미실행 시 NOT TESTED. |
| SC-12 | 각 밀도 Day/Week·fullscreen·5폭·Grid/Bar Y≤1px·날짜X/폭·column 보존을 선정. Marker-OFF 유지. |
| SC-13 | Milestone 표시/Copy/관계/상세 writer 변경 없음; 기존 marker-OFF/canonical Unit과 Full 회귀 유지, marker-ON 기술 검증 제외. |
| SC-14 |128행 가상화·연속 입력/cleanup 선정.1000Task+2000Milestone 장기 mount/unmount·실기기 성능 전체 실증은 NOT TESTED,128행 선별 성공으로 대체하지 않음. |

## AC_TEST_COVERAGE

- AC1: density 순수 단계/clamp Unit 및 기존 scale E2E EXTEND. Grid/Chart 각 실제 Ctrl wheel-down/up·공유 상태·baseline 상한 검사. 구현/실제 실행 결과는 아래 검증 기록으로 인계한다.
- AC2: 같은 wheel 사례에서 일반 휠·외부 Ctrl wheel·header·inline/input/dialog 비대상과 browser/time zoom 중복 방지를 검사한다.
- AC3: 동일 source·fixture·DPR/locale·1440×900 이상에서 기본→최소→기본 row/font/Task·Summary visual/가시 행/overflow를 DOM 계측하고 증거를 보존한다.
- AC4: 각 단계의 동일 ID Grid/Chart 중심≤1px, Summary ratio0.55~0.70, 날짜 X·폭·scale·scrollLeft 불변. 기존 projection의 고유 음성/회복 검증을 KEEP_UNIQUE한다.
- AC5: 최소/중간 native progress·move/resize·인접 우클릭·선택/Shift·inline·tooltip·dependency·focus·readonly 회귀를 기존 Summary/Task/selection spec과 연결한다. 실행하지 않은 조합은 NOT TESTED다.
- AC6: 80+ 가상행·접힘/filter/scope·Day/Week/fullscreen/peer 왕복·pointer 전환 시 같은 instance/API·선택/tree/column·scroll anchor·SETTLED·canonical write0 및 연타/잔여 listener를 검사한다.
- AC7: 390/768/1024/1440/1920 폭·장문 한/영·fine/coarse/혼합·keyboard/reduced-motion 및44px 목표 비중첩. 실제 터치 하드웨어/OS browser zoom/screen reader는 별도 NOT TESTED다.
- AC8: PROJECT_UX·표시 단위 사용자 안내·TEST_PLAN·버전/CHANGELOG·PLAN 및 이 Packet 동기화. 실제 결과·실패와 미실행을 분리하며 원격 Required3/Trusted/Owner는 CI 시작 시점 NOT TESTED다.

## TEST_LIFECYCLE_REVIEW

- 검색: `tests/scripts/prepr-verifier.test.ts`·`scripts/prepr-core.mjs`, `project-gantt-scale.spec.ts`, `project-summary-bar-visual.spec.ts`, `projection-row-alignment.spec.ts`, `project-task-delete-context.spec.ts`, `project-task-hover-tooltip.spec.ts`, `project-chart-vertical-dnd.spec.ts`, `project-gantt-fullscreen.spec.ts`, viewport coordinator/port Unit.
- EXTEND: 기존 scale/Summary/projection/viewport의 fixture·관측·native 조작을 재사용해 runtime density 입력과 geometry를 검사한다.
- ADD: 기존 고정 프로파일에 없는 deltaMode·누적·방향 변경·clamp·밀도 anchor arbitration의 순수 Unit.
- EXTEND: 개발용 Pre-PR의 exact density helper HIGH producer 매핑 및 positive/unknown-sibling 음성 검증. 기존 fail-closed UNKNOWN·Required 범위 유지.
- KEEP_UNIQUE: #816 coarse 실제 tap, #818 raw target/native HTTP·SQLite, #637 strictY 음성/회복, tooltip·selection·canonical/권한 경계. 제목 유사성을 삭제 근거로 사용하지 않는다.
- PARTIAL_OVERLAP: Summary visual과 projection Y는 독립 시각/정합성 경계다. CONSOLIDATE_CANDIDATE/RETIRE_CANDIDATE 없음. skip/assertion/timeout/retry·Required3/Chromium8 정책 변경 없음.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_822.md`: UPDATED
- `docs/ISSUE_822_FAILURE_ANALYSIS.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/ISSUE_35_GANTT_SCALE.md`: UPDATED
- `docs/LOCAL_PREPR.md`: UPDATED
- `docs/evidence/issue-822/local-validation.json`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED
- `DESIGN.md`: N/A(Delta B: 기존 시각 원칙 적용; 화면별 밀도/입력/터치 규격은 PROJECT_UX에 기록)
- `AGENTS.md`: N/A(기존 역할·작업/QA/승인 정책 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 focus·touch·responsive 원칙 적용; 새 공통 interaction 정책 없음)
- `docs/ARCHITECTURE.md`: N/A(기존 단일 viewport coordinator/port 안의 typed intent 확장; 새 writer·경계·의존성 없음)
- `docs/GANTT_STATE_CONSISTENCY.md`: N/A(기존 canonical/projection·single writer·receipt/입력 우선 계약 적용)
- `docs/GANTT_ADAPTER_ADR.md`: N/A(공개 cellHeight 및 기존 port의 typed intent 사용, 새 표준 예외·전략 채택 없음)
- `docs/GANTT_SYNC_TRACE.md`: N/A(기존 정제 trace·bounded 관측·run/source 귀속 규격 적용)
- `docs/GANTT_STATE_CONFORMANCE.md`: N/A(기존 SETTLED·strictY≤1px·음성 회복 기준 유지)
- `docs/API.md`: N/A(서버 API/DTO·Origin/session/revision 불변; 표시 조작은 write0)
- `docs/DB_SCHEMA.md`: N/A(schema/migration·영속 데이터 변경 없음)
- `docs/SECURITY.md`: N/A(authorization·Secret·보안 정책 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정/Calendar/Dependency 계산 변경 없음)
- `docs/CI_CD.md`: N/A(개발용 exact producer 영향 매핑만 추가; Required3·8-shard·GHCR·Release 권한/워크플로 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(로컬 영향 매핑은 원격 증거를 대체하지 않으며 기존 exact Head/Base/Test-Merge·Run/Attempt 검증 적용)
- `docs/GITHUB_OPERATIONS.md`: N/A(canonical Refs·리뷰/충돌·운영 gate 적용, 정책 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 phase·검증·Owner 승인 경계 적용)
- `docs/QA_REVIEW_POLICY.md`: N/A(현행 Owner-managed 및 별도 승인 규격 적용)
- `docs/DEPLOYMENT.md`: N/A(Docker/Compose·운영 배포 변경 없음)

실패·교정과 잔여 위험은 [단일 검증 원장](../../ISSUE_822_FAILURE_ANALYSIS.md)에 보존한다.

## 검증 기록 및 남은 범위

[정제 실행 보고서](../../evidence/issue-822/local-validation.json)는 제품·test·script 13개 파일의 SHA, 실제 명령·시작 시각·종료 코드·케이스 수, 보고서 SHA와 source fingerprint를 보존한다. 환경은 WSL2/Linux, Node22.14.0/npm11.10.0, Playwright1.63.0 관리 Chromium(override 없음)이다. 실제 HTTP/SQLite와 mock-backed API 검사를 구분하며, 복사한 node_modules의 npm ls PASS는 원격 frozen npm ci/audit PASS가 아니다.

| 구분 | 실제 결과 | 판정 경계 |
| --- | --- | --- |
| Pre-PR fast |10개 명령 exit0: Unit3350 PASS/기존3 SKIP, type/lint 및 production build 포함|총괄 BLOCKED/exit1/sourceStable=false|
| Pre-PR targeted 최종 |11개 Unit 파일312 PASS, 17spec Chromium137 PASS/0FAIL/0SKIP; workers1/retries0|총괄 BLOCKED/exit1/sourceStable=false|
| 제품/test/script 지문 |실행 시작 전과 종료 후13개 파일 SHA가 모두 동일|workspace 전체 fingerprint PASS는 아님|
| 실제 geometry |1440×1000/DPR1/en-US; row34/32/30/28, font14/13.3/12.6/12.04, bar27/25/23/21, 가시18/19/21/22|[화면·수치](../../PROJECT_UX.md#issue-822--ctrl휠-세로-밀도-조절)의 동일 fixture 범위|
| 가상행 anchor |canonical129/native WBS128의 id57 offset360px, 6단계 전환에서 정확히 유지|oldTop 배율 보정 없음|
| 독립 사전검토 |실제 qa_docs source/정밀 매핑/음성 검토 PASS, focused175 Unit PASS(3350의 부분집합)|최종 인간 QA/Trusted/Owner/Manager ACCEPT는 아님|

fast의 Next build와 targeted의 Next dev/격리 HTTP 서버가 추적된 AGENTS heading·next-env.d.ts·tsconfig.json에 생성 타입/출력 경로를 기록했다. 기존 E2E는 역사적 issue528/issue463/issue258의 PNG·geometry 출력도 갱신했다. 이 원본을 `/tmp/issue822-generated-artifacts`에 보존한 뒤 해당 추적 파일을 baseline bytes로 복원하여 커밋에서 제외했다. sourceStable=false를 Next 생성 파일만의 차이로 한정하지 않는다. 생성 설정도 baseline bytes로 복원했으며 fingerprint 검사를 완화·ignore하거나 총괄 PASS로 바꾸지 않았다. 초기 선별 실행7PASS/1interrupted/129NOT RUN과 과거8case/geometry 단독 실행은 [누적 원장](../../ISSUE_822_FAILURE_ANALYSIS.md)에서 최종137과 구분한다. 단위/브라우저 검사를 중복 합산하지 않는다.

최종137개에는 밀도별 native Summary 진행률0/50/100·endpoint/숫자 hit, leaf의 실제 HTTP/SQLite move/resize/progress34/32/28, scope/filter/Shift 선택·접힘/열/inline 취소, 5폭·reduced motion·독립 hybrid44px/인접 목표 비중첩·mutation 대기·지속/취소·엄격한 Y 음성/회복이 포함된다. 실제 터치 기기·OS browser zoom·screen reader·장기1000Task+2000Milestone·전체 조합의 수동 UX는 NOT TESTED다.

원격 Quality/Chromium8/Docker·Trusted/Owner·Manager ACCEPT는 NOT TESTED이며 MERGE_READY=BLOCKED다. Ready PR Full CI 시작만 확인하고 모니터링·병합·Main/GHCR·정식 게시·Finalizer·Issue 종료는 수행하지 않는다. 정확한 PR/Head/Base/Test-Merge/Run·Attempt와 리뷰/충돌 조회는 게시 후 Issue STATUS로 인계한다.

Rollback은 밀도 state/input/CSS·typed anchor intent·관련 테스트/문서 및 버전 후보를 함께 revert한다. DB/사용자 업무 데이터 이관은 없다.
