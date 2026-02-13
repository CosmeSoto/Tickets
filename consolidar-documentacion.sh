#!/bin/bash

# Script para consolidar documentación y mover archivos duplicados a archived-docs
# Fecha: 5 de Febrero, 2026

echo "🗂️  Consolidando documentación del sistema..."

# Crear carpeta de respaldo si no existe
mkdir -p archived-docs/auditorias-tickets
mkdir -p archived-docs/correcciones-tickets
mkdir -p archived-docs/fases-desarrollo
mkdir -p archived-docs/resúmenes

# Mover archivos de auditoría duplicados
echo "📋 Moviendo archivos de auditoría..."
mv AUDITORIA_COMPLETA_MODULOS_TICKETS.md archived-docs/auditorias-tickets/ 2>/dev/null
mv AUDITORIA_FINAL_MODULO_TICKETS.md archived-docs/auditorias-tickets/ 2>/dev/null
mv AUDITORIA_MODULO_TECNICOS_COMPLETADA.md archived-docs/auditorias-tickets/ 2>/dev/null
mv AUDITORIA_MODULO_TICKETS_COMPLETA.md archived-docs/auditorias-tickets/ 2>/dev/null

# Mover archivos de correcciones duplicados
echo "🔧 Moviendo archivos de correcciones..."
mv CORRECCIONES_MODULO_TICKETS_APLICADAS.md archived-docs/correcciones-tickets/ 2>/dev/null
mv CORRECCION_MODULO_TICKETS_APLICADA.md archived-docs/correcciones-tickets/ 2>/dev/null

# Mover archivos de fases de desarrollo
echo "📊 Moviendo archivos de fases..."
mv FASE_13_*.md archived-docs/fases-desarrollo/ 2>/dev/null

# Mover resúmenes antiguos
echo "📝 Moviendo resúmenes antiguos..."
mv RESUMEN_TAREAS_*.md archived-docs/resúmenes/ 2>/dev/null
mv RESUMEN_SESION_*.md archived-docs/resúmenes/ 2>/dev/null

echo "✅ Consolidación completada!"
echo ""
echo "📚 Documentos principales actuales:"
echo "  - GUIA_COMPLETA_SISTEMA_TICKETS.md (NUEVO - Guía maestra)"
echo "  - AUDITORIA_MODULO_TECNICOS_TICKETS_COMPLETADA.md (Auditoría detallada)"
echo "  - RESUMEN_AUDITORIA_TICKETS_FINAL.md (Resumen ejecutivo)"
echo "  - CORRECCIONES_SIMETRIA_VISUAL_TICKETS.md (Correcciones aplicadas)"
echo "  - RESUMEN_CORRECCIONES_APLICAR.md (Guía de implementación)"
echo ""
echo "📁 Archivos movidos a: archived-docs/"
