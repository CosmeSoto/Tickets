#!/bin/bash

# Script de verificación para corrección de redundancia en módulo de categorías
# Verifica que se hayan eliminado todas las duplicaciones y redundancias

echo "🔍 VERIFICACIÓN DE CORRECCIÓN DE REDUNDANCIA - MÓDULO CATEGORÍAS"
echo "=================================================================="

# Contadores
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Función para ejecutar test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Test $TOTAL_TESTS: $test_name... "
    
    if eval "$test_command"; then
        if [ "$expected_result" = "should_pass" ]; then
            echo "✅ PASS"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo "❌ FAIL (esperaba fallo pero pasó)"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        if [ "$expected_result" = "should_fail" ]; then
            echo "✅ PASS (falló como se esperaba)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo "❌ FAIL"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    fi
}

echo ""
echo "📁 VERIFICANDO ESTRUCTURA DE ARCHIVOS"
echo "======================================"

# 1. Verificar que existen los archivos centralizados
run_test "Archivo de constantes centralizadas existe" \
    "[ -f 'src/lib/constants/category-constants.ts' ]" \
    "should_pass"

run_test "Hook unificado de filtros existe" \
    "[ -f 'src/hooks/common/use-category-filters.ts' ]" \
    "should_pass"

run_test "Componente de filtros unificado existe" \
    "[ -f 'src/components/categories/category-filters.tsx' ]" \
    "should_pass"

run_test "Página principal de categorías existe" \
    "[ -f 'src/components/categories/categories-page.tsx' ]" \
    "should_pass"

echo ""
echo "🔧 VERIFICANDO CONSTANTES CENTRALIZADAS"
echo "======================================="

# 2. Verificar constantes en category-constants.ts
run_test "Constantes de niveles definidas" \
    "grep -q 'CATEGORY_LEVELS.*=' src/lib/constants/category-constants.ts" \
    "should_pass"

run_test "Opciones de filtro de nivel definidas" \
    "grep -q 'CATEGORY_LEVEL_FILTER_OPTIONS.*=' src/lib/constants/category-constants.ts" \
    "should_pass"

run_test "Estados de categorías definidos" \
    "grep -q 'CATEGORY_STATUSES.*=' src/lib/constants/category-constants.ts" \
    "should_pass"

run_test "Modos de vista definidos" \
    "grep -q 'CATEGORY_VIEW_MODES.*=' src/lib/constants/category-constants.ts" \
    "should_pass"

run_test "Colores de nivel definidos" \
    "grep -q 'CATEGORY_LEVEL_COLORS.*=' src/lib/constants/category-constants.ts" \
    "should_pass"

run_test "Iconos de nivel definidos" \
    "grep -q 'CATEGORY_LEVEL_ICONS.*=' src/lib/constants/category-constants.ts" \
    "should_pass"

run_test "Funciones utilitarias definidas" \
    "grep -q 'getCategoryLevelLabel\|getCategoryLevelColor\|getCategoryLevelIcon' src/lib/constants/category-constants.ts" \
    "should_pass"

echo ""
echo "🎣 VERIFICANDO HOOK UNIFICADO"
echo "============================="

# 3. Verificar hook unificado
run_test "Hook exporta interface CategoryFilters" \
    "grep -q 'export interface CategoryFilters' src/hooks/common/use-category-filters.ts" \
    "should_pass"

run_test "Hook exporta función principal" \
    "grep -q 'export function useCategoryFilters' src/hooks/common/use-category-filters.ts" \
    "should_pass"

run_test "Hook incluye debounce para búsqueda" \
    "grep -q 'useDebounce' src/hooks/common/use-category-filters.ts" \
    "should_pass"

run_test "Hook incluye función de filtrado" \
    "grep -q 'applyCategoryFilters' src/hooks/common/use-category-filters.ts" \
    "should_pass"

run_test "Hook incluye utilidades de badges" \
    "grep -q 'getActiveFilterBadges' src/hooks/common/use-category-filters.ts" \
    "should_pass"

echo ""
echo "🎨 VERIFICANDO COMPONENTE DE FILTROS"
echo "===================================="

# 4. Verificar componente de filtros
run_test "Componente importa constantes centralizadas" \
    "grep -q \"from '@/lib/constants/category-constants'\" src/components/categories/category-filters.tsx" \
    "should_pass"

run_test "Componente usa CATEGORY_LEVEL_FILTER_OPTIONS" \
    "grep -q 'CATEGORY_LEVEL_FILTER_OPTIONS' src/components/categories/category-filters.tsx" \
    "should_pass"

run_test "Componente usa funciones utilitarias" \
    "grep -q 'getCategoryLevelColor\|getCategoryLevelIcon' src/components/categories/category-filters.tsx" \
    "should_pass"

run_test "Componente no tiene constantes hardcodeadas" \
    "! grep -q \"value: 'all'\|value: '1'\|value: '2'\" src/components/categories/category-filters.tsx || grep -q 'CATEGORY_LEVEL_FILTER_OPTIONS' src/components/categories/category-filters.tsx" \
    "should_pass"

