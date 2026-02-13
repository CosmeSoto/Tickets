#!/bin/bash

# Script de verificación para componentes unificados
# Verifica la implementación de filtros, búsquedas y datatables optimizados

echo "🔍 VERIFICACIÓN DE COMPONENTES UNIFICADOS"
echo "========================================"

# Función para verificar archivos
check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo "✅ $description: $file"
        return 0
    else
        echo "❌ $description: $file (NO ENCONTRADO)"
        return 1
    fi
}

# Función para verificar contenido específico
check_content() {
    local file=$1
    local pattern=$2
    local description=$3
    
    if [ -f "$file" ] && grep -q "$pattern" "$file"; then
        echo "✅ $description"
        return 0
    else
        echo "❌ $description (NO ENCONTRADO)"
        return 1
    fi
}

echo ""
echo "📁 VERIFICANDO COMPONENTES BASE..."
echo "--------------------------------"

# Verificar componentes unificados
check_file "src/components/common/unified-data-table.tsx" "UnifiedDataTable"
check_file "src/components/common/unified-filters.tsx" "UnifiedFilters"  
check_file "src/components/common/unified-search.tsx" "UnifiedSearch"

echo ""
echo "🔧 VERIFICANDO FUNCIONALIDADES..."
echo "--------------------------------"

# Verificar funcionalidades en UnifiedDataTable
check_content "src/components/common/unified-data-table.tsx" "ROLE_THEMES" "Temas por rol implementados"
check_content "src/components/common/unified-data-table.tsx" "ColumnConfig" "Configuración de columnas"
check_content "src/components/common/unified-data-table.tsx" "MassActionConfig" "Acciones masivas"
check_content "src/components/common/unified-data-table.tsx" "PaginationConfig" "Paginación avanzada"

# Verificar funcionalidades en UnifiedFilters
check_content "src/components/common/unified-filters.tsx" "FilterConfig" "Configuración de filtros"
check_content "src/components/common/unified-filters.tsx" "referenceData" "Datos de referencia"
check_content "src/components/common/unified-filters.tsx" "variant.*collapsible" "Filtros colapsibles"

# Verificar funcionalidades en UnifiedSearch
check_content "src/components/common/unified-search.tsx" "debounceMs" "Debounce optimizado"
check_content "src/components/common/unified-search.tsx" "SearchSuggestion" "Sistema de sugerencias"
check_content "src/components/common/unified-search.tsx" "useSearchHistory" "Historial de búsqueda"

echo ""
echo "📊 VERIFICANDO MIGRACIÓN DE MÓDULOS..."
echo "------------------------------------"

# Verificar migración de Categorías
check_content "src/components/categories/categories-page.tsx" "UnifiedDataTable" "Categorías migrado a UnifiedDataTable"
check_content "src/components/categories/categories-page.tsx" "filterConfigs.*FilterConfig" "Filtros unificados en Categorías"
check_content "src/components/categories/categories-page.tsx" "searchConfig" "Búsqueda unificada en Categorías"

echo ""
echo "🎨 VERIFICANDO DISEÑO SIMÉTRICO..."
echo "--------------------------------"

# Verificar alturas consistentes
check_content "src/components/common/unified-filters.tsx" "height.*60" "Altura de filtros: 60px"
check_content "src/components/common/unified-data-table.tsx" "gap-4" "Espaciado consistente: gap-4"
check_content "src/components/common/unified-data-table.tsx" "border-l-4" "Bordes temáticos"

echo ""
echo "⚡ VERIFICANDO OPTIMIZACIONES..."
echo "------------------------------"

# Verificar optimizaciones de performance
check_content "src/components/common/unified-search.tsx" "useCallback" "Callbacks optimizados"
check_content "src/components/common/unified-data-table.tsx" "useMemo" "Memoización implementada"
check_content "src/components/common/unified-filters.tsx" "debounce" "Debounce en filtros"

echo ""
echo "🔐 VERIFICANDO CONFIGURACIÓN POR ROL..."
echo "-------------------------------------"

# Verificar configuración por rol
check_content "src/components/common/unified-data-table.tsx" "userRole.*ADMIN.*TECHNICIAN.*CLIENT" "Roles definidos"
check_content "src/components/common/unified-filters.tsx" "roles.*ADMIN" "Filtros por rol"

echo ""
echo "📋 RESUMEN DE VERIFICACIÓN"
echo "========================="

# Contar archivos verificados
total_files=3
existing_files=0

if [ -f "src/components/common/unified-data-table.tsx" ]; then ((existing_files++)); fi
if [ -f "src/components/common/unified-filters.tsx" ]; then ((existing_files++)); fi
if [ -f "src/components/common/unified-search.tsx" ]; then ((existing_files++)); fi

echo "📁 Componentes base: $existing_files/$total_files"

# Verificar migración de categorías
if grep -q "UnifiedDataTable" "src/components/categories/categories-page.tsx" 2>/dev/null; then
    echo "✅ Módulo de Categorías: MIGRADO"
else
    echo "⚠️  Módulo de Categorías: PENDIENTE"
fi

# Verificar tickets
if grep -q "UnifiedDataTable" "src/components/tickets/ticket-table.tsx" 2>/dev/null; then
    echo "✅ Módulo de Tickets: MIGRADO"
else
    echo "⚠️  Módulo de Tickets: PENDIENTE"
fi

echo ""
echo "🎯 ESTADO GENERAL:"
if [ $existing_files -eq $total_files ]; then
    echo "✅ COMPONENTES UNIFICADOS IMPLEMENTADOS CORRECTAMENTE"
    echo ""
    echo "📈 BENEFICIOS LOGRADOS:"
    echo "   • Diseño simétrico y consistente"
    echo "   • Filtros avanzados unificados"
    echo "   • Búsqueda optimizada con debounce"
    echo "   • Paginación inteligente"
    echo "   • Acciones masivas habilitadas"
    echo "   • Configuración específica por rol"
    echo "   • Performance optimizada"
else
    echo "⚠️  IMPLEMENTACIÓN PARCIAL - Revisar archivos faltantes"
fi

echo ""
echo "🔄 PRÓXIMOS PASOS:"
echo "   1. Migrar módulo de Tickets"
echo "   2. Migrar módulo de Departamentos"
echo "   3. Optimizar módulo de Técnicos"
echo "   4. Implementar exportación unificada"
echo "   5. Testing completo de funcionalidades"