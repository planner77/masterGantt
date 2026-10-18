# Issue #728 — WBS 공통 해석·KPI 원장

## Work Packet

- Issue: [#728](https://github.com/planner77/masterGantt/issues/728), 상위 #723, 입력 선행 #725/#727, 공개 조회 후속 #729, UI 후속 #730~#736.
- baseline: main `0b8624651ad20ee5c450d29f4f5de2abdce5036b` (#725/#727 포함).
- working_branch: `feat/issue-728-wbs-ledger`, 격리 worktree `/tmp/masterGantt-issue-728`.
- lifecycle_phase: PR_READY. 구현·문서·수동 집중검증을 마쳤으며 Pre-PR 자동 매핑 BLOCKED는 아래에 별도 유지한다. 요청 종료점은 구현·문서·변경 영향 검증 후 PR Full CI 시작이다. 결과 모니터링은 제외한다.
- version_decision: MINOR `0.120.0`. 기존 공개 API를 보존하는 신규 opt-in Domain 해석 계약을 추가한다. manifest/lock/CHANGELOG를 동기화한다.
- risk_level: HIGH. 직접/Target·명시/legacy 공정·무배정 Task·KPI 단위·Gate/Capacity의 공통 입력 경계다.
- qa_required: true.
- qa_method: OWNER_MANAGED. 별도 Agent 사전 검토는 독립 인간 승인이나 Owner의 최종 수용이 아니다.
- release_required: true.
- release_authorized: false. 이번 요청은 정식 GHCR/tag/Release 승인을 포함하지 않는다.
- manager_decision: NOT TESTED. PR 세 Required/Trusted QA·Owner exact-Head 승인 전 MERGE_READY=BLOCKED.

## 범위·역할·입력 freeze

최신 결정 [#728 comment6245431055](https://github.com/planner77/masterGantt/issues/728#issuecomment-6245431055), [#723 최종 선택](https://github.com/planner77/masterGantt/issues/723#issuecomment-6245422717), [#725 저장 결정](https://github.com/planner77/masterGantt/issues/725#issuecomment-6245426595)을 최초 OPEN_DECISION보다 우선 적용한다. W1/W2는 확정이다. 새 공정 집합은 Task 명시 선택0..N이며 구성/Target/조상으로 빈 선택을 채우지 않는다.

Manager는 요구사항·통합·version·문서·Issue/PR 게시를 소유한다. 실제 scheduler Agent `wbs_ledger`는 새 pure Domain·golden/metamorphic Unit을 소유한다. 실제 scheduler Agent `ledger_acceptance`는 별도 acceptance 테스트 파일만 소유해 기존 oracle·정확 경로·Plan/Gate 음성 회귀를 강화한다. 실제 qa_docs Agent `ledger_qa`는 별도 읽기 전용 사전 검토를 수행한다. 동일 파일의 동시 쓰기·원격 댓글 대행은 없다. 실행 환경이 제공한 실제 역할 도구를 사용하며 설정상의 모델/effort를 별도 실측한 것으로 주장하지 않는다.

#725 `src/contracts/process-context.ts`의 TaskProcessContextDto/EquipmentWorkAreaDto와 #727 `src/contracts/project-resource-memberships.ts`의 ProjectResourceMembershipDto를 재사용한다. Task 문맥은 모든 canonical Task의 행을 제공하며 null/[]를 구분한다. 공정 축의 Project-local process ID와 catalog occurrence ID는 별도다. sourceProject와 필수 컬렉션·typed 참조를 검증하고 caller는 한 read snapshot/revision과 전체 목록을 보장한다. Domain은 DB를 조회하거나 새 관계를 저장하지 않는다.

기존 #617 Target whole/subset/coverage·직접/조상 resolver, Resource KPI/Plan·Calendar·Milestone full Gate를 authority로 재사용한다. 공통 입력·출처·단위 사전은 [WBS_TASK_LEDGER](../../WBS_TASK_LEDGER.md)이다. HTTP/SQLite snapshot 통합·동적 wire schema는 #729, UI/동급 분기는 #730 이후다. 구 API 의미를 이번 pure opt-in 모듈로 전환하지 않는다.

## 변경 영향·검증 선정

| 수정 지점/전후 | 직접·간접 소비자 및 음성 | 위험도·환경·선정 |
| --- | --- | --- |
| 새 명시 공정/문맥 resolver | #725 DTO, 기존 #617 typed member·self/subtree·whole/subset. 명시0/legacy null·잘못된 소유권·foreign/deleted·누락 입력 | HIGH. 신규 pure Unit 및 기존 task-target-bindings/resource-target-kpi 회귀 |
| Task/Assignment exact selector | 공정/구역/설비/System/Milestone/Group/Resource·책임 역할. 같은 Task 교차 허용, 다른 Task 조인 누출 거부 | HIGH. 신규 golden/metamorphic·개인필터·no-mutation·축 순서/중복 회귀 |
| Task KPI와 개인공수 분리 | 미배정/Group-only·등록/역할-only, partial/unset/configured0·M/M 없음·분모0 | HIGH. 신규 원장 및 기존 Resource KPI 회귀 |
| Plan/Gate 인계 | 기존 R·선택80%/Project140%·full Milestone membership | HIGH. 신규 원장·기존 resource-target-plan/resource-plan/milestone-stage-gates |
| version/문서 | manifest/lock의 version만 변경, 의존성·workflow 불변. 문서의 기존/새 source 혼용 음성 | version check·typecheck·scoped lint·Markdown links·diff·Pre-PR 보고서 |

UI·Gantt·DB writer·Route·교환 형식·CI/Docker 제품 변경이 없으므로 실제 Chromium5폭/HTTP·SQLite·Docker를 이 신규 Domain 계약의 로컬 직접 증거로 실행하지 않는다. 기존 공개 기능의 전체 원격 회귀는 PR Required Quality/E2E6/Docker에 맡긴다. 이 제외는 원격 PASS나 해당 환경의 신규 구현 검증을 뜻하지 않는다.

## DOCUMENTATION_SYNC

결과: PASS(구현/계약/문서의 범위별 정합성 사전 검토). baseline의 변경되지 않은 `docs_gate`로 로컬 데이터 구조를 확인하여 `STRUCTURAL_PASS_SEMANTIC_REVIEW_PENDING` 및 `MAPPING_PASS_SEMANTIC_REVIEW_PENDING`을 받았고, Manager/qa_docs는 위 입력·지표·호환 의미를 별도로 대조했다. 이 로컬 확인은 기본 브랜치 Trusted QA/Owner의 원격 최종 승인이 아니다.

- `docs/WBS_TASK_LEDGER.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: UPDATED
- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/LOGISTICS_DASHBOARD.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/evidence/issue728/local-validation.json`: UPDATED
- `docs/evidence/issue728/prepr-fast.json`: UPDATED
- `docs/evidence/issue728/prepr-targeted.json`: UPDATED
- `DESIGN.md`: N/A(순수 Domain 신규 입력이며 UI 시각·interaction·Gantt writer 변경 없음)
- `docs/API.md`: N/A(기존 DTO 재사용만 수행하며 새 Route·wire 계약은 후속729 소유)
- `docs/DB_SCHEMA.md`: N/A(DB schema·migration·저장 writer 변경 없는 순수 Domain)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Calendar·기간·Plan 알고리즘의 변경 없이 결과 재사용)
- `docs/MILESTONE_STAGE_GATES.md`: N/A(기존 전체 membership·Gate authority 그대로 재사용)
- `docs/SECURITY.md`: N/A(권한·Origin·revision·공개 데이터 경로의 변경 없음)
- `docs/CI_CD.md`: N/A(후보 manifest version 동기화만 수행하며 CI·릴리스 정책 불변)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 원격 Required3·Trusted·환경별 검증 계약 유지)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 단일 Refs·묶음 게시·PR CI 시작 경계 재사용)
- `AGENTS.md`: N/A(기존 실행·역할·QA·문서 정책을 적용하며 지침 자체 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 PR까지의 승인 경계를 적용하며 lifecycle 정책 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 OWNER_MANAGED·사전 검토·Owner 승인 구분 유지)

