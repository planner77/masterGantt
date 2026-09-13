"""Apply the approved two-phase layout change on work branches only.

This bootstrap is removed before the first deliverable commit. It never writes
main, repository settings, tags, secrets, application data, or dependency pins.
"""
import urllib.error
import urllib.request
import hashlib
import json
import os
from pathlib import Path
import posixpath
import re
import subprocess
import tomllib

ROOT = Path(__file__).resolve().parents[1]
BASE = "cb51b2a8dcbaa39a37615b7891a9a62f59e60af1"
REPO = "planner77/masterGantt"
BRANCH_A = "chore/reorganize-deployment"
BRANCH_B = "chore/reorganize-test-config"
BOOTSTRAP = ["scripts/reorganize-once.py", ".github/workflows/reorganize-once.yml"]


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def run(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace(path, old, new, count=None):
    text = read(path)
    actual = text.count(old)
    require(actual > 0 and (count is None or actual == count), f"Unexpected source in {path}: expected {count}, got {actual}")
    write(path, text.replace(old, new))


def move(old, new):
    require((ROOT / old).is_file() and not (ROOT / new).exists(), f"Unexpected move state: {old}")
    (ROOT / new).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / old).rename(ROOT / new)


def append(path, content):
    write(path, read(path).rstrip() + "\n\n" + content.strip() + "\n")


def blob_sha(path):
    data = (ROOT / path).read_bytes()
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def update_links(path, mapping):
    def link(match):
        target = match[2]
        if re.match(r"(?:[a-zA-Z][a-zA-Z0-9+.-]*:|#|/)", target):
            return match[0]
        destination, separator, anchor = target.partition("#")
        resolved = posixpath.normpath(posixpath.join(posixpath.dirname(path), destination))
        if resolved not in mapping:
            return match[0]
        relative = posixpath.relpath(mapping[resolved], posixpath.dirname(path) or ".")
        return match[1] + relative + (separator + anchor if separator else "") + match[3]
    write(path, re.sub(r"(\[[^\]\n]*\]\()([^\s)]+)(\))", link, read(path)))


def update_tokens(path, mapping):
    text = read(path)
    for old, new in mapping.items():
        # Exclude URLs, already relocated paths, and larger identifiers.
        text = re.sub(r"(?<![\w./-])" + re.escape(old) + r"(?![\w./-])", new, text)
    write(path, text)


def add_agent_note(path, note):
    text = read(path)
    position = text.rfind('"""')
    require(position >= 0, f"Expected agent instruction block: {path}")
    updated = text[:position].rstrip() + "\n\n" + note + "\n" + text[position:]
    tomllib.loads(updated)
    write(path, updated)


