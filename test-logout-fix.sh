#!/bin/bash

# Script de verificación de corrección de logout
# Verifica que el cierre de sesión esté implementado correctamente

echo "=================================================="
echo "🔐 VERIFICACIÓN DE CORRECCIÓN DE LOGOUT"
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

echo -e "${BLUE}1. Verificando imports de signOut...${NC}"
echo ""

# Verificar import en role-dashboard-layout
if grep -q "import { useSession, signOut } from 'next-auth/react'" "src/components/layout/role-dashboard-layout.tsx"; then
    test_check 0 "Import de signOut en role-dashboard-layout.tsx"
else
    test_check 1 "Import de signOut FALTANTE en role-dashboard-layout.tsx"
fi

# Verificar import en header
if grep -q "import { useSession, signOut } from 'next-auth/react'" "src/components/layout/header.tsx"; then
    test_check 0 "Import de signOut en header.tsx"
else
    test_check 1 "Import de signOut FALTANTE en header.tsx"
fi

echo ""
echo -e "${BLUE}2. Verificando implementación correcta de handleLogout...${NC}"
echo ""

# Verificar que NO use fetch a /api/auth/signout (método incorrecto)
if grep -q "fetch('/api/auth/signout'" "src/components/layout/role-dashboard-layout.tsx"; then
    test_check 1 "role-dashboard-layout usa método INCORRECTO (fetch)"
else
    test_check 0 "role-dashboard-layout NO usa método incorrecto"
fi

# Verificar que use signOut de next-auth
if grep -q "await signOut({" "src/components/layout/role-dashboard-layout.tsx"; then
    test_check 0 "role-dashboard-layout usa signOut de next-auth"
else
    test_check 1 "role-dashboard-layout NO usa signOut de next-auth"
fi

# Verificar callbackUrl en role-dashboard-layout
if grep -q "callbackUrl: '/login'" "src/components/layout/role-dashboard-layout.tsx"; then
    test_check 0 "role-dashboard-layout tiene callbackUrl correcto"
else
    test_check 1 "role-dashboard-layout NO tiene callbackUrl"
fi

echo ""
echo -e "${BLUE}3. Verificando implementación en Header...${NC}"
echo ""

# Verificar que header use signOut correctamente
if grep -q "onClick={() => signOut({ callbackUrl: '/login' })}" "src/components/layout/header.tsx"; then
    test_check 0 "Header usa signOut correctamente"
else
    test_check 1 "Header NO usa signOut correctamente"
fi

echo ""
echo -e "${BLUE}4. Verificando que no haya endpoints incorrectos...${NC}"
echo ""

# Buscar cualquier referencia a /api/auth/signout (que no existe)
if grep -r "'/api/auth/signout'" src/components/ 2>/dev/null | grep -v "test-logout-fix.sh"; then
    test_check 1 "Encontradas referencias a endpoint incorrecto /api/auth/signout"
else
    test_check 0 "No hay referencias a endpoints incorrectos"
fi

echo ""
echo -e "${BLUE}5. Verificando build de Next.js...${NC}"
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
echo -e "${BLUE}6. Verificando componentes que usan logout...${NC}"
echo ""

# Contar cuántos componentes implementan logout
LOGOUT_COMPONENTS=$(grep -r "signOut" src/components/ --include="*.tsx" | grep -v "test-logout-fix.sh" | wc -l)
echo "Componentes con logout: $LOGOUT_COMPONENTS"

if [ $LOGOUT_COMPONENTS -ge 2 ]; then
    test_check 0 "Múltiples componentes implementan logout ($LOGOUT_COMPONENTS)"
else
    test_check 1 "Pocos componentes con logout ($LOGOUT_COMPONENTS)"
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
    echo -e "${GREEN}✓ CORRECCIÓN DE LOGOUT COMPLETADA${NC}"
    echo ""
    echo "El cierre de sesión ahora funciona correctamente:"
    echo ""
    echo "Implementaciones verificadas:"
    echo "  ✓ role-dashboard-layout.tsx usa signOut de next-auth"
    echo "  ✓ header.tsx usa signOut de next-auth"
    echo "  ✓ No hay referencias a endpoints incorrectos"
    echo "  ✓ callbackUrl configurado a /login"
    echo "  ✓ Build compila sin errores"
    echo ""
    echo "Cómo funciona ahora:"
    echo "  1. Usuario hace click en 'Cerrar Sesión'"
    echo "  2. Se llama a signOut({ callbackUrl: '/login' })"
    echo "  3. NextAuth limpia la sesión automáticamente"
    echo "  4. Usuario es redirigido a /login"
    echo ""
    echo "Ubicaciones del botón de logout:"
    echo "  • Header: Menú de usuario (dropdown)"
    echo "  • RoleDashboardLayout: Menú de usuario (dropdown)"
    echo ""
    exit 0
else
    echo -e "${RED}✗ ALGUNOS TESTS FALLARON${NC}"
    echo ""
    echo "Por favor revisa los errores arriba."
    echo ""
    echo "Posibles problemas:"
    echo "  • Imports faltantes de signOut"
    echo "  • Uso de fetch() en lugar de signOut()"
    echo "  • callbackUrl no configurado"
    echo "  • Errores de compilación"
    echo ""
    exit 1
fi
