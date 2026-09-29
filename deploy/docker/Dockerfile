# syntax=docker/dockerfile:1
# 모든 build/runtime stage는 동일한 Debian glibc/Node 계열을 사용해
# better-sqlite3 native addon의 Node ABI/libc 호환성을 유지한다.
FROM node:26-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS build
WORKDIR /app

# better-sqlite3 prebuild가 대상 Node patch에 없을 수 있으므로 source build 도구는
# build stage에만 설치한다. 최종 runtime에는 compiler/Python/npm install 결과 전체를
# 복사하지 않고 Next.js standalone trace와 startup용 compiled artifact만 전달한다.
RUN apt-get update \
    && apt-get install --no-install-recommends --yes python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS runtime
ARG VERSION=dev
LABEL org.opencontainers.image.title="masterGantt" \
      org.opencontainers.image.description="Single-instance project Gantt management application" \
      org.opencontainers.image.version="${VERSION}"

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/mastergantt.sqlite3

WORKDIR /app

# 고정 numeric UID는 named volume과 host bind mount의 권한 준비를 예측 가능하게 한다.
RUN groupadd --system --gid 1001 mastergantt \
    && useradd --system --uid 1001 --gid mastergantt --create-home mastergantt \
    && mkdir /data \
    && chown mastergantt:mastergantt /data

# Next.js output tracing이 선택한 production runtime dependency와 최소 server.js를 복사한다.
# build script가 .next/static과 optional public/을 standalone directory 안에 미리 stage한다.
COPY --from=build --chown=mastergantt:mastergantt /app/.next/standalone ./

# startup validation/migration은 build-time CommonJS artifact로 실행한다. 전체 src tree,
# TypeScript source, tsx runtime, .next/cache는 최종 image에 포함하지 않는다.
COPY --from=build --chown=mastergantt:mastergantt /app/.runtime-tools ./runtime-tools
COPY --from=build --chown=mastergantt:mastergantt /app/db/migrations ./db/migrations
COPY --chown=mastergantt:mastergantt deploy/docker/container-entrypoint.sh /usr/local/bin/container-entrypoint
RUN chmod 0755 /usr/local/bin/container-entrypoint

USER mastergantt
VOLUME ["/data"]
EXPOSE 3000

# readiness는 migration, SQLite query, foreign key 및 migration ledger를 확인한다.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/api/health/ready').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"

ENTRYPOINT ["/usr/local/bin/container-entrypoint"]
