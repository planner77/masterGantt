# Active execution plan

상태: **W21 Synchronized Gantt Workspace 독립 QA PASS / Manager ACCEPT**. D04 정책 결정과 credential 재사용 위험 수용은 완료됐고, W20 원격 Actions/GHCR는 usable GitHub 인증과 실제 설정 적용 전까지 NOT TESTED/BLOCKED다. 다음 Scheduling 구현은 W08 Hierarchy Summary and WBS다. 근거: [Requirements](../../REQUIREMENTS.md), [W21 Review](../../W21_REVIEW.md), [Decisions](../../DECISIONS.md), [Issue drafts](../../ISSUE_BREAKDOWN.md).

## Phase와 Task

| Phase | Task | Dependency | Assigned Agent | Acceptance Criteria | Status | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| B0 | 저장소/설정/요구 검사 | 최신 pull | Manager | 7개 TOML과 현재 파일/소스 상태 기록 | DONE STATIC | runtime 적용 검증 한계 |
| B1 | 공식 조사·설계·Import 계약 | B0 | researcher/backend/scheduler/excel_vba/infra | 공식 근거와 계약·경계 문서 | DONE PLANNING | 실제 Excel·native 미검증 |
| B2 | Test strategy·초기 독립 QA | B1 | qa_docs | 실제 문서 대조와 구체적 findings | DONE INITIAL REVIEW | 전체 통합 후 재검토 필요 |
| B3 | Manager 보완·Issue 분해 | B2 | Manager | findings 반영, dependency/AC/owner/risk 작성 | DONE PLANNING | 구현 결과 별도 검증 |
| B4 | 최종 독립 review→Manager 판단 | B3 | qa_docs→Manager | 최종 계약 일치, blocker 판정, review 증거 | PASS / ACCEPT | runtime 검증과 구분 |
| P1 | W01 Project Foundation | Bootstrap 최종 QA/Manager ACCEPT | frontend + backend | 공식 버전/라이선스·peer/engine 확인과 lockfile; build/typecheck/smoke 성공; server-only DB 경계 | DONE | Turbopack sandbox 제한; Webpack PASS |
| P1 | W02 SQLite Foundation | W01 | backend + qa_docs + Manager | projects/tasks/links/edit_sessions/holidays, FK/index, migration 실패와 rollback, 다른 Project FK 거부 | DONE / PASS / ACCEPT | Native Docker platform은 W16 검증 |
| P1 | W03 SVAR Minimal Integration | W01 | frontend + researcher + qa_docs + Manager | 설치 version에서 browser mount·final update event·date 왕복·readonly, PRO 호출 없음, 한 logical command 경계 | DONE / PASS / ACCEPT | exclusive end 추론의 실제 root pointer 왕복은 W07 PASS |
| P2 | W04 Project Create and Direct Read | W02 | backend + frontend + qa_docs + Manager | strict 입력3개, UUID URL, DB 재조회, scrypt+최초 session 원자 저장, 원문 password 미노출; D02 전 List 차단 | DONE / PASS / ACCEPT | production limiter·KDF benchmark는 W16 |
| P2 | W05 Readonly and Edit Authorization | W04 | backend + frontend + qa_docs + Manager | W05 적용 AUTH slice; 잘못된·만료·revoke·다른 Project session 거부; metadata 보호 mutation/revision; password rotation; route inventory | DONE / PASS / ACCEPT | production limiter·KDF benchmark는 W16; root Task auth W07 PASS, Import W12 |
| P2 | W06 Working Calendar and Duration | W01 | scheduler + frontend + researcher + qa_docs + Manager | 윤년·weekend·holiday·비근무 시작·범위·Manual 경계 unit; browser/server 동일 fixture | DONE / PASS / ACCEPT | root Leaf 저장 W07 PASS; Summary/WBS·FS는 W08/W09 |
| P2 | W07 Task and Link Persistence | W03,W05,W06 | backend + frontend + researcher + scheduler + qa_docs + Manager | root Task/Milestone strict CRUD, AUTH/DB rollback·reopen, 실제 pointer edit/reload·거부 복원, same-revision race, Task UUID/externalId 분리, Link Repository foundation | DONE / PASS / ACCEPT | Summary/Hierarchy·Link Route·FS는 W08/W09; 기존 구조는 fail-closed |
| P1 | W20 CI/CD and Semantic Container Release | W02,W07; W16 runtime 일부 선행 | infra + backend + researcher + qa_docs + Manager | PR/main Actions, strict·monotonic SemVer/annotated tag, non-root image·runtime config·readiness·restart persistence, candidate→GHCR digest→exact promotion, 최소 권한·SHA/digest pin, 상시 문서 규칙 | DONE LOCAL / D04 DECIDED / PASS / ACCEPT | remote 인증·ruleset/GHCR 적용·실행은 BLOCKED |
| P1 | W21 Synchronized Gantt Workspace | W03,W07 | frontend + researcher + qa_docs + Manager | UI03–10, empty/0→1 Grid+Chart, explicit columns/gridWidth, Desktop viewport geometry, narrow inner scroll, auth/persistence regression | DONE / PASS / ACCEPT | persisted Summary/reparent/WBS는 W08; Resizer pointer 자동화 미검증 |
| P2 | W08 Hierarchy Summary and WBS | W06,W07 | scheduler + backend + frontend | SCH08–10; Summary+첫 child 성공, final empty/cycle 거부, REAL progress 정확성 | PLANNED | 중간 invalid state·정렬 |
| P2 | W09 FS Scheduling Recalculation | W06,W07 | scheduler + backend | SCH04–07/11; Manual conflict 전체 rollback, link 제거 날짜 복귀, 미지원 관계 명시 오류 | PLANNED | cycle·달력 계산 비용 |
| P3 | W10 Excel/VBA Environment POC | D01,W11의 작은 browser parser harness | excel_vba + researcher | 승인 VBA·추출·JSON/CSV 저장·한글/날짜·browser 실제 파일 읽기 증거; 후속 앱 통합은 W12/W13 후 | BLOCKED ENVIRONMENT | 조직 정책·원본 구조 |
| P3 | W11 Import Contract Executable Fixtures | Bootstrap 최종 QA, W06 | backend + excel_vba | Backend+Excel 공동 리뷰, Unicode ID·summary·FS/end·BOM/quote·limits, QA 승인; 단독 변경 없음 | PLANNED | 정규화 손실 |
| P3 | W12 JSON and CSV Import Service | W08,W09,W11,W10 초기 POC PASS | backend | IMP01–07/09–10, stale preview412, fault injection rollback, metadata 미변경, 동일 CSV/JSON 결과 | PLANNED | partial import·resource abuse |
| P3 | W13 Import Wizard and Manual Fallback | W12 | frontend | IMP08, row/path 오류 접근성, cancel/retry, 서버 diff 반영, 승인된 수동 경로만 제공 | PLANNED | 모호한 날짜/진척 mapping |
| P3 | W14 Excel/VBA Exporter | W10 PASS,W11,W12,W13 | excel_vba | 실제 POC 근거, stable IDs, 한글/date fixture, 누락 행 없음; W12/W13 실환경 round-trip | PLANNED | VBA 정책·환경차 |
| P4 | W15 Excel Table and Hyperlink Export | W07,W08,W09 | backend + frontend | XLS01–04, UTF8/date/formula-safe cells, hyperlink 실제 열기; secret/internal ID 없음 | PLANNED | 잘못된 URL·workbook 메모리 |
| P4 | W16 Docker Deployment | W02,W05,W07; production D02/D03 | infra | DEP01–07, target image build와 nonroot 권한, restart/restore 실제 PASS; 단일 app | PLANNED | ABI/libc·volume·backup |
| P4 | W17 Independent E2E and Release Review | W08,W09,W12,W13,W15,W16; VBA release W14 | qa_docs | TEST_PLAN의 초기 범위 실제 증거와 qa_docs PASS/FAIL/BLOCKED/NOT TESTED; Manager sign-off | PLANNED | 미검증을 PASS 처리 |
| P5 | W18 Excel Gantt Sheet Phase 2 | W15 PASS,W17 초기 release 안정화 | backend + frontend | XLS05 별도 검증, 범위 제한, Phase1 export 회귀 없음 | DEFERRED | Excel sheet/size 제한 |
| P5 | W19 Advanced Scheduling Discovery | 초기 release와 실제 사용자 우선순위 | researcher + scheduler | 공식 공개 근거, 비용·계약 영향 검토, 기능별 개별 issue; PRO 구현 비의존 | DEFERRED | 범위 확대·불명확한 제약 |

