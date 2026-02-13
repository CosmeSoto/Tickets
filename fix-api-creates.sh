#!/bin/bash

echo "🔧 Corrigiendo creates en archivos API..."

# Buscar todos los archivos que tienen prisma.audit_logs.create
find src/app/api -name "*.ts" -type f | while read file; do
    if grep -q "prisma.audit_logs.create" "$file"; then
        echo "  Procesando: $file"
        # Agregar import de randomUUID si no existe
        if ! grep -q "import { randomUUID }" "$file"; then
            sed -i '' "1i\\
import { randomUUID } from 'crypto'\\
" "$file"
        fi
    fi
done

echo "✅ Imports agregados"
echo "⚠️  Nota: Los campos 'id' y 'createdAt' deben agregarse manualmente en cada create"
