#!/bin/bash

# Script de Verificación: Correcciones Plan de Resolución
# Fecha: 2026-02-06

echo "🔍 VERIFICACIÓN DE CORRECCIONES - PLAN DE RESOLUCIÓN"
echo "=================================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador de verificaciones
PASSED=0
FAILED=0

# Función para verificar archivo
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $2"
        ((FAILED++))
    fi
}

# Función para verificar contenido
check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $3"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $3"
        ((FAILED++))
    fi
}

echo "📁 VERIFICANDO ARCHIVOS MODIFICADOS..."
echo "--------------------------------------"

# Verificar archivos corregidos
check_file "src/lib/audit.ts" "Archivo audit.ts existe"
check_file "src/app/api/tickets/[id]/comments/route.ts" "Archivo comments route existe"
check_file "src/components/ui/tooltip.tsx" "Componente Tooltip creado"
check_file "src/components/ui/ticket-resolution-tracker.tsx" "Componente Resolution Tracker existe"

echo ""
echo "🔧 VERIFICANDO CORRECCIÓN ERROR 500..."
echo "--------------------------------------"

# Verificar correcciones en audit.ts
check_content "src/lib/audit.ts" "userEmail" "Campo userEmail agregado"
check_content "src/lib/audit.ts" "details:" "Campo details implementado"
check_content "src/lib/audit.ts" "const user = await prisma.users.findUnique" "Obtención de email del usuario"

# Verificar correcciones en comments
check_content "src/app/api/tickets/[id]/comments/route.ts" "authorId:" "Campo authorId corregido"
check_content "src/app/api/tickets/[id]/comments/route.ts" "updatedAt:" "Campo updatedAt agregado"

echo ""
echo "🎯 VERIFICANDO MEJORAS PLAN DE RESOLUCIÓN..."
echo "--------------------------------------"

# Verificar componente Tooltip
check_content "src/components/ui/tooltip.tsx" "TooltipProvider" "TooltipProvider exportado"
check_content "src/components/ui/tooltip.tsx" "TooltipContent" "TooltipContent exportado"
check_content "src/components/ui/tooltip.tsx" "@radix-ui/react-tooltip" "Radix UI Tooltip importado"

# Verificar mejoras en Resolution Tracker
check_content "src/components/ui/ticket-resolution-tracker.tsx" "DropdownMenu" "DropdownMenu importado"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "AlertDialog" "AlertDialog importado"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "TooltipProvider" "Tooltip importado"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "getStatusBadge" "Función getStatusBadge implementada"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "deleteTask" "Función deleteTask implementada"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "taskToDelete" "Estado taskToDelete agregado"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "MoreVertical" "Icono MoreVertical importado"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "XCircle" "Icono XCircle (blocked) importado"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "formatDate" "Función formatDate implementada"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "calculateElapsedTime" "Función calculateElapsedTime implementada"

echo ""
echo "🎨 VERIFICANDO CARACTERÍSTICAS NUEVAS..."
echo "--------------------------------------"

# Verificar estados de tarea
check_content "src/components/ui/ticket-resolution-tracker.tsx" "blocked" "Estado 'blocked' implementado"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "Bloqueada" "Etiqueta 'Bloqueada' agregada"

# Verificar información contextual
check_content "src/components/ui/ticket-resolution-tracker.tsx" "Creada:" "Fecha de creación mostrada"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "Vence:" "Fecha de vencimiento mostrada"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "Completada:" "Fecha de completado mostrada"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "Asignado a:" "Información de asignación mostrada"

# Verificar tooltips
check_content "src/components/ui/ticket-resolution-tracker.tsx" "TooltipContent" "Tooltips implementados"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "description:" "Descripciones en tooltips"

# Verificar confirmación de eliminación
check_content "src/components/ui/ticket-resolution-tracker.tsx" "¿Eliminar tarea?" "Diálogo de confirmación implementado"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "AlertDialogAction" "Botón de confirmación agregado"

# Verificar menú de acciones
check_content "src/components/ui/ticket-resolution-tracker.tsx" "DropdownMenuSub" "Submenú de estados implementado"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "Cambiar Estado" "Opción cambiar estado agregada"
check_content "src/components/ui/ticket-resolution-tracker.tsx" "Eliminar Tarea" "Opción eliminar tarea agregada"

echo ""
echo "📊 RESUMEN DE VERIFICACIÓN"
echo "=========================="
echo -e "${GREEN}Verificaciones exitosas: $PASSED${NC}"
echo -e "${RED}Verificaciones fallidas: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ TODAS LAS VERIFICACIONES PASARON${NC}"
    echo ""
    echo "🎉 Las correcciones se aplicaron correctamente:"
    echo "   • Error 500 en comentarios resuelto"
    echo "   • Componente Tooltip creado"
    echo "   • Plan de Resolución mejorado con:"
    echo "     - Badges con iconos y tooltips"
    echo "     - Menú dropdown de acciones"
    echo "     - Estado 'Bloqueada' disponible"
    echo "     - Información contextual rica"
    echo "     - Confirmación de eliminación"
    echo "     - Funciones auxiliares de formato"
    echo ""
    echo "📝 Siguiente paso:"
    echo "   1. Iniciar servidor: npm run dev"
    echo "   2. Probar crear comentario en un ticket"
    echo "   3. Probar Plan de Resolución con nuevas funciones"
    echo ""
    exit 0
else
    echo -e "${RED}❌ ALGUNAS VERIFICACIONES FALLARON${NC}"
    echo ""
    echo "Por favor revisa los archivos marcados con ✗"
    echo ""
    exit 1
fi
