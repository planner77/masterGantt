# Issue #819 — 리소스 하위 화면 UI/UX 회귀 교정

## Issue Work Packet

- repository: `planner77/masterGantt`
- issue: [#819](https://github.com/planner77/masterGantt/issues/819)
- lifecycle_phase: PR_CI_READY
- goal: 프로젝트 → 대시보드 → 리소스 6peer의 설명 밀도·버튼/라벨 geometry·이름 우선·구획/강조 재발을 교정하고 지속 원칙을 DESIGN에 반영한다.
- requested_scope: 2026-10-27 재개 요청에 따라 분석·설계·구현·문서/누적 실패 원장 갱신, 미해결 리뷰·충돌 해결 후 PR Full CI 시작까지. 모니터링·병합·Main/GHCR/Release·Issue 종료는 이번 실행 범위 밖이다.
- non_scope: Gantt 활성 핸들 Bug #818, 전역 리소스 관리자·기준정보 전면 개편, 서버 계산/API/DB/권한/일정/Excel 형식 변경, 운영 환경 배포.
- baseline: `596dd70db8b242f450ab555ed2bcf049a0c14564`; 통합 main: `495027854c2ab73f7f91d0b6205c86397cff4497`
- branch/worktree: `fix/issue-819-resource-ui-consistency`, `/home/planner/Dev/masterGantt-ui-consistency`
- current_version: main `0.135.3` (착수 당시 `0.135.2`)
- candidate_version: `0.135.4`
- version_decision: 기존 기능/도메인 계약을 유지하는 UI/UX 회귀 교정이므로 PATCH. merge 전 main/tag 중복·drift를 재검증한다.
- release_required: true
- release_authorized: false
- authorization_evidence: 기존 [Owner marker](https://github.com/planner77/masterGantt/issues/819#issuecomment-6417490299)는 exact0.135.3 전용이다. main #818이0.135.3을 사용하므로 #819 후보를0.135.4로 조정하며 기존 승인을 새 버전으로 확대하지 않는다. 이번 범위는 PR CI 시작까지로 게시 승인이 선행 조건은 아니다.
- risk_level: HIGH
- risk_reason: 6peer 공통 presentation·포인터별 제어·이름/출처 노출·도움말/focus와 package/lock version 보호 경로. domain/API/DB/CI 정책 변경은 없다.
- qa_required: true
- qa_method: OWNER_MANAGED
- qa_review_mode: 별도 read-only ui_ux/qa_docs 사전검토 + default-main Trusted + exact Head Manager/Owner gate
- independent_qa: N/A(최종 Owner-managed 경로); 별도 Agent 사전검토는 실제 실행 범위를 따로 기록한다.
- manager_decision: NOT TESTED
- MERGE_READY: BLOCKED
- documentation_owner: Manager
- issue_comment_writer: manager
- issue_comment_allowed_types: PLAN, STATUS, EXCEPTION, DECISION, FINAL
- failure_ledger: [누적 실패 원장](../../ISSUE_819_FAILURE_ANALYSIS.md)에 직접/파생·준비 오류·취소·미실행과 원본/교정/최종 source 결과를 보존한다.

## 역할·소유권

| 주체 | 소유/책임 |
| --- | --- |
| `/root` Manager | 요구/범위·DESIGN/문서/Packet·version·통합/게시·Issue 기록·Manager gate |
| `/root/ui_consistency_design` ui_ux | 화면 인벤토리·설계/지속 원칙·구현 대조, read-only |
| `/root/resource_ui_implementation` frontend | `src/features/resources/**`의 해당 UI/CSS와 기존 E2E 확장·관련 로컬/실제 브라우저 검증 |
| `/root/resource_ui_qa` qa_docs | 기존 고유 기능/테스트 사전검색 및 code/test/docs/실제 증거 별도 read-only 사전검토 |
| `/root/ui_release_ops` infra | PR/Trusted/Main/Release/Finalizer 출처·승인·정상 운영 경로 조사/검증 |

다른 Agent의 편집을 되돌리지 않고 동일 파일의 writer를 하나로 유지한다. browser/build output은 frontend가 단독 소유하며 문서·정적 검토와 병행한다. 외부 Issue/PR 기록은 Manager만 작성한다. 원래 workspace의 미추적 자료와 기존 #816 worktree는 보존한다.

## 현재 상태·설계 및 상태 행렬

기존 #717/#719/#798/#799/#807/#808/#809는 원격 CLOSED이며 역사 검증을 새source PASS로 쓰지 않는다. 현재 `resource-workspace.module.css`의 전체 pointer44px·14px adapter와 chart CSS의44px/14px·정보값 min-height44가 compact 계약을 덮고 있다. ResourceWbsControls의 독립조건 설명·snapshot ID·기간 가져오기·재설명 적층도 발견했다.

기본 읽기 순서는 `6peer 탐색 → 조건/현재 범위 → 주요 KPI → 표/차트 → 보조 진단/Export`다. fine36px·13px/20px·수평10px control을 host에서 소유하고 coarse44px target을 보존한다. 6peer는 기본 현황·차트·동적 계층 탐색·Milestone 교차·Resource Plan·견적/Excel이며 세부 grouping/개인·차트3유형·Milestone/Plan·견적 기능은 유지한다. 이름/사용자 맥락 우선·기술정보 on demand, 반복 설명은 ContextHelp, 필수 범위/분모/단위·null/0/부분값·비가산/경고·권한/stale는 인접 표시한다.

| 상태 | 유지할 동작·표현 |
| --- | --- |
| readonly / edit | 조회·정확 원본 탐색은 기존 권한 gateway를 사용, UI 상태로 authorization 판단 금지 |
| loading / error / stale | 이전 결과와 새 확정 snapshot을 구분, 원인/복구 경로·필수 경고는 도움말과 함께 숨기지 않음 |
| empty / unset / partial / 0 | 서로 다른 의미·단위/분모를 유지, 임의 정상/오류색 통합 금지 |
| peer / 필터 전환 | 독립 selector·기간 명시 인계·선택/접힘/scroll/focus·늦은 응답 무효화 보존 |
| 도움말 / ID 상세 | 명명된 native trigger·keyboard/touch 접근, Escape/닫기 후 가시 trigger focus 복귀 |
| 좁은 폭 / coarse | 의미별 wrap/탐색 owner scroll, 문서 overflow0·표 내부 scroll, coarse44px·focus 비잘림 |

### Design Delta

A(지속 원칙): 새 peer/subview의 host 밀도·식별·설명·계층 상속과 회귀 소비자 검증을 DESIGN에 승격한다. B/C: 기존 compact/name-first/progressive disclosure의 Resource-local 수치·배치 교정. 기존 #807/736의 fine44px는 #819의 명시적인 fine36/coarse44 계약으로 수정하며 다른 화면의40/44px를 전역 일괄 변경하지 않는다. 새로운 테마/폰트/framework/SVAR private write는 없다.

## Gantt·상태 표준 적용 경계

- gantt_standard_version: `GSC 1.0.0-candidate`
- 문서 commit: baseline `596dd70db8b242f450ab555ed2bcf049a0c14564`의 GANTT_STATE_CONSISTENCY/CONFORMANCE·ADAPTER_ADR·SYNC_TRACE를 참조한다.
- 적용: GSC-01/04 원본 표시·쓰기 소유권, GSC-07 최신 사용자 의도, GSC-08 실제 완료 증거, GSC-09 인스턴스/접근성·focus 보존, GSC-11/12 누적 회귀/독립 대조. Gantt/Core/viewport·canonical writer를 수정하지 않는다.
- 누적 SC: Resource→정확 Task/Assignment→일정/원래 보고 복귀(SC-11), hidden/inert·filter/selection/focus/marker-OFF(SC-09/12/13)의 기존 고유 E2E를 보존한다. Core 날짜/정렬/거부 rollback 알고리즘(SC-01~08 등)은 제품 producer 불변으로 별도 로컬 전체 재실행에서 제외하고 원격 Full 회귀에 포함한다.
- exception ADR: N/A(표준/쓰기 소유권 변경 없음). 새 자동 policy/enforcement 구현을 주장하지 않는다.

## 공용 supplement interface 조정

Resource Export가 주요 표보다 먼저 적층되던 배치를 기존 after-table supplement 슬롯으로 옮기기 위해 `WbsViewConsumer.renderSupplement`의 optional 상태 `{locked, active, onStale}` 인자를 전달한다. Manager가 frontend의 해당 공유 interface 수정을 승인했다. 다른 consumer의 순서/조회/상태는 그대로이며 Resource의 기존 active·stale·잠금/취소 조건을 동일하게 전달해야 한다. 새 server/API·계산·mutation 또는 Gantt writer는 없다. 최종 소비자/음성 검토는 별도 qa_docs가 수행한다.

## AC_TEST_COVERAGE

- AC1: 기존 #736 Workspace/차트 E2E에서 6peer 전환·필터·상태/복귀와 기능 인벤토리를 검증한다.
- AC2: 기존 #719 및 #736의 Resource 도움말·keyboard/touch/Escape/focus·error/stale와 필수범위를 검증한다.
- AC3: 기존 #736/#730의 Resource-local fine36/coarse44·5폭 geometry·정렬/overflow를 확장한다.
- AC4: #736 원문/기술정보 경계와 기존 긴KO/EN/ID5폭·정확 canonical drill 회귀를 보존한다.
- AC5: 기존 차트3유형·Task/Assignment/T0/Project참고·Plan/견적/Excel의 단위/분모/partial/null/0를 검증한다.
- AC6: DESIGN/UX/가이드/TEST_PLAN/Packet/CHANGELOG 동기화·링크 및 별도 source/browser 증거 검토로 확인한다.
- AC7: 새 exact Head PR Required3/8shard·Trusted/Manager 이후 병합/Main/GHCR/Release/Finalizer/cleanup·종료를 실제 원격 증거로 확인한다.

| AC·수정 지점 | 직접/간접·음성 소비자 | 위험·테스트/환경 | 선정·미검증 |
| --- | --- | --- | --- |
| AC1 6peer host·상태 | 기존 보고/차트/동적/Milestone/Plan/견적·필터/선택/복귀 | HIGH, 기존 `issue-736-resource-dashboard.spec.ts` Workspace/차트 E2E EXTEND | before/default-final12장면·상태유지after30관측 및 verification manifest; 전체조합 PASS 추정 금지 |
| AC2 설명·도움말 | keyboard/touch/Escape/focus·error/stale/필수범위 | HIGH, 기존 `issue-719-contextual-help.spec.ts` Resource 경계 KEEP_UNIQUE + #736 EXTEND | 로컬 선정 결과·미실행 구분 |
| AC3 fine/coarse 제어 | 6peer5폭·다른5root·label/height/padding/line20·same-row±1px·overflow | HIGH, #736 EXTEND; `issue-730-view-composer.spec.ts`의 Resource 기대만 포인터별 EXTEND | 다른root44px 유지, scope 없는 전역 크기변경 금지 |
| AC4 name/ID | 원문 상세·긴/동일 이름·canonical drill/복사 | HIGH, #736 확장, `project-resource-workload-status.spec.ts` 기존 긴KO/EN/ID5폭 KEEP_UNIQUE | 검색/키·원문 실제값 불변 |
| AC5 정보 구획 | KPI숫자/action label·scope·분모·partial/null/0·정확Task/Assignment/T0 | HIGH, 기존 #736 차트3유형/정확drill/latecancel/focus KEEP/EXTEND | 원장/Plan·Export 산식의 기존 고유 Unit/API/OOXML 회귀 유지 |
| AC6 문서/실제증거 | DESIGN/UX/가이드/TEST_PLAN/Packet/CHANGELOG | HIGH, 링크·diff·별도 read-only검토 | 같은fixture·환경/제품source와 결과를 귀속 |
| AC7 lifecycle | package/lock, PR quality/e2e/docker8·Trusted/Main/GHCR/Release/Finalizer | HIGH, 원격 Actions 정식 gate | 실제 성공 전 NOT TESTED; 승인 marker·strictmain·thread0 보존 |

## TEST_LIFECYCLE_REVIEW

사전검색: `tests/e2e/issue-736-resource-dashboard.spec.ts`, `issue-730-view-composer.spec.ts`, `issue-719-contextual-help.spec.ts`, `project-resource-workload-status.spec.ts`, `resource-plan*`, `resource-excel-export-dashboard.spec.ts`, `issue-717-name-first.spec.ts`와 `tests/features/resources/**` 및 기존 #807/#809 실패 원장.

- EXTEND: #736 기존 peer/차트의 direct geometry·원문/도움말 경계, #730 기존 Resource-local density expectation. 새6peer 전체spec 복제 금지.
- KEEP_UNIQUE: 긴 이름/ID5폭, #719 delayed-error/도움말, Plan·견적/Excel snapshot/stale/OOXML, 정확Task/Assignment/T0·Project140·latecancel/keyboard/focus·조회mutation0.
- PARTIAL_OVERLAP: 이름우선#717은 Milestone/공정, Resource긴문자#525는 기본현황, #736은6peer/차트이므로 독립경계 보존.
- ADD/삭제/통합/RETIRE: 새 테스트 case 추가0, 기존 #736/#730 case 내부 assertion·관측 EXTEND. 기존 assertion/skip/timeout/retry·Required3/8shard를 약화하지 않는다.

## DOCUMENTATION_SYNC

- `DESIGN.md`: UPDATED

  지속적인 host 밀도/식별/정보 계층 상속·pointer별 크기·실측/회귀 계약
- `docs/UI_UX_GUIDELINES.md`: UPDATED

  #807/#798 리소스 범위 fine/coarse와 접근성·노출 규칙
- `docs/PROJECT_UX.md`: UPDATED

  6peer 사용자 흐름·구획·상태
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED

  리소스 표현/원본 의미 보존
- `docs/TEST_PLAN.md`: UPDATED

  기존 고유 회귀/신규 계약 확장
- `docs/ISSUE_819_FAILURE_ANALYSIS.md`: UPDATED
- `docs/exec-plans/active/ISSUE_819.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED

  version0.135.4만, dependencies/scripts 불변
- `AGENTS.md`: N/A(기존 실행/협업/QA 지침 적용; 정책 변경 없음)
- `docs/REQUIREMENTS.md`: N/A(기존 기능/도메인 요구를 유지하는 presentation 교정)
- `docs/ARCHITECTURE.md`: N/A(기존 component/service 경계, 조회 writer/계산 구조 불변)
- `docs/API.md`: N/A(DTO/route/selector/snapshot/원문ID·오류 계약 불변)
- `docs/DB_SCHEMA.md`: N/A(DB/DDL/migration 불변)
- `docs/SCHEDULING_ENGINE.md`: N/A(Calendar/공수/일정 알고리즘 불변)
- `docs/SECURITY.md`: N/A(session/Origin/revision/If-Match/로그·권한 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(기존 Excel/교환 format·writer 불변)
- `docs/IMPORT_SCHEMA.md`: N/A(원문/교환 형식·OOXML·원장 계산 불변)
- `docs/EXCEL_EXPORT.md`: N/A(원문/교환 형식·OOXML·원장 계산 불변)
- `docs/DEPLOYMENT.md`: N/A(Docker/Compose/volume·운영배포 변경 없음)
- `docs/CI_CD.md`: N/A(기존 Required3/8shard·정식 검증 정책 적용, workflow/권한 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 Required3/8shard·정식 검증 정책 적용, workflow/권한 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 승인/trace/Trusted/정상 Finalizer를 적용; 정책 수정 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 승인/trace/Trusted/정상 Finalizer를 적용; 정책 수정 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 승인/trace/Trusted/정상 Finalizer를 적용; 정책 수정 없음)
- `docs/GENERIC_RELEASE_FINALIZER.md`: N/A(기존 승인/trace/Trusted/정상 Finalizer를 적용; 정책 수정 없음)

## 실행·인계 상태

설계/구현·기존 테스트 검색·before/after 관측을 완료하고 최신 main을 통합했다. 실제 실행 source fingerprint·명령·환경·고유case 수·결과/미실행·PNG/geometry·별도검토는 아래 재개 기록과 검증 manifest를 참조한다. 원격 PR/Main/GHCR·Release/Finalizer·Issue 종료는 NOT TESTED다. 실제 터치 기기·native125%·screen reader·Windows Excel/DRM/운영proxy는 해당 환경 미실행을 명시하고 공식 Actions와 혼동하지 않는다.

## 2026-10-27 재개·통합과 검토

- 기존 worktree/수정/증거를 재사용했다. 신규 개발 branch는 게시하지 않았으며 기존 branch 하나로 진행한다. main #818 변경은 보존하고 CHANGELOG/PROJECT_UX/TEST_PLAN/PLAN의 top-section 충돌4건은 양쪽 내용을 병합했다. 제품8개와 E2E2개는 기존 동결 SHA256와 byte가 같다.
- 실제 역할: `/root/resource_design_review`(ui_ux read-only 설계), `/root/resource_implementation`(frontend 재개/증거 정리), `/root/resource_qa_review`(qa_docs read-only 사전검토), `/root/resource_pr_operations`(infra 게시). 초기 역할명은 이전 실행의 이력이며 이번 실행 신원과 구분한다.
- ui_ux는 기존 소스·6peer 인벤토리·30개 fine 관측 및 대표 PNG를 대조해 설계 BLOCKER 없음으로 반환했다. qa_docs는 shared supplement의 locked/active/stale 전파와 동결10파일·기존 고유 테스트 보존을 별도로 확인했다. 원격 CI/Trusted/최종 Owner 판단은 NOT TESTED이며 사전검토를 최종 QA 승인으로 사용하지 않는다.
- 대표 기본상태 before/default-final은390/1440×6peer12장면이다. `after/geometry.json`은 독립 조건/advanced가 유지된6peer×5폭30관측이므로 기본 접힘 이미지의 표 시작 높이와 같은 상태로 비교하지 않는다. navigation은390px105→47px,1440px57→47px다.
- 테스트가 갱신한 기존 #719 tracked capture는 #819 `help-regression`으로 복사한 뒤 역사적 원본으로 복구했다. 다른 중간 출력은 `/tmp/issue819-resumed-artifact-backup`에 보존했다. 새 제품 회귀·실행준비 오류·충돌은 단일 [실패 원장](../../ISSUE_819_FAILURE_ANALYSIS.md)에 누적했다.
- release_required=true(후속 정식 출시 필요성), release_authorized=false(exact0.135.4 미승인), manager_decision=NOT TESTED, MERGE_READY=BLOCKED. 이번 요청은 새 PR CI 시작 snapshot 인계로 끝난다.

### 6peer 및 내부 화면 인벤토리

| peer | 유지한 내부 화면·기능 | before → after |
| --- | --- | --- |
| 기본 현황 | 개인/Group/Global Role/개발등급·검색/고급 필터, 공수·가중진척·진단·원본 상세 | 일괄44px/14px와 설명 적층 → fine36px/13px·상황형 도움말·KPI 구획 |
| 차트 | 기간 투입/업무 집중/기여 분포, 단위/축·기간·동일 수치표/정확 drill | 큰 제어/평평한 구획 → host 밀도·toolbar divider·KPI surface/숫자 강조 |
| 동적 계층 탐색 | 개인/역할/등급·구성기/프리셋·경로/정렬·참여/Task/Assignment·Plan·Excel·출처 상세 | 기간/ID/Export 우선 적층 → 기간 가져오기 접힘·주요 표 우선·보조 참고/Export 하단 |
| Milestone 교차 | 계층/비교표, 그룹→Milestone→개인→Task 및 그룹→개인→Milestone→Task, 공수/Task/완료율/지연 | 큰 필터와 설명 → 공통 compact 정렬·짧은 범위/분모 유지 |
| Resource Plan | 주/월·계획공수/평균Load%/과투입M/D, 선택기여/동일개인Project참고·일별상세/Peak·원본복귀 | 중복 Capacity 설명 → 인접 모집단/단위·비가산 참고 + 도움말 |
| 견적·Excel | 개발견적 조건·역할/등급·기간·보고서·Export 범위/snapshot·stale 차단 | 반복 사용법/빈 제어행 → 명명된 도움말·빈 최상위행 제거·Export 의미 보존 |

### 실제 검증과 사전검토

[검증 manifest](../../../output/playwright/issue-819/verification/manifest.json)와 같은 폴더의 원본 로그/지문을 따른다. 기존 선별 E2E11 PASS·임시capture1 PASS·Unit46/6files·build/typecheck/lint PASS를 byte 불변 source에 한해 재사용한다. 통합후 version/typecheck·Markdown354파일 링크 검증 PASS, Pre-PR targeted dry-run은 READY15/UNKNOWN0/missing0/sourceStable=true이며 실제 실행 판정은 NOT TESTED다. 새0.135.4 통합 전체 회귀를 로컬에서 다시 실행했다고 주장하지 않는다.

새 도움말3종의 모든 touch/Escape 조합은 각각 직접 실행한 증거가 없으므로 기존 #719 공통 도움말 검증/별도 source검토와 구분한다. 최종 원격 Full quality/e2e/docker·Trusted/Owner, Main/GHCR/Release/Finalizer는 NOT TESTED다. 새 PR의 리뷰/충돌 및 시작 Run/Attempt/Head/Base/test merge는 게시 직후 댓글로 인계한다.

### 최종 사전검토

2026-10-27 `/root/resource_qa_review`가 통합commit1a03c439 + 문서/manifest 보완을 별도 read-only 검토하여 PR CI 시작 단계의 사전검토 PASS로 반환했다. 제품/spec/로그/fixture/probe26개 hash 일치, 역사capture 변경0, conflict marker0과 diff-check를 확인했다. 이는 최종 QA/Owner 승인·원격 회귀 PASS가 아니며 새 exact-head Required3·Trusted/Owner는 NOT TESTED다.