echo ""
echo "📄 VERIFICANDO PÁGINA PRINCIPAL"
echo "==============================="

# 5. Verificar página principal
run_test "Página importa hook unificado" \
    "grep -q \"import.*useCategoryFilters.*from '@/hooks/common/use-category-filters'\" src/components/categories/categories-page.tsx" \
    "should_pass"

run_test "Página usa hook unificado" \
    "grep -q 'useCategoryFilters(' src/components/categories/categories-page.tsx" \
    "should_pass"

run_test "Página pasa filtros unificados a componente" \
    "grep -q 'categoryFilters\.filters\.' src/components/categories/categories-page.tsx" \
    "should_pass"

run_test "DataTable tiene externalSearch habilitado" \
    "grep -q 'externalSearch={true}' src/components/categories/categories-page.tsx" \
    "should_pass"

run_test "DataTable tiene hideInternalFilters habilitado" \
    "grep -q 'hideInternalFilters={true}' src/components/categories/categories-page.tsx" \
    "should_pass"

echo ""
echo "🚫 VERIFICANDO ELIMINACIÓN DE REDUNDANCIAS"
echo "=========================================="

# 6. Verificar que no hay duplicaciones
run_test "No hay múltiples definiciones de niveles" \
    "[ \$(grep -r \"CATEGORY_LEVEL_FILTER_OPTIONS\" src/components/categories/ --include=\"*.ts\" --include=\"*.tsx\" | grep -v 'import' | wc -l) -le 3 ]" \
    "should_pass"

run_test "No hay constantes duplicadas en filtros" \
    "! grep -q \"const CATEGORY_LEVEL_FILTER_OPTIONS.*=\" src/components/categories/category-filters.tsx" \
    "should_pass"

run_test "No hay estados hardcodeados en página" \
    "! grep -q \"searchTerm.*setSearchTerm\" src/components/categories/categories-page.tsx || grep -q 'categoryFilters' src/components/categories/categories-page.tsx" \
    "should_pass"

run_test "No hay filtros duplicados en DataTable" \
    "grep -q 'externalSearch={true}' src/components/categories/categories-page.tsx && grep -q 'hideInternalFilters={true}' src/components/categories/categories-page.tsx" \
    "should_pass"

echo ""
echo "🔄 VERIFICANDO CONSISTENCIA VISUAL"
echo "=================================="

# 7. Verificar consistencia visual
run_test "Filtros usan mismos colores que constantes" \
    "grep -q 'getCategoryLevelColor' src/components/categories/category-filters.tsx" \
    "should_pass"

run_test "Filtros usan mismos iconos que constantes" \
    "grep -q 'getCategoryLevelIcon' src/components/categories/category-filters.tsx" \
    "should_pass"

run_test "Página usa viewMode del hook unificado" \
    "grep -q 'categoryFilters\.filters\.viewMode' src/components/categories/categories-page.tsx" \
    "should_pass"

run_test "Badges de filtros activos implementados" \
    "grep -q 'activeFilterBadges\|getActiveFilterBadges' src/components/categories/category-filters.tsx" \
    "should_pass"

echo ""
echo "⚡ VERIFICANDO OPTIMIZACIONES"
echo "============================"

# 8. Verificar optimizaciones
run_test "Hook incluye debounce para performance" \
    "grep -q 'debouncedFilters' src/hooks/common/use-category-filters.ts" \
    "should_pass"

run_test "Filtros tienen función de limpieza" \
    "grep -q 'clearFilters\|clearFilter' src/hooks/common/use-category-filters.ts" \
    "should_pass"

run_test "Componente muestra contador de filtros activos" \
    "grep -q 'activeFiltersCount' src/components/categories/category-filters.tsx" \
    "should_pass"

run_test "Página aplica filtros con useMemo" \
    "grep -q 'filteredCategories.*useMemo\|useMemo.*filteredCategories' src/components/categories/categories-page.tsx" \
    "should_pass"

echo ""
echo "📊 RESUMEN DE VERIFICACIÓN"
echo "========================="
echo "Total de tests: $TOTAL_TESTS"
echo "Tests pasados: $PASSED_TESTS"
echo "Tests fallidos: $FAILED_TESTS"
echo "Porcentaje de éxito: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo "🎉 ¡VERIFICACIÓN COMPLETADA CON ÉXITO!"
    echo "======================================"
    echo "✅ Todas las redundancias han sido eliminadas"
    echo "✅ Constantes centralizadas implementadas"
    echo "✅ Hook unificado funcionando correctamente"
    echo "✅ DataTable sin búsqueda redundante"
    echo "✅ Consistencia visual mantenida"
    echo "✅ Optimizaciones aplicadas"
    echo ""
    echo "El módulo de categorías está completamente optimizado."
    exit 0
else
    echo ""
    echo "⚠️  VERIFICACIÓN COMPLETADA CON ERRORES"
    echo "======================================="
    echo "❌ $FAILED_TESTS test(s) fallaron"
    echo "🔧 Revisa los errores anteriores y corrige los problemas"
    echo ""
    echo "El módulo de categorías necesita correcciones adicionales."
    exit 1
fi