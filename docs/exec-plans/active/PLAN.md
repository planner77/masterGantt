# Active execution plan

## PR #24 review 경계 후속 — 진행 중

PR #24 자동 review에서 확인한 375px compact header 경계와 Architecture 현재 UX 본문 정합화를 후속 처리한다. 기준 main은 병합 commit `820aeba800f48b035e4219f8094a5038593c8eb0`, 작업 branch는 `fix/pr24-review-boundaries`다. 이전 PR의 PASS를 새 변경에 전용하지 않으며 로컬 테스트 보류를 유지한다. 새 head의 원격 quality/E2E/Docker와 문서 link 검증이 끝날 때까지 **NOT TESTED**다. 세부 경계는 [후속 기록](../../PR23_FOLLOWUP.md)과 [대기 목록](../../PENDING_TESTS.md)을 따른다.

## PR #23 미해결 리뷰 후속 — PR #24 병합 완료

사용자 요청으로 미해결 P2 두 건(390px 알림 벨의 상단 navigation 가림, `INVALID_CREDENTIALS` 진단 코드 누락)을 PR #24에서 수정하고 `820aeba800f48b035e4219f8094a5038593c8eb0`로 main에 병합했다. 최종 PR head `93b6f9497ac937b46695327ef85fdc08efb76a7c`의 CI `34784330854` quality/E2E/Docker와 main CI `34784810624`의 4개 job 및 immutable `ci-820aeba800f48b035e4219f8094a5038593c8eb0` image 게시·검증은 PASS다. 로컬 테스트는 사용자 보류에 따라 NOT TESTED이며 별도 SemVer release와 운영 배포는 범위 밖이다. 실제 사내 proxy/Windows clipboard/스크린리더/최종 사용자 UX는 대상 환경이 필요한 미실행 항목으로 유지한다. 근거와 결과는 [후속 기록](../../PR23_FOLLOWUP.md)을 따른다.

## Issue #3 — 작업 추가 중 Gantt 인스턴스 유지 (진행 중)

