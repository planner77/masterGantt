## #548 Milestone marker-OFF 기준선/선택 marker-ON 검증 프로파일 (2026-10-15)

[Milestone Presentation Policy](MILESTONE_PRESENTATION_POLICY.md)의 **두 단계**를 분리한다. marker-OFF baseline #552/#553/#574에서 SC-01~14의 데이터·Viewport·0행·Instance·Editor·Copy·Resource/Target 보호는 그대로 필수다. 단, SC-12/SC-13의 **상단 lane tick/roving marker focus/마커 날짜 reveal**은 marker OFF에서 '기능 미활성'을 확인하며 marker ON 기술 검증은 후속 #573/#693에서 별도 실행·서명한다. 기초선 테스트에서 마커 ON을 요구하는 오래된 테스트는 삭제/skip으로 감추지 않고, OFF의 DOM/observer/쓰기0·Dashboard 대체 진입·full canonical 보호를 가진 대응 테스트로 전환한다.

- SC-08: 전체 empty project / 검색 결과0 / Milestone-only에서 hidden native M 행0이더라도 canonical M ID와 Dashboard count/Ready 유지; native 축/date range는 일반 Task 정책과 독립 보존.
- SC-09/11: 일반 Task용 축 확장/스크롤/UserIntent/Resource 왕복은 marker OFF에도 전체 동작·좌표 보호. marker 전용 extra range/scroll/RAF0.
- SC-12/13: marker OFF가 native row/bar0와 다른 기능의 집중 선택/키보드/Escape·visible focus/무mutation을 동시에 충족. marker ON x±1px/5폭은 #573/#693 선택 트랙.
- 별도 marker-only rollback drill: feature gate OFF 후 lane/구독/ScrollWrite0·baseline 유지, Revert CI, 런타임 vs build-time 설정 의미를 실제 운영 증거로 분리.

**참조만 변경:** GSC-01~12 규범의 내용과 기존 엄격한 허용오차·timeout/Required 3개 검사는 유지하며 manifest/test 코드 자동 갱신은 별도 구현·검증 전 NOT TESTED다. 기존 문서의 #663 구현 사실과 그 이전 미구현 상태 기록은 역사적으로 보존한다.

---

# Gantt State Conformance Matrix

기준: [GSC 1.0.0-candidate](GANTT_STATE_CONSISTENCY.md) · 상태: REVIEW_PENDING · 2026-10-13 / #661.

본 문서는 장기 검증 매핑이다. 기존 [TEST_PLAN](TEST_PLAN.md)을 삭제하거나 재작성하지 않으며, 아래 사례는 최소 누적 묶음이지 전체 E2E를 대체하는 축소 목록이 아니다. 새 하니스·자동 참조 검사·테스트 코드는 아직 구현하지 않았다. 이 문서의 AC 표는 PASS 원장이 아니다.

## 1. 공통 판정

서버 canonical, 실제 Core 데이터와 순서, logical visible IDs, 가상화된 DOM subset, 실제 axis/scroll/focus를 분리하여 측정한다. Gantt instance 유지, 무허가 서버 mutation 0, 최신 사용자 입력 우선, 완료되지 않은 후단을 NOT TESTED로 표시하는 것은 공통 불변식이다.

기존 허용오차·timeout을 유지한다. 실제 Core 값의 정수/소수 계약과 native CSS px 허용오차를 섞지 않는다. 예를 들어 기존 Bar rollback 0.5px 미만 조건을 임의로 1px로 확대하지 않는다. 실패를 진단하기 위한 추가 instrumentation은 source patch/manifest를 기록하며 제품 source와 구별한다.

## 2. 누적 상태 전환

