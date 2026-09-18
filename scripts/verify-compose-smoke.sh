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
export RESOURCE_CATALOG_ADMIN_PASSWORD="ci-resource-admin-password"
WRONG_RESOURCE_CATALOG_ADMIN_PASSWORD="ci-wrong-resource-admin-password"
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
  echo "기존 smoke-test volume 재사용을 거부합니다." >&2
  exit 1
fi
[[ -z "$(dc ps --all --quiet)" ]]
if env -u RESOURCE_CATALOG_ADMIN_PASSWORD docker compose --env-file /dev/null -f "$root/deploy/compose.yml" config --quiet >"$tmp/missing-resource-admin.out" 2>"$tmp/missing-resource-admin.err"; then
  echo "RESOURCE_CATALOG_ADMIN_PASSWORD가 없으면 Compose config가 실패해야 합니다." >&2
  exit 1
fi
grep -q 'RESOURCE_CATALOG_ADMIN_PASSWORD' "$tmp/missing-resource-admin.err"
echo 'Compose 리소스 관리자 비밀번호 누락 fail-fast: PASS'
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
assert app['environment']['RESOURCE_CATALOG_ADMIN_PASSWORD'] == os.environ['RESOURCE_CATALOG_ADMIN_PASSWORD']
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
print('Compose 설정 계약: PASS')
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
published="$(dc port app 3000)"
[[ "$published" =~ ^127\.0\.0\.1:[0-9]+$ ]]
auth_status="$(curl --silent --output "$tmp/resource-auth-ok.json" --write-out '%{http_code}' \
  --request POST "http://$published/api/resource-catalog/admin-sessions" \
  --header "Origin: $APP_BASE_URL" \
  --header "Content-Type: application/json" \
  --data "{\"password\":\"$RESOURCE_CATALOG_ADMIN_PASSWORD\"}")"
[[ "$auth_status" == "201" ]]
bad_auth_status="$(curl --silent --output "$tmp/resource-auth-bad.json" --write-out '%{http_code}' \
  --request POST "http://$published/api/resource-catalog/admin-sessions" \
  --header "Origin: $APP_BASE_URL" \
  --header "Content-Type: application/json" \
  --data "{\"password\":\"$WRONG_RESOURCE_CATALOG_ADMIN_PASSWORD\"}")"
[[ "$bad_auth_status" == "401" ]]
grep -q 'RESOURCE_ADMIN_AUTH_FAILED' "$tmp/resource-auth-bad.json"
auth_logs="$(dc logs --no-color app 2>&1)"
grep -q '"event":"resource_catalog_admin_auth_succeeded"' <<<"$auth_logs"
grep -q '"event":"resource_catalog_admin_auth_failed"' <<<"$auth_logs"
if grep -Fq "$RESOURCE_CATALOG_ADMIN_PASSWORD" <<<"$auth_logs" || grep -Fq "$WRONG_RESOURCE_CATALOG_ADMIN_PASSWORD" <<<"$auth_logs"; then
  echo "리소스 관리자 인증 로그에 비밀번호 원문이 노출되었습니다." >&2
  exit 1
fi
echo 'Compose 리소스 관리자 인증 성공·거부 및 인증 로그 비밀정보 비노출: PASS'
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
logs="$(dc logs --no-color app 2>&1)"
grep -q '"event":"runtime_configuration_validated"' <<<"$logs"
grep -q '"event":"database_migration_completed"' <<<"$logs"
grep -q '"event":"application_started"' <<<"$logs"
if grep -Fq "$RESOURCE_CATALOG_ADMIN_PASSWORD" <<<"$logs" || grep -Fq "$WRONG_RESOURCE_CATALOG_ADMIN_PASSWORD" <<<"$logs"; then
  echo "재생성 후 애플리케이션 로그에 리소스 관리자 비밀번호 원문이 노출되었습니다." >&2
  exit 1
fi
echo 'Compose 구조화 stdout/stderr 로그 및 비밀정보 비노출: PASS'
echo 'Compose 시작, 재시작, 강제 재생성 및 SQLite volume 영속성: PASS'
