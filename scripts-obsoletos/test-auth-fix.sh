#!/bin/bash

echo "🔧 Verificación de Corrección de NextAuth"
echo "=========================================="

# Test 1: Verificar endpoint de debug
echo "📋 Test 1: Endpoint de debug de autenticación"
response=$(curl -s -w "%{http_code}" "http://localhost:3000/api/auth/debug" -o /dev/null)
if [ "$response" = "200" ]; then
    echo "✅ Endpoint de debug responde correctamente (200)"
else
    echo "❌ Endpoint de debug falló (HTTP $response)"
fi

# Test 2: Verificar endpoint de sesión
echo "📋 Test 2: Endpoint de sesión NextAuth"
response=$(curl -s -w "%{http_code}" "http://localhost:3000/api/auth/session" -o /dev/null)
if [ "$response" = "200" ]; then
    echo "✅ Endpoint de sesión responde correctamente (200)"
else
    echo "❌ Endpoint de sesión falló (HTTP $response)"
fi

# Test 3: Verificar página de login
echo "📋 Test 3: Página de login"
response=$(curl -s -w "%{http_code}" "http://localhost:3000/login" -o /dev/null)
if [ "$response" = "200" ]; then
    echo "✅ Página de login carga correctamente (200)"
else
    echo "❌ Página de login falló (HTTP $response)"
fi

# Test 4: Verificar módulo de reportes
echo "📋 Test 4: Módulo de reportes unificado"
response=$(curl -s -w "%{http_code}" "http://localhost:3000/admin/reports" -o /dev/null)
if [ "$response" = "200" ] || [ "$response" = "302" ] || [ "$response" = "307" ]; then
    echo "✅ Módulo de reportes responde correctamente ($response)"
else
    echo "❌ Módulo de reportes falló (HTTP $response)"
fi

echo ""
echo "🎯 Resumen de Correcciones Aplicadas:"
echo "====================================="
echo "✅ Configuración OAuth condicional (solo si variables están configuradas)"
echo "✅ Manejo de errores robusto en callbacks de NextAuth"
echo "✅ Endpoint de debug para diagnóstico (/api/auth/debug)"
echo "✅ Módulo de reportes unificado sin redundancias"
echo "✅ Eliminación de archivos con nombres 'professional'"
echo ""
echo "🔍 Cambios Técnicos:"
echo "- OAuth providers solo se cargan si las variables de entorno están configuradas"
echo "- Try-catch en todos los callbacks de NextAuth"
echo "- Valores por defecto para evitar errores de JSON"
echo "- Logs de error mejorados para debugging"
echo ""
echo "✨ El error de NextAuth CLIENT_FETCH_ERROR debería estar resuelto!"