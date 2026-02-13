#!/bin/bash

echo "🔧 Corrigiendo TODOS los scripts..."

# Función para corregir un archivo
fix_script() {
    local file=$1
    if [ -f "$file" ]; then
        echo "  Corrigiendo: $file"
        
        # Relaciones de tickets
        sed -i '' 's/client: true/users_tickets_clientIdTousers: true/g' "$file"
        sed -i '' 's/assignee: true/users_tickets_assigneeIdTousers: true/g' "$file"
        sed -i '' 's/category: true/categories: true/g' "$file"
        sed -i '' 's/client: {/users_tickets_clientIdTousers: {/g' "$file"
        sed -i '' 's/assignee: {/users_tickets_assigneeIdTousers: {/g' "$file"
        sed -i '' 's/category: {/categories: {/g' "$file"
        
        # Relaciones de ratings
        sed -i '' 's/ticket: {/tickets: {/g' "$file"
        sed -i '' 's/technician: {/users_ticket_ratings_technicianIdTousers: {/g' "$file"
        
        # Relaciones de categorías
        sed -i '' 's/parent: {/categories: {/g' "$file"
        sed -i '' 's/children: {/other_categories: {/g' "$file"
        sed -i '' 's/department: {/departments: {/g' "$file"
        
        # Relaciones de usuarios
        sed -i '' 's/department: true/departments: true/g' "$file"
    fi
}

# Corregir todos los archivos TypeScript en scripts/
for file in scripts/*.ts; do
    if [ -f "$file" ]; then
        fix_script "$file"
    fi
done

echo "✅ Scripts corregidos"