- 사용자 요청으로 원격 `main`을 `d540eb5`까지 fast-forward했다. 기존 `next-env.d.ts`의 개발 서버 생성 변경은 보존하고 이번 커밋에서 제외한다.
- 열린 Issue 중 생성 시각이 가장 빠른 [#3](https://github.com/planner77/masterGantt/issues/3)을 처리한다. 작업 branch: `fix/issue-3-stable-gantt`.
- Frontend: 정상 저장의 key/권한/요청 상태 분리, canonical snapshot 동기화와 UI 상태 유지. QA: 지연 응답·중복 요청·인스턴스·화면 상태 회귀 테스트와 독립 검토. Infra: 해당 PR/head의 원격 quality/e2e/docker 확인. Manager: 통합·문서·판정.
- API/DB/일정 계산 계약과 명시적 실패 복구는 유지한다. 낙관적 임시 ID, PRO 기능, release 및 운영 배포는 범위 밖이다.
- 기존 로컬 테스트 보류 요청을 존중하여 로컬 실행은 하지 않는다. 이번 Issue의 공식 검증은 최신 [GitHub-first 정책](../../REMOTE_VALIDATION.md)에 따른 branch/PR Actions로 진행한다. 아래 과거 보류 기록과 W24 PASS는 이번 Issue의 결과가 아니다.
- 현재 판정: 구현/원격 검증 진행 전, **NOT TESTED**. 실제 결과와 남은 항목은 [Issue #3 기록](../../ISSUE_3_REVIEW.md)에 갱신한다.

현재 추가 작업: **Grid Header 우클릭 열 선택 — 로컬 커밋 / 검증 대기**. 외부 ID는 기본 숨김, 기존 별도 버튼 제거. 데이터 열 선택은 최소 한 열을 유지하고 같은 workspace 안에서만 보존한다. 테스트·빌드·원격 push는 보류하며 [대기 목록](../../PENDING_TESTS.md)에 검증 항목을 기록한다.

추가 후속 작업: **Grid/Chart 상단 ‘작업 추가 또는 삭제’ 패널 제거 — 로컬 커밋 / 검증 대기**. Native Grid `+`와 서버 API는 유지하며 테스트·원격 push 보류 정책은 동일하다. 제거된 패널에 의존하는 E2E 갱신 항목을 [대기 목록](../../PENDING_TESTS.md)에 추가한다.

현재 후속 작업: **작업 생성 이름·날짜·기간 자동 적용 — 로컬 커밋 / 일괄 검증 대기**. 입력 없이 `새 작업`·브라우저 오늘·1일을 적용하며 일반 Task의 Summary 전환 확인만 유지한다. 사용자 요청에 따라 로컬 커밋만 수행하고 테스트·빌드·CI 실행과 원격 push는 별도 요청까지 보류한다. [검증·원격 반영 대기 목록](../../PENDING_TESTS.md)에 재개 절차를 기록한다. 아래 W24 PASS는 이 후속 변경 이전의 기록이다.

상태: **W24 Project Grid/Delete/Hierarchical Gantt UI LOCAL PASS / Manager ACCEPT**. 목록 표·보호 삭제·native Header/행 `+`·child 저장/summary 집계·locale·주말·고정 header 작업공간을 구현했다. 전체 Unit 378/28 files, Chromium E2E 10, build/typecheck/lint PASS. 사용자 승인으로 W08의 Summary/계층 일부를 선행하되 WBS/reparent/FS 전체를 완료로 처리하지 않는다. 원격 CI/이미지 결과는 별도이다. 근거: [Requirements](../../REQUIREMENTS.md), [W24 Review](../../W24_REVIEW.md), [Decisions](../../DECISIONS.md), [Issue drafts](../../ISSUE_BREAKDOWN.md).

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
| P1 | W20 CI/CD and Semantic Container Release | W02,W07; W16 runtime 일부 선행 | infra + backend + researcher + qa_docs + Manager | PR/main Actions, strict·monotonic SemVer/annotated tag, non-root image·runtime config·readiness·restart persistence, candidate→GHCR digest→exact promotion, 최소 권한·SHA/digest pin, 상시 문서 규칙 | DONE / PASS / ACCEPT | W22에서 remote release까지 PASS; ruleset 미강제 위험 수용 |
| P1 | W21 Synchronized Gantt Workspace | W03,W07 | frontend + researcher + qa_docs + Manager | UI03–10, empty/0→1 Grid+Chart, explicit columns/gridWidth, Desktop viewport geometry, narrow inner scroll, auth/persistence regression | DONE / PASS / ACCEPT | persisted Summary/reparent/WBS는 W08; Resizer pointer 자동화 미검증 |
| P1 | W22 Main Commit GHCR Automation | W20,W21 | infra + qa_docs + Manager | 성공한 main만 immutable `ci-<SHA>` 게시, release `sha-<SHA>`와 분리, 두 digest를 registry에서 새로 pull해 policy/readiness/HTTP Project·Task auth/restart persistence 검증, PR·수동 CI read-only | DONE / PASS / ACCEPT | ruleset 미강제 위험 수용, GitHub Attestation 비활성; W16 운영 범위 별도 |
| P1 | W23 Project List 활성화 | D02,W04,W05 | backend + frontend + qa_docs + Manager | 전체 공개 summary, 최신 수정순, no-store, 생성→목록 복귀·reload, secret 제외, 기존 Mutation 인증 유지 | DONE LOCAL / PASS / ACCEPT | 원격 이미지·운영 네트워크 공개는 별도 |
| P1 | W24 Project Grid/Delete/Hierarchical Gantt UI | W23,W06,W07 | backend + frontend + scheduler + researcher + qa_docs + Manager | 표 목록·권한 삭제, Header root/row child, 명시 Summary 전환·집계, today/1day·locale·주말·column toggle·고정 headers | LOCAL PASS / ACCEPT | 원격 CI/image 별도 확인; subtree/reparent 후속 |
| P2 | W08 Hierarchy Summary and WBS | W06,W07 | scheduler + backend + frontend | SCH08–10; Summary+첫 child 성공, final empty/cycle 거부, REAL progress 정확성 | PARTIAL IN W24 | WBS/reparent 및 유효한 subtree 삭제 묶음 후속 |
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
- D02: 앱 접속자 전체 목록 공개 승인 완료. 인터넷 공개 및 운영 네트워크 경계는 별도 배포 결정이다.
- D03: target CPU/host/domain/TLS/volume/backup 정책은 배포 실행 전 확인한다.
- qa_docs 재시도에서 B4 독립 review가 완료되었다. 구현 후에도 각 issue의 실제 test evidence와 독립 QA/Manager review를 다시 수행한다.
- W01 실행 결과: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`(Webpack), health endpoint smoke PASS. 기본 Turbopack은 sandbox process/port 제한으로 실행하지 않았다.
- W02 실행 결과: build/typecheck/lint PASS, 전체 17 tests PASS, 독립 DB/CLI 16 tests PASS. [검증 기록](../../W02_REVIEW.md)
- W03 실행 결과: Core 2.7.3 browser fixture, build/typecheck/lint PASS, 전체 23 Vitest와 Chromium E2E 1개 PASS, 독립 QA PASS. [검증 기록](../../W03_REVIEW.md)
- W04 실행 결과: `POST /api/projects`, `GET /api/projects/{publicId}`, 생성/직접 UI 구현. Manager와 독립 QA가 build/typecheck/lint, 전체 55 Vitest를 PASS했고 Manager Chromium E2E 3개도 PASS했다. Project+session 원자성, 재시작 DB 재조회, Project 격리, Origin/body/rate/KDF/cookie/secret 경계를 검증했다. `GET /api/projects`는 D02 전 405다. qa_docs PASS / Manager ACCEPT. [검증 기록](../../W04_REVIEW.md)
- W05 실행 결과: unlock/current/logout, metadata PATCH, password rotation, edit UI와 실제 Route security inventory 구현. 최초 독립 QA의 expiry lock race, wrong-project Cookie 유효성, canonical protected ID finding을 수정했다. 전체 91 Vitest, typecheck/lint/build와 clean 기본 Turbopack Chromium 4/4(worker 1)를 PASS했다. Process-global create limiter를 spec 사이에서 경쟁시키지 않되 동일 revision concurrent PATCH 200+412는 spec 내부 병렬 HTTP로 유지했고, live HEAD/OPTIONS 불변, rotation rollback/old session 무효화를 포함한다. Backend/Security·Frontend/Browser qa_docs PASS / Manager ACCEPT. [검증 기록](../../W05_REVIEW.md)
- W06 실행 결과: `1900-01-01..2199-12-31` Gregorian ordinal, exact `Asia/Seoul`/`[6,0]`, 중복 Holiday 거부·nullable name 보존, inclusive 근무일과 calendar-only Leaf/Milestone 계산을 pure Domain으로 구현했다. 최초 독립 QA의 SSR-only runtime 증거와 Holiday `name: null` 불일치를 수정하고 malformed leaf/context도 보강했다. Domain 135/135, 전체 226/226 Vitest, typecheck/lint/build, clean 기본 Turbopack Chromium 7/7과 production dependency audit 0건을 PASS했다. Scheduler/Frontend/Browser qa_docs PASS / Manager ACCEPT. [검증 기록](../../W06_REVIEW.md)
- W07 실행 결과: root Task/Milestone POST/PATCH/DELETE, 32 KiB strict 입력, Project-scoped ScheduleRepository CRUD와 Link foundation, W06 `scheduleLeaf`, canonical snapshot/ETag를 연결했다. 실제 Handler→Service→SQLite authorization, cross-project UUID, transaction expiry/auth-version/rotation, create/update/delete/readback rollback, file reopen, same-revision HTTP `201+412`를 검증했다. 실제 SVAR 우측/좌측 resize·이동·삭제·reload와 401/412/422/500·canonical read 실패 복원도 통과했다. 전체 291/291 Vitest, typecheck/lint/build, clean 기본 Turbopack Chromium 8/8과 production dependency audit 0건 PASS. qa_docs PASS / Manager ACCEPT. [검증 기록](../../W07_REVIEW.md)
- W20 실행 결과: PR/main read-only CI와 annotated strict·monotonic SemVer release를 분리했다. Release는 local candidate gate 뒤 immutable commit candidate만 push하고 GHCR digest runtime smoke와, 활성화된 경우 GitHub Attestation 성공 후 stable alias와 exact version을 승격한다. 24 files/309 Vitest, typecheck/lint/build, Chromium 8/8, actionlint, audit/link, final `linux/amd64` non-root image, missing/insecure URL exit 1, readiness/native SQLite restart persistence를 PASS했다. qa_docs PASS / Manager ACCEPT. 당시 원격 Actions/GHCR는 NOT TESTED/BLOCKED였고, W22에서 admin 인증 성공 후 실제 artifact 증거를 계속 추적한다. [검증 기록](../../W20_REVIEW.md)
- W22 실행 결과: Main CI `34659591764`, PR `34659639024`와 release `34659839100`이 원격 PASS했다. Commit digest `sha256:09d815cf67fc9aeb5454bfdb1c76dee6361fa61423759a4e297fa6c328c12ae4`와 release digest `sha256:c03cf6f24a02917670df94334a648ba541d14652a5922e591efaa6df85b082eb`는 원격·로컬에서 policy/readiness/HTTP Project·Task authorization·restart persistence를 PASS했다. Release tag 전체가 동일 digest로 promotion됐고 양쪽 SPDX 2.3 SBOM 510 packages와 SLSA provenance도 조회했다. qa_docs PASS / Manager ACCEPT. [검증 기록](../../W22_REVIEW.md)

## Repository layout work (#12 / #13)

사용자 승인에 따라 배포 파일 정리와 테스트 설정 정리를 별도 커밋/stacked PR로 진행한다. 배포 구조와 새 검증은 #12, 테스트 config 이동은 #13에서 추적한다. 이 기록은 main 반영이나 CI PASS를 의미하지 않는다. 각 head의 quality/E2E/docker 실행 결과를 PR에 남기고 배포 PR → 테스트 설정 PR 순서로 검토한다. 실제 운영 배포, 데이터 이동, HTTP 지원, Node 버전 전환은 이번 범위에서 제외한다.

## Issue #8 — 내부망 HTTP

전용 브랜치에서 URL/쿠키/설정 주입/공유 URL과 문서를 갱신한다. PR quality/E2E/Docker 및 HTTP·HTTPS 실제 브라우저 검증 후 리뷰·병합하고 main exact digest 결과를 별도로 기록한다. 본 계획 추가만으로 PASS가 아니며 운영 Windows/WSL2 전환은 별도 미검증이다.
