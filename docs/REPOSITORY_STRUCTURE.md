# Repository Structure

관련 이슈: #12 (배포 파일), #13 (테스트 설정). 기준 main: `cb51b2a8dc`.

## 기본 원칙

루트에는 프로젝트 진입 문서와 npm/Next.js/TypeScript/PostCSS/ESLint의 기본 탐색 설정을 유지한다. 배포 구현은 `deploy/`, 애플리케이션은 `src/`, SQL migration은 `db/`, 테스트는 `tests/`에 둔다. `.github/`와 `.codex/` 위치는 바꾸지 않는다. 실제 `.env`, SQLite/WAL/SHM, 백업과 실행 산출물은 Git과 이미지에 포함하지 않는다.

## 배포 경로 변경표

| 이전 경로 | 현재 경로 | 비고 |
| --- | --- | --- |
| `Dockerfile` | `deploy/docker/Dockerfile` | 빌드 컨텍스트는 저장소 루트 |
| `docker-compose.yml` | `deploy/compose.yml` | `context: ..`, Dockerfile 경로는 컨텍스트 기준 |
| `scripts/container-entrypoint.sh` | `deploy/docker/container-entrypoint.sh` | 내용과 100755 실행 비트 유지 |

루트 `.dockerignore`는 유지한다. 컨테이너 내부 `/app`, `/data`, `/usr/local/bin/container-entrypoint`, migration CLI 경로와 named volume 계약은 변경하지 않는다. 런타임 버전·digest·패키지·인증 정책은 이 파일 이동의 변경 대상이 아니다.

## 유지하는 루트 파일

`README.md`, `AGENTS.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`, `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `.env.example`, `.gitignore`, `.dockerignore`는 루트 진입점이다. 테스트 설정 2개는 #13의 별도 변경으로 `tests/config/`에 모으며, 그 단계가 반영되기 전에는 기존 루트 설정을 사용한다. 앱 소스·DB·기타 scripts의 위치는 유지한다.

## Compose 운영 명령과 기존 배포 전환

모든 명령은 저장소 루트에서 실행한다. 실제 `.env`를 새로 덮어쓰지 않는다. `.env.example`의 `COMPOSE_PROJECT_NAME=mastergantt`는 **신규 설치 예시**이며 기존 설치는 실행 중인 컨테이너의 `com.docker.compose.project` label 값을 그대로 사용한다.

```sh
# 변경 전 실행 중인 프로젝트/컨테이너/volume을 읽기 전용으로 확인한다.
docker compose ls
docker ps --filter label=com.docker.compose.service=app --format '{{.ID}} {{.Names}} {{.Label "com.docker.compose.project"}}'
# 다음 CONTAINER_ID는 위에서 확인한 해당 앱 ID로 바꾼다.
docker inspect CONTAINER_ID --format '{{index .Config.Labels "com.docker.compose.project"}}'
docker inspect CONTAINER_ID --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}'
```

확인한 기존 프로젝트명은 `.env`의 `COMPOSE_PROJECT_NAME`, 기존 `/data` 볼륨명은 `MASTERGANTT_VOLUME_NAME`에 지정한다. Compose 파일은 프로젝트명을 미설정하면 오류로 중단하여 디렉터리 이름 `deploy`로 새 프로젝트가 생기지 않게 한다. override 파일·자동화 명령에 남은 옛 경로도 함께 수정한다.

```sh
docker compose --env-file .env -f deploy/compose.yml config --quiet
docker compose --env-file .env -f deploy/compose.yml ps
# 운영 변경 승인과 일관된 DB 백업, 기존 프로젝트/volume 일치 확인 후 적용한다.
docker compose --env-file .env -f deploy/compose.yml up -d --build app
# 같은 프로젝트의 기존 volume을 유지한다. 환경 변수는 recreate 때 반영한다.
docker compose --env-file .env -f deploy/compose.yml logs --tail 50 app
```

프로젝트명이나 볼륨명이 다르면 실행하지 않는다. 같은 SQLite volume을 쓰는 두 번째 앱을 띄우지 않는다. 운영에서는 `down -v`를 실행하지 않으며 파일 이동 때문에 데이터베이스를 이동하거나 초기화하지 않는다. GHCR 이미지를 직접 사용하는 운영 절차는 [DEPLOYMENT](DEPLOYMENT.md)의 별도 image/digest 정책을 따른다. Windows PowerShell도 루트에서 동일한 `--env-file`/`-f` 옵션을 사용한다. 실제 Windows/WSL2/프록시 검증은 GitHub Linux 결과와 구분한다.

직접 빌드할 때에도 컨텍스트를 줄이지 않는다.

```sh
docker build -f deploy/docker/Dockerfile -t mastergantt:local .
```

## 실행 검증

기존 GitHub Actions quality/E2E/docker gate를 유지한다. Docker gate에서 `scripts/verify-compose-smoke.sh`가 새 Compose 파일의 해석, 앱 기동, restart, 강제 recreate, 같은 SQLite volume의 데이터 보존을 검증한다. 이 스크립트는 GitHub Actions의 고유 run/attempt 이름으로 새 격리 리소스만 만들고 정리하며 운영에서 실행하지 않는다. `tests/scripts/deployment-layout.test.ts`는 배치·실행 비트·컨텍스트·CI/Dependabot 참조·ignore 경계를 검사한다. CI 결과는 PR의 head SHA/run/job으로 기록하며 이 문서가 존재한다고 PASS는 아니다.

## 제외 및 후속

#8의 production HTTP opt-in, Node 버전 정합성, `next-env.d.ts` 추적 정책, scripts 세분화, 실제 데이터/백업 이동은 별도 변경이다. 과거 Wxx 검증 기록의 경로는 당시 기록이며 새 구조의 검증 결과로 바꾸지 않는다. 현재 실행 경로는 이 문서와 구현을 기준으로 한다.

## 공식 근거

- [Compose build 경로](https://docs.docker.com/reference/compose-file/build/)
- [Compose project name](https://docs.docker.com/compose/how-tos/project-name/)
- [Docker build context와 ignore](https://docs.docker.com/build/building/context/)
