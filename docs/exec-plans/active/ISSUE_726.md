# Issue #726 — 설비·물류 시스템 관리 재사용과 작업 직접 연결

## Work Packet

- Issue: [#726](https://github.com/planner77/masterGantt/issues/726), 상위 #723, 선행 #724/#725, 공통 해석 #728.
- baseline: main `6f6dadb1b3ac10bc837c09273a0922611b2e3f81`, application `0.120.0`.
- working_branch: `feat/issue-726-logistics-master`, 격리 worktree `/home/planner/Dev/masterGantt-worktrees/issue-726`.
- lifecycle_phase: PR_READY. 구현·문서·선정 검증·사전 검토 후 PR Full CI 시작으로 인계한다.
- version_decision: MINOR `0.121.0`. 기존 저장 계약을 재사용하는 하위 호환 Task 직접 문맥 편집과 관리 UX 확장.
- risk_level: HIGH.
- risk_reason: 공유 설비/System 원본, Task/Summary 직접·상속과 Target 호환, dirty/stale 및 canonical 저장에 영향.
- qa_required: true.
- qa_method: OWNER_MANAGED. 현행 QA_REVIEW_POLICY를 적용하며 별도 Agent 사전 검토는 인간 승인·Trusted QA·Owner ACCEPT가 아니다.
- independent_qa: N/A(Owner-managed; 별도 Agent 사전 검토는 별도 기록).
- manager_decision: NOT TESTED.
- release_required: true.
- release_authorized: false. 이번 요청은 구현·문서·관련 로컬 검증·PR Full CI 시작까지만이다.
- quality/e2e/docker/trusted_qa: NOT TESTED. CI 완료 모니터링·병합·main/GHCR·정식 Release·브랜치 정리·Issue 종료는 수행하지 않는다.
- issue_comment_writer: manager. Sub-Agent 원격 댓글 쓰기 없음.

## 요구사항·결정·범위

Issue 본문과 다중 WorkArea 보완 댓글을 적용한다. #725/#728 최종 확정 W1/W2는 초기 미확정 설명보다 우선한다. 설비는 다른 공정의 WorkArea도 선택0..N 가능하며 실제 소유 공정을 보존한다. Task 공정은 명시0..N, legacy null과 명시[]를 구별하고 설비/System/Target/조상으로 자동 채우지 않는다.

기준정보의 두 관리 탭은 기존 단일 LogisticsManagement CRUD와 dialog·권한·공유 영향 확인을 재사용한다. 직접 Task–설비/System 및 직접 공정/WorkArea를 물류 연결 주 흐름으로 제공하고 기존 Target whole/subset/coverage는 보조 호환 영역에 보존한다. shared 원본 수정·Target 구성원 해제·실물 삭제는 서로 다른 명령이다. Task/Target/설비/System 자동생성·복제·자동 controls/coordinates·새 Gantt writer·서버 schema/API 변경은 비범위다.

## 실제 담당·파일 소유권

| 담당 | 소유 |
| --- | --- |
| Manager | 통합·version·공용 문서·Issue/PR 게시·검증 원장 |
| design_726 (ui_ux) | 읽기 전용 interaction·상태·반응형 설계 및 비교 |
| management_726 (frontend) | project-logistics-management.tsx/CSS와 추출된 관리 helper, 관리 전용 신규 테스트 |
| task_726 (frontend) | Task logistics/process-context 편집기·parent dirty/pending 통합·CSS·관련 신규 Unit |
| acceptance_726 (frontend) | 신규 실제 HTTP/Chromium 수용 spec·전용 fixture |
| qa_726 (qa_docs, 구현 후) | 변경·AC·문서·로컬 증거 읽기 전용 사전 검토 |

동일 파일 동시 쓰기와 무단 재귀 위임은 없다. 각 Agent는 타인의 변경을 보존한다. 실제 실행 역할을 기록하며 설정상의 모델/effort를 실측 결과로 주장하지 않는다.

## 변경 영향·검증 계획

| 변경 | 직접 소비자 | 인접·음성 검증 |
| --- | --- | --- |
| 설비/System 관리 상태·유형 입력 | 기존 두 관리 탭, 유형 조회 loading/error/empty, Project 편집/유형 master 권한 분리 | 기존 Fleet·역할·controls/coordinates·검색·active·shared 영향·삭제 보호·다중 WorkArea |
| Task 직접 공정/WorkArea | #725 GET/PUT process-context, catalog revision + Project If-Match, explicit0/legacy | self/subtree·직접/조상 출처·잘못된 owner/foreign/stale·401/403/409/412·dirty/pending |
| 직접 물류 우선/Target 보조 | 공통 Task Editor·기존 direct logistics API | Target-only·whole/subset/coverage·혼합·Gantt canonical 갱신/동일 instance·Resource 탭 |
| 반응형·긴 이름·keyboard | 390/768/1024/1440/1920px 실제 Chromium | focus/disabled 이유·내부 scroll·취소·복귀·중복 제출/응답 역전 |

관련 최소 Unit/HTTP·SQLite/Chromium·typecheck/scoped lint/version/Markdown 링크를 실행하고 정확 결과와 최초 실패를 아래에 기록한다. 전체 로컬 회귀·Docker를 반복하지 않으며 원격 Required3는 PR CI에 맡긴다.

## DOCUMENTATION_SYNC

결과: PASS(코드·문서 의미의 사전 검토). 자동 구조 검사·원격 Trusted QA/Owner 최종 판정과 구별한다. 상세 영향 근거는 아래 영향 판정에 기록한다.

- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(Design Delta B: 기존 시각 원칙을 구체화하며 새 전역 원칙 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 keyboard/focus/상태/5폭 기준 적용이며 정책 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(기존 migration0028 관계/API 소비만 수행하며 schema 변경 없음)
- `docs/SECURITY.md`: N/A(권한/Origin/If-Match와 공개 데이터 경계 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정/공수/의존성 알고리즘 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(기존 Copy/Template/교환 계약 유지)
- `docs/IMPORT_SCHEMA.md`: N/A(새 필드/형식 변경 없이 기존 문맥을 UI에서 편집)
- `docs/CI_CD.md`: N/A(기존 Required3/6shard/workflow/릴리스 정책 불변)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 및 환경별 검증 gate 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 canonical trace/묶음 게시/CI 시작 운영 재사용)
- `AGENTS.md`: N/A(현행 역할/위험/승인 지침 적용이며 지침 자체 변경 없음)

## AC_TEST_COVERAGE

- AC1: `tests/e2e/issue-726-logistics-master.spec.ts`의 실제 master 생성과 `tests/e2e/issue-726-task-logistics.spec.ts` 첫 case의 AMR A10/B5·ACS A/B·MCS1 직접 연결/reload·원본 ID/수량/Task·Target 개수 불변.
- AC2: 신규 master spec의 유형 복구·단품/Fleet·System 공정 선택과 `project-logistics-management.spec.ts`의 기존 목록/역할/관계·Gantt 유지; `process-context-service.test.ts`/`logistics-resource-roles.test.ts`/`task-logistics-links.test.ts`의 owner/Project·수량·권한·사용 중 삭제 방어. 아래 기능 보존표와 대조.
- AC3: 신규 Task spec의 명시0/null·0..N 공정/WorkArea·Summary subtree·명시 조상 설정과 기존 `logistics-target-authoring.spec.ts`의 whole/subset·coverage·Target-only/혼합·직접/상속, `task-target-bindings.test.ts`의 domain 회귀. 자동생성·복제0 검산.
- AC4: 신규 Task 첫 case의 실제 network HTTP401/403/412/사용 중 WorkArea409 전후 canonical 불변, 나머지 case의 오류 주입 UI초안/잠금·중복1write·지연 GET 역전. 신규 master의 실제 Fleet/System·공정1..N 저장 및 기존 Target authoring 공유 원본 확인/명시 원본1회 저장. SQLite/Route 음성 테스트와 network·주입 검증을 구별.
- AC5: 신규 master/Task case의390/768/1024/1440/1920px·긴 이름·Space/Escape·폐기 확인 focus·내부 scroll/가로 containment·System focus 왕복; 실제 PNG2개 보존. 반복 native Escape 실패와 수정·재실행을 아래 원장에 보존.
- AC6: 신규 Task/master의 canonical reload·원본 ID·Task 개수 불변, 기존 `project-logistics-management.spec.ts` Gantt instance·기존 Target authoring exact instance 편집/공유 갱신·`project-task-editor.spec.ts` #461 Logistics와 Resource 관련 model 회귀. Copy/Template는 기존 `project-copy-logistics.test.ts`/`logistics-template-graph.test.ts`로 보존 검증.

매핑만으로 원격 PASS나 전체 UX PASS를 선언하지 않으며 실제 실행/미검증은 아래 원장과 최종 증거를 따른다.

## 실행·실패 원장

- 저장소 원본 작업 트리의 기존 미추적 산출물을 보존하고 최신 main에서 별도 worktree를 생성했다. git fetch 성공, Issue/선행 상태는 연결 GitHub 도구로 확인했다. 기존 #726 열린 PR 없음.
- GitHub CLI 원본 조회 HTTP401: 연결 GitHub 도구로 대체. 제품 테스트 실패와 구분한다.
- 환경 준비: pinned `npm ci --prefer-offline --no-audit` PASS(447 packages). 별도 worktree 설치이며 기존 node_modules 변경 없음.
- 로컬 구현 검증: 아래 최종 검증 기록을 따른다. 원격/Owner 판정과 구별한다.
- PR Required Quality/E2E/Docker·Trusted QA·Manager ACCEPT: NOT TESTED.

## Gantt 상태 정합성 영향

기존 canonical gateway와 한 ProjectGantt 인스턴스를 사용한다. Task 프로세스 문맥도 기존 onApplied→canonical 조회를 통하며 Gantt/viewport writer를 추가하지 않는다. 관리/Editor 왕복·dirty/stale/permission이 직접 영향 범위다. GSC1.0.0-candidate의 REVIEW_PENDING과 제품·환경별 실제 PASS를 구별한다. 실제 수용 증거를 아래 최종 검증에 연결하며 전체 표준 준수를 선언하지 않는다.

### 기능 보존표

| 기능 | 재사용 경로·처리 |
| --- | --- |
| 목록/검색/active·안전 삭제 | 기존 LogisticsManagement controlled subview와 서버 CRUD·usage guard 유지 |
| 설비 유형/단품/Fleet/수량/주 관리 공정/Owner/업체/모델 | 기존 EquipmentDialog; 단품1·Fleet 양의 정수, 다중 WorkArea picker·저장 계약 유지 |
| System 유형/controller/coordinator/공통·복수 공정/PI·개발자/공급사 | 기존 SystemDialog/역할/공정 연결; 유형 field와 draft/revision guard 보강 |
| controls/coordinates·담당 역할 | 기존 관계/역할 dialog와 공유 사용처 영향 확인 유지; Task 연결로 자동생성 없음 |
| shared instance 원본 편집 | 기존 정확 instance ID·동일 host 재사용; Target member 해제·hard delete 구별 |
| Task 직접 Equipment/System | 기존 GET/PUT logistics-links·self/subtree·직접/상속, 중복 요청/permission·세대 보호 보강 |
| Task 공정·WorkArea | 기존 #725 API 소비 UI 추가, 명시0/legacy·실제 owner·독립 catalog revision |
| Target-only/혼합·whole/subset/coverage | 기존 binding editor를 mounted details에 유지, 펼침 경로만 변경; 닫아도 dirty/pending 유지 |
| canonical·권한·Gantt | 기존 onApplied/parent reload·서버 auth/Origin/If-Match·한 Gantt 인스턴스 보존 |

### DOCUMENTATION_SYNC 영향 판정

- UPDATED: REQUIREMENTS/ARCHITECTURE/API(기존 #725 consumer 설명만)/LOGISTICS_DOMAIN_DESIGN/TASK_EDITOR/PROJECT_UX/TARGET_RESOURCE_USER_GUIDE/TEST_PLAN/PLAN/본 Work Packet/CHANGELOG.
- DESIGN.md: N/A(Design Delta B). 기존 Light/system font·semantic token·progressive disclosure·이름 우선·내부 scroll/focus를 화면 계약에 적용하며 새 전역 원칙 없음.
- UI_UX_GUIDELINES.md: N/A. 기존 keyboard/focus/Escape·상태·5폭 검증 기준을 사용하며 공통 interaction 정책 변경 없음.
- DB_SCHEMA.md: N/A. #725 migration0028·typed 관계·null/[]·Copy/Template 저장 그대로, 새 DDL 없음.
- SECURITY.md: N/A. session/Origin/If-Match·Project/catalog revision·권한 분리·공개 범위 불변. 소비 UI의 실패/재시도만 보강.
- SCHEDULING_ENGINE.md / WBS_TASK_LEDGER.md / LOGISTICS_TARGETS.md: N/A. 기존 일정/해석/집계·Target binding authority를 재사용하며 알고리즘/DTO/whole/subset/coverage 의미 변경 없음.
- ISSUE_27_PROJECT_COPY.md / IMPORT_EXPORT.md / IMPORT_SCHEMA.md / JSON_IMPORT.md: N/A. 기존 명시 관계 Copy/Template v4 및 미지원 교환 no-loss guard를 유지; UI로 새 저장 필드를 만들지 않음. 관련 회귀를 선정.
- CI_CD.md / REMOTE_VALIDATION.md / GITHUB_OPERATIONS.md: N/A. Required3/6shard/Full·metadata·trusted·Finalizer/GHCR/릴리스 권한 불변. PR 시작 종료점과 실제 미검증은 이 원장에 기록.
- AGENTS.md / ISSUE_LIFECYCLE.md / QA_REVIEW_POLICY.md / LOGISTICS_IMPLEMENTATION_GUIDELINES.md: N/A. 현행 역할·Source of Truth·위험/검증·승인 지침을 적용하며 정책 자체 변경 없음.
- #720 매뉴얼: UPDATED(기존 사용자 가이드의 실제 새 흐름 및 PROJECT_UX screenKey→anchor 인계). 제품 `/manual` 구현은 비범위.

### 최초 실패·수정 이력

- F01: 신규 master Chromium 첫 실행1 FAIL(2026-10-19 KST). System scope=processes 저장 뒤 dialog가 남았다. 실제 alert는 `Process-scoped systems must have at least one process mapping.`이며 기존 SystemDialog가 processIds를 입력/전송하지 못한 결함이다. 기존 API의 복수 공정 선택을 editor에 제공해 수정하며 assertion을 유지한다. trace/error-context는 로컬 test-results에 보존하고 수정 후 별도 fresh DB 재검증한다.
- 선정 서버/Domain 회귀7파일97테스트 PASS(2.58s). 명령: `npm test -- tests/server/process-catalog/process-context-service.test.ts tests/server/logistics/task-logistics-links.test.ts tests/server/logistics/logistics-resource-roles.test.ts tests/server/logistics/task-target-bindings-handlers.test.ts tests/server/projects/project-copy-logistics.test.ts tests/server/templates/logistics-template-graph.test.ts tests/domain/task-target-bindings.test.ts`. 기존 서버 계약·Copy/Template·Target 보존 증거이며 신규 UI 전체 성공을 뜻하지 않는다.

- F02: 두 번째 master Chromium은 System 생성을 통과했고 최종 MCS 표시 확인만 FAIL했다.`getByText`가 보이는 System 표와 숨은 관계 panel의 동명을 함께 찾는 strict locator 오류였다.`#panel-systems`의 정확한 cell로 한정하고 `toBeVisible`과 저장 내용 assertion을 유지했다.
- F03/F04: 같은4case 실행은 직접 정상1 PASS, master locator/직접5폭/공정5폭의3 FAIL이다. 직접·공정 모두1024px까지 반복 Escape 시 확인이 생성돼도 native dialog의 open이 제거되는 실제 동작을 trace에서 확인했다. Task Editor의 최상위 Escape keydown에서 native 기본 동작을 막고 기존 dirty/pending/확인/관계 삭제의 같은 닫기 판단으로 연결했다. Nested dialog에는 적용하지 않는다. 기본 form용2열 grid 재사용도 전용1열 contextEditor로 수정하고 재검증한다.
- 읽기 전용 QA 지적: 미매핑 active 공정 선택 제한 수정(매핑 요건은 WorkArea만), 미정의 CSS token과 W2 상위 설정 설명, CHANGELOG의 기존0.120.0 항목 귀속·가이드의 명시0 설명을 수정했다. 필요한 assertion/gate를 삭제·skip하지 않았다.

- F05: 세 번째4case 실행은 Task 직접 정상/5폭의2 PASS, master 반복 Escape와 공정 음성 동작 테스트의2 FAIL이다. System은 Task와 같은 native close-watcher 문제여서 WorkspaceDialog에 기본false인 controlledEscape를 추가하고 Equipment/System만 opt-in했다. 공정 spec의 `.uncheck()`는 owner 보호로 체크가 유지되는 정상 동작을 도구 실패로 처리하므로 클릭 시도 후 동일 alert/체크/구역 보존을 검증하도록 고쳤다.
- 추가 실제 HTTP 음성 검증: 별도 cookie 없는401, wrong Origin403, stale If-Match412, 사용 중 설비 WorkArea 변경409를 실제 서버에 보내고 매 요청 전체 canonical/Task 직접 연결/revision 불변을 검산한다. UI 오류 주입과 실제 서버 거부는 별도 증거로 기록한다.
- System 폐기 확인에서 continue/두 번째 Escape 후 원래 입력 focus·전체 초안 복귀를 보강했다. shared WorkspaceDialog의 기본 동작은 그대로이고 opt-in 두 editor만 제어한다.

## 최종 로컬 검증과 사전 검토

- 최종 합집합 Unit/SQLite·Route:10파일152/152 PASS(3.02s). 기존7파일97개와 Task process model·Task Editor model/view-model을 합친 고유 케이스 수이며 중간 실행·독립4개를 중복 합산하지 않는다.
- 최종 Chromium 선정8개 PASS(3.6분): 신규 master1·신규 Task직접/문맥2·기존 Target authoring3(whole/subset·Summary subtree/legacy/pending/401·공유 원본 확인/정확1회 저장)·기존 management Gantt instance1·#461 Logistics1. actual master16.3s, direct20.9s, context30.4s, Target22.9s/17.5s/13.1s, management5.9s, #4613.5s.
- 신규 Task의5폭/긴 이름·Space/반복 Escape·dirty·오류 처리 case1개는 직전 동결된 동일 Task source에서28.5s PASS다. shared Dialog만 추가 변경됐고 Task Editor는 독립 native dialog라 이 증거를 유지한다. 해당 source/test 지문은8개 실행 전후16파일 drift0으로 확인했다.
- 따라서 현재 선정 Chromium의 고유 성공은9개다. 이어서 직접 변경한 EquipmentDialog의 기존 #725 다중WorkArea0..N 실제 UI·재시작 회귀를 별도 실행하고 결과를 추가한다. 중간 실패/반복 실행은 이 고유 수와 합산하지 않는다.
- actual network401/403/409/412: 새 첫 Task case에서 PASS. 실패마다 전체 canonical snapshot/Task directlinks/revision 불변을 실제 HTTP로 확인했다. UI 오류 주입 case는 권한/충돌 수신 후 초안·잠금 처리의 별도 증거다. 서버/SQLite·Route 시험과 socket HTTP를 구별한다.
- 390/768/1024/1440/1920px document/dialog containment·긴 KO/EN 이름·키보드·dirty/Escape와 원본 Task ID·Task/Target/설비/System 개수 불변을 해당 실제 case에서 검증했다. [390px](../../evidence/issue726/issue-726-task-390px.png) / [1440px](../../evidence/issue726/issue-726-task-1440px.png) PNG는 실제 새1열 Task UI를 캡처한 보조 증거이며 나머지 폭/키보드/API 검증을 대신하지 않는다.
- 별도 read-only `qa_726` 사전 검토: 실제 source·문서·테스트·PNG·실행 결과 대조, 직접 model1파일4개 PASS,16파일 지문 독립 대조 drift0. 미매핑 공정/명시0 설명/token/CHANGELOG/반복 Escape·focus 등 지적을 수정했다. 인간 독립 QA·원격 Trusted·Owner ACCEPT와 구별한다.
- 정적/자동 구조: version0.121.0 일치·Markdown261파일 링크·diff check PASS. 기존 base 검증기의 docs_gate가 `STRUCTURAL_PASS_SEMANTIC_REVIEW_PENDING`/`MAPPING_PASS_SEMANTIC_REVIEW_PENDING`을 반환했으며 실제 의미 검토는 위 Manager/별도 Agent 사전 검토로 구별한다.
- 원격 Required3·Trusted QA·Owner ACCEPT, main/GHCR·정식 Release/운영 환경 검증: NOT TESTED. 사용자가 요청한 PR CI 시작 이후에는 결과 모니터링하지 않는다. Issue/branch는 후속 검토를 위해 유지한다.

### 최종 추가 검증·자동 도구 한계

- 기존 #725 실제 consumer2개 PASS(1.3분): 타 공정 E10 WorkArea2개 저장→재시작→한 개 해제→전체 해제·quantity10/원본ID 유지(38.1s), 비활성 호환 기본 구역·중복 occurrence 매핑에서 활성 구역의 정확 owner 선택/저장(12.5s). 외부 서버 대체 없이 fixture가 실제 프로세스를 재시작했다. 최종 선정 Chromium 고유 성공은 총11개이며 제품·테스트16파일 지문 drift0을 유지한다.
- 최종 `npx tsc --noEmit` PASS, 변경 TS/TSX14개 scoped ESLint 오류0·기존 gradeText unused 경고1, version/Markdown/diff PASS. Next가 만든 next-env.d.ts/tsconfig.json 변경과 이번 작업의 중지된 임시 dev build만 정리했으며 제품·테스트를 복원하거나 변경하지 않았다.
- 실제 Pre-PR `fast`/`targeted`는 둘 다 BLOCKED(exit1), UNKNOWN7/missing0/test steps0/sourceStable=true다. [fast 원본](../../evidence/issue726/prepr-fast.json) / [targeted 원본](../../evidence/issue726/prepr-targeted.json). source start/end fingerprint는 `a56ecdd6a5bb9271b5a4c8398b822693742782f91ca98e719e00765047024ec2`다. 새·기존 물류/WorkspaceDialog 경로의 자동 producer→consumer 매핑이 없기 때문이며 자동 도구/정책을 수정하거나 BLOCKED를 PASS로 승격하지 않았다.
- Manager 수동 매핑: WorkspaceDialog→master/System focus·반복 Escape/#725, 물류 관리/CSS/type field→신규 master+기존 관리/공유 원본+#725, 직접 물류→신규 Task+Target 혼합+#461, 새 context editor/model→신규 Task context+model+기존 process service·Copy/Template다. 해당 실제11 Chromium·152 Unit과 정적 검증을 실행했다. lockfile은 version만 변경되므로 설치 Core provenance·Dependency 자체는 변하지 않으며 관련 전체 브라우저/Build/Docker 회귀는 PR CI에 위임한다. 이 수동 영향 판정은 자동 도구의 UNKNOWN을 숨기지 않는다.
- [최종 로컬 manifest](../../evidence/issue726/local-validation.json)는 실제 대상·각 Chromium 결과·실제 HTTP 음성·제품/테스트16개 SHA256·별도 사전 검토·원격 NOT TESTED를 구분한다. 해당 도구 실행 후 추가한 문서·증거는 제품/테스트 지문을 바꾸지 않는다.
- 서버 schema/API·Gantt writer·workflow/Required3/권한 정책 불변, unresolved 사전 코드 지적0. Owner-managed 사전 Agent 검토와 원격 최종 QA·Owner ACCEPT는 별개다. 공식 Required Quality/E2E/Docker·Trusted QA/Owner는 NOT TESTED, MERGE_READY=BLOCKED다.

## 2026-10-19 — PR #743 CI #2982.1 F-001 REWORK

- [CI #2982.1](https://github.com/planner77/masterGantt/actions/runs/39166340575): Quality/Docker SUCCESS, Chromium Shard 4 실제 6 PASS/1 FAIL(`issue-726-task-logistics.spec.ts:343`), 나머지 Shard 1/2/3/5/6 CANCELLED, 자동 QA FAILURE는 파생. **기존 실패 원본은 보존**한다.
- 원인: Fixture의 A/B 생성 순서가 임의 UUID의 정렬 순서를 보장하지 않지만 canonical process-context reader는 `ORDER BY p.public_id`를 사용한다. 관계 2개의 ID·scope는 기대와 동일하고 순서만 반대였으므로 **TEST_CONTRACT** 비교 오류로 분류한다. 서버/DB/권한 변경·assertion 약화·timeout/skip/retry 증가는 없다.
- 변경: `tests/e2e/issue-726-task-logistics.spec.ts`에서 expected·actual 객체 배열을 `processId` 정렬 후 exact 비교한다. 중복, 누락, scope 오염은 여전히 거부한다. 원본 분석과 취소된 Shard 경계·재실행 조건은 [이슈 전용 누적 실패 원장](../../ISSUE_726_FAILURE_ANALYSIS.md)에 기록한다.
- 재검증: Node v22.16.0 독립 정규화 smoke(역순 성공·중복/scope 오염 실패) PASS. GitHub 연결 Repo checkout/Playwright 실제 환경이 없어 새 source의 typecheck/Chromium 직접 실행은 **NOT TESTED**. 해당 원격 Required3 전체는 새 PR CI를 통해 검증한다. 기존 로컬 11개 PASS/152 Unit PASS를 새 Head의 증거로 승격하지 않는다.
- 정렬·리뷰: 최초 재수집 시 `main=6f6dadb1b3ac10bc837c09273a0922611b2e3f81`, `behind_by=0`, `mergeable=true`, unresolved review threads=0. 제품/스키마·API·버전·Gantt writer·CI workflow 변경 없음; DOCUMENTATION_SYNC: TEST 계약 변경+실패 원장/본 Work Packet **UPDATED**, 다른 문서는 기존 판단 유지(N/A).
- 인계: PR synchronize 새 Head Full CI 시작까지만 수행; 결과 모니터링·merge·GHCR/정식 release·Issue 종료는 요청되지 않았다. Required3/Trusted QA/Owner ACCEPT는 새 Head에서 **NOT TESTED**이고 MERGE_READY=BLOCKED.

## 2026-10-19 — PR #743 CI #2985.1 F-002 / main #717 통합 REWORK

- [#2985.1](https://github.com/planner77/masterGantt/actions/runs/39169140616) exact old Head `31973c8aefd462ea0e3cf142b829a67252093a95` (Base `6f6dad...`): Quality·Docker SUCCESS, Chromium Shard5 실제 50 PASS/1 FAIL/33 NOT RUN, 나머지 5 Shard matrix CANCELLED (Shard4는 #726 F001 case를 포함한 부분 PASS). QA Automated FAIL은 E2E aggregate의 파생 실패. 기존 [#2982.1](https://github.com/planner77/masterGantt/actions/runs/39166340575)의 UUID 정렬 실패 F-001도 별도로 보존.
- F-002 직접 실패는 `project-workspace-tabs-518.spec.ts:79`의 상위 Dashboard 탭 `aria-selected=true`이지만 focus는 inactive인 PRODUCT/NAVIGATION_FOCUS 사례. #717 원장 F-012(#2968.1)에서 동일 검사/증상과 stale screen 복원을 교정했다. #726 이전 base는 이 후속 제품 수정을 포함하지 않음.
- 최신 main `0209c72f8a0702415f2e00b63c895549a65dbe81` (#717, baseline보다23 commits)과 2-parent merge로 정렬한다. #717 동기 focus+activeScreen 유지·관측 E2E, 이름-first/원본 식별 정보와 #726 공유 원본 CRUD·직접 Task 편집·Target 호환을 함께 보존. Package+lock 0.121.0, CHANGELOG 두 버전 구분, docs 병합; 14 중첩 경로 3way patch 원본 검증. main의 고정 #518 assertion/5폭·키보드/URL/Gantt 무쓰기 계약 완화 없음.
- 누적 실패/반례/교차 영향, 전체 Shard 상태와 직접·인접 E2E/Unit 선정은 [전용 실패 원장](../../ISSUE_726_FAILURE_ANALYSIS.md) F-001·F-002에 기록. 기존 F-001 #2985 Shard4 개별 PASS를 전체 E2E 성공으로 사용하지 않음.
- 신규 직접 물류 Editor의 설비/System은 #717 이름 우선 표시, 동명 코드 보조 및 `IdentifierDetails`에서 canonical 코드·ID 조회. 관리 UI도 main #717 원문 인력 식별 정보와 #726 type field/수정 흐름을 모두 보존한다. 기존 Task/link scope/Revision/permission, Target whole/subset/coverage/API와 단일 Gantt 원본 변경 없음.
- 현재 도구에는 로컬 프로젝트 checkout/npm/browser 런타임이 없어 신규 통합 소스의 typecheck/Playwright 재현은 **NOT TESTED**. 원격 새 exact-Head Full PR CI Quality/Chromium6/Docker로 확인해야 한다. 문서 동기화 UPDATED: 원장/Work Packet 및 main 병합 문서; CI/CD·DB/서버 API·보안 권한 정책·테스트 timeout/retry/Required job 변경 없음. Reviewer/Trusted/Owner·MAIN/GHCR/Release/Issue 종료는 사용자 요청 범위 밖.
