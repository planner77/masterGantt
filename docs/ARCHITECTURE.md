# Architecture draft

상태: Manager 통합 설계. W01–W07의 Project·authorization, pure Calendar/Leaf Scheduling과 root Task/Milestone persistence, W20의 CI/CD·최소 container artifact 기반 및 W21의 동기 Grid+Chart 작업공간을 구현했다. 원격 Actions/GHCR 증거, Summary/WBS, FS 재계산, Import/Export와 production 배포 승인은 후속이다. 요구사항은 [REQUIREMENTS.md](REQUIREMENTS.md), 설계 판단은 [DECISIONS.md](DECISIONS.md)에서 관리한다.

## 경계

```mermaid
flowchart TD
  Browser[React UI / SVAR Core client] --> API[Next.js Node Route Handler]
  API --> Service[Project / Auth / Import / Export Service]
  Service --> Domain[Pure Scheduling Domain]
  Service --> Repo[Repository / SQL transaction]
  Repo --> DB[(SQLite persistent volume)]
  Git[Reviewed Git commit / SemVer tag] --> Actions[GitHub Actions]
  Actions --> GHCR[GHCR image + digest + provenance]
  GHCR --> Runtime[Single non-root container]
  Runtime --> DB
  Browser -. 동일 Domain으로 preview .-> Domain
  Excel[승인된 Excel / VBA] --> File[JSON / CSV contract]
  File --> Browser
  Repo --> Export[Backend ExcelJS workbook]
  Export --> XLSX[XLSX download / Project hyperlink]
```

위 Repository→Export 화살표는 snapshot DTO 전달이다. Export Service가 조회를 조정하며 Repository가 ExcelJS를 import하지 않는다. 모든 persistence 접근은 Service 아래 Repository를 통한다.

| 영역 | 책임 | 금지하는 결합 | 최초 담당 |
| --- | --- | --- | --- |
| Frontend | Project UI, browser-only SVAR, unlock, preview, validation·loading·error, server 결과 반영 | DB/native module/secret import, UI 상태로 권한 판정 | frontend |
| Route | HTTP parse·size/content-type 제한·응답 | SQL과 scheduling 알고리즘 | backend |
| Service | Project authorization, validation, revision, transaction 조정, Domain 호출 | SVAR store를 진실의 원천으로 사용 | backend |
| Repository | bound SQL, scope, FK·snapshot·atomic persistence | business scheduling, workbook 생성 | backend |
| Domain | date/calendar, graph, summary/WBS, deterministic calculation | React, SVAR, DB, network, 현재 시각의 암묵 의존 | scheduler |
| Excel/VBA | Header mapping, 필요한 셀 정규화, JSON/CSV·오류 보고 | DRM 우회, backend schema 단독 변경 | excel_vba |
| Export | DB snapshot→Project/Tasks/Dependencies XLSX, Phase 2 Gantt | PRO export, token hyperlink | backend |
| Deployment / CI | Node/native build, Actions, Semantic release, GHCR, volume·permission·health·backup | image 안의 DB/secret, PR write token, mutable image를 test 기준으로 사용, 다중 writer instance | infra |
| QA | 실제 계약과 결과의 독립 비교 | 구현 Agent 보고를 그대로 PASS 처리 | qa_docs |

## 제안 Directory 구조

아래는 목표 구조다. W01–W07에서 `app`, `components`, `features/gantt`, `features/projects`, `contracts`, `domain/scheduling`, `server/db`, `server/repositories`, `server/projects`, `server/security`, `db/migrations`, 관련 `tests` 경로를 만들었고 나머지는 담당 작업에서 추가한다.

```text
src/app/                         Next.js pages and HTTP routes
src/components/                  general UI
src/features/gantt/              SVAR client wrapper and adapters
src/features/import/             wizard, mapping, preview
src/server/projects/             implemented Project contract/service/HTTP orchestration
src/server/security/             credential/session/cookie/origin/rate primitives and route policy inventory
src/server/services/             future cross-feature service orchestration
src/server/repositories/         SQL access
src/server/db/                   connection and migration runner
src/domain/scheduling/           pure domain and fixtures
src/contracts/                   validated API/import DTOs, no server imports
db/migrations/                  ordered SQL, no actual database
excel/vba/                      future approved VBA POC and exporter
tests/                          integration / browser / deployment evidence
.github/workflows/              PR/main CI and SemVer-tagged GHCR release
scripts/                        migration, version validation, container smoke helpers
docs/                           sources of truth and execution plan
```

`server-only` 경계와 dependency rules로 DB·crypto/session 모듈이 client bundle에 유입되지 않게 한다. Native driver를 쓰는 route는 Node runtime이다. Edge runtime과 serverless ephemeral filesystem은 초기 배포 대상이 아니다.

## Frontend와 SVAR

