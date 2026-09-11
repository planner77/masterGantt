# syntax=docker/dockerfile:1
# Node 22는 package.json의 지원 범위와 맞추며, 모든 stage에서 Debian glibc 계열을
# 사용한다. better-sqlite3 native addon의 Node ABI/libc 불일치를 피하기 위한 것이다.
FROM node:26-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
# better-sqlite3 prebuild가 대상 Node patch에 없을 수 있으므로 source build 도구를
# builder에만 둔다. runtime stage에는 compiler/Python을 복사하지 않는다.
RUN apt-get update \
    && apt-get install --no-install-recommends --yes python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && npm ci --omit=dev

FROM production-dependencies AS build
WORKDIR /app
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
    DATABASE_PATH=/data/mastergantt.sqlite3

WORKDIR /app

# 고정 numeric UID는 named volume과 host bind mount의 권한 준비를 예측 가능하게 한다.
RUN groupadd --system --gid 1001 mastergantt \
    && useradd --system --uid 1001 --gid mastergantt --create-home mastergantt \
    && mkdir /data \
    && chown mastergantt:mastergantt /data

COPY --from=production-dependencies --chown=mastergantt:mastergantt /app/node_modules ./node_modules
COPY --from=build --chown=mastergantt:mastergantt /app/.next ./.next
COPY --from=build --chown=mastergantt:mastergantt /app/package.json ./package.json
COPY --from=build --chown=mastergantt:mastergantt /app/next.config.ts ./next.config.ts
COPY --from=build --chown=mastergantt:mastergantt /app/db ./db
COPY --from=build --chown=mastergantt:mastergantt /app/scripts/migrate.ts ./scripts/migrate.ts
COPY --from=build --chown=mastergantt:mastergantt /app/scripts/validate-runtime-config.ts ./scripts/validate-runtime-config.ts
COPY --from=build --chown=mastergantt:mastergantt /app/src ./src
COPY --chown=mastergantt:mastergantt scripts/container-entrypoint.sh /usr/local/bin/container-entrypoint

USER mastergantt
VOLUME ["/data"]
EXPOSE 3000

# readiness는 migration, SQLite query, foreign key 및 migration ledger를 확인한다.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/api/health/ready').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"

ENTRYPOINT ["/usr/local/bin/container-entrypoint"]
