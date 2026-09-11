# masterGantt

소규모 프로젝트의 일정과 진행 상황을 관리하는 웹 애플리케이션이다. SVAR React Gantt Core로 일정을 표시·편집하고, 일정 계산은 독립적인 Scheduling Engine에서 수행하는 구조를 목표로 한다.

프로젝트별 직접 링크, SQLite 저장, 편집 비밀번호 인증과 root Task/Milestone Gantt 저장, 좌측 계층 Grid와 우측 동기 Chart 중심의 넓은 Project 작업공간을 구현했다. GitHub Actions 검증, `main` commit별 immutable GHCR 테스트 image와 Semantic Version release image 기반도 추가하며, Summary/WBS·FS 일정, 승인된 Excel/VBA → JSON·CSV Import, Excel Export와 production 배포 검증을 단계적으로 진행한다. DRM 해제·우회 기능은 개발하지 않는다.

이 README는 프로젝트 이해·설치·재설치·실행·진행 상황 확인을 위한 진입 문서다. 상세 요구사항은 [REQUIREMENTS](docs/REQUIREMENTS.md), 최신 작업 상태는 [실행 계획](docs/exec-plans/active/PLAN.md)을 따른다.

## 1. 현재 구현 상태

기준: **2026-09-12 / 0.4.0 W22 Commit GHCR Automation 진행 중**. W01–W07, W20, W21은 독립 QA PASS / Manager ACCEPT이다. Repository admin 인증과 private visibility를 확인했고 최초 push를 막았던 PAT `workflow` scope도 추가 확인했다. 원격 Actions/GHCR 검증을 진행한다. 사용자는 현재 private 요금제의 branch/tag ruleset 미강제 위험을 수용했고 GitHub Artifact Attestation은 비활성으로 두며 BuildKit SBOM/provenance를 유지한다.

| 단계 | 상태 | 현재 확인 가능한 내용 |
| --- | --- | --- |
| Bootstrap | 완료 | 요구사항·아키텍처·보안·Import 계약과 작업 계획 |
| W01 Foundation | 완료 | Next.js 기본 화면, 빈 프로젝트 안내, liveness API, 빌드·테스트 설정 |
| W02 SQLite | 완료 / 독립 QA PASS | 테이블 5개, 마이그레이션·checksum·rollback, 프로젝트 격리, Repository, DB 초기화 CLI |
| W03 SVAR 통합 | 완료 / 독립 QA PASS | Core 2.7.3, browser-only Gantt fixture, 기본 readonly, 날짜 adapter와 로컬 명령 경계 |
| W04 Project 생성·직접 조회 | 완료 / 독립 QA PASS | strict 입력, UUID URL, scrypt 저장, 최초 session 원자 발급, 직접 Readonly snapshot, 컬렉션 비공개 |
| W05 편집 인증 | 완료 / 독립 QA PASS | password unlock, session current/logout, metadata 보호 저장, revision, password rotation, route security inventory |
| W06 일정 계산 기반 | 완료 / 독립 QA PASS | pure Gregorian date-only, weekend/holiday, inclusive duration, Auto/Manual leaf, milestone, server/browser 동일 fixture |
| W07 Task·Link 저장 기반 | 완료 / 독립 QA PASS | root Task/Milestone CRUD, Project-scoped Link Repository, 실제 Gantt 이동·양방향 resize·삭제·reload, 거부 복원, revision 경쟁 |
| W20 CI/CD·Semantic image | 로컬 완료 / D04 결정 / 독립 QA PASS | strict SemVer release와 digest smoke 기반; 원격 release 실행 증거는 아직 NOT TESTED |
| W21 동기 Gantt 작업공간 | 완료 / 독립 QA PASS | 빈 일정부터 좌측 계층 Grid+우측 Chart, 생성 직후 양쪽 반영, full-width·viewport height, narrow 내부 scroll |
| W22 Commit GHCR 자동화 | 구현·원격 검증 진행 중 | 성공한 main만 immutable `ci-<SHA>` 게시, digest HTTP Project/Task persistence smoke; PR/manual write 없음 |
| W08 이후 | 예정 | Summary/WBS, FS 재계산, Import/Export |
| W16 배포 | 일부 기반 선행 / 운영 검증 예정 | Docker/startup/readiness/named volume 기반; 실제 host·proxy·backup/restore 승인 후속 |

홈 화면은 DB에 Project가 없다고 단정하지 않고 목록 discovery가 아직 비활성임을 안내하며 생성 링크를 제공한다. `/projects/new`에서 Project를 만들면 `/projects/{publicId}`로 이동한다. Direct snapshot API는 Cookie와 관계없이 Readonly이며, 화면은 별도 current-session 확인 뒤에만 metadata/password/logout과 root Task/Milestone 편집 control을 표시한다. D02 결정 전 `GET /api/projects`는 `405`로 닫혀 있다. Project 화면은 빈 일정부터 동일 SVAR 인스턴스의 좌측 계층 Grid와 우측 Chart를 표시한다. `작업 추가 또는 삭제`를 펼쳐 저장하면 새 row와 bar/milestone이 reload 없이 함께 나타나며, Grid/Chart 경계는 내장 Resizer로 조절한다. 좁은 화면에서는 Project Gantt 영역 안을 가로로 스크롤한다. Gantt drag/resize 결과는 보호 Task API와 W06 Scheduling Engine을 거쳐 SQLite에 저장되고, 성공·실패 모두 server canonical snapshot으로 복원된다. Summary 생성/reparent와 Link가 있는 일정의 변경은 W08/W09 전까지 fail-closed다. `/gantt-demo`는 별도의 로컬 fixture다.

최근 확정된 application 회귀 기준은 build/typecheck/lint, **24개 파일 310개 Vitest**, clean isolated Turbopack Chromium E2E **8개 PASS**다. W22는 `0.4.0` version과 commit/release workflow를 검증 중이며 실제 Actions URL·GHCR digest·HTTP persistence 결과 전에는 원격 PASS로 표시하지 않는다. W22 상태는 [W22 검토 기록](docs/W22_REVIEW.md), 이전 범위는 [W21 검토 기록](docs/W21_REVIEW.md)과 [W20 검토 기록](docs/W20_REVIEW.md)을 참고한다.

## 2. 기술 스택과 역할

설치 버전은 현재 `package-lock.json` 기준이며, 변경할 때는 호환성을 확인하고 lockfile과 이 표를 함께 갱신한다.

| 기술 | 현재 버전 / 상태 | 역할 |
| --- | --- | --- |
| masterGantt | 0.4.0 | `package.json` Semantic Version과 GHCR release 기준 |
| Node.js | 최소 22, 검증 22.14.0 | 서버와 CLI 실행 |
| Next.js | 16.3.4 | App Router, 서버 Route Handler, 빌드 |
| React / React DOM | 19.3.0 | 화면 컴포넌트 |
| TypeScript | 5.8.3 | 타입 검사 |
| Tailwind CSS | 4.3.3 | UI 스타일 도구; 현재 기본 화면은 CSS도 사용 |
| SQLite / better-sqlite3 | SQLite 3.53.4 / driver 13.0.3 | 파일 DB, prepared SQL, transaction; Prisma 미사용 |
| tsx | 4.23.13 | TypeScript 마이그레이션 CLI 실행 |
| Vitest | 5.0.0 | DB·CLI·liveness·Project API/보안 경계 자동화 검증 |
| Playwright | 1.63.0 | Gantt와 Project 생성·직접 조회 Chromium E2E; 기본 격리 포트 3100 |
| SVAR React Gantt Core | 2.7.3, MIT | Gantt 표시와 Core 이벤트; exact direct dependency |
| SVAR data provider | Core의 transitive 2.7.2, 직접 사용 안 함 | cookie/If-Match/canonical snapshot 계약이 달라 W07 직접 명령 Adapter 유지 |
| Zod | 4.6.2 | Project·Task request의 strict server schema 검증 |
| Scheduling Engine | 자체 pure TypeScript | Gregorian ordinal, Project Calendar, 근무일·Leaf Duration; SVAR/DB/시간대 API 비의존 |
| shadcn/ui / ExcelJS | 도입 예정, 미설치 | 일반 UI / 서버 Excel 생성 |
| Docker / Docker Compose | W20 기반 구현 | non-root 단일 애플리케이션, startup migration/readiness와 영속 SQLite volume |
| GitHub Actions / GHCR | W20/W22 기반 구현 | application·browser·container CI, main commit test image와 Semantic Version release |

