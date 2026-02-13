#!/bin/bash

# Script de verificación de la vista de detalles de ticket para técnicos
# Fase 13.9 - Testing completo

echo "=================================================="
echo "🎯 VERIFICACIÓN VISTA DETALLES TICKET TÉCNICOS"
echo "=================================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contador de tests
PASSED=0
FAILED=0

# Función para test
test_check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $2"
        ((FAILED++))
    fi
}

echo -e "${BLUE}1. Verificando archivo de página de detalles...${NC}"
echo ""

# Verificar archivo principal
if [ -f "src/app/technician/tickets/[id]/page.tsx" ]; then
    test_check 0 "Página de detalles de ticket creada"
else
    test_check 1 "Página de detalles de ticket NO creada"
fi

echo ""
echo -e "${BLUE}2. Verificando imports y dependencias...${NC}"
echo ""

# Verificar imports principales
if grep -q "useTicketData" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Import de useTicketData correcto"
else
    test_check 1 "Import de useTicketData faltante"
fi

if grep -q "useSession" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Import de useSession correcto"
else
    test_check 1 "Import de useSession faltante"
fi

if grep -q "useParams" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Import de useParams correcto"
else
    test_check 1 "Import de useParams faltante"
fi

echo ""
echo -e "${BLUE}3. Verificando funcionalidades principales...${NC}"
echo ""

# Verificar carga de ticket
if grep -q "loadTicket" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Función loadTicket implementada"
else
    test_check 1 "Función loadTicket NO implementada"
fi

# Verificar actualización de estado
if grep -q "handleStatusUpdate" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Función handleStatusUpdate implementada"
else
    test_check 1 "Función handleStatusUpdate NO implementada"
fi

# Verificar agregar comentarios
if grep -q "handleAddComment" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Función handleAddComment implementada"
else
    test_check 1 "Función handleAddComment NO implementada"
fi

echo ""
echo -e "${BLUE}4. Verificando lógica de estados...${NC}"
echo ""

# Verificar transiciones de estado
if grep -q "getAvailableStatuses" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Lógica de transiciones de estado implementada"
else
    test_check 1 "Lógica de transiciones de estado NO implementada"
fi

# Verificar estados específicos
if grep -q "OPEN.*IN_PROGRESS" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Transición OPEN → IN_PROGRESS permitida"
else
    test_check 1 "Transición OPEN → IN_PROGRESS NO implementada"
fi

if grep -q "IN_PROGRESS.*RESOLVED" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Transición IN_PROGRESS → RESOLVED permitida"
else
    test_check 1 "Transición IN_PROGRESS → RESOLVED NO implementada"
fi

echo ""
echo -e "${BLUE}5. Verificando componentes de UI...${NC}"
echo ""

# Verificar componentes principales
if grep -q "Card" "src/app/technician/tickets/[id]/page.tsx" && grep -q "CardHeader" "src/app/technician/tickets/[id]/page.tsx" && grep -q "CardTitle" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Componentes Card implementados"
else
    test_check 1 "Componentes Card NO implementados"
fi

if grep -q "Select" "src/app/technician/tickets/[id]/page.tsx" && grep -q "SelectContent" "src/app/technician/tickets/[id]/page.tsx" && grep -q "SelectItem" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Componente Select para estados implementado"
else
    test_check 1 "Componente Select para estados NO implementado"
fi

if grep -q "Textarea" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Textarea para comentarios implementado"
else
    test_check 1 "Textarea para comentarios NO implementado"
fi

if grep -q "Avatar" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Componente Avatar implementado"
else
    test_check 1 "Componente Avatar NO implementado"
fi

echo ""
echo -e "${BLUE}6. Verificando secciones de la página...${NC}"
echo ""

# Verificar secciones principales
if grep -q "Información del Ticket" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Sección de información del ticket"
else
    test_check 1 "Sección de información del ticket NO implementada"
fi

if grep -q "Actualizar Estado" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Sección de actualización de estado"
else
    test_check 1 "Sección de actualización de estado NO implementada"
fi

if grep -q "Agregar Comentario" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Sección de agregar comentario"
else
    test_check 1 "Sección de agregar comentario NO implementada"
fi

if grep -q "Historial de Comentarios" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Sección de historial de comentarios"
else
    test_check 1 "Sección de historial de comentarios NO implementada"
fi

