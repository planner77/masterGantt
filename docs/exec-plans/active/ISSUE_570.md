# Issue #570 — Canonical→SVAR Projection 분리·멱등 동기화

## PR CI #2480.1 실패 보완 (2026-10-11)

사용자 요청 범위는 실패 원인 분석·보완·새 exact-head PR CI 시작까지다. 기존 PR #592와 `feat/issue-570-canonical-projection`을 재사용하며 병합·Main CI·GHCR·정식 릴리스·Issue 종료는 포함하지 않는다. 아래 기존 구현 증거는 정렬 전 Head의 역사 기록이며 새 후보의 검증 결과와 구분한다.

- 분석 기준 Head: `2b4d2d525bce81b9a7f03f26af1386f79f5a616b`, main/base: `b4d566e29bf2f976f51796405fd7c6f1ec5e2638`.
- 원본 실행: [CI #2480.1 / run38113622898 / attempt1](https://github.com/planner77/masterGantt/actions/runs/38113622898), `pull_request`, 결론 FAIL. Quality와 Docker required aggregate는 PASS, E2E required aggregate는 FAIL. `QA Final — Automated` SKIPPED는 QA PASS가 아니다.
- 실행 방식: frontend Agent가 Gantt source와 관련 회귀를 소유하고 Manager가 문서·원격 게시를 소유한다. 별도 qa_docs Agent가 수정 후보를 읽기 전용으로 독립 검토한다. `risk_level=HIGH`, `qa_required=true`, `qa_method=AGENT`, `manager_decision=NOT TESTED`를 유지한다.
- 버전 `0.104.1`, `release_required=true`, `release_authorized=false` 유지. 기존 required checks·CI policy·인증/API/DB/scheduling 계약은 변경하지 않는다.
- 재현 환경: `/tmp/mastergantt-570-fix` 분리 clone, frozen `npm ci` 447 packages/12초 PASS, Next `16.3.8`. 최초 제한 네트워크 설치는 `EAI_AGAIN`으로 FAIL했고 승인된 실행으로 복구했다. production dependency audit 0건 PASS이며 의존성 파일은 수정하지 않는다.

| 실패 shard / job | 실패 테스트 | 관측 |
| --- | --- | --- |
| 2/6 / `114394093382` | `grid-task-start-reveal.spec.ts:152`, `project-empty-summary-persistence.spec.ts:6` | Task 필터 변경 후 frame 조회 timeout, 마지막 자식 삭제 뒤 API instance 변경 |
| 3/6 / `114394093381` | `milestone-stage-dashboard.spec.ts:9`, `milestone-stage-grid.spec.ts:22`, `project-multi-task-copy-paste.spec.ts:153`, `:219`, `:255` | Milestone 필터의 child/상태 누락, 필터 이후 다중선택 상태 및 메뉴 동작 유실 |
| 4/6 / `114394093356` | `milestone-stage-exchange.spec.ts:130` | Milestone 선택 뒤 필수 child 행 누락 |
| 5/6 / `114394093398` | `task-context-menu-hierarchy.spec.ts:189` | scope 내 추가한 empty Summary 행 누락 |
| 6/6 / `114394093353` | `milestone-stage-grid-mock.spec.ts:56` | 열 변경 뒤 동일 Gantt root 보존 실패 |

shard1은 PASS이며 총 10개 실패를 보존한다. 테스트 삭제·기대값 완화·timeout 확대 없이 공통 canonical/filter/접힘 복원 경로를 보완한다. 새 후보의 로컬 검증과 독립 PRE_QA는 아래에 추가하며, 공식 새 Head Quality/E2E/Docker·QA_FINAL·Manager ACCEPT는 CI 등록 시점 NOT TESTED다.

### 재현과 보완 원인

수정 전 대표 6개 실행은 3 FAIL/3 PASS였다. 원격과 같은 `milestone-stage-dashboard:80`, `milestone-stage-grid-mock:72`, `project-empty-summary-persistence:60`을 재현했으며 최초 trace는 `/tmp/issue570-baseline-failures`에 보존했다. 브라우저의 `Cannot read properties of null (reading 'forEach')`는 필터 뒤 빈 Summary를 `open-task(true)`로 여는 경로와 일치한다. 현재 Core `serialize()`의 parent ID 집합으로 실제 자식이 있는 container에만 열림/접힘 복원을 적용한다.

첫 보완의 대표 6개는 5 PASS/1 FAIL이었다. 기존 empty Summary instance 실패 지점 `:60`은 통과했지만 뒤쪽 Outdent `:107`에서 nested empty Summary bar 잔존이 드러났으며 `/tmp/issue570-after-first-failures`에 보존했다. 이때 `serialize()`는 `summary-container`, duration0, start=end였지만 `_tasks`는 같은 ID에 `summary`, duration1, width36의 이전 표시 payload였다. 무필터 fast path가 행 ID 일치만 확인해 structure 변경의 재투영도 건너뛴 원인이다. 마지막 적용 structure key가 같을 때만 fast path를 허용하여 metadata-only의 불필요 action 0회와 필요한 구조 재투영을 구분한다.

기존 리뷰 P2의 `queryConditionsChanged` effect closure 재사용도 보완한다. 각 관찰을 시작할 때 직전 전달 receipt의 query identity와 비교하며 이후 tree/select/layout 관찰에 최초 변경 flag를 반복하지 않는다. 실제 Core 회귀는 빈 Summary·필터로 자식이 제외된 Summary·Milestone 열·Day/Week·조회 receipt 이후 tree/select/layout 관찰을 추가한다. 원래 실패 테스트의 assertion·timeout·retry 및 workflow는 변경하지 않는다.

신규 receipt 회귀의 최초 실행에서는 tree 뒤 이름 셀 선택으로 생긴 inline/editor·effect 재설치가 select 관찰을 대체해 flag를 잃는 경계를 확인했다. 독립 QA 지적을 반영해 native 선택 action뿐 아니라 같은 API instance의 마지막 전달 selected IDs와 현재 공개 selected IDs를 비교한다. 최초 실제 선택 변화가 다음 유효 receipt에 전달되는지 검사하며 같은 작업을 반복 선택해 실패를 우회하지 않는다.

### 보완 로컬 검증과 인계

- Summary/structure 수정 source에서 원래 CI 실패 10개 경로 모두 after PASS. 별도 나머지 7개 실행은 7/7 PASS(2.5분, `/tmp/issue570-remaining7.log`)이며 앞선 대표 실행 3개와 구분한다.
- 기존 projection Chromium matrix 19개 PASS. 중간 22개 실행의 신규 receipt 1 FAIL은 위 selection 경계 보완 전 결과이며 삭제하지 않는다.
- 마지막 read-only receipt delta 이후 신규 receipt/빈 Summary Chromium 2/2 PASS(9.2초, `/tmp/issue570-final-new2.log`). 최초 checkbox 선택의 flag·selected IDs, 뒤쪽 layout의 query/selection false, 빈 Summary 및 자식이 필터에서 제외된 Summary의 열/Day·Week를 검증했다. 기존 10개/19개 결과를 이 마지막 delta 이후 전체 재실행한 것으로 합산하지 않는다.
- 관련 Unit 4파일38 PASS, 최종 typecheck PASS, 변경 lint 0 errors·기존 warnings3개. Manager의 version `0.104.1`, Markdown177파일 및 diff whitespace 검사 PASS.
- 최종 제품 source SHA256: `f13f0866377afd7b34d4f601d28a84fa437ff7bd77e018a0da95204a6aeb0aa9`; 최종 E2E spec SHA256: `c3541f66c297fbf5fbdb5a3e50b3cca61073523c93e642f55141fddc93b5d14d`. 마지막 신규 실행 전후 지문 동일.
- 게시 allowlist는 제품1개·E2E1개·문서6개다. 자동 생성 `next-env.d.ts`, `tsconfig.json`, 실행 중 갱신된 `output/playwright/**`, runtime DB/log/trace는 게시하지 않는다. manifest/lockfile·workflow·required gate는 이번 보완에서 수정하지 않는다.

마지막 제품/spec source에 대한 별도 `/root/issue570_qa_fix`의 독립 PRE_QA 결과는 원격 게시 STATUS에 연결한다. 이 사전 검토는 새 Head required CI·QA_FINAL·신뢰된 승인 영수증 또는 Manager ACCEPT를 대신하지 않는다. 새 CI 시작 시 quality/e2e/docker·QA_FINAL·Manager ACCEPT는 NOT TESTED이며 병합 준비 완료로 보고하지 않는다.

## Issue Work Packet

- repository/issue: planner77/masterGantt #570; 상위 #567, 선행 #568/PR #575·#569/PR #576, 후행 #571.
- baseline: main `cf1bb035f19ac18423c7f643fbda3a89dcd73a7f`, application `0.104.0`, Core `2.7.3`.
- working branch: 기존 `feat/issue-570-canonical-projection` 재사용; isolated clone `/tmp/mastergantt-issue570`.
- approval/scope: 사용자 요청으로 이전 등록-only 범위를 구현·문서 갱신·원격 PR·exact-head CI 시작으로 전환한다. 이전 DNS BLOCKED 기록은 보존한다.
- goal: canonical Task/Link 변경과 native membership/structure/layout 재투영을 분리하여 같은 metadata-only 변경의 불필요한 filter/column action을 없애고 검증된 projection-settled 입력을 제공한다.
- acceptance: metadata-only filter/set-columns 0회와 정확한 텍스트/링크; 실제 membership/구조 재투영; 최신 revision/instance guard; collapsed/empty/M-only/readonly/rollback/Day·Week/5폭 회귀; 관련 문서; #571에 실제 Core/DOM 정합성 receipt 인계.
- non-scope: #552 미병합 Milestone 표시 전환 활성화, #553 Export, #569 adapter의 제품 viewport writer 교체, #571 Coordinator, DB/API/auth/scheduler/CI gate 변경, merge/main/GHCR/release/Issue close.
- risk_level=HIGH; risk_reason=비동기 Core projection·canonical revision·사용자 viewport 결합; risk_triggers=복합 UI 비동기 상태와 반복 회귀; affected_paths=Gantt projection 및 관련 Unit/E2E·문서.
- qa_required=true; qa_review_mode=독립 PRE_QA 및 이후 exact-head QA_FINAL; qa_method=AGENT; reviewer=실제 독립 `/root/issue570_qa` Agent; qa_evidence=최종 후보 PRE_QA 대기; trusted_qa_run=N/A(AGENT 경로); manager_decision=NOT TESTED.
- version decision: 기존 동작의 멱등 동기화 수정에 PATCH `0.104.1`; release_required=true, release_authorized=false. 버전 변경은 정식 게시 승인이 아니다.
- ownership: frontend=project-gantt.tsx projection·신규 순수 adapter·최소 canonical-snapshot-sync 및 관련 Unit/E2E; infra=분리 checkout·manifest/lock 버전·commit/원격 게시/PR/CI 등록; ui_ux=read-only 설계; qa_docs=read-only 독립 검토; Manager=문서 및 범위·AC 통합 검토. 여러 작성자가 동일 파일을 수정하지 않는다.
- documentation_owner=Manager; required_docs=ARCHITECTURE, PROJECT_UX, MILESTONE_TIMELINE, TEST_PLAN, active PLAN/ISSUE_570, CHANGELOG.
- docs_n_a_with_reason: DESIGN/AGENTS는 시각 언어·공통 interaction·역할 계약 불변; API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/IMPORT_SCHEMA/VBA_EXPORT/DEPLOYMENT/CI_CD/REMOTE_VALIDATION은 서버·도메인·교환·배포·CI 계약 변경 없음. 구현 후 다시 확인한다.
- Local Fast Feedback: 변경 직접 관련 Unit/typecheck/lint 및 실제 Core Chromium projection/기존 회귀; 전체 공식 회귀는 원격 quality/e2e/docker다. 실제 실행 결과와 미검증 AC를 분리한다.
- environment: 기본 git fetch DNS FAIL 후 승인된 네트워크 fetch PASS. 원본 source/untracked 보존. 초기 node_modules 재사용에서 installed Next `16.3.4`와 manifest `16.3.8` 차이를 발견해 clone 전용 frozen npm ci로 교체했다. 실제 Next `16.3.8`/Core `2.7.3`이며 원본 dependencies는 보존했다. 원격 CI가 공식 전체 회귀 검증이다.
- issue_comment_writer=manager; Agent 원격 댓글 금지; 주요 전환만 RESUME/STATUS/EXCEPTION 기록.
- stop/next owner: 구현·DOCUMENTATION_SYNC·독립 PRE_QA → infra 원격 PR·exact-head full CI 등록. 결과 모니터링 및 QA_FINAL/Manager ACCEPT는 요청 범위 밖이며 NOT TESTED.

## 실행 기록

BRANCH_READY PASS: 기존 원격 branch의 baseline을 재확인했다. Node22.14.0/npm11.10.0·Chromium1243와 native SQLite in-memory 실행을 확인했다. 아직 구현·공식 CI PASS를 의미하지 않는다.

격리 npm ci 447 packages/12초, Next16.3.8·Core2.7.3·native SQLite3.53.4 query와 version:check0.104.1 PASS. Chromium 기본 sandbox EPERM을 보존하고 승인된 실행 경로의 launch PASS를 확인했다. launch 결과는 제품 브라우저 AC PASS가 아니다.

## DOCUMENTATION_SYNC

- `DESIGN.md`: N/A(기존 시각 언어와 제품 용어 및 상태 보존 원칙을 유지한다)
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/MILESTONE_TIMELINE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/API.md`: N/A(서버 API 요청 응답 및 authorization 계약은 변경하지 않는다)
- `docs/DB_SCHEMA.md`: N/A(DB migration과 저장 모델 및 영속성 계약은 변경하지 않는다)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정 계산과 달력 및 Dependency 알고리즘은 변경하지 않는다)
- `docs/SECURITY.md`: N/A(Origin 세션 비밀번호 및 서버 revision 보호는 변경하지 않는다)
- `docs/CI_CD.md`: N/A(최신 main 정책을 상속하며 workflow와 required gate를 수정하지 않는다)
- `docs/REMOTE_VALIDATION.md`: N/A(로컬 빠른 검증과 원격 전체 회귀의 기존 증거 경계를 유지한다)
- `AGENTS.md`: N/A(최신 main 지침을 상속하며 역할 및 승인 정책을 수정하지 않는다)

## AC_TEST_COVERAGE

- AC1: 신규 canonical-projection Unit 및 실제 Core metadata Chromium의 native action 관찰과 텍스트·revision 검증. 실행 결과는 동결 이후 아래에 기록한다.
- AC2: projection Unit의 nested Summary context/접힘/null·empty/M-only 및 실제 filter/scale 구조 회귀. 현재 Milestone 호환은 유지하고 미병합 #552 표시 전환은 활성화하지 않는다.
- AC3: canonical-sync-execution의 stale 작업 중단 및 canonical snapshot recovery의 최신 revision 보호, 실제 Core instance와 부수 mutation 수 검증.
- AC4: pure projection/receipt Unit과 실제 Core 5폭·Day/Week 및 기존 readonly/401·412 rollback 회귀. 실제 실행·미검증 범위는 동결 후 별도 기록한다.
- AC5: 지정 source ownership과 네 필수 문서·CHANGELOG·실행 계획 동기화, local Markdown 링크 검사.
- AC6: projection-settled의 실제 Core/DOM 정합성·timeout/supersession/cleanup 검증 및 #571 event contract. exact-head CI/QA_FINAL은 PR 시작 이후의 별도 gate다.

## 독립 검토 중 발견한 구조 경계

새 Task를 기존 형제 사이에 삽입할 때 기존 add-task의 append 경로가 canonical 순서를 놓칠 수 있어 before/after placement를 보완한다. 또 최신 snapshot이 중간 revision을 건너뛰어 부모 삭제와 surviving child의 root/reparent를 함께 포함하면 Core delete-task가 자식을 재귀 삭제할 수 있다. 보호 이동을 부모 삭제 전에 수행해야 하며 mock 호출 성공만으로 실제 Core PASS라고 보고하지 않는다. 기존 Summary 접힘·서버 mutation 0회와 실제 Core 구조 검증을 함께 확인한다.

첫 browser 실행은 frame locator 오류로 FAIL했고 `/tmp/issue570-first-browser-failure`에 보존했다. 최초 matrix의 narrow pointer target 및 390px을 NOT_MEASURABLE로 가정한 오류도 보존한다. 실제 390px에서는 measurable SETTLED를 확인하여 기대값을 강화하며 중간 source가 섞인 실행은 최종 동결 결과와 분리한다.

최신 추가 matrix의 13 PASS/3 FAIL을 보존했다. empty/M-only 두 건은 shared fixture가 task[2]를 고정 참조한 테스트 전제 오류였으며 해당 조회를 빈 fixture 응답으로 명시한다. nested Summary의 0-result→Week→검색 초기화 뒤 자식 노출은 제품 접힘 보존 오류로 분리해 공개 open-task로 사용자 intent와 불일치한 상태만 복원한다. 기대값을 완화하지 않고 최종 고정 source를 재검증한다.

## 완료 신호의 보장 범위

Manager는 receipt의 SETTLED 범위를 canonical Task/Link payload, 행 membership·순서, Grid/Chart 텍스트와 수직 행 정합으로 확정했다. bar X/width, native Link DOM 기하, 최종 viewport/date reveal 완료는 보장하지 않는다. #571은 #569의 별도 기하 검증과 최신 intent 확인을 추가해야 한다. 이 제한은 이벤트 계약과 테스트 계획에도 기록한다.

## 로컬 검증 증거

최종 소규모 delta 이전 고정 source의 Chromium matrix는 17 PASS(33.2초): 5폭×Day/Week metadata 10개, 구조 4개, readonly empty/M-only 2개, nested Summary 1개다. metadata native filter/set-columns 0회와 최신 텍스트·revision·동일 instance·columns/selection 보존을 확인했다. 독립 Reviewer는 같은 제품 source에서 관련 Unit 5파일40개 PASS(187ms), 실제 Core metadata 및 구조 5개 PASS(12.6초)를 재실행했다. 이후 columns/collapse delta의 최종 결과는 별도로 기록한다.

기존 readonly/401/412/network/delete 20개 PASS(2.2분)는 앞선 source의 직접 회귀 증거이며 최종 source 전체 회귀로 확대하지 않는다. 전체 공식 회귀 및 QA_FINAL/Manager ACCEPT는 원격 exact-head CI 이후 별도 gate다.

columns descriptor delta는 Unit37·typecheck PASS, lint0 errors(기존 hook 경고3개)와 actual Chromium12 PASS(24.7초)다. metadata10·nested Summary1·실제 사용자 grip resize→Week→Day1을 포함하며 일반 columns effect의 불필요한 set-columns0회와 scale 경로의 저장 width 복원 action1회씩을 확인했다. 이 증거는 후속 collapse delta 이전 source로 분리한다.

독립 QA의 추가 actual Core 시험에서 collapsed Summary 대상으로 passive canonical reparent 시 Core의 child 이동이 자동으로 부모를 열어 기존 접힘이 풀리는 제품 회귀1 FAIL을 확인했다(`/tmp/issue570-collapsed-repro.log`). 기대값을 완화하지 않고 사용자 collapse intent 보호를 보완한 뒤 직접 영향 회귀를 재검증한다.

접힘 회귀 보완은 동기화 시작 시 기존 자식이 있는 닫힌 Summary를 캡처하고 구조 적용 뒤 자동 열린 대상만 공개 open-task(false)로 복원한다. canonical 동기화 중 자동 open 이벤트가 사용자 preference를 덮어쓰지 않게 보호한다. 첫 자식이 추가되는 신규 container의 기존 auto-open 계약은 유지한다. 변경 관련 Unit38/typecheck PASS, lint0 errors·기존 hook 경고3개이며 최종 actual Core matrix를 실행한다.

최종 source 동결 후 Chromium **19/19 PASS(38.5초, exit0)**: metadata5폭×Day/Week10개, 구조5개(기존4+collapsed target reparent), readonly empty/M-only2개, nested Summary1개, 실제 grip resize→Week→Day1개다. collapsed-target 시험은 접힘 보존과 strict SETTLED를 함께 확인했다. 제품4파일 hash는 실행 전후 모두 일치했다(`/tmp/issue570-final19-before.sha256`, 실행 로그 `/tmp/issue570-final19-browser.log`). 변경 직접 관련 Unit **38 PASS(169ms)**, typecheck PASS, 변경 lint **0 errors·기존 hook 경고3개**다. 앞선17/12개 실행을 최종19개와 중복 합산하지 않는다.

Manager Markdown 링크 검사 **165파일 PASS**, git diff --check PASS. 합성 실제화면2개와 [증거 안내](../../evidence/issue570/README.md)를 포함한다. 전체 공식 원격 quality/e2e/docker, exact-head QA_FINAL, Manager ACCEPT, main/GHCR/release와 환경별 수동 UX는 NOT TESTED다. 독립 PRE_QA의 최종 후보 식별·판정은 Issue STATUS 및 PR에 연결하며 이 로컬 결과를 전체 회귀 PASS로 확대하지 않는다.

최신 main 통합 기준은 `36b0eaa74a0614a76d1ed867bddb548149feb4bc`다. 초기 baseline과 구분하며 #580의 실제 독립 검토/신뢰 경계를 상속한다. AGENT 경로를 유지하고 advisory QA 또는 CI 시작으로 QA_FINAL/Manager ACCEPT를 추론하지 않는다. 통합 전후 제품 파일 hash 동일성과 문서 overlap 보존을 확인한 뒤 원격 게시한다.

최종 columns/collapse delta에 대한 실제 독립 `/root/issue570_qa` 검증은 관련 Unit **5파일41/41 PASS(192ms)**, actual Chromium **2/2 PASS(6.6초)**다. 접힌 대상 Summary로 passive reparent한 뒤 strict SETTLED와 실제 grip resize→Week/Day를 재실행했다. 최신 main 통합 후 제품4파일 hash가 최종19개 실행 source와 동일하며 생성 next-env/tsconfig 변경과 .github/auth/DB 변경은 후보에서 제외한다. 독립 PRE_QA의 exact 후보 판정은 원격 게시 전 Issue/PR에 연결한다. 원격 QA_FINAL과 Manager ACCEPT는 여전히 NOT TESTED다.
