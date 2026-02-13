#!/bin/bash

echo "🔍 VERIFICACIÓN FINAL: Iconos de Vista Mejorados sin Texto"
echo "=========================================================="

# Verificar que el icono List está importado
echo "✅ Verificando importación del icono List..."
if grep -q "import.*List" src/components/categories/categories-page.tsx; then
    echo "   ✓ Icono List importado correctamente"
else
    echo "   ✗ Icono List NO importado correctamente"
    exit 1
fi

# Verificar que los botones usan solo iconos (sin texto)
echo "✅ Verificando que los botones no tienen texto..."
if ! grep -q "<span.*Tabla\|<span.*Árbol" src/components/categories/categories-page.tsx; then
    echo "   ✓ Botones sin texto, solo iconos"
else
    echo "   ✗ Botones aún contienen texto"
    exit 1
fi

# Verificar que se usa el icono List para vista de tabla
echo "✅ Verificando icono List para vista de tabla..."
if grep -q "<List className=\"h-4 w-4\" />" src/components/categories/categories-page.tsx; then
    echo "   ✓ Icono List usado para vista de tabla"
else
    echo "   ✗ Icono List NO usado para vista de tabla"
    exit 1
fi

# Verificar que se usa el icono FolderTree para vista de árbol
echo "✅ Verificando icono FolderTree para vista de árbol..."
if grep -q "<FolderTree className=\"h-4 w-4\" />" src/components/categories/categories-page.tsx; then
    echo "   ✓ Icono FolderTree usado para vista de árbol"
else
    echo "   ✗ Icono FolderTree NO usado para vista de árbol"
    exit 1
fi

# Verificar que los botones tienen tooltips descriptivos
echo "✅ Verificando tooltips descriptivos..."
if grep -q "title=\"Vista de tabla\"" src/components/categories/categories-page.tsx && grep -q "title=\"Vista de árbol\"" src/components/categories/categories-page.tsx; then
    echo "   ✓ Tooltips descriptivos implementados"
else
    echo "   ✗ Tooltips descriptivos NO implementados"
    exit 1
fi

# Verificar que los botones de expansión mantienen sus iconos
echo "✅ Verificando iconos de expansión/contracción..."
if grep -q "<ChevronDown className=\"h-3 w-3\" />" src/components/categories/categories-page.tsx && grep -q "<ChevronRight className=\"h-3 w-3\" />" src/components/categories/categories-page.tsx; then
    echo "   ✓ Iconos de expansión/contracción correctos"
else
    echo "   ✗ Iconos de expansión/contracción NO correctos"
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
echo "🎉 VERIFICACIÓN FINAL COMPLETADA EXITOSAMENTE"
echo "============================================="
echo "✅ Iconos mejorados sin texto implementados"
echo "✅ Icono List (📋) para vista de tabla"
echo "✅ Icono FolderTree (🌳) para vista de árbol"
echo "✅ Iconos ChevronDown/ChevronRight para expansión"
echo "✅ Tooltips descriptivos para accesibilidad"
echo "✅ Diseño minimalista y profesional"
echo "✅ Build exitoso sin errores"
echo ""
echo "📋 ICONOGRAFÍA FINAL:"
echo "• Vista Tabla: List (icono de lista)"
echo "• Vista Árbol: FolderTree (icono de árbol de carpetas)"
echo "• Expandir: ChevronDown (flecha hacia abajo)"
echo "• Contraer: ChevronRight (flecha hacia la derecha)"
echo "• Todos con tooltips informativos"
echo "• Diseño consistente con otros módulos"