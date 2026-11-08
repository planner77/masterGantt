# Issue #889 / #890 — 일정 View 공통 표현·언어 복원 Work Packet

- Primary Issue: https://github.com/planner77/masterGantt/issues/889
- Related Issue: https://github.com/planner77/masterGantt/issues/890
- Baseline: main `ecc15d17`, application `0.145.0`, SVAR React Gantt Core `2.7.3`.
- Branch: `fix/issue-889-890-gantt-presentation`; PATCH 후보 `0.145.1`.
- risk_level: HIGH
- risk_reason: 동일 native Core의 locale 재초기화·열 복원과 조회 View/밀도/viewport의 비동기 상태가 교차한다.
- qa_method: OWNER_MANAGED
- qa_required: true
- release_required: true
- release_authorized: false
- manager_decision: NOT TESTED
- MERGE_READY: BLOCKED
- gantt_standard_version: 1.0.0-candidate / REVIEW_PENDING; read baseline ecc15d17.
- 적용 GSC: 01~12. canonical/Reconciler·Coordinator·현재 projection receipt·사용자 gesture lease 유지. 새 scroll/data authority·규범 예외 없음.

## 분석과 설계

DESIGN.md의 Light enterprise workspace·system font·semantic token·작업면 우선 원칙을 적용한다. 부모 Workspace 헤더/검색/필터를 이동하지 않는다. WBS를 기준으로 View·표시단위·전체화면과 동일 높이 상태 슬롯을 유지한다. 조회 전용·건수·다시 조회·loading/stale/error는 이 슬롯에서 제공하며 별도 상태 줄로 차트 시작점을 밀지 않는다. WBS 편집 명령은 조회 View에서 실행 불가하되 공통 제어의 위치를 보존한다.

조회 Grid는 native 열 id/order/width/hidden을 읽어 같은 열 예산으로 표현한다. 표시 헤더는 id에 연결된 고정 source key로 현재 locale에서 생성한다. native에서 이미 번역·정규화된 header 객체는 layout state로 복구하지 않는다. public set-columns/resize-grid/filter/open/select/viewport 경계에서 현재 locale·projection·gesture를 확인하며 Gantt remount/private store write/DOM 문자열 치환은 금지한다.

날짜축은 native WBS의 시작·폭·셀·2단 높이를 읽는다. Day 월/일, Week 달력 설명·ISO W## 및 휴일·근무일 의미는 기존 공용 formatter/tooltip을 재사용한다. date-only ordinal과 local calendar 경계를 구별한다. 원본 날짜/상태/진척률·가상 그룹/고유Task 집계를 변경하지 않는다.

Ctrl+휠은 frame 단일 owner에서 세 View의 Grid/Chart 본문만 받는다. 34/32/30/28px·coarse44px, 일반 wheel·input/menu/dialog/toolbar/header 제외를 보존한다. 저장/복구 잠금과 wheel burst lease, 해당 View의 row/date bookmark를 적용한다. 조회 View는 read-only이며 canonicalTaskId와 viewRowKey를 구별한다.

## 역할과 경계

Manager: toolbar/공통 density 통합·문서·Issue/PR 기록·최신 main 정렬/충돌·게시. ui_ux: 읽기 전용 설계. frontend locale: WBS 모든 column 복구/원본 identity helper. frontend panel: 조회 Grid/Chart/date/header/status·bookmark. 테스트 Agent: 기존 E2E 확장. qa_docs: 작성과 분리된 기술 사전검토. Agent 기술검토는 원격 Trusted QA/Owner exact Head 승인과 별개다.

종료점은 미해결 리뷰/충돌 처리 뒤 단일 Ready PR Full CI 시작이다. 이후 실행 결과 모니터링·병합/Main/GHCR/Release/브랜치 정리/Issue 종료는 범위 밖이다. 두 Issue는 열린 상태로 인계한다. 새 Head Required3/Chromium8/Trusted·Owner/Manager ACCEPT는 실행 전 NOT TESTED다.

## TEST_LIFECYCLE_REVIEW

EXTEND: `tests/e2e/i18n.spec.ts`의 native locale/layout·초안 보존, `tests/e2e/schedule-views.spec.ts`의 실제 HTTP/SQLite·다중경로·가상화·readonly·source freshness, 기존 density Unit. KEEP_UNIQUE: `project-summary-bar-visual.spec.ts`, `project-gantt-scale.spec.ts`, `project-gantt-fullscreen.spec.ts`, `projection-row-alignment.spec.ts`, `project-workspace-layout.spec.ts`, 기존 Coordinator/canonical/locale·selection Unit. ADD는 새 공용 header identity·date/geometry 반례만 사용한다. 삭제/skip/단언 축소/timeout·retry·CI Gate 변경 없음. 원본 실패와 개발 중 setup 오류는 단일 실패 원장에 구별한다.

