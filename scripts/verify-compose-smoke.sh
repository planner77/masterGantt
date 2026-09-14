#!/usr/bin/env bash
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
export ALLOW_INSECURE_HTTP="false"
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
assert str(app['environment']['ALLOW_INSECURE_HTTP']).lower() == 'false'
assert 'SESSION_COOKIE_SECURE' not in app['environment']
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
