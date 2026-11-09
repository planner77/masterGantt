# Issues #898 / #899 — Test Lifecycle / 브라우저 회귀 추가 계획

원본 Source of Truth: [docs/TEST_PLAN.md](TEST_PLAN.md) 및 [AGENTS.md](../AGENTS.md) #711, [Work Packet](exec-plans/active/ISSUE_898.md). 이 추가 계획은 원본 test plan을 대체하지 않는다. 원본 blob이 1MB 이상으로 GitHub Contents Connector에서 온전한 내용을 제공하지 않아 보호·보존한다.

## 기존 테스트 검색·재사용

| 파일 | 기존 검증과 재사용 분류 | 신규 AC |
| --- | --- | --- |
| `tests/e2e/project-summary-bar-visual.spec.ts` | KEEP_UNIQUE: #822 실제 Control + `page.mouse.wheel`(Grid row/Task bar), Summary bar·font/row·Core identity/쓰기0 | #898 native WBS 실제 mouse 비교 기준 |
| `tests/e2e/schedule-views.spec.ts` | EXTEND: #880 실제 HTTP/SQLite, 복수 Resource Group·설비, Editor 동일 canonical ID, 5폭, Day/Week, Fullscreen, #889 synthetic WheelEvent·선택/스크롤 | #898 Grid/Chart 각 View 실제 pointer, browser zoom metrics, #899 Task 클릭/정렬/Editor 분리·중복 |
| `tests/features/gantt/gantt-density.test.ts` | KEEP_UNIQUE: #822 fine/coarse/고해상도 delta/버스트·clamp | #898 기존 wheel state machine 비변경 |
| `tests/features/gantt/schedule-view-reveal.test.ts` | ADD: projected scroller의 start x, Day/Week pixelsPerDay, scroll capacity 부족, NO_DATE·NOT_MEASURABLE | #899 typed 결과 |
| `tests/e2e/i18n.spec.ts`, `tests/e2e/project-gantt-fullscreen.spec.ts`, 관련 viewport/GSC tests | KEEP_UNIQUE: locale·fullscreen·source/selection 연속성 | 두 이슈 간접 회귀, 기존 테스트 무삭제 |

## 실행과 판정

1. Source exact SHA에 대해 `npm run typecheck`, 변경파일 eslint, `npm test -- tests/features/gantt/gantt-density.test.ts tests/features/gantt/schedule-view-reveal.test.ts`, `npm run test:e2e -- tests/e2e/schedule-views.spec.ts tests/e2e/project-summary-bar-visual.spec.ts` 선별 실행. 단지 작성/정적 검사 상태를 PASS로 쓰지 않는다.
2. Required Quality, Chromium E2E **8/8**, Docker의 전체 Full PR CI와 Trusted QA가 새 HEAD/BASE의 정확한 source로 성공해야 한다. 테스트 삭제/skip·retries/timeout 증대·CI gate 생략·기존 테스트 기대치 완화 금지.
3. 실제 사용자 입력 테스트는 `page.mouse.move`, `page.keyboard.down("Control")`, `page.mouse.wheel`을 사용하고 단순 합성 event `defaultPrevented=true`와 구분한다. `window.devicePixelRatio`, `visualViewport.scale`, `innerWidth` 및 실제 cellHeight/font/bar geometry를 비교한다.
4. Page Zoom 차단은 세 View×Grid/Chart 본문 실제 pointer에서 증명하되 헤더·Toolbar·입력·대화상자·Page 바깥은 shortcut 점유 금지. `cancelable=false` 또는 장치 coarse 상태는 별도 진단/NOT TESTED 가능.
5. Resource/설비 Grid 이름/cell 클릭은 selected canon ID 및 클릭한 `viewRowKey`와 bar-left sticky boundary 오차(가능한 경우 ≤1 CSS px)·Editor 닫힘을 단언. 더블클릭/명시 정보 버튼 Enter/Space/Chart Bar 클릭으로 동일 canonical Editor 접근과 포커스 복구를 확인한다. 물리 viewport root `scrollLeft`도 별도로 확인.
6. `NO_SCROLL_CAPACITY`, `NO_DATE`, `NOT_MEASURABLE`은 Unit으로 분류하고 실제 화면의 오차 불가능한 경우 허위 PASS 금지. 과거 #880의 80+가상행/응답역전·source stale·Resource/Equipment 다중 배정·WBS 단일 instance·쓰기0 조건은 유지한다.
7. #896 PNG+DOM geometry+manifest로 source SHA/viewport/locale/AC를 연결하고 #897 격리 Preview Owner UAT는 별도 게이트로 남긴다. 운영 Chrome/Edge·Native125%·실제 마우스/trackpad/touch/하이브리드/스크린리더는 명시한 경우에만 PASS, 그 외 NOT TESTED.

**작성 시점 상태:** 새 테스트 코드 작성 완료, 실제 로컬/원격 실행 및 Owner UAT **NOT TESTED**. PR open으로 Full PR CI를 시작하되 이후 모니터링하지 않는다.

## #904 Full #3606.1 REWORK · 테스트/구조 계약 (2026-11-09)

- PR 메타데이터 source 계약은 `scripts/verify-ci-run-trace.py`의 `Refs #898` 단독 한 줄, Title의 `Issue #898` 하나, branch의 Primary `issue-898` 하나와 일치. `scripts/qa_preflight.py`의 위험/QA/릴리스 standalone 선언, Work Packet AC01..AC06/문서별 UPDATED·N/A(reason)/REUSE_REVIEW를 준수한다. 기존 검증 스크립트·workflow는 수정하지 않는다.
- `tests/features/gantt/gantt-density.test.ts` (EXTEND): `densityWheelPointer`가 좌표가 없는 synthetic `isTrusted=false, (0,0)`를 DOM fallback으로, trusted 실제 (0,0)·nonzero pointer를 좌표 판정으로 분리함을 검증. 기존 `project-summary-bar-visual.spec.ts:607-617` / `schedule-views.spec.ts:753-758` 합성 DOM 취소 회귀는 KEEP_UNIQUE, WBS·projected 실제 `Control + page.mouse.wheel` 위치 테스트와 별도로 유지한다.
- **Run #3606.1**은 메타데이터/QA 단계에서 FAIL한 실행으로 **실제 제품 테스트는 SKIPPED**. 신규 HEAD의 실제 Unit·Typecheck·ESLint·E2E8·Docker PASS는 새 Full PR CI가 끝날 때까지 NOT TESTED. 기존 타 이슈 CI나 synthetic PASS를 승격하지 않는다.
