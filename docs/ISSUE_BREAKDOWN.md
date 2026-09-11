# GitHub issue work breakdown

상태: GitHub에 옮길 수 있는 로컬 issue 초안. 실제 GitHub Issue/PR을 생성하지 않았으며 W번호는 원격 issue 번호가 아니다. 공통 배경은 [REQUIREMENTS.md](REQUIREMENTS.md), 상태·순서는 [PLAN](exec-plans/active/PLAN.md)이다. 구현 결과는 각 issue의 test evidence와 QA/Manager review 후 완료 처리한다.

## W01 — Project Foundation

- Goal: Project Foundation 기능/기반을 검증 가능한 단위로 완성한다.
- Background: 애플리케이션과 lockfile이 아직 없다.
- Scope: Next.js/React/TypeScript, Node runtime, 최소 UI·테스트 구성
- Acceptance Criteria: 공식 버전/라이선스·peer/engine 확인과 lockfile; build/typecheck/smoke 성공; server-only DB 경계.
- Suggested / Assigned Agent: frontend + backend; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: Bootstrap 최종 QA/Manager ACCEPT.
- Related Documents: [ARCHITECTURE.md](ARCHITECTURE.md), [RESEARCH.md](RESEARCH.md).
- Status: W01 IMPLEMENTED — `c72fe18`; build/typecheck/lint/liveness unit·smoke PASS.
- Risk: 패키지 호환성.

## W02 — SQLite Foundation

- Goal: SQLite Foundation 기능/기반을 검증 가능한 단위로 완성한다.
- Background: 안전한 영속성 경계가 필요하다.
- Scope: Connection, SQL migrations, ledger/checksum, Repository
- Acceptance Criteria: projects/tasks/links/edit_sessions/holidays, FK/index, migration 실패와 rollback, 다른 Project FK 거부.
- Suggested / Assigned Agent: backend; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: W01.
- Related Documents: [DB_SCHEMA.md](DB_SCHEMA.md), [SECURITY.md](SECURITY.md).
- Status: W02 DONE — SQLite/Repository/CLI 구현, 독립 QA PASS / Manager ACCEPT. [검증 기록](W02_REVIEW.md)
- Risk: Native ABI와 migration.

## W03 — SVAR Minimal Integration

- Goal: SVAR Minimal Integration 기능/기반을 검증 가능한 단위로 완성한다.
- Background: 공식 Core API와 날짜 의미를 실측해야 한다.
- Scope: Client wrapper, theme, fixture task/link, readonly/event/date adapter
- Acceptance Criteria: 설치 version에서 browser mount·final update event·date 왕복·readonly, PRO 호출 없음, 한 logical command 경계. 실제 pointer drag/resize와 server persistence/rejection은 W07에서 검증한다.
- Suggested / Assigned Agent: frontend + researcher; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: W01.
- Related Documents: [RESEARCH.md](RESEARCH.md), [PRO_FEATURE_MATRIX.md](PRO_FEATURE_MATRIX.md), [W03_REVIEW.md](W03_REVIEW.md).
- Status: W03 DONE — Core 2.7.3 최소 통합, 독립 QA PASS / Manager ACCEPT.
- Risk: exclusive End 의미는 공식 예제 기반 추론이며 W06 server/browser date-only 계산은 PASS했지만 실제 drag/resize·저장 round-trip은 W07에서 재검증.

## W04 — Project Create and Direct Read

- Goal: Project Create and Direct Read 기능/기반을 검증 가능한 단위로 완성한다.
- Background: 최소 사용자 경로와 public ID가 필요하다.
- Scope: Project 생성·저장·direct Readonly, metadata API/UI
- Acceptance Criteria: strict 입력3개, UUID URL, DB 재조회, 원문 password 미노출, 생성 Project·password hash·최초 session 원자 저장; List는 D02 범위만 노출.
- Suggested / Assigned Agent: backend + frontend; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: W02.
- Related Documents: [API.md](API.md), [SECURITY.md](SECURITY.md), [W04_REVIEW.md](W04_REVIEW.md).
- Status: DONE — 독립 QA PASS / Manager ACCEPT. Create는 exact Origin, 32 KiB JSON, strict Zod, process-global 5/hour fail-closed limiter, scrypt concurrency 2, hardened Cookie를 포함한다. Direct GET은 Cookie와 무관하게 Readonly이며 collection GET은 405다. W05 UI는 별도 current-session 확인으로 edit 상태를 표시한다.
- Risk: production proxy의 지속 limiter와 KDF benchmark는 D03/W16에서 필요하다. 생성 session의 검증·unlock/logout/expiry/revoke/password rotation은 W05에서 완료했다.

