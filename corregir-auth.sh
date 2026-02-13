#!/bin/bash

echo "🔧 Corrigiendo problemas de autenticación NextAuth"
echo "=================================================="

# 1. Limpiar caché de Next.js
echo "🧹 Limpiando caché de Next.js..."
rm -rf .next
rm -rf node_modules/.cache

# 2. Verificar y regenerar Prisma
echo "🔄 Regenerando cliente de Prisma..."
npx prisma generate

# 3. Verificar conexión a la base de datos
echo "🗄️ Verificando conexión a la base de datos..."
npx prisma db push --accept-data-loss

# 4. Verificar que las variables de entorno se cargan correctamente
echo "🔍 Verificando variables de entorno..."
node -e "
require('dotenv').config({ path: '.env.local' });
console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '✅ Configurado' : '❌ No configurado');
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL ? '✅ Configurado' : '❌ No configurado');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Configurado' : '❌ No configurado');
"

# 5. Crear un endpoint de prueba para verificar NextAuth
echo "📝 Creando endpoint de prueba..."
cat > src/app/api/test-auth/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    return NextResponse.json({
      success: true,
      session: session,
      timestamp: new Date().toISOString(),
      env: {
        NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        DATABASE_URL: !!process.env.DATABASE_URL,
      }
    })
  } catch (error) {
    console.error('Test auth error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
EOF

echo "✅ Correcciones aplicadas"
echo ""
echo "📋 Próximos pasos:"
echo "1. Reiniciar el servidor de desarrollo: npm run dev"
echo "2. Probar el endpoint: http://localhost:3000/api/test-auth"
echo "3. Verificar la sesión: http://localhost:3000/api/auth/session"
echo ""
echo "🔧 Si el problema persiste:"
echo "- Verificar que PostgreSQL esté corriendo"
echo "- Verificar que la base de datos 'tickets_db' exista"
echo "- Ejecutar: npx prisma migrate reset --force"