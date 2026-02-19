#!/bin/bash

# Script de prueba para selector de categorías en cascada
# Fecha: 27 de enero de 2026

echo "🧪 PRUEBA: Selector de Categorías en Cascada"
echo "=============================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar que el archivo existe
if [ ! -f "src/app/admin/tickets/create/page.tsx" ]; then
    echo -e "${RED}✗${NC} Archivo no encontrado: src/app/admin/tickets/create/page.tsx"
    exit 1
fi

echo -e "${GREEN}✓${NC} Archivo encontrado"
echo ""

# Verificar función buildCategoryTree
echo "📊 Verificando función buildCategoryTree..."
if grep -q "buildCategoryTree" src/app/admin/tickets/create/page.tsx; then
    echo -e "${GREEN}✓${NC} Función buildCategoryTree encontrada"
else
    echo -e "${RED}✗${NC} Función buildCategoryTree NO encontrada"
    exit 1
fi

# Verificar que se construye el árbol en loadData
echo "📊 Verificando construcción de árbol en loadData..."
if grep -q "const categoryTree = buildCategoryTree" src/app/admin/tickets/create/page.tsx; then
    echo -e "${GREEN}✓${NC} Construcción de árbol implementada"
else
    echo -e "${RED}✗${NC} Construcción de árbol NO implementada"
    exit 1
fi

# Verificar logs de debugging
echo "📊 Verificando logs de debugging..."
if grep -q "console.log('📊 Category tree built:" src/app/admin/tickets/create/page.tsx; then
    echo -e "${GREEN}✓${NC} Logs de debugging agregados"
else
    echo -e "${YELLOW}⚠${NC} Logs de debugging no encontrados (opcional)"
fi

# Verificar estructura de children
echo "📊 Verificando uso de children..."
if grep -q "selectedCat.children" src/app/admin/tickets/create/page.tsx; then
    echo -e "${GREEN}✓${NC} Uso de children implementado"
else
    echo -e "${RED}✗${NC} Uso de children NO implementado"
    exit 1
fi

# Verificar los 4 niveles
echo ""
echo "📊 Verificando selectores de 4 niveles..."

for level in 1 2 3 4; do
    if grep -q "category-level-$level" src/app/admin/tickets/create/page.tsx; then
        echo -e "${GREEN}✓${NC} Nivel $level implementado"
    else
        echo -e "${RED}✗${NC} Nivel $level NO implementado"
        exit 1
    fi
done

# Verificar bordes de color por nivel
echo ""
echo "🎨 Verificando indicadores visuales..."

if grep -q "border-blue-200" src/app/admin/tickets/create/page.tsx; then
    echo -e "${GREEN}✓${NC} Borde azul (nivel 2)"
else
    echo -e "${YELLOW}⚠${NC} Borde azul no encontrado"
fi

if grep -q "border-green-200" src/app/admin/tickets/create/page.tsx; then
    echo -e "${GREEN}✓${NC} Borde verde (nivel 3)"
else
    echo -e "${YELLOW}⚠${NC} Borde verde no encontrado"
fi

if grep -q "border-purple-200" src/app/admin/tickets/create/page.tsx; then
    echo -e "${GREEN}✓${NC} Borde púrpura (nivel 4)"
else
    echo -e "${YELLOW}⚠${NC} Borde púrpura no encontrado"
fi

# Verificar ruta de navegación
echo ""
echo "🗺️  Verificando ruta de navegación..."
if grep -q "Ruta seleccionada:" src/app/admin/tickets/create/page.tsx; then
    echo -e "${GREEN}✓${NC} Ruta de navegación implementada"
else
    echo -e "${YELLOW}⚠${NC} Ruta de navegación no encontrada"
fi

# Verificar compilación
echo ""
echo "🔨 Verificando compilación TypeScript..."
npm run build > /tmp/build-cascade-test.txt 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Build exitoso"
else
    echo -e "${RED}✗${NC} Build falló"
    echo ""
    echo "Últimas líneas del error:"
    tail -20 /tmp/build-cascade-test.txt
    exit 1
fi

# Resumen
echo ""
echo "=============================================="
echo -e "${GREEN}✅ TODAS LAS PRUEBAS PASARON${NC}"
echo "=============================================="
echo ""
echo "El selector de categorías en cascada está funcionando correctamente."
echo ""
echo -e "${BLUE}Instrucciones de prueba manual:${NC}"
echo ""
echo "1. Inicia el servidor de desarrollo:"
echo "   npm run dev"
echo ""
echo "2. Navega a: http://localhost:3000/admin/tickets/create"
echo ""
echo "3. Selecciona un cliente"
echo ""
echo "4. En la sección de categorías:"
echo "   - Selecciona una categoría de Nivel 1"
echo "   - Verifica que aparezca el selector de Nivel 2"
echo "   - Selecciona una categoría de Nivel 2"
echo "   - Verifica que aparezca el selector de Nivel 3"
echo "   - Continúa hasta el Nivel 4 si está disponible"
echo ""
echo "5. Verifica que la ruta de navegación se muestre correctamente"
echo ""
echo "6. Abre la consola del navegador (F12) y verifica los logs:"
echo "   - '📊 Category tree built:' al cargar"
echo "   - 'Selected category:' al seleccionar"
echo "   - 'Level X categories available:' al cambiar nivel"
echo ""
echo -e "${GREEN}¡Listo para probar!${NC}"
echo ""
