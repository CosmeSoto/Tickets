#!/bin/bash

echo "🧪 Probando correcciones de categorías..."
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# URL base
BASE_URL="http://localhost:3000"

echo "📋 1. Verificando que el servidor esté corriendo..."
if curl -s "${BASE_URL}" > /dev/null; then
    echo -e "${GREEN}✓ Servidor corriendo${NC}"
else
    echo -e "${RED}✗ Servidor no está corriendo. Inicia el servidor con: npm run dev${NC}"
    exit 1
fi

echo ""
echo "📋 2. Probando endpoint de categorías (GET /api/categories)..."
RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/categories?isActive=true")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Endpoint responde correctamente (200)${NC}"
    echo "Respuesta:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
elif [ "$HTTP_CODE" = "401" ]; then
    echo -e "${YELLOW}⚠ Requiere autenticación (401) - Esto es esperado${NC}"
else
    echo -e "${RED}✗ Error ${HTTP_CODE}${NC}"
    echo "Respuesta:"
    echo "$BODY"
fi

echo ""
echo "📋 3. Verificando compilación TypeScript..."
cd "$(dirname "$0")"
if npm run build > /tmp/build-output.txt 2>&1; then
    echo -e "${GREEN}✓ Compilación exitosa${NC}"
else
    echo -e "${RED}✗ Error en compilación${NC}"
    echo "Últimas líneas del error:"
    tail -20 /tmp/build-output.txt
    exit 1
fi

echo ""
echo "📋 4. Verificando schema de Prisma..."
if npx prisma validate > /tmp/prisma-validate.txt 2>&1; then
    echo -e "${GREEN}✓ Schema de Prisma válido${NC}"
else
    echo -e "${RED}✗ Error en schema de Prisma${NC}"
    cat /tmp/prisma-validate.txt
    exit 1
fi

echo ""
echo "📋 5. Resumen de correcciones aplicadas:"
echo "   • Cambiado 'children' → 'other_categories' en _count"
echo "   • Corregido 'assignment.technician' → 'assignment.users'"
echo "   • Actualizado todos los archivos de API de categorías"
echo "   • Actualizado category-service.ts"
echo ""
echo -e "${GREEN}✅ Todas las verificaciones completadas${NC}"