서버의 접근 경계는 `Route Handler → Service → Repository → SQLite`다. W07 Task mutation도 이 경계를 따르며 transaction 안에서 session과 revision을 다시 확인한 뒤 W06 `scheduleLeaf` 결과를 저장한다. DB 진입점은 `server-only`이며 import나 Next.js build만으로 DB를 열지 않는다. 기술 선정 근거는 [RESEARCH](docs/RESEARCH.md), 설계는 [ARCHITECTURE](docs/ARCHITECTURE.md)를 참고한다.

## 3. 설치 및 재설치

아래 명령은 Linux/macOS/WSL의 Bash 계열 shell 기준이다. 검증 환경은 **Node 22.14.0 / npm 11.10.0 / Linux x64**이며, 다른 OS·CPU의 native driver 실행은 별도 확인이 필요하다.

새 환경에서는 저장소 접근 권한이 있는 계정으로 clone한다. 이미 clone했다면 해당 디렉터리에서 `npm ci`부터 실행한다.

```sh
git clone https://github.com/planner77/masterGantt.git
cd masterGantt
node --version
npm --version
npm ci
```

`npm ci`는 lockfile에 맞춰 의존성을 재설치한다. Node 버전이나 OS·CPU를 바꾼 경우에도 대상 환경에서 다시 실행하고, 다른 장비의 `node_modules`를 복사하지 않는다. 의존성 재설치는 `.data`의 DB 초기화 작업이 아니다.

