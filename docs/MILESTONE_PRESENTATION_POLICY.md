# Milestone Presentation & Rollout Policy

Decision: #548 / 2026-10-15. Status: PROPOSED until reviewed/merged. Related: #459–#464, #549–#553, #567/#573/#574, #661/#663–#667, optional marker #693.

## 1. 결정과 적용 범위 (Current → Target)

Milestone은 프로젝트 시점형 Stage Gate이자 Task 취합·진척·Ready/Completed·Resource/Target Roll-up의 분류 원장이다. **Milestone을 일정 WBS Grid/Chart의 작업 행·Bar로 그리는지는 도메인 정의와 별개의 화면 선택**이다.

- Current main (2026-10-15 기준): 기존 native Milestone 행/Bar와 유형 빠른 보기 유지. #551 앱 소유 상단 Timeline capability는 production 기본 OFF.
- **Baseline target (#552):** 일정 Grid/Chart는 Summary 및 일반 Task만 표시. Milestone native row/bar는 **0건**. Milestone Stage Gate는 기존 Dashboard·Editor·소속 Task 필터·Resource/Target 보고서에서 관리. **상단 Timeline marker는 OFF이며 운영 기본 경로/필수 acceptance가 아니다.**
- Optional last (#693): #552·#553·#574의 marker-OFF 기준선이 독립적으로 수용·main 통합된 **이후** owner가 필요성을 판단한 경우에만 기존 #551 lane을 별도 PR·feature gate로 활성화한다. #573은 marker-ON의 Geometry/Focus/390px 기술 게이트이며 marker-OFF baseline 배포를 차단하지 않는다.

이 결정은 #548의 과거 '상단 marker 기본 ON', #552의 'Milestone 표시 ON/OFF·해당 날짜에서 보기 시 일시 ON'이라는 **기존 목표 중 presentation 부분만 대체**한다. #459–#464의 도메인 계약·이미 완료된 #549–#551/#568–#572 commit/실험의 역사적 사실을 고치지 않는다. 필요한 변화는 각 신규 PR에서 재검증한다. Docs-only 결정은 제품이 이미 marker-OFF 별도 WBS가 되었다는 증거가 아니다.

## 2. 보존해야 할 도메인 계약

- Canonical Task identity: 기존 `type=milestone`, `duration=0`, `taskId`, `parent/siblingOrder`, 일정·status/progress·Link·explicit Membership/상속·Stage Gate 유지. DB/revision/identity 마이그레이션·Task 데이터 삭제·일괄 root 이동 없음.
- WBS(parent) ≠ Milestone Membership ≠ Task Dependency ≠ Milestone Dependency. Task/Summary는 유효 Milestone 최대 1개(상위 Summary 명시값 상속·더 가까운 명시값 override), Milestone 자체는 member Task 아님. 날짜순으로 업무 단계 의존을 유추하지 않는다.
- 전체 Stage E(M) 고유 일반 Task와 직접 선행 Milestone P(M)로 Ready/Blocked를 판정하고 명시 Completed와 구분한다. Summary·Milestone은 공수/작업 가중치에 중복 포함하지 않는다. 필터로 보이는 일부 Task만으로 전체 Stage Ready를 계산하지 않는다.
- 기존 #613 Resource/Target: 전체/선택 Target/작업상속 provenance, distinct Assignment M/D·M/M, capacity/전체부하, 정확 Task/Assignment 편집·조회 identity를 그대로 유지한다. Milestone 표시 OFF가 Roll-up 필터/공수 분모를 바꾸지 않는다.
- Milestone은 '시점 체크포인트'다. 기간을 가진 별도 Phase 엔터티·일정 자동 생성·단계 순번·마커 PRO API 지원을 이번 변경으로 가정하지 않는다.

## 3. 두 독립 화면 축

| WBS mode | Marker gate | 상황 / 허용 여부 |
| --- | --- | --- |
| `legacy` | OFF | #552 전 현재 main; 또는 명시적 비상 복구. Native M row 존재 |
| **`separate-milestones`** | **OFF** | **#552 기준선 목표**, Native M row/bar 0, Dashboard·Stage/Task Roll-up 정상 |
| `separate-milestones` | ON | #693 후속 *선택적* 사용, 같은 canonical M ID의 앱 소유 lane |
| `legacy` | ON | 중복 표시 위험으로 지원하지 않음. 명시 reject/강제 OFF |

현재 코드 `buildProjection(... displayMode: "compatibility" | "separate-milestones")`가 준비되어 있어도 실제 호출자 전환·필터·링크/계층/선택 안정성은 #552의 구현/검증 대상이다. #551 `MilestoneTimelineCapability` 기본 OFF는 기술 기반이고, **UI 토글이 행 표시 모드를 제어하도록 혼용하면 안 된다.** 두 축을 하나의 `Milestone 표시`로 저장·변경하지 않는다.

### Marker OFF 불변식

OFF는 CSS-only 숨김이 아니라 **그 기능의 실제 부작용 중단**이다. production 마커 전용 lane DOM/예약 높이/guide·listener·ResizeObserver·RAF·숨은 Milestone date reveal·마커 목적의 자동 resize/scroll은 실행하지 않는다. 원래 Task의 날짜축/scroll/filter/Resource 복귀/정합성 명령은 정상 유지한다. #551의 dev-only technical preview는 명시적 nonproduction opt-in이며 운영 gate 우회 수단이 아니다.

Milestone 날짜는 Dashboard 상세에서 확인한다. '해당 날짜에서 보기'는 운영 marker OFF에서는 숨은 native 행 선택, 임시 marker ON, 무단 날짜축/scroll 조작을 하지 않고 **Dashboard 상세/소속 Task 보기**의 명시 안내·탐색으로 전환한다. 날짜 밖/날짜 미정/소속 Task 0/검색0 결과는 다른 상태로 설명한다. Admin/readonly/dirty/401/412/응답역전에서도 기존 Editor·Gateway 권한과 포커스 복귀를 보존한다.

WBS에는 일반 Task/Summary만 유지한다. Milestone 자체의 Grid/Chart 행·Bar·native milestone Link 선을 제외하되, 일반 Task↔Task dependency는 보존한다. 숨은 Milestone이 속한 Summary의 날짜·기존 roll-up/canonical subtree, 외부 legacy mixed Link, Copy/Cut/Move/Delete의 서버 보호와 영향 설명은 **전체 canonical** 기준이다. Scope/필터의 Milestone-only legacy 선택은 0행을 정상 전체 Task로 속이지 않고 Dashboard 안내·명시 해제 경로를 제공한다.

## 4. 구현 순서 및 브랜치 소유권

`#667(U5, main-first) → #552(행 제거·marker OFF) → #553(Export/Copy/Template no-loss) → #574(marker-OFF 통합 E2E/수용) → [선택] #573(marker-ON 기술 gate) → #693(marker 독립 opt-in/롤백/운영 수용)`

1. **#667 main-first:** 이미 main에 들어온 U1~U4 (#663~#666)를 실제 ProjectGantt/Workspace/Coordinator에 연결해 GSC SC-01~14 공통 회귀를 검사한다. #552의 marker-ON·native M 행 제거는 포함하지 않는다. **새 main 기반 PR은 기존 #552 PR의 중복 구현이 아니라 공통 안정화 전용**이다. #674/PR #675의 동일 `project-gantt.tsx` 충돌을 정렬하거나 명시 handoff한다.
2. **#552 marker-OFF:** 기존 PR #561의 이력을 보존하며 최신 main(#667 포함)으로 정렬. `"separate-milestones"`를 활성화하지만 `milestoneTimeline.enabled=false`를 운영에서 보장한다. 기존 marker 기본 ON/일시 표시와 날짜 reveal 및 coupled preference/scroll 경로는 제외 또는 dead-code 제거. WBS mode emergency rollback은 별도 gate로 시험. 기존 #563 test PR은 최신 #552 계약으로 정렬·조정; 무단 자동 병합하지 않는다.
3. **#553 marker-OFF 인수:** 기존 stacked PR #562는 #552의 새 Head/base 이후 정렬. WBS 밖 Milestone/Link/Membership이 JSON·Excel·SVG·PNG·Copy·Template에서 유실되지 않는지 검증. Image export에 실제 화면/Canonical 차이를 명시. 제품 코드 변경 및 테스트는 각 PR에서 검증하고 후속 이슈로 모두 미루지 않는다.
4. **#574 기준선 QA:** 390~1920px, Day/Week, full/split, 일반 Task/empty/M-only, Resource·Target/Calendar/peer, filter0, 401/412/422/500/unknown, 다중선택·관계·스케줄·API/DB/Export, SC-01~14의 marker-OFF 관련 사례를 같은 Head/source에서 실행. #573 marker-ON Geometry gate가 아니라도 marker-OFF baseline은 완료 가능하다. 원본 E2E의 시각 기대를 바꾼 경우 보호하던 ID/원본·무mutation·권한·focus 단언을 새 경로에 대응시킨다.
5. **후속 Optional:** #573은 marker-ON 390px/기하/날짜/접근성 TECH 게이트이며 #693 활성화 PR이 별도 Rollback·Owner 수용을 갖는다. 같은 파일 동시 writer 불가. marker-ON 출고는 필수가 아니며 Owner가 취소/DEFER해도 marker-OFF 기준선을 유지한다.

#667/ #552/ #693이 수정하는 `project-gantt.tsx`, `project-readonly-view.tsx`, `viewport-coordinator.ts`, `svar-viewport-port.ts`는 순차 **단일 작성자**. #573은 marker-on 검증 전용으로 ownership handoff. #553와 #574는 데이터 교환/QA 범위를 분리한다. base/head/test-merge 및 package lock fingerprint는 각 Work Packet에서 실행 시 재조회한다.

## 5. 롤백 가능한 기능 분리 (필수 Gate)

- **Baseline rollback:** #552의 별도 WBS mode를 `legacy`로 복귀하는 보호된 계획을 준비·시험. 기존 native row 재등장은 #552 자체 실패 시에만 허용하며 marker ON과 무관하다. 구 모드에서도 DB canonical·selection·filter·Task/Link/Resource state/viewport 보존을 검증한다. 프로필별 fallback이 허용되지 않으면 진입을 fail-closed한다.
- **Marker-only rollback (향후):** #693은 별도 독립 feature gate 기본 OFF를 제공한다. OFF로 전환 후 marker-only DOM/observer/RAF/명령=0, baseline WBS mode와 Dashboard/Resource 변동0을 실제 시험한다. 설정이 **런타임 즉시** 변경 가능한지는 구현·운영 검증 후 기록하며 env/build-time이면 재시작·재배포가 필요할 수 있다. '설정만 바꾸면 항상 무중단 롤백'이라고 미리 주장하지 않는다.
- **Code rollback:** marker 전용 코드/Commit을 `git revert`하는 별도 PR + 새 Quality/E2E6/Docker·Trusted QA·Owner Gate. 단일 제품 PR에 WBS 제거와 marker ON을 섞지 않고 단일 이미지에만 종속시키지 않는다. tag/DB/digest를 과거로 강제 이동하지 않는다.
- Marker OFF에서도 필요 없는 marker probe가 production에 남거나 date/layout side effect가 살아 있다면 'marker rollback PASS'가 아니다. 사고 전/후 실제 DOM·Core/native X/Y·API·Task/Link/Assignment·revision을 대조한다.

## 6. 수용/실증 매트릭스

| ID | Marker-OFF baseline (필수) | Marker-ON optional (후속) |
| --- | --- | --- |
| MP-01 | native Milestone Grid/Chart row·Bar·바꿔치기 endpoint 0, Summary/Task 계층·날짜 보존 | same |
| MP-02 | Dashboard에서 M 조회/생성/수정/삭제/완료·재개·상속·관계·직접/전체 소속 Task 탐색 | marker→동일 ID의 Editor/목록, 숨은 native 선택 없음 |
| MP-03 | Full canonical E(M)/P(M)/Ready/Completed/roll-up 및 Resource/Target grain·출처·개인 capacity 유지 | same |
| MP-04 | 필터·scope·검색0·M-only·Task0·날짜 미정·readonly/permission·dirty/stale·selection/clipboard 안전 | same |
| MP-05 | hidden subtree Copy/Cut/Move/Delete 및 mixed Link와 완료 잠금·원자 rollback, 표시 전환 server mutation0 | same |
| MP-06 | JSON/Excel/SVG/PNG/Template full loss guard와 import/exchange 통합 | export 범위/표시 안내 일치 |
| MP-07 | lane DOM/공간/marker-only subscription/RAF/scroll/write 0; 일반 Task 동작 unchanged | lane 실제 tick/date/Chart native x/y 안정 |
| MP-08 | SC-01~14 중 marker-OFF 적용 회귀 + Gantt Core instance/Viewport/UserIntent, 5폭 Day/Week/Fullscreen | 기존 strict coordinate ±1px 및 390px fail-closed |
| MP-09 | 운영 marker-OFF 기본, WBS 별도 행 mode와 독립 | flag ON/OFF/ON 후 구독 중복0·clean restore |
| MP-10 | #552 WBS legacy emergency rollback probe·revert 계획·생성 data0 | #693 flag OFF + 독립 revert rehearsal |
| MP-11 | exact source/browser/HTTP·SQLite/Quality/E2E6/Docker/Trusted QA, 미실행은 NOT TESTED | #573 실제 TECH gate 및 marker PR의 같은 gate |
| MP-12 | 기존 보안·Origin/If-Match/revision·Resource Plan/Excel·SVAR Core 2.7.3 기준 보존 | SVAR PRO/private Store API 미사용 |

검증 중 마커 ON에서 실패해도 marker-OFF의 원시 수용 결과는 거짓 PASS로 소급하지 않고, ON의 해당 결과만 FAIL/DEFER로 구분한다. skip/timeout/허용오차 완화로 #552 수용을 조작하지 않는다.

## 7. 공식 API / 기존 문서 / 승인 경계

- [공식 Willow Demo](https://docs.svar.dev/react/gantt/samples/#/base/willow), [filter-tasks](https://docs.svar.dev/react/gantt/api/actions/filter-tasks/), [markers](https://docs.svar.dev/react/gantt/api/properties/markers/). URL·새 공식 사이트와 설치 2.7.3 runtime/실제 browser PASS를 구별한다. SVAR markers는 PRO-only이다.
- [Milestone 도메인](MILESTONE_STAGE_GATES.md), [Gantt Sync 원칙](GANTT_STATE_CONSISTENCY.md), [화면 계약](PROJECT_UX.md), [단계별 계획](exec-plans/active/GANTT_STATE_REMEDIATION.md), [QA](GANTT_STATE_CONFORMANCE.md), [기존 표시 연구](MILESTONE_TIMELINE.md).
- 이번 문서·이슈 변경은 IMPLEMENTATION/CI/Owner RELEASE/GHCR 권한을 뜻하지 않는다. 명시된 Phase별 각 PR의 독립 검토·exact SHA gate 및 Owner 승인 이후에만 병합/운영 활성화. marker ON은 추가 선택적 승인 대상이다.

## Decision log
- 2026-10-15 — #548/#552/#667 방향 조정: marker-OFF WBS 분리 먼저, marker ON을 마지막 독립 issue #693으로 이관. 회귀로 인한 rollback/운영 영향 최소화. 기존 #551 구현·역사적 원장 보존.