## AC_TEST_COVERAGE

- AC01: #889 toolbar/header/split≤1px·View 왕복 geometry 및 #890 모든 고정 Grid header 왕복: schedule-views.spec.ts/i18n.spec.ts; 실제 실행 결과는 검증 절·실패 원장.
- AC02: #889 Day/Week 월·ISO W##/calendar header·date X 및 #890 세 View/Scale/Fullscreen 현재 locale: scale helper Unit + schedule-views/i18n/기존 scale·fullscreen; 미실행 조합은 NOT TESTED.
- AC03: #889 Task/group/80+행·Y 중심·readonly 및 #890 동일 API/열 layout/active sort/선택/scroll/초안·원본 쓰기0: schedule-views, i18n, summary-bar/projection/viewport 회귀.
- AC04: #889 세 View 양쪽 본문 density 방향·상하한·coarse·제외대상/anchor 및 #890 managed fallback/자유입력 원문: density Unit·실제 browser 기존 fixture. 실기기 touch/보조기기는 별도 NOT TESTED.
- AC05: #889 canonical/revision/권한/selection/filter/instance·쓰기0 및 #890 native header mutation 원인·현재 locale request 경쟁 검증: 실제 HTTP/SQLite schedule fixture, i18n/header Unit, 설치 package source·실제 브라우저 before/after 증거.
- AC06: #889 390/768/1024/1440/1920px·Day/Week·ko/en/vi·Fullscreen·loading/error/keyboard·문서 overflow: schedule-views/i18n/기존 responsive tests. native125%/실기기touch/최종수동UX는 실행 전 NOT TESTED.
- AC07: #889 기존 #822/#880 및 scale/fullscreen/grid/viewport 고유 회귀 보존과 새 Full Required Quality/E2E8/Docker: 로컬 선별 결과와 원격 CI를 구별하며 CI 시작 뒤 결과 모니터링 없음.

## DOCUMENTATION_SYNC

