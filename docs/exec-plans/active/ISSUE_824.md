# Issue #824 — 대시보드·기준정보 밀도 통합 개선

## Issue Work Packet

- issue: #824; children: #826, #827, #828, #829, #830; prerequisite #825 CLOSED.
- baseline: `e95cb091` / app `0.135.5`.
- branch: `feat/issue-824-dashboard-consistency`.
- lifecycle_phase: REWORK_VALIDATED / PR_CI_READY.
- requested_scope: 다섯 하위 이슈 구현·검증·문서·PR·최종 릴리스·종료. 사용자 최종 GHCR 1회 요청에 따라 구현과 직접 검증은 #826→#827→#828→#829→#830 순차 수행하며 하나의 PR/main merge/version으로 통합한다. 하위 종료는 최종 릴리스 증거 이후로 유예한다.
- publication_contract: 최종 main merge의 `ci-<SHA>` 이미지1개를1회 빌드/push·exact digest smoke/SBOM/provenance 검증 후 동일 digest를 version/rolling tag로 정식 승격한다. Release 재빌드와 하위 이슈별 중간 main merge/게시를 만들지 않는다.
- lifecycle_mapping: 통합 PR의 canonical `Refs #824`는 한 줄만 사용하고 하위는 Related 링크로 연결한다. Generic Finalizer는 primary #824를 처리하며 하위 #826~#830은 동일 최종 release 및 각 AC 증거를 확인한 Manager가 정상 FINAL 설명 후 순서대로 close한다. bot FINAL marker를 수동 생성하지 않는다.
- version_decision: UI 회귀 교정 PATCH `0.135.6` 후보. 중간 version bump/main publish 없음.
- release_required: true
- release_authorized: true
- release_authorization_evidence: 사용자 최종 게시 요청 및 [OWNER v0.135.6 marker](https://github.com/planner77/masterGantt/issues/824#issuecomment-6443447292). 이는 QA/병합/운영 배포 완료가 아니다.
- risk_level: HIGH
- risk_reason: 공통 CSS의 다섯 소비자와 관리자 작업면; package/lock 보호 경로 변경 예정. API/DB/계산/권한/CI·QA 정책은 변경하지 않는다.
- qa_method: AGENT
- qa_required: true
- reviewer: 초기 source PRE_QA=PASS 이력 보존. CI가 누락된 geometry 소비자를 발견한 뒤 `/root/qa` REWORK_PRE_QA=PASS/지적0으로 새 test/doc 후보를 검산했다. 보호 경로 최종 독립 인간 QA 영수증은 NOT TESTED.
- independent_qa: NOT TESTED
- trusted_qa: FAIL (원본 Full3342.1 미성공의 파생 Trusted990.1; 새 후보는 NOT TESTED)
- manager_decision: NOT TESTED (새 후보; 원본 c750는 REWORK)
- MERGE_READY: BLOCKED
- issue_comment_writer: Manager
- issue_comment_allowed_types: PLAN, STATUS, EXCEPTION, DECISION_REQUIRED, RESUME, FINAL

## 역할과 소유권

Manager는 문서/버전·통합·Issue 기록을 작성한다. ui_ux는 읽기 전용 설계, frontend는 제품 CSS/필요 TSX와 기존 관련 E2E·직접 브라우저 관측을 단일 writer로 순차 수행한다. qa_docs는 별도 읽기 전용 사전검토, infra는 원격 gate/릴리스 운영을 담당한다. 참여관리 호스트의 `project-readonly-view.tsx`와 소유 CSS는 F824-006의 단일 배정 gateway coarse target을 위한 presentation class만 frontend 소유에 추가하며 기존 handler/state는 변경하지 않는다. 공유 CSS 소비자·상태 보존의 교차 위험 때문에 frontend 도구의 Sol/high 역할을 사용한다. 실제 런타임 모델 식별 여부와 설정값은 구분한다. 병렬 제품 파일 작성 금지.

## 범위와 검증

- #826: WBS 공통 body14/section16/tool13, fine36/coarse44, 넓은 검색 label+input 수평 정렬. 기존 resource 소비자·고급 조건/구성기·정확 원본/상태 보존.
- #827: Milestone 계층 조회와 전체 Gate·관리의 명명된 구획. 선택 Task/Assignment와 전체 Gate 모집단 분리 유지.
- #828: 전역 Resource 인증 전/후·개인/그룹/구성원·편집을 synthetic fixture로 before 측정 후 실제 편차만 수정. 관리자 shell/auth 예외 유지.
- #829: 프로젝트 기준정보4관점 폭/제목/목록/검색 비교, 선행 #825 후 local 문제만 교정. 직접 공정/구역/설비/시스템·참여/개인배정 의미 유지.
- #830: 전역 물류/프로젝트 마스터 인증 후 synthetic 목록·관계 측정, 양호한 기준정보 KEEP. section16/body14/tool13/관리40/coarse44·표 소유 scroll.

각 이슈 AC 원문은 GitHub Issue를 기준으로 하며 [25개 AC 검증 추적](../../ISSUE_824_VALIDATION.md)의 직접/인접 기존 spec을 EXTEND/KEEP_UNIQUE한다. 390/768/1024/1440/1920×900, 동일 fixture·locale/DPR/source의 before/after, control/label 정렬·첫 데이터 위치·table scroll/document overflow를 기록한다. keyboard/focus/Escape·readonly/edit·error/pending/stale 실제 실행 범위를 구분한다. CSS assertion만으로 권한/CRUD PASS를 주장하지 않는다.

## AC_TEST_COVERAGE

- AC1: 사용자 예시/하위 이슈 인벤토리와 source별 before/after 측정. 구현 단계에서 실행 경로/파일을 갱신한다.
- AC2: 6 dashboard/4 project master/3 global admin 범위를 기존 fixture와 비교하며 실측/소스/미실행을 구분한다.
- AC3: 기존 감사 branch의 DESIGN 원칙·보고서를 최신 main 계약과 비교해 통합한다.
- AC4: 각 하위 이슈 파일 소유권/선행/AC·문서·정확 Head CI/QA/Manager 증거를 통합 Packet에 기록한다. 현재 원격 검증 NOT TESTED.
- AC5: 63km 실프로젝트·실운영 관리자·native125%/AT/실기기 미검증은 #517 경계로 유지하고 synthetic 결과로 확대하지 않는다.

## TEST_LIFECYCLE_REVIEW

기존 issue-730/732/733/734/735/736 및 project-resource-memberships/issue-762, resource-catalog-delete, logistics-type-catalog-admin, project-master-admin/relations를 우선 검색·확장한다. 기간/계산·권한·실제HTTP/SQLite·snapshot stale·정확 drill·Gantt 보존은 KEEP_UNIQUE. 테스트 삭제/skip/timeout/retry·gate 완화 없음. 단순 CSS 복제 테스트 추가 없이 기존 meaningful 시나리오에 geometry·접근성 검증을 결합한다.

## DOCUMENTATION_SYNC

제품 구현·문서 영향 분석과 경로별 UPDATED/N/A를 반영했다. Manager 문서 동기화 검토는 PASS이며 별도 qa_docs의 최종 사전검토와 원격/인간 gate는 별도로 기록한다.

- `CHANGELOG.md`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED
- `docs/exec-plans/active/ISSUE_824.md`: UPDATED
- `docs/ISSUE_824_VALIDATION.md`: UPDATED
- `docs/ISSUE_824_FAILURE_ANALYSIS.md`: UPDATED
- `docs/UI_UX_REAUDIT_2026_10_27.md`: UPDATED
- `docs/exec-plans/active/UI_UX_ROLLOUT.md`: UPDATED

- `DESIGN.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 label/focus/responsive 원칙 구체화)
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/LOGISTICS_DASHBOARD.md`: UPDATED
- `docs/MILESTONE_USER_GUIDE.md`: N/A(계층/전체 Gate 구획의 시각 정돈이며 원본 관리·완료·교환 동선 불변)
- `docs/RESOURCE_KPI_DASHBOARD.md`: N/A(리소스 지표·Plan·조회 의미와 기존 소비자 action 불변)
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: N/A(레거시 Target 공개 기능을 복구하지 않으며 지원 교환·원본 계약 불변)
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/REQUIREMENTS.md`: N/A(도메인·기능 계약 불변)
- `docs/ARCHITECTURE.md`: N/A(component/service 경계 불변)
- `docs/API.md`: N/A(요청/응답·권한 계약 불변)
- `docs/DB_SCHEMA.md`: N/A(DB/migration 불변)
- `docs/SECURITY.md`: N/A(세션/Origin/revision 불변)
- `docs/SCHEDULING_ENGINE.md`: N/A(계산·일정 알고리즘 불변)
- `docs/CI_CD.md`: N/A(workflow·Required3·registry/Release 정책 불변)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 증거 계약 적용; 결과는 Packet/Issue에 기록)
- `docs/GITHUB_OPERATIONS.md`: N/A(운영/승인 정책 불변)
- `docs/QA_REVIEW_POLICY.md`: N/A(독립 인간 QA·Trusted/Owner 정책 유지)
- `AGENTS.md`: N/A(실행 지침 변경 없음)

## 현재 증거와 미검증

새 원격 PR/Required3·Trusted QA·독립 인간 승인·Manager ACCEPT·Main/GHCR/Release/cleanup/Issue 종료는 NOT TESTED. 이전 #825의 PASS는 이 Head에 재사용하지 않는다. gh CLI의 기존 자격 증명은 유효하지 않으며 연결 GitHub 도구와 public git transport를 사용한다.

## 순차 구현과 로컬 검증 인계

- #826: `d2f9692e` — 공통 조회5소비자 before/after50관측씩과 기존 #798 실제 HTTP/SQLite·5폭/keyboard1case PASS. 모바일12px 정렬 지적과 fixture 재seed400 최초 실패 보존.
- #827: `684c6b37` — Milestone 두 명명 구획과10관측씩, 기존 #732 Target0/Gate/5폭keyboard1case PASS.
- #828: `733b6daf` — 인증 전/개인/그룹/구성원/dialog50관측씩과 기존 UI3고유case PASS. 후속 `3c0a9f5d`에서 label-in-name P2를 교정하고 members10관측·기존 geometry1case를 재검증했으며 중복 합산하지 않는다.
- #829: `fd042c14` — 프로젝트 기준정보4관점40관측씩·UI6고유case+별도 실제 HTTP/SQLite 공정/구역CRUD·restart1case PASS. 초기 selector 오류와 coarse summary/gateway 실패를 보존한다.
- #830: `c577dd00` — 전역 auth/물류2/마스터3/관계80관측씩·기존 직접3case PASS. fine master는 KEEP이고 coarse·관계열 예산만 보완했다. 추가5개 상태/CRUD case도 실제 영수증으로 검증해 고유8case이며 F824-009 교정의 동일 #538 case 재실행은 합산하지 않는다.

위 SHA는 로컬 순차 commit이다. 원격 게시 시 commit metadata가 달라지면 단계별 tree/blob의 동일성과 원격 SHA를 별도로 기록한다. 단계별 관측은 당시 source SHA256에 결속한다. `74ce0634`에서 잘못 배치된 테스트 coarse 블록을 바로잡고 `6f869c20`에서 관계 action의 실제 포커스 잘림을 scroll-margin8px·기존 테스트 강화로 교정했다. package0.135.5→0.135.6과 교정 source의 최종22표본·build/typecheck/focused lint를 별도 PASS로 확인했다. 원격 정확 Head Required3/Full8·Trusted·독립 인간 QA·Manager/main/Release는 아직 NOT TESTED다.

## 최종 로컬 상태와 다음 gate

[25AC별 실행 추적·최초 실패](../../ISSUE_824_VALIDATION.md), [20고유 Chromium 실행 영수증](../../evidence/issue-824/phase-command-receipts.json), [v0.135.6 최종22표본](../../evidence/issue-824/final-runtime-manifest.json), [build/type/lint 동결 영수증](../../evidence/issue-824/final-fast-validation.json)을 사용한다. 실제 HTTP/SQLite3case·mock UI17case, 별도 실제 SQLite 서비스/handler2case를 구분한다. 최종28소스 파일 SHA256 start=end이며 Next 생성물·역사적114산출물은 원본을 로컬 보존한 뒤 baseline으로 복원했다. 복원 후 타입 검사 PASS.

- 제품/테스트/버전 로컬 검증: PASS (영수증에 명시한 범위)
- DOCUMENTATION_SYNC: PASS (Manager 영향 분석/본문 정합성, 별도 사전검토 결과는 후속 기록)
- 실제 Agent: ui_ux read-only 설계/이미지 비교, frontend 단일 구현/직접 실행, qa_docs 별도 read-only 사전검토, infra 원격 게시 준비. 실제 모델 식별을 설정값만으로 실행 증명하지 않는다.
- risk_level: HIGH / qa_method: AGENT / qa_required: true
- 독립 인간 QA_FINAL: NOT TESTED / Manager ACCEPT: NOT TESTED / MERGE_READY: BLOCKED
- 새 exact Head Required3/Full8·Trusted·Main/GHCR/Release·cleanup/Issue 종료: NOT TESTED
- 운영63km·실기기/native125%/AT: NOT TESTED (#517 별도 범위)

원격 PR을 Ready로 만들 때 canonical Primary #824와 여섯 Issue 범위를 처음부터 완성하고, 이후 CI 상태는 댓글로 기록한다. 기본 브랜치 정책의 인간 QA/Owner receipt를 소급하거나 자동 생성하지 않는다. 원격 full3 aggregate·Trusted/독립 인간 QA·Manager 판단이 실제 확보되기 전 main merge/게시/종료를 실행하지 않는다.

### 최종 독립 사전검토

`/root/qa` PRE_QA=PASS, 미해결 P1/P2=0. [검토 영수증](../../evidence/issue-824/pre-qa.json)의28파일 정규화 SHA256 지문은 `32231e165187eec1d7da4b2f18ece639e7f04bdb865056e1a7f23a84e6c4f38b`다. 실행을 중복 수행한 것이 아니라 현재 source·stdout/manifest hash·압축 원본·실측 수치·대표 이미지·25AC/문서를 구현자와 분리해 검산했다. F824-009 FAIL/PASS와 기존 outline/44px 보존, 보호 AGENT 인간 gate와 자동 Pre-PR7UNKNOWN/BLOCKED를 확인했다. 이 결과는 인간 GitHub APPROVED·QA_FINAL PASS·기본 브랜치 Trusted·Manager ACCEPT가 아니다.

## 첫 Full PR CI 실패와 REWORK (2026-10-27)

[원격 Full3342.1](https://github.com/planner77/masterGantt/actions/runs/40521099686)의 Quality/Docker는 원본 c750 Head에서 SUCCESS였으나 E2E는 장문 geometry helper의 고정44px 기대/실제fine36px로 FAIL했다. 전체8로그를 감사해 추가 실제FAIL0, 관측PASS170/FAIL1/조건부SKIP1/완료결과미확인657을 구분했다. Trusted990.1은 원본 CI 미성공의 파생 FAIL이며 인간 QA 미확보가 이번 직접 원인은 아니다.

[누적 PR CI 실패 원장](../../ISSUE_824_FAILURE_ANALYSIS.md)과 원본/계수 보충 JSON을 기준으로 같은 spec의 media별 양축36/44·readonly coarse helper 실행을 교정한다. 초기 사전검토와 로컬20case PASS는 역사적 이력이며 새 test 후보의 검증/공식 Full을 대체하지 않는다. 새 Head에서는 이전 Quality/Docker도 stale이며 Required3/Full8·Trusted·인간 QA·Manager/main/Release를 모두 재검증한다. 제품36/44 계약·정식0.135.6 후보·게시1회 계획과 기존 gate는 유지한다.

### REWORK-01 동결 후보 인계 (2026-10-28)

제품/버전/collector 변경 없이 기존 `issue-730-view-composer.spec.ts` 한 파일의 geometry oracle을 실제 pointer/any-pointer에 따른36/44 양축으로 동기화했다. coarse390 기존 readonly 문맥의 helper 실행을 추가하고 fine5폭의 별도 증거가 덮이지 않게 coarse suffix를 사용한다. 원본 RED·정규 직접/교차2case PASS·실제 DOM negative35/43 양축4관측 거절/복원·typecheck/focused lint PASS 및 최초 수동 media 조건 통제 FAIL은 [누적 원장](../../ISSUE_824_FAILURE_ANALYSIS.md)에 결속했다.

새28파일 지문은 `147cf042f44863b60310ef9f3aeb4f6a1277d1ffeffe70247400fa2b7648df08`이며 test SHA256은 `7973deafae09bd18bdb37c0f7889295a30d5eb67c50ec7f07f4a956d5a4a2f65`다. 이전28 current 지문과 원격 Quality/Docker를 새 Head PASS로 재사용하지 않는다. 제품17/package·lock/collector 불변에 한해 기존 build·22runtime Local 증거를 재사용하고 현재 test/doc은 별도 독립 재검토한다. 단계별 누적 정규 고유21case(실HTTP/SQLite4+mock17)와 새 후보 실행2case·음성4관측을 구분한다. 새 Full8/Required3·Trusted/독립 인간 QA·Manager 승인·main/Release 전 이슈는 OPEN이다.

REWORK-01 독립 사전 재검토는 [REWORK_PRE_QA 영수증](../../evidence/issue-824/pre-qa-rework-01.json)의 PASS/지적0이다. Root는 실제 media별 양축·기존 구조/권한·readonly guard가 유지된 것을 확인했고 현재 source/type/lint·문서 동기화 후 새 PR synchronize Full8을 요청한다. 아직 새 Head의 CI나 인간 QA를 PASS로 선언하지 않는다.
