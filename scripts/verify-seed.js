#!/usr/bin/env node

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function verifySeed() {
  console.log('🔍 Verificando seed de la base de datos...\n')

  try {
    const admin = await prisma.users.findUnique({
      where: { email: 'internet.freecom@gmail.com' },
      include: {
        departments: true,
        notification_preferences: true,
      },
    })

    console.log('👤 Usuario Administrador:')
    if (admin) {
      console.log('   ✅ Email:', admin.email)
      console.log('   ✅ Nombre:', admin.name)
      console.log('   ✅ Rol:', admin.role)
      console.log('   ✅ Departamento:', admin.departments?.name || 'N/A')
      console.log('   ✅ Activo:', admin.isActive ? 'Sí' : 'No')
      console.log('   ✅ Email verificado:', admin.isEmailVerified ? 'Sí' : 'No')
      console.log(
        '   ✅ Preferencias de notificación:',
        admin.notification_preferences ? 'Configuradas' : 'No configuradas'
      )
    } else {
      console.log('   ❌ No encontrado')
    }

    const families = await prisma.families.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    })

    console.log('\n🏛️  Familias activas (organigrama):')
    if (families.length > 0) {
      console.log(`   ✅ Total: ${families.length}`)
      families.forEach(f => console.log(`      ${f.order}. ${f.name} (${f.code})`))
    } else {
      console.log('   ❌ No encontradas')
    }

    const slaPolicies = await prisma.sla_policies.findMany({
      orderBy: { priority: 'asc' },
    })

    console.log('\n⏱️  Políticas de SLA:')
    console.log(`   ${slaPolicies.length >= 8 ? '✅' : '⚠️'} Total: ${slaPolicies.length} (esperado ≥ 8)`)

    const siteConfig = await prisma.site_config.findMany()
    console.log('\n⚙️  Configuración del Sitio:')
    console.log(`   ${siteConfig.length >= 5 ? '✅' : '❌'} Total: ${siteConfig.length}`)

    const departments = await prisma.departments.count()
    console.log('\n🏢 Departamentos:')
    console.log(`   ${departments >= 25 ? '✅' : '⚠️'} Total: ${departments} (esperado ~25)`)

    const categories = await prisma.categories.count()
    console.log('\n🎫 Categorías de tickets:')
    console.log(`   ${categories > 0 ? '✅' : '❌'} Total: ${categories}`)

    const brands = await prisma.equipment_brands.count()
    const brandsWithoutFamily = await prisma.equipment_brands.count({ where: { familyId: null } })
    console.log('\n🏷️  Marcas de equipos:')
    console.log(`   ${brands > 0 ? '✅' : '❌'} Total: ${brands}`)
    if (brandsWithoutFamily > 0) {
      console.log(`   ⚠️  Sin familia: ${brandsWithoutFamily} (re-ejecutar seed)`)
    }

    const warehouses = await prisma.warehouses.count()
    console.log('\n🏭 Bodegas:')
    console.log(`   ${warehouses >= 10 ? '✅' : '⚠️'} Total: ${warehouses} (esperado ≥ 10)`)

    console.log('\n📊 Resumen:')
    const allGood =
      admin &&
      families.length === 6 &&
      slaPolicies.length >= 8 &&
      siteConfig.length >= 5 &&
      departments >= 25 &&
      categories > 0 &&
      brands > 0 &&
      brandsWithoutFamily === 0 &&
      warehouses >= 10

    if (allGood) {
      console.log('   ✅ Seed completado correctamente')
      console.log('\n🎉 La base de datos está lista para usar!')
      console.log('\n👤 Credenciales de acceso:')
      console.log('   Email: internet.freecom@gmail.com')
      console.log('   Contraseña: admin123')
    } else {
      console.log('   ⚠️  Algunos elementos faltan. Ejecuta: npx prisma db seed')
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

verifySeed()