Chromium E2E까지 실행할 새 환경에서는 Playwright가 기대하는 browser를 추가로 설치한다. 조직이 관리하는 Chromium을 사용할 때는 이 명령 대신 아래 검증 절의 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`을 지정할 수 있다.

```sh
npx playwright install chromium
```

새 clone에는 DB와 실제 환경 설정이 포함되지 않는다. 새 테스트 환경은 아래 마이그레이션으로 빈 DB를 생성하고, 기존 데이터를 이전할 때는 별도로 보관한 설정과 일관된 DB 백업이 필요하다. 운영 백업·복원 절차의 구현/검증 상태는 [DEPLOYMENT](docs/DEPLOYMENT.md)를 따른다. 기존 `.env`·`.env.local`·DB 파일을 재설치 과정에서 덮어쓰거나 삭제하지 않는다.

## 4. 환경 설정과 DB 초기화

홈 화면·liveness 확인에는 DB가 필요하지 않다. Project 생성에는 `DATABASE_PATH`와 `APP_BASE_URL`이, direct read에는 `DATABASE_PATH`가 필요하다. 환경 변수 항목은 [.env.example](.env.example)에 정리되어 있다. 실제 값은 Git에 올리지 않는다.

| 항목 | 현재 사용 방식 / 설정 시 주의 |
| --- | --- |
| `DATABASE_PATH` | DB CLI와 서버 DB 진입점에서 사용. 개발은 쓰기 가능한 경로, production은 `/data/` 아래의 정규화된 절대 경로 |
| `NODE_ENV` | 개발 서버는 development, production 서버는 production. DB CLI에도 production 정책을 적용하려면 명시적으로 전달 |
| `PORT` | 실행 포트. 예제에서는 `.env` 값에 의존하지 않고 `--port`로 지정 |
| `APP_BASE_URL` | Project 생성의 `Origin`과 정확히 비교하는 canonical origin. scheme/host/port가 browser 주소와 같아야 하며 production은 HTTPS 필수 |
| `TRUST_PROXY`, `SESSION_COOKIE_SECURE`, `LOG_LEVEL` | 후속 배포용 예약 설정이며 현재 코드가 소비하지 않음. Cookie `Secure`와 `__Host-` 이름은 `NODE_ENV`와 `APP_BASE_URL`에서 강제 |

Next.js 앱은 `.env.local` 등의 설정을 읽을 수 있지만 **DB CLI는 `.env`·`.env.local`을 자동 로딩하지 않는다.** CLI에는 아래처럼 명시적으로 전달한다. Production의 `/data` 경로는 로컬 계정에 쓰기 권한이 없을 수 있으므로 개발 예제는 repository 안의 `.data`를 사용한다.

```sh
NODE_ENV=development DATABASE_PATH="$PWD/.data/mastergantt.sqlite3" npm run db:migrate
```

최초 성공 시 npm 출력 뒤에 다음 결과가 나온다.

```json
{"status":"ok","applied":["0001_initial_schema.sql"]}
```

동일 명령을 다시 실행하면 `applied`가 빈 배열이 된다. 테이블은 `projects`, `tasks`, `links`, `project_holidays`, `edit_sessions`와 이력용 `schema_migrations`다. 프로젝트나 작업의 예제 row를 자동 생성하지 않는다.

적용 이력·checksum을 검증하고 미적용 SQL과 ledger 기록을 하나의 transaction으로 적용한다. 오류 시 실패하며, 적용한 SQL을 수정하거나 ledger를 지워 재시도하지 않는다. 변경에는 새 migration을 추가한다. 상세 계약은 [DB_SCHEMA](docs/DB_SCHEMA.md)를 참고한다.

운영 환경에서 `/data` 저장소와 실행 계정의 쓰기 권한을 준비한 뒤에는 다음과 같이 production 경로 정책을 적용한다. 현재 로컬 개발에 필요한 명령은 아니다.

```sh
NODE_ENV=production DATABASE_PATH=/data/mastergantt.sqlite3 npm run db:migrate
```

## 5. 실행 및 현재 진행 내용 확인

### 개발 화면 확인

Repository root에서 `.env.local`에 최소 다음 값을 설정하고 실행한다. 다른 port/host를 쓰면 `APP_BASE_URL`도 browser origin과 정확히 맞춘다.

```dotenv
DATABASE_PATH=.data/mastergantt.sqlite3
APP_BASE_URL=http://127.0.0.1:3000
```

```sh
npm run dev -- --hostname 127.0.0.1 --port 3000
```

서버를 실행한 장비의 브라우저에서 [http://127.0.0.1:3000](http://127.0.0.1:3000)을 연다. `/projects/new`에서 Project를 생성하면 최초 요청 시 migration을 확인·적용하고 UUID 직접 URL로 이동한다. 종료는 터미널에서 `Ctrl+C`를 누른다.

실제 Project 화면은 처음에는 readonly다. 비밀번호로 잠금을 해제하면 root Task/Milestone을 추가·삭제하고 SVAR bar를 이동하거나 양 끝을 resize할 수 있다. 이 변경은 revision을 사용해 SQLite에 저장되며 새로고침 후 유지된다. `/gantt-demo`의 `로컬 편집 미리보기`는 별도 fixture라 저장되지 않는다.

포트가 이미 사용 중이면 `APP_BASE_URL=http://127.0.0.1:3001`과 `--port 3001`을 함께 적용한다. Turbopack이 실행 환경의 제약으로 실패하면 `npm run dev -- --webpack --hostname 127.0.0.1 --port 3000`으로 실행할 수 있다. 서버 listen 자체가 권한 오류로 차단된 경우에는 실행 환경의 포트 권한도 필요하다.

