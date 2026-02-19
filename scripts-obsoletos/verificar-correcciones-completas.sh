#!/bin/bash

echo "🔍 Verificación Completa de Correcciones de Prisma"
echo "=================================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

cd "$(dirname "$0")"

echo -e "${BLUE}📋 1. Verificando referencias incorrectas en el código...${NC}"
echo ""

# Verificar _count.children
echo -n "   Buscando '_count.children'... "
CHILDREN_COUNT=$(grep -r "_count.*children" src/ --exclude-dir=node_modules --exclude-dir=.next 2>/dev/null | wc -l | tr -d ' ')
if [ "$CHILDREN_COUNT" -eq "0" ]; then
    echo -e "${GREEN}✓ No encontrado (correcto)${NC}"
else
    echo -e "${RED}✗ Encontradas $CHILDREN_COUNT referencias${NC}"
    grep -r "_count.*children" src/ --exclude-dir=node_modules --exclude-dir=.next
fi

# Verificar assignment.technician
echo -n "   Buscando 'assignment.technician'... "
TECH_COUNT=$(grep -r "assignment\.technician\." src/ --exclude-dir=node_modules --exclude-dir=.next 2>/dev/null | wc -l | tr -d ' ')
if [ "$TECH_COUNT" -eq "0" ]; then
    echo -e "${GREEN}✓ No encontrado (correcto)${NC}"
else
    echo -e "${RED}✗ Encontradas $TECH_COUNT referencias${NC}"
    grep -r "assignment\.technician\." src/ --exclude-dir=node_modules --exclude-dir=.next
fi

# Verificar prisma.technicianAssignment
echo -n "   Buscando 'prisma.technicianAssignment'... "
PRISMA_COUNT=$(grep -r "prisma\.technicianAssignment" src/ --exclude-dir=node_modules --exclude-dir=.next 2>/dev/null | wc -l | tr -d ' ')
if [ "$PRISMA_COUNT" -eq "0" ]; then
    echo -e "${GREEN}✓ No encontrado (correcto)${NC}"
else
    echo -e "${RED}✗ Encontradas $PRISMA_COUNT referencias${NC}"
    grep -r "prisma\.technicianAssignment" src/ --exclude-dir=node_modules --exclude-dir=.next
fi

echo ""
echo -e "${BLUE}📋 2. Validando schema de Prisma...${NC}"
if npx prisma validate > /tmp/prisma-validate.txt 2>&1; then
    echo -e "   ${GREEN}✓ Schema válido${NC}"
else
    echo -e "   ${RED}✗ Error en schema${NC}"
    cat /tmp/prisma-validate.txt
    exit 1
fi

echo ""
echo -e "${BLUE}📋 3. Limpiando build anterior...${NC}"
if [ -d ".next" ]; then
    rm -rf .next
    echo -e "   ${GREEN}✓ Directorio .next eliminado${NC}"
else
    echo -e "   ${YELLOW}⚠ No hay build anterior${NC}"
fi

echo ""
echo -e "${BLUE}📋 4. Compilando proyecto...${NC}"
if npm run build > /tmp/build-output.txt 2>&1; then
    echo -e "   ${GREEN}✓ Compilación exitosa${NC}"
else
    echo -e "   ${RED}✗ Error en compilación${NC}"
    echo ""
    echo "Últimas 30 líneas del error:"
    tail -30 /tmp/build-output.txt
    exit 1
fi

echo ""
echo -e "${BLUE}📋 5. Verificando archivos corregidos...${NC}"

# Lista de archivos que deben estar corregidos
FILES=(
    "src/app/api/categories/route.ts"
    "src/app/api/categories/[id]/route.ts"
    "src/lib/services/category-service.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -n "   $file... "
        # Verificar que use other_categories
        if grep -q "other_categories" "$file"; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${YELLOW}⚠ No usa other_categories${NC}"
        fi
    else
        echo -e "   $file... ${RED}✗ No existe${NC}"
    fi
done

echo ""
echo -e "${BLUE}📋 6. Resumen de correcciones:${NC}"
echo "   • _count.children → _count.other_categories"
echo "   • assignment.technician → assignment.users"
echo "   • prisma.technicianAssignment → prisma.technician_assignments"
echo "   • Validaciones de eliminación actualizadas"

echo ""
echo "=================================================="
if [ "$CHILDREN_COUNT" -eq "0" ] && [ "$TECH_COUNT" -eq "0" ] && [ "$PRISMA_COUNT" -eq "0" ]; then
    echo -e "${GREEN}✅ TODAS LAS VERIFICACIONES PASARON${NC}"
    echo ""
    echo "Próximos pasos:"
    echo "1. Iniciar servidor: npm run dev"
    echo "2. Probar endpoint: curl http://localhost:3000/api/categories?isActive=true"
    echo "3. Verificar en navegador: http://localhost:3000/admin/categories"
else
    echo -e "${RED}❌ ALGUNAS VERIFICACIONES FALLARON${NC}"
    echo ""
    echo "Revisa los errores arriba y corrige antes de continuar."
    exit 1
fi
