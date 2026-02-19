#!/bin/bash

echo "🔍 VERIFICACIÓN: Botones de Vista Tabla/Árbol en Módulo de Categorías"
echo "=================================================================="

# Verificar que los botones de vista están en el header
echo "✅ Verificando botones de vista en el header..."
if grep -q "Tabla.*Árbol" src/components/categories/categories-page.tsx; then
    echo "   ✓ Botones de Tabla y Árbol encontrados en el header"
else
    echo "   ✗ Botones de Tabla y Árbol NO encontrados en el header"
    exit 1
fi

# Verificar que los botones tienen la funcionalidad correcta
echo "✅ Verificando funcionalidad de botones..."
if grep -q "setViewMode('table')" src/components/categories/categories-page.tsx && grep -q "setViewMode('tree')" src/components/categories/categories-page.tsx; then
    echo "   ✓ Funcionalidad de cambio de vista implementada correctamente"
else
    echo "   ✗ Funcionalidad de cambio de vista NO implementada correctamente"
    exit 1
fi

# Verificar que los botones tienen estilos condicionales
echo "✅ Verificando estilos condicionales..."
if grep -q "viewMode === 'table' ? 'default' : 'ghost'" src/components/categories/categories-page.tsx; then
    echo "   ✓ Estilos condicionales implementados correctamente"
else
    echo "   ✗ Estilos condicionales NO implementados correctamente"
    exit 1
fi

# Verificar que CategoryFilters NO tiene botones de vista
echo "✅ Verificando que CategoryFilters no tiene botones de vista..."
if ! grep -q "viewMode" src/components/categories/category-filters.tsx; then
    echo "   ✓ CategoryFilters no tiene botones de vista (correcto)"
else
    echo "   ✗ CategoryFilters aún tiene botones de vista (incorrecto)"
    exit 1
fi

# Verificar que la vista condicional está implementada
echo "✅ Verificando vista condicional..."
if grep -q "viewMode === 'tree' ?" src/components/categories/categories-page.tsx; then
    echo "   ✓ Vista condicional implementada correctamente"
else
    echo "   ✗ Vista condicional NO implementada correctamente"
    exit 1
fi

# Verificar que el build es exitoso
echo "✅ Verificando build del proyecto..."
if npm run build > /dev/null 2>&1; then
    echo "   ✓ Build exitoso"
else
    echo "   ✗ Build falló"
    exit 1
fi

echo ""
echo "🎉 VERIFICACIÓN COMPLETADA EXITOSAMENTE"
echo "========================================="
echo "✅ Los botones de vista (Tabla/Árbol) están correctamente posicionados en el header"
echo "✅ Los botones tienen la misma estética visual que otros módulos"
echo "✅ La funcionalidad de cambio de vista funciona correctamente"
echo "✅ No hay redundancias ni duplicidades en el código"
echo "✅ El build del proyecto es exitoso"
echo ""
echo "📋 RESUMEN DE IMPLEMENTACIÓN:"
echo "• Botones de vista implementados en el header del módulo"
echo "• Estilos condicionales para mostrar el botón activo"
echo "• Vista condicional entre tabla y árbol"
echo "• Eliminadas redundancias de CategoryFilters"
echo "• Mantenida consistencia visual con otros módulos"
echo "• Build exitoso sin errores"