원격 Linux 서버에서 실행했다면 브라우저 PC에서 SSH 포워딩을 사용할 수 있다. 아래 `사용자@서버주소`를 실제 SSH 접속 대상으로 바꾸고, 브라우저 PC의 3000 포트가 비어 있어야 한다.

```sh
ssh -L 3000:127.0.0.1:3000 사용자@서버주소
```

### HTTP 응답 확인

서버가 실행 중일 때 별도 터미널에서 확인한다.

```sh
curl -fsS http://127.0.0.1:3000/api/health/live
```

기대 응답은 `{"status":"ok"}`다. 이 endpoint는 DB를 열지 않으며 migration 완료·DB 연결·readiness를 보장하지 않는다. DB와 migration 상태까지 확인하려면 다음 endpoint를 사용한다.

```sh
curl -fsS http://127.0.0.1:3000/api/health/ready
```

Readiness는 SQLite `SELECT 1`, foreign key enforcement와 최신 migration ledger 일치를 확인하며 실패 시 내부 정보를 숨긴 `503 {"status":"unavailable"}`를 반환한다.

### Production 빌드 확인

개발 서버를 종료한 뒤 같은 디렉터리에서 실행한다.

```sh
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

현재 build script는 Webpack을 사용한다. 직접 실행하는 `npm start`는 DB migration CLI를 자동 실행하지 않지만 Docker entrypoint는 migration 성공 후에만 server를 시작한다. 실제 운영 배포에는 production DB 경로·권한, HTTPS, proxy와 backup/restore 검증이 추가로 필요하다.

## 6. 검증 명령

```sh
npm run build
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run version:check
```

Build와 typecheck는 `.next` 생성 파일을 공유하므로 순서대로 실행한다. `npm test`의 DB 테스트는 임시 디렉터리를 사용하며 운영 DB를 대상으로 하지 않는다. `npm run test:e2e`는 기본적으로 Turbopack 개발 서버를 격리 포트 3100에서 시작하며 Playwright Chromium이 설치되어 있어야 한다. DB·CLI만 확인하려면 다음을 실행한다.

```sh
npm test -- tests/server/db/database.test.ts tests/server/migration-cli.test.ts
```

W21 Manager 검증 기준 전체 310개 Vitest와 Chromium E2E 8개가 통과했다. 기본 E2E는 Turbopack과 `.next-e2e`, `.data/playwright.sqlite3`를 사용해 일반 개발 서버와 격리한다. Process-global 생성 limiter를 실제 설정 그대로 사용하는 browser suite는 worker 1개로 직렬 실행한다. 동일 revision 동시 write는 W05 metadata와 W07 Task spec 내부의 병렬 HTTP 요청으로 검증한다. W21 E2E는 빈 Project의 Grid+Chart, 첫 작업 생성 직후 양쪽 표시, Desktop geometry와 narrow 내부 scroll을 추가하고 기존 실제 SVAR 이동·좌우 resize·삭제·reload, 401/412/422/500과 canonical read 실패 복원을 유지한다. 동일 dist directory를 사용하는 Playwright server는 겹쳐 실행하지 않는다. 이미 실행 중인 앱과 별도 Chromium executable을 사용하려면 다음 환경 변수를 선택적으로 지정할 수 있다.

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium \
npm run test:e2e
```

Task 저장 근거는 [W07_REVIEW](docs/W07_REVIEW.md), 일정 계산 기반은 [W06_REVIEW](docs/W06_REVIEW.md), 편집 인증은 [W05_REVIEW](docs/W05_REVIEW.md), 생성·직접 조회는 [W04_REVIEW](docs/W04_REVIEW.md), Gantt 기반은 [W03_REVIEW](docs/W03_REVIEW.md), DB 기반은 [W02_REVIEW](docs/W02_REVIEW.md), 전체 계획은 [TEST_PLAN](docs/TEST_PLAN.md)을 참고한다.

