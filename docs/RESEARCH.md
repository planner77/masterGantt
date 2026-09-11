# Bootstrap research

확인일: 2026-09-11. Researcher의 공식 자료 조사와 Scheduler/Infra/Manager 검토를 통합했다. 공개 문서 확인과 실제 설치·실행 결과는 구분한다. W01 lockfile 및 실행 검증 결과를 아래에 별도로 기록한다.

## W01 설치 및 실행 검증

W01 lockfile에 Next.js 16.3.4, React 19.3.0, TypeScript 5.8.3, Vitest 5.0.0, Playwright 1.63.0이 기록되었다. `npm install` audit은 0 vulnerabilities였고 typecheck/lint/unit test와 Webpack production build가 PASS했다. 기본 Turbopack 및 sandbox 개발 서버는 process/port 권한 제한으로 검증하지 못했으며 이는 제품 결함 판정이 아니다. `GET /api/health/live`는 `{"status":"ok"}`를 반환했다.

## W02 SQLite 설치 및 실행 근거

2026-09-11 npm registry의 `better-sqlite3` 배포 manifest를 확인하여 **13.0.3**, MIT, Node `>=22`를 설치했다. 타입 정의는 `@types/better-sqlite3` **9.6.0**, MIT, TypeScript 최소 5.6이다. 현재 Node **22.14.0**, Linux x64에서 native module 로딩과 메모리 DB 쿼리를 실행했으며 bundled SQLite는 **3.53.4**였다. 이 결과는 Docker/다른 CPU의 검증을 대신하지 않는다. [공식 package metadata](https://www.npmjs.com/package/better-sqlite3), [공식 Repository](https://github.com/WiseLibs/better-sqlite3), [타입 정의](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/better-sqlite3)

이 설치 artifact는 `prebuilds/` 및 `node-addon-api`를 포함하고 `gypfile: false`이며, 예전 버전의 `prebuild-install || node-gyp rebuild` 설치 흐름을 그대로 가정할 수 없다. W16에서는 실제 설치 manifest와 target platform의 native 쿼리를 다시 확인한다. 마이그레이션 CLI는 `tsx` **4.23.13**(MIT, Node >=18)을 runtime dependency로 사용하여 Node에서 TypeScript 코어를 실행한다. [tsx 공식 Repository](https://github.com/privatenumber/tsx)

`better-sqlite3`의 transaction callback은 동기 실행이며 예외 전파 시 rollback한다. SQL 파일 로딩은 transaction 전에 끝내고 ledger 검증과 DDL 적용을 `BEGIN IMMEDIATE` 안에서 수행하도록 결정했다. [공식 transaction API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#transactionfunction---function)

## W04 Project 생성·Direct Read 조사와 설치 검증

Node 22 내장 `crypto.randomUUID()`, `randomBytes()`, async `scrypt()`와 SHA-256 hash만으로 canonical UUID, password derivation, 고엔트로피 session token/digest를 구현할 수 있다. W04는 `randomUUID`, 16-byte salt, `scrypt N=32768/r=8/p=3/keyLength=32/maxmem=64MiB`, 32-byte random session과 SHA-256 digest를 사용한다. Password 비교의 `timingSafeEqual`은 unlock을 구현하는 W05에서 적용한다. [Node.js Crypto](https://nodejs.org/api/crypto.html)

Next.js 16 App Router의 동적 route `params`는 Promise이므로 page와 Route Handler에서 `await params`를 사용했다. `better-sqlite3`와 Node crypto를 쓰는 Project API는 `runtime = "nodejs"`, DB 조회 route는 `dynamic = "force-dynamic"`으로 선언했다. [Route Handler](https://nextjs.org/docs/app/api-reference/file-conventions/route), [Dynamic segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes)

Project request schema에는 설치 시 npm metadata와 artifact를 확인한 Zod **4.6.2**, MIT를 exact direct dependency로 고정했다. `strict()` object와 refinement/transform으로 unknown field, malformed Unicode, Unicode code-point 길이와 password UTF-8 byte 상한을 server에서 검증한다. Client 검증은 UX일 뿐 이 경계를 대체하지 않는다. [Zod 공식 문서](https://zod.dev/), [npm package](https://www.npmjs.com/package/zod)

W04 구현 선택과 실행 결과는 [W04_REVIEW.md](W04_REVIEW.md)에 분리했다. Production hardware의 scrypt latency/memory와 trusted proxy 기반 limiter는 실제 D03 환경에서 다시 측정하며, 공개 direct read 모델이 조직 기밀성 요구를 충족하는지는 코드로 추정하지 않는다.

## W05 Edit Authorization 조사와 적용

Node 공식 `crypto` 계약상 `scrypt` salt는 random 16 bytes 이상을 사용하고, `timingSafeEqual`은 같은 byte length의 입력에 적용해야 하며 주변 코드 전체를 자동으로 timing-safe하게 만들지는 않는다. W05는 저장 record가 정확히 지원 profile인지 먼저 검사하고, 정상 record와 dummy record 모두 같은 process-global KDF capacity를 거쳐 derive한 뒤 동일 길이 Buffer를 비교한다. Unknown Project와 손상 credential도 지원 profile의 dummy scrypt 뒤 동일한 `401 INVALID_CREDENTIALS`를 사용한다. [Node.js Crypto](https://nodejs.org/api/crypto.html)

Next.js 16.3.4의 local 설치 문서와 공식 문서를 다시 대조했다. Dynamic Route Handler의 `params`는 Promise이며 Cookie write/delete는 Route Handler에서 가능하다. Route Handler는 public API surface이므로 Client Component의 edit 상태와 별개로 데이터 source 가까이에서 authorization을 검사해야 한다. 구현은 native `Request`의 bounded Cookie header를 읽고 native `Response`의 `Set-Cookie`를 사용하며 모든 dynamic params를 `await`한다. [Route Handler](https://nextjs.org/docs/app/api-reference/file-conventions/route), [cookies](https://nextjs.org/docs/app/api-reference/functions/cookies), [Authentication](https://nextjs.org/docs/app/guides/authentication)

OWASP CSRF 지침은 unsafe request에서 source/target origin의 정확한 비교와 missing Origin의 보수적 거부를 권고한다. W05는 trusted `APP_BASE_URL`과 scheme/host/port를 정확히 비교하고 forwarded Host 또는 `X-Forwarded-For`를 신뢰하지 않는다. Cookie `SameSite=Strict`는 보조 방어이며 Origin 검사를 대체하지 않는다. [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

W05는 기존 `0001_initial_schema.sql`의 password KDF·auth version·edit session binding/expiry/revoke column으로 요구를 충족해 migration을 추가하지 않는다. Password rotation의 비싼 KDF는 transaction 밖에서 실행하되, session과 aggregate revision은 `BEGIN IMMEDIATE` write transaction 안에서 다시 확인해야 race에서 revoke된 token이 write하지 못한다는 것이 Manager 설계 판단이다.

## W06 Date-only Calendar 조사와 적용

ECMAScript Date Time String Format은 offset 없는 date-only 문자열을 UTC로 해석하지만 offset 없는 date-time은 local time으로 해석한다. Date는 instant/timezone 모델이므로 `new Date("YYYY-MM-DD")`, local 자정 또는 밀리초 차이를 업무 날짜 산술에 사용하지 않는다. W06은 검증된 Gregorian year/month/day를 ordinal로 변환해 host timezone과 DST에 독립적으로 계산한다. [ECMAScript Date Time String Format](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-date-time-string-format), [Time Values](https://tc39.es/ecma262/2025/multipage/numbers-and-dates.html#sec-time-values-and-time-range)

현재 Node 22.14.0에서 표준 `Temporal`은 제공되지 않아 polyfill 의존성을 추가하지 않았다. 작은 v1 Calendar는 자체 ordinal 구현으로 제한하고 전체 지원 범위 `1900-01-01..2199-12-31`의 109,573일을 독립 UTC oracle과 왕복·요일 대조했다. 실제 계산 코드는 `Date`, `Intl`, process timezone을 사용하지 않으며 UTC·Asia/Seoul·America/New_York·Europe/Berlin·Pacific/Apia child process와 세 Chromium timezone에서 동일 결과를 확인했다.

IANA timezone 자료는 civil-time 규칙이 정책 변경에 따라 갱신될 수 있음을 설명한다. W06의 `Asia/Seoul`은 Project 업무 날짜의 identifier일 뿐 offset 변환 입력이 아니다. 향후 시각 단위 일정이 생기면 tzdb/version 정책을 별도 결정한다. [IANA tzdb theory](https://www.iana.org/time-zones/theory), [tzdb zone list](https://github.com/eggert/tz/blob/main/zonenow.tab)

W06의 weekend는 exact `[6,0]`, 일반 Task duration은 `1..10000`, Holiday는 중복 날짜를 거부하고 nullable 표시명을 보존한다. 임의 국가 공휴일은 생성하지 않는다. Summary/WBS와 FS/Manual aggregate conflict는 이 Calendar 기반 위에서 W08/W09가 독립 구현한다. 실행 근거는 [W06_REVIEW.md](W06_REVIEW.md)에 기록한다.

## SVAR Core와 API

### W03 설치 검증 — 2026-09-11

npm registry와 설치 artifact를 다시 확인하여 `@svar-ui/react-gantt` **2.7.3**을 exact dependency로 고정했다. License는 MIT, peer dependency는 React/React DOM `>=18`이며 현재 React 19.3.0과 선언상 호환된다. 설치 뒤 production dependency audit은 vulnerability 0건이다. Package는 `@svar-ui/gantt-data-provider` 2.7.2를 transitive dependency로 포함하지만, W03은 고정 fixture만 렌더링하므로 provider를 직접 import하거나 별도 top-level dependency로 선언하지 않는다. W07에서 실제 API 저장 경계를 구현할 때 공식 provider 계약과 본 프로젝트의 인증·revision·server scheduling 응답을 다시 비교한다. [npm package](https://www.npmjs.com/package/@svar-ui/react-gantt), [공식 Repository](https://github.com/svar-widgets/react-gantt)

공식 Next.js guide에 따라 Gantt는 browser API를 사용하는 Client Component에서 mount 이후 렌더링하고, `@svar-ui/react-gantt/all.css`, `Willow`, 명시적인 높이·너비를 사용한다. `readonly=true`는 widget data 변경을 막지만 서버 authorization을 대체하지 않는다. [Next.js 통합](https://docs.svar.dev/react/gantt/integration-guides/nextjs/setup/), [readonly](https://docs.svar.dev/react/gantt/api/properties/readonly/)

Core task는 `end` 또는 `duration` 중 하나를 사용하며 link type의 FS 표기는 `e2s`다. 공식 문서는 end 날짜의 inclusive/exclusive 의미를 명시적으로 정의하지 않는다. 공식 REST 예제가 1일 task를 다음 날 00:00 end로 나타내는 것은 exclusive end를 시사하지만 **추론**으로만 기록한다. W03 Adapter는 본 프로젝트의 inclusive date-only end와 widget의 exclusive local `Date` 경계를 명시하고 round-trip fixture로 검증한다. 실제 drag/resize/server 저장 의미는 W07에서 다시 확인한다. [tasks](https://docs.svar.dev/react/gantt/api/properties/tasks/), [links](https://docs.svar.dev/react/gantt/api/properties/links/), [공식 backend guide](https://docs.svar.dev/react/gantt/integration-guides/nextjs/backend/)

W03은 Core-only 시각화 POC다. `api.setNext`/RestDataProvider를 서버에 연결하거나 PRO 자동 scheduling을 사용하지 않는다. 향후 command adapter는 같은 사용자 동작을 한 번만 Service API에 전달하고 서버 snapshot을 최종 상태로 반영해야 한다. [공식 save guide](https://docs.svar.dev/react/gantt/guides/load-and-save/save-to-backend/), [action interception](https://docs.svar.dev/react/gantt/guides/configuration/prevent_actions/)

Bootstrap 시점에는 공식 Repository manifest의 2.7.2를 확인했으나, W03 설치 시 npm latest와 설치 artifact가 2.7.3으로 갱신된 것을 재확인했다. 앞으로도 Repository HEAD와 npm 배포 tag가 같다고 가정하지 않고 lockfile 변경 때 registry와 changelog를 다시 대조한다. [공식 manifest](https://github.com/svar-widgets/react-gantt/blob/main/package.json)

Core는 task/milestone/summary, hierarchy, grid/timeline, edit/drag/resize, link 표현과 readonly를 제공한다. Auto scheduling, working calendar 자동화, CPM/slack, baseline, WBS 등은 PRO 범주이므로 이 프로젝트의 계산 엔진과 분리한다. 이는 공개 기능 비교이며 상용 구현을 읽거나 복제한 조사가 아니다. [공식 Overview](https://docs.svar.dev/react/gantt/overview/), [공개 Repository](https://github.com/svar-widgets/react-gantt)

필요한 integration surface는 `tasks`, `links`, `readonly`, `init`, 공식 `api.intercept`/event pipeline이다. Task/link add/update/delete와 move/copy가 서버 저장을 중복 유발하지 않게 실제 version POC를 수행한다. Core에서 link type을 표시할 수 있는 범위와 우리 API의 FS-only 허용 범위는 다르다. [공식 저장 guide](https://docs.svar.dev/react/gantt/guides/load-and-save/save-to-backend/), [readonly API](https://docs.svar.dev/react/gantt/api/properties/readonly/)

SVAR 공식 Next.js guide는 browser API를 사용하는 client component와 `Willow`, CSS, 충분한 container height, `init` callback을 제시한다. Mount 후 렌더링 방안도 설명한다. 초기 통합에서 이를 적용하고 SSR/hydration 및 date endpoint 왕복을 시험한다. [공식 Next.js guide](https://docs.svar.dev/react/gantt/integration-guides/nextjs/setup/)

## Next.js / Node / SQLite

Next.js는 server/client module boundary를 제공한다. SQLite와 password/session 코드는 server 쪽에만 두고 client는 직렬화 가능한 DTO를 받는다. [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

현재 Next.js 문서는 `better-sqlite3`를 자동 server external package 목록에 포함한다. 이를 근거로 Native driver를 client bundling하거나 Edge에서 실행할 수 있다고 해석하지 않는다. [serverExternalPackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages)

Researcher는 `better-sqlite3` npm 표시 version **13.0.3**과 MIT를 확인했다. Repository는 synchronous prepared query와 transaction API를 제공하며, small single-instance workload의 후보에 부합한다. 실제 lockfile에 설치할 버전의 Node engine·license·SQLite bundled version은 Foundation에서 재검증한다. [Package metadata](https://www.npmjs.com/package/better-sqlite3), [공식 Repository](https://github.com/WiseLibs/better-sqlite3)

SQLite는 connection별 foreign key 활성화가 필요하고 WAL은 운영 저장소의 locking 조건과 함께 검증해야 한다. 단일 instance라 하더라도 잘못된 project 참조를 막는 FK, transaction, revision 비교가 필요하다는 것이 Manager 설계 판단이다. [Foreign keys](https://www.sqlite.org/foreignkeys.html), [WAL](https://www.sqlite.org/wal.html)

Node LTS와 Next.js 최소 runtime 요구를 함께 확인하여 후보를 정한다. Node 24 LTS를 우선 검증하고 Node 22는 호환성 대안으로 검토하되 실제 배포 시점의 지원 상태를 다시 확인한다. 설치 전 Next/React의 호환 pair와 patch release를 정하고 lockfile로 고정한다. [Node release schedule](https://nodejs.org/en/about/previous-releases), [Next installation requirements](https://nextjs.org/docs/app/getting-started/installation)

## Native module / Docker

`better-sqlite3`는 Native addon이며 source build 설정에 C++ 코드와 node-gyp 경로가 있다. Build/runtime의 Node ABI, libc, CPU architecture를 같게 두고 host `node_modules`를 복사하지 않는다는 방침은 해당 build 구조에 대한 Infra 설계 판단이다. 실제 platform에서 `require`, query, migration, restart를 시험하기 전 호환 PASS를 내리지 않는다. [공식 binding.gyp](https://github.com/WiseLibs/better-sqlite3/blob/master/binding.gyp)

Persistent volume은 container 교체와 데이터 수명을 분리한다. Host 장애에 대한 backup을 대신하지 않으므로 WAL-aware backup/restore rehearsal을 별도 Gate로 둔다. [Docker volumes](https://docs.docker.com/engine/storage/volumes/), [SQLite backup API](https://www.sqlite.org/backup.html)

## ExcelJS / Excel·VBA

Researcher 확인 시 `exceljs` 안정 package는 **4.4.0**, MIT다. Sheet, style, date, hyperlink, XLSX writer를 제공하므로 서버 표 export와 날짜 cell Gantt의 후보로 채택한다. Release 간격과 transitive dependency 상태는 설치 직전 확인할 유지보수 위험이다. [Package metadata](https://www.npmjs.com/package/exceljs), [ExcelJS 공식 Repository](https://github.com/exceljs/exceljs)

Microsoft는 인터넷 출처 Office 문서의 macro blocking과 관리 정책을 설명한다. 이 자료만으로 대상 조직의 DRM Workbook에서 VBA나 파일 저장이 허용된다고 결론 내릴 수 없다. 해당 POC 결과는 현재 UNKNOWN이다. [Microsoft macro policy](https://learn.microsoft.com/en-us/microsoft-365-apps/security/internet-macros-blocked)

Workbook의 1900/1904 date system을 확인해야 한다. Locale display text만으로 날짜를 판단하지 않고 유효 calendar date로 변환하여 두 체계의 fixture를 비교한다. CSV SaveAs의 locale/code-page 영향 때문에 한글이 UTF-8로 보존된다는 가정을 두지 않는다. [Workbook.Date1904](https://learn.microsoft.com/en-us/office/vba/api/excel.workbook.date1904), [Workbook.SaveAs](https://learn.microsoft.com/en-us/office/vba/api/excel.workbook.saveas)

Backend/Excel 공동 검토로 CSV는 one task per record, predecessors JSON cell, RFC 4180 quoting, UTF-8로 정했다. 이는 외부 제품의 보장 사항이 아닌 자체 교환 계약이며 [IMPORT_SCHEMA.md](IMPORT_SCHEMA.md)에 정의한다.

## Scheduling 원리

공개 project scheduling 자료는 FS와 다른 relationship, lead/lag, CPM forward/backward 계산을 설명한다. 우리 초기 엔진은 separate parent tree와 dependency DAG, calendar-aware forward pass, summary 후위 집계, WBS 전위 순회를 사용하는 독립 설계다. End 포함·milestone next-working-day·Manual conflict 정책은 자체 날짜 모델의 결정이며 SVAR PRO 동작을 재현한다고 주장하지 않는다. [Microsoft project dependencies](https://learn.microsoft.com/en-us/dynamics365/project-operations/project-management/create-wbs), [Oracle scheduling guide](https://docs.oracle.com/cd/E80480_01/English/user_guides/schedule_management_user_guide/88251.htm)

Calendar 탐색과 WBS 결과 길이를 포함해야 실제 복잡도를 설명할 수 있다. DAG 부분의 O(N+E)만을 전체 알고리즘 성능으로 제시하지 않는다. 상세 모델·예시는 [SCHEDULING_ENGINE.md](SCHEDULING_ENGINE.md) 참조.

## 미검증·후속 조사

- SVAR의 실제 pointer drag/resize에서 end/date/duration이 왕복되는 의미와 Core 보조 계산을 서버 canonical snapshot이 덮어쓰는 방식. W03의 exclusive end는 공식 예제 기반 추론으로 격리했다.
- Next/React/SVAR/better-sqlite3/ExcelJS 및 UI/test 도구의 최종 version·license·transitive dependency 조합. 전부 검증했다고 표시하지 않으며 최초 설치 issue의 acceptance다.
- 실제 Workbook, DRM/macro 권한, 승인된 파일 저장 경로, 안정 ID 보존 수단, source calendar/progress 해석.
- 실제 배포 architecture/volume permission, production scrypt memory·latency, 입력 크기/렌더 성능.
- Framework/API의 향후 변경은 이 문서의 확인일 이후 재검증한다.
