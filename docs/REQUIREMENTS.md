# Requirements baseline

## Issue #492 — Grid/Chart 작업 Hover Tooltip

Project 일정의 Grid 작업 행과 Chart Task/Summary/Milestone에 마우스를 올리면 같은 작업 정보를 Tooltip으로 제공한다. 첫 줄은 canonical 작업명, 다음 줄은 canonical 시작일·종료일이며 기존 공통 locale 날짜 formatter를 사용한다. `start/end=null`인 작업은 `—`로 표시하고 SVAR가 date-less Summary를 렌더하기 위해 사용하는 내부 anchor 날짜를 사용자 일정으로 노출하지 않는다.

Tooltip은 조회 전용이며 readonly/edit, Day/Week, fullscreen, WBS 범위 탭에서 동일 계약을 유지한다. 표시를 위해 Gantt를 remount하거나 canonical Task/Link/Calendar/revision을 변경하지 않으며 click/double-click/context menu/drag/dependency hit area를 가로채지 않는다. SVAR 공식 Tooltip API를 우선 검토하되 설치 버전에서 인수 기준을 안정적으로 충족하지 못하면 기존 Gantt DOM target 계약과 app-owned overlay를 사용한다. 상세 UX/검증은 [Project UX](PROJECT_UX.md), [UI/UX Guidelines](UI_UX_GUIDELINES.md), [Test Plan](TEST_PLAN.md)을 따른다.

## Issue #459 — Milestone Stage Gate 통합 계약

Milestone은 프로젝트 일정의 특정 시점 확인 지점이며(Stage Gate는 내부 Ready/완료 판정의 기술 개념), 기존 `type=milestone`, `duration=0` Task identity를 유지한다. WBS 계층, Milestone 소속(Membership), 일정 Dependency는 서로 다른 관계다.

- Task/Summary는 명시적 Primary Milestone을 최대 1개 가지며, 명시값이 없으면 가장 가까운 Summary의 설정을 상속한다. 하위 명시 설정은 상위 기본값을 override하고 해제는 상속 복귀다.
- Membership 변경만으로 Task/Milestone 일정, WBS, Dependency를 생성·변경하지 않는다.
- 실제 작업 실행 제약은 Task→Task Dependency로 표현한다. 서로 다른 Milestone의 member Task 사이에 Dependency가 있어도 이를 Milestone→Milestone Gate로 자동 승격·추론하지 않는다.
- 단계 Gate 제약이 필요한 경우에만 Milestone→Milestone Dependency를 명시한다. 날짜순 표시는 일정 제약이나 Dependency 생성의 근거가 아니다.
- Ready는 전체 effective member Task의 canonical 완료와 직접 선행 Milestone 완료에서 파생하며 Completed와 구분한다. 완료는 자동 전환하지 않고 사용자가 명시하며, Milestone의 소속/Dependency 구조를 바꾸려면 먼저 재개한다.
- Dashboard/물류/Resource/필터가 일부 Task만 보여도 Ready와 단계 전체 진척은 full canonical membership 기준이다. 공수는 기존 일반 Task 개인 assignment를 단계 차원으로만 분류하고 Summary/Milestone/group을 중복 산입하지 않는다.
- JSON/Excel/Copy/Template는 explicit membership을 보존하고 effective/Ready는 서버 파생 projection으로 유지한다.

구현은 #460~#464에 분리되어 있으며 상세 도메인·경로 inventory는 [Milestone Stage Gates](MILESTONE_STAGE_GATES.md), UI는 [Project UX](PROJECT_UX.md)/[Task Editor](TASK_EDITOR.md), 검증은 [Test Plan](TEST_PLAN.md)을 따른다.

## Issue #460 — Milestone 소속과 Milestone Gate

기존 Milestone identity에 Task/Summary 단일 명시 소속과 가장 가까운 Summary 상속을 추가한다. Ready는 duration 가중 작업 진척 및 canonical 완료 상태/직접 선행 Milestone 조건과 구분하고 자동 완료하지 않는다. Milestone의 명시·상속 소속 및 Dependency 구조는 서버 transaction에서 잠근다. Summary는 name/Membership 원자 PATCH만 확장하고 일정 readonly를 유지한다. 신규 mixed Dependency는 거부하며 기존 mixed는 조회·일정·무관 편집·endpoint 불변 수정에서 보존한다. Issue #464에서 전체 Copy/Template/subtree의 명시 row와 상속 의미를 보존하고 Excel 단계 보고 및 JSON1.1 보호 Import/Export를 연결한다. 미지원·완료 경계는 fail-closed로 전체 거부한다. 상세 계약과 경로 inventory는 [MILESTONE_STAGE_GATES](MILESTONE_STAGE_GATES.md)를 따른다.


## Issue #464 — 단계 데이터 보존과 교환

전체 Project Copy와 Template은 모든 explicit membership FK를 새 Task UUID로 remap하고 source를 변경하지 않는다. Template은 이전 snapshot membership omission을 호환하며 leaf/M progress0/not_started를 유지한다. subtree/multi-root Copy는 외부 explicit 제외와 외부 상속/새 destination effective 변화에 사용자 확인을 요구한다. 내부 완전 remap에는 제외 확인이 필요하지 않다. Completed Milestone 복사본은 전체 E/explicit source/incident Dependency endpoint와 역매핑 동일성이 유지되어야 하며 ack로 우회할 수 없다. 기존 Copy Assignment·5000 Task 상한,404/revision/구조 잠금과 원본 Baseline 불변·복사본 Baseline 초기화는 유지한다. Cut은 기존 identity와 row를 이동하고 상속 변화를 재파생한다.

JSON1.1은 taskExternalId/milestoneExternalId 명시 membership, requestedStart/status/description/URL/leaf Baseline와 정보용 source metadata를 제공한다. Summary/Ready/effective/KPI는 서버 파생이며 입력으로 받지 않는다. JSON1.0 순수 validator와 machine schema는 유지한다. Export는 빈 Project와 기존 mixed Link를 모두 표현하지만 새 Import의 mixed는 전체 거부한다. Import는 target Calendar authority, create-only·전체 rollback·새 UUID·revision+1·Origin/session/preview digest/strong revision 재검증을 요구한다. 파일5 MiB/JSON syntax depth64/Task5000/Link20000 및 UTF-8/decoded duplicate key/multipart 전체 검증은 서버에서 수행한다. Resource/물류/권한 데이터와 새 Direct Hyperlink는 이번 교환 범위 밖이다.

Excel은 현재 Dashboard filter와 별개인 full Project 기본 Stage DTO를 같은 SQLite read snapshot/revision/catalog/clock에서 받아 원시 E/P·Ready/KPI·공수와 null/M/M 기준을 보고한다. explicit/effective/inherited source 식별자는 Dependency 옵션과 독립해 Tasks에 표시하고 대량 UUID는 하나씩 행으로 기록한다. 기존 cell32767/Stage50000행 한도를 넘으면 전체 거부하며 생략/절삭하지 않는다. workbook은 JSON schedule-stage 파일이나 DB 전체 백업과 구분한다. 상세 [Import 계약](IMPORT_SCHEMA.md), [Excel](EXCEL_EXPORT.md), [API](API.md), [보안](SECURITY.md), [검증](TEST_PLAN.md)을 따른다.


## Issue #430 — Cut/Reparent Dependency 경계 정책

- 단일 Cut source는 선택 Task/Summary와 전체 descendants의 canonical subtree를 이동 집합으로 사용한다. subtree 내부에서 predecessor와 successor가 모두 포함된 Dependency는 Cut을 막지 않으며 Cut → Paste/reparent 후 기존 Link ID, endpoint, type, signed lag/lead를 그대로 유지한다.
- source subtree 경계를 넘는 incoming 또는 outgoing Dependency가 하나라도 있으면 Context Menu Cut, Ctrl/Cmd+X, cut clipboard Paste와 서버 reparent를 동일하게 제한한다. 판정은 Link 양 endpoint의 subtree 포함 여부 XOR로 정의한다.
- Paste anchor가 별도의 Dependency endpoint라는 사실만으로 before/after Paste를 막지 않는다. 다만 `child` Paste가 linked leaf anchor를 Summary로 전환해야 하는 경우 기존 보호를 유지한다.
- Cut은 계속 단일 target이며 viewRoot, self/descendant, scoped-view 탈출, cycle, cross-Project, edit session/Origin/If-Match/revision 보호를 유지한다. Delete/Convert/Indent/Outdent의 기존 Dependency guard와 #378/#384 Copy 정책은 변경하지 않는다.
- UI의 enabled/disabled, keyboard shortcut과 서버 mutation은 동일 boundary 의미를 사용한다. [UX](PROJECT_UX.md), [API](API.md), [Relations](TASK_RELATIONS.md), [Test Plan](TEST_PLAN.md)을 따른다.

## Issue #384 — 다중 선택 Copy/Paste

앱 소유 선택 집합을 canonical WBS 순서와 선택 ancestor 규칙으로 정규화하여 여러 root·전체 자손을 한 번씩 복사한다. Copy 집합 내부 Dependency만 새 Task/Link identity로 함께 복제하며 외부 관계는 제외한다. Root block의 before/after/child 삽입·Scheduling·Summary·revision +1은 하나의 원자적 명령이다. 기존 단일 taskId Copy는 호환하고 신규 taskIds를 지원한다.

선택 checkbox·Ctrl/Cmd·Shift·Context Menu·keyboard Copy는 같은 집합을 사용한다. scoped view/필터 변경은 selection을 정리하고 clipboard를 폐기하며, collapse는 선택을 유지한다. 다중 Cut/Delete/Edit/Move·cross-Project·Resource/Logistics 복제 확대는 제외한다. 기존 copied Baseline null 초기화·원본 불변, 빈 Summary null, session/Origin/If-Match/Project 격리와 Assignment 전체 거부를 유지한다. [실행 계획](exec-plans/active/ISSUE_384.md)과 [API](API.md)를 따른다.

## Issue #329 — 미사용 Resource / Resource Group 안전 삭제

- Resource Catalog 관리자는 어떤 Project에도 참조되지 않은 Resource와 Resource Group만 영구 삭제할 수 있다.
- Resource usage는 Task assignment, 설비 담당 역할, 시스템 PI/Developer 역할, Resource Calendar를 모두 포함하며 Group usage는 Task group assignment와 Group Calendar를 포함한다.
- Group membership은 Project usage로 보지 않으며 안전 삭제 시 membership row만 원자적으로 정리한다. Resource 삭제가 Group을, Group 삭제가 Resource를 삭제해서는 안 된다.
- Catalog 조회의 삭제 가능 상태는 UX 힌트이며 서버 DELETE는 관리자 session, Origin, catalog `If-Match`와 최신 Project usage를 같은 transaction에서 다시 검증한다.
- 사용 중 항목은 구조화된 409로 거부하고 실패 시 대상/membership/catalog revision에 부분 변경이 없어야 한다.


## Issue #378 — Subtree Copy 내부 Dependency 복제

