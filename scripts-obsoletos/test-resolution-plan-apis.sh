#!/bin/bash

# Script de testing para APIs de Plan de Resolución
# Fecha: 5 de Febrero, 2026

echo "🧪 TESTING: APIs de Plan de Resolución"
echo "========================================"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuración
BASE_URL="http://localhost:3000"
TICKET_ID="cmk4i0lza000higf6av17k8rd" # ID de ejemplo del seed

echo "📋 Configuración:"
echo "  Base URL: $BASE_URL"
echo "  Ticket ID: $TICKET_ID"
echo ""

# Test 1: Verificar que el servidor esté corriendo
echo "1️⃣  Verificando servidor..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✅ Servidor corriendo${NC}"
else
    echo -e "${RED}❌ Servidor no responde${NC}"
    echo "   Por favor ejecuta: npm run dev"
    exit 1
fi
echo ""

# Test 2: GET - Obtener plan (puede no existir aún)
echo "2️⃣  GET /api/tickets/$TICKET_ID/resolution-plan"
RESPONSE=$(curl -s "$BASE_URL/api/tickets/$TICKET_ID/resolution-plan")
echo "   Respuesta: $RESPONSE"

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ API responde correctamente${NC}"
    
    if echo "$RESPONSE" | grep -q '"data":null'; then
        echo -e "${YELLOW}ℹ️  No existe plan aún (esperado)${NC}"
    else
        echo -e "${GREEN}✅ Plan encontrado${NC}"
    fi
else
    echo -e "${RED}❌ Error en API${NC}"
fi
echo ""

# Test 3: POST - Crear plan
echo "3️⃣  POST /api/tickets/$TICKET_ID/resolution-plan"
echo "   Creando plan de resolución..."

CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tickets/$TICKET_ID/resolution-plan" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Plan de resolución de prueba",
    "description": "Este es un plan creado por el script de testing",
    "estimatedHours": 8,
    "targetDate": "2026-02-10T00:00:00Z"
  }')

echo "   Respuesta: $CREATE_RESPONSE"

if echo "$CREATE_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Plan creado exitosamente${NC}"
    PLAN_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "   Plan ID: $PLAN_ID"
elif echo "$CREATE_RESPONSE" | grep -q "Ya existe un plan"; then
    echo -e "${YELLOW}ℹ️  Plan ya existe (esperado si se ejecutó antes)${NC}"
else
    echo -e "${RED}❌ Error al crear plan${NC}"
fi
echo ""

# Test 4: PATCH - Actualizar plan
echo "4️⃣  PATCH /api/tickets/$TICKET_ID/resolution-plan"
echo "   Actualizando plan..."

UPDATE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/tickets/$TICKET_ID/resolution-plan" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "active",
    "actualHours": 2
  }')

echo "   Respuesta: $UPDATE_RESPONSE"

if echo "$UPDATE_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Plan actualizado exitosamente${NC}"
else
    echo -e "${RED}❌ Error al actualizar plan${NC}"
fi
echo ""

# Test 5: POST - Crear tarea
echo "5️⃣  POST /api/tickets/$TICKET_ID/resolution-plan/tasks"
echo "   Creando tarea..."

TASK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tickets/$TICKET_ID/resolution-plan/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tarea de prueba",
    "description": "Esta es una tarea creada por el script de testing",
    "priority": "high",
    "estimatedHours": 2,
    "dueDate": "2026-02-06T00:00:00Z"
  }')

echo "   Respuesta: $TASK_RESPONSE"

if echo "$TASK_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Tarea creada exitosamente${NC}"
    TASK_ID=$(echo "$TASK_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "   Task ID: $TASK_ID"
else
    echo -e "${RED}❌ Error al crear tarea${NC}"
fi
echo ""

# Test 6: PATCH - Actualizar tarea (si se creó)
if [ ! -z "$TASK_ID" ]; then
    echo "6️⃣  PATCH /api/tickets/$TICKET_ID/resolution-plan/tasks/$TASK_ID"
    echo "   Actualizando tarea..."

    TASK_UPDATE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/tickets/$TICKET_ID/resolution-plan/tasks/$TASK_ID" \
      -H "Content-Type: application/json" \
      -d '{
        "status": "completed",
        "actualHours": 1.5
      }')

    echo "   Respuesta: $TASK_UPDATE_RESPONSE"

    if echo "$TASK_UPDATE_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Tarea actualizada exitosamente${NC}"
    else
        echo -e "${RED}❌ Error al actualizar tarea${NC}"
    fi
    echo ""
fi

# Test 7: GET - Verificar plan completo
echo "7️⃣  GET /api/tickets/$TICKET_ID/resolution-plan (verificación final)"
FINAL_RESPONSE=$(curl -s "$BASE_URL/api/tickets/$TICKET_ID/resolution-plan")

if echo "$FINAL_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Plan obtenido correctamente${NC}"
    
    # Extraer información del plan
    TOTAL_TASKS=$(echo "$FINAL_RESPONSE" | grep -o '"totalTasks":[0-9]*' | cut -d':' -f2)
    COMPLETED_TASKS=$(echo "$FINAL_RESPONSE" | grep -o '"completedTasks":[0-9]*' | cut -d':' -f2)
    PERCENTAGE=$(echo "$FINAL_RESPONSE" | grep -o '"percentage":[0-9]*' | cut -d':' -f2)
    
    echo ""
    echo "📊 Estadísticas del Plan:"
    echo "   Total de tareas: $TOTAL_TASKS"
    echo "   Tareas completadas: $COMPLETED_TASKS"
    echo "   Progreso: $PERCENTAGE%"
else
    echo -e "${RED}❌ Error al obtener plan${NC}"
fi
echo ""

# Resumen
echo "========================================"
echo "✅ Testing completado"
echo ""
echo "📝 Notas:"
echo "  - Si ves errores de autenticación, necesitas estar logueado"
echo "  - Si el plan ya existe, algunos tests mostrarán warnings"
echo "  - Verifica los logs del servidor para más detalles"
echo ""
echo "🔍 Para ver los logs de auditoría:"
echo "   SELECT * FROM audit_logs WHERE entity_type IN ('resolution_plan', 'resolution_task') ORDER BY created_at DESC LIMIT 10;"
echo ""
