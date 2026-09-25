# Test Plan

> **Issue #8 전송 정책:** production 기본값은 HTTPS다. `ALLOW_INSECURE_HTTP=true`와 canonical HTTP `APP_BASE_URL`을 함께 설정한 내부망은 production HTTP도 지원한다. 시작·readiness·공유 URL·모든 인증 경로는 같은 정책을 사용한다. `SESSION_COOKIE_SECURE`는 미사용 예약값이며 제거했다. HTTP에서는 `mastergantt_edit`, HTTPS production에서는 `__Host-mastergantt_edit; Secure`를 사용하고 HttpOnly·SameSite=Strict·Path=/·TTL 및 Domain 미설정을 유지한다. 아래 과거 검증 이력의 HTTPS-only 표현은 당시 기준이다. 현재 운영·전환 절차는 [HTTP_OPERATION](HTTP_OPERATION.md)을 따른다.


2026-09-12 후속 UI 변경의 테스트는 사용자 요청에 따라 일괄 실행까지 보류한다. 새 작업 이름·날짜·기간 자동 적용의 검증 항목과 기존 E2E 갱신 필요 사항, 별도 원격 push 절차는 [PENDING_TESTS.md](PENDING_TESTS.md)에 기록한다. 기존 PASS를 후속 변경에 적용하지 않는다.

상태: qa_docs가 작성한 검증 전략. W02–W07, W20과 W21 검증 기록은 [W07_REVIEW.md](W07_REVIEW.md), [W20_REVIEW.md](W20_REVIEW.md), [W21_REVIEW.md](W21_REVIEW.md)를 참조한다. 아래 표는 전체 제품 계획이며 W20의 로컬 container PASS도 원격 Actions/GHCR, production host/backup/restore와 VBA 통과를 뜻하지 않는다.

## Issue #120 semantic UI state token 회귀

- `tests/e2e/ui-semantic-tokens.spec.ts`: Chromium computed style로 primary/error/warning/info/success 텍스트 대비를 측정하고 4.5:1 이상인지 확인한다.
- focus ring은 실제 focused Resource Admin control의 outline color와 인접 background를 측정해 3:1 이상인지 확인한다.
- readonly/output와 subtle inactive badge 조합은 각각 실제 surface에 대해 4.5:1 이상인지 확인한다.
- 390/768/1024/1440px Resource Admin 진입 화면의 document horizontal overflow 부재를 확인한다. 기존 Task Editor/Project Row Menu E2E가 keyboard/selected interaction 회귀를 계속 담당한다.
- 실제 모바일 기기와 screen reader는 CI 범위 밖이며 별도 검증 시 결과를 기록한다.

## Issue #83 Project Task / Resource 검색·필터

- Unit: text normalization, inclusive date overlap, contained/start-in/end-in, milestone, type/schedule mode, progress/duration range, assigned/unassigned, Resource/Group ANY·ALL, ancestor context를 검증한다.
- Browser: 일정 Toolbar 검색/필터, Grid/Chart 동일 결과, ancestor context와 match count 분리, dangling dependency 미표시, 초기화, readonly, 탭 전환 상태 보존을 검증한다.
- Resource: 이름/code, kind, active/inactive, 연결 Task 기간 필터와 전체 Project workload 집계 라벨을 검증한다.
- 성능: 5,000 Task deterministic fixture에서 입력마다 Project snapshot 재조회 또는 Gantt 전체 page remount가 발생하지 않는지 검증한다.
- 공식 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker`, 병합 후 main 임시 GHCR exact digest smoke, 승인된 release image의 exact digest smoke를 사용한다.

## Issue #76 Project Workspace UX

- Global Header가 viewport 기반 full-width로 동작하고 전역 active navigation을 `aria-current`로 제공하는지 검증한다.
- Project Context가 프로젝트명·편집 상태 중심의 compact bar이며 Description/Owner/Revision은 Info disclosure에서 조회 가능한지 검증한다.
- Readonly 상태의 비밀번호 입력은 상시 공간을 점유하지 않고 `편집 잠금 해제` Dialog에서만 제공되며 기존 edit-session 인증/실패/재인증 계약을 유지하는지 검증한다.
- `일정 / 리소스` tablist/tab/tabpanel의 selected state, Arrow/Home/End keyboard 이동과 focus를 검증한다.
- 일정 → 리소스 → 일정 전환 전후 Gantt instance와 scroll/state가 보존되고 mutation/document request가 발생하지 않는지 검증한다.
- Resource workload는 full-width peer view로 표시하고 M/D·M/M·Refresh, Group → Resource → Task 계층과 과투입/미설정 상태를 검증한다.
- 390/768/1024/1440/1920px에서 unintended document horizontal overflow가 없고 Gantt 내부 scroll 계약은 유지되는지 검증한다.
- 최종 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker`와 병합 후 main artifact gate를 사용한다.

## Issue #72 Task Context Menu

최종 PR 검증 기준은 **PR #73 / CI Run #387**이다. `quality`, 전체 Chromium E2E, Docker build/runtime/transport/Compose smoke가 모두 PASS했으며, hierarchy reparent는 canonical sync에서 공개 `move-task` action을 사용하고 `update-task` parent 직접 변경으로 인한 recovery remount가 발생하지 않는지를 Unit/E2E에서 고정한다.