- Task 또는 Summary subtree Copy 집합 안에 predecessor와 successor가 모두 포함된 Dependency Link는 새 Task ID에 맞춰 복제한다.
- 복사 집합 경계를 넘는 외부→내부, 내부→외부 Link는 기본적으로 복제하지 않아 원본 주변 일정과 복사본을 암묵적으로 결합하지 않는다.
- 복제 Link는 새 ID를 사용하고 type(FS/SS/FF/SF)과 signed lag/lead를 보존한다.
- copied leaf는 requestedStart/duration/scheduleMode를 보존하고 Project Calendar + 기존 Dependency engine으로 effective schedule을 다시 계산한다. 원본 effective date를 requestedStart로 사용하지 않는다.
- Task/Link 생성, dependency 재계산, Summary 파생, revision +1은 하나의 서버 transaction이다. 실패 시 부분 Task/Link를 남기지 않는다.
- linked Task의 Copy 및 copy-clipboard의 before/after Paste를 허용하고, #335부터 linked Task/subtree의 **same-parent sibling reorder**(Context Move Up/Down, Grid before/after)도 허용한다. #430부터 다른 parent로 가는 단일 Cut-Paste/reparent는 **source subtree 내부 Dependency만 존재할 때 허용**하고 경계를 넘는 incoming/outgoing Link가 있으면 제한한다. Indent/Outdent/Delete/Convert와 linked leaf anchor의 child Paste 보호는 유지한다. Resource assignment copy 정책은 별도 범위다.


> **Issue #8 전송 정책:** production 기본값은 HTTPS다. `ALLOW_INSECURE_HTTP=true`와 canonical HTTP `APP_BASE_URL`을 함께 설정한 내부망은 production HTTP도 지원한다. 시작·readiness·공유 URL·모든 인증 경로는 같은 정책을 사용한다. `SESSION_COOKIE_SECURE`는 미사용 예약값이며 제거했다. HTTP에서는 `mastergantt_edit`, HTTPS production에서는 `__Host-mastergantt_edit; Secure`를 사용하고 HttpOnly·SameSite=Strict·Path=/·TTL 및 Domain 미설정을 유지한다. 아래 과거 검증 이력의 HTTPS-only 표현은 당시 기준이다. 현재 운영·전환 절차는 [HTTP_OPERATION](HTTP_OPERATION.md)을 따른다.


상태: 요구사항 기준선, 2026-09-14 UX 변경 포함. W01–W07, W20–W22의 구현 상태는 [실행 계획](exec-plans/active/PLAN.md)과 개별 검증 기록을 함께 본다. W22 main/PR/release Actions, commit/release digest의 원격·로컬 smoke와 SBOM/provenance 조회는 PASS했다. D05는 현재 private 요금제의 ruleset 미강제 위험 수용과 GitHub Artifact Attestation 비활성으로 결정됐다. 최상위 근거는 사용자 지침과 [AGENTS.md](../AGENTS.md)다.

Issue #9/#10/#11/#18/#21의 현재 UX·API 사용 경계·보충 테스트 계획은 [PROJECT_UX.md](PROJECT_UX.md)를 따른다. 과거 W24의 권한 기반 삭제 버튼 표시와 부모 전환 확인 창은 아래 R31/R32로 대체한다. 이번 변경의 원격 검증은 PR #23의 최종 head/run 기준이며 과거 Wxx PASS를 전용하지 않는다.

## Confirmed

