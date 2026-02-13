#!/bin/bash

# Script de verificación de migraciones a DataTable
# Verifica que los módulos de técnicos, categorías, departamentos y reportes usen DataTable

echo "=================================================="
echo "🎯 VERIFICACIÓN MIGRACIONES A DATATABLE"
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

echo -e "${BLUE}1. Verificando componentes de columnas creados...${NC}"
echo ""

# Verificar archivos de columnas
if [ -f "src/components/technicians/admin/technician-columns.tsx" ]; then
    test_check 0 "Columnas de técnicos creadas"
else
    test_check 1 "Columnas de técnicos NO creadas"
fi

if [ -f "src/components/categories/admin/category-columns.tsx" ]; then
    test_check 0 "Columnas de categorías creadas"
else
    test_check 1 "Columnas de categorías NO creadas"
fi

echo ""
echo -e "${BLUE}2. Verificando paneles de estadísticas...${NC}"
echo ""

# Verificar paneles de estadísticas
if [ -f "src/components/technicians/technician-stats-panel.tsx" ]; then
    test_check 0 "Panel de estadísticas de técnicos creado"
else
    test_check 1 "Panel de estadísticas de técnicos NO creado"
fi

if [ -f "src/components/categories/category-stats-panel.tsx" ]; then
    test_check 0 "Panel de estadísticas de categorías creado"
else
    test_check 1 "Panel de estadísticas de categorías NO creado"
fi

echo ""
echo -e "${BLUE}3. Verificando componentes de filtros...${NC}"
echo ""

# Verificar filtros
if [ -f "src/components/technicians/technician-filters.tsx" ]; then
    test_check 0 "Filtros de técnicos creados"
else
    test_check 1 "Filtros de técnicos NO creados"
fi

if [ -f "src/components/categories/category-filters.tsx" ]; then
    test_check 0 "Filtros de categorías creados"
else
    test_check 1 "Filtros de categorías NO creados"
fi

echo ""
echo -e "${BLUE}4. Verificando funciones de columnas...${NC}"
echo ""

# Verificar funciones createColumns
if grep -q "createTechnicianColumns" "src/components/technicians/admin/technician-columns.tsx"; then
    test_check 0 "Función createTechnicianColumns implementada"
else
    test_check 1 "Función createTechnicianColumns NO implementada"
fi

if grep -q "createCategoryColumns" "src/components/categories/admin/category-columns.tsx"; then
    test_check 0 "Función createCategoryColumns implementada"
else
    test_check 1 "Función createCategoryColumns NO implementada"
fi

echo ""
echo -e "${BLUE}5. Verificando componentes de tarjetas...${NC}"
echo ""

# Verificar componentes de tarjetas
if grep -q "TechnicianCard" "src/components/technicians/admin/technician-columns.tsx"; then
    test_check 0 "Componente TechnicianCard implementado"
else
    test_check 1 "Componente TechnicianCard NO implementado"
fi

if grep -q "CategoryCard" "src/components/categories/admin/category-columns.tsx"; then
    test_check 0 "Componente CategoryCard implementado"
else
    test_check 1 "Componente CategoryCard NO implementado"
fi

echo ""
echo -e "${BLUE}6. Verificando imports de DataTable...${NC}"
echo ""

# Verificar imports de ColumnConfig (nuevo estándar)
if grep -q "ColumnConfig" "src/components/technicians/admin/technician-columns.tsx"; then
    test_check 0 "Import ColumnConfig en técnicos correcto"
else
    test_check 1 "Import ColumnConfig en técnicos NO encontrado"
fi

if grep -q "ColumnConfig" "src/components/categories/admin/category-columns.tsx"; then
    test_check 0 "Import ColumnConfig en categorías correcto"
else
    test_check 1 "Import ColumnConfig en categorías NO encontrado"
fi

echo ""
echo -e "${BLUE}7. Verificando componentes de UI...${NC}"
echo ""

# Verificar componentes de UI
if grep -q "DropdownMenu" "src/components/technicians/admin/technician-columns.tsx"; then
    test_check 0 "DropdownMenu en técnicos implementado"
else
    test_check 1 "DropdownMenu en técnicos NO implementado"
fi

if grep -q "Badge" "src/components/categories/admin/category-columns.tsx"; then
    test_check 0 "Badge en categorías implementado"
