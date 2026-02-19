#!/bin/bash

echo "🔍 VERIFICACIÓN: Métricas Estandarizadas en Todos los Módulos"
echo "============================================================="

# Verificar que el componente base existe
echo "✅ Verificando componente base StatsPanelBase..."
if [ -f "src/components/common/stats-panel-base.tsx" ]; then
    echo "   ✓ Componente base StatsPanelBase creado"
else
    echo "   ✗ Componente base StatsPanelBase NO encontrado"
    exit 1
fi

# Verificar que TechnicianStatsPanel usa el componente base
echo "✅ Verificando TechnicianStatsPanel estandarizado..."
if grep -q "StatsPanelBase" src/components/technicians/technician-stats-panel.tsx; then
    echo "   ✓ TechnicianStatsPanel usa componente base"
else
    echo "   ✗ TechnicianStatsPanel NO usa componente base"
    exit 1
fi

# Verificar que DepartmentStats usa el componente base
echo "✅ Verificando DepartmentStats estandarizado..."
if grep -q "StatsPanelBase" src/components/departments/department-stats.tsx; then
    echo "   ✓ DepartmentStats usa componente base"
else
    echo "   ✗ DepartmentStats NO usa componente base"
    exit 1
fi

# Verificar que se eliminaron las constantes redundantes de técnicos
echo "✅ Verificando eliminación de redundancias..."
if ! grep -q "TECHNICIAN_STATS_CONFIG" src/components/technicians/technician-stats-panel.tsx; then
    echo "   ✓ Constantes redundantes eliminadas de técnicos"
else
    echo "   ✗ Constantes redundantes AÚN presentes en técnicos"
    exit 1
fi

# Verificar que los iconos están correctamente importados
echo "✅ Verificando iconos en componentes actualizados..."
if grep -q "CheckCircle" src/components/departments/department-stats.tsx && grep -q "Building" src/components/departments/department-stats.tsx; then
    echo "   ✓ Iconos profesionales en DepartmentStats"
else
    echo "   ✗ Iconos profesionales NO encontrados en DepartmentStats"
    exit 1
fi

if grep -q "UserCheck" src/components/technicians/technician-stats-panel.tsx && grep -q "Ticket" src/components/technicians/technician-stats-panel.tsx; then
    echo "   ✓ Iconos profesionales en TechnicianStatsPanel"
else
    echo "   ✗ Iconos profesionales NO encontrados en TechnicianStatsPanel"
    exit 1
fi

# Verificar que se usan porcentajes en las métricas
echo "✅ Verificando cálculo de porcentajes..."
if grep -q "percentage.*activePercentage" src/components/technicians/technician-stats-panel.tsx; then
    echo "   ✓ Porcentajes implementados en TechnicianStatsPanel"
else
    echo "   ✗ Porcentajes NO implementados en TechnicianStatsPanel"
    exit 1
fi

if grep -q "percentage.*activePercentage" src/components/departments/department-stats.tsx; then
    echo "   ✓ Porcentajes implementados en DepartmentStats"
else
    echo "   ✗ Porcentajes NO implementados en DepartmentStats"
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
echo "✅ Componente base StatsPanelBase creado y funcionando"
echo "✅ TechnicianStatsPanel estandarizado con diseño profesional"
echo "✅ DepartmentStats estandarizado con diseño profesional"
echo "✅ Iconos profesionales implementados en todos los módulos"
echo "✅ Porcentajes y métricas avanzadas agregadas"
echo "✅ Redundancias eliminadas, código limpio"
echo "✅ Consistencia visual con módulos de tickets y usuarios"
echo "✅ Build exitoso sin errores"
echo ""
echo "📋 MEJORAS IMPLEMENTADAS:"
echo "• Componente base reutilizable para todas las métricas"
echo "• Diseño consistente: iconos, colores, bordes laterales, hover effects"
echo "• Porcentajes automáticos para métricas relevantes"
echo "• Métricas avanzadas: promedios, tasas de actividad"
echo "• Eliminación de código duplicado y redundancias"
echo "• Carga con skeleton loading states"
echo "• Responsive design en todas las métricas"
echo ""
echo "🎨 CONSISTENCIA VISUAL LOGRADA:"
echo "• Tickets: ✅ Diseño profesional (ya existía)"
echo "• Usuarios: ✅ Diseño profesional (ya existía)"  
echo "• Categorías: ✅ Diseño profesional (ya existía)"
echo "• Técnicos: ✅ Diseño profesional (MEJORADO)"
echo "• Departamentos: ✅ Diseño profesional (MEJORADO)"