- Unit: 메뉴 enable/disable, sibling 경계, Indent/Outdent, clipboard Cut/Copy/Paste command mapping과 readonly/busy/**선택 Task endpoint link** fail-closed를 검증한다. Issue #104 회귀로 unrelated Task에만 Link가 있는 경우 현재 Task capability가 유지되는지 별도 검증한다.
- SQLite service: Move, Indent parent Summary 전환, subtree Copy identity/shape, boundary no-op rollback, 성공당 revision +1을 검증한다. cycle/empty Summary/assignment-copy/link 구조도 회귀 범위이며, Issue #104는 linked A↔B가 있어도 unlinked C의 hierarchy/delete mutation이 성공하고 기존 Link가 canonical response에 보존되는지 검증한다.
- API/security: 신규 `POST /task-commands`가 route security inventory에 포함되고 Origin/session/If-Match/stale revision/Project isolation 규약을 그대로 적용하는지 검증한다.
- Browser: Grid/Chart 우클릭과 Shift+F10, submenu keyboard focus, Ctrl/Cmd+X/C/V, Delete/Backspace/Ctrl+D, viewport edge, 실패 후 canonical recovery와 reload persistence를 검증한다.
- GitHub Actions의 동일 head quality/e2e/docker가 최종 자동 판정 근거다. SVAR Willow와의 실제 시각/키보드 UX 비교는 별도 수동 확인 항목이다.

## Issue #80 Task Editor 관계 표시 회귀

- Unit: predecessor/successor externalId 방향, 동일 이름, dangling reference, 관계 없음, multiple relation과 type/lag 보존을 검증한다.
- Chromium E2E: A → B fixture를 canonical snapshot으로 구성하고 Grid 더블클릭, Chart 더블클릭, Context Menu → Edit 각각에서 A의 후행 B/B의 선행 A 및 이름/externalId/type/lag를 확인한다.
- 관계 표시는 상위 canonical snapshot을 사용해 별도 관계용 `GET /api/projects/{publicId}`에 의존하지 않으며, Editor open만으로 mutation이 발생하지 않는지 검증한다.
- Readonly 및 Link 포함 일정에서도 Grid/Chart 더블클릭과 Context Menu로 조회용 Editor가 열리고 관계 탭 조회가 가능하며 Save는 제공되지 않는지 검증한다.
- 기존 401/412/draft/reload/Gantt instance, Context Menu #77 focus 정책 및 no document navigation 회귀를 유지한다.
- PR의 `quality`, 전체 Chromium E2E, Docker smoke와 병합 후 main GHCR exact digest smoke를 공식 PASS 근거로 사용한다.

## 판정과 증거

### Issue #31 작업 subtree 삭제

- Unit: 실제 taskId 기준 자손 탐색이 모든 깊이를 포함하고 형제를 제외하며 cycle/unknown을 안전하게 처리한다.
- SQLite service: subtree를 child-first로 같은 transaction에서 삭제하고 남은 Summary를 재계산한다. root 전체 subtree는 허용하되 선택 범위 밖 Summary가 비면 `EMPTY_SUMMARY_NOT_ALLOWED`로 rollback한다.
- API/security: 기본 DELETE는 기존 단건 의미를 유지하고 `includeDescendants=true`만 subtree를 활성화한다. session/Origin/If-Match/Project isolation, stale 412, Link 포함 409, revision 정확히 1 증가를 검증한다.
- Chromium 실제 API: Grid/Chart 우클릭의 정확한 target, 삭제 메뉴, 자손 확인의 작업명/개수, 취소 전 DELETE 0회, 확인 후 subtree DELETE 1회, sibling 보존, canonical Grid/Chart 동기화, Gantt instance 유지와 reload persistence를 검증한다.
- GitHub Actions `quality/e2e/docker`의 최종 동일 head 실행을 공식 회귀 근거로 사용한다. 실제 스크린리더·Windows/사내 브라우저 최종 UX는 별도 환경 검증이다.

W24: Project 목록 table 및 authorized DELETE 확인/취소/성공/실패, 401/403/404/412/428과 cascade/rollback/isolation을 검증한다. Gantt Header root·row child 추가, first-child 명시 Summary 전환, nested leaf 변경 후 ancestor 집계·reload, milestone parent와 마지막 child 삭제 거부를 포함한다. Default browser-local today/1day, locale/date-only timezone, 토/일 음영, 외부ID 표시 토글, Project 및 Grid/Chart header의 내부 scroll 중 위치 유지도 검증한다. 실제 결과는 [W24_REVIEW.md](W24_REVIEW.md)에 기록한다.

W23 목록 검증: D02 공개 summary 필드 allowlist, 인증 없이 GET 200/no-store, 빈 목록과 DB 오류 구분, 최신 수정순·동률 정렬, 생성→목록 복귀→reload→새 브라우저 direct Readonly, 기존 Mutation 무인증 거부 회귀. 결과는 [W23_REVIEW.md](W23_REVIEW.md)에 기록한다. W04 당시 collection GET 405 검증은 역사적 기록이며 W23에서 200 계약으로 대체한다.

| 판정 | 의미 |
| --- | --- |
| PASS | 명시한 환경에서 기대 결과를 재현하고 command/version/fixture/exit code·산출물을 기록 |
| FAIL | 실행 결과가 계약과 다름; 재현 절차와 요구 ID 기록 |
| BLOCKED | 필요한 환경·권한·artifact 부재; 해제 조건 기록 |
| NOT TESTED | 계획만 있고 아직 실행 안 함 |
| UNKNOWN | Excel/VBA 환경의 정책·가능 여부 자체가 확인되지 않음 |

문서 존재·Agent 완료 보고는 제품 PASS가 아니다. 결과에는 commit, OS/CPU, Node/browser/Excel/Docker version, fixture, exact command, 시각, exit code를 기록한다. Password/Cookie/session/원본 Workbook 내용은 기록하지 않는다. Flaky retry로 최초 실패를 숨기지 않는다.

## 계층과 공통 fixture

- Static: R-ID와 API/DB/Security/Scheduling/Import/Deployment 간 양방향 추적 및 예제·링크 검증.
- Unit/Vitest: pure date/calendar/graph/summary/WBS, schema/security utility. Clock을 주입하고 DB/network 의존 제거.
- Integration: 임시 SQLite에 실제 migration 적용, Repository→Service→HTTP, FK/transaction/session/revision 검증.
- Browser/Playwright: 새 context, 두 편집자, Readonly/unlock/CRUD/drag/hierarchy/reload/import/export/error recovery.
- Artifact/system: 실제 target Docker/volume와 ExcelJS workbook 재개방, Excel/LibreOffice 표시, 승인된 Windows Excel 실환경 POC를 분리.

P-A/P-B 두 Project에 같은 externalId를 사용해 isolation을 시험한다. 금요일 2026-09-11, 주말, 9/14 테스트 조직 휴일, 윤년, 한글 ID·이름, `=1+1`, `+cmd`, `@SUM(1,1)`, HTML·SQL-like text, comma/quote/CRLF를 공통 fixture로 둔다. 9/14는 실제 법정 공휴일로 주장하지 않는다.

## Authorization / concurrency

| ID | 검증과 기대 결과 |
| --- | --- |
| AUTH01 | Create의 Origin/크기/rate 정책, Project+salt/hash+session 원자 저장, 같은 password에도 다른 salt/hash, 원문 미저장 |
| AUTH02 | 새 browser direct GET Readonly; UI 강제 edit 상태에서도 보호 API mutation은 거부 |
| AUTH03 | correct/wrong password, unknown Project 일반 오류, timing-safe compare, KDF concurrency/rate 제한 |
| AUTH04 | Production __Host cookie의 Path=/, HttpOnly/Secure/SameSite=Strict, Domain 없음, expiry; local HTTP 별도 이름; JS storage/token URL 없음 |
| AUTH05 | expiry 경계, revoke, auth_version, malformed token, P-A token으로 P-B write 거부; logout idempotent |
| AUTH06 | create/unlock/logout/preview 포함 unsafe method의 missing/null/malformed/multiple/cross Origin 거부, exact scheme/host/port; GET/HEAD 상태 불변 |
| AUTH07 | public Task UUID를 알아도 다른 Project CRUD 거부; parent/link composite FK도 cross-project insert 거부 |
| AUTH08 | If-Match 누락428/stale412; 동시 동일 revision write 둘 중 하나만 성공, 성공당 revision1 증가 |
| AUTH09 | preview 뒤 다른 write→commit412 전체 불변; password revoke/mutation race에서 transaction 최종 session 검증 |
| AUTH10 | route inventory를 보호 API 목록과 대조, 신규 unsafe endpoint 누락 실패; preview는 session+Origin 필요/If-Match 불필요/DB불변 |
| AUTH11 | log와 response body/error/non-cookie header에 password/hash/salt/session/Cookie/import body/SQL/stack/내부 path 없음. 인증 성공의 opaque session 원문은 의도한 `Set-Cookie`에만 존재 |
| AUTH12 | password 변경으로 이전 모든 session 무효화, 호출자 새 token만 유효; 204/new ETag/Set-Cookie 계약 |

### W04 실행 증거

- **AUTH01 PASS (생성 범위):** strict 입력, 32 KiB JSON, exact Origin, process-global 5/hour limiter, KDF concurrency 2, Project+derived password+최초 session digest 원자 저장, rollback과 원문 DB 부재.
- **AUTH02 PARTIAL PASS (W04 당시):** 생성 browser·새 Cookie 없는 browser 모두 direct GET/UI Readonly, DB 재개방 후 유지. 보호 mutation 강제 거부는 W05에서 추가 검증했다.
- **AUTH04 PARTIAL PASS (W04 당시):** production/local Cookie 직렬화와 token URL/DOM 비노출 PASS. Server-side expiry 소비는 W05에서 추가 검증했다.
- **AUTH06 PARTIAL PASS (W04 당시):** create의 missing/null/malformed/multiple/cross Origin과 GET 비변경 PASS. 현재 unsafe route inventory는 W05에서 추가 검증했다.
- **AUTH11 PARTIAL PASS:** 생성 response body/error/non-cookie header/DB/URL/DOM secret scan PASS. Opaque session 원문은 의도한 `Set-Cookie`에만 있고 DB에는 digest만 있다. 운영 access log와 Import/Export는 NOT TESTED다.
- Project 격리·canonical UUID·동일 404, collection GET 405, create recovery UI를 추가로 PASS했다. Exact command·환경은 [W04_REVIEW.md](W04_REVIEW.md)에 기록한다.

### W05 실행 증거

- **AUTH02 PASS (현재 Project metadata slice):** Direct API는 Cookie와 무관하게 Readonly, 새 browser는 Readonly이며 no-session/cross-project/noncanonical persisted ID metadata/password mutation은 거부되고 DB는 불변이다. Task CRUD slice는 W07까지 BLOCKED다.
- **AUTH03 PASS:** correct/wrong/unknown/corrupt credential, dummy scrypt, recorded profile, 동일 길이 timing-safe 비교, hash/verify 공유 KDF concurrency 2, global+Project bounded limiter를 검증했다.
- **AUTH04–06 PASS (현재 Route slice):** production/local 발급·만료 Cookie와 8 KiB/100 pair/duplicate parser, strict expiry/revoke/auth-version/project binding, 유효 wrong-project Cookie 보존, idempotent logout, exact Origin, current GET·live HEAD/OPTIONS 상태 불변과 credential CORS 미노출을 검증했다.
- **AUTH08 PASS (Project metadata/password):** strong positive If-Match, missing 428, malformed 400, stale 412, live 동일 revision 동시 PATCH의 정확한 200+412와 revision 1회 증가를 검증했다.
- **AUTH09 PASS (password/session race slice):** write lock 획득 뒤 final session-first expiry/revoke/auth-version/credential integrity 검사와 rotation insert fault 전체 rollback을 검증했다. Import preview/commit race는 W12까지 BLOCKED다.
- **AUTH10 PASS (현재 Route inventory):** 실제 `route.ts` export 전부를 policy inventory와 대조한다. 미래 Calendar/Task/Link/Import Route는 구현 시 inventory와 테스트를 동시에 확장해야 한다.
- **AUTH11 PASS (W05 application slice):** password/token/hash/salt가 response body/error/non-cookie header/URL/DOM/DB 원문에 나타나지 않는다. 운영 access log와 Import/Export는 NOT TESTED다.
- **AUTH12 PASS:** credential·`auth_version + 1`·`revision + 1`·기존 session 전체 revoke·호출자 새 session을 하나의 transaction에 저장하고 old session/password 거부와 caller edit 유지를 browser까지 검증했다.
- 전체 11개 파일 91개 Vitest, typecheck/lint/build와 clean 기본 Turbopack Chromium E2E 4개가 PASS했다. Webpack 개발 cache의 manifest race와 병렬 spec이 의도한 process-global create limit을 공유하는 실패를 재현해, 기본 Playwright server는 Turbopack·worker 1개로 고정했다. 동일 revision 병행성은 W05 spec 내부 병렬 HTTP로 계속 검증한다. 정확한 명령·환경·잔여 위험은 [W05_REVIEW.md](W05_REVIEW.md)에 기록한다.

### W06 실행 증거

- **SCH01 PASS:** strict `YYYY-MM-DD`, `1900-01-01..2199-12-31`, 윤년·월말·연말·overflow를 검증하고 전체 109,573일을 독립 oracle과 ordinal 왕복·요일 대조했다.
- **SCH02 PASS:** exact `Asia/Seoul`/weekend `[6,0]`, Holiday 날짜·중복·nullable name, 주말 중복, inclusive/exclusive next working day, 전체 비근무 범위 탐색 종료를 검증했다.
- **SCH03 PASS:** 일반 Task duration `1..10000`, inclusive end, supplied end 일치/불일치, milestone duration 0과 `start=end`를 검증했다.
- **SCH04/SCH06/SCH07 PARTIAL PASS (W06 leaf slice):** `requestedStart` 보존, Auto 비근무 시작 이동 warning, Manual 비근무 시작 거부, calendar-only milestone을 검증했다. Dependency 이동·Manual FS/Calendar aggregate conflict는 W09까지 BLOCKED다.
- **SCH11 PARTIAL PASS:** pure 입력 불변, frozen deterministic result, 5개 Node `TZ` 동일 결과와 Domain의 Date/Intl/process/I/O 비의존을 검증했다. Graph/summary 전체 멱등성은 W08/W09 후속이다.
- **SCH12 PARTIAL PASS:** raw SSR은 `pending`이고 hydration 이후에만 Client Engine이 계산하도록 구성해 UTC·Asia/Seoul·America/New_York Chromium에서 Server/Browser canonical fixture가 일치했다. 실제 SVAR drag/resize와 DB 저장은 W07까지 BLOCKED다.
- W06 Domain 4 files/135 tests와 전체 15 files/226 Vitest, typecheck/lint/build, clean 기본 Turbopack Chromium 7/7이 PASS했다. 정확한 범위·독립 QA·잔여 위험은 [W06_REVIEW.md](W06_REVIEW.md)에 기록한다.

### W07 실행 증거

- **AUTH02/AUTH05/AUTH07 PASS (root Task slice):** no/malformed/wrong-Project/expired/revoked/auth-version Cookie, password rotation 이전 session과 다른 Project Task UUID를 실제 Handler→Service→SQLite 경계에서 거부하고 row/revision 불변을 확인했다.
- **AUTH08 PASS (Task slice):** missing/stale If-Match를 거부하고 동일 revision 두 실제 HTTP POST의 결과가 정확히 `201 + 412`, revision은 한 번만 증가하며 승자 Task 하나만 남는지 검증했다.
- **AUTH09/DB02 PASS (Task slice):** `BEGIN IMMEDIATE` 안의 session-first 재검증과 create/update/delete/readback fault rollback, file-backed SQLite close/reopen의 requested/effective dates·progress·revision 보존을 검증했다.
- **AUTH10 PASS (현재 Route inventory):** Task POST/PATCH/DELETE가 모두 `origin-session-if-match`로 등록됐으며 외부 Link route는 W09 전까지 존재하지 않는다.
- **SCH03/SCH04/SCH12 PASS (root Leaf slice):** W06 `scheduleLeaf`가 Task/Milestone create/update에 적용되고, 실제 SVAR 우측 resize·좌측 resize·이동·삭제·reload에서 exclusive widget end와 inclusive domain end가 왕복한다.
- **UI01 PARTIAL PASS:** Create→unlock→root Task CRUD→pointer edit→reload vertical slice는 PASS다. Hierarchy와 FS는 W08/W09까지 BLOCKED다.
- **UI02 PARTIAL PASS:** Task 401/412/422/500 거부와 canonical 재조회 실패에서도 마지막 확정 Gantt를 복원했다. 403/409/413/429의 화면별 browser fixture는 후속 통합 QA까지 NOT TESTED다.
- W07 전체 21 files/291 Vitest, typecheck/lint/build, clean 기본 Turbopack Chromium 8/8과 production dependency audit 0건이 PASS했다. 정확한 범위·독립 QA·잔여 위험은 [W07_REVIEW.md](W07_REVIEW.md)에 기록한다.

### W21 실행 증거

- **UI03 PASS:** 빈 Project에서도 Grid와 Chart를 렌더하고 첫 root Task 저장 직후 동일 taskId의 Grid row와 `.wx-bar`가 reload 없이 보인다.
- **UI04 PARTIAL PASS:** supplied Summary/child의 snapshot 순서와 `parent/open` adapter를 unit으로 확인했고 단일 Core의 Grid/Chart 동시 pane을 Browser에서 확인했다. 실제 Summary 생성·expand/collapse와 WBS는 W08까지 BLOCKED다.
- **UI05 PASS:** 1440×900에서 Project Gantt 폭 1,000px 초과, 높이 580px viewport 규칙과 첫 화면 위치를 확인했고 max-width cap을 두지 않는다. 실제 Resizer drag geometry는 Core 제공 동작으로 유지하지만 별도 자동 조작은 NOT TESTED다.
- **UI06/UI08 PASS:** 기존 401/412/422/500·canonical read 실패 복원과 move/양쪽 resize/delete/reload persistence가 새 작업공간에서도 통과했다.
- **UI07 PASS:** 기존 direct Readonly/current-session/unlock/logout과 Task 보호 API 경계를 유지하며 native Add column을 노출하지 않는다.
- **UI09/UI10 PASS:** 390×844에서 Grid와 Chart가 함께 보이고 focus 가능한 outer region의 `scrollWidth > clientWidth`, 실제 `scrollLeft` 이동, document overflow 없음과 disclosure control 회귀를 확인했다.
- Manager 재검증: version 0.3.0, typecheck/lint/build PASS, 전체 24 files/310 Vitest와 clean isolated Turbopack Chromium 8/8 PASS. 독립 판정과 잔여 범위는 [W21_REVIEW.md](W21_REVIEW.md)에 기록한다.

## CI/CD / Semantic Release

| ID | 검증과 기대 결과 |
| --- | --- |
| CI01 | PR/main의 frozen `npm ci`, version check, typecheck, lint, 전체 Vitest, production build가 clean GitHub runner에서 실행 |
| CI02 | Chromium E2E worker 1, 실패 trace/report artifact, 일반 application job과 격리 |
| CI03 | clean `linux/amd64` image build, non-root UID/GID, native `better-sqlite3`와 migration/readiness 성공 |
| CI04 | ephemeral volume에 대표 Project 저장 후 같은 container/image restart에서 유지; image layer에는 DB/WAL/SHM 없음 |
| CI05 | package와 lockfile version이 strict SemVer로 일치; release tag가 annotated exact `v<version>`이고 모든 이전 valid tag보다 크며 malformed/mismatch/lower version은 hard fail |
| CI06 | PR job은 read-only이고 publish job만 최소 package/attestation 권한; Action full SHA와 base image digest pin, secret build arg/log 없음 |
| CI07 | Repository 단위 release 직렬화; stable만 latest/major/minor 갱신, prerelease는 exact SemVer만 보관; OCI source/revision/version, SBOM/provenance 존재 |
| CI08 | Pre-publish local candidate가 production config/migration/readiness/native SQLite/restart를 통과; PASS 후 GHCR exact SemVer를 직접 push하고 그 build output digest를 재-pull하여 smoke 및 활성화한 GitHub Attestation을 수행한 뒤 stable rolling alias만 승격; exact version/digest를 downstream test에 제공 |
| CI09 | PR·수동 CI는 registry write가 없고 성공한 `main` push만 모든 quality/E2E/container job 뒤 임시 `ci-<full SHA>`를 게시; exact digest 검증 뒤 package version을 삭제하며 기존 tag overwrite와 SemVer/rolling alias 생성을 거부 |
| CI10 | Main 임시 commit image와 SemVer exact release image를 각각 build output digest로 새로 pull해 image policy, migration/readiness, Project 생성·edit session·Task 저장, unauthorized write 거부, restart 후 Project/Task 재조회를 검증; main 임시 package 삭제까지 확인하고 BuildKit SBOM/provenance와 optional GitHub Attestation 결과를 구분 |

로컬 workflow lint와 Docker smoke는 implementation evidence다. GitHub-hosted Actions URL, tag, GHCR digest와 registry pull 결과가 없으면 CI01–02 및 CI05–10의 원격 부분은 **NOT TESTED**로 기록한다. Repository admin 인증 성공은 workflow나 artifact PASS가 아니다. D05에서 현재 private plan의 ruleset 미강제 위험을 수용했으므로 이를 blocker로 두지는 않지만 보호가 적용됐다고 표시하지 않는다. GitHub Artifact Attestation은 비활성이고 BuildKit SBOM/provenance만 필수이므로 둘을 혼동하지 않는다.

W20 로컬 실행 결과는 typecheck/lint/build, 24 files/309 Vitest, Chromium 8/8, actionlint, Compose, Markdown 30 files, production audit 0, `linux/amd64` non-root image와 invalid runtime config exit 1, readiness/native SQLite restart persistence까지 독립 QA PASS였다. 당시 원격 CI01–02와 CI05–08은 NOT TESTED/BLOCKED였으나 W22에서 main/PR와 `v0.4.0` release Actions/GHCR, 양쪽 digest의 원격·로컬 persistence와 SBOM/provenance를 PASS했다. [W20 검증 기록](W20_REVIEW.md), [W22 검증 기록](W22_REVIEW.md)

## Scheduling / database

| ID | 검증과 기대 결과 |
| --- | --- |
| SCH01 | strict date-only·윤년·월말·허용 기간, UTC/Seoul/DST 환경 동일 결과 |
| SCH02 | inclusive 근무일 duration, weekend+holiday/연속 휴일, 탐색 상한 |
| SCH03 | Task duration1+, milestone0/start=end, 잘못된 음수·소수 거부; end는 dependency 전 계산과 비교 |
| SCH04 | requestedStart 보존, Auto 이동 warning, dependency 삭제·앞당김 시 요청일로 복귀 |
| SCH05 | FS 분기·합류·여러 선행, self/duplicate/missing/summary endpoint/cycle/미지원 type·lag 거부 |
| SCH06 | Manual interval 유지, FS 및 calendar 변경 충돌 전체 거부, 명시적 Manual edit는 새 요청 |
| SCH07 | milestone 양쪽 endpoint와 chain에서 next-working-day FS, duration0 유지 |
| SCH08 | empty summary 단일 생성 거부; summary+첫 child batch는 최종 snapshot만 검증; 마지막 child 삭제·이동+summary 삭제 원자 처리 |
| SCH09 | nested/hidden descendant min/max span, fractional weighted progress·milestone-only 평균, DB REAL 값 왕복; summary mode auto/요청일null |
| SCH10 | root/sibling order, forward parent refs, reparent/reorder; sort/filter가 WBS나 stable ID를 바꾸지 않음 |
| SCH11 | 결정성·멱등성·입력 불변, leaf 근무일·FS bound·summary containment 성질 |
| SCH12 | Browser/server 동일 fixture, SVAR date end adapter, drag/resize, 단일 명령 중복 저장 방지 |
| DB01 | empty DB migration/ledger/checksum drift/FK pragma/foreign_key_check/WAL/busy 정책 |
| DB02 | bound SQL과 identifier allowlist, project isolation, nth-write fault 시 row·summary·revision 전체 rollback |
| DB03 | task-batch 100 operation/5MiB, unknown field/중복 변경 target, order 정규화, 명시적 삭제와 incident link ID 응답 |

## Import / VBA

| ID | 검증과 기대 결과 |
| --- | --- |
| IMP01 | minimal/full JSON1.0 preview→commit, normalized task/link/order/diff/count, preview DB불변 |
| IMP02 | encoding/JSON/duplicate key/version/unknown/missing field/date/duration/progress/type/mode 오류 path/code |
| IMP03 | payload·기존 DB duplicate ID, whitespace/control ID, missing parent/target·cycle·unsupported constraint 전체 거부 |
| IMP04 | array 뒤 parent forward reference, summary snapshot 차이 preview, derived authority |
| IMP05 | Manual conflict와 byte/task/link/depth/date 상한 초과→부분 commit 불가; direct API도 동일 validation |
| IMP06 | 정보용 Project metadata가 DB를 변경하지 않음; v1 참조는 batch 내부로 한정 |
| IMP07 | 첫·중간·마지막 insert fault 전체 rollback, stale commit 거부, 중단 후 일관된 재조회 |
| IMP08 | wizard file→parse→mapping→business preview→명시적 commit→result, cancel/back/retry/focus/loading |
| IMP09 | CSV UTF8 BOM 유무, reordered/duplicate/missing headers, metadata 일치, quoted comma/quote/CRLF, JSON predecessor cell, blank parent→null, [] 필수, JSON과 동일 결과 |
| IMP10 | 한글/Unicode externalId exact 보존과 API taskId 분리, formula-like text 실행·변형 없음 |

실제 Excel/VBA POC는 [VBA_EXPORT.md](VBA_EXPORT.md)의 각 항목을 PASS/FAIL/BLOCKED/UNKNOWN으로 기록한다. 조직 정책·대상 Workbook은 UNKNOWN, VBA/parser 미구현으로 못 하는 실행은 BLOCKED다. Fixture만으로 실제 POC를 PASS하지 않는다.

POC 필수: VBA 실행/셀 접근, Header 탐색·alias mapping, 필요한 열만 추출, 안정 ID·parent/dependency, 1900/1904 날짜·진척, 한글/escaping/encoding, 승인 위치 JSON과 CSV 저장, 오류 row 보고, 생성 파일의 실제 Web preview/commit. DRM 우회 없이 허용된 입력 경로만 검토한다.

## XLSX / Docker / UI

| ID | 검증과 기대 결과 |
| --- | --- |
| XLS01 | ExcelJS 재개방과 Project/Tasks/Dependencies, metadata·date·모든 task/link 값 비교 |
| XLS02 | canonical APP_BASE_URL/public ID hyperlink, Host header 영향 없음, password/session/internal ID 없음 |
| XLS03 | user string은 string cell, XLSX XML에 user-origin formula/external relationship 없음, 한글 실제 표시 |
| XLS04 | 한 revision snapshot, row/기간/resource limit, content-type·안전한 filename |
| XLS05 | Phase1 PASS 후 별도 Phase2: date/week/month, inclusive bar, weekend/holiday, progress/milestone/summary/print |
| DEP01 | actual arch clean lockfile build, builder/runtime ABI/libc/CPU, require/SELECT1/migration |
| DEP02 | non-root UID/GID, fresh volume·bind mount permission, invalid ownership 시 not-ready |
| DEP03 | live process vs ready SQL/config/migration/FK; checksum failure/readonly volume→503 또는 종료 |
| DEP04 | create/edit→restart/recreate 같은 volume→data/revision 유지, single instance |
| DEP05 | consistent backup→off-host artifact→isolated restore→integrity/FK/read/write/export/restart; 같은 volume 사본은 불충분 |
| DEP06 | context/image/history/log에 .env/PAT/DB/backup 없음; production path/URL/Secure 오류 시작 거부 |
| DEP07 | graceful/forced stop WAL durability, busy timeout, isolated upgrade/rollback |
| DEP08 | Compose `RESOURCE_CATALOG_ADMIN_PASSWORD` 누락 config fail-fast, app 환경 전달, 실제 관리자 인증 201/401, 인증 직후·재생성 후 로그의 정상/오류 비밀번호 원문 비노출 |
| UI01 | Create→Readonly→unlock→CRUD→drag/resize→hierarchy batch→FS→reload |
| UI02 | 401/403/409/412/413/429/500 복원, loading/error/keyboard focus, no-PRO runtime 사용 확인 |
| UI03 | 빈 Project에서도 좌측 Grid와 우측 Chart가 보이고, 첫 Task/Milestone 생성 성공 직후 reload 없이 Grid row와 Chart bar/milestone이 모두 표시 |
| UI04 | 단일 SVAR instance에서 Grid tree와 Chart row·세로 scroll이 동기화되고 parent/open/snapshot 순서가 유지 |
| UI05 | 1440×900 이상 Desktop에서 Project route가 가용 폭을 사용하고 Gantt 높이가 viewport 규칙을 따르며 Grid/Chart Resizer가 유지 |
| UI06 | Task mutation 실패·canonical 재조회 실패·401에서 optimistic ghost 없이 양쪽이 마지막 확정 snapshot으로 복원 |
| UI07 | Direct access는 Readonly이고 unlock 전 create/delete/drag/resize가 보호되며 unlock 뒤만 기존 Task API를 사용 |
| UI08 | create/move/좌우 resize/delete 뒤 reload 시 Grid 값과 Chart 위치가 동일 canonical server 상태와 일치 |
| UI09 | 390×844 좁은 viewport에서 focus 가능한 Gantt 내부 horizontal scroll로 Grid와 Chart 모두 접근 가능하고 document body overflow가 없음 |
| UI10 | 작업공간에 접근 가능한 이름과 keyboard focus가 있고 접이식 설정·작업 control이 기존 label/status 의미를 보존 |
| UI12 | Issue #74: Task Editor 3개 Tab, draft 보존, Arrow/Home/End keyboard, Resource/Group filter/assignment 저장 범위, 관계 2열→1열, sticky Footer, 360/768/1024/1440 horizontal overflow 없음과 기존 401/412/dirty/readonly 회귀 |
| UI13 | Issue #96: 1440/1024px Task Editor에서 작업명·날짜·기간·진행률·Description/URL 및 Resource allocation이 역할별 content-aware 폭을 사용하고, 768/390px에서 1열 전환하며 dialog/document horizontal overflow가 없음. 기존 Task/Assignment/Relation/dirty/stale/readonly 저장 계약 회귀 포함 |
| UI14 | Issue #104: A↔B Dependency가 있어도 unrelated C의 Context Menu mutation이 edit/busy/hierarchy 경계에 따라 활성화되고, linked A는 기존 fail-closed를 유지한다. Task Editor와 server Task/Hierarchy/Subtree Delete도 동일 task/subtree scope를 사용하며 unrelated Link를 canonical snapshot에 보존 |
| UI11 | Issue #3 및 PR #23: 지연 POST 대기/성공 동안 동일 Gantt DOM/API, no document navigation, action 열과 scroll/tree/selection/columns 유지; 순차 추가마다 정확히 한 POST 및 canonical row/bar 한 개, root/child/팝업 없는 명시적 Summary 전환·오류 복구 회귀. [현재 UX 계약](PROJECT_UX.md), [과거 검증 기록](ISSUE_3_REVIEW.md) |

## Requirement traceability와 Release gate

| Requirement | 계획한 증거 |
| --- | --- |
| R01–R05 | AUTH01–12, UI01 |
| R06–R09 | SCH01–12, 공식 API/version/license POC, 기능 Matrix |
| R10–R11 | DB01–03, Architecture dependency boundary |
| R12–R16 | VBA POC, IMP09–10, 공동 계약 검토 |
| R17 | IMP01–10 |
| R18–R20 | XLS01–05, Phase 분리 |
| R21–R22 | DEP01–08 |
| R23–R24 | Agent 설정·독립 QA·Manager 기록과 구현별 build/typecheck/tests |
| R25 | UI01–02, Project List 공개 정책 D02 |
| R29 | UI03–10, SVAR 공식 Grid/Chart·Resizer API와 Browser geometry |
| R30 | CI09–10, main-only publish 조건·immutable tag·digest HTTP persistence smoke |
| R31 | project-create-and-read / project-links-persistence: 목록 삭제 재인증·취소·삭제 후 404 및 기존 서버 권한 |
| R32–R38 | project-gantt-stability / project-task-persistence / project-workspace-layout: 팝업 없는 child 생성·상위 집계·locale·열 선택·geometry·인스턴스 유지 |
| R39–R41 | project-notifications / project-modal-feedback / project-links-persistence, workspace-notification-state / project-share-url: 알림·안전한 진단·링크·clipboard 및 fallback |
| R46 | task-editor-view-model / project-task-editor: 탭 키보드 이동, draft 보존, 반응형 overflow, 기존 Task/Assignment 저장 계약 회귀 |
| R45 | project-create-and-read / project-links-persistence: 1440px wide content, 행 overflow menu keyboard/Escape/focus, 프로젝트 복사·링크 복사·삭제 회귀와 작은 화면 접근성을 검증 |

PR gate는 build/typecheck와 관련 unit/integration/E2E, migration 회귀, dependency/license 검토, 문서 일관성이다. 현재 command는 `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`다. 구현 PR은 test ID에 실제 command·결과를 연결해야 한다.

Unauthorized/cross-project write, secret 유출, stale overwrite, cycle 누락, partial import, XLSX formula/link injection, migration/restore 실패, restart 데이터 손실은 release blocker다. QA 보고는 Summary/Requirement Coverage/Test Results/Failures/Security/Regression/Documentation/Remaining Risks/Recommendation을 포함한다.

## Repository layout relocation (#12)

현재 배포 경로와 기존 Compose 프로젝트/volume을 유지하는 전환 절차는 [REPOSITORY_STRUCTURE](REPOSITORY_STRUCTURE.md)를 따른다. Docker gate의 `scripts/verify-compose-smoke.sh`는 config/startup/readiness/restart/강제 recreate SQLite 보존에 더해 DEP08을 검사한다. 즉 `RESOURCE_CATALOG_ADMIN_PASSWORD` 누락은 config 단계에서 실패하고, 설정값은 app 컨테이너에 전달되어 실제 인증 정상 201/오류 401을 만들어야 하며, 인증 요청 직후 및 강제 재생성 후의 application log에는 정상/오류 입력 비밀번호 원문이 없어야 한다. 기존 quality/E2E/runtime/registry 권한·검증 gate는 유지한다.

## Test configuration relocation (#13)

설정은 `tests/config/vitest.config.ts`, `tests/config/playwright.config.ts`에 있다. `npm test`, `npm run test:e2e`는 그대로 사용한다. 직접 실행은 `npx vitest run --config tests/config/vitest.config.ts`, `npx playwright test --config tests/config/playwright.config.ts`로 지정한다. 설정 파일 기준 root/testDir/webServer.cwd를 사용하고 E2E DB `.data/playwright.sqlite3`, `.next-e2e`, `test-results/`는 루트 기준으로 유지한다. CI는 `node scripts/verify-test-discovery.mjs`로 루트/외부 cwd의 동일한 테스트 발견을 확인한 뒤 전체 테스트를 실행한다. 편집기에서 자동 발견되지 않으면 같은 설정 경로를 지정한다. 실제 Windows 편집기 UI 검증은 미실행이며 [배치 문서](REPOSITORY_STRUCTURE.md)를 함께 따른다.

## Issue #56 리소스 공수 회귀 검증

- DB migration: 기존 `task_assignments` 호환, nullable allocation 필드, allocation 범위 제약과 workload index를 검증한다.
- Service/API: Project calendar 근무일 기반 M/D, 선택 구간 clipping, M/M 설정 유무, 미설정 allocation 제외, 복수 그룹 Grand Total 중복 방지와 과투입 판정을 검증한다.
- Assignment mutation: resource의 기간/투입률 validation, group allocation 금지, revision/catalog revision 동시성 및 기존 assignment canonical snapshot 보존을 검증한다.
- UI/E2E: 기존 Gantt instance/폭/페이지 수평 overflow 계약을 유지하고 리소스 공수 조회가 프로젝트 작업면 외부 flex sibling으로 Gantt를 축소하지 않는지 전체 Chromium 회귀로 확인한다.
- PR 최종 gate는 version/typecheck/lint/Vitest/build, Chromium 전체 E2E, Docker migration/readiness/SQLite restart, production HTTP·HTTPS browser와 relocated Compose persistence를 모두 통과해야 한다.

## Issue #64 구조화 로그 및 요청 추적 회귀

- `LOG_LEVEL` 필터와 잘못된 설정 fallback을 단위 테스트한다.
- trusted/untrusted `X-Request-ID`, 응답 header, 오류 body와 server log 상관관계를 검증한다.
- 2xx/4xx/5xx lifecycle level, 예상하지 못한 500의 client/server 정보 분리, 민감 필드 redaction을 검증한다.
- readiness failure category 및 장애→복구 전환을 검증하고 정상 health probe가 반복 `info` 로그를 만들지 않는지 확인한다.
- migration CLI가 성공/실패 구조화 진단을 stderr에 남기면서 DB path/내부 오류 원문을 노출하지 않는지 검증한다.
- Docker Compose smoke에서 `runtime_configuration_validated`, `database_migration_completed`, `application_started` 이벤트가 `docker compose logs app`으로 조회되는지 확인한다.


## Issue #57 작업 캘린더 회귀 검증

Issue #57 PR은 기존 gate를 완화하거나 skip해서 통과시키지 않는다. 최신 PR head에서 다음을 검증한다.

- **Domain**: 평일/주말, `NON_WORKING` 평일 override, `WORKING` 주말 override, legacy holiday 호환, 중복·충돌 거부, leap/date 범위, timezone purity.
- **Country fixture**: KR/CN/VN/PH/TH/MX/US의 2026 metadata와 대표 휴일, CN/VN 보충 근무일, 지원 외 연도 `COUNTRY_CALENDAR_UNAVAILABLE`.
- **Migration 0006**: 기존 `project_holidays` row를 Custom Project rule/date로 보존, 기존 Project에 국가 rule 자동 추가 금지, 호환 VIEW/INSERT trigger, 재실행 ledger 안정성.
- **Service/API**: countries/read/preview/replace, edit session/Origin/If-Match, stale revision, Calendar exception 충돌, Calendar→FS/lag=0→Summary 재계산, Manual Calendar/Dependency conflict rollback, dependency cycle/지원 외 구조 오류, revision 정확히 +1.
- **Resource workload**: Project+Group+Resource Effective Calendar를 이용한 M/D, M/M 분자, 일별 allocation/과투입 판정. Group/Resource 휴무가 Project Task start/end를 이동시키지 않는지 검증.
- **Project copy**: source의 materialized Calendar rule/date가 새 Project로 독립 복사되고 source revision/Calendar는 변경되지 않는다.
- **UI/Chromium**: 설정 modal의 Calendar rule/custom date 편집, Preview/저장, canonical snapshot 재조회, 신규 KR 기본 Calendar의 실제 휴일 이동, 기존 알림/geometry/Gantt instance 회귀.
- **Docker**: migration 0006 적용 후 readiness, SQLite restart persistence, production HTTP/HTTPS 인증·Cookie·영속성, relocated Compose persistence.

PR #66 최종 검증 기준은 CI Run #350이며 quality, Chromium E2E 50/50, Docker smoke가 모두 PASS했다. Merge 후 main은 같은 gate를 다시 실행한 뒤 임시 `ci-<SHA>` GHCR image를 exact digest로 검증하고 삭제한다. SemVer release image는 annotated `v0.16.0` tag를 release authority로 사용한다.


## Issue #68 Calendar + Dependency 재계산 회귀

- **Domain**: FS/lag=0 단일/복수 선행, milestone endpoint, 요청일이 bound보다 늦은 경우 유지, Manual lower-bound conflict, cycle/missing/summary/unsupported relation 거부, 입력 불변과 멱등성.
- **Service**: 후보 Calendar로 선행 Auto가 이동하면 후행 Auto가 다음 근무일 FS bound로 이동하고 Summary가 최종 Leaf에서 재집계되는지 검증한다. Preview는 DB/revision을 변경하지 않는다.
- **원인 추적**: 현재 Calendar base와 후보 Calendar base를 비교해 `CALENDAR`를 판정하고 FS forward-pass가 추가로 이동한 작업만 `DEPENDENCY`로 표시한다. Summary는 `SUMMARY`로 표시한다.
- **원자성**: Manual dependency conflict에서 Calendar rule/date, Task/Summary, revision이 모두 원상태인지 검증한다.
- **HTTP/보안**: 기존 edit session, exact Origin, 강한 If-Match, stale 412 계약을 유지하고 cycle/지원 외 graph는 409 structured error를 반환한다.
- **PR gate**: version/typecheck/lint/test-discovery/Vitest/build, 전체 Chromium E2E, Docker migration/readiness/restart persistence를 기존 gate 완화 없이 실행한다.

## Issue #87 Agent Lifecycle와 한정 브랜치 정리 회귀

운영 기준은 [CI_CD.md](CI_CD.md) 9절, 실제 원격 판정은 [REMOTE_VALIDATION.md](REMOTE_VALIDATION.md), 작업 범위는 [ISSUE_87_COMPLETION.md](ISSUE_87_COMPLETION.md)를 따른다. 여기의 계획은 실제 Agent 실행이나 원격 삭제 PASS를 뜻하지 않는다. 아래 `CL87-*`는 PR #88 당시 수행한 **역사적 검증 기록**이며, Issue #124에서 전용 workflow와 `verify-issue-87-cleanup.py`가 퇴역했으므로 현재 실행 지침으로 사용하지 않는다. 현재 branch cleanup 회귀 실행은 이 문서의 Issue #124 절과 `python3 scripts/verify-safe-branch-cleanup.py`를 따른다.

| ID | 검증과 기대 결과 | 실행/근거 |
| --- | --- | --- |
| AG87-01 | ui_ux/frontend/qa_docs의 설계·구현·읽기 전용 책임, 기존 모델/동시 한도 보존, 위임/반환·파일 소유권·실행 불가 시 정직한 상태 기록 | TOML 구문/필수값, AGENTS·구성·Lifecycle·UI 가이드 대조; 실제 runtime은 별도 |
| AG87-02 | release_required와 release_authorized 분리, 명시적 승인 없는 tag/정식 게시 금지, 필요한 미승인 게시를 BLOCKED로 기록, 문서 변경의 release N/A와 main 임시 GHCR 분리 | Lifecycle 정책 시나리오와 독립 리뷰 |
| CL87-01 | [역사 기록] 당시 workflow inline Python을 추출하여 정상 삭제/이미 없음/무관 run 2개, API·CI·PR·SHA·branch 보호 조건 20개를 검증 (모형 24개) | 퇴역된 `verify-issue-87-cleanup.py`의 PR #88 당시 결과. 현재 실행 대상 아님 |
| CL87-02 | 잘못된 event/branch/source repository/workflow/attempt/SHA, 실패·진행 중 CI, 누락·skipped GHCR, job 페이지 초과에서 삭제하지 않음 | 모형 거부 시나리오; 실제 API 통신 실패·권한 부족은 원격 BLOCKED/FAIL로 기록 |
| CL87-03 | merge parent 2개/두 번째=PR head를 요구, squash·잘못된 parent·ancestry 불일치·새 tip·보호 branch·다른 열린 PR 참조에서 삭제하지 않음 | 모형 거부 및 PR #88 `merge_method=merge`, expected_head_sha 확인 |
| CL87-04 | 정상 삭제, push 전 stale tip, 서버 광고 이후 pre-receive 경합에서 명시적 SHA lease가 새 commit/다른 ref를 보존 (실제 로컬 Git 3개) | 격리 bare Git 테스트. 외부 통신 없음; 단일 삭제 refspec, 무조건 force/REST fallback 없음 |
| CL87-05 | 인증값이 Git 인자/설정 파일/로그에 남지 않고 trace/global/system 설정을 배제; PR validation은 contents:read와 credential 미보존, write cleanup은 checkout/fetch/artifact/cache/PR code 실행 없음 | Git 호출 검증, workflow 정적 검토, 실제 Actions 권한/step 로그 |
| CL87-06 | [역사 기록] PR 검증과 실제 원격 삭제를 분리. 당시 모형 24개+Git 3개=27시나리오를 5개 unittest method로 실행 | 퇴역된 Issue #87 전용 validation workflow의 당시 성공 증거. 현재 실행 대상 아님 |
| CL87-07 | 실제 PR #88 merge SHA의 main quality/e2e/docker/main GHCR 모두 success 뒤에만 고정 작업 branch를 삭제하고 ref 404 확인 | main/cleanup run·attempt·job·merge/head SHA, GHCR digest/smoke/SBOM·provenance/package 정리, cleanup summary와 API 404 |

기존 PR quality/e2e/docker와 최종 head의 독립 검토는 유지한다. 이 정리 회귀를 통과해도 main/GHCR/실제 삭제가 아직 실행되지 않았으면 NOT TESTED다. SHA lease 거부, 새 tip, 보호/다른 PR 참조, 필수 CI/GHCR 실패·누락, 권한/네트워크 오류를 무조건 삭제나 retry로 우회하지 않는다. 원격 삭제 postcondition이 미확인이면 이슈를 완료 처리하지 않는다. 정책·모형·Git 검증과 실제 운영 증거를 구분해 PR/Issue에 기록한다.

정리 workflow는 PR #88/고정 branch에 한정하며 다른 main run은 no-op, 이미 없는 branch는 재삭제하지 않는다. 대상 이름을 재사용하지 않고 퇴역은 증거 보존 후 별도 검토된 운영 변경으로 진행한다. 정식 릴리스나 운영 배포를 생성하지 않는다.


## Issue #77 Context Menu 초기 submenu 상태 회귀

- Grid Task 우클릭 직후 root menu만 표시되고 `Add` 및 다른 submenu가 자동 표시되지 않는지 검증한다.
- Chart Task 우클릭에서도 동일한 초기 상태를 검증한다.
- 최초 focus는 root `role=menu` container에 있고, ArrowDown/ArrowUp/Home/End로 명시적 탐색한 뒤에만 menuitem focus가 이동하는지 검증한다.
- `Add` hover와 keyboard focus/ArrowRight에서만 submenu가 표시되고, Escape 후 reopen 시 이전 submenu 상태가 남지 않는지 검증한다.
- Issue #72의 Add / Convert to / Edit / Cut / Copy / Paste / Move / Indent / Outdent / Delete 회귀 테스트를 함께 유지한다.
- 공식 완료 판정은 동일 PR head SHA의 GitHub Actions `quality`, `e2e`, `docker` PASS와 merge 후 main GHCR exact-digest smoke 결과를 사용한다.


### Issue #97 Link persistence

Regression scope includes link command deduplication, protected POST/DELETE contracts, graph validation, revision +1/rollback, SQLite reopen and Docker volume restart persistence, Task Editor relation visibility, and preservation of the mounted Gantt instance during canonical synchronization.


## Issue #108 Excel Gantt 주차 헤더 회귀

- `excelIsoWeekHeader`가 동일 연도 일반 구간에서 ISO 계산 key(`YYYY-Www`)는 유지하고 표시 label은 주차 번호만 반환하는지 검증한다.
- `2026-12-31`과 `2027-01-01`이 기존 규칙대로 같은 `2026-W53` 그룹에 속하면서 둘 다 `53`으로 표시되고, `2027-01-04`는 `2027-W01`/표시 `1`로 전환되는지 검증한다.
- Excel `Gantt` 월 헤더 `YYYY-MM`, 일 헤더, 작업 데이터, 스타일, merge 범위, 관계 DrawingML, 다른 sheet 계약은 변경하지 않는다.
- PR gate는 version consistency, typecheck, lint, 전체 Vitest, Markdown link, production build, Chromium E2E, Docker smoke를 기존 기준 그대로 적용한다.
- 병합 후 main CI와 임시 GHCR image exact-digest smoke가 PASS한 뒤, 승인된 `v0.23.2` annotated tag에 대해 정식 GHCR release image를 게시하고 digest 재검증한다.


## Issue #84 Project List 검색·필터

- Unit: 공통 text trim/case normalization, contains/not-contains/equals, null owner와 assigned/unassigned, browser timezone calendar date 변환, equals/before/after/inclusive range, Quick Search + advanced AND, invalid range validation, deletedIds 조합과 source order 보존을 검증한다.
- Browser: Project명/owner/description 검색, 고급 조건 수, 결과/전체 count, 결과 0건 전용 empty state와 reset, 날짜 조건, Escape focus restore, 검색 상태의 Row Action과 삭제 성공 후 결과 제거, 입력 중 Project collection API 재조회 없음, 390/768/1024/1440 viewport document overflow를 검증한다.
- 기존 Project List 회귀인 Link, Copy, clipboard fallback, 삭제 취소/credential failure/success/conflict와 EmptyProjects는 기존 E2E suite를 계속 실행한다.
- API/DB schema는 변경하지 않으므로 API/DB 문서 회귀는 N/A다. 공식 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker`, 병합 후 main 임시 GHCR exact digest smoke, 승인된 정식 release image exact digest smoke를 사용한다.


## Issue #124 공통 Branch Cleanup 안전성

- 공통 `safe_branch_cleanup.validate_snapshot`은 merged PR/base/main/repository/branch identity와 정확한 merged head tip을 검증한다.
- 현재 branch tip이 merged PR head와 다르거나 삭제 직전 ref가 바뀌면 FAIL한다.
- target main SHA ancestry 불일치, protected branch, branch를 head/base로 사용하는 open PR이 있으면 FAIL한다.
- 정상 조건에서만 explicit SHA `--force-with-lease` 삭제 경로를 허용하며 REST 무조건 ref DELETE fallback은 금지한다.
- repository policy regression은 완료된 Issue별 release/cleanup helper가 active workflow로 재도입되지 않는지와 workflow 내부 직접 branch deletion 패턴을 `.yml`/`.yaml`, short/long delete option, empty-source refspec, YAML folded `run`까지 검사한다.
- quality job에서 `python3 scripts/verify-safe-branch-cleanup.py`를 실행하며 기존 typecheck/lint/unit/markdown/build/E2E/Docker gate를 대체하지 않는다.
- Issue #68/#72/#75/#76/#80/#83/#84/#87/#96/#97/#104/#108 전용 완료 helper와 #87 전용 verifier는 퇴역 대상으로 확인한다.
- application code/API/DB/UI와 현재 package version은 변경하지 않는다. 정식 release는 N/A이며 merge 후 main CI와 정책상 임시 GHCR exact-digest smoke/cleanup은 별도 원격 증거로 확인한다.

## Issue #115 작업 캘린더 미리보기 상태 회귀

- 실제 Chromium에서 신규 KR 캘린더를 US로 바꾸면 기존 결과가 즉시 숨겨지고 재계산 요청·저장 요청의 국가 코드가 모두 US인지 확인한다. 저장 성공 뒤 응답을 미리보기로 재사용하지 않고 canonical 재조회 경로를 유지한다.
- 국가/적용 범위/시작일/종료일, 휴무일 이름/날짜/대상/대상 선택, 규칙·휴무일 추가/삭제 각각의 변경은 이전 미리보기를 무효화한다. 원래 값으로 되돌려도 명시적 재계산 전에는 결과를 다시 표시하지 않는다.
- Preview 실패와 응답 형식 오류는 결과를 지우고 재시도 안내를 표시한다. 요청 중 초안 잠금, metadata 저장으로 설정 창이 닫힌 뒤 늦은 응답 무시와 401/412 분기는 전용 E2E에서 검증한다. 현재 If-Match 헤더 전송과 응답 내부 calendar revision 일치 검사는 코드에서 확인하며, 내부 revision 불일치 응답을 별도 E2E로 주입하지 않는다. 같은 editor mount 상태에서 revision prop만 바뀌는 경로는 현재 브라우저 UI에 없어 코드 경계·원격 회귀로 별도 확인한다.
- 390/768/1024/1440px에서 상태 문구와 미리보기·저장 버튼이 접근 가능하고 의도하지 않은 문서 가로 overflow가 없는지 확인한다. 변경 전후 화면은 비밀값 없는 별도 PNG로 보관한다.
- 전용 테스트는 `tests/e2e/project-work-calendar-preview.spec.ts`이며 기존 전체 E2E를 대체하지 않는다. PR head의 `quality/e2e/docker`와 main GHCR digest 검증은 원격 실행 증거로 별도 판정한다. API/DB/스케줄링 계약은 바꾸지 않으므로 관련 계약 문서 변경은 N/A다.

## Issue #116 작업 Context Menu 하위 메뉴 회귀

- `tests/e2e/project-task-context-menu.spec.ts`에 390/768/1024/1440px의 네 viewport 모서리 메뉴 anchor를 추가한다. 각 경우 활성 `Add` 하위 메뉴 전체가 viewport gutter 안에 있는지, 오른쪽/왼쪽 flyout 또는 같은 폭 drilldown으로 배치되는지 검사한다.
- 390px에서는 최초 root focus와 닫힌 child, focus만으로 열리지 않음, ArrowRight·click·Enter·Space 진입, ArrowLeft·Back 복귀, Escape 전체 닫힘과 원래 Task focus 복원을 검사한다. Convert to/Move/Paste의 좁은 drilldown과 명령 접근, 명령이 모두 비활성인 외동 Task의 Move 및 자식이 있는 Summary의 Convert to에서 Back focus fallback도 검사한다. 넓은 화면에서는 기존 hover/focus/#77 초기 상태와 세 하위 메뉴의 좌우 배치·활성 명령 접근, ArrowLeft 뒤 부모 focus·child hidden·`aria-expanded=false`를 검사한다. 또한 열린 Add child에서 일반 root 명령 `Edit`로 focus 또는 pointer가 이동하면 child가 닫히고 Add의 `aria-expanded=false`가 되는 회귀를 검사한다.
- 390×160 짧은 화면에서는 실제 End/Home/ArrowDown 키보드 탐색으로 root 내부 스크롤·마지막/root 중간 명령 가시성·문서 scroll 불변을 검사한다. 하위 메뉴 마지막 명령 접근, sticky Back, 좁은 화면의 실제 명령과 Gantt instance 유지도 확인한다. 기존 #72 명령과 #104 endpoint Link 분리는 `project-task-context-menu.spec.ts`에 있으며 readonly 계약은 별도 `task-context-menu-hierarchy.spec.ts`가 검사한다.
- 2026-09-24 현재 코드를 작성했으나 로컬 Playwright, unit, lint, typecheck, build는 **실행하지 않았다(NOT TESTED)**. 자동 테스트의 계획/작성은 PASS 증거가 아니다. 로컬 실행 시 `npx playwright test --config tests/config/playwright.config.ts tests/e2e/project-task-context-menu.spec.ts`와 변경 파일 lint/typecheck를 먼저 수행하고, PR head의 quality/e2e/docker는 해당 run의 원격 증거로 별도 판정한다.


## Issue #117 리소스 공수 조회 상태 회귀

- `tests/e2e/project-resource-workload-status.spec.ts`는 공수/assigned-targets의 첫 실패, 부분 실패, 개별 재시도, stale 결과, 네트워크 실패와 형식이 잘못된 HTTP 200 응답을 검사한다.
- assigned-targets가 최신 이름/코드를 반환하고 workload가 stale이어도 Group·Resource 행 라벨이 최신 메타데이터를 우선 표시하는지 검증한다.
- 개별 재시도 버튼은 요청 중에도 DOM에 유지되어 disabled/aria-busy가 되고 keyboard focus가 보존되는지, 재실패 후 같은 재시도 제어로 복귀하는지 검사한다.
- M/D·M/M, 검색/종류/활성/기간 필터, 열린 details, tab 왕복, SVAR Gantt instance 및 좁은 viewport의 overflow 계약을 유지한다.
- 진행 중 전역 새로고침 중복 요청 방지와 화면 이탈 뒤 늦은 응답 무시를 검사한다. API/domain/revision 계약 변경은 없으므로 API·DB·Scheduling 문서 영향은 N/A다.
- 최종 판정은 최신 PR head의 원격 `quality/e2e/docker` 전체 결과를 사용하며 이전 head의 PASS는 재사용하지 않는다.


## Issue #118 Project Context와 일정 도구줄 회귀

- `tests/e2e/project-context-toolbar-responsive.spec.ts`는 390/768/1024/1440px에서 긴 Project 이름만 말줄임되고 읽기 전용/편집 중 badge·정보·핵심 action 문구가 단일 행으로 viewport 안에 보이는지, 긴 설명의 정보 panel이 viewport 안에서 스크롤 가능한지 확인한다.
- 일정 도구줄은 390/768px에서 검색·필터가 첫째 줄, 결과·조건부 초기화가 둘째 줄인지 확인한다. 검색 결과·초기화 후 검색 focus, 필터 버튼의 `aria-controls`/`aria-expanded`, panel Escape 후 닫힘과 필터 버튼 focus 복원을 검증한다.
- readonly/editing 양쪽에서 검색·필터 전후 Gantt 상단 위치·높이와 document 가로 overflow, 일정↔리소스 tab 왕복 시 동일 Gantt DOM/API instance를 확인한다. 같은 spec에서 SVAR 내부 scale toolbar의 주 단위 선택과 차트 내부 가로 스크롤이 검색·초기화·tab 왕복 뒤 유지되는지도 확인한다. Scale 단위 전환 자체는 `tests/e2e/project-gantt-scale.spec.ts`, tab 왕복의 가로 스크롤은 `tests/e2e/project-workspace-ux.spec.ts`, tree 접힘·선택·column 표시/너비 상태의 기존 mutation 회귀는 `tests/e2e/project-gantt-stability.spec.ts`, column 메뉴와 긴 목록 스크롤은 `tests/e2e/project-workspace-layout.spec.ts`가 각각 검사한다. 새 #118 spec은 tree/column을 직접 변경하지 않으므로 이 계약의 이번 조합별 검증으로 과대 해석하지 않는다. SVAR 내부 scale toolbar CSS/구현은 수정 대상이 아니다.
- 이 명세의 `search-idle`/`search-reset` PNG는 새 구현에서 검색 전과 초기화 후를 기록할 예정이며 구현 전후 증거가 아니다. 높이 개선의 전후 판정에는 동일 fixture·viewport·readonly/editing 상태에서 구현 전 baseline과 변경 후 Gantt 위치·높이를 별도 측정해야 한다. 기존 390×844/768×1024 자료는 새 동일 fixture 비교의 수치 기준으로 사용하지 않는다. 전용 `Issue #118 구현 전후 레이아웃 증거` Workflow는 Before `703a6f08595dea06a918366192df464d7215108e`와 After `6386db860af69635cfb0fe626fd1a937905b9a56`에 동일 harness를 적용하고 390/768/1024/1440px 모두 **높이 844px**로 고정하여 editing/readonly를 측정한다. 390/768의 Gantt 가시 높이 개선, After document horizontal overflow 부재, 정보 컨트롤 단일 행을 Gate로 하고 raw metrics·comparison·before/after screenshot을 `issue-118-before-after-evidence` artifact에 보관한다. 일반 원격 `quality/e2e/docker`와 evidence Workflow는 서로 대체하지 않으며 최신 PR head에서 각각 판정한다. API/DB/Scheduling 테스트 및 문서 변경은 계약 불변으로 N/A다.


## Issue #119 반복 입력과 오류 연결 회귀

- `tests/e2e/project-repeated-input-accessibility.spec.ts`는 390/768/1024/1440px에서 Project 생성, 작업 캘린더, 반복 리소스 할당을 keyboard-only 제출한다. 각 필드의 고유 accessible name·fieldset/legend, `aria-invalid`·`aria-describedby`와 표시 오류, 제출 뒤 summary focus 및 요약 항목→오류 입력 focus를 검사한다.
- 잘못된 Project 생성은 POST 0회, 잘못된 캘린더 Preview/Save는 각각 POST/PUT 0회, 잘못된 할당은 PUT 0회를 검사한다. 입력 초안·date/percent 값, 키보드 조작과 문서 가로 overflow도 확인한다. 기존 생성 회귀인 `tests/e2e/project-create-and-read.spec.ts`의 단일 오류 text 기대는 새 복수 오류 요약과 필드 오류 링크에 맞춰 갱신하되 정상 생성·조회·복사·삭제 경로는 유지한다.
- #115의 `tests/e2e/project-work-calendar-preview.spec.ts`는 유효한 초안의 Preview/Save, 상태·실패·401/412·stale 응답을 계속 검증한다. 작업 저장/할당 저장 독립성과 revision·권한 계약은 기존 `tests/e2e/project-task-editor.spec.ts` 및 전체 원격 회귀로 함께 확인한다. 해당 API/domain 코드는 바꾸지 않는다.
- 로컬 Playwright·lint·typecheck·build·browser는 사용자 지시에 따라 **NOT TESTED**다. 작성된 명세의 PASS를 주장하지 않고 PR head의 `quality/e2e/docker` 실제 run으로 판정한다. API·DB·Scheduling 문서 갱신은 계약 불변으로 N/A다.

## Issue #121 App Shell 본문 바로가기 회귀

- `tests/e2e/skip-link.spec.ts`는 390/1440px에서 첫 Tab이 header 앞의 `본문으로 바로가기`에 도착하고 링크가 viewport 안에서 보이는지, 그 focus 순간의 PNG, `href=#main-content`/main `id`/`tabIndex=-1`, Enter 뒤 main focus, 다음 Tab이 본문 control로 이어지는지 검사한다. 본문 control이 없는 조회 중 상태는 main focus까지만 검사한다.
- 빈 Project 목록·리소스 관리·생성 화면·Project 조회 중·조회 오류·정상 Gantt 화면에서 같은 landmark를 확인한다. 프로젝트 목록→리소스 관리 Next client navigation에서는 동일 main DOM을 확인하고, reload 뒤 첫 Tab도 검사한다. 테스트용으로 main 높이를 늘려 아래로 스크롤한 뒤 skip을 실행해 scroll 위치가 main 쪽으로 되돌아오는지 확인한다.
- Modal dialog가 열리면 기존 focus trap 안에 Tab focus가 남고 skip link가 선점하지 않으며 Escape 뒤 설정 trigger focus를 복원하는지 확인한다. Skip 동작 중 API mutation 0회, 동일 Gantt DOM/API instance, document 가로 overflow 부재를 확인한다.
- 오류·읽기 전용·편집 중 Project에서 skip link Enter 후 main focus와 다음 Tab의 본문 control 이동, 화면 상태 안정성, edit-session/current GET 및 document navigation 0회를 확인한다. 같은 문서의 해시만 바뀐 popstate는 재확인 대상이 아니며, 실제 history 복귀의 재확인과 실패 시 읽기 전용 재시작은 `project-edit-permission-recheck.spec.ts`가 계속 검증한다. BFCache `pageshow.persisted` 분기는 코드에서 유지 여부를 확인하고 환경별 실제 BFCache 재현은 별도 증거로 판정한다.
- Native fragment focus/scroll가 브라우저별로 충분한지 실제 Chromium E2E에서 판정한다. API/DB/Scheduling 계약은 변경하지 않으므로 관련 문서·테스트 영향은 N/A다.

## Issue #130 Phase 1 Project List 시각·동작 회귀

- `tests/e2e/project-list-search-filter.spec.ts`의 Phase 1 명세는 긴 한국어·영어 이름과 설명, 소유자, 3행 이상의 동일 fixture에서 390×844·768×900·1024×900·1440×900·1600×900을 순회한다. Browser zoom 100%에서 native table과 62rem 최소 폭, wrapper 내부 스크롤, 문서 가로 overflow 없음, 설명 최대 두 줄, compact 행 높이, More 열 너비를 확인하고 viewport별 새 구현 상태 PNG를 남긴다.
- 각 폭에서 마지막 행 More 메뉴의 viewport bounds, 첫 명령 focus, End/Home 탐색, Escape 닫힘과 trigger focus 복원을 확인한다. 390px는 Project Link에서 Tab으로 More trigger에 도착해 Enter로 연다. 검색 결과 0건 상태와 초기화 후 원래 3행 복귀를 확인한다. 좁은 화면에서 유효한 Quick Search·프로젝트명 조건과 잘못된 생성일 범위를 함께 설정해 날짜 오류가 화면 안에 표시되고 유효한 조건의 단일 결과가 유지되는지도 확인한다. 기존 #84 명세의 AND predicate·결과 수·날짜·삭제 상태, 기존 Project Link/Copy/delete 인증·If-Match·401/412 회귀는 기존 전용 E2E와 전체 원격 suite를 유지한다.
- 구현 전후 시각 비교는 동일 fixture·viewport·zoom·상태의 **별도 baseline**과 변경 후 wrapper/열/행/overflow/menu 수치·PNG가 필요하다. 작성된 `issue-130-list-current-*.png`는 변경 후 상태만 기록하며 개선 수치가 아니다. 로컬 브라우저·Playwright·lint·typecheck·build와 실제 전후 캡처는 사용자 지시에 따라 **NOT TESTED**다. PR head의 `quality/e2e/docker`는 실제 run 증거로 판정한다. API/DB/Scheduling 계약 불변으로 해당 문서·테스트 변경은 N/A다.

## Issue #130 Phase 2 Project Workspace 시각·동작 회귀

- `tests/e2e/project-workspace-ux.spec.ts`의 Phase 2 명세는 동일한 긴 한국어·영어 제목/설명 fixture에서 390×844·768×900·1024×900·1440×900·1600×900의 읽기 전용/편집 중 상태를 확인한다. 제목 ellipsis와 전체 이름 `title`, badge·정보·핵심 action·더보기의 단일 행/viewport 접근, Context와 Gantt top/height, 문서 가로 overflow를 기록한다. 각 폭의 PNG는 현재 구현 상태다.
- 정보/더보기 panel의 viewport bounds와 Escape 닫힘·summary focus 복원, 일정/리소스 탭의 `aria-controls`·tabpanel·Home/End focus 및 같은 Gantt instance를 검증한다. 조회 중·오류 상태와 재시도 뒤 작업공간 복귀도 별도 route 명세로 확인한다. 기존 `project-workspace-ux.spec.ts`는 ArrowLeft/ArrowRight와 chart scroll을, `project-context-toolbar-responsive.spec.ts`는 주 단위 선택과 chart scroll을, `project-gantt-stability.spec.ts`는 tree/column/selection 회귀를 계속 검증한다. 새 Phase 2 명세가 모든 조합에서 tree/column/selection을 직접 조작한 것으로 해석하지 않는다.
- 동일 fixture·viewport·권한 상태의 **구현 전** Context/Gantt geometry·PNG baseline과 변경 후 수치를 별도로 측정해야 시각 개선을 판정할 수 있다. 작성된 새 구현 PNG나 과거 다른 viewport 수치를 전후 증거로 사용하지 않는다. 로컬 브라우저·Playwright·lint·typecheck·build 및 실제 전후 측정은 사용자 지시에 따라 **NOT TESTED**다. PR head의 `quality/e2e/docker`는 실제 run 결과로 별도 판정한다. API/session/revision/domain 계약 불변으로 API·DB·Scheduling 문서 영향은 N/A다.

## Issue #130 Phase 3 Task Editor 시각·동작 회귀

- `tests/e2e/project-task-editor.spec.ts`의 Phase 3 명세는 동일 Task fixture에서 390×844·768×900·1024×900·1440×900·1600×900 modal bounds, header 유형/External ID/Revision, tabs→본문→footer 수직 구조, 문서/대화상자 가로 overflow, footer 버튼 접근을 확인한다. 390px의 본문 스크롤 중 header/footer geometry가 유지되는지와 768px에서 내용이 넘칠 때 같은 계약을 확인한다. 1024px 이상은 작업명·진행률과 선행/후행 관계를 나란히, 390/768px은 한 열로 확인한다. 각 PNG는 새 구현 상태다.
- 같은 spec의 기존 명세가 modal focus trap/Escape dirty confirmation·원래 Task focus 복원, readonly/stale/412/failed reload의 초안 보존, 저장 중 PATCH 1회와 If-Match/canonical 결과, tab 키보드 이동, Resource 검색·Assignment 독립 저장 경계를 계속 확인한다. #119 반복 할당의 fieldset·오류 연결은 `project-repeated-input-accessibility.spec.ts`가 직접 검사한다. 새 Phase 3 viewport 명세만으로 모든 상태 조합을 직접 검증한 것으로 해석하지 않는다.
- 구현 전후 비교에는 같은 fixture·viewport·상태의 기존 modal/header/body/footer/필드·관계 geometry와 PNG baseline이 별도로 필요하다. 현재 baseline·실측과 로컬 Playwright·lint·typecheck·build·브라우저 검증은 사용자 지시에 따라 **NOT TESTED**다. PR head의 `quality/e2e/docker`는 실제 run 결과로 판정한다. Task PATCH/Assignment PUT/API·DB·Scheduling 계약은 변경하지 않으므로 관련 문서 영향은 N/A다.

## Issue #130 Phase 4 Search / Filter 공통 회귀

- `tests/e2e/project-filter-toolbar-consistency.spec.ts`는 Project List, 일정, 리소스에서 390×844·768×900·1024×900·1440×900·1600×900의 검색/필터/조건부 초기화/일치·전체 결과를 확인한다. 좁은 폭은 실제 control bounds의 첫째/둘째 행 겹침과 viewport 접근, 문서 가로 overflow를 확인한다. Reset 후 검색 focus, 고급 패널 Escape 뒤 필터 trigger focus 및 `aria-controls`/활성 조건 수를 검증한다. PNG는 변경 후 상태만 기록한다.
- Project List의 기존 `project-list-search-filter.spec.ts`가 #84 AND predicate·timezone 날짜·역순 날짜 오류 무시·no-result·삭제를 유지한다. 일정의 기존 `project-context-toolbar-responsive.spec.ts`와 `project-search-filter` 회귀는 client 필터·Gantt instance/scale/scroll을 확인한다. Phase4 전용 명세는 일정 섹션 설명이 정적이며 동적 결과 수는 도구줄 한 곳에만 있는지도 확인한다. Resource는 기존 `project-resource-workload-status.spec.ts`가 독립 공수/메타데이터 상태, M/D·M/M, 조회 중·실패·stale/부분 실패와 열린 details 보존을 검사하고, 고급 패널로 옮긴 종류·활성·Task 기간 control을 계속 조작한다. 날짜 역순은 기존 자동 양끝 정렬을 안내한다. 한쪽 날짜 입력은 '두 날짜 모두 입력' 안내와 함께 적용 조건 수에서 제외하고 Reset은 제공하며, 기존 Task 기간 predicate와 결과에는 적용하지 않는다. 오류 카드의 #120 상태 토큰과 390/768 도구줄 control viewport 접근은 정적 CSS 검토·원격 E2E에서 판정한다. 필터 입력·초기화는 API 재조회/보호 mutation 0회를 검증한다.
- 같은 fixture·viewport·상태의 구현 전 geometry/PNG baseline과 변경 후 자료를 별도로 비교해야 시각 개선을 판정할 수 있다. 로컬 Playwright·lint·typecheck·build·브라우저 및 전후 실측은 사용자 지시에 따라 **NOT TESTED**다. PR head의 `quality/e2e/docker`는 실행 결과로 별도 판정한다. API/domain/predicate 계약 불변으로 API·DB·Scheduling 문서 변경은 N/A다.

## Issue #155 Gantt Grid·Chart native 전체화면

- `tests/e2e/project-gantt-fullscreen.spec.ts`: 390×844·768×900·1024×900·1440×900에서 native fullscreen target이 `.project-gantt-frame`인지, App Shell·프로젝트 정보·검색/필터·리소스 panel이 target 밖인지, 버튼/`Ctrl/Cmd+Shift+F`/Escape와 진입·종료 focus, scale toolbar·Grid·Chart bounds, viewport resize 뒤 실제 상태 표시, 같은 SVAR instance/API identity, 보호 mutation 0회와 route 이탈 정리를 확인한다. 캡처는 변경 후 상태이며 동일 fixture의 구현 전 baseline과 혼동하지 않는다.
- 같은 spec은 실제 Grid↔Chart splitter와 작업 열 너비를 조정한 뒤 Summary collapse·선택·표시 열·주 단위·Chart 가로 scroll·Gantt 세로 scroll 및 Grid row↔Chart bar 정렬 보존을 확인한다. Fullscreen 안의 작업 메뉴 Escape 뒤 메뉴 닫힘·유효 focus·실제 fullscreen 상태와 버튼 표시 일치, 입력/contenteditable/dialog shortcut guard, 편집 가능한 메뉴 Edit와 readonly 더블클릭의 전체화면 종료 후 Task Editor 진입을 확인한다. 메뉴 Escape가 native fullscreen까지 종료할지는 브라우저에 맡긴다. Request/exit rejection은 브라우저 API를 명시적으로 거부하도록 주입하고 실제 fullscreen 상태/오류 문구/숨겨진 dialog 및 메뉴 Edit 실패 뒤 Task focus 복원을 구분한다. 기존 Task Editor dirty·stale·401/412·If-Match·Assignment 독립 저장은 별도 전용 spec의 계약을 유지한다.
- Fullscreen API는 사용자 활성화·권한·브라우저 구현에 의존한다. 로컬 Playwright·lint·typecheck·build·브라우저와 실제 Edge/Chrome 수동 동작은 사용자 지시에 따라 **NOT TESTED**다. PR head `quality/e2e/docker`는 새 실행 결과로 판정한다. API/DB/Scheduling 문서는 계약 불변으로 N/A다.

## Issue #136 공통 헤더 빌드 버전 회귀

- `tests/e2e/workspace-header-version.spec.ts`는 `package.json.version`과 화면의 `v<SemVer>`가 일치하는지 검사한다. Infra가 version을 올린 PR 빌드에서도 테스트가 같은 package 원천을 읽으므로 화면의 수동 고정값을 허용하지 않는다.
- 390px에서는 기존 M 마크만 보이고, 480px에서는 브랜드 이름을 우선해 버전을 숨기며, 768/1024/1440px에서는 브랜드 옆 버전이 낮은 글자 위계로 보이는지 검사한다. 다섯 폭 모두 헤더 높이 57px 이하, 주요 navigation/알림 영역의 viewport 내 배치와 문서 가로 overflow 부재를 확인하고 변경 후 PNG를 남긴다. 홈 링크의 접근 가능한 이름·`href=/`·리소스 이동 후 홈 복귀 및 navigation `aria-current`도 확인한다.
- 로컬 Playwright·lint·typecheck·build·브라우저 및 실제 구현 전후 화면 비교는 사용자 지시에 따라 **NOT TESTED**다. 작성된 명세와 PNG 경로는 실행 증거가 아니다. PR head의 `quality/e2e/docker`는 실제 run에서 별도 판정한다. API/DB/Scheduling 및 보안·권한 계약 불변으로 해당 문서·테스트 변경은 N/A다.

## Issue #141 브라우저 제목과 파비콘 회귀

- `tests/e2e/project-browser-title-favicon.spec.ts`는 실제 격리 SQLite Project 세 건으로 목록·리소스·생성·Gantt 데모의 정확한 `masterGantt` 제목, 직접 URL의 서버 GET 전체 HTML에 포함된 초기 `masterGantt|canonical name`과 hydration 뒤 제목을 구분해 검사한다. 새로고침, SPA A→목록→B 이동, 같은 이름·서로 다른 publicId의 프로젝트→목록→다른 프로젝트 이동 및 프로젝트 이탈 후 기본 제목 복원도 확인한다. 로딩 중 잠시 기본 제목은 허용하며 404·클라이언트 조회 실패에서는 기본 제목을 확인한다.
- 프로젝트 이름 초안과 HTTP 500 저장 실패·401은 마지막 확정 이름을 유지하고, 성공한 metadata 저장은 전체 페이지 reload 없이 새 확정 이름을 제목에 반영하는지 확인한다. 412 재조회 대기 중에는 기본 제목으로 돌아갔다가 성공한 canonical 재조회 뒤 이름을 복원하는지 검사한다. 비밀번호·세션·If-Match·서버 인가 경로 자체는 기존 회귀에서 계속 검증한다.
- `<head>`의 SVG icon 링크와 해당 응답의 HTTP 200·M 브랜드 색상·SVG MIME을 확인한다. SVG 링크/응답만으로 실제 브라우저 탭 렌더링을 PASS로 보지 않으며 Edge/Chrome/Firefox/Safari 수동 시각 검증은 별도다. 로컬 Playwright·lint·typecheck·build·브라우저는 사용자 지시에 따라 **NOT TESTED**이고 원격 PR head의 `quality/e2e/docker`는 실제 run 결과로 판정한다. API/DB/Scheduling·보안·권한 계약 및 DESIGN/UI_UX_GUIDELINES 공통 원칙은 바뀌지 않으므로 해당 문서 영향은 N/A다.
- App Router의 `src/app/error.tsx`는 기존 오류 기록·다시 시도 버튼을 유지하면서 기본 제목을 복원한다. 전용 E2E는 malformed 프로젝트 조회 응답으로 client render 오류 경계를 유도해 오류 화면·재시도 버튼·기본 제목을 확인한다. 서버 렌더 DB 오류까지 별도로 주입한 것은 아니므로 그 경우의 화면·제목은 코드 검토와 원격 일반 회귀 범위로 구분한다.
