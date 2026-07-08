FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends pgbackrest postgresql-client curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/pgbackrest /var/log/pgbackrest

WORKDIR /worker
COPY server.mjs ./server.mjs

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1

CMD ["node", "server.mjs"]
