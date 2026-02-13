#!/bin/bash

echo "🔍 Verificando imports de prisma en archivos de API..."
echo ""

# Buscar imports incorrectos
INCORRECT=$(grep -r "import { prisma } from '@/lib/prisma'" src/app/api/ 2>/dev/null | wc -l)

if [ "$INCORRECT" -gt 0 ]; then
    echo "❌ Se encontraron $INCORRECT archivos con imports incorrectos:"
    grep -r "import { prisma } from '@/lib/prisma'" src/app/api/ 2>/dev/null
    echo ""
    echo "Estos archivos deben usar: import prisma from '@/lib/prisma'"
    exit 1
else
    echo "✅ Todos los imports de prisma son correctos"
    echo ""
    echo "📊 Archivos verificados:"
    grep -r "import prisma from '@/lib/prisma'" src/app/api/ 2>/dev/null | wc -l
    echo ""
fi

echo "✅ Verificación completada"
