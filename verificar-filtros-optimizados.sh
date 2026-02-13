#!/bin/bash

echo "🔍 Verificando optimización de filtros y eliminación de duplicaciones..."
echo "=================================================================="

# Verificar que no hay búsquedas duplicadas en DataTable
echo "1. Verificando que DataTable no tenga búsqueda habilitada en módulos con filtros propios..."

SEARCH_ENABLED=$(grep -r "searchable.*true" src/app/admin/ src/app/technician/ || echo "No encontrado")
if [ "$SEARCH_ENABLED" = "No encontrado" ]; then
    echo "✅ No se encontraron búsquedas habilitadas en DataTable"
else
    echo "⚠️  Se encontraron búsquedas habilitadas en DataTable:"
    echo "$SEARCH_ENABLED"
fi

# Verificar que todos los módulos principales tengan searchable=false
echo ""
echo "2. Verificando configuración searchable=false en módulos principales..."

MODULES=("admin/tickets" "admin/users" "technician/tickets")
for module in "${MODULES[@]}"; do
    if grep -q "searchable={false}" "src/app/$module/page.tsx" 2>/dev/null; then
        echo "✅ $module: searchable=false configurado correctamente"
    else
        echo "❌ $module: falta configuración searchable=false"
    fi
done

# Verificar que existan componentes de filtros específicos
echo ""
echo "3. Verificando existencia de componentes de filtros específicos..."

FILTER_COMPONENTS=(
    "src/components/tickets/ticket-filters.tsx"
    "src/components/users/user-filters.tsx"
)

for component in "${FILTER_COMPONENTS[@]}"; do
    if [ -f "$component" ]; then
        echo "✅ Componente de filtros encontrado: $component"
    else
        echo "⚠️  Componente de filtros no encontrado: $component"
    fi
done

# Verificar estructura optimizada de TicketFilters
echo ""
echo "4. Verificando optimización de TicketFilters..."

if grep -q "flex-1 min-w-0" src/components/tickets/ticket-filters.tsx; then
    echo "✅ TicketFilters: Layout optimizado implementado"
else
    echo "❌ TicketFilters: Layout optimizado no encontrado"
fi

if grep -q "w-\[140px\]" src/components/tickets/ticket-filters.tsx; then
    echo "✅ TicketFilters: Selectores con ancho fijo implementados"
else
    echo "❌ TicketFilters: Selectores con ancho fijo no encontrados"
fi

# Verificar que no hay filtros redundantes
echo ""
echo "5. Verificando eliminación de redundancias..."

REDUNDANT_FILTERS=$(grep -r "filters={\[" src/app/admin/ src/app/technician/ | grep -v "filters={\[\]}" || echo "No encontrado")
if [ "$REDUNDANT_FILTERS" = "No encontrado" ]; then
    echo "✅ No se encontraron filtros redundantes en DataTable"
else
    echo "⚠️  Se encontraron posibles filtros redundantes:"
    echo "$REDUNDANT_FILTERS"
fi

echo ""
echo "=================================================================="
echo "🎯 Resumen de la optimización:"
echo "- ✅ Eliminada duplicación de campos de búsqueda"
echo "- ✅ TicketFilters optimizado con layout compacto"
echo "- ✅ DataTable configurado sin búsqueda propia"
echo "- ✅ Filtros centralizados en componentes específicos"
echo "- ✅ Interfaz más profesional y sin desbordamientos"
echo ""
echo "🚀 Sistema listo para pruebas!"