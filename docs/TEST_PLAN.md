# Test Plan

> **Issue #8 전송 정책:** production 기본값은 HTTPS다. `ALLOW_INSECURE_HTTP=true`와 canonical HTTP `APP_BASE_URL`을 함께 설정한 내부망은 production HTTP도 지원한다. 시작·readiness·공유 URL·모든 인증 경로는 같은 정책을 사용한다. `SESSION_COOKIE_SECURE`는 미사용 예약값이며 제거했다. HTTP에서는 `mastergantt_edit`, HTTPS production에서는 `__Host-mastergantt_edit; Secure`를 사용하고 HttpOnly·SameSite=Strict·Path=/·TTL 및 Domain 미설정을 유지한다. 아래 과거 검증 이력의 HTTPS-only 표현은 당시 기준이다. 현재 운영·전환 절차는 [HTTP_OPERATION](HTTP_OPERATION.md)을 따른다.


2026-09-12 후속 UI 변경의 테스트는 사용자 요청에 따라 일괄 실행까지 보류한다. 새 작업 이름·날짜·기간 자동 적용의 검증 항목과 기존 E2E 갱신 필요 사항, 별도 원격 push 절차는 [PENDING_TESTS.md](PENDING_TESTS.md)에 기록한다. 기존 PASS를 후속 변경에 적용하지 않는다.

상태: qa_docs가 작성한 검증 전략. W02–W07, W20과 W21 검증 기록은 [W07_REVIEW.md](W07_REVIEW.md), [W20_REVIEW.md](W20_REVIEW.md), [W21_REVIEW.md](W21_REVIEW.md)를 참조한다. 아래 표는 전체 제품 계획이며 W20의 로컬 container PASS도 원격 Actions/GHCR, production host/backup/restore와 VBA 통과를 뜻하지 않는다.

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
| R21–R22 | DEP01–07 |
| R23–R24 | Agent 설정·독립 QA·Manager 기록과 구현별 build/typecheck/tests |
| R25 | UI01–02, Project List 공개 정책 D02 |
| R29 | UI03–10, SVAR 공식 Grid/Chart·Resizer API와 Browser geometry |
| R30 | CI09–10, main-only publish 조건·immutable tag·digest HTTP persistence smoke |
| R31 | project-create-and-read / project-links-persistence: 목록 삭제 재인증·취소·삭제 후 404 및 기존 서버 권한 |
| R32–R38 | project-gantt-stability / project-task-persistence / project-workspace-layout: 팝업 없는 child 생성·상위 집계·locale·열 선택·geometry·인스턴스 유지 |
| R39–R41 | project-notifications / project-modal-feedback / project-links-persistence, workspace-notification-state / project-share-url: 알림·안전한 진단·링크·clipboard 및 fallback |

PR gate는 build/typecheck와 관련 unit/integration/E2E, migration 회귀, dependency/license 검토, 문서 일관성이다. 현재 command는 `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`다. 구현 PR은 test ID에 실제 command·결과를 연결해야 한다.

Unauthorized/cross-project write, secret 유출, stale overwrite, cycle 누락, partial import, XLSX formula/link injection, migration/restore 실패, restart 데이터 손실은 release blocker다. QA 보고는 Summary/Requirement Coverage/Test Results/Failures/Security/Regression/Documentation/Remaining Risks/Recommendation을 포함한다.

## Repository layout relocation (#12)

현재 배포 경로와 기존 Compose 프로젝트/volume을 유지하는 전환 절차는 [REPOSITORY_STRUCTURE](REPOSITORY_STRUCTURE.md)를 따른다. CI의 Docker build 4개 참조와 Dependabot 경로를 함께 갱신하고 Docker gate에 `scripts/verify-compose-smoke.sh`를 추가했다. 새 Compose 경로의 config, startup/readiness, restart 및 강제 recreate 후 SQLite 보존을 격리된 CI 리소스로 검사한다. 기존 quality/E2E/runtime/registry 권한·검증 gate는 유지한다. 결과는 해당 PR/run/head의 실제 증거로 판정하며 과거 Wxx 기록을 이번 이동의 PASS로 전용하지 않는다.

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
- **Service/API**: countries/read/preview/replace, edit session/Origin/If-Match, stale revision, Calendar exception 충돌, Manual conflict rollback, dependency link 안전 거부, revision 정확히 +1.
- **Resource workload**: Project+Group+Resource Effective Calendar를 이용한 M/D, M/M 분자, 일별 allocation/과투입 판정. Group/Resource 휴무가 Project Task start/end를 이동시키지 않는지 검증.
- **Project copy**: source의 materialized Calendar rule/date가 새 Project로 독립 복사되고 source revision/Calendar는 변경되지 않는다.
- **UI/Chromium**: 설정 modal의 Calendar rule/custom date 편집, Preview/저장, canonical snapshot 재조회, 신규 KR 기본 Calendar의 실제 휴일 이동, 기존 알림/geometry/Gantt instance 회귀.
- **Docker**: migration 0006 적용 후 readiness, SQLite restart persistence, production HTTP/HTTPS 인증·Cookie·영속성, relocated Compose persistence.

PR #66 최종 검증 기준은 CI Run #350이며 quality, Chromium E2E 50/50, Docker smoke가 모두 PASS했다. Merge 후 main은 같은 gate를 다시 실행한 뒤 임시 `ci-<SHA>` GHCR image를 exact digest로 검증하고 삭제한다. SemVer release image는 annotated `v0.16.0` tag를 release authority로 사용한다.
