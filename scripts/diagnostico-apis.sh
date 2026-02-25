#!/bin/bash

# Script de Diagnóstico de APIs
# Verifica el estado de las APIs críticas del sistema

echo "🔍 DIAGNÓSTICO DE APIs - Sistema de Tickets"
echo "=========================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# URL base
BASE_URL="${1:-http://localhost:3000}"

echo "📍 URL Base: $BASE_URL"
echo ""

# Función para verificar endpoint
check_endpoint() {
    local endpoint=$1
    local name=$2
    local expected_status=${3:-200}
    
    echo -n "Verificando $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ OK${NC} (HTTP $response)"
        return 0
    elif [ "$response" = "401" ]; then
        echo -e "${YELLOW}🔒 Requiere autenticación${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}❌ ERROR${NC} (HTTP $response)"
        return 1
    fi
}

# Verificar servidor
echo "1️⃣  Verificando servidor..."
if curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Servidor respondiendo${NC}"
else
    echo -e "${RED}❌ Servidor NO responde${NC}"
    echo ""
    echo "💡 Solución: Inicia el servidor con 'npm run dev'"
    exit 1
fi
echo ""

# Verificar APIs públicas
echo "2️⃣  Verificando APIs públicas..."
check_endpoint "/api/health" "Health Check"
check_endpoint "/api/auth/session" "Auth Session"
echo ""

# Verificar APIs protegidas (esperamos 401 sin autenticación)
echo "3️⃣  Verificando APIs protegidas..."
check_endpoint "/api/dashboard/stats?role=ADMIN" "Dashboard Stats" "401"
check_endpoint "/api/dashboard/tickets?role=ADMIN&limit=5" "Dashboard Tickets" "401"
check_endpoint "/api/system/status" "System Status" "401"
check_endpoint "/api/users" "Users API" "401"
check_endpoint "/api/tickets" "Tickets API" "401"
echo ""

# Verificar archivos críticos
echo "4️⃣  Verificando archivos críticos..."
files=(
    "src/app/api/auth/[...nextauth]/route.ts"
    "src/app/api/auth/session/route.ts"
    "src/app/api/dashboard/stats/route.ts"
    "src/app/api/dashboard/tickets/route.ts"
    "src/app/api/system/status/route.ts"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $file"
    else
        echo -e "${RED}❌${NC} $file (FALTA)"
    fi
done
echo ""

# Verificar variables de entorno
echo "5️⃣  Verificando variables de entorno..."
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✅${NC} .env.local existe"
    
    if grep -q "NEXTAUTH_URL" .env.local; then
        echo -e "${GREEN}✅${NC} NEXTAUTH_URL configurado"
    else
        echo -e "${RED}❌${NC} NEXTAUTH_URL NO configurado"
    fi
    
    if grep -q "NEXTAUTH_SECRET" .env.local; then
        echo -e "${GREEN}✅${NC} NEXTAUTH_SECRET configurado"
    else
        echo -e "${RED}❌${NC} NEXTAUTH_SECRET NO configurado"
    fi
    
    if grep -q "DATABASE_URL" .env.local; then
        echo -e "${GREEN}✅${NC} DATABASE_URL configurado"
    else
        echo -e "${RED}❌${NC} DATABASE_URL NO configurado"
    fi
else
    echo -e "${RED}❌${NC} .env.local NO existe"
fi
echo ""

# Verificar proceso Node.js
echo "6️⃣  Verificando procesos..."
if pgrep -f "next dev" > /dev/null; then
    echo -e "${GREEN}✅${NC} Servidor Next.js corriendo"
    echo "   PID: $(pgrep -f 'next dev')"
else
    echo -e "${YELLOW}⚠️${NC}  Servidor Next.js NO detectado"
fi
echo ""

# Resumen
echo "=========================================="
echo "📊 RESUMEN"
echo "=========================================="
echo ""
echo "Si ves errores 404 en el navegador:"
echo ""
echo "1. ${YELLOW}Reinicia el servidor:${NC}"
echo "   - Detén el servidor (Ctrl+C)"
echo "   - Ejecuta: npm run dev"
echo ""
echo "2. ${YELLOW}Limpia el cache:${NC}"
echo "   - Navegador: Ctrl+Shift+R (o Cmd+Shift+R en Mac)"
echo "   - Next.js: rm -rf .next && npm run dev"
echo ""
echo "3. ${YELLOW}Verifica en incógnito:${NC}"
echo "   - Abre ventana de incógnito"
echo "   - Navega a $BASE_URL"
echo ""
echo "4. ${YELLOW}Revisa logs del servidor:${NC}"
echo "   - Busca errores en la terminal donde corre 'npm run dev'"
echo ""
echo "=========================================="