## W05 — Readonly and Edit Authorization

- Goal: Readonly and Edit Authorization 기능/기반을 검증 가능한 단위로 완성한다.
- Background: UI 밖 mutation도 보호해야 한다.
- Scope: 저장된 scrypt/session의 검증·timing-safe compare, unlock/current/logout/expiry/revoke/password rotation, Project metadata 대표 보호 mutation과 revision. 생성 전용 KDF/session/cookie/Origin/rate 기반은 W04에서 구현됨
- Acceptance Criteria: W05에 적용 가능한 AUTH01–06, AUTH08, AUTH12와 AUTH07/09–11의 Project metadata/session slice; 잘못된·만료·revoke·auth-version·다른 Project session 거부; password rotation rollback; 실제 Route Handler와 보호 policy inventory. Task CRUD의 AUTH07과 Import preview/commit의 AUTH09–11은 W07/W12 전까지 BLOCKED/NOT TESTED로 유지한다.
- Suggested / Assigned Agent: backend + frontend; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: W04.
- Related Documents: [SECURITY.md](SECURITY.md), [API.md](API.md), [TEST_PLAN.md](TEST_PLAN.md), [W05_REVIEW.md](W05_REVIEW.md).
- Status: DONE — 독립 Backend/Security 및 Frontend/Browser QA PASS / Manager ACCEPT. Unlock/current/logout, metadata PATCH, password rotation, UI와 실제 route policy inventory를 구현했다. [검증 기록](W05_REVIEW.md)
- Risk: production persistent/proxy limiter·KDF benchmark는 D03/W16, Task/Import 전체 authorization은 W07/W12에 남는다.

## W06 — Working Calendar and Duration

- Goal: Working Calendar and Duration 기능/기반을 검증 가능한 단위로 완성한다.
- Background: 근무일 계산을 데이터 계약에 맞춰야 한다.
- Scope: Pure date-only calendar/duration/milestone
- Acceptance Criteria: 윤년·weekend·holiday·비근무 시작·범위·Manual 경계 unit; browser/server 동일 fixture.
- Suggested / Assigned Agent: scheduler; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: W01.
- Related Documents: [SCHEDULING_ENGINE.md](SCHEDULING_ENGINE.md), [TEST_PLAN.md](TEST_PLAN.md), [W06_REVIEW.md](W06_REVIEW.md).
- Status: DONE — Gregorian ordinal Calendar/Leaf Engine, 135 domain tests, raw SSR→hydrated Chromium timezone fixture와 독립 QA PASS / Manager ACCEPT. [검증 기록](W06_REVIEW.md)
- Risk: 실제 Task 저장·SVAR drag/resize는 W07, Summary/WBS는 W08, FS와 Calendar mutation의 aggregate Manual conflict는 W09에 남는다.

## W07 — Task and Link Persistence

- Goal: Task and Link Persistence 기능/기반을 검증 가능한 단위로 완성한다.
- Background: Gantt 편집을 원자적으로 저장해야 한다.
- Scope: Task CRUD, Link Repository foundation, project scope, canonical snapshot, revision, SVAR adapter. 실제 FS mutation endpoint 공개는 W09 검증 후다.
- Acceptance Criteria: AUTH/DB 테스트와 task edit/reload 유지, 서버 거부 복원, Task UUID와 externalId 분리.
- Suggested / Assigned Agent: backend + frontend; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: W03,W05,W06.
- Related Documents: [API.md](API.md), [DB_SCHEMA.md](DB_SCHEMA.md), [ARCHITECTURE.md](ARCHITECTURE.md).
- Status: PLANNED.
- Risk: 두 편집자 lost update.

## W08 — Hierarchy Summary and WBS

- Goal: Hierarchy Summary and WBS 기능/기반을 검증 가능한 단위로 완성한다.
- Background: 계층 UI와 파생 계산 경계를 맞춰야 한다.
- Scope: Atomic hierarchy batches, summary fields, sibling order/WBS
- Acceptance Criteria: SCH08–10; Summary+첫 child 성공, final empty/cycle 거부, REAL progress 정확성.
- Suggested / Assigned Agent: scheduler + backend + frontend; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: W06,W07.
- Related Documents: [SCHEDULING_ENGINE.md](SCHEDULING_ENGINE.md), [API.md](API.md).
- Status: PLANNED.
- Risk: 중간 invalid state·정렬.

## W09 — FS Scheduling Recalculation

