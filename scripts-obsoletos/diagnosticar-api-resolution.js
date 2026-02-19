#!/usr/bin/env node

/**
 * Script de diagnóstico para API de Resolution Plan
 * Verifica que todo esté configurado correctamente
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 DIAGNÓSTICO DE API RESOLUTION PLAN\n');
console.log('='.repeat(50));

let errors = 0;
let warnings = 0;

// 1. Verificar que el schema tiene los modelos
console.log('\n1️⃣  Verificando Schema de Prisma...');
const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  if (schema.includes('model resolution_plans')) {
    console.log('✅ Modelo resolution_plans encontrado en schema');
  } else {
    console.log('❌ Modelo resolution_plans NO encontrado en schema');
    errors++;
  }
  
  if (schema.includes('model resolution_tasks')) {
    console.log('✅ Modelo resolution_tasks encontrado en schema');
  } else {
    console.log('❌ Modelo resolution_tasks NO encontrado en schema');
    errors++;
  }
} else {
  console.log('❌ Schema de Prisma no encontrado');
  errors++;
}

// 2. Verificar que el cliente de Prisma está generado
console.log('\n2️⃣  Verificando Cliente de Prisma...');
const clientPath = path.join(__dirname, 'node_modules', '.prisma', 'client', 'index.d.ts');
if (fs.existsSync(clientPath)) {
  console.log('✅ Cliente de Prisma existe');
  
  const clientTypes = fs.readFileSync(clientPath, 'utf8');
  
  if (clientTypes.includes('resolution_plans:')) {
    console.log('✅ Tipo resolution_plans encontrado en cliente');
  } else {
    console.log('❌ Tipo resolution_plans NO encontrado en cliente');
    errors++;
  }
  
  if (clientTypes.includes('resolution_tasks:')) {
    console.log('✅ Tipo resolution_tasks encontrado en cliente');
  } else {
    console.log('❌ Tipo resolution_tasks NO encontrado en cliente');
    errors++;
  }
  
  // Verificar fecha de generación
  const stats = fs.statSync(clientPath);
  const now = new Date();
  const ageMinutes = Math.floor((now - stats.mtime) / 1000 / 60);
  
  if (ageMinutes < 10) {
    console.log(`✅ Cliente generado hace ${ageMinutes} minutos (reciente)`);
  } else {
    console.log(`⚠️  Cliente generado hace ${ageMinutes} minutos (podría estar desactualizado)`);
    warnings++;
  }
} else {
  console.log('❌ Cliente de Prisma NO existe');
  errors++;
}

// 3. Verificar que la API existe
console.log('\n3️⃣  Verificando Archivo de API...');
const apiPath = path.join(__dirname, 'src', 'app', 'api', 'tickets', '[id]', 'resolution-plan', 'route.ts');
if (fs.existsSync(apiPath)) {
  console.log('✅ Archivo de API existe');
  
  const apiCode = fs.readFileSync(apiPath, 'utf8');
  
  if (apiCode.includes('prisma.resolution_plans')) {
    console.log('✅ API usa prisma.resolution_plans');
  } else {
    console.log('❌ API NO usa prisma.resolution_plans');
    errors++;
  }
  
  if (apiCode.includes('export async function GET')) {
    console.log('✅ Método GET implementado');
  } else {
    console.log('❌ Método GET NO implementado');
    errors++;
  }
  
  if (apiCode.includes('export async function POST')) {
    console.log('✅ Método POST implementado');
  } else {
    console.log('⚠️  Método POST NO implementado');
    warnings++;
  }
} else {
  console.log('❌ Archivo de API NO existe');
  errors++;
}

// 4. Verificar función de auditoría
console.log('\n4️⃣  Verificando Función de Auditoría...');
const auditPath = path.join(__dirname, 'src', 'lib', 'audit.ts');
if (fs.existsSync(auditPath)) {
  console.log('✅ Archivo de auditoría existe');
  
  const auditCode = fs.readFileSync(auditPath, 'utf8');
  
  if (auditCode.includes('auditResolutionPlanChange')) {
    console.log('✅ Función auditResolutionPlanChange encontrada');
  } else {
    console.log('❌ Función auditResolutionPlanChange NO encontrada');
    errors++;
  }
} else {
  console.log('❌ Archivo de auditoría NO existe');
  errors++;
}

// 5. Verificar componente
console.log('\n5️⃣  Verificando Componente...');
const componentPath = path.join(__dirname, 'src', 'components', 'ui', 'ticket-resolution-tracker.tsx');
if (fs.existsSync(componentPath)) {
  console.log('✅ Componente TicketResolutionTracker existe');
  
  const componentCode = fs.readFileSync(componentPath, 'utf8');
  
  if (componentCode.includes('/api/tickets/${ticketId}/resolution-plan')) {
    console.log('✅ Componente hace llamada correcta a la API');
  } else {
    console.log('❌ Componente NO hace llamada correcta a la API');
    errors++;
  }
} else {
  console.log('❌ Componente TicketResolutionTracker NO existe');
  errors++;
}

// Resumen
console.log('\n' + '='.repeat(50));
console.log('📊 RESUMEN DEL DIAGNÓSTICO\n');
console.log(`❌ Errores: ${errors}`);
console.log(`⚠️  Advertencias: ${warnings}`);

if (errors === 0 && warnings === 0) {
  console.log('\n✅ TODO ESTÁ CORRECTO');
  console.log('\n💡 Si aún hay error 500, el problema es:');
  console.log('   1. El servidor Next.js necesita reiniciarse');
  console.log('   2. Hay un error en tiempo de ejecución (revisar logs del servidor)');
  console.log('\n🔧 Solución:');
  console.log('   1. Detener el servidor (Ctrl+C)');
  console.log('   2. Ejecutar: npm run dev');
  console.log('   3. Probar nuevamente');
} else if (errors === 0) {
  console.log('\n⚠️  HAY ADVERTENCIAS PERO DEBERÍA FUNCIONAR');
  console.log('\n🔧 Recomendación:');
  console.log('   - Regenerar cliente: npx prisma generate');
  console.log('   - Reiniciar servidor: npm run dev');
} else {
  console.log('\n❌ HAY ERRORES QUE DEBEN CORREGIRSE');
  console.log('\n🔧 Pasos para corregir:');
  console.log('   1. Ejecutar: npx prisma generate');
  console.log('   2. Verificar que no hay errores de TypeScript');
  console.log('   3. Reiniciar el servidor');
}

console.log('\n' + '='.repeat(50));

process.exit(errors > 0 ? 1 : 0);