| 문서 | 판정·이유 |
| --- | --- |
| WBS_TASK_LEDGER.md | UPDATED: typed 입력/출처·W1/W2·legacy 경계·KPI 사전·검산·후속 인계 |
| REQUIREMENTS.md / ARCHITECTURE.md | UPDATED: 신규 pure 공통 경계·소유권·비범위 |
| LOGISTICS_DOMAIN_DESIGN.md / LOGISTICS_TARGETS.md | UPDATED: 구성/작업 분리·Target0·provenance·다중 구역 고유 합집합 |
| LOGISTICS_DASHBOARD.md / RESOURCE_KPI_DASHBOARD.md | UPDATED: 기존/새 source와 T0/A/R·Gate·배정/등록 구분 |
| TEST_PLAN.md / active PLAN / 본 Work Packet / CHANGELOG.md | UPDATED: AC·영향·실제 검증/미검증·후보0.120.0 |
| API.md / DB_SCHEMA.md | N/A: 기존 DTO를 pure 입력으로 재사용하며 Route·wire field·DB schema/migration/저장 계약 변경 없음. 공개 통합은 #729 |
| SCHEDULING_ENGINE.md / MILESTONE_STAGE_GATES.md | N/A: 일정/Calendar·Stage Gate 알고리즘을 변경하지 않고 기존 authority 결과를 소비. 관련 회귀로 보존 검증 |
| SECURITY.md | N/A: 인증·Origin·revision·공개 데이터 경로 변경 없음. Domain typed 입력 거부는 WBS 계약에 기록 |
| DESIGN.md / UI_UX_GUIDELINES.md / PROJECT_UX.md / TASK_EDITOR.md | N/A(Design Delta): 화면·interaction·Gantt/Editor writer 변경 없음. WBS 중심 입력만 고정하며 동적 UI는 #730 소유 |
| TARGET_RESOURCE_USER_GUIDE.md / #720 매뉴얼 registry | N/A: 현재 사용자가 호출하는 화면·경로·버튼·공개 산식은 그대로. 새 source가 실제 연결되는 #729 이후 가이드 갱신 |
| CI_CD.md / REMOTE_VALIDATION.md / GITHUB_OPERATIONS.md | N/A: workflow/Required3/6 shard·원격 운영·릴리스 권한 변경 없음. 후보 version과 이번 요청 경계만 이 원장에 기록 |
| AGENTS.md / ISSUE_LIFECYCLE.md / QA_REVIEW_POLICY.md | N/A: 현행 역할·OWNER_MANAGED·문서/검증/승인 지침 적용, 정책 자체 변경 없음 |

