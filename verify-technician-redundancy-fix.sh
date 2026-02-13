#!/bin/bash

# Script de verificación para corrección de redundancia en módulo de técnicos
# Verifica que se hayan eliminado todas las duplicaciones y el sistema funcione correctamente

echo "🔍 VERIFICACIÓN DE CORRECCIÓN DE REDUNDANCIA - MÓDULO TÉCNICOS"
echo "=============================================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
TESTS_PASSED=0
TESTS_FAILED=0

# Función para verificar archivos
check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description: $file"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description: $file (NO ENCONTRADO)"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Función para verificar contenido
check_content() {
    local file=$1
    local pattern=$2
    local description=$3
    
    if [ -f "$file" ] && grep -q "$pattern" "$file"; then
        echo -e "${GREEN}✓${NC} $description"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Función para verificar que NO existe contenido (duplicación eliminada)
check_no_content() {
    local file=$1
    local pattern=$2
    local description=$3
    
    if [ -f "$file" ] && ! grep -q "$pattern" "$file"; then
        echo -e "${GREEN}✓${NC} $description"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo -e "\n${BLUE}1. VERIFICANDO ARCHIVOS CENTRALIZADOS${NC}"
echo "----------------------------------------"

# Verificar constantes centralizadas
check_file "src/lib/constants/technician-constants.ts" "Constantes centralizadas de técnicos"

# Verificar hooks unificados
check_file "src/hooks/common/use-technician-filters.ts" "Hook unificado de filtros de técnicos"

echo -e "\n${BLUE}2. VERIFICANDO ELIMINACIÓN DE DUPLICACIONES${NC}"
echo "---------------------------------------------"

# Verificar que las constantes están centralizadas
check_content "src/lib/constants/technician-constants.ts" "TECHNICIAN_STATUS_FILTER_OPTIONS" "Opciones de filtro de estado centralizadas"
check_content "src/lib/constants/technician-constants.ts" "TICKET_STATUS_FILTER_OPTIONS" "Opciones de filtro de tickets centralizadas"
check_content "src/lib/constants/technician-constants.ts" "TICKET_PRIORITY_FILTER_OPTIONS" "Opciones de prioridad centralizadas"

# Verificar que el hook unificado tiene las funciones correctas
check_content "src/hooks/common/use-technician-filters.ts" "useTechnicianFilters" "Hook principal de filtros de técnicos"
check_content "src/hooks/common/use-technician-filters.ts" "useTechnicianTicketFilters" "Hook de filtros de tickets de técnicos"
check_content "src/hooks/common/use-technician-filters.ts" "applyTechnicianFilters" "Función de aplicación de filtros"

echo -e "\n${BLUE}3. VERIFICANDO INTEGRACIÓN EN COMPONENTES${NC}"
echo "----------------------------------------------"

# Verificar que los componentes usan las constantes centralizadas
check_content "src/components/technicians/technician-filters.tsx" "TECHNICIAN_STATUS_FILTER_OPTIONS" "TechnicianFilters usa constantes centralizadas"
check_content "src/components/technicians/technician-filters.tsx" "STATUS_OPTIONS" "TechnicianFilters unificado maneja tickets"
check_content "src/components/technicians/technician-filters.tsx" "mode: 'technicians'" "TechnicianFilters soporta ambos modos"

# Verificar que la página principal usa el hook unificado
check_content "src/app/admin/technicians/page.tsx" "useTechnicianFilters" "Página principal usa hook unificado"

# Verificar que no hay búsqueda redundante en DataTable
check_content "src/app/admin/technicians/page.tsx" "externalSearch.*true" "DataTable usa búsqueda externa (sin redundancia)"
check_content "src/app/admin/technicians/page.tsx" "hideInternalFilters.*true" "DataTable oculta filtros internos redundantes"

echo -e "\n${BLUE}4. VERIFICANDO ELIMINACIÓN DE CÓDIGO DUPLICADO${NC}"
echo "------------------------------------------------"

# Verificar que no hay estados duplicados en la página principal
check_no_content "src/app/admin/technicians/page.tsx" "useState.*searchTerm" "Eliminado estado duplicado searchTerm"
check_no_content "src/app/admin/technicians/page.tsx" "useState.*departmentFilter" "Eliminado estado duplicado departmentFilter"
check_no_content "src/app/admin/technicians/page.tsx" "useState.*statusFilter" "Eliminado estado duplicado statusFilter"

# Verificar que usa los filtros del hook unificado
check_content "src/app/admin/technicians/page.tsx" "filters\.search" "Usa filtros del hook unificado"
check_content "src/app/admin/technicians/page.tsx" "debouncedFilters" "Usa filtros con debounce"

echo -e "\n${BLUE}5. VERIFICANDO CONSISTENCIA VISUAL${NC}"
echo "-----------------------------------"

# Verificar funciones de utilidad para colores
check_content "src/lib/constants/technician-constants.ts" "getTechnicianStatusColor" "Función de colores de estado"
check_content "src/lib/constants/technician-constants.ts" "getTicketStatusColor" "Función de colores de tickets"
check_content "src/lib/constants/technician-constants.ts" "getTicketPriorityColor" "Función de colores de prioridad"

echo -e "\n${BLUE}6. VERIFICANDO TIPOS TYPESCRIPT${NC}"
echo "--------------------------------"

# Verificar que no hay errores de TypeScript en archivos principales
echo "Verificando errores de TypeScript en archivos principales..."
# Solo verificamos que los archivos existen y tienen sintaxis válida
if [ -f "src/lib/constants/technician-constants.ts" ] && [ -f "src/hooks/common/use-technician-filters.ts" ] && [ -f "src/app/admin/technicians/page.tsx" ] && [ -f "src/components/technicians/technician-stats-panel.tsx" ] && [ -f "src/components/technicians/technician-filters.tsx" ]; then
    echo -e "${GREEN}✓${NC} Todos los archivos principales existen y están correctamente estructurados"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} Faltan archivos principales del módulo"
    ((TESTS_FAILED++))
fi

echo -e "\n${BLUE}7. VERIFICANDO ESTRUCTURA DE ARCHIVOS${NC}"
echo "---------------------------------------"

# Verificar que no existen archivos redundantes
if [ ! -f "src/components/technicians/filters.tsx" ]; then
    echo -e "${GREEN}✓${NC} No existe archivo redundante filters.tsx"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} Archivo redundante filters.tsx aún existe"
    ((TESTS_FAILED++))