| ID | 시나리오 | 필수 기대 / 부정 경계 | GSC | 구현 소유 |
| --- | --- | --- | --- | --- |
| SC-01 | 동일 snapshot의 새로운 DTO 배열 재조회 | Core가 정합하고 recovery가 없으면 불필요한 적용/receipt 교체/scroll 없음 | 02,06,08 | U2/U3 |
| SC-02 | DnD 순서 변경 후 412 및 500 | 실제 Core A-C-B와 최신 서버 A-B-C를 감지; 순서/계층/revision 복구; 이후 이름 저장이 드래그 변경을 재저장하지 않음 | 01,02,03 | U2 |
| SC-03 | 포인터 날짜 변경 후 422 | 서버 날짜, Grid 날짜, Bar x/width 모두 복구; 한 셀 36px 잔류가 없어야 함 | 02,03,08 | U2 |
| SC-04 | Native add/link/delete/type 변경의 거부 | 임시 객체/누락/관계 drift 복구; 동일 canonical도 검증; 실패 테스트의 진단 generation만으로 실제 유령 행을 단정하지 않음 | 01,02,03,09 | U2 |
| SC-05 | 500/timeout 뒤 서버 commit 성공·실패 각각, 후속 GET 실패 | 무조건 과거 상태 rollback/자동 mutation 재시도 금지; 최신 canonical 확인 또는 UNCERTAIN/복구 필요 명시 | 01,03 | U2/U5 |
| SC-06 | Calendar-only 저장과 동일 revision 재관측 | 날짜/Link 불변, 유효한 X/Y 보존; 의미 없는 observation ID 증가로 정상 restore 취소 금지 | 04,06,08 | U3/U5 |
| SC-07 | 실제 Core drift·API 교체·revision/query/axis 변경 | 오래된 receipt/no-op 재사용 금지; 같은 ID key라도 현재 Core와 일치하지 않으면 재확인 | 02,06,07 | U3 |
| SC-08 | Empty project·M-only·검색으로 WBS 0행 | 날짜축 범위 유지, population/필터 구분; 필터 원점 정책과 이후 사용자 이동을 별도 검증 | 01,05,09 | U4/U5 |
| SC-09 | RANGE_EXTENSION 후 및 중간 사용자 wheel | 실제 날짜 coverage/capacity 확인, 비승인 X/Y 변경 없음; 사용자 입력 뒤 이전 좌표 replay 0 | 04,05,07 | U4/U5 |
| SC-10 | 검색 변경·이름 수정으로 결과 0행·조건 해제 | query 의도와 결과 ID 변경 구분; 초기화 정책 및 1회 bookmark; 새 wheel/선택 뒤 오래된 bookmark 부활 없음 | 02,05,07 | U3/U5 |
| SC-11 | Resource/Calendar/Export/Dashboard 왕복과 pending restore | Core/native 위치, 동일 instance, tree/columns/selection 보존; 새 입력 우선 | 04,06,07,08 | U5 |
| SC-12 | Day/Week, 열 숨김·resize·split·전체화면 | 실제 Chart geometry, Grid/Bar/marker 정렬과 날짜 anchor 보존; hidden/zero-size는 명시 결과 | 05,08,09,10 | U4/U5, #573 |
| SC-13 | Milestone 표시·OFF 날짜 이동·Copy·관계·상세 | 전체 canonical subtree와 소속/잠금, accessible name·canonical-ID 진입, 원래 보기/focus, 저장 0 | 01,07,09,11 | U5, #573 |
| SC-14 | 1000 일반 Task + 2000 Milestone, 반복 mount/unmount | Core init과 layout readiness 분리; 제한된 관측/cleanup, 누수·중복 listener 없음; 기존 readiness 기준 유지 | 02,08,09,10 | U1/U4/U5 |

U 번호의 이슈·파일 경계는 [실행계획](exec-plans/active/GANTT_STATE_REMEDIATION.md)에 정의한다. #573은 작은 화면 geometry/focus 소유, #574는 전체 통합 증거와 최종 gate 소유다. #553은 JSON/Excel/SVG/PNG 등 별도 데이터 교환 인수 범위를 유지한다.

## 3. 기존 테스트 재사용과 회귀 추적

