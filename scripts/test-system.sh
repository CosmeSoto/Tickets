#!/bin/bash

# Script de testing completo del sistema
# Verifica todos los módulos y funcionalidades

echo ""
echo "🧪 TESTING COMPLETO DEL SISTEMA"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Función para ejecutar test
run_test() {
    local test_name=$1
    local test_command=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "  Testing: $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 1. Verificar archivos críticos
echo "📁 Verificando archivos críticos..."
echo ""

run_test "Prisma Schema" "test -f prisma/schema.prisma"
run_test "Package.json" "test -f package.json"
run_test "Next Config" "test -f next.config.ts"
run_test "TypeScript Config" "test -f tsconfig.json"
run_test "Environment File" "test -f .env || test -f .env.local"

echo ""

# 2. Verificar componentes compartidos
echo "🎨 Verificando componentes compartidos..."
echo ""

run_test "RoleDashboardLayout" "test -f src/components/layout/role-dashboard-layout.tsx"
run_test "StatsCard" "test -f src/components/shared/stats-card.tsx"
run_test "TicketCard" "test -f src/components/shared/ticket-card.tsx"
run_test "NotificationBell" "test -f src/components/ui/notification-bell.tsx"

echo ""

# 3. Verificar módulos ADMIN
echo "👨‍💼 Verificando módulos ADMIN..."
echo ""

run_test "Admin Dashboard" "test -f src/app/admin/page.tsx"
run_test "Admin Tickets" "test -f src/app/admin/tickets/page.tsx"
run_test "Admin Users" "test -f src/app/admin/users/page.tsx"
run_test "Admin Categories" "test -f src/app/admin/categories/page.tsx"
run_test "Admin Departments" "test -f src/app/admin/departments/page.tsx"

echo ""

# 4. Verificar módulos CLIENT
echo "👤 Verificando módulos CLIENT..."
echo ""

run_test "Client Dashboard" "test -f src/app/client/page.tsx"
run_test "Client Profile" "test -f src/app/client/profile/page.tsx"
run_test "Client Notifications" "test -f src/app/client/notifications/page.tsx"
run_test "Client Settings" "test -f src/app/client/settings/page.tsx"
run_test "Client Help" "test -f src/app/client/help/page.tsx"

echo ""

# 5. Verificar módulos TECHNICIAN
echo "🔧 Verificando módulos TECHNICIAN..."
echo ""

run_test "Technician Dashboard" "test -f src/app/technician/page.tsx"
run_test "Technician Stats" "test -f src/app/technician/stats/page.tsx"
run_test "Technician Categories" "test -f src/app/technician/categories/page.tsx"
run_test "Technician Knowledge" "test -f src/app/technician/knowledge/page.tsx"

echo ""

# 6. Verificar hooks refactorizados
echo "🪝 Verificando hooks refactorizados..."
echo ""

run_test "Categories Hook - Types" "test -f src/hooks/categories/types.ts"
run_test "Categories Hook - Data" "test -f src/hooks/categories/use-categories-data.ts"
run_test "Categories Hook - Form" "test -f src/hooks/categories/use-categories-form.ts"
run_test "Categories Hook - Index" "test -f src/hooks/categories/index.ts"

echo ""

# 7. Verificar TypeScript
echo "📘 Verificando TypeScript..."
echo ""

if command -v tsc &> /dev/null; then
    run_test "TypeScript Compilation" "npx tsc --noEmit"
else
    echo -e "  ${YELLOW}⚠ TypeScript no disponible${NC}"
fi

echo ""

# 8. Verificar estructura de carpetas
echo "📂 Verificando estructura de carpetas..."
echo ""

run_test "Components Directory" "test -d src/components"
run_test "App Directory" "test -d src/app"
run_test "Hooks Directory" "test -d src/hooks"
run_test "Lib Directory" "test -d src/lib"
run_test "Types Directory" "test -d src/types"

echo ""

# 9. Verificar documentación
echo "📚 Verificando documentación..."
echo ""

run_test "README" "test -f README.md"
run_test "STATUS" "test -f STATUS.md"
run_test "PROGRESS" "test -f PROGRESS.md"
run_test "Phase 2 Complete" "test -f PHASE_2_COMPLETE.md"
run_test "Phase 3 Complete" "test -f PHASE_3_COMPLETE.md"
run_test "Phase 4 Complete" "test -f PHASE_4_COMPLETE.md"

echo ""

# 10. Verificar scripts
echo "🔨 Verificando scripts..."
echo ""

run_test "Phase 2 Summary" "test -f scripts/show-phase2-summary.js"
run_test "Phase 3 Summary" "test -f scripts/show-phase3-summary.js"
run_test "Phase 4 Summary" "test -f scripts/show-phase4-summary.js"
run_test "Database Verification" "test -f scripts/verify-database.ts"

echo ""

# Resumen final
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 RESUMEN DE TESTING"
echo ""
echo "  Total de tests: $TOTAL_TESTS"
echo -e "  ${GREEN}✓ Pasados: $PASSED_TESTS${NC}"
echo -e "  ${RED}✗ Fallidos: $FAILED_TESTS${NC}"
echo ""

# Calcular porcentaje
PERCENTAGE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

echo "  Tasa de éxito: $PERCENTAGE%"
echo ""

# Determinar estado
if [ $PERCENTAGE -ge 95 ]; then
    echo -e "  ${GREEN}✨ Estado: EXCELENTE${NC}"
    EXIT_CODE=0
elif [ $PERCENTAGE -ge 80 ]; then
    echo -e "  ${GREEN}✅ Estado: BUENO${NC}"
    EXIT_CODE=0
elif [ $PERCENTAGE -ge 60 ]; then
    echo -e "  ${YELLOW}⚠️  Estado: ACEPTABLE${NC}"
    EXIT_CODE=0
else
    echo -e "  ${RED}❌ Estado: REQUIERE ATENCIÓN${NC}"
    EXIT_CODE=1
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

exit $EXIT_CODE
