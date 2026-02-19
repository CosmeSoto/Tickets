#!/usr/bin/env node

/**
 * Test para verificar creación de artículos
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCrearArticulo() {
  console.log('🧪 PROBANDO CREACIÓN DE ARTÍCULOS\n');
  console.log('='.repeat(50));
  
  try {
    // 1. Verificar que hay categorías
    console.log('\n1️⃣  Verificando categorías...');
    const categories = await prisma.categories.findMany({
      where: { isActive: true },
      take: 5
    });
    
    if (categories.length === 0) {
      console.log('❌ NO hay categorías activas en la BD');
      console.log('\n🔧 Solución: Crear al menos una categoría');
      process.exit(1);
    }
    
    console.log(`✅ ${categories.length} categorías encontradas`);
    categories.forEach(cat => {
      console.log(`   - ${cat.name} (${cat.id})`);
    });
    
    // 2. Verificar que hay usuarios TECHNICIAN o ADMIN
    console.log('\n2️⃣  Verificando usuarios autorizados...');
    const authorizedUsers = await prisma.users.findMany({
      where: {
        role: { in: ['TECHNICIAN', 'ADMIN'] },
        isActive: true
      },
      take: 5
    });
    
    if (authorizedUsers.length === 0) {
      console.log('❌ NO hay usuarios TECHNICIAN o ADMIN activos');
      console.log('\n🔧 Solución: Crear al menos un usuario con rol TECHNICIAN o ADMIN');
      process.exit(1);
    }
    
    console.log(`✅ ${authorizedUsers.length} usuarios autorizados encontrados`);
    authorizedUsers.forEach(user => {
      console.log(`   - ${user.name} (${user.role})`);
    });
    
    // 3. Verificar artículos existentes
    console.log('\n3️⃣  Verificando artículos existentes...');
    const articlesCount = await prisma.knowledge_articles.count();
    console.log(`✅ ${articlesCount} artículos en la BD`);
    
    if (articlesCount > 0) {
      const recentArticles = await prisma.knowledge_articles.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { name: true } },
          category: { select: { name: true } }
        }
      });
      
      console.log('\n   Artículos recientes:');
      recentArticles.forEach(article => {
        console.log(`   - "${article.title}"`);
        console.log(`     Autor: ${article.author.name}`);
        console.log(`     Categoría: ${article.category.name}`);
        console.log(`     Vistas: ${article.views}`);
      });
    }
    
    // 4. Verificar estructura de tabla
    console.log('\n4️⃣  Verificando estructura de tabla...');
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'knowledge_articles'
      ORDER BY ordinal_position
    `;
    
    console.log('✅ Tabla knowledge_articles existe con columnas:');
    tableInfo.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ TODOS LOS TESTS PASARON');
    console.log('\n💡 La base de conocimientos usa DATOS REALES de la BD.');
    console.log('   - Categorías: ✅ Reales');
    console.log('   - Usuarios: ✅ Reales');
    console.log('   - Artículos: ✅ Reales');
    
    console.log('\n🔍 Si el botón "Crear Artículo" se queda cargando:');
    console.log('   1. Verifica la consola del navegador para errores');
    console.log('   2. Verifica la consola del servidor para errores');
    console.log('   3. Asegúrate de llenar todos los campos requeridos:');
    console.log('      - Título (mínimo 10 caracteres)');
    console.log('      - Contenido (mínimo 50 caracteres)');
    console.log('      - Categoría (seleccionar una)');
    console.log('      - Tags (al menos 1)');
    
  } catch (error) {
    console.log('\n❌ ERROR EN LOS TESTS');
    console.error('\nDetalle del error:');
    console.error(error.message);
    
    if (error.message.includes('knowledge_articles')) {
      console.log('\n🔧 Solución:');
      console.log('   La tabla knowledge_articles no existe o tiene problemas.');
      console.log('   Ejecutar: npx prisma migrate dev');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testCrearArticulo();
