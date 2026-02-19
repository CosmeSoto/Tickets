#!/bin/bash

# Script para corregir TODAS las relaciones de Prisma en el proyecto

echo "🔧 Corrigiendo relaciones de Prisma en todo el proyecto..."

# Corregir en archivos API
echo "📁 Corrigiendo archivos API..."
find src/app/api -name "*.ts" -type f -exec sed -i '' 's/parent: {/categories: {/g' {} \;
find src/app/api -name "*.ts" -type f -exec sed -i '' 's/department: {/departments: {/g' {} \;
find src/app/api -name "*.ts" -type f -exec sed -i '' 's/children: {/other_categories: {/g' {} \;
find src/app/api -name "*.ts" -type f -exec sed -i '' 's/technicianAssignments: {/technician_assignments: {/g' {} \;
find src/app/api -name "*.ts" -type f -exec sed -i '' 's/technician: {/users: {/g' {} \;

echo "✅ Correcciones completadas"
