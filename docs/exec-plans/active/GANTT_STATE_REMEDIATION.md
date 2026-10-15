# Gantt 상태 정합성 구조적 보완 실행계획

작성: 2026-10-13 / 문서·계획 이슈 #661 / 제품 통합 #552(PR #561) / 기존 Epic #567.
상태: PLAN_REGISTERED; 제품 수정 NOT IMPLEMENTED, 검증 NOT TESTED.

## 기준선과 이번 승인

문서 base main: `89f4ab7936fe74062f0398601d4a6596e3e51924`.
제품 분석 Head: `d9334c30c6c262d9089ac8ad99008587435092ed` (#2682); 직전 비교 `ea25c48115cad88bfbbf182c1f33700c21c4c2f3` (#2679).
문서 branch: `docs/issue-661-gantt-state-standard`. baseline은 증거용이며 실제 구현/병합 직전 refs와 변경 파일을 재조회한다.

이번 요청은 구조적 보완 계획·장기 지침·AGENTS 필수 참조·독립 구현 이슈 등록까지다. 제품 코드/기존 PR Head/CI 정책을 변경하거나 PR 병합·Main CI·GHCR·기존 이슈 종료를 하지 않는다. 문서 PR 생성으로 저장소가 자동 실행하는 검증은 문서 변경의 검증이며 #552 재구현 CI가 아니다.

## 장기 원본

- [상태 정합성 표준](../../GANTT_STATE_CONSISTENCY.md): GSC-01~12, 규칙의 단일 원본.
- [누적 검증 매핑](../../GANTT_STATE_CONFORMANCE.md): SC-01~14와 증거 계층.
- [Adapter ADR](../../GANTT_ADAPTER_ADR.md), [Sync Trace](../../GANTT_SYNC_TRACE.md): 기존 설치2.7.3 결정·진단·예외 원장.
- [AGENTS](../../../AGENTS.md): 참조 의무/Work Packet/결과 보고 진입점. SECURITY/QA/릴리스 권한은 기존 정책 우선.

## 분리 원칙

독립 단위는 별도 branch·파일 소유권·mockable 계약·자체 테스트·되돌릴 수 있는 변경을 뜻한다. 모든 이슈가 선행 없이 동시에 제품에 활성화될 수 있다는 뜻이 아니다. U1 계약 동결 후 U2/U3/U4는 병렬 개발할 수 있고 U5는 유일한 제품 wiring 소유자다. 기존 큰 파일을 여러 에이전트가 동시에 수정하지 않는다.

## 단위별 범위

| ID | 구현 단위 | 주요 소유 경로(구현 시 존재/분기 확인) | 독립 완료 / 통합 조건 |
| --- | --- | --- | --- |
| U1 / #663 | 공통 state/port/recovery 계약과 누적 하니스 | 신규 `src/features/gantt/state-consistency/**`, `tests/fixtures/gantt-state-consistency/**`, 신규 `tests/config/gantt-state-conformance.json` 및 전용 Unit | 가짜 API만 아닌 drift/identity/order/unknown-result 반례 모델, machine-readable manifest, 기존 진단 재사용. 제품 연결하지 않음 |
| U2 / #664 | actual Core 기반 canonical 정합/실패 복구 | `canonical-snapshot-sync.ts`, 신규 `core-conformance.ts`/`canonical-recovery.ts`와 전용 tests | 412/422/500/네트워크, 같은 revision drift와 정상 no-op 동시 검증. public API 비교/차이 적용. viewport writes 없음 |
| U3 / #665 | 의미 기반 observation/receipt 재사용 | `viewport/projection-observation.ts`, `projection-settled.ts` 및 전용 tests | dirty Core/새 의미면 무효, 동일 의미 재관측은 무해; data receipt와 viewport settle 분리. Core/DOM 쓰기 없음 |
| U4 / #666 | 날짜축 transaction·물리 geometry·X/Y 정책 | 신규 `viewport/axis-transaction.ts`, 필요 시 `timeline-range.ts`, 전용 port adapter fixture/tests | 설치2.7.3 실제 browser로 대안 비교·선택, zero rows/axis/scroll/user-cancel 불변식. production port 연결은 U5에 handoff |
| U5 / #667 | 제품 Coordinator·Workspace 연결 및 레거시 제거 | `project-gantt.tsx`, `viewport/viewport-coordinator.ts`, `viewport/svar-viewport-port.ts`, `project-readonly-view.tsx`, 필요 최소 연결부와 해당 E2E | U2/U3/U4를 실제 호출하고 redundant early-return/restore 경로 제거; SC 누적 통과. 기존 #552/PR #561 유지 |

각 모듈의 기존 함수 signature를 불필요하게 깨지 않는다. adapter outputs/input port는 U1으로 고정하고 U2/U3/U4 사이 직접 구현 의존을 만들지 않는다. 기존 main에 없는 #552 전용 코드를 공통 모듈 PR에 통째로 이식하지 않는다. MODULE_READY와 실제 제품 적용 완료를 구분한다. 기존 호출자가 사용하는 공통 함수를 수정할 경우 U2/U3/U4는 별도 opt-in facade로 준비하여 U5 이전 제품 행동이 달라지지 않도록 검증한다.

## 작업 순서와 PR 전략

```text
#661 문서/지침 PR 검토 및 main 반영 (별도 승인)
          |
       #663 U1 계약·하니스
          |
          +---- #664 U2 canonical 복구 ----+
          +---- #665 U3 observation -------+---- #667 U5 제품 연결 (#552 PR #561)
          +---- #666 U4 axis transaction --+                 |
                                                     #573 기존 390px 범위
                                                               |
                                                     #574 최종 통합 검증
                                                               |
                                                     #552 최종 CI/QA/승인
```

1. #661은 main 기반 독립 문서 PR이다. 제품 PR #561에 섞지 않으며 기존 docs/보안/릴리스 정책 의미를 보존한다. main 적용은 별도 Owner 승인과 기존 gate 후이다.
2. #663/U1은 문서가 반영된 최신 main에서 별도 issue branch/PR. 공개 계약과 test-only 기반이며 제품 행동 활성화 없음. 승인된 merge/main 증거와 interface fingerprint를 인계한다.
3. #664/U2, #665/U3, #666/U4는 U1이 통합된 같은 main에서 별도 branch/PR로 개발한다. 파일이 분리되어 parallel 가능하나 각각의 latest-main 정렬/Required CI/QA/병합 gate를 수행한다. 권장 merge 순서는 U2 → U3 → U4이며 실제 공유 파일이 생기면 순차 인계한다.
4. 모듈은 U5 전까지 제품에 연결되지 않은 준비 상태다. 모듈 CI가 #552 실패 해결 증거는 아니다. 부분 탑재를 사용자가 볼 수 있는 완료로 표시하지 않는다.
5. #667/U5는 공통 모듈이 포함된 main을 기존 #552 branch에 정렬하고 기존 PR #561에서 제품 연결을 전담한다. standalone `Refs #552` primary 귀속은 보존하고 U5는 관련 이슈로 연결한다. U5 구현을 위해 새 main 대상 중복 제품 PR을 만들지 않는다. 충돌에서 main의 감사/CI 변경과 #552 기능을 모두 보존하고 force-push로 이력을 지우지 않는다.
6. #573과 U5가 같은 adapter/연결 파일을 동시에 쓰지 않는다. U5 local 통합 후 #573 담당에게 동결 source를 전달한다. 이미 해결된 항목은 같은 source의 AC 증거로 확인하고 미해결 변경은 해당 담당자가 제안하되 제품 연결 적용은 U5 단일 작성자가 순차 수행한다. 별도 stacked PR이 꼭 필요하면 Manager가 실제 base·gate·승인 경로를 먼저 기록한다.
7. #574를 최종 cross-feature gate로 재사용한다. #553의 교환 기능을 대신하지 않는다. 전체 #552 최종 병합은 누적 시나리오와 #573/#574 적용 가능한 기준이 충족된 후 별도 승인으로 수행한다.

모든 실제 병합/Main/릴리스 수행은 각각의 승인 범위와 기존 lifecycle을 따른다. 구현 이슈 등록이 실행·병합·release를 자동 승인하지 않는다.

## 기존 이슈와 중복 방지

| 기존 이슈 | 이번 계획에서의 관계 |
| --- | --- |
| #568 | 원본 계측/trace 재사용. 진단 서버/두 번째 writer 신규 생성 안 함 |
| #569 | 설치 버전 ADR/PoC 기반. 과거 DEFER를 자동 ACCEPT로 바꾸지 않음 |
| #570 / #571 | 기반 설계 유지, actual Core/no-op/semantic observation/axis 부수 효과의 부족 경계만 보완 |
| #572 | Inline 저장·확정·표시 계약 유지; 새 gateway로 우회하지 않음 |
| #573 | 좁은 화면 geometry/focus 기존 범위 그대로 검증·보완 |
| #574 | 통합 QA·누적 traceability 최종 소유. 중복 최종 QA 이슈 생성 안 함 |
| #553 | JSON/Excel/SVG/PNG 등 기존 데이터 교환 인수는 별도 |
| #659 / PR #660 | CI fail-fast/Fast Gate 별도 infra. 이 계획의 코드/문서 변경으로 workflow 정책 덮어쓰지 않음 |

## 파일 소유권과 변경 제어

`project-gantt.tsx`/`project-readonly-view.tsx`/production Coordinator/port는 U5 단독 소유다. U2/U3/U4는 public facade 또는 fixture로 독립 검증하고 wiring patch 제안은 반환 자료로만 제출한다. U1 공통 타입 수정이 필요하면 소비 이슈와 변경 명세를 먼저 합의해 같은 인터페이스로 재정렬한다. 문서 본문은 표준 소유자가 통합하고 각 구현자는 자신의 Work Packet·검증 자료를 갱신한다.

규범·관측·제품 실행의 동일 파일 동시 쓰기, 확인되지 않은 shared worktree, CI 진행 중 무계획 연속 commit을 금지한다. 독립 Reviewer가 실제로 존재하지 않으면 독립 검증 PASS를 주장하지 않는다.

## 완료 및 롤백

U1 완료: 타입/port 계약·SC manifest·negative cases와 독립 test runner 증거. U2/U3/U4 완료: 모듈 테스트 + 기존 관련 회귀 + 설치 Core 검증 필요 범위, no activation. U5 완료: 실제 제품 source에서 SC-01~14 및 기존 통합 회귀; #573/#574 판정과 전체 exact-head Quality/E2E/Docker, 현행 QA/Owner 승인. 각 단계의 gate 실패 시 다음 활성화 단계로 넘기지 않는다.

롤백은 문제 단위의 커밋과 그 소비 연결부를 함께 되돌린다. DB migration/서버 데이터 수정은 비범위다. U5 연결을 되돌리면 새 모듈이 사용되지 않는 상태가 되며, 원래 #552의 알려진 실패가 다시 존재할 수 있으므로 rollback을 정상화 PASS로 표시하지 않는다. 불명확한 저장은 최신 서버 확인 전 재전송하지 않는다. 복구를 위해 동기화 규칙·기존 테스트를 삭제하거나 새로운 상시 복원 루프를 추가하지 않는다.

## 이슈 등록표

| 단위 | 실제 이슈 | 선행 / 상태 |
| --- | --- | --- |
| U1 | [#663 공통 계약·하니스](https://github.com/planner77/masterGantt/issues/663) | #661 문서 승인·main 반영 후 / PLANNED |
| U2 | [#664 실제 Core 정합·복구](https://github.com/planner77/masterGantt/issues/664) | #663 / PLANNED |
| U3 | [#665 의미 기반 관측·receipt](https://github.com/planner77/masterGantt/issues/665) | #663 / PLANNED |
| U4 | [#666 날짜축 transaction](https://github.com/planner77/masterGantt/issues/666) | #663 / PLANNED |
| U5 | [#667 제품 통합](https://github.com/planner77/masterGantt/issues/667) | #664/#665/#666 통합 source / PLANNED |
| 390px 검증 | [기존 #573](https://github.com/planner77/masterGantt/issues/573) | #667 동결 candidate와 순차 인계 |
| 최종 통합 검증 | [기존 #574](https://github.com/planner77/masterGantt/issues/574) | #667/#573 적용 가능 기준 완료 후 |

의존성은 이 표와 이슈 본문에 기록했다. GitHub의 native blocked-by/sub-issue 관계가 자동 설정되었다는 의미는 아니다. 구현 시작 전 최신 이슈/PR 상태를 다시 확인한다.

## 결과 기록

문서 구조/링크/정책 보존과 제품 Unit/E2E/remote CI를 분리한다. 본 계획에 적힌 명령/수용 기준은 실행 결과가 아니다. 실제 검증·미검증·독립 검토·main 적용은 [#661 Work Packet](ISSUE_661.md)에 기록한다.

## 2026-10-15 — #663 U1 구현 착수

선행 #661 문서 PR #669는 main에 병합되었다. 최신 main `b09c3148df037acdecc9b0687e0dd4d3051c96a4`/application0.114.0에서 [#663 Work Packet](ISSUE_663.md)의 공통 타입·읽기 포트·SC manifest/음성 하니스·synthetic 실제 Core fixture를 구현한다. 현재 요청은 PR CI 시작까지이며 main 병합·U2/U3/U4 선행 완료·MODULE_READY 최종 판정은 아직 아니다.

U1의 public entry는 `src/features/gantt/state-consistency/index.ts`다. 생산 코드의 import·동작 변경0을 유지한다. U2/U3/U4 concrete 구현 없이 기존 authority의 type-only 계약과 public serialize reader만 제공하며 SC 등록과 실제 제품 실행을 구분한다. 원래 파일 단독 소유·후속 병합 순서·#552/#573/#574/#553 경계와 rollback 계약은 불변이다.

## 2026-10-15 — #664 U2 구현 착수 / U1 main 선행 완료

#663 / PR #687은 main `d445ec58bf9106414c99a150ee8f52599834baf9`에 통합되어 Issue CLOSED이며 이를 U2의 공통 interface 기준 SHA로 고정한다. 이는 위 U1 착수 당시 미통합 기록을 소급 변경하지 않는다. #664는 [Work Packet](ISSUE_664.md)에 따라 실제 Core 기반 no-op·확정 거부/결과 불명확 복구 모듈과 전용 Unit/합성 browser fixture를 준비한다.

기존 sync 함수·U1 interface/manifest·U5 production 파일은 유지한다. U3/U4 concrete import와 제품 소비자0이며 U5에 public exports·dirty/request/API 무효화·GET/권한/쓰기 차단·후속 검증을 인계한다. 현재 종료점은 문서·사전 검토·리뷰/충돌 확인 뒤 PR CI 시작이다. 모듈 최종 수용/main 통합·#552 해결·#573/#574 종단 검증은 별도다. application0.114.0 유지, HIGH/OWNER_MANAGED/qa_required=true, release_required=false/release_authorized=false.

## 2026-10-15 — #665 U3 독립 구현

U1 #663/PR #687은 main `d445ec58bf9106414c99a150ee8f52599834baf9`에 병합되었다. [U3 Work Packet](ISSUE_665.md)은 이 exact interface를 기준으로 의미 관측/receipt facade를 독립 구현·검증한다. U2/U4 concrete 코드·제품 writer는 참조/변경하지 않는다. U3 source·public API/typed outcomes·attempt/semantic ID·actual proof/source invalidation 책임·원래 lease와 수평 복원 독립을 #667에 인계한다. 신규 제품 wiring은 U5만 소유하며 actual Calendar·Resource·filter bookmark의 제품 증거는 #574와 별도로 확보한다.

요청 종료점은 문서·사전 검토·미해결 리뷰/충돌 처리 후 Full PR CI 시작이다. U3의 로컬/fixture PASS를 최종 MODULE_READY·제품 해결·원격 CI·Owner ACCEPT로 확대하지 않는다. 위 이슈 등록표의 PLANNED는 등록 당시 원장이며 현재 구현/검증 결과는 각 Work Packet과 실제 GitHub 상태를 따른다.
