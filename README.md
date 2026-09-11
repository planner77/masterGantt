# masterGantt

소규모 프로젝트의 일정과 진행 상황을 관리하는 웹 애플리케이션이다. SVAR React Gantt Core로 일정을 표시·편집하고, 일정 계산은 독립적인 Scheduling Engine에서 수행하는 구조를 목표로 한다.

프로젝트별 직접 링크, 편집 비밀번호와 서버 인증, SQLite 저장, 승인된 Excel/VBA → JSON·CSV Import, Excel Export, 단일 Docker 애플리케이션 배포를 계획하고 있다. DRM 해제·우회 기능은 개발하지 않는다.

이 README는 프로젝트 이해·설치·재설치·실행·진행 상황 확인을 위한 진입 문서다. 상세 요구사항은 [REQUIREMENTS](docs/REQUIREMENTS.md), 최신 작업 상태는 [실행 계획](docs/exec-plans/active/PLAN.md)을 따른다.

## 1. 현재 구현 상태

기준: **2026-09-11 / W02 완료**, 기능 commit `fd16854`.

| 단계 | 상태 | 현재 확인 가능한 내용 |
| --- | --- | --- |
| Bootstrap | 완료 | 요구사항·아키텍처·보안·Import 계약과 작업 계획 |
| W01 Foundation | 완료 | Next.js 기본 화면, 빈 프로젝트 안내, liveness API, 빌드·테스트 설정 |
| W02 SQLite | 완료 / 독립 QA PASS | 테이블 5개, 마이그레이션·checksum·rollback, 프로젝트 격리, Repository, DB 초기화 CLI |
| W03 SVAR 통합 | 다음 작업 | Gantt 렌더링·readonly·날짜 adapter 검증 |
| W04 이후 | 예정 | 프로젝트 생성·조회, 편집 인증, 작업 저장, 일정 계산, Import/Export |
| W16 배포 | 예정 | Docker 파일, startup/readiness, volume·재시작·백업 복원 검증 |

**지금 웹 화면에는 “등록된 프로젝트가 없습니다.”라는 기본 안내가 표시된다.** 실제 DB 목록을 조회하는 화면은 아직 아니며, 프로젝트 생성 버튼·Gantt Chart·편집 비밀번호 입력은 후속 단계다. W02의 결과는 DB CLI와 자동화 테스트로 확인한다.

최근 검증: build/typecheck/lint PASS, **17개 테스트 PASS**. 환경·범위·남은 위험은 [W02 검토 기록](docs/W02_REVIEW.md)을 참고한다.

## 2. 기술 스택과 역할

설치 버전은 현재 `package-lock.json` 기준이며, 변경할 때는 호환성을 확인하고 lockfile과 이 표를 함께 갱신한다.

| 기술 | 현재 버전 / 상태 | 역할 |
| --- | --- | --- |
| Node.js | 최소 22, 검증 22.14.0 | 서버와 CLI 실행 |
| Next.js | 16.3.4 | App Router, 서버 Route Handler, 빌드 |
| React / React DOM | 19.3.0 | 화면 컴포넌트 |
| TypeScript | 5.8.3 | 타입 검사 |
| Tailwind CSS | 4.3.3 | UI 스타일 도구; 현재 기본 화면은 CSS도 사용 |
| SQLite / better-sqlite3 | SQLite 3.53.4 / driver 13.0.3 | 파일 DB, prepared SQL, transaction; Prisma 미사용 |
| tsx | 4.23.13 | TypeScript 마이그레이션 CLI 실행 |
| Vitest | 5.0.0 | DB·CLI·liveness 자동화 검증 |
| Playwright | 1.63.0, 설정만 준비 | 향후 브라우저 E2E; 현재 E2E 테스트 파일 없음 |
| SVAR React Gantt Core / data provider | 도입 예정, 미설치 | Gantt 표시와 사용자 편집 |
| shadcn/ui / Zod / ExcelJS | 도입 예정, 미설치 | 일반 UI / 입력 검증 / 서버 Excel 생성 |
| Docker / Docker Compose | 구성 예정 | 단일 애플리케이션과 영속 SQLite volume 배포 |

서버의 목표 접근 경계는 `Route Handler → Service → Repository → SQLite`다. 현재 DB·Repository 기반이 있으며 프로젝트 Service/API는 후속이다. DB 진입점은 `server-only`이며 import나 Next.js build만으로 DB를 열지 않는다. 일정 계산은 향후 `src/domain/scheduling/`에서 UI·DB와 독립적으로 관리한다. 기술 선정 근거는 [RESEARCH](docs/RESEARCH.md), 설계는 [ARCHITECTURE](docs/ARCHITECTURE.md)를 참고한다.

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

