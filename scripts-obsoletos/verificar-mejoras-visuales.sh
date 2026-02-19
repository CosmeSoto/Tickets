#!/bin/bash

# Script para verificar las mejoras visuales implementadas
# Verifica tamaños de métricas y separación de filtros

echo "🎨 VERIFICACIÓN DE MEJORAS VISUALES"
echo "=================================="

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
echo "📏 VERIFICANDO TAMAÑOS DE MÉTRICAS..."
echo "-----------------------------------"

# Verificar altura reducida de métricas (de 100px a 80px)
check_content "src/components/shared/stats-card.tsx" "h-\[80px\]" "Métricas reducidas a 80px de altura"
check_content "src/components/shared/stats-card.tsx" "p-2\.5" "Padding reducido en métricas"
check_content "src/components/shared/stats-card.tsx" "text-xl" "Texto de valor optimizado"
check_content "src/components/shared/stats-card.tsx" "flex items-center" "Layout horizontal compacto"

echo ""
echo "🔍 VERIFICANDO SEPARACIÓN DE FILTROS..."
echo "--------------------------------------"

# Verificar que los filtros están separados del DataTable
check_content "src/components/categories/categories-page.tsx" "UnifiedSearch" "Búsqueda separada implementada"
check_content "src/components/categories/categories-page.tsx" "UnifiedFilters" "Filtros separados implementados"
check_content "src/components/categories/categories-page.tsx" "height={45}" "Altura de filtros optimizada"

# Verificar que el DataTable no tiene filtros internos
if grep -q "searchConfig.*fields" "src/components/categories/categories-page.tsx"; then
    echo "❌ DataTable aún tiene configuración de búsqueda interna"
else
    echo "✅ DataTable limpio sin filtros internos"
fi

echo ""
echo "🎯 VERIFICANDO ESTRUCTURA VISUAL..."
echo "---------------------------------"

# Verificar estructura de layout
check_content "src/components/categories/categories-page.tsx" "space-y-4" "Espaciado consistente entre secciones"
check_content "src/components/categories/categories-page.tsx" "space-y-6" "Espaciado principal entre bloques"

echo ""
echo "⚡ VERIFICANDO OPTIMIZACIONES DE PERFORMANCE..."
echo "--------------------------------------------"

# Verificar que no hay filtros duplicados
if grep -c "UnifiedFilters" "src/components/categories/categories-page.tsx" | grep -q "1"; then
    echo "✅ Solo una instancia de UnifiedFilters"
else
    echo "❌ Múltiples instancias de UnifiedFilters detectadas"
fi

if grep -c "UnifiedSearch" "src/components/categories/categories-page.tsx" | grep -q "1"; then
    echo "✅ Solo una instancia de UnifiedSearch"
else
    echo "❌ Múltiples instancias de UnifiedSearch detectadas"
fi

echo ""
echo "📊 RESUMEN DE MEJORAS VISUALES"
echo "============================="

# Contar mejoras implementadas
mejoras_metricas=0
mejoras_filtros=0

# Verificar métricas
if grep -q "h-\[80px\]" "src/components/shared/stats-card.tsx"; then ((mejoras_metricas++)); fi
if grep -q "p-2\.5" "src/components/shared/stats-card.tsx"; then ((mejoras_metricas++)); fi
if grep -q "text-xl" "src/components/shared/stats-card.tsx"; then ((mejoras_metricas++)); fi

# Verificar filtros
if grep -q "UnifiedSearch" "src/components/categories/categories-page.tsx"; then ((mejoras_filtros++)); fi
if grep -q "UnifiedFilters" "src/components/categories/categories-page.tsx"; then ((mejoras_filtros++)); fi
if grep -q "height={45}" "src/components/categories/categories-page.tsx"; then ((mejoras_filtros++)); fi

echo "📏 Mejoras en métricas: $mejoras_metricas/3"
echo "🔍 Mejoras en filtros: $mejoras_filtros/3"

if [ $mejoras_metricas -eq 3 ] && [ $mejoras_filtros -eq 3 ]; then
    echo ""
    echo "🎉 TODAS LAS MEJORAS VISUALES IMPLEMENTADAS CORRECTAMENTE"
    echo ""
    echo "✨ BENEFICIOS LOGRADOS:"
    echo "   • Métricas 20% más compactas (80px vs 100px)"
    echo "   • Filtros separados del DataTable"
    echo "   • Layout más limpio y organizado"
    echo "   • Mejor experiencia visual"
    echo "   • Performance optimizada"
else
    echo ""
    echo "⚠️  ALGUNAS MEJORAS PENDIENTES - Revisar implementación"
fi

echo ""
echo "🔄 PRÓXIMOS PASOS RECOMENDADOS:"
echo "   1. Probar visualmente el módulo de Categorías"
echo "   2. Aplicar las mismas mejoras a otros módulos"
echo "   3. Verificar responsive design"
echo "   4. Optimizar colores y espaciado si es necesario"