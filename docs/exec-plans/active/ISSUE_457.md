# Issue #457 — 전 화면 회귀 검증 체계

## 목표와 요청 범위

기존 테스트를 inventory하고 공통 geometry/control/state 측정과 위험 기반 cross-screen E2E를 보강한다. 필수11 coverage행 모두 route/entry, childIssue/PR, fixture, viewport/state, 실제 증거와 판정·사유를 기록한다. 이번 전달 경계는 구현·문서 동기화·독립 사전 검토·원격 PR 및 exact-head CI 등록까지다. CI 결과는 모니터링하지 않고 공식 quality/e2e/docker·최종 ACCEPT는 NOT TESTED로 유지한다.

## 기준과 의존성

- 착수 시 main: `05fe212060ed4a935510dc2f7a692bb9113c55e8` / 0.92.0
- 게시 기준 최신 main: `24072f4fd28cd1306b3c348d3f7da1a0e3dbc075` / 0.92.1
- 작업 기준: 선행 #456 PR #500의 `b397eedf35d50befb4ae17e623036f0a8d77f556`
- 기준 tree: `6a322cc119ed5b0a435f3b1ff20fe5826035ed66`
- branch: `test/issue-457-cross-screen-regression`
- 최종 PR base: `main`. 착수 당시에는 선행 #456 미병합으로 stacked base를 계획했다.
- version: 0.92.1 유지. 테스트·문서만의 변경이며 version bump는 선행 #456 소유다.
- release_required=false / release_authorized=false. 선행 병합·main/GHCR·정식 tag/release·cleanup·Issue 종료를 실행하지 않는다.

## 담당과 파일 소유권

Manager가 Packet/활성 PLAN/Issue 기록과 단계 판정을 소유한다. frontend가 tests/e2e의 공통 helper·관련 spec·증거 및 TEST_PLAN/UI_UX_GUIDELINES/coverage 문서를 소유한다. ui_ux는 read-only 설계·비교, qa_docs는 독립 read-only 검토다. infra는 별도 승인 단계의 branch/PR/CI 등록을 수행한다. Agent의 Issue 댓글 쓰기는 허용하지 않는다. 원본 작업 공간과 기존 worktree/raw자료를 보존한다.

## 검증과 증거

5개 기본 폭390/768/1024/1440/1920px을 같은 높이/locale/timezone/rootfont/default100% 환경으로 관찰한다. 표면별 대표 상태를 선택하고 같은 뜻의 control size 차이는1 CSS px tolerance, 의도된 내부 scroll과 document overflow를 구분한다. normal/focus/error/disabled computedstyle·label/errorassociation, 실제 keyboard/Escape/state 동작을 존재 검사나 사진과 분리한다. 전체 Cartesian product를 만들지 않으며 기존 source에 유효한 실행만 재사용한다. native125%는 DPR로 대체하지 않는다.

실행 report/stdout는 매 실행 직후 고유 경로에 보존하고 capture의 실제 source/test/env hash를 기록한다. baseline과 후보 제품 source는 같으므로 같은 값은 KEEP로 기록하며 개선 효과를 꾸미지 않는다. 과거 #452 착수 시 공통 helper가 없었다면 신규 helper로 보완하되 과거 존재를 소급하지 않는다. B #490/C #491와 미조사 표면은 사유가 있는 FOLLOW-UP/NOT TESTED로 추적한다. 실제 배포 version을 알 수 없으면 source version과 구분한다. 일반 E2E는 Playwright test output을 사용하고 tracked evidence publication은 `ISSUE_457_EVIDENCE_DIR`로 opt-in한다. 향후 source가 달라질 수 있으므로 자동 판정은 `ISSUE_457_BASELINE_SOURCE_AGGREGATE_SHA256`이 제공된 경우에만 수행한다.

## 문서 동기화

필수 문서: [coverage](../../ISSUE_457_UI_UX_COVERAGE.md), [Test Plan](../../TEST_PLAN.md), [UI/UX 지침](../../UI_UX_GUIDELINES.md), 현재 Packet, [활성 PLAN](PLAN.md). 신규 source/domain/API/DB/보안/Import/Export/배포/CI workflow 변경이 없으므로 해당 계약 문서는 N/A다. DESIGN.md는 기존 Light/systemfont/semantic token/parent-owned spacing/40px admin·44px Task Editor 예외를 그대로 준수하므로 N/A다. 화면별 PROJECT_UX/TASK_EDITOR는 동작 계약 무변경이므로 N/A다.

## 현재 상태

branch 준비와 독립 관측 설계 PASS. 공통 observer 및 기존 대표 회귀를 구현하고 핵심 재검증7 PASS와 선택16 PASS 재사용을 보고받았다. 고유23 시나리오와4회 실행34 PASS/2 FAIL을 분리한다. DOCUMENTATION_SYNC·독립 사전 QA·원격 게시/CI 등록은 진행 중이며 실제 반환과 증거에 따라 판정한다. 문서만으로 Epic #449 완료나 전 화면 전체 상태 PASS를 주장하지 않는다.

