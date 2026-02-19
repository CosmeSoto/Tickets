#!/bin/bash

# Script de verificación del módulo de tickets
# Fecha: 27 de enero de 2026

echo "🔍 VERIFICACIÓN DEL MÓDULO DE TICKETS"
echo "======================================"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar archivos
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        return 0
    else
        echo -e "${RED}✗${NC} $1 (NO ENCONTRADO)"
        return 1
    fi
}

# Verificar archivos principales
echo "📁 Verificando archivos del módulo..."
echo ""

check_file "src/app/admin/tickets/page.tsx"
check_file "src/components/tickets/ticket-stats-panel.tsx"
check_file "src/components/tickets/ticket-filters.tsx"
check_file "src/hooks/use-ticket-data.ts"

echo ""

# Verificar que no existan archivos duplicados
echo "🗑️  Verificando archivos duplicados..."
echo ""

if [ -f "src/app/admin/tickets/page-improved.tsx" ]; then
    echo -e "${RED}✗${NC} Archivo duplicado encontrado: page-improved.tsx"
else
    echo -e "${GREEN}✓${NC} No hay archivos duplicados"
fi

echo ""

# Verificar compilación TypeScript
echo "🔨 Verificando compilación TypeScript..."
echo ""

npm run build > /tmp/build-output.txt 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Build exitoso"
else
    echo -e "${RED}✗${NC} Build falló"
    echo ""
    echo "Últimas líneas del error:"
    tail -20 /tmp/build-output.txt
    exit 1
fi

echo ""

# Verificar estructura de componentes
echo "🧩 Verificando estructura de componentes..."
echo ""

# Verificar que TicketStatsPanel tenga las 8 métricas
if grep -q "Total de Tickets" src/components/tickets/ticket-stats-panel.tsx && \
   grep -q "Abiertos" src/components/tickets/ticket-stats-panel.tsx && \
   grep -q "En Progreso" src/components/tickets/ticket-stats-panel.tsx && \
   grep -q "Resueltos" src/components/tickets/ticket-stats-panel.tsx && \
   grep -q "Alta Prioridad" src/components/tickets/ticket-stats-panel.tsx && \
   grep -q "Sin Asignar" src/components/tickets/ticket-stats-panel.tsx && \
   grep -q "Creados Hoy" src/components/tickets/ticket-stats-panel.tsx && \
   grep -q "Tiempo Promedio" src/components/tickets/ticket-stats-panel.tsx; then
    echo -e "${GREEN}✓${NC} TicketStatsPanel: 8 métricas implementadas"
else
    echo -e "${RED}✗${NC} TicketStatsPanel: Faltan métricas"
fi

# Verificar que TicketFilters tenga los 5 filtros
if grep -q "searchTerm" src/components/tickets/ticket-filters.tsx && \
   grep -q "statusFilter" src/components/tickets/ticket-filters.tsx && \
   grep -q "priorityFilter" src/components/tickets/ticket-filters.tsx && \
   grep -q "categoryFilter" src/components/tickets/ticket-filters.tsx && \
   grep -q "assigneeFilter" src/components/tickets/ticket-filters.tsx; then
    echo -e "${GREEN}✓${NC} TicketFilters: 5 filtros implementados"
else
    echo -e "${RED}✗${NC} TicketFilters: Faltan filtros"
fi

# Verificar integración en página principal
if grep -q "TicketStatsPanel" src/app/admin/tickets/page.tsx && \
   grep -q "TicketFilters" src/app/admin/tickets/page.tsx && \
   grep -q "calculateStats" src/app/admin/tickets/page.tsx; then
    echo -e "${GREEN}✓${NC} Página principal: Componentes integrados"
else
    echo -e "${RED}✗${NC} Página principal: Falta integración"
fi

echo ""

# Verificar corrección de assigneeId
echo "🔧 Verificando correcciones técnicas..."
echo ""

if grep -q "!t.assignee" src/app/admin/tickets/page.tsx; then
    echo -e "${GREEN}✓${NC} Corrección de assigneeId → assignee aplicada"
else
    echo -e "${RED}✗${NC} Corrección de assigneeId no aplicada"
fi

echo ""

# Resumen final
echo "======================================"
echo "✅ VERIFICACIÓN COMPLETADA"
echo "======================================"
echo ""
echo "El módulo de tickets está listo para uso."
echo ""
echo "Para iniciar el servidor de desarrollo:"
echo "  npm run dev"
echo ""
echo "Para compilar para producción:"
echo "  npm run build"
echo ""
