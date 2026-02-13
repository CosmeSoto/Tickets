#!/bin/bash

# Script de Testing de APIs de Base de Conocimientos
# Ejecutar: bash test-knowledge-apis.sh

echo "🧪 Testing APIs de Base de Conocimientos"
echo "========================================"
echo ""

BASE_URL="http://localhost:3000"
API_URL="$BASE_URL/api"

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para test
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    echo -e "${YELLOW}Testing:${NC} $description"
    echo "  Method: $method"
    echo "  Endpoint: $endpoint"
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
            -H "Content-Type: application/json")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "  ${GREEN}✓ PASS${NC} (Status: $status_code)"
    else
        echo -e "  ${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $status_code)"
        echo "  Response: $body"
    fi
    echo ""
}

echo "📋 1. Testing Knowledge Articles Endpoints"
echo "-------------------------------------------"

# Test 1: Listar artículos
test_endpoint "GET" "/knowledge" "" 200 "Listar todos los artículos"

# Test 2: Listar con búsqueda
test_endpoint "GET" "/knowledge?search=vpn" "" 200 "Buscar artículos por texto"

# Test 3: Listar con filtro de categoría
test_endpoint "GET" "/knowledge?sortBy=views" "" 200 "Ordenar por vistas"

# Test 4: Listar con paginación
test_endpoint "GET" "/knowledge?page=1&limit=10" "" 200 "Paginación de artículos"

echo "📋 2. Testing Article Operations"
echo "--------------------------------"

# Test 5: Ver artículo específico (usar ID del seed)
test_endpoint "GET" "/knowledge/invalid-id" "" 404 "Artículo no encontrado"

echo "📋 3. Testing Similar Articles"
echo "------------------------------"

# Test 6: Buscar artículos similares
SIMILAR_DATA='{
  "title": "No puedo conectar a VPN",
  "description": "Error al intentar conectar",
  "limit": 5
}'
test_endpoint "POST" "/knowledge/similar" "$SIMILAR_DATA" 200 "Buscar artículos similares"

# Test 7: Buscar similares sin datos suficientes
SIMILAR_DATA_SHORT='{"title": "VPN"}'
test_endpoint "POST" "/knowledge/similar" "$SIMILAR_DATA_SHORT" 400 "Búsqueda con título muy corto"

echo "📋 4. Testing Validation"
echo "------------------------"

# Test 8: Crear artículo sin autenticación (debería fallar)
CREATE_DATA='{
  "title": "Test Article",
  "content": "Test content",
  "categoryId": "test-id",
  "tags": ["test"]
}'
test_endpoint "POST" "/knowledge" "$CREATE_DATA" 401 "Crear sin autenticación"

echo ""
echo "========================================"
echo "🎉 Testing Completado"
echo ""
echo "Nota: Para tests completos con autenticación,"
echo "ejecuta los tests desde la aplicación con sesión activa."
echo ""
