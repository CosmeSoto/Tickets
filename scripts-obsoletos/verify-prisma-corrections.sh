#!/bin/bash

# Script de Verificación de Correcciones Prisma
# Verifica que no queden referencias incorrectas en el código

echo "🔍 Verificando correcciones de Prisma..."
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador de errores
ERRORS=0

# 1. Verificar _count.children
echo "1️⃣  Verificando _count.children..."
RESULT=$(grep -r "_count.*children" src/ 2>/dev/null | grep -v "node_modules" | wc -l)
if [ "$RESULT" -eq 0 ]; then
    echo -e "${GREEN}✅ No se encontraron referencias a _count.children${NC}"
else
    echo -e "${RED}❌ Se encontraron $RESULT referencias a _count.children${NC}"
    grep -r "_count.*children" src/ | grep -v "node_modules"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 2. Verificar assignment.technician
echo "2️⃣  Verificando assignment.technician..."
RESULT=$(grep -r "assignment\.technician\." src/ 2>/dev/null | grep -v "node_modules" | wc -l)
if [ "$RESULT" -eq 0 ]; then
    echo -e "${GREEN}✅ No se encontraron referencias a assignment.technician${NC}"
else
    echo -e "${RED}❌ Se encontraron $RESULT referencias a assignment.technician${NC}"
    grep -r "assignment\.technician\." src/ | grep -v "node_modules"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 3. Verificar prisma.technicianAssignment
echo "3️⃣  Verificando prisma.technicianAssignment..."
RESULT=$(grep -r "prisma\.technicianAssignment" src/ 2>/dev/null | grep -v "node_modules" | wc -l)
if [ "$RESULT" -eq 0 ]; then
    echo -e "${GREEN}✅ No se encontraron referencias a prisma.technicianAssignment${NC}"
else
    echo -e "${RED}❌ Se encontraron $RESULT referencias a prisma.technicianAssignment${NC}"
    grep -r "prisma\.technicianAssignment" src/ | grep -v "node_modules"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 4. Verificar prisma.category (singular)
echo "4️⃣  Verificando prisma.category..."
RESULT=$(grep -r "prisma\.category\." src/ 2>/dev/null | grep -v "node_modules" | grep -v "__tests__" | grep -v "deprecated" | wc -l)
if [ "$RESULT" -eq 0 ]; then
    echo -e "${GREEN}✅ No se encontraron referencias a prisma.category${NC}"
else
    echo -e "${YELLOW}⚠️  Se encontraron $RESULT referencias a prisma.category (revisar si son críticas)${NC}"
    grep -r "prisma\.category\." src/ | grep -v "node_modules" | grep -v "__tests__" | grep -v "deprecated"
fi
echo ""

# 5. Verificar prisma.user (singular)
echo "5️⃣  Verificando prisma.user..."
RESULT=$(grep -r "prisma\.user\." src/ 2>/dev/null | grep -v "node_modules" | grep -v "__tests__" | wc -l)
if [ "$RESULT" -eq 0 ]; then
    echo -e "${GREEN}✅ No se encontraron referencias a prisma.user${NC}"
else
    echo -e "${RED}❌ Se encontraron $RESULT referencias a prisma.user${NC}"
    grep -r "prisma\.user\." src/ | grep -v "node_modules" | grep -v "__tests__"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 6. Verificar prisma.ticket (singular)
echo "6️⃣  Verificando prisma.ticket..."
RESULT=$(grep -r "prisma\.ticket\." src/ 2>/dev/null | grep -v "node_modules" | grep -v "__tests__" | wc -l)
if [ "$RESULT" -eq 0 ]; then
    echo -e "${GREEN}✅ No se encontraron referencias a prisma.ticket${NC}"
else
    echo -e "${RED}❌ Se encontraron $RESULT referencias a prisma.ticket${NC}"
    grep -r "prisma\.ticket\." src/ | grep -v "node_modules" | grep -v "__tests__"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 7. Verificar que existen las referencias correctas
echo "7️⃣  Verificando referencias correctas..."
echo ""

echo "   Verificando prisma.categories..."
RESULT=$(grep -r "prisma\.categories\." src/ 2>/dev/null | grep -v "node_modules" | wc -l)
if [ "$RESULT" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Se encontraron $RESULT referencias correctas a prisma.categories${NC}"
else
    echo -e "   ${YELLOW}⚠️  No se encontraron referencias a prisma.categories${NC}"
fi

echo "   Verificando prisma.users..."
RESULT=$(grep -r "prisma\.users\." src/ 2>/dev/null | grep -v "node_modules" | wc -l)
if [ "$RESULT" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Se encontraron $RESULT referencias correctas a prisma.users${NC}"
else
    echo -e "   ${YELLOW}⚠️  No se encontraron referencias a prisma.users${NC}"
fi

echo "   Verificando prisma.technician_assignments..."
RESULT=$(grep -r "prisma\.technician_assignments\." src/ 2>/dev/null | grep -v "node_modules" | wc -l)
if [ "$RESULT" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Se encontraron $RESULT referencias correctas a prisma.technician_assignments${NC}"
else
    echo -e "   ${YELLOW}⚠️  No se encontraron referencias a prisma.technician_assignments${NC}"
fi
echo ""

# Resumen final
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ERRORS" -eq 0 ]; then
    echo -e "${GREEN}✅ VERIFICACIÓN EXITOSA: No se encontraron errores críticos${NC}"
    echo ""
    echo "Próximos pasos:"
    echo "1. Ejecutar: npm run build"
    echo "2. Ejecutar: npm run dev"
    echo "3. Probar endpoints en el navegador"
else
    echo -e "${RED}❌ VERIFICACIÓN FALLIDA: Se encontraron $ERRORS errores críticos${NC}"
    echo ""
    echo "Por favor, corrige los errores antes de continuar."
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit $ERRORS
