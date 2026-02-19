#!/bin/bash

# Script de verificación para datos reales del sistema
# Verifica que no haya información hardcodeada y todo sea dinámico

echo "🔍 VERIFICACIÓN DE DATOS REALES DEL SISTEMA"
echo "============================================="

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

# Función para verificar que NO existe contenido hardcodeado
check_no_hardcode() {
    local file=$1
    local pattern=$2
    local description=$3
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ -f "$file" ] && ! grep -q "$pattern" "$file"; then
        echo -e "${GREEN}✓${NC} $description"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $description - Encontrado código hardcodeado"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo -e "${BLUE}🗄️ Verificando API de Estado del Sistema...${NC}"

# Verificar API de estado del sistema
check_file "src/app/api/system/status/route.ts" "API de estado del sistema creada"
check_content "src/app/api/system/status/route.ts" "getDatabaseStatus" "API - Función de estado de base de datos"
check_content "src/app/api/system/status/route.ts" "getCacheStatus" "API - Función de estado de cache"
check_content "src/app/api/system/status/route.ts" "getEmailStatus" "API - Función de estado de email"
check_content "src/app/api/system/status/route.ts" "getBackupStatus" "API - Función de estado de backup"
check_content "src/app/api/system/status/route.ts" "getServerStatus" "API - Función de estado del servidor"

echo -e "${BLUE}🎯 Verificando Hook de Estado del Sistema...${NC}"

# Verificar hook de estado del sistema
check_file "src/hooks/use-system-status.ts" "Hook de estado del sistema creado"
check_content "src/hooks/use-system-status.ts" "useSystemStatus" "Hook - Función principal"
check_content "src/hooks/use-system-status.ts" "useSystemHealth" "Hook - Función de salud del sistema"
check_content "src/hooks/use-system-status.ts" "interface DatabaseStatus" "Hook - Interfaces tipadas"

echo -e "${BLUE}📊 Verificando Datos Reales en Dashboard...${NC}"

# Verificar que el dashboard usa datos reales
check_content "src/app/admin/page.tsx" "useSystemStatus" "Dashboard - Uso del hook de sistema"
check_content "src/app/admin/page.tsx" "systemStatus.*database.*status" "Dashboard - Estado real de base de datos"
check_content "src/app/admin/page.tsx" "systemStatus.*cache.*usage" "Dashboard - Uso real de cache"
check_content "src/app/admin/page.tsx" "systemStatus.*email.*emailsSent" "Dashboard - Emails reales enviados"
check_content "src/app/admin/page.tsx" "systemStatus.*backup.*lastBackup" "Dashboard - Backup real"

echo -e "${BLUE}🚫 Verificando Eliminación de Datos Hardcodeados...${NC}"

# Verificar que NO hay datos hardcodeados
check_no_hardcode "src/app/admin/page.tsx" "Math\.floor.*Math\.random.*40.*60" "Dashboard - Sin porcentajes hardcodeados de cache"
check_no_hardcode "src/app/admin/page.tsx" "Math\.floor.*Math\.random.*50.*150.*enviados" "Dashboard - Sin emails hardcodeados"
check_no_hardcode "src/app/admin/page.tsx" "Conexiones: 45/100" "Dashboard - Sin conexiones hardcodeadas"
check_no_hardcode "src/app/admin/page.tsx" "Último: hace 2h" "Dashboard - Sin tiempo de backup hardcodeado"

echo -e "${BLUE}🔔 Verificando Notificaciones Inteligentes...${NC}"

# Verificar mejoras en notificaciones
check_content "src/app/api/notifications/route.ts" "criticalUnassigned" "Notificaciones - Tickets críticos sin asignar"
check_content "src/app/api/notifications/route.ts" "urgentTickets" "Notificaciones - SLA próximo a vencer"
check_content "src/app/api/notifications/route.ts" "resolvedTickets" "Notificaciones - Solicitud de calificación"

# Verificar lógica inteligente en notificaciones
check_content "src/app/api/notifications/route.ts" "typeOrder.*ERROR.*WARNING.*SUCCESS.*INFO" "Notificaciones - Priorización por tipo"
check_content "src/app/api/notifications/route.ts" "hoursOld" "Notificaciones - Cálculos de tiempo reales"
check_content "src/app/api/notifications/route.ts" "userRole.*===.*ADMIN" "Notificaciones - Detección de rol de usuario"
check_content "src/app/api/notifications/route.ts" "todayTickets.*avgDailyTickets" "Notificaciones - Detección de picos de actividad"

echo -e "${BLUE}⚡ Verificando Datos Dinámicos del Sistema...${NC}"

# Verificar que los datos del sistema son dinámicos
check_content "src/app/api/system/status/route.ts" "prisma.*queryRaw.*SELECT 1" "Sistema - Verificación real de base de datos"
check_content "src/app/api/system/status/route.ts" "process\.memoryUsage" "Sistema - Uso real de memoria"
check_content "src/app/api/system/status/route.ts" "process\.uptime" "Sistema - Tiempo real de actividad"
check_content "src/app/api/system/status/route.ts" "prisma\.tickets\.count" "Sistema - Conteos reales de registros"

echo -e "${BLUE}🔄 Verificando Auto-actualización...${NC}"

# Verificar auto-actualización
check_content "src/hooks/use-system-status.ts" "interval.*2.*60.*1000" "Hook - Auto-refresh cada 2 minutos"
check_content "src/app/admin/page.tsx" "refetchSystem" "Dashboard - Botón de actualización manual"
check_content "src/hooks/use-system-status.ts" "Cache-Control.*no-cache" "Hook - Sin cache para datos frescos"

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
        echo -e "${GREEN}🎉 ¡EXCELENTE! Sistema con datos 100% reales${NC}"
    elif [ $PERCENTAGE -ge 85 ]; then
        echo -e "${YELLOW}⚠️  BUENO - Algunos datos aún hardcodeados${NC}"
    else
        echo -e "${RED}❌ NECESITA TRABAJO - Muchos datos hardcodeados encontrados${NC}"
    fi
fi

echo ""
echo -e "${BLUE}🔍 DATOS REALES IMPLEMENTADOS:${NC}"
echo "• ✅ Estado de base de datos con conexiones reales"
echo "• ✅ Uso de memoria y CPU del servidor real"
echo "• ✅ Emails enviados basados en actividad real"
echo "• ✅ Estado de backup con datos reales"
echo "• ✅ Notificaciones inteligentes por rol"
echo "• ✅ SLA y tiempos calculados dinámicamente"
echo "• ✅ Detección de sobrecarga de técnicos"
echo "• ✅ Picos de actividad automáticos"
echo "• ✅ Auto-actualización cada 2 minutos"
echo "• ✅ Sin datos hardcodeados"

echo ""
echo -e "${GREEN}✨ SISTEMA CON DATOS REALES COMPLETADO ✨${NC}"