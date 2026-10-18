## 2026-10-15 — CLOSED/FINAL 누락·3개 브랜치 과거 승계 복구 Work Packet

- 원인: #622 Owner CLOSE=2026-10-15T09:01:16Z가 #691 Main CI 이전에 발생. #622 자체 bot FINAL/cleanup=0, `#684/#686/#691` 3개 브랜치 PRESENT. Generic Resolver는 CLOSED/no FINAL을 non-actionable barrier로 보존했고 뒤의 #665/#666 bot FINAL은 성공. 후속 이슈의 역사적 완료 경계는 변경 불가.
- 사용자 요청: 기존 #622에서 bounded audit→owner-authenticated historical repair→safe cleanup→bot FINAL까지 진행. 새 Issue 금지, 기존 `v0.114.0` / release #170.1 / candidate Digest 보존. 기존 승인 marker `#6187188712`의 정확 버전만 재사용.
- 소스 범위: `scripts/closed_issue_622_recovery.py`, `scripts/safe_branch_cleanup.py`, `scripts/test-closed-622-recovery.py`, 기존 Generic `release-finalizer.yml` 및 정책 CI 검증 연결. 임의 Git ref 조작, 릴리스 재게시, 제품 기능·API·DB/Excel/UI 변경 없음.
- 사전 검증: #684 최초 Main FAIL/PR #686 보완 Main SUCCESS/정식 Release SUCCESS, #691 Main SUCCESS, 복구 PR 자체 PR+Main CI Required3/이미지 success, SHA의 Main first-parent ancestry, Owner 마지막 승인 댓글 ID 정확 일치, #622 Closed 및 기존 FINAL 0, #665/#666의 인증 FINAL 유지. 4개 branch에 보호 해제·tip==PR Head·참조 열린 PR0·leased delete/404 확인 및 #691+신규 ci-SHA 후보의 단독 package tags 검사.
- mutation: 인증된 trusted Generic Finalizer Job만 기존 `issue_lifecycle.finalize`에 통합하여 FINAL marker는 github-actions[bot]이 작성한다. 이전 완료/실패 원장은 불변, partial cleanup은 멱등 재개 가능, 불완전한 상태에서 Final 작성 금지.
- DOCUMENTATION_SYNC UPDATED: `docs/GENERIC_RELEASE_FINALIZER.md`, `docs/CI_CD.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md`, `docs/TEST_PLAN.md`, `docs/exec-plans/active/ISSUE_622.md`, `docs/exec-plans/active/PLAN.md`, `CHANGELOG.md`. DESIGN/API/DB/SCHEDULING_ENGINE/EXCEL_EXPORT: N/A (실제 제품·일정 엔진·UI/API/DB 변경 없음).
- AC_TEST_COVERAGE: AC1 3개 과거 PR·태그·원장 identity→`verify_history`/Release gate. AC2 최신 owner marker와 revocation/비공개 GHCR fail closed→`authorized_comment`, code. AC3 safe branch lease·조회 지연/tip-change→`safe_branch_cleanup` regression. AC4 mutation 이전 일괄 preflight, no bot FINAL forgery→`execute`/existing finalize. AC5 실원격 PR CI/Main/Generic Job/FINAL·브랜치 삭제 확인 전 NOT TESTED.
- Risk HIGH/OWNER_MANAGED/qa_required=true; 이번 복구 코드 자체 release_required=false, release_authorized=false(0.114.0 이미 승인·게시됨). User's "계속 진행"은 코딩·증거 복구 범위를 허용하지만 PR/CI bypass는 허용하지 않음. 실제 원격 테스트/권한/후속 운영 Job은 증거 생성 전 NOT TESTED.

## 2026-10-15 — 같은 Issue 교정: Release Completion Finalizer #35 / v0.114.0

