#!/bin/bash

# Script para verificar las correcciones aplicadas al módulo de Categorías
# Verifica que todos los problemas identificados hayan sido solucionados

echo "🔍 VERIFICACIÓN DE CORRECCIONES - MÓDULO CATEGORÍAS"
echo "================================================="

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

# Función para verificar que NO exista contenido
check_not_exists() {
    local file=$1
    local pattern=$2
    local description=$3
    
    if [ -f "$file" ] && ! grep -q "$pattern" "$file"; then
        echo "✅ $description"
        return 0
    else
        echo "❌ $description (AÚN EXISTE)"
        return 1
    fi
}

echo ""
echo "🚫 VERIFICANDO ELIMINACIÓN DE ELEMENTOS NO DESEADOS..."
echo "----------------------------------------------------"

# Verificar que no hay botón de exportar
check_not_exists "src/components/categories/categories-page.tsx" "exportable.*true" "Botón Exportar eliminado"

# Verificar que no hay título/descripción en DataTable
check_not_exists "src/components/categories/categories-page.tsx" "title.*Gestión de Categorías" "Título redundante eliminado del DataTable"

echo ""
echo "✅ VERIFICANDO ELEMENTOS RESTAURADOS..."
echo "-------------------------------------"

# Verificar botones de vista (tabla/árbol)
check_content "src/components/categories/categories-page.tsx" "viewMode === 'table'" "Botones de vista implementados"
check_content "src/components/categories/categories-page.tsx" "List className" "Icono de vista tabla"
check_content "src/components/categories/categories-page.tsx" "FolderTree className" "Icono de vista árbol"

# Verificar botones de expandir/contraer en vista árbol
check_content "src/components/categories/categories-page.tsx" "ChevronDown" "Botón expandir todo"
check_content "src/components/categories/categories-page.tsx" "ChevronRight" "Botón contraer todo"
check_content "src/components/categories/categories-page.tsx" "expandAllCategories" "Evento expandir implementado"
check_content "src/components/categories/categories-page.tsx" "collapseAllCategories" "Evento contraer implementado"

echo ""
echo "🎨 VERIFICANDO SEPARACIÓN Y LAYOUT..."
echo "-----------------------------------"

# Verificar separación de filtros
check_content "src/components/categories/categories-page.tsx" "space-y-4" "Espaciado entre filtros y búsqueda"
check_content "src/components/categories/categories-page.tsx" "flex items-center justify-between" "Layout horizontal para filtros y botones"
check_content "src/components/categories/categories-page.tsx" "variant.*compact" "Filtros en modo compacto"

# Verificar estructura de Card para tabla
check_content "src/components/categories/categories-page.tsx" "Card.*CardContent" "Tabla envuelta en Card limpia"

echo ""
echo "🔧 VERIFICANDO CONFIGURACIÓN TÉCNICA..."
echo "-------------------------------------"

# Verificar imports correctos
check_content "src/components/categories/categories-page.tsx" "import.*UnifiedDataTable" "Import UnifiedDataTable"
check_content "src/components/categories/categories-page.tsx" "import.*UnifiedFilters" "Import UnifiedFilters"
check_content "src/components/categories/categories-page.tsx" "import.*UnifiedSearch" "Import UnifiedSearch"
check_content "src/components/categories/categories-page.tsx" "import.*cn.*from" "Import cn utility"

# Verificar configuración de filtros
check_content "src/components/categories/categories-page.tsx" "filterConfigs.*FilterConfig" "Configuración de filtros tipada"
check_not_exists "src/components/categories/categories-page.tsx" "width.*px" "Propiedades width eliminadas de filtros"

echo ""
echo "⚡ VERIFICANDO FUNCIONALIDAD..."
echo "----------------------------"

# Verificar configuración de roles
check_content "src/components/categories/categories-page.tsx" "userRole.*ADMIN" "Configuración de rol Admin"

