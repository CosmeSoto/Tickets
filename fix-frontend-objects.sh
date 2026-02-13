#!/bin/bash

echo "🔧 Corrigiendo objetos transformados del frontend..."
echo ""

cd "$(dirname "$0")"

# En el frontend, los objetos transformados usan nombres simples:
# - ticket.client (no ticket.users_tickets_clientIdTousers)
# - ticket.assignee (no ticket.users_tickets_assigneeIdTousers)
# - ticket.category (no ticket.categories)
# - comment.author (no comment.users)
# - user.department (no user.departments)
# - category.parent (no category.categories)

echo "Corrigiendo referencias en componentes y páginas..."

# Corregir en todos los archivos de componentes y páginas
find src/app src/components src/hooks -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' \
  -e 's/ticket\.users_tickets_clientIdTousers\./ticket.client./g' \
  -e 's/ticket\.users_tickets_assigneeIdTousers\./ticket.assignee./g' \
  -e 's/ticket\.categories\./ticket.category./g' \
  -e 's/ticketData\.categories\./ticketData.category./g' \
  -e 's/comment\.users\./comment.author./g' \
  -e 's/user\.departments\./user.department./g' \
  -e 's/client\.departments\./client.department./g' \
  -e 's/selectedClient\.departments\./selectedClient.department./g' \
  -e 's/technician\.departments\./technician.department./g' \
  -e 's/category\.categories\./category.parent./g' \
  -e 's/assignment\.categories\./assignment.category./g' \
  {} \;

echo "✅ Correcciones aplicadas"
echo ""
echo "Compilando para verificar..."
