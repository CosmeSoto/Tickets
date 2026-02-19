#!/bin/bash

# Script para corregir todas las referencias de prisma.categories a prisma.category

echo "🔧 Corrigiendo referencias de prisma.categories a prisma.category..."

# Lista de archivos a corregir
files=(
  "src/lib/services/technician-notification-service.ts"
  "src/lib/services/category-notification-service.ts"
  "src/lib/services/technician-assignment-service.ts"
  "src/lib/services/category-service.ts"
  "src/services/cached-services.ts"
  "src/lib/services/backup-service.ts"
  "src/app/api/help/bug-report/route.ts"
  "src/app/api/help/contact/route.ts"
  "src/app/api/categories/simple/route.ts"
  "src/app/api/categories/[id]/route.ts"
  "src/app/api/admin/backups/[id]/preview/route.ts"
  "src/app/api/users/[id]/assignments/route.ts"
  "src/app/api/tickets/route.ts"
)

# Contador de archivos modificados
count=0

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Usar sed para reemplazar prisma.categories por prisma.category
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      sed -i '' 's/prisma\.categories/prisma.category/g' "$file"
    else
      # Linux
      sed -i 's/prisma\.categories/prisma.category/g' "$file"
    fi
    echo "✅ Corregido: $file"
    ((count++))
  else
    echo "⚠️  No encontrado: $file"
  fi
done

echo ""
echo "✨ Corrección completada: $count archivos modificados"
echo ""
echo "📝 Nota: El modelo en Prisma se llama 'categories' (plural) pero el cliente"
echo "   de Prisma lo expone como 'category' (singular) siguiendo convenciones."
