# masterGantt

소규모 프로젝트의 일정과 진행 상황을 관리하는 웹 애플리케이션이다. SVAR React Gantt Core로 일정을 표시·편집하고, 일정 계산은 독립적인 Scheduling Engine에서 수행하는 구조를 목표로 한다.

프로젝트별 직접 링크, SQLite 저장, 편집 비밀번호 인증과 root Task/Milestone Gantt 저장, 좌측 계층 Grid와 우측 동기 Chart 중심의 넓은 Project 작업공간을 구현했다. GitHub Actions 검증, `main` commit별 임시 GHCR registry 검증 image와 Semantic Version release image 기반도 추가하며, Summary/WBS·FS 일정, 승인된 Excel/VBA → JSON·CSV Import, Excel Export와 production 배포 검증을 단계적으로 진행한다. DRM 해제·우회 기능은 개발하지 않는다.

이 README는 프로젝트 이해·설치·재설치·실행·진행 상황 확인을 위한 진입 문서다. 상세 요구사항은 [REQUIREMENTS](docs/REQUIREMENTS.md), 최신 작업 상태는 [실행 계획](docs/exec-plans/active/PLAN.md)을 따른다.

Nginx를 앞단에 배치할 때는 [Nginx Reverse Proxy 운영 예제](#nginx-reverse-proxy)를 참고한다.

## 1. 현재 구현 상태

기준: **2026-09-19 / 0.17.0 Issue #68 작업 캘린더 Dependency 재계산 구현 브랜치**. 기존 작업 캘린더 기능에 FS/lag=0 Dependency forward-pass를 연결해 Calendar 변경 시 Auto 후행 일정과 Summary를 함께 재계산하고 Manual dependency 충돌은 원자적으로 거부한다. 작업 캘린더 기본 설계는 [Issue #57 작업 캘린더](docs/ISSUE_57_WORK_CALENDAR.md), 후속 통합 설계는 [Issue #68](docs/ISSUE_68_CALENDAR_DEPENDENCY_RECALC.md)을 따른다.

| 단계 | 상태 | 현재 확인 가능한 내용 |
| --- | --- | --- |
| Bootstrap | 완료 | 요구사항·아키텍처·보안·Import 계약과 작업 계획 |
| W01 Foundation | 완료 | Next.js 기본 화면, 빈 프로젝트 안내, liveness API, 빌드·테스트 설정 |
| W02 SQLite | 완료 / 독립 QA PASS | 테이블 5개, 마이그레이션·checksum·rollback, 프로젝트 격리, Repository, DB 초기화 CLI |
| W03 SVAR 통합 | 완료 / 독립 QA PASS | Core 2.7.3, browser-only Gantt fixture, 기본 readonly, 날짜 adapter와 로컬 명령 경계 |
| W04 Project 생성·직접 조회 | 완료 / 독립 QA PASS | strict 입력, UUID URL, scrypt 저장, 최초 session 원자 발급, 직접 Readonly snapshot; 목록은 W23에서 활성화 |
| W05 편집 인증 | 완료 / 독립 QA PASS | password unlock, session current/logout, metadata 보호 저장, revision, password rotation, route security inventory |
| W06 일정 계산 기반 | 완료 / 독립 QA PASS | pure Gregorian date-only, weekend/holiday, inclusive duration, Auto/Manual leaf, milestone, server/browser 동일 fixture |
| W07 Task·Link 저장 기반 | 완료 / 독립 QA PASS | root Task/Milestone CRUD, Project-scoped Link Repository, 실제 Gantt 이동·양방향 resize·삭제·reload, 거부 복원, revision 경쟁 |
| W20 CI/CD·Semantic image | 완료 / 독립 QA PASS | strict SemVer `v0.4.0`, immutable candidate, digest smoke와 exact/rolling promotion |
| W21 동기 Gantt 작업공간 | 완료 / 독립 QA PASS | 빈 일정부터 좌측 계층 Grid+우측 Chart, 생성 직후 양쪽 반영, full-width·viewport height, narrow 내부 scroll |
| W22 Commit GHCR 자동화 | 완료 / 독립 QA PASS | 임시 `ci-<SHA>`를 exact digest로 검증 후 자동 삭제하고 SemVer release만 보관; PR publish skipped |
| W23 Project 목록 | 로컬 완료 / 독립 QA PASS | D02 승인, 전체 공개 summary 목록, 생성 후 복귀·reload 조회, 편집 인증 유지 |
| W24 Grid·삭제·계층 UI | 완료 / 원격 CI PASS | 목록 표/권한 삭제, native Header·row 추가, Summary 집계, locale·주말·고정 헤더 |
| Issue #19 글로벌 리소스·그룹 | 완료 / PR CI PASS | 독립 Resource/Group 카탈로그, 관리자 세션, 그룹 멤버, Task/Summary/Milestone 직접 할당, canonical assignment 보존 |
| Issue #57 작업 캘린더 | 완료 / PR CI PASS | KR/CN/VN/PH/TH/MX/US 2026 국가 규칙, 기간 적용, Project/Group/개인 휴무, WORKING override, Preview/원자 저장, #56 Effective Calendar 연계 |
| Issue #68 Calendar+FS 재계산 | 구현 완료 / CI 검증 전 | 후보 Calendar → Leaf → FS/lag=0 → Summary 순서, Preview 원인 표시, Manual dependency conflict 원자 거부 |
| W08 이후 | 일부 W24 선행 / 예정 | WBS UI·reparent·유효 subtree 삭제 묶음, 일반 Task/Link mutation FS 재계산, Import/Export |
| W16 배포 | 일부 기반 선행 / 운영 검증 예정 | Docker/startup/readiness/named volume 기반; 실제 host·proxy·backup/restore 승인 후속 |

홈(`/`)은 Project를 표 형태로 표시하며 현재 편집 권한이 있는 행에 삭제 기능을 제공한다. 삭제 확인에는 최신 프로젝트명과 모든 일정 제거를 명시하며 서버가 session/Origin/revision을 다시 검증한다. Direct snapshot은 Readonly이며 편집하려면 기존 비밀번호 잠금을 해제한다. Grid Header `+`는 최상위, 행 `+`는 하위 작업을 추가한다. 이름·날짜·기간 입력 없이 `새 작업`·브라우저 오늘·1일을 적용하며 Auto 근무일 보정은 유지한다. 첫 하위 추가 시 일반 작업을 Summary로 전환한다는 명시 동의만 필요하다. 이후 Summary 날짜와 진척은 자식에서 계산된다. Milestone에는 자식을 추가하지 않으며 빈 Summary 방지를 위해 마지막 자식 단독 삭제는 거부한다. 외부 ID는 표시를 선택할 수 있고 토·일은 Chart 음영으로 구분한다. 날짜는 사용자 locale로 표시하고 설정은 기본 접힌 상태다. Project/Grid/Chart header는 유지한 채 내부를 스크롤한다. Reparent/FS 및 Summary 직접 일정 편집은 후속이다. `/gantt-demo`는 저장 없는 CI/개발 검증용 fixture로 유지하지만 운영 상단 주요 메뉴에는 노출하지 않는다.

0.17.0 PR 회귀 기준은 `verify-release-version`, typecheck, lint, test discovery, 전체 Vitest, dependency audit, Markdown/shell 검사, production build, 전체 Chromium E2E, Docker image/runtime·migration·readiness·SQLite restart persistence·HTTP/HTTPS 검증과 함께 Compose 필수 관리자 비밀번호 fail-fast·컨테이너 전달·실제 인증 성공/거부·인증 시점 로그 비밀정보 비노출·강제 재생성 persistence를 포함한다.

## 2. 기술 스택과 역할

설치 버전은 현재 `package-lock.json` 기준이며, 변경할 때는 호환성을 확인하고 lockfile과 이 표를 함께 갱신한다.

| 기술 | 현재 버전 / 상태 | 역할 |
| --- | --- | --- |
| masterGantt | 0.17.0 | Issue #68 작업 캘린더 변경 시 FS/lag=0 Dependency 재계산 기능 버전 |
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
| GitHub Actions / GHCR | W20/W22 기반 구현 | application·browser·container CI, main commit 임시 registry 검증과 Semantic Version release |

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
| `APP_BASE_URL` | Project 생성의 `Origin`과 정확히 비교하는 canonical origin. scheme/host/port가 browser 주소와 같아야 하며 production은 기본 HTTPS, ALLOW_INSECURE_HTTP=true일 때 내부망 HTTP 허용 |
| `RESOURCE_CATALOG_ADMIN_PASSWORD` | 글로벌 Resource/Resource Group 관리 전용 비밀번호. Project 편집 비밀번호와 별도이며 16자 미만이면 관리자 로그인이 fail-closed. Docker Compose에서는 필수 입력이며 누락 시 `docker compose ... config` 단계에서 배포를 중단 |
| `TRUST_PROXY` | `true`일 때만 검증된 reverse proxy의 `X-Request-ID`를 상관관계 ID로 신뢰. Origin/HTTP/Cookie 정책은 변경하지 않음 |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error`. development 기본 `debug`, 그 외 기본 `info` |

Docker Compose의 `--env-file .env`는 Compose 변수 치환 입력이며 모든 값을 컨테이너에 자동 전달하지 않는다. `deploy/compose.yml`은 `RESOURCE_CATALOG_ADMIN_PASSWORD`를 app 환경에 명시적으로 전달하고, 값이 없으면 container 생성 전 config 단계에서 fail-fast 한다. 값을 변경한 뒤에는 단순 `restart`가 아니라 container를 재생성해야 한다.

Next.js 앱은 `.env.local` 등의 설정을 읽을 수 있지만 **DB CLI는 `.env`·`.env.local`을 자동 로딩하지 않는다.** CLI에는 아래처럼 명시적으로 전달한다. Production의 `/data` 경로는 로컬 계정에 쓰기 권한이 없을 수 있으므로 개발 예제는 repository 안의 `.data`를 사용한다.

```sh
NODE_ENV=development DATABASE_PATH="$PWD/.data/mastergantt.sqlite3" npm run db:migrate
```

최초 성공 시 npm 출력 뒤에 다음 결과가 나온다.

```json
{"status":"ok","applied":["0001_initial_schema.sql","0002_task_description_url.sql","0003_resource_catalog.sql","0004_project_owner.sql","0005_resource_workload.sql","0006_work_calendars.sql"]}
```

동일 명령을 다시 실행하면 `applied`가 빈 배열이 된다. 기본 Project/Task 테이블 외에 `resource_catalog_state`, `resources`, `resource_groups`, `resource_group_members`, `resource_catalog_admin_sessions`, `task_assignments`, `work_calendar_rules`, `work_calendar_dates`가 있으며 migration 이력은 `schema_migrations`가 관리한다. `project_holidays`는 0006 이후 기존 코드 호환 VIEW다. 프로젝트·작업·리소스 예제 row를 자동 생성하지 않는다.

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
RESOURCE_CATALOG_ADMIN_PASSWORD=change-me-resource-admin-password
```

```sh
npm run dev -- --hostname 127.0.0.1 --port 3000
```

서버를 실행한 장비의 브라우저에서 [http://127.0.0.1:3000](http://127.0.0.1:3000)을 연다. `/projects/new`에서 Project를 생성하면 최초 요청 시 migration을 확인·적용하고 UUID 직접 URL로 이동한다. 종료는 터미널에서 `Ctrl+C`를 누른다.

실제 Project 화면은 처음에는 readonly다. 비밀번호로 잠금을 해제하면 root Task/Milestone을 추가·삭제하고 SVAR bar를 이동하거나 양 끝을 resize할 수 있다. 상단 `리소스` 메뉴의 `/resources`에서는 별도 글로벌 관리자 비밀번호로 Resource/Group과 그룹 멤버를 관리하며, Task Editor에서 Resource 또는 Group을 직접 할당할 수 있다. Project 설정의 `작업 캘린더`에서는 국가 규칙과 Project/Group/Resource 휴무를 Preview 후 저장할 수 있다. 이 변경은 revision을 사용해 SQLite에 저장되며 새로고침 후 유지된다. `/gantt-demo`의 `로컬 편집 미리보기`는 별도 fixture라 저장되지 않는다.

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

<a id="nginx-reverse-proxy"></a>

### Nginx Reverse Proxy 운영

**내부망 HTTP:** 인증서 없이 운영할 때는 아래 HTTP 전용 절과 [상세 운영 정책](docs/HTTP_OPERATION.md)을 먼저 적용한다. 뒤의 HTTPS 예제는 선택 가능한 별도 구성이다.

#### 인증서 없는 내부망 HTTP 구성


주소 `192.168.10.20:8080`은 예시다. 현재 운영 중인 Compose 프로젝트명·named volume은 그대로 보존한다. `.env`를 통째로 덮어쓰지 않고 다음 항목을 수정한다.

```dotenv
# 브라우저가 접속하는 HTTP 주소. 내부 컨테이너 주소가 아니다.
APP_BASE_URL=http://192.168.10.20:8080
# 명시적인 소문자 true만 내부망 HTTP를 허용한다.
ALLOW_INSECURE_HTTP=true
# Nginx가 앱으로 전달할 호스트 내부 포트. 외부 8080과 다르다.
HOST_PORT=3000
# 신규 설치 예시. 기존 운영은 실제 프로젝트명/볼륨명을 그대로 사용한다.
COMPOSE_PROJECT_NAME=mastergantt
MASTERGANTT_VOLUME_NAME=mastergantt-data
```

```text
브라우저 HTTP :8080 → Nginx → HTTP 127.0.0.1:3000 → production 컨테이너 :3000
```

Nginx 예제는 [http.conf.example](deploy/nginx/http.conf.example)에 있다. Linux에서는 기존 `http {}`가 include하는 `/etc/nginx/conf.d/` 등에, Windows에서는 `C:/nginx/conf/nginx.conf`의 기존 `http {}` 안에 포함시킨다. 전체 설정이나 다른 서비스 설정을 덮어쓰지 않는다. 인증서·HTTPS redirect·HSTS를 추가할 필요가 없다.

저장소 루트에서 아래 순서로 적용한다. 기존 DB의 일관된 백업과 프로젝트/volume 일치를 먼저 확인한다.

```sh
# 설정 확인 후 환경 변수를 반영하기 위해 재생성한다. restart만으로 바뀌지 않는다.
docker compose --env-file .env -f deploy/compose.yml config --quiet
docker compose --env-file .env -f deploy/compose.yml up -d --build app
docker compose --env-file .env -f deploy/compose.yml ps
curl -fsS http://127.0.0.1:3000/api/health/ready
# 실제 Nginx 전체 설정을 검사하고, 성공한 경우에만 reload한다.
sudo nginx -t && sudo nginx -s reload
curl -fsS http://192.168.10.20:8080/api/health/ready
```

Windows PowerShell에서는 먼저 `curl.exe -fsS http://127.0.0.1:3000/api/health/ready`로 WSL2 앱에 접근 가능한지 확인한다. WSL localhost 전달이 안 되는 경우 Nginx만 바꿔 해결하려 하지 말고 네트워크 모드·포트 게시·방화벽을 확인한다. Nginx 설치 위치에서 `.\nginx.exe -t` 성공 후 `.\nginx.exe -s reload`를 실행한다. Nginx도 Docker라면 같은 network에서 upstream을 `http://app:3000`으로 하고 앱의 호스트 포트 게시를 제거할 수 있다. 별도 호스트 프록시는 승인된 내부 인터페이스/방화벽을 설계해야 한다.

브라우저에서 프로젝트 생성 → 편집 잠금 해제 → Grid `+` 작업 추가 → 작업 정보 편집 → 새로고침 후 유지 → 편집 모드 종료 후 변경 거부를 확인한다. Health 200만으로 쿠키/편집 검증을 완료했다고 보지 않는다. 공유 링크 복사에 clipboard API를 사용할 수 없는 HTTP 브라우저는 기존 수동 복사 모달을 사용한다.


```nginx
# nginx.conf의 기존 http {} 안에서 include하는 예제다. 전체 nginx.conf가 아니다.
# 192.168.10.20과 외부 8080, 내부 3000은 실제 주소/포트로 변경한다.
# 앱 설정: APP_BASE_URL=http://192.168.10.20:8080, ALLOW_INSECURE_HTTP=true
server {
    listen 8080;
    server_name 192.168.10.20;

    # 단일 Nginx가 직접 브라우저 요청을 받는 구성. 다른 Host는 앱에 전달하지 않는다.
    if ($host != 192.168.10.20) { return 444; }

    # 인증서, ssl, HTTPS redirect, HSTS를 요구하지 않는 HTTP 전용 구성이다.
    client_max_body_size 1m;
    # 민감한 URL query·Cookie·비밀번호를 access log에 넣지 않는다.
    # 별도 비식별 log_format을 준비하지 않은 기본 예제에서는 access log를 끈다.
    access_log off;
    # 실제 설치 경로와 권한에 맞게 지정한다.
    # Linux: error_log /var/log/nginx/mastergantt.error.log warn;
    # Windows: error_log C:/nginx/logs/mastergantt.error.log warn;

    location / {
        # 호스트 Nginx → loopback에 게시한 production 앱 컨테이너.
        # Nginx도 같은 Docker network이면 http://app:3000 으로 변경한다.
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection "";

        # 외부 Host의 명시적 포트 보존. $host로 바꾸지 않는다.
        proxy_set_header Host              $http_host;
        proxy_set_header X-Forwarded-Host  $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port  $server_port;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $remote_addr;

        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;
        proxy_cache off;
        proxy_intercept_errors off;
        # Origin·Cookie·If-Match 및 Set-Cookie·ETag는 원본 그대로 전달한다.
        # Origin 재작성, CORS *, 쿠키 Domain/Path 재작성으로 오류를 우회하지 않는다.
    }
}
```

#### 선택 사항: HTTPS 구성


아래 예제는 **브라우저 → HTTPS Nginx → HTTP masterGantt 단일 컨테이너** 구성이다. Nginx가 TLS를 종료하며 앱의 내부 HTTP 포트는 외부에 공개하지 않는다. 실제 인증서·방화벽·프록시를 포함한 운영 검증 완료를 의미하지 않는다. 영속 저장소·백업·이미지 선택은 [DEPLOYMENT](docs/DEPLOYMENT.md), 보안 계약은 [SECURITY](docs/SECURITY.md)를 함께 따른다.

#### 1) 먼저 맞춰야 하는 주소와 환경 변수

```text
브라우저: https://gantt.example.com
                 ↓ HTTPS 443
Nginx: 호스트에서 실행, 인증서 보유
                 ↓ HTTP 127.0.0.1:3000
Docker app: 컨테이너 내부 3000 → /data 영속 volume
```

저장소 루트의 운영용 `.env`에 다음 값을 반영한다. 기존 파일을 통째로 덮어쓰지 않고 필요한 항목만 변경한다.

```dotenv
# 브라우저가 실제 접속하는 외부 HTTPS origin. 내부 컨테이너 주소가 아니다.
# 끝의 /, /mastergantt 같은 경로, query, fragment는 넣지 않는다.
APP_BASE_URL=https://gantt.example.com

# 호스트에 공개할 내부 전달용 포트. Nginx proxy_pass의 포트와 맞춘다.
# 외부 HTTPS 포트(443 또는 8443)와는 별개다.
HOST_PORT=3000
```

현재 [deploy/compose.yml](deploy/compose.yml)은 `NODE_ENV=production`, 컨테이너 `PORT=3000`, `DATABASE_PATH=/data/mastergantt.sqlite3`와 `127.0.0.1:${HOST_PORT:-3000}:3000` 포트 매핑을 설정한다. 다음 명령은 **로컬 소스 빌드 방식**이며 저장소 루트에서 실행한다. 운영 이미지 갱신 전에는 백업·복원 가능 여부를 확인한다. GHCR 이미지를 사용할 때는 별도의 [이미지 실행 절차](docs/DEPLOYMENT.md)를 따른다.

```sh
docker compose --env-file .env -f deploy/compose.yml config --quiet
docker compose --env-file .env -f deploy/compose.yml up -d --build app
docker compose --env-file .env -f deploy/compose.yml ps
curl -fsS http://127.0.0.1:3000/api/health/ready
```

`.env`를 변경한 뒤 `docker compose --env-file .env -f deploy/compose.yml restart`만 실행하면 컨테이너 환경 변수가 갱신되지 않는다. `docker compose --env-file .env -f deploy/compose.yml up -d app`으로 변경된 설정을 반영하고 필요하면 `--force-recreate`를 사용한다. 기존 named volume은 유지하며 `docker compose --env-file .env -f deploy/compose.yml down -v`는 실행하지 않는다. 참고: [Compose up](https://docs.docker.com/reference/cli/docker/compose/up/), [Compose restart](https://docs.docker.com/reference/cli/docker/compose/restart/).

**현재 코드의 필수 조건:** `APP_BASE_URL`은 브라우저 `Origin`의 scheme·host·port와 정확히 같아야 하며 production에서는 기본 HTTPS만 허용하며, 명시적 ALLOW_INSECURE_HTTP=true일 때 HTTP도 허용한다. 예를 들어 브라우저가 `https://192.0.2.10:8443`으로 접속하면 도메인 주소나 내부 `http://app:3000`이 아니라 그 origin을 설정한다. 기본 HTTPS 포트는 `:443`을 생략한다. `TRUST_PROXY`는 request ID 신뢰 경계에만 적용되고 `LOG_LEVEL`은 서버 로그 필터에 적용된다. 둘 다 HTTP 허용, Origin 검증 또는 Cookie 보안 정책을 완화하지 않는다. 근거: [Origin 검증](src/server/security/origin-core.ts), [Cookie 구현](src/server/security/cookie-core.ts).

#### 2) 호스트 Nginx 설정 예제: 도메인 + HTTPS 443

도메인은 Nginx 서버를 가리키도록 준비하고, 브라우저가 신뢰하는 인증서와 개인 키를 배치한다. 아래 `gantt.example.com`, 인증서 경로, 로그 경로, upstream 포트는 실제 환경에 맞게 바꾼다. **아래 블록은 `nginx.conf`의 `http { ... }` 안에 들어갈 내용**이며 독립된 전체 `nginx.conf`가 아니다.

Linux에서는 `/etc/nginx/conf.d/mastergantt.conf`에 저장하고 기존 `http` 블록이 `include /etc/nginx/conf.d/*.conf;`를 포함하는지 확인한다. `sites-enabled`를 사용하는 설치는 해당 구성에 맞게 한 번만 include한다. 기존 다른 서비스의 `server` 블록이나 전체 `nginx.conf`를 덮어쓰지 않는다.

```nginx
# http {} 안에서 한 번만 정의한다.
# 요청 본문, Cookie, Authorization, query string은 기록하지 않는다.
log_format mastergantt '$remote_addr [$time_local] '
                       '"$request_method $uri $server_protocol" $status '
                       'upstream=$upstream_status rt=$request_time '
                       'urt=$upstream_response_time';

# 일반 HTTP 접속은 승인된 HTTPS 주소로 이동한다.
server {
    listen 80;
    server_name gantt.example.com;
    return 308 https://gantt.example.com$request_uri;
}

server {
    listen 443 ssl;
    server_name gantt.example.com;

    # 다른 Host가 이 server로 들어온 경우 앱에 전달하지 않는다.
    # server_name을 바꿀 때 이 비교값도 함께 바꾼다.
    if ($host != gantt.example.com) { return 444; }

    # PEM 인증서 체인과 개인 키. 실제 파일을 배치하고 접근 권한을 제한한다.
    ssl_certificate     /etc/nginx/certs/mastergantt/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/mastergantt/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # 요청 본문 상한의 시작값. Import 허용 용량을 의미하지 않는다.
    client_max_body_size 1m;

    access_log /var/log/nginx/mastergantt.access.log mastergantt;
    error_log  /var/log/nginx/mastergantt.error.log warn;

    # 화면, /projects, /api, /_next를 모두 원래 경로 그대로 전달한다.
    location / {
        # 호스트 Nginx → Compose가 loopback에 게시한 앱 포트.
        # URI 부분 없이 지정하여 원래 요청 경로와 query를 유지한다.
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection "";

        # 외부 Host의 명시적 포트까지 보존한다. $host로 대체하지 않는다.
        proxy_set_header Host              $http_host;
        proxy_set_header X-Forwarded-Host  $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port  $server_port;
        proxy_set_header X-Real-IP         $remote_addr;

        # 브라우저가 직접 연결하는 단일 edge proxy 전제.
        # 클라이언트가 임의로 보낸 X-Forwarded-For를 신뢰하지 않고 덮어쓴다.
        proxy_set_header X-Forwarded-For   $remote_addr;

        # 초기 운영값이며 앱 처리 시간과 모니터링 결과에 따라 조정한다.
        proxy_connect_timeout 5s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;

        # Next.js의 스트리밍 응답을 중간에서 모아두지 않는다.
        proxy_buffering off;

        # 인증 상태와 revision을 포함하는 응답을 공유 캐시하지 않는다.
        proxy_cache off;
        # 앱의 401/403/412/422/503 JSON 응답을 Nginx HTML로 바꾸지 않는다.
        proxy_intercept_errors off;

        # Origin, Cookie, If-Match는 기본 전달을 유지한다.
        # Origin을 고정값으로 덮어쓰거나 Set-Cookie를 숨기지 않는다.
    }
}
```

| 설정 | 역할과 주의점 |
| --- | --- |
| `listen 443 ssl`, 인증서, `ssl_protocols` | 브라우저 구간의 TLS 종료. 내부 HTTP 연결과 별개이며 사내 CA 사용 시 클라이언트에도 신뢰 체인을 배포한다. |
| `Host $http_host` | 외부 요청의 host와 명시적 port를 그대로 보존한다. 비표준 포트에서 `$host`만 사용하면 포트 정보가 빠질 수 있다. 다만 **앱의 Origin 검증 기준은 `APP_BASE_URL`**이므로 Host 설정만으로 잘못된 환경 변수가 해결되지는 않는다. |
| `X-Forwarded-*`, `X-Real-IP` | 원래 접속 정보를 전달한다. 위 예제는 Nginx 자체가 외부 TLS를 종료하는 단일 프록시 전용이다. 앞에 다른 프록시가 있으면 허용 proxy IP·실제 외부 scheme/port 정책을 별도로 설계하고, 전달받은 헤더를 무조건 신뢰하지 않는다. |
| `proxy_pass`, `location /` | 앱의 모든 경로를 전달한다. `/api`·`/_next`를 다른 서비스로 보내거나 정적 SPA용 `try_files ... /index.html`을 적용하지 않는다. |
| `proxy_buffering off` | 응답 스트리밍 지연을 줄인다. 요청 업로드 버퍼링을 끄는 `proxy_request_buffering off`와는 다른 설정이다. |
| `proxy_cache off`, `proxy_intercept_errors off` | 권한·revision·오류 응답을 앱 계약대로 전달한다. `Origin`, `Cookie`, `If-Match`, 응답의 `Set-Cookie`·`ETag`를 제거하거나 재작성하지 않는다. |
| `client_max_body_size 1m` | Nginx 요청 본문 상한. 초과하면 앱 도달 전에 413이 날 수 있다. 앱의 개별 API 크기 제한은 그대로 유효하며 향후 Import 구현·용량 정책과 함께 조정한다. 무제한 `0`을 기본으로 쓰지 않는다. |
| `proxy_*_timeout` | 연결 수립 및 읽기·쓰기 대기 한도. read/send timeout은 요청 전체 실행 시간의 상한이 아니라 연속 I/O 사이의 대기 한도다. 502/504를 무조건 timeout 증가로 해결하지 않는다. |
| `access_log`, `error_log` | 요청 상태·upstream 상태·처리 시간을 확인한다. 로그 파일의 접근 권한·보관·순환 정책도 설정하고 비밀번호·세션 원문을 추가 기록하지 않는다. |

운영은 `npm run dev`가 아닌 production 서버를 사용한다. 현재 운영 경로에 개발용 HMR/WebSocket 설정을 필수로 추가할 필요는 없다. 추후 WebSocket 기능을 도입하면 Upgrade 처리를 별도로 검토한다. CORS `*`나 `proxy_set_header Origin ...`으로 인증 실패를 우회하지 않는다. HTTPS production에서 앱이 발행하는 `__Host-mastergantt_edit`의 `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` 속성을 유지하고 `Domain`을 추가하지 않는다.

#### 3) IP 주소 + 비표준 HTTPS 포트로 접속하는 경우

아래 주소는 설명용이다. 예를 들어 외부 주소를 `https://192.0.2.10:8443`으로 정했다면 **위 예제에서 다음 항목을 함께 변경**한다. upstream `127.0.0.1:3000`과 `HOST_PORT=3000`은 그대로 유지할 수 있다.

| 변경 대상 | 변경값 |
| --- | --- |
| `.env`의 `APP_BASE_URL` | `https://192.0.2.10:8443` |
| HTTPS `listen` | `listen 8443 ssl;` |
| 두 `server_name`과 Host 비교값 | `192.0.2.10` |
| HTTP redirect | `return 308 https://192.0.2.10:8443$request_uri;` |
| 인증서 | 접속 IP를 **IP Address SAN**으로 포함하고 브라우저가 신뢰하는 인증서 |
| 방화벽 | 승인된 클라이언트의 Nginx 8443 접근 허용; 앱 3000 직접 접근은 차단 |

HTTP redirect는 여전히 80 포트 예제다. 이미 다른 서비스가 사용하는 경우 충돌하지 않게 별도 포트를 정하거나 이 HTTP 블록을 제외하고 HTTPS 주소로 직접 접속한다. `proxy_set_header Host $http_host;`를 유지하여 `192.0.2.10:8443`을 전달하며, IP 접속과 도메인 접속을 하나의 앱에서 같은 canonical origin처럼 혼용하지 않는다.

#### 4) Windows Nginx + WSL2 Docker

위 Nginx 설정의 동작 원칙은 같지만 인증서·로그 경로를 Windows 경로로 바꾼다. 설정 파일 안에서는 `/`를 사용한다.

```nginx
# 위 server 블록의 해당 경로를 교체하는 예시다.
ssl_certificate     C:/nginx/conf/certs/mastergantt/fullchain.pem;
ssl_certificate_key C:/nginx/conf/certs/mastergantt/privkey.pem;
access_log          C:/nginx/logs/mastergantt.access.log mastergantt;
error_log           C:/nginx/logs/mastergantt.error.log warn;
```

`C:/nginx/conf/nginx.conf`의 기존 `http` 안에 포함시키거나, 그 안의 `include conf.d/*.conf;`와 `C:/nginx/conf/conf.d/mastergantt.conf`를 사용한다. 실행 위치와 실제 설치 경로에 맞게 조정한다. WSL2의 앱을 Windows에서 `localhost`로 접근할 수 있는지는 WSL 네트워크 모드·전달 설정·방화벽의 영향을 받으므로 **Nginx를 적용하기 전에 Windows PowerShell에서** 먼저 확인한다.

```powershell
curl.exe -fsS http://127.0.0.1:3000/api/health/ready
```

실패하면 WSL 배포판과 Docker/app 실행 상태, 포트 매핑, localhost 전달 및 Windows/Hyper-V 방화벽을 먼저 확인한다. WSL IP는 재시작 등으로 달라질 수 있으므로 이를 고정 주소처럼 복사하지 않는다. 특히 현재 `127.0.0.1`에만 게시한 앱은 `proxy_pass`를 WSL IP로 바꾸는 것만으로 접근이 보장되지 않는다. Windows와 WSL 양쪽에서 연결을 확인하고 필요한 전달 경계를 설계한다. 편의를 위해 앱을 무조건 `0.0.0.0`에 노출하거나 방화벽 전체를 해제하지 않는다.

#### 5) Nginx도 Docker에서 실행하거나 다른 호스트에 있는 경우

**같은 Docker network의 Nginx 컨테이너**에서는 `127.0.0.1`이 앱이 아니라 Nginx 컨테이너 자신이다. 동일 network에 앱 service `app`을 연결하고 위 예제의 upstream만 다음과 같이 변경한다.

```nginx
proxy_pass http://app:3000;
```

이때 앱의 `ports` 매핑은 제거하고 Nginx의 외부 TLS 포트만 게시한다. 인증서·설정은 Nginx 컨테이너에 읽기 전용으로 제공하고, SQLite `/data` volume은 앱 하나만 사용한다. 서로 다른 Compose 프로젝트라면 명시적인 공용 network 구성이 필요하다. 앱 재생성으로 컨테이너 IP가 바뀔 때의 이름 재해석·Nginx reload 정책도 확인한다.

**다른 호스트의 Nginx**는 앱 호스트의 `127.0.0.1`에 접근할 수 없다. 이 경우 앱 포트를 승인된 내부 인터페이스에만 게시하고 Nginx 호스트만 접근하도록 방화벽을 제한한다. 신뢰할 수 없는 구간을 건너면 upstream TLS 등 전송 보호도 추가로 검토한다.

#### 6) `/mastergantt` 하위 경로 배포 주의

현재 [next.config.ts](next.config.ts)에는 `basePath`가 없고, `APP_BASE_URL`도 경로가 없는 origin만 허용한다. 따라서 `/mastergantt`를 잘라 전달하는 Nginx `rewrite`만으로는 화면 이동·`/api`·`/_next`·직접 링크가 모두 정상 동작한다고 보장할 수 없다.

**현재는 전용 도메인 또는 전용 포트의 루트 `/`로 운영한다.** 하위 경로가 필요하면 Next.js `basePath`를 빌드 시 적용하고 앱의 링크·fetch URL·직접 URL 생성 계약을 함께 수정한 뒤 재빌드 및 E2E 검증한다. `APP_BASE_URL=https://호스트/mastergantt`를 넣는 방법은 현재 검증 코드에서 거부된다. `basePath`는 런타임 Nginx 설정만으로 추가되는 기능이 아니다.

#### 7) 적용 순서와 확인 명령

인증서 파일과 권한, domain/IP, 외부 포트, `APP_BASE_URL`, upstream 연결을 준비한 뒤 **구문 검사에 성공한 경우에만 reload**한다. 처음 시작하는 Nginx는 구문 검사 후 설치 환경의 서비스 시작 절차를 따른다.

```sh
# Linux: 실제로 운영할 전체 nginx.conf를 검사한다.
sudo nginx -t
# 위 명령이 성공했을 때만 실행한다.
sudo nginx -s reload

# 내부 앱과 외부 TLS 경로를 각각 확인한다.
curl -fsS http://127.0.0.1:3000/api/health/ready
curl -I http://gantt.example.com/projects/new
curl -fsS https://gantt.example.com/api/health/live
curl -fsS https://gantt.example.com/api/health/ready

# 사내 CA가 시스템 신뢰 저장소에 없는 테스트 장비에서는 CA 파일을 명시한다.
curl --cacert /path/to/company-root-ca.pem -fsS https://gantt.example.com/api/health/ready
```

```powershell
# Windows: 실제 설치 경로에서 기존 Nginx와 같은 prefix/config를 사용한다.
Set-Location C:\nginx
.\nginx.exe -t -p C:/nginx/ -c conf/nginx.conf
# 위 명령이 성공했을 때만 실행한다.
.\nginx.exe -s reload -p C:/nginx/ -c conf/nginx.conf
```

HTTP는 올바른 외부 HTTPS 주소로 308 redirect되어야 하고 live/ready는 각각 200과 `{"status":"ok"}`를 확인한다. Health 성공만으로 인증·편집을 검증한 것은 아니다. 브라우저에서 인증서 경고 없이 접속하여 **테스트 프로젝트 생성 → 비밀번호 잠금 해제 → 작업 추가·수정 → 새로고침 후 유지 → 로그아웃 후 변경 거부**까지 확인한다. 개발자 도구에서는 Origin·응답 상태·Cookie 속성만 점검하고 비밀번호나 Cookie 원문을 보고서에 복사하지 않는다. 인증서 검증을 생략하는 `curl -k`를 운영 검증 기준으로 삼지 않는다.

#### 8) 증상별 점검

| 증상 | 우선 확인 |
| --- | --- |
| Nginx `-t` 실패 | `http` 안에 include했는지, 중복 `listen`/default server, 인증서·키·로그 경로와 권한, 오타를 확인한다. 기존 정상 설정을 유지하고 reload하지 않는다. |
| 502 Bad Gateway | Nginx 실행 환경에서 upstream으로 접속 가능한지, app 로그·재시작·`HOST_PORT`, WSL 전달, 컨테이너의 loopback 의미를 확인한다. |
| 504 Gateway Timeout | Nginx error log와 앱 처리 시간·DB 잠금·자원 부족을 확인한 뒤 timeout 조정 필요성을 판단한다. |
| 화면은 열리지만 생성·저장 시 403 | 브라우저 Origin과 `APP_BASE_URL`의 scheme/host/port, Origin 헤더의 원본 전달, 컨테이너 환경 변수 갱신 여부를 확인한다. CORS/Origin 검증을 끄지 않는다. |
| 비밀번호 인증 후에도 401 또는 편집 해제 | HTTPS 여부, `__Host-mastergantt_edit`의 저장·전송, `Secure`·`Path=/`·Domain 미설정, 프록시의 `Set-Cookie` 제거 여부와 세션 만료를 확인한다. |
| 412 응답 | 우선 앱의 revision 충돌인지 확인하고 최신 데이터를 다시 조회한다. 프록시가 `If-Match`를 제거하거나 응답을 캐시하지 않는지도 확인한다. |
| 413 응답 | Nginx 본문 상한과 앱 API 자체 제한을 구분한다. Import 크기 정책 확정 없이 일괄 대용량·무제한으로 늘리지 않는다. |
| `/_next` 404 또는 JS 대신 HTML 응답 | 다른 `location`에 잡혔는지, SPA fallback·하위 경로 rewrite가 적용됐는지 확인한다. |
| `/api/health/ready`가 503 | 앱 설정·migration·SQLite volume 권한을 확인한다. liveness 200만 보고 정상으로 판정하지 않는다. |

공식 참고: [Nginx proxy 모듈](https://nginx.org/en/docs/http/ngx_http_proxy_module.html), [요청 본문 제한](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size), [HTTPS 설정](https://nginx.org/en/docs/http/configuring_https_servers.html), [설정 적용](https://nginx.org/en/docs/beginners_guide.html), [Windows Nginx](https://nginx.org/en/docs/windows.html), [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Next.js basePath](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath), [WSL 네트워킹](https://learn.microsoft.com/en-us/windows/wsl/networking).

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

성공한 `main` push는 모든 gate 뒤 `ci-<full SHA>` image를 임시 게시하고 workflow가 출력한 digest를 새로 pull해 Project/Task API authorization과 restart persistence까지 검사한 뒤 해당 package version을 삭제한다. PR과 수동 CI는 registry에 쓰지 않는다. `ci-*`는 SemVer release나 운영/rollback artifact로 남기지 않는다.

Release workflow는 별도로 저장소 단위 직렬 실행한다. 이전 release보다 큰 version인지 확인하고 GHCR에 남지 않는 local candidate digest smoke를 통과한 경우에만 stable alias와 exact version을 승격한다. 테스트에서는 `latest` 대신 commit/release workflow가 출력한 exact digest를 사용한다. Private GHCR consumer는 최소 `packages: read`만 사용한다. 실제 tag 생성, plan별 ruleset·attestation 제약과 image login 절차는 [CI/CD 문서](docs/CI_CD.md), container 실행은 [Deployment](docs/DEPLOYMENT.md)를 따른다.

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
| [deploy/docker/Dockerfile](deploy/docker/Dockerfile), [deploy/compose.yml](deploy/compose.yml), [.dockerignore](.dockerignore) | non-root image, single-instance SQLite volume와 build context 보호 |
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
| Nginx 앞단 운영 예제 | [README Nginx 설정·설명·점검](#nginx-reverse-proxy) |
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

## 저장소 파일 배치와 Compose 경로

배포 파일은 [Dockerfile](deploy/docker/Dockerfile), [Compose](deploy/compose.yml), [entrypoint](deploy/docker/container-entrypoint.sh)에 모았다. 상세 경로·기존 설치 전환·검증 방법은 [REPOSITORY_STRUCTURE](docs/REPOSITORY_STRUCTURE.md)를 따른다. 루트에서 `docker compose --env-file .env -f deploy/compose.yml ...`을 사용하며 기존 `.env`를 덮어쓰지 않는다. **실행 전 `COMPOSE_PROJECT_NAME`을 기존 컨테이너의 project label과 동일하게 설정**하고 기존 `/data` volume도 유지한다. `.env.example`의 project 이름은 신규 설치 예시다. HTTP/HTTPS 정책은 #8의 별도 변경이며 이 파일 이동으로 바뀌지 않는다.

## Test configuration relocation (#13)

설정은 `tests/config/vitest.config.ts`, `tests/config/playwright.config.ts`에 있다. `npm test`, `npm run test:e2e`는 그대로 사용한다. 직접 실행은 `npx vitest run --config tests/config/vitest.config.ts`, `npx playwright test --config tests/config/playwright.config.ts`로 지정한다. 설정 파일 기준 root/testDir/webServer.cwd를 사용하고 E2E DB `.data/playwright.sqlite3`, `.next-e2e`, `test-results/`는 루트 기준으로 유지한다. CI는 `node scripts/verify-test-discovery.mjs`로 루트/외부 cwd의 동일한 테스트 발견을 확인한 뒤 전체 테스트를 실행한다. 편집기에서 자동 발견되지 않으면 같은 설정 경로를 지정한다. 실제 Windows 편집기 UI 검증은 미실행이며 [배치 문서](docs/REPOSITORY_STRUCTURE.md)를 함께 따른다.

## 운영 로그 및 요청 추적

서버는 Docker `stdout/stderr`에 JSON 한 줄 구조화 로그를 출력한다. `LOG_LEVEL=debug|info|warn|error`로 필터링하며 잘못된 값은 환경별 안전 기본값으로 fallback하고 진단 이벤트를 남긴다. 신뢰 가능한 Nginx 앞단에서만 `TRUST_PROXY=true`를 사용하고 `$request_id`를 `X-Request-ID`로 전달한다. 응답 `X-Request-ID`, 오류 body의 `error.requestId`, 애플리케이션 로그의 `requestId`는 동일하다.

```bash
docker logs <container>
docker compose --env-file .env -f deploy/compose.yml logs -f app
```

장애 조사는 `사용자 requestId → Nginx access log → Docker application log → errorCode/reasonCode/component` 순서로 수행한다. 상세 schema, 보안 금지 필드, readiness 전환 이벤트와 로그 회전 지침은 [운영 로깅 및 요청 추적](docs/LOGGING.md)을 따른다.