### 원본 실패와 영향
- Original PR #684 main `bd54205741da65a0211cf77f9cb086d3cdb1ab2a`는 `0.113.0→0.114.0`을 최초 도입했고 Main #2771.1 FAIL. 교정 PR #686 main `1449190af8d4f97d4737d17ae67e9dcb044549a7`는 `0.114.0→0.114.0`을 유지하며 기존 릴리스 의무를 적법하게 승계했다.
- Owner 승인 [#6187188712](https://github.com/planner77/masterGantt/issues/622#issuecomment-6187188712)에 따라 annotated tag `v0.114.0`이 교정 SHA에 생성, Release #170.1 SUCCESS, GHCR 정식 digest promotion SUCCESS. 그러나 explicit [Completion Resume #35.1](https://github.com/planner77/masterGantt/actions/runs/38704333977)는 failed original의 `exact_release_state` 조회를 supersession 전에 수행해 `existing release tag points to corrective, expected original`로 FAIL. 코드의 순서 결함이며 원본 실패를 PASS로 소급하지 않는다.
- #666 Main CI/임시 GHCR 검증 자체 성공이나 #622의 먼저 처리될 lifecycle 미완료로 뒤쪽 #666 Finalizer/Issue가 OPEN.

### 변경·검증 설계 (HIGH / OWNER_MANAGED)
- 새 `release_evidence_after_ci_supersession`는 CI 원본 성공/실패 및 first-parent graph의 동종 Issue·동일 version·non-docs 무중간 체인·성공한 교정 Main CI를 **읽기 전용으로만** 미리 검증한다. 이 조건을 갖춘 원본 실패에서만 기존 tag의 실제 peeled SHA가 정확히 교정 SHA와 일치하면 `superseded-by-corrective` 분류를 허용한다.
- `exact_release_state` 기본 호출 및 임의 SHA/다른 Issue/버전/단절된 체인/원본 Main 성공/교정 FAIL 등의 불일치 조건은 기존 FAIL. 실제 교정 release evidence/Owner marker/immutable tag/digest/FINAL mutation을 절대로 사전 PASS로 하지 않는다.
- 기존 CI policy 실행 `scripts/test-release-debt-recovery.py`에 actual failure topology·7개 이상 음성 조건을 추가하여 `scripts/auto_release_finalizer.py` 정책과 동일 runner에서 검증. 원격 PR CI 전 모듈·테스트 결과는 NOT TESTED이며 테스트를 실행하지 않고 PASS라고 기록하지 않는다.
- 코드 수정은 `scripts/auto_release_finalizer.py`, `scripts/test-release-debt-recovery.py`; workflow/CI check/job·package/lockfile·제품 코드/DB/API/버전·이전 SHA/tag/GHCR 변경은 없음.

### DOCUMENTATION_SYNC
- UPDATED: `docs/GENERIC_RELEASE_FINALIZER.md`, `docs/CI_CD.md`, `docs/REMOTE_VALIDATION.md`, `docs/TEST_PLAN.md`, `docs/exec-plans/active/ISSUE_622.md`, `docs/exec-plans/active/PLAN.md`, `CHANGELOG.md`.
- N/A: `DESIGN.md` (제품 시각/interaction 변경0), `docs/API.md`/`docs/DB_SCHEMA.md` (API/DB 변경0), `docs/SCHEDULING_ENGINE.md` (일정 알고리즘 변경0), `docs/EXCEL_EXPORT.md` (writer 변경0).
- AC1: 원본 FAIL+정확 교정/릴리스 SHA 분리 및 mutation 없이 진단 — code/fixture.
- AC2: foreign SHA/Issue·version·docs-only·intervening issue·원본 CI-success/교정 CI-failed 거부 — negative fixture.
- AC3: 교정 target 자체의 real tag/Release/digest/Owner/safe branch cleanup/Issue FINAL gate 보존 — 코드 계약 + 추후 원격 #35 재실행.
- AC4: 기존 CI/릴리스 승인/immutable tag/원본 감사/다른 issue 계약 불변 — diff 및 workflow 검증.
- 위험/비범위: GitHub Release 객체 생성/존재 확인은 별도 정책이며 현재 본 장애의 원인이 아님. 기존 formal `v0.114.0` tag 및 immutable digest는 덮어쓰지 않는다. 교정 PR 자체 release_required=false/release_authorized=false; 기존 승인 v0.114.0에 관한 재발행 승인 아님.
- 롤백: 코드/테스트와 문서 복구 PR만 revert; immutable tag/이전 Release SHA·CI 결과 변경 금지. 이후 #35 기존 failed Job rerun/Generic resolver에서 원본 #622 lifecycle→후속 #666까지 완료 증거 확인.

# Issue #622 — Target Resource Plan·과투입·Excel Work Packet

## 기준·범위·담당

- Issue: https://github.com/planner77/masterGantt/issues/622. 상위 #613, 직접 선행 #619/#620 및 UI #621, 기존 #527/#529/#530 재사용.
- baseline main: `53c57743` (#621 PR #683 병합), application `0.113.0`. 착수 시 #622 기존 PR 검색 일치0. 기존 다른 worktree와 미추적 파일을 보존한다.
- branch/worktree: `feat/issue-622-target-resource-plan` / `/home/planner/Dev/masterGantt-worktrees/issue-622`.
- application: `0.113.0 → 0.114.0` MINOR. 기존 계산·소비자 호환을 유지하는 기능 확장이며 dependency graph는 변경하지 않는다. `release_required=true`, `release_authorized=false`.
- phase: PR_READY → exact-head Full PR CI 시작 인계. 사용자 요청 종료점은 구현·관련 문서·미해결 리뷰/충돌 처리 후 exact-head Full PR CI 시작 확인이다. CI 모니터링·병합·main/GHCR·Release/tag·브랜치 정리·Issue 종료는 별도다.
- 실제 Agent: Manager `/root` 통합·문서·version·Issue/PR 운영, scheduler `/root/domain` 순수 Plan 회귀, backend `/root/backend` API·snapshot·Excel/SQLite·workbook 검증, frontend `/root/frontend` Plan·상세·export UI 및 Chromium, ui_ux `/root/ux` read-only 설계. 별도 read-only qa_docs 사전 검토를 구현 뒤 수행한다.
- 파일 소유권: domain은 `tests/domain/resource-target-plan*` 등 순수 Plan 테스트, backend는 `src/contracts/resource-dashboard.ts`/`resource-excel-export.ts` 및 `src/server/resources/*`·`src/server/exports/*`와 해당 server 테스트, frontend는 `src/features/resources/*`·관련 feature 테스트·전용 Issue622 E2E, Manager는 Markdown/package/lockfile. 공용 계약은 backend가 작성하고 소비자는 협의한다. 같은 파일의 동시 writer를 두지 않는다.
- issue_comment_writer: manager; issue_comment_allowed_types: PLAN/STATUS/EXCEPTION/DECISION_REQUIRED/RESUME/FINAL. Sub-Agent의 Result Contract는 Manager에게만 반환한다.

## 구현·UX 계약

Target/공정/WorkArea/설비·시스템 조건은 선택 기여 Task/Assignment만 제한한다. Capacity 모집단 R는 Project 일반 Task의 개인 배정 이력에 개인 분류 조건을 적용한 기존 집합이다. Target/기간/Task 조건으로 가용 인원을 줄이지 않는다. 선택80%와 같은 개인·기간의 Project 전체140%를 동시에 확인한다. Project 참고는 같은 R의 전체 Project 배정이며 전사 전체 부하가 아니다.

기존 pure Plan/KPI/Resource Calendar/M/M 엔진을 재사용한다. 고유 resource-day Capacity와 개인 일별 초과/Peak/unknown을 보존한다. 중첩 Group/Milestone/Target 소계의 참고 Capacity를 더해 총계로 만들지 않는다. 주/월 knownMd는 같은 기간 원시 합이며 distinct/nullable 상태는 전체 집합에서 다시 계산한다. 수량과 Task progress를 계획공수에 곱하지 않는다.

사용자 흐름은 기간·Target 조건 → 주/월 Plan → 일별 → 개인 → 정확한 Assignment/Task/Target 근거 → 기존 Editor/일정 → 원래 분석 복귀다. 선택 밖 Project 전체 과투입 원인을 열 때 출발 선택과 현재 참고 범위를 따로 표시한다. 조회/보기/정렬은 원본 mutation0이며 저장은 기존 권한·Origin·strong If-Match 및 canonical gateway를 따른다. 이전 report/detail은 최신 성공과 섞지 않고 snapshot 재검증 후 갱신한다. dirty/pending/readonly/stale·응답역전과 source/current scope·focus를 보존한다.

Excel은 기존 opt-in Resource bundle/writer를 확장한다. 현재 조건 또는 명시 Project 전체 범위에 동일 snapshot/filter/asOf/calendar/mdPerMm 원시 결과를 사용한다. 원시 Assignment는 하나만 기록하고 Target/member/provenance 근거가 여러 행에 나와도 공수를 다시 합산하지 않는다. 기존 sheet/header 순서를 유지하며 새 근거를 append한다. 관련 계획 공수(원가 배분 아님), 비가산 중첩 소계/고유 총계, Target 미연결·WorkArea 미사용·공통·legacy, 부분합/미설정·M/M 기준·선택/Project 참고·revision을 설명한다. 문자열 formula 방어·권한·stale·JSON/workbook 예산을 유지한다. Excel은 보고서이며 무손실 Import/운영 백업이 아니다.

| 상태 | 동작 |
| --- | --- |
| loading / no results | 조회 상태와 조건 결과0을 구별, 기존 control로 재조회 |
| readonly | 조회·상세·Excel 허용 범위 유지, 편집은 기존 권한 gate |
| dirty / pending | 기존 초안·중복 저장·이동 guard 보존 |
| stale / 409 / 412 | 이전 결과 표시와 명령 잠금, 명시 최신 조회 |
| saved / filtered-out | 새 snapshot 재검증 후 같은 단계 복귀, 사라진 원인은 안내와 유효 control focus |
| selected / project reference | 출발 Target 조건과 현재 같은 R의 Project 전체 근거를 각각 표시 |

기존 Light/system font/semantic token/compact controls와 native label/button/select를 유지한다. 상세4열 최소1000px의 표 소유 내부 scroll·긴 이름 줄바꿈을 사용하며 390/768/1024/1440/1920px·keyboard/Tab/Enter/Escape/focus를 실제 Chromium에서 확인한다. `ui-ux-pro-max`의 keyboard/focus 제안은 기존 원칙 구체화인 **Design Delta B**이며 `DESIGN.md: N/A`다. 새 공통 시각 원칙·PRO ResourceLoad·새 Gantt 인스턴스·viewport writer를 추가하지 않는다.

## GSC 적용 경계

`gantt_standard_version=GSC 1.0.0-candidate (REVIEW_PENDING)`, 기준 문서는 baseline main의 GANTT_STATE_CONSISTENCY/CONFORMANCE/ADAPTER_ADR/SYNC_TRACE 및 active GANTT_STATE_REMEDIATION이다. SC-11 Resource→상세→Editor/일정→복귀와 관련 SC-01/02/03/04/09/10/12의 기존 canonical·권한·실패·취소·readonly·focus 계약을 보존한다. Resource는 조회 조건·상세 UI 상태만 소유하고 저장/Canonical 반영/Viewport는 기존 단일 gateway/coordinator가 소유한다. `exception_adr=NONE`; SC-05~08/13/14 전수 수용·GSC 전체 준수·U5/#574 완료를 이 작업으로 주장하지 않는다.

## DOCUMENTATION_SYNC

현재 교정 PR #686의 base `bd54205741da65a0211cf77f9cb086d3cdb1ab2a` 대비 변경을 기준으로 한다. 최초 기능 PR #684의 문서 변경은 아래 과거 기록에 보존하며 현재 PR의 변경 증거로 재사용하지 않는다. 문서 작성자는 Manager다.

- `docs/MILESTONE_TIMELINE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/exec-plans/active/ISSUE_622.md`: UPDATED
- `DESIGN.md`: N/A(개발 진단의 초기화 준비 신호만 교정하며 시각 언어나 사용자 interaction 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(개발 진단과 테스트 준비 조건만 교정하며 Calendar·Duration·Dependency·Resource Plan 계산과 일정 저장 계약 변경 없음)
- `docs/RESOURCE_KPI_DASHBOARD.md`: N/A(선택 기여·Project 참고·Capacity·Resource Plan 제품 계약 변경 없음)
- `docs/API.md`: N/A(제품 HTTP API·DTO·snapshot 계약 변경 없음)
- `docs/EXCEL_EXPORT.md`: N/A(Resource workbook·raw 공수·출력 범위 변경 없음)
- `docs/LOGISTICS_TARGETS.md`: N/A(Target 원장·Task binding·필터 계약 변경 없음)
- `docs/PROJECT_UX.md`: N/A(제품 화면·편집·탭 이동·복귀 동작 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 Gantt 상태 보존 및 증거 구분 지침 유지)
- `docs/exec-plans/active/PLAN.md`: N/A(같은 Issue의 PR 실패 보완이며 신규 계획·의존성 변경 없음)
- `docs/exec-plans/active/TARGET_RESOURCE_ROLLOUT.md`: N/A(Resource rollout 순서와 완료 gate 변경 없음)
- `CHANGELOG.md`: N/A(동일 0.114.0의 개발 진단 교정이며 사용자 기능·정식 릴리스 변경 없음)
- `docs/REQUIREMENTS.md`: N/A(기존 Issue #622 및 #551 요구사항 불변)
- `docs/ARCHITECTURE.md`: N/A(기존 단일 Core·canonical gateway·viewport coordinator 소유권 불변)
- `docs/SECURITY.md`: N/A(권한·Origin·revision·production 진단 비활성 경계 불변)
- `docs/IMPORT_EXPORT.md`: N/A(Import·Export·loss guard 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB schema·migration 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(Import payload 변경 없음)
- `docs/TASK_EDITOR.md`: N/A(Editor 저장·초안 계약 변경 없음)
- `docs/DEPLOYMENT.md`: N/A(Docker·Compose·운영 저장소 변경 없음)
- `docs/CI_CD.md`: N/A(workflow·required checks·QA gate·GHCR 경로 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(GitHub 권한·Ruleset·운영 계약 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(Owner-managed 및 별도 승인 경계 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 실패 보완·PR CI 시작 절차 적용)
- `AGENTS.md`: N/A(실행 지침·역할·신뢰 정책 변경 없음)

## 최초 기능 PR #684의 문서 동기화 기록

같은 PR에서 실제 source/계약 영향과 문서를 대조했다. 작성자는 Manager다.

- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/EXCEL_EXPORT.md`: UPDATED
- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/TARGET_RESOURCE_ROLLOUT.md`: UPDATED
- `docs/exec-plans/active/ISSUE_622.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/SCHEDULING_ENGINE.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/IMPORT_EXPORT.md`: UPDATED
- `DESIGN.md`: N/A(기존 Light/compact/상태·table scroll·focus 원칙 구체화인 Design Delta B이며 신규 공통 원칙 없음)
- `docs/DB_SCHEMA.md`: N/A(기존 Task/Assignment/Target 원장을 재사용하며 schema/migration 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(Resource 보고서 출력만 확장하며 JSON/CSV Import payload·무손실 복원 지원 불변)
- `docs/TASK_EDITOR.md`: N/A(기존 정확 Assignment Editor/gateway로 연결하며 편집 API·초안/저장 계약 자체 불변)
- `docs/DEPLOYMENT.md`: N/A(Docker/Compose·운영 저장소·환경 및 배포 계약 변경 없음)
- `docs/CI_CD.md`: N/A(기존 minor version 규칙·Required CI·릴리스 절차 유지하며 workflow 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 Required/Trusted 원격 gate와 환경별 경계 유지하며 이번 실행은 Work Packet에 기록)
- `docs/GITHUB_OPERATIONS.md`: N/A(GitHub 권한/Ruleset/원격 운영 계약 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(최신 Owner-managed 정책과 별도 승인 경계를 그대로 사용)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 Lifecycle을 적용하며 단계/승인 범위 변경 없음)
- `AGENTS.md`: N/A(기존 실행 지침·역할·신뢰 정책 변경 없음)

SCHEDULING_ENGINE은 기존 서비스 입력/Domain adapter/계산 재사용 경계를 명확히 했으며 Calendar·공수 산식은 변경하지 않았다. SECURITY는 기존 gate 적용을 명시했고 권한/CI/QA 정책을 변경하지 않았다. IMPORT_EXPORT는 plain 일정의 거부와 opt-in 보고서의 비왕복 허용을 구별했다.

## AC_TEST_COVERAGE

| AC | 검증 계획 |
| --- | --- |
| AC1 | TargetA80+TargetB60 Domain/SQLite/UI, 같은 R/Capacity·선택80/Project140·정확 원인 |
| AC2 | 기존 및 신규 Plan Group 평균/개인초과·일별 Peak·다중Group/Target·unknown/known0/capacity0·부분기간/윤년/ISO |
| AC3 | week/month 원시합·전체 distinct/null 상태 재계산 |
| AC4 | 동일 snapshot/filter의 report/details/Plan/Excel ID·raw M/D·M/M·null programmatic workbook assertions |
| AC5 | 선택 밖 과투입 Assignment→기존 정확 Editor→복귀/새 결과, 출발/현재 scope와 source context |
| AC6 | legacy Plan/Excel 호환·current/project·stale/권한·예산·formula injection |
| AC7 | Chromium5폭·keyboard/overflow·대량 서버/JSON/workbook 실제 관측, 절삭 총계 금지 |
| AC8 | required docs UPDATED/N/A·Markdown links·version/dependency graph 및 실제 code/docs 정합 |

- AC1: tests/domain/resource-target-plan.test.ts·tests/server/resources/issue-622-target-plan-excel.test.ts·tests/e2e/issue-622-resource-plan-target.spec.ts의80/140·같은R/Capacity·원인 ID 검증.
- AC2: 신규 Domain7case와 기존 resource-plan/periods/budget 회귀의 Group/개인·Peak·Calendar·unknown/known0/capacity0·윤년/ISO 검증.
- AC3: 신규 Domain daily/week/month raw parity와 전체 distinct 재계산, server/workbook period raw 검증.
- AC4: tests/server/resources/issue-622-target-plan-excel.test.ts의 OOXML cell/header/Assignment ID·Plan selected/project raw/null parity 및 기존 Excel 회귀.
- AC5: tests/e2e/issue-622-resource-plan-target.spec.ts의 TargetA에서 전체 원인TargetB exact Assignment60→40 저장·선택80/전체120·공동담당/조건/상세focus 복귀.
- AC6: 신규 SQLite/Excel 및 기존 Plan/Target/workbook 회귀·tests/features/resources/resource-export-model.test.ts의 current/project·legacy/stale/권한/예산/문자열/nullable 검증.
- AC7: 전용 Chromium5폭 geometry/keyboard/scroll/편집·다운로드 및 신규server131Task/240신규Assignment/2Target benchmark의 시간/bytes 관측.
- AC8: 위 DOCUMENTATION_SYNC bullet과 source/doc diff, version7tests·Markdown links·별도 read-only 사전 Reviewer 정합성 검토.

현재 교정 PR #686은 최초 기능 PR의 AC1~AC7 계산/Excel 원장을 변경하지 않는다. 위 기능 테스트 매핑은 #684의 역사적 검증 범위이며 현재 교정의 원격 PASS가 아니다. 교정의 직접 매핑은 다음과 같다.

- AC1: 기존 선택80/Project140 및 R/Capacity 계산 source 불변을 correction diff로 확인하고 새 Full PR CI의 기존 Domain/SQLite/UI 회귀 실행을 요구한다.
- AC2: Calendar/Peak/unknown/known0 계산 불변을 diff로 확인하며 기존 Plan 회귀는 새 Full PR CI에서 재검증한다.
- AC3: week/month 집계 계산 source 불변을 확인하고 기존 Domain/server period 테스트를 새 Full PR CI에서 재검증한다.
- AC4: report/Plan/Excel snapshot source 불변, 기존 OOXML raw parity 테스트를 새 Full PR CI에서 재검증한다.
- AC5: P2 관련 단일 viewport coordinator 소유권과 React/layout readiness를 `tests/e2e/milestone-timeline-lane.spec.ts`에서 실제 Chromium으로 검증하고 기존 Resource 편집/복귀 회귀는 새 Full PR CI에 포함한다.
- AC6: production·API·권한·Excel source 불변을 diff로 확인하고 기존 stale/권한/budget 회귀를 새 Full PR CI에서 재검증한다.
- AC7: `tests/e2e/milestone-timeline-lane.spec.ts`의 기존 1000 Task+2000 Milestone·peer scroll/fullscreen/resize/geometry·mutation0 및 독립 readiness 부정 사례를 실행하며 이전 Resource 성능 관측을 새 성능 실증으로 표시하지 않는다.
- AC8: 현재 DOCUMENTATION_SYNC의 실제 diff/N/A 근거와 base `docs_gate` 구조·Markdown 링크 검사로 원본 Preflight 실패를 교정한다.

실제 파일/명령/결과와 최초 실패·보완 이력은 아래 원장에 기록하며 미실행 항목은 PASS가 아니다.

## 위험·검증 원장

`risk_level=HIGH`, `risk_reason=선택/전체 부하·공수 원시 정합성·공통 편집 복귀·Excel snapshot`, `qa_required=true`, `qa_method=OWNER_MANAGED`, `independent_qa=N/A(Owner-managed, 독립 검토 없음)`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`.

사전 Agent 설계/검토는 범위별 실제 증거로만 기록하며 Trusted QA·Owner HIGH 위험 수용·명시 병합 허가를 대체하지 않는다. Required Quality/E2E/Docker·Trusted QA는 exact Head/base/run/attempt의 원격 증거 전 NOT TESTED다.

- 착수 git fetch PASS, #621 최신 main 반영 확인. #622 기존 PR0, Issue 댓글0.
- gh CLI 인증은 환경 토큰 제거 후에도 HTTP401. git fetch·연결 GitHub 도구는 가능하며 token/권한/Ruleset을 변경하지 않는다. 게시 시 git push 또는 Git Data API의 exact tree 검증 경로를 사용한다.
- 실제 `npm ci --no-audit --no-fund`: PASS,447 packages/10초, Node22.14.0. 기존 eslint9.39.5 deprecated 경고는 보존한다. CI frozen install PASS 대체가 아니다.
- read-only UI/UX Agent가 actual #622/#619/#620·관련 source/문서 및 targeted keyboard/focus 검색 후 Design Delta B 반환. 실제 browser 증거는 구현 후 별도다.
- 환경별 Windows Excel/VBA/DRM·production proxy/TLS·off-host backup/restore·실기기/screen reader·최종 수동 UX: NOT TESTED.


## 구현 및 Local Fast Feedback 결과 (2026-10-14)

- Domain: 신규 `tests/domain/resource-target-plan.test.ts`7case 및 기존 Plan/periods/budget 포함4files67tests PASS, 신규 fixture/test ESLint PASS. 기존 계산기가 요구 계약을 지원하므로 산식 변경 없이 검증을 보강했다.
- Backend: `tests/server/resources/issue-622-target-plan-excel.test.ts`, 기존 resource-target-dashboard/resource-plan/resource-excel-export/resource-transfer 관련5files의 집중80tests PASS. 최종 OOXML parser·legacy7sheet 보강 뒤2files27tests 재실행 PASS, 나머지3files53tests PASS 이력을 구별한다. 동일 테스트를 누적 고유 테스트 수로 합산하지 않는다. TypeScript/owned ESLint/diff PASS.
- OOXML 검증은 실제 sheet를 cell/header별로 읽어 선택 및 same-R Project Assignment의 canonical ID/task/resource/raw M/D·M/M·null/0/allocation/근무일을 대조한다. 주/월 overall/기간의 selected/project 원시 Plan 지표를 DTO와 대조하고 근거 관계의 별도 assignmentId/demandScope 열을 검증한다. formula-like Target label은 inlineStr/XML escape/no formula로 확인한다.
- Frontend: 관련 Vitest19tests·typecheck·scoped ESLint PASS. 최종 실제 Chromium 관련 고유12tests PASS: 전용 #6221개와 실제 #527 Plan1개·#529 Excel3개는 한 실행5PASS/59.6초(#62219.7초), #621 정확 편집401/412·응답역전/409/필터탈락2PASS, mock #527 Plan 전체5PASS/30.7초. 각 실행의 범위/환경을 구별하며 전체 E2E PASS로 표현하지 않는다.
- 전용 #622는 실제 Next/SQLite/API 세션·Origin·If-Match로 A80/B60을 준비한다. TargetA 선택80%/Project140%, B 정확 Assignment60→40 저장 뒤 선택80%/Project120% 및 원래 Target/같은 상세·focus 복귀, 다른 Assignment 원본 불변·조회 mutation0·current/project 실제 XLSX download를 확인했다.
- `output/playwright/issue-622/evidence.json`:390/768/1024/1440/1920px의 Plan/Assignment10개 geometry와 실제 export descriptor. 전 폭 document scrollWidth=viewport, 상세4열340+220+220+220 및 header/body 경계±1px·버튼 identity영역내·표 소유 내부scroll·keyboard를 확인했다. before 캡처 없음, after10개 PNG이며 before/after 실증으로 주장하지 않는다.
- Manager: actual npm ci447packages/10초·version0.114.0 검증·version7tests PASS/143ms, Markdown216files PASS, DOC_SYNC 구조/AC1~8 mapping PASS, diffcheck PASS. 최초 Markdown 검사 명령의 파일명 오류는 실제 `scripts/check-markdown-links.mjs`로 교정했다. 기존 Vite native configLoader future 경고와 eslintdeprecated 경고는 보존한다.

### 최초 실패 및 보완 이력

- 신규 workbook fixture의 Task source 기대5/실제4 oracle FAIL은 기간 밖 T5가 선택T0/same-R 배정 근거에서 제외되는 계약으로 교정했다. 전량 Task binding backup으로 범위를 확대하지 않았다.
- OOXML의 기존 boolean writer는 numeric1/0이 아닌 text true/false를 보존한다. 원시 parity 테스트의 boolean 기대를 기존 서식에 맞춰 교정했다(중간78PASS/2FAIL); 숫자/null 검증을 완화하지 않았다.
- 전용 Chromium 초기 준비에서는 Plan 진입 시 Target catalog가 없어 Target select가 잠겼다. 기존 서버 `projectionOrder=resource,target`를 opt-in해 catalog를 로드하고 noTarget/noLegacy의 projection-only workbook은 기존7sheet를 유지하도록 별도 회귀를 추가했다.
- 초기 상세 복귀는 snapshotId key로 remount돼 같은 단계/focus를 잃었다. Plan/상세 표시 identity와 snapshot 재검증을 분리하고 새 query 성공 확인 전 이전 명령을 잠근다. exact AssignmentID·현재 detail confirmation receipt에 focus 복귀를 결속했다.
- 전용 E2E의 export request capture가 `/export/excel`을 사용해 실제 `/exports/excel` 다운로드 후 기대2/실제0으로 FAIL했다. route oracle 교정 뒤 같은 실제 동작/강화된 raw descriptor·공동담당 불변 검증을 PASS했다.
- 기존 mocked #5272FAIL은 새 projectionOrder를 요청하면서 fixture가 targetProjection을 echo하지 않아 client가 fail-closed한 것이었다. `tests/fixtures/resource-plan-ui.ts`의 빈 Target projection을 실제 DTO 계약에 맞추고 수치·stale/unknown/권한/timeout 단언은 유지했다. 후속5PASS로 최초 실패를 소급 PASS하지 않는다.
- Export 대화상자의 기존7sheet 문구는 기본7+Target근거로 명시했고 `tests/e2e/resource-excel-export-dashboard.spec.ts`의 accessible-name3곳만 갱신했다.

### 성능 관측 경계

신규 SQLite/실제 handler fixture는131Task노드(신규120Task×2개인 Assignment,각2Target), 선택241/같은R Project242Assignment,2Target·SQL48개다. 최종 관측 report41.44584699999996ms/182935bytes, workbook201.642738ms/417610bytes를 `backend-benchmark.json`에 보존한다. 초기 같은 fixture 관측75.94ms/182926bytes·export274.12ms/399095bytes와 중간39.27ms/182935bytes·244.28ms/418197bytes는 당시 source/랜덤ID 값의 이력이며 최종 수치로 소급하지 않는다. API 응답·workbook 값은 로컬 단일 관측이며 운영 성능·전수 상한 내 처리·원격 CI 성공을 뜻하지 않는다. 기존366일/2MiB 및 row/cell/XML/ZIP 경계 회귀는 유지하며 절삭 총계가 없다.

### 사전 검토·원격 인계

별도 read-only qa_docs `/root/qa`가 AC/code/test/docs·원시 OOXML/5폭 evidence를 검토했다. 직접 최종 focused6files70tests PASS(신규 Domain/SQLiteWorkbook·기존 Target server/Excel·client model/Plan parser); 기존 sourceTaskId에 AssignmentID 혼용은 별도 assignmentId/demandScope 열로 교정했다. 사전 AC1~AC8 PASS, 미해결 P1/P2 없음. 최종 원격 tree/Head는 PR 본문과 Issue 인계 댓글에 기록한다. 실제 Agent 사전 검토는 Owner-managed 경로의 independent_qa=N/A 및 manager_decision=NOT TESTED를 변경하지 않는다.

Required quality/e2e/docker·Trusted QA는 exact-head 원격 증거 전 NOT TESTED이며 이번 요청은 CI 시작까지만이다. main GHCR digest/cleanup·정식 release/tag/promotion·작업 branch 정리·Issue 종료는 미수행, release_authorized=false 유지. Windows Excel/VBA/DRM·운영 proxy/TLS·backup/restore·실기기/screen reader·최종 수동 UX는 NOT TESTED다.


### 최종 freeze 및 인계 준비

- 별도 Reviewer source/test22파일 SHA256 `0ca20de819e3609df51a244c60c0dddfde14333cac424408201fba395c44569d`와 Manager 실제 파일 재계산 일치. 경로 정렬 후 path UTF-8 + NUL + bytes + NUL의 SHA256이며 package/docs/generated/artifact는 제외한 범위다. 전체 검토 tree와 혼동하지 않는다. `source-inventory.json`에22개 path/hash를 기록했다.
- 별도 Reviewer 최종 실제 Chromium1PASS/testcase22.7초·전체35.7초, source/code/docs/AC1~8 사전 PASS·미해결 P1/P2 없음. `evidence.json`/10PNG는 이 재실행의 최종 산출물이다. 이전 frontend 재생성1PASS/19.2초·전체31.1초와 구별한다.
- 모든 browser 종료 후 Next 자동 생성 `next-env.d.ts`/`tsconfig.json`을 기준 HEAD로 복원하고 최종 typecheck·Markdown216files·dependency graph 불변·diffcheck를 확인했다. 다른 #527 실행 산출물은 게시 후보에서 제외했다.
- 최종 git fetch에서 main은 baseline `53c57743380e5d72a38e753078fc87c9d1b01365`로 동일하다. main 대비 충돌 없음. 신규 #622 PR의 리뷰 스레드/mergeability 및 Full CI Run ID/attempt는 생성 후 한 번 확인해 PR/Issue에 기록하며 결과를 모니터링하지 않는다.
- `execution-result.json`은 로컬 범위와 원격 NOT TESTED·Owner/릴리스 경계를 구별한다. 사전 Agent PASS로 `manager_decision=ACCEPT`나 `MERGE_READY=PASS`를 생성하지 않는다.

## PR #684 CI #2768.1 실패 및 P1 보완 (2026-10-15)

- 최초 원격 Full PR CI [#2768.1](https://github.com/planner77/masterGantt/actions/runs/38576041422), head `3248ce226e8a87cfeeff1fb9a4c191df549a9a33`: Required Quality, Chromium E2E 6 Shard, Docker aggregate는 SUCCESS. `QA Final — Automated`는 미해결 review thread 1건으로 BLOCKED/FAIL; 전체 CI SUCCESS가 아니다.
- PR #684 미해결 P1 `PRRT_kwDOUUB7Bc6sWoYz`: Plan에서 무조건 `projectionOrder=resource,target`를 보내 전체 Target projection을 생성해 유효한 대량 Project가 `projectionCells=5000` 초과 422가 되는 회귀.
- Plan의 암묵적 `projectionOrder` 제거; 필터와 원시 selected/project 부하·Calendar/Capacity·일별 정확 Assignment 근거는 유지. 서버의 `granularity` Plan이 명시적인 projectionOrder 없이 Target 필터를 갖는 경우도 full Target tree 생성하지 않게 분리. 기존 granularity 없는 Target-only report/Target view에서 명시적으로 필요한 projection 및 HTTP 422 한도는 유지.
- 기존 snapshot Target catalog를 Plan의 optional `catalog.targetOptions`로 전달하고 Client Zod와 quick/advanced Target 필터에서 projection 없이 사용하도록 하여 Plan에서 Target 필터를 고를 수 있도록 보존. 새 API/schema revision/새 DB·공수 엔진 변경 없음.
- 신규 SQLite 회귀는 Target 미연결 850 Task × 2 개인 Assignment(1,700건)를 추가해 명시 resource→Target projection의 초과 경로, 기본 Plan HTTP200/카탈로그/동일 인원과 Target-filtered Plan의 same-R Project 부하를 확인한다. 별도 client parser 회귀는 optional catalog의 유효·위조 형식을 구분한다. 기존 #622 TargetA80/Project140·원인 편집/복귀·Excel·보안·예산 검증을 유지한다.
- 본 추가 수정의 신규 local/remote CI·QA/Trusted QA 결과는 실행 증거 전 NOT TESTED. 리뷰 스레드는 수정 코드와 대조 후 해결하고 strict 최신 main 충돌 확인 후 새로운 exact-Head Full PR CI를 시작한다. 실패 원본을 소급 PASS로 표시하지 않으며 Owner HIGH 위험 수용·별도 병합 허가/릴리스 승인은 없다.

## PR #684 CI #2769.1 Chromium E2E 실패 보완 (2026-10-15)

- 이전 교정 Head `2cfb97ebaf9fc761aeaae7956e58cd82e979d377`의 [Full PR CI #2769.1](https://github.com/planner77/masterGantt/actions/runs/38632379339): QA Preflight/Policy/TypeScript/ESLint/Vitest/Next production build/Docker와 Required Quality/Docker aggregate는 SUCCESS. Chromium E2E shard2의 전용 `tests/e2e/issue-622-resource-plan-target.spec.ts:57`는 23 PASS/1 FAIL, 그 shard 49 NOT RUN; 나머지 5 shard는 #659 Fail-Fast 취소. E2E aggregate FAIL, 자동 QA는 required E2E 미성공으로 FAIL. 원본 결과는 변경하지 않는다.
- 원인: #2768 P1 보완으로 Plan이 전체 `targetProjection` 계층을 만들지 않고 `catalog.targetOptions` 경량 원본 목록을 반환하도록 변경했으나, `ResourcePlanDetails`의 `targetLabel`은 `data.targetProjection?.catalog`만 읽었다. Project 전체 참고의 Target B Assignment는 서버에서 정확한 Target public ID/provenance를 반환했지만 화면은 `Target · UUID`를 출력해 canonical 이름 계약을 잃었다. 공수·배정률·Capacity 계산의 오류가 아님.
- 수정: Resource Plan model에 `planTargetLabel(data, targetId)`를 추가해 원래 Target projection catalog를 우선 사용하고 없으면 동일 보고서의 `catalog.targetOptions`에서 **dimension=target + exact ID**로 이름을 찾는다. 상세의 출발 선택 A/선택 밖 B 모두 사용, 나머지 공개 API/도메인/Excel/로그인/원본 수정 경로는 불변. 카탈로그에 ID가 없으면 기존 ID·Target 미연결 안내를 유지하고 다른 axis의 이름을 오인하지 않는다.
- 회귀 보강: 기존 정확 실 Chromium E2E에서 Target A 출발 이름과 밖의 Target B 이름·40% 배정 편집 후 B 이름 유지 단언을 추가했다. 새 model Vitest는 projection 부재/선택 외 canonical Target/차원 충돌/미연결·없는 ID fallback/입력 불변을 검사한다. 기존 과투입80/140→80/120, 5폭 geometry, Excel downloads, snapshot·Stale·권한 테스트는 축소하지 않는다.
- 정책: `AGENTS.md`, `DESIGN.md`, `docs/QA_REVIEW_POLICY.md`, `docs/ISSUE_LIFECYCLE.md`에 따라 별도 신규 Issue를 생성하지 않고 #622 기존 브랜치에서 교정한다. CI/SemVer/DB migration/Capacity 산식/DESIGN 시각 언어 변경은 없다. 이 수정 이후 집중 로컬 테스트는 checkout 의존성 확보 전 NOT TESTED; 신규 exact-head Full PR CI 결과와 Trusted QA/Owner 위험 수용·병합은 별도이며 `release_authorized=false` 유지.
## Main CI #2771.1 FAILURE / 초기 Head의 교정 시도 기록 (2026-10-15)

이 절은 PR #686 초기 Head `9a9a4907d9d19848aab5c02a359338f51da2678d`의 구현 시도 이력이다. 아래의 동시 probe/DOM 게시 방식은 후속 P2 검토로 교정되었으며 현재 readiness 계약이 아니다.

- 최초 병합 PR #684는 Head `1bb71002bcce52a409bb3caeeb8fafb01043557b`, Main merge `bd54205741da65a0211cf77f9cb086d3cdb1ab2a`. 정확한 PR CI [#2770.1](https://github.com/planner77/masterGantt/actions/runs/38634326054) 및 기본 main Trusted [#411.1](https://github.com/planner77/masterGantt/actions/runs/38637395858)는 SUCCESS였으나 **이는 Main push CI PASS 증거가 아니다**.
- [Main #2771.1](https://github.com/planner77/masterGantt/actions/runs/38638132383), event=push, source exact merge SHA, attempt1: Policy/TypeScript/ESLint/Vitest/Next build/Docker + Required Quality/Docker SUCCESS. Chromium 6 shards 중 1/2/3/5/6 SUCCESS, **4 FAIL** (job116106607229, `tests/e2e/milestone-timeline-lane.spec.ts:62`: #551 1000 ordinary Task+2000 Milestone, `expect.poll` dev probe vs DOM API ID equality at 5초 초과). Shard4 135 PASS / 1 FAIL / 1 SKIP; Chromium aggregate FAILURE. GHCR publish job SKIPPED, 신규 candidate/digest 없음. 이 실패는 #622 공수/Excel 회귀 결과가 아니며 이전 PR CI PASS로 대체하지 않는다.
- #551의 기존 PR #2605.1/#2613.3에서도 동일 대량 probe readiness가 시간 순서에 민감하게 실패. 현재 Source는 진단 API를 `initialize(api)` 즉시 설치하지만 native Gantt frame ID는 이후 `setApiInstanceId` React commit에서 기록하므로 합법적 등록 후에도 5초 조건은 불일치할 수 있다. 정확히 무엇이 지연됐는지는 원본의 이진 Boolean predicate만으로 불명이다. dev-only `installMilestoneProbe`에서 최신 API·frame 소유를 확인한 뒤 진단 프로퍼티와 DOM dataset ID를 **동일 synchronous init**에서 게시한다. E2E는 5초/대량/identity 비교/전체 geometry/readonly를 축소하지 않고 상태 ID·read 진단을 실패 문자열에 보존한다.
- 기존 #622 Source/Capacity/Resource Plan/Target/Excel/DB·SVAR production Gantt instance·viewport 변경 없음. AGENTS.md/DESIGN.md/ISSUE_LIFECYCLE/CI_CD/QA_REVIEW_POLICY를 확인하고 실제 내용 변경은 `src/features/gantt/project-gantt.tsx`의 dev-only 진단 및 E2E와 관련 docs. `MILESTONE_TIMELINE`, `TEST_PLAN`, `REMOTE_VALIDATION`, Work Packet UPDATED, `DESIGN.md`/API/DB_SCHEMA/EXCEL_EXPORT N/A. 이 PR은 **새 Issue를 만들지 않는 #622 Main CI 교정**, application 0.114.0 유지, `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=true`, `release_authorized=false`. 새 exact-head PR CI 3종 + Trusted QA/Owner 병합 수용 전 MERGE_READY=BLOCKED. 정식 GHCR tag/릴리스 승인은 별도.
- 재현 기반 최소 보완의 원격 검증은 correction PR E2E6/Quality/Docker + Trusted QA부터 진행하며 원본 #2771 immutable 실패를 소급 수정·강제 Main rewrite하지 않는다. PR 성공 후 Owner 인수와 새 Main push에서 `ci-<new SHA>`를 검증한 뒤 #622 후속 종료를 별도로 판단. Main/GHCR 결과 확인 전 ISSUE 상태 Open 유지.

## PR #686 CI #2773.1 Preflight 실패 및 P2 보완 (2026-10-15)

- 원본 [PR CI #2773.1](https://github.com/planner77/masterGantt/actions/runs/38642502958), run_id `38642502958`, run_attempt `1`, Head `9a9a4907d9d19848aab5c02a359338f51da2678d`, base `bd54205741da65a0211cf77f9cb086d3cdb1ab2a`, test merge `28fc90438cade34fc8c535307ea7827c07933cc3`: **FAIL**. [QA Preflight job](https://github.com/planner77/masterGantt/actions/runs/38642502958/job/116121359974)의 `원본 base SHA의 QA Preflight 실행 (read-only)`에서 `docs/SCHEDULING_ENGINE.md`의 UPDATED 선언을 현재 PR diff로 입증하지 못했다. 원본 기능 PR의 Work Packet을 재사용하며 최초 DOCUMENTATION_SYNC 절을 교정 범위로 갱신하지 않은 원인이다. Quality/E2E/Docker 구현 Job은 SKIPPED이며 실제 테스트 실패·성공으로 해석하지 않는다.
- 현재 DOCUMENTATION_SYNC를 교정 PR diff에 맞게 갱신하고 Scheduling 계산 불변의 N/A 근거를 명시한다. 과거 #684의 UPDATED 이력은 별도 절에 보존한다. base validator·required gate·skip·timeout·허용오차를 변경하지 않는다.
- [P2 리뷰](https://github.com/planner77/masterGantt/pull/686#discussion_r4276610008)는 probe 설치와 DOM API ID 동기 발행이 같은 함수여서 layout 준비를 독립 검증하지 못함을 지적했다. init의 진단 probe와 React/layout의 준비 완료를 분리하여 검증하고 stale API·coordinator cleanup은 준비 완료로 인정하지 않는다. 대량 1000 Task+2000 Milestone·기존 5초 readiness·native scroll/fullscreen/resize/geometry·mutation0 회귀를 유지한다.
- 원본 Main #2771.1 FAIL 및 PR #2773.1 FAIL은 불변이다. 보완 후의 Local Fast Feedback과 새 exact-head 원격 CI를 구분하고 PR CI 시작만 확인한다. 결과 모니터링·병합·Main/GHCR·정식 Release/tag·Issue 종료는 이번 요청 범위에 포함하지 않는다. `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`, `release_required=true`, `release_authorized=false`를 유지한다.

### PR #686 보완 Local Fast Feedback 및 사전 검토

- frontend `/root/probe_fix`: `tests/e2e/milestone-timeline-lane.spec.ts` 전체 Chromium **20/20 PASS, 45.5초, skipped/flaky 0**. 새 독립 readiness 부정 사례와 기존 대량 3000행·Day/Week·peer scroll/fullscreen/split/resize·5폭 geometry·readonly mutation0 포함. 대표3개 별도 3/3 PASS, 14.8초는 전체20개와 중복되므로 합산하지 않는다.
- 최종 typecheck PASS, 변경 Source/E2E scoped ESLint 오류0·기존 hooks warning3, diff-check PASS. 최초 webserver 실행은 sibling node_modules symlink가 Turbopack filesystem 경계에서 거부되어 테스트 시작 전 BLOCKED였으며, 실제 frozen `npm ci` 447packages/9초 후 동일 assertion으로 실행했다. 전역 unique key warning1 및 합성404 로그는 성공으로 지우지 않는다. 생성 `next-env.d.ts`는 baseline으로 복원했다.
- Manager: base 검증기의 `docs_gate`로 correction diff에 대한 DOC_SYNC/AC1~AC8 구조 검사 PASS, Markdown216files 링크 PASS. 구조 검사 결과는 문서 의미·독립 QA·원격 CI PASS가 아니다.
- 별도 read-only 사전 Reviewer `/root/review`가 이전 동시 게시 시도와 현 readiness 계약의 문서 불일치를 지적하여 MILESTONE_TIMELINE/REMOTE_VALIDATION/TEST_PLAN 첫 절을 현재 계약으로 정합화하고 초기 시도는 역사적 기록으로 표시했다. 최종 사전 검토·새 Head 원격 결과·Owner 수용은 각 증거로 구분한다.
- 초기 Main #2771의 bool-전용 로그만으로는 어떤 단계가 5초를 넘었는지 미확정이다. 독립 ready와 frame/probe/coordinator 진단 및 로컬20/20은 새 Head 검증 근거이며 원본 원인 확정·원격 완치 증거로 확대하지 않는다.

- 사전 Reviewer `/root/review`의 실제 HTML report 내장 zip 독립 대조: total20/expected20/unexpected0/flaky0/skipped0/ok=true, 45498.948ms, Chromium/worker1. 신규 readiness 부정 사례1745ms/retry0, 기존 대량 peer/fullscreen/resize6708ms/retry0, 해당 readiness poll2815ms로 원래5초 이내. 390/768/1024/1440/1920px geometry 모두 expected. 최종 사전 검토 잔여 P1/P2 없음. 이 사전 검토는 Owner-managed 최종 승인이나 원격 CI PASS가 아니다.
- 원본 실행 명령: `npx playwright test --config tests/config/playwright.config.ts tests/e2e/milestone-timeline-lane.spec.ts --workers=1`, exec session78679, final chunk `d9ad8b`, exit0. report는 해당 전용 worktree `playwright-report/index.html` 및 `test-results/.last-run.json`이며 runtime 산출물은 Git에 추가하지 않는다. Source SHA256: project-gantt `1e6dafd9857638b6b01057e35fd87d0a37c23d67d2be980fb15351184b67297e`, spec `fc760ea8cd5e60bb6ec212f90feb9953819b3ebd05d85e84146302230b88e92a`.
