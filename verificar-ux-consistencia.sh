#!/bin/bash

echo "🧹 Limpiando caché de Next.js..."
rm -rf .next/cache .next/server

echo "✅ Caché limpiado"
echo ""
echo "📋 INSTRUCCIONES:"
echo "1. Hacer hard reload en navegador: Cmd+Shift+R (Mac) o Ctrl+Shift+R (Windows)"
echo "2. Verificar módulos:"
echo "   - Categorías: 3 vistas (Lista, Tabla, Árbol)"
echo "   - Departamentos: 2 vistas (Lista, Tabla)"
echo "   - Técnicos: 2 vistas (Tarjetas, Lista)"
echo "3. Confirmar que TODAS las vistas tienen:"
echo "   ✓ Header descriptivo"
echo "   ✓ Paginación integrada en Card"
echo "   ✓ Estructura consistente"
echo ""
echo "🎯 CORRECCIONES APLICADAS:"
echo "✅ Headers descriptivos en todas las vistas"
echo "✅ Paginación integrada dentro del Card"
echo "✅ Estructura HTML consistente (space-y-4)"
echo "✅ Separadores visuales (border-b, border-t)"