## 원문 인수 기준과 역사적 예외

1. 위 전체 coverage 표와 source SHA/배포 version 차이 확인.
2. #452 첫 PR부터 공통 helper/fixture 및 cross-admin baseline 존재.
3. #453/#454/#455/#456 각각의 before/after와 관련 상태·기능 E2E 존재.
4. global CSS 사용처 변경에 대한 cross-screen 회귀 증거 존재.
5. 분리 CSS 실험·actual browser·E2E·원격 CI·독립 QA를 명확히 구분.
6. FAIL/BLOCKED/NOT TESTED는 해결 또는 사유 있는 후속 이슈로 추적. UI 사진만으로 Epic 완료 금지.
7. docs/TEST_PLAN.md와 docs/UI_UX_GUIDELINES.md에 검사·증거 계약 동기화.
8. 구현 승인 범위에 해당하는 PR/main/release gate를 ISSUE_LIFECYCLE대로 완료하며 문서 PR만으로 #449를 종료하지 않는다.

AC2의 cross-admin baseline은 #452 PR #466에서 존재했지만 재사용 geometry helper는 없었다. merge `9280536ddc85a8a841346bdf413b2ba638685880` tree의 spec-local observer와 현재 신설 helper를 구분한다. 과거 착수 시점 조건은 역사적 GAP/FAIL이며 이번 기술 보완을 과거 PASS로 소급하지 않는다. Manager가 이 예외를 Issue 댓글6024639957에 기록했으며 요청 범위의 게시 준비와 Epic 전체 완료를 별도로 판단한다.

## 미실행 항목 추적

실제 React error boundary·native125% 등과 운영 source/version 미검증은 [#502](https://github.com/planner77/masterGantt/issues/502) FOLLOW-UP / NOT TESTED로 추적한다. 404/API 실패 실행을 boundary 검증으로 보고하지 않는다. 제품 후속B[#490](https://github.com/planner77/masterGantt/issues/490)/C[#491](https://github.com/planner77/masterGantt/issues/491)와 구분하며 이번에 자동 구현하지 않는다.

## DOCUMENTATION_SYNC와 동결 후보

frontend의 테스트8/문서3/증거143개가 동결됐고 Manager의 현재 Packet/PLAN2개를 합쳐156파일 후보로 검토한다. 로컬 직접7 PASS 및 선택16 재사용으로 고유23 시나리오를 기록하되 단일23 PASS 실행으로 합치지 않는다. 4회 실행36 testcase=34 PASS/2 FAIL과 최초 typecheck/관찰/보존 오류를 유지한다. 제품323 source와 generated 파일, baseline439 tracked output은 변경0이다. 역사적 AC2 GAP/FAIL과 #490/#491/#502의 FOLLOW-UP/NOT TESTED는 그대로 유지한다. 독립 사전 QA와 게시 동등성은 다음 단계다. 공식 quality/e2e/docker·QA_FINAL/Manager 최종 ACCEPT는 NOT TESTED다.

추가 N/A: CHANGELOG는 제품 변경이 없어 version/release 항목을 새로 만들지 않는다. README/npm/설정 진입점은 기존 test 실행 계약을 유지하고 검사 방법은 TEST_PLAN/coverage 문서에 기록한다. source/API/DB/보안/일정/Import·Export/VBA/배포/CI·운영 문서는 해당 계약의 구현 변경이 없어 N/A다.

## 게시 전 기준 갱신과 메타데이터 정정

작업 중 외부에서 PR #500이 `2026-10-06T20:10:11Z`에 병합됐다. 최신 main `24072f4fd28cd1306b3c348d3f7da1a0e3dbc075`의 tree는 기존 측정 source `b397eedf35d50befb4ae17e623036f0a8d77f556`와 같은 `6a322cc119ed5b0a435f3b1ff20fe5826035ed66`다. 전용 branch의 baseline을 동일 tree인 최신 main으로 맞추고 PR base를 main으로 지정한다. 원래 측정 source SHA와 당시 version/env/hash는 변경하지 않으며 테스트 재실행을 꾸미지 않는다.

독립 QA가 목록 snapshot의 실제1280×720과 문서상1440px 불일치, 실제 Asia/Seoul 환경과 요약 UTC의 불일치를 확인했다. original facts/PNG/source·test hashes는 그대로 두고 owned 문서와 요약을 실제 값으로 정정한다. 기존 파일명1440은 초기 capture key 별칭이며 viewport 증거가 아니다. current62자료는 ko-KR/Asia-Seoul49개와 en-US/Asia-Seoul13개(11개900px높이, 목록2개720px높이)다. 이 정정과 baseline 동일성에 대해 새 후보 및 DOCUMENTATION_SYNC·독립 delta 검토를 수행한다.
