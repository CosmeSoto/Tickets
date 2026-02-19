#!/usr/bin/env node

/**
 * Test directo de Prisma para verificar que los modelos funcionan
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testResolutionModels() {
  console.log('🧪 PROBANDO MODELOS DE PRISMA\n');
  console.log('='.repeat(50));
  
  try {
    // Test 1: Verificar que el modelo existe
    console.log('\n1️⃣  Verificando que prisma.resolution_plans existe...');
    if (prisma.resolution_plans) {
      console.log('✅ prisma.resolution_plans existe');
    } else {
      console.log('❌ prisma.resolution_plans NO existe');
      process.exit(1);
    }
    
    // Test 2: Verificar que el modelo resolution_tasks existe
    console.log('\n2️⃣  Verificando que prisma.resolution_tasks existe...');
    if (prisma.resolution_tasks) {
      console.log('✅ prisma.resolution_tasks existe');
    } else {
      console.log('❌ prisma.resolution_tasks NO existe');
      process.exit(1);
    }
    
    // Test 3: Intentar hacer una query simple
    console.log('\n3️⃣  Probando query a resolution_plans...');
    const plans = await prisma.resolution_plans.findMany({
      take: 1
    });
    console.log(`✅ Query exitosa. Planes encontrados: ${plans.length}`);
    
    // Test 4: Intentar hacer una query simple a tasks
    console.log('\n4️⃣  Probando query a resolution_tasks...');
    const tasks = await prisma.resolution_tasks.findMany({
      take: 1
    });
    console.log(`✅ Query exitosa. Tareas encontradas: ${tasks.length}`);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ TODOS LOS TESTS PASARON');
    console.log('\n💡 Los modelos de Prisma funcionan correctamente.');
    console.log('   El error 500 debe ser por otra razón.');
    console.log('\n🔍 Posibles causas:');
    console.log('   1. El servidor Next.js no se ha reiniciado');
    console.log('   2. Hay un error en la lógica de la API');
    console.log('   3. Problema de permisos o autenticación');
    
  } catch (error) {
    console.log('\n❌ ERROR EN LOS TESTS');
    console.error('\nDetalle del error:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    
    console.log('\n🔧 Solución:');
    console.log('   1. Verificar que la base de datos está corriendo');
    console.log('   2. Ejecutar: npx prisma migrate dev');
    console.log('   3. Ejecutar: npx prisma generate');
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testResolutionModels();
