#!/bin/sh
# Desactiva el módulo de inventario en la base de datos de producción.
# Ejecutar UNA VEZ después del primer arranque:
#   docker exec tickets-postgres psql -U tickets_user -d tickets_db -f /tmp/disable-inventory.sql
# O directamente:
#   docker compose -f docker-compose.prod.yml exec postgres \
#     psql -U tickets_user -d tickets_db -c \
#     "UPDATE system_modules SET \"isActive\" = false WHERE key = 'inventory';"

echo "Desactivando módulo de inventario..."
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U tickets_user -d tickets_db -c \
  "UPDATE system_modules SET \"isActive\" = false WHERE key = 'inventory';"
echo "Listo. El módulo de inventario está desactivado."
echo "Para reactivarlo: UPDATE system_modules SET \"isActive\" = true WHERE key = 'inventory';"
