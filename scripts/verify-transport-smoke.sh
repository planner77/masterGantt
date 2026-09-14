#!/usr/bin/env bash
set -euo pipefail

# GitHub-hosted CI 전용. 운영 서버/기존 컨테이너·볼륨을 입력받지 않는다.
[[ "${CI:-}" == true && "${GITHUB_ACTIONS:-}" == true ]]
[[ "${GITHUB_REPOSITORY:-}" == planner77/masterGantt ]]
[[ "${GITHUB_RUN_ID:-}" =~ ^[0-9]+$ && "${GITHUB_RUN_ATTEMPT:-}" =~ ^[0-9]+$ ]]
image="${1:?검증할 로컬 이미지 또는 pull한 digest가 필요합니다.}"
[[ "$image" == mastergantt:ci || "$image" == mastergantt:release-candidate || "$image" =~ ^ghcr\.io/planner77/mastergantt@sha256:[0-9a-f]{64}$ ]]
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
prefix="mastergantt-transport-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
tmp="$(mktemp -d)"
chmod 700 "$tmp"
containers=()
volumes=()
nginx_started=false
trust_added=false
hosts_added=false
nss="$HOME/.local/share/pki/nssdb"
[[ ! -d "$HOME/.pki/nssdb" ]] || nss="$HOME/.pki/nssdb"
cleanup() {
  status=$?
  trap - EXIT
  if [[ "$nginx_started" == true ]]; then nginx -p "$tmp/" -c "$tmp/nginx.conf" -s quit >/dev/null 2>&1 || true; fi
  for name in "${containers[@]}"; do docker rm --force --volumes "$name" >/dev/null 2>&1 || true; done
  for name in "${volumes[@]}"; do docker volume rm "$name" >/dev/null 2>&1 || status=1; done
  if [[ "$trust_added" == true ]]; then certutil -d "sql:$nss" -D -n "$prefix" >/dev/null 2>&1 || status=1; fi
  if [[ "$hosts_added" == true ]]; then sudo sed -i "/# ${prefix}$/d" /etc/hosts; fi
  rm -rf "$tmp"
  exit "$status"
}
trap cleanup EXIT

docker image inspect "$image" >/dev/null
new_volume() {
  local name="$1"
  if docker volume inspect "$name" >/dev/null 2>&1; then echo '기존 볼륨을 재사용하지 않습니다.' >&2; return 1; fi
  docker volume create "$name" >/dev/null
  volumes+=("$name")
}
reserve_container() {
  local name="$1"
  if docker container inspect "$name" >/dev/null 2>&1; then echo '기존 컨테이너를 변경하지 않습니다.' >&2; return 1; fi
  containers+=("$name")
}

# 잘못된 설정은 실제 entrypoint에서 migration 전에 exit 1이어야 한다.
negative_case() {
  local id="$1"; shift
  local name="${prefix}-invalid-${id}" vol="${prefix}-invalid-${id}-data"
  new_volume "$vol"
  reserve_container "$name"
  set +e
  timeout 20s docker run --name "$name" --volume "$vol:/data" "$@" "$image" >"$tmp/invalid-$id.log" 2>&1
  local status=$?
  set -e
  if [[ "$status" != 1 ]]; then echo "설정 거부 검사 $id 실패: 종료 코드 $status" >&2; return 1; fi
  docker run --rm --entrypoint sh --volume "$vol:/data" "$image" -c 'test ! -e /data/mastergantt.sqlite3'
  echo "설정 거부 및 migration 미실행: $id PASS"
}
negative_case missing --env APP_BASE_URL=http://plain.gantt.test:18080
negative_case false --env APP_BASE_URL=http://plain.gantt.test:18080 --env ALLOW_INSECURE_HTTP=false
negative_case empty --env APP_BASE_URL=http://plain.gantt.test:18080 --env ALLOW_INSECURE_HTTP=
negative_case typo --env APP_BASE_URL=https://secure.gantt.test:18443 --env ALLOW_INSECURE_HTTP=TRUE
negative_case path --env APP_BASE_URL=http://plain.gantt.test:18080/subpath --env ALLOW_INSECURE_HTTP=true
negative_case database --env APP_BASE_URL=http://plain.gantt.test:18080 --env ALLOW_INSECURE_HTTP=true --env DATABASE_PATH=/tmp/forbidden.sqlite3

