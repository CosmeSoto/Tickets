#!/bin/bash

echo "🔧 Corrigiendo errores de runtime en APIs..."

# Buscar y corregir referencias incorrectas en todos los archivos API y servicios
find src -name "*.ts" -type f | while read file; do
    changed=false
    
    # Verificar si el archivo tiene referencias incorrectas
    if grep -q "technicianAssignments" "$file" 2>/dev/null; then
        sed -i '' 's/technicianAssignments/technician_assignments/g' "$file"
        changed=true
    fi
    
    if grep -q "assignedTickets" "$file" 2>/dev/null; then
        sed -i '' 's/assignedTickets/tickets_tickets_assigneeIdTousers/g' "$file"
        changed=true
    fi
    
    if grep -q "createdTickets" "$file" 2>/dev/null; then
        sed -i '' 's/createdTickets/tickets_tickets_createdByIdTousers/g' "$file"
        changed=true
    fi
    
    if [ "$changed" = true ]; then
        echo "  ✅ Corregido: $file"
    fi
done

echo ""
echo "✅ Correcciones completadas"
