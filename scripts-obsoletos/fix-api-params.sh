#!/bin/bash

# Script para corregir params en todas las rutas de la API
# Next.js 15+ requiere que params sea Promise<{ id: string }>

echo "Corrigiendo params en rutas de la API..."

# Buscar todos los archivos route.ts en carpetas con [id]
find src/app/api -name "route.ts" -path "*/\[id\]/*" | while read file; do
  echo "Procesando: $file"
  
  # Reemplazar { params }: { params: { id: string } } por { params }: { params: Promise<{ id: string }> }
  sed -i '' 's/{ params }: { params: { id: string } }/{ params }: { params: Promise<{ id: string }> }/g' "$file"
  
  # Reemplazar const { id } = params por const { id } = await params
  sed -i '' 's/const { id } = params/const { id } = await params/g' "$file"
  
  # Reemplazar const { id: ticketId } = params por const { id: ticketId } = await params
  sed -i '' 's/const { id: ticketId } = params/const { id: ticketId } = await params/g' "$file"
  
  # Reemplazar const { id: articleId } = params por const { id: articleId } = await params
  sed -i '' 's/const { id: articleId } = params/const { id: articleId } = await params/g' "$file"
done

echo "✅ Corrección completada"