# Chromium의 일반 HTTP hostname과 신뢰할 수 있는 테스트 CA를 사용한다.
# --ignore-certificate-errors, ignoreHTTPSErrors, secure-origin 강제는 금지한다.
printf '127.0.0.1 plain.gantt.test secure.gantt.test # %s\n' "$prefix" | sudo tee -a /etc/hosts >/dev/null
hosts_added=true
export NO_PROXY="${NO_PROXY:+$NO_PROXY,}plain.gantt.test,secure.gantt.test,127.0.0.1,localhost"
export no_proxy="$NO_PROXY"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -sha256 -subj '/CN=masterGantt isolated CI CA' \
  -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign' \
  -keyout "$tmp/ca.key" -out "$tmp/ca.pem" >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes -subj '/CN=secure.gantt.test' \
  -keyout "$tmp/server.key" -out "$tmp/server.csr" >/dev/null 2>&1
cat >"$tmp/extensions" <<'EXT'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:secure.gantt.test
EXT
openssl x509 -req -in "$tmp/server.csr" -CA "$tmp/ca.pem" -CAkey "$tmp/ca.key" -CAcreateserial \
  -days 1 -sha256 -extfile "$tmp/extensions" -out "$tmp/server.pem" >/dev/null 2>&1
chmod 600 "$tmp/ca.key" "$tmp/server.key"
mkdir -p "$nss"
if [[ ! -f "$nss/cert9.db" ]]; then certutil -d "sql:$nss" -N --empty-password; fi
certutil -d "sql:$nss" -A -t 'C,,' -n "$prefix" -i "$tmp/ca.pem"
trust_added=true
export NODE_EXTRA_CA_CERTS="$tmp/ca.pem"
export TRANSPORT_HTTP_ORIGIN=http://plain.gantt.test:18080
export TRANSPORT_HTTPS_ORIGIN=https://secure.gantt.test:18443
export TRANSPORT_HTTP_CONTAINER="${prefix}-http"
export TRANSPORT_HTTPS_CONTAINER="${prefix}-https"
for mode in http https; do
  name="${prefix}-${mode}"
  new_volume "$name-data"
  reserve_container "$name"
  if [[ "$mode" == http ]]; then origin="$TRANSPORT_HTTP_ORIGIN"; port=18081; else origin="$TRANSPORT_HTTPS_ORIGIN"; port=18444; fi
  docker run --detach --name "$name" --volume "$name-data:/data" \
    --publish "127.0.0.1:$port:3000" --env NODE_ENV=production \
    --env "APP_BASE_URL=$origin" --env ALLOW_INSECURE_HTTP=true "$image" >/dev/null
  ready=false
  for _ in $(seq 1 90); do
    if curl --fail --silent "http://127.0.0.1:$port/api/health/ready" >/dev/null; then ready=true; break; fi
    sleep 1
  done
  [[ "$ready" == true ]]
done
cat >"$tmp/proxy.conf" <<'PROXY'
location / {
  proxy_pass http://127.0.0.1:UPSTREAM_PORT;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_set_header Host $http_host;
  proxy_set_header X-Forwarded-Host $http_host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Port $server_port;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_buffering off;
  proxy_cache off;
  proxy_intercept_errors off;
  proxy_read_timeout 60s;
}
PROXY
sed 's/UPSTREAM_PORT/18081/g' "$tmp/proxy.conf" > "$tmp/http-proxy.conf"
sed 's/UPSTREAM_PORT/18444/g' "$tmp/proxy.conf" > "$tmp/https-proxy.conf"
cat >"$tmp/nginx.conf" <<NGINX
pid $tmp/nginx.pid;
error_log $tmp/nginx.error.log warn;
events { worker_connections 256; }
http {
  access_log off;
  client_body_temp_path $tmp/body;
  proxy_temp_path $tmp/proxy;
  server {
    listen 127.0.0.1:18080;
    server_name plain.gantt.test;
    include $tmp/http-proxy.conf;
  }
  server {
    listen 127.0.0.1:18443 ssl;
    server_name secure.gantt.test;
    ssl_certificate $tmp/server.pem;
    ssl_certificate_key $tmp/server.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    include $tmp/https-proxy.conf;
  }
}
NGINX
nginx -p "$tmp/" -c "$tmp/nginx.conf" -t
nginx -p "$tmp/" -c "$tmp/nginx.conf"
nginx_started=true
curl --fail --silent "$TRANSPORT_HTTP_ORIGIN/api/health/ready" >/dev/null
curl --fail --silent --cacert "$tmp/ca.pem" "$TRANSPORT_HTTPS_ORIGIN/api/health/ready" >/dev/null
cd "$root"
npx --no-install playwright test --config tests/config/transport.config.ts
echo 'production HTTP·HTTPS: 실제 Nginx/Chromium 쿠키·권한·편집·재시작 검증 PASS'