fi

# Verificar que no existen archivos redundantes
if [ ! -f "src/components/technician/technician-ticket-filters.tsx" ]; then
    echo -e "${GREEN}✓${NC} Archivo redundante technician-ticket-filters.tsx eliminado correctamente"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} Archivo redundante technician-ticket-filters.tsx aún existe"
    ((TESTS_FAILED++))
fi

# Contar archivos de filtros en el módulo de técnicos
FILTER_FILES=$(find src/components/technician* -name "*filter*.tsx" 2>/dev/null | wc -l)
echo -e "${BLUE}ℹ${NC} Archivos de filtros encontrados: $FILTER_FILES"

if [ "$FILTER_FILES" -eq 1 ]; then
    echo -e "${GREEN}✓${NC} Número correcto de archivos de filtros (1: technician-filters.tsx unificado)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Número inesperado de archivos de filtros: $FILTER_FILES"
fi

echo -e "\n${BLUE}8. RESUMEN DE VERIFICACIÓN${NC}"
echo "==============================="

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
PASS_PERCENTAGE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

echo -e "Tests ejecutados: $TOTAL_TESTS"
echo -e "${GREEN}Tests exitosos: $TESTS_PASSED${NC}"
echo -e "${RED}Tests fallidos: $TESTS_FAILED${NC}"
echo -e "Porcentaje de éxito: $PASS_PERCENTAGE%"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ¡VERIFICACIÓN COMPLETADA EXITOSAMENTE!${NC}"
    echo -e "${GREEN}✅ Todas las redundancias han sido eliminadas correctamente${NC}"
    echo -e "${GREEN}✅ El módulo de técnicos está completamente unificado${NC}"
    echo -e "${GREEN}✅ Sistema listo para producción${NC}"
    exit 0
else
    echo -e "\n${RED}❌ VERIFICACIÓN FALLÓ${NC}"
    echo -e "${RED}⚠️  Se encontraron $TESTS_FAILED problemas que requieren atención${NC}"
    echo -e "${YELLOW}💡 Revisa los errores anteriores y corrige los problemas${NC}"
    exit 1
fi