SC-02: `tests/e2e/project-grid-reorder-persistence.spec.ts`.
SC-03: `tests/e2e/project-task-persistence.spec.ts`.
SC-04: `tests/e2e/project-gantt-stability.spec.ts` 및 기존 link/structure/empty-summary 회귀.
SC-06: `tests/e2e/project-resource-calendar-persistence.spec.ts`.
SC-08/09: `tests/e2e/milestone-timeline-core.spec.ts`, `milestone-timeline-lane.spec.ts` 및 기존 dynamic timeline 회귀.
SC-10: `tests/e2e/viewport-coordinator.spec.ts`, `task-editor-form-density.spec.ts`.
SC-11: `tests/e2e/resource-kpi-integration-ui.spec.ts`, `resource-excel-export-ui.spec.ts` 및 기존 peer/whole-screen 회귀.
SC-13: `milestone-visibility`, `milestone-exchange-state`, `milestone-stage-exchange` 등의 기존 spec. 구현 시 실제 경로/이름/파라미터 case를 확인해 manifest에 고정한다.

선택자는 canonical task ID, 현재 accessible name, 공식 진입 경로를 사용한다. DOM 행 부재를 유형으로 해석하지 않는다. 테스트가 변경된 UX를 검증하도록 정정될 때도 원래 데이터·권한·취소·무mutation 보호를 새 경로에 대응시킨다. 테스트 기대값 수정과 제품 수정의 효과는 분리해 기록한다.

## 4. 단계별 실행과 증거

1. U1: 순수 상태 전환과 실제 Core snapshot reader의 계약; 기존 재현 도구를 재사용한다. 알려진 실패는 별도 baseline 결과로 보존하고 실패 테스트를 required suite에 무조건 상시 실패 상태로 넣지 않는다.
2. U2/U3/U4: 해당 모듈 독립 Unit + 실제 설치 Core adapter fixture. 이전 실패/정상 no-op/교차 부정 사례를 함께 검증한다. 새 모듈이 제품에서 아직 연결되지 않았다면 `MODULE_READY`일 뿐 제품 PASS가 아니다.
3. U5: 같은 구현 source에서 SC-01~14 누적 묶음 실행. 390/768/1024/1440/1920, Day/Week, readonly/editable, scope/filter, hidden/zero-size 및 필요한 상태 순서를 포함한다. 최소 대표 조합과 전체 매트릭스 미검증을 구분한다.
4. #573/#574: actual browser + actual HTTP/SQLite 증거, 설치 버전·Head/base/test-merge 고정, 기존 전체 Quality/E2E/Docker와 독립 검토·Owner gate. 기존 fail-fast 정책에 따라 취소된 shard는 실패 원인 없음이 아니라 NOT TESTED다. 이 표준을 위해 임의로 CI fail-fast를 끄거나 필수 check를 바꾸지 않는다.

Local Fast Feedback 성공은 원격 전체 CI를 대체하지 않는다. 반복 3case×2회는 6고유 case가 아니다. Head/base가 바뀌면 원격 gate는 새 source에서 판정하고 로컬 결과 재사용 근거는 별도 기록한다.

## 5. 증거 스키마와 보안

[Sync Trace](GANTT_SYNC_TRACE.md)의 기존 bounded observer를 확장/재사용한다. 새 서버/상시 polling/두 번째 writer를 만들지 않는다.

필수 연결값: scenario ID + GSC ID + repository/PR/Issue + Head/base/test-merge + run/attempt + package/lockfile fingerprint + 실제 명령/fixture + outcome. 전후 비교에는 정규화된 Core/목표의 차이 요약, canonical revision, mutation/recovery ID, dirty generation, query/intent/axis identity, observation ID, Core/native X/Y, 물리 capacity, 취소 이유를 포함한다.

Task 이름·설명·URL·비밀번호·cookie·session·실제 DB 원본은 trace에 기록하지 않는다. 합성 ID 또는 비가역 지문, 허용된 numeric/boolean 값을 사용한다. 허용되지 않은 payload를 제외하고 artifact 보존·만료 시 검증 한계를 기록한다.

## 6. 향후 에이전트 체크

