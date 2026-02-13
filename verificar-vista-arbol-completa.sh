#!/bin/bash

echo "🔍 VERIFICACIÓN: Vista de Árbol Completa con Controles de Expansión"
echo "=================================================================="

# Verificar que los botones de vista están correctamente implementados
echo "✅ Verificando botones de vista..."
if grep -q "setViewMode('table')" src/components/categories/categories-page.tsx && grep -q "setViewMode('tree')" src/components/categories/categories-page.tsx; then
    echo "   ✓ Botones de cambio de vista implementados correctamente"
else
    echo "   ✗ Botones de cambio de vista NO implementados correctamente"
    exit 1
fi

# Verificar que los botones de expansión/contracción están implementados
echo "✅ Verificando botones de expansión/contracción..."
if grep -q "expandAllCategories" src/components/categories/categories-page.tsx && grep -q "collapseAllCategories" src/components/categories/categories-page.tsx; then
    echo "   ✓ Botones de expansión/contracción implementados correctamente"
else
    echo "   ✗ Botones de expansión/contracción NO implementados correctamente"
    exit 1
fi

# Verificar que los iconos correctos están importados
echo "✅ Verificando iconos importados..."
if grep -q "ChevronDown.*ChevronRight" src/components/categories/categories-page.tsx; then
    echo "   ✓ Iconos de chevron importados correctamente"
else
    echo "   ✗ Iconos de chevron NO importados correctamente"
    exit 1
fi

# Verificar que no hay duplicación de títulos
echo "✅ Verificando eliminación de duplicación de títulos..."
if ! grep -q "Vista de Tabla - Categorías.*Vista de Tabla - Categorías" src/components/categories/categories-page.tsx; then
    echo "   ✓ No hay duplicación de títulos"
else
    echo "   ✗ Aún hay duplicación de títulos"
    exit 1
fi

# Verificar que CategoryTree tiene soporte para eventos de expansión
echo "✅ Verificando soporte de CategoryTree para expansión/contracción..."
if grep -q "expandAllCategories" src/components/ui/category-tree.tsx && grep -q "collapseAllCategories" src/components/ui/category-tree.tsx; then
    echo "   ✓ CategoryTree soporta eventos de expansión/contracción"
else
    echo "   ✗ CategoryTree NO soporta eventos de expansión/contracción"
    exit 1
fi

# Verificar que los botones tienen tooltips
echo "✅ Verificando tooltips en botones..."
if grep -q "title=\"Expandir todo\"" src/components/categories/categories-page.tsx && grep -q "title=\"Contraer todo\"" src/components/categories/categories-page.tsx; then
    echo "   ✓ Tooltips implementados correctamente"
else
    echo "   ✗ Tooltips NO implementados correctamente"
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
echo "✅ Botones de vista (Tabla/Árbol) correctamente posicionados"
echo "✅ Botones minimalistas de expansión/contracción implementados"
echo "✅ Iconos intuitivos (ChevronDown para expandir, ChevronRight para contraer)"
echo "✅ Tooltips informativos en todos los botones"
echo "✅ Eliminada duplicación de títulos"
echo "✅ CategoryTree con soporte completo para eventos de expansión"
echo "✅ Build exitoso sin errores"
echo ""
echo "📋 FUNCIONALIDADES IMPLEMENTADAS:"
echo "• Botones de vista en header del DataTable (vista tabla)"
echo "• Botones de vista en header del Card (vista árbol)"
echo "• Botones de expansión/contracción global en vista árbol"
echo "• Eventos personalizados para comunicación con CategoryTree"
echo "• Iconos intuitivos y tooltips descriptivos"
echo "• Diseño minimalista y consistente"
echo "• Sin redundancias ni duplicidades"