COMPOSE_SMOKE = r'''#!/usr/bin/env bash
set -euo pipefail

# CI 전용. 기존 운영 프로젝트/볼륨 이름을 입력받지 않으며 새 격리 리소스만 제거한다.
[[ "${CI:-}" == "true" && "${GITHUB_ACTIONS:-}" == "true" ]]
[[ "${GITHUB_REPOSITORY:-}" == "planner77/masterGantt" ]]
[[ "${GITHUB_RUN_ID:-}" =~ ^[0-9]+$ && "${GITHUB_RUN_ATTEMPT:-}" =~ ^[0-9]+$ ]]
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
export COMPOSE_PROJECT_NAME="mastergantt-layout-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
export MASTERGANTT_VOLUME_NAME="${COMPOSE_PROJECT_NAME}-data"
export IMAGE_NAME="mastergantt:ci"
export IMAGE_VERSION="layout-ci"
export APP_BASE_URL="https://gantt.example.invalid"
export HOST_PORT="0"
export TRUST_PROXY="false"
export LOG_LEVEL="info"
owned=false

dc() { docker compose --env-file /dev/null -f "$root/deploy/compose.yml" "$@"; }
cleanup() {
  status=$?
  trap - EXIT
  if [[ "$owned" == true ]]; then
    if [[ "$status" != 0 ]]; then dc logs --no-color --tail 40 app || true; fi
    # 이 run이 새로 만든 격리 프로젝트의 볼륨만 정리한다.
    if ! dc down --volumes; then status=1; fi
  fi
  rm -rf "$tmp"
  exit "$status"
}
trap cleanup EXIT

docker info >/dev/null
if docker volume inspect "$MASTERGANTT_VOLUME_NAME" >/dev/null 2>&1; then
  echo "Refusing to reuse an existing smoke-test volume." >&2
  exit 1
fi
[[ -z "$(dc ps --all --quiet)" ]]
dc config --format json > "$tmp/compose.json"
python3 - "$tmp/compose.json" "$root" <<'PY_CONFIG'
import json, os, pathlib, sys
config = json.loads(pathlib.Path(sys.argv[1]).read_text())
root = pathlib.Path(sys.argv[2]).resolve()
assert config['name'] == os.environ['COMPOSE_PROJECT_NAME']
assert set(config['services']) == {'app'}
app = config['services']['app']
assert pathlib.Path(app['build']['context']).resolve() == root
assert app['build']['dockerfile'] == 'deploy/docker/Dockerfile'
assert (root / app['build']['dockerfile']).is_file()
assert app['build']['args']['VERSION'] == 'layout-ci'
assert app['image'] == 'mastergantt:ci'
assert app['restart'] == 'unless-stopped'
assert app['environment']['NODE_ENV'] == 'production'
assert app['environment']['DATABASE_PATH'] == '/data/mastergantt.sqlite3'
assert app['environment']['APP_BASE_URL'] == os.environ['APP_BASE_URL']
assert str(app['environment']['PORT']) == '3000'
assert str(app['environment']['SESSION_COOKIE_SECURE']).lower() == 'true'
assert len(app['ports']) == 1
assert app['ports'][0]['host_ip'] == '127.0.0.1'
assert app['ports'][0]['target'] == 3000
assert str(app['ports'][0]['published']) == '0'
assert len(app['volumes']) == 1
assert app['volumes'][0]['type'] == 'volume'
assert app['volumes'][0]['target'] == '/data'
assert config['volumes'][app['volumes'][0]['source']]['name'] == os.environ['MASTERGANTT_VOLUME_NAME']
assert '/api/health/ready' in ' '.join(app['healthcheck']['test'])
print('Compose configuration contract: PASS')
PY_CONFIG

owned=true
dc up --detach --no-build --pull never --wait --wait-timeout 90 app
wait_ready() {
  local published
  published="$(dc port app 3000)"
  [[ "$published" =~ ^127\.0\.0\.1:[0-9]+$ ]]
  for _ in $(seq 1 60); do
    if curl --fail --silent "http://$published/api/health/ready" >/dev/null; then return; fi
    sleep 1
  done
  return 1
}
volume_name() {
  docker inspect "$1" --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}'
}
verify_row() {
  dc exec -T app node -e "const D=require('better-sqlite3'); const d=new D(process.env.DATABASE_PATH,{readonly:true}); const r=d.prepare('SELECT COUNT(*) AS n FROM layout_smoke WHERE value=?').get('preserved'); d.close(); if(r.n!==1) process.exit(1)"
}
wait_ready
before="$(dc ps --quiet app)"
[[ -n "$before" && "$(volume_name "$before")" == "$MASTERGANTT_VOLUME_NAME" ]]
dc exec -T app node -e "const D=require('better-sqlite3'); const d=new D(process.env.DATABASE_PATH); d.exec('CREATE TABLE layout_smoke (value TEXT NOT NULL)'); d.prepare('INSERT INTO layout_smoke(value) VALUES (?)').run('preserved'); d.close()"
dc restart app
wait_ready
verify_row
dc up --detach --no-build --pull never --force-recreate --wait --wait-timeout 90 app
wait_ready
after="$(dc ps --quiet app)"
[[ -n "$after" && "$after" != "$before" ]]
[[ "$(volume_name "$after")" == "$MASTERGANTT_VOLUME_NAME" ]]
verify_row
echo 'Compose startup, restart, forced recreation and SQLite volume persistence: PASS'
'''