| ID | 요구사항 | 상세 계약 / 검증 |
| --- | --- | --- |
| R01 | Project 생성: name, description, edit password | [API](API.md), [DB](DB_SCHEMA.md) |
| R02 | 내부 PK와 안정적인 public ID 분리; `/projects/{publicId}` | API, DB |
| R03 | Direct access 기본 Readonly; password 인증 후 Edit | [Security](SECURITY.md) |
| R04 | 검증된 password derivation; 원문 password/secret 저장·로그·URL 금지 | Security |
| R05 | 모든 기존 Project mutation에서 server-side project edit session 검증 | API, Security |
| R06 | SVAR React Gantt Core와 공식 API 우선, 구현 전 현재 공식 자료 확인 | [Research](RESEARCH.md), [기능 Matrix](PRO_FEATURE_MATRIX.md) |
| R07 | PRO 비공개 구현 복제 금지; 독립 Scheduling Domain | [Scheduling](SCHEDULING_ENGINE.md) |
| R08 | Calendar, weekend, holiday, duration, summary, dependency 재계산, WBS | 초기 W06/W07/W08/W09 단계 표기는 역사 기록. 현재 FS/SS/FF/SF 및 lag/lead와 연결 Task 변경 재계산은 [Scheduling](SCHEDULING_ENGINE.md), [API](API.md), #200/#202/#258 기준 |
| R09 | SS/FF/SF 및 lag/lead는 #200/#202 지원, Baseline 필드와 연결 Task 복사는 #258 지원. CPM/slack, grouping/resource leveling, rollup/split는 후속 검토 | [기능 Matrix](PRO_FEATURE_MATRIX.md) |
| R10 | SQLite, Prisma 금지, better-sqlite3 우선; Route→Service→Repository→DB | [Architecture](ARCHITECTURE.md), DB |
| R11 | SQL migration, parameter binding, FK와 index, 실제 DB Git 제외 | DB |
| R12 | DRM 우회 금지, 원본 Workbook 직접 웹 업로드·clipboard 가능 가정 금지 | [VBA](VBA_EXPORT.md) |
| R13 | 승인된 Excel/VBA→필요 데이터만→JSON 우선, CSV fallback | VBA, [Import Schema](IMPORT_SCHEMA.md) |
| R14 | 실제 Excel/VBA POC를 전체 Import 구현보다 먼저 수행; PASS/FAIL/BLOCKED/UNKNOWN | VBA |
| R15 | Header name mapping, stable externalId, parent/dependency, 날짜·진척·한글 정규화, 오류 행 보고 | VBA, Import Schema |
| R16 | `schemaVersion`; Backend/Excel 공동 계약, Manager 최종 책임 | Import Schema |
| R17 | Parsing→Validation→Preview→Mapping→Business validation→Import; 서버 재검증과 원자적 저장 | [Import/Export](IMPORT_EXPORT.md), API |
| R18 | Web XLSX export는 Backend, ExcelJS 우선 검토, PRO export 비의존 | Import/Export |
| R18a | Gantt SVG/PNG 내보내기는 canonical snapshot으로 전체 Grid+Chart 또는 지정 기간 Chart만 생성한다. 기간은 작업 필터가 아니며 SVG/PNG는 동일 geometry를 사용한다. | [IMAGE_EXPORT](IMAGE_EXPORT.md), API, Project UX |
| R19 | Phase 1 Project/Tasks/Dependencies sheet와 APP_BASE_URL 기반 직접 hyperlink | Import/Export |
| R20 | Phase 2 날짜 cell 기반 별도 Gantt sheet; Phase 1 안정화 후 | Import/Export |
| R21 | Dockerfile/compose/.dockerignore/.env.example, 단일 instance, 영속 volume | [Deployment](DEPLOYMENT.md) |
| R22 | Native compatibility, health, permission, restart persistence 검증 | Deployment, [Test Plan](TEST_PLAN.md) |
| R23 | Root Manager 통합, 전문 Agent 필요 시 위임, 소유 파일 분리, 독립 QA | [실행 계획](exec-plans/active/PLAN.md) |
| R24 | 구현별 build/typecheck/tests/security/persistence/docs/QA/Manager review | Test Plan |
| R25 | Project List/Create/Gantt/Unlock/Import/Export UI, 명확한 loading/error 상태 | Architecture, API |
| R26 | 반복 build/typecheck/lint/unit·integration/browser/container 검증을 GitHub Actions로 자동화 | [CI/CD](CI_CD.md), [Test Plan](TEST_PLAN.md) |
| R27 | `package.json` 기준 Semantic Version과 일치하는 Git tag에서만 GHCR image 게시; exact version/digest로 테스트 가능 | CI/CD, [Deployment](DEPLOYMENT.md) |
| R28 | PR read-only, publish 최소 권한, Action SHA/base digest pin, pre-publish candidate, SBOM/provenance와 registry digest smoke 뒤 exact promotion | CI/CD, [Security](SECURITY.md) |
| R29 | Project 화면은 Demo 목록 없이 좌측 계층 Task Grid와 우측 동기 Gantt Chart를 단일 SVAR Core로 표시; 빈 일정과 생성 직후에도 양쪽을 유지하고 Desktop viewport 폭·높이를 활용하며 좁은 화면은 내부 scroll로 접근 | [Architecture](ARCHITECTURE.md), [Test Plan](TEST_PLAN.md) UI03–UI10 |
| R30 | 모든 품질 gate를 통과한 `main` commit은 임시 GHCR `ci-<full SHA>` image를 게시해 exact digest로 image policy, readiness, Project/Task authorization 저장과 restart persistence를 검증한 뒤 package version을 삭제한다. Semantic release는 registry `sha-*` candidate를 만들지 않고 local candidate PASS 후 exact SemVer를 직접 게시·검증하며 stable release만 exact/rolling tag로 보관한다. | [CI/CD](CI_CD.md), [Deployment](DEPLOYMENT.md), [Test Plan](TEST_PLAN.md) CI09–CI10 |
| R31 | Project 목록은 표/Grid이며 삭제 버튼은 항상 표시한다. 클릭 뒤 새 비밀번호 검증이 성공한 경우에만 기존 보호 DELETE를 호출한다 (#10). | 기존 유효 세션만으로 입력 절차를 생략하지 않는다. 최신 이름/revision 경고, If-Match·Origin·session과 종속 일정·session 원자 삭제 유지. [UX 계약](PROJECT_UX.md) |
| R32 | SVAR Grid Header `+`는 최상위, 행 `+`는 선택 행의 하위 작업 추가. 이름을 묻지 않고 `새 작업`으로 서버 인증·revision 검증 후 저장한다. 첫 하위 추가의 Summary 전환 확인 팝업도 생략한다 (#11). | 일반 leaf에는 `convertParentToSummary: true` 명시, Milestone 금지·서버 원자 검증·상위 집계 유지. [UX 계약](PROJECT_UX.md) |
| R33 | 외부 ID column 표시/숨김 선택, 작업 생성 시 시작일·기간을 묻지 않고 제출 시 오늘·1일 자동 적용, Chart 토/일 구분 | 오늘은 브라우저 local 날짜, Auto 근무일 보정 유지; Milestone은 기존 0일 계약. 후속 검증은 PENDING_TESTS.md |
| R34 | 날짜·시간 표시는 사용자 locale을 따르며 저장 date-only/UTC instant 계약은 변경하지 않음 | locale/TZ 경계 테스트; 날짜 문자열을 UTC instant로 파싱해 전날로 표시하지 않음 |
| R35 | Project 설정은 헤더 버튼으로 여는 별도 modal이다. 프로젝트명 아래 Revision/시간대/휴일/작업/연결 및 펼침 설정을 표시하지 않는다 (#9). | 기존 정보 저장·비밀번호 변경·편집 종료 유지. Project 및 Grid/Chart header와 내부 scroll, 설정 열기/닫기 geometry·인스턴스 검증 |
| R36 | Grid/Chart 상단의 별도 ‘작업 추가 또는 삭제’ 패널 제거; 생성은 native Grid `+` 사용 | 기존 패널의 Task 삭제 UI도 제거, 서버 삭제 API와 Project 목록 삭제는 유지. 후속 검증은 PENDING_TESTS.md |
| R37 | Grid Column Header 우클릭에서 표시할 데이터 열 선택; 외부 ID 기본 숨김, 별도 토글 버튼 제거 | 작업/외부 ID/시작/기간 대상, 마지막 데이터 열은 유지. `+`는 권한 기반 action. 선택은 workspace 내 유지하며 reload 시 기본값 |
| R38 | 정상 작업 추가의 대기·성공 동안 동일 Gantt 인스턴스와 기존 화면 상태 유지; 문서 navigation/전체 loading 및 action 열 너비 변화 방지 | [Issue #3](ISSUE_3_REVIEW.md). 서버 canonical snapshot·중복 요청 차단·명시적 오류 복구 유지; 성공 알림은 focus를 빼앗지 않음 |
| R39 | 정상 안내는 일시적 overlay Toast, 오류는 우측 상단 미확인 표시와 별도 복사 가능한 알림함으로 분리한다 (#18). | 오류는 성공/Toast 타이머로 삭제하지 않음. 공간·scroll·focus·Gantt 유지, locale 시각, 안전한 metadata만 허용. [UX 계약·보충 테스트 계획](PROJECT_UX.md) |
| R40 | 목록 각 행과 상세 헤더에서 Readonly도 프로젝트 링크를 복사할 수 있다 (#21). | 검증한 APP_BASE_URL과 publicId 기반 절대 URL. 이름 변경 후 유지, query/hash/secret 제외, 같은 세션 권한 유지/새 세션 Readonly, mutation 없음 |
| R41 | Clipboard 성공 확인 후에만 성공 안내를 한다. secure context에서 modern Clipboard API가 있으면 그 결과를 우선하고, API 자체가 없거나 insecure HTTP이면 같은 사용자 동작에서 legacy copy 호환 경로를 시도한다 (#18/#21/#364). | modern API의 명시적 권한 거부/reject는 legacy로 우회하지 않으며, 두 경로 실패 시 선택 가능한 읽기 전용 내용과 수동 복사/재시도를 제공한다. 앱은 clipboard 읽기 권한을 요청하지 않음. 오류·fallback·키보드·좁은 화면 검증. [UX 계약](PROJECT_UX.md) |
| R42 | Grid와 Chart의 실제 작업 우클릭 메뉴에 `작업 삭제`를 제공한다 (#31). 하위 작업이 있으면 선택 작업+모든 깊이의 자손 수와 총 삭제 수를 보여주고 명시적 확인 후에만 원자적으로 삭제한다. | 취소 전 DELETE 0회, server persisted hierarchy 재계산, edit session/Origin/If-Match 유지, `includeDescendants=true`, revision 1회 증가. 선택 범위 밖 Summary가 비어도 유지하며(#345), Link 보호는 유지한다. [Issue #31 당시 기록](ISSUE_31_REVIEW.md) |
| R43 | Project 작업 캘린더는 KR/CN/VN/PH/TH/MX/US 국가 규칙을 전체 또는 기간별로 적용하고 Project Custom 휴무와 Resource Group/Resource의 근무·휴무 날짜 예외를 관리한다 (#57/#261). 신규 Project 기본은 KR/FULL_PROJECT, 기존 Project migration은 국가 규칙을 자동 추가하지 않는다. | [Issue #57](ISSUE_57_WORK_CALENDAR.md), [API](API.md), [DB](DB_SCHEMA.md) |
| R45 | Project 목록은 Desktop/Wide에서 일반 Form보다 넓은 가용 폭을 사용하고, 프로젝트명 Link를 primary navigation으로 유지하며 행 command를 accessible overflow menu로 제공한다 (#75). | native table semantics, Link/Button 의미, keyboard/Escape/focus 복귀, 390/768/1024/1440 반응형, 기존 copy/delete 보안 계약 유지. [UX 계약](PROJECT_UX.md) |
| R46 | Task Editor는 작업 정보·리소스·관계·물류 연결 탭으로 정보를 분리하고 body-only scroll, 고정 Footer, keyboard tab navigation, 390/768/1024/1440 반응형을 제공한다 (#74/#187). 관계 탭은 #377부터 편집 가능한 Task/Milestone의 관계 추가·편집·삭제 진입점을 제공한다. | 기존 Task PATCH/revision/권한/dirty/stale, Assignment/물류 저장과 Link API 계약을 유지하며 탭 전환 자체는 mutation을 발생시키지 않는다. Task draft dirty/stale/readonly에서는 relation mutation을 fail-closed한다. [Task Editor](TASK_EDITOR.md), [Relations](TASK_RELATIONS.md), [Test Plan](TEST_PLAN.md) |
| R44 | Calendar 계산은 `Base weekly rule + WORKING/NON_WORKING date exception`을 사용한다. Project Task 일정에는 Project target만, #56 Resource workload에는 Project < Resource Group < Resource 순서로 명시적 WORKING/NON_WORKING 예외를 적용한다 (#261). 같은 계층의 동일 유형은 중복 계산하지 않고 반대 유형은 Calendar 저장과 그룹 구성원 변경에서 원자 거부한다. 상위 결과와 같은 예외는 NO_EFFECT 경고와 함께 저장 가능하며 Task 일정은 바꾸지 않는다. Preview/저장은 edit session+Origin+If-Match를 요구하며 Manual conflict/날짜 충돌은 전체 원자 거부한다. | [Scheduling](SCHEDULING_ENGINE.md), [Test Plan](TEST_PLAN.md) |
| R47 | Project status는 `planned / in_progress / completed`로 저장·조회·편집한다 (#138). 기존 Project는 `in_progress`, 신규 Project와 복사본은 `planned`이며 목록의 기본 보기에서는 완료를 제외한다. | [API](API.md), [DB](DB_SCHEMA.md), [UX 계약](PROJECT_UX.md). 상태 변경에도 edit session·Origin·If-Match와 canonical snapshot/revision 계약을 유지한다. |
| R48 | Grid의 작업명 열에서 편집 가능한 Summary/Task/Milestone 이름을 한 번 클릭해 인라인 편집한다 (#140). Enter·blur는 저장, Escape는 취소하며 서버 canonical 결과로 Grid·Chart·Task Editor 표시를 일치시킨다. | 기존 Task PATCH의 세션·Origin·If-Match·revision·이름 검증을 유지하며 연결 endpoint 이름 제한은 #258에서 해제한다. Summary는 Grid name-only 예외이고 Task Editor의 Summary readonly는 유지한다. [UX 계약](PROJECT_UX.md), [Task Editor](TASK_EDITOR.md), [Test Plan](TEST_PLAN.md) |
| R49 | Project List와 편집 중 Project Workspace에서 Project 상태를 별도 설정 화면 이동 없이 직접 변경할 수 있다 (#177). | 기존 `planned / in_progress / completed` 값과 edit session·Origin·strong `If-Match`·revision+1·canonical snapshot 계약을 재사용한다. List는 세션이 없으면 기존 편집 비밀번호 인증을 수행하고 성공 직후 client-side filter를 재평가한다. Workspace readonly는 표시 전용이며 edit header 변경은 Gantt remount/navigation을 유발하지 않는다. [UX 계약](PROJECT_UX.md), [Test Plan](TEST_PLAN.md) |
| R50 | 프로젝트 재진입 시 Gantt Grid의 Summary 접힘/펼침 상태를 브라우저 localStorage에 프로젝트별로 저장·복원한다 (#201). | v1 스키마, stale ID 로드 시 정규화 저장, Quota/Security 예외 graceful fallback, 동일 브라우저 프로필 복원, DB/API/Revision 불변. [UX 계약](PROJECT_UX.md) |
| R51 | 일반 Task Editor는 요청 시작일·기간(근무일)·요청 종료일을 함께 제공하고 기간↔요청 종료일을 Project Effective Calendar 기준으로 양방향 계산한다 (#368). | requestedEnd는 UI-only draft이며 canonical 저장은 기존 `requestedStart + duration`을 유지한다. Auto 비근무 시작 보정, Manual/비근무 종료 오류, Dependency 적용 뒤 서버 확정 일정 분리, Summary/Milestone 계약 유지. [Task Editor](TASK_EDITOR.md), [Scheduling](SCHEDULING_ENGINE.md), [Test Plan](TEST_PLAN.md) |
| R52 | 하위 작업이 있는 Summary의 Context Menu에서 `최상위로 열기`를 선택하면 새 browser context를 만들지 않고 현재 Project 일정 Workspace의 WBS 범위 탭으로 선택 Summary와 모든 자손만 표시한다 (#373/#399). `전체 프로젝트` 탭은 고정하고 동일 Summary 재진입은 중복 탭 없이 기존 탭을 활성화한다. | `rootTask` deep link/reload/direct-entry와 client-side `filter-tasks`를 유지하며 범위 탭마다 별도 Gantt를 만들지 않는다. canonical snapshot/Dependency/Resource·Logistics와 edit session·Origin·If-Match·revision 계약을 유지한다. 빈 Summary root는 유지하고 삭제/type 변경 root는 invalid 상태·복귀 경로를 제공하며 실제 다른 browser tab의 higher revision은 canonical GET으로 동기화한다. [UX 계약](PROJECT_UX.md), [Test Plan](TEST_PLAN.md) |
| R53 | Grid/Chart 작업 Context Menu의 `Copy ID`는 선택 Task/Summary/Milestone의 canonical `taskId`를 OS clipboard에 복사한다 (#390). | readonly·mutation lock·Dependency 연결 여부와 무관한 조회성 action이며 기존 단일/다중 Task `Copy/Paste` clipboard·선택 집합과 Project revision을 변경하지 않는다. #364 공통 clipboard 호환 경로를 사용하고 실제 자동 복사 성공 후에만 성공 안내하며 권한 거부/자동 복사 실패 시 수동 복사·재시도를 제공한다. [UX 계약](PROJECT_UX.md), [Test Plan](TEST_PLAN.md) |
| R54 | Dependency Link가 연결된 Task/Milestone 또는 linked descendant를 가진 subtree는 **parent를 바꾸지 않는 sibling reorder**를 수행할 수 있다 (#335). #430부터 단일 Cut-Paste/reparent는 source subtree 내부 관계만 있을 때 parent 변경도 허용한다. | Context Move Up/Down 및 Grid same-parent before/after는 Link 여부와 무관하다. Cross-parent Cut-Paste/reparent는 source subtree 경계를 넘는 Dependency가 없을 때만 허용하며 내부 Link ID/endpoints/type/lag를 보존한다. Boundary Link, linked leaf anchor child 전환, Indent/Outdent/Delete/Convert 보호는 유지한다. [UX 계약](PROJECT_UX.md), [API](API.md), [Relations](TASK_RELATIONS.md), [Test Plan](TEST_PLAN.md) |
| R55 | Relation Editor의 관계 추가 후보 검색은 작업명, 외부 ID(`externalId`), 작업 ID(`taskId`)를 모두 지원하고 두 식별자를 명시적으로 구분한다 (#409). | #390 `Copy ID`의 canonical taskId를 그대로 검색할 수 있으며 후보 선택 뒤 실제 Link mutation은 기존 externalId endpoint 계약을 유지한다. Summary/self/already-connected 제외, readonly/dirty/pending/focus 계약은 불변이다. [Relations](TASK_RELATIONS.md), [UX 계약](PROJECT_UX.md), [Test Plan](TEST_PLAN.md) |

R05의 Project 생성은 아직 해당 Project/session이 없으므로 선행 edit session을 요구할 수 없다. 생성에 별도의 same-origin·rate-limit 경계를 적용하고 생성 Project의 session만 발급하는 것은 요구 충돌이 아닌 bootstrap 예외다.

W24의 하위 추가는 일반 Task→Summary 전환에 `convertParentToSummary: true`를 요구한다. Milestone에는 하위를 추가하지 않는다. 당시의 빈 Summary 금지·마지막 child 삭제 거부 정책은 #345의 정식 WBS 컨테이너 계약으로 대체한다. Summary 자체의 drag/resize와 Dependency 보호는 유지한다. #31의 자손을 가진 작업 삭제는 `includeDescendants=true`와 사용자 확인을 요구한다. 일반 하위 Leaf 변경과 subtree 삭제 뒤 살아남은 조상 Summary는 다시 계산하며 집계할 Leaf가 없으면 미산정 Summary로 남는다. #11은 첫 child 추가의 UI 확인 단계를 생략하되 서버의 명시적 부모 전환 계약을 유지한다.

## Issue #345 — Summary 구조와 일정 상태 분리

빈 Summary와 빈 Summary만 중첩된 구조는 유효하다. Root·중첩 Summary를 이름·위치만으로 생성하며 첫 일정 있는 Task/Milestone 추가와 마지막 Leaf 삭제·이동에서 부모의 ID·유형·연결을 보존한다. 일정이 있는 자손이 없으면 auto Summary의 requestedStart/start/end/duration/progress는 모두 null이며, 가짜 날짜나 0일/완료 상태로 대체하지 않는다. 빈 컨테이너는 조상의 일정·가중 진척·Baseline 집계에 기여하지 않고 WBS 계산에는 정상 참여한다.

Grid/Editor는 미산정 값을 `—`로 표시하고 Chart 행을 유지하면서 현재 일정 bar를 그리지 않는다. 검색·필터·접기만으로 실제 구조/집계 상태를 바꾸지 않는다. Resource/Group·물류 self/subtree 연결과 후속 child 상속을 유지하며 copy/template·Import 계약·Excel/SVG/PNG Export의 null 처리도 정합화한다. 일반 Task/Milestone과 Dependency·보안·revision 필수 검증을 완화하지 않는다. #344의 이전 확정 mutation 보존은 별도의 유효한 거부 조건에서 계속 검사한다.

구현 단계·실제 검증 및 Import 범위 결정은 [Issue #345 계획](exec-plans/active/ISSUE_345.md)을 따른다. 과거 empty-summary 거부의 실행 기록은 당시 사실로 보존한다.

## Issue #373 / #399 — Summary 하위 WBS Workspace scoped view

하위 작업이 있는 Summary에는 조회/navigation 명령 `최상위로 열기`를 제공한다. #399부터 이 명령은 새 browser tab/window를 만들지 않고 현재 Project의 일정 View 내부 WBS 범위 탭을 생성·활성화한다. 범위 탭은 `[전체 프로젝트] [Summary A ×] [Summary B ×]` 구조이며 전체 프로젝트는 고정/비삭제, 동일 Summary 재진입은 중복 생성 없이 기존 탭 활성화, Summary 탭 닫기는 인접 탭→전체 프로젝트 순으로 복귀한다. scoped view의 visible set은 선택 Summary 자신과 모든 depth의 자손이고 ancestor, sibling, 다른 root branch는 숨긴다. 검색·고급 필터·Task/Milestone 빠른 보기는 해당 scope 안에서만 적용하며 초기화해도 자동으로 전체 Project로 범위가 확장되지 않는다.

기존 `/projects/{publicId}?rootTask={taskId}` URL은 **새 browser tab을 생성하는 명령 계약이 아니라** 공유·reload·직접 진입용 deep link 계약으로 유지한다. 내부 범위 탭 전환은 full navigation 없이 `rootTask`를 replace semantics로 동기화하고, 직접 deep link로 진입하면 전체 프로젝트 탭과 해당 Summary 탭을 구성해 Summary scope를 활성화한다. 열린 범위 탭 집합 전체는 persistence하지 않으며 reload 후 URL의 active scope만 복원한다.

scope는 authorization 또는 별도 aggregate가 아니다. client는 전체 Project canonical snapshot과 links/assignments/logistics를 계속 보유한다. 선택 Summary의 canonical parent는 유지하되 SVAR 표시 adapter에서만 해당 Task의 parent를 root(0)로 투영한다. 기존 mutation API, edit session, Origin, strong If-Match와 Project revision을 사용한다. 따라서 scope 밖 endpoint를 가진 Dependency도 삭제·유실하지 않으며 Task/Relation Editor는 전체 canonical 관계를 확인할 수 있다. 같은 화면의 내부 범위 탭은 하나의 canonical React state와 ProjectGantt instance를 공유하며, 사용자가 deep link를 실제 다른 browser tab에서 직접 연 경우에만 기존 #373 same-origin revision 신호와 canonical GET freshness 계약을 사용한다. Scoped view의 구조 mutation은 결과가 root subtree 안에 남는 경우만 허용한다. #418부터 native Grid **Header `+`는 현재 scope에서의 최상위 작업 추가**로 해석하여 active Summary root의 immediate child를 생성하고, native Grid 행 `+`는 scoped root/descendant Task·Summary의 child를 생성한다. 일반 Task의 첫 child는 기존 `convertParentToSummary: true` 계약을 재사용한다. Header/Row의 표시 enabled 상태와 실제 command target은 같은 resolver를 사용한다. Milestone child, scope 밖 target, root sibling 생성/이동, direct child Outdent, `before/after` 등 scope 탈출 경로는 Context Menu·shortcut·DnD 모두에서 차단한다. 성공 add의 canonical Core sync와 `filter-tasks`는 같은 직렬 경계에서 처리해 중간 empty frame을 노출하지 않고 scope/scroll/focus/ProjectGantt instance를 보존한다. 물류 필터의 상속 계산은 전체 hierarchy context를 유지한다. 연속 revision 이벤트는 최고 pending revision까지 누적해 재조회한다.

root Summary의 마지막 child가 제거되면 #345에 따라 빈 Summary scoped view를 유지한다. root가 삭제되거나 Summary가 아니게 되면 다른 Task나 전체 Project로 자동 fallback하지 않고 명확한 invalid 상태와 전체 Project 복귀/탭 닫기 경로를 제공한다. DB schema, 새 API, 별도 Scheduling algorithm은 추가하지 않는다.

## Assumption

아래는 Manager가 변경 가능한 초기 설계로 채택한 가정이다. 기존 데이터가 없는 지금 문서에서 조정 가능하며 사용자 확정 사실로 표시하지 않는다.

| ID | 가정 | 근거 / 변경 영향 |
| --- | --- | --- |
| A01 | Next.js App Router + React + TypeScript, 단일 Node backend | AGENTS 권장 stack; exact versions는 설치 직전 검증 |
| A02 | Public ID는 lowercase UUID v4 | 예시 URL의 특정 ULID 길이는 강제 계약 아님 |
| A03 | Project Calendar의 timezone/base week는 Asia/Seoul, exact weekend `[6,0]`을 유지하고 날짜 예외로 일반화 | W06 기반 + Issue #57 구현. 국가 데이터는 검증된 repository fixture만 사용하며 런타임 추정/API 호출 금지 |
| A04 | 날짜는 Gregorian YYYY-MM-DD `1900-01-01..2199-12-31`, end 포함, 일반 Task duration `1..10000` 근무일 | W06 구현·검증; 시각 일정 후속 |
| A05 | `start` 입력과 effective start 분리; Auto 이동은 preview, Manual 충돌은 전체 거부 | 요청값 보존과 일정 재계산의 결정성 |
| A06 | 초기 dependency는 leaf task/milestone의 FS/0만(역사적 초기 인수 기준). 현재 FS/SS/FF/SF 및 lag/lead 지원은 #200/#202/#258 계약으로 대체 | 현재 적용 범위는 [Scheduling](SCHEDULING_ENGINE.md), [API](API.md) |
| A07 | Import v1은 기존 Project에 self-contained batch create-only | 기존 데이터 자동 교체·삭제 금지; update merge 별도 설계 |
| A08 | Summary는 일정 있는 자손에서 계산하며 빈 Summary는 미산정 WBS 컨테이너로 유지한다 (#345). 생성·재배치는 원자적 mutation으로 처리한다. | UI/API가 유효 최종 tree를 제출하고 canonical null·유형·ID를 보존 |
| A09 | Project aggregate revision + If-Match로 stale write 거부 | 단일 인스턴스여도 여러 편집자 가능 |
| A10 | SQLite local volume + WAL; remote/network filesystem 사용 전 별도 검증 | [Deployment](DEPLOYMENT.md) |
| A11 | Import/export resource limits는 초기 측정으로 조정, 무제한 입력 금지 | [Import Schema](IMPORT_SCHEMA.md) 초기 제한 |
| A12 | Version SOT는 `package.json`, release authority는 동일 commit의 annotated `v<version>` tag; build metadata는 사용하지 않음 | 자동 version commit/tag 없이 review 가능한 release 경계 유지 |
| A13 | 초기 GHCR image platform은 `linux/amd64`; arm64는 native runtime 검증 뒤 추가 | 현재 검증 host와 `better-sqlite3` ABI 위험 |
| A14 | Toast 5초·최근 1건, 오류 최신순 최대 50건, 알림함 열기/열린 동안 도착 시 읽음 전환, workspace 메모리에만 보관 | 사용자 확정 숫자가 아닌 구현 UX 정책. 초과 제외 건수 표시·명시적 읽은 항목 삭제. [UX 계약](PROJECT_UX.md) |

## Decision Required

이 항목들은 Planning 진행을 막지 않는다. 해당 환경 검증·실배포 전에 담당자가 확인해야 한다.

| ID | 사용자/조직 판단 | 필요한 시점 | 미확정 상태의 처리 |
| --- | --- | --- | --- |
| D01 | 대상 Workbook에서 VBA 실행·셀 읽기·파일 Export가 허용되는지, 승인된 저장 위치 | 실제 VBA POC 전 | UNKNOWN; 실제 파일·정책을 추정하거나 DRM 우회하지 않음 |
| D02 | 앱 접속 가능한 모든 사용자에게 전체 Project 목록 공개, 편집은 Project별 비밀번호 인증 유지 | 2026-09-12 사용자 승인 | DECIDED; 인터넷 공개·네트워크 접근 경계는 별도 배포 결정 |
| D03 | 운영 Host OS/CPU, volume 경로/owner, 도메인/TLS와 backup 보관 위치·정책 | 배포 검증 전 | 문서의 단일 container 후보로 계획, 운영값 생성 안 함 |
| D04 | GHCR private, downstream consumer 최소 `packages: read`, `main` 필수 CI, PR 필수 승인 0명, `v*` update/delete 금지, 지정 maintainer release | 2026-09-12 사용자 결정 | DECIDED; W22 main/PR와 private GHCR commit/release artifact 원격 PASS. Ruleset 강제 가능 여부는 D05가 대체 |
| D05 | Private repository를 현재 요금제에 유지하고 branch/tag ruleset 미강제 위험을 수용; private GitHub Artifact Attestation은 비활성, BuildKit SBOM/provenance는 필수 | 2026-09-12 사용자 결정 | DECIDED / RISK ACCEPTED; ruleset API 403과 미강제를 숨기지 않으며 지정 maintainer·절차 통제를 유지 |

유료 License 선택은 계획에 없다. 실제 요구가 생기면 구매 전에 별도 판단한다. Password reset/admin 계정, Project 삭제/복원, merge Import, HTTP VBA 전송은 자동으로 초기 범위에 추가하지 않는다.

W23은 D02 승인에 따라 홈과 `GET /api/projects`에서 전체 Project 목록을 제공한다. 목록은 publicId/name/description/createdAt/updatedAt만 포함하며 최신 수정순으로 표시한다. 빈 목록과 조회 실패를 구분하고 생성 후 복귀·새로고침에서도 저장된 목록을 조회한다. 기존 direct-link Readonly와 모든 Mutation의 Project별 edit session 인증은 유지한다. 앱의 인터넷 공개 및 운영 네트워크 접근 경계는 별도 배포 결정이다.

## 충돌·누락 분석

- 초기 `.condex/` 경로와 지침 `.codex/`의 불일치는 원격 commit `81725bd`에서 해결되었다. [설정 검증](AGENT_CONFIGURATION.md) 참조.
- `AGENTS.md`가 가리키는 `docs/`는 원래 존재하지 않았다. 상충하는 기존 상세 구현은 없으며 이번 문서가 첫 초안이다.
- 과거 초기 Domain 지원은 FS뿐이었으나 #200/#202에서 SS/FF/SF와 lag/lead를 지원한다. 과거 단계 설명은 현재 제한으로 해석하지 않는다.
- Project List는 D02 승인 범위에서 앱 접속자 전체에게 제공한다. 목록 공개를 편집 권한 공개로 확대하지 않는다.
- 대상 Excel에 안정 ID가 없을 수 있다. 승인된 ID 보존 방법이 확인될 때까지 행 번호를 장기 ID로 확정하지 않는다.
- W01–W07 application source와 초기 migration, Project edit authorization, pure Calendar/Leaf Scheduling, root Task/Milestone Gantt 저장은 구현되었다. W21은 이 저장 경계를 유지하면서 full-width Grid+Chart 작업공간과 생성 직후 표시 회귀를 보완한다. W20은 CI와 최소 container artifact 기반을 선행하지만 production host/backup/restore를 포함한 W16 전체 배포 승인을 대신하지 않는다. 이 문단의 W01–W07 단계 기록은 당시 상태다. Summary/WBS·dependency 재계산과 Import/Export의 현행 상태는 관련 문서를 따른다.
- #18의 과거 부모 전환 확인 유지 조건은 함께 승인된 #11로 대체하며, 서버의 명시적 전환·인증·revision 계약은 유지한다.

## Issue #72 confirmed addendum

- **R72-01**: Edit 권한 Task의 Grid/Chart context menu는 SVAR Willow 기본 작업 흐름의 Add, Convert to, Edit, Cut, Copy, Paste, Move up/down, Indent, Outdent, Delete를 표현한다. Readonly에서는 mutation이 동작하지 않는다.
- **R72-02**: parent/sibling order/type/subtree를 바꾸는 명령은 server-authoritative atomic mutation이며 성공당 Project revision을 정확히 1 증가시킨다. Client-only hierarchy 상태를 canonical로 간주하지 않는다.
- **R72-03**: Cut은 Paste 전까지 저장 상태를 바꾸지 않는다. Copy는 subtree identity를 새로 발급하고 원본을 변경하지 않는다. stale clipboard는 Project revision 변경 시 폐기한다.
- **R72-04**: cycle, Project 외 Task, Milestone parent 및 Indent/Outdent/Convert/Delete처럼 관계 의미를 손상시킬 수 있는 계층 mutation은 기존 Dependency guard를 유지한다. **Copy는 #378에 따라 Copy 집합 내부 Dependency만 새 Task/Link ID로 복제하고 경계를 넘는 외부 Link는 복제하지 않는다. #430부터 단일 Cut-Paste/reparent는 source subtree의 양 endpoint가 모두 내부인 Link를 그대로 보존하여 허용하고, 한 endpoint만 내부인 boundary Link가 있으면 fail-closed한다.** linked anchor의 before/after 위치 사용은 허용하되 child placement가 linked leaf anchor의 Summary 전환을 요구하면 기존 fail-closed를 유지한다. 빈 Summary 발생만으로 거부하는 규칙은 #345로 대체한다. Project의 unrelated Link만으로 다른 Task의 Context Menu/Editor mutation을 전역 잠그지 않는다 (#104). Assignment가 있는 subtree Copy는 Assignment 복제 정책이 별도 확정될 때까지 명시적 오류로 거부한다.

## Issue #76 Project Workspace 요구사항

- Global Header는 viewport 기반 full-width App Shell을 사용하고 현재 primary navigation을 접근 가능하게 표시한다.
- Project Context는 프로젝트명과 편집 상태 중심으로 compact하게 유지하며 Description/Owner/Revision은 별도 Info UI에서 조회 가능해야 한다.
- Status와 Action을 분리하고 Share/Export/Settings/Copy 등 Project command는 direct action과 overflow hierarchy로 정돈한다.
- Readonly password 입력은 상시 form이 아니라 사용자가 명시적으로 편집 활성화를 선택했을 때 Dialog로 제공한다. 기존 edit-session/security/rate-limit 계약은 변경하지 않는다.
- `일정 / Milestone 대시보드 / 리소스 / 물류 구성`을 동일 Project Context의 상위 peer view로 제공하고 최초 view는 일정이다 (#518).
- Resource workload를 Gantt 하단 누적 영역에서 Resource view로 이동하고 전체 가용 폭에서 Summary, M/D/M/M/Refresh, Group → Resource → Task hierarchy를 제공한다.
- 정상 tab 전환은 mutation/reload/navigation을 발생시키지 않으며 일정 view로 복귀했을 때 Gantt instance와 사용자의 scroll/tree/column/scale/selection state를 불필요하게 잃지 않아야 한다.
- 390/768/1024/1440/wide viewport, keyboard/focus, Escape/focus restore, unintended document overflow를 회귀 검증한다.
- 본 변경으로 Project revision, If-Match, canonical snapshot, permission/BFCache recheck, Resource workload API/calculation, Gantt mutation lifecycle을 변경하지 않는다.


- **REQ-LINK-97**: 편집 권한 사용자는 Gantt에서 FS/lag=0 관계를 생성·삭제할 수 있고, 변경은 Project revision과 함께 SQLite에 원자적으로 저장되어 reload/restart 후에도 유지되어야 한다. 실패한 mutation은 로컬 ghost relation을 남기지 않는다.
- **REQ-LINK-377**: Task Editor 관계 탭은 기존 canonical relation model과 Relation Editor를 재사용하여 Task/Milestone의 관계 추가·편집·삭제에 직접 진입할 수 있어야 한다. 관계가 0건이어도 현재 Task를 Anchor로 추가할 수 있으며 dirty/stale/readonly/pending에서는 mutation을 차단한다. 성공 시 canonical tasks/links/revision을 열린 Task Editor와 Workspace에 함께 반영하되 Relation Editor의 top-layer 순서와 Task Editor active tab/Gantt view state를 유지한다.


## Issue #83 Project 검색/필터 요구사항

- 일정 탭은 Task의 통합 텍스트(name/description/externalId), 필드별 text 연산자, effective start/end 기간, type/schedule mode, progress/duration, assignment 존재 여부, 직접 할당 Resource/Group ANY·ALL 조건을 AND로 조합한다.
- child 직접 일치 시 필요한 ancestor Summary는 context로 표시하되 match count에서 제외한다.
- Gantt 표시에는 SVAR 2.7.3의 공개 `filter-tasks` API를 사용하며 canonical Task hierarchy, revision, DB를 변경하지 않는다.
- 리소스 탭은 현재 Project에서 실제 사용 중인 Resource/Group을 name/code/description, kind, active, 연결 Task effective 기간으로 제한한다.
- 비활성 assigned target도 검색 가능하며 Group member를 direct Resource assignment로 추론하지 않는다.
- 같은 page session 동안 일정/리소스 필터 state를 유지하고 새로고침 시 초기화할 수 있다.


## Issue #84 Project List 검색/필터

- Project List는 현재 public summary(`name/ownerName/description/createdAt/updatedAt`)만 사용해 client-side read-only view filter를 제공한다. 검색을 위해 DB schema, API schema, Project revision을 변경하지 않는다.
- Quick Search는 프로젝트명·소유자·설명을 trim + case-insensitive contains로 동시에 검색하며, 고급 조건과 AND로 결합한다.
- 고급 조건은 프로젝트명/소유자/설명 text operator, 소유자 지정 여부, 생성일/최근 변경일의 equals/before/after/inclusive range를 지원한다.
- 날짜 조건은 UTC 문자열 substring이 아니라 목록 표시와 동일한 browser timezone의 calendar date로 판정한다.
- 삭제된 Project를 먼저 제외한 뒤 검색 조건을 적용하고, 전체 Project 0건과 검색 결과 0건을 서로 다른 상태로 표시한다.
- 검색 입력은 Project API 재조회, page reload, Project mutation을 발생시키지 않으며 같은 page session의 Row Action/Dialog 사용 중 view state를 유지한다.
- Task/Resource 검색은 Issue #83 구현을 그대로 사용하고 Project List가 별도 검색 프레임워크를 만들지 않는다. 공통 text normalization/operator primitive는 Project/Task predicate가 공유한다.

## Issue #196 Project Workspace Task/Milestone 빠른 보기

- Project Workspace의 일정(Schedule) 도구줄에 `[ 전체 | Task | Milestone ]` 빠른 보기 버튼 그룹을 제공한다.
- 사용자는 고급 필터 패널을 열지 않고도 일반 Task 또는 Milestone을 빠르게 중심 조회할 수 있어야 한다.
- 빠른 보기 버튼은 기존 #83 `TaskFilterState.types`와 동일한 상태를 조작하며, 검색어/기간/리소스 등 다른 필터 조건을 보존한다.
- `전체`는 `types = []`, `Task`는 `types = ["task"]`, `Milestone`는 `types = ["milestone"]`를 적용한다.
- 고급 필터에서 복합 유형을 선택한 경우 빠른 보기 버튼의 단일 active 상태는 해제된다.
- 버튼 전환은 client-side view state로 동작하여 API 재조회, Project mutation, revision 증가, Gantt remount를 유발하지 않으며 SVAR 공개 `filter-tasks` action을 사용한다.
- 390/768/1024/1440px 뷰포트와 전체화면 모드에서 컨트롤 겹침이 없어야 하며 키보드 Tab 및 ARIA pressed 상태를 지원한다.

## Issue #372 — Gantt fullscreen에서 편집기 상태 보존

- Gantt native fullscreen 상태에서 Task Editor를 Grid/Chart double click 또는 Context Menu → Edit으로 열 때 애플리케이션은 `document.exitFullscreen()`을 호출하지 않는다.
- Task Editor의 저장·취소·닫기와 Relation Editor의 open/close/mutation은 사용자가 직접 fullscreen을 종료하지 않는 한 동일 `.project-gantt-frame` fullscreen과 Gantt instance를 유지한다.
- Editor open/close는 Grid/Chart scroll, splitter, column width/visibility, Day/Week scale, selection, Summary expand/collapse, filter를 초기화하거나 API mutation을 발생시키지 않는다.
- Readonly에서도 동일한 fullscreen 보존 규칙을 사용하고, 브라우저가 Escape 등으로 fullscreen을 종료하면 실제 `document.fullscreenElement`와 UI 상태를 동기화한다.
- 기존 session/Origin/If-Match/revision/canonical snapshot/Task·Relation·Assignment 저장 계약은 변경하지 않는다.

## Issue #258 — 연결 Task 필드별 편집

관계가 있는 leaf Task/Milestone의 metadata·progress·Baseline 편집은 현재 적용 날짜/requestedStart를 보존한다. 요청 시작일·duration·scheduleMode 변경은 전체 dependency-aware transaction으로 후행 Auto의 지연/앞당김과 Summary를 다시 계산한다. Manual/resource conflict 및 혼합 payload는 전체 rollback한다. Grid 이름·Chart 완료 gesture와 Editor는 같은 Task PATCH/canonical snapshot 계약을 사용한다. Delete/Convert/계층/Copy·Summary 정보창·권한 보호는 그대로다. R08의 초기 FS 범위 표기는 역사적 단계이며 현재 generic FS/SS/FF/SF와 lag 지원은 Scheduling/API 문서를 따른다.

## Issue #288 개발자 리소스 등급

- 글로벌 Resource는 선택적으로 개발자 등급 `BEGINNER | INTERMEDIATE | ADVANCED | EXPERT`를 가진다. UI 표시명은 각각 초급/중급/고급/특급이며 `null`은 개발자가 아니거나 아직 등급을 지정하지 않은 기존 Resource를 뜻한다.
- 시스템의 `developer` 역할을 새로 배정할 때는 해당 Resource에 개발자 등급이 있어야 한다. 기존에 이미 저장된 `developer + grade NULL` 조합은 migration에서 삭제·자동 변환하지 않고 조회/보존할 수 있다.
- Developer 역할 해제는 Resource의 전역 등급을 지우지 않는다. 등급은 Resource Catalog 관리자만 명시적으로 변경한다.
- 개발자 등급은 분류·표시·역할 검증용 메타데이터이며 Task duration, allocation, M/D·M/M, capacity, 비용, 일정 자동 조정 및 resource leveling을 암묵적으로 변경하지 않는다.


## Issue #289 프로젝트 기준정보

- Project는 사업부(BUSINESS_UNIT), 제품(PRODUCT), 사업장/법인(SITE_ENTITY)을 각각 최대 1개 선택하며 모두 nullable이다.
- 세 값의 Source of Truth는 전 프로젝트 공통 global master catalog의 stable public ID/code이고 Project row에 표시명을 중복 저장하지 않는다.
- 신규 선택에는 active 항목만 사용하며, 기존 Project가 참조하는 inactive 항목은 자동 해제하지 않고 비활성 상태로 표시한다.
- Project 생성/편집/조회/목록/복사/Template 경로에서 동일 참조를 유지한다. Project edit 권한은 global project-master 관리자 권한을 부여하지 않는다.
- 사업부→제품→사업장 cascading, 다중 선택, ERP/MES 동기화와 해당 값 기반 권한/일정 자동화는 범위 밖이다.

## Issue #344 — 삭제 실패의 mutation 범위와 revision 단조성

- 성공한 Task 삭제와 증가한 Project revision은 이후 다른 삭제 요청의 `401/409/412/network` 실패로 되돌리지 않는다. 실패한 삭제 대상은 최신 서버 canonical 상태에 따라 유지한다.
- 현재 Project `publicId`와 다른 snapshot 또는 마지막 확정 revision보다 낮은 snapshot을 Workspace의 authority로 적용하지 않는다. 같은 revision과 더 높은 revision의 정상 canonical 응답은 적용할 수 있다.
- 오류 복구 GET은 캐시를 사용하지 않는다. 재조회가 실패하거나 응답 revision이 오래되면 마지막 확정 snapshot을 같은 SVAR 인스턴스에 동기화하며, page reload/remount를 오류 복구 수단으로 사용하지 않는다. Grid/Chart task 집합, Summary 접힘, 스크롤과 scale을 보존한다.
- #344 당시 유지했던 `EMPTY_SUMMARY_NOT_ALLOWED` 정책은 #345의 빈 컨테이너 허용으로 대체한다. subtree 삭제, unrelated Link 보존 및 server-side session/Origin/If-Match/transaction 계약은 유지한다. 유효한 거부 조건에서도 이전 성공 mutation을 보존한다. network 실패 뒤 더 높은 canonical revision이 확인되면 서버 확정 결과를 반영하며, 자동 mutation 재전송은 하지 않는다.
- 일반 정상 409 흐름의 baseline 미재현 결과와 오래된 복구 GET을 주입한 결함 재현 결과를 구분한다. 테스트 및 공식 원격 회귀 상태는 [TEST_PLAN](TEST_PLAN.md#issue-344--작업-삭제-실패-복구-회귀)에 기록한다.

## Issue #343 Project List 프로젝트 기준정보 표시

- Project List의 모든 row는 #289 canonical summary에 포함된 사업부, 제품, 법인/사업장을 독립 column으로 표시한다.
- 사용자 표시값은 catalog `name`이며 null/undefined는 `미지정`, inactive 참조는 기존 표시명을 유지하면서 `(비활성)` 의미를 함께 표시한다.
- 프로젝트명 primary navigation, 상태 변경, owner/description/date, Row Action, #84 검색/필터 및 기존 정렬 순서를 유지한다.
- 별도 catalog N+1 fetch를 만들지 않고 Project List summary만 사용한다.
- 390/768/1024/1440/wide에서 세 column을 데이터에서 제거하지 않으며, 좁은 화면은 table 내부 horizontal scroll을 허용하되 document-level overflow는 금지한다.
- 신규 기준정보 필터/정렬, API/DB schema, Project revision/security, SVAR Gantt 변경은 범위 밖이다.



## Issue #303 — Task status / progress synchronization

- Task/Milestone status는 `not_started | in_progress | completed`이며 Project status와 별도 도메인이다.
- 신규 leaf와 PATCH는 progress/status를 서버에서 canonical하게 정규화한다. progress 100%와 completed는 양방향 동기화하고, not_started는 0%, completed 해제는 in_progress로 처리한다.
- Summary status는 직접 편집하지 않고 derived progress의 정확한 값으로 파생한다.
- 완료 Task/Milestone/Summary의 Grid 작업명에는 취소선을 표시하며 완료 해제 시 제거한다.
- status는 API/DB/canonical snapshot/reload/Template instantiate/Copy 경로에서 일관되게 보존한다.
- progress/status 변경은 요청/적용 일정이나 Dependency Link를 바꾸지 않으며 기존 edit session, Origin, If-Match, revision, transaction 계약을 유지한다.

## Issue #370 — Grid 시작일 Date Picker 빠른 편집

Project Workspace의 Grid `시작` 셀은 편집 권한이 있는 Task/Milestone에서 single click 또는 keyboard Enter/Space로 Date Picker를 연다. 선택값은 새 `requestedStart` 의도로 기존 Task PATCH의 `start` 필드에 전달하며, Grid 자체의 `projectStart`는 저장 필드가 아니다. 서버는 Project Effective Calendar와 FS/SS/FF/SF + lag를 포함한 기존 dependency-aware scheduling 계약으로 canonical `start/end`를 다시 계산하고 Grid/Chart는 같은 Gantt 인스턴스에 그 결과만 반영한다.

Summary는 하위 일정에서 날짜가 파생되므로 시작일 직접 편집을 허용하지 않는다. Milestone은 `duration=0`, `start=end` 계약을 유지한다. readonly, mutation lock, stale/saving 상태에서는 Date Picker 진입을 차단하며, 동일 날짜 선택과 단순 취소는 mutation을 만들지 않는다. 실패한 저장은 Core의 임시 Grid 값을 확정하지 않고 마지막 서버 canonical snapshot을 유지/복구한다.

### REQ-GANTT-CHART-REORDER — Issue #299

- 편집 사용자는 Chart bar 수직 DnD로 같은 parent의 작업 순서를 변경할 수 있어야 한다.
- vertical reorder와 horizontal schedule move/resize는 한 gesture에서 중복 저장되지 않아야 한다.
- canonical parent/sibling order는 Grid/Chart/reload 및 후속 Task mutation에서 유지되어야 한다.
- #335 linked same-parent reorder를 허용하고 #399/#407 scope 및 기존 hierarchy invariant를 우회하지 않아야 한다.
- cross-parent implicit reparent는 허용하지 않는다.

### REQ-RESOURCE-GLOBAL-ROLES — Issue #412

- Resource는 전역 역할 `PI | DEVELOPER | EQUIPMENT_OWNER` 중 0개 이상을 동시에 가질 수 있어야 한다.
- 전역 역할은 Resource Group membership, Task assignment, Project Equipment/System 담당 역할과 독립이어야 하며 어느 한쪽의 변경이 다른 쪽을 자동 변경하면 안 된다.
- `DEVELOPER` 전역 역할과 developerGrade는 독립적으로 저장되어야 한다. 전역 역할 지정/해제로 등급을 자동 생성·삭제하지 않는다.
- DB/API는 동일 Resource-role 중복과 허용되지 않은 role code를 거부해야 한다.
- 기존 Resource는 schema upgrade 뒤 역할 0개로 보존되어야 하며 임의 backfill하지 않는다.
- Resource Catalog 관리자만 역할을 변경할 수 있고 기존 Origin/session/If-Match/revision 동시성 계약을 유지해야 한다.
- 비활성 Resource의 기존 역할은 조회/보존되어야 한다. 안전 삭제가 허용된 Resource 삭제 시 role row는 함께 정리되어야 한다.
- 관리 UI는 역할과 개발자 등급을 시각·의미적으로 구분하고 keyboard로 역할 다중 선택이 가능해야 한다.

## Issue #485 — Global Resource Role 단일 기준

#413의 Task별 수행 역할 선택/저장 계약은 #485로 대체한다. Resource 관리의 Global Role이 해당 Resource의 수행 역할에 대한 단일 Source of Truth다.

- Task assignment는 Resource/Group 참조와 개인 Resource의 allocation(start/end/percent)만 소유한다. Task별 `assignment_role`을 신규 입력·수정하지 않는다.
- Task Editor는 개인 Resource 선택 후 별도 역할 Select를 표시하지 않는다. Global Role badge는 read-only 정보이며 `role` query는 후보 Resource의 Global Role 검색/필터 의미만 가진다.
- 호환용 `ProjectAssignmentDto.role`과 DB `assignment_role`은 non-authoritative이며 canonical 응답/신규 저장은 null이다. non-null mutation 입력은 거부한다.
- Global Role 변경은 기존 Task assignment 때문에 차단하지 않는다. Project Equipment/System 역할은 별도 도메인으로 유지한다.
- Project Copy/Template은 Task별 역할을 복제하지 않고 Resource/Group 참조와 allocation만 보존한다.

## Issue #414 — Global Role 기반 Resource workload / 개발자 견적

- #56의 개인 Resource assignment M/D·M/M 계산과 Calendar/allocation 계약을 유지한다.
- 역할 분류는 assignment row가 아니라 Resource의 현재 Global Role 집합을 사용한다. 역할이 없는 Resource는 `UNSPECIFIED`로 표시한다.
- 복수 Global Role Resource의 동일 assignment는 여러 역할 subtotal에 포함될 수 있으므로 역할 subtotal은 **비가산 분류 보기**다. 역할 subtotal 합으로 Grand Total을 계산하지 않는다.
- Grand Total은 계속 assignmentId 기준 정확히 한 번 합산하며 Resource Group 중복 membership으로 증가하지 않는다.
- `개발 견적` preset은 현재 Global Role에 `DEVELOPER`가 포함된 Resource를 사용한다.
- Resource View와 Milestone dashboard의 기존 `assignmentRoles` query key는 호환을 위해 유지하되 의미는 Global Role 필터다.

상세 계약은 [Issue #414 문서](ISSUE_414_ROLE_WORKLOAD_DASHBOARD.md)를 따른다.
## Issue #415 — Resource/개발 공수 견적 Excel

- 사용자는 Excel 내보내기에서 역할·개발자 공수 견적 포함 여부를 선택할 수 있어야 한다.
- Summary의 Grand Total/역할 subtotal 및 Detail은 동일 Project revision의 #414 workload 결과와 일치해야 한다.
- Detail grain은 assignmentId이며 여러 Group membership으로 중복 가산하지 않는다.
- 역할 미지정과 공수 미설정은 명시적으로 표시하고, M/M 기준이 없을 때 임의 환산하지 않는다.
- Progress/status/지연은 계획 공수와 함께 표시하되 실제 소진 공수나 비용으로 추정하지 않는다.
- 기존 Gantt/Tasks/Project/Dependencies/Logistics 시트와 Origin/If-Match/formula-injection 보호는 유지한다.


## Issue #461 Milestone Editor

Task/Summary의 작업 정보에서 Milestone을 이름·externalId·canonical taskId로 단일 검색·지정한다. Summary는 이름·Description·URL·하위 작업 기본 단계만 편집하고 파생 일정/진척/상태/Baseline은 읽기 전용이다. 직접/nearest Summary 상속/미지정을 구분하고 null 해제는 상속 복귀다. 기본 필드와 소속은 한 PATCH로 원자 저장한다.

Milestone은 기존 탭을 유지한 소속 작업 N 탭으로 유효 일반 Task 수와 explicit root 수를 구분한다. 검색·유형·소속 상태·다른 단계 이동·영향 preview, Summary override 보존과 inherited explicit-only 해제를 제공하고 batch 한 POST로 적용한다. full canonical 동기화와 모든 저장 단위의 dirty/pending/stale/readonly/완료 잠금을 유지하며 실패 초안·검색·선택을 보존한다. Ready/소속 진척/본인 완료를 분리하고 재개는 별도 명시 저장 뒤 구조 변경한다. Domain/API/auth/revision은 #460 계약을 재사용하며 새 서버 기능은 추가하지 않는다.

## Issue #462 Milestone Gantt/Grid 조회

유형 quick view와 Milestone 전체/미지정/특정 M 조건은 독립 상태이며 기존 조건·WBS scope와 AND다. effective Membership은 전체 canonical hierarchy projection을 재사용하고 scope 밖 ancestor는 계산에만 사용한다. M/일반 Task matching과 Summary 구조/설정 context를 구분하고 고유 일반 Task 건수를 별도 표시한다. 빈 Summary context에도 유형 외 나머지 조건을 적용한다. 후보는 canonical 적용 예정일과 안정 ID 키로 조회 정렬하며 요청일/WBS 순서를 변경하지 않는다.

기본 숨김 선택 열은 effective 이름·직접/상속·출처·동명이인 식별자 조회 경로를 제공하고 기존 column budget/preferences를 보존한다. Task/Summary/M 메뉴는 같은 #461 Editor에 진입하고 진입 mutation은 없다. 신규 일정 관계는 같은 유형 Task/Task·M/M만, 기존 mixed 관계 표시/endpoint 고정 편집은 유지하며 완료 M 양 endpoint 구조 변경은 서버와 UI에서 보호한다. 필터/열 전환은 canonical/GET/revision/instance·scroll·tree·scale·selection·fullscreen을 초기화하지 않는다. 5폭 toolbar/popup/Grid geometry와 keyboard를 실제 browser로 검증한다.

특정 M + Milestone-only는 M 자체와 해당 행을 표시하기 위한 scope 내 hierarchy ancestors만 표시한다. Membership 설정용 Summary context/빈 Summary는 추가하지 않는다. 전체/Task-only에서는 설정 context를 유지하며 match/count와 구분한다.


## Issue #518 — 일정 탭 계층 단순화

- Workspace 상위 tab 순서는 `일정 / Milestone 대시보드 / 리소스 / 물류 구성`이며 내부 Gantt/Dashboard tab 행을 제거한다. `일정`은 기존 Gantt 내용을 즉시 표시한다.
- `전체 프로젝트 / Summary ...` WBS 범위 탭은 그대로 유지한다. 보기 전환은 서버 mutation·Project revision 증가·Gantt remount를 만들지 않는다.
- Milestone 활성 시 Gantt는 visibility:hidden/inert/aria-hidden이면서 layout 측정 크기를 보존한다. Dashboard detail→Editor와 일정 drill, 일반 왕복 시 scope/viewport/selection 유지 계약을 보존한다.
- 390/768/1024/1440/1920px에서 여백·탭 focus/ARIA·가로 내부 scroll·Gantt 가용 면적을 검증한다. API/DB/KPI/Scheduling은 비범위다.

## Issue #463: Milestone 대시보드와 물류 연계

Project Workspace 상위 Milestone 대시보드 peer view에서 readonly KPI와 단계 목록을 조회한다 (#518). full canonical snapshot의 E(M)/P(M)로 Ready·Blocked·소속 작업 진척·완료 불일치를 계산한다. 현재 Milestone 검색/선택 S와 Project 전체 물류·Resource·수행 역할·등급·기간 공수 F를 분리하고 WBS scope 미적용을 명시한다. 완료율/Ready/Blocked/지연/임박/계획 위험/소속 적용률은 raw 분모와 snapshot 대상 ID를 제공하며 null/0/loading/error를 구분한다.

일반 Task 개인 assignment만 기존 Calendar/allocation으로 계산하고 모든 단계+미지정 bucket 합은 같은 F Grand Total이다. 검색으로 숨겨진 단계의 공수도 총합에 남는다. M/M은 명시 query 또는 유효 ENV 설정에서만 환산한다. 기존 물류 수치는 유지하고 full-stage 관련 projection을 추가한다. 기준일은 현재 snapshot의 Project timezone 평가이며 과거 상태/actual completion/원가/AI 위험 예측이 아니다. [정확한 서버 계약](MILESTONE_STAGE_GATES.md#issue-463-단계-대시보드-읽기-모델) 및 [API](API.md#issue-463-milestone-dashboard-api)를 따른다.

## Issue #493 — Summary Task Description/URL 편집

- Summary는 WBS 컨테이너이면서 자체 `description`과 `url` 메타데이터를 소유한다. 편집 세션이 유효하면 빈 Summary와 일정 산정 Summary 모두 두 필드를 직접 편집할 수 있어야 한다.
- Summary Description/URL은 일반 Task와 동일한 validation/normalization 계약을 사용한다. 공백-only Description/URL은 null이며 URL은 HTTP(S)만 허용한다.
- Summary의 requestedStart/start/end/duration/progress/status/Baseline은 계속 자손에서 파생하거나 읽기 전용이다. 메타데이터 편집을 일정 편집 허용으로 확대하지 않는다.
- 하위 작업 추가·삭제·이동 및 Summary 일정 재계산은 Summary의 Description/URL을 보존해야 한다. 저장·재조회·reload 후 canonical snapshot과 UI가 일치해야 한다.
- 보호 mutation은 기존 edit session, exact Origin, strong If-Match/revision 및 프로젝트 격리 규칙을 유지한다.


## Issue #523 Resource KPI 공통 집계

Resource/Group/Role/Milestone/기간 KPI의 공통 pure Domain과 typed 사전·fixture를 제공한다. 개인 Assignment 공수와 distinct 일반 Task 지표를 분리하고 중첩 Group/Role 소계를 Grand Total로 더하지 않는다. allocation 미설정은 알려진 공수/partial/unsetCount와 함께 반환하며 모두 미설정과 확정0을 구분한다. 미배정 Task 진단은 개인 조건이 없는 T0, 할당 KPI는 같은 개인 조건을 만족한 A를 사용한다. full Milestone E/P 상태는 선택 범위로 재정의하지 않는다. 실행 계약은 [RESOURCE_KPI_DASHBOARD](RESOURCE_KPI_DASHBOARD.md)를 따른다. HTTP/UI 공개·capacity·실제공수 원장은 이 단위 범위 밖이다.


## Issue #524 Resource·Group×Milestone 서버 조회

동일 Project read snapshot과 단일 기준시각의 Resource/Group subtotal·Milestone cell·distinct Task KPI·raw M/D/M/M·T0 진단을 신규 readonly API로 제공한다. 조건은 같은 개인 Assignment에서 AND이며 Group/개인 mode는 Grand Total을 바꾸지 않는다. 개인/Group 활성 조건과 개인·Task·연결Group 검색은 A, Task-only 검색/status는 T0에도 적용하고 full-stage Ready/Blocked는 전체 member/predecessor를 유지한다. 기간이 다른 canonical Task 일정과 Assignment 투입 구간은 별도 제공한다.

상세는 같은 filter/revision/Calendar/scope identity를 확인하는 bounded selector/page이며 변경 시 재조회409를 요구한다. 다른 Project/글로벌 미할당 개인 정보는 공개하지 않고 전체집계·조회부하에 유한 상한을 두며 초과 시 부분합을 완전한 값으로 표시하지 않는다. 기존 workload/Stage/Logistics 응답 의미·rounding·권한은 불변이다. [Resource KPI 계약](RESOURCE_KPI_DASHBOARD.md)을 따른다. UI/capacity/export 공개는 후속 단위다.

## Issue #525 Resource·Group 기본 Dashboard

기존 Project 리소스 탭에서 동일 서버 scope의 raw 선택 KPI와 그룹/개인 행·고유 Task/Assignment 상세를 조회한다. 기본 그룹 모드, 개인 직접 조회, 기간/Milestone/Global Role/개발자 등급/상태/검색/activity/개인·그룹 선택 및 개발 견적 preset을 제공한다. mode/단위 변경은 조건·Grand Total·DB를 변경하지 않는다. 계획 공수의 unknown/partial/설정된0/빈0과 T0 개인 미배정·Group만 지정·Milestone 미지정·미분류 Resource를 구분한다. Group/Role 소계는 비가산이며 화면 행의 재합산을 KPI authority로 사용하지 않는다.

조회 조건/기간/revision/snapshot 검증, abort·늦은 응답 폐기, hidden 조회 중단, stale 상세 잠금과 명시 재시도/최신 일정 조회를 제공한다. 오류 후 입력 조건·단위·같은 snapshot의 열림 상태를 보존한다. Task KPI는 고유 Task 표, Assignment 공수는 개인 할당 상세로 구분하고 작업 일정·저장 override/상속·선택 투입 구간을 별도 표시한다. keyboard/Escape/focus 복원, 내부 scroll/5개 viewport와 Gantt instance/상태 보존을 검증한다.

기존 stage assignmentIds drill은 legacy API/UI로 보존한다. 상위 Workspace 재설계(#518)/Milestone 용어 일괄 변경(#495), Milestone tree/matrix(#526), capacity(#527), 외부 navigation/export(#528)는 이 구현의 인수 범위 밖이다. 상세 source of truth는 [Resource KPI 계약](RESOURCE_KPI_DASHBOARD.md#issue-525-기본-resourcegroup-dashboard)이다.


## Issue #526 서버 Milestone 비교 범위

동일 Resource/Group 필터의 Group→Milestone→Resource와 Group→Resource→Milestone을 서버가 계산한 자식 행으로 제공한다. 선택 범위의 전체/단계 소계와 Group∩Resource 상세를 동일 snapshot으로 조회하고 공동 Task는 distinct, 복수 Group/Role은 비가산으로 유지한다. Milestone 조건 제외 reference 및 실제 제외 Assignment summary를 제공하며 비율/count를 숫자로 차감하지 않는다.

필터/페이지/열 숨김이 원시 Grand Total이나 full Milestone Ready/Blocked를 바꾸지 않는다. canonical 예정일+ID 정렬/미지정 마지막, null/부분합/설정0/빈0, bounded same-snapshot public read와 유효 구성원 empty/foreign400/stale409를 구별한다. [Resource KPI 계약](RESOURCE_KPI_DASHBOARD.md#issue-526-서버-milestone-roll-up-계약)을 따른다. UI geometry/interaction 구현은 별도 frontend 검증으로 연결한다.

### Issue #526 UI

리소스 탭 내 Group→Milestone→Resource→Task, Group→Resource→Milestone→Task, Resource→Milestone→Task와 Group/Resource×Milestone 비교표를 제공한다. Raw 서버합계·distinct/비가산·선택/reference/excluded·full 단계 Gate 의미를 유지한다. 비교표50행/6단계와 펼침12개 budget은 표현 상한이며 집계 범위를 줄이지 않는다. Keyboard·focus·stale/canceled 응답과390/768/1024/1440/1920px 긴 이름/다수 행 geometry 및 기존 Gantt 상태를 검증한다. API/계산 계약은 [Resource KPI Dashboard](RESOURCE_KPI_DASHBOARD.md#issue-526-서버-milestone-roll-up-계약)를 따른다.


## Issue #527 주·월 Resource Plan

일반 Task 개인 Assignment 이력에서 개인 분류 조건만 적용한 Capacity R를 기준으로 주/월 기간별 selected 부하와 같은 개인의 현재 Project 전체 부하를 함께 제공한다. 기간/Task/Milestone/search 조건은 R와 전체 참고 부하를 숨기지 않으며 실제 전사 가용량·근태로 표현하지 않는다. 근무일1일=1M/D, 기존 전체 Group Resource Calendar 우선순위, 명시 M/M 환산·raw/unknown/분모0 계약을 유지한다.

평균 Load·집합/개인 Peak·개인 초과 일수/개인 수·개인 초과 M/D를 구별하고 Group 평균이 개인 초과를 숨기지 않는다. Milestone 기여와 부모 Resource Project 전체 참고는 비가산이다. 기간별 numeric 일별 근거→Group 구성원 날짜별 근거→개인 Assignment 원인을 같은 snapshot으로 bounded 조회한다. ISO week-year/부분 기간·월/윤년·0부하·비활성·미설정/부분합/비근무기간을 구별한다. 유한 계산/JSON 예산 초과는422로 거부하고 전체 합계를 절삭하지 않는다. [Domain·API 계약](RESOURCE_KPI_DASHBOARD.md#issue-527-backend-resource-plan-범위와-api)을 따른다. UI geometry/interaction은 frontend의 별도 검증이다. DB/Calendar 원장·실적·FTE·시간·자동배정/레벨링은 범위 밖이다.

### Issue #527 Resource Plan UI

리소스 탭에서 주/월 한 개 계획 matrix와 Group→Resource→Milestone/Resource→Milestone을 제공한다. 전체1+분류49행/4기간+전체 window, 부모context·code/activity/Role-grade·sticky/internal scroll,5폭(390/768/1024/1440/1920px) 긴 이름·마지막 기간 창을 검증한다. 선택 기여와 Project 전체 참고·과투입, R0/0부하/비근무/미설정/부분합을 구별한다. 날짜→개인→Assignment의 echo 검증·readonly 상세, keyboard/focus/Escape/pager·cancel/stale·기존 Gantt 상태를 보존한다. 자세한 계약은 [Resource KPI Dashboard](RESOURCE_KPI_DASHBOARD.md#issue-527-resource-plan-조회-ui)를 따른다.

## Issue #528 — Resource·Milestone·일정 정확한 조회 범위

Resource→일정은 서버가 확인한 전체 고유 일반 Task/개인 Assignment 집합을 사용하며 상세 page50을 전체 범위로 대체하지 않는다. 조상 Summary는 표시 context로 분리한다. 일정 선택 Task/Summary→Resource는 일반 Task 자손의 모든 개인 배정을 대상으로 하고, exact Assignment source는 공동 Task의 다른 개인으로 확대하지 않는다. 빈 source는 All로 fallback하지 않는다. selected A/T0와 #526 reference는 source 제한을 유지하며 #527 Project 전체 부하 참고는 같은 R/기간의 명시 reference다. full Stage Ready/Blocked 계산은 유지한다.

public-readonly POST query는 exact Origin·실제 stream1MiB·strict descriptor와 유한 원본/계산/JSON 예산을 검증하고 DB/session/token을 만들지 않는다. canonical raw fingerprint와 출발 실제 기간/M-D 정책, 별도 target 조건을 echo하여 stale409를 차단한다. Legacy Milestone 추가 context 한도 초과는 기존 조회를 보존하며 정확한 cross drill만 unavailable로 명시한다. UI의 return-frame·guard·WBS 확인 계약은 [실행 계획](exec-plans/active/ISSUE_528.md)과 [Resource KPI](RESOURCE_KPI_DASHBOARD.md#issue-528-정확한-source-scope와-양방향-drill)를 따른다.

Issue #528 UI는 명시 원본 source와 destination 조건을 분리하고 최대8개 복귀 frame·최대9개 live 방문 context를 보존한다. 원래 보기는 직전 출발을 복원하고 전체 해제는 현재 화면의 첫 이동 전 조건을 복원한다. 서로 다른 수동 탭의 최근 이동 집합을 현재 조회 집합으로 표시하지 않는다. 직접 Milestone 위치 노드는 일반 Task N과 구분한다. 확인창 승인 후 원본 fingerprint·환산 정책을 다시 검증하고 stale/empty를 All로 확대하지 않는다. 기존 공통 Editor와 Gantt instance·선택·viewport를 보존한다.

Issue #528의 신규 범위 버튼은 기존40px secondary-button/focus primitive를 사용하고 캐시된 숨은 제목 대신 실제 도착 제목으로 focus한다. Milestone 직접 노드 frame의 원본 기간·평가일·환산/sourceProjection은 오늘 lookup 결과로 대체하지 않는다.

## Issue #529 Resource 기준 Excel 보고

기존 Excel Export에 명시 opt-in으로 Resource Dashboard/Plan 보고서를 추가한다. current는 실제 서버 성공 보고서의 조건·기간·asOf·M-D 정책·raw snapshot과 exact binding을 유지하고 project는 같은 기간/정책에서 분류/Task/WBS/M/search/status/exact 선택만 제거한다. 기존 시트는 기존 전체 범위를 유지한다. 같은 read snapshot의 기존 Domain 결과만 사용하며 client 합계·화면 행·표시 반올림을 authoritative 값으로 쓰지 않는다.

개인/Group×Milestone·미지정, 주·월/부분·ISO-year Plan, 고유 Assignment 상세, T0 미배정/미설정 품질과 정규화 관계를 별도 시트로 제공한다. Capacity·Group/Role·개인×M 참고는 비가산 의미를 명시한다. raw null/0/state/진척·Load 단위와 safe literal text를 보존하고 stale·missing DTO·계산/행/셀/XML/ZIP 예산 초과는 전체 실패다. body 8 KiB와 기존 readonly Origin/If-Match·쿠키/보안 정책은 유지한다. 신규 report의 검증 Project direct hyperlink 1개 외에 사용자 URL 관계를 만들지 않는다. 상세 [API](API.md#issue-529-resource-보고서-excel-opt-in), [Excel](EXCEL_EXPORT.md#issue-529-resource-dashboardplan-추가-보고서)을 따른다.

Resource 화면의 보고서 진입과 일반 Export opt-in은 단일 대화상자를 사용한다. current는 활성 방문·ready/query/exact binding·원장 fingerprint·실제 정책이 일치해야 한다. stale 후 옵션은 보존하되 실제 새 조회와 사용자 명시 확인 전에는 생성하지 않는다. 현재 조건의 이름/안정 ID·분류·기간·정책·원장·exact 범위를 확인할 수 있어야 한다. Export 종료 시 숨겨진 trigger 대신 visible tab/일반 Export로 focus를 복원하며 readonly·Gantt 선택/양수 viewport/열폭/tree/동일 인스턴스를 유지한다. 원격 quality/e2e/docker와 실제 Windows Excel 검증은 로컬 증거와 별도 판정한다.

Export와 workspace 복귀의 Gantt 상태 보존은 대기 중 사용자 wheel/pointer/keydown 입력을 우선한다. Core와 native DOM 양쪽 복원을 취소하고 현재 사용자 위치를 보존하며, source·instance·동기화·조건·화면 geometry가 달라진 과거 복원은 적용하지 않는다. 관련 검증은 [TEST_PLAN의 PRE_QA REWORK](TEST_PLAN.md#issue-529-pre_qa-사용자-입력-취소-rework) 근거를 따른다.