- `DESIGN.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/GANTT_STATE_CONSISTENCY.md`: UPDATED
- `docs/I18N_PHASE_C.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_889.md`: UPDATED
- `docs/ISSUE_889_890_FAILURE_ANALYSIS.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `AGENTS.md`: N/A(역할·승인·보호 정책과 지침 자체를 변경하지 않음)
- `docs/REQUIREMENTS.md`: N/A(요구 범위는 Issue889와890의 기존 AC를 그대로 적용하며 새 도메인 요구사항 없음)
- `docs/API.md`: N/A(기존 source GET과 Task/Editor/권한 DTO 및 서버 호출 계약 유지)
- `docs/DB_SCHEMA.md`: N/A(SQLite 테이블·migration·영속 데이터 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(schedule 명명 파일은 표시 adapter이며 Calendar Duration Dependency 알고리즘 변경 없음)
- `docs/SECURITY.md`: N/A(기존 서버 인증·Origin·session·revision 및 조회전용 경계 유지)
- `docs/IMPORT_EXPORT.md`: N/A(canonical WBS 데이터와 기존 SVG PNG Export 계약 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(JSON CSV Excel import schema 변경 없음)
- `docs/CI_CD.md`: N/A(버전과 lock 동기화만 수행하며 workflow·권한·Required3·E2E8·게시 정책 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 단일 canonical Issue Refs 및 Ready Full 절차 그대로 사용)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 출처 Run Attempt·Head base merge·Trusted/Owner 판정 계약 유지)
- `docs/QA_REVIEW_POLICY.md`: N/A(현행 HIGH Owner Managed·Trusted 및 별도 최종 승인 유지)
- `docs/exec-plans/active/UI_UX_ROLLOUT.md`: N/A(기존 대시보드·관리자 순차 개선과 별도인 일정 회귀 수정이며 실행 순서나 승인 정책 변경 없음)

## 검증 상태

최종 동결 source1339입력 SHA256 `9425e0521645433d958bc72952feed5618e892d48b2282887e493087a158b5e5`에서 Unit23파일491/491, Chromium8spec66/66, 실제 installed Core 기본 복구12/12 PASS다. Chromium 실패/skip/interrupt/retries0, worker1, 8.9분. 타입·변경파일 lint(오류0/기존경고2)·version·Markdown 링크 PASS다. [정제 증거](../../evidence/issue-889-890/local-validation.json)와 [누적 원장](../../ISSUE_889_890_FAILURE_ANALYSIS.md)을 따른다. 자동 Pre-PR mapping 판정은 별도 BLOCKED이며 수동 선정 PASS로 바꾸지 않는다. 로컬 PASS는 전체 원격 회귀 PASS가 아니다. 새 PR quality/e2e/docker/Trusted·Owner/Manager NOT TESTED, MERGE_READY BLOCKED. GHCR·릴리스 미실행/미승인.

## LOCAL_VALIDATION_SELECTION

자동 Pre-PR fast의 초기 결과는 UNKNOWN3(schedule-view-panel.tsx/.css·schedule-view-scale.ts) 및 실행 중 source 변경으로 BLOCKED/STALE다. 이것을 PASS로 바꾸거나 매핑 검증기를 완화하지 않는다. 수동 영향 선정은 다음 직접·인접·음성 소비자를 사용한다.

| 생산자 | 검증 소비자·남은 경계 |
| --- | --- |
| column ID/source header·locale public 복원 | viewport-coordinator/i18n-phase-a Unit, i18n native header·숨긴열·rapid/Day/Week·현재locale 및 workspace timezone E2E; arbitrary 사용자 문자열 원문 보존 |
| 공통 toolbar·density 입력/guard | gantt-density/Coordinator/axis/state-harness Unit, summary-bar-visual·scale/fullscreen·projection-row-alignment·viewport E2E; input/header/ordinary wheel·상하한·coarse 음성 |
| projected panel TSX/CSS/source | 실제 HTTP/SQLite schedule-views E2E의 원본/권한·revision·쓰기0·다중경로·85Task/가상행·source 실패/응답역전·선택/Editor/bookmark·5폭·narrow chart hit |
| projected scale helper | schedule-view-scale/week-calendar-interval/day-header-tooltip Unit의월/주/ISO년·DST/timezone·예외/공휴일, 실제Day/Week bar X/header·tooltip E2E |
| package/lock | version값만0.145.1로동기화, dependency/engine/script/pin 불변. npm ci frozen install·version check/type/lint·관련Core Unit을 실행하며 전체Build/audit/Docker/8 runner는새Head원격Full에서검증 |

로컬 자동 도구의 UNKNOWN은 별도 BLOCKED로 남기고 수동 선별 실제 PASS와 혼동하지 않는다. 변경 없는 server/DB/API·도메인 일정 알고리즘은 로컬 전체suite 재실행 범위에 넣지 않으며 원격Full Required3를 생략하지 않는다.

## 검증 범위의 제한

최종 선별 66case는 5폭×Day/Week×3View의 공통 geometry, 양쪽 본문의 fine34↔28px, 기존 WBS coarse44px 실제 tap/drag, WBS 언어 왕복과 Resource Day·설비 Fullscreen의 현재 언어를 검사한다. 이 결과만으로 모든 언어×모든 폭×모든 View/Scale/권한 상태의 전조합이나 projected44px 실제 터치 전체 조합을 PASS로 선언하지 않는다. native125%·실기기touch·실제AT·최종수동UX·전체8runner 비용은 별도 NOT TESTED다. 실제 source/명령/결과는 최종 검증 증거에 연결한다.

## 최종 사전검토 REWORK — active sort (#890)

최초 동결 8spec/65 PASS는 sort descriptor 보존 AC를 검사하지 않아 최종 승인 근거로 충분하지 않다. 실제 native 작업명 header 정렬 후 KO→VI에서 row 순서가 초기화되는 P2를 확인했다. public getState의 active sort descriptor를 표시 snapshot에 복사하고, 기존 locale/projection/사용자 gesture lease로 public sort-tasks를 재생한다. 원본 sibling order와 사용자 표시 정렬을 구별하고 최신 정렬/입력이 오래된 복원보다 우선하도록 검증한다. PR 게시/Ready Full 시작은 보완·새 source 회귀·독립 기술재검토 이후로 보류한다.

## active sort 최종 설계와 검증

정적 조사에서 tree만 정렬된다고 가정했으나 실제 public Core 실행은 serialize(tasks/tree) 모두 표시 순서로 바뀌었다. 현재 구현은 복구 계획용 원본 strict reader와 승인용 reader를 분리한다. 승인 reader는 canonical Task/parent/ID/Link·owned payload와 독립 계산한 정확한 표시 순서를 검증한 뒤 서버 권위의 canonical 순서로만 정규화한다. raw/approved는 순서 외 동일 컬렉션이어야 한다. 정상 정렬은 no-op/native move0이며 실제 drift는 기존 raw 계획으로 복구하고 public sort를 재생한 뒤 같은 권위로 다시 검증한다. optional hook을 주지 않은 기존 복구 경로는 유지한다.

서버 내부 ID를 알 수 없는 동률 siblingOrder를 client UUID로 추정하거나 원본 데이터 순서를 임의 재구성하지 않는다. 별도 B안의 source rank 추론/새 native 순서 witness는 채택하지 않았다. 날짜·기간 sort comparator만 기존 Task generation snapshot의 스칼라를 읽으며 locale 표시 getter와 분리한다. 상태 복원은 현재 API·canonical/projection·sort epoch·최신 사용자 입력 lease를 지킨다. API 변경이나 stale await, duplicate approved IDs·payload rewrite·잘못된 표시 순서에는 승인하지 않는다.

별도 qa_docs가 Week/Day·Fullscreen 진입/종료·Resource/WBS·설비/WBS 6전환에서 같은 API/정렬과 latest delivery SETTLED·새 receipt, recovery.changed=false를 확인했다. 추가 reactive `_sort` owner는 필요하지 않아 도입하지 않았다. 현 reader/recovery의 actual installed Core 12시나리오와 source8파일 해시 시작/종료/현재 일치는 [현재 receipt](../../evidence/issue-889-890/current-core-recovery-receipt.json)로 보존한다. 옛 U2 source/hash/관측은 원래 snapshot mapping으로 불변 유지한다. 전체 최종66case는 원격 Full과 별도로 로컬 동결 검증하며 결과는 아래 최종 증거에 갱신한다.

## 최종 증거와 게시 경계

- [최종 Chromium66](../../evidence/issue-889-890/e2e-verification.json), [active sort fresh receipts](../../evidence/issue-889-890/active-sort-receipts.json), [공통 geometry/density](../../evidence/issue-889-890/shared-shell-density-geometry.json), [390px 실제 bar 클릭](../../evidence/issue-889-890/narrow-scroll-geometry.json).
- [Core12 현재 runtime](../../evidence/issue-889-890/current-core-recovery-runtime.json) / [source8파일 receipt](../../evidence/issue-889-890/current-core-recovery-receipt.json), [독립6전환](../../evidence/issue-889-890/qa-sort-transitions.json).
- [설비1440](../../evidence/issue-889-890/equipment-1440.png), [설비390 차트 도달](../../evidence/issue-889-890/equipment-390.png), [VI390 전체 선택 도움말](../../evidence/issue-889-890/wbs-copy-help-vi-390.png).

기록된 raw source의 Next UUID include14행은 생성 자료이며 다른 tsconfig 필드는 HEAD와 같았다. 생성 tsconfig/next-env를 원복한 뒤 raw/정규 source 모두 위9425e052...와 같음을 확인한다. 원본 복구48 Unit 예산·기존 고유 E2E·CI Required3/Chromium8·권한·Ruleset을 유지했다. 실제 별도 Agent 설계/구현/테스트/qa_docs 기술검토를 수행했으며 Owner-managed 독립 인간 QA는 N/A(미선택), 원격 Trusted QA/Manager ACCEPT는 NOT TESTED다.

이 커밋은 게시 직전 증거 snapshot이다. 정확한 게시 Head·PR·base/test-merge·Full Run/Attempt 및 commit 기술검토는 Issue STATUS/PR 메타데이터로 기록한다. CI 시작 뒤 증거만 갱신하기 위한 추가 push/PR body edited를 하지 않고 결과 모니터링 없이 종료한다. 작업 브랜치와 두 Issue는 열린 상태로 인계한다.

## 최종 자동 Pre-PR와 수동 매핑

최종 fast는 sourceStable=true / selected36 / UNKNOWN6 / MISSING0 / 실행명령0으로 BLOCKED다. [요약](../../evidence/issue-889-890/prepr-final-summary.json)을 보존하고 자동 PASS로 바꾸지 않는다. UNKNOWN product-consistency.ts는 Product/CoreReader/Conformance/Projection/Recovery Unit과 actualCore12·fresh-sort66으로 검증했다. UNKNOWN panel TSX/CSS·scale helper는 실제HTTP/SQLite schedule7·5폭Day/Week·readonly/source실패/가상화·locale/density/수평도달/tooltip과 공용formatter Unit으로 검증했다. UNKNOWN historical provenance JSON·original reader snapshot은 원본SHA/bytes/관측 불변을 독립 확인하고 runtime/manifest/Pre-PR guard Unit 및 새 actual12로 구분 검증했다. 검증기 mapping이나 보호 gate·테스트를 낮추는 변경은 없다. 이 수동 매핑의 실제 PASS와 자동 mapping BLOCKED를 구별해 인계한다.

## PR #894 CI #3570.1 실패 교정 — #574 입력 우선권과 U4 합성 축 실측 (2026-11-08)

- **현상·근거:** [원본 Full PR #3570.1](https://github.com/planner77/masterGantt/actions/runs/42443918977) / Chromium Shard 3: #574 V3의 명시적 미래 Task 선택이 `NO_SCROLL_CAPACITY`로 종료. 원본 artifact `13602019155`에는 `FILTER_RETURN SUPERSEDED`, 최신 `TASK_REVEAL PREPARING_GEOMETRY`, U4 `FAILED/COMMAND_REJECTED`와 실제 native scrollWidth `2176→3060`가 동시에 기록된다. 원본 실패는 [누적 원장](../../ISSUE_889_890_FAILURE_ANALYSIS.md)의 CI-3570-001에 고정하며 원격/로컬 기존 PASS를 새 source로 승계하지 않는다.
- **설계 결정/GSC-02,05,06:** 설치 SVAR 2.7.3에서 public exec 반환값 자체는 viewport 성공 증거가 아니다. 동일 Coordinator lease의 기존 synthetic Axis Transaction 내 두 resize + 원래 X/Y 보존 scroll의 `false`를 *성공 아닌 미확정*으로 취급하고, 단일 U4 facade의 실제 axis/geometry/capacity/Core/native 세 프레임 증명만으로 `SETTLED` 판정한다. 축 변경 무효·원본 lease 무효·실측 부족은 fail-closed, source taint/예산·기존 date bound/일반 scroll reject 불변. `axis-transaction.ts`의 callback false 거부와 Coordinator·timeout/기존 assertion은 변경하지 않는다.
- **TEST_LIFECYCLE_REVIEW:** EXTEND 기존 `svar-viewport-port.test.ts`에서 effective-but-false와 no-effect-but-false·일반 scroll 실패의 독립 양성/음성 검증. KEEP_UNIQUE 기존 `grid-task-start-reveal.spec.ts` #574 V3 실브라우저 strict contract. 신규 중복 E2E·기존 test skip/retry/timeout 완화 없음.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_889_890_FAILURE_ANALYSIS.md` append, `docs/GANTT_ADAPTER_ADR.md` U4 observed-response exception, 본 Work Packet 갱신. `AGENTS.md`/DESIGN.md/API/DB/CI 워크플로는 기존 계약 변경 없으므로 수정 없음.
- **인계/범위:** 원본 CI 직접 실패는 확인, 동일 수정 source의 Unit/Chromium/typecheck/새 Full/Trusted/Owner 판정은 새 실행 전 **NOT TESTED**. `MERGE_READY=BLOCKED`, `release_authorized=false`; 사용자 요청에 따라 branch push로 신규 PR CI만 트리거하고 모니터링/병합/게시/종료하지 않는다.