DEPLOYMENT_TEST = r'''import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const text = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("deployment repository layout", () => {
  it("keeps deployment files together and removes the old entry points", () => {
    for (const path of ["deploy/docker/Dockerfile", "deploy/compose.yml", "deploy/docker/container-entrypoint.sh"]) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
    for (const path of ["Dockerfile", "docker-compose.yml", "scripts/container-entrypoint.sh"]) {
      expect(existsSync(resolve(root, path)), path).toBe(false);
    }
  });

  it("preserves the entrypoint bytes and executable mode", () => {
    const path = resolve(root, "deploy/docker/container-entrypoint.sh");
    const bytes = readFileSync(path);
    const sha = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    expect(sha).toBe("9492419ffdce7295132a41b6a66210032d9f1400");
    if (process.platform !== "win32") expect(statSync(path).mode & 0o111).not.toBe(0);
  });

  it("preserves runtime paths and pins while relocating the Dockerfile", () => {
    const dockerfile = text("deploy/docker/Dockerfile");
    expect(dockerfile).toContain("deploy/docker/container-entrypoint.sh /usr/local/bin/container-entrypoint");
    expect(dockerfile).toContain('ENTRYPOINT ["/usr/local/bin/container-entrypoint"]');
    expect(dockerfile).toContain('VOLUME ["/data"]');
    expect(dockerfile).toContain("USER mastergantt");
    const bases = Array.from(dockerfile.matchAll(/^FROM (node:\S+@sha256:[a-f0-9]{64}) /gm), ([, base]) => base);
    expect(bases).toHaveLength(2);
    expect(new Set(bases).size).toBe(1);
  });

  it("uses the root context and explicit project/volume identity", () => {
    const compose = text("deploy/compose.yml");
    expect(compose).toContain("name: ${COMPOSE_PROJECT_NAME:?");
    expect(compose).toContain("context: ..");
    expect(compose).toContain("dockerfile: deploy/docker/Dockerfile");
    expect(compose).toContain("127.0.0.1:${HOST_PORT:-3000}:3000");
    expect(compose).toContain("name: ${MASTERGANTT_VOLUME_NAME:-mastergantt-data}");
  });

  it("updates all CI/release builds and the Docker dependency scan", () => {
    for (const file of [".github/workflows/ci.yml", ".github/workflows/release-image.yml"]) {
      expect(text(file).match(/context: \.\n\s+file: deploy\/docker\/Dockerfile/g), file).toHaveLength(2);
    }
    expect(text(".github/dependabot.yml")).toMatch(/package-ecosystem: docker\n\s+directory: \/deploy\/docker/);
    expect(text(".github/workflows/ci.yml")).toContain("bash scripts/verify-compose-smoke.sh");
  });

  it("keeps secret and test exclusions at the build context root", () => {
    const ignore = text(".dockerignore").split(/\r?\n/);
    for (const rule of [".env", ".env.*", ".git", "tests", "node_modules", "*.sqlite3", "*-wal", "*-shm"]) {
      expect(ignore).toContain(rule);
    }
    expect(existsSync(resolve(root, "deploy/docker/Dockerfile.dockerignore"))).toBe(false);
  });
});
'''

STRUCTURE_A = '''# Repository Structure

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
'''

VITEST_CONFIG = '''import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 설정 파일 위치에서 저장소 루트를 구한다. 실행 cwd에 의존하지 않는다.
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  root: repositoryRoot,
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
'''

DISCOVERY_SCRIPT = r'''import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
function files(directory, suffix) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path, suffix) : entry.name.endsWith(suffix) ? [path] : [];
  });
}
function execute(cwd, args) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.replace(/\x1b\[[0-9;]*m/g, "").trim();
}
const configDirectory = resolve(root, "tests/config");
const unitArgs = [resolve(root, "node_modules/vitest/vitest.mjs"), "list", "--config", resolve(configDirectory, "vitest.config.ts"), "--filesOnly"];
const browserArgs = [resolve(root, "node_modules/@playwright/test/cli.js"), "test", "--config", resolve(configDirectory, "playwright.config.ts"), "--list", "--reporter=list"];
const unitAtRoot = execute(root, unitArgs);
const unitOutside = execute(tmpdir(), unitArgs);
assert.equal(unitOutside, unitAtRoot, "Vitest discovery changed with cwd");
const unitFiles = files(resolve(root, "tests"), ".test.ts");
assert.ok(unitFiles.length >= 28);
for (const path of unitFiles) assert.ok(unitOutside.includes(path.slice(root.length)), `Missing unit file: ${path}`);
const browserAtRoot = execute(root, browserArgs);
const browserOutside = execute(tmpdir(), browserArgs);
assert.equal(browserOutside, browserAtRoot, "Playwright discovery changed with cwd");
for (const path of files(resolve(root, "tests/e2e"), ".spec.ts")) {
  assert.ok(browserOutside.includes(path.split(/[\\/]/).at(-1)), `Missing browser file: ${path}`);
}
const total = browserOutside.match(/Total: (\d+) tests? in (\d+) files?/);
assert.ok(total, "Missing Playwright discovery totals");
assert.ok(Number(total[1]) >= 10, "Browser coverage was reduced");
console.log(`Test discovery: PASS (${unitFiles.length} unit files; ${total[1]} browser tests; root and external cwd)`);
'''

