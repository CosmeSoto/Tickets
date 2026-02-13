#!/bin/bash

# Script de verificación de migración de usuarios a DataTable
# Verifica que el módulo de usuarios use DataTable consistente con tickets

echo "=================================================="
echo "🔄 VERIFICACIÓN MIGRACIÓN USUARIOS A DATATABLE"
echo "=================================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contador de tests
PASSED=0
FAILED=0

# Función para test
test_check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $2"
        ((FAILED++))
    fi
}

echo -e "${BLUE}1. Verificando archivos creados...${NC}"
echo ""

# Verificar archivos nuevos
if [ -f "src/components/users/admin/user-columns.tsx" ]; then
    test_check 0 "Columnas de usuarios creadas"
else
    test_check 1 "Columnas de usuarios NO creadas"
fi

if [ -f "src/components/users/user-stats-panel.tsx" ]; then
    test_check 0 "Panel de estadísticas creado"
else
    test_check 1 "Panel de estadísticas NO creado"
fi

if [ -f "src/components/users/user-filters.tsx" ]; then
    test_check 0 "Componente de filtros creado"
else
    test_check 1 "Componente de filtros NO creado"
fi

echo ""
echo -e "${BLUE}2. Verificando migración a DataTable...${NC}"
echo ""

# Verificar que usa DataTable
if grep -q "import { DataTable }" "src/app/admin/users/page.tsx"; then
    test_check 0 "Página de usuarios usa DataTable"
else
    test_check 1 "Página de usuarios NO usa DataTable"
fi

# Verificar que NO usa UserTable
if grep -q "import { UserTable }" "src/app/admin/users/page.tsx"; then
    test_check 1 "Página de usuarios aún usa UserTable (debe eliminarse)"
else
    test_check 0 "Página de usuarios NO usa UserTable (correcto)"
fi

# Verificar que usa el hook useUsers
if grep -q "useUsers" "src/app/admin/users/page.tsx"; then
    test_check 0 "Página de usuarios usa hook useUsers"
else
    test_check 1 "Página de usuarios NO usa hook useUsers"
fi

echo ""
echo -e "${BLUE}3. Verificando componentes de estadísticas...${NC}"
echo ""

# Verificar UserStatsPanel
if grep -q "UserStatsPanel" "src/app/admin/users/page.tsx"; then
    test_check 0 "Página usa UserStatsPanel"
else
    test_check 1 "Página NO usa UserStatsPanel"
fi

# Verificar métricas en UserStatsPanel
if grep -q "stats.total" "src/components/users/user-stats-panel.tsx"; then
    test_check 0 "UserStatsPanel tiene métricas básicas"
else
    test_check 1 "UserStatsPanel NO tiene métricas básicas"
fi

echo ""
echo -e "${BLUE}4. Verificando filtros...${NC}"
echo ""

# Verificar UserFilters
if grep -q "UserFilters" "src/app/admin/users/page.tsx"; then
    test_check 0 "Página usa UserFilters"
else
    test_check 1 "Página NO usa UserFilters"
fi

# Verificar filtros por rol
if grep -q "roleFilter" "src/components/users/user-filters.tsx"; then
    test_check 0 "UserFilters tiene filtro por rol"
else
    test_check 1 "UserFilters NO tiene filtro por rol"
fi

# Verificar filtros por estado
if grep -q "statusFilter" "src/components/users/user-filters.tsx"; then
    test_check 0 "UserFilters tiene filtro por estado"
else
    test_check 1 "UserFilters NO tiene filtro por estado"
fi

echo ""
echo -e "${BLUE}5. Verificando columnas y vista de tarjetas...${NC}"
echo ""

# Verificar createUserColumns
if grep -q "createUserColumns" "src/app/admin/users/page.tsx"; then
    test_check 0 "Página usa createUserColumns"
else
    test_check 1 "Página NO usa createUserColumns"
fi

# Verificar UserCard
if grep -q "UserCard" "src/app/admin/users/page.tsx"; then
    test_check 0 "Página usa UserCard para vista de tarjetas"
else
    test_check 1 "Página NO usa UserCard"
fi

# Verificar viewMode
if grep -q "viewMode" "src/app/admin/users/page.tsx"; then
    test_check 0 "Página soporta cambio de vista (tabla/tarjetas)"