- Goal: FS Scheduling Recalculation 기능/기반을 검증 가능한 단위로 완성한다.
- Background: 의존 관계 변경이 일관된 날짜를 만들어야 한다.
- Scope: DAG/cycle, forward pass, requested/effective separation, Calendar mutation 시 기존 Manual interval conflict 검증
- Acceptance Criteria: SCH04–07/11; Manual conflict 전체 rollback, link 제거 날짜 복귀, 미지원 관계 명시 오류.
- Suggested / Assigned Agent: scheduler + backend; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: W06,W07.
- Related Documents: [SCHEDULING_ENGINE.md](SCHEDULING_ENGINE.md), [PRO_FEATURE_MATRIX.md](PRO_FEATURE_MATRIX.md).
- Status: PLANNED.
- Risk: cycle·달력 계산 비용.

## W10 — Excel/VBA Environment POC

- Goal: Excel/VBA Environment POC 기능/기반을 검증 가능한 단위로 완성한다.
- Background: DRM Workbook의 승인된 경로를 먼저 확인해야 한다.
- Scope: 실제 VBA/cell/header/save/encoding/date 작은 POC
- Acceptance Criteria: VBA_EXPORT의 각 item PASS/FAIL/BLOCKED/UNKNOWN과 익명 증거; JSON/CSV 승인 위치; 우회 없음.
- Suggested / Assigned Agent: excel_vba + researcher; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: D01,W11. 작은 browser parser harness로 생성 파일을 읽는 초기 POC까지 완료한다. 완성된 앱의 preview/commit 후속 통합 시험은 W12/W13 후다.
- Related Documents: [VBA_EXPORT.md](VBA_EXPORT.md), [IMPORT_SCHEMA.md](IMPORT_SCHEMA.md).
- Status: BLOCKED ENVIRONMENT.
- Risk: 조직 정책·원본 구조.

## W11 — Import Contract Executable Fixtures

- Goal: Import Contract Executable Fixtures 기능/기반을 검증 가능한 단위로 완성한다.
- Background: Producer/consumer 계약을 실행 가능하게 검증해야 한다.
- Scope: JSON validation spec·canonical valid/invalid fixtures·CSV parity
- Acceptance Criteria: Backend+Excel 공동 리뷰, Unicode ID·summary·FS/end·BOM/quote·limits, QA 승인; 단독 변경 없음.
- Suggested / Assigned Agent: backend + excel_vba; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: Bootstrap 최종 QA, W06.
- Related Documents: [IMPORT_SCHEMA.md](IMPORT_SCHEMA.md), [VBA_EXPORT.md](VBA_EXPORT.md).
- Status: PLANNED.
- Risk: 정규화 손실.

## W12 — JSON and CSV Import Service

- Goal: JSON and CSV Import Service 기능/기반을 검증 가능한 단위로 완성한다.
- Background: Preview와 저장을 서버에서 검증해야 한다.
- Scope: Parse/schema/business preview and create-only transaction
- Acceptance Criteria: IMP01–07/09–10, stale preview412, fault injection rollback, metadata 미변경, 동일 CSV/JSON 결과.
- Suggested / Assigned Agent: backend; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: W08,W09,W11,W10 초기 POC PASS. 전체 Import 구현 전에 승인된 추출·파일 저장·browser 읽기를 증명한다.
- Related Documents: [IMPORT_SCHEMA.md](IMPORT_SCHEMA.md), [IMPORT_EXPORT.md](IMPORT_EXPORT.md), [API.md](API.md).
- Status: PLANNED.
- Risk: partial import·resource abuse.

## W13 — Import Wizard and Manual Fallback

- Goal: Import Wizard and Manual Fallback 기능/기반을 검증 가능한 단위로 완성한다.
- Background: 사용자가 오류와 이동 내역을 확인할 UI가 필요하다.
- Scope: 파일 선택/Mapping/Preview/검증/Commit/Result와 Manual Grid
- Acceptance Criteria: IMP08, row/path 오류 접근성, cancel/retry, 서버 diff 반영, 승인된 수동 경로만 제공.
- Suggested / Assigned Agent: frontend; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: W12.
- Related Documents: [IMPORT_EXPORT.md](IMPORT_EXPORT.md), [API.md](API.md), [REQUIREMENTS.md](REQUIREMENTS.md).
- Status: PLANNED.
- Risk: 모호한 날짜/진척 mapping.

## W14 — Excel/VBA Exporter

