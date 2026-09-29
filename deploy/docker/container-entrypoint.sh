#!/bin/sh
set -eu

# 단일 application instance에서만 실행한다. migration 실패 시 server를 기동하지 않아
# 반쯤 적용된 schema로 요청을 처리하지 않는다. startup 도구는 build stage에서 JS로
# 컴파일되어 runtime에서 TypeScript loader/tsx를 요구하지 않는다.
node runtime-tools/scripts/runtime/validate-runtime-config.js
node runtime-tools/scripts/migrate.js

exec node server.js
