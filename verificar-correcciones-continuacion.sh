#!/bin/bash

# Script de verificación de correcciones aplicadas
# Fecha: 5 de Febrero, 2026

echo "=================================================="
echo "🔍 VERIFICACIÓN DE CORRECCIONES APLICADAS"
echo "=================================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador de verificaciones
PASSED=0
FAILED=0

# Función para verificar
check() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAILED++))
  fi
}

echo "1️⃣  Verificando Prisma Client..."
echo "-----------------------------------"
if [ -d "node_modules/@prisma/client" ]; then
  echo -e "${GREEN}✅ PASS${NC}: Prisma Client existe"
  ((PASSED++))
  
  # Verificar que tiene los modelos nuevos
  if grep -q "resolution_plans" node_modules/@prisma/client/index.d.ts 2>/dev/null; then
    echo -e "${GREEN}✅ PASS${NC}: Modelo resolution_plans encontrado"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC}: Modelo resolution_plans NO encontrado"
    ((FAILED++))
  fi
  
  if grep -q "resolution_tasks" node_modules/@prisma/client/index.d.ts 2>/dev/null; then
    echo -e "${GREEN}✅ PASS${NC}: Modelo resolution_tasks encontrado"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC}: Modelo resolution_tasks NO encontrado"
    ((FAILED++))
  fi
else
  echo -e "${RED}❌ FAIL${NC}: Prisma Client NO existe"
  ((FAILED++))
fi
echo ""

echo "2️⃣  Verificando Enlaces de Navegación..."
echo "-----------------------------------"
if grep -q "Base de Conocimientos.*admin/knowledge" src/components/layout/role-dashboard-layout.tsx; then
  echo -e "${GREEN}✅ PASS${NC}: Enlace Admin encontrado"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: Enlace Admin NO encontrado"
  ((FAILED++))
fi

if grep -q "Base de Conocimientos.*technician/knowledge" src/components/layout/role-dashboard-layout.tsx; then
  echo -e "${GREEN}✅ PASS${NC}: Enlace Técnico encontrado"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: Enlace Técnico NO encontrado"
  ((FAILED++))
fi

if grep -q "Base de Conocimientos.*/knowledge" src/components/layout/role-dashboard-layout.tsx; then
  echo -e "${GREEN}✅ PASS${NC}: Enlace Cliente encontrado"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: Enlace Cliente NO encontrado"
  ((FAILED++))
fi
echo ""

echo "3️⃣  Verificando Página de Creación de Artículos..."
echo "-----------------------------------"
if [ -f "src/app/technician/knowledge/new/page.tsx" ]; then
  echo -e "${GREEN}✅ PASS${NC}: Página de creación existe"
  ((PASSED++))
  
  # Verificar características clave
  if grep -q "createArticle" src/app/technician/knowledge/new/page.tsx; then
    echo -e "${GREEN}✅ PASS${NC}: Hook createArticle implementado"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC}: Hook createArticle NO encontrado"
    ((FAILED++))
  fi
  
  if grep -q "ReactMarkdown" src/app/technician/knowledge/new/page.tsx; then
    echo -e "${GREEN}✅ PASS${NC}: Editor Markdown implementado"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC}: Editor Markdown NO encontrado"
    ((FAILED++))
  fi
  
  if grep -q "flex-wrap" src/app/technician/knowledge/new/page.tsx; then
    echo -e "${GREEN}✅ PASS${NC}: Patrón responsivo aplicado"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠️  WARN${NC}: Patrón responsivo podría no estar completo"
  fi
else
  echo -e "${RED}❌ FAIL${NC}: Página de creación NO existe"
  ((FAILED++))
fi
echo ""

echo "4️⃣  Verificando Patrón Responsivo en Técnico..."
echo "-----------------------------------"
if grep -q "flex-wrap" src/app/technician/tickets/\[id\]/page.tsx; then
  echo -e "${GREEN}✅ PASS${NC}: flex-wrap aplicado"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: flex-wrap NO aplicado"
  ((FAILED++))
fi

if grep -q "hidden sm:inline" src/app/technician/tickets/\[id\]/page.tsx; then
  echo -e "${GREEN}✅ PASS${NC}: Textos responsivos aplicados"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: Textos responsivos NO aplicados"
  ((FAILED++))
fi

if grep -q "gap-2" src/app/technician/tickets/\[id\]/page.tsx; then
  echo -e "${GREEN}✅ PASS${NC}: Espaciado gap-2 aplicado"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: Espaciado gap-2 NO aplicado"
  ((FAILED++))
fi
echo ""

echo "5️⃣  Verificando Patrón Responsivo en Cliente..."
echo "-----------------------------------"
if grep -q "flex-wrap" src/app/client/tickets/\[id\]/page.tsx; then
  echo -e "${GREEN}✅ PASS${NC}: flex-wrap aplicado"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: flex-wrap NO aplicado"
  ((FAILED++))
fi

if grep -q "hidden sm:inline" src/app/client/tickets/\[id\]/page.tsx; then
  echo -e "${GREEN}✅ PASS${NC}: Textos responsivos aplicados"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: Textos responsivos NO aplicados"
  ((FAILED++))
fi

if grep -q "gap-2" src/app/client/tickets/\[id\]/page.tsx; then
  echo -e "${GREEN}✅ PASS${NC}: Espaciado gap-2 aplicado"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: Espaciado gap-2 NO aplicado"
  ((FAILED++))
fi
echo ""

echo "6️⃣  Verificando Errores de TypeScript..."
echo "-----------------------------------"
if npm run build --dry-run 2>&1 | grep -q "error TS"; then
  echo -e "${RED}❌ FAIL${NC}: Hay errores de TypeScript"
  ((FAILED++))
else
  echo -e "${GREEN}✅ PASS${NC}: No hay errores de TypeScript"
  ((PASSED++))
fi
echo ""

# Resumen
echo "=================================================="
echo "📊 RESUMEN DE VERIFICACIÓN"
echo "=================================================="
echo -e "${GREEN}✅ Pasadas: $PASSED${NC}"
echo -e "${RED}❌ Fallidas: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 ¡TODAS LAS VERIFICACIONES PASARON!${NC}"
  echo ""
  echo "✅ Sistema listo para pruebas"
  echo ""
  echo "Próximos pasos:"
  echo "1. Iniciar servidor: npm run dev"
  echo "2. Probar creación de artículos en /technician/knowledge/new"
  echo "3. Verificar responsividad en móvil"
  echo "4. Probar API de Resolution Plan"
  exit 0
else
  echo -e "${RED}⚠️  ALGUNAS VERIFICACIONES FALLARON${NC}"
  echo ""
  echo "Por favor revisa los errores arriba y corrige antes de continuar."
  exit 1
fi
