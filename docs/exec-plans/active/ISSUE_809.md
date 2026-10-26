# Issue #809 — Resource 차트와 정확 근거 탐색

## Issue Work Packet

- repository: `planner77/masterGantt`
- issue: [#809](https://github.com/planner77/masterGantt/issues/809); parent [#806](https://github.com/planner77/masterGantt/issues/806), 선행 #807/PR #810 및 #808/PR #811·#812
- lifecycle_phase: LOCAL_PRE_QA_DOC_SYNC_PASS / PR_CI_READY
- requested_scope: 분석·설계·구현·관련 문서 갱신·미해결 리뷰/충돌 확인·교정·누적 실패 원장 기록 후 Ready PR Full CI 시작. CI 결과 모니터링·병합·Main/GHCR·tag/Release·Finalizer·cleanup·Issue 종료는 제외한다.
- baseline/main: `56a094b797300a554909cd8d81ef0bafe46d6def`
- branch/worktree: `feat/issue-809-resource-charts`, `/home/planner/Dev/masterGantt-809`
- current_version: `0.134.0`; candidate_version: `0.135.0`
- version_decision: 사용자에게 새 분석 차트와 원본 상세 탐색을 제공하는 호환 기능이므로 MINOR. package/lock version을 동기화하고 dependencies는 유지한다.
- release_required: true
- release_authorized: false (사용자 범위는 PR CI 시작까지이며 정식 게시 미승인)
- risk_level: HIGH
- risk_reason: 서버 조회·분석 provenance·개인 공수/Capacity·비가산 분류·정확 원본 탐색·다중 화면 비동기 복귀 및 package 보호 경로
- qa_required: true
- qa_method: OWNER_MANAGED (현행 #598 정책). 별도 Agent 사전검토와 최종 Trusted/Owner 승인 구분.
- independent_qa: N/A(최종 Owner-managed 경로); 별도 `/root/chart_qa`의 서버/feature 사전검토 및 복구 `/root/qa_recovery`의 r03-final feature·T0·브라우저/화면·문서 검토를 구분하여 기록
- manager_decision: NOT TESTED; MERGE_READY: BLOCKED
- documentation_owner: Manager
- issue_comment_writer: manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION

## 역할·소유권

| 실행 주체 | 소유 / 책임 |
| --- | --- |
| Manager `/root` | 요구·통합·문서·Work Packet·실패 원장·version 결정·Issue 진행 기록 |
| ui_ux `/root/chart_design` | 읽기 전용 정보구조/interaction 설계 및 구현 비교 |
| frontend `/root/chart_implementation` → `/root/chart_recovery` | Resource 차트 UI/CSS·workspace 연결·관련 feature/browser 테스트·실제 화면 증거 |
| backend `/root/chart_source` | 기존 WBS query contract/validation·service opt-in 분석 seam·server 테스트 |
| qa_docs `/root/chart_qa` → `/root/qa_recovery` | 구현자와 분리된 읽기 전용 AC/code/test/docs 사전검토 |
| infra `/root/publication` → `/root/publish_recovery` | 최종 main/리뷰/충돌·remote 동등성·Ready PR·Full CI 시작 확인 |

동일 파일 동시 작성·타인 수정 되돌리기·재귀 위임 금지. 원 root의 미추적 자료는 별도 worktree로 보존한다. 런타임에서 실제 실행한 역할과 설정 모델 이름을 구분한다.

## 분석·설계

#807의 기존 기본 현황·동적 탐색·Milestone 교차·Plan·견적/Excel을 유지하고 동등 peer인 차트를 추가한다. 내부 유형은 기간 투입/업무 집중/기여 분포이며 한 번에 하나만 활성화한다. 기본 주·개인·M/D, 현재 범위→핵심 KPI→핵심 그래프→같은 데이터 표→원본 상세 순서다. 기존 semantic token·14px 전후 본문/12~13px 보조·4/8/12/16px spacing을 따른다. Design Delta B(기존 원칙 구체화)이며 새로운 전역 시각 규칙은 없다.

R2 `buildResourceAnalysis`는 서버 canonical ledger를 요구한다. 현 WBS report만으로 client 원장을 재구성하지 않고 기존 WBS query에 선택적 분석 입력·응답을 연결한다. 같은 read transaction의 정규 필터·projection Task/Assignment·별도 T0 진단·sourceContext/snapshot/revision/fetch generation에서 모델을 만들며 기존 예산을 유지한다. 차트별 독립 API·새 route·DB·저장 원장·산식·PRO 의존성을 만들지 않는다.

기간은 개인×주/월 계획/Capacity와 Load/Peak/개인 초과를 비교한다. Group 평균으로 개인 초과를 가리지 않고 선택80%·동일 개인 Project 전체140%는 별도 참고다. 집중은 개인/Group/Global Role/개발등급별 M/D·M/M·고유 Task 상태 순위, 분포는 Resource×Milestone 및 공정/WorkArea/설비/System이다. 중첩 분류는 비가산이며 full Milestone Gate는 선택 완료율과 분리한다. null/미설정/부분합/설정0·Capacity0·환산 미설정을 유지한다.

시각 막대와 원본 수치를 native button/동일 데이터 표에 제공하여 hover·색상에만 의존하지 않는다. 상세 전 source/snapshot/정확 ID를 재검증하고 기존 Task Editor/Gantt gateway·권한·If-Match·intent를 재사용한다. 닫기/Escape·일정 복귀는 출발 조건·선택·스크롤·focus를 보존한다. 정렬/Top N/페이지·기간 window로 DOM을 제한하고 좁은 폭의 표는 내부 스크롤을 소유한다.

SVAR 공식 samples/changelog는 ui_ux가 URL 조회했으며 Resource load/histogram은 PRO 범위다. 실제 demo 조작은 NOT TESTED이며 설치 Core2.7.3은 변경하지 않는다.

## AC_TEST_COVERAGE

- AC1: R3-AC1. 기존 R2 selector와 opt-in 서버 seam·3개 유형 UI·기간/개인 위험·집중 축·실물/Milestone 분포를 관련 server/feature 및 기존 `issue-736-resource-dashboard.spec.ts` 확장으로 검증한다.
- AC2: R3-AC2. 같은 source/snapshot/scope/unit·canonical Task/Assignment/Resource IDs·raw M/D/M/M/Task·Plan parity. 기존 R2 golden(선택80/Project140, partial/null/0/중첩 비가산)과 Excel 고유 oracle를 재사용하고 새 연결의 동일성을 검증한다.
- AC3: R3-AC3. 클릭/native Enter·Space/표 선택→정확 상세·일정·복귀, 늦은 응답/조건 변경·stale/error/readonly·401/412를 기존 host/fetch/HTTP 경계별로 검증한다.
- AC4: R3-AC4. 동일 fixture·source의 390/768/1024/1440/1920×900 실제 Chromium geometry·label/축/표·내부 scroll/문서 overflow·가시 행·keyboard/focus/reduced-motion을 확인한다. 실제 기기·screen reader는 별도 NOT TESTED다.
- AC5: R3-AC5. 기존 기본 현황/Plan은 차트를 열지 않으면 추가 차트 높이/요청이 없고 기존 KPI baseline을 유지한다. 같은 fixture before/after source/viewport와 관측 상태를 보존한다.
- AC6: R3-AC6. 아래 TEST_LIFECYCLE_REVIEW·문서 동기화와 독립 사전검토. 기존 Required3·8-shard·테스트 삭제/skip/timeout 완화 없음.

## TEST_LIFECYCLE_REVIEW

EXTEND: `tests/server/resources/wbs-dashboard-views-http.test.ts`·`tests/server/resources/issue-736-resource-adapter.test.ts`(같은 transaction·strict 입력·예산·Plan/OOXML golden 연결), `tests/features/resources/resource-wbs-dashboard-model.test.ts`(표시/순위·단위·부분합), `tests/features/resources/wbs-view-transport.test.ts`(같은 outer report 내부 분석 혼합/세대/조건 검증), `tests/features/resources/resource-drill-navigation-model.test.ts`(정확 Task/Assignment 부분집합·공동담당 음성), `tests/e2e/issue-736-resource-dashboard.spec.ts`(활성 차트·실제 정확 이동/복귀)에 새 연결만 추가한다. 기존 `resource-analysis.test.ts`·원장/Plan 기간/예산·Resource API/Excel OOXML·`resource-plan*`·`resource-excel-export-dashboard`·`cross-screen-regression`·#800 geometry helper는 KEEP_UNIQUE다. producer→consumer 및 실제 선정 파일/명령은 최종 diff와 실행 뒤 확정한다. 새 전체 E2E 복제·삭제/통합·skip·retry/timeout/Required/shard 약화 없음.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_809.md`: UPDATED
- `docs/ISSUE_809_FAILURE_ANALYSIS.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(Design Delta B; 기존 compact·flat·이름 우선·progressive disclosure 원칙을 구체화하며 전역 원칙/토큰 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(기존 read transaction 재사용; DDL/migration/저장 writer 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Calendar/Plan/공수 계산 재사용; 일정 알고리즘 변경 없음)
- `docs/SECURITY.md`: N/A(기존 public read·server session/Origin/If-Match 권한과 오류 경계 유지; 새 mutation/권한 수단 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(Import/교환 형식 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(기존 Excel writer/source 재검증 계약 유지)
- `docs/EXCEL_EXPORT.md`: N/A(기존 지원 source/scope·고유 OOXML 계약 유지; 차트만으로 새 workbook 형식을 만들지 않음)
- `docs/CI_CD.md`: N/A(workflow/권한/Required3/8-shard/Release 정책 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(현행 정책 적용·PR CI 시작까지만; 검증 기준 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(현행 trace/리뷰/Owner gate 적용; 정책 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(현행 lifecycle과 승인 범위 적용)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 Owner-managed·별도 사전검토를 구분하여 적용)
- `AGENTS.md`: N/A(기존 실행 지침 적용, 수정 없음)

## 검증·인계 상태

설계·구현·고유100case Local Fast Feedback 및 별도 source/범위 교차 검증, 최종 #809 browser·15차트/KEEP5·glyph·DOC_SYNC 의미 검토와 독립 LOCAL_PRE_QA는 PASS다. 중간 실패/교정/중단은 원장에 보존한다. 최종 source와 version-only0.135.0·자동 생성 설정 복원을 독립 대조했으며 원격 게시 전 ZIP/임시CLI/runtime 제외와 실제 리뷰/충돌 확인은 infra의 마지막 통제로 수행한다. 원격 quality/e2e/docker·Trusted QA·Manager ACCEPT는 NOT TESTED다. 리뷰/충돌 조회와 모든 실제 실패·교정은 [누적 원장](../../ISSUE_809_FAILURE_ANALYSIS.md)에 기록한다.

## 최종 기능 검증·재사용 경계

최종 기능 source는 `output/playwright/issue-809/product-freeze-r03-final.json`의551항목으로 동결했다. 서버5파일 hash는 최초/독립 검증과 같아 실제 HTTP/SQLite31 + Plan/OOXML9 + R2 Domain33의73/73 PASS를 재사용한다. 복구 독립 Reviewer가 최종 feature3suite27/27 PASS 및 원 T0 P2→정상 Task2/A0 인계·source/범위/원본scope/중복/배정 오인 음성11개 등 별도13체크를 실행했다. 고유 Vitest는6파일100case이며 이전25/26이나 반복 실행을 합산하지 않는다.

최종 #809 Chromium은551항목 source/test hash 실행 전후 불일치0에서1case57.8초 PASS(총 runner1.4분·exit0·retry0)다. 같은 유형 query 재사용·3시각·선택80/동일개인Project140·Editor·child/host scope 지연 취소·close focus lease/busy·390px scroll/focus·일정 왕복·역전/401/412·touch/reduced-motion emulation·개인조건 T0 원본/정확 일정 왕복을 포함한다. 이전31.2초/48.3초/1.1분의 중간 실행과 합산하지 않는다. 기존 #807 peer/Plan DOM·숨은 차트 공간0의52.4초 PASS와 기존 #736 Target0/Plan·Excel·412의51.5초 PASS는 해당 파일/분기의 비영향 분석으로 재사용하며 한 batch의3/3으로 표현하지 않는다.

원장에는 모든 최초 준비/관측/제품 실패·중단·미입증 가설 정정과 교정을 보존한다. 마지막 KPI CSS 외형은 r02 이후 변경하지 않았고 최종 기능 r03의 원본 변경은 T0 조회·검증 인계뿐이다. 최종15차트+5KEEP·glyph/문서 정합성·독립 사전검토는 아래 최종 마감 증거에서 별도로 판정한다. 실제 기기 touch·screen reader·native125%·production build/Docker/운영·Windows Excel/DRM은 로컬 미검증이며 공식 전체 회귀는 새 PR CI다.

## T0 명시 인계·비동기 수명 최종 계약

R809-006의 개인 조건 전 T0는 현재 개인 report 밖일 수 있으므로 현재 report의 subset guard를 우회하지 않는다. 명시 T0 일정 액션만 원 source를 먼저 재검증하고 개인7조건(resourceIds/groupIds/roles/developerGrades/search/resourceActivity/groupActivity)을 제외한 기존 WBS report를 조회한다. taskSearch·실효기간/asOf·Task/WBS/Milestone/실물·원 scope·M/D 기준/provided/source는 보존하고 새 analysis/granularity를 요청하지 않는다. 같은 Project/dataSnapshot/catalog/calendar·기간/환산 basis·정확 T0 허용 집합/새 scope의 부분집합을 확인한 뒤 새 report와 Task IDs/Assignment[]를 기존 host에 인계한다. ID 전체를200/400개 제한의 공개 필터에 밀어넣지 않고 원래 응답/body/root/cells 예산을 적용한다.

추가 await 뒤에도 mounted/current intent/actionGen/liveKey를 검사하며 rejection은 기존 catch에 모아 cache 폐기/stale 안내, finally는 현재 controller의 pending만 해제한다. 원조건/선택은 유지하고 실패·닫기·새 조건/의도 뒤 늦은 handoff를 금지한다. 같은 query/visit/revision/refresh의 확정 모델은 중복 fetch 없이 복귀 DOM을 보존하되 known-stale/오류/수동 refresh는 무효화한다. 별도 Gantt/스크롤/전역 focus writer를 추가하지 않는다.

## 최종 화면 검증·환경 경계

[차트15관측](../../../output/playwright/issue-809/after-final-r03/capture-manifest.json)과 [기존 기본 현황 KEEP5](../../../output/playwright/issue-809/keep-final/capture-manifest.json)는 각각15/15·5/5, fault0/sourceStable=true·현재 제품546hash와 동등하다. 같은 canonical revision17/Task 배열4/Assignment1(일반 작업 KPI와 별도)의 fingerprint 전후 동일·capture writes0·다섯 폭 document overflow0을 확인했다. 실제390 KPI glyph baseline은754.40625/754.40625 및846.40625/846.40625로 delta0/0, 공통 dd44px다.

기본 현황 before-final→KEEP의 KPI/table Y는3901017/1458,768670/958.5,1024578/799.5,1440/1920526/747.5로 모두 같고 완전 가시 표 행0/0/0/1/1도 같다. 새 차트의390 표 완전 가시행은0이며1440/1920도기간표1행·집중/기여표0행이다. 이 값은 표 범위의 측정이며 전폭 first-fold 데이터 가시 PASS로 과대표시하지 않는다. 긴 표·기간은 내부 scroll/window를 사용한다.

실제 브라우저 runtime0.134.0을 before/after/KEEP에서 유지했고, 게시 후보0.135.0은 관측 후 package/lock version-only 변경으로 분리한다. 원격 frozen install/build/전체 Vitest/E2E/Docker·Trusted/Owner/Manager는 새 exact Head CI에서 확인해야 한다. 실제 기기 touch·screen reader·native125%·운영/Windows Excel·DRM은 NOT TESTED다. 로컬 환경/명령/source hash·실패/중단은 frontend/QA 영수증과 원장을 따른다.

## 최종 정적 검증·version-only 인계

[Frontend 영수증](../../evidence/issue-809/frontend-validation.json)에 최신551항목 동등성, Unit27·최종 #809·15/5관측·glyph·명령/환경·TypeScript/대상ESLint·diff를 보존했다. 대상 ESLint error0이며 기존 Project router hook warning1은 남는다. owned Next/CLI를 종료한 뒤 `AGENTS.md`·`next-env.d.ts`·`tsconfig.json`의 자동 생성 diff는 baseline과 내용 대조하여 복원했으며 관련 정책/실행 설정 변경0이다.

Manager의 MINOR 결정에 따라 infra `/root/publish_recovery`가 package.json/lock root3필드만0.134.0→0.135.0으로 동기화했다. [version-only 영수증](../../evidence/issue-809/version-only.json)의 JSON deep comparison에서 dependencies/그 외 lock 변경0, 제품546+테스트5 hash 전후 불일치0, version check v0.135.0 stable·diff check PASS다. 실제 캡처 runtime0.134.0의 증거를0.135.0 실행이라고 바꾸지 않는다.

최종 게시 전 latest main·원격 tree/bytes/부모·PR 리뷰/충돌을 infra가 다시 확인한다. PR Head와 원본 CI Run/Attempt 등록은 커밋 자기참조·추가 CI 방지를 위해 Issue STATUS에 기록한다. 이 패킷의 PR_CI_READY는 원격 Required/Trusted/Owner PASS가 아니다. quality/e2e/docker·QA_FINAL/Manager ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED다. 요청 범위는 Ready PR Full CI 시작에서 끝내고 결과를 모니터링하지 않는다.

최종 독립 Reviewer `/root/qa_recovery`는 r03-final source·version3필드 외 변경0·자동 생성 설정 diff0·실제100Vitest/57.808초/15+KEEP5/glyph0/T0·비동기 수명과 문서 의미를 대조해 LOCAL_PRE_QA PASS(새 P1/P2 없음)를 반환했다. 이전 `/root/chart_qa`의 실행 증거 재검증/재사용과 복구 Reviewer의 직접27case·T0 교차 실행을 구분했다. 이 판정은 remote QA_FINAL/Owner/Manager ACCEPT가 아니며 모두 NOT TESTED다.


## 2026-10-26 F809-CI-001 REWORK / PR #813

[원본 Full #3304.1](https://github.com/planner77/masterGantt/actions/runs/40235454996): Shard1 #551 3천 Task 대량 Milestone peer/fullscreen 시 30초 `settle`(5 RAF) timeout 1직접 FAIL, Shard1 56 PASS·47 NOT RUN, 기타 shard2–8 CANCELLED, E2E 집계/QA 파생 FAIL. Quality/Build/Docker PASS는 **이전 Head**에 한정. 원인은 현 로그로 UNKNOWN; timeout 증가/fixture 축소/skip/retry·CI 정책 완화 대신 대표 #551 test의 7정착 경로를 이름 있는 test.step으로 관측한다.

같은 PR 새 P2 review는 선택80/개인 Project140의 외부 Task 포함 Plan 원본으로 일정 이동 버튼을 숨기는 실제 제품 제어 결함. chart 선택 gate를 순수 함수로 분리하여 검증된 Plan gateway만 외부 Task를 허용하고 일반 WBS subset/T0 명시 예외/게이트 부재 차단은 유지. 기존 #736 chart 통합 E2E에 Project gateway→외부 Task→일정/복귀+focus/필터를, 기존 Resource feature unit에 양성·음성 2건을 확장(EXTEND, 새 전체 spec 없음). 수정 후 로컬 Node/Chromium 실행은 이 GitHub 연동 환경에서 NOT TESTED이며 원격 동일 source CI가 필요하다. [원장 상세](../../ISSUE_809_FAILURE_ANALYSIS.md) 참조. Required3/Trusted/Owner/Manager ACCEPT 및 MergeReady는 새 Head에서 미검증·BLOCKED.


## 2026-10-26 — #809 GHCR Release #198.1 실패 후속 P1 보완

**근거:** [GHCR Release #198.1](https://github.com/planner77/masterGantt/actions/runs/40245250839) / [Main #3306.1](https://github.com/planner77/masterGantt/actions/runs/40242715595) / annotated `v0.135.0`의 정확 merge SHA `12ce9a05c85ca52bd746107b54a817313668814a`. Main은 성공했지만 Release shard1의 기존 #556 실제 Summary→Resource→원래 보기에서 버튼 focus 5s FAIL(103 PASS/1 FAIL). Static 및 다른 E2E 7샤드 PASS, Release quality 집계 FAIL/후속 GHCR publish SKIPPED. 초기 #551 timeout과 R809-007의 Plan P2는 원장상 별도 이력이다. [F809-REL-001 누적 원장](../../ISSUE_809_FAILURE_ANALYSIS.md).

**분석·보완:** 화면 복귀의 2-RAF focus 시도와 `navigationLoading`에 따른 버튼 disabled 전이는 동기화되지 않을 수 있다(실제 실패 Trace 세부 시퀀스는 NOT TESTED). 일정 패널 가시/return pending/원본 버튼의 실제 enabled·modal 상태를 MutationObserver로 확인하고 안정적 selected/summary selector로 동일 논리 명령을 재식별한다. 새 사용자 keyboard/pointer/wheel·modal/다른 focus owner/새 generation 우선. 기존 필터·Summary·Resource/Gantt·이전 scroll/selection/read-only mutation0 유지.

**TEST_LIFECYCLE_REVIEW / AC_TEST_COVERAGE:** #809-AC3·#556-AC5/AC9: 기존 `resource-drill-ui.spec.ts`의 #556 시나리오 **EXTEND**(Summary 복귀 버튼 220ms 지연 활성화·정확 focus, 기존 Task/Assignment/readonly/context/Gantt 확인 유지), #528 동일 spec 정확 선택 ID/일정 복귀는 **KEEP_UNIQUE**. `issue-736-resource-dashboard.spec.ts`(#809 chart/Plan Project 외부 Task), `resource-kpi-integration-ui.spec.ts`(#530 nested/LIFO viewport), #717/#731 tab·사용자 focus, R2/Plan/Excel/HTTP/SQLite/권한 고유 검증은 **KEEP_UNIQUE**. 신규 spec 삭제/복제, timeout·skip/retry 및 8-shard/Required 완화 없음. Work Packet 및 failure ledger에 producer→consumer/negative/실제 불검증을 기록함.

**DOCUMENTATION_SYNC:** UPDATED: Work Packet, 단일 `ISSUE_809_FAILURE_ANALYSIS.md`, `PROJECT_UX.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`. `TEST_PLAN.md`은 기존 활성 #556/#528/#809 테스트 그대로 유지(테스트 선정/확장 근거를 이 패킷에 작성하여 정책 변경 N/A). `AGENTS.md`/DESIGN/CI_CD/ISSUE_LIFECYCLE/REMOTE_VALIDATION/QA_REVIEW_POLICY/API/DB/SECURITY·Import/Excel/운영 배포 정책은 수정된 계약이 없어 N/A.

**Release 정책:** 기존 `v0.135.0` tag 이동/삭제/재발행 금지. `0.135.1`은 동일 Issue #809의 **non-docs corrective PATCH 후보**일 뿐 별도 Owner 신규 버전 승인 marker는 없다. `risk_level=HIGH; qa_method=OWNER_MANAGED; qa_required=true; manager_decision=NOT TESTED; release_required=true; release_authorized=false; MERGE_READY=BLOCKED`. 실제 Node/Chromium/도커는 이 GitHub 연결에 checkout 런타임이 없어 NOT TESTED. 이번 요청은 리뷰/충돌 확인 후 **새 PR Full CI 시작까지**이며 모니터링·병합/Main/새 tag/GHCR/Finalizer/branch cleanup/Issue 종료는 하지 않는다.

## 2026-10-26 — PR #814 QA Preflight #3307.1 차단 교정 및 검증 경계

[원본 Full CI #3307.1 / 40252205907.1](https://github.com/planner77/masterGantt/actions/runs/40252205907)은 `HEAD=6682d8d7b7bba260ecdf26030cbba8cee63b7d00`, `base=12ce9a05c85ca52bd746107b54a817313668814a`, #814 교정 PR의 QA Preflight [Job 121346447423](https://github.com/planner77/masterGantt/actions/runs/40252205907/job/121346447423)에서 **DOC_SYNC 직접 FAIL 1**: `docs/TEST_PLAN.md`를 Work Packet 첫 `## DOCUMENTATION_SYNC`에서 `UPDATED`로 선언했으나 PR changed paths에 해당 문서가 없었다. PR Fast Gate/Required Quality-E2E-Docker/QA Final FAIL은 파생이고, 실제 TypeScript/Build/Vitest/Chromium8/Docker 구현은 전부 **SKIPPED/NOT RUN**. 본 원장 [F809-CI-002](../../ISSUE_809_FAILURE_ANALYSIS.md)에서 초기 #551, 차트 P2, #556 Release focus, 문서 미동기화를 구분한다.

**교정/TEST_LIFECYCLE_REVIEW:** 제품/E2E 로직·초기 회귀 assertion을 덮거나 완화하지 않고 `docs/TEST_PLAN.md`에 #556 원본 검증의 220ms disabled 지연과 focus 복구·새 사용자 intent 차단/기존 #528 #530 #717 #731 #736 #809 KEEP_UNIQUE 관계를 추가했다. 변경된 실제 문서 경로와 첫 `## DOCUMENTATION_SYNC`의 `- \`docs/TEST_PLAN.md\`: UPDATED`가 일치하도록 한다. 기존 Work Packet의 AC1~AC6·TEST_LIFECYCLE_REVIEW는 불변이며 #809-AC3/AC6과 연계한 이 단락의 고유 E2E 확장은 `tests/e2e/resource-drill-ui.spec.ts`에 속한다.

**변경 영향:** `docs/TEST_PLAN.md`, `docs/exec-plans/active/ISSUE_809.md`, `docs/ISSUE_809_FAILURE_ANALYSIS.md` UPDATED. `AGENTS.md`/DESIGN/QA_REVIEW_POLICY/CI_CD/ISSUE_LIFECYCLE/GITHUB_OPERATIONS/REMOTE_VALIDATION/API/DB/SECURITY 및 제품/Lock/테스트 소스는 이번 문서 교정에서 N/A(해당 정책·동작·게이트/버전 변경 없음). 기존 후보 `0.135.1`, 릴리스 승인 false, HIGH/OWNER_MANAGED·Owner 결정 NOT TESTED 유지. 원본 QA 사전 검사 규칙은 수정하지 않고 정확 신규 PR Full CI 시작까지만 진행한다. 독립 Trusted QA/Owner 위험 수용·Main/GHCR/Finalizer/Issue 종료는 미검증.

## 2026-10-26 — PR #814 Full #3308.1 테스트 준비 조건 실패 교정

**직접 원본:** [CI #3308.1 / Run 40253032474.1](https://github.com/planner77/masterGantt/actions/runs/40253032474), HEAD `7582d3fd9b2f5c7fb81dd2fff11d36168259dc91`, base `12ce9a05c85ca52bd746107b54a817313668814a`. [Shard1 Job 121349443186](https://github.com/planner77/masterGantt/actions/runs/40253032474/job/121349443186) #556 `observeLookup:592` 테스트 자체의 `page.evaluate`에 `Summary return focus fixture is unavailable` 예외(95 PASS/1 FAIL/8 NOT RUN). QA Preflight·Static/Unit/Build/Docker·Required Quality/Docker PASS, Shard3/8 및 8/8 PASS; 2/4/5/6/7은 CANCELLED, E2E Required/QA Final은 파생 FAIL. [단일 누적 원장 F809-CI-003](../../ISSUE_809_FAILURE_ANALYSIS.md)에서 F809-CI-001, F809-REL-001, F809-CI-002와 구분하여 기록.

**확정 결함/보완:** 지연 disabled 재현 fixture가 대시보드 활성 순간 `panel.hidden=true && Summary 버튼 DOM 존재`를 잘못 전제했다. 이번 실패의 직접 원인은 `TEST_CONTRACT/FIXTURE_OBSERVABILITY`; 기존 Release 실제 `toBeFocused` 실패 및 제품 경합의 원인 확정과 별개다. 일정 탭 `aria-selected=false → true`라는 기존 공개 의미 계약을 관찰하고 정확 Summary 명령의 실제 DOM 활성 후 220ms 일시 disabled를 주입하며, pending 해제/hold armed·released 영수증과 기존 exact Task/Assignment·focus/selection·Gantt·readonly write0 assertion을 보존한다. 테스트의 feature 검증을 제거하거나 timeout/skip/retry를 완화하지 않는다.

**TEST_LIFECYCLE_REVIEW / AC_TEST_COVERAGE:** 기존 `resource-drill-ui.spec.ts:494` **EXTEND**(#809-AC3/AC6 및 #556 접근성·scope·복귀). #528 同 file, #530 LIFO/viewport, #717/#731 사용자 focus 우선, #736/#809 실제 차트·Plan 인계, 인증·SQLite·OOXML/Excel은 KEEP_UNIQUE. No new duplicate full spec. 이번 producer test fixture only; 제품·version/DB·CI·QA·Release governance 변경 없음.

**DOCUMENTATION_SYNC:** UPDATED: `docs/ISSUE_809_FAILURE_ANALYSIS.md`, `docs/exec-plans/active/ISSUE_809.md`, `docs/TEST_PLAN.md`, `tests/e2e/resource-drill-ui.spec.ts`. N/A(reason): `AGENTS.md`, `DESIGN.md`, `docs/CI_CD.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/QA_REVIEW_POLICY.md`, API/DB/SECURITY/Import/Export (공식 검증 정책/서비스 API·저장·권한·배포 계약 변경 없음). 별도 Owner의 `0.135.1` 정식 릴리스 승인 없음, `v0.135.0` immutable 유지, 병합/게시/종료는 이번 요청 밖. 이번 수정된 Head의 Chromium/Required/Trusted/Manager 검증은 새 PR CI 이전 NOT TESTED.
