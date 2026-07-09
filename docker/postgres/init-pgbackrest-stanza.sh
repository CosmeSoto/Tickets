#!/bin/bash
# Durante initdb solo preparamos directorios — el bootstrap real lo hace init-pgbackrest.sh
echo "[pgBackRest] initdb: bootstrap diferido a init-pgbackrest.sh (archive_mode=off hasta entonces)"
