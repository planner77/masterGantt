# Issue #729 — versioned 다관점 WBS 조회·snapshot·정확 상세

## Issue Work Packet

- repository: planner77/masterGantt
- issue_number: 729
- issue_url: https://github.com/planner77/masterGantt/issues/729
- lifecycle_phase: IMPLEMENTATION → LOCAL_FAST_FEEDBACK → DOCUMENTATION_SYNC → PRE_QA → PR_CI
- baseline_sha: `6f6dadb1b3ac10bc837c09273a0922611b2e3f81` (main, #728 / PR #742)
- working_branch: `feat/issue-729-versioned-views`
- baseline_version: `0.120.0`
- candidate_version: `0.121.0` (minor: 신규 opt-in 공개 조회 기능, dependency 변경 없음)
- risk_level: HIGH
- risk_reason: 공개 Project 조회의 원시 Task/Assignment 귀속·다관점 비가산 합계·snapshot/detail/Export 범위가 여러 기존 원장에 걸침
- qa_required: true
- qa_method: OWNER_MANAGED
- reviewer: 실제 별도 `views_qa` qa_docs Agent 사전 검토; 인간 Reviewer·Owner 최종 승인과 구분
- manager_decision: NOT TESTED
- release_required: true (후속 병합에서 version bump가 유지되면 정식 릴리스 필요)
- release_authorized: false
- authorization_evidence: 사용자는 구현·문서 갱신·PR CI 시작까지만 요청. CI 모니터링·병합·main/GHCR·Release·Issue 종료는 범위 밖
- issue_comment_writer: manager
- issue_comment_allowed_types: PLAN,STATUS,EXCEPTION

## 요구사항·소유권

원본 Issue 및 [W1/W2 확정 댓글](https://github.com/planner77/masterGantt/issues/729#issuecomment-6245435173)을 적용한다. #725의 저장 계약, #727 프로젝트 등록, #728 pure WBS 원장과 기존 Resource KPI/Plan·Milestone Gate를 재사용한다. W1 설비의 서로 다른 공정 WorkArea0..N을 보존하고 W2 Task 명시 공정0..N은 구성/Target/조상으로 fallback하지 않는다. 같은 MCS의 T0=2/T1=3/T2=4/T3=5 M/D는 전체14/조립8/검사9/미연결2다.

실제 backend `views_backend`는 `src/**`의 공개 contract/parser·read repository/서비스·route·Export 거부 경계를 소유한다. 실제 backend `views_acceptance`는 새 `tests/server/resources/wbs-dashboard-views*.test.ts` 및 새 fixture만 소유해 SQLite→HTTP 수용을 작성한다. Manager는 문서·version·통합·Issue/PR 게시를 소유한다. 실제 `views_qa`는 읽기 전용 AC/code/test/docs 사전 검토를 수행한다. 동일 파일 동시 쓰기·Sub-Agent 원격 댓글·무단 재귀 위임은 없다.

기존 `projectionOrder`와 자동 공정 유도 API는 의미를 바꾸지 않는다. 신규 view spec은 선택한 Task/Assignment 교집합을 모든 단계에서 유지하고 설비/System을 typed 형제로 표현한다. 등록-only root/미배정 Task를 보존하며 상위 합계는 원시 ID 합집합이다. `viewRowKey`는 경로 식별이고 원본 ID가 아니다. provenance의 작업 연관/구성 membership/controls/coordinates/assignment를 혼동하지 않는다. `E1→M→공정`은 E1-t1만 유지하며 M을 공유하는 E2-t2를 합류시키지 않는다.

DB migration·저장 writer·UI·Gantt·공통 Scheduling 산식·CI workflow·Ruleset·GHCR 권한은 비범위다. 신규 spec을 기존 Excel 요청으로 조용히 축소하지 않고 미지원 경계를 명시한다. 상세·drill은 동일 snapshot과 정확 원시 범위로 인계하며 stale는 재조회로 복구한다.

## AC_TEST_COVERAGE

- AC1: 신규 SQLite→HTTP 테스트의 Target0/기존 Target-only/혼합·D1 원시 ID/지표·등록-only root·미배정 Task.
- AC2: 신규 HTTP 테스트의 root-only, process→설비/System 형제, equipment→process→system→resource, equipment→milestone→process 및 Resource/Milestone 교차.
- AC3: 신규 HTTP/기존 Domain 회귀의 축 순서·페이지와 독립된 고유 합집합, Group/shared System/중복 출처·비가산 공수.
- AC4: 신규 HTTP 테스트의 exact 상세·drill IDs/같은 snapshot·stale/filter/foreign ID/Origin·Project 격리 및 미지원 Export 명시 거부.
- AC5: 신규 테스트 및 기존 Resource Dashboard/Target/Plan/KPI 회귀. explicit0/legacy 출처를 구분하고 허위 controls 관계를 만들지 않음.
- AC6: 신규 HTTP 테스트의 명시 예산 초과·비절삭·query count/응답 bytes/시간 계측 및 기존 전체 source 한도. CI gate 변경 없음.
- W1/W2 추가: WorkArea0/1/2+·교차 공정 snapshot 변경, 명시 Task 공정0과 legacy null 분리, 전체14/A8/B9/미연결2, E1→M→공정의 t2 누출0.

위 항목은 검증 계획이며 테스트 존재만으로 PASS가 아니다. 실제 실행·최초 실패·미검증은 아래에 기록한다.

## DOCUMENTATION_SYNC

작성자: Manager. 상태: PASS(구현·계약·문서의 범위별 의미 정합성 및 실제 변경 확인; 원격 Trusted QA/Owner 승인과 별개).

- `docs/API.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/WBS_TASK_LEDGER.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/LOGISTICS_DASHBOARD.md`: UPDATED
- `docs/EXCEL_EXPORT.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/DB_SCHEMA.md`: N/A(기존0028/0029 관계를 read transaction으로 읽으며 DB schema·migration·저장 writer는 변경하지 않음)
- `docs/IMPORT_EXPORT.md`: N/A(기존 Excel의 새 spec 거부만 추가하며 기존 Import·Copy·Template 교환 계약은 변경하지 않음)
- `docs/IMPORT_SCHEMA.md`: N/A(새 view spec은 public read query이며 Import schema·파일 parser·저장 입력이 아님)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Calendar·공수·Plan·Milestone full Gate 알고리즘 재사용이며 일정 변경 없음)
- `DESIGN.md`: N/A(화면·시각·interaction·Gantt 상태 writer 변경 없는 신규 HTTP read adapter만 추가)
- `docs/UI_UX_GUIDELINES.md`: N/A(신규 화면·menu·keyboard·focus·responsive 변경 없음)
- `AGENTS.md`: N/A(기존 역할·QA·검증 gate 적용이며 실행 지침 자체 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 PR CI 시작까지의 경계를 적용하며 lifecycle 계약 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 OWNER_MANAGED와 Agent 사전 검토·Owner 최종 승인 구분 유지)
- `docs/CI_CD.md`: N/A(Required3·E2E6 shard·workflow·main/GHCR·Release 계약 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 원격 gate 증거 규약과 환경별 검증 유지이며 CI 모니터링은 요청 범위 밖)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 canonical Refs·묶음 게시·승인 경계 재사용이며 운영 지침 변경 없음)

