#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifySeed() {
  console.log('🔍 Verificando seed de la base de datos...\n');

  try {
    // Verificar usuario admin
    const admin = await prisma.users.findUnique({
      where: { email: 'internet.freecom@gmail.com' },
      include: {
        departments: true,
        notification_preferences: true
      }
    });

    console.log('👤 Usuario Administrador:');
    if (admin) {
      console.log('   ✅ Email:', admin.email);
      console.log('   ✅ Nombre:', admin.name);
      console.log('   ✅ Rol:', admin.role);
      console.log('   ✅ Departamento:', admin.departments?.name || 'N/A');
      console.log('   ✅ Activo:', admin.isActive ? 'Sí' : 'No');
      console.log('   ✅ Email verificado:', admin.isEmailVerified ? 'Sí' : 'No');
      console.log('   ✅ Preferencias de notificación:', admin.notification_preferences ? 'Configuradas' : 'No configuradas');
    } else {
      console.log('   ❌ No encontrado');
    }

    // Verificar políticas SLA
    const slaPolicies = await prisma.sla_policies.findMany({
      orderBy: { priority: 'asc' }
    });

    console.log('\n⏱️  Políticas de SLA:');
    if (slaPolicies.length > 0) {
      console.log(`   ✅ Total: ${slaPolicies.length} políticas`);
      slaPolicies.forEach(policy => {
        console.log(`\n   📋 ${policy.name}`);
        console.log(`      Prioridad: ${policy.priority}`);
        console.log(`      Respuesta: ${policy.responseTimeHours}h`);
        console.log(`      Resolución: ${policy.resolutionTimeHours}h`);
        console.log(`      Horario: ${policy.businessHoursOnly ? 'Laboral' : '24/7'}`);
        console.log(`      Activa: ${policy.isActive ? 'Sí' : 'No'}`);
      });
    } else {
      console.log('   ❌ No encontradas');
    }

    // Verificar configuración del sitio
    const siteConfig = await prisma.site_config.findMany();

    console.log('\n⚙️  Configuración del Sitio:');
    if (siteConfig.length > 0) {
      console.log(`   ✅ Total: ${siteConfig.length} configuraciones`);
      siteConfig.forEach(config => {
        console.log(`      ${config.key}: ${config.value}`);
      });
    } else {
      console.log('   ❌ No encontrada');
    }

    // Verificar departamentos
    const departments = await prisma.departments.count();
    console.log('\n🏢 Departamentos:');
    console.log(`   ${departments > 0 ? '✅' : '❌'} Total: ${departments}`);

    // Resumen
    console.log('\n📊 Resumen:');
    const allGood = admin && slaPolicies.length === 4 && siteConfig.length >= 5 && departments > 0;
    
    if (allGood) {
      console.log('   ✅ Seed completado correctamente');
      console.log('\n🎉 La base de datos está lista para usar!');
      console.log('\n👤 Credenciales de acceso:');
      console.log('   Email: internet.freecom@gmail.com');
      console.log('   Contraseña: admin123');
    } else {
      console.log('   ⚠️  Algunos elementos faltan. Ejecuta: npx prisma db seed');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifySeed();
