#!/bin/bash

# Script de Verificación del Módulo de Auditoría
# Verifica que todas las correcciones estén aplicadas correctamente

echo "🔍 Verificando Módulo de Auditoría..."
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador de errores
ERRORS=0

# 1. Verificar que no existan referencias a 'timestamp' en archivos de auditoría
echo "1️⃣  Verificando campo 'timestamp' vs 'createdAt'..."
if grep -r "timestamp" src/app/admin/audit/page.tsx | grep -v "// " | grep -v "timestamp:" > /dev/null 2>&1; then
    echo -e "${RED}❌ ADVERTENCIA: Se encontraron referencias a 'timestamp' en page.tsx${NC}"
    grep -n "timestamp" src/app/admin/audit/page.tsx | grep -v "// " | grep -v "timestamp:"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ No se encontraron referencias incorrectas a 'timestamp'${NC}"
fi

if grep -r "log\.timestamp" src/lib/services/audit-export-service.ts > /dev/null 2>&1; then
    echo -e "${RED}❌ ADVERTENCIA: Se encontraron referencias a 'log.timestamp' en audit-export-service.ts${NC}"
    grep -n "log\.timestamp" src/lib/services/audit-export-service.ts
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ audit-export-service.ts usa 'createdAt' correctamente${NC}"
fi

echo ""

# 2. Verificar que exista la sección unificada de botones
echo "2️⃣  Verificando layout de botones..."
if grep -q "Exportar y Acciones" src/app/admin/audit/page.tsx; then
    echo -e "${GREEN}✅ Sección 'Exportar y Acciones' encontrada${NC}"
else
    echo -e "${RED}❌ ERROR: No se encontró la sección unificada de botones${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "grid grid-cols-3 gap-2" src/app/admin/audit/page.tsx; then
    echo -e "${GREEN}✅ Grid de 3 columnas para botones encontrado${NC}"
else
    echo -e "${RED}❌ ERROR: No se encontró el grid de 3 columnas${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# 3. Verificar mejoras en columna Detalles
echo "3️⃣  Verificando mejoras en columna Detalles..."
if grep -q "details.content" src/app/admin/audit/page.tsx; then
    echo -e "${GREEN}✅ Detección de 'content' implementada${NC}"
else
    echo -e "${RED}❌ ERROR: No se encontró detección de 'content'${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "details.comment" src/app/admin/audit/page.tsx; then
    echo -e "${GREEN}✅ Detección de 'comment' implementada${NC}"
else
    echo -e "${RED}❌ ERROR: No se encontró detección de 'comment'${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "details.message" src/app/admin/audit/page.tsx; then
    echo -e "${GREEN}✅ Detección de 'message' implementada${NC}"
else
    echo -e "${RED}❌ ERROR: No se encontró detección de 'message'${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# 4. Verificar que exista AuditExportService
echo "4️⃣  Verificando AuditExportService..."
if [ -f "src/lib/services/audit-export-service.ts" ]; then
    echo -e "${GREEN}✅ audit-export-service.ts existe${NC}"
    
    # Verificar métodos clave
    if grep -q "exportAuditLogs" src/lib/services/audit-export-service.ts; then
        echo -e "${GREEN}✅ Método 'exportAuditLogs' encontrado${NC}"
    else
        echo -e "${RED}❌ ERROR: Método 'exportAuditLogs' no encontrado${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "generateCSV" src/lib/services/audit-export-service.ts; then
        echo -e "${GREEN}✅ Método 'generateCSV' encontrado${NC}"
    else
        echo -e "${RED}❌ ERROR: Método 'generateCSV' no encontrado${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "generateJSON" src/lib/services/audit-export-service.ts; then
        echo -e "${GREEN}✅ Método 'generateJSON' encontrado${NC}"
    else
        echo -e "${RED}❌ ERROR: Método 'generateJSON' no encontrado${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ ERROR: audit-export-service.ts no existe${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# 5. Verificar API de exportación
echo "5️⃣  Verificando API de exportación..."
if [ -f "src/app/api/admin/audit/export/route.ts" ]; then
    echo -e "${GREEN}✅ API de exportación existe${NC}"
    
    if grep -q "AuditExportService" src/app/api/admin/audit/export/route.ts; then
        echo -e "${GREEN}✅ API usa AuditExportService${NC}"
    else
        echo -e "${RED}❌ ERROR: API no usa AuditExportService${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ ERROR: API de exportación no existe${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# 6. Verificar documentación
echo "6️⃣  Verificando documentación..."
if [ -f "docs/CORRECCION_FINAL_AUDITORIA.md" ]; then
    echo -e "${GREEN}✅ CORRECCION_FINAL_AUDITORIA.md existe${NC}"
else
    echo -e "${YELLOW}⚠️  ADVERTENCIA: CORRECCION_FINAL_AUDITORIA.md no encontrado${NC}"
fi

if [ -f "docs/OPTIMIZACIONES_AUDITORIA_FINAL.md" ]; then
    echo -e "${GREEN}✅ OPTIMIZACIONES_AUDITORIA_FINAL.md existe${NC}"
else
    echo -e "${YELLOW}⚠️  ADVERTENCIA: OPTIMIZACIONES_AUDITORIA_FINAL.md no encontrado${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Resumen final
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ VERIFICACIÓN COMPLETADA: Todas las correcciones están aplicadas correctamente${NC}"
    echo ""
    echo "📋 Próximos pasos:"
    echo "   1. Reiniciar el servidor: npm run dev"
    echo "   2. Limpiar caché del navegador: Cmd+Shift+R (Mac) o Ctrl+Shift+R (Windows)"
    echo "   3. Probar exportación CSV y JSON"
    echo "   4. Verificar columna Detalles con comentarios"
    echo "   5. Verificar layout de botones"
    exit 0
else
    echo -e "${RED}❌ VERIFICACIÓN FALLIDA: Se encontraron $ERRORS error(es)${NC}"
    echo ""
    echo "Por favor, revisa los errores anteriores y corrige antes de continuar."
    exit 1
fi
