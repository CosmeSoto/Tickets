import prisma from './src/lib/prisma'

async function testPrismaRelations() {
  console.log('🔍 Testing Prisma Relations...\n')

  try {
    // Test 1: Verificar que podemos leer categorías
    console.log('1️⃣ Testing categories...')
    const categories = await prisma.categories.findMany({
      take: 2,
      select: {
        id: true,
        name: true,
        level: true,
        _count: {
          select: {
            tickets: true,
            other_categories: true
          }
        }
      }
    })
    console.log('✅ Categories OK:', categories.length, 'found')

    // Test 2: Verificar que podemos leer usuarios con departamentos
    console.log('\n2️⃣ Testing users with departments...')
    const users = await prisma.users.findMany({
      take: 2,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        departments: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
    console.log('✅ Users OK:', users.length, 'found')
    if (users[0]) {
      console.log('   Sample user:', {
        name: users[0].name,
        department: users[0].departments?.name || 'No department'
      })
    }

    // Test 3: Verificar que podemos leer tickets con relaciones
    console.log('\n3️⃣ Testing tickets with relations...')
    const tickets = await prisma.tickets.findMany({
      take: 2,
      select: {
        id: true,
        title: true,
        status: true,
        users_tickets_clientIdTousers: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        users_tickets_assigneeIdTousers: {
          select: {
            id: true,
            name: true
          }
        },
        categories: {
          select: {
            id: true,
            name: true,
            level: true
          }
        },
        _count: {
          select: {
            comments: true,
            attachments: true
          }
        }
      }
    })
    console.log('✅ Tickets OK:', tickets.length, 'found')
    if (tickets[0]) {
      console.log('   Sample ticket:', {
        title: tickets[0].title,
        client: tickets[0].users_tickets_clientIdTousers.name,
        assignee: tickets[0].users_tickets_assigneeIdTousers?.name || 'Unassigned',
        category: tickets[0].categories.name
      })
    }

    // Test 4: Verificar asignaciones de técnicos
    console.log('\n4️⃣ Testing technician assignments...')
    const assignments = await prisma.technician_assignments.findMany({
      take: 2,
      select: {
        id: true,
        priority: true,
        users: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        categories: {
          select: {
            id: true,
            name: true,
            level: true
          }
        }
      }
    })
    console.log('✅ Technician Assignments OK:', assignments.length, 'found')
    if (assignments[0]) {
      console.log('   Sample assignment:', {
        technician: assignments[0].users.name,
        category: assignments[0].categories.name,
        priority: assignments[0].priority
      })
    }

    // Test 5: Verificar comentarios con autor
    console.log('\n5️⃣ Testing comments with author...')
    const comments = await prisma.comments.findMany({
      take: 2,
      select: {
        id: true,
        content: true,
        users: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        tickets: {
          select: {
            id: true,
            title: true
          }
        }
      }
    })
    console.log('✅ Comments OK:', comments.length, 'found')

    // Test 6: Verificar historial de tickets
    console.log('\n6️⃣ Testing ticket history...')
    const history = await prisma.ticket_history.findMany({
      take: 2,
      select: {
        id: true,
        action: true,
        users: {
          select: {
            id: true,
            name: true
          }
        },
        tickets: {
          select: {
            id: true,
            title: true
          }
        }
      }
    })
    console.log('✅ Ticket History OK:', history.length, 'found')

    console.log('\n✅ All Prisma relation tests passed!')
    console.log('🎉 The database schema is correctly configured!')

  } catch (error) {
    console.error('\n❌ Error testing Prisma relations:')
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testPrismaRelations()
