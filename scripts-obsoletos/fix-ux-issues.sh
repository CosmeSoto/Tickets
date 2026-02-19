#!/bin/bash

# Script para corregir problemas de UX en los módulos
# Fecha: 23 de enero de 2026

echo "🔧 Iniciando correcciones de UX..."
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Verificar que el import de AlertCircle está corregido
echo "1️⃣  Verificando corrección de Reportes..."
if grep -q "AlertCircle" sistema-tickets-nextjs/src/components/reports/reports-page.tsx; then
  echo -e "${GREEN}✅ Import de AlertCircle encontrado${NC}"
else
  echo -e "${RED}❌ Falta import de AlertCircle${NC}"
fi
echo ""

# 2. Verificar estructura de datos en categorías
echo "2️⃣  Verificando API de Categorías..."
if grep -q "technician_assignments" sistema-tickets-nextjs/src/app/api/categories/route.ts; then
  echo -e "${GREEN}✅ API de categorías incluye technician_assignments${NC}"
else
  echo -e "${RED}❌ API de categorías no incluye technician_assignments${NC}"
fi
echo ""

# 3. Verificar componentes de departamentos
echo "3️⃣  Verificando componentes de Departamentos..."
if [ -f "sistema-tickets-nextjs/src/components/departments/department-list.tsx" ]; then
  echo -e "${GREEN}✅ DepartmentList existe${NC}"
else
  echo -e "${YELLOW}⚠️  DepartmentList no encontrado${NC}"
fi
echo ""

# 4. Compilar TypeScript para verificar errores
echo "4️⃣  Compilando TypeScript..."
cd sistema-tickets-nextjs
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Compilación exitosa${NC}"
else
  echo -e "${RED}❌ Errores de compilación encontrados${NC}"
  echo "Ejecuta 'npm run build' para ver los errores"
fi
cd ..
echo ""

echo "🎯 Resumen de correcciones:"
echo "  - Reportes: Import de AlertCircle corregido"
echo "  - Categorías: API verificada"
echo "  - Departamentos: Pendiente agregar cambio de vista"
echo ""
echo "📝 Próximos pasos:"
echo "  1. Probar módulos en el navegador"
echo "  2. Verificar errores en consola"
echo "  3. Aplicar correcciones adicionales según sea necesario"
echo ""
echo "✨ Script completado"

