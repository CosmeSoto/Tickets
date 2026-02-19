#!/bin/bash

# Verificación rápida de correcciones
# Ejecutar después de reiniciar el servidor

echo "🔍 VERIFICACIÓN RÁPIDA DE CORRECCIONES"
echo "======================================"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

PASSED=0
FAILED=0

# 1. Verificar que Prisma está actualizado
echo "1. Verificando Prisma..."
if grep -q "resolution_plans:" node_modules/.prisma/client/index.d.ts 2>/dev/null; then
  echo -e "${GREEN}✅ Prisma actualizado${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Prisma NO actualizado${NC}"
  ((FAILED++))
fi

# 2. Verificar corrección en técnico
echo "2. Verificando corrección en técnico..."
if grep -q "articleId !== 'create' && articleId !== 'new'" src/app/technician/knowledge/\[id\]/page.tsx; then
  echo -e "${GREEN}✅ Corrección aplicada en técnico${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Corrección NO aplicada en técnico${NC}"
  ((FAILED++))
fi

# 3. Verificar corrección en admin
echo "3. Verificando corrección en admin..."
if grep -q "articleId !== 'create' && articleId !== 'new'" src/app/admin/knowledge/\[id\]/page.tsx; then
  echo -e "${GREEN}✅ Corrección aplicada en admin${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Corrección NO aplicada en admin${NC}"
  ((FAILED++))
fi

# 4. Verificar enlaces de navegación
echo "4. Verificando enlaces de navegación..."
if grep -q "Base de Conocimientos.*admin/knowledge" src/components/layout/role-dashboard-layout.tsx && \
   grep -q "Base de Conocimientos.*technician/knowledge" src/components/layout/role-dashboard-layout.tsx; then
  echo -e "${GREEN}✅ Enlaces de navegación agregados${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Enlaces de navegación NO agregados${NC}"
  ((FAILED++))
fi

# 5. Verificar página de creación
echo "5. Verificando página de creación..."
if [ -f "src/app/technician/knowledge/new/page.tsx" ]; then
  echo -e "${GREEN}✅ Página de creación existe${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Página de creación NO existe${NC}"
  ((FAILED++))
fi

# 6. Verificar patrón responsivo
echo "6. Verificando patrón responsivo..."
if grep -q "flex-wrap" src/app/technician/tickets/\[id\]/page.tsx && \
   grep -q "flex-wrap" src/app/client/tickets/\[id\]/page.tsx; then
  echo -e "${GREEN}✅ Patrón responsivo aplicado${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Patrón responsivo NO aplicado${NC}"
  ((FAILED++))
fi

echo ""
echo "======================================"
echo "RESULTADO: $PASSED pasadas, $FAILED fallidas"
echo "======================================"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ TODAS LAS CORRECCIONES APLICADAS${NC}"
  echo ""
  echo "Ahora verifica manualmente:"
  echo "1. Navega a un ticket y verifica el tab 'Plan de Resolución'"
  echo "2. Navega a /technician/knowledge/new"
  echo "3. Verifica que no hay errores 404 o 500 en consola"
  echo ""
  exit 0
else
  echo -e "${RED}❌ ALGUNAS CORRECCIONES FALTANTES${NC}"
  echo ""
  echo "Ejecuta: bash fix-resolution-plan-error.sh"
  echo ""
  exit 1
fi
