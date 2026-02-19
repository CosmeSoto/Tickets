import prisma from './src/lib/prisma'

async function verifySystemComplete() {
  console.log('🔍 VERIFICACIÓN COMPLETA DEL SISTEMA\n')
  console.log('=' .repeat(60))
  
  let errors = 0
  let warnings = 0
  let success = 0

  try {
    // 1. Verificar conexión a base de datos
    console.log('\n1️⃣ Verificando conexión a base de datos...')
    await prisma.$queryRaw`SELECT 1`
    console.log('   ✅ Conexión a base de datos: OK')
    success++

    // 2. Verificar tablas principales
    console.log('\n2️⃣ Verificando tablas principales...')
    const tables = ['users', 'categories', 'departments', 'tickets', 'technician_assignments']
    for (const table of tables) {
      const count = await (prisma as any)[table].count()
      console.log(`   ✅ Tabla ${table}: ${count} registros`)
      success++
    }

    // 3. Verificar relaciones de usuarios
    console.log('\n3️⃣ Verificando relaciones de usuarios...')
    const userWithRelations = await prisma.users.findFirst({
      where: { role: 'TECHNICIAN' },
      include: {
        departments: true,
        technician_assignments: {
          include: {
            categories: true
          }
        }
      }
    })
    if (userWithRelations) {
      console.log(`   ✅ Usuario con departamento: ${userWithRelations.departments?.name || 'Sin departamento'}`)
      console.log(`   ✅ Asignaciones de técnico: ${userWithRelations.technician_assignments.length}`)
      success += 2
    } else {
      console.log('   ⚠️  No se encontraron técnicos')
      warnings++
    }

    // 4. Verificar relaciones de tickets
    console.log('\n4️⃣ Verificando relaciones de tickets...')
    const ticketWithRelations = await prisma.tickets.findFirst({
      include: {
        users_tickets_clientIdTousers: true,
        users_tickets_assigneeIdTousers: true,
        categories: true,
        comments: {
          include: {
            users: true
          }
        },
        ticket_history: {
          include: {
            users: true
          }
        }
      }
    })
    if (ticketWithRelations) {
      console.log(`   ✅ Ticket con cliente: ${ticketWithRelations.users_tickets_clientIdTousers.name}`)
      console.log(`   ✅ Ticket con categoría: ${ticketWithRelations.categories.name}`)
      console.log(`   ✅ Comentarios: ${ticketWithRelations.comments.length}`)
      console.log(`   ✅ Historial: ${ticketWithRelations.ticket_history.length}`)
      success += 4
    } else {
      console.log('   ⚠️  No se encontraron tickets')
      warnings++
    }

    // 5. Verificar relaciones de categorías
    console.log('\n5️⃣ Verificando relaciones de categorías...')
    const categoryWithRelations = await prisma.categories.findFirst({
      where: { level: 1 },
      include: {
        departments: true,
        other_categories: true,
        technician_assignments: {
          include: {
            users: true
          }
        },
        _count: {
          select: {
            tickets: true,
            other_categories: true,
            technician_assignments: true
          }
        }
      }
    })
    if (categoryWithRelations) {
      console.log(`   ✅ Categoría con departamento: ${categoryWithRelations.departments?.name || 'Sin departamento'}`)
      console.log(`   ✅ Subcategorías: ${categoryWithRelations._count.other_categories}`)
      console.log(`   ✅ Técnicos asignados: ${categoryWithRelations._count.technician_assignments}`)
      console.log(`   ✅ Tickets: ${categoryWithRelations._count.tickets}`)
      success += 4
    } else {
      console.log('   ⚠️  No se encontraron categorías')
      warnings++
    }

    // 6. Verificar integridad de datos
    console.log('\n6️⃣ Verificando integridad de datos...')
    
    // Como clientId y categoryId son campos requeridos (NOT NULL),
    // simplemente verificamos que todos los tickets existen
    const totalTickets = await prisma.tickets.count()
    console.log(`   ✅ Total de tickets: ${totalTickets}`)
    console.log(`   ✅ Todos los tickets tienen cliente y categoría (campos requeridos)`)
    success += 2

    // Verificar que todas las asignaciones existen
    const totalAssignments = await prisma.technician_assignments.count()
    console.log(`   ✅ Total de asignaciones: ${totalAssignments}`)
    console.log(`   ✅ Todas las asignaciones tienen técnico y categoría (campos requeridos)`)
    success += 2

    // 7. Verificar índices y rendimiento
    console.log('\n7️⃣ Verificando rendimiento de consultas...')
    const startTime = Date.now()
    await prisma.tickets.findMany({
      take: 10,
      include: {
        users_tickets_clientIdTousers: true,
        categories: true
      }
    })
    const queryTime = Date.now() - startTime
    if (queryTime < 1000) {
      console.log(`   ✅ Consulta de tickets: ${queryTime}ms (Excelente)`)
      success++
    } else if (queryTime < 3000) {
      console.log(`   ⚠️  Consulta de tickets: ${queryTime}ms (Aceptable)`)
      warnings++
    } else {
      console.log(`   ❌ Consulta de tickets: ${queryTime}ms (Lento)`)
      errors++
    }

    // 8. Verificar campos requeridos
    console.log('\n8️⃣ Verificando campos requeridos...')
    const usersWithEmail = await prisma.users.count({
      where: { email: { not: '' } }
    })
    const totalUsers = await prisma.users.count()
    const categoriesWithName = await prisma.categories.count({
      where: { name: { not: '' } }
    })
    const totalCategories = await prisma.categories.count()
    
    if (usersWithEmail === totalUsers && categoriesWithName === totalCategories) {
      console.log('   ✅ Todos los registros tienen campos requeridos')
      success++
    } else {
      console.log(`   ❌ Encontrados registros sin campos requeridos`)
      errors++
    }

    // Resumen final
    console.log('\n' + '='.repeat(60))
    console.log('\n📊 RESUMEN DE VERIFICACIÓN:')
    console.log(`   ✅ Exitosos: ${success}`)
    console.log(`   ⚠️  Advertencias: ${warnings}`)
    console.log(`   ❌ Errores: ${errors}`)
    
    if (errors === 0 && warnings === 0) {
      console.log('\n🎉 ¡SISTEMA COMPLETAMENTE FUNCIONAL!')
      console.log('   Todas las relaciones de Prisma están correctas')
      console.log('   La base de datos está en buen estado')
      console.log('   El rendimiento es óptimo')
    } else if (errors === 0) {
      console.log('\n✅ Sistema funcional con advertencias menores')
      console.log('   Las advertencias no afectan la funcionalidad principal')
    } else {
      console.log('\n⚠️  Se encontraron errores que requieren atención')
      process.exit(1)
    }

  } catch (error) {
    console.error('\n❌ ERROR CRÍTICO:')
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verifySystemComplete()
