> 게시 전 최신 main 정렬: 착수 기준53aee48e의 실제 검증을 보존하고 #772/PR778이 병합된 `72c2c9d0a912dc906d4101ea41a7a57e0c686597` 위로 단일 제품 commit을 재배치했다. 제품 runtime·테스트·8shard plan byte변화0이며 TEST_PLAN의 양쪽 신규 섹션을 보존했다. 아래 초기 baseline/열린PR/실행 결과는 해당 시점 이력이고 최종 PR base는72c2c9d0다.

# Issue #762 — 프로젝트 공정·WorkArea 직접 소속과 무손실 호환

## 실행 범위와 기준

- Issue: https://github.com/planner77/masterGantt/issues/762
- baseline main: `53aee48eba52860d6abf17149cc72292c4187dae`, 기존 version `0.129.1`.
- branch: `feat/issue-762-process-workarea`; 기존 #762 PR 없음. 관련 #725~#736 구현은 main에 통합된 상태에서 착수한다. 열린 #772/PR #778 CI 정책 및 #720/PR #721 문서 정책은 포함하지 않는다.
- 승인 범위: 분석·설계·구현·문서 동기화·PR CI 시작. CI 모니터링·병합·Main/GHCR·Release·Issue 종료·branch 정리는 제외한다.
- risk_level: HIGH; risk_reason: DB identity/FK, shared legacy 참조, Task·Equipment·다관점 집계와 교환의 영향.
- qa_required: true; qa_method: OWNER_MANAGED; independent_qa: N/A (독립 인간 QA 미수행). 별도 Agent의 읽기 전용 사전 검토를 인간 승인 영수증으로 사용하지 않는다.
- manager_decision: NOT TESTED; MERGE_READY: BLOCKED. 정확 Head Full Required3/Trusted QA 및 Owner의 별도 HIGH 위험 수용·병합 승인은 후속이다.
- version_decision: minor, `0.130.0`; release_required: true; release_authorized: false. 제품 기능과 additive DB 확장에 따른 MINOR이며 PR 시작 권한은 정식 게시 승인이 아니다.
- issue_comment_writer: manager; issue_comment_allowed_types: PLAN,STATUS,EXCEPTION. Sub-Agent 댓글 쓰기 없음.

## 파일 소유권

| 담당 | 쓰기 범위 | 경계 |
| --- | --- | --- |
| backend | DB migration, contracts, server/API, domain reader 및 해당 테스트 | 기존 global catalog 재작성 금지; UI/문서/version/PR 변경 금지 |
| frontend | features 및 UI 관련 unit/E2E | server/domain/schema/문서/version 변경 금지 |
| ui_ux | 읽기 전용 설계·구현 비교 | 코드·문서·GitHub 변경 없음 |
| infra | 환경 및 최종 commit/branch/PR/CI 시작; 필요한 신규 spec shard 등록 | Manager handoff 전 게시 금지; CI 모니터링·merge 없음 |
| Manager | 공용 interface freeze, 문서, version, 통합·사전 검토 | 원격 미완료를 ACCEPT로 보고하지 않음 |

## 선행 설계 Gate

신규 소속은 `Project → project_processes → project_work_areas`로 표현한다. 공정 0..N, 공정별 구역 0..N이며 구역 0개도 정상이다. 기존 공정 ID/parent/WBS와 Target은 바꾸지 않는다. 신규 구역은 하나의 Project/공정에만 속하고 parent 재귀속을 허용하지 않는다. 이름은 식별자가 아니며 다른 공정의 같은 이름은 별도 UUID로 보존한다.

기존 `work_areas.occurrence_id`, `project_process_occurrence_mappings`, 제품 표준/공정 유형/현장 occurrence와 Target/member/coverage 원본을 DROP·복제·합치기·자동 이관하지 않는다. 공유 구역을 하나의 프로젝트 공정 owner로 추정하지 않고 명시 mapping의 `(processId, workAreaId)` 관계별 읽기 alias로 제공한다. source/편집 가능 여부를 구분하며 Project edit로 legacy global 원본을 수정하지 않는다. 여러 project process가 같은 legacy WorkArea를 참조해도 canonical WorkArea UUID와 관계가 그대로다. 이 호환 경로는 참조 해소와 별도 승인된 전환 전까지 유지하며 폐기 일정을 임의로 정하지 않는다.

신규 typed Task/Equipment 연결은 직접 소속의 FK를 사용하고 기존 legacy 연결 테이블과 함께 읽는다. Task는 공정 0..N과 선택 구역을 명시하며 실제 소속 공정·활성·프로젝트·Summary subtree를 검증한다. 설비 구역은 주 관리 공정과 별개이고 서로 다른 공정 구역을 선택할 수 있다. 시스템의 공통/다중 공정은 기존 경로를 유지한다. origin/session/strong If-Match·transaction 내 권한 재검증·원자 rollback은 유지한다.

### Before → After 영향 inventory

