# Issue #528 frontend 검증 근거

Local Fast Feedback와 원격 회귀는 구분한다. Next16.3.8, SVAR Core2.7.3에서 신규 mock2개는 영향 없는 browser11 증거를 재사용하고, 실제 SQLite UI1개는 최종 UI/UX REWORK3 뒤16.5초/전체27.4초 PASS했다. 고유 case는 mock2/nativeUI1이다. 이전 실행의 동일 case PASS/FAIL을 새 고유 case로 합산하지 않는다. 공식 PR quality/e2e/docker와 독립 QA는 NOT TESTED다.

`resource-drill-390.png`와 `resource-drill-1440.png`는 실제 SQLite/Next UI body다. `scope-strip-five-widths.json`은 실제 390/768/1024/1440/1920 관측이며 document overflow0와 strip/button containment를 검증한다. `actual-resource-drill-ui.json`은 합성 fixture의 안정 ID·revision, `bounded-whole-scope-fixture.json`은 mock 전체60Task/60Assignment와 상세 page50→10·report JSON5117bytes를 기록한다. 실제 DB, runtime log, 쿠키·비밀값은 저장하지 않는다.

browser11 이후 기존 함수/return의 동등 AST를 원래 포맷으로 복원하고 Editor locate의 원본 context bridge·방문별 report pin/prune를 보완했다. 해당 변경은 typecheck/owned lint/관련28Unit으로 확인했으며 Membership Editor locate의 실제 browser 조작을 PASS로 표시하지 않는다. 후행 UI/UX REWORK3의 PNG/geometry는 최종 native 실행에서 새로 캡처한 증거다.

| 인수 기준 | 코드/검증 증거 | 실제 범위와 제한 |
| --- | --- | --- |
| AC1 고유 N/ancestor 분리 | resource-drill-scope-model/Workspace, mock 전체60/page50→10/ancestor1, Unit 중복·분모 검사 | PASS: whole scope60과 일반 Task 분모/조상 분리 |
| AC2 교차 셀/기간 동일 범위 | default/526/527 상세의 공통 transport, Unit 모든 projection/selector·Plan period mismatch 거부, backend nativeAPI | 원본 계약과 전달 Unit PASS. 새 모든 Group×M/개인×M/기간 UI 조합 실제 browser는 NOT TESTED |
| AC3 M 밖 Project 전체 과투입 | planScopeProjection/full resource-project scope/caption, source 제한 transport, backend nativeAPI의 M 밖 전체 부하 scope | Backend 실제 source 증거는 최초 API1PASS의 관련 재사용. 이번 frontend native의 Project 전체 원인 셀 직접 조작은 NOT TESTED |
| AC4 WBS/다중root/동명/삭제/stale | mock WBS 숨김59·확인취소, native 같은 Project revision Catalog 변경 차단, 모델·canonical ID 검증 | WBS/stale PASS. 새 동명/multi-root·삭제 UI 조합은 NOT TESTED |
| AC5 원래 보기/해제/상태 | native8단계/9번째 차단/상세·개인 mode 복구/cache1, Unit 수동peer baseline·50회 pop/prune | Resource/Schedule 왕복 PASS. Milestone 직접 표시→Milestone 복귀 PASS. M→Resource→M 모든 필터 UI 조합은 NOT TESTED |
| AC6 instance/원본 불변 | native Gantt 동일 DOM·선택 checkbox·cookie0·revision 불변 | PASS: 해당 실제 fixture 범위. 임의 viewport/column/scale 조합 전체 회귀는 NOT TESTED |
| AC7 권한/dirty/응답/keyboard | guard Unit readonly/read-denied/dirty/모든 pending, mock late aborted409, native Escape/취소 trigger focus/Editor 열기닫기 | 관련 Unit/mock/native PASS. 실제 dirty 편집 세션·Membership Editor locate는 NOT TESTED |
| AC8 5폭 toolbar/chip/focus/scroll | 실제 five-width JSON/PNG2, native focus·동일 instance, app-owned scroll 복귀 | strip overflow/containment PASS. 모든 viewport별 scroll/column/focus ring 전체 조합은 NOT TESTED |

Unit는 navigation8+transport5+기존 Dashboard5+Milestone3+Plan7,5파일28개 PASS(690ms)다. 최종 typecheck PASS, owned lint0error/4warning이며4개는 baseline Gantt에 동일하게 존재하는 hook dependency 경고다. Markdown 링크는 최종 실행 결과로 기록한다. 사용자 지시에 따라 전체 Vitest/전체 Playwright/Docker smoke를 추가 반복하지 않았다.

실패 원본은 `/tmp/frontend528-native-ui1.log`부터 `/tmp/frontend528-browser11.log` 및 관련 typecheck/lint 로그에 보존한다. 상세 원인·조치·고유 case/재실행 구분은 TEST_PLAN의 Issue #528 frontend 섹션을 따른다. 원격 게시·version·독립 QA 판단은 Manager/infra 소유다.

최종 UI/UX REWORK3에서 strip 버튼18px→공통 secondary-button40px, native Tab outline solid3px, 캐시의 첫 hidden 제목→현재 visible/noninert 제목 focus를 확인했다. 5폭 각각 버튼2개의 높이는 모두40px이고 overflow0이다. PNG2/geometry JSON은 최종 native 재실행 시점으로 갱신했다. 원본 M SourceContext(range2026-10-01–2026-10-03/asOf2026-10-02/query15)는 오늘 lookup과 구별해 strip과 복귀 입력에 유지하고 원본 정책을 다시 검증했다. 새 manifest로 재동결하고 이전 독립 PRE_QA를 새 source tree로 대체한다.
