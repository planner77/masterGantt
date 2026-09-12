# Deployment

## 1. 상태와 범위

이 문서는 단일 SQLite 운영 환경의 배포·CI/CD 계약이다. W01에서 `.env.example`과 liveness route를, W02에서 SQLite 연결·SQL migration runner와 `npm run db:migrate`를 추가했고, CI/CD 단계에서 `Dockerfile`, `docker-compose.yml`, `.dockerignore`, non-root startup migration 및 GitHub Actions를 구현했다. container healthcheck는 migration·SQLite·foreign key·migration ledger를 검증하는 readiness endpoint를 사용한다.

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

- Reverse proxy는 TLS 종료, public hostname 전달, HTTP→HTTPS redirect를 담당한다. application은 proxy가 신뢰된 배포 경계에 있을 때만 forwarded header를 신뢰한다.
- SQLite 파일과 WAL/SHM sidecar는 image나 source bind mount가 아닌 `/data` persistent volume에만 둔다. Docker named volume은 container engine이 관리하는 persistent data store이며 Compose가 service에 명시적으로 mount한다. [Docker Compose volumes](https://docs.docker.com/reference/compose-file/volumes/)
- 한 DB volume을 여러 application container가 공유하지 않는다. SQLite WAL은 같은 host의 shared-memory 사용과 sidecar 파일을 전제하므로 network filesystem이나 replica 확장은 별도 적합성 검토 및 DB 전환 결정이 필요하다. [SQLite WAL](https://www.sqlite.org/wal.html)
- service는 `restart: unless-stopped` 후보를 사용한다. 자동 restart는 장애 원인을 해결하지 않으므로 health/log/backup 관측과 함께 사용한다.

## 3. Node, Next.js, native module 원칙

### 지원 버전 선택

현재 공식 Node release 표에서 Node 24는 LTS이며, production application에는 Active 또는 Maintenance LTS만 사용하도록 권고한다. [Node.js releases](https://nodejs.org/en/about/previous-releases) Next.js 최신 설치 문서는 최소 Node `20.9`를 요구한다. [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)

W20 container baseline은 lockfile/native module 검증을 통과한 **Node 22 Bookworm image를 digest로 고정**했다. Node 24 전환은 Action/base image update와 마찬가지로 별도 변경에서 clean build, native SQLite 및 restart persistence를 다시 검증한다.

| 후보 | 채택 조건 | 제외 조건 |
|---|---|---|
| Node 22 LTS | W20의 builder/runtime baseline; pinned Bookworm digest와 `linux/amd64` native/runtime smoke 통과 | 지원 종료 또는 reviewed upgrade 완료 |
| Node 24 LTS | 후속 upgrade 후보; lockfile install, Next build, native SQLite와 container persistence 재검증 필요 | ABI 또는 dependency 호환 실패 |

이미지 구현 담당자는 build 직전에 Node 공식 release 상태, project lockfile, Next.js release requirement를 확인하고, 선택한 **동일 Node major와 동일 Linux distribution family/libc 및 target architecture**를 builder와 runtime에 사용한다. multi-stage build는 final image에 build tool을 남기지 않고 필요한 artifact만 copy할 수 있다. [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)

### `better-sqlite3` 호환성

W02에 설치한 `better-sqlite3` 13.0.3은 Node >=22와 bundled prebuilds를 사용하는 artifact다. 현재 Linux x64 / Node 22.14.0에서 native query를 확인했다. Package 설치·source build 절차는 버전별 manifest에 맞춰 검토해야 한다. [better-sqlite3 README](https://github.com/WiseLibs/better-sqlite3), [설치 검증](RESEARCH.md) Next.js는 `better-sqlite3`를 server external package로 자동 처리하는 목록에 포함한다. [serverExternalPackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages)

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
| `APP_BASE_URL` | 예 | canonical public `https` origin; trailing slash/path/query/fragment/userinfo 금지 |
| `TRUST_PROXY` | 예약 | 현재 미사용. W16에서 trusted TLS reverse proxy 경계와 함께 활성화 여부 결정 |
| `SESSION_COOKIE_SECURE` | 예약 | 현재 미사용. Cookie Secure는 `NODE_ENV`와 `APP_BASE_URL`에서 강제 |
| `LOG_LEVEL` | 예약 | 현재 미사용. 도입 시 password, session, Cookie, authorization header, DB record를 log하지 않음 |

`APP_BASE_URL`은 URL parser로 검증한다. protocol은 정확히 `https:`, hostname은 deployment owner가 승인한 canonical public host, port는 HTTPS default 또는 승인한 명시 port만 허용하며 URL origin과 입력이 동일해야 한다. 이 값으로만 `${APP_BASE_URL}/projects/${public_id}`를 만들고, request `Host`/forwarded host나 user input으로 export hyperlink를 만들지 않는다. public ID는 secret이 아니며 URL에 password/session을 넣지 않는다.

## 7. 구현 파일별 최소 책임

| 파일 | 최소 책임 | 포함하면 안 되는 것 |
|---|---|---|
| `Dockerfile` | pinned-at-build approved Node LTS candidate, same native builder/runtime platform, production dependency/build artifact, non-root user, `/data` declaration, application start | DB data, `.env`, secrets/PAT, host `node_modules` |
| `docker-compose.yml` | single `app` service, named `/data` volume, port/proxy boundary, runtime env references, restart/healthcheck | second app replica, database service, source DB bind mount 기본값 |
| `.dockerignore` | `.git`, 모든 `.env*`, `node_modules`, `.next`, DB/WAL/SHM, backups, logs, coverage/test output 제외 | required source, lockfile, migrations |
| `.env.example` | 환경변수 names와 개발용 예시; secret injection 위치 안내 | 실제 secret, 운영 domain, password, token |

Application package와 lockfile은 존재하며 frozen install은 `npm ci`, 빌드는 `npm run build`, migration CLI는 `npm run db:migrate`다. CLI는 repository root에서 실행하며 환경변수를 명시적으로 주입한다. `tsx`는 CLI 실행에 필요한 runtime dependency다. 현재 image는 `db/migrations`, `scripts/migrate.ts`, 필요한 DB core와 CLI dependency를 포함하며 entrypoint가 Next.js 시작 전에 migration gate를 실행한다.

## 8. Backup, restore, rollback

WAL DB는 DB 파일만 임의 copy하지 않는다. SQLite backup API는 concurrent 변경 중에도 consistent snapshot을 만들기 위한 공식 방법이다. [SQLite Backup API](https://www.sqlite.org/backup.html) application에 backup command가 생길 때까지 운영 절차는 scheduled maintenance window에서 app을 cleanly stop한 뒤 `/data` 전체(DB, `-wal`, `-shm`)를 atomic snapshot storage에 복사하는 방식이다.

- backup artifact는 image/volume 내부만의 단일 사본으로 두지 않고, access-controlled durable storage에 encryption-at-rest와 retention 정책을 적용한다.
- restore는 새/격리된 `/data` volume에 backup을 복원하고, image와 동일 UID:GID 및 DB access를 확인한 뒤 application을 single instance로 시작한다.
- schema migration rollback은 DB file를 직접 역방향 편집하지 않는다. deploy 전 compatible backup을 확인하고, failed migration은 application을 ready로 만들지 않는다. restore rehearsal 성공 전 destructive migration release를 승인하지 않는다.
- upgrade/restore/rehearsal 시 DB, WAL, SHM, migration ledger, representative project read/write, export URL, restart persistence를 모두 검사한다.

## 9. 검증 결과와 남은 운영 검증

W20 로컬 `linux/amd64` 검증은 다음을 PASS했다.

- frozen lockfile 설치, production build, Node 22 Bookworm digest 기반 clean multi-stage image build
- UID/GID 1001 non-root runtime과 image 내 `.env*`·`.git`·SQLite·test artifact 부재 정책
- missing/insecure production `APP_BASE_URL`의 migration 전 exit 1과 readiness fail-closed
- startup migration 뒤 live/readiness, `better-sqlite3` native `SELECT 1`·write
- 격리 named volume의 container restart 뒤 representative SQLite row 영속성
- Compose configuration, Action workflow lint, strict SemVer/package-lock 일치와 version validator 회귀 테스트

아래 항목은 W16 또는 첫 원격 release에서 아직 수행해야 한다.

- GitHub-hosted Actions 전체 run, GHCR publish·attestation·digest pull smoke
- 실제 배포 architecture가 `linux/amd64`와 다를 경우 해당 platform의 clean native build/runtime 검증
- pre-provisioned host bind mount의 numeric UID:GID와 DB/WAL/SHM write 검증
- named volume을 유지한 image upgrade, failed migration과 previous image rollback을 isolated copy에서 검증
- backup 생성→new volume restore→integrity check→representative read/write→restart restore rehearsal
- 실제 reverse proxy/TLS 환경의 canonical URL, secure Cookie와 healthcheck timing 검증

## 10. Deployment owner 결정과 실제 위험

**Deployment owner 결정 필요**

- canonical public HTTPS hostname 및 reverse proxy/TLS certificate 운영자
- pinned Node 22 baseline의 유지 기간과 Node 24 upgrade 승인 시점
- CPU architecture, named volume 또는 host bind mount 선택, bind mount의 numeric UID:GID provisioning 책임
- backup destination, encryption, retention, RPO/RTO, restore 승인자와 rehearsal cadence
- public project read model이 조직의 기밀성 요구에 적합한지; 부적합하면 proxy/SSO read authorization 추가
- resource limits와 healthcheck timing(실측 후)

**실제 위험**

- SQLite single-writer와 volume file locking 때문에 horizontal scale 또는 network storage를 이 설계에 추가하면 데이터 손상/lock risk가 생긴다.
- native module은 Node ABI, libc, architecture mismatch 시 container startup에서 실패할 수 있으므로 builder/runtime parity 검증이 release gate다.
- named volume은 Docker host 장애/삭제로부터 보호하지 못한다. off-host tested backup과 restore rehearsal이 없으면 persistence 요구를 충족하지 못한다.
- `APP_BASE_URL` 또는 trusted proxy 설정 오류는 잘못된 export link, insecure cookie, host-header 기반 URL 문제를 만들 수 있다.

## 11. CI/CD와 SemVer release (현재 구현)

### CI로 대체한 반복 검증

GitHub Actions [CI workflow](../.github/workflows/ci.yml)는 PR, `main` push와 수동 실행에서 아래를 자동으로 수행한다.

1. Node 22 dependency cache를 복원한 뒤 `npm ci`와 package/lock SemVer 일치 검사를 실행한다.
2. `typecheck`, `lint`, Vitest, production `build`를 실행한다.
3. 별도 Chromium job에서 Playwright browser와 OS dependency를 설치하고 E2E를 실행한다. 실패 시에만 report artifact를 7일 보관한다.
4. Docker image를 빌드하고, non-root image가 migration을 적용한 뒤 readiness를 응답하는지, native SQLite write가 restart 후에도 남는지 smoke test를 실행한다.

PR과 수동 CI token은 `contents: read`뿐이며 모든 checkout은 `persist-credentials: false`로 token을 작업 디렉터리에 남기지 않는다. ref별 concurrency는 오래된 PR/main 검증을 취소한다. 성공한 `main` push의 commit publish job과 SemVer release publish job만 별도 최소 package write 권한을 가진다. Docker Buildx cache와 Node dependency cache는 GitHub Actions cache일 뿐 release artifact나 secret을 포함하지 않는다.

### Main commit 테스트 image

`main` push의 application, Chromium과 local container job이 모두 성공하면 `.github/workflows/ci.yml`의 publish job이 `ghcr.io/planner77/mastergantt:ci-<full SHA>`를 한 번만 게시한다. 기존 commit tag가 있으면 overwrite하지 않는다. PR과 수동 CI는 image를 게시하지 않는다.

Workflow는 build output digest를 다시 pull해 image policy와 readiness를 확인하고, 실제 HTTP API로 Project를 생성해 edit session을 받은 뒤 root Task를 저장한다. Session 없는 mutation 거부를 확인하고 container를 restart한 후 동일 Project와 Task가 남는지 재조회한다. 이 검증은 격리 volume에서 수행하며 사용자 data를 사용하지 않는다. Workflow summary의 exact digest가 사용자·통합 테스트 입력이다.

```sh
docker pull ghcr.io/planner77/mastergantt@sha256:<commit-image-digest>
```

Commit image는 release가 아니며 `latest`, major/minor 또는 SemVer exact tag를 만들지 않는다. 아래 release workflow는 별도 `sha-<full SHA>` candidate를 사용한다.

### 안정 SemVer와 GHCR publish

릴리스 기준은 `package.json.version`과 `package-lock.json` root version에 정확히 일치하는 SemVer tag다. 현재 package version `0.4.0`의 tag는 `v0.4.0`이며 prerelease 예시는 `v0.5.0-rc.1`이다. build metadata(`+...`)는 허용하지 않는다.

```sh
node scripts/verify-release-version.mjs v0.4.0
git tag -a v0.4.0 -m "Release v0.4.0"
git push origin v0.4.0
```

tag push는 [release image workflow](../.github/workflows/release-image.yml)를 실행한다. workflow는 이전 tag보다 큰 version과 annotated tag를 확인하고 전체 quality gate 및 동일 release 설정의 local candidate runtime smoke를 통과한 뒤에만 ephemeral `GITHUB_TOKEN`으로 lowercase GHCR의 immutable `sha-<full-commit>` candidate를 push한다. Registry digest smoke와, 활성화된 경우 GitHub Attestation이 성공한 뒤 stable release의 `major.minor`, `major`, `latest`를 이동하고 exact version을 마지막 완료 표식으로 생성한다. Prerelease는 exact/commit tag만 받는다. Repository 단위 직렬화와 monotonic gate가 낮은 version의 alias rollback을 막으며 기존 exact/commit image는 overwrite하지 않는다. tag workflow의 권한은 `contents: read`, `packages: write`, optional attestation/OIDC에 필요한 `attestations: write` 및 `id-token: write`로 한정된다. Release run은 취소하지 않는다.

BuildKit SBOM/provenance는 항상 publish한다. GitHub Artifact Attestation은 private repository에서 Enterprise Cloud가 필요하므로 `ENABLE_GITHUB_ATTESTATIONS=true`인 지원 환경에서만 실행한다. Push 결과 digest를 다시 pull하여 실제 GHCR image가 migration/readiness와 HTTP Project/Task authorization·restart persistence smoke를 통과하는지도 확인한다. [GitHub Docs](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images), [GitHub Attestation 지원 조건](https://docs.github.com/en/enterprise-cloud@latest/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations), [Docker Docs](https://docs.docker.com/build/ci/github-actions/attestations/)를 따른다. 모든 third-party action은 review 가능한 full commit SHA로 pin하며, [Dependabot](../.github/dependabot.yml)가 주간 update PR을 제안한다.

GHCR package visibility는 D04에 따라 private으로 설정하고 첫 성공 publish 뒤 실제 visibility와 repository linkage를 확인한다. private package의 소비자는 필요한 대상에만 최소 `read:packages` 권한을 가진 별도 token으로 authenticate해야 하며, token을 image, Compose, app `.env` 또는 workflow source에 넣으면 안 된다.

### 사용자 테스트 image 실행

고정 tag 또는 workflow가 표시한 immutable digest를 우선한다. 테스트 data가 운영 data와 섞이지 않도록 별도 volume을 사용한다.

```sh
docker pull ghcr.io/planner77/mastergantt:0.4.0
docker run --detach --name mastergantt-test \
  --publish 127.0.0.1:3000:3000 \
  --volume mastergantt-test-data:/data \
  --env APP_BASE_URL=https://gantt-test.company.local \
  --env SESSION_COOKIE_SECURE=true \
  ghcr.io/planner77/mastergantt:0.4.0
curl -fsS http://127.0.0.1:3000/api/health/ready
```

Compose run은 `APP_BASE_URL`를 shell 또는 access-controlled Compose environment file로 제공해야 하며, default port는 loopback만 publish한다.

```sh
export APP_BASE_URL=https://gantt.company.local
docker compose up --build -d
docker compose restart
docker compose ps
```

`docker compose down`은 named volume을 삭제하지 않아 restart/replace 뒤 data가 남는다. `docker volume rm mastergantt-data`는 backup 확인 전 실행하면 안 되는 destructive operation이다. Host bind mount를 택하면 사전에 UID:GID `1001:1001`이 쓸 수 있게 준비한다.

### 현재 한계와 release owner 확인 사항

- Healthcheck는 readiness API로 canonical runtime URL/path, migration, SQLite query, foreign key 및 latest migration ledger를 확인한다. HTTP process만 별도로 확인할 때는 `/api/health/live`를 사용한다.
- native addon과 CPU architecture를 실제로 검증하기 전에는 multi-architecture manifest를 publish하지 않는다.
- Docker named volume은 off-host backup을 대체하지 않는다. WAL 중 main DB 파일만 copy하지 말고 clean stop 후 `/data` 전체를 backup하고 fresh volume restore rehearsal을 수행한다.
- GHCR `mastergantt` package는 private이며 `planner77/masterGantt` repository와 연결된 것을 API 200으로 확인했다. Downstream consumer는 최소 `packages: read`를 유지한다.
- Private repository의 main/tag ruleset은 현재 plan의 API 403으로 미강제다. D05에서 사용자가 이 위험을 명시적으로 수용했으며 보호 적용을 PASS로 표시하지 않는다. 지정 maintainer와 문서화된 release 절차를 운영 통제로 유지한다.
- D05에 따라 Private GitHub Artifact Attestation은 비활성으로 두고 `ENABLE_GITHUB_ATTESTATIONS`를 설정하지 않는다. BuildKit SBOM/provenance는 모든 publish에서 필수다.
- release owner는 canonical hostname, TLS reverse proxy, backup destination/retention 및 action SHA pin maintenance policy를 결정한다.
- Main commit workflow와 GHCR `ci-<SHA>` publish/digest pull, `v0.4.0` release publish/digest pull은 원격·로컬 PASS했다. 양쪽 BuildKit SPDX 2.3 SBOM과 SLSA provenance도 registry에서 조회했다.