| 원본 / writer·reader | 기존 계약 | 신규 / 호환 계약 |
| --- | --- | --- |
| project_processes / logistics CRUD | Project 공정 hierarchy·UUID | 동일 원본/CRUD 재사용; 이름 우선·자동 code; 분류 triple 필수 아님 |
| global catalog / admin·standards apply | 유형→제품 표준→occurrence→구역, global revision | 원본·관리자 권한 그대로; 기본 신규 등록 선행 조건에서 제거 |
| project process mapping | Project 공정→occurrence, optional default 구역 | legacy-only 호환; 신규 direct 구역은 mapping 필요 없음 |
| process-context GET | triple-filtered global 구역/명시 mapping | direct 구역 + 명시 legacy alias; 기존 응답 필드 유지 |
| Task/Summary process context | explicit marker 및 self/subtree | 같은 public body; direct·legacy 실제 owner 검증/같은 원본 |
| Equipment WorkArea | global 구역 typed 관계 | direct typed 관계와 union; Fleet quantity 원본1회; main process와 독립 |
| System / Target / coverage | 기존 local process/global occurrence 관계 | 새 구역 등록만으로 관계나 Target 생성하지 않음; 기존 원본 보존 |
| KPI / Milestone / Process / Equipment / System / Resource | canonical WBS ledger와 exact ID drill | direct+legacy 구역 metadata/selector를 동일 snapshot에서 제공; Task/Assignment 합집합 집계 |
| Project Copy | local IDs remap/global IDs reuse | direct owner와 구역·연결 UUID remap; global shared ID 재사용 |
| Template | 기존 logistics v4/global validation | 직접 구역을 보존하는 versioned 확장; 이전 포맷 읽기 호환/unsupported 오류 |
| JSON/일정 Excel | schedule-only, context 손실 차단 | direct 구역 원본도 silent loss 없이 명시 오류; Resource 보고서와 backup 구분 |
| 사용자 조회 설정 / drill | versioned ID/path/snapshot | canonical ID 사용; 등록·조회로 Task/Assignment 생성0 |

### Fixture·배포 경계

fresh 분류 미지정 Project의 조립/검사2공정·조립A/B2구역·검사0구역, 같은 이름/다른 ID, 비활성/외부 Project/잘못된 owner, 동일 legacy occurrence/구역의 복수 Project·공정 mapping, default 구역·미매핑·hierarchy 및 direct+Target 혼합을 검증 대상으로 한다. 관계 수와 raw Task/Assignment/설비 ID 집합을 비교하고 이름 매칭을 사용하지 않는다. 실패·충돌을 빈 구역으로 바꾸지 않는다.

migration은 additive이며 기존 테이블/관계의 자동 backfill·삭제가 없다. 배포 전 대응 DB backup과 같은 image/version 세트를 보관한다. 신규 direct 데이터를 작성한 뒤 구 image로 DB를 단순 downgrade하면 새 관계가 보이지 않으므로 rollback은 대응 backup 복원 또는 forward correction으로 수행한다. 실제 운영 DB/backup/프록시 검증은 NOT TESTED이며 합성 SQLite restart 검증과 구별한다.

## UI 설계

기존 공정 CRUD table을 단일 목록으로 재사용하고 행의 작업 구역 선택 버튼과 하단 선택 공정 WorkArea table을 연결한다. 검색·비활성 필터·정렬·상태·안전 삭제를 제공한다. 구역0개는 정상 빈 상태와 추가 버튼이다. 신규 입력은 이름 필수, 기술 code는 자동 생성/요청 시 확인한다. 기본 경로의 현장 공정 재조회/매핑/4단계 관리 UI를 제거하고 필요한 legacy 보조 경로는 접힌 고급 영역에서만 제공한다.

표의 가로 scroll은 각 wrapper가 소유하고 문서 전체 overflow를 만들지 않는다. native button/label/keyboard focus와 modal Escape/복원을 기존 공통 패턴으로 유지한다. pending 중복 제출·닫기, dirty 전환, 401/403/409/412/network 실패의 비민감 초안 보존·명시 갱신을 검증한다. 탭을 바꾸어 Gantt 원본·mount·viewport writer를 새로 만들지 않는다.

