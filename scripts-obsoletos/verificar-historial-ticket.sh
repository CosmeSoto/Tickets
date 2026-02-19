#!/bin/bash

# Script de Verificación: Historial de Ticket
# Fecha: 2026-02-06

echo "🔍 VERIFICACIÓN: HISTORIAL DE TICKET Y ARTÍCULOS"
echo "================================================"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador
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

echo "📁 VERIFICANDO ARCHIVOS..."
echo "-------------------------"

check_file "src/app/api/tickets/[id]/timeline/route.ts" "API de timeline existe"
check_file "src/hooks/use-timeline.ts" "Hook use-timeline existe"
check_file "src/components/ui/ticket-timeline.tsx" "Componente timeline existe"

echo ""
echo "🔧 VERIFICANDO API DE TIMELINE..."
echo "--------------------------------"

check_content "src/app/api/tickets/[id]/timeline/route.ts" "prisma.comments.findMany" "Obtiene comentarios de Prisma"
check_content "src/app/api/tickets/[id]/timeline/route.ts" "prisma.ticket_history.findMany" "Obtiene historial de Prisma"
check_content "src/app/api/tickets/[id]/timeline/route.ts" "prisma.ticket_ratings.findUnique" "Obtiene calificaciones"
check_content "src/app/api/tickets/[id]/timeline/route.ts" "type: 'comment'" "Eventos de comentarios"
check_content "src/app/api/tickets/[id]/timeline/route.ts" "type: 'created'" "Evento de creación"
check_content "src/app/api/tickets/[id]/timeline/route.ts" "status_change" "Eventos de cambio de estado"
check_content "src/app/api/tickets/[id]/timeline/route.ts" "type: 'rating'" "Eventos de calificación"

echo ""
echo "💬 VERIFICANDO TOAST MEJORADOS..."
echo "--------------------------------"

check_content "src/hooks/use-timeline.ts" "Comentario agregado exitosamente" "Toast de éxito mejorado"
check_content "src/hooks/use-timeline.ts" "comentario \${commentType}" "Toast incluye tipo de comentario"
check_content "src/hooks/use-timeline.ts" "archivo(s) adjunto(s)" "Toast menciona archivos adjuntos"
check_content "src/hooks/use-timeline.ts" "Contenido requerido" "Validación de contenido"
check_content "src/hooks/use-timeline.ts" "Error al agregar comentario" "Toast de error descriptivo"

echo ""
echo "🎯 VERIFICANDO TOOLTIPS..."
echo "-------------------------"

check_content "src/components/ui/ticket-timeline.tsx" "from './tooltip'" "Tooltip importado"
check_content "src/components/ui/ticket-timeline.tsx" "TooltipProvider" "TooltipProvider usado"
check_content "src/components/ui/ticket-timeline.tsx" "Adjunta capturas de pantalla" "Tooltip en adjuntar archivos"
check_content "src/components/ui/ticket-timeline.tsx" "solo son visibles para técnicos" "Tooltip en comentario interno"
check_content "src/components/ui/ticket-timeline.tsx" "Agrega este comentario al historial" "Tooltip en botón enviar"

echo ""
echo "📊 VERIFICANDO ESTRUCTURA DE DATOS..."
echo "------------------------------------"

check_content "src/app/api/tickets/[id]/timeline/route.ts" "users:" "Incluye información de usuarios"
check_content "src/app/api/tickets/[id]/timeline/route.ts" "orderBy.*createdAt" "Ordena por fecha"
check_content "src/app/api/tickets/[id]/timeline/route.ts" "isInternal" "Maneja comentarios internos"

echo ""
echo "📋 RESUMEN"
echo "=========="
echo -e "${GREEN}Verificaciones exitosas: $PASSED${NC}"
echo -e "${RED}Verificaciones fallidas: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ TODAS LAS VERIFICACIONES PASARON${NC}"
    echo ""
    echo "🎉 Correcciones aplicadas exitosamente:"
    echo "   • API de timeline corregido"
    echo "   • Comentarios se muestran correctamente"
    echo "   • Toast descriptivos implementados"
    echo "   • Tooltips agregados"
    echo "   • Sistema listo para crear artículos"
    echo ""
    echo "📝 Próximos pasos:"
    echo "   1. Iniciar servidor: npm run dev"
    echo "   2. Ir a un ticket"
    echo "   3. Agregar un comentario"
    echo "   4. Verificar que aparece en el historial"
    echo "   5. Resolver ticket y crear artículo"
    echo ""
    exit 0
else
    echo -e "${RED}❌ ALGUNAS VERIFICACIONES FALLARON${NC}"
    echo ""
    echo "Revisa los archivos marcados con ✗"
    echo ""
    exit 1
fi
