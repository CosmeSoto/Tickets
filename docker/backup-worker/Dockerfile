FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends pgbackrest postgresql-client curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/pgbackrest /var/log/pgbackrest \
    && groupadd -g 999 postgres 2>/dev/null || true \
    && useradd -u 999 -g 999 -M postgres 2>/dev/null || true \
    && chown -R postgres:postgres /var/lib/pgbackrest /var/log/pgbackrest

WORKDIR /worker
COPY --chown=postgres:postgres server.mjs ./server.mjs

ENV PORT=8080
USER postgres
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=40s \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1

CMD ["node", "server.mjs"]
