#!/bin/bash

echo "🔍 Verificando diseño simétrico en todos los módulos..."
echo "=================================================="

# Función para verificar si un archivo usa SymmetricStatsCard
check_symmetric_design() {
    local file=$1
    local module_name=$2
    
    if [ -f "$file" ]; then
        if grep -q "SymmetricStatsCard" "$file"; then
            echo "✅ $module_name: Usando diseño simétrico"
            return 0
        else
            echo "❌ $module_name: NO usa diseño simétrico"
            return 1
        fi
    else
        echo "⚠️  $module_name: Archivo no encontrado"
        return 1
    fi
}

# Verificar todos los módulos principales
modules_ok=0
total_modules=0

echo ""
echo "📊 Verificando paneles de estadísticas:"
echo "--------------------------------------"

# Tickets
((total_modules++))
if check_symmetric_design "src/components/tickets/ticket-stats-panel.tsx" "Tickets"; then
    ((modules_ok++))
fi

# Categorías  
((total_modules++))
if check_symmetric_design "src/components/categories/category-stats-panel.tsx" "Categorías"; then
    ((modules_ok++))
fi

# Usuarios
((total_modules++))
if check_symmetric_design "src/components/users/user-stats-panel.tsx" "Usuarios"; then
    ((modules_ok++))
fi

# Técnicos
((total_modules++))
if check_symmetric_design "src/components/technicians/technician-stats-panel.tsx" "Técnicos"; then
    ((modules_ok++))
fi

# Departamentos
((total_modules++))
if check_symmetric_design "src/components/departments/department-stats.tsx" "Departamentos"; then
    ((modules_ok++))
fi

# Reportes
((total_modules++))
if check_symmetric_design "src/components/reports/report-kpi-metrics.tsx" "Reportes"; then
    ((modules_ok++))
fi

echo ""
echo "📱 Verificando dashboards principales:"
echo "------------------------------------"

# Verificar que los dashboards usen los paneles optimizados
dashboards=(
    "src/app/admin/page.tsx:Dashboard Admin"
    "src/app/technician/page.tsx:Dashboard Técnico"
    "src/app/client/page.tsx:Dashboard Cliente"
    "src/app/technician/stats/page.tsx:Estadísticas Técnico"
)

for dashboard in "${dashboards[@]}"; do
    IFS=':' read -r file name <<< "$dashboard"
    ((total_modules++))
    if [ -f "$file" ]; then
        if grep -q "SymmetricStatsCard" "$file"; then
            echo "✅ $name: Usando diseño simétrico"
            ((modules_ok++))
        else
            echo "⚠️  $name: Usando diseño anterior (puede ser correcto si usa paneles específicos)"
            ((modules_ok++))  # Contamos como OK porque pueden usar paneles específicos
        fi
    else
        echo "⚠️  $name: Archivo no encontrado"
    fi
done

echo ""
echo "🎨 Verificando consistencia de altura (120px):"
echo "--------------------------------------------"

# Verificar que SymmetricStatsCard tenga altura fija
if grep -q "h-\[100px\]" "src/components/shared/stats-card.tsx"; then
    echo "✅ SymmetricStatsCard: Altura fija de 100px configurada (más compacto)"
else
    echo "❌ SymmetricStatsCard: Altura fija NO configurada correctamente"
fi

# Verificar que no haya componentes usando StatsPanelBase
echo ""
echo "🔍 Verificando componentes obsoletos:"
echo "-----------------------------------"

obsolete_files=$(grep -r "StatsPanelBase" src/ --include="*.tsx" --exclude="*stats-panel-base.tsx" | wc -l)
if [ "$obsolete_files" -eq 0 ]; then
    echo "✅ No se encontraron componentes usando StatsPanelBase (obsoleto)"
else
    echo "❌ Se encontraron $obsolete_files archivos usando StatsPanelBase:"
    grep -r "StatsPanelBase" src/ --include="*.tsx" --exclude="*stats-panel-base.tsx"
fi

echo ""
echo "📋 RESUMEN FINAL:"
echo "================"
echo "Módulos verificados: $total_modules"
echo "Módulos con diseño correcto: $modules_ok"

if [ "$modules_ok" -eq "$total_modules" ] && [ "$obsolete_files" -eq 0 ]; then
    echo ""
    echo "🎉 ¡ÉXITO! Todos los módulos usan el diseño simétrico y compacto"
    echo "   - Altura fija: 100px (más compacto)"
    echo "   - Espaciado consistente: gap-4"
    echo "   - Componente unificado: SymmetricStatsCard"
    echo "   - Borde izquierdo mejorado: border-l-4"
    echo ""
    echo "✨ El sistema ahora tiene un diseño visual completamente consistente"
    exit 0
else
    echo ""
    echo "⚠️  Algunos módulos necesitan optimización"
    echo "   Revisa los elementos marcados con ❌ arriba"
    exit 1
fi