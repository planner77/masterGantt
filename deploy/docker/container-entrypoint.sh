#!/bin/sh
set -eu

# 단일 application instance에서만 실행한다. migration 실패 시 server를 기동하지 않아
# 반쯤 적용된 schema로 요청을 처리하지 않는다. 오류 상세/경로는 migrate CLI가 노출하지 않는다.
node --import tsx scripts/validate-runtime-config.ts
npm run db:migrate

exec npm run start -- --hostname 0.0.0.0 --port "${PORT:-3000}"