SVAR 공식 Next.js guide의 client wrapper, theme/CSS, `init` API를 따랐고 W03에서 browser-only mount와 production build를 검증했다. [공식 integration guide](https://docs.svar.dev/react/gantt/integration-guides/nextjs/setup/), [W03 검증](W03_REVIEW.md)

Project Direct GET snapshot은 Cookie가 있어도 항상 Readonly다. UI는 별도 current-session GET으로 edit 표시를 동기화하고 password unlock 뒤 metadata/password/logout control을 활성화한다. 서버는 UI 상태와 무관하게 매 mutation에서 Project-bound session을 다시 확인한다.

UI는 공식 task/link/hierarchy editor를 우선 사용한다. Adapter가 external ID↔SVAR ID, date-only↔Date, end 포함↔SVAR endpoint 의미, working-day duration↔calendar span, domain link type↔SVAR link type을 변환한다. W07은 설치된 Core 2.7.3에서 실제 이동·좌우 resize를 수행해 exclusive widget end↔inclusive domain end 변환과 서버 저장 왕복을 확인했다. 최종 콜백의 전체 Task 상태는 기존 endpoint와 비교해 move/start-resize/end-resize 명령으로 구분한다.

편집 명령은 Core `onUpdateTask`의 최종 이벤트만 API로 보낸다. 요청 동안 동일 aggregate 후속 변경을 동기 mutex로 막고, 성공 시 전체 canonical snapshot으로 교체한다. 실패·412·응답 불확실성에는 서버를 재조회하며, 재조회도 실패하면 React에 남은 마지막 확정 Snapshot으로 SVAR를 강제 재마운트한다. PRO auto-scheduler를 실행하지 않는다. 공식 Data Provider는 본 프로젝트의 cookie/If-Match/canonical full snapshot 계약과 맞지 않아 W07에서 직접 채택하지 않았다.

Project route는 Demo navigation 없이 하나의 SVAR Gantt 인스턴스를 `displayMode="all"`로 실행한다. 같은 Task tree를 좌측 업무 Grid와 우측 Chart가 공유하며 Core의 세로 동기화와 Grid/Chart 경계 Resizer를 사용한다. Grid column은 작업명·외부 ID·시작·기간을 명시하고 `parent`/`open` adapter로 공급된 hierarchy를 표현한다. Core의 native Add column은 서버의 edit session·`If-Match`·Scheduling·canonical recovery 계약을 직접 만족하지 않으므로 노출하지 않고, 접이식 작업 관리 폼이 기존 보호 Task API를 호출한다. Summary 생성·reparent와 파생 WBS 계산은 이 Renderer 변경이 아니라 W08 atomic hierarchy 계약에서 구현한다.

Project 작업공간은 일반 문서형 화면의 75rem 폭과 큰 상단 여백을 벗어나 gutter를 제외한 viewport 전체 폭을 사용한다. 프로젝트 설정과 작업 관리는 접어서 Chart의 첫 화면 점유를 확보하고 Gantt 높이는 viewport 기반 clamp를 적용한다. 650px 이하에서도 Core가 Grid-only로 접혀 Chart가 사라지지 않도록 최소 45rem Gantt surface를 focus 가능한 outer scroll region 안에 두며, document 자체의 우발적 가로 overflow는 차단한다.

화면: Project List/Create, Direct Gantt, Edit Unlock, Import Wizard, Export. UI toolkit은 shadcn/ui와 Tailwind 후보이며 설치 시 license·version을 확인한다. 핵심 Gantt 기능은 Core를 사용한다. Project List의 실데이터 공개는 D02 결정 전 비활성으로 유지한다.

Project 경로는 `Route Handler → ProjectService → ProjectRepository/EditSessionRepository/ScheduleRepository → SQLite`를 따른다. Route가 canonical `APP_BASE_URL`과 unsafe method의 exact `Origin`, UTF-8 JSON content type, 32 KiB body, strict Zod input을 검사한다. Service는 비동기 scrypt를 transaction 밖에서 수행한다. Task mutation은 짧은 `BEGIN IMMEDIATE` transaction 안에서 session을 다시 검증하고 revision을 비교한 뒤 W06 `scheduleLeaf`를 호출해 저장하며 revision을 정확히 한 번 증가시킨다. Direct read와 mutation success는 Project/tasks/links/holidays의 canonical DTO를 반환한다. Collection discovery는 D02 전 405다.

## 쓰기와 동시성

1. Route가 Origin/content type/입력 크기를 검사하고 Project public ID를 해석한다.
2. Service가 해당 Project의 session 유효성을 검증한다.
3. 입력 계약과 현재 aggregate snapshot을 검증하고 scheduling candidate를 계산한다.
4. 짧은 write transaction 안에서 session/revision을 최종 확인하고 필요 시 동일 snapshot을 사용해 계산한다. 계산과 저장 사이 revision이 달라지면 재시도·덮어쓰기 대신 412를 반환한다.
5. Project/tasks/links/summary 결과를 함께 저장하고 revision을 한 번 증가시킨다.
6. canonical snapshot과 ETag를 반환한다. 실패 시 전체 상태는 이전과 같다.

Empty summary가 금지되므로 새 summary와 자식 생성·재배치 같은 hierarchy 변경은 [API](API.md)의 atomic batch 계약으로 한 번에 제출한다. 숨은 cascade 삭제를 하지 않는다. Schema는 [DB_SCHEMA.md](DB_SCHEMA.md) 참조.

## Scheduling

Input에는 사용자 요청 `requestedStart`와 duration, mode, parent/order, calendar, FS edges가 있다. Output에는 effective start/end, summary, WBS, 변경 이유·오류가 있다. W06은 자체 Gregorian ordinal 기반 date-only·Calendar·Leaf/Milestone 계산을 먼저 구현했으며 system timezone과 `Date` instant API에 의존하지 않는다. Service가 요청값과 계산값을 분리 저장하므로 dependency 제거·앞당김 시 원래 요청일로 복귀할 수 있다. Server의 계산이 권위이며 browser preview는 같은 pure code를 사용해도 저장 권한은 없다. 상세 규칙은 [SCHEDULING_ENGINE.md](SCHEDULING_ENGINE.md)만이 정의한다.

## Import / Export

Excel→VBA→JSON/CSV는 [VBA_EXPORT.md](VBA_EXPORT.md)의 승인된 환경 POC를 선행한다. [IMPORT_SCHEMA.md](IMPORT_SCHEMA.md)는 producer/consumer 공동 검토 후 Manager가 승인한다. 파일의 Project metadata가 URL의 기존 Project를 바꾸거나 session을 제공할 수 없다.

서버 preview는 정규화와 모든 graph/calendar validation을 수행한다. Commit은 원본 정규화 payload를 다시 검증하고 `If-Match`를 확인한 후 원자적으로 저장한다. 초기 create-only batch는 업데이트·삭제·replace를 수행하지 않는다. Fixture 파일을 이용한 웹 parser 개발과 실제 조직 Excel POC의 통과 상태를 구분한다.

Web export는 일정 DTO의 DB 일관된 snapshot을 얻고 transaction 밖에서 ExcelJS로 생성한다. Phase 1은 표 workbook과 canonical hyperlink, Phase 2는 기간 제한이 있는 날짜 cell Gantt다. [IMPORT_EXPORT.md](IMPORT_EXPORT.md) 참조.

## Security와 운영

W04 생성 bootstrap에 이어 W05는 recorded scrypt profile의 timing-safe password 검증, unknown/corrupt credential dummy KDF, Project-bound session의 expiry/revoke/auth-version 검증, logout, password rotation과 metadata mutation authorization을 적용한다. Cookie는 8시간 HttpOnly/SameSite=Strict이며 production에서 Secure/`__Host-`를 강제한다. Unlock은 bounded process-local global+Project limiter와 공유 KDF concurrency 2 상한을 사용한다. [SECURITY.md](SECURITY.md)가 세부 정책이다. Public URL은 편집 권한을 부여하지 않지만 읽기 기밀성을 보장하는 인증도 아니다. production 노출 범위는 사용자 결정 항목이다.

초기 운영은 한 Node application container와 local persistent SQLite volume이다. Native addon은 빌드·런타임 ABI/libc/architecture를 일치시키고 non-root permission과 restart persistence를 검사한다. PR/main은 read-only GitHub Actions로 application/browser/container 회귀를 수행한다. Release는 `package.json`과 일치하며 이전 tag보다 큰 annotated Semantic Version만 직렬 처리하고, local candidate와 GHCR digest가 통과한 뒤 exact version을 완료 표식으로 승격한다. Consumer와 post-publish smoke는 mutable alias가 아니라 exact version/digest를 사용한다. WAL-aware backup과 production host restore는 별도 경로에서 시험한다. [CI_CD.md](CI_CD.md), [DEPLOYMENT.md](DEPLOYMENT.md) 참조.

## 구현 진입 Gate

최초 vertical slice인 Project 생성→SQLite 저장→Direct Readonly→unlock→root Task 생성·SVAR 이동/resize→reload 유지→삭제를 W07에서 독립 QA PASS / Manager ACCEPT했다. 새 운영 요구인 W20 CI/CD와 Semantic Container Release 및 W21 동기 Grid+Chart 작업공간도 로컬 구현·검증 대상으로 추가했으며, 다음 Scheduling 구현은 W08 Summary/Hierarchy/WBS다. D04 정책은 결정됐으며 실제 GHCR publish에는 usable GitHub 인증과 원격 ruleset/GHCR 설정 적용이 남았다. VBA와 production 공개는 각각 D01/D02/D03 gate를 통과해야 한다. 전체 기능을 한 번에 시작하지 않는다.