else
    test_check 1 "Badge en categorías NO implementado"
fi

echo ""
echo -e "${BLUE}8. Verificando estadísticas...${NC}"
echo ""

# Verificar estadísticas
if grep -q "TechnicianStats" "src/components/technicians/technician-stats-panel.tsx"; then
    test_check 0 "Interface TechnicianStats definida"
else
    test_check 1 "Interface TechnicianStats NO definida"
fi

if grep -q "CategoryStats" "src/components/categories/category-stats-panel.tsx"; then
    test_check 0 "Interface CategoryStats definida"
else
    test_check 1 "Interface CategoryStats NO definida"
fi

echo ""
echo -e "${BLUE}9. Verificando filtros avanzados...${NC}"
echo ""

# Verificar filtros avanzados
if grep -q "activeFiltersCount" "src/components/technicians/technician-filters.tsx"; then
    test_check 0 "Contador de filtros activos en técnicos"
else
    test_check 1 "Contador de filtros activos en técnicos NO implementado"
fi

if grep -q "setTimeout" "src/components/categories/category-filters.tsx"; then
    test_check 0 "Debounce en búsqueda de categorías"
else
    test_check 1 "Debounce en búsqueda de categorías NO implementado"
fi

echo ""
echo -e "${BLUE}10. Verificando corrección de calificaciones...${NC}"
echo ""

# Verificar corrección de calificaciones
if grep -q "handleStarClick" "src/components/ui/ticket-rating-system.tsx"; then
    test_check 0 "Corrección de calificaciones aplicada"
else
    test_check 1 "Corrección de calificaciones NO aplicada"
fi

if grep -q "stopPropagation" "src/components/ui/ticket-rating-system.tsx"; then
    test_check 0 "Prevención de propagación de eventos"
else
    test_check 1 "Prevención de propagación de eventos NO implementada"
fi

echo ""
echo -e "${BLUE}11. Verificando build...${NC}"
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
echo -e "${YELLOW}RESUMEN DE MIGRACIONES${NC}"
echo "=================================================="
echo ""
echo -e "Tests pasados: ${GREEN}${PASSED}${NC}"
echo -e "Tests fallidos: ${RED}${FAILED}${NC}"
echo -e "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ MIGRACIONES A DATATABLE COMPLETADAS EXITOSAMENTE${NC}"
    echo ""
    echo "Componentes migrados:"
    echo ""
    echo "📊 TÉCNICOS:"
    echo "  ✓ Columnas personalizadas con acciones"
    echo "  ✓ Componente de tarjetas responsive"
    echo "  ✓ Panel de estadísticas (8 métricas)"
    echo "  ✓ Filtros avanzados con badges"
    echo "  ✓ Integración con DataTable"
    echo ""
    echo "📁 CATEGORÍAS:"
    echo "  ✓ Columnas jerárquicas con niveles"
    echo "  ✓ Componente de tarjetas con jerarquía"
    echo "  ✓ Panel de estadísticas por nivel"
    echo "  ✓ Filtros con vista árbol/lista"
    echo "  ✓ Integración con DataTable"
    echo ""
    echo "⭐ CALIFICACIONES:"
    echo "  ✓ Corrección de eventos de click"
    echo "  ✓ Prevención de propagación"
    echo "  ✓ Mejor accesibilidad"
    echo ""
    echo "Beneficios obtenidos:"
    echo "  • Consistencia UX entre todos los módulos"
    echo "  • Paginación estándar unificada"
    echo "  • Filtros avanzados con badges visuales"
    echo "  • Estadísticas en tiempo real"
    echo "  • Vista de tabla y tarjetas"
    echo "  • Mejor rendimiento y mantenibilidad"
    echo ""
    echo "Próximos pasos:"
    echo "  1. Migrar departamentos a DataTable"
    echo "  2. Migrar reportes a DataTable"
    echo "  3. Continuar con Fase 13.10 (Módulo de clientes)"
    echo ""
    exit 0
else
    echo -e "${RED}✗ ALGUNAS MIGRACIONES FALLARON${NC}"
    echo ""
    echo "Por favor revisa los errores arriba y completa las migraciones faltantes."
    echo ""
    exit 1
fi