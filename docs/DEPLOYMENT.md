# Deployment

Owner 2026-11-10 결정에 따라 PR·GitHub Actions·원격 CI·Trusted QA·자동 Finalizer 없이 로컬 검증·수동 GHCR·승인된 운영 배포를 수행한다. [Issue Lifecycle](ISSUE_LIFECYCLE.md), [CI_CD](CI_CD.md), [GITHUB_OPERATIONS](GITHUB_OPERATIONS.md)를 따른다. GHCR 게시 성공은 운영 배포 성공이 아니다. 이전 전체 운영·실행 결과는 [보존 기록](history/owner-ci-retired-20261110/DEPLOYMENT.md)이다.

## 1. 상태와 범위

이 문서는 단일 SQLite 운영 환경의 로컬 배포·복원 계약이다. `deploy/docker/Dockerfile`, `deploy/compose.yml`, `.dockerignore`와 non-root startup migration을 사용한다. container healthcheck는 migration·SQLite·foreign key·migration ledger를 검증하는 readiness endpoint를 사용한다.

대상은 하나의 Next.js Node.js application과 하나의 SQLite database를 사용하는 소규모 운영 환경이다. SQLite 단계에서는 **application replica를 정확히 하나만** 실행한다. Redis, 별도 DB, Kubernetes, network filesystem을 이 설계에 추가하지 않는다.

DB 논리 모델, `WAL` pragma, migration ledger의 상세는 `docs/DB_SCHEMA.md`, session/cookie/secret 정책은 `docs/SECURITY.md`를 따른다. 실제 배포 구현에서는 세 문서를 함께 대조한다.

## 2. 확정 배포 형태

```text
HTTPS reverse proxy / load balancer
            |
            v
  single mastergantt application container (non-root)
            |
            v
  Docker named volume mounted at /data
      └─ mastergantt.sqlite3, -wal, -shm

  consistent backup → 접근 통제된 별도 host/storage
```

