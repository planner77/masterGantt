# ADR-674 — #659 Main CI용 개발 진단 API identity 동기화, U5 소유 파일의 한정 예외

- 기록: 2026-10-14 KST
- **결정 상태: ACCEPTED (Manager 한정 예외; 제품 기능·릴리스 승인 아님)**
- 승인 범위: 사용자가 직접 요청한 `#659 Main CI 실패 보완 후 새 CI 시작`에 필요한 **개발 진단 코드만**. Repository Manager의 본 한정 정합성 설계 예외 기록이며 **Owner의 GSC 전체 완료/제품 U5 통합/릴리스 위험 수용이나 브랜치 보호 우회 승인이 아님**.
- 예외 소유: #674 수정 PR #675 담당 / 후속 U5 #667 및 PR #561의 단일 통합 소유자에게 귀속 인계
- 규범: `GSC 1.0.0-candidate` (상태 `REVIEW_PENDING`) / source main `e195780227a504536d0d9f7f27924f24267f8caf` / 설치 `@svar-ui/react-gantt` 2.7.3. 읽은 source: `docs/GANTT_STATE_CONSISTENCY.md`, `docs/GANTT_STATE_CONFORMANCE.md`, `docs/GANTT_ADAPTER_ADR.md`, `docs/GANTT_SYNC_TRACE.md`, `docs/exec-plans/active/GANTT_STATE_REMEDIATION.md` (위 main), 관련 `AGENTS.md`와 `ISSUE_551.md`.
- 대상 파일: `src/features/gantt/project-gantt.tsx`의 **non-production `installMilestoneProbe` 내 1회 호출만**, `src/features/gantt/gantt-api-identity.ts` 순수 도우미, `tests/gantt-api-identity.test.ts` 단위3, 문서. 제품 Canonical Reconciler/Observation/Axis/Coordinator, port, interactive control/Viewport owner와 어떤 연결도 변경하지 않음.

## 문제와 대안