## 최초 Vertical Slice

W07은 Task CRUD와 Link 저장 기반까지이며 실제 FS mutation endpoint는 W09 검증 후 공개한다. W10 초기 환경/serialization POC와 W12/W13 이후 full application 통합 검증을 구분한다.

B4 후 W01→W02/W03→W04→W05→W06→W07의 작은 범위인 Project 생성→SQLite 저장→새 browser Direct Readonly→password unlock→단일 Task 편집→reload 유지를 완료했다. build/typecheck, authorization/isolation integration, date adapter, persistence E2E와 독립 QA를 통과했다. 전체 Import와 advanced scheduling은 후속 단계로 유지한다.

## 병렬 작업과 소유권

동시 실행은 세션 한도에 따라 Main+전문 Agent 최대3개다. Main은 공용 API/Import/Scheduling/Deployment 계약 변경을 조정한다. Backend는 server/db, Frontend는 UI/Gantt, Scheduler는 domain, Excel은 excel/vba, Infra는 Docker/운영을 소유한다. 공용 계약이나 같은 파일을 여러 write agent가 동시에 수정하지 않는다. qa_docs/researcher는 read-only 결과를 반환하고 Manager가 문서에 반영한다.

실제 구현 시 각 issue에 명시한 directory를 branch/worktree로 분리할 수 있으며 QA와 Manager 검토 후 merge한다. 원격에는 완료한 기반 작업과 검증 기록을 포함하며, 전체 제품 release 승인은 W17에서 별도로 수행한다.