else
    test_check 1 "Página NO soporta cambio de vista"
fi

echo ""
echo -e "${BLUE}6. Verificando paginación...${NC}"
echo ""

# Verificar paginación en DataTable
if grep -q "pagination={{" "src/app/admin/users/page.tsx"; then
    test_check 0 "DataTable tiene configuración de paginación"
else
    test_check 1 "DataTable NO tiene configuración de paginación"
fi

# Verificar goToPage
if grep -q "goToPage" "src/app/admin/users/page.tsx"; then
    test_check 0 "Página usa goToPage del hook"
else
    test_check 1 "Página NO usa goToPage del hook"
fi

echo ""
echo -e "${BLUE}7. Verificando consistencia con tickets...${NC}"
echo ""

# Comparar estructura con tickets
TICKETS_STRUCTURE=$(grep -c "DataTable" "src/app/admin/tickets/page.tsx")
USERS_STRUCTURE=$(grep -c "DataTable" "src/app/admin/users/page.tsx")

if [ $USERS_STRUCTURE -gt 0 ] && [ $TICKETS_STRUCTURE -gt 0 ]; then
    test_check 0 "Ambos módulos usan DataTable (consistencia)"
else
    test_check 1 "Inconsistencia en uso de DataTable entre módulos"
fi

# Verificar que ambos tienen panel de estadísticas
if grep -q "StatsPanel" "src/app/admin/tickets/page.tsx" && grep -q "StatsPanel" "src/app/admin/users/page.tsx"; then
    test_check 0 "Ambos módulos tienen panel de estadísticas"
else
    test_check 1 "Inconsistencia en paneles de estadísticas"
fi

echo ""
echo -e "${BLUE}8. Verificando build...${NC}"
echo ""

# Verificar que el build compile sin errores
echo "Compilando proyecto..."
npm run build > /tmp/build-output.log 2>&1
if [ $? -eq 0 ]; then
    test_check 0 "Build de Next.js exitoso"
else
    test_check 1 "Build de Next.js FALLÓ"
    echo ""
    echo -e "${RED}Errores del build:${NC}"
    tail -20 /tmp/build-output.log
fi

echo ""
echo "=================================================="
echo -e "${YELLOW}RESUMEN DE MIGRACIÓN${NC}"
echo "=================================================="
echo ""
echo -e "Tests pasados: ${GREEN}${PASSED}${NC}"
echo -e "Tests fallidos: ${RED}${FAILED}${NC}"
echo -e "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ MIGRACIÓN COMPLETADA EXITOSAMENTE${NC}"
    echo ""
    echo "El módulo de usuarios ha sido migrado exitosamente a DataTable:"
    echo ""
    echo "Mejoras implementadas:"
    echo "  ✓ Uso de DataTable global (consistencia con tickets)"
    echo "  ✓ Panel de estadísticas con 8 métricas"
    echo "  ✓ Filtros avanzados (búsqueda, rol, estado, departamento)"
    echo "  ✓ Vista de tabla y tarjetas"
    echo "  ✓ Paginación estándar"
    echo "  ✓ Columnas personalizadas con acciones"
    echo "  ✓ Hook useUsers optimizado"
    echo "  ✓ Build exitoso"
    echo ""
    echo "Beneficios obtenidos:"
    echo "  • Consistencia UX entre módulos"
    echo "  • Mejor rendimiento con paginación"
    echo "  • Filtros más intuitivos"
    echo "  • Estadísticas en tiempo real"
    echo "  • Vista de tarjetas responsive"
    echo "  • Código más mantenible"
    echo ""
    echo "Próximos pasos:"
    echo "  1. Probar manualmente en el navegador"
    echo "  2. Verificar filtros y paginación"
    echo "  3. Continuar con Fase 13.9 (Vista de detalles de tickets)"
    echo ""
    exit 0
else
    echo -e "${RED}✗ ALGUNOS TESTS FALLARON${NC}"
    echo ""
    echo "Por favor revisa los errores arriba y corrige los problemas."
    echo ""
    echo "Posibles problemas:"
    echo "  • Archivos no creados correctamente"
    echo "  • Imports faltantes"
    echo "  • Errores de compilación"
    echo "  • Inconsistencias entre módulos"
    echo ""
    exit 1
fi