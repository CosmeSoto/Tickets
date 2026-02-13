import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDatabase() {
  console.log('🔍 Verificando estado de la base de datos...')

  try {
    // Verificar usuarios
    const users = await prisma.users.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true
      }
    })
    console.log(`👥 Usuarios encontrados: ${users.length}`)
    users.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - ${user.role} - ${user.isActive ? 'Activo' : 'Inactivo'}`)
    })

    // Verificar categorías
    const categories = await prisma.categories.findMany({
      select: {
        id: true,
        name: true,
        level: true,
        isActive: true
      }
    })
    console.log(`\n📂 Categorías encontradas: ${categories.length}`)
    categories.forEach(cat => {
      console.log(`  - ${cat.name} (Nivel ${cat.level}) - ${cat.isActive ? 'Activa' : 'Inactiva'}`)
    })

    // Verificar tickets
    const tickets = await prisma.tickets.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        users_tickets_clientIdTousers: { select: { name: true } },
        users_tickets_assigneeIdTousers: { select: { name: true } },
        categories: { select: { name: true } }
      }
    })
    console.log(`\n🎫 Tickets encontrados: ${tickets.length}`)
    tickets.forEach(ticket => {
      console.log(`  - ${ticket.title.substring(0, 50)}... - ${ticket.status} - ${ticket.priority}`)
      console.log(`    Cliente: ${ticket.users_tickets_clientIdTousers.name}, Asignado: ${ticket.users_tickets_assigneeIdTousers?.name || 'Sin asignar'}`)
    })

    // Verificar calificaciones
    const ratings = await prisma.ticket_ratings.findMany({
      select: {
        id: true,
        rating: true,
        tickets: { select: { title: true } },
        users_ticket_ratings_clientIdTousers: { select: { name: true } },
        users_ticket_ratings_technicianIdTousers: { select: { name: true } }
      }
    })
    console.log(`\n⭐ Calificaciones encontradas: ${ratings.length}`)
    ratings.forEach(rating => {
      console.log(`  - ${rating.rating}/5 - ${rating.tickets.title.substring(0, 30)}...`)
    })

  } catch (error) {
    console.error('❌ Error verificando la base de datos:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabase()