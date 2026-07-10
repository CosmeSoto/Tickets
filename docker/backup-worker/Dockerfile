# pgBackRest debe coincidir con el del contenedor postgres (2.58+ soporta PG 17).
# Debian bookworm-slim trae pgbackrest 2.45 — incompatible con control version 1700.
FROM postgres:17-bookworm AS pgbr
RUN apt-get update \
    && apt-get install -y --no-install-recommends pgbackrest \
    && rm -rf /var/lib/apt/lists/* \
    && pgbackrest version

FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl postgresql-client docker.io \
        libpq5 libxml2 libyaml-0-2 libssh-4 libssl3 \
        libzstd1 liblz4-1 libbz2-1.0 zlib1g \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/pgbackrest /var/log/pgbackrest

COPY --from=pgbr /usr/bin/pgbackrest /usr/bin/pgbackrest

RUN pgbackrest version \
    && (getent group postgres >/dev/null && groupmod -g 999 postgres || groupadd -g 999 postgres) \
    && (id postgres >/dev/null 2>&1 && usermod -u 999 -g 999 postgres || useradd -u 999 -g 999 -M -s /usr/sbin/nologin postgres) \
    && chown -R postgres:postgres /var/lib/pgbackrest /var/log/pgbackrest \
    && test "$(id -u postgres)" = "999"

WORKDIR /worker
COPY --chown=999:999 server.mjs ./server.mjs

ENV PORT=8080
USER 999:999
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=10s --retries=10 --start-period=120s \
  CMD curl -fsS http://127.0.0.1:8080/health | grep -q '"stanzaOk":true' || exit 1

CMD ["node", "server.mjs"]
