# Issue #384 — 다중 선택 Task Copy/Paste

상태: PR_PREPARATION. 사용자 승인 범위는 구현·문서 동기화·독립 사전 QA → PR 생성·CI 실행 시작까지다. CI 완료 모니터링·병합·main/GHCR·정식 릴리스·Issue 종료·branch cleanup은 범위 밖이다.

현재 통합 후보: main `31907bc3ff09266067c310f9ed406c002989cd8b` / `0.67.2` 기준 version `0.68.0`. PR [#391](https://github.com/planner77/masterGantt/pull/391)의 충돌 해결·재검증은 마지막 통합 REWORK 절이 최신 상태다. 아래 최초 baseline/version 기록은 당시 근거다.

## Issue Work Packet

- Issue: [#384](https://github.com/planner77/masterGantt/issues/384), OPEN, AC01–22.
- 최신 기준 main: `5fda7d963b0ba5e2e09414c1328103f9e943b564`, version `0.63.1`. 로컬 main을 fast-forward했다.
- 작업 branch: `feat/issue-384-multi-task-copy-paste`. 시작 시 tracked/untracked 작업 트리는 clean이며 #384 기존 branch/PR 없음.
- 기존 #385 로컬/원격 branch와 Open PR #387은 보존한다. #385 exact head `801563ba0bb40ba55de7af570df4f8adc6f0bf98`의 version도 `0.63.1`이다. 향후 다른 PR 병합 시 version을 재평가해야 한다.
- Version 결정: `0.64.0` MINOR. UI 다중 선택 Copy 기능과 호환 가능한 API 확장이다. package/lock/CHANGELOG 내용은 infra와 Manager가 검토하고 실제 편집은 Manager가 실행한다.
- release_required=false: 현재 PR/CI 시작 범위에서 정식 release N/A. version bump 병합 후 Generic Finalizer의 정식 release 요구 여부는 별도다. release_authorized=false: 정식 게시 승인 없음.
- Issue comment writer=Manager, Sub-Agent 허용 유형 NONE. GitHub CLI 401은 연결된 GitHub 도구로 조회한다. git fetch는 정상이며 token을 노출하거나 변경하지 않는다.
- 현재 sandbox는 read-only다. 필요한 파일 편집·테스트·Git mutation은 명령별 require_escalated 경로를 사용하고 거부된 권한을 다른 도구로 우회하지 않는다.

## 구현 계약

앱이 Project-scoped 선택 집합을 관리한다. Copy 시 서버 canonical hierarchy에서 모든 source를 resolve하고 선택 ancestor를 가진 항목을 root에서 제거한다. root/descendant union을 parent-first canonical WBS 순서로 복사하고 여러 root를 before/after/child 위치에 하나의 연속 block으로 삽입한다. 선택 순서는 복사 순서가 아니다.

Copy 집합 양쪽 endpoint가 모두 포함된 Dependency만 새 Task/Link ID로 복제한다. 서로 다른 root 사이 관계도 포함하며 type과 signed lag/lead는 보존한다. 외부 incoming/outgoing Link는 복제하지 않고 원본 관계는 유지한다. Calendar/전체 Dependency/Manual conflict/Resource 일정 검증/Summary 파생은 기존 #378 orchestration을 재사용하며 하나의 transaction, revision +1, 실패 시 생성·revision +0다.

Copy 입력은 legacy `taskId`와 신규 `taskIds`의 XOR다. 서버 parser와 direct service 호출 모두 정규화하고 빈/중복/잘못된 UUID/unknown/foreign/상한 초과를 거부한다. 최대 500개의 source ID, 기존 32 KiB body와 최종 Project 5000 Task 제한을 유지한다. 단일 Cut/reparent 등 다른 명령은 기존 taskId 계약이다. 응답 canonical snapshot/changed ID 계약은 유지한다.

원본과 복사본은 새 identity로 분리되므로 Copy anchor가 기존 source subtree 안이라는 이유로 새로운 서버 금지 규칙을 추가하지 않는다. UI의 기존 self-source Paste 비활성 규칙은 normalized root 집합에 적용하고 기존 descendant anchor 호환을 유지한다. child Paste의 Milestone/linked Leaf Summary 전환 보호는 유지한다.

Baseline은 기존 구현 계약을 유지한다: 원본 Baseline은 불변, 새 copied Task의 Baseline은 null로 초기화하고 Summary는 기존 파생 규칙을 따른다. actual 재계산으로 원본 Baseline을 이동시키거나 복사본 Baseline 보존을 새로 확대하지 않는다. Copy 집합에 미지원 Resource/Group Assignment가 하나라도 있으면 전체 거부한다. 기존 Task Copy의 물류 연결 자동 복제 범위도 확대하지 않는다. 빈 Summary의 구조와 null 일정은 보존한다.

## UX/선택 계약

- 기존 이름 셀의 tree/inline renderer를 보존하는 별도 56px 선택 열의 native checkbox, 행 aria-selected, semantic 선택 표시와 선택 개수/해제 affordance를 사용한다. 모바일에서도 modifier 없이 선택 가능하다.
- plain click 단일 선택, Ctrl/Cmd click 추가/해제, Shift click 같은 parent의 보이는 sibling 범위. checkbox click/Space로 toggle, range가 유효하지 않으면 명시적 단일 선택이다.
- 선택 행의 Context Menu는 선택 집합 유지·전체 Copy, 선택 밖 행은 그 행 하나로 바꾼다. clipboard는 target 선택을 위해 유지한다. keyboard ContextMenu/Shift+F10도 같은 의미다.
- Copy와 Ctrl/Cmd+C는 동일한 normalized 집합을 사용한다. Cut/Delete/Edit/Move는 메뉴 또는 실제 focus 행 하나다. input/editor/dialog/contenteditable 내부 shortcut은 기존 guard를 유지한다.
- filter/scope 변경은 허용 범위로 direct selection을 prune하고 제외 상태를 안내하며 이전 Copy/Cut clipboard를 폐기한다. collapse만으로는 선택을 지우지 않으며 숨김 수를 안내한다. 선택 Summary의 전체 자손 포함과 화면 표시 선택 개수는 구분한다.
- readonly/pending mutation 보호, stale revision/Project clipboard 폐기, same Gantt instance/scroll/scale/collapse/columns 및 실패 복구 계약을 유지한다.

## 공식 Core 확인

Issue의 단일 selected 설명과 현재 공식 문서·설치 타입 사이 차이가 있다. [select-task](https://docs.svar.dev/react/gantt/api/actions/select-task/)는 공개 toggle/range를 설명하고 설치 타입은 selected 배열이지만 [getState](https://docs.svar.dev/react/gantt/api/methods/getstate/) 문서는 scalar로 기술한다. 앱 선택 집합을 기준으로 공개 API만 연동하며 modifier DOM 동작과 Core action이 동일 gesture를 두 번 toggle하지 않도록 실제 설치 Core 2.7.3에서 검증한다. 비공개 PRO 복제/새 PRO 옵션은 사용하지 않는다. 공식 URL 조회는 실제 demo 조작 PASS가 아니다.

## 소유권·역할

Sub-Agent 편집 명령의 승인 대기가 지속되어 해당 명령을 중단했다. 전문 Agent는 소유 범위의 patch 작성·read-only 검토를 수행하고 Manager가 require_escalated 경로로 실제 편집·로컬 검증을 실행한다. Agent 자체 실행 PASS로 표시하지 않는다.

| 담당 | 쓰기 소유권 | 책임 |
| --- | --- | --- |
| Manager | REQUIREMENTS, active PLAN, ISSUE_384 packet, 공식 Issue 기록 | 범위·공유 interface·version 결정·통합·gate |
| frontend | src/features/gantt 및 필요한 Project workspace, 관련 tests/features·tests/e2e, PROJECT_UX/TASK_EDITOR/TEST_PLAN/PRO_FEATURE_MATRIX | 선택/clipboard/명령, Core 실증·회귀·4폭·문서 |
| backend | src/contracts/projects, task-hierarchy contract/service/helper, 관련 tests/server/contracts, API/TASK_RELATIONS/SCHEDULING_ENGINE | canonical multi-copy/내부 관계/원자성·보안·문서 |
| ui_ux | 읽기 전용 | 정보 구조·interaction 설계, 구현과 실제 증거 비교 |
| infra | Git 운영, package/lock/CHANGELOG | 최신 branch·version, QA 후 commit/push/PR/CI 시작 |
| qa_docs | 읽기 전용, DOCUMENTATION_SYNC 후 | AC/code/tests/docs·exact commit 독립 검토 |

Scheduling algorithm은 기존 #378 Domain을 재사용하므로 별도 scheduler 구현/Domain 수정은 N/A다. algorithm 변경 필요 발견 시 Manager에게 반환한다. Agent는 재귀 위임/타인 변경 되돌리기/중복 PR/version/Issue 댓글을 수행하지 않는다.

## 검증·문서 gate

Selection/clipboard Unit, parser/API/SQLite multi-root·내부/외부 Link·FS/SS/FF/SF/lag·ancestor 중복·WBS order·empty Summary·Assignment guard·상한·rollback/reopen/auth/Origin/If-Match/revision을 검증한다. 실제 Chromium에서 modifier/checkbox/keyboard/menu Copy·다른 Summary child Paste·관계/Editor·reload·same instance/view state 및 DnD/rename/double-click/scoped view 회귀, 390/768/1024/1440px를 확인한다.

구현 → 변경 관련 Local Fast Feedback → required docs 갱신/N/A 분석 → 독립 QA → PR·CI 실행 시작 순서다. REQUIREMENTS/API/TASK_EDITOR/TASK_RELATIONS/SCHEDULING_ENGINE/PROJECT_UX/TEST_PLAN/CHANGELOG와 실행 계획을 동기화한다. PRO_FEATURE_MATRIX는 실제 public API/앱 선택 경계를 반영한다. DB_SCHEMA/migration은 schema 변경 없음, SECURITY는 session/Origin/revision 정책 유지, DESIGN은 기존 compact Light semantic token 유지, CI 운영 문서는 기존 #361 추적 규칙을 재사용하여 N/A다. 실제 계약 변경이 생기면 문서 gate를 재평가한다.

PR 제목은 `[Issue #384] 다중 선택 Task Copy/Paste 및 내부 Dependency 복제`로 하고 canonical `Refs #384` 한 개를 포함한다. 기존 CI run-name의 Issue/PR/run/attempt 추적과 quality/e2e/docker gate를 유지한다. exact PR head/run 실행 시작을 확인한 즉시 CI 조회를 종료한다. 원격 quality/e2e/docker는 완료 모니터링하지 않아 NOT TESTED로 보고한다. main/GHCR/정식 release/cleanup은 범위 밖이며 Issue는 열린 상태로 유지한다.


## 최초 기준의 실제 로컬 검증·독립 검토 (0.64.0)

| 범위 | 판정·실제 실행 |
| --- | --- |
| Selection/clipboard/scope/filter/URL guard 및 parser/SQLite/HTTP | PASS — 관련 7 files / 74 tests. 기존 단일 hierarchy 회귀도 이전 집중 실행에서 PASS |
| 신규 Chromium 다중 Copy/Paste | PASS — 7 tests. internal Link와 Editor, pending/실제412, 단일 Edit/Cut/Delete, 필터 문맥 Summary 제외, view state·reload·동일 SQLite의 실제 Next 서버 재시작 포함 |
| 기존 Chromium 이름·DnD·계층 메뉴 | PASS — 최종 3 specs / 10 tests, 1.7분. inline-name 3, grid-reorder-persistence 4, task-context-menu-hierarchy 3 |
| TypeScript | PASS — 브라우저 생성 설정 두 파일 복원 뒤 최종 npm run typecheck, exit 0 |
| ESLint | PASS — 0 errors / 기존 8 warnings. 로컬 .next-*·.worktrees/** 생성물만 제외. 마지막 Gantt 파일 집중 lint도 0 errors / 기존2 warnings. 공식 CI 범위는 변경하지 않음 |
| manifest/lock·Markdown·diff | PASS — version 0.64.0, 문서 링크 96 files, git diff --check. 최종 실행 증거 추가 뒤 재확인 PASS |
| 독립 UI/UX | PASS — 실제 4폭 capture·소스 비교. 선택 열 제목의 일부 축약은 비차단 개선 항목 |
| 독립 qa_docs | PASS — 실제 Issue AC/code/test/docs/실패 artifact/4폭 자료 비교와 DOCUMENTATION_SYNC 독립 사전 검토. 원격 전체 회귀 ACCEPT는 별도 |
| PR quality/e2e/docker | NOT TESTED — 사용자 범위는 실행 시작까지이며 완료 모니터링 제외 |
| 실제 touch device·screen reader·공식 demo 조작 | NOT TESTED — mouse 기반 Chromium viewport 검증과 구분 |

실제 실행 명령:

```sh
npm test -- tests/features/gantt/task-selection-model.test.ts tests/features/gantt/task-context-menu-model.test.ts tests/features/gantt/task-subtree-scope.test.ts tests/features/gantt/task-url-gesture.test.ts tests/features/projects/project-search-filter.test.ts tests/server/projects/task-hierarchy-contract.test.ts tests/server/projects/task-hierarchy-multi-copy.test.ts
npm run test:e2e -- tests/e2e/project-multi-task-copy-paste.spec.ts tests/e2e/project-gantt-inline-name.spec.ts
npm run test:e2e -- tests/e2e/project-gantt-inline-name.spec.ts tests/e2e/project-grid-reorder-persistence.spec.ts tests/e2e/task-context-menu-hierarchy.spec.ts
npm run lint -- --ignore-pattern '.next-*' --ignore-pattern '.worktrees/**'
npm run typecheck
npm run version:check
node scripts/check-markdown-links.mjs
git diff --check
```

검증 중 FAIL을 숨기지 않는다. 첫 서버41개 중6건은 휴일 fixture/nullable response 투영 기대 오류였고 수정 후 PASS다. 초기 브라우저 실패는 Editor 관계 탭 이름, pending attribute 생략, Leaf 즉시 삭제에 dialog를 기대한 fixture 오류와 모바일 이름 클릭 회귀였다. 클릭 중 row DOM 교체로 click이 wx-scroll 조상에 retarget된 실제 근거를 확인했다. pointerdown 이름 ID와 위치를 보관하고 같은 위치의 plain click만 현재 canonical row로 다시 resolve하며 4px 초과 이동/pointercancel은 폐기한다. Core select-task가 원인이라는 추정은 진단 로그로 확인되지 않아 채택하지 않았다. 임시 진단 코드는 제거했다.

전체 eslint를 로컬에서 그대로 실행한 초기 실패는 기존 ignored build/다른 worktree 생성물을 포함한 것과 새 renderer의 ref 읽기·React Compiler memo 계약 문제를 포함했다. Renderer는 stable Context component로 분리하고 필요한 callback dependency를 명시했다. 최종 lint PASS는 실제 코드 수정 결과이며 CI gate를 약화하지 않았다. 첫 최종 E2E 호출에서 잘못된 두 파일 경로가 매칭되지 않아 발견된10개만 실행됐다. 실제 존재하는 DnD/메뉴 파일명으로 다시 실행해 별도10개 PASS를 확보했으며17개가 한 실행에서 통과했다고 주장하지 않는다.

브라우저 생성 next-env.d.ts/tsconfig.json의 임시 dist 참조는 HEAD 내용으로 명시적 두 파일만 복원했다. 다른 worktree·runtime DB·trace/log는 staging하지 않는다. 신규 Copy7개 PASS 뒤 이름 fallback의 대상 제한/drag 폐기만 보강했고 관련 inline/DnD/메뉴10개를 재검증했다. Copy service·선택 계약·4폭 화면에 영향 없는 보강이므로 나머지 Local Fast Feedback을 재사용한다.

실제 UI 자료는 [390px](assets/issue384/multi-copy-390.png), [768px](assets/issue384/multi-copy-768.png), [1024px](assets/issue384/multi-copy-1024.png), [1440px](assets/issue384/multi-copy-1440.png)이다. 같은 구현의 Paste 후 기능 상태 자료이며 구현 전후 시각 개선 비교 자료가 아니다.

DOCUMENTATION_SYNC: required docs REQUIREMENTS/API/PROJECT_UX/TASK_EDITOR/TASK_RELATIONS/SCHEDULING_ENGINE/TEST_PLAN/PRO_FEATURE_MATRIX/CHANGELOG/active PLAN을 동기화했다. 격리 E2E fixture의 서버 restart 기능과 환경 경계는 TEST_PLAN에 반영했다. DB schema/migration·security authorization·Scheduling algorithm·CI/registry/deployment 계약 불변으로 해당 원칙 문서 변경 N/A다. 선택 열 확대 과정의 의도하지 않은 과거 viewport 수치 치환은 독립 QA에서 발견하여 baseline 전체를 복원하고 #384 추가 절만 유지했다.


## PR #391 최신 main 통합 REWORK

PR 생성 시 main은 다른 승인된 PR #381/#382/#324/#336 병합으로 `2d310d2669d4b80bc961f67d81a4f51a7c3777cc` / `0.65.1`로 이동했다. 최초 head `a5b5d789d74247c41064d2c2450ff71efe146c3f`는 dirty conflict로 PR CI가 시작되지 않았다. 최초 Git push는 로컬 인증 실패였으며 연결된 GitHub 도구가 로컬 검토 tree와 완전히 같은 tree를 게시했고 독립 QA가 일치를 확인했다. 인증값은 변경하거나 노출하지 않았다.

같은 PR/branch에서 origin/main을 통합한다. #372 fullscreen Editor, #377 관계 탭/modal focus, #316 Week tooltip, #331 inline layout-phase guard와 Resource 폼 변경을 모두 보존한다. 선택 Context/hook·Week tooltip은 양쪽 독립 항목을 함께 유지하고, ProjectTaskEditor ref와 matchingTaskIds/selectionBoundaryKey props를 조합한다. DB/API/Scheduling 구현은 최신 main에 변경되지 않았지만 기존74개와 관계·Week Tooltip Unit을 함께 재실행하여 결합 tree의89개 PASS를 확보했다. 공유 UI 변경은 새 결합 source에서 관련 집중 browser/typecheck/lint 및 독립 QA를 다시 확인한다.

Version Manager 재결정: 최신 main `0.65.1 → 0.66.0` MINOR. 최초0.64.0 결정/검증 기록은 당시 근거로 보존하며 현재 application version은0.66.0이다. 기존 CHANGELOG0.65.1/0.65.0/0.64.0/0.63.2 기록을 유지하고 #384를0.66.0 별도 항목으로 이동했다. 새 head의 원격 quality/e2e/docker는 전부 NOT TESTED이며 실행 시작 확인 뒤 모니터링하지 않는다.


### 통합 후 실행 증거

- PASS: 집중 Unit/SQLite/HTTP + Task Relations/Week Tooltip 9 files / 89 tests, 1.57초.
- PASS: 결합 Chromium 5 specs / 19 tests, 3.7분. 신규Copy8 + inline3 + scale1 + Grid DnD4 + hierarchy3이다. Task 선택이 있어도 Day·Week header Escape는 Tooltip을 닫고 선택을 유지하는 통합 회귀를 추가했다.
- PASS: 별도 Chromium fullscreen2 + Issue #377 관계 편집3, 5 tests / 10.8초. 총24개의 집중 browser 시나리오를 두 실행으로 검증했다.
- PASS: 통합 lint 0 errors / 기존8 warnings, version0.66.0/lock 일치. runtime 생성 next-env.d.ts/tsconfig.json 두 파일은 최신 main 내용으로 복원했고 최종 typecheck exit0·Markdown99files·diff 검사 PASS를 확인했다.
- 실제4폭 이미지는 새 통합 후보의 PASS 실행 자료로 교체했다. 이전 capture는 최신 통합 UI 검증 근거로 사용하지 않는다.
- 전문 frontend의 결합 소스 정적 검토 PASS. qa_docs의 새 결합 tree DOCUMENTATION_SYNC/사전 QA PASS를 독립 확인했다. 새 head의 사전 검토는 원격 전체 회귀 ACCEPT와 구분한다. 이전 원격 CI는 미실행이며 새 headquality/e2e/docker는 NOT TESTED다.

```sh
npm test -- tests/features/gantt/task-selection-model.test.ts tests/features/gantt/task-context-menu-model.test.ts tests/features/gantt/task-subtree-scope.test.ts tests/features/gantt/task-url-gesture.test.ts tests/features/projects/project-search-filter.test.ts tests/server/projects/task-hierarchy-contract.test.ts tests/server/projects/task-hierarchy-multi-copy.test.ts tests/features/gantt/task-relations.test.ts tests/features/week-header-tooltip.test.ts
npm run test:e2e -- tests/e2e/project-multi-task-copy-paste.spec.ts tests/e2e/project-gantt-inline-name.spec.ts tests/e2e/project-grid-reorder-persistence.spec.ts tests/e2e/task-context-menu-hierarchy.spec.ts tests/e2e/project-gantt-scale.spec.ts
npm run test:e2e -- tests/e2e/project-gantt-fullscreen.spec.ts tests/e2e/project-task-editor.spec.ts --grep 'Grid·Chart|Relation Editor도|Issue #377'
```

Resource #331 폼 소스·전용 회귀는 충돌 없이 최신 main 그대로 통합했으며 이 작업의 별도 브라우저 실행 N/A다. 최초 source의 name pointer fallback은 유지하되 #331 layout-phase guard도 보존한다. 통합 QA가 찾은 scale Tooltip Escape 간섭은 header를 selection Escape guard에서 제외하여 해결했고 새 browser 검사로 확인했다. 요구사항·권한·API·DB 계약과 CI gate는 유지한다.


## PR #391 최신 main 2차 정렬 / CI #1515.1 보완

- CI #1515.1: quality/build/typecheck/policy/docker PASS, Chromium shard 2/4·3/4 FAIL.
- 실제 제품 회귀: 우클릭 pointerdown 이후 SVAR row DOM 교체로 contextmenu target이 조상으로 재지정되면 Task menu target resolve가 실패했다. pointerdown Task ID를 보존하고 현재 canonical row를 다시 resolve하도록 보완했다.
- 테스트 정렬: #384 계약상 선택 밖 행 Context Menu는 해당 행 singleton selection으로 전환한다. fullscreen 회귀는 과거 Core `wx-selected` 유지 기대 대신 app-owned `data-copy-selected`의 새 selection 의미와 fullscreen 전후 보존을 검증한다.
- main은 `986a34dbd888c4b91126677f89a177a39faf506c` / `0.67.1`까지 진행되어 #329 Resource 삭제, #385 JSON Import, #331 release/cross-tab 보완을 모두 유지한 merge commit으로 재정렬한다.
- Version Manager: `0.67.1 → 0.68.0` MINOR.
- 새 merge head의 PR CI quality/e2e/docker가 공식 재검증 근거이며 이전 #1515.1은 수정 전 head 증거로만 남긴다.


## PR #391 최신 main 3차 정렬 / CI #1535.1 보완

- PR CI #1535.1 exact head `f4c536cf4cd522f8a786b416f945866e0a25e927`: quality/build/Vitest/TypeScript/ESLint/policy/docker PASS, Chromium shard 1/3/4 PASS, shard 2/4에서 1건 FAIL.
- 실패는 fullscreen 테스트가 vertical scroll=160 상태에서 가상화로 DOM에서 제거된 `Stable leaf`에 즉시 `data-copy-selected=false`를 기대한 테스트 위치 문제다. 같은 시점에 `Scroll task 8`의 `data-copy-selected=true`와 `선택 1개`는 확인됐다.
- 보완: 스크롤 중에는 현재 보이는 선택 행과 selection count를 검증하고, fullscreen 종료 후 vertical scroll을 0으로 복원한 다음 `Stable leaf`가 visible + non-selected인지 검증한다.
- main은 `31907bc3ff09266067c310f9ed406c002989cd8b` / `0.67.2`까지 진행되었으므로 #332 Project Master UI 변경을 보존한 merge commit으로 재정렬한다.
- Version은 MINOR `0.68.0`을 유지하며 CHANGELOG 기준만 `0.67.2 → 0.68.0`으로 갱신한다.
- 새 merge head의 PR CI가 공식 재검증 근거이며 #1535.1은 보완 전 증거로 남긴다.


## PR CI #1540.1 보완

- exact head `eddaac27104b42334bca4de0eab1dcdb964a97fa`에서 Build/Vitest/TypeScript/ESLint/policy/docker와 Chromium shard 1/2/4 PASS, shard 3/4의 리소스 캘린더 focus 1건만 FAIL했다.
- 실패는 #384 다중 Copy/Paste 경로가 아니라 기존 Project Work Calendar의 server conflict summary 접근성 focus timing이다.
- 기존 구현은 `setServerConflict()` 직후 `requestAnimationFrame` 1회로 아직 commit되지 않은 ref를 focus할 수 있어 CI 부하에서 ref가 null인 race가 있었다.
- 보완은 `serverConflict`가 실제 React DOM에 반영된 뒤 effect에서 conflict summary에 focus하도록 변경하고 기존 날짜 필드 aria-invalid/aria-describedby와 수정 버튼 focus 이동 계약을 유지한다.
- 보완 head에서 새 PR CI를 시작해 전체 quality/e2e/docker를 다시 판정한다.