SVAR Core2.7.3의 task grouping/PRO는 사용하지 않는다. 공식 [기본 demo](https://docs.svar.dev/react/gantt/samples/#/base/willow)와 [grouping 제약](https://docs.svar.dev/react/gantt/guides/data-operations/grouping-tasks/)은 비침범 경계 참고이며 SPA shell 조회를 실제 조작 증거로 부르지 않는다. ui_ux가 2026-10-22 확인했다.

## AC_TEST_COVERAGE


- AC1: tests/server/process-catalog/project-work-areas.test.ts 및 tests/e2e/issue-762-process-workareas.spec.ts — 분류 없는2공정/2+0구역·Request handler/실제HTTP·SQLite재시작·숨은catalog/Target쓰기0.
- AC2: project-work-areas.test.ts — 같은이름/다른UUID·단일owner 복합FK·교차Project·잘못된owner·중복/비활성/재귀속·사용중삭제 원자거부.
- AC3: project-work-areas.test.ts 및 process-context/catalog 회귀 — 0029→0030원본수/UUID·공유alias/default/미매핑/비활성·migration rollback·legacy alias200초과보존.
- AC4: project-work-areas.test.ts·process-context-service.test.ts·logistics-template-graph.test.ts 및 신규Chromium — Task/Summary self/subtree·설비cross-process·System공통/복수·동일Task/Assignment/설비수량.
- AC5: project-work-areas.test.ts의 direct+Target 혼합6view/KPI golden 및 exactdrill·기존 WBS/KPI/Resource 직접소비자 회귀 — 원시ID 합집합·구역0개·역방향owner 검증.
- AC6: logistics-template-graph.test.ts·project-import-parser.test.ts·migrationCLI/DB 및 신규Chromium — fresh/upgrade/restart·ProjectCopy/Templatev5·구버전·201directcap rollback·명시400/409 손실방지.
- AC7: project-work-areas.test.ts·신규Chromium·기존#725 — readonly/edit/admin분리·Origin/session/strongrevision·401/403/409/412·stale/pending/초안보존.
- AC8: 신규Chromium5폭390/768/1024/1440/1920·dirty/Escape/focus/탭복귀·Task/설비UI 소비자 및 TARGET_RESOURCE_USER_GUIDE — 실제결과는 아래 실행원장 참조.
- AC9: TEST_PLAN #762 영향선정표·Pre-PR 실제결과·targeted Unit/Chromium·정적검사·planner/discovery. 원격exactHead Quality/E2E8/Docker·Trusted/Owner는 NOT TESTED, main/release는 범위밖.


| AC | 검증 대상과 매핑 | 현재 상태 |
| --- | --- | --- |
| AC1 | 분류 없는 공정2/구역2+0 CRUD, 실제 HTTP/SQLite 재시작, legacy 등록 요청0/Target0 | Local targeted PASS; 원격 NOT TESTED |
| AC2 | 단일 owner·동명 ID·foreign/중복/비활성/재귀속/사용중 삭제와 원자성 | Local targeted PASS; 원격 NOT TESTED |
| AC3 | additive upgrade, legacy shared/default/미매핑/비활성/hierarchy counts·FK·restart | Local targeted PASS; 원격 NOT TESTED |
| AC4 | Task/Summary self/subtree·설비 cross-process·시스템 공통/복수·direct+Target | Local targeted PASS; 원격 NOT TESTED |
| AC5 | 6개 dashboard 및 KPI/Resource canonical golden·정확 drill·고유 집계 | Local targeted PASS; 원격 NOT TESTED |
| AC6 | fresh/upgrade/restart·Project Copy·Template·JSON/Excel fail-closed·rollback | Local 보존·rollback PASS; 운영 backup/restore NOT TESTED |
| AC7 | readonly/edit/admin·Origin/session/revision 및 401/403/409/412·동시성/초안 | Local HTTP/상태 일부 PASS; 상태별 전체5폭 조합 NOT TESTED |
| AC8 | 단일 화면·용어·이름 우선·5폭·keyboard/focus/dirty/stale·매뉴얼 | Local5폭/선택interaction PASS; 모든 상태 조합 NOT TESTED |
| AC9 | 영향 회귀 선정/제외 근거·Local Pre-PR·exact Head Full Quality/E2E8/Docker | Local 선정검증 PASS; Pre-PR/원격은 아래 별도 상태 |

기존 Issue의 6-shard 표현은 등록 당시 기준이며 착수 main은 8-shard다. 최신 main의 Required3·8-shard·Trusted·Owner gate를 유지한다. local PASS는 공식 원격 PASS가 아니다.

## DOCUMENTATION_SYNC

- `docs/API.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: UPDATED
- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/ISSUE_27_PROJECT_COPY.md`: UPDATED
- `docs/IMPORT_SCHEMA.md`: UPDATED
- `docs/IMPORT_EXPORT.md`: UPDATED
- `docs/EXCEL_EXPORT.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `DESIGN.md`: N/A(기존 workspace-first·이름 우선·상황형 도움말 원칙을 구체화하며 새 범용 시각 원칙 없음)
- `AGENTS.md`: N/A(Agent·QA·권한 운영 정책은 변경하지 않고 현행 지침 적용)
- `docs/QA_REVIEW_POLICY.md`: N/A(신규 API의 기존 권한 적용 설명만 추가하며 QA 승인 정책 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 canonical PR·Required3·Owner 운영 정책 불변)
- `docs/CI_CD.md`: N/A(기존8샤드와 Required3·main·Release 실행 정책 불변; 신규 spec 명시 등록만 TEST_PLAN에 기록)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 검증 gate·권한·모니터링 정책 불변; 정확 Head CI 시작만 확인)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정·Calendar·Dependency 알고리즘과 inclusive date·Gate 계약 불변)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 keyboard·focus·modal·5폭 지침 적용이며 공통 interaction 원칙 변경 없음)


Manager가 최종 구현과 관련 API/DB/도메인/요구/UI/Task/Target/보안/Copy/Template/Import/Export/테스트/사용자 안내/CHANGELOG/PLAN을 비교해 위 파일을 갱신했다. DESIGN.md는 기존 workspace-first·이름 우선·상황형 도움말 원칙의 구체화이므로 N/A이며 새 범용 원칙을 추가하지 않는다. CI_CD/REMOTE_VALIDATION은 실행 정책 불변으로 N/A; Work Packet에서 최신8-shard·권한 경계를 명시한다. 파일별 변경/N/A와 실행 증거는 위 목록 및 아래 원장에 기록했다. 미실행 상태를 실제 PASS로 바꾸지 않는다.

## 검증 원장

신규 직접 원본은200개, 기존 공유 alias는40000개 별도 한도이며 복원도 같은 공통 검사를 적용한다. 최초 합산200개 설계는 legacy101구역×2공정 정상 관계를 차단하는 사전검토 재현으로 폐기했다. 이를 기존 데이터 유실로 기록하거나 무시하지 않고 >200alias fixture로 회귀를 검증한다. 신규 E2E는Shard3,총138spec·8shard·기존137배치불변이며 신규시간 UNMEASURED다.


- 전용 환경: infra가 Node22.14.0/npm11.10.0에서 실제 npm ci 447packages 실행 PASS. 공용 node_modules symlink 없음.
- GitHub CLI는 인증401, 연결 GitHub plugin 읽기/Issue PLAN 댓글은 성공. 인증값 출력/변경 없이 Git Data 게시 fallback을 준비한다.
- 로컬 unit/integration/browser 및 문서 정합성: 아래 각 실행과 source 범위 참조; 공식 전체 회귀와 구분.
- 원격 Quality/E2E8/Docker·Trusted/Owner: NOT TESTED. 이번 범위에서 시작만 확인한다.
- main artifact/GHCR/Release/Finalizer/운영 backup·Windows Excel/DRM/실기기: NOT TESTED, 이번 실행 범위 밖.

### 서버·교환의 로컬 검증과 최초 오류

교환 담당은 `npx vitest run --config tests/config/vitest.config.ts tests/server/templates/logistics-template-graph.test.ts tests/server/imports/project-import-parser.test.ts`에서 최종2파일61검사 PASS(3.01s)를 확인했다. v5/global legacy 공존·공정/구역 새 UUID·local subtree 동일ID·명시0개/null·SQLite reopen·손상 owner/중복/version·강제 Copy 쓰기 실패 rollback·분류/Task/설비 없는 구역 원본 및 JSON/일정Excel 차단을 포함한다. 직접200+legacy1 복원 성공, Template/Copy 직접201개의422 및 전체 rollback을 검증했다.

신규 교환 테스트 최초 실행은56PASS/2FAIL(description 필수값 누락/UUID 재발급 후 배열 정렬 비교), 후속58PASS/1FAIL(추가 Project fixture의 고정 session token 충돌)이었다. description/fresh token 및 ID 정렬 비교로 고치고 최종61검사를 실행했다. 이 테스트 harness 오류를 제품 데이터 손실 또는 원격 CI 실패로 기록하지 않는다. TypeScript UUID의 Map/Set 추론은 명시 string형으로 보완했다.

사전 읽기 전용 검토자는 기존 unique 구역102개·mapping3개에서 alias 합산 한도422를 직접 재현했다. direct200/legacy40000 분리 및 공통 restore 검증으로 보완했다. 최댓값의 [합성 실측](../../evidence/issue762/legacy-alias-boundary.json)은 unique200×mapping200=40000alias 전수 반환, JSON11778401bytes, read600.386787ms/serialize428.070965ms였다. 단일 로컬 memory 표본이며 실제 HTTP·브라우저 렌더·운영 성능 보증이 아니다. 약11.8MB의 최악 응답과 반복 metadata/선형 selector 비용은 잔여 위험이며 후속 scoped/paginated read 설계를 권장한다. 이번 변경에서 기존 유효 공유 관계를 절삭하거나 자동 변환하지 않는다.

별도 Agent의 source 사전 검토/선택 Vitest3파일31검사 PASS는 당시 source의 추가 근거다. 이를 독립 인간 QA_FINAL 영수증이나 원격 Full/Owner ACCEPT로 쓰지 않는다.

### Backend 최종 Local Fast Feedback

backend는 다음17파일230검사 PASS(9.38s), `npm run typecheck` exit0 및 소유21파일 ESLint exit0를 확인하고 코드를 freeze했다. 교환2파일61검사와 파일이 겹치지 않으며 사전 검토자의31검사는 중복 재검증이므로 합산하지 않는다.

```sh
npx vitest run --config tests/config/vitest.config.ts \
  tests/server/process-catalog/project-work-areas.test.ts \
  tests/server/process-catalog/process-context-service.test.ts \
  tests/server/process-catalog/process-catalog-service.test.ts \
  tests/server/db/database.test.ts tests/server/db/issue-623-target-migration.test.ts \
  tests/server/migration-cli.test.ts \
  tests/domain/project-work-area-ownership.test.ts \
  tests/domain/wbs-task-ledger.test.ts tests/domain/wbs-task-ledger-acceptance.test.ts \
  tests/domain/resource-target-kpi.test.ts \
  tests/server/resources/issue-733-process-configuration.test.ts \
  tests/server/resources/issue-735-system-dashboard.test.ts \
  tests/server/resources/project-resource-memberships.test.ts \
  tests/server/logistics/issue-731-kpi.test.ts \
  tests/server/logistics/logistics-targets-acceptance.test.ts \
  tests/server/logistics/task-target-bindings.test.ts \
  tests/server/projects/edit-authorization-handlers.test.ts
```

신규 server9검사·domain2검사와 기존 직접/간접 소비자를 포함한다. direct+legacy Target 혼합 fixture에서 KPI·Milestone·공정·설비·시스템·리소스 root의 총 Task/Assignment 수·공수와 각 child exact scope를 golden 기준으로 비교했다. 구역0개/반대방향 owner, 사용량/비활성·scope·owner FK·삭제·권한 실패·원자성을 확인했다.

초기 로컬 오류는 migration tail29→30 기대값, Equipment retained canonical DTO의 extra key가 strict 입력 parser로 넘어간 구현 결함, 신규 공유 fixture 중복 mapping, readonly 테스트 배열 수정 및 앞서 설명한 alias 합산 cap이었다. canonical 링크를 요청용 processId/workAreaId로 투영하고 fixture/ledger 기대값·소유 검증을 보완한 뒤 위17파일을 다시 실행했다. 최초 오류를 숨기거나 원격 CI 실패로 바꾸지 않는다. 로그는 실행 환경의 `/tmp/mastergantt-762-backend-{vitest,typecheck,eslint}.log`에 있으며 운영 자료/DB를 Git에 저장하지 않았다.

### 사전 UI 검토와 교차 Project 보완

ui_ux는 기존 workspace390/1440과 최종 areas390/768/1024/1440/1920px 이미지를 실제 열어 설계 정합 ACK를 반환했다. 사용 중 삭제 사유를 visible/aria-describedby로 제공하고 검색0결과와 미등록 상태를 구분하도록 보완했다. frontend의 해당fixture5폭 document overflow·header/body폭·td 내부 버튼 containment PASS와 결합한 한정 판정이며 모든 오류·권한·loading 상태를5폭에서 전수검증했다고 확대하지 않는다.

교차 Project 실증이 부족하다는 사전 검토 뒤 server 테스트1개를 추가했다. 별도 유효 session을 가진 두 Project에서 다른 Project 구역의 PATCH/DELETE404와 다른 Project Task의 PUT400 `WORK_AREA_OWNER_MISMATCH`, 양쪽 revision·구역·marker·관계 행 불변을 실제 Request handler/SQLite로 검증했다. 해당 server10검사·ESLint·전역typecheck PASS, 제품 source는 불변이다. 기존230개와 중복9개를 더하지 않고 신규1개만 추가하여 backend 고유231검사다.

### Frontend 최종 Local Fast Feedback

frontend는 관련 Unit11/11, 고유 Chromium6/6을 확인하고 코드 freeze했다. 구성은 신규#762 2case, 기존#725 2case, #730/733 exact legacy 원본 drill 각1case다. 마지막 direct consumer case16.6s는 전체 회귀 반복이 아니라 추가된 direct 원본 exact-ID/owner dialog·취소/원조회 focus 복귀·network 초안 잠금의 재검증이다. 앞선4case 실행(2.8분)의 신규CRUD28.7s·consumer12.3s·#73031.9s·#73323.9s 및 별도#72552.2/8.4s와 중복 case를 합산하지 않는다.

신규CRUD는 실제 HTTP·SQLite에서 분류 없는2공정/2+0구역·이름입력/code자동·변경/삭제/상태filter·Target0·기존 catalog/mapping등록요청0·readonly·Gantt instance/선택 보존·실제 서버 재시작 영속성을 확인했다. 신규consumer는 실제 Task/설비의 직접 소속 저장·Fleet수량10 보존·직접 구역 원본 편집과 복귀를 확인했다. 412/pending/반복Escape 및 network 불명확 응답은 제어 route fault로 검증한 UI 상태이며 실제 성공 HTTP·SQLite와 구분한다. 서버의 실제401/403/409/412·Project격리·원자성 검사는 별도 server suite 증거다.

5폭390/768/1024/1440/1920의 document overflow·header/body폭·버튼 cell containment PASS, workspace5+areas5의10개 PNG를 [UI 증거](../../../output/playwright/issue-762/)에 보존했다. ui_ux는5개 areas이미지와 기존workspace390/1440을 실제 확인해 설계 정합 ACK를 반환했다. 모든권한/loading/network/error/장문 조합을5폭에서 전수검증한 것은 아니다.

초기 UI실행 오류는 성공후 context갱신 동안 disabled/unmount된 trigger의 focus 복원 결함이었다. 기존 context DOM을 보존하고 현재 조회 성공/body focus일 때만 복원하도록 수정했다. 후속 실패는 status combobox accessible-name selector, helper dynamic import의 CommonJS SyntaxError, 편집기 닫기 이름 오기 등 신규 test harness를 교정했다. Code/UI를 고친 뒤 해당6개 고유case와 추가한 consumer case를 위 범위로 다시 확인했다. 실패를 timeout/retry/skip으로 우회하지 않았다.

### 최종 정적 검사와 Pre-PR 상태

모든 browser 종료 뒤 Next가 만든 `next-env.d.ts`와 `tsconfig.json` 임시 경로 변경을 정확한 baseline으로 복원했다. 이 복원 후 Manager의 `npm run typecheck` exit0, version0.130.0·Markdown300문서·diff check PASS다. 각 소유파일 ESLint와 infra planner6검사/등록·discovery PASS를 포함한다. backend231+교환61+frontend11+planner6의 고유309검사는 별도 Agent 재검증31 및 같은 case재실행을 합산하지 않은 수다.

실제 `npm run verify:prepr -- --mode=fast --base=origin/main --risk=HIGH --issue=762 --report-dir=.prepr-reports/issue762-final-fast`는 BLOCKED(exit1): sourceStable=true, selection64·UNKNOWN19·missing0. 신규 DTO/UI/간접 server/fixture/shard 경로의 자동 producer→consumer map이 미등록이므로 내부 version/typecheck/lint/전체Unit/build는 실행0/NOT TESTED다. 이 CLI의 BLOCKED를 다른 로컬 검사 PASS로 바꾸지 않는다. 직접/간접/음성 소비자 수동 선정은 TEST_PLAN 표와 위 실행으로 별도 증명한다.

동일옵션의 `--mode=targeted --dry-run`은 NOT TESTED(exit0), selection BLOCKED이며 실행 증거가 아니다. [fast 정제 결과](../../evidence/issue762/prepr-fast.json)와 [선택 정제 결과](../../evidence/issue762/prepr-selection.json)를 보존한다. CLI 보고서의 historical six-runner 안내문과 달리 실제 현재 공식 정책은8shard다. 이 이슈에서 공용선택기/검증 gate를 바꾸지 않는다. 최종 문서 증거 추가 후 runtime code는 freeze 그대로이며 문서 내용의 해시가 달라질 수 있음을 구별한다.

DOCUMENTATION_SYNC는 Manager source/계약/사용자안내 대조와 읽기 전용 사전검토 지적 보완 후 PASS다. 로컬 protected `docs_gate`는 STRUCTURAL_PASS_SEMANTIC_REVIEW_PENDING/AC MAPPING_PASS 결과이며 원격 Trusted QA·Owner 승인과 다르다. 정확 Head Quality/E2E8/Docker·Trusted/Owner ACCEPT는 NOT TESTED이며 PR CI 시작 후 결과를 기다리지 않는다.

Frontend Unit의 정확 실행은 아래3파일11검사다.

```sh
npx vitest run --config tests/config/vitest.config.ts \
  tests/features/logistics/project-workarea-options.test.ts \
  tests/features/gantt/task-process-context-model.test.ts \
  tests/features/resources/wbs-view-transport.test.ts
```

추가 초기 harness 오류는 restart fixture에 지원하지 않는 process-context 경로 인자 제공, Task 생성의 progress:0 누락(HTTP400)이었고 인자 없는 실제restart/필수입력으로 교정했다. 작성 중 nullable occurrence 표시 타입과 effect의 동기 상태변경 lint도 수정한 뒤 최종 정적 검사를 통과했다. classification_mismatch legacy의 신규 선택은 막고 기존 canonical ID/owner·선택 해제는 유지하는 unit도 위11검사에 포함한다.

### 게시 전 최신 main 정렬

infra가 게시 직전 #772/PR778의 새 main `72c2c9d0a912dc906d4101ea41a7a57e0c686597`을 발견했다. 정책·Python·Agent 지침/문서25개 변경이며 제품 runtime/API/DB는 변경0이다. #762의87개 경로 중 TEST_PLAN만 겹쳐 양쪽 신규섹션을 보존하고, 나머지86개 경로는 freeze한 구현과 byte가 동일함을 확인했다. 임시 local commit 후 rebase하여 미게시 단일 commit으로 정렬했으며 타인의 main 변경을 되돌리지 않았다.

최신 AGENTS의 #772 LOW 인증 선택 정책을 읽었다. 이 HIGH/API/DB/공용 UI 변경은 `FULL_REQUIRED` 8shard 대상이며 Owner 플래그를 변경하지 않는다. 선택E2E를Full PASS로 간주하지 않으며 기존 Required3·strictmain·Trusted/Owner·main/Release 정책을 유지한다.

정렬 후 최신 정책 회귀는 `python3 -m unittest discover -s tests/python -p 'test_ci_low_*.py'`22/22와 `python3 scripts/test_qa_preflight.py`11/11, `python3 scripts/verify-issue-lifecycle.py` PASS다. 이 Python33검사는 앞선 고유309개 Unit/통합에 합산하지 않는다. 제품 source불변이므로 앞선 local runtime/Chromium6개 결과를 해당 동일 내용 범위에서 재사용한다. 최종공식검증은 새Head/base/testmerge의 원격Full CI다.

최신base정렬 후 Pre-PR fast 실제 실행도 sourceStable=true·selection64/UNKNOWN19/missing0·BLOCKED(exit1), 내부 검사0/NOT TESTED다. targeted dry-run은 NOT TESTED(exit0)이며 자동선택 BLOCKED다. [정렬 후 fast](../../evidence/issue762/prepr-rebased-fast.json)·[정렬 후 선택](../../evidence/issue762/prepr-rebased-selection.json)을 보존하고 이전53aee48e 실행 원장도 삭제하지 않는다. 최종 문서 원장 추가만으로 runtime 검증을 반복하지 않으며 새Head 공식 Required3/Trusted는 별도다.


## PR CI F-001 Rework · #3150.1 (2026-10-22)

- 원본 Full [Run #3150.1](https://github.com/planner77/masterGantt/actions/runs/39779367052), attempt1, Head `752d1c464f8f2e7cf61b330e2bbb15c18a8dafbb`/Base `72c2c9d0a912dc906d4101ea41a7a57e0c686597`. 최초 실제 FAIL은 Shard6의 `issue-726-task-logistics.spec.ts:327`: 기존 `/A 작업구역 WA-A/` 선택기가 #762 UI에 표시된 `A 작업구역 · 기존 공유 구역 WA-A`에 불일치하는 `TEST_CONTRACT`. Shard6 36 PASS / 1 FAIL / 54 NOT RUN. 타 7 shard 취소, 로그 상 추가 E2E ✘ 미관측; Quality·Docker PASS, E2E·QA 파생 FAIL.
- **계약/교정:** 기존 shared legacy owner/UUID·read-only/source 구별을 제거하지 않고 해당 E2E의 5개 WorkArea selector를 정확한 legacy provenance와 code까지 확인하는 helper로 교체. timeout, retries, skip, workflow, backend/DB/권한, 원본 화면 코드는 불변이다.
- 상세 [Issue #762 전용 누적 실패 원장](../../ISSUE_762_FAILURE_ANALYSIS.md)에 F-001, 취소 Job IDs, 과거 #726 비교, static negative 검사, 다음 verification gate 및 잔여 위험을 보존했다.
- DOCUMENTATION_SYNC 후속: `docs/ISSUE_762_FAILURE_ANALYSIS.md` **CREATED**, 이 Work Packet **UPDATED**. `AGENTS.md`/`DESIGN.md`/`CI_CD.md`/`TEST_PLAN.md` **N/A** (기존 원칙/선정 정책 유지). 최초 테스트 문서의 AC6/7/8 검증을 약화시키지 않는다.
- 재작업 test source의 선택기 교체 5/5 및 새 label/구 label/다른 code/owner에 대한 순수 정규식 정적 검증 **PASS**. Playwright/로컬 Pre-PR/TypeScript/ESLint 및 새 PR HEAD의 공식 Full8/Required3/Trusted QA·Owner **NOT TESTED** (별도 runner 결과 필요).
- 기존 PR #779 유지. 재작업 전 unresolved thread0, inline review0, main behind0, mergeable=true. 새로운 HEAD에 대해서는 동일 gate를 다시 조회. QA·Owner ACCEPT 미확정, release_required=true/release_authorized=false, MERGE_READY=BLOCKED. 이번 승인 범위는 교정·원장·새 PR CI 시작까지이며 Main/GHCR/merge/Finalizer/Issue 종료는 제외한다.

## PR CI F-002 Rework · #3153.1 (2026-10-22)

- [Full PR CI #3153.1](https://github.com/planner77/masterGantt/actions/runs/39783686345), attempt1, Head `294a5a7136f2c56dff4796e089f6b9627e3fb381` / Base `72c2c9d0a912dc906d4101ea41a7a57e0c686597`. F-001 #726 실제 case는 Shard6에서 개별 PASS (1.0m), **Shard6 전체는 CANCELLED**. 이번 새 직접 실패는 Shard7 39PASS/1FAIL/37NOT RUN: `project-logistics-management.spec.ts:298` 테스트의 helper가 공정명 `입고 공정`의 visible `strong`과 WorkArea 버튼 `srOnly`를 동시에 찾아 strict violation. Quality/Docker SUCCESS, E2E Required/QA 파생 FAILURE, 다른7 Shards CANCELLED. 개별 Run/F-001 비교는 [#762 실패 누적 원장](../../ISSUE_762_FAILURE_ANALYSIS.md) `6 참조.
- 분류는 `TEST_CONTRACT`/교차 소비자: 공정 WorkArea 접근성 이름은 유지하고 #186 E2E 공통 표시명 helper+동일 scope 다른 공정3건/자동 공정1건을 정합화. `strong`의 exact text·visibility, 기존 IdentifierDetails code assert, Gantt instance, 영역 전환/권한 및 area 버튼의 접근 가능한 이름을 검증한다. `first()`로 중복 요소 무시·시간 증가/skip/retry·제품/DB/CI 규칙 변경 없음.
- 변경 범위: `tests/e2e/project-logistics-management.spec.ts`, 단일 실패 원장 **UPDATED**, Work Packet **UPDATED**. 기존 `TEST_PLAN`, `AGENTS.md`, `DESIGN.md`, `CI_CD.md` **N/A** (기존 규칙 재사용). 원본 F001 보존, 전체 실패 합집합 2파일(#726/신규#186), 후속 AC8/AC9 E2E 보호 범위 동일.
- 정적 내용 검증: UI `strong`/`srOnly`와 기존 duplicate locator 교차 대조, 공통1+프로세스3+신규 공정1의 5 검사 교정, 재발 위험 selector 0잔존 및 접근성 버튼 regex 보존 **PASS**. 로컬 동일 후보 source Playwright/HTTP·SQLite/TypeScript/ESLint/Pre-PR **NOT TESTED** (checkout·deps/외부 DNS 불가). 새 Head 원격 PR FULL 8-shard와 CI 정책/QA/Owner는 시작 전 **NOT TESTED**.
- 기존 PR #779 branch, 원격 main behind0/mergeable=true, unresolved review 0. 변경 후 재조회; Owner HIGH 위험 수용 및 release authorization은 별도, `MERGE_READY=BLOCKED`. CI 시작까지만 요청받았으며 모니터링/병합/Main/GHCR/Finalizer/Issue 종료 미실행.


## PR CI F-003 재개 · #3154.1 (2026-10-22)

사용자 요청은 실패 원장·관련 문서/Issue를 참조한 원인 파악·보완·미해결 리뷰/충돌 해결·실패 원장 갱신 후 새 PR CI 시작이다. 동일 branch/PR779와 원격Head `c8d1a5d1738e6ae3d40f9d310d0bcc0cc716cb04`를 fast-forward로 재개하고 앞선 F001/F002 교정을 보존했다. 현재 main/base72c2c9d0, behind0/mergeable=true/미해결thread0이며 새Head에서 재점검한다.

원본 Full3154.1/run39787884834/attempt1, Head c8d1a5d1/base72c2c9d0/testmergee2f75f49(전체SHA는 [누적 실패 원장](../../ISSUE_762_FAILURE_ANALYSIS.md)과 [원격 증거](../../evidence/issue762/rework-f003-remote.json)). Shard7의 project-logistics-management.spec.ts:550/581에서 공정추가 초안 입력 후 Escape의 dialog expected0/actual1,46PASS1FAIL30NOT RUN. 나머지7Shard 취소, Quality/Docker SUCCESS, E2E/QA 파생FAIL이다. 앞선3150/3153을 포함해 실제24Shard·90jobs의3실패/21취소를 대조했고 고유실패합집합은2파일3case다.

frontend가 수정 전 실제Chromium으로9.0s red/exit1을 재현했고, rawDOM의 초안/폐기확인dialog 및 저장요청0으로 TEST_CONTRACT를 확정했다. 제품의 dirty 보호를 없애지 않고 동일case를 clean 즉시닫기와 dirty 확인·계속편집·확인Escape·명시폐기·헤더/취소·정확focus·기존공정edit/mutation0 검증으로 보완했다. 원본단일case는3.0s green(전체5.7s)이다. `diagnosing-bugs`의 feedback loop→원본red→3가설반증→제품source불변 test보완 순서를 적용했다.

파일 소유권: frontend는 E2E source·관련 Chromium, infra는 read-only 원격3Run 전체증거/정제JSON과 최종게시, qa_docs는 read-only 소비자·diff/문서 사전 검토, Manager는 누적실패원장/WorkPacket/TEST_PLAN/PLAN을 담당한다. Sub-Agent의 Issue 댓글 쓰기는 없고 Manager가 RESUME/STATUS를 기록한다. version0.130.0/HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false 유지, 독립 인간QA N/A·Manager ACCEPT NOT TESTED다.

DOCUMENTATION_SYNC: 실패 원장/WorkPacket/TEST_PLAN/PLAN 및 정제 증거 UPDATED. API/DB_SCHEMA/SECURITY/PROJECT_UX/TASK_EDITOR/사용자매뉴얼/CHANGELOG는 N/A(제품 source·권한·소속·화면의 기존 동작 불변, 기존 초안 보호 계약을 테스트로 고정). AGENTS/DESIGN/UI_UX_GUIDELINES/CI_CD/REMOTE_VALIDATION N/A(기존 지침·8shard/Required3·QA/Owner·CI권한/실행정책 불변). 최종실행/지문은 아래에 기록하며 이전 source의309검사·6case와 새 후보를 혼합하지 않는다.

### F-003 최종 검증·문서 Gate

- [원격3Run·90Jobs·24Shards 정제 증거](../../evidence/issue762/rework-f003-remote.json): source artifact3개의digest/Head/base/testmerge/Git부모 교차 확인, 실제3FAIL/21CANCELLED, 실패합집합2파일3case. 이전F001/F002 개별case의 원격PASS와 샤드전체취소/실패를 분리한다.
- [로컬정제증거](../../evidence/issue762/rework-f003-local.json): 원본red9.0s→계약green3.0s, 첫누적19/19 PASS5.6분, 마지막 변경spec13/13 PASS43.2s. 고유20case=최종13+다른3파일불변7, 재실행/기존309Unit은합산하지 않는다. 신규 Process pending·network/412/401 보호case도 포함한다.
- 신규faulttest첫실행12PASS/1FAIL은 저장중동적버튼명의harness locator 결함이었다. 실제disabled DOM을 확인하고submit요소+정확초기/저장중문구를 검증해 교정했다. 원격최초3실패와 별도 유지한다.
- Next임시config2개를복원한후 typecheck·소유E2E ESLint·version0.130.0·Markdown303·diff PASS. discovery268unit files/795browser tests(root/external cwd) PASS. runtime/공유dialog/API/DB 변경0, CI timeout/retry/skip/Required3/8shard 변경0이다.
- Pre-PR fast 실제실행 BLOCKED/sourceStabletrue/selection66 UNKNOWN19 missing0/내부검사0, targeted dry-run NOT TESTED. 수동선정실행20PASS와혼합하지 않는다. evidence추가전 지문과 runtime source변경0 범위를 구별한다.
- #717/#730/#733 및다른모든Shard의이번local전수는 NOT TESTED. 제품/직접소비자source불변과실패합집합우선으로선정했으며 새Head Full8공식CI로인계한다. DOC_SYNC는원장·Packet·TEST_PLAN·PLAN·정제증거와소스/계약을대조해 PASS, exactHead 원격/Trusted/Owner ACCEPT는 NOT TESTED다.

## PR CI F-004/F-005 보안 감사 재작업 · #3155.1/.2/.3 (2026-10-22)

- 정확 동일 HEAD `437a505ebe7eac7f9a08f38404a95af7e259793a`, base `72c2c9d0a912dc906d4101ea41a7a57e0c686597`, Test merge `677671d94df106fe2ec6e87522d58ab44e90d4a8`, CI Run ID 39793693125. Attempt1 Quality/E2E8/Docker PASS, QA Automated `Run ID/attempt/SHA mismatch` BLOCKED. Attempt2 QA만 재실행 Automated PASS→Run SUCCESS. 그 후 독립 Trusted #799.1의 `ci-pr-source-39793693125-2` 누락으로 FAIL. 기존 Attempt1 source artifact는 있으므로 별도 공통 보호 CI 개선 후보이며 이번 PR에서 검증기 정책을 완화하지 않는다.
- Attempt3에서 새 실제 실패: Policy Job120039957384 `npm audit --omit=dev`가 `next@16.3.8` Critical 1건(`GHSA-2464-fhr4-w9xw`/ `GHSA-p3m5-59mp-jv5r`/ `GHSA-673q-mjm6-r5xr`) 검출. `npm ci`·discovery, TS, ESLint, Vitest, Preflight 성공 뒤 Policy exit1 → Fast·Quality/E2E/Docker Required3·QA Final 파생 FAIL. 실제 E2E8/Build/Docker 구현은 SKIPPED, #3155.1 PASS를 새 시도와 혼합하지 않는다. Trusted #801.1도 원본 CI 실패라 FAIL.
- 대응: 공식 Next.js 2026-10-14 보안 공지(16.4.1 patch)와 공식 `v16.4.2` 릴리스·원본 npm audit 16.4.2 권고 확인. `package.json`과 `package-lock.json`의 direct `next`·`@next/env` 및 8개 platform `@next/swc-*`를 **16.4.2 exact**로 정렬. React19.3.0, Sharp0.35.5, nested PostCSS8.5.23, ESLint-config-next16.3.4, 앱0.130.0, schema/API/UI/Gantt/CI gates 정책 변경 없음. 공개 npm lock 두 개의 일치하는 SRI/metadata로 교차 검산, 실패 원본에서 10개 새 lock entries만 변경. `npm audit fix --force` 또는 임의 예외 처리 없이 수정.
- **검증 계획**: 새 HEAD의 `npm ci`, `npm audit --omit=dev`, Next production build, Docker standalone startup/smoke, Required3 및 Chromium8/8. E2E 누적 F001 issue-726, F002/F003 project-logistics-management, #762 direct/legacy, #725 consumer, Task/설비/Project copy/template, security 401/412/readonly, Main(후속 승인) 모두 원격 검증 대상이다. 로컬 동일 source npm 설치·감사·build/Playwright는 인터넷 DNS 제한 때문에 **NOT TESTED**, metadata/lockfile 구조만 PASS. 원격 첫 새 CI는 시작 전 **NOT TESTED**.
- DOCUMENTATION_SYNC: `docs/ISSUE_762_FAILURE_ANALYSIS.md` **UPDATED**, 이 Work Packet **UPDATED**, `docs/SECURITY.md` **UPDATED**. 기존 `docs/TEST_PLAN.md`에 기록된 HIGH 전체 Chromium8 및 직접·간접·음성 범위를 그대로 사용하며 선정·QA 정책은 N/A 변경. `AGENTS.md`, `DESIGN.md`, `docs/CI_CD.md`, `docs/QA_REVIEW_POLICY.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md`, `docs/API.md`, `docs/DB_SCHEMA.md`는 기존 정책/계약 그대로: N/A. Protected `package.json`/`package-lock.json`이므로 HIGH와 기존 Owner/Trusted Gate를 유지한다. 실제 테스트/정식 릴리스 승인으로 이 기록을 대신하지 않는다.
- 기존 F001~F003 TEST_CONTRACT 보완과 로컬20개/원격 #3155.1 실제 8/8 PASS를 불변 이력으로 보존. 최신 실패는 제품 테스트 assertion이 아닌 운영 dependency risk다. 관련 git source를 업데이트한 뒤 전체 Chromium 재검증 전 mergeReady BLOCKED. 정식 `release_required=true`, `release_authorized=false`·Owner ACCEPT NOT TESTED 유지; 사용자 요청대로 새 Full PR CI를 **시작**하고 끝난 결과 모니터링·병합/Main/GHCR/Finalizer/Issue 종료는 수행하지 않는다.
