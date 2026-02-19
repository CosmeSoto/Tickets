#!/bin/bash

echo "🔧 Corrección Completa del Módulo de Categorías"
echo "=============================================="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Paso 1: Limpiar caches
echo "📦 Paso 1: Limpiando caches..."
rm -rf .next
rm -rf node_modules/.cache
echo -e "${GREEN}✓${NC} Caches limpiados"
echo ""

# Paso 2: Regenerar cliente de Prisma
echo "🔄 Paso 2: Regenerando cliente de Prisma..."
npx prisma generate > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓${NC} Cliente de Prisma regenerado"
else
  echo -e "${RED}✗${NC} Error al regenerar cliente de Prisma"
  exit 1
fi
echo ""

# Paso 3: Verificar archivos críticos
echo "📝 Paso 3: Verificando archivos críticos..."

files=(
  "src/app/api/categories/route.ts"
  "src/components/categories/categories-page.tsx"
  "src/hooks/categories/types.ts"
  "src/hooks/categories/use-categories-data.ts"
)

all_exist=true
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $file"
  else
    echo -e "${RED}✗${NC} $file (no encontrado)"
    all_exist=false
  fi
done

if [ "$all_exist" = false ]; then
  echo -e "${RED}Error: Faltan archivos críticos${NC}"
  exit 1
fi
echo ""

# Paso 4: Verificar estructura de datos en API
echo "🔍 Paso 4: Verificando estructura de API..."
if grep -q "technician_assignments:" "src/app/api/categories/route.ts"; then
  if grep -q "users:" "src/app/api/categories/route.ts"; then
    echo -e "${GREEN}✓${NC} API incluye technician_assignments con users"
  else
    echo -e "${YELLOW}⚠${NC} API no incluye relación users"
  fi
else
  echo -e "${RED}✗${NC} API no incluye technician_assignments"
fi
echo ""

# Paso 5: Verificar tipos TypeScript
echo "📘 Paso 5: Verificando tipos TypeScript..."
if grep -q "technician_assignments:" "src/hooks/categories/types.ts"; then
  if grep -q "users:" "src/hooks/categories/types.ts"; then
    echo -e "${GREEN}✓${NC} Tipos incluyen technician_assignments con users"
  else
    echo -e "${YELLOW}⚠${NC} Tipos no incluyen relación users"
  fi
else
  echo -e "${RED}✗${NC} Tipos no incluyen technician_assignments"
fi
echo ""

# Paso 6: Verificar componente
echo "⚛️  Paso 6: Verificando componente..."
if grep -q "cat.technician_assignments" "src/components/categories/categories-page.tsx"; then
  if grep -q "ta.users" "src/components/categories/categories-page.tsx"; then
    echo -e "${GREEN}✓${NC} Componente usa technician_assignments y users"
  else
    echo -e "${RED}✗${NC} Componente no accede a users correctamente"
  fi
else
  echo -e "${RED}✗${NC} Componente no accede a technician_assignments"
fi
echo ""

# Resumen
echo "=============================================="
echo "✨ Corrección completada"
echo ""
echo "Próximos pasos:"
echo "1. Ejecutar: ${GREEN}npm run dev${NC}"
echo "2. Abrir navegador en: ${GREEN}http://localhost:3000/admin/categories${NC}"
echo "3. Hacer Hard Refresh: ${GREEN}Ctrl+Shift+R${NC} (Windows/Linux) o ${GREEN}Cmd+Shift+R${NC} (Mac)"
echo "4. Verificar logs en consola del navegador"
echo ""
echo "Si el error persiste:"
echo "- Ejecutar: ${GREEN}./test-categories-api.sh${NC} (con servidor corriendo)"
echo "- Revisar: ${GREEN}DIAGNOSTICO_CATEGORIAS.md${NC}"
echo ""