[Main CI #2712.1](https://github.com/planner77/masterGantt/actions/runs/38470067933)의 단일 5초 timeout은 #551의 **1,000 Task + 2,000 Milestone 실제 browser**에 대한 `data-project-gantt-api-instance`와 test-only `__masterganttMilestoneTimeline.instance` 동일성 검증 실패다. `initialize(api)`에서 dev probe는 즉시 게시되지만 공개 data-attribute는 React `setApiInstanceId` 이후 비싼 projection/render에 의존한다. 이는 실증된 소스 순서 경계이며 정확한 CPU timing은 Trace 전 미확정이다.

- **A: U5 #667 완료까지 보류**: U5는 선행 U1/U2/U3/U4 및 #552 PR #561 제품 통합 소유; 현재 계획 단계이며, 이 해결을 거기에만 넘기면 이미 병합된 #659의 Main CI 실패 회복이 불가능하다.
- **B: 기존 5초 timeout 증가/retry/skip**: GSC-08/11·SC-14의 대량 실제 browser readiness 증거를 약화하여 **REJECT**.
- **C: 새로운 probe/false identity 또는 직접 Core mutate**: source ownership·보안과 정합성이 무너지므로 **REJECT**.
- **선택 D (본 한정 예외)**: 실제 `initialize(api)` callback이 생성한 정확한 ID만 **이미 연결된 frame.dataset**에 probe와 같은 동기 호출에서 게시한다. React는 다음 commit에서 **동일한 ID**를 reconcile. `NODE_ENV==="production"`에서는 code path 미진입, `isConnected=false`에서도 표시하지 않으며 다른 observer/timer/polling을 추가하지 않는다.

## 적용 GSC 및 Writer 영향

| 적용 규칙 | 본 변경 준수 | 검증 경계 |
| --- | --- | --- |
| GSC-01/02/03 | canonical Project/Task/Link/revision/projection/실제 Core 데이터에 쓰지 않음 | `installMilestoneProbe`는 dev-only frame attribute만 설정 |
| GSC-04/05/06/07 | scroll/chart resize/sync queue/lease/receipt/axis writer 불변, 두 번째 Coordinator 없음 | `project-gantt.tsx` viewport core/command 로직 diff 0 |
| GSC-08 | **실제 init ID 표시 준비**와 Core/DOM/layout settle **명확히 별개**. 이 ID를 geometry PASS로 간주 안 함 | E2E 5초의 identity 조건 그대로, geometry/scroll 검증 후속 |
| GSC-09 | 같은 native API instance의 동일 ID만 게시; 새 init은 이전 값 대체; unmounted frame 무변경, Gantt remount 유도 없음 | unit 3-case; 기존 browser E2E |
| GSC-10 | 설치 Core 2.7.3 `init(api)` callback 그대로. private store 변경·PRO 참조 없음 | native init ID source assertion과 browser |
| GSC-11/12 | 전체 6-shard·3,000 fixture·5초·geometry·readonly/zero mutation 검증 보존; staged U5 단일 writer 예외 범위·증거/rollback 명시 | 본 ADR 및 Work Packet, Reviewer/Owner gate |

## SC-01~14 누적 적합성 계획

- **직접**: SC-07(API replacement/identity) — unit의 두 번째 init ID; SC-09(instance/selection 보존) — 기존 fixture; **SC-14(1,000+2,000 반복 mount/identity/readiness)** — 기존 E2E 정확 5초 및 unit; SC-12(날짜축/전체화면/resize/geometry) — 같은 #551 E2E.
- **관련 전체 회귀**: SC-01~06, SC-08, SC-10, SC-11, SC-13은 실제 제품 쓰기·조회/복구/관계/peer·Milestone의 기존 E2E를 **full PR/Main CI가 실제 실행한 경우에만** 증거로 사용한다. 이번 단독 fixture/헬퍼 Unit으로 이 상태전환 전부를 PASS로 승인하지 않는다.
- **미구현/증거 제한**: U1 machine-readable SC manifest와 U2/U3/U4/U5 실제 Core 통합 검증, #552 누적 최종 QA, #573/#574 조합은 그대로 **NOT IMPLEMENTED/NOT TESTED**. 본 dev 진단 변경이 제품 정합성 구조적 보완 완료를 의미하지 않는다.

## 예외의 위험·수명·인계

- 위험: U5 #667과 동일 파일을 변경하므로 통합 시 patch conflict 가능, React가 이후 상태로 data attr을 갱신할 때 ID 불일치 위험. 완화: 기존 `installMilestoneProbe` guard 영역으로 변경을 최소화하고 새/중복/분리된 frame Vitest, Gantt 실제 6-shard E2E 및 UI 전체 회귀, 정확 Head/base/QA Final 증거를 요구. 해당 파일의 **동시 병합 금지**, U5 작성자는 이 ADR/patch를 먼저 읽고 #552 기존 source와 3-way reconcile.
- U5 owner에게 **명시 인계**: 본 #674 PR의 최종 merge SHA, 변경 함수와 테스트, 필요 시 대체·제거할 기술 진단 코드를 #667과 #552 이슈에 남긴다. 구조적 U5 구현이 필요한 경우 해당 owner가 본 한정 patch를 같은 방식으로 통합하며 별도 제품 PR을 중복 생성하지 않는다.
- **만료**: #667 U5가 해당 initialization/observer 소유를 실제 채택하고 #552 PR #561에 병합하는 시점 또는 규범 정식 v1.0.0 Accepted에서 재검토. 그때 dev-only 직접 DOM stamp가 불필요해졌다면 제거한다. 만료 전에는 dev 진단 한정 소유 예외이며 새 기능 작성 허용권이 아니다.
- **롤백**: #674에서 추가한 `stampInitializedGanttApiIdentity` 호출·도우미·unit를 함께 되돌린다. E2E 원래 5초 FAIL 가능성을 명시하고 QA Final/CI가 PASS라고 우회 보고하지 않는다.
- 승인 경계: GSC 개정·Owner 제품 위험 승인·릴리스 승인은 별도. 변경 PR의 원격 Required Quality/E2E6/Docker와 QA Final/리뷰 0, 최신 Main 정렬 후 **사용자 요청의 병합** 및 새로운 Main CI가 실제 6-shard를 실행하는 증거 없이는 FINAL READY가 아니다.
