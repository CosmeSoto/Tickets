FROM postgres:17-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends pgbackrest \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest \
    && chown -R postgres:postgres /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest

COPY docker-entrypoint-wrapper.sh /usr/local/bin/docker-entrypoint-wrapper.sh
COPY pgbackrest-bootstrap-watcher.sh /usr/local/bin/pgbackrest-bootstrap-watcher.sh
COPY init-pgbackrest-stanza.sh /docker-entrypoint-initdb.d/99-pgbackrest-stanza.sh
RUN chmod +x /usr/local/bin/docker-entrypoint-wrapper.sh \
    && chmod +x /usr/local/bin/pgbackrest-bootstrap-watcher.sh \
    && chmod +x /docker-entrypoint-initdb.d/99-pgbackrest-stanza.sh

ENTRYPOINT ["docker-entrypoint-wrapper.sh"]
CMD ["postgres"]
