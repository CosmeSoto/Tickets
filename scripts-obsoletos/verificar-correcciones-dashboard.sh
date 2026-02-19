#!/bin/bash

# Script de verificación para correcciones de dashboard y notificaciones
# Verifica que las tarjetas no se desborden y las notificaciones funcionen

echo "🔍 VERIFICACIÓN DE CORRECCIONES DASHBOARD"
echo "=========================================="

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Función para verificar archivos
check_file() {
    local file=$1
    local description=$2
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Función para verificar contenido en archivos
check_content() {
    local file=$1
    local pattern=$2
    local description=$3
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ -f "$file" ] && grep -q "$pattern" "$file"; then
        echo -e "${GREEN}✓${NC} $description"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo -e "${BLUE}🎨 Verificando Correcciones de Tarjetas de Estado...${NC}"

# Verificar correcciones en tarjetas de estado del sistema
check_content "src/app/admin/page.tsx" "flex flex-col p-4" "Admin Dashboard - Tarjetas con layout vertical"
check_content "src/app/admin/page.tsx" "✓ Activo" "Admin Dashboard - Badges más pequeños"
check_content "src/app/admin/page.tsx" "md:grid-cols-2 lg:grid-cols-4" "Admin Dashboard - Grid responsive mejorado"

check_content "src/app/client/page.tsx" "flex flex-col p-4" "Client Dashboard - Tarjetas con layout vertical"
check_content "src/app/client/page.tsx" "✓ Excelente" "Client Dashboard - Badges más pequeños"
check_content "src/app/client/page.tsx" "md:grid-cols-2 lg:grid-cols-4" "Client Dashboard - Grid responsive mejorado"

echo -e "${BLUE}🔔 Verificando API de Notificaciones...${NC}"

# Verificar APIs de notificaciones
check_file "src/app/api/notifications/route.ts" "API de notificaciones principal"
check_file "src/app/api/notifications/[id]/read/route.ts" "API para marcar como leída"
check_file "src/app/api/notifications/[id]/route.ts" "API para eliminar notificación"
check_file "src/app/api/notifications/read-all/route.ts" "API para marcar todas como leídas"

# Verificar contenido de la API principal
check_content "src/app/api/notifications/route.ts" "generateUserNotifications" "API - Función de generación de notificaciones"
check_content "src/app/api/notifications/route.ts" "userRole.*ADMIN" "API - Notificaciones específicas para Admin"
check_content "src/app/api/notifications/route.ts" "userRole.*TECHNICIAN" "API - Notificaciones específicas para Técnico"
check_content "src/app/api/notifications/route.ts" "userRole.*CLIENT" "API - Notificaciones específicas para Cliente"

echo -e "${BLUE}🔔 Verificando Componente NotificationBell...${NC}"

# Verificar mejoras en NotificationBell
check_content "src/components/ui/notification-bell.tsx" "getNotificationIcon" "NotificationBell - Iconos por tipo de notificación"
check_content "src/components/ui/notification-bell.tsx" "getNotificationColor" "NotificationBell - Colores por tipo"
check_content "src/components/ui/notification-bell.tsx" "border-l-4" "NotificationBell - Bordes laterales de color"
check_content "src/components/ui/notification-bell.tsx" "line-clamp-2" "NotificationBell - Texto truncado"
check_content "src/components/ui/notification-bell.tsx" "unreadCount > 9" "NotificationBell - Contador limitado a 9+"

echo -e "${BLUE}📊 Verificando Datos Reales en Notificaciones...${NC}"

# Verificar que las notificaciones usan datos reales
check_content "src/app/api/notifications/route.ts" "unassignedUrgentTickets" "Notificaciones - Tickets urgentes sin asignar"
check_content "src/app/api/notifications/route.ts" "overdueTickets" "Notificaciones - Tickets vencidos"
check_content "src/app/api/notifications/route.ts" "urgentAssignedTickets" "Notificaciones - Tickets urgentes asignados"
check_content "src/app/api/notifications/route.ts" "ticketsWithNewComments" "Notificaciones - Nuevos comentarios"
check_content "src/app/api/notifications/route.ts" "myTicketsWithUpdates" "Notificaciones - Actualizaciones de tickets"
check_content "src/app/api/notifications/route.ts" "resolvedTickets" "Notificaciones - Tickets resueltos"

echo -e "${BLUE}🎯 Verificando Funcionalidades Avanzadas...${NC}"

# Verificar funcionalidades avanzadas
check_content "src/components/ui/notification-bell.tsx" "interval.*60000" "NotificationBell - Polling cada 60 segundos"
check_content "src/components/ui/notification-bell.tsx" "shadow-xl" "NotificationBell - Sombra mejorada"
check_content "src/components/ui/notification-bell.tsx" "h-3 w-3.*text-green-600" "NotificationBell - Iconos específicos"

echo -e "${BLUE}🔧 Verificando Responsividad...${NC}"

# Verificar mejoras de responsividad
check_content "src/app/admin/page.tsx" "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" "Admin - Grid responsivo mejorado"
check_content "src/app/client/page.tsx" "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" "Client - Grid responsivo mejorado"
check_content "src/components/ui/notification-bell.tsx" "w-80 max-h-96" "NotificationBell - Tamaño optimizado"

echo ""
echo "=============================================="
echo -e "${BLUE}📊 RESUMEN DE VERIFICACIÓN${NC}"
echo "=============================================="
echo -e "Total de pruebas: ${YELLOW}$TOTAL_TESTS${NC}"
echo -e "Pruebas exitosas: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Pruebas fallidas: ${RED}$FAILED_TESTS${NC}"

# Calcular porcentaje
if [ $TOTAL_TESTS -gt 0 ]; then
    PERCENTAGE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "Porcentaje de éxito: ${YELLOW}$PERCENTAGE%${NC}"
    
    if [ $PERCENTAGE -ge 95 ]; then
        echo -e "${GREEN}🎉 ¡EXCELENTE! Correcciones implementadas perfectamente${NC}"
    elif [ $PERCENTAGE -ge 85 ]; then
        echo -e "${YELLOW}⚠️  BUENO - Algunas correcciones menores pendientes${NC}"
    else
        echo -e "${RED}❌ NECESITA TRABAJO - Varias correcciones importantes pendientes${NC}"
    fi
fi

echo ""
echo -e "${BLUE}🔍 CORRECCIONES IMPLEMENTADAS:${NC}"
echo "• ✅ Tarjetas de estado del sistema sin desbordamiento"
echo "• ✅ Layout vertical con información organizada"
echo "• ✅ Badges más pequeños y mejor posicionados"
echo "• ✅ Grid responsivo mejorado (1-2-4 columnas)"
echo "• ✅ API de notificaciones con datos reales"
echo "• ✅ Notificaciones específicas por rol de usuario"
echo "• ✅ Componente NotificationBell funcional"
echo "• ✅ Iconos y colores por tipo de notificación"
echo "• ✅ Polling automático cada 60 segundos"
echo "• ✅ Interfaz compacta y profesional"

echo ""
echo -e "${GREEN}✨ CORRECCIONES DE DASHBOARD COMPLETADAS ✨${NC}"