## PR #894 CI #3571.1 추가 교정 — 승인 시점과 지속 권한 분리 (2026-11-08)

[원본 #3571.1](https://github.com/planner77/masterGantt/actions/runs/42445304959)의 #574 V3는 기존 #3570 교정 HEAD `14a76cef`에서도 같은 `NO_SCROLL_CAPACITY`/U4 `COMMAND_REJECTED`가 재발했다. 세부 Trace/원인/회귀 소비자 및 실패를 [누적 원장](../../ISSUE_889_890_FAILURE_ANALYSIS.md#ci-3571-001--ci-3570-후속-교정의-한계와-synthetic-readiness-self-invalidation-2026-11-08)에 원본과 분리해 기록한다.

U4 axis 요청 최초 admission에서 `canChangeAxis`는 유지하되, 자기 자신의 synthetic resize와 scroll로 인해 일시적으로 변할 수 있는 projection read-ready/scale 관측을 동일 작업의 지속권한에 중복 사용하지 않는다. 지속권한은 원래 Coordinator intent/gesture/context 및 Project revision에 귀속한다. 트랜잭션 완성은 여전히 기존 Axis Transaction의 실제 축/물리용량/원본 위치 3frame과 post-prepare fresh projection receipt를 통해서만 승인한다. 기존 테스트/CI 게이트/축 허용·취소 조건을 완화하지 않는다. 신규 Unit은 임시 준비미흡 시 정상 정착과 최신 user source 취소를 쌍으로 검사한다. 자체 E2E 전체 결과와 최종 Owner/Trusted 검증은 다음 Full 전 **NOT TESTED**, 이번 작업 범위는 새로운 PR CI 시작까지다.