## 실행·실패 원장

- 시작: 기존 작업 트리의 untracked 증거와 branch를 보존하고 별도 worktree 사용. Git fetch/main 확인 및 #729 기존 open PR 없음 확인.
- GitHub CLI `gh issue view`는 HTTP401 Bad credentials. 연결 GitHub 도구로 Issue/전체 댓글 조회 및 Git transport fetch 성공. 인증값 출력·변경 없음. 제품 테스트 실패와 구분.
- 환경: Node22.14.0, `npm ci --prefer-offline --no-audit` exit0 /447 packages. eslint deprecation은 원문 경고이며 dependency 변경 없음.
- 실제 최종 로컬 검사: 아래 동결 source 원장을 참조. 과거 NOT TESTED 계획을 신규 성공과 구분한다.
- 실제 PR Required Quality/E2E/Docker, 기본 브랜치 Trusted QA, Owner 최종 승인: NOT TESTED.
- main/GHCR/Release/cleanup/Issue 종료: 요청 범위 밖.

## Gantt 상태 정합성 영향

gantt_standard_version: `GSC 1.0.0-candidate` (`REVIEW_PENDING`). 읽은 문서 commit은 baseline `6f6dadb1b3ac10bc837c09273a0922611b2e3f81`이며 GANTT_STATE_CONSISTENCY·GANTT_STATE_CONFORMANCE·GANTT_ADAPTER_ADR·GANTT_SYNC_TRACE·active GANTT_STATE_REMEDIATION을 참조했다. GSC-01의 원본/조회 분리와 GSC-04의 상태별 쓰기 소유권을 유지한다. 신규 adapter는 서버 읽기만 수행하며 client Core·viewport writer가 아니다. 기존 Gantt canonical/Native Core·viewport·선택/focus writer는 변경하지 않는다. SC-01~SC-14의 Core/browser 시나리오는 직접 변경 비영향으로 로컬 신규 증거 N/A이며 원격 전체 E2E는 유지한다. HTTP/SQLite 성공은 Core/no-op/복구·제품 전체 표준 준수 증명이 아니다. 예외 ADR 없음.