TEST_CONFIG_TEST = r'''import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const text = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("test configuration repository layout", () => {
  it("uses one explicit configuration per test runner", () => {
    const scripts = JSON.parse(text("package.json")).scripts;
    expect(scripts.test).toBe("vitest run --config tests/config/vitest.config.ts");
    expect(scripts["test:e2e"]).toBe("playwright test --config tests/config/playwright.config.ts");
    for (const old of ["vitest.config.ts", "playwright.config.ts"]) expect(existsSync(resolve(root, old))).toBe(false);
  });
  it("anchors discovery and browser working paths at repository root", () => {
    const unit = text("tests/config/vitest.config.ts");
    const browser = text("tests/config/playwright.config.ts");
    for (const config of [unit, browser]) {
      expect(config).toContain('new URL("../../", import.meta.url)');
      expect(config).not.toContain("process.cwd()");
    }
    expect(unit).toContain('include: ["tests/**/*.test.ts"]');
    expect(browser).toContain('testDir: resolve(repositoryRoot, "tests/e2e")');
    expect(browser).toContain("cwd: repositoryRoot");
    expect(browser).toContain('outputDir: resolve(repositoryRoot, "test-results")');
    expect(browser).toContain('resolve(repositoryRoot, ".data", "playwright.sqlite3")');
  });
  it("preserves browser isolation and operator overrides", () => {
    const browser = text("tests/config/playwright.config.ts");
    for (const value of ["PLAYWRIGHT_BASE_URL", "PLAYWRIGHT_CHROMIUM_EXECUTABLE", 'NEXT_DIST_DIR: ".next-e2e"', "workers: 1", "fullyParallel: false", 'trace: "retain-on-failure"']) {
      expect(browser).toContain(value);
    }
  });
  it("runs cross-cwd discovery in CI and keeps configs out of images", () => {
    expect(text(".github/workflows/ci.yml")).toContain("node scripts/verify-test-discovery.mjs");
    expect(text(".dockerignore").split(/\r?\n/)).toContain("tests");
    expect(JSON.parse(text("tsconfig.json")).include).toContain("tests/**/*.ts");
  });
});
'''