## AC_TEST_COVERAGE

- AC1: `tests/domain/wbs-task-ledger.test.ts`의 Target0/unique quantities/MCS golden 및 등록2·배정1·무배정 Task; 별도 acceptance의 task0 구성과 관련 작업 수량 분리.
- AC2: 같은 core test의 five-day Assignment5·실제 공동담당50% 추가7.5 및 equipment/workArea/group 중첩; 기존 `resource-target-kpi.test.ts`의 고유 union 회귀.
- AC3: 같은 core test의 direct-only/Target-only/mixed 기존 oracle·ACS-only subset·모든 provenance와 Summary self/subtree·Task move. `wbs-task-ledger-acceptance.test.ts`의 Target/member·typed instance/type 정확 경로 및 기존 Resource/Target 회귀.
- AC4: 같은 core test의 ownership/missing snapshots/foreign·삭제참조·같은 Task 교차 허용 및 task-association/membership/controls/coordinates/assignment endpoint; acceptance의 다른 Target/member 오조인 음성.
- AC5: 같은 core test의 all-unset/partial/configured0/M/M·분모0·등록/역할/Group-only 및 same-R 선택80%/Project140%; 기존 `resource-kpi.test.ts`·`resource-plan.test.ts`·`resource-target-plan.test.ts` 보존 회귀.
- AC6: 같은 core test의 input duplicates/order/axes/selector order·mutation0와 full Gate 보존; 기존 `milestone-stage-gates.test.ts`·Resource/Target 회귀. projection/coordination/입력 예산 초과는 절삭 없이 오류.
- AC7: 같은 core test의 E10 두 공정 WorkArea0..N·원본 설비1·고유 quantity10·부모 raw union과 관련 구역 소계. 별도 acceptance에서 작업0 구성 quantity와 Task 관련 수량 분리.
- AC8: 같은 core test의 MCS 공통T0=2/조립T1=3/검사T2=4/통합T3=5 → 전체14/A8/B9/미연결2; 별도 배분율·자동 공정 없음. 명시0과 legacy null/Target/조상 source/version 분리.
- AC9: 같은 core test의 E1→Milestone→공정에서 t1 Task/Assignment만 유지하고 t2 담당자 누출0; acceptance의 복합 selector·축 순서 음성 및 full Gate 불변.
- AC10: 같은 core test의 등록2/개인배정1·등록/역할/Group-only로 Task·Assignment·Capacity 변경0·source no-mutation; acceptance의 입력 freeze·원본 hash/고유ID 보존.

