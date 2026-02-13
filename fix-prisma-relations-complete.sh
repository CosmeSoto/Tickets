#!/bin/bash

# Script completo para corregir TODAS las relaciones de Prisma

echo "🔧 Iniciando corrección completa de relaciones Prisma..."
echo ""

# Backup
echo "📦 Creando backup..."
timestamp=$(date +%Y%m%d_%H%M%S)
mkdir -p backups/prisma-fix-$timestamp

# Función para hacer backup y reemplazar
fix_file() {
    local file=$1
    if [ -f "$file" ]; then
        cp "$file" "backups/prisma-fix-$timestamp/$(basename $file)"
        
        # Corregir parent -> categories (relación con categoría padre)
        sed -i '' 's/parent: {/categories: {/g' "$file"
        
        # Corregir children -> other_categories (relación con subcategorías)
        sed -i '' 's/children: {/other_categories: {/g' "$file"
        
        # Corregir department -> departments (relación con departamento)
        sed -i '' 's/department: {/departments: {/g' "$file"
        
        # Corregir technicianAssignments -> technician_assignments
        sed -i '' 's/technicianAssignments: {/technician_assignments: {/g' "$file"
        
        # Corregir technician -> users (en technician_assignments)
        sed -i '' 's/technician: {/users: {/g' "$file"
        
        echo "✅ Corregido: $file"
    fi
}

# Archivos de servicios
echo ""
echo "📁 Corrigiendo servicios..."
fix_file "src/lib/services/category-service.ts"
fix_file "src/lib/services/category-notification-service.ts"
fix_file "src/lib/services/technician-assignment-service.ts"
fix_file "src/lib/services/ticket-service.ts"
fix_file "src/lib/services/assignment-service.ts"
fix_file "src/lib/services/user-service.ts"

# Archivos API
echo ""
echo "📁 Corrigiendo APIs..."
fix_file "src/app/api/categories/route.ts"
fix_file "src/app/api/categories/simple/route.ts"
fix_file "src/app/api/categories/[id]/route.ts"
fix_file "src/app/api/users/route.ts"

# Archivos de tipos/hooks
echo ""
echo "📁 Corrigiendo tipos y hooks..."
fix_file "src/hooks/categories/types.ts"

echo ""
echo "✅ Corrección completada!"
echo "📦 Backup guardado en: backups/prisma-fix-$timestamp"
echo ""
echo "🔍 Verificando cambios..."
echo ""

# Verificar que no queden referencias incorrectas
echo "Buscando referencias incorrectas restantes:"
echo ""
echo "❌ 'parent:' encontrados:"
grep -r "parent: {" src/ 2>/dev/null | wc -l
echo ""
echo "❌ 'children:' encontrados:"
grep -r "children: {" src/ 2>/dev/null | wc -l
echo ""
echo "❌ 'department:' (singular) encontrados:"
grep -r "department: {" src/ 2>/dev/null | wc -l
echo ""
echo "✅ 'categories:' (correcto) encontrados:"
grep -r "categories: {" src/ 2>/dev/null | wc -l
echo ""
echo "✅ 'other_categories:' (correcto) encontrados:"
grep -r "other_categories: {" src/ 2>/dev/null | wc -l
echo ""
echo "✅ 'departments:' (correcto) encontrados:"
grep -r "departments: {" src/ 2>/dev/null | wc -l
