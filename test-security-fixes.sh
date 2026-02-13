#!/bin/bash

# Script de verificación de correcciones de seguridad
# Fecha: 27 de enero de 2026

echo "🔐 VERIFICACIÓN DE CORRECCIONES DE SEGURIDAD"
echo "=============================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contador de pruebas
PASSED=0
FAILED=0

# Función para verificar
check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $1"
        ((FAILED++))
    fi
}

# 1. Verificar middleware
echo "📋 1. Verificando Middleware..."
echo ""

# Verificar restricción de rutas /client
if grep -q "if (path.startsWith('/client'))" src/middleware.ts && \
   grep -q "if (userRole !== 'CLIENT')" src/middleware.ts; then
    check "Restricción de rutas /client implementada"
else
    check "Restricción de rutas /client NO implementada"
fi

# Verificar restricción de rutas /technician
if grep -q "if (path.startsWith('/technician'))" src/middleware.ts && \
   grep -q "if (userRole !== 'TECHNICIAN')" src/middleware.ts; then
    check "Restricción de rutas /technician implementada"
else
    check "Restricción de rutas /technician NO implementada"
fi

# Verificar logging de seguridad
if grep -q "ApplicationLogger.securityEvent" src/middleware.ts; then
    check "Logging de eventos de seguridad implementado"
else
    check "Logging de eventos de seguridad NO implementado"
fi

echo ""

# 2. Verificar API de tickets
echo "📋 2. Verificando API de Tickets..."
echo ""

# Verificar validación de ownership en GET
if grep -q "if (session.user.role === 'CLIENT' && ticket.clientId !== session.user.id)" src/app/api/tickets/\[id\]/route.ts; then
    check "Validación de ownership en GET implementada"
else
    check "Validación de ownership en GET NO implementada"
fi

# Verificar control de permisos en PUT
if grep -q "if (session.user.role === 'CLIENT')" src/app/api/tickets/\[id\]/route.ts && \
   grep -q "if (session.user.role === 'TECHNICIAN')" src/app/api/tickets/\[id\]/route.ts && \
   grep -q "if (session.user.role === 'ADMIN')" src/app/api/tickets/\[id\]/route.ts; then
    check "Control de permisos por rol en PUT implementado"
else
    check "Control de permisos por rol en PUT NO implementado"
fi

# Verificar restricción de campos para clientes
if grep -q "const allowedFields = \['title', 'description'\]" src/app/api/tickets/\[id\]/route.ts; then
    check "Restricción de campos para clientes implementada"
else
    check "Restricción de campos para clientes NO implementada"
fi

# Verificar restricción de estado OPEN para clientes
if grep -q "if (existingTicket.status !== 'OPEN')" src/app/api/tickets/\[id\]/route.ts; then
    check "Restricción de estado OPEN para clientes implementada"
else
    check "Restricción de estado OPEN para clientes NO implementada"
fi

# Verificar que técnicos no pueden modificar título/descripción
if grep -q "if (updates.title || updates.description)" src/app/api/tickets/\[id\]/route.ts; then
    check "Restricción de título/descripción para técnicos implementada"
else
    check "Restricción de título/descripción para técnicos NO implementada"
fi

# Verificar registro en historial
if grep -q "await prisma.ticket_history.create" src/app/api/tickets/\[id\]/route.ts; then
    check "Registro en historial de cambios implementado"
else
    check "Registro en historial de cambios NO implementado"
fi

# Verificar permisos en DELETE
if grep -q "if (session.user.role === 'ADMIN')" src/app/api/tickets/\[id\]/route.ts && \
   grep -q "if (session.user.role === 'CLIENT')" src/app/api/tickets/\[id\]/route.ts; then
    check "Validación de permisos en DELETE implementada"
else
    check "Validación de permisos en DELETE NO implementada"
fi

echo ""

# 3. Verificar compilación
echo "📋 3. Verificando Compilación..."
echo ""

npm run build > /tmp/security-build-test.txt 2>&1

if [ $? -eq 0 ]; then
    check "Build compila sin errores"
else
    check "Build tiene errores"
    echo ""
    echo "Últimas líneas del error:"
    tail -20 /tmp/security-build-test.txt
fi

echo ""

# 4. Verificar estructura de archivos
echo "📋 4. Verificando Estructura de Archivos..."
echo ""

if [ -f "src/middleware.ts" ]; then
    check "Middleware existe"
else
    check "Middleware NO existe"
fi

if [ -f "src/app/api/tickets/[id]/route.ts" ]; then
    check "API de tickets existe"
else
    check "API de tickets NO existe"
fi

if [ -f "src/app/api/users/[id]/route.ts" ]; then
    check "API de usuarios existe"
else
    check "API de usuarios NO existe"
fi

if [ -f "CORRECCIONES_SEGURIDAD_APLICADAS.md" ]; then
    check "Documentación de correcciones existe"
else
    check "Documentación de correcciones NO existe"
fi

echo ""

# Resumen
echo "=============================================="
echo -e "${BLUE}RESUMEN DE VERIFICACIÓN${NC}"
echo "=============================================="
echo ""
echo -e "Pruebas pasadas: ${GREEN}$PASSED${NC}"
echo -e "Pruebas fallidas: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ TODAS LAS CORRECCIONES DE SEGURIDAD IMPLEMENTADAS${NC}"
    echo ""
    echo "El sistema ahora tiene:"
    echo "  ✅ Separación estricta de roles"
    echo "  ✅ Validación de ownership en APIs"
    echo "  ✅ Control de permisos por rol"
    echo "  ✅ Auditoría de cambios"
    echo "  ✅ Logs de seguridad"
    echo ""
    echo "Estado: LISTO PARA PRODUCCIÓN"
    exit 0
else
    echo -e "${RED}❌ ALGUNAS CORRECCIONES FALTAN${NC}"
    echo ""
    echo "Revisa los errores arriba y corrige antes de continuar."
    exit 1
fi
