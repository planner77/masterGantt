# W07 Task and Link Persistence 검증 기록

검증일: 2026-09-11
최종 판정: **DONE / PASS / ACCEPT**

## Summary

W07은 Project별 root Leaf Task와 Milestone의 생성·수정·삭제를 보호 REST API, W06 Scheduling Engine, SQLite Repository와 실제 SVAR React Gantt UI에 연결했다. 모든 성공 응답은 증가한 aggregate revision, ETag, Project/tasks/links 전체 canonical snapshot, warning과 operation detail을 반환한다. 브라우저는 최종 SVAR 명령 하나만 저장하고 서버 결과로 화면을 교체한다.

W07의 Link 범위는 Project-scoped Repository CRUD와 DB constraint/rollback foundation이다. 외부 Link route, incident Link를 동반한 Task 삭제와 FS 재계산은 W09까지 공개하지 않는다. Summary/Hierarchy/WBS는 W08 범위다. 따라서 기존 snapshot에 Summary, non-root Task 또는 Link가 하나라도 있으면 W07 Task mutation은 `409 UNSUPPORTED_SCHEDULE_STRUCTURE`로 fail-closed한다.

## Requirement Coverage

| 요구 | 판정 | 검증 내용 |
| --- | --- | --- |
| Root Task/Milestone CRUD | PASS | POST/PATCH/DELETE, server root append, canonical full snapshot과 operation detail |
| Strict HTTP 입력 | PASS | 32 KiB 실제/선언 크기, JSON content type, strict allowlist, empty PATCH·unknown field 거부 |
| Task identity | PASS | immutable canonical UUID `taskId`, Project-scoped case-sensitive opaque `externalId`, 자동 생성 시 서로 다른 UUID와 3회 collision 상한 |
| 문자열·숫자 경계 | PASS | name trim 후 1..200 code point, externalId 1..128·well-formed·boundary whitespace/control 거부, progress finite 0..100 |
| Scheduling 연결 | PASS | W06 `scheduleLeaf`, requested/effective start 분리, weekend/holiday Auto warning, Manual·end assertion rollback |
| Authorization | PASS | no/malformed/wrong-Project/expired/revoked/auth-version Cookie, password rotation 이전 session, cross-project Task UUID 거부 |
| Optimistic concurrency | PASS | missing 428, stale 412, 동일 revision 실제 HTTP 요청 둘 중 정확히 하나만 성공, revision 1회 증가 |
| Atomic persistence | PASS | session-first `BEGIN IMMEDIATE`, create/update/delete/readback fault rollback, 성공당 revision 정확히 1 증가 |
| Reopen persistence | PASS | file-backed SQLite close/reopen 뒤 identity, requested/effective dates, duration, REAL progress, revision 보존; 삭제 부재는 browser reload로 검증 |
| Link Repository foundation | PASS | Project-scoped insert/read/update/delete, self/duplicate/cross-project constraint, enclosing transaction rollback |
| Route security inventory | PASS | Task unsafe method 3개 모두 `origin-session-if-match`, 실제 route export 대조 |
| Gantt CRUD UI | PASS | edit session에서 추가·삭제, readonly에서는 control/command 비활성, single in-flight mutation |
| 실제 pointer 저장 | PASS | Core 2.7.3 우측 resize→좌측 resize→move→delete, inclusive/exclusive end 변환과 reload 유지 |
| 서버 거부 복원 | PASS | 401/412/422/500 뒤 canonical snapshot 복원; canonical GET도 실패하면 마지막 확정 React snapshot으로 강제 remount |
| Summary/Hierarchy/WBS | BLOCKED / W08 | W07은 표시 가능하더라도 mutation을 허용하지 않음 |
| Link route·FS scheduling | BLOCKED / W09 | Repository foundation만 있고 공개 route·graph 재계산 없음 |

## Research Findings

- 공식 Core API는 Task 표시·편집, drag/resize, readonly와 `onUpdateTask` event를 제공한다. `readonly`는 UI 동작만 막으므로 server authorization을 대체하지 않는다.
- 설치된 Core 2.7.3의 pointer final event는 signed calendar-day `diff`를 사용한다. Store 처리 뒤 callback Task가 전체 상태를 포함할 수 있어 field 존재 여부만으로 move/resize를 구분할 수 없다.
- 공식 문서는 `end`의 inclusive/exclusive 의미를 명시적으로 보장하지 않는다. W03의 공식 REST 예제 기반 exclusive 추론을 W07 실제 pointer round-trip으로 검증했으며, 본 Domain의 end는 계속 inclusive다.
- 공식 Data Provider는 본 프로젝트의 Project Cookie, required `If-Match`, server-side Scheduling과 canonical full snapshot 응답을 그대로 표현하지 않아 직접 command adapter를 유지했다.

외부 근거와 추론 구분은 [RESEARCH.md](RESEARCH.md)에 기록했다.

## Architecture Decisions

- 공개 route는 `POST /api/projects/{publicId}/tasks`, `PATCH|DELETE /api/projects/{publicId}/tasks/{taskId}`다. Link route는 만들지 않았다.
- Route 순서는 exact Origin → bounded/strict body → Project-bound authorization → required If-Match다. Service는 write lock 이후 session을 다시 확인하고 revision을 비교한다.
- POST는 root `task | milestone`만 받고 sibling order는 server가 root 끝에 부여한다. PATCH는 name/mode/start/duration/progress와 optional end assertion만 허용하며 identity/type/parent/order는 바꾸지 않는다.
- Service의 public method도 같은 strict contract를 다시 검증해 Handler 우회나 잘못된 내부 caller가 noncanonical 값을 저장하지 못한다.
- SVAR ID에는 Task `taskId`, hierarchy/link 변환에는 `externalId` mapping을 사용해 두 식별자를 섞지 않는다.
- 이동은 새 `requestedStart`, 좌측 resize는 `start + duration`, 우측 resize는 `duration` PATCH로 변환한다. 성공 후 widget 내부 값을 신뢰하지 않고 server snapshot으로 remount한다.
- W08/W09 기능이 없는 상태에서 부분 aggregate를 계산하지 않도록 hierarchy나 Link가 있는 schedule mutation을 전체 거부한다.

## Verification

검증 환경: Linux 6.6.87.2 WSL2 x86_64, Node.js 22.14.0, npm 11.10.0, Chromium 145.0.7632.6.

| 검증 | 결과 |
| --- | --- |
| 전체 Vitest | PASS — 21 files / 291 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — warning 0 |
| `npm run build` | PASS — Next.js 16.3.4 Webpack production build, Task routes 포함 |
| `npm run test:e2e` | PASS — clean isolated SQLite, 기본 Turbopack, Chromium 8/8, worker 1 |
| W07 pointer/failure/race E2E | PASS — 실제 양방향 resize/move/delete/reload, 401/412/422/500/read failure 복원, concurrent `201+412` |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS |
| 로컬 Markdown 링크 검사 | PASS |
| source credential pattern 검사 | PASS |

Vitest는 실제 migration을 적용한 Handler→ProjectService→SQLite authorization chain, in-memory transaction fault와 file-backed reopen을 모두 포함한다. Browser suite는 process-global Project create limiter를 실제 설정 그대로 사용하므로 worker 1개로 실행하며, 같은 test 안에서 실제 concurrent Task HTTP request를 발생시킨다.

## Independent QA

초기 독립 QA는 Backend code를 **PASS WITH TEST REWORK**로 판정하고 실제 Handler authorization chain, concurrent write, update/delete/readback rollback, file reopen과 safe error mapping 증거를 요구했다. 이를 모두 추가했다.

Manager 검토에서는 root Leaf에 `open: true`를 전달해 SVAR tree traversal이 실패하는 문제, full-state pointer callback을 move로 오인하는 문제, 실패 뒤 canonical read까지 실패하면 transient widget 위치가 남을 수 있는 문제를 발견해 수정했다. 실제 pointer와 전체 회귀를 다시 실행한 뒤 최종 qa_docs가 계약·보안·문서 일관성을 재검토해 **PASS / ACCEPT 권고**했다.

최초 독립 E2E는 default weekend-only Calendar에 존재하지 않는 2026-09-14 Holiday를 test expectation이 가정해 7/8 실패했다. 제품 코드가 아니라 fixture 계약을 기본 Calendar에 맞게 바로잡은 뒤 독립 clean E2E를 다시 실행해 8/8 PASS를 확인했다.

## Changed Files

