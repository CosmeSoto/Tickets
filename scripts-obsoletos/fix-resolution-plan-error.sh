#!/bin/bash

# Script para corregir el error 500 en API de Resolution Plan
# Fecha: 5 de Febrero, 2026

echo "=================================================="
echo "🔧 CORRECCIÓN ERROR 500 - API RESOLUTION PLAN"
echo "=================================================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Paso 1: Limpiar caché de Next.js
echo "1️⃣  Limpiando caché de Next.js..."
if [ -d ".next" ]; then
  rm -rf .next
  echo -e "${GREEN}✅ Caché de Next.js eliminado${NC}"
else
  echo -e "${YELLOW}⚠️  No hay caché de Next.js para eliminar${NC}"
fi
echo ""

# Paso 2: Limpiar cliente de Prisma
echo "2️⃣  Limpiando cliente de Prisma..."
if [ -d "node_modules/.prisma" ]; then
  rm -rf node_modules/.prisma
  echo -e "${GREEN}✅ Cliente de Prisma eliminado${NC}"
else
  echo -e "${YELLOW}⚠️  No hay cliente de Prisma para eliminar${NC}"
fi
echo ""

# Paso 3: Regenerar cliente de Prisma
echo "3️⃣  Regenerando cliente de Prisma..."
npx prisma generate
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Cliente de Prisma regenerado exitosamente${NC}"
else
  echo -e "${RED}❌ Error al regenerar cliente de Prisma${NC}"
  exit 1
fi
echo ""

# Paso 4: Verificar que los modelos existen
echo "4️⃣  Verificando modelos en cliente..."
if grep -q "resolution_plans:" node_modules/.prisma/client/index.d.ts; then
  echo -e "${GREEN}✅ Modelo resolution_plans encontrado${NC}"
else
  echo -e "${RED}❌ Modelo resolution_plans NO encontrado${NC}"
  exit 1
fi

if grep -q "resolution_tasks:" node_modules/.prisma/client/index.d.ts; then
  echo -e "${GREEN}✅ Modelo resolution_tasks encontrado${NC}"
else
  echo -e "${RED}❌ Modelo resolution_tasks NO encontrado${NC}"
  exit 1
fi
echo ""

# Paso 5: Ejecutar test de Prisma
echo "5️⃣  Ejecutando test de Prisma..."
node test-prisma-resolution.js
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Test de Prisma exitoso${NC}"
else
  echo -e "${RED}❌ Test de Prisma falló${NC}"
  exit 1
fi
echo ""

# Resumen
echo "=================================================="
echo "✅ CORRECCIÓN COMPLETADA"
echo "=================================================="
echo ""
echo -e "${GREEN}Todo está listo.${NC} Ahora debes:"
echo ""
echo "1. Si el servidor está corriendo, detenerlo (Ctrl+C)"
echo "2. Iniciar el servidor: ${YELLOW}npm run dev${NC}"
echo "3. Navegar a un ticket y verificar el tab 'Plan de Resolución'"
echo ""
echo "El error 500 debería estar resuelto."
echo ""
echo "=================================================="
