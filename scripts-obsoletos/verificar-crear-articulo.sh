#!/bin/bash

# Verificación de correcciones para crear artículo

echo "🔍 VERIFICACIÓN: Crear Artículo y Cargar Categorías"
echo "===================================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

PASSED=0
FAILED=0

# 1. Verificar que loadCategories está en técnico
echo "1. Verificando carga de categorías en técnico..."
if grep -q "loadCategories()" src/app/technician/knowledge/new/page.tsx && \
   grep -q "useEffect.*loadCategories" src/app/technician/knowledge/new/page.tsx; then
  echo -e "${GREEN}✅ Técnico carga categorías correctamente${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Técnico NO carga categorías${NC}"
  ((FAILED++))
fi

# 2. Verificar que loadCategories está en admin
echo "2. Verificando carga de categorías en admin..."
if grep -q "loadCategories()" src/app/admin/knowledge/new/page.tsx && \
   grep -q "useEffect.*loadCategories" src/app/admin/knowledge/new/page.tsx; then
  echo -e "${GREEN}✅ Admin carga categorías correctamente${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Admin NO carga categorías${NC}"
  ((FAILED++))
fi

# 3. Verificar ruta en técnico tickets
echo "3. Verificando ruta en técnico tickets..."
if grep -q "knowledge/new?fromTicket" src/app/technician/tickets/\[id\]/page.tsx; then
  echo -e "${GREEN}✅ Ruta correcta en técnico tickets${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Ruta incorrecta en técnico tickets${NC}"
  ((FAILED++))
fi

# 4. Verificar ruta en admin tickets
echo "4. Verificando ruta en admin tickets..."
if grep -q "knowledge/new?fromTicket" src/app/admin/tickets/\[id\]/page.tsx; then
  echo -e "${GREEN}✅ Ruta correcta en admin tickets${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Ruta incorrecta en admin tickets${NC}"
  ((FAILED++))
fi

# 5. Verificar que NO hay referencias a /create
echo "5. Verificando que no hay rutas /create..."
if ! grep -q "knowledge/create[^d]" src/app/technician/tickets/\[id\]/page.tsx && \
   ! grep -q "knowledge/create[^d]" src/app/admin/tickets/\[id\]/page.tsx; then
  echo -e "${GREEN}✅ No hay rutas /create incorrectas${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Aún hay rutas /create incorrectas${NC}"
  ((FAILED++))
fi

# 6. Verificar que las carpetas existen
echo "6. Verificando que las carpetas /new existen..."
if [ -d "src/app/technician/knowledge/new" ] && \
   [ -d "src/app/admin/knowledge/new" ]; then
  echo -e "${GREEN}✅ Carpetas /new existen${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Carpetas /new NO existen${NC}"
  ((FAILED++))
fi

echo ""
echo "===================================================="
echo "RESULTADO: $PASSED pasadas, $FAILED fallidas"
echo "===================================================="
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ TODAS LAS CORRECCIONES APLICADAS${NC}"
  echo ""
  echo "Ahora prueba manualmente:"
  echo "1. Navega a /technician/knowledge/new"
  echo "2. Verifica que el selector de categorías tiene opciones"
  echo "3. Ve a un ticket RESOLVED y click en 'Crear Artículo'"
  echo "4. Debe redirigir correctamente sin quedarse cargando"
  echo ""
  exit 0
else
  echo -e "${RED}❌ ALGUNAS CORRECCIONES FALTANTES${NC}"
  echo ""
  echo "Revisa los errores arriba y corrige."
  echo ""
  exit 1
fi
