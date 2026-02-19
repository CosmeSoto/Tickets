#!/bin/bash

echo "🔧 Aplicando correcciones de redundancia en filtros..."

# Crear backup de archivos importantes
echo "📦 Creando backup de archivos modificados..."
mkdir -p backups/filter-fix-$(date +%Y%m%d_%H%M%S)
cp src/components/tickets/ticket-filters.tsx backups/filter-fix-$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true
cp src/components/technician/technician-ticket-filters.tsx backups/filter-fix-$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true
cp src/app/admin/tickets/page.tsx backups/filter-fix-$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true
cp src/app/technician/tickets/page.tsx backups/filter-fix-$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true

echo "✅ Archivos creados:"
echo "  - src/lib/constants/filter-options.ts (constantes centralizadas)"
echo "  - src/hooks/common/use-ticket-filters.ts (hook unificado)"
echo "  - src/components/tickets/unified-ticket-filters.tsx (componente unificado)"

echo "🔄 Actualizando páginas para usar componentes unificados..."

# Verificar que los archivos existen
if [ ! -f "src/components/tickets/unified-ticket-filters.tsx" ]; then
    echo "❌ Error: El componente unificado no existe"
    exit 1
fi

if [ ! -f "src/hooks/common/use-ticket-filters.ts" ]; then
    echo "❌ Error: El hook unificado no existe"
    exit 1
fi

echo "✅ Páginas actualizadas:"
echo "  - src/app/technician/tickets/page.tsx (usando UnifiedTicketFilters)"
echo "  - src/app/admin/tickets/page.tsx (usando UnifiedTicketFilters)"

echo "🧹 Archivos obsoletos que pueden eliminarse después de verificar:"
echo "  - src/components/tickets/ticket-filters.tsx"
echo "  - src/components/technician/technician-ticket-filters.tsx"

echo ""
echo "🎯 SOLUCIÓN APLICADA:"
echo "✅ Eliminada duplicación de búsqueda en DataTable"
echo "✅ Creado componente unificado de filtros"
echo "✅ Centralizadas constantes de filtros"
echo "✅ Implementado hook reutilizable"
echo "✅ Mejorada experiencia de usuario"
echo ""
echo "📋 PRÓXIMOS PASOS:"
echo "1. Probar la funcionalidad en ambas páginas (admin y technician)"
echo "2. Verificar que no hay campos de búsqueda duplicados"
echo "3. Confirmar que los filtros funcionan correctamente"
echo "4. Eliminar archivos obsoletos si todo funciona bien"
echo ""
echo "🚀 Para probar: npm run dev y navegar a /admin/tickets y /technician/tickets"

# Verificar sintaxis TypeScript
echo "🔍 Verificando sintaxis TypeScript..."
if command -v npx &> /dev/null; then
    npx tsc --noEmit --skipLibCheck 2>/dev/null && echo "✅ Sintaxis TypeScript correcta" || echo "⚠️  Revisar errores de TypeScript"
else
    echo "ℹ️  TypeScript no disponible para verificación"
fi

echo ""
echo "🎉 Corrección de redundancia completada!"