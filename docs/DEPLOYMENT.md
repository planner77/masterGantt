# Deployment

## 1. 상태와 범위

이 문서는 초기 배포 **설계**이다. 아직 `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.env.example`, application health route, migration runner는 구현하지 않았으며, 이 문서의 검증도 실행하지 않았다.

대상은 하나의 Next.js Node.js application과 하나의 SQLite database를 사용하는 소규모 운영 환경이다. SQLite 단계에서는 **application replica를 정확히 하나만** 실행한다. Redis, 별도 DB, Kubernetes, network filesystem을 이 설계에 추가하지 않는다.

DB 논리 모델, `WAL` pragma, migration ledger의 상세는 `docs/DB_SCHEMA.md`, session/cookie/secret 정책은 `docs/SECURITY.md`를 따른다. 두 문서는 현재 다른 담당자가 통합 중일 수 있으므로, 실제 구현 PR에서는 세 문서를 함께 대조한다.

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

- Reverse proxy는 TLS 종료, public hostname 전달, HTTP→HTTPS redirect를 담당한다. application은 proxy가 신뢰된 배포 경계에 있을 때만 forwarded header를 신뢰한다.
- SQLite 파일과 WAL/SHM sidecar는 image나 source bind mount가 아닌 `/data` persistent volume에만 둔다. Docker named volume은 container engine이 관리하는 persistent data store이며 Compose가 service에 명시적으로 mount한다. [Docker Compose volumes](https://docs.docker.com/reference/compose-file/volumes/)
- 한 DB volume을 여러 application container가 공유하지 않는다. SQLite WAL은 같은 host의 shared-memory 사용과 sidecar 파일을 전제하므로 network filesystem이나 replica 확장은 별도 적합성 검토 및 DB 전환 결정이 필요하다. [SQLite WAL](https://www.sqlite.org/wal.html)
- service는 `restart: unless-stopped` 후보를 사용한다. 자동 restart는 장애 원인을 해결하지 않으므로 health/log/backup 관측과 함께 사용한다.

## 3. Node, Next.js, native module 원칙

### 지원 버전 선택

현재 공식 Node release 표에서 Node 24는 LTS이며, production application에는 Active 또는 Maintenance LTS만 사용하도록 권고한다. [Node.js releases](https://nodejs.org/en/about/previous-releases) Next.js 최신 설치 문서는 최소 Node `20.9`를 요구한다. [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)

따라서 초기 후보는 다음과 같고, 지금 특정 `node:<patch>` 또는 Next/better-sqlite3 버전을 문서만으로 고정하지 않는다.

| 후보 | 채택 조건 | 제외 조건 |
|---|---|---|
| Node 24 LTS | build date에도 LTS이고 lockfile의 Next.js 및 native module install/test가 통과 | 지원 종료, ABI 또는 dependency 호환 실패 |
| Node 22 LTS | 배포 시점에도 LTS이며 Node 24에서 호환 문제가 재현되고 공식 지원 범위 안일 때 | 지원 종료 또는 Node 24 검증 통과 후 별도 호환 필요 없음 |

이미지 구현 담당자는 build 직전에 Node 공식 release 상태, project lockfile, Next.js release requirement를 확인하고, 선택한 **동일 Node major와 동일 Linux distribution family/libc 및 target architecture**를 builder와 runtime에 사용한다. multi-stage build는 final image에 build tool을 남기지 않고 필요한 artifact만 copy할 수 있다. [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)

### `better-sqlite3` 호환성

`better-sqlite3`는 현재 지원 Node를 요구하고 주요 platform/architecture에 prebuilt binary를 제공한다. [better-sqlite3 README](https://github.com/WiseLibs/better-sqlite3) 조사 결과 native source build는 C++20 toolchain을 필요로 한다. Next.js는 `better-sqlite3`를 server external package로 자동 처리하는 목록에 포함한다. [Next.js serverExternalPackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages)

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

향후 entrypoint의 순서는 다음으로 고정한다.

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
| `GET /api/health/ready` | startup/migration 성공, DB connection `SELECT 1`, `foreign_keys=1`, required migration version 충족 | 503; error detail/secret/DB path는 노출하지 않음 |

Docker `HEALTHCHECK`와 Compose healthcheck는 `ready`를 호출한다. interval, timeout, retries, start-period 값은 cold-start와 실제 migration fixture 측정 후 정한다. Docker healthcheck는 command, interval, timeout, retry, start period를 설정할 수 있다. [Docker healthchecks](https://docs.docker.com/engine/containers/run/#healthchecks)

## 6. 환경 변수 계약

실제 값, `.env`, token, PAT, password, database, WAL/SHM, backup은 Git과 image layer에 넣지 않는다. runtime secret은 deployment secret store 또는 접근 통제된 host environment에서 container에 주입한다. `.env.example`에는 값이나 실제 hostname 없이 key와 설명만 둔다.

| 변수 | 필요 | 계약 |
|---|---:|---|
| `NODE_ENV` | 예 | production에서는 `production` |
| `PORT` | 예 | application listen port; reverse proxy만 public expose |
| `DATABASE_PATH` | 예 | production은 `/data/` 아래 absolute SQLite filename |
| `APP_BASE_URL` | 예 | canonical public `https` origin; trailing slash/path/query/fragment/userinfo 금지 |
| `TRUST_PROXY` | 조건부 | trusted TLS reverse proxy 뒤에서만 명시적으로 활성화 |
| `SESSION_COOKIE_SECURE` | 예 | production에서 true; HTTPS cookie 정책과 일치 |
| `LOG_LEVEL` | 아니오 | password, session, cookie, authorization header, DB record를 log하지 않는 level |

`APP_BASE_URL`은 URL parser로 검증한다. protocol은 정확히 `https:`, hostname은 deployment owner가 승인한 canonical public host, port는 HTTPS default 또는 승인한 명시 port만 허용하며 URL origin과 입력이 동일해야 한다. 이 값으로만 `${APP_BASE_URL}/projects/${public_id}`를 만들고, request `Host`/forwarded host나 user input으로 export hyperlink를 만들지 않는다. public ID는 secret이 아니며 URL에 password/session을 넣지 않는다.

## 7. 미래 파일별 최소 책임

| 파일 | 최소 책임 | 포함하면 안 되는 것 |
|---|---|---|
| `Dockerfile` | pinned-at-build approved Node LTS candidate, same native builder/runtime platform, production dependency/build artifact, non-root user, `/data` declaration, application start | DB data, `.env`, secrets/PAT, host `node_modules` |
| `docker-compose.yml` | single `app` service, named `/data` volume, port/proxy boundary, runtime env references, restart/healthcheck | second app replica, database service, source DB bind mount 기본값 |
| `.dockerignore` | `.git`, `.env*`(단 `.env.example`은 필요 시 예외), `node_modules`, `.next`, DB/WAL/SHM, backups, logs, coverage/test output 제외 | required source, lockfile, migrations |
| `.env.example` | 위 환경변수 names와 Korean comment; secret injection 위치 안내 | 어떤 실제 secret, domain, password, token, production path value |

구현 시 package manager와 lockfile이 확정된 뒤 `npm ci`/동등 frozen install을 선택한다. 현재 repository에는 application package/lockfile 및 Docker files가 아직 없으므로 이 문서는 command를 확정하지 않는다.

## 8. Backup, restore, rollback

WAL DB는 DB 파일만 임의 copy하지 않는다. SQLite backup API는 concurrent 변경 중에도 consistent snapshot을 만들기 위한 공식 방법이다. [SQLite Backup API](https://www.sqlite.org/backup.html) application에 backup command가 생길 때까지 운영 절차는 scheduled maintenance window에서 app을 cleanly stop한 뒤 `/data` 전체(DB, `-wal`, `-shm`)를 atomic snapshot storage에 복사하는 방식이다.

- backup artifact는 image/volume 내부만의 단일 사본으로 두지 않고, access-controlled durable storage에 encryption-at-rest와 retention 정책을 적용한다.
- restore는 새/격리된 `/data` volume에 backup을 복원하고, image와 동일 UID:GID 및 DB access를 확인한 뒤 application을 single instance로 시작한다.
- schema migration rollback은 DB file를 직접 역방향 편집하지 않는다. deploy 전 compatible backup을 확인하고, failed migration은 application을 ready로 만들지 않는다. restore rehearsal 성공 전 destructive migration release를 승인하지 않는다.
- upgrade/restore/rehearsal 시 DB, WAL, SHM, migration ledger, representative project read/write, export URL, restart persistence를 모두 검사한다.

## 9. 구현 전/후 검증 계획

다음은 계획이며 아직 실행 결과가 아니다.

- selected Node LTS/Next.js compatibility와 lockfile integrity 검증
- `linux/amd64` 및 실제 배포 architecture에서 clean image build; prebuilt/source-build 각각 native `require`, `SELECT 1`, migration smoke test
- `docker compose up` 후 live와 ready가 각각 계약대로 동작하는지, migration failure가 ready 503/exit로 나타나는지 검증
- non-root UID로 fresh named volume과 pre-provisioned bind mount 모두 DB/WAL/SHM 생성 및 write 가능한지 검증
- container restart 뒤 project/task data와 WAL transaction durability가 남는지 검증
- named volume을 제거하지 않은 image upgrade, failed migration, previous image rollback을 isolated copy에서 검증
- backup 생성→new volume restore→integrity check→representative read/write→restart의 restore rehearsal
- `APP_BASE_URL` invalid/non-HTTPS/userinfo/path/query 입력 거부와 Excel/project direct link가 canonical HTTPS URL만 쓰는지 검증
- image history/build context/log output에서 `.env`, password, session token, PAT, SQLite data가 없는지 검증

## 10. Deployment owner 결정과 실제 위험

**Deployment owner 결정 필요**

- canonical public HTTPS hostname 및 reverse proxy/TLS certificate 운영자
- production Node LTS 후보(Node 24 또는 당시 지원 Node 22)의 최종 선택과 image digest pin/update policy
- CPU architecture, named volume 또는 host bind mount 선택, bind mount의 numeric UID:GID provisioning 책임
- backup destination, encryption, retention, RPO/RTO, restore 승인자와 rehearsal cadence
- public project read model이 조직의 기밀성 요구에 적합한지; 부적합하면 proxy/SSO read authorization 추가
- resource limits와 healthcheck timing(실측 후)

**실제 위험**

- SQLite single-writer와 volume file locking 때문에 horizontal scale 또는 network storage를 이 설계에 추가하면 데이터 손상/lock risk가 생긴다.
- native module은 Node ABI, libc, architecture mismatch 시 container startup에서 실패할 수 있으므로 builder/runtime parity 검증이 release gate다.
- named volume은 Docker host 장애/삭제로부터 보호하지 못한다. off-host tested backup과 restore rehearsal이 없으면 persistence 요구를 충족하지 못한다.
- `APP_BASE_URL` 또는 trusted proxy 설정 오류는 잘못된 export link, insecure cookie, host-header 기반 URL 문제를 만들 수 있다.
