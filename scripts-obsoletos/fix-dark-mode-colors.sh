#!/bin/bash

# Script para corregir colores hardcodeados y hacerlos compatibles con modo oscuro

echo "🎨 Corrigiendo colores hardcodeados para modo oscuro..."

# Directorio de componentes
COMPONENTS_DIR="src/components"
APP_DIR="src/app"

# Función para reemplazar colores en archivos
fix_colors() {
    local dir=$1
    echo "📁 Procesando directorio: $dir"
    
    # Encontrar todos los archivos .tsx
    find "$dir" -name "*.tsx" -type f | while read -r file; do
        echo "🔧 Procesando: $file"
        
        # Reemplazos más comunes
        sed -i '' \
            -e 's/bg-white/bg-card/g' \
            -e 's/bg-gray-50/bg-muted/g' \
            -e 's/bg-gray-100/bg-muted/g' \
            -e 's/border-gray-200/border-border/g' \
            -e 's/border-gray-300/border-border/g' \
            -e 's/text-gray-900/text-foreground/g' \
            -e 's/text-gray-800/text-foreground/g' \
            -e 's/text-gray-700/text-foreground/g' \
            -e 's/text-gray-600/text-muted-foreground/g' \
            -e 's/text-gray-500/text-muted-foreground/g' \
            -e 's/text-gray-400/text-muted-foreground/g' \
            -e 's/hover:bg-gray-50/hover:bg-muted/g' \
            -e 's/hover:bg-gray-100/hover:bg-muted/g' \
            -e 's/hover:text-gray-800/hover:text-foreground/g' \
            -e 's/hover:text-gray-900/hover:text-foreground/g' \
            "$file"
    done
}

# Procesar directorios
fix_colors "$COMPONENTS_DIR"
fix_colors "$APP_DIR"

echo "✅ Corrección de colores completada!"
echo "🔄 Recuerda reiniciar el servidor de desarrollo para ver los cambios"