def main():
    require(os.environ.get("GITHUB_REPOSITORY") == REPO, "Unexpected repository")
    require(os.environ.get("GITHUB_REF") == "refs/heads/" + BRANCH_A, "Unexpected work branch")
    require(os.environ.get("GITHUB_EVENT_NAME") == "push", "Only the approved bootstrap push is allowed")
    bootstrap_sha = run("git", "rev-parse", "HEAD")
    require(run("git", "rev-parse", "HEAD^") == BASE, "Base moved before bootstrap")
    require(run("git", "status", "--porcelain") == "", "Unclean checkout")
    require(set(run("git", "diff", "--name-only", BASE, "HEAD").splitlines()) == set(BOOTSTRAP), "Unexpected bootstrap changes")
    expected = {
        "Dockerfile": "4cbb495aa135281895a10b606feae47780e7ea03",
        "docker-compose.yml": "7f01375c0779194d5d9ccc1fafae8509b63ee946",
        "scripts/container-entrypoint.sh": "9492419ffdce7295132a41b6a66210032d9f1400",
        "playwright.config.ts": "4c07c7a3092350f5969f6b44cf93b073785e829f",
        "vitest.config.ts": "faa6d98e10c144e7c3f188d73dec3ff6daffcad4",
        ".github/workflows/ci.yml": "ca46bb257c53ce93dabfe2355b8d4406aff89746",
        ".github/workflows/release-image.yml": "efa90665bc999d7b1616ab9b03202bbe5538dd6e",
    }
    for path, sha in expected.items():
        require(blob_sha(path) == sha, f"Reviewed input changed: {path}")
    package_bytes = (ROOT / "package-lock.json").read_bytes()
    tracked = run("git", "ls-files").splitlines()
    original_source = {p: blob_sha(p) for p in tracked if p.startswith(("src/", "db/", "tests/e2e/"))}
    original_entrypoint = (ROOT / "scripts/container-entrypoint.sh").read_bytes()
    run("git", "config", "user.name", "github-actions[bot]")
    run("git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")

    deployment_moves = {
        "Dockerfile": "deploy/docker/Dockerfile",
        "docker-compose.yml": "deploy/compose.yml",
        "scripts/container-entrypoint.sh": "deploy/docker/container-entrypoint.sh",
    }
    for old, new in deployment_moves.items():
        move(old, new)
    replace("deploy/docker/Dockerfile", "scripts/container-entrypoint.sh /usr/local/bin/container-entrypoint", "deploy/docker/container-entrypoint.sh /usr/local/bin/container-entrypoint", 1)
    replace("deploy/compose.yml", "      context: .\n", "      context: ..\n      dockerfile: deploy/docker/Dockerfile\n", 1)
    write("deploy/compose.yml", "# 기존 배포는 실행 중인 Compose project 이름을 유지한다. 신규 설치 예시는 .env.example 참고.\nname: ${COMPOSE_PROJECT_NAME:?Set COMPOSE_PROJECT_NAME to the existing project name}\n\n" + read("deploy/compose.yml"))
    append(".env.example", "# Compose file moved to deploy/compose.yml; always pass --env-file .env explicitly.\n# 신규 설치 예시. 기존 배포는 현재 container의 com.docker.compose.project label 값으로 변경.\n# 같은 /data volume에 새 project의 두 번째 app을 띄우지 않는다.\nCOMPOSE_PROJECT_NAME=mastergantt")
    for path in [".github/workflows/ci.yml", ".github/workflows/release-image.yml"]:
        replace(path, "          context: .\n", "          context: .\n          file: deploy/docker/Dockerfile\n", 2)
    replace(".github/dependabot.yml", "  - package-ecosystem: docker\n    directory: /\n", "  - package-ecosystem: docker\n    directory: /deploy/docker\n", 1)
    replace(".github/workflows/ci.yml", "      - name: Show container logs on failure\n", "      - name: Verify relocated Compose configuration and persistence\n        run: bash scripts/verify-compose-smoke.sh\n      - name: Show container logs on failure\n", 1)
    replace(".github/workflows/ci.yml", "      - run: node scripts/check-markdown-links.mjs\n", "      - run: node scripts/check-markdown-links.mjs\n      - name: Verify deployment shell syntax\n        run: |\n          sh -n deploy/docker/container-entrypoint.sh\n          bash -n scripts/verify-compose-smoke.sh\n", 1)
    write("scripts/verify-compose-smoke.sh", COMPOSE_SMOKE)
    write("tests/scripts/deployment-layout.test.ts", DEPLOYMENT_TEST)

    active_docs = ["README.md", "AGENTS.md", "docs/ARCHITECTURE.md", "docs/REQUIREMENTS.md", "docs/DEPLOYMENT.md", "docs/CI_CD.md", "docs/GITHUB_OPERATIONS.md", "docs/TEST_PLAN.md", "docs/REMOTE_VALIDATION.md", "docs/ISSUE_BREAKDOWN.md", "docs/exec-plans/active/PLAN.md"]
    for path in tracked:
        if path.endswith(".md"):
            update_links(path, deployment_moves)
    for path in active_docs:
        update_tokens(path, deployment_moves)
        text = read(path)
        text = re.sub(r"\bdocker compose(?!\s+(?:--env-file|-f|--file)\b)", "docker compose --env-file .env -f deploy/compose.yml", text)
        text = re.sub(r"\bdocker build(?![\w-]|\s+(?:-f|--file)\b)", "docker build -f deploy/docker/Dockerfile", text)
        write(path, text)
    update_tokens(".codex/agents/infra.toml", deployment_moves)
    add_agent_note(".codex/agents/infra.toml", "저장소 배치 기준은 docs/REPOSITORY_STRUCTURE.md다. Dockerfile/Compose/entrypoint는 deploy/에 두고 빌드 context와 .dockerignore는 루트를 유지한다. Compose 경로 변경 시 기존 COMPOSE_PROJECT_NAME 및 MASTERGANTT_VOLUME_NAME을 보존하고, 실제 운영 volume 변경 없이 GitHub의 격리 Compose smoke를 수행한다.")
    append("AGENTS.md", "## Repository layout\n\n배포 파일과 실행 경로의 기준은 `docs/REPOSITORY_STRUCTURE.md`다. `deploy/docker/Dockerfile`, `deploy/compose.yml`, `deploy/docker/container-entrypoint.sh`를 사용한다. 루트 `.dockerignore`/npm/Next/TypeScript/ESLint/PostCSS 진입점은 유지한다. Compose 파일 이동을 이유로 기존 프로젝트명·SQLite volume·운영 데이터를 바꾸지 않는다.")
    append("README.md", "## 저장소 파일 배치와 Compose 경로\n\n배포 파일은 [Dockerfile](deploy/docker/Dockerfile), [Compose](deploy/compose.yml), [entrypoint](deploy/docker/container-entrypoint.sh)에 모았다. 상세 경로·기존 설치 전환·검증 방법은 [REPOSITORY_STRUCTURE](docs/REPOSITORY_STRUCTURE.md)를 따른다. 루트에서 `docker compose --env-file .env -f deploy/compose.yml ...`을 사용하며 기존 `.env`를 덮어쓰지 않는다. **실행 전 `COMPOSE_PROJECT_NAME`을 기존 컨테이너의 project label과 동일하게 설정**하고 기존 `/data` volume도 유지한다. `.env.example`의 project 이름은 신규 설치 예시다. HTTP/HTTPS 정책은 #8의 별도 변경이며 이 파일 이동으로 바뀌지 않는다.")
    for path in ["docs/DEPLOYMENT.md", "docs/CI_CD.md", "docs/REMOTE_VALIDATION.md", "docs/TEST_PLAN.md", "docs/GITHUB_OPERATIONS.md"]:
        append(path, "## Repository layout relocation (#12)\n\n현재 배포 경로와 기존 Compose 프로젝트/volume을 유지하는 전환 절차는 [REPOSITORY_STRUCTURE](REPOSITORY_STRUCTURE.md)를 따른다. CI의 Docker build 4개 참조와 Dependabot 경로를 함께 갱신하고 Docker gate에 `scripts/verify-compose-smoke.sh`를 추가했다. 새 Compose 경로의 config, startup/readiness, restart 및 강제 recreate 후 SQLite 보존을 격리된 CI 리소스로 검사한다. 기존 quality/E2E/runtime/registry 권한·검증 gate는 유지한다. 결과는 해당 PR/run/head의 실제 증거로 판정하며 과거 Wxx 기록을 이번 이동의 PASS로 전용하지 않는다.")
    replace("CHANGELOG.md", "## [Unreleased]\n", "## [Unreleased]\n\n### Repository layout\n\n- 배포 파일을 `deploy/`로 이동하고 Compose 프로젝트명 명시, CI/Dependabot 참조와 격리 Compose 재생성·영속성 검증을 추가했다 (#12).\n", 1)
    append("docs/exec-plans/active/PLAN.md", "## Repository layout work (#12 / #13)\n\n사용자 승인에 따라 배포 파일 정리와 테스트 설정 정리를 별도 커밋/stacked PR로 진행한다. 배포 구조와 새 검증은 #12, 테스트 config 이동은 #13에서 추적한다. 이 기록은 main 반영이나 CI PASS를 의미하지 않는다. 각 head의 quality/E2E/docker 실행 결과를 PR에 남기고 배포 PR → 테스트 설정 PR 순서로 검토한다. 실제 운영 배포, 데이터 이동, HTTP 지원, Node 버전 전환은 이번 범위에서 제외한다.")
    write("docs/REPOSITORY_STRUCTURE.md", STRUCTURE_A)
    for path in BOOTSTRAP:
        (ROOT / path).unlink()
    require((ROOT / "deploy/docker/container-entrypoint.sh").read_bytes() == original_entrypoint, "Entrypoint content changed")
    require((ROOT / "deploy/docker/container-entrypoint.sh").stat().st_mode & 0o111, "Entrypoint lost executable mode")
    run("sh", "-n", "deploy/docker/container-entrypoint.sh")
    run("bash", "-n", "scripts/verify-compose-smoke.sh")
    run("node", "scripts/check-markdown-links.mjs")
    run("git", "add", "--all")
    run("git", "diff", "--cached", "--check")
    run("git", "commit", "-m", "refactor: group deployment files and verify Compose relocation (#12)")
    commit_a = run("git", "rev-parse", "HEAD")

    test_moves = {"vitest.config.ts": "tests/config/vitest.config.ts", "playwright.config.ts": "tests/config/playwright.config.ts"}
    for old, new in test_moves.items():
        move(old, new)
    write("tests/config/vitest.config.ts", VITEST_CONFIG)
    pw = "tests/config/playwright.config.ts"
    replace(pw, 'import { resolve } from "node:path";\n', 'import { resolve } from "node:path";\nimport { fileURLToPath } from "node:url";\n\nconst repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));\n', 1)
    replace(pw, 'resolve(process.cwd(), ".data", "playwright.sqlite3")', 'resolve(repositoryRoot, ".data", "playwright.sqlite3")', 1)
    replace(pw, '  testDir: "./tests/e2e",\n', '  testDir: resolve(repositoryRoot, "tests/e2e"),\n  outputDir: resolve(repositoryRoot, "test-results"),\n', 1)
    replace(pw, '        command: "npm run dev -- --hostname 127.0.0.1 --port 3100",\n', '        command: "npm run dev -- --hostname 127.0.0.1 --port 3100",\n        cwd: repositoryRoot,\n', 1)
    replace("package.json", '"test": "vitest run"', '"test": "vitest run --config tests/config/vitest.config.ts"', 1)
    replace("package.json", '"test:e2e": "playwright test"', '"test:e2e": "playwright test --config tests/config/playwright.config.ts"', 1)
    replace(".dockerignore", "playwright.config.ts\nvitest.config.ts\n", "# Test configuration is under tests/ and remains excluded above.\n", 1)
    write("scripts/verify-test-discovery.mjs", DISCOVERY_SCRIPT)
    write("tests/scripts/test-config-layout.test.ts", TEST_CONFIG_TEST)
    replace(".github/workflows/ci.yml", "      - run: npm test\n", "      - name: Verify test discovery from root and external cwd\n        run: node scripts/verify-test-discovery.mjs\n      - run: npm test\n", 1)
    for path in tracked:
        if path.endswith(".md"):
            update_links(path, test_moves)
    for path in active_docs:
        update_tokens(path, test_moves)
    for path in [".codex/agents/infra.toml", ".codex/agents/frontend.toml", ".codex/agents/qa-docs.toml"]:
        update_tokens(path, test_moves)
        add_agent_note(path, "테스트 설정은 tests/config/에 모은다. npm test / npm run test:e2e는 그대로 사용하며 직접 CLI 실행에는 --config를 명시한다. 설정 이동 시 testDir/root/webServer.cwd/DB/출력 경로를 검사하고 기존 테스트를 삭제해 통과시키지 않는다.")
    for path in ["AGENTS.md", "README.md", "docs/TEST_PLAN.md", "docs/REMOTE_VALIDATION.md"]:
        structure_link = "docs/REPOSITORY_STRUCTURE.md" if "/" not in path else "REPOSITORY_STRUCTURE.md"
        append(path, f"## Test configuration relocation (#13)\n\n설정은 `tests/config/vitest.config.ts`, `tests/config/playwright.config.ts`에 있다. `npm test`, `npm run test:e2e`는 그대로 사용한다. 직접 실행은 `npx vitest run --config tests/config/vitest.config.ts`, `npx playwright test --config tests/config/playwright.config.ts`로 지정한다. 설정 파일 기준 root/testDir/webServer.cwd를 사용하고 E2E DB `.data/playwright.sqlite3`, `.next-e2e`, `test-results/`는 루트 기준으로 유지한다. CI는 `node scripts/verify-test-discovery.mjs`로 루트/외부 cwd의 동일한 테스트 발견을 확인한 뒤 전체 테스트를 실행한다. 편집기에서 자동 발견되지 않으면 같은 설정 경로를 지정한다. 실제 Windows 편집기 UI 검증은 미실행이며 [배치 문서]({structure_link})를 함께 따른다.")
    replace("docs/REPOSITORY_STRUCTURE.md", "테스트 설정 2개는 #13의 별도 변경으로 `tests/config/`에 모으며, 그 단계가 반영되기 전에는 기존 루트 설정을 사용한다.", "테스트 설정 2개는 #13의 별도 커밋으로 `tests/config/`에 이동했다. 루트 파일은 기존 17개에서 13개로 줄었으며 설정 파일을 중복 유지하지 않는다.", 1)
    append("docs/REPOSITORY_STRUCTURE.md", "## 테스트 설정 경로 (#13)\n\n| 이전 | 현재 |\n| --- | --- |\n| `vitest.config.ts` | `tests/config/vitest.config.ts` |\n| `playwright.config.ts` | `tests/config/playwright.config.ts` |\n\n`npm test`와 `npm run test:e2e`는 --config로 새 설정을 선택한다. 설정 파일의 import.meta.url에서 저장소 루트를 구하므로 cwd에 의존하지 않는다. Vitest root/include, Playwright testDir/webServer.cwd/outputDir/DB 경로와 기존 외부 URL·Chromium override를 유지한다. 브라우저 수·테스트 시나리오·worker 1개·포트 3100·날짜/권한 계약을 바꾸지 않는다.\n\n직접 실행 및 편집기 설정:\n\n```sh\nnpx vitest run --config tests/config/vitest.config.ts\nnpx playwright test --config tests/config/playwright.config.ts\nnpx playwright test --config tests/config/playwright.config.ts --list\nnode scripts/verify-test-discovery.mjs\n```\n\nVS Code의 Vitest/Playwright 확장에서 자동 발견되지 않으면 해당 설정 파일을 선택한다. 확장 기능의 실제 UI 동작은 이번 GitHub Linux CLI 검증과 별개다. `.dockerignore`는 tests 전체를 계속 제외한다. Playwright HTML reporter 도입이나 산출물의 추가 이동은 별도 범위이며 CI의 기존 artifact 정책은 변경하지 않았다.\n\n[Vitest root](https://vitest.dev/config/root), [Playwright test configuration](https://playwright.dev/docs/api/class-testconfig).")
    replace("CHANGELOG.md", "### Repository layout\n", "### Repository layout\n\n- Vitest/Playwright 설정을 `tests/config/`로 이동하고 명시적 config 선택과 root/외부 cwd 테스트 발견 검증을 추가했다 (#13).\n", 1)
    run("node", "--check", "scripts/verify-test-discovery.mjs")
    run("node", "scripts/check-markdown-links.mjs")
    for path, sha in original_source.items():
        require(blob_sha(path) == sha, f"Application/database/E2E source changed: {path}")
    require((ROOT / "package-lock.json").read_bytes() == package_bytes, "Lockfile changed")
    for path in BOOTSTRAP:
        require(not (ROOT / path).exists(), "Bootstrap remains in deliverable")
    run("git", "add", "--all")
    run("git", "diff", "--cached", "--check")
    run("git", "commit", "-m", "refactor: group test configurations with explicit root paths (#13)")
    commit_b = run("git", "rev-parse", "HEAD")
    # Create Git objects only. The authenticated connector moves the work refs
    # after checking the bootstrap head, so this job never pushes any branch.
    def post(endpoint, payload):
        request = urllib.request.Request(
            f"https://api.github.com/repos/{REPO}/{endpoint}",
            data=json.dumps(payload).encode(),
            method="POST",
            headers={
                "Authorization": "Bearer " + os.environ["GH_TOKEN"],
                "Accept": "application/vnd.github+json",
                "Content-Type": "application/json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "mastergantt-approved-reorganization",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            raise RuntimeError(f"Git object creation failed: HTTP {error.code}; no permission escalation") from None

    def publish_tree(old_local, new_local, parent_remote):
        entries = []
        for path in run("git", "diff", "--no-renames", "--name-only", old_local, new_local).splitlines():
            info = run("git", "ls-tree", new_local, "--", path)
            if not info:
                entries.append({"path": path, "mode": "100644", "type": "blob", "sha": None})
                continue
            mode, kind, _ = info.split("\t")[0].split()
            require(kind == "blob" and mode in ("100644", "100755"), f"Unexpected Git entry: {path}")
            content = subprocess.check_output(["git", "show", f"{new_local}:{path}"], cwd=ROOT).decode("utf-8")
            entries.append({"path": path, "mode": mode, "type": "blob", "content": content})
        tree = post("git/trees", {"base_tree": run("git", "rev-parse", old_local + "^{tree}"), "tree": entries})
        require(tree["sha"] == run("git", "rev-parse", new_local + "^{tree}"), "Remote tree differs from validated local tree")
        commit = post("git/commits", {"tree": tree["sha"], "parents": [parent_remote], "message": run("git", "log", "-1", "--format=%B", new_local)})
        return commit["sha"]

    remote_a = publish_tree(bootstrap_sha, commit_a, bootstrap_sha)
    remote_b = publish_tree(commit_a, commit_b, remote_a)
    report = {"baseline": BASE, "bootstrap_sha": bootstrap_sha, "deployment_branch": BRANCH_A, "deployment_sha": remote_a, "tests_branch": BRANCH_B, "tests_sha": remote_b, "local_static_checks": "shell syntax, discovery script syntax, markdown links, git diff --check, source/lockfile preservation PASS", "runtime_verification": "NOT TESTED: connector must advance work refs and create PRs for quality, E2E and Docker"}
    print(json.dumps(report, indent=2))
    Path(os.environ["GITHUB_STEP_SUMMARY"]).write_text("# Repository layout Git objects\n\n```json\n" + json.dumps(report, indent=2) + "\n```\n", encoding="utf-8")


if __name__ == "__main__":
    main()