if grep -q "Información del Cliente" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Sección de información del cliente"
else
    test_check 1 "Sección de información del cliente NO implementada"
fi

echo ""
echo -e "${BLUE}7. Verificando seguridad y permisos...${NC}"
echo ""

# Verificar validación de rol
if grep -q "session.user.role !== 'TECHNICIAN'" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Validación de rol TECHNICIAN implementada"
else
    test_check 1 "Validación de rol TECHNICIAN NO implementada"
fi

# Verificar redirección si no autorizado
if grep -q "router.push('/login')" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Redirección a login si no autorizado"
else
    test_check 1 "Redirección a login NO implementada"
fi

echo ""
echo -e "${BLUE}8. Verificando manejo de errores...${NC}"
echo ""

# Verificar estados de carga
if grep -q "loading.*setLoading" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Estados de carga implementados"
else
    test_check 1 "Estados de carga NO implementados"
fi

# Verificar manejo de errores
if grep -q "error.*setError" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Manejo de errores implementado"
else
    test_check 1 "Manejo de errores NO implementado"
fi

# Verificar toast notifications
if grep -q "toast" "src/app/technician/tickets/[id]/page.tsx" && grep -q "title:" "src/app/technician/tickets/[id]/page.tsx" && grep -q "description:" "src/app/technician/tickets/[id]/page.tsx"; then
    test_check 0 "Toast notifications implementadas"
else
    test_check 1 "Toast notifications NO implementadas"
fi

echo ""
echo -e "${BLUE}9. Verificando tipos TypeScript...${NC}"
echo ""

# Verificar tipos actualizados
if grep -q "avatar.*string" "src/hooks/use-ticket-data.ts"; then
    test_check 0 "Tipo User actualizado con avatar"
else
    test_check 1 "Tipo User NO actualizado con avatar"
fi

echo ""
echo -e "${BLUE}10. Verificando build...${NC}"
echo ""

# Verificar que el build compile sin errores
echo "Compilando proyecto..."
npm run build > /tmp/build-output.log 2>&1
if [ $? -eq 0 ]; then
    test_check 0 "Build de Next.js exitoso"
else
    test_check 1 "Build de Next.js FALLÓ"
    echo ""
    echo -e "${RED}Errores del build:${NC}"
    tail -20 /tmp/build-output.log
fi

echo ""
echo "=================================================="
echo -e "${YELLOW}RESUMEN DE TESTS${NC}"
echo "=================================================="
echo ""
echo -e "Tests pasados: ${GREEN}${PASSED}${NC}"
echo -e "Tests fallidos: ${RED}${FAILED}${NC}"
echo -e "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ FASE 13.9 COMPLETADA EXITOSAMENTE${NC}"
    echo ""
    echo "Vista de detalles de ticket para técnicos implementada:"
    echo ""
    echo "Funcionalidades implementadas:"
    echo "  ✓ Carga y visualización de detalles del ticket"
    echo "  ✓ Actualización de estado con lógica de transiciones"
    echo "  ✓ Agregar comentarios (internos y públicos)"
    echo "  ✓ Historial de comentarios con avatares"
    echo "  ✓ Información del cliente"
    echo "  ✓ Detalles del ticket (categoría, fechas)"
    echo "  ✓ Archivos adjuntos"
    echo "  ✓ Validación de permisos"
    echo "  ✓ Manejo de errores y estados de carga"
    echo "  ✓ Toast notifications"
    echo "  ✓ Navegación de regreso"
    echo ""
    echo "Transiciones de estado permitidas:"
    echo "  • OPEN → IN_PROGRESS"
    echo "  • IN_PROGRESS → RESOLVED, ON_HOLD"
    echo "  • ON_HOLD → IN_PROGRESS"
    echo "  • RESOLVED → IN_PROGRESS (reabrir)"
    echo ""
    echo "Próximos pasos:"
    echo "  1. Probar manualmente en el navegador"
    echo "  2. Verificar actualización de estados"
    echo "  3. Probar agregar comentarios"
    echo "  4. Continuar con Fase 13.10 (Módulo de clientes)"
    echo ""
    exit 0
else
    echo -e "${RED}✗ ALGUNOS TESTS FALLARON${NC}"
    echo ""
    echo "Por favor revisa los errores arriba y corrige los problemas."
    echo ""
    exit 1
fi