# Verificar callbacks
check_content "src/components/categories/categories-page.tsx" "handleSearchChange" "Callback de búsqueda"
check_content "src/components/categories/categories-page.tsx" "handleFiltersChange" "Callback de filtros"

# Verificar que no hay errores de TypeScript
echo ""
echo "🔍 VERIFICANDO ERRORES DE TYPESCRIPT..."
echo "-------------------------------------"

if command -v npx &> /dev/null; then
    cd "$(dirname "$0")"
    if npx tsc --noEmit --skipLibCheck src/components/categories/categories-page.tsx 2>/dev/null; then
        echo "✅ Sin errores de TypeScript"
    else
        echo "❌ Errores de TypeScript detectados"
    fi
else
    echo "⚠️  TypeScript no disponible para verificación"
fi

echo ""
echo "📊 RESUMEN DE CORRECCIONES"
echo "========================="

# Contar correcciones aplicadas
correcciones_aplicadas=0
total_correcciones=10

# Verificar correcciones principales
if ! grep -q "exportable.*true" "src/components/categories/categories-page.tsx" 2>/dev/null; then ((correcciones_aplicadas++)); fi
if grep -q "viewMode === 'table'" "src/components/categories/categories-page.tsx" 2>/dev/null; then ((correcciones_aplicadas++)); fi
if grep -q "ChevronDown" "src/components/categories/categories-page.tsx" 2>/dev/null; then ((correcciones_aplicadas++)); fi
if grep -q "space-y-4" "src/components/categories/categories-page.tsx" 2>/dev/null; then ((correcciones_aplicadas++)); fi
if grep -q "variant.*compact" "src/components/categories/categories-page.tsx" 2>/dev/null; then ((correcciones_aplicadas++)); fi
if grep -q "Card.*CardContent" "src/components/categories/categories-page.tsx" 2>/dev/null; then ((correcciones_aplicadas++)); fi
if grep -q "import.*cn.*from" "src/components/categories/categories-page.tsx" 2>/dev/null; then ((correcciones_aplicadas++)); fi
if ! grep -q "width.*px" "src/components/categories/categories-page.tsx" 2>/dev/null; then ((correcciones_aplicadas++)); fi
if grep -q "userRole.*ADMIN" "src/components/categories/categories-page.tsx" 2>/dev/null; then ((correcciones_aplicadas++)); fi
if grep -q "handleSearchChange" "src/components/categories/categories-page.tsx" 2>/dev/null; then ((correcciones_aplicadas++)); fi

echo "✅ Correcciones aplicadas: $correcciones_aplicadas/$total_correcciones"

if [ $correcciones_aplicadas -eq $total_correcciones ]; then
    echo ""
    echo "🎉 TODAS LAS CORRECCIONES APLICADAS EXITOSAMENTE"
    echo ""
    echo "✨ PROBLEMAS SOLUCIONADOS:"
    echo "   ❌ → ✅ Botón Exportar eliminado"
    echo "   ❌ → ✅ Botones de vista (tabla/árbol) restaurados"
    echo "   ❌ → ✅ Botones expandir/contraer en vista árbol"
    echo "   ❌ → ✅ Layout limpio y organizado"
    echo "   ❌ → ✅ Filtros separados correctamente"
    echo "   ❌ → ✅ Sin redundancias ni duplicidades"
    echo "   ❌ → ✅ Configuración por roles implementada"
else
    echo ""
    echo "⚠️  ALGUNAS CORRECCIONES PENDIENTES"
    echo "   Revisar elementos faltantes arriba"
fi

echo ""
echo "🔄 PRÓXIMOS PASOS:"
echo "   1. Probar visualmente el módulo en el navegador"
echo "   2. Verificar funcionalidad de botones de vista"
echo "   3. Comprobar filtros y búsqueda"
echo "   4. Validar acciones masivas"
echo "   5. Aplicar mejoras similares a otros módulos"