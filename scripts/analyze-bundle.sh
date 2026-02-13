#!/bin/bash

# Script para analizar el bundle de Next.js
# Uso: ./scripts/analyze-bundle.sh

echo "🔍 Analizando bundle de Next.js..."
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
  echo "❌ Error: Ejecuta este script desde la raíz del proyecto"
  exit 1
fi

# Limpiar builds anteriores
echo "🧹 Limpiando builds anteriores..."
rm -rf .next

# Build con análisis
echo "📦 Construyendo con análisis de bundle..."
ANALYZE=true npm run build

# Mostrar tamaño de chunks
echo ""
echo "📊 Tamaño de chunks principales:"
echo ""
ls -lh .next/static/chunks/*.js 2>/dev/null | awk '{print $5 "\t" $9}' | sort -hr

echo ""
echo "📊 Tamaño de chunks de páginas:"
echo ""
ls -lh .next/static/chunks/pages/*.js 2>/dev/null | awk '{print $5 "\t" $9}' | sort -hr

echo ""
echo "✅ Análisis completado!"
echo "📈 Abre .next/analyze.html en tu navegador para ver el reporte detallado"
