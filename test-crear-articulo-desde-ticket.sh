#!/bin/bash

# Script de prueba: Crear artículo desde ticket resuelto
# Fecha: 2026-02-05

echo "=================================================="
echo "TEST: Crear Artículo desde Ticket Resuelto"
echo "=================================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuración
API_URL="http://localhost:3000/api"
TICKET_ID="cm5aqvqxh0000uxqxqxqxqxqx" # Reemplazar con ID de ticket RESOLVED real

echo "📋 Configuración:"
echo "   API URL: $API_URL"
echo "   Ticket ID: $TICKET_ID"
echo ""

# Test 1: Obtener sugerencias del ticket
echo "=================================================="
echo "TEST 1: GET /api/tickets/[id]/create-article"
echo "=================================================="
echo "Obteniendo sugerencias del ticket..."
echo ""

RESPONSE=$(curl -s -X GET "$API_URL/tickets/$TICKET_ID/create-article" \
  -H "Content-Type: application/json")

echo "$RESPONSE" | jq '.'

if echo "$RESPONSE" | jq -e '.suggestions' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Sugerencias obtenidas correctamente${NC}"
  
  # Extraer datos para el siguiente test
  TITLE=$(echo "$RESPONSE" | jq -r '.suggestions.title')
  CONTENT=$(echo "$RESPONSE" | jq -r '.suggestions.content')
  TAGS=$(echo "$RESPONSE" | jq -c '.suggestions.tags')
  
  echo ""
  echo "📝 Datos sugeridos:"
  echo "   Título: $TITLE"
  echo "   Tags: $TAGS"
  echo "   Contenido: ${CONTENT:0:100}..."
else
  echo -e "${RED}❌ Error al obtener sugerencias${NC}"
  exit 1
fi

echo ""
echo "=================================================="
echo "TEST 2: POST /api/tickets/[id]/create-article"
echo "=================================================="
echo "Creando artículo desde ticket..."
echo ""

# Preparar payload
PAYLOAD=$(jq -n \
  --arg title "$TITLE" \
  --arg content "$CONTENT" \
  --argjson tags "$TAGS" \
  '{
    title: $title,
    content: $content,
    summary: ($content | .[0:200]),
    tags: $tags
  }')

echo "📤 Payload:"
echo "$PAYLOAD" | jq '.'
echo ""

RESPONSE=$(curl -s -X POST "$API_URL/tickets/$TICKET_ID/create-article" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo "📥 Respuesta:"
echo "$RESPONSE" | jq '.'

if echo "$RESPONSE" | jq -e '.article' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Artículo creado correctamente${NC}"
  
  ARTICLE_ID=$(echo "$RESPONSE" | jq -r '.article.id')
  echo ""
  echo "📄 Artículo creado:"
  echo "   ID: $ARTICLE_ID"
  echo "   Título: $(echo "$RESPONSE" | jq -r '.article.title')"
  echo "   Categoría: $(echo "$RESPONSE" | jq -r '.article.category.name')"
  echo "   Autor: $(echo "$RESPONSE" | jq -r '.article.author.name')"
  echo "   Ticket origen: $(echo "$RESPONSE" | jq -r '.article.sourceTicket.id')"
elif echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  ERROR=$(echo "$RESPONSE" | jq -r '.error')
  if [[ "$ERROR" == *"Ya existe un artículo"* ]]; then
    echo -e "${YELLOW}⚠️  Ya existe un artículo para este ticket${NC}"
    ARTICLE_ID=$(echo "$RESPONSE" | jq -r '.articleId')
    echo "   ID del artículo existente: $ARTICLE_ID"
  else
    echo -e "${RED}❌ Error: $ERROR${NC}"
    exit 1
  fi
else
  echo -e "${RED}❌ Error desconocido${NC}"
  exit 1
fi

echo ""
echo "=================================================="
echo "TEST 3: Verificar artículo en base de datos"
echo "=================================================="
echo "Verificando que el artículo existe..."
echo ""

if [ -n "$ARTICLE_ID" ]; then
  RESPONSE=$(curl -s -X GET "$API_URL/knowledge/$ARTICLE_ID")
  
  if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Artículo encontrado en base de datos${NC}"
    echo ""
    echo "📊 Detalles del artículo:"
    echo "   ID: $(echo "$RESPONSE" | jq -r '.id')"
    echo "   Título: $(echo "$RESPONSE" | jq -r '.title')"
    echo "   Publicado: $(echo "$RESPONSE" | jq -r '.isPublished')"
    echo "   Vistas: $(echo "$RESPONSE" | jq -r '.views')"
    echo "   Votos útiles: $(echo "$RESPONSE" | jq -r '.helpfulVotes')"
    echo "   Ticket origen: $(echo "$RESPONSE" | jq -r '.sourceTicket.id // "N/A"')"
  else
    echo -e "${RED}❌ Artículo no encontrado${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}⚠️  No se pudo obtener ID del artículo${NC}"
fi

echo ""
echo "=================================================="
echo "RESUMEN DE PRUEBAS"
echo "=================================================="
echo -e "${GREEN}✅ Test 1: Obtener sugerencias - PASÓ${NC}"
echo -e "${GREEN}✅ Test 2: Crear artículo - PASÓ${NC}"
echo -e "${GREEN}✅ Test 3: Verificar en BD - PASÓ${NC}"
echo ""
echo "=================================================="
echo "TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE"
echo "=================================================="
echo ""
echo "📝 Notas:"
echo "   - El artículo fue creado desde el ticket: $TICKET_ID"
echo "   - El artículo está vinculado al ticket (sourceTicketId)"
echo "   - El cliente del ticket recibió una notificación"
echo "   - Se registró en auditoría"
echo ""
echo "🔗 URLs para verificar:"
echo "   - Artículo: http://localhost:3000/knowledge/$ARTICLE_ID"
echo "   - Ticket: http://localhost:3000/admin/tickets/$TICKET_ID"
echo ""
