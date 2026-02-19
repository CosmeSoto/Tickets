#!/bin/bash

# Script de verificación post-reinicio
# Ejecutar DESPUÉS de reiniciar el servidor

echo "=================================================="
echo "🔍 VERIFICACIÓN POST-REINICIO"
echo "=================================================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar que el servidor está corriendo
echo "1️⃣  Verificando que el servidor está corriendo..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Servidor está corriendo en http://localhost:3000${NC}"
else
  echo -e "${RED}❌ Servidor NO está corriendo${NC}"
  echo ""
  echo "Por favor inicia el servidor con:"
  echo -e "${YELLOW}npm run dev${NC}"
  exit 1
fi
echo ""

# Verificar que Prisma está actualizado
echo "2️⃣  Verificando cliente de Prisma..."
if [ -f "node_modules/.prisma/client/index.d.ts" ]; then
  PRISMA_AGE=$(find node_modules/.prisma/client/index.d.ts -mmin +10 2>/dev/null)
  if [ -z "$PRISMA_AGE" ]; then
    echo -e "${GREEN}✅ Cliente de Prisma está actualizado (< 10 minutos)${NC}"
  else
    echo -e "${YELLOW}⚠️  Cliente de Prisma tiene más de 10 minutos${NC}"
    echo "   Considera ejecutar: npx prisma generate"
  fi
else
  echo -e "${RED}❌ Cliente de Prisma NO encontrado${NC}"
  exit 1
fi
echo ""

# Verificar que los modelos existen
echo "3️⃣  Verificando modelos de Prisma..."
if grep -q "resolution_plans:" node_modules/.prisma/client/index.d.ts && \
   grep -q "resolution_tasks:" node_modules/.prisma/client/index.d.ts; then
  echo -e "${GREEN}✅ Modelos resolution_plans y resolution_tasks encontrados${NC}"
else
  echo -e "${RED}❌ Modelos NO encontrados${NC}"
  exit 1
fi
echo ""

# Test de Prisma
echo "4️⃣  Ejecutando test de Prisma..."
node test-prisma-resolution.js > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Test de Prisma exitoso${NC}"
else
  echo -e "${RED}❌ Test de Prisma falló${NC}"
  exit 1
fi
echo ""

# Instrucciones finales
echo "=================================================="
echo "✅ VERIFICACIÓN COMPLETADA"
echo "=================================================="
echo ""
echo -e "${GREEN}Todo está correcto.${NC} Ahora verifica manualmente:"
echo ""
echo "📋 CHECKLIST DE VERIFICACIÓN MANUAL:"
echo ""
echo "1. Abre el navegador en: ${BLUE}http://localhost:3000${NC}"
echo "2. Inicia sesión como ADMIN o TECHNICIAN"
echo "3. Navega a cualquier ticket"
echo "4. Haz clic en el tab ${YELLOW}'Plan de Resolución'${NC}"
echo ""
echo "✅ DEBE PASAR:"
echo "   - El tab carga sin errores"
echo "   - NO aparece error 500 en consola del navegador"
echo "   - Aparece 'No hay plan de resolución' o el plan existente"
echo "   - Botón 'Crear Plan' está visible"
echo ""
echo "❌ NO DEBE PASAR:"
echo "   - Error 500 en consola del navegador"
echo "   - Pantalla en blanco"
echo "   - Error de Prisma en consola del servidor"
echo ""
echo "=================================================="
echo ""
echo "💡 Si todo funciona correctamente:"
echo "   ${GREEN}¡El error 500 está resuelto!${NC}"
echo ""
echo "❌ Si aún hay error 500:"
echo "   1. Revisa la consola del servidor para el error exacto"
echo "   2. Ejecuta: ${YELLOW}node diagnosticar-api-resolution.js${NC}"
echo "   3. Verifica que estás logueado correctamente"
echo ""
echo "=================================================="
