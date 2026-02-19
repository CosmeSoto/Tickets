#!/bin/bash

echo "🔍 Probando API de Categorías..."
echo ""

# Verificar que el servidor esté corriendo
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "❌ El servidor no está corriendo en http://localhost:3000"
  echo "   Por favor ejecuta: npm run dev"
  exit 1
fi

echo "✅ Servidor corriendo"
echo ""

# Obtener categorías
echo "📊 Obteniendo categorías..."
response=$(curl -s http://localhost:3000/api/categories)

# Verificar si la respuesta es válida
if echo "$response" | jq empty 2>/dev/null; then
  echo "✅ Respuesta JSON válida"
  echo ""
  
  # Mostrar resumen
  total=$(echo "$response" | jq '.data | length')
  echo "📈 Total de categorías: $total"
  echo ""
  
  # Mostrar primera categoría
  echo "🔍 Primera categoría:"
  echo "$response" | jq '.data[0] | {
    id,
    name,
    level,
    has_technician_assignments: (.technician_assignments != null),
    technician_assignments_count: (.technician_assignments | length),
    first_assignment: (.technician_assignments[0] | {
      id,
      has_users: (.users != null),
      users
    })
  }'
  
  echo ""
  echo "📋 Estructura completa de la primera categoría:"
  echo "$response" | jq '.data[0]' | head -50
  
else
  echo "❌ Respuesta inválida del servidor"
  echo "$response" | head -20
  exit 1
fi