- Goal: Excel/VBA Exporter 기능/기반을 검증 가능한 단위로 완성한다.
- Background: POC 통과 뒤 재사용 가능한 producer가 필요하다.
- Scope: Header profile, IDs/relations, normalization, UTF8 JSON/CSV, error report
- Acceptance Criteria: 실제 POC 근거, stable IDs, 한글/date fixture, 누락 행 없음; W12/W13 실환경 round-trip.
- Suggested / Assigned Agent: excel_vba; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: W10 PASS,W11,W12,W13.
- Related Documents: [VBA_EXPORT.md](VBA_EXPORT.md), [IMPORT_SCHEMA.md](IMPORT_SCHEMA.md).
- Status: PLANNED.
- Risk: VBA 정책·환경차.

## W15 — Excel Table and Hyperlink Export

- Goal: Excel Table and Hyperlink Export 기능/기반을 검증 가능한 단위로 완성한다.
- Background: 웹 일정을 안전한 workbook으로 공유해야 한다.
- Scope: Backend ExcelJS Project/Tasks/Dependencies와 canonical URL
- Acceptance Criteria: XLS01–04, UTF8/date/formula-safe cells, hyperlink 실제 열기; secret/internal ID 없음.
- Suggested / Assigned Agent: backend + frontend; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: W07,W08,W09.
- Related Documents: [IMPORT_EXPORT.md](IMPORT_EXPORT.md), [SECURITY.md](SECURITY.md).
- Status: PLANNED.
- Risk: 잘못된 URL·workbook 메모리.

## W16 — Docker Deployment

- Goal: Docker Deployment 기능/기반을 검증 가능한 단위로 완성한다.
- Background: Native SQLite와 데이터 수명을 검증해야 한다.
- Scope: Dockerfile/compose/ignore/env example/health/volume/backup
- Acceptance Criteria: DEP01–07, target image build와 nonroot 권한, restart/restore 실제 PASS; 단일 app.
- Suggested / Assigned Agent: infra; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: W02,W05,W07; production D02/D03.
- Related Documents: [DEPLOYMENT.md](DEPLOYMENT.md), [DB_SCHEMA.md](DB_SCHEMA.md), [SECURITY.md](SECURITY.md).
- Status: PLANNED.
- Risk: ABI/libc·volume·backup.

## W17 — Independent E2E and Release Review

- Goal: Independent E2E and Release Review 기능/기반을 검증 가능한 단위로 완성한다.
- Background: 구현별 결과를 한 사용자 흐름으로 검증해야 한다.
- Scope: Regression, security, import/export, persistence, docs
- Acceptance Criteria: TEST_PLAN의 초기 범위 실제 증거와 qa_docs PASS/FAIL/BLOCKED/NOT TESTED; Manager sign-off.
- Suggested / Assigned Agent: qa_docs; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: W08,W09,W12,W13,W15,W16; VBA release W14.
- Related Documents: [TEST_PLAN.md](TEST_PLAN.md), [REQUIREMENTS.md](REQUIREMENTS.md).
- Status: PLANNED.
- Risk: 미검증을 PASS 처리.

## W18 — Excel Gantt Sheet Phase 2

- Goal: Excel Gantt Sheet Phase 2 기능/기반을 검증 가능한 단위로 완성한다.
- Background: Phase1 안정화 후 시각적 workbook 제공
- Scope: 날짜 cell Gantt, week/month/header, progress/milestone/summary/print
- Acceptance Criteria: XLS05 별도 검증, 범위 제한, Phase1 export 회귀 없음.
- Suggested / Assigned Agent: backend + frontend; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: W15 PASS,W17 초기 release 안정화.
- Related Documents: [IMPORT_EXPORT.md](IMPORT_EXPORT.md), [TEST_PLAN.md](TEST_PLAN.md).
- Status: DEFERRED.
- Risk: Excel sheet/size 제한.

## W19 — Advanced Scheduling Discovery

- Goal: Advanced Scheduling Discovery 기능/기반을 검증 가능한 단위로 완성한다.
- Background: 초기 기능 밖 관계·resource 의미를 별도로 정해야 한다.
- Scope: SS/FF/SF/lag/lead, baseline/CPM/slack/resource/group/rollup/split 분리 설계
- Acceptance Criteria: 공식 공개 근거, 비용·계약 영향 검토, 기능별 개별 issue; PRO 구현 비의존.
- Suggested / Assigned Agent: researcher + scheduler; 병렬 write 시 Manager가 파일을 분리한다.
- Dependencies: 초기 release와 실제 사용자 우선순위.
- Related Documents: [PRO_FEATURE_MATRIX.md](PRO_FEATURE_MATRIX.md), [SCHEDULING_ENGINE.md](SCHEDULING_ENGINE.md).
- Status: DEFERRED.
- Risk: 범위 확대·불명확한 제약.