새 clone에는 DB와 실제 환경 설정이 포함되지 않는다. 새 테스트 환경은 아래 마이그레이션으로 빈 DB를 생성하고, 기존 데이터를 이전할 때는 별도로 보관한 설정과 일관된 DB 백업이 필요하다. 운영 백업·복원 절차의 구현/검증 상태는 [DEPLOYMENT](docs/DEPLOYMENT.md)를 따른다. 기존 `.env`·`.env.local`·DB 파일을 재설치 과정에서 덮어쓰거나 삭제하지 않는다.

## 4. 환경 설정과 DB 초기화

현재 홈 화면과 liveness 확인에는 DB나 별도 환경 변수 설정이 필요하지 않다. 환경 변수 항목은 [.env.example](.env.example)에 정리되어 있다. 실제 값은 Git에 올리지 않는다.

| 항목 | 현재 사용 방식 / 설정 시 주의 |
| --- | --- |
| `DATABASE_PATH` | DB CLI와 서버 DB 진입점에서 사용. 개발은 쓰기 가능한 경로, production은 `/data/` 아래의 정규화된 절대 경로 |
| `NODE_ENV` | 개발 서버는 development, production 서버는 production. DB CLI에도 production 정책을 적용하려면 명시적으로 전달 |
| `PORT` | 실행 포트. 예제에서는 `.env` 값에 의존하지 않고 `--port`로 지정 |
| `APP_BASE_URL` | 향후 프로젝트·Excel 직접 링크에 사용할 canonical origin; 현재 URL 검증/Export는 미구현 |
| `TRUST_PROXY`, `SESSION_COOKIE_SECURE`, `LOG_LEVEL` | 후속 인증·배포 설정. `.env.example`의 개발용 값이 운영 보안을 보장하지 않음 |

Next.js 앱은 `.env.local` 등의 설정을 읽을 수 있지만 **DB CLI는 `.env`·`.env.local`을 자동 로딩하지 않는다.** CLI에는 아래처럼 명시적으로 전달한다. `.env.example`의 `/data` 경로는 로컬 계정에 쓰기 권한이 없을 수 있으므로 개발 예제는 repository 안의 `.data`를 사용한다.

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

Repository root에서 실행한다.

```sh
npm run dev -- --hostname 127.0.0.1 --port 3000
```