### 구현 중 발견·보완 이력

- 신규 SQLite→실제 Node HTTP 초기18개는18 PASS. 이 결과가 다음 미포함 scope 음성까지 증명하지는 않음.
- 독립 `views_qa` 사전 검토 P1-1: `scheduleSelection=[T1]`의 taskIds는T1인데 Assignment A0~A3·14 M/D가 남음. 기대 A1·3 M/D. ledger Task rows만 좁히고 원시 A를 교차하지 않은 것이 원인.
- P1-2: 사용자 `filters.taskIds=[T1]`와 `exactAssignments=[A2(T2)]`가 T2/A2·4 M/D로 확장됨. 기대 빈 집합. scope의 taskIds로 사용자 조건을 덮은 것이 원인.
- 위 두 문제를 실제 HTTP scope 음성으로 추가한 중간22개는21 PASS/1 FAIL. 보완 전 실패를 최종 성공으로 대체하지 않음. scope report/details/drill·빈 집합·공동담당자 교집합 회귀로 재검증한다.
- P2 사전 검토: 선택 equipmentIds는E1로 좁혀져도 전체 canonical 관계 sources에E2가 남아 exact source처럼 읽힐 위험. canonical source 보존과 선택된 경로의 typed instance/provenance 인계를 구분해 보완한다.
- Git push 준비: 기존 인증 그대로 `git push --dry-run`은 exit128/Invalid username or token. fetch 성공은 write 권한 증거가 아니다. 인증정보 탐색·변경 없이 연결된 GitHub Git Data API로 전체 tree와 부모를 검증하는 묶음 게시 경로를 사용한다.

- P2 후속: exact Assignment로 prepared 원장을 직접 줄이면 `participation.projectAssignedCount`가 전체2에서 선택1로 바뀌는 문제를 독립 재현했다. 전체 원장은 보존하고 선택 결과만 교차하는 방식으로 보완하여 full Gate·Capacity/Project reference·전체 배정 인원과 선택 인원을 분리한다.
- 중간 보완23개 HTTP 테스트23 PASS. Project publicId를 요청 URL에서 실제로 읽어 malformed/missing404·다른 Project 빈200·foreign assignment400을 검증했고 파일 DB reopen의 명시0/WorkArea0..N snapshot 보존도 확인했다. 최종 동결 source에서 다시 검증하므로 이 중간 결과를 최종 증거로 합산하지 않음.

- P1 추가: 전체 원장을 보존한 중간 구현에서 `exactAssignments=[R1 A1]` 후 Resource R2(같은 Task 공동담당)의 node에 Task1이 남고 Assignment0이 되어 선택 기여가 과대 표시됐다. 개인축 선택을 scope 교집합 뒤 다시 검증하여 등록-only Task0과 실제 선택 Task를 구분해야 한다. 독립 검토/HTTP 음성으로 보완하며 발견만으로 해결 PASS를 선언하지 않는다.

### 최종 동결 source 검증 — 2026-10-19 KST

