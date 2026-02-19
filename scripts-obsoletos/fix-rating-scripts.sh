#!/bin/bash

echo "🔧 Corrigiendo scripts de ratings..."

# Agregar import de randomUUID si no existe
for file in scripts/seed-ratings.ts scripts/setup-test-ratings.ts; do
    if [ -f "$file" ]; then
        if ! grep -q "import { randomUUID }" "$file"; then
            sed -i '' "1s/^/import { randomUUID } from 'crypto'\n/" "$file"
        fi
    fi
done

echo "✅ Scripts de ratings corregidos"
