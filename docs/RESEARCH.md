# Bootstrap research

확인일: 2026-09-11. Researcher의 공식 자료 조사와 Scheduler/Infra/Manager 검토를 통합했다. 공개 문서 확인과 실제 설치·실행 결과는 구분한다. W01 lockfile 및 실행 검증 결과를 아래에 별도로 기록한다.

## W01 설치 및 실행 검증

W01 lockfile에 Next.js 16.3.4, React 19.3.0, TypeScript 5.8.3, Vitest 5.0.0, Playwright 1.63.0이 기록되었다. `npm install` audit은 0 vulnerabilities였고 typecheck/lint/unit test와 Webpack production build가 PASS했다. 기본 Turbopack 및 sandbox 개발 서버는 process/port 권한 제한으로 검증하지 못했으며 이는 제품 결함 판정이 아니다. `GET /api/health/live`는 `{"status":"ok"}`를 반환했다.

## W02 SQLite 설치 및 실행 근거

2026-09-11 npm registry의 `better-sqlite3` 배포 manifest를 확인하여 **13.0.3**, MIT, Node `>=22`를 설치했다. 타입 정의는 `@types/better-sqlite3` **9.6.0**, MIT, TypeScript 최소 5.6이다. 현재 Node **22.14.0**, Linux x64에서 native module 로딩과 메모리 DB 쿼리를 실행했으며 bundled SQLite는 **3.53.4**였다. 이 결과는 Docker/다른 CPU의 검증을 대신하지 않는다. [공식 package metadata](https://www.npmjs.com/package/better-sqlite3), [공식 Repository](https://github.com/WiseLibs/better-sqlite3), [타입 정의](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/better-sqlite3)

이 설치 artifact는 `prebuilds/` 및 `node-addon-api`를 포함하고 `gypfile: false`이며, 예전 버전의 `prebuild-install || node-gyp rebuild` 설치 흐름을 그대로 가정할 수 없다. W16에서는 실제 설치 manifest와 target platform의 native 쿼리를 다시 확인한다. 마이그레이션 CLI는 `tsx` **4.23.13**(MIT, Node >=18)을 runtime dependency로 사용하여 Node에서 TypeScript 코어를 실행한다. [tsx 공식 Repository](https://github.com/privatenumber/tsx)

`better-sqlite3`의 transaction callback은 동기 실행이며 예외 전파 시 rollback한다. SQL 파일 로딩은 transaction 전에 끝내고 ledger 검증과 DDL 적용을 `BEGIN IMMEDIATE` 안에서 수행하도록 결정했다. [공식 transaction API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#transactionfunction---function)

## SVAR Core와 API

### W03 설치 검증 — 2026-09-11

npm registry와 설치 artifact를 다시 확인하여 `@svar-ui/react-gantt` **2.7.3**을 exact dependency로 고정했다. License는 MIT, peer dependency는 React/React DOM `>=18`이며 현재 React 19.3.0과 선언상 호환된다. 설치 뒤 production dependency audit은 vulnerability 0건이다. Package는 `@svar-ui/gantt-data-provider` 2.7.2를 transitive dependency로 포함하지만, W03은 고정 fixture만 렌더링하므로 provider를 직접 import하거나 별도 top-level dependency로 선언하지 않는다. W07에서 실제 API 저장 경계를 구현할 때 공식 provider 계약과 본 프로젝트의 인증·revision·server scheduling 응답을 다시 비교한다. [npm package](https://www.npmjs.com/package/@svar-ui/react-gantt), [공식 Repository](https://github.com/svar-widgets/react-gantt)

공식 Next.js guide에 따라 Gantt는 browser API를 사용하는 Client Component에서 mount 이후 렌더링하고, `@svar-ui/react-gantt/all.css`, `Willow`, 명시적인 높이·너비를 사용한다. `readonly=true`는 widget data 변경을 막지만 서버 authorization을 대체하지 않는다. [Next.js 통합](https://docs.svar.dev/react/gantt/integration-guides/nextjs/setup/), [readonly](https://docs.svar.dev/react/gantt/api/properties/readonly/)

Core task는 `end` 또는 `duration` 중 하나를 사용하며 link type의 FS 표기는 `e2s`다. 공식 문서는 end 날짜의 inclusive/exclusive 의미를 명시적으로 정의하지 않는다. 공식 REST 예제가 1일 task를 다음 날 00:00 end로 나타내는 것은 exclusive end를 시사하지만 **추론**으로만 기록한다. W03 Adapter는 본 프로젝트의 inclusive date-only end와 widget의 exclusive local `Date` 경계를 명시하고 round-trip fixture로 검증한다. 실제 drag/resize/server 저장 의미는 W06/W07에서 다시 확인한다. [tasks](https://docs.svar.dev/react/gantt/api/properties/tasks/), [links](https://docs.svar.dev/react/gantt/api/properties/links/), [공식 backend guide](https://docs.svar.dev/react/gantt/integration-guides/nextjs/backend/)

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
