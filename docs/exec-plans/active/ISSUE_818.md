# Issue #818 — 활성 진행률 핸들의 인접 Task 오대상 교정

## Issue Work Packet

- repository: `planner77/masterGantt`; issue: [#818](https://github.com/planner77/masterGantt/issues/818)
- related: [#816](https://github.com/planner77/masterGantt/issues/816), [PR #817](https://github.com/planner77/masterGantt/pull/817), [F816-006 원본](../../ISSUE_816_FAILURE_ANALYSIS.md)
- lifecycle_phase: PR_CI_START_READY / LOCAL_SELECTED_PASS / PREPR_BLOCKED
- baseline_sha: `596dd70db8b242f450ab555ed2bcf049a0c14564` (main, 2026-10-27 KST)
- branch: `fix/issue-818-progress-hit-target`; worktree: `/home/planner/Dev/masterGantt-818`
- baseline_version: `0.135.2`; current_version: `0.135.3`; version_decision: patch
- version_reason: 인접 Task의 실제 포인터 우클릭 대상이 잘못되는 P1 제품 결함 수정 후보. v0.135.3 원격 tag 없음 확인; 정식 게시 근거 아님.
- requested_scope: 분석·설계·구현·로컬 선별 검증·문서 동기화·리뷰/충돌 처리·Ready Full PR CI 시작. 이후 모니터링, 병합/Main/GHCR/Release/Finalizer/Issue 종료는 제외.
- risk_level: HIGH; risk_reason: 잘못된 Task 편집과 native 진행률·bar 이동/resize·인접 행 pointer 적중 위험.
- qa_method: AGENT; qa_required: true
- reviewer: 실제 별도 read-only `/root/qa_818` qa_docs 사전검토 PASS. 최종 exact-Head 인간 QA 및 Trusted/Owner 승인은 NOT TESTED.
- independent_qa: NOT TESTED; manager_decision: NOT TESTED; MERGE_READY: BLOCKED
- release_required: true; release_authorized: false. #816의 v0.135.2 승인은 승계하지 않는다.
- issue_comment_writer: Manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION
- ownership: frontend=Gantt 제품 CSS·기존 E2E; Manager=문서·누적 원장·버전·통합; infra=원격 branch/PR/CI; qa_docs=read-only 사전검토. 추가 재귀 위임 없음.
- next_handoff: frontend Local Fast Feedback → Manager DOCUMENTATION_SYNC → qa_docs 사전검토 → infra Ready PR Full CI 시작.

## 분석 및 설계

#816의 비표시 marker `visibility:hidden` 교정은 보존한다. 별도 F816-006은 활성 Summary를 hover한 다음 좁은 Week child 중심에 raw `page.mouse.move/click`을 보내면 Stable summary Editor가 열리는 PRODUCT/AC4 FAIL이다. locator 자동스크롤 성공을 이 재현의 해결 증거로 사용하지 않는다. 26px marker 중앙 배치는 좁은 bar의 자기 이동을 progress drag로 가로채 #816에서 기각했다.

공식 [SVAR styling](https://docs.svar.dev/react/gantt/guides/appearance/styling/)·[cellHeight](https://docs.svar.dev/react/gantt/api/properties/cellheight/)와 설치 Core2.7.3 DOM/CSS를 대조한다. 문서 URL 조회는 실제 demo 조작 증거가 아니다. Project-local CSS 최소 수정으로 native progress/body/resize 분기와 34/44px·Summary60%·±1px 정렬·날짜/x-width·같은 instance/scroll·canonical/권한을 보호한다. DESIGN Delta C: 기존 interaction/시각 원칙 적용이며 새 공통 디자인 체계 없음.

원본 CSS의 raw pointer 실제 Editor 오대상 RED(15.2s)와 각 bar의 `isolation:isolate` 후보 초기 GREEN(14.4s)을 확보했다. marker를 자기 막대의 stacking context에 가두어 다음 sibling body의 적중을 보존하며 top80%/26px·진행률 논리·일정 좌표를 바꾸지 않는 안이다. 원래 비표시 visibility는 유지한다. 초기 isolation-only 후보에서는 실제 drag 중 숫자 feedback이 sibling에 가리는 새 회귀를 발견했다(F818-002). 따라서 Core가 `.wx-progress-in-drag`를 가진 동안에만 부모 bar z-index3을 올리고 mouseup 뒤 평상시 isolation으로 돌아간다. Summary native grab·숫자 실제 hit 재검증13.0s PASS이며 최종 두 규칙 source의 선별 고유 E2E34(32+실제HTTP/SQLite2)가 모두 PASS했다. 원격 전체 회귀/최종 QA 승인은 아니다.

Summary 진척은 자손 계산이고 직접 PATCH 금지다(API 기존 계약). Summary native handle drag는 올바른 target/분기와 canonical 복구·write0을 확인하며, 실제 progress0/50/100 저장은 leaf Task의 HTTP/SQLite 검사로 구분한다. 설치 Core는 Summary resize를 지원하지 않고 오른쪽 edge도 move로 처리한다(F818-LOCAL-004). 실제 resize는 leaf에서 검사한다. Summary body 일정 미리보기의 즉시 rect복구는 원본/후보 모두 동일하게 제공하지 않으며, 저장0·progress 오인 없음과 기존 동작 보존만 이번 범위에서 판정한다(원장 F818-LOCAL-003).

재현·가설/반증·최종 설계·실행은 [누적 실패 원장](../../ISSUE_818_FAILURE_ANALYSIS.md)에 기록한다. 미실행은 NOT TESTED이며 기존 실패를 flaky/해결로 소급하지 않는다.

## AC_TEST_COVERAGE

- AC1: 기존 project-summary-bar-visual.spec.ts를 EXTEND하여 Summary 활성 hover→다음 Task 중심 raw mouse 우클릭·elementFromPoint ID·실제 Editor 이름을 검사. 원본 RED15.2s와 초기 GREEN14.4s를 확보했으며 최종 두 규칙 source의 실제 결과는 누적 원장에 별도 기록한다.
- AC2: 기존 project-task-delete-context.spec.ts의 body 이동 progress0/50/100·resize·revision/이웃 불변 검사를 KEEP_UNIQUE하고 native progress drag를0→20/50→70/100→80으로 EXTEND한다. Summary marker native grab·진행 중 숫자 hit·canonical 복구/write0을 구분한다. 최종 source 실행 결과는 원장 참조.
- AC3: Summary/empty/nested·34/44px·Day/Week·readonly/edit/fullscreen DOM rect/hit·root identity와 기존 projection-row-alignment.spec.ts strictY±1px를 보존. 실제 실행 조합/미실행은 원장에 명시.
- AC4: 기존 inactive-marker·coarse44px 실제 tap/selection·tooltip·strict projection/negative·delete-context를 직접/인접 회귀로 사용. assertion/skip/retry/timeout 및 CI8-shard 정책 변경 없음.
- AC5: 문서·누적 원장·미해결 리뷰/충돌 검토 후 Ready Full PR CI 시작. 새 정확 Head Quality/Chromium8/Docker·Trusted/최종 인간 QA/Owner는 NOT TESTED. Main/GHCR/정식 Release는 범위 밖/미승인.

## TEST_LIFECYCLE_REVIEW

- 검색: project-summary-bar-visual.spec.ts, project-task-delete-context.spec.ts, projection-row-alignment.spec.ts, project-task-hover-tooltip.spec.ts, project-chart-vertical-dnd.spec.ts, project-empty-summary.spec.ts, project-multi-task-copy-paste.spec.ts, project-gantt-fullscreen.spec.ts.
- EXTEND: 기존 Summary/inactive-marker 회귀의 raw pointer 실제 대상 검사. 기존 fixture 및 고유 body/progress/resize 조작 우선 재사용.
- KEEP_UNIQUE: strict projection/negative, coarse checkbox 실제 tap, selection/keyboard, tooltip, empty Summary, native HTTP/SQLite mutation/recovery.
- PARTIAL_OVERLAP: Summary visual rect와 projection row Y는 다른 위험/음성 경계라 각각 보존. CONSOLIDATE_CANDIDATE/RETIRE_CANDIDATE 없음.
- 새 중복 full spec/skip/timeout·retry 완화/Required3·8-shard 변경 없음. 선별 로컬 성공은 원격 Full QA가 아니다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_818.md`: UPDATED
- `docs/ISSUE_818_FAILURE_ANALYSIS.md`: UPDATED
- `docs/evidence/issue-818/correct-child-editor.png`: UPDATED
- `docs/evidence/issue-818/local-dom-receipts.json`: UPDATED
- `docs/evidence/issue-818/local-validation.json`: UPDATED
- `docs/ISSUE_816_FAILURE_ANALYSIS.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED
- `DESIGN.md`: N/A(Delta C: 기존 native interaction·compact 계층 원칙을 Project-local CSS에 적용)
- `AGENTS.md`: N/A(기존 지침·QA·역할 분리 계약 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 pointer·touch·focus·fullscreen 원칙 적용, 화면 상세는 PROJECT_UX에 반영)
- `docs/REQUIREMENTS.md`: N/A(기존 정확 Task 편집·native 상호작용 요구 충족을 위한 결함 교정)
- `docs/ARCHITECTURE.md`: N/A(새 renderer·runtime writer·의존성·구조 변경 없음)
- `docs/API.md`: N/A(API·DTO·authorization·Origin·revision 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB schema·migration·영속 데이터 변경 없음)
- `docs/SECURITY.md`: N/A(권한·Origin·session·Secret 처리·보안 정책 변경 없음)
- `docs/DEPLOYMENT.md`: N/A(Docker·Compose·volume·실제 운영 배포 변경 없음)
- `README.md`: N/A(기능 진입·설치·운영 명령 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(날짜·진척 집계·일정 계산 algorithm 변경 없음)
- `docs/GANTT_STATE_CONSISTENCY.md`: N/A(기존 단일 instance·projection·canonical snapshot 계약 보호)
- `docs/GANTT_STATE_CONFORMANCE.md`: N/A(기존 strict ±1px·음성 회복·readiness 기준 보호)
- `docs/CI_CD.md`: N/A(워크플로·Required3·8-shard·GHCR·Release 권한 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 정확 Head/base/test-merge·Run/Attempt·환경별 증거 적용)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 canonical Refs·운영 기록·strict main·gate 적용)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 phase·독립 검토·문서·승인 경계 적용)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 AGENT·독립 인간 QA·Trusted·Owner gate 유지)

## 검증 및 인계

실제 로컬 결과·실패/환경 준비·도구 인증 실패는 [누적 원장](../../ISSUE_818_FAILURE_ANALYSIS.md) 참조. 제품/test 소스를 확정하여 E2E34 PASS와32개 합집합/HTTP·SQLite2의 실제 결과·미실행을 원장에 반영했다. DOCUMENTATION_SYNC 및 별도 사전검토 뒤 PR CI로 인계한다. 원격 게이트는 시작만 확인하며 결과를 모니터링하지 않는다. AGENT와 version 보호 경로의 최종 인간 QA가 없으면 BLOCKED이며 qa_docs Sub-Agent의 사전검토를 인간 APPROVED로 주장하지 않는다.

Rollback은 이 PR의 CSS/test와 PATCH 후보·문서만 되돌린다. DB migration·외부 자산·운영 데이터 변경은 없다.

## 최종 로컬 증거와 범위

- 같은 동결 source의 Summary13+Hover6+Projection13 **32 PASS**, 실제HTTP/SQLite delete normal+확장native **2 PASS**; 고유34/0FAIL/0SKIP. 로그·명령·3파일SHA·환경은 [누적 원장](../../ISSUE_818_FAILURE_ANALYSIS.md) 참조.
- [DOM 영수증](../../evidence/issue-818/local-dom-receipts.json): matrix8/64개 raw target·Editor 정확, strictY 최대0.5px; native Summary0/50/100의 tip/link/진행 중 숫자 hit 포함.
- [Editor 화면](../../evidence/issue-818/correct-child-editor.png): fine34px/Week/normal nested matrix의 정확한 child Summary Editor. 원본 leaf 검사는 별도 기존 fine case에서 PASS했으며 screenshot을 전체 UX 증거로 확대하지 않는다.
- production artifact·전체8shard·실제 터치/native125%·screen reader·나머지 고유 suite는 NOT TESTED. Summary 자체 일정 preview의 기존 잔류/resize미지원은 본 CSS 교정으로 해결한 기능이 아니다.

## 최종 Pre-PR 판정 및 운영 인계

- fast10steps PASS(전체Unit3344 PASS/기존3SKIP, production build 포함), targetedUnit85 PASS 및 자동선정11spec Chromium94 PASS/0FAIL/0SKIP. 같은 source의 직접34/자동94 및 Unit3344/85는 중복이 있어 합산하지 않는다.
- **두 최상위 보고서 BLOCKED/exit1/sourceStable=false**: Next가 생성한 추적 타입/설정·AGENTS heading 변경을 보존 후 baseline bytes로 복원했다. 제품/test3SHA는 일치한다. fingerprint 완화·숨은 수정·기존 skip/assertion/timeout/retry 변경 없음. 보고서·정제 [실행 요약](../../evidence/issue-818/local-validation.json)·남은 범위는 [원장 F818-LOCAL-005](../../ISSUE_818_FAILURE_ANALYSIS.md) 참조.
- DOCUMENTATION_SYNC 및 별도 source/실제JSON/문서 사전검토 PASS. 최종 인간 QA/Trusted/Owner·manager_decision은 NOT TESTED, MERGE_READY BLOCKED다. Pre-PR BLOCKED를 로컬 전체 승인으로 포장하지 않는다.
- infra는 최신main/태그·중복PR·리뷰/충돌 재확인, local tree와 동등한 원격commit/branch 게시, 완성된 canonical Refs 본문으로 Ready PR 생성, Full CI 시작만 확인한다. 원격 Head/Base/Run/Attempt는 PR/Issue STATUS의 정확 식별자로 인계하며 CI 결과 모니터링은 하지 않는다.