- 변경 source/test14경로 지문은 [local-validation.json](../../evidence/issue729/local-validation.json)에 보존한다. 별도 qa_docs의 동일 파일 집합 hash는 `fc1efca907a38d4af1ba5f04a3405e0136e45ea0e21f5fc3b2e1abdc359bc6bf`이며 이후 source/test 추가 변경 없음. 문서·검증 산출물 갱신은 제품 코드 재변경과 구분한다.
- Manager 최종 회귀:15파일300 PASS(5.61초) + 추가4파일81 PASS(3.85초), 중복 없는19파일381테스트. 신규 HTTP24개는300에 포함하며 별도 합산하지 않는다. 명령 전체를 위 JSON에 보존한다. 기존 WBS/KPI/Target/Plan·Resource report/rollup/drill·권한/route inventory·Excel·Stage HTTP·참여·Template 소비자를 포함한다.
- 구현 Agent의 마지막 `npm run typecheck` PASS, source/test scoped ESLint 경고0 PASS. Manager version0.121.0 일치·Markdown 링크·`git diff --check` PASS. dependency bytes는 version 외 동일하며 전체 build/전체 Vitest/전체 Chromium/Docker를 로컬 반복하지 않았다.
- 실제 별도 `views_qa` read-only 사전 검토 PASS: 최종 source4파일101테스트 재실행 PASS(5.37초), 별도 실제 SQLite probes에서 exact scope/filter∩scope 빈집합·공동담당 개인축 Task0·전체 participation2·E1 typed instance/provenance 및 effective=false 비기여 제외 확인. 알려진 P1/P2 미해결0. 이 검토는 독립 인간 QA 또는 Owner ACCEPT가 아니다.
- 성능 fixture:8→128 Task, 개인배정124, 등록2→27명에서 실제 SQL 실행77→77, JSON83,570→656,445bytes,13.19→34.58ms. 이는 합성 환경1회 관측이며 운영 보장/CI 임계값이 아니다. EXPLAIN은 Project/Resource index SEARCH와 ORDER BY용 임시 B-tree를 실제 기록했다. fan-out1000 초과 및 실제2MiB 초과 응답은422 전체 실패, 총계 절삭0을 검증했다.
- 실제 Pre-PR `fast`와 `targeted`는 둘 다 **BLOCKED(exit1)**. UNKNOWN6/missing0 때문에 test step0, sourceStable=true이며 지문 `b2734ded15e53e4b7e9953629cf6c7bc18785b5b97c5b9bb5ab5977c40d1c0ca`. [fast 원본](../../evidence/issue729/prepr-fast.json), [targeted 원본](../../evidence/issue729/prepr-targeted.json)에 도구 버전·base/head/working fingerprint·선정/미선정·원격 DEFERRED를 보존한다. 자동 mapping이나 gate를 완화하거나 이 결과를 PASS로 승격하지 않았다.

| Pre-PR UNKNOWN producer | Manager가 확인·실행한 실제 소비자/음성 매핑 |
| --- | --- |
| src/contracts/wbs-dashboard-views.ts | 신규 HTTP의 schema/직렬·형제 spec/strict 실패·exact scope/details·서버 DTO 소비 |
| src/server/repositories/wbs-view-snapshot-repository-core.ts | 신규 HTTP 실제 SQLite 문맥/등록/WorkArea/reopen/stale·SQL count/query plan 및 기존 참여 회귀 |
| src/server/resources/resource-data-context-core.ts | 신규 HTTP snapshot과 기존 Dashboard/Plan/drill/Excel/Stage HTTP/Template 회귀 |
| src/server/resources/wbs-dashboard-views-core.ts | 신규 HTTP 모든 축·고유 합집합·exact scope/filter/공동담당/빈집합·source/bytes 예산 음성 |
| src/server/resources/wbs-dashboard-views-query-core.ts | 신규 HTTP version/축 반복/잘못된 형제·path/foreign ID/조건 변경/Origin 음성 |
| tests/fixtures/wbs-dashboard-views.ts | 신규 HTTP suite의 direct/Target/mixed golden·재연결·실제 한도/성능 검증 |

자동 선정의 generic Gantt browser/Core 및 DB/Import 전체 시나리오는 직접 로컬 실행에서 제외했다. manifest/lock은 version만 변경하고 UI/Gantt/Import/DB writer는 비변경이므로 새 HTTP opt-in read adapter의 직접 SQLite·HTTP와 영향받는19개 suite를 수동 실행했다. 전체 Chromium6/Docker/production build는 PR CI에 유지한다. 수동 매핑은 CLI BLOCKED 상태를 변경하지 않으며 실제 Next 서버 routing·브라우저 async 응답 역전·수동 UX·운영 규모 성능은 해당 환경 증거 전 NOT TESTED다.

문서 의미/구현/테스트 및 docs_gate의 구조/AC mapping을 각각 확인했다. 이 로컬 구조 검사는 `STRUCTURAL_PASS_SEMANTIC_REVIEW_PENDING` / `MAPPING_PASS_SEMANTIC_REVIEW_PENDING`이며 Trusted QA/Owner 병합 승인이 아니다. 신규 spec의 Excel은 명시 미지원409이고 기존 Excel은 회귀로 보존했다. 실제 원격 Required Quality/E2E/Docker·Trusted QA·Manager ACCEPT는 PR CI 시작 후에도 결과 미조회이므로 NOT TESTED, MERGE_READY=BLOCKED다.