- `src/app/api/projects/[publicId]/tasks/`: Task POST/PATCH/DELETE Node routes
- `src/server/projects/task-contract.ts`, `task-handlers-core.ts`: strict input와 safe HTTP mapping
- `src/server/projects/project-service-core.ts`: authorization/revision/Scheduling/transaction Task orchestration
- `src/server/repositories/`: Project revision과 Task/Link/Holiday scoped CRUD
- `src/contracts/projects.ts`: Task request/mutation/warning DTO
- `src/features/gantt/`: Project Gantt, final command gateway, Task/date/link adapter
- `src/features/projects/project-readonly-view.tsx`, `src/app/globals.css`: Task UI, canonical recovery와 상태 표시
- `tests/server/projects/`, `tests/server/repositories/`, `tests/features/gantt/`, `tests/e2e/`: contract, security, persistence, pointer와 recovery/race 회귀
- API/Security/Architecture/DB/Scheduling/Research/Test/Decision/Plan 문서

DB schema와 migration, package dependency는 변경하지 않았다. W07은 기존 `0001_initial_schema.sql`을 사용한다.

## Security Findings

- Task mutation은 UI edit 상태와 무관하게 server에서 exact Origin, Cookie/session Project binding, expiry/revoke/auth-version/credential integrity와 revision을 검사한다.
- 최종 session 검증은 `BEGIN IMMEDIATE` lock을 얻은 뒤 revision보다 먼저 수행한다. 다른 요청이나 password rotation에서 무효화된 authorization은 write하지 못한다.
- Task/Link query와 update/delete는 검증된 internal `project_id`를 포함한다. 다른 Project의 valid Cookie와 알려진 Task UUID 조합도 일반 401/404로 거부한다.
- Validation/domain/persisted/예상 밖 오류는 allowlisted status/code/detail만 반환하며 SQL, stack, 내부 path와 payload를 노출하지 않는다.
- Task body는 32 KiB, Project Task는 5,000개, identifier 생성은 3회로 제한한다. Link graph와 hierarchy 상한은 해당 기능을 공개하는 W08/W09에서 추가 검증한다.
- Production dependency audit는 0건이다.

이전 작업 중 노출된 repository 자격증명은 source/Git에 포함되지 않았지만 별도 폐기·재발급이 필요하다. 정상 인증 복구 전에는 원격 push/release를 시도하지 않는다.

## Documentation Updated

- `README.md`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/DB_SCHEMA.md`
- `docs/SCHEDULING_ENGINE.md`
- `docs/PRO_FEATURE_MATRIX.md`
- `docs/SECURITY.md`
- `docs/TEST_PLAN.md`
- `docs/RESEARCH.md`
- `docs/DECISIONS.md`
- `docs/ISSUE_BREAKDOWN.md`
- `docs/exec-plans/active/PLAN.md`
- `docs/W07_REVIEW.md`

## Decisions

- W07은 root Leaf Task/Milestone persistence와 Link Repository foundation으로 종료한다.
- Summary/Hierarchy/WBS는 W08, 외부 Link mutation·incident Link 삭제·FS 재계산은 W09에서 atomic aggregate로 구현한다.
- W07의 unsupported aggregate를 부분 수정하는 예외를 만들지 않고 명시적 409로 유지한다.
- Task identity와 import/hierarchy reference identity를 분리하며 URL에는 Task UUID만 사용한다.

## Remaining Risks

- Summary, hierarchy, reorder, WBS와 empty-summary atomic batch는 W08까지 BLOCKED다.
- 외부 Link route, cycle/missing endpoint/FS scheduling, incident Link 삭제와 날짜 복귀는 W09까지 BLOCKED다.
- 현재 SQLite single application instance 전제에서만 HTTP race를 검증했다. 여러 application writer는 지원하지 않는다.
- Process-global limiter는 restart 시 초기화되고 정상 사용자도 한도를 공유한다. Production proxy/KDF benchmark는 W16에 남는다.
- UI02의 403/409/413/429 개별 browser fixture와 accessibility keyboard 전체 검증은 후속 통합 QA까지 NOT TESTED다.
- 5,000 Task server 상한은 correctness fixture이며 SVAR browser rendering 성능 보장이 아니다.
- Docker native target, volume restart·backup/restore와 운영 access log/header는 W16까지 NOT TESTED다.
- 실제 Excel/VBA 환경과 Workbook은 D01/W10까지 UNKNOWN/BLOCKED다.

## Recommended Next Work

W07을 **DONE / PASS / ACCEPT**로 종료하고 W08 Hierarchy Summary and WBS로 진행한다. W08은 summary+첫 child와 마지막 child 제거를 atomic batch로 처리하고, missing parent/cycle, stable sibling order/WBS, summary span과 REAL weighted progress를 code·tests·`SCHEDULING_ENGINE.md`에서 함께 검증해야 한다.