### CI, version과 테스트 image

Pull Request와 `main` push에서는 GitHub Actions가 application, Chromium과 Docker smoke를 자동 실행한다. Application version은 `package.json`과 lockfile에서 일치해야 하며, release는 같은 commit의 annotated `v<version>` tag로만 시작한다.

```sh
npm run version:check
node scripts/verify-release-version.mjs v0.4.0
```

성공한 `main` push는 모든 gate 뒤 `ci-<full SHA>` image를 게시하고 workflow가 출력한 digest를 새로 pull해 Project/Task API authorization과 restart persistence까지 검사한다. PR과 수동 CI는 registry에 쓰지 않는다. 이 commit image는 SemVer release가 아니며 stable alias를 만들지 않는다.

Release workflow는 별도로 저장소 단위 직렬 실행한다. 이전 release보다 큰 version인지 확인하고 `sha-<full SHA>` candidate digest smoke를 통과한 경우에만 stable alias와 exact version을 승격한다. 테스트에서는 `latest` 대신 commit/release workflow가 출력한 exact digest를 사용한다. Private GHCR consumer는 최소 `packages: read`만 사용한다. 실제 tag 생성, plan별 ruleset·attestation 제약과 image login 절차는 [CI/CD 문서](docs/CI_CD.md), container 실행은 [Deployment](docs/DEPLOYMENT.md)를 따른다.

## 7. 코드와 실행 산출물

| 위치 | 내용 |
| --- | --- |
| [src/app](src/app), [src/components](src/components) | 화면, 레이아웃, loading/error, liveness/readiness Route |
| [src/app/projects](src/app/projects), [src/features/projects](src/features/projects) | Project 생성, Direct Readonly, unlock/metadata/password/logout, Task CRUD UI |
| [src/app/api/projects](src/app/api/projects), [src/server/projects](src/server/projects), [src/server/security](src/server/security) | Project·edit session·Task API, Service, strict 계약, protected authorization와 route inventory |
| [src/contracts](src/contracts) | Client/server가 공유하는 public Project DTO |
| [src/domain/scheduling](src/domain/scheduling) | Pure Gregorian date-only, Project Calendar, 근무일·Leaf Duration과 안정 오류 |
| [src/app/gantt-demo](src/app/gantt-demo), [src/features/gantt](src/features/gantt) | SVAR demo와 Project Gantt, inclusive/exclusive 날짜·Task 명령 adapter |
| [src/server/db](src/server/db) | DB 경로 정책, 연결, migration runner, lazy server-only 진입점 |
| [src/server/repositories](src/server/repositories) | Project/Schedule prepared query와 서버용 반환 자료 |
| [db/migrations](db/migrations) | 버전 관리하는 SQL schema 변경 |
| [scripts](scripts) | DB migration, release version 검증과 container startup |
| [tests/server](tests/server), [tests/scripts](tests/scripts) | DB·CLI·health·version·Project Service/HTTP/보안 경계 검증 |
| [tests/domain/scheduling](tests/domain/scheduling), [tests/features/gantt](tests/features/gantt), [tests/e2e](tests/e2e) | Scheduling unit/purity, Gantt adapter와 Chromium runtime·Project workflow 검증 |
| [package.json](package.json), [package-lock.json](package-lock.json) | 실행 명령, 의존성·재설치 기준 |
| [.github/workflows](.github/workflows), [.github/dependabot.yml](.github/dependabot.yml) | PR/main CI, main commit image, GHCR release와 pinned dependency update |
| [Dockerfile](Dockerfile), [docker-compose.yml](docker-compose.yml), [.dockerignore](.dockerignore) | non-root image, single-instance SQLite volume와 build context 보호 |
| [AGENTS.md](AGENTS.md), [.codex](.codex) | 개발·협업 원칙과 전문 Agent 설정 |
| `.next/`, `node_modules/` | 로컬 생성 빌드·의존성, Git 제외 |
| `.data/mastergantt.sqlite3` 및 WAL/SHM | 위 개발 예제로 생성하는 실제 DB, Git 제외 |
| `.env`, `.env.local` | 장비별 실제 설정, Git 제외 |

## 8. 관련 문서와 산출물 목록

| 목적 | 문서 |
| --- | --- |
| 현재 진행과 다음 작업 | [실행 계획](docs/exec-plans/active/PLAN.md), [W01–W22 작업 목록](docs/ISSUE_BREAKDOWN.md) |
| 요구사항과 구조 | [REQUIREMENTS](docs/REQUIREMENTS.md), [ARCHITECTURE](docs/ARCHITECTURE.md) |
| DB·API·보안 계약 | [DB_SCHEMA](docs/DB_SCHEMA.md), [API](docs/API.md), [SECURITY](docs/SECURITY.md) |
| 일정 계산과 Core/PRO 경계 | [SCHEDULING_ENGINE](docs/SCHEDULING_ENGINE.md), [PRO_FEATURE_MATRIX](docs/PRO_FEATURE_MATRIX.md) |
| Excel Import/Export | [IMPORT_EXPORT](docs/IMPORT_EXPORT.md), [IMPORT_SCHEMA](docs/IMPORT_SCHEMA.md), [VBA_EXPORT](docs/VBA_EXPORT.md) |
| 셋업·운영·검증 상세 | [CI/CD](docs/CI_CD.md), [DEPLOYMENT](docs/DEPLOYMENT.md), [TEST_PLAN](docs/TEST_PLAN.md), [CHANGELOG](CHANGELOG.md) |
| 기술 조사·설계 판단 | [RESEARCH](docs/RESEARCH.md), [DECISIONS](docs/DECISIONS.md) |
| Bootstrap 결과와 검토 | [BOOTSTRAP_REPORT](docs/BOOTSTRAP_REPORT.md), [BOOTSTRAP_REVIEW](docs/BOOTSTRAP_REVIEW.md) |
| W02 구현 검증 결과 | [W02_REVIEW](docs/W02_REVIEW.md) |
| W03 SVAR 최소 통합 검증 결과 | [W03_REVIEW](docs/W03_REVIEW.md) |
| W04 Project 생성·직접 조회 검증 결과 | [W04_REVIEW](docs/W04_REVIEW.md) |
| W05 편집 인증 검증 결과 | [W05_REVIEW](docs/W05_REVIEW.md) |
| W06 일정 계산 기반 검증 결과 | [W06_REVIEW](docs/W06_REVIEW.md) |
| W07 Task·Link 저장 기반 검증 결과 | [W07_REVIEW](docs/W07_REVIEW.md) |
| W20 CI/CD·Semantic container 검증 결과 | [W20_REVIEW](docs/W20_REVIEW.md) |
| W21 동기 Gantt 작업공간 검증 결과 | [W21_REVIEW](docs/W21_REVIEW.md) |
| W22 Commit GHCR 자동화 검증 기록 | [W22_REVIEW](docs/W22_REVIEW.md) |
| Multi-Agent 설정 검증 | [AGENT_CONFIGURATION](docs/AGENT_CONFIGURATION.md) |

문서에 계약이 있다는 사실만으로 기능이 구현된 것은 아니다. 현재 구현 여부는 위 상태 표와 실행 계획, 실제 검증 기록을 함께 확인한다. 작업 목록의 W번호는 로컬 관리 식별자이며 GitHub Issue 번호가 아니다.

## 9. README 유지관리 원칙

각 작업·마일스톤 진행 시 프로젝트 개요, 실제 기술 스택, 설치·재설치·설정·실행 방법, 현재 구현 상태, 관련 산출물 링크를 함께 갱신한다. 실행 명령이나 환경 변수 사용이 바뀌면 해당 구현과 같은 변경에 README를 포함한다. 완료·계획·미검증 상태를 구분하고 상세 계약은 해당 문서를 연결하여 관리한다.