- Work Packet은 표준 버전/commit, 적용 GSC, 영향 소유자, 선택 SC 목록과 제외 이유, 예외 ADR, 실제 결과/미검증을 갖는다.
- Reviewer는 문서 존재만 아니라 실제 Core 비교/복구·쓰기 경로·fixture를 확인한다.
- U1은 machine-readable SC manifest와 marker/coverage 단위 검사를 구현하고, U5는 기존 테스트 실행 경로에서 이를 소비한다. #574는 실제 필수 실행과 traceability를 확인한다.
- 이 문서 PR에는 자동 검사 코드/워크플로 변경이 없으므로, 현재 자동 enforcement는 NOT IMPLEMENTED다. Required check 변경이 필요하면 별도 infra·보호 경로 검토를 따른다.

## 7. Issue #663 — U1 하니스 구현 현황

U1의 기계 판독 manifest는 `tests/config/gantt-state-conformance.json`, 검사는 `tests/features/gantt/state-consistency-manifest.test.ts`에 있다. SC-01~14의 GSC/owner/evidence/spec·case 매핑과 음성 사례를 기존 Vitest runner로 검사한다. 본문 작성 당시의 NOT IMPLEMENTED는 #661 역사적 경계이며 이번 U1에서는 계약/reader/manifest·fake port 기반만 구현한다. 규범 버전·REVIEW_PENDING 상태는 불변이다.

Manifest 등록 상태와 실제 시나리오 실행 결과는 다르다. fake Core·합성 실제 SVAR reader·실제 HTTP/SQLite·제품 E2E·원격 CI를 별도 증거로 관리한다. 현재 U1은 제품에 연결되지 않으며 U2/U3/U4/U5/#573/#574의 제품 증거는 NOT TESTED다. 계약/fixture 버전, 정확한 source·명령·로컬 결과·미실행은 [#663 Work Packet](exec-plans/active/ISSUE_663.md)을 따른다. manifest 성공만으로 SC-01~14 제품 PASS 또는 Required check 신규 강제를 주장하지 않는다.

## 8. Issue #664 — U2 독립 복구 모듈

U1 interface merge `d445ec58bf9106414c99a150ee8f52599834baf9`를 소비하는 `core-conformance.ts`/`canonical-recovery.ts`를 opt-in으로 추가한다. SC-01~05/07의 actual data/no-op/proof invalidation·확정 거부/uncertain·stale/new pending 경계를 전용 Unit과 설치 실제 합성 Core fixture에서 검증한다. U1 manifest/원본 actual reader 자료와 기존 제품 호출자 동작은 유지한다.

실제 Core 전후 data action은 합성 브라우저 증거, commit 성공·미성공/GET 실패는 주입 포트 Unit 증거다. 제품 HTTP/SQLite·native DnD·Bar geometry·viewport/receipt/axis·5폭·대량 수명주기는 U5/#573/#574의 별도 NOT TESTED다. SC-01~14 전체 제품 PASS를 뜻하지 않는다. 정확한 AC 매핑/직접검증/미검증·원격 인계는 [#664 Work Packet](exec-plans/active/ISSUE_664.md)을 따른다.

## Issue #666 — U4 독립 모듈 검증 경계

[Work Packet](exec-plans/active/ISSUE_666.md)의 신규 axis transaction·전용 Unit/설치 Core fixture는 SC-08/09/10/12/14 중 날짜축·실제 geometry·원래 lease·cleanup 범위를 검증한다. 실제 wheel/reveal/query·hidden/zero-size·capacity 부족은 성공 위치와 별도로 typed 결과 및 관측 source를 기록한다. SC 등록 manifest·fake Unit·실제 합성 Core·제품 E2E·원격 CI는 서로 다른 증거다.

U4는 production consumer0인 준비 모듈이다. SC-10의 전체 bookmark/receipt 재사용은 U3/U5, SC-12 제품 marker/Grid 정렬과 작은 화면은 U5/#573, SC-14의 실제 대량 제품 lifecycle 및 전체 SC-01~14 통합은 U5/#574 후속이다. 규범1.0.0-candidate/REVIEW_PENDING, 기존 manifest와 테스트 허용오차·timeout·skip·Required gate는 변경하지 않는다.
