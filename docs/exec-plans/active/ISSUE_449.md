# Issue #449 — 전 화면 UI/UX 구현 대조·지침 통합

## PLAN

- Primary Issue: [#449](https://github.com/planner77/masterGantt/issues/449)
- PR: [#458](https://github.com/planner77/masterGantt/pull/458); branch: `docs/issue-449-ui-ux-audit`.
- 기존 PR Head: `c9fe35f131af10a907702a59a90bd70a9a4d77da`.
- 최신 main: `d2768676aa7a0edff67df9bdeb3e1b49979fd577`; application `0.116.0`; SVAR Core `2.7.3`.
- 사용자 요청: 관련 이슈·지침·문서에 따라 구현, 지속 적용 UI/UX는 DESIGN.md 반영, 미해결 리뷰/충돌 해소 후 PR CI 시작. 결과 모니터링·병합·main/GHCR·release·Issue 종료는 제외한다.
- risk_level: LOW
- risk_reason: 완료된 제품 개선의 현황 대조와 UI 설계 지침·감사 문서 통합만 수행한다. 제품 동작·보안·검증 Gate·실행 지침은 변경하지 않는다.
- qa_method: OWNER_MANAGED
- qa_required: false
- independent_qa: N/A(Owner-managed 최종 승인 경로; 별도 ui_ux·qa_docs 사전 문서 검토는 최종 GitHub 독립 승인과 구분)
- manager_decision: NOT TESTED
- release_required: false
- release_authorized: false
- version_decision: keep; 문서 전용 변경이며 현재 버전은 운영 배포 증거가 아니다.

## 구현 판단과 파일 소유권

Manager가 DESIGN·감사 기록·현재 Packet·PLAN과 GitHub 기록/게시를 소유한다. 별도 ui_ux Agent는 읽기 전용으로 source·지침·중복을 검토했고 원래 UI-01~09의 명백한 미구현 결함을 발견하지 못했다. qa_docs는 별도 읽기 전용 문서/증거 검토를 담당한다. 같은 파일에 복수 작성자를 두지 않는다.

#452~#457 및 #490/#491/#502는 원격 closed/completed다. 최신 main에 공통 admin shell/auth, margin0, Resource/Group peer tabs·프로필 Dialog, 물류/기준정보 control·표 geometry, Task Editor footer/pending/Gantt 보존, 공통 geometry helper·cross-screen 회귀, settings/transfer/error-boundary 테스트가 존재한다. 기존 구현을 다시 작성할 근거가 없어 제품 변경은 하지 않는다. 원래 PR #458의 최신 main 합류 중 DESIGN 충돌은 main 전체 내용을 기준으로 필요한 원칙만 관련 절에 통합해 해결한다. 초기 11절의 미래 목표·40~48px 초기 row 목표·작업 순서는 영속 기준에 복제하지 않는다.

Design Delta A: 내부 KPI 정보구조 참조, reset 이후 입력 식별성, 동등 목록의 full-width peer tab·행별 편집 progressive disclosure, content-driven row height와 증거 구분을 여러 화면에 적용할 원칙으로 채택한다. 기존 §4 shell/spacing·§5 상태·§6 접근성, #589·#715와 Milestone 최신 정책은 그대로 보존한다. Skill의 focus-visible 권고는 기존 원칙의 구체화이며 새 프레임워크·control 크기 강제로 확대하지 않는다.

## DOCUMENTATION_SYNC

- `DESIGN.md`: UPDATED
- `docs/ISSUE_449_UI_UX_AUDIT.md`: UPDATED
- `docs/exec-plans/active/ISSUE_449.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 interaction·검증 계약을 준수하며 동작 변경 없음)
- `docs/TEST_PLAN.md`: N/A(제품 및 테스트 무변경; 기존 457 coverage와 490/491/502 검증 문서 연결)
- `docs/PROJECT_UX.md`: N/A(기존 화면별 현재 동작·초안·복귀 계약 무변경)
- `docs/TASK_EDITOR.md`: N/A(기존 편집·44px hit-area·pending 및 상태 보존 무변경)
- `docs/REQUIREMENTS.md`: N/A(원래 개선의 하위 구현을 대조하며 제품 요구·수용 조건을 완화하지 않음)
- `docs/ARCHITECTURE.md`: N/A(계층과 제품 컴포넌트 구현 무변경)
- `docs/API.md`: N/A(Endpoint·DTO·권한·Origin·revision·If-Match 계약 무변경)
- `docs/DB_SCHEMA.md`: N/A(DB·migration·저장 정책 무변경)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정·집계·Milestone canonical 계약 무변경)
- `docs/SECURITY.md`: N/A(인증·세션·권한·비밀번호 정책 무변경)
- `docs/IMPORT_SCHEMA.md`: N/A(교환 형식 및 Excel·VBA·DRM 계약 무변경)
- `docs/CI_CD.md`: N/A(Workflow·Required check·GHCR·release 계약 무변경)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 증거 계약 무변경; 새 HEAD 결과는 별도로 인계)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 단일 Ref 묶음 게시·metadata·review/CI 운영 절차 준수)
- `docs/DEPLOYMENT.md`: N/A(제품 이미지·배포 무변경)
- `CHANGELOG.md`: N/A(문서 전용; application version 및 제품 release 없음)

## AC_TEST_COVERAGE

- AC1: 같은 레벨 세 admin shell·auth·control은 #452 구현·admin-auth-layout.spec.ts 및 457 coverage로 추적; 최신 actual browser 재실행 NOT TESTED.
- AC2: #452~#457/490/491/502 closed 및 FINAL 링크를 감사 기록 현재표에 연결; #517 open과 457 coverage 미실행 범위·역사적 AC2 GAP/FAIL을 보존. 문서 PR로 Epic 종료하지 않음.
- AC3: 기존 457 coverage의 다섯 폭·대표 상태와 미실행 조합, 490/491 테스트 및 환경 후속517을 연결. 모든 상태×폭 전체 PASS를 주장하지 않음.
- AC4: 기존 ui-geometry helper·coverage의 gap/overlap/control/row/column/overflow 측정 계약을 대조. 현재 source-only와 과거 browser 측정을 분리.
- AC5: 같은 행 control top/height≤1 CSS px 및 wrap 예외는 기존 DESIGN §4·coverage·490/491 검증 계약을 유지. 최신 실제 실행은 NOT TESTED.
- AC6: 기존 keyboard/focus/label·Task Editor44px·native choice 계약을 보존. native125·실기기·screen reader는 #517 NOT TESTED/BLOCKED.
- AC7: 감사 기준0.83.3/6ce221bc와 현재 source0.116.0/d2768676을 구분. 실제 배포 SHA/version 미확인은 #517로 추적하고 현재 PR CI·최종 QA/Owner는 NOT TESTED.
- AC8: DESIGN 관련 절·감사 현재표·Packet/PLAN 동기화, 기존 화면 계약·TEST_PLAN/457 coverage는 동작 무변경으로 N/A 근거 기록. Markdown 링크·문서 의미·diff 검증을 수행.

## 검증과 남은 Gate

제품·테스트·의존성·Workflow diff는 0이다. 로컬 문서 링크·diff·DOC_SYNC/AC 구조·main ancestry 및 원격 게시 후보와 로컬 검증본의 전체 Git tree 동등성을 검증하고 별도 qa_docs 문서 검토를 수행한다. Local Pre-PR의 영향 분석은 dry-run으로 남기며 실행 PASS로 보고하지 않는다. 제품 source가 변하지 않아 앱 실행·전체 Unit·Playwright·Docker 로컬 반복은 N/A다. 별도 브라우저 작업은 없으므로 Playwright Skill의 실제 실행도 N/A다.

최신 Head quality/e2e/docker·Trusted QA·Owner ACCEPT는 NOT TESTED다. 문서 경로의 CI가 정상적으로 일부 job을 생략해도 실제 전 화면 UX를 PASS했다고 해석하지 않는다. GitHub PR CI Run/attempt/Head/base/test-merge 시작 snapshot은 게시 후 Issue/PR 댓글로 남기며 결과를 모니터링하지 않는다. #517 환경과 Epic 최종 수용은 이번 범위 밖이다.

## Local Fast Feedback · 2026-10-18

- Markdown local links: PASS, 248파일.
- `git diff --check origin/main`: PASS; 제품/테스트/의존성/Workflow 변경0, 문서4개만 변경.
- 기존 main의 read-only `docs_gate` 실행: DOCUMENTATION_SYNC 구조 및 AC1~AC8 mapping PASS(의미 검토·원격 QA는 별도). 경로 위험도 LOW·protected0 확인.
- 최초 merge 진행 중 Pre-PR dry-run: BLOCKED, `spawnSync git ENOBUFS`. old Head와 latest main의 큰 미커밋 merge diff를 읽는 준비 단계 오류이며 테스트 실행0이다. 기본 버퍼/정책을 바꾸지 않고 통합 commit 생성 후 동일 명령을 다시 실행했다.
- 통합 commit `dc7921bd98ce06c0708a2d9739c5ebd0a7d2006c`에서 `node scripts/verify-prepr.mjs --mode=targeted --base=origin/main --issue=449 --pr=458 --risk=LOW --dry-run`: NOT TESTED, selection READY/4paths/selected0/UNKNOWN0/missing0/sourceStable=true. 이는 영향 분석이며 실행 PASS가 아니다.
- 초기 PR #458 old Head `c9fe35f131af10a907702a59a90bd70a9a4d77da`의 [Run #1832.1](https://github.com/planner77/masterGantt/actions/runs/37313760348)은 SUCCESS였다. 이 조회에서 원본 실패 Run은 없으며 오래된 성공을 새 Head 근거로 사용하지 않는다.
- merge 과정의 cached diff whitespace 경고는 old Head 대비 최신 main이 가져온 기존8개 위치다. 원본 main 파일을 불필요하게 수정하지 않고 origin/main 대비 이번4문서 whitespace0을 확인했다.
- PR 사전 조회 미해결 review thread0. 게시 직전에 최신 main·expected Head·thread와 전체 tree/부모를 재검증하며 API 방식은 branch Ref를 최종1회 갱신한다. Git CLI 인증401을 변경하거나 자격증명을 추출하지 않고 기존 연결 GitHub 도구를 사용한다.

별도 사전 문서 검토: `ui_scope_review`(ui_ux)와 `qa_docs_review`(qa_docs)는 실제 별도 Sub-Agent로 읽기 전용 검토했다. qa_docs는 제품/테스트/의존성/CI 변경0·248개 링크·공백·main ancestry·원문 AC1~8 매핑과 역사적/환경 미검증 경계를 직접 대조해 사전 문서 범위 PASS·차단 지적0을 보고했다. tree 동등성 표현은 원격 후보↔로컬 검증본 비교임을 명확히 했다. 이 사전 검토는 최신 GitHub Head의 독립 QA_FINAL 승인이나 Owner ACCEPT가 아니다. Reviewer의 gh 인증401로 원격 상태 직접 재조회는 BLOCKED였으며 Manager가 인증된 연결 도구로 조회한 Issue/FINAL 기록을 사용했다. 모델/effort의 실제 runtime metadata를 별도로 검증하지 않았다.

## PR CI #2934.1 실패 분석·보완 (2026-10-18)

- #449 **단일 누적 실패 원장**: [ISSUE_449_FAILURE_ANALYSIS.md](../../ISSUE_449_FAILURE_ANALYSIS.md). 새 Run 실패 시 같은 문서에 F-449-002 이후 append-only 기록한다.
- [원본 PR Full CI #2934.1](https://github.com/planner77/masterGantt/actions/runs/39089429716): HEAD `84004e9d6fe84905777bd3130656a5ab35eaa9de`, Base `d2768676aa7a0edff67df9bdeb3e1b49979fd577`, test merge `6906dbea79697e80b436e991116733ac71576257`; required Quality/E2E/Docker aggregate SUCCESS, docs-only 구현 Job SKIPPED, `QA Final — Automated` BLOCKED/FAIL (open review thread). 과거 #1832.1 SUCCESS는 별도 이력이며 새 Head PASS 근거가 아니다.
- Codex P1 (초기 Head) 활성 PLAN 누락 지적은 현재 `docs/exec-plans/active/PLAN.md` 최상단의 #449 항목과 본 Work Packet의 owner/AC/문서 계약으로 충족함을 확인. [근거 답글](https://github.com/planner77/masterGantt/pull/458#discussion_r4305415726) 후 thread `PRRT_kwDOUUB7Bc6tmh-g` resolved=true를 확인했다. QA/Required check 우회나 제품·테스트 변경 없음.
- 이 보완은 ledger + 본 Work Packet의 **문서 전용** 변경이다. 다음 exact-Head PR CI Run은 커밋 게시 후에 기록하며, 원격 새 결과/최종 QA·Owner ACCEPT는 시작 시 **NOT TESTED**. #517 실환경/전체 Epic 종결은 별도다. 병합·Main/GHCR·이슈 종료를 수행하지 않는다.