## 환경 Gate와 후속 처리

- D01: 조직이 대상 Excel의 macro/cell/file export와 저장 위치를 확인해야 실제 POC를 진행한다. Fixture 기반 contract 검증과 분리한다.
- D02: Project list/read/create의 접근 범위는 실데이터 공개 전 결정한다.
- D03: target CPU/host/domain/TLS/volume/backup 정책은 배포 실행 전 확인한다.
- qa_docs 재시도에서 B4 독립 review가 완료되었다. 구현 후에도 각 issue의 실제 test evidence와 독립 QA/Manager review를 다시 수행한다.
- W01 실행 결과: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`(Webpack), health endpoint smoke PASS. 기본 Turbopack은 sandbox process/port 제한으로 실행하지 않았다.
- W02 실행 결과: build/typecheck/lint PASS, 전체 17 tests PASS, 독립 DB/CLI 16 tests PASS. [검증 기록](../../W02_REVIEW.md)
- W03 실행 결과: Core 2.7.3 browser fixture, build/typecheck/lint PASS, 전체 23 Vitest와 Chromium E2E 1개 PASS, 독립 QA PASS. [검증 기록](../../W03_REVIEW.md)
- W04 실행 결과: `POST /api/projects`, `GET /api/projects/{publicId}`, 생성/직접 UI 구현. Manager와 독립 QA가 build/typecheck/lint, 전체 55 Vitest를 PASS했고 Manager Chromium E2E 3개도 PASS했다. Project+session 원자성, 재시작 DB 재조회, Project 격리, Origin/body/rate/KDF/cookie/secret 경계를 검증했다. `GET /api/projects`는 D02 전 405다. qa_docs PASS / Manager ACCEPT. [검증 기록](../../W04_REVIEW.md)
- W05 실행 결과: unlock/current/logout, metadata PATCH, password rotation, edit UI와 실제 Route security inventory 구현. 최초 독립 QA의 expiry lock race, wrong-project Cookie 유효성, canonical protected ID finding을 수정했다. 전체 91 Vitest, typecheck/lint/build와 clean 기본 Turbopack Chromium 4/4(worker 1)를 PASS했다. Process-global create limiter를 spec 사이에서 경쟁시키지 않되 동일 revision concurrent PATCH 200+412는 spec 내부 병렬 HTTP로 유지했고, live HEAD/OPTIONS 불변, rotation rollback/old session 무효화를 포함한다. Backend/Security·Frontend/Browser qa_docs PASS / Manager ACCEPT. [검증 기록](../../W05_REVIEW.md)
- W06 실행 결과: `1900-01-01..2199-12-31` Gregorian ordinal, exact `Asia/Seoul`/`[6,0]`, 중복 Holiday 거부·nullable name 보존, inclusive 근무일과 calendar-only Leaf/Milestone 계산을 pure Domain으로 구현했다. 최초 독립 QA의 SSR-only runtime 증거와 Holiday `name: null` 불일치를 수정하고 malformed leaf/context도 보강했다. Domain 135/135, 전체 226/226 Vitest, typecheck/lint/build, clean 기본 Turbopack Chromium 7/7과 production dependency audit 0건을 PASS했다. Scheduler/Frontend/Browser qa_docs PASS / Manager ACCEPT. [검증 기록](../../W06_REVIEW.md)
- W07 실행 결과: root Task/Milestone POST/PATCH/DELETE, 32 KiB strict 입력, Project-scoped ScheduleRepository CRUD와 Link foundation, W06 `scheduleLeaf`, canonical snapshot/ETag를 연결했다. 실제 Handler→Service→SQLite authorization, cross-project UUID, transaction expiry/auth-version/rotation, create/update/delete/readback rollback, file reopen, same-revision HTTP `201+412`를 검증했다. 실제 SVAR 우측/좌측 resize·이동·삭제·reload와 401/412/422/500·canonical read 실패 복원도 통과했다. 전체 291/291 Vitest, typecheck/lint/build, clean 기본 Turbopack Chromium 8/8과 production dependency audit 0건 PASS. qa_docs PASS / Manager ACCEPT. [검증 기록](../../W07_REVIEW.md)
- W20 실행 결과: PR/main read-only CI와 annotated strict·monotonic SemVer release를 분리했다. Release는 local candidate gate 뒤 immutable commit candidate만 push하고 GHCR digest runtime smoke·attestation 성공 후 stable alias와 exact version을 승격한다. 24 files/309 Vitest, typecheck/lint/build, Chromium 8/8, actionlint, audit/link, final `linux/amd64` non-root image, missing/insecure URL exit 1, readiness/native SQLite restart persistence를 PASS했다. qa_docs PASS / Manager ACCEPT. 원격 Actions/GHCR는 NOT TESTED/BLOCKED. [검증 기록](../../W20_REVIEW.md)