위 항목은 실제 테스트 파일의 검증 범위를 매핑한다. 최종 실행 결과·실패·미검증은 아래 원장에 분리하며 매핑 존재만으로 PASS를 선언하지 않는다.

## 검증 실행 원장

- 환경 준비: 격리 worktree에서 Node22.14.0, pinned `npm ci --prefer-offline --no-audit` exit0. 447 packages 설치. 전역/기존 작업 트리의 node_modules는 변경하지 않음.
- 최초 GitHub CLI 조회: HTTP401 인증 오류. 연결된 GitHub 도구로 원본 Issue/댓글/관련 이슈를 확인하고 Git transport로 main fetch 성공. 이 오류를 제품/테스트 실패로 기록하지 않는다.
- 최종 source 동결: `wbs-task-ledger.ts` SHA256 `6db205f692c01fa6bca1b1ab5b19e0b38858d0a34e397637eb9f13f1b0d7ed34`. source/core/acceptance/fixture 4파일 지문은 [로컬 검증 manifest](../../evidence/issue728/local-validation.json)에 보존한다. 이후 변경은 실행 기록을 담는 문서·증거뿐이다.
- 최종 수동 집중 회귀: `npm test --`로 위 영향표의 신규2+기존 Resource KPI/projection/integration/Target KPI/Target Plan/Resource Plan/Target binding/Milestone Gate 총10파일 **174/174 PASS**, exit0, 2026-10-18 22:45:13 KST,890ms. manifest에 실제 전체 명령을 기록했다. 신규는 core15+acceptance13의28개이며 반복 실행을 새 고유 케이스로 합산하지 않는다.
- 최종 정적 검사: `npx tsc --noEmit` PASS, 신규 source/test/fixture4파일 scoped ESLint PASS, version0.120.0 일치·Markdown259파일 링크·`git diff --check` PASS. 의존성/공개API/CI 변경 없는 pure Domain에 대해 전체 production build/전체 Vitest/Chromium/Docker는 로컬 실행하지 않았다.
- 별도 `ledger_qa` 사전 검토: 최종 동일 source에서 신규2파일28테스트 PASS(635ms), 전후4파일 hash 동일. 요구사항/authority/소스/테스트/문서 직접 비교 후 미해결 코드 차단 지적0. 이는 OWNER_MANAGED의 Agent 사전 검토이며 독립 인간 QA·Trusted QA·Owner ACCEPT가 아니다.
- Pre-PR CLI는 실제 `fast`와 `targeted`를 실행했고 **둘 다 BLOCKED(exit1)**다. `tests/fixtures/wbs-task-ledger.ts`의 자동 소비자 매핑 UNKNOWN1 때문에 테스트 step0이며 missing0, start/end sourceStable=true. [fast 원본](../../evidence/issue728/prepr-fast.json)·[targeted 원본](../../evidence/issue728/prepr-targeted.json)에 base/head/fingerprint·실제 명령·선정/미선정·DEFERRED를 보존한다. sourceStart/end fingerprint는 둘 다 `b1c3ce6c8e11693599926f0df1224ca6df7403a24cd63f43804fc9c5ba608ade`다. 로컬 경로는 `.prepr-reports/2026-10-18T13-45-41.204Z-7972-44ef26b9/`와 `.prepr-reports/2026-10-18T13-45-41.577Z-8040-c4fe26fe/`다. 자동 mapping을 우회하거나 PASS로 바꾸지 않았다.
- Manager 수동 매핑: 해당 fixture의 실제 직접 소비자는 `wbs-task-ledger.test.ts`와 `wbs-task-ledger-acceptance.test.ts`이며 둘을 포함한174개 회귀를 최종 source에서 실행했다. CLI가 generic Resource/lock 규칙으로 선정한 Gantt browser/installed Core 비교는 manifest/lock **version만 변경되고 dependencies bytes가 동일**, UI/Gantt writer·공개 기존 API 소비 비변경이므로 이 신규 opt-in Domain의 직접 로컬 실행에서 제외한다. 해당 원격 전체 E2E/Docker·production build는 PR CI로 검증한다. 이 수동 근거는 CLI의 BLOCKED를 PASS로 승격하지 않는다.
### 최초 실패·보완 이력