- Reverse proxy는 public hostname과 원본 요청을 전달한다. HTTPS 구성에서는 TLS 종료와 HTTP→HTTPS redirect를 적용하고, 명시적 HTTP 구성에서는 인증서·HTTPS redirect를 요구하지 않는다. application은 proxy가 신뢰된 배포 경계에 있을 때만 forwarded header를 신뢰한다.
- SQLite 파일과 WAL/SHM sidecar는 image나 source bind mount가 아닌 `/data` persistent volume에만 둔다. Docker named volume은 container engine이 관리하는 persistent data store이며 Compose가 service에 명시적으로 mount한다. [Docker Compose volumes](https://docs.docker.com/reference/compose-file/volumes/)
- 한 DB volume을 여러 application container가 공유하지 않는다. SQLite WAL은 같은 host의 shared-memory 사용과 sidecar 파일을 전제하므로 network filesystem이나 replica 확장은 별도 적합성 검토 및 DB 전환 결정이 필요하다. [SQLite WAL](https://www.sqlite.org/wal.html)
- service는 `restart: unless-stopped` 후보를 사용한다. 자동 restart는 장애 원인을 해결하지 않으므로 health/log/backup 관측과 함께 사용한다.

## 2.1. GHCR/prebuilt image와 local build 경로 분리 (#157)

`deploy/compose.yml`은 운영용 **image-only** Compose다. app service는 `IMAGE_NAME`을 필수로 요구하고 `pull_policy: always`를 사용하며, source `build:`를 포함하지 않는다. 따라서 `--no-build`는 local build 금지만 의미하고 registry freshness를 보장하지 않는다는 과거 혼동을 제거한다.

운영 배포는 다음 우선순위로 image를 선택한다.

1. 검증된 immutable digest: `ghcr.io/planner77/mastergantt@sha256:<verified-digest>`
2. exact SemVer: `ghcr.io/planner77/mastergantt:0.33.1`
3. rolling tag(`latest`, major/minor): 편의용. registry refresh와 container 재생성을 반드시 함께 적용

rolling tag를 사용할 때의 표준 명령은 다음과 같다.

```sh
docker compose --env-file .env -f deploy/compose.yml config --quiet
docker compose --env-file .env -f deploy/compose.yml pull app
docker compose --env-file .env -f deploy/compose.yml up -d --pull always --no-build --force-recreate app
docker compose --env-file .env -f deploy/compose.yml ps
```

- `--no-build`: source에서 image를 build하지 않는다.
- `--pull always`: registry의 현재 manifest/digest를 확인한다.
- `--force-recreate`: 기존 container가 이전 image ID를 계속 사용하는 경우를 방지한다.
- named volume `mastergantt-data` 및 single-instance SQLite 계약은 container 재생성 뒤에도 유지한다.

local source build는 별도 override를 명시한다.

```sh
IMAGE_NAME=mastergantt:local IMAGE_VERSION=local \
docker compose --env-file .env \
  -f deploy/compose.yml -f deploy/compose.build.yml \
  up -d --build app
```

`deploy/compose.build.yml`은 `build:`를 추가하고 `pull_policy: never`를 적용하여 local build 결과가 registry pull로 덮이지 않게 한다. 운영 절차에서는 이 override를 사용하지 않는다.

배포 후 tag 문자열만 보지 말고 실제 실행 identity를 확인한다.

```sh
container_id="$(docker compose --env-file .env -f deploy/compose.yml ps -q app)"
docker inspect "$container_id" --format 'ConfiguredImage={{.Config.Image}} ImageID={{.Image}}'
docker image inspect "$(docker inspect "$container_id" --format '{{.Image}}')" \
  --format 'ID={{.Id}} Version={{index .Config.Labels "org.opencontainers.image.version"}} Revision={{index .Config.Labels "org.opencontainers.image.revision"}}'
```

forward-only migration 때문에 DB ledger가 실행 image보다 앞서 있으면 startup은 계속 fail-closed해야 한다. image를 임의 rollback하지 말고 compatible DB backup/restore와 검증된 image identity를 먼저 확인한다.

> 보안: `docker compose config`는 환경변수 치환 결과를 출력할 수 있다. 실제 비밀번호/token이 포함된 전체 출력을 Issue/공개 log/문서에 붙이지 말고, 공유 전 secret을 마스킹한다. 정상 확인에는 가능한 `config --quiet`를 사용한다.

## 3. Node, Next.js, native module 원칙

### 지원 버전 선택

production application에는 지원되는 LTS만 사용한다. Node 지원 상태는 build 시점의 공식 자료로 확인한다. [Node.js releases](https://nodejs.org/en/about/previous-releases) 프로젝트의 실제 Node/Next 요구는 package/lock과 설치 버전 문서로 확인한다. [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)

현재 build/runtime base의 원본은 `deploy/docker/Dockerfile`의 digest-pinned `node:26-bookworm-slim`이다. 로컬 CLI 지원은 package.json engines의 Node >=22이며 실제 source/lock·Node/npm·native ABI·Docker/Buildx·platform을 보고서에 고정한다. 서로 다른 로컬 호스트와 컨테이너 환경의 검증을 같은 환경으로 주장하지 않는다. W20의 Node22와 당시 Node24 후보 설명은 [과거 기록](history/owner-ci-retired-20261110/DEPLOYMENT.md)이며 현재 이미지 버전이 아니다.

이미지 구현 담당자는 build 직전에 Node 공식 release 상태, project lockfile, Next.js release requirement를 확인하고, 선택한 **동일 Node major와 동일 Linux distribution family/libc 및 target architecture**를 builder와 runtime에 사용한다. multi-stage build는 final image에 build tool을 남기지 않고 필요한 artifact만 copy할 수 있다. [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)

### `better-sqlite3` 호환성

W02에 설치한 `better-sqlite3` 13.0.3은 Node >=22와 bundled prebuilds를 사용하는 artifact다. 과거 Linux x64 / Node 22.14.0의 native query 기록은 현재 Node26 컨테이너 성공을 대체하지 않는다. 현재 build/runtime의 실제 native load/write/restart를 다시 실행해 기록한다. Package 설치·source build 절차는 버전별 manifest에 맞춰 검토해야 한다. [better-sqlite3 README](https://github.com/WiseLibs/better-sqlite3), [설치 검증](RESEARCH.md) Next.js는 `better-sqlite3`를 server external package로 자동 처리하는 목록에 포함한다. [serverExternalPackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages)

그러므로 다음을 지킨다.

- builder와 runtime의 OS distribution/libc(glibc 또는 musl), CPU architecture(`linux/amd64` 또는 `linux/arm64`), Node ABI/major를 혼합하지 않는다.
- build target platform별로 dependency install과 `next build`를 수행한다. prebuilt binary를 받지 못하면 builder에 C++20 compiler, `make`, Python 등 node-gyp 의존성을 **builder stage에만** 설치해 source build하고, runtime에서 실제 require/SQL smoke test를 통과시킨다.
- native `.node` artifact와 production `node_modules`를 build artifact와 함께 runtime으로 복사한다. host의 `node_modules`는 image에 copy하지 않는다.
- `better-sqlite3`는 Node runtime에서만 import한다. Edge runtime/client component에는 사용하지 않는다.
- `next.config`에 별도 externalization을 중복 설정할 필요는 없으나, Next.js/패키지 변경 뒤 server bundle에서 native require가 유지되는지 build smoke test로 확인한다.

## 4. Runtime identity와 volume 권한

- final image는 root가 아닌 고정 application UID:GID로 `USER`를 설정한다. Docker는 기본 process user가 root이며 `USER` 또는 runtime `--user`로 변경할 수 있다. [Docker user](https://docs.docker.com/engine/containers/run/#user)
- image build 중 `/app` artifact는 그 UID:GID가 읽을 수 있게 ownership을 설정한다.
- startup entrypoint는 root 권한으로 volume을 무조건 `chown`하지 않는다. named volume은 최초 생성 시 application UID:GID가 `/data`에 쓰기 가능하도록 image/Compose 구현에서 준비하고, host bind mount 사용 시 deployment owner가 사전에 같은 numeric UID:GID ownership과 directory mode를 준비한다.
- application은 시작 전 `/data` directory 생성/쓰기 가능 여부와 DB, `-wal`, `-shm` 파일 생성 가능 여부를 검사한다. 실패하면 명확한 오류로 종료하고 ready가 되지 않는다.
- SQLite DB path는 `DATABASE_PATH=/data/mastergantt.sqlite3` 형태의 absolute `/data` 경로만 허용한다. 상대 경로, image 내부 DB, `/tmp` DB는 production에서 거부한다.

## 5. Startup, migration, health

현재 container entrypoint의 순서는 다음으로 고정한다.

1. required runtime configuration과 `/data` writable 검증
2. DB open; `foreign_keys=ON`, WAL, synchronous/busy timeout 등 `DB_SCHEMA.md`의 startup pragma 적용 및 확인
3. 순서 고정 SQL migration을 `schema_migrations` ledger/checksum으로 적용. migration 실패 또는 checksum drift면 process exit
4. Next.js server 시작
5. migration 완료와 SQL readiness가 확인된 경우에만 ready 응답

migration은 application 시작 전에 단 한 번 수행하며, async/network I/O를 SQLite write transaction에 넣지 않는다. 이 규칙은 single application instance가 전제다. 미래에 multi-instance deployment가 필요하면 migration lock/rollout 정책을 별도 설계한다.

health endpoint 계약은 다음과 같다.

| Endpoint | 성공 조건 | 실패 시 |
|---|---|---|
| `GET /api/health/live` | Node process와 HTTP router가 요청을 처리 | 200 이외; DB를 열지 않음 |
| `GET /api/health/ready` | canonical `APP_BASE_URL`·production DB path, startup/migration 성공, DB connection `SELECT 1`, `foreign_keys=1`, required migration version 충족 | 503; error detail/secret/DB path는 노출하지 않음 |

Docker `HEALTHCHECK`와 Compose healthcheck는 `ready`를 호출한다. interval, timeout, retries, start-period 값은 cold-start와 실제 migration fixture 측정 후 정한다. Docker healthcheck는 command, interval, timeout, retry, start period를 설정할 수 있다. [Docker healthchecks](https://docs.docker.com/engine/containers/run/#healthchecks)

## 6. 환경 변수 계약

실제 값, `.env`, token, PAT, password, database, WAL/SHM, backup은 Git과 image layer에 넣지 않는다. runtime secret은 deployment secret store 또는 접근 통제된 host environment에서 container에 주입한다. `.env.example`에는 개발용 기본값과 예약 example domain만 있으며 운영 시 실제 설정을 별도 주입한다. 현재 Cookie의 Secure 정책은 `NODE_ENV`와 canonical `APP_BASE_URL`에서 강제하며, 아래 예약 변수는 W16에서 실제 소비 여부를 확정한다.

| 변수 | 필요 | 계약 |
|---|---:|---|
| `NODE_ENV` | 예 | production에서는 `production` |
| `PORT` | 예 | application listen port; reverse proxy만 public expose |
| `DATABASE_PATH` | 예 | production은 `/data/` 아래 absolute SQLite filename |
| `APP_BASE_URL` | 예 | canonical 외부 origin. 기본 HTTPS; ALLOW_INSECURE_HTTP=true일 때 HTTP 허용. trailing slash/path/query/fragment/userinfo 금지 |
| `RESOURCE_CATALOG_ADMIN_PASSWORD` | Compose: 예 | 글로벌 Resource/Resource Group 관리자 비밀번호. 신규 설치 seed는 1~12자. 업그레이드 DB에서 기존 16자 이상 값은 최초 로그인 시 legacy seed로 호환 migration하며, 이후 DB 런타임 변경값이 우선한다. Compose는 미설정 시 config 단계에서 fail-fast; 직접 실행 환경은 기존 API fail-closed 정책 유지 |
| `ALLOW_INSECURE_HTTP` | 선택 | 미설정/false는 HTTPS-only, true만 HTTP 허용. 빈 값/기타 리터럴은 설정 오류 |
| `TRUST_PROXY` | 선택 | `true`일 때만 검증된 reverse proxy `X-Request-ID`를 신뢰. Origin/HTTPS/Cookie 정책과 무관 |
| `LOG_LEVEL` | 선택 | `debug`, `info`, `warn`, `error`; production 기본 `info`. 잘못된 값은 안전 기본값 + 진단 경고 |

`docker compose --env-file .env`의 `--env-file`은 Compose 변수 치환용 입력이며 `.env`의 모든 항목을 컨테이너에 자동 전달하지 않는다. 따라서 `deploy/compose.yml`은 `RESOURCE_CATALOG_ADMIN_PASSWORD: ${RESOURCE_CATALOG_ADMIN_PASSWORD:?Set RESOURCE_CATALOG_ADMIN_PASSWORD}`를 명시해 실제 app 환경으로 전달한다. 값이 없으면 container 생성 전에 실패한다. 기존 배포의 16자 이상 관리자 비밀번호는 migration 직후 최초 정상 로그인에서만 legacy bootstrap 값으로 받아 SQLite scrypt credential로 저장할 수 있다. 신규/변경 비밀번호는 1~12자를 사용한다. 최초 seed 이후 UI에서 변경한 값은 SQLite에 유지되며 환경변수 변경이나 컨테이너 재생성으로 덮어쓰지 않는다. 실제 비밀번호 원문은 Compose/애플리케이션 로그에 출력하지 않는다.

`APP_BASE_URL`은 URL parser로 검증한다. protocol은 기본 `https:`이며 명시적 `ALLOW_INSECURE_HTTP=true`에서만 `http:`도 허용한다. 나머지 검증에서 hostname은 deployment owner가 승인한 canonical public host, port는 선택한 HTTP/HTTPS scheme의 default 또는 승인한 명시 port만 허용하며 URL origin과 입력이 동일해야 한다. 이 값으로만 `${APP_BASE_URL}/projects/${public_id}`를 만들고, request `Host`/forwarded host나 user input으로 export hyperlink를 만들지 않는다. public ID는 secret이 아니며 URL에 password/session을 넣지 않는다.

## 7. 구현 파일별 최소 책임

| 파일 | 최소 책임 | 포함하면 안 되는 것 |
|---|---|---|
| `deploy/docker/Dockerfile` | pinned-at-build approved Node LTS candidate, same native builder/runtime platform, production dependency/build artifact, non-root user, `/data` declaration, application start | DB data, `.env`, secrets/PAT, host `node_modules` |
| `deploy/compose.yml` | single `app` service, named `/data` volume, port/proxy boundary, runtime env references, restart/healthcheck | second app replica, database service, source DB bind mount 기본값 |
| `.dockerignore` | `.git`, 모든 `.env*`, `node_modules`, `.next`, `.prepr-reports`, DB/WAL/SHM, backups, logs, coverage/test output 제외 | required source, lockfile, migrations |
| `.env.example` | 환경변수 names와 개발용 예시; secret injection 위치 안내 | 실제 secret, 운영 domain, password, token |

게시 전 source 검증은 [LOCAL_PREPR](LOCAL_PREPR.md)의 원본 불변 계약을 따른다. 로컬 `fast`의 표준 `.next`와 browser source snapshot은 검증용 격리 출력이며, `.prepr-reports`의 복제 source·원시 로그·실패 artifact·관리자 snapshot을 Docker build context나 이미지에 넣지 않는다. GHCR에 인계할 이미지는 검증한 exact source와 실제 Docker image ID/digest를 다시 대조한다. 로컬 Docker Gate는 한 번의 격리 Buildx build에서 OCI archive(SBOM/provenance 포함) 하나를 출력한다. offline에서 검증한 runtime child/config/layer를 Docker-load archive로 안전하게 재포장하며 재빌드나 layer 의미 변경을 하지 않는다. `report.dockerImage`는 원본 OCI와 load한 runtime의 source·config ID·비압축 diffID/순서를 연결한다. classic store의 runtime load와 게시용 원본 attested OCI index 보존은 구분한다. 수동 게시에는 재빌드 없이 검증한 동일 OCI를 인계하고 실제 registry index digest·exact digest Pull/Smoke를 확인한다([CI_CD](CI_CD.md)).

Application package와 lockfile은 존재하며 source checkout의 frozen install은 `npm ci`, 빌드는 `npm run build`, 개발·관리용 migration CLI는 `npm run db:migrate`다. 이 source CLI는 repository root에서 환경변수를 명시적으로 주입하고 devDependency `tsx`를 사용한다. production image는 source CLI를 포함하지 않으며 build-time compiled runtime validation/migration JavaScript와 `db/migrations`만 복사해 entrypoint에서 Next.js standalone server 시작 전에 migration gate를 실행한다.

## 8. Backup, restore, rollback

WAL DB는 DB 파일만 임의 copy하지 않는다. SQLite backup API는 concurrent 변경 중에도 consistent snapshot을 만들기 위한 공식 방법이다. [SQLite Backup API](https://www.sqlite.org/backup.html) application에 backup command가 생길 때까지 운영 절차는 scheduled maintenance window에서 app을 cleanly stop한 뒤 `/data` 전체(DB, `-wal`, `-shm`)를 atomic snapshot storage에 복사하는 방식이다.

- backup artifact는 image/volume 내부만의 단일 사본으로 두지 않고, access-controlled durable storage에 encryption-at-rest와 retention 정책을 적용한다.
- restore는 새/격리된 `/data` volume에 backup을 복원하고, image와 동일 UID:GID 및 DB access를 확인한 뒤 application을 single instance로 시작한다.
- schema migration rollback은 DB file를 직접 역방향 편집하지 않는다. deploy 전 compatible backup을 확인하고, failed migration은 application을 ready로 만들지 않는다. restore rehearsal 성공 전 destructive migration release를 승인하지 않는다.
- upgrade/restore/rehearsal 시 DB, WAL, SHM, migration ledger, representative project read/write, export URL, restart persistence를 모두 검사한다.

## 9. 배포 전후 확인과 복구 분기 (#912)

운영 배포는 Owner의 명시 요청 또는 동일 범위 위임이 있을 때만 수행한다. 격리 합성 환경에서 로컬 Docker/readiness/API/auth·revision/native SQLite/restart persistence를 먼저 검증하고 실제 운영 host·proxy/TLS·storage·backup/restore 결과를 구분한다. 실제 환경 미실행은 NOT TESTED이며 합성 DB PASS로 대체하지 않는다.

배포 전에 source SHA·verified image digest·DB schema/migration ledger·WAL 상태·backup ID·직전 정상 digest와 호환성을 기록한다. 백업은 SQLite Online Backup API(또는 sqlite3 `.backup`) 또는 clean stop 후 `/data` 전체의 일관 snapshot으로 만든다. 쓰기 중인 DB 본체 하나만 복사하지 않는다. 접근 통제·암호화·오프호스트 보관·retention·RPO/RTO와 복원 주기는 Owner가 결정한다. 초기 제안은 매일+배포/migration 직전 백업과 월간 격리 복원이며 확정/실제 수행 전 NOT TESTED다.

새 격리 volume 복원 후 `PRAGMA integrity_check`, `foreign_key_check`, migration ledger/checksum, 대표 Project/Task 읽기·쓰기/권한·export/readiness·restart persistence를 **호환 exact digest**로 확인한다. WAL 활성·손상/누락/오래된 백업·migration 중 실패·구 이미지 비호환도 음성 테스트한다. 파괴적 migration은 백업·복원 준비 없이는 배포하지 않는다. 기존 운영 파일을 자동 overwrite하거나 ledger를 편집하지 않는다.

| 오류 | 복구 경로 | 완료 증거 |
| --- | --- | --- |
| 데이터 변경 없는 화면/코드 오류 | 새 Git revert/교정 commit 또는 DB 호환이 확인된 직전 digest로 교체 | 새 source 로컬 검사·실제 운영 smoke |
| schema migration 후 오류 | 새 volume의 호환 DB snapshot + 대응 이전 exact digest를 쌍으로 복원 | ledger/integrity/FK·대표 read/write·restart·손실 범위 확인 |
| 데이터 손상/host 장애 | 접근 통제된 off-host 백업을 새 격리 volume에 복원 | backup 시점·예상 RPO 손실·실측 RTO·Owner 결정·운영 검증 |

Git revert와 이미지 교체는 forward-only DB migration을 취소하지 않는다. 운영 rollback 승인 전에 백업 시점 이후 데이터 손실을 명시한다. source/digest/backup ID·명령/exit·실제 결과를 Issue 실패 원장과 [Regression Index](REGRESSION_INDEX.md)에 연결한다. 운영 DB·백업·사내 주소·실화면·비밀값은 PUBLIC 저장소/Issue에 올리지 않는다.

## 10. runtime 설정과 로그

production container는 prepared Next standalone tree와 build-time compiled runtime validation/migration JavaScript를 실행한다. `npm run build`의 standalone 준비·`build:runtime-tools`를 사용하며 final image에 source·전체 dev dependencies·tsx·실데이터/비밀값을 복사하지 않는다. native module과 UID:GID1001:1001·absolute `/data`·single instance/WAL·entrypoint/health 계약을 유지한다.

Compose runtime 변수는 `.env.example`과 `deploy/compose.yml`의 명시 전달을 확인한다. `.env`는 Compose 치환용이며 모든 값이 자동 전달되는 것은 아니다. `RESOURCE_CATALOG_ADMIN_PASSWORD`, `LOGISTICS_CATALOG_ADMIN_PASSWORD`, `PROJECT_MASTER_ADMIN_PASSWORD`는 신규 credential seed이며 이후 DB credential을 덮지 않는다. LLM 설정은 [LLM_CONFIGURATION](LLM_CONFIGURATION.md), 전송은 [HTTP_OPERATION](HTTP_OPERATION.md)을 따른다. production 기본 HTTPS, 명시적 `ALLOW_INSECURE_HTTP=true` 내부망 HTTP에서도 Origin/session/revision·Cookie 정책을 유지한다.

정상 구성 확인에는 `docker compose --env-file .env -f deploy/compose.yml config --quiet`를 사용한다. 전체 config·환경값·raw 운영 로그는 게시하지 않는다. JSON stdout/stderr 로그·requestId·TRUST_PROXY 경계·보존/회전 정책은 [LOGGING](LOGGING.md)을 따른다. 기존 Compose project/volume·운영 데이터·루트 진입점을 변경하지 않는다. 배포 경로는 [REPOSITORY_STRUCTURE](REPOSITORY_STRUCTURE.md)다.

## 11. 미검증·Owner 결정

실제 architecture/native parity, bind mount 권한, 운영 upgrade/rollback, off-host backup/restore, reverse proxy/TLS, 수동 UX는 해당 환경 증거 전 NOT TESTED다. canonical hostname·인증서 담당·storage·retention/RPO/RTO·rehearsal 주기·자원/healthcheck 값은 Owner의 환경별 결정이다. #912는 실제 복원, #909는 수동 GHCR, #911은 관리자 전환을 담당한다. 문서 작성으로 그 실행 완료를 주장하지 않는다.
