#!/bin/sh
set -e
cd /app || exit 1

##############################################################################
# Script: Migración de Datos en Producción
# 
# Este script ejecuta la migración de custom_fields a atributos por tipo
# en un contenedor Docker de producción.
#
# Uso:
#   docker exec tickets-app /app/docker/migrate-data.sh [--dry-run|--rollback]
##############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Migración de Datos - Custom Fields → Atributos por Tipo"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MODE="${1:-execute}"
TSX_CLI='node ./node_modules/tsx/dist/cli.mjs'

case "$MODE" in
  --dry-run)
    echo "==> Modo: DRY-RUN (simulación sin cambios)"
    $TSX_CLI prisma/scripts/migrate-custom-fields-to-attributes.ts --dry-run
    ;;
  --rollback)
    echo "==> Modo: ROLLBACK (revertir migración)"
    echo "⚠️  ADVERTENCIA: Esto eliminará los atributos creados"
    echo "Presiona Ctrl+C para cancelar, Enter para continuar..."
    read -r
    $TSX_CLI prisma/scripts/migrate-custom-fields-to-attributes.ts --rollback
    ;;
  *)
    echo "==> Modo: EXECUTE (migración real)"
    echo "⚠️  ADVERTENCIA: Esto creará atributos en la base de datos"
    echo "Presiona Ctrl+C para cancelar, Enter para continuar..."
    read -r
    $TSX_CLI prisma/scripts/migrate-custom-fields-to-attributes.ts
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Migración completada"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📄 Reporte guardado en: /app/backups/"
echo "💡 Para ver el reporte:"
echo "   docker exec tickets-app cat /app/backups/migration-custom-fields-*.json"
echo ""
echo "💡 Para validar la migración:"
echo "   docker exec tickets-app node ./node_modules/tsx/dist/cli.mjs prisma/scripts/validate-migration.ts"
echo ""