- 최초 core Unit12개는10 PASS/2 FAIL이었다. MCS 선택 후 관련 System 수를 전체3으로 기대한 값과 명시 PB인 Summary S를[]로 가정한 입력 복사 검증의 fixture 기대 오류였다. 선택 관련1/전체3 및 원본 PB 보존을 각각 검증하도록 교정했다.
- 최초 acceptance12개는11 PASS/1 FAIL이었다. 일반 Task duration0을 유효로 가정한 fixture가 기존 canonical duration>0 계약과 충돌했다. invalid duration0 거부, 유효 주말 Assignment configured0, 일반 Task0 선택의 진척 분모0을 분리했다.
- 최초 typecheck의 recursive coordination possibly-undefined와 acceptance의 optional mdPerMm→number|null 인계 오류는 각각 검증된 iterative DAG 순회와 `?? null`로 수정한 뒤 최종 tsc PASS다.
- 별도 사전 검토에서 공휴일 Calendar 복사 시 중복 예외, 구성 관계 endpoint 소실, 선택 밖 Target/member 및 typed instance/type 경로 누출을 발견했다. 기존 authority 재사용·양 endpoint/role 보존·정확 경로 narrowing과 음성 회귀로 교정했다. 입력/provenance/coordination/projection 예산·구성 수량 분리·null 개인축·비활성 unknown·공정 중복도 보완했다. gate/timeout/skip을 약화하지 않았다.
- 중간 후보의72/74/173 PASS와 최초 사전검토66 PASS는 당시 source 범위의 이력이다. 최종174 PASS 또는 독립28 PASS와 합산하지 않으며 신규 source의 공식 원격 성공으로 사용하지 않는다.

- PR Quality/E2E/Docker·Trusted QA·Manager ACCEPT: NOT TESTED.
- main/GHCR·Release·정식 digest·cleanup·Issue 종료: 이번 요청 범위 밖. 실행/승인을 주장하지 않음.

## Gantt 상태 정합성 영향

gantt_standard_version은 `GSC 1.0.0-candidate`이며 문서 상태 `REVIEW_PENDING`과 구현 준수를 구분한다. 읽은 기준은 baseline commit의 `GANTT_STATE_CONSISTENCY.md`·`GANTT_STATE_CONFORMANCE.md`·`GANTT_ADAPTER_ADR.md`·`GANTT_SYNC_TRACE.md`·active `GANTT_STATE_REMEDIATION.md`다. 이번 변경은 pure Domain 조회이며 Gantt canonical/Native Core·viewport·선택/scroll writer를 건드리지 않는다. GSC의 원본/조회 분리·단일 writer·관측/증거 구분을 유지한다. SC-01~SC-14의 Core/browser 시나리오는 직접 변경 비영향으로 신규 로컬 증거 N/A이며 기존 원격 회귀는 유지한다. 표준 버전·제품 전체 준수·실제 Core PASS를 이 Unit으로 증명하지 않는다. 예외 ADR 없음.
