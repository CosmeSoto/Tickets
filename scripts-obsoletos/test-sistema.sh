#!/bin/bash

echo "🧪 Probando Sistema de Tickets"
echo "================================"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para probar endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_code=$3
    
    echo -n "Probando $name... "
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$response" -eq "$expected_code" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $response, esperado $expected_code)"
        return 1
    fi
}

# Contador de pruebas
total=0
passed=0

echo "📡 Probando Endpoints Públicos"
echo "-------------------------------"

# Test 1: Página de login
((total++))
if test_endpoint "Login Page" "http://localhost:3000/login" 200; then
    ((passed++))
fi

# Test 2: API de sesión
((total++))
if test_endpoint "Session API" "http://localhost:3000/api/auth/session" 200; then
    ((passed++))
fi

# Test 3: API de providers
((total++))
if test_endpoint "Providers API" "http://localhost:3000/api/auth/providers" 200; then
    ((passed++))
fi

# Test 4: Página principal (debe redirigir)
((total++))
if test_endpoint "Home Page" "http://localhost:3000/" 200; then
    ((passed++))
fi

echo ""
echo "📊 Resultados"
echo "-------------"
echo "Total de pruebas: $total"
echo -e "Pasadas: ${GREEN}$passed${NC}"
echo -e "Fallidas: ${RED}$((total - passed))${NC}"

if [ $passed -eq $total ]; then
    echo ""
    echo -e "${GREEN}✅ ¡Todas las pruebas pasaron!${NC}"
    echo ""
    echo "🚀 El sistema está funcionando correctamente"
    echo ""
    echo "Puedes acceder a:"
    echo "  • Login: http://localhost:3000/login"
    echo "  • Admin: http://localhost:3000/admin"
    echo "  • Técnico: http://localhost:3000/technician"
    echo "  • Cliente: http://localhost:3000/client"
    echo ""
    echo "Credenciales de prueba:"
    echo "  Admin: admin@tickets.com / admin123"
    echo "  Técnico: tech@tickets.com / tech123"
    echo "  Cliente: client@tickets.com / client123"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Algunas pruebas fallaron${NC}"
    echo ""
    echo "Verifica que:"
    echo "  1. El servidor esté corriendo (npm run dev)"
    echo "  2. La base de datos esté conectada"
    echo "  3. Las variables de entorno estén configuradas"
    exit 1
fi