서버를 실행한 장비의 브라우저에서 [http://localhost:3000](http://localhost:3000)을 연다. 홈 기본 화면이 보이면 W01 화면 기반을 확인한 것이다. 종료는 터미널에서 `Ctrl+C`를 누른다.

포트가 이미 사용 중이면 `--port 3001`로 실행하고 브라우저 주소도 3001로 바꾼다. Turbopack이 실행 환경의 제약으로 실패하면 `npm run dev -- --webpack --hostname 127.0.0.1 --port 3000`으로 실행할 수 있다. 서버 listen 자체가 권한 오류로 차단된 경우에는 실행 환경의 포트 권한도 필요하다.

원격 Linux 서버에서 실행했다면 브라우저 PC에서 SSH 포워딩을 사용할 수 있다. 아래 `사용자@서버주소`를 실제 SSH 접속 대상으로 바꾸고, 브라우저 PC의 3000 포트가 비어 있어야 한다.

```sh
ssh -L 3000:127.0.0.1:3000 사용자@서버주소
```

### HTTP 응답 확인

서버가 실행 중일 때 별도 터미널에서 확인한다.

```sh
curl -fsS http://127.0.0.1:3000/api/health/live
```

기대 응답은 `{"status":"ok"}`다. 이 endpoint는 DB를 열지 않으며 migration 완료·DB 연결·readiness를 보장하지 않는다. `/api/health/ready`는 아직 없다.

### Production 빌드 확인

개발 서버를 종료한 뒤 같은 디렉터리에서 실행한다.

```sh
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

현재 build script는 Webpack을 사용한다. `npm start`는 DB migration CLI를 자동 실행하지 않으며, 위 절차는 현재 앱 빌드·화면 확인용이다. 실제 운영 배포에는 production DB 경로·권한, HTTPS, startup/readiness, backup 구성이 필요하고 Docker 배포 구현은 W16에 예정되어 있다.

## 6. 검증 명령

```sh
npm run build
npm run typecheck
npm run lint
npm test
```

Build와 typecheck는 `.next` 생성 파일을 공유하므로 순서대로 실행한다. `npm test`의 DB 테스트는 임시 디렉터리를 사용하며 운영 DB를 대상으로 하지 않는다. DB·CLI만 확인하려면 다음을 실행한다.

```sh
npm test -- tests/server/db/database.test.ts tests/server/migration-cli.test.ts
```

W02 기준 전체 17개, DB·CLI 16개 테스트가 통과했다. CLI 테스트는 별도 Node 프로세스를 실행하므로 sandbox에서 `EPERM`이 나오면 프로세스 실행 권한이 있는 환경에서 확인해야 한다. `npm run test:e2e`는 설정만 준비된 상태이며 현재 통과한 E2E 시나리오는 없다.

검증 실패 기록과 미검증 범위까지 포함한 근거는 [W02_REVIEW](docs/W02_REVIEW.md), 전체 검증 계획은 [TEST_PLAN](docs/TEST_PLAN.md)을 참고한다.

## 7. 코드와 실행 산출물

| 위치 | 내용 |
| --- | --- |
| [src/app](src/app), [src/components](src/components) | 화면, 레이아웃, loading/error, liveness Route |
| [src/server/db](src/server/db) | DB 경로 정책, 연결, migration runner, lazy server-only 진입점 |
| [src/server/repositories](src/server/repositories) | Project/Schedule prepared query와 서버용 반환 자료 |
| [db/migrations](db/migrations) | 버전 관리하는 SQL schema 변경 |
| [scripts/migrate.ts](scripts/migrate.ts) | 명시적인 DB 초기화 CLI |
| [tests/server](tests/server) | DB·CLI·liveness 검증 |
| [package.json](package.json), [package-lock.json](package-lock.json) | 실행 명령, 의존성·재설치 기준 |
| [AGENTS.md](AGENTS.md), [.codex](.codex) | 개발·협업 원칙과 전문 Agent 설정 |
| `.next/`, `node_modules/` | 로컬 생성 빌드·의존성, Git 제외 |
| `.data/mastergantt.sqlite3` 및 WAL/SHM | 위 개발 예제로 생성하는 실제 DB, Git 제외 |
| `.env`, `.env.local` | 장비별 실제 설정, Git 제외 |

## 8. 관련 문서와 산출물 목록

| 목적 | 문서 |
| --- | --- |
| 현재 진행과 다음 작업 | [실행 계획](docs/exec-plans/active/PLAN.md), [W01–W19 작업 목록](docs/ISSUE_BREAKDOWN.md) |
| 요구사항과 구조 | [REQUIREMENTS](docs/REQUIREMENTS.md), [ARCHITECTURE](docs/ARCHITECTURE.md) |
| DB·API·보안 계약 | [DB_SCHEMA](docs/DB_SCHEMA.md), [API](docs/API.md), [SECURITY](docs/SECURITY.md) |
| 일정 계산과 Core/PRO 경계 | [SCHEDULING_ENGINE](docs/SCHEDULING_ENGINE.md), [PRO_FEATURE_MATRIX](docs/PRO_FEATURE_MATRIX.md) |
| Excel Import/Export | [IMPORT_EXPORT](docs/IMPORT_EXPORT.md), [IMPORT_SCHEMA](docs/IMPORT_SCHEMA.md), [VBA_EXPORT](docs/VBA_EXPORT.md) |
| 셋업·운영·검증 상세 | [DEPLOYMENT](docs/DEPLOYMENT.md), [TEST_PLAN](docs/TEST_PLAN.md) |
| 기술 조사·설계 판단 | [RESEARCH](docs/RESEARCH.md), [DECISIONS](docs/DECISIONS.md) |
| Bootstrap 결과와 검토 | [BOOTSTRAP_REPORT](docs/BOOTSTRAP_REPORT.md), [BOOTSTRAP_REVIEW](docs/BOOTSTRAP_REVIEW.md) |
| W02 구현 검증 결과 | [W02_REVIEW](docs/W02_REVIEW.md) |
| Multi-Agent 설정 검증 | [AGENT_CONFIGURATION](docs/AGENT_CONFIGURATION.md) |

문서에 계약이 있다는 사실만으로 기능이 구현된 것은 아니다. 현재 구현 여부는 위 상태 표와 실행 계획, 실제 검증 기록을 함께 확인한다. 작업 목록의 W번호는 로컬 관리 식별자이며 GitHub Issue 번호가 아니다.

## 9. README 유지관리 원칙

각 작업·마일스톤 진행 시 프로젝트 개요, 실제 기술 스택, 설치·재설치·설정·실행 방법, 현재 구현 상태, 관련 산출물 링크를 함께 갱신한다. 실행 명령이나 환경 변수 사용이 바뀌면 해당 구현과 같은 변경에 README를 포함한다. 완료·계획·미검증 상태를 구분하고 상세 계약은 해당 문서를 연결하여 관리한다.
