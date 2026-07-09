FROM node:20-bookworm-slim

# El paquete pgbackrest puede crear "postgres" con UID ≠ 999.
# El volumen postgres_data pertenece a UID 999 (imagen postgres oficial).
RUN apt-get update \
    && apt-get install -y --no-install-recommends pgbackrest postgresql-client curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/pgbackrest /var/log/pgbackrest \
    && (getent group postgres >/dev/null && groupmod -g 999 postgres || groupadd -g 999 postgres) \
    && (id postgres >/dev/null 2>&1 \
        && usermod -u 999 -g 999 postgres \
        || useradd -u 999 -g 999 -M -s /usr/sbin/nologin postgres) \
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
