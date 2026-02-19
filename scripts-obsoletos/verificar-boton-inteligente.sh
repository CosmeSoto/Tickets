#!/bin/bash

# Script de Verificación: Botón Inteligente de Artículos
# Fecha: 2026-02-06

echo "🔍 VERIFICACIÓN: Botón Inteligente de Artículos en Tickets"
echo "=========================================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
PASSED=0
FAILED=0

# Función para verificar archivos
check_file() {
    local file=$1
    local pattern=$2
    local description=$3
    
    echo -n "Verificando: $description... "
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Archivo: $file"
        echo "  Patrón no encontrado: $pattern"
        ((FAILED++))
        return 1
    fi
}

echo "📋 Verificando Cambios en API..."
echo "--------------------------------"

# 1. API incluye knowledge_article
check_file "src/app/api/tickets/[id]/route.ts" \
    "knowledge_article:" \
    "API incluye relación knowledge_article"

check_file "src/app/api/tickets/[id]/route.ts" \
    "isPublished:" \
    "API incluye campo isPublished"

echo ""
echo "📋 Verificando Página de Técnico..."
echo "------------------------------------"

# 2. Página de técnico - imports
check_file "src/app/technician/tickets/[id]/page.tsx" \
    "BookOpen" \
    "Import de ícono BookOpen"

# 3. Página de técnico - lógica
check_file "src/app/technician/tickets/[id]/page.tsx" \
    "hasArticle" \
    "Variable hasArticle definida"

check_file "src/app/technician/tickets/[id]/page.tsx" \
    "handleViewArticle" \
    "Función handleViewArticle definida"

# 4. Página de técnico - renderizado condicional
check_file "src/app/technician/tickets/[id]/page.tsx" \
    "Ver Artículo" \
    "Botón 'Ver Artículo' implementado"

check_file "src/app/technician/tickets/[id]/page.tsx" \
    "Borrador" \
    "Badge 'Borrador' implementado"

echo ""
echo "📋 Verificando Página de Admin..."
echo "----------------------------------"

# 5. Página de admin - imports
check_file "src/app/admin/tickets/[id]/page.tsx" \
    "BookOpen" \
    "Import de ícono BookOpen"

# 6. Página de admin - renderizado condicional
check_file "src/app/admin/tickets/[id]/page.tsx" \
    "ticket.knowledge_article ?" \
    "Renderizado condicional implementado"

check_file "src/app/admin/tickets/[id]/page.tsx" \
    "Ver Artículo" \
    "Botón 'Ver Artículo' implementado"

check_file "src/app/admin/tickets/[id]/page.tsx" \
    "Borrador" \
    "Badge 'Borrador' implementado"

echo ""
echo "📋 Verificando Estructura de Base de Datos..."
echo "----------------------------------------------"

# 7. Schema de Prisma
check_file "prisma/schema.prisma" \
    "knowledge_article.*knowledge_articles.*@relation" \
    "Relación knowledge_article en modelo tickets"

echo ""
echo "=========================================================="
echo "📊 RESUMEN DE VERIFICACIÓN"
echo "=========================================================="
echo ""
echo -e "${GREEN}✓ Pruebas Pasadas: $PASSED${NC}"
echo -e "${RED}✗ Pruebas Fallidas: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ¡TODAS LAS VERIFICACIONES PASARON!${NC}"
    echo ""
    echo "✅ El botón inteligente está correctamente implementado"
    echo ""
    echo "Próximos pasos:"
    echo "1. Reiniciar el servidor de desarrollo"
    echo "2. Probar manualmente:"
    echo "   - Abrir ticket en estado RESOLVED sin artículo"
    echo "   - Verificar botón 'Crear Artículo'"
    echo "   - Crear artículo desde el ticket"
    echo "   - Volver al ticket"
    echo "   - Verificar botón 'Ver Artículo' con badge si es borrador"
    echo ""
    exit 0
else
    echo -e "${RED}❌ ALGUNAS VERIFICACIONES FALLARON${NC}"
    echo ""
    echo "Por favor revisa los archivos indicados arriba."
    echo ""
    exit 1
fi
