#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Diagnóstico de NextAuth - Sistema de Tickets');
console.log('================================================');

// Verificar archivos de configuración
const configFiles = [
  '.env',
  '.env.local',
  'src/lib/auth.ts',
  'src/app/api/auth/[...nextauth]/route.ts'
];

console.log('\n📁 Verificando archivos de configuración:');
configFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`${exists ? '✅' : '❌'} ${file}`);
});

// Verificar variables de entorno críticas
console.log('\n🔑 Verificando variables de entorno críticas:');
const requiredEnvVars = [
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'DATABASE_URL'
];

requiredEnvVars.forEach(envVar => {
  const exists = process.env[envVar];
  console.log(`${exists ? '✅' : '❌'} ${envVar}: ${exists ? '(configurada)' : '(NO CONFIGURADA)'}`);
});

// Verificar configuración de OAuth
console.log('\n🔐 Verificando configuración OAuth (opcional):');
const oauthVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'AZURE_AD_CLIENT_ID',
  'AZURE_AD_CLIENT_SECRET'
];

oauthVars.forEach(envVar => {
  const exists = process.env[envVar];
  console.log(`${exists ? '✅' : '⚠️'} ${envVar}: ${exists ? '(configurada)' : '(no configurada - OAuth deshabilitado)'}`);
});

// Verificar endpoint de sesión
console.log('\n🌐 Probando endpoint de sesión...');

const testSession = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/auth/session', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`Status: ${response.status}`);
    console.log(`Headers: ${JSON.stringify(Object.fromEntries(response.headers), null, 2)}`);
    
    const text = await response.text();
    console.log(`Response body: ${text}`);
    
    if (text) {
      try {
        const json = JSON.parse(text);
        console.log('✅ Respuesta JSON válida:', json);
      } catch (e) {
        console.log('❌ Respuesta no es JSON válido');
      }
    } else {
      console.log('❌ Respuesta vacía - esto causa el error');
    }
    
  } catch (error) {
    console.log('❌ Error al conectar:', error.message);
  }
};

// Solo probar si el servidor está corriendo
if (process.argv.includes('--test-endpoint')) {
  testSession();
}

console.log('\n💡 Soluciones sugeridas:');
console.log('1. Verificar que NEXTAUTH_SECRET esté configurado');
console.log('2. Verificar que DATABASE_URL sea válida');
console.log('3. Reiniciar el servidor de desarrollo');
console.log('4. Limpiar caché: rm -rf .next');
console.log('5. Verificar que Prisma esté sincronizado: npx prisma generate');

console.log('\n🚀 Para probar el endpoint: node diagnosticar-auth.js --